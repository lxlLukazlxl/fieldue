# Fielduo V2.1 — backend

Esta versão usa o backend atual do Fielduo como base e prepara a API para evolução comercial.

## O que foi corrigido

- Criação automática do banco `fielduo` em MySQL local.
- Conexão SSL preservada para bancos remotos como Aiven.
- Migração automática das tabelas existentes para `empresa_id`.
- Isolamento de dados por empresa nas consultas e alterações.
- Autenticação JWT com `scrypt` usando apenas APIs nativas do Node.
- Login em `POST /auth/login`.
- Sessão em `GET /auth/me`.
- Cadastro/gestão de usuários em `/auth/usuarios`.
- Perfis `ADMIN`, `GESTOR` e `TECNICO`.
- Vinculação opcional do usuário técnico a `colaborador_id`.
- Compatibilidade temporária com `x-api-key`.
- Modo de desenvolvimento sem login (`ALLOW_DEV_NO_AUTH=true`) para não quebrar o app enquanto a tela de login é migrada.
- Em produção, o servidor exige autenticação JWT.
- Validação de acesso do técnico às próprias OS.
- Validação de empresa em clientes, técnicos, gestores, materiais, OS, GPS, despesas e histórico.
- Upload de fotos com limite de 5 MB.
- Tratamento de rota inexistente.

## Primeiro uso local

1. Copie `.env.example` para `.env`.
2. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`.
3. Para MySQL local use `DB_SSL=false` e `DB_AUTO_CREATE=true`.
4. Gere um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
5. Opcionalmente preencha `ADMIN_EMAIL` e `ADMIN_PASSWORD` para criar o primeiro administrador.
6. Rode:

```powershell
npm install
npm start
```

O backend criará o banco `fielduo` e as tabelas automaticamente quando `DB_AUTO_CREATE=true` ou quando o host for `localhost`/`127.0.0.1`.

## MySQL remoto / Aiven

Use `DB_AUTO_CREATE=false`, `DB_SSL=true` e configure `DB_CA_PATH` para o certificado CA do provedor. Não publique `.env` nem o certificado em repositórios públicos.

## API de autenticação

### Login

`POST /auth/login`

```json
{
  "email": "admin@fielduo.local",
  "senha": "sua-senha"
}
```

Resposta contém `token` Bearer.

### Requisições autenticadas

```text
Authorization: Bearer SEU_TOKEN
```

### Compatibilidade temporária

A API ainda aceita `x-api-key` se `API_KEY` estiver configurada. Essa compatibilidade deve ser removida depois que mobile e painel web estiverem usando JWT.

## Importante

O `.env` local não deve ser enviado junto do projeto. O ZIP distribuível deve conter apenas `.env.example`.
