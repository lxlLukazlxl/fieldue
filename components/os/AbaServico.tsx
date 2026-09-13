import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { GRADIENTS, styles } from "./styles";

type Props = {
  fotos: string[];
  onSelecionarFotos: (origem: "camera" | "galeria") => void;
  onRemoverFoto: (index: number) => void;
  relatorio: string;
  onMudarRelatorio: (v: string) => void;
  nomeClienteFinal: string;
  onMudarNomeClienteFinal: (v: string) => void;
  assinaturaBase64: string | null;
  onAbrirAssinatura: () => void;
  carregando: boolean;
  podeFinalizar: boolean;
  onFinalizar: () => void;
};

export function AbaServico({
  fotos, onSelecionarFotos, onRemoverFoto,
  relatorio, onMudarRelatorio,
  nomeClienteFinal, onMudarNomeClienteFinal,
  assinaturaBase64, onAbrirAssinatura,
  carregando, podeFinalizar, onFinalizar,
}: Props) {
  return (
    <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity style={styles.btnAction} onPress={() => onSelecionarFotos("camera")}>
          <GradientFill colors={GRADIENTS.navy} />
          <Feather name="camera" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>CÂMARA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAction} onPress={() => onSelecionarFotos("galeria")}>
          <GradientFill colors={GRADIENTS.navy} />
          <Feather name="image" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>GALERIA</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.photoCount}>Fotos: {fotos.length}/10 • mínimo 3</Text>
      <ScrollView horizontal style={{ marginVertical: 10 }}>
        {fotos.map((f, i) => (
          <View key={i} style={styles.thumbWrap}>
            <Image source={{ uri: `data:image/jpeg;base64,${f}` }} style={styles.imgThumbnail} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => onRemoverFoto(i)}>
              <Text style={styles.removePhotoText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Descreva o serviço realizado..."
        multiline
        value={relatorio}
        onChangeText={onMudarRelatorio}
      />
      <TextInput
        style={styles.input}
        placeholder="Nome Completo"
        value={nomeClienteFinal}
        onChangeText={onMudarNomeClienteFinal}
      />

      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 14 }]} onPress={onAbrirAssinatura}>
        <GradientFill colors={assinaturaBase64 ? GRADIENTS.success : GRADIENTS.navy} />
        <Feather name={assinaturaBase64 ? "check-circle" : "edit-3"} size={17} color="#fff" />
        <Text style={styles.btnText}>
          {assinaturaBase64 ? "ASSINATURA COLETADA" : "COLETAR ASSINATURA"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 20 }, !podeFinalizar && { backgroundColor: "#CBD2DE" }]}
        onPress={onFinalizar}
        disabled={carregando || !podeFinalizar}
      >
        {podeFinalizar && <GradientFill colors={GRADIENTS.accent} />}
        <Feather name="send" size={17} color="#fff" />
        <Text style={styles.btnText}>{carregando ? "ENVIANDO..." : "FINALIZAR E ENVIAR"}</Text>
      </TouchableOpacity>
    </>
  );
}
