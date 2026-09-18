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
const stripHtml=v=>String(v||"").replace(/<script[\\s\\S]*?<\\/script>/gi," ").replace(/<style[\\s\\S]*?<\\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\\s+/g," ").trim();
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
let dodfDirectAvailable=true;

async function scanSINJ(term){
  const search="https://www.sinj.df.gov.br/sinj/ResultadoDePesquisa?filetext="+encodeURIComponent(term.query_text);
  const bodies=[];
  const pending=[];
  const onResponse=res=>{
    try{
      const u=res.url();
      const ct=(res.headers()["content-type"]||"").toLowerCase();
      if(u.includes("sinj.df.gov.br")&&(ct.includes("json")||ct.includes("text/html"))){
        pending.push(res.text().then(t=>{if(t&&t.length<2500000)bodies.push(t)}).catch(()=>{}));
      }
    }catch{}
  };
  page.on("response",onResponse);
  let bodyText="",html="";
  try{
    await page.goto(search,{waitUntil:"domcontentloaded",timeout:15000});
    await page.waitForTimeout(3200);
    html=await page.content().catch(()=>"");
    bodyText=await page.locator("body").innerText().catch(()=>"");
  }finally{
    page.off("response",onResponse);
    await Promise.allSettled(pending);
  }

  const blob=[html,...bodies].join("\n");
  const ids=new Set();
  for(const m of blob.matchAll(/(?:TextoArquivoDiario|BaixarArquivoDiario)\.aspx\?id_file=([0-9a-f-]{36})/gi))ids.add(m[1]);
  for(const m of blob.matchAll(/(?:id_file|idArquivo|id_arquivo|IdArquivo)[^0-9a-f]{0,40}([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi))ids.add(m[1]);

  const anchors=await page.locator('a[href*="TextoArquivoDiario"],a[href*="BaixarArquivoDiario"]').evaluateAll(els=>els.slice(0,12).map(a=>a.href)).catch(()=>[]);
  for(const href of anchors){
    const m=String(href).match(/id_file=([0-9a-f-]{36})/i);if(m)ids.add(m[1]);
  }

  if(!ids.size){
    if(/nenhum|nenhuma|0\s+resultado|0\s+registro|não foram encontrados|nao foram encontrados|nenhum registro/i.test(bodyText))return 0;
    throw new Error("SINJ respondeu, mas não expôs resultados verificáveis");
  }

  let localHits=0;
  for(const id of [...ids].slice(0,8)){
    const url="https://www.sinj.df.gov.br/sinj/TextoArquivoDiario.aspx?id_file="+id;
    try{
      const detailHtml=await timeoutFetch(url,10000);
      const text=stripHtml(detailHtml);
      if(!matchesTerm(text,term))continue;
      const title=stripHtml(detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"Publicação no DODF");
      const published_at=isoFromText(title)||isoFromText(text.slice(0,1800));
      if(!isRecentDate(published_at,21))continue;
      const nq=normalize(term.query_text);
      const first=nq.split(" ").find(x=>x.length>3)||nq;
      const pos=normalize(text).indexOf(first);
      const snippet=text.slice(Math.max(0,pos>0?pos-320:0),Math.max(0,pos>0?pos-320:0)+1300);
      const section=snippet.match(/SE[ÇC][AÃ]O\s+(I{1,3})/i)?.[0]||null;
      occurrences.push({
        term_id:term.id,source:"DODF",title:title||term.label,url,published_at,section,
        agency:term.is_private?null:term.label,snippet,classification:classify(snippet||text)
      });
      localHits++;
    }catch{}
  }
  return localHits;
}

async function scanDODF(term){
  sourceHealth.DODF.checked++;
  if(!dodfDirectAvailable){
    const n=await scanSINJ(term);
    sourceHealth.DODF.hits+=n;
    return;
  }
  try{
    await page.goto("https://dodf.df.gov.br/?dt=1",{waitUntil:"domcontentloaded",timeout:18000});
    await page.waitForTimeout(1000);
    const input=await findSearchInput(page);
    if(!input)throw new Error("campo de busca não localizado");
    await input.fill(term.query_text);
    await input.press("Enter").catch(()=>{});
    await page.waitForTimeout(2500);
    let links=await extractAnchors(page,'a[href*="/dodf/materia/visualizar"]',10);
    if(!links.length){
      const buttons=page.getByRole("button",{name:/pesquisar|buscar/i});
      const n=await buttons.count();
      for(let i=0;i<n;i++){
        if(await buttons.nth(i).isVisible().catch(()=>false)){
          await buttons.nth(i).click().catch(()=>{});
          await page.waitForTimeout(2000);
          links=await extractAnchors(page,'a[href*="/dodf/materia/visualizar"]',10);
          if(links.length)break;
        }
      }
    }
    if(!links.length){
      const body=await page.locator("body").innerText().catch(()=>"");
      if(!/(nenhum|nenhuma|0\s+resultado|não foram encontrados|nao foram encontrados)/i.test(body))throw new Error("busca direta sem links verificáveis");
    }
    for(const item of uniq(links)){
      const context=item.context||item.title||"";
      if(!matchesTerm(context,term))continue;
      occurrences.push({
        term_id:term.id,source:"DODF",title:item.title||term.label,url:item.url,
        published_at:isoFromText(context),section:(context.match(/Se[cç][aã]o\s+(I{1,3})/i)?.[0]||null),
        agency:term.is_private?null:term.label,snippet:context.slice(0,1000),classification:classify(context)
      });
    }
    sourceHealth.DODF.hits+=occurrences.filter(o=>o.term_id===term.id&&o.source==="DODF").length;
  }catch(directError){
    dodfDirectAvailable=false;
    sourceHealth.DODF.collector="github-actions-sinj";
    sourceHealth.DODF.fallback="SINJ/DF ativo";
    const n=await scanSINJ(term);
    sourceHealth.DODF.hits+=n;
  }
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
