// Guarda o token JWT atual em memória, para que `apiHeaders()` (usado por
// todos os hooks que já existem) consiga anexar o `Authorization: Bearer`
// automaticamente, sem precisar passar o token por todas as chamadas.
// Fica num arquivo isolado (sem importar nada de constants/api.ts) só para
// não criar import circular com quem lê o token.
let tokenAtual: string | null = null;

export function getToken(): string | null {
  return tokenAtual;
}

export function setToken(token: string | null) {
  tokenAtual = token;
}
