import { treatedTopicalSeed, treatedActivitySeed } from '../data/treated-performance-data.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const pct = (value, digits = 1) => value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

let snapshot = null;
let snapshotPromise = null;
let renderQueued = false;

function svg(path) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}

const ICON = {
  radar: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18 6M12 3v2M3 12h2M12 19v2M19 12h2"/>'),
  arrow: svg('<path d="M5 12h14m-5-5 5 5-5 5"/>'),
  check: svg('<path d="m5 12 4 4L19 6"/>'),
  alert: svg('<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>'),
  chart: svg('<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>'),
  spark: svg('<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/>'),
};

async function getSnapshot() {
  if (snapshot) return snapshot;
  if (!snapshotPromise) {
    snapshotPromise = fetch(`data/snapshot.json?intelligence=${Date.now()}`, { cache: 'no-store' })
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

function subjectRows(scope) {
  return treatedTopicalSeed
    .filter((row) => row.scope === scope && row.grain === 'subject' && row.questions > 0)
    .map((row) => {
      const accuracy = row.correct / row.questions * 100;
      const errors = row.questions - row.correct;
      const evidence = Math.min(1, Math.log10(row.questions + 1) / 3);
      const priority = (100 - accuracy) * 0.72 + evidence * 16 + Math.min(errors, 100) / 10;
      return { ...row, accuracy, errors, priority };
    })
    .sort((a, b) => b.priority - a.priority || b.questions - a.questions);
}

function currentPerformanceScope() {
  return $('.performance-toolbar [data-performance-scope].active')?.dataset.performanceScope || 'historical';
}

function confidenceLabel(accuracy, questions) {
  if (questions < 30) return { label: 'amostra curta', tone: 'neutral' };
  if (accuracy >= 92) return { label: 'zona forte', tone: 'good' };
  if (accuracy >= 85) return { label: 'zona estável', tone: 'aqua' };
  if (accuracy >= 78) return { label: 'atenção', tone: 'warning' };
  return { label: 'prioridade', tone: 'danger' };
}

function scopeName(scope) {
  return scope === 'tdas' ? 'TDAS 202' : scope === 'edas' ? 'EDAS 400' : 'Histórico';
}

function daysToExam(data) {
  const target = new Date(data?.meta?.nextExam || '2026-09-06T08:00:00-03:00').getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

async function renderNowBoard() {
  const view = $('.command-view');
  if (!view || $('#managerNowBoard')) return;
  const anchor = $('.manager-quick-grid', view) || $('.command-grid', view);
  if (!anchor) return;
  const data = await getSnapshot();
  if (!data || !document.contains(view) || $('#managerNowBoard')) return;

  const tdasRows = subjectRows('tdas');
  const edasRows = subjectRows('edas');
  const weak = [...tdasRows.slice(0, 2), ...edasRows.slice(0, 2)].sort((a, b) => b.priority - a.priority)[0];
  const days = daysToExam(data);
  const generated = new Date(data.meta.generatedAt);
  const ageMinutes = Math.max(0, Math.round((Date.now() - generated.getTime()) / 60_000));
  const freshness = ageMinutes < 60 ? `${ageMinutes} min` : ageMinutes < 1440 ? `${Math.round(ageMinutes / 60)} h` : `${Math.round(ageMinutes / 1440)} d`;

  const section = document.createElement('section');
  section.id = 'managerNowBoard';
  section.className = 'manager-now-board panel';
  section.innerHTML = `
    <div class="manager-now-heading">
      <div><span class="eyebrow">AGORA</span><h2>O painel precisa responder antes de você perguntar.</h2><p>Leitura operacional gerada apenas com os dados publicados e tratados.</p></div>
      <span class="manager-now-badge">${ICON.clock}<strong>${days}</strong><small>dias para a prova</small></span>
    </div>
    <div class="manager-now-grid">
      <button type="button" data-view="performance" data-performance-scope-jump="tdas" class="manager-now-item">
        <span class="manager-now-icon good">${ICON.check}</span><div><small>TDAS 202</small><strong>${pct(data.metrics.tdas.accuracy)} · ${fmt(data.metrics.tdas.questions)} questões</strong><p>${data.metrics.tdas.stepsDone} de ${data.metrics.tdas.stepsTotal} etapas registradas.</p></div><b>→</b>
      </button>
      <button type="button" data-view="performance" data-performance-scope-jump="edas" class="manager-now-item">
        <span class="manager-now-icon aqua">${ICON.chart}</span><div><small>EDAS 400</small><strong>${pct(data.metrics.edas.accuracy)} · ${fmt(data.metrics.edas.questions)} questões</strong><p>Amostra menor: interpretar com mais cautela.</p></div><b>→</b>
      </button>
      <button type="button" data-view="performance" class="manager-now-item priority">
        <span class="manager-now-icon warning">${ICON.target}</span><div><small>Maior atenção mensurável</small><strong>${esc(weak?.name || 'Sem matéria tratada')}</strong><p>${weak ? `${scopeName(weak.scope)} · ${pct(weak.accuracy)} em ${fmt(weak.questions)} questões.` : 'Aguardando base temática.'}</p></div><b>→</b>
      </button>
      <button type="button" data-view="sources" class="manager-now-item">
        <span class="manager-now-icon">${ICON.shield}</span><div><small>Dados publicados</small><strong>${(data.meta.syncWarnings || []).length || (data.meta.dataWarnings || []).length ? 'Há ressalvas para revisar' : 'Snapshot reconciliado'}</strong><p>Gerado há ${freshness}. Fonte: Notion vivo.</p></div><b>→</b>
      </button>
    </div>`;
  anchor.before(section);
}

async function renderExamToday() {
  const view = $('.command-view');
  if (!view || $('#managerExamToday')) return;
  const reference = $('.priority-grid', view) || $('.focus-board', view) || $('.source-status-card', view);
  if (!reference) return;
  const data = await getSnapshot();
  if (!data || !document.contains(view) || $('#managerExamToday')) return;

  const scopes = [
    { key: 'tdas', label: 'TDAS 202', metrics: data.metrics.tdas },
    { key: 'edas', label: 'EDAS 400', metrics: data.metrics.edas },
  ];

  const panel = document.createElement('section');
  panel.id = 'managerExamToday';
  panel.className = 'manager-exam-today panel';
  panel.innerHTML = `
    <div class="manager-exam-copy"><span class="eyebrow">SE A PROVA FOSSE HOJE</span><h2>Leitura de preparação, não previsão de aprovação.</h2><p>O site usa somente volume e aproveitamento registrados. Não inventa nota de corte, posição ou probabilidade de nomeação.</p></div>
    <div class="manager-exam-scopes">${scopes.map(({ key, label, metrics }) => {
      const signal = confidenceLabel(metrics.accuracy, metrics.questions);
      const weakest = subjectRows(key)[0];
      return `<article><div><span>${label}</span><b class="manager-signal ${signal.tone}">${signal.label}</b></div><strong>${pct(metrics.accuracy)}</strong><small>${fmt(metrics.questions)} questões mensuráveis</small><p>${weakest ? `Ponto de atenção: ${esc(weakest.name)} (${pct(weakest.accuracy)}).` : 'Sem recorte temático suficiente.'}</p><button type="button" class="text-button" data-view="performance" data-performance-scope-jump="${key}">Abrir diagnóstico ${ICON.arrow}</button></article>`;
    }).join('')}</div>`;
  reference.before(panel);
}

function addPerformanceNavOptions(view) {
  const nav = $('.manager-performance-nav', view);
  if (!nav || $('[data-v10-performance="diagnostic"]', nav)) return;
  nav.insertAdjacentHTML('beforeend', `
    <button type="button" data-v10-performance="diagnostic"><span>${ICON.radar}</span><b>Diagnóstico</b><small>Riscos e sinais</small></button>
    <button type="button" data-v10-performance="priorities"><span>${ICON.target}</span><b>Prioridades</b><small>Ranking de atenção</small></button>`);
}

function renderPerformanceIntelligence() {
  const view = $('.performance-view');
  if (!view) return;
  addPerformanceNavOptions(view);
  if ($('#performanceDiagnostic', view)) return;

  const scope = currentPerformanceScope();
  const rows = subjectRows(scope);
  const top = rows.slice(0, 6);
  const strongest = [...rows].filter((row) => row.questions >= 30).sort((a, b) => b.accuracy - a.accuracy || b.questions - a.questions)[0];
  const weakest = top[0];
  const broad = rows.filter((row) => row.questions >= 100).length;
  const low = rows.filter((row) => row.questions >= 30 && row.accuracy < 80).length;
  const activityRows = treatedActivitySeed.filter((row) => row.scope === scope && row.questions > 0)
    .map((row) => ({ ...row, accuracy: row.correct / row.questions * 100 }))
    .sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions);

  const subjectPanel = $('.subject-panel', view);
  if (!subjectPanel) return;

  const diagnostic = document.createElement('section');
  diagnostic.id = 'performanceDiagnostic';
  diagnostic.className = 'manager-diagnostic panel';
  diagnostic.innerHTML = `
    <div class="manager-diagnostic-head"><div><span class="eyebrow">DIAGNÓSTICO · ${scopeName(scope).toUpperCase()}</span><h2>O que os números permitem afirmar agora</h2><p>Diagnóstico descritivo. Sem estimar aprovação, nota de corte ou causalidade.</p></div><span class="manager-diagnostic-icon">${ICON.radar}</span></div>
    <div class="manager-diagnostic-grid">
      <article><small>Maior atenção</small><strong>${esc(weakest?.name || '—')}</strong><span>${weakest ? `${pct(weakest.accuracy)} · ${fmt(weakest.questions)} questões` : 'Sem dado suficiente'}</span></article>
      <article><small>Área mais forte</small><strong>${esc(strongest?.name || '—')}</strong><span>${strongest ? `${pct(strongest.accuracy)} · ${fmt(strongest.questions)} questões` : 'Sem amostra mínima'}</span></article>
      <article><small>Cobertura robusta</small><strong>${fmt(broad)} matérias</strong><span>com pelo menos 100 questões tratadas</span></article>
      <article><small>Abaixo de 80%</small><strong>${fmt(low)} matérias</strong><span>com pelo menos 30 questões observadas</span></article>
    </div>
    <div class="manager-diagnostic-note">${ICON.spark}<p>${activityRows[0] ? `Entre as formas de estudo tratadas, <strong>${esc(activityRows[0].name)}</strong> apresenta o menor aproveitamento do recorte (${pct(activityRows[0].accuracy)} em ${fmt(activityRows[0].questions)} observações).` : 'Não há atividade tratada suficiente neste escopo.'}</p></div>`;

  const priorities = document.createElement('section');
  priorities.id = 'performancePriorities';
  priorities.className = 'manager-priority-panel panel';
  priorities.innerHTML = `
    <div class="manager-priority-head"><div><span class="eyebrow">PRIORIDADES</span><h2>Ranking de atenção por evidência</h2><p>O score combina erro observado, aproveitamento e tamanho da amostra. Ele ordena revisão; não mede importância do edital.</p></div><span class="manager-priority-count">TOP ${Math.min(6, top.length)}</span></div>
    <div class="manager-priority-list">${top.map((row, index) => {
      const status = confidenceLabel(row.accuracy, row.questions);
      return `<button type="button" data-v10-subject="${esc(row.name)}"><span class="manager-priority-rank">${String(index + 1).padStart(2, '0')}</span><div><strong>${esc(row.name)}</strong><small>${fmt(row.questions)} questões · ${fmt(row.errors)} erros</small></div><span class="manager-priority-score"><b>${pct(row.accuracy)}</b><small class="${status.tone}">${status.label}</small></span></button>`;
    }).join('') || '<div class="manager-empty">Sem matéria tratada neste escopo.</div>'}</div>`;

  subjectPanel.before(diagnostic, priorities);
}

function enhanceMoreOperations() {
  const sheet = $('#moreSheet');
  if (!sheet || $('#managerHealthGrid', sheet)) return;
  const status = $('.manager-ops-status', sheet);
  if (status) {
    status.insertAdjacentHTML('afterend', `
      <div id="managerHealthGrid" class="manager-health-grid">
        <div><small>Rede</small><strong id="managerHealthNetwork">${navigator.onLine ? 'Online' : 'Offline'}</strong></div>
        <div><small>Cache PWA</small><strong id="managerHealthCache">Verificando</strong></div>
        <div><small>Interface</small><strong>v10</strong></div>
      </div>`);
  }
  const ecosystem = $('.manager-ecosystem-actions', sheet);
  if (ecosystem) {
    ecosystem.insertAdjacentHTML('beforeend', `
      <a class="action-button" href="https://github.com/RodrigoRosaDantas/plano-de-transicao" target="_blank" rel="noreferrer"><span data-icon="database"></span><span><b>Repositório GitHub</b><small>Código, histórico e Pull Requests</small></span></a>
      <button id="managerClearCacheBtn" class="action-button" type="button"><span data-icon="refresh"></span><span><b>Limpar cache do app</b><small>Remove apenas o cache PWA; não apaga progresso de questões</small></span></button>
      <button id="managerReloadBtn" class="action-button" type="button"><span data-icon="refresh"></span><span><b>Recarregar interface</b><small>Força uma nova leitura da versão publicada</small></span></button>`);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('v10:hydrate-icons')), 0);
  }
  updateCacheHealth();
}

async function updateCacheHealth() {
  const node = $('#managerHealthCache');
  if (!node) return;
  if (!('caches' in window)) {
    node.textContent = 'Indisponível';
    return;
  }
  try {
    const keys = await caches.keys();
    const plan = keys.filter((key) => key.startsWith('plano-transicao'));
    node.textContent = plan.length ? `${plan.length} ativo` : 'Vazio';
  } catch {
    node.textContent = 'Não lido';
  }
}

function bindActions() {
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('[data-v10-performance]');
    if (nav) {
      event.preventDefault();
      $$('.manager-performance-nav button').forEach((button) => button.classList.remove('active'));
      nav.classList.add('active');
      const target = nav.dataset.v10Performance === 'diagnostic' ? '#performanceDiagnostic' : '#performancePriorities';
      $(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const subject = event.target.closest('[data-v10-subject]');
    if (subject) {
      const grain = $('[data-performance-grain="subject"]');
      if (grain && !grain.classList.contains('active')) grain.click();
      window.setTimeout(() => {
        const input = $('#subjectSearch');
        if (!input) return;
        input.value = subject.dataset.v10Subject;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        $('#performanceBySubject')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }

    if (event.target.closest('#managerClearCacheBtn')) {
      event.preventDefault();
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('plano-transicao')).map((key) => caches.delete(key)));
      updateCacheHealth();
      const toast = $('#toast');
      if (toast) {
        toast.textContent = 'Cache do Plano limpo. Seus dados locais de questões foram preservados.';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3200);
      }
      return;
    }

    if (event.target.closest('#managerReloadBtn')) {
      event.preventDefault();
      location.reload();
      return;
    }

    const refresh = event.target.closest('#refreshBtn, #managerRefreshBtn, #refreshPublished');
    if (refresh) {
      const main = $('#refreshBtn');
      if (main) {
        main.dataset.v10Loading = 'true';
        const label = $('b', main);
        if (label) label.textContent = 'Atualizando';
        window.setTimeout(() => {
          main.dataset.v10Loading = 'false';
          if (label) label.textContent = 'Atualizar';
        }, 1800);
      }
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-manager-performance]')) {
      $$('[data-v10-performance]').forEach((button) => button.classList.remove('active'));
    }
  });

  window.addEventListener('online', () => { const n = $('#managerHealthNetwork'); if (n) n.textContent = 'Online'; });
  window.addEventListener('offline', () => { const n = $('#managerHealthNetwork'); if (n) n.textContent = 'Offline'; });
}

function renderEnhancements() {
  renderNowBoard();
  renderExamToday();
  renderPerformanceIntelligence();
  enhanceMoreOperations();
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
window.addEventListener('v10:hydrate-icons', () => {
  // O app-base hidrata data-icon em mutações próprias. Este evento apenas força uma mutação inofensiva quando necessário.
  const sheet = $('#moreSheet');
  if (sheet) sheet.dataset.v10 = 'ready';
});
