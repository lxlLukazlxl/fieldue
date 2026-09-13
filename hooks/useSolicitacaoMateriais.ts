import { useState } from "react";
import { Alert } from "react-native";
import { API_URL, apiHeaders } from "@/constants/api";
import { Cliente, Material } from "@/lib/osTypes";

export type ItemSolicitacao = { material: Material; quantidade: string };

export function useSolicitacaoMateriais() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [itens, setItens] = useState<ItemSolicitacao[]>([]);
  const [enviando, setEnviando] = useState(false);

  function adicionarItem() {
    if (!material) return Alert.alert("Material", "Selecione um material.");
    const qtd = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(qtd) || qtd <= 0) return Alert.alert("Quantidade inválida", "Informe uma quantidade maior que zero.");
    setItens(prev => {
      const idx = prev.findIndex(x => x.material.id === material.id);
      if (idx >= 0) return prev.map((x,i) => i === idx ? {...x, quantidade: String(Number(x.quantidade.replace(",","."))+qtd)} : x);
      return [...prev, { material, quantidade: String(qtd) }];
    });
    setMaterial(null); setQuantidade("1");
  }
  function removerItem(id:number) { setItens(prev => prev.filter(x => x.material.id !== id)); }
  function limpar() { setCliente(null); setMaterial(null); setQuantidade("1"); setItens([]); }
  async function enviar(tecnicoId?: number | null) {
    if (!cliente) return Alert.alert("Cliente", "Selecione o cliente.");
    if (!itens.length) return Alert.alert("Materiais", "Adicione pelo menos um material.");
    if (!tecnicoId) return Alert.alert("Conta", "Seu usuário técnico não está vinculado a um técnico.");
    setEnviando(true);
    try {
      const body = { tecnico_id: tecnicoId, cliente_id: cliente.id, itens: itens.map(x => ({ material_id: x.material.id, quantidade: Number(x.quantidade.replace(",",".")) })) };
      const r = await fetch(`${API_URL}/materiais/solicitacoes`, { method:"POST", headers:apiHeaders(), body:JSON.stringify(body) });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) return Alert.alert("Erro", data.erro || "Não foi possível enviar a solicitação.");
      Alert.alert("Solicitação enviada", "O pedido de material foi enviado para a gestão.");
      limpar();
    } catch { Alert.alert("Sem conexão", "Não foi possível enviar agora. Verifique sua internet e tente novamente."); }
    finally { setEnviando(false); }
  }
  return { cliente,setCliente,material,setMaterial,quantidade,setQuantidade,itens,adicionarItem,removerItem,enviar,enviando,limpar };
}
