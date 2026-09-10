import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, fn) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.click('#mainTabs [data-view="pre-exam"]');
    await page.waitForSelector('.pre-exam-view');
    await fn(page);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.stack || error}`);
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await scenario('pré-edital: cards, cargos, notícias e filtro', { width: 1440, height: 1000 }, async (page) => {
  if (await page.locator('.preexam-project-card').count() !== 2) throw new Error('Radar não exibiu os dois projetos.');
  if (!(await page.locator('.preexam-project-card--tjdft').innerText()).includes('Técnico Judiciário')) throw new Error('TJDFT sem cargo no radar.');
  if (!(await page.locator('.preexam-project-card--seedf').innerText()).includes('Gestor')) throw new Error('SEEDF sem cargo no radar.');
  if (await page.locator('.preexam-news-badge--external').count() < 1) throw new Error('Notícia externa não foi identificada.');
  await page.click('[data-pre-exam-filter="tjdft"]');
  if (!(await page.locator('.preexam-project-card--tjdft').isVisible())) throw new Error('Filtro TJDFT ocultou o projeto correto.');
  if (await page.locator('.preexam-project-card--seedf').isVisible()) throw new Error('Filtro TJDFT não ocultou SEEDF.');
});

await scenario('pós-prova: cargos e cronograma SEDES/DF', { width: 390, height: 844 }, async (page) => {
  await page.click('#mainTabs [data-view="post-exam"]');
  await page.waitForSelector('.post-exam-view');
  const text = await page.locator('.post-exam-view').innerText();
  for (const value of ['TDAS 202', 'EDAS 400', 'CRONOGRAMA SEDES/DF', '10/09/2026', '16/09/2026']) {
    if (!text.includes(value)) throw new Error(`Pós-prova sem ${value}.`);
  }
  if (await page.locator('.postexam-milestone').count() < 7) throw new Error('Cronograma incompleto.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal no pós-prova: ${overflow}px`);
});

await browser.close();
if (failures.length) process.exit(1);
console.log('PASS  v33: UI do radar pré-edital e do cronograma pós-prova aprovada.');
