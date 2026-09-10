import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.planPhase === 'post-exam', null, { timeout: 10000 });
    await page.waitForSelector('.command-view .transition-now-hero', { state: 'attached' });
    await page.waitForSelector('#v14FocusControl', { state: 'attached' });
    await run(page);
    if (errors.length) throw new Error(`Erros JavaScript: ${errors.join(' | ')}`);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await scenario('desktop: controle de foco e prioridades orientadas por dados permanecem na Home', { width: 1440, height: 1000 }, async (page) => {
  if (await page.locator('#v14FocusControl').count() !== 1 || await page.locator('#v14FocusControl').isVisible()) throw new Error('Controle de foco legado deveria ficar recolhido no Agora redesenhado.');
  for (const selector of ['.command-view > .transition-now-hero', '.command-view > .transition-kpi-grid', '.command-view > .transition-next', '.command-view > .transition-decision-grid', '.command-view > .transition-history', '.command-view > .transition-footer']) {
    if (!(await page.locator(selector).isVisible())) throw new Error('Central de transição sem: ' + selector);
  }
  if (await page.locator('.command-view #v13ManagerInbox, .command-view #managerNowBoard, .command-view #v11DecisionCenter, .command-view #v11AlertRadar, .command-view #v12DecisionHistory, .command-view #v15TransitionSummary, .command-view .plan-control-card, .command-view .focus-board, .command-view .priority-grid').count()) throw new Error('Conteúdo legado ou pós-prova vazou para a Home.');
  if (await page.locator('.command-view [data-v28-transition-console], .command-view [data-v28-post-followup], .command-view [data-v28-competition-panel], .command-view [data-post-exam-page]').count()) throw new Error('Detalhamento pós-prova vazou para a Home.');

  const mode = await page.locator('.command-view').getAttribute('data-v14-mode');
  if (!['expanded', 'focus'].includes(mode || '')) throw new Error(`Estado v14 deixou de ser preservado internamente: ${mode}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Pós-prova desktop criou overflow horizontal: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/desktop-focus-v14-post-exam.png', fullPage: true });
});

await scenario('mobile: mobile preserva controles de dados sem trazer o pós-prova detalhado', { width: 390, height: 844 }, async (page) => {
  if (await page.locator('#v14FocusControl').count() !== 1 || await page.locator('#v14FocusControl').isVisible()) throw new Error('Controle v14 legado deveria ficar recolhido no mobile.');
  for (const selector of ['.command-view > .transition-now-hero', '.command-view > .transition-kpi-grid', '.command-view > .transition-next', '.command-view > .transition-decision-grid', '.command-view > .transition-footer']) {
    if (!(await page.locator(selector).isVisible())) throw new Error('Central de transição incompleta no mobile: ' + selector);
  }
  if (await page.locator('.command-view #v13ManagerInbox, .command-view #managerNowBoard, .command-view #v11DecisionCenter, .command-view #v11AlertRadar, .command-view #v12DecisionHistory, .command-view #v15TransitionSummary, .command-view .plan-control-card, .command-view .focus-board, .command-view .priority-grid').count()) throw new Error('Conteúdo legado ou pós-prova vazou para a Home móvel.');
  if (await page.locator('.command-view [data-v28-transition-console], .command-view [data-v28-post-followup], .command-view [data-v28-competition-panel], .command-view [data-post-exam-page]').count()) throw new Error('Detalhamento pós-prova vazou para a Home móvel.');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Pós-prova mobile criou overflow horizontal: ${overflow}px`);

  const [pageHeight, viewportHeight] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  if (pageHeight <= viewportHeight) throw new Error('Teste mobile não percorreu conteúdo suficiente para validar a composição.');

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  if (!(await page.locator('#v14FocusOps').count())) throw new Error('Operação histórica do modo foco deixou de existir no menu Mais.');
  await page.screenshot({ path: 'artifacts/mobile-focus-v14-post-exam.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários v14 aprovados para a fase pós-prova.');
