import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('assets/study-hours-v1.js', 'utf8');
const css = fs.readFileSync('assets/study-hours-v1.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(index, /study-hours-v1\.css\?v=4/, 'CSS de horas não foi ligado ao index');
assert.match(index, /study-hours-v1\.js\?v=4/, 'JS de horas não foi ligado ao index');
assert.match(js, /central-estudos\/data\/federated-status\.json/, 'Fonte federada incorreta');
assert.match(js, /study-hours-history\.json/, 'Fonte do histórico reconstruído não foi integrada');
assert.match(js, /central-estudos:study-log-v1/, 'Registro local confirmado da Central de Estudos não foi integrado');
assert.match(js, /creditFingerprint/, 'Deduplicação entre crédito automático e registro local ausente');
assert.match(js, /coalescePublicCredits/, 'Coalescência de leitura + estudo da mesma unidade ausente');
assert.match(js, /droppedReadingShadows/, 'Contagem de créditos redundantes absorvidos ausente');
for (const project of ['seedf', 'tjdft', 'prf-adm']) {
  assert.ok(js.includes(project), `Projeto ativo ausente: ${project}`);
}
assert.match(js, /integrity === "aligned"/, 'Créditos devem exigir fonte alinhada');
assert.match(js, /study\?\.evidence === "confirmed"/, 'Créditos devem exigir evidência confirmada');
assert.match(js, /todayMinutes/, 'KPI Hoje ausente');
assert.match(js, /weekMinutes/, 'KPI Semana ausente');
assert.match(js, /monthMinutes/, 'KPI Mês ausente');
assert.match(js, /activeDays/, 'KPI acumulado/dias ativos ausente');
assert.match(js, /historicalMinutes/, 'Total histórico estimado ausente');
assert.match(js, /journeyMinutes/, 'Total estimado da jornada ausente');
assert.match(css, /@media\(max-width:640px\)/, 'Tratamento responsivo móvel ausente');
assert.ok(sw.includes('study-hours-v1.js') && sw.includes('study-hours-v1.css'), 'PWA não inclui os novos assets');
assert.ok(sw.includes('study-hours-history.json'), 'PWA não inclui o histórico de horas');
const history = JSON.parse(fs.readFileSync('data/study-hours-history.json', 'utf8'));
assert.equal(history.summary.historicalEstimateMinutes, 35580, 'Total histórico reconstruído divergente');
assert.equal(history.summary.historicalEstimateHours, 593, 'Total histórico em horas divergente');
assert.deepEqual(history.method.rules, { studyMinutes: 60, reviewMinutes: 120, simulationMinutes: 180 }, 'Regra histórica divergente');
assert.equal(history.currentCycleStartsAt, '2026-09-21', 'Marco entre histórico e ciclo atual divergente');

console.log('study-hours-v1-static: ok');
