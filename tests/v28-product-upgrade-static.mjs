import fs from 'node:fs';

const source = fs.readFileSync('assets/post-exam-score-v28.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const scoring = fs.readFileSync('scripts/score-post-exam.mjs', 'utf8');
const postExamState = fs.readFileSync('scripts/apply-post-exam-state.mjs', 'utf8');
const failures = [];

function expect(label, condition) {
  if (!condition) failures.push(label);
}

expect('index carrega a camada v28', index.includes('assets/post-exam-score-v28.js?v=28'));
expect('v28 mantém a nota pós-prova', source.includes('Nota objetiva estimada'));
expect('v28 cria central adaptativa', source.includes('data-v28-transition-console'));
expect('v28 separa SEDES da próxima preparação', source.includes('SEDES em acompanhamento. A transição já pode olhar para frente.'));
expect('v28 inclui trilha SEEDF', source.includes('<strong>SEEDF</strong>'));
expect('v28 inclui trilha TJDFT', source.includes('<strong>TJDFT</strong>'));
expect('v28 diferencia recarga de snapshot', source.includes('Recarregar snapshot'));
expect('v28 oferece sincronização segura', source.includes('actions/workflows/sync-notion.yml'));
expect('v28 não expõe token do Notion', !source.includes('NOTION_TOKEN'));
expect('v28 não cria nova camada v29', !source.includes('v29'));
expect('v28 exibe leitura competitiva preliminar', source.includes('data-v28-competition'));
expect('v28 chama taxa de avanço de nominal', source.includes('Taxa nominal bruta de avanço AC'));
expect('v28 não confunde taxa nominal com chance pessoal', source.includes('Probabilidade pessoal: ainda não estimável com rigor.'));
expect('motor registra probabilidade pessoal como indisponível', scoring.includes("available: false") && scoring.includes("personalProbabilityStatus: 'not-estimable-yet'"));
expect('motor registra taxas auditáveis AC', scoring.includes('registrationsAC: 68345') && scoring.includes('correctionSlotsAC: 2387') && scoring.includes('registrationsAC: 4112') && scoring.includes('correctionSlotsAC: 282'));
expect('estado pós-prova preserva scoring existente', postExamState.includes('...previousPostExam') && postExamState.includes('scoringPreserved'));
expect('estado pós-prova reconhece gabarito preliminar', postExamState.includes('Gabarito preliminar incorporado · resultado objetivo oficial pendente'));

if (failures.length) {
  console.error('Falhas na auditoria estática v28:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS  central adaptativa, leitura competitiva preliminar e sincronização segura v28');