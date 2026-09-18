# 🧭 Central de Transição — GitHub Pages

Versão independente da **Central de Transição**, preparada para GitHub Pages.

**Arquitetura de marca:** a **Central de Transição** é o produto/sistema gerencial; o **Plano de Transição** é a estratégia acompanhada dentro da Central. Os identificadores técnicos históricos (`plano-de-transicao`) permanecem estáveis para preservar URLs, integrações, caches e compatibilidade.

## O que já está implementado

- Central “Agora” gerencial, com missão, prioridades por dados, contador e relógio de Brasília.
- Home adaptativa por fase: no pós-prova, a SEDES/DF passa a ser tratada como processo em acompanhamento e a próxima transição aparece separadamente.
- Fluxo longitudinal pós-prova: prova → gabarito → correção → recursos → resultado.
- Central pré-edital para TJDFT e SEEDF, com cargos no radar, notícias identificadas por tipo de fonte, links oficiais e alertas de ativação.
- **Radar Oficial DOU + DODF** com varredura automática, deduplicação de ocorrências, classificação de atos e monitoramento privado por identificadores protegidos; a interface pública recebe apenas agregados do radar pessoal.
- Pós-prova SEDES/DF com visão separada de TDAS 202 e EDAS 400, janela de recursos, cronograma e **monitor automático da página oficial da Quadrix**, incluindo novas publicações e matches pessoais protegidos.
- Trilhas estratégicas seguintes destacadas sem misturar bases: SEEDF e TJDFT.
- Plano focado em decisão e acompanhamento; a execução de questões permanece fora deste site.
- Central de operações com estado do snapshot, sincronização segura e PWA.
- A interface diferencia explicitamente **Recarregar snapshot** de **Sincronizar Notion**.
- Desempenho por matéria, combinações e atividades, com filtros independentes para histórico, TDAS e EDAS.
- Jornada e marcos em mapa visual contínuo.
- Provas e resultados com separação entre aproveitamento, nota, classificação e etapa do certame.
- TDAS 202 e EDAS 400 com registros próprios de realização e resultado. Prova realizada sem nota permanece com resultado pendente, sem entrar nos gráficos de aproveitamento.
- Financeiro completo com filtros, gráficos por ciclo/categoria, livro de lançamentos e exportação em CSV.
- Fontes e auditoria com cadeia de verdade explícita.
- Estratégia de carreira.
- Fechamento do ciclo pós-prova com cinco etapas tratadas da página 04 do Notion, evidências do snapshot e estado local exportável.
- Busca global.
- Tema claro/escuro.
- Layout responsivo para Android, iPhone, iPad e desktop.
- PWA instalável + service worker + uso offline.
- Identidade visual própria da **Central de Transição**, com símbolo “C + bússola” aplicado ao favicon, cabeçalho, Radar Oficial, Sala de Recursos e ícones PWA 192/512.
- Busca global por matéria, concurso, marco e investimento.
- Cache local, exportação do snapshot em JSON e cartão social próprio.
- Sincronização segura do Notion via `NOTION_TOKEN` em GitHub Actions.

## Radar Oficial

O módulo `radar-oficial.html` lê somente a tabela sanitizada `official_monitor_public_state` no Supabase. Os identificadores pessoais ficam no Supabase Vault e os textos das ocorrências privadas permanecem protegidos por RLS; o GitHub Pages recebe apenas métricas agregadas do radar pessoal e ocorrências dos radares públicos de SEDES/DF, SEEDF e TJDFT. A coleta principal roda em GitHub Actions de hora em hora entre 06:15 e 18:15, com conferência adicional às 21:15 (horário de Brasília), usando autenticação OIDC validada pelo Supabase — sem service key ou termo pessoal no repositório. O DOU é consultado na Imprensa Nacional e o DODF usa o endpoint oficial de pesquisa de Diários do SINJ/DF, com paginação do ano corrente e filtro local da janela recente. A SEDES/DF possui também um radar geral para qualquer menção oficial ao órgão, além dos termos específicos de concurso, resultado e homologação. SEEDF e TJDFT permanecem, neste primeiro momento, apenas nos radares específicos de concurso/pré-edital. O radar pessoal permanece uma busca privada independente. A ingestão usa fingerprint por termo/fonte/URL para impedir duplicação. O coletor Edge legado foi aposentado; a única cadeia ativa de coleta é GitHub Actions → OIDC → Edge Function restrita ao workflow oficial → Supabase.

### Radar Web pessoal

O Radar Oficial também possui uma área privada de pesquisa na internet. O código de acesso é usado apenas no desbloqueio; depois disso o navegador recebe uma sessão opaca temporária, com rate limit contra tentativas repetidas. A área bloqueada não renderiza os resultados privados.

Nome, variações e identificadores opcionais (CPF, RG, CNPJ, e-mail, telefone ou outro termo) são administrados somente depois do desbloqueio. O valor real de cada identificador fica criptografado no **Supabase Vault**, que é a fonte única dos termos pessoais; a estrutura legada em `official_monitor_terms` foi removida. As tabelas operacionais guardam apenas tipo, apelido, escopos e versão mascarada. Cada identificador pode ser ativado separadamente para **Pesquisa na Web** e/ou **DOU/DODF**; por padrão, documentos sensíveis como CPF/RG ficam somente no monitor oficial. Os resultados oficiais pessoais são gravados em uma tabela privada distinta e nunca entram na lista pública de ocorrências.

Os resultados web ficam em tabelas privadas com RLS e só são entregues pela Edge Function `personal-web-search`. Uma URL é deduplicada uma única vez, mas pode manter vínculos privados com vários identificadores que encontraram o mesmo resultado. A pesquisa mantém histórico e revisão explícita de identidade (`A revisar`, `É meu`, `Possível homônimo`, `Não sou eu`). O provedor principal é o DuckDuckGo HTML, consultado por uma função SQL privada; o front recebe somente dados privados após uma sessão válida. O painel também permite gerar/trocar o código de acesso sem recuperar o código anterior, pois apenas o hash é armazenado.

### Monitor Pós-Prova SEDES/Quadrix\n\nA página oficial `https://quadrix.org.br/informacoes/3056/` é a fonte-mãe do concurso. Um workflow dedicado usa GitHub OIDC para consultar a página, detectar alterações de situação/cronograma/publicações e, em documentos relevantes, procurar os identificadores privados obtidos do Supabase Vault. O repositório nunca contém nome, CPF ou inscrição em claro. O estado público fica em `sedes_quadrix_public_state`; ocorrências pessoais ficam em tabela privada e só aparecem no Pós-Prova após a mesma sessão temporária usada pelo Radar pessoal. Inscrições descobertas com correspondência forte podem ser incorporadas ao Vault no escopo exclusivo SEDES.\n\n## Regra de governança

**Banco operacional → reconciliação/normalização → Registro Histórico → painel/resumo.**

O site lê `data/snapshot.json`. Esse arquivo é atualizado pelo workflow a partir dos bancos operacionais compartilhados com a integração do Notion e do Registro Histórico. Quando algum banco não está acessível à integração, a rotina preserva o último valor validado e registra a pendência em `meta.syncWarnings`, evitando derrubar o painel ou substituir dado válido por zero.

O repositório publica somente o snapshot tratado necessário ao painel. O espelho bruto das páginas do Notion não é gerado nem exposto no GitHub Pages. O token do Notion fica somente nos GitHub Actions Secrets e nunca é enviado ao navegador.

O sincronizador lê apenas a seção editorial necessária ao gatilho pós-prova e a converte em `strategy.postExamGates`. Os blocos brutos da página não são gravados no repositório.

## Atualização x sincronização

- **Recarregar snapshot**: baixa imediatamente do GitHub Pages o `data/snapshot.json` mais recente já publicado.
- **Sincronizar Notion**: abre o workflow seguro `sync-notion.yml` no GitHub Actions para execução manual autenticada.
- O navegador não recebe `NOTION_TOKEN` nem qualquer credencial de escrita.
- A sincronização automática continua rodando a cada 3 horas.

Essa separação evita uma falsa sensação de atualização em tempo real e preserva a segurança da fonte.

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


## Privacidade de commits

As operações web do GitHub devem usar o endereço privado `@users.noreply.github.com`, preservando o e-mail pessoal do autor. A configuração de privacidade da conta não altera os Secrets, integrações, GitHub Actions, Supabase ou GitHub Pages do projeto.
