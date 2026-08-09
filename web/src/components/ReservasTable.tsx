import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import type { MotorATP, Reserva, StatusReserva } from "../atp/engine";

const COR_STATUS: Record<StatusReserva, "warning" | "success" | "default"> = {
  RESERVED: "warning",
  EFFECTIVE: "success",
  CANCELLED: "default",
};

function LinhaReservada({
  r,
  fisicoAtual,
  onEfetivar,
  onCancelar,
}: {
  r: Reserva;
  fisicoAtual: number;
  onEfetivar: (id: number, novoFisico: number) => void;
  onCancelar: (id: number) => void;
}) {
  // Feed externo: default = físico − quantidade (só a venda saiu, sem reposição).
  const [novoFisico, setNovoFisico] = useState(fisicoAtual - r.quantidade);

  return (
    <TableRow hover>
      <TableCell>#{r.id}</TableCell>
      <TableCell>{r.canal}</TableCell>
      <TableCell align="right">{r.quantidade}</TableCell>
      <TableCell>
        <Chip size="small" color="warning" label="RESERVED" />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
          <Tooltip title="Físico autoritativo vindo do sistema externo (vendas + reposição)">
            <TextField
              label="Novo físico"
              type="number"
              size="small"
              value={novoFisico}
              onChange={(e) => setNovoFisico(Math.max(0, Number(e.target.value)))}
              sx={{ width: 110 }}
            />
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => onEfetivar(r.id, novoFisico)}
          >
            Efetivar
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => onCancelar(r.id)}
          >
            Cancelar
          </Button>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

export default function ReservasTable({
  motor,
  onEfetivar,
  onCancelar,
}: {
  motor: MotorATP;
  onEfetivar: (id: number, novoFisico: number) => void;
  onCancelar: (id: number) => void;
}) {
  const reservas = [...motor.reservas].reverse();

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Reservas
        </Typography>
        <TableContainer sx={{ overflowX: "auto", maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Canal</TableCell>
                <TableCell align="right">Qtde</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma reserva ainda. Crie uma no painel "Nova reserva".
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {reservas.map((r) =>
                r.status === "RESERVED" ? (
                  <LinhaReservada
                    key={r.id}
                    r={r}
                    fisicoAtual={motor.fisico}
                    onEfetivar={onEfetivar}
                    onCancelar={onCancelar}
                  />
                ) : (
                  <TableRow key={r.id} hover>
                    <TableCell>#{r.id}</TableCell>
                    <TableCell>{r.canal}</TableCell>
                    <TableCell align="right">{r.quantidade}</TableCell>
                    <TableCell>
                      <Chip size="small" color={COR_STATUS[r.status]} label={r.status} />
                    </TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
