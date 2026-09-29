const REGISTRY_URL = "https://rodrigorosadantas.github.io/central-estudos/config/projects.json";
const CENTRAL_URL = "https://rodrigorosadantas.github.io/central-estudos/";
const PRIORITIES = new Set(["P1", "P2", "P3", "P4"]);
const NEXT_KINDS = new Set(["operational", "planned", "manual", "none"]);
let activeRoot = null;
let requestSequence = 0;

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined && content !== null) node.textContent = String(content);
  return node;
}

function validTextOrNull(value) {
  return value === null || typeof value === "string";
}

function validateRegistry(registry) {
  if (!registry || registry.schemaVersion !== 3 || !Array.isArray(registry.projects)) throw new Error("registry");
  const projects = registry.projects.filter(project => project?.status === "active" && PRIORITIES.has(project.code));
  const codes = new Set(projects.map(project => project.code));
  if (projects.length !== 4 || codes.size !== 4 || [...PRIORITIES].some(code => !codes.has(code))) throw new Error("mapping");
  for (const project of projects) {
    const pageUrl = new URL(project.url);
    const statusUrl = new URL(project.statusUrl);
    if (pageUrl.protocol !== "https:" || statusUrl.protocol !== "https:" || statusUrl.origin !== pageUrl.origin || !statusUrl.pathname.endsWith("/central-status.json")) throw new Error("url");
    if (typeof project.name !== "string" || typeof project.phase !== "string" || !Number.isInteger(project.order)) throw new Error("fields");
  }
  return projects.sort((a, b) => a.order - b.order);
}

function validateContract(contract, project) {
  const state = contract?.state;
  const source = contract?.source;
  if (contract?.schemaVersion !== 1 || contract.projectId !== project.id || typeof contract.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(contract.publishedAt)) throw new Error("identity");
  if (!source || typeof source.kind !== "string" || typeof source.ref !== "string" || typeof source.status !== "string" || typeof source.updatedAt !== "string") throw new Error("source");
  if (!state || typeof state.phase !== "string" || typeof state.cycle !== "string" || !validTextOrNull(state.currentUnit) || !validTextOrNull(state.nextAction) || !NEXT_KINDS.has(state.nextActionKind) || !Array.isArray(state.alerts) || state.alerts.some(alert => typeof alert !== "string")) throw new Error("state");
  return contract;
}

function localDay(value, timeZone) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsedDay = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== value ? null : value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(parsed);
  const pick = name => parts.find(part => part.type === name)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function freshness(publishedAt) {
  const today = localDay(new Date().toISOString(), "America/Sao_Paulo");
  const published = localDay(publishedAt, "America/Sao_Paulo");
  if (!today || !published) return { label: `Publicado em ${publishedAt}`, old: false };
  const dayNumber = value => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  const age = dayNumber(today) - dayNumber(published);
  if (age <= 0) return { label: "Publicado hoje", old: false };
  if (age === 1) return { label: "Publicado ontem", old: false };
  return { label: `Publicação antiga · ${age} dias`, old: true };
}

function dateLabel(value) {
  if (!value) return "data não publicada";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(parsed);
}

function addFact(container, label, value, className = "") {
  const fact = element("div", `ecosystem-fact ${className}`.trim());
  fact.append(element("dt", "", label), element("dd", "", value));
  container.append(fact);
}

function actionLabel(contract) {
  if (!contract.state.nextAction) return "Próxima ação não publicada";
  if (contract.state.nextActionKind === "operational") return "Próxima ação operacional publicada";
  if (contract.state.nextActionKind === "planned") return "Próxima ação do calendário";
  if (contract.state.nextActionKind === "manual") return "Próxima ação informada manualmente";
  return "Próxima ação não publicada";
}

function projectCard(project) {
  const card = element("article", "ecosystem-card");
  const header = element("header", "ecosystem-card-head");
  const identity = element("div", "ecosystem-card-identity");
  identity.append(element("span", "ecosystem-code", project.code), element("div", "", project.name));
  const phase = element("p", "ecosystem-phase", project.phase);
  const status = element("span", "ecosystem-status is-loading", "Carregando contrato");
  header.append(identity, status);
  const facts = element("dl", "ecosystem-facts");
  addFact(facts, "Fase", project.phase);
  const foot = element("footer", "ecosystem-card-foot");
  const freshnessBadge = element("span", "ecosystem-freshness", "Aguardando publicação");
  const sourceLabel = element("span", "ecosystem-source", "Fonte pública não carregada");
  const projectLink = element("a", "ecosystem-project-link", "Abrir projeto →");
  projectLink.href = project.url;
  projectLink.target = "_blank";
  projectLink.rel = "noreferrer";
  projectLink.setAttribute("aria-label", `Abrir ${project.name}`);
  foot.append(freshnessBadge, sourceLabel, projectLink);
  card.append(header, phase, facts, foot);
  return { project, card, status, facts, freshnessBadge, sourceLabel, projectLink };
}

function showContractFailure(view, message, kind) {
  view.status.className = `ecosystem-status ${kind}`;
  view.status.textContent = message;
  view.freshnessBadge.className = `ecosystem-freshness ${kind}`;
  view.freshnessBadge.textContent = kind === "is-incompatible" ? "Contrato incompatível" : "Contrato indisponível";
  view.sourceLabel.textContent = "Sinal não validado";
}

function renderContract(view, contract) {
  view.status.className = "ecosystem-status is-ready";
  view.status.textContent = contract.source.status === "partial" ? "Publicação parcial" : "Contrato validado";
  view.facts.replaceChildren();
  addFact(view.facts, "Fase", contract.state.phase);
  addFact(view.facts, "Ciclo", contract.state.cycle);
  if (contract.state.currentUnit) addFact(view.facts, "Unidade atual publicada", contract.state.currentUnit);
  else addFact(view.facts, "Unidade atual", "Não publicada");
  addFact(view.facts, actionLabel(contract), contract.state.nextAction || "Sem ação disponível", "ecosystem-next");
  const freshnessState = freshness(contract.publishedAt);
  view.freshnessBadge.className = `ecosystem-freshness${freshnessState.old ? " is-old" : ""}`;
  view.freshnessBadge.textContent = `${freshnessState.label} · ${dateLabel(contract.publishedAt)}`;
  view.sourceLabel.textContent = `Fonte: ${contract.source.status} · atualizada ${dateLabel(contract.source.updatedAt)}`;
  for (const alertText of contract.state.alerts.slice(0, 2)) {
    const alert = element("p", "ecosystem-alert", alertText);
    view.card.append(alert);
  }
}

async function loadOverview(root, manual = false) {
  const grid = root.querySelector("[data-ecosystem-grid]");
  const refresh = root.querySelector("[data-ecosystem-refresh]");
  if (!grid) return;
  const sequence = ++requestSequence;
  if (refresh) refresh.disabled = true;
  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren(element("p", "ecosystem-message", manual ? "Atualizando sinais publicados…" : "Carregando catálogo público e contratos de status…"));
  try {
    const response = await fetch(`${REGISTRY_URL}?v=28.1.0`, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("registry");
    const projects = validateRegistry(await response.json());
    if (sequence !== requestSequence || !root.isConnected) return;
    const views = projects.map(project => projectCard(project));
    grid.replaceChildren();
    for (const view of views) grid.append(view.card);
    await Promise.all(views.map(async view => {
      try {
        const statusResponse = await fetch(`${view.project.statusUrl}?v=28.1.0`, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
        if (!statusResponse.ok) throw new Error("unavailable");
        const contract = validateContract(await statusResponse.json(), view.project);
        if (sequence === requestSequence && root.isConnected) renderContract(view, contract);
      } catch (error) {
        if (sequence !== requestSequence || !root.isConnected) return;
        showContractFailure(view, error?.message === "unavailable" ? "Status indisponível" : "Status não validado", error?.message === "unavailable" ? "is-unavailable" : "is-incompatible");
      }
    }));
  } catch {
    if (sequence === requestSequence && root.isConnected) grid.replaceChildren(element("p", "ecosystem-message is-error", "Catálogo indisponível. Use o acesso direto para escolher um projeto na Central."));
  } finally {
    if (sequence === requestSequence && root.isConnected) {
      grid.setAttribute("aria-busy", "false");
      if (refresh) refresh.disabled = false;
    }
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-ecosystem-refresh]");
  if (!button) return;
  const root = button.closest("#ecosystem-overview");
  if (root) loadOverview(root, true);
});

const observer = new MutationObserver(() => {
  const root = document.getElementById("ecosystem-overview");
  if (root && root !== activeRoot) {
    activeRoot = root;
    loadOverview(root);
  } else if (!root) {
    activeRoot = null;
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
if (document.getElementById("ecosystem-overview")) {
  activeRoot = document.getElementById("ecosystem-overview");
  loadOverview(activeRoot);
}
