/* Weather Almanac service worker: lets the page open with no connection.
   - The site's own files: fetched fresh when online, so edits show up right away; served from the cache when offline.
   - The map library and fonts: versioned and never change, so they come from the cache first.
   - Weather data is not cached here. The page keeps its own copy of the last forecast and the climate
     record, and it says when it is showing saved data instead of live data.
   When you change styles.css or app.js, bump VERSION here and the matching ?v= in index.html. */
const VERSION = '2026-11-03';
const SHELL = 'wx-shell-' + VERSION;
const LIBS = 'wx-libs-v1';
const SHELL_FILES = ['./', 'index.html', 'styles.css?v=' + VERSION, 'app.js?v=' + VERSION,
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const LIB_FILES = ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'];
const LIB_HOSTS = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    // The map library is nice to have offline but not essential, so a failure here doesn't block the install.
    try { await (await caches.open(LIBS)).addAll(LIB_FILES.map(u => new Request(u, { mode: 'cors' }))); } catch (err) { /* cached later on use */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('wx-shell-') && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (LIB_HOSTS.has(url.hostname)) e.respondWith(url.hostname === 'fonts.googleapis.com' ? staleWhileRevalidate(req) : cacheFirst(req));
  // everything else (weather data, map tiles, outlook images) goes straight to the network
});

// Fresh copy when online. A slow connection falls back to the saved copy after a few seconds, if there is one.
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  const saved = () => cache.match(req).then(r => r || (req.mode === 'navigate' ? cache.match('./') : undefined));
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  try {
    const slow = new Promise(resolve => setTimeout(() => saved().then(r => r && resolve(r)), 4000));
    return await Promise.race([net, slow]);
  } catch (err) {
    const hit = await saved();
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
