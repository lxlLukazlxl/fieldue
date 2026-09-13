import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { LOCATION_TASK_NAME, salvarContextoRastreamento } from "@/lib/locationTask";
import { API_URL, apiHeaders } from "@/constants/api";

const STATUS_RASTREADOS = new Set(["EM_DESLOCAMENTO", "NO_LOCAL", "EM_ATENDIMENTO", "EM_ALMOCO"]);

export function useLocationTracking(
  tecnicoId: number | null | undefined,
  osId: number | null,
  statusOS: string | null,
) {
  const foregroundRef = useRef<Location.LocationSubscription | null>(null);
  const contextoRef = useRef<{ tecnicoId: number; osId: number } | null>(null);

  useEffect(() => {
    let ativo = true;

    async function enviarForeground(id: number, os: number, coords: { latitude: number; longitude: number }) {
      try {
        await fetch(`${API_URL}/pontos`, {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ tecnico_id: id, os_id: os, latitude: coords.latitude, longitude: coords.longitude }),
        });
      } catch (e) {
        console.warn("Não foi possível enviar a localização:", e);
      }
    }

    async function parar() {
      foregroundRef.current?.remove();
      foregroundRef.current = null;
      try {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch {
        // O task pode não existir no Expo Go ou em uma instalação antiga.
      }
      contextoRef.current = null;
      await salvarContextoRastreamento(null);
    }

    async function iniciar() {
      if (!tecnicoId || !osId || !statusOS || !STATUS_RASTREADOS.has(statusOS)) {
        await parar();
        return;
      }

      const contexto = { tecnicoId: Number(tecnicoId), osId: Number(osId) };
      contextoRef.current = contexto;
      await salvarContextoRastreamento(contexto);

      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!ativo || foreground.status !== "granted") {
        if (ativo) Alert.alert("Permissão de localização", "Permita o acesso à localização para o Fielduo acompanhar o atendimento.");
        return;
      }

      // O background location exige uma build nativa. No Expo Go, fazemos
      // fallback para o rastreamento em primeiro plano para não quebrar o app.
      let backgroundGranted = false;
      try {
        const background = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = background.status === "granted";
      } catch {
        backgroundGranted = false;
      }

      if (backgroundGranted) {
        try {
          const iniciado = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (!iniciado) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 30000,
              distanceInterval: 50,
              deferredUpdatesInterval: 30000,
              deferredUpdatesDistance: 50,
              pausesUpdatesAutomatically: false,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Fielduo — atendimento em andamento",
                notificationBody: "Sua localização está sendo enviada para acompanhamento da OS.",
                notificationColor: "#0F2747",
              },
            });
          }
          // A task nativa já cuida do foreground e background.
          return;
        } catch (e) {
          console.warn("Não foi possível iniciar GPS em segundo plano:", e);
        }
      }

      if (!ativo) return;
      foregroundRef.current?.remove();
      foregroundRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
        (loc) => enviarForeground(contexto.tecnicoId, contexto.osId, loc.coords),
      );
    }

    iniciar();

    return () => {
      ativo = false;
      void parar();
    };
  }, [tecnicoId, osId, statusOS]);
}
