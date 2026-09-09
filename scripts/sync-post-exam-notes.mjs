import fs from 'node:fs/promises';

const token = process.env.NOTION_TOKEN;
if (!token) throw new Error('NOTION_TOKEN não configurado.');

const REGISTRY_DATABASE = 'f1a15942ef2e4844b54ed9b6f892ea2f';
const API_VERSION = '2022-06-28';
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
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function databaseRows(id) {
  let cursor;
  const rows = [];
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const page = await notion(`databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

function text(page, name) {
  const property = page?.properties?.[name];
  if (!property) return '';
  if (property.type === 'title') return (property.title || []).map(item => item.plain_text || '').join('').trim();
  if (property.type === 'rich_text') return (property.rich_text || []).map(item => item.plain_text || '').join('').trim();
  if (property.type === 'select') return property.select?.name || '';
  return '';
}

function date(page, name) {
  const property = page?.properties?.[name];
  return property?.type === 'date' ? property.date?.start || null : null;
}

function parseCandidateResponse(note) {
  const answers = {};
  const invalidQuestions = [];
  const regex = /\b(\d{2})\s*=\s*(A|B|C|D|E|INVÁLIDA_CARTÃO)\b/g;
  let match;
  while ((match = regex.exec(note)) !== null) {
    const number = Number(match[1]);
    const value = match[2];
    if (number < 1 || number > 60) continue;
    answers[number] = value === 'INVÁLIDA_CARTÃO' ? null : value;
    if (value === 'INVÁLIDA_CARTÃO') invalidQuestions.push(number);
  }

  const registered = Object.keys(answers).length;
  if (!registered) return null;
  const validMarks = Object.values(answers).filter(value => value != null).length;

  return {
    version: 2,
    status: registered === 60 ? 'complete' : 'partial',
    examType: 'B',
    registeredQuestions: registered,
    validMarks,
    invalidQuestions,
    answers,
    scoreModel: {
      type: 'B',
      specificCommon: { from: 1, to: 20, pointsPerCorrect: 2, maxPoints: 40 },
      specialty: { from: 21, to: 40, pointsPerCorrect: 2, maxPoints: 40 },
      general: { from: 41, to: 60, pointsPerCorrect: 1, maxPoints: 20 },
      specificTotalMaxPoints: 80,
      objectiveMaxPoints: 100,
      wrongBlankOrMultipleMarksPoints: 0,
      annulledQuestionRule: 'pontuação integral atribuída a todos os candidatos'
    },
    scoreState: 'Aguardando ou acompanhando gabarito oficial conforme estágio publicado',
    source: 'Anotação pós-prova no Notion'
  };
}

const snapshotUrl = new URL('../data/snapshot.json', import.meta.url);
const manualResponsesUrl = new URL('../data/manual-candidate-responses.json', import.meta.url);
const snapshot = JSON.parse(await fs.readFile(snapshotUrl, 'utf8'));
let manualResponses = {};
try {
  manualResponses = JSON.parse(await fs.readFile(manualResponsesUrl, 'utf8'));
} catch {
  manualResponses = {};
}

const rows = await databaseRows(REGISTRY_DATABASE);

const realExams = rows.filter(row => text(row, 'Escopo') === 'Prova real' && date(row, 'Data')?.slice(0, 10) === '2026-09-06');
const notesByProject = new Map(
  realExams
    .map(row => [text(row, 'Projeto'), text(row, 'Anotação pós-prova')])
    .filter(([, note]) => Boolean(note))
);

const projectById = {
  'sedes-2026-tdas': 'TDAS 202',
  'sedes-2026-edas': 'EDAS 400'
};

snapshot.exams = (snapshot.exams || []).map(exam => {
  const project = projectById[exam.id];
  if (!project) return exam;

  const postExamNote = notesByProject.get(project) || exam.postExamNote || '';
  const updated = postExamNote ? { ...exam, postExamNote } : { ...exam };

  if (exam.id === 'sedes-2026-tdas' && postExamNote) {
    const candidateResponse = parseCandidateResponse(postExamNote);
    if (candidateResponse) updated.candidateResponse = candidateResponse;
    updated.examType = 'B';
  }

  const manualResponse = manualResponses[exam.id];
  if (manualResponse?.answers) {
    updated.candidateResponse = manualResponse;
  }
  if (exam.id === 'sedes-2026-edas') updated.examType = 'A';

  return updated;
});

const currentScoring = snapshot.postExam?.scoring || {};
const tdasResponse = snapshot.exams.find(exam => exam.id === 'sedes-2026-tdas')?.candidateResponse;
const edasResponse = snapshot.exams.find(exam => exam.id === 'sedes-2026-edas')?.candidateResponse;

snapshot.postExam = {
  ...(snapshot.postExam || {}),
  scoring: {
    ...currentScoring,
    tdas: {
      ...(currentScoring.tdas || {}),
      examType: 'B',
      status: tdasResponse ? 'candidate-response-ready' : 'candidate-response-pending'
    },
    edas: {
      ...(currentScoring.edas || {}),
      examType: 'A',
      status: edasResponse ? 'candidate-response-ready' : 'candidate-response-pending'
    }
  }
};

snapshot.meta = {
  ...(snapshot.meta || {}),
  postExamNotesSyncedAt: new Date().toISOString(),
  postExamCandidateResponsesSyncedAt: new Date().toISOString()
};

await fs.writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Anotações pós-prova sincronizadas: ${[...notesByProject.keys()].join(', ') || 'nenhuma'}. Respostas manuais: ${Object.keys(manualResponses).join(', ') || 'nenhuma'}.`);
