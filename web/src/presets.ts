import type { CanalCfg } from "./components/ConfigPanel";

export interface Preset {
  rotulo: string;
  fisico: number;
  fairShare: boolean;
  canais: CanalCfg[];
}

/** Configurações prontas, espelhando os cenários do simulador Python. */
export const PRESETS: Preset[] = [
  {
    rotulo: "Base (Loja 30 / Mkt teto 20)",
    fisico: 100,
    fairShare: false,
    canais: [
      { nome: "Loja", protecao: 30, restricao: null },
      { nome: "Site", protecao: 0, restricao: null },
      { nome: "Marketplace", protecao: 0, restricao: 20 },
    ],
  },
  {
    rotulo: "Por que proteger (VIP 20)",
    fisico: 50,
    fairShare: false,
    canais: [
      { nome: "VIP", protecao: 20, restricao: null },
      { nome: "Massa", protecao: 0, restricao: null },
    ],
  },
  {
    rotulo: "Saturação no limite (60 + 40)",
    fisico: 100,
    fairShare: false,
    canais: [
      { nome: "A", protecao: 60, restricao: null },
      { nome: "B", protecao: 40, restricao: null },
    ],
  },
  {
    rotulo: "Fair-share (60 + 60 > 100)",
    fisico: 100,
    fairShare: true,
    canais: [
      { nome: "A", protecao: 60, restricao: null },
      { nome: "B", protecao: 60, restricao: null },
    ],
  },
];
