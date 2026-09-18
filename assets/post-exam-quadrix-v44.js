const SEDES_QUADRIX={
  publicUrl:"https://quadrix.org.br/informacoes/3056/",
  sb:"https://fqqkkyusnzhuuizahkww.supabase.co",
  key:"sb_publishable_GfoaAPKtYuSu_UY6wE8jMg_XsVjdWU7",
  privateEdge:"https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/personal-web-search",
  sessionKey:"plano.webRadar.session.v2",
  seenKey:"plano.sedesQuadrix.seen.v1"
};
let sedesQuadrixState=null;
const qEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const qDate=v=>{
  if(!v)return"—"; const d=new Date(String(v).length===10?v+"T12:00:00-03:00":v);
  return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",timeZone:"America/Sao_Paulo"}).format(d).replace(".","");
};
const qDateTime=v=>{
  if(!v)return"aguardando primeira varredura"; const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(d).replace(","," ·");
};
const qNextDate=dates=>{
  const now=Date.now();
  return [...(dates||[])].filter(x=>Date.parse(x.date+"T23:59:59-03:00")>=now).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0]||null;
};
async function qLoadPublic(){
  try{
    const r=await fetch(SEDES_QUADRIX.sb+"/rest/v1/sedes_quadrix_public_state?id=eq.1&select=payload",{
      headers:{apikey:SEDES_QUADRIX.key,Authorization:"Bearer "+SEDES_QUADRIX.key},cache:"no-store"
    });
    if(!r.ok)throw new Error("HTTP "+r.status);
    const rows=await r.json(); sedesQuadrixState=rows?.[0]?.payload||null;
  }catch{sedesQuadrixState=null}
  qEnsure();
  const section=document.querySelector("[data-q44-wrap]");
  if(section)qRenderSection(section);
}
function qSectionIntro(){
  return `<header class="q44-section-intro">
    <div>
      <span class="eyebrow">PÓS-PROVA · SEDES/DF</span>
      <h2>Acompanhamento do concurso</h2>
      <p>Quadrix, cronograma, publicações da banca e sua situação nos cargos 202 e 400 ficam reunidos aqui, separados do Radar Oficial.</p>
    </div>
    <div class="q44-section-badges" aria-label="Escopo do pós-prova SEDES">
      <span>Quadrix</span><span>Cargo 202</span><span>Cargo 400</span>
    </div>
  </header>`;
}
function qPublicMarkup(){
  const d=sedesQuadrixState||{},run=d.lastRun||{},next=qNextDate(d.importantDates);
  const pubs=d.publications||[],previous=localStorage.getItem(SEDES_QUADRIX.seenKey);
  const newCount=previous?pubs.filter(p=>Date.parse(p.firstSeenAt||0)>Date.parse(previous)).length:Number(run.newPublications||0);
  const latest=pubs.slice(0,7);
  return `<section class="q44-panel panel" data-q44-public>
    <div class="q44-head">
      <div><span class="eyebrow">BANCA · QUADRIX</span><h3>Cronograma e publicações do concurso.</h3>
      <p>A página do concurso é acompanhada automaticamente para detectar novos comunicados, resultados, retificações e mudanças de cronograma.</p></div>
      <span class="q44-status ${d.status==="ok"?"ok":d.status==="partial"?"partial":""}">${qEsc(d.contest?.status||"Aguardando")}</span>
    </div>
    <div class="q44-metrics">
      <article><small>Próximo marco</small><strong>${next?qEsc(next.label):"Aguardando cronograma"}</strong><span>${next?qDate(next.date):"—"}</span></article>
      <article><small>Publicações monitoradas</small><strong>${Number(d.counts?.publications||0)}</strong><span>${newCount?newCount+" nova(s) desde a última visita":"sem novidade local"}</span></article>
      <article><small>Última varredura</small><strong>${qEsc(run.status||"pendente")}</strong><span>${qDateTime(run.finishedAt||run.startedAt)}</span></article>
    </div>
    <div class="q44-actions"><a class="primary-button" href="${SEDES_QUADRIX.publicUrl}" target="_blank" rel="noreferrer">Abrir página do concurso ↗</a>
      <button type="button" class="secondary-button" data-q44-refresh>Recarregar monitor</button></div>
    <div class="q44-publications">
      <div class="q44-subhead"><strong>Últimas publicações</strong><small>Quadrix · concurso 3056</small></div>
      ${latest.length?latest.map(p=>`<a href="${qEsc(p.url)}" target="_blank" rel="noreferrer"><span><b>${qEsc(p.title)}</b><small>${qDate(p.publishedAt)}</small></span><em>↗</em></a>`).join(""):'<div class="q44-empty">A primeira varredura ainda não terminou.</div>'}
    </div>
  </section>`;
}
function qPrivateShell(){
  return `<section class="q44-private panel" data-q44-private>
    <div class="q44-head"><div><span class="eyebrow">MEUS DADOS NO CONCURSO · PRIVADO</span><h3>Inscrições e ocorrências nos cargos 202 e 400.</h3>
      <p>Seus dados pessoais ficam somente neste módulo do Pós-Prova, após desbloqueio, e não entram no Radar Oficial nem no estado público do site.</p></div><span class="q44-lock">🔐</span></div>
    <div data-q44-private-body><div class="q44-private-loading">Verificando sessão privada…</div></div>
  </section>`;
}
async function qLoadPrivate(root){
  const box=root.querySelector("[data-q44-private-body]"); if(!box)return;
  const token=sessionStorage.getItem(SEDES_QUADRIX.sessionKey)||"";
  if(!token){qRenderUnlock(box);return}
  try{
    const r=await fetch(SEDES_QUADRIX.privateEdge,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sedes_status",session:token})});
    if(!r.ok)throw new Error("locked");
    const d=await r.json(); qRenderPrivate(box,d);
  }catch{sessionStorage.removeItem(SEDES_QUADRIX.sessionKey);qRenderUnlock(box)}
}
function qRenderUnlock(box){
  box.innerHTML=`<form class="q44-unlock" data-q44-unlock><label><span>Código privado do Plano</span><input type="password" autocomplete="current-password" minlength="10" maxlength="24" placeholder="••••-••••-••••"></label>
    <button class="primary-button" type="submit">Desbloquear meus dados</button><small>Usa a mesma credencial privada já configurada no Plano de Transição; o código não é salvo no navegador.</small></form>`;
  box.querySelector("[data-q44-unlock]")?.addEventListener("submit",async e=>{
    e.preventDefault();const input=e.currentTarget.querySelector("input"),code=input.value.trim();if(!code)return;
    const btn=e.currentTarget.querySelector("button");btn.disabled=true;btn.textContent="Desbloqueando…";
    try{
      const r=await fetch(SEDES_QUADRIX.privateEdge,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"unlock",code,scope:"sedes"})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Código inválido");
      sessionStorage.setItem(SEDES_QUADRIX.sessionKey,d.session);input.value="";qRenderPrivate(box,d);
    }catch(err){btn.disabled=false;btn.textContent="Tentar novamente";const old=e.currentTarget.querySelector(".q44-error");if(old)old.remove();e.currentTarget.insertAdjacentHTML("beforeend",`<strong class="q44-error">${qEsc(err.message||"Não foi possível desbloquear.")}</strong>`)}
  });
}
function qRenderPrivate(box,d){
  const rawHits=Array.isArray(d.sedesHits)?d.sedesHits:[];
  const grouped=new Map();
  for(const h of rawHits){
    const key=(h.cargo_code||"na")+"|"+(h.publication?.url||h.id);
    if(!grouped.has(key))grouped.set(key,{...h,evidence_labels:[]});
    const g=grouped.get(key);
    const label=h.matched_identifier?.label||"identificador protegido";
    if(label&&!g.evidence_labels.includes(label))g.evidence_labels.push(label);
    if(!g.registration_masked&&h.registration_masked)g.registration_masked=h.registration_masked;
    g.confidence=Math.max(Number(g.confidence||0),Number(h.confidence||0));
  }
  const hits=[...grouped.values()];
  const ids=Array.isArray(d.identifiers)?d.identifiers:[];
  const regs=ids.filter(x=>String(x.label||"").startsWith("Inscrição SEDES"));
  const card=code=>{
    const reg=regs.find(x=>String(x.label||"").includes(code));
    const related=hits.filter(x=>String(x.cargo_code||"")===code);
    const label=code==="202"?"TDAS · Técnico Administrativo":"EDAS · Administração";
    return `<article class="q44-personal-card"><span>Cargo ${code}</span><h4>${label}</h4><div><small>Inscrição</small><strong>${reg?qEsc(reg.masked_value):"ainda não identificada"}</strong></div>
      <div><small>Ocorrências pessoais</small><strong>${related.length}</strong></div></article>`;
  };
  box.innerHTML=`<div class="q44-personal-grid">${card("202")}${card("400")}</div>
    <div class="q44-personal-events"><div class="q44-subhead"><strong>Achados nas publicações</strong><small>${hits.length?hits.length+" ocorrência(s) privada(s)":"nenhum match até agora"}</small></div>
    ${hits.length?hits.slice(0,10).map(h=>`<article><div><span>${h.cargo_code?"Cargo "+qEsc(h.cargo_code):"SEDES/DF"}</span><strong>${qEsc(h.publication?.title||"Publicação Quadrix")}</strong><small>${qDate(h.publication?.published_at)} · via ${qEsc((h.evidence_labels||[]).join(" + ")||h.matched_identifier?.label||"identificador protegido")}${h.registration_masked&&h.cargo_code&&Number(h.confidence||0)>=98?" · inscrição "+qEsc(h.registration_masked):""}</small></div>
      <a href="${qEsc(h.publication?.url||SEDES_QUADRIX.publicUrl)}" target="_blank" rel="noreferrer">Fonte ↗</a></article>`).join(""):'<div class="q44-empty">O monitor já está procurando seu nome, CPF e inscrições nos documentos relevantes.</div>'}</div>
    <div class="q44-private-foot"><span>Sessão temporária ativa.</span><button type="button" data-q44-lock>Bloquear</button></div>`;
  box.querySelector("[data-q44-lock]")?.addEventListener("click",async()=>{
    const token=sessionStorage.getItem(SEDES_QUADRIX.sessionKey)||"";sessionStorage.removeItem(SEDES_QUADRIX.sessionKey);
    if(token)fetch(SEDES_QUADRIX.privateEdge,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"lock",session:token})}).catch(()=>{});
    qRenderUnlock(box);
  });
}
function qRenderSection(section){
  section.innerHTML=qSectionIntro()+qPublicMarkup()+qPrivateShell();
  section.querySelector("[data-q44-refresh]")?.addEventListener("click",qLoadPublic);
  localStorage.setItem(SEDES_QUADRIX.seenKey,new Date().toISOString());
  qLoadPrivate(section);
}
function qEnsure(){
  const root=document.querySelector("[data-post-exam-v27]");if(!root)return;
  let section=root.querySelector("[data-q44-wrap]");
  if(section)return;
  section=document.createElement("div");section.dataset.q44Wrap="1";section.className="q44-wrap";
  const notes=root.querySelector("#v27Notes")||root.querySelector(".v27-notes");
  if(notes)notes.before(section);else root.append(section);
  qRenderSection(section);
}
new MutationObserver(()=>{
  if(!document.querySelector("[data-q44-wrap]"))qEnsure();
}).observe(document.documentElement,{childList:true,subtree:true});
qLoadPublic();
setInterval(qLoadPublic,5*60*1000);
