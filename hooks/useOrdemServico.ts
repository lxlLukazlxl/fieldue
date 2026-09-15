import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

import { API_URL, apiHeaders } from "@/constants/api";
import { fetchComRetentativa } from "@/lib/httpRetry";
import { executarOuEnfileirar } from "@/lib/offlineQueue";
import { Horarios } from "@/lib/osTypes";

type Selecao = { tecnicoSel: any; clienteSel: any; gestorSel: any };

// Concentra tudo que gira em torno de UMA ordem de serviço em andamento:
// os dados dela (id, status, horários), a etapa do wizard (1 = escolher
// técnico/cliente/gestor, 2 = trabalhar na OS) e as ações de fluxo
// (criar, mudar status, almoço, finalizar). Fotos/relatório/assinatura
// também moram aqui porque só existem no contexto da OS atual.
export function useOrdemServico() {
  const [etapa, setEtapa] = useState(1);
  const [osId, setOsId] = useState<number | null>(null);
  const [statusOS, setStatusOS] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<Horarios>({});

  const [fotos, setFotos] = useState<string[]>([]);
  const [relatorio, setRelatorio] = useState("");
  const [nomeClienteFinal, setNomeClienteFinal] = useState("");
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);

  const [criandoOS, setCriandoOS] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoAlmoco, setCarregandoAlmoco] = useState(false);
  // Mostrado na tela durante uma nova tentativa automática (ex.: servidor
  // "acordando" no Render), pra o técnico entender que não travou.
  const [mensagemEnvio, setMensagemEnvio] = useState<string | null>(null);

  async function buscarHorarios(id: number) {
    try {
      const response = await fetch(`${API_URL}/servico/${id}`, { headers: apiHeaders() });
      const dados = await response.json();
      if (response.ok) {
        setHorarios({
          inicio_data: dados.inicio_data,
          almoco_inicio_data: dados.almoco_inicio_data,
          almoco_fim_data: dados.almoco_fim_data,
          fim_data: dados.fim_data,
        });
      }
    } catch (e) {
      // Não trava o fluxo do técnico se essa busca falhar — os horários
      // continuam sendo salvos no servidor mesmo sem aparecer na tela.
      console.warn("Não foi possível buscar os horários da OS:", e);
    }
  }

  // Reabre uma OS já existente (retomada a partir da lista "Minhas OS").
  // Retorna o id para quem chamou poder buscar materiais/despesas também.
  function abrirOS(os: any) {
    setOsId(os.id);
    setStatusOS(os.status);
    setFotos([]);
    buscarHorarios(os.id);
    setEtapa(2);
    return os.id as number;
  }

  const selecionarFotos = async (origem: "camera" | "galeria") => {
    if (fotos.length >= 10) {
      return Alert.alert("Limite de fotos", "Você pode enviar no máximo 10 fotos por OS.");
    }

    const options: ImagePicker.ImagePickerOptions = {
      quality: 0.35,
      base64: true,
      allowsMultipleSelection: origem === "galeria",
      selectionLimit: Math.max(1, 10 - fotos.length),
    };

    const result =
      origem === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      const novas = result.assets
        .map((a) => a.base64)
        .filter((b) => b) as string[];
      setFotos((prev) => [...prev, ...novas].slice(0, 10));
    }
  };

  function removerFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function criarOS({ tecnicoSel, clienteSel, gestorSel }: Selecao, aoCriar?: () => void) {
    if (!tecnicoSel || !clienteSel || !gestorSel) return Alert.alert("Aviso", "Preencha Técnico, Cliente e Gestor.");
    setCriandoOS(true);
    setMensagemEnvio(null);
    try {
      const response = await fetchComRetentativa(`${API_URL}/servico/criar`, {
        method: "POST", headers: apiHeaders(),
        body: JSON.stringify({ tecnico_id: tecnicoSel.id, cliente_id: clienteSel.id, gestor_id: gestorSel.id }),
      }, {
        aoTentarNovamente: () => setMensagemEnvio("Servidor demorando a responder — tentando de novo..."),
      });
      const dados = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(dados.erro || "Não foi possível criar a OS.");
      setOsId(Number(dados.id));
      setStatusOS(dados.status);
        setEtapa(2);
      aoCriar?.();
      Alert.alert("OS criada", `OS #${dados.id} criada e atribuída ao técnico.`);
    } catch (e: any) { Alert.alert("Erro", e.message || "Falha ao criar a OS. Confira sua conexão e tente novamente."); }
    finally { setCriandoOS(false); setMensagemEnvio(null); }
  }

  async function mudarStatus(status: string) {
    if (!osId) return;
    const r = await executarOuEnfileirar({
      descricao: `Mudar status da OS #${osId} para ${status}`,
      endpoint: `/servico/${osId}/status`,
      method: "POST",
      body: { status },
    });
    if (!r.ok) return Alert.alert("Erro", r.erro || "Não foi possível atualizar o status.");
    if (r.enfileirado) {
      // Sem conexão agora: atualiza a tela otimisticamente e reenvia sozinho depois.
      setStatusOS(status);
      Alert.alert("Sem conexão", "Status salvo no aparelho. Será enviado ao servidor assim que a internet voltar.");
      return;
    }
    setStatusOS(r.dados.status);
    buscarHorarios(osId);
  }

  async function iniciarAlmoco() {
    if (!osId) return;
    setCarregandoAlmoco(true);
    try {
      const r = await executarOuEnfileirar({
        descricao: `Iniciar almoço da OS #${osId}`,
        endpoint: `/servico/${osId}/almoco/iniciar`,
        method: "POST",
      });
      if (!r.ok) return Alert.alert("Erro", r.erro || "Não foi possível registrar o almoço.");
      setStatusOS("EM_ALMOCO");
      if (r.enfileirado) {
        Alert.alert("Sem conexão", "Início do almoço salvo no aparelho e será sincronizado depois.");
      } else {
        buscarHorarios(osId);
      }
    } finally { setCarregandoAlmoco(false); }
  }

  async function finalizarAlmoco() {
    if (!osId) return;
    setCarregandoAlmoco(true);
    try {
      const r = await executarOuEnfileirar({
        descricao: `Finalizar almoço da OS #${osId}`,
        endpoint: `/servico/${osId}/almoco/finalizar`,
        method: "POST",
      });
      if (!r.ok) return Alert.alert("Erro", r.erro || "Não foi possível registrar o retorno do almoço.");
      setStatusOS("EM_ATENDIMENTO");
      if (r.enfileirado) {
        Alert.alert("Sem conexão", "Retorno do almoço salvo no aparelho e será sincronizado depois.");
      } else {
        buscarHorarios(osId);
      }
    } finally { setCarregandoAlmoco(false); }
  }

  async function finalizar({ tecnicoSel, clienteSel, gestorSel }: Selecao, aoFinalizar?: () => void) {
    if (!osId || statusOS !== "EM_ATENDIMENTO") {
      return Alert.alert("OS não pronta", "Avance o fluxo até 'Em atendimento' antes de finalizar.");
    }
    if (fotos.length < 3)
      return Alert.alert("Fotos", "Adicione pelo menos 3 fotos do serviço.");
    if (!relatorio.trim())
      return Alert.alert("Relatório", "Descreva o serviço realizado antes de finalizar.");
    if (!assinaturaBase64 || !nomeClienteFinal)
      return Alert.alert(
        "Assinatura",
        "O nome e a assinatura de quem recebeu são obrigatórios.",
      );

    setCarregando(true);
    setMensagemEnvio(null);
    try {
      const response = await fetchComRetentativa(
        `${API_URL}/servico/finalizar`,
        {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({
            os_id: osId,
            tecnico_id: tecnicoSel.id,
            cliente_id: clienteSel.id,
            gestor_id: gestorSel.id,
            relatorio,
            fotos: JSON.stringify(fotos),
            cliente_nome_completo: nomeClienteFinal,
            cliente_assinatura: assinaturaBase64,
          }),
        },
        { aoTentarNovamente: () => setMensagemEnvio("Servidor demorando a responder — tentando de novo, não feche o app...") },
      );

      const dados = await response.json().catch(() => ({}));
      if (response.ok) {
        Alert.alert("Sucesso", `OS #${dados.id ?? osId} finalizada com sucesso!`);
        // Resetar os campos da OS, mas mantém o técnico selecionado — assim
        // ele já vê a lista atualizada e pode seguir pra próxima OS do dia
        // sem ter que escolher o nome de novo.
        setEtapa(1);
        setOsId(null);
        setStatusOS(null);
        setHorarios({});
        setFotos([]);
        setRelatorio("");
        setNomeClienteFinal("");
        setAssinaturaBase64(null);
            aoFinalizar?.();
      } else {
        Alert.alert("Erro", dados.erro || "O servidor recusou os dados.");
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível falar com o servidor depois de várias tentativas. Confira sua conexão — os dados preenchidos continuam na tela, você pode tentar 'Finalizar e Enviar' de novo.");
    } finally {
      setCarregando(false);
      setMensagemEnvio(null);
    }
  }

  return {
    etapa, setEtapa,
    osId, statusOS, horarios,
    fotos, selecionarFotos, removerFoto,
    relatorio, setRelatorio,
    nomeClienteFinal, setNomeClienteFinal,
    assinaturaBase64, setAssinaturaBase64,
    criandoOS, carregando, carregandoAlmoco, mensagemEnvio,
    buscarHorarios, abrirOS,
    criarOS, mudarStatus, iniciarAlmoco, finalizarAlmoco, finalizar,
  };
}
