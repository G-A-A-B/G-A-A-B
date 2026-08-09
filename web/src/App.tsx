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
import AddBusinessIcon from "@mui/icons-material/AddBusiness";

import { criarTema } from "./theme";
import { MotorATP, canal as criarCanal } from "./atp/engine";
import { Carteira, chavePosicao } from "./atp/carteira";
import { exportarXlsx } from "./atp/exportXlsx";
import ConfigPanel, { type CanalCfg } from "./components/ConfigPanel";
import AtpTable from "./components/AtpTable";
import OperationsPanel from "./components/OperationsPanel";
import ReservasTable from "./components/ReservasTable";
import HistoryTable from "./components/HistoryTable";
import { PRESETS } from "./presets";

function paraCanais(cfgs: CanalCfg[]) {
  return cfgs.map((c) => criarCanal(c.nome, c.protecao, c.restricao, c.restricaoAcumulada));
}

function cfgDoMotor(m: MotorATP): CanalCfg[] {
  return [...m.canais.values()].map((c) => ({
    nome: c.nome,
    protecao: c.protecao,
    restricao: c.restricao,
    restricaoAcumulada: c.restricaoAcumulada,
  }));
}

// Semeia a carteira com as posições de exemplo (SKU × CD).
function semear(): Carteira {
  const cart = new Carteira();
  for (const p of PRESETS) {
    cart.definir(p.sku, p.centro, p.fisico, paraCanais(p.canais), p.fairShare);
  }
  return cart;
}

export default function App() {
  const [modo, setModo] = useState<"light" | "dark">("light");
  const tema = useMemo(() => criarTema(modo), [modo]);

  const carteiraRef = useRef<Carteira>(semear());
  const [chaveAtual, setChaveAtual] = useState(
    chavePosicao(PRESETS[0].sku, PRESETS[0].centro),
  );
  const [, forcar] = useReducer((x: number) => x + 1, 0);

  // Formulário da posição (espelha a posição selecionada; "Aplicar" grava).
  const [sku, setSku] = useState(PRESETS[0].sku);
  const [centro, setCentro] = useState(PRESETS[0].centro);
  const [fisico, setFisico] = useState(PRESETS[0].fisico);
  const [fairShare, setFairShare] = useState(PRESETS[0].fairShare);
  const [canais, setCanais] = useState<CanalCfg[]>(PRESETS[0].canais);
  const [erro, setErro] = useState<string | null>(null);

  const carteira = carteiraRef.current;
  const motor = carteira.obterPorChave(chaveAtual) ?? carteira.lista()[0];

  const carregarNoForm = (m: MotorATP) => {
    setSku(m.sku);
    setCentro(m.centro);
    setFisico(m.fisico);
    setFairShare(m.fairShare);
    setCanais(cfgDoMotor(m));
  };

  const selecionar = (chave: string) => {
    const m = carteira.obterPorChave(chave);
    if (!m) return;
    carregarNoForm(m);
    setChaveAtual(chave);
    forcar();
  };

  const aplicar = () => {
    try {
      carteira.definir(sku, centro, fisico, paraCanais(canais), fairShare);
      setChaveAtual(chavePosicao(sku, centro));
      forcar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const novaPosicao = () => {
    let n = carteira.tamanho + 1;
    let novoSku = `SKU-NOVO-${n}`;
    while (carteira.tem(novoSku, "CD-SP")) novoSku = `SKU-NOVO-${++n}`;
    const canaisNovo: CanalCfg[] = [
      { nome: "Loja", protecao: 30, restricao: null, restricaoAcumulada: null },
      { nome: "Site", protecao: 0, restricao: null, restricaoAcumulada: null },
    ];
    carteira.definir(novoSku, "CD-SP", 100, paraCanais(canaisNovo), false);
    setSku(novoSku);
    setCentro("CD-SP");
    setFisico(100);
    setFairShare(false);
    setCanais(canaisNovo);
    setChaveAtual(chavePosicao(novoSku, "CD-SP"));
    forcar();
  };

  const remover = () => {
    if (carteira.tamanho <= 1) return;
    carteira.remover(motor.sku, motor.centro);
    const prox = carteira.lista()[0];
    carregarNoForm(prox);
    setChaveAtual(chavePosicao(prox.sku, prox.centro));
    forcar();
  };

  const operar = (fn: (m: MotorATP) => void) => {
    try {
      fn(motor);
      forcar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomesCanais = [...motor.canais.keys()];
  const posicoes = carteira.lista();

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
            ATP Multicanal
          </Typography>
          <TextField
            select
            size="small"
            label="Posição (SKU × CD)"
            value={chavePosicao(motor.sku, motor.centro)}
            onChange={(e) => selecionar(e.target.value)}
            sx={{ minWidth: 240 }}
          >
            {posicoes.map((m) => {
              const k = chavePosicao(m.sku, m.centro);
              return (
                <MenuItem key={k} value={k}>
                  {m.sku} @ {m.centro}
                </MenuItem>
              );
            })}
          </TextField>
          <Tooltip title="Nova posição de estoque">
            <IconButton onClick={novaPosicao} color="primary">
              <AddBusinessIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
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
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <ConfigPanel
              sku={sku}
              centro={centro}
              fisico={fisico}
              fairShare={fairShare}
              canais={canais}
              podeRemover={carteira.tamanho > 1}
              onSku={setSku}
              onCentro={setCentro}
              onFisico={setFisico}
              onFairShare={setFairShare}
              onCanais={setCanais}
              onAplicar={aplicar}
              onRemover={remover}
            />
            <OperationsPanel
              canais={nomesCanais}
              onReservar={(c, q) => operar((m) => m.reservar(c, q))}
              onReiniciarPeriodo={() => operar((m) => m.reiniciarPeriodo())}
            />
          </Box>
          <Box
            sx={{
              flex: { md: "1 1 58%" },
              width: "100%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <AtpTable motor={motor} />
            <HistoryTable
              motor={motor}
              onExport={() =>
                exportarXlsx(motor, `historico_${motor.sku}_${motor.centro}.xlsx`).catch((e) =>
                  setErro((e as Error).message),
                )
              }
            />
          </Box>
        </Box>

        <Box sx={{ mt: 3 }}>
          <ReservasTable
            motor={motor}
            onAjustar={(id, d) => operar((m) => m.ajustar(id, d))}
            onEfetivar={(id, nf) => operar((m) => m.efetivar(id, nf))}
            onCancelar={(id) => operar((m) => m.cancelar(id))}
          />
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
