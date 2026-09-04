import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [index, sw, moduleJs, moduleCss] = await Promise.all([
  fs.readFile('index.html', 'utf8'),
  fs.readFile('sw.js', 'utf8'),
  fs.readFile('assets/exam-day-v19.js', 'utf8'),
  fs.readFile('assets/exam-day-v19.css', 'utf8')
]);

const mustContain = (text, value, label) => assert.ok(text.includes(value), `${label}: ausente ${value}`);
const mustNotContain = (text, value, label) => assert.ok(!text.includes(value), `${label}: conteúdo indevido ${value}`);

// Build/cache integrity.
mustContain(index, 'assets/exam-day-v19.css?v=19', 'index CSS v19');
mustContain(index, 'assets/exam-day-v19.js?v=19', 'index JS v19');
mustNotContain(index, 'assets/exam-day-v16.css?v=17', 'index não pode apontar para CSS antigo');
mustNotContain(index, 'assets/exam-day-v16.js?v=17', 'index não pode apontar para JS antigo');
mustContain(sw, "const CACHE='plano-transicao-v19'", 'service worker cache');
mustContain(sw, "'./assets/exam-day-v19.css'", 'service worker CSS');
mustContain(sw, "'./assets/exam-day-v19.js'", 'service worker JS');
mustContain(sw, 'fetch(req)', 'exam assets devem tentar rede primeiro');

// Official CCI data: EDAS.
for (const value of [
  "dateLabel: 'DOMINGO · 06/09/2026'",
  "id: 'edas'",
  "code: 'EDAS · CARGO 400'",
  "title: 'Administração'",
  "room: '1820'",
  "block: '1'",
  "floor: 'T'",
  "open: '06:45'",
  "close: '07:45'"
]) mustContain(moduleJs, value, 'EDAS');

// Official CCI data: TDAS.
for (const value of [
  "id: 'tdas'",
  "code: 'TDAS · CARGO 202'",
  "title: 'Técnico Administrativo'",
  "room: '1830'",
  "block: '1'",
  "floor: '1'",
  "open: '13:45'",
  "close: '14:45'"
]) mustContain(moduleJs, value, 'TDAS');

// Shared venue and official limits.
mustContain(moduleJs, 'Centro de Ensino Fundamental Telebrasília — Riacho Fundo I', 'local');
mustContain(moduleJs, '4 horas', 'duração');
mustContain(moduleJs, 'Não há hora nominal de início publicada', 'sem horário inventado');
mustContain(moduleJs, 'Sem tolerância:', 'fechamento sem tolerância');
mustContain(moduleJs, '<strong>últimos 60 minutos</strong>', 'regra do caderno');
mustContain(moduleJs, '2 horas após o início', 'permanência mínima');

// Operational UX corrections.
mustContain(moduleJs, 'Saída + almoço + retorno', 'intervalo explícito');
mustContain(moduleJs, '!Array.isArray(parsed)', 'localStorage robusto');
mustContain(moduleCss, 'focus-within', 'foco de teclado no checklist');

// Public site must not embed common formatted personal identifiers from the CCI.
const publicBundle = `${index}\n${moduleJs}\n${moduleCss}`;
assert.ok(!/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(publicBundle), 'CPF formatado detectado no bundle público');
assert.ok(!/Inscri[cç][aã]o:\s*\d+/i.test(publicBundle), 'número de inscrição detectado no bundle público');
assert.ok(!/Documento:\s*RG\s*\d+/i.test(publicBundle), 'RG detectado no bundle público');

console.log('PASS  v19 Dia da Prova: dados, cache, UX e privacidade auditados.');
