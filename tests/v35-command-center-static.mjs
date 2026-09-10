import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, app, intelligence, shellStyles, phaseStyles] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('assets/work-intelligence-v10.js', 'utf8'),
  fs.readFile('assets/work-app.css', 'utf8'),
  fs.readFile('assets/pre-post-v33.css', 'utf8'),
]);

for (const value of [
  'sheet-nav-group',
  'sheet-more-group',
  'Navegação principal',
  'Mais áreas',
]) assert.ok(index.includes(value), `HTML sem ${value}`);

for (const value of [
  'LOCAL_ALERT_STATE_KEY',
  'data-alert-toggle',
  'data-calendar-event',
  'function exportCalendarEvent',
  'relativeDateLabel',
  'preexam-project-dossier',
  'Dossiê de prontidão',
  'PUBLICAÇÃO PÚBLICA',
  'Acompanhado',
]) assert.ok(app.includes(value), `app sem ${value}`);

assert.ok(intelligence.includes('window.__PLANO_UI_RELEASE__ || \'v10\''), 'Interface gerencial ainda não usa a versão publicada.');
assert.ok(!intelligence.includes('<strong>v10</strong>'), 'Interface gerencial ainda exibe v10 fixo.');

for (const value of [
  '.sheet-more-group',
  '.sheet-nav-label',
  '.privacy-panel',
]) assert.ok(shellStyles.includes(value), `CSS do shell sem ${value}`);

for (const value of [
  '.preexam-project-dossier',
  '.preexam-alert__actions',
  '.postexam-milestone__actions',
  '.local-alert-action',
]) assert.ok(phaseStyles.includes(value), `CSS das fases sem ${value}`);

assert.ok(index.includes('__PLANO_UI_RELEASE__ = "v35"'));
assert.ok(index.includes('work-app.js?v=35&home=37'));

console.log('PASS  v35: central, alertas locais, calendário e dossiê pré-edital presentes.');
