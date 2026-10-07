/* sw.js — service worker de Ciberpensum. Plantilla: build.mjs inyecta __VERSION__ (hash de contenido) y __PRECACHE__ (lista de rutas). */
const VERSION = "__VERSION__"
const PRECACHE = __PRECACHE__

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Cache-first para assets, network-first con malla a cache para navegaciones.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() =>
          req.mode === "navigate"
            ? caches.match("/404.html")
            : new Response("", { status: 503, statusText: "Offline" })
        )
    })
  )
})