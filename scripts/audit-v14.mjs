import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, js, css, sw] = await Promise.all([
  read('index.html'),
  read('assets/home-focus-v14.js'),
  read('assets/home-focus-v14.css'),
  read('sw.js'),
]);

const checks = [];
const check = (name, condition) => {
  checks.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};

check('shell carrega CSS do modo foco v14', index.includes('assets/home-focus-v14.css?v=14'));
check('shell carrega JS do modo foco v14 por último', index.includes('assets/home-focus-v14.js?v=14') && index.indexOf('home-focus-v14.js?v=14') > index.indexOf('manager-inbox-v13.js?v=14'));
check('cache busting da interface foi elevado para v14', !index.includes('?v=13'));
check('estudo embutido continua fora da navegação', !index.includes('data-view="study"'));

check('modo v14 persiste preferência local', js.includes("const MODE_KEY = 'plano.homeMode.v14'") && js.includes('localStorage.setItem'));
check('mobile adota foco como padrão', js.includes("matchMedia('(max-width: 980px)')") && js.includes("? 'focus' : 'expanded'"));
check('desktop preserva contexto completo por padrão', js.includes("? 'focus' : 'expanded'"));
check('v14 recolhe apenas contexto profundo conhecido', js.includes("'#managerExamToday'") && js.includes("'#v11DecisionCenter'") && js.includes("'#v11AlertRadar'") && js.includes("'#v11WeeklyHorizon'") && js.includes("'#v12DecisionHistory'"));
check('v14 mantém Atenção e Agora fora do recolhimento', !js.includes("['#v13ManagerInbox',") && !js.includes("['#managerNowBoard',"));
check('v14 expõe resumo das áreas recolhidas', js.includes('openDecisions') && js.includes('alerts') && js.includes('adopted') && js.includes('history'));
check('v14 expande automaticamente ao navegar para contexto profundo', js.includes('expandBeforeDeepNavigation') && js.includes('[data-v11-scroll]') && js.includes('[data-v13-open]'));
check('v14 integra modo da Home ao Mais', js.includes("section.id = 'v14FocusOps'") && js.includes('v14ToggleModeOps'));
check('v14 evita rerender idêntico no Mais', js.includes('section.dataset.signature === signature'));

check('CSS esconde contexto profundo somente em foco', css.includes('.command-view.v14-home-focus .v14-deep-context') && css.includes('display: none !important'));
check('mobile também recolhe card institucional e atalhos redundantes', css.includes('.command-view.v14-home-focus .manager-command-card') && css.includes('.manager-quick-grid'));
check('v14 mantém tratamento estreito em 390px', css.includes('@media (max-width: 390px)'));
check('v14 não cria largura fixa problemática', !css.includes('width: 1000px') && !css.includes('min-width: 1000px'));

check('service worker usa cache v14', sw.includes("const CACHE='plano-transicao-v14'"));
check('service worker inclui assets v14', sw.includes('home-focus-v14.css') && sw.includes('home-focus-v14.js'));

const failures = checks.filter((item) => !item.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} verificações v14 aprovadas.`);
if (failures.length) process.exit(1);
