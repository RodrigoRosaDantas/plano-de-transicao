import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [css, homeCss, js, shellCss, shellJs, sw] = await Promise.all([
  fs.readFile('assets/workspace-v23.css','utf8'),
  fs.readFile('assets/workspace-v23-home.css','utf8'),
  fs.readFile('assets/workspace-v23.js','utf8'),
  fs.readFile('assets/exam-day-v21-shell.css','utf8'),
  fs.readFile('assets/exam-day-v21-shell.js','utf8'),
  fs.readFile('sw.js','utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);

has(shellCss, 'workspace-v23.css?v=23', 'loader CSS v23');
has(shellCss, 'workspace-v23-home.css?v=23', 'loader Home v23');
has(shellJs, "workspace-v23.js?v=23", 'loader JS v23');
has(sw, "'./assets/workspace-v23.css'", 'PWA CSS v23');
has(sw, "'./assets/workspace-v23-home.css'", 'PWA Home v23');
has(sw, "'./assets/workspace-v23.js'", 'PWA JS v23');

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
has(js, "document.body.dataset.workspaceVersion = '23'", 'marca runtime v23');
has(js, "v23-view-${view}", 'classe por view');
has(js, "location.hash === '#exam-day'", 'compatibilidade Dia da Prova');

// Design system global não pode duplicar dados operacionais ou regras de negócio.
const bundle = `${css}\n${homeCss}\n${js}`;
for (const forbidden of ['06:45','07:45','13:45','14:45','Sala 1820','Sala 1830','4 horas','CPF','Inscrição:']) {
  assert.ok(!bundle.includes(forbidden), `v23 não deve conter dado operacional: ${forbidden}`);
}

console.log('PASS  v23: redesign estrutural global desacoplado de dados e integrado ao PWA.');
