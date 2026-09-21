import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { coresStatus, labelsStatus } from "@/lib/statusOS";
import { Cliente, Gestor, Tecnico, Veiculo } from "@/lib/osTypes";
import { COLORS, GRADIENTS, styles } from "./styles";

type Props = {
  // Todos os perfis autenticados podem criar OS.
  podeCriarOS: boolean;
  tecnicoSel: Tecnico | null;
  clienteSel: Cliente | null;
  gestorSel: Gestor | null;
  veiculoSel: Veiculo | null;
  onAbrirTecnico: () => void;
  onAbrirCliente: () => void;
  onAbrirGestor: () => void;
  onAbrirVeiculo: () => void;
  criandoOS: boolean;
  mensagemEnvio?: string | null;
  onCriarOS: () => void;
  minhasOS: any[];
  carregandoMinhasOS: boolean;
  onRetomarOS: (os: any) => void;
};

export function NovaOSCard({
  podeCriarOS,
  tecnicoSel, clienteSel, gestorSel, veiculoSel,
  onAbrirTecnico, onAbrirCliente, onAbrirGestor, onAbrirVeiculo,
  criandoOS, mensagemEnvio, onCriarOS,
  minhasOS, carregandoMinhasOS, onRetomarOS,
}: Props) {
  return (
    <View style={styles.card}>
      {podeCriarOS ? (
        <>
          <Text style={styles.title}>Nova Ordem de Serviço</Text>

          {tecnicoSel ? (
            <View style={styles.sel}>
              <Feather name="user" size={17} color={COLORS.muted} />
              <Text style={styles.selText}>Técnico: {tecnicoSel.nome}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.sel} onPress={onAbrirTecnico}>
              <Feather name="user" size={17} color={COLORS.muted} />
              <Text style={styles.selText}>Selecionar Técnico</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.sel} onPress={onAbrirCliente}>
            <Feather name="briefcase" size={17} color={COLORS.muted} />
            <Text style={styles.selText}>
              {clienteSel ? `Cliente: ${clienteSel.nome}` : "Selecionar Cliente"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sel} onPress={onAbrirGestor}>
            <Feather name="shield" size={17} color={COLORS.muted} />
            <Text style={styles.selText}>
              {gestorSel ? `Gestor: ${gestorSel.nome}` : "Selecionar Gestor (Obrigatório)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sel} onPress={onAbrirVeiculo}>
            <Feather name="truck" size={17} color={COLORS.muted} />
            <Text style={styles.selText}>
              {veiculoSel ? `Veículo: ${veiculoSel.nome}${veiculoSel.placa ? ` (${veiculoSel.placa})` : ""}` : "Selecionar Veículo (opcional)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btnPrimary,
              { marginTop: 8 },
              !(tecnicoSel && clienteSel && gestorSel) && { backgroundColor: "#CBD2DE" },
            ]}
            onPress={onCriarOS}
            disabled={criandoOS}
          >
            {tecnicoSel && clienteSel && gestorSel && <GradientFill colors={GRADIENTS.accent} />}
            {!criandoOS && <Feather name="plus-circle" size={17} color="#fff" />}
            <Text style={styles.btnText}>{criandoOS ? "CRIANDO OS..." : "CRIAR ORDEM DE SERVIÇO"}</Text>
          </TouchableOpacity>
          {!!mensagemEnvio && criandoOS && (
            <Text style={{ marginTop: 10, textAlign: "center", color: COLORS.warning, fontSize: 12.5, fontWeight: "700" }}>
              {mensagemEnvio}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.title}>Minhas Ordens de Serviço</Text>
      )}

      <Text style={styles.subTitle}>
        {podeCriarOS ? "Minhas ordens de serviço pendentes" : "Pendentes"}
        {minhasOS.length > 0 ? ` (${minhasOS.length})` : ""}
      </Text>
      {carregandoMinhasOS ? (
        <Text style={styles.emptyText}>Buscando...</Text>
      ) : minhasOS.length === 0 ? (
        <Text style={styles.emptyText}>
          {tecnicoSel
            ? `Nenhuma OS pendente para ${tecnicoSel.nome}.`
            : "Selecione um técnico para ver as OS pendentes dela."}
        </Text>
      ) : (
        minhasOS.map((os) => (
          <TouchableOpacity
            key={os.id}
            style={[styles.osCard, { borderLeftWidth: 3, borderLeftColor: coresStatus(os.status).fg }]}
            onPress={() => onRetomarOS(os)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.osCardCliente}>{os.cliente_nome || "Cliente não informado"}</Text>
              <Text style={styles.osCardMeta}>OS #{os.id} · {os.gestor_nome || "—"}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: coresStatus(os.status).bg }]}>
              <Text style={[styles.statusBadgeText, { color: coresStatus(os.status).fg }]}>
                {labelsStatus[os.status] || os.status}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.muted} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}
