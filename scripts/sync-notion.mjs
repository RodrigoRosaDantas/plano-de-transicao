import fs from 'node:fs/promises';
const token=process.env.NOTION_TOKEN;
if(!token) throw new Error('NOTION_TOKEN não configurado.');
const pages={home:'239cf5a2673180a1a2a2df40b502a899',journey:'3c8cf5a2673181adbbecc1f6d0080399',exams:'3c8cf5a26731818a9571f28f56f13514',performance:'3c8cf5a2673181a38caef92b980ce85c',strategy:'3c8cf5a2673181e08ae8f9eff95df293',audit:'3c8cf5a2673181f7bce8f6b75881c31f',reconciliation:'3cacf5a26731818da9dacef6da38241f',finance:'cfaf6224f1c047d08385c5331c1ff37b'};
const headers={Authorization:`Bearer ${token}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'};
async function notion(path,opts={}){const r=await fetch(`https://api.notion.com/v1/${path}`,{...opts,headers:{...headers,...opts.headers}});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json()}
async function blocks(id){let cursor,all=[];do{const qs=new URLSearchParams({page_size:'100'});if(cursor)qs.set('start_cursor',cursor);const r=await notion(`blocks/${id}/children?${qs}`);all.push(...r.results);cursor=r.has_more?r.next_cursor:null}while(cursor);return all}
const out={generatedAt:new Date().toISOString(),pages:{}};
for(const [key,id] of Object.entries(pages)){out.pages[key]={meta:await notion(`pages/${id}`).catch(async()=>notion(`databases/${id}`)),blocks:await blocks(id).catch(()=>[])}}
await fs.writeFile(new URL('../data/notion-live.json',import.meta.url),JSON.stringify(out,null,2));
console.log('Notion mirror atualizado.');
