/**
 * tools/_comun/progreso.ts — lectura/escritura del progreso del usuario.
 *
 * Decisión del proyecto: progreso = localStorage + export/import + enlace #p=.
 * El DOM/localStorage NO pueden vivir en core/ (regla 3), asi que el adaptador
 * vive aqui y core/portabilidad se queda con la logica pura (serializar,
 * migrar, checksum, resumen).
 */
import {
  migrarProgreso,
  serializarProgreso,
  type Progreso,
} from "../../core/portabilidad/portabilidad.js"
import type { Pensum } from "../../core/datos/datos.js"

export const VERSION_PROGRESO = 1
const PREFIJO = "ciberpensum:progreso:"

export function clave(universidadId: string, slug: string): string {
  return `${PREFIJO}${universidadId}.${slug}`
}

/** Progreso en blanco para una carrera. `actualizadoEn` se deja vacio: nadie inventa fechas. */
export function progresoCero(pensum: Pensum): Progreso {
  return {
    schema: "ciberpensum/progreso",
    version: VERSION_PROGRESO,
    universidadId: pensum.universidad.id,
    slug: pensum.slug,
    aprobadas: {},
    actualizadoEn: "",
  }
}

/** Lee el progreso guardado; si falta o esta corrupto, devuelve uno en blanco. */
export function leerProgreso(pensum: Pensum): Progreso {
  const raw = localStorage.getItem(clave(pensum.universidad.id, pensum.slug))
  if (!raw) return progresoCero(pensum)
  try {
    return migrarProgreso(JSON.parse(raw), VERSION_PROGRESO)
  } catch {
    return progresoCero(pensum)
  }
}

/** Guarda el progreso (canonico) y avisa a las otras herramientas de la misma pestana. */
export function guardarProgreso(p: Progreso): void {
  localStorage.setItem(clave(p.universidadId, p.slug), serializarProgreso(p))
  window.dispatchEvent(new CustomEvent("ciberpensum:progreso", { detail: p.slug }))
}

/** Copia con la fecha de hoy (ISO aaaa-mm-dd): es la fecha del guardado, no un dato inventado. */
export function conFechaActual(p: Progreso): Progreso {
  return { ...p, actualizadoEn: new Date().toISOString().slice(0, 10) }
}

/** Borra el progreso de la carrera activa. */
export function borrarProgreso(pensum: Pensum): void {
  localStorage.removeItem(clave(pensum.universidad.id, pensum.slug))
  window.dispatchEvent(new CustomEvent("ciberpensum:progreso", { detail: pensum.slug }))
}