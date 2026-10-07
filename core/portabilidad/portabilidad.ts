/**
 * core/portabilidad — progreso portable del estudiante.
 *
 * Progreso del usuario = localStorage + export/import + enlace en el fragmento
 * `#p=` de la URL (decision de proyecto). Aqui vive SOLO la logica pura: quien
 * toca localStorage o el hash es tools/portabilidad/, no este modulo.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento, sin Buffer, btoa ni
 *   crypto.subtle. base64url y FNV-1a se implementan a mano sobre los bytes
 *   UTF-8 del texto (regla 3 de AGENTS.md; core/tsconfig.json no incluye DOM).
 * - serializarProgreso es CANONICA: 2 espacios de sangria y claves ordenadas
 *   alfabeticamente a cualquier profundidad (por orden de codigo de caracter,
 *   nunca por locale: un checksum no puede depender del idioma de la maquina).
 *   Excluye `actualizadoEn` porque es mutable y el enlace no debe cambiar cada
 *   vez que se guarda.
 * - Toda entrada que viene de fuera (JSON) se valida en el borde y se rechaza
 *   con ProgresoInvalido y mensaje claro: nunca se devuelve un progreso a medias.
 */

/** Contrato compartido con tools/portabilidad/. NO cambia sin migracion. */
export interface MateriaRegistrada {
  nota: number
  creditos: number
  cuatrimestre: number
}

/** Contrato compartido con tools/portabilidad/. NO cambia sin migracion. */
export interface Progreso {
  schema: "ciberpensum/progreso"
  version: number
  universidadId: string
  slug: string
  /** Codigo de la materia -> registro. */
  aprobadas: Record<string, MateriaRegistrada>
  /** Codigos inscritos sin nota final. Opcional: no existia en la v1 inicial. */
  enCurso?: string[]
  /** ISO aaaa-mm-dd. Fuera del canonico y del checksum por ser mutable. */
  actualizadoEn: string
}

const SCHEMA_PROGRESO = "ciberpensum/progreso"

/** Error propio para todo lo que no sea un progreso valido. El tipo importa:
 *  la UI debe poder distinguir "datos corruptos" de un fallo inesperado. */
export class ProgresoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = "ProgresoInvalido"
  }
}

const esRegistro = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/** Describe un valor para mensajes de error SIN JSON.stringify: el valor puede
 *  venir de un llamante y ser circular, y un TypeError taparia el problema. */
const describir = (v: unknown): string => {
  if (typeof v === "string") return JSON.stringify(v)
  if (Array.isArray(v)) return "un array"
  if (typeof v === "object" && v !== null) return "un objeto"
  return String(v)
}

// ---------------------------------------------------------------------------
// Serializacion canonica
// ---------------------------------------------------------------------------

const INDENTACION = "  "

/**
 * Escribe cualquier valor como JSON con la sangria y el orden de claves
 * canonicos. Los escalares delegan en JSON.stringify para respetar al pie de
 * la letra sus reglas de escapado (comillas, controles, surrogados sueltos).
 */
const serializarCanonico = (v: unknown, nivel: number): string => {
  if (v === null) return "null"
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]"
    const elementos = v.map(
      (x) => INDENTACION.repeat(nivel + 1) + serializarCanonico(x, nivel + 1),
    )
    return "[\n" + elementos.join(",\n") + "\n" + INDENTACION.repeat(nivel) + "]"
  }
  if (esRegistro(v)) {
    // Las claves con valor ausente se omiten, igual que hace JSON.stringify.
    const claves = Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort() // orden de codigo de caracter: estable entre maquinas
    if (claves.length === 0) return "{}"
    const pares = claves.map(
      (k) =>
        INDENTACION.repeat(nivel + 1) +
        JSON.stringify(k) +
        ": " +
        serializarCanonico(v[k], nivel + 1),
    )
    return "{\n" + pares.join(",\n") + "\n" + INDENTACION.repeat(nivel) + "}"
  }
  // Escalar (string, numero, booleano; tambien el undefined de un array, que
  // JSON.stringify escribe como null).
  return JSON.stringify(v) ?? "null"
}

/**
 * Serializa el progreso de forma CANONICA: misma salida para los mismos datos,
 * sea cual sea el orden de las claves o la fecha de guardado.
 *
 * `actualizadoEn` queda fuera a proposito: el enlace y el checksum deben ser
 * estables entre repeticiones.
 */
export function serializarProgreso(p: Progreso): string {
  const contenido: Record<string, unknown> = {
    aprobadas: p.aprobadas,
    schema: p.schema,
    slug: p.slug,
    universidadId: p.universidadId,
    version: p.version,
  }
  if (p.enCurso !== undefined) contenido["enCurso"] = p.enCurso
  return serializarCanonico(contenido, 0)
}

// ---------------------------------------------------------------------------
// Parseo y validacion en el borde
// ---------------------------------------------------------------------------

const validarMateria = (codigo: string, valor: unknown): MateriaRegistrada => {
  if (!esRegistro(valor))
    throw new ProgresoInvalido(
      `aprobadas["${codigo}"]: debe ser un objeto con nota, creditos y cuatrimestre, llegó ${describir(valor)}`,
    )
  const { nota, creditos, cuatrimestre } = valor
  if (!esNumero(nota))
    throw new ProgresoInvalido(
      `aprobadas["${codigo}"].nota: debe ser un número, llegó ${describir(nota)}`,
    )
  if (!esNumero(creditos))
    throw new ProgresoInvalido(
      `aprobadas["${codigo}"].creditos: debe ser un número, llegó ${describir(creditos)}`,
    )
  if (!esNumero(cuatrimestre))
    throw new ProgresoInvalido(
      `aprobadas["${codigo}"].cuatrimestre: debe ser un número, llegó ${describir(cuatrimestre)}`,
    )
  return { nota, creditos, cuatrimestre }
}

/** Validacion estructural de un progreso ya parseado. Compartida por
 *  deserializarProgreso (borde de texto) y migrarProgreso (borde de JSON). */
const validarProgreso = (valor: unknown): Progreso => {
  if (!esRegistro(valor))
    throw new ProgresoInvalido(`el progreso debe ser un objeto JSON, llegó ${describir(valor)}`)

  const { schema, version, universidadId, slug, aprobadas, enCurso, actualizadoEn } = valor

  if (typeof schema !== "string" || schema !== SCHEMA_PROGRESO)
    throw new ProgresoInvalido(
      `schema incorrecto: se esperaba "${SCHEMA_PROGRESO}", llegó ${describir(schema)}`,
    )

  if (typeof version !== "number" || !Number.isInteger(version) || version < 0)
    throw new ProgresoInvalido(
      `version: debe ser un número entero mayor o igual a 0, llegó ${describir(version)}`,
    )

  if (typeof universidadId !== "string")
    throw new ProgresoInvalido(
      `universidadId: debe ser texto, llegó ${describir(universidadId)}`,
    )

  if (typeof slug !== "string") throw new ProgresoInvalido(`slug: debe ser texto, llegó ${describir(slug)}`)

  if (!esRegistro(aprobadas))
    throw new ProgresoInvalido(
      `aprobadas: debe ser un objeto de materias por código, llegó ${describir(aprobadas)}`,
    )
  const materias: Record<string, MateriaRegistrada> = {}
  for (const codigo of Object.keys(aprobadas).sort()) {
    materias[codigo] = validarMateria(codigo, aprobadas[codigo])
  }

  // enCurso es opcional: ausente = no existe; presente debe ser lista de textos.
  let listaEnCurso: string[] | undefined
  if (enCurso !== undefined) {
    if (!Array.isArray(enCurso))
      throw new ProgresoInvalido(`enCurso: debe ser una lista de códigos, llegó ${describir(enCurso)}`)
    listaEnCurso = []
    for (const item of enCurso) {
      if (typeof item !== "string")
        throw new ProgresoInvalido(
          `enCurso: cada código debe ser texto, llegó ${describir(item)}`,
        )
      listaEnCurso.push(item)
    }
  }

  // actualizadoEn ausente (pasa al round-trip del canonico, que la excluye):
  // se deja vacio. Inventar la fecha de hoy seria inventar un dato.
  let fecha = ""
  if (actualizadoEn !== undefined) {
    if (typeof actualizadoEn !== "string")
      throw new ProgresoInvalido(
        `actualizadoEn: debe ser texto ISO aaaa-mm-dd, llegó ${describir(actualizadoEn)}`,
      )
    fecha = actualizadoEn
  }

  const progreso: Progreso = {
    schema: SCHEMA_PROGRESO,
    version,
    universidadId,
    slug,
    aprobadas: materias,
    actualizadoEn: fecha,
  }
  if (listaEnCurso !== undefined) progreso.enCurso = listaEnCurso
  return progreso
}

/**
 * Parsea y valida un progreso en texto. Lanza ProgresoInvalido con mensaje
 * claro ante JSON roto o estructura equivocada: nunca devuelve nada a medias.
 *
 * Nota: los campos que no forman parte del contrato se ignoran (no rompen la
 * lectura); la fuente de verdad de este formato son los campos del contrato.
 */
export function deserializarProgreso(texto: string): Progreso {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    throw new ProgresoInvalido(`el texto no es JSON válido: ${detalle}`)
  }
  return validarProgreso(bruto)
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

/** Bytes UTF-8 del texto, escrito a mano (sin TextEncoder: no esta en lib ES2022).
 *  Un sustituto aislado se codifica como U+FFFD, igual que TextEncoder/Buffer. */
const bytesUtf8 = (texto: string): number[] => {
  const bytes: number[] = []
  let i = 0
  while (i < texto.length) {
    let cp = texto.charCodeAt(i)
    i += 1
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const siguiente = i < texto.length ? texto.charCodeAt(i) : -1
      if (siguiente >= 0xdc00 && siguiente <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (siguiente - 0xdc00)
        i += 1
      } else {
        cp = 0xfffd
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd
    }
    if (cp < 0x80) {
      bytes.push(cp)
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      )
    }
  }
  return bytes
}

/**
 * FNV-1a de 32 bits sobre la serializacion canonica, en hex minuscula de 8
 * digitos. Es solo un sello de integridad para comparar dos progresos de un vistazo,
 * NO un MAC: nadie debe guardar nada sensible pensando que esto lo protege.
 *
 * El texto se hashea por bytes UTF-8 para que el mismo progreso de la misma
 * huella en cualquier maquina.
 */
export function checksum(p: Progreso): string {
  let hash = 0x811c9dc5 // basis FNV-1a de 32 bits
  for (const byte of bytesUtf8(serializarProgreso(p))) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) // primo FNV de 32 bits
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

// ---------------------------------------------------------------------------
// Enlace portable
// ---------------------------------------------------------------------------

const ABECEDARIO_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const letraBase64 = (indice: number): string => ABECEDARIO_BASE64.charAt(indice)

/**
 * base64url escrito a mano: abecedario propio sobre los bytes UTF-8, luego
 * `+` -> `-`, `/` -> `_` y sin relleno `=`. Sin Buffer, sin btoa: core/ no
 * puede (ni debe) depender del entorno.
 */
export function codificarBase64Url(texto: string): string {
  const bytes = bytesUtf8(texto)
  let salida = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1] ?? 0
    const b2 = bytes[i + 2] ?? 0
    const triple = (b0 << 16) | (b1 << 8) | b2
    salida += letraBase64((triple >> 18) & 63)
    salida += letraBase64((triple >> 12) & 63)
    salida += bytes[i + 1] === undefined ? "=" : letraBase64((triple >> 6) & 63)
    salida += bytes[i + 2] === undefined ? "=" : letraBase64(triple & 63)
  }
  return salida.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Enlace portable para compartir o guardar: `#p=` + base64url de
 * `vi|universidad|slug|checksum`. El checksum es el del progreso canonico
 * (sin actualizadoEn), asi que el enlace solo cambia cuando cambia de verdad
 * el progreso, no cada vez que se guarda.
 *
 * El fragmento no viaja al servidor: quien recibe el enlace reconstruye el
 * progreso con el mismo esquema (tools/portabilidad/).
 */
export function enlacePensum(p: Progreso): string {
  const carga = "vi|" + p.universidadId + "|" + p.slug + "|" + checksum(p)
  return "#p=" + codificarBase64Url(carga)
}

// ---------------------------------------------------------------------------
// Enlace con el progreso completo (#p= que transporta los DATOS)
// ---------------------------------------------------------------------------
//
// enlacePensum lleva un SELLO (vi|uni|slug|checksum) y nada mas: quien recibe
// ese enlace reconstruye el progreso con el mismo esquema. Este otro enlace
// lleva los datos dentro, para que el avance del estudiante sobreviva a
// compartir la URL sin backend y sin cuenta:
//
//   #p= base64url( checksum + "|" + serializarProgreso(p) )
//
// El sello va PRIMERO para verificar la integridad antes de fiarse del
// contenido, y el canonico es exactamente el texto sobre el que checksum ya
// calcula, asi que validar el enlace es recalcular y comparar.

/** Byte de reemplazo ante UTF-8 invalido: U+FFFD, igual que en la codificacion. */
const REEMPLAZO_UTF8 = "\uFFFD"

/**
 * Bytes UTF-8 -> texto, escrito a mano (sin TextDecoder: tampoco esta en lib
 * ES2022). Una secuencia cortada, un byte sin cabeza o fuera de rango
 * (sobre-largo, surrogado suelto, mas alla de U+10FFFF) se sustituye por
 * U+FFFD: la misma frontera que aplica el codificador al reves.
 */
const textoDesdeBytesUtf8 = (bytes: number[]): string => {
  let salida = ""
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]
    // Inalcanzable con i < bytes.length: lo pide noUncheckedIndexedAccess.
    if (b0 === undefined) break

    let cp = 0
    let largo = 0
    let minimo = 0
    if (b0 < 0x80) {
      cp = b0
      largo = 1
      minimo = 0
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      cp = b0 & 0x1f
      largo = 2
      minimo = 0x80
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      cp = b0 & 0x0f
      largo = 3
      minimo = 0x800
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      cp = b0 & 0x07
      largo = 4
      minimo = 0x10000
    } else {
      // 0x80..0xbf sin byte de cabeza, 0xc0/0xc1 (sobre-largos) y 0xf5..0xff.
      salida += REEMPLAZO_UTF8
      i += 1
      continue
    }

    let cortada = false
    for (let k = 1; k < largo; k++) {
      const bk = bytes[i + k]
      if (bk === undefined || (bk & 0xc0) !== 0x80) {
        cortada = true
        break
      }
      cp = (cp << 6) | (bk & 0x3f)
    }
    // Secuencia cortada: un solo U+FFFD y se avanza UN byte, para que el resto
    // (tambien el byte que rompio la secuencia) se examine por su cuenta.
    if (cortada) {
      salida += REEMPLAZO_UTF8
      i += 1
      continue
    }
    // Sobre-largo (cp < minimo), surrogado suelto o fuera del rango Unicode.
    if (cp < minimo || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      salida += REEMPLAZO_UTF8
      i += 1
      continue
    }
    salida += String.fromCodePoint(cp)
    i += largo
  }
  return salida
}

/**
 * Inverso exacto de codificarBase64Url: devuelve el texto UTF-8 original.
 *
 * Tolerante a las variantes `-`/`_` del abecedario base64url y al relleno `=`
 * del final, que este modulo no escribe pero otros generadores si. Cualquier
 * otro carácter, o una longitud que no llega a formar un byte, es
 * ProgresoInvalido: nunca se devuelve texto basura a medias.
 */
export function decodificarBase64Url(texto: string): string {
  const normalizado = texto.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "")
  const bytes: number[] = []
  let acumulado = 0
  let bits = 0
  for (let i = 0; i < normalizado.length; i++) {
    const letra = normalizado.charAt(i)
    const posicion = ABECEDARIO_BASE64.indexOf(letra)
    if (posicion < 0)
      throw new ProgresoInvalido(
        `decodificarBase64Url: «${letra}» no es un carácter de base64url (posición ${i})`,
      )
    acumulado = (acumulado << 6) | posicion
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acumulado >> bits) & 0xff)
    }
  }
  // bits === 6 (longitud % 4 === 1): sobra un carácter suelto, no alcanza para un byte.
  if (bits === 6)
    throw new ProgresoInvalido(
      `decodificarBase64Url: longitud ${texto.length}: un carácter suelto no puede formar un byte`,
    )
  return textoDesdeBytesUtf8(bytes)
}

/**
 * Enlace que lleva los DATOS: `#p=` + base64url de `checksum|canonico`.
 *
 * El sello va primero para verificar la integridad al importar, y el canonico
 * es `serializarProgreso(p)`, el mismo texto sobre el que checksum calcula.
 * Como el canonico excluye `actualizadoEn`, dos guardados del mismo progreso
 * dan exactamente el mismo enlace: la fecha no lo hace cambiar cada vez.
 */
export function enlaceProgreso(p: Progreso): string {
  const carga = checksum(p) + "|" + serializarProgreso(p)
  return "#p=" + codificarBase64Url(carga)
}

/** Sello esperado: FNV-1a en hex minuscula de 8 digitos (ver checksum). */
const FORMATO_SELLO = /^[0-9a-f]{8}$/

/**
 * Recupera el Progreso del fragmento `#p=...` (con o sin `#p=` al principio).
 *
 * Valida en este orden, porque cada paso supone el anterior:
 *  1. FORMO — el payload es base64url y su texto es `checksum|canonico`.
 *  2. PROGRESO — el canonico parsea como Progreso (schema, notas, fechas...).
 *  3. CHECKSUM — el sello declara cuadra con el canonico ya parseado.
 *
 * Toda desviacion es ProgresoInvalido con un mensaje que dice cual de los tres
 * fallo: nunca se devuelve un progreso a medias ni se fia del contenido sin
 * haber cuadrado el sello.
 */
export function progresoDesdeEnlace(fragmento: string): Progreso {
  if (typeof fragmento !== "string")
    throw new ProgresoInvalido(
      `el fragmento del enlace debe ser texto, llegó ${describir(fragmento)}`,
    )

  const carga = fragmento.startsWith("#p=") ? fragmento.slice(3) : fragmento
  const texto = decodificarBase64Url(carga) // ya lanza ProgresoInvalido si el base64url esta roto

  const corte = texto.indexOf("|")
  if (corte < 0)
    throw new ProgresoInvalido(
      `el enlace no tiene el formato «checksum|canonico»: falta «|» en ${JSON.stringify(texto)}`,
    )

  const sello = texto.slice(0, corte)
  if (!FORMATO_SELLO.test(sello))
    throw new ProgresoInvalido(
      `el enlace no tiene el formato «checksum|canonico»: «${sello}» no es un checksum de 8 hexadecimales`,
    )

  const canonico = texto.slice(corte + 1)
  let p: Progreso
  try {
    p = deserializarProgreso(canonico)
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    throw new ProgresoInvalido(`el enlace trae un progreso inválido: ${detalle}`)
  }

  const calculado = checksum(p)
  if (calculado !== sello)
    throw new ProgresoInvalido(
      `el checksum no cuadra: el enlace declara «${sello}» y su contenido da «${calculado}»`,
    )
  return p
}

// ---------------------------------------------------------------------------
// Resumen para la UI
// ---------------------------------------------------------------------------

/**
 * Resumen que muestra la UI: conteo de aprobadas, creditos acumulados, indice
 * ponderado por creditos (misma formula que core/indice, calculada aqui para
 * que portabilidad no dependa de otro modulo) y el cuatrimestre mas alto con
 * algo cursado.
 *
 * `enCurso` no aporta creditos ni indice (aun no hay nota final) y tampoco
 * cuatrimestre: el contrato guarda solo el codigo, sin su cuatrimestre.
 * Sin creditos el indice es 0, nunca NaN.
 */
export function resumenProgreso(p: Progreso): {
  aprobadas: number
  creditos: number
  indice: number
  cuatrimestreActual: number
} {
  let total = 0
  let creditos = 0
  let sumaPonderada = 0
  let cuatrimestreActual = 0
  for (const m of Object.values(p.aprobadas)) {
    total += 1
    creditos += m.creditos
    sumaPonderada += m.nota * m.creditos
    if (m.cuatrimestre > cuatrimestreActual) cuatrimestreActual = m.cuatrimestre
  }
  return {
    aprobadas: total,
    creditos,
    indice: creditos === 0 ? 0 : sumaPonderada / creditos,
    cuatrimestreActual,
  }
}

// ---------------------------------------------------------------------------
// Migraciones de version
// ---------------------------------------------------------------------------

type Migracion = (p: Progreso) => Progreso

/**
 * Cadena de migraciones: MIGRACIONES[n] lleva de la version n a la n+1.
 *
 * Hoy esta VACIA: solo existe el formato actual. Cuando exista v2 se anade aqui
 * el paso `1: (p) => ({ ...p, ...camposNuevos, version: 2 })` y migrarProgreso
 * empieza a encadenarlos sin tocar su logica.
 */
const MIGRACIONES: Readonly<Record<number, Migracion>> = {}

/**
 * Migra un progreso en JSON crudo hasta `versionActual` (la version mas
 * reciente soportada por el codigo que llama).
 *
 * Conservador ante la duda: si falta un eslabon de la cadena o el progreso es
 * mas nuevo que el soportado, se rechaza con ProgresoInvalido en vez de
 * devolver una version que no corresponde. Nadie migra hacia atras.
 */
export function migrarProgreso(json: unknown, versionActual: number): Progreso {
  let progreso = validarProgreso(json)
  let version = progreso.version

  if (version > versionActual)
    throw new ProgresoInvalido(
      `el progreso es de la versión ${version} pero solo se soporta hasta la ${versionActual}: no se migra hacia atrás`,
    )

  while (version < versionActual) {
    const migracion = MIGRACIONES[version]
    if (migracion === undefined)
      throw new ProgresoInvalido(
        `falta la migración de la versión ${version} a la ${version + 1}: la cadena de migraciones está vacía`,
      )
    progreso = migracion(progreso)
    version += 1
    if (progreso.version !== version)
      throw new ProgresoInvalido(
        `la migración de la versión ${version - 1} dejó el progreso en la versión ${progreso.version}, se esperaba ${version}`,
      )
  }

  return progreso
}
