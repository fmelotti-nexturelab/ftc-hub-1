// FTC HUB — Service Worker auto-cleanup
// Questo SW si disinstalla e pulisce tutte le cache vecchie.
// Il browser scarica sempre sw.js dalla rete (bypassa il SW attivo),
// quindi questo file viene eseguito anche se il vecchio SW cachava tutto.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.registration.unregister())
     .then(() => self.clients.matchAll())
     .then((clients) => {
       clients.forEach((client) => client.navigate(client.url))
     })
  )
})
