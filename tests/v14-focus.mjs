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
    await page.waitForSelector('#v13ManagerInbox');
    await page.waitForSelector('#v14FocusControl');
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

await scenario('desktop: completo por padrão, foco sob demanda e navegação profunda segura', { width: 1440, height: 1000 }, async (page) => {
  const initialMode = await page.locator('.command-view').getAttribute('data-v14-mode');
  if (initialMode !== 'expanded') throw new Error(`Desktop deveria iniciar completo, veio ${initialMode}.`);
  if (!(await page.locator('#v11DecisionCenter').isVisible())) throw new Error('Centro de decisões deveria estar visível no desktop completo.');
  if (!(await page.locator('#v12DecisionHistory').isVisible())) throw new Error('Histórico deveria estar visível no desktop completo.');

  await page.click('#v14ToggleMode');
  await page.waitForFunction(() => document.querySelector('.command-view')?.dataset.v14Mode === 'focus');
  if (await page.locator('#v11DecisionCenter').isVisible()) throw new Error('Centro de decisões não foi recolhido no modo foco.');
  if (await page.locator('#v12DecisionHistory').isVisible()) throw new Error('Histórico não foi recolhido no modo foco.');
  if (!(await page.locator('#v13ManagerInbox').isVisible())) throw new Error('Caixa de atenção foi escondida pelo modo foco.');
  if (!(await page.locator('#managerNowBoard').isVisible())) throw new Error('Resumo Agora foi escondido pelo modo foco.');

  const decisionRail = page.locator('#v11CommandRail [data-v11-scroll="#v11DecisionCenter"]');
  await decisionRail.click();
  await page.waitForFunction(() => document.querySelector('.command-view')?.dataset.v14Mode === 'expanded');
  if (!(await page.locator('#v11DecisionCenter').isVisible())) throw new Error('Navegação profunda não reabriu o contexto antes do scroll.');

  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.waitForSelector('#v14FocusOps');
  const ops = await page.locator('#v14FocusOps').innerText();
  if (!ops.toLocaleLowerCase('pt-BR').includes('modo da home')) throw new Error(`Mais não integrou o modo da Home: ${ops}`);
  await page.screenshot({ path: 'artifacts/desktop-focus-v14.png', fullPage: true });
});

await scenario('mobile: foco por padrão reduz Home e pode expandir sem overflow', { width: 390, height: 844 }, async (page) => {
  const initialMode = await page.locator('.command-view').getAttribute('data-v14-mode');
  if (initialMode !== 'focus') throw new Error(`Mobile deveria iniciar em foco, veio ${initialMode}.`);
  if (await page.locator('#v11DecisionCenter').isVisible()) throw new Error('Centro de decisões deveria iniciar recolhido no mobile.');
  if (await page.locator('#managerExamToday').isVisible()) throw new Error('Leitura de prova deveria iniciar recolhida no mobile.');
  if (await page.locator('.manager-command-card').isVisible()) throw new Error('Card institucional redundante deveria iniciar recolhido no mobile.');
  if (await page.locator('.manager-quick-grid').isVisible()) throw new Error('Atalhos redundantes deveriam iniciar recolhidos no mobile.');
  if (!(await page.locator('#v13ManagerInbox').isVisible())) throw new Error('Caixa gerencial precisa continuar visível no mobile em foco.');
  if (!(await page.locator('#managerNowBoard').isVisible())) throw new Error('Resumo Agora precisa continuar visível no mobile em foco.');

  const focusedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const overflowFocus = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowFocus > 2) throw new Error(`Modo foco criou overflow horizontal: ${overflowFocus}px`);

  await page.click('#v14ToggleMode');
  await page.waitForFunction(() => document.querySelector('.command-view')?.dataset.v14Mode === 'expanded');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#v11DecisionCenter')).display !== 'none');
  const expandedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  if (expandedHeight <= focusedHeight + 500) throw new Error(`Modo foco não reduziu materialmente a Home: foco=${focusedHeight}, completo=${expandedHeight}.`);
  const overflowExpanded = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowExpanded > 2) throw new Error(`Modo completo criou overflow horizontal: ${overflowExpanded}px`);

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.waitForSelector('#v14ToggleModeOps');
  await page.click('#v14ToggleModeOps');
  await page.waitForFunction(() => document.querySelector('.command-view')?.dataset.v14Mode === 'focus');
  const stored = await page.evaluate(() => localStorage.getItem('plano.homeMode.v14'));
  if (stored !== 'focus') throw new Error(`Preferência do modo foco não foi persistida: ${stored}`);
  await page.screenshot({ path: 'artifacts/mobile-focus-v14.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários específicos da v14 aprovados.');
