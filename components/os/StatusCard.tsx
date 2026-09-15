import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { Horarios } from "@/lib/osTypes";
import { coresStatus, formatarHora, labelsStatus, proximaAcao } from "@/lib/statusOS";
import { GRADIENTS, styles } from "./styles";

type Props = {
  osId: number | null;
  statusOS: string | null;
  horarios: Horarios;
  carregandoAlmoco: boolean;
  onMudarStatus: (status: string) => void;
  onIniciarAlmoco: () => void;
  onFinalizarAlmoco: () => void;
};

export function StatusCard({
  osId, statusOS, horarios,
  carregandoAlmoco, onMudarStatus, onIniciarAlmoco, onFinalizarAlmoco,
}: Props) {
  return (
    <>
      <Text style={styles.title}>OS #{osId ?? "—"}</Text>
      <View style={[styles.statusBox, { borderLeftWidth: 3, borderLeftColor: coresStatus(statusOS).fg }]}>
        <View>
          <Text style={styles.statusCaption}>STATUS ATUAL</Text>
          <Text style={styles.statusValue}>{statusOS ? (labelsStatus[statusOS] || statusOS) : "—"}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: coresStatus(statusOS).bg }]}>
          <Text style={[styles.statusBadgeText, { color: coresStatus(statusOS).fg }]}>
            {statusOS ? (labelsStatus[statusOS] || statusOS) : "—"}
          </Text>
        </View>
      </View>

      {statusOS && proximaAcao[statusOS] && (
        <TouchableOpacity style={styles.btnWorkflow} onPress={() => onMudarStatus(proximaAcao[statusOS].status)}>
          <GradientFill colors={GRADIENTS.navy} />
          <Feather name="arrow-right-circle" size={17} color="#fff" />
          <Text style={styles.btnText}>{proximaAcao[statusOS].label}</Text>
        </TouchableOpacity>
      )}

      {statusOS === "EM_ATENDIMENTO" && (
        <TouchableOpacity
          style={styles.btnWorkflow}
          onPress={onIniciarAlmoco}
          disabled={carregandoAlmoco}
        >
          <GradientFill colors={GRADIENTS.warning} />
          <Feather name="coffee" size={17} color="#fff" />
          <Text style={styles.btnText}>{carregandoAlmoco ? "REGISTRANDO..." : "INICIAR ALMOÇO"}</Text>
        </TouchableOpacity>
      )}

      {statusOS === "EM_ALMOCO" && (
        <TouchableOpacity
          style={styles.btnWorkflow}
          onPress={onFinalizarAlmoco}
          disabled={carregandoAlmoco}
        >
          <GradientFill colors={GRADIENTS.warning} />
          <Feather name="coffee" size={17} color="#fff" />
          <Text style={styles.btnText}>{carregandoAlmoco ? "REGISTRANDO..." : "VOLTAR DO ALMOÇO"}</Text>
        </TouchableOpacity>
      )}

      {(horarios.inicio_data || horarios.almoco_inicio_data) && (
        <View style={styles.horariosBox}>
          {horarios.inicio_data && (
            <Text style={styles.horarioLinha}>🕐 Início do atendimento: {formatarHora(horarios.inicio_data)}</Text>
          )}
          {horarios.almoco_inicio_data && (
            <Text style={styles.horarioLinha}>
              🍽️ Almoço: {formatarHora(horarios.almoco_inicio_data)}
              {horarios.almoco_fim_data ? ` às ${formatarHora(horarios.almoco_fim_data)}` : " (em andamento)"}
            </Text>
          )}
          {horarios.fim_data && (
            <Text style={styles.horarioLinha}>🏁 Término: {formatarHora(horarios.fim_data)}</Text>
          )}
        </View>
      )}
    </>
  );
}
