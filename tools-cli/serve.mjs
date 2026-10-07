// tools-cli/serve.mjs — servidor estatico minimo para ver dist/ en local.
// Sin dependencias (node:http). `npm run start` para usarlo.
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { join, normalize, extname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "dist")
const PUERTO = Number(process.env.PORT ?? 4173)

const MIMES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
}

/** Ruta segura dentro de dist: rechaza traversal. */
function rutaSegura(p) {
  const normalizada = normalize(p).replace(/^(\.\.(\/|\\|$))+/, "")
  return join(ROOT, normalizada)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  let ruta = rutaSegura(url.pathname)

  try {
    const st = await stat(ruta)
    if (st.isDirectory()) ruta = join(ruta, "index.html")
  } catch {
    /* no existe: cae al 404 */
  }

  try {
    const datos = await readFile(ruta)
    res.writeHead(200, { "Content-Type": MIMES[extname(ruta)] ?? "application/octet-stream" })
    res.end(datos)
  } catch {
    // 404.html personalizado (Cloudflare Pages hace lo mismo).
    try {
      const noEncontrado = await readFile(join(ROOT, "404.html"))
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
      res.end(noEncontrado)
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("404")
    }
  }
})

server.listen(PUERTO, () => {
  console.log(`Ciberpensum servido en http://localhost:${PUERTO}/ (dist/)`)
})