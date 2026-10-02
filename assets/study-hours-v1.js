const STUDY_HOURS_URL = "https://rodrigorosadantas.github.io/central-estudos/data/federated-status.json";
const HISTORY_HOURS_URL = "./data/study-hours-history.json";
const LOCAL_STUDY_KEY = "central-estudos:study-log-v1";
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

function readLocalCredits(today) {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_STUDY_KEY) || "[]");
    const active = new Set(ACTIVE_PROJECTS.map(project => project.id));
    return Array.isArray(raw)
      ? raw.filter(row =>
          row?.confirmed === true
          && active.has(row?.projectId)
          && typeof row?.id === "string"
          && /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ""))
          && row.date <= today
          && Number.isFinite(Number(row?.minutes))
          && Number(row.minutes) > 0
          && Number(row.minutes) <= 1440
        ).map(row => ({
          id: row.id,
          date: row.date,
          projectId: row.projectId,
          trail: String(row.trail || ""),
          topic: String(row.topic || ""),
          minutes: Number(row.minutes),
          sourceType: "local",
        }))
      : [];
  } catch {
    return [];
  }
}

function creditFingerprint(row) {
  const topic = String(row.topic || row.unit || "").trim().toLocaleUpperCase("pt-BR");
  return [row.projectId, row.date, topic, Number(row.minutes) || 0].join("|");
}

function publicSessionKey(row) {
  const unit = String(row.unit || "").trim().toLocaleUpperCase("pt-BR");
  const stableUnit = unit || `ID:${String(row.id || "").trim().toLocaleUpperCase("pt-BR")}`;
  return [row.projectId, row.date, stableUnit].join("|");
}

function coalescePublicCredits(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = publicSessionKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const kept = [];
  let droppedReadingShadows = 0;
  for (const group of grouped.values()) {
    const hasNonReading = group.some(row => row.kind !== "reading");
    for (const row of group) {
      if (row.kind === "reading" && hasNonReading) {
        droppedReadingShadows += 1;
        continue;
      }
      kept.push(row);
    }
  }
  return { rows: kept, droppedReadingShadows };
}

function summarize(payload, history) {
  const today = saoPauloDay();
  const fromWeek = weekStart(today);
  const fromMonth = today.slice(0, 7) + "-01";
  const byFingerprint = new Map();
  const sourceState = new Map();
  const publicCredits = [];
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
    sourceState.set(project.id, usable ? "aligned" : (integrity || source?.publicStatus || "unavailable"));

    const credits = usable && Array.isArray(contract?.study?.timeCredits)
      ? contract.study.timeCredits.filter(credit => validCredit(credit, today))
      : [];

    for (const credit of credits) {
      publicCredits.push({
        ...credit,
        projectId: project.id,
        code: project.code,
        projectName: project.name,
        topic: credit.kind === "reading" ? `Leitura · ${credit.unit || ""}` : String(credit.unit || ""),
        minutes: Number(credit.minutes),
        sourceType: "public",
      });
    }
  }

  const coalescedPublic = coalescePublicCredits(publicCredits);
  for (const credit of coalescedPublic.rows) {
    const fingerprint = creditFingerprint(credit);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, credit);
  }

  const localCredits = readLocalCredits(today);
  for (const credit of localCredits) {
    const fingerprint = creditFingerprint(credit);
    byFingerprint.set(fingerprint, credit);
  }

  const credits = [...byFingerprint.values()];
  const sum = rows => rows.reduce((acc, row) => acc + row.minutes, 0);
  const total = sum(credits);
  const todayMinutes = sum(credits.filter(row => row.date === today));
  const weekMinutes = sum(credits.filter(row => row.date >= fromWeek && row.date <= today));
  const monthMinutes = sum(credits.filter(row => row.date >= fromMonth && row.date <= today));
  const activeDays = new Set(credits.map(row => row.date)).size;
  const localCount = credits.filter(row => row.sourceType === "local").length;

  const projects = ACTIVE_PROJECTS.map(project => {
    const mine = credits.filter(row => row.projectId === project.id);
    return {
      ...project,
      minutes: sum(mine),
      status: sourceState.get(project.id) || "unavailable",
      credits: mine.length,
      localCredits: mine.filter(row => row.sourceType === "local").length,
    };
  });

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
    localCount,
    aligned,
    droppedReadingShadows: coalescedPublic.droppedReadingShadows,
    projects,
    history: history?.schemaVersion === 1 ? history : null,
    historicalMinutes: Number(history?.summary?.historicalEstimateMinutes || 0),
    journeyMinutes: Number(history?.summary?.historicalEstimateMinutes || 0) + total,
  };
}

async function loadSummary(force = false) {
  if (!force && cachedSummary) return cachedSummary;
  if (!force && loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const stamp = Date.now();
      const [response, historyResponse] = await Promise.all([
        fetch(`${STUDY_HOURS_URL}?v=${stamp}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }),
        fetch(`${HISTORY_HOURS_URL}?v=${stamp}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }),
      ]);
      if (!response.ok) throw new Error("status");
      const payload = await response.json();
      const history = historyResponse.ok ? await historyResponse.json() : null;
      cachedSummary = summarize(payload, history);
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
    element("p", "", "Somando créditos confirmados dos projetos ativos e ajustes registrados na Central de Estudos neste navegador."),
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

  if (summary.history) {
    const historical = element("section", "study-hours-history");
    const historyHead = element("div", "study-hours-history-head");
    const historyCopy = element("div");
    historyCopy.append(
      element("span", "eyebrow", "HISTÓRICO RECONSTRUÍDO"),
      element("h3", "", `≈ ${duration(summary.historicalMinutes)} antes do ciclo atual`),
      element("p", "", "Estimativa conservadora, separada das horas atuais confirmadas. Regra informada: 1h por matéria/bloco, 2h por revisão e 3h por simulado."),
    );
    const journey = element("div", "study-hours-journey-total");
    journey.append(
      element("span", "", "Jornada total estimada"),
      element("strong", "", `≈ ${duration(summary.journeyMinutes)}`),
      element("small", "", `${duration(summary.historicalMinutes)} históricas + ${duration(summary.total)} atuais confirmadas`),
    );
    historyHead.append(historyCopy, journey);

    const details = element("details", "study-hours-history-details");
    const summaryNode = element("summary", "", "Ver reconstrução por ciclo");
    const list = element("div", "study-hours-history-list");
    for (const cycle of summary.history.cycles || []) {
      const row = element("div", "study-hours-history-row");
      const left = element("div");
      left.append(
        element("strong", "", cycle.name),
        element("small", "", cycle.calculation || cycle.evidence || ""),
      );
      const value = element("span", "", cycle.status === "conservative-floor"
        ? `≥ ${duration(cycle.estimateMinutes)}`
        : `≈ ${duration(cycle.estimateMinutes)}`);
      row.append(left, value);
      list.append(row);
    }
    if (Array.isArray(summary.history.omitted) && summary.history.omitted.length) {
      const omitted = element("p", "study-hours-history-omitted",
        `Fora da soma por falta de duração confiável: ${summary.history.omitted.map(item => item.name).join(", ")}.`);
      list.append(omitted);
    }
    details.append(summaryNode, list);
    historical.append(historyHead, details);
    metrics.__historyBlock = historical;
  }

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
    const sourceNote = project.localCredits
      ? `${project.credits} crédito(s) · ${project.localCredits} registro(s) local(is)`
      : project.status === "aligned"
        ? `${project.credits} crédito(s) confirmado(s)`
        : "fonte pública não alinhada; apenas registros locais confirmados podem aparecer";
    item.append(top, track, element("small", "", sourceNote));
    projects.append(item);
  }

  const foot = element("div", "study-hours-foot");
  const updated = summary.generatedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(summary.generatedAt))
    : "horário não publicado";
  foot.append(
    element("small", "", `Fonte: contratos federados + registro confirmado da Central de Estudos neste navegador · atualização ${updated}.`),
    element("small", "", `Sem dupla contagem: leitura + estudo da mesma unidade/data contam uma vez; ${summary.droppedReadingShadows} crédito(s) de leitura redundante(s) foram absorvidos. Registros locais equivalentes também são deduplicados; ajustes manuais distintos entram como tempo adicional.`),
  );

  root.append(head, metrics);
  if (metrics.__historyBlock) root.append(metrics.__historyBlock);
  root.append(projects, foot);
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

window.addEventListener("storage", event => {
  if (event.key !== LOCAL_STUDY_KEY) return;
  cachedSummary = null;
  const root = document.getElementById("study-hours-overview");
  if (root) hydrate(root, true);
});
