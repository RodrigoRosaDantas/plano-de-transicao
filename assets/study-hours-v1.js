const STUDY_HOURS_URL = "https://rodrigorosadantas.github.io/central-estudos/data/federated-status.json";
const ACTIVE_PROJECTS = [
  { id: "seedf", code: "P1", name: "SEEDF" },
  { id: "tjdft", code: "P2", name: "TJDFT" },
  { id: "prf-adm", code: "P3", name: "PRF ADM" },
];

let cachedSummary = null;
let loadingPromise = null;
let activeRoot = null;

const element = (tag, className = "", text = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
};

function saoPauloDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function shiftDay(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekStart(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return shiftDay(day, -offset);
}

function duration(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}min`;
  return mins ? `${hours}h ${mins}min` : `${hours}h`;
}

function validCredit(credit, today) {
  return credit
    && typeof credit.id === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(String(credit.date || ""))
    && credit.date <= today
    && Number.isFinite(Number(credit.minutes))
    && Number(credit.minutes) > 0
    && Number(credit.minutes) <= 1440;
}

function summarize(payload) {
  const today = saoPauloDay();
  const fromWeek = weekStart(today);
  const fromMonth = today.slice(0, 7) + "-01";
  const byId = new Map();
  const projects = [];
  let aligned = 0;

  for (const project of ACTIVE_PROJECTS) {
    const source = payload?.sources?.[project.id];
    const contract = source?.contract;
    const integrity = source?.integrity?.status;
    const usable = source?.publicStatus === "live"
      && integrity === "aligned"
      && contract?.schemaVersion === 1
      && contract?.projectId === project.id
      && contract?.source?.status === "synced"
      && contract?.study?.evidence === "confirmed";

    if (usable) aligned += 1;

    const credits = usable && Array.isArray(contract?.study?.timeCredits)
      ? contract.study.timeCredits.filter(credit => validCredit(credit, today))
      : [];

    let projectMinutes = 0;
    for (const credit of credits) {
      if (byId.has(credit.id)) continue;
      const normalized = {
        ...credit,
        projectId: project.id,
        code: project.code,
        projectName: project.name,
        minutes: Number(credit.minutes),
      };
      byId.set(credit.id, normalized);
      projectMinutes += normalized.minutes;
    }

    projects.push({
      ...project,
      minutes: projectMinutes,
      status: usable ? "aligned" : (integrity || source?.publicStatus || "unavailable"),
      credits: credits.length,
    });
  }

  const credits = [...byId.values()];
  const sum = rows => rows.reduce((acc, row) => acc + row.minutes, 0);
  const total = sum(credits);
  const todayMinutes = sum(credits.filter(row => row.date === today));
  const weekMinutes = sum(credits.filter(row => row.date >= fromWeek && row.date <= today));
  const monthMinutes = sum(credits.filter(row => row.date >= fromMonth && row.date <= today));
  const activeDays = new Set(credits.map(row => row.date)).size;

  return {
    generatedAt: payload?.generatedAt || null,
    today,
    fromWeek,
    total,
    todayMinutes,
    weekMinutes,
    monthMinutes,
    activeDays,
    credits: credits.length,
    aligned,
    projects,
  };
}

async function loadSummary(force = false) {
  if (!force && cachedSummary) return cachedSummary;
  if (!force && loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`${STUDY_HOURS_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("status");
      const payload = await response.json();
      cachedSummary = summarize(payload);
      return cachedSummary;
    } finally {
      clearTimeout(timer);
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function metric(label, value, note, tone = "") {
  const card = element("article", `study-hours-metric ${tone}`.trim());
  card.append(
    element("span", "", label),
    element("strong", "", value),
    element("small", "", note),
  );
  return card;
}

function renderLoading(root) {
  root.replaceChildren();
  const head = element("div", "study-hours-head");
  const copy = element("div");
  copy.append(
    element("span", "eyebrow", "TEMPO DE ESTUDO · P1–P3"),
    element("h2", "", "Horas estudadas"),
    element("p", "", "Somando apenas créditos confirmados publicados pelos projetos ativos."),
  );
  head.append(copy, element("span", "study-hours-state is-loading", "Atualizando…"));
  root.append(head, element("div", "study-hours-loading", "Conferindo SEEDF, TJDFT e PRF ADM…"));
}

function renderError(root) {
  root.replaceChildren();
  const head = element("div", "study-hours-head");
  const copy = element("div");
  copy.append(
    element("span", "eyebrow", "TEMPO DE ESTUDO · P1–P3"),
    element("h2", "", "Horas estudadas"),
    element("p", "", "O dado não foi substituído por estimativa: a fonte federada não respondeu."),
  );
  const refresh = element("button", "secondary-button study-hours-refresh", "Tentar novamente");
  refresh.type = "button";
  refresh.dataset.studyHoursRefresh = "true";
  head.append(copy, refresh);
  root.append(head, element("p", "study-hours-error", "Sem leitura confiável neste momento. Nenhuma hora foi inventada ou reaproveitada de cache antigo."));
}

function renderSummary(root, summary) {
  root.replaceChildren();
  const head = element("div", "study-hours-head");
  const copy = element("div");
  copy.append(
    element("span", "eyebrow", "TEMPO DE ESTUDO · P1–P3"),
    element("h2", "", "Horas estudadas"),
    element("p", "", "Tempo confirmado da preparação atual, sem misturar TCE-GO pausado nem ciclos históricos da SEDES/DF."),
  );
  const controls = element("div", "study-hours-controls");
  const state = element("span", `study-hours-state ${summary.aligned === ACTIVE_PROJECTS.length ? "is-ok" : "is-warning"}`,
    `${summary.aligned}/${ACTIVE_PROJECTS.length} fontes alinhadas`);
  const refresh = element("button", "secondary-button study-hours-refresh", "Atualizar horas");
  refresh.type = "button";
  refresh.dataset.studyHoursRefresh = "true";
  controls.append(state, refresh);
  head.append(copy, controls);

  const metrics = element("div", "study-hours-metrics");
  metrics.append(
    metric("Hoje", duration(summary.todayMinutes), summary.todayMinutes ? "créditos confirmados hoje" : "nenhum crédito confirmado hoje", "aqua"),
    metric("Semana", duration(summary.weekMinutes), `desde ${summary.fromWeek.split("-").reverse().join("/")}`, "lime"),
    metric("Mês", duration(summary.monthMinutes), "mês corrente", "amber"),
    metric("Acumulado", duration(summary.total), `${summary.activeDays} dia(s) com estudo confirmado`, "violet"),
  );

  const projects = element("div", "study-hours-projects");
  for (const project of summary.projects) {
    const item = element("article", "study-hours-project");
    const top = element("div", "study-hours-project-head");
    const label = element("div");
    label.append(element("b", "", project.code), element("strong", "", project.name));
    top.append(label, element("span", "", duration(project.minutes)));
    const track = element("div", "study-hours-track");
    const fill = element("i");
    fill.style.width = summary.total ? `${Math.max(0, Math.min(100, project.minutes / summary.total * 100))}%` : "0%";
    track.append(fill);
    item.append(top, track, element("small", "", project.status === "aligned" ? `${project.credits} crédito(s) publicado(s)` : "fonte não alinhada — tempo não contabilizado"));
    projects.append(item);
  }

  const foot = element("div", "study-hours-foot");
  const updated = summary.generatedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(summary.generatedAt))
    : "horário não publicado";
  foot.append(
    element("small", "", `Fonte: contratos federados da Central de Estudos · atualização ${updated}.`),
    element("small", "", "Regra vigente: créditos publicados valem o tempo confirmado pelo projeto; leituras e unidades podem gerar créditos separados quando a fonte assim registra."),
  );

  root.append(head, metrics, projects, foot);
}

async function hydrate(root, force = false) {
  if (!root?.isConnected) return;
  renderLoading(root);
  try {
    const summary = await loadSummary(force);
    if (root.isConnected) renderSummary(root, summary);
  } catch {
    if (root.isConnected) renderError(root);
  }
}

function ensurePanel() {
  if (location.hash && !["", "#command"].includes(location.hash)) return;
  const command = document.querySelector(".command-view");
  if (!command) return;
  let root = command.querySelector("#study-hours-overview");
  if (!root) {
    root = element("section", "panel study-hours-panel");
    root.id = "study-hours-overview";
    root.setAttribute("aria-live", "polite");
    const anchor = command.querySelector(".transition-kpi-grid");
    if (anchor) anchor.insertAdjacentElement("afterend", root);
    else command.prepend(root);
  }
  if (root !== activeRoot) {
    activeRoot = root;
    hydrate(root);
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-study-hours-refresh]");
  if (!button) return;
  const root = document.getElementById("study-hours-overview");
  if (root) {
    cachedSummary = null;
    hydrate(root, true);
  }
});

const observer = new MutationObserver(() => {
  const root = document.getElementById("study-hours-overview");
  if (!root) activeRoot = null;
  ensurePanel();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("hashchange", () => queueMicrotask(ensurePanel));
document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
ensurePanel();
