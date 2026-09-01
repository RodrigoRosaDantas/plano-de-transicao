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
    await page.waitForSelector('#v13ManagerInbox .v13-inbox-item');
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

await scenario('desktop: caixa gerencial prioriza, adia, restaura e integra revisão', { width: 1440, height: 1000 }, async (page) => {
  if (await page.locator('#v13ManagerInbox .v13-inbox-kpis span').count() !== 4) throw new Error('KPIs da caixa gerencial estão incompletos.');
  if (await page.locator('#v13ManagerInbox [data-v13-filter]').count() !== 4) throw new Error('Filtros Todos/Agora/Hoje/Monitorar estão incompletos.');
  if (await page.locator('#v11CommandRail button').count() !== 6) throw new Error('Rail da Home não incorporou Atenção à arquitetura v12.');
  if (await page.locator('#v13ManagerInbox [data-v13-item-id^="decision:"]').count() < 1) throw new Error('Decisões abertas não chegaram à caixa gerencial.');

  const first = page.locator('#v13ManagerInbox [data-v13-item-id^="decision:"]').first();
  const itemId = await first.getAttribute('data-v13-item-id');
  const sourceId = itemId.replace(/^decision:/, '');
  if (!itemId || !sourceId) throw new Error('Item de decisão sem identificador rastreável.');

  const badgeText = await page.locator('#moreTopBtn .v13-attention-badge').innerText();
  if (!badgeText || Number.parseInt(badgeText, 10) < 1) throw new Error(`Badge de atenção não refletiu a fila: ${badgeText}`);

  await first.locator('[data-v13-snooze]').click();
  await page.waitForFunction((id) => {
    const state = JSON.parse(localStorage.getItem('plano.managerInbox.v13') || '{}');
    return Boolean(state.snoozed?.[id]);
  }, itemId);
  await page.waitForFunction((id) => !document.querySelector(`[data-v13-item-id="${CSS.escape(id)}"]`), itemId);

  await page.click('#moreTopBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.waitForSelector('#v13InboxOps');
  await page.waitForSelector('#v13OpenInbox');
  await page.waitForSelector('#v13RestoreInbox');
  await page.click('#v13RestoreInbox');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('plano.managerInbox.v13') || '{}');
    return Object.keys(state.snoozed || {}).length === 0 && Object.keys(state.silenced || {}).length === 0;
  });
  await page.click('#closeMoreBtn');
  await page.waitForFunction(() => !document.querySelector('#moreSheet')?.classList.contains('open'));
  await page.waitForSelector(`[data-v13-item-id="${itemId}"]`);

  await page.evaluate(({ sourceId }) => {
    const decisions = JSON.parse(localStorage.getItem('plano.decisions.v11') || '{}');
    decisions[sourceId] = { status: 'adopted', updatedAt: new Date().toISOString() };
    localStorage.setItem('plano.decisions.v11', JSON.stringify(decisions));
    const journal = JSON.parse(localStorage.getItem('plano.decisionJournal.v12') || '{}');
    journal.version = 12;
    journal.events = Array.isArray(journal.events) ? journal.events : [];
    journal.notes = journal.notes || {};
    journal.lastSeen = journal.lastSeen || {};
    journal.reviews = journal.reviews || {};
    journal.reviews[sourceId] = { dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() };
    localStorage.setItem('plano.decisionJournal.v12', JSON.stringify(journal));
  }, { sourceId });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(`#v13ManagerInbox [data-v13-item-id="review:${sourceId}"]`);
  const review = page.locator(`#v13ManagerInbox [data-v13-item-id="review:${sourceId}"]`);
  const reviewBucket = await review.getAttribute('data-v13-bucket');
  if (reviewBucket !== 'now') throw new Error(`Revisão em 1h deveria estar em Agora, veio ${reviewBucket}.`);
  await review.locator('[data-v13-open]').click();
  await page.waitForSelector('#v12DecisionDrawer:not(.hidden)');
  await page.click('#v12DecisionDrawer [data-v12-close-drawer]');
  await page.waitForFunction(() => document.querySelector('#v12DecisionDrawer')?.classList.contains('hidden'));

  await page.click('[data-v13-filter="now"]');
  await page.waitForFunction(() => document.querySelector('[data-v13-filter="now"]')?.classList.contains('active'));
  const buckets = await page.locator('#v13ManagerInbox .v13-inbox-item').evaluateAll((nodes) => nodes.map((node) => node.dataset.v13Bucket));
  if (buckets.some((bucket) => bucket !== 'now')) throw new Error(`Filtro Agora misturou buckets: ${buckets.join(', ')}`);

  await page.screenshot({ path: 'artifacts/desktop-inbox-v13.png', fullPage: true });
});

await scenario('mobile: caixa gerencial mantém hierarquia sem overflow', { width: 390, height: 844 }, async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal da v13 no mobile: ${overflow}px`);
  if (await page.locator('#v13ManagerInbox .v13-inbox-kpis span').count() !== 4) throw new Error('KPIs da v13 sumiram no mobile.');
  const itemColumns = await page.locator('#v13ManagerInbox .v13-inbox-item').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  if (itemColumns.split(' ').length !== 1) throw new Error(`Item da caixa não empilhou no mobile: ${itemColumns}`);
  const actionColumns = await page.locator('#v13ManagerInbox .v13-item-actions').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  if (actionColumns.split(' ').length !== 1) throw new Error(`Ações da caixa não viraram coluna em 390px: ${actionColumns}`);
  if (!(await page.locator('#mobileDock [data-view="command"] .v13-attention-badge').isVisible())) throw new Error('Badge de atenção não está visível no dock móvel.');

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open');
  await page.waitForSelector('#v13InboxOps');
  await page.waitForSelector('#v13OpenInbox');
  await page.waitForSelector('#v13RestoreInbox');
  const opsTitle = await page.locator('#v13InboxOps .sheet-section-label').innerText();
  const opsTitleNormalized = opsTitle.toLocaleLowerCase('pt-BR');
  if (!opsTitleNormalized.includes('caixa de entrada gerencial')) throw new Error(`Título das operações v13 incorreto: ${opsTitle}`);
  const overflowSheet = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflowSheet > 2) throw new Error(`Central de operações criou overflow no mobile: ${overflowSheet}px`);
  await page.screenshot({ path: 'artifacts/mobile-inbox-v13.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários específicos da v13 aprovados.');