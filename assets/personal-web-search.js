const WEB_RADAR_ENDPOINT="https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/personal-web-search";
const WEB_RADAR_SESSION_KEY="plano.webRadar.session.v2";
let webRadarSession=sessionStorage.getItem(WEB_RADAR_SESSION_KEY)||"";
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
const identifierKindLabel=(v)=>({
  name:"Nome",alias:"Variação do nome",cpf:"CPF",rg:"RG",cnpj:"CNPJ",email:"E-mail",phone:"Telefone",other:"Outro"
}[v]||"Identificador");

function clearWebRadarSession(){
  webRadarSession="";
  sessionStorage.removeItem(WEB_RADAR_SESSION_KEY);
}
async function webRadarApi(action,payload={}){
  const body=action==="unlock"
    ? {action,code:String(payload.code||"")}
    : {action,session:webRadarSession,...payload};
  const res=await fetch(WEB_RADAR_ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
    cache:"no-store"
  });
  const data=await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
  if(!res.ok||!data.ok){
    if(res.status===401&&action!=="unlock")clearWebRadarSession();
    throw Object.assign(new Error(data.error||("HTTP "+res.status)),{status:res.status,data});
  }
  return data;
}
function setLocked(locked){
  const a=w$("#webRadarLocked"),b=w$("#webRadarPrivate"),chip=w$("#webRadarStatusChip");
  if(a){a.hidden=!locked;a.style.display=locked?"":"none";}
  if(b){b.hidden=locked;b.style.display=locked?"none":"";}
  if(chip){chip.textContent=locked?"bloqueado":"privado · ativo";chip.classList.toggle("ok",!locked);}
  if(locked){
    webRadarData={counts:{},results:[],lastRun:null,identifiers:[],officialHits:[]};
  }
}
function renderIdentifiers(){
  const root=w$("#webRadarIdentifiers");
  if(!root)return;
  const ids=webRadarData.identifiers||[];
  root.innerHTML=ids.length?ids.map(i=>`<article class="web-radar-identifier" data-identifier="${wEsc(i.id)}">
    <div>
      <span>${wEsc(identifierKindLabel(i.kind))}</span>
      <strong>${wEsc(i.label||identifierKindLabel(i.kind))}</strong>
      <code>${wEsc(i.masked_value||"••••")}</code>
    </div>
    <div class="web-radar-identifier-scopes">
      <label><input type="checkbox" data-id-scope="web" ${i.search_web?"checked":""}> Web</label>
      <label><input type="checkbox" data-id-scope="official" ${i.search_official?"checked":""}> DOU/DODF</label>
      <button type="button" data-id-delete title="Remover identificador">Remover</button>
    </div>
  </article>`).join(""):'<div class="radar-empty">Nenhum identificador cadastrado.</div>';
}
function renderOfficialHits(){
  const root=w$("#webRadarOfficialResults"),count=w$("#webRadarOfficialCount");
  if(!root)return;
  const hits=webRadarData.officialHits||[];
  if(count)count.textContent=`${hits.length} ocorrência(s)`;
  root.innerHTML=hits.length?hits.map(h=>`<article class="web-radar-result">
    <div class="web-radar-result-top">
      <div>
        <span class="web-radar-domain">${wEsc(h.source)} · ${wEsc(h.matched_identifier?.label||"Identificador privado")}</span>
        <h3>${wEsc(h.title||"Publicação oficial")}</h3>
      </div>
      <a class="radar-hit-link" href="${wEsc(h.url)}" target="_blank" rel="noreferrer">Abrir oficial ↗</a>
    </div>
    <p>${wEsc(String(h.snippet||"").replace(/\s+/g," ").trim()||"Ocorrência encontrada em fonte oficial.")}</p>
    <div class="web-radar-result-meta">
      <span class="radar-tag">${wEsc(h.classification||"Administrativo")}</span>
      <span class="radar-tag">${wEsc(identifierKindLabel(h.matched_identifier?.kind))}</span>
      <span class="radar-tag">${wEsc(h.matched_identifier?.masked_value||"protegido")}</span>
      ${h.published_at?'<span class="radar-tag">publicado '+wEsc(wFmtDate(h.published_at))+'</span>':""}
    </div>
  </article>`).join(""):'<div class="radar-empty">Nenhuma ocorrência pessoal encontrada no DOU/DODF até agora.</div>';
}
function renderWebRadar(){
  const counts=webRadarData.counts||{};
  w$("#webRadarTotal").textContent=counts.total??0;
  w$("#webRadarCandidates").textContent=counts.candidate??0;
  w$("#webRadarConfirmed").textContent=counts.confirmed??0;
  w$("#webRadarHomonyms").textContent=counts.possible_homonym??0;
  const run=webRadarData.lastRun;
  const provider=run?.provider==="duckduckgo-html"?"DuckDuckGo":run?.provider||"";
  w$("#webRadarLastRun").textContent=run
    ? `Última pesquisa: ${wFmtDateTime(run.finished_at||run.started_at)} · ${run.verified_matches||0} correspondência(s) validada(s) · ${run.new_results||0} nova(s)${provider?` · ${provider}`:""}`
    : "Nenhuma pesquisa anterior registrada.";

  const runStart=run?.started_at?new Date(run.started_at).getTime():0;
  const isNew=(r)=>runStart>0&&new Date(r.first_seen_at||0).getTime()>=runStart;
  const rows=(webRadarData.results||[]).filter(r=>
    webRadarFilter==="all"
      ? true
      : webRadarFilter==="new"
        ? isNew(r)
        : r.review_status===webRadarFilter
  );
  w$("#webRadarResults").innerHTML=rows.length?rows.map(r=>{
    const strength=Math.max(0,Math.min(100,Number(r.confidence||0)));
    const ctx=String(r.context||"").replace(/\s+/g," ").trim();
    const reviewed=r.review_status!=="candidate";
    const fresh=isNew(r);
    return `<article class="web-radar-result${fresh?" is-new":""}" data-web-result="${wEsc(r.id)}">
      <div class="web-radar-result-top">
        <div>
          <span class="web-radar-domain">${wEsc(r.domain)}</span>
          <h3>${wEsc(r.title)}</h3>
        </div>
        <a class="radar-hit-link" href="${wEsc(r.url)}" target="_blank" rel="noreferrer">Abrir resultado ↗</a>
      </div>
      <p>${wEsc(ctx||"Nome localizado no índice; abra a fonte para conferir o contexto completo.")}</p>
      <div class="web-radar-result-meta">
        ${fresh?'<span class="radar-tag web-radar-new">novo</span>':""}
        ${r.matched_identifier?'<span class="radar-tag">via '+wEsc(r.matched_identifier.label||identifierKindLabel(r.matched_identifier.kind))+' · '+wEsc(r.matched_identifier.masked_value||"protegido")+'</span>':""}
        <span class="radar-tag">${wEsc(kindLabel(r.kind))}</span>
        <span class="radar-tag">${wEsc(statusLabel(r.review_status))}</span>
        <span class="radar-tag" title="Mede apenas a força da correspondência textual do nome; não confirma identidade.">força da correspondência ${strength}%</span>
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
  renderIdentifiers();
  renderOfficialHits();
}
async function unlockWebRadar(code){
  const normalized=String(code||"").trim().toUpperCase();
  if(!normalized)throw new Error("Digite o código de acesso.");
  const data=await webRadarApi("unlock",{code:normalized});
  webRadarSession=String(data.session||"");
  if(!webRadarSession)throw new Error("Sessão privada não foi criada.");
  sessionStorage.setItem(WEB_RADAR_SESSION_KEY,webRadarSession);
  delete data.session;
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
    clearWebRadarSession();
    setLocked(true);
    if(err)err.textContent=error.message||"Não foi possível desbloquear.";
  }
});
w$("#webRadarLockBtn")?.addEventListener("click",async()=>{
  try{if(webRadarSession)await webRadarApi("lock");}catch{}
  clearWebRadarSession();
  webRadarData={counts:{},results:[],lastRun:null};
  setLocked(true);
});
w$("#webRadarSearchBtn")?.addEventListener("click",async()=>{
  const btn=w$("#webRadarSearchBtn"),feedback=w$("#webRadarSearchFeedback");
  btn.disabled=true;btn.textContent="Pesquisando…";
  if(feedback)feedback.textContent="Consultando a web e validando a correspondência exata do nome nas fontes.";
  try{
    const data=await webRadarApi("search");
    webRadarData=data;renderWebRadar();
    if(feedback)feedback.textContent=`Pesquisa concluída: ${data.search?.verified||0} correspondência(s), ${data.search?.newResults||0} nova(s).`;
  }catch(error){
    if(error.status===401)setLocked(true);
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
    if(error.status===401)setLocked(true);
    const feedback=w$("#webRadarSearchFeedback");
    if(feedback)feedback.textContent=error.message||"Não foi possível revisar.";
    button.disabled=false;
  }
});
w$("#webRadarIdentifierForm")?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const feedback=w$("#webRadarIdentifierFeedback");
  if(feedback)feedback.textContent="";
  const payload={
    kind:w$("#webRadarIdentifierKind")?.value||"other",
    label:w$("#webRadarIdentifierLabel")?.value||"",
    value:w$("#webRadarIdentifierValue")?.value||"",
    searchWeb:Boolean(w$("#webRadarIdentifierWeb")?.checked),
    searchOfficial:Boolean(w$("#webRadarIdentifierOfficial")?.checked)
  };
  try{
    webRadarData=await webRadarApi("add_identifier",payload);
    if(w$("#webRadarIdentifierValue"))w$("#webRadarIdentifierValue").value="";
    if(w$("#webRadarIdentifierLabel"))w$("#webRadarIdentifierLabel").value="";
    renderWebRadar();
    if(feedback)feedback.textContent="Identificador protegido adicionado.";
  }catch(error){
    if(feedback)feedback.textContent=error.message||"Não foi possível adicionar.";
  }
});
w$("#webRadarIdentifiers")?.addEventListener("change",async(e)=>{
  const input=e.target.closest("[data-id-scope]");
  if(!input)return;
  const card=input.closest("[data-identifier]"),id=card?.dataset.identifier;
  if(!id)return;
  const web=Boolean(card.querySelector('[data-id-scope="web"]')?.checked);
  const official=Boolean(card.querySelector('[data-id-scope="official"]')?.checked);
  try{
    webRadarData=await webRadarApi("set_identifier_scope",{id,searchWeb:web,searchOfficial:official,active:true});
    renderWebRadar();
  }catch(error){
    const feedback=w$("#webRadarIdentifierFeedback");if(feedback)feedback.textContent=error.message||"Não foi possível atualizar.";
  }
});
w$("#webRadarIdentifiers")?.addEventListener("click",async(e)=>{
  const btn=e.target.closest("[data-id-delete]");
  if(!btn)return;
  const card=btn.closest("[data-identifier]"),id=card?.dataset.identifier;
  if(!id||!confirm("Remover este identificador protegido e o segredo criptografado correspondente?"))return;
  try{
    webRadarData=await webRadarApi("delete_identifier",{id});
    renderWebRadar();
  }catch(error){
    const feedback=w$("#webRadarIdentifierFeedback");if(feedback)feedback.textContent=error.message||"Não foi possível remover.";
  }
});
w$("#webRadarRotateCodeBtn")?.addEventListener("click",async()=>{
  const feedback=w$("#webRadarCodeFeedback"),result=w$("#webRadarNewCodeResult"),out=w$("#webRadarGeneratedCode");
  if(feedback)feedback.textContent="";
  try{
    const data=await webRadarApi("rotate_code",{newCode:w$("#webRadarNewCode")?.value||""});
    if(out)out.textContent=data.newCode||"";
    if(result)result.hidden=false;
    if(w$("#webRadarNewCode"))w$("#webRadarNewCode").value="";
    if(feedback)feedback.textContent="Código alterado. A sessão atual continua ativa.";
  }catch(error){
    if(feedback)feedback.textContent=error.message||"Não foi possível trocar o código.";
  }
});
w$("#webRadarCopyCodeBtn")?.addEventListener("click",async()=>{
  const code=w$("#webRadarGeneratedCode")?.textContent||"";
  if(!code)return;
  try{await navigator.clipboard.writeText(code);w$("#webRadarCodeFeedback").textContent="Código copiado.";}
  catch{w$("#webRadarCodeFeedback").textContent="Copie o código manualmente.";}
});

setLocked(true);
if(webRadarSession){
  refreshWebRadar().then(()=>setLocked(false)).catch(()=>{
    clearWebRadarSession();
    setLocked(true);
  });
}
