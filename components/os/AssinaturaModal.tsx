import { Feather } from "@expo/vector-icons";
import React, { RefObject } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import SignatureScreen from "react-native-signature-canvas";

import { GradientFill } from "@/components/GradientFill";
import { GRADIENTS, styles } from "./styles";

type Props = {
  visible: boolean;
  signatureRef: RefObject<any>;
  onOK: (assinaturaBase64: string) => void;
  onCancel: () => void;
};

export function AssinaturaModal({ visible, signatureRef, onOK, onCancel }: Props) {
  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 40, alignItems: "center" }}>
          <Text style={styles.title}>Assinatura do Cliente</Text>
        </View>

        <View
          style={{
            flex: 1,
            margin: 15,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <SignatureScreen
            ref={signatureRef}
            onOK={onOK}
            descriptionText="Assine dentro da área branca"
            webStyle={`.m-signature-pad--footer { display: none; }`}
          />
        </View>

        <View style={styles.signatureActions}>
          <TouchableOpacity style={styles.btnSig} onPress={() => signatureRef.current.clearSignature()}>
            <GradientFill colors={GRADIENTS.slate} />
            <Feather name="rotate-ccw" size={14} color="#fff" />
            <Text style={styles.btnSigText} numberOfLines={1}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSig} onPress={onCancel}>
            <GradientFill colors={GRADIENTS.danger} />
            <Feather name="x" size={14} color="#fff" />
            <Text style={styles.btnSigText} numberOfLines={1}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSig} onPress={() => signatureRef.current.readSignature()}>
            <GradientFill colors={GRADIENTS.success} />
            <Feather name="check" size={14} color="#fff" />
            <Text style={styles.btnSigText} numberOfLines={1}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
