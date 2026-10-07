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

Vacía = ninguna carrera publicada todavía. Si añades un JSON a
`data/curated/<uni>/<slug>.json`, esta tabla tiene que crecer o el gate falla.
El `sha256` del PDF vive en el propio JSON (`fuente.sha256`), no aquí: duplicarlo
sería una segunda fuente de verdad que se desincroniza.

## Decisiones

Se anotan aquí, con fecha. No se borran; se reemplazan por una entrada nueva.

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

## Próximos pasos

1. Re-auditoría final en curso (`revisor-a11y` + `auditor-seo` sobre el dist
   actual, lanzadas por quien cierra esta fase en background).
2. Publicar en Cloudflare Pages (decisión del 2026-10-05: hosting elegido).
3. **Mejoras de frontend y CSS con skills** (pedido del usuario): investigar e
   implementar `frontend-design` y `web-design-guidelines` (y lo que aporten
   `accessibility`/`best-practices`) sobre el dist actual.
4. **Habilitar toda la oferta curricular** (pedido del usuario): UNICARIBE,
   OYM, UPID, UASD y UTESA — `investigador-datos` en paralelo (confirmar
   identidad oficial vía MESCYT), curaduría secuencial con `curador-pensum`,
   selector de carrera activa en herramientas (hoy hardcodeado a `carreras[0]`).
5. Confirmar las **horas semanales** con la Vicerrectoría Académica o marcarlas
   NO VERIFICADO en la herramienta de horario (no están en el PDF de grado).
6. Revisar la diferencia conocida del 2026-10-07: unificar en
   `core/progresion` el criterio de "aprobada" (el cuaderno usa nota ≥ mínimo;
   la herramienta progresión usa presencia de la clave en `progreso.aprobadas`).
7. Segunda universidad para el comparador (exigía modelo normalizado entre
   universidades, que se descartó en v1; queda como evolución posterior).