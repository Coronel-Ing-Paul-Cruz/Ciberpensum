#!/usr/bin/env node
/**
 * tools-cli/ensamblar-curaduria.mjs — ensamblador DETERMINISTA de pensums.
 *
 * El bug del curador (2026-10-08, APRENDIZAJES.md) era procesar el PDF crudo
 * linea a linea hasta saturar el contexto y morir sin entregable. Este script
 * hace TODO lo mecanico: parsea las lineas de data/interim (normalizando
 * codigos OCR con o sin guion: "ADM - 113" / "CON 1 2 8" / "SOC_131" ->
 * ADM-113 / CON-128 / SOC-131), extrae prerrequisitos y creditos, le aplica
 * las adiciones y sobreescrituras del fixup, y emite un DRAFT validado
 * (totales, codigos unicos, prerrequisitos conocidos). Al curador solo le
 * queda VALIDAR el draft contra el PDF y decidir las discrepancias reportadas.
 *
 * Uso:
 *   node tools-cli/ensamblar-curaduria.mjs \
 *     --materias data/interim/<uni>-<carrera>-materias.json \
 *     --lines data/interim/<uni>-<carrera>-lines.json \
 *     --adiciones data/interim/<uni>-<carrera>-adiciones.json \
 *     --universidad-id upid --universidad-nombre "..." \
 *     --carrera "..." --slug ... --grado grado --version 2018 \
 *     --periodos 11 --tipo-periodo periodo \
 *     --totales-asignaturas 56 --totales-creditos 172 \
 *     --escala '{"base":4,"minimo":0,"maximo":100,"aprobacion":70,"formaIndice":"ponderado-por-creditos"}' \
 *     --fuente-url "...pdf" --sha256 ... --verificado-en 2026-10-07 --archivo ... \
 *     --out data/interim/<uni>-<slug>.draft.json
 */
import { readFileSync, writeFileSync } from "node:fs"

function arg(name, req = true) {
  // Defensivo: normaliza guiones a proposito. El primer uso destapo que los
  // call sites pasaban "--x" y la funcion antepone "--" -> "----x" (bug
  // 2026-10-08; ver APRENDIZAJES.md). "x" y "--x" ahora funcionan igual.
  const clave = `--${name.replace(/^-+/, "")}`
  const i = process.argv.indexOf(clave)
  if (i === -1 || !process.argv[i + 1]) {
    if (req) throw new Error(`falta ${clave}`)
    return undefined
  }
  return process.argv[i + 1]
}
function leerJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new Error(`no pude leer ${path}: ${e.message}`)
  }
}

/**
 * Normaliza las claves de una linea a XXXX-NNN. Devuelve { clave, fin } para
 * cada una: `fin` es el indice del primer token despues de la clave (donde
 * empieza el nombre de la materia). Maneja el formato real del texto UPID:
 *   "ADM - 113"  "MAT 132"  "CON - 14 0"  "EST - 2 4 9"  "INF - 1 29"
 * (guion suelto y digitos partidos entre tokens; el bug original solo leia
 * "ADM-113" contiguo y devolvia 9 claves de 56 materias — ver APRENDIZAJES).
 */
function normalizarClave(texto) {
  const trozos = texto.replace(/_/g, " ").split(/\s+/)
  const salidas = []
  for (let i = 0; i < trozos.length; i++) {
    const t = trozos[i].replace(/-/g, "")
    if (!/^[A-Z]{2,4}$/.test(t)) continue
    let digitos = ""
    let j = i + 1
    while (j < trozos.length && digitos.length < 3) {
      const t2 = trozos[j].replace(/-/g, "")
      if (/^\d+$/.test(t2)) { digitos += t2; j++; continue }
      if (t2 === "") { j++; continue } // separador "-" suelto
      break // un token de letras corta la clave (empieza nombre o sigue otra clave)
    }
    if (digitos.length >= 3) salidas.push({ clave: `${t}-${digitos.slice(0, 3)}`, fin: j })
  }
  // Claves fantasma: una palabra del NOMBRE (numeral romano "II"/"IV", siglas
  // "NICS", "REAL"...) coge la cola CR/HT/HP y sus digitos llegan al FIN de
  // linea (el while consume "3 2 2"). Un codigo real SIEMPRE termina en un
  // token de letras (el nombre o la siguiente clave). Si hay al menos una
  // clave valida, la fantasma se descarta; una linea que es SOLO codigo
  // (fragmento de fila) se conserva. Bug 2026-10-08 (UPID): "II 3 2 2"
  // generaba II-322 y tragaba el codigo real como prereq (IDI-251, CON-248,
  // CON-446, SOC-221 perdidos); ver APRENDIZAJES.md.
  const finLinea = trozos.length
  if (salidas.some((c) => c.fin < finLinea)) return salidas.filter((c) => c.fin < finLinea)
  return salidas
}

// --materias es un checkpoint informativo (la fuente de parseo es --lines);
// se lee si existe pero no condiciona la corrida.
const rutaMaterias = arg("materias", false)
const materias = rutaMaterias ? leerJSON(rutaMaterias) : []
const lines = leerJSON(arg("lines"))
const adiciones = arg("adiciones", false) ? leerJSON(arg("adiciones", false)) : null

// 1) Parseo de lineas: cada bloque PERIODO N; una linea es materia si tiene
//    clave; el codigo propio es la ULTIMA clave (las anteriores son prereqs).
//    El nombre empieza donde termina el propio (fin de la clave) y acaba en la
//    cola numerica CR/HT/HP. Las claves del header ("PRE - CLAVE ASIGNATURA
//    CR. HT. HP" / "REQUISITOS") no pasan el filtro (no tienen 3 digitos).
const sujetos = new Map()
let periodo = 0
for (const { s } of lines) {
  const m = s.match(/PERIODO\s+(\d+)/)
  if (m) { periodo = Number(m[1]); continue }
  const claves = normalizarClave(s)
  if (claves.length === 0) continue
  const propio = claves[claves.length - 1]
  const prereqs = claves.slice(0, -1).map((c) => c.clave)
  // nombre: tokens desde el fin del propio hasta el primer token numerico
  // (cola CR/HT/HP); ese primer numero es el CR (creditos de la materia).
  const tokens = s.replace(/_/g, " ").split(/\s+/)
  let nombre = ""
  let creditos = 0
  for (const t of tokens.slice(propio.fin)) {
    if (/^\d+$/.test(t)) { creditos = Number(t); break }
    nombre += (nombre ? " " : "") + t
  }
  const ant = sujetos.get(propio.clave)
  if (ant && ant.cuatrimestre === periodo) {
    // fila partida en dos lineas: se junta el nombre. El guard de bloque
    // (mismo cuatrimestre) evita el bug de la errata CON-392 (UPID): dos
    // materias DISTINTAS con el MISMO codigo impreso en periodos distintos
    // (INTERNA P9, FORENSE P10) NO son una fila partida.
    if (nombre && !ant.nombre.includes(nombre)) ant.nombre += " " + nombre
  } else if (!ant || !ant.nombre || nombre) {
    // Materia nueva, o fila MAS COMPLETA que la anterior. La segunda rama
    // impide que una fila degenerada pise a la completa (UPID P8 imprime
    // "CON - 388 3 2 2" sin nombre tras la fila real "CON - 388 AUDITORIA I"
    // de P7); la tercera deja que la FORENSE P10 pise a la INTERNA P9, y las
    // adiciones recuperan la que falte (CON-392F / CON-392).
    sujetos.set(propio.clave, {
      codigo: propio.clave,
      nombre: nombre.trim(),
      creditos,
      cuatrimestre: periodo,
      prerequisitos: prereqs,
    })
  }
}

// 2) Sobreescrituras PRIMERO, adiciones DESPUES: en la corrida del bug
//    CON-392 (UPID) el orden inverso pisaba lo parseado: al anadir
//    CON-392 (AUDITORIA INTERNA) la sobreescritura posterior de codigo
//    renombraba la materia EQUIVOCADA. Las sobreescrituras arreglan lo
//    parseado; las adiciones completan lo ausente del layer de texto (OCR).
if (adiciones) {
  for (const s of adiciones.sobreescribir ?? []) {
    const obj = sujetos.get(s.codigo)
    if (!obj) throw new Error(`sobreescribir: no existe ${s.codigo}`)
    obj[s.campo] = s.valor
    if (s.campo === "codigo") {
      sujetos.delete(s.codigo)
      sujetos.set(s.valor, obj)
    }
  }
  for (const a of adiciones.adiciones ?? []) sujetos.set(a.codigo, { ...a })
}

// 3) Metadatos + reglas
// --escala-file existe para Windows/PowerShell: las comillas dobles del JSON
// embebido en --escala se pierden al pasar argumentos a procesos nativos
// (PS 5.1 las come incluso entre comillas simples; ver APRENDIZAJES.md).
// Precedencia: archivo sobre inline.
const escalaPath = arg("escala-file", false)
const escala = escalaPath ? leerJSON(escalaPath) : JSON.parse(arg("escala"))
const fuentever = {
  url: arg("--fuente-url"),
  sha256: arg("--sha256"),
  verificadoEn: arg("--verificado-en"),
  archivo: arg("--archivo"),
}
const submit = [...sujetos.values()].sort(
  (a, b) => a.cuatrimestre - b.cuatrimestre || (a.codigo < b.codigo ? -1 : 1),
)
const draft = {
  carrera: arg("--carrera"),
  slug: arg("--slug"),
  universidad: { id: arg("--universidad-id"), nombre: arg("--universidad-nombre") },
  grado: arg("--grado"),
  version: arg("--version"),
  vigente: true,
  duracion: { periodos: Number(arg("--periodos")), tipoPeriodo: arg("--tipo-periodo") },
  totales: { asignaturas: Number(arg("--totales-asignaturas")), creditos: Number(arg("--totales-creditos")) },
  materias: submit,
  reglas: { escala, honores: [], fuente: fuentever },
  notas: [],
  fuente: fuentever,
}
writeFileSync(arg("--out"), JSON.stringify(draft, null, 2) + "\n")

// 4) Reporte de discrepancias (el unico lugar donde el dato queda NO VERIFICADO)
const reales = submit.length
const crs = submit.reduce((a, m) => a + m.creditos, 0)
const cod = new Set(submit.map((m) => m.codigo))
const desconocidas = new Set(
  submit.flatMap((m) => m.prerequisitos ?? []).filter((c) => !sujetos.has(c)),
)
console.log(`[ensamblar] ${reales} materias (declaradas ${draft.totales.asignaturas}) · ${crs} creditos (declarados ${draft.totales.creditos})`)
if (reales !== draft.totales.asignaturas) console.log(`DIVERGENCIA: materias ${reales} != declaradas ${draft.totales.asignaturas} -> NO VERIFICADO`)
if (crs !== draft.totales.creditos) console.log(`DIVERGENCIA: creditos ${crs} != declarados ${draft.totales.creditos} -> NO VERIFICADO`)
if (cod.size !== reales) console.log("DIVERGENCIA: codigos duplicados en el draft")
if (desconocidas.size) console.log(`NOTA: prerrequisitos a codigos ausentes del pensum: ${[...desconocidas].join(", ")} (errata de la fuente, revisar)`)
console.log(`[ensamblar] OK: draft escrito en ${arg("--out")}`)