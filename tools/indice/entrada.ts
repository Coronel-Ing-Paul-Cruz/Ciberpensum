/**
 * tools/indice/entrada.ts — Índice académico: leyendo el cuaderno de progreso,
 * muestra el índice ponderado por créditos y lo compara con las distinciones
 * del reglamento. Todos los números llevan su fuente (reglas del pensum).
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import { leerProgreso } from "../_comun/progreso.js"
import { $, fmt, vaciar } from "../_comun/dom.js"
import { resumenProgreso } from "../../core/portabilidad/portabilidad.js"
import {
  calcularIndiceAcumulado,
  escalaCumple,
  redondearIndice,
  type MateriaCursada,
} from "../../core/indice/indice.js"
import type { Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const app = $<HTMLElement>("#app")
const pensum = cargarPensum()

if (app && pensum) iniciar(app, pensum)

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const render = (): void => {
    const progreso = leerProgreso(pensum)
    const escala = {
      minimo: pensum.reglas.escala.minimo,
      maximo: pensum.reglas.escala.maximo,
      aprobacion: pensum.reglas.escala.aprobacion,
    }
    const resumen = resumenProgreso(progreso)

    const cursadas: MateriaCursada[] = pensum.materias.flatMap((m) => {
      const reg = progreso.aprobadas[m.codigo]
      return reg !== undefined ? [{ nota: reg.nota, creditos: m.creditos }] : []
    })
    const indice = calcularIndiceAcumulado(cursadas)
    const indiceRedondo = redondearIndice(indice)
    const todoAprobado = escalaCumple(cursadas, escala)
    const banda = (pensum.reglas.honores ?? []).find(
      (h) => indice >= h.min && indice <= h.max,
    )

    const panel = document.createElement("div")
    panel.className = "panel"
    panel.style.textAlign = "center"

    const cifra = document.createElement("p")
    cifra.style.fontSize = "var(--t-1)"
    cifra.style.fontWeight = "700"
    cifra.style.margin = "0"
    cifra.textContent = resumen.creditos === 0 ? "—" : fmt(indiceRedondo)
    cifra.setAttribute("aria-label", `Índice académico ${fmt(indiceRedondo)}`)

    const meta = document.createElement("p")
    meta.textContent =
      resumen.creditos === 0
        ? "Sin materias aprobadas con nota: el índice no se puede calcular."
        : `${resumen.aprobadas} materia(s) aprobada(s) · ${resumen.creditos} créditos · escala ${escala.minimo}–${escala.maximo}`

    const cumple = document.createElement("p")
    cumple.textContent = todoAprobado
      ? "Cumple la escala: ninguna materia reprobada."
      : "Una o más materias por debajo del mínimo de aprobación: el índice alto no las compensa ni habilita distinciones."

    panel.append(cifra, meta, cumple)

    const bandas = document.createElement("div")
    bandas.className = "tabla-contenedor"
    const tabla = document.createElement("table")
    tabla.innerHTML =
      "<caption>Distinciones del reglamento y tu posición</caption>" +
      "<thead><tr><th scope=\"col\">Distinción</th><th scope=\"col\" class=\"numerico\">Índice</th><th scope=\"col\">Tu posición</th></tr></thead>"
    const tbody = tabla.createTBody()
    for (const h of pensum.reglas.honores ?? []) {
      const fila = document.createElement("tr")
      const td1 = document.createElement("td"); td1.textContent = h.grado.replaceAll("-", " ")
      const td2 = document.createElement("td"); td2.className = "numerico"; td2.textContent = `${h.min}–${h.max}`
      const td3 = document.createElement("td")
      td3.textContent = banda?.grado === h.grado ? "← estás aquí" : ""
      fila.append(td1, td2, td3)
      tbody.appendChild(fila)
    }
    tabla.appendChild(tbody)
    bandas.appendChild(tabla)

    const requisitos = pensum.reglas.requisitosHonores
    const notaExtra = document.createElement("p")
    notaExtra.className = "meta-fuente"
    notaExtra.textContent = requisitos
      ? [
          requisitos.sinReprobaciones ? "sin reprobaciones" : "",
          ...(requisitos.exclusiones ?? []),
        ].filter(Boolean).join(" · ")
      : ""

    const lista = document.createElement("div")
    lista.className = "tabla-contenedor"
    const t2 = document.createElement("table")
    t2.innerHTML =
      "<caption>Detalle del cálculo</caption>" +
      "<thead><tr><th scope=\"col\">Código</th><th scope=\"col\">Asignatura</th><th scope=\"col\" class=\"numerico\">Cr</th><th scope=\"col\" class=\"numerico\">Nota</th></tr></thead>"
    const tb2 = t2.createTBody()
    // Mismo orden que el pensum (el JSON ya viene en orden curado): no alfabetizar.
    const aprobadas = [...pensum.materias].filter(
      (m) => progreso.aprobadas[m.codigo] !== undefined,
    )
    for (const m of aprobadas) {
      const reg = progreso.aprobadas[m.codigo]
      if (!reg) continue
      const fila = document.createElement("tr")
      const c1 = document.createElement("td"); c1.textContent = m.codigo
      const c2 = document.createElement("td"); c2.textContent = m.nombre
      const c3 = document.createElement("td"); c3.className = "numerico"; c3.textContent = String(m.creditos)
      const c4 = document.createElement("td"); c4.className = "numerico"; c4.textContent = String(reg.nota)
      fila.append(c1, c2, c3, c4)
      tb2.appendChild(fila)
    }
    t2.appendChild(tb2)
    lista.appendChild(t2)

    vaciar(app)
    // jerarquia h1->h2: la seccion estatica (que antes aportaba el h2) ahora
    // vive dentro de #app y este render la reemplaza; el app pinta su h2.
    const encabezado = document.createElement("h2")
    encabezado.textContent = "Tu índice actual"
    app.append(encabezado, panel, bandas, notaExtra, lista)
  }

  window.addEventListener("ciberpensum:progreso", render)
  window.addEventListener("storage", () => render())
  render()
}