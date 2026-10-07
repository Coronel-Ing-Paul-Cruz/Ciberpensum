// check-pensum.mjs — validacion profunda de UN pensum curado, antes de commitear.
//
// Uso:  node tools-cli/check-pensum.mjs <data/curated/.../xxx.json>
//
// Es lo que le pide al JSON el site: mismo schema que la carga en runtime
// (core/datos la reimplementa en TS puro para el navegador). El gate ejecuta
// verify-data.mjs, que resume estos mismos chequeos sobre toda data/curated/.
import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const ruta = process.argv[2]
if (!ruta || !existsSync(ruta)) {
  console.error("uso: node tools-cli/check-pensum.mjs <data/curated/.../xxx.json>")
  process.exit(1)
}

let errores = 0
const ok = (m) => console.log("  ok  " + m)
const mal = (m) => { console.log(" FAIL " + m); errores++ }

console.log("== check-pensum.mjs ==")

// 1. Parseo
let j
try { j = JSON.parse(readFileSync(ruta, "utf8")) } catch (e) { console.log(" FAIL JSON invalido: " + e.message); process.exit(1) }
ok("JSON parsea")

// 2. Schema (ajv)
let Ajv
try { Ajv = require("ajv") } catch { console.log(" FAIL falta ajv: instala con `npm i -D ajv`"); process.exit(1) }
const schema = JSON.parse(readFileSync(join(ROOT, "data", "schema", "pensum.schema.json"), "utf8"))
const ajv = new Ajv({ allErrors: true, strict: false })
const validar = ajv.compile(schema)
if (validar(j)) {
  ok("schema: contrato cumplido")
} else {
  for (const e of validar.errors.slice(0, 15)) mal(`schema: ${e.instancePath || "(raiz)"} ${e.message}`)
}

// 3. Totales declarados vs cacHead
const cs = j.materias.reduce((a, m) => a + m.creditos, 0)
j.totales.asignaturas === j.materias.length
  ? ok(`totales.asignaturas = ${j.totales.asignaturas}`)
  : mal(`totales.asignaturas ${j.totales.asignaturas} != materias reales ${j.materias.length}`)
j.totales.creditos === cs
  ? ok(`totales.creditos = ${j.totales.creditos}`)
  : mal(`totales.creditos ${j.totales.creditos} != suma real ${cs}`)

// 4. Codigos unicos
const dups = [...new Set(j.materias.map((m) => m.codigo).filter((c, i, a) => a.indexOf(c) !== i))]
dups.length === 0 ? ok("codigos unicos") : mal(`codigos duplicados: ${dups.join(", ")}`)

// 5. Prerequisitos resuelven y sin ciclos
const codigos = new Set(j.materias.map((m) => m.codigo))
let preFaltantes = 0
for (const m of j.materias)
  for (const p of m.prerequisitos ?? [])
    if (!codigos.has(p)) { mal(`${m.codigo} pide ${p} que no existe`); preFaltantes++ }
if (!preFaltantes) ok("prerequisitos resuelven a codigos existentes")

const estado = new Map(j.materias.map((m) => [m.codigo, { color: "blanco", pila: false }]))
let ciclo = null
const visitar = (c, pila) => {
  const n = estado.get(c)
  if (n.pila) { ciclo = pila.concat(c).join(" -> "); return }
  if (n.color === "negro") return
  n.color = "gris"; n.pila = true
  const m = j.materias.find((x) => x.codigo === c)
  for (const p of m?.prerequisitos ?? []) visitar(p, pila.concat(c))
  n.pila = false; n.color = "negro"
}
for (const m of j.materias) visitar(m.codigo, [])
ciclo ? mal(`ciclo de prerrequisitos: ${ciclo}`) : ok("grafo de prerrequisitos aciclico")

// 6. Cuatrimestres dentro de la duracion
const maxC = j.materias.reduce((a, m) => Math.max(a, m.cuatrimestre), 0)
const fuera = j.materias.filter((m) => m.cuatrimestre > j.duracion.periodos)
fuera.length === 0
  ? ok(`cuatrimestres dentro de duracion (max ${maxC} de ${j.duracion.periodos})`)
  : mal(`materias fuera del rango: ${fuera.map((m) => m.codigo).join(", ")}`)

// 7. Resumen por cuatrimestre
const porCuat = {}
for (const m of j.materias) {
  porCuat[m.cuatrimestre] ??= { n: 0, cr: 0 }
  porCuat[m.cuatrimestre].n++
  porCuat[m.cuatrimestre].cr += m.creditos
}
console.log("por cuatrimestre:")
for (const k of Object.keys(porCuat).sort((a, b) => a - b))
  console.log(`  cuat. ${k.padStart(2)}: ${String(porCuat[k].n).padStart(2)} materias, ${String(porCuat[k].cr).padStart(3)} creditos`)

console.log(errores ? `\n== BLOCKED (${errores}) ==` : "\n== PASS ==")
process.exit(errores ? 1 : 0)