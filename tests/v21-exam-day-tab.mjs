import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const fold = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

async function scenario(name, viewport, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content[aria-busy="false"]', { timeout: 15000 });
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

async function openPostExam(page) {
  await page.locator('[data-view="post-exam"]').first().click();
  await page.waitForURL(/#post-exam$/);
  await page.waitForSelector('[data-post-exam-page]');
  await page.waitForSelector('[data-v28-post-followup]');
  await page.waitForSelector('[data-v28-transition-console]');
  await page.waitForSelector('[data-v28-competition-panel]');
}

await scenario('desktop: pré e pós-prova são páginas próprias', { width: 1440, height: 1000 }, async page => {
  if (!(await page.locator('#mainTabs [data-view="pre-exam"]').isVisible())) throw new Error('Pré-prova não aparece na navegação principal.');
  if (!(await page.locator('#mainTabs [data-view="post-exam"]').isVisible())) throw new Error('Pós-prova não aparece na navegação principal.');
  if (await page.locator('[data-exam-day-tab]').count()) throw new Error('A navegação legada do Dia da Prova voltou a aparecer.');

  await page.locator('#mainTabs [data-view="pre-exam"]').click();
  await page.waitForURL(/#pre-exam$/);
  await page.waitForSelector('.pre-exam-view');
  const preText = fold(await page.locator('.pre-exam-view').innerText());
  for (const value of ['pré-prova pronta para ativar', 'checklist de ativação', 'estrutura permanece', 'novo edital']) {
    if (!preText.includes(value)) throw new Error(`Pré-prova sem: ${value}`);
  }

  await openPostExam(page);
  const text = fold(await page.locator('[data-post-exam-page]').innerText());
  for (const value of ['acompanhamento pós-prova', 'tipo b', 'tipo a', 'tdas', 'edas', 'preliminar', 'recursos e divergências', 'leitura competitiva']) {
    if (!text.includes(value)) throw new Error(`Pós-prova sem: ${value}`);
  }
  if (await page.locator('.command-view').count()) throw new Error('A Home foi mantida junto com a página pós-prova.');
  if (await page.locator('[data-post-exam-page] [data-v28-competition-panel]').count() !== 1) throw new Error('Leitura competitiva não ficou única na página pós-prova.');

  await page.locator('#mainTabs [data-view="command"]').click();
  await page.waitForURL(/#command$/);
  await page.waitForSelector('.command-view');
  if (await page.locator('.command-view [data-v28-transition-console], .command-view [data-v28-post-followup], .command-view [data-v28-competition-panel], .command-view #v15TransitionSummary').count()) {
    throw new Error('Conteúdo pós-prova foi injetado de volta no Agora.');
  }
  const homeText = fold(await page.locator('.command-view').innerText());
  if (!homeText.includes('plano de transição') || !homeText.includes('dados do plano')) throw new Error('Agora perdeu o foco gerencial.');

  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.click('#moreSheet [data-view="post-exam"]');
  await page.waitForURL(/#post-exam$/);
  await page.waitForSelector('[data-v28-post-followup]');
  if (await page.locator('#moreSheet').evaluate(node => node.classList.contains('open'))) throw new Error('Menu Mais permaneceu aberto.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal desktop: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/desktop-fases-separadas-v29.png', fullPage: true });
});

await scenario('acesso direto: #exam-day é compatibilidade para Pós-prova', { width: 1180, height: 900 }, async page => {
  await page.goto(`${baseURL}#exam-day`, { waitUntil: 'networkidle' });
  await page.waitForURL(/#post-exam$/, { timeout: 10000 });
  await page.waitForSelector('[data-post-exam-page]');
  if (await page.locator('[data-exam-day-tab]').count()) throw new Error('Deep link reintroduziu a aba legada.');
  if (!(await page.title()).includes('Pós-prova')) throw new Error('Título da página dedicada não foi atualizado.');
});

await scenario('mobile 390px: fases separadas sem overflow', { width: 390, height: 844 }, async page => {
  if (await page.locator('#mobileDock [data-exam-day-tab]').count()) throw new Error('Dock legado ainda anuncia Dia da Prova.');
  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.click('#moreSheet [data-view="pre-exam"]');
  await page.waitForURL(/#pre-exam$/);
  await page.waitForSelector('.pre-exam-view');

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.click('#moreSheet [data-view="post-exam"]');
  await page.waitForURL(/#post-exam$/);
  await page.waitForSelector('[data-v28-post-followup]');
  const followupColumns = await page.locator('.v28-followup-chart-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (followupColumns.trim().split(/\s+/).length !== 1) throw new Error(`Gráficos não empilharam: ${followupColumns}`);
  const competitionColumns = await page.locator('.v28-competition-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (competitionColumns.trim().split(/\s+/).length !== 1) throw new Error(`Cards competitivos não empilharam: ${competitionColumns}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-fases-separadas-v29.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários das fases separadas aprovados.');
