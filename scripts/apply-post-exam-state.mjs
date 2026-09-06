import fs from 'node:fs/promises';

const snapshotPath = new URL('../data/snapshot.json', import.meta.url);
const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));

// Marco conservador posterior ao encerramento das duas aplicações de 06/09/2026.
// A partir daqui o site não pode regredir para "reta final" ou "próxima prova"
// só porque uma fonte editorial ainda não foi atualizada.
const POST_EXAM_AT = Date.parse('2026-09-06T22:30:00.000Z'); // 19:30 em Brasília
const now = Date.now();

if (now < POST_EXAM_AT) {
  console.log(JSON.stringify({ ok: true, applied: false, reason: 'pre-exam-cutoff' }));
  process.exit(0);
}

snapshot.meta = {
  ...snapshot.meta,
  phase: 'post-exam',
  nextExam: null,
  postExamNormalizedAt: new Date(now).toISOString(),
  postExamDate: '2026-09-06'
};

snapshot.mission = 'Transformar as provas realizadas em diagnóstico, correção, recursos, resultado e próxima decisão de carreira.';

snapshot.priorities = (snapshot.priorities || []).map((item) => {
  if (item.id === 'tdas') return { ...item, status: 'Prova realizada · aguardando correção oficial' };
  if (item.id === 'edas') return { ...item, status: 'Prova realizada · aguardando correção oficial' };
  return item;
});

snapshot.exams = (snapshot.exams || []).map((exam) => {
  if (!String(exam.name || '').includes('SEDES')) return exam;
  return {
    ...exam,
    status: 'Provas realizadas em 06/09/2026 · aguardando gabarito e resultado',
    rawAccuracy: exam.rawAccuracy ?? null
  };
});

snapshot.timeline = (snapshot.timeline || []).map((item) => {
  if (item.date !== '06/09/2026' || item.title !== 'SEDES/DF') return item;
  return {
    ...item,
    detail: 'EDAS e TDAS realizadas em 06/09/2026. O ciclo entrou em correção, auditoria de questões, recursos e acompanhamento de resultado.'
  };
});

snapshot.strategy = {
  ...(snapshot.strategy || {}),
  current: 'As provas SEDES/DF foram concluídas em 06/09/2026. A prioridade agora é registrar a prova, corrigir pelo gabarito oficial, identificar recursos, calcular o resultado e só então decidir o próximo alvo.'
};

snapshot.postExam = {
  phase: 'active',
  examDate: '2026-09-06',
  examsCompleted: ['EDAS · Cargo 400', 'TDAS · Cargo 202'],
  resultState: 'Aguardando gabarito e resultado oficiais',
  scoreState: 'Não calculado sem gabarito oficial',
  nextActions: [
    'Registrar impressões e memória das duas provas enquanto ainda estão frescas.',
    'Corrigir apenas contra gabarito oficial ou versão auditada.',
    'Separar questões passíveis de recurso antes de consolidar a nota.',
    'Calcular nota, posição provável e cenários somente com dados oficiais disponíveis.',
    'Fechar o diagnóstico do ciclo antes de escolher o próximo concurso-alvo.'
  ]
};

await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  applied: true,
  phase: snapshot.meta.phase,
  sedesStatus: snapshot.exams.find((exam) => String(exam.name || '').includes('SEDES'))?.status || null
}, null, 2));
