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
- Workflow de espelhamento seguro do Notion via `NOTION_TOKEN` em GitHub Actions.

## Regra de governança

**Banco operacional → reconciliação/normalização → Registro Histórico → painel/resumo.**

O arquivo `data/snapshot.json` é um snapshot auditado inicial. O workflow `sync-notion.yml` cria `data/notion-live.json` como espelho técnico; não expõe o token do Notion ao navegador.

## Publicação

1. Crie um repositório público, por exemplo `plano-de-transicao`.
2. Envie estes arquivos para a branch `main`.
3. Em **Settings → Pages**, escolha **Deploy from a branch**, `main` / `/ (root)`.
4. Para sincronização do Notion, adicione o secret `NOTION_TOKEN` em **Settings → Secrets and variables → Actions**.
5. Compartilhe a integração do Notion com as páginas/bancos usados pelo plano.

A URL ficará no padrão:

`https://<usuario>.github.io/plano-de-transicao/`

## Observação técnica

A sincronização automática das métricas deve continuar respeitando a fonte operacional. O espelho de páginas não deve substituir consultas aos bancos de desempenho quando houver divergência.
