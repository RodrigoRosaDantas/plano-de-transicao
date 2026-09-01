# 🧭 Plano de Transição — GitHub Pages

Versão independente do painel **Plano de Transição**, preparada para GitHub Pages.

## O que já está implementado

- Central “Agora” inspirada no produto Work, com missão, prioridades por dados, contador e relógio de Brasília.
- Workspace da Plataforma de Questões integrado ao Plano, com retomada local, estudo, revisão, desempenho e prova real.
- Desempenho por matéria, combinações e atividades, com filtros independentes para histórico, TDAS e EDAS.
- Jornada e marcos em mapa visual contínuo.
- Provas e resultados com separação entre aproveitamento, nota, classificação e etapa do certame.
- Financeiro completo com filtros, gráficos por ciclo/categoria, livro de lançamentos e exportação em CSV.
- Fontes e auditoria com cadeia de verdade explícita.
- Estratégia de carreira.
- Busca global.
- Tema claro/escuro.
- Layout responsivo para Android, iPhone, iPad e desktop.
- PWA instalável + service worker + uso offline.
- Busca global por matéria, concurso, marco e investimento.
- Cache local, exportação do snapshot em JSON e cartão social próprio.
- Sincronização segura do Notion via `NOTION_TOKEN` em GitHub Actions.

## Regra de governança

**Banco operacional → reconciliação/normalização → Registro Histórico → painel/resumo.**

O site lê `data/snapshot.json`. Esse arquivo é atualizado pelo workflow a partir dos bancos operacionais compartilhados com a integração do Notion e do Registro Histórico. Quando algum banco não está acessível à integração, a rotina preserva o último valor validado e registra a pendência em `meta.syncWarnings`, evitando derrubar o painel ou substituir dado válido por zero.

O arquivo `data/notion-live.json` mantém o espelho técnico e o diagnóstico de acesso das fontes consultadas. O token do Notion fica somente nos GitHub Actions Secrets e nunca é enviado ao navegador.

## Publicação

GitHub Pages publica a branch `main` a partir de `/ (root)`.

URL pública:

`https://rodrigorosadantas.github.io/plano-de-transicao/`

## Sincronização

- execução manual disponível em GitHub Actions;
- execução automática a cada 3 horas;
- alterações no sincronizador também disparam uma validação;
- commits automáticos de dados não criam loop de sincronização.

A Home e os textos narrativos são camadas de apresentação. Em divergências quantitativas, prevalece a cadeia de fonte operacional definida no Plano de Transição.
