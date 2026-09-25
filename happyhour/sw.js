/* Clock Out offline cache. The version comes from the ?v= that app.js registers this file with,
   which it takes from the ?v= on its own <script> tag, so index.html is the only place to bump it. */
const V=new URL(location.href).searchParams.get("v")||"dev";
const VERSION="clockout-"+V;
/* what to save for offline use: the page plus every local file it links to (scripts, styles, icons),
   read from index.html itself so there's no second list to keep up to date */
function filesToCache(){return fetch("index.html",{cache:"no-cache"}).then(r=>r.text()).then(html=>{
  const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!/^([a-z]+:|\/\/|#)/i.test(u));
  return ["./","index.html",...new Set(refs)];});}

function put(req,res){if(res&&res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));}return res;}
/* network first, cache when offline (ignoreSearch so any cached ?v= still works offline) */
function networkFirst(req,fallback){return fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(fallback&&caches.match(fallback))));}
/* serve from cache right away, refresh the cache in the background */
function staleWhileRevalidate(req){return caches.match(req).then(hit=>{const net=fetch(req).then(r=>put(req,r));if(hit){net.catch(()=>{});return hit;}return net;});}

self.addEventListener("install",e=>{e.waitUntil(filesToCache().then(files=>caches.open(VERSION).then(c=>c.addAll(files))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);
  if(url.origin===location.origin){
    // pages and venue data: always try for the latest, so an update shows up even if a ?v= bump is missed
    if(req.mode==="navigate"){e.respondWith(networkFirst(req,"index.html"));return;}
    if(url.pathname.endsWith("/js/data.js")){e.respondWith(networkFirst(req));return;}
    e.respondWith(staleWhileRevalidate(req));return;}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{if(res.ok||res.type==="opaque"){const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));}return res;})));}
});
