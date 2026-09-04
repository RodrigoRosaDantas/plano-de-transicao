import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, css, homeCss, hardeningCss, js, shellCss, shellJs, sw] = await Promise.all([
  fs.readFile('index.html','utf8'),
  fs.readFile('assets/workspace-v23.css','utf8'),
  fs.readFile('assets/workspace-v23-home.css','utf8'),
  fs.readFile('assets/workspace-v24-hardening.css','utf8'),
  fs.readFile('assets/workspace-v23.js','utf8'),
  fs.readFile('assets/exam-day-v21-shell.css','utf8'),
  fs.readFile('assets/exam-day-v21-shell.js','utf8'),
  fs.readFile('sw.js','utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);

has(index, 'assets/workspace-v23.css?v=23', 'loader CSS v23 direto no index');
has(index, 'assets/workspace-v23-home.css?v=23', 'loader Home v23 direto no index');
has(index, 'assets/workspace-v24-hardening.css?v=24', 'loader hardening v24 direto no index');
has(index, 'assets/workspace-v23.js?v=23', 'loader JS v23 direto no index');
assert.ok(index.indexOf('workspace-v23.css?v=23') > index.indexOf('exam-day-v21-shell.css?v=21'), 'CSS global deve carregar após o shell específico da prova.');
assert.ok(index.indexOf('workspace-v24-hardening.css?v=24') > index.indexOf('workspace-v23-home.css?v=23'), 'Hardening v24 deve carregar por último na pilha visual global.');
assert.ok(index.indexOf('workspace-v23.js?v=23') > index.indexOf('exam-day-v21-shell.js?v=21'), 'JS global deve carregar independentemente após o shell específico da prova.');
assert.ok(!shellCss.includes('workspace-v23'), 'Shell CSS do Dia da Prova não deve carregar o workspace global.');
assert.ok(!shellJs.includes('workspace-v23'), 'Shell JS do Dia da Prova não deve carregar o workspace global.');

has(sw, "'./assets/workspace-v23.css'", 'PWA CSS v23');
has(sw, "'./assets/workspace-v23-home.css'", 'PWA Home v23');
has(sw, "'./assets/workspace-v23.js'", 'PWA JS v23');
has(sw, "'./assets/workspace-v24-hardening.css'", 'PWA hardening v24');
has(sw, 'caches.match(req,{ignoreSearch:true})', 'fallback offline ignora query de versionamento');

has(css, '@media(min-width:1180px)', 'breakpoint desktop');
has(css, 'position:fixed', 'rail lateral');
has(css, 'width:224px', 'largura do rail');
has(css, 'body:not(.v23-view-command) .mission-strip', 'missão exclusiva da Home');
has(css, '.more-sheet.open{transform:translateX(0)!important}', 'drawer desktop');
has(css, '.mobile-dock', 'tratamento mobile');
has(homeCss, '.command-view .cockpit-grid', 'Home editorial');
has(homeCss, '.command-view .target-card', 'targets sem card pesado');
has(homeCss, '.command-view .priority-grid', 'prioridades em faixa');
has(homeCss, '.command-view .focus-board', 'foco editorial');
has(hardeningCss, 'visibility:hidden', 'drawer fechado sai da árvore visual');
has(hardeningCss, 'pointer-events:none', 'drawer fechado não intercepta interação');
has(hardeningCss, '.more-sheet.open', 'drawer aberto restaura estado visual');
has(hardeningCss, 'visibility:visible', 'drawer aberto fica visível');
has(js, "document.body.dataset.workspaceVersion = '23'", 'marca runtime v23');
has(js, "v23-view-${view}", 'classe por view');
has(js, "location.hash === '#exam-day'", 'compatibilidade Dia da Prova');

// Design system global não pode duplicar dados operacionais ou regras de negócio.
const bundle = `${css}\n${homeCss}\n${hardeningCss}\n${js}`;
for (const forbidden of ['06:45','07:45','13:45','14:45','Sala 1820','Sala 1830','4 horas','CPF','Inscrição:']) {
  assert.ok(!bundle.includes(forbidden), `workspace global não deve conter dado operacional: ${forbidden}`);
}

console.log('PASS  workspace v23/v24: redesign global independente do Dia da Prova, drawer fechado isolado e PWA robusto.');
