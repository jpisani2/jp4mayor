/* Brainwave service worker — offline-first app shell */
const VERSION = 'bw-1.1.0';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/core.js',
  'js/ui.js',
  'js/shell.js',
  'js/app.js',
  'js/games/lights-out.js',
  'js/games/code-breaker.js',
  'js/games/nonogram.js',
  'js/games/binary.js',
  'js/games/sudoku.js',
  'js/games/river.js',
  'js/games/make24.js',
  'js/games/sequence.js',
  'js/games/jugs.js',
  'js/games/nim.js',
  'fonts/gabarito.woff2',
  'fonts/figtree.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: serve the cached shell (a new VERSION re-caches everything together)
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((cached) => cached || fetch(req)));
    return;
  }

  // Assets: cache first, then network (and cache what we fetch)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
