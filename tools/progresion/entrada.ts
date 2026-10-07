/**
 * tools/progresion/entrada.ts — Progresión: qué se puede inscribir hoy y por
 * qué no, según el cuaderno de progreso y el cuatrimestre actual.
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import { leerProgreso } from "../_comun/progreso.js"
import { $, vaciar } from "../_comun/dom.js"
import { resumenProgreso } from "../../core/portabilidad/portabilidad.js"
import {
  creditosAprobados,
  creditosFaltantes,
  cuatrimestresRestantes,
  materiasDisponibles,
  motivosBloqueo,
  type MateriaPlan,
  type MotivoBloqueo,
} from "../../core/progresion/progresion.js"
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

function textoMotivo(m: MateriaPlan, motivo: MotivoBloqueo): string {
  switch (motivo.tipo) {
    case "aprobar-prerequisito":
      return `falta aprobar ${motivo.codigo}`
    case "desde-cuatrimestre":
      return `disponible desde el ${motivo.desde}.º cuatrimestre`
    case "requiere-todas":
      return `exige TODAS las anteriores (PENSUM: «TODAS»)`
  }
}

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const plan = aPlan(pensum)
  const control = document.createElement("div")
  control.className = "campo"
  const etiqueta = document.createElement("label")
  etiqueta.htmlFor = "cuatrimestre-actual"
  etiqueta.textContent = "Cuatrimestre actual"
  const input = document.createElement("input")
  input.id = "cuatrimestre-actual"
  input.type = "number"
  input.min = "1"
  input.max = String(pensum.duracion.periodos)
  input.step = "1"
  const ayuda = document.createElement("p")
  ayuda.className = "ayuda"
  ayuda.textContent = "En qué cuatrimestre estás: cambia el cálculo de «disponibles» y los motivos de bloqueo."
  control.append(etiqueta, input, ayuda)

  const render = (): void => {
    const progreso = leerProgreso(pensum)
    const resumen = resumenProgreso(progreso)
    const porDefecto = Math.max(1, resumen.cuatrimestreActual)
    const valor = input.value === "" ? porDefecto : Number(input.value)
    const cuatri = Number.isFinite(valor) && valor >= 1 ? Math.min(valor, pensum.duracion.periodos) : porDefecto
    if (input.value === "") input.value = String(porDefecto)

    const aprobadas = new Set(Object.keys(progreso.aprobadas))
    const disponibles = materiasDisponibles(plan, aprobadas, cuatri)

    const resumenP = document.createElement("p")
    resumenP.className = "meta-fuente"
    resumenP.textContent =
      `${aprobadas.size} de ${plan.length} materias aprobadas · ` +
      `${creditosAprobados(plan, aprobadas)} créditos aprobados · ` +
      `${creditosFaltantes(plan, aprobadas)} por aprobar · ` +
      `próximo cuatrimestre con pendientes: ${cuatrimestresRestantes(plan, aprobadas) || "ninguno (plan completo)"}`

    const hDisp = document.createElement("h2")
    hDisp.textContent = `Disponibles para inscribir (cuat. ${cuatri}) — ${disponibles.length}`

    const listaDisp = document.createElement("ul")
    for (const m of disponibles) {
      const li = document.createElement("li")
      li.textContent = `${m.codigo} · ${m.nombre} (${m.creditos} cr)`
      listaDisp.appendChild(li)
    }

    const hBloq = document.createElement("h2")
    const bloqueadas = plan.filter((m) => !aprobadas.has(m.codigo) && !disponibles.includes(m))
    hBloq.textContent = `Bloqueadas — ${bloqueadas.length}`

    const listaBloq = document.createElement("ul")
    for (const m of bloqueadas) {
      const li = document.createElement("li")
      const motivos = motivosBloqueo(m, aprobadas, cuatri)
      if (motivos.length === 0) continue
      const cab = document.createElement("strong")
      cab.textContent = `${m.codigo} · ${m.nombre}`
      li.append(cab)
      const ul2 = document.createElement("ul")
      for (const razon of motivos) {
        const li2 = document.createElement("li")
        li2.textContent = textoMotivo(m, razon)
        ul2.appendChild(li2)
      }
      li.appendChild(ul2)
      listaBloq.appendChild(li)
    }

    vaciar(app)
    app.append(control, resumenP, hDisp, listaDisp, hBloq, listaBloq)
  }

  input.addEventListener("input", render)
  render()
}