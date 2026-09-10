import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(baseURL + '#post-exam', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-post-exam-page]', { timeout: 15000 });
    await page.waitForSelector('[data-v28-post-followup]', { timeout: 15000 });
    await page.waitForSelector('[data-v28-transition-console]', { timeout: 15000 });
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

await scenario('desktop: acabamento preserva a hierarquia da página pós-prova dedicada', { width: 1440, height: 1000 }, async page => {
  const context = page.locator('.postexam-context');
  const radius = await context.evaluate(node => getComputedStyle(node).borderRadius);
  if (radius === '0px') throw new Error('Contexto pós-prova perdeu acabamento visual.');
  if (await page.locator('.v28-flow-step').count() !== 5) throw new Error('Fluxo pós-prova não tem as cinco etapas gerenciais.');
  if (!(await page.locator('.v28-followup-chart-grid').isVisible())) throw new Error('Gráficos do acompanhamento não estão disponíveis.');
  if (!(await page.locator('.v28-competition-panel').isVisible())) throw new Error('Leitura competitiva não está disponível.');
  if (await page.locator('.command-view [data-v28-post-followup], .command-view [data-v28-transition-console], .command-view [data-v28-competition-panel]').count()) {
    throw new Error('A página dedicada contaminou o Agora.');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal desktop: ' + overflow + 'px');
});

await scenario('mobile 390px: polimento compacto sem regressão de layout', { width: 390, height: 844 }, async page => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal mobile: ' + overflow + 'px');

  const flowColumns = await page.locator('.v28-flow').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (flowColumns.trim().split(/\s+/).length !== 1) throw new Error('Fluxo pós-prova não empilhou: ' + flowColumns);
  const chartColumns = await page.locator('.v28-followup-chart-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (chartColumns.trim().split(/\s+/).length !== 1) throw new Error('Gráficos não empilharam: ' + chartColumns);
  const tableOverflow = await page.locator('.v28-audit-table-wrap').first().evaluate(node => getComputedStyle(node).overflowX);
  if (tableOverflow === 'visible') throw new Error('Tabela de auditoria não tem rolagem interna.');

  await page.screenshot({ path: 'artifacts/mobile-post-prova-polish-v29.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários de polimento das fases separadas aprovados.');
