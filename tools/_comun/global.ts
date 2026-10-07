/**
 * tools/_comun/global.ts — barra global de progreso, presente en TODA la web.
 *
 * layout.mjs la pinta en cada pagina y ya funciona sin JS (aviso + enlace al
 * cuaderno, regla 6). Este script la mejora:
 *
 * 1. Registra el service worker: es el unico punto que corre en todas las
 *    paginas, incluidas las que no cargan ninguna herramienta.
 * 2. Carga los datos curados del widget (dist/datos/*.json, precacheados en
 *    el SW) y muestra las estadisticas en vivo del progreso local.
 * 3. Agrega Guardar (exporta el JSON del progreso) e Importar (restaura desde
 *    un archivo, validado y migrado por core/portabilidad).
 *
 * El widget escucha "ciberpensum:progreso" (misma pestana, lo dispara
 * guardarProgreso) y "storage" (otras pestanas): se actualiza solo en ambas.
 * La logica pura (serializar, migrar, checksum) vive en core/portabilidad;
 * aqui solo se conecta DOM + localStorage + fetch (regla 3: nada de esto en core/).
 */
import { registrarServiceWorker } from "./pensum.js"
import { $, el, fmt } from "./dom.js"
import { VERSION_PROGRESO, conFechaActual, guardarProgreso, leerProgreso } from "./progreso.js"
import {
  ProgresoInvalido,
  migrarProgreso,
  resumenProgreso,
  serializarProgreso,
  type Progreso,
} from "../../core/portabilidad/portabilidad.js"
import { parsearPensum, type Pensum } from "../../core/datos/datos.js"

registrarServiceWorker()

const zona = $<HTMLElement>("#progreso-global")
const botones = $<HTMLElement>(".barra-global .botones")

if (zona && botones) {
  let pensum: Pensum | null = null
  let progreso: Progreso | null = null

  /** Aprobadas de verdad: las que superan la nota minima de la escala. */
  const aprobadasReales = (p: Progreso): number => {
    if (!pensum) return 0
    const minimo = pensum.reglas.escala.minimo
    return pensum.materias.filter((m) => (p.aprobadas[m.codigo]?.nota ?? 0) >= minimo).length
  }

  const pintar = (): void => {
    if (!pensum || !progreso) return
    const r = resumenProgreso(progreso)
    const extras: string[] = []
    if (progreso.enCurso?.length) extras.push(`${progreso.enCurso.length} en curso`)
    zona.textContent =
      `${aprobadasReales(progreso)} de ${pensum.materias.length} aprobadas · ` +
      `${r.creditos} créditos · índice ${fmt(r.indice)}` +
      (extras.length ? ` · ${extras.join(", ")}` : "")
  }

  /**
   * Carga la primera carrera curada (hoy hay una sola; cuando la oferta crezca,
   * index.json traera la lista y aqui nace el selector de carrera). Si no hay
   * red aun (offline antes de instalar el SW), el widget queda en su estado
   * estatico: sigue siendo util (enlace al cuaderno).
   */
  const cargar = async (): Promise<void> => {
    try {
      const respuesta = await fetch("/datos/index.json")
      if (!respuesta.ok) return
      const indice: Array<{ universidadId: string; slug: string }> = await respuesta.json()
      const primera = indice[0]
      if (!primera) return
      const datos = await fetch(`/datos/${primera.universidadId}/${primera.slug}.json`)
      if (!datos.ok) return
      const parse = parsearPensum(JSON.stringify(await datos.json()))
      if (!parse.ok) return
      pensum = parse.pensum
      progreso = leerProgreso(pensum)
      pintar()
      agregarBotones()
    } catch {
      /* sin red: el widget estatico sigue siendo util */
    }
  }

  const agregarBotones = (): void => {
    const guardar = el("button", "Guardar", { type: "button" })
    const importar = el("button", "Importar", { type: "button" })

    guardar.addEventListener("click", () => {
      if (!pensum || !progreso) return
      const texto = serializarProgreso(progreso)
      const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }))
      const a = el("a", undefined, {
        href: url,
        download: `ciberpensum-${pensum.universidad.id}-${pensum.slug}-${new Date().toISOString().slice(0, 10)}.json`,
      })
      // el() no engancha al DOM: hace falta para que el click() dispare la descarga
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    })

    const entrada = el("input", undefined, {
      type: "file",
      accept: ".json,application/json",
      hidden: "",
      "aria-label": "Archivo de progreso de Ciberpensum (JSON)",
    })
    importar.addEventListener("click", () => entrada.click())
    entrada.addEventListener("change", async () => {
      const archivo = entrada.files?.[0]
      entrada.value = ""
      if (!archivo) return
      try {
        const importado = migrarProgreso(JSON.parse(await archivo.text()), VERSION_PROGRESO)
        if (!pensum) return
        if (importado.universidadId !== pensum.universidad.id || importado.slug !== pensum.slug) {
          zona.textContent =
            `Ese archivo es de otra carrera (${importado.universidadId}/${importado.slug}); ` +
            `aquí se muestra ${pensum.universidad.id}/${pensum.slug}.`
          return
        }
        guardarProgreso(conFechaActual(importado))
        pintar()
      } catch (e) {
        const msg =
          e instanceof ProgresoInvalido
            ? e.message
            : "el archivo no parece un progreso válido de Ciberpensum"
        zona.textContent = `No se pudo importar: ${msg}.`
      }
    })

    botones.prepend(importar, guardar)
  }

  // misma pestana (guardarProgreso/borrarProgreso) y otras pestanas (storage)
  window.addEventListener("ciberpensum:progreso", () => {
    if (!pensum) return
    progreso = leerProgreso(pensum)
    pintar()
  })
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("ciberpensum:progreso:") && pensum) {
      progreso = leerProgreso(pensum)
      pintar()
    }
  })

  void cargar()
}