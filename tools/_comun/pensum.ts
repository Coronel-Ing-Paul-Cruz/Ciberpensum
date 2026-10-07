/**
 * tools/_comun/pensum.ts — carga el pensum embebido en la pagina y registra el
 * service worker. El JSON del pensum lo inyecta build.mjs en cada pagina de
 * herramienta (<script type="application/json" id="datos-pensum">), asi el
 * navegador no necesita fetch de ningun archivo: funciona offline con la caché
 * del HTML.
 */
import { parsearPensum, type Pensum } from "../../core/datos/datos.js"

/** Lee y valida el pensum embebido. Devuelve null si falta o no valida. */
export function cargarPensum(): Pensum | null {
  const nodo = document.getElementById("datos-pensum")
  if (!nodo) return null
  try {
    const r = parsearPensum(nodo.textContent ?? "")
    return r.ok ? r.pensum : null
  } catch {
    return null
  }
}

/** Registra el service worker (offline). Fallar no rompe nada. */
export function registrarServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    // Relativo al ORIGEN, no a la pagina: ../sw.js desde una herramienta
    // resolvia a /herramientas/sw.js (404). El SW vive en la raiz (/sw.js)
    // con scope raiz, para que el offline cubra todo el sitio.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline no disponible: el sitio sigue funcionando en linea */
    })
  }
}