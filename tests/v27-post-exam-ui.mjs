import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const fold = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

async function boot(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#content[aria-busy="false"]', { timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.dataset.planPhase === 'post-exam', null, { timeout: 10000 });
}

async function openView(page, view) {
  const link = page.locator('[data-view="' + view + '"]:visible').first();
  await link.click();
  await page.waitForURL(new RegExp('#' + view + '$'));
}

async function openPost(page) {
  await openView(page, 'post-exam');
  await page.waitForSelector('.post-exam-view [data-post-exam-page]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-post-followup]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-transition-console]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-competition-panel]', { timeout: 15000 });
  await page.waitForSelector('.post-exam-view [data-v28-question-audit]', { timeout: 15000 });
}

async function scenario(name, viewport, run, setup = null) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    if (setup) await setup(page);
    await boot(page);
    await run(page);
    if (errors.length) throw new Error('Erros JavaScript: ' + errors.join(' | '));
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push({ name, error: String(error?.stack || error) });
    console.error('FAIL  ' + name + '\n' + (error?.stack || error));
  } finally {
    await context.close();
  }
}

await scenario('desktop: Agora preserva o plano e Pré-prova fica pronta para o próximo edital', { width: 1440, height: 1000 }, async page => {
  const home = page.locator('.command-view');
  await page.waitForSelector('.command-view .transition-now-hero');
  if (await home.locator('[data-v28-transition-console], [data-v28-post-followup], [data-v28-competition-panel], [data-post-exam-page]').count()) {
    throw new Error('A tela Agora voltou a receber painéis detalhados de pós-prova.');
  }
  const homeText = fold(await home.innerText());
  if (homeText.includes('tdas') || homeText.includes('edas')) throw new Error('TDAS/EDAS ainda aparecem no resumo do Agora.');
  for (const value of ['central de transição', 'plano de transição', 'capital acumulado', 'próximo ciclo', 'seedf', 'tjdft', 'histórico consolidado']) {
    if (!homeText.includes(value)) throw new Error('Agora sem foco do plano: ' + value);
  }
  const milestone = fold(await page.locator('#nextMilestone').innerText());
  if (!milestone.includes('próximos ciclos') || !milestone.includes('seedf') || !milestone.includes('tjdft')) throw new Error('Controle global da transição foi perdido: ' + milestone);

  await openView(page, 'pre-exam');
  await page.waitForSelector('.pre-exam-view .preexam-hero');
  const pre = page.locator('.pre-exam-view');
  const preText = fold(await pre.innerText());
  for (const value of ['pré-prova pronta para o próximo concurso', 'modo de prontidão', 'gatilho de ativação', 'regra de separação']) {
    if (!preText.includes(value)) throw new Error('Pré-prova sem: ' + value);
  }
  if (await pre.locator('.preexam-checklist-item').count() !== 7) throw new Error('Checklist de pré-prova incompleto.');
  if (await pre.locator('.preexam-output-tag').count() !== 6) throw new Error('Saídas preparadas do próximo ciclo incompletas.');
  if (await pre.locator('.post-exam-view').count()) throw new Error('Pré-prova incorporou o ciclo pós-prova.');

  await page.screenshot({ path: 'artifacts/desktop-pre-prova-v29.png', fullPage: true });
});

await scenario('desktop: Pós-prova dedicada concentra auditoria, gráficos e decisões', { width: 1440, height: 1100 }, async page => {
  await openPost(page);
  const post = page.locator('.post-exam-view');
  const text = fold(await post.textContent());
  for (const value of ['acompanhamento pós-prova', 'tipo b', 'tipo a', 'gabarito preliminar', 'recursos e divergências', 'auditoria questão a questão', 'sua anotação', 'motivo / leitura', 'pré-análise']) {
    if (!text.includes(value)) throw new Error('Pós-prova dedicada sem: ' + value);
  }
  if (await post.locator('[data-post-exam-page]').count() !== 1) throw new Error('Deve existir um único host de pós-prova.');
  await page.waitForSelector('.post-exam-view [data-post-exam-page] [data-q44-wrap]', { timeout: 15000 });
  const sedesMonitor = post.locator('[data-post-exam-page] [data-q44-wrap]');
  const sedesText = fold(await sedesMonitor.innerText());
  for (const value of ['pós-prova · sedes/df', 'acompanhamento do concurso', 'banca · quadrix', 'meus dados no concurso']) {
    if (!sedesText.includes(value)) throw new Error('Monitor SEDES/Quadrix não está visível no Pós-prova: ' + value);
  }
  if (await page.locator('.command-view [data-q44-wrap]').count()) throw new Error('Monitor SEDES/Quadrix vazou para a tela Agora.');
  if (await post.locator('[data-v28-transition-console]').count() !== 1) throw new Error('Central adaptativa não está no pós-prova dedicado.');
  if (await post.locator('[data-v28-competition-panel]').count() !== 1) throw new Error('Leitura competitiva não está no pós-prova dedicado.');
  if (await post.locator('[data-v28-post-followup]').count() !== 1) throw new Error('Acompanhamento estruturado não está no pós-prova dedicado.');
  const rows = post.locator('[data-v28-question-audit] .v28-audit-row');
  await rows.first().waitFor({ state: 'attached' });
  if (await rows.count() !== 120) throw new Error('A auditoria deveria mostrar 120 registros de questões, não ' + await rows.count() + '.');
  const commandPostPanels = page.locator('.command-view [data-v28-transition-console], .command-view [data-v28-post-followup], .command-view [data-v28-competition-panel], .command-view [data-post-exam-page]');
  if (await commandPostPanels.count()) throw new Error('Pós-prova vazou para a tela Agora.');
  await page.screenshot({ path: 'artifacts/desktop-pos-prova-v29.png', fullPage: true });
});


await scenario('desktop: painel privado SEDES cruza inscrições, notas e régua do edital', { width: 1440, height: 1200 }, async page => {
  await openPost(page);
  await page.waitForSelector('[data-q44-role="202"]', { timeout: 15000 });
  await page.waitForSelector('[data-q44-role="400"]', { timeout: 15000 });
  const privateText = fold(await page.locator('[data-q44-private-body]').innerText());
  for (const value of [
    'minha situação agora',
    'nota preliminar',
    'mínimos objetivos',
    'inscrições homologadas ac',
    'correções de discursiva ac',
    'vagas / cr ac',
    'prazo de recursos encerrado',
    'resultado objetivo preliminar',
    'não é probabilidade pessoal'
  ]) {
    if (!privateText.includes(value)) throw new Error('Painel privado sem: ' + value);
  }
  if (!privateText.includes('83/100') || !privateText.includes('88/100')) {
    throw new Error('Notas preliminares dos dois cargos não foram carregadas.');
  }
  await page.screenshot({ path: 'artifacts/desktop-pos-prova-privado-sedes.png', fullPage: true });
}, async page => {
  await page.addInitScript(() => sessionStorage.setItem('plano.webRadar.session.v2', 'test-session'));
  await page.route('**/functions/v1/personal-web-search', async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (body.action === 'sedes_status') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          identifiers: [
            { id: 'r202', kind: 'other', label: 'Inscrição SEDES 202', masked_value: '*****0001', search_sedes: true, active: true },
            { id: 'r400', kind: 'other', label: 'Inscrição SEDES 400', masked_value: '*****0002', search_sedes: true, active: true }
          ],
          sedesHits: [
            {
              id: 'h202',
              cargo_code: '202',
              match_type: 'name',
              registration_masked: '•••••0001',
              confidence: 100,
              publication: { title: 'Resultado definitivo (inscrições homologadas) 05/08/2026', url: 'https://example.test/202', published_at: '2026-08-05', kind: 'inscricoes' },
              matched_identifier: { label: 'Nome atual', kind: 'name', masked_value: 'Ro••••' }
            },
            {
              id: 'h400',
              cargo_code: '400',
              match_type: 'name',
              registration_masked: '•••••0002',
              confidence: 100,
              publication: { title: 'Resultado definitivo (inscrições homologadas) 05/08/2026', url: 'https://example.test/400', published_at: '2026-08-05', kind: 'inscricoes' },
              matched_identifier: { label: 'Nome atual', kind: 'name', masked_value: 'Ro••••' }
            }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
});

await scenario('iPad 820px: painel privado SEDES preserva leitura e não cria overflow', { width: 820, height: 1180 }, async page => {
  await openPost(page);
  await page.waitForSelector('[data-q44-role="202"]', { timeout: 15000 });
  await page.waitForSelector('[data-q44-role="400"]', { timeout: 15000 });
  const post = page.locator('.post-exam-view');
  const privateText = fold(await post.locator('[data-q44-private-body]').innerText());
  if (!privateText.includes('83/100') || !privateText.includes('88/100')) {
    throw new Error('iPad não carregou as duas notas preliminares do painel privado.');
  }
  const summaryCols = await post.locator('.q44-private-summary').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (summaryCols.trim().split(/\s+/).length !== 1) throw new Error('Resumo privado não empilhou no iPad: ' + summaryCols);
  const roleCols = await post.locator('.q44-role-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (roleCols.trim().split(/\s+/).length !== 1) throw new Error('Cards 202/400 não empilharam no iPad: ' + roleCols);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal no iPad: ' + overflow + 'px');
  await page.screenshot({ path: 'artifacts/ipad-pos-prova-privado-sedes.png', fullPage: true });
}, async page => {
  await page.addInitScript(() => sessionStorage.setItem('plano.webRadar.session.v2', 'test-session'));
  await page.route('**/functions/v1/personal-web-search', async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (body.action === 'sedes_status') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          identifiers: [
            { id: 'r202', kind: 'other', label: 'Inscrição SEDES 202', masked_value: '*****0001', search_sedes: true, active: true },
            { id: 'r400', kind: 'other', label: 'Inscrição SEDES 400', masked_value: '*****0002', search_sedes: true, active: true }
          ],
          sedesHits: [
            {
              id: 'h202',
              cargo_code: '202',
              match_type: 'name',
              registration_masked: '•••••0001',
              confidence: 100,
              publication: { title: 'Resultado definitivo (inscrições homologadas) 05/08/2026', url: 'https://example.test/202', published_at: '2026-08-05', kind: 'inscricoes' },
              matched_identifier: { label: 'Nome atual', kind: 'name', masked_value: 'Ro••••' }
            },
            {
              id: 'h400',
              cargo_code: '400',
              match_type: 'name',
              registration_masked: '•••••0002',
              confidence: 100,
              publication: { title: 'Resultado definitivo (inscrições homologadas) 05/08/2026', url: 'https://example.test/400', published_at: '2026-08-05', kind: 'inscricoes' },
              matched_identifier: { label: 'Nome atual', kind: 'name', masked_value: 'Ro••••' }
            }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
});

await scenario('mobile 390px: fases separadas e dados densos sem overflow', { width: 390, height: 844 }, async page => {
  await openPost(page);
  const post = page.locator('.post-exam-view');
  const followupCols = await post.locator('.v28-followup-chart-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (followupCols.trim().split(/\s+/).length !== 1) throw new Error('Gráficos do pós-prova não empilharam: ' + followupCols);
  const competitionCols = await post.locator('.v28-competition-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  if (competitionCols.trim().split(/\s+/).length !== 1) throw new Error('Cards competitivos não empilharam: ' + competitionCols);
  const auditWrap = post.locator('.v28-audit-table-wrap').first();
  if ((await auditWrap.evaluate(node => getComputedStyle(node).overflowX)) === 'visible') throw new Error('Tabela de auditoria não ganhou rolagem interna no mobile.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('Overflow horizontal mobile: ' + overflow + 'px');
  await page.screenshot({ path: 'artifacts/mobile-pos-prova-v29.png', fullPage: true });
});

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\n5/5 cenários de fases separadas aprovados.');
