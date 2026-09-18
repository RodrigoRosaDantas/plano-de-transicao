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
  $("#personalLast").textContent = personal.lastHitAt ? "Última detecção privada: "+fmtDateTime(personal.lastHitAt) : "Identificadores privados ativos; nenhum detalhe é exposto no site.";
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
  $("#sourceHealth").innerHTML = names.map(([key,label])=>{
    const s = sources[key] || {status:"pending"};
    const st = s.status || "pending";
    if(st!=="ok") allOk=false;

    const historyLabel =
      s.historyStatus==="skipped" ? "histórico não reconsultado nesta rodada" :
      s.historyStatus==="ok" ? `histórico conferido${Number.isFinite(Number(s.historyChecked))?` · ${Number(s.historyChecked)} termo(s) aprofundado(s)`:""}` :
      s.historyStatus==="partial" ? "histórico conferido parcialmente" :
      "histórico pendente";

    let detail;
    if(key==="DODF"){
      const todayLabel =
        s.todayStatus==="checked"
          ? (Number(s.todayHits||0)>0
              ? `SINJ consultado · ${s.todayHits} ocorrência(s) dos radares com data de hoje`
              : "SINJ consultado · nenhuma ocorrência dos radares com data de hoje")
          : s.todayStatus==="partial"
            ? `consulta do dia teve falha${s.errorCount?` · ${s.errorCount} alerta(s) técnico(s)`:""}`
            : s.todayStatus==="waiting-index"
              ? "estado legado: aguardando nova varredura com a regra corrigida"
              : s.todayStatus==="empty"
                ? "SINJ consultado · nenhuma ocorrência dos radares"
                : "aguardando primeira consulta";

      const officialLabel =
        s.officialSiteStatus==="ok" ? "DODF certificado também conferido" :
        s.officialSiteStatus==="unreachable" ? "DODF certificado direto indisponível; SINJ segue como fonte oficial de pesquisa" :
        s.officialSiteStatus==="skipped" ? "PDF certificado não sondado neste horário" :
        "";

      const lastMatchedDate=s.latestMatchedDate || s.latestIndexedDate;
      const lastMatch=lastMatchedDate
        ? `última data retornada para os termos: ${fmtDate(lastMatchedDate)}`
        : "";
      detail=[todayLabel,officialLabel,lastMatch,historyLabel].filter(Boolean).join(" · ");
    }else{
      detail = st==="ok"
        ? `${s.checked||0} radares checados · ${s.hits||0} ocorrência(s)`
        : st==="partial"
          ? `${s.checked||0} radares checados · ${s.errorCount||0} consulta(s) com falha nesta varredura`
          : "Aguardando diagnóstico da fonte.";
    }

    const statusLabel = st==="ok" ? "online" : st==="partial" ? "parcial" : st;
    return `<div class="radar-source"><span class="radar-source-icon">${key==="DOU"?"BR":"DF"}</span><div><strong>${label}</strong><small>${esc(detail)}</small></div><span class="radar-source-status ${esc(st)}">${esc(statusLabel)}</span></div>`;
  }).join("");
  $("#sourceOverall").textContent = allOk ? "fontes online" : "verificar fonte";
}

function renderHits() {
  const filtered = (dashboard?.hits || []).filter(h => activeFilter==="all" || h.category===activeFilter);
  const grouped = new Map();
  for (const h of filtered) {
    const contextKey = cleanSnippet(h.snippet).toLowerCase().slice(0,220);
    const key = [h.source,h.url,h.published_at||"",contextKey].join("|");
    if (!grouped.has(key)) {
      grouped.set(key,{...h,radars:[h.radar].filter(Boolean),classifications:[h.classification].filter(Boolean)});
      continue;
    }
    const item=grouped.get(key);
    if (h.radar && !item.radars.includes(h.radar)) item.radars.push(h.radar);
    if (h.classification && !item.classifications.includes(h.classification)) item.classifications.push(h.classification);
  }
  const hits=[...grouped.values()];
  $("#hitsList").innerHTML = hits.length ? hits.map(h=>{
    const snippet = cleanSnippet(h.snippet);
    const timingTags = [
      isPublishedToday(h) ? '<span class="radar-tag published">publicado hoje</span>' : "",
      isFoundToday(h) ? '<span class="radar-tag found">detectado hoje</span>' : "",
      isLateFindToday(h) ? '<span class="radar-tag late">publicação anterior · achada hoje</span>' : ""
    ].join("");
    const radarTags=(h.radars||[h.radar]).filter(Boolean).map(r=>'<span class="radar-tag">'+esc(r)+'</span>').join("");
    const classTags=(h.classifications||[h.classification]).filter(Boolean).map(v=>'<span class="radar-tag">'+esc(v)+'</span>').join("");
    return `<article class="radar-hit">
      <div class="radar-hit-meta">
        <span class="radar-hit-source">${esc(h.source)}</span>
        <span>Publicado: ${fmtDate(h.published_at)}</span>
        <span>Detectado: ${fmtDateTime(h.first_seen_at)}</span>
        <span>${esc(h.section || "")}</span>
      </div>
      <div class="radar-hit-main"><h3>${esc(h.title)}</h3><p>${esc(snippet || "Ocorrência registrada pelo monitor oficial.")}</p><div class="radar-hit-tags">${radarTags}${classTags}${timingTags}</div><small>${esc(h.agency || "Órgão não identificado automaticamente")}</small></div>
      <a class="radar-hit-link" href="${esc(h.url)}" target="_blank" rel="noreferrer">Abrir oficial ↗</a>
    </article>`;
  }).join("") : '<div class="radar-empty">Nenhuma ocorrência pública nesse filtro. O radar continua monitorando qualquer menção à SEDES/DF e os atos de concurso/pré-edital de SEEDF e TJDFT.</div>';
}
$("#refreshRadar")?.addEventListener("click",loadDashboard);
$$("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
  activeFilter=btn.dataset.filter;
  $$("[data-filter]").forEach(b=>b.classList.toggle("active",b===btn));
  renderHits();
}));
loadDashboard();
