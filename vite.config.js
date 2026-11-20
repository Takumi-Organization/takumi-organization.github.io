import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multipágina: cada carpeta con su index.html se sirve como /carpeta/ tanto en `vite dev` como en `vite build`.
const paginas = ["privacidad", "terminos", "aviso-legal", "cookies", "licencias", "entidad"];

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        ...Object.fromEntries(paginas.map((p) => [p, resolve(import.meta.dirname, p, "index.html")])),
      },
    },
  },
});
