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
    const html=await timeoutFetch(search,18000);
    links=[...new Set([...html.matchAll(/href=["']([^"']*\/web\/dou\/-\/[^"'?#]+[^"']*)["']/gi)].map(m=>m[1].startsWith("http")?m[1]:"https://www.in.gov.br"+m[1]))].slice(0,6).map(url=>({url,title:"",context:""}));
  }catch(e){
    await page.goto(search,{waitUntil:"domcontentloaded",timeout:35000});
    await page.waitForTimeout(2500);
    links=await extractAnchors(page,'a[href*="/web/dou/-/"]',6);
  }
  for(const item of uniq(links)){
    let text=item.context||"",title=item.title||term.label,section=null,agency=null,published_at=isoFromText(text);
    try{
      const html=await timeoutFetch(item.url,12000);
      const stripped=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
      text=stripped;
      const tm=html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if(tm)title=tm[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().replace(/\s+-\s+DOU.*$/i,"");
      published_at=isoFromText(text.match(/Publicado em:\s*\d{2}\/\d{2}\/\d{4}/i)?.[0]||text)||published_at;
      section=text.match(/Se[cç][aã]o:\s*([^|]{1,80})/i)?.[1]?.trim()||null;
      agency=text.match(/[ÓO]rg[aã]o:\s*([^|]{2,220})/i)?.[1]?.trim()||null;
    }catch{}
    const q=normalize(term.query_text),nt=normalize(text);if(term.is_private&&!nt.includes(q))continue;
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
async function scanDODF(term){
  sourceHealth.DODF.checked++;
  await page.goto("https://dodf.df.gov.br/?dt=1",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForTimeout(1800);
  const input=await findSearchInput(page);
  if(!input)throw new Error("campo de busca não localizado");
  await input.fill(term.query_text);
  await input.press("Enter").catch(()=>{});
  await page.waitForTimeout(4500);
  let links=await extractAnchors(page,'a[href*="/dodf/materia/visualizar"]',10);
  if(!links.length){
    const buttons=page.getByRole("button",{name:/pesquisar|buscar/i});
    const n=await buttons.count();
    for(let i=0;i<n;i++){
      if(await buttons.nth(i).isVisible().catch(()=>false)){
        await buttons.nth(i).click().catch(()=>{});
        await page.waitForTimeout(3500);
        links=await extractAnchors(page,'a[href*="/dodf/materia/visualizar"]',10);
        if(links.length)break;
      }
    }
  }
  for(const item of uniq(links)){
    const context=item.context||item.title||"";
    occurrences.push({
      term_id:term.id,source:"DODF",title:item.title||term.label,url:item.url,
      published_at:isoFromText(context),section:(context.match(/Se[cç][aã]o\s+(I{1,3})/i)?.[0]||null),
      agency:null,snippet:context.slice(0,1000),classification:classify(context)
    });
  }
  sourceHealth.DODF.hits+=occurrences.filter(o=>o.term_id===term.id&&o.source==="DODF").length;
}

for(const term of terms){
  const label=term.is_private?"termo privado":term.label;
  for(const source of term.target_sources||[]){
    try{
      if(source==="DOU")await scanDOU(term);
      if(source==="DODF")await scanDODF(term);
    }catch(e){
      const h=sourceHealth[source];h.status="partial";h.errors.push(label+": "+String(e?.message||e).slice(0,220));
      if(source==="DODF"){
        try{
          await page.goto("https://www.sinj.df.gov.br/sinj/ResultadoDePesquisa?filetext="+encodeURIComponent(term.query_text),{waitUntil:"domcontentloaded",timeout:30000});
          h.fallback="SINJ/DF acessível";
        }catch{}
      }
    }
  }
}

await browser.close();
const clean=uniq(occurrences).slice(0,200);
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
