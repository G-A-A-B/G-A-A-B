/** Exportação do histórico do MotorATP para .xlsx no browser (SheetJS). */
import * as XLSX from "xlsx";
import type { MotorATP } from "./engine";

export function exportarXlsx(motor: MotorATP, nomeArquivo = "historico.xlsx"): void {
  const canais = [...motor.canais.keys()];

  const cabecalho = [
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
  ];

  const linhas = motor.historico.map((m) => [
    m.seq,
    m.momento,
    m.evento,
    m.canal,
    m.quantidade,
    m.rotulo,
    m.fisico,
    m.disponivel,
    ...canais.map((c) => m.reservas[c]),
    ...canais.map((c) => m.atp[c]),
  ]);

  const wsMov = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);

  const config: (string | number)[][] = [
    ["Parâmetro", "Valor"],
    ["Estoque físico inicial", motor.historico[0]?.fisico ?? motor.fisico],
    ["Fair-share", motor.fairShare ? "sim" : "não"],
    [],
    ["Canal", "Proteção", "Restrição"],
    ...[...motor.canais.values()].map((c) => [
      c.nome,
      c.protecao,
      c.restricao === null ? "sem teto" : c.restricao,
    ]),
  ];
  const wsCfg = XLSX.utils.aoa_to_sheet(config);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMov, "Movimentos");
  XLSX.utils.book_append_sheet(wb, wsCfg, "Configuração");
  XLSX.writeFile(wb, nomeArquivo);
}
