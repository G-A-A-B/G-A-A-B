import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Tema inspirado no Material 3 (Material You) sobre o MUI:
 * paleta tonal primária/secundária/terciária, cantos arredondados (shape 16)
 * e superfícies com leve elevação tonal. Suporta modo claro e escuro.
 */
export function criarTema(modo: "light" | "dark"): Theme {
  const claro = modo === "light";
  return createTheme({
    palette: {
      mode: modo,
      primary: { main: claro ? "#4355b9" : "#b9c3ff" },
      secondary: { main: claro ? "#575e71" : "#c0c6dc" },
      // "tertiary" não é nativo do MUI; usamos success/info como papéis MD3.
      success: { main: claro ? "#3f6837" : "#a4d39a" },
      warning: { main: claro ? "#795900" : "#f4be48" },
      error: { main: claro ? "#ba1a1a" : "#ffb4ab" },
      info: { main: claro ? "#725572" : "#e0bbdf" },
      background: {
        default: claro ? "#faf8ff" : "#121318",
        paper: claro ? "#f2f0f7" : "#1c1d23",
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily:
        'Roboto, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
      h5: { fontWeight: 600, letterSpacing: 0 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 20, paddingInline: 20 } },
        defaultProps: { disableElevation: true },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 20 } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
      },
    },
  });
}
