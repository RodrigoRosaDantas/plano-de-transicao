import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', {recursive:true});

const browser = await chromium.launch({headless:true});
const results = [];
const failures = [];

async function run(name, viewport, fn) {
  const context = await browser.newContext({viewport, serviceWorkers:'allow'});
  await context.addInitScript(() => {
    localStorage.setItem('sedes.questoes.activeProfile.v3', 'rodrigo');
    localStorage.setItem('sedes.questoes.profiles.v3', JSON.stringify([{id:'rodrigo',name:'Rodrigo',roles:['202','400']}]))
    localStorage.setItem('sedes.questoes.rodrigo.history.v3', JSON.stringify([{answered:20,correct:18,elapsed:1200,questionResults:Array.from({length:20},(_,i)=>({id:`q${i}`,answer:'A',correct:i<18,discipline:i<10?'Português':'Administração'}))}]))
    localStorage.setItem('sedes.questoes.rodrigo.errors.v3', JSON.stringify({q18:{id:'q18',open:true,count:2,discipline:'Administração'},q19:{id:'q19',open:true,count:1,discipline:'Administração'}}))
    localStorage.setItem('sedes.questoes.rodrigo.marked.v3', JSON.stringify({q3:{id:'q3',discipline:'Português'}}))
    localStorage.setItem('sedes.questoes.rodrigo.session.v3', JSON.stringify({current:4,questions:Array.from({length:20},(_,i)=>({id:`q${i}`})),answers:{q0:'A',q1:'B'},materialId:'teste'}))
  });
  await context.route('**/sedes-df-questoes/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Plataforma de Questões</title><main>Fixture da plataforma integrada</main>'}));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', msg => { if (msg.type()==='error') consoleErrors.push(msg.text()); });
  try {
    await page.goto(baseURL, {waitUntil:'networkidle'});
    await page.waitForSelector('#content .section-title');
    await fn(page, context);
    if (consoleErrors.length) throw new Error(`Erros de console: ${consoleErrors.join(' | ')}`);
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

await run('desktop: home, busca, ferramentas e persistência', {width:1440,height:1000}, async page => {
  await page.waitForSelector('.work-command-center');
  const localStatus = await page.locator('#studyLocalStatus').innerText();
  if (!localStatus.includes('tentativa salva')) throw new Error(`Persistência não detectada: ${localStatus}`);
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#commandPalette:not(.hidden)');
  await page.keyboard.press('Escape');
  await page.click('[data-tool-view="tools"]');
  await page.waitForSelector('#studyWorkspace');
  await page.waitForSelector('#studyWorkspaceFrame');
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

await run('tablet: financeiro responsivo', {width:820,height:1180}, async page => {
  await page.click('[data-view="finance"]');
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
