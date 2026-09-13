import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { Material, MaterialSolicitado } from "@/lib/osTypes";
import { COLORS, GRADIENTS, styles } from "./styles";

type Props = {
  materialSel: Material | null;
  onAbrirModalMaterial: () => void;
  quantidadeMaterial: string;
  onMudarQuantidade: (v: string) => void;
  enviandoMaterial: boolean;
  onSolicitarMaterial: () => void;
  materiaisSolicitados: MaterialSolicitado[];
};

export function AbaMateriais({
  materialSel, onAbrirModalMaterial,
  quantidadeMaterial, onMudarQuantidade,
  enviandoMaterial, onSolicitarMaterial,
  materiaisSolicitados,
}: Props) {
  return (
    <>
      <TouchableOpacity style={styles.sel} onPress={onAbrirModalMaterial}>
        <Feather name="package" size={17} color={COLORS.muted} />
        <Text style={styles.selText}>
          {materialSel ? materialSel.nome : "Selecionar material"}
        </Text>
      </TouchableOpacity>

      {materialSel && (
        <TextInput
          style={styles.input}
          placeholder={`Quantidade (${materialSel.unidade})`}
          keyboardType="numeric"
          value={quantidadeMaterial}
          onChangeText={onMudarQuantidade}
        />
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 12 }, !materialSel && { backgroundColor: "#CBD2DE" }]}
        onPress={onSolicitarMaterial}
        disabled={!materialSel || enviandoMaterial}
      >
        {!!materialSel && <GradientFill colors={GRADIENTS.accent} />}
        <Feather name="send" size={16} color="#fff" />
        <Text style={styles.btnText}>{enviandoMaterial ? "ENVIANDO..." : "SOLICITAR MATERIAL"}</Text>
      </TouchableOpacity>

      <Text style={styles.subTitle}>Materiais solicitados nesta OS</Text>
      {materiaisSolicitados.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum material solicitado ainda.</Text>
      ) : (
        materiaisSolicitados.map((m) => (
          <View key={m.id} style={styles.itemLista}>
            <Feather name="package" size={15} color={COLORS.muted} />
            <Text style={styles.itemListaTexto}>
              {m.quantidade} {m.unidade} — {m.material_nome}
              {m.pendente ? "  ⏳ pendente de envio" : ""}
            </Text>
          </View>
        ))
      )}
    </>
  );
}
