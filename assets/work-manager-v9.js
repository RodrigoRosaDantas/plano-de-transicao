const icons = {
  dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/>',
  chart: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
  flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/>',
  wallet: '<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M15 11h7v4h-7a2 2 0 0 1 0-4Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  spark: '<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
};

const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.spark}</svg>`;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function safeScroll(selector) {
  const target = $(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function managerizeShell() {
  if (location.hash === '#study' || location.hash === '#tools') {
    location.hash = '#command';
    return;
  }

  const localStatus = $('#localStudyStatus');
  setText(localStatus, 'central gerencial');

  const stateText = $('#syncState strong')?.textContent?.trim() || 'Dados publicados';
  const updatedText = $('#snapshotDate')?.textContent?.trim() || 'Snapshot carregado';
  setText($('#managerOpsState'), stateText);
  setText($('#managerOpsUpdated'), updatedText ? `Último snapshot: ${updatedText}` : 'Snapshot carregado');

  const refresh = $('#refreshBtn');
  if (refresh && !refresh.dataset.managerReady) {
    refresh.dataset.managerReady = 'true';
    refresh.setAttribute('aria-label', 'Atualizar dados publicados');
    refresh.setAttribute('title', 'Atualizar dados publicados');
  }
}

function managerizeCommand() {
  const view = $('.command-view');
  if (!view) return;

  if (!$('.manager-quick-grid', view)) {
    const anchor = $('.command-grid', view) || $('.priority-grid', view);
    if (anchor) {
      const quick = document.createElement('section');
      quick.className = 'manager-quick-grid';
      quick.setAttribute('aria-label', 'Acessos gerenciais rápidos');
      quick.innerHTML = `
        <button type="button" data-view="performance"><span>${icon('chart')}</span><div><small>Desempenho</small><strong>Visão geral + por matéria</strong></div><b>→</b></button>
        <button type="button" data-view="exams"><span>${icon('flag')}</span><div><small>Concursos</small><strong>Provas, nota e classificação</strong></div><b>→</b></button>
        <button type="button" data-view="journey"><span>${icon('route')}</span><div><small>Jornada</small><strong>Marcos da transição</strong></div><b>→</b></button>
        <button type="button" data-view="finance"><span>${icon('wallet')}</span><div><small>Investimentos</small><strong>Custos e ciclos</strong></div><b>→</b></button>`;
      anchor.before(quick);
    }
  }
}

function managerizePerformance() {
  const view = $('.performance-view');
  if (!view) return;

  if (!$('.manager-performance-nav', view)) {
    const heading = $('.view-heading', view);
    if (heading) {
      const nav = document.createElement('nav');
      nav.className = 'manager-performance-nav panel';
      nav.setAttribute('aria-label', 'Navegação do desempenho');
      nav.innerHTML = `
        <button class="active" type="button" data-manager-performance="overview"><span>${icon('dashboard')}</span><b>Visão geral</b><small>Consolidado completo</small></button>
        <button type="button" data-manager-performance="subjects"><span>${icon('target')}</span><b>Por matéria</b><small>Disciplina por disciplina</small></button>
        <button type="button" data-manager-performance="evolution"><span>${icon('chart')}</span><b>Evolução</b><small>Ciclos e tendência</small></button>
        <button type="button" data-manager-performance="activities"><span>${icon('spark')}</span><b>Atividades</b><small>Revisões e blocos</small></button>
        <button type="button" data-manager-performance="compare"><span>${icon('database')}</span><b>Comparar</b><small>Histórico, TDAS e EDAS</small></button>`;
      heading.after(nav);
    }
  }

  const toolbar = $('.performance-toolbar', view);
  if (toolbar && !toolbar.dataset.managerHint) {
    toolbar.dataset.managerHint = 'true';
    toolbar.insertAdjacentHTML('afterbegin', '<div class="manager-toolbar-title"><span>CONTROLES DO PAINEL</span><strong>As opções continuam disponíveis em qualquer leitura.</strong></div>');
  }

  const subjectPanel = $('.subject-panel', view);
  if (subjectPanel) subjectPanel.id = 'performanceBySubject';
  const charts = $('.performance-chart-grid', view);
  if (charts) charts.id = 'performanceEvolution';
}

function managerizeCurrentView() {
  managerizeShell();
  managerizeCommand();
  managerizePerformance();
}

function setPerformanceNavActive(action) {
  $$('.manager-performance-nav button').forEach((button) => button.classList.toggle('active', button.dataset.managerPerformance === action));
}

function handlePerformanceAction(action) {
  setPerformanceNavActive(action);
  if (action === 'overview') {
    safeScroll('.performance-view .view-heading');
    return;
  }
  if (action === 'subjects') {
    const grain = $('[data-performance-grain="subject"]');
    if (grain && !grain.classList.contains('active')) grain.click();
    setTimeout(() => safeScroll('#performanceBySubject'), 80);
    return;
  }
  if (action === 'evolution') {
    safeScroll('#performanceEvolution');
    return;
  }
  if (action === 'activities') {
    const grain = $('[data-performance-grain="activity"]');
    if (grain && !grain.classList.contains('active')) grain.click();
    setTimeout(() => safeScroll('#performanceBySubject'), 80);
    return;
  }
  if (action === 'compare') {
    const toolbar = $('.performance-toolbar');
    toolbar?.classList.add('manager-highlight');
    safeScroll('.performance-toolbar');
    window.setTimeout(() => toolbar?.classList.remove('manager-highlight'), 1600);
  }
}

function bindManagerActions() {
  document.addEventListener('click', (event) => {
    const performanceAction = event.target.closest('[data-manager-performance]');
    if (performanceAction) {
      event.preventDefault();
      handlePerformanceAction(performanceAction.dataset.managerPerformance);
      return;
    }

    if (event.target.closest('#managerRefreshBtn')) {
      event.preventDefault();
      $('#refreshBtn')?.click();
      return;
    }

    if (event.target.closest('#managerThemeBtn')) {
      event.preventDefault();
      $('#themeBtn')?.click();
    }
  });
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    managerizeCurrentView();
  });
});

bindManagerActions();
managerizeCurrentView();
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', managerizeCurrentView);
window.addEventListener('online', managerizeShell);
window.addEventListener('offline', managerizeShell);
