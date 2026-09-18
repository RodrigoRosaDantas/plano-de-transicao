import { writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execFileAsync=promisify(execFile);
const EDGE="https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/sedes-quadrix-monitor-github";
const AUD="plano-de-transicao-sedes-quadrix";
const startedAt=new Date().toISOString();
const eventName=process.env.GITHUB_EVENT_NAME||"unknown";
const runId=process.env.GITHUB_RUN_ID||null;

const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const digits=v=>String(v||"").replace(/\D/g,"");
const sha=v=>createHash("sha256").update(v).digest("hex");
const decodeHtml=v=>String(v||"")
  .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
const stripHtml=v=>decodeHtml(String(v||"")
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," "))
  .replace(/\s+/g," ").trim();
const isoFromText=text=>{
  const m=String(text||"").match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:null;
};
const classify=title=>{
  const n=normalize(title);
  if(n.includes("cronograma"))return"cronograma";
  if(n.includes("retificacao"))return"retificacao";
  if(n.includes("gabarito"))return"gabarito";
  if(n.includes("justificativa"))return"justificativa";
  if(n.includes("provas aplicadas"))return"prova";
  if(n.includes("inscricoes homologadas"))return"inscricoes";
  if(n.includes("resultado"))return"resultado";
  if(n.includes("comunicado"))return"comunicado";
  if(n.includes("edital"))return"edital";
  return"publicacao";
};
const allowedPublicationUrl=v=>{
  try{
    const u=new URL(v);
    return u.protocol==="https:"&&["anexos-r2.selecao.net.br","anexos.cdn.selecao.net.br","drive.google.com"].includes(u.hostname.toLowerCase());
  }catch{return false}
};
const priorityForPersonal=title=>{
  const n=normalize(title);
  return /inscricoes homologadas|resultado.*(objetiva|discursiva|classifica)|classifica|convoca|homologa/.test(n);
};
async function oidcToken(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!u||!t)throw new Error("GitHub OIDC indisponível");
  const r=await fetch(u+(u.includes("?")?"&":"?")+"audience="+encodeURIComponent(AUD),{headers:{Authorization:"Bearer "+t}});
  if(!r.ok)throw new Error("OIDC HTTP "+r.status);
  const j=await r.json(); if(!j.value)throw new Error("OIDC token ausente"); return j.value;
}
async function fetchText(url,ms=25000){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
  try{
    const r=await fetch(url,{signal:ctrl.signal,redirect:"follow",headers:{
      "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept-Language":"pt-BR,pt;q=0.9"
    }});
    if(!r.ok)throw new Error("HTTP "+r.status+" em "+new URL(url).hostname);
    return await r.text();
  }finally{clearTimeout(timer)}
}
async function fetchBytes(url,ms=60000){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
  try{
    const r=await fetch(url,{signal:ctrl.signal,redirect:"follow",headers:{
      "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept":"application/pdf,text/html;q=0.9,*/*;q=0.8","Accept-Language":"pt-BR,pt;q=0.9"
    }});
    if(!r.ok)throw new Error("HTTP "+r.status+" ao baixar publicação");
    return {bytes:new Uint8Array(await r.arrayBuffer()),contentType:r.headers.get("content-type")||""};
  }finally{clearTimeout(timer)}
}
async function pdfToText(bytes,key){
  const path="/tmp/sedes-quadrix-"+key.slice(0,16)+".pdf";
  await writeFile(path,bytes);
  try{
    const {stdout}=await execFileAsync("pdftotext",["-layout",path,"-"],{maxBuffer:80*1024*1024,timeout:120000});
    return String(stdout||"");
  }finally{await unlink(path).catch(()=>{})}
}
function parsePage(html,contestUrl){
  const text=stripHtml(html);
  const statusMatch=text.match(/Situa(?:ç|c)[aã]o:\s*(.*?)\s*Guia de datas importantes/i);
  const statusText=(statusMatch?.[1]||"Em andamento").trim().slice(0,100);
  const gs=text.indexOf("Guia de datas importantes"),pe=text.indexOf("Publicações",Math.max(0,gs));
  const guide=gs>=0&&pe>gs?text.slice(gs+"Guia de datas importantes".length,pe):"";
  const importantDates=[];
  for(const m of guide.matchAll(/([^:]{4,180}?):\s*(\d{2}\/\d{2}\/\d{4})/g)){
    const date=isoFromText(m[2]);
    const label=m[1].replace(/^[·•\-\s]+/,"").trim();
    if(date&&label)importantDates.push({label,date});
  }
  const publications=[];
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(re)){
    let url;
    try{url=new URL(decodeHtml(m[1]),contestUrl).toString()}catch{continue}
    if(!allowedPublicationUrl(url))continue;
    const title=stripHtml(m[2]);
    if(!title||title.length<3)continue;
    publications.push({title,url,publishedAt:isoFromText(title),kind:classify(title)});
  }
  const unique=[...new Map(publications.map(p=>[p.url,p])).values()];
  const canonical=JSON.stringify({statusText,importantDates,publications:unique.map(p=>({title:p.title,url:p.url,publishedAt:p.publishedAt}))});
  return {statusText,importantDates,publications:unique,pageHash:sha(canonical)};
}
function lineMatches(line,ident){
  const kind=String(ident.kind||"").toLowerCase(),value=String(ident.value||"").trim();
  if(!value)return false;
  if(["cpf","rg","phone","other"].includes(kind)&&digits(value).length>=5){
    const needle=digits(value),hay=digits(line);
    return hay.includes(needle);
  }
  return normalize(line).includes(normalize(value));
}
function detectCargo(context){
  const n=normalize(context);
  if(/\b202\b/.test(context)||n.includes("tdas-tecnico administrativo")||n.includes("tecnico administrativo"))return"202";
  if(/\b400\b/.test(context)||n.includes("edas-administracao")||n.includes("administracao"))return"400";
  return null;
}
function detectRegistration(context,ident){
  const explicit=context.match(/inscri(?:ç|c)[aã]o\s*[:ºn\-]*\s*(\d{5,12})/i);
  if(explicit)return explicit[1];
  const own=digits(ident.value||"");
  const candidates=[...String(context).matchAll(/(?<!\d)(\d{5,12})(?!\d)/g)]
    .map(m=>m[1])
    .filter(v=>v!==own&&v!=="202"&&v!=="400")
    .filter(v=>!/^20\d{6}$/.test(v));
  const preferred=candidates.find(v=>v.length>=6&&v.length<=10);
  return preferred||null;
}
function findPersonalMatches(text,identifiers,url){
  const lines=String(text||"").split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++){
    if(!lineMatches(lines[i],identifiers[0]||{})){}
  }
  for(const ident of identifiers){
    for(let i=0;i<lines.length;i++){
      if(!lineMatches(lines[i],ident))continue;
      const context=lines.slice(Math.max(0,i-4),Math.min(lines.length,i+5)).join(" ").replace(/\s+/g," ").trim().slice(0,1500);
      const cargoCode=detectCargo(context);
      const registration=detectRegistration(context,ident);
      const kind=String(ident.kind||"other");
      const confidence=kind==="alias"?92:100;
      hits.push({
        url,identifierId:ident.id,identifierKind:kind,
        cargoCode,registration,matchType:kind==="other"?"registration":kind,
        context,confidence
      });
      if(hits.length>=24)return hits;
    }
  }
  const uniq=new Map();
  for(const h of hits){
    const key=[h.identifierId,h.cargoCode||"",h.registration||"",h.matchType].join("|");
    if(!uniq.has(key))uniq.set(key,h);
  }
  return [...uniq.values()];
}

const token=await oidcToken();
const cfgRes=await fetch(EDGE+"/config",{headers:{Authorization:"Bearer "+token}});
if(!cfgRes.ok)throw new Error("Config HTTP "+cfgRes.status+" "+await cfgRes.text());
const cfg=await cfgRes.json();
const contestUrl=cfg.contestUrl;
const identifiers=Array.isArray(cfg.identifiers)?cfg.identifiers:[];
const known=new Map((cfg.knownPublications||[]).map(p=>[p.url,p]));
const bootstrap=known.size===0;
const errors=[];

const html=await fetchText(contestUrl);
const page=parsePage(html,contestUrl);
const personalMatches=[];

for(const pub of page.publications){
  const prev=known.get(pub.url);
  pub.contentHash=prev?.content_hash||null;
  pub.personalScanned=Boolean(prev?.raw?.personalScanned);
  const shouldScan=identifiers.length>0&&(
    bootstrap ? priorityForPersonal(pub.title) : (!prev || (!pub.personalScanned&&priorityForPersonal(pub.title)))
  );
  if(!shouldScan)continue;
  try{
    const {bytes,contentType}=await fetchBytes(pub.url);
    pub.contentHash=sha(bytes);
    let text="";
    if(contentType.toLowerCase().includes("pdf")||pub.url.toLowerCase().includes(".pdf"))text=await pdfToText(bytes,pub.contentHash);
    else text=new TextDecoder("utf-8",{fatal:false}).decode(bytes);
    if(text.trim()){
      personalMatches.push(...findPersonalMatches(text,identifiers,pub.url));
      pub.personalScanned=true;
    }
  }catch(e){
    errors.push({host:new URL(pub.url).hostname,kind:pub.kind,error:String(e?.message||e).slice(0,180)});
  }
}

const payload={
  run:{startedAt,event:eventName,runId,status:errors.length?"partial":"ok"},
  page:{pageHash:page.pageHash,statusText:page.statusText,importantDates:page.importantDates},
  publications:page.publications,
  personalMatches,
  errors
};
const ingest=await fetch(EDGE+"/ingest",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload)});
if(!ingest.ok)throw new Error("Ingest HTTP "+ingest.status+" "+(await ingest.text()).slice(0,500));
const summary=await ingest.json();
console.log(JSON.stringify({
  ok:true,status:payload.run.status,publications:page.publications.length,
  newPublications:summary.newPublications||0,changedPublications:summary.changedPublications||0,
  personalMatches:summary.personalHits||0,scanErrors:errors.length
}));
