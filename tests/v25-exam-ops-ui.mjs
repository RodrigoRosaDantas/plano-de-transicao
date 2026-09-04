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

await scenario('desktop: Home mantém foco e ganha pulso operacional compacto', { width: 1440, height: 1000 }, async page => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.command-view .countdown-card');
  await page.waitForSelector('.v25-home-ops');

  if (await page.locator('.v25-home-ops').count() !== 1) throw new Error('Pulso operacional da Home foi duplicado.');
  if (!(await page.locator('.v25-home-ops [data-v25-home-phase]').isVisible())) throw new Error('Fase automática não está visível na Home.');
  if (!(await page.locator('.v25-home-ops [data-v25-home-next]').isVisible())) throw new Error('Próximo marco não está visível na Home.');
  if (!(await page.locator('.mission-strip').isVisible())) throw new Error('A missão central da Home foi removida pela v25.');

  await page.click('[data-v25-open-exam]');
  await page.waitForURL(/#exam-day$/);
  await page.waitForSelector('.v25-ops-center');
  await page.screenshot({ path: 'artifacts/desktop-exam-ops-v25.png', fullPage: true });
});

await scenario('Dia da Prova: fase, contagem, diretriz, progresso e marco oficial', { width: 1280, height: 960 }, async page => {
  await page.goto(`${baseURL}#exam-day`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.exam21-shell');
  await page.waitForSelector('.v25-ops-center');

  if (await page.locator('.v25-ops-center').count() !== 1) throw new Error('Central operacional v25 foi duplicada.');
  if (await page.locator('.v25-ops-units > div').count() !== 4) throw new Error('Contagem v25 não possui quatro unidades.');

  for (const selector of ['[data-v25-phase]','[data-v25-directive]','[data-v25-next-label]','[data-v25-milestone]','[data-v25-brasilia]']) {
    const text = (await page.locator(selector).innerText()).trim();
    if (!text || text === '—' || text.includes('--:--')) throw new Error(`Campo dinâmico não foi preenchido: ${selector}`);
  }

  const progress = Number(await page.locator('.v25-ops-track').getAttribute('aria-valuenow'));
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error(`Progresso inválido: ${progress}`);
  const note = await page.locator('.v25-ops-progress > small').innerText();
  if (!note.includes('portões') || !note.includes('não a duração das provas')) throw new Error('Progresso não deixa clara a diferença entre portões e prova.');

  const shellText = await page.locator('.v25-ops-center').innerText();
  if (shellText.includes('08:00') || shellText.includes('15:00') || shellText.includes('12:00') || shellText.includes('19:00')) throw new Error('Horário nominal inferido apareceu na v25.');
});

await scenario('mobile 390px: recursos operacionais sem overflow e sem nova navegação', { width: 390, height: 844 }, async page => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.v25-home-ops');
  if (await page.locator('#mobileDock button').count() > 5) throw new Error('V25 superlotou a navegação mobile.');

  await page.click('[data-v25-open-exam]');
  await page.waitForSelector('.v25-ops-center');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);

  const unitColumns = await page.locator('.v25-ops-units').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (unitColumns.trim().split(/\s+/).length !== 4) throw new Error(`Contagem deixou de usar quatro unidades compactas: ${unitColumns}`);
  await page.screenshot({ path: 'artifacts/mobile-exam-ops-v25.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários dos recursos operacionais v25 aprovados.');
