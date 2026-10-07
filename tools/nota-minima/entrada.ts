/**
 * tools/nota-minima/entrada.ts — Nota mínima: dado el índice actual, los
 * créditos completados y los que faltan, calcula el promedio necesario para un
 * índice objetivo y la nota exacta de la próxima materia.
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import { leerProgreso } from "../_comun/progreso.js"
import { $, fmt, vaciar } from "../_comun/dom.js"
import { resumenProgreso } from "../../core/portabilidad/portabilidad.js"
import {
  esAlcanzable,
  notaMinimaPara,
  promedioNecesario,
  type EscalaAcademica,
} from "../../core/nota-minima/nota-minima.js"
import type { Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const app = $<HTMLElement>("#app")
const pensum = cargarPensum()

if (app && pensum) iniciar(app, pensum)

function escalaDe(pensum: Pensum): EscalaAcademica {
  return {
    minimo: pensum.reglas.escala.minimo,
    maximo: pensum.reglas.escala.maximo,
    aprobacion: pensum.reglas.escala.aprobacion,
  }
}

function campo(id: string, etiquetaTexto: string, ayudaTexto: string, prefill = ""): { envoltura: HTMLElement; input: HTMLInputElement } {
  const envoltura = document.createElement("div")
  envoltura.className = "campo"
  const etiqueta = document.createElement("label")
  etiqueta.htmlFor = id
  etiqueta.textContent = etiquetaTexto
  const input = document.createElement("input")
  input.id = id
  input.type = "number"
  input.step = "any"
  input.value = prefill
  const ayuda = document.createElement("p")
  ayuda.className = "ayuda"
  ayuda.textContent = ayudaTexto
  envoltura.append(etiqueta, input, ayuda)
  return { envoltura, input }
}

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const escala = escalaDe(pensum)
  const progresoInicial = leerProgreso(pensum)
  const r = resumenProgreso(progresoInicial)
  const totalCreditos = pensum.totales.creditos
  const faltantesInicial = totalCreditos - r.creditos

  const actual = campo("nm-actual", "Índice actual", "El que tienes hoy (ponderado por créditos).", fmt(r.indice))
  const completados = campo("nm-completados", "Créditos completados", "Con nota final ya registrada.", String(r.creditos))
  const porCursar = campo("nm-por-cursar", "Créditos por cursar", `Todos los que faltan (hoy: ${faltantesInicial}).`, String(faltantesInicial))
  const objetivo = campo("nm-objetivo", "Índice objetivo", `Entre ${escala.minimo} y ${escala.maximo}.`, "")
  const siguiente = campo("nm-siguiente", "Créditos de la próxima materia", "Para calcular la nota exacta de la materia que vas a inscribir.", "3")

  const resultado = document.createElement("div")
  resultado.setAttribute("aria-live", "polite")

  const calcular = (): void => {
    const num = (i: HTMLInputElement): number => Number(i.value)
    const a = num(actual.input)
    const c = num(completados.input)
    const p = num(porCursar.input)
    const o = num(objetivo.input)
    const s = num(siguiente.input)

    vaciar(resultado)
    const parrafo = document.createElement("p")

    if (![a, c, p, o].every((v) => Number.isFinite(v))) {
      parrafo.textContent = "Falta un dato: completa los cuatro campos numéricos."
      resultado.appendChild(parrafo)
      return
    }
    if (p <= 0) {
      parrafo.textContent = "Créditos por cursar debe ser mayor que 0."
      resultado.appendChild(parrafo)
      return
    }
    if (o < a) {
      parrafo.textContent = `Tu índice actual (${fmt(a)}) ya supera el objetivo (${fmt(o)}): alcanzado. La nota mínima de la próxima materia es la de aprobación (${escala.aprobacion}) — una reprobada rompe el índice y las distinciones.`
      resultado.appendChild(parrafo)
      return
    }

    const necesario = promedioNecesario(a, c, p, o)
    if (necesario === null) {
      parrafo.textContent = "No se puede calcular."
      resultado.appendChild(parrafo)
      return
    }

    const alcanzable = esAlcanzable(a, c, p, o, escala)
    const nota = Number.isFinite(s) && s > 0 ? notaMinimaPara(a, c, s, o, escala) : null

    const linea1 = document.createElement("p")
    linea1.textContent = alcanzable
      ? `Necesitas un promedio de ${fmt(necesario)} en los próximos ${p} créditos para llegar a ${fmt(o)}.`
      : `Imposible desde donde estás: haría falta un promedio de ${fmt(necesario)}, que supera la escala (${escala.maximo}).`
    resultado.appendChild(linea1)

    if (nota !== null) {
      const linea2 = document.createElement("p")
      linea2.textContent = `En la próxima materia (${s} créditos): nota mínima ${fmt(nota)} (escala ${escala.minimo}–${escala.maximo}).`
      resultado.appendChild(linea2)
    } else if (alcanzable) {
      const linea2 = document.createElement("p")
      linea2.textContent = "Nota para la próxima materia: no calculable con los créditos indicados (mayor que 0 requerido)."
      resultado.appendChild(linea2)
    }
  }

  for (const f of [actual, completados, porCursar, objetivo, siguiente]) f.input.addEventListener("input", calcular)

  vaciar(app)
  const encabezado = document.createElement("h2")
  encabezado.textContent = "Completa los números de tu índice"
  app.append(
    encabezado,
    actual.envoltura,
    completados.envoltura,
    porCursar.envoltura,
    objetivo.envoltura,
    siguiente.envoltura,
    resultado,
  )
  calcular()
}