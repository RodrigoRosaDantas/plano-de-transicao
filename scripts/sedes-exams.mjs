const roles = [
  { id: 'tdas', project: 'TDAS 202', role: 'TDAS 202 — Técnico Administrativo', session: 'Tarde' },
  { id: 'edas', project: 'EDAS 400', role: 'EDAS 400 — Administração', session: 'Manhã' }
];

// Attendance and score are independent: an ungraded exam is not a future exam.
export function syncSedesExams(previousExams, records = []) {
  const exams = previousExams.flatMap(exam => {
    if (exam.name !== 'SEDES/DF' || exam.role !== 'TDAS 202 + EDAS 400' || exam.date !== '2026-09-06') return [exam];
    return roles.map(({ id, role, session }) => ({
      name: exam.name, id: `sedes-2026-${id}`, role, session, date: exam.date,
      attendance: 'unconfirmed', score: '—', rawAccuracy: null, ranking: '—',
      status: 'Realização não confirmada.'
    }));
  });
  return exams.map(exam => {
    const role = roles.find(item => exam.id === `sedes-2026-${item.id}`);
    if (!role) return exam;
    const record = records.find(item => item.project === role.project && item.date?.slice(0, 10) === exam.date);
    if (!record) return exam;
    const { questions, hits, accuracy, score, maximum, classification, stage } = record;
    const counted = Number.isFinite(questions) && questions > 0 && Number.isFinite(hits) && hits >= 0 && hits <= questions;
    const rawAccuracy = Number.isFinite(accuracy) ? accuracy : counted ? Math.round(hits / questions * 10000) / 100 : exam.rawAccuracy;
    return {
      ...exam,
      attendance: 'completed',
      score: counted ? `${hits}/${questions}` : exam.score,
      rawAccuracy,
      weightedScore: Number.isFinite(score) && maximum > 0 ? `${score}/${maximum}` : exam.weightedScore,
      classification: classification ?? exam.classification,
      classificationStage: stage || exam.classificationStage,
      ranking: classification != null ? `${classification.toLocaleString('pt-BR')}º${stage ? ` · ${stage}` : ''}` : exam.ranking,
      status: record.status || exam.status,
      sourceUrl: record.url || exam.sourceUrl
    };
  });
}
