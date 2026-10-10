/**
 * tools/indice/entrada.ts — Índice y nota mínima. Dos secciones de la misma
 * página (fusión 2026-10-10: antes eran dos herramientas que compartían tema y
 * datos):
 *   1) Índice académico: leyendo el cuaderno de progreso, muestra el índice
 *      ponderado por créditos y lo compara con las distinciones del reglamento.
 *   2) Nota mínima: dado el índice actual, los créditos completados y los que
 *      faltan, calcula el promedio necesario para un índice objetivo y la nota
 *      exacta de la próxima materia.
 * Todos los números llevan su fuente (reglas del pensum).
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

/** Campo numérico con etiqueta y ayuda, patrón del resto de herramientas. */
function campo(id: string, etiquetaTexto: string, ayudaTexto: string, prefill = "", min: number | string = "", max: number | string = ""): { envoltura: HTMLElement; input: HTMLInputElement } {
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
  if (min !== "") input.min = String(min)
  if (max !== "") input.max = String(max)
  const ayuda = document.createElement("p")
  ayuda.className = "ayuda"
  ayuda.id = `${id}-ayuda`
  ayuda.textContent = ayudaTexto
  // La ayuda se asocia al campo (revisor-a11y: sin aria-describedby quien
  // navega por campos no oye la explicación).
  input.setAttribute("aria-describedby", ayuda.id)
  envoltura.append(etiqueta, input, ayuda)
  return { envoltura, input }
}

function iniciar(app: HTMLElement, pensum: Pensum): void {
  const escala = escalaDe(pensum)

  // Dos secciones independientes: el índice se re-renderiza cuando cambia el
  // progreso (evento del cuaderno / storage); la nota mínima se calcula sobre
  // los números que escribe el usuario, así que se monta una vez y no se
  // reinicia sola (perderia lo tecleado en cada cambio de otra pestaña).
  const seccionIndice = document.createElement("section")
  const seccionNota = document.createElement("section")
  vaciar(app)
  app.append(seccionIndice, seccionNota)

  const renderIndice = (): void => {
    const progreso = leerProgreso(pensum)
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
    // aria-label sobre <p> es aria-prohibited-attr (hallazgo revisor-a11y):
    // la etiqueta va en un span sr-only visible para el lector de pantalla.
    const etiquetaCifra = document.createElement("span")
    etiquetaCifra.className = "sr-only"
    etiquetaCifra.textContent = "Índice académico: "
    cifra.prepend(etiquetaCifra)

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

    const honores = pensum.reglas.honores ?? []
    let bandas: HTMLElement
    if (honores.length === 0) {
      // Regla 8: si el reglamento no documenta las bandas (o no se pudieron
      // verificar), se dice en pantalla; no se pinta una tabla vacia (hallazgo
      // revisor-a11y: tabla sin filas + dato NO VERIFICADO oculto en notas).
      bandas = document.createElement("div")
      bandas.className = "aviso-no-verificado"
      const fuerte = document.createElement("strong")
      fuerte.textContent = "NO VERIFICADO"
      const p = document.createElement("p")
      p.textContent = "El reglamento no documenta de forma verificable las bandas de distinción de esta carrera; no se muestran valores concretos."
      bandas.append(fuerte, p)
    } else {
      bandas = document.createElement("div")
      bandas.className = "tabla-contenedor"
      // Contenedor desplazable enfocable por teclado (hallazgo ALTA
      // scrollable-region-focusable del revisor-a11y: 0 tabindex en todo dist/).
      bandas.tabIndex = 0
      bandas.setAttribute("role", "region")
      bandas.setAttribute("aria-label", "Distinciones del reglamento y tu posición, se desplaza horizontalmente")
      const tabla = document.createElement("table")
      tabla.innerHTML =
        "<caption>Distinciones del reglamento y tu posición</caption>" +
        "<thead><tr><th scope=\"col\">Distinción</th><th scope=\"col\" class=\"numerico\">Índice</th><th scope=\"col\">Tu posición</th></tr></thead>"
      const tbody = tabla.createTBody()
      for (const h of honores) {
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
    }

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
    lista.tabIndex = 0
    lista.setAttribute("role", "region")
    lista.setAttribute("aria-label", "Detalle del cálculo, se desplaza horizontalmente")
    const t2 = document.createElement("table")
    t2.innerHTML =
      "<caption>Detalle del cálculo</caption>" +
      "<thead><tr><th scope=\"col\">Código</th><th scope=\"col\">Asignatura</th><th scope=\"col\" class=\"numerico\">Cr</th><th scope=\"col\" class=\"numerico\">Nota</th></tr></thead>"
    const tb2 = t2.createTBody()
    // Mismo orden que el pensum (el JSON ya viene en orden curado): no alfabetizar.
    const aprobadas = [...pensum.materias].filter(
      (m) => progreso.aprobadas[m.codigo] !== undefined,
    )
    if (aprobadas.length === 0) {
      // Tabla con cabeceras y sin filas = confusion para lector de pantalla
      // (hallazgo revisor-a11y). Una fila explicando el vacio.
      const fila = document.createElement("tr")
      const celdaVacia = document.createElement("td")
      celdaVacia.colSpan = 4
      celdaVacia.textContent = "Sin materias aprobadas aún: marca tu avance en el Cuaderno de progreso."
      fila.appendChild(celdaVacia)
      tb2.appendChild(fila)
    }
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

    vaciar(seccionIndice)
    // jerarquia h1->h2: la seccion estatica (que antes aportaba el h2) ahora
    // vive dentro de #app y este render la reemplaza; el app pinta su h2.
    const encabezado = document.createElement("h2")
    encabezado.textContent = "Tu índice actual"
    seccionIndice.append(encabezado, panel, bandas, notaExtra, lista)
  }

  const montarNotaMinima = (): void => {
    const progresoInicial = leerProgreso(pensum)
    const r = resumenProgreso(progresoInicial)
    const totalCreditos = pensum.totales.creditos
    const faltantesInicial = totalCreditos - r.creditos

    const actual = campo("nm-actual", "Índice actual", "El que tienes hoy (ponderado por créditos).", fmt(r.indice), escala.minimo, escala.maximo)
    const completados = campo("nm-completados", "Créditos completados", "Con nota final ya registrada.", String(r.creditos), 0)
    const porCursar = campo("nm-por-cursar", "Créditos por cursar", `Todos los que faltan (hoy: ${faltantesInicial}).`, String(faltantesInicial), 0)
    const objetivo = campo("nm-objetivo", "Índice objetivo", `Entre ${escala.minimo} y ${escala.maximo}.`, "", escala.minimo, escala.maximo)
    const siguiente = campo("nm-siguiente", "Créditos de la próxima materia", "Para calcular la nota exacta de la materia que vas a inscribir.", "3", 0, escala.maximo)

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

      // Un campo vacio NO es 0: Number("") === 0 hacia inalcanzable este aviso
      // y anunciaba un resultado falso (hallazgo MEDIA revisor-a11y). Se mira
      // el valor CRUDO de los cuatro obligatorios; el vacio se marca
      // aria-invalid y el mensaje sale por la misma region live.
      const obligatorios = [actual, completados, porCursar, objetivo]
      const faltantes = obligatorios.filter((f) => f.input.value.trim() === "")
      for (const f of obligatorios) {
        if (f.input.value.trim() === "") f.input.setAttribute("aria-invalid", "true")
        else f.input.removeAttribute("aria-invalid")
      }
      if (faltantes.length) {
        const nombres = faltantes.map((f) => f.envoltura.querySelector("label")?.textContent ?? f.input.id)
        parrafo.textContent = `Falta un dato: completa ${faltantes.length === 1 ? "el campo" : "los campos"} «${nombres.join("», «")}».`
        resultado.appendChild(parrafo)
        return
      }
      siguiente.input.removeAttribute("aria-invalid")
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

    const encabezado = document.createElement("h2")
    encabezado.id = "nota-minima"
    encabezado.textContent = "Nota mínima"
    const intro = document.createElement("p")
    intro.textContent = "Dado tu índice actual y los créditos que te faltan, el promedio (y la nota de la próxima materia) para alcanzar un índice objetivo."
    seccionNota.append(
      encabezado,
      intro,
      actual.envoltura,
      completados.envoltura,
      porCursar.envoltura,
      objetivo.envoltura,
      siguiente.envoltura,
      resultado,
    )
    calcular()
  }

  window.addEventListener("ciberpensum:progreso", renderIndice)
  window.addEventListener("storage", () => renderIndice())
  renderIndice()
  montarNotaMinima()
}
