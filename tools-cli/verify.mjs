// verify.mjs — gate de estructura y reglas de código.
// Lenguaje: Node ESM puro, sin dependencias. Si falla, explica qué y dónde.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, extname } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
let errores = 0
const ok = (m) => console.log("  ok  " + m)
const mal = (m) => { console.log(" FAIL " + m); errores++ }

console.log("== ciberpensum · verify ==")

// 1. Estructura obligatoria
for (const d of ["core", "tools", "ui", "site", "pwa", "tools-cli", "data/raw", "data/fixups", "data/curated", ".opencode/agents", ".agents/skills"]) {
  existsSync(join(ROOT, d)) ? ok(`existe ${d}/`) : mal(`falta el directorio ${d}/`)
}

// 2. package.json sano y con los scripts del gate
try {
  const p = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
  for (const s of ["test", "verify", "verify:data", "build"])
    p.scripts?.[s] ? ok(`script "${s}"`) : mal(`package.json: falta el script "${s}"`)
  p.type === "module" ? ok("package.json es ESM") : mal('package.json: "type" debe ser "module"')
} catch (e) { mal("package.json no parsea: " + e.message) }

// 3. core/ sin DOM ni red (regla dura 3)
const camina = (dir) => {
  const out = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...camina(p))
    else out.push(p)
  }
  return out
}
// Regla 3: core/ es puro. OJO con los falsos positivos: un comentario que
// PROHIBE esas APIs es justamente lo que quiero, no una violacion. Solo se
// mira el codigo, con comentarios y cadenas de texto fuera.
const PROHIBIDOS = [
  { rx: /\bwindow\s*\./, que: "window." },
  { rx: /\bdocument\s*\./, que: "document." },
  { rx: /\blocalStorage\b/, que: "localStorage" },
  { rx: /\bfetch\s*\(/, que: "fetch(" },
  { rx: /\bsessionStorage\b/, que: "sessionStorage" },
  { rx: /\bnavigator\s*\./, que: "navigator." },
]
const sinComentariosNiCadenas = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // comentarios de bloque
    .replace(/^\s*\/\/.*$/gm, " ") // comentarios de linea
    .replace(/`(?:\\.|[^`\\])*`/g, '""') // plantillas
    .replace(/"(?:\\.|[^"\\])*"/g, '""') // cadenas dobles
    .replace(/'(?:\\.|[^'\\])*'/g, '""') // cadenas simples

const coreDir = join(ROOT, "core")
let coreFiles = 0
try {
  coreFiles = camina(coreDir).filter((f) => f.endsWith(".ts"))
  for (const f of coreFiles) {
    const codigo = sinComentariosNiCadenas(readFileSync(f, "utf8"))
    for (const { rx, que } of PROHIBIDOS)
      if (rx.test(codigo)) mal(`core puro violado: ${f.replace(ROOT, "")} usa ${que} en codigo (no en un comentario)`)
  }
  ok(`core/ revisado (${coreFiles.length} archivos .ts, sin DOM ni fetch ni almacenamiento)`)
} catch { ok("core/ aun sin .ts (fase 0)") }

// 4. Agentes: 6 y con description + mode
const agentsDir = join(ROOT, ".opencode", "agents")
try {
  const mds = readdirSync(agentsDir).filter((f) => f.endsWith(".md"))
  mds.length === 6 ? ok(`agentes: 6`) : mal(`agentes: hay ${mds.length}, deben ser 6`)
  for (const f of mds) {
    const t = readFileSync(join(agentsDir, f), "utf8")
    new RegExp("description:\\s*\\S").test(t) && new RegExp("mode:\\s*(subagent|primary|all)").test(t)
      ? ok(`agente ${f}: frontmatter mínimo`)
      : mal(`agente ${f}: falta description o mode`)
  }
} catch { mal(".opencode/agents ilegible") }

// 5. opencode.jsonc sin claves legacy prohibidas (regla V2)
try {
  const t = readFileSync(join(ROOT, "opencode.jsonc"), "utf8")
  for (const k of ['"permission"', '"bash"', '"task"', '"agent":', '"maxSteps"'])
    t.includes(k) ? mal(`opencode.jsonc contiene clave legacy ${k}`) : null
  t.includes('"permissions"') ? ok("opencode.jsonc usa permissions[]") : mal("opencode.jsonc sin permissions[]")
} catch { mal("opencode.jsonc ilegible") }

// 6. Sin target="_blank" en fuentes estáticas
for (const dir of ["site", "ui"]) {
  const d = join(ROOT, dir)
  if (!existsSync(d)) continue
  for (const f of camina(d)) {
    const src = readFileSync(f, "utf8")
    if (/target=["']_blank["']/.test(src)) mal(`${f.replace(ROOT, "")}: target="_blank" prohibido`)
  }
  ok(`${dir}/ sin target="_blank"`)
}

// 7. ESTADO.md: el cuaderno del workflow existe, tiene las 4 secciones y
//    cada carrera curada tiene su fila (si no, el cuaderno miente).
try {
  const estado = readFileSync(join(ROOT, "ESTADO.md"), "utf8")
  for (const s of ["## Fase actual", "## Carreras curadas", "## Decisiones", "## Próximos pasos"])
    estado.includes(s) ? ok(`ESTADO.md tiene "${s}"`) : mal(`ESTADO.md: falta la sección "${s}"`)

  const dirCur = join(ROOT, "data", "curated")
  let curadas = 0
  if (existsSync(dirCur)) {
    for (const uni of readdirSync(dirCur)) {
      const d = join(dirCur, uni)
      if (!statSync(d).isDirectory()) continue
      for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) {
        curadas++
        const slug = f.replace(/\.json$/, "")
        estado.includes(slug)
          ? ok(`ESTADO.md registra ${uni}/${slug}`)
          : mal(`ESTADO.md no registra ${uni}/${slug}: el cuaderno esta desactualizado`)
      }
    }
  }
  ok(`ESTADO.md al dia (${curadas} carreras curadas)`)
} catch { mal("ESTADO.md no existe o es ilegible") }

// 8. typecheck real. core/ se comprueba SIN DOM y el resto CON DOM, asi que la
//    regla 3 de AGENTS.md la aplica el compilador y no solo el grep del punto 3.
//    Si no hay archivos, tsc sale con TS18003 y no seria un fallo real: se omite.
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc")
const hayTs = (...dirs) =>
  dirs.some((d) => existsSync(join(ROOT, d)) && camina(join(ROOT, d)).some((f) => extname(f) === ".ts"))
const correrTsc = (cfg, etiqueta) => {
  try {
    execFileSync(process.execPath, [TSC, "-p", cfg], { cwd: ROOT, stdio: "pipe" })
    ok(`typecheck ${etiqueta}`)
  } catch (e) {
    const salida = String(e.stdout ?? e.message ?? "").split("\n").slice(0, 10).join("\n")
    mal(`typecheck ${etiqueta} falla:\n${salida}`)
  }
}
if (existsSync(TSC)) {
  hayTs("core")
    ? correrTsc("core/tsconfig.json", "core/ (sin DOM)")
    : ok("core/ aun sin .ts: typecheck omitido")
  hayTs("tools", "ui", "site", "pwa")
    ? correrTsc("tsconfig.json", "tools+ui+site+pwa (con DOM)")
    : ok("UI aun sin .ts: typecheck omitido")
} else {
  ok("typescript no instalado: typecheck omitido (npm i)")
}

console.log(errores ? `\n== BLOCKED (${errores}) ==` : "\n== PASS ==")
process.exit(errores ? 1 : 0)
