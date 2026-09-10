import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForSelector('.command-view .transition-now-hero');

const currentHome = await page.evaluate(() => ({
  legacyCenters: document.querySelectorAll('#v11DecisionCenter, #v11AlertRadar, #v11WeeklyHorizon').length,
  currentHome: document.querySelectorAll('.transition-now-hero, .transition-kpi-grid, .transition-next, .transition-decision-grid').length,
  fixScript: [...document.scripts].some(s => s.src.includes('work-decisions-v11-fix.js')),
}));
if (currentHome.legacyCenters !== 0) throw new Error('Painéis v11 legados vazaram para a Home v35.');
if (currentHome.currentHome !== 4) throw new Error('A Home v35 não montou seus quatro blocos principais.');
if (!currentHome.fixScript) throw new Error('Camada de compatibilidade v11 não foi carregada.');

await page.click('#moreTopBtn');
await page.waitForSelector('#moreSheet.open #v11DecisionOps');
const operations = await page.locator('#moreSheet.open #v11DecisionOps').textContent();
const normalizedOperations = operations.toLocaleLowerCase('pt-BR');
if (!normalizedOperations.includes('decisões locais') || !normalizedOperations.includes('exportar decisões')) throw new Error('Operações locais v11 não estão acessíveis no menu Mais.');
if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(' | ')}`);
console.log('V11_COMPATIBILITY', JSON.stringify({ ...currentHome, operations: 'available' }));
await browser.close();
