import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, css, sw] = await Promise.all([
  fs.readFile('index.html','utf8'),
  fs.readFile('assets/workspace-v26-polish.css','utf8'),
  fs.readFile('sw.js','utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);

has(index, 'assets/workspace-v26-polish.css?v=26', 'loader v26 direto no index');
assert.ok(index.indexOf('workspace-v26-polish.css?v=26') > index.indexOf('workspace-v24-hardening.css?v=24'), 'v26 deve carregar após o hardening v24.');
has(sw, "'./assets/workspace-v26-polish.css'", 'PWA precache v26');

has(css, '--v26-surface-raised', 'design token de profundidade');
has(css, '.performance-score', 'refino de Desempenho');
has(css, '.journey-flow::before', 'identidade visual da Jornada');
has(css, 'ACOMPANHAMENTO', 'agrupamento visual da sidebar');
has(css, 'PLANO', 'grupo Plano da sidebar');
has(css, 'SISTEMA', 'grupo Sistema da sidebar');
has(css, '.mobile-dock', 'acabamento mobile');
has(css, '@media(prefers-reduced-motion:reduce)', 'acessibilidade de movimento');
has(css, 'font-size:max(.84rem,13px)', 'legibilidade mínima mobile');
has(css, 'box-shadow:var(--v26-shadow)', 'profundidade controlada');

// Refinamento visual não pode carregar dados operacionais ou reintroduzir a v25.
for (const forbidden of [
  '06:45','07:45','13:45','14:45','Sala 1820','Sala 1830','CPF','Inscrição:',
  'exam-ops-v25','FASE AUTOMÁTICA','Próximo marco oficial'
]) {
  assert.ok(!css.includes(forbidden), `v26 visual não deve conter conteúdo operacional: ${forbidden}`);
}

console.log('PASS  v26: refinamento exclusivamente visual, carregado após v24, com PWA, legibilidade e sem dados operacionais.');
