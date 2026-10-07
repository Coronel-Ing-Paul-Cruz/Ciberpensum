// tools-cli/build.mjs — SSG de Ciberpensum.
// Genera dist/ completo desde: data/curated (los datos), site/ (renderizado),
// ui/ (CSS), tools/ (bundles JS por herramienta) y pwa/ (manifest + SW + icono).
// Salida estatica pura: todo funciona sin JS (regla 6 de AGENTS.md).
import { createHash } from "node:crypto"
import {
  copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import {
  GUIAS, HERRAMIENTAS, SITIO_URL,
  render404, renderCarrera, renderGuia, renderGuias, renderHerramienta,
  renderHerramientas, renderHome, renderUniversidad, renderUniversidades,
  rutasDelSitio,
} from "../site/paginas.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIST = join(ROOT, "dist")

// 1. dist limpio (es salida generada: se regenera entera cada vez)
rmSync(DIST, { recursive: true, force: true })

// 2. carreras curadas
const carreras = []
for (const uni of readdirSync(join(ROOT, "data", "curated"))) {
  const uniDir = join(ROOT, "data", "curated", uni)
  if (!statSync(uniDir).isDirectory()) continue
  for (const f of readdirSync(uniDir).filter((x) => x.endsWith(".json"))) {
    carreras.push(JSON.parse(readFileSync(join(uniDir, f), "utf8")))
  }
}
if (carreras.length === 0) {
  console.error("sin carreras curadas: no se puede generar el sitio")
  process.exit(1)
}

// 3. CSS (tokens + componentes, en ese orden)
const css = [
  readFileSync(join(ROOT, "ui", "tokens.css"), "utf8"),
  readFileSync(join(ROOT, "ui", "componentes.css"), "utf8"),
].join("\n")
const dirCss = join(DIST, "assets", "css")
mkdirSync(dirCss, { recursive: true })
writeFileSync(join(dirCss, "site.css"), css)

// 4. Bundles JS: uno por herramienta (minificados, con code-splitting ESM)
const dirsJs = join(DIST, "assets", "js")
mkdirSync(dirsJs, { recursive: true })
const entradas = {}
for (const h of HERRAMIENTAS) entradas[h.slug] = join(ROOT, "tools", h.slug, "entrada.ts")
await build({
  entryPoints: entradas,
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: dirsJs,
  minify: true,
  target: ["es2020"],
  logLevel: "warning",
})

// 5. PWA: manifest, icono y service worker con precache real
const dirAssets = join(DIST, "assets")
mkdirSync(dirAssets, { recursive: true })
copyFileSync(join(ROOT, "pwa", "manifest.webmanifest"), join(dirAssets, "manifest.webmanifest"))
copyFileSync(join(ROOT, "pwa", "icono.svg"), join(dirAssets, "icono.svg"))

const assetsCss = readFileSync(join(dirCss, "site.css"), "utf8")
const hash = createHash("sha256")
hash.update(assetsCss)
const bundles = []
for (const h of HERRAMIENTAS) {
  const p = join(dirsJs, `${h.slug}.js`)
  bundles.push(p)
  hash.update(readFileSync(p, "utf8"))
}
const VERSION = hash.digest("hex").slice(0, 10)

const precache = [
  "/",
  "/index.html",
  "/assets/css/site.css",
  "/assets/manifest.webmanifest",
  "/assets/icono.svg",
  ...bundles.map((p) => "/assets/js/" + p.split(/[\\/]/).pop()),
]
const plantillaSw = readFileSync(join(ROOT, "pwa", "sw.js"), "utf8")
writeFileSync(
  join(DIST, "sw.js"),
  plantillaSw.replace("__VERSION__", VERSION).replace("__PRECACHE__", JSON.stringify(precache)),
)

// 6. Paginas
mkdirSync(join(DIST, "universidades"), { recursive: true })
writeFileSync(join(DIST, "index.html"), renderHome(carreras))
writeFileSync(join(DIST, "universidades", "index.html"), renderUniversidades(carreras))
for (const c of carreras) {
  const uniDir = join(DIST, "universidades", c.universidad.id)
  mkdirSync(uniDir, { recursive: true })
  writeFileSync(join(uniDir, "index.html"), renderUniversidad(c.universidad.id, carreras))
  const carreraDir = join(DIST, "carreras", c.universidad.id, c.slug)
  mkdirSync(carreraDir, { recursive: true })
  writeFileSync(join(carreraDir, "index.html"), renderCarrera(c))
}
mkdirSync(join(DIST, "herramientas"), { recursive: true })
writeFileSync(join(DIST, "herramientas", "index.html"), renderHerramientas())
for (const h of HERRAMIENTAS) {
  const d = join(DIST, "herramientas", h.slug)
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, "index.html"), renderHerramienta(h, carreras[0]))
}
mkdirSync(join(DIST, "guias"), { recursive: true })
writeFileSync(join(DIST, "guias", "index.html"), renderGuias())
for (const g of GUIAS) writeFileSync(join(DIST, "guias", `${g.slug}.html`), renderGuia(g))
writeFileSync(join(DIST, "404.html"), render404())

// 7. robots.txt + sitemap.xml
writeFileSync(
  join(DIST, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITIO_URL}/sitemap.xml\n`,
)
const urls = rutasDelSitio(carreras)
  .filter((r) => r !== "/404.html")
  .map((r) => `  <url><loc>${SITIO_URL}${r}</loc></url>`)
  .join("\n")
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
)

// 8. Resumen
const totalArchivos = (() => {
  let n = 0
  const cuenta = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) cuenta(join(d, e.name))
      else n++
    }
  }
  cuenta(DIST)
  return n
})()
console.log(`build ok: ${carreras.length} carrera(s), ${HERRAMIENTAS.length} herramientas, ${GUIAS.length} guías, ${urls.split("\n").length} URLs en sitemap, ${totalArchivos} archivos en dist/`)
console.log(`service worker versión ${VERSION} con ${precache.length} rutas precacheadas`)