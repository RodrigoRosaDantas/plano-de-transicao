import { chromium } from "playwright";
import { writeFile, unlink, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync=promisify(execFile);

const EDGE="https://fqqkkyusnzhuuizahkww.supabase.co/functions/v1/official-monitor-github";
const AUD="plano-de-transicao-official-monitor";
const startedAt=new Date().toISOString();

const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const classify=text=>{
  const n=normalize(text);
  if(/nomea(c|ç)[aã]o|nomear|nomead/.test(n))return"Nomeação";
  if(/convoca(c|ç)[aã]o|convocar|convocad/.test(n))return"Convocação";
  if(/resultado|classifica(c|ç)[aã]o/.test(n))return"Resultado";
  if(/posse|empossad/.test(n))return"Posse";
  if(/lota(c|ç)[aã]o|lotar|exerc[ií]cio/.test(n))return"Lotação";
  if(/retifica(c|ç)[aã]o/.test(n))return"Retificação";
  if(/comiss[aã]o.*concurso|banca.*concurso/.test(n))return"Pré-edital";
  if(/edital|concurso p[uú]blico|certame/.test(n))return"Concurso";
  return"Administrativo";
};
const isoFromText=text=>{
  const m=String(text||"").match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:null;
};
const stripHtml=v=>String(v||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim();
const matchesTerm=(text,term)=>{
  const body=normalize(text),query=normalize(term.query_text);
  if(term.is_private)return body.includes(query);
  if(body.includes(query))return true;
  const stop=new Set(["de","da","do","das","dos","e","a","o","para","no","na","em","publico","publica","distrito","federal"]);
  const toks=query.split(" ").filter(x=>x.length>2&&!stop.has(x));
  return toks.length>0&&toks.filter(x=>body.includes(x)).length/toks.length>=0.6;
};
const isRecentDate=(iso,days=21)=>{
  if(!iso)return true;
  const t=Date.parse(iso+"T12:00:00-03:00");
  return Number.isFinite(t)&&(Date.now()-t)<=days*86400000&&(t-Date.now())<2*86400000;
};
const timeoutFetch=async(url,ms=15000)=>{
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36","Accept-Language":"pt-BR,pt;q=0.9"}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.text();
  }finally{clearTimeout(timer)}
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const resilientFetch=async(url,ms=18000,attempts=2)=>{
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await timeoutFetch(url,ms)}
    catch(e){
      lastError=e;
      if(attempt<attempts)await sleep(650*attempt);
    }
  }
  throw lastError;
};
const uniq=arr=>[...new Map(arr.map(x=>[x.url,x])).values()];
const htmlDecode=v=>String(v||"")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
  .replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
const binaryFetch=async(url,ms=25000)=>{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
  try{
    const r=await fetch(url,{signal:ctrl.signal,redirect:"follow",headers:{
      "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept":"application/pdf,text/html;q=0.9,*/*;q=0.8","Accept-Language":"pt-BR,pt;q=0.9"
    }});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return {bytes:new Uint8Array(await r.arrayBuffer()),contentType:r.headers.get("content-type")||""};
  }finally{clearTimeout(timer)}
};
const edgeProxyFetch=async(target,mode="text",ms=30000)=>{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
  try{
    const u=EDGE+"/dodf-proxy?url="+encodeURIComponent(target);
    const r=await fetch(u,{signal:ctrl.signal,headers:{Authorization:"Bearer "+token}});
    if(!r.ok)throw new Error("proxy HTTP "+r.status+" "+(await r.text()).slice(0,160));
    if(mode==="binary")return {bytes:new Uint8Array(await r.arrayBuffer()),contentType:r.headers.get("content-type")||""};
    return await r.text();
  }finally{clearTimeout(timer)}
};
const curlText=async(url,seconds=25)=>{
  const {stdout}=await execFileAsync("curl",[
    "-L","--fail","--silent","--show-error",
    "--retry","2","--retry-delay","1","--connect-timeout","8","--max-time",String(seconds),
    "-A","Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    url
  ],{maxBuffer:20*1024*1024,timeout:(seconds+8)*1000});
  return String(stdout||"");
};
const curlFile=async(url,path,seconds=40)=>{
  await execFileAsync("curl",[
    "-L","--fail","--silent","--show-error",
    "--retry","2","--retry-delay","1","--connect-timeout","8","--max-time",String(seconds),
    "-A","Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "-o",path,url
  ],{maxBuffer:2*1024*1024,timeout:(seconds+8)*1000});
  const info=await stat(path);
  if(info.size<10000)throw new Error("arquivo DODF retornou conteúdo insuficiente");
  return info.size;
};
const findTermContext=(text,term)=>{
  const compact=String(text||"").replace(/\s+/g," ").trim();
  const body=normalize(compact),query=normalize(term.query_text);
  if(!body||!query)return null;
  const contextAt=(pos,label="")=>{
    const start=Math.max(0,pos-550),end=Math.min(compact.length,pos+850);
    return {pos,snippet:compact.slice(start,end),label};
  };
  const exact=body.indexOf(query);
  if(exact>=0)return contextAt(exact,"exact");
  if(term.is_private)return null;
  const stop=new Set(["de","da","do","das","dos","e","a","o","para","no","na","em","publico","publica","distrito","federal","estado"]);
  const toks=[...new Set(query.split(" ").filter(x=>x.length>3&&!stop.has(x)))];
  if(!toks.length)return null;
  const anchors=[...toks].sort((a,b)=>b.length-a.length).slice(0,4);
  for(const anchor of anchors){
    let pos=body.indexOf(anchor),seen=0;
    while(pos>=0&&seen<30){
      const window=body.slice(Math.max(0,pos-900),Math.min(body.length,pos+1300));
      const matched=toks.filter(x=>window.includes(x));
      const ratio=matched.length/toks.length;
      if(ratio>=0.72)return contextAt(pos,"window");
      pos=body.indexOf(anchor,pos+anchor.length);
      seen++;
    }
  }
  return null;
};
const relevantPublicContext=(text,term)=>{
  const hit=findTermContext(text,term);
  if(!hit)return null;
  if(term.is_private)return hit;
  const n=normalize(hit.snippet);
  const label=normalize(term.label);
  const category=normalize(term.category);
  const hasConcurso=/\b(concurso|certame)\b/.test(n);
  if(label.includes("banca")&&!(hasConcurso&&/\bbanca\b/.test(n)))return null;
  if(label.includes("comissao")&&!(hasConcurso&&/\bcomissao\b/.test(n)))return null;
  if(label.includes("concurso")&&!hasConcurso)return null;
  const agencyOk=
    category==="seedf"
      ? (n.includes("secretaria de estado de educacao do distrito federal")||/\bseedf\b/.test(n))
      : category==="sedes"
        ? (n.includes("secretaria de estado de desenvolvimento social do distrito federal")||/\bsedes\b/.test(n))
        : category==="tjdft"
          ? (n.includes("tribunal de justica do distrito federal e dos territorios")||/\btjdft\b/.test(n))
          : true;
  return agencyOk?hit:null;
};
const sectionAt=(text,pos)=>{
  const before=String(text||"").slice(Math.max(0,pos-160000),Math.max(0,pos)).toUpperCase();
  const options=[
    ["Seção I",Math.max(before.lastIndexOf("SEÇÃO I"),before.lastIndexOf("SECAO I"))],
    ["Seção II",Math.max(before.lastIndexOf("SEÇÃO II"),before.lastIndexOf("SECAO II"))],
    ["Seção III",Math.max(before.lastIndexOf("SEÇÃO III"),before.lastIndexOf("SECAO III"))]
  ].sort((a,b)=>b[1]-a[1]);
  return options[0]?.[1]>=0?options[0][0]:null;
};

async function oidcToken(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!u||!t)throw new Error("GitHub OIDC indisponível");
  const sep=u.includes("?")?"&":"?";
  const r=await fetch(u+sep+"audience="+encodeURIComponent(AUD),{headers:{Authorization:"Bearer "+t}});
  if(!r.ok)throw new Error("OIDC HTTP "+r.status);
  const j=await r.json();if(!j.value)throw new Error("OIDC token ausente");return j.value;
}
const token=await oidcToken();
const cfgRes=await fetch(EDGE+"/config",{headers:{Authorization:"Bearer "+token}});
if(!cfgRes.ok)throw new Error("Config HTTP "+cfgRes.status+" "+await cfgRes.text());
const {terms}=await cfgRes.json();

const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage","--no-sandbox"]});
const ctx=await browser.newContext({locale:"pt-BR",timezoneId:"America/Sao_Paulo",userAgent:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"});
const page=await ctx.newPage();
page.setDefaultTimeout(12000);

const occurrences=[];
const sourceHealth={
  DOU:{status:"ok",checked:0,hits:0,errors:[],collector:"github-actions"},
  DODF:{
    status:"ok",checked:0,hits:0,errors:[],
    collector:"DODF do dia + SINJ/DF",
    fallback:"SINJ/DF",
    todayStatus:"pending",
    historyStatus:"pending",
    historyErrorCount:0
  }
};

async function extractAnchors(page,selector,limit=8){
  return await page.locator(selector).evaluateAll((els,limit)=>els.slice(0,limit).map(a=>{
    let p=a,context="";
    for(let i=0;i<5&&p;i++,p=p.parentElement){
      const txt=(p.innerText||"").replace(/\s+/g," ").trim();
      if(txt.length>40&&txt.length<2200){context=txt;}
    }
    return {url:a.href,title:(a.innerText||a.textContent||"").replace(/\s+/g," ").trim(),context};
  }),limit);
}

async function scanDOU(term){
  sourceHealth.DOU.checked++;
  const to=new Date(),from=new Date(to.getTime()-14*86400000);
  const fmt=d=>new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
  const search="https://www.in.gov.br/consulta/-/buscar/dou?q="+encodeURIComponent(term.query_text)+"&s=todos&exactDate=personalizado&sortType=0&delta=10&publishFrom="+encodeURIComponent(fmt(from))+"&publishTo="+encodeURIComponent(fmt(to));
  let links=[];
  try{
    const html=await timeoutFetch(search,10000);
    links=[...new Set([...html.matchAll(/href=["']([^"']*\/web\/dou\/-\/[^"'?#]+[^"']*)["']/gi)].map(m=>m[1].startsWith("http")?m[1]:"https://www.in.gov.br"+m[1]))].slice(0,6).map(url=>({url,title:"",context:""}));
  }catch(e){
    await page.goto(search,{waitUntil:"domcontentloaded",timeout:20000});
    await page.waitForTimeout(1200);
    links=await extractAnchors(page,'a[href*="/web/dou/-/"]',6);
  }
  for(const item of uniq(links)){
    let text=item.context||"",title=item.title||term.label,section=null,agency=null,published_at=isoFromText(text);
    try{
      const html=await timeoutFetch(item.url,12000);
      const stripped=stripHtml(html);
      text=stripped;
      const tm=html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if(tm)title=tm[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().replace(/\s+-\s+DOU.*$/i,"");
      published_at=isoFromText(text.match(/Publicado em:\s*\d{2}\/\d{2}\/\d{4}/i)?.[0]||text)||published_at;
      section=text.match(/Se[cç][aã]o:\s*([^|]{1,80})/i)?.[1]?.trim()||null;
      agency=text.match(/[ÓO]rg[aã]o:\s*([^|]{2,220})/i)?.[1]?.trim()||null;
    }catch{}
    if(!matchesTerm(text,term))continue;
    occurrences.push({term_id:term.id,source:"DOU",title,url:item.url,published_at,section,agency,snippet:text.slice(0,900),classification:classify(text)});
  }
  sourceHealth.DOU.hits+=occurrences.filter(o=>o.term_id===term.id&&o.source==="DOU").length;
}

async function scanDODFToday(dodfTerms){
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const displayDate=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());
  const home="https://dodf.df.gov.br/?dt=1";
  let html="";
  try{html=await resilientFetch(home,12000,1)}
  catch(fetchError){
    try{html=await edgeProxyFetch(home,"text",25000)}
    catch(proxyError){
      try{html=await curlText(home,12)}
      catch(curlError){
        const code=fetchError?.cause?.code||fetchError?.code||"fetch";
        throw new Error("homepage DODF indisponível ("+code+"): proxy="+String(proxyError?.message||proxyError).slice(0,90)+"; curl="+String(curlError?.message||curlError).slice(0,90));
      }
    }
  }
  const hrefMatches=[...html.matchAll(/href=["']([^"']*visualizar-pdf[^"']*)["']/gi)].map(m=>htmlDecode(m[1]));
  const pdfHref=hrefMatches.find(x=>/INTEGRA\.pdf/i.test(x))||hrefMatches[0];
  if(!pdfHref)throw new Error("link da edição PDF do dia não localizado");
  const pdfUrl=new URL(pdfHref,home).href;
  const tmp="/tmp/dodf-oficial-dia.pdf";
  let pdfText="";
  try{
    let downloaded=false;
    try{
      const {bytes,contentType}=await binaryFetch(pdfUrl,18000);
      if(bytes.length<10000)throw new Error("PDF do dia retornou conteúdo insuficiente");
      if(contentType&&!/pdf|octet-stream/i.test(contentType))throw new Error("resposta do DODF não parece PDF");
      await writeFile(tmp,bytes);
      downloaded=true;
    }catch(fetchError){
      try{
        const {bytes,contentType}=await edgeProxyFetch(pdfUrl,"binary",35000);
        if(bytes.length<10000)throw new Error("proxy retornou PDF insuficiente");
        if(contentType&&!/pdf|octet-stream/i.test(contentType))throw new Error("proxy não retornou PDF");
        await writeFile(tmp,bytes);
        downloaded=true;
      }catch(proxyError){
        try{
          await curlFile(pdfUrl,tmp,20);
          downloaded=true;
        }catch(curlError){
          const code=fetchError?.cause?.code||fetchError?.code||"fetch";
          throw new Error("PDF certificado indisponível ("+code+"): proxy="+String(proxyError?.message||proxyError).slice(0,90)+"; curl="+String(curlError?.message||curlError).slice(0,90));
        }
      }
    }
    if(!downloaded)throw new Error("PDF certificado não foi baixado");
    const out=await execFileAsync("pdftotext",["-layout",tmp,"-"],{maxBuffer:80*1024*1024,timeout:45000});
    pdfText=String(out.stdout||"").replace(/\u0000/g," ");
  }finally{
    await unlink(tmp).catch(()=>{});
  }
  if(pdfText.replace(/\s+/g," ").trim().length<5000)throw new Error("texto da edição do dia não pôde ser extraído");
  let localHits=0;
  for(const term of dodfTerms){
    const ctxHit=findTermContext(pdfText,term);
    if(!ctxHit)continue;
    occurrences.push({
      term_id:term.id,
      source:"DODF",
      title:["DODF do dia",displayDate].join(" · "),
      url:pdfUrl,
      published_at:today,
      section:sectionAt(pdfText,ctxHit.pos),
      agency:term.is_private?null:term.label,
      snippet:ctxHit.snippet.slice(0,1200),
      classification:classify(ctxHit.snippet)
    });
    localHits++;
  }
  return {hits:localHits,sections:3,method:"pdf-certificado"};
}
async function findSearchInput(page){
  const selectors=['input[placeholder*="Digite aqui"]','input[placeholder*="Informe o termo"]','input[placeholder*="pesquisar" i]','input[type="search"]','input[type="text"]'];
  for(const sel of selectors){
    const loc=page.locator(sel);
    for(let i=0;i<Math.min(await loc.count(),8);i++){
      const x=loc.nth(i);
      if(await x.isVisible().catch(()=>false))return x;
    }
  }
  return null;
}
async function scanSINJ(term){
  const year=new Intl.DateTimeFormat("en",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date());
  const endpoint="https://www.sinj.df.gov.br/sinj/ashx/Datatable/ResultadoDePesquisaDiarioDatatable.ashx";
  const pageSize=25; // lotes menores evitam timeout do SINJ; a paginação cobre todo o conjunto
  let offset=0;
  let total=Infinity;
  let localHits=0;
  let pages=0;

  while(offset<total&&pages<3){
    const url=endpoint
      +"?tipo_pesquisa=diario"
      +"&filetext="+encodeURIComponent(term.query_text)
      +"&bbusca=sinj_diario"
      +"&filtro="+encodeURIComponent("ano_assinatura:"+year)
      +"&sEcho=1&iDisplayStart="+offset
      +"&iDisplayLength="+pageSize;

    const raw=await resilientFetch(url,18000,2);
    let data;
    try{data=JSON.parse(raw)}catch{throw new Error("SINJ retornou formato inesperado")}
    const rows=Array.isArray(data?.aaData)?data.aaData:[];
    const reported=Number(data?.iTotalDisplayRecords);
    if(Number.isFinite(reported))total=reported;
    if(!rows.length)break;

    for(const row of rows){
      const s=row?._source||{};
      if(s.nm_tipo_fonte&&String(s.nm_tipo_fonte).toUpperCase()!=="DODF")continue;
      const published_at=isoFromText(s.dt_assinatura);
      if(!isRecentDate(published_at,35))continue;

      const highlightPartsRaw=row?.highlight?.["arquivos.arquivo_diario.filetext"]
        || row?.highlight?.["ar_diario.filetext"]
        || [];
      const highlightParts=(Array.isArray(highlightPartsRaw)?highlightPartsRaw:[highlightPartsRaw])
        .map(part=>String(part||"")
          .replace(/_pre_tag_highlight_/g,"")
          .replace(/_post_tag_highlight_/g,"")
          .replace(/\\n|\\r|\\f/g," ")
          .replace(/\s+/g," ")
          .trim())
        .filter(Boolean);
      const highlight=highlightParts.join(" ");

      const files=[];
      if(s?.ar_diario?.id_file)files.push({arquivo_diario:s.ar_diario,ds_arquivo:""});
      if(Array.isArray(s.arquivos))files.push(...s.arquivos);

      for(const file of files.slice(0,6)){
        const id=file?.arquivo_diario?.id_file;
        if(!id||!/^[0-9a-f-]{36}$/i.test(String(id)))continue;
        const officialUrl="https://www.sinj.df.gov.br/sinj/TextoArquivoDiario.aspx?id_file="+id;

        let contextHit=null;
        for(const fragment of highlightParts){
          contextHit=term.is_private
            ? (matchesTerm(fragment,term)?{snippet:fragment}:null)
            : relevantPublicContext(fragment,term);
          if(contextHit)break;
        }
        if(!contextHit&&term.is_private){
          try{
            const officialText=stripHtml(await timeoutFetch(officialUrl,10000));
            if(matchesTerm(officialText,term))contextHit=findTermContext(officialText,term)||{snippet:officialText.slice(0,1200)};
          }catch{}
        }
        if(!contextHit)continue;
        const verifiedText=contextHit.snippet||highlight;

        const section=s.secao_diario?("Seção "+String(s.secao_diario)):null;
        const edition=[s.nr_diario?("nº "+s.nr_diario):"",s.nm_tipo_edicao||"",s.nm_diferencial_edicao||""].filter(Boolean).join(" · ");
        occurrences.push({
          term_id:term.id,
          source:"DODF",
          title:["DODF",edition,s.dt_assinatura||""].filter(Boolean).join(" · "),
          url:officialUrl,
          published_at,
          section,
          agency:term.is_private?null:term.label,
          snippet:(verifiedText||snippet||"Ocorrência localizada no Diário Oficial do Distrito Federal.").slice(0,1200),
          classification:classify(verifiedText||snippet)
        });
        localHits++;
      }
    }

    offset+=rows.length;
    pages++;
    if(rows.length<pageSize)break;
  }
  return localHits;
}

async function scanDODFHistory(term){
  const n=await scanSINJ(term);
  sourceHealth.DODF.hits+=n;
}

const recordSourceError=(source,term,e)=>{
  const h=sourceHealth[source];
  h.status="partial";
  const label=term.is_private?"termo privado":term.label;
  const detail=term.is_private
    ?"consulta privada indisponível nesta execução"
    :String(e?.message||e).replace(/https?:\/\/\S+/g,"[url omitida]").slice(0,220);
  h.errors.push(label+": "+detail);
};

const dodfTerms=terms.filter(t=>(t.target_sources||[]).includes("DODF"));
sourceHealth.DODF.checked=dodfTerms.length;
let dodfTodayOk=false;
try{
  const direct=await scanDODFToday(dodfTerms);
  sourceHealth.DODF.hits+=direct.hits;
  sourceHealth.DODF.todayStatus="ok";
  sourceHealth.DODF.todaySections=direct.sections;
  dodfTodayOk=true;
}catch(e){
  sourceHealth.DODF.todayStatus="partial";
  sourceHealth.DODF.errors.push("DODF do dia: "+String(e?.message||e).replace(/https?:\/\/\S+/g,"[url omitida]").slice(0,180));
}

const localHour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"America/Sao_Paulo",hour:"2-digit",hourCycle:"h23"}).format(new Date()));
const runHistory=[6,12,18,21].includes(localHour);
sourceHealth.DODF.historyStatus=runHistory?"ok":"skipped";
if(runHistory){
  const historyErrorsBefore=sourceHealth.DODF.errors.length;
  const dodfBatchSize=2;
  for(let i=0;i<dodfTerms.length;i+=dodfBatchSize){
    const batch=dodfTerms.slice(i,i+dodfBatchSize);
    await Promise.allSettled(batch.map(async term=>{
      try{await scanDODFHistory(term)}
      catch(e){
        const label=term.is_private?"termo privado":term.label;
        sourceHealth.DODF.errors.push(label+": "+(term.is_private
          ?"consulta histórica privada indisponível nesta execução"
          :String(e?.message||e).replace(/https?:\/\/\S+/g,"[url omitida]").slice(0,180)));
      }
    }));
    if(i+dodfBatchSize<dodfTerms.length)await sleep(350);
  }
  sourceHealth.DODF.historyErrorCount=Math.max(0,sourceHealth.DODF.errors.length-historyErrorsBefore);
  if(sourceHealth.DODF.historyErrorCount)sourceHealth.DODF.historyStatus="partial";
}
sourceHealth.DODF.status=dodfTodayOk?"ok":"partial";

const douTerms=terms.filter(t=>(t.target_sources||[]).includes("DOU"));
for(const term of douTerms){
  try{await scanDOU(term)}catch(e){recordSourceError("DOU",term,e)}
}

await browser.close();
const clean=[...new Map(occurrences.map(o=>[`${o.term_id}|${o.source}|${o.url}`,o])).values()].slice(0,200);
const status=Object.values(sourceHealth).every(s=>s.status==="ok")?"ok":"partial";
const ingest=await fetch(EDGE+"/ingest",{
  method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({startedAt,finishedAt:new Date().toISOString(),status,sourceHealth,occurrences:clean})
});
if(!ingest.ok)throw new Error("Ingest HTTP "+ingest.status+" "+await ingest.text());
const result=await ingest.json();
console.log(JSON.stringify({ok:true,status,termsChecked:terms.length,occurrences:clean.length,newHits:result.newHits,sourceHealth:{
  DOU:{status:sourceHealth.DOU.status,checked:sourceHealth.DOU.checked,hits:sourceHealth.DOU.hits,errorCount:sourceHealth.DOU.errors.length},
  DODF:{status:sourceHealth.DODF.status,checked:sourceHealth.DODF.checked,hits:sourceHealth.DODF.hits,errorCount:sourceHealth.DODF.errors.length}
}}));
