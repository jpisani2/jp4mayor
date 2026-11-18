// Offline support: cache the app shell so the installed app works without a connection.
const VERSION = 'ff-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/vendor/three.module.min.js',
  './js/core/util.js', './js/core/data.js', './js/core/hole.js', './js/core/compile.js', './js/core/painter.js',
  './js/core/store.js', './js/core/share.js', './js/core/haptics.js', './js/core/audio.js',
  './js/game/engine.js', './js/game/models.js', './js/game/scene.js', './js/game/physics.js', './js/game/swing.js', './js/game/play.js',
  './js/editor/editor.js', './js/ui/ui.js', './js/ui/screens.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first so updates pushed to GitHub show up; fall back to cache offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
