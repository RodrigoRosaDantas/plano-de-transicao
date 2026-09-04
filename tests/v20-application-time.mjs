import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, baseModule, v20] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('assets/exam-day-v19.js', 'utf8'),
  fs.readFile('assets/exam-day-v20.js', 'utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);
const lacks = (text, value, label) => assert.ok(!text.includes(value), `${label}: conteúdo indevido ${value}`);

has(index, 'assets/exam-day-v19.js?v=19', 'camada base v19');
has(index, 'assets/exam-day-v20.js?v=20', 'camada v20');
has(index, 'assets/exam-day-v20.css?v=20', 'estilo v20');
assert.ok(index.indexOf('exam-day-v20.js?v=20') > index.indexOf('exam-day-v19.js?v=19'), 'v20 deve carregar depois da v19');

has(sw, "'./assets/exam-day-v20.js'", 'PWA v20 JS');
has(sw, "'./assets/exam-day-v20.css'", 'PWA v20 CSS');

for (const value of ["open: '06:45'", "close: '07:45'", "open: '13:45'", "close: '14:45'", '<dd>4 horas</dd>']) {
  has(baseModule, value, 'dados oficiais preservados');
}

has(v20, "start: 'Não divulgado oficialmente'", 'início nominal');
has(v20, "end: '4h após o início efetivo'", 'término derivado da duração oficial');
has(v20, 'Não confundir fechamento do portão com início da prova', 'alerta operacional');
has(v20, '08:00–12:00 e 15:00–19:00 não devem ser tratados como horários oficiais', 'não transformar inferência em dado oficial');

for (const forbidden of ["start: '08:00'", "start: '15:00'", "end: '12:00'", "end: '19:00'"]) {
  lacks(v20, forbidden, 'não pode fixar horário nominal inferido');
}

console.log('PASS  v20: horários de aplicação auditados sem inventar início/término nominal.');
