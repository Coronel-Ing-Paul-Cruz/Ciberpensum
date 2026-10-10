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
import { $, fmt, nombrePeriodo, vaciar } from "../_comun/dom.js"
import { resumenProgreso, type Progreso } from "../../core/portabilidad/portabilidad.js"
import {
  materiasDisponibles,
  motivosBloqueo,
  siguienteEstadoAlClic,
  type MateriaPlan,
  type MotivoBloqueo,
  type EstadoClic,
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

/** Codigos de materias aprobadas con nota final >= aprobacion (el codigo identifica la materia). */
function aprobadasDe(progreso: Progreso, pensum: Pensum, escala: { aprobacion: number }): Set<string> {
  const s = new Set<string>()
  for (const m of pensum.materias) {
    const reg = progreso.aprobadas[m.codigo]
    if (reg !== undefined && reg.nota >= escala.aprobacion) s.add(m.codigo)
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

  const encabezado = document.createElement("h2")
  // Jerarquia h1->h2->h3 (revision a11y): el cuaderno no puede saltar del h1
  // de la pagina directo al h3 de la fuente; tanto la version estatica como la
  // interactiva llevan su h2.
  encabezado.textContent = "Malla para marcar"

  const resumen = document.createElement("p")
  resumen.className = "meta-fuente barra-estadisticas"
  // unica region viva del cuaderno: los cambios de estado se anuncian en la
  // barra de estadisticas, no en toda la app (revision a11y: aria-live amplio
  // convertia cada casilla en una narracion).
  resumen.setAttribute("aria-live", "polite")

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
    '<th scope="col">Código</th>' +
    '<th scope="col">Asignatura</th>' +
    '<th scope="col" class="numerico">Cr</th>' +
    '<th scope="col">PRE-REQ</th>' +
    '<th scope="col">Estatus</th>' +
    '<th scope="col" class="numerico">Nota</th>' +
    "</tr></thead>"
  // Los tbody se crean por periodo en construirFilas() (vease hallazgo axe
  // th-has-data-cells, revisor-a11y).

  // Por codigo de materia: controles de su fila (para el bloqueo por prerequisitos).
  const controles = new Map<
    string,
    {
      fila: HTMLTableRowElement
      estatus: HTMLTableCellElement
      nota: HTMLInputElement
      motivo: HTMLSpanElement
      botonFila: HTMLButtonElement
    }
  >()

  const pintarResumen = (): void => {
    const r = resumenProgreso(progreso)
    const aprobadas = pensum.materias.filter((m) => (progreso.aprobadas[m.codigo]?.nota ?? 0) >= escala.aprobacion).length
    resumen.textContent =
      `${aprobadas} de ${pensum.materias.length} aprobadas · ` +
      `${r.creditos} créditos · índice ${fmt(r.indice)} · ` +
      `${progreso.enCurso?.length ?? 0} en curso`
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
      const aprobada = reg !== undefined && reg.nota >= escala.aprobacion
      const enCurso = (progreso.enCurso ?? []).includes(m.codigo)
      const tieneNota = reg !== undefined
      const bloqueada = !aprobada && !disponibles.has(m.codigo)

      // Columna unica "Estatus" (acuerdo 2026-10-10): el estado se dice en
      // letra; la nota es un dato de la materia aprobada, no un estado mas.
      // Una nota menor que la aprobacion no cambia el estado (sigue siendo
      // "Aprobada" y corregible); solo tine la fila (abajo).
      c.estatus.textContent = tieneNota ? "Aprobada" : enCurso ? "En curso" : ""
      c.nota.value = tieneNota ? String(reg.nota) : ""

      // Gris + bloqueo de seleccion nueva; lo existente queda corregible.
      c.fila.classList.toggle("fila-bloqueada", bloqueada)
      const titulo = bloqueada ? textoBloqueo(m, motivosBloqueo(m, aprobadas, Number.POSITIVE_INFINITY)) : ""
      // El input de nota se habilita solo cuando el estado es "Aprobada":
      // en curso y sin estado no hay nota que editar.
      c.nota.disabled = !tieneNota
      c.nota.title = titulo

      // El motivo tambien viaja en aria-describedby (el tooltip title solo no
      // llega a lectores de pantalla, revision a11y): texto sr-only + referencia
      // en el control de nota; sin bloqueo, sin descripcion.
      c.motivo.textContent = bloqueada ? `Bloqueada: ${titulo}` : ""
      if (bloqueada) {
        c.nota.setAttribute("aria-describedby", c.motivo.id)
      } else {
        c.nota.removeAttribute("aria-describedby")
      }

      c.fila.style.backgroundColor = aprobada
        ? "var(--ok-fondo)"
        : enCurso
          ? "var(--accent-claro)"
          : reg !== undefined && reg.nota < escala.aprobacion
            ? "var(--peligro-fondo)"
            : ""

      // Boton de fila accesible: el estado en letra y el ciclo nuevo.
      const estadoLeyenda = tieneNota ? "Aprobada" : enCurso ? "En curso" : "Sin estado"
      const habilitada = !bloqueada || tieneNota // lo registrado se puede corregir
      c.botonFila.setAttribute("aria-label", `${m.codigo} ${m.nombre}. ${estadoLeyenda}. Clic o Enter alterna: sin estado → aprobada → en curso → sin estado.`)
      c.botonFila.disabled = !habilitada
      c.botonFila.setAttribute("aria-disabled", (!habilitada).toString())
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
    // Un <tbody> por periodo: la estructura agrupa cada bloque con sus filas
    // (hallazgo axe th-has-data-cells, revisor-a11y).
    tabla.querySelectorAll("tbody").forEach((t) => t.remove())
    const materias = [...plan]
      .map((m, i) => ({ m, i }))
      .sort((a, b) => a.m.cuatrimestre - b.m.cuatrimestre || a.i - b.i)
      .map((x) => x.m)
    let cuatActual = 0
    let tbody: HTMLTableSectionElement | null = null
    for (const m of materias) {
      if (m.cuatrimestre !== cuatActual) {
        cuatActual = m.cuatrimestre
        tbody = tabla.createTBody()
        const creditos = materias
          .filter((o) => o.cuatrimestre === cuatActual)
          .reduce((a, o) => a + o.creditos, 0)
        const cabecera = document.createElement("tr")
        cabecera.className = "fila-cuat"
        // td y no th: un th en fila sin celdas de datos deja axe
        // th-has-data-cells en incomplete (medido: solo th->td pasa; ver
        // comentario de .fila-cuat td en ui/componentes.css).
        const celdaPeriodo = document.createElement("td")
        celdaPeriodo.colSpan = 6
        celdaPeriodo.textContent = `${nombrePeriodo(pensum.duracion.tipoPeriodo)} ${cuatActual} — ${creditos} créditos`
        cabecera.appendChild(celdaPeriodo)
        tbody.appendChild(cabecera)
      }
      if (!tbody) tbody = tabla.createTBody()
      const fila = document.createElement("tr")
      const celda = (texto: string, numerica = false): HTMLTableCellElement => {
        const td = document.createElement("td")
        if (numerica) td.className = "numerico"
        td.textContent = texto
        return td
      }

      const inputNota = document.createElement("input")
      inputNota.type = "number"
      inputNota.min = "0"
      inputNota.max = String(escala.maximo)
      inputNota.step = "1"
      inputNota.setAttribute("aria-label", `Nota de ${m.codigo}`)
      inputNota.style.maxWidth = "6rem"

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

      // Boton accesible en la celda del nombre
      const botonFila = document.createElement("button")
      botonFila.type = "button"
      botonFila.className = "boton-fila"
      botonFila.textContent = m.nombre

      const ejecutarCiclo = (): void => {
        const aprobadasSet = aprobadasDe(progreso, pensum, escala)
        const disponibles = new Set(materiasDisponibles(plan, aprobadasSet).map((d) => d.codigo))
        const regActual = progreso.aprobadas[m.codigo]
        const tieneNota = regActual !== undefined
        const bloqueada = !tieneNota && !disponibles.has(m.codigo)
        const habilitada = !bloqueada || tieneNota // lo registrado siempre se corrige
        const estadoClic: EstadoClic = {
          aprobadas: progreso.aprobadas,
          enCurso: progreso.enCurso ?? [],
        }
        const nuevo = siguienteEstadoAlClic(estadoClic, m.codigo, habilitada, escala.aprobacion)
        if (nuevo === estadoClic) {
          return // sin estado registrado y bloqueada: no hay nada que alternar
        }
        // La maquina de core solo conoce `{ nota }`; el contrato del cuaderno
        // (Progreso) pide ademas creditos y cuatrimestre. Se conserva el
        // registro previo cuando la nota no cambio (ya trae sus metadatos) y
        // se rellena desde el plan cuando la nota es nueva.
        const aprobadasCompletas: Progreso["aprobadas"] = {}
        for (const [cod, reg] of Object.entries(nuevo.aprobadas)) {
          const previo = progreso.aprobadas[cod]
          if (previo !== undefined && previo.nota === reg.nota) {
            aprobadasCompletas[cod] = previo
          } else {
            const materia = plan.find((p) => p.codigo === cod)
            aprobadasCompletas[cod] = {
              nota: reg.nota,
              creditos: materia !== undefined ? materia.creditos : 0,
              cuatrimestre: materia !== undefined ? materia.cuatrimestre : 0,
            }
          }
        }
        const nuevoProgreso: Progreso = {
          ...progreso,
          aprobadas: aprobadasCompletas,
          enCurso: nuevo.enCurso.length > 0 ? [...nuevo.enCurso] : [],
        }
        guardar(nuevoProgreso)
      }

      // Boton real con apariencia de texto en la celda del nombre: el teclado
      // lo activa con Enter/Espacio NATIVOS (un <button> no necesita keydown
      // manual; duplicar el handler arriesgaba doble disparo).
      botonFila.addEventListener("click", (e) => {
        e.stopPropagation()
        ejecutarCiclo()
      })

      // PRE-REQ: igual que la malla, SOLO los codigos (asi los referencia el
      // pensum oficial), con el matiz "desde cuat." / "exige TODAS" aparte.
      const pre = (m.prerequisitos ?? []).join(", ") || "—"
      const extras: string[] = []
      if (m.desdeCuatrimestre) extras.push(`desde cuat. ${m.desdeCuatrimestre}`)
      if (m.requiereTodas) extras.push("exige TODAS las anteriores")
      const tdPre = celda(pre)
      if (extras.length) {
        const chico = document.createElement("span")
        chico.className = "meta-fuente"
        chico.textContent = extras.join(" · ")
        tdPre.append(document.createElement("br"), chico)
      }

      // Motivo de bloqueo en el arbol de accesibilidad (aria-describedby);
      // vacio cuando no hay bloqueo, se rellena en aplicarBloqueos().
      const motivo = document.createElement("span")
      motivo.id = `motivo-${m.codigo}`
      motivo.className = "sr-only"

      const tdNombre = celda("")
      tdNombre.appendChild(botonFila)
      const tdEstatus = celda("")
      fila.append(
        celda(m.codigo),
        tdNombre,
        celda(String(m.creditos), true),
        tdPre,
        tdEstatus,
        (() => { const td = celda(""); td.appendChild(inputNota); td.appendChild(motivo); return td })(),
      )
      controles.set(m.codigo, { fila, estatus: tdEstatus, nota: inputNota, motivo, botonFila })

      // Clic en cualquier parte de la fila (conveniencia de raton; el pedido
      // n. 7 dice "clic en cualquier parte de la fila"). El boton ya frena su
      // propia propagacion; aqui se ignoran los controles interactivos para
      // que el clic en checkbox/nota no dispare ademas el ciclo.
      fila.addEventListener("click", (e) => {
        const objetivo = e.target as HTMLElement
        if (objetivo.closest("input, button")) return
        ejecutarCiclo()
      })
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
  contenedor.appendChild(tabla)
  vaciar(app)
  app.append(encabezado, resumen, contenedor, reset)
  pintarResumen()
}