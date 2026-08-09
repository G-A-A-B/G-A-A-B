import { describe, it, expect } from "vitest";
import {
  MotorATP,
  canal,
  type Canal,
  ConfiguracaoInvalida,
  ErroDeReserva,
  ErroDeEfetivacao,
} from "./engine";

// Helper: cria um motor para uma posição fixa (SKU-1 @ CD-1).
function mk(fisico: number, canais: Canal[], fairShare = false): MotorATP {
  return new MotorATP("SKU-1", "CD-1", fisico, canais, fairShare);
}

function base() {
  return mk(100, [
    canal("Loja", 30),
    canal("Site"),
    canal("Marketplace", 0, 20),
  ]);
}

describe("MotorATP — ATP e políticas", () => {
  it("ATP inicial reflete proteção e restrição", () => {
    const m = base();
    expect(m.snapshot()).toEqual({ Loja: 100, Site: 70, Marketplace: 20 });
  });

  it("proteção residual não bloqueia estoque em dobro", () => {
    const m = mk(100, [canal("Loja", 30), canal("Site")]);
    m.reservar("Loja", 25);
    expect(m.atp("Site")).toBe(70);
  });

  it("restrição recusa reserva acima do teto", () => {
    const m = base();
    expect(() => m.reservar("Marketplace", 21)).toThrow(ErroDeReserva);
  });

  it("não-oversell na disputa pela última unidade", () => {
    const m = mk(1, [canal("A"), canal("B")]);
    m.reservar("A", 1);
    expect(() => m.reservar("B", 1)).toThrow(ErroDeReserva);
  });

  it("proteção sobre-comprometida é recusada sem fair-share", () => {
    expect(() => mk(100, [canal("A", 60), canal("B", 60)])).toThrow(
      ConfiguracaoInvalida,
    );
  });

  it("fair-share rateia proporcionalmente (60+60 → 50/50)", () => {
    const m = mk(100, [canal("A", 60), canal("B", 60)], true);
    expect(m.protecoesEfetivas()).toEqual({ A: 50, B: 50 });
    expect(m.atp("A")).toBe(50);
    expect(m.atp("B")).toBe(50);
  });

  it("restrição menor que a proteção do mesmo canal é recusada", () => {
    expect(() => mk(100, [canal("A", 30, 20)])).toThrow(
      ConfiguracaoInvalida,
    );
  });
});

describe("MotorATP — reservas com status (RESERVED/EFFECTIVE/CANCELLED)", () => {
  it("reservar cria uma reserva RESERVED e debita o disponível", () => {
    const m = base();
    const id = m.reservar("Site", 40);
    expect(m.reservaPorId(id)?.status).toBe("RESERVED");
    expect(m.disponivel).toBe(60);
    expect(m.reservadoDe("Site")).toBe(40);
  });

  it("a reserva carrega a chave SKU + Centro + canal", () => {
    const m = base();
    const id = m.reservar("Site", 10);
    const r = m.reservaPorId(id)!;
    expect(r.sku).toBe("SKU-1");
    expect(r.centro).toBe("CD-1");
    expect(r.canal).toBe("Site");
  });

  it("efetivar recompõe o saldo e atualiza o físico pelo feed externo", () => {
    const m = base();
    const id = m.reservar("Site", 40);
    // Sistema externo informa físico 65 (vendeu 40, indústria repôs 5).
    m.efetivar(id, 65);
    expect(m.reservaPorId(id)?.status).toBe("EFFECTIVE");
    expect(m.reservadoDe("Site")).toBe(0); // hold liberado
    expect(m.fisico).toBe(65); // físico veio de fora
    expect(m.disponivel).toBe(65);
  });

  it("efetivar sem novo físico assume físico − quantidade (só a venda)", () => {
    const m = base();
    const id = m.reservar("Site", 40);
    m.efetivar(id);
    expect(m.fisico).toBe(60);
  });

  it("efetivar com físico abaixo do que segue reservado é recusado", () => {
    const m = base();
    const idA = m.reservar("Site", 40);
    m.reservar("Loja", 20); // 20 seguem RESERVED
    // Físico externo 10 < 20 ainda reservado → oversell, recusado.
    expect(() => m.efetivar(idA, 10)).toThrow(ErroDeEfetivacao);
  });

  it("cancelar recompõe o saldo sem mexer no físico", () => {
    const m = base();
    const id = m.reservar("Site", 40);
    m.cancelar(id);
    expect(m.reservaPorId(id)?.status).toBe("CANCELLED");
    expect(m.fisico).toBe(100);
    expect(m.disponivel).toBe(100);
  });

  it("efetivar/cancelar uma reserva não-RESERVED falha", () => {
    const m = base();
    const id = m.reservar("Site", 10);
    m.efetivar(id, 90);
    expect(() => m.efetivar(id, 80)).toThrow(ErroDeEfetivacao);
    expect(() => m.cancelar(id)).toThrow(ErroDeEfetivacao);
  });
});

describe("MotorATP — restrição acumulada por período", () => {
  it("não reabre ao efetivar, só no reinício", () => {
    const m = mk(100, [canal("Mkt", 0, null, 20)]);
    expect(m.atp("Mkt")).toBe(20);
    const id = m.reservar("Mkt", 20);
    m.efetivar(id, 80);
    expect(m.atp("Mkt")).toBe(0); // instantânea reabriria; acumulada não
    m.reiniciarPeriodo();
    expect(m.vendasDe("Mkt")).toBe(0);
    expect(m.atp("Mkt")).toBe(20);
    expect(m.historico[m.historico.length - 1].evento).toBe("REINICIO_PERIODO");
  });

  it("cancelamento devolve a cota; venda não", () => {
    const m = mk(100, [canal("Mkt", 0, null, 20)]);
    const id1 = m.reservar("Mkt", 20);
    m.cancelar(id1);
    expect(m.atp("Mkt")).toBe(20); // cancelada não conta
    const id2 = m.reservar("Mkt", 12);
    m.efetivar(id2, 88);
    expect(m.atp("Mkt")).toBe(8); // vendeu 12 no período
  });
});
