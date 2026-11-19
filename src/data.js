import { initCity } from "./city.js";

const fmt = (n) => Number(n).toLocaleString("es-ES");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function ago(iso) {
  const d = (Date.now() - new Date(iso)) / 36e5;
  if (d < 1) return "hace minutos";
  if (d < 24) return `hace ${Math.round(d)} h`;
  const days = Math.round(d / 24);
  return days < 31 ? `hace ${days} d` : `hace ${Math.round(days / 30)} meses`;
}

function countUp(el, to) {
  const t0 = performance.now(), dur = 1400;
  (function f(t) {
    const k = Math.min((t - t0) / dur, 1), e = 1 - (1 - k) ** 4;
    el.textContent = fmt(Math.round(to * e));
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

function card(r, areas) {
  const area = areas.find((a) => a.id === r.area)?.titulo || r.area;
  const el = document.createElement("article");
  el.className = "cut card";
  el.dataset.area = r.area;
  el.innerHTML = `<div class="in">
    <h4>${esc(r.name)}<span class="tag">${r.visibilidad === "publico" ? "Público" : "Privado"}</span></h4>
    <p>${esc(r.descripcion)}</p>
    <div class="meta"><span>${esc(r.stack)}</span><span>${fmt(r.commits)} ${r.commits === 1 ? "commit" : "commits"} · ${ago(r.pushed)}</span></div>
    ${r.url ? `<a class="over" href="${esc(r.url)}" rel="noopener" aria-label="Abrir ${esc(r.name)} en GitHub"></a>` : ""}
  </div>`;
  el.title = area;
  return el;
}

export async function loadData() {
  let d;
  try {
    d = await (await fetch(`${import.meta.env.BASE_URL}data/stats.json`)).json();
  } catch {
    document.getElementById("data-updated").textContent = "No se pudieron cargar los datos.";
    return;
  }
  const proyectos = d.repos.filter((r) => r.area !== "archivo");
  const archivo = d.repos.length - proyectos.length;

  // cifras del hero
  const lineas = Math.round(d.totals.bytes / 38);
  const vals = { repos: d.totals.repos, commits: d.totals.commits, lenguajes: d.totals.lenguajes, lineas };
  document.querySelectorAll("[data-stat]").forEach((el) => countUp(el, vals[el.dataset.stat]));
  document.getElementById("data-updated").textContent = d.generated ? `Última actualización: ${new Date(d.generated).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.` : "";

  // lenguajes
  const top = d.languages.slice(0, 8), total = d.languages.reduce((s, l) => s + l.bytes, 0);
  const ul = document.getElementById("lang-bars");
  ul.innerHTML = top.map((l) => `<li><span>${esc(l.name)}</span><span class="track"><span class="fill" data-w="${(l.bytes / top[0].bytes) * 100}"></span></span><span class="pct">${((l.bytes / total) * 100).toFixed(1)}%</span></li>`).join("");
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { ul.querySelectorAll(".fill").forEach((f) => (f.style.width = f.dataset.w + "%")); o.disconnect(); } }, { threshold: 0.3 }).observe(ul);

  // actividad
  document.getElementById("recent").innerHTML = proyectos.slice(0, 6).map((r) => `<li><span>${esc(r.name)}</span><span class="when">${ago(r.pushed)}</span></li>`).join("");

  // proyectos con filtros
  const usadas = d.areas.filter((a) => proyectos.some((r) => r.area === a.id));
  const cards = document.getElementById("cards"), filters = document.getElementById("filters");
  const nodes = proyectos.map((r) => card(r, d.areas));
  nodes.forEach((n) => cards.append(n));
  const mk = (id, label) => { const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.f = id; b.textContent = label; b.setAttribute("aria-selected", id === "all"); return b; };
  filters.append(mk("all", `Todos (${proyectos.length})`), ...usadas.map((a) => mk(a.id, `${a.titulo} (${proyectos.filter((r) => r.area === a.id).length})`)));
  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", x === b));
    nodes.forEach((n) => (n.hidden = b.dataset.f !== "all" && n.dataset.area !== b.dataset.f));
  });
  document.getElementById("archive-note").textContent = archivo ? `Además, ${archivo} repositorios de archivo (prácticas y proyectos anteriores) se conservan en privado y no se muestran aquí.` : "";

  // IA
  const ai = document.getElementById("ai-cards");
  proyectos.filter((r) => r.area === "ia").forEach((r) => ai.append(card(r, d.areas)));

  // spotlight en tarjetas
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest?.(".cut"); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
  });

  // ciudad 3D
  initCity(document.getElementById("city-canvas"), proyectos, d.areas, document.getElementById("city-tip"));
}
