# Fielduo — revisão do fluxo do técnico

## Permissões

O técnico pode:
- criar OS para si, escolhendo apenas cliente e gestor já cadastrados;
- aceitar, iniciar deslocamento, marcar chegada e iniciar atendimento;
- iniciar/finalizar almoço;
- lançar despesas somente quando houver gasto;
- anexar número e foto de nota/recibo;
- solicitar materiais;
- tirar fotos do serviço;
- preencher relatório e coletar assinatura;
- finalizar a própria OS;
- enviar localização somente vinculada ao próprio técnico e à própria OS.

O técnico não pode cadastrar/editar/excluir clientes, gestores ou outros técnicos. Essas funções ficam para ADMIN/GESTOR.

## Rastreamento

O rastreamento agora usa `expo-location` + `expo-task-manager` com `startLocationUpdatesAsync`, mantendo o envio durante deslocamento, chegada, atendimento e almoço. A configuração nativa habilita background location/foreground service.

**Importante:** background location no Android não deve ser validado pelo Expo Go; é necessário um development build. A documentação do Expo SDK 57 informa que o background location exige permissões de foreground + background e que as APIs de background devem ser usadas em build nativa.

## Segurança

- `/servico/:id`, materiais e despesas exigem JWT e respeitam a empresa/tecnico autenticado.
- `/pontos` ignora `tecnico_id` enviado por um técnico e usa o colaborador vinculado ao JWT.
- GPS só é aceito para uma OS pertencente ao técnico e não aceita OS encerrada.
- técnico não pode cancelar OS.
