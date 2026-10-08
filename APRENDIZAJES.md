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