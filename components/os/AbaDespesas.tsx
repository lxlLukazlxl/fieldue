import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";

import { GradientFill } from "@/components/GradientFill";
import { Despesa } from "@/lib/osTypes";
import { COLORS, GRADIENTS, styles } from "./styles";

const TIPOS_DESPESA = [
  { key: "PEDAGIO", label: "Pedágio" },
  { key: "HOSPEDAGEM", label: "Hospedagem" },
  { key: "MATERIAL", label: "Material" },
  { key: "ALIMENTACAO", label: "Almoço / alimentação" },
  { key: "COMBUSTIVEL", label: "Combustível" },
  { key: "ESTACIONAMENTO", label: "Estacionamento" },
  { key: "OUTRO", label: "Outro" },
];

type Props = {
  tipoDespesa: string;
  onMudarTipo: (tipo: string) => void;
  valorDespesa: string;
  onMudarValor: (v: string) => void;
  descricaoDespesa: string;
  onMudarDescricao: (v: string) => void;
  numeroNota: string;
  onMudarNumeroNota: (v: string) => void;
  fotoRecibo: string | null;
  onSelecionarFotoRecibo: (origem: "camera" | "galeria") => void;
  cobrarDoCliente: boolean;
  onAlternarCobrarDoCliente: () => void;
  enviandoDespesa: boolean;
  onLancarDespesa: () => void;
  despesas: Despesa[];
};

export function AbaDespesas({
  tipoDespesa, onMudarTipo,
  valorDespesa, onMudarValor,
  descricaoDespesa, onMudarDescricao,
  numeroNota, onMudarNumeroNota,
  fotoRecibo, onSelecionarFotoRecibo,
  cobrarDoCliente, onAlternarCobrarDoCliente,
  enviandoDespesa, onLancarDespesa,
  despesas,
}: Props) {
  return (
    <>
      <Text style={styles.subTitle}>Notinhas do técnico</Text>
      <Text style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>
        Registre gastos da OS, como almoço, pedágio, hospedagem, combustível, estacionamento, materiais e outros. Se tiver nota ou recibo, informe o número e fotografe o comprovante.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {TIPOS_DESPESA.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, tipoDespesa === t.key && styles.chipAtivo]}
            onPress={() => onMudarTipo(t.key)}
          >
            <Text style={[styles.chipTexto, tipoDespesa === t.key && styles.chipTextoAtivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Valor (R$)"
        keyboardType="numeric"
        value={valorDespesa}
        onChangeText={onMudarValor}
      />
      <TextInput
        style={styles.input}
        placeholder="Descrição / motivo (opcional)"
        value={descricaoDespesa}
        onChangeText={onMudarDescricao}
      />
      <TextInput
        style={styles.input}
        placeholder="Nº da nota fiscal / recibo (opcional)"
        value={numeroNota}
        onChangeText={onMudarNumeroNota}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" }}>
        <TouchableOpacity
          style={[styles.btnAction, { flex: fotoRecibo ? 0 : 1, paddingHorizontal: 16 }]}
          onPress={() => onSelecionarFotoRecibo("camera")}
        >
          <GradientFill colors={GRADIENTS.navy} />
          <Feather name="camera" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>FOTO DA NOTA / RECIBO</Text>
        </TouchableOpacity>
        {fotoRecibo && (
          <Image source={{ uri: `data:image/jpeg;base64,${fotoRecibo}` }} style={styles.imgThumbnail} />
        )}
      </View>

      <TouchableOpacity style={styles.checkboxLinha} onPress={onAlternarCobrarDoCliente}>
        <View style={[styles.checkbox, cobrarDoCliente && styles.checkboxMarcado]}>
          {cobrarDoCliente && <Feather name="check" size={13} color="#fff" />}
        </View>
        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "600" }}>Cobrar esse valor do cliente</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 14 }]}
        onPress={onLancarDespesa}
        disabled={enviandoDespesa}
      >
        <GradientFill colors={GRADIENTS.accent} />
        <Feather name="check-circle" size={17} color="#fff" />
        <Text style={styles.btnText}>{enviandoDespesa ? "ENVIANDO..." : "REGISTRAR DESPESA"}</Text>
      </TouchableOpacity>

      <Text style={styles.subTitle}>Despesas lançadas nesta OS</Text>
      {despesas.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma despesa lançada ainda.</Text>
      ) : (
        despesas.map((d) => (
          <View key={d.id} style={styles.itemLista}>
            <Feather name="file-text" size={15} color={COLORS.muted} />
            <Text style={styles.itemListaTexto}>
              {d.tipo} — R$ {Number(d.valor).toFixed(2)}
              {d.numero_nota ? ` • Nota: ${d.numero_nota}` : ""}
              {d.descricao ? ` (${d.descricao})` : ""}
              {d.foto_recibo ? "  📎 comprovante" : ""}
              {d.pendente ? "  ⏳ pendente de envio" : ""}
            </Text>
          </View>
        ))
      )}
    </>
  );
}
