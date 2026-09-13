import { useState } from "react";
import { Alert } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";
import { executarOuEnfileirar } from "@/lib/offlineQueue";
import { Material, MaterialSolicitado } from "@/lib/osTypes";

export function useMateriaisOS() {
  const [materiaisSolicitados, setMateriaisSolicitados] = useState<MaterialSolicitado[]>([]);
  const [materialSel, setMaterialSel] = useState<Material | null>(null);
  const [quantidadeMaterial, setQuantidadeMaterial] = useState("1");
  const [modalMaterial, setModalMaterial] = useState(false);
  const [enviandoMaterial, setEnviandoMaterial] = useState(false);

  async function buscarMateriaisSolicitados(id: number) {
    try {
      const response = await fetch(`${API_URL}/servico/${id}/materiais`, { headers: apiHeaders() });
      if (response.ok) setMateriaisSolicitados(await response.json());
    } catch (e) {
      console.warn("Não foi possível buscar os materiais solicitados:", e);
    }
  }

  function resetMateriaisSolicitados() {
    setMateriaisSolicitados([]);
  }

  async function solicitarMaterial(osId: number | null) {
    if (!osId || !materialSel) return Alert.alert("Aviso", "Selecione um material.");
    const qtd = Number(quantidadeMaterial.replace(",", "."));
    if (!Number.isFinite(qtd) || qtd <= 0) return Alert.alert("Quantidade inválida", "Informe uma quantidade maior que zero.");

    setEnviandoMaterial(true);
    try {
      const r = await executarOuEnfileirar({
        descricao: `Solicitar ${qtd} ${materialSel.unidade} de ${materialSel.nome} na OS #${osId}`,
        endpoint: `/servico/${osId}/materiais`,
        method: "POST",
        body: { material_id: materialSel.id, quantidade: qtd },
      });
      if (!r.ok) return Alert.alert("Erro", r.erro || "Não foi possível solicitar o material.");

      if (r.enfileirado) {
        // Mostra na lista local mesmo sem confirmação do servidor ainda.
        setMateriaisSolicitados((prev) => [
          { id: `local-${Date.now()}`, material_nome: materialSel.nome, unidade: materialSel.unidade, quantidade: qtd, pendente: true },
          ...prev,
        ]);
        Alert.alert("Sem conexão", "Solicitação salva no aparelho e será enviada quando a internet voltar.");
      } else {
        buscarMateriaisSolicitados(osId);
      }
      setMaterialSel(null);
      setQuantidadeMaterial("1");
    } finally { setEnviandoMaterial(false); }
  }

  return {
    materiaisSolicitados,
    materialSel, setMaterialSel,
    quantidadeMaterial, setQuantidadeMaterial,
    modalMaterial, setModalMaterial,
    enviandoMaterial,
    buscarMateriaisSolicitados, resetMateriaisSolicitados, solicitarMaterial,
  };
}
