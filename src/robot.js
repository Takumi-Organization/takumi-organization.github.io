// Robot procedural de la zona de IA: geometría propia (sin modelos externos), facetada, con el corte
// diagonal del logo. Interacción: orbitar arrastrando (con inercia), el ojo y la cabeza siguen al puntero,
// hover con etiqueta, clic para cambiar de pose. Un solo renderer, solo dibuja cuando es visible.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const PARTES = {
  Cabeza: "Casco facetado con el corte diagonal del logo.",
  Visor: "Ojo luminoso: sigue tu puntero.",
  Torso: "Pecho con panel y luz de estado.",
  "Brazo izquierdo": "Hombro y codo articulados.",
  "Brazo derecho": "Hombro y codo articulados.",
  Piernas: "Cadera y rodillas; el robot flota un poco.",
  Base: "Plataforma octogonal.",
};

// ángulos objetivo de cada articulación por pose (radianes)
const POSES = {
  reposo: { ls: [0, 0.1], le: 0, rs: [0, -0.1], re: 0, head: 0, torso: 0 },
  saludo: { ls: [0, 2.55], le: 0, rs: [0, -0.1], re: 0, head: 0.15, torso: 0.1 },
  guardia: { ls: [-0.55, 0.6], le: -1.5, rs: [-0.55, -0.6], re: -1.5, head: 0, torso: 0 },
  escaneo: { ls: [-0.2, 0.7], le: -0.3, rs: [-0.2, -0.7], re: -0.3, head: 0, torso: 0 },
};
const ORDEN = ["saludo", "guardia", "escaneo", "reposo"];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initRobot(canvas, opts) {
  const { tipEl, readoutEl, chipsEl, reduced } = opts;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    const aviso = Object.assign(document.createElement("p"), { className: "muted small", textContent: "Tu navegador no admite WebGL: no se puede mostrar el modelo 3D." });
    canvas.replaceWith(aviso);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.95;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-4, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2); rim.position.set(6, 4, -6); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  // ---------- construcción ----------
  const root = new THREE.Group(); scene.add(root);
  const partes = {}; // nombre -> { meshes: [], lineas: [] }
  const pickables = [];

  const matDark = () => new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.75, roughness: 0.4, flatShading: true });
  const matSilver = () => new THREE.MeshStandardMaterial({ color: 0xa4a8af, metalness: 0.95, roughness: 0.3, flatShading: true });
  const matPanel = () => new THREE.MeshStandardMaterial({ color: 0x060607, metalness: 0.4, roughness: 0.55, flatShading: true });
  const matLuz = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function registrar(nombre, mesh, conLineas = true) {
    mesh.userData.parte = nombre;
    const p = (partes[nombre] ||= { meshes: [], lineas: [] });
    p.meshes.push(mesh); pickables.push(mesh);
    if (conLineas) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 }));
      mesh.add(l); p.lineas.push(l);
    }
    return mesh;
  }
  const caja = (w, h, d, mat, nombre, x = 0, y = 0, z = 0, padre = root, lineas = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); padre.add(m); return registrar(nombre, m, lineas);
  };
  // forma extruida desde un polígono en XY (profundidad centrada en z)
  const prisma = (puntos, prof, mat, nombre, x = 0, y = 0, z = 0, padre = root) => {
    const s = new THREE.Shape(puntos.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: false });
    g.translate(0, 0, -prof / 2);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); padre.add(m); return registrar(nombre, m);
  };
  const cilindro = (rt, rb, h, seg, mat, nombre, x, y, z, padre = root, rotZ = false) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z); if (rotZ) m.rotation.z = Math.PI / 2; padre.add(m); return registrar(nombre, m);
  };

  // base octogonal
  cilindro(1.85, 2.05, 0.16, 8, matDark(), "Base", 0, 0.08, 0);
  cilindro(1.3, 1.3, 0.03, 8, matSilver(), "Base", 0, 0.17, 0);

  const bot = new THREE.Group(); bot.position.y = 0.18; root.add(bot);

  // piernas
  for (const sx of [-1, 1]) {
    caja(0.66, 0.16, 0.9, matDark(), "Piernas", sx * 0.46, 0.08, 0.06, bot);
    prisma([[-0.17, 0], [0.17, 0], [0.13, 0.95], [-0.13, 0.95]], 0.36, matDark(), "Piernas", sx * 0.46, 0.16, 0, bot);
    cilindro(0.15, 0.15, 0.4, 6, matSilver(), "Piernas", sx * 0.46, 1.16, 0, bot, true);
    caja(0.36, 0.62, 0.4, matDark(), "Piernas", sx * 0.46, 1.5, 0, bot);
  }
  caja(1.7, 0.3, 0.74, matDark(), "Piernas", 0, 1.98, 0, bot);

  // torso (pivote en la cadera para girarlo)
  const torso = new THREE.Group(); torso.position.y = 2.13; bot.add(torso);
  prisma([[-0.9, 0], [0.9, 0], [0.9, 1.05], [0.46, 1.5], [-0.9, 1.5]], 0.82, matDark(), "Torso", 0, 0, 0, torso);
  caja(0.98, 0.56, 0.05, matPanel(), "Torso", -0.08, 0.72, 0.43, torso);
  caja(0.7, 0.04, 0.06, matSilver(), "Torso", -0.08, 0.9, 0.45, torso, false);
  caja(0.7, 0.04, 0.06, matSilver(), "Torso", -0.08, 0.56, 0.45, torso, false);
  const luz = caja(0.13, 0.13, 0.07, matLuz, "Torso", 0.38, 0.72, 0.46, torso, false);
  caja(0.5, 0.2, 0.06, matSilver(), "Torso", 0, 0.2, 0.43, torso);

  // cabeza (pivote en el cuello)
  const cabeza = new THREE.Group(); cabeza.position.y = 1.55; torso.add(cabeza);
  cilindro(0.2, 0.26, 0.22, 6, matSilver(), "Cabeza", 0, 0.1, 0, cabeza);
  const casco = new THREE.Group(); casco.position.y = 0.2; cabeza.add(casco);
  prisma([[-0.7, 0], [0.7, 0], [0.7, 0.62], [0.4, 0.98], [-0.7, 0.98]], 0.86, matDark(), "Cabeza", 0, 0, 0, casco);
  caja(1.12, 0.5, 0.05, matPanel(), "Visor", 0, 0.46, 0.44, casco);
  const ojo = new THREE.Group(); ojo.position.set(0, 0.46, 0.48); casco.add(ojo);
  const barra = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.03), matLuz); ojo.add(barra); registrar("Visor", barra, false);
  const punto = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), matLuz); punto.position.x = 0.46; ojo.add(punto); registrar("Visor", punto, false);
  for (const sx of [-1, 1]) cilindro(0.13, 0.13, 0.16, 6, matSilver(), "Cabeza", sx * 0.78, 0.46, 0, casco, true);
  prisma([[0, 0], [0.12, 0], [0.04, 0.5], [0, 0.5]], 0.06, matSilver(), "Cabeza", -0.5, 0.98, 0, casco);

  // brazos articulados: pivote hombro -> codo
  function brazo(lado, nombre) {
    const sx = lado;
    const hombro = new THREE.Group(); hombro.position.set(sx * 1.22, 1.25, 0); torso.add(hombro);
    prisma([[-0.3, -0.12], [0.3, -0.12], [0.34, 0.2], [0, 0.34], [-0.34, 0.2]], 0.52, matSilver(), nombre, 0, 0, 0, hombro);
    caja(0.34, 1.0, 0.38, matDark(), nombre, 0, -0.55, 0, hombro);
    const codo = new THREE.Group(); codo.position.y = -1.08; hombro.add(codo);
    cilindro(0.16, 0.16, 0.42, 6, matSilver(), nombre, 0, 0, 0, codo, true);
    caja(0.3, 0.9, 0.34, matDark(), nombre, 0, -0.5, 0, codo);
    prisma([[-0.2, 0], [0.2, 0], [0.14, -0.34], [-0.14, -0.34]], 0.3, matSilver(), nombre, 0, -0.95, 0, codo);
    return { hombro, codo };
  }
  const izq = brazo(1, "Brazo izquierdo");
  const der = brazo(-1, "Brazo derecho");

  // ---------- estado ----------
  const est = {
    yaw: 0, vel: 0, pitch: 0.12, drag: null, hover: null, visible: false, auto: !reduced, inercia: 0,
    ls: [0, 0.1], le: 0, rs: [0, -0.1], re: 0, head: 0, torso: 0, pose: "reposo", poseT: 0,
    px: 0, py: 0, eye: [0, 0], headYaw: 0, headPitch: 0, resetVista: false,
  };

  function ponerPose(nombre) {
    est.pose = nombre; est.poseT = 0;
    chipsEl?.querySelectorAll("button[data-pose]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.pose === nombre));
  }
  chipsEl?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pose) ponerPose(b.dataset.pose);
    if (b.dataset.vista) est.resetVista = true;
  });

  // ---------- tamaño y visibilidad ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const alto = 7.0, ancho = 5.2;
    const d1 = alto / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const d2 = ancho / 2 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    est.dist = Math.max(d1, d2) * 1.04;
  }
  new ResizeObserver(resize).observe(canvas); resize();
  new IntersectionObserver(([e]) => { est.visible = e.isIntersecting; }, { threshold: 0.05 }).observe(canvas);

  // ---------- puntero ----------
  const rayo = new THREE.Raycaster(), m2 = new THREE.Vector2();
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    est.px = clamp(((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5)), -1, 1);
    est.py = clamp(((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5)), -1, 1);
  }, { passive: true });

  canvas.addEventListener("pointerdown", (e) => {
    est.drag = { x: e.clientX, y: e.clientY, mov: 0 }; est.auto = false; est.vel = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (est.drag) {
      const dx = e.clientX - est.drag.x, dy = e.clientY - est.drag.y;
      est.yaw += dx * 0.009; est.vel = dx * 0.009;
      est.pitch = clamp(est.pitch + dy * 0.004, -0.1, 0.5);
      est.drag.x = e.clientX; est.drag.y = e.clientY; est.drag.mov += Math.abs(dx) + Math.abs(dy);
      setHover(null);
      return;
    }
    m2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(m2, camera);
    const hit = rayo.intersectObjects(pickables, false)[0];
    setHover(hit ? hit.object.userData.parte : null);
    if (hit && tipEl) {
      tipEl.hidden = false;
      tipEl.style.left = Math.min(e.clientX - r.left + 14, r.width - 150) + "px";
      tipEl.style.top = e.clientY - r.top + 14 + "px";
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (est.drag && est.drag.mov < 6) {
      // clic: sobre el robot, siguiente pose
      const r = canvas.getBoundingClientRect();
      m2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(m2, camera);
      if (rayo.intersectObjects(pickables, false).length) ponerPose(ORDEN[(ORDEN.indexOf(est.pose) + 1) % ORDEN.length]);
    }
    est.drag = null;
    est.inercia = performance.now();
  });
  canvas.addEventListener("pointercancel", () => { est.drag = null; });
  canvas.addEventListener("pointerleave", () => { if (!est.drag) setHover(null); });

  function setHover(nombre) {
    if (nombre === est.hover) return;
    if (est.hover) pintar(est.hover, false);
    est.hover = nombre;
    if (nombre) {
      pintar(nombre, true);
      if (tipEl) tipEl.innerHTML = `<strong>${nombre}</strong><br>${PARTES[nombre]}`;
    } else if (tipEl) tipEl.hidden = true;
    if (readoutEl) readoutEl.textContent = nombre ? `${nombre} — ${PARTES[nombre]}` : "Pasa el cursor por una parte del robot.";
  }
  function pintar(nombre, on) {
    const p = partes[nombre]; if (!p) return;
    p.meshes.forEach((m) => m.material.emissive?.setHex(on ? 0x4a4a4a : 0x000000));
    p.lineas.forEach((l) => (l.material.opacity = on ? 1 : 0.42));
  }

  // ---------- bucle ----------
  let ultimo = performance.now(), t = 0;
  const lerp = (a, b, k) => a + (b - a) * k;
  (function bucle() {
    requestAnimationFrame(bucle);
    const ahora = performance.now();
    const dt = Math.min((ahora - ultimo) / 1000, 0.05); ultimo = ahora;
    if (!est.visible || document.hidden) return;
    t += dt;
    const k = reduced ? 1 : 1 - Math.pow(0.0008, dt); // suavizado independiente de los fps

    // órbita con inercia y vuelta a la vista inicial
    if (!est.drag) {
      est.yaw += est.vel; est.vel *= Math.pow(0.9, dt * 60);
      if (est.resetVista) {
        const objetivo = Math.round(est.yaw / (Math.PI * 2)) * Math.PI * 2;
        est.yaw = lerp(est.yaw, objetivo, reduced ? 1 : 0.12); est.pitch = lerp(est.pitch, 0.12, reduced ? 1 : 0.12);
        if (Math.abs(est.yaw - objetivo) < 0.003) { est.yaw = objetivo; est.resetVista = false; }
      }
    } else est.resetVista = false;
    root.rotation.y = est.yaw + (est.auto && !reduced ? Math.sin(t * 0.35) * 0.18 : 0);

    // pose: interpolar articulaciones
    const P = POSES[est.pose]; est.poseT += dt;
    est.ls = [lerp(est.ls[0], P.ls[0], k), lerp(est.ls[1], P.ls[1], k)];
    est.rs = [lerp(est.rs[0], P.rs[0], k), lerp(est.rs[1], P.rs[1], k)];
    est.le = lerp(est.le, P.le, k); est.re = lerp(est.re, P.re, k);
    est.torso = lerp(est.torso, P.torso + (est.pose === "escaneo" && !reduced ? Math.sin(est.poseT * 1.6) * 0.25 : 0), k);
    izq.hombro.rotation.set(est.ls[0], 0, est.ls[1]); der.hombro.rotation.set(est.rs[0], 0, est.rs[1]);
    izq.codo.rotation.set(est.le, 0, est.pose === "saludo" && !reduced ? Math.sin(est.poseT * 7) * 0.45 : 0);
    der.codo.rotation.set(est.re, 0, 0);
    torso.rotation.y = est.torso;

    // cabeza y ojo siguen al puntero (solo si el robot mira hacia la cámara)
    const frente = Math.max(0, Math.cos(root.rotation.y));
    const objYaw = clamp(est.px * 0.8, -0.65, 0.65) * frente + P.head + (est.pose === "escaneo" && !reduced ? Math.sin(est.poseT * 1.6) * 0.5 : 0);
    const objPitch = clamp(est.py * 0.4, -0.3, 0.3) * frente;
    est.headYaw = lerp(est.headYaw, objYaw - est.torso, k); est.headPitch = lerp(est.headPitch, objPitch, k);
    cabeza.rotation.set(est.headPitch, est.headYaw, 0);
    est.eye = [lerp(est.eye[0], clamp(est.px, -1, 1) * 0.2 * frente, k), lerp(est.eye[1], clamp(-est.py, -1, 1) * 0.07 * frente, k)];
    ojo.position.set(est.eye[0], 0.46 + est.eye[1], 0.48);

    // reposo vivo: flotación, respiración y luz de estado
    if (!reduced) {
      bot.position.y = 0.18 + Math.sin(t * 1.3) * 0.05;
      torso.scale.y = 1 + Math.sin(t * 1.8) * 0.01;
      luz.scale.setScalar(0.75 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3)));
    }

    // cámara
    const e = est.pitch, d = est.dist;
    camera.position.set(0, 2.9 + Math.sin(e) * d * 0.55, Math.cos(e) * d);
    camera.lookAt(0, 2.75, 0);
    renderer.render(scene, camera);
  })();

  if (readoutEl) readoutEl.textContent = "Pasa el cursor por una parte del robot.";
}
