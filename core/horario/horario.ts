/**
 * core/horario — planificacion de CARGA de un cuatrimestre y criticidad de materias.
 *
 * REGLAS DE ESTE MODULO
 * - Puro: sin DOM, sin red, sin almacenamiento del navegador. Si necesitas
 *   cualquiera de esas, la funcion no va aqui (regla 3 de AGENTS.md). No se
 *   puede compilar con core/tsconfig.json, que no incluye la lib DOM.
 * - Este modulo NO fabrica horarios por horas semanales: el PDF del pensum no
 *   registra horas (dato NO VERIFICADO en ESTADO.md) y por eso no se inventan
 *   aqui. Solo trabaja con creditos, prerequisitos y cuatrimestres, que si
 *   vienen del pensum curado.
 * - Las reglas academicas (capacidad maxima por cuatrimestre, que cuatrimestre
 *   habilita a que materia) no viven aqui: `elegirCarga` recibe ya filtrado lo
 *   que `core/progresion` dice que esta disponible.
 */

/** Una materia del plan de estudios con lo minimo para planificar carga. */
export interface MateriaPlan {
  /** Clave unica de la materia (la que usan los prerequisitos para referenciarla). */
  readonly codigo: string
  readonly nombre: string
  /** Creditos de la materia. Si el PDF no los dice, se deja 0 y no pesa en la carga. */
  readonly creditos: number
  /** Cuatrimestre del plan en el que se da por primera vez. */
  readonly cuatrimestre: number
  /** Codigos de las materias que hay que haber cursado antes. */
  readonly prerequisitos: readonly string[]
  /** Opcional: cuatrimestre del plan desde el que la materia esta disponible. */
  readonly desdeCuatrimestre?: number
  /** Opcional: false = basta con UNO de los prerequisitos; true = todos. */
  readonly requiereTodas?: boolean
}

/**
 * Materias cuyo prerequisito DIRECTO es `codigo`.
 *
 * Salida en el orden del plan. `desdeCuatrimestre` y `requiereTodas` no cambian
 * la relacion "depende de": si el codigo aparece entre los prerequisitos, la
 * materia depende de el, sea con uno o con todos. Comportamiento conservador:
 * codigo que no existe en el plan devuelve lista vacia.
 */
export function dependenciasDirectas(plan: readonly MateriaPlan[], codigo: string): string[] {
  return plan.filter((m) => m.prerequisitos.includes(codigo)).map((m) => m.codigo)
}

/**
 * Materias que dependen de `codigo` DIRECTA o transitivamente en el grafo de
 * prerequisitos, SIN contarla a ella misma, en el orden del plan.
 *
 * La salida en orden del plan (y no por profundidad del grafo) hace el resultado
 * deterministico frente al mismo pensum, que es lo que necesita la vista. Un
 * ciclo en los prerequisitos no puede colgar el recorrido ni colarse la propia
 * materia en el resultado: se recorre cada nodo una sola vez y la materia de
 * partida se excluye explícitamente.
 */
export function dependenciasTransitivas(plan: readonly MateriaPlan[], codigo: string): string[] {
  // Grafo inverso: que materias dependen de cada prerequisito.
  const dependientes = new Map<string, string[]>()
  for (const m of plan) {
    for (const prerequisito of m.prerequisitos) {
      const lista = dependientes.get(prerequisito)
      if (lista === undefined) dependientes.set(prerequisito, [m.codigo])
      else lista.push(m.codigo)
    }
  }

  // BFS por niveles: alcanzados = materias que dependen (directa o
  // transitivamente) de codigo, excluyendola a ella misma.
  const alcanzados = new Set<string>()
  let frontera = [codigo]
  while (frontera.length > 0) {
    const siguiente: string[] = []
    for (const actual of frontera) {
      for (const dependiente of dependientes.get(actual) ?? []) {
        if (dependiente !== codigo && !alcanzados.has(dependiente)) {
          alcanzados.add(dependiente)
          siguiente.push(dependiente)
        }
      }
    }
    frontera = siguiente
  }

  return plan.filter((m) => alcanzados.has(m.codigo)).map((m) => m.codigo)
}

/**
 * Cuanto retrasa dejar `codigo` para despues: numero de dependencias
 * transitivas. A mas materias bloqueadas, mas critica es. Una hoja (nada
 * depende de ella) tiene criticidad 0, y un codigo inexistente tambien:
 * comportamiento conservador, documentado en la funcion de dependencias.
 */
export function criticidad(plan: readonly MateriaPlan[], codigo: string): number {
  return dependenciasTransitivas(plan, codigo).length
}

/** Suma de creditos de las materias dadas. Vacio suma 0. */
export function creditosTotales(materias: readonly MateriaPlan[]): number {
  let suma = 0
  for (const m of materias) suma += m.creditos
  return suma
}

/** Indica si la suma de creditos del conjunto cabe en la capacidad. */
export function cabenEn(materias: readonly MateriaPlan[], capacidadCreditos: number): boolean {
  return creditosTotales(materias) <= capacidadCreditos
}

/**
 * Seleccion greedy de carga para un cuatrimestre.
 *
 * Recibe `disponibles` YA filtradas por prerequisitos y cuatrimestre (eso es
 * trabajo de core/progresion) y elige por prioridad
 * (cuatrimestre del plan asc, criticidad desc, creditos desc, codigo asc)
 * mientras la suma de creditos quepa en `capacidadCreditos`.
 *
 * La criticidad se calcula DENTRO del conjunto de disponibles (el grafo que la
 * vista conoce aqui). Si una materia ya no cabe, se salta y se sigue con la
 * siguiente: una materia grande en medio no bloquea a las pequenas que le
 * siguen. Devuelve la seleccion en el orden elegido.
 */
export function elegirCarga(disponibles: readonly MateriaPlan[], capacidadCreditos: number): MateriaPlan[] {
  const ordenados = [...disponibles].sort((a, b) => {
    if (a.cuatrimestre !== b.cuatrimestre) return a.cuatrimestre - b.cuatrimestre
    const porCriticidad = criticidad(disponibles, b.codigo) - criticidad(disponibles, a.codigo)
    if (porCriticidad !== 0) return porCriticidad
    if (a.creditos !== b.creditos) return b.creditos - a.creditos
    if (a.codigo < b.codigo) return -1
    if (a.codigo > b.codigo) return 1
    return 0
  })

  const carga: MateriaPlan[] = []
  let suma = 0
  for (const m of ordenados) {
    if (suma + m.creditos <= capacidadCreditos) {
      carga.push(m)
      suma += m.creditos
    }
  }
  return carga
}

/**
 * Distribucion de creditos por cuatrimestre del plan: total de creditos de cada
 * cuatrimestre como Map con las claves en orden ascendente, que es como un Map
 * se recorre de forma determinista y estable para la vista.
 */
export function creditosPorCuatrimestre(plan: readonly MateriaPlan[]): Map<number, number> {
  const porCuatrimestre = new Map<number, number>()
  for (const m of plan) {
    const acumulado = porCuatrimestre.get(m.cuatrimestre) ?? 0
    porCuatrimestre.set(m.cuatrimestre, acumulado + m.creditos)
  }

  const ordenado = new Map<number, number>()
  for (const cuatrimestre of [...porCuatrimestre.keys()].sort((a, b) => a - b)) {
    ordenado.set(cuatrimestre, porCuatrimestre.get(cuatrimestre) ?? 0)
  }
  return ordenado
}