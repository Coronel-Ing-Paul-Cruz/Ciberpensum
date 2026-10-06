# AGENTS.md — Ciberpensum

Sitio estático de planificación académica para universidades dominicanas.
Sin cuentas, sin backend, sin scraping. Lee esto antes de tocar nada.

## Reglas duras

1. **Honestidad por encima de todo.** Nunca afirmes que algo pasa, existe o funciona
   sin haber ejecutado el comando y pegado la salida real. Si no lo ejecutaste,
   escribe `NO VERIFICADO`. Si no se puede verificar, `UNVERIFIABLE`.
2. **Si necesita servidor, no entra en v1.** Nada de cuentas, login, base de datos,
   APIs propias ni funciones del lado del servidor. Progreso = localStorage +
   export/import + enlace en el fragmento `#` de la URL.
3. **`core/` es puro.** TypeScript sin DOM (`window`, `document`, `localStorage`,
   `fetch` están prohibidos ahí). La UI vive en `tools/<herramienta>/`.
4. **Los datos llevan fuente o no son datos.** Todo número de
   `data/curated/` sale de un PDF oficial en `data/raw/` y trae
   `fuente.url`, `sha256` y `verificadoEn`. mipensum y otros sitios son pistas,
   nunca fuente: sin PDF oficial contraste, el dato queda `NO VERIFICADO`.
5. **El gate corre antes de cada commit**: `npm run verify` (estructura y reglas de
   código) y `npm run verify:data` (integridad de pensums). Ambos en verde.
6. **HTML válido, accesible y funcional sin JS.** Los componentes del sitio deben
   ser útiles con el JavaScript bloqueado; JS solo mejora. Sin `target="_blank"`.
7. **Commits convencionales en español** (`feat:`, `fix:`, `test:`, `docs:`,
   `chore:`). No hay push automático: `git push` está denegado en `opencode.jsonc`.
8. **NO VERIFICADO aparece en pantalla.** Si una regla académica (ej. escala de
   honores) no está confirmada contra el reglamento oficial, la página la muestra
   marcada, no la finge.
9. **`ESTADO.md` es el cuaderno del workflow, y el gate lo vigila.** Los
   subagentes no comparten memoria, así que el estado de la fase y la lista de
   carreras curadas viven ahí. Se escribe **append-only** (una decisión que cambia
   se anota debajo, no se borra) y `npm run verify` falla si le falta una sección
   o si hay un JSON en `data/curated/` sin su fila en la tabla. No se anota en él
   qué agente está activo: eso se desincroniza; el historial es el `git log`.
   Solo `curador-pensum` lo edita entre los subagentes.

## Estructura

```
core/      TypeScript puro, sin DOM. Un módulo por herramienta.
tools/     La UI de cada herramienta. Solo importa su módulo de core/.
ui/        Tokens y componentes compartidos que funcionan sin JS.
site/      Páginas prerenderizadas (home, universidades, carreras, guías).
pwa/       Manifest y service worker (offline por estrategia de recurso).
data/      raw/ (PDF evidencia) · interim/ · fixups/ · curated/ (verdad).
tools-cli/ verify.mjs · verify-data.mjs · build.mjs · extract-pensum.mjs
dist/      Salida estática (generada; no se edita, no se commitea).
```

## Subagentes (definidos en .opencode/agents/)

| Agente | Hace | No hace |
|---|---|---|
| `investigador-datos` | localiza y verifica PDFs oficiales con sha256 | escribir datos |
| `curador-pensum` | convierte PDF → `data/curated/*.json` validado | tocar código |
| `constructor-herramienta` | implementa un módulo (TDD) | revisar ni tocar `data/` |
| `verificador` | ejecuta el gate y responde PASS / BLOCKED | arreglar |
| `revisor-a11y` | revisión WCAG 2.2 | editar |
| `auditor-seo` | SEO, Core Web Vitals, JSON-LD | editar |

Cada módulo nuevo lo construye `constructor-herramienta` con un test primero,
y lo valida `verificador` después. Sin excepciones.