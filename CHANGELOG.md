# Changelog

## 2.2.0
- Despesas do técnico com categorias de pedágio, hospedagem, almoço/alimentação, combustível, estacionamento, material e outros.
- Campo opcional para número da nota fiscal/recibo.
- Foto do comprovante/nota mantida na despesa.
- Almoço continua registrado pelo fluxo de início/retorno da OS.
- Materiais continuam podendo ser solicitados pelo técnico dentro da OS.

# Alterações desta rodada

## 0. App mobile migrado para login por usuário/token (backend V2.1)
- Novo fluxo de autenticação no app: tela de login (e-mail/senha), sessão
  salva no aparelho (`AsyncStorage`) e token enviado automaticamente em
  todas as chamadas à API (`Authorization: Bearer`) — sem precisar mexer
  em cada hook, um único lugar (`constants/api.ts`) anexa o token.
- Novos arquivos: `lib/authToken.ts` (token em memória), `lib/auth.ts`
  (login, persistência, validação da sessão salva), `hooks/useAuth.tsx`
  (contexto de autenticação) e `components/auth/LoginScreen.tsx`.
- `app/_layout.tsx` agora exibe a tela de login enquanto não há sessão, e
  só libera o app depois de autenticado.
- **Importante**: no backend V2.1, criar uma OS é permissão exclusiva de
  ADMIN/GESTOR. Por isso, um técnico logado no app não vê mais os
  seletores de técnico/cliente/gestor nem o botão de criar OS — só a lista
  de OS já atribuídas a ele, prontas para trabalhar. ADMIN/GESTOR
  continuam vendo a tela de criação normalmente.
- Se a conta do técnico não estiver vinculada a um `colaborador_id`, o app
  mostra um aviso pedindo para o gestor arrumar esse vínculo no painel,
  em vez de travar ou mostrar erro genérico.
- Botão de sair (logout) adicionado na barra superior do app.
- **Painel web (`gestao.html`)**: nova aba "Usuários" para criar/editar os
  logins usados pelo app (nome, e-mail, senha, perfil ADMIN/GESTOR/TECNICO
  e o vínculo com o cadastro de técnico correspondente). Sem essa tela não
  havia como criar o primeiro login de um técnico pela interface — só via
  requisição manual à API.

## -1. Limpeza de nome antigo + visual renovado
- Removidos os últimos resquícios do nome antigo do projeto: a chave de
  armazenamento local do app (`@sm_sistema/...` → `@fielduo/...`) e o texto
  A identidade visual do painel web (`gestao.html`) foi padronizada para "FIELDUO".
- **App mobile**: nova paleta com gradientes (marca, botões principais, de
  fluxo, de almoço, de assinatura), cantos mais arredondados, sombras mais
  suaves/profundas nos cards, cartão de OS com uma faixa lateral colorida
  de acordo com o status, e uma tela de login com um visual mais elaborado
  (mancha decorativa, campos com ícone, botão em gradiente). Nova
  dependência: `expo-linear-gradient`.
- **Painel web**: fundo com um leve gradiente radial, barra lateral em
  degradê (navy → ink), cards e cartões de estatística com sombra mais
  suave e leve elevação ao passar o mouse, cada estatística do dashboard
  com uma faixa colorida no topo, botões com sombra/gradiente e cantos
  mais arredondados.

## 1. Modo offline no app do técnico
- Novo arquivo `lib/offlineQueue.ts`: fila de ações pendentes salva no
  celular (`AsyncStorage`), com sincronização automática ao reconectar
  (`NetInfo`) e a cada 60s como reforço.
- Ações que agora funcionam offline: mudar status da OS, iniciar/finalizar
  almoço, solicitar material, lançar despesa. A tela já atualiza
  otimisticamente e reenvia ao servidor quando a internet voltar.
- Banner amarelo no topo do app mostra "sem conexão" e quantas ações estão
  pendentes, com botão pra forçar sincronização manual.
- **O que continua exigindo conexão na hora**: criar a OS, tirar fotos e
  finalizar com assinatura — são payloads grandes (fotos/assinatura) e não
  compensa arriscar perder no celular.
- **Instalar as novas dependências** antes de rodar o app:
  ```
  npm install
  ```
  (adicionei `@react-native-async-storage/async-storage` e
  `@react-native-community/netinfo` ao `package.json`)

## 2. Materiais (catálogo + solicitação pelo técnico)
- Painel de gestão: aba "Cadastros" agora tem a opção "Material", com
  nome, unidade, preço e estoque (opcional).
- App do técnico: nova sub-aba "📦 Materiais" dentro da OS — o técnico
  escolhe o material do catálogo e a quantidade, e a solicitação fica
  registrada na OS (funciona offline também).
- Novas tabelas: `materiais`, `servico_materiais`.
- Novas rotas: `GET/POST/PUT/DELETE /materiais` e `/gestao/materiais`,
  `POST/GET /servico/:id/materiais`.

## 3. Despesas do técnico ("notinhas": pedágio, hospedagem, etc.)
- App do técnico: nova sub-aba "🧾 Despesas" dentro da OS — o técnico
  escolhe o tipo (pedágio, hospedagem, material comprado fora, alimentação,
  outro), o valor, uma descrição opcional, e pode anexar foto do recibo.
  Tem um marcador "cobrar do cliente" (ligado por padrão).
- Painel de gestão: o relatório impresso de cada OS agora mostra a lista de
  materiais solicitados e despesas lançadas, com o **total a cobrar do
  cliente** somado automaticamente (materiais + despesas marcadas para
  cobrança).
- Nova tabela: `despesas`. Nova rota: `POST/GET /servico/:id/despesas`,
  `GET /gestao/despesas` (visão geral pra gestão).

## Migração do banco
Todas as tabelas novas são criadas automaticamente pelo servidor na
próxima vez que ele subir (`npm start`) — não precisa rodar nada manual.
Se preferir, o `schema.sql` também foi atualizado e pode ser rodado à mão.
