import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, v21, js, css, workflow] = await Promise.all([
  fs.readFile('index.html','utf8'),
  fs.readFile('sw.js','utf8'),
  fs.readFile('assets/exam-day-v21.js','utf8'),
  fs.readFile('assets/exam-ops-v25.js','utf8'),
  fs.readFile('assets/exam-ops-v25.css','utf8'),
  fs.readFile('.github/workflows/quality.yml','utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);
const lacks = (text, value, label) => assert.ok(!text.includes(value), `${label}: conteúdo indevido ${value}`);

has(index, 'assets/exam-ops-v25.css?v=25', 'CSS v25 direto no index');
has(index, 'assets/exam-ops-v25.js?v=25', 'JS v25 direto no index');
has(sw, "'./assets/exam-ops-v25.css'", 'PWA CSS v25');
has(sw, "'./assets/exam-ops-v25.js'", 'PWA JS v25');
has(sw, "url.pathname.includes('/assets/exam-ops-v')", 'v25 usa estratégia de asset operacional no PWA');
has(workflow, 'node tests/v25-exam-ops-static.mjs', 'workflow executa auditoria estática v25');
has(workflow, 'node tests/v25-exam-ops-ui.mjs', 'workflow executa UI v25');

for (const official of [
  "openIso: '2026-09-06T06:45:00-03:00'",
  "closeIso: '2026-09-06T07:45:00-03:00'",
  "openIso: '2026-09-06T13:45:00-03:00'",
  "closeIso: '2026-09-06T14:45:00-03:00'"
]) has(v21, official, 'v21 preserva marco oficial');

for (const milestone of [
  "at: '2026-09-06T06:45:00-03:00'",
  "at: '2026-09-06T07:45:00-03:00'",
  "at: '2026-09-06T13:45:00-03:00'",
  "at: '2026-09-06T14:45:00-03:00'"
]) has(js, milestone, 'v25 deriva automação dos mesmos marcos oficiais');

for (const feature of [
  'FASE AUTOMÁTICA',
  'DIRETRIZ DO PLANO',
  'CONTAGEM PARA O PRÓXIMO MARCO',
  'PROGRESSO DA JANELA DE PORTÕES',
  'PRÓXIMO MARCO OFICIAL',
  '.command-view .countdown-card',
  '.exam21-shell',
  'data-v25-open-exam'
]) has(js, feature, 'recurso funcional v25');

has(js, 'não substitui instrução oficial da equipe de aplicação', 'automação não se apresenta como regra oficial');
has(js, 'Isto acompanha os portões, não a duração das provas.', 'progresso não confunde portões com duração');
for (const invented of ["'08:00'", "'15:00'", "'12:00'", "'19:00'"]) lacks(js, invented, 'v25 não inventa início/término nominal');

for (const token of ['@media(max-width:980px)','@media(max-width:640px)','@media(max-width:390px)','prefers-reduced-motion']) {
  has(css, token, 'responsividade/acessibilidade v25');
}

// V25 complementa a Home existente; não cria nova navegação global nem substitui o foco do workspace.
lacks(js, 'Hoje</', 'v25 não cria aba Hoje da referência');
lacks(js, 'Agenda</', 'v25 não cria aba Agenda da referência');
lacks(js, 'Mentor</', 'v25 não cria aba Mentor da referência');

const publicBundle = `${index}\n${js}\n${css}`;
assert.ok(!/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(publicBundle), 'CPF formatado detectado no bundle v25');
assert.ok(!/Inscri[cç][aã]o:\s*\d+/i.test(publicBundle), 'número de inscrição detectado no bundle v25');
assert.ok(!/Documento:\s*RG\s*\d+/i.test(publicBundle), 'RG detectado no bundle v25');

console.log('PASS  v25: recursos operacionais adicionados sem trocar o foco ou inventar horários de prova.');
