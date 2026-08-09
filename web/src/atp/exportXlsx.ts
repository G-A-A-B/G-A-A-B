/**
 * Exportação do histórico do MotorATP para .xlsx no browser.
 *
 * Usa `write-excel-file` (write-only, mantida e sem advisories conhecidos) em
 * vez do SheetJS. Mantém as duas abas (Movimentos + Configuração) e colore a
 * célula de evento por tipo, como no exportador Python.
 */
import writeXlsxFile, {
  type CellObject,
  type SheetData,
} from "write-excel-file/browser";
import type { MotorATP, TipoEvento } from "./engine";

const COR_EVENTO: Record<TipoEvento, `#${string}`> = {
  INICIAL: "#D9D9D9",
  RESERVA: "#FFE699",
  AJUSTE: "#DDEBF7",
  EFETIVACAO: "#C6EFCE",
  CANCELAMENTO: "#FFC7CE",
  REINICIO_PERIODO: "#BDD7EE",
};

const cab = (value: string): CellObject => ({
  value,
  fontWeight: "bold",
  backgroundColor: "#1F4E78",
  textColor: "#FFFFFF",
  align: "center",
});
const txt = (value: string): CellObject => ({ value, type: String });
const num = (value: number): CellObject => ({ value, type: Number });

export async function exportarXlsx(
  motor: MotorATP,
  nomeArquivo = "historico_movimentos.xlsx",
): Promise<void> {
  const canais = [...motor.canais.keys()];

  // --- Aba Movimentos ---
  const cabMov: SheetData[number] = [
    "Seq",
    "Momento",
    "Evento",
    "Canal",
    "Qtde",
    "Rótulo",
    "Físico",
    "Disponível",
    ...canais.map((c) => `Reserva ${c}`),
    ...canais.map((c) => `ATP ${c}`),
  ].map(cab);

  const linhasMov: SheetData = motor.historico.map((m) => [
    num(m.seq),
    txt(m.momento),
    { ...txt(m.evento), backgroundColor: COR_EVENTO[m.evento] },
    txt(m.canal),
    num(m.quantidade),
    txt(m.rotulo),
    num(m.fisico),
    num(m.disponivel),
    ...canais.map((c) => num(m.reservas[c])),
    ...canais.map((c) => num(m.atp[c])),
  ]);

  const dadosMov: SheetData = [cabMov, ...linhasMov];
  const colunasMov = [
    { width: 6 },
    { width: 20 },
    { width: 14 },
    { width: 14 },
    { width: 8 },
    { width: 26 },
    { width: 9 },
    { width: 11 },
    ...canais.map(() => ({ width: 13 })),
    ...canais.map(() => ({ width: 11 })),
  ];

  // --- Aba Configuração ---
  const dadosCfg: SheetData = [
    [cab("Parâmetro"), cab("Valor"), txt("")],
    [txt("SKU"), txt(motor.sku), txt("")],
    [txt("Centro de Distribuição"), txt(motor.centro), txt("")],
    [txt("Estoque físico inicial"), num(motor.historico[0]?.fisico ?? motor.fisico), txt("")],
    [txt("Fair-share"), txt(motor.fairShare ? "sim" : "não"), txt("")],
    [txt(""), txt(""), txt("")],
    [cab("Canal"), cab("Proteção"), cab("Restrição")],
    ...[...motor.canais.values()].map((c): SheetData[number] => [
      txt(c.nome),
      num(c.protecao),
      c.restricao === null ? txt("sem teto") : num(c.restricao),
    ]),
  ];
  const colunasCfg = [{ width: 24 }, { width: 12 }, { width: 12 }];

  const saida = await writeXlsxFile([
    { data: dadosMov, sheet: "Movimentos", columns: colunasMov },
    { data: dadosCfg, sheet: "Configuração", columns: colunasCfg },
  ]);
  await saida.toFile(nomeArquivo);
}
