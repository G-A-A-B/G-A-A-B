import type { CanalCfg } from "./components/ConfigPanel";

export interface Preset {
  rotulo: string;
  fisico: number;
  fairShare: boolean;
  canais: CanalCfg[];
}

const c = (
  nome: string,
  protecao = 0,
  restricao: number | null = null,
  restricaoAcumulada: number | null = null,
): CanalCfg => ({ nome, protecao, restricao, restricaoAcumulada });

/** Configurações prontas, espelhando os cenários do simulador Python. */
export const PRESETS: Preset[] = [
  {
    rotulo: "Base (Loja 30 / Mkt teto 20)",
    fisico: 100,
    fairShare: false,
    canais: [c("Loja", 30), c("Site"), c("Marketplace", 0, 20)],
  },
  {
    rotulo: "Por que proteger (VIP 20)",
    fisico: 50,
    fairShare: false,
    canais: [c("VIP", 20), c("Massa")],
  },
  {
    rotulo: "Saturação no limite (60 + 40)",
    fisico: 100,
    fairShare: false,
    canais: [c("A", 60), c("B", 40)],
  },
  {
    rotulo: "Fair-share (60 + 60 > 100)",
    fisico: 100,
    fairShare: true,
    canais: [c("A", 60), c("B", 60)],
  },
  {
    rotulo: "Restrição acumulada (cota 20/período)",
    fisico: 100,
    fairShare: false,
    canais: [c("Marketplace", 0, null, 20), c("Outro")],
  },
];
