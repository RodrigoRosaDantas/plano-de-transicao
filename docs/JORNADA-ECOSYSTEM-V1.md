# Jornada ↔ Central de Estudos — integração P1–P3

## Responsabilidades

- **Jornada** é o painel estratégico longitudinal e continua mantendo seu snapshot e seus fluxos Notion independentes.
- **Central de Estudos** é o ponto de entrada operacional para escolher um ambiente ativo P1–P3 e iniciar uma sessão.
- SEEDF, TJDFT, TCE-GO e PRF Administrativo permanecem projetos independentes, com seus próprios repositórios, dados e rotinas de publicação.
- A Plataforma de Questões continua transversal. SEDES/DF continua preservado no espaço histórico e não recebe código de prioridade ativa.

## Leitura pública

1. A aba Jornada baixa o registry público `central-estudos/config/projects.json`.
2. Valida schema v3, códigos P1–P3 distintos nos projetos ativos e cada `statusUrl` HTTPS do mesmo site. Projetos arquivados, como TCE-GO, são exibidos como histórico e não têm contrato consultado.
3. Lê cada contrato v1 por GET sem credenciais e confirma schema, identidade, estado e proveniência.
4. Mostra fase, ciclo, unidade publicada quando houver, próxima ação com o tipo informado, estado da publicação e datas de proveniência.
5. Não acessa ou exibe o campo privado `study`, não consulta Notion/Supabase e não grava estado no backend.

Contratos sem resposta, inválidos e com publicação de pelo menos dois dias de calendário atrás em Brasília são apresentados com estados distintos. A Jornada preserva o link de cada projeto e o link para a Central mesmo quando o catálogo ou um contrato falha. A ausência de unidade ou próxima ação é rotulada explicitamente e nunca convertida em zero.

## Checks de release

- Teste estático verifica o contrato de leitura, privacidade, proveniência e assets offline.
- Teste Playwright verifica ordenação P1–P3, ação operacional e planejada, unidade ausente, contrato antigo, incompatibilidade, indisponibilidade, atualização manual e layout mobile.
- A suíte de qualidade roda em pull request. GitHub Pages publica a partir de `main`.
