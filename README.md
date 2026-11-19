# Takumi Organization — web oficial

Sitio estático de la organización: quiénes somos, método de trabajo, datos en vivo de GitHub, proyectos, zona de IA y contacto.
Identidad visual: papel negro, tinta clara, trazo afilado (ver el logo de la organización).

## Qué incluye
- **Objeto 3D deformable** (hero): icosaedro cuyos vértices se desplazan con ruido simplex en el shader; reacciona al puntero, al clic, al arrastre y a la velocidad de scroll.
- **Ciudad de repositorios** (3D): un bloque por proyecto, altura = commits; se gira arrastrando y muestra datos al pasar el cursor.
- **Datos de GitHub**: `scripts/fetch-stats.mjs` genera `public/data/stats.json` (repos, commits, lenguajes, actividad).
- **Robot 3D** (zona de IA), con dos modelos que se alternan:
  - **Modelo profesional**: «[Sci-Fi Humanoid Robot](https://sketchfab.com/3d-models/sci-fi-humanoid-robot-12ad786ecde246e5854a61fd4f67ed49)» de [yur1_val](https://sketchfab.com/yur1_val) (Sketchfab, licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), embebido con la API oficial del visor. Se muestra en **escala de grises** (filtro CSS; es una modificación y se indica en la web) para respetar el monocromo Takumi. Carga bajo demanda desde una portada (`public/robot-pro.webp`) porque es un servicio externo y un modelo pesado (≈436 k triángulos); el script de la API va fijado por versión y por hash SRI. Ofrece cuatro planos de cámara (cuerpo entero, cabeza, pecho y perfil) calibrados a mano (`src/robot-pro.js`). El modelo es estático (T-pose): no trae animaciones.
  - **Takumi-bot (propio)**: humanoide de armadura con geometría procedural de Three.js, materiales PBR, entorno de estudio generado en código, bloom sutil y cuatro poses con resortes amortiguados (`src/robot.js`, carga diferida). Es solo una mascota: no incorpora ninguna IA.
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
