import { chromium } from "playwright";

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
const uniq=arr=>[...new Map(arr.map(x=>[x.url,x])).values()];

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
  DODF:{status:"ok",checked:0,hits:0,errors:[],collector:"github-actions-browser",fallback:"SINJ/DF"}
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
  const to=new Date(),from=new Date(to.getTime()-4*86400000);
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
  const url="https://www.sinj.df.gov.br/sinj/ashx/Datatable/ResultadoDePesquisaDiarioDatatable.ashx"
    +"?tipo_pesquisa=diario"
    +"&filetext="+encodeURIComponent(term.query_text)
    +"&bbusca=sinj_diario"
    +"&sEcho=1&iDisplayStart=0&iDisplayLength=25"
    +"&iSortCol_0=5&sSortDir_0=desc";

  const raw=await timeoutFetch(url,15000);
  let data;
  try{data=JSON.parse(raw)}catch{throw new Error("SINJ retornou formato inesperado")}
  const rows=Array.isArray(data?.aaData)?data.aaData:[];
  let localHits=0;

  for(const row of rows){
    const s=row?._source||{};
    if(s.nm_tipo_fonte&&String(s.nm_tipo_fonte).toUpperCase()!=="DODF")continue;
    const published_at=isoFromText(s.dt_assinatura);
    if(!isRecentDate(published_at,21))continue;

    const highlightParts=row?.highlight?.["arquivos.arquivo_diario.filetext"]||[];
    const highlight=Array.isArray(highlightParts)?highlightParts.join(" "):String(highlightParts||"");
    const snippet=String(highlight)
      .replace(/_pre_tag_highlight_/g,"")
      .replace(/_post_tag_highlight_/g,"")
      .replace(/\\n|\\r|\\f/g," ")
      .replace(/\s+/g," ")
      .trim();

    const files=Array.isArray(s.arquivos)?s.arquivos:[];
    for(const file of files.slice(0,4)){
      const id=file?.arquivo_diario?.id_file;
      if(!id||!/^[0-9a-f-]{36}$/i.test(String(id)))continue;
      const officialUrl="https://www.sinj.df.gov.br/sinj/TextoArquivoDiario.aspx?id_file="+id;

      let verifiedText=snippet;
      if(term.is_private){
        if(!matchesTerm(verifiedText,term)){
          try{
            verifiedText=stripHtml(await timeoutFetch(officialUrl,10000));
          }catch{continue}
        }
        if(!matchesTerm(verifiedText,term))continue;
      }

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
  return localHits;
}

async function scanDODF(term){
  sourceHealth.DODF.checked++;
  sourceHealth.DODF.collector="github-actions-sinj";
  sourceHealth.DODF.fallback="SINJ/DF oficial";
  const n=await scanSINJ(term);
  sourceHealth.DODF.hits+=n;
}

for(const term of terms){
  const label=term.is_private?"termo privado":term.label;
  for(const source of term.target_sources||[]){
    try{
      if(source==="DOU")await scanDOU(term);
      if(source==="DODF")await scanDODF(term);
    }catch(e){
      const h=sourceHealth[source];
      h.status="partial";
      const detail=term.is_private?"consulta privada indisponível nesta execução":String(e?.message||e).replace(/https?:\/\/\S+/g,"[url omitida]").slice(0,220);
      h.errors.push(label+": "+detail);
    }
  }
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
