import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const fold = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.planPhase === 'post-exam', null, { timeout: 10000 });
    await page.waitForSelector('[data-v28-transition-console]');
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

await scenario('desktop: Home vira central longitudinal', { width: 1440, height: 1000 }, async page => {
  const text = fold(await page.locator('[data-v28-transition-console]').innerText());
  for (const expected of ['sedes em acompanhamento', 'gabarito', 'recursos', 'seedf', 'tjdft', 'próxima transição']) {
    if (!text.includes(expected)) throw new Error(`Central adaptativa sem: ${expected}`);
  }

  const refresh = fold(await page.locator('#refreshLabel').innerText());
  if (refresh !== 'recarregar snapshot') throw new Error(`Botão de snapshot ambíguo: ${refresh}`);

  const syncLink = page.locator('.sync-command-card [data-v28-sync-workflow]');
  if (await syncLink.count() !== 1) throw new Error('Atalho seguro de sincronização não apareceu na Home.');
  const href = await syncLink.getAttribute('href');
  if (!href?.includes('/actions/workflows/sync-notion.yml')) throw new Error(`Workflow incorreto: ${href}`);
  if (await syncLink.getAttribute('target') !== '_blank') throw new Error('Workflow não abre em contexto separado.');

  await page.screenshot({ path: 'artifacts/desktop-central-adaptativa-v28.png', fullPage: true });
});

await scenario('desktop: trilha estratégica é acionável', { width: 1280, height: 900 }, async page => {
  const seedf = page.locator('.v28-lane').filter({ hasText: 'SEEDF' });
  await seedf.click();
  await page.waitForURL(/#strategy$/);
  if (!await page.locator('.strategy-view').count()) throw new Error('Clique na trilha SEEDF não abriu Estratégia.');
});

await scenario('mobile 390px: central não cria overflow', { width: 390, height: 844 }, async page => {
  const gridColumns = await page.locator('.v28-next-lanes').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (gridColumns.trim().split(/\s+/).length !== 1) throw new Error(`Trilhas não empilharam no mobile: ${gridColumns}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-central-adaptativa-v28.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários da central adaptativa v28 aprovados.');
