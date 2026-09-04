const VIEW_CLASSES = ['command','performance','journey','exams','finance','strategy','sources','operations','exam-day'];

function currentWorkspaceView() {
  if (location.hash === '#exam-day' || document.querySelector('[data-exam-day-tab].active')) return 'exam-day';
  const active = document.querySelector('#mainTabs [data-view].active') || document.querySelector('.mobile-dock [data-view].active');
  return active?.dataset?.view || 'command';
}

function syncWorkspaceView() {
  const view = currentWorkspaceView();
  VIEW_CLASSES.forEach(name => document.body.classList.remove(`v23-view-${name}`));
  document.body.classList.add(`v23-view-${view}`, 'workspace-v23');
  document.documentElement.dataset.workspaceView = view;

  const rail = document.querySelector('.tab-rail');
  if (rail) rail.setAttribute('data-current-view', view);

  // Em páginas internas, o título da própria view já fornece contexto; a missão global fica exclusiva da Home.
  const mission = document.querySelector('.mission-strip');
  if (mission) mission.setAttribute('aria-hidden', view === 'command' ? 'false' : 'true');
}

function enhanceWorkspaceSemantics() {
  const rail = document.querySelector('.tab-rail');
  if (rail) {
    rail.setAttribute('aria-label', 'Navegação principal do workspace');
    rail.classList.add('workspace-rail');
  }

  const tabs = document.getElementById('mainTabs');
  if (tabs) tabs.setAttribute('aria-label', 'Áreas do plano');

  const sheet = document.getElementById('moreSheet');
  if (sheet) sheet.setAttribute('aria-label', 'Ferramentas e operações');

  document.body.dataset.workspaceVersion = '23';
}

function watchNavigation() {
  const roots = [document.getElementById('mainTabs'), document.getElementById('mobileDock')].filter(Boolean);
  const observer = new MutationObserver(() => queueMicrotask(syncWorkspaceView));
  roots.forEach(root => observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] }));

  document.addEventListener('click', event => {
    if (event.target.closest('[data-view],[data-exam-day-tab]')) window.setTimeout(syncWorkspaceView, 0);
  });
  window.addEventListener('hashchange', syncWorkspaceView);
  window.addEventListener('popstate', syncWorkspaceView);
}

function initWorkspaceV23() {
  enhanceWorkspaceSemantics();
  syncWorkspaceView();
  watchNavigation();
  window.requestAnimationFrame(() => document.body.classList.add('workspace-v23-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWorkspaceV23, { once: true });
else initWorkspaceV23();
