import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#transitionNextAction');
  const action = page.locator('#transitionNextAction');
  if (await action.count() !== 1 || !(await action.isVisible())) throw new Error('A ação prioritária não apareceu na Home.');
  const text = await action.innerText();
  for (const value of [
    'O QUE FAZER AGORA',
    'Revisar divergências e protocolar somente recursos fundamentados.',
    '16/09/2026',
    'Brasília',
    'TDAS 202 e EDAS 400 permanecem separados.',
  ]) {
    if (!text.includes(value)) throw new Error(`Ação atual sem "${value}".`);
  }
  if (await action.locator('[data-view="post-exam"]').count() !== 1) throw new Error('CTA do acompanhamento pós-prova não apareceu.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal na ação atual: ${overflow}px`);
  if (errors.length) throw new Error('Erros JavaScript: ' + errors.join(' | '));
  console.log('PASS  v39: ação atual visível, acionável e sem overflow no mobile.');
} finally {
  await context.close();
  await browser.close();
}
