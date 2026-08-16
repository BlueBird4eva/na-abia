// NaAbia — service worker
// Caches the app shell (this file + manifest + icons + screenshots) so the
// guide opens instantly with no signal. Cross-origin resources (Leaflet, OSM
// map tiles, Google Fonts) are deliberately NOT cached here — the app already
// falls back gracefully offline (schematic map, system cursive font) and this
// keeps the offline cache small while still using live data when online.
// Bump CACHE_NAME whenever index.html changes so users get the update.
const CACHE_NAME = "naabia-v5-3";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, network-first fallback for anything else
// (e.g. Google Maps links opened from "Get directions"). Navigation requests
// (opening the app itself) get an extra safety net: if both cache and
// network fail, still serve the cached index.html rather than a browser
// error page — this is what makes "open the app with zero signal" reliable.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("./index.html").then((cached) => cached || caches.match("./"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
