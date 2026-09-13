import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { COLORS, GRADIENTS } from "@/constants/colors";
import { useAuthContext } from "@/hooks/useAuth";

export function LoginScreen() {
  const { entrar, entrando } = useAuthContext();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleEntrar() {
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setErro(null);
    try {
      await entrar(email, senha);
    } catch (e: any) {
      setErro(e.message || "Não foi possível entrar.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.mancha} />
      <View style={styles.conteudo}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <GradientFill colors={GRADIENTS.accent} />
            <Feather name="tool" size={28} color="#fff" />
          </View>
          <Text style={styles.appName}>Fielduo</Text>
          <Text style={styles.subtitle}>Entre com seu e-mail e senha</Text>
        </View>

        <View style={styles.inputWrap}>
          <Feather name="mail" size={16} color={COLORS.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={styles.inputWrap}>
          <Feather name="lock" size={16} color={COLORS.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <TouchableOpacity style={styles.btnEntrar} onPress={handleEntrar} disabled={entrando}>
          {!entrando && <GradientFill colors={GRADIENTS.accent} />}
          <Feather name="log-in" size={17} color="#fff" />
          <Text style={styles.btnEntrarTexto}>{entrando ? "ENTRANDO..." : "ENTRAR"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COLORS.bg },
  mancha: {
    position: "absolute",
    top: -140,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 200,
    backgroundColor: COLORS.accentSoft,
    opacity: 0.6,
  },
  conteudo: { flex: 1, justifyContent: "center", padding: 28 },
  brand: { alignItems: "center", marginBottom: 38 },
  brandMark: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: COLORS.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  appName: { fontSize: 27, fontWeight: "800", color: COLORS.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.muted, marginTop: 5 },
  inputWrap: { position: "relative", justifyContent: "center", marginBottom: 12 },
  inputIcon: { position: "absolute", left: 16, zIndex: 1 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 15,
    padding: 16,
    paddingLeft: 44,
    fontSize: 15,
    color: COLORS.text,
  },
  erro: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  btnEntrar: {
    borderRadius: 16,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    overflow: "hidden",
    backgroundColor: "#CBD2DE",
    shadowColor: COLORS.accentDark,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnEntrarTexto: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
