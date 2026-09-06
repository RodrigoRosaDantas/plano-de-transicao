import assert from 'node:assert/strict';
import { syncSedesExams } from '../scripts/sedes-exams.mjs';

// Synthetic fixtures; no candidate attendance is recorded by this test.
const historic = { name: 'Caldas Novas', rawAccuracy: 73.33 };
const grouped = { name: 'SEDES/DF', role: 'TDAS 202 + EDAS 400', date: '2026-09-06', score: '—', rawAccuracy: null };
const completion = {
  project: 'EDAS 400', date: '2026-09-06', questions: null, hits: null, accuracy: null,
  score: null, maximum: null, classification: null, stage: '',
  status: 'Prova realizada — manhã; nota e classificação pendentes de registro.',
  url: 'https://example.com/synthetic-exam'
};
const result = syncSedesExams([historic, grouped], [completion]);
const edas = result.find(exam => exam.id === 'sedes-2026-edas');
const tdas = result.find(exam => exam.id === 'sedes-2026-tdas');
assert.equal(result.length, 3);
assert.deepEqual(result[0], historic);
assert.equal(edas.attendance, 'completed');
assert.equal(edas.session, 'Manhã');
assert.equal(edas.rawAccuracy, null);
assert.equal(edas.score, '—');
assert.equal(edas.weightedScore, undefined);
assert.equal(edas.classification, undefined);
assert.equal(tdas.attendance, 'unconfirmed');
assert.equal(tdas.session, 'Tarde');
assert.equal(tdas.rawAccuracy, null);
assert.deepEqual(syncSedesExams(result, [completion]), result, 'Repeated sync must not duplicate exams.');
assert.deepEqual(syncSedesExams(result, []), result, 'Unavailable source must preserve attendance.');

const later = syncSedesExams(result, [{ ...completion, questions: 50, hits: 0, score: 0, maximum: 100, classification: 23, stage: 'Objetiva' }]);
assert.equal(later[2].rawAccuracy, 0, 'An explicitly recorded zero is a valid result.');
assert.equal(later[2].score, '0/50');
assert.equal(later[2].weightedScore, '0/100');
assert.equal(later[2].classification, 23);
assert.deepEqual(later[1], tdas, 'EDAS results must not alter TDAS.');
assert.equal(syncSedesExams([grouped], [{ ...completion, date: '2025-09-06' }])[1].attendance, 'unconfirmed');
assert.equal(syncSedesExams([grouped], [{ ...completion, questions: 50 }])[1].rawAccuracy, null, 'A question count alone is not a zero score.');
console.log('PASS: EDAS/TDAS separados, realização sem nota, sincronização repetida e resultado posterior.');
