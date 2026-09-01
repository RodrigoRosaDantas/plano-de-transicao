import fs from 'node:fs/promises';

const read = async (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const snapshot = JSON.parse(await read('data/snapshot.json'));
const manifest = JSON.parse(await read('manifest.webmanifest'));
const index = await read('index.html');
const sw = await read('sw.js');
const app = await read('assets/work-app.js');
const styles = await read('assets/work-app.css');
const manager = await read('assets/work-manager-v9.js');
const managerStyles = await read('assets/work-manager-v9.css');
const intelligence = await read('assets/work-intelligence-v10.js');
const intelligenceStyles = await read('assets/work-intelligence-v10.css');
const decisions = await read('assets/work-decisions-v11.js');
const decisionStyles = await read('assets/work-decisions-v11.css');
const history = await read('assets/decision-history-v12.js');
const historyStyles = await read('assets/decision-history-v12.css');
const inbox = await read('assets/manager-inbox-v13.js');
const inboxStyles = await read('assets/manager-inbox-v13.css');
const focus = await read('assets/home-focus-v14.js');
const focusStyles = await read('assets/home-focus-v14.css');
const treated = await import(new URL('../data/treated-performance-data.js', import.meta.url));

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail });
const close = (a, b, t = .01) => Math.abs(Number(a || 0) - Number(b || 0)) <= t;
const sum = (values) => values.reduce((a, b) => a + Number(b || 0), 0);

const m = snapshot.metrics;
check('Histórico = acertos + erros', m.history.questions === m.history.hits + m.history.errors, `${m.history.questions} = ${m.history.hits} + ${m.history.errors}`);
check('Bruto = mensurável + sem resultado', m.history.rawRecords === m.history.questions + m.history.withoutResult, `${m.history.rawRecords} = ${m.history.questions} + ${m.history.withoutResult}`);
check('TDAS fecha matematicamente', m.tdas.questions === m.tdas.hits + m.tdas.errors, `${m.tdas.questions}`);
check('EDAS fecha matematicamente', m.edas.questions === m.edas.hits + m.edas.errors, `${m.edas.questions}`);
check('TDAS e EDAS continuam separados', m.tdas.questions !== m.edas.questions && m.tdas.accuracy !== m.edas.accuracy);

const finance = snapshot.financeSummary || {};
const sedesOperational = sum((snapshot.financeEntries || []).filter((x) => x.countsInCycle && x.cycle === 'SEDES/DF 2026').map((x) => x.confirmed));
check('Financeiro SEDES banco = resumo', close(sedesOperational, finance.sedes?.confirmed), `${sedesOperational} × ${finance.sedes?.confirmed}`);
check('Financeiro SEDES resumo = métrica', close(finance.sedes?.confirmed, m.finance.sedesConfirmed), `${finance.sedes?.confirmed} × ${m.finance.sedesConfirmed}`);
check('Total confirmado = soma por ciclo', close(finance.totals?.confirmed, sum((finance.byCycle || []).map((x) => x.confirmed))), `${finance.totals?.confirmed}`);
check('Não confirmado fora do total do ciclo', (snapshot.financeEntries || []).filter((x) => x.situation === 'Não confirmado').every((x) => !x.countsInCycle));
check('IDs financeiros únicos', new Set((snapshot.financeEntries || []).map((x) => x.id)).size === (snapshot.financeEntries || []).length);

const classified = (snapshot.exams || []).filter((x) => x.classification);
check('Classificação sempre possui etapa', classified.every((x) => Boolean(x.classificationStage)));
check('Prova futura não possui resultado inventado', (snapshot.exams || []).filter((x) => x.name.includes('SEDES')).every((x) => x.rawAccuracy == null));
check('Caldas preserva não auditável financeiro', (snapshot.exams || []).filter((x) => x.name.includes('Caldas')).every((x) => String(x.financialStatus || '').includes('Não auditável')));
check('Câmara preserva status financeiro fechado', (snapshot.exams || []).filter((x) => x.name.includes('Câmara')).every((x) => x.financialStatus === 'Fechado'));

check('Sem warnings de sincronização', !(snapshot.meta.syncWarnings || []).length, JSON.stringify(snapshot.meta.syncWarnings || []));
check('Sem divergências de enriquecimento', !(snapshot.meta.dataWarnings || []).length, JSON.stringify(snapshot.meta.dataWarnings || []));
check('Fonte declara Notion vivo', String(snapshot.meta.source || '').includes('Notion'));
check('Ciclos possuem âncora temporal quando disponível', (snapshot.historyCycles || []).some((x) => x.date), `${(snapshot.historyCycles || []).filter((x) => x.date).length}/${(snapshot.historyCycles || []).length}`);

check('Linhas temáticas tratadas são matematicamente válidas', treated.treatedTopicalSeed.every((x) => x.questions >= x.correct && x.correct >= 0));
check('Atividades tratadas são matematicamente válidas', treated.treatedActivitySeed.every((x) => x.questions >= x.correct && x.correct >= 0));
check('Tratamento preserva os três escopos', ['historical', 'tdas', 'edas'].every((scope) => treated.treatedTopicalSeed.some((x) => x.scope === scope)));
check('Tratamento separa matérias, combinações e atividades', ['subject', 'combination', 'activity'].every((grain) => treated.treatedTopicalSeed.some((x) => x.grain === grain)));

const cachedAssets = [
  'assets/work-app.css', 'assets/work-app.js',
  'assets/work-manager-v9.css', 'assets/work-manager-v9.js',
  'assets/work-intelligence-v10.css', 'assets/work-intelligence-v10.js',
  'assets/work-decisions-v11.css', 'assets/work-decisions-v11.js', 'assets/work-decisions-v11-fix.js',
  'assets/decision-history-v12.css', 'assets/decision-history-v12.js',
  'assets/manager-inbox-v13.css', 'assets/manager-inbox-v13.js',
  'assets/home-focus-v14.css', 'assets/home-focus-v14.js',
  'assets/og.png', 'data/snapshot.json', 'data/treated-performance-data.js', 'manifest.webmanifest',
];
for (const asset of cachedAssets) check(`PWA cacheia ${asset}`, sw.includes(`'./${asset}'`) || sw.includes(`"./${asset}"`));
check('Cache PWA está na versão v14', sw.includes("const CACHE='plano-transicao-v14'"));
check('Manifest está ligado no HTML', index.includes('manifest.webmanifest'));
check('Todas as camadas v9–v14 estão ligadas no HTML', [
  'work-manager-v9.js', 'work-intelligence-v10.js', 'work-decisions-v11.js', 'decision-history-v12.js', 'manager-inbox-v13.js', 'home-focus-v14.js',
].every((asset) => index.includes(asset)));
check('Todos os estilos v9–v14 estão ligados no HTML', [
  'work-manager-v9.css', 'work-intelligence-v10.css', 'work-decisions-v11.css', 'decision-history-v12.css', 'manager-inbox-v13.css', 'home-focus-v14.css',
].every((asset) => index.includes(asset)));
check('Cache busting do shell está em v14', !index.includes('?v=13') && index.includes('?v=14'));
check('Cartão social está configurado', index.includes('og:image') && index.includes('assets/og.png'));

check('Estudo saiu da navegação pública', !index.includes('data-view="study"'));
check('Botão Atualizar é textual e visível', index.includes('refresh-work-button') && index.includes('<b>Atualizar</b>'));
check('Mais é Central de operações', index.includes('Central de operações') && index.includes('manager-operations'));
check('Plataforma de Questões ficou externa', index.includes('../sedes-df-questoes/') && index.includes('sem estudar dentro deste site'));
check('Bookmark antigo de estudo é redirecionado', manager.includes("location.hash === '#study'") && manager.includes("location.hash = '#command'"));
check('Home mantém reorientação gerencial', manager.includes('O Plano acompanha. A plataforma executa.') && manager.includes('manager-quick-grid'));

check('v10 possui bloco Agora inteligente', intelligence.includes('managerNowBoard') && intelligence.includes('Maior atenção mensurável'));
check('v10 possui leitura Se a prova fosse hoje', intelligence.includes('managerExamToday') && intelligence.includes('Leitura de preparação, não previsão de aprovação'));
check('v10 não inventa nota de corte ou nomeação', intelligence.includes('Não inventa nota de corte, posição ou probabilidade de nomeação'));
check('v10 possui Diagnóstico e Prioridades', intelligence.includes('data-v10-performance="diagnostic"') && intelligence.includes('data-v10-performance="priorities"'));
check('Diagnóstico não confunde score com importância do edital', intelligence.includes('não mede importância do edital'));

check('v11 possui Centro de decisões persistente local', decisions.includes('CENTRO DE DECISÕES') && decisions.includes('plano.decisions.v11') && decisions.includes('localStorage'));
check('v11 separa decisão local de Notion', decisions.includes('Decisões não são enviadas ao Notion automaticamente'));
check('v11 permite adotar, descartar e reabrir', decisions.includes("'adopted'") && decisions.includes("'dismissed'") && decisions.includes("'open'"));
check('v11 possui alertas rastreáveis', decisions.includes('ALERTAS RASTREÁVEIS') && decisions.includes('Origem:'));
check('v11 possui horizonte operacional', decisions.includes('HORIZONTE OPERACIONAL') && decisions.includes('PRÓXIMAS 48H'));
check('v11 exporta decisões locais', decisions.includes('Exportar decisões') && decisions.includes("storage: 'localStorage'"));

check('v12 adiciona Histórico à Home', history.includes("button.textContent = 'Histórico'") && history.includes("'#v12DecisionHistory'"));
check('v12 possui memória decisória local', history.includes('plano.decisionJournal.v12') && history.includes('MEMÓRIA DECISÓRIA · V12'));
check('v12 cria baseline ao adotar decisão', history.includes("status === 'adopted' ? await metricForDecision(id) : null") && history.includes('baselineQuality'));
check('v12 compara aproveitamento em p.p.', history.includes("baseline.kind === 'accuracy'") && history.includes('p.p.'));
check('v12 explicita que comparação não prova causalidade', history.includes('não demonstra causalidade') && history.includes('Comparação não é causalidade'));
check('v12 permite notas e revisão 24h/72h', history.includes('v12DecisionNote') && history.includes('data-v12-review-hours="24"') && history.includes('data-v12-review-hours="72"'));
check('v12 exporta dossiê local', history.includes('Exportar dossiê') && history.includes('currentDecisionState') && history.includes('journal: readJournal()'));

check('v13 adiciona Atenção à Home', inbox.includes("button.textContent = 'Atenção'") && inbox.includes("'#v13ManagerInbox'"));
check('v13 agrega decisões, revisões, alertas e snapshot', inbox.includes('readDecisionCards()') && inbox.includes('reviewItems()') && inbox.includes('alertItems()') && inbox.includes('snapshotItems(snapshot)'));
check('v13 classifica Agora/Hoje/Monitorar', inbox.includes("bucket === 'now'") && inbox.includes("bucket === 'today'") && inbox.includes("'Monitorar'"));
check('v13 permite adiar e silenciar localmente', inbox.includes("kind === 'snooze'") && inbox.includes("kind === 'silence'") && inbox.includes('plano.managerInbox.v13'));
check('v13 preserva fonte oficial', inbox.includes('não alteram Notion, decisões ou snapshot'));
check('v13 integra operações ao Mais', inbox.includes('v13InboxOps') && inbox.includes('v13OpenInbox') && inbox.includes('v13RestoreInbox'));

check('v14 possui preferência local de modo da Home', focus.includes('plano.homeMode.v14') && focus.includes('localStorage'));
check('v14 usa foco como padrão em <=980px', focus.includes("matchMedia('(max-width: 980px)')") && focus.includes("? 'focus' : 'expanded'"));
check('v14 recolhe contexto profundo sem remover dados', focus.includes('v14-deep-context') && focusStyles.includes('.command-view.v14-home-focus .v14-deep-context'));
check('v14 expande antes de navegação profunda', focus.includes('expandBeforeDeepNavigation') && focus.includes('[data-v11-scroll]') && focus.includes('[data-v13-open]'));
check('v14 integra alternância ao Mais', focus.includes('v14FocusOps') && focus.includes('v14ToggleModeOps'));

check('Desempenho mantém Visão geral e Por matéria', manager.includes('data-manager-performance="overview"') && manager.includes('data-manager-performance="subjects"'));
check('Desempenho preserva escopo e grão', app.includes('data-performance-scope') && app.includes('data-performance-grain'));
check('Desempenho por matéria continua implementado', app.includes('subjectRows') && app.includes('treatedTopicalSeed'));
check('Comparação de provas continua implementada', app.includes('MATRIZ AUDITADA') && app.includes('exam-matrix'));
check('Investimento por ciclo continua implementado', app.includes('POR CICLO') && app.includes('financeSummary.byCycle'));
check('Confirmado x estimado x não confirmado continua implementado', app.includes('TOTAL CONFIRMADO') && app.includes('estimated'));
check('Busca global continua implementada', app.includes('buildSearchIndex') && app.includes('commandPalette'));

check('Layout móvel mantém dock e Mais', styles.includes('.mobile-dock') && styles.includes('.more-sheet'));
check('v9 trata Android e telas estreitas', managerStyles.includes('@media (max-width: 760px)') && managerStyles.includes('.refresh-work-button'));
check('v10 converte tabela em cards no mobile', intelligenceStyles.includes('.subject-table thead { display: none; }') && intelligenceStyles.includes('.subject-table tr { display: grid'));
check('v10 previne overflow', intelligenceStyles.includes('overflow-x: auto') && intelligenceStyles.includes('minmax(0, 1fr)'));
check('v11 empilha decisões no mobile', decisionStyles.includes('@media (max-width: 760px)') && decisionStyles.includes('.v11-decision-grid { grid-template-columns: 1fr; }'));
check('v12 empilha impacto e timeline no mobile', historyStyles.includes('.v12-impact-grid { grid-template-columns: 1fr; }') && historyStyles.includes('.v12-event { grid-template-columns: 10px minmax(0, 1fr); }'));
check('v13 empilha fila antes de 980px', inboxStyles.includes('@media (max-width: 980px)') && inboxStyles.includes('.v13-inbox-item { grid-template-columns: minmax(0, 1fr); }'));
check('v14 recolhe redundâncias no mobile', focusStyles.includes('.manager-command-card') && focusStyles.includes('.manager-quick-grid'));
check('v14 trata telas de 390px', focusStyles.includes('@media (max-width: 390px)'));

check('Mais mantém navegação, sincronização e ecossistema', index.includes('Dados e sincronização') && index.includes('Ecossistema') && index.includes('Sincronizar no GitHub'));
check('Mais mantém saúde v10', intelligence.includes('managerHealthGrid') && intelligence.includes('managerClearCacheBtn'));
check('Mais mantém decisões v11', decisions.includes('v11DecisionHealth') && decisions.includes('v11ExportDecisions'));
check('Mais mantém histórico v12', history.includes('v12DecisionJournalOps') && history.includes('v12ExportDossier'));
check('Mais mantém caixa v13', inbox.includes('v13InboxOps') && inbox.includes('v13RestoreInbox'));
check('Mais recebe modo foco v14', focus.includes('v14FocusOps') && focus.includes('v14ToggleModeOps'));

const shortcutUrls = new Set((manifest.shortcuts || []).map((x) => x.url));
check('PWA usa modo standalone', manifest.display === 'standalone');
check('PWA possui escopo próprio', manifest.scope === './' && manifest.id === './');
check('PWA não possui atalho de estudo', !shortcutUrls.has('./#study'));
check('PWA possui atalho Atenção/Agora', shortcutUrls.has('./#command') && (manifest.shortcuts || []).some((x) => x.short_name === 'Atenção'));
check('PWA mantém atalhos principais', ['./#performance', './#exams', './#journey', './#finance'].every((url) => shortcutUrls.has(url)));

const failures = results.filter((x) => !x.pass);
const width = Math.max(...results.map((x) => x.name.length));
for (const row of results) console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${row.name.padEnd(width)}${row.detail ? `  ${row.detail}` : ''}`);
console.log(`\n${results.length - failures.length}/${results.length} verificações aprovadas.`);
if (failures.length) {
  console.error(`Falharam ${failures.length} verificações de paridade.`);
  process.exit(1);
}
