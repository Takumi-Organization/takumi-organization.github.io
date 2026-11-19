# Takumi Organization — web oficial

Sitio estático de la organización: quiénes somos, método de trabajo, datos en vivo de GitHub, proyectos, zona de IA y contacto.
Identidad visual: papel negro, tinta clara, trazo afilado (ver el logo de la organización).

## Qué incluye
- **Objeto 3D deformable** (hero): icosaedro cuyos vértices se desplazan con ruido simplex en el shader; reacciona al puntero, al clic, al arrastre y a la velocidad de scroll.
- **Ciudad de repositorios** (3D): un bloque por proyecto, altura = commits; se gira arrastrando y muestra datos al pasar el cursor.
- **Datos de GitHub**: `scripts/fetch-stats.mjs` genera `public/data/stats.json` (repos, commits, lenguajes, actividad).
- **Robot 3D interactivo** (zona de IA): modelo procedural facetado (cajas, prismas y cilindros de Three.js, sin modelos externos) con brazos articulados; se orbita arrastrando con inercia, el ojo y la cabeza siguen al puntero, resalta cada parte al pasar el cursor y cambia de pose al pulsarlo (`src/robot.js`). Es solo la mascota de la sección: no incorpora ninguna IA.
- **Contacto** sin servidor: prepara un `mailto:` (el correo se cambia en `src/config.js`).

## Desarrollo
```bash
npm install
npm run dev        # servidor local
npm run stats      # regenerar datos (GH_TOKEN en el entorno)
npm run build      # salida en dist/
```
Dependencias: `three`, `vite` y dos fuentes de `@fontsource`. Nada más.

## Datos y privacidad
La mayoría de repositorios de la organización son privados. Para incluirlos en las cifras, el workflow necesita el secret
**`ORG_READ_TOKEN`**: un token fine-grained de solo lectura (Metadata y Contents) sobre `Takumi-Organization`.
Sin él, el despliegue usa la instantánea versionada de `public/data/stats.json` y no la sobrescribe.
La web muestra de los repos privados únicamente nombre, descripción, stack, commits y fecha del último cambio, sin enlace.

## Despliegue
GitHub Pages desde `.github/workflows/deploy.yml` (en cada push a `main` y a diario a las 05:17 UTC).
