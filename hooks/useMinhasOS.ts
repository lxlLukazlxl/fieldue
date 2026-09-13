import { useEffect, useState } from "react";

import { API_URL, apiHeaders } from "@/constants/api";

// Sempre que o técnico é selecionado (ou trocado) na tela inicial, busca as
// OS que já estão em aberto pra ele — assim dá pra retomar uma OS já criada
// sem precisar recriar do zero.
export function useMinhasOS(tecnicoId: number | null | undefined) {
  const [minhasOS, setMinhasOS] = useState<any[]>([]);
  const [carregandoMinhasOS, setCarregandoMinhasOS] = useState(false);

  async function buscarMinhasOS(id: number) {
    setCarregandoMinhasOS(true);
    try {
      const response = await fetch(`${API_URL}/servico?tecnico_id=${id}`, { headers: apiHeaders() });
      const dados = await response.json();
      if (response.ok) {
        setMinhasOS(dados.filter((o: any) => !["FINALIZADA", "CANCELADA"].includes(o.status)));
      }
    } catch (e) {
      console.warn("Não foi possível buscar as OS do técnico:", e);
    } finally {
      setCarregandoMinhasOS(false);
    }
  }

  useEffect(() => {
    if (tecnicoId) {
      buscarMinhasOS(tecnicoId);
    } else {
      setMinhasOS([]);
    }
  }, [tecnicoId]);

  return { minhasOS, carregandoMinhasOS, buscarMinhasOS };
}
