import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, js, css, shellJs, shellCss, bootstrap] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('assets/exam-day-v21.js', 'utf8'),
  fs.readFile('assets/exam-day-v21.css', 'utf8'),
  fs.readFile('assets/exam-day-v21-shell.js', 'utf8'),
  fs.readFile('assets/exam-day-v21-shell.css', 'utf8'),
  fs.readFile('assets/exam-day-v21-bootstrap.js', 'utf8')
]);

const has = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);
const lacks = (text, value, label) => assert.ok(!text.includes(value), `${label}: conteúdo indevido ${value}`);

// Integração do shell e ordem de carregamento.
for (const asset of [
  'assets/exam-day-v21-bootstrap.js?v=21',
  'assets/exam-day-v21.css?v=21',
  'assets/exam-day-v21-shell.css?v=21',
  'assets/exam-day-v21.js?v=21',
  'assets/exam-day-v21-shell.js?v=21'
]) has(index, asset, 'index v21');
assert.ok(index.indexOf('exam-day-v21-bootstrap.js?v=21') < index.indexOf('assets/work-app.css?v=15'), 'bootstrap precisa nascer no head antes do app-base');
assert.ok(index.indexOf('exam-day-v21.js?v=21') > index.indexOf('exam-day-v20.js?v=20'), 'v21 deve carregar depois da v20');
assert.ok(index.indexOf('exam-day-v21-shell.js?v=21') > index.indexOf('exam-day-v21.js?v=21'), 'shell v21 deve carregar após a aba');

for (const asset of [
  "'./assets/exam-day-v21-bootstrap.js'",
  "'./assets/exam-day-v21.css'",
  "'./assets/exam-day-v21-shell.css'",
  "'./assets/exam-day-v21.js'",
  "'./assets/exam-day-v21-shell.js'"
]) has(sw, asset, 'PWA v21');

// Aba própria e acesso por hash.
has(js, "'#exam-day'", 'hash da aba');
has(js, 'data-exam-day-tab', 'navegação dedicada');
has(js, "document.getElementById('mainTabs')", 'aba desktop');
has(js, "document.getElementById('mobileDock')", 'aba mobile');
has(js, "#moreSheet .sheet-grid", 'atalho no Mais');
has(css, '#examDayControl{display:none!important}', 'bloco antigo fora da Home');
has(shellCss, 'body.exam-day-active .mission-strip', 'shell dedicado sem faixa da Home');
has(shellCss, 'body.exam-day-active .context-line', 'shell dedicado sem contexto da Home');
has(shellJs, "location.hash === '#exam-day'", 'estado dedicado do shell');
has(shellJs, "closeMoreSheetForExamDay();\n  document.body.classList.add('exam-day-active')", 'fecha Mais imediatamente ao entrar');
has(bootstrap, "const directExamDay = location.hash === '#exam-day'", 'captura deep link antes do roteador-base');
has(bootstrap, "history.replaceState(null, '', '#exam-day')", 'restaura deep link após inicialização');
has(bootstrap, "window.dispatchEvent(new HashChangeEvent('hashchange'))", 'aciona a view dedicada restaurada');

// Dados oficiais preservados.
for (const value of [
  "code: 'EDAS · CARGO 400'", "room: '1820'", "floor: 'T'", "open: '06:45'", "close: '07:45'",
  "code: 'TDAS · CARGO 202'", "room: '1830'", "floor: '1'", "open: '13:45'", "close: '14:45'",
  '4 horas', '2h após o início', 'últimos 60 minutos'
]) has(js, value, 'dado oficial');

// Não transformar inferência em horário oficial.
has(js, 'Não divulgado oficialmente', 'início nominal não publicado');
has(js, '4h após o início efetivo', 'término dependente do início real');
has(js, 'fechamento do portão não é rotulado como início da prova', 'regra de não inferência');
for (const forbidden of ["start: '08:00'", "start: '15:00'", "end: '12:00'", "end: '19:00'"]) lacks(js, forbidden, 'horário nominal inferido proibido');

// UX, acessibilidade e responsividade.
has(js, "plano-transicao:exam-day-v19:checks", 'checklist persistente compatível');
has(js, 'aria-label="Linha do tempo de domingo"', 'timeline acessível');
has(css, '@media(max-width:760px)', 'mobile 760');
has(css, '@media(max-width:430px)', 'mobile estreito');
has(css, '.exam21-check:focus-within', 'foco de teclado');
has(css, '.mobile-dock [data-view="journey"]{display:none!important}', 'dock móvel sem excesso');
has(shellCss, '.exam21-summary>*', 'grid children podem encolher');
has(shellCss, '.exam21-timeline{width:100%;overflow-x:auto', 'timeline rola dentro do próprio card');
has(shellCss, '.exam21-shell{width:100%;overflow-x:clip}', 'shell impede vazamento horizontal residual');

// Privacidade: não publicar identificadores pessoais dos CCIs.
const publicBundle = `${index}\n${js}\n${css}\n${shellJs}\n${shellCss}\n${bootstrap}`;
assert.ok(!/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(publicBundle), 'CPF formatado detectado no bundle público');
assert.ok(!/Inscri[cç][aã]o:\s*\d+/i.test(publicBundle), 'número de inscrição detectado no bundle público');
assert.ok(!/Documento:\s*RG\s*\d+/i.test(publicBundle), 'RG detectado no bundle público');

console.log('PASS  v21: aba Dia da Prova integrada, responsiva, auditada e sem inferir horário nominal.');
