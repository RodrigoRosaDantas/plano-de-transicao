import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, js, css, score, followup, snapshotRaw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('assets/post-exam-v27.js', 'utf8'),
  fs.readFile('assets/post-exam-v27.css', 'utf8'),
  fs.readFile('assets/post-exam-score-v28.js', 'utf8'),
  fs.readFile('assets/post-exam-follow-up-v28.js', 'utf8'),
  fs.readFile('data/snapshot.json', 'utf8'),
]);
const snapshot = JSON.parse(snapshotRaw);
const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);

assert.equal(snapshot.meta?.phase, 'post-exam', 'snapshot precisa estar formalmente em pós-prova');
const sedes = (snapshot.exams || []).filter(exam => String(exam.id || '').startsWith('sedes-2026-'));
assert.equal(sedes.length, 2, 'devem existir dois registros SEDES independentes');
assert.ok(sedes.every(exam => exam.attendance === 'completed'), 'EDAS e TDAS precisam estar realizados');

for (const exam of sedes) {
  const preliminary = exam.scoreTracking?.preliminary || null;
  const definitive = exam.scoreTracking?.definitive || null;
  const tracked = definitive || preliminary;
  if (exam.rawAccuracy != null || (exam.weightedScore && exam.weightedScore !== '—')) {
    assert.ok(tracked, `${exam.role}: resultado numérico só pode existir com scoreTracking auditável`);
  }
  if (preliminary && !definitive) {
    assert.match(String(exam.status || ''), /Correção preliminar/i, `${exam.role}: nota baseada no preliminar precisa continuar rotulada como preliminar`);
  }
}

for (const asset of ['assets/post-exam-v27.css?v=27', 'assets/post-exam-v27.js?v=31']) has(index, asset, 'loader v27/v31');
assert.ok(index.indexOf('post-exam-v27.css?v=27') > index.indexOf('workspace-v26-polish.css?v=26'), 'CSS v27 deve sobrescrever o polimento anterior');
assert.ok(index.indexOf('post-exam-v27.js?v=31') > index.indexOf('workspace-v23.js?v=31'), 'JS v27 deve carregar depois do workspace');

for (const asset of ["'./assets/post-exam-v27.css'", "'./assets/post-exam-v27.js'", "'./assets/post-exam-score-v28.js'", "'./assets/transition-pages-v29.css'"]) {
  has(sw, asset, 'PWA pós-prova');
}
assert.ok(sw.includes("const CACHE='plano-transicao-v32-ipad-layout'"), 'cache PWA precisa usar as fases separadas v32');

for (const value of [
  'if (window.__PLANO_SEPARATE_POST_EXAM__) return;',
  'function v27ScoreTracking(exam)',
  'return Boolean(v27ScoreTracking(exam));',
  '[data-post-exam-page]',
  'data-v28-question-audit',
]) has(js + followup, value, 'arquitetura pós-prova');

assert.ok(!/rawAccuracy\s*=\s*\d/.test(js), 'camada v27 não pode fabricar resultado');
assert.ok(!/ranking\s*=\s*["']\d/.test(js), 'camada v27 não pode fabricar classificação');
has(index, 'data-view="pre-exam"', 'navegação pré-prova dedicada');
has(index, 'data-view="post-exam"', 'navegação pós-prova dedicada');
has(score, 'window.__planoPostExamAudit', 'auditoria exportada para a página dedicada');
has(followup, 'Auditoria questão a questão', 'auditoria detalhada no pós-prova');
has(score + followup, 'sujeito a recurso e alteração', 'gabarito preliminar identificado como provisório');

for (const value of [
  'body.post-exam-v27 .command-view > .priority-grid',
  'body.post-exam-v27 .command-view > .focus-board',
  '.post-exam-v27-shell .exam21-hero.v27-hero',
  '.v27-disclosure',
  '@media(max-width:430px)'
]) has(css, value, 'CSS legado preservado sem ativação automática');

console.log('PASS  v27: camada legada permanece preservada, mas o pós-prova detalhado fica na página dedicada com auditoria preliminar rastreável.');
