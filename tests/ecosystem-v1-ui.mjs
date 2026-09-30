import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173/";
const CENTRAL = "https://rodrigorosadantas.github.io/central-estudos/";
const ROOT = "https://rodrigorosadantas.github.io/";
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const dayAt = (offset = 0) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = type => Number(parts.find(item => item.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - offset));
  return date.toISOString().slice(0, 10);
};

const projects = [
  { id: "seedf", name: "SEEDF", phase: "Pré-edital", status: "active", code: "P1", order: 1, url: ROOT + "seedf-ppge-dashboard/", statusUrl: ROOT + "seedf-ppge-dashboard/central-status.json" },
  { id: "tjdft", name: "TJDFT", phase: "Preparação", status: "active", code: "P2", order: 2, url: ROOT + "tjdft-dashboard/", statusUrl: ROOT + "tjdft-dashboard/central-status.json" },
  { id: "prf-adm", name: "PRF Administrativo", phase: "Pré-edital", status: "active", code: "P3", order: 3, url: ROOT + "prf-administrativo-dashboard/", statusUrl: ROOT + "prf-administrativo-dashboard/central-status.json" },
  { id: "tcego", name: "TCE-GO", phase: "Histórico arquivado", status: "archived", availability: "archive-only", archiveNote: "Projeto arquivado em 30/09/2026; acesso preservado para consulta histórica.", url: ROOT + "tce-go-dashboard/" }
];
const registry = { schemaVersion: 3, central: { version: "28.2.0", defaultProject: "seedf" }, projects };
const calls = new Map();
const contractFor = (project, day, nextActionKind) => ({
  schemaVersion: 1,
  projectId: project.id,
  publishedAt: day,
  source: { kind: "public-project-state", ref: "public-fixture", status: "synced", updatedAt: `${day}T12:00:00-03:00` },
  state: { phase: project.phase, cycle: "Ciclo demonstrativo", currentUnit: project.id === "prf-adm" ? null : "U01", nextAction: "Próxima ação de teste", nextActionKind, alerts: [] },
  study: { doNotDisplay: "PRIVATE_STUDY_SENTINEL" }
});

async function installRoutes(page, { catalogUnavailable = false, missingContractId = null, timeoutContractId = null } = {}) {
  await page.route(CENTRAL + "config/projects.json**", route => catalogUnavailable
    ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
    : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) }));
  await page.route(ROOT + "**/central-status.json**", async route => {
    const url = new URL(route.request().url());
    const slug = url.pathname.split("/").filter(Boolean)[0];
    const idBySlug = { "seedf-ppge-dashboard": "seedf", "tjdft-dashboard": "tjdft", "tce-go-dashboard": "tcego", "prf-administrativo-dashboard": "prf-adm" };
    const id = idBySlug[slug];
    const count = (calls.get(id) || 0) + 1;
    calls.set(id, count);
    const project = projects.find(item => item.id === id && item.status === "active");
    if (!project) return route.fulfill({ status: 404, body: "{}" });
    if (project.id === missingContractId) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    if (project.id === timeoutContractId) {
      await new Promise(resolve => setTimeout(resolve, 4500));
      try { return await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); } catch { return; }
    }
    const age = project.id === "prf-adm" ? 2 : project.id === "tjdft" ? 1 : 0;
    const action = project.id === "tjdft" ? "operational" : "planned";
    const contract = contractFor(project, dayAt(age), action);
    if (project.id === "prf-adm") contract.state.currentUnit = null;
    if (project.id === "tjdft" && count === 1) {
      contract.source.updatedAt = null;
      contract.state.phase = null;
      contract.state.cycle = null;
    }
    if (project.id === "tjdft" && count > 1) contract.projectId = "unexpected-project";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(contract) });
  });
}

async function openJourney(page) {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("#content[aria-busy=false]").waitFor({ timeout: 25000 });
  await page.locator("#mainTabs [data-view=journey]").click();
  await page.locator("#ecosystem-overview").waitFor();
}

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));
  await installRoutes(page);
  await openJourney(page);
  await page.locator(".ecosystem-card").first().waitFor({ timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll(".ecosystem-status")].every(node => node.textContent !== "Carregando contrato"), null, { timeout: 20000 });
  assert.ok(!(await page.locator("[data-ecosystem-grid]").innerText()).includes("Carregando catálogo público"), "loading message must disappear after cards are rendered");
  assert.deepEqual(await page.locator(".ecosystem-code").allTextContents(), ["P1", "P2", "P3"], "cards must follow the declared P1–P3 order");
  assert.ok((await page.locator(".ecosystem-card").nth(0).innerText()).includes("Próxima ação do calendário"), "planned actions must be labeled as calendar data");
  assert.ok((await page.locator(".ecosystem-card").nth(1).innerText()).includes("Próxima ação operacional publicada"), "operational actions must be labeled distinctly");
  const nullableFacts = await page.locator(".ecosystem-card").nth(1).locator(".ecosystem-fact").evaluateAll(nodes =>
    nodes.map(node => ({ label: node.querySelector("dt")?.textContent, value: node.querySelector("dd")?.textContent }))
  );
  assert.equal(nullableFacts.find(fact => fact.label === "Fase")?.value, "Não publicada", "nullable phase must remain valid and explicit");
  assert.equal(nullableFacts.find(fact => fact.label === "Ciclo")?.value, "Não publicado", "nullable cycle must remain valid and explicit");
  assert.ok((await page.locator(".ecosystem-card").nth(1).innerText()).includes("data não publicada"), "nullable source timestamp must remain valid and explicit");
  assert.ok((await page.locator(".ecosystem-card").nth(2).innerText()).includes("Publicação antiga"), "a two-calendar-day-old signal must be marked old in Brasília time");
  assert.ok((await page.locator(".ecosystem-card").nth(2).innerText()).includes("Não publicada"), "missing current unit must remain explicit rather than becoming zero");
  assert.ok((await page.locator("[data-ecosystem-history]").innerText()).includes("TCE-GO"), "archived TCE-GO must remain visible in a separate history list");
  assert.equal(calls.get("tcego") || 0, 0, "archived TCE-GO status must never be polled");
  assert.ok(!(await page.locator("#ecosystem-overview").innerText()).includes("PRIVATE_STUDY_SENTINEL"), "private progress fixture must never render");
  assert.equal(await page.locator(".journey-central-link").getAttribute("href"), CENTRAL, "header must preserve direct access to the operational Central");
  await page.screenshot({ path: "artifacts/jornada-ecosystem-desktop.png", fullPage: true });

  await page.locator("[data-ecosystem-refresh]").click();
  await page.waitForFunction(() => document.querySelectorAll(".ecosystem-status.is-incompatible").length === 1, null, { timeout: 15000 });
  assert.ok((await page.locator(".ecosystem-card").nth(1).innerText()).includes("Contrato incompatível"), "wrong project identity must produce an incompatibility state");
  if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(" | ")}`);
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const mobilePage = await mobileContext.newPage();
  await installRoutes(mobilePage);
  await openJourney(mobilePage);
  await mobilePage.locator(".ecosystem-card").nth(2).waitFor({ timeout: 20000 });
  await mobilePage.waitForFunction(() => [...document.querySelectorAll(".ecosystem-status")].every(node => node.textContent !== "Carregando contrato"), null, { timeout: 20000 });
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 2, `mobile layout must not overflow horizontally (${overflow}px)`);
  assert.equal(await mobilePage.locator(".ecosystem-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 1, "mobile status cards must stack in one column");
  await mobilePage.screenshot({ path: "artifacts/jornada-ecosystem-mobile.png", fullPage: true });
  await mobileContext.setOffline(true);
  await mobilePage.locator("[data-ecosystem-refresh]").click();
  await mobilePage.locator(".ecosystem-status.is-offline").first().waitFor({ timeout: 15000 });
  assert.equal(await mobilePage.locator(".ecosystem-status.is-offline").count(), 3, "offline refresh must mark all published signals unknown instead of showing old data as current");
  await mobileContext.close();

  const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const failurePage = await failureContext.newPage();
  await installRoutes(failurePage, { catalogUnavailable: true });
  await openJourney(failurePage);
  await failurePage.getByText("Catálogo indisponível", { exact: false }).waitFor({ timeout: 15000 });
  assert.equal(await failurePage.locator(".ecosystem-study-link").getAttribute("href"), CENTRAL, "direct study access must survive catalog outages");
  await failureContext.close();

  const contractFailureContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const contractFailurePage = await contractFailureContext.newPage();
  await installRoutes(contractFailurePage, { missingContractId: "prf-adm", timeoutContractId: "seedf" });
  await openJourney(contractFailurePage);
  await contractFailurePage.locator(".ecosystem-status.is-not-published").waitFor({ timeout: 15000 });
  await contractFailurePage.locator(".ecosystem-status").filter({ hasText: "Tempo limite excedido" }).waitFor({ timeout: 15000 });
  assert.ok((await contractFailurePage.locator(".ecosystem-card").nth(2).innerText()).includes("Contrato não publicado"), "HTTP 404 must differ from transport and schema failures");
  assert.ok((await contractFailurePage.locator(".ecosystem-card").nth(0).innerText()).includes("Sem resposta no limite de 3,5 s"), "slow endpoints must time out and remain visibly unavailable");
  await contractFailureContext.close();
  console.log("PASS  Jornada: desktop, mobile, nullable v1, offline, timeout, missing, stale, incompatible and unavailable states");
} finally {
  await browser.close();
}
