/**
 * tools/_comun/dom.ts — helpers DOM compartidos por las herramientas.
 * Viven fuera de core/ a proposito: usan document y esa es regla 3 de AGENTS.md.
 */

/** Selector estricto: devuelve null si el elemento no existe. */
export function $<T extends HTMLElement>(selector: string, raiz: ParentNode = document): T | null {
  return raiz.querySelector<T>(selector)
}

/** Crea un elemento con texto y atributos dados; sin innerHTML de datos. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  texto?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(tag)
  if (texto !== undefined) nodo.textContent = texto
  for (const [k, v] of Object.entries(attrs)) nodo.setAttribute(k, v)
  return nodo
}

/** Número legible: 2 decimales o "—". */
export function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "—"
}

/** Nombre del periodo con mayúscula inicial: "periodo" → "Periodo". */
export function nombrePeriodo(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Limpia un contenedor y devuelve lo mismo (para reconstruir vistas). */
export function vaciar(nodo: HTMLElement): HTMLElement {
  nodo.replaceChildren()
  return nodo
}