import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const baseOrigin = new URL(baseURL).origin;
await fs.mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

async function run(name, viewport, fn) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  const pageErrors = [];
  const badResponses = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(baseOrigin)) badResponses.push(`${response.status()} ${url}`);
  });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content [class*="-view"]');
    await fn(page, context);
    if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(' | ')}`);
    if (badResponses.length) throw new Error(`Recursos HTTP com falha: ${badResponses.join(' | ')}`);
    results.push({ name, pass: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    results.push({ name, pass: false });
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await run('desktop: central, atualização visível e busca global', { width: 1440, height: 1000 }, async page => {
  await page.waitForSelector('.command-view');
  if (!(await page.locator('#refreshBtn').isVisible())) throw new Error('Botão Atualizar dados não está visível.');
  const refreshLabel = await page.locator('#refreshLabel').innerText();
  if (!refreshLabel.includes('Atualizar dados')) throw new Error(`Rótulo de atualização incorreto: ${refreshLabel}`);
  if (await page.locator('[data-view="study"], #studyWorkspaceFrame').count()) throw new Error('Área de Questões ainda aparece no Plano.');
  await page.click('#refreshBtn');
  await page.waitForSelector('#toast.show');
  const toast = await page.locator('#toast').innerText();
  if (!toast.includes('atualizados')) throw new Error(`Feedback de atualização ausente: ${toast}`);
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#commandPalette:not(.hidden)');
  await page.fill('#searchInput', 'Português');
  if (await page.locator('#searchResults button').count() < 1) throw new Error('Busca global não retornou matéria.');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'artifacts/desktop-command.png', fullPage: true });
});

await run('desktop: desempenho mantém navegação e cinco leituras', { width: 1440, height: 1000 }, async page => {
  const navCount = await page.locator('#mainTabs [data-view]').count();
  await page.click('#mainTabs [data-view="performance"]');
  await page.waitForSelector('.performance-view');
  if (await page.locator('#mainTabs [data-view]').count() !== navCount) throw new Error('Desempenho reduziu as opções principais.');
  if (await page.locator('.performance-section-nav [data-performance-section]').count() !== 5) throw new Error('Leituras de desempenho incompletas.');
  await page.click('[data-performance-scope="tdas"]');
  await page.waitForSelector('.subject-table tbody tr');
  await page.click('[data-performance-grain="combination"]');
  if (await page.locator('.subject-table tbody tr').count() < 1) throw new Error('Filtro de combinações não retornou linhas.');
  await page.click('[data-performance-grain="subject"]');
  await page.fill('#subjectSearch', 'Português');
  await page.waitForTimeout(300);
  const first = await page.locator('.subject-table tbody tr').first().innerText();
  if (!first.includes('Português')) throw new Error(`Busca temática não filtrou Português: ${first}`);
  await page.click('[data-performance-section="performanceDiagnosis"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/desktop-performance.png', fullPage: true });
});

await run('desktop: financeiro, concursos, fontes e operações', { width: 1440, height: 1000 }, async page => {
  await page.click('[data-view="finance"]');
  await page.waitForSelector('.finance-view');
  await page.selectOption('#financeCycle', { label: 'SEDES/DF 2026' });
  if (await page.locator('.ledger-row').count() < 1) throw new Error('Filtro financeiro não retornou lançamentos.');
  await page.click('[data-view="exams"]');
  await page.waitForSelector('.exam-matrix');
  if (await page.locator('.exam-matrix tbody tr').count() < 3) throw new Error('Matriz de concursos incompleta.');
  await page.click('[data-view="sources"]');
  await page.waitForSelector('.audit-check');
  const score = await page.locator('.audit-score strong').innerText();
  if (!score.includes('10/10')) throw new Error(`Auditoria visual não fechou: ${score}`);
  await page.click('[data-view="operations"]');
  await page.waitForSelector('.operations-view');
  if (await page.locator('.system-card').count() !== 4) throw new Error('Central de operações incompleta.');
  await page.screenshot({ path: 'artifacts/desktop-operations.png', fullPage: true });
});

await run('mobile: navegação completa, Mais rico e sem overflow', { width: 390, height: 844 }, async page => {
  if (!(await page.locator('.mobile-dock').isVisible())) throw new Error('Dock móvel não está visível.');
  if (!(await page.locator('.main-tabs').isVisible())) throw new Error('Navegação completa desapareceu no celular.');
  const navCount = await page.locator('#mainTabs [data-view]').count();
  if (navCount < 8) throw new Error(`Só ${navCount} áreas disponíveis no celular.`);
  await page.click('.mobile-dock [data-view="performance"]');
  await page.waitForSelector('.performance-view');
  if (!(await page.locator('.main-tabs').isVisible())) throw new Error('Navegação desapareceu ao abrir Desempenho.');
  if (await page.locator('#mainTabs [data-view]').count() !== navCount) throw new Error('Desempenho reduziu opções no celular.');
  if (await page.locator('.performance-section-nav button').count() !== 5) throw new Error('Atalhos internos de desempenho incompletos.');
  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  if (!(await page.locator('.sheet-sync-card').isVisible())) throw new Error('Estado de atualização não aparece no Mais.');
  if (await page.locator('#moreSheet .sheet-grid button').count() < 8) throw new Error('Menu Mais não reúne todas as áreas.');
  if (await page.locator('#moreSheet [data-view="study"]').count()) throw new Error('Questões ainda aparece no menu Mais.');
  await page.click('#moreSheet [data-view="operations"]');
  await page.waitForSelector('.operations-view');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-operations.png', fullPage: true });
});

await run('tablet: navegação responsiva e jornada', { width: 820, height: 1180 }, async page => {
  await page.click('[data-view="journey"]');
  await page.waitForSelector('.journey-view');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal tablet: ${overflow}px`);
  if (await page.locator('.timeline-item').count() < 5) throw new Error('Linha do tempo incompleta.');
  await page.screenshot({ path: 'artifacts/tablet-journey.png', fullPage: true });
});

await browser.close();
console.log(`\n${results.filter(item => item.pass).length}/${results.length} cenários de UI aprovados.`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
