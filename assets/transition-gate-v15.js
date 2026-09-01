const VERSION = 15;
const STATE_KEY = 'plano.transitionGate.v15';
const $ = (selector, root = document) => root?.querySelector?.(selector) ?? null;
const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];

let snapshot = null;
let snapshotPromise = null;
let queued = false;
let rendering = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    return {
      version: VERSION,
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter(Number.isInteger) : [],
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { version: VERSION, completed: [], updatedAt: null };
  }
}

function writeState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    version: VERSION,
    completed: [...new Set(state.completed)].sort((a, b) => a - b),
    updatedAt: new Date().toISOString(),
  }));
}

async function getSnapshot(force = false) {
  if (force) snapshot = null;
  if (snapshot) return snapshot;
  if (!snapshotPromise) {
    snapshotPromise = fetch(`data/snapshot.json?transitionGate=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => (snapshot = data))
      .catch(() => null)
      .finally(() => { snapshotPromise = null; });
  }
  return snapshotPromise;
}

function model(data) {
  const gates = (data?.strategy?.postExamGates || []).filter((item) => typeof item === 'string' && item.trim());
  const examAt = new Date(data?.meta?.nextExam || '2026-09-06T08:00:00-03:00').getTime();
  const now = Date.now();
  const active = now >= examAt;
  const days = Math.max(0, Math.ceil((examAt - now) / 86_400_000));
  const state = readState();
  const completed = state.completed.filter((index) => index >= 0 && index < gates.length);
  const finished = gates.length > 0 && completed.length === gates.length;
  const sedesExam = (data?.exams || []).find((exam) => String(exam.name || '').includes('SEDES'));
  const resultRegistered = sedesExam?.rawAccuracy != null;
  const snapshotAfterExam = new Date(data?.meta?.generatedAt || 0).getTime() >= examAt;
  const financeClosed = /fechado/i.test(String(data?.metrics?.finance?.status || ''));
  return {
    data, gates, examAt, active, days, state, completed, finished,
    progress: gates.length ? Math.round(completed.length / gates.length * 100) : 0,
    resultRegistered, snapshotAfterExam, financeClosed,
  };
}

function phaseCopy(view) {
  if (view.finished) return { label: 'Ciclo fechado', tone: 'done', detail: 'Checklist gerencial concluído neste navegador.' };
  if (view.active) return { label: 'Fechamento ativo', tone: 'active', detail: `${view.completed.length}/${view.gates.length} etapas registradas localmente.` };
  return { label: 'Fechamento preparado', tone: 'scheduled', detail: `Ativa após a prova · D-${view.days}.` };
}

function signal(label, ok, pending, detail) {
  return `<article class="v15-signal ${ok ? 'ok' : 'pending'}"><span>${ok ? '✓' : '○'}</span><div><small>${esc(label)}</small><strong>${esc(ok ? detail : pending)}</strong></div></article>`;
}

function sourceLabel(data) {
  const source = data?.strategy?.postExamSource;
  if (!source) return 'Snapshot tratado';
  return source.status === 'treated-live' ? 'Notion tratado ao vivo' : 'Notion tratado';
}

function strategyPanel(view) {
  const source = view.data.strategy?.postExamSource || {};
  const phase = phaseCopy(view);
  const disabled = view.active ? '' : ' disabled aria-disabled="true"';
  return `
    <section id="transitionGateV15" class="v15-transition-panel panel" data-v15-phase="${phase.tone}">
      <div class="v15-panel-head">
        <div><span class="eyebrow">FECHAMENTO DO CICLO · V15</span><h2>Transformar a prova em decisão rastreável.</h2><p>O gatilho pós-SEDES/DF vem da página 04 do Notion e só publica os passos gerenciais tratados.</p></div>
        <span class="v15-phase ${phase.tone}"><i></i><b>${esc(phase.label)}</b><small>${esc(phase.detail)}</small></span>
      </div>
      <div class="v15-source-line"><span>${esc(sourceLabel(view.data))}</span><i>•</i><span>${esc(source.page || '04 — Estratégia de Carreira')}</span><i>•</i><span>snapshot sem espelho bruto</span></div>
      <div class="v15-evidence-grid">
        ${signal('Prova real', view.resultRegistered, view.active ? 'Resultado ainda não publicado' : 'Aguardando a prova', 'Resultado registrado')}
        ${signal('Snapshot final', view.snapshotAfterExam, view.active ? 'Corte pós-prova pendente' : 'Será exigido após a prova', 'Corte posterior à prova')}
        ${signal('Ciclo financeiro', view.financeClosed, `Status ${view.data.metrics?.finance?.status || 'parcial'}`, 'Financeiro fechado')}
      </div>
      <div class="v15-progress-row"><div><span>Progresso local</span><strong>${view.completed.length}/${view.gates.length}</strong></div><div class="v15-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${view.progress}"><i style="width:${view.progress}%"></i></div></div>
      <div class="v15-gate-list">
        ${view.gates.map((gate, index) => {
          const done = view.completed.includes(index);
          return `<button type="button" class="v15-gate ${done ? 'done' : ''}" data-v15-step="${index}" aria-pressed="${done}"${disabled}><span class="v15-gate-number">${String(index + 1).padStart(2, '0')}</span><span class="v15-gate-copy"><strong>${esc(gate)}</strong><small>${view.active ? (done ? 'Registrado localmente' : 'Pendente de decisão') : 'Disponível após o marco da prova'}</small></span><span class="v15-gate-check">${done ? '✓' : '→'}</span></button>`;
        }).join('')}
      </div>
      <div class="v15-panel-foot">
        <p>O checklist fica somente neste navegador, não altera o Notion e não transforma planejamento em evidência oficial.</p>
        <div>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">Abrir estratégia no Notion</a>` : ''}<button type="button" data-v15-export>Exportar fechamento</button></div>
      </div>
    </section>`;
}

function renderStrategy(view) {
  const root = $('.strategy-view');
  if (!root || !view.gates.length) return;
  let host = $('#transitionGateV15Host', root);
  const signature = JSON.stringify([view.data.meta?.generatedAt, view.active, view.completed, view.gates, view.resultRegistered, view.snapshotAfterExam, view.financeClosed]);
  if (!host) {
    host = document.createElement('div');
    host.id = 'transitionGateV15Host';
    const anchor = $('.strategy-hero', root) || root.firstElementChild;
    anchor?.after(host);
  }
  if (host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.innerHTML = strategyPanel(view);
}

function renderSummary(view) {
  const root = $('.command-view');
  if (!root || !view.gates.length) return;
  let summary = $('#v15TransitionSummary', root);
  const phase = phaseCopy(view);
  const nextIndex = view.gates.findIndex((_, index) => !view.completed.includes(index));
  const next = nextIndex >= 0 ? view.gates[nextIndex] : 'Fechamento concluído neste navegador.';
  const signature = JSON.stringify([view.data.meta?.generatedAt, phase.tone, view.completed, next]);
  if (!summary) {
    summary = document.createElement('section');
    summary.id = 'v15TransitionSummary';
    summary.className = 'v15-transition-summary panel';
    const anchor = $('#v14FocusControl', root) || $('#managerNowBoard', root) || $('#v13ManagerInbox', root) || root.firstElementChild;
    anchor?.after(summary);
  }
  if (summary.dataset.signature === signature) return;
  summary.dataset.signature = signature;
  summary.innerHTML = `
    <span class="v15-summary-mark ${phase.tone}">15</span>
    <div><span class="eyebrow">PRÓXIMA TRANSIÇÃO</span><strong>${esc(phase.label)}</strong><p>${esc(next)}</p></div>
    <div class="v15-summary-progress"><b>${view.completed.length}/${view.gates.length}</b><small>${view.active ? 'etapas' : `ativa em ${view.days}d`}</small></div>
    <button type="button" data-view="strategy" data-v15-open>Ver fechamento <span>→</span></button>`;
}

function renderOperations(view) {
  const sheet = $('#moreSheet');
  const anchor = $('#v14FocusOps', sheet) || $('#v13InboxOps', sheet);
  if (!sheet || !anchor || !view.gates.length) return;
  let section = $('#v15TransitionOps', sheet);
  const phase = phaseCopy(view);
  const signature = `${phase.tone}:${view.completed.length}:${view.gates.length}:${view.days}`;
  if (!section) {
    section = document.createElement('div');
    section.id = 'v15TransitionOps';
    section.className = 'v15-transition-ops';
    anchor.after(section);
  }
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  section.innerHTML = `<div class="sheet-section-label">Fechamento do ciclo</div><button type="button" class="action-button" data-view="strategy" data-v15-open><span>15</span><span><b>${esc(phase.label)}</b><small>${view.completed.length}/${view.gates.length} etapas · ${esc(sourceLabel(view.data))}</small></span></button>`;
}

function exportCloseout(view) {
  const payload = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    storage: 'localStorage',
    officialSource: view.data.strategy?.postExamSource || null,
    snapshotGeneratedAt: view.data.meta?.generatedAt || null,
    examAt: new Date(view.examAt).toISOString(),
    phase: phaseCopy(view).label,
    gates: view.gates.map((text, index) => ({ index: index + 1, text, completedLocally: view.completed.includes(index) })),
    evidence: {
      resultRegistered: view.resultRegistered,
      snapshotAfterExam: view.snapshotAfterExam,
      financeClosed: view.financeClosed,
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fechamento-ciclo-sedes-v15.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderAll(force = false) {
  if (rendering) return;
  rendering = true;
  try {
    const data = await getSnapshot(force);
    if (!data) return;
    const view = model(data);
    renderSummary(view);
    renderStrategy(view);
    renderOperations(view);
  } finally {
    rendering = false;
  }
}

function schedule(force = false) {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    renderAll(force);
  });
}

document.addEventListener('click', async (event) => {
  const step = event.target.closest?.('[data-v15-step]');
  if (step && !step.disabled) {
    const index = Number(step.dataset.v15Step);
    const state = readState();
    state.completed = state.completed.includes(index) ? state.completed.filter((item) => item !== index) : [...state.completed, index];
    writeState(state);
    schedule();
    return;
  }
  if (event.target.closest?.('[data-v15-export]')) {
    const data = await getSnapshot();
    if (data) exportCloseout(model(data));
    return;
  }
  if (event.target.closest?.('[data-v15-open]')) {
    window.setTimeout(() => $('#transitionGateV15')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return;
  }
  if (event.target.closest?.('[data-refresh]')) {
    window.setTimeout(() => schedule(true), 500);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === STATE_KEY) schedule();
});
window.addEventListener('hashchange', () => schedule());

const observer = new MutationObserver(() => schedule());
observer.observe(document.body, { childList: true, subtree: true });
window.setInterval(() => schedule(), 60_000);
schedule();
