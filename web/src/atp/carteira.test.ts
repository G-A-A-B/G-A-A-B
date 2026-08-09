import { describe, it, expect } from "vitest";
import { Carteira, chavePosicao } from "./carteira";
import { canal } from "./engine";

describe("Carteira — posições SKU × CD", () => {
  it("cria e recupera posições distintas por (SKU, CD)", () => {
    const c = new Carteira();
    c.definir("SKU-1", "CD-1", 100, [canal("Loja", 30)]);
    c.definir("SKU-1", "CD-2", 50, [canal("Loja")]);
    c.definir("SKU-2", "CD-1", 200, [canal("Site")]);
    expect(c.tamanho).toBe(3);
    expect(c.obter("SKU-1", "CD-1")?.fisico).toBe(100);
    expect(c.obter("SKU-1", "CD-2")?.fisico).toBe(50);
    expect(c.obter("SKU-2", "CD-1")?.fisico).toBe(200);
  });

  it("posições são independentes: reservar numa não afeta a outra", () => {
    const c = new Carteira();
    const a = c.definir("SKU-1", "CD-1", 100, [canal("Loja")]);
    const b = c.definir("SKU-1", "CD-2", 100, [canal("Loja")]);
    a.reservar("Loja", 40);
    expect(a.disponivel).toBe(60);
    expect(b.disponivel).toBe(100); // outra posição intacta
  });

  it("a reserva herda a chave da sua posição", () => {
    const c = new Carteira();
    const m = c.definir("SKU-9", "CD-7", 100, [canal("Site")]);
    const id = m.reservar("Site", 10);
    const r = m.reservaPorId(id)!;
    expect(r.sku).toBe("SKU-9");
    expect(r.centro).toBe("CD-7");
  });

  it("definir com a mesma chave substitui a posição", () => {
    const c = new Carteira();
    c.definir("SKU-1", "CD-1", 100, [canal("Loja")]);
    c.definir("SKU-1", "CD-1", 80, [canal("Loja")]);
    expect(c.tamanho).toBe(1);
    expect(c.obter("SKU-1", "CD-1")?.fisico).toBe(80);
  });

  it("chavePosicao distingue combinações", () => {
    expect(chavePosicao("A", "B")).not.toBe(chavePosicao("B", "A"));
  });

  it("lista ordena por SKU e depois por Centro", () => {
    const c = new Carteira();
    c.definir("SKU-2", "CD-1", 10, [canal("X")]);
    c.definir("SKU-1", "CD-2", 10, [canal("X")]);
    c.definir("SKU-1", "CD-1", 10, [canal("X")]);
    const chaves = c.lista().map((m) => `${m.sku}@${m.centro}`);
    expect(chaves).toEqual(["SKU-1@CD-1", "SKU-1@CD-2", "SKU-2@CD-1"]);
  });
});
