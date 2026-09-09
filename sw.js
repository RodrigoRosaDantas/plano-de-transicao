const CACHE='plano-transicao-v29-separate-phases';
const ASSETS=['./','./index.html','./assets/work-app.css','./assets/transition-pages-v29.css','./assets/work-app.js','./assets/work-manager-v9.css','./assets/work-manager-v9.js','./assets/work-intelligence-v10.css','./assets/work-intelligence-v10.js','./assets/work-decisions-v11.css','./assets/work-decisions-v11.js','./assets/work-decisions-v11-fix.js','./assets/decision-history-v12.css','./assets/decision-history-v12.js','./assets/manager-inbox-v13.css','./assets/manager-inbox-v13.js','./assets/home-focus-v14.css','./assets/home-focus-v14.js','./assets/transition-gate-v15.css','./assets/transition-gate-v15.js','./assets/exam-day-v21.css','./assets/exam-day-v21-shell.css','./assets/exam-day-v21.js','./assets/exam-day-v21-shell.js','./assets/exam-day-v21-bootstrap.js','./assets/exam-day-v22.css','./assets/exam-day-v22.js','./assets/workspace-v23.css','./assets/workspace-v23-home.css','./assets/workspace-v23.js','./assets/workspace-v24-hardening.css','./assets/workspace-v26-polish.css','./assets/post-exam-v27.css','./assets/post-exam-v27.js','./assets/post-exam-score-v28.js','./assets/post-exam-follow-up-v28.js','./assets/post-exam-competition-v28.js','./assets/og.png','./data/snapshot.json','./data/official-keys.json','./data/treated-performance-data.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const req=event.request;
  const url=new URL(req.url);
  const isExamAsset=url.pathname.includes('/assets/exam-day-v');

  if(isExamAsset){
    event.respondWith(
      fetch(req)
        .then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(req,copy));
          }
          return response;
        })
        .catch(()=>caches.match(req,{ignoreSearch:true}))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
        }
        return response;
      })
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(response=>response||caches.match('./index.html')))
  );
});