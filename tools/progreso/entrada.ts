/**
 * tools/progreso/entrada.ts — Cuaderno de progreso: marca materias aprobadas
 * (con nota) y en curso. Es la herramienta base: el resto lee este estado.
 * Persistencia: tools/_comun/progreso.ts (localStorage, canonico).
 *
 * ORDEN: las materias se muestran en el orden del pensum oficial (cuatrimestre
 * ascendente y, dentro de cada bloque, el orden visual del PDF), nunca
 * alfabetico. El JSON curado ya trae ese orden; aqui solo se agrupa por
 * cuatrimestre de forma estable.
 *
 * PRERREQUISITOS: el codigo identifica la materia (es como referencian los
 * prerrequisitos, igual que la columna PRE-REQ del PDF). La regla "que bloquea
 * y por que" vive en core/progresion (motivosBloqueo); aqui solo se aplica al
 * cuaderno: sin los prerrequisitos aprobados (nota >= minimo) una materia no se
 * puede marcar aprobada, en curso ni recibir nota final: la fila queda gris con
 * el motivo en el tooltip. Se evalua con cuatrimestreActual infinito a
 * proposito: el bloqueo TEMPORAL (desde-cuatrimestre) es regla de planificacion
 * de inscripcion (herramienta progresion), no del cuaderno.
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import {
  borrarProgreso,
  conFechaActual,
  guardarProgreso,
  leerProgreso,
} from "../_comun/progreso.js"
import { $, fmt, vaciar } from "../_comun/dom.js"
import { resumenProgreso, type Progreso } from "../../core/portabilidad/portabilidad.js"
import {
  materiasDisponibles,
  motivosBloqueo,
  type MateriaPlan,
  type MotivoBloqueo,
} from "../../core/progresion/progresion.js"
import type { Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const app = $<HTMLElement>("#app")
const pensum = cargarPensum()

if (!app) {
  /* no hay panel: la pagina sin JS ya muestra los datos */
} else if (!pensum) {
  app.textContent = "No se pudieron cargar los datos del pensum."
} else {
  iniciar(app, pensum)
}

/** Normaliza el pensum curado al contrato de core/progresion. */
function aPlan(pensum: Pensum): MateriaPlan[] {
  return pensum.materias.map((m) => ({
    codigo: m.codigo,
    nombre: m.nombre,
    creditos: m.creditos,
    cuatrimestre: m.cuatrimestre,
    prerequisitos: m.prerequisitos,
    ...(m.desdeCuatrimestre !== undefined ? { desdeCuatrimestre: m.desdeCuatrimestre } : {}),
    ...(m.requiereTodas === true ? { requiereTodas: true } : {}),
  }))
}

function escalaDe(p: Pensum): { minimo: number; maximo: number; aprobacion: number } {
  return {
    minimo: p.reglas.escala.minimo,
    maximo: p.reglas.escala.maximo,
    aprobacion: p.reglas.escala.aprobacion,
  }
}

/** Codigos de materias aprobadas con nota final >= minimo (el codigo identifica la materia). */
function aprobadasDe(progreso: Progreso, pensum: Pensum, escala: { minimo: number }): Set<string> {
  const s = new Set<string>()
  for (const m of pensum.materias) {
    const reg = progreso.aprobadas[m.codigo]
    if (reg !== undefined && reg.nota >= escala.minimo) s.add(m.codigo)
  }
  return s
}

/** Texto corto de por que una materia esta bloqueada (mismo vocabulario que progresion). */
function textoBloqueo(materia: MateriaPlan, motivos: MotivoBloqueo[]): string {
  return motivos
    .map((motivo) =>
      motivo.tipo === "aprobar-prerequisito"
        ? `falta aprobar ${motivo.codigo}`
        : motivo.tipo === "requiere-todas"
          ? "exige TODAS las anteriores (PENSUM: «TODAS»)"
          : "",
    )
    .filter(Boolean)
    .join(" · ")
}

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const escala = escalaDe(pensum)
  const plan = aPlan(pensum)
  let progreso = leerProgreso(pensum)

  const resumen = document.createElement("p")
  resumen.className = "meta-fuente barra-estadisticas"

  const reset = document.createElement("button")
  reset.type = "button"
  reset.textContent = "Borrar todo el progreso de esta carrera"
  reset.style.background = "var(--peligro)"

  const contenedor = document.createElement("div")
  contenedor.className = "tabla-contenedor"

  const tabla = document.createElement("table")
  tabla.innerHTML =
    '<caption>Materias en el orden del pensum — marca aprobada con nota y en curso</caption>' +
    "<thead><tr>" +
    '<th scope="col" class="numerico">Cuat.</th>' +
    '<th scope="col">Código</th>' +
    '<th scope="col">Asignatura</th>' +
    '<th scope="col" class="numerico">Cr</th>' +
    '<th scope="col">Aprobada</th>' +
    '<th scope="col" class="numerico">Nota</th>' +
    '<th scope="col">En curso</th>' +
    "</tr></thead>"
  const tbody = tabla.createTBody()

  // Por codigo de materia: controles de su fila (para el bloqueo por prerequisitos).
  const controles = new Map<
    string,
    { fila: HTMLTableRowElement; chkAprobada: HTMLInputElement; nota: HTMLInputElement; chkCurso: HTMLInputElement }
  >()

  const pintarResumen = (): void => {
    const r = resumenProgreso(progreso)
    const aprobadas = pensum.materias.filter((m) => (progreso.aprobadas[m.codigo]?.nota ?? 0) >= escala.minimo).length
    resumen.textContent =
      `${aprobadas} de ${pensum.materias.length} aprobadas · ` +
      `${r.creditos} créditos · índice ${fmt(r.indice)} · ` +
      `${progreso.enCurso?.length ?? 0} en curso · ` +
      `escala ${escala.minimo}–${escala.maximo} (aprueba desde ${escala.aprobacion})`
  }

  /**
   * Bloqueo por prerrequisitos: recorre todas las filas y decide si se puede
   * marcar algo nuevo. La regla vive en core/progresion (materiasDisponibles,
   * evaluada SIN cuatrimestre actual: el bloqueo temporal es de planificacion,
   * no del cuaderno). Una materia queda bloqueada cuando NO esta aprobada y NO
   * esta disponible; lo ya registrado se puede corregir (desmarcar), pero nunca
   * se puede SELECCIONAR aprobada/en curso/nota nueva.
   */
  const aplicarBloqueos = (): void => {
    const aprobadas = aprobadasDe(progreso, pensum, escala)
    // materiasDisponibles sin cuatrimestre: solo valida prerequisitos (y
    // TODAS); una materia "exige TODAS" solo desbloquea con el resto aprobado.
    const disponibles = new Set(materiasDisponibles(plan, aprobadas).map((d) => d.codigo))
    for (const m of plan) {
      const c = controles.get(m.codigo)
      if (!c) continue

      const reg = progreso.aprobadas[m.codigo]
      const aprobada = reg !== undefined && reg.nota >= escala.minimo
      const enCurso = (progreso.enCurso ?? []).includes(m.codigo)
      const bloqueada = !aprobada && !disponibles.has(m.codigo)

      // Estado de los controles (el dato es la verdad; el control lo refleja).
      c.chkAprobada.checked = aprobada
      c.chkCurso.checked = enCurso
      c.nota.value = reg !== undefined ? String(reg.nota) : ""

      // Gris + bloqueo de seleccion nueva; lo existente queda corregible.
      c.fila.classList.toggle("fila-bloqueada", bloqueada)
      const titulo = bloqueada ? textoBloqueo(m, motivosBloqueo(m, aprobadas, Number.POSITIVE_INFINITY)) : ""
      c.chkAprobada.disabled = bloqueada && !aprobada
      c.chkCurso.disabled = bloqueada && !enCurso
      c.nota.disabled = bloqueada && reg === undefined
      c.chkAprobada.title = titulo
      c.chkCurso.title = titulo
      c.nota.title = titulo

      c.fila.style.backgroundColor = aprobada
        ? "var(--ok-fondo)"
        : enCurso
          ? "var(--accent-claro)"
          : reg !== undefined && reg.nota < escala.minimo
            ? "var(--peligro-fondo)"
            : ""
    }
  }

  const guardar = (proximo: Progreso): void => {
    progreso = proximo
    guardarProgreso(conFechaActual(proximo))
    aplicarBloqueos()
    pintarResumen()
  }

  /** Reconstruye las filas (solo tras reset). Cada cuatrimestre se separa con
   *  una fila cabecera de bloque, como el PDF. */
  const construirFilas = (): void => {
    controles.clear()
    tbody.replaceChildren()
    const materias = [...plan]
      .map((m, i) => ({ m, i }))
      .sort((a, b) => a.m.cuatrimestre - b.m.cuatrimestre || a.i - b.i)
      .map((x) => x.m)
    let cuatActual = 0
    for (const m of materias) {
      if (m.cuatrimestre !== cuatActual) {
        cuatActual = m.cuatrimestre
        const creditos = materias
          .filter((o) => o.cuatrimestre === cuatActual)
          .reduce((a, o) => a + o.creditos, 0)
        const cabecera = document.createElement("tr")
        cabecera.className = "fila-cuat"
        const th = document.createElement("th")
        th.scope = "rowgroup"
        th.colSpan = 7
        th.textContent = `Cuatrimestre ${cuatActual} — ${creditos} créditos`
        cabecera.appendChild(th)
        tbody.appendChild(cabecera)
      }
      const fila = document.createElement("tr")
      const celda = (texto: string, numerica = false): HTMLTableCellElement => {
        const td = document.createElement("td")
        if (numerica) td.className = "numerico"
        td.textContent = texto
        return td
      }

      const chkAprobada = document.createElement("input")
      chkAprobada.type = "checkbox"
      chkAprobada.setAttribute("aria-label", `Marcar ${m.codigo} como aprobada`)

      const inputNota = document.createElement("input")
      inputNota.type = "number"
      inputNota.min = "0"
      inputNota.max = String(escala.maximo)
      inputNota.step = "1"
      inputNota.setAttribute("aria-label", `Nota de ${m.codigo}`)
      inputNota.style.maxWidth = "6rem"

      const chkCurso = document.createElement("input")
      chkCurso.type = "checkbox"
      chkCurso.setAttribute("aria-label", `Marcar ${m.codigo} como en curso`)

      const notaActual = (): number | null => {
        const v = Number(inputNota.value)
        return inputNota.value !== "" && Number.isFinite(v) ? v : null
      }

      inputNota.addEventListener("input", () => {
        const nota = notaActual()
        const otras = { ...progreso.aprobadas }
        if (nota === null) delete otras[m.codigo]
        else otras[m.codigo] = { nota, creditos: m.creditos, cuatrimestre: m.cuatrimestre }
        guardar({ ...progreso, aprobadas: otras })
      })

      chkAprobada.addEventListener("change", () => {
        const otras = { ...progreso.aprobadas }
        if (chkAprobada.checked) {
          const nota = notaActual() ?? escala.aprobacion // marcar aprobada sin nota = nota de aprobacion (editable)
          otras[m.codigo] = { nota, creditos: m.creditos, cuatrimestre: m.cuatrimestre }
          inputNota.value = String(nota)
        } else {
          delete otras[m.codigo]
        }
        const sinCurso = (progreso.enCurso ?? []).filter((c) => c !== m.codigo)
        guardar({ ...progreso, aprobadas: otras, enCurso: sinCurso })
      })

      chkCurso.addEventListener("change", () => {
        const lista = new Set(progreso.enCurso ?? [])
        const otras = { ...progreso.aprobadas }
        if (chkCurso.checked) {
          lista.add(m.codigo)
          delete otras[m.codigo] // en curso = sin nota final
          inputNota.value = ""
        } else {
          lista.delete(m.codigo)
        }
        guardar({
          ...progreso,
          aprobadas: otras,
          enCurso: lista.size > 0 ? [...lista] : [],
        })
      })

      fila.append(
        celda(String(m.cuatrimestre), true),
        celda(m.codigo),
        celda(m.nombre),
        celda(String(m.creditos), true),
        (() => { const td = celda(""); td.appendChild(chkAprobada); return td })(),
        (() => { const td = celda(""); td.appendChild(inputNota); return td })(),
        (() => { const td = celda(""); td.appendChild(chkCurso); return td })(),
      )
      controles.set(m.codigo, { fila, chkAprobada, nota: inputNota, chkCurso })
      tbody.appendChild(fila)
    }
  }

  reset.addEventListener("click", () => {
    if (window.confirm("¿Borrar TODO el progreso de esta carrera? No se puede deshacer.")) {
      borrarProgreso(pensum)
      progreso = leerProgreso(pensum)
      construirFilas()
      aplicarBloqueos()
      pintarResumen()
    }
  })

  construirFilas()
  aplicarBloqueos()
  tabla.append(tbody)
  contenedor.appendChild(tabla)
  vaciar(app)
  app.append(resumen, contenedor, reset)
  pintarResumen()
}