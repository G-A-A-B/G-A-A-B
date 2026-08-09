import type { CanalCfg } from "./components/ConfigPanel";

export interface Preset {
  rotulo: string;
  sku: string;
  centro: string;
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

/**
 * Posições de exemplo (SKU × CD) que semeiam a carteira. Cada uma isola um
 * comportamento do modelo e demonstra a chave (SKU, CD, canal).
 */
export const PRESETS: Preset[] = [
  {
    rotulo: "Base (Loja 30 / Mkt teto 20)",
    sku: "SKU-1001",
    centro: "CD-SP",
    fisico: 100,
    fairShare: false,
    canais: [c("Loja", 30), c("Site"), c("Marketplace", 0, 20)],
  },
  {
    rotulo: "Restrição acumulada (cota 20/período)",
    sku: "SKU-1001",
    centro: "CD-RJ",
    fisico: 100,
    fairShare: false,
    canais: [c("Marketplace", 0, null, 20), c("Outro")],
  },
  {
    rotulo: "Por que proteger (VIP 20)",
    sku: "SKU-1002",
    centro: "CD-SP",
    fisico: 50,
    fairShare: false,
    canais: [c("VIP", 20), c("Massa")],
  },
  {
    rotulo: "Fair-share (60 + 60 > 100)",
    sku: "SKU-1003",
    centro: "CD-SP",
    fisico: 100,
    fairShare: true,
    canais: [c("A", 60), c("B", 60)],
  },
  {
    rotulo: "Piso + teto (prot 20 / teto 50)",
    sku: "SKU-1004",
    centro: "CD-SP",
    fisico: 100,
    fairShare: false,
    canais: [c("Loja", 20, 50), c("Site")],
  },
];
