const VERSION = 13;
const DECISION_KEY = 'plano.decisions.v11';
const JOURNAL_KEY = 'plano.decisionJournal.v12';
const INBOX_KEY = 'plano.managerInbox.v13';
const FILTER_KEY = 'plano.managerInbox.filter.v13';
const MAX_VISIBLE = 6;
const $ = (selector, root = document) => root?.querySelector?.(selector) ?? null;
const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const nowIso = () => new Date().toISOString();

let snapshotCache = null;
let snapshotPromise = null;
let renderQueued = false;
let mutationQueued = false;

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readDecisionState() {
  const value = readJson(DECISION_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readJournal() {
  const value = readJson(JOURNAL_KEY, {});
  return {
    reviews: value?.reviews && typeof value.reviews === 'object' ? value.reviews : {},
    notes: value?.notes && typeof value.notes === 'object' ? value.notes : {},
  };
}

function emptyInboxState() {
  return { version: VERSION, snoozed: {}, silenced: {}, updatedAt: null };
}

function readInboxState() {
  const raw = readJson(INBOX_KEY, emptyInboxState());
  return {
    version: VERSION,
    snoozed: raw?.snoozed && typeof raw.snoozed === 'object' ? raw.snoozed : {},
    silenced: raw?.silenced && typeof raw.silenced === 'object' ? raw.silenced : {},
    updatedAt: raw?.updatedAt || null,
  };
}

function writeInboxState(state) {
  localStorage.setItem(INBOX_KEY, JSON.stringify({ ...state, version: VERSION, updatedAt: nowIso() }));
}

async function getSnapshot(force = false) {
  if (force) snapshotCache = null;
  if (snapshotCache) return snapshotCache;
  if (!snapshotPromise) {
    snapshotPromise = fetch(`data/snapshot.json?v13=${Date.now()}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => (snapshotCache = value))
      .catch(() => null)
      .finally(() => { snapshotPromise = null; });
  }
  return snapshotPromise;
}

function toneRank(tone) {
  return tone === 'danger' ? 4 : tone === 'warning' ? 3 : tone === 'aqua' ? 2 : tone === 'good' ? 1 : 0;
}

function urgencyLabel(bucket) {
  return bucket === 'now' ? 'Agora' : bucket === 'today' ? 'Hoje' : 'Monitorar';
}

function bucketRank(bucket) {
  return bucket === 'now' ? 3 : bucket === 'today' ? 2 : 1;
}

function formatClock(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem prazo';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function hoursUntil(value) {
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return null;
  return (target - Date.now()) / 3_600_000;
}

function hoursSince(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 3_600_000);
}

function daysUntil(value) {
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function itemScore(item) {
  return bucketRank(item.bucket) * 100 + toneRank(item.tone) * 10 + Number(item.score || 0);
}

function readDecisionCards() {
  return $$('#v11DecisionCenter .v11-decision-card[data-decision-id]').map((card) => {
    const status = $('.v11-decision-status', card)?.textContent?.trim().toLocaleLowerCase('pt-BR') || '';
    if (!status.includes('aberta')) return null;
    const tone = card.classList.contains('danger') ? 'danger' : card.classList.contains('warning') ? 'warning' : card.classList.contains('aqua') ? 'aqua' : 'neutral';
    const decisionId = card.dataset.decisionId;
    return {
      id: `decision:${decisionId}`,
      sourceId: decisionId,
      type: 'decision',
      bucket: tone === 'danger' ? 'now' : 'today',
      tone,
      scope: $('.v11-decision-scope', card)?.textContent?.trim() || 'Decisão',
      title: $('h3', card)?.textContent?.trim() || 'Decisão aberta',
      detail: $('p', card)?.textContent?.trim() || 'Há uma decisão aguardando tratamento.',
      evidence: card.querySelector(':scope > small')?.textContent?.trim() || 'Centro de decisões',
      action: 'decision',
      score: tone === 'danger' ? 9 : 4,
    };
  }).filter(Boolean);
}

function reviewItems() {
  const state = readDecisionState();
  const journal = readJournal();
  return Object.entries(journal.reviews).map(([decisionId, review]) => {
    if (state[decisionId]?.status !== 'adopted' || !review?.dueAt) return null;
    const hours = hoursUntil(review.dueAt);
    if (hours == null || hours > 72) return null;
    const meta = $(`.v11-decision-card[data-decision-id="${CSS.escape(decisionId)}"]`);
    const title = $('h3', meta)?.textContent?.trim() || decisionId.replace(/^[^:]+:/, '');
    const scope = $('.v11-decision-scope', meta)?.textContent?.trim() || 'Decisão adotada';
    const overdue = hours <= 0;
    return {
      id: `review:${decisionId}`,
      sourceId: decisionId,
      type: 'review',
      bucket: overdue || hours <= 12 ? 'now' : 'today',
      tone: overdue ? 'danger' : 'warning',
      scope,
      title: overdue ? `Revisão vencida: ${title}` : `Revisar decisão: ${title}`,
      detail: overdue ? `Prazo venceu há ${Math.max(1, Math.round(Math.abs(hours)))}h.` : `Prazo em aproximadamente ${Math.max(1, Math.round(hours))}h.`,
      evidence: `Revisão marcada para ${formatClock(review.dueAt)}`,
      action: 'review',
      score: overdue ? 18 : 12,
    };
  }).filter(Boolean);
}

function snapshotItems(snapshot) {
  if (!snapshot) return [];
  const items = [];
  const age = hoursSince(snapshot.meta?.generatedAt);
  if (age != null && age >= 24) {
    items.push({
      id: 'snapshot:stale',
      type: 'data',
      bucket: age >= 48 ? 'now' : 'today',
      tone: age >= 48 ? 'danger' : 'warning',
      scope: 'Dados',
      title: 'Atualizar o snapshot publicado',
      detail: `A versão publicada tem aproximadamente ${Math.round(age)} horas.`,
      evidence: 'meta.generatedAt',
      action: 'refresh',
      score: age >= 48 ? 16 : 8,
    });
  }

  const warnings = [...(snapshot.meta?.syncWarnings || []), ...(snapshot.meta?.dataWarnings || [])]
    .map((warning) => typeof warning === 'string' ? warning : warning?.message || warning?.title || JSON.stringify(warning))
    .filter(Boolean);
  warnings.slice(0, 3).forEach((warning, index) => items.push({
    id: `data-warning:${index}:${warning.slice(0, 40)}`,
    type: 'data',
    bucket: 'now',
    tone: 'warning',
    scope: 'Governança dos dados',
    title: 'Há uma ressalva de sincronização para revisar',
    detail: warning,
    evidence: 'meta.syncWarnings / meta.dataWarnings',
    action: 'view',
    target: 'sources',
    score: 14 - index,
  }));

  const examDays = daysUntil(snapshot.meta?.nextExam);
  if (examDays != null && examDays >= 0 && examDays <= 7) {
    items.push({
      id: 'exam:next-milestone',
      type: 'milestone',
      bucket: examDays <= 2 ? 'now' : 'today',
      tone: examDays <= 2 ? 'warning' : 'aqua',
      scope: 'Próximo marco',
      title: examDays === 0 ? 'Marco da prova chegou' : `${examDays} ${examDays === 1 ? 'dia' : 'dias'} para a próxima prova`,
      detail: 'Concentre a central no que já foi medido e evite ampliar escopo sem evidência.',
      evidence: 'meta.nextExam',
      action: 'view',
      target: 'exams',
      score: 10,
    });
  }

  if (String(snapshot.metrics?.finance?.status || '').toLocaleLowerCase('pt-BR').includes('parcial')) {
    items.push({
      id: 'finance:partial-v13',
      type: 'monitor',
      bucket: 'monitor',
      tone: 'neutral',
      scope: 'Investimentos',
      title: 'Financeiro ainda é uma leitura parcial',
      detail: `Total confirmado no ciclo: R$ ${Number(snapshot.metrics?.finance?.sedesConfirmed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      evidence: 'metrics.finance.status',
      action: 'view',
      target: 'finance',
      score: 2,
    });
  }
  return items;
}

function alertItems() {
  return $$('#v11AlertRadar .v11-alert').slice(0, 3).map((alert, index) => {
    const title = $('strong', alert)?.textContent?.trim() || $('h3', alert)?.textContent?.trim() || `Alerta ${index + 1}`;
    const detail = $('p', alert)?.textContent?.trim() || 'Sinal identificado pelo radar de alertas.';
    const source = $('small', alert)?.textContent?.trim() || 'Radar v11';
    const tone = alert.classList.contains('danger') ? 'danger' : alert.classList.contains('warning') ? 'warning' : alert.classList.contains('good') ? 'good' : 'neutral';
    if (tone === 'good') return null;
    return {
      id: `alert:${title}`,
      type: 'alert',
      bucket: tone === 'danger' ? 'now' : 'monitor',
      tone,
      scope: 'Radar',
      title,
      detail,
      evidence: source,
      action: 'alert',
      score: tone === 'danger' ? 7 : 1,
    };
  }).filter(Boolean);
}

function applyLocalState(items) {
  const state = readInboxState();
  let changed = false;
  Object.entries(state.snoozed).forEach(([id, until]) => {
    if (new Date(until).getTime() <= Date.now()) {
      delete state.snoozed[id];
      changed = true;
    }
  });
  if (changed) writeInboxState(state);
  return items.map((item) => ({
    ...item,
    silenced: Boolean(state.silenced[item.id]),
    snoozedUntil: state.snoozed[item.id] || null,
  }));
}

async function collectItems() {
  const snapshot = await getSnapshot();
  const raw = [
    ...reviewItems(),
    ...readDecisionCards(),
    ...snapshotItems(snapshot),
    ...alertItems(),
  ];
  const deduped = new Map();
  raw.forEach((item) => {
    const existing = deduped.get(item.id);
    if (!existing || itemScore(item) > itemScore(existing)) deduped.set(item.id, item);
  });
  return applyLocalState([...deduped.values()]).sort((a, b) => itemScore(b) - itemScore(a) || a.title.localeCompare(b.title, 'pt-BR'));
}

function activeItems(items) {
  return items.filter((item) => !item.silenced && !item.snoozedUntil);
}

function itemButtonLabel(item) {
  if (item.action === 'review') return 'Revisar';
  if (item.action === 'decision') return 'Abrir decisão';
  if (item.action === 'refresh') return 'Atualizar';
  if (item.target === 'sources') return 'Ver fontes';
  if (item.target === 'finance') return 'Ver investimentos';
  if (item.target === 'exams') return 'Ver concurso';
  return 'Abrir';
}

function renderItem(item) {
  return `<article class="v13-inbox-item ${esc(item.tone)}" data-v13-item-id="${esc(item.id)}" data-v13-bucket="${esc(item.bucket)}">
    <span class="v13-item-rail"></span>
    <div class="v13-item-main">
      <div class="v13-item-meta"><span>${esc(item.scope)}</span><b>${esc(urgencyLabel(item.bucket))}</b></div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.detail)}</p>
      <small>${esc(item.evidence)}</small>
    </div>
    <div class="v13-item-actions">
      <button type="button" class="v13-open" data-v13-open="${esc(item.id)}">${esc(itemButtonLabel(item))}</button>
      <button type="button" data-v13-snooze="${esc(item.id)}">Adiar 24h</button>
      <button type="button" data-v13-silence="${esc(item.id)}">Silenciar</button>
    </div>
  </article>`;
}

function renderEmpty(filter) {
  const label = filter === 'all' ? 'na caixa de entrada' : `em ${urgencyLabel(filter).toLocaleLowerCase('pt-BR')}`;
  return `<div class="v13-empty"><strong>Nada exigindo ação ${label}.</strong><span>Os sinais voltam automaticamente quando dados, prazos ou decisões mudarem.</span></div>`;
}

function ensureRailEntry() {
  const rail = $('#v11CommandRail');
  if (!rail || $('[data-v13-inbox-nav]', rail)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.v11Scroll = '#v13ManagerInbox';
  button.dataset.v13InboxNav = '';
  button.textContent = 'Atenção';
  const decisions = $('[data-v11-scroll="#v11DecisionCenter"]', rail);
  decisions?.before(button);
}

function updateAttentionBadges(count) {
  const targets = [
    $('#mainTabs [data-view="command"]'),
    $('#mobileDock [data-view="command"]'),
    $('#moreTopBtn'),
  ].filter(Boolean);
  targets.forEach((target) => {
    let badge = $('.v13-attention-badge', target);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'v13-attention-badge';
      target.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.toggle('hidden', count < 1);
    badge.setAttribute('aria-label', `${count} itens de atenção`);
  });
}

async function renderInbox() {
  const view = $('.command-view');
  const anchor = $('#managerNowBoard', view) || $('.manager-quick-grid', view);
  if (!view || !anchor) return;
  ensureRailEntry();

  const items = await collectItems();
  const active = activeItems(items);
  const silenced = items.filter((item) => item.silenced).length;
  const snoozed = items.filter((item) => item.snoozedUntil).length;
  const counts = {
    now: active.filter((item) => item.bucket === 'now').length,
    today: active.filter((item) => item.bucket === 'today').length,
    monitor: active.filter((item) => item.bucket === 'monitor').length,
  };
  const attentionCount = counts.now + counts.today;
  updateAttentionBadges(attentionCount);

  const filter = localStorage.getItem(FILTER_KEY) || 'all';
  const filtered = filter === 'all' ? active : active.filter((item) => item.bucket === filter);
  const visible = filtered.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, filtered.length - visible.length);
  const signature = JSON.stringify({
    items: items.map((item) => [item.id, item.bucket, item.tone, item.silenced, item.snoozedUntil]),
    filter,
    decisionState: readDecisionState(),
  });

  let section = $('#v13ManagerInbox', view);
  if (!section) {
    section = document.createElement('section');
    section.id = 'v13ManagerInbox';
    section.className = 'v13-manager-inbox panel';
    anchor.before(section);
  }
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  section.innerHTML = `
    <div class="v13-inbox-head">
      <div><span class="eyebrow">CAIXA DE ENTRADA GERENCIAL · V13</span><h2>O que merece sua atenção antes do resto.</h2><p>Decisões, revisões, prazos e ressalvas reunidos em uma fila única. O painel prioriza; você continua decidindo.</p></div>
      <div class="v13-inbox-kpis">
        <span class="danger"><b>${counts.now}</b><small>agora</small></span>
        <span class="warning"><b>${counts.today}</b><small>hoje</small></span>
        <span><b>${counts.monitor}</b><small>monitorar</small></span>
        <span class="muted"><b>${silenced + snoozed}</b><small>fora da fila</small></span>
      </div>
    </div>
    <div class="v13-inbox-toolbar">
      <div class="v13-inbox-filters" role="group" aria-label="Filtrar caixa de entrada">
        ${[['all','Todos'],['now','Agora'],['today','Hoje'],['monitor','Monitorar']].map(([value, label]) => `<button type="button" class="${filter === value ? 'active' : ''}" data-v13-filter="${value}">${label}</button>`).join('')}
      </div>
      <span>${active.length} ativos · ${snoozed} adiados · ${silenced} silenciados</span>
    </div>
    <div class="v13-inbox-list">${visible.length ? visible.map(renderItem).join('') : renderEmpty(filter)}</div>
    ${hiddenCount ? `<button class="v13-show-all" type="button" data-v13-show-all>Mostrar mais ${hiddenCount}</button>` : ''}
    <div class="v13-inbox-foot"><strong>Fila dinâmica</strong><span>Itens somem quando a condição deixa de existir. Adiar e silenciar são estados locais e não alteram Notion, decisões ou snapshot.</span></div>`;
}

function setItemState(id, kind) {
  const state = readInboxState();
  if (kind === 'snooze') {
    state.snoozed[id] = new Date(Date.now() + 24 * 3_600_000).toISOString();
    delete state.silenced[id];
  } else if (kind === 'silence') {
    state.silenced[id] = { at: nowIso() };
    delete state.snoozed[id];
  }
  writeInboxState(state);
  scheduleRender();
}

function restoreInbox() {
  writeInboxState(emptyInboxState());
  scheduleRender(true);
}

function scrollHighlight(target) {
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('v13-focus-pulse');
  window.setTimeout(() => target.classList.remove('v13-focus-pulse'), 1600);
}

function openView(target) {
  const button = $(`[data-view="${CSS.escape(target)}"]`);
  button?.click();
}

async function executeItem(id) {
  const items = await collectItems();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  if (item.action === 'refresh') {
    $('#refreshBtn')?.click();
    return;
  }
  if (item.action === 'review') {
    const button = $(`[data-v12-open-drawer="${CSS.escape(item.sourceId)}"]`);
    if (button) button.click();
    else scrollHighlight($(`[data-decision-id="${CSS.escape(item.sourceId)}"]`));
    return;
  }
  if (item.action === 'decision') {
    scrollHighlight($(`[data-decision-id="${CSS.escape(item.sourceId)}"]`));
    return;
  }
  if (item.action === 'alert') {
    scrollHighlight($('#v11AlertRadar'));
    return;
  }
  if (item.target) openView(item.target);
}

function renderOpsSummary(items) {
  const moreSheet = $('#moreSheet');
  const anchor = $('#v12DecisionJournalOps', moreSheet) || $('#v11DecisionOps', moreSheet);
  if (!moreSheet || !anchor) return;
  const active = activeItems(items);
  const urgent = active.filter((item) => item.bucket === 'now' || item.bucket === 'today').length;
  const state = readInboxState();
  const hidden = Object.keys(state.silenced).length + Object.keys(state.snoozed).length;

  let section = $('#v13InboxOps', moreSheet);
  if (!section) {
    section = document.createElement('div');
    section.id = 'v13InboxOps';
    section.className = 'v13-inbox-ops';
    anchor.after(section);
  }
  const signature = `${urgent}:${hidden}`;
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  section.innerHTML = `
    <div class="sheet-section-label">Caixa de entrada gerencial</div>
    <div class="v13-ops-summary"><span>V13</span><div><small>Fila dinâmica</small><strong>${urgent} exigem atenção · ${hidden} fora da fila</strong></div></div>
    <button id="v13OpenInbox" class="action-button" type="button"><span>↗</span><span><b>Abrir caixa de entrada</b><small>Ver decisões, revisões, prazos e ressalvas em uma fila</small></span></button>
    <button id="v13RestoreInbox" class="action-button" type="button"><span>↺</span><span><b>Restaurar itens ocultados</b><small>Remove adiamentos e silenciamentos locais da v13</small></span></button>`;
}

async function renderAll(forceSnapshot = false) {
  if (forceSnapshot) snapshotCache = null;
  await renderInbox();
  renderOpsSummary(await collectItems());
}

function scheduleRender(forceSnapshot = false) {
  if (forceSnapshot) snapshotCache = null;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(async () => {
    renderQueued = false;
    await renderAll();
  });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const filter = event.target.closest?.('[data-v13-filter]');
    if (filter) {
      event.preventDefault();
      localStorage.setItem(FILTER_KEY, filter.dataset.v13Filter);
      scheduleRender();
      return;
    }
    const open = event.target.closest?.('[data-v13-open]');
    if (open) {
      event.preventDefault();
      executeItem(open.dataset.v13Open);
      return;
    }
    const snooze = event.target.closest?.('[data-v13-snooze]');
    if (snooze) {
      event.preventDefault();
      setItemState(snooze.dataset.v13Snooze, 'snooze');
      return;
    }
    const silence = event.target.closest?.('[data-v13-silence]');
    if (silence) {
      event.preventDefault();
      setItemState(silence.dataset.v13Silence, 'silence');
      return;
    }
    if (event.target.closest?.('#v13OpenInbox')) {
      event.preventDefault();
      $('#closeMoreBtn')?.click();
      const command = $('#mainTabs [data-view="command"]') || $('[data-view="command"]');
      if (!$('.command-view')) command?.click();
      window.setTimeout(() => scrollHighlight($('#v13ManagerInbox')), 120);
      return;
    }
    if (event.target.closest?.('#v13RestoreInbox')) {
      event.preventDefault();
      restoreInbox();
      return;
    }
    if (event.target.closest?.('[data-v13-show-all]')) {
      event.preventDefault();
      const list = $('#v13ManagerInbox .v13-inbox-list');
      if (!list) return;
      collectItems().then((items) => {
        const filterValue = localStorage.getItem(FILTER_KEY) || 'all';
        const active = activeItems(items);
        const filtered = filterValue === 'all' ? active : active.filter((item) => item.bucket === filterValue);
        list.innerHTML = filtered.length ? filtered.map(renderItem).join('') : renderEmpty(filterValue);
        event.target.remove();
      });
      return;
    }
  });

  window.addEventListener('online', () => scheduleRender(true));
  window.addEventListener('focus', () => scheduleRender(true));
  window.addEventListener('storage', (event) => {
    if ([DECISION_KEY, JOURNAL_KEY, INBOX_KEY].includes(event.key)) scheduleRender();
  });

  const refresh = $('#refreshBtn');
  refresh?.addEventListener('click', () => window.setTimeout(() => scheduleRender(true), 350));
}

function observe() {
  const observer = new MutationObserver(() => {
    if (mutationQueued) return;
    mutationQueued = true;
    window.setTimeout(() => {
      mutationQueued = false;
      if ($('.command-view') || $('#moreSheet.open')) scheduleRender();
    }, 80);
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}

bindEvents();
observe();
scheduleRender(true);
window.setInterval(() => scheduleRender(), 60_000);
