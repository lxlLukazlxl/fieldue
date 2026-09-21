import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { SelectionModal } from "@/components/os/SelectionModal";
import { useAuthContext } from "@/hooks/useAuth";
import { useCadastros } from "@/hooks/useCadastros";
import { useDespesaAvulsa } from "@/hooks/useDespesaAvulsa";
import { Cliente } from "@/lib/osTypes";

const C = { bg: "#F5F7FB", card: "#fff", ink: "#152238", muted: "#687386", navy: "#16233B", accent: "#FF7A29", line: "#E4E9F0", danger: "#D64545", success: "#1D9A6C" };

const LABELS_TIPO: Record<string, string> = {
  PEDAGIO: "Pedágio",
  COMBUSTIVEL: "Combustível",
  ALIMENTACAO: "Alimentação",
  HOSPEDAGEM: "Hospedagem",
  ESTACIONAMENTO: "Estacionamento",
  OUTRO: "Outro",
};

export default function DespesasScreen() {
  const { auth } = useAuthContext();
  const cad = useCadastros();
  const f = useDespesaAvulsa();
  const [clienteModal, setClienteModal] = useState(false);
  const tecnicoId = auth?.usuario?.colaborador_id;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>FINANCEIRO</Text>
          <Text style={s.title}>Lançar despesa</Text>
          <Text style={s.sub}>Pedágio, combustível e outros gastos de campo — não precisa estar numa OS aberta.</Text>
        </View>
        <View style={s.icon}>
          <Feather name="file-text" size={23} color="#fff" />
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.section}>1. Cliente relacionado</Text>
        <TouchableOpacity style={s.select} onPress={() => setClienteModal(true)}>
          <Feather name="briefcase" size={18} color={C.muted} />
          <Text style={s.selectText}>{f.cliente ? f.cliente.nome : "Selecionar cliente"}</Text>
          <Feather name="chevron-down" size={18} color={C.muted} />
        </TouchableOpacity>

        <Text style={s.section}>2. Tipo de despesa</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {f.TIPOS_DESPESA_VALIDOS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.chip, f.tipo === t && s.chipAtivo]}
              onPress={() => f.setTipo(t)}
            >
              <Text style={[s.chipTexto, f.tipo === t && s.chipTextoAtivo]}>{LABELS_TIPO[t] || t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.section}>3. Valor e detalhes</Text>
        <TextInput
          style={s.input}
          placeholder="Valor (R$)"
          keyboardType="decimal-pad"
          value={f.valor}
          onChangeText={f.setValor}
        />
        <TextInput
          style={s.input}
          placeholder="Descrição (opcional)"
          value={f.descricao}
          onChangeText={f.setDescricao}
        />
        <TextInput
          style={s.input}
          placeholder="Número da nota (opcional)"
          value={f.numeroNota}
          onChangeText={f.setNumeroNota}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 4, alignItems: "center" }}>
          <TouchableOpacity
            style={[s.fotoBtn, { flex: f.fotoRecibo ? 0 : 1 }]}
            onPress={() => f.selecionarFotoRecibo("camera")}
          >
            <Feather name="camera" size={16} color="#fff" />
            <Text style={s.fotoBtnText}>FOTO DO RECIBO</Text>
          </TouchableOpacity>
          {f.fotoRecibo && (
            <Image source={{ uri: `data:image/jpeg;base64,${f.fotoRecibo}` }} style={s.thumb} />
          )}
        </View>

        <TouchableOpacity style={s.checkboxLinha} onPress={() => f.setCobrarDoCliente(!f.cobrarDoCliente)}>
          <View style={[s.checkbox, f.cobrarDoCliente && s.checkboxMarcado]}>
            {f.cobrarDoCliente && <Feather name="check" size={13} color="#fff" />}
          </View>
          <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }}>Cobrar esse valor do cliente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submit, (!f.cliente || !f.valor || f.enviando) && { opacity: 0.45 }]}
          disabled={f.enviando}
          onPress={() => f.enviar(tecnicoId)}
        >
          <Feather name="check-circle" size={17} color="#fff" />
          <Text style={s.submitText}>{f.enviando ? "ENVIANDO..." : "REGISTRAR DESPESA"}</Text>
        </TouchableOpacity>
      </View>

      <SelectionModal
        visible={clienteModal}
        title="Clientes"
        items={cad.clientes}
        emptyMessage="Nenhum cliente cadastrado."
        keyExtractor={(c: Cliente) => c.id}
        renderLabel={(c: Cliente) => `${c.nome}${c.bairro ? ` (${c.bairro})` : ""}`}
        onSelect={(c: Cliente) => { f.setCliente(c); setClienteModal(false); }}
        onClose={() => setClienteModal(false)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 18, paddingBottom: 35, backgroundColor: C.bg, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: C.accent },
  title: { fontSize: 25, fontWeight: "900", color: C.ink, marginTop: 4 },
  sub: { fontSize: 13, color: C.muted, maxWidth: 300, marginTop: 5, lineHeight: 18 },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.line },
  section: { fontSize: 15, fontWeight: "900", color: C.ink, marginBottom: 10, marginTop: 3 },
  select: { minHeight: 56, borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18, backgroundColor: "#FBFCFE" },
  selectText: { flex: 1, fontSize: 14, color: C.ink, fontWeight: "700" },
  chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20, backgroundColor: "#EEF2F7", borderWidth: 1, borderColor: "transparent" },
  chipAtivo: { backgroundColor: "#E4EFFF", borderColor: C.accent },
  chipTexto: { fontSize: 13, color: C.muted, fontWeight: "700" },
  chipTextoAtivo: { color: C.accent },
  input: { backgroundColor: "#FBFCFE", padding: 15, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line, fontSize: 14, color: C.ink },
  fotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.navy, padding: 15, borderRadius: 14 },
  fotoBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  thumb: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  checkboxLinha: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.success, alignItems: "center", justifyContent: "center" },
  checkboxMarcado: { backgroundColor: C.success },
  submit: { marginTop: 18, height: 54, borderRadius: 15, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
