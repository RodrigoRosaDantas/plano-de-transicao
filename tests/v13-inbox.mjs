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
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.command-view .transition-now-hero', { state: 'attached' });
    await run(page);
    if (errors.length) throw new Error('Erros JavaScript: ' + errors.join(' | '));
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error('FAIL  ' + name + '\n' + (error?.stack || error));
  } finally {
    await context.close();
  }
}

await scenario('desktop: controles de Atenção permanecem acessíveis sem poluir a Home', { width: 1440, height: 1000 }, async (page) => {
  if (await page.locator('#v13ManagerInbox').count()) throw new Error('A caixa legada de Atenção vazou para a Home redesenhada.');
  if (!(await page.locator('.command-view .transition-decision-grid').isVisible())) throw new Error('Controles atuais da transição não estão visíveis na Home.');

  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open #v13InboxOps');
  if (await page.locator('#moreSheet.open #v13OpenInbox').count() !== 1) throw new Error('A operação de Atenção não está disponível no menu Mais.');
  if (await page.locator('#moreSheet.open #v13RestoreInbox').count() !== 1) throw new Error('A restauração dos estados locais não está disponível.');
  const openLabel = (await page.locator('#moreSheet.open #v13OpenInbox').innerText()).toLocaleLowerCase('pt-BR');
  if (!openLabel.includes('controles do plano')) throw new Error('O atalho de Atenção ainda aponta para a caixa removida: ' + openLabel);

  await page.click('#moreSheet.open #v13OpenInbox');
  await page.waitForSelector('.command-view #transitionControls');
  if (await page.locator('#moreSheet.open').count()) throw new Error('O menu Mais permaneceu aberto após abrir os controles.');
  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open #v13RestoreInbox');
  await page.click('#moreSheet.open #v13RestoreInbox');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('A operação de Atenção criou overflow horizontal: ' + overflow + 'px');
  await page.screenshot({ path: 'artifacts/desktop-inbox-v13.png', fullPage: true });
});

await scenario('mobile: controles de Atenção preservam hierarquia sem overflow', { width: 390, height: 844 }, async (page) => {
  if (await page.locator('#v13ManagerInbox').count()) throw new Error('A caixa legada de Atenção apareceu no celular.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal da v13 no mobile: ' + overflow + 'px');

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open #v13InboxOps');
  const title = await page.locator('#moreSheet.open #v13InboxOps .sheet-section-label').innerText();
  if (!title.toLocaleLowerCase('pt-BR').includes('caixa de entrada gerencial')) throw new Error('Título das operações v13 incorreto: ' + title);
  if (!(await page.locator('#moreSheet.open #v13RestoreInbox').isVisible())) throw new Error('Restauração local não está visível no celular.');
  await page.click('#moreSheet.open #v13OpenInbox');
  await page.waitForSelector('.command-view #transitionControls');
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (mobileOverflow > 2) throw new Error('Abrir controles criou overflow no mobile: ' + mobileOverflow + 'px');
  await page.screenshot({ path: 'artifacts/mobile-inbox-v13.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários da Atenção legada e dos controles atuais aprovados.');