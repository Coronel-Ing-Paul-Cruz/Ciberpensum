---
name: navegacion-sitio
description: Audita la lógica de navegación de un sitio web (arquitectura de información, navegación global/local/utility, migas, enlaces internos y externos, estructura de URLs, orden de foco y comportamiento sin JS) y propone mejoras. Úsala cuando pidan "revisar la navegación", "auditar la arquitectura de información", "mejorar la navegación", "revisar menús, migas o enlaces", "¿se encuentra todo a pocos clics?", o al planear cambios de navegación/UI/UX.
license: MIT
metadata:
  author: ciberpensum
  version: "1.0"
---

# Auditoría de navegación de un sitio

## Para qué sirve

Revisar si una persona puede **encontrar, entender y recorrer** un sitio sin
perderse, y dejar hallazgos con evidencia. No es una auditoría de accesibilidad
WCAG completa (para eso usa la skill `accessibility`), ni de rendimiento
(`performance`, `core-web-vitals`) ni de SEO (`seo`): aquí el foco es la
**arquitectura de la información y la navegación**.

Se aplica a sitios estáticos (HTML prerenderizado) y a sus fuentes (plantillas y
generadores). En este repo: `site/` (plantillas y páginas) y `dist/` (salida).

## Principios que se evalúan

1. **Se encuentra (findability).** Todo contenido importante está a ≤ 3 clics
   desde la portada y existe una ruta de navegación evidente hacia él.
2. **Se entiende (claridad).** Etiquetas en el idioma del contenido, concretas y
   consistentes entre páginas y entre nav global/local.
3. **Se sabe dónde estás (orientación).** La página actual está marcada
   (`aria-current="page"`), hay migas en las profundas y título de sección.
4. **Se recorre (operabilidad).** Funciona con teclado, el foco es visible y
   sigue un orden lógico; **funciona sin JavaScript** (navegación real = enlaces
   `<a href>`, no `onclick`).
5. **No se rompe (integridad).** No hay enlaces rotos, huérfanos ni ciclos
   raros; las URLs son legibles y estables.

## Cómo reunir el mapa del sitio (evidencia primero)

Nunca audites "de memoria": primero construye el mapa y cópialo.

```bash
# 1. Mapa de páginas generadas
find dist -name "*.html" | sort            # o: Get-ChildItem dist -Recurse -Filter *.html
# 2. Enlaces internos declarados
grep -rohE 'href="[^"]+"' dist --include=*.html | sort -u
# 3. Si el proyecto mantiene un sitemap, contrástalo con lo anterior
cat dist/sitemap.xml
```

Herramientas del propio repo que conviene correr antes de opinar:

- `npm run verify` — estructura y reglas de código.
- `node tools-cli/check-links.mjs` (o el equivalente) — enlaces internos.
- `npm run build` — regenera `dist/` para auditar el estado real.

## Checklist por capa

### Barra global (header)

- [ ] Existe un `<nav>` con `aria-label` que lo distingue (p. ej. "principal").
- [ ] Enlace a la portada y a las secciones de primer nivel.
- [ ] La página/sección actual está marcada (`aria-current="page"`), no solo
      coloreada (el color solo no basta: regla 1.4.1).
- [ ] Enlace de "saltar al contenido" como primer elemento enfocable.
- [ ] Un solo `<h1>` por página; el título refleja la sección.
- [ ] Sin menús que dependan de `:hover` únicamente.

### Nav local / de sección

- [ ] ¿Hace falta? Si una sección tiene subsecciones, hay navegación local.
- [ ] No compite visualmente con la global (jerarquía clara).
- [ ] Etiquetas coherentes con las de las migas y el título.

### Barra de utilidades / herramientas

- [ ] Acciones transversales (buscar, cambiar de contexto/unidad) agrupadas
      aparte de la navegación principal.
- [ ] Si hay un selector de contexto (p. ej. elegir carrera/universidad), su
      estado por defecto y su persistencia son predecibles.

### Migas (breadcrumbs)

- [ ] Presentes en páginas de profundidad ≥ 2.
- [ ] Reflejan la **jerarquía**, no el historial de clics.
- [ ] El último elemento es la página actual y **no** es un enlace.
- [ ] Marcadas con `<nav aria-label="migas">` y lista ordenada.

### Enlaces internos

- [ ] Texto descriptivo: se entiende fuera de contexto; **nada de "clic aquí"**.
- [ ] Sin enlaces duplicados que apunten al mismo destino con distinto texto sin
      motivo.
- [ ] Sin `target="_blank"` (en este repo está prohibido; los sitios estáticos no
      lo necesitan).
- [ ] Los enlaces que parecen enlaces lo son (`<a>`), no `div` con `onclick`.

### Footer

- [ ] Repite los destinos clave y añade los legales/contacto.
- [ ] No es el **único** camino a contenido importante (findability).

### URLs

- [ ] Legibles y estables (kebab-case, sin mayúsculas aleatorias).
- [ ] El estado (p. ej. progreso) va en el fragmento `#`, no en el servidor.
- [ ] Los cambios de URL tienen redirección estática; nunca se rompen enlaces
      publicados sin redirigir.

### Teclado y foco

- [ ] Se puede recorrer toda la navegación con Tab en orden lógico.
- [ ] El foco es siempre visible (no `outline: none` sin sustituto).
- [ ] Sin trampas de foco; el "saltar al contenido" funciona.

### Sin JavaScript

- [ ] La navegación funciona con JS desactivado (es lo normal en este repo).
- [ ] Ningún destino depende de `fetch`/eventos para existir.

## Salida esperada

Informe en texto, ordenado por severidad. Una fila por hallazgo **con
evidencia** (archivo:línea o comando y su salida). Lo no comprobado se marca
**NO VERIFICADO**; no se afirma nada sin la salida pegada.

| # | Hallazgo | Severidad | Evidencia (archivo:línea / salida) | Recomendación |
|---|---|---|---|---|
| 1 | ... | alta/media/baja | `site/layout.mjs:120` | ... |

Cierra con: nº de páginas auditadas, rutas de profundidad > 3 desde la portada
(si las hay), y una lista corta de arreglos priorizados.

## Errores frecuentes

- Confundir **navegación** con **enlaces**: un enlace roto es integridad, no
  arquitectura; sepáralo.
- Auditar el sitio viejo: regenera `dist/` antes.
- Marcar la página actual solo con color (falla 1.4.1).
- Añadir migas donde la jerarquía no las justifica: ruido.
- Aceptar como "navegable" algo que solo responde a clic de ratón.
