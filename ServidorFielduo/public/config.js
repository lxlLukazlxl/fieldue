// Configuração do painel web Fielduo.
//
// Deixamos em branco de propósito: como o próprio servidor (server.js)
// agora serve este arquivo, uma URL relativa já aponta pro lugar certo —
// funciona tanto em http://localhost:3000/gestao.html quanto na URL
// pública do Render, sem precisar editar nada ao trocar de ambiente.
const API_BASE = "";

// V2 está migrando de API Key compartilhada para autenticação por usuário/token.
// Não coloque segredos neste arquivo: ele é enviado ao navegador.
function apiHeaders(extra) {
  return Object.assign(
    { "Content-Type": "application/json" },
    extra || {},
  );
}
