import { treatedTopicalSeed, treatedActivitySeed } from "../data/treated-performance-data.js";

const PLATFORM_BASE = "../sedes-df-questoes/";
const STUDY_ROUTES = [
  { id: "inicio", label: "Início", icon: "dashboard", href: `${PLATFORM_BASE}#/inicio` },
  { id: "estudar", label: "Estudar", icon: "book", href: `${PLATFORM_BASE}#/estudar` },
  { id: "cargo", label: "Por cargo", icon: "layers", href: `${PLATFORM_BASE}estudo-por-cargo.html` },
  { id: "revisar", label: "Revisar", icon: "refresh", href: `${PLATFORM_BASE}#/revisar` },
  { id: "desempenho", label: "Desempenho", icon: "chart", href: `${PLATFORM_BASE}#/desempenho` },
  { id: "prova", label: "Prova real", icon: "flag", href: `${PLATFORM_BASE}#/inicio` },
];

const VIEW_NAMES = {
  command: "Agora",
  study: "Estudar",
  performance: "Desempenho",
  journey: "Jornada",
  exams: "Concursos",
  finance: "Investimentos",
  strategy: "Estratégia",
  sources: "Fontes",
};

const ICONS = {
  dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M20.5 14.2A8 8 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  book: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Zm16 0A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/>',
  chart: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
  flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
  wallet: '<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M15 11h7v4h-7a2 2 0 0 1 0-4Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  export: '<path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v7H4V6h7"/>',
  external: '<path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v7H4V6h7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  spark: '<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>',
};

const state = {
  data: null,
  view: "command",
  studyRoute: sessionStorage.getItem("plano.study.route") || "inicio",
  performance: { scope: "historical", grain: "subject", sort: "questions", query: "" },
  finance: { cycle: "Todos", category: "Todas", situation: "Todas", query: "" },
  strategyStage: "all",
  searchIndex: [],
  deferredPrompt: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
const pct = (value, digits = 2) => value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const money = (value) => value == null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (value, short = false) => {
  if (!value) return "—";
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00-03:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", short ? { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" } : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date).replace(".", "");
};
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value || 0)));

function svgIcon(name, label = "") {
  const title = label ? `<title>${esc(label)}</title>` : "";
  return `<svg viewBox="0 0 24 24" aria-hidden="${label ? "false" : "true"}" focusable="false">${title}${ICONS[name] || ICONS.spark}</svg>`;
}

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((node) => { node.innerHTML = svgIcon(node.dataset.icon); });
}

function toast(message) {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(window.__planToast);
  window.__planToast = setTimeout(() => node.classList.remove("show"), 2800);
}

function progress(value) {
  return `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${clamp(value).toFixed(1)}"><i style="width:${clamp(value).toFixed(2)}%"></i></div>`;
}

function viewHeading(kicker, title, description, actions = "") {
  return `<header class="view-heading"><div><span class="eyebrow">${esc(kicker)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${actions ? `<div class="view-heading-actions">${actions}</div>` : ""}</header>`;
}

function metricCard(label, value, note, tone = "") {
  return `<article class="panel metric-card ${tone}"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(note)}</small></article>`;
}

function statusChip(label, tone = "") {
  return `<span class="status-chip ${tone}">${esc(label)}</span>`;
}

function localStudyState() {
  try {
    const active = localStorage.getItem("sedes.questoes.activeProfile.v3") || "rodrigo";
    const read = (suffix, fallback) => {
      const direct = localStorage.getItem(`sedes.questoes.${active}.${suffix}.v3`);
      if (direct) return JSON.parse(direct);
      const key = Object.keys(localStorage).find((item) => item.startsWith("sedes.questoes.") && item.endsWith(`.${suffix}.v3`));
      return key ? JSON.parse(localStorage.getItem(key)) : fallback;
    };
    const histories = read("history", []);
    const errors = read("errors", {});
    const marked = read("marked", {});
    const session = read("session", null);
    const list = Array.isArray(histories) ? histories : [];
    const answered = list.reduce((sum, item) => sum + Number(item.answered ?? item.questionResults?.length ?? 0), 0);
    const correct = list.reduce((sum, item) => sum + Number(item.correct ?? item.questionResults?.filter((row) => row.correct).length ?? 0), 0);
    const total = Number(session?.questions?.length || 0);
    const current = Number(session?.current || 0);
    return {
      available: Boolean(list.length || session || Object.keys(errors || {}).length || Object.keys(marked || {}).length),
      answered,
      correct,
      accuracy: answered ? (correct / answered) * 100 : null,
      errors: Object.keys(errors || {}).length,
      marked: Object.keys(marked || {}).length,
      session,
      current,
      total,
    };
  } catch {
    return { available: false, answered: 0, correct: 0, accuracy: null, errors: 0, marked: 0, session: null, current: 0, total: 0 };
  }
}

function countdownParts() {
  const target = new Date(state.data?.meta?.nextExam || "2026-09-06T08:00:00-03:00");
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    ended: false,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

function scopeMetrics(scope) {
  const metrics = state.data.metrics;
  if (scope === "tdas") return { label: "TDAS 202", questions: metrics.tdas.questions, correct: metrics.tdas.hits, errors: metrics.tdas.errors, accuracy: metrics.tdas.accuracy };
  if (scope === "edas") return { label: "EDAS 400", questions: metrics.edas.questions, correct: metrics.edas.hits, errors: metrics.edas.errors, accuracy: metrics.edas.accuracy };
  return { label: "Histórico reconciliado", questions: metrics.history.questions, correct: metrics.history.hits, errors: metrics.history.errors, accuracy: metrics.history.accuracy };
}

function subjectRows(scope = state.performance.scope, grain = state.performance.grain) {
  const query = normalize(state.performance.query);
  const rows = treatedTopicalSeed
    .filter((row) => row.scope === scope && row.grain === grain)
    .map((row) => ({ ...row, errors: row.questions - row.correct, accuracy: row.questions ? (row.correct / row.questions) * 100 : 0 }))
    .filter((row) => !query || normalize(`${row.name} ${row.sourceKeys.join(" ")}`).includes(query));
  const sorter = state.performance.sort === "accuracy"
    ? (a, b) => a.accuracy - b.accuracy || b.questions - a.questions
    : state.performance.sort === "errors"
      ? (a, b) => b.errors - a.errors || b.questions - a.questions
      : (a, b) => b.questions - a.questions || a.name.localeCompare(b.name, "pt-BR");
  return rows.sort(sorter);
}

function weakest(scope, grain = "subject") {
  return treatedTopicalSeed
    .filter((row) => row.scope === scope && row.grain === grain && row.questions >= (scope === "historical" ? 30 : 5))
    .map((row) => ({ ...row, accuracy: row.correct / row.questions * 100 }))
    .sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions)[0];
}

function lineChart(items) {
  if (!items.length) return "";
  const width = 760, height = 250, padX = 42, padY = 28;
  const values = items.map((item) => Number(item.accuracy || 0));
  const min = Math.max(0, Math.floor(Math.min(...values) / 5) * 5 - 5);
  const max = Math.min(100, Math.ceil(Math.max(...values) / 5) * 5 + 5);
  const range = Math.max(1, max - min);
  const points = items.map((item, index) => {
    const x = padX + (items.length === 1 ? 0 : index / (items.length - 1)) * (width - padX * 2);
    const y = padY + (max - item.accuracy) / range * (height - padY * 2);
    return { x, y, item };
  });
  const grid = [0, .25, .5, .75, 1].map((step) => {
    const y = padY + step * (height - padY * 2);
    const value = max - step * range;
    return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}"/><text x="5" y="${y + 4}">${value.toFixed(0)}%</text>`;
  }).join("");
  return `<div class="chart-scroll"><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Aproveitamento por ciclo"><g class="chart-grid">${grid}</g><polyline class="chart-line" points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"/>${points.map((point, index) => `<g class="chart-point"><circle cx="${point.x}" cy="${point.y}" r="5"><title>${esc(point.item.name)}: ${pct(point.item.accuracy)}</title></circle><text x="${point.x}" y="${height - 6}" text-anchor="middle">${String(index + 1).padStart(2, "0")}</text></g>`).join("")}</svg></div><ol class="chart-legend">${items.map((item, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span>${esc(item.name)}</span><strong>${pct(item.accuracy)}</strong></li>`).join("")}</ol>`;
}

function horizontalBars(items, valueKey = "questions", formatter = fmt, maxRows = 10) {
  const rows = items.slice(0, maxRows);
  const max = Math.max(1, ...rows.map((item) => Number(item[valueKey] || 0)));
  return `<div class="horizontal-bars">${rows.map((item) => `<div class="horizontal-bar"><div><strong>${esc(item.name || item.label || item.key)}</strong><small>${item.questions != null && valueKey !== "questions" ? `${fmt(item.questions)} questões · ` : ""}${formatter(item[valueKey])}</small></div><div class="bar-track"><i style="width:${clamp(Number(item[valueKey] || 0) / max * 100)}%"></i></div><b>${formatter(item[valueKey])}</b></div>`).join("")}</div>`;
}

function commandView() {
  const data = state.data;
  const m = data.metrics;
  const clock = countdownParts();
  const tdasProgress = m.tdas.stepsTotal ? m.tdas.stepsDone / m.tdas.stepsTotal * 100 : 0;
  const local = localStudyState();
  const tdasWeak = weakest("tdas");
  const edasWeak = weakest("edas");
  const historicalWeak = weakest("historical");
  const focus = [tdasWeak, edasWeak, historicalWeak].filter(Boolean);
  const sourceReady = data.meta.live && !(data.meta.syncWarnings || []).length;
  return `<div class="view-stack command-view">
    <section class="cockpit-grid">
      <article class="panel countdown-card">
        <div class="countdown-topline"><span class="section-kicker">${svgIcon("clock")} Prova SEDES/DF</span><span>06/09/2026 · Brasília</span></div>
        <div class="countdown-body"><div class="countdown-value"><strong data-countdown-days>${clock.days}</strong><span>${clock.ended ? "prova realizada" : "dias"}</span></div><div class="brasilia-clock">${svgIcon("clock")}<div><strong data-brasilia-clock>--:--:--</strong><span data-brasilia-date>horário de Brasília</span></div></div></div>
        <p>${clock.ended ? "A contagem terminou. Agora o plano muda de preparação para registro de prova, resultado e decisão seguinte." : "Duas provas, duas trilhas. A reta final pede precisão: preservar o que já está forte e atacar apenas o erro que ainda custa ponto."}</p>
      </article>
      <div class="target-stack">
        <button class="panel target-card" type="button" data-view="performance" data-performance-scope-jump="tdas">
          <div class="target-card-top"><span>${svgIcon("target")} Técnico Administrativo</span><b>Cargo 202</b></div>
          <div class="target-card-main"><div><small>Projeto TDAS</small><h2>${m.tdas.stepsDone} de ${m.tdas.stepsTotal} etapas</h2></div><strong>${pct(m.tdas.accuracy)}</strong></div>
          ${progress(tdasProgress)}<div class="target-card-footer"><span>${fmt(m.tdas.questions)} questões · ${fmt(m.tdas.errors)} erros</span><span>Abrir ${svgIcon("chevron")}</span></div>
        </button>
        <button class="panel target-card edas" type="button" data-view="performance" data-performance-scope-jump="edas">
          <div class="target-card-top"><span>${svgIcon("layers")} Administração</span><b>Cargo 400</b></div>
          <div class="target-card-main"><div><small>Projeto EDAS</small><h2>${fmt(m.edas.questions)} questões tratadas</h2></div><strong>${pct(m.edas.accuracy)}</strong></div>
          ${progress(m.edas.accuracy)}<div class="target-card-footer"><span>${fmt(m.edas.errorNotebook)} itens no caderno · ${fmt(m.edas.caseStudies)} casos</span><span>Abrir ${svgIcon("chevron")}</span></div>
        </button>
      </div>
    </section>

    <section class="command-grid">
      <article class="panel study-command-card"><div class="study-command-profile"><span class="profile-orb">RR</span><div><span>Área pessoal de estudo</span><strong>${local.available ? "Progresso local encontrado" : "Plataforma pronta para estudar"}</strong></div></div><h2>${local.session ? `Retome da questão ${Math.min(local.current + 1, local.total || local.current + 1)}.` : "Entre no estudo sem sair do plano."}</h2><p>${local.available ? `${fmt(local.answered)} respostas locais, ${fmt(local.errors)} erros abertos e ${fmt(local.marked)} marcações. Esses dados continuam no seu navegador.` : "A Plataforma de Questões abre integrada, com módulos de estudo, revisão, desempenho e prova real."}</p><div class="command-actions"><button class="primary-button" type="button" data-view="study" data-study-jump="${local.session ? "estudar" : "inicio"}">${svgIcon("play")} ${local.session ? "Retomar tentativa" : "Abrir plataforma"}</button><button class="secondary-button" type="button" data-view="study" data-study-jump="revisar">${svgIcon("refresh")} Revisar erros</button></div></article>
      <article class="panel action-card"><div><span class="eyebrow">DECISÃO OPERACIONAL</span><h2>Seu trabalho agora é converter volume em ponto líquido.</h2></div><p><strong>${fmt(m.history.questions)} questões mensuráveis</strong> já formam uma base rara. O ganho marginal está menos em “ver tudo” e mais em escolher o próximo bloco com frieza.</p><div class="command-actions"><button class="primary-button" type="button" data-view="performance">${svgIcon("chart")} Ver prioridades</button><button class="secondary-button" type="button" data-view="exams">${svgIcon("flag")} Régua de prova real</button><button class="secondary-button" type="button" data-view="finance">${svgIcon("wallet")} Ver investimento</button></div></article>
    </section>

    <section class="priority-grid" aria-label="Prioridades por dados">
      ${[tdasWeak, edasWeak, historicalWeak].map((row, index) => row ? `<article class="panel priority-card ${index === 1 ? "aqua" : index === 2 ? "coral" : ""}"><div class="priority-card-head"><span>${index === 0 ? "Atenção TDAS" : index === 1 ? "Atenção EDAS" : "Risco histórico"}</span><strong>${pct(row.accuracy, 1)}</strong></div><h3>${esc(row.name)}</h3><p>${fmt(row.questions)} questões · ${fmt(row.questions - row.correct)} erros observados no recorte tratado.</p>${progress(row.accuracy)}<button class="text-button" type="button" data-open-subject="${esc(row.name)}" data-open-scope="${row.scope}">Analisar matéria ${svgIcon("arrow")}</button></article>` : "").join("")}
    </section>

    <section class="panel focus-board"><div class="focus-board-heading"><div><span class="eyebrow">FOCO ORIENTADO POR DADOS</span><h2>Três pontos que merecem o próximo clique</h2><p>Matérias aparecem separadas de revisões, simulados e blocos combinados.</p></div><button class="secondary-button" type="button" data-view="performance">Painel completo</button></div><div class="focus-list">${focus.map((row, index) => `<button type="button" data-open-subject="${esc(row.name)}" data-open-scope="${row.scope}"><span class="focus-order">0${index + 1}</span><div><strong>${esc(row.name)}</strong><small>${row.scope === "tdas" ? "TDAS 202" : row.scope === "edas" ? "EDAS 400" : "Histórico"} · ${fmt(row.questions)} questões</small></div><span class="focus-stat">${pct(row.accuracy, 1)}</span></button>`).join("")}</div></section>

    <section class="panel journey-mini"><div class="panel-heading"><div><span class="eyebrow">JORNADA DA TRANSIÇÃO</span><h2>O plano não termina na prova</h2></div><button class="text-button" type="button" data-view="journey">Ver linha do tempo ${svgIcon("arrow")}</button></div><div class="journey-flow">${["Retomada", "Base", "Prova real", "Reta final", "SEDES/DF", "Resultado", "Posse"].map((label, index) => `<div class="journey-node ${index < 4 ? "done" : index === 4 ? "active" : ""}"><i></i><strong>${label}</strong><small>${["jul/25", "2025", "mar/26", "ago/26", "set/26", "próximo", "destino"][index]}</small></div>`).join("")}</div></section>

    <section class="panel source-status-card"><div class="source-status-icon ${sourceReady ? "ready" : ""}">${svgIcon(sourceReady ? "shield" : "alert")}</div><div><span class="eyebrow">ESTADO DOS DADOS</span><h2>${sourceReady ? "Snapshot reconciliado e sem alertas" : "Último snapshot preservado com ressalvas"}</h2><p>${dateBR(data.meta.generatedAt)} · ${esc(data.meta.source)} · ${fmt(data.metrics.history.rawRecords)} registros brutos.</p></div><button class="text-button" type="button" data-view="sources">Abrir auditoria ${svgIcon("arrow")}</button></section>
  </div>`;
}

function studyView() {
  const local = localStudyState();
  const route = STUDY_ROUTES.find((item) => item.id === state.studyRoute) || STUDY_ROUTES[0];
  const actions = `<a class="secondary-button" href="${route.href}" target="_blank" rel="noreferrer">${svgIcon("external")} Abrir em nova aba</a>`;
  return `<div class="view-stack study-view">${viewHeading("Estudar", "A Plataforma de Questões mora aqui.", "Mesma origem, mesmo progresso e uma navegação única. O Plano organiza; a plataforma executa.", actions)}
    <section class="study-hero"><article class="panel study-profile-panel"><span class="eyebrow">CONTINUIDADE LOCAL</span><h2>${local.session ? "Há uma tentativa esperando por você." : "O próximo bloco começa daqui."}</h2><p>${local.available ? `Detectei ${fmt(local.answered)} respostas, ${fmt(local.errors)} erros abertos e ${fmt(local.marked)} questões marcadas neste navegador.` : "O histórico local aparecerá aqui assim que você usar a Plataforma de Questões neste aparelho."}</p><div class="command-actions"><button class="primary-button" type="button" data-study-route="${local.session ? "estudar" : "inicio"}">${svgIcon("play")} ${local.session ? "Retomar agora" : "Começar"}</button><button class="secondary-button" type="button" data-study-route="revisar">${svgIcon("refresh")} Revisar</button></div></article><div class="study-quick-grid">${metricCard("Respondidas neste aparelho", fmt(local.answered), "Histórico salvo localmente", "aqua")}${metricCard("Aproveitamento local", local.accuracy == null ? "—" : pct(local.accuracy), local.accuracy == null ? "Ainda sem base local" : `${fmt(local.correct)} acertos`, "lime")}${metricCard("Erros abertos", fmt(local.errors), "Disponíveis para revisão", "coral")}${metricCard("Questões marcadas", fmt(local.marked), "Fila pessoal de retorno", "amber")}</div></section>
    <section class="panel study-route-bar"><div class="study-route-tabs" role="tablist" aria-label="Módulos da Plataforma de Questões">${STUDY_ROUTES.map((item) => `<button type="button" role="tab" aria-selected="${item.id === route.id}" class="${item.id === route.id ? "active" : ""}" data-study-route="${item.id}">${svgIcon(item.icon)} ${esc(item.label)}</button>`).join("")}</div><div class="workspace-mini-actions"><button class="icon-button" type="button" data-frame-reload title="Recarregar módulo" aria-label="Recarregar módulo">${svgIcon("refresh")}</button><button class="icon-button" type="button" data-frame-fullscreen title="Tela cheia" aria-label="Tela cheia">${svgIcon("fullscreen")}</button></div></section>
    <section class="panel workspace-shell" id="studyWorkspace" data-study-route="${route.id}"><div class="workspace-toolbar"><span>${svgIcon("link")} <strong id="workspaceRouteLabel">${esc(route.label)}</strong> · progresso preservado na Plataforma</span><span id="workspaceState">carregando módulo…</span></div><div class="workspace-frame-wrap"><div id="workspaceLoading" class="workspace-loading"><span class="loading-orbit"></span><strong>Carregando ${esc(route.label)}…</strong></div><iframe class="study-workspace-frame" id="studyWorkspaceFrame" title="${esc(route.label)} — Plataforma de Questões" src="${route.href}" loading="eager" allow="fullscreen" referrerpolicy="same-origin"></iframe></div></section>
    <section class="panel study-local-note"><span class="eyebrow">COMO OS DADOS SE DIVIDEM</span><p>Os indicadores oficiais do Plano vêm do snapshot reconciliado do Notion. Tentativa em andamento, marcações e preferências continuam no navegador. Assim, o painel não inventa sincronização onde ela não existe — bonito, útil e honesto. Trinca rara.</p></section>
  </div>`;
}

function performanceView() {
  const scope = state.performance.scope;
  const grain = state.performance.grain;
  const metrics = scopeMetrics(scope);
  const rows = subjectRows();
  const allRows = treatedTopicalSeed.filter((row) => row.scope === scope && row.grain === grain);
  const mappedQuestions = allRows.reduce((sum, row) => sum + row.questions, 0);
  const mappedCorrect = allRows.reduce((sum, row) => sum + row.correct, 0);
  const mappedAccuracy = mappedQuestions ? mappedCorrect / mappedQuestions * 100 : 0;
  const activities = treatedActivitySeed.filter((row) => row.scope === scope).map((row) => ({ ...row, accuracy: row.correct / row.questions * 100 })).sort((a, b) => b.questions - a.questions);
  const cycles = [...state.data.historyCycles].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const scopeLabel = scope === "historical" ? "Histórico" : scope.toUpperCase();
  const grainLabel = grain === "subject" ? "Matérias" : grain === "combination" ? "Combinações" : "Atividades";
  const ring = `style="--score:${clamp(metrics.accuracy) * 3.6}deg"`;
  return `<div class="view-stack performance-view">${viewHeading("Desempenho", "Do consolidado até a matéria — sem misturar grãos.", "O painel separa matérias, combinações e atividades. Você pode comparar escopos sem somar snapshots cumulativos.", `<button class="secondary-button" type="button" data-copy-performance>${svgIcon("copy")} Copiar resumo</button>`)}
    <section class="performance-toolbar panel"><div><span>Escopo</span><div class="segmented">${[["historical", "Histórico"], ["tdas", "TDAS 202"], ["edas", "EDAS 400"]].map(([value, label]) => `<button type="button" class="${scope === value ? "active" : ""}" data-performance-scope="${value}">${label}</button>`).join("")}</div></div><div><span>Grão</span><div class="segmented">${[["subject", "Matérias"], ["combination", "Combinações"], ["activity", "Atividades"]].map(([value, label]) => `<button type="button" class="${grain === value ? "active" : ""}" data-performance-grain="${value}">${label}</button>`).join("")}</div></div><label class="filter-input">${svgIcon("search")}<input id="subjectSearch" type="search" value="${esc(state.performance.query)}" placeholder="Buscar matéria ou fonte…" /></label></section>
    <section class="performance-hero"><article class="panel performance-score"><div class="panel-heading"><div><span class="eyebrow">${scopeLabel} · indicador reconciliado</span><h2>${esc(metrics.label)}</h2></div>${statusChip("Fonte auditada", "good")}</div><div class="score-layout"><div class="score-ring" ${ring}><div><strong>${pct(metrics.accuracy)}</strong><span>aproveitamento</span></div></div><div class="score-copy"><p>Base mensurável do escopo</p><h3>${fmt(metrics.questions)} questões</h3><span>${fmt(metrics.correct)} acertos · ${fmt(metrics.errors)} erros</span><div class="score-pairs"><span>${svgIcon("check")} ${pct(100 - metrics.errors / Math.max(1, metrics.questions) * 100, 1)} certas</span><span>${svgIcon("error")} ${pct(metrics.errors / Math.max(1, metrics.questions) * 100, 1)} erradas</span></div></div></div></article><article class="panel mapping-card"><div class="panel-heading"><div><span class="eyebrow">COBERTURA DO RECORTE</span><h2>${grainLabel}</h2></div>${svgIcon("layers")}</div><div class="mapping-number"><strong>${fmt(mappedQuestions)}</strong><span>observações neste grão</span></div><div class="mapping-stats"><div><small>Linhas tratadas</small><strong>${fmt(allRows.length)}</strong></div><div><small>Acertos</small><strong>${fmt(mappedCorrect)}</strong></div><div><small>Aproveitamento</small><strong>${pct(mappedAccuracy)}</strong></div></div><p>Esse total descreve apenas o grão selecionado. Não é somado aos demais grãos.</p></article></section>
    <section class="metric-grid">${metricCard("Questões mensuráveis", fmt(metrics.questions), metrics.label, "aqua")}${metricCard("Acertos", fmt(metrics.correct), pct(metrics.accuracy), "lime")}${metricCard("Erros", fmt(metrics.errors), `${pct(metrics.errors / Math.max(1, metrics.questions) * 100, 1)} da base`, "coral")}${metricCard("Linhas exibidas", fmt(rows.length), `${grainLabel} após filtros`, "violet")}</section>
    <section class="performance-chart-grid"><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">EVOLUÇÃO POR CICLO</span><h2>Aproveitamento em bases independentes</h2><p>O eixo mostra eficiência; o volume aparece na legenda para impedir leitura apressada.</p></div>${svgIcon("chart")}</div>${lineChart(cycles)}</article><article class="panel chart-panel activity-panel"><div class="panel-heading"><div><span class="eyebrow">FORMA DE ESTUDO</span><h2>Atividades no ${scopeLabel}</h2></div>${svgIcon("spark")}</div>${activities.length ? horizontalBars(activities, "questions", fmt, 8) : '<div class="empty-inline">Sem atividades tratadas neste escopo.</div>'}</article></section>
    <section class="panel subject-panel"><div class="subject-panel-head"><div><span class="eyebrow">DESEMPENHO POR ${grainLabel.toUpperCase()}</span><h2>${fmt(rows.length)} linhas após o tratamento</h2><p>Acertos e erros são recalculados diretamente da base tratada.</p></div><label class="sort-control">Ordenar<select id="subjectSort"><option value="questions" ${state.performance.sort === "questions" ? "selected" : ""}>Maior volume</option><option value="accuracy" ${state.performance.sort === "accuracy" ? "selected" : ""}>Menor aproveitamento</option><option value="errors" ${state.performance.sort === "errors" ? "selected" : ""}>Mais erros</option></select></label></div><div class="subject-table-wrap"><table class="data-table subject-table"><thead><tr><th>${grainLabel.slice(0, -1) || grainLabel}</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>Aproveitamento</th><th>Leitura</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong><small>${row.sourceKeys.length} fonte(s) · ${esc(row.scope)}</small></td><td>${fmt(row.questions)}</td><td>${fmt(row.correct)}</td><td>${fmt(row.errors)}</td><td><div class="table-progress"><span>${pct(row.accuracy)}</span>${progress(row.accuracy)}</div></td><td>${statusChip(row.accuracy >= 90 ? "consolidar" : row.accuracy >= 80 ? "revisar" : "prioridade", row.accuracy >= 90 ? "good" : row.accuracy >= 80 ? "warning" : "danger")}</td></tr>`).join("") || '<tr><td colspan="6"><div class="empty-inline">Nenhuma linha encontrada com esses filtros.</div></td></tr>'}</tbody></table></div></section>
    <section class="panel method-card"><div>${svgIcon("shield")}</div><div><span class="eyebrow">REGRA DE LEITURA</span><h2>Matéria não é revisão. Revisão não é simulado. Combinação não é matéria isolada.</h2><p>O tratamento preserva o nome do que realmente foi medido. Essa separação impede que um bloco misto seja falsamente atribuído a uma única disciplina.</p></div><button class="text-button" type="button" data-view="sources">Ver método ${svgIcon("arrow")}</button></section>
  </div>`;
}

function journeyView() {
  const data = state.data;
  const m = data.metrics.history;
  return `<div class="view-stack journey-view">${viewHeading("Jornada", "Uma transição construída, não um recomeço eterno.", "Cada marco conserva o capital anterior e muda a próxima decisão.", `<button class="secondary-button" type="button" data-copy-journey>${svgIcon("copy")} Copiar jornada</button>`)}
    <section class="metric-grid">${metricCard("Início da preparação", "03/07/2025", "Retomada estruturada", "aqua")}${metricCard("Capital mensurável", fmt(m.questions), `${pct(m.accuracy)} de aproveitamento`, "lime")}${metricCard("Provas reais", fmt(data.exams.filter((exam) => exam.rawAccuracy != null).length), "Réguas externas registradas", "amber")}${metricCard("Próximo marco", dateBR(data.meta.nextExam, true).toUpperCase(), "SEDES/DF", "violet")}</section>
    <section class="journey-layout"><article class="panel timeline-panel"><div class="panel-heading"><div><span class="eyebrow">LINHA DO TEMPO</span><h2>Marcos que mudaram a trajetória</h2></div>${svgIcon("route")}</div><div class="timeline-list">${data.timeline.map((item, index) => `<article class="timeline-item ${index === data.timeline.length - 1 ? "active" : ""}"><div class="timeline-index">${String(index + 1).padStart(2, "0")}</div><div><time>${esc(item.date)}</time><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div></article>`).join("")}</div></article><aside class="panel capital-panel"><span class="eyebrow">CAPITAL ACUMULADO</span><h2>O que já não volta ao zero</h2><div class="capital-number"><strong>${fmt(m.rawRecords)}</strong><span>registros brutos</span></div><div class="capital-breakdown"><div><span>Mensuráveis</span><strong>${fmt(m.questions)}</strong></div><div><span>Sem resultado</span><strong>${fmt(m.withoutResult)}</strong></div><div><span>Acertos</span><strong>${fmt(m.hits)}</strong></div><div><span>Erros</span><strong>${fmt(m.errors)}</strong></div></div><blockquote>“Não recomeçar a cada edital” não é frase bonita. É regra de alocação de tempo.</blockquote></aside></section>
    <section class="panel transition-map"><div class="panel-heading"><div><span class="eyebrow">MAPA DA TRANSIÇÃO</span><h2>Do estudo à posse</h2><p>O fluxo continua depois da prova e transforma resultado em decisão.</p></div></div><div class="transition-steps">${[["Base", "03/07/2025", "done"], ["Câmara", "35/50", "done"], ["TDAS", "3.319 questões", "done"], ["SEDES/DF", "06/09/2026", "active"], ["Resultado", "classificação", "future"], ["Nomeação", "convocação", "future"], ["Posse", "transição", "future"]].map(([title, note, tone], index) => `<div class="transition-step ${tone}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><small>${note}</small></div>`).join("")}</div></section>
  </div>`;
}

function examCard(exam) {
  const upcoming = exam.rawAccuracy == null;
  const status = upcoming ? statusChip("Próxima prova", "warning") : statusChip("Resultado auditado", "good");
  return `<article class="panel exam-card"><div class="exam-card-head"><div><span class="eyebrow">${esc(exam.role)}</span><h3>${esc(exam.name)}</h3></div>${status}</div><div class="exam-result-block"><div><span>Resultado</span><strong>${esc(exam.score || "—")}</strong></div><div><span>Aproveitamento</span><strong>${exam.rawAccuracy == null ? "—" : pct(exam.rawAccuracy)}</strong></div><div><span>Nota editalícia</span><strong>${esc(exam.weightedScore || "—")}</strong></div></div><div class="exam-ranking"><span>Classificação / etapa</span><strong>${esc(exam.ranking || "Aguardando prova")}</strong></div><details><summary>Contexto auditado <span>${svgIcon("chevron")}</span></summary><p>${esc(exam.status || "Sem observação adicional.")}</p>${exam.competitionUniverse ? `<p><b>Universo:</b> ${esc(exam.competitionUniverse)}</p>` : ""}</details></article>`;
}

function examsView() {
  const exams = state.data.exams;
  const measured = exams.filter((exam) => exam.rawAccuracy != null);
  return `<div class="view-stack exams-view">${viewHeading("Concursos", "Prova, nota, classificação e contexto no lugar certo.", "A prova real funciona como régua externa. O treino não é usado para maquiar resultado de concurso.", `<button class="secondary-button" type="button" data-copy-exams>${svgIcon("copy")} Copiar histórico</button>`)}
    <section class="exam-hero panel"><div><span class="eyebrow">PRÓXIMA PROVA</span><h2>SEDES/DF · TDAS 202 + EDAS 400</h2><p>06 de setembro de 2026 · duas trilhas, mesma data, métricas separadas.</p></div><div class="exam-hero-date"><strong>06</strong><span>SET<br>2026</span></div><button class="primary-button" type="button" data-view="study">${svgIcon("play")} Estudar agora</button></section>
    <section class="exam-grid">${exams.map(examCard).join("")}</section>
    <section class="performance-chart-grid"><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">PROVAS REAIS</span><h2>Evolução do aproveitamento bruto</h2></div>${svgIcon("chart")}</div>${horizontalBars(measured.map((exam) => ({ name: exam.name, accuracy: exam.rawAccuracy, questions: Number(String(exam.score).split("/")[1] || 0) })), "accuracy", (value) => pct(value), 8)}</article><article class="panel competitive-card"><span class="eyebrow">RÉGUA COMPETITIVA</span><h2>Da nota ao contexto</h2><div class="competitive-compare">${measured.map((exam) => `<div><span>${esc(exam.name)}</span><strong>${pct(exam.rawAccuracy)}</strong><small>${esc(exam.ranking || "—")}</small></div>`).join("")}</div><p>Aproveitamento bruto, nota editalícia e classificação são grandezas diferentes. Aqui, elas não são empilhadas como se fossem a mesma coisa.</p></article></section>
    <section class="panel exam-matrix-panel"><div class="panel-heading"><div><span class="eyebrow">MATRIZ AUDITADA</span><h2>Comparação sem apagar o estágio do concurso</h2></div>${statusChip(`${measured.length} resultados reais`, "aqua")}</div><div class="subject-table-wrap"><table class="data-table exam-matrix"><thead><tr><th>Concurso</th><th>Data</th><th>Resultado</th><th>Aproveitamento</th><th>Classificação</th><th>Etapa / universo</th></tr></thead><tbody>${exams.map((exam) => `<tr><td><strong>${esc(exam.name)}</strong><small>${esc(exam.role)}</small></td><td>${dateBR(exam.date)}</td><td>${esc(exam.score || "—")}</td><td>${exam.rawAccuracy == null ? "—" : pct(exam.rawAccuracy)}</td><td>${exam.classification ? fmt(exam.classification) : "—"}</td><td>${esc(exam.classificationStage || exam.status || "—")}</td></tr>`).join("")}</tbody></table></div></section>
  </div>`;
}

function filteredFinanceEntries() {
  const f = state.finance;
  const query = normalize(f.query);
  return state.data.financeEntries.filter((entry) => (f.cycle === "Todos" || entry.cycle === f.cycle) && (f.category === "Todas" || entry.category === f.category) && (f.situation === "Todas" || entry.situation === f.situation) && (!query || normalize(`${entry.name} ${entry.category} ${entry.cycle} ${entry.situation}`).includes(query)));
}

function financeView() {
  const entries = filteredFinanceEntries();
  const total = entries.reduce((sum, item) => sum + Number(item.confirmed || 0), 0);
  const estimated = entries.reduce((sum, item) => sum + Number(item.estimated || 0), 0);
  const paid = entries.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const cycles = [...new Set(state.data.financeEntries.map((entry) => entry.cycle))];
  const categories = [...new Set(state.data.financeEntries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const situations = [...new Set(state.data.financeEntries.map((entry) => entry.situation))];
  const categoryRows = state.data.financeSummary.byCategory.map((row) => ({ ...row, name: row.key }));
  const cycleRows = state.data.financeSummary.byCycle.map((row) => ({ ...row, name: row.key }));
  return `<div class="view-stack finance-view">${viewHeading("Investimentos", "Quanto a transição custa — e o que esse número pode dizer.", "Confirmado, estimado, pago e não confirmado continuam separados. Ausência de evidência não vira R$ 0,00.", `<button class="secondary-button" type="button" data-export-finance>${svgIcon("download")} Exportar filtrado</button>`)}
    <section class="finance-summary-grid"><article class="panel finance-total"><span class="eyebrow">TOTAL CONFIRMADO · FILTRO ATUAL</span><strong>${money(total)}</strong><p>${fmt(entries.length)} lançamento(s) · ${money(paid)} efetivamente pago.</p><div class="finance-total-pairs"><span>Estimado <b>${money(estimated)}</b></span><span>Não confirmado <b>${fmt(entries.filter((item) => item.situation === "Não confirmado").length)}</b></span></div></article><article class="panel finance-donut-card"><div class="panel-heading"><div><span class="eyebrow">COMPOSIÇÃO GERAL</span><h2>Por ciclo</h2></div>${svgIcon("wallet")}</div><div class="donut-layout"><div class="donut" style="--slice:${state.data.financeSummary.totals.confirmed ? state.data.financeSummary.sedes.confirmed / state.data.financeSummary.totals.confirmed * 360 : 0}deg"><span>${pct(state.data.financeSummary.sedes.confirmed / Math.max(1, state.data.financeSummary.totals.confirmed) * 100, 1)}</span></div><div><p><i class="key-dot lime"></i> SEDES/DF <strong>${money(state.data.financeSummary.sedes.confirmed)}</strong></p><p><i class="key-dot aqua"></i> Outros ciclos <strong>${money(state.data.financeSummary.totals.confirmed - state.data.financeSummary.sedes.confirmed)}</strong></p></div></div></article></section>
    <section class="metric-grid">${metricCard("Confirmado geral", money(state.data.financeSummary.totals.confirmed), `${fmt(state.data.financeSummary.totals.transactions)} transações`, "lime")}${metricCard("Estimado", money(state.data.financeSummary.totals.estimated), "Fora do confirmado", "amber")}${metricCard("SEDES/DF", money(state.data.financeSummary.sedes.confirmed), `${fmt(state.data.financeSummary.sedes.transactions)} lançamentos`, "aqua")}${metricCard("Não confirmado", fmt(state.data.financeSummary.totals.unconfirmed), "Não entra nos totais", "coral")}</section>
    <section class="panel finance-filters"><div><span>${svgIcon("filter")} Filtrar lançamentos</span></div><label>Ciclo<select id="financeCycle"><option>Todos</option>${cycles.map((value) => `<option ${state.finance.cycle === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><label>Categoria<select id="financeCategory"><option>Todas</option>${categories.map((value) => `<option ${state.finance.category === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><label>Situação<select id="financeSituation"><option>Todas</option>${situations.map((value) => `<option ${state.finance.situation === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><label class="filter-input">${svgIcon("search")}<input id="financeSearch" type="search" value="${esc(state.finance.query)}" placeholder="Buscar item…" /></label></section>
    <section class="performance-chart-grid"><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">POR CICLO</span><h2>Confirmado e estimado</h2></div></div>${horizontalBars(cycleRows, "confirmed", money, 8)}</article><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">POR CATEGORIA</span><h2>Onde o recurso foi aplicado</h2></div></div>${horizontalBars(categoryRows, "confirmed", money, 8)}</article></section>
    <section class="panel ledger-panel"><div class="subject-panel-head"><div><span class="eyebrow">LIVRO FINANCEIRO</span><h2><span id="financeCount">${fmt(entries.length)}</span> lançamentos no filtro</h2><p>Cada linha preserva natureza, situação e vínculo com o ciclo.</p></div>${statusChip(money(total), "good")}</div><div class="ledger-list">${entries.map((entry) => `<details class="ledger-row"><summary><div><strong>${esc(entry.name)}</strong><small>${esc(entry.cycle)} · ${esc(entry.category)}</small></div><span>${dateBR(entry.date)}</span><b>${money(entry.confirmed || entry.estimated)}</b>${statusChip(entry.situation, entry.situation.includes("Confirmado") ? "good" : entry.situation === "Estimado" ? "warning" : "danger")}${svgIcon("chevron")}</summary><div class="ledger-detail"><span><small>Uso</small><b>${esc(entry.usage)}</b></span><span><small>Natureza</small><b>${esc(entry.nature)}</b></span><span><small>Tipo</small><b>${esc(entry.recordType)}</b></span><span><small>Pago</small><b>${entry.paid == null ? "—" : money(entry.paid)}</b></span><span><small>Conta no ciclo</small><b>${entry.countsInCycle ? "Sim" : "Não"}</b></span><span><small>Fonte disponível</small><b>${entry.sourceAvailable ? "Sim" : "Não"}</b></span></div></details>`).join("") || '<div class="empty-inline">Nenhum lançamento encontrado.</div>'}</div></section>
    <section class="panel method-card"><div>${svgIcon("shield")}</div><div><span class="eyebrow">GUARDA-CORPO</span><h2>Investimento não é “retorno financeiro” automático.</h2><p>O painel registra custo de preparação e prova. Relação causal com nota, classificação ou nomeação só pode ser afirmada com evidência adicional.</p></div></section>
  </div>`;
}

function strategyView() {
  const stages = state.data.strategy.stages;
  const shown = state.strategyStage === "all" ? stages : stages.filter((_, index) => String(index) === state.strategyStage);
  const criteria = ["Reaproveitamento do conteúdo", "Chance de nomeação", "Remuneração total", "Qualidade de vida", "Localização", "Custo de oportunidade"];
  let selected = [];
  try { selected = JSON.parse(localStorage.getItem("plano.strategy.criteria") || "[]"); } catch { selected = []; }
  return `<div class="view-stack strategy-view">${viewHeading("Estratégia", "Entrar, consolidar e subir sem desperdiçar capital.", "A decisão vigente é operacional até a prova. Depois, o painel volta a comparar carreira, aderência e vida real.", `<button class="secondary-button" type="button" data-copy-strategy>${svgIcon("copy")} Copiar critérios</button>`)}
    <section class="panel strategy-hero"><div><span class="eyebrow">DECISÃO VIGENTE</span><h2>${esc(state.data.strategy.current)}</h2><p>Até 06/09, execução. Depois, análise de carreira com a mesma frieza usada nos dados.</p></div><div class="strategy-compass">${svgIcon("compass")}<span>posse<br>antes da<br>vaidade</span></div></section>
    <nav class="segmented strategy-filter" aria-label="Horizonte da estratégia"><button class="${state.strategyStage === "all" ? "active" : ""}" type="button" data-strategy-stage="all">Visão completa</button>${stages.map((stage, index) => `<button class="${state.strategyStage === String(index) ? "active" : ""}" type="button" data-strategy-stage="${index}">${esc(stage.period)}</button>`).join("")}</nav>
    <section class="strategy-stage-grid">${shown.map((stage) => { const index = stages.indexOf(stage); return `<article class="panel stage-card"><span class="stage-number">0${index + 1}</span><span class="eyebrow">${esc(stage.period)}</span><h2>${esc(stage.title)}</h2><p>${esc(stage.goal)}</p><div class="stage-route"><i></i><span>${index === 0 ? "Em curso" : "Horizonte futuro"}</span></div></article>`; }).join("")}</section>
    <section class="strategy-decision-grid"><article class="panel criteria-panel"><div class="panel-heading"><div><span class="eyebrow">CRITÉRIOS DE DECISÃO</span><h2>O que deve pesar no próximo edital</h2><p>Marque o que você considera inegociável. A escolha fica salva neste aparelho.</p></div>${svgIcon("target")}</div><div class="criteria-grid">${criteria.map((criterion, index) => `<button class="criterion ${selected.includes(criterion) ? "selected" : ""}" type="button" data-criterion="${esc(criterion)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(criterion)}</strong>${svgIcon(selected.includes(criterion) ? "check" : "spark")}</button>`).join("")}</div></article><article class="panel principles-panel"><span class="eyebrow">PRINCÍPIOS DO PLANO</span><h2>Regras que protegem a estratégia</h2><div class="principles-list">${state.data.strategy.principles.map((principle, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(principle)}</p></div>`).join("")}</div></article></section>
  </div>`;
}

function auditChecks() {
  const data = state.data;
  const m = data.metrics;
  const sedesOperational = data.financeSummary.sedes.confirmed;
  const topicalValid = treatedTopicalSeed.every((row) => row.questions >= row.correct && row.questions >= 0 && row.correct >= 0);
  return [
    ["Histórico fecha em acertos + erros", m.history.questions === m.history.hits + m.history.errors],
    ["Bruto fecha em mensurável + sem resultado", m.history.rawRecords === m.history.questions + m.history.withoutResult],
    ["TDAS preservado separadamente", m.tdas.questions === m.tdas.hits + m.tdas.errors],
    ["EDAS preservado separadamente", m.edas.questions === m.edas.hits + m.edas.errors],
    ["Financeiro SEDES reconciliado", Math.abs(sedesOperational - m.finance.sedesConfirmed) < .01],
    ["Provas reais fora do volume de treino", data.exams.every((exam) => exam.name !== "SEDES/DF" || exam.rawAccuracy == null)],
    ["Classificação acompanhada da etapa", data.exams.filter((exam) => exam.classification).every((exam) => Boolean(exam.classificationStage))],
    ["Tratamento por matéria matematicamente válido", topicalValid],
    ["Snapshot sem alerta de sincronização", !(data.meta.syncWarnings || []).length],
    ["Enriquecimento sem divergência", !(data.meta.dataWarnings || []).length],
  ];
}

function sourcesView() {
  const data = state.data;
  const checks = auditChecks();
  const passed = checks.filter(([, ok]) => ok).length;
  const subjectCount = treatedTopicalSeed.filter((row) => row.grain === "subject").length;
  return `<div class="view-stack sources-view">${viewHeading("Fontes", "A beleza fica na frente. A verdade continua rastreável.", "Notion vivo, tratamento, snapshot e site são camadas diferentes. O painel deixa essa cadeia visível.", `<button class="secondary-button" type="button" id="refreshPublished">${svgIcon("refresh")} Recarregar publicado</button><a class="secondary-button" href="https://github.com/RodrigoRosaDantas/plano-de-transicao/actions/workflows/sync-notion.yml" target="_blank" rel="noreferrer">${svgIcon("database")} Sincronizar no GitHub</a><button class="secondary-button" type="button" data-export-snapshot>${svgIcon("download")} Exportar snapshot</button>`)}
    <section class="audit-hero panel ${passed === checks.length ? "ready" : "warning"}"><div class="audit-score"><strong>${passed}<span>/${checks.length}</span></strong><small>verificações aprovadas</small></div><div><span class="eyebrow">AUDITORIA AUTOMÁTICA</span><h2>${passed === checks.length ? "Dados reconciliados para publicação" : "Há verificações que pedem revisão"}</h2><p>Última geração em ${new Date(data.meta.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · corte de desempenho ${dateBR(data.meta.performanceCut)}.</p></div>${statusChip(passed === checks.length ? "Íntegro" : "Revisar", passed === checks.length ? "good" : "danger")}</section>
    <section class="panel truth-panel"><div class="panel-heading"><div><span class="eyebrow">CADEIA DE VERDADE</span><h2>Quem prevalece quando há divergência</h2></div>${svgIcon("database")}</div><div class="truth-chain">${data.governance.truthChain.map((label, index) => `<div class="truth-node ${index === 0 ? "primary" : ""}"><span>0${index + 1}</span><strong>${esc(label)}</strong>${index < data.governance.truthChain.length - 1 ? svgIcon("arrow") : ""}</div>`).join("")}</div></section>
    <section class="audit-grid"><article class="panel audit-check-panel"><div class="panel-heading"><div><span class="eyebrow">VERIFICAÇÕES</span><h2>Fechamento automático</h2></div>${svgIcon("shield")}</div><div class="audit-checks">${checks.map(([label, ok]) => `<div class="audit-check ${ok ? "ok" : "bad"}"><span>${svgIcon(ok ? "check" : "alert")}</span><strong>${esc(label)}</strong><small>${ok ? "aprovado" : "revisar"}</small></div>`).join("")}</div></article><article class="panel source-summary"><span class="eyebrow">COBERTURA PUBLICADA</span><h2>O que o site sabe hoje</h2><div class="source-summary-list"><div><span>Registros brutos</span><strong>${fmt(data.metrics.history.rawRecords)}</strong></div><div><span>Questões mensuráveis</span><strong>${fmt(data.metrics.history.questions)}</strong></div><div><span>Linhas temáticas tratadas</span><strong>${fmt(treatedTopicalSeed.length)}</strong></div><div><span>Linhas só de matéria</span><strong>${fmt(subjectCount)}</strong></div><div><span>Atividades tratadas</span><strong>${fmt(treatedActivitySeed.length)}</strong></div><div><span>Lançamentos financeiros</span><strong>${fmt(data.financeEntries.length)}</strong></div></div></article></section>
    <section class="panel source-map"><div class="panel-heading"><div><span class="eyebrow">FONTES VIGENTES</span><h2>Bancos que alimentam o plano</h2></div><a class="text-button" href="${esc(data.meta.sourceUrl)}" target="_blank" rel="noreferrer">Abrir Notion ${svgIcon("external")}</a></div><div class="source-grid">${data.governance.sources.map((source) => `<article><div class="source-icon">${svgIcon("database")}</div><div><strong>${esc(source.name)}</strong><code>${esc(source.id.slice(0, 8))}…</code></div>${statusChip(source.status, "aqua")}</article>`).join("")}</div></section>
    <section class="panel governance-panel"><div class="panel-heading"><div><span class="eyebrow">REGRAS DE GOVERNANÇA</span><h2>O que o painel se recusa a fazer</h2></div></div><ol>${data.governance.rules.map((rule) => `<li><span>${String(data.governance.rules.indexOf(rule) + 1).padStart(2, "0")}</span><p>${esc(rule)}</p></li>`).join("")}</ol></section>
  </div>`;
}

const viewRenderers = { command: commandView, study: studyView, performance: performanceView, journey: journeyView, exams: examsView, finance: financeView, strategy: strategyView, sources: sourcesView };

function render() {
  if (!state.data) return;
  const content = $("#content");
  const renderer = viewRenderers[state.view] || commandView;
  content.setAttribute("aria-busy", "true");
  content.innerHTML = renderer();
  content.setAttribute("aria-busy", "false");
  $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  hydrateIcons(content);
  bindViewControls();
  updateLiveTime();
  if (state.view === "study") bindStudyFrame();
  document.title = `${VIEW_NAMES[state.view]} · Plano de Transição`;
}

function navigate(view, options = {}) {
  if (!viewRenderers[view]) view = "command";
  if (options.scope) state.performance.scope = options.scope;
  if (options.subject) {
    state.performance.query = options.subject;
    state.performance.grain = "subject";
  }
  if (options.studyRoute) state.studyRoute = options.studyRoute;
  state.view = view;
  const hash = `#${view}`;
  if (location.hash !== hash) history.pushState(null, "", hash);
  closeMoreSheet();
  closeSearch();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStudyRoute(routeId) {
  const route = STUDY_ROUTES.find((item) => item.id === routeId) || STUDY_ROUTES[0];
  state.studyRoute = route.id;
  sessionStorage.setItem("plano.study.route", route.id);
  if (state.view !== "study") return navigate("study", { studyRoute: route.id });
  $$('[data-study-route]').forEach((button) => {
    const active = button.dataset.studyRoute === route.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const frame = $("#studyWorkspaceFrame");
  const loading = $("#workspaceLoading");
  const label = $("#workspaceRouteLabel");
  if (label) label.textContent = route.label;
  if (loading) loading.classList.remove("hidden");
  if (frame && frame.getAttribute("src") !== route.href) {
    frame.title = `${route.label} — Plataforma de Questões`;
    frame.src = route.href;
  }
  $("#studyWorkspace")?.setAttribute("data-study-route", route.id);
}

function bindStudyFrame() {
  const frame = $("#studyWorkspaceFrame");
  if (!frame || frame.dataset.bound) return;
  frame.dataset.bound = "true";
  frame.addEventListener("load", () => {
    $("#workspaceLoading")?.classList.add("hidden");
    const status = $("#workspaceState");
    if (status) status.textContent = "módulo carregado";
    try {
      const doc = frame.contentDocument;
      if (doc?.documentElement) doc.documentElement.setAttribute("data-theme", document.documentElement.classList.contains("light") ? "light" : "dark");
      if (doc?.body) {
        doc.body.dataset.planoEmbedded = "true";
        let style = doc.getElementById("plano-embedded-style");
        if (!style && doc.head) {
          style = doc.createElement("style");
          style.id = "plano-embedded-style";
          style.textContent = "body[data-plano-embedded=true]>.topbar,body[data-plano-embedded=true]>.mobile-nav,body[data-plano-embedded=true]>.footer,body[data-plano-embedded=true]>.skip{display:none!important}body[data-plano-embedded=true]>.page,body[data-plano-embedded=true] #app.page{max-width:1480px!important;margin:0 auto!important;padding-top:16px!important;min-height:100vh!important}";
          doc.head.append(style);
        }
      }
    } catch {
      if (status) status.textContent = "aberto em modo protegido";
    }
  });
}

function bindViewControls() {
  $("#subjectSearch")?.addEventListener("input", (event) => {
    state.performance.query = event.target.value;
    clearTimeout(window.__subjectSearchTimer);
    window.__subjectSearchTimer = setTimeout(() => {
      render();
      const input = $("#subjectSearch");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 220);
  });
  $("#subjectSort")?.addEventListener("change", (event) => { state.performance.sort = event.target.value; render(); });
  $("#financeCycle")?.addEventListener("change", (event) => { state.finance.cycle = event.target.value; render(); });
  $("#financeCategory")?.addEventListener("change", (event) => { state.finance.category = event.target.value; render(); });
  $("#financeSituation")?.addEventListener("change", (event) => { state.finance.situation = event.target.value; render(); });
  $("#financeSearch")?.addEventListener("input", (event) => {
    state.finance.query = event.target.value;
    clearTimeout(window.__financeSearchTimer);
    window.__financeSearchTimer = setTimeout(() => {
      render();
      const input = $("#financeSearch");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 220);
  });
  $("#refreshPublished")?.addEventListener("click", () => loadSnapshot(true));
}

async function copyText(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); }
  catch { toast("Não foi possível copiar automaticamente."); }
}

function exportFile(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFinance() {
  const rows = filteredFinanceEntries();
  const columns = ["id", "name", "date", "cycle", "category", "situation", "usage", "confirmed", "estimated", "paid"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [columns.join(";"), ...rows.map((row) => columns.map((column) => quote(row[column])).join(";"))].join("\n");
  exportFile("investimentos-plano-de-transicao.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
  toast("Lançamentos filtrados exportados.");
}

function toggleCriterion(label) {
  let selected = [];
  try { selected = JSON.parse(localStorage.getItem("plano.strategy.criteria") || "[]"); } catch { selected = []; }
  selected = selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label];
  localStorage.setItem("plano.strategy.criteria", JSON.stringify(selected));
  render();
}

function buildSearchIndex() {
  const data = state.data;
  const staticItems = Object.entries(VIEW_NAMES).map(([view, title]) => ({ view, title, description: `Abrir ${title}`, group: "Áreas" }));
  const subjects = treatedTopicalSeed.filter((row) => row.grain === "subject").map((row) => ({ view: "performance", title: row.name, description: `${row.scope.toUpperCase()} · ${fmt(row.questions)} questões · ${pct(row.correct / row.questions * 100)}`, group: "Matérias", scope: row.scope, subject: row.name }));
  const exams = data.exams.map((exam) => ({ view: "exams", title: exam.name, description: `${exam.role} · ${exam.score}`, group: "Concursos" }));
  const finance = data.financeEntries.map((entry) => ({ view: "finance", title: entry.name, description: `${entry.cycle} · ${money(entry.confirmed || entry.estimated)}`, group: "Investimentos" }));
  const timeline = data.timeline.map((item) => ({ view: "journey", title: item.title, description: `${item.date} · ${item.detail}`, group: "Jornada" }));
  const dedupe = new Map();
  [...staticItems, ...subjects, ...exams, ...finance, ...timeline].forEach((item) => {
    const key = `${item.view}:${item.title}:${item.scope || ""}`;
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  state.searchIndex = [...dedupe.values()];
}

function renderSearch(query = "") {
  const normalized = normalize(query);
  const results = state.searchIndex.filter((item) => !normalized || normalize(`${item.title} ${item.description} ${item.group}`).includes(normalized)).slice(0, 18);
  const container = $("#searchResults");
  if (!container) return;
  container.innerHTML = results.length ? results.map((item) => `<button type="button" data-search-view="${item.view}" data-search-scope="${item.scope || ""}" data-search-subject="${esc(item.subject || "")}"><span class="search-result-icon">${svgIcon(item.view === "finance" ? "wallet" : item.view === "exams" ? "flag" : item.view === "journey" ? "route" : item.view === "performance" ? "chart" : "spark")}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.description)}</small></span><em>${esc(item.group)}</em>${svgIcon("chevron")}</button>`).join("") : '<div class="search-empty">Nada encontrado. Tente uma matéria, concurso, gasto ou marco.</div>';
}

function openSearch() {
  $("#commandPalette")?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  const input = $("#searchInput");
  if (input) { input.value = ""; input.focus(); }
  renderSearch();
}

function closeSearch() {
  $("#commandPalette")?.classList.add("hidden");
  if (!$("#moreSheet")?.classList.contains("open")) document.body.classList.remove("modal-open");
}

function openMoreSheet() {
  $("#moreSheet")?.classList.add("open");
  $("#moreSheet")?.setAttribute("aria-hidden", "false");
  $("#moreBackdrop")?.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeMoreSheet() {
  $("#moreSheet")?.classList.remove("open");
  $("#moreSheet")?.setAttribute("aria-hidden", "true");
  $("#moreBackdrop")?.classList.add("hidden");
  if ($("#commandPalette")?.classList.contains("hidden")) document.body.classList.remove("modal-open");
}

function updateLiveTime() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(now);
  const date = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(now).replaceAll(".", "");
  $$('[data-brasilia-clock]').forEach((node) => { node.textContent = time; });
  $$('[data-brasilia-date]').forEach((node) => { node.textContent = date; });
  const countdown = countdownParts();
  $$('[data-countdown-days]').forEach((node) => { node.textContent = countdown.days; });
}

function updateShell() {
  const data = state.data;
  $("#missionText").textContent = data.mission;
  const milestone = $("#nextMilestone");
  if (milestone) milestone.innerHTML = `<span>Próximo marco</span><strong>${dateBR(data.meta.nextExam, true).toUpperCase()}</strong><small>SEDES/DF 2026</small>`;
  const generated = new Date(data.meta.generatedAt);
  $("#snapshotDate").textContent = `corte ${dateBR(data.meta.homeSnapshot)} · desempenho ${dateBR(data.meta.performanceCut)}`;
  $("#contextStatus").textContent = data.meta.live ? "Notion vivo → tratamento → GitHub Pages" : "Snapshot auditado publicado";
  $("#networkState").textContent = navigator.onLine ? "online" : "offline";
  const local = localStudyState();
  $("#localStudyStatus").textContent = local.session ? `tentativa salva · questão ${Math.min(local.current + 1, local.total || local.current + 1)}` : local.available ? `${fmt(local.answered)} respostas locais` : "sem tentativa local";
  const sync = $("#syncState");
  sync.classList.toggle("warning", Boolean((data.meta.syncWarnings || []).length));
  sync.innerHTML = `<span class="status-orb"><i></i></span><span><strong>${(data.meta.syncWarnings || []).length ? "Snapshot com ressalvas" : "Dados reconciliados"}</strong><small>${generated.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "")}</small></span>`;
  hydrateIcons();
}

async function loadSnapshot(feedback = false) {
  const refresh = $("#refreshBtn");
  refresh?.classList.add("spinning");
  try {
    const response = await fetch(`data/snapshot.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.metrics?.history || !data?.governance?.truthChain) throw new Error("Snapshot incompleto");
    state.data = data;
    buildSearchIndex();
    updateShell();
    render();
    if (feedback) toast("Snapshot publicado recarregado.");
  } catch (error) {
    const content = $("#content");
    if (!state.data && content) content.innerHTML = `<section class="panel empty-state">${svgIcon("alert")}<h2>Não foi possível carregar o snapshot.</h2><p>${esc(error.message)}. Tente novamente; se estiver offline, a versão instalada poderá usar o último cache válido.</p><button class="primary-button" type="button" id="retryLoad">Tentar novamente</button></section>`;
    $("#retryLoad")?.addEventListener("click", () => loadSnapshot(true));
    if (feedback) toast("Não foi possível atualizar agora.");
  } finally {
    refresh?.classList.remove("spinning");
  }
}

function registerPwa() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    $("#installBtn")?.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    $("#installBtn")?.classList.add("hidden");
    toast("Plano de Transição instalado.");
  });
}

function bindShell() {
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      const scope = viewButton.dataset.performanceScopeJump;
      const studyRoute = viewButton.dataset.studyJump;
      navigate(viewButton.dataset.view, { scope, studyRoute });
      return;
    }
    const studyButton = event.target.closest("[data-study-route]");
    if (studyButton) { setStudyRoute(studyButton.dataset.studyRoute); return; }
    const scopeButton = event.target.closest("[data-performance-scope]");
    if (scopeButton) { state.performance.scope = scopeButton.dataset.performanceScope; state.performance.query = ""; render(); return; }
    const grainButton = event.target.closest("[data-performance-grain]");
    if (grainButton) { state.performance.grain = grainButton.dataset.performanceGrain; state.performance.query = ""; render(); return; }
    const subjectButton = event.target.closest("[data-open-subject]");
    if (subjectButton) { navigate("performance", { scope: subjectButton.dataset.openScope, subject: subjectButton.dataset.openSubject }); return; }
    const strategyButton = event.target.closest("[data-strategy-stage]");
    if (strategyButton) { state.strategyStage = strategyButton.dataset.strategyStage; render(); return; }
    const criterion = event.target.closest("[data-criterion]");
    if (criterion) { toggleCriterion(criterion.dataset.criterion); return; }
    const result = event.target.closest("[data-search-view]");
    if (result) { navigate(result.dataset.searchView, { scope: result.dataset.searchScope || undefined, subject: result.dataset.searchSubject || undefined }); return; }
    if (event.target.closest("[data-copy-performance]")) {
      const m = scopeMetrics(state.performance.scope); copyText(`${m.label}: ${fmt(m.questions)} questões, ${fmt(m.correct)} acertos, ${fmt(m.errors)} erros e ${pct(m.accuracy)} de aproveitamento.`, "Resumo de desempenho copiado."); return;
    }
    if (event.target.closest("[data-copy-journey]")) { copyText(state.data.timeline.map((item) => `${item.date} — ${item.title}: ${item.detail}`).join("\n"), "Jornada copiada."); return; }
    if (event.target.closest("[data-copy-exams]")) { copyText(state.data.exams.map((exam) => `${exam.name} (${exam.role}) — ${exam.score} — ${exam.ranking || exam.status}`).join("\n"), "Histórico de provas copiado."); return; }
    if (event.target.closest("[data-copy-strategy]")) { copyText([state.data.strategy.current, ...state.data.strategy.principles].join("\n• "), "Estratégia copiada."); return; }
    if (event.target.closest("[data-export-finance]")) { exportFinance(); return; }
    if (event.target.closest("[data-export-snapshot]")) { exportFile("snapshot-plano-de-transicao.json", JSON.stringify(state.data, null, 2)); toast("Snapshot exportado."); return; }
    if (event.target.closest("[data-frame-reload]")) { const frame = $("#studyWorkspaceFrame"); if (frame) { $("#workspaceLoading")?.classList.remove("hidden"); frame.src = frame.src; } return; }
    if (event.target.closest("[data-frame-fullscreen]")) { const workspace = $("#studyWorkspace"); if (!document.fullscreenElement) workspace?.requestFullscreen?.(); else document.exitFullscreen?.(); return; }
    if (event.target === $("#commandPalette")) closeSearch();
  });
  $("#searchTrigger")?.addEventListener("click", openSearch);
  $("#searchInput")?.addEventListener("input", (event) => renderSearch(event.target.value));
  $("#refreshBtn")?.addEventListener("click", () => loadSnapshot(true));
  $("#themeBtn")?.addEventListener("click", () => {
    document.documentElement.classList.toggle("light");
    const light = document.documentElement.classList.contains("light");
    localStorage.setItem("plano.theme", light ? "light" : "dark");
    $("#themeBtn [data-icon]")?.setAttribute("data-icon", light ? "moon" : "sun");
    hydrateIcons($("#themeBtn"));
    try { $("#studyWorkspaceFrame")?.contentDocument?.documentElement?.setAttribute("data-theme", light ? "light" : "dark"); } catch {}
  });
  $("#moreTopBtn")?.addEventListener("click", openMoreSheet);
  $("#moreDockBtn")?.addEventListener("click", openMoreSheet);
  $("#closeMoreBtn")?.addEventListener("click", closeMoreSheet);
  $("#moreBackdrop")?.addEventListener("click", closeMoreSheet);
  $("#exportBtn")?.addEventListener("click", () => { if (state.data) { exportFile("snapshot-plano-de-transicao.json", JSON.stringify(state.data, null, 2)); toast("Snapshot exportado."); } });
  $("#installBtn")?.addEventListener("click", async () => {
    if (!state.deferredPrompt) { toast("No Android, abra o menu do navegador e escolha “Instalar aplicativo”."); return; }
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    $("#installBtn")?.classList.add("hidden");
  });
  window.addEventListener("popstate", () => { state.view = location.hash.slice(1) in viewRenderers ? location.hash.slice(1) : "command"; render(); });
  window.addEventListener("hashchange", () => { const view = location.hash.slice(1); if (viewRenderers[view] && view !== state.view) { state.view = view; render(); } });
  window.addEventListener("online", updateShell);
  window.addEventListener("offline", updateShell);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "Escape") { closeSearch(); closeMoreSheet(); }
  });
}

function init() {
  const savedTheme = localStorage.getItem("plano.theme");
  if (savedTheme === "light") document.documentElement.classList.add("light");
  const hash = location.hash.slice(1);
  state.view = viewRenderers[hash] ? hash : hash === "tools" ? "study" : hash === "home" ? "command" : "command";
  if (location.hash !== `#${state.view}`) history.replaceState(null, "", `#${state.view}`);
  bindShell();
  registerPwa();
  hydrateIcons();
  loadSnapshot(false);
  setInterval(updateLiveTime, 1000);
}

document.addEventListener("DOMContentLoaded", init);
