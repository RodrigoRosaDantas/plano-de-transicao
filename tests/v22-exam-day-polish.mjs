import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless:true });
const failures = [];

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers:'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(`${baseURL}#exam-day`, { waitUntil:'networkidle' });
    await page.waitForSelector('[data-post-exam-v27]', { timeout:10000 });
    await run(page);
    if (errors.length) throw new Error(`Erros JavaScript: ${errors.join(' | ')}`);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error:String(error?.stack || error) });
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await scenario('desktop: acabamento herdado e hierarquia pós-prova', { width:1440, height:1000 }, async page => {
  const heroRadius = await page.locator('.exam21-hero').evaluate(node => getComputedStyle(node).borderRadius);
  if (heroRadius !== '30px') throw new Error(`Raio desktop incorreto no hero pós-prova: ${heroRadius}`);

  const steps = page.locator('.v27-step');
  if (await steps.count() !== 5) throw new Error('Fluxo pós-prova não tem as cinco etapas gerenciais.');
  if (!(await page.locator('.v27-notes').isVisible())) throw new Error('Registro de memória não está disponível.');
  if (!(await page.locator('.v27-archive').isVisible())) throw new Error('Histórico logístico não está disponível.');
  if (await page.locator('.v27-archive').getAttribute('open') !== null) throw new Error('Histórico logístico abriu por padrão.');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal desktop: ${overflow}px`);
});

await scenario('mobile 390px: polimento compacto sem regressão de layout', { width:390, height:844 }, async page => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);

  const heroRadius = await page.locator('.exam21-hero').evaluate(node => getComputedStyle(node).borderRadius);
  if (heroRadius !== '22px') throw new Error(`Raio mobile pós-prova incorreto: ${heroRadius}`);

  const columns = await page.locator('.v27-steps').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (columns.trim().split(/\s+/).length > 2) throw new Error(`Etapas ficaram largas demais no mobile: ${columns}`);

  await page.locator('.v27-notes > summary').click();
  await page.waitForFunction(() => document.querySelector('.v27-notes')?.open === true);
  const noteWidth = await page.locator('[data-v27-note="edas"]').evaluate(node => node.getBoundingClientRect().width);
  if (noteWidth > 390) throw new Error(`Textarea extrapolou viewport: ${noteWidth}px`);
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures,null,2));
  process.exit(1);
}
console.log('\n2/2 cenários de polimento pós-prova aprovados.');
