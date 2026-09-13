// Configuração do painel web Fielduo.
// Em produção, defina FIELDUO_API_BASE no ambiente de hospedagem ou
// substitua API_BASE por uma URL pública da sua API.
const API_BASE = "http://localhost:3000";

// V2 está migrando de API Key compartilhada para autenticação por usuário/token.
// Não coloque segredos neste arquivo: ele é enviado ao navegador.
function apiHeaders(extra) {
  return Object.assign(
    { "Content-Type": "application/json" },
    extra || {},
  );
}
