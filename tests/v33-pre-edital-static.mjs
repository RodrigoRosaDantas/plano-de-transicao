import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, app, css, sw, snapshotRaw] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('assets/work-app.js', 'utf8'),
  fs.readFile('assets/pre-post-v33.css', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('data/snapshot.json', 'utf8'),
]);
const snapshot = JSON.parse(snapshotRaw);
const radar = snapshot.preExamRadar;

assert.equal(radar?.version, 'pre-edital-radar-v1');
assert.deepEqual(Object.keys(radar.projects || {}).sort(), ['seedf', 'tjdft']);
assert.ok(radar.projects.tjdft.roles.some((role) => role.name === 'Técnico Judiciário'));
assert.ok(radar.projects.tjdft.roles.some((role) => role.name === 'Analista Judiciário'));
assert.ok(radar.projects.seedf.roles.some((role) => role.name === 'Gestor'));
assert.ok(radar.projects.seedf.roles.some((role) => role.name === 'Analista'));
assert.ok(radar.projects.seedf.roles.some((role) => role.name === 'Monitor'));
assert.ok(radar.projects.seedf.news.some((item) => item.kind === 'external'));
assert.ok(radar.alerts.length >= 4);

for (const value of [
  'Radar pré-edital: TJDFT e SEEDF',
  'data-pre-exam-filter',
  'data-pre-exam-project',
  'Cargos no radar',
  'Notícias e sinais',
  'ALERTAS QUE MUDAM O PLANO',
  'function postExamView',
  'CRONOGRAMA SEDES/DF',
  'postexam-cargo-grid',
  'postexam-milestone-list',
]) assert.ok(app.includes(value), `app sem ${value}`);

for (const value of [
  'https://www.tjdft.jus.br/informacoes/concursos/analista-e-tecnico-judiciario',
  'https://www.educacao.df.gov.br',
  'https://dodf.df.gov.br/',
  'https://blog.grancursosonline.com.br/concurso-sedf/',
]) assert.ok(snapshotRaw.includes(value), `snapshot sem fonte ${value}`);

for (const value of [
  '.preexam-project-grid',
  '.preexam-news-badge--external',
  '.preexam-alert-grid',
  '.postexam-action-panel',
  '.postexam-cargo-grid',
  '.postexam-milestone',
]) assert.ok(css.includes(value), `CSS sem ${value}`);

assert.ok(index.includes('pre-post-v33.css?v=33'));
assert.ok(index.includes('aria-label="Pré-prova / Pré-edital"'));
assert.ok(sw.includes("const CACHE='plano-transicao-v33-pre-edital'"));
assert.ok(sw.includes("'./assets/pre-post-v33.css'"));

console.log('PASS  v33: radar pré-edital de TJDFT/SEEDF e comando pós-prova SEDES/DF estruturados.');
