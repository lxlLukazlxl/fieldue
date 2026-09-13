import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet } from "react-native";

type Props = {
  colors: readonly [string, string, ...string[]];
};

// Vai como PRIMEIRO filho dentro de um botão (TouchableOpacity) que tenha
// `overflow: "hidden"` no style — o gradiente preenche todo o botão por
// baixo, e o texto/ícone (os filhos seguintes) aparecem por cima. Assim dá
// pra dar um visual em gradiente sem reescrever o layout de cada botão.
export function GradientFill({ colors }: Props) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
