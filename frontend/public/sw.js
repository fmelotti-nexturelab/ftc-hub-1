// FTC HUB — Service Worker
// Strategia: cache-first per asset statici, network-first per API

const CACHE_NAME = "__SW_VERSION__"

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

// INSTALL — precache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ACTIVATE — rimuovi cache vecchie
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// FETCH — network-first per /api, cache-first per il resto
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Le chiamate API non vengono mai cacheate
  if (url.pathname.startsWith("/api")) {
    event.respondWith(fetch(request))
    return
  }

  // Asset statici: cache-first con fallback network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Cachea solo risposte valide
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
