import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";
import { executarOuEnfileirar } from "@/lib/offlineQueue";
import { Despesa } from "@/lib/osTypes";

export function useDespesasOS() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [tipoDespesa, setTipoDespesa] = useState<string>("PEDAGIO");
  const [valorDespesa, setValorDespesa] = useState("");
  const [descricaoDespesa, setDescricaoDespesa] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [fotoRecibo, setFotoRecibo] = useState<string | null>(null);
  const [cobrarDoCliente, setCobrarDoCliente] = useState(true);
  const [enviandoDespesa, setEnviandoDespesa] = useState(false);

  async function buscarDespesas(id: number) {
    try {
      const response = await fetch(`${API_URL}/servico/${id}/despesas`, { headers: apiHeaders() });
      if (response.ok) setDespesas(await response.json());
    } catch (e) {
      console.warn("Não foi possível buscar as despesas:", e);
    }
  }

  function resetDespesas() {
    setDespesas([]);
    setValorDespesa("");
    setDescricaoDespesa("");
    setNumeroNota("");
    setFotoRecibo(null);
  }

  const selecionarFotoRecibo = async (origem: "camera" | "galeria") => {
    const options: ImagePicker.ImagePickerOptions = { quality: 0.35, base64: true };
    const result =
      origem === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.base64) {
      setFotoRecibo(result.assets[0].base64);
    }
  };

  async function lancarDespesa(osId: number | null, tecnicoId: number | null | undefined) {
    if (!osId || !tecnicoId) return;
    const valor = Number(valorDespesa.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) return Alert.alert("Valor inválido", "Informe um valor maior que zero.");

    setEnviandoDespesa(true);
    try {
      const r = await executarOuEnfileirar({
        descricao: `Lançar despesa de ${tipoDespesa} (R$ ${valor.toFixed(2)}) na OS #${osId}`,
        endpoint: `/servico/${osId}/despesas`,
        method: "POST",
        body: {
          tecnico_id: tecnicoId,
          tipo: tipoDespesa,
          valor,
          descricao: descricaoDespesa || null,
          numero_nota: numeroNota || null,
          foto_recibo: fotoRecibo,
          cobrar_do_cliente: cobrarDoCliente,
        },
      });
      if (!r.ok) return Alert.alert("Erro", r.erro || "Não foi possível registrar a despesa.");

      if (r.enfileirado) {
        setDespesas((prev) => [
          { id: `local-${Date.now()}`, tipo: tipoDespesa, valor, descricao: descricaoDespesa, cobrar_do_cliente: cobrarDoCliente, pendente: true },
          ...prev,
        ]);
        Alert.alert("Sem conexão", "Despesa salva no aparelho e será enviada quando a internet voltar.");
      } else {
        buscarDespesas(osId);
      }
      setValorDespesa("");
      setDescricaoDespesa("");
      setNumeroNota("");
      setFotoRecibo(null);
    } finally { setEnviandoDespesa(false); }
  }

  return {
    despesas,
    tipoDespesa, setTipoDespesa,
    valorDespesa, setValorDespesa,
    descricaoDespesa, setDescricaoDespesa,
    numeroNota, setNumeroNota,
    fotoRecibo, selecionarFotoRecibo,
    cobrarDoCliente, setCobrarDoCliente,
    enviandoDespesa,
    buscarDespesas, resetDespesas, lancarDespesa,
  };
}
