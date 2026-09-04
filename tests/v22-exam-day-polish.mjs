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
    await page.waitForSelector('.exam21-shell');
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

await scenario('desktop: acabamento v22 e checklist concluído', { width:1440, height:1000 }, async page => {
  const heroRadius = await page.locator('.exam21-hero').evaluate(node => getComputedStyle(node).borderRadius);
  if (heroRadius !== '30px') throw new Error(`CSS v22 não aplicado ao hero: ${heroRadius}`);

  const firstSubnav = page.locator('.exam21-subnav [data-exam21-scroll]').first();
  await page.waitForFunction(() => document.querySelector('.exam21-subnav button.active'));
  if (!(await firstSubnav.getAttribute('aria-current'))) throw new Error('Navegação interna não recebeu estado visual.');

  await page.click('[data-exam21-all]');
  await page.waitForSelector('#exam21Progress.is-complete');
  const progress = await page.locator('#exam21Progress').innerText();
  if (progress !== '8/8') throw new Error(`Checklist visual não concluiu: ${progress}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal desktop: ${overflow}px`);
});

await scenario('mobile 390px: polimento sem regressão de layout', { width:390, height:844 }, async page => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);

  const heroRadius = await page.locator('.exam21-hero').evaluate(node => getComputedStyle(node).borderRadius);
  if (heroRadius !== '22px') throw new Error(`Raio mobile v22 incorreto: ${heroRadius}`);

  const subnavBox = await page.locator('.exam21-subnav').boundingBox();
  if (!subnavBox || subnavBox.width > 390) throw new Error(`Subnav extrapolou viewport: ${subnavBox?.width}`);

  await page.locator('[data-exam21-scroll="exam21Checklist"]').click();
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => window.scrollY);
  if (y < 100) throw new Error('Navegação interna não rolou até a seção no mobile.');
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures,null,2));
  process.exit(1);
}
console.log('\n2/2 cenários de polimento v22 aprovados.');
