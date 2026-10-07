// verify-config.mjs — gate de la configuracion de agentes y permisos.
//
// Comprueba lo que un editor NO te avisa: OpenCode no valida el schema y acepta
// claves desconocidas en silencio, asi que un error de permisos pasa desapercibido
// hasta que un comando se ejecuta sin permiso o con el permiso que no debia.
//
// Los tres fallos que este archivo huntza:
//   1. Reglas de permisos en orden inverso. Gana la ULTIMA que coincide, asi que
//      un `allow` amplio despues de un `deny` reabre lo denegado. Ejemplo real:
//      { shell, "git *", allow } al final hacia pasar `git push --force`.
//   2. `effect: "ask"` hanging: es el bug de ritmo. Cada ask corta la sesion.
//   3. Un agente con `ask` en shell y `edit: deny` no puede hacer su trabajo.
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
let errores = 0
const ok = (m) => console.log("  ok  " + m)
const mal = (m) => { console.log(" FAIL " + m); errores++ }

console.log("== ciberpensum · verify:config ==")

// ---------------------------------------------------------------- opencode.jsonc
const ruta = join(ROOT, "opencode.jsonc")
if (!existsSync(ruta)) {
  mal("falta opencode.jsonc")
} else {
  const texto = readFileSync(ruta, "utf8")

  // Claves V1 que en V2 no existen y OpenCode aceptaria en silencio.
  for (const [k, por] of [
    ['"permission"', "usa `permissions` (array)"],
    ['"bash"', "accion `shell`, no `bash`"],
    ['"task"', "accion `subagent`, no `task`"],
    ['"maxSteps"', "clave `steps`"],
    ['"agent":', "clave `agents` (plural)"],
  ]) {
    texto.includes(k) ? mal(`opencode.jsonc: clave legacy ${k} (${por})`) : ok(`sin ${k}`)
  }

  // Parseo real del bloque permissions: se quitan comentarios y se parsea JSON.
  const sinComentarios = texto.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
  let cfg = null
  try {
    cfg = JSON.parse(sinComentarios)
    ok("opencode.jsonc parsea como JSON")
  } catch (e) {
    mal("opencode.jsonc no parsea: " + e.message)
  }

  if (cfg) {
    const reglas = cfg.permissions
    Array.isArray(reglas) ? ok(`permissions es un array (${reglas.length} reglas)`) : mal("permissions no es un array")
    if (Array.isArray(reglas)) {
      // Sin permitir `ask`: es exactamente lo que ralentiza el trabajo.
      const asks = reglas.filter((r) => r.effect === "ask")
      asks.length === 0
        ? ok("ninguna regla ask: no habra cortes por permisos")
        : mal(`${asks.length} reglas "ask"hrazen la sesion: ${asks.map((r) => r.action + " " + r.resource).join(", ")}`)

      // Cada regla con forma valida.
      for (const [i, r] of reglas.entries()) {
        if (!r.action || !r.resource || !["allow", "ask", "deny"].includes(r.effect))
          mal(`regla ${i} mal formada: ${JSON.stringify(r)}`)
      }

      // ORDEN: gana la ULTIMA regla que coincide. El fallo es un `allow` MAS
      // AMPLIO placed DESPUES de un `deny`: entonces el allow gana y el deny se
      // queda sin efecto. Un allow antes del deny es lo correcto.
      const shell = reglas.filter((r) => r.action === "shell")
      let inversiones = 0
      for (const [i, d] of shell.entries()) {
        if (d.effect !== "deny") continue
        for (const [j, a] of shell.entries()) {
          if (a.effect !== "allow" || j <= i) continue // anterior o misma: no hay problema
          if (a.resource === d.resource) continue
          const masAmplio = a.resource === "*" || d.resource.startsWith(a.resource.replace(/\*$/, ""))
          if (masAmplio) {
            mal(`orden invertido: "${a.resource}" (allow, pos ${j + 1}) reabre "${d.resource}" (deny, pos ${i + 1}); el deny debe ir despues`)
            inversiones++
          }
        }
      }
      if (!inversiones) ok(`orden de reglas shell correcto: ${shell.length} shell, ningun allow eclipsa a un deny`)

      // Los irreversibles tienen que estar denegados de verdad.
      for (const critico of ["git push --force*", "rm -rf *", "gh repo delete*", "git reset --hard*"]) {
        shell.some((r) => r.effect === "deny" && r.resource === critico)
          ? ok(`deny presente: ${critico}`)
          : mal(`FALTA el deny de "${critico}": es irreversible`)
      }

      // Invariantes del proyecto.
      for (const [acc, res] of [["edit", "data/raw/*"], ["edit", "dist/*"]]) {
        reglas.some((r) => r.action === acc && r.resource === res && r.effect === "deny")
          ? ok(`invariante: ${acc} ${res} deny`)
          : mal(`FALTA el deny de ${acc} ${res}`)
      }
    }

    // En v2 la clave va bajo experimental (la raiz es legacy: el runtime la
    // omite con "unsupported legacy setting" en opencode.log — medido 2026-10-07
    // en v2.0.16; html5web la tiene bien en experimental).
    typeof cfg.experimental?.subagent_depth === "number"
      ? ok(`experimental.subagent_depth = ${cfg.experimental.subagent_depth}`)
      : mal("experimental.subagent_depth falta o no es numero")
  }
}

// --------------------------------------------------------------------- agentes
const dirAgents = join(ROOT, ".opencode", "agents")
const mds = existsSync(dirAgents) ? readdirSync(dirAgents).filter((f) => f.endsWith(".md")) : []
mds.length === 6 ? ok(`6 agentes definidos`) : mal(`hay ${mds.length} agentes, deben ser 6`)

for (const f of mds) {
  const t = readFileSync(join(dirAgents, f), "utf8")
  const nombre = f.replace(/\.md$/, "")

  // Cada agente necesita el deny de skill "*" para no cargar contexto ajeno.
  new RegExp("action:\\s*skill\\s*\\n\\s*resource:\\s*\"\\*\"\\s*\\n\\s*effect:\\s*deny").test(t)
    ? ok(`${nombre}: skill * deny (contexto limpio)`)
    : mal(`${nombre}: falta skill * deny`)

  // Ni asks ni shell bloqueado: los dos matan el ritmo.
  new RegExp("effect:\\s*\"?ask\"?").test(t) ? mal(`${nombre}: tiene effect ask`) : ok(`${nombre}: sin effect ask`)

  new RegExp('action:\\s*shell\\s*\\n\\s*resource:\\s*"\\*"\\s*\\n\\s*effect:\\s*allow').test(t)
    ? ok(`${nombre}: shell * allow`)
    : mal(`${nombre}: shell * no es allow (o falta): sin eso el agente no puede trabajar`)

  // Orden shell: ningun allow posterior a un deny.
  const bloque = (t.match(/permissions:[\s\S]*?\n---/) || [""])[0]
  const lineas = bloque.split("\n").filter((l) => /action:\s*shell/.test(l) || /resource:/.test(l) || /effect:/.test(l))
  const reglas = []
  for (let i = 0; i < lineas.length; i += 3) {
    const b = lineas.slice(i, i + 3).join(" ")
    const a = b.match(/action:\s*shell/)
    const r = b.match(/resource:\s*"([^"]*)"/)
    const e = b.match(/effect:\s*"?(\w+)"?/)
    if (a && r && e) reglas.push({ resource: r[1], effect: e[1] })
  }
  const allowDespues = []
  for (const d of reglas.filter((x) => x.effect === "deny")) {
    const idx = reglas.indexOf(d)
    for (const a of reglas.filter((x) => x.effect === "allow")) {
      // Solo cuenta si el allow posterior es MAS AMPLIO que el deny anterior.
      // Un allow de igual o menor alcance no reabre nada.
      if (a.resource === d.resource) continue
      const masAmplio = a.resource === "*" || d.resource.startsWith(a.resource.replace(/\*$/, ""))
      if (masAmplio && reglas.indexOf(a) > idx) allowDespues.push(`"${a.resource}" reabre "${d.resource}"`)
    }
  }
  allowDespues.length === 0
    ? ok(`${nombre}: orden shell correcto`)
    : mal(`${nombre}: orden shell invertido -> ${allowDespues.join("; ")}`)
}

console.log(errores ? `\n== BLOCKED (${errores}) ==` : "\n== PASS ==")
process.exit(errores ? 1 : 0)