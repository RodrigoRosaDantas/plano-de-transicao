const DECISION_KEY = 'plano.decisions.v11';

function readState() {
  try { return JSON.parse(localStorage.getItem(DECISION_KEY) || '{}') || {}; }
  catch { return {}; }
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
  card.classList.remove('open', 'adopted', 'dismissed');
  card.classList.add(status);
  const label = card.querySelector('.v11-decision-status');
  if (label) label.textContent = statusText(status);
  const actions = card.querySelector('.v11-decision-actions');
  if (!actions) return;
  actions.querySelectorAll('[data-v11-decision-status]').forEach((node) => node.remove());
  const firstNonStatus = actions.firstElementChild;
  if (status === 'open') {
    const adopt = makeButton('✓ Adotar', 'adopted', id, 'v11-adopt');
    const dismiss = makeButton('× Descartar', 'dismissed', id);
    actions.insertBefore(dismiss, firstNonStatus);
    actions.insertBefore(adopt, dismiss);
  } else {
    const reopen = makeButton('↻ Reabrir', 'open', id);
    actions.insertBefore(reopen, firstNonStatus);
  }
}

function updateCounts() {
  const center = document.querySelector('#v11DecisionCenter');
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

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-v11-decision-status]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const id = button.dataset.v11DecisionId;
  const status = button.dataset.v11DecisionStatus;
  if (!id || !['open', 'adopted', 'dismissed'].includes(status)) return;
  writeStatus(id, status);
  applyCard(button.closest('.v11-decision-card'), id, status);
  updateCounts();
}, true);
