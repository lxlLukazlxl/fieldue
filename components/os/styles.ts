import { StyleSheet } from "react-native";

import { COLORS, GRADIENTS } from "@/constants/colors";

export { COLORS, GRADIENTS };

export const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: {
    width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.accentDark, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  appName: { fontSize: 20, fontWeight: "800", color: COLORS.ink, letterSpacing: -0.3 },
  connectionPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 20, backgroundColor: COLORS.successSoft },
  syncButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF1F5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.line },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  connection: { fontSize: 12, color: COLORS.success, fontWeight: "700" },
  emptyText: { textAlign: "center", color: COLORS.muted, padding: 20 },
  container: { padding: 18, backgroundColor: COLORS.bg, flexGrow: 1 },
  card: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: COLORS.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 22,
    color: COLORS.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 16,
    backgroundColor: "#FBFCFE",
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  selText: { fontSize: 15, color: COLORS.text, fontWeight: "600" },
  statusBox: { backgroundColor: "#FBFCFE", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusCaption: { fontSize: 11, color: COLORS.muted, fontWeight: "800", letterSpacing: 0.5 },
  statusValue: { fontSize: 17, color: COLORS.ink, fontWeight: "800", marginTop: 4 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  statusBadgeText: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  horariosBox: { backgroundColor: COLORS.warningSoft, padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0D99B" },
  horarioLinha: { fontSize: 13, color: "#7A5A00", marginVertical: 2, fontWeight: "700" },
  btnWorkflow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 17, borderRadius: 16, backgroundColor: COLORS.navy, marginBottom: 12,
    overflow: "hidden",
    shadowColor: COLORS.navy, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 18, borderRadius: 16, backgroundColor: COLORS.accent,
    overflow: "hidden",
    shadowColor: COLORS.accentDark, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },
  btnAction: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: COLORS.navy, padding: 15, borderRadius: 14, overflow: "hidden",
  },
  photoCount: { fontSize: 13, color: COLORS.muted, marginTop: 10, fontWeight: "700" },
  thumbWrap: { position: "relative", marginRight: 10 },
  removePhoto: { position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", zIndex: 2, borderWidth: 2, borderColor: "#fff" },
  removePhotoText: { color: "#fff", fontSize: 16, lineHeight: 18, fontWeight: "800" },
  imgThumbnail: {
    width: 80,
    height: 80,
    marginRight: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  input: {
    backgroundColor: "#FBFCFE",
    padding: 16,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    fontSize: 15,
    color: COLORS.text,
  },

  // Estilos Modal Seleção
  modalCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,26,43,0.55)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 24,
    maxHeight: "70%",
    alignItems: "center",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", marginBottom: 15, color: COLORS.ink },
  listItem: {
    padding: 17,
    borderBottomWidth: 1,
    borderColor: COLORS.line,
    width: "100%",
  },
  listItemText: { fontSize: 16, color: COLORS.text, fontWeight: "600" },
  cancelText: { marginTop: 15, color: COLORS.danger, fontSize: 15, fontWeight: "700" },

  // Estilos Assinatura
  signatureActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    paddingBottom: 36,
    gap: 10,
  },
  btnSig: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 16, maxWidth: 140, overflow: "hidden" },
  btnSigText: { color: "#fff", fontWeight: "800", fontSize: 12.5, letterSpacing: 0.2 },

  // Banner de status offline
  offlineBanner: {
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#F0D99B",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  offlineBannerText: { color: "#7A5A00", fontWeight: "700", fontSize: 13, textAlign: "center" },

  // Sub-abas dentro da OS (Serviço / Materiais / Despesas)
  tabBar: { flexDirection: "row", marginBottom: 18, backgroundColor: "#EEF1F5", borderRadius: 14, padding: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 11 },
  tabBtnAtiva: { backgroundColor: "#fff", shadowColor: COLORS.ink, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  tabBtnTextAtiva: { color: COLORS.ink },

  subTitle: { fontSize: 15, fontWeight: "800", color: COLORS.ink, marginTop: 20, marginBottom: 10 },
  itemLista: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FBFCFE", padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.line },
  osCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FBFCFE", padding: 15, borderRadius: 16, marginBottom: 9, borderWidth: 1, borderColor: COLORS.line },
  osCardCliente: { fontSize: 14.5, fontWeight: "700", color: COLORS.ink },
  osCardMeta: { fontSize: 12, color: COLORS.muted, marginTop: 2, fontWeight: "600" },
  itemListaTexto: { color: COLORS.text, fontSize: 13.5, flex: 1, fontWeight: "600" },

  // Chips de tipo de despesa
  chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20, backgroundColor: "#EEF1F5", borderWidth: 1, borderColor: "transparent" },
  chipAtivo: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipTexto: { fontSize: 13, color: COLORS.muted, fontWeight: "700" },
  chipTextoAtivo: { color: COLORS.accentDark },

  // Checkbox "cobrar do cliente"
  checkboxLinha: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.success, alignItems: "center", justifyContent: "center" },
  checkboxMarcado: { backgroundColor: COLORS.success },
});
