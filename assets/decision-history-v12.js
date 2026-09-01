import { treatedTopicalSeed } from '../data/treated-performance-data.js';

const DECISION_KEY = 'plano.decisions.v11';
const JOURNAL_KEY = 'plano.decisionJournal.v12';
const FILTER_KEY = 'plano.decisionJournal.filter.v12';
const VERSION = 12;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const pct = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const nowIso = () => new Date().toISOString();

let snapshotCache = null;
let snapshotPromise = null;
let syncRunning = false;
let renderScheduled = false;
let activeDecisionId = null;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readDecisionState() {
  const state = readJson(DECISION_KEY, {});
  return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
}

function emptyJournal() {
  return { version: VERSION, events: [], notes: {}, reviews: {}, lastSeen: {} };
}

function readJournal() {
  const raw = readJson(JOURNAL_KEY, emptyJournal());
  return {
    version: VERSION,
    events: Array.isArray(raw?.events) ? raw.events : [],
    notes: raw?.notes && typeof raw.notes === 'object' ? raw.notes : {},
    reviews: raw?.reviews && typeof raw.reviews === 'object' ? raw.reviews : {},
    lastSeen: raw?.lastSeen && typeof raw.lastSeen === 'object' ? raw.lastSeen : {},
  };
}

function writeJournal(journal) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify({ ...journal, version: VERSION }));
}

async function getSnapshot(force = false) {
  if (force) snapshotCache = null;
  if (snapshotCache) return snapshotCache;
  if (!snapshotPromise) {
    snapshotPromise = fetch(`data/snapshot.json?v12=${Date.now()}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => (snapshotCache = value))
      .catch(() => null)
      .finally(() => { snapshotPromise = null; });
  }
  return snapshotPromise;
}

function friendlyMeta(id) {
  if (id.startsWith('tdas:')) return { scope: 'TDAS 202', title: id.slice(5), evidence: 'Base tratada · matéria isolada' };
  if (id.startsWith('edas:')) return { scope: 'EDAS 400', title: id.slice(5), evidence: 'Base tratada · matéria isolada' };
  if (id === 'finance:partial') return { scope: 'Investimentos', title: 'Manter o financeiro como leitura parcial', evidence: 'metrics.finance.status' };
  if (id === 'data:refresh') return { scope: 'Dados', title: 'Atualizar o snapshot antes de nova decisão', evidence: 'meta.generatedAt' };
  if (id === 'exam:final-window') return { scope: 'Reta final', title: 'Decisão da janela final', evidence: 'Próximo marco do projeto' };
  return { scope: 'Plano', title: id, evidence: 'Estado local' };
}

function metaForDecision(id) {
  const card = $(`.v11-decision-card[data-decision-id="${CSS.escape(id)}"]`);
  if (!card) return friendlyMeta(id);
  const fallback = friendlyMeta(id);
  return {
    scope: $('.v11-decision-scope', card)?.textContent?.trim() || fallback.scope,
    title: $('h3', card)?.textContent?.trim() || fallback.title,
    evidence: card.querySelector(':scope > small')?.textContent?.trim() || fallback.evidence,
  };
}

function subjectMetric(scope, name) {
  const row = treatedTopicalSeed.find((item) => item.scope === scope && item.grain === 'subject' && item.name === name && item.questions > 0);
  if (!row) return null;
  return {
    kind: 'accuracy',
    label: 'Aproveitamento',
    value: row.correct / row.questions * 100,
    questions: row.questions,
    correct: row.correct,
    capturedAt: nowIso(),
  };
}

function hoursSince(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 3_600_000);
}

function daysToExam(snapshot) {
  const target = new Date(snapshot?.meta?.nextExam || '2026-09-06T08:00:00-03:00').getTime();
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

async function metricForDecision(id) {
  if (id.startsWith('tdas:')) return subjectMetric('tdas', id.slice(5));
  if (id.startsWith('edas:')) return subjectMetric('edas', id.slice(5));
  const snapshot = await getSnapshot();
  if (!snapshot) return null;
  if (id === 'finance:partial') {
    return { kind: 'financeStatus', label: 'Situação financeira', value: String(snapshot.metrics?.finance?.status || 'Não informado'), capturedAt: nowIso() };
  }
  if (id === 'data:refresh') {
    return { kind: 'snapshotAge', label: 'Idade do snapshot', value: hoursSince(snapshot.meta?.generatedAt), capturedAt: nowIso() };
  }
  if (id === 'exam:final-window') {
    return { kind: 'countdown', label: 'Dias para o marco', value: daysToExam(snapshot), capturedAt: nowIso() };
  }
  return null;
}

function eventExists(journal, id, status, at) {
  const targetTime = new Date(at).getTime();
  return journal.events.some((event) => event.id === id && event.status === status && Math.abs(new Date(event.at).getTime() - targetTime) < 1500);
}

async function appendEvent(journal, id, status, at, source, migration = false) {
  if (eventExists(journal, id, status, at)) return false;
  const meta = metaForDecision(id);
  const baseline = status === 'adopted' ? await metricForDecision(id) : null;
  journal.events.push({
    eventId: `${id}:${status}:${at}`,
    id,
    status,
    at,
    source,
    scope: meta.scope,
    title: meta.title,
    evidence: meta.evidence,
    baseline,
    baselineQuality: baseline ? (migration ? 'captured-on-v12-migration' : 'decision-time') : null,
  });
  if (journal.events.length > 250) journal.events = journal.events.slice(-250);
  return true;
}

async function syncFromDecisionState() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const state = readDecisionState();
    const journal = readJournal();
    let changed = false;

    for (const [id, entry] of Object.entries(state)) {
      const status = entry?.status || 'open';
      const at = entry?.updatedAt || nowIso();
      const previous = journal.lastSeen[id];
      if (!previous) {
        changed = await appendEvent(journal, id, status, at, 'imported-v11-state', true) || changed;
        journal.lastSeen[id] = status;
        changed = true;
      } else if (previous !== status) {
        changed = await appendEvent(journal, id, status, at, 'decision-interaction', false) || changed;
        journal.lastSeen[id] = status;
        changed = true;
      }
    }

    for (const id of Object.keys(journal.lastSeen)) {
      if (!state[id]) continue;
      journal.lastSeen[id] = state[id]?.status || 'open';
    }

    if (changed) writeJournal(journal);
  } finally {
    syncRunning = false;
    scheduleRender();
  }
}

function statusLabel(status) {
  return status === 'adopted' ? 'Adotada' : status === 'dismissed' ? 'Descartada' : 'Reaberta';
}

function statusTone(status) {
  return status === 'adopted' ? 'good' : status === 'dismissed' ? 'muted' : 'warning';
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem data';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function currentStateLabel(id, state) {
  return statusLabel(state[id]?.status || 'open');
}

function compareMetric(baseline, current) {
  if (!baseline || !current || baseline.kind !== current.kind) return { tone: 'neutral', label: 'Sem comparação', detail: 'Ainda não há duas leituras equivalentes.' };
  if (baseline.kind === 'accuracy' && Number.isFinite(baseline.value) && Number.isFinite(current.value)) {
    const delta = current.value - baseline.value;
    const tone = delta > 0.5 ? 'good' : delta < -0.5 ? 'danger' : 'neutral';
    const sign = delta > 0 ? '+' : '';
    return { tone, label: `${sign}${delta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`, detail: `${fmt(baseline.questions)} → ${fmt(current.questions)} questões` };
  }
  if (baseline.kind === 'snapshotAge' && Number.isFinite(baseline.value) && Number.isFinite(current.value)) {
    const improvement = baseline.value - current.value;
    const tone = improvement > 1 ? 'good' : improvement < -6 ? 'danger' : 'neutral';
    return { tone, label: improvement > 1 ? 'Snapshot mais novo' : improvement < -6 ? 'Snapshot envelheceu' : 'Pouca mudança', detail: `${Math.round(baseline.value)}h → ${Math.round(current.value)}h` };
  }
  if (baseline.kind === 'financeStatus') {
    const changed = String(baseline.value) !== String(current.value);
    return { tone: changed ? 'warning' : 'neutral', label: changed ? 'Status mudou' : 'Status mantido', detail: `${baseline.value} → ${current.value}` };
  }
  if (baseline.kind === 'countdown') {
    return { tone: 'neutral', label: 'Passagem do tempo', detail: `${baseline.value ?? '—'}d → ${current.value ?? '—'}d` };
  }
  return { tone: 'neutral', label: 'Sem comparação', detail: 'Métrica não comparável.' };
}

function metricValue(metric) {
  if (!metric) return '—';
  if (metric.kind === 'accuracy') return pct(metric.value);
  if (metric.kind === 'snapshotAge') return metric.value == null ? '—' : `${Math.round(metric.value)}h`;
  if (metric.kind === 'countdown') return metric.value == null ? '—' : `${metric.value}d`;
  return String(metric.value ?? '—');
}

function latestAdoptionById(events) {
  const map = new Map();
  [...events].sort((a, b) => new Date(a.at) - new Date(b.at)).forEach((event) => {
    if (event.status === 'adopted') map.set(event.id, event);
    if (event.status === 'open' || event.status === 'dismissed') map.delete(event.id);
  });
  return map;
}

function dueReviewCount(journal, state) {
  const horizon = Date.now() + 72 * 3_600_000;
  return Object.entries(journal.reviews).filter(([id, review]) => state[id]?.status === 'adopted' && review?.dueAt && new Date(review.dueAt).getTime() <= horizon).length;
}

function renderRailExtension() {
  const rail = $('#v11CommandRail');
  if (!rail || $('[data-v12-history-nav]', rail)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.v11Scroll = '#v12DecisionHistory';
  button.dataset.v12HistoryNav = '';
  button.textContent = 'Histórico';
  rail.appendChild(button);
}

function renderHistoryButtonOnCards() {
  $$('.v11-decision-card[data-decision-id]').forEach((card) => {
    const actions = $('.v11-decision-actions', card);
    if (!actions || $('[data-v12-focus-history]', actions)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v12FocusHistory = card.dataset.decisionId;
    button.textContent = 'Histórico';
    actions.appendChild(button);
  });
}

function eventRow(event, journal) {
  const note = journal.notes[event.id]?.text?.trim();
  const review = journal.reviews[event.id]?.dueAt;
  return `<article class="v12-event ${statusTone(event.status)}" data-v12-event-status="${event.status}" data-v12-event-id="${esc(event.id)}">
    <span class="v12-event-marker"></span>
    <div class="v12-event-copy">
      <div class="v12-event-meta"><span>${esc(event.scope || friendlyMeta(event.id).scope)}</span><time>${esc(formatDate(event.at))}</time></div>
      <strong>${esc(statusLabel(event.status))}: ${esc(event.title || friendlyMeta(event.id).title)}</strong>
      <p>${esc(event.evidence || 'Estado local')}</p>
      ${event.baselineQuality === 'captured-on-v12-migration' ? '<small>Base de comparação capturada na migração para a v12 — não retroage ao momento original da decisão.</small>' : ''}
      ${note ? `<blockquote>${esc(note)}</blockquote>` : ''}
      ${review ? `<small class="v12-review-line">Revisão marcada para ${esc(formatDate(review))}</small>` : ''}
    </div>
    <button type="button" class="v12-event-action" data-v12-open-drawer="${esc(event.id)}">Contexto</button>
  </article>`;
}

async function impactCard(id, adoption, journal) {
  const current = await metricForDecision(id);
  const comparison = compareMetric(adoption?.baseline, current);
  const note = journal.notes[id]?.text?.trim();
  const review = journal.reviews[id]?.dueAt;
  const meta = { ...friendlyMeta(id), scope: adoption?.scope || friendlyMeta(id).scope, title: adoption?.title || friendlyMeta(id).title };
  return `<article class="v12-impact-card ${comparison.tone}" data-v12-impact-id="${esc(id)}">
    <div class="v12-impact-top"><span>${esc(meta.scope)}</span><b>${esc(comparison.label)}</b></div>
    <h3>${esc(meta.title)}</h3>
    <div class="v12-impact-metric">
      <span><small>Na decisão</small><strong>${esc(metricValue(adoption?.baseline))}</strong></span>
      <i>→</i>
      <span><small>Agora</small><strong>${esc(metricValue(current))}</strong></span>
    </div>
    <p>${esc(comparison.detail)}</p>
    <small class="v12-causality">Leitura pós-decisão; não demonstra causalidade.</small>
    ${note ? `<div class="v12-note-preview">“${esc(note)}”</div>` : ''}
    ${review ? `<div class="v12-review-chip">Revisar ${esc(formatDate(review))}</div>` : ''}
    <button type="button" data-v12-open-drawer="${esc(id)}">${note ? 'Editar contexto' : 'Registrar contexto'}</button>
  </article>`;
}

async function renderHistorySection() {
  const view = $('.command-view');
  const anchor = $('#v11WeeklyHorizon', view);
  if (!view || !anchor) return;

  const state = readDecisionState();
  const journal = readJournal();
  const currentFilter = localStorage.getItem(FILTER_KEY) || 'all';
  const adoptionMap = latestAdoptionById(journal.events);
  const adoptedIds = Object.entries(state).filter(([, entry]) => entry?.status === 'adopted').map(([id]) => id);
  const impactHtml = adoptedIds.length
    ? (await Promise.all(adoptedIds.map((id) => impactCard(id, adoptionMap.get(id), journal)))).join('')
    : '<div class="v12-empty"><strong>Nenhuma decisão adotada agora.</strong><span>Quando você adotar uma recomendação, a v12 cria uma base de comparação e passa a acompanhar a leitura posterior.</span></div>';

  const events = [...journal.events].sort((a, b) => new Date(b.at) - new Date(a.at));
  const filtered = currentFilter === 'all' ? events : events.filter((event) => event.status === currentFilter);
  const notesCount = Object.values(journal.notes).filter((item) => item?.text?.trim()).length;
  const due = dueReviewCount(journal, state);
  const signature = JSON.stringify({
    state: Object.fromEntries(Object.entries(state).map(([id, entry]) => [id, entry?.status])),
    events: journal.events.map((event) => [event.eventId, event.status]),
    notes: Object.entries(journal.notes).map(([id, item]) => [id, item?.updatedAt, item?.text]),
    reviews: Object.entries(journal.reviews).map(([id, item]) => [id, item?.dueAt]),
    filter: currentFilter,
    impactHtml,
  });

  let section = $('#v12DecisionHistory', view);
  if (!section) {
    section = document.createElement('section');
    section.id = 'v12DecisionHistory';
    section.className = 'v12-history panel';
    anchor.after(section);
  }
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  section.innerHTML = `
    <div class="v12-head">
      <div><span class="eyebrow">MEMÓRIA DECISÓRIA · V12</span><h2>O que foi decidido — e o que mudou depois.</h2><p>Histórico local de decisões, contexto e leitura posterior. Comparação não é causalidade e não substitui a fonte oficial.</p></div>
      <div class="v12-kpis">
        <span><b>${journal.events.length}</b><small>movimentos</small></span>
        <span><b>${adoptedIds.length}</b><small>adotadas</small></span>
        <span><b>${notesCount}</b><small>com nota</small></span>
        <span><b>${due}</b><small>a revisar</small></span>
      </div>
    </div>

    <div class="v12-impact-head"><div><span class="eyebrow">IMPACTO POSTERIOR</span><strong>Base da decisão → leitura atual</strong></div><small>Sem vender correlação como causa. Milagre fica fora do escopo do dashboard.</small></div>
    <div class="v12-impact-grid">${impactHtml}</div>

    <div class="v12-timeline-head">
      <div><span class="eyebrow">LINHA DO TEMPO</span><strong>Rastro das mudanças de estado</strong></div>
      <div class="v12-filters" role="group" aria-label="Filtrar histórico">
        ${[['all','Todas'],['adopted','Adotadas'],['dismissed','Descartadas'],['open','Reabertas']].map(([value, label]) => `<button type="button" class="${currentFilter === value ? 'active' : ''}" data-v12-filter="${value}">${label}</button>`).join('')}
      </div>
    </div>
    <div class="v12-timeline">${filtered.length ? filtered.map((event) => eventRow(event, journal)).join('') : '<div class="v12-empty compact"><strong>Nenhum movimento neste filtro.</strong><span>O histórico aparece quando uma decisão muda de estado.</span></div>'}</div>
    <div class="v12-local-guard"><strong>Persistência local</strong><span>Histórico, notas e prazos ficam neste navegador até serem exportados. Eles não são gravados no Notion automaticamente.</span></div>`;
}

function ensureDrawer() {
  if ($('#v12DecisionDrawer')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'v12DecisionDrawer';
  wrapper.className = 'v12-drawer-wrap hidden';
  wrapper.innerHTML = `
    <button class="v12-drawer-backdrop" type="button" data-v12-close-drawer aria-label="Fechar contexto"></button>
    <aside class="v12-drawer" role="dialog" aria-modal="true" aria-labelledby="v12DrawerTitle">
      <div class="v12-drawer-handle"></div>
      <div class="v12-drawer-head"><div><span class="eyebrow">CONTEXTO DA DECISÃO</span><h2 id="v12DrawerTitle">Decisão</h2><p id="v12DrawerScope"></p></div><button type="button" class="v12-close" data-v12-close-drawer aria-label="Fechar">×</button></div>
      <label class="v12-note-field"><span>Por que esta decisão faz sentido para você?</span><textarea id="v12DecisionNote" maxlength="1200" placeholder="Registre contexto, hipótese, limite ou o que deseja observar depois…"></textarea><small>Local neste navegador · até 1.200 caracteres</small></label>
      <div class="v12-review-actions"><span>Revisar decisão</span><div><button type="button" data-v12-review-hours="24">em 24h</button><button type="button" data-v12-review-hours="72">em 72h</button><button type="button" data-v12-review-clear>sem prazo</button></div><small id="v12ReviewStatus">Sem revisão marcada</small></div>
      <div class="v12-drawer-actions"><button type="button" data-v12-close-drawer>Cancelar</button><button type="button" class="primary" id="v12SaveContext">Salvar contexto</button></div>
    </aside>`;
  document.body.appendChild(wrapper);
}

function reviewStatusText(review) {
  return review?.dueAt ? `Revisão marcada para ${formatDate(review.dueAt)}` : 'Sem revisão marcada';
}

function openDrawer(id) {
  ensureDrawer();
  activeDecisionId = id;
  const journal = readJournal();
  const meta = metaForDecision(id);
  $('#v12DrawerTitle').textContent = meta.title;
  $('#v12DrawerScope').textContent = `${meta.scope} · ${currentStateLabel(id, readDecisionState())}`;
  $('#v12DecisionNote').value = journal.notes[id]?.text || '';
  $('#v12ReviewStatus').textContent = reviewStatusText(journal.reviews[id]);
  $('#v12DecisionDrawer').classList.remove('hidden');
  document.body.classList.add('v12-drawer-open');
  window.setTimeout(() => $('#v12DecisionNote')?.focus(), 30);
}

function closeDrawer() {
  $('#v12DecisionDrawer')?.classList.add('hidden');
  document.body.classList.remove('v12-drawer-open');
  activeDecisionId = null;
}

function saveContext() {
  if (!activeDecisionId) return;
  const journal = readJournal();
  const text = $('#v12DecisionNote')?.value?.trim() || '';
  if (text) journal.notes[activeDecisionId] = { text, updatedAt: nowIso() };
  else delete journal.notes[activeDecisionId];
  writeJournal(journal);
  closeDrawer();
  scheduleRender(true);
}

function setReview(hours) {
  if (!activeDecisionId) return;
  const journal = readJournal();
  if (hours == null) delete journal.reviews[activeDecisionId];
  else journal.reviews[activeDecisionId] = { dueAt: new Date(Date.now() + Number(hours) * 3_600_000).toISOString(), updatedAt: nowIso() };
  writeJournal(journal);
  $('#v12ReviewStatus').textContent = reviewStatusText(journal.reviews[activeDecisionId]);
  scheduleRender(true);
}

function exportDossier() {
  const payload = {
    exportedAt: nowIso(),
    version: VERSION,
    storage: 'localStorage',
    sourceSeparation: 'Este dossiê local não altera o Notion nem o snapshot publicado.',
    currentDecisionState: readDecisionState(),
    journal: readJournal(),
    publishedSnapshot: snapshotCache ? { generatedAt: snapshotCache.meta?.generatedAt, source: snapshotCache.meta?.source } : null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plano-de-transicao-dossie-decisoes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openHistory() {
  const commandButton = $('[data-view="command"]');
  if (!$('.command-view') && commandButton) commandButton.click();
  $('#closeMoreBtn')?.click();
  window.setTimeout(() => $('#v12DecisionHistory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}

function renderOps() {
  const v11Ops = $('#v11DecisionOps');
  if (!v11Ops) return;
  let section = $('#v12DecisionJournalOps');
  if (!section) {
    section = document.createElement('div');
    section.id = 'v12DecisionJournalOps';
    section.className = 'v12-ops';
    v11Ops.after(section);
  }
  const journal = readJournal();
  const notes = Object.values(journal.notes).filter((item) => item?.text?.trim()).length;
  section.innerHTML = `
    <div class="sheet-section-label">Memória decisória</div>
    <div class="v12-ops-summary"><span>V12</span><div><small>Dossiê local</small><strong>${journal.events.length} movimentos · ${notes} notas registradas</strong></div></div>
    <button id="v12OpenHistory" class="action-button" type="button"><span>↗</span><span><b>Abrir histórico</b><small>Decisões, notas, prazos e leitura posterior</small></span></button>
    <button id="v12ExportDossier" class="action-button" type="button"><span>⇩</span><span><b>Exportar dossiê</b><small>Baixar histórico e contexto em JSON</small></span></button>`;
}

async function renderAll() {
  renderRailExtension();
  renderHistoryButtonOnCards();
  ensureDrawer();
  await renderHistorySection();
  renderOps();
}

function scheduleRender(forceSnapshot = false) {
  if (forceSnapshot) snapshotCache = null;
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(async () => {
    renderScheduled = false;
    await renderAll();
  });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const open = event.target.closest?.('[data-v12-open-drawer]');
    if (open) {
      event.preventDefault();
      openDrawer(open.dataset.v12OpenDrawer);
      return;
    }
    const focus = event.target.closest?.('[data-v12-focus-history]');
    if (focus) {
      event.preventDefault();
      openHistory();
      return;
    }
    const filter = event.target.closest?.('[data-v12-filter]');
    if (filter) {
      event.preventDefault();
      localStorage.setItem(FILTER_KEY, filter.dataset.v12Filter);
      scheduleRender();
      return;
    }
    if (event.target.closest?.('[data-v12-close-drawer]')) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    const review = event.target.closest?.('[data-v12-review-hours]');
    if (review) {
      event.preventDefault();
      setReview(Number(review.dataset.v12ReviewHours));
      return;
    }
    if (event.target.closest?.('[data-v12-review-clear]')) {
      event.preventDefault();
      setReview(null);
      return;
    }
    if (event.target.closest?.('#v12SaveContext')) {
      event.preventDefault();
      saveContext();
      return;
    }
    if (event.target.closest?.('#v12OpenHistory')) {
      event.preventDefault();
      openHistory();
      return;
    }
    if (event.target.closest?.('#v12ExportDossier')) {
      event.preventDefault();
      exportDossier();
      return;
    }
    if (event.target.closest?.('#refreshBtn, #managerRefreshBtn')) {
      window.setTimeout(() => scheduleRender(true), 800);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#v12DecisionDrawer')?.classList.contains('hidden')) closeDrawer();
  });
  window.addEventListener('storage', (event) => {
    if ([DECISION_KEY, JOURNAL_KEY, FILTER_KEY].includes(event.key)) {
      syncFromDecisionState();
      scheduleRender(true);
    }
  });
  window.addEventListener('hashchange', scheduleRender);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(true); });
}

const observer = new MutationObserver(() => {
  syncFromDecisionState();
  scheduleRender();
});

bindEvents();
syncFromDecisionState();
scheduleRender();
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
window.setInterval(syncFromDecisionState, 2500);
