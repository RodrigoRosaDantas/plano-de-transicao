import fs from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'index.html',
  'assets/manager-inbox-v13.js',
  'assets/manager-inbox-v13.css',
  'sw.js',
  'manifest.webmanifest',
].map(async (path) => [path, await fs.readFile(path, 'utf8')])));

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  else console.log(`PASS  ${name}`);
}

const index = files['index.html'];
const js = files['assets/manager-inbox-v13.js'];
const css = files['assets/manager-inbox-v13.css'];
const sw = files['sw.js'];
const manifest = JSON.parse(files['manifest.webmanifest']);

check('shell continua carregando CSS v13', /manager-inbox-v13\.css\?v=\d+/.test(index));
check('shell continua carregando JS v13 depois da memória v12', /decision-history-v12\.js\?v=\d+/.test(index) && index.indexOf('manager-inbox-v13.js') > index.indexOf('decision-history-v12.js'));
check('estudo embutido continua fora da navegação pública', !index.includes('data-view="study"'));

check('v13 cria caixa gerencial', js.includes("section.id = 'v13ManagerInbox'") && js.includes('CAIXA DE ENTRADA GERENCIAL · V13'));
check('v13 agrega decisões e revisões', js.includes('readDecisionCards()') && js.includes('reviewItems()'));
check('v13 agrega dados, marcos e alertas', js.includes('snapshotItems(snapshot)') && js.includes('alertItems()'));
check('v13 ordena por urgência e evidência', js.includes('itemScore') && js.includes("bucket === 'now'"));
check('v13 permite adiar 24h', js.includes("kind === 'snooze'") && js.includes('24 * 3_600_000'));
check('v13 permite silenciar e restaurar', js.includes("kind === 'silence'") && js.includes('restoreInbox()'));
check('estados da v13 são locais', js.includes("const INBOX_KEY = 'plano.managerInbox.v13'") && js.includes('localStorage.setItem'));
check('v13 não grava no Notion', js.includes('não alteram Notion, decisões ou snapshot'));
check('operações v13 evitam rerender idêntico', js.includes('section.dataset.signature === signature'));
check('Mais recebe operações da caixa', js.includes("section.id = 'v13InboxOps'") && js.includes('v13RestoreInbox'));
check('Agora e Mais recebem badge de atenção', js.includes("$('.v13-attention-badge', target)") && js.includes("$('#moreTopBtn')"));

check('v13 possui layout mobile dedicado', css.includes('@media (max-width: 640px)') && css.includes('.v13-item-actions'));
check('v13 empilha item antes de 980px', css.includes('@media (max-width: 980px)') && css.includes('grid-template-columns: minmax(0, 1fr)'));
check('badge mobile tem posicionamento próprio', css.includes('#mobileDock .v13-attention-badge'));

check('service worker continua incluindo assets v13', sw.includes('manager-inbox-v13.css') && sw.includes('manager-inbox-v13.js'));
check('manifest continua expondo atalho de atenção', manifest.shortcuts?.some((item) => item.short_name === 'Atenção' && item.url === './#command'));

const failed = checks.filter((item) => !item.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} verificações de compatibilidade v13 aprovadas.`);
if (failed.length) process.exit(1);