/**
 * core/progresion — que puede inscribirse hoy, por que no, y como va el
 * saldo de creditos y cuatrimestres de un plan.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento (regla 3 de AGENTS.md). No
 *   compila con core/tsconfig.json, que no incluye la lib DOM, y eso es a
 *   proposito.
 * - El plan entra como dato ya curado desde `data/curated/`; aqui no se
 *   interpreta ni se inventa ninguna regla academica.
 * - Dudas del contrato resueltas conservador (ver los JSDoc de cada
 *   funcion y los tests que las documentan): jamas se afirma disponibilidad
 *   que no se puede probar.
 */

/** Una materia del plan de estudios, ya normalizada desde el curado. */
export interface MateriaPlan {
  /** Codigo oficial de la materia, unico dentro del plan. */
  readonly codigo: string
  /** Nombre oficial de la materia. */
  readonly nombre: string
  /** Creditos que otorga. */
  readonly creditos: number
  /** Cuatrimestre en que se cursa segun el plan (>= 1 en datos sanos). */
  readonly cuatrimestre: number
  /** Codigos que deben estar aprobadas para poder inscribirla. */
  readonly prerequisitos: readonly string[]
  /** Restriccion temporal: no se puede inscribir antes de este cuatrimestre. */
  readonly desdeCuatrimestre?: number
  /** El PDF dice "TODAS": exige aprobar TODAS las demas materias del plan. */
  readonly requiereTodas?: boolean
}

/** Por que NO se puede inscribir una materia hoy. Lista vacia = se puede. */
export type MotivoBloqueo =
  | { tipo: "aprobar-prerequisito"; codigo: string }
  | { tipo: "desde-cuatrimestre"; desde: number }
  | { tipo: "requiere-todas" }

/**
 * Cuatrimestre efectivo a partir del cual se puede inscribir `materia`:
 * `desdeCuatrimestre` si viene, si no el cuatrimestre propio del plan.
 */
function cuatrimestreEfectivo(materia: MateriaPlan): number {
  return materia.desdeCuatrimestre ?? materia.cuatrimestre
}

/**
 * Materias del plan inscribibles ahora, en el orden del plan.
 *
 * - Nunca incluye una materia ya aprobada.
 * - Sin `cuatrimestreActual` solo se evaluan prerrequisitos: las
 *   restricciones temporales (`desdeCuatrimestre` y el cuatrimestre propio)
 *   se ignoran a proposito, porque el llamador no ha dicho en que punto del
 *   plan esta.
 * - Con `cuatrimestreActual` ademas exige
 *   `cuatrimestreActual >= (desdeCuatrimestre ?? cuatrimestre)`.
 * - `requiereTodas: true` solo se ofrece cuando TODAS las demas materias del
 *   plan estan aprobadas; ahi sus `prerequisitos` se ignoran (regla del PDF:
 *   exige el resto de la carrera, no una cadena concreta).
 */
export function materiasDisponibles(
  plan: readonly MateriaPlan[],
  aprobadas: ReadonlySet<string>,
  cuatrimestreActual?: number,
): MateriaPlan[] {
  const disponibles: MateriaPlan[] = []
  for (const materia of plan) {
    if (aprobadas.has(materia.codigo)) continue
    if (cuatrimestreActual !== undefined && cuatrimestreActual < cuatrimestreEfectivo(materia)) {
      continue
    }
    if (materia.requiereTodas === true) {
      const todasLasOtras = plan.every(
        (otra) => otra.codigo === materia.codigo || aprobadas.has(otra.codigo),
      )
      if (todasLasOtras) disponibles.push(materia)
      continue
    }
    if (materia.prerequisitos.every((pre) => aprobadas.has(pre))) disponibles.push(materia)
  }
  return disponibles
}

/**
 * Lista explicita de por que `materia` NO es inscribable hoy. Vacio = si.
 *
 * Devuelve todos los bloqueos aplicables, en el orden del union:
 * prerrequisitos pendientes (en el orden declarados), despues el
 * cuatrimestre, despues `requiereTodas`.
 *
 * DUDA DOCUMENTADA (eleccion conservadora): `requiereTodas` no se puede
 * comprobar aqui porque esta funcion no recibe el plan y sin el no hay manera
 * de saber que "todas las demas" estan aprobadas. En vez de arriesgar un
 * falso "se puede", se informa `requiere-todas` siempre que la materia lo
 * pida. Quien necesita la disponibilidad real usa `materiasDisponibles`, que
 * si recibe el plan. Por lo mismo, los `prerequisitos` de una materia
 * `requiereTodas` no generan motivos: la regla del PDF los sustituye.
 *
 * DUDA DOCUMENTADA: una materia ya aprobada no produce ningun motivo, porque
 * el tipo `MotivoBloqueo` no incluye "ya aprobada" y no vamos a inventar un
 * tipo nuevo. Excluir aprobadas es responsabilidad de `materiasDisponibles`.
 */
export function motivosBloqueo(
  materia: MateriaPlan,
  aprobadas: ReadonlySet<string>,
  cuatrimestreActual: number,
): MotivoBloqueo[] {
  const motivos: MotivoBloqueo[] = []
  if (materia.requiereTodas !== true) {
    for (const pre of materia.prerequisitos) {
      if (!aprobadas.has(pre)) motivos.push({ tipo: "aprobar-prerequisito", codigo: pre })
    }
  }
  const desde = cuatrimestreEfectivo(materia)
  if (cuatrimestreActual < desde) motivos.push({ tipo: "desde-cuatrimestre", desde })
  if (materia.requiereTodas === true) motivos.push({ tipo: "requiere-todas" })
  return motivos
}

/**
 * Creditos de las materias del plan que ya estan aprobadas.
 * Codigos aprobados que no estan en el plan se ignoran.
 */
export function creditosAprobados(
  plan: readonly MateriaPlan[],
  aprobadas: ReadonlySet<string>,
): number {
  let total = 0
  for (const materia of plan) if (aprobadas.has(materia.codigo)) total += materia.creditos
  return total
}

/**
 * Creditos de las materias del plan que aun no estan aprobadas.
 * Con el conjunto vacio devuelve el total del plan.
 */
export function creditosFaltantes(
  plan: readonly MateriaPlan[],
  aprobadas: ReadonlySet<string>,
): number {
  let total = 0
  for (const materia of plan) if (!aprobadas.has(materia.codigo)) total += materia.creditos
  return total
}

/**
 * Primer cuatrimestre (>= 1) en el que aun queda al menos una materia sin
 * aprobar; 0 si no queda ninguna (plan completo o vacio).
 *
 * DUDA DOCUMENTADA (eleccion conservadora): el contrato pide un resultado
 * ">= 1", asi que una materia con `cuatrimestre` invalido (< 1) en datos
 * corruptos se acota a 1 en vez de devolver un 0 indistinguible de "nada
 * pendiente".
 */
export function cuatrimestresRestantes(
  plan: readonly MateriaPlan[],
  aprobadas: ReadonlySet<string>,
): number {
  let menor: number | null = null
  for (const materia of plan) {
    if (aprobadas.has(materia.codigo)) continue
    const cuatri = materia.cuatrimestre < 1 ? 1 : materia.cuatrimestre
    if (menor === null || cuatri < menor) menor = cuatri
  }
  return menor ?? 0
}
