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

const examById = id => (snapshot.exams || []).find(exam => exam.id === id) || null;
const tdas = examById('sedes-2026-tdas');
const edas = examById('sedes-2026-edas');
const tdasPreliminary = tdas?.scoreTracking?.preliminary || snapshot.postExam?.scoring?.tdas?.preliminary || null;
const edasPreliminary = edas?.scoreTracking?.preliminary || snapshot.postExam?.scoring?.edas?.preliminary || null;
const tdasDefinitive = tdas?.scoreTracking?.definitive || snapshot.postExam?.scoring?.tdas?.definitive || null;
const edasDefinitive = edas?.scoreTracking?.definitive || snapshot.postExam?.scoring?.edas?.definitive || null;
const hasPreliminary = Boolean(tdasPreliminary || edasPreliminary);
const hasDefinitive = Boolean(tdasDefinitive || edasDefinitive);

snapshot.meta = {
  ...snapshot.meta,
  phase: 'post-exam',
  nextExam: null,
  postExamNormalizedAt: new Date(now).toISOString(),
  postExamDate: '2026-09-06'
};

snapshot.mission = 'Transformar as provas realizadas em diagnóstico, correção, recursos, resultado e próxima decisão de carreira.';

snapshot.priorities = (snapshot.priorities || []).map((item) => {
  if (item.id === 'tdas') {
    if (tdasDefinitive?.total != null || tdasDefinitive?.totalScore != null) return { ...item, status: 'Gabarito definitivo incorporado · acompanhar resultado/classificação' };
    if (tdasPreliminary?.total != null || tdasPreliminary?.totalScore != null) return { ...item, status: `Correção preliminar: ${tdasPreliminary.total ?? tdasPreliminary.totalScore}/100 · recursos e definitivo pendentes` };
    return { ...item, status: 'Prova realizada · aguardando correção oficial' };
  }
  if (item.id === 'edas') {
    if (edasDefinitive?.total != null || edasDefinitive?.totalScore != null) return { ...item, status: 'Gabarito definitivo incorporado · acompanhar resultado/classificação' };
    if (edasPreliminary?.total != null || edasPreliminary?.totalScore != null) return { ...item, status: `Correção preliminar: ${edasPreliminary.total ?? edasPreliminary.totalScore}/100 · recursos e definitivo pendentes` };
    return { ...item, status: 'Prova realizada · aguardando correção oficial' };
  }
  return item;
});

snapshot.exams = (snapshot.exams || []).map((exam) => {
  if (!String(exam.name || '').includes('SEDES')) return exam;
  const preliminary = exam?.scoreTracking?.preliminary;
  const definitive = exam?.scoreTracking?.definitive;
  const total = definitive?.total ?? definitive?.totalScore ?? preliminary?.total ?? preliminary?.totalScore ?? null;
  const stage = definitive ? 'definitiva' : preliminary ? 'preliminar' : null;
  return {
    ...exam,
    status: stage && total != null
      ? `Correção ${stage}: ${total}/100 · resultado e classificação oficiais pendentes`
      : 'Provas realizadas em 06/09/2026 · aguardando gabarito e resultado',
    rawAccuracy: exam.rawAccuracy ?? null
  };
});

snapshot.timeline = (snapshot.timeline || []).map((item) => {
  if (item.date !== '06/09/2026' || item.title !== 'SEDES/DF') return item;
  return {
    ...item,
    detail: hasPreliminary
      ? 'EDAS e TDAS realizadas em 06/09/2026. Gabarito preliminar incorporado; o ciclo está em auditoria de questões, recursos e acompanhamento do resultado objetivo.'
      : 'EDAS e TDAS realizadas em 06/09/2026. O ciclo entrou em correção, auditoria de questões, recursos e acompanhamento de resultado.'
  };
});

snapshot.strategy = {
  ...(snapshot.strategy || {}),
  current: hasPreliminary
    ? 'As provas SEDES/DF foram concluídas e a correção preliminar está registrada. A SEDES segue em recursos, gabarito definitivo e classificação, enquanto SEEDF e TJDFT avançam como projetos separados da nova preparação.'
    : 'As provas SEDES/DF foram concluídas em 06/09/2026. A prioridade agora é registrar a prova, corrigir pelo gabarito oficial, identificar recursos e acompanhar o resultado.'
};

const previousPostExam = snapshot.postExam || {};
const scoreState = hasDefinitive
  ? `Gabarito definitivo incorporado${tdasDefinitive ? ` · TDAS ${tdasDefinitive.total ?? tdasDefinitive.totalScore}/100` : ''}${edasDefinitive ? ` · EDAS ${edasDefinitive.total ?? edasDefinitive.totalScore}/100` : ''}`
  : hasPreliminary
    ? `Estimativas preliminares${tdasPreliminary ? ` · TDAS ${tdasPreliminary.total ?? tdasPreliminary.totalScore}/100` : ''}${edasPreliminary ? ` · EDAS ${edasPreliminary.total ?? edasPreliminary.totalScore}/100` : ''}`
    : 'Não calculado sem gabarito oficial';

snapshot.postExam = {
  ...previousPostExam,
  phase: 'active',
  examDate: '2026-09-06',
  examsCompleted: ['EDAS · Cargo 400', 'TDAS · Cargo 202'],
  resultState: hasDefinitive
    ? 'Gabarito definitivo incorporado · resultado/classificação oficial pendente'
    : hasPreliminary
      ? 'Gabarito preliminar incorporado · resultado objetivo oficial pendente'
      : 'Aguardando gabarito e resultado oficiais',
  scoreState,
  nextActions: hasPreliminary
    ? [
        'Auditar as divergências candidato × banca e separar somente questões com fundamento real para recurso.',
        'Acompanhar respostas aos recursos e gabarito definitivo sem tratar a estimativa atual como resultado oficial.',
        'Manter a leitura competitiva como preliminar: taxa nominal de avanço não é probabilidade pessoal.',
        'Atualizar posição provável apenas quando houver distribuição oficial de notas, nota de corte ou classificação objetiva.',
        'Registrar a lista de candidatos com discursiva corrigida quando publicada e então recalibrar o cenário.'
      ]
    : [
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
  resultState: snapshot.postExam.resultState,
  scoreState: snapshot.postExam.scoreState,
  scoringPreserved: Boolean(snapshot.postExam.scoring),
  competitionReadingPreserved: Boolean(snapshot.postExam.competitionReading)
}, null, 2));