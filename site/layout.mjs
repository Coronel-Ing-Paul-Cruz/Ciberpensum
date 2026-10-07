// site/layout.mjs — piezas HTML compartidas por todas las paginas generadas.
// Sin dependencias. Nada aqui abre target=_blank (regla 6) y todo funciona sin JS.

const TITULO_SITIO = "Ciberpensum"

/** Escape de HTML para textos de datos (los nombres vienen de PDF, no de HTML). */
export function esc(t) {
  return String(t ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** Ruta a un asset desde una pagina a `profundidad` niveles de la raiz (0 = home). */
export function rutaAssets(profundidad) {
  return profundidad === 0 ? "assets" : "../".repeat(profundidad) + "assets"
}

/**
 * Carcasa de pagina completa.
 * @param {object} o
 * @param {string} o.titulo         title + h1
 * @param {string} o.descripcion    meta description
 * @param {string} o.contenido      HTML del main (sin <main>)
 * @param {string} o.rutaAssets     prefijo para assets/css
 * @param {string} [o.jsonLd]       bloque JSON-LD (objeto)
 * @param {Array<[string,string]>} [o.migas]  ruta de navegacion: [etiqueta, href]
 * @param {string} [o.seccion]      seccion activa del nav: inicio|universidades|herramientas|guias
 */
export function pagina({ titulo, descripcion, contenido, rutaAssets, jsonLd, migas, seccion }) {
  // El nav y el pie viven a nivel de documento, no de pagina: hay que prefijar
  // con la misma profundidad que los assets ("../" x nivel) o los enlaces de
  // una pagina a profundidad 2 apuntan a rutas que no existen.
  const baseNav = rutaAssets === "assets" ? "" : rutaAssets.slice(0, -"assets".length)
  const nav = [
    ["inicio", "Inicio", "index.html"],
    ["universidades", "Universidades", "universidades/index.html"],
    ["herramientas", "Herramientas", "herramientas/index.html"],
    ["guias", "Guías", "guias/index.html"],
  ]
    .map(([id, etiqueta, href]) => {
      const actual = id === seccion ? ' aria-current="true"' : ""
      return `      <li><a href="${baseNav}${href}"${actual}>${etiqueta}</a></li>`
    })
    .join("\n")

  const migasHtml = migas?.length
    ? `<nav class="migas" aria-label="Ruta de navegación">
        <ol>
${migas.map(([etiqueta, href], i) => {
          const ultimo = i === migas.length - 1
          return `          <li>${ultimo ? `<span aria-current="page">${esc(etiqueta)}</span>` : `<a href="${href}">${esc(etiqueta)}</a>`}</li>`
        }).join("\n")}
        </ol>
      </nav>`
    : ""

  const jsonLdHtml = jsonLd ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} — ${TITULO_SITIO}</title>
  <meta name="description" content="${esc(descripcion)}">
  <link rel="icon" href="${rutaAssets}/icono.svg" type="image/svg+xml">
  <link rel="manifest" href="${rutaAssets}/manifest.webmanifest">
  <link rel="stylesheet" href="${rutaAssets}/css/site.css">${jsonLdHtml}
</head>
<body>
  <a class="salto-contenido" href="#principal">Saltar al contenido</a>
  <header class="cabecera">
    <div class="contenedor">
      <a class="marca" href="${baseNav}index.html"><em>Ciber</em>pensum</a>
      <nav class="navegacion" aria-label="Principal">
        <ul>
${nav}
        </ul>
      </nav>
    </div>
  </header>
${migasHtml}
  <main id="principal" class="contenedor">
${contenido}
  </main>
  <footer class="pie">
    <div class="contenedor">
      <ul>
        <li><a href="${baseNav}index.html">Inicio</a></li>
        <li><a href="${baseNav}universidades/index.html">Universidades</a></li>
        <li><a href="${baseNav}herramientas/index.html">Herramientas</a></li>
        <li><a href="${baseNav}guias/index.html">Guías</a></li>
      </ul>
      <p>${TITULO_SITIO} — planificador académico para universidades dominicanas. Sin cuentas, sin servidor. Los datos llevan su fuente oficial y su sha256; lo que no está confirmado se marca en pantalla, no se finge.</p>
    </div>
  </footer>
  <div class="barra-global" role="region" aria-label="Progreso y guardado">
    <div class="contenedor">
      <p id="progreso-global" aria-live="polite">Tu progreso vive en este navegador (sin cuentas) y puedes <a href="${baseNav}herramientas/progreso/index.html">guardarlo o restaurarlo desde aquí</a>.</p>
      <div class="botones">
        <a class="boton" href="${baseNav}herramientas/progreso/index.html">Cuaderno</a>
      </div>
    </div>
  </div>
  <script type="module" src="${rutaAssets}/js/global.js"></script>
</body>
</html>
`
}

/** Migas tipicas dentro de una pagina de carrera. La pagina esta a 3 niveles de la raiz. */
export function migasCarrera(carrera, profundidad = 3) {
  const base = profundidad === 0 ? "" : "../".repeat(profundidad)
  return [
    ["Inicio", base + "index.html"],
    ["Universidades", base + "universidades/index.html"],
    [carrera.universidad.nombre, base + `universidades/${carrera.universidad.id}/index.html`],
    [carrera.carrera, base + `carreras/${carrera.universidad.id}/${carrera.slug}/index.html`],
  ]
}

/** Celda con badge de validacion. */
export function badge(etiqueta, tipo = "ok") {
  const c = tipo === "aviso" ? "badge-aviso" : "badge-ok"
  return `<span class="badge ${c}">${esc(etiqueta)}</span>`
}

/** Bloque destacado de NO VERIFICADO (regla 8: se ve en pantalla). */
export function avisoNoVerificado(texto) {
  return `<aside class="aviso-no-verificado" aria-label="Dato no verificado">
  <strong>NO VERIFICADO</strong>
  <p>${esc(texto)}</p>
</aside>`
}

/** Meta de fuente de un JSON curado: URL, sha256 y fecha. */
export function metaFuente(fuente, etiqueta = "Fuente oficial") {
  return `<aside class="panel">
  <h3>${esc(etiqueta)}</h3>
  <p class="meta-fuente">Documento oficial (<code>${esc(fuente.archivo ?? "")}</code>) descargado el <time datetime="${esc(fuente.verificadoEn)}">${esc(fuente.verificadoEn)}</time>.<br>
  sha256: <code>${esc(fuente.sha256)}</code></p>
  <p><a href="${esc(fuente.url)}" ref="noreferrer">${esc(fuente.url)}</a></p>
</aside>`
}

/** Tabla de materias de un pensum completo. */
export function tablaMaterias(carrera) {
  // El JSON curado YA trae las materias en el orden del pensum oficial
  // (cuatrimestre asc; dentro de cada bloque, el orden visual del PDF).
  // Aqui NO se reordena alfabeticamente: se preserva ese orden (estable).
  // Cada bloque de cuatrimestre se separa visualmente con una fila cabecera
  // (igual que el PDF agrupa por cuatrimestre) y la barra de estadisticas
  // queda fija (sticky) mientras se desplaza la tabla.
  const porCuatrimestre = [...carrera.materias]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.cuatrimestre - b.m.cuatrimestre || a.i - b.i)
    .map((x) => x.m)
  const cuatrimestres = Math.max(...porCuatrimestre.map((m) => m.cuatrimestre), 0)
  let filas = ""
  let cuatActual = 0
  for (const m of porCuatrimestre) {
    if (m.cuatrimestre !== cuatActual) {
      cuatActual = m.cuatrimestre
      const creditos = porCuatrimestre
        .filter((o) => o.cuatrimestre === cuatActual)
        .reduce((a, o) => a + (o.creditos ?? 0), 0)
      filas += `    <tr class="fila-cuat"><th scope="rowgroup" colspan="5">Cuatrimestre ${cuatActual} — ${creditos} créditos</th></tr>\n`
    }
    // El codigo identifica la materia y es lo que referencian los
    // prerrequisitos. En pantalla va SOLO el codigo, como en la columna
    // PRE-REQ del pensum oficial (el nombre no se repite).
    const pre = (m.prerequisitos ?? [])
      .map((p) => `<code>${esc(p)}</code>`)
      .join(", ") || "—"
    const extra = []
    if (m.desdeCuatrimestre) extra.push(`desde cuat. ${m.desdeCuatrimestre}`)
    if (m.requiereTodas) extra.push("exige TODAS las anteriores")
    const extraHtml = extra.length ? `<br><span class="meta-fuente">${esc(extra.join(" · "))}</span>` : ""
    filas += `    <tr>
      <td class="numerico">${m.cuatrimestre}</td>
      <td><code>${esc(m.codigo)}</code></td>
      <td>${esc(m.nombre)}${extraHtml}</td>
      <td class="numerico">${m.creditos}</td>
      <td>${pre}</td>
    </tr>\n`
  }
  return `<p class="barra-estadisticas">${esc(carrera.carrera)} — ${carrera.totales.asignaturas} asignaturas · ${carrera.totales.creditos} créditos · ${cuatrimestres} cuatrimestres</p>
  <div class="tabla-contenedor">
  <table>
    <caption>Malla curricular completa — ${esc(carrera.carrera)} (${carrera.totales.asignaturas} asignaturas, ${carrera.totales.creditos} créditos)</caption>
    <thead>
      <tr><th scope="col">Cuat.</th><th scope="col">Código</th><th scope="col">Asignatura</th><th scope="col" class="numerico">Cr</th><th scope="col">Prerrequisitos</th></tr>
    </thead>
    <tbody>
${filas}
    </tbody>
  </table>
</div>`
}

/** Tabla de honores desde reglas.honores del JSON. */
export function tablaHonores(reglas) {
  const filas = (reglas.honores ?? [])
    .map((h) => `<tr><td>${esc(h.grado.replaceAll("-", " "))}</td><td class="numerico">${h.min}–${h.max}</td></tr>`)
    .join("\n")
  if (!filas) return ""
  const requisitos = reglas.requisitosHonores
  const extras = []
  if (requisitos?.sinReprobaciones) extras.push("sin ninguna materia reprobada")
  if (requisitos?.exclusiones?.length) extras.push(...requisitos.exclusiones)
  return `<div class="tabla-contenedor">
  <table>
    <caption>Distinciones académicas (según el reglamento oficial)</caption>
    <thead><tr><th scope="col">Distinción</th><th scope="col" class="numerico">Índice</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</div>
<p class="meta-fuente">${esc(extras.join(" · ") || "")}</p>`
}