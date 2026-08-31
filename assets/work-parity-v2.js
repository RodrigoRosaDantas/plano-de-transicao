(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => new Intl.NumberFormat('pt-BR').format(Number(n || 0));
  const pct = n => n == null ? '—' : `${Number(n).toFixed(2).replace('.', ',')}%`;
  const money = n => n == null ? '—' : new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(n));
  const STUDY_BASE = '../sedes-df-questoes/';
  const STUDY_ROUTES = [
    {id:'inicio', label:'Início', icon:'⌂', href:`${STUDY_BASE}#/inicio`},
    {id:'estudar', label:'Estudar', icon:'▣', href:`${STUDY_BASE}#/estudar`},
    {id:'cargo', label:'Por cargo', icon:'▦', href:`${STUDY_BASE}estudo-por-cargo.html`},
    {id:'revisar', label:'Revisar', icon:'◎', href:`${STUDY_BASE}#/revisar`},
    {id:'desempenho', label:'Desempenho', icon:'◔', href:`${STUDY_BASE}#/desempenho`},
    {id:'prova', label:'Prova Real', icon:'◇', href:`${STUDY_BASE}#/inicio`}
  ];
  let activeStudyRoute = sessionStorage.getItem('plano.study.route') || 'inicio';

  function dataReady() { return typeof DATA !== 'undefined' && DATA; }

  function routeFromHref(href='') {
    if (href.includes('estudo-por-cargo')) return 'cargo';
    if (href.includes('#/estudar')) return 'estudar';
    if (href.includes('#/revisar')) return 'revisar';
    if (href.includes('#/desempenho')) return 'desempenho';
    return 'inicio';
  }

  function workspaceMarkup() {
    const route = STUDY_ROUTES.find(x => x.id === activeStudyRoute) || STUDY_ROUTES[0];
    return `<section class="study-workspace panel" id="studyWorkspace" data-study-route="${esc(route.id)}">
      <div class="workspace-head">
        <div><p class="eyebrow">WORKSPACE INTEGRADO</p><h2>Plataforma de Questões dentro do Plano</h2><p>Mesma origem, mesmo progresso, mesmos módulos. Nenhum histórico paralelo é criado.</p></div>
        <div class="workspace-actions"><button class="btn-work" type="button" data-workspace-reload>↻ Atualizar módulo</button><button class="btn-work" type="button" data-workspace-fullscreen>⛶ Tela cheia</button><a class="btn-work" data-workspace-external href="${route.href}" target="_blank" rel="noreferrer">Abrir em nova aba ↗</a></div>
      </div>
      <div class="workspace-tabs" role="tablist" aria-label="Módulos de estudo">${STUDY_ROUTES.map(item => `<button type="button" role="tab" aria-selected="${item.id===route.id?'true':'false'}" class="${item.id===route.id?'active':''}" data-workspace-route="${item.id}"><b>${item.icon}</b><span>${esc(item.label)}</span></button>`).join('')}</div>
      <div class="workspace-browser">
        <div class="workspace-browserbar"><span class="workspace-browser-dot"></span><span class="workspace-browser-dot"></span><span class="workspace-browser-dot"></span><strong id="workspaceRouteLabel">${esc(route.label)}</strong><span class="workspace-same-origin">mesmo ecossistema · progresso preservado</span></div>
        <div class="workspace-loading" id="workspaceLoading"><span></span><strong>Carregando ${esc(route.label)}…</strong></div>
        <iframe id="studyWorkspaceFrame" title="${esc(route.label)} — Plataforma de Questões" src="${route.href}" loading="eager" allow="fullscreen" referrerpolicy="same-origin"></iframe>
      </div>
      <div class="workspace-foot"><span>Se o módulo não carregar dentro do painel, use “Abrir em nova aba”. Seu progresso continua o mesmo.</span><span id="workspaceState">conectando…</span></div>
    </section>`;
  }

  function ensureWorkspace() {
    if (location.hash !== '#tools') return;
    const content = $('#content');
    if (!content || content.querySelector('#studyWorkspace')) return;
    const actions = content.querySelector('.work-actions-grid');
    const target = actions || content.querySelector('.work-metrics-grid') || content.lastElementChild;
    if (!target) return;
    target.insertAdjacentHTML('afterend', workspaceMarkup());
    bindWorkspace();
  }

  function openWorkspace(routeId, scroll = true) {
    activeStudyRoute = STUDY_ROUTES.some(x => x.id === routeId) ? routeId : 'inicio';
    sessionStorage.setItem('plano.study.route', activeStudyRoute);
    ensureWorkspace();
    const workspace = $('#studyWorkspace');
    const route = STUDY_ROUTES.find(x => x.id === activeStudyRoute) || STUDY_ROUTES[0];
    const frame = $('#studyWorkspaceFrame');
    const loading = $('#workspaceLoading');
    const state = $('#workspaceState');
    const external = $('[data-workspace-external]');
    const label = $('#workspaceRouteLabel');
    if (!workspace || !frame) return;
    workspace.dataset.studyRoute = route.id;
    $$('#studyWorkspace [data-workspace-route]').forEach(button => {
      const active = button.dataset.workspaceRoute === route.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (label) label.textContent = route.label;
    if (external) external.href = route.href;
    loading?.classList.remove('hidden');
    if (state) state.textContent = 'carregando…';
    frame.title = `${route.label} — Plataforma de Questões`;
    if (frame.getAttribute('src') !== route.href) frame.setAttribute('src', route.href);
    if (scroll) workspace.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function bindWorkspace() {
    const frame = $('#studyWorkspaceFrame');
    if (!frame || frame.dataset.bound) return;
    frame.dataset.bound = '1';
    frame.addEventListener('load', () => {
      $('#workspaceLoading')?.classList.add('hidden');
      const state = $('#workspaceState');
      if (state) state.textContent = 'módulo carregado';
      try {
        const href = frame.contentWindow?.location?.href || '';
        if (href) {
          const detected = routeFromHref(href);
          activeStudyRoute = detected;
          sessionStorage.setItem('plano.study.route', detected);
        }
      } catch {}
    });
    $$('[data-workspace-route]').forEach(button => button.addEventListener('click', () => openWorkspace(button.dataset.workspaceRoute, false)));
    $('[data-workspace-reload]')?.addEventListener('click', () => {
      const current = STUDY_ROUTES.find(x => x.id === activeStudyRoute) || STUDY_ROUTES[0];
      $('#workspaceLoading')?.classList.remove('hidden');
      frame.src = current.href;
    });
    $('[data-workspace-fullscreen]')?.addEventListener('click', async () => {
      const workspace = $('#studyWorkspace');
      if (!document.fullscreenElement) await workspace?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    });
  }

  function interceptStudyLinks(event) {
    if (location.hash !== '#tools') return;
    const link = event.target.closest('a[href*="sedes-df-questoes"]');
    if (!link || link.hasAttribute('data-workspace-external') || link.target === '_blank') return;
    event.preventDefault();
    openWorkspace(routeFromHref(link.getAttribute('href')));
  }

  function removeLegacyFinanceTable() {
    if (location.hash !== '#finance' || !dataReady()?.financeEntries?.length) return;
    $$('#content .panel').forEach(panel => {
      if (panel.closest('.work-finance-toolbox')) return;
      const heading = panel.querySelector('.eyebrow')?.textContent?.trim().toUpperCase();
      if (heading === 'COMPOSIÇÃO' && panel.querySelector('table')) panel.remove();
    });
  }

  function investmentByCycleMarkup() {
    const summary = dataReady()?.financeSummary;
    if (!summary?.byCycle?.length) return '';
    const max = Math.max(1, ...summary.byCycle.map(x => Number(x.confirmed || 0) + Number(x.estimated || 0)));
    return `<section class="panel finance-cycle-chart"><div class="panel-head"><div><p class="eyebrow">INVESTIMENTO POR CICLO</p><h2>Confirmado e estimado sem misturar naturezas</h2></div><span class="method-badge">Banco 02.1</span></div><div class="stacked-bars">${summary.byCycle.map(x => {
      const confirmed = Number(x.confirmed || 0), estimated = Number(x.estimated || 0);
      const cw = confirmed/max*100, ew = estimated/max*100;
      return `<div class="stacked-row"><div class="stacked-label"><strong>${esc(x.key)}</strong><span>${money(confirmed)} confirmado${estimated?` · ${money(estimated)} estimado`:''}</span></div><div class="stacked-track"><i class="confirmed" style="width:${cw.toFixed(2)}%"></i><i class="estimated" style="width:${ew.toFixed(2)}%"></i></div><b>${fmt(x.transactions)} lançamento(s)</b></div>`;
    }).join('')}</div><div class="chart-key"><span><i class="key-confirmed"></i>Confirmado/pago</span><span><i class="key-estimated"></i>Estimado</span></div></section>`;
  }

  function financialStatusMarkup() {
    const entries = dataReady()?.financeEntries || [];
    if (!entries.length) return '';
    const groups = [
      ['Confirmado / pago', entries.filter(x=>x.situation==='Confirmado / pago').length, 'good'],
      ['Confirmado — sem custo', entries.filter(x=>x.situation==='Confirmado — sem custo').length, 'info'],
      ['Estimado', entries.filter(x=>x.situation==='Estimado').length, 'warn'],
      ['Não confirmado', entries.filter(x=>x.situation==='Não confirmado').length, 'neutral'],
      ['Pendente', entries.filter(x=>x.situation==='Pendente').length, 'warn'],
      ['Reembolsado', entries.filter(x=>x.situation==='Reembolsado').length, 'info']
    ];
    return `<section class="panel finance-status-panel"><div class="panel-head"><div><p class="eyebrow">ESTADO FINANCEIRO</p><h2>Confirmado × estimado × não confirmado</h2></div></div><div class="finance-status-grid">${groups.map(([label,count,tone])=>`<div class="finance-status-item ${tone}"><small>${esc(label)}</small><strong>${fmt(count)}</strong><span>lançamento(s)</span></div>`).join('')}</div><p class="method-note">Situação financeira e uso do recurso permanecem dimensões independentes. Cobrança não confirmada não entra nos totais.</p></section>`;
  }

  function investmentPerformanceGuardrailMarkup() {
    if (!dataReady()) return '';
    const cam = DATA.exams?.find(x=>x.name.includes('Câmara'));
    const camFinance = DATA.financeSummary?.byCycle?.find(x=>x.key.includes('Câmara'));
    const caldas = DATA.exams?.find(x=>x.name.includes('Caldas'));
    const validCam = cam?.rawAccuracy != null && camFinance?.confirmed != null;
    return `<section class="panel roi-guardrail"><div class="panel-head"><div><p class="eyebrow">INVESTIMENTO × DESEMPENHO</p><h2>Comparação metodologicamente controlada</h2></div><span class="method-badge caution">não é ROI financeiro</span></div><div class="guardrail-grid"><div class="guardrail-observation ${validCam?'valid':'blocked'}"><small>Câmara Municipal de Goiânia</small><strong>${validCam?`${money(camFinance.confirmed)} · ${pct(cam.rawAccuracy)}`:'dados insuficientes'}</strong><span>${validCam?'Há custo auditado e resultado real, mas um único ponto não permite inferir causalidade ou retorno por real investido.':'Sem par completo de dados.'}</span></div><div class="guardrail-observation blocked"><small>Caldas Novas 2016</small><strong>${esc(caldas?.financialStatus || 'Não auditável')}</strong><span>Sem memória financeira auditável; não é permitido imputar R$ 0,00 nem comparar investimento.</span></div><div class="guardrail-observation pending"><small>SEDES/DF 2026</small><strong>${money(DATA.metrics?.finance?.sedesConfirmed)}</strong><span>Investimento auditado, mas a prova ainda não possui resultado. Comparação de desempenho permanece bloqueada.</span></div></div></section>`;
  }

  function ensureFinanceParity() {
    if (location.hash !== '#finance' || !dataReady()) return;
    removeLegacyFinanceTable();
    const toolbox = $('.work-finance-toolbox');
    if (!toolbox || $('#financeParityCharts')) return;
    toolbox.insertAdjacentHTML('afterend', `<div id="financeParityCharts" class="finance-parity-grid">${investmentByCycleMarkup()}${financialStatusMarkup()}${investmentPerformanceGuardrailMarkup()}</div>`);
  }

  function realExamComparisonMarkup() {
    const exams = (dataReady()?.exams || []).filter(x => x.rawAccuracy != null);
    if (!exams.length) return '';
    return `<section class="panel real-exam-matrix"><div class="panel-head"><div><p class="eyebrow">COMPARAÇÃO ENTRE PROVAS REAIS</p><h2>Dimensões lado a lado, sem misturar universos</h2></div><span class="method-badge">descritivo</span></div><div class="exam-matrix-scroll"><table class="exam-matrix"><thead><tr><th>Indicador</th>${exams.map(e=>`<th>${esc(e.name)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Aproveitamento bruto</td>${exams.map(e=>`<td><strong>${pct(e.rawAccuracy)}</strong></td>`).join('')}</tr>
      <tr><td>Nota editalícia</td>${exams.map(e=>`<td>${esc(e.weightedScore || '—')}</td>`).join('')}</tr>
      <tr><td>Classificação</td>${exams.map(e=>`<td>${e.classification?`${fmt(e.classification)}º`:'—'}</td>`).join('')}</tr>
      <tr><td>Etapa da classificação</td>${exams.map(e=>`<td>${esc(e.classificationStage || '—')}</td>`).join('')}</tr>
      <tr><td>Classificados na etapa</td>${exams.map(e=>`<td>${e.stageClassified?fmt(e.stageClassified):'—'}</td>`).join('')}</tr>
      <tr><td>Concorrência oficial</td>${exams.map(e=>`<td>${e.competitionPerVacancy?`${String(e.competitionPerVacancy).replace('.',',')} / vaga`:'—'}</td>`).join('')}</tr>
      <tr><td>Vagas imediatas</td>${exams.map(e=>`<td>${e.immediateVacancies?fmt(e.immediateVacancies):'—'}</td>`).join('')}</tr>
      <tr><td>CR AC</td>${exams.map(e=>`<td>${e.reservePositionsAC?fmt(e.reservePositionsAC):'—'}</td>`).join('')}</tr>
      <tr><td>Status financeiro</td>${exams.map(e=>`<td>${esc(e.financialStatus || '—')}</td>`).join('')}</tr>
    </tbody></table></div><p class="method-note">Percentual bruto, nota ponderada e classificação são indicadores distintos. A tabela não cria uma métrica composta entre concursos diferentes.</p></section>`;
  }

  function competitionCardsMarkup() {
    const exams = (dataReady()?.exams || []).filter(x => x.rawAccuracy != null);
    return `<section class="competition-cards">${exams.map(e=>`<article class="competition-card"><div><p class="eyebrow">${esc(e.role)}</p><h3>${esc(e.name)}</h3></div><div class="competition-kpis"><span><small>Posição</small><strong>${e.classification?`${fmt(e.classification)}º`:'—'}</strong></span><span><small>Universo da etapa</small><strong>${e.stageClassified?fmt(e.stageClassified):'—'}</strong></span><span><small>Empatados na nota</small><strong>${e.sameScoreCandidates?fmt(e.sameScoreCandidates):'—'}</strong></span><span><small>Vagas</small><strong>${e.immediateVacancies?fmt(e.immediateVacancies):'—'}</strong></span></div><details><summary>Universo e ressalvas</summary><p>${esc(e.competitionUniverse || e.status || 'Sem observação adicional.')}</p></details></article>`).join('')}</section>`;
  }

  function ensureExamParity() {
    if (location.hash !== '#exams' || !dataReady()) return;
    const content = $('#content');
    if (!content || $('#examParityComparison')) return;
    const comparison = content.querySelector('.comparison-panel');
    if (!comparison) return;
    comparison.insertAdjacentHTML('afterend', `<div id="examParityComparison">${realExamComparisonMarkup()}${competitionCardsMarkup()}</div>`);
  }

  function auditChecks() {
    if (!dataReady()) return [];
    const m = DATA.metrics || {};
    const finance = DATA.financeSummary || {};
    const sedesOperational = Number(finance.sedes?.confirmed || 0);
    const sedesMetric = Number(m.finance?.sedesConfirmed || 0);
    const checks = [
      ['Histórico fecha em acertos + erros', Number(m.history?.questions) === Number(m.history?.hits) + Number(m.history?.errors)],
      ['Total bruto fecha em mensurável + sem resultado', Number(m.history?.rawRecords) === Number(m.history?.questions) + Number(m.history?.withoutResult)],
      ['TDAS preservado separadamente', Number(m.tdas?.questions) === Number(m.tdas?.hits) + Number(m.tdas?.errors)],
      ['EDAS preservado separadamente', Number(m.edas?.questions) === Number(m.edas?.hits) + Number(m.edas?.errors)],
      ['Financeiro SEDES reconciliado', Math.abs(sedesOperational - sedesMetric) < .01],
      ['Sincronização sem alerta', !(DATA.meta?.syncWarnings || []).length],
      ['Enriquecimento sem divergência', !(DATA.meta?.dataWarnings || []).length],
      ['Classificação sempre acompanhada de etapa', (DATA.exams||[]).filter(e=>e.classification).every(e=>Boolean(e.classificationStage))],
      ['SEDES ainda sem resultado inventado', (DATA.exams||[]).filter(e=>e.name.includes('SEDES')).every(e=>e.rawAccuracy == null)]
    ];
    return checks;
  }

  function ensureAuditHealth() {
    if (location.hash !== '#audit' || !dataReady()) return;
    const content = $('#content');
    if (!content || $('#parityAuditHealth')) return;
    const checks = auditChecks();
    const passed = checks.filter(([,ok])=>ok).length;
    const section = `<section class="panel parity-audit" id="parityAuditHealth"><div class="panel-head"><div><p class="eyebrow">AUDITORIA AUTOMÁTICA DE PARIDADE</p><h2>${passed}/${checks.length} verificações aprovadas</h2></div><span class="audit-health ${passed===checks.length?'ok':'alert'}">${passed===checks.length?'● reconciliado':'● revisar'}</span></div><div class="audit-check-grid">${checks.map(([label,ok])=>`<div class="audit-check ${ok?'ok':'bad'}"><span>${ok?'✓':'!'}</span><strong>${esc(label)}</strong></div>`).join('')}</div><div class="audit-meta"><span><b>Fonte:</b> ${esc(DATA.meta?.source || 'Notion vivo')}</span><span><b>Corte desempenho:</b> ${esc(DATA.meta?.performanceCut || '—')}</span><span><b>Enriquecido:</b> ${DATA.meta?.workParityEnrichedAt ? new Date(DATA.meta.workParityEnrichedAt).toLocaleString('pt-BR') : '—'}</span></div></section>`;
    const title = content.querySelector('.section-title');
    title?.insertAdjacentHTML('afterend', section);
  }

  function ensureGlobalViewToggle() {
    const strip = $('.status-strip .status-meta');
    if (!strip || $('#globalViewToggle')) return;
    const mode = localStorage.getItem('plano.global.mode') || 'resumo';
    strip.insertAdjacentHTML('afterbegin', `<div class="global-view-toggle" id="globalViewToggle"><button type="button" data-global-mode="resumo" class="${mode==='resumo'?'active':''}">Resumo</button><button type="button" data-global-mode="auditoria" class="${mode==='auditoria'?'active':''}">Auditoria</button></div><span class="sep">•</span>`);
    applyGlobalMode(mode);
    $$('[data-global-mode]').forEach(button => button.addEventListener('click', () => {
      localStorage.setItem('plano.global.mode', button.dataset.globalMode);
      applyGlobalMode(button.dataset.globalMode);
    }));
  }

  function applyGlobalMode(mode) {
    document.documentElement.dataset.viewMode = mode;
    $$('[data-global-mode]').forEach(button => button.classList.toggle('active', button.dataset.globalMode === mode));
    if (mode === 'auditoria') {
      $$('#content details').forEach(details => { if (!details.closest('.work-ledger-row')) details.open = true; });
    }
  }

  function enhance() {
    ensureGlobalViewToggle();
    ensureWorkspace();
    ensureFinanceParity();
    ensureExamParity();
    ensureAuditHealth();
  }

  document.addEventListener('click', interceptStudyLinks, true);
  document.addEventListener('DOMContentLoaded', () => {
    ensureGlobalViewToggle();
    const content = $('#content');
    if (content) new MutationObserver(() => requestAnimationFrame(enhance)).observe(content, {childList:true, subtree:false});
    window.addEventListener('hashchange', () => setTimeout(enhance, 60));
    setTimeout(enhance, 250);
  });
})();
