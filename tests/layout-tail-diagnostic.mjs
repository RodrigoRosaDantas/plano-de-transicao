import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });

async function inspect(name, viewport, setup = async () => {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#content [class*="-view"]');
  await setup(page);
  await page.waitForTimeout(200);

  const report = await page.evaluate(() => {
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const nodes = [...document.body.querySelectorAll('*')].map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const top = rect.top + scrollY;
      const bottom = rect.bottom + scrollY;
      const visible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 && rect.height > 0;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        cls: typeof el.className === 'string' ? el.className.slice(0, 160) : '',
        top: Math.round(top),
        bottom: Math.round(bottom),
        height: Math.round(rect.height),
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        overflow: `${style.overflowX}/${style.overflowY}`,
        visible,
        text: (el.childElementCount === 0 ? (el.textContent || '').trim() : '').slice(0, 80)
      };
    });

    const flow = nodes.filter(n => n.visible && n.position !== 'fixed');
    const leaves = flow.filter(n => n.text || ['img','canvas','svg','button','input','select','textarea'].includes(n.tag));
    const meaningfulBottom = leaves.reduce((max, n) => Math.max(max, n.bottom), 0);
    const tail = Math.max(0, docHeight - meaningfulBottom);

    return {
      url: location.href,
      bodyClasses: document.body.className,
      docHeight,
      viewportHeight,
      meaningfulBottom,
      tail,
      deepest: flow.sort((a, b) => b.bottom - a.bottom).slice(0, 24),
      tallest: [...flow].sort((a, b) => b.height - a.height).slice(0, 24)
    };
  });

  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(report, null, 2));
  await context.close();
}

await inspect('desktop-command', { width: 1440, height: 1000 });
await inspect('desktop-performance', { width: 1440, height: 1000 }, async page => {
  await page.click('#mainTabs [data-view="performance"]');
  await page.waitForSelector('.performance-view');
});
await inspect('mobile-command', { width: 390, height: 844 });

await browser.close();
