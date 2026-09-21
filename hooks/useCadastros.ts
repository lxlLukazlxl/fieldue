import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";
import { Cliente, Gestor, Material, Tecnico, Veiculo } from "@/lib/osTypes";

// Carrega os cadastros básicos (técnicos, clientes, gestores, materiais e
// veículos) usados nos seletores da tela de OS. Isolado num hook próprio
// porque essa busca não tem nenhuma relação com o fluxo da OS em si — é só
// "dados de apoio" que o formulário consome.
export function useCadastros() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  async function carregarDados(mostrarFeedback = false) {
    setCarregandoDados(true);
    try {
      const [resT, resC, resG, resM, resV] = await Promise.all([
        fetch(`${API_URL}/colaboradores`, { headers: apiHeaders() }),
        fetch(`${API_URL}/clientes`, { headers: apiHeaders() }),
        fetch(`${API_URL}/gestores`, { headers: apiHeaders() }),
        fetch(`${API_URL}/materiais`, { headers: apiHeaders() }),
        fetch(`${API_URL}/veiculos`, { headers: apiHeaders() }),
      ]);
      if (!resT.ok || !resC.ok || !resG.ok) throw new Error("Falha na API");
      setTecnicos(await resT.json());
      setClientes(await resC.json());
      setGestores(await resG.json());
      setMateriais(resM.ok ? await resM.json() : []);
      setVeiculos(resV.ok ? await resV.json() : []);
      if (mostrarFeedback) Alert.alert("Atualizado", "Técnicos, clientes, gestores, materiais e veículos foram sincronizados.");
    } catch (e) {
      Alert.alert("Erro de Conexão", "Não foi possível ligar ao servidor. Confira o endereço da API e se o servidor está ligado.");
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  return { tecnicos, clientes, gestores, materiais, veiculos, carregandoDados, carregarDados };
}
