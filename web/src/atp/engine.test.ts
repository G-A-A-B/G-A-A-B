import { describe, it, expect } from "vitest";
import { MotorATP, canal, ConfiguracaoInvalida, ErroDeReserva } from "./engine";

function base() {
  return new MotorATP(100, [
    canal("Loja", 30),
    canal("Site"),
    canal("Marketplace", 0, 20),
  ]);
}

describe("MotorATP — paridade com o simulador Python", () => {
  it("ATP inicial reflete proteção e restrição", () => {
    const m = base();
    expect(m.snapshot()).toEqual({ Loja: 100, Site: 70, Marketplace: 20 });
  });

  it("cenário base T0→T4 bate com o Python", () => {
    const m = base();
    m.reservar("Marketplace", 15);
    expect(m.snapshot()).toEqual({ Loja: 85, Site: 55, Marketplace: 5 });
    m.reservar("Site", 40);
    expect(m.snapshot()).toEqual({ Loja: 45, Site: 15, Marketplace: 5 });
    m.efetivar("Marketplace", 15);
    expect(m.fisico).toBe(85);
    expect(m.snapshot()).toEqual({ Loja: 45, Site: 15, Marketplace: 15 });
    m.reservar("Loja", 30);
    expect(m.reservaDe("Loja")).toBe(30);
  });

  it("proteção residual não bloqueia estoque em dobro", () => {
    const m = new MotorATP(100, [canal("Loja", 30), canal("Site")]);
    m.reservar("Loja", 25);
    expect(m.atp("Site")).toBe(70);
  });

  it("restrição recusa reserva acima do teto", () => {
    const m = base();
    expect(() => m.reservar("Marketplace", 21)).toThrow(ErroDeReserva);
  });

  it("não-oversell na disputa pela última unidade", () => {
    const m = new MotorATP(1, [canal("A"), canal("B")]);
    m.reservar("A", 1);
    expect(() => m.reservar("B", 1)).toThrow(ErroDeReserva);
  });

  it("proteção sobre-comprometida é recusada sem fair-share", () => {
    expect(() => new MotorATP(100, [canal("A", 60), canal("B", 60)])).toThrow(
      ConfiguracaoInvalida,
    );
  });

  it("fair-share rateia proporcionalmente (60+60 → 50/50)", () => {
    const m = new MotorATP(100, [canal("A", 60), canal("B", 60)], true);
    expect(m.protecoesEfetivas()).toEqual({ A: 50, B: 50 });
    expect(m.atp("A")).toBe(50);
    expect(m.atp("B")).toBe(50);
  });

  it("fair-share com resto soma exatamente o físico", () => {
    const m = new MotorATP(75, [canal("A", 50), canal("B", 50)], true);
    const ef = m.protecoesEfetivas();
    expect(ef.A + ef.B).toBe(75);
  });

  it("restrição acumulada NÃO reabre ao efetivar, só no reinício", () => {
    const m = new MotorATP(100, [canal("Mkt", 0, null, 20)]);
    expect(m.atp("Mkt")).toBe(20);
    m.reservar("Mkt", 20);
    m.efetivar("Mkt", 20);
    expect(m.atp("Mkt")).toBe(0); // instantânea reabriria; acumulada não
    m.reiniciarPeriodo();
    expect(m.vendasDe("Mkt")).toBe(0);
    expect(m.atp("Mkt")).toBe(20);
    expect(m.historico[m.historico.length - 1].evento).toBe("REINICIO_PERIODO");
  });

  it("instantânea e acumulada combinadas: vale o menor teto", () => {
    const m = new MotorATP(100, [canal("Mkt", 0, 8, 20)]);
    expect(m.atp("Mkt")).toBe(8);
    m.reservar("Mkt", 8);
    m.efetivar("Mkt", 8);
    expect(m.atp("Mkt")).toBe(8); // min(instantânea 8, acumulada 20−8=12)
  });

  it("restrição menor que a proteção do mesmo canal é recusada", () => {
    expect(() => new MotorATP(100, [canal("A", 30, 20)])).toThrow(
      ConfiguracaoInvalida,
    );
  });

  it("proteção com teto maior (piso 20 / teto 50) é válida", () => {
    const m = new MotorATP(100, [canal("A", 20, 50), canal("B")]);
    expect(m.atp("A")).toBe(50); // limitado pelo teto
    expect(m.atp("B")).toBe(80); // 100 − 20 (piso da A)
  });
});
