const DECISION_KEY = 'plano.decisions.v11';

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DECISION_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStatus(id, status) {
  const state = readState();
  state[id] = { status, updatedAt: new Date().toISOString() };
  localStorage.setItem(DECISION_KEY, JSON.stringify(state));
}

function statusText(status) {
  return status === 'adopted' ? 'Adotada' : status === 'dismissed' ? 'Descartada' : 'Aberta';
}

function makeButton(label, status, id, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.v11DecisionStatus = status;
  button.dataset.v11DecisionId = id;
  if (className) button.className = className;
  return button;
}

function applyCard(card, id, status) {
  if (!card) return;
  const current = card.classList.contains('adopted') ? 'adopted' : card.classList.contains('dismissed') ? 'dismissed' : 'open';
  const label = card.querySelector('.v11-decision-status');
  const needsState = current !== status || label?.textContent?.trim() !== statusText(status);
  if (needsState) {
    card.classList.remove('open', 'adopted', 'dismissed');
    card.classList.add(status);
    if (label) label.textContent = statusText(status);
  }

  const actions = card.querySelector('.v11-decision-actions');
  if (!actions) return;
  const statusButtons = [...actions.querySelectorAll('[data-v11-decision-status]')];
  const expected = status === 'open' ? ['adopted', 'dismissed'] : ['open'];
  const actual = statusButtons.map((node) => node.dataset.v11DecisionStatus);
  if (actual.length === expected.length && actual.every((value, index) => value === expected[index])) return;

  statusButtons.forEach((node) => node.remove());
  const firstNonStatus = actions.firstElementChild;
  if (status === 'open') {
    const adopt = makeButton('✓ Adotar', 'adopted', id, 'v11-adopt');
    const dismiss = makeButton('× Descartar', 'dismissed', id);
    actions.insertBefore(adopt, firstNonStatus);
    actions.insertBefore(dismiss, firstNonStatus);
  } else {
    actions.insertBefore(makeButton('↻ Reabrir', 'open', id), firstNonStatus);
  }
}

function collapseDuplicateCenters() {
  const centers = [...document.querySelectorAll('#v11DecisionCenter')];
  if (centers.length <= 1) return centers[0] || null;
  const keeper = centers[0];
  centers.slice(1).forEach((node) => node.remove());
  return keeper;
}

function updateCounts(center = document.querySelector('#v11DecisionCenter')) {
  if (!center) return;
  const cards = [...center.querySelectorAll('.v11-decision-card')];
  const counts = {
    open: cards.filter((card) => card.classList.contains('open')).length,
    adopted: cards.filter((card) => card.classList.contains('adopted')).length,
    dismissed: cards.filter((card) => card.classList.contains('dismissed')).length,
  };
  const kpis = center.querySelectorAll('.v11-decision-kpis span b');
  if (kpis[0]) kpis[0].textContent = String(counts.open);
  if (kpis[1]) kpis[1].textContent = String(counts.adopted);
  if (kpis[2]) kpis[2].textContent = String(counts.dismissed);
  const health = document.querySelector('#v11DecisionHealth');
  if (health) health.textContent = `${counts.adopted} adotadas · ${counts.open} abertas · ${counts.dismissed} descartadas`;
}

function reconcile() {
  const center = collapseDuplicateCenters();
  if (!center) return;
  const state = readState();
  center.querySelectorAll('.v11-decision-card[data-decision-id]').forEach((card) => {
    const id = card.dataset.decisionId;
    const status = state[id]?.status || 'open';
    applyCard(card, id, status);
  });
  updateCounts(center);
}

let reconciliationQueued = false;
function queueReconcile() {
  if (reconciliationQueued) return;
  reconciliationQueued = true;
  requestAnimationFrame(() => {
    reconciliationQueued = false;
    reconcile();
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-v11-decision-status]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const id = button.dataset.v11DecisionId;
  const status = button.dataset.v11DecisionStatus;
  if (!id || !['open', 'adopted', 'dismissed'].includes(status)) return;
  writeStatus(id, status);
  document.querySelectorAll('.v11-decision-card[data-decision-id]').forEach((card) => {
    if (card.dataset.decisionId === id) applyCard(card, id, status);
  });
  collapseDuplicateCenters();
  updateCounts();
  queueReconcile();
}, true);

const observer = new MutationObserver(queueReconcile);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', (event) => { if (event.key === DECISION_KEY) queueReconcile(); });
window.addEventListener('hashchange', queueReconcile);
queueReconcile();
