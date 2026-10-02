import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173/";
const FEDERATED = "https://rodrigorosadantas.github.io/central-estudos/data/federated-status.json";
await fs.mkdir("artifacts", { recursive: true });

const today = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = type => parts.find(part => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
})();

const project = (id, credits) => ({
  kind: "project",
  publicStatus: "live",
  integrity: { status: "aligned" },
  contract: {
    schemaVersion: 1,
    projectId: id,
    source: { status: "synced" },
    study: { evidence: "confirmed", timeCredits: credits },
  },
});

const fixture = {
  generatedAt: new Date().toISOString(),
  sources: {
    seedf: project("seedf", [
      { id: "seedf:reading:L01", date: today, kind: "reading", unit: "L01", minutes: 60 },
      { id: "seedf:study:L01", date: today, kind: "study", unit: "L01", minutes: 60 },
      { id: "seedf:study:L02", date: today, kind: "study", unit: "L02", minutes: 60 },
    ]),
    tjdft: project("tjdft", [
      { id: "tjdft:study:P01", date: today, kind: "study", unit: "P01", minutes: 60 },
    ]),
    "prf-adm": project("prf-adm", []),
  },
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));
  await page.route("**/central-estudos/data/federated-status.json**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fixture),
  }));

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("#content[aria-busy=false]").waitFor({ timeout: 25000 });
  await page.locator("#study-hours-overview").waitFor({ timeout: 15000 });
  await page.locator("#study-hours-overview .study-hours-metrics").waitFor({ timeout: 15000 });
  assert.equal(await page.locator("#study-hours-overview .study-hours-error").count(), 0, "painel não pode cair em estado de erro com fixture válida");

  const panelText = await page.locator("#study-hours-overview").innerText();
  assert.ok(panelText.includes("Acumulado"), "painel deve exibir o acumulado atual");
  assert.ok(panelText.includes("3h"), "reading + study de L01 devem contar uma única vez; total atual esperado = 3h");
  assert.ok(panelText.includes("588h históricas + 3h atuais confirmadas"), "jornada deve separar histórico reconstruído e ciclo atual");
  assert.ok(panelText.includes("≈ 591h"), "jornada total estimada deve fechar em 591h no fixture");
  assert.ok(panelText.includes("1 crédito(s) de leitura redundante(s) foram absorvidos"), "painel deve declarar a deduplicação aplicada");

  const metrics = await page.locator(".study-hours-metric strong").allTextContents();
  assert.equal(metrics.at(-1), "3h", "KPI Acumulado não pode inflar leitura + estudo da mesma unidade");

  await page.locator(".study-hours-history-details summary").click();
  assert.equal(await page.locator(".study-hours-history-row").count(), 8, "histórico deve preservar os oito ciclos precificados");
  await page.screenshot({ path: "artifacts/study-hours-dedup-desktop.png", fullPage: true });
  if (pageErrors.length) throw new Error(`Erros JavaScript: ${pageErrors.join(" | ")}`);
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const mobilePage = await mobile.newPage();
  await mobilePage.route("**/central-estudos/data/federated-status.json**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fixture),
  }));
  await mobilePage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await mobilePage.locator("#content[aria-busy=false]").waitFor({ timeout: 25000 });
  await mobilePage.locator("#study-hours-overview").waitFor({ timeout: 15000 });
  await mobilePage.locator("#study-hours-overview .study-hours-metrics").waitFor({ timeout: 15000 });
  assert.equal(await mobilePage.locator("#study-hours-overview .study-hours-error").count(), 0, "painel móvel não pode cair em erro com fixture válida");
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 2, `painel de horas não pode causar overflow móvel (${overflow}px)`);
  await mobilePage.screenshot({ path: "artifacts/study-hours-dedup-mobile.png", fullPage: true });
  await mobile.close();

  console.log("PASS  Horas: histórico separado, deduplicação leitura+estudo e responsividade");
} finally {
  await browser.close();
}
