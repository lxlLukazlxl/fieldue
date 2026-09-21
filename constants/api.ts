// Configuração central da API.
//
// Os valores vêm de variáveis de ambiente EXPO_PUBLIC_* (lidas de um
// arquivo .env na raiz do projeto — veja .env.example). Assim você não
// precisa mais editar o código toda vez que o IP do servidor mudar.
//
// Para rodar localmente, crie um arquivo ".env" (copiando o
// ".env.example") com algo como:
//   EXPO_PUBLIC_API_URL=http://192.168.3.11:3000
//   A autenticação da V2 será feita por usuário/token; não coloque segredos aqui.

import { getToken } from "@/lib/authToken";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://fielduo.onrender.com";

export const API_KEY = "";

// Helper para montar os headers padrão. Quando há uma sessão logada, manda
// o token JWT (`Authorization: Bearer`) — é o que o backend V2 exige na
// maioria das rotas. A API_KEY antiga fica só como compatibilidade, para
// quando ainda não há ninguém logado.
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (API_KEY) headers["x-api-key"] = API_KEY;
  return { ...headers, ...extra };
}
