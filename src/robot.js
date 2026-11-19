// Takumi-bot (匠, «artesano»): humanoide esbelto de armadura japonesa abstracta, hecho con geometría procedural.
//
// PIEZAS Y PROPORCIONES (unidades de escena; el suelo está en y = 0; altura total ≈ 6,1, cresta aparte)
//   Cabeza ........ casco (kabuto) de ~0,85 de alto = 1/7 de la altura. Cúpula esférica, visor oscuro con ranura
//                   luminosa, mentonera de plata (menpō), carrilleras, visera (mabizashi), cubrenuca de 3 láminas
//                   (shikoro) y CRESTA cuya silueta es el tajo diagonal del logo Takumi (con filo luminoso).
//   Cuello ........ cilindro de junta con anillos de plata y 3 cables finos (tubos).
//   Torso ......... cintura estrecha (r ≈ 0,38) -> pecho en V (ancho ≈ 1,45) con placa pectoral de plata/grafito
//                   con chaflán diagonal (eco del logo) y un tajo emisivo; espalda con placa dorsal.
//   Hombros ....... articulación esférica + sode: cúpula + 3 láminas curvas superpuestas que envuelven el brazo.
//   Brazos ........ brazo 1,25 + antebrazo 1,20 + mano 0,35; perfiles de revolución (bíceps, brazalete), codo con
//                   holgura visible, muñeca esférica, mano con pulgar.
//   Cadera ........ bloque redondeado + cinturón de plata; faldón (kusazuri) de 8 láminas colgantes con péndulo.
//   Piernas ....... muslo 1,50 + espinilla 1,45 (perfil con pantorrilla), rodilla esférica con rodillera, pie extruido.
//   Suelo ......... disco oscuro mate, anillo fino luminoso y marcas de medición (precisión de artesano) + sombra.
//
// Animación: resortes críticamente amortiguados por articulación (suavizado natural entre poses), cinemática
// simple hombro-codo, piernas con pies plantados al agacharse, retardo secundario en cresta y faldón.
// Un solo renderer; solo dibuja con la sección visible; bloom sutil solo en lo emisivo (con retirada automática).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const PARTES = {
  Yelmo: "Kabuto de grafito con mentonera de plata y cubrenuca de tres láminas.",
  Cresta: "Su silueta recoge el tajo diagonal del logo de Takumi.",
  Visor: "Ranura luminosa: el punto brillante sigue tu puntero.",
  Cuello: "Junta con anillos de plata y cables finos.",
  Pectoral: "Placa con chaflán diagonal y un tajo luminoso, como el logo.",
  Torso: "Cintura estrecha y pecho en V, con espalda blindada.",
  "Hombrera izquierda": "Sode: cúpula y tres láminas superpuestas.",
  "Hombrera derecha": "Sode: cúpula y tres láminas superpuestas.",
  "Brazo izquierdo": "Hombro, codo y muñeca articulados.",
  "Brazo derecho": "Hombro, codo y muñeca articulados.",
  Faldón: "Ocho láminas colgantes que oscilan al moverse.",
  Piernas: "Cadera, rodillas y tobillos; los pies siguen plantados al agacharse.",
  Suelo: "Disco con anillo luminoso y marcas de medición.",
};

// ángulos objetivo por pose (radianes). l = brazo izquierdo (+x), r = derecho (−x).
// hip/knee: flexión simétrica de cadera/rodilla (agacharse). Rotación x negativa = hacia delante.
const POSES = {
  reposo: { lsx: -0.06, lsz: 0.13, lex: -0.22, rsx: -0.06, rsz: -0.13, rex: -0.22, torsoYaw: 0, lean: 0, head: 0, hip: 0.03, knee: 0.06, sway: 0 },
  saludo: { lsx: -0.15, lsz: 2.5, lex: -0.15, rsx: -0.08, rsz: -0.16, rex: -0.3, torsoYaw: 0.16, lean: -0.03, head: 0.18, hip: 0.03, knee: 0.06, sway: -0.06 },
  guardia: { lsx: -0.95, lsz: 0.42, lex: -1.75, rsx: -0.95, rsz: -0.42, rex: -1.75, torsoYaw: 0, lean: 0.14, head: 0, hip: 0.42, knee: 0.85, sway: 0 },
  escaneo: { lsx: 0.2, lsz: 0.3, lex: -0.25, rsx: -1.4, rsz: -0.18, rex: -0.12, torsoYaw: 0, lean: 0.02, head: 0, hip: 0.03, knee: 0.06, sway: 0 },
};
const ORDEN = ["saludo", "guardia", "escaneo", "reposo"];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const V2 = (arr) => arr.map(([x, y]) => new THREE.Vector2(x, y));
const suave = (pts, n = 28) => new THREE.SplineCurve(V2(pts)).getPoints(n);

// resorte amortiguado: x -> objetivo sin rebotes bruscos
class Resorte {
  constructor(x = 0, k = 60, z = 0.92) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = 2 * z * Math.sqrt(k); }
  paso(dt) {
    let r = dt;
    while (r > 0) { const h = Math.min(r, 1 / 120); this.v += (this.k * (this.t - this.x) - this.c * this.v) * h; this.x += this.v * h; r -= h; }
    return this.x;
  }
  fijar(x) { this.x = this.t = x; this.v = 0; }
}

export function initRobot(canvas, opts) {
  const { tipEl, readoutEl, chipsEl, reduced } = opts;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch {
    const aviso = Object.assign(document.createElement("p"), { className: "muted small", textContent: "Tu navegador no admite WebGL: no se puede mostrar el modelo 3D." });
    canvas.replaceWith(aviso);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x030303, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  { const sc = new THREE.Scene();
    sc.add(new THREE.Mesh(new THREE.BoxGeometry(40, 26, 40), new THREE.MeshBasicMaterial({ color: 0x040404, side: THREE.BackSide })));
    const luz = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 3, 0); sc.add(m); };
    luz(16, 2.4, 0, 11, 0, 9); luz(3.5, 14, -11, 4, 7, 6); luz(2.2, 14, 11, 4, -7, 8); luz(12, 2.2, 0, 1.5, 13, 0.7); luz(1.6, 10, 9, 3, 8, 2.4);
    scene.environment = pmrem.fromScene(sc, 0.015).texture; sc.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
  scene.environmentIntensity = 1.0;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-4.5, 9, 6);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 8, bottom: -3, near: 1, far: 30 });
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(6, 5, -7); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(5, 2, 6); scene.add(fill);

  // ---------- materiales ----------
  const armor = () => new THREE.MeshPhysicalMaterial({ color: 0x101113, metalness: 0.92, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
  const matte = () => new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.75, roughness: 0.52 });
  const cepillado = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "rgb(150,150,150)"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) { const v = 120 + Math.random() * 70; g.strokeStyle = `rgba(${v},${v},${v},.35)`; g.lineWidth = 1; const y = Math.random() * 256, x = Math.random() * 256, l = 30 + Math.random() * 160; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();
  const silver = () => new THREE.MeshPhysicalMaterial({ color: 0xb4b8bf, metalness: 1, roughness: 0.46, roughnessMap: cepillado, clearcoat: 0.25, clearcoatRoughness: 0.25 });
  const joint = () => new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 1, roughness: 0.38 });
  const rubber = () => new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0.1, roughness: 0.75 });
  const glow = (i = 3.4) => { const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: i, roughness: 1, metalness: 0 }); m.userData.esLuz = true; return m; };

  // ---------- utilidades de construcción ----------
  const root = new THREE.Group(); scene.add(root);
  const partes = {}; const pickables = [];
  function poner(padre, geo, mat, parte, x = 0, y = 0, z = 0, opt = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opt.rot) m.rotation.set(...opt.rot);
    if (opt.scale) m.scale.set(...opt.scale);
    m.castShadow = !opt.noShadow;
    padre.add(m);
    if (parte) {
      m.userData.parte = parte;
      (partes[parte] ||= []).push(m);
      pickables.push(m);
    }
    return m;
  }
  const rbox = (w, h, d, r = 0.05, seg = 5) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const esfera = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);
  const toro = (R, r, seg = 40) => new THREE.TorusGeometry(R, r, 14, seg);
  const lathe = (pts, seg = 28, a0 = 0, a1 = Math.PI * 2) => new THREE.LatheGeometry(V2(pts), seg, a0, a1);
  // lámina curva con grosor: sector de revolución cuyo perfil es un polígono cerrado
  const lamina = (r1, r2, h, grosor, a0, arco, seg = 24) => lathe([[r1, -h / 2], [r1 + grosor, -h / 2], [r2 + grosor, h / 2], [r2, h / 2], [r1, -h / 2]], seg, a0, arco);
  const extruir = (puntos, prof, bevel = 0.03) => {
    const s = new THREE.Shape(V2(puntos));
    const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -prof / 2); return g;
  };

  // ---------- suelo ----------
  const sueloG = new THREE.Group(); root.add(sueloG);
  const disco = poner(sueloG, new THREE.CylinderGeometry(5.2, 5.2, 0.12, 72), new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.45, roughness: 0.5 }), "Suelo", 0, -0.06, 0, { noShadow: true });
  disco.receiveShadow = true;
  const anillo = (R, w, i) => poner(sueloG, new THREE.RingGeometry(R, R + w, 96), glow(i), "Suelo", 0, 0.004, 0, { rot: [-Math.PI / 2, 0, 0], noShadow: true });
  anillo(2.55, 0.026, 3.0); anillo(3.35, 0.012, 1.0); anillo(4.2, 0.009, 0.55);
  const marcas = (n, largo, R, i) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.004, largo), glow(i), n);
    const d = new THREE.Object3D();
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; d.position.set(Math.sin(a) * R, 0.006, Math.cos(a) * R); d.rotation.set(0, a, 0); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }
    sueloG.add(im);
  };
  marcas(72, 0.1, 2.85, 0.7); marcas(12, 0.22, 2.85, 1.6);
  // sombra de contacto suave (mancha radial) además de la sombra proyectada
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  { const g = cv.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(0,0,0,.9)"); gr.addColorStop(0.55, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  mancha.rotation.x = -Math.PI / 2; mancha.position.y = 0.008; sueloG.add(mancha);

  // ---------- esqueleto ----------
  const bot = new THREE.Group(); root.add(bot);
  const HIP = 3.17, L1 = 1.5, L2 = 1.45, ANK = 0.22;
  const pelvis = new THREE.Group(); pelvis.position.y = HIP; bot.add(pelvis);

  // cadera: bloque, cinturón y faldón
  poner(pelvis, rbox(0.98, 0.36, 0.62, 0.14), armor(), "Faldón", 0, 0.05, 0);
  poner(pelvis, toro(0.52, 0.045, 48), silver(), "Faldón", 0, 0.24, 0, { rot: [Math.PI / 2, 0, 0], scale: [1, 0.64, 1] });
  poner(pelvis, rbox(0.3, 0.2, 0.08, 0.04), silver(), "Faldón", 0, 0.05, 0.33);
  const faldones = [];
  [[-72, 0.3, 0.55], [-42, 0.34, 0.62], [-14, 0.34, 0.66], [14, 0.34, 0.66], [42, 0.34, 0.62], [72, 0.3, 0.55], [155, 0.3, 0.5], [205, 0.3, 0.5]].forEach(([ang, ancho, largo], i) => {
    const a = (ang * Math.PI) / 180;
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 0.52, -0.1, Math.cos(a) * 0.43); g.rotation.y = a; pelvis.add(g);
    poner(g, rbox(ancho, largo, 0.045, 0.03, 4), i % 2 ? armor() : silver(), "Faldón", 0, -largo / 2, 0.02);
    poner(g, rbox(ancho * 0.7, 0.025, 0.05, 0.012, 3), silver(), "Faldón", 0, -largo + 0.04, 0.022);
    faldones.push({ g, sw: new Resorte(0, 30, 0.35), fase: i * 1.3 });
  });

  // torso (origen en la cintura)
  const torso = new THREE.Group(); torso.position.y = 0.52; pelvis.add(torso);
  poner(torso, new THREE.CylinderGeometry(0.36, 0.42, 0.62, 32), matte(), "Torso", 0, 0.2, 0, { scale: [1, 1, 0.68] });
  for (const y of [0.0, 0.17, 0.34]) poner(torso, toro(0.39 + (0.2 - y) * 0.06, 0.016, 40), silver(), "Torso", 0, y + 0.06, 0, { rot: [Math.PI / 2, 0, 0], scale: [1, 0.68, 1] });
  const pecho = new THREE.Group(); torso.add(pecho);
  poner(pecho, lathe(suave([[0.34, 0.0], [0.42, 0.22], [0.54, 0.52], [0.63, 0.86], [0.66, 1.1], [0.56, 1.27], [0.3, 1.37]], 30), 40), armor(), "Torso", 0, 0.02, 0, { scale: [1, 1, 0.8] });
  // placa pectoral con chaflán diagonal arriba a la derecha (eco del logo)
  poner(pecho, extruir([[-0.46, 0.84], [0.2, 0.84], [0.46, 0.56], [0.38, 0.12], [0.16, 0.0], [-0.16, 0.0], [-0.38, 0.12], [-0.46, 0.46]], 0.06, 0.03), silver(), "Pectoral", 0, 0.38, 0.52);
  poner(pecho, new THREE.BoxGeometry(0.78, 0.024, 0.02), glow(7), "Pectoral", -0.02, 0.62, 0.6, { rot: [0, 0, 0.84], noShadow: true });
  poner(pecho, rbox(0.7, 0.4, 0.14, 0.07), armor(), "Torso", 0, 0.8, -0.5);
  { const d = extruir([[-0.3, 0.82], [0.3, 0.82], [0.4, 0.46], [0.2, 0.0], [-0.2, 0.0], [-0.4, 0.46]], 0.05, 0.025); d.rotateY(Math.PI);
    poner(pecho, d, silver(), "Torso", 0, 0.3, -0.63);
    poner(pecho, new THREE.BoxGeometry(0.022, 0.74, 0.02), glow(2.0), "Torso", 0, 0.7, -0.7, { noShadow: true });
    for (const y of [0.52, 0.68, 0.84]) for (const sx of [-1, 1]) poner(pecho, new THREE.BoxGeometry(0.2, 0.016, 0.02), joint(), "Torso", sx * 0.16, y, -0.7, { noShadow: true }); }

  // cuello con cables
  poner(torso, new THREE.CylinderGeometry(0.12, 0.15, 0.3, 20), joint(), "Cuello", 0, 1.4, 0);
  for (const y of [1.34, 1.46]) poner(torso, toro(0.15, 0.022, 28), silver(), "Cuello", 0, y, 0, { rot: [Math.PI / 2, 0, 0] });
  for (const dx of [-0.14, 0, 0.14]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(dx * 1.5, 1.22, 0.12), new THREE.Vector3(dx * 1.2, 1.38, 0.2), new THREE.Vector3(dx * 0.9, 1.52, 0.17), new THREE.Vector3(dx * 0.7, 1.66, 0.1)]);
    poner(torso, new THREE.TubeGeometry(c, 20, 0.02, 8), rubber(), "Cuello", 0, 0, 0, { noShadow: true });
  }
  for (const dx of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(dx * 0.3, 0.55, 0.3), new THREE.Vector3(dx * 0.42, 0.3, 0.34), new THREE.Vector3(dx * 0.44, 0.08, 0.3), new THREE.Vector3(dx * 0.4, -0.12, 0.22)]);
    poner(torso, new THREE.TubeGeometry(c, 20, 0.022, 8), rubber(), "Torso", 0, 0, 0, { noShadow: true });
  }

  // cabeza
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.52, 0); torso.add(cabeza);
  const cr = new THREE.Group(); cr.position.set(0, 0.4, 0); cabeza.add(cr); // centro del casco
  poner(cr, esfera(0.44, 40, 28), armor(), "Yelmo", 0, 0.02, 0, { scale: [0.9, 1.04, 1.0] });
  // máscara angular (menpō) con mentonera en cuña; visor oscuro con ranura luminosa
  poner(cr, extruir([[-0.3, 0.16], [0.3, 0.16], [0.34, -0.02], [0.2, -0.3], [-0.2, -0.3], [-0.34, -0.02]], 0.12, 0.035), armor(), "Yelmo", 0, 0.0, 0.42);
  poner(cr, extruir([[-0.2, -0.1], [0.2, -0.1], [0.1, -0.3], [-0.1, -0.3]], 0.05, 0.022), silver(), "Yelmo", 0, -0.02, 0.5);
  poner(cr, rbox(0.7, 0.15, 0.1, 0.05, 5), joint(), "Visor", 0, 0.1, 0.48);
  const rendija = poner(cr, new RoundedBoxGeometry(0.56, 0.032, 0.02, 3, 0.012), glow(1.2), "Visor", 0, 0.1, 0.54, { noShadow: true });
  const puntoOjo = poner(cr, new RoundedBoxGeometry(0.14, 0.05, 0.024, 3, 0.012), glow(9), "Visor", 0, 0.1, 0.547, { noShadow: true });
  for (const sx of [-1, 1]) poner(cr, rbox(0.06, 0.34, 0.4, 0.03), matte(), "Yelmo", sx * 0.4, -0.05, 0.08, { rot: [0, sx * 0.1, 0] });
  poner(cr, rbox(0.7, 0.045, 0.34, 0.02, 4), silver(), "Yelmo", 0, 0.27, 0.3, { rot: [-0.3, 0, 0] }); // visera
  // cubrenuca: 3 láminas curvas escalonadas que arrancan bajo la cúpula
  [[0.45, 0.49, 0.15, -0.06], [0.48, 0.53, 0.14, -0.19], [0.51, 0.57, 0.13, -0.31]].forEach(([r1, r2, h, y], i) =>
    poner(cr, lamina(r1, r2, h, 0.03, Math.PI * 0.45, Math.PI * 1.1, 32), i % 2 ? matte() : armor(), "Yelmo", 0, y, -0.02, { rot: [-0.12, 0, 0] }));
  // cresta con filo luminoso: silueta del tajo diagonal del logo
  const crestaG = new THREE.Group(); crestaG.position.set(0, 0.4, 0); cr.add(crestaG);
  { const sh = new THREE.Shape();
    sh.moveTo(0.3, -0.12); sh.lineTo(0.3, 0.04); sh.quadraticCurveTo(0.27, 0.3, 0.05, 0.5); sh.lineTo(-0.5, 0.05); sh.lineTo(-0.52, -0.12); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -0.035); g.rotateY(-Math.PI / 2);
    poner(crestaG, g, silver(), "Cresta", 0, 0, 0);
    // filo luminoso a lo largo del tajo diagonal (eco del logo)
    const dz = -0.55, dy = -0.45, len = Math.hypot(dz, dy);
    poner(crestaG, new THREE.BoxGeometry(0.1, 0.014, len), glow(7), "Cresta", 0, 0.5 + dy * 0.5 - 0.035, 0.05 + dz * 0.5, { rot: [Math.atan2(dy, dz) - Math.PI / 2 + 0.0, 0, 0], noShadow: true });
    poner(cr, rbox(0.18, 0.07, 0.56, 0.03), silver(), "Cresta", 0, 0.45, -0.06); }

  // ---------- brazos ----------
  const brazos = {};
  function brazo(lado, nombreParte, nombreSode) {
    const s = lado; // +1 = izquierdo (+x)
    const hombro = new THREE.Group(); hombro.position.set(s * 0.96, 1.02, 0); torso.add(hombro);
    const codo = new THREE.Group(); codo.position.y = -1.25; hombro.add(codo);
    const muneca = new THREE.Group(); muneca.position.y = -1.2; codo.add(muneca);
    poner(hombro, esfera(0.21), joint(), nombreParte);
    poner(hombro, toro(0.2, 0.03, 32), silver(), nombreParte, 0, -0.05, 0, { rot: [Math.PI / 2, 0, 0] });
    poner(hombro, lathe(suave([[0.125, 0], [0.15, 0.3], [0.18, 0.75], [0.205, 1.1], [0.17, 1.2]], 22)), armor(), nombreParte, 0, -1.2, 0);
    poner(hombro, toro(0.17, 0.018, 28), silver(), nombreParte, 0, -0.78, 0, { rot: [Math.PI / 2, 0, 0] });
    poner(codo, esfera(0.15), joint(), nombreParte);
    poner(codo, toro(0.15, 0.02, 24), silver(), nombreParte, 0, 0, 0, { rot: [0, Math.PI / 2, 0] });
    poner(codo, lathe(suave([[0.095, 0], [0.115, 0.22], [0.185, 0.66], [0.165, 0.98], [0.135, 1.1]], 22)), armor(), nombreParte, 0, -1.12, 0);
    poner(codo, lamina(0.18, 0.2, 0.52, 0.03, -Math.PI * 0.42, Math.PI * 0.84, 24), silver(), nombreParte, 0, -0.62, 0);
    poner(codo, toro(0.135, 0.02, 24), silver(), nombreParte, 0, -0.3, 0, { rot: [Math.PI / 2, 0, 0] });
    poner(muneca, esfera(0.095), joint(), nombreParte);
    poner(muneca, rbox(0.21, 0.27, 0.1, 0.045), armor(), nombreParte, 0, -0.2, 0);
    poner(muneca, new THREE.CapsuleGeometry(0.03, 0.15, 6, 10), silver(), nombreParte, s * 0.13, -0.17, 0.02, { rot: [0, 0, s * -0.3] });
    for (let i = 0; i < 3; i++) poner(muneca, new THREE.CapsuleGeometry(0.022, 0.12, 5, 8), silver(), nombreParte, (i - 1) * 0.06, -0.39, 0);
    // sode: cúpula + 3 láminas curvas superpuestas (siguen parcialmente al brazo)
    const sode = new THREE.Group(); sode.position.set(s * 0.96, 1.02, 0); torso.add(sode);
    const arco = Math.PI * 0.82, a0 = (s > 0 ? Math.PI / 2 : (3 * Math.PI) / 2) - arco / 2;
    poner(sode, new THREE.SphereGeometry(0.27, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), silver(), nombreSode, 0, 0.03, 0, { scale: [1.12, 0.7, 1.12] });
    [[0.27, 0.285, 0.26, -0.1, armor], [0.285, 0.305, 0.26, -0.27, silver], [0.3, 0.325, 0.24, -0.43, armor]].forEach(([r1, r2, h, y, m]) =>
      poner(sode, lamina(r1, r2, h, 0.035, a0, arco, 28), m(), nombreSode, 0, y, 0));
    poner(sode, toro(0.3, 0.014, 32), silver(), nombreSode, 0, 0.0, 0, { rot: [Math.PI / 2, 0, 0] });
    brazos[s] = { hombro, codo, muneca, sode };
  }
  brazo(1, "Brazo izquierdo", "Hombrera izquierda");
  brazo(-1, "Brazo derecho", "Hombrera derecha");

  // ---------- piernas ----------
  const piernas = [];
  function pierna(s) {
    const cadera = new THREE.Group(); cadera.position.set(s * 0.33, -0.12, 0); pelvis.add(cadera);
    const rodilla = new THREE.Group(); rodilla.position.y = -L1; cadera.add(rodilla);
    const tobillo = new THREE.Group(); tobillo.position.y = -L2; rodilla.add(tobillo);
    poner(cadera, esfera(0.22), joint(), "Piernas");
    poner(cadera, lathe(suave([[0.2, 0], [0.22, 0.25], [0.285, 0.75], [0.31, 1.15], [0.285, 1.42], [0.2, 1.5]], 24)), armor(), "Piernas", 0, -L1, 0);
    poner(cadera, lamina(0.29, 0.31, 0.7, 0.035, -Math.PI * 0.25, Math.PI * 0.5, 24), silver(), "Piernas", 0, -0.78, 0);
    poner(rodilla, esfera(0.215), joint(), "Piernas");
    poner(rodilla, toro(0.2, 0.026, 28), silver(), "Piernas", 0, 0, 0, { rot: [0, Math.PI / 2, 0] });
    poner(rodilla, extruir([[0, 0.2], [0.18, 0], [0, -0.2], [-0.18, 0]], 0.06, 0.03), silver(), "Piernas", 0, 0.02, 0.24, { rot: [0.1, 0, 0] });
    poner(rodilla, lathe(suave([[0.115, 0], [0.145, 0.22], [0.2, 0.62], [0.245, 1.0], [0.205, 1.36], [0.16, 1.45]], 24)), armor(), "Piernas", 0, -L2, 0);
    poner(rodilla, lamina(0.215, 0.245, 0.85, 0.03, -Math.PI * 0.23, Math.PI * 0.46, 24), silver(), "Piernas", 0, -0.75, 0);
    poner(tobillo, esfera(0.14), joint(), "Piernas");
    poner(tobillo, toro(0.135, 0.022, 24), silver(), "Piernas", 0, 0.05, 0, { rot: [Math.PI / 2, 0, 0] });
    // pie: silueta lateral extruida
    const pie = extruir([[-0.28, -0.22], [0.5, -0.22], [0.58, -0.17], [0.55, -0.1], [0.2, -0.02], [-0.1, 0.02], [-0.26, -0.02]], 0.26, 0.035);
    pie.rotateY(-Math.PI / 2);
    poner(tobillo, pie, armor(), "Piernas", 0, 0, 0);
    poner(tobillo, rbox(0.3, 0.05, 0.64, 0.02), silver(), "Piernas", 0, -0.215, 0.12);
    piernas.push({ cadera, rodilla, tobillo });
  }
  pierna(1); pierna(-1);

  // ---------- estado ----------
  const est = {
    yaw: 0, vel: 0, pitch: 0.1, drag: null, hover: null, visible: false, auto: !reduced, resetVista: false,
    pose: "reposo", poseT: 0, px: 0, py: 0, t: 0, blink: 3, frames: 0, acum: 0, bloom: false, dist: 14,
  };
  const S = {};
  for (const k of ["lsx", "lsz", "lex", "rsx", "rsz", "rex", "torsoYaw", "lean", "head", "hip", "knee", "sway"]) S[k] = new Resorte(POSES.reposo[k], 70);
  const Sc = { headYaw: new Resorte(0, 55), headPitch: new Resorte(0, 55), ojoX: new Resorte(0, 120, 0.8), cresta: new Resorte(0, 22, 0.3), crestaZ: new Resorte(0, 22, 0.3) };

  function aplicarPose(nombre, instantaneo = false) {
    const P = POSES[nombre];
    for (const k in S) { S[k].t = P[k]; if (instantaneo) S[k].fijar(P[k]); }
  }
  function ponerPose(nombre) {
    est.pose = nombre; est.poseT = 0; aplicarPose(nombre, reduced);
    chipsEl?.querySelectorAll("button[data-pose]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.pose === nombre));
  }
  chipsEl?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pose) ponerPose(b.dataset.pose);
    if (b.dataset.vista) est.resetVista = true;
  });

  // ---------- postproceso (bloom sutil solo en lo emisivo) ----------
  let composer = null;
  function montarBloom() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.32, 3.8));
    composer.addPass(new OutputPass());
    est.bloom = true;
    resize();
  }

  // ---------- tamaño y visibilidad ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const alto = 7.7, ancho = 5.9, t = Math.tan((camera.fov * Math.PI) / 360);
    est.dist = Math.max(alto / 2 / t, ancho / 2 / (t * camera.aspect)) * 1.02;
  }
  new ResizeObserver(resize).observe(canvas); resize();
  new IntersectionObserver(([e]) => { est.visible = e.isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  if (!reduced) montarBloom();

  // ---------- puntero ----------
  const rayo = new THREE.Raycaster(), m2 = new THREE.Vector2();
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    est.px = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
    est.py = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5), -1, 1);
  }, { passive: true });
  const ndc = (e) => { const r = canvas.getBoundingClientRect(); m2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); rayo.setFromCamera(m2, camera); return r; };

  canvas.addEventListener("pointerdown", (e) => { est.drag = { x: e.clientX, y: e.clientY, mov: 0, ult: performance.now() }; est.auto = false; est.vel = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (est.drag) {
      const dx = e.clientX - est.drag.x, dy = e.clientY - est.drag.y;
      est.yaw += dx * 0.009; est.vel = dx * 0.009; est.drag.ult = performance.now();
      est.pitch = clamp(est.pitch + dy * 0.004, -0.05, 0.5);
      est.drag.x = e.clientX; est.drag.y = e.clientY; est.drag.mov += Math.abs(dx) + Math.abs(dy);
      setHover(null); return;
    }
    const r = ndc(e);
    const hit = rayo.intersectObjects(pickables, false)[0];
    setHover(hit ? hit.object.userData.parte : null);
    if (hit && tipEl) { tipEl.hidden = false; tipEl.style.left = Math.min(e.clientX - r.left + 14, r.width - 170) + "px"; tipEl.style.top = e.clientY - r.top + 14 + "px"; }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (est.drag) {
      if (performance.now() - est.drag.ult > 90) est.vel = 0; // soltar quieto = sin impulso
      if (est.drag.mov < 6) { ndc(e); if (rayo.intersectObjects(pickables, false).some((h) => h.object.userData.parte !== "Suelo")) ponerPose(ORDEN[(ORDEN.indexOf(est.pose) + 1) % ORDEN.length]); }
    }
    est.drag = null;
  });
  canvas.addEventListener("pointercancel", () => { est.drag = null; });
  canvas.addEventListener("pointerleave", () => { if (!est.drag) setHover(null); });

  // resaltado: emisivo suave + contorno fino (se crea al pasar el cursor por primera vez)
  function setHover(nombre) {
    if (nombre === est.hover) return;
    if (est.hover) resaltar(est.hover, false);
    est.hover = nombre;
    if (nombre) { resaltar(nombre, true); if (tipEl) tipEl.innerHTML = `<strong>${nombre}</strong><br>${PARTES[nombre]}`; }
    else if (tipEl) tipEl.hidden = true;
    if (readoutEl) readoutEl.textContent = nombre ? `${nombre} — ${PARTES[nombre]}` : "Pasa el cursor por una parte del robot.";
  }
  function resaltar(nombre, on) {
    for (const m of partes[nombre] || []) {
      const mt = m.material;
      if (mt.userData.base === undefined) mt.userData.base = mt.emissive.clone();
      if (!mt.userData.esLuz) { if (on) mt.emissive.setRGB(0.2, 0.2, 0.22); else mt.emissive.copy(mt.userData.base); }
      if (on && !m.userData.borde && !mt.userData.esLuz) {
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 38), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
        m.add(l); m.userData.borde = l;
      }
      if (m.userData.borde) m.userData.borde.visible = on;
    }
  }

  // ---------- bucle ----------
  function actualizar(dt) {
    est.t += dt; est.poseT += dt;
    const t = est.t;
    if (!est.drag) {
      est.yaw += est.vel; est.vel *= Math.pow(0.9, dt * 60);
      if (est.resetVista) {
        const obj = Math.round(est.yaw / (Math.PI * 2)) * Math.PI * 2;
        est.yaw = lerp(est.yaw, obj, reduced ? 1 : 0.12); est.pitch = lerp(est.pitch, 0.1, reduced ? 1 : 0.12);
        if (Math.abs(est.yaw - obj) < 0.003) { est.yaw = obj; est.resetVista = false; }
      }
    } else est.resetVista = false;
    root.rotation.y = est.yaw + (est.auto && !reduced ? Math.sin(t * 0.35) * 0.14 : 0);

    const P = POSES[est.pose];
    const sweep = est.pose === "escaneo" && !reduced ? Math.sin(est.poseT * 1.5) : 0;
    S.torsoYaw.t = P.torsoYaw + sweep * 0.3;
    for (const k in S) S[k].paso(dt);
    const hip = S.hip.x, knee = S.knee.x, phi = knee - hip;
    // pies plantados: altura y avance de la pelvis según la flexión de cadera y rodilla
    pelvis.position.y = L1 * Math.cos(hip) + L2 * Math.cos(phi) + ANK;
    pelvis.position.z = -(L1 * Math.sin(hip) - L2 * Math.sin(phi));
    pelvis.position.x = S.sway.x + (reduced ? 0 : Math.sin(t * 0.6) * 0.025);
    for (const p of piernas) { p.cadera.rotation.x = -hip; p.rodilla.rotation.x = knee; p.tobillo.rotation.x = hip - knee; }
    const resp = reduced ? 0 : Math.sin(t * 1.7);
    torso.rotation.set(S.lean.x + resp * 0.006, S.torsoYaw.x, 0);
    pecho.scale.set(1 + resp * 0.006, 1 + resp * 0.012, 1 + resp * 0.012);
    const L = brazos[1], R = brazos[-1];
    L.hombro.rotation.set(S.lsx.x, 0, S.lsz.x + resp * 0.006); R.hombro.rotation.set(S.rsx.x, 0, S.rsz.x - resp * 0.006);
    const wave = est.pose === "saludo" && !reduced ? Math.sin(est.poseT * 7.5) * 0.42 * Math.min(est.poseT * 2, 1) : 0;
    L.codo.rotation.set(S.lex.x, 0, wave); R.codo.rotation.set(S.rex.x, 0, 0);
    L.muneca.rotation.set(0, 0, wave * 0.5);
    L.sode.rotation.set(S.lsx.x * 0.22, 0, Math.min(S.lsz.x, 1.5) * 0.32); R.sode.rotation.set(S.rsx.x * 0.22, 0, Math.max(S.rsz.x, -1.5) * 0.32);

    const frente = Math.max(0, Math.cos(root.rotation.y));
    Sc.headYaw.t = clamp(est.px * 0.9, -0.7, 0.7) * frente + P.head + sweep * 0.55 - S.torsoYaw.x * 0.5;
    Sc.headPitch.t = clamp(est.py * 0.45, -0.3, 0.3) * frente - S.lean.x * 0.6;
    Sc.headYaw.paso(dt); Sc.headPitch.paso(dt);
    cabeza.rotation.set(Sc.headPitch.x, Sc.headYaw.x, 0);
    Sc.ojoX.t = clamp(est.px, -1, 1) * 0.2 * frente + sweep * 0.2; Sc.ojoX.paso(dt);
    puntoOjo.position.x = Sc.ojoX.x;
    est.blink -= dt; let bl = 1;
    if (!reduced) { if (est.blink < 0) est.blink = 3 + Math.random() * 3; if (est.blink < 0.14) bl = 0.15 + Math.abs(est.blink - 0.07) * 12; }
    puntoOjo.scale.y = bl; rendija.material.emissiveIntensity = (reduced ? 1.2 : 1.1 + 0.25 * Math.sin(t * 2.4)) * (0.4 + 0.6 * bl);
    Sc.cresta.t = -Sc.headPitch.v * 0.06 - torso.rotation.x * 0.5 + (reduced ? 0 : Math.sin(t * 1.3) * 0.015);
    Sc.crestaZ.t = Sc.headYaw.v * 0.05;
    Sc.cresta.paso(dt); Sc.crestaZ.paso(dt);
    crestaG.rotation.set(Sc.cresta.x, 0, Sc.crestaZ.x);
    const impulso = -(pelvis.position.z * 0.1);
    for (const f of faldones) { f.sw.t = impulso + (reduced ? 0 : Math.sin(t * 1.4 + f.fase) * 0.035); f.sw.paso(dt); f.g.rotation.x = f.sw.x; }

    const d = est.dist, e = est.pitch;
    camera.position.set(0, 3.35 + Math.sin(e) * d * 0.6, Math.cos(e) * d);
    camera.lookAt(0, 3.25, 0);
  }

  let ultimo = performance.now();
  (function bucle() {
    requestAnimationFrame(bucle);
    const ahora = performance.now();
    const dt = Math.min((ahora - ultimo) / 1000, 0.05); ultimo = ahora;
    if (!est.visible || document.hidden) return;
    actualizar(dt);
    if (est.bloom && composer) composer.render(dt); else renderer.render(scene, camera);
    // si va lento, retirar el bloom y bajar la resolución (una sola vez)
    est.frames++; est.acum += dt;
    if (est.frames === 60) {
      if (est.acum / 60 > 0.034 && est.bloom) { est.bloom = false; composer?.dispose(); composer = null; renderer.setPixelRatio(1); resize(); }
      est.frames = 0; est.acum = 0;
    }
  })();

  aplicarPose("reposo", true);
  if (readoutEl) readoutEl.textContent = "Pasa el cursor por una parte del robot.";
}
