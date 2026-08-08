import { useMemo, useReducer, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  IconButton,
  MenuItem,
  Snackbar,
  Alert,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { criarTema } from "./theme";
import { MotorATP, canal as criarCanal } from "./atp/engine";
import { exportarXlsx } from "./atp/exportXlsx";
import ConfigPanel, { type CanalCfg } from "./components/ConfigPanel";
import AtpTable from "./components/AtpTable";
import OperationsPanel from "./components/OperationsPanel";
import HistoryTable from "./components/HistoryTable";
import { PRESETS } from "./presets";

function construir(fisico: number, canais: CanalCfg[], fairShare: boolean): MotorATP {
  return new MotorATP(
    fisico,
    canais.map((c) => criarCanal(c.nome, c.protecao, c.restricao, c.restricaoAcumulada)),
    fairShare,
  );
}

export default function App() {
  const [modo, setModo] = useState<"light" | "dark">("light");
  const tema = useMemo(() => criarTema(modo), [modo]);

  const [presetIdx, setPresetIdx] = useState(0);
  const [fisico, setFisico] = useState(PRESETS[0].fisico);
  const [fairShare, setFairShare] = useState(PRESETS[0].fairShare);
  const [canais, setCanais] = useState<CanalCfg[]>(PRESETS[0].canais);
  const [erro, setErro] = useState<string | null>(null);

  const motorRef = useRef<MotorATP>(construir(PRESETS[0].fisico, PRESETS[0].canais, PRESETS[0].fairShare));
  const [, forcar] = useReducer((x: number) => x + 1, 0);

  const aplicar = (
    f = fisico,
    c = canais,
    fs = fairShare,
  ) => {
    try {
      motorRef.current = construir(f, c, fs);
      forcar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const carregarPreset = (idx: number) => {
    const p = PRESETS[idx];
    setPresetIdx(idx);
    setFisico(p.fisico);
    setFairShare(p.fairShare);
    setCanais(p.canais);
    aplicar(p.fisico, p.canais, p.fairShare);
  };

  const operar = (fn: (m: MotorATP) => void) => {
    try {
      fn(motorRef.current);
      forcar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const motor = motorRef.current;
  const nomesCanais = [...motor.canais.keys()];

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            ATP Multicanal · Proteção & Restrição
          </Typography>
          <TextField
            select
            size="small"
            label="Cenário"
            value={presetIdx}
            onChange={(e) => carregarPreset(Number(e.target.value))}
            sx={{ width: 260, mr: 1 }}
          >
            {PRESETS.map((p, i) => (
              <MenuItem key={i} value={i}>
                {p.rotulo}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title={modo === "light" ? "Modo escuro" : "Modo claro"}>
            <IconButton onClick={() => setModo(modo === "light" ? "dark" : "light")}>
              {modo === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            alignItems: "flex-start",
          }}
        >
          <Box
            sx={{
              flex: { md: "0 0 42%" },
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <ConfigPanel
              fisico={fisico}
              fairShare={fairShare}
              canais={canais}
              onFisico={setFisico}
              onFairShare={setFairShare}
              onCanais={setCanais}
              onAplicar={() => aplicar()}
            />
            <OperationsPanel
              canais={nomesCanais}
              onReservar={(c, q) => operar((m) => m.reservar(c, q))}
              onEfetivar={(c, q) => operar((m) => m.efetivar(c, q))}
              onCancelar={(c, q) => operar((m) => m.cancelar(c, q))}
              onReiniciarPeriodo={() => operar((m) => m.reiniciarPeriodo())}
            />
          </Box>
          <Box
            sx={{
              flex: { md: "1 1 58%" },
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <AtpTable motor={motor} />
            <HistoryTable
              motor={motor}
              onExport={() =>
                exportarXlsx(motor, "historico_movimentos.xlsx").catch((e) =>
                  setErro((e as Error).message),
                )
              }
            />
          </Box>
        </Box>
      </Container>

      <Snackbar
        open={erro !== null}
        autoHideDuration={4000}
        onClose={() => setErro(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setErro(null)}>
          {erro}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
