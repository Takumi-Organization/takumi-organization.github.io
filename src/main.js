import "./styles.css";
import { initBlob } from "./blob.js";
import { loadData } from "./data.js";
import { initSpline } from "./robot-spline.js";
import { CONTACT_EMAIL, ORG_URL, WHATSAPP, WHATSAPP_TEXTO } from "./config.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

initBlob(document.getElementById("hero-canvas"), reduced);
// robot 3D: escena de Spline, se carga sola al acercarse a la sección
initSpline({ canvas: document.getElementById("robot-canvas"), facade: document.getElementById("spline-load"), estadoEl: document.getElementById("spline-estado"), reduced });
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
