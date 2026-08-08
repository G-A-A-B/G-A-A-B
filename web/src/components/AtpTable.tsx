import {
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
import type { MotorATP } from "../atp/engine";

export default function AtpTable({ motor }: { motor: MotorATP }) {
  const canais = [...motor.canais.values()];
  const efetivas = motor.protecoesEfetivas();
  const sobrecomprometido = canais.some((c) => efetivas[c.nome] !== c.protecao);
  const temCota = canais.some((c) => c.restricaoAcumulada !== null);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Disponibilidade (ATP)
          </Typography>
          <Chip color="primary" variant="outlined" label={`Físico ${motor.fisico}`} />
          <Chip color="secondary" variant="outlined" label={`Disponível ${motor.disponivel}`} />
          {motor.fairShare && sobrecomprometido && (
            <Chip color="warning" label="fair-share ativo" />
          )}
        </Stack>

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Canal</TableCell>
                <TableCell align="right">Proteção</TableCell>
                {sobrecomprometido && <TableCell align="right">Efetiva</TableCell>}
                <TableCell align="right">Restrição</TableCell>
                {temCota && <TableCell align="right">Cota período</TableCell>}
                <TableCell align="right">Reserva</TableCell>
                <TableCell align="right">ATP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {canais.map((c) => {
                const atp = motor.atp(c.nome);
                return (
                  <TableRow key={c.nome} hover>
                    <TableCell>{c.nome}</TableCell>
                    <TableCell align="right">{c.protecao || "—"}</TableCell>
                    {sobrecomprometido && (
                      <TableCell align="right">{efetivas[c.nome] || "—"}</TableCell>
                    )}
                    <TableCell align="right">{c.restricao ?? "sem teto"}</TableCell>
                    {temCota && (
                      <TableCell align="right">
                        {c.restricaoAcumulada === null
                          ? "—"
                          : `${motor.vendasDe(c.nome)} / ${c.restricaoAcumulada}`}
                      </TableCell>
                    )}
                    <TableCell align="right">{motor.reservaDe(c.nome)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={atp > 0 ? "success" : "default"}
                        variant={atp > 0 ? "filled" : "outlined"}
                        label={atp}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
