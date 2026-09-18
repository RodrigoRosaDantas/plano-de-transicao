const SUPABASE_URL = "https://fqqkkyusnzhuuizahkww.supabase.co";
const SUPABASE_KEY = "sb_publishable_GfoaAPKtYuSu_UY6wE8jMg_XsVjdWU7";
let dashboard = null;
let activeFilter = "all";
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(d).replace(","," ·");
};
const fmtDate = (v) => {
  if (!v) return "data não informada";
  const d = new Date(String(v).length===10 ? v+"T12:00:00-03:00" : v);
  return Number.isNaN(d.getTime()) ? "data não informada" : new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Sao_Paulo"}).format(d).replace(".","");
};
const esc = (v) => String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cleanSnippet = (v) => String(v||"").replace(/\s+/g," ").trim().slice(0,420);
const dayFmt = new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Sao_Paulo"});
const todayKey = () => dayFmt.format(new Date());
const localDay = (v) => {
  if (!v) return null;
  const d = new Date(String(v).length===10 ? v+"T12:00:00-03:00" : v);
  return Number.isNaN(d.getTime()) ? null : dayFmt.format(d);
};
const isPublishedToday = (h) => Boolean(h?.published_at) && String(h.published_at) === todayKey();
const isFoundToday = (h) => localDay(h?.first_seen_at) === todayKey();
const isLateFindToday = (h) => isFoundToday(h) && Boolean(h?.published_at) && String(h.published_at) < todayKey();

async function loadDashboard() {
  $("#globalStatus").textContent = "Atualizando";
  $(".radar-live").className = "radar-live";
  $("#refreshRadar").disabled = true;
  try {
    const res = await fetch(SUPABASE_URL+"/rest/v1/official_monitor_public_state?id=eq.1&select=payload",{
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:"Bearer "+SUPABASE_KEY
      },
      cache:"no-store"
    });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const rows = await res.json();
    dashboard = rows?.[0]?.payload || {};
    render();
  } catch (e) {
    $("#globalStatus").textContent = "Falha na leitura";
    $(".radar-live").classList.add("error");
    $("#hitsList").innerHTML = '<div class="radar-empty">Não foi possível ler o radar agora. A rotina automática continua no servidor.</div>';
  } finally {
    $("#refreshRadar").disabled = false;
  }
}

function render() {
  const d = dashboard || {};
  const run = d.lastRun || {};
  const status = run.status || "pending";
  $("#globalStatus").textContent = status === "ok" ? "Monitoramento ativo" : status === "partial" ? "Monitoramento parcial" : status === "running" ? "Varredura em curso" : "Aguardando varredura";
  $(".radar-live").className = "radar-live "+(status==="ok"?"ok":status==="partial"||status==="running"?"partial":status==="error"?"error":"");
  $("#runStatus").textContent = status === "ok" ? "ok" : status === "partial" ? "parcial" : status === "running" ? "rodando" : "pendente";
  $("#lastRunTime").textContent = fmtDateTime(run.finishedAt || run.startedAt);
  $("#runMeta").textContent = `${run.termsChecked || 0} termos · ${run.hitsFound || 0} achados · ${run.newHits || 0} novos`;
  $("#generatedAt").textContent = "Painel consultado "+fmtDateTime(d.generatedAt);

  const personal = d.personalRadar || {};
  $("#personalState").textContent = personal.configured ? "protegido · ativo" : "não configurado";
  $("#personalHits").textContent = personal.hits30d ?? 0;
  $("#personalLast").textContent = personal.lastHitAt ? "Última detecção privada: "+fmtDateTime(personal.lastHitAt) : "Termo privado ativo; nenhum detalhe é exposto no site.";
  const publicHits = d.hits || [];
  $("#publishedTodayCount").textContent = d.counts?.publishedToday ?? d.counts?.today ?? publicHits.filter(isPublishedToday).length;
  $("#foundTodayCount").textContent = d.counts?.foundToday ?? publicHits.filter(isFoundToday).length;
  $("#lateFoundTodayCount").textContent = d.counts?.lateFoundToday ?? publicHits.filter(isLateFindToday).length;
  $("#weekCount").textContent = d.counts?.last7d ?? 0;

  renderSources(d.sourceHealth || {});
  renderHits();
}

function renderSources(sources) {
  const names = [["DOU","Diário Oficial da União"],["DODF","Diário Oficial do Distrito Federal"]];
  let allOk = true;
  let waitingOfficialUpdate = false;
  $("#sourceHealth").innerHTML = names.map(([key,label])=>{
    const s = sources[key] || {status:"pending"};
    const st = s.status || "pending";
    const waitingIndex = key==="DODF" && s.todayStatus==="waiting-index";
    if(st!=="ok" && !waitingIndex) allOk=false;
    if(waitingIndex) waitingOfficialUpdate=true;

    const historyLabel =
      s.historyStatus==="skipped" ? "histórico não reconsultado nesta rodada" :
      s.historyStatus==="ok" ? "histórico conferido" :
      s.historyStatus==="partial" ? "histórico conferido parcialmente" :
      "histórico pendente";

    const dodfToday = s.todayStatus==="ok"
      ? `edição de hoje já indexada no SINJ${s.officialSiteStatus==="ok"?" · DODF certificado acessível":""}`
      : waitingIndex
        ? `edição de hoje ainda não indexada no SINJ${s.latestIndexedDate?` · última disponível: ${fmtDate(s.latestIndexedDate)}`:""}`
        : s.todayStatus==="empty"
          ? "SINJ consultado · nenhuma edição localizada para os radares"
          : `consulta do dia incompleta${s.latestIndexedDate?` · SINJ disponível até ${fmtDate(s.latestIndexedDate)}`:""}`;

    const detail = key==="DODF" && s.todayStatus
      ? `${dodfToday} · ${historyLabel}${s.historyErrorCount?` · ${s.historyErrorCount} falha(s)`:""}`
      : st==="ok"
        ? `${s.checked||0} radares checados · ${s.hits||0} ocorrência(s)`
        : st==="partial"
          ? `${s.checked||0} radares checados · ${s.errorCount||0} consulta(s) com falha nesta varredura`
          : "Aguardando diagnóstico da fonte.";

    const visualStatus = waitingIndex ? "waiting" : st;
    const statusLabel = waitingIndex ? "aguardando edição" : st==="ok" ? "online" : st==="partial" ? "parcial" : st;
    return `<div class="radar-source"><span class="radar-source-icon">${key==="DOU"?"BR":"DF"}</span><div><strong>${label}</strong><small>${esc(detail)}</small></div><span class="radar-source-status ${esc(visualStatus)}">${esc(statusLabel)}</span></div>`;
  }).join("");

  $("#sourceOverall").textContent = waitingOfficialUpdate
    ? "DF aguardando publicação/indexação"
    : allOk ? "fontes online" : "verificar fonte";
}

function renderHits() {
  const hits = (dashboard?.hits || []).filter(h => activeFilter==="all" || h.category===activeFilter);
  $("#hitsList").innerHTML = hits.length ? hits.map(h=>{
    const snippet = cleanSnippet(h.snippet);
    const timingTags = [
      isPublishedToday(h) ? '<span class="radar-tag published">publicado hoje</span>' : "",
      isFoundToday(h) ? '<span class="radar-tag found">detectado hoje</span>' : "",
      isLateFindToday(h) ? '<span class="radar-tag late">publicação anterior · achada hoje</span>' : ""
    ].join("");
    return `<article class="radar-hit">
      <div class="radar-hit-meta">
        <span class="radar-hit-source">${esc(h.source)}</span>
        <span>Publicado: ${fmtDate(h.published_at)}</span>
        <span>Detectado: ${fmtDateTime(h.first_seen_at)}</span>
        <span>${esc(h.section || "")}</span>
      </div>
      <div class="radar-hit-main"><h3>${esc(h.title)}</h3><p>${esc(snippet || "Ocorrência registrada pelo monitor oficial.")}</p><div class="radar-hit-tags"><span class="radar-tag">${esc(h.radar)}</span><span class="radar-tag">${esc(h.classification)}</span>${timingTags}</div><small>${esc(h.agency || "Órgão não identificado automaticamente")}</small></div>
      <a class="radar-hit-link" href="${esc(h.url)}" target="_blank" rel="noreferrer">Abrir oficial ↗</a>
    </article>`;
  }).join("") : '<div class="radar-empty">Nenhuma ocorrência pública nesse filtro. Isso é um bom tipo de silêncio.</div>';
}
$("#refreshRadar")?.addEventListener("click",loadDashboard);
$$("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
  activeFilter=btn.dataset.filter;
  $$("[data-filter]").forEach(b=>b.classList.toggle("active",b===btn));
  renderHits();
}));
loadDashboard();
