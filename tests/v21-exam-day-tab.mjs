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
  page.on('pageerror', error => errors.push(String(error)));
  try {
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

async function waitForMoreClosed(page) {
  await page.waitForFunction(() => {
    const sheet = document.getElementById('moreSheet');
    if (!sheet) return true;
    if (sheet.classList.contains('open')) return false;
    const rect = sheet.getBoundingClientRect();
    return rect.left >= window.innerWidth - 1 || rect.top >= window.innerHeight - 1 || rect.right <= 1 || rect.bottom <= 1;
  });
}

await scenario('desktop: aba dedicada, dados oficiais e persistência', { width: 1440, height: 1000 }, async page => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#mainTabs [data-exam-day-tab]');
  await page.click('#mainTabs [data-exam-day-tab]');
  await page.waitForURL(/#exam-day$/);
  await page.waitForSelector('.exam21-shell');
  await waitForMoreClosed(page);

  if (!(await page.locator('body').evaluate(node => node.classList.contains('exam-day-active')))) throw new Error('Shell dedicado não foi ativado.');
  if (await page.locator('.mission-strip').isVisible()) throw new Error('Faixa institucional da Home continua visível na aba dedicada.');
  if (await page.locator('.context-line').isVisible()) throw new Error('Linha de contexto da Home continua visível na aba dedicada.');
  if (await page.locator('#examDayControl').isVisible()) throw new Error('Bloco antigo do Dia da Prova continua visível.');

  const text = await page.locator('.exam21-shell').innerText();
  for (const value of [
    'Dia da prova, sem ruído.',
    'EDAS · CARGO 400', 'Administração', '06:45', '07:45', '1820',
    'TDAS · CARGO 202', 'Técnico Administrativo', '13:45', '14:45', '1830',
    'Não divulgado oficialmente', '4h após o início efetivo', '4 horas'
  ]) if (!text.includes(value)) throw new Error(`Conteúdo esperado ausente: ${value}`);

  // Reproduz a interação real: o input é visualmente oculto; o usuário toca no cartão/label.
  await page.locator('.exam21-check').first().click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('plano-transicao:exam-day-v19:checks') || '{}').documento === true);

  // Fluxo real do drawer no desktop: sair para Agora, abrir Mais e então entrar em Dia da Prova.
  await page.click('#mainTabs [data-view="command"]');
  await page.waitForURL(/#command$/);
  await page.evaluate(() => document.getElementById('moreTopBtn')?.click());
  await page.waitForSelector('#moreSheet.open');
  await page.waitForFunction(() => {
    const sheet = document.getElementById('moreSheet');
    if (!sheet?.classList.contains('open')) return false;
    const rect = sheet.getBoundingClientRect();
    return rect.left < window.innerWidth && rect.right > 0;
  });
  await page.click('#moreSheet [data-exam-day-tab]');
  await page.waitForURL(/#exam-day$/);
  await page.waitForSelector('.exam21-shell');
  await waitForMoreClosed(page);
  if (await page.locator('#moreSheet').evaluate(node => node.classList.contains('open'))) throw new Error('Menu Mais permaneceu aberto sobre a aba Dia da Prova.');
  if (!(await page.locator('#exam21Checks input[value="documento"]').isChecked())) throw new Error('Checklist não persistiu ao retornar pelo menu Mais.');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal desktop: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/desktop-dia-da-prova-v21.png', fullPage: true });
});

await scenario('acesso direto: #exam-day sobrevive à inicialização do app', { width: 1180, height: 900 }, async page => {
  await page.goto(`${baseURL}#exam-day`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.exam21-shell', { timeout: 10000 });
  await waitForMoreClosed(page);
  if (new URL(page.url()).hash !== '#exam-day') throw new Error(`Hash direto foi perdido: ${page.url()}`);
  const active = await page.locator('#mainTabs [data-exam-day-tab]').getAttribute('aria-current');
  if (active !== 'page') throw new Error('Aba dedicada não ficou ativa no acesso direto.');
  if (await page.locator('#examDayControl').isVisible()) throw new Error('Bloco legado reapareceu no acesso direto.');
});

await scenario('mobile 390px: dock enxuto, cards empilhados e sem overflow', { width: 390, height: 844 }, async page => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#mobileDock [data-exam-day-tab]');
  await page.click('#mobileDock [data-exam-day-tab]');
  await page.waitForSelector('.exam21-shell');
  await waitForMoreClosed(page);

  if (!(await page.locator('#mobileDock [data-exam-day-tab]').isVisible())) throw new Error('Atalho Dia da Prova não está visível no dock móvel.');
  if (await page.locator('#mobileDock [data-view="journey"]').isVisible()) throw new Error('Dock móvel manteve opção redundante e ficou superlotado.');
  if (await page.locator('.exam21-turn').count() !== 2) throw new Error('Os dois turnos não foram renderizados.');
  if (await page.locator('#moreSheet').evaluate(node => node.classList.contains('open'))) throw new Error('Menu Mais ficou aberto sobre a aba no mobile.');

  const turnColumns = await page.locator('.exam21-turns').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (turnColumns.trim().split(/\s+/).length !== 1) throw new Error(`Cards não empilharam no mobile: ${turnColumns}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({ path: 'artifacts/mobile-dia-da-prova-v21.png', fullPage: true });
});

await browser.close();

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários da aba Dia da Prova aprovados.');
