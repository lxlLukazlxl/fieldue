// Paleta compartilhada com o painel web (navy + laranja segurança) — mantém
// a mesma identidade visual entre o app do técnico e o painel de gestão.
export const COLORS = {
  ink: "#0F1A2B",
  navy: "#16233B",
  navyLight: "#22314F",
  accent: "#FF7A29",
  accentDark: "#C85A14",
  accentSoft: "#FFEDE0",
  bg: "#F3F5F9",
  card: "#FFFFFF",
  text: "#16233B",
  muted: "#6B7688",
  line: "#E5E9F0",
  success: "#1D9A6C",
  successSoft: "#E3F5EC",
  danger: "#E0483E",
  dangerSoft: "#FCE7E5",
  warning: "#F5A524",
  warningSoft: "#FEF3DC",
};

// Pares de cor para os gradientes (botões principais, marca, cabeçalhos).
// Mantidos separados do objeto acima para não quebrar nenhum uso existente
// de COLORS.<chave> — são só um complemento visual.
export const GRADIENTS = {
  accent: [COLORS.accent, COLORS.accentDark] as const,
  navy: [COLORS.navyLight, COLORS.navy] as const,
  ink: [COLORS.navy, COLORS.ink] as const,
  warning: [COLORS.warning, "#D9860F"] as const,
  success: [COLORS.success, "#15794F"] as const,
  danger: [COLORS.danger, "#B8342B"] as const,
  slate: ["#93A0B8", "#707E99"] as const,
};
