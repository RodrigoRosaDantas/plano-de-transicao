import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const fold = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

async function boot(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#content[aria-busy="false"]', { timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.dataset.planPhase === 'post-exam', null, { timeout: 10000 });
}

async function openView(page, view) {
  await page.locator('[data-view="' + view + '"]:visible').first().click();
  await page.waitForURL(new RegExp('#' + view + '$'));
}

async function openPost(page) {
  await openView(page, 'post-exam');
  await page.waitForSelector('.post-exam-view [data-v28-transition-console]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-post-followup]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-competition-panel]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-question-audit]', { timeout: 15000 });
}

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await boot(page);
    await run(page);
    if (errors.length) throw new Error('Erros JavaScript: ' + errors.join(' | '));
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error('FAIL  ' + name + '\n' + (error?.stack || error));
  } finally {
    await context.close();
  }
}

await scenario('desktop: controles do plano permanecem na Home', { width: 1440, height: 1100 }, async page => {
  await page.waitForSelector('.command-view .plan-control-card');
  const home = page.locator('.command-view');
  const text = fold(await home.innerText());
  for (const expected of ['plano de transição', 'dados, desempenho, fontes e decisões', 'questões no histórico', 'aproveitamento reconciliado']) {
    if (!text.includes(expected)) throw new Error('Home sem foco de controle: ' + expected);
  }
  if (await home.locator('[data-v28-transition-console], [data-v28-post-followup], [data-v28-competition-panel], [data-post-exam-page]').count()) {
    throw new Error('A Home voltou a carregar dados detalhados do pós-prova.');
  }
  const syncLink = page.locator('.sync-command-card [data-v28-sync-workflow]');
  if (await syncLink.count() !== 1) throw new Error('Controle de sincronização não está disponível na Home.');
  if (await syncLink.getAttribute('target') !== '_blank') throw new Error('Sincronização não abre em contexto separado.');
  const milestone = fold(await page.locator('#nextMilestone').innerText());
  if (!milestone.includes('dados e decisões') || !milestone.includes('plano de transição')) throw new Error('Marco global perdeu o foco do plano: ' + milestone);
  await page.screenshot({ path: 'artifacts/desktop-home-controles-v29.png', fullPage: true });
});

await scenario('desktop: pós-prova preserva leitura competitiva preliminar e auditoria', { width: 1366, height: 1100 }, async page => {
  await openPost(page);
  const post = page.locator('.post-exam-view');
  const text = fold(await post.textContent());
  for (const expected of ['central adaptativa', 'sedes em acompanhamento', 'leitura competitiva', 'preliminar', '3,49%', '6,86%', '83/100', '88/100', 'auditoria questão a questão', 'gabarito preliminar', 'sujeito a recurso e alteração']) {
    if (!text.includes(expected)) throw new Error('Pós-prova sem dado auditado: ' + expected);
  }
  const competition = post.locator('[data-v28-competition-panel]');
  if (await competition.count() !== 1) throw new Error('Leitura competitiva duplicada ou ausente.');
  const competitionText = fold(await competition.innerText());
  for (const expected of ['2.387 correções', '282 correções', '50/100', 'chance pessoal: ainda não estimável']) {
    if (!competitionText.includes(expected)) throw new Error('Leitura competitiva sem: ' + expected);
  }
  const rows = post.locator('[data-v28-question-audit] .v28-audit-row');
  if (await rows.count() !== 120) throw new Error('Auditoria questão a questão sem os 120 registros: ' + await rows.count());
  const control = post.locator('#postExamControlSlot #v15TransitionSummary');
  if (await control.count() !== 1) throw new Error('Controle de fechamento pós-prova não ficou na página dedicada.');
  await post.locator('.v28-lane').filter({ hasText: 'SEEDF' }).click();
  await page.waitForURL(/#strategy$/);
  if (await page.locator('.strategy-view').count() !== 1) throw new Error('A trilha SEEDF não abriu a página Estratégia.');
  await page.screenshot({ path: 'artifacts/desktop-post-prova-controles-v29.png', fullPage: true });
});

await scenario('mobile 390px: pós-prova dedicada mantém densidade sem overflow', { width: 390, height: 844 }, async page => {
  await openPost(page);
  const post = page.locator('.post-exam-view');
  const chartColumns = await post.locator('.v28-followup-chart-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (chartColumns.trim().split(/\s+/).length !== 1) throw new Error('Gráficos não empilharam no mobile: ' + chartColumns);
  const competitionColumns = await post.locator('.v28-competition-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (competitionColumns.trim().split(/\s+/).length !== 1) throw new Error('Leitura competitiva não empilhou no mobile: ' + competitionColumns);
  const statsColumns = await post.locator('.v28-competition-stats').first().evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (statsColumns.trim().split(/\s+/).length !== 1) throw new Error('Indicadores competitivos não empilharam no mobile: ' + statsColumns);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal mobile: ' + overflow + 'px');
  await page.screenshot({ path: 'artifacts/mobile-post-prova-controles-v29.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários de produto v29 aprovados.');
