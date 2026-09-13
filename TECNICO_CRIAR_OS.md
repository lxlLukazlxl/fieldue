# Técnico criando Ordem de Serviço

Nesta versão, usuários com perfil `TECNICO` também podem criar OS pelo aplicativo.

- O técnico não escolhe outro técnico: o backend usa automaticamente o `colaborador_id` vinculado ao usuário autenticado.
- O técnico seleciona o cliente e o gestor/requestor no aplicativo.
- A empresa é sempre definida pelo JWT, evitando criação de OS em outra empresa.
- A mesma regra de acesso continua valendo para atendimento, materiais, despesas e finalização.

O cadastro de clientes/gestores continua sendo responsabilidade do painel de gestão nesta etapa.
