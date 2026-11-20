# Takumi Organization — web oficial

Sitio estático de la organización: quiénes somos, método de trabajo, datos en vivo de GitHub, proyectos, zona de IA y contacto.
Identidad visual: papel negro, tinta clara, trazo afilado (ver el logo de la organización).

## Qué incluye
- **Objeto 3D deformable** (hero): icosaedro cuyos vértices se desplazan con ruido simplex en el shader; reacciona al puntero, al clic, al arrastre y a la velocidad de scroll.
- **Reacción al audio** (hero): el botón «Reaccionar al audio» (`src/audio.js`, `AnalyserNode` con puerta de ruido) analiza graves, medios y agudos y el objeto responde. Fuente, por orden: (1) los «monitores» de la salida de sonido que el navegador liste como entradas (`Monitor of …`, `Mezcla estéreo`): captan todo lo que suena, sea de Spotify, un vídeo o un juego, y funcionan en Firefox/Nivora en Linux; (2) el micrófono. En Chromium hay además «Compartir pestaña con audio» (`getDisplayMedia`). Hace falta el permiso de audio del navegador; todo se analiza en local, no se graba ni se envía nada. En silencio, o sin permiso, el objeto es el de siempre. Si el navegador ya recuerda el permiso, se reactiva solo.
- **Ciudad de repositorios** (3D): un bloque por proyecto, altura = commits; se gira arrastrando y muestra datos al pasar el cursor.
- **Datos de GitHub**: `scripts/fetch-stats.mjs` genera `public/data/stats.json` (repos, commits, lenguajes, actividad).
- **Robot 3D** (zona de IA): escena de Spline (humanoide de la comunidad de Spline (`kZDDjO5HuC9GJUM2`)) cargada con `@splinetool/runtime` (`src/robot-spline.js`). El robot gira la cabeza siguiendo el cursor. Se carga sola al acercarse a la sección (IntersectionObserver) y se muestra en escala de grises (filtro CSS) para respetar el monocromo Takumi. Mientras carga se ve una portada (`public/robot-spline.webp`), y también si no hay WebGL; el runtime y la escena (≈1 MB) vienen de `prod.spline.design`. Para cambiar de modelo basta con cambiar la URL `ESCENA` (exportada desde Spline como «Code → Viewer»). Es solo una mascota: no incorpora ninguna IA.
- **Contacto** sin servidor: prepara un `mailto:` (el correo se cambia en `src/config.js`).

## Desarrollo
```bash
npm install
npm run dev        # servidor local
npm run stats      # regenerar datos (GH_TOKEN en el entorno)
npm run build      # salida en dist/
```
Dependencias: `three`, `@splinetool/runtime`, `vite` y dos fuentes de `@fontsource`. Nada más.

## Datos y privacidad
La mayoría de repositorios de la organización son privados. Para incluirlos en las cifras, el workflow necesita el secret
**`ORG_READ_TOKEN`**: un token fine-grained de solo lectura (Metadata y Contents) sobre `Takumi-Organization`.
Sin él, el despliegue usa la instantánea versionada de `public/data/stats.json` y no la sobrescribe.
La web muestra de los repos privados únicamente nombre, descripción, stack, commits y fecha del último cambio, sin enlace.

## Despliegue
GitHub Pages desde `.github/workflows/deploy.yml` (en cada push a `main` y a diario a las 05:17 UTC).
