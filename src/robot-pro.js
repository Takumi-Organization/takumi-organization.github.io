// Modelo 3D profesional embebido desde Sketchfab: «Sci-Fi Humanoid Robot» de yur1_val (CC BY 4.0).
// https://sketchfab.com/3d-models/sci-fi-humanoid-robot-12ad786ecde246e5854a61fd4f67ed49
// Se muestra en escala de grises (filtro CSS) para respetar el monocromo de Takumi: es una modificación y se indica en la página.
// Carga bajo demanda (clic en la portada): es un servicio externo y el modelo es pesado (≈436 k triángulos).
// El script de la API de Sketchfab se fija por versión y por hash (SRI).
const UID = "12ad786ecde246e5854a61fd4f67ed49";
const API = { src: "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js", integrity: "sha384-9zoKPFaCdLZWOanLWfvsW1wp8ElBsVLSumafwhJrv3OzVRd41q3iDZmXhWiinYP5" };

// Planos de cámara calibrados a mano (la API de Sketchfab usa su propia escala de escena).
const DIR_FRENTE = [0.985, -0.025, 0.18], DIR_LADO = [0.05, 0.985, 0.15];
const plano = (t, dir, d) => ({ pos: t.map((v, i) => +(v + dir[i] * d).toFixed(3)), tgt: t });
const PLANOS = {
  cuerpo: plano([-0.28, -0.02, 0.85], DIR_FRENTE, 3.1),
  cabeza: plano([-0.28, -0.003, 1.61], DIR_FRENTE, 1.03),
  pecho: plano([-0.28, -0.015, 1.211], DIR_FRENTE, 1.45),
  perfil: plano([-0.01, 0.29, 0.9], DIR_LADO, 2.7),
};

function cargarApi() {
  return new Promise((ok, ko) => {
    if (window.Sketchfab) return ok();
    const s = document.createElement("script");
    s.src = API.src; s.integrity = API.integrity; s.crossOrigin = "anonymous"; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(new Error("No se pudo cargar la API de Sketchfab"));
    document.head.append(s);
  });
}

export function initPro({ host, facade, chipsEl, estadoEl, reduced, onError }) {
  let api = null, cargando = false, tocado = false;
  const estado = (t) => { if (estadoEl) estadoEl.textContent = t; };

  function aplicar(nombre, seg) {
    const p = PLANOS[nombre]; if (!api || !p) return;
    api.setCameraLookAt(p.pos, p.tgt, reduced ? 0 : seg);
    chipsEl?.querySelectorAll("button[data-plano]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.plano === nombre));
  }
  chipsEl?.addEventListener("click", (e) => { const b = e.target.closest("button[data-plano]"); if (b) { tocado = true; aplicar(b.dataset.plano, 1.2); } });

  async function cargar() {
    if (cargando) return; cargando = true;
    facade.disabled = true; facade.classList.add("cargando"); estado("Cargando el modelo desde Sketchfab…");
    const lento = setTimeout(() => estado("Está tardando más de lo normal: el modelo es pesado."), 15000);
    const fallo = (msg) => { clearTimeout(lento); cargando = false; facade.disabled = false; facade.classList.remove("cargando"); host.replaceChildren(); estado(msg); onError?.(msg); };
    try { await cargarApi(); } catch { return fallo("No se pudo cargar el visor de Sketchfab (¿sin conexión?)."); }
    const frame = document.createElement("iframe");
    frame.title = "Modelo 3D de un robot humanoide (Sketchfab)"; frame.setAttribute("allow", "autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope"); frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    host.replaceChildren(frame);
    new window.Sketchfab(frame).init(UID, {
      autostart: 1, transparent: 1, ui_theme: "dark", ui_controls: 0, ui_infos: 1, ui_hint: 0, dnt: 1, preload: 1,
      success: (a) => {
        api = a; a.start();
        a.addEventListener("viewerready", () => {
          clearTimeout(lento);
          // el visor reajusta su cámara al terminar de cargar texturas: se reaplica el plano inicial unas veces
          [0, 800, 2500, 5000].forEach((ms) => setTimeout(() => { if (!tocado) aplicar("cuerpo", 0); }, ms));
          facade.classList.add("listo"); setTimeout(() => (facade.hidden = true), 500);
          estado("Arrastra para orbitar, rueda o pellizco para acercar. Cambia de plano con los botones.");
        });
      },
      error: () => fallo("Tu navegador no admite WebGL o el visor no pudo iniciarse."),
    });
  }
  facade.addEventListener("click", cargar);
}
