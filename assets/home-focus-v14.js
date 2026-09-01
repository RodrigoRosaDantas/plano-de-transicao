const VERSION = 14;
const MODE_KEY = 'plano.homeMode.v14';
const $ = (selector, root = document) => root?.querySelector?.(selector) ?? null;
const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];

let queued = false;
let mutationQueued = false;

function defaultMode() {
  return window.matchMedia('(max-width: 980px)').matches ? 'focus' : 'expanded';
}

function readMode() {
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'focus' || saved === 'expanded' ? saved : defaultMode();
}

function writeMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
}

function isDeepTarget(target) {
  if (!target) return false;
  return [
    '#managerExamToday',
    '#v11DecisionCenter',
    '#v11AlertRadar',
    '#v11WeeklyHorizon',
    '#v12DecisionHistory',
  ].some((selector) => target.matches?.(selector) || target.closest?.(selector));
}

function counts() {
  const openDecisions = $$('#v11DecisionCenter .v11-decision-card .v11-decision-status')
    .filter((node) => node.textContent?.toLocaleLowerCase('pt-BR').includes('aberta')).length;
  const alerts = $$('#v11AlertRadar .v11-alert').filter((node) => !node.classList.contains('good')).length;
  const adopted = $$('#v11DecisionCenter .v11-decision-card .v11-decision-status')
    .filter((node) => node.textContent?.toLocaleLowerCase('pt-BR').includes('adotada')).length;
  const history = $$('#v12DecisionHistory .v12-event').length;
  return { openDecisions, alerts, adopted, history };
}

function summaryText(data) {
  const parts = [];
  parts.push(`${data.openDecisions} ${data.openDecisions === 1 ? 'decisão aberta' : 'decisões abertas'}`);
  parts.push(`${data.alerts} ${data.alerts === 1 ? 'alerta' : 'alertas'}`);
  parts.push(`${data.adopted} ${data.adopted === 1 ? 'adotada' : 'adotadas'}`);
  if (data.history) parts.push(`${data.history} movimentos no histórico`);
  return parts.join(' · ');
}

function ensureFocusControl(view) {
  if (!view) return null;
  let control = $('#v14FocusControl', view);
  if (control) return control;

  control = document.createElement('section');
  control.id = 'v14FocusControl';
  control.className = 'v14-focus-control panel';
  const inbox = $('#v13ManagerInbox', view);
  const now = $('#managerNowBoard', view);
  const anchor = inbox || now || $('.manager-quick-grid', view) || view.firstElementChild;
  if (anchor?.nextSibling) view.insertBefore(control, anchor.nextSibling);
  else view.appendChild(control);
  return control;
}

function renderControl(view, mode) {
  const control = ensureFocusControl(view);
  if (!control) return;
  const data = counts();
  const signature = `${mode}:${data.openDecisions}:${data.alerts}:${data.adopted}:${data.history}`;
  if (control.dataset.signature === signature) return;
  control.dataset.signature = signature;
  const focused = mode === 'focus';
  control.innerHTML = `
    <div class="v14-focus-copy">
      <span class="eyebrow">MODO FOCO · V14</span>
      <strong>${focused ? 'Contexto profundo recolhido.' : 'Contexto completo visível.'}</strong>
      <small>${summaryText(data)}</small>
    </div>
    <div class="v14-focus-actions">
      <span class="v14-mode-pill ${focused ? 'focus' : 'expanded'}">${focused ? 'Foco' : 'Completo'}</span>
      <button id="v14ToggleMode" type="button">${focused ? 'Expandir contexto' : 'Recolher contexto'}</button>
    </div>`;
}

function applyMode(mode, persist = true) {
  const view = $('.command-view');
  if (!view) return;
  if (persist) writeMode(mode);
  view.dataset.v14Mode = mode;
  view.classList.toggle('v14-home-focus', mode === 'focus');
  view.classList.toggle('v14-home-expanded', mode === 'expanded');
  renderControl(view, mode);
  renderOps(mode);
}

function toggleMode() {
  applyMode(readMode() === 'focus' ? 'expanded' : 'focus');
}

function ensureDeepContextClasses(view) {
  if (!view) return;
  const targets = [
    ['#managerExamToday', 'exam'],
    ['#v11DecisionCenter', 'decisions'],
    ['#v11AlertRadar', 'alerts'],
    ['#v11WeeklyHorizon', 'week'],
    ['#v12DecisionHistory', 'history'],
  ];
  targets.forEach(([selector, name]) => {
    const node = $(selector, view);
    if (!node) return;
    node.classList.add('v14-deep-context');
    node.dataset.v14Context = name;
  });
}

function renderOps(mode = readMode()) {
  const moreSheet = $('#moreSheet');
  const anchor = $('#v13InboxOps', moreSheet) || $('#v12DecisionJournalOps', moreSheet) || $('#v11DecisionOps', moreSheet);
  if (!moreSheet || !anchor) return;
  let section = $('#v14FocusOps', moreSheet);
  if (!section) {
    section = document.createElement('div');
    section.id = 'v14FocusOps';
    section.className = 'v14-focus-ops';
    anchor.after(section);
  }
  const data = counts();
  const signature = `${mode}:${data.openDecisions}:${data.alerts}:${data.adopted}`;
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  section.innerHTML = `
    <div class="sheet-section-label">Modo da Home</div>
    <div class="v14-ops-summary">
      <span>V14</span>
      <div><small>${mode === 'focus' ? 'Modo foco ativo' : 'Modo completo ativo'}</small><strong>${summaryText(data)}</strong></div>
    </div>
    <button id="v14ToggleModeOps" class="action-button" type="button"><span>${mode === 'focus' ? '↗' : '↙'}</span><span><b>${mode === 'focus' ? 'Expandir contexto' : 'Ativar modo foco'}</b><small>${mode === 'focus' ? 'Mostrar decisões, alertas, semana e memória na Home' : 'Recolher contexto profundo e priorizar atenção + resumo'}</small></span></button>`;
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const view = $('.command-view');
    if (view) {
      ensureDeepContextClasses(view);
      applyMode(readMode(), false);
    }
    if ($('#moreSheet')) renderOps();
  });
}

function expandBeforeDeepNavigation(event) {
  const scroll = event.target.closest?.('[data-v11-scroll]');
  if (scroll) {
    const target = $(scroll.dataset.v11Scroll);
    if (isDeepTarget(target) && readMode() === 'focus') applyMode('expanded');
    return;
  }

  const inboxAction = event.target.closest?.('[data-v13-open]');
  if (inboxAction) {
    const item = inboxAction.closest('[data-v13-item-id]');
    const id = item?.dataset.v13ItemId || '';
    if ((id.startsWith('decision:') || id.startsWith('review:') || id.startsWith('alert:')) && readMode() === 'focus') applyMode('expanded');
    return;
  }

  if (event.target.closest?.('#v12OpenHistory') && readMode() === 'focus') applyMode('expanded');
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#v14ToggleMode') || event.target.closest?.('#v14ToggleModeOps')) {
      event.preventDefault();
      toggleMode();
      return;
    }
  });

  document.addEventListener('click', expandBeforeDeepNavigation, true);

  window.addEventListener('storage', (event) => {
    if (event.key === MODE_KEY) schedule();
  });

  window.addEventListener('hashchange', () => {
    if (location.hash !== '#command') return;
    schedule();
  });
}

function observe() {
  const observer = new MutationObserver(() => {
    if (mutationQueued) return;
    mutationQueued = true;
    window.setTimeout(() => {
      mutationQueued = false;
      schedule();
    }, 90);
  });
  observer.observe(document.body, { subtree: true, childList: true });
}

bindEvents();
observe();
schedule();
