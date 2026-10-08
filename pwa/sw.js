/* sw.js — service worker de Ciberpensum. Plantilla: build.mjs inyecta __VERSION__ (hash de contenido) y __PRECACHE__ (lista de rutas). */
const VERSION = "__VERSION__"
const PRECACHE = __PRECACHE__

// El SW se publica en <base>/sw.js y su scope es <base>/ (la raiz real del
// sitio): da igual si esa base es "/" (local, Cloudflare) o un subpath
// (GitHub Pages "/Ciberpensum/"). El precache se resuelve contra ese scope;
// una lista con "/" inicial solo funcionaria en la raiz (bug 2026-10-07,
// ver APRENDIZAJES.md).
const BASE = self.registration.scope
const precache = PRECACHE.map((p) => new URL(p.startsWith("/") ? p.slice(1) : p, BASE).href)

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(precache))
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
            ? caches.match(new URL("404.html", BASE).href)
            : new Response("", { status: 503, statusText: "Offline" })
        )
    })
  )
})