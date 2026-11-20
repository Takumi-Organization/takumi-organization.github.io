// Audio -> bandas (graves, medios, agudos) para que el objeto del hero reaccione a lo que suene.
// Orden de preferencia de la fuente (cualquier app que suene: Spotify, vídeo, juego…):
//  1. "monitores" de la salida de audio, que Firefox/Nivora y algunos Chromium en Linux listan como entradas
//     («Monitor of …», «Mezcla estéreo»): captan todo lo que suena sin depender de altavoces ni de una pestaña;
//  2. el micrófono, que solo oye lo que sale por altavoces.
// Hace falta el permiso de audio del navegador. El análisis es local (AnalyserNode): no se graba ni sale nada.
const SUELO_BASE = 0.15, MARGEN = 0.06, RANGO = 0.45; // puerta de ruido sobre la escala 0..1 del analizador

export function createAudio() {
  let ctx = null, analyser = null, streams = [], datos = null, onChange = () => {};
  let suelo = SUELO_BASE;
  const out = { bass: 0, mid: 0, high: 0, nivel: 0, activo: false, origen: "" };
  const MONITOR = /^monitor (of|de)\b|mezcla est[eé]reo|stereo mix|what u hear|loopback/i;
  const SIN_PROCESAR = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

  const puerta = (v) => Math.min(1, Math.max(0, (v - Math.max(suelo, SUELO_BASE) - MARGEN) / RANGO));
  // mezcla de media y pico: la media sola diluye un instrumento aislado dentro de una banda ancha
  const media = (a, b) => { let s = 0, mx = 0; for (let i = a; i < b; i++) { s += datos[i]; if (datos[i] > mx) mx = datos[i]; } return (0.4 * (s / (b - a)) + 0.6 * mx) / 255; };

  // fuente "auto": monitores de la salida si el navegador los lista, si no micrófono; "sistema": compartir pestaña/pantalla
  async function start(fuente = "auto") {
    if (out.activo) return;
    const md = navigator.mediaDevices;
    if (fuente === "sistema") {
      if (!md?.getDisplayMedia) throw new Error("sin-api");
      const s = await md.getDisplayMedia({ video: true, audio: SIN_PROCESAR });
      s.getVideoTracks().forEach((t) => t.stop()); // el vídeo no se usa: solo se queda el audio
      if (!s.getAudioTracks().length) { s.getTracks().forEach((t) => t.stop()); throw new Error("sin-audio"); }
      streams = [new MediaStream(s.getAudioTracks())]; out.origen = "pestaña o pantalla compartida";
    } else {
      if (!md?.getUserMedia) throw new Error("sin-api");
      const sonda = await md.getUserMedia({ audio: SIN_PROCESAR }); // concede el permiso y desbloquea los nombres de dispositivo
      const monitores = (await md.enumerateDevices()).filter((d) => d.kind === "audioinput" && MONITOR.test(d.label));
      if (monitores.length) {
        try {
          streams = await Promise.all(monitores.map((d) => md.getUserMedia({ audio: { ...SIN_PROCESAR, deviceId: { exact: d.deviceId } } })));
          sonda.getTracks().forEach((t) => t.stop()); out.origen = "salida de audio del sistema";
        } catch { streams = [sonda]; out.origen = "micrófono"; }
      } else { streams = [sonda]; out.origen = "micrófono"; }
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6; analyser.minDecibels = -90; analyser.maxDecibels = -20;
    streams.forEach((st) => { ctx.createMediaStreamSource(st).connect(analyser); st.getAudioTracks()[0]?.addEventListener("ended", stop); }); // varias fuentes se suman; sin destination: no se reproduce nada
    datos = new Uint8Array(analyser.frequencyBinCount);
    suelo = SUELO_BASE; out.activo = true; onChange(true);
  }

  function stop() {
    streams.forEach((st) => st.getTracks().forEach((t) => t.stop())); streams = [];
    ctx?.close().catch(() => {});
    ctx = analyser = null; out.bass = out.mid = out.high = out.nivel = 0;
    if (out.activo) { out.activo = false; onChange(false); }
  }

  // se llama en cada fotograma; con bins de ~47 Hz: graves 47-235 Hz, medios 235 Hz-1,9 kHz, agudos 1,9-9,4 kHz
  function update() {
    if (!out.activo) return out;
    analyser.getByteFrequencyData(datos);
    const b = media(1, 6), m = media(6, 41), h = media(41, 200);
    const total = (b + m + h) / 3;
    suelo = total < suelo ? total : Math.min(0.3, suelo + 0.0004); // el suelo baja al instante y sube muy despacio
    const k = (t, v) => v + (t - v) * (t > v ? 0.55 : 0.09); // ataque rápido, caída lenta
    out.nivel = total; // nivel de entrada sin puerta, para el indicador
    out.bass = k(puerta(b), out.bass); out.mid = k(puerta(m), out.mid); out.high = k(puerta(h), out.high);
    return out;
  }

  return { start, stop, update, state: out, onChange: (f) => { onChange = f; } };
}
