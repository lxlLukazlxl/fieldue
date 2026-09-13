import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_URL } from "@/constants/api";
import { getToken, setToken } from "@/lib/authToken";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  perfil: "ADMIN" | "GESTOR" | "TECNICO";
  colaborador_id: number | null;
  empresa_id: number;
  empresa_nome?: string;
};

export type AuthData = { token: string; usuario: Usuario };

const CHAVE_STORAGE = "@fielduo/auth_v1";

export { getToken };

// Lê a sessão salva no aparelho (se existir) e já deixa o token disponível
// pra `apiHeaders()` usar imediatamente — antes mesmo de validar com o
// servidor, pra evitar uma janela sem token nas primeiras chamadas.
export async function carregarAuthSalvo(): Promise<AuthData | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    const dados: AuthData = JSON.parse(bruto);
    setToken(dados.token);
    return dados;
  } catch {
    return null;
  }
}

async function salvarAuthLocal(dados: AuthData) {
  setToken(dados.token);
  await AsyncStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
}

export async function limparAuthSalvo() {
  setToken(null);
  await AsyncStorage.removeItem(CHAVE_STORAGE);
}

export async function login(email: string, senha: string): Promise<AuthData> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), senha }),
  });
  const dados = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(dados.erro || "Não foi possível entrar. Confira o e-mail e a senha.");
  }
  const auth: AuthData = { token: dados.token, usuario: dados.usuario };
  await salvarAuthLocal(auth);
  return auth;
}

// Confirma que um token salvo ainda é válido e busca os dados atuais do
// usuário (perfil, empresa, colaborador_id podem ter mudado no servidor).
export async function buscarUsuarioAtual(token: string): Promise<Usuario | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const dados = await response.json();
    return dados.usuario ?? null;
  } catch {
    return null;
  }
}
