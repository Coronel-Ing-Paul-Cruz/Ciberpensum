/**
 * tools/portabilidad/entrada.ts — Guardar y compartir: exportar el progreso a
 * texto, descargarlo, importarlo de vuelta, y generarlo/compartirlo como
 * enlace #p= (que SÍ lleva los datos, con checksum de integridad).
 * Todo vive en el navegador; nada se envia a ningun servidor.
 */
import { cargarPensum, registrarServiceWorker } from "../_comun/pensum.js"
import {
  borrarProgreso,
  conFechaActual,
  guardarProgreso,
  leerProgreso,
} from "../_comun/progreso.js"
import { $, vaciar } from "../_comun/dom.js"
import {
  deserializarProgreso,
  enlaceProgreso,
  progresoDesdeEnlace,
  serializarProgreso,
  type Progreso,
} from "../../core/portabilidad/portabilidad.js"
import type { Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const app = $<HTMLElement>("#app")
const pensum = cargarPensum()

if (app && pensum) iniciar(app, pensum)

function parrafo(contenido: string, clase = ""): HTMLParagraphElement {
  const p = document.createElement("p")
  p.textContent = contenido
  if (clase) p.className = clase
  return p
}

function area(texto: string, placeholder: string): HTMLTextAreaElement {
  const ta = document.createElement("textarea")
  ta.rows = 6
  ta.value = texto
  ta.placeholder = placeholder
  ta.spellcheck = false
  return ta
}

function boton(etiqueta: string, primario = true): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.textContent = etiqueta
  if (!primario) {
    b.style.background = "var(--tinta-suave)"
  }
  return b
}

function iniciar(app: HTMLElement, pensum: Pensum): void {
  let progreso = leerProgreso(pensum)
  const aviso = document.createElement("p")
  aviso.setAttribute("aria-live", "polite")

  // --- Exportar -----------------------------------------------------------
  const h1 = document.createElement("h2")
  h1.textContent = "1 · Exportar (guardar o copiar)"
  const exp = area(serializarProgreso(progreso), "")
  exp.readOnly = true
  const copiar = boton("Copiar al portapapeles")
  const descargar = boton("Descargar archivo .json", false)

  copiar.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(exp.value)
      .then(() => { aviso.textContent = "Copiado al portapapeles." })
      .catch(() => { aviso.textContent = "No se pudo copiar: selecciona el texto y copia manualmente." })
  })
  descargar.addEventListener("click", () => {
    const blob = new Blob([exp.value + "\n"], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ciberpensum-${pensum.universidad.id}-${pensum.slug}.json`
    a.click()
    URL.revokeObjectURL(url)
    aviso.textContent = "Descargado."
  })

  // --- Importar -----------------------------------------------------------
  const h2 = document.createElement("h2")
  h2.textContent = "2 · Importar (pegar el texto exportado)"
  const imp = area("", "Pega aquí el JSON exportado…")
  const importar = boton("Importar y sobrescribir")

  importar.addEventListener("click", () => {
    try {
      const p = deserializarProgreso(imp.value)
      if (p.universidadId !== pensum.universidad.id || p.slug !== pensum.slug) {
        aviso.textContent = `Este progreso es de otra carrera (${p.universidadId}/${p.slug}): no se importa.`
        return
      }
      progreso = p
      guardarProgreso(conFechaActual(progreso))
      exp.value = serializarProgreso(progreso)
      imp.value = ""
      aviso.textContent = "Progreso importado y guardado."
    } catch (e) {
      aviso.textContent = e instanceof Error ? `No se importó: ${e.message}` : "No se importó: formato inválido."
    }
  })

  // --- Enlace portable ----------------------------------------------------
  const h3 = document.createElement("h2")
  h3.textContent = "3 · Enlace #p= (progreso dentro de la URL)"
  const enlace = area("", "Genera el enlace con el botón de abajo")
  enlace.readOnly = true
  const generar = boton("Generar enlace con el progreso actual")
  const copiarEnlace = boton("Copiar enlace", false)

  generar.addEventListener("click", () => {
    const texto = enlaceProgreso(conFechaActual(progreso))
    enlace.value = texto
    aviso.textContent = "Enlace generado: compártelo tal cual. Quien lo abra puede cargar tu progreso."
  })
  copiarEnlace.addEventListener("click", () => {
    void navigator.clipboard.writeText(enlace.value).catch(() => {
      aviso.textContent = "No se pudo copiar: selecciona el texto del enlace manualmente."
    })
  })

  // --- Restablecer --------------------------------------------------------
  const h4 = document.createElement("h2")
  h4.textContent = "4 · Restablecer"
  const reset = boton("Borrar todo el progreso de esta carrera", false)
  reset.style.background = "var(--peligro)"
  reset.addEventListener("click", () => {
    if (window.confirm("¿Borrar TODO el progreso de esta carrera? Exporta antes si lo necesitas.")) {
      borrarProgreso(pensum)
      progreso = leerProgreso(pensum)
      exp.value = serializarProgreso(progreso)
      aviso.textContent = "Progreso borrado."
    }
  })

  vaciar(app)
  app.append(
    parrafo(
      `Tu progreso de ${pensum.carrera} (${pensum.universidad.nombre}) vive en localStorage de este navegador.`,
      "meta-fuente",
    ),
    h1, exp, copiar, descargar,
    h2, imp, importar,
    h3, enlace, generar, copiarEnlace,
    h4, reset,
    aviso,
  )

  // --- Cargar progreso desde un enlace #p= en la URL ----------------------
  const hash = window.location.hash
  if (hash.startsWith("#p=")) {
    try {
      const p = progresoDesdeEnlace(hash.slice(3))
      if (p.universidadId !== pensum.universidad.id || p.slug !== pensum.slug) {
        aviso.textContent = `El enlace apunta a otra carrera (${p.universidadId}/${p.slug}): no se carga.`
        return
      }
      const linea = parrafo("El enlace de esta página trae un progreso guardado.")
      const si = boton("Cargar ese progreso (sobrescribe)"), no = boton("No cargar", false)
      si.addEventListener("click", () => {
        progreso = p
        guardarProgreso(conFechaActual(progreso))
        exp.value = serializarProgreso(progreso)
        linea.remove()
        si.remove()
        no.remove()
        aviso.textContent = "Progreso del enlace cargado y guardado."
      })
      no.addEventListener("click", () => {
        linea.remove()
        si.remove()
        no.remove()
      })
      app.append(linea, si, no)
    } catch {
      aviso.textContent = "El enlace #p= no es válido o está corrupto (su checksum no cuadra)."
    }
  }
}