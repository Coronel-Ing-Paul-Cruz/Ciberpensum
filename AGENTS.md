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
5. **El gate corre antes de cada commit**: `npm run gate` encadena los cuatro
   chequeos: `verify` (estructura y reglas de código), `verify:data` (integridad
   de pensums), `verify:config` (orden y efecto de los permisos) y `test`. Los
   cuatro en verde. Un solo comando, para que "se me olvidó uno" no sea posible.
6. **HTML válido, accesible y funcional sin JS.** Los componentes del sitio deben
   ser útiles con el JavaScript bloqueado; JS solo mejora. Sin `target="_blank"`.
7. **Commits convencionales en español** (`feat:`, `fix:`, `test:`, `docs:`,
   `chore:`). `git push` normal está permitido; lo que reescribe historial
   (`--force`, `reset --hard`, `clean -fdx`, `rebase`) está denegado en
   `opencode.jsonc` y así se queda.
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
10. **No preguntes por lo reversible.** La config opera con lista de negativas:
    todo permitido salvo lo irreversible. Antes de parar a preguntar, hazlo: el
    gate, los tests y `git` son reversibles. Si falta un dato, va `NO VERIFICADO`
    en el informe y se sigue trabajando. La única pregunta que justifica parar es
    una decisión de producto, no un detalle de implementación.
11. **Un subagente por módulo, y en paralelo cuando no se pisen.** Cada módulo de
    `core/` es independiente: se lanzan varios `constructor-herramienta` a la vez
    y el gate los juzga a todos juntos. La excepción es `data/`, que es secuencial:
    un solo `curador-pensum` a la vez, porque dos curadores escribiendo el mismo
    JSON es como se pierde trazabilidad.

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

## Ritmo: por qué casi no se pide permiso

La config usa lista de negativas (`allow` por defecto + `deny` de lo
irreversible), no lista de preguntas. Los motivos, con la evidencia:

- El usuario aprobaba el **93%** de los prompts de permisos: casi todos eran
  ruido (cifra citada en `Kilo-Org/kilocode#9138`). Preguntar por algo que se
  va a aprobar solo cuesta tiempo.
- Una tarde de refactor con preguntas constantes daba 30-50 cortes; el análisis
  de Cursor 3.6 ("Why Did The Old Approval Model Break Flow So Badly") describe
  ese mismo patrón.
- La comunidad ya lo normalizó. En r/vibecoding el hilo se titula literalmente
  "every agent run with auto-approve on"; Warp tiene perfiles con "always
  allow" y un modo "Run until completion"; Cursor 3.6 añadió auto-review
  precisamente porque faltaba el punto medio entre preguntar y no preguntar.
- `opencode --auto` (o la paleta de comandos → *Enable auto-approve
  permissions*) auto-aprueba lo que no esté explícitamente denegado, y los
  `deny` siguen respetándose. Es la red para lo que la config no anticipó.

**Lo que se mantiene denegado** (y debe seguir así): reescritura de historial
(`--force`, `reset --hard`, `clean -fdx`, `rebase`), borrado masivo
(`rm -rf`, `Remove-Item -Recurse`), `gh repo delete`, secretos, sudo, y la
edición manual de `data/raw/` (la evidencia) o `dist/` (lo derivado).

`npm run verify:config` vigila esto automáticamente: detecta reglas en orden
invertido (donde un `allow` posterior reabre un `deny`), `effect: "ask"`
colados, y agentes con `shell` bloqueado.