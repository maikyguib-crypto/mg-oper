# MG Oper — desenvolvimento isolado

Base: `maikyguib-crypto-patch-6` (`9f1575532ccea4467ce541568e1318e9034843fb`).

## Realtime

O cliente assina alterações das tabelas `tasks`, `production_logs`, `production_sessions`, `company_members` e `sectors`, filtradas por `company_id`. A assinatura requer que essas tabelas estejam incluídas na publicação `supabase_realtime` e que as políticas RLS permitam leitura apenas aos integrantes da empresa. Revise o estado da publicação e as políticas no painel Supabase antes de ativar. Não alteramos o banco automaticamente. A aplicação mantém consulta a cada 15 segundos, atualização ao voltar à aba e após ações, mesmo se Realtime não estiver disponível. `task_members` é atualizado pelo fallback, pois o vínculo não possui `company_id` no código atual.

## Convites e acesso

O convite por link usa o código único já existente em `company_invites`. Criar, revogar e consumir convite dependem das políticas RLS atuais. O código é removido da URL após ser lido. A interface limita ações de gestão a proprietário e administrador e mostra ao funcionário as tarefas e indicadores vinculados a ele. **Confirme as políticas RLS de `company_users`, `company_invites`, `tasks`, `task_members`, `production_logs` e `production_sessions` antes de liberar a interface**, pois controles visuais sozinhos não impedem chamadas diretas à API. O fluxo de consumir convite faz duas operações separadas (criar vínculo e marcar código como usado); concorrência e falhas entre elas exigem uma função transacional no banco em uma evolução futura.

## PWA

O manifesto e os ícones permitem instalar em navegadores compatíveis. O service worker só armazena assets estáticos; páginas autenticadas, API e dados de produção sempre usam a rede. Não há operação offline sobre dados de produção.

## Verificação antes de produção

1. Testar login e perfil de proprietário, administrador e funcionário em contas reais distintas.
2. Criar um convite, abrir o link no celular, cadastrar ou entrar, aceitar, tentar usá-lo uma segunda vez e revogar outro convite.
3. Com dois dispositivos conectados, registrar produção e verificar atualização imediata; desativar Realtime e confirmar atualização por consulta periódica.
4. Conferir programação, iniciar, adicionar quantidade, concluir, histórico, desempenho, impressão, TV, edição e permissões visuais.
5. Instalar em iPhone/iPad (Adicionar à Tela de Início), Android e computador; validar que dados não aparecem sem conexão.
6. Conferir build e preview separados da produção antes de qualquer promoção.
