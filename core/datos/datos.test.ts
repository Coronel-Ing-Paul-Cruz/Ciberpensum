import { describe, it, expect } from "vitest"
import type { Pensum } from "./datos.js"
import {
  validarPensum,
  parsearPensum,
  buscarMateria,
  buscarPorCuatrimestre,
} from "./datos.js"

type Resultado = { ok: true; pensum: Pensum } | { ok: false; errores: string[] }

const SHA = "a".repeat(64)
const SHA2 = "b".repeat(64)

/** Fixture feliz: 3 materias, prerrequisitos resueltos, totales que cuadran. */
function pensumBase(): Record<string, unknown> {
  return {
    carrera: "Ingeniería de Sistemas",
    slug: "ing-sistemas",
    universidad: { id: "unicaribe", nombre: "Universidad del Caribe" },
    grado: "grado",
    version: "2024-1",
    vigente: true,
    duracion: { periodos: 8, tipoPeriodo: "cuatrimestre" },
    totales: { asignaturas: 3, creditos: 13 },
    materias: [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: [] },
      { codigo: "MAT-201", nombre: "Cálculo I", creditos: 4, cuatrimestre: 2, prerequisitos: ["MAT-101"] },
    ],
    reglas: {
      escala: { base: 100, minimo: 70, maximo: 100, aprobacion: 70, formaIndice: "ponderado-por-creditos" },
      fuente: { url: "https://unicaribe.edu.do/reglamento.pdf", sha256: SHA, verificadoEn: "2024-05-10" },
    },
    fuente: {
      url: "https://unicaribe.edu.do/pensum-isi.pdf",
      sha256: SHA2,
      verificadoEn: "2024-05-10",
      archivo: "pensum-isi.pdf",
    },
  }
}

function reglasBase(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    escala: { base: 100, minimo: 70, maximo: 100, aprobacion: 70, formaIndice: "ponderado-por-creditos" },
    fuente: { url: "https://unicaribe.edu.do/reglamento.pdf", sha256: SHA, verificadoEn: "2024-05-10" },
    ...extra,
  }
}

/**
 * Sustituye las materias y recalcula los totales, para que las pruebas de
 * detalle no se ensucien con errores de cuadratura.
 */
function conMaterias(base: Record<string, unknown>, materias: Array<Record<string, unknown>>): Record<string, unknown> {
  const creditos = materias.reduce((acc, m) => {
    const c = m["creditos"]
    return acc + (typeof c === "number" ? c : 0)
  }, 0)
  return { ...base, materias, totales: { asignaturas: materias.length, creditos } }
}

/** Edita una materia del fixture base manteniendo la cuadratura recalculada. */
function editandoMateria(base: Record<string, unknown>, idx: number, cambios: Record<string, unknown>): Record<string, unknown> {
  const materias = Array.isArray(base["materias"]) ? (base["materias"] as Array<Record<string, unknown>>) : []
  const lista = materias.map((m, i) => (i === idx ? { ...m, ...cambios } : m))
  return conMaterias(base, lista)
}

function pensumDe(r: Resultado): Pensum {
  if (!r.ok) throw new Error("se esperaba un pensum válido: " + r.errores.join("; "))
  return r.pensum
}

function erroresDe(r: Resultado): string[] {
  if (r.ok) throw new Error("se esperaba que la validación fallara, pero respondió ok")
  return r.errores
}

describe("validarPensum: caso feliz", () => {
  it("acepta el fixture y devuelve el pensum tipado", () => {
    const pensum = pensumDe(validarPensum(pensumBase()))
    expect(pensum.carrera).toBe("Ingeniería de Sistemas")
    expect(pensum.materias.map((m) => m.codigo)).toEqual(["MAT-101", "PRO-100", "MAT-201"])
    const calc = pensum.materias.find((m) => m.codigo === "MAT-201")
    expect(calc?.prerequisitos).toEqual(["MAT-101"])
    expect(pensum.fuente.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(pensum.reglas.escala.formaIndice).toBe("ponderado-por-creditos")
  })

  it("normaliza a [] la materia sin prerequisitos (el schema no los exige)", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1 },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: [] },
    ])
    const pensum = pensumDe(validarPensum(base))
    expect(pensum.materias[0]?.prerequisitos).toEqual([])
  })

  it("acepta los campos opcionales bien formados", () => {
    const base = editandoMateria(pensumBase(), 1, {
      desdeCuatrimestre: 3,
      requiereTodas: false,
      observaciones: "Electiva del área de sistemas.",
    })
    base["notas"] = ["El PDF no declara la fórmula del índice; queda NO VERIFICADO en reglas."]
    base["reglas"] = reglasBase({
      honores: [
        { grado: "cum-laude", min: 85, max: 89, fuente: { url: "https://unicaribe.edu.do/reglamento.pdf", sha256: SHA, verificadoEn: "2024-05-10" } },
      ],
      requisitosHonores: { sinReprobaciones: true, exclusiones: ["Separación temporal"] },
    })
    const pensum = pensumDe(validarPensum(base))
    expect(pensum.materias[1]?.desdeCuatrimestre).toBe(3)
    expect(pensum.materias[1]?.requiereTodas).toBe(false)
    expect(pensum.notas).toHaveLength(1)
    expect(pensum.reglas.honores?.[0]?.grado).toBe("cum-laude")
    expect(pensum.reglas.requisitosHonores?.sinReprobaciones).toBe(true)
  })
})

describe("validarPensum: raíz", () => {
  it("lista los obligatorios que faltan, todos juntos", () => {
    const base = pensumBase()
    delete base["carrera"]
    delete base["slug"]
    delete base["vigente"]
    const errores = erroresDe(validarPensum(base))
    expect(errores).toContain("pensum.carrera es obligatorio")
    expect(errores).toContain("pensum.slug es obligatorio")
    expect(errores).toContain("pensum.vigente es obligatorio")
  })

  it("exige materias y reglas", () => {
    const sinMaterias = pensumBase()
    delete sinMaterias["materias"]
    expect(erroresDe(validarPensum(sinMaterias))).toContain("pensum.materias es obligatorio")
    const sinReglas = pensumBase()
    delete sinReglas["reglas"]
    expect(erroresDe(validarPensum(sinReglas))).toContain("pensum.reglas es obligatorio")
  })

  it("exige universidad.id y universidad.nombre", () => {
    const base = { ...pensumBase(), universidad: { nombre: "Universidad del Caribe" } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.universidad.id es obligatorio")
  })

  it("rechaza grado fuera del enum", () => {
    const base = { ...pensumBase(), grado: "tecnico" }
    expect(erroresDe(validarPensum(base))).toContain('pensum.grado debe ser "grado" o "postgrado"')
  })

  it("rechaza vigente que no sea booleano", () => {
    const base = { ...pensumBase(), vigente: "true" }
    expect(erroresDe(validarPensum(base))).toContain("pensum.vigente debe ser un booleano")
  })

  it("rechaza slug con mayúsculas o espacios", () => {
    const base = { ...pensumBase(), slug: "Ing Sistemas" }
    expect(erroresDe(validarPensum(base))).toContain("pensum.slug solo puede contener minúsculas, números y guiones")
  })

  it("rechaza campos desconocidos en la raíz", () => {
    const base = { ...pensumBase(), carrra: "Ingeniería" }
    expect(erroresDe(validarPensum(base))).toContain("pensum tiene un campo desconocido: carrra")
  })

  it("rechaza materias vacío o no-array", () => {
    expect(erroresDe(validarPensum({ ...pensumBase(), materias: [] }))).toContain("pensum.materias debe contener al menos una materia")
    expect(erroresDe(validarPensum({ ...pensumBase(), materias: "no" }))).toContain("pensum.materias debe ser un array")
  })
})

describe("validarPensum: fuente", () => {
  it("exige url, sha256 y verificadoEn con formato", () => {
    const base = { ...pensumBase(), fuente: { url: "no-es-una-url", sha256: "abc", verificadoEn: "10-05-2024" } }
    const errores = erroresDe(validarPensum(base))
    expect(errores).toContain("pensum.fuente.url no parece una URI válida")
    expect(errores).toContain("pensum.fuente.sha256 debe ser un hash de 64 caracteres hexadecimales en minúsculas")
    expect(errores).toContain("pensum.fuente.verificadoEn debe ser una fecha ISO aaaa-mm-dd")
  })

  it("rechaza sha256 en mayúsculas", () => {
    const base = { ...pensumBase(), fuente: { url: "https://unicaribe.edu.do/pensum-isi.pdf", sha256: "A".repeat(64), verificadoEn: "2024-05-10" } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.fuente.sha256 debe ser un hash de 64 caracteres hexadecimales en minúsculas")
  })
})

describe("validarPensum: duración y totales de raíz", () => {
  it("rechaza tipoPeriodo fuera del enum", () => {
    const base = { ...pensumBase(), duracion: { periodos: 8, tipoPeriodo: "bimestre" } }
    expect(erroresDe(validarPensum(base))).toContain('pensum.duracion.tipoPeriodo debe ser "cuatrimestre", "semestre" o "trimestre"')
  })

  it("rechaza periodos no enteros", () => {
    const base = { ...pensumBase(), duracion: { periodos: 2.5, tipoPeriodo: "cuatrimestre" } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.duracion.periodos debe ser un número entero")
  })

  it("rechaza totales.creditos por debajo del mínimo", () => {
    const base = { ...pensumBase(), totales: { asignaturas: 3, creditos: 0 } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.totales.creditos debe ser mayor o igual a 1")
  })
})

describe("validarPensum: materias", () => {
  it("rechaza creditos que no sea número", () => {
    const base = editandoMateria(pensumBase(), 1, { creditos: "4" })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].creditos debe ser un número")
  })

  it("rechaza creditos fraccionarios", () => {
    const base = editandoMateria(pensumBase(), 1, { creditos: 2.5 })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].creditos debe ser un número entero")
  })

  it("rechaza creditos negativos", () => {
    const base = editandoMateria(pensumBase(), 1, { creditos: -1 })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].creditos debe ser mayor o igual a 0")
  })

  it("rechaza cuatrimestre 0", () => {
    const base = editandoMateria(pensumBase(), 1, { cuatrimestre: 0 })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].cuatrimestre debe ser mayor o igual a 1")
  })

  it("rechaza códigos fuera del patrón", () => {
    const base = editandoMateria(pensumBase(), 1, { codigo: "mat101" })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].codigo debe tener entre 3 y 12 caracteres (solo letras mayúsculas, números y guiones)")
  })

  it("rechaza códigos duplicados", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: [] },
      { codigo: "MAT-101", nombre: "Matemática II", creditos: 4, cuatrimestre: 2, prerequisitos: [] },
    ])
    expect(erroresDe(validarPensum(base))).toContain("materias[2].codigo duplicado: MAT-101 (ya aparece en materias[0])")
  })

  it("rechaza nombre de menos de 2 caracteres", () => {
    const base = editandoMateria(pensumBase(), 1, { nombre: "X" })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].nombre debe tener al menos 2 caracteres")
  })

  it("rechaza prerequisitos que no sea array de strings", () => {
    const base1 = editandoMateria(pensumBase(), 1, { prerequisitos: "MAT-101" })
    expect(erroresDe(validarPensum(base1))).toContain("materias[1].prerequisitos debe ser un array de strings")
    const base2 = editandoMateria(pensumBase(), 1, { prerequisitos: ["MAT-101", 3] })
    expect(erroresDe(validarPensum(base2))).toContain("materias[1].prerequisitos[1] debe ser un string")
  })

  it("rechaza desdeCuatrimestre menor que 1", () => {
    const base = editandoMateria(pensumBase(), 1, { desdeCuatrimestre: 0 })
    expect(erroresDe(validarPensum(base))).toContain("materias[1].desdeCuatrimestre debe ser mayor o igual a 1")
  })

  it("rechaza campos desconocidos en una materia", () => {
    const base = editandoMateria(pensumBase(), 1, { horas: 4 })
    expect(erroresDe(validarPensum(base))).toContain("materias[1] tiene un campo desconocido: horas")
  })
})

describe("validarPensum: prerrequisitos y ciclos", () => {
  it("reporta un prerrequisito que no existe en la carrera", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: ["ZZZ-999"] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: [] },
    ])
    expect(erroresDe(validarPensum(base))).toContain("materias[0].prerequisitos[0] refiere a un código inexistente en el pensum: ZZZ-999")
  })

  it("reporta el ciclo de dos materias con la ruta completa", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: ["PRO-100"] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: ["MAT-101"] },
    ])
    expect(erroresDe(validarPensum(base))).toContain("ciclo detectado: MAT-101 -> PRO-100 -> MAT-101")
  })

  it("reporta el ciclo de tres materias", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: ["MAT-201"] },
      { codigo: "MAT-201", nombre: "Cálculo I", creditos: 4, cuatrimestre: 2, prerequisitos: ["FIS-301"] },
      { codigo: "FIS-301", nombre: "Física I", creditos: 4, cuatrimestre: 3, prerequisitos: ["MAT-101"] },
    ])
    expect(erroresDe(validarPensum(base))).toContain("ciclo detectado: MAT-101 -> MAT-201 -> FIS-301 -> MAT-101")
  })

  it("reporta un bucle sobre la propia materia", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: ["MAT-101"] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: [] },
    ])
    expect(erroresDe(validarPensum(base))).toContain("ciclo detectado: MAT-101 -> MAT-101")
  })

  it("no marca ciclo una cadena ni un diamante", () => {
    const base = conMaterias(pensumBase(), [
      { codigo: "MAT-101", nombre: "Matemática Básica", creditos: 4, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "PRO-100", nombre: "Programación I", creditos: 5, cuatrimestre: 2, prerequisitos: ["MAT-101"] },
      { codigo: "FIS-201", nombre: "Física I", creditos: 4, cuatrimestre: 3, prerequisitos: ["MAT-101"] },
      { codigo: "ING-301", nombre: "Ingeniería de Software", creditos: 4, cuatrimestre: 4, prerequisitos: ["PRO-100", "FIS-201"] },
    ])
    const pensum = pensumDe(validarPensum(base))
    expect(pensum.materias).toHaveLength(4)
  })
})

describe("validarPensum: totales y duración contra las materias reales", () => {
  it("rechaza totales.asignaturas que no cuadra", () => {
    const base = { ...pensumBase(), totales: { asignaturas: 5, creditos: 13 } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.totales.asignaturas no cuadra: declara 5 y el pensum tiene 3 materias")
  })

  it("rechaza totales.creditos que no cuadra", () => {
    const base = { ...pensumBase(), totales: { asignaturas: 3, creditos: 20 } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.totales.creditos no cuadra: declara 20 y las materias suman 13")
  })

  it("rechaza duracion.periodos menor que el cuatrimestre máximo", () => {
    const base = { ...pensumBase(), duracion: { periodos: 1, tipoPeriodo: "cuatrimestre" } }
    expect(erroresDe(validarPensum(base))).toContain("pensum.duracion.periodos (1) es menor que el cuatrimestre máximo de las materias (2)")
  })
})

describe("validarPensum: reglas", () => {
  it("rechaza escala sin formaIndice válido", () => {
    const base = { ...pensumBase(), reglas: reglasBase({ escala: { base: 100, minimo: 70, maximo: 100, aprobacion: 70, formaIndice: "no-se" } }) }
    expect(erroresDe(validarPensum(base))).toContain('pensum.reglas.escala.formaIndice debe ser "ponderado-por-creditos", "simple" o "no-verificado"')
  })

  it("rechaza honores con grado fuera del enum", () => {
    const base = {
      ...pensumBase(),
      reglas: reglasBase({
        honores: [{ grado: "super", min: 98, max: 100, fuente: { url: "https://unicaribe.edu.do/reglamento.pdf", sha256: SHA, verificadoEn: "2024-05-10" } }],
      }),
    }
    expect(erroresDe(validarPensum(base))).toContain('pensum.reglas.honores[0].grado debe ser "cum-laude", "magna-cum-laude", "summa-cum-laude", "cuadro-de-honor" o "otros"')
  })

  it("rechaza requisitosHonores.sinReprobaciones que no sea booleano", () => {
    const base = { ...pensumBase(), reglas: reglasBase({ requisitosHonores: { sinReprobaciones: "si" } }) }
    expect(erroresDe(validarPensum(base))).toContain("pensum.reglas.requisitosHonores.sinReprobaciones debe ser un booleano")
  })
})

describe("validarPensum: notas", () => {
  it("rechaza notas con elementos que no son strings", () => {
    const base = { ...pensumBase(), notas: ["ok", 3] }
    expect(erroresDe(validarPensum(base))).toContain("pensum.notas[1] debe ser un string")
  })
})

describe("parsearPensum", () => {
  it("parsea y valida un JSON válido", () => {
    const r = parsearPensum(JSON.stringify(pensumBase()))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pensum.slug).toBe("ing-sistemas")
  })

  it("devuelve JSON inválido tipado cuando el texto no parsea", () => {
    const errores = erroresDe(parsearPensum('{"carrera":'))
    expect(errores[0]?.startsWith("JSON inválido:")).toBe(true)
  })

  it("valida igual que validarPensum cuando el JSON es correcto pero el esquema no", () => {
    const errores = erroresDe(parsearPensum('{"carrera": "X"}'))
    expect(errores).toContain("pensum.slug es obligatorio")
  })

  it("rechaza JSON de tipo primitivo", () => {
    const errores = erroresDe(parsearPensum("42"))
    expect(errores).toContain("pensum debe ser un objeto")
  })
})

describe("buscarMateria y buscarPorCuatrimestre", () => {
  it("encuentra una materia por código exacto", () => {
    const pensum = pensumDe(validarPensum(pensumBase()))
    expect(buscarMateria(pensum, "MAT-201")?.nombre).toBe("Cálculo I")
  })

  it("devuelve null si el código no existe", () => {
    const pensum = pensumDe(validarPensum(pensumBase()))
    expect(buscarMateria(pensum, "ZZZ-999")).toBeNull()
  })

  it("devuelve las materias del cuatrimestre ordenadas por código", () => {
    const pensum = pensumDe(validarPensum(pensumBase()))
    const delDos = buscarPorCuatrimestre(pensum, 2)
    expect(delDos.map((m) => m.codigo)).toEqual(["MAT-201", "PRO-100"])
  })

  it("devuelve [] si el cuatrimestre no tiene materias", () => {
    const pensum = pensumDe(validarPensum(pensumBase()))
    expect(buscarPorCuatrimestre(pensum, 9)).toEqual([])
  })
})