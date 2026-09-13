import React from "react";
import { Text, TouchableOpacity } from "react-native";

import { styles } from "./styles";

type Props = {
  online: boolean;
  pendentes: number;
  sincronizando: boolean;
  onSincronizar: () => void;
};

export function OfflineBanner({ online, pendentes, sincronizando, onSincronizar }: Props) {
  if (online && pendentes === 0) return null;

  return (
    <TouchableOpacity
      style={styles.offlineBanner}
      onPress={onSincronizar}
      disabled={sincronizando || !online}
    >
      <Text style={styles.offlineBannerText}>
        {!online
          ? `⚠️ Sem conexão. ${pendentes > 0 ? `${pendentes} ação(ões) aguardando envio.` : "Suas ações serão salvas no aparelho."}`
          : sincronizando
            ? "🔄 Sincronizando pendências..."
            : `🔄 ${pendentes} ação(ões) pendente(s) — toque para sincronizar agora`}
      </Text>
    </TouchableOpacity>
  );
}
