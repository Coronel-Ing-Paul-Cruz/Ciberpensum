// check-links.mjs — ningun href/src interno de dist/ puede estar roto.
//
// Uso CLI:  node tools-cli/check-links.mjs [dist]
// Uso lib:  import { enlacesRotos } from "./check-links.mjs"
//
// Detecta la clase de bug de los indices de herramienta 2026-10-08 (enlace
// relativo que duplicaba el slug: /herramientas/progreso/progreso/... 404) y
// el de las paginas legales (rutaAssets(0) en paginas de profundidad 1).
// El sitemap solo prueba URLs publicadas; esto prueba los enlaces DENTRO del HTML.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const walk = (d) => {
  const out = []
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith(".html")) out.push(p)
  }
  return out
}

/** Devuelve la lista de enlaces rotos "archivo -> href" (vacia = todo bien). */
export function enlacesRotos(dist) {
  const rotos = []
  for (const f of walk(dist)) {
    const html = readFileSync(f, "utf8")
    for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
      const h = m[1]
      if (h.startsWith("http") || h.startsWith("mailto:") || h.startsWith("tel:")) continue
      const dest = resolve(dirname(f), h)
      const ok = h.endsWith("/") ? existsSync(join(dest, "index.html")) : existsSync(dest)
      if (!ok) rotos.push(`${f} -> ${h}`)
    }
  }
  return rotos
}

// Entrada CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const dist = process.argv[2] ?? "dist"
  const rotos = enlacesRotos(dist)
  console.log(`enlaces internos rotos: ${rotos.length}`)
  for (const r of rotos.slice(0, 20)) console.log("  " + r)
  process.exit(rotos.length ? 1 : 0)
}
