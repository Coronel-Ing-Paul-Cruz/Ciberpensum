import { describe, it, expect } from "vitest"
import {
  ProgresoInvalido,
  codificarBase64Url,
  checksum,
  decodificarBase64Url as decodificarBase64UrlModulo,
  deserializarProgreso,
  enlacePensum,
  enlaceProgreso,
  migrarProgreso,
  progresoDesdeEnlace,
  resumenProgreso,
  serializarProgreso,
} from "./portabilidad.js"
import type { Progreso } from "./portabilidad.js"

// Este test fija el contrato ANTES de existir la implementacion. Los literales
// "dorados" (canonico, checksum, enlace, base64) no salen de este modulo: se
// calcularon con una referencia independiente (JSON.stringify con claves
// ordenadas + FNV-1a y Buffer.from().toString("base64url") de Node), asi que
// si portabilidad.ts se equivoca, el test no lo acompana.

const fijo = (): Progreso => ({
  schema: "ciberpensum/progreso",
  version: 1,
  universidadId: "unicaribe",
  slug: "ingenieria-de-sistemas",
  aprobadas: {
    "MAT-101": { nota: 85, creditos: 4, cuatrimestre: 1 },
    "APA-102": { nota: 92, creditos: 3, cuatrimestre: 1 },
  },
  enCurso: ["SIS-205"],
  actualizadoEn: "2026-10-06",
})

/** Los mismos datos que `fijo()`, pero con las claves en otro orden de
 *  insercion y otra fecha: el canonico, el checksum y el enlace deben ser
 *  identicos a pesar de eso. */
const fijoDesordenado = (): Progreso => ({
  actualizadoEn: "2020-01-01",
  enCurso: ["SIS-205"],
  slug: "ingenieria-de-sistemas",
  universidadId: "unicaribe",
  version: 1,
  schema: "ciberpensum/progreso",
  aprobadas: {
    "MAT-101": { cuatrimestre: 1, nota: 85, creditos: 4 },
    "APA-102": { nota: 92, cuatrimestre: 1, creditos: 3 },
  },
})

/** La serializacion canonica esperada, escrita a mano (2 espacios, claves
 *  ordenadas alfabeticamente a cualquier profundidad, sin actualizadoEn). */
const CANONICO_ESPERADO = [
  "{",
  '  "aprobadas": {',
  '    "APA-102": {',
  '      "creditos": 3,',
  '      "cuatrimestre": 1,',
  '      "nota": 92',
  "    },",
  '    "MAT-101": {',
  '      "creditos": 4,',
  '      "cuatrimestre": 1,',
  '      "nota": 85',
  "    }",
  "  },",
  '  "enCurso": [',
  '    "SIS-205"',
  "  ],",
  '  "schema": "ciberpensum/progreso",',
  '  "slug": "ingenieria-de-sistemas",',
  '  "universidadId": "unicaribe",',
  '  "version": 1',
  "}",
].join("\n")

/** FNV-1a de 32 bits escrita aparte, a mano, sobre la serializacion canonica
 *  (el fixture es ASCII, asi que el codigo de caracter ES el byte UTF-8). */
const fnv1aReferencia = (texto: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

const CHECKSUM_FIJO = "7d7bd916"
const ENLACE_FIJO = "#p=dml8dW5pY2FyaWJlfGluZ2VuaWVyaWEtZGUtc2lzdGVtYXN8N2Q3YmQ5MTY"
const CARGA_FIJA = "vi|unicaribe|ingenieria-de-sistemas|7d7bd916"

/** Decodificador base64url escrito en el test, sin tocar Buffer ni btoa: es
 *  el que prueba que el enlace es legible por cualquier lenguaje. */
const decodificarBase64Url = (texto: string): string => {
  const estandar = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const normalizado = texto.replace(/-/g, "+").replace(/_/g, "/")
  const bytes: number[] = []
  let acumulado = 0
  let bits = 0
  for (let i = 0; i < normalizado.length; i++) {
    const ch = normalizado.charAt(i)
    if (ch === "=") break
    const posicion = estandar.indexOf(ch)
    if (posicion < 0) throw new Error("base64 invalido: " + ch)
    acumulado = (acumulado << 6) | posicion
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acumulado >> bits) & 0xff)
    }
  }
  let porcentaje = ""
  for (const b of bytes) porcentaje += "%" + b.toString(16).padStart(2, "0")
  return decodeURIComponent(porcentaje)
}

const esRegistro = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

describe("serializarProgreso", () => {
  it("produce el canonico esperado: claves ordenadas y 2 espacios", () => {
    expect(serializarProgreso(fijo())).toBe(CANONICO_ESPERADO)
  })

  it("da el mismo texto aunque las claves vengan en otro orden", () => {
    expect(serializarProgreso(fijoDesordenado())).toBe(serializarProgreso(fijo()))
  })

  it("excluye actualizadoEn: una fecha nueva no cambia la serializacion", () => {
    const texto = serializarProgreso(fijo())
    expect(texto).not.toContain("actualizadoEn")
    const otraFecha: Progreso = { ...fijo(), actualizadoEn: "1999-12-31" }
    expect(serializarProgreso(otraFecha)).toBe(texto)
  })

  it("el resultado es JSON valido con las claves superiores en orden alfabetico", () => {
    const leido: unknown = JSON.parse(serializarProgreso(fijo()))
    expect(esRegistro(leido)).toBe(true)
    if (!esRegistro(leido)) throw new Error("debio parsear como objeto")
    expect(leido["schema"]).toBe("ciberpensum/progreso")
    expect(Object.keys(leido)).toEqual([
      "aprobadas",
      "enCurso",
      "schema",
      "slug",
      "universidadId",
      "version",
    ])
    expect(Object.prototype.hasOwnProperty.call(leido, "actualizadoEn")).toBe(false)
  })

  it("ordena por orden de codigo de caracter aunque la clave parezca un numero", () => {
    // "201" es clave entera: JSON.stringify la adelantaria. El canonico manda
    // orden alfabetico puro ("-lab" < "201").
    const p: Progreso = {
      ...fijo(),
      aprobadas: {
        "201": { nota: 70, creditos: 2, cuatrimestre: 2 },
        "-lab": { nota: 90, creditos: 1, cuatrimestre: 1 },
      },
    }
    const texto = serializarProgreso(p)
    expect(texto.indexOf('"-lab"')).toBeGreaterThan(-1)
    expect(texto.indexOf('"-lab"')).toBeLessThan(texto.indexOf('"201"'))
  })

  it("conserva enCurso aunque este vacio", () => {
    expect(serializarProgreso({ ...fijo(), enCurso: [] })).toContain('"enCurso": []')
  })

  it("no muta el progreso que recibe", () => {
    const p = fijo()
    const antes = JSON.stringify(p)
    serializarProgreso(p)
    expect(JSON.stringify(p)).toBe(antes)
    expect(p.actualizadoEn).toBe("2026-10-06")
  })
})

describe("deserializarProgreso", () => {
  it("round-trip: serializar y volver a leer conserva los datos", () => {
    const texto = serializarProgreso(fijo())
    const vuelta = deserializarProgreso(texto)
    expect(vuelta.schema).toBe("ciberpensum/progreso")
    expect(vuelta.version).toBe(1)
    expect(vuelta.universidadId).toBe("unicaribe")
    expect(vuelta.slug).toBe("ingenieria-de-sistemas")
    expect(vuelta.aprobadas).toEqual(fijo().aprobadas)
    expect(vuelta.enCurso).toEqual(["SIS-205"])
    // Decision conservadora: el canonico no trae fecha, y este modulo no
    // inventa una (quien guarde, la vuelve a poner).
    expect(vuelta.actualizadoEn).toBe("")
    expect(serializarProgreso(vuelta)).toBe(texto)
  })

  it("acepta un JSON con las claves en cualquier orden y conserva actualizadoEn", () => {
    const crudo = JSON.stringify(fijoDesordenado())
    const vuelta = deserializarProgreso(crudo)
    expect(vuelta).toEqual(fijoDesordenado())
    expect(vuelta.actualizadoEn).toBe("2020-01-01")
    expect(serializarProgreso(vuelta)).toBe(serializarProgreso(fijo()))
  })

  it("sin enCurso la opcion se queda ausente, no en vacio", () => {
    const sinEnCurso: Progreso = { ...fijo() }
    delete sinEnCurso.enCurso
    const vuelta = deserializarProgreso(serializarProgreso(sinEnCurso))
    expect(vuelta.enCurso).toBeUndefined()
  })

  it("acepta aprobadas vacias", () => {
    const vuelta = deserializarProgreso(serializarProgreso({ ...fijo(), aprobadas: {} }))
    expect(vuelta.aprobadas).toEqual({})
  })

  it("JSON roto lanza ProgresoInvalido explicando que el texto no parsea", () => {
    expect(() => deserializarProgreso("{esto no es json")).toThrow(ProgresoInvalido)
    expect(() => deserializarProgreso("{esto no es json")).toThrow(/JSON/)
  })

  it("schema equivocado lanza ProgresoInvalido", () => {
    const crudo = JSON.stringify({ ...fijo(), schema: "otra/cosa" })
    expect(() => deserializarProgreso(crudo)).toThrow(ProgresoInvalido)
    expect(() => deserializarProgreso(crudo)).toThrow(/schema/)
  })

  it("version que no es numero lanza ProgresoInvalido", () => {
    const crudo = JSON.stringify({ ...fijo(), version: "2" })
    expect(() => deserializarProgreso(crudo)).toThrow(/version/)
    expect(() => deserializarProgreso(crudo)).toThrow(ProgresoInvalido)
  })

  it("aprobadas que no es objeto lanza ProgresoInvalido", () => {
    const comoArray = JSON.stringify({ ...fijo(), aprobadas: [] })
    const nulo = JSON.stringify({ ...fijo(), aprobadas: null })
    expect(() => deserializarProgreso(comoArray)).toThrow(/aprobadas/)
    expect(() => deserializarProgreso(nulo)).toThrow(/aprobadas/)
  })

  it("enCurso que no es lista lanza ProgresoInvalido", () => {
    const crudo = JSON.stringify({ ...fijo(), enCurso: "SIS-205" })
    expect(() => deserializarProgreso(crudo)).toThrow(/enCurso/)
  })

  it("una materia con campos que no son numeros lanza ProgresoInvalido con su codigo", () => {
    const crudo = JSON.stringify({
      ...fijo(),
      aprobadas: { "MAT-101": { nota: "85", creditos: 4, cuatrimestre: 1 } },
    })
    expect(() => deserializarProgreso(crudo)).toThrow(/MAT-101/)
    expect(() => deserializarProgreso(crudo)).toThrow(ProgresoInvalido)
  })

  it("no es un objeto en absoluto lanza ProgresoInvalido", () => {
    expect(() => deserializarProgreso('"soy un texto"')).toThrow(ProgresoInvalido)
    expect(() => deserializarProgreso("null")).toThrow(ProgresoInvalido)
    expect(() => deserializarProgreso("[1,2,3]")).toThrow(ProgresoInvalido)
  })
})

describe("ProgresoInvalido", () => {
  it("es un Error con nombre propio, para poder distinguirla", () => {
    const e = new ProgresoInvalido("algo fallo")
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(ProgresoInvalido)
    expect(e.name).toBe("ProgresoInvalido")
    expect(e.message).toBe("algo fallo")
  })

  it("lo que se captura en el catch es de este tipo", () => {
    let capturado: unknown = null
    try {
      deserializarProgreso("{roto")
    } catch (e) {
      capturado = e
    }
    expect(capturado).toBeInstanceOf(ProgresoInvalido)
  })
})

describe("checksum", () => {
  it("es FNV-1a de 32 bits en hex minuscula de 8 digitos", () => {
    expect(checksum(fijo())).toMatch(/^[0-9a-f]{8}$/)
    expect(checksum(fijo())).toBe(CHECKSUM_FIJO)
  })

  it("coincide con la FNV-1a de referencia sobre el canonico", () => {
    expect(fnv1aReferencia(CANONICO_ESPERADO)).toBe(CHECKSUM_FIJO)
    expect(checksum(fijo())).toBe(fnv1aReferencia(serializarProgreso(fijo())))
  })

  it("el orden de las claves no lo cambia", () => {
    expect(checksum(fijoDesordenado())).toBe(checksum(fijo()))
  })

  it("actualizadoEn distinto no lo cambia", () => {
    expect(checksum({ ...fijo(), actualizadoEn: "2026-10-06" })).toBe(
      checksum({ ...fijo(), actualizadoEn: "2000-01-01" }),
    )
  })

  it("una nota distinta si lo cambia", () => {
    const cambiado: Progreso = {
      ...fijo(),
      aprobadas: {
        ...fijo().aprobadas,
        "MAT-101": { nota: 86, creditos: 4, cuatrimestre: 1 },
      },
    }
    expect(checksum(cambiado)).not.toBe(checksum(fijo()))
  })
})

describe("codificarBase64Url", () => {
  it("produce el base64url esperado (mismo que Buffer en Node)", () => {
    expect(codificarBase64Url("")).toBe("")
    expect(codificarBase64Url("hola")).toBe("aG9sYQ")
    expect(codificarBase64Url("Ing. de Sistemas")).toBe("SW5nLiBkZSBTaXN0ZW1hcw")
    expect(codificarBase64Url("Ciberpensum ¿ñ?")).toBe("Q2liZXJwZW5zdW0gwr_DsT8")
    expect(codificarBase64Url("añ🚀")).toBe("YcOx8J-agA")
  })

  it("nunca suelta +, / ni = : es base64url, no base64 comun", () => {
    for (const texto of ["¿ñ?+/", "añ🚀", "Ciberpensum ¿ñ?"]) {
      expect(codificarBase64Url(texto)).not.toMatch(/[+/=]/)
    }
  })

  it("se puede decodificar de vuelta con un decodificador ajeno", () => {
    for (const texto of ["hola", "Ing. de Sistemas", "Ciberpensum ¿ñ?", "añ🚀"]) {
      expect(decodificarBase64Url(codificarBase64Url(texto))).toBe(texto)
    }
  })
})

describe("enlacePensum", () => {
  it("es #p= mas la carga vi|universidad|slug|checksum en base64url", () => {
    expect(enlacePensum(fijo())).toBe(ENLACE_FIJO)
    expect(decodificarBase64Url(enlacePensum(fijo()).slice(3))).toBe(CARGA_FIJA)
  })

  it("empieza por #p= y la carga solo trae caracteres de base64url", () => {
    const enlace = enlacePensum(fijo())
    expect(enlace.startsWith("#p=")).toBe(true)
    expect(enlace.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("es estable: ni el orden de las claves ni la fecha lo cambian", () => {
    expect(enlacePensum(fijoDesordenado())).toBe(ENLACE_FIJO)
    expect(enlacePensum({ ...fijo(), actualizadoEn: "1999-12-31" })).toBe(ENLACE_FIJO)
  })

  it("cambia si cambia el progreso", () => {
    const cambiado: Progreso = {
      ...fijo(),
      aprobadas: {
        ...fijo().aprobadas,
        "MAT-101": { nota: 86, creditos: 4, cuatrimestre: 1 },
      },
    }
    expect(enlacePensum(cambiado)).not.toBe(ENLACE_FIJO)
  })
})

describe("resumenProgreso", () => {
  const pesado = (): Progreso => ({
    ...fijo(),
    aprobadas: {
      "APA-102": { nota: 90, creditos: 4, cuatrimestre: 1 },
      "MAT-101": { nota: 80, creditos: 3, cuatrimestre: 1 },
      "SIS-301": { nota: 100, creditos: 1, cuatrimestre: 3 },
    },
    enCurso: ["SIS-404"],
  })

  it("cuenta materias, suma creditos y pondera el indice por credito", () => {
    // (90*4 + 80*3 + 100*1) / (4+3+1) = 700 / 8 = 87.5
    // Media simple seria (90+80+100)/3 = 90: el ponderado es el que manda.
    expect(resumenProgreso(pesado())).toEqual({
      aprobadas: 3,
      creditos: 8,
      indice: 87.5,
      cuatrimestreActual: 3,
    })
  })

  it("indice ponderado del fixture: (85*4 + 92*3) / 7 = 88", () => {
    expect(resumenProgreso(fijo())).toEqual({
      aprobadas: 2,
      creditos: 7,
      indice: 88,
      cuatrimestreActual: 1,
    })
  })

  it("enCurso no cuenta como aprobada ni suma creditos", () => {
    // SIS-404 esta inscrita sin nota final: no aporta creditos ni indice, y el
    // contrato no trae su cuatrimestre, asi que tampoco sube el recuento.
    const r = resumenProgreso(pesado())
    expect(r.aprobadas).toBe(3)
    expect(r.creditos).toBe(8)
  })

  it("progreso vacio: todo en cero", () => {
    expect(resumenProgreso({ ...fijo(), aprobadas: {} })).toEqual({
      aprobadas: 0,
      creditos: 0,
      indice: 0,
      cuatrimestreActual: 0,
    })
  })

  it("creditos en cero: indice 0, jamas NaN", () => {
    const r = resumenProgreso({
      ...fijo(),
      aprobadas: { "X-1": { nota: 95, creditos: 0, cuatrimestre: 2 } },
    })
    expect(r).toEqual({ aprobadas: 1, creditos: 0, indice: 0, cuatrimestreActual: 2 })
    expect(Number.isNaN(r.indice)).toBe(false)
  })
})

describe("migrarProgreso", () => {
  it("version ya actual: devuelve el progreso validado, sin tocar nada", () => {
    const crudo: unknown = JSON.parse(JSON.stringify(fijo()))
    const migrado = migrarProgreso(crudo, 1)
    expect(migrado).toEqual(fijo())
    expect(migrado.version).toBe(1)
  })

  it("cadena de migraciones vacia: pide subir de version y se niega", () => {
    // Documenta el contrato abierto: existe la cadena, pero aun no hay paso
    // v1 -> v2. Preferimos fallar claro antes que devolver una v1 fingiendo v2.
    expect(() => migrarProgreso(fijo(), 2)).toThrow(ProgresoInvalido)
    expect(() => migrarProgreso(fijo(), 2)).toThrow(/migración/)
  })

  it("una version mas nueva que la soportada no se migra hacia atras", () => {
    const futuro: Progreso = { ...fijo(), version: 2 }
    expect(() => migrarProgreso(futuro, 1)).toThrow(ProgresoInvalido)
  })

  it("valida la estructura antes de migrar", () => {
    expect(() => migrarProgreso("no soy un progreso", 1)).toThrow(ProgresoInvalido)
    expect(() => migrarProgreso({ ...fijo(), schema: "otra/cosa" }, 1)).toThrow(/schema/)
    expect(() => migrarProgreso({ ...fijo(), version: "1" }, 1)).toThrow(/version/)
  })
})

// ---------------------------------------------------------------------------
// Enlace con el progreso completo (#p= que transporta los datos)
// ---------------------------------------------------------------------------
//
// enlacePensum lleva un SELLO (vi|uni|slug|checksum) y nada mas: quien recibe
// ese enlace reconstruye el progreso con el mismo esquema. Aqui va lo
// contrario: enlaceProgreso mete el progreso entero en el fragmento, para que
// el avance del estudiante sobreviva a compartir una URL sin backend y sin
// cuenta.
//
// OJO con el import del decodificador: lleva alias porque este archivo ya
// declara su propio decodificarBase64Url, escrito a mano como referencia AJENA
// al modulo. Un modulo no se prueba a si mismo con sus propias herramientas.

/** Golden calculado con Buffer.from(...).toString("base64url") de Node sobre
 *  CHECKSUM_FIJO + "|" + CANONICO_ESPERADO, no con el codificador del modulo. */
const ENLACE_PROGRESO_FIJO =
  "#p=N2Q3YmQ5MTZ8ewogICJhcHJvYmFkYXMiOiB7CiAgICAiQVBBLTEwMiI6IHsKICAgICAgImNyZWRpdG9zIjogMywKICAgICAgImN1YXRyaW1lc3RyZSI6IDEsCiAgICAgICJub3RhIjogOTIKICAgIH0sCiAgICAiTUFULTEwMSI6IHsKICAgICAgImNyZWRpdG9zIjogNCwKICAgICAgImN1YXRyaW1lc3RyZSI6IDEsCiAgICAgICJub3RhIjogODUKICAgIH0KICB9LAogICJlbkN1cnNvIjogWwogICAgIlNJUy0yMDUiCiAgXSwKICAic2NoZW1hIjogImNpYmVycGVuc3VtL3Byb2dyZXNvIiwKICAic2x1ZyI6ICJpbmdlbmllcmlhLWRlLXNpc3RlbWFzIiwKICAidW5pdmVyc2lkYWRJZCI6ICJ1bmljYXJpYmUiLAogICJ2ZXJzaW9uIjogMQp9"

describe("decodificarBase64Url (modulo)", () => {
  // Datos de prueba en pareja: lo que codifica / lo que debe devolver. Son los
  // mismos casos que codificarBase64Url, leidos al reves: signos de apertura,
  // acentos y emoji de cuatro bytes.
  const CASOS: ReadonlyArray<readonly [string, string]> = [
    ["", ""],
    ["aG9sYQ", "hola"],
    ["SW5nLiBkZSBTaXN0ZW1hcw", "Ing. de Sistemas"],
    ["Q2liZXJwZW5zdW0gwr_DsT8", "Ciberpensum ¿ñ?"],
    ["YcOx8J-agA", "añ🚀"],
  ]

  const TEXTOS = [
    "",
    "hola",
    "Ing. de Sistemas",
    "Ciberpensum ¿ñ?",
    "añ🚀",
    "ñandú 🇩🇴",
    "interlínea\ncon\ttabulador",
  ]

  it("lee los casos golden del codificador en orden inverso", () => {
    for (const [codificado, texto] of CASOS) {
      expect(decodificarBase64UrlModulo(codificado)).toBe(texto)
    }
  })

  it("es el inverso exacto de codificarBase64Url (acentos y emoji incluidos)", () => {
    for (const texto of TEXTOS) {
      expect(decodificarBase64UrlModulo(codificarBase64Url(texto))).toBe(texto)
    }
  })

  it("coincide con el decodificador ajeno que ya usaba este test", () => {
    for (const texto of TEXTOS) {
      const codificado = codificarBase64Url(texto)
      expect(decodificarBase64UrlModulo(codificado)).toBe(decodificarBase64Url(codificado))
    }
  })

  it("acepta las variantes - y _ y el relleno = del final", () => {
    expect(decodificarBase64UrlModulo("aG9sYQ")).toBe("hola")
    expect(decodificarBase64UrlModulo("aG9sYQ==")).toBe("hola")
    expect(decodificarBase64UrlModulo("Q2liZXJwZW5zdW0gwr_DsT8")).toBe("Ciberpensum ¿ñ?")
  })

  it("texto que no es base64url lanza ProgresoInvalido", () => {
    expect(() => decodificarBase64UrlModulo("%%%")).toThrow(ProgresoInvalido)
    expect(() => decodificarBase64UrlModulo("hola*")).toThrow(ProgresoInvalido)
    expect(() => decodificarBase64UrlModulo("a=b")).toThrow(ProgresoInvalido)
    // Longitud % 4 === 1: el ultimo caracter suelto no alcanza para un byte.
    expect(() => decodificarBase64UrlModulo("Y")).toThrow(ProgresoInvalido)
  })
})

describe("enlaceProgreso", () => {
  it("es #p= mas base64url de «checksum|canonico» (golden con Buffer de Node)", () => {
    expect(enlaceProgreso(fijo())).toBe(ENLACE_PROGRESO_FIJO)
    expect(decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))).toBe(
      CHECKSUM_FIJO + "|" + CANONICO_ESPERADO,
    )
  })

  it("empieza por #p= y el payload solo trae caracteres de base64url", () => {
    const enlace = enlaceProgreso(fijo())
    expect(enlace.startsWith("#p=")).toBe(true)
    expect(enlace.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("es estable: ni la fecha de guardado ni el orden de claves lo cambian", () => {
    expect(enlaceProgreso(fijoDesordenado())).toBe(ENLACE_PROGRESO_FIJO)
    expect(enlaceProgreso({ ...fijo(), actualizadoEn: "1999-12-31" })).toBe(ENLACE_PROGRESO_FIJO)
  })

  it("transporta el progreso completo: notas, creditos y enCurso viajan dentro", () => {
    const carga = decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))
    expect(carga).toContain('"MAT-101"')
    expect(carga).toContain('"nota": 85')
    expect(carga).toContain('"SIS-205"')
    // La fecha de guardado queda fuera a proposito: es lo que hace estable el enlace.
    expect(carga).not.toContain("actualizadoEn")
  })

  it("cambia si cambia el progreso", () => {
    const cambiado: Progreso = {
      ...fijo(),
      aprobadas: { ...fijo().aprobadas, "MAT-101": { nota: 86, creditos: 4, cuatrimestre: 1 } },
    }
    expect(enlaceProgreso(cambiado)).not.toBe(ENLACE_PROGRESO_FIJO)
  })
})

describe("progresoDesdeEnlace", () => {
  it("round-trip: recupera el progreso completo (pierde solo actualizadoEn)", () => {
    const vuelta = progresoDesdeEnlace(enlaceProgreso(fijo()))
    // serializarProgreso excluye actualizadoEn, asi que el enlace no puede
    // devolverla: la fecha vacia es el dato honesto, no una fecha inventada.
    expect(vuelta).toEqual({ ...fijo(), actualizadoEn: "" })
    expect(vuelta.aprobadas).toEqual(fijo().aprobadas)
    expect(vuelta.enCurso).toEqual(["SIS-205"])
    expect(vuelta.schema).toBe("ciberpensum/progreso")
  })

  it("acepta el fragmento con y sin #p= al principio", () => {
    const enlace = enlaceProgreso(fijo())
    expect(progresoDesdeEnlace(enlace)).toEqual({ ...fijo(), actualizadoEn: "" })
    expect(progresoDesdeEnlace(enlace.slice(3))).toEqual(progresoDesdeEnlace(enlace))
  })

  it("el enlace es estable y el round-trip se repite identico", () => {
    const conOtraFecha = enlaceProgreso({ ...fijo(), actualizadoEn: "2020-01-01" })
    expect(enlaceProgreso({ ...fijo(), actualizadoEn: "1999-12-31" })).toBe(conOtraFecha)
    expect(progresoDesdeEnlace(conOtraFecha)).toEqual(progresoDesdeEnlace(conOtraFecha))
  })

  it("un caracter alterado del payload hace fallar el checksum", () => {
    const carga = decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))
    const alterada = carga.replace("ingenieria-de-sistemas", "ingenieria-de-sistemaz")
    expect(alterada).not.toBe(carga)
    // El JSON sigue siendo valido y el schema sigue siendo el correcto: lo que
    // no cuadra es el sello, que es exactamente lo que debe detectarse.
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url(alterada))).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url(alterada))).toThrow(/checksum/)
  })

  it("un caracter alterado del sello tambien hace fallar el checksum", () => {
    const carga = decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))
    const alterada = carga.replace(CHECKSUM_FIJO, "00000000")
    expect(alterada).not.toBe(carga)
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url(alterada))).toThrow(/checksum/)
  })

  it("carga sin «|»: dice que falto el formato", () => {
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url("hola mundo"))).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url("hola mundo"))).toThrow(/formato/)
    // Fragmento vacio: tampoco tiene forma de checksum|canonico.
    expect(() => progresoDesdeEnlace("#p=")).toThrow(/formato/)
  })

  it("base64 corrupto: dice que el payload no es base64url", () => {
    expect(() => progresoDesdeEnlace("#p=%%%no-es-base64%%%")).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace("#p=%%%no-es-base64%%%")).toThrow(/base64/)
  })

  it("progreso con schema equivocado: dice que el progreso del enlace no vale", () => {
    const carga = decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))
    const mala = carga.replace("ciberpensum/progreso", "otra/cosa")
    expect(mala).not.toBe(carga)
    const fragmento = "#p=" + codificarBase64Url(mala)
    expect(() => progresoDesdeEnlace(fragmento)).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace(fragmento)).toThrow(/progreso inválido/)
    expect(() => progresoDesdeEnlace(fragmento)).toThrow(/schema/)
  })

  it("JSON cortado dentro del enlace: progreso invalido, no un progreso a medias", () => {
    const carga = decodificarBase64UrlModulo(enlaceProgreso(fijo()).slice(3))
    const rota = carga.slice(0, carga.indexOf("{") + 5)
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url(rota))).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace("#p=" + codificarBase64Url(rota))).toThrow(/progreso inválido/)
  })

  it("el enlace de solo sello de enlacePensum no es un enlace de progreso", () => {
    // Los dos formatos comparten el prefijo #p= pero no son intercambiables:
    // el de referencia no trae datos y se RECHAZA, no se adivina nada.
    expect(() => progresoDesdeEnlace(enlacePensum(fijo()))).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace(enlacePensum(fijo()))).toThrow(/formato/)
  })

  it("entrada que no es texto: ProgresoInvalido, no un TypeError suelto", () => {
    // Fuera del contrato TS: un llamante en JS puede pasar lo que sea. Decidido
    // aqui (el enunciado no lo decia): se rechaza en el borde con el error
    // propio, que es lo conservador.
    expect(() => progresoDesdeEnlace(null as unknown as string)).toThrow(ProgresoInvalido)
    expect(() => progresoDesdeEnlace(undefined as unknown as string)).toThrow(ProgresoInvalido)
  })
})
