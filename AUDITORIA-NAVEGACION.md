# Auditoría de navegación — Ciberpensum

Fecha: **2026-10-10** · Skill usada: `navegacion-sitio` (creada ese día) ·
Alcance: `dist/` reconstruido (155 HTML) y fuentes `site/layout.mjs`,
`site/paginas.mjs`, `ui/componentes.css`.

> Regla 1: cada hallazgo trae su evidencia. Lo no comprobado, **NO VERIFICADO**.

## 1. Mapa del sitio (medido)

```
total html: 155
profundidad 0: 2     (index.html, 404.html)
profundidad 1: 11
profundidad 2: 9
profundidad 3: 133   (carreras/<uni>/<slug>/ y herramientas/<herramienta>/<uni>-<slug>/)
sitemap.xml: 150 <loc>
```

Nada importante está a más de 3 clics desde la portada (Inicio →
Universidades → Universidad → Carrera).

## 2. Checklist por capa

| Capa | Estado | Evidencia |
|---|---|---|
| Enlace "saltar al contenido" | OK | `layout.mjs:98` `<a class="salto-contenido" href="#principal">`, primer enfocable |
| `<nav>` global con nombre | OK | `layout.mjs:102` `aria-label="Principal"` |
| Marca de sección actual | OK (ver §3) | `layout.mjs:67` `aria-current="true"` + `componentes.css:162` |
| Migas con nombre | OK | `layout.mjs:73` `aria-label="Ruta de navegación"`; último ítem `<span aria-current="page">` sin enlace (correcto) |
| Cobertura de migas | OK | 122 páginas profundas reales con migas; las 20 sin migas son redirecciones `nota-minima` y `404.html` |
| Footer no es único camino | OK | repite Inicio/Universidades/Herramientas/Guías (`layout.mjs:113-125`), también en el header |
| Enlaces internos rotos | 0 | `build.mjs` → "enlaces internos: 0 rotos" |
| `target="_blank"` | 0 | prohibido en `layout.mjs` (regla 6); grep sin resultados |
| Funciona sin JS | OK | toda la navegación es `<a href>` a HTML prerenderizado |
| Botones/CTA con nombre | OK | `barra-global` `role="region" aria-label="Progreso y guardado"` (`layout.mjs:126`) |
| 404 con salida | OK | `dist/404.html` ofrece "Volver al inicio" |

## 3. `aria-current`: dos usos, ambos deliberados

- El **nav global** marca la sección activa con `aria-current="true"` (token
  genérico: "elemento actual dentro de un conjunto"). En una carrera (hijo de
  Universidades), el destino `/universidades/` **no** es la página actual, así
  que `"page"` sería incorrecto ahí.
- Las **migas** marcan la página exacta con `aria-current="page"`.

Son atributos distintos para relaciones distintas; se dejan como están (no es
un defecto, y cambiarlo introduciría un falso "page" en las páginas hijas).

## 4. Hallazgo corregido: página de universidad sin jerarquía de nivel

**Síntoma.** `universidades/unicaribe/index.html` listaba **16 carreras en una
rejilla plana**, mezclando 1 grado, 6 especialidades y 9 maestrías. El nivel no
se distinguía de un vistazo, y el problema crece con OYM/UTESA/UASD en cola.

**Causa.** `renderUniversidad` (`site/paginas.mjs`) volcaba todas las tarjetas
bajo un único `<h2>Carreras curadas</h2>`.

**Fix.** Agrupar por el campo existente `grado` del JSON curado, con un `<h2>`
por grupo en orden Grado → Postgrado y cualquier otro valor al final (nunca se
descarta una carrera). Evidencia del `dist` regenerado:

```
=== unicaribe ===   <h2>Grado · 1 carrera</h2>   <h2>Postgrado · 15 carreras</h2>
=== upid ===        <h2>Grado · 1 carrera</h2>   <h2>Postgrado · 1 carrera</h2>
=== utesa ===       <h2>Grado · 1 carrera</h2>
```

Jerarquía de encabezados resultante: `h1` (universidad) → `h2` (nivel) → `h3`
(carrera). Build: 19 carreras, 150 URLs, 0 enlaces rotos. Gate 4/4 (202 tests).

## 5. Observaciones sin acción (no son defectos)

- **Huérfanas de enlace entrante (21):** 20 redirecciones `herramientas/nota-minima/*`
  (intencionales, `noindex`, meta refresh a `indice`) + `404.html`. Correcto.
- **Sin busca ni índice plano de carreras:** con 150 URLs aún se navega en ≤3
  clics; añadir busca exige JS y no aporta hoy. **Decisión de producto**, no un
  arreglo pendiente. Si el catálogo crece mucho, reconsiderar un índice
  "Todas las carreras".

## 6. Método reproducible

- `npm run build` y contar HTML por profundidad (script Node).
- Grafo de enlaces internos: extraer `href`, resolver relativo→absoluto, contar
  entrantes; huérfano = 0 entrantes.
- Cobertura de migas: `contains('class="migas"')` por página.
