import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const maxTailPx = 320;
const browser = await chromium.launch({ headless: true });
const failures = [];

async function inspect(name, viewport, setup = async () => {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#content [class*="-view"]');
    await setup(page);
    await page.waitForTimeout(200);

    const report = await page.evaluate(() => {
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      const scrollY = window.scrollY;
      const meaningfulTags = new Set(['img', 'canvas', 'svg', 'button', 'input', 'select', 'textarea']);
      let meaningfulBottom = 0;

      for (const el of document.body.querySelectorAll('*')) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0) continue;
        if (style.position === 'fixed') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const tag = el.tagName.toLowerCase();
        const text = el.childElementCount === 0 ? (el.textContent || '').trim() : '';
        if (!text && !meaningfulTags.has(tag)) continue;
        meaningfulBottom = Math.max(meaningfulBottom, rect.bottom + scrollY);
      }

      return {
        docHeight: Math.round(docHeight),
        meaningfulBottom: Math.round(meaningfulBottom),
        tail: Math.max(0, Math.round(docHeight - meaningfulBottom))
      };
    });

    if (report.tail > maxTailPx) {
      throw new Error(`Cauda vertical excessiva: ${report.tail}px (limite ${maxTailPx}px; documento ${report.docHeight}px; conteúdo ${report.meaningfulBottom}px).`);
    }
    console.log(`PASS  ${name}: cauda vertical ${report.tail}px (limite ${maxTailPx}px)`);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await inspect('desktop-command', { width: 1440, height: 1000 });
await inspect('desktop-performance', { width: 1440, height: 1000 }, async page => {
  await page.click('#mainTabs [data-view="performance"]');
  await page.waitForSelector('.performance-view');
});
await inspect('mobile-command', { width: 390, height: 844 });

await browser.close();

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n3/3 cenários de cauda vertical aprovados.');
