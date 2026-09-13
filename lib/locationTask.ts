import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_URL } from "@/constants/api";

export const LOCATION_TASK_NAME = "FIELDUO_BACKGROUND_LOCATION";
const AUTH_STORAGE_KEY = "@fielduo/auth_v1";
const TRACKING_STORAGE_KEY = "@fielduo/tracking_v1";

type TrackingContext = { tecnicoId: number; osId: number };

async function carregarContexto(): Promise<TrackingContext | null> {
  try {
    const bruto = await AsyncStorage.getItem(TRACKING_STORAGE_KEY);
    if (!bruto) return null;
    const ctx = JSON.parse(bruto);
    if (!Number.isInteger(Number(ctx?.tecnicoId)) || !Number.isInteger(Number(ctx?.osId))) return null;
    return { tecnicoId: Number(ctx.tecnicoId), osId: Number(ctx.osId) };
  } catch {
    return null;
  }
}

async function carregarToken(): Promise<string | null> {
  try {
    const bruto = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!bruto) return null;
    return JSON.parse(bruto)?.token ?? null;
  } catch {
    return null;
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("Fielduo GPS em segundo plano:", error.message);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const loc = locations?.[locations.length - 1];
  if (!loc) return;

  const contexto = await carregarContexto();
  const token = await carregarToken();
  if (!contexto || !token) return;

  try {
    await fetch(`${API_URL}/pontos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tecnico_id: contexto.tecnicoId,
        os_id: contexto.osId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }),
    });
  } catch (e) {
    console.warn("Fielduo não conseguiu enviar GPS em segundo plano:", e);
  }
});

export async function salvarContextoRastreamento(ctx: TrackingContext | null) {
  if (!ctx) {
    await AsyncStorage.removeItem(TRACKING_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(ctx));
}
