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

function buildQuestionAudit(candidate, keyBlock, source, question, status, candidateAnswer, official, pointsPossible) {
  const invalidMarked = (candidate?.invalidQuestions || []).map(Number).includes(question);
  const candidateLabel = candidateAnswer || (invalidMarked ? 'DUPLA-MARCAÇÃO' : 'SEM-RESPOSTA');
  const candidateNote = candidate?.questionNotes?.[question] ?? candidate?.questionNotes?.[String(question)] ?? null;
  const officialNote = keyBlock.questionAudit?.[String(question)] || null;
  const relation = status === 'acerto'
    ? 'coincide'
    : status === 'anulada'
      ? 'questao-anulada'
      : candidateAnswer == null
        ? 'sem-marcacao-valida'
        : 'diverge';
  const resultReason = status === 'acerto'
    ? 'A resposta anotada coincide com a alternativa indicada no gabarito preliminar.'
    : status === 'anulada'
      ? 'A questão foi anulada; a pontuação integral é aplicada conforme a regra do edital.'
      : invalidMarked
        ? 'O registro do candidato informa mais de uma marcação no cartão; o cenário de pontuação é zero para o item.'
        : candidateAnswer == null
          ? 'Não há resposta válida anotada; o cenário de pontuação é zero para o item.'
          : 'A resposta anotada diverge da alternativa indicada no gabarito preliminar; a justificativa de conteúdo depende do enunciado e da fonte normativa.';
  const appealAssessment = status === 'acerto'
    ? {
        status: 'not-indicated',
        label: 'Sem recurso necessário',
        recommendation: 'A anotação coincide com a chave preliminar; não há divergência a contestar neste cruzamento.'
      }
      : status === 'anulada'
        ? {
            status: 'applied-to-all',
            label: 'Anulação já aplicada',
            recommendation: 'A pontuação integral foi atribuída; aguardar o resultado definitivo.'
          }
        : invalidMarked
          ? {
              status: 'question-review-only',
              label: 'Só avaliar eventual anulação',
              recommendation: 'A dupla marcação não é corrigida por troca de gabarito. Só avaliar recurso se houver vício objetivo no enunciado, nas alternativas ou na base normativa.'
            }
          : candidateAnswer == null
            ? {
                status: 'not-from-answer',
                label: 'Sem fundamento pela falta de marcação',
                recommendation: 'A ausência de resposta não demonstra erro da banca. Só avaliar recurso por eventual vício objetivo da questão.'
              }
            : {
                status: 'low-signal',
                label: 'Não priorizar só pela divergência',
                recommendation: 'A diferença entre a anotação e a chave não prova erro da banca. Só protocolar se o enunciado, o edital ou a fonte normativa revelar fundamento objetivo para alteração ou anulação.'
              };
  return {
    candidateLabel,
    candidateNote,
    comparison: {
      relation,
      candidate: candidateLabel,
      official
    },
    resultReason,
    officialBasis: officialNote?.basis || null,
    officialJustificationSource: source?.justificationsPdfUrl || null,
    appealAssessment,
    potentialGainIfKeyChanges: ['acerto', 'anulada'].includes(status) ? 0 : pointsPossible
  };
}

function buildScoreAudit(candidate, keyBlock, source, target, stage, results, differences) {
  const preliminary = stage === 'preliminary';
  return {
    responseSource: candidate?.source || 'Registro de respostas anotadas do candidato',
    responseIsOfficialKey: false,
    responseLabel: 'Respostas anotadas pelo candidato',
    keyLabel: preliminary ? 'Gabarito preliminar oficial' : 'Gabarito definitivo oficial',
    keyIsDefinitive: !preliminary,
    keyPublishedAt: keyBlock?.publishedAt || null,
    keyVersion: keyBlock?.version || null,
    sourceSeparation: 'As respostas anotadas e o gabarito da banca são fontes independentes; a nota resulta apenas do cruzamento entre os dois.',
    comparisonMethod: 'Comparação literal por número de questão, respeitando o tipo de prova e os pesos do edital.',
    questionCount: results.length,
    differenceCount: differences.length,
    resourceReview: preliminary
      ? {
          status: 'pre-analise',
          conclusion: 'Nenhuma divergência entre a anotação e a chave, isoladamente, prova erro da banca. Cada recurso precisa apontar fundamento objetivo para alterar ou anular uma questão.',
          questionByQuestion: true,
          protocol: source?.resourceProtocol || null
        }
      : {
          status: 'definitive-record',
          conclusion: 'Registro definitivo; acompanhar o resultado oficial e eventuais efeitos das decisões da banca.',
          questionByQuestion: true,
          protocol: source?.resourceProtocol || null
        },
    sourceDocuments: {
      keyPdfUrl: source?.keyPdfUrl || keyBlock?.sourceUrl || null,
      justificationsPdfUrl: source?.justificationsPdfUrl || null,
      resourceNoticePdfUrl: source?.resourceNoticePdfUrl || null
    }
  };
}

function scoreWith(candidate, keyBlock, target, stage, source) {
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
      pointsPossible: area.points,
      audit: buildQuestionAudit(candidate, keyBlock, source, q, status, candidateAnswer, official, area.points)
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
    questions: results,
    audit: buildScoreAudit(candidate, keyBlock, source, target, stage, results, differences)
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
  const preliminaryScore = scoreWith(candidate, keySet.preliminary, target, 'preliminary', keys.source);
  const definitiveScore = scoreWith(candidate, keySet.definitive, target, 'definitive', keys.source);
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


const PRE_EXAM_READINESS = {
  version: 'pre-exam-ready-v1',
  status: 'standby',
  title: 'Pré-prova pronta para ativar',
  description: 'A estrutura fica em espera para o próximo concurso. Quando um novo edital for cadastrado, ela recebe cargos, fontes, ciclo, questões, simulados e acompanhamento próprios.',
  activationRule: 'Ativar somente após existir concurso, edital, cargo, banca e data de prova confirmados.',
  checklist: [
    { id: 'contest', title: 'Concurso, cargos e banca', detail: 'Cadastrar o concurso e separar cada cargo, prova e turno.' },
    { id: 'sources', title: 'Edital e fontes oficiais', detail: 'Fixar edital, retificações, legislação e página oficial.' },
    { id: 'verticalized', title: 'Edital verticalizado', detail: 'Transformar o conteúdo em matérias, assuntos e ordem de estudo.' },
    { id: 'cycle', title: 'Ciclo de execução', detail: 'Criar dias, metas, revisões e espaço para registro de dificuldades.' },
    { id: 'questions', title: 'Banco de questões', detail: 'Vincular questões por banca, cargo, matéria e assunto.' },
    { id: 'simulation', title: 'Simulados e prova real', detail: 'Preparar simulados, controle de tempo e fechamento do dia da prova.' },
    { id: 'followup', title: 'Pós-prova automático', detail: 'Ao terminar, abrir a mesma trilha de gabarito, recursos, nota e resultado.' }
  ],
  outputs: ['edital verticalizado', 'execução diária', 'banco de questões', 'caderno de erros', 'simulados', 'acompanhamento pós-prova']
};

function followUpAreaRows(scoring) {
  return Object.values(scoring?.areaStats || {})
    .sort((a, b) => Number(a.from || 0) - Number(b.from || 0))
    .map((area) => ({
      id: area.id,
      label: area.label,
      from: area.from,
      to: area.to,
      pointsPerCorrect: area.pointsPerCorrect,
      correct: area.correct,
      wrong: area.wrong,
      invalid: area.invalid,
      annulled: area.annulled,
      score: area.score,
      maxScore: area.maxScore,
      accuracy: pct(area.correct, (area.to - area.from + 1))
    }));
}

function buildPostExamFollowUp() {
  const scoring = snapshot.postExam?.scoring || {};
  const exams = {};
  for (const target of TARGETS) {
    const exam = (snapshot.exams || []).find((item) => item.id === target.examId) || {};
    const preliminary = scoring[target.id]?.preliminary || null;
    const definitive = scoring[target.id]?.definitive || null;
    const active = definitive || preliminary;
    const differences = active?.differences || [];
    const potentialGain = differences.reduce((total, item) => total + Number(item.pointsPossible || 0), 0);
    const generalDifferences = differences.filter((item) => item.area === 'general' || item.block === 'geral');
    const specificDifferences = differences.filter((item) => item.area !== 'general' && item.block !== 'geral');
    exams[target.id] = {
      role: target.role,
      examType: target.examType,
      session: exam.session || null,
      date: exam.date || snapshot.meta?.postExamDate || null,
      status: definitive ? 'definitive' : preliminary ? 'preliminary' : 'awaiting-key',
      source: exam.candidateResponse?.source || null,
      candidate: {
        registeredQuestions: exam.candidateResponse?.registeredQuestions ?? null,
        validMarks: exam.candidateResponse?.validMarks ?? null,
        rawAccuracy: exam.rawAccuracy ?? null
      },
      result: active ? {
        correct: active.correct,
        wrong: active.wrong,
        invalid: active.invalid,
        annulled: active.annulled,
        totalScore: active.totalScore,
        maxScore: active.maxScore,
        generalScore: active.generalScore,
        specificScore: active.specificScore,
        generalMinimumMet: active.generalMinimumMet,
        specificMinimumMet: active.specificMinimumMet,
        objectiveMinimumsMet: active.objectiveMinimumsMet
      } : null,
      areas: followUpAreaRows(active),
      resources: {
        differenceCount: differences.length,
        generalDifferenceCount: generalDifferences.length,
        specificDifferenceCount: specificDifferences.length,
        potentialGainIfAllResolved: potentialGain,
        conclusion: active?.audit?.resourceReview?.conclusion || null
      }
    };
  }

  const values = Object.values(exams);
  const hasPreliminary = values.some((item) => item.status === 'preliminary' || item.status === 'definitive');
  const hasDefinitive = values.some((item) => item.status === 'definitive');
  const hasRanking = (snapshot.exams || []).some((item) => item.id?.startsWith('sedes-2026-') && item.ranking && item.ranking !== '—');
  const protocol = keys.source?.resourceProtocol || null;
  const milestones = [
    { id: 'exam', label: 'Provas realizadas', date: snapshot.meta?.postExamDate || '2026-09-06', status: 'done', detail: 'EDAS pela manhã · TDAS à tarde' },
    { id: 'preliminary-key', label: 'Gabarito preliminar', date: keys.source?.publishedAt || null, status: hasPreliminary ? 'done' : 'pending', detail: hasPreliminary ? 'Tipos A e B incorporados' : 'Aguardar publicação oficial' },
    { id: 'resources', label: 'Recursos', start: protocol?.start || null, end: protocol?.end || null, status: hasDefinitive ? 'done' : hasPreliminary ? 'current' : 'pending', detail: hasDefinitive ? 'Janela encerrada ou resultado definitivo disponível' : hasPreliminary ? 'Conferir divergências com fundamento objetivo' : 'Depois do gabarito preliminar' },
    { id: 'objective-result', label: 'Resultado objetivo preliminar', date: COMPETITION.milestones.objectivePreliminaryResult, status: hasRanking ? 'done' : hasDefinitive ? 'current' : 'upcoming', detail: hasRanking ? 'Classificação registrada' : 'Publicação oficial ainda pendente' },
    { id: 'objective-definitive', label: 'Resultado definitivo e lista da discursiva', date: COMPETITION.milestones.objectiveDefinitiveAndDiscursiveCorrectionList, status: hasRanking ? 'done' : 'upcoming', detail: 'Acompanhar lista de correção discursiva' },
    { id: 'discursive-preliminary', label: 'Resultado preliminar da discursiva', date: COMPETITION.milestones.discursivePreliminaryResult, status: 'upcoming', detail: 'Somente após a correção da discursiva' },
    { id: 'discursive-definitive', label: 'Resultado definitivo da discursiva', date: COMPETITION.milestones.discursiveDefinitiveResult, status: 'upcoming', detail: 'Fechamento do ciclo oficial' }
  ];
  const totalDifferences = values.reduce((total, item) => total + Number(item.resources.differenceCount || 0), 0);
  const totalPotentialGain = values.reduce((total, item) => total + Number(item.resources.potentialGainIfAllResolved || 0), 0);
  return {
    version: 'post-exam-follow-up-v1',
    status: 'active',
    title: 'Acompanhamento pós-prova',
    description: 'Painel permanente da SEDES/DF: correção, recursos, resultado e decisão seguinte, sem misturar os cargos.',
    currentStage: hasRanking ? 'Resultado e próximos passos' : hasDefinitive ? 'Classificação em acompanhamento' : hasPreliminary ? 'Conferência e recursos' : 'Aguardando gabarito e correção',
    nextAction: hasRanking ? 'Registrar classificação, discursiva e decisão de carreira.' : hasDefinitive ? 'Acompanhar classificação e correção da discursiva.' : hasPreliminary ? 'Revisar divergências e protocolar somente recursos fundamentados.' : 'Aguardar fonte oficial de correção.',
    snapshotDate: snapshot.meta?.postExamDate || null,
    lastCalculatedAt: new Date().toISOString(),
    milestones,
    exams,
    resources: {
      totalDifferenceCount: totalDifferences,
      totalPotentialGainIfAllResolved: totalPotentialGain,
      note: 'Ganho potencial é um cenário máximo por mudança de chave ou anulação; não é previsão de deferimento.'
    },
    resourceProtocol: protocol,
    sourceDocuments: {
      contest: COMPETITION.sources.contest,
      updatedNotice: COMPETITION.sources.updatedNotice,
      keyPdf: keys.source?.keyPdfUrl || null,
      justificationsPdf: keys.source?.justificationsPdfUrl || null,
      resourceNoticePdf: keys.source?.resourceNoticePdfUrl || null
    }
  };
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
snapshot.postExam.followUp = buildPostExamFollowUp();
snapshot.preExamReadiness = PRE_EXAM_READINESS;

snapshot.meta = {
  ...(snapshot.meta || {}),
  postExamScoringUpdatedAt: new Date().toISOString(),
  postExamCompetitionAuditedAt: new Date().toISOString(),
  postExamFollowUpUpdatedAt: new Date().toISOString()
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