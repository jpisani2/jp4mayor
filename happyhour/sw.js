/* Clock Out offline cache. Bump VERSION when site files change. */
const VERSION="clockout-2026-09-25-1";
const FILES=["./","index.html","css/styles.css?v=2026-09-25-1","js/data.js?v=2026-09-25-1","js/app.js?v=2026-09-25-1","img/favicon.svg","img/icon-192.png","site.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);
  if(url.origin===location.origin){
    // pages: network first so updates show up; fall back to cache offline
    if(req.mode==="navigate"){e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp));return r;}).catch(()=>caches.match(req).then(r=>r||caches.match("index.html"))));return;}
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));return res;})));return;}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));return res;}).catch(()=>r)));}
});
