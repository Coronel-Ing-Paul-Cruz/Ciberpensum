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

**Fase 0 — Cimientos** · en curso

| Entregable | Estado |
|---|---|
| repo git local | hecho (`git init -b main`, 2 commits) |
| repo privado en GitHub | creado: `github.com/Coronel-Ing-Paul-Cruz/Ciberpensum` (privado) |
| estructura de carpetas | hecha |
| `AGENTS.md`, `opencode.jsonc`, 6 agentes, 20 skills | hechos y validados |
| gate `npm run gate` (4 chequeos) | **en verde** |
| permisos sin prompts | lista de negativas + `--auto` (decisión del 2026-10-05) |
| `core/indice` (primer módulo, TDD) | 5 tests en verde |
| fuentes oficiales descargadas | 3 PDF en `data/raw/unicaribe/` con sha256 |
| design tokens (`ui/`) | pendiente |
| los otros 5 módulos de `core/` | pendiente |

## Carreras curadas

| Universidad | Carrera | Pensum | Curado | Gate |
|---|---|---|---|---|
| — | — | — | — | — |

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

## Próximos pasos

1. `curador-pensum`: PDF → `data/curated/unicaribe/ciberseguridad.json`
   (55 materias, 191 créditos, `INC-333` sale partido en tres líneas en el PDF)
   y esta tabla crece.
2. `constructor-herramienta` en paralelo sobre los módulos independientes:
   `core/progresion` (DAG + motivo de bloqueo) y `core/nota-minima`
   (nota mínima en examen final, ponderados hacia atrás).
3. `core/datos`: carga y valida el JSON contra `data/schema/pensum.schema.json`.
4. `constructor-herramienta`: `core/indice` ampliado con honores (Art. 89:
   85-89 cum laude, 90-94 magna, 95-100 summa, base 100, sin reprobaciones).
5. `ui/` tokens y primer `tools/` para poder abrir el sitio en el navegador.