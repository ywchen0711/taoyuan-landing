// Sound: the engines (a roar and a whine that follow N1), the wind past the windows, rain, the gear, the flaps,
// the touchdown and the tyres, reversers, and the voices: the automatic callouts ("one thousand", "fifty, forty,
// thirty..."), ground-proximity warnings, and Taipei Tower on the radio.
let A = null, out = null, eng = null, wind = null, rainG = null, nb = null, muted = false;
export function audioInit() {
  if (A) { if (A.state === 'suspended') A.resume(); return; }
  try {
    A = new (window.AudioContext || window.webkitAudioContext)(); out = A.createGain(); out.gain.value = 0.7; out.connect(A.destination);
    nb = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = nb.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 4; }
    const loop = (f, q, type = 'bandpass') => { const s = A.createBufferSource(); s.buffer = nb; s.loop = true; const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = A.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(out); s.start(); return { s, fl, g }; };
    eng = loop(300, 0.7, 'lowpass'); const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900; const og = A.createGain(); og.gain.value = 0; const of = A.createBiquadFilter(); of.type = 'bandpass'; of.frequency.value = 2000; of.Q.value = 4; o.connect(of); of.connect(og); og.connect(out); o.start(); eng.whine = { o, og };
    wind = loop(800, 0.5); rainG = loop(4000, 0.4, 'highpass');
  } catch (e) { A = null; }
}
export function setMute(v) { muted = v; if (out) out.gain.value = v ? 0 : 0.7; }
export const isMuted = () => muted;
// every frame: n1 0..1, airspeed (m/s), inside the cockpit or not, rain, reverse
export function engineSound({ n1, ias, inside, rain, rev, ground }) {
  if (!A) return; const t = A.currentTime, k = inside ? 0.45 : 1;
  eng.g.gain.setTargetAtTime((0.05 + 0.4 * n1 * n1 + (rev ? 0.25 : 0)) * k, t, 0.15); eng.fl.frequency.setTargetAtTime(200 + n1 * 900 + (rev ? 400 : 0), t, 0.2);
  eng.whine.og.gain.setTargetAtTime(0.012 + 0.03 * n1 * k, t, 0.2); eng.whine.o.frequency.setTargetAtTime(500 + n1 * 2400, t, 0.3);
  wind.g.gain.setTargetAtTime(Math.min(0.35, ias / 300) * (inside ? 0.8 : 0.5) + (ground ? 0.05 : 0), t, 0.2); wind.fl.frequency.setTargetAtTime(400 + ias * 6, t, 0.3);
  rainG.g.gain.setTargetAtTime(rain ? 0.12 : 0, t, 0.5);
}
function tone(f, t, d, v = 0.15, type = 'sine', to) { const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05); }
function burst(t, d, v, f, type = 'lowpass') { const s = A.createBufferSource(); s.buffer = nb; const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = A.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + d + 0.05); }
export function sfx(name, v = 1) {
  if (!A) return; const t = A.currentTime + 0.01;
  switch (name) {
    case 'gear': burst(t, 0.6, 0.35, 300); tone(70, t, 0.4, 0.2, 'sine', 40); burst(t + 0.5, 0.25, 0.3, 500); break;
    case 'flaps': tone(180, t, 1.2, 0.05, 'sawtooth', 220); break;
    case 'touch': burst(t, 0.5, 0.6 * v, 200); tone(60, t, 0.35, 0.35 * v, 'sine', 35); burst(t, 0.9, 0.18 * v, 2600, 'bandpass'); break;
    case 'thud': burst(t, 0.3, 0.3, 300); break;
    case 'chime': tone(880, t, 1.2, 0.12); tone(660, t + 0.45, 1.4, 0.12); break;
    case 'apoff': for (let i = 0; i < 3; i++) { tone(988, t + i * 0.36, 0.16, 0.12, 'square'); tone(1319, t + i * 0.36 + 0.17, 0.16, 0.12, 'square'); } break;
    case 'click': tone(1600, t, 0.03, 0.08, 'square'); break;
    case 'clacker': for (let i = 0; i < 6; i++) tone(2000, t + i * 0.09, 0.03, 0.08, 'square'); break;
    case 'crash': burst(t, 2.5, 1.0, 200); burst(t, 1.5, 0.6, 1200, 'bandpass'); tone(50, t, 1.5, 0.5, 'sine', 25); break;
    case 'wheel': burst(t, 0.15, 0.08, 400); break;
  }
}
// ---------------------------------------------------------------- voices
let voices = [];
const load = () => { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } };
if ('speechSynthesis' in window) { load(); speechSynthesis.onvoiceschanged = load; }
const pick = (lang, i = 0) => { const v = voices.filter((x) => x.lang && x.lang.replace('_', '-').toLowerCase().startsWith(lang)); return v[i % Math.max(1, v.length)] || v[0]; };
// the aircraft's synthetic voice: short, clipped, cutting off what came before
export function callout(text, { rate = 1.25, pitch = 0.8, cut = true } = {}) {
  if (muted || !('speechSynthesis' in window)) return; try { if (cut) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); const v = pick('en-us') || pick('en'); if (v) u.voice = v; u.lang = 'en-US'; u.rate = rate; u.pitch = pitch; u.volume = 1; speechSynthesis.speak(u); } catch (e) { /* none */ }
}
// the tower on the radio: a crackle, then the words
export function radio(text) {
  if (muted || !A) return; const t = A.currentTime; burst(t, 0.15, 0.15, 2500, 'bandpass'); burst(t + 0.15, 0.08, 0.06, 2500, 'bandpass');
  try { const u = new SpeechSynthesisUtterance(text); const v = pick('en-gb') || pick('en', 1) || pick('en'); if (v) u.voice = v; u.lang = 'en-GB'; u.rate = 1.05; u.pitch = 1.0; setTimeout(() => speechSynthesis.speak(u), 250); } catch (e) { /* none */ }
}
