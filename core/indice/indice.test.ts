import { describe, it, expect } from "vitest"
import { calcularIndiceAcumulado, redondearIndice, escalaCumple } from "./indice.js"

// Primer test del proyecto: fija el contrato antes de que exista la
// implementacion. Si esto pasa, el gate tiene algo que inyectar.
describe("calcularIndiceAcumulado", () => {
  it("promedia las notas por credito, no simple", () => {
    // 3 creditos a 100 y 1 credito a 50: media simple = 75, ponderada = 87.5
    const indice = calcularIndiceAcumulado([
      { nota: 100, creditos: 3 },
      { nota: 50, creditos: 1 },
    ])
    expect(indice).toBe(87.5)
  })

  it("devuelve 0 si no hay materias cursadas", () => {
    expect(calcularIndiceAcumulado([])).toBe(0)
  })

  it("redondea a dos decimales como la universidad", () => {
    expect(redondearIndice(87.4567)).toBe(87.46)
  })
})

describe("escalaCumple", () => {
  it("rechaza una materia reprobada aunque el indice sea alto", () => {
    const escala = { minimo: 70, maximo: 100 }
    const notas = [
      { nota: 100, creditos: 3 },
      { nota: 40, creditos: 1 }, // reprobada
    ]
    // Art. 85 UNICARIBE: se aprueba con minimo 70
    expect(escalaCumple(notas, escala)).toBe(false)
  })

  it("acepta si todas superan el minimo", () => {
    const escala = { minimo: 70, maximo: 100 }
    expect(escalaCumple([{ nota: 70, creditos: 3 }], escala)).toBe(true)
  })
})