// Segundo elemento 3D: ciudad de repositorios. Un bloque por proyecto, altura = commits.
import * as THREE from "three";

export function initCity(canvas, repos, areas, tipEl) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { canvas.replaceWith(Object.assign(document.createElement("p"), { className: "muted small", textContent: "Tu navegador no admite WebGL." })); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-5, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(6, 3, -6); scene.add(rim);

  const grid = new THREE.GridHelper(24, 24, 0x2c2c2c, 0x141414); scene.add(grid);

  const orden = areas.map((a) => a.id);
  const filas = orden.map((id) => repos.filter((r) => r.area === id)).filter((f) => f.length);
  const gap = 1.25, rowGap = 1.9;
  const group = new THREE.Group(); scene.add(group);
  const meshes = [];
  filas.forEach((fila, zi) => {
    fila.forEach((r, xi) => {
      const h = 0.35 + Math.log2(r.commits + 1) * 0.62;
      const geo = new THREE.BoxGeometry(0.82, h, 0.82); geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0.4 }));
      m.position.set((xi - (fila.length - 1) / 2) * gap, 0, (zi - (filas.length - 1) / 2) * rowGap);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      m.add(edges); m.userData = { repo: r, edges }; group.add(m); meshes.push(m);
    });
  });

  const state = { yaw: 0.6, pitch: 0.62, dist: 16, drag: null, hover: null, visible: false, auto: true };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    state.dist = Math.max(13, 17 - (w / h) * 1.2 + (w < 520 ? 7 : 0));
  }
  new ResizeObserver(resize).observe(canvas); resize();
  new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }, { threshold: 0.05 }).observe(canvas);

  canvas.addEventListener("pointerdown", (e) => { state.drag = { x: e.clientX, y: e.clientY }; state.auto = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", () => { state.drag = null; setTimeout(() => { if (!state.drag) state.auto = true; }, 2500); });
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (state.drag) {
      state.yaw -= (e.clientX - state.drag.x) * 0.006;
      state.pitch = Math.max(0.15, Math.min(1.3, state.pitch + (e.clientY - state.drag.y) * 0.005));
      state.drag.x = e.clientX; state.drag.y = e.clientY;
    }
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    setHover(hit ? hit.object : null);
    if (hit) { tipEl.hidden = false; tipEl.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + "px"; tipEl.style.top = e.clientY - r.top + 14 + "px"; }
  });
  canvas.addEventListener("pointerleave", () => setHover(null));
  function setHover(m) {
    if (m === state.hover) return;
    if (state.hover) { state.hover.material.color.setHex(0x141414); state.hover.userData.edges.material.opacity = 0.55; }
    state.hover = m;
    if (m) {
      m.material.color.setHex(0xe8e8e8); m.userData.edges.material.opacity = 1;
      const r = m.userData.repo;
      tipEl.innerHTML = `<strong>${r.name}</strong><br>${r.commits} commits · ${r.stack || r.language || "—"}`;
    } else tipEl.hidden = true;
  }

  let last = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    if (!state.visible || document.hidden) return;
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (state.auto) state.yaw += dt * 0.12;
    camera.position.set(Math.sin(state.yaw) * Math.cos(state.pitch) * state.dist, Math.sin(state.pitch) * state.dist, Math.cos(state.yaw) * Math.cos(state.pitch) * state.dist);
    camera.lookAt(0, 1.2, 0);
    renderer.render(scene, camera);
  })();
}
