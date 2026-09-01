# 🧭 Plano de Transição — GitHub Pages

Versão independente do painel **Plano de Transição**, preparada para GitHub Pages.

## O que já está implementado

- Central “Agora” gerencial, com missão, prioridades por dados, contador e relógio de Brasília.
- Plano focado em decisão e acompanhamento; a execução de questões permanece fora deste site.
- Central de operações com atualização visível, estado do snapshot, sincronização segura e PWA.
- Desempenho por matéria, combinações e atividades, com filtros independentes para histórico, TDAS e EDAS.
- Jornada e marcos em mapa visual contínuo.
- Provas e resultados com separação entre aproveitamento, nota, classificação e etapa do certame.
- Financeiro completo com filtros, gráficos por ciclo/categoria, livro de lançamentos e exportação em CSV.
- Fontes e auditoria com cadeia de verdade explícita.
- Estratégia de carreira.
- Fechamento do ciclo pós-prova com cinco etapas tratadas da página 04 do Notion, evidências do snapshot e estado local exportável.
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

O repositório publica somente o snapshot tratado necessário ao painel. O espelho bruto das páginas do Notion não é gerado nem exposto no GitHub Pages. O token do Notion fica somente nos GitHub Actions Secrets e nunca é enviado ao navegador.

O sincronizador lê apenas a seção editorial necessária ao gatilho pós-prova e a converte em `strategy.postExamGates`. Os blocos brutos da página não são gravados no repositório.

## Limite do produto

Este site não oferece sessão de estudo, revisão, simulado, prova real, resolução de questões ou iframe de outra plataforma. O propósito é exclusivamente gerencial: preservar histórico, acompanhar desempenho e investimento, registrar decisões e apoiar os próximos movimentos da transição.

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
