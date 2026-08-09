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
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import type { MotorATP, TipoEvento } from "../atp/engine";

const COR_EVENTO: Record<
  TipoEvento,
  "default" | "warning" | "success" | "error" | "primary" | "info"
> = {
  INICIAL: "default",
  RESERVA: "warning",
  AJUSTE: "info",
  EFETIVACAO: "success",
  CANCELAMENTO: "error",
  REINICIO_PERIODO: "primary",
};

export default function HistoryTable({
  motor,
  onExport,
}: {
  motor: MotorATP;
  onExport: () => void;
}) {
  const canais = [...motor.canais.keys()];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Histórico de movimentos
          </Typography>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={onExport}
            disabled={motor.historico.length <= 1}
          >
            Exportar .xlsx
          </Button>
        </Stack>

        <TableContainer sx={{ overflowX: "auto", maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Evento</TableCell>
                <TableCell>Canal</TableCell>
                <TableCell align="right">Qtde</TableCell>
                <TableCell align="right">Físico</TableCell>
                <TableCell align="right">Disp.</TableCell>
                {canais.map((c) => (
                  <TableCell key={`atp-${c}`} align="right">
                    ATP {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...motor.historico].reverse().map((m) => (
                <TableRow key={m.seq} hover>
                  <TableCell>{m.seq}</TableCell>
                  <TableCell>
                    <Chip size="small" color={COR_EVENTO[m.evento]} label={m.evento} />
                  </TableCell>
                  <TableCell>{m.canal}</TableCell>
                  <TableCell align="right">{m.quantidade || "—"}</TableCell>
                  <TableCell align="right">{m.fisico}</TableCell>
                  <TableCell align="right">{m.disponivel}</TableCell>
                  {canais.map((c) => (
                    <TableCell key={`${m.seq}-${c}`} align="right">
                      {m.atp[c]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
