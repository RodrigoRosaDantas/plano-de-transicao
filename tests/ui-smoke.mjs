import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const baseOrigin = new URL(baseURL).origin;
await fs.mkdir('artifacts', {recursive:true});

const browser = await chromium.launch({headless:true});
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
  // No GitHub Pages o SW do Plano tem escopo /plano-de-transicao/ e não alcança
  // /sedes-df-questoes/. O servidor local usa raiz /; bloquear SW aqui evita
  // um escopo artificialmente amplo. Manifesto/cache são auditados separadamente.
  const context = await browser.newContext({viewport, serviceWorkers:'block'});
  await context.addInitScript(() => {
    localStorage.setItem('sedes.questoes.activeProfile.v3', 'rodrigo');
    localStorage.setItem('sedes.questoes.profiles.v3', JSON.stringify([{id:'rodrigo',name:'Rodrigo',roles:['202','400']}]))
    localStorage.setItem('sedes.questoes.rodrigo.history.v3', JSON.stringify([{answered:20,correct:18,elapsed:1200,questionResults:Array.from({length:20},(_,i)=>({id:`q${i}`,answer:'A',correct:i<18,discipline:i<10?'Português':'Administração'}))}]))
    localStorage.setItem('sedes.questoes.rodrigo.errors.v3', JSON.stringify({q18:{id:'q18',open:true,count:2,discipline:'Administração'},q19:{id:'q19',open:true,count:1,discipline:'Administração'}}))
    localStorage.setItem('sedes.questoes.rodrigo.marked.v3', JSON.stringify({q3:{id:'q3',discipline:'Português'}}))
    localStorage.setItem('sedes.questoes.rodrigo.session.v3', JSON.stringify({current:4,questions:Array.from({length:20},(_,i)=>({id:`q${i}`})),answers:{q0:'A',q1:'B'},materialId:'teste'}))
  });
  await context.route('**/favicon.ico', route => route.fulfill({status:204,body:''}));
  await context.route('**/sedes-df-questoes/**', route => route.fulfill({status:200,contentType:'text/html',body:companionFixture}));
  const page = await context.newPage();
  const pageErrors = [];
  const badResponses = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(baseOrigin) && !url.includes('/sedes-df-questoes/')) {
      badResponses.push(`${response.status()} ${url}`);
    }
  });
  try {
    await page.goto(baseURL, {waitUntil:'networkidle'});
    await page.waitForSelector('#content .section-title');
    await fn(page, context);
    if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(' | ')}`);
    if (badResponses.length) throw new Error(`Recursos HTTP com falha: ${badResponses.join(' | ')}`);
    results.push({name, pass:true});
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({name,error:String(error?.stack || error)});
    results.push({name, pass:false});
    console.error(`FAIL  ${name}\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await run('desktop: home, busca, ferramentas, persistência e workspace nativo', {width:1440,height:1000}, async page => {
  await page.waitForSelector('.work-command-center');
  const localStatus = await page.locator('#studyLocalStatus').innerText();
  if (!localStatus.includes('tentativa salva')) throw new Error(`Persistência não detectada: ${localStatus}`);
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#commandPalette:not(.hidden)');
  await page.keyboard.press('Escape');
  await page.click('[data-tool-view="tools"]');
  await page.waitForSelector('#studyWorkspace');
  const frame = page.frameLocator('#studyWorkspaceFrame');
  await frame.locator('#app').waitFor();
  await page.waitForTimeout(100);

  const embeddedState = await page.locator('#studyWorkspaceFrame').evaluate(frameEl => {
    const doc = frameEl.contentDocument;
    const style = selector => doc?.querySelector(selector) ? getComputedStyle(doc.querySelector(selector)).display : 'missing';
    return {
      topbar: style('.topbar'),
      mobileNav: style('.mobile-nav'),
      footer: style('.footer'),
      skip: style('.skip'),
      theme: doc?.documentElement?.getAttribute('data-theme'),
      embedded: doc?.body?.dataset?.planoEmbedded
    };
  });
  for (const key of ['topbar','mobileNav','footer','skip']) {
    if (embeddedState[key] !== 'none') throw new Error(`Navegação duplicada não foi ocultada: ${key}=${embeddedState[key]}`);
  }
  if (embeddedState.embedded !== 'true') throw new Error('Modo embutido não foi aplicado ao workspace.');
  const parentLight = await page.locator('html').evaluate(el => el.classList.contains('light'));
  const expectedTheme = parentLight ? 'light' : 'dark';
  if (embeddedState.theme !== expectedTheme) throw new Error(`Tema do workspace divergiu: ${embeddedState.theme} != ${expectedTheme}`);

  await page.click('[data-workspace-route="revisar"]');
  if ((await page.locator('#studyWorkspace').getAttribute('data-study-route')) !== 'revisar') throw new Error('Workspace não mudou para revisão.');
  await page.screenshot({path:'artifacts/desktop-tools.png',fullPage:true});
});

await run('desktop: financeiro sem legado e com comparativos', {width:1440,height:1000}, async page => {
  await page.click('[data-view="finance"]');
  await page.waitForSelector('#workFinanceCycle');
  await page.waitForSelector('#financeParityCharts');
  await page.waitForSelector('.finance-cycle-chart');
  await page.waitForSelector('.finance-status-panel');
  await page.waitForSelector('.roi-guardrail');
  const legacy = await page.locator('#content .panel').filter({has:page.locator('table')}).filter({hasText:'COMPOSIÇÃO'}).count();
  if (legacy) throw new Error('Tabela financeira legada ainda está visível.');
  await page.selectOption('#workFinanceCycle', {label:'SEDES/DF 2026'});
  const count = Number((await page.locator('#workFinanceCount').innerText()).replace(/\D/g,''));
  if (!count) throw new Error('Filtro financeiro não retornou lançamentos.');
  await page.screenshot({path:'artifacts/desktop-finance.png',fullPage:true});
});

await run('desktop: provas e auditoria', {width:1440,height:1000}, async page => {
  await page.click('[data-view="exams"]');
  await page.waitForSelector('#examParityComparison');
  await page.waitForSelector('.exam-matrix');
  const rows = await page.locator('.exam-matrix tbody tr').count();
  if (rows < 8) throw new Error(`Matriz de provas incompleta: ${rows} linhas.`);
  await page.click('[data-view="audit"]');
  await page.waitForSelector('#parityAuditHealth');
  const health = await page.locator('#parityAuditHealth h2').innerText();
  if (!health.startsWith('9/9')) throw new Error(`Auditoria visual não fechou: ${health}`);
  await page.screenshot({path:'artifacts/desktop-audit.png',fullPage:true});
});

await run('mobile: navegação, workspace e ausência de overflow', {width:390,height:844}, async page => {
  if (!(await page.locator('.mobile-dock').isVisible())) throw new Error('Dock móvel não está visível.');
  await page.click('.mobile-dock [data-tool-view="tools"]');
  await page.waitForSelector('#studyWorkspace');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal mobile: ${overflow}px`);
  await page.screenshot({path:'artifacts/mobile-tools.png',fullPage:true});
});

await run('tablet: financeiro responsivo pelo fluxo Mais', {width:820,height:1180}, async page => {
  if (!(await page.locator('.mobile-dock').isVisible())) throw new Error('Dock de tablet não está visível.');
  await page.click('#dockMore');
  await page.waitForSelector('#sidebar.open');
  await page.click('#sidebar [data-view="finance"]');
  await page.waitForSelector('#financeParityCharts');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error(`Overflow horizontal tablet: ${overflow}px`);
  await page.screenshot({path:'artifacts/tablet-finance.png',fullPage:true});
});

await browser.close();
console.log(`\n${results.filter(x=>x.pass).length}/${results.length} cenários de UI aprovados.`);
if (failures.length) {
  console.error(JSON.stringify(failures,null,2));
  process.exit(1);
}
