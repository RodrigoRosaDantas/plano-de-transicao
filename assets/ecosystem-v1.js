const REGISTRY_URL = "https://rodrigorosadantas.github.io/central-estudos/config/projects.json";
const CENTRAL_URL = "https://rodrigorosadantas.github.io/central-estudos/";
const NEXT_KINDS = new Set(["operational", "planned", "manual", "none"]);
let activeRoot = null;
let cachedProjects = null;
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
  const projects = registry.projects.filter(project => project?.status === "active");
  const codes = projects.map(project => project.code);
  if (!projects.length || codes.some(code => !/^P[1-9][0-9]*$/.test(code)) || new Set(codes).size !== codes.length) throw new Error("mapping");
  for (const project of projects) {
    const pageUrl = new URL(project.url);
    const statusUrl = new URL(project.statusUrl);
    if (pageUrl.protocol !== "https:" || statusUrl.protocol !== "https:" || statusUrl.origin !== pageUrl.origin || !statusUrl.pathname.endsWith("/central-status.json")) throw new Error("url");
    if (typeof project.name !== "string" || typeof project.phase !== "string" || !Number.isInteger(project.order)) throw new Error("fields");
  }
  return projects.sort((a, b) => a.order - b.order);
}

function validateArchivedProjects(registry) {
  const projects = registry.projects.filter(project => project?.status === "archived");
  for (const project of projects) {
    const pageUrl = new URL(project.url);
    if (pageUrl.protocol !== "https:" || typeof project.name !== "string" || typeof project.phase !== "string" || typeof project.archiveNote !== "string" || !project.archiveNote.trim()) throw new Error("archive");
    if (project.availability !== "archive-only") throw new Error("archive");
  }
  return projects.sort((a, b) => (a.order || 99) - (b.order || 99));
}

function validateContract(contract, project) {
  const state = contract?.state;
  const source = contract?.source;
  if (contract?.schemaVersion !== 1 || contract.projectId !== project.id || typeof contract.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(contract.publishedAt)) throw new Error("identity");
  if (!source || typeof source.kind !== "string" || typeof source.ref !== "string" || typeof source.status !== "string" || !validTextOrNull(source.updatedAt)) throw new Error("source");
  if (!state || !validTextOrNull(state.phase) || !validTextOrNull(state.cycle) || !validTextOrNull(state.currentUnit) || !validTextOrNull(state.nextAction) || !NEXT_KINDS.has(state.nextActionKind) || !Array.isArray(state.alerts) || state.alerts.some(alert => typeof alert !== "string")) throw new Error("state");
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

async function fetchPublic(url) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    return await fetch(url, { method: "GET", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
    throw new Error("network");
  } finally {
    clearTimeout(timeout);
  }
}

function contractFailure(error) {
  if (error?.message === "not-published") return { status: "Contrato não publicado", kind: "is-not-published", badge: "Endpoint não publicado", detail: "O projeto ainda não publicou este contrato read-only." };
  if (error?.message === "offline" || (typeof navigator !== "undefined" && navigator.onLine === false)) return { status: "Sem conexão", kind: "is-offline", badge: "Estado não verificado offline", detail: "O estado permanece desconhecido até a próxima leitura com conexão." };
  if (error?.name === "AbortError") return { status: "Tempo limite excedido", kind: "is-unavailable", badge: "Sem resposta no limite de 3,5 s", detail: "O endpoint público não respondeu a tempo." };
  if (error?.message === "network") return { status: "Falha de rede", kind: "is-unavailable", badge: "Status indisponível", detail: "A rede não permitiu validar o contrato." };
  if (error?.message === "unavailable") return { status: "Status indisponível", kind: "is-unavailable", badge: "Endpoint sem resposta válida", detail: "O site do projeto não retornou um status público." };
  return { status: "Status não validado", kind: "is-incompatible", badge: "Contrato incompatível", detail: "A resposta não corresponde ao contrato público v1." };
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

function showContractFailure(view, failure) {
  view.status.className = `ecosystem-status ${failure.kind}`;
  view.status.textContent = failure.status;
  view.freshnessBadge.className = `ecosystem-freshness ${failure.kind}`;
  view.freshnessBadge.textContent = failure.badge;
  view.sourceLabel.textContent = failure.detail;
}

function renderContract(view, contract) {
  view.status.className = "ecosystem-status is-ready";
  view.status.textContent = contract.source.status === "partial" ? "Publicação parcial" : "Contrato validado";
  view.facts.replaceChildren();
  addFact(view.facts, "Fase", contract.state.phase || "Não publicada");
  addFact(view.facts, "Ciclo", contract.state.cycle || "Não publicado");
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

function renderArchive(root, projects) {
  const history = root.querySelector("[data-ecosystem-history]");
  if (!history) return;
  history.replaceChildren();
  if (!projects.length) {
    history.append(element("p", "ecosystem-message", "Nenhum projeto arquivado cadastrado."));
    return;
  }
  for (const project of projects) {
    const card = element("article", "ecosystem-history-card");
    card.append(element("strong", "", project.name), element("span", "ecosystem-history-phase", project.phase), element("p", "", project.archiveNote));
    const link = element("a", "ecosystem-project-link", "Abrir histórico");
    link.href = project.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", "Abrir histórico de " + project.name);
    card.append(link);
    history.append(card);
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
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    let catalog;
    if (offline && cachedProjects) {
      catalog = cachedProjects;
    } else {
      const response = await fetchPublic(REGISTRY_URL + "?v=28.2.0");
      if (!response.ok) throw new Error("registry");
      const registry = await response.json();
      catalog = { active: validateRegistry(registry), archived: validateArchivedProjects(registry) };
      cachedProjects = catalog;
    }
    if (sequence !== requestSequence || !root.isConnected) return;
    const views = catalog.active.map(project => projectCard(project));
    grid.replaceChildren();
    for (const view of views) grid.append(view.card);
    renderArchive(root, catalog.archived);
    await Promise.all(views.map(async view => {
      try {
        const statusResponse = await fetchPublic(view.project.statusUrl + "?v=28.2.0");
        if (statusResponse.status === 404) throw new Error("not-published");
        if (!statusResponse.ok) throw new Error("unavailable");
        const contract = validateContract(await statusResponse.json(), view.project);
        if (sequence === requestSequence && root.isConnected) renderContract(view, contract);
      } catch (error) {
        if (sequence !== requestSequence || !root.isConnected) return;
        showContractFailure(view, contractFailure(error));
      }
    }));
  } catch (error) {
    if (sequence === requestSequence && root.isConnected) {
      const message = error?.message === "offline"
        ? "Sem conexão. Os sinais públicos não foram carregados; os acessos diretos à Central continuam disponíveis."
        : error?.message === "network"
          ? "Falha de rede ao carregar o catálogo. Use o acesso direto para escolher um projeto na Central."
          : error?.name === "AbortError"
            ? "Tempo limite excedido ao carregar o catálogo. Os acessos diretos à Central continuam disponíveis."
            : "Catálogo indisponível. Use o acesso direto para escolher um projeto na Central.";
      grid.replaceChildren(element("p", "ecosystem-message is-error", message));
    }
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
