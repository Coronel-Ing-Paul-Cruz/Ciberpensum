# DEPLOY.md — Cómo publicar Ciberpensum en Cloudflare Pages

Verificado contra la documentación oficial (2026-10-07):
- `https://developers.cloudflare.com/pages/get-started/git-integration/`
- `https://developers.cloudflare.com/pages/configuration/build-configuration/`
- `https://developers.cloudflare.com/pages/framework-guides/deploy-anything`

## Requisitos

- El repo en GitHub: `Coronel-Ing-Paul-Cruz/Ciberpensum` (branch `main`).
- Una cuenta de Cloudflare (zona `pages.dev` gratis es suficiente).
- Host con Node `>= 20` (coincide con el `engines.node` de este package).

## Flujo recomendado (integración Git → deploys automáticos en cada push)

1. Abrir el dashboard de Cloudflare e ir a **Workers & Pages**.
2. **Create → Pages → Import an existing Git repository** → autoriza GitHub y selecciona `Ciberpensum` → **Begin setup**.
3. En **Set up builds and deployments**:

   | Opción | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(vacío)* |
   | Environment variables | `NODE_VERSION = 20` |

   (Sin `deploy command`: dejar el default `npx wrangler deploy`.)

4. **Save and Deploy** → la primera build produce `https://ciberpensum.pages.dev/`.
5. A partir de ahí, cada `git push` a `main` dispara rebuild+publicación automática.

## Dominio propio (`ciberpensum.do`)

Para el apex (`ciberpensum.do`) Cloudflare exige mover los NS del dominio a Cloudflare; para un subdominio basta un CNAME. Referencia: la misma guía de Git Integration. Hasta entonces el sitio está en `ciberpensum.pages.dev` y funciona igual; los canonicals/sitemap serán los del dominio final (`SITIO_URL` está hardcodeado a `https://ciberpensum.do` en `site/paginas.mjs`) — el canonical debe apuntar al dominio canónico aunque el sitio viva provisionalmente en `pages.dev`.

## Alternativa: deploy manual con Wrangler (sin conectar Git)

```bash
npm run build
npx wrangler pages deploy dist --project-name=ciberpensum
```

Con el proyecto ya creado el deploy lleva ~1 minuto. Más barato para mi criterio,
pero la integración Git es la forma mantenible (está en la doc oficial).

## Lo que NO hace falta

- **No hay Functions ni base de datos**: el sitio es estático puro (regla 2 de
  AGENTS.md); no hay build step del lado del servidor ni cloudflare adapters.
- **No hay imágenes** en dist, con lo que el deploy pesa KB y cualquier free
  tier sobra.

## Checklist antes del primer deploy (pendiente de hacer)

- [ ] Gate 4/4 PASS (último: 2026-10-07, 192 tests).
- [ ] Auditoría a11y final y SEO final con veredicto PASS del revisor (ambas canceladas en 2026-10-07, relanzadas).
- [ ] `robots.txt` y `sitemap.xml` emiten la URL final (ya lo hacen).
- [ ] Si se quiere el apex `ciberpensum.do`: agregar el dominio como zona en Cloudflare DNS y apuntar los NS en el registrador ANTES de dar el dominio como final.
