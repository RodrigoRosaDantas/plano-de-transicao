import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const baseOrigin = new URL(baseURL).origin;
await fs.mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

async function run(name, viewport, fn) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  const pageErrors = [];
  const badResponses = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(baseOrigin)) badResponses.push(`${response.status()} ${url}`);
  });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content [class*="-view"]');
    await fn(page, context);
    if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(' | ')}`);
    if (badResponses.length) throw new Error(`Recursos HTTP com falha: ${badResponses.join(' | ')}`);
    results.push({ name, pass: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    results.push({ name, pass: false });
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await run('desktop: Agora, decisões, histórico, contexto e operações', { width: 1440, height: 1000 }, async page => {
  await page.waitForSelector('.command-view');
  await page.waitForSelector('.manager-command-card');
  await page.waitForSelector('#managerNowBoard');
  await page.waitForSelector('#managerExamToday');
  await page.waitForSelector('#v11CommandRail');
  await page.waitForSelector('#v11DecisionCenter');
  await page.waitForSelector('#v11AlertRadar');
  await page.waitForSelector('#v11WeeklyHorizon');
  await page.waitForSelector('#v12DecisionHistory');
  await page.waitForSelector('#v12DecisionDrawer', { state: 'attached' });
  if (await page.locator('[data-view="study"]').count()) throw new Error('Ainda existe ação de estudo embutido na interface.');
  const refreshText = await page.locator('#refreshBtn').innerText();
  if (!refreshText.includes('Atualizar')) throw new Error(`Botão Atualizar não está explícito: ${refreshText}`);
  if (await page.locator('.manager-quick-grid > button').count() !== 4) throw new Error('Acessos gerenciais rápidos estão incompletos.');
  if (await page.locator('#managerNowBoard .manager-now-item').count() !== 4) throw new Error('Bloco Agora não entrega os quatro sinais gerenciais.');
  if (await page.locator('#managerExamToday .manager-exam-scopes article').count() !== 2) throw new Error('Leitura “Se a prova fosse hoje” não separa TDAS e EDAS.');
  if (await page.locator('#v11CommandRail button').count() !== 6) throw new Error('Rail da Home não contém Resumo, Atenção, Decisões, Alertas, Semana e Histórico.');
  if (await page.locator('#v11DecisionCenter .v11-decision-card').count() < 3) throw new Error('Centro de decisões possui poucas recomendações rastreáveis.');
  if (await page.locator('#v11AlertRadar .v11-alert').count() < 1) throw new Error('Radar de alertas está vazio.');
  if (await page.locator('#v11WeeklyHorizon .v11-week-grid article').count() !== 3) throw new Error('Horizonte operacional não possui três janelas.');
  if (await page.locator('#v12DecisionHistory .v12-kpis span').count() !== 4) throw new Error('Memória decisória não expõe quatro indicadores de acompanhamento.');
  if (await page.locator('#v12DecisionHistory .v12-filters button').count() !== 4) throw new Error('Filtros do histórico estão incompletos.');

  const firstDecision = page.locator('#v11DecisionCenter .v11-decision-card').first();
  const decisionId = await firstDecision.getAttribute('data-decision-id');
  if (!decisionId) throw new Error('Primeira decisão não possui identificador.');
  await firstDecision.locator('[data-v11-decision-status="adopted"]').click();
  await page.waitForFunction((id) => {
    const state = JSON.parse(localStorage.getItem('plano.decisions.v11') || '{}');
    const journal = JSON.parse(localStorage.getItem('plano.decisionJournal.v12') || '{}');
    return state[id]?.status === 'adopted' && Array.isArray(journal.events) && journal.events.some((event) => event.id === id && event.status === 'adopted');
  }, decisionId);
  const adoptedText = await page.locator(`#v11DecisionCenter [data-decision-id="${decisionId}"] .v11-decision-status`).innerText();
  if (!adoptedText.toLocaleLowerCase('pt-BR').includes('adotada')) throw new Error(`Centro de decisões não refletiu o estado adotado: ${adoptedText}`);
  await page.waitForSelector(`#v12DecisionHistory [data-v12-impact-id="${decisionId}"]`);
  const impactText = await page.locator(`#v12DecisionHistory [data-v12-impact-id="${decisionId}"]`).innerText();
  const impactTextNormalized = impactText.toLocaleLowerCase('pt-BR');
  if (!impactTextNormalized.includes('na decisão') || !impactTextNormalized.includes('agora')) throw new Error(`Comparação pós-decisão não foi montada: ${impactText}`);
  if (!impactTextNormalized.includes('causalidade')) throw new Error('Guardrail de causalidade sumiu do impacto posterior.');

  await page.locator(`#v12DecisionHistory [data-v12-impact-id="${decisionId}"] [data-v12-open-drawer]`).click();
  await page.waitForSelector('#v12DecisionDrawer:not(.hidden)');
  const contextNote = 'Prioridade adotada porque a evidência atual indica maior risco mensurável; revisar após novos blocos.';
  await page.fill('#v12DecisionNote', contextNote);
  await page.click('[data-v12-review-hours="24"]');
  const reviewStatus = await page.locator('#v12ReviewStatus').innerText();
  if (!reviewStatus.includes('Revisão marcada')) throw new Error(`Prazo de revisão não foi registrado: ${reviewStatus}`);
  await page.click('#v12SaveContext');
  await page.waitForFunction(() => document.querySelector('#v12DecisionDrawer')?.classList.contains('hidden'));
  await page.waitForFunction(({ id, note }) => {
    const journal = JSON.parse(localStorage.getItem('plano.decisionJournal.v12') || '{}');
    return journal.notes?.[id]?.text === note && Boolean(journal.reviews?.[id]?.dueAt);
  }, { id: decisionId, note: contextNote });
  await page.waitForFunction((id) => document.querySelector(`#v12DecisionHistory [data-v12-event-id="${CSS.escape(id)}"] blockquote`)?.textContent?.includes('Prioridade adotada'), decisionId);

  await page.click('[data-v12-filter="adopted"]');
  await page.waitForFunction(() => document.querySelector('[data-v12-filter="adopted"]')?.classList.contains('active'));
  if (await page.locator('#v12DecisionHistory .v12-event').count() < 1) throw new Error('Filtro de decisões adotadas esvaziou um histórico válido.');

  await page.keyboard.press('Control+K');
  await page.waitForSelector('#commandPalette:not(.hidden)');
  await page.fill('#searchInput', 'Português');
  if (await page.locator('#searchResults button').count() < 1) throw new Error('Busca global não retornou matéria.');
  await page.keyboard.press('Escape');

  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open');
  const sheetTitle = await page.locator('#moreSheet h2').first().innerText();
  if (!sheetTitle.includes('Central de operações')) throw new Error(`Mais ainda está cru: ${sheetTitle}`);
  await page.waitForSelector('#managerHealthGrid');
  await page.waitForSelector('#v11DecisionOps');
  await page.waitForSelector('#v12DecisionJournalOps');
  if (await page.locator('#managerHealthGrid > div').count() !== 3) throw new Error('Saúde operacional incompleta.');
  if (await page.locator('#v11ExportDecisions').count() !== 1) throw new Error('Central de operações não exporta decisões locais.');
  if (await page.locator('#v12ExportDossier').count() !== 1) throw new Error('Central de operações não exporta o dossiê v12.');
  if (await page.locator('#v12OpenHistory').count() !== 1) throw new Error('Central de operações não abre a memória decisória.');
  const decisionHealth = await page.locator('#v11DecisionHealth').innerText();
  if (!decisionHealth.includes('adotadas')) throw new Error(`Resumo das decisões não foi atualizado: ${decisionHealth}`);
  const journalOps = await page.locator('#v12DecisionJournalOps').innerText();
  if (!journalOps.includes('movimentos') || !journalOps.includes('notas')) throw new Error(`Resumo do dossiê v12 incompleto: ${journalOps}`);

  await page.click('#managerRefreshBtn');
  await page.waitForTimeout(100);
  if ((await page.locator('#refreshBtn').getAttribute('data-v10-loading')) !== 'true') throw new Error('Atualizar não fornece feedback imediato de carregamento.');
  await page.screenshot({ path: 'artifacts/desktop-command-v12.png', fullPage: true });
});

await run('desktop: desempenho mantém tudo e adiciona diagnóstico e prioridades', { width: 1440, height: 1000 }, async page => {
  await page.click('[data-view="performance"]');
  await page.waitForSelector('.performance-view');
  await page.waitForSelector('.manager-performance-nav');
  await page.waitForSelector('#performanceDiagnostic');
  await page.waitForSelector('#performancePriorities');
  if (await page.locator('.manager-performance-nav button').count() !== 7) throw new Error('Navegação contextual de desempenho não contém as sete leituras esperadas.');

  await page.click('[data-performance-scope="tdas"]');
  await page.waitForSelector('#performanceDiagnostic');
  await page.waitForSelector('.subject-table tbody tr');
  const diagnosticText = await page.locator('#performanceDiagnostic').innerText();
  if (!diagnosticText.includes('TDAS 202')) throw new Error(`Diagnóstico não acompanhou o escopo TDAS: ${diagnosticText.slice(0, 120)}`);
  if (await page.locator('#performancePriorities .manager-priority-list button').count() < 1) throw new Error('Ranking de prioridades TDAS está vazio.');

  await page.click('[data-manager-performance="subjects"]');
  await page.waitForTimeout(100);
  if (!(await page.locator('[data-performance-grain="subject"]').evaluate(el => el.classList.contains('active')))) throw new Error('Por matéria não preservou o grão de matéria.');
  await page.click('[data-performance-grain="combination"]');
  if (await page.locator('.subject-table tbody tr').count() < 1) throw new Error('Filtro de combinações não retornou linhas.');
  await page.click('[data-manager-performance="subjects"]');
  await page.fill('#subjectSearch', 'Português');
  await page.waitForTimeout(300);
  const first = await page.locator('.subject-table tbody tr').first().innerText();
  if (!first.includes('Português')) throw new Error(`Busca temática não filtrou Português: ${first}`);

  await page.click('[data-v10-performance="diagnostic"]');
  if (!(await page.locator('[data-v10-performance="diagnostic"]').evaluate(el => el.classList.contains('active')))) throw new Error('Diagnóstico não assume estado ativo.');
  await page.click('[data-v10-performance="priorities"]');
  if (!(await page.locator('[data-v10-performance="priorities"]').evaluate(el => el.classList.contains('active')))) throw new Error('Prioridades não assume estado ativo.');
  await page.screenshot({ path: 'artifacts/desktop-performance-v12.png', fullPage: true });
});

await run('desktop: financeiro, concursos e auditoria permanecem íntegros', { width: 1440, height: 1000 }, async page => {
  await page.click('[data-view="finance"]');
  await page.waitForSelector('.finance-view');
  await page.selectOption('#financeCycle', { label: 'SEDES/DF 2026' });
  if (await page.locator('.ledger-row').count() < 1) throw new Error('Filtro financeiro não retornou lançamentos.');

  await page.click('[data-view="exams"]');
  await page.waitForSelector('.exam-matrix');
  if (await page.locator('.exam-matrix tbody tr').count() < 3) throw new Error('Matriz de concursos incompleta.');
  if (await page.locator('.exam-hero [data-view="study"]').count()) throw new Error('Concursos ainda envia para estudo embutido.');
  const examAction = await page.locator('.exam-hero .primary-button').innerText();
  if (!examAction.includes('Ver preparação')) throw new Error(`Ação da prova não foi reorientada: ${examAction}`);

  await page.click('[data-view="sources"]');
  await page.waitForSelector('.audit-check');
  const score = await page.locator('.audit-score strong').innerText();
  if (!score.includes('/')) throw new Error(`Auditoria visual não carregou: ${score}`);
  await page.screenshot({ path: 'artifacts/desktop-audit-v12.png', fullPage: true });
});

await run('mobile: decisões, histórico, desempenho e Mais sem overflow', { width: 390, height: 844 }, async page => {
  await page.waitForSelector('#managerNowBoard');
  await page.waitForSelector('#v11DecisionCenter');
  await page.waitForSelector('#v11WeeklyHorizon');
  await page.waitForSelector('#v12DecisionHistory');
  if (!(await page.locator('.mobile-dock').isVisible())) throw new Error('Dock móvel não está visível.');
  if (!(await page.locator('#refreshBtn').isVisible())) throw new Error('Atualizar sumiu no mobile.');
  if (!(await page.locator('#refreshBtn').innerText()).includes('Atualizar')) throw new Error('Atualizar virou ícone escondido no mobile.');
  if (await page.locator('.mobile-dock [data-view="study"]').count()) throw new Error('Dock móvel ainda contém Estudar.');
  const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowHome > 2) throw new Error(`Overflow horizontal na Home mobile: ${overflowHome}px`);
  if (await page.locator('#v11CommandRail button').count() !== 6) throw new Error('Rail gerencial mobile não possui Atenção e Histórico.');
  const decisionGridColumns = await page.locator('#v11DecisionCenter .v11-decision-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  if (decisionGridColumns.split(' ').length !== 1) throw new Error(`Decisões não empilharam no mobile: ${decisionGridColumns}`);
  const impactColumns = await page.locator('#v12DecisionHistory .v12-impact-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  if (impactColumns.split(' ').length !== 1) throw new Error(`Impacto v12 não empilhou no mobile: ${impactColumns}`);

  await page.click('.mobile-dock [data-view="performance"]');
  await page.waitForSelector('#performancePriorities');
  const overflowPerformance = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowPerformance > 2) throw new Error(`Overflow horizontal no desempenho mobile: ${overflowPerformance}px`);
  const subjectDisplay = await page.locator('.subject-table').evaluate(el => getComputedStyle(el).display);
  if (subjectDisplay !== 'block') throw new Error(`Tabela de matérias não virou leitura em cards no mobile: display=${subjectDisplay}`);
  const firstRowDisplay = await page.locator('.subject-table tbody tr').first().evaluate(el => getComputedStyle(el).display);
  if (firstRowDisplay !== 'grid') throw new Error(`Linha de matéria não virou card: display=${firstRowDisplay}`);

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.waitForSelector('#v11DecisionOps');
  await page.waitForSelector('#v12DecisionJournalOps');
  if (await page.locator('#moreSheet .manager-data-actions .action-button').count() < 4) throw new Error('Mais não expõe as operações de dados.');
  if (await page.locator('#moreSheet .manager-ecosystem-actions .action-button').count() < 5) throw new Error('Mais não expõe ferramentas e ecossistema completos.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-operations-v12.png', fullPage: true });
});

await run('tablet: memória decisória, jornada e ausência de estudo embutido', { width: 820, height: 1180 }, async page => {
  await page.waitForSelector('#managerNowBoard');
  await page.waitForSelector('#v11DecisionCenter');
  await page.waitForSelector('#v12DecisionHistory');
  if (await page.locator('[data-view="study"]').count()) throw new Error('Tablet ainda expõe Estudar.');
  if (await page.locator('#managerNowBoard .manager-now-item').count() !== 4) throw new Error('Agora tablet incompleto.');
  if (await page.locator('#v11DecisionCenter .v11-decision-card').count() < 3) throw new Error('Central de decisões tablet incompleta.');
  if (await page.locator('#v12DecisionHistory .v12-filters button').count() !== 4) throw new Error('Histórico tablet incompleto.');
  await page.click('[data-view="journey"]');
  await page.waitForSelector('.journey-view');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal tablet: ${overflow}px`);
  if (await page.locator('.timeline-item').count() < 5) throw new Error('Linha do tempo incompleta.');
  await page.screenshot({ path: 'artifacts/tablet-journey-v12.png', fullPage: true });
});

await browser.close();
console.log(`\n${results.filter(item => item.pass).length}/${results.length} cenários de UI aprovados.`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}