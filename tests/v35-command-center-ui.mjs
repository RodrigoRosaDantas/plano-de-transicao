import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, fn) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content [class*="-view"]');
    await fn(page);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.stack || error}`);
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await scenario('pré-edital: dossiê e acompanhamento local', { width: 1440, height: 1000 }, async (page) => {
  await page.click('[data-view="pre-exam"]');
  await page.waitForSelector('.pre-exam-view');
  if (await page.locator('.preexam-project-dossier').count() !== 2) throw new Error('Dossiês dos dois concursos não apareceram.');
  if (await page.locator('.preexam-project-pending b').count() < 8) throw new Error('Gatilhos de confirmação incompletos.');
  const alertButton = page.locator('.preexam-alert [data-alert-toggle]').first();
  await alertButton.click();
  if (await alertButton.getAttribute('aria-pressed') !== 'true') throw new Error('Alerta não foi marcado como acompanhado.');
  await alertButton.click();
  if (await alertButton.getAttribute('aria-pressed') !== 'false') throw new Error('Alerta não foi desmarcado.');
});

await scenario('pós-prova: cronograma acionável e calendário', { width: 390, height: 844 }, async (page) => {
  await page.click('[data-view="post-exam"]');
  await page.waitForSelector('.post-exam-view');
  if (await page.locator('.postexam-milestone__actions').count() !== 7) throw new Error('Ações não foram adicionadas aos sete marcos.');
  if (await page.locator('[data-calendar-event]').count() !== 7) throw new Error('Exportação de calendário incompleta.');
  const milestoneButton = page.locator('.postexam-milestone [data-alert-toggle]').first();
  await milestoneButton.click();
  if (await milestoneButton.getAttribute('aria-pressed') !== 'true') throw new Error('Marco não foi marcado como acompanhado.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal no pós-prova: ${overflow}px`);
});

await scenario('Mais: navegação principal e áreas de apoio', { width: 390, height: 844 }, async (page) => {
  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  if (await page.locator('.sheet-nav-group .sheet-grid--primary [data-view]').count() !== 5) throw new Error('Navegação principal não foi organizada.');
  const details = page.locator('.sheet-more-group');
  if (await details.count() !== 1) throw new Error('Áreas de apoio não foram agrupadas.');
  await page.locator('.sheet-more-group summary').click();
  if (!(await page.locator('.sheet-more-group').getAttribute('open')) && !(await page.locator('.sheet-more-group').evaluate((node) => node.open))) throw new Error('Grupo de áreas de apoio não abriu.');
  const text = await page.locator('#moreSheet').innerText();
  if (!text.includes('Operações')) throw new Error('Operações ficou inacessível no menu Mais.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal no menu Mais: ${overflow}px`);
});

await scenario('fontes: aviso de publicação pública', { width: 820, height: 1180 }, async (page) => {
  await page.click('[data-view="sources"]');
  await page.waitForSelector('.sources-view');
  const notice = await page.locator('.privacy-panel').innerText();
  if (!notice.includes('PUBLICAÇÃO PÚBLICA') || !notice.includes('Sem credenciais')) throw new Error('Aviso de privacidade/publicação incompleto.');
});

await browser.close();
if (failures.length) process.exit(1);
console.log('PASS  v35: UI do comando, alertas, calendário, menu e privacidade aprovada.');
