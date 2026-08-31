import fs from 'node:fs/promises';

const token = process.env.NOTION_TOKEN;
if (!token) throw new Error('NOTION_TOKEN não configurado.');

const headers = {
  Authorization: `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

const DATABASES = {
  finance: 'cfaf6224f1c047d08385c5331c1ff37b',
  registry: 'f1a15942ef2e4844b54ed9b6f892ea2f'
};

async function notion(path, opts = {}) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    ...opts,
    headers: {...headers, ...(opts.headers || {})}
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function databaseRows(id) {
  const rows = [];
  let cursor = null;
  do {
    const body = {page_size: 100};
    if (cursor) body.start_cursor = cursor;
    const result = await notion(`databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    rows.push(...result.results);
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return rows;
}

function prop(row, name) { return row?.properties?.[name] || null; }
function num(row, name) {
  const p = prop(row, name);
  if (!p) return null;
  if (p.type === 'number') return p.number;
  if (p.type === 'formula' && p.formula?.type === 'number') return p.formula.number;
  if (p.type === 'rollup' && p.rollup?.type === 'number') return p.rollup.number;
  return null;
}
function text(row, name) {
  const p = prop(row, name);
  if (!p) return '';
  if (p.type === 'title') return (p.title || []).map(x => x.plain_text || '').join('');
  if (p.type === 'rich_text') return (p.rich_text || []).map(x => x.plain_text || '').join('');
  if (p.type === 'select') return p.select?.name || '';
  if (p.type === 'status') return p.status?.name || '';
  if (p.type === 'formula' && p.formula?.type === 'string') return p.formula.string || '';
  return '';
}
function checkbox(row, name) { const p = prop(row, name); return p?.type === 'checkbox' ? Boolean(p.checkbox) : false; }
function date(row, name) { const p = prop(row, name); return p?.type === 'date' ? p.date?.start || null : null; }
function url(row, name) { const p = prop(row, name); return p?.type === 'url' ? p.url || null : null; }
function uniqueId(row, name = 'ID') {
  const p = prop(row, name);
  if (p?.type !== 'unique_id') return '';
  const prefix = p.unique_id?.prefix || '';
  const n = p.unique_id?.number;
  return n == null ? '' : `${prefix}${n}`;
}
function sum(rows, fn) { return rows.reduce((a, r) => a + (Number(fn(r)) || 0), 0); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

function groupSummary(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'Não informado';
    const item = map.get(key) || {key, transactions:0, confirmed:0, estimated:0, paid:0, reimbursed:0, pending:0, unconfirmed:0};
    item.transactions += 1;
    item.confirmed += num(row, 'Valor confirmado computável (R$)') || 0;
    item.estimated += num(row, 'Valor estimado computável (R$)') || 0;
    item.paid += num(row, 'Valor pago (R$)') || 0;
    item.reimbursed += num(row, 'Valor reembolsado (R$)') || 0;
    const situation = text(row, 'Situação');
    if (situation === 'Pendente') item.pending += 1;
    if (situation === 'Não confirmado') item.unconfirmed += 1;
    map.set(key, item);
  }
  return [...map.values()].map(x => ({
    ...x,
    confirmed: round2(x.confirmed),
    estimated: round2(x.estimated),
    paid: round2(x.paid),
    reimbursed: round2(x.reimbursed)
  })).sort((a,b) => b.confirmed-a.confirmed || b.estimated-a.estimated || a.key.localeCompare(b.key, 'pt-BR'));
}

function enrichExam(previous, row) {
  if (!row) return previous;
  const q = num(row, 'Questões') || 0;
  const h = num(row, 'Acertos') || 0;
  const note = num(row, 'Nota editalícia');
  const max = num(row, 'Pontuação máxima');
  const ranking = num(row, 'Classificação da etapa');
  const stage = text(row, 'Etapa da classificação');
  return {
    ...previous,
    date: date(row, 'Data') || previous.date,
    score: q ? `${h}/${q}` : previous.score,
    rawAccuracy: num(row, 'Aproveitamento') ?? previous.rawAccuracy,
    weightedScore: note != null && max ? `${note}/${max}` : previous.weightedScore,
    ranking: ranking ? `${ranking.toLocaleString('pt-BR')}º${stage ? ` · ${stage}` : ''}` : previous.ranking,
    classification: ranking,
    classificationStage: stage || null,
    stageClassified: num(row, 'Classificados na etapa'),
    sameScoreCandidates: num(row, 'Candidatos na mesma nota'),
    competitionPerVacancy: num(row, 'Concorrência por vaga'),
    competitionUniverse: text(row, 'Universo da concorrência') || null,
    registrations: num(row, 'Inscrições homologadas'),
    immediateVacancies: num(row, 'Vagas imediatas total'),
    immediateVacanciesAC: num(row, 'Vagas AC imediatas'),
    reservePositionsAC: num(row, 'Posições CR AC'),
    reservePositionsTotal: num(row, 'Posições CR total do cargo'),
    relativePosition: num(row, 'Posição relativa etapa (%)'),
    financialStatus: text(row, 'Status financeiro') || null,
    auditStatus: text(row, 'Status auditoria') || null,
    status: text(row, 'Situação competitiva') || previous.status
  };
}

function matchingCycleRow(name, rows) {
  const candidates = rows.filter(row => checkbox(row, 'Conta no consolidado geral'));
  const match = row => {
    const project = text(row, 'Projeto');
    const record = text(row, 'Registro');
    if (name.includes('Tribunais')) return project === 'Tribunais';
    if (name.includes('Plano Paralelo 1')) return project === 'SEDES inicial';
    if (name.includes('Plano Paralelo 8')) return project === 'SEDES paralelo 8 semanas';
    if (name.includes('Senador Canedo')) return project === 'Senador Canedo';
    if (name.includes('Reta Final')) return project === 'Câmara Goiânia' && record.includes('Reta Final');
    if (name.includes('Agente Administrativo')) return project === 'Câmara Goiânia' && record.includes('Agente Administrativo');
    if (name.includes('Pré-edital')) return project === 'SEDES pré-edital';
    if (name.includes('Treino Quadrix')) return record.includes('Treino Quadrix');
    if (name.includes('TDAS Pós-edital')) return project === 'TDAS 202';
    return false;
  };
  return candidates.find(match) || rows.find(match) || null;
}

const snapshotPath = new URL('../data/snapshot.json', import.meta.url);
const mirrorPath = new URL('../data/notion-live.json', import.meta.url);
const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
let mirror = {};
try { mirror = JSON.parse(await fs.readFile(mirrorPath, 'utf8')); } catch {}

const warnings = [];
let financeRows = null;
let registryRows = null;
try { financeRows = await databaseRows(DATABASES.finance); }
catch (error) { warnings.push({source:'finance', error:String(error?.message || error)}); }
try { registryRows = await databaseRows(DATABASES.registry); }
catch (error) { warnings.push({source:'registry-enrichment', error:String(error?.message || error)}); }

if (financeRows) {
  const included = financeRows.filter(row => checkbox(row, 'Conta no total do ciclo'));
  const sedesIncluded = included.filter(row => text(row, 'Concurso / ciclo') === 'SEDES/DF 2026');

  const financeEntries = financeRows.map(row => ({
    id: uniqueId(row) || row.id,
    name: text(row, 'Lançamento'),
    date: date(row, 'Data'),
    cycle: text(row, 'Concurso / ciclo') || 'Não informado',
    category: text(row, 'Categoria') || 'Não informado',
    situation: text(row, 'Situação') || 'Não informado',
    usage: text(row, 'Uso do recurso') || 'Não informado',
    nature: text(row, 'Natureza') || 'Não informado',
    recordType: text(row, 'Tipo de registro') || 'Não informado',
    recurring: checkbox(row, 'Recorrente'),
    countsInCycle: checkbox(row, 'Conta no total do ciclo'),
    allocationPercent: num(row, 'Rateio ao ciclo (%)'),
    confirmed: num(row, 'Valor confirmado computável (R$)'),
    estimated: num(row, 'Valor estimado computável (R$)'),
    paid: num(row, 'Valor pago (R$)'),
    reimbursed: num(row, 'Valor reembolsado (R$)'),
    sourceAvailable: Boolean(url(row, 'Comprovante / fonte'))
  })).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)));

  const sedesConfirmed = round2(sum(sedesIncluded, row => num(row, 'Valor confirmado computável (R$)')));
  const sedesEstimated = round2(sum(sedesIncluded, row => num(row, 'Valor estimado computável (R$)')));

  snapshot.financeEntries = financeEntries;
  snapshot.financeSummary = {
    totals: {
      confirmed: round2(sum(included, row => num(row, 'Valor confirmado computável (R$)'))),
      estimated: round2(sum(included, row => num(row, 'Valor estimado computável (R$)'))),
      paid: round2(sum(included, row => num(row, 'Valor pago (R$)'))),
      reimbursed: round2(sum(included, row => num(row, 'Valor reembolsado (R$)'))),
      transactions: included.length,
      unconfirmed: financeRows.filter(row => text(row, 'Situação') === 'Não confirmado').length,
      pending: financeRows.filter(row => text(row, 'Situação') === 'Pendente').length
    },
    sedes: {
      confirmed: sedesConfirmed,
      estimated: sedesEstimated,
      transactions: sedesIncluded.length,
      confirmedPaid: financeRows.filter(row => text(row, 'Concurso / ciclo') === 'SEDES/DF 2026' && text(row, 'Situação') === 'Confirmado / pago').length,
      noCost: financeRows.filter(row => text(row, 'Concurso / ciclo') === 'SEDES/DF 2026' && text(row, 'Situação') === 'Confirmado — sem custo').length,
      unconfirmed: financeRows.filter(row => text(row, 'Concurso / ciclo') === 'SEDES/DF 2026' && text(row, 'Situação') === 'Não confirmado').length,
      pending: financeRows.filter(row => text(row, 'Concurso / ciclo') === 'SEDES/DF 2026' && text(row, 'Situação') === 'Pendente').length
    },
    byCycle: groupSummary(included, row => text(row, 'Concurso / ciclo')),
    byCategory: groupSummary(included, row => text(row, 'Categoria')),
    byStatus: groupSummary(financeRows, row => text(row, 'Situação')),
    byUsage: groupSummary(financeRows, row => text(row, 'Uso do recurso'))
  };

  if (sedesIncluded.length) snapshot.metrics.finance.sedesConfirmed = sedesConfirmed;
}

if (registryRows) {
  const realExams = registryRows.filter(row => text(row, 'Escopo') === 'Prova real');
  snapshot.exams = (snapshot.exams || []).map(exam => {
    const needle = exam.name.includes('Caldas') ? 'Caldas Novas' : exam.name.includes('Câmara') ? 'Câmara Goiânia' : null;
    if (!needle) return exam;
    return enrichExam(exam, realExams.find(row => text(row, 'Registro').includes(needle)));
  });

  snapshot.historyCycles = (snapshot.historyCycles || []).map(cycle => {
    const row = matchingCycleRow(cycle.name, registryRows);
    const sourceDate = row ? (date(row, 'Data') || date(row, 'Data auditoria')) : null;
    return sourceDate ? {...cycle, date: sourceDate} : cycle;
  });

  const financialRegistry = registryRows.find(row => text(row, 'Registro').includes('SEDES/DF 2026 — ciclo financeiro'));
  const registryTotal = num(financialRegistry, 'Custo confirmado do ciclo (R$)');
  const operationalTotal = snapshot.financeSummary?.sedes?.confirmed;
  if (registryTotal != null && operationalTotal != null && Math.abs(round2(registryTotal)-round2(operationalTotal)) > .01) {
    warnings.push({
      source:'finance-reconciliation',
      error:'Banco financeiro e Registro Histórico divergem no total confirmado SEDES/DF.',
      operational:round2(operationalTotal),
      registry:round2(registryTotal)
    });
  }
  snapshot.metrics.finance.status = text(financialRegistry, 'Status financeiro') || snapshot.metrics.finance.status;
}

snapshot.meta = {
  ...snapshot.meta,
  workParityEnrichedAt: new Date().toISOString(),
  dataWarnings: warnings
};

mirror.enrichment = {
  generatedAt: snapshot.meta.workParityEnrichedAt,
  financeRows: financeRows?.length ?? null,
  registryRows: registryRows?.length ?? null,
  warnings
};

await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
await fs.writeFile(mirrorPath, JSON.stringify(mirror, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  finance: snapshot.metrics.finance,
  financeSummary: snapshot.financeSummary,
  historyCycles: snapshot.historyCycles?.map(c => ({name:c.name, date:c.date || null, accuracy:c.accuracy})),
  exams: snapshot.exams?.map(e => ({
    name:e.name,
    classification:e.classification,
    stage:e.classificationStage,
    competition:e.competitionPerVacancy,
    vacancies:e.immediateVacancies,
    reserveAC:e.reservePositionsAC
  })),
  warnings
}, null, 2));
