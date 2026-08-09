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
import RestartAltIcon from "@mui/icons-material/RestartAlt";

interface Props {
  canais: string[];
  onReservar: (canal: string, qtd: number) => void;
  onReiniciarPeriodo: () => void;
}

export default function OperationsPanel({
  canais,
  onReservar,
  onReiniciarPeriodo,
}: Props) {
  const [canal, setCanal] = useState(canais[0] ?? "");
  const [qtd, setQtd] = useState(10);

  const alvo = canais.includes(canal) ? canal : canais[0] ?? "";

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Nova reserva
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
          <Button
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            onClick={() => onReservar(alvo, qtd)}
          >
            Reservar
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          A reserva entra como <strong>RESERVED</strong> e debita o disponível.
          Efetive ou cancele cada reserva na tabela ao lado.
        </Typography>
        <Button
          variant="text"
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={onReiniciarPeriodo}
          sx={{ mt: 1 }}
        >
          Reiniciar período (reabre cotas acumuladas)
        </Button>
      </CardContent>
    </Card>
  );
}
