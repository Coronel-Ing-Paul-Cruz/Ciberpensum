import { describe, it, expect } from "vitest"
import {
  materiasDisponibles,
  motivosBloqueo,
  creditosAprobados,
  creditosFaltantes,
  cuatrimestresRestantes,
  siguienteEstadoAlClic,
} from "./progresion.js"
import type { MateriaPlan, EstadoClic } from "./progresion.js"

/**
 * core/progresion — inscripcion, bloqueos y saldo crediticio de un plan.
 *
 * Test PRIMERO: este archivo existio y fallaba antes de que existiera
 * progresion.ts. El contrato es el que se acordo; lo que el contrato no dice
 * queda documentado aqui como decision conservadora, no inventado.
 */

const plan: MateriaPlan[] = [
  { codigo: "MAT101", nombre: "Algebra", creditos: 4, cuatrimestre: 1, prerequisitos: [] },
  { codigo: "FIS101", nombre: "Fisica I", creditos: 3, cuatrimestre: 2, prerequisitos: ["MAT101"] },
  { codigo: "FIS201", nombre: "Fisica II", creditos: 3, cuatrimestre: 3, prerequisitos: ["FIS101"] },
  { codigo: "HUM101", nombre: "Comunicacion", creditos: 2, cuatrimestre: 3, prerequisitos: [] },
  {
    codigo: "TFG",
    nombre: "Trabajo de Graduacion",
    creditos: 4,
    cuatrimestre: 5,
    prerequisitos: ["FIS201"],
    requiereTodas: true,
  },
]

/** Total del plan: 4+3+3+2+4. */
const TOTAL_CREDITOS = 16

const codigos = (m: MateriaPlan[]): string[] => m.map((x) => x.codigo)

describe("materiasDisponibles", () => {
  it("prerequisito insatisfecho: la materia no aparece", () => {
    expect(codigos(materiasDisponibles(plan, new Set()))).toEqual(["MAT101", "HUM101"])
  })

  it("prerequisito satisfecho: la materia aparece", () => {
    expect(codigos(materiasDisponibles(plan, new Set(["MAT101"])))).toContain("FIS101")
  })

  it("nunca incluye una materia ya aprobada", () => {
    const res = codigos(materiasDisponibles(plan, new Set(["MAT101", "HUM101"])))
    expect(res).not.toContain("MAT101")
    expect(res).not.toContain("HUM101")
    expect(res).toEqual(["FIS101"])
  })

  it("requiereTodas con plan incompleto: no se ofrece", () => {
    const aprobadas = new Set(["MAT101", "FIS101", "FIS201"])
    const res = materiasDisponibles(plan, aprobadas)
    expect(codigos(res)).toEqual(["HUM101"])
    expect(codigos(res)).not.toContain("TFG")
  })

  it("requiereTodas con plan completo: se ofrece aunque sus prerequisitos digan otra cosa", () => {
    const aprobadas = new Set(["MAT101", "FIS101", "FIS201", "HUM101"])
    expect(codigos(materiasDisponibles(plan, aprobadas))).toEqual(["TFG"])
  })

  it("requiereTodas en plan de una sola materia: vaciamente se cumple", () => {
    const uniplemente: MateriaPlan[] = [
      { codigo: "TFG", nombre: "TFG", creditos: 4, cuatrimestre: 5, prerequisitos: [], requiereTodas: true },
    ]
    expect(codigos(materiasDisponibles(uniplemente, new Set()))).toEqual(["TFG"])
  })

  it("dos materias con requiereTodas: sin ninguna aprobada se bloquean entre si (lectura literal, conservadora)", () => {
    const cruzadas: MateriaPlan[] = [
      { codigo: "A", nombre: "A", creditos: 1, cuatrimestre: 1, prerequisitos: [], requiereTodas: true },
      { codigo: "B", nombre: "B", creditos: 1, cuatrimestre: 1, prerequisitos: [], requiereTodas: true },
    ]
    expect(codigos(materiasDisponibles(cruzadas, new Set()))).toEqual([])
    expect(codigos(materiasDisponibles(cruzadas, new Set(["A"])))).toEqual(["B"])
  })

  it("sin cuatrimestreActual se ignoran las restricciones temporales", () => {
    expect(codigos(materiasDisponibles(plan, new Set()))).toEqual(["MAT101", "HUM101"])
  })

  it("con cuatrimestreActual exige cuatrimestreActual >= desdeCuatrimestre ?? cuatrimestre", () => {
    const aprobadas = new Set(["MAT101"])
    expect(codigos(materiasDisponibles(plan, aprobadas, 1))).toEqual([])
    expect(codigos(materiasDisponibles(plan, aprobadas, 3))).toEqual(["FIS101", "HUM101"])
  })

  it("desdeCuatrimestre manda aunque el cuatrimestre propio sea anterior", () => {
    const conDesde: MateriaPlan[] = [
      { codigo: "LAB101", nombre: "Laboratorio", creditos: 2, cuatrimestre: 1, prerequisitos: [], desdeCuatrimestre: 3 },
    ]
    expect(codigos(materiasDisponibles(conDesde, new Set(), 2))).toEqual([])
    expect(codigos(materiasDisponibles(conDesde, new Set(), 3))).toEqual(["LAB101"])
    expect(codigos(materiasDisponibles(conDesde, new Set(), undefined))).toEqual(["LAB101"])
  })

  it("desdeCuatrimestre tambien puede adelantar respecto al cuatrimestre del plan", () => {
    const adelantada: MateriaPlan[] = [
      { codigo: "OPT101", nombre: "Optativa", creditos: 2, cuatrimestre: 3, prerequisitos: [], desdeCuatrimestre: 1 },
    ]
    expect(codigos(materiasDisponibles(adelantada, new Set(), 1))).toEqual(["OPT101"])
  })

  it("requiereTodas tambien respeta el cuatrimestre", () => {
    const aprobadas = new Set(["MAT101", "FIS101", "FIS201", "HUM101"])
    expect(codigos(materiasDisponibles(plan, aprobadas, 4))).toEqual([])
    expect(codigos(materiasDisponibles(plan, aprobadas, 5))).toEqual(["TFG"])
  })

  it("plan vacio: nada disponible", () => {
    expect(materiasDisponibles([], new Set(), 1)).toEqual([])
  })
})

describe("motivosBloqueo", () => {
  it("sin bloqueos: lista vacia", () => {
    expect(motivosBloqueo(plan[0]!, new Set(), 1)).toEqual([])
  })

  it("falta aprobar el prerequisito", () => {
    const fis101 = plan[1]!
    expect(motivosBloqueo(fis101, new Set(), 2)).toEqual([
      { tipo: "aprobar-prerequisito", codigo: "MAT101" },
    ])
  })

  it("varios prerequisitos pendientes, en el orden declarado", () => {
    const materia: MateriaPlan = {
      codigo: "X",
      nombre: "X",
      creditos: 1,
      cuatrimestre: 1,
      prerequisitos: ["B", "A"],
    }
    expect(motivosBloqueo(materia, new Set(), 1)).toEqual([
      { tipo: "aprobar-prerequisito", codigo: "B" },
      { tipo: "aprobar-prerequisito", codigo: "A" },
    ])
  })

  it("acumula prerequisito y cuatrimestre, en ese orden", () => {
    expect(motivosBloqueo(plan[1]!, new Set(), 1)).toEqual([
      { tipo: "aprobar-prerequisito", codigo: "MAT101" },
      { tipo: "desde-cuatrimestre", desde: 2 },
    ])
  })

  it("solo cuatrimestre cuando el prerequisito ya esta aprobado", () => {
    expect(motivosBloqueo(plan[1]!, new Set(["MAT101"]), 1)).toEqual([
      { tipo: "desde-cuatrimestre", desde: 2 },
    ])
  })

  it("requiereTodas: informa requiere-todas y NO exige sus prerequisitos", () => {
    const tfg = plan[4]!
    expect(motivosBloqueo(tfg, new Set(), 5)).toEqual([{ tipo: "requiere-todas" }])
  })

  it("requiereTodas no es comprobable sin el plan: se informa siempre (conservador)", () => {
    const tfg = plan[4]!
    const todoElResto = new Set(["MAT101", "FIS101", "FIS201", "HUM101"])
    expect(motivosBloqueo(tfg, todoElResto, 5)).toEqual([{ tipo: "requiere-todas" }])
  })

  it("acumula cuatrimestre y requiere-todas", () => {
    expect(motivosBloqueo(plan[4]!, new Set(), 2)).toEqual([
      { tipo: "desde-cuatrimestre", desde: 5 },
      { tipo: "requiere-todas" },
    ])
  })

  it("materia ya aprobada: el contrato no tiene motivo para eso, no se inventa", () => {
    expect(motivosBloqueo(plan[0]!, new Set(["MAT101"]), 1)).toEqual([])
  })

  it("coincide con materiasDisponibles: disponible sin requiereTodas <=> sin motivos", () => {
    const aprobadas = new Set(["MAT101"])
    const cuatri = 2
    const disponibles = new Set(codigos(materiasDisponibles(plan, aprobadas, cuatri)))
    for (const m of plan) {
      if (aprobadas.has(m.codigo)) continue
      if (m.requiereTodas) continue
      const sinMotivos = motivosBloqueo(m, aprobadas, cuatri).length === 0
      expect(sinMotivos).toBe(disponibles.has(m.codigo))
    }
  })
})

describe("creditosAprobados", () => {
  it("conjunto vacio: 0 creditos", () => {
    expect(creditosAprobados(plan, new Set())).toBe(0)
  })

  it("suma los creditos de lo aprobado", () => {
    expect(creditosAprobados(plan, new Set(["MAT101", "FIS101"]))).toBe(7)
  })

  it("ignora codigos que no estan en el plan", () => {
    expect(creditosAprobados(plan, new Set(["MAT101", "OTRA999"]))).toBe(4)
  })

  it("plan completo: el total", () => {
    expect(
      creditosAprobados(plan, new Set(["MAT101", "FIS101", "FIS201", "HUM101", "TFG"])),
    ).toBe(TOTAL_CREDITOS)
  })
})

describe("creditosFaltantes", () => {
  it("conjunto vacio: todo el plan", () => {
    expect(creditosFaltantes(plan, new Set())).toBe(TOTAL_CREDITOS)
  })

  it("descuenta lo aprobado", () => {
    expect(creditosFaltantes(plan, new Set(["MAT101", "FIS101"]))).toBe(9)
  })

  it("plan completo: 0", () => {
    expect(
      creditosFaltantes(plan, new Set(["MAT101", "FIS101", "FIS201", "HUM101", "TFG"])),
    ).toBe(0)
  })
})

describe("cuatrimestresRestantes", () => {
  it("plan completo: 0", () => {
    expect(
      cuatrimestresRestantes(plan, new Set(["MAT101", "FIS101", "FIS201", "HUM101", "TFG"])),
    ).toBe(0)
  })

  it("plan vacio: 0", () => {
    expect(cuatrimestresRestantes([], new Set())).toBe(0)
  })

  it("sin aprobar nada: primer cuatrimestre", () => {
    expect(cuatrimestresRestantes(plan, new Set())).toBe(1)
  })

  it("primer cuatrimestre donde aun queda materia sin aprobar", () => {
    expect(cuatrimestresRestantes(plan, new Set(["MAT101"]))).toBe(2)
    expect(cuatrimestresRestantes(plan, new Set(["MAT101", "FIS101"]))).toBe(3)
    expect(cuatrimestresRestantes(plan, new Set(["MAT101", "FIS101", "FIS201", "HUM101"]))).toBe(5)
  })

  it("cuatrimestre invalido en el plan se trata como el 1 (el resultado es >= 1)", () => {
    const rara: MateriaPlan[] = [
      { codigo: "Z", nombre: "Z", creditos: 1, cuatrimestre: 0, prerequisitos: [] },
    ]
    expect(cuatrimestresRestantes(rara, new Set())).toBe(1)
    expect(cuatrimestresRestantes(rara, new Set(["Z"]))).toBe(0)
  })
})

describe("siguienteEstadoAlClic", () => {
  // Ciclo acordado 2026-10-10: sin estado -> aprobada -> en curso -> sin estado.
  // Lo ya registrado (aprobada o en curso) SIEMPRE se puede corregir con un
  // clic mas, aunque la materia este bloqueada (`habilitada = false`).
  it("1) Aprobada (presente en aprobadas) con clic: pasa a en curso y pierde la nota, aunque no este habilitada", () => {
    const estado: EstadoClic = {
      aprobadas: { MAT101: { nota: 90 }, FIS101: { nota: 80 } },
      enCurso: [],
    }
    const res = siguienteEstadoAlClic(estado, "MAT101", false, 70)
    expect(res.aprobadas.MAT101).toBeUndefined()
    expect(res.aprobadas.FIS101).toEqual({ nota: 80 }) // el resto se conserva
    expect(res.enCurso).toEqual(["MAT101"])
  })

  it("1b) Aprobada con nota debajo de la aprobacion: el clic tambien la pasa a en curso", () => {
    const estado: EstadoClic = { aprobadas: { MAT101: { nota: 60 } }, enCurso: [] }
    const res = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(res.aprobadas).toEqual({})
    expect(res.enCurso).toEqual(["MAT101"])
  })

  it("1c) Aprobada que ademas figura en enCurso (dato corrupto): pasa a en curso sin duplicar", () => {
    const estado: EstadoClic = { aprobadas: { MAT101: { nota: 80 } }, enCurso: ["MAT101"] }
    const res = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(res.aprobadas.MAT101).toBeUndefined()
    expect(res.enCurso).toEqual(["MAT101"])
    expect(Object.is(res.enCurso, estado.enCurso)).toBe(true) // misma lista, sin duplicado
  })

  it("2) En curso con clic: vuelve a sin estado, aunque no este habilitada", () => {
    const estado: EstadoClic = { aprobadas: {}, enCurso: ["MAT101", "FIS101"] }
    const res = siguienteEstadoAlClic(estado, "MAT101", false, 70)
    expect(res.enCurso).toEqual(["FIS101"]) // solo se quita la del clic
    expect(res.aprobadas).toEqual({})
  })

  it("3) Sin estado + habilitada: queda aprobada con la nota por defecto", () => {
    const estado: EstadoClic = { aprobadas: {}, enCurso: ["FIS101"] }
    const res = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(res.aprobadas.MAT101).toEqual({ nota: 70 })
    expect(res.enCurso).toEqual(["FIS101"]) // el resto de en curso se conserva
  })

  it("3b) Sin estado + no habilitada: no cambia (devuelve el mismo objeto)", () => {
    const estado: EstadoClic = { aprobadas: {}, enCurso: [] }
    const res = siguienteEstadoAlClic(estado, "HUM101", false, 70)
    expect(Object.is(res, estado)).toBe(true)
  })

  it("ciclo completo: sin estado -> aprobada -> en curso -> sin estado", () => {
    let estado: EstadoClic = { aprobadas: {}, enCurso: [] }
    estado = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(estado.aprobadas.MAT101).toEqual({ nota: 70 })
    expect(estado.enCurso).toEqual([])
    estado = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(estado.aprobadas.MAT101).toBeUndefined()
    expect(estado.enCurso).toEqual(["MAT101"])
    estado = siguienteEstadoAlClic(estado, "MAT101", false, 70)
    expect(estado.aprobadas).toEqual({})
    expect(estado.enCurso).toEqual([])
  })

  it("no muta las entradas: devuelve objetos nuevos y el original queda intacto", () => {
    const aprobadasOrig: Record<string, { nota: number }> = { MAT101: { nota: 85 } }
    const enCursoOrig = ["FIS101"]
    const estado: EstadoClic = { aprobadas: aprobadasOrig, enCurso: enCursoOrig }
    const res = siguienteEstadoAlClic(estado, "MAT101", true, 70)
    expect(Object.is(res.aprobadas, aprobadasOrig)).toBe(false)
    expect(Object.is(res.enCurso, enCursoOrig)).toBe(false)
    expect(aprobadasOrig.MAT101).toEqual({ nota: 85 })
    expect(enCursoOrig).toEqual(["FIS101"])
  })
})
