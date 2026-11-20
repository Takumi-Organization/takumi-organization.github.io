// Objeto principal: icosaedro facetado cuyos vértices se desplazan con ruido simplex 3D en el shader.
// Reacciona al puntero (bulto local), al clic (onda), al arrastre (giro) y a la velocidad de scroll.
import * as THREE from "three";

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = /* glsl */ `
uniform float uTime, uAmp, uPulse, uScroll, uPointerOn;
uniform vec2 uPointer;
uniform vec3 uAudio; // graves, medios, agudos (0 en silencio)
varying vec3 vWorld; varying float vDisp;
${NOISE}
void main(){
  vec3 p = position;
  float n  = snoise(p*1.25 + vec3(0., uTime*.22, uTime*.14));
  float n2 = snoise(p*3.0  - vec3(uTime*.30));
  float d = (n + n2*.35) * uAmp;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p,1.);
  float dist = distance(clip.xy/clip.w, uPointer);
  d += exp(-dist*dist*8.) * uPointerOn * .34;
  d += uPulse * .28 * snoise(p*3.6 + uTime*2.2);
  d += uScroll * .6 * n2;
  d += uAudio.x * .27 * (.55 + .45 * n);
  d += uAudio.y * .17 * snoise(p*2.2 + vec3(uTime*1.3));
  d += uAudio.z * .1 * snoise(p*6. + vec3(uTime*3.4));
  vec3 pos = p + normalize(p) * d;
  vDisp = d;
  vec4 w = modelMatrix * vec4(pos,1.);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
varying vec3 vWorld; varying float vDisp;
void main(){
  vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(nrm,V) < 0.) nrm = -nrm;
  vec3 L1 = normalize(vec3(-.6,.8,.7)), L2 = normalize(vec3(.8,-.3,.4));
  float diff = max(dot(nrm,L1),0.)*.7 + max(dot(nrm,L2),0.)*.3;
  float fres = pow(1. - max(dot(nrm,V),0.), 2.4);
  float spec = pow(max(dot(nrm, normalize(L1+V)),0.), 70.);
  float bands = .5 + .5*sin(vWorld.y*34. + vDisp*16.);
  float c = (diff*.5 + fres*.95 + spec*1.3) * (.84 + .16*bands);
  c = smoothstep(.03, 1., c);
  float cl = abs(fract(vDisp*12.) - .5);
  c += smoothstep(.465,.5,cl) * .1;
  gl_FragColor = vec4(vec3(c), 1.);
}`;

export function initBlob(canvas, reduced, audio) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    canvas.style.display = "none";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.z = 6;

  const small = window.innerWidth < 700;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 }, uAmp: { value: reduced ? 0.1 : 0.34 }, uPulse: { value: 0 }, uScroll: { value: 0 },
      uPointer: { value: new THREE.Vector2(9, 9) }, uPointerOn: { value: 0 }, uAudio: { value: new THREE.Vector3() },
    },
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, small ? 10 : 18), mat);
  scene.add(mesh);

  const st = { px: 9, py: 9, on: 0, targetOn: 0, rotX: 0.3, rotY: 0, velX: 0, velY: 0, drag: null, pulse: 0, scroll: 0, lastY: window.scrollY };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const ndc = (e) => [(e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1];
  const nearBlob = (x, y) => {
    const c = blobCenterNdc();
    return Math.hypot((x - c[0]) * camera.aspect, y - c[1]) < 0.62;
  };
  function blobCenterNdc() {
    const v = mesh.position.clone().project(camera);
    return [v.x, v.y];
  }
  const heroVisible = () => window.scrollY < window.innerHeight * 0.9;

  window.addEventListener("pointermove", (e) => {
    const [x, y] = ndc(e);
    st.px = x; st.py = y;
    st.targetOn = heroVisible() && nearBlob(x, y) ? 1 : 0;
    if (st.drag) {
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
      st.velY = dx * 0.006; st.velX = dy * 0.006;
      st.rotY += st.velY; st.rotX += st.velX;
      st.drag.x = e.clientX; st.drag.y = e.clientY; st.drag.moved += Math.abs(dx) + Math.abs(dy);
    }
  });
  window.addEventListener("pointerdown", (e) => {
    const [x, y] = ndc(e);
    if (heroVisible() && nearBlob(x, y)) st.drag = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  window.addEventListener("pointerup", () => {
    if (st.drag && st.drag.moved < 6 && !reduced) st.pulse = 1;
    st.drag = null;
  });
  window.addEventListener("pointerleave", () => { st.targetOn = 0; });

  let frame = 0, last = performance.now(), elapsed = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; elapsed += dt;
    const t = elapsed;
    const s = window.scrollY / window.innerHeight;
    frame++;
    if (s > 2.2 && frame % 6) return; // lejos del hero: casi en reposo

    const vel = (window.scrollY - st.lastY) / Math.max(dt, 0.001) / 1800;
    st.lastY = window.scrollY;
    st.scroll += (Math.min(Math.abs(vel), 1.4) - st.scroll) * 0.08;
    st.on += (st.targetOn - st.on) * 0.12;
    st.pulse *= 0.94;

    const u = mat.uniforms;
    u.uTime.value = t * (reduced ? 0.3 : 1);
    u.uPointer.value.set(st.px, st.py);
    u.uPointerOn.value = reduced ? 0 : st.on;
    u.uPulse.value = st.pulse;
    u.uScroll.value = reduced ? 0 : st.scroll;
    const au = audio ? audio.update() : null, ak = reduced ? 0.4 : 1; // con movimiento reducido, reacción más suave
    u.uAudio.value.set(au ? au.bass * ak : 0, au ? au.mid * ak : 0, au ? au.high * ak : 0);

    if (!st.drag) { st.velY *= 0.95; st.velX *= 0.95; st.rotY += st.velY + dt * (0.12 * (reduced ? 0.3 : 1) + (au ? au.mid * 0.5 * ak : 0)); st.rotX += st.velX; }
    st.rotX = Math.max(-1.1, Math.min(1.1, st.rotX));
    mesh.rotation.set(st.rotX, st.rotY, 0);

    const aspect = camera.aspect;
    const wide = aspect > 1.1;
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * aspect;
    const homeX = wide ? halfW * 0.56 : 0;
    const homeY = wide ? 0 : halfW * 0.1 + 0.5;
    const k = Math.min(s, 1);
    mesh.position.x = homeX * (1 - k * 0.55);
    mesh.position.y = homeY * (1 - k) - k * 0.2;
    const sc = (wide ? 0.86 : 0.74) * (1 - k * 0.35);
    mesh.scale.setScalar(sc);
    canvas.style.opacity = String(Math.max(0.1, (1 - s * 1.05) * (wide ? 1 : 0.4)));

    renderer.render(scene, camera);
  }
  tick();
}
