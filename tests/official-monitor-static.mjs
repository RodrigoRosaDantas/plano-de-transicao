import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error("❌ " + message);
    process.exitCode = 1;
  } else {
    console.log("✅ " + message);
  }
};

const html = read("radar-oficial.html");
const front = read("assets/official-monitor.js");
const personalWeb = read("assets/personal-web-search.js");
const monitorCss = read("assets/official-monitor.css");
const collector = read("scripts/official-monitor.mjs");
const workflow = read(".github/workflows/official-monitor.yml");
const sw = read("sw.js");

assert(html.includes("Radar Oficial"), "página dedicada do Radar Oficial existe");
assert(html.includes("06:15–18:15") && html.includes("21:15"), "cadência exibida coincide com o workflow");
assert(html.includes("SEDES/DF") && html.includes("todas as menções"), "interface explicita monitoramento amplo da SEDES/DF");
assert(!html.includes('SEEDF</span><strong>Órgão + pré-edital') && !html.includes('TJDFT</span><strong>Órgão + pré-edital'), "SEEDF e TJDFT permanecem somente em monitoramento específico");
assert(front.includes("const grouped = new Map()"), "interface agrupa ocorrências coincidentes");
assert(collector.includes('const isGeneral=label.includes("geral")'), "coletor diferencia radar geral de radar de concurso");
assert(collector.includes('term.category==="sedes"') && collector.includes('localHour===21'), "histórico profundo diário prioriza SEDES e deixa SEEDF/TJDFT para janela noturna");
assert(collector.includes("caseOnly"), "TJDFT rejeita referência meramente judicial como falso positivo");
assert(front.includes("/rest/v1/official_monitor_public_state"), "frontend lê somente o estado público sanitizado");
assert(html.includes("MEU RASTRO NA INTERNET") && html.includes("webRadarUnlockForm"), "Radar Oficial possui área pessoal de pesquisa na web");
assert(html.includes("Gerenciar código") && html.includes("Identificadores de pesquisa"), "área privada gerencia acesso e identificadores");
assert(personalWeb.includes("add_identifier") && personalWeb.includes("rotate_code") && personalWeb.includes("set_identifier_scope"), "cliente suporta cadastro, escopo e rotação de acesso");
assert(personalWeb.includes("webRadarOfficialResults"), "cliente renderiza ocorrências pessoais do DOU/DODF somente na área privada");
assert(monitorCss.includes(".web-radar-private[hidden]") && monitorCss.includes("display:none!important"), "área privada fica realmente oculta antes do desbloqueio");
assert(personalWeb.includes("webRadarData={counts:{},results:[],lastRun:null,identifiers:[],officialHits:[]}"), "bloqueio limpa o estado privado em memória");
assert(html.includes('data-web-filter="new"') && personalWeb.includes('webRadarFilter==="new"'), "Radar Web destaca resultados novos da última rodada");
assert(personalWeb.includes('DuckDuckGo') && personalWeb.includes('web-radar-new'), "Radar Web mostra provedor e marca visualmente novos resultados");
assert(personalWeb.includes("personal-web-search") && personalWeb.includes("sessionStorage"), "Radar Web usa backend protegido e sessão temporária");
assert(personalWeb.includes("plano.webRadar.session.v2") && !personalWeb.includes("plano.webRadar.access.v1"), "Radar Web não persiste mais o código de acesso");
assert(personalWeb.includes("força da correspondência") && !personalWeb.includes("confiança técnica"), "interface não confunde correspondência textual com identidade");
assert(personalWeb.includes("matched_identifiers") && personalWeb.includes("matchedLabel"), "resultado único pode exibir múltiplos identificadores mascarados");
assert(personalWeb.includes("correspondência textual do identificador") && !personalWeb.includes("correspondência textual do nome"), "texto da interface é válido para nome, documento e e-mail");
assert(!personalWeb.includes("MNS2-CZFH-K7VN") && !html.includes("MNS2-CZFH-K7VN"), "código pessoal não está hardcoded no repositório público");
assert(!front.includes("official_monitor_terms") && !front.includes("official_monitor_occurrences"), "frontend não consulta tabelas privadas");
assert(!front.includes("get_official_monitor_dashboard"), "frontend não usa RPC SECURITY DEFINER legada");
assert(!html.includes("Rodrigo Rosa Dantas") && !front.includes("Rodrigo Rosa Dantas") && !collector.includes("Rodrigo Rosa Dantas"), "nome pessoal não está hardcoded no repositório público");
assert(workflow.includes("id-token: write"), "workflow usa OIDC do GitHub");
assert(workflow.includes('cron: "15 9-21 * * *"') && workflow.includes('cron: "15 0 * * *"'), "agendamento automático está configurado");
assert(collector.includes("relevantPublicContext(text,term)") && collector.includes("relevantPublicContext(pdfText,term)"), "coletor aplica contexto estrito para reduzir falsos positivos");
assert(collector.includes('todayStatus=todayQueryErrors?"partial":"checked"'), "ausência de ocorrência hoje não degrada a saúde da fonte");
assert(sw.includes("./radar-oficial.html") && sw.includes("./assets/official-monitor.js") && sw.includes("./assets/official-monitor.css") && sw.includes("./assets/personal-web-search.js"), "Radar Oficial e Radar Web estão incluídos no PWA");
assert(sw.includes("plano-transicao-v43-private-identifiers"), "cache v43 do Radar Web está ativo");

if (process.exitCode) {
  throw new Error("Auditoria estática do Radar Oficial falhou.");
}
console.log("Radar Oficial: auditoria estática concluída sem regressões.");
