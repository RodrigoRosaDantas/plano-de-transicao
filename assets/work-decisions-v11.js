import { treatedTopicalSeed } from '../data/treated-performance-data.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const pct = (value, digits = 1) => value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const DECISION_KEY = 'plano.decisions.v11';

let snapshot = null;
let snapshotPromise = null;
let renderQueued = false;

const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
const ICON = {
  decision: icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  bell: icon('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'),
  week: icon('<path d="M3 5h18v16H3zM8 3v4m8-4v4M3 10h18"/>'),
  arrow: icon('<path d="M5 12h14m-5-5 5 5-5 5"/>'),
  check: icon('<path d="m5 12 4 4L19 6"/>'),
  close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
  refresh: icon('<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>'),
  export: icon('<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>'),
  target: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  database: icon('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
};

async function getSnapshot() {
  if (snapshot) return snapshot;
  if (!snapshotPromise) {
    snapshotPromise = fetch(`data/snapshot.json?v11=${Date.now()}`, { cache: 'no-store' })
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

function readDecisionState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DECISION_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeDecisionState(state) {
  localStorage.setItem(DECISION_KEY, JSON.stringify(state));
}

function setDecisionStatus(id, status) {
  const state = readDecisionState();
  state[id] = { status, updatedAt: new Date().toISOString() };
  writeDecisionState(state);
}

function subjectRows(scope) {
  return treatedTopicalSeed
    .filter((row) => row.scope === scope && row.grain === 'subject' && row.questions > 0)
    .map((row) => ({
      ...row,
      accuracy: row.correct / row.questions * 100,
      errors: row.questions - row.correct,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.errors - a.errors || b.questions - a.questions);
}

function subjectWithEvidence(scope, minimum = 30) {
  return subjectRows(scope).find((row) => row.questions >= minimum) || subjectRows(scope)[0] || null;
}

function daysToExam(data) {
  const target = new Date(data?.meta?.nextExam || '2026-09-06T08:00:00-03:00').getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

function hoursSince(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Infinity;
  return Math.max(0, (Date.now() - time) / 3_600_000);
}

function candidateDecisions(data) {
  const tdas = subjectWithEvidence('tdas');
  const edas = subjectWithEvidence('edas');
  const days = daysToExam(data);
  const staleHours = hoursSince(data.meta?.generatedAt);
  const candidates = [];

  if (tdas) {
    candidates.push({
      id: `tdas:${tdas.name}`,
      scope: 'TDAS 202',
      tone: tdas.accuracy < 80 ? 'danger' : tdas.accuracy < 88 ? 'warning' : 'aqua',
      title: `Priorizar ${tdas.name} na próxima decisão de revisão`,
      rationale: `${pct(tdas.accuracy)} em ${fmt(tdas.questions)} questões tratadas, com ${fmt(tdas.errors)} erros observados.`,
      evidence: 'Base tratada · matéria isolada',
      target: 'performance',
      subject: tdas.name,
      scopeKey: 'tdas',
    });
  }

  if (edas) {
    candidates.push({
      id: `edas:${edas.name}`,
      scope: 'EDAS 400',
      tone: data.metrics.edas.questions < 300 ? 'neutral' : edas.accuracy < 80 ? 'danger' : 'warning',
      title: data.metrics.edas.questions < 300 ? `Aumentar evidência antes de concluir sobre ${edas.name}` : `Revisar o risco em ${edas.name}`,
      rationale: `${pct(edas.accuracy)} em ${fmt(edas.questions)} questões; o EDAS possui ${fmt(data.metrics.edas.questions)} questões mensuráveis no total.`,
      evidence: data.metrics.edas.questions < 300 ? 'Amostra global ainda curta' : 'Base tratada · matéria isolada',
      target: 'performance',
      subject: edas.name,
      scopeKey: 'edas',
    });
  }

  if (staleHours >= 24) {
    candidates.push({
      id: 'data:refresh',
      scope: 'Dados',
      tone: staleHours >= 48 ? 'danger' : 'warning',
      title: 'Atualizar o snapshot antes de tomar nova decisão',
      rationale: `A versão publicada tem aproximadamente ${Math.round(staleHours)} horas.`,
      evidence: 'meta.generatedAt',
      action: 'refresh',
    });
  }

  if (String(data.metrics?.finance?.status || '').toLowerCase().includes('parcial')) {
    candidates.push({
      id: 'finance:partial',
      scope: 'Investimentos',
      tone: 'neutral',
      title: 'Manter o financeiro como leitura parcial',
      rationale: 'O próprio snapshot classifica a consolidação financeira como parcial; não tratar ausência de evidência como zero.',
      evidence: 'metrics.finance.status',
      target: 'finance',
    });
  }

  if (days <= 7) {
    candidates.push({
      id: 'exam:final-window',
      scope: 'Reta final',
      tone: 'aqua',
      title: days === 0 ? 'Registrar a prova real e separar resultado de sensação' : `Usar os ${days} dias restantes para decisões de maior evidência`,
      rationale: days === 0 ? 'A contagem da prova chegou ao marco. O painel deve migrar de preparação para registro e análise.' : 'O horizonte curto favorece decisões sustentadas pelo que já foi medido, sem ampliar escopo por ansiedade.',
      evidence: 'Próximo marco do projeto',
      target: days === 0 ? 'exams' : 'performance',
    });
  }

  return candidates.slice(0, 6);
}

function decisionCounts(candidates) {
  const state = readDecisionState();
  return candidates.reduce((acc, item) => {
    const status = state[item.id]?.status || 'open';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { open: 0, adopted: 0, dismissed: 0 });
}

function statusLabel(status) {
  return status === 'adopted' ? 'Adotada' : status === 'dismissed' ? 'Descartada' : 'Aberta';
}

function decisionCard(item) {
  const state = readDecisionState();
  const status = state[item.id]?.status || 'open';
  return `<article class="v11-decision-card ${item.tone} ${status}" data-decision-id="${esc(item.id)}">
    <div class="v11-decision-top"><span class="v11-decision-scope">${esc(item.scope)}</span><span class="v11-decision-status">${statusLabel(status)}</span></div>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.rationale)}</p>
    <small>${esc(item.evidence)}</small>
    <div class="v11-decision-actions">
      ${status === 'open' ? `<button type="button" class="v11-adopt" data-v11-decision-status="adopted" data-v11-decision-id="${esc(item.id)}">${ICON.check} Adotar</button><button type="button" data-v11-decision-status="dismissed" data-v11-decision-id="${esc(item.id)}">${ICON.close} Descartar</button>` : `<button type="button" data-v11-decision-status="open" data-v11-decision-id="${esc(item.id)}">${ICON.refresh} Reabrir</button>`}
      ${item.target ? `<button type="button" data-v11-open-view="${item.target}" data-v11-scope="${item.scopeKey || ''}" data-v11-subject="${esc(item.subject || '')}">Abrir dado ${ICON.arrow}</button>` : item.action === 'refresh' ? `<button type="button" data-v11-refresh>Atualizar ${ICON.refresh}</button>` : ''}
    </div>
  </article>`;
}

async function renderCommandRail() {
  const view = $('.command-view');
  if (!view || $('#v11CommandRail')) return;
  const anchor = $('#managerNowBoard', view) || $('.manager-quick-grid', view) || $('.command-grid', view);
  if (!anchor) return;
  const rail = document.createElement('nav');
  rail.id = 'v11CommandRail';
  rail.className = 'v11-command-rail panel';
  rail.setAttribute('aria-label', 'Navegação da central Agora');
  rail.innerHTML = `
    <button class="active" type="button" data-v11-scroll="#managerNowBoard">Resumo</button>
    <button type="button" data-v11-scroll="#v11DecisionCenter">Decisões</button>
    <button type="button" data-v11-scroll="#v11AlertRadar">Alertas</button>
    <button type="button" data-v11-scroll="#v11WeeklyHorizon">Semana</button>`;
  anchor.before(rail);
}

async function renderDecisionCenter(force = false) {
  const view = $('.command-view');
  if (!view) return;
  if (force) $('#v11DecisionCenter', view)?.remove();
  if ($('#v11DecisionCenter', view)) return;
  const anchor = $('#managerExamToday', view) || $('.priority-grid', view) || $('.focus-board', view);
  if (!anchor) return;
  const data = await getSnapshot();
  if (!data || !document.contains(view)) return;
  const candidates = candidateDecisions(data);
  const counts = decisionCounts(candidates);

  const section = document.createElement('section');
  section.id = 'v11DecisionCenter';
  section.className = 'v11-decision-center panel';
  section.innerHTML = `
    <div class="v11-section-head">
      <div><span class="eyebrow">CENTRO DE DECISÕES</span><h2>Transformar dado em decisão rastreável.</h2><p>As sugestões vêm dos dados publicados; o status da decisão fica salvo apenas neste navegador.</p></div>
      <div class="v11-decision-kpis"><span><b>${counts.open}</b><small>abertas</small></span><span><b>${counts.adopted}</b><small>adotadas</small></span><span><b>${counts.dismissed}</b><small>descartadas</small></span></div>
    </div>
    <div class="v11-decision-grid">${candidates.map(decisionCard).join('')}</div>
    <div class="v11-local-note">${ICON.database}<span><strong>Persistência local</strong><small>Decisões não são enviadas ao Notion automaticamente. O painel deixa essa separação explícita.</small></span></div>`;
  anchor.before(section);
  updateDecisionHealth(candidates);
}

function alertItems(data) {
  const items = [];
  const stale = hoursSince(data.meta?.generatedAt);
  if (stale >= 24) items.push({ tone: stale >= 48 ? 'danger' : 'warning', title: 'Snapshot envelhecido', text: `${Math.round(stale)} horas desde a geração publicada.`, source: 'meta.generatedAt', target: 'sources' });
  const historicalLow = subjectRows('historical').filter((row) => row.questions >= 30 && row.accuracy < 80).slice(0, 2);
  historicalLow.forEach((row) => items.push({ tone: 'warning', title: row.name, text: `${pct(row.accuracy)} em ${fmt(row.questions)} questões históricas.`, source: 'Base temática tratada', target: 'performance', subject: row.name }));
  if (data.metrics.edas.questions < 300) items.push({ tone: 'neutral', title: 'EDAS com amostra curta', text: `${fmt(data.metrics.edas.questions)} questões mensuráveis: leitura ainda sensível a poucos blocos.`, source: 'metrics.edas.questions', target: 'performance', scope: 'edas' });
  if (String(data.metrics.finance.status || '').toLowerCase().includes('parcial')) items.push({ tone: 'neutral', title: 'Financeiro parcial', text: 'Totais confirmados continuam válidos; o conjunto não deve ser lido como fechamento definitivo.', source: 'metrics.finance.status', target: 'finance' });
  if (!items.length) items.push({ tone: 'good', title: 'Sem alerta estrutural aberto', text: 'Snapshot atual e nenhum sinal configurado ultrapassou o limiar de atenção.', source: 'Regras v11', target: 'sources' });
  return items.slice(0, 5);
}

async function renderAlertRadar() {
  const view = $('.command-view');
  if (!view || $('#v11AlertRadar')) return;
  const anchor = $('#v11DecisionCenter', view) || $('#managerExamToday', view) || $('.priority-grid', view);
  if (!anchor) return;
  const data = await getSnapshot();
  if (!data || !document.contains(view)) return;
  const alerts = alertItems(data);
  const section = document.createElement('section');
  section.id = 'v11AlertRadar';
  section.className = 'v11-alert-radar panel';
  section.innerHTML = `
    <div class="v11-section-head"><div><span class="eyebrow">ALERTAS RASTREÁVEIS</span><h2>Só acende quando existe uma regra verificável.</h2><p>Cada alerta mostra a origem. Nada de notificação dramática sem base — o painel já tem emoção suficiente na contagem regressiva.</p></div><span class="v11-head-icon">${ICON.bell}</span></div>
    <div class="v11-alert-list">${alerts.map((item) => `<button type="button" class="v11-alert ${item.tone}" data-v11-open-view="${item.target}" data-v11-scope="${item.scope || ''}" data-v11-subject="${esc(item.subject || '')}"><span class="v11-alert-dot"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p><small>Origem: ${esc(item.source)}</small></div><b>${ICON.arrow}</b></button>`).join('')}</div>`;
  anchor.after(section);
}

function horizonCopy(days) {
  if (days === 0) return {
    now: ['Registrar prova real', 'Separar memória da prova de resultado objetivo.'],
    next: ['Preservar evidências', 'Guardar gabarito, nota e critérios sem misturar percepção com dado.'],
    finish: ['Migrar o plano', 'Trocar a lógica de reta final por resultado, classificação e próximo ciclo.'],
  };
  if (days <= 7) return {
    now: ['Resolver o maior risco medido', 'Usar diagnóstico e prioridades para escolher onde colocar energia.'],
    next: ['Revalidar sinais', 'Atualizar o snapshot e conferir se o risco mudou após novos blocos.'],
    finish: ['Chegar com escopo controlado', 'Evitar abrir frentes novas sem evidência de retorno na reta final.'],
  };
  return {
    now: ['Manter cadência mensurável', 'Decidir com base em tendência, não em um único bloco.'],
    next: ['Revisar prioridades', 'Conferir evolução por matéria e tamanho das amostras.'],
    finish: ['Preparar o próximo marco', 'Converter progresso em decisões registradas antes da prova.'],
  };
}

async function renderWeeklyHorizon() {
  const view = $('.command-view');
  if (!view || $('#v11WeeklyHorizon')) return;
  const anchor = $('#v11AlertRadar', view) || $('#v11DecisionCenter', view) || $('.priority-grid', view);
  if (!anchor) return;
  const data = await getSnapshot();
  if (!data || !document.contains(view)) return;
  const days = daysToExam(data);
  const copy = horizonCopy(days);
  const section = document.createElement('section');
  section.id = 'v11WeeklyHorizon';
  section.className = 'v11-weekly panel';
  section.innerHTML = `
    <div class="v11-section-head"><div><span class="eyebrow">HORIZONTE OPERACIONAL</span><h2>Hoje, próximas 48 horas e próximo marco.</h2><p>Uma régua curta para impedir que a Home vire só um retrato bonito do passado.</p></div><span class="v11-head-icon">${ICON.week}</span></div>
    <div class="v11-week-grid">
      <article class="active"><span>01</span><small>AGORA</small><strong>${esc(copy.now[0])}</strong><p>${esc(copy.now[1])}</p></article>
      <article><span>02</span><small>PRÓXIMAS 48H</small><strong>${esc(copy.next[0])}</strong><p>${esc(copy.next[1])}</p></article>
      <article><span>03</span><small>${days === 0 ? 'PÓS-PROVA' : `ATÉ 06 SET · ${days}D`}</small><strong>${esc(copy.finish[0])}</strong><p>${esc(copy.finish[1])}</p></article>
    </div>`;
  anchor.after(section);
}

function addMoreDecisionTools() {
  const sheet = $('#moreSheet');
  if (!sheet || $('#v11DecisionOps', sheet)) return;
  const anchor = $('.manager-ecosystem-actions', sheet) || $('.sheet-actions', sheet) || $('.sheet-footnote', sheet);
  if (!anchor) return;
  const wrap = document.createElement('div');
  wrap.id = 'v11DecisionOps';
  wrap.className = 'v11-decision-ops';
  wrap.innerHTML = `
    <div class="sheet-section-label">Decisões locais</div>
    <div class="v11-ops-summary"><span>${ICON.decision}</span><div><small>Estado neste navegador</small><strong id="v11DecisionHealth">Nenhuma decisão registrada</strong></div></div>
    <button id="v11ExportDecisions" class="action-button" type="button"><span>${ICON.export}</span><span><b>Exportar decisões</b><small>Baixa um JSON com os estados locais e horários</small></span></button>`;
  anchor.after(wrap);
  getSnapshot().then((data) => { if (data) updateDecisionHealth(candidateDecisions(data)); });
}

function updateDecisionHealth(candidates = []) {
  const node = $('#v11DecisionHealth');
  if (!node) return;
  const counts = decisionCounts(candidates);
  node.textContent = `${counts.adopted} adotadas · ${counts.open} abertas · ${counts.dismissed} descartadas`;
}

function exportDecisionState() {
  const payload = {
    exportedAt: new Date().toISOString(),
    storage: 'localStorage',
    key: DECISION_KEY,
    decisions: readDecisionState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plano-de-transicao-decisoes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openManagedView(view, scope, subject) {
  const button = $(`[data-view="${view}"]`);
  button?.click();
  window.setTimeout(() => {
    if (view === 'performance' && scope) {
      const scopeButton = $(`[data-performance-scope="${scope}"]`);
      scopeButton?.click();
    }
    if (view === 'performance' && subject) {
      window.setTimeout(() => {
        const input = $('#subjectSearch');
        const grain = $('[data-performance-grain="subject"]');
        if (grain && !grain.classList.contains('active')) grain.click();
        if (input) {
          input.value = subject;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        $('#performanceBySubject')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, 80);
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const scroll = event.target.closest('[data-v11-scroll]');
    if (scroll) {
      event.preventDefault();
      $$('#v11CommandRail button').forEach((button) => button.classList.toggle('active', button === scroll));
      $(scroll.dataset.v11Scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const status = event.target.closest('[data-v11-decision-status]');
    if (status) {
      event.preventDefault();
      setDecisionStatus(status.dataset.v11DecisionId, status.dataset.v11DecisionStatus);
      renderDecisionCenter(true);
      return;
    }

    const open = event.target.closest('[data-v11-open-view]');
    if (open) {
      event.preventDefault();
      openManagedView(open.dataset.v11OpenView, open.dataset.v11Scope, open.dataset.v11Subject);
      return;
    }

    if (event.target.closest('[data-v11-refresh]')) {
      event.preventDefault();
      $('#refreshBtn')?.click();
      return;
    }

    if (event.target.closest('#v11ExportDecisions')) {
      event.preventDefault();
      exportDecisionState();
    }
  });
}

function renderEnhancements() {
  renderCommandRail();
  renderDecisionCenter();
  renderAlertRadar();
  renderWeeklyHorizon();
  addMoreDecisionTools();
}

const observer = new MutationObserver(() => {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderEnhancements();
  });
});

bindActions();
renderEnhancements();
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', renderEnhancements);
window.addEventListener('storage', (event) => {
  if (event.key === DECISION_KEY) renderDecisionCenter(true);
});
