import fs from 'node:fs/promises';

const read = async path => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
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
const treated = await import(new URL('../data/treated-performance-data.js', import.meta.url));

const results = [];
const check = (name, pass, detail = '') => results.push({name, pass:Boolean(pass), detail});
const close = (a,b,t=.01) => Math.abs(Number(a||0)-Number(b||0)) <= t;
const sum = values => values.reduce((a,b)=>a+Number(b||0),0);

const m = snapshot.metrics;
check('Histórico = acertos + erros', m.history.questions === m.history.hits + m.history.errors, `${m.history.questions} = ${m.history.hits} + ${m.history.errors}`);
check('Bruto = mensurável + sem resultado', m.history.rawRecords === m.history.questions + m.history.withoutResult, `${m.history.rawRecords} = ${m.history.questions} + ${m.history.withoutResult}`);
check('TDAS fecha matematicamente', m.tdas.questions === m.tdas.hits + m.tdas.errors, `${m.tdas.questions}`);
check('EDAS fecha matematicamente', m.edas.questions === m.edas.hits + m.edas.errors, `${m.edas.questions}`);
check('TDAS e EDAS continuam separados', m.tdas.questions !== m.edas.questions && m.tdas.accuracy !== m.edas.accuracy);

const finance = snapshot.financeSummary || {};
const sedesOperational = sum((snapshot.financeEntries || []).filter(x=>x.countsInCycle && x.cycle==='SEDES/DF 2026').map(x=>x.confirmed));
check('Financeiro SEDES banco = resumo', close(sedesOperational, finance.sedes?.confirmed), `${sedesOperational} × ${finance.sedes?.confirmed}`);
check('Financeiro SEDES resumo = métrica', close(finance.sedes?.confirmed, m.finance.sedesConfirmed), `${finance.sedes?.confirmed} × ${m.finance.sedesConfirmed}`);
check('Total confirmado = soma por ciclo', close(finance.totals?.confirmed, sum((finance.byCycle||[]).map(x=>x.confirmed))), `${finance.totals?.confirmed}`);
check('Não confirmado fora do total do ciclo', (snapshot.financeEntries||[]).filter(x=>x.situation==='Não confirmado').every(x=>!x.countsInCycle));
check('IDs financeiros únicos', new Set((snapshot.financeEntries||[]).map(x=>x.id)).size === (snapshot.financeEntries||[]).length);

const classified = (snapshot.exams||[]).filter(x=>x.classification);
check('Classificação sempre possui etapa', classified.every(x=>Boolean(x.classificationStage)));
check('Prova futura não possui resultado inventado', (snapshot.exams||[]).filter(x=>x.name.includes('SEDES')).every(x=>x.rawAccuracy == null));
check('Caldas preserva não auditável financeiro', (snapshot.exams||[]).filter(x=>x.name.includes('Caldas')).every(x=>String(x.financialStatus||'').includes('Não auditável')));
check('Câmara preserva status financeiro fechado', (snapshot.exams||[]).filter(x=>x.name.includes('Câmara')).every(x=>x.financialStatus === 'Fechado'));

check('Sem warnings de sincronização', !(snapshot.meta.syncWarnings||[]).length, JSON.stringify(snapshot.meta.syncWarnings||[]));
check('Sem divergências de enriquecimento', !(snapshot.meta.dataWarnings||[]).length, JSON.stringify(snapshot.meta.dataWarnings||[]));
check('Fonte declara Notion vivo', String(snapshot.meta.source||'').includes('Notion'));
check('Ciclos possuem âncora temporal quando disponível', (snapshot.historyCycles||[]).some(x=>x.date), `${(snapshot.historyCycles||[]).filter(x=>x.date).length}/${(snapshot.historyCycles||[]).length}`);

check('Linhas temáticas tratadas são matematicamente válidas', treated.treatedTopicalSeed.every(x=>x.questions >= x.correct && x.correct >= 0));
check('Atividades tratadas são matematicamente válidas', treated.treatedActivitySeed.every(x=>x.questions >= x.correct && x.correct >= 0));
check('Tratamento preserva os três escopos', ['historical','tdas','edas'].every(scope=>treated.treatedTopicalSeed.some(x=>x.scope===scope)));
check('Tratamento separa matérias, combinações e atividades', ['subject','combination','activity'].every(grain=>treated.treatedTopicalSeed.some(x=>x.grain===grain)));

for (const asset of ['assets/work-app.css','assets/work-app.js','assets/work-manager-v9.css','assets/work-manager-v9.js','assets/work-intelligence-v10.css','assets/work-intelligence-v10.js','assets/og.png','data/snapshot.json','data/treated-performance-data.js','manifest.webmanifest']) {
  check(`PWA cacheia ${asset}`, sw.includes(`'./${asset}'`) || sw.includes(`"./${asset}"`));
}
check('Cache PWA está na versão v10', sw.includes("plano-transicao-v10"));
check('Manifest está ligado no HTML', index.includes('manifest.webmanifest'));
check('Aplicação-base está ligada no HTML', index.includes('assets/work-app.js'));
check('Tema visual-base está ligado no HTML', index.includes('assets/work-app.css'));
check('Camada gerencial está ligada no HTML', index.includes('assets/work-manager-v9.js') && index.includes('assets/work-manager-v9.css'));
check('Camada inteligente v10 está ligada no HTML', index.includes('assets/work-intelligence-v10.js') && index.includes('assets/work-intelligence-v10.css'));
check('Cartão social está configurado', index.includes('og:image') && index.includes('assets/og.png'));

check('Estudo saiu da navegação pública', !index.includes('data-view="study"'));
check('Botão Atualizar é ação textual e visível', index.includes('refresh-work-button') && index.includes('<b>Atualizar</b>'));
check('Mais virou Central de operações', index.includes('Central de operações') && index.includes('manager-operations'));
check('Plataforma de Questões ficou externa', index.includes('../sedes-df-questoes/') && index.includes('sem estudar dentro deste site'));
check('Bookmark antigo de estudo é redirecionado', manager.includes("location.hash === '#study'") && manager.includes("location.hash = '#command'"));
check('Home é reorientada para decisão gerencial', manager.includes('O Plano acompanha. A plataforma executa.') && manager.includes('manager-quick-grid'));
check('Home v10 possui bloco Agora inteligente', intelligence.includes('managerNowBoard') && intelligence.includes('Maior atenção mensurável'));
check('Home v10 possui leitura Se a prova fosse hoje', intelligence.includes('managerExamToday') && intelligence.includes('Leitura de preparação, não previsão de aprovação'));
check('Leitura de prova preserva guardrail sem previsão', intelligence.includes('Não inventa nota de corte, posição ou probabilidade de nomeação'));
check('Desempenho mantém Visão geral e Por matéria', manager.includes('data-manager-performance="overview"') && manager.includes('data-manager-performance="subjects"'));
check('Desempenho v10 adiciona Diagnóstico e Prioridades', intelligence.includes('data-v10-performance="diagnostic"') && intelligence.includes('data-v10-performance="priorities"'));
check('Ranking de prioridade usa apenas evidência observada', intelligence.includes('const priority =') && intelligence.includes('row.questions') && intelligence.includes('row.correct'));
check('Diagnóstico não confunde score com importância do edital', intelligence.includes('não mede importância do edital'));
check('Desempenho preserva controles de escopo e grão', app.includes('data-performance-scope') && app.includes('data-performance-grain'));
check('Desempenho por matéria continua implementado', app.includes('subjectRows') && app.includes('treatedTopicalSeed'));
check('Comparação de provas continua implementada', app.includes('MATRIZ AUDITADA') && app.includes('exam-matrix'));
check('Investimento por ciclo continua implementado', app.includes('POR CICLO') && app.includes('financeSummary.byCycle'));
check('Confirmado x estimado x não confirmado implementado', app.includes('TOTAL CONFIRMADO') && app.includes('estimated'));
check('Guardrail investimento x desempenho implementado', app.includes('GUARDA-CORPO'));
check('Busca global implementada', app.includes('buildSearchIndex') && app.includes('commandPalette'));
check('Layout móvel possui dock e folha Mais', styles.includes('.mobile-dock') && styles.includes('.more-sheet'));
check('Camada v9 trata Android e telas estreitas', managerStyles.includes('@media (max-width: 760px)') && managerStyles.includes('.refresh-work-button'));
check('v10 converte tabela de matéria em cards no mobile', intelligenceStyles.includes('.subject-table thead { display: none; }') && intelligenceStyles.includes('.subject-table tr { display: grid'));
check('v10 mantém prevenção explícita de overflow', intelligenceStyles.includes('overflow-x: auto') && intelligenceStyles.includes('minmax(0, 1fr)'));
check('Mais possui navegação, sincronização e ecossistema', index.includes('Dados e sincronização') && index.includes('Ecossistema') && index.includes('Sincronizar no GitHub'));
check('Mais v10 possui saúde, cache e recarga sem apagar progresso', intelligence.includes('managerHealthGrid') && intelligence.includes('managerClearCacheBtn') && intelligence.includes('não apaga progresso de questões'));

const shortcutUrls = new Set((manifest.shortcuts || []).map(x=>x.url));
check('PWA usa modo standalone', manifest.display === 'standalone');
check('PWA possui escopo próprio', manifest.scope === './' && manifest.id === './');
check('PWA não possui atalho de estudo embutido', !shortcutUrls.has('./#study'));
check('PWA possui atalho Agora', shortcutUrls.has('./#command'));
check('PWA possui atalho Desempenho', shortcutUrls.has('./#performance'));
check('PWA possui atalho Concursos', shortcutUrls.has('./#exams'));
check('PWA possui atalho Jornada', shortcutUrls.has('./#journey'));
check('PWA possui atalho Investimentos', shortcutUrls.has('./#finance'));

const failures = results.filter(x=>!x.pass);
const width = Math.max(...results.map(x=>x.name.length));
for (const row of results) console.log(`${row.pass?'PASS':'FAIL'}  ${row.name.padEnd(width)}${row.detail?`  ${row.detail}`:''}`);
console.log(`\n${results.length-failures.length}/${results.length} verificações aprovadas.`);
if (failures.length) {
  console.error(`Falharam ${failures.length} verificações de paridade.`);
  process.exit(1);
}
