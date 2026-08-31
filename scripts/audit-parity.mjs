import fs from 'node:fs/promises';

const read = async path => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const snapshot = JSON.parse(await read('data/snapshot.json'));
const manifest = JSON.parse(await read('manifest.webmanifest'));
const index = await read('index.html');
const sw = await read('sw.js');
const parityV1 = await read('assets/work-parity.js');
const parityV2 = await read('assets/work-parity-v2.js');
const parityV3 = await read('assets/work-parity-v3.js');

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

for (const asset of ['assets/work-parity.css','assets/work-parity.js','assets/work-parity-v2.css','assets/work-parity-v2.js','assets/work-parity-v3.js','data/snapshot.json','manifest.webmanifest']) {
  check(`PWA cacheia ${asset}`, sw.includes(`'./${asset}'`) || sw.includes(`"./${asset}"`));
}
check('Manifest está ligado no HTML', index.includes('manifest.webmanifest'));
check('Camada v1 está ligada no HTML', index.includes('work-parity.js'));
check('Camada v2 está ligada no HTML', index.includes('work-parity-v2.js'));
check('Camada v3 está ligada no HTML', index.includes('work-parity-v3.js'));
check('Workspace integrado implementado', parityV2.includes('studyWorkspaceFrame') && parityV2.includes('WORKSPACE INTEGRADO'));
check('Workspace remove navegação duplicada', parityV3.includes('>.topbar') && parityV3.includes('>.mobile-nav'));
check('Workspace sincroniza tema do Plano', parityV3.includes("setAttribute('data-theme'"));
check('Comparação de provas implementada', parityV2.includes('COMPARAÇÃO ENTRE PROVAS REAIS'));
check('Investimento por ciclo implementado', parityV2.includes('INVESTIMENTO POR CICLO'));
check('Confirmado x estimado x não confirmado implementado', parityV2.includes('Confirmado × estimado × não confirmado'));
check('Guardrail investimento x desempenho implementado', parityV2.includes('INVESTIMENTO × DESEMPENHO'));
check('Resumo x auditoria global implementado', parityV2.includes('globalViewToggle'));
check('Persistência local da plataforma é lida', parityV1.includes('sedes.questoes.') && parityV1.includes('localStorage'));

const shortcutUrls = new Set((manifest.shortcuts || []).map(x=>x.url));
check('PWA usa modo standalone', manifest.display === 'standalone');
check('PWA possui escopo próprio', manifest.scope === './' && manifest.id === './');
check('PWA possui atalho Estudar', shortcutUrls.has('./#tools'));
check('PWA possui atalho Desempenho', shortcutUrls.has('./#performance'));
check('PWA possui atalho Provas', shortcutUrls.has('./#exams'));
check('PWA possui atalho Investimentos', shortcutUrls.has('./#finance'));

const failures = results.filter(x=>!x.pass);
const width = Math.max(...results.map(x=>x.name.length));
for (const row of results) console.log(`${row.pass?'PASS':'FAIL'}  ${row.name.padEnd(width)}${row.detail?`  ${row.detail}`:''}`);
console.log(`\n${results.length-failures.length}/${results.length} verificações aprovadas.`);
if (failures.length) {
  console.error(`Falharam ${failures.length} verificações de paridade.`);
  process.exit(1);
}
