# 🧭 Plano de Transição — GitHub Pages

Versão independente do painel **Plano de Transição**, preparada para GitHub Pages.

## O que já está implementado

- Home executiva com missão, prioridades, contador para a SEDES/DF e relógio de Brasília.
- Jornada e marcos.
- Provas e resultados com separação entre aproveitamento, nota e classificação.
- Financeiro com regras de auditoria.
- Histórico de desempenho, gráficos de volume e consolidado.
- Fontes e auditoria com cadeia de verdade explícita.
- Estratégia de carreira.
- Busca global.
- Tema claro/escuro.
- Layout responsivo para Android, iPhone, iPad e desktop.
- PWA instalável + service worker + uso offline.
- Cache local e exportação do snapshot em JSON.
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
