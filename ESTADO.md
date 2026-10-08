# ESTADO.md — el cuaderno del workflow

Los subagentes de OpenCode arrancan en sesiones limpias: **no comparten memoria**.
Este fichero es el único estado que sobrevive entre invocaciones, junto al
`git log` (que es el historial) y `data/curated/` (que es la verdad de los datos).

Patrón adaptado de los ficheros `WORKFLOW_STATE.md` / `STATE.md` que usan los
setups multiagente de la comunidad. Tres reglas para que no se vuelva mentira:

1. **Append-only por sección.** Una decisión que cambia se anota debajo de la
   anterior, nunca se borra. Igual que los ADR.
2. **El gate lo obliga a estar al día.** `npm run verify` falla si falta
   cualquiera de las cuatro secciones de abajo, o si hay un JSON en
   `data/curated/` que no aparece en la tabla de carreras.
3. **Quién escribe.** Solo `curador-pensum` (tabla de carreras) y quien cierre
   una fase. En `.opencode/agents/*.md` todos tienen `edit: "*" → deny` y solo
   el curador tiene `ESTADO.md → allow`.

**NO** lleva un campo de "qué agente está activo": ese dato se desincroniza en
segundos y convierte el cuaderno en ruido. El historial es el `git log`.

---

## Fase actual

**Fase 0 — Cimientos** · completada 2026-10-06

| Entregable | Estado |
|---|---|
| repo git local | hecho (`git init -b main`, commits iniciales) |
| repo privado en GitHub | creado: `github.com/Coronel-Ing-Paul-Cruz/Ciberpensum` (privado) |
| estructura de carpetas | hecha |
| `AGENTS.md`, `opencode.jsonc`, 6 agentes, skills | hechos y validados |
| gate `npm run gate` (4 chequeos) | **en verde** |
| permisos sin prompts | lista de negativas + `--auto` (decisión del 2026-10-05) |
| los 6 módulos de `core/` | hecho (191 tests) |
| fuentes oficiales descargadas | 3 PDF en `data/raw/unicaribe/` con sha256 |
| design tokens (`ui/`) | hecho |

**Fase 1 — Malla, cuaderno y sitio publicado** · completada 2026-10-07

| Entregable | Estado |
|---|---|
| `data/curated/unicaribe/ciberseguridad.json` | curado (55 materias, 12 cuatrimestres, 191 créditos) |
| malla y cuaderno en el **orden del pensum** (no alfabético) | verificado contra el PDF (12/12 bloques) |
| bloqueo por prerrequisitos en el cuaderno (gris + deshabilitado) | verificado en navegador real |
| cuatrimestres separados visualmente (fila cabecera de bloque) | verificado |
| estadísticas siempre visibles (barra sticky) en malla y cuaderno | verificado |
| SSG + PWA + servidor local (`npm run build`/`start`) | hecho (33 archivos dist) |
| verificación en navegador (Playwright MCP) | configurado y pasado |
| gates finales `revisor-a11y` + `auditor-seo` | pendiente |
| publicación en Cloudflare Pages | pendiente |

## Carreras curadas

| Universidad | Carrera | Pensum | Curado | Gate |
|---|---|---|---|---|
| Universidad del Caribe | Ingeniería en Ciberseguridad | 2024-11 | 2026-10-06 | PASS |
| UTESA | Ingeniería en Sistemas Computacionales | 2023 | 2026-10-07 | PASS |
| UPID | Licenciatura en Contabilidad (`licenciatura-contabilidad`) | 2018 | 2026-10-07 | PASS |
| UPID | Maestría en Gestión de Recursos Humanos (`maestria-gestion-recursos-humanos`) | 2018 | 2026-10-07 | PASS |

Vacía = ninguna carrera publicada todavía. Si añades un JSON a
`data/curated/<uni>/<slug>.json`, esta tabla tiene que crecer o el gate falla.
El `sha256` del PDF vive en el propio JSON (`fuente.sha256`), no aquí: duplicarlo
sería una segunda fuente de verdad que se desincroniza.

## Decisiones

Se anotan aquí, con fecha. No se borran; se reemplazan por una entrada nueva.

- **2026-10-08** — UPID Licenciatura en Contabilidad: corregida la trazabilidad de `reglas.fuente` del Reglamento de Evaluación de los Aprendizajes (sha256 66215309…) al Reglamento Académico de UPID (sha256 58f12077…, https://upid.edu.do/wp-content/uploads/2023/01/6-REGLAMENTO-ACADEMICO.pdf, verificadoEn 2026-10-07). La escala numérica (A 95-100=4, B+ 90-94=3.5, B 85-89=3, C 70-84=2, D 60-69=1, F 0-59=0, aprobación 70%, índice ponderado por créditos base 4.0) corresponde a los Arts. 14-15 del Reglamento Académico. Para honores se cita Art. 21 (Cuadro de Honor) y Art. 22.H (reserva a títulos de Grado); se mantiene `honores: []` NO VERIFICADO. Causa: el PDF del Reglamento de Evaluación no contenía "95-100" (pdfplumber: 0 coincidencias en 15 páginas). (curador-pensum)

- **2026-10-05** — Stack: SSG propio en TypeScript con esbuild, sin framework.
  Motivo: salida 100 % estática y auditable, y el gate necesita control total del
  HTML generado. Si el sitio pasa de ~50 a cientos de páginas programáticas, se
  revisa Astro (content collections + validación integrada).
- **2026-10-05** — Las **horas semanales no están** en el PDF de grado de
  UNICARIBE. Solo en el de maestría. Consecuencia real: el planificador de
  horario no puede mostrar "3 h/semana" con fuente oficial, y el PDF de la p. 2
  trae boilerplate de otra carrera (Gestión Ambiental). No serellena nada: se
  pide a la Vicerrectoría Académica o se marca NO VERIFICADO en pantalla.
- **2026-10-05** — Hosting: Cloudflare Pages, porque acepta repo privado gratis.
  GitHub Pages en plan Free exige repo público, y este repo es privado.
- **2026-10-05** — 6 herramientas, no 9. Se caen plazos de retiro, auto-plagio
  local y comparador entre universidades: dependían de un calendario vivo, de un
  corpus de documentos o de un modelo normalizado entre universidades, y los tres
  son precisely lo que se pudre sin mantenimiento.
- **2026-10-05** — Primera carrera piloto: **Ingeniería en Ciberseguridad**
  (UNICARIBE).
- **2026-10-05** — `ESTADO.md` como cuaderno del workflow, con gate que lo obliga
  a estar al día. Sin el check en el gate, este patrón se llena de mentiras en dos
  semanas.
- **2026-10-05** — Progreso = `localStorage` + export/import + enlace `#p=`.
  Se cae `IndexedDB`: con el auto-plagio eliminado no hay corpus que guardar.
- **2026-10-05** — Permisos: de lista de preguntas a **lista de negativas**. Antes
  `shell: ask` global + `git commit: ask` cortaban el trabajo 30-50 veces por
  tarde. Ahora `allow` por defecto y `deny` solo de lo irreversible, replicado en
  los 6 agentes. Motivo medido: el usuario aprobaba el 93 % de los prompts, o sea
  que preguntar era casi siempre ruido. Se mantiene `opencode --auto` como red.
  Los `deny` que no se tocan: `--force`, `reset --hard`, `clean -fdx`, `rebase`,
  `rm -rf`, `Remove-Item -Recurse`, `gh repo delete`, secretos, sudo, y la
  edición de `data/raw/` y `dist/`.
- **2026-10-05** — `npm run verify:config` nuevo en el gate. OpenCode **no
  valida** el schema y acepta claves desconocidas en silencio, así que un error
  de permisos no se ve hasta que un comando corre sin permiso. El fallo concreto
  que yaaisy occurrences: en `permissions` gana la última regla que coincide, y
  un `{ shell, "git *", allow }` colocado al final **reabre** los `deny` de arriba
  y deja pasar `git push --force`. Se probó inyectando ese fallo: el gate lo
  detecta (BLOCKED) y con la config buena da PASS. También detecta `ask` colados
  y agentes con `shell` bloqueado.
- **2026-10-05** — `core/` se typechequea **sin la lib DOM** (`core/tsconfig.json`
  propio). La pureza deja de depender de un grep y la hace cumplir `tsc`. El
  gate también revisa `core/` ignorando comentarios y cadenas, porque un
  comentario que *prohíbe* `localStorage` no es una violación (falso positivo
  detectado y corregido).
- **2026-10-05** — Fuentes oficiales de UNICARIBE verificadas y descargadas:
  pensum de Ingeniería en Ciberseguridad (sha256 `9cc25ed3…`, 7 págs, 55
  materias, 191 créditos), Catálogo Estudiantil (`1b62add9…`) y Reglamento
  Estudiantil (`25be4df4…`). Pendiente: faltan las **horas semanales**, que no
  están en el PDF de grado (solo en el de maestría).
- **2026-10-07** — La malla y el cuaderno de progreso muestran las materias en
  el **orden del pensum oficial** (cuatrimestre ascendente y, dentro de cada
  bloque, el orden visual del PDF), nunca alfabético. El JSON curado ya trae
  ese orden; la UI lo preserva con un sort estable por (cuatrimestre, índice).
  `verify:data` ahora exige cuatrimestres no decrecientes: la invariante de
  orden pasó a ser del gate, para que una curaduría futura no la rompa.
- **2026-10-07** — Bloqueo por prerrequisitos en el cuaderno: sin el
  prerrequisito aprobado (nota final ≥ mínimo) **no se puede marcar** una
  materia como aprobada, en curso, ni escribir su nota; la fila queda en gris
  con el motivo ("falta aprobar FGC-102") en el tooltip. Lo ya registrado se
  puede desmarcar (corregir), pero nunca se selecciona un estado nuevo. La
  regla vive en `core/progresion` (`materiasDisponibles` evaluada sin
  cuatrimestre): el bloqueo temporal es regla de planificación de inscripción
  (herramienta progresión), no del cuaderno.
- **2026-10-07** — Los prerrequisitos se muestran **solo con el código**, como
  la columna PRE-REQ del PDF. Primera versión mostraba "nombre (código)" y el
  usuario pidió revertir: el código es el identificador de la materia; el
  nombre no se repite.
- **2026-10-07** — Los cuatrimestres se separan visualmente con una fila
  cabecera de bloque (`Cuatrimestre N — X créditos`) en la malla y en el
  cuaderno, igual que el PDF agrupa por cuatrimestre. Y las estadísticas de
  ambas páginas van en una barra `sticky` que queda siempre visible al
  desplazar la tabla larga.
- **2026-10-07** — Verificación contra el PDF: 55/55 materias sin sobrantes ni
  faltantes, secuencia curada == orden visual del PDF, nombres de todas las
  materias coinciden con su línea (INC-333 sale partido en dos líneas del PDF
  y se reconstruyó: "TALLER SEGURIDAD DE INFRAESTRUCTURA FÍSICA, VIRTUAL Y EN
  LA NUBE"). Verificado además en navegador real con **Playwright MCP**
  (configurado en `opencode.jsonc`): orden, separadores, barra sticky,
  bloqueo/desbloqueo en vivo.
- **2026-10-07** — Diferencia conocida para fase siguiente: la herramienta
  progresión considera "aprobada" cualquier materia con registro en el cuaderno
  (presencia de la clave en `progreso.aprobadas`), mientras que el cuaderno y
  el bloqueo de prerrequisitos usan `nota ≥ mínimo`. Conviene revisar si
  `core/progresion` debe unificar criterio (una reprobada no destraba
  disponibles).
- **2026-10-07** — **Widget global de progreso** (pedido: guardar/importar en
  cualquier parte de la web, siempre visible): barra fija abajo en TODA página
  (`layout.mjs` la pinta; `tools/_comun/global.ts` la mejora). Estadísticas en
  vivo (aprobadas/créditos/índice/en curso), **Guardar** descarga el JSON
  canónico del progreso y **Importar** lo restaura validado por
  `core/portabilidad`. Los datos del widget viven en `dist/datos/index.json` +
  una copia por carrera, precacheados en el SW. Vive abajo a propósito: no
  choca con la barra sticky superior de las tablas.
- **2026-10-07** — **Cuaderno con PRE-REQ** (pedido: "los PRE-REQ después de lo
  cr, como la malla"): columna PRE-REQ tras Cr con solo códigos, y fin de la
  **malla estática duplicada** (pedido: "elimina la herramienta malla, me
  parece redundante"): la sección sin-JS del cuaderno quedó envuelta en
  `<noscript>` — sin JS el contenido esencial existe (regla 6); con JS no se
  duplican 55 filas.
- **2026-10-07** — Correcciones de accesibilidad (revisor-a11y): contraste de
  filas bloqueadas con token `--tinta-bloqueada` (~5.5:1, se eliminó la
  `opacity`), motivo del bloqueo en `aria-describedby` + span `sr-only` (no
  solo `title`), `aria-live` únicamente en el resumen (antes todo `#app`),
  jerarquía h1→h2→h3 en las 4 páginas de rejilla, `scroll-padding-top` para el
  foco bajo barras sticky.
- **2026-10-07** — **PWA roto y corregido** (dos bugs, detectados en navegador
  real, no en código): (1) `registrarServiceWorker` apuntaba a `../sw.js` que
  desde `/herramientas/*` resuelve a `/herramientas/sw.js` (404); ahora
  registra `/sw.js` (relativo al origen). (2) `build.mjs` usaba `replace` y el
  placeholder del comentario se comía la primera sustitución, dejando
  `const PRECACHE = __PRECACHE__` → el SW no evaluaba → registro muerto. Se
  pasó a `replaceAll` y el precache se deriva por filesystem (todos los assets
  + datos): cubre chunks de esbuild y futuras carreras sin tocar la plantilla.
  Corregida también la ruta con doble slash (`//assets`). Verificado: registro
  activo con scope `/` y precache de 16 rutas en el navegador.
- **2026-10-07** — Verificación Playwright del cierre: export descarga
  `ciberpensum-<uni>-<slug>-<fecha>.json` canónico; import de un archivo
  restaura el progreso y la barra global se actualiza sola; FGC-104 aparece
  bloqueada con `aria-describedby` y se desbloquea en vivo al aprobar FGC-102;
  la malla duplicada desaparece con JS (noscript). Gate 4/4 PASS.
- **2026-10-07** — **CLS de las herramientas corregido** (auditor-seo había
  medido Poor 0.47–0.34 en las 6): el panel `#app` nacía vacío y el módulo
  insertaba la tabla tras el primer pintado. Ahora el contenido estático vive
  DENTRO de `#app` (una sola copia; fin del `noscript` especial del cuaderno)
  y el módulo lo reemplaza en el mismo lugar (`vaciar` + `append`, mismo alto).
  Medido en navegador con PerformanceObserver: cuaderno **CLS 0.4726 → 0.001**.
  Sin JS la página sigue siendo el contenido estático completo (regla 6).
- **2026-10-07** — **SEO completo por página** (auditor-seo): `<link
  rel="canonical">` en las 18 páginas indexables (una forma canónica con
  trailing slash; el 404 sin canonical), Open Graph + Twitter Card en todas,
  `<meta name="theme-color">`, `<meta name="robots" content="noindex">` en el
  404, JSON-LD de carrera corregido (`competencyRequired` → `hasPart`:
  `Course` es `CreativeWork`; el validador daba 55 errores severos con el rango
  estrecho de competencyRequired), y precache del SW ampliado a 20 rutas
  (`/404.html` + portadas de sección para el fallback offline de navegación).
- **2026-10-07** — **Cierre a11y** (revisor-a11y, segunda ronda): nombres
  accesibles en los 3 textareas de portabilidad (`aria-label` por uso +
  `autocomplete="off"`), y como consecuencia de mover el contenido al `#app`:
  cada herramienta pinta su **h2 propio** (progreso "Malla para marcar", indice
  "Tu índice actual", nota-minima "Completa los números de tu índice";
  portabilidad/progresion/plan-carga ya tenían) — h1→h2→h3 en las 6 con JS y
  sin JS. Los helpers `avisoNoVerificado` y `metaFuente` pasan de `<aside>` a
  `<div>` (landmark complementary anidado en `main`).
- **2026-10-07** — **Mejoras de frontend/CSS con skills** (pedido del usuario:
  "investiga skills que mejoren el frontend y el CSS, impleméntalos"): se
  aplicaron `frontend-design` y `web-design-guidelines` (más los hallazgos de
  `revisor-a11y`/`auditor-seo`). Identidad visual elegida: **el sitio es un
  "expediente académico con sellos"** — anclada en el tema (documentos
  oficiales, verificación con sha256), no en el default de plantilla. En
  concreto: los badges pasan de píldoras a **sellos** (contorno doble,
  mayúsculas, y rotación leve en el NO VERIFICADO como sello estampado;
  elemento con personalidad única), el hero queda **plano sin gradiente**
  (cabecera de documento), hover de tarjetas quieto (sin translateY genérico),
  se eliminó el `<em>` de énfasis en el h1 del hero, texto corrido acotado a
  46rem (`main > p/ul/ol`) sin tocar tablas, `color-scheme: light` declarado,
  `touch-action: manipulation` + `-webkit-tap-highlight-color` en controles,
  y `env(safe-area-inset-bottom)` en la barra global y el padding del body.
- **2026-10-07** — **Arranque de la fase "toda la oferta curricular"** (pedido del
  usuario: habilitar UNICARIBE, OYM, UPID, UASD y UTESA). `investigador-datos`
  en paralelo (uno por universidad) aterrizó en `data/raw/`: **29 pensums de
  grado de UNICARIBE** y **22 de UTESA** (más los 3 PDFs previos de UNICARIBE);
  OYM, UPID y UASD siguen en curso. La curaduría es **secuencial** (regla 11):
  arrancó con **UTESA — Ingeniería en Sistemas Computacionales**
  (`data/raw/utesa/pensum-grado-ingenieria-sistemas-computacionales.pdf`); le
  siguen las demás carreras a medida que se valida cada JSON.
- **2026-10-07** — **Selector de carrera activa: decisión de diseño.** Las
  herramientas dejan de usar `carreras[0]` (build.mjs:157). Se adoptan páginas
  de herramienta **por carrera** en `//herramientas/<slug>/<uniId>-<carreraSlug>/`
  (un nivel más de profundidad) y `dist/herramientas/<slug>/` pasa a ser un
  **índice estático de carreras** (el selector). Encaja con la arquitectura sin
  JS/offline: el selector es navegación, no estado. Implementación con TDD
  (`constructor-herramienta` lanzado el 2026-10-07).
- **2026-10-07** — **Curaduría UTESA — Ing. en Sistemas Computacionales entra al
  gate.** La segunda carrera destapó un bug real: el cuaderno contaba como
  aprobada toda materia con `(nota ?? 0) >= escala.minimo`, y con la escala
  0–100 de UTESA (`minimo: 0`) todas sintieron aprobadas ("98 de 98"). Se usa
  `escala.aprobacion` en `core/indice.escalaCumple` y en el cuaderno/widget.
- **2026-10-07** — **Auditoría de configs entre proyectos (pregunta del
  usuario: "qué de los otros proyectos aprovechamos").** Hallazgo real en los
  logs: el runtime v2.0.16 descarta `subagent_depth` en raíz de `opencode.jsonc`
  ("omitted unsupported legacy setting" — 80+ warnings en
  `~/.local/share/opencode/log/opencode.log`); el sitio correcto es
  `experimental.subagent_depth` (como ya lo tiene html5web). Se corrigió la
  config, se migró el check de `verify:config` al mismo sitio, y de paso se
  eliminó `compaction.prune` (también legacy) y se prestó de html5web la
  holgura de contexto `compaction.keep.tokens: 24000` para que las sesiones
  largas no se comapcten de golpe. De los agentes de los otros proyectos (`qa`,
  `verificador`, `peer-reviewer`, `code-reviewer`, `test-generator`) **no se
  importa nada**: ya están cubiertos por `verificador` (gate), `auditor-seo`
  (hechos/SEO) y `revisor-a11y`, y AGENTS.md fija que "no se edita por quien
  escribe" con esos tres; duplicarlos añade ruido sin cubrir nada nuevo.
  **CLS 0.176** (era el único «gordo»): su contenido estático es corto y el
  reemplazo del `#app` desplazaba el panel de fuente, hermano *debajo*. Se
  aplicó la opción (a) del auditor: el **panel de fuente va ahora ANTES de
  `#app`** (lo que crece ya no empuja nada visible; además, la proveniencia
  primero encaja con la regla 4) y `metaFuente` pasa de `<h3>` a `<h2>` para
  mantener h1→h2→h3. Verificado con el mismo protocolo (SW+caches limpios,
  carga fría, PerformanceObserver): 3/3 corridas en **0.001**. INP real medido
  con clic de confianza: **32 ms** (first-input pointerdown). `og:description`
  y `og:type` presentes en las 18 páginas indexables (el 404 no lleva OG).
- **2026-10-07** — **Cumplimiento legal: páginas estáticas de Privacidad y
  Términos, sin banner de cookies.** Análisis contra las normas aplicables: RD
  Ley 172-13 (datos personales: el sitio NO recopila datos en servidor; el
  progreso vive en localStorage del navegador, nunca se sube), RD Ley 65-00
  (derecho de autor: los pensums pertenecen a cada universidad y se citan con
  URL + sha256, no se redistribuyen), GDPR (UE) y CCPA/CPRA (California): sin
  cookies ni recolección no se cruzan umbrales de obligación, pero el sitio es
  público global y GitHub Pages registra IPs como procesador (GitHub Privacy
  Statement). ePrivacy: el sitio NO usa cookies (verificado con grep: solo
  localStorage), así que NO se añade banner de consentimiento. Se crearon
  `/privacidad/` y `/terminos/` (estáticas, sin JS, en sitemap + footer +
  precache del SW).
- **2026-10-07** — **Repo público + GitHub Pages + open source.** El usuario
  eligió hacer público `Coronel-Ing-Paul-Cruz/Ciberpensum` (GitHub Pages gratis
  exige repo público; la API rechazó el repo privado con 422 real). Páginas
  habilitadas por API (`html_url` devuelto por GitHub:
  `https://coronel-ing-paul-cruz.github.io/Ciberpensum/`), build_type=workflow,
  workflow `.github/workflows/pages.yml` (node 20, `npm ci` + `npm run build`,
  artifact `dist/`). Se añadieron `LICENSE` (MIT) y `README.md` de portafolio,
  y 7 topics (education, static-site, typescript, pwa, accesibilidad,
  dominican-republic, portfolio).

- **2026-10-07** — **Guardar/Importar no funcionaban en producción: bug de rutas
  absolutas bajo subpath.** El widget global hacía `fetch("/datos/index.json")`
  y el SW `register("/sw.js")`, ambos absolutos al origen; el manifest llevaba
  `start_url/scope/icons` con "/" inicial. En local (raíz "/") funcionaban, pero
  en GitHub Pages (subpath `/Ciberpensum/`) daban 404 y el widget nunca pintaba
  los botones. Fix: todas las rutas se resuelven contra `import.meta.url` del
  bundle (siempre en `<base>/assets/js/`), el SW resuelve el precache contra
  `self.registration.scope`, y el manifest usa rutas relativas a su ubicación.
  `serve.mjs` ganó `--base` (emula subpath) y la verificación navegador ahora
  corre bajo `/Ciberpensum/`. Verificado con Playwright: Guardar descarga el
  JSON canónico, Importar restaura localStorage, SW activo, 0 errores de
  consola. Lección completa en APRENDIZAJES.md (2026-10-08).

- **2026-10-08** — **El ensamblador determinista queda validado con datos
  reales (UPID Contabilidad).** `tools-cli/ensamblar-curaduria.mjs` llevaba
  meses sin ejecutarse; la primera corrida real destapó 4 bugs propios (arg()
  `----x`, JSON de --escala comido por PS 5.1 → `--escala-file`, claves
  fantasma del nombre tragando códigos reales, fusión de fila partida
  corrompiendo la errata CON-392 y filas degeneradas pisando las completas).
  Tras corregirlos: 56 materias / 172 créditos, 0 DIVERGENCIAS y diff campo a
  campo contra el JSON curado = 0 diferencias. `data/interim/
  upid-contabilidad-adiciones.json` documenta las 6 materias ausentes del
  layer de texto (5 recuperadas por OCR + CON-392 INTERNA) y las
  sobreescrituras (nombres, prereqs OCR, errata ECN-399, rename CON-392F).
  Lección en APRENDIZAJES.md (2026-10-08). El draft es derivado (no se
  commitea); la verdad sigue en `data/curated/`.
- **2026-10-08** — **El widget global de progreso es por página, no "la primera
  carrera".** Al crecer la oferta (3 carreras), el widget cargaba siempre
  `indice[0]` (unicaribe): la página UPID mostraba "10 de 55" (totales de
  unicaribe) y Guardar/Importar operaban la clave equivocada. Fix: el build
  emite `data-pensum="uni/slug"` en la zona del widget (layout.mjs,
  renderCarrera, renderHerramienta) y `global.ts` carga `datos/<uni>/<slug>`.
  Páginas sin carrera (home, universidades, guías) quedan en estado estático.
  Verificado con Playwright en las 3 situaciones (UPID 0/56, unicaribe 0/55,
  home estática; 0 errores de consola). Lección en APRENDIZAJES.md.

- **2026-10-07** — **Curaduría UPID — Maestría en Gestión de Recursos Humanos
  entra al gate** (pedido en Próximos pasos #10). 24 materias / 57 créditos /
  6 periodos (`tipoPeriodo: "periodo"`), suma por periodo cuadra con los
  subtotales impresos y con TOTALES 57/420/870. El PDF **no imprime columna de
  clave** (formato NOMBRE | CR | HT | HP): códigos **sintéticos GRH-PNN**
  (prefijo GRH + dígito de periodo + orden, ej. GRH-101) documentados en
  `data/fixups/upid-maestria-gestion-recursos-humanos-adiciones.json`; sin
  columna PRE-REQ → prerrequisitos `[]` en las 24. **Escala**: el PDF no la
  declara y el Reglamento de Evaluación (sha256 `66215309…`) **no contiene** la
  escala numérica; los valores viven en el **Reglamento Académico** Art. 14/15
  (sha256 `58f12077…`), cuya URL oficial se verificó por hash idéntico
  (`/2023/01/6-REGLAMENTO-ACADEMICO.pdf` y `/2018/04/REGLAMENTO-ACADEMICO1.pdf`
  en `upid.edu.do/reglamentos/`); es institucional y su Art. 1 define el
  Post-Grado (Maestría) sin restringir el Art. 14 a un nivel. **Honores = []
  NO VERIFICADO**: Art. 21 define Cuadro de Honor pero Art. 22.H dice "Sólo en
  los títulos de Grado". El ensamblador marcó 2 filas fantasma (`HP-574`,
  `TIC-215`, cuatrimestre 0) que se descartaron contra el PDF (26/957 → 24/57).
  Hallazgo para corrección posterior en Próximos pasos #11.

- **2026-10-08** — **Ronda a11y previa a la publicación: ALTA y MEDIA del
  revisor-a11y cerradas en el generador, no en dist.** (a) ALTA
  `scrollable-region-focusable`: los contenedores `.tabla-contenedor` de la
  malla y de las tablas del índice llevan ahora `tabindex="0" role="region"`
  + `aria-label` (antes: 0 tabindex en todo dist/; el scroll por teclado
  funcionaba solo en Chromium); (b) `aria-prohibited-attr`: la cifra del
  índice ya no usa `aria-label` sobre `<p>`, sino `<span class="sr-only">
  Índice académico: </span>`; (c) avisos: cada nota de la fuente se renderiza
  con `<strong>NO VERIFICADO</strong>` visible (regla 8 + 1.4.1) vía el
  helper `avisoNoVerificado`; (d) `scroll-padding-top` 3.5rem → 6rem (barra
  sticky mide 82px a 375px > 56px previo; 2.4.11); (e) la malla (estática y
  cuaderno por JS) emite UN `<tbody>` por periodo y la fila separadora va como
  `<td colspan>` y no `<th scope="rowgroup">` — experimento en memoria con axe
  4.10.3: `colspan=1` y quitar `scope` no sacan el incomplete, solo `th→td`
  pasa la regla (`0 inc | 1 pass`); el periodo ya viaja en la primera celda
  de cada fila y en el agrupamiento de tbody (3 páginas medidas, 0
  violaciones); (f) typo `ref=` → `rel="noreferrer"`. El
  enlace a la URL de la fuente sigue mostrando la URL cruda como texto
  (decisión: la fuente visible es parte del ethos del sitio y 2.4.4 pasa con
  el párrafo previo); las 2 mejoras sin criterio incumplido (indicador de
  scroll, th sticky) van a Próximos pasos.

## Próximos pasos

1. Recoger el veredicto de la verificación final (`revisor-a11y` + `auditor-seo`
   relanzados sobre el dist actual; si salen hallazgos, resolverlos en un commit
   de cierre antes de publicar).
2. Publicar en Cloudflare Pages (decisión del 2026-10-05: hosting elegido).
   — **superado el 2026-10-07**: hosting final = GitHub Pages con deploy
   automático en push a main (`.github/workflows/pages.yml`; ver Decisiones).
   El push ya está desplegando; este paso queda como histórico, no pendiente.
3. **Habilitar toda la oferta curricular** (pedido del usuario): UNICARIBE,
   OYM, UPID, UASD y UTESA — `investigador-datos` en paralelo (confirmar
   identidad oficial vía MESCYT), curaduría secuencial con `curador-pensum`,
   selector de carrera activa en herramientas (hoy hardcodeado a `carreras[0]`).
4. Confirmar las **horas semanales** con la Vicerrectoría Académica o marcarlas
   NO VERIFICADO en la herramienta de horario (no están en el PDF de grado).
5. Revisar la diferencia conocida del 2026-10-07: unificar en
   `core/progresion` el criterio de "aprobada" (el cuaderno usa nota ≥ mínimo;
   la herramienta progresión usa presencia de la clave en `progreso.aprobadas`).
6. Segunda universidad para el comparador (exigía modelo normalizado entre
   universidades, que se descartó en v1; queda como evolución posterior).
   (Las mejoras de frontend/CSS con skills quedaron hechas el 2026-10-07;
   la re-auditoría de esa ronda se relanza arriba.)
7. **Cuaderno: clic en la materia alterna 3 estados** (pedido del usuario): clic
   en cualquier parte de la fila (solo si está habilitada — prerequisitos +
   no bloqueada) alterna sin estado → en curso → aprobada → sin estado; al
   aprobar sin nota registrada, `escala.aprobacion` por defecto; en curso quita
   la nota. TDD en `core/progresion` (función pura) + wiring accesible
   (tabindex + Enter/Espacio) en `tools/progreso/entrada.ts`.
   — **hecho el 2026-10-08**: `siguienteEstadoAlClic` en `core/progresion`
   (TDD, 8 tests nuevos, 201 totales); wiring con botón real en la celda del
   nombre (Enter/Espacio nativos, focus visible) + clic de ratón en toda la
   fila ignorando los controles; `.boton-fila` en `ui/componentes.css`.
   Verificado con Playwright en UPID: secuencia completa por clic de fila y por
   teclado, widget actualizado, 0 errores de consola.
8. Verificar guardado/importación en navegador real — **hecho el 2026-10-07**:
   destapó el bug de rutas absolutas bajo subpath (ver Decisiones); corregido y
   verificado con Playwright bajo `/Ciberpensum/` (export + import + SW + 0
   errores de consola).
9. **Mejorar frontend y CSS, con foco en dispositivos móviles** (pedido del
   usuario, 2026-10-08): investigar los skills/agentes disponibles
   (frontend-design, performance, core-web-vitals, web-design-guidelines,
   revisor-a11y) y aplicarlos al diseño responsive actual (p. ej. la tabla del
   cuaderno con 8 columnas y la barra sticky en pantallas angostas).
   — **hecho el 2026-10-08**: auditoría en viewport 375px (Playwright) y
   corrección en `ui/componentes.css` + `ui/tokens.css`:
   (a) el `sr-only` al final de una celda estiraba el documento (`scrollW`
   618→360) — anclado a `top/left: 0` + `clip-path`; (b) objetivos de toque:
   checkbox 13→24px, nav 22→29px, migas 22→34px, `.boton-fila` 21→34-55px
   (WCAG 2.5.8 AA; quedan 2 enlaces "inline" en oración, excepción válida);
   (c) la barra global mide ~97px en móvil (2 filas) y la reserva era 52px:
   `--alto-global: 6.5rem` en ≤560px → el pie ya no queda oculto. Gate 4/4.
10. **Agregar las maestrías de UPID con el mismo pipeline** (pedido del
    usuario, 2026-10-08): `investigador-datos` verifica los PDFs oficiales
    (Neuroeducación `/2023/09/Pensum-Maestria-en-Neuroeducacion-Hoja-1-1.pdf`,
    Gestión RRHH `/2018/04/Maestría-Gestión-de-RRHH-N-1.pdf`), luego
    `curador-pensum` secuencial: dos carreras nuevas, mismas reglas de
    trazabilidad (fuente + sha256 + verificadoEn).
    — **investigación 2026-10-08**: **GESTIÓN RRHH VERIFICADO** — PDF
    descargado a `data/raw/upid/pensum-maestria-gestion-de-recursos-humanos.pdf`,
    sha256 `c1609fbda0be9e9684362c02d04be7aab3f4f72e3b3265c6d0dabb5f6d04dd74`,
    URL `https://upid.edu.do/wp-content/uploads/2018/04/Maestri%CC%81a-Gestio%CC%81n-de-RRHH-N-1.pdf`
    (acentos NFD; la variante NFC da 404), 6 PERÍODOS (P1-P5 con 4/5 materias,
    P6 = TRABAJO FINAL), 24 asignaturas, TOTALES 57 créditos / 420 HT / 870 HP,
    "Duración: 2 años". Formato de fila sin prefijo de clave. Escala de notas
    AUSENTE en el PDF → NO VERIFICADO salvo que el reglamento institucional de
    UPID la cubra (lo decide el curador con la evidencia). **NEUROEDUCACIÓN
    UNVERIFIABLE**: el PDF del menú oficial responde 404, sin copia en Wayback
    ni en WP (media 5873 borrada) → queda bloqueada sin fuente (regla 4: datos
    con fuente o no son datos). `curador-pensum` curando Gestión RRHH.
    — **curaduría 2026-10-07**: Gestión RRHH **PASS** en `verify:data`
    (`data/curated/upid/maestria-gestion-recursos-humanos.json`, 24 materias /
    57 créditos).
11. **Corregir la trazabilidad de la escala en
    `data/curated/upid/licenciatura-contabilidad.json`** (hallazgo de la
    curaduría de la maestría de RRHH, 2026-10-07; no se corrigió ahí porque el
    encargo de ese curador era solo el JSON de la maestría): su
    `reglas.fuente` apunta a `reglamento-de-evaluacion-de-aprendizajes.pdf`
    (sha256 `66215309…`) pero ese texto **no contiene** la escala numérica
    (verificado con pdfplumber: "95-100" → 0 coincidencias en sus 15 páginas);
    los valores citados corresponden literalmente al Art. 14 del Reglamento
    Académico (sha256 `58f12077…`,
    `https://upid.edu.do/wp-content/uploads/2023/01/6-REGLAMENTO-ACADEMICO.pdf`).
    Revisar también su nota de honores: dice "sin artículo de escala de
    honores detectado", pero el Art. 21 del Reglamento Académico sí define el
    Cuadro de Honor (3.4-4.0); mantiene `honores: []` por el Art. 22.H
    ("Sólo en los títulos de Grado se asentarán…"), criterio que habría que
    confirmar para grado.
    - corregido 2026-10-08 (curador-pensum): reglas.fuente movida a Reglamento Académico (58f12077…, URL 2023/01/6-REGLAMENTO-ACADEMICO.pdf, verificadoEn 2026-10-07); notas actualizadas citando Arts. 14-15 (escala e índice ponderado) y Arts. 21/22.H (honores), manteniendo honores=[] NO VERIFICADO.

12. **Indicador visual de scroll horizontal en `.tabla-contenedor`** (mejora
    del revisor-a11y, 2026-10-08; sin criterio WCAG incumplido — 1.4.10 exime
    tablas de datos): sombra degradada en el borde derecho o un texto "Desliza
    para ver más columnas" cuando la tabla desborda.
13. **Cabeceras sticky de la malla al desplazar** (mejora del revisor-a11y,
    2026-10-08; sin criterio incumplido): `position: sticky; left: 0` en la
    primera columna o en `thead th` para no perder la referencia de columna
    con el scroll horizontal.