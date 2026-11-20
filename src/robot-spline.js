// Robot 3D de la zona de IA: escena de Spline (humanoide de la comunidad de Spline) con el runtime oficial.
// Se carga sola cuando la sección está a punto de verse (IntersectionObserver), sin pulsar nada: así la portada
// pesa poco y el runtime y la escena (~1 MB, prod.spline.design) no retrasan el resto de la página.
const ESCENA = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

export function initSpline({ canvas, facade, estadoEl, reduced }) {
  let cargando = false;
  const estado = (t) => { if (estadoEl) estadoEl.textContent = t; };

  async function cargar() {
    if (cargando) return; cargando = true;
    const lento = setTimeout(() => estado("Está tardando más de lo normal: la escena es pesada."), 15000);
    try {
      const { Application } = await import("@splinetool/runtime");
      const app = new Application(canvas);
      await app.load(ESCENA);
      clearTimeout(lento);
      canvas.hidden = false;
      facade.classList.add("listo"); setTimeout(() => (facade.hidden = true), 500);
      estado(reduced ? "Modelo cargado." : "Mueve el cursor: el robot te sigue con la mirada.");
    } catch {
      clearTimeout(lento);
      estado("No se pudo cargar la escena de Spline (¿sin conexión o sin WebGL?).");
    }
  }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); cargar(); } }, { rootMargin: "600px 0px" });
  io.observe(facade);
}
