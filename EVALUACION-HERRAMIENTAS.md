# Evaluación de skills, agentes, MCP y herramientas — Ciberpensum

Fecha: **2026-10-10** · Autor: agente principal · Método: inventario local + contraste
contra upstream (GitHub API + `raw.githubusercontent` con `git blob` SHA1) +
búsqueda en `skills.sh`, GitHub (release notes / issues) y foros.

> Regla 1 (honestidad): todo lo afirmado aquí se midió y la salida está pegada o
> resumida; lo que no se pudo resolver se marca **UNVERIFIED**.

---

## 0. Resumen ejecutivo

| Área | Estado | Veredicto |
|---|---|---|
| **Skills (20)** | Al día | 19/20 `SKILL.md` idénticos al upstream actual; 1 script desactualizado; 1 mejora local (no drift). No hay upgrade urgente. |
| **Agentes (7)** | Funcionales | Sin `model` fijado (heredan el modelo de sesión = caro); el gate **obliga a que sean exactamente 7**. |
| **MCP (1)** | Correcto | Playwright MCP es el #1 recomendado y está en su última versión. Alternativas útiles pero prescindibles; el principio es *MCP mínimo*. |
| **Herramientas CLI (9)** | Sólidas | Sin dependencias, verifican lo propio. Faltan 3 comprobaciones que nadie más puede hacer por nosotros: HTML válido, enlaces externos y automatizar a11y/CWV. |

Nada del inventario actual es “malo” ni está roto. Las mejoras son de **cobertura**
(añadir, no reemplazar) y de **costo** (fijar modelos por agente).

---

## 1. Skills

### 1.1 Inventario y origen

Todas están instaladas con el CLI de `skills.sh` y registradas en
`skills-lock.json` (existe; 20 entradas). Fuente por skill:

| Skill | Origen (GitHub) |
|---|---|
| `accessibility`, `best-practices`, `core-web-vitals`, `performance`, `seo`, `web-quality-audit` | `addyosmani/web-quality-skills` (v2.0) |
| `codebase-design`, `domain-modeling` | `mattpocock/skills` |
| `contract-first` | `affaan-m/ecc` |
| `dispatching-parallel-agents`, `subagent-driven-development`, `test-driven-development`, `verification-before-completion` | `obra/superpowers` (v7.0.0, 2026-10-09) |
| `frontend-design`, `skill-creator` | `anthropics/skills` |
| `pdf-extraction`, `table-extractor` | `claude-office-skills/skills` |
| `playwright-best-practices` | `currents-dev/playwright-best-practices-skill` (v1.2) |
| `typescript-strict-mode` | `op0ai/claude-skills` |
| `web-design-guidelines` | `vercel-labs/agent-skills` |

### 1.2 ¿Están al día? (medido)

Comparé **cada archivo** local contra la rama por defecto actual de su repo de
origen usando `git blob` SHA1 (y normalizando CRLF como respaldo):

- **19 de 20 `SKILL.md` son byte-idénticos** al upstream actual. ✅
- Archivos empaquetados (`references/`, `scripts/`, `agents/`, …): todo idéntico
  **salvo** dos casos:
  - `table-extractor/SKILL.md`: la **única** diferencia es la línea 8
    (`description:`). Nosotros tenemos una descripción en español correcta;
    **el upstream tiene un placeholder roto (`">"`)**. → Es una **mejora local**,
    no un atraso. No tocar.
  - `subagent-driven-development/scripts/sdd-workspace`: el local es la versión
    **antigua**. Al upstream (v6.4.1+/v7.0.0) le sobra/agrega:
    `root=$(CDPATH='' cd -- "$(git rev-parse --show-toplevel)" && pwd -P)` y
    `[ -e "$base/.gitignore" ] || printf '*\n' > "$base/.gitignore"` (create-only).
    Es el arreglo de rutas en **Git Bash/Windows** de las notas v7 → **aplica a
    nuestra máquina**. Es el **único drift real** encontrado. (Podría ser que el
    instalador lo hubiera transformado; la dirección nueva/vieja se confirmó
    comparando líneas clave.)

### 1.3 Caution: `npx skills update`

El CLI (`npx skills --help`) tiene `update [skills...]` (alias `upgrade`),
`list`, `find`, `add` y `experimental_install` (restaura desde `skills-lock.json`).

**No conviene lanzar un `update` global**: reescribiría `table-extractor/SKILL.md`
con el placeholder roto del upstream (regresión). Si se quiere sincronizar, hacerlo
por skill y **excluir `table-extractor`**, o re-aplicar su descripción en español
después.

### 1.4 Huecos y alternativas mejores (skills.sh / upstream)

De los repos que ya usamos **nos faltan** skills útiles y baratas de añadir:

- **obra/superpowers** (tenemos 4 de 15): `brainstorming` (reconstruida en v7),
  `writing-plans`, `executing-plans`, `systematic-debugging` (encaja con nuestro
  agente `resolvedor-bugs`), `requesting-code-review`/`receiving-code-review`,
  `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`,
  `diagnosing-superpowers`.
- **mattpocock/skills** (tenemos 2 de 38): `tdd` (alternativa a la TDD de obra),
  `diagnosing-bugs`, `improve-codebase-architecture`, `code-review`, `research`,
  `write-a-skill`/`writing-great-skills`, `triage`.
- **vercel-labs/agent-skills**: `find-skills` (**descubre e instala skills desde
  dentro del agente** — meta, muy útil) y `agent-browser`.
- **anthropics/skills**: `webapp-testing` (Playwright), `mcp-builder`.

En el leaderboard de `skills.sh` (2026-10-10) destacan como *mejores alternativas*
para nuestras necesidades: `ui-ux-pro-max` (nextlevelbuilder) y la familia
`taste-skill` (leonxlnx) para **UI/UX**; `brainstorming` y `systematic-debugging`
(obra), ya citadas.

**No existe** (ni en `skills.sh` ni en los repos que rastreamos) una skill que
**audite la lógica de navegación de un sitio existente** — sigue habiendo que
crearla (arquitectura de información: nav global/local, migas, enlaces internos).

---

## 2. Agentes

7 subagentes en `.opencode/agents/`: `auditor-seo`, `constructor-herramienta`,
`curador-pensum`, `investigador-datos`, `resolvedor-bugs`, `revisor-a11y`,
`verificador`.

Hallazgos:

1. **Modelo**: ninguno fija `model` → **heredan el modelo de la sesión** (el más
   caro). OpenCode v2 **sí** soporta `model: proveedor/modelo#variante` en el
   frontmatter (docs V2). Fijar modelos baratos en los mecánicos
   (`verificador`, `curador-pensum`, `revisor-a11y`, `auditor-seo`) es la mejora
   de costo más clara.
2. **Conteo fijo**: `tools-cli/verify.mjs` (L72) y `tools-cli/verify-config.mjs`
   (L113) **fallan si no hay exactamente 7 agentes**. Añadir o quitar un agente
   exige actualizar ambos.
3. **Campos V2**: usar `model`, `steps`, `permissions`, `mode`, `hidden`, `color`.
   Prohibido el legado `temperature`, `tools`, `permission`, `maxSteps` (la doc V2
   lo dice explícitamente; nuestro `verify-config.mjs` vigila las clave V1).
4. **Higiene de prompts**: ya corregí en `revisor-a11y.md` texto corrupto
   (`div`Updated`, `un studento`, `en vez de__.__`) y le añadí la exigencia de
   emitir informe en texto.

---

## 3. MCP

Config actual (`opencode.jsonc`): **solo** `playwright`
(`npx -y @playwright/mcp@latest`; última versión publicada `0.0.83`).

Veredicto: **correcto y de mínimo privilegio**. Playwright MCP es el servidor #1
más usado (varios rankings 2026) y el único que este proyecto necesita (sitio
estático, sin backend, sin BD). No hay que *reemplazarlo*.

Alternativas/complementos a evaluar (verificadas en npm):

| MCP | Versión | ¿Para qué? | Veredicto para Ciberpensum |
|---|---|---|---|
| `chrome-devtools-mcp` | 1.10.1 | Trazas de rendimiento, red, CWV, a11y en profundidad | Complementa (no reemplaza) a Playwright; útil para `auditor-seo` |
| `@upstash/context7-mcp` | 4.3.0 | Docs actualizadas de librerías | **Valor bajo**: casi no dependemos de librerías de terceros |
| `@modelcontextprotocol/server-filesystem` | 2026.8.31 | Ficheros | **Redundante**: ya tenemos `read`/`edit`/`glob` |
| GitHub/Supabase/Linear/… | — | Varios | **Fuera de alcance** (sin backend, sin cuentas) |

Cautela: cada MCP suma tokens de contexto y superficie. Se añade **solo** si el
gate lo justifica con evidencia.

---

## 4. Herramientas (CLI propia)

`tools-cli/`: `verify.mjs`, `verify-data.mjs`, `verify-config.mjs`, `build.mjs`,
`check-links.mjs`, `check-pensum.mjs`, `ensamblar-curaduria.mjs`,
`extract-pensum.mjs`, `serve.mjs`.

Fortalezas (no cambiar): Node puro **sin dependencias**, opinado y rápido
(`npm run gate` encadena 4 chequeos). Es una ventaja real de este repo.

Huecos concretos y candidatos (todos publicados en npm, verificados):

| Necesidad | Hoy | Candidato | Nota |
|---|---|---|---|
| **HTML válido** (regla 6) | No se valida el HTML generado | `html-validate` 11.16.2 | El sitio afirma HTML válido pero el gate no lo comprueba |
| **Enlaces externos** | `check-links.mjs` sólo valida enlaces **internos** | `linkinator` 8.1.0 (o `lychee`, Rust) | Detectaría enlaces oficiales caídos |
| **A11y automatizada** | `revisor-a11y` manual vía MCP | `@axe-core/playwright` 4.13.0 · `pa11y` 10.0.0 | Convertir la revisión en gate reproducible |
| **CWV/Lighthouse** | manual | `@lhci/cli` 0.15.1 | Alimentaría `auditor-seo` con umbrales |

Contrapartida: añadir dependencias choca con el minimalismo actual. Se propone
evaluarlas **una a una** y sólo incorporar la que atrape un fallo real que hoy se
escape.

---

## 5. Plan priorizado (propuesta)

1. **(barato, alto valor)** Fijar `model` por agente en los 7 (modelos baratos para
   los mecánicos). No altera el conteo.
2. **(barato)** Instalar `find-skills` (vercel-labs) para descubrir/instalar skills
   desde el propio agente.
3. **(barato)** Sincronizar **sólo** `subagent-driven-development/scripts/sdd-workspace`
   con el upstream (arreglo Windows); o reinstalar esa skill y excluir
   `table-extractor`.
4. **(medio)** Añadir a la biblioteca `brainstorming`, `writing-plans`,
   `systematic-debugging` (obra) y `diagnosing-bugs` (mattpocock) según necesidad.
5. **(medio)** Crear la skill de **auditoría de navegación** que no existe
   upstream (pedido #17 del usuario).
6. **(con criterio)** Evaluar `html-validate` y `@axe-core/playwright` como pasos
   del gate.
7. **(opcional)** Probar `chrome-devtools-mcp` para las trazas de CWV de
   `auditor-seo`.

---

## 6. Fuentes

- `skills.sh` (directorio oficial; leaderboard y páginas de skill) — https://skills.sh
- `obra/superpowers` — RELEASE-NOTES.md (v7.0.0, 2026-10-09) — https://github.com/obra/superpowers
- `addyosmani/web-quality-skills` — https://github.com/addyosmani/web-quality-skills
- `mattpocock/skills`, `anthropics/skills`, `vercel-labs/agent-skills` — GitHub
- OpenCode V2 · Agents (campos de frontmatter, `model`, `steps`) — https://opencode.ai/v2/docs/agents/
- Rankings MCP 2026 (Playwright #1; Context7/GitHub/Playwright como primeros) —
  https://www.firecrawl.dev/blog/best-mcp-servers-for-developers ,
  https://nimbalyst.com/blog/best-claude-code-mcp-servers/
- `axe-core` / `@axe-core/playwright` — https://github.com/dequelabs/axe-core

Mediciones propias (2026-10-10): `npx skills list`, comparación `git blob` por
archivo contra `raw.githubusercontent.com/<repo>/HEAD/...` para las 20 skills.

---

## 7. Aplicado (2026-10-10)

Tras esta evaluación el usuario dijo «procede con el plan». Resultado, punto por
punto, con lo aplicado y lo que se decidió **no** aplicar.

### Aplicado

- **+5 skills instaladas** (lock pasa de 20 a 25):
  - `find-skills` — `vercel-labs/skills` (el repo del propio CLI). Descubrir e
    instalar skills desde el ecosistema. Nota: **no** está en
    `vercel-labs/agent-skills` (ahí no existe); se instaló desde `vercel-labs/skills`.
  - `brainstorming`, `writing-plans`, `systematic-debugging` — `obra/superpowers`.
  - `diagnosing-bugs` — `mattpocock/skills`.
- **`sdd-workspace` sincronizado** con upstream (`obra/superpowers` HEAD):
  recupera el arreglo de rutas para Windows/Git Bash y el `.gitignore`
  create-only. 9 inserciones, 4 borrados. Es el único drift real que había.
- **Skill propia `navegacion-sitio`** creada en
  `.agents/skills/navegacion-sitio/SKILL.md` (no existía upstream). Audita
  arquitectura de información y navegación: global/local/utility, migas, enlaces,
  URLs, foco y comportamiento sin JS, con salida por severidad y evidencia.
- **Hallazgo de navegación corregido**: `renderUniversidad` volcaba todas las
  carreras bajo un solo `<h2>`; ahora agrupa por el campo `grado` del JSON
  (Grado → Postgrado). Ver `AUDITORIA-NAVEGACION.md`. UNICARIBE pasó de una
  rejilla de 16 sin jerarquía a `Grado · 1` + `Postgrado · 15`.

### Evaluado y NO aplicado

- **Fijar `model` por agente: descartado.** El modelo de la sesión
  (`opencode/big-pickle`) ya es gratuito, así que el supuesto de coste de la
  propuesta 1 no se cumple. Además, fijarlo añadiría fragilidad (el agente deja
  de seguir el predeterminado) y no se puede verificar la calidad de ninguna
  alternativa. Instrucción explícita del usuario (2026-10-10): «que use el LLM
  predeterminado en el momento». Los 7 agentes siguen sin `model`.
- **`html-validate` en el gate: evaluado, no añadido.** Con
  `html-validate:recommended` da **418 avisos**, pero todos son preferencias de
  estilo configurables (DOCTYPE en mayúsculas, `prefer-native-element`,
  `long-title`, espacios finales), no HTML inválido. Con esas 4 reglas
  silenciadas: **0 problemas, exit 0** sobre los 155 HTML. Añadirlo introduciría
  una dependencia de `devDependencies` para no atrapar ningún fallo actual
  (criterio de la propuesta: solo entra lo que atrape un fallo real que hoy se
  escape). Queda como opción si se quiere blindar la regla 6 a futuro.
- **`chrome-devtools-mcp`: evaluado, no añadido.** Playwright ya cubre la
  verificación en navegador real; uno más solo si hiciera falta depurar red/CPU.

### Verificación

`npm run gate` → **4/4 PASS**, 202 tests. `npm run build` → 19 carreras,
5 herramientas, 6 guías, 150 URLs, 0 enlaces rotos.
