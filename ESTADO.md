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
| repo git local | hecho (`git init -b main`) |
| repo privado en GitHub | **sin crear** (pendiente de `gh repo create`) |
| estructura de carpetas | hecha |
| `AGENTS.md`, `opencode.jsonc`, 6 agentes, 20 skills | hechos y validados |
| gate `verify` + `verify:data` | en verde |
| design tokens (`ui/`) | pendiente |
| dependencias (`typescript`, `vitest`, `esbuild`) | pendiente |

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

## Próximos pasos

1. `npm i -D typescript vitest esbuild` y primer commit.
2. Crear el repo privado `Ciberpensum` en GitHub.
3. `investigador-datos`: localizar y verificar el PDF oficial del pensum de
   Ingeniería en Ciberseguridad de UNICARIBE (URL + sha256 + fecha + página).
4. `curador-pensum`: PDF → `data/curated/unicaribe/ciberseguridad.json`, y esta
   tabla crece.