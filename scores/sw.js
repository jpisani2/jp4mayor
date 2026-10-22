// Scores service worker — scope stays inside /scores/.
// Caches only the app's own files so it opens instantly and works offline;
// ESPN data is never cached here (the app keeps its own small copy).
const VERSION = 'scores-v1';
const SHELL = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/main.js', './js/config.js', './js/util.js', './js/espn.js', './js/rows.js',
  './js/feed.js', './js/allscores.js', './js/game.js', './js/settings.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('scores-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network first (so pushed updates show up right away), cached copy if offline or slow.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const net = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    net.catch(() => { });
    const timeout = new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch { /* offline */ }
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    return hit || net;
  })());
});
