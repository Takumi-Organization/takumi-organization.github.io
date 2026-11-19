// Genera public/data/stats.json con datos de la organización en GitHub.
// Con un token que vea los repos privados (secret ORG_READ_TOKEN) incluye también los privados;
// con el GITHUB_TOKEN por defecto del workflow solo ve los públicos.
// Si la API falla, conserva el fichero anterior para no romper el despliegue.
import { readFile, writeFile } from "node:fs/promises";

const ORG = "Takumi-Organization";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const OUT = new URL("../public/data/stats.json", import.meta.url);
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) };

async function api(path) {
  const r = await fetch(path.startsWith("http") ? path : `https://api.github.com${path}`, { headers });
  if (r.status === 409) return { body: [], link: "" }; // repo vacío
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return { body: await r.json(), link: r.headers.get("link") || "" };
}

async function allRepos() {
  const out = [];
  for (let page = 1; ; page++) {
    const { body } = await api(`/orgs/${ORG}/repos?type=all&per_page=100&page=${page}`);
    out.push(...body);
    if (body.length < 100) return out;
  }
}

async function commitCount(repo) {
  const { body, link } = await api(`/repos/${ORG}/${repo.name}/commits?per_page=1&sha=${repo.default_branch}`);
  const m = link.match(/[?&]page=(\d+)>; rel="last"/);
  return m ? Number(m[1]) : body.length;
}

async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]); } }));
  return res;
}

try {
  const meta = await fetch(`https://raw.githubusercontent.com/${ORG}/.github/main/projects.json`).then((r) => (r.ok ? r.json() : { areas: [], proyectos: [] }));
  const porNombre = new Map(meta.proyectos.map((p) => [p.nombre, p]));
  const repos = (await allRepos()).filter((r) => r.name !== ".github");

  const filas = await pool(repos, 5, async (r) => {
    const [{ body: langs }, commits] = await Promise.all([api(`/repos/${ORG}/${r.name}/languages`), commitCount(r)]);
    const m = porNombre.get(r.name);
    return {
      name: r.name,
      descripcion: m?.descripcion || r.description || "",
      area: m?.area || "archivo",
      stack: m?.stack || r.language || "",
      visibilidad: r.private ? "privado" : "publico",
      language: r.language || "",
      languages: langs,
      commits,
      size_kb: r.size,
      pushed: r.pushed_at,
      created: r.created_at,
      stars: r.stargazers_count,
      url: r.private ? null : r.html_url,
    };
  });

  const bytes = {};
  for (const f of filas) for (const [l, b] of Object.entries(f.languages)) bytes[l] = (bytes[l] || 0) + b;
  const languages = Object.entries(bytes).sort((a, b) => b[1] - a[1]).map(([name, b]) => ({ name, bytes: b }));
  filas.forEach((f) => delete f.languages);
  filas.sort((a, b) => b.pushed.localeCompare(a.pushed));

  const data = {
    generated: new Date().toISOString(),
    org: ORG,
    incluyePrivados: filas.some((f) => f.visibilidad === "privado"),
    totals: {
      repos: filas.length,
      publicos: filas.filter((f) => f.visibilidad === "publico").length,
      privados: filas.filter((f) => f.visibilidad === "privado").length,
      commits: filas.reduce((s, f) => s + f.commits, 0),
      bytes: languages.reduce((s, l) => s + l.bytes, 0),
      lenguajes: languages.length,
    },
    areas: meta.areas,
    languages,
    repos: filas,
  };
  await writeFile(OUT, JSON.stringify(data, null, 1));
  console.log(`stats.json: ${data.totals.repos} repos, ${data.totals.commits} commits, ${data.totals.lenguajes} lenguajes`);
} catch (e) {
  console.warn("No se pudo actualizar stats.json, se conserva el anterior:", e.message);
  try { await readFile(OUT); } catch { await writeFile(OUT, JSON.stringify({ generated: null, totals: { repos: 0, publicos: 0, privados: 0, commits: 0, bytes: 0, lenguajes: 0 }, areas: [], languages: [], repos: [] })); }
}
