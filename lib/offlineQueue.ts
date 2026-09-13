// Modo offline do app do técnico.
//
// Ideia central: toda ação que fala com o servidor (mudar status, registrar
// almoço, solicitar material, lançar despesa, enviar GPS) passa por
// `executarOuEnfileirar`. Se der pra falar com o servidor agora, fala. Se
// não der (sem sinal, erro de rede), a ação fica guardada no celular e é
// reenviada automaticamente assim que a conexão voltar.
//
// O que NÃO fica na fila offline: criar a OS, tirar fotos e finalizar a OS
// com assinatura — esses continuam exigindo conexão na hora, porque
// envolvem arquivos grandes (fotos/assinatura) e fecham o fluxo inteiro;
// colocar isso na fila arriscaria perder trabalho do dia por um payload
// grande demais para o armazenamento local do celular.

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

import { API_URL, apiHeaders } from "@/constants/api";

const CHAVE_FILA = "@fielduo/fila_offline_v1";

export type AcaoOffline = {
  id: string;
  criadoEm: number;
  descricao: string; // texto amigável pra mostrar na lista de pendências
  endpoint: string; // caminho relativo, ex: "/servico/5/status"
  method: "POST" | "PATCH" | "DELETE";
  body?: any;
};

async function lerFila(): Promise<AcaoOffline[]> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_FILA);
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

async function salvarFila(fila: AcaoOffline[]) {
  await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Tenta executar a ação agora. Se conseguir falar com o servidor (mesmo que
// o servidor recuse com um erro de validação), resolve normalmente. Só cai
// na fila offline quando o `fetch` falha por problema de rede/conexão.
export async function executarOuEnfileirar(
  acao: Omit<AcaoOffline, "id" | "criadoEm">,
): Promise<{ ok: boolean; enfileirado: boolean; dados?: any; erro?: string }> {
  try {
    const response = await fetch(`${API_URL}${acao.endpoint}`, {
      method: acao.method,
      headers: apiHeaders(),
      body: acao.body ? JSON.stringify(acao.body) : undefined,
    });
    const dados = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, enfileirado: false, erro: dados.erro || `Erro HTTP ${response.status}` };
    }
    return { ok: true, enfileirado: false, dados };
  } catch (e) {
    // Falha de rede (não é o servidor recusando, é impossível alcançá-lo):
    // guarda pra tentar de novo mais tarde.
    const fila = await lerFila();
    fila.push({ ...acao, id: gerarId(), criadoEm: Date.now() });
    await salvarFila(fila);
    return { ok: true, enfileirado: true };
  }
}

// Percorre a fila em ordem e tenta reenviar cada ação. Para no primeiro erro
// de rede (provavelmente ainda offline) para não embaralhar a ordem: uma
// mudança de status feita fora de ordem pode ser rejeitada pelo servidor.
// Erros de validação do servidor (ex: OS já finalizada) descartam o item —
// reenviar o mesmo payload nunca vai funcionar.
export async function processarFila(
  onProgresso?: (restantes: number) => void,
): Promise<{ processadas: number; falharam: number }> {
  let fila = await lerFila();
  let processadas = 0;
  let falharam = 0;

  while (fila.length > 0) {
    const acao = fila[0];
    try {
      const response = await fetch(`${API_URL}${acao.endpoint}`, {
        method: acao.method,
        headers: apiHeaders(),
        body: acao.body ? JSON.stringify(acao.body) : undefined,
      });
      if (!response.ok) {
        // Servidor respondeu recusando — não adianta insistir com o mesmo
        // payload. Descarta e segue para a próxima.
        falharam++;
      } else {
        processadas++;
      }
      fila = fila.slice(1);
      await salvarFila(fila);
      onProgresso?.(fila.length);
    } catch {
      // Sem conexão ainda — para por aqui e tenta de novo na próxima chamada.
      break;
    }
  }

  return { processadas, falharam };
}

export async function contarPendentes(): Promise<number> {
  const fila = await lerFila();
  return fila.length;
}

export async function listarPendentes(): Promise<AcaoOffline[]> {
  return lerFila();
}

// Hook: expõe se o app está online e mantém a fila sincronizando sozinha
// sempre que a conexão volta. Também tenta uma sincronização a cada 60s
// como rede de segurança, caso o evento de reconexão não dispare.
export function useSincronizacaoOffline() {
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  async function atualizarContagem() {
    setPendentes(await contarPendentes());
  }

  async function sincronizarAgora() {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      await processarFila(() => atualizarContagem());
    } finally {
      setSincronizando(false);
      atualizarContagem();
    }
  }

  useEffect(() => {
    atualizarContagem();

    const unsubscribe = NetInfo.addEventListener((estado) => {
      const estaOnline = Boolean(estado.isConnected && estado.isInternetReachable !== false);
      setOnline(estaOnline);
      if (estaOnline) sincronizarAgora();
    });

    const intervalo = setInterval(sincronizarAgora, 60000);

    return () => {
      unsubscribe();
      clearInterval(intervalo);
    };
  }, []);

  return { online, pendentes, sincronizando, sincronizarAgora };
}
