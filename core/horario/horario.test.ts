import { describe, it, expect } from "vitest"
import type { MateriaPlan } from "./horario.js"
import {
  cabenEn,
  criticidad,
  creditosPorCuatrimestre,
  creditosTotales,
  dependenciasDirectas,
  dependenciasTransitivas,
  elegirCarga,
} from "./horario.js"

// Contexto del proyecto (NO VERIFICADO en ESTADO.md): el PDF del pensum no
// registra horas semanales, asi que este modulo NO fabrica horarios por horas.
// Solo planifica carga (creditos vs capacidad) y mide criticidad de materias.
// La cadena de ejemplo: B depende de A, C depende de B (y transitivamente de A).

function cadena(): MateriaPlan[] {
  return [
    { codigo: "A", nombre: "Introduccion", creditos: 3, cuatrimestre: 1, prerequisitos: [] },
    { codigo: "B", nombre: "Intermedia", creditos: 4, cuatrimestre: 2, prerequisitos: ["A"] },
    { codigo: "C", nombre: "Avanzada", creditos: 2, cuatrimestre: 3, prerequisitos: ["B"] },
  ]
}

describe("dependenciasDirectas", () => {
  it("devuelve solo las materias cuyo prerequisito directo es codigo", () => {
    expect(dependenciasDirectas(cadena(), "A")).toEqual(["B"])
    expect(dependenciasDirectas(cadena(), "B")).toEqual(["C"])
  })

  it("hoja o codigo inexistente: lista vacia", () => {
    expect(dependenciasDirectas(cadena(), "C")).toEqual([])
    expect(dependenciasDirectas(cadena(), "ZZZ")).toEqual([])
    expect(dependenciasDirectas([], "A")).toEqual([])
  })
})

describe("dependenciasTransitivas", () => {
  it("incluye directas y transitivas, en orden del plan", () => {
    // Plan en orden distinto al de la dependencia (C, A, B): fija que la salida
    // sigue el orden del plan, no la profundidad del grafo.
    const plan: MateriaPlan[] = [
      { codigo: "C", nombre: "Avanzada", creditos: 2, cuatrimestre: 3, prerequisitos: ["B"] },
      { codigo: "A", nombre: "Introduccion", creditos: 3, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "B", nombre: "Intermedia", creditos: 4, cuatrimestre: 2, prerequisitos: ["A"] },
    ]
    expect(dependenciasTransitivas(plan, "A")).toEqual(["C", "B"])
  })

  it("A→B→C: de A salen B y C", () => {
    expect(dependenciasTransitivas(cadena(), "A")).toEqual(["B", "C"])
  })

  it("hoja: vacia", () => {
    expect(dependenciasTransitivas(cadena(), "C")).toEqual([])
    expect(dependenciasTransitivas([], "A")).toEqual([])
  })

  it("no cuenta la propia materia aunque haya ciclo en el grafo", () => {
    const ciclo: MateriaPlan[] = [
      { codigo: "A", nombre: "A", creditos: 1, cuatrimestre: 1, prerequisitos: ["B"] },
      { codigo: "B", nombre: "B", creditos: 1, cuatrimestre: 1, prerequisitos: ["A"] },
    ]
    expect(dependenciasTransitivas(ciclo, "A")).toEqual(["B"])
    expect(dependenciasTransitivas(ciclo, "B")).toEqual(["A"])
  })
})

describe("criticidad", () => {
  it("cuenta dependencias transitivas: A=2, B=1", () => {
    expect(criticidad(cadena(), "A")).toBe(2)
    expect(criticidad(cadena(), "B")).toBe(1)
  })

  it("hoja: 0", () => {
    expect(criticidad(cadena(), "C")).toBe(0)
  })

  it("codigo inexistente: 0 (comportamiento conservador)", () => {
    expect(criticidad(cadena(), "ZZZ")).toBe(0)
  })
})

describe("creditosTotales", () => {
  it("suma los creditos del conjunto", () => {
    expect(creditosTotales(cadena())).toBe(9)
  })

  it("vacio: 0", () => {
    expect(creditosTotales([])).toBe(0)
  })
})

describe("cabenEn", () => {
  it("vacio cabe en cualquier capacidad, incluso 0", () => {
    expect(cabenEn([], 0)).toBe(true)
  })

  it("verdadero si la suma no supera la capacidad", () => {
    expect(cabenEn(cadena(), 9)).toBe(true)
    expect(cabenEn(cadena(), 10)).toBe(true)
  })

  it("falso si la suma supera la capacidad", () => {
    expect(cabenEn(cadena(), 8)).toBe(false)
  })
})

describe("elegirCarga", () => {
  // Prioridad acordada: (cuatrimestre asc, criticidad desc, creditos desc, codigo asc).

  it("prioriza criticidad, luego creditos, luego codigo", () => {
    const disponibles: MateriaPlan[] = [
      { codigo: "B", nombre: "B", creditos: 2, cuatrimestre: 1, prerequisitos: ["A"] },
      { codigo: "A", nombre: "A", creditos: 1, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "C", nombre: "C", creditos: 4, cuatrimestre: 1, prerequisitos: ["A"] },
      { codigo: "D", nombre: "D", creditos: 3, cuatrimestre: 1, prerequisitos: ["A"] },
    ]
    // criticidad dentro del conjunto: A=3 (B, C y D dependen de ella), resto 0.
    // Orden: A (crit 3); luego creditos desc: C(4), D(3), B(2).
    expect(elegirCarga(disponibles, 100).map((m) => m.codigo)).toEqual(["A", "C", "D", "B"])
  })

  it("el cuatrimestre del plan manda antes que la criticidad", () => {
    const disponibles: MateriaPlan[] = [
      { codigo: "H", nombre: "H", creditos: 1, cuatrimestre: 2, prerequisitos: [] },
      { codigo: "X", nombre: "X", creditos: 1, cuatrimestre: 2, prerequisitos: ["H"] },
      { codigo: "Y", nombre: "Y", creditos: 1, cuatrimestre: 2, prerequisitos: ["H"] },
      { codigo: "L", nombre: "L", creditos: 1, cuatrimestre: 1, prerequisitos: [] },
    ]
    // H tiene criticidad 2 (X e Y dependen de ella), pero L es del cuatrimestre 1.
    // Orden: L (cuat 1) primero aunque su criticidad sea 0; luego cuat 2 por
    // criticidad desc: H; luego X antes de Y por codigo asc.
    expect(elegirCarga(disponibles, 100).map((m) => m.codigo)).toEqual(["L", "H", "X", "Y"])
  })

  it("capacidad justa: entra todo", () => {
    const disponibles: MateriaPlan[] = [
      { codigo: "A", nombre: "A", creditos: 2, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "B", nombre: "B", creditos: 3, cuatrimestre: 1, prerequisitos: ["A"] },
    ]
    expect(elegirCarga(disponibles, 5).map((m) => m.codigo)).toEqual(["A", "B"])
  })

  it("capacidad insuficiente incluso para una sola: seleccion vacia", () => {
    const disponibles: MateriaPlan[] = [
      { codigo: "A", nombre: "A", creditos: 2, cuatrimestre: 1, prerequisitos: [] },
    ]
    expect(elegirCarga(disponibles, 0)).toEqual([])
    expect(elegirCarga(disponibles, 1)).toEqual([])
    expect(elegirCarga([], 10)).toEqual([])
  })

  it("materia que no cabe sola en el medio: se salta y sigue con las demas", () => {
    // Orden por prioridad: P1 (crit 2, 2 cr), P2 (crit 1, 5 cr), P3 (crit 0, 1 cr).
    // Con capacidad 3: P1 entra (2), P2 ya no cabe (2+5=7 > 3) y NO bloquea a P3 (2+1=3).
    const disponibles: MateriaPlan[] = [
      { codigo: "P1", nombre: "P1", creditos: 2, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "P2", nombre: "P2", creditos: 5, cuatrimestre: 1, prerequisitos: ["P1"] },
      { codigo: "P3", nombre: "P3", creditos: 1, cuatrimestre: 1, prerequisitos: ["P2"] },
    ]
    const carga = elegirCarga(disponibles, 3)
    expect(carga.map((m) => m.codigo)).toEqual(["P1", "P3"])
    expect(creditosTotales(carga)).toBe(3)
  })
})

describe("creditosPorCuatrimestre", () => {
  it("acumula creditos por cuatrimestre, claves en orden ascendente", () => {
    const plan: MateriaPlan[] = [
      { codigo: "X", nombre: "X", creditos: 3, cuatrimestre: 3, prerequisitos: [] },
      { codigo: "Y", nombre: "Y", creditos: 2, cuatrimestre: 1, prerequisitos: [] },
      { codigo: "Z", nombre: "Z", creditos: 1, cuatrimestre: 1, prerequisitos: [] },
    ]
    expect([...creditosPorCuatrimestre(plan).entries()]).toEqual([
      [1, 3],
      [3, 3],
    ])
  })

  it("sin materias: mapa vacio", () => {
    expect(creditosPorCuatrimestre([]).size).toBe(0)
  })
})