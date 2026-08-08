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
}

interface Props {
  fisico: number;
  fairShare: boolean;
  canais: CanalCfg[];
  onFisico: (v: number) => void;
  onFairShare: (v: boolean) => void;
  onCanais: (c: CanalCfg[]) => void;
  onAplicar: () => void;
}

export default function ConfigPanel({
  fisico,
  fairShare,
  canais,
  onFisico,
  onFairShare,
  onCanais,
  onAplicar,
}: Props) {
  const setCanal = (i: number, patch: Partial<CanalCfg>) => {
    const novo = canais.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onCanais(novo);
  };
  const remover = (i: number) => onCanais(canais.filter((_, idx) => idx !== i));
  const adicionar = () =>
    onCanais([...canais, { nome: `Canal ${canais.length + 1}`, protecao: 0, restricao: null }]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Configuração
        </Typography>
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
                label="Restrição"
                type="number"
                size="small"
                placeholder="sem teto"
                value={c.restricao ?? ""}
                onChange={(e) =>
                  setCanal(i, {
                    restricao: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
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
            Aplicar / Reiniciar
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
