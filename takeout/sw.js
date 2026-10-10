// Bump VERSION whenever app files change (the weekly routine bumps it with each data update).
const VERSION = "2026-10-10.5";
const SHELL = [
  "./", "index.html", "site.webmanifest", "css/styles.css?v=5", "js/app.js?v=5",
  "js/decide.js", "js/hours.js", "js/cuisine.js", "js/geo.js", "js/store.js", "js/config.js", "img/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Supabase, fonts, etc. go straight to network
  // Data: network first so weekly updates show up, cached copy when offline.
  if (url.pathname.includes("/data/")) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // App shell: cache first.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
