/**
 * Carteira de posições de estoque.
 *
 * Uma posição é identificada por (SKU, Centro de Distribuição) e tem seu próprio
 * MotorATP (físico, canais, reservas). A chave da reserva é, portanto,
 * SKU + Centro + canal (+ id da reserva individual).
 */
import { MotorATP, type Canal } from "./engine";

export function chavePosicao(sku: string, centro: string): string {
  return `${sku}§${centro}`;
}

export class Carteira {
  private readonly posicoes = new Map<string, MotorATP>();

  /** Cria (ou substitui) a posição (sku, centro) e a retorna. */
  definir(
    sku: string,
    centro: string,
    fisico: number,
    canais: Canal[],
    fairShare = false,
  ): MotorATP {
    const motor = new MotorATP(sku, centro, fisico, canais, fairShare);
    this.posicoes.set(chavePosicao(sku, centro), motor);
    return motor;
  }

  obter(sku: string, centro: string): MotorATP | undefined {
    return this.posicoes.get(chavePosicao(sku, centro));
  }

  obterPorChave(chave: string): MotorATP | undefined {
    return this.posicoes.get(chave);
  }

  remover(sku: string, centro: string): void {
    this.posicoes.delete(chavePosicao(sku, centro));
  }

  tem(sku: string, centro: string): boolean {
    return this.posicoes.has(chavePosicao(sku, centro));
  }

  get tamanho(): number {
    return this.posicoes.size;
  }

  /** Posições ordenadas por SKU e depois por Centro. */
  lista(): MotorATP[] {
    return [...this.posicoes.values()].sort(
      (a, b) => a.sku.localeCompare(b.sku) || a.centro.localeCompare(b.centro),
    );
  }
}
