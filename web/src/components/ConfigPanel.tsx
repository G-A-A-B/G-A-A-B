import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

export interface CanalCfg {
  nome: string;
  protecao: number;
  restricao: number | null;
  restricaoAcumulada: number | null;
}

interface Props {
  sku: string;
  centro: string;
  fisico: number;
  fairShare: boolean;
  canais: CanalCfg[];
  podeRemover: boolean;
  onSku: (v: string) => void;
  onCentro: (v: string) => void;
  onFisico: (v: number) => void;
  onFairShare: (v: boolean) => void;
  onCanais: (c: CanalCfg[]) => void;
  onAplicar: () => void;
  onRemover: () => void;
}

export default function ConfigPanel({
  sku,
  centro,
  fisico,
  fairShare,
  canais,
  podeRemover,
  onSku,
  onCentro,
  onFisico,
  onFairShare,
  onCanais,
  onAplicar,
  onRemover,
}: Props) {
  const setCanal = (i: number, patch: Partial<CanalCfg>) => {
    const novo = canais.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onCanais(novo);
  };
  const remover = (i: number) => onCanais(canais.filter((_, idx) => idx !== i));
  const adicionar = () =>
    onCanais([
      ...canais,
      { nome: `Canal ${canais.length + 1}`, protecao: 0, restricao: null, restricaoAcumulada: null },
    ]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Posição de estoque
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <TextField
            label="SKU"
            size="small"
            value={sku}
            onChange={(e) => onSku(e.target.value)}
            sx={{ width: 150 }}
          />
          <TextField
            label="Centro de Distribuição"
            size="small"
            value={centro}
            onChange={(e) => onCentro(e.target.value)}
            sx={{ width: 200 }}
          />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            label="Estoque físico"
            type="number"
            size="small"
            value={fisico}
            onChange={(e) => onFisico(Math.max(0, Number(e.target.value)))}
            sx={{ width: 140 }}
          />
          <FormControlLabel
            control={
              <Switch checked={fairShare} onChange={(e) => onFairShare(e.target.checked)} />
            }
            label="Fair-share"
          />
        </Stack>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }} color="text.secondary">
          Canais
        </Typography>
        <Stack spacing={1.5}>
          {canais.map((c, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                label="Nome"
                size="small"
                value={c.nome}
                onChange={(e) => setCanal(i, { nome: e.target.value })}
                sx={{ width: 150 }}
              />
              <TextField
                label="Proteção"
                type="number"
                size="small"
                value={c.protecao}
                onChange={(e) => setCanal(i, { protecao: Math.max(0, Number(e.target.value)) })}
                sx={{ width: 110 }}
              />
              <TextField
                label="Restr. inst."
                type="number"
                size="small"
                placeholder="sem teto"
                value={c.restricao ?? ""}
                onChange={(e) =>
                  setCanal(i, {
                    restricao: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  })
                }
                sx={{ width: 110 }}
              />
              <TextField
                label="Cota/período"
                type="number"
                size="small"
                placeholder="sem cota"
                value={c.restricaoAcumulada ?? ""}
                onChange={(e) =>
                  setCanal(i, {
                    restricaoAcumulada:
                      e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  })
                }
                sx={{ width: 120 }}
              />
              <Tooltip title="Remover canal">
                <span>
                  <IconButton
                    aria-label="remover"
                    onClick={() => remover(i)}
                    disabled={canais.length <= 1}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={adicionar}>
            Adicionar canal
          </Button>
          <Button startIcon={<RestartAltIcon />} variant="contained" onClick={onAplicar}>
            Aplicar posição
          </Button>
          {podeRemover && (
            <Button color="error" variant="text" onClick={onRemover}>
              Remover posição
            </Button>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          "Aplicar" cria ou substitui a posição (SKU × CD) — reinicia suas reservas.
        </Typography>
      </CardContent>
    </Card>
  );
}
