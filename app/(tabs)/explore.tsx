import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { API_URL, apiHeaders } from "@/constants/api";

export default function StatusScreen() {
  const [status, setStatus] = useState<"carregando" | "online" | "offline">("carregando");
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  const verificar = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/health`, { headers: apiHeaders() });
      setStatus(response.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    } finally {
      setUltimaVerificacao(new Date().toLocaleTimeString("pt-BR"));
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { verificar(); }, [verificar]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); verificar(); }} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Fielduo</Text>
        <Text style={styles.subtitle}>Status do aplicativo</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Servidor da API</Text>
        <Text style={styles.url}>{API_URL}</Text>
        <View style={styles.statusRow}>
          {status === "carregando" ? <ActivityIndicator /> : <View style={[styles.dot, status === "online" ? styles.online : styles.offline]} />}
          <Text style={styles.statusText}>
            {status === "carregando" ? "Verificando..." : status === "online" ? "Servidor online" : "Servidor indisponível"}
          </Text>
        </View>
        {!!ultimaVerificacao && <Text style={styles.muted}>Última verificação: {ultimaVerificacao}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fluxo do técnico</Text>
        <Text style={styles.item}>✓ Selecionar técnico, cliente e gestor</Text>
        <Text style={styles.item}>✓ Registrar fotos do serviço</Text>
        <Text style={styles.item}>✓ Preencher relatório</Text>
        <Text style={styles.item}>✓ Coletar assinatura</Text>
        <Text style={styles.item}>✓ Enviar OS para o servidor</Text>
        <Text style={styles.item}>✓ Enviar localização durante o uso</Text>
      </View>

      <Text style={styles.footer}>Versão 1.1 • Armazenamento local no servidor</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f4f7f6" },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#18212f" },
  subtitle: { marginTop: 4, fontSize: 15, color: "#687386" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  label: { fontSize: 13, color: "#687386", fontWeight: "700", textTransform: "uppercase" },
  url: { marginTop: 8, color: "#18212f", fontSize: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  online: { backgroundColor: "#28a745" },
  offline: { backgroundColor: "#dc3545" },
  statusText: { fontSize: 17, fontWeight: "700", color: "#18212f" },
  muted: { marginTop: 10, color: "#8a93a1" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12, color: "#18212f" },
  item: { fontSize: 15, color: "#3f4855", marginBottom: 9 },
  footer: { textAlign: "center", color: "#8a93a1", marginTop: 8, marginBottom: 20 },
});
