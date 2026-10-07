/**
 * core/indice — calculo de indice academico y cumple de una escala.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento del navegador. Si necesitas
 *   cualquiera de esas, la funcion no va aqui (regla 3 de AGENTS.md). No se
 *   puede compilar con core/tsconfig.json, que no incluye la lib DOM: eso es a
 *   proposito y es lo que hace el gate.
 * - La escala (0-100, minimo de aprobacion, umbrales de honores) NUNCA se fija
 *   aqui: viene de `data/curated/` con su fuente. Un 70 escrito a mano seria
 *   una regla academica inventada.
 */

/** Una materia cursada con su nota final y sus creditos. */
export interface MateriaCursada {
  /** Nota final, en la escala de la universidad (0-100 para UNICARIBE). */
  readonly nota: number
  /** Creditos de la materia. Si el PDF no los dice, se deja 0 y el indice NO es calculable. */
  readonly creditos: number
}

/** Escala academica de una universidad, tal como viene del reglamento. */
export interface Escala {
  /** Nota minima que se puede obtener en la escala (UTESA y UNICARIBE: 0). */
  readonly minimo: number
  /** Nota maxima de la escala (100). */
  readonly maximo: number
  /** Nota minima para APROBAR una asignatura (UNICARIBE Art. 85: 70; UTESA Art. 81: 70). Distinta de `minimo`: la escala empieza en 0 pero se aprueba en 70. */
  readonly aprobacion: number
}

/**
 * Indice academico: promedio de notas PONDERADO por creditos.
 *
 * Es ponderado y no simple porque una materia de 4 creditos pesa el doble que
 * una de 2. La formula es la estandar y la que aplica todo el mundo; que el
 * reglamento no la escriba de forma explicita esta registrado como
 * NO VERIFICADO en ESTADO.md, no se oculta aqui.
 *
 * @returns el indice sin redondear, o 0 si no hay nada cursado.
 */
export function calcularIndiceAcumulado(notas: readonly MateriaCursada[]): number {
  let suma = 0
  let creditos = 0
  for (const m of notas) {
    suma += m.nota * m.creditos
    creditos += m.creditos
  }
  if (creditos === 0) return 0
  return suma / creditos
}

/**
 * Redondea el indice a dos decimales.
 *
 * Es la convencion que usa la universidad al expIndexer. Se expone aparte para
 * que el redondeo se pueda cambiar sin tocar el calculo.
 */
export function redondearIndice(indice: number): number {
  return Math.round(indice * 100) / 100
}

/**
 * Indica si el estudiante cumple la escala: TODAS las materias deben alcanzar
 * la nota de aprobacion.
 *
 * OJO: `aprobacion`, no `minimo`. `minimo` es el piso de la escala (0), y usar
 * `nota >= minimo` cuenta TODAS las materias como aprobadas (bug detectado al
 * curar UTESA: con escala 0-100 el cuaderno vacio decia "98 de 98").
 *
 * El indice acumulado alto no compensa una materia reprobada: por eso esta
 * funcion es independiente del indice. Honores, ademas, exigen no haber
 * reprobado nunca (Art. 89, parrafo I).
 */
export function escalaCumple(notas: readonly MateriaCursada[], escala: Escala): boolean {
  return notas.every((m) => m.nota >= escala.aprobacion)
}