import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";

// Pede permissão de notificação (se ainda não tiver), pega o token push do
// Expo e manda pro servidor — pra o técnico receber um aviso quando uma OS
// nova for atribuída a ele. Falha em silêncio: notificação é um extra, não
// pode travar nem afetar o resto do app se algo não funcionar.
export async function registrarPushToken(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permissaoAtual = await Notifications.getPermissionsAsync();
    let status = permissaoAtual.status;
    if (status !== "granted") {
      const pedido = await Notifications.requestPermissionsAsync();
      status = pedido.status;
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const resultado = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!resultado?.data) return;

    await fetch(`${API_URL}/auth/push-token`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ token: resultado.data }),
    });
  } catch (e) {
    console.warn("Não foi possível registrar notificações push:", e);
  }
}
