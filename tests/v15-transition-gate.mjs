import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

async function scenario(name, viewport, fixedNow, run) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(({ fixed }) => {
    const OriginalDate = Date;
    const fixedTime = new OriginalDate(fixed).getTime();
    class FixedDate extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    }
    window.Date = FixedDate;
  }, { fixed: fixedNow });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#v15TransitionSummary');
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

await scenario('pré-prova: fechamento preparado, rastreável e sem execução antecipada', { width: 1440, height: 1000 }, '2026-09-01T15:00:00-03:00', async (page) => {
  const summary = await page.locator('#v15TransitionSummary').innerText();
  if (!summary.includes('Fechamento preparado')) throw new Error(`Fase pré-prova incorreta: ${summary}`);
  if (!summary.toLowerCase().includes('ativa em 5d')) throw new Error(`Resumo não preservou D-5: ${summary}`);
  await page.click('#v15TransitionSummary [data-v15-open]');
  await page.waitForURL(/#strategy$/);
  await page.waitForSelector('#transitionGateV15');

  const gates = page.locator('#transitionGateV15 [data-v15-step]');
  if (await gates.count() !== 5) throw new Error(`Esperava 5 etapas, recebeu ${await gates.count()}.`);
  const disabled = await gates.evaluateAll((nodes) => nodes.every((node) => node.disabled));
  if (!disabled) throw new Error('Etapas deveriam permanecer bloqueadas antes da prova.');
  const source = await page.locator('#transitionGateV15 .v15-source-line').innerText();
  const sourceNormalized = source.toLowerCase();
  if (!sourceNormalized.includes('notion tratado') || !sourceNormalized.includes('snapshot sem espelho bruto')) throw new Error(`Fonte tratada não está explícita: ${source}`);
  if (await page.locator('[data-view="study"]').count()) throw new Error('A v15 reintroduziu navegação de estudo.');
  if (await page.locator('iframe').count()) throw new Error('A v15 reintroduziu iframe.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal pré-prova: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/desktop-transition-v15.png', fullPage: true });
});

await scenario('pós-prova mobile: fechamento ativa, persiste e integra operações', { width: 390, height: 844 }, '2026-09-07T12:00:00-03:00', async (page) => {
  const summary = await page.locator('#v15TransitionSummary').innerText();
  if (!summary.includes('Fechamento ativo')) throw new Error(`Fase pós-prova incorreta: ${summary}`);
  await page.click('#v15TransitionSummary [data-v15-open]');
  await page.waitForSelector('#transitionGateV15[data-v15-phase="active"]');

  const first = page.locator('#transitionGateV15 [data-v15-step="0"]');
  if (!(await first.isEnabled())) throw new Error('Primeira etapa deveria estar habilitada após a prova.');
  await first.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('plano.transitionGate.v15') || '{}').completed?.includes(0));
  await page.waitForFunction(() => document.querySelector('#transitionGateV15 .v15-progress-row strong')?.textContent === '1/5');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#transitionGateV15 [data-v15-step="0"].done');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('plano.transitionGate.v15') || '{}'));
  if (!stored.completed?.includes(0) || stored.version !== 15) throw new Error(`Estado local inválido: ${JSON.stringify(stored)}`);
  if (!(await page.locator('#transitionGateV15 [data-v15-export]').isVisible())) throw new Error('Exportação do fechamento não está disponível.');

  await page.click('#moreDockBtn');
  await page.waitForSelector('#moreSheet.open #v15TransitionOps');
  await page.waitForFunction(() => {
    const text = document.querySelector('#moreSheet.open #v15TransitionOps')?.textContent || '';
    return text.includes('Fechamento ativo') && text.includes('1/5');
  }, null, { timeout: 5000 });
  const action = page.locator('#moreSheet.open #v15TransitionOps .action-button');
  await action.waitFor({ state: 'visible', timeout: 5000 });
  const ops = await page.locator('#moreSheet.open #v15TransitionOps').textContent();
  if (!ops?.includes('Fechamento ativo') || !ops?.includes('1/5')) throw new Error(`Mais não refletiu o fechamento: ${ops}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal pós-prova: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-transition-v15.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n2/2 cenários específicos da v15 aprovados.');
