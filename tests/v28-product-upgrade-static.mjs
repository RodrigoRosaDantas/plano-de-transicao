import fs from 'node:fs';

const source = fs.readFileSync('assets/post-exam-score-v28.js', 'utf8');
const followUp = fs.readFileSync('assets/post-exam-follow-up-v28.js', 'utf8');
const competition = fs.readFileSync('assets/post-exam-competition-v28.js', 'utf8');
const app = fs.readFileSync('assets/work-app.js', 'utf8');
const pageStyles = fs.readFileSync('assets/transition-pages-v29.css', 'utf8');
const transitionGate = fs.readFileSync('assets/transition-gate-v15.js', 'utf8');
const workspace = fs.readFileSync('assets/workspace-v23.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const scoring = fs.readFileSync('scripts/score-post-exam.mjs', 'utf8');
const postExamState = fs.readFileSync('scripts/apply-post-exam-state.mjs', 'utf8');
const snapshot = JSON.parse(fs.readFileSync('data/snapshot.json', 'utf8'));
const failures = [];

function expect(label, condition) {
  if (!condition) failures.push(label);
}

expect('index carrega a camada v28', index.includes('assets/post-exam-score-v28.js?v=29'));
expect('index carrega o módulo competitivo v28', index.includes('assets/post-exam-competition-v28.js?v=29'));
expect('v28 mantém a nota pós-prova', source.includes('Nota objetiva estimada'));
expect('v28 cria central adaptativa', source.includes('data-v28-transition-console'));
expect('v28 separa SEDES da próxima preparação', source.includes('SEDES em acompanhamento. A transição já pode olhar para frente.'));
expect('v28 inclui trilha SEEDF', source.includes('<strong>SEEDF</strong>'));
expect('v28 inclui trilha TJDFT', source.includes('<strong>TJDFT</strong>'));
expect('v28 diferencia recarga de snapshot', source.includes('Recarregar snapshot'));
expect('v28 oferece sincronização segura', source.includes('actions/workflows/sync-notion.yml'));
expect('v28 não expõe token do Notion', !source.includes('NOTION_TOKEN') && !competition.includes('NOTION_TOKEN'));
expect('v28 não mantém renderer competitivo legado', !source.includes('${competitionPanel(data)}') && !source.includes('function competitionPanel(') && competition.includes('removeLegacyCompetitionPanel'));
expect('v28 ignora score bruto do candidato como correção oficial', source.includes('return Boolean(exam?.scoreTracking?.preliminary || exam?.scoreTracking?.definitive);'));
expect('v28 não cria nova camada v29', !source.includes('v29') && !competition.includes('v29'));
expect('módulo exibe leitura competitiva preliminar', competition.includes('data-v28-competition-panel'));
expect('módulo chama taxa de correção de nominal', competition.includes('Taxa nominal de correção AC'));
expect('módulo não confunde taxa nominal com chance pessoal', competition.includes('Chance pessoal: ainda não estimável com rigor') && competition.includes('não é sua probabilidade individual'));
expect('motor registra probabilidade pessoal como indisponível', scoring.includes("available: false") && scoring.includes("personalProbabilityStatus: 'not-estimable-yet'"));
expect('v28 exibe auditoria questão a questão', source.includes('AUDITORIA QUESTÃO A QUESTÃO') && source.includes('data-v28-answer-audit'));
expect('v28 separa anotação do candidato e gabarito preliminar', source.includes('Anotadas na prova') && source.includes('não são gabarito oficial') && source.includes('Gabarito preliminar oficial'));
expect('v28 expõe acertos, erros e pontos por questão', source.includes('Ver o cruzamento das') && source.includes('Sua anotação') && source.includes('Pontos'));
expect('v28 expõe pré-análise de recursos', source.includes('Pré-análise de recursos') && source.includes('Não priorizar só pela divergência'));
expect('v28 liga o painel pós-prova', index.includes('assets/post-exam-follow-up-v28.js?v=29') && followUp.includes('ACOMPANHAMENTO PÓS-PROVA'));
expect('v28 mostra gráficos de resultado', followUp.includes('v28-followup-chart-grid') && followUp.includes('v28-followup-stack') && followUp.includes('v28-followup-area-row'));
expect('v28 mostra linha do tempo oficial', followUp.includes('v28-followup-milestones') && followUp.includes('LINHA DO TEMPO OFICIAL'));
expect('v28 não re-renderiza o painel em loop', followUp.includes('const followUpSignature =') && (followUp.split('const signature = followUpSignature(data);').length - 1) === 2);
expect('v28 exibe os dois mínimos objetivos corretamente', followUp.includes('minimumsMet') && followUp.includes('/2</b> mínimos objetivos atingidos'));
expect('v28 exibe horário oficial dos recursos', followUp.includes('fmtOfficialWindow') && followUp.includes('horário de Brasília'));
expect('v28 deixa pré-prova pronta para ativação', followUp.includes('v28-preexam-ready') && snapshot.preExamReadiness?.title === 'Pré-prova pronta para ativar');
expect('snapshot guarda acompanhamento pós-prova', Boolean(snapshot.postExam?.followUp?.milestones?.length) && Boolean(snapshot.postExam?.followUp?.exams?.tdas) && Boolean(snapshot.postExam?.followUp?.exams?.edas));
expect('snapshot guarda modo pré-prova de espera', snapshot.preExamReadiness?.status === 'standby' && snapshot.preExamReadiness?.checklist?.length >= 7);
expect('motor registra fundamento da banca por questão', scoring.includes('officialBasis') && scoring.includes('officialJustificationSource'));
expect('motor registra protocolo de recurso', scoring.includes('resourceProtocol') && scoring.includes('questionByQuestion'));
expect('snapshot possui 60 linhas por cargo', snapshot.postExam?.scoring?.tdas?.preliminary?.questions?.length === 60 && snapshot.postExam?.scoring?.edas?.preliminary?.questions?.length === 60);
expect('snapshot distingue fonte do candidato e chave', snapshot.postExam?.scoring?.tdas?.preliminary?.audit?.responseIsOfficialKey === false && snapshot.postExam?.scoring?.tdas?.preliminary?.audit?.keyLabel === 'Gabarito preliminar oficial');
expect('snapshot preserva Q30 como registro inválido', snapshot.postExam?.scoring?.tdas?.preliminary?.questions?.find((item) => item.question === 30)?.status === 'inválida-ou-em-branco');
expect('motor registra taxas auditáveis AC', scoring.includes('registrationsAC: 68345') && scoring.includes('correctionSlotsAC: 2387') && scoring.includes('registrationsAC: 4112') && scoring.includes('correctionSlotsAC: 282'));
expect('estado pós-prova preserva scoring existente', postExamState.includes('...previousPostExam') && postExamState.includes('scoringPreserved'));
expect('estado pós-prova reconhece gabarito preliminar', postExamState.includes('Gabarito preliminar incorporado · resultado objetivo oficial pendente'));
expect('snapshot preserva scoring pós-prova', Boolean(snapshot.postExam?.scoring?.tdas?.preliminary) && Boolean(snapshot.postExam?.scoring?.edas?.preliminary));
expect('snapshot preserva leitura competitiva', Boolean(snapshot.postExam?.competitionReading));
expect('TDAS preliminar auditado em 83', snapshot.postExam?.competitionReading?.exams?.tdas?.preliminaryScore === 83);
expect('EDAS preliminar auditado em 88', snapshot.postExam?.competitionReading?.exams?.edas?.preliminaryScore === 88);
expect('taxa nominal TDAS AC é 3,49%', snapshot.postExam?.competitionReading?.exams?.tdas?.nominalCorrectionRateAC === 3.49);
expect('taxa nominal EDAS AC é 6,86%', snapshot.postExam?.competitionReading?.exams?.edas?.nominalCorrectionRateAC === 6.86);
expect('probabilidade pessoal não é inventada', snapshot.postExam?.competitionReading?.personalProbability?.available === false && snapshot.postExam?.competitionReading?.personalProbability?.value == null);
expect('router possui página pré-prova', app.includes('function preExamView') && app.includes('"pre-exam": preExamView'));
expect('router possui página pós-prova', app.includes('function postExamView') && app.includes('"post-exam": postExamView'));
expect('Home mantém cartão de plano, não cartão pós-prova', app.includes('plan-control-card') && app.includes('A SEDES/DF está preservada como histórico'));
expect('navegação expõe pré-prova', index.includes('data-view="pre-exam"') && index.includes('Pré-prova'));
expect('navegação expõe pós-prova', index.includes('data-view="post-exam"') && index.includes('Pós-prova'));
expect('pré-prova usa o modelo de prontidão', app.includes('data.preExamReadiness') && app.includes('CHECKLIST DE ATIVAÇÃO'));
expect('pós-prova usa host dedicado', app.includes('data-post-exam-page') && app.includes('postExamControlSlot'));
expect('follow-up não injeta na Home', followUp.includes("[data-post-exam-page]") && !followUp.includes("querySelector('.command-view')"));
expect('console adaptativo foi movido para o host pós-prova', source.includes('function patchDedicated') && source.includes('[data-post-exam-page]'));
expect('leitura competitiva não injeta na Home', competition.includes('function mountDedicated') && !competition.includes("querySelector('.command-view')"));
expect('fechamento local saiu da Home', transitionGate.includes("$('#postExamControlSlot')") && !transitionGate.includes("const root = $('.command-view')"));
expect('shell conhece as novas fases', workspace.includes("'pre-exam'") && workspace.includes("'post-exam'"));
expect('cache v29 inclui estilos das fases', serviceWorker.includes("plano-transicao-v29-separate-phases") && serviceWorker.includes("'./assets/transition-pages-v29.css'"));
expect('estilos das fases existem', pageStyles.includes('.preexam-hero') && pageStyles.includes('.post-exam-view'));


if (failures.length) {
  console.error('Falhas na auditoria estática v28:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS  central adaptativa, leitura competitiva preliminar e sincronização segura v28');