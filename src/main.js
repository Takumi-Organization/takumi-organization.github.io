import "./styles.css";
import { initBlob } from "./blob.js";
import { loadData } from "./data.js";
import { initPro } from "./robot-pro.js";
import { CONTACT_EMAIL, ORG_URL, WHATSAPP, WHATSAPP_TEXTO } from "./config.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

initBlob(document.getElementById("hero-canvas"), reduced);
// robot 3D: modelo profesional (por defecto) y Takumi-bot propio (se carga solo si se pide)
initPro({
  host: document.getElementById("pro-host"), facade: document.getElementById("pro-load"), chipsEl: document.getElementById("cam-chips"),
  estadoEl: document.getElementById("pro-estado"), reduced,
});
let propioIniciado = false;
const paneProEl = document.getElementById("pane-pro"), paneOwnEl = document.getElementById("pane-own");
const ctrlProEl = document.getElementById("ctrl-pro"), ctrlOwnEl = document.getElementById("ctrl-propio"), modoChips = document.getElementById("modo-chips");
function modo(m) {
  const pro = m === "pro";
  paneProEl.hidden = !pro; ctrlProEl.hidden = !pro; paneOwnEl.hidden = pro; ctrlOwnEl.hidden = pro;
  modoChips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === m));
  if (!pro && !propioIniciado) {
    propioIniciado = true;
    import("./robot.js").then(({ initRobot }) => initRobot(document.getElementById("robot-canvas"), {
      tipEl: document.getElementById("robot-tip"), readoutEl: document.getElementById("robot-part"), chipsEl: document.getElementById("robot-chips"), reduced,
    }));
  }
}
modoChips.addEventListener("click", (e) => { const b = e.target.closest("button[data-modo]"); if (b) modo(b.dataset.modo); });
loadData();

// revelado al hacer scroll
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// navegación: fondo al bajar y enlace activo
const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("solid", scrollY > 40), { passive: true });
const links = [...document.querySelectorAll(".nav nav a")];
const secs = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
secs.forEach((s) => spy.observe(s));

// contacto: prepara un mailto, sin servidor
document.getElementById("gh-link").href = ORG_URL;
document.getElementById("mail-link").href = `mailto:${CONTACT_EMAIL}`;
const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WHATSAPP_TEXTO)}`;
document.getElementById("wa-link").href = wa;
document.getElementById("wa-btn").href = wa;
const form = document.getElementById("contact-form"), msg = document.getElementById("form-msg");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(form), nombre = f.get("nombre").trim(), email = f.get("email").trim(), texto = f.get("mensaje").trim();
  if (!nombre || !/^\S+@\S+\.\S+$/.test(email) || !texto) { msg.textContent = "Rellena nombre, un correo válido y el mensaje."; return; }
  const asunto = `[Takumi] ${f.get("asunto")} — ${nombre}`;
  location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(`${texto}\n\n— ${nombre} (${email})`)}`;
  msg.textContent = "Abriendo tu cliente de correo…";
});
