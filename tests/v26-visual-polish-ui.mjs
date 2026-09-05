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

await scenario('desktop: hierarquia, sidebar agrupada e profundidade seletiva', { width: 1440, height: 1000 }, async page => {
  const loaded = await page.evaluate(() => [...document.styleSheets].some(s => String(s.href || '').includes('workspace-v26-polish.css')));
  if (!loaded) throw new Error('CSS v26 não foi carregado.');

  const groups = await page.locator('#mainTabs button').evaluateAll(buttons => ({
    acompanhamento: getComputedStyle(buttons[1], '::before').content,
    plano: getComputedStyle(buttons[4], '::before').content,
    sistema: getComputedStyle(buttons[6], '::before').content
  }));
  if (!groups.acompanhamento.includes('ACOMPANHAMENTO')) throw new Error(`Grupo ACOMPANHAMENTO ausente: ${groups.acompanhamento}`);
  if (!groups.plano.includes('PLANO')) throw new Error(`Grupo PLANO ausente: ${groups.plano}`);
  if (!groups.sistema.includes('SISTEMA')) throw new Error(`Grupo SISTEMA ausente: ${groups.sistema}`);

  const missionFont = await page.locator('.mission-copy > p').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  if (missionFont < 12.5) throw new Error(`Texto editorial pequeno demais: ${missionFont}px`);

  await page.locator('#mainTabs [data-view="performance"]').click();
  await page.waitForTimeout(220);
  await page.waitForSelector('.performance-score', { timeout: 10000 });
  const scoreStyle = await page.locator('.performance-score').evaluate(el => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, bg: s.backgroundImage, border: s.borderTopColor };
  });
  if (!scoreStyle.shadow || scoreStyle.shadow === 'none') throw new Error('Desempenho não recebeu profundidade seletiva.');
  if (!scoreStyle.bg || scoreStyle.bg === 'none') throw new Error('Desempenho não recebeu superfície elevada.');

  await page.screenshot({ path: 'artifacts/desktop-v26-performance.png', fullPage: true });
});

await scenario('desktop: Jornada comunica transição sem novo conteúdo', { width: 1440, height: 1000 }, async page => {
  await page.locator('#mainTabs [data-view="journey"]').click();
  await page.waitForTimeout(220);
  await page.waitForSelector('.journey-flow', { timeout: 10000 });
  const line = await page.locator('.journey-flow').evaluate(el => {
    const s = getComputedStyle(el, '::before');
    return { content: s.content, bg: s.backgroundImage, height: s.height };
  });
  if (line.content === 'none') throw new Error('Linha visual da Jornada não foi criada.');
  if (!line.bg || line.bg === 'none') throw new Error('Jornada sem gradiente de transição.');
  await page.screenshot({ path: 'artifacts/desktop-v26-journey.png', fullPage: true });
});

await scenario('mobile 390px: legibilidade, dock e ausência de overflow', { width: 390, height: 844 }, async page => {
  const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (dims.sw - dims.cw > 2) throw new Error(`Overflow horizontal mobile: ${dims.sw}px vs ${dims.cw}px`);

  const missionFont = await page.locator('.mission-copy > p').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  if (missionFont < 13) throw new Error(`Texto da Home pequeno no mobile: ${missionFont}px`);

  const dock = page.locator('#mobileDock');
  if (!(await dock.isVisible())) throw new Error('Dock mobile não está visível.');
  const dockStyle = await dock.evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, backdrop: getComputedStyle(el).backdropFilter }));
  if (!dockStyle.shadow || dockStyle.shadow === 'none') throw new Error('Dock mobile sem profundidade.');

  await page.locator('#mobileDock [data-view="journey"]').click();
  await page.waitForTimeout(180);
  const dimsJourney = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (dimsJourney.sw - dimsJourney.cw > 2) throw new Error(`Overflow na Jornada mobile: ${dimsJourney.sw}px vs ${dimsJourney.cw}px`);

  await page.screenshot({ path: 'artifacts/mobile-v26-home-journey.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('3/3 cenários v26 aprovados.');
