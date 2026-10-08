/**
 * core/datos — carga y validacion de un pensum en runtime.
 *
 * Duplica INTENCIONALMENTE lo que el gate valida con ajv
 * (tools-cli/verify-data.mjs) para que el navegador valide sin dependencias:
 * un sitio estatico y ligero no se trae ajv en el bundle. Por eso los chequeos
 * van alineados con data/schema/pensum.schema.json — si el schema cambia, esto
 * cambia con el. No se usa ajv aqui.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento (regla 3 de AGENTS.md). El dato
 *   llega ya parseado: validarPensum(unknown) y parsearPensum(texto) no tocan
 *   ni window ni fetch. Las unicas dependencias son TS y el propio runtime.
 * - Errores en lenguaje humano y con ruta ("materias[3].creditos debe ser un
 *   número"): nada de json-schema-speak.
 * - Decisiones conservadoras, alineadas con el gate:
 *   * El schema permite que "prerequisitos" falte en una materia (no esta en
 *     `required`); aqui se normaliza a [] para cumplir el tipo del contrato.
 *   * "additionalProperties": false solo existe en el schema para la raiz, los
 *     items de materias y las fuentes (draft-07: el resto acepta campos extra);
 *     aqui se rechazan campos desconocidos en esos tres sitios y solo en esos.
 *   * La comprobacion de URI es deliberadamente laxa (esquema "algo:" sin
 *     espacios): ajv-formats acepta urn:... y no merece la pena copiar un RFC.
 */

/** Una asignatura del pensum, tal como sale de data/curated/. */
export interface Asignatura {
  codigo: string
  nombre: string
  creditos: number
  cuatrimestre: number
  prerequisitos: string[]
  desdeCuatrimestre?: number
  requiereTodas?: boolean
  observaciones?: string
}

/** Procedencia de un dato curado: todo numero sale de un PDF oficial. */
export interface Fuente {
  url: string
  sha256: string
  verificadoEn: string
  archivo?: string
}

/** Pensum curado validado: refleja data/schema/pensum.schema.json campo a campo. */
export interface Pensum {
  carrera: string
  slug: string
  grado: "grado" | "postgrado"
  version: string
  vigente: boolean
  universidad: { id: string; nombre: string }
  duracion: { periodos: number; tipoPeriodo: "cuatrimestre" | "semestre" | "trimestre" | "periodo" }
  totales: { asignaturas: number; creditos: number }
  materias: Asignatura[]
  reglas: {
    escala: {
      base: number
      minimo: number
      maximo: number
      aprobacion: number
      formaIndice: "ponderado-por-creditos" | "simple" | "no-verificado"
    }
    honores?: Array<{ grado: string; min: number; max: number; fuente: Fuente }>
    requisitosHonores?: { sinReprobaciones?: boolean; exclusiones?: string[] }
    fuente: Fuente
  }
  fuente: Fuente
  notas?: string[]
}

type TipoPeriodo = "cuatrimestre" | "semestre" | "trimestre" | "periodo"
type GradoPrograma = "grado" | "postgrado"
type FormaIndice = "ponderado-por-creditos" | "simple" | "no-verificado"
type GradoHonor = "cum-laude" | "magna-cum-laude" | "summa-cum-laude" | "cuadro-de-honor" | "otros"
type ReglasPensum = {
  escala: { base: number; minimo: number; maximo: number; aprobacion: number; formaIndice: FormaIndice }
  honores?: Array<{ grado: GradoHonor; min: number; max: number; fuente: Fuente }>
  requisitosHonores?: { sinReprobaciones?: boolean; exclusiones?: string[] }
  fuente: Fuente
}

const RX_ID_SLUG = /^[a-z0-9-]+$/
const RX_CODIGO = /^[A-Z0-9-]{3,12}$/
const RX_SHA256 = /^[a-f0-9]{64}$/
const RX_FECHA = /^\d{4}-\d{2}-\d{2}$/
// Laxa a proposito: basta un esquema "algo:" sin espacios (ver cabecera).
const RX_URI = /^[a-zA-Z][a-zA-Z0-9+.-]*:\S*$/

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x)
const esString = (x: unknown): x is string => typeof x === "string"
const esNumero = (x: unknown): x is number => typeof x === "number"
const esBooleano = (x: unknown): x is boolean => typeof x === "boolean"
const esGrado = (x: unknown): x is GradoPrograma => x === "grado" || x === "postgrado"
const esTipoPeriodo = (x: unknown): x is TipoPeriodo =>
  x === "cuatrimestre" || x === "semestre" || x === "trimestre" || x === "periodo"
const esFormaIndice = (x: unknown): x is FormaIndice =>
  x === "ponderado-por-creditos" || x === "simple" || x === "no-verificado"
const esGradoHonor = (x: unknown): x is GradoHonor =>
  x === "cum-laude" || x === "magna-cum-laude" || x === "summa-cum-laude" ||
  x === "cuadro-de-honor" || x === "otros"

function rechazarCamposDesconocidos(
  d: Record<string, unknown>,
  permitidos: readonly string[],
  ruta: string,
  errores: string[],
): void {
  for (const clave of Object.keys(d)) {
    if (!permitidos.includes(clave)) {
      errores.push(`${ruta} tiene un campo desconocido: ${clave}`)
    }
  }
}

function validarFuente(d: unknown, ruta: string, errores: string[]): Fuente | null {
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }
  rechazarCamposDesconocidos(d, ["url", "sha256", "verificadoEn", "archivo"], ruta, errores)

  let url = ""
  const urlV = d["url"]
  if (urlV === undefined) errores.push(`${ruta}.url es obligatoria`)
  else if (!esString(urlV) || !RX_URI.test(urlV)) errores.push(`${ruta}.url no parece una URI válida`)
  else url = urlV

  let sha256 = ""
  const shaV = d["sha256"]
  if (shaV === undefined) errores.push(`${ruta}.sha256 es obligatorio`)
  else if (!esString(shaV) || !RX_SHA256.test(shaV)) {
    errores.push(`${ruta}.sha256 debe ser un hash de 64 caracteres hexadecimales en minúsculas`)
  } else sha256 = shaV

  let verificadoEn = ""
  const fechaV = d["verificadoEn"]
  if (fechaV === undefined) errores.push(`${ruta}.verificadoEn es obligatorio`)
  else if (!esString(fechaV) || !RX_FECHA.test(fechaV)) errores.push(`${ruta}.verificadoEn debe ser una fecha ISO aaaa-mm-dd`)
  else verificadoEn = fechaV

  let archivo: string | undefined
  const archivoV = d["archivo"]
  if (archivoV !== undefined) {
    if (!esString(archivoV)) errores.push(`${ruta}.archivo debe ser un string`)
    else archivo = archivoV
  }

  if (errores.length > antes) return null
  return { url, sha256, verificadoEn, ...(archivo !== undefined ? { archivo } : {}) }
}

function validarMateria(d: unknown, i: number, errores: string[]): Asignatura | null {
  const ruta = `materias[${i}]`
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }
  rechazarCamposDesconocidos(
    d,
    ["codigo", "nombre", "creditos", "cuatrimestre", "prerequisitos", "desdeCuatrimestre", "requiereTodas", "observaciones"],
    ruta,
    errores,
  )

  let codigo = ""
  const codigoV = d["codigo"]
  if (codigoV === undefined) errores.push(`${ruta}.codigo es obligatorio`)
  else if (!esString(codigoV) || !RX_CODIGO.test(codigoV)) {
    errores.push(`${ruta}.codigo debe tener entre 3 y 12 caracteres (solo letras mayúsculas, números y guiones)`)
  } else codigo = codigoV

  let nombre = ""
  const nombreV = d["nombre"]
  if (nombreV === undefined) errores.push(`${ruta}.nombre es obligatorio`)
  else if (!esString(nombreV)) errores.push(`${ruta}.nombre debe ser un string`)
  else if (nombreV.length < 2) errores.push(`${ruta}.nombre debe tener al menos 2 caracteres`)
  else nombre = nombreV

  let creditos = 0
  const creditosV = d["creditos"]
  if (creditosV === undefined) errores.push(`${ruta}.creditos es obligatorio`)
  else if (!esNumero(creditosV)) errores.push(`${ruta}.creditos debe ser un número`)
  else if (!Number.isInteger(creditosV)) errores.push(`${ruta}.creditos debe ser un número entero`)
  else if (creditosV < 0) errores.push(`${ruta}.creditos debe ser mayor o igual a 0`)
  else creditos = creditosV

  let cuatrimestre = 0
  const cuatV = d["cuatrimestre"]
  if (cuatV === undefined) errores.push(`${ruta}.cuatrimestre es obligatorio`)
  else if (!esNumero(cuatV)) errores.push(`${ruta}.cuatrimestre debe ser un número`)
  else if (!Number.isInteger(cuatV)) errores.push(`${ruta}.cuatrimestre debe ser un número entero`)
  else if (cuatV < 1) errores.push(`${ruta}.cuatrimestre debe ser mayor o igual a 1`)
  else cuatrimestre = cuatV

  // El schema no exige prerequisitos; si faltan, aqui se normalizan a [].
  let prerequisitos: string[] = []
  const preV = d["prerequisitos"]
  if (preV !== undefined) {
    if (!Array.isArray(preV)) {
      errores.push(`${ruta}.prerequisitos debe ser un array de strings`)
    } else {
      const limpio: string[] = []
      let valido = true
      for (const [j, item] of preV.entries()) {
        if (esString(item)) limpio.push(item)
        else {
          errores.push(`${ruta}.prerequisitos[${j}] debe ser un string`)
          valido = false
        }
      }
      if (valido) prerequisitos = limpio
    }
  }

  let desdeCuatrimestre: number | undefined
  const desdeV = d["desdeCuatrimestre"]
  if (desdeV !== undefined) {
    if (!esNumero(desdeV)) errores.push(`${ruta}.desdeCuatrimestre debe ser un número`)
    else if (!Number.isInteger(desdeV)) errores.push(`${ruta}.desdeCuatrimestre debe ser un número entero`)
    else if (desdeV < 1) errores.push(`${ruta}.desdeCuatrimestre debe ser mayor o igual a 1`)
    else desdeCuatrimestre = desdeV
  }

  let requiereTodas: boolean | undefined
  const reqV = d["requiereTodas"]
  if (reqV !== undefined) {
    if (!esBooleano(reqV)) errores.push(`${ruta}.requiereTodas debe ser un booleano`)
    else requiereTodas = reqV
  }

  let observaciones: string | undefined
  const obsV = d["observaciones"]
  if (obsV !== undefined) {
    if (!esString(obsV)) errores.push(`${ruta}.observaciones debe ser un string`)
    else observaciones = obsV
  }

  if (errores.length > antes) return null
  return {
    codigo,
    nombre,
    creditos,
    cuatrimestre,
    prerequisitos,
    ...(desdeCuatrimestre !== undefined ? { desdeCuatrimestre } : {}),
    ...(requiereTodas !== undefined ? { requiereTodas } : {}),
    ...(observaciones !== undefined ? { observaciones } : {}),
  }
}

function validarMaterias(d: unknown, errores: string[]): Asignatura[] | null {
  const antes = errores.length
  if (!Array.isArray(d)) {
    errores.push("pensum.materias debe ser un array")
    return null
  }
  if (d.length === 0) {
    errores.push("pensum.materias debe contener al menos una materia")
    return null
  }
  const materias: Asignatura[] = []
  for (const [i, item] of d.entries()) {
    const materia = validarMateria(item, i, errores)
    if (materia !== null) materias.push(materia)
  }
  if (errores.length > antes) return null
  return materias
}

function validarUniversidad(d: unknown, errores: string[]): { id: string; nombre: string } | null {
  const ruta = "pensum.universidad"
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }
  let id = ""
  const idV = d["id"]
  if (idV === undefined) errores.push(`${ruta}.id es obligatorio`)
  else if (!esString(idV) || !RX_ID_SLUG.test(idV)) errores.push(`${ruta}.id solo puede contener minúsculas, números y guiones`)
  else id = idV

  let nombre = ""
  const nombreV = d["nombre"]
  if (nombreV === undefined) errores.push(`${ruta}.nombre es obligatorio`)
  else if (!esString(nombreV)) errores.push(`${ruta}.nombre debe ser un string`)
  else nombre = nombreV

  if (errores.length > antes) return null
  return { id, nombre }
}

function validarDuracion(d: unknown, errores: string[]): { periodos: number; tipoPeriodo: TipoPeriodo } | null {
  const ruta = "pensum.duracion"
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }
  let periodos = 0
  const pV = d["periodos"]
  if (pV === undefined) errores.push(`${ruta}.periodos es obligatorio`)
  else if (!esNumero(pV)) errores.push(`${ruta}.periodos debe ser un número`)
  else if (!Number.isInteger(pV)) errores.push(`${ruta}.periodos debe ser un número entero`)
  else if (pV < 1) errores.push(`${ruta}.periodos debe ser mayor o igual a 1`)
  else periodos = pV

  let tipoPeriodo: TipoPeriodo = "cuatrimestre"
  const tpV = d["tipoPeriodo"]
  if (tpV === undefined) errores.push(`${ruta}.tipoPeriodo es obligatorio`)
  else if (!esTipoPeriodo(tpV)) {
    errores.push(`${ruta}.tipoPeriodo debe ser "cuatrimestre", "semestre", "trimestre" o "periodo"`)
  } else tipoPeriodo = tpV

  if (errores.length > antes) return null
  return { periodos, tipoPeriodo }
}

function validarTotales(d: unknown, errores: string[]): { asignaturas: number; creditos: number } | null {
  const ruta = "pensum.totales"
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }
  let asignaturas = 0
  const aV = d["asignaturas"]
  if (aV === undefined) errores.push(`${ruta}.asignaturas es obligatorio`)
  else if (!esNumero(aV)) errores.push(`${ruta}.asignaturas debe ser un número`)
  else if (!Number.isInteger(aV)) errores.push(`${ruta}.asignaturas debe ser un número entero`)
  else if (aV < 1) errores.push(`${ruta}.asignaturas debe ser mayor o igual a 1`)
  else asignaturas = aV

  let creditos = 0
  const cV = d["creditos"]
  if (cV === undefined) errores.push(`${ruta}.creditos es obligatorio`)
  else if (!esNumero(cV)) errores.push(`${ruta}.creditos debe ser un número`)
  else if (!Number.isInteger(cV)) errores.push(`${ruta}.creditos debe ser un número entero`)
  else if (cV < 1) errores.push(`${ruta}.creditos debe ser mayor o igual a 1`)
  else creditos = cV

  if (errores.length > antes) return null
  return { asignaturas, creditos }
}

function validarReglas(d: unknown, errores: string[]): ReglasPensum | null {
  const ruta = "pensum.reglas"
  const antes = errores.length
  if (!esObjeto(d)) {
    errores.push(`${ruta} debe ser un objeto`)
    return null
  }

  let escala: ReglasPensum["escala"] | null = null
  const escalaV = d["escala"]
  if (escalaV === undefined) errores.push(`${ruta}.escala es obligatoria`)
  else if (!esObjeto(escalaV)) errores.push(`${ruta}.escala debe ser un objeto`)
  else {
    const antesEscala = errores.length
    let base = 0
    const baseV = escalaV["base"]
    if (baseV === undefined) errores.push(`${ruta}.escala.base es obligatorio`)
    else if (!esNumero(baseV)) errores.push(`${ruta}.escala.base debe ser un número`)
    else base = baseV

    let minimo = 0
    const minV = escalaV["minimo"]
    if (minV === undefined) errores.push(`${ruta}.escala.minimo es obligatorio`)
    else if (!esNumero(minV)) errores.push(`${ruta}.escala.minimo debe ser un número`)
    else minimo = minV

    let maximo = 0
    const maxV = escalaV["maximo"]
    if (maxV === undefined) errores.push(`${ruta}.escala.maximo es obligatorio`)
    else if (!esNumero(maxV)) errores.push(`${ruta}.escala.maximo debe ser un número`)
    else maximo = maxV

    let aprobacion = 0
    const aprV = escalaV["aprobacion"]
    if (aprV === undefined) errores.push(`${ruta}.escala.aprobacion es obligatorio`)
    else if (!esNumero(aprV)) errores.push(`${ruta}.escala.aprobacion debe ser un número`)
    else aprobacion = aprV

    let formaIndice: FormaIndice = "no-verificado"
    const fiV = escalaV["formaIndice"]
    if (fiV === undefined) errores.push(`${ruta}.escala.formaIndice es obligatorio`)
    else if (!esFormaIndice(fiV)) {
      errores.push(`${ruta}.escala.formaIndice debe ser "ponderado-por-creditos", "simple" o "no-verificado"`)
    } else formaIndice = fiV

    if (errores.length === antesEscala) escala = { base, minimo, maximo, aprobacion, formaIndice }
  }

  let honores: ReglasPensum["honores"]
  const honoresV = d["honores"]
  if (honoresV === undefined) {
    honores = undefined
  } else if (!Array.isArray(honoresV)) {
    errores.push(`${ruta}.honores debe ser un array`)
    honores = undefined
  } else {
    const lista: NonNullable<ReglasPensum["honores"]> = []
    for (const [i, item] of honoresV.entries()) {
      const hruta = `${ruta}.honores[${i}]`
      const antesItem = errores.length
      let grado: GradoHonor | null = null
      let min: number | null = null
      let max: number | null = null
      let fuente: Fuente | null = null
      if (!esObjeto(item)) {
        errores.push(`${hruta} debe ser un objeto`)
      } else {
        const gradoV = item["grado"]
        if (gradoV === undefined) errores.push(`${hruta}.grado es obligatorio`)
        else if (!esGradoHonor(gradoV)) {
          errores.push(`${hruta}.grado debe ser "cum-laude", "magna-cum-laude", "summa-cum-laude", "cuadro-de-honor" o "otros"`)
        } else grado = gradoV

        const minV = item["min"]
        if (minV === undefined) errores.push(`${hruta}.min es obligatorio`)
        else if (!esNumero(minV)) errores.push(`${hruta}.min debe ser un número`)
        else min = minV

        const maxV = item["max"]
        if (maxV === undefined) errores.push(`${hruta}.max es obligatorio`)
        else if (!esNumero(maxV)) errores.push(`${hruta}.max debe ser un número`)
        else max = maxV

        const fuenteV = item["fuente"]
        if (fuenteV === undefined) errores.push(`${hruta}.fuente es obligatoria`)
        else fuente = validarFuente(fuenteV, `${hruta}.fuente`, errores)
      }
      if (errores.length === antesItem && grado !== null && min !== null && max !== null && fuente !== null) {
        lista.push({ grado, min, max, fuente })
      }
    }
    honores = lista
  }

  let requisitosHonores: ReglasPensum["requisitosHonores"]
  const reqHonV = d["requisitosHonores"]
  if (reqHonV === undefined) {
    requisitosHonores = undefined
  } else if (!esObjeto(reqHonV)) {
    errores.push(`${ruta}.requisitosHonores debe ser un objeto`)
    requisitosHonores = undefined
  } else {
    let sinReprobaciones: boolean | undefined
    const srV = reqHonV["sinReprobaciones"]
    if (srV !== undefined) {
      if (!esBooleano(srV)) errores.push(`${ruta}.requisitosHonores.sinReprobaciones debe ser un booleano`)
      else sinReprobaciones = srV
    }
    let exclusiones: string[] | undefined
    const exV = reqHonV["exclusiones"]
    if (exV !== undefined) {
      if (!Array.isArray(exV)) {
        errores.push(`${ruta}.requisitosHonores.exclusiones debe ser un array de strings`)
      } else {
        const limpio: string[] = []
        let valido = true
        for (const [j, item] of exV.entries()) {
          if (esString(item)) limpio.push(item)
          else {
            errores.push(`${ruta}.requisitosHonores.exclusiones[${j}] debe ser un string`)
            valido = false
          }
        }
        if (valido) exclusiones = limpio
      }
    }
    requisitosHonores = {
      ...(sinReprobaciones !== undefined ? { sinReprobaciones } : {}),
      ...(exclusiones !== undefined ? { exclusiones } : {}),
    }
  }

  let fuente: Fuente | null = null
  const fuenteV = d["fuente"]
  if (fuenteV === undefined) errores.push(`${ruta}.fuente es obligatoria`)
  else fuente = validarFuente(fuenteV, `${ruta}.fuente`, errores)

  if (errores.length > antes || escala === null || fuente === null) return null
  return {
    escala,
    ...(honores !== undefined ? { honores } : {}),
    ...(requisitosHonores !== undefined ? { requisitosHonores } : {}),
    fuente,
  }
}

/**
 * DFS sobre el grafo de prerrequisitos. Devuelve la ruta del ciclo
 * ("MAT-101 -> PRO-100 -> MAT-101") o null si el grafo es aciclico.
 */
function detectarCiclo(materias: readonly Asignatura[]): string | null {
  const indice = new Map<string, number>()
  for (const [i, m] of materias.entries()) indice.set(m.codigo, i)

  const estado: Array<"blanco" | "gris" | "negro"> = new Array(materias.length).fill("blanco")
  const pila: string[] = []

  const visitar = (codigo: string): string | null => {
    const idx = indice.get(codigo)
    if (idx === undefined) return null // prerrequisito inexistente: ya reportado aparte
    if (estado[idx] === "negro") return null
    if (estado[idx] === "gris") {
      const desde = pila.indexOf(codigo)
      return [...pila.slice(desde), codigo].join(" -> ")
    }
    estado[idx] = "gris"
    pila.push(codigo)
    const materia = materias[idx]
    if (materia !== undefined) {
      for (const pre of materia.prerequisitos) {
        const encontrado = visitar(pre)
        if (encontrado !== null) return encontrado
      }
    }
    pila.pop()
    estado[idx] = "negro"
    return null
  }

  for (const m of materias) {
    const encontrado = visitar(m.codigo)
    if (encontrado !== null) return `ciclo detectado: ${encontrado}`
  }
  return null
}

/**
 * Valida un pensum ya parseado. Sin IO: el dato llega como `unknown` y se
 * comprueba campo a campo contra data/schema/pensum.schema.json, sin ajv.
 *
 * @returns el pensum tipado o la lista de errores en lenguaje humano con ruta.
 */
export function validarPensum(dato: unknown): { ok: true; pensum: Pensum } | { ok: false; errores: string[] } {
  const errores: string[] = []
  if (!esObjeto(dato)) {
    errores.push("pensum debe ser un objeto")
    return { ok: false, errores }
  }
  rechazarCamposDesconocidos(
    dato,
    ["carrera", "slug", "universidad", "grado", "version", "vigente", "duracion", "totales", "materias", "reglas", "fuente", "notas"],
    "pensum",
    errores,
  )

  let carrera = ""
  const carreraV = dato["carrera"]
  if (carreraV === undefined) errores.push("pensum.carrera es obligatorio")
  else if (!esString(carreraV)) errores.push("pensum.carrera debe ser un string")
  else carrera = carreraV

  let slug = ""
  const slugV = dato["slug"]
  if (slugV === undefined) errores.push("pensum.slug es obligatorio")
  else if (!esString(slugV) || !RX_ID_SLUG.test(slugV)) {
    errores.push("pensum.slug solo puede contener minúsculas, números y guiones")
  } else slug = slugV

  let universidad: { id: string; nombre: string } | null = null
  const uniV = dato["universidad"]
  if (uniV === undefined) errores.push("pensum.universidad es obligatorio")
  else universidad = validarUniversidad(uniV, errores)

  let grado: GradoPrograma = "grado"
  const gradoV = dato["grado"]
  if (gradoV === undefined) errores.push("pensum.grado es obligatorio")
  else if (!esGrado(gradoV)) errores.push('pensum.grado debe ser "grado" o "postgrado"')
  else grado = gradoV

  let version = ""
  const versionV = dato["version"]
  if (versionV === undefined) errores.push("pensum.version es obligatorio")
  else if (!esString(versionV)) errores.push("pensum.version debe ser un string")
  else version = versionV

  let vigente = false
  const vigenteV = dato["vigente"]
  if (vigenteV === undefined) errores.push("pensum.vigente es obligatorio")
  else if (!esBooleano(vigenteV)) errores.push("pensum.vigente debe ser un booleano")
  else vigente = vigenteV

  let duracion: { periodos: number; tipoPeriodo: TipoPeriodo } | null = null
  const durV = dato["duracion"]
  if (durV === undefined) errores.push("pensum.duracion es obligatorio")
  else duracion = validarDuracion(durV, errores)

  let totales: { asignaturas: number; creditos: number } | null = null
  const totV = dato["totales"]
  if (totV === undefined) errores.push("pensum.totales es obligatorio")
  else totales = validarTotales(totV, errores)

  let materias: Asignatura[] | null = null
  const materiasV = dato["materias"]
  if (materiasV === undefined) errores.push("pensum.materias es obligatorio")
  else materias = validarMaterias(materiasV, errores)

  let reglas: ReglasPensum | null = null
  const reglasV = dato["reglas"]
  if (reglasV === undefined) errores.push("pensum.reglas es obligatorio")
  else reglas = validarReglas(reglasV, errores)

  let fuente: Fuente | null = null
  const fuenteV = dato["fuente"]
  if (fuenteV === undefined) errores.push("pensum.fuente es obligatoria")
  else fuente = validarFuente(fuenteV, "pensum.fuente", errores)

  let notas: string[] | undefined
  const notasV = dato["notas"]
  if (notasV !== undefined) {
    if (!Array.isArray(notasV)) {
      errores.push("pensum.notas debe ser un array de strings")
    } else {
      const limpio: string[] = []
      let valido = true
      for (const [j, item] of notasV.entries()) {
        if (esString(item)) limpio.push(item)
        else {
          errores.push(`pensum.notas[${j}] debe ser un string`)
          valido = false
        }
      }
      if (valido) notas = limpio
    }
  }

  // Chequeos de conjunto: solo tienen sentido con materias bien formadas.
  if (materias !== null) {
    // 1. codigos unicos (el primer ejemplar gana; el duplicado ya queda errado)
    const primeraVez = new Map<string, number>()
    for (const [i, m] of materias.entries()) {
      const previa = primeraVez.get(m.codigo)
      if (previa !== undefined) {
        errores.push(`materias[${i}].codigo duplicado: ${m.codigo} (ya aparece en materias[${previa}])`)
      } else {
        primeraVez.set(m.codigo, i)
      }
    }
    // 2. prerrequisitos resolubles dentro de la carrera
    for (const [i, m] of materias.entries()) {
      for (const [j, pre] of m.prerequisitos.entries()) {
        if (!primeraVez.has(pre)) {
          errores.push(`materias[${i}].prerequisitos[${j}] refiere a un código inexistente en el pensum: ${pre}`)
        }
      }
    }
    // 3. grafo aciclico
    const ciclo = detectarCiclo(materias)
    if (ciclo !== null) errores.push(ciclo)
    // 4. totales y duracion contra las materias reales
    if (totales !== null) {
      if (totales.asignaturas !== materias.length) {
        errores.push(`pensum.totales.asignaturas no cuadra: declara ${totales.asignaturas} y el pensum tiene ${materias.length} materias`)
      }
      const sumaCreditos = materias.reduce((acc, m) => acc + m.creditos, 0)
      if (totales.creditos !== sumaCreditos) {
        errores.push(`pensum.totales.creditos no cuadra: declara ${totales.creditos} y las materias suman ${sumaCreditos}`)
      }
    }
    if (duracion !== null) {
      const maxCuatrimestre = materias.reduce((acc, m) => Math.max(acc, m.cuatrimestre), 0)
      if (duracion.periodos < maxCuatrimestre) {
        errores.push(`pensum.duracion.periodos (${duracion.periodos}) es menor que el cuatrimestre máximo de las materias (${maxCuatrimestre})`)
      }
    }
  }

  if (
    errores.length > 0 ||
    materias === null ||
    universidad === null ||
    duracion === null ||
    totales === null ||
    reglas === null ||
    fuente === null
  ) {
    return { ok: false, errores }
  }

  const pensum: Pensum = {
    carrera,
    slug,
    universidad,
    grado,
    version,
    vigente,
    duracion,
    totales,
    materias,
    reglas,
    fuente,
    ...(notas !== undefined ? { notas } : {}),
  }
  return { ok: true, pensum }
}

/**
 * Parseo + validacion: JSON.parse tipado y, si el texto no parsea, un error
 * legible ("JSON inválido: ...") en vez de lanzar.
 */
export function parsearPensum(texto: string): { ok: true; pensum: Pensum } | { ok: false; errores: string[] } {
  let dato: unknown
  try {
    dato = JSON.parse(texto)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    return { ok: false, errores: [`JSON inválido: ${mensaje}`] }
  }
  return validarPensum(dato)
}

/** Busca una materia por su codigo exacto, o null si no existe. */
export function buscarMateria(pensum: Pensum, codigo: string): Asignatura | null {
  return pensum.materias.find((m) => m.codigo === codigo) ?? null
}

/**
 * Todas las materias de un cuatrimestre, ordenadas por codigo para que la
 * salida sea estable (los codigos son unicos, el orden es determinista).
 */
export function buscarPorCuatrimestre(pensum: Pensum, cuatrimestre: number): Asignatura[] {
  return pensum.materias
    .filter((m) => m.cuatrimestre === cuatrimestre)
    .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
}