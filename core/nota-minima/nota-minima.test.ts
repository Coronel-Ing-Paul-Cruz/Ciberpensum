import { describe, it, expect } from "vitest"
import { promedioNecesario, esAlcanzable, notaMinimaPara } from "./nota-minima.js"
import type { EscalaAcademica } from "./nota-minima.js"

// Escala de PRUEBA (datos de prueba, no una regla academica): 0-100, se
// aprueba con 70. La escala real siempre viene de data/curated/ con su fuente;
// fija un 70 a mano aqui seria inventar una regla (regla 4 de AGENTS.md).
const escala: EscalaAcademica = { minimo: 70, maximo: 100, aprobacion: 70 }

describe("promedioNecesario", () => {
  it("pondera por credito: (objetivo*(C+Cx) - indiceActual*C) / Cx", () => {
    // 88 + (88-85)*12/6 = 94: con 12 creditos ya hechos y 6 por cursar, para
    // acabar en 88 hace falta un 94 en lo que queda.
    expect(promedioNecesario(85, 12, 6, 88)).toBe(94)
  })

  it("devuelve la nota aunque supere la escala: el llamante decide si es alcanzable", () => {
    // (90*14 - 80*10)/4 = 115 > 100. Este modulo no pone techo.
    expect(promedioNecesario(80, 10, 4, 90)).toBe(115)
  })

  it("devuelve null si no hay creditos por cursar (Cx <= 0)", () => {
    expect(promedioNecesario(85, 12, 0, 88)).toBeNull()
    expect(promedioNecesario(85, 12, -3, 88)).toBeNull()
  })

  it("estudiante nuevo: sin creditos completados, la nota necesaria es el objetivo", () => {
    expect(promedioNecesario(0, 0, 5, 80)).toBe(80)
  })

  it("objetivo por debajo del indice actual: devuelve el numero bajo, sin piso", () => {
    // (80*14 - 95*10)/4 = 42.5. El piso de aprobacion NO es asunto de esta
    // funcion: lo aplica notaMinimaPara.
    expect(promedioNecesario(95, 10, 4, 80)).toBe(42.5)
  })
})

describe("esAlcanzable", () => {
  it("true si el promedio necesario cabe en la escala", () => {
    expect(esAlcanzable(85, 12, 6, 88, escala)).toBe(true) // 94 <= 100
  })

  it("false si necesitaria mas de escala.maximo", () => {
    expect(esAlcanzable(80, 10, 4, 90, escala)).toBe(false) // 115 > 100
  })

  it("frontera: exactamente escala.maximo sigue siendo alcanzable", () => {
    expect(esAlcanzable(80, 10, 10, 90, escala)).toBe(true) // 100 exacto
  })

  it("frontera: un centavo mas de escala.maximo ya no", () => {
    expect(esAlcanzable(80, 10, 10, 90.1, escala)).toBe(false) // 100.2
  })

  it("false cuando no hay creditos por cursar (promedioNecesario es null)", () => {
    expect(esAlcanzable(85, 12, 0, 88, escala)).toBe(false)
  })

  it("no exige superar escala.minimo: eso es asunto del llamante", () => {
    // (50*20 - 95*10)/10 = 5 < 70, pero cabe en la escala, asi que es
    // alcanzable. El contrato reparte asi las responsabilidades.
    expect(esAlcanzable(95, 10, 10, 50, escala)).toBe(true)
  })
})

describe("notaMinimaPara", () => {
  it("devuelve la nota necesaria en la materia", () => {
    expect(notaMinimaPara(85, 12, 6, 88, escala)).toBe(94)
  })

  it("null si ni con la nota maxima de la escala se llega", () => {
    expect(notaMinimaPara(80, 10, 4, 90, escala)).toBeNull() // necesitaria 115
    expect(esAlcanzable(80, 10, 4, 90, escala)).toBe(false)
  })

  it("redondea hacia arriba a 2 decimales: 87.451 -> 87.46", () => {
    // Ejemplo literal del contrato. Datos sinteticos: el indice 87.449 se
    // eligio para que el promedio exacto sea 87.451. Con redondeo normal
    // (Math.round) saldria 87.45, que dejaria el indice por debajo del objetivo.
    expect(notaMinimaPara(87.449, 10, 10, 87.45, escala)).toBe(87.46)
  })

  it("redondea hacia arriba tambien con decimales infinitos: 87.4533... -> 87.46", () => {
    // (87.42*13 - 87.41*10)/3 = 87.4533...
    expect(notaMinimaPara(87.41, 10, 3, 87.42, escala)).toBe(87.46)
  })

  it("ya supera el objetivo sin cursar: el piso es aprobar la materia, nunca 0", () => {
    // Indice 95 >= objetivo 80; el promedio necesario seria 42.5, pero una
    // reprobada rompe el indice acumulado y los honores (Art. 89), asi que
    // exige escala.aprobacion. Decision conservadora anotada: jamas devuelve
    // 0; un 0 solo saldria si la propia escala tuviera aprobacion = 0.
    expect(notaMinimaPara(95, 10, 4, 80, escala)).toBe(70)
  })

  it("'ya supera' no es atajo si quedan pocos creditos: exige la nota real", () => {
    // Indice 96 >= objetivo 95, pero con 10 creditos y solo 1 por cursar un
    // 70 dejaria el indice en (96*10 + 70*1)/11 = 93.6 < 95. Hace falta 85:
    // devolver 70 aqui prometeria algo que la formula no cumple.
    expect(notaMinimaPara(96, 10, 1, 95, escala)).toBe(85)
  })

  it("null si la materia no tiene creditos", () => {
    expect(notaMinimaPara(85, 12, 0, 88, escala)).toBeNull()
    expect(notaMinimaPara(85, 12, -2, 88, escala)).toBeNull()
  })

  it("frontera de la escala: nota maxima exacta se devuelve, un centavo mas es null", () => {
    expect(notaMinimaPara(80, 10, 10, 90, escala)).toBe(100) // 100 exacto
    expect(notaMinimaPara(80, 10, 10, 90.1, escala)).toBeNull() // 100.2
  })

  it("frontera de aprobacion: si el promedio justo llega a aprobacion, se queda ahi", () => {
    expect(notaMinimaPara(70, 10, 5, 70, escala)).toBe(70)
  })

  it("si el promedio calculado supera aprobacion, el piso no lo baja", () => {
    // (70.5*15 - 70*10)/5 = 71.5 > 70: se devuelve 71.5, sin recortar a 70.
    expect(notaMinimaPara(70, 10, 5, 70.5, escala)).toBe(71.5)
  })

  it("escala malformada (aprobacion > maximo): null, no una nota fuera de escala", () => {
    // Conservador: el contrato promete una nota en 0..maximo; si el propio piso
    // excede el maximo, no existe nota valida y se devuelve null.
    const rota: EscalaAcademica = { minimo: 70, maximo: 100, aprobacion: 150 }
    expect(notaMinimaPara(85, 12, 6, 88, rota)).toBeNull()
  })
})
