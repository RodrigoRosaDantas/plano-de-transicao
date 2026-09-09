import fs from 'node:fs/promises';

const snapshotUrl = new URL('../data/snapshot.json', import.meta.url);
const keysUrl = new URL('../data/official-keys.json', import.meta.url);

const snapshot = JSON.parse(await fs.readFile(snapshotUrl, 'utf8'));
const keys = JSON.parse(await fs.readFile(keysUrl, 'utf8'));

const TARGETS = [
  {
    id: 'tdas',
    examId: 'sedes-2026-tdas',
    keyId: 'tdas202',
    role: 'TDAS 202 — Técnico Administrativo',
    examType: 'B',
    areas: [
      { id: 'specificCommon', label: 'Conhecimentos Específicos Comuns', from: 1, to: 20, points: 2, group: 'specific' },
      { id: 'specialty', label: 'Conhecimentos Específicos da Especialidade', from: 21, to: 40, points: 2, group: 'specific' },
      { id: 'general', label: 'Conhecimentos Gerais', from: 41, to: 60, points: 1, group: 'general' }
    ]
  },
  {
    id: 'edas',
    examId: 'sedes-2026-edas',
    keyId: 'edas400',
    role: 'EDAS 400 — Administração',
    examType: 'A',
    areas: [
      { id: 'general', label: 'Conhecimentos Gerais', from: 1, to: 20, points: 1, group: 'general' },
      { id: 'specificCommon', label: 'Conhecimentos Específicos Comuns', from: 21, to: 40, points: 2, group: 'specific' },
      { id: 'specialty', label: 'Conhecimentos Específicos da Especialidade', from: 41, to: 60, points: 2, group: 'specific' }
    ]
  }
];

const COMPETITION = {
  auditedAt: '2026-09-09',
  methodology: 'nominal-advancement-rate-not-personal-probability',
  sources: {
    contest: 'https://quadrix.org.br/informacoes/3056/',
    updatedNotice: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/b852c323-8771-4021-bbbd-8032e88e58e0.pdf',
    registrations: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/49fb4e92-f367-44a9-abc0-12e32eed31f8.pdf'
  },
  milestones: {
    objectivePreliminaryResult: '2026-10-13',
    objectiveDefinitiveAndDiscursiveCorrectionList: '2026-10-30',
    discursivePreliminaryResult: '2026-11-23',
    discursiveDefinitiveResult: '2026-12-11'
  },
  tdas: {
    registrationsAC: 68345,
    correctionSlotsAC: 2387,
    immediateVacanciesAC: 198,
    reservePositionsAC: 598,
    communitySample: {
      provider: 'Olho na Vaga',
      url: 'https://olhonavaga.com.br/rankings/ranking?id=92071',
      observedAt: '2026-09-09',
      participants: 4968,
      selfSelected: true
    }
  },
  edas: {
    registrationsAC: 4112,
    correctionSlotsAC: 282,
    immediateVacanciesAC: 23,
    reservePositionsAC: 70,
    communitySample: {
      provider: 'Olho na Vaga',
      url: 'https://olhonavaga.com.br/rankings/ranking?id=92478',
      observedAt: '2026-09-09',
      participants: 718,
      selfSelected: true
    }
  }
};

function pct(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 10000) / 100 : null;
}

function normalizeKeyEntry(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(normalized)) return normalized;
  if (['ANULADA', 'ANULADO', 'X', '*'].includes(normalized)) return 'ANULADA';
  return null;
}

function areaFor(target, question) {
  return target.areas.find(area => question >= area.from && question <= area.to) || null;
}

function scoreWith(candidate, keyBlock, target, stage) {
  if (!candidate || !keyBlock || keyBlock.status !== 'published' || !keyBlock.answers) return null;

  const results = [];
  const areaStats = Object.fromEntries(target.areas.map(area => [area.id, {
    id: area.id,
    label: area.label,
    from: area.from,
    to: area.to,
    pointsPerCorrect: area.points,
    correct: 0,
    wrong: 0,
    invalid: 0,
    annulled: 0,
    score: 0,
    maxScore: (area.to - area.from + 1) * area.points
  }]));

  let generalScore = 0;
  let specificScore = 0;
  let correct = 0;
  let wrong = 0;
  let invalid = 0;
  let annulled = 0;

  for (let q = 1; q <= 60; q += 1) {
    const official = normalizeKeyEntry(keyBlock.answers[q] ?? keyBlock.answers[String(q)]);
    if (!official) throw new Error(`${target.role} · gabarito ${stage}: questão ${q} sem resposta válida.`);

    const area = areaFor(target, q);
    if (!area) throw new Error(`${target.role}: questão ${q} fora do mapa de áreas do tipo ${target.examType}.`);

    const stats = areaStats[area.id];
    const candidateAnswer = candidate.answers?.[q] ?? candidate.answers?.[String(q)] ?? null;
    let status;
    let earned = 0;

    if (official === 'ANULADA') {
      status = 'anulada';
      earned = area.points;
      annulled += 1;
      stats.annulled += 1;
    } else if (candidateAnswer === official) {
      status = 'acerto';
      earned = area.points;
      correct += 1;
      stats.correct += 1;
    } else if (candidateAnswer == null) {
      status = 'inválida-ou-em-branco';
      invalid += 1;
      stats.invalid += 1;
    } else {
      status = 'erro';
      wrong += 1;
      stats.wrong += 1;
    }

    stats.score += earned;
    if (area.group === 'general') generalScore += earned;
    else specificScore += earned;

    results.push({
      question: q,
      area: area.id,
      areaLabel: area.label,
      block: area.group === 'general' ? 'geral' : 'específico',
      candidate: candidateAnswer,
      official,
      status,
      points: earned,
      pointsPossible: area.points
    });
  }

  const totalScore = generalScore + specificScore;
  const differences = results.filter(item => ['erro', 'inválida-ou-em-branco'].includes(item.status));

  return {
    stage,
    role: target.role,
    examType: target.examType,
    sourceUrl: keyBlock.sourceUrl || null,
    sourceTitle: keyBlock.sourceTitle || null,
    publishedAt: keyBlock.publishedAt || null,
    version: keyBlock.version || null,
    comparedAt: new Date().toISOString(),
    correct,
    wrong,
    invalid,
    annulled,
    generalScore,
    specificScore,
    totalScore,
    maxScore: 100,
    generalMinimumMet: generalScore >= 10,
    specificMinimumMet: specificScore >= 40,
    objectiveMinimumsMet: generalScore >= 10 && specificScore >= 40,
    areaStats,
    differences,
    questions: results
  };
}

snapshot.postExam = {
  ...(snapshot.postExam || {}),
  scoring: {
    ...(snapshot.postExam?.scoring || {})
  }
};

for (const target of TARGETS) {
  const exam = (snapshot.exams || []).find(item => item.id === target.examId);
  const candidate = exam?.candidateResponse;
  const keySet = keys?.[target.keyId] || {};
  const preliminaryScore = scoreWith(candidate, keySet.preliminary, target, 'preliminary');
  const definitiveScore = scoreWith(candidate, keySet.definitive, target, 'definitive');
  const activeScore = definitiveScore || preliminaryScore || null;

  snapshot.postExam.scoring[target.id] = {
    ...(snapshot.postExam.scoring[target.id] || {}),
    status: definitiveScore
      ? 'definitive-scored'
      : preliminaryScore
        ? 'preliminary-scored'
        : candidate
          ? 'candidate-response-ready'
          : 'candidate-response-pending',
    examType: target.examType,
    preliminary: preliminaryScore,
    definitive: definitiveScore,
    activeStage: definitiveScore ? 'definitive' : preliminaryScore ? 'preliminary' : null,
    estimatedScore: preliminaryScore?.totalScore ?? null,
    officialScoreFromKey: definitiveScore?.totalScore ?? null,
    estimatedGeneralScore: preliminaryScore?.generalScore ?? null,
    estimatedSpecificScore: preliminaryScore?.specificScore ?? null,
    differences: activeScore?.differences || [],
    lastComparedAt: activeScore?.comparedAt || null
  };

  if (exam) {
    exam.examType = target.examType;
    exam.scoreTracking = {
      preliminary: preliminaryScore
        ? {
            total: preliminaryScore.totalScore,
            general: preliminaryScore.generalScore,
            specific: preliminaryScore.specificScore,
            correct: preliminaryScore.correct,
            wrong: preliminaryScore.wrong,
            invalid: preliminaryScore.invalid,
            annulled: preliminaryScore.annulled,
            examType: target.examType,
            status: 'estimativa baseada no gabarito preliminar'
          }
        : null,
      definitive: definitiveScore
        ? {
            total: definitiveScore.totalScore,
            general: definitiveScore.generalScore,
            specific: definitiveScore.specificScore,
            correct: definitiveScore.correct,
            wrong: definitiveScore.wrong,
            invalid: definitiveScore.invalid,
            annulled: definitiveScore.annulled,
            examType: target.examType,
            status: 'recalculo baseado no gabarito definitivo'
          }
        : null
    };
  }
}

const competitionReading = {
  status: 'preliminary',
  auditedAt: COMPETITION.auditedAt,
  methodology: COMPETITION.methodology,
  personalProbability: {
    available: false,
    value: null,
    reason: 'A distribuição oficial das notas, a nota de corte e a classificação da objetiva ainda não foram publicadas. Taxas nominais do edital e amostras colaborativas não são probabilidades pessoais.'
  },
  rules: {
    objectiveMinimums: 'mínimo de 10/20 em Conhecimentos Gerais e 40/80 em Conhecimentos Específicos',
    discursiveMinimum: 'mínimo de 50/100 na prova discursiva para aprovação nessa etapa',
    correctionRule: 'a discursiva é corrigida para os candidatos mais bem classificados na objetiva dentro do quantitativo de cada sistema; vagas de correção reservadas não preenchidas podem ser revertidas à ampla concorrência',
    interpretation: 'aprovação/classificação, posição em vagas/CR e eventual nomeação são réguas distintas'
  },
  milestones: COMPETITION.milestones,
  sources: COMPETITION.sources,
  exams: {}
};

for (const target of TARGETS) {
  const base = COMPETITION[target.id];
  const preliminary = snapshot.postExam.scoring[target.id]?.preliminary || null;
  const listedPositionsAC = base.immediateVacanciesAC + base.reservePositionsAC;
  competitionReading.exams[target.id] = {
    role: target.role,
    examType: target.examType,
    preliminaryScore: preliminary?.totalScore ?? null,
    preliminaryGeneralScore: preliminary?.generalScore ?? null,
    preliminarySpecificScore: preliminary?.specificScore ?? null,
    objectiveMinimumsMet: preliminary?.objectiveMinimumsMet ?? null,
    registrationsAC: base.registrationsAC,
    correctionSlotsAC: base.correctionSlotsAC,
    nominalCorrectionRateAC: pct(base.correctionSlotsAC, base.registrationsAC),
    immediateVacanciesAC: base.immediateVacanciesAC,
    reservePositionsAC: base.reservePositionsAC,
    listedPositionsAC,
    nominalListedPositionRateAC: pct(listedPositionsAC, base.registrationsAC),
    communitySample: {
      ...base.communitySample,
      coverageOfRegistrationsAC: pct(base.communitySample.participants, base.registrationsAC),
      warning: 'Amostra autoselecionada; não representa distribuição oficial de notas e não deve ser usada isoladamente para inferir chance pessoal.'
    },
    personalProbability: null,
    personalProbabilityStatus: 'not-estimable-yet',
    competitiveStatus: preliminary?.objectiveMinimumsMet
      ? 'Nota preliminar acima dos mínimos eliminatórios; faixa classificatória ainda indeterminada.'
      : 'Situação objetiva ainda não confirmada.'
  };
}

snapshot.postExam.competitionReading = competitionReading;

snapshot.meta = {
  ...(snapshot.meta || {}),
  postExamScoringUpdatedAt: new Date().toISOString(),
  postExamCompetitionAuditedAt: new Date().toISOString()
};

await fs.writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);

for (const target of TARGETS) {
  const scoring = snapshot.postExam.scoring[target.id];
  if (scoring?.definitive?.totalScore != null) {
    console.log(`${target.role} · Tipo ${target.examType}: ${scoring.definitive.totalScore}/100 pelo gabarito definitivo.`);
  } else if (scoring?.preliminary?.totalScore != null) {
    console.log(`${target.role} · Tipo ${target.examType}: ${scoring.preliminary.totalScore}/100 pelo gabarito preliminar.`);
  } else {
    console.log(`${target.role} · Tipo ${target.examType}: pronto para cruzamento; aguardando gabarito publicado.`);
  }
}

console.log('Leitura competitiva preliminar registrada sem converter taxa nominal em probabilidade pessoal.');