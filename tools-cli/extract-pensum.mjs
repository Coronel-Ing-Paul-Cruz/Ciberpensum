// extract-pensum.mjs — PDF de pensum -> filas estructuradas en data/interim/.
//
// Uso:  node tools-cli/extract-pensum.mjs <pdf> [--out <json>]
//
// Que produce:
//   - filas candidatas: lineas que matchean `CLAVE NOMBRE CR PRE-REQ.` (regex),
//     cada una con la pagina y las coordenadas y/x para reconstruir las columnas
//     (bloques = cuatrimestres) sin depender del orden de extraccion del texto.
//   - tambien volca TODAS las lineas de cada pagina: el curador necesita ver el
//     contexto (encabezados, "TOTAL DE ASIGNATURAS 55", etc).
//
// Es una herramienta de apoyo: NUNCA escribe en data/curated/. El criterio final
// lo pone check-pensum.mjs + el humano/agente que cura.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const pdf = process.argv[2]
if (!pdf) {
  console.error("uso: node tools-cli/extract-pensum.mjs <pdf> [--out <json>]")
  process.exit(1)
}

const outIdx = process.argv.indexOf("--out")
const out = outIdx !== -1 ? process.argv[outIdx + 1] : null

const FILA = /^([A-Z]{3,4}-\d{3})\s+(.+)$/ // CLAVE + algo (nombre, CR, prereq)

const doc = await getDocument({ data: new Uint8Array(readFileSync(pdf)) }).promise
const paginas = []
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const tc = await page.getTextContent()
  // Agrupa items por linea usando su centro vertical (y).
  const items = tc.items
    .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }))
    .filter((it) => it.text.trim().length > 0)
  items.sort((a, b) => b.y - a.y || a.x - b.x) // y desc (PDF: arriba = y grande)
  const lineas = []
  for (const it of items) {
    const ly = Math.round(it.y * 2) / 2
    const ult = lineas[lineas.length - 1]
    if (ult && Math.abs(ult.y - ly) <= 1) {
      ult.items.push(it)
      ult.xMin = Math.min(ult.xMin, it.x)
      ult.xMax = Math.max(ult.xMax, it.x)
    } else {
      lineas.push({ y: ly, xMin: it.x, xMax: it.x, items: [it] })
    }
  }
  const texto = lineas
    .map((l) => l.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "))
      .join("\n")
  paginas.push({ pagina: p, lineas, texto })
}

const filas = []
for (const pg of paginas) {
  for (const l of pg.lineas) {
    const t = l.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(" ")
    const m = t.match(FILA)
    if (m) filas.push({ codigo: m[1], linea: t, pagina: pg.pagina, y: l.y, xMin: l.xMin, xMax: l.xMax })
  }
}

// Bloques: agrupa filas por cercania vertical dentro de la misma pagina.
// En este PDF las filas de un cuatrimestre estan a 15px y los bloques a 70px+.
for (const pg of paginas) {
  const fs = filas.filter((f) => f.pagina === pg.pagina).sort((a, b) => b.y - a.y)
  let bloque = 0
  let prev = null
  for (const f of fs) {
    if (prev !== null && prev - f.y > 40) bloque++
    f.bloque = bloque
    prev = f.y
  }
}
const maxBloquePorPagina = {}
for (const f of filas) maxBloquePorPagina[f.pagina] = Math.max(maxBloquePorPagina[f.pagina] ?? 0, f.bloque)

const resultado = {
  archivo: basename(pdf),
  paginas: paginas.length,
  filas: filas,
  bloquesPorPagina: maxBloquePorPagina,
}

const salida = out ?? join(ROOT, "data", "interim", basename(pdf).replace(/\.pdf$/i, "") + ".rows.json")
writeFileSync(salida, JSON.stringify(resultado, null, 2))
console.log(`filas detectadas: ${filas.length}`)
console.log(`bloques por pagina: ${JSON.stringify(maxBloquePorPagina)}`)
console.log(`volcado en ${salida}`)
if (filas.length === 0) {
  console.warn("OJO: ninguna linea matcheo el patron CLAVE. Revisa data/interim/*.rows.json para ver el texto real.")
  process.exit(2)
}