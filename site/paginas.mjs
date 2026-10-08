// site/paginas.mjs — renderizadores de todas las paginas del sitio.
// Consume data/curated/**/*.json a traves del index que pasa build.mjs.
// Nada abre target=_blank; todo el contenido esencial es estatico (funciona sin JS).
import {
  pagina, esc, rutaAssets, migasCarrera, badge, avisoNoVerificado,
  metaFuente, tablaMaterias, tablaHonores,
} from "./layout.mjs"

/** URL absoluta del sitio para canonicals, sitemap y JSON-LD.
 * 2026-10-07: el dominio ciberpensum.do nunca se registro; el sitio vive en
 * GitHub Pages. Cuando se registre el dominio propio, cambiar aqui y rebuild. */
export const SITIO_URL = "https://coronel-ing-paul-cruz.github.io/Ciberpensum"

/** Metadatos de las 6 herramientas. El orden es el de la pagina de herramientas. */
export const HERRAMIENTAS = [
  {
    slug: "progreso",
    titulo: "Cuaderno de progreso",
    resumen: "Marca qué materias aprobaste y con qué nota. Es la base del resto de las herramientas.",
    descripcion: "Registra el avance en la carrera: materias aprobadas con nota y materias en curso.",
    tema: "progreso",
  },
  {
    slug: "indice",
    titulo: "Índice académico",
    resumen: "Calcula tu índice ponderado por créditos y compáralo con las distinciones del reglamento.",
    descripcion: "Índice acumulado ponderado por créditos y distinciones académicas con su fuente.",
    tema: "índice y nota",
  },
  {
    slug: "progresion",
    titulo: "Progresión",
    resumen: "Qué puedes inscribir hoy según tus aprobadas, y por qué algo sigue bloqueado.",
    descripcion: "Materias disponibles por prerrequisitos y motivos de bloqueo uno a uno.",
    tema: "progreso",
  },
  {
    slug: "nota-minima",
    titulo: "Nota mínima",
    resumen: "¿Qué nota necesitas en la próxima materia para alcanzar un índice objetivo?",
    descripcion: "Cálculo de la nota necesaria (ponderada) para llegar a un índice objetivo.",
    tema: "índice y nota",
  },
  {
    slug: "plan-carga",
    titulo: "Plan de carga",
    resumen: "Cuántos créditos llevarías por cuatrimestre y cuáles materias conviene inscribir primero.",
    descripcion: "Distribución de créditos por cuatrimestre, criticidad de cada materia y selección de carga.",
    tema: "planificación",
  },
  {
    slug: "portabilidad",
    titulo: "Guardar y compartir",
    resumen: "Exporta tu progreso a texto, impórtalo de vuelta o compártelo con un enlace corto.",
    descripcion: "Exportar, importar y enlazar el progreso como texto plano. Nada sale del navegador.",
    tema: "progreso",
  },
]

/** Carreras curadas para la portada/universidades. */
function resumenCarrera(c) {
  return {
    slug: c.slug,
    id: c.universidad.id,
    universidad: c.universidad.nombre,
    carrera: c.carrera,
    grado: c.grado,
    periodos: c.duracion.periodos,
    tipo: c.duracion.tipoPeriodo,
    materias: c.totales.asignaturas,
    creditos: c.totales.creditos,
    vigente: c.vigente,
  }
}

/* ------------------------------------------------------------------ HOME */
export function renderHome(carreras) {
  const unis = []
  for (const c of carreras) {
    const u = resumenCarrera(c)
    const existente = unis.find((x) => x.id === u.id)
    if (existente) existente.carreras.push(u)
    else unis.push({ id: u.id, nombre: u.universidad, carreras: [u] })
  }
  const tarjetasUnis = unis.length
    ? unis.map((u) => `<a class="tarjeta" href="universidades/${esc(u.id)}/index.html">
      <h3>${esc(u.nombre)}</h3>
      <p>${u.carreras.length} carrera(s) curada(s) con fuente oficial.</p>
    </a>`).join("\n")
    : `<p>Sin carreras publicadas todavía.</p>`
  const tarjetasHerramientas = HERRAMIENTAS.map((h) => `<a class="tarjeta" href="herramientas/${esc(h.slug)}/index.html">
    <h3>${esc(h.titulo)}</h3>
    <p>${esc(h.resumen)}</p>
  </a>`).join("\n")

  const contenido = `
  <section class="hero">
    <h1>Tu carrera, planificada con fuente oficial</h1>
    <p>Ciberpensum es un planificador académico para universidades dominicanas: pensum, índice, prerrequisitos y objetivo de nota. Sin cuentas, sin servidor: tus datos viven en tu navegador y tú decides si los exportas. Cada cifra del sitio sale de un PDF oficial con su sha256; lo que no está confirmado se marca en pantalla, no se finge.</p>
  </section>

  <section>
    <h2>Universidades</h2>
    <div class="rejilla">
${tarjetasUnis}
    </div>
  </section>

  <section>
    <h2>Herramientas</h2>
    <p>Todas funcionan desde <code>core/</code> en tu navegador; ninguna envía datos a ningún servidor.</p>
    <div class="rejilla">
${tarjetasHerramientas}
    </div>
  </section>

  <section>
    <h2>Cómo funciona</h2>
    <div class="panel">
      <ol>
        <li><strong>Registras tu avance</strong> en el cuaderno de progreso (materias aprobadas con nota).</li>
        <li><strong>El resto calcula sobre eso</strong>: índice, qué puedes inscribir, cuánto te falta, qué nota necesitas.</li>
        <li><strong>Exportas o compartes</strong> con un enlace <code>#p=…</code>: el progreso viaja como texto, sin cuentas.</li>
      </ol>
      ${avisoNoVerificado("La forma exacta del índice no está documentada en el reglamento de UNICARIBE; el sitio usa la fórmula estándar ponderada por créditos y la marca aquí y en cada cálculo.")}
    </div>
  </section>`

  return pagina({
    titulo: "Planificador académico con fuentes oficiales",
    descripcion: "Planificador académico para universidades dominicanas: pensum oficial, índice, progresión y nota mínima. Sin cuentas, sin servidor.",
    contenido,
    rutaAssets: rutaAssets(0),
    seccion: "inicio",
    canonical: SITIO_URL + "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Ciberpensum",
      url: SITIO_URL,
      inLanguage: "es-DO",
      description: "Planificador académico para universidades dominicanas con datos de fuentes oficiales.",
    },
  })
}

/* ------------------------------------------------------- UNIVERSIDADES */
export function renderUniversidades(carreras) {
  const porUni = new Map()
  for (const c of carreras) {
    const i = c.universidad.id
    if (!porUni.has(i)) porUni.set(i, { id: i, nombre: c.universidad.nombre, carreras: [] })
    porUni.get(i).carreras.push(resumenCarrera(c))
  }
  const tarjetas = [...porUni.values()].map((u) => `<a class="tarjeta" href="${esc(u.id)}/index.html">
    <h3>${esc(u.nombre)}</h3>
    <p>${u.carreras.length} carrera(s) curada(s).</p>
  </a>`).join("\n")
  const contenido = `
  <h1>Universidades</h1>
  <p>Universidades dominicanas con pensum curado a partir de su documentación oficial.</p>
  <h2>Universidades con oferta curada</h2>
  <div class="rejilla">
${tarjetas}
  </div>`
  return pagina({
    titulo: "Universidades",
    descripcion: "Universidades dominicanas con pensum curado a partir de fuentes oficiales.",
    contenido,
    rutaAssets: rutaAssets(1),
    seccion: "universidades",
    canonical: SITIO_URL + "/universidades/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Universidades", url: SITIO_URL + "/universidades/" },
  })
}

export function renderUniversidad(uniId, carreras) {
  const deUni = carreras.filter((c) => c.universidad.id === uniId)
  const nombre = deUni[0]?.universidad.nombre ?? uniId
  const tarjetas = deUni.map((c) => `<a class="tarjeta" href="../../carreras/${esc(c.universidad.id)}/${esc(c.slug)}/index.html">
    <h3>${esc(c.carrera)}</h3>
    <p>${c.totales.asignaturas} asignaturas · ${c.totales.creditos} créditos · ${c.duracion.periodos} ${esc(c.duracion.tipoPeriodo)}s ${c.vigente ? badge("vigente") : badge("histórica", "aviso")}</p>
  </a>`).join("\n")
  const contenido = `
  <h1>${esc(nombre)}</h1>
  <p>Carreras curadas a partir de los documentos oficiales de ${esc(nombre)}.</p>
  <h2>Carreras curadas</h2>
  <div class="rejilla">
${tarjetas}
  </div>`
  return pagina({
    titulo: `${nombre} — Universidades`,
    descripcion: `Carreras curadas de ${nombre}.`,
    contenido,
    rutaAssets: rutaAssets(2),
    seccion: "universidades",
    canonical: SITIO_URL + `/universidades/${uniId}/`,
    migas: [
      ["Inicio", "../../index.html"],
      ["Universidades", "../index.html"],
      [nombre, `./index.html`],
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollegeOrUniversity",
      name: nombre,
      url: SITIO_URL + `/universidades/${uniId}/`,
    },
  })
}

/* ------------------------------------------------------------- CARRERA */
export function renderCarrera(c) {
  const base = "../../../"
  const migas = migasCarrera(c, 3)
  const noVerificado = c.notas?.length
    ? `<section>
  <h2>Advertencias de la fuente</h2>
${c.notas.map((n) => `<p class="aviso-no-verificado">${esc(n)}</p>`).join("\n")}
  </section>`
    : ""
  const reglasTxt = []
  if (c.reglas.escala.formaIndice === "no-verificado")
    reglasTxt.push(avisoNoVerificado("El reglamento no documenta de forma explícita la fórmula del índice. El sitio usa el promedio ponderado por créditos (estándar) y lo marca."))

  const contenido = `
  <h1>${esc(c.carrera)}</h1>
  <p class="meta-fuente">${esc(c.universidad.nombre)} · ${esc(c.grado)} · ${c.duracion.periodos} ${esc(c.duracion.tipoPeriodo)}s · ${badge(c.vigente ? "pensum vigente" : "pensum histórico")}</p>

  <section>
    <h2>Malla curricular</h2>
    ${tablaMaterias(c)}
  </section>

  <section>
    <h2>Reglas académicas</h2>
    ${reglasTxt.join("\n")}
    <h3>Escala y aprobación</h3>
    <ul>
      <li>Escala de ${c.reglas.escala.base} puntos (mínimo ${c.reglas.escala.minimo}, máximo ${c.reglas.escala.maximo}).</li>
      <li>Se aprueba con ${c.reglas.escala.aprobacion} puntos o más.</li>
    </ul>
    ${tablaHonores(c.reglas)}
  </section>

  <section>
    <h2>Documento fuente</h2>
    ${metaFuente(c.fuente, "Fuente del pensum")}
    ${c.reglas.fuente ? metaFuente(c.reglas.fuente, "Fuente de las reglas académicas (reglamento)") : ""}
  </section>

  <section>
    <h2>Prueba las herramientas con esta carrera</h2>
    <div class="rejilla">
      <a class="tarjeta" href="${base}herramientas/progreso/${esc(c.universidad.id)}-${esc(c.slug)}/index.html"><h3>Cuaderno de progreso</h3><p>Empieza marcando tus materias aprobadas.</p></a>
      <a class="tarjeta" href="${base}herramientas/indice/${esc(c.universidad.id)}-${esc(c.slug)}/index.html"><h3>Índice académico</h3><p>Calcula tu índice y compáralo con las distinciones.</p></a>
      <a class="tarjeta" href="${base}herramientas/progresion/${esc(c.universidad.id)}-${esc(c.slug)}/index.html"><h3>Progresión</h3><p>Qué puedes inscribir hoy.</p></a>
    </div>
  </section>
${noVerificado}`

  const graduados = c.materias.map((m) => ({
    "@type": "Course",
    name: m.nombre,
    courseCode: m.codigo,
    numberOfCredits: m.creditos,
    inLanguage: "es",
  }))
  return pagina({
    titulo: `${c.carrera} — ${c.universidad.nombre}`,
    descripcion: `Pensum oficial de ${c.carrera} en ${c.universidad.nombre}: ${c.totales.asignaturas} asignaturas, ${c.totales.creditos} créditos, con fuente y sha256.`,
    contenido,
    rutaAssets: rutaAssets(3),
    seccion: "universidades",
    canonical: SITIO_URL + `/carreras/${c.universidad.id}/${c.slug}/`,
    migas,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollegeOrUniversity",
          "@id": SITIO_URL + `/universidades/${c.universidad.id}/#uni`,
          name: c.universidad.nombre,
        },
        {
          "@type": "EducationalOccupationalCredential",
          name: c.carrera,
          credentialCategory: c.grado === "grado" ? "licenciatura" : "posgrado",
          description: `Pensum de ${c.carrera}: ${c.totales.asignaturas} asignaturas y ${c.totales.creditos} créditos en ${c.duracion.periodos} ${c.duracion.tipoPeriodo}s, según documento oficial de ${c.universidad.nombre}.`,
          url: SITIO_URL + `/carreras/${c.universidad.id}/${c.slug}/`,
          provider: { "@id": SITIO_URL + `/universidades/${c.universidad.id}/#uni` },
          // La carrera (EducationalOccupationalCredential) CONTIENE los cursos:
          // hasPart acepta CreativeWork (Course lo es). competencyRequired solo
          // admite DefinedTerm/Role/Text/URL -> 55 errores en el validador.
          hasPart: graduados,
        },
      ],
    },
  })
}

/* --------------------------------------------------------- HERRAMIENTAS */
export function renderHerramientas() {
  const tarjetas = HERRAMIENTAS.map((h) => `<a class="tarjeta" href="${esc(h.slug)}/index.html">
    <h3>${esc(h.titulo)}</h3>
    <p>${esc(h.resumen)}</p>
  </a>`).join("\n")
  const contenido = `
  <h1>Herramientas</h1>
  <p>Calculadoras y visores que trabajan sobre el progreso que guardas en tu navegador. Sin cuentas y sin servidor: nada sale de tu equipo salvo lo que tú exportes.</p>
  <h2>Las seis herramientas</h2>
  <div class="rejilla">
${tarjetas}
  </div>`
  return pagina({
    titulo: "Herramientas",
    descripcion: "Seis herramientas de planificación académica que funcionan sin cuentas ni servidor.",
    contenido,
    rutaAssets: rutaAssets(1),
    seccion: "herramientas",
    canonical: SITIO_URL + "/herramientas/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Herramientas", url: SITIO_URL + "/herramientas/" },
  })
}

/** Contenido estatico (sin JS) que aterriza cada herramienta. */
const CONTENIDO_SIN_JS = {
  progreso: (c) => `
    <p>Marca las materias aprobadas con su nota (escala ${c.reglas.escala.minimo}–${c.reglas.escala.maximo}, se aprueba con ${c.reglas.escala.aprobacion}) o en curso. El resto de herramientas lee este cuaderno. Tu avance queda en este navegador.</p>
    <h2>Malla para marcar</h2>
    ${tablaMaterias(c)}`,
  indice: (c) => `
    <p>Índice acumulado = promedio de notas <strong>ponderado por créditos</strong>. Mételo tu nota por materia y el índice se recalcula en vivo.</p>
    <h2>Distinciones (${esc(c.universidad.nombre)})</h2>
    ${tablaHonores(c.reglas)}
    ${c.reglas.escala.formaIndice === "no-verificado" ? avisoNoVerificado("La fórmula del índice no está documentada en el reglamento; se usa el promedio ponderado por créditos (estándar) y se marca.") : ""}`,
  progresion: (c) => `
    <p>Con tus aprobadas, esta herramienta lista qué puedes inscribir ahora y los motivos de bloqueo de cada materia que aún no, una por una (prerrequisito pendiente, «desde cuatrimestre», «exige TODAS las anteriores»).</p>
    <h2>Malla con prerrequisitos</h2>
    ${tablaMaterias(c)}`,
  "nota-minima": (c) => `
    <p>Dado tu índice actual y los créditos que te faltan, calcula el promedio que necesitas en lo que falta, y la nota exacta de la próxima materia, para alcanzar un índice objetivo.</p>
    <h2>Datos de la escala</h2>
    <ul>
      <li>Escala: ${c.reglas.escala.minimo}–${c.reglas.escala.maximo} · aprobación en ${c.reglas.escala.aprobacion}.</li>
      <li>${c.totales.creditos} créditos en total.</li>
    </ul>
    ${c.reglas.escala.formaIndice === "no-verificado" ? avisoNoVerificado("Cálculo sobre promedio ponderado por créditos; la fórmula exacta no está documentada (NO VERIFICADO).") : ""}`,
  "plan-carga": (c) => `
    <p>Créditos por cuatrimestre del plan, cuántos llevas y qué materias conviene inscribir primero (las que más destraban), ajustado a tu capacidad de créditos.</p>
    <h2>Créditos por cuatrimestre (plan oficial)</h2>
    <div class="tabla-contenedor"><table>
      <caption>Distribución oficial de créditos</caption>
      <thead><tr><th scope="col">Cuat.</th><th scope="col" class="numerico">Créditos</th></tr></thead>
      <tbody>${(carreraPorCuatrimestre(c)).map(([k, v]) => `<tr><td class="numerico">${k}</td><td class="numerico">${v}</td></tr>`).join("\n")}</tbody>
    </table></div>`,
  portabilidad: (c) => `
    <p>Tu progreso vive en <code>localStorage</code> de este navegador. Aquí puedes exportarlo a texto (descarga o <em>copy-paste</em>), importarlo de vuelta en otro navegador, y generar un enlace <code>#p=…</code> para compartir. Nada de esto usa un servidor.</p>
    <h2>La carrera activa</h2>
    <p>${esc(c.carrera)} — ${esc(c.universidad.nombre)} (${c.totales.asignaturas} materias, ${c.totales.creditos} créditos).</p>`,
}

function carreraPorCuatrimestre(c) {
  const m = new Map()
  for (const a of c.materias) {
    const v = (m.get(a.cuatrimestre) ?? 0) + a.creditos
    m.set(a.cuatrimestre, v)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

var FUNCION_POR_SLUG = {
  progreso: (h, c, base) => CONTENIDO_SIN_JS.progreso(c),
  indice: (h, c, base) => CONTENIDO_SIN_JS.indice(c),
  progresion: (h, c, base) => CONTENIDO_SIN_JS.progresion(c),
  "nota-minima": (h, c, base) => CONTENIDO_SIN_JS["nota-minima"](c),
  "plan-carga": (h, c, base) => CONTENIDO_SIN_JS["plan-carga"](c),
  portabilidad: (h, c, base) => CONTENIDO_SIN_JS.portabilidad(c),
}

/** Direccion de una herramienta para una carrera concreta. */
export function rutaHerramientaCarrera(h, c) {
  return `${h.slug}/${c.universidad.id}-${c.slug}/index.html`
}

/**
 * Indice de una herramienta: el SELECTOR DE CARRERA (decision 2026-10-07).
 * Sin JS funciona igual: es la lista de carreras curadas disponibles para
 * esa herramienta. /herramientas/<slug>/index.html
 */
export function renderIndiceHerramienta(h, carreras) {
  const tarjetas = carreras.map((c) => `<a class="tarjeta" href="${esc(rutaHerramientaCarrera(h, c))}">
    <h3>${esc(c.carrera)}</h3>
    <p>${esc(c.universidad.nombre)} · ${c.totales.asignaturas} materias · ${c.totales.creditos} créditos</p>
  </a>`).join("\n")
  const contenido = `
  <h1>${esc(h.titulo)}</h1>
  <p>${esc(h.descripcion)}</p>
  <h2>Elige tu carrera</h2>
  <p>Cada herramienta trabaja sobre el pensum de la carrera que elijas aquí. Tu progreso se guarda por carrera en este navegador.</p>
  <div class="rejilla">
${tarjetas}
  </div>`
  return pagina({
    titulo: `${h.titulo} — Herramientas`,
    descripcion: h.descripcion,
    contenido,
    rutaAssets: rutaAssets(2),
    seccion: "herramientas",
    canonical: SITIO_URL + `/herramientas/${h.slug}/`,
    migas: [
      ["Inicio", "../../index.html"],
      ["Herramientas", "../index.html"],
      [h.titulo, "./index.html"],
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: h.titulo,
      description: h.descripcion,
      url: SITIO_URL + `/herramientas/${h.slug}/`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Cualquiera (navegador)",
    },
  })
}

/**
 * Pagina de una herramienta para UNA carrera.
 * /herramientas/<slug>/<uniId>-<carreraSlug>/index.html (profundidad 3).
 */
export function renderHerramienta(h, carrera, profundidad = 3) {
  const sinJs = FUNCION_POR_SLUG[h.slug](h, carrera)
  const jsonPensum = JSON.stringify(carrera).replaceAll("</", "<\\/")
  const assets = rutaAssets(profundidad)
  const base = "../".repeat(profundidad)
  // CLS + una sola copia del contenido (regla 6 y hallazgos CWV/a11y): el panel
  // #app nace con el contenido estatico (altura real de la pagina) y el modulo
  // lo REPLACE en su sitio; sin JS, la pagina es el contenido estatico entero.
  const contenido = `
  <h1>${esc(h.titulo)}</h1>
  <p>${esc(h.descripcion)}</p>
  <p class="meta-fuente">Carrera activa: ${esc(carrera.carrera)} — ${esc(carrera.universidad.nombre)} (${carrera.totales.asignaturas} materias, ${carrera.totales.creditos} créditos). <a href="../index.html">Cambiar de carrera</a></p>

  ${metaFuente(carrera.fuente, "Fuente de los datos de esta página")}

  <div class="panel" id="app">
    <noscript><p><strong>JavaScript desactivado.</strong> Esta herramienta se muestra completa como datos; el cálculo en vivo se activa con JS.</p></noscript>
    <section aria-label="Contenido de esta herramienta (visible sin JavaScript)">
${sinJs}
    </section>
  </div>

  <script type="application/json" id="datos-pensum">${jsonPensum}</script>
  <script type="module" src="${assets}/js/${esc(h.slug)}.js"></script>`
  return pagina({
    titulo: `${h.titulo} — ${carrera.carrera}`,
    descripcion: `${h.descripcion} Carrera: ${carrera.carrera} (${carrera.universidad.nombre}).`,
    contenido,
    rutaAssets: assets,
    seccion: "herramientas",
    canonical: SITIO_URL + `/herramientas/${rutaHerramientaCarrera(h, carrera).replace(/\/index\.html$/, "/")}`,
    migas: [
      ["Inicio", base + "index.html"],
      ["Herramientas", base + "herramientas/index.html"],
      [h.titulo, "../index.html"],
      [carrera.carrera, "./index.html"],
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: `${h.titulo} — ${carrera.carrera}`,
      description: h.descripcion,
      url: SITIO_URL + `/herramientas/${rutaHerramientaCarrera(h, carrera).replace(/\/index\.html$/, "/")}`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Cualquiera (navegador)",
    },
  })
}

/* ----------------------------------------------------------------- GUIAS */
export const GUIAS = [
  {
    slug: "indice-academico",
    titulo: "El índice académico, sin misterio",
    resumen: "Qué es, cómo se pondera y dónde está la fuente.",
  },
  {
    slug: "honores-y-distinciones",
    titulo: "Honores y distinciones",
    resumen: "Las bandas del reglamento y sus requisitos (Art. 89).",
  },
  {
    slug: "prerrequisitos",
    titulo: "Prerrequisitos y electivas",
    resumen: "El grafo de la carrera, las electivas «desde cuatrimestre» y el proyecto final.",
  },
  {
    slug: "objetivo-de-indice",
    titulo: "Cómo leer la nota mínima",
    resumen: "Qué significa el promedio que te falta y cuándo un objetivo es imposible.",
  },
  {
    slug: "plan-de-carga",
    titulo: "Planificar tu carga",
    resumen: "Créditos por cuatrimestre, qué inscribir primero y capacidad razonable.",
  },
  {
    slug: "progreso-y-privacidad",
    titulo: "Tu progreso, tu privacidad",
    resumen: "localStorage, exportar e importar, y el enlace #p=.",
  },
]

const CUERPO_GUIAS = {
  "indice-academico": `
    <p>El índice académico (o promedio) suele ser lo primero que una universidad exige para honores, ayudantías o continuidad. En Ciberpensum se calcula como el <strong>promedio ponderado por créditos</strong>:</p>
    <p class="al-centro"><code>índice = Σ(nota × créditos) ÷ Σ(créditos)</code></p>
    <p>Una materia de 4 créditos pesa el doble que una de 2, lo que evita que una materia pequeña con nota altísima maquille el promedio.</p>
    ${avisoNoVerificado("La fórmula del índice de UNICARIBE no aparece de forma explícita en el Reglamento Estudiantil (Art. 72 fija la escala 0–100; el Art. 76 menciona una escala 0–4 que choca con la anterior). El sitio usa la ponderación estándar y la marca por todas partes.")}
    <p>Dónde verlo: herramienta <a href="../herramientas/indice/index.html">Índice académico</a>.</p>`,
  "honores-y-distinciones": `
    <p>El Reglamento Estudiantil de UNICARIBE (Art. 89) fija las distinciones por banda de índice, sobre la escala de 100:</p>
    <div class="tabla-contenedor"><table>
      <thead><tr><th scope="col">Distinción</th><th scope="col" class="numerico">Índice</th></tr></thead>
      <tbody>
        <tr><td>Summa Cum Laude</td><td class="numerico">95 – 100</td></tr>
        <tr><td>Magna Cum Laude</td><td class="numerico">90 – 94</td></tr>
        <tr><td>Cum Laude</td><td class="numerico">85 – 89</td></tr>
      </tbody>
    </table></div>
    <p>Además del índice, el reglamento exige no haber reprobado ninguna materia y excluye a quien esté en <strong>separación temporal</strong> o bajo <strong>sancción disciplinaria</strong>.</p>
    <p>No basta el número: un índice alto con una materia reprobada no da distinción.</p>`,
  prerrequisitos: `
    <p>Las materias de la carrera forman un <strong>grafo</strong>: muchas abren otras. Ciberpensum lo muestra al revés, como bloqueos: «Falta aprobar FGC-102» es más útil que «necesitas FGC-102».</p>
    <p>Caso especial de UNICARIBE en esta carrera: las <strong>electivas</strong> no tienen prerrequisito con código; el PDF dice «7MO. CUAT.» y «9NO. CUAT.» en esa columna. Ciberpensum las marca como <em>desde el 7.º cuatrimestre</em>.</p>
    <p>El <strong>proyecto integrador</strong> (INC-600) exige literalmente «TODAS» las anteriores: no termina la carrera sin aprobar el resto.</p>`,
  "objetivo-de-indice": `
    <p>La herramienta <a href="../herramientas/nota-minima/index.html">Nota mínima</a> responde: «si hoy tengo índice X con C créditos, ¿qué promedio necesito en los siguientes P créditos para llegar a Y?»</p>
    <p>La fórmula es la inversa de la del índice:</p>
    <p class="al-centro"><code>necesario = (Y×(C+P) − X×C) ÷ P</code></p>
    <p>Dos detalles que importan:</p>
    <ul>
      <li>Si el resultado supera la escala (más de 100), el objetivo es <strong>imposible</strong> desde donde estás: el sitio te lo dice.</li>
      <li>Si el resultado sale por debajo del mínimo de aprobación, la nota mínima mostrada es la de aprobación: una materia reprobada rompe el índice y las distinciones.</li>
    </ul>`,
  "plan-de-carga": `
    <p>La carrera dura 12 cuatrimestres y reparte los ${166 + (166 - 166)} créditos de forma irregular: cuatrimestres flacos (10 créditos) y gordos (23). Conocer la distribución ayuda a no cargar de más al final.</p>
    <p>Lo que Ciberpensum añade es la <strong>criticidad</strong>: cuántas materias dependen de cada una. Una materia que destraba tres vale más inscribirla antes que una que no abre nada, aunque ambas quepan en tu capacidad.</p>
    <p>La capacidad de créditos por cuatrimestre la pones tú: no hay una cifra oficial en el PDF (queda NO VERIFICADO).</p>`,
  "progreso-y-privacidad": `
    <p>Tus datos viven en <code>localStorage</code> de este navegador, bajo una clave por universidad y carrera. No hay cuentas ni servidores: nada se sube en ningún momento.</p>
    <p>Tres vías para llevar tu progreso contigo:</p>
    <ul>
      <li><strong>Exportar</strong> — genera un texto JSON listo para guardar o copiar.</li>
      <li><strong>Importar</strong> — pegas ese texto y el cuaderno se restaura (con comprobación de integridad).</li>
      <li><strong>Enlace <code>#p=…</code></strong> — un fragmento compacto que codifica tu progreso; quien lo abra carga la página con tu avance.</li>
    </ul>
    <p>Borrar los datos del sitio en el navegador (o usar otro navegador/equipo) significa empezar de cero: por eso existe la exportación.</p>`,
}

export function renderGuias() {
  const tarjetas = GUIAS.map((g) => `<a class="tarjeta" href="${esc(g.slug)}.html">
    <h3>${esc(g.titulo)}</h3>
    <p>${esc(g.resumen)}</p>
  </a>`).join("\n")
  const contenido = `
  <h1>Guías</h1>
  <p>Explicaciones de cómo se calcula cada cosa y de dónde salen los números.</p>
  <h2>Las guías</h2>
  <div class="rejilla">
${tarjetas}
  </div>`
  return pagina({
    titulo: "Guías",
    descripcion: "Guías de Ciberpensum: índice, honores, prerrequisitos, nota mínima, carga y privacidad.",
    contenido,
    rutaAssets: rutaAssets(1),
    seccion: "guias",
    canonical: SITIO_URL + "/guias/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Guías", url: SITIO_URL + "/guias/" },
  })
}

export function renderGuia(g) {
  const cuerpo = CUERPO_GUIAS[g.slug]
  const contenido = `
  <h1>${esc(g.titulo)}</h1>
${cuerpo}
  <section>
    <h2>¿Dudas o datos contradictorios?</h2>
    <p>Cada página de carrera lista sus advertencias de fuente. Si encuentras una discrepancia con el PDF oficial, es un error del sitio: está hecho para que se lea, no para que se le crea a ciegas.</p>
  </section>`
  return pagina({
    titulo: g.titulo,
    descripcion: g.resumen,
    contenido,
    rutaAssets: rutaAssets(1),
    seccion: "guias",
    canonical: SITIO_URL + `/guias/${g.slug}.html`,
    migas: [
      ["Inicio", "../index.html"],
      ["Guías", "./index.html"],
      [g.titulo, `./${g.slug}.html`],
    ],
    jsonLd: { "@context": "https://schema.org", "@type": "Article", headline: g.titulo, inLanguage: "es-DO" },
  })
}

/* -------------------------------------------- legales: Terminos y Privacidad
 * Páginas estáticas de cumplimiento. Análisis jurídico (2026-10-07):
 *  - RD Ley 172-13 (protección de datos): el sitio no recopila datos en
 *    servidor; el progreso vive en localStorage del navegador del usuario.
 *    La ley exige transparencia -> esta página + la de términos.
 *  - RD Ley 65-00 (derecho de autor): los PDF/pensums pertenecen a cada
 *    universidad; el sitio cita fuente con sha256 y no redistribuye el PDF.
 *  - GDPR (UE) y CCPA/CPRA (California): sin cookies ni recolección no se
 *    cruzan umbrales de obligación, pero el sitio es público global y
 *    GitHub Pages registra IPs como procesador (GitHub Privacy Statement).
 *  - ePrivacy: el sitio NO usa cookies (verificado con grep sobre el codigo:
 *    solo localStorage), asi que no hace falta banner de consentimiento.
 */
export function renderPrivacidad() {
  const contenido = `
  <h1>Política de privacidad</h1>
  <p class="meta-fuente">Última actualización: 7 de octubre de 2026. Lenguaje claro, sin jerga legal innecesaria.</p>

  <h2>Lo esencial en una frase</h2>
  <p>Ciberpensum <strong>no recopila tus datos personales en ningún servidor</strong>. Tu progreso
  (materias aprobadas, notas) vive en el almacenamiento local de tu propio navegador
  (<code>localStorage</code>) y solo lo usas tú: puedes exportarlo, importarlo o borrarlo cuando quieras.</p>

  <h2>Cookies</h2>
  <p>Este sitio <strong>no usa cookies</strong>, no instala rastreadores y no carga analítica de terceros.
  No hay banner de consentimiento porque no hay nada que consentir.</p>

  <h2>Datos que se guardan y dónde</h2>
  <ul>
    <li><strong>Progreso del usuario</strong> (materias aprobadas y notas): <code>localStorage</code>
    del navegador, clave por universidad y carrera. Nunca se envía a ningún servidor.</li>
    <li><strong>Nada más.</strong> No hay cuentas, formularios ni login.</li>
  </ul>
  <p>Puedes borrar estos datos en cualquier momento desde la sección
  <a href="../herramientas/portabilidad/index.html">Guardar y compartir</a> o, directamente, en el gestor
  de datos del navegador.</p>

  <h2>Datos que registra la infraestructura</h2>
  <p>El sitio se sirve desde GitHub Pages. GitHub, como proveedor de hosting, puede registrar información
  técnica de acceso (por ejemplo la dirección IP de quien visita) conforme a su
  <a href="https://docs.github.com/articles/github-privacy-statement">GitHub Privacy Statement</a>.
  Ciberpensum no recibe ni accede a esos registros.</p>

  <h2>Datos académicos</h2>
  <p>Las materias, créditos y reglas académicas mostradas provienen de documentos oficiales de cada
  universidad, citados con su URL y <code>sha256</code> (ver <a href="../carreras/index.html">carreras</a>).
  Todo dato no confirmado contra su fuente oficial aparece marcado como <strong>NO VERIFICADO</strong> en
  pantalla. La información pertenece a cada universidad; este sitio solo la cita y la organiza.</p>

  <h2>Tus derechos</h2>
  <p>Al no almacenar ni tratar datos personales en servidor, no hay base de datos que consultar, corregir
  o eliminar: tus datos están y se quedan en tu navegador. Si tienes dudas sobre esta política, escríbenos
  desde <a href="../guias/index.html">las guías</a> o el perfil del repositorio
  <a href="https://github.com/Coronel-Ing-Paul-Cruz/Ciberpensum">GitHub</a>.</p>`
  return pagina({
    titulo: "Política de privacidad",
    descripcion: "Ciberpensum no usa cookies ni recopila datos personales: tu progreso vive en el navegador.",
    contenido,
    rutaAssets: rutaAssets(0),
    migas: [
      ["Inicio", "../index.html"],
      ["Privacidad", "./index.html"],
    ],
    canonical: SITIO_URL + "/privacidad/",
    robots: "index, follow",
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Política de privacidad", inLanguage: "es-DO" },
  })
}

export function renderTerminos() {
  const contenido = `
  <h1>Términos y condiciones</h1>
  <p class="meta-fuente">Última actualización: 7 de octubre de 2026. Al usar el sitio aceptas estos términos.</p>

  <h2>1. Qué es Ciberpensum</h2>
  <p>Es un planificador académico <strong>estático</strong> para universidades dominicanas: sin cuentas,
  sin servidor propio, sin envío de datos. Su finalidad es informativa y de organización personal del
  estudio.</p>

  <h2>2. No somos la universidad</h2>
  <p>Este sitio <strong>no es un sitio oficial</strong> de ninguna universidad ni del Ministerio de Educación
  Superior (MESCYT). Los pensums y reglamentos pertenecen a cada institución y se citan de sus documentos
  públicos con URL y <code>sha256</code>. Ante cualquier discrepancia, <strong>manda el documento oficial</strong>.</p>

  <h2>3. Información académica</h2>
  <ul>
    <li>Las materias, créditos, prerrequisitos y escalas provienen de fuentes oficiales verificadas.</li>
    <li>Cuando un dato no está confirmado contra el PDF oficial, se muestra marcado como
    <strong>NO VERIFICADO</strong>: no se inventa ni se sugiere como cierto.</li>
    <li>El cálculo de índice, progresión o nota mínima es una <strong>ayuda de estimación</strong>, no una
    certificación académica. Las decisiones formales (inscripción, convalidación, honores) las toma cada
    universidad conforme a su reglamento vigente.</li>
  </ul>

  <h2>4. Uso permitido y propiedad</h2>
  <p>Puedes usar el sitio para planificar tu estudio y compartir tu propio progreso. El código de este
  proyecto es de código abierto (licencia MIT) y vive en
  <a href="https://github.com/Coronel-Ing-Paul-Cruz/Ciberpensum">GitHub</a>. Los documentos académicos
  citados (pensums, reglamentos, catálogos) son propiedad de cada universidad; aquí solo se citan con su
  fuente, no se redistribuyen como propios.</p>

  <h2>5. Ausencia de garantías</h2>
  <p>El sitio se ofrece «como está», sin garantía de exactitud, disponibilidad o idoneidad para un fin
  concreto. Aunque la curaduría es cuidadosa y trazable, los planes de estudio cambian: verifica siempre
  contra tu universidad.</p>

  <h2>6. Responsabilidad</h2>
  <p>En la medida permitida por la ley (RD Ley 172-13 y demás normas aplicables), el proyecto no responde
  por decisiones académicas tomadas con base en cálculos aquí mostrados, ni por daños derivados del uso
  de la información contenida. Los datos académicos se actualizan cuando se publican versiones nuevas de
  los documentos oficiales.</p>

  <h2>7. Ley aplicable</h2>
  <p>Estos términos se rigen por las leyes de la República Dominicana. Cualquier controversia se somete a
  los tribunales competentes de Santiago de los Caballeros, República Dominicana.</p>

  <h2>8. Contacto</h2>
  <p>Para preguntas sobre estos términos o la <a href="../privacidad/index.html">política de privacidad</a>,
  usa el perfil del repositorio en GitHub.</p>`
  return pagina({
    titulo: "Términos y condiciones",
    descripcion: "Términos de uso de Ciberpensum: sitio informativo sin cuentas, datos con fuente oficial y sin garantías académicas.",
    contenido,
    rutaAssets: rutaAssets(0),
    migas: [
      ["Inicio", "../index.html"],
      ["Términos", "./index.html"],
    ],
    canonical: SITIO_URL + "/terminos/",
    robots: "index, follow",
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Términos y condiciones", inLanguage: "es-DO" },
  })
}

/* ------------------------------------------------------------------ 404 */
export function render404() {
  const contenido = `
  <h1>Página no encontrada</h1>
  <p>Esta dirección no existe (o el enlace <code>#p=</code> apunta a una versión antigua).</p>
  <p><a class="boton" href="index.html">Volver al inicio</a></p>`
  return pagina({
    titulo: "Página no encontrada",
    descripcion: "Error 404: la página no existe.",
    contenido,
    rutaAssets: rutaAssets(0),
    robots: "noindex",
  })
}

/** Rutas reales del sitio (para sitemap). */
export function rutasDelSitio(carreras) {
  const out = ["/", "/universidades/", "/herramientas/", "/guias/", "/404.html", "/privacidad/", "/terminos/"]
  for (const c of carreras) {
    out.push(`/universidades/${c.universidad.id}/`)
    out.push(`/carreras/${c.universidad.id}/${c.slug}/`)
  }
  for (const h of HERRAMIENTAS) {
    // indice (selector de carrera) + una URL por carrera curada
    out.push(`/herramientas/${h.slug}/`)
    for (const c of carreras) out.push(`/herramientas/${rutaHerramientaCarrera(h, c).replace(/\/index\.html$/, "/")}`)
  }
  for (const g of GUIAS) out.push(`/guias/${g.slug}.html`)
  return out
}