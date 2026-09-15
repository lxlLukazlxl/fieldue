import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";
import { Cliente } from "@/lib/osTypes";

const TIPOS_DESPESA_VALIDOS = ["PEDAGIO", "COMBUSTIVEL", "ALIMENTACAO", "HOSPEDAGEM", "ESTACIONAMENTO", "OUTRO"];

// Despesa avulsa: não depende de estar dentro de uma OS aberta. O técnico
// escolhe direto para qual cliente foi o gasto — pedágio, alimentação e
// outros custos de campo podem acontecer fora do horário de atendimento
// de uma OS específica.
export function useDespesaAvulsa() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo] = useState<string>("PEDAGIO");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [fotoRecibo, setFotoRecibo] = useState<string | null>(null);
  const [cobrarDoCliente, setCobrarDoCliente] = useState(true);
  const [enviando, setEnviando] = useState(false);

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

  function limpar() {
    setCliente(null);
    setTipo("PEDAGIO");
    setValor("");
    setDescricao("");
    setNumeroNota("");
    setFotoRecibo(null);
    setCobrarDoCliente(true);
  }

  async function enviar(tecnicoId?: number | null) {
    if (!cliente) return Alert.alert("Cliente", "Selecione o cliente relacionado a esta despesa.");
    if (!tecnicoId) return Alert.alert("Conta", "Seu usuário técnico não está vinculado a um técnico.");
    const valorNum = Number(valor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) return Alert.alert("Valor inválido", "Informe um valor maior que zero.");

    setEnviando(true);
    try {
      const body = {
        tecnico_id: tecnicoId,
        cliente_id: cliente.id,
        tipo,
        valor: valorNum,
        descricao: descricao || null,
        numero_nota: numeroNota || null,
        foto_recibo: fotoRecibo,
        cobrar_do_cliente: cobrarDoCliente,
      };
      const r = await fetch(`${API_URL}/despesas`, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body) });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) return Alert.alert("Erro", dados.erro || "Não foi possível registrar a despesa.");
      Alert.alert("Despesa registrada", "A despesa foi enviada para a gestão.");
      limpar();
    } catch {
      Alert.alert("Sem conexão", "Não foi possível enviar agora. Verifique sua internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return {
    cliente, setCliente,
    tipo, setTipo,
    valor, setValor,
    descricao, setDescricao,
    numeroNota, setNumeroNota,
    fotoRecibo, selecionarFotoRecibo,
    cobrarDoCliente, setCobrarDoCliente,
    enviando, enviar, limpar,
    TIPOS_DESPESA_VALIDOS,
  };
}
