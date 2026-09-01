import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForSelector('#v11DecisionCenter .v11-decision-card');
const before = await page.evaluate(() => ({
  centers: document.querySelectorAll('#v11DecisionCenter').length,
  fixScript: [...document.scripts].some(s => s.src.includes('work-decisions-v11-fix.js')),
  cards: [...document.querySelectorAll('#v11DecisionCenter .v11-decision-card')].map(card => ({ id: card.dataset.decisionId, cls: card.className, status: card.querySelector('.v11-decision-status')?.textContent })),
}));
console.log('V11_BEFORE', JSON.stringify(before));
const first = page.locator('#v11DecisionCenter .v11-decision-card').first();
const id = await first.getAttribute('data-decision-id');
await first.locator('[data-v11-decision-status="adopted"]').click();
await page.waitForTimeout(500);
const after = await page.evaluate((decisionId) => ({
  centers: document.querySelectorAll('#v11DecisionCenter').length,
  stored: JSON.parse(localStorage.getItem('plano.decisions.v11') || '{}')[decisionId] || null,
  matches: [...document.querySelectorAll('#v11DecisionCenter .v11-decision-card')].filter(card => card.dataset.decisionId === decisionId).map(card => ({ cls: card.className, status: card.querySelector('.v11-decision-status')?.textContent, html: card.outerHTML.slice(0, 700) })),
}), id);
console.log('V11_AFTER', JSON.stringify(after));
console.log('V11_PAGE_ERRORS', JSON.stringify(pageErrors));
await browser.close();
if (!after.stored || after.stored.status !== 'adopted') process.exit(2);
