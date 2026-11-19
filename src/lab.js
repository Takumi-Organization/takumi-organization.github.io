// Red neuronal 2 → h → h → 2 (tanh + softmax) con retropropagación y Adam, entrenada en el navegador.
const rng = (() => { let s = 1234567; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

function dataset(kind) {
  const pts = [];
  const add = (x, y, c) => pts.push({ x, y, c });
  if (kind === "spiral") {
    for (let c = 0; c < 2; c++) for (let i = 0; i < 130; i++) {
      const r = (i / 130) * 0.92 + 0.04, t = (i / 130) * 2.6 * Math.PI + c * Math.PI + gauss() * 0.07;
      add(r * Math.sin(t), r * Math.cos(t), c);
    }
  } else if (kind === "circles") {
    for (let i = 0; i < 130; i++) { const a = rng() * 2 * Math.PI, r = Math.sqrt(rng()) * 0.42; add(r * Math.cos(a) + gauss() * 0.02, r * Math.sin(a) + gauss() * 0.02, 0); }
    for (let i = 0; i < 130; i++) { const a = rng() * 2 * Math.PI, r = 0.7 + rng() * 0.25; add(r * Math.cos(a), r * Math.sin(a), 1); }
  } else if (kind === "moons") {
    for (let i = 0; i < 130; i++) { const a = rng() * Math.PI; add(0.6 * Math.cos(a) - 0.3 + gauss() * 0.06, 0.6 * Math.sin(a) - 0.15 + gauss() * 0.06, 0); }
    for (let i = 0; i < 130; i++) { const a = rng() * Math.PI; add(0.6 * (1 - Math.cos(a)) - 0.3 + gauss() * 0.06, 0.6 * (0.5 - Math.sin(a)) - 0.15 + gauss() * 0.06, 1); }
  } else {
    while (pts.length < 260) { const x = rng() * 2 - 1, y = rng() * 2 - 1; if (Math.abs(x) < 0.09 || Math.abs(y) < 0.09) continue; add(x * 0.95, y * 0.95, (x > 0) !== (y > 0) ? 1 : 0); }
  }
  return pts;
}

class Net {
  constructor(sizes) {
    this.sizes = sizes; this.t = 0;
    const L = sizes.length - 1;
    this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = [];
    for (let l = 0; l < L; l++) {
      const i = sizes[l], o = sizes[l + 1], s = Math.sqrt(2 / (i + o));
      this.W.push(Float64Array.from({ length: o * i }, () => gauss() * s));
      this.b.push(new Float64Array(o));
      this.mW.push(new Float64Array(o * i)); this.vW.push(new Float64Array(o * i));
      this.mb.push(new Float64Array(o)); this.vb.push(new Float64Array(o));
    }
  }
  forward(x) {
    const L = this.W.length, acts = [x];
    for (let l = 0; l < L; l++) {
      const i = this.sizes[l], o = this.sizes[l + 1], a = acts[l], z = new Float64Array(o);
      for (let j = 0; j < o; j++) { let s = this.b[l][j]; for (let k = 0; k < i; k++) s += this.W[l][j * i + k] * a[k]; z[j] = s; }
      if (l < L - 1) for (let j = 0; j < o; j++) z[j] = Math.tanh(z[j]);
      else { const m = Math.max(...z); let sum = 0; for (let j = 0; j < o; j++) { z[j] = Math.exp(z[j] - m); sum += z[j]; } for (let j = 0; j < o; j++) z[j] /= sum; }
      acts.push(z);
    }
    return acts;
  }
  step(xs, ys, lr) {
    const L = this.W.length;
    const gW = this.W.map((w) => new Float64Array(w.length)), gb = this.b.map((b) => new Float64Array(b.length));
    for (let n = 0; n < xs.length; n++) {
      const acts = this.forward(xs[n]);
      let delta = Float64Array.from(acts[L]); delta[ys[n]] -= 1;
      for (let l = L - 1; l >= 0; l--) {
        const i = this.sizes[l], o = this.sizes[l + 1], a = acts[l];
        for (let j = 0; j < o; j++) { gb[l][j] += delta[j]; for (let k = 0; k < i; k++) gW[l][j * i + k] += delta[j] * a[k]; }
        if (l > 0) {
          const nd = new Float64Array(i);
          for (let k = 0; k < i; k++) { let s = 0; for (let j = 0; j < o; j++) s += this.W[l][j * i + k] * delta[j]; nd[k] = s * (1 - a[k] * a[k]); }
          delta = nd;
        }
      }
    }
    this.t++;
    const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** this.t, c2 = 1 - b2 ** this.t, inv = 1 / xs.length;
    const upd = (p, g, m, v) => { for (let q = 0; q < p.length; q++) { const gr = g[q] * inv; m[q] = b1 * m[q] + (1 - b1) * gr; v[q] = b2 * v[q] + (1 - b2) * gr * gr; p[q] -= (lr * (m[q] / c1)) / (Math.sqrt(v[q] / c2) + 1e-8); } };
    for (let l = 0; l < L; l++) { upd(this.W[l], gW[l], this.mW[l], this.vW[l]); upd(this.b[l], gb[l], this.mb[l], this.vb[l]); }
  }
  prob1(x, y) { return this.forward([x, y])[this.W.length][1]; }
}

export function initLab() {
  const $ = (id) => document.getElementById(id);
  const cv = $("lab-canvas"), lossCv = $("loss-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d"), lctx = lossCv.getContext("2d");
  const G = 56, off = document.createElement("canvas"); off.width = off.height = G;
  const octx = off.getContext("2d"), img = octx.createImageData(G, G);

  let pts, net, order, cursor, epoch, running = true, losses, lr = 0.03, frame = 0;
  const st = { loss: NaN, acc: NaN };

  function reset() {
    pts = dataset($("lab-data").value);
    const h = Number($("lab-h").value);
    net = new Net([2, h, h, 2]);
    order = pts.map((_, i) => i); cursor = order.length; epoch = 0; losses = [];
  }
  function shuffle() { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } cursor = 0; }
  function trainOnce() {
    if (cursor >= order.length) { shuffle(); epoch++; }
    const idx = order.slice(cursor, cursor + 32); cursor += 32;
    net.step(idx.map((i) => [pts[i].x, pts[i].y]), idx.map((i) => pts[i].c), lr);
  }
  function metrics() {
    let loss = 0, ok = 0;
    for (const p of pts) { const pr = net.forward([p.x, p.y]).at(-1); loss -= Math.log(Math.max(pr[p.c], 1e-12)); if ((pr[1] > 0.5 ? 1 : 0) === p.c) ok++; }
    st.loss = loss / pts.length; st.acc = ok / pts.length;
    losses.push(st.loss); if (losses.length > 240) losses.shift();
    $("m-epoch").textContent = epoch; $("m-loss").textContent = st.loss.toFixed(3); $("m-acc").textContent = Math.round(st.acc * 100) + "%";
  }
  function draw() {
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const p = net.prob1((gx / (G - 1)) * 2.2 - 1.1, 1.1 - (gy / (G - 1)) * 2.2), v = Math.round(10 + p * 215), o = (gy * G + gx) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
    for (const p of pts) {
      const x = ((p.x + 1.1) / 2.2) * cv.width, y = ((1.1 - p.y) / 2.2) * cv.height;
      ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7);
      ctx.fillStyle = p.c ? "#fff" : "#000"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = p.c ? "#000" : "#fff"; ctx.stroke();
    }
    lctx.clearRect(0, 0, lossCv.width, lossCv.height);
    lctx.strokeStyle = "#2a2a2a"; lctx.strokeRect(0.5, 0.5, lossCv.width - 1, lossCv.height - 1);
    if (losses.length > 1) {
      const max = Math.max(...losses, 0.7);
      lctx.beginPath();
      losses.forEach((v, i) => { const x = (i / (losses.length - 1)) * (lossCv.width - 8) + 4, y = lossCv.height - 6 - (v / max) * (lossCv.height - 12); i ? lctx.lineTo(x, y) : lctx.moveTo(x, y); });
      lctx.strokeStyle = "#f2f2f2"; lctx.lineWidth = 1.5; lctx.stroke();
    }
  }

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 }).observe(cv);
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    frame++;
    if (running) { for (let i = 0; i < 8; i++) trainOnce(); if (frame % 6 === 0) metrics(); }
    if (frame % 3 === 0) draw();
  })();

  $("lab-data").addEventListener("change", reset);
  $("lab-h").addEventListener("input", (e) => { $("out-h").textContent = e.target.value; reset(); });
  $("lab-lr").addEventListener("input", (e) => { lr = Number(e.target.value); $("out-lr").textContent = lr; });
  $("lab-reset").addEventListener("click", reset);
  $("lab-run").addEventListener("click", (e) => { running = !running; e.target.textContent = running ? "Pausar" : "Continuar"; });
  reset();
  // para pruebas automáticas
  window.__lab = { get acc() { return st.acc; }, get loss() { return st.loss; }, get epoch() { return epoch; } };
}
