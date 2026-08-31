import fs from 'node:fs/promises';

const token = process.env.NOTION_TOKEN;
if (!token) throw new Error('NOTION_TOKEN não configurado.');

const API_VERSION = '2022-06-28';
const ids = {
  pages: {
    home: '239cf5a2673180a1a2a2df40b502a899',
    journey: '3c8cf5a2673181adbbecc1f6d0080399',
    exams: '3c8cf5a26731818a9571f28f56f13514',
    performance: '3c8cf5a2673181a38caef92b980ce85c',
    strategy: '3c8cf5a2673181e08ae8f9eff95df293',
    audit: '3c8cf5a2673181f7bce8f6b75881c31f',
    reconciliation: '3cacf5a26731818da9dacef6da38241f'
  },
  databases: {
    tdasQuestions: '7ef15150d39b4215816b9d318fc88fa3',
    tdasErrors: 'fabd0f60bdb84327bd83d99dc9a40374',
    tdasEssays: '9b628a5313c646d8aa57576baa459bdb',
    edasQuestions: '51c357e5bf1c47fea1c40357bf4c8801',
    edasErrors: '705bb839a4be4be497ae192cd62c9540',
    edasCases: '4a0a746eb92642489db14f3cbc3fd5d8',
    registry: 'f1a15942ef2e4844b54ed9b6f892ea2f'
  }
};

const headers = {
  Authorization: `Bearer ${token}`,
  'Notion-Version': API_VERSION,
  'Content-Type': 'application/json'
};

async function notion(path, opts = {}) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) }
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function blocks(id) {
  let cursor;
  const all = [];
  do {
    const qs = new URLSearchParams({ page_size: '100' });
    if (cursor) qs.set('start_cursor', cursor);
    const result = await notion(`blocks/${id}/children?${qs}`);
    all.push(...result.results);
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return all;
}

async function databaseRows(id) {
  let cursor;
  const all = [];
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const result = await notion(`databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    all.push(...result.results);
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return all;
}

const access = {};
async function safeDatabaseRows(key, id) {
  try {
    const rows = await databaseRows(id);
    access[key] = { ok: true, rows: rows.length };
    return rows;
  } catch (error) {
    access[key] = { ok: false, error: String(error?.message || error) };
    console.warn(`[fallback] ${key}: ${access[key].error}`);
    return null;
  }
}

function property(page, name) {
  return page?.properties?.[name] ?? null;
}

function numberValue(page, name) {
  const p = property(page, name);
  if (!p) return null;
  if (p.type === 'number') return p.number;
  if (p.type === 'formula' && p.formula?.type === 'number') return p.formula.number;
  if (p.type === 'rollup' && p.rollup?.type === 'number') return p.rollup.number;
  return null;
}

function textValue(page, name) {
  const p = property(page, name);
  if (!p) return '';
  if (p.type === 'title') return (p.title || []).map(x => x.plain_text || '').join('');
  if (p.type === 'rich_text') return (p.rich_text || []).map(x => x.plain_text || '').join('');
  if (p.type === 'select') return p.select?.name || '';
  if (p.type === 'status') return p.status?.name || '';
  if (p.type === 'formula' && p.formula?.type === 'string') return p.formula.string || '';
  return '';
}

function checkboxValue(page, name) {
  const p = property(page, name);
  return p?.type === 'checkbox' ? Boolean(p.checkbox) : false;
}

function dateValue(page, name) {
  const p = property(page, name);
  return p?.type === 'date' ? p.date?.start || null : null;
}

function sum(rows, fn) {
  return rows.reduce((acc, row) => acc + (Number(fn(row)) || 0), 0);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function accuracy(hits, questions) {
  return questions ? round2(hits / questions * 100) : 0;
}

function hasStructuredScore(row) {
  return ['Nota CAC', 'Nota OT', 'Nota DLP'].every(name => numberValue(row, name) !== null);
}

const previous = JSON.parse(
  await fs.readFile(new URL('../data/snapshot.json', import.meta.url), 'utf8')
);

const [
  homeMeta,
  pageMirrorEntries,
  tdasRows,
  tdasErrorRows,
  tdasEssayRows,
  edasRows,
  edasErrorRows,
  edasCaseRows,
  registryRows
] = await Promise.all([
  notion(`pages/${ids.pages.home}`),
  Promise.all(Object.entries(ids.pages).map(async ([key, id]) => [
    key,
    {
      meta: await notion(`pages/${id}`),
      blocks: await blocks(id)
    }
  ])),
  safeDatabaseRows('tdasQuestions', ids.databases.tdasQuestions),
  safeDatabaseRows('tdasErrors', ids.databases.tdasErrors),
  safeDatabaseRows('tdasEssays', ids.databases.tdasEssays),
  safeDatabaseRows('edasQuestions', ids.databases.edasQuestions),
  safeDatabaseRows('edasErrors', ids.databases.edasErrors),
  safeDatabaseRows('edasCases', ids.databases.edasCases),
  safeDatabaseRows('registry', ids.databases.registry)
]);

const pageMirror = Object.fromEntries(pageMirrorEntries);

let tdasQuestions = previous.metrics.tdas.questions;
let tdasHits = previous.metrics.tdas.hits;
let tdasStepsTotal = previous.metrics.tdas.stepsTotal;
let tdasStepsDone = previous.metrics.tdas.stepsDone;
let tdasSimulations = previous.metrics.tdas.simulations;

if (tdasRows) {
  const peRows = tdasRows.filter(r => /^PE\d+/i.test(textValue(r, 'Dia ID')));
  const concludedPEs = peRows.filter(r => textValue(r, 'Status') === 'Concluído');

  tdasQuestions = sum(concludedPEs, r =>
    (numberValue(r, 'Questões gerais') || 0) +
    (numberValue(r, 'Questões específicas') || 0)
  );
  tdasHits = sum(concludedPEs, r =>
    (numberValue(r, 'Acertos gerais') || 0) +
    (numberValue(r, 'Acertos específicas') || 0)
  );

  const uniquePEs = new Map(peRows.map(r => [textValue(r, 'Dia ID'), r]));
  tdasStepsTotal = uniquePEs.size || tdasStepsTotal;
  tdasStepsDone = [...uniquePEs.values()].filter(r =>
    ['Concluído', 'Descanso'].includes(textValue(r, 'Status'))
  ).length;

  tdasSimulations = concludedPEs.filter(r =>
    textValue(r, 'Bloco predominante') === 'Simulado'
  ).length;
}

let edasQuestions = previous.metrics.edas.questions;
let edasHits = previous.metrics.edas.hits;
if (edasRows) {
  const edasDone = edasRows.filter(r => textValue(r, 'Status') === 'Concluído');
  edasQuestions = sum(edasDone, r =>
    (numberValue(r, 'Material — feitas') || 0) +
    (numberValue(r, 'Comuns — feitas') || 0) +
    (numberValue(r, 'Português — feitas') || 0)
  );
  edasHits = sum(edasDone, r =>
    (numberValue(r, 'Acertos material') || 0) +
    (numberValue(r, 'Acertos comuns') || 0) +
    (numberValue(r, 'Acertos Português') || 0)
  );
}

const registry = registryRows || [];
const included = registry.filter(r => checkboxValue(r, 'Conta no consolidado geral'));

let historyQuestions = previous.metrics.history.questions;
let historyHits = previous.metrics.history.hits;
let historyWithoutResult = previous.metrics.history.withoutResult;

if (included.length) {
  if (tdasRows) {
    const nonTdasIncluded = included.filter(r => textValue(r, 'Projeto') !== 'TDAS 202');
    historyQuestions = sum(nonTdasIncluded, r => numberValue(r, 'Questões')) + tdasQuestions;
    historyHits = sum(nonTdasIncluded, r => numberValue(r, 'Acertos')) + tdasHits;
    historyWithoutResult = sum(nonTdasIncluded, r => numberValue(r, 'Sem resultado'));
  } else {
    historyQuestions = sum(included, r => numberValue(r, 'Questões'));
    historyHits = sum(included, r => numberValue(r, 'Acertos'));
    historyWithoutResult = sum(included, r => numberValue(r, 'Sem resultado'));
  }
}

const historyErrors = historyQuestions - historyHits;
const historyRaw = historyQuestions + historyWithoutResult;

const financeRow = registry.find(r =>
  textValue(r, 'Registro').includes('SEDES/DF 2026 — ciclo financeiro')
);
const financeConfirmed =
  numberValue(financeRow, 'Custo confirmado do ciclo (R$)') ??
  previous.metrics.finance.sedesConfirmed;
const financeStatus =
  textValue(financeRow, 'Status financeiro') ||
  previous.metrics.finance.status;

const latestIncludedAudit = included
  .map(r => dateValue(r, 'Data auditoria'))
  .filter(Boolean)
  .sort()
  .at(-1) || previous.meta.performanceCut;

const cycleNames = {
  Tribunais: 'Tribunais — 120 dias',
  'SEDES inicial': 'SEDES — Plano Paralelo 1',
  'SEDES paralelo 8 semanas': 'SEDES — Plano Paralelo 8 Semanas',
  'Senador Canedo': 'Senador Canedo — Analista Administrativo',
  'SEDES pré-edital': 'SEDES — Pré-edital PRO',
  'TDAS 202': 'SEDES — TDAS Pós-edital'
};

const historyCycles = included
  .filter(r => (numberValue(r, 'Questões') || 0) > 0)
  .map(r => {
    const project = textValue(r, 'Projeto');
    const record = textValue(r, 'Registro');
    const isTdas = project === 'TDAS 202';
    const q = isTdas ? tdasQuestions : (numberValue(r, 'Questões') || 0);
    const h = isTdas ? tdasHits : (numberValue(r, 'Acertos') || 0);
    let name = cycleNames[project] || record.split('|')[0].trim();
    if (record.includes('Reta Final')) name = 'Câmara Goiânia — Reta Final';
    else if (record.includes('Agente Administrativo')) name = 'Câmara Goiânia — Agente Administrativo';
    else if (record.includes('Treino Quadrix')) name = 'Treino Quadrix — CRF-DF';
    return { name, questions: q, hits: h, errors: q - h, accuracy: accuracy(h, q) };
  });

const examRows = registry.filter(r => textValue(r, 'Escopo') === 'Prova real');
function dynamicExam(previousExam, needle) {
  const row = examRows.find(r => textValue(r, 'Registro').includes(needle));
  if (!row) return previousExam;
  const q = numberValue(row, 'Questões') ?? 0;
  const h = numberValue(row, 'Acertos') ?? 0;
  const max = numberValue(row, 'Pontuação máxima');
  const note = numberValue(row, 'Nota editalícia');
  const ranking = numberValue(row, 'Classificação da etapa');
  return {
    ...previousExam,
    date: dateValue(row, 'Data') || previousExam.date,
    score: q ? `${h}/${q}` : previousExam.score,
    rawAccuracy: numberValue(row, 'Aproveitamento') ?? accuracy(h, q),
    weightedScore: note !== null && max ? `${note}/${max}` : previousExam.weightedScore,
    ranking: ranking
      ? `${ranking.toLocaleString('pt-BR')}º${textValue(row, 'Etapa da classificação') ? ` · ${textValue(row, 'Etapa da classificação')}` : ''}`
      : previousExam.ranking,
    status: textValue(row, 'Situação competitiva') || previousExam.status
  };
}

const exams = previous.exams.map(e => {
  if (e.name.includes('Caldas Novas')) return dynamicExam(e, 'Caldas Novas');
  if (e.name.includes('Câmara')) return dynamicExam(e, 'Câmara Goiânia');
  return e;
});

const snapshot = {
  ...previous,
  meta: {
    ...previous.meta,
    generatedAt: new Date().toISOString(),
    homeSnapshot: (homeMeta.last_edited_time || new Date().toISOString()).slice(0, 10),
    performanceCut: latestIncludedAudit,
    source: 'Notion vivo — bancos operacionais + Registro Histórico',
    live: true,
    syncWarnings: Object.entries(access).filter(([, value]) => !value.ok).map(([key]) => key)
  },
  metrics: {
    tdas: {
      questions: tdasQuestions,
      hits: tdasHits,
      errors: tdasQuestions - tdasHits,
      accuracy: accuracy(tdasHits, tdasQuestions),
      stepsDone: tdasStepsDone,
      stepsTotal: tdasStepsTotal || previous.metrics.tdas.stepsTotal,
      errorNotebook: tdasErrorRows ? tdasErrorRows.length : previous.metrics.tdas.errorNotebook,
      essays: tdasEssayRows ? tdasEssayRows.length : previous.metrics.tdas.essays,
      essaysGraded: tdasEssayRows ? tdasEssayRows.filter(hasStructuredScore).length : previous.metrics.tdas.essaysGraded,
      simulations: tdasSimulations
    },
    edas: {
      questions: edasQuestions,
      hits: edasHits,
      errors: edasQuestions - edasHits,
      accuracy: accuracy(edasHits, edasQuestions),
      errorNotebook: edasErrorRows ? edasErrorRows.length : previous.metrics.edas.errorNotebook,
      caseStudies: edasCaseRows ? edasCaseRows.length : previous.metrics.edas.caseStudies
    },
    history: {
      questions: historyQuestions,
      hits: historyHits,
      errors: historyErrors,
      accuracy: accuracy(historyHits, historyQuestions),
      rawRecords: historyRaw,
      withoutResult: historyWithoutResult
    },
    finance: {
      sedesConfirmed: round2(financeConfirmed || 0),
      status: financeStatus
    }
  },
  exams,
  historyCycles
};

const mirror = {
  generatedAt: snapshot.meta.generatedAt,
  access,
  pages: pageMirror,
  operational: {
    tdas: {
      questionsDatabase: ids.databases.tdasQuestions,
      errorDatabase: ids.databases.tdasErrors,
      essayDatabase: ids.databases.tdasEssays,
      rows: tdasRows?.length ?? null
    },
    edas: {
      questionsDatabase: ids.databases.edasQuestions,
      errorDatabase: ids.databases.edasErrors,
      caseDatabase: ids.databases.edasCases,
      rows: edasRows?.length ?? null
    },
    registry: {
      database: ids.databases.registry,
      rows: registryRows?.length ?? null
    }
  }
};

await fs.writeFile(
  new URL('../data/snapshot.json', import.meta.url),
  JSON.stringify(snapshot, null, 2) + '\n'
);
await fs.writeFile(
  new URL('../data/notion-live.json', import.meta.url),
  JSON.stringify(mirror, null, 2) + '\n'
);

console.log(JSON.stringify({
  ok: true,
  generatedAt: snapshot.meta.generatedAt,
  tdas: snapshot.metrics.tdas,
  edas: snapshot.metrics.edas,
  history: snapshot.metrics.history,
  finance: snapshot.metrics.finance,
  access
}, null, 2));
