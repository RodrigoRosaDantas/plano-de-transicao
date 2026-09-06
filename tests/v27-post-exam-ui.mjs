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
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.planPhase === 'post-exam', null, { timeout: 10000 });
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

await scenario('desktop: Home mudou de preparação para pós-prova', { width: 1440, height: 1000 }, async page => {
  await page.waitForSelector('.command-view .v27-home-status');
  const homeText = await page.locator('.command-view').innerText();
  for (const value of ['As duas provas foram realizadas.', 'PÓS-PROVA', 'Corrigir, recorrer e acompanhar']) {
    if (!homeText.includes(value)) throw new Error(`Home pós-prova sem: ${value}`);
  }
  const tabText = await page.locator('#mainTabs [data-exam-day-tab]').innerText();
  if (!tabText.includes('Pós-prova')) throw new Error(`Aba não foi renomeada: ${tabText}`);
  const milestone = await page.locator('#nextMilestone').innerText();
  if (!milestone.includes('GABARITO')) throw new Error(`Próximo marco continua pré-prova: ${milestone}`);
  if (await page.locator('.command-view > .priority-grid').isVisible()) throw new Error('Prioridades pré-prova continuam ocupando a Home.');
  if (await page.locator('.command-view > .focus-board').isVisible()) throw new Error('Foco pré-prova continua ocupando a Home.');
  await page.screenshot({ path: 'artifacts/desktop-pos-prova-v27-home.png', fullPage: true });
});

await scenario('desktop: Pós-prova prioriza gabarito e preserva logística recolhida', { width: 1440, height: 1000 }, async page => {
  await page.locator('#mainTabs [data-exam-day-tab]').click();
  await page.waitForURL(/#exam-day$/);
  await page.waitForSelector('[data-post-exam-v27]');

  const text = await page.locator('[data-post-exam-v27]').innerText();
  for (const value of ['Provas concluídas.', 'PRÓXIMOS PASSOS', 'EDAS · manhã', 'TDAS · tarde', 'Aguardando gabarito']) {
    if (!text.includes(value)) throw new Error(`Pós-prova sem conteúdo esperado: ${value}`);
  }
  if (await page.locator('.v27-archive').getAttribute('open') !== null) throw new Error('Arquivo de logística abriu por padrão e voltou a dominar a tela.');
  const route = page.getByText('Abrir rota', { exact: false });
  if (await route.count() && await route.first().isVisible()) throw new Error('Rota pré-prova continua visível antes de abrir o histórico.');
  if (await page.locator('.v27-exam-card').count() !== 2) throw new Error('EDAS e TDAS não ficaram separados no pós-prova.');

  await page.locator('.v27-archive > summary').click();
  await page.waitForFunction(() => document.querySelector('.v27-archive')?.open === true);
  const archiveText = await page.locator('.v27-archive').innerText();
  for (const value of ['Centro de Ensino Fundamental Telebrasília', '06:45–07:45', '13:45–14:45']) {
    if (!archiveText.includes(value)) throw new Error(`Histórico logístico ausente: ${value}`);
  }

  await page.locator('.v27-notes > summary').click();
  await page.locator('[data-v27-note="edas"]').fill('Prova da manhã concluída; registrar depois pontos para recurso.');
  await page.locator('[data-v27-save-notes]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('plano-transicao:post-exam-v27:notes') || '{}').edas?.includes('Prova da manhã'));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal desktop: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/desktop-pos-prova-v27.png', fullPage: true });
});

await scenario('mobile 390px: pós-prova compacto e sem regressão horizontal', { width: 390, height: 844 }, async page => {
  await page.waitForSelector('#mobileDock [data-exam-day-tab]');
  const label = await page.locator('#mobileDock [data-exam-day-tab]').innerText();
  if (!label.includes('Pós-prova')) throw new Error(`Dock móvel ainda está pré-prova: ${label}`);

  await page.locator('#mobileDock [data-exam-day-tab]').click();
  await page.waitForSelector('[data-post-exam-v27]');
  if (await page.locator('.v27-exam-card').count() !== 2) throw new Error('Cards dos dois cargos não renderizaram no mobile.');
  const cols = await page.locator('.v27-exam-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (cols.trim().split(/\s+/).length !== 1) throw new Error(`Cards não empilharam no mobile: ${cols}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-pos-prova-v27.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários pós-prova v27 aprovados.');
