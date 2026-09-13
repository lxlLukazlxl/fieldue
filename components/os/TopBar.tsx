import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { COLORS, GRADIENTS, styles } from "./styles";

type Props = {
  online: boolean;
  carregandoDados: boolean;
  onSincronizar: () => void;
  nomeUsuario?: string;
  onSair: () => void;
};

export function TopBar({ online, carregandoDados, onSincronizar, nomeUsuario, onSair }: Props) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { overflow: "hidden" }]}>
          <GradientFill colors={GRADIENTS.accent} />
          <Feather name="tool" size={18} color="#fff" />
        </View>
        <View>
          <Text style={styles.appName}>Fielduo</Text>
          {!!nomeUsuario && (
            <Text style={{ fontSize: 11.5, color: COLORS.muted, fontWeight: "600" }}>{nomeUsuario}</Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={onSincronizar}
          disabled={carregandoDados}
        >
          <Feather name="refresh-cw" size={15} color={COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncButton} onPress={onSair}>
          <Feather name="log-out" size={15} color={COLORS.danger} />
        </TouchableOpacity>
        <View style={[styles.connectionPill, !online && { backgroundColor: COLORS.dangerSoft }]}>
          <View style={[styles.connectionDot, !online && { backgroundColor: COLORS.danger }]} />
          <Text style={[styles.connection, !online && { color: COLORS.danger }]}>
            {carregandoDados ? "Conectando" : online ? "Online" : "Offline"}
          </Text>
        </View>
      </View>
    </View>
  );
}
