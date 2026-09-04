import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, run) {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content[aria-busy="false"]', { timeout: 15000 });
    await page.waitForFunction(() => document.body?.dataset?.workspaceVersion === '23', null, { timeout: 10000 });
    await run(page);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error(`FAIL  ${name}`);
    console.error(error);
  } finally {
    await page.close();
  }
}

await scenario('desktop: rail lateral, Home editorial e páginas internas sem missão', { width: 1440, height: 1000 }, async page => {
  const rail = page.locator('.tab-rail');
  const railStyle = await rail.evaluate(el => {
    const s = getComputedStyle(el);
    return { position: s.position, width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left };
  });
  if (railStyle.position !== 'fixed') throw new Error(`Rail não está fixo: ${railStyle.position}`);
  if (railStyle.width < 210 || railStyle.width > 235) throw new Error(`Largura inesperada do rail: ${railStyle.width}px`);
  if (Math.abs(railStyle.left) > 2) throw new Error(`Rail não está ancorado à esquerda: ${railStyle.left}px`);

  if (!(await page.locator('.mission-strip').isVisible())) throw new Error('Missão deveria estar visível na Home.');

  await page.locator('#mainTabs [data-view="performance"]').click();
  await page.waitForTimeout(250);
  if (await page.locator('.mission-strip').isVisible()) throw new Error('Missão global permaneceu visível em Desempenho.');
  const bodyClass = await page.locator('body').getAttribute('class');
  if (!bodyClass?.includes('v23-view-performance')) throw new Error(`Classe de view incorreta: ${bodyClass}`);

  const contentBox = await page.locator('#content').boundingBox();
  if (!contentBox || contentBox.x < 220) throw new Error(`Conteúdo não respeitou rail lateral: x=${contentBox?.x}`);

  await page.screenshot({ path: 'artifacts/desktop-workspace-v23.png', fullPage: true });
});

await scenario('desktop: Dia da Prova continua integrado ao workspace', { width: 1440, height: 1000 }, async page => {
  await page.locator('[data-exam-day-tab]').first().click();
  await page.waitForSelector('.exam21-shell', { timeout: 10000 });
  const bodyClass = await page.locator('body').getAttribute('class');
  if (!bodyClass?.includes('v23-view-exam-day')) throw new Error(`Dia da Prova sem classe v23: ${bodyClass}`);
  const railPos = await page.locator('.tab-rail').evaluate(el => getComputedStyle(el).position);
  if (railPos !== 'fixed') throw new Error('Dia da Prova perdeu o rail lateral desktop.');
});

await scenario('mobile 390px: sem overflow e dock preservado', { width: 390, height: 844 }, async page => {
  const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (dims.sw - dims.cw > 2) throw new Error(`Overflow horizontal mobile: ${dims.sw}px vs ${dims.cw}px`);

  const railPos = await page.locator('.tab-rail').evaluate(el => getComputedStyle(el).position);
  if (railPos === 'fixed') throw new Error('Rail desktop permaneceu fixo no mobile.');
  if (!(await page.locator('#mobileDock').isVisible())) throw new Error('Dock mobile não está visível.');

  await page.locator('#mobileDock [data-view="performance"]').click();
  await page.waitForTimeout(200);
  if (await page.locator('.mission-strip').isVisible()) throw new Error('Missão permaneceu visível em página interna no mobile.');
  await page.screenshot({ path: 'artifacts/mobile-workspace-v23.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('3/3 cenários v23 aprovados.');
