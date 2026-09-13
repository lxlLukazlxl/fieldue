import { COLORS } from "@/constants/colors";

export const labelsStatus: Record<string, string> = {
  ATRIBUIDA: "OS atribuída",
  ACEITA: "OS aceita",
  EM_DESLOCAMENTO: "Em deslocamento",
  NO_LOCAL: "No local",
  EM_ATENDIMENTO: "Em atendimento",
  EM_ALMOCO: "Em horário de almoço",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export const proximaAcao: Record<string, { status: string; label: string }> = {
  ATRIBUIDA: { status: "ACEITA", label: "ACEITAR OS" },
  ACEITA: { status: "EM_DESLOCAMENTO", label: "INICIAR DESLOCAMENTO" },
  EM_DESLOCAMENTO: { status: "NO_LOCAL", label: "CHEGUEI AO LOCAL" },
  NO_LOCAL: { status: "EM_ATENDIMENTO", label: "INICIAR ATENDIMENTO" },
};

export function formatarHora(dataIso: string | null | undefined) {
  if (!dataIso) return null;
  const d = new Date(dataIso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function coresStatus(status: string | null | undefined) {
  const mapa: Record<string, { bg: string; fg: string }> = {
    ATRIBUIDA: { bg: "#EAEEF6", fg: COLORS.navy },
    ACEITA: { bg: COLORS.accentSoft, fg: COLORS.accentDark },
    EM_DESLOCAMENTO: { bg: COLORS.accentSoft, fg: COLORS.accentDark },
    NO_LOCAL: { bg: COLORS.accentSoft, fg: COLORS.accentDark },
    EM_ATENDIMENTO: { bg: COLORS.accentSoft, fg: COLORS.accentDark },
    EM_ALMOCO: { bg: COLORS.warningSoft, fg: "#8A5A00" },
    FINALIZADA: { bg: COLORS.successSoft, fg: COLORS.success },
    CANCELADA: { bg: COLORS.dangerSoft, fg: COLORS.danger },
  };
  return (status && mapa[status]) || { bg: "#EAEEF6", fg: COLORS.navy };
}
