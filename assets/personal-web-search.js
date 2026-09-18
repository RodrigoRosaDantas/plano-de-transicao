const WEB_RADAR_ENDPOINT="https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/personal-web-search";
const WEB_RADAR_SESSION_KEY="plano.webRadar.access.v1";
let webRadarCode=sessionStorage.getItem(WEB_RADAR_SESSION_KEY)||"";
let webRadarData={counts:{},results:[],lastRun:null};
let webRadarFilter="all";

const w$=(q)=>document.querySelector(q);
const w$$=(q)=>[...document.querySelectorAll(q)];
const wEsc=(v)=>String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const wFmtDate=(v)=>{
  if(!v)return "—";
  const d=new Date(String(v).length===10?v+"T12:00:00-03:00":v);
  return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Sao_Paulo"}).format(d).replace(".","");
};
const wFmtDateTime=(v)=>{
  if(!v)return "—";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(d).replace(","," ·");
};
const statusLabel=(v)=>({
  candidate:"A revisar",
  confirmed:"É meu",
  possible_homonym:"Possível homônimo",
  not_mine:"Não sou eu"
}[v]||v||"A revisar");
const kindLabel=(v)=>({
  documento:"Documento/PDF",
  noticia:"Notícia",
  perfil:"Perfil",
  site_publico:"Site público",
  outro:"Outro"
}[v]||"Outro");

async function webRadarApi(action,payload={}){
  const res=await fetch(WEB_RADAR_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,code:webRadarCode,...payload}),
    cache:"no-store"
  });
  const data=await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
  if(!res.ok||!data.ok)throw Object.assign(new Error(data.error||("HTTP "+res.status)),{status:res.status,data});
  return data;
}
function setLocked(locked){
  const a=w$("#webRadarLocked"),b=w$("#webRadarPrivate"),chip=w$("#webRadarStatusChip");
  if(a)a.hidden=!locked;
  if(b)b.hidden=locked;
  if(chip){chip.textContent=locked?"bloqueado":"privado · ativo";chip.classList.toggle("ok",!locked);}
}
function renderWebRadar(){
  const counts=webRadarData.counts||{};
  w$("#webRadarTotal").textContent=counts.total??0;
  w$("#webRadarCandidates").textContent=counts.candidate??0;
  w$("#webRadarConfirmed").textContent=counts.confirmed??0;
  w$("#webRadarHomonyms").textContent=counts.possible_homonym??0;
  const run=webRadarData.lastRun;
  w$("#webRadarLastRun").textContent=run
    ? `Última pesquisa: ${wFmtDateTime(run.finished_at||run.started_at)} · ${run.verified_matches||0} correspondência(s) validada(s) · ${run.new_results||0} nova(s)`
    : "Nenhuma pesquisa anterior registrada.";

  const rows=(webRadarData.results||[]).filter(r=>webRadarFilter==="all"||r.review_status===webRadarFilter);
  w$("#webRadarResults").innerHTML=rows.length?rows.map(r=>{
    const conf=Number(r.confidence||0);
    const ctx=String(r.context||"").replace(/\s+/g," ").trim();
    const reviewed=r.review_status!=="candidate";
    return `<article class="web-radar-result" data-web-result="${wEsc(r.id)}">
      <div class="web-radar-result-top">
        <div>
          <span class="web-radar-domain">${wEsc(r.domain)}</span>
          <h3>${wEsc(r.title)}</h3>
        </div>
        <a class="radar-hit-link" href="${wEsc(r.url)}" target="_blank" rel="noreferrer">Abrir resultado ↗</a>
      </div>
      <p>${wEsc(ctx||"Nome exato localizado no índice; abra a fonte para conferir o contexto completo.")}</p>
      <div class="web-radar-result-meta">
        <span class="radar-tag">${wEsc(kindLabel(r.kind))}</span>
        <span class="radar-tag">${wEsc(statusLabel(r.review_status))}</span>
        <span class="radar-tag">confiança técnica ${conf}%</span>
        <span class="radar-tag">detectado ${wFmtDateTime(r.first_seen_at)}</span>
        ${r.published_at?'<span class="radar-tag">data do índice '+wEsc(wFmtDate(r.published_at))+'</span>':""}
      </div>
      <div class="web-radar-review" aria-label="Revisar resultado">
        <button type="button" data-web-review="confirmed" ${r.review_status==="confirmed"?"disabled":""}>✓ É meu</button>
        <button type="button" data-web-review="possible_homonym" ${r.review_status==="possible_homonym"?"disabled":""}>≈ Homônimo</button>
        <button type="button" data-web-review="not_mine" ${r.review_status==="not_mine"?"disabled":""}>× Não sou eu</button>
        ${reviewed?'<button type="button" data-web-review="candidate">↺ Rever</button>':""}
      </div>
    </article>`;
  }).join(""):'<div class="radar-empty">Nenhum resultado nesse filtro.</div>';
}
async function unlockWebRadar(code){
  webRadarCode=String(code||"").trim().toUpperCase();
  if(!webRadarCode)throw new Error("Digite o código de acesso.");
  const data=await webRadarApi("status");
  sessionStorage.setItem(WEB_RADAR_SESSION_KEY,webRadarCode);
  webRadarData=data;
  setLocked(false);
  renderWebRadar();
}
async function refreshWebRadar(){
  const data=await webRadarApi("status");
  webRadarData=data;renderWebRadar();
}
w$("#webRadarUnlockForm")?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const err=w$("#webRadarUnlockError");
  if(err)err.textContent="";
  try{
    await unlockWebRadar(w$("#webRadarCode")?.value);
    if(w$("#webRadarCode"))w$("#webRadarCode").value="";
  }catch(error){
    webRadarCode="";
    sessionStorage.removeItem(WEB_RADAR_SESSION_KEY);
    setLocked(true);
    if(err)err.textContent=error.message||"Não foi possível desbloquear.";
  }
});
w$("#webRadarLockBtn")?.addEventListener("click",()=>{
  webRadarCode="";sessionStorage.removeItem(WEB_RADAR_SESSION_KEY);webRadarData={counts:{},results:[],lastRun:null};setLocked(true);
});
w$("#webRadarSearchBtn")?.addEventListener("click",async()=>{
  const btn=w$("#webRadarSearchBtn"),feedback=w$("#webRadarSearchFeedback");
  btn.disabled=true;btn.textContent="Pesquisando…";if(feedback)feedback.textContent="Consultando a web e validando o nome exato nas fontes.";
  try{
    const data=await webRadarApi("search");
    webRadarData=data;renderWebRadar();
    if(feedback)feedback.textContent=`Pesquisa concluída: ${data.search?.verified||0} correspondência(s), ${data.search?.newResults||0} nova(s).`;
  }catch(error){
    if(feedback)feedback.textContent=error.message||"Falha na pesquisa.";
  }finally{btn.disabled=false;btn.textContent="⌕ Pesquisar agora";}
});
w$$("[data-web-filter]").forEach(btn=>btn.addEventListener("click",()=>{
  webRadarFilter=btn.dataset.webFilter||"all";
  w$$("[data-web-filter]").forEach(b=>b.classList.toggle("active",b===btn));
  renderWebRadar();
}));
w$("#webRadarResults")?.addEventListener("click",async(e)=>{
  const button=e.target.closest("[data-web-review]");
  if(!button)return;
  const card=button.closest("[data-web-result]");
  const id=card?.dataset.webResult,status=button.dataset.webReview;
  if(!id||!status)return;
  button.disabled=true;
  try{
    webRadarData=await webRadarApi("review",{id,status});
    renderWebRadar();
  }catch(error){
    const feedback=w$("#webRadarSearchFeedback");if(feedback)feedback.textContent=error.message||"Não foi possível revisar.";
    button.disabled=false;
  }
});
setLocked(true);
if(webRadarCode){
  unlockWebRadar(webRadarCode).catch(()=>{
    webRadarCode="";sessionStorage.removeItem(WEB_RADAR_SESSION_KEY);setLocked(true);
  });
}
