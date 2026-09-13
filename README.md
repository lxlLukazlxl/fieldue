> Fielduo V2 — gestão de ordens de serviço e equipes em campo.

# Fielduo

Sistema de ordens de serviço com aplicativo Expo/React Native, API Node.js/Express e painel web.

## Decisão de arquitetura

Este projeto **não utiliza Firebase** e não depende de serviços pagos para funcionar.

- Banco: MySQL local ou servidor próprio.
- Fotos: armazenamento em disco no próprio servidor (`ServidorFielduo/uploads`).
- API: Node.js + Express.
- App: Expo/React Native.
- Mapa: OpenStreetMap + Leaflet no painel.

Isso mantém o projeto com custo de infraestrutura zero enquanto ele estiver rodando em um computador/servidor próprio.

## Estrutura

```text
Fielduo/
├── app/                  # aplicativo Expo
├── constants/            # configuração da API
├── ServidorFielduo/
│   ├── server.js         # API
│   ├── gestao.html       # painel de gestão
│   ├── index.html        # mapa de rastreamento
│   ├── config.js         # endereço da API do painel
│   └── uploads/          # fotos recebidas pelas OS
└── .env.example
```

## 1. Configurar o servidor

Entre em `ServidorFielduo` e crie um `.env` baseado em `.env.example`.

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fielduo
PORT=3000
API_KEY=uma-chave-grande-e-aleatoria
```

Depois:

```bash
npm install
node server.js
```

Na primeira inicialização a API verifica/cria as tabelas básicas necessárias.

## 2. Configurar o aplicativo

Na raiz, crie `.env` baseado em `.env.example`:

```env
EXPO_PUBLIC_API_URL=http://IP_DO_SERVIDOR:3000
```

Depois:

```bash
npm install
npx expo start
```

## 3. Painel web

Ajuste `ServidorFielduo/config.js` para apontar para o mesmo IP do servidor e abra:

- `gestao.html` para gestão de OS e cadastros.
- `index.html` para monitoramento do mapa.

## O que foi melhorado nesta versão

- API com pool de conexões MySQL.
- Health check em `/health`.
- Inicialização automática das tabelas básicas quando inexistentes.
- Validação de IDs, coordenadas e campos obrigatórios.
- Limite de payload reduzido para evitar requisições gigantes.
- Fotos deixam de ficar armazenadas em Base64 dentro do MySQL: a API grava os arquivos em `uploads/` e salva somente os caminhos na OS.
- Compatibilidade mantida com fotos antigas em Base64.
- Dashboard com totais de OS, técnicos, clientes e gestores.
- Histórico pesquisável de OS.
- Painel de cadastros com tratamento de erros.
- Tela de status no aplicativo.
- Remoção das telas de exemplo do template Expo.
- Botão de envio da OS com estado de processamento para evitar envio duplicado.
- Limite de 10 fotos por OS e mínimo de 3 fotos.

## Próxima etapa recomendada

Depois de validar esta versão no seu computador, a próxima grande etapa é implementar o **fluxo de OS** (aberta → atribuída → deslocamento → atendimento → finalizada) sem Firebase e, em seguida, autenticação simples para separar técnico e gestor.

## v1.2.0 — Fluxo de Ordem de Serviço
- Fluxo: ATRIBUIDA → ACEITA → EM_DESLOCAMENTO → NO_LOCAL → EM_ATENDIMENTO → FINALIZADA.
- Histórico de status com data/hora.
- Criação da OS antes da execução.
- Finalização vinculada à OS e bloqueada fora de EM_ATENDIMENTO.
- Rastreamento GPS pode registrar a OS atual.
- Sem Firebase e sem serviços pagos.
