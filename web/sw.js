// Tylko powłoka aplikacji z cache. Dane (Convex) zawsze idą przez sieć: brak „pustego sukcesu” offline.
const CACHE = "friendpump-shell-0.1.0";
const SHELL = ["./", "index.html", "style.css", "app.js", "lib.js", "ui.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  // Sieć najpierw, cache jako zapas: nowa wersja pojawia się od razu, a offline otwiera się powłoka.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
