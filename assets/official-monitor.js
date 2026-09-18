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
const isNew = (v) => v && (Date.now()-new Date(v).getTime()) < 86400000;

async function loadDashboard() {
  $("#globalStatus").textContent = "Atualizando";
  $(".radar-live").className = "radar-live";
  $("#refreshRadar").disabled = true;
  try {
    const res = await fetch(SUPABASE_URL+"/rest/v1/rpc/get_official_monitor_dashboard",{
      method:"POST",
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:"Bearer "+SUPABASE_KEY,
        "Content-Type":"application/json"
      },
      body:"{}"
    });
    if(!res.ok) throw new Error("HTTP "+res.status);
    dashboard = await res.json();
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
  $("#todayCount").textContent = d.counts?.today ?? 0;
  $("#weekCount").textContent = d.counts?.last7d ?? 0;

  renderSources(d.sourceHealth || {});
  renderHits();
}

function renderSources(sources) {
  const names = [["DOU","Diário Oficial da União"],["DODF","Diário Oficial do Distrito Federal"]];
  let allOk = true;
  $("#sourceHealth").innerHTML = names.map(([key,label])=>{
    const s = sources[key] || {status:"pending"};
    const st = s.status || "pending";
    if(st!=="ok") allOk=false;
    const detail = st==="ok" ? `${s.checked||0} radares checados · ${s.hits||0} ocorrência(s)` : (s.errors?.[0] || "Aguardando diagnóstico da fonte.");
    return `<div class="radar-source"><span class="radar-source-icon">${key==="DOU"?"BR":"DF"}</span><div><strong>${label}</strong><small>${esc(detail)}</small></div><span class="radar-source-status ${esc(st)}">${st==="ok"?"online":st==="partial"?"parcial":st}</span></div>`;
  }).join("");
  $("#sourceOverall").textContent = allOk ? "fontes online" : "atenção";
}

function renderHits() {
  const hits = (dashboard?.hits || []).filter(h => activeFilter==="all" || h.category===activeFilter);
  $("#hitsList").innerHTML = hits.length ? hits.map(h=>{
    const snippet = cleanSnippet(h.snippet);
    return `<article class="radar-hit">
      <div class="radar-hit-meta"><span class="radar-hit-source">${esc(h.source)}</span><span>${fmtDate(h.published_at || h.first_seen_at)}</span><span>${esc(h.section || "")}</span></div>
      <div class="radar-hit-main"><h3>${esc(h.title)}</h3><p>${esc(snippet || "Ocorrência registrada pelo monitor oficial.")}</p><div class="radar-hit-tags"><span class="radar-tag">${esc(h.radar)}</span><span class="radar-tag">${esc(h.classification)}</span>${isNew(h.first_seen_at)?'<span class="radar-tag new">novo</span>':""}</div><small>${esc(h.agency || "Órgão não identificado automaticamente")}</small></div>
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
