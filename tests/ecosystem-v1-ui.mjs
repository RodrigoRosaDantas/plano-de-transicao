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
  { id: "tcego", name: "TCE-GO", phase: "Edital publicado", status: "active", code: "P3", order: 3, url: `${ROOT}tce-go-dashboard/`, statusUrl: `${ROOT}tce-go-dashboard/central-status.json` },
  { id: "seedf", name: "SEEDF", phase: "Pré-edital", status: "active", code: "P1", order: 1, url: `${ROOT}seedf-ppge-dashboard/`, statusUrl: `${ROOT}seedf-ppge-dashboard/central-status.json` },
  { id: "tjdft", name: "TJDFT", phase: "Preparação", status: "active", code: "P2", order: 2, url: `${ROOT}tjdft-dashboard/`, statusUrl: `${ROOT}tjdft-dashboard/central-status.json` },
  { id: "prf-adm", name: "PRF Administrativo", phase: "Pré-edital", status: "active", code: "P4", order: 4, url: `${ROOT}prf-administrativo-dashboard/`, statusUrl: `${ROOT}prf-administrativo-dashboard/central-status.json` }
];
const registry = { schemaVersion: 3, central: { version: "28.1.0", defaultProject: "tcego" }, projects };
const calls = new Map();
const contractFor = (project, day, nextActionKind) => ({
  schemaVersion: 1,
  projectId: project.id,
  publishedAt: day,
  source: { kind: "public-project-state", ref: "public-fixture", status: "synced", updatedAt: `${day}T12:00:00-03:00` },
  state: { phase: project.phase, cycle: "Ciclo demonstrativo", currentUnit: project.id === "tcego" ? null : "U01", nextAction: "Próxima ação de teste", nextActionKind, alerts: [] },
  study: { doNotDisplay: "PRIVATE_STUDY_SENTINEL" }
});

async function installRoutes(page, { catalogUnavailable = false } = {}) {
  await page.route(`${CENTRAL}config/projects.json**`, route => catalogUnavailable
    ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
    : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) }));
  await page.route(`${ROOT}**/central-status.json**`, async route => {
    const url = new URL(route.request().url());
    const slug = url.pathname.split("/").filter(Boolean)[0];
    const idBySlug = { "seedf-ppge-dashboard": "seedf", "tjdft-dashboard": "tjdft", "tce-go-dashboard": "tcego", "prf-administrativo-dashboard": "prf-adm" };
    const project = projects.find(item => item.id === idBySlug[slug]);
    if (!project) return route.fulfill({ status: 404, body: "{}" });
    const count = (calls.get(project.id) || 0) + 1;
    calls.set(project.id, count);
    if (project.id === "prf-adm") return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    const age = project.id === "tcego" ? 2 : project.id === "tjdft" ? 1 : 0;
    const action = project.id === "tjdft" ? "operational" : "planned";
    const contract = contractFor(project, dayAt(age), action);
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
  assert.deepEqual(await page.locator(".ecosystem-code").allTextContents(), ["P1", "P2", "P3", "P4"], "cards must follow the declared P1–P4 order");
  assert.ok((await page.locator(".ecosystem-card").nth(0).innerText()).includes("Próxima ação do calendário"), "planned actions must be labeled as calendar data");
  assert.ok((await page.locator(".ecosystem-card").nth(1).innerText()).includes("Próxima ação operacional publicada"), "operational actions must be labeled distinctly");
  assert.ok((await page.locator(".ecosystem-card").nth(2).innerText()).includes("Publicação antiga"), "a two-calendar-day-old signal must be marked old in Brasília time");
  assert.ok((await page.locator(".ecosystem-card").nth(2).innerText()).includes("Não publicada"), "missing current unit must remain explicit rather than becoming zero");
  assert.ok((await page.locator(".ecosystem-card").nth(3).innerText()).includes("Status indisponível"), "HTTP/network failure must be distinct from an incompatible contract");
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
  await mobilePage.locator(".ecosystem-card").nth(3).waitFor({ timeout: 20000 });
  await mobilePage.waitForFunction(() => [...document.querySelectorAll(".ecosystem-status")].every(node => node.textContent !== "Carregando contrato"), null, { timeout: 20000 });
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 2, `mobile layout must not overflow horizontally (${overflow}px)`);
  assert.equal(await mobilePage.locator(".ecosystem-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 1, "mobile status cards must stack in one column");
  await mobilePage.screenshot({ path: "artifacts/jornada-ecosystem-mobile.png", fullPage: true });
  await mobileContext.close();

  const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const failurePage = await failureContext.newPage();
  await installRoutes(failurePage, { catalogUnavailable: true });
  await openJourney(failurePage);
  await failurePage.getByText("Catálogo indisponível", { exact: false }).waitFor({ timeout: 15000 });
  assert.equal(await failurePage.locator(".ecosystem-study-link").getAttribute("href"), CENTRAL, "direct study access must survive catalog outages");
  await failureContext.close();
  console.log("PASS  Jornada: desktop, refresh, contract failure states, privacy and mobile layout");
} finally {
  await browser.close();
}
