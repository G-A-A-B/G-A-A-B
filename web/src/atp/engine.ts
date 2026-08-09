/**
 * Motor de ATP (Available-to-Promise) multicanal.
 *
 * CD único com estoque físico de um SKU servindo múltiplos canais, cada um com
 * políticas de Estoque de Proteção (piso reservado) e Estoque de Restrição
 * (teto instantâneo e/ou cota acumulada por período).
 *
 * Concorrência resolvida por RESERVA com ciclo de vida por STATUS:
 *   - RESERVED  : garante a intenção de compra e DEBITA o saldo disponível.
 *   - EFFECTIVE : venda confirmada. RECOMPÕE o saldo (o hold é liberado) e, no
 *                 mesmo momento, o estoque FÍSICO é atualizado pela quantidade
 *                 vinda de outro sistema (vendas realizadas + reposição da
 *                 indústria).
 *   - CANCELLED : intenção desfeita. Recompõe o saldo; o físico não muda.
 *
 *   Disponível           = Físico − Σ Reservas RESERVED
 *   proteçãoResidual(k)  = max(0, proteçãoEfetiva(k) − reservadoRESERVED(k))
 *   ATP(c) = max(0, min(
 *              Disponível − Σ_{k≠c} proteçãoResidual(k),
 *              Restrição(c) − reservadoRESERVED(c),
 *              RestriçãoAcumulada(c) − vendasPeríodo(c) − reservadoRESERVED(c)
 *            ))
 */

export interface Canal {
  nome: string;
  /** Unidades garantidas a este canal (blinda dos demais). 0 = sem proteção. */
  protecao: number;
  /** Teto INSTANTÂNEO de reservas simultâneas (reabre ao efetivar). null = sem teto. */
  restricao: number | null;
  /** Cota de vendas + reservas no PERÍODO (só reabre no reinício). null = sem cota. */
  restricaoAcumulada: number | null;
}

export function canal(
  nome: string,
  protecao = 0,
  restricao: number | null = null,
  restricaoAcumulada: number | null = null,
): Canal {
  if (protecao < 0) throw new Error(`proteção de ${nome} não pode ser negativa`);
  if (restricao !== null && restricao < 0)
    throw new Error(`restrição de ${nome} não pode ser negativa`);
  if (restricaoAcumulada !== null && restricaoAcumulada < 0)
    throw new Error(`restrição acumulada de ${nome} não pode ser negativa`);
  return { nome, protecao, restricao, restricaoAcumulada };
}

export type StatusReserva = "RESERVED" | "EFFECTIVE" | "CANCELLED";

export interface Reserva {
  id: number;
  canal: string;
  quantidade: number;
  status: StatusReserva;
}

export type TipoEvento =
  | "INICIAL"
  | "RESERVA"
  | "EFETIVACAO"
  | "CANCELAMENTO"
  | "REINICIO_PERIODO";

export interface Movimento {
  seq: number;
  momento: string;
  evento: TipoEvento;
  canal: string;
  quantidade: number;
  rotulo: string;
  fisico: number;
  disponivel: number;
  reservas: Record<string, number>;
  atp: Record<string, number>;
}

export class ConfiguracaoInvalida extends Error {}
export class ErroDeReserva extends Error {}
export class ErroDeEfetivacao extends Error {}
export class ViolacaoDeInvariante extends Error {}

export class MotorATP {
  fisico: number;
  readonly fairShare: boolean;
  readonly canais: Map<string, Canal>;
  /** Todas as reservas, em qualquer status (a fonte da verdade da concorrência). */
  readonly reservas: Reserva[] = [];
  /** Vendas confirmadas (EFFECTIVE) no período corrente. */
  readonly vendasPeriodo: Map<string, number>;
  readonly historico: Movimento[] = [];
  private proximoId = 1;

  constructor(fisico: number, canais: Canal[], fairShare = false) {
    if (fisico < 0) throw new Error("estoque físico não pode ser negativo");
    this.fairShare = fairShare;
    const somaProtecoes = canais.reduce((s, c) => s + c.protecao, 0);
    if (somaProtecoes > fisico && !fairShare) {
      throw new ConfiguracaoInvalida(
        `proteções somam ${somaProtecoes} > físico ${fisico}: ` +
          "impossível honrar todas (habilite fair-share para ratear)",
      );
    }
    this.fisico = fisico;
    this.canais = new Map(canais.map((c) => [c.nome, c]));
    this.vendasPeriodo = new Map(canais.map((c) => [c.nome, 0]));
    // Uma restrição (instantânea ou acumulada) menor que a proteção do próprio
    // canal torna a proteção inalcançável: configuração contraditória.
    for (const c of canais) {
      if (c.protecao === 0) continue;
      const piso = Math.min(this.protecaoEfetiva(c.nome), fisico);
      const tetos = [c.restricao, c.restricaoAcumulada].filter(
        (t): t is number => t !== null,
      );
      if (tetos.length > 0 && Math.min(...tetos) < piso) {
        throw new ConfiguracaoInvalida(
          `canal ${c.nome}: restrição ${Math.min(...tetos)} < proteção ${piso}: ` +
            "o canal nunca alcançaria sua proteção",
        );
      }
    }
    this.registrar("INICIAL", "-", 0, "Estado inicial");
  }

  // ----------------------------------------------------------------- //
  // Consultas
  // ----------------------------------------------------------------- //
  /** Quantidade retida (status RESERVED) de um canal. */
  reservadoDe(nome: string): number {
    let t = 0;
    for (const r of this.reservas)
      if (r.status === "RESERVED" && r.canal === nome) t += r.quantidade;
    return t;
  }

  get reservadoTotal(): number {
    let t = 0;
    for (const r of this.reservas) if (r.status === "RESERVED") t += r.quantidade;
    return t;
  }

  get disponivel(): number {
    return this.fisico - this.reservadoTotal;
  }

  vendasDe(nome: string): number {
    return this.vendasPeriodo.get(nome) ?? 0;
  }

  protecoesEfetivas(): Record<string, number> {
    const protecoes: Record<string, number> = {};
    let soma = 0;
    for (const c of this.canais.values()) {
      protecoes[c.nome] = c.protecao;
      soma += c.protecao;
    }
    if (soma === 0 || soma <= this.fisico) return protecoes;

    // Sobre-comprometido: rateio proporcional pelo método do maior resto.
    const exatas: Record<string, number> = {};
    const base: Record<string, number> = {};
    let usado = 0;
    for (const nome of Object.keys(protecoes)) {
      exatas[nome] = (this.fisico * protecoes[nome]) / soma;
      base[nome] = Math.floor(exatas[nome]);
      usado += base[nome];
    }
    let resto = this.fisico - usado;
    const ordem = Object.keys(protecoes).sort((a, b) => {
      const fa = exatas[a] - base[a];
      const fb = exatas[b] - base[b];
      if (fb !== fa) return fb - fa;
      return protecoes[b] - protecoes[a];
    });
    for (const nome of ordem) {
      if (resto <= 0) break;
      base[nome] += 1;
      resto -= 1;
    }
    return base;
  }

  protecaoEfetiva(nome: string): number {
    return this.protecoesEfetivas()[nome];
  }

  protecaoResidual(nome: string): number {
    return Math.max(0, this.protecaoEfetiva(nome) - this.reservadoDe(nome));
  }

  atp(nome: string): number {
    const canal = this.canais.get(nome);
    if (!canal) throw new Error(`canal desconhecido: ${nome}`);

    let blindagemAlheia = 0;
    for (const k of this.canais.keys()) {
      if (k !== nome) blindagemAlheia += this.protecaoResidual(k);
    }
    const limites = [this.disponivel - blindagemAlheia];

    // Teto INSTANTÂNEO: restrição menos o já reservado (reabre ao efetivar).
    if (canal.restricao !== null) {
      limites.push(canal.restricao - this.reservadoDe(nome));
    }
    // Teto ACUMULADO: cota do período menos vendas confirmadas e reservas
    // ativas (só reabre em reiniciarPeriodo, não ao efetivar).
    if (canal.restricaoAcumulada !== null) {
      limites.push(
        canal.restricaoAcumulada - this.vendasDe(nome) - this.reservadoDe(nome),
      );
    }

    return Math.max(0, Math.min(...limites));
  }

  snapshot(): Record<string, number> {
    const s: Record<string, number> = {};
    for (const nome of this.canais.keys()) s[nome] = this.atp(nome);
    return s;
  }

  reservaPorId(id: number): Reserva | undefined {
    return this.reservas.find((r) => r.id === id);
  }

  // ----------------------------------------------------------------- //
  // Operações
  // ----------------------------------------------------------------- //
  /** Cria uma reserva RESERVED (debita o disponível). Retorna o id. */
  reservar(nome: string, quantidade: number, rotulo = ""): number {
    this.exigeCanal(nome);
    this.exigePositivo(quantidade);
    const disp = this.atp(nome);
    if (quantidade > disp) {
      throw new ErroDeReserva(
        `${nome}: reserva de ${quantidade} excede o ATP de ${disp}`,
      );
    }
    const id = this.proximoId++;
    this.reservas.push({ id, canal: nome, quantidade, status: "RESERVED" });
    this.checarInvariantes();
    this.registrar("RESERVA", nome, quantidade, rotulo || `#${id}`);
    return id;
  }

  /**
   * Efetiva uma reserva (RESERVED → EFFECTIVE): recompõe o saldo (libera o
   * hold) e atualiza o físico com a quantidade vinda do sistema externo.
   *
   * `novoFisico` é o físico autoritativo do outro sistema (vendas + reposição).
   * Se omitido, assume `físico − quantidade` (só a venda saiu, sem reposição).
   * É recusado se deixasse o disponível negativo (físico abaixo do que segue
   * reservado por outras reservas RESERVED).
   */
  efetivar(id: number, novoFisico?: number, rotulo = ""): void {
    const r = this.exigeReservada(id);
    const fisicoAlvo = novoFisico ?? this.fisico - r.quantidade;
    if (!Number.isInteger(fisicoAlvo) || fisicoAlvo < 0) {
      throw new ErroDeEfetivacao("novo físico deve ser inteiro ≥ 0");
    }
    const reservadoRestante = this.reservadoTotal - r.quantidade;
    if (fisicoAlvo < reservadoRestante) {
      throw new ErroDeEfetivacao(
        `novo físico ${fisicoAlvo} < ${reservadoRestante} ainda reservado por ` +
          "outras reservas (geraria oversell)",
      );
    }
    r.status = "EFFECTIVE";
    this.fisico = fisicoAlvo;
    this.vendasPeriodo.set(r.canal, this.vendasDe(r.canal) + r.quantidade);
    this.checarInvariantes();
    this.registrar(
      "EFETIVACAO",
      r.canal,
      r.quantidade,
      rotulo || `#${id} físico→${fisicoAlvo}`,
    );
  }

  /** Cancela uma reserva (RESERVED → CANCELLED). Recompõe o saldo; físico intacto. */
  cancelar(id: number, rotulo = ""): void {
    const r = this.exigeReservada(id);
    r.status = "CANCELLED";
    this.checarInvariantes();
    this.registrar("CANCELAMENTO", r.canal, r.quantidade, rotulo || `#${id}`);
  }

  reiniciarPeriodo(rotulo = "Reinício de período"): void {
    for (const nome of this.vendasPeriodo.keys()) this.vendasPeriodo.set(nome, 0);
    this.registrar("REINICIO_PERIODO", "-", 0, rotulo);
  }

  // ----------------------------------------------------------------- //
  // Invariantes
  // ----------------------------------------------------------------- //
  private checarInvariantes(): void {
    if (this.reservadoTotal > this.fisico) {
      throw new ViolacaoDeInvariante(
        `oversell: reservado ${this.reservadoTotal} > físico ${this.fisico}`,
      );
    }
    if (this.disponivel < 0) {
      throw new ViolacaoDeInvariante(`disponível negativo: ${this.disponivel}`);
    }
    for (const canal of this.canais.values()) {
      if (canal.protecao === 0) continue;
      const alcancavel = this.reservadoDe(canal.nome) + this.atp(canal.nome);
      const alvo = Math.min(this.protecaoEfetiva(canal.nome), this.fisico);
      if (alcancavel < alvo) {
        throw new ViolacaoDeInvariante(
          `proteção violada em ${canal.nome}: alcançável ${alcancavel} < alvo ${alvo}`,
        );
      }
    }
  }

  // ----------------------------------------------------------------- //
  // Histórico e helpers
  // ----------------------------------------------------------------- //
  private registrar(
    evento: TipoEvento,
    canal: string,
    quantidade: number,
    rotulo: string,
  ): void {
    const reservas: Record<string, number> = {};
    for (const nome of this.canais.keys()) reservas[nome] = this.reservadoDe(nome);
    this.historico.push({
      seq: this.historico.length,
      momento: new Date().toISOString(),
      evento,
      canal,
      quantidade,
      rotulo,
      fisico: this.fisico,
      disponivel: this.disponivel,
      reservas,
      atp: this.snapshot(),
    });
  }

  private exigeCanal(nome: string): void {
    if (!this.canais.has(nome)) throw new Error(`canal desconhecido: ${nome}`);
  }

  private exigeReservada(id: number): Reserva {
    const r = this.reservaPorId(id);
    if (!r) throw new ErroDeEfetivacao(`reserva #${id} não encontrada`);
    if (r.status !== "RESERVED") {
      throw new ErroDeEfetivacao(
        `reserva #${id} está ${r.status}, não RESERVED`,
      );
    }
    return r;
  }

  private exigePositivo(q: number): void {
    if (!Number.isInteger(q) || q <= 0)
      throw new Error("quantidade deve ser inteiro positivo");
  }
}
