// verify-data.mjs — integridad de data/curated/*.json.
// Cada pensum curado debe: parsear, tener estructura mínima y trazabilidad.
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
let errores = 0
const ok = (m) => console.log("  ok  " + m)
const mal = (m) => { console.log(" FAIL " + m); errores++ }

console.log("== ciberpensum · verify:data ==")

const dir = join(ROOT, "data", "curated")
if (!existsSync(dir) || readdirSync(dir).filter((f) => f.endsWith(".json")).length === 0) {
  ok("sin carreras curadas todavía (fase 0)"); process.exit(0)
}

for (const uni of readdirSync(dir)) {
  const uniDir = join(dir, uni)
  for (const f of readdirSync(uniDir).filter((x) => x.endsWith(".json"))) {
    const p = join(uniDir, f)
    let j
    try { j = JSON.parse(readFileSync(p, "utf8")) } catch (e) { mal(`${uni}/${f}: JSON inválido`); continue }
    const tag = `${uni}/${f}`
    j.carrera ? ok(`${tag}: carrera`) : mal(`${tag}: falta carrera`)
    j.version ? ok(`${tag}: version "${j.version}"`) : mal(`${tag}: falta version`)
    Array.isArray(j.materias) && j.materias.length > 0
      ? ok(`${tag}: ${j.materias.length} materias`)
      : mal(`${tag}: sin materias`)
    const fu = j.fuente
    fu?.url && fu?.sha256 && fu?.verificadoEn
      ? ok(`${tag}: fuente+sha256+fecha`)
      : mal(`${tag}: trazabilidad incompleta (url/sha256/verificadoEn)`)
    // DAG acíclico y códigos resolubles
    if (Array.isArray(j.materias)) {
      const codigos = new Set(j.materias.map((m) => m.codigo))
      for (const m of j.materias) {
        for (const pre of m.prerequisitos ?? [])
          codigos.has(pre) || mal(`${tag}: ${m.codigo} pide ${pre} que no existe en la carrera`)
      }
    }
  }
}

console.log(errores ? `\n== BLOCKED (${errores}) ==` : "\n== PASS ==")
process.exit(errores ? 1 : 0)
