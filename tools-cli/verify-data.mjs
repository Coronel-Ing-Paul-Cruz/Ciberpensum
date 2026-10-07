// verify-data.mjs — integridad de data/curated/*.json (gate, chequeo 2).
// Cada pensum curado debe: parsear, cumplir el schema, tener trazabilidad y
// grafo de prerrequisitos aciclico y resoluble.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
let errores = 0
const ok = (m) => console.log("  ok  " + m)
const mal = (m) => { console.log(" FAIL " + m); errores++ }

console.log("== ciberpensum · verify:data ==")

const dir = join(ROOT, "data", "curated")
// Busca JSON recursivamente: con subcarpetas por universidad (unicaribe/...),
// un early-exit por "solo hay directorios" daria verde falso sin validar nada.
const hayJsonBajo = (d) =>
  readdirSync(d, { withFileTypes: true }).some((e) =>
    e.isDirectory() ? hayJsonBajo(join(d, e.name)) : e.name.endsWith(".json"))
if (!existsSync(dir) || !hayJsonBajo(dir)) {
  ok("sin carreras curadas todavía (fase 0)"); process.exit(0)
}

// Schema unico para toda la curaduria.
let schema, validar
try {
  schema = JSON.parse(readFileSync(join(ROOT, "data", "schema", "pensum.schema.json"), "utf8"))
  validar = new (require("ajv"))({ allErrors: true, strict: false }).compile(schema)
} catch (e) {
  mal("no se pudo cargar data/schema/pensum.schema.json o ajv: " + e.message)
  console.log(`\n== BLOCKED (${errores}) ==`); process.exit(1)
}

for (const uni of readdirSync(dir)) {
  const uniDir = join(dir, uni)
  if (!statSync(uniDir).isDirectory()) continue
  for (const f of readdirSync(uniDir).filter((x) => x.endsWith(".json"))) {
    const p = join(uniDir, f)
    const tag = `${uni}/${f}`
    let j
    try { j = JSON.parse(readFileSync(p, "utf8")) } catch (e) { mal(`${tag}: JSON inválido`); continue }
    j.carrera ? ok(`${tag}: carrera`) : mal(`${tag}: falta carrera`)
    j.version ? ok(`${tag}: version "${j.version}"`) : mal(`${tag}: falta version`)
    j.fuente?.url && j.fuente?.sha256 && j.fuente?.verificadoEn
      ? ok(`${tag}: fuente+sha256+fecha`)
      : mal(`${tag}: trazabilidad incompleta (url/sha256/verificadoEn)`)

    // Schema completo (estructura, tipos, campos obligatorios).
    if (validar(j)) {
      ok(`${tag}: schema cumplido`)
    } else {
      // Solo los primeros errores: una lista de 40 no ayuda a nadie.
      const cortos = validar.errors.slice(0, 8).map((e) => `${e.instancePath || "(raiz)"} ${e.message}`)
      mal(`${tag}: schema -> ${cortos.join("; ")}`)
    }

    if (Array.isArray(j.materias)) {
      // DAG: codigos que existen y sin ciclos.
      const codigos = new Set(j.materias.map((m) => m.codigo))
      if (codigos.size !== j.materias.length) mal(`${tag}: codigos duplicados`)
      for (const m of j.materias)
        for (const pre of m.prerequisitos ?? [])
          codigos.has(pre) || mal(`${tag}: ${m.codigo} pide ${pre} que no existe en la carrera`)

      const color = new Map(j.materias.map((m) => [m.codigo, 0])) // 0 blanco, 1 gris, 2 negro
      const pila = new Set()
      const ciclo = (() => {
        const visitar = (c) => {
          if (color.get(c) === 2) return null
          if (pila.has(c)) return c
          color.set(c, 1); pila.add(c)
          const m = j.materias.find((x) => x.codigo === c)
          for (const p of m?.prerequisitos ?? []) {
            const r = visitar(p)
            if (r) return r
          }
          pila.delete(c); color.set(c, 2)
          return null
        }
        for (const m of j.materias) { const r = visitar(m.codigo); if (r) return r }
        return null
      })()
      ciclo ? mal(`${tag}: ciclo de prerrequisitos en ${ciclo}`) : ok(`${tag}: prerrequisitos aciclicos`)

      // Orden curatorial: materias agrupadas por cuatrimestre ascendente.
      // La UI (malla y cuaderno) muestra EXACTAMENTE este orden, que es el del
      // pensum oficial; si el curador rompe la agrupacion, la pagina se desordena.
      let prevCuat = 0
      const desorden = []
      for (let i = 0; i < j.materias.length; i++) {
        const c = j.materias[i].cuatrimestre ?? 0
        if (c < prevCuat) desorden.push(`${j.materias[i].codigo}@cuat${c}`)
        prevCuat = c
      }
      desorden.length
        ? mal(`${tag}: materias fuera de orden de cuatrimestre -> ${desorden.join(", ")}`)
        : ok(`${tag}: materias en orden de cuatrimestre (orden del pensum)`)
    }

    // Totales declarados vs reales (si el curador declaro totales).
    if (j.totales && Array.isArray(j.materias)) {
      const cr = j.materias.reduce((a, m) => a + (m.creditos ?? 0), 0)
      j.totales.asignaturas === j.materias.length ? ok(`${tag}: totales.asignaturas ok`) : mal(`${tag}: totales.asignaturas ${j.totales.asignaturas} != ${j.materias.length}`)
      j.totales.creditos === cr ? ok(`${tag}: totales.creditos ok`) : mal(`${tag}: totales.creditos ${j.totales.creditos} != ${cr}`)
    }
  }
}

console.log(errores ? `\n== BLOCKED (${errores}) ==` : "\n== PASS ==")
process.exit(errores ? 1 : 0)