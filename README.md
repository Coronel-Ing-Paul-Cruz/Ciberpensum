# Ciberpensum

Planificador académico estático para universidades dominicanas. Sin cuentas, sin
backend, sin scraping: el progreso vive en `localStorage`, se exporta e importa,
y cada dato académico lleva su fuente (PDF oficial + `sha256` + fecha de
verificación).

> Sitio en vivo (GitHub Pages): **https://coronel-ing-paul-cruz.github.io/Ciberpensum/**

[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-stricto-3178c6)
![Sin backend](https://img.shields.io/badge/statico-sin%20backend-blue)

## Qué resuelve

En República Dominicana cada universidad publica su pensum en PDF, con su propia
escala de notas y su reglamento. Ciberpensum convierte esos PDFs oficiales en
herramientas útiles por carrera:

- **Cuaderno de progreso** — marca tus materias aprobadas y mira cuánto te falta.
- **Índice académico** — calcula tu índice ponderado y compáralo con las
  distinciones (escala de honores de cada universidad).
- **Progresión** — qué puedes inscribir hoy según pre- y co-requisitos.
- **Nota mínima** — qué promedio necesitas en los próximos créditos para llegar
  a una meta.

## Carreras curadas

| Universidad | Carrera | Estado |
|---|---|---|
| UTESA | Ingeniería en Sistemas Computacionales | ✅ curada (PDF oficial verificado) |

Cada pensum en `data/curated/` trae `fuente.url`, `sha256` y `verificadoEn`. Si
un dato no está confirmado contra el PDF oficial, la página lo muestra marcado
como `NO VERIFICADO` — nunca se inventa.

## Stack

- **Estático de verdad** — cero JavaScript en el servidor; los componentes son
  útiles con JS bloqueado, JS solo mejora.
- **TypeScript estricto** en `core/` (puro, sin DOM) y la UI en `tools/`.
- **Accesible** — revisión WCAG 2.2 como gate antes de publicar.
- **PWA** — manifest + service worker para uso offline.
- **Gate de 4 chequeos** — `npm run gate` (estructura, datos, config, tests) antes
  de cada commit.

## Estructura

```
core/      TypeScript puro (un módulo por herramienta)
tools/     UI de cada herramienta (solo importa su módulo de core/)
data/      raw/ (PDFs evidencia) · curated/ (pensums verificados)
site/      Páginas prerenderizadas
tools-cli/ verify · extract-pensum · build
pwa/       Manifest y service worker
```

## Uso

```bash
npm ci
npm run gate     # 4 chequeos: verify, data, config, tests
npm run build    # genera dist/
npm start        # sirve localmente el dist/
```

## Portafolio: cómo leer este repo

Este proyecto es una demostración de **backend-style engineering en un sitio
estático**: curaduría de datos con trazabilidad (cada número viene de un PDF
oficial con hash), TDD en cada módulo de `core/`, pipeline de verificación
automatizado y accesibilidad/SEO medidos como gate. El documento
`docs/DEPLOY.md` documenta el despliegue.

## Licencia

MIT — ver [LICENSE](LICENSE). Los datos académicos pertenecen a cada universidad.