import fs from 'node:fs/promises';

const snapshotUrl = new URL('../data/snapshot.json', import.meta.url);
const keysUrl = new URL('../data/official-keys.json', import.meta.url);

const snapshot = JSON.parse(await fs.readFile(snapshotUrl, 'utf8'));
const keys = JSON.parse(await fs.readFile(keysUrl, 'utf8'));

const exam = (snapshot.exams || []).find(item => item.id === 'sedes-2026-tdas');
const candidate = exam?.candidateResponse;
const preliminary = keys?.tdas202?.preliminary;
const definitive = keys?.tdas202?.definitive;

function normalizeKeyEntry(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(normalized)) return normalized;
  if (['ANULADA', 'ANULADO', 'X', '*'].includes(normalized)) return 'ANULADA';
  return null;
}

function scoreWith(keyBlock, stage) {
  if (!candidate || !keyBlock || keyBlock.status !== 'published' || !keyBlock.answers) return null;

  const results = [];
  let generalScore = 0;
  let specificScore = 0;
  let correct = 0;
  let wrong = 0;
  let annulled = 0;

  for (let q = 1; q <= 60; q += 1) {
    const official = normalizeKeyEntry(keyBlock.answers[q] ?? keyBlock.answers[String(q)]);
    if (!official) throw new Error(`Gabarito ${stage}: questão ${q} sem resposta válida.`);

    const candidateAnswer = candidate.answers?.[q] ?? candidate.answers?.[String(q)] ?? null;
    const points = q <= 20 ? 1 : 2;
    const block = q <= 20 ? 'geral' : 'específico';
    let status;
    let earned = 0;

    if (official === 'ANULADA') {
      status = 'anulada';
      earned = points;
      annulled += 1;
    } else if (candidateAnswer === official) {
      status = 'acerto';
      earned = points;
      correct += 1;
    } else if (candidateAnswer == null) {
      status = 'inválida-ou-em-branco';
      wrong += 1;
    } else {
      status = 'erro';
      wrong += 1;
    }

    if (q <= 20) generalScore += earned;
    else specificScore += earned;

    results.push({
      question: q,
      block,
      candidate: candidateAnswer,
      official,
      status,
      points: earned
    });
  }

  const total = generalScore + specificScore;
  const differences = results.filter(item => ['erro', 'inválida-ou-em-branco'].includes(item.status));

  return {
    stage,
    sourceUrl: keyBlock.sourceUrl || null,
    publishedAt: keyBlock.publishedAt || null,
    version: keyBlock.version || null,
    comparedAt: new Date().toISOString(),
    correct,
    wrong,
    annulled,
    generalScore,
    specificScore,
    totalScore: total,
    maxScore: 100,
    generalMinimumMet: generalScore >= 10,
    specificMinimumMet: specificScore >= 40,
    objectiveMinimumsMet: generalScore >= 10 && specificScore >= 40,
    differences,
    questions: results
  };
}

const preliminaryScore = scoreWith(preliminary, 'preliminary');
const definitiveScore = scoreWith(definitive, 'definitive');
const activeScore = definitiveScore || preliminaryScore || null;

snapshot.postExam = {
  ...(snapshot.postExam || {}),
  scoring: {
    ...(snapshot.postExam?.scoring || {}),
    tdas: {
      status: definitiveScore
        ? 'definitive-scored'
        : preliminaryScore
          ? 'preliminary-scored'
          : candidate
            ? 'candidate-response-ready'
            : 'candidate-response-pending',
      preliminary: preliminaryScore,
      definitive: definitiveScore,
      activeStage: definitiveScore ? 'definitive' : preliminaryScore ? 'preliminary' : null,
      estimatedScore: preliminaryScore?.totalScore ?? null,
      officialScoreFromKey: definitiveScore?.totalScore ?? null,
      estimatedGeneralScore: preliminaryScore?.generalScore ?? null,
      estimatedSpecificScore: preliminaryScore?.specificScore ?? null,
      differences: activeScore?.differences || [],
      lastComparedAt: activeScore?.comparedAt || null
    }
  }
};

if (exam) {
  exam.scoreTracking = {
    preliminary: preliminaryScore
      ? {
          total: preliminaryScore.totalScore,
          general: preliminaryScore.generalScore,
          specific: preliminaryScore.specificScore,
          status: 'estimativa baseada no gabarito preliminar'
        }
      : null,
    definitive: definitiveScore
      ? {
          total: definitiveScore.totalScore,
          general: definitiveScore.generalScore,
          specific: definitiveScore.specificScore,
          status: 'recalculo baseado no gabarito definitivo'
        }
      : null
  };
}

snapshot.meta = {
  ...(snapshot.meta || {}),
  postExamScoringUpdatedAt: new Date().toISOString()
};

await fs.writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  definitiveScore
    ? `TDAS recalculado pelo gabarito definitivo: ${definitiveScore.totalScore}/100.`
    : preliminaryScore
      ? `TDAS estimado pelo gabarito preliminar: ${preliminaryScore.totalScore}/100.`
      : 'TDAS pronto para cruzamento; aguardando gabarito oficial publicado.'
);
