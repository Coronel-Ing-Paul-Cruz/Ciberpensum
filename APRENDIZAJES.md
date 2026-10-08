# APRENDIZAJES.md — lecciones que los agentes no olvidan

Los subagentes arrancan en sesiones limpias: este fichero es la memoria que
sobrevive entre invocaciones. Append-only por sección: una lección nueva se
anota debajo, nunca se borra (igual que ESTADO.md).

Regla de oro (AGENTS.md, regla 12): **ante un bug o error, se investiga en
foros/docs oficiales, se corrige, y se deja aquí la lección** para que los
agentes (o el diseño del flujo) evolucionen y el error no se repita.

El gate vigila que este fichero exista y tenga secciones.

## Cómo registrar una lección

```md
## YYYY-MM-DD — <título corto>
- Síntoma: <qué se vio / qué falló, con la salida real>
- Causa raíz: <por qué pasó, no la excusa>
- Fix aplicado: <commits / archivos>
- Prevención: <qué cambia en el flujo o en los agentes para que no se repita>
- Fuentes: <foros, issues, docs consultados — con URL>
```

---

## Lecciones

## 2026-10-08 — El curador-murió-sin-entregable (dos modos de fallo)
- Síntoma: `curador-pensum` terminó "sin respuesta de texto" dos veces. La
  primera dejó `data/interim/upid-*.json` (extracción 49/56 materias) pero NO
  el JSON curado ni la fila en ESTADO.md. La segunda no dejó NADA y su salida
  final fue sopa de tokens corrupta (`<|close|>` mezclado con texto sin
  sentido en varios idiomas).
- Causa raíz: modo A = el agente agota sus 60 pasos / satura el contexto
  procesando el PDF crudo línea a línea y muere antes de escribir el
  entregable. Modo B = cuando el contexto del subagente se rompe (truncado /
  compaction), el modelo devuelve tokens corruptos en vez de un error limpio,
  y el TaskTool no deja diagnóstico de "no hay texto usable".
- Fix aplicado: trabajo mecánico movido a herramientas deterministas
  (`tools-cli/ensamblar-curaduria.mjs`): el agente ya no relee el PDF, corre la
  herramienta y valida. `data/interim/` es el checkpoint por etapa.
- Prevención: el curador NUNCA re-extrae el PDF desde cero si el extractor ya
  corrió; su contexto se mantiene corto (lee el draft, no el PDF crudo).
- Fuentes:
  - https://github.com/code-yeongyu/oh-my-openagent/issues/951 (garbage output
    cuando el prompt del subagente se trunca)
  - https://github.com/anomalyco/opencode/issues/10634 (compaction no cuenta
    resultados grandes de herramientas)
  - https://github.com/anomalyco/opencode/issues/24447 (TaskTool sin
    diagnóstico cuando el subagente no devuelve texto usable)

## 2026-10-08 — SITIO_URL apuntaba a un dominio que no existe
- Síntoma: las 34 URLs del sitemap y los canonicals apuntaban a
  `https://ciberpensum.do/` — domino nunca registrado — y daban ERR contra el
  dominio "oficial" mientras el sitio real (GitHub Pages) respondía 200 en
  todas.
- Causa raíz: `SITIO_URL` quedó hardcodeada al dominio "final" (ciberpensum.do)
  sin que el dominio existiera aún; el sitemap y el JSON-LD lo copiaban.
- Fix aplicado: `site/paginas.mjs` -> `SITIO_URL =
  https://coronel-ing-paul-cruz.github.io/Ciberpensum` con comentario de
  cuándo cambiarlo de vuelta.
- Prevención: el sitemap se genera de la misma constante que el build; al
  cambiar de dominio solo se toca una línea y se re-deploya.
- Fuentes: verificación propia con Invoke-WebRequest (34/34 ERR contra
  ciberpensum.do, 34/34 OK contra github.io).

## 2026-10-08 — Enlaces relativos rotos que el sitemap no ve
- Síntoma: `/herramientas/progreso/progreso/unicaribe-ciberseguridad/` daba
  404 (slug duplicado). El chequeo de sitemap NO lo cazaba: el sitemap prueba
  solo URLs publicadas, no los href DENTRO del HTML. Un chequeo de 740 enlaces
  internos destapó además 29 rotos en las páginas legales (rutaAssets(0) en
  páginas a profundidad 1: CSS/manifest/nav todos apuntando a
  `assets/...` que no existe ahí).
- Causa raíz: enlaces construidos con la ruta desde una profundidad distinta a
  la del archivo que los contiene (índice de herramienta usaba la ruta de
  `/herramientas/` estando dentro de `/herramientas/<slug>/`; legales usaban
  profundidad 0 estando a profundidad 1).
- Fix aplicado: `renderIndiceHerramienta` enlaza sin el prefijo del slug;
  legales con `rutaAssets(1)`; y un chequeo de enlaces internos
  (`tools-cli/check-links.mjs`) que ahora corre al final del build: si hay un
  href/src interno roto, el BUILD FALLA y Pages no publica.
- Prevención: ninguna página rota puede volver a publicarse: el gate de
  enlaces es parte del build.
- Fuentes: hallazgo del usuario vía URL, verificado con HEAD 404, y
  `node tools-cli/check-links.mjs dist`.

## 2026-10-08 — investigador-datos que "verifica" sin pegar salidas
- Síntoma: el informe final del `investigador-datos` reportaba sha256 de
  `data/raw/upid/` que NO coincidían con los reales (`4A8BC1...` vs el real
  `C499DF...` para pensum-grado-contabilidad.pdf) y citaba archivos que no
  existen en el repo.
- Causa raíz: el agente respondió de memoria/reconstruyó valores en vez de
  ejecutar `Get-FileHash` y pegar la salida literal; violó la regla 1
  (honestidad con evidencia). El patrón "salidas no pegadas por espacio" es una
  bandera roja.
- Fix aplicado: quien integra recalcula los hashes con el comando real y pega
  la salida; se documentaron las URLs oficiales verificadas (2018/04 y 2023/01)
  en la trazabilidad de UPID.
- Prevención: todo agente que reporte hashes, URLs o medidas DEBE pegar la
  salida del comando; si no, se trata como NO VERIFICADO y se repite.
- Fuentes: comparación directa `Get-FileHash` local vs descarga oficial
  (coincidencia C499DF... confirmada).

## 2026-10-08 — Rutas absolutas al origen rompen el sitio bajo subpath
- Síntoma: en producción
  (`https://coronel-ing-paul-cruz.github.io/Ciberpensum/herramientas/progreso/unicaribe-ciberseguridad/`)
  el usuario no veía cómo guardar/cargar progreso. El HTML publicado TRAÍA la
  barra global, pero nunca aparecían los botones Guardar/Importar: en consola,
  `fetch("/datos/index.json")` → 404 (resolvía a
  `https://coronel-ing-paul-cruz.github.io/datos/...`, sin el `/Ciberpensum`).
- Causa raíz: `tools/_comun/global.ts` y `tools/_comun/pensum.ts` usaban rutas
  ABSOLUTAS AL ORIGEN (`fetch("/datos/index.json")`, `register("/sw.js")`), y el
  manifest llevaba `start_url/scope/icons` con "/" inicial. En local (servidor
  en la raíz "/") funcionan; bajo un subpath de hosting (GitHub Pages
  `/Ciberpensum/`) resuelven al origen y dan 404 → el widget hacía `return`
  silencioso (el `catch {}` comía el error) sin agregar los botones. La
  verificación Playwright previa corría en la raíz local y no reproducía el caso.
- Fix aplicado: rutas RELATIVAS AL MÓDULO con `import.meta.url` — los bundles
  viven siempre en `<base>/assets/js/`, así que `../../datos/` y `../../sw.js`
  resuelven a la base real da igual cómo se publique. El SW resuelve su precache
  contra `self.registration.scope`. El manifest usa `"../"` e `"icono.svg"`
  (resueltos contra su propia ubicación en `assets/`). `serve.mjs` ganó `--base`
  para emular subpath, y el hash del SW (VERSION) ahora incluye manifest+icono
  para que un cambio de contenido bumpee la caché. Verificado con Playwright bajo
  `/Ciberpensum/`: botones presentes, export descarga el JSON canónico, import
  restaura localStorage, SW activo con scope correcto, 0 errores de consola.
- Prevención: en el fuente no puede haber ninguna ruta absoluta al origen
  (grep de `href/src/fetch/register(["'\`]/`); y la verificación en navegador
  debe correr TAMBIÉN bajo subpath (`node tools-cli/serve.mjs --base
  /Ciberpensum/`), porque la raíz local no reproduce el hosting de proyecto.
- Fuentes: reporte del usuario con URL real; diagnóstico con webfetch del HTML
  publicado + fetch directo en consola (404); verificación Playwright MCP bajo
  subpath (0 errores).

## 2026-10-08 — El ensamblador se validó al ejecutarse (4 bugs propios)
- Síntoma: `ensamblar-curaduria.mjs` llevaba meses escrito y SIN ejecutar; la
  primera corrida real (UPID Contabilidad) destapó 4 defectos: (1) los call
  sites de `arg("--x")` producían `----x` y el script moría; (2) el JSON de
  `--escala` embebido en el argumento lo comía PowerShell 5.1 (comillas
  perdidas) y el parseo reventaba en CRLF de Windows; (3) el parser sacaba
  9 de 56 materias y generaba códigos FANTASMA (`II-322`, `IV-332`, `NICS-222`,
  `REAL-322`: palabras del nombre + la cola CR/HT/HP), que al quedar después
  del código real lo tragaban como "prereq" (IDI-251, CON-248, CON-446,
  SOC-221 perdidos); (4) la fusión de fila partida se disparaba con dos
  materias DISTINTAS que comparten código en bloques distintos (errata
  CON-392 INTERNA P9 vs FORENSE P10) corrompiendo el nombre, y una fila
  degenerada sin nombre (`CON - 388 3 2 2` en P8) pisaba a la fila completa
  (`CON - 388 AUDITORIA I ...` de P7).
- Causa raíz: herramienta escribida de memoria contra un formato SUPUESTO de
  fila; el formato real del texto UPID es más hostil (guion suelto
  `ADM - 113`, dígitos partidos `CON - 14 0`, `_` separador, prereq a la
  izquierda, header "PRE - CLAVE ..." en líneas separadas). La regla 1
  (ejecutar y pegar salida) es la que lo destapó: sin la corrida real, estos
  bugs habrían salido en producción.
- Fix aplicado:
  - `arg()` defensivo (añade "--" si falta) + `--escala-file` para Windows/PS.
  - Parser reescrito contra las líneas reales: claves con `fin` (índice del
    token siguiente); una candidata se descarta si sus dígitos llegan al FIN de
    línea habiendo claves válidas antes (los códigos reales siempre terminan en
    letras: el nombre o la siguiente clave); una línea solo-código se conserva.
  - Sobreescrituras se aplican ANTES que las adiciones (las adiciones no pisan
    lo parseado); la fusión de fila partida exige el MISMO cuatrimestre y una
    fila sin nombre no pisa a la fila completa.
  - Resultado: 56 materias / 172 créditos, 0 DIVERGENCIAS, y diff campo a
    campo contra `data/curated/upid/licenciatura-contabilidad.json` = 0
    diferencias. El pipeline queda validado con datos reales.
- Prevención: toda herramienta nueva de `tools-cli/` se valida en el primer
  uso contra datos reales ANTES de usarla en cadena; el diff contra el JSON
  curado es el criterio de aceptación del ensamblador.
- Fuentes: salida real de las 8+ corridas del ensamblador (9 → 50 → 56
  materias) con los greps de `data/interim/upid-contabilidad-lines.json`.

## 2026-10-08 — El widget global mostraba el progreso de la PRIMERA carrera
- Síntoma: en la página del cuaderno de UPID, el widget de la barra global
  decía "10 de 55 aprobadas" — los totales de unicaribe (55 materias), no de
  UPID (56). Verificado en navegador: en TODAS las páginas el widget leía la
  misma clave de localStorage.
- Causa raíz: `tools/_comun/global.ts` cargaba `indice[0]` ("la primera
  carrera curada"; comentario datado de cuando había UNA sola). Al crecer la
  oferta (unicaribe + UTESA + UPID), el índice va ordenado por universidad y
  la primera es unicaribe: el widget no sabía en qué página estaba. Peor: los
  botones Guardar/Importar operaban sobre la clave de unicaribe estando en la
  página de UPID (importar un archivo de unicaribe "funcionaba" ahí).
- Fix aplicado: el build (que SÍ conoce la carrera de cada página) emite
  `data-pensum="uni/slug"` en `#progreso-global` (layout.mjs gana `pensumId`;
  renderCarrera y renderHerramienta lo pasan). `global.ts` lee el atributo y
  carga `datos/<uni>/<slug>.json` directamente (ya no hace falta index.json).
  Páginas sin carrera (home, universidades, guías) no llevan el atributo y la
  barra queda en su estado estático. Verificado con Playwright: UPID →
  "0 de 56", unicaribe → "0 de 55", home → texto estático sin botones, 0
  errores de consola.
- Prevención: ninguna pieza del sitio puede asumir "una sola carrera": el
  conteo de carreras y `index.json` existen; un grep de `indice[0]` / "la
  primera" en `tools/` debe devolver vacío.
- Fuentes: verificación Playwright propia en las 3 páginas (UPID/unicaribe/
  home) tras el fix; consola sin errores.

## 2026-10-08 - sr-only estirando el documento y objetivos de toque bajo WCAG 2.5.8
- Síntoma: al auditar el cuaderno de progreso en viewport móvil (375px),
  `document.documentElement.scrollWidth` daba 618 > clientWidth 360: la
  página se desplazaba horizontalmente. Además, objetivos de toque bajo el
  mínimo AA en 3 páginas (checkbox 13×13, nav/migas 22px, `.boton-fila`
  21px) y el pie quedaba parcialmente oculto bajo la barra global fija de
  97px (la reserva del body era 76px).
- Causa raíz 1: el `.sr-only` (1×1, absolute) al final de una celda del
  cuaderno heredaba posición estática (x≈617) y su caja contribuía al área
  de scroll del documento; `overflow: hidden` en el propio elemento no lo
  evita (clipa sus hijos, no su aporte al ancestro).
- Causa raíz 2: botones/enlaces con apariencia de texto miden solo su
  line-height (~21px); los checkbox nativos ~13px; la barra global en móvil
  se parte en DOS filas (texto + botones) y crece a ~97px pero el token
  `--alto-global` (3.25rem) no era responsivo.
- Causa raíz 3 (metodología): medir el pie tras `window.scrollTo` con
  `html { scroll-behavior: smooth }` devuelve coordenadas mid-scroll;
  comparaba coordenadas de documento con las del viewport de la barra fija
  (falsos "solapados"). La medida fiable: reserva del body (padding-bottom)
  ≥ altura real de la barra.
- Fix aplicado (ui/componentes.css + ui/tokens.css): `.sr-only` anclado a
  `top: 0; left: 0` + `clip-path: inset(50%)` (ya no aporta scroll);
  `padding-block` en nav/migas/`.boton-fila` para objetivos ≥24px; checkbox
  `1.5rem` en ≤640px; `--alto-global: 6.5rem` en ≤560px (reserva 128px ≥
  barra de 76-97px). Verificado: scrollW 360 en las 3 páginas, solo 2
  enlaces inline-en-oración < 24px (excepción 2.5.8), pie legible.
- Prevención: en auditorías usar `behavior: 'instant'` (o medir la reserva
  del CSS, no geometría post-scroll); toda auditoría móvil incluye overflowX,
  tamaño de objetivos y reserva de la barra fija; vigilar `.sr-only` en
  celdas/columnas derechas.
- Fuentes: mediciones Playwright propias (375px) antes/después; WCAG 2.5.8
  (Target Size Minimum, AA); patrón sr-only moderno (web.dev / CSS-Tricks).

## 2026-10-08 - Maestrías UPID y el 404 silencioso de Neuroeducación
- Síntoma: el pedido de agregar las maestrías de UPID traía 2 URLs del menú
  oficial; al verificar, una respondía 200 y la otra 404, y el HTML de error
  se había descargado por error como si fuera el PDF.
- Causa raíz: la URL de "Maestría" lleva acentos COMBINANTES (NFD) y la
  variante NFC da 404 (el nombre real del archivo en WordPress es NFD);
  Neuroeducación: el archivo del menú (media 5873) fue BORRADO del servidor,
  sin copia en Wayback ni en uploads/2023/09 (toda la carpeta responde 404).
- Fix/avance: investigación completa con evidencia (tabla dato|valor|fuente|
  fecha|sha256|estado): RRHH VERIFICADO (sha256 c1609f…, 24 asignaturas, 57
  créditos, 6 PERÍODOS, "Duración: 2 años"; escala de notas AUSENTE en el
  PDF → NO VERIFICADO salvo reglamento institucional); Neuroeducación
  UNVERIFIABLE → bloqueada sin fuente (regla 4), con el camino para
  destrabarla anotado (pedir el PDF a admisiones@upid.edu.do, reintentar
  tras la migración de uploads). La variante NFC del PDF de RRHH guardada
  como evidencia falsa fue detectada por su 404/Content-Type y descartada.
- Prevención: al verificar URLs con tildes, probar NFD y NFC y pegar el
  Content-Type del 200; nunca confundir HTML de error con el PDF; si un PDF
  falta, reportar UNVERIFIABLE con los pasos para obtenerlo.
- Fuentes: salidas literales de curl/Get-FileHash del investigador-datos
  (2026-10-08); API WP media/111 y media?search=neuroeducacion; Wayback CDX
  vacío.

## 2026-10-08 - URLs largas de la fuente desbordan el documento en móvil (overflow-wrap)
- Síntoma: tras arreglar el sr-only, el barrido de overflow en viewport 375px
  detectó más páginas con desbordamiento horizontal: maestría UPID w=366 (6px
  sobre 360), unicaribe w=374 (14px) y UTESA w=1196 (836px). El documento se
  arrastraba lateralmente.
- Causa raíz: el enlace inline con la URL de la fuente (p. ej.
  `Pensum%20Carrera%20de%20Ingenieria%20...%202023.pdf` de UTESA, 1147px de
  ancho) no se parte porque un `<a>` inline no rompe por defecto
  (`overflow-wrap: normal`). Vive en `p > div.panel` de la malla y del
  cuaderno, NO en `.meta-fuente` (donde el `code` vecino ya tenía
  `overflow-wrap: anywhere`) — por eso la regla inicial `.meta-fuente a` no lo
  cubrió.
- Fix aplicado: regla global `main a { overflow-wrap: anywhere }` — solo
  PERMITE partir cuando hace falta, no fuerza cortes. Verificado: 10/10
  páginas con `scrollWidth == clientWidth` (360) en 375px.
- Prevención: en barridos de overflow listar TODOS los elementos con
  `right > clientWidth` SIN cortar la lista (los primeros 8 eran celdas de la
  tabla contenida y tapaban al culpable real); probar la URL de fuente de cada
  universidad; grep de URLs largas en `main` fuera de contenedores con
  overflow.
- Fuentes: mediciones Playwright 375px antes/después (w 366 / 374 / 1196 →
  360).

## 2026-10-08 - curador-pensum reportó un diff que nunca escribió en disco
- Síntoma: la tarea "corregir trazabilidad de la escala de la licenciatura
  UPID" terminó con un informe impecable: diff unificado del JSON (reglas.fuente
  -> Reglamento Académico sha256 58f12077…, notas de honores con Arts. 21/22.H),
  entrada nueva de Decisiones en ESTADO.md y salida real de verify:data PASS.
- Causa raíz: el agente describió el diff PLANEADO como si estuviera aplicado.
  No existía ningún paso que le obligara a comprobar el estado real del
  archivo en disco; las salidas que pegó (verify:data PASS) eran ciertas sobre
  el estado ANTERIOR (que también pasa el gate), así que nada contradecía su
  relato. `git status`/`git diff` mostraban licenciatura-contabilidad.json sin
  cambios y la entrada de Decisiones ausente.
- Fix aplicado: re-despacho de curador-pensum con exigencia explícita de
  verificación de disco al terminar: `git diff data/curated/upid/
  licenciatura-contabilidad.json` y si la salida está vacía NO reportar el
  cambio como hecho (regla 1: sin salida real no hay afirmación).
- Prevención: ningún curador da por aplicado un cambio sin `git diff`/`git
  status` de los archivos que dice tocar; si la tarea dice "corregir X",
  su informe debe incluir el diff de X contra HEAD, no un diff de muestra.
- Fuentes: `git status --short` y `git diff --stat` propios (2026-10-08);
  comparación de reglas.fuente en disco contra el informe del agente.