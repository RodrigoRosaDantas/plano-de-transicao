const SEDES_QUADRIX={
  publicUrl:"https://quadrix.org.br/informacoes/3056/",
  sb:"https://fqqkkyusnzhuuizahkww.supabase.co",
  key:"sb_publishable_GfoaAPKtYuSu_UY6wE8jMg_XsVjdWU7",
  privateEdge:"https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/personal-web-search",
  sessionKey:"plano.webRadar.session.v2",
  seenKey:"plano.sedesQuadrix.seen.v1"
};
let sedesQuadrixState=null;
let sedesExamSnapshot=null;
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
async function qLoadExamSnapshot(){
  try{
    const r=await fetch("data/snapshot.json?privatePostExam="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("snapshot");
    const data=await r.json();
    const exams=Array.isArray(data?.exams)?data.exams:[];
    sedesExamSnapshot={
      generatedAt:data?.meta?.generatedAt||null,
      exams:{
        "202":exams.find(x=>x?.id==="sedes-2026-tdas")||null,
        "400":exams.find(x=>x?.id==="sedes-2026-edas")||null
      }
    };
  }catch{sedesExamSnapshot={generatedAt:null,exams:{"202":null,"400":null}}}
  return sedesExamSnapshot;
}
async function qLoadPrivate(root){
  const box=root.querySelector("[data-q44-private-body]"); if(!box)return;
  const token=sessionStorage.getItem(SEDES_QUADRIX.sessionKey)||"";
  if(!token){qRenderUnlock(box);return}
  try{
    const [r,examData]=await Promise.all([
      fetch(SEDES_QUADRIX.privateEdge,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sedes_status",session:token})}),
      qLoadExamSnapshot()
    ]);
    if(!r.ok)throw new Error("locked");
    const d=await r.json(); qRenderPrivate(box,d,examData);
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
      sessionStorage.setItem(SEDES_QUADRIX.sessionKey,d.session);input.value="";
      const examData=await qLoadExamSnapshot();
      qRenderPrivate(box,d,examData);
    }catch(err){btn.disabled=false;btn.textContent="Tentar novamente";const old=e.currentTarget.querySelector(".q44-error");if(old)old.remove();e.currentTarget.insertAdjacentHTML("beforeend",`<strong class="q44-error">${qEsc(err.message||"Não foi possível desbloquear.")}</strong>`)}
  });
}
function qRenderPrivate(box,d,examData=sedesExamSnapshot){
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
  const next=qNextDate(sedesQuadrixState?.importantDates||[]);
  const exams=examData?.exams||{};
  const pubList=Array.isArray(sedesQuadrixState?.publications)?sedesQuadrixState.publications:[];
  const prelimKey=pubList.find(p=>/gabarito preliminar/i.test(p.title||""));
  const defEnrollment=hits.filter(h=>/resultado definitivo.*inscri/i.test(h.publication?.title||""));
  const prelimEnrollment=hits.filter(h=>/resultado preliminar.*inscri/i.test(h.publication?.title||""));

  const scoreLine=exam=>{
    const p=exam?.scoreTracking?.preliminary;
    if(!p)return "Sem correção preliminar carregada";
    return `${Number(p.correct||0)} acertos · ${Number(p.wrong||0)} erros${Number(p.invalid||0)?" · "+Number(p.invalid)+" inválida":""}`;
  };
  const statusFor=exam=>exam?.scoreTracking?.definitive?"Resultado definitivo incorporado":"Resultado oficial pendente";
  const roleLabel=code=>code==="202"?"TDAS · Técnico Administrativo":"EDAS · Administração";
  const roleCard=code=>{
    const exam=exams[code]||null;
    const p=exam?.scoreTracking?.preliminary||null;
    const reg=regs.find(x=>String(x.label||"").includes(code));
    const related=hits.filter(x=>String(x.cargo_code||"")===code);
    const definitive=related.find(h=>/resultado definitivo.*inscri/i.test(h.publication?.title||""));
    return `<article class="q44-role-card" data-q44-role="${code}">
      <header><div><span>CARGO ${code}</span><h4>${roleLabel(code)}</h4></div><b class="q44-role-status">${statusFor(exam)}</b></header>
      <div class="q44-role-primary">
        <div><small>Inscrição</small><strong>${reg?qEsc(reg.masked_value):"não identificada"}</strong><em>${definitive?"homologada definitivamente em "+qDate(definitive.publication?.published_at):"aguardando confirmação definitiva"}</em></div>
        <div><small>Nota preliminar</small><strong>${p?Number(p.total)+"/100":"—"}</strong><em>${p?qEsc(p.status||"estimativa preliminar"):"sem estimativa"}</em></div>
      </div>
      <dl class="q44-role-facts">
        <div><dt>Prova</dt><dd>${exam?qDate(exam.date)+" · "+qEsc(exam.session||"—")+" · Tipo "+qEsc(exam.examType||p?.examType||"—"):"—"}</dd></div>
        <div><dt>Questões</dt><dd>${p?scoreLine(exam):"—"}</dd></div>
        <div><dt>Conhecimentos Gerais</dt><dd>${p?Number(p.general||0)+"/20 pontos":"—"}</dd></div>
        <div><dt>Conhecimentos Específicos</dt><dd>${p?Number(p.specific||0)+"/80 pontos":"—"}</dd></div>
        <div><dt>Resultado oficial</dt><dd>${exam?.scoreTracking?.definitive?"incorporado":"aguardando publicação"}</dd></div>
        <div><dt>Classificação</dt><dd>${exam?.ranking&&exam.ranking!=="—"?qEsc(exam.ranking):"aguardando resultado oficial"}</dd></div>
      </dl>
      <footer><span>${related.length} publicação(ões) pessoal(is) vinculada(s)</span><span>última evidência: ${related[0]?qDate(related[0].publication?.published_at):"—"}</span></footer>
    </article>`;
  };

  const timeline=[
    ...prelimEnrollment.slice(0,1).map(h=>({date:h.publication?.published_at,title:"Inscrição preliminar localizada",detail:"Seu registro apareceu na relação preliminar de inscrições homologadas."})),
    ...defEnrollment.slice(0,1).map(h=>({date:h.publication?.published_at,title:"Inscrição homologada definitivamente",detail:"As duas inscrições foram confirmadas pelo monitor privado."})),
    {date:"2026-09-06",title:"Provas realizadas",detail:"EDAS 400 pela manhã e TDAS 202 à tarde."},
    ...(prelimKey?[{date:prelimKey.publishedAt,title:"Gabarito preliminar publicado",detail:"As respostas anotadas foram cruzadas e geraram as estimativas atuais."}]:[]),
    ...(next?[{date:next.date,title:"Próximo marco oficial",detail:next.label,future:true}]:[])
  ].filter(x=>x.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const missing=[
    {label:"Gabarito definitivo",state:"aguardando"},
    {label:"Resultado oficial da prova objetiva",state:next?("próximo marco · "+qDate(next.date)):"aguardando"},
    {label:"Classificação por cargo",state:"aguardando resultado oficial"},
    {label:"Situação da discursiva / próxima etapa",state:"aguardando publicação da banca"}
  ];

  const uniqueDocs=[...new Map(hits.map(h=>[(h.cargo_code||"na")+"|"+(h.publication?.url||h.id),h])).values()]
    .sort((a,b)=>String(b.publication?.published_at||"").localeCompare(String(a.publication?.published_at||"")));

  box.innerHTML=`<section class="q44-private-summary">
      <div><span class="eyebrow">MINHA SITUAÇÃO AGORA</span><h4>2 inscrições localizadas · 2 provas realizadas · resultado oficial pendente</h4>
      <p>O painel combina seus registros privados encontrados pela Quadrix com a correção pós-prova já auditada no Plano.</p></div>
      <div class="q44-private-summary-kpis">
        <span><b>2/2</b><small>inscrições identificadas</small></span>
        <span><b>${Object.values(exams).filter(Boolean).length}/2</b><small>provas carregadas</small></span>
        <span><b>${Object.values(exams).filter(x=>x?.scoreTracking?.preliminary).length}/2</b><small>correções preliminares</small></span>
      </div>
    </section>
    <div class="q44-role-grid">${roleCard("202")}${roleCard("400")}</div>

    <section class="q44-private-block">
      <div class="q44-subhead"><strong>Linha do tempo pessoal</strong><small>do deferimento ao próximo resultado</small></div>
      <div class="q44-personal-timeline">${timeline.map(x=>`<article class="${x.future?"future":""}"><time>${qDate(x.date)}</time><div><strong>${qEsc(x.title)}</strong><small>${qEsc(x.detail)}</small></div></article>`).join("")}</div>
    </section>

    <section class="q44-private-block">
      <div class="q44-subhead"><strong>O que ainda falta sair</strong><small>campos que o monitor vai preencher automaticamente</small></div>
      <div class="q44-pending-grid">${missing.map(x=>`<article><span>○</span><div><strong>${qEsc(x.label)}</strong><small>${qEsc(x.state)}</small></div></article>`).join("")}</div>
    </section>

    <section class="q44-private-block">
      <div class="q44-subhead"><strong>Documentos em que você apareceu</strong><small>${uniqueDocs.length} ocorrência(s) consolidada(s)</small></div>
      <div class="q44-personal-events">
      ${uniqueDocs.length?uniqueDocs.map(h=>`<article><div><span>${h.cargo_code?"Cargo "+qEsc(h.cargo_code):"SEDES/DF"}</span><strong>${qEsc(h.publication?.title||"Publicação Quadrix")}</strong><small>${qDate(h.publication?.published_at)} · ${qEsc((h.evidence_labels||[]).join(" + ")||"identificador protegido")}${h.registration_masked&&h.cargo_code&&Number(h.confidence||0)>=98?" · inscrição "+qEsc(h.registration_masked):""}</small></div>
        <a href="${qEsc(h.publication?.url||SEDES_QUADRIX.publicUrl)}" target="_blank" rel="noreferrer">Fonte ↗</a></article>`).join(""):'<div class="q44-empty">Nenhuma ocorrência pessoal consolidada até agora.</div>'}</div>
    </section>

    <div class="q44-private-meta"><span>Dados pessoais: Vault + Quadrix</span><span>Correção pós-prova: snapshot ${qDateTime(examData?.generatedAt)}</span></div>
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
function qPostExamHost(){
  return document.querySelector(".post-exam-view [data-post-exam-page]")
    || document.querySelector("[data-post-exam-v27]");
}
function qEnsure(){
  const root=qPostExamHost();if(!root)return;
  let section=root.querySelector("[data-q44-wrap]");
  const stale=document.querySelector("[data-q44-wrap]");
  if(stale&&!root.contains(stale)){stale.remove();section=null}
  if(section)return;
  section=document.createElement("div");section.dataset.q44Wrap="1";section.className="q44-wrap";
  if(root.matches("[data-post-exam-page]")){
    root.prepend(section);
  }else{
    const notes=root.querySelector("#v27Notes")||root.querySelector(".v27-notes");
    if(notes)notes.before(section);else root.append(section);
  }
  qRenderSection(section);
}
new MutationObserver(()=>{
  const root=qPostExamHost(),section=document.querySelector("[data-q44-wrap]");
  if(root&&(!section||!root.contains(section)))qEnsure();
}).observe(document.documentElement,{childList:true,subtree:true});
qLoadPublic();
setInterval(qLoadPublic,5*60*1000);
