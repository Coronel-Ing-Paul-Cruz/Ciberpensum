/**
 * tools/plan-carga/entrada.ts — Plan de carga: créditos por cuatrimestre del
 * plan oficial, cuántos llevas, y qué materias disponibles conviene inscribir
 * primero (criticidad) para no pasarte de tu capacidad.
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import { leerProgreso } from "../_comun/progreso.js"
import { $, vaciar } from "../_comun/dom.js"
import { resumenProgreso } from "../../core/portabilidad/portabilidad.js"
import {
  creditosAprobados,
  creditosFaltantes,
  materiasDisponibles,
} from "../../core/progresion/progresion.js"
import {
  criticidad,
  creditosPorCuatrimestre,
  creditosTotales,
  elegirCarga,
  type MateriaPlan,
} from "../../core/horario/horario.js"
import type { Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const app = $<HTMLElement>("#app")
const pensum = cargarPensum()

if (app && pensum) iniciar(app, pensum)

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

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const plan = aPlan(pensum)

  const control = document.createElement("div")
  control.className = "campo"
  const etiqueta = document.createElement("label")
  etiqueta.htmlFor = "capacidad-creditos"
  etiqueta.textContent = "Tu capacidad de créditos por cuatrimestre"
  const input = document.createElement("input")
  input.id = "capacidad-creditos"
  input.type = "number"
  input.min = "1"
  input.step = "1"
  input.placeholder = "ej. 20"
  const ayuda = document.createElement("p")
  ayuda.className = "ayuda"
  ayuda.textContent = "No hay una cifra oficial en el PDF (NO VERIFICADO): la defines tú. El plan oficial reparte entre 10 y 23 créditos por cuatrimestre."
  control.append(etiqueta, input, ayuda)

  const distTabla = document.createElement("div")
  distTabla.className = "tabla-contenedor"

  const render = (): void => {
    const progreso = leerProgreso(pensum)
    const resumen = resumenProgreso(progreso)
    const aprobadas = new Set(Object.keys(progreso.aprobadas))
    const cuatri = Math.max(1, resumen.cuatrimestreActual)
    const disponibles = materiasDisponibles(plan, aprobadas, cuatri)

    // Distribucion oficial de creditos por cuatrimestre.
    const t1 = document.createElement("table")
    t1.innerHTML =
      "<caption>Créditos por cuatrimestre (plan oficial)</caption>" +
      "<thead><tr><th scope=\"col\">Cuat.</th><th scope=\"col\" class=\"numerico\">Créditos plan</th></tr></thead>"
    const tb1 = t1.createTBody()
    for (const [k, v] of creditosPorCuatrimestre(plan)) {
      const fila = document.createElement("tr")
      const c1 = document.createElement("td"); c1.className = "numerico"; c1.textContent = String(k)
      const c2 = document.createElement("td"); c2.className = "numerico"; c2.textContent = String(v)
      fila.append(c1, c2)
      tb1.appendChild(fila)
    }
    t1.appendChild(tb1)
    distTabla.replaceChildren(t1)

    const resumenP = document.createElement("p")
    resumenP.className = "meta-fuente"
    resumenP.textContent =
      `${aprobadas.size} aprobadas · ${creditosAprobados(plan, aprobadas)} créditos aprobados · ` +
      `${creditosFaltantes(plan, aprobadas)} por aprobar · ` +
      `${disponibles.length} disponibles hoy (cuat. ${cuatri})`

    const capacidad = Number(input.value)
    const seleccion = Number.isFinite(capacidad) && capacidad > 0 ? elegirCarga(disponibles, capacidad) : []

    const hSel = document.createElement("h2")
    const totalSel = creditosTotales(seleccion)
    hSel.textContent = Number.isFinite(capacidad) && capacidad > 0
      ? `Carga sugerida (${seleccion.length} materias, ${totalSel} créditos de ${capacidad})`
      : "Carga sugerida — pon tu capacidad arriba"

    const lista = document.createElement("ul")
    for (const m of seleccion) {
      const li = document.createElement("li")
      const crit = criticidad(disponibles, m.codigo)
      li.textContent = `${m.codigo} · ${m.nombre} (${m.creditos} cr) — destraba ${crit} materia(s) después`
      lista.appendChild(li)
    }

    const hDisp = document.createElement("h2")
    hDisp.textContent = `Disponibles hoy sin elegir (${disponibles.length})`
    const listaDisp = document.createElement("ul")
    for (const m of disponibles) {
      const li = document.createElement("li")
      li.textContent = `${m.codigo} · ${m.nombre} (${m.creditos} cr)`
      listaDisp.appendChild(li)
    }

    vaciar(app)
    app.append(control, distTabla, resumenP, hSel, lista, hDisp, listaDisp)
  }

  input.addEventListener("input", render)
  render()
}