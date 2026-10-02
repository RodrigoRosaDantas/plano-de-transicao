import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('assets/study-hours-v1.js', 'utf8');
const css = fs.readFileSync('assets/study-hours-v1.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(index, /study-hours-v1\.css\?v=1/, 'CSS de horas não foi ligado ao index');
assert.match(index, /study-hours-v1\.js\?v=1/, 'JS de horas não foi ligado ao index');
assert.match(js, /central-estudos\/data\/federated-status\.json/, 'Fonte federada incorreta');
for (const project of ['seedf', 'tjdft', 'prf-adm']) {
  assert.ok(js.includes(project), `Projeto ativo ausente: ${project}`);
}
assert.match(js, /integrity === "aligned"/, 'Créditos devem exigir fonte alinhada');
assert.match(js, /study\?\.evidence === "confirmed"/, 'Créditos devem exigir evidência confirmada');
assert.match(js, /todayMinutes/, 'KPI Hoje ausente');
assert.match(js, /weekMinutes/, 'KPI Semana ausente');
assert.match(js, /monthMinutes/, 'KPI Mês ausente');
assert.match(js, /activeDays/, 'KPI acumulado/dias ativos ausente');
assert.match(css, /@media\(max-width:640px\)/, 'Tratamento responsivo móvel ausente');
assert.ok(sw.includes('study-hours-v1.js') && sw.includes('study-hours-v1.css'), 'PWA não inclui os novos assets');

console.log('study-hours-v1-static: ok');
