import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [shellCss, shellJs, css, js, sw] = await Promise.all([
  fs.readFile('assets/exam-day-v21-shell.css','utf8'),
  fs.readFile('assets/exam-day-v21-shell.js','utf8'),
  fs.readFile('assets/exam-day-v22.css','utf8'),
  fs.readFile('assets/exam-day-v22.js','utf8'),
  fs.readFile('sw.js','utf8')
]);

assert.ok(shellCss.includes('@import url("./exam-day-v22.css?v=22")'), 'CSS v22 não está encadeado pela shell.');
assert.ok(shellJs.includes("import './exam-day-v22.js?v=22'"), 'JS v22 não está encadeado pela shell.');
assert.ok(sw.includes("'./assets/exam-day-v22.css'"), 'CSS v22 ausente do PWA.');
assert.ok(sw.includes("'./assets/exam-day-v22.js'"), 'JS v22 ausente do PWA.');

for (const token of [
  '.exam21-subnav button.active',
  '.exam21-turn--tdas::before',
  '.exam21-check.done',
  '.exam21-section-head>strong.is-complete',
  '@media(max-width:760px)',
  '@media(max-width:430px)',
  '@media(prefers-reduced-motion:reduce)'
]) assert.ok(css.includes(token), `Polimento visual ausente: ${token}`);

for (const token of ['IntersectionObserver','syncChecklistVisual','is-complete','aria-current']) {
  assert.ok(js.includes(token), `Microinteração v22 ausente: ${token}`);
}

// A camada v22 não pode virar uma nova fonte de dados de prova.
for (const forbidden of ['06:45','07:45','13:45','14:45','1820','1830','08:00','15:00']) {
  assert.ok(!js.includes(forbidden), `JS visual v22 contém dado operacional indevido: ${forbidden}`);
}

console.log('PASS  v22: polimento visual desacoplado dos dados oficiais e integrado ao PWA.');
