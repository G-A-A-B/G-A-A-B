import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

interface Props {
  canais: string[];
  onReservar: (canal: string, qtd: number) => void;
  onEfetivar: (canal: string, qtd: number) => void;
  onCancelar: (canal: string, qtd: number) => void;
  onReiniciarPeriodo: () => void;
}

export default function OperationsPanel({
  canais,
  onReservar,
  onEfetivar,
  onCancelar,
  onReiniciarPeriodo,
}: Props) {
  const [canal, setCanal] = useState(canais[0] ?? "");
  const [qtd, setQtd] = useState(10);

  const alvo = canais.includes(canal) ? canal : canais[0] ?? "";

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Operações
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="Canal"
            size="small"
            value={alvo}
            onChange={(e) => setCanal(e.target.value)}
            sx={{ width: 170 }}
          >
            {canais.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Quantidade"
            type="number"
            size="small"
            value={qtd}
            onChange={(e) => setQtd(Math.max(1, Number(e.target.value)))}
            sx={{ width: 130 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            onClick={() => onReservar(alvo, qtd)}
          >
            Reservar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => onEfetivar(alvo, qtd)}
          >
            Efetivar
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => onCancelar(alvo, qtd)}
          >
            Cancelar
          </Button>
        </Stack>
        <Button
          variant="text"
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={onReiniciarPeriodo}
          sx={{ mt: 1.5 }}
        >
          Reiniciar período (reabre cotas acumuladas)
        </Button>
      </CardContent>
    </Card>
  );
}
