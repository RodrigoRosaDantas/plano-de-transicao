import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, js, css, snapshotRaw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('assets/post-exam-v27.js', 'utf8'),
  fs.readFile('assets/post-exam-v27.css', 'utf8'),
  fs.readFile('data/snapshot.json', 'utf8'),
]);
const snapshot = JSON.parse(snapshotRaw);
const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);

assert.equal(snapshot.meta?.phase, 'post-exam', 'snapshot precisa estar formalmente em pós-prova');
const sedes = (snapshot.exams || []).filter(exam => String(exam.id || '').startsWith('sedes-2026-'));
assert.equal(sedes.length, 2, 'devem existir dois registros SEDES independentes');
assert.ok(sedes.every(exam => exam.attendance === 'completed'), 'EDAS e TDAS precisam estar realizados');
assert.ok(sedes.every(exam => exam.rawAccuracy == null), 'não pode inventar nota antes da correção');

for (const asset of ['assets/post-exam-v27.css?v=27', 'assets/post-exam-v27.js?v=27']) has(index, asset, 'index v27');
assert.ok(index.indexOf('post-exam-v27.css?v=27') > index.indexOf('workspace-v26-polish.css?v=26'), 'CSS v27 deve sobrescrever o polimento anterior');
assert.ok(index.indexOf('post-exam-v27.js?v=27') > index.indexOf('workspace-v23.js?v=23'), 'JS v27 deve carregar depois do workspace');

for (const asset of ["'./assets/post-exam-v27.css'", "'./assets/post-exam-v27.js'"]) has(sw, asset, 'PWA v27');
assert.ok(/const CACHE='plano-transicao-v(?:27|28)'/.test(sw), 'cache PWA precisa preservar compatibilidade com o pós-prova v27/v28');

for (const value of [
  "'Pós-prova'",
  'Provas concluídas. <em>Agora, gabarito, recursos e resultado.</em>',
  'gabarito → conferência → recursos → nota → classificação',
  'Registro do dia da prova',
  'Memória das provas',
  'plano-transicao:post-exam-v27:notes',
  "milestone.classList.add('v27-next-milestone')",
  "missionTitle.innerHTML = 'Provas concluídas. <em>Agora, transformar correção em decisão.</em>'"
]) has(js, value, 'comportamento pós-prova');

for (const value of [
  'body.post-exam-v27 .command-view > .priority-grid',
  'body.post-exam-v27 .command-view > .focus-board',
  '.post-exam-v27-shell .exam21-hero.v27-hero',
  '.v27-disclosure',
  '@media(max-width:430px)'
]) has(css, value, 'CSS pós-prova');

assert.ok(!/rawAccuracy\s*=\s*\d/.test(js), 'camada v27 não pode fabricar resultado');
assert.ok(!/ranking\s*=\s*["'`]\d/.test(js), 'camada v27 não pode fabricar classificação');

console.log('PASS  v27: modo pós-prova ativo, compacto e sem fabricar nota ou classificação.');
