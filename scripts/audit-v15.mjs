import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, js, css, sw, sync, snapshotText, workflow, app] = await Promise.all([
  read('index.html'),
  read('assets/transition-gate-v15.js'),
  read('assets/transition-gate-v15.css'),
  read('sw.js'),
  read('scripts/sync-notion.mjs'),
  read('data/snapshot.json'),
  read('.github/workflows/quality.yml'),
  read('assets/work-app.js'),
]);
const snapshot = JSON.parse(snapshotText);

const checks = [];
const check = (name, condition) => {
  checks.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};

check('shell carrega CSS v15', index.includes('assets/transition-gate-v15.css?v=15'));
check('shell carrega JS v15 por último', index.includes('assets/transition-gate-v15.js?v=15') && index.indexOf('transition-gate-v15.js?v=15') > index.indexOf('home-focus-v14.js?v=15'));
check('cache busting global foi elevado para v15', !index.includes('?v=14') && index.includes('?v=15'));
check('estudo continua fora da navegação', !index.includes('data-view="study"'));

check('snapshot possui ao menos cinco gates', snapshot.strategy?.postExamGates?.length >= 5);
check('snapshot preserva fonte tratada', snapshot.strategy?.postExamSource?.status?.startsWith('treated') && snapshot.strategy?.postExamSource?.url?.includes('notion'));
check('sincronizador lê blocos com paginação', sync.includes('async function pageBlocks') && sync.includes("page_size: '100'") && sync.includes('start_cursor'));
check('sincronizador extrai somente a seção necessária', sync.includes("sectionList(strategyBlocks, 'Gatilho pós-SEDES/DF')") && sync.includes('postExamGates'));
check('sincronizador não grava espelho bruto', !sync.includes('notion-live.json') && !sync.includes('pageMirror'));

check('v15 cria resumo na Home', js.includes("summary.id = 'v15TransitionSummary'"));
check('v15 cria painel na Estratégia', js.includes('transitionGateV15') && js.includes('Transformar a prova em decisão rastreável'));
check('v15 deriva fase pela data oficial', js.includes('now >= examAt') && js.includes('Math.ceil((examAt - now) / 86_400_000)'));
check('v15 desabilita conclusão antes da prova', js.includes("view.active ? '' : ' disabled"));
check('v15 persiste somente estado local', js.includes("const STATE_KEY = 'plano.transitionGate.v15'") && js.includes('localStorage.setItem'));
check('v15 explicita que não altera o Notion', js.includes('não altera o Notion'));
check('v15 mostra prova, snapshot e financeiro como evidências', ['Prova real', 'Snapshot final', 'Ciclo financeiro'].every((label) => js.includes(label)));
check('v15 exporta dossiê local', js.includes('fechamento-ciclo-sedes-v15.json') && js.includes("storage: 'localStorage'"));
check('v15 integra fechamento ao Mais', js.includes('v15TransitionOps') && js.includes('Fechamento do ciclo'));
check('v15 inclui etapas na busca global', app.includes('transitionGates') && app.includes('Fechamento do ciclo · etapa'));

check('CSS v15 é responsivo até 390px', css.includes('@media (max-width: 980px)') && css.includes('@media (max-width: 390px)'));
check('CSS v15 evita largura fixa problemática', !css.includes('width: 1000px') && !css.includes('min-width: 1000px'));
check('service worker usa cache v15', sw.includes("const CACHE='plano-transicao-v15'"));
check('service worker inclui os dois assets v15', sw.includes('transition-gate-v15.css') && sw.includes('transition-gate-v15.js'));
check('workflow executa auditoria e teste v15', workflow.includes('node scripts/audit-v15.mjs') && workflow.includes('node tests/v15-transition-gate.mjs'));

const failures = checks.filter((item) => !item.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} verificações v15 aprovadas.`);
if (failures.length) process.exit(1);
