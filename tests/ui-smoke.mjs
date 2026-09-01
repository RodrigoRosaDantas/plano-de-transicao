import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const baseOrigin = new URL(baseURL).origin;
await fs.mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

const companionFixture = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Plataforma de Questões</title></head><body>
  <a class="skip" href="#app">Pular para conteúdo</a>
  <header class="topbar">Navegação própria da plataforma</header>
  <main id="app" class="page"><section class="card"><h1>Fixture da plataforma integrada</h1><p>Conteúdo de estudo preservado.</p></section></main>
  <nav class="mobile-nav">Navegação móvel própria</nav>
  <footer class="footer">Rodapé próprio</footer>
</body></html>`;

async function run(name, viewport, fn) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('sedes.questoes.activeProfile.v3', 'rodrigo');
    localStorage.setItem('sedes.questoes.profiles.v3', JSON.stringify([{ id: 'rodrigo', name: 'Rodrigo', roles: ['202', '400'] }]));
    localStorage.setItem('sedes.questoes.rodrigo.history.v3', JSON.stringify([{ answered: 20, correct: 18, elapsed: 1200, questionResults: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, answer: 'A', correct: i < 18, discipline: i < 10 ? 'Português' : 'Administração' })) }]));
    localStorage.setItem('sedes.questoes.rodrigo.errors.v3', JSON.stringify({ q18: { id: 'q18', open: true, count: 2, discipline: 'Administração' }, q19: { id: 'q19', open: true, count: 1, discipline: 'Administração' } }));
    localStorage.setItem('sedes.questoes.rodrigo.marked.v3', JSON.stringify({ q3: { id: 'q3', discipline: 'Português' } }));
    localStorage.setItem('sedes.questoes.rodrigo.session.v3', JSON.stringify({ current: 4, questions: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}` })), answers: { q0: 'A', q1: 'B' }, materialId: 'teste' }));
  });
  await context.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  await context.route('**/sedes-df-questoes/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: companionFixture }));
  const page = await context.newPage();
  const pageErrors = [];
  const badResponses = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(baseOrigin) && !url.includes('/sedes-df-questoes/')) badResponses.push(`${response.status()} ${url}`);
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

await run('desktop: central, busca, progresso local e workspace integrado', { width: 1440, height: 1000 }, async page => {
  await page.waitForSelector('.command-view');
  const localStatus = await page.locator('#localStudyStatus').innerText();
  if (!localStatus.includes('tentativa salva')) throw new Error(`Persistência não detectada: ${localStatus}`);
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#commandPalette:not(.hidden)');
  await page.fill('#searchInput', 'Português');
  if (await page.locator('#searchResults button').count() < 1) throw new Error('Busca global não retornou matéria.');
  await page.keyboard.press('Escape');
  await page.click('[data-view="study"]');
  await page.waitForSelector('#studyWorkspaceFrame');
  const frame = page.frameLocator('#studyWorkspaceFrame');
  await frame.locator('#app').waitFor();
  await page.waitForTimeout(150);
  const embedded = await page.locator('#studyWorkspaceFrame').evaluate(frameEl => {
    const doc = frameEl.contentDocument;
    const style = selector => doc?.querySelector(selector) ? getComputedStyle(doc.querySelector(selector)).display : 'missing';
    return { topbar: style('.topbar'), mobileNav: style('.mobile-nav'), footer: style('.footer'), skip: style('.skip'), embedded: doc?.body?.dataset?.planoEmbedded };
  });
  for (const key of ['topbar', 'mobileNav', 'footer', 'skip']) if (embedded[key] !== 'none') throw new Error(`Navegação duplicada não foi ocultada: ${key}=${embedded[key]}`);
  if (embedded.embedded !== 'true') throw new Error('Modo integrado não foi aplicado ao módulo.');
  await page.click('[data-study-route="revisar"]');
  if ((await page.locator('#studyWorkspace').getAttribute('data-study-route')) !== 'revisar') throw new Error('Workspace não mudou para revisão.');
  await page.screenshot({ path: 'artifacts/desktop-command-study.png', fullPage: true });
});

await run('desktop: desempenho por matéria e filtros de grão', { width: 1440, height: 1000 }, async page => {
  await page.click('[data-view="performance"]');
  await page.waitForSelector('.performance-view');
  await page.click('[data-performance-scope="tdas"]');
  await page.waitForSelector('.subject-table tbody tr');
  await page.click('[data-performance-grain="combination"]');
  const rows = await page.locator('.subject-table tbody tr').count();
  if (rows < 1) throw new Error('Filtro de combinações não retornou linhas.');
  await page.click('[data-performance-grain="subject"]');
  await page.fill('#subjectSearch', 'Português');
  await page.waitForTimeout(300);
  const first = await page.locator('.subject-table tbody tr').first().innerText();
  if (!first.includes('Português')) throw new Error(`Busca temática não filtrou Português: ${first}`);
  await page.screenshot({ path: 'artifacts/desktop-performance.png', fullPage: true });
});

await run('desktop: financeiro, provas e auditoria', { width: 1440, height: 1000 }, async page => {
  await page.click('[data-view="finance"]');
  await page.waitForSelector('.finance-view');
  await page.selectOption('#financeCycle', { label: 'SEDES/DF 2026' });
  const ledgerRows = await page.locator('.ledger-row').count();
  if (ledgerRows < 1) throw new Error('Filtro financeiro não retornou lançamentos.');
  await page.click('[data-view="exams"]');
  await page.waitForSelector('.exam-matrix');
  if (await page.locator('.exam-matrix tbody tr').count() < 3) throw new Error('Matriz de concursos incompleta.');
  await page.click('[data-view="sources"]');
  await page.waitForSelector('.audit-check');
  const score = await page.locator('.audit-score strong').innerText();
  if (!score.includes('10/10')) throw new Error(`Auditoria visual não fechou: ${score}`);
  await page.screenshot({ path: 'artifacts/desktop-audit.png', fullPage: true });
});

await run('mobile: dock, Mais, estudo e ausência de overflow', { width: 390, height: 844 }, async page => {
  if (!(await page.locator('.mobile-dock').isVisible())) throw new Error('Dock móvel não está visível.');
  await page.click('.mobile-dock [data-view="study"]');
  await page.waitForSelector('#studyWorkspace');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.click('#moreSheet [data-view="finance"]');
  await page.waitForSelector('.finance-view');
  await page.screenshot({ path: 'artifacts/mobile-finance.png', fullPage: true });
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
