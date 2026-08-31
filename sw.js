const CACHE='plano-transicao-v3';
const ASSETS=['./','./index.html','./assets/styles.css','./assets/app.js','./assets/work-parity.css','./assets/work-parity.js','./data/snapshot.json','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const req=e.request;e.respondWith(fetch(req).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return r}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))))});
