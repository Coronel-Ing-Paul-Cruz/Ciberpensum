/**
 * core/nota-minima — nota minima que hay que sacar para alcanzar un objetivo
 * de indice academico.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento del navegador (regla 3 de
 *   AGENTS.md). Si necesitas alguna de esas APIs, la funcion no va aqui.
 * - La escala (maximo, minimo de aprobacion) NUNCA se fija aqui: viene de
 *   `data/curated/` con su fuente. Un "70" escrito a mano seria una regla
 *   academica inventada.
 * - El techo de la escala lo decide quien llama: `promedioNecesario` devuelve
 *   el numero aunque supere `maximo`; `esAlcanzable` y `notaMinimaPara` son
 *   los que lo comparan contra la escala.
 */

/** Escala academica de una universidad, tal como viene del reglamento. */
export interface EscalaAcademica {
  /** Nota minima para aprobar la materia (UNICARIBE: 70, Art. 85). */
  minimo: number
  /** Nota maxima de la escala (UNICARIBE: 100). */
  maximo: number
  /** Nota con la que se aprueba; piso de notaMinimaPara (a veces distinto de `minimo`). */
  aprobacion: number
}

/** Una materia con su nota final y sus creditos. */
export interface NotaConCreditos {
  nota: number
  creditos: number
}

/**
 * Promedio (ponderado por credito) que hay que sacar en los proximos
 * `creditosPorCursar` creditos para que el indice acumulado llegue a
 * `indiceObjetivo`.
 *
 * Formula: nota = (objetivo*(C+Cx) - indiceActual*C) / Cx
 *
 * Devuelve el numero aunque supere la escala: el llamante decide si es
 * alcanzable. No aplica ningun piso: eso es asunto de `notaMinimaPara`.
 *
 * @returns null si `creditosPorCursar <= 0` (no hay donde mejorar el indice).
 */
export function promedioNecesario(
  indiceActual: number,
  creditosCompletados: number,
  creditosPorCursar: number,
  indiceObjetivo: number
): number | null {
  if (creditosPorCursar <= 0) return null
  return (
    (indiceObjetivo * (creditosCompletados + creditosPorCursar) -
      indiceActual * creditosCompletados) /
    creditosPorCursar
  )
}

/**
 * Indica si el objetivo es alcanzable dentro de la escala: basta con que el
 * promedio necesario exista y quepan en `escala.maximo`.
 *
 * Que supere `escala.minimo` es asunto del llamante: aqui solo se pregunta
 * si la meta cabe en la escala, no si el estudiante puede con ella.
 */
export function esAlcanzable(
  indiceActual: number,
  creditosCompletados: number,
  creditosPorCursar: number,
  indiceObjetivo: number,
  escala: EscalaAcademica
): boolean {
  const necesario = promedioNecesario(
    indiceActual,
    creditosCompletados,
    creditosPorCursar,
    indiceObjetivo
  )
  return necesario !== null && necesario <= escala.maximo
}

/**
 * Redondea hacia ARRIBA a 2 decimales (87.451 -> 87.46).
 *
 * Hacia arriba y no al mas cercano porque un centavo de menos deja el indice
 * por debajo del objetivo; de mas, solo cuesta un poco de nota.
 */
function redondearHaciaArriba2(valor: number): number {
  return Math.ceil(valor * 100) / 100
}

/**
 * Nota (en la escala 0..escala.maximo) necesaria EN ESA MATERIA para que el
 * indice acumulado alcance `indiceObjetivo`.
 *
 * Devuelve el promedio necesario con dos reglas encima:
 * 1. Si sale menor que `escala.aprobacion`, devuelve `escala.aprobacion`:
 *    hay que aprobar la materia igual, porque una reprobada rompe el indice
 *    acumulado y los honores. Por eso jamas devuelve 0 (aunque la materia ya
 *    no "haga falta" para el objetivo): el 0 solo apareceria si la propia
 *    escala declarara aprobacion = 0.
 * 2. Redondea hacia arriba a 2 decimales.
 *
 * @returns null si no es calculable (creditosDelExamen <= 0) o si haria falta
 * mas de `escala.maximo`, incluido el caso de una escala malformada donde
 * `aprobacion > maximo` (no existe nota valida en 0..maximo).
 */
export function notaMinimaPara(
  indiceActual: number,
  creditosCompletados: number,
  creditosDelExamen: number,
  indiceObjetivo: number,
  escala: EscalaAcademica
): number | null {
  const necesario = promedioNecesario(
    indiceActual,
    creditosCompletados,
    creditosDelExamen,
    indiceObjetivo
  )
  if (necesario === null) return null
  if (necesario > escala.maximo) return null

  const conPiso = Math.max(necesario, escala.aprobacion)
  if (conPiso > escala.maximo) return null
  return redondearHaciaArriba2(conPiso)
}
