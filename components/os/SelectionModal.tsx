import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { styles } from "./styles";

type Props<T> = {
  visible: boolean;
  title: string;
  items: T[];
  emptyMessage: string;
  keyExtractor: (item: T) => string | number;
  renderLabel: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  onClose: () => void;
};

// Os quatro seletores da tela de OS (técnico, cliente, gestor, material)
// eram modais quase idênticos, só mudando o título e como o item é exibido.
// Esse componente genérico cobre os quatro casos.
export function SelectionModal<T>({
  visible,
  title,
  items,
  emptyMessage,
  keyExtractor,
  renderLabel,
  onSelect,
  onClose,
}: Props<T>) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalCentered}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ width: "100%" }}>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            ) : (
              items.map((item) => (
                <TouchableOpacity
                  key={keyExtractor(item)}
                  style={styles.listItem}
                  onPress={() => onSelect(item)}
                >
                  <Text style={styles.listItemText}>{renderLabel(item)}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
