// The aircraft, built in code to the real types' proportions: a fuselage with its airline's livery painted on (the
// name in English and Chinese, the windows, the cockpit), swept wings with their tips (sharklets, curved, raked),
// engines, the tail with the airline's art, landing gear that folds away, flaps and spoilers that move, and lights:
// navigation, strobes, beacon, landing lights. Nose toward -z, wings along x, up +y; the origin at the centre of gravity.
import * as THREE from '../lib/three.module.min.js';
import { TYPES, AIRLINES } from './data.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const LIV = {
  cal: { body: '#f6f6f8', belly: '#dcd6e2', stripe: '#8a4a8a', text: '#2a2e5a', zh: '中華航空', en: 'CHINA AIRLINES', tail: 'plum', eng: '#f2f2f4' },
  eva: { body: '#f4f6f4', belly: '#1f5a3e', stripe: '#f08a24', text: '#1f5a3e', zh: '長榮航空', en: 'EVA AIR', tail: 'eva', eng: '#1f5a3e' },
  sjx: { body: '#f4f2ee', belly: '#5a4630', stripe: '#c8a060', text: '#5a4630', zh: '星宇航空', en: 'STARLUX', tail: 'star', eng: '#6a5236' },
};
const cache = {};

function fuselageTex(al, T) {
  const k = al + T.short; if (cache[k]) return cache[k];
  const L = LIV[al], W = 2048, H = 2048, c = canvas(W, H), g = c.getContext('2d');
  // u (x) goes round: 0 top, .25 right, .5 belly, .75 left; v (y) from the nose (top) to the tail (bottom)
  g.fillStyle = L.body; g.fillRect(0, 0, W, H);
  const belly = al === 'eva' ? 0.17 : 0.1; g.fillStyle = L.belly; g.fillRect(W * (0.5 - belly), 0, W * belly * 2, H);
  g.fillStyle = L.stripe; for (const s of [-1, 1]) g.fillRect(W * (0.5 + s * belly) - (s < 0 ? W * 0.012 : 0), H * 0.05, W * 0.012, H * 0.9);
  if (al === 'eva') { g.fillStyle = L.stripe; for (const s of [-1, 1]) g.fillRect(W * (0.5 + s * (belly + 0.02)) - (s < 0 ? W * 0.006 : 0), H * 0.05, W * 0.006, H * 0.9); }
  // windows: a row on each side, a little above the middle; the doors
  const n = Math.round(T.len * 1.4), y0 = H * 0.14, y1 = H * 0.8;
  g.fillStyle = '#1a2230';
  for (const u of [0.25 - 0.045, 0.75 + 0.045]) for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * (i / n); if (i % 18 === 0) { g.fillStyle = '#c8ccd4'; g.fillRect(W * u - 14, y - 4, 28, 50); g.fillStyle = '#1a2230'; continue; } g.beginPath(); g.roundRect(W * u - 8, y, 16, 24, 6); g.fill(); }
  // the windscreen: a row of panes round the top of the nose, a little back from the tip
  g.fillStyle = '#16202c';
  const pane = (u0, u1, v0, v1) => { g.beginPath(); g.moveTo(W * u0, H * v1); g.lineTo(W * u1, H * v1); g.lineTo(W * u1, H * v0); g.lineTo(W * u0, H * (v0 + 0.004)); g.closePath(); g.fill(); };
  for (const [u0, u1] of [[0.0, 0.055], [0.945, 1.0], [0.065, 0.12], [0.88, 0.935], [0.13, 0.175], [0.825, 0.87]]) pane(u0, u1, 0.04, 0.052);
  // the names: on the right side reading toward the nose, on the left reading toward the tail
  const name = (u, rot, yy) => { g.save(); g.translate(W * u, H * yy); g.rotate(rot); g.fillStyle = L.text; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${al === 'sjx' ? 70 : 64}px ${al === 'sjx' ? 'Georgia, serif' : 'Arial'}`; g.fillText(L.en, 0, 0); g.font = 'bold 54px "Microsoft JhengHei", "PingFang TC", sans-serif'; g.fillText(L.zh, 0, al === 'sjx' ? 0 : -86); g.restore(); };
  name(0.25 - 0.11, -Math.PI / 2, 0.3); name(0.75 + 0.11, Math.PI / 2, 0.3);
  if (al === 'cal') for (const u of [0.18, 0.82]) { flower(g, W * u, H * 0.72, 46, '#d0559a'); }
  // registration near the tail
  g.font = 'bold 34px Arial'; g.fillStyle = '#3a3a3a'; g.textAlign = 'center'; for (const [u, r] of [[0.21, -Math.PI / 2], [0.79, Math.PI / 2]]) { g.save(); g.translate(W * u, H * 0.88); g.rotate(r); g.fillText('B-' + (18000 + ((al.length * 977 + T.len * 13) | 0) % 999), 0, 0); g.restore(); }
  return (cache[k] = tex(c));
}
function flower(g, x, y, r, col) { // a plum blossom: five round petals
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2, gr = g.createRadialGradient(x, y, r * 0.1, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.6); gr.addColorStop(0, '#ffe0f0'); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, 7); g.fill(); }
  g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(x, y, r * 0.18, 0, 7); g.fill();
}
function tailTex(al) {
  const k = 'tail' + al; if (cache[k]) return cache[k];
  const W = 1024, H = 1024, c = canvas(W, H), g = c.getContext('2d'), L = LIV[al];
  if (al === 'cal') { g.fillStyle = '#f6f6f8'; g.fillRect(0, 0, W, H); flower(g, W * 0.55, H * 0.45, 300, '#c03a88'); }
  else if (al === 'eva') { g.fillStyle = '#1f5a3e'; g.fillRect(0, 0, W, H); g.fillStyle = L.stripe; g.fillRect(0, H * 0.82, W, H * 0.07); g.fillStyle = '#f4f6f4'; g.beginPath(); g.arc(W * 0.56, H * 0.42, 190, 0, 7); g.fill(); g.strokeStyle = '#1f5a3e'; g.lineWidth = 26; for (const rr of [0.35, 0.7]) { g.beginPath(); g.ellipse(W * 0.56, H * 0.42, 190 * rr, 190, 0, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(W * 0.56 - 190, H * 0.42); g.lineTo(W * 0.56 + 190, H * 0.42); g.stroke(); }
  else { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#8a6a42'); gr.addColorStop(1, '#3a2a1a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#e8c88a'; g.save(); g.translate(W * 0.56, H * 0.45); g.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 60 : 240, a = (i / 16) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); }
  return (cache[k] = tex(c));
}
const glowTex = (() => { let t; return () => { if (t) return t; const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (t = tex(c)); }; })();

export function makeAircraft(typeId, al, { lowDetail = false } = {}) {
  const T = TYPES[typeId], L = LIV[al], root = new THREE.Group(), seg = lowDetail ? 16 : 36;
  const len = T.len, R = T.r, metal = new THREE.MeshStandardMaterial({ color: '#d8dcde', roughness: 0.4, metalness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6 });
  const tire = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 }), engMat = new THREE.MeshStandardMaterial({ color: L.eng, roughness: 0.35, metalness: 0.2 });
  const shadow = (o) => { o.castShadow = !lowDetail; o.receiveShadow = !lowDetail; return o; };
  // ---- the fuselage: a lathe along the length, its tail swept up
  const prof = []; const N = lowDetail ? 30 : 64;
  for (let i = 0; i <= N; i++) { const t = i / N, y = -len / 2 + t * len; let r = R;
    const nose = 1 - t; if (t > 0.86) r = R * Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) * 0.98 + 0.02; // the nose, rounded
    if (t < 0.32) r = R * (0.16 + 0.84 * Math.pow(t / 0.32, 0.65)); // the tail cone
    void nose; prof.push(new THREE.Vector2(Math.max(0.05, r), y)); }
  const fg = new THREE.LatheGeometry(prof, seg); fg.rotateX(-Math.PI / 2);
  { const P = fg.attributes.position; for (let i = 0; i < P.count; i++) { const z = P.getZ(i), t = (z + len / 2) / len; if (t > 0.68) P.setY(i, P.getY(i) + (t - 0.68) / 0.32 * R * 0.75); if (t < 0.12) P.setY(i, P.getY(i) - (0.12 - t) / 0.12 * R * 0.18); } fg.computeVertexNormals(); }
  const body = shadow(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: fuselageTex(al, T), roughness: 0.32, metalness: 0.08 }))); root.add(body);
  // ---- wings
  const wingMat = new THREE.MeshStandardMaterial({ color: '#cfd4d6', roughness: 0.45, metalness: 0.25 });
  const half = T.span / 2, rootC = T.len * (T.wide ? 0.2 : 0.17), tipC = rootC * 0.22, sweep = T.wide ? 0.6 : 0.5, wz = -len * 0.02;
  const flaps = [], spoilers = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, -rootC / 2); sh.lineTo(half - R, -rootC / 2 + (half - R) * sweep); sh.lineTo(half - R, -rootC / 2 + (half - R) * sweep + tipC); sh.lineTo(0, rootC / 2); sh.closePath();
    const wg = new THREE.ExtrudeGeometry(sh, { depth: rootC * 0.07, bevelEnabled: false }); wg.rotateX(Math.PI / 2); // the shape's y becomes z (chord), its depth goes down
    const w = shadow(new THREE.Mesh(wg, wingMat)); const wingG = new THREE.Group(); wingG.add(w); wingG.position.set(s * R * 0.8, -R * 0.45, wz); wingG.scale.x = s; wingG.rotation.z = s * 0.09; root.add(wingG);
    // wingtips
    const tipX = half - R, tipZ = -rootC / 2 + tipX * sweep;
    if (T.tip === 'sharklet' || T.tip === 'curve') { const wl = new THREE.Shape(); wl.moveTo(0, 0); wl.lineTo(tipC * 0.9, 0); wl.lineTo(tipC * 0.5, T.span * (T.tip === 'curve' ? 0.07 : 0.06)); wl.lineTo(tipC * 0.25, T.span * (T.tip === 'curve' ? 0.07 : 0.06)); wl.closePath(); const wlg = new THREE.ExtrudeGeometry(wl, { depth: 0.12, bevelEnabled: false }); const m = shadow(new THREE.Mesh(wlg, engMat)); m.rotation.y = -Math.PI / 2; m.position.set(tipX, 0, tipZ + tipC * 0.95); if (T.tip === 'curve') m.rotation.z = -0.35; wingG.add(m); }
    // flaps along the trailing edge, and spoilers on top
    for (let i = 0; i < 2; i++) { const x0 = (i ? 0.45 : 0.05) * (half - R), x1 = (i ? 0.75 : 0.42) * (half - R), ch = rootC * 0.22 * (1 - x0 / half);
      const fg2 = new THREE.BoxGeometry(x1 - x0, 0.18, ch); fg2.translate((x0 + x1) / 2, 0, ch / 2); const xm = (x0 + x1) / 2, hz = rootC / 2 + xm * ((-rootC + (half - R) * sweep + tipC) / (half - R)) - ch * 0.95; // just ahead of the trailing edge
      const fl = shadow(new THREE.Mesh(fg2, wingMat)); const hinge = new THREE.Group(); hinge.position.set(0, -0.15, hz); hinge.add(fl); wingG.add(hinge); flaps.push(hinge);
      const sg = new THREE.BoxGeometry(x1 - x0, 0.08, ch * 0.7); sg.translate((x0 + x1) / 2, 0, ch * 0.35); const sp = new THREE.Mesh(sg, metal); const sh2 = new THREE.Group(); sh2.position.set(0, 0.02, hz - ch * 0.75); sh2.add(sp); wingG.add(sh2); spoilers.push(sh2); }
    // the engine under the wing, on its pylon
    const ex = (T.wide ? 0.34 : 0.33) * half, ez = -rootC / 2 + (ex - R) * sweep - T.eng * 1.6, er = T.eng;
    const ep = [[er * 0.92, -er * 2.2], [er, -er * 1.6], [er * 1.02, -er * 0.4], [er * 0.9, er * 1.4], [er * 0.55, er * 2.1], [er * 0.3, er * 2.6]].map(([r, y]) => new THREE.Vector2(r, y));
    const eg = new THREE.LatheGeometry(ep, lowDetail ? 12 : 28); eg.rotateX(Math.PI / 2); // the intake forward (-z)
    const eng = shadow(new THREE.Mesh(eg, engMat)); eng.position.set(s * ex, -R * 0.45 - er * 1.15, wz + ez); root.add(eng);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(er * 0.88, 20), dark); fan.position.set(s * ex, -R * 0.45 - er * 1.15, wz + ez - er * 2.18); fan.rotation.y = Math.PI; root.add(fan);
    const pyl = shadow(new THREE.Mesh(new THREE.BoxGeometry(er * 0.35, er * 0.9, er * 3.2), wingMat)); pyl.position.set(s * ex, -R * 0.45 - er * 0.35, wz + ez + er * 0.6); root.add(pyl);
  }
  // ---- the tail: a fin with the airline's art, the stabilisers
  const finH = T.height - R * 2.2, finC = rootC * 0.95, fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(finC, 0); fin.lineTo(finC * 1.25, finH); fin.lineTo(finC * 0.75, finH); fin.closePath();
  const fing = new THREE.ShapeGeometry(fin); { const P = fing.attributes.position, UV = fing.attributes.uv; for (let i = 0; i < P.count; i++) UV.setXY(i, P.getX(i) / (finC * 1.25), P.getY(i) / finH); }
  const finMat = new THREE.MeshStandardMaterial({ map: tailTex(al), roughness: 0.35, side: THREE.DoubleSide });
  const finM = shadow(new THREE.Mesh(fing, finMat)); finM.rotation.y = -Math.PI / 2; finM.position.set(0, R * 0.8, len / 2 - finC * 1.3); root.add(finM);
  const finEdge = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: LIV[al].tail === 'plum' ? '#f2f2f4' : al === 'eva' ? '#1f5a3e' : '#5a4428', roughness: 0.4 })); finEdge.rotation.y = -Math.PI / 2; finEdge.position.set(-0.2, R * 0.8, len / 2 - finC * 1.3); finEdge.scale.set(1, 1, 1); root.add(finEdge);
  for (const s of [-1, 1]) { const hs = new THREE.Shape(), hh = T.span * 0.17, hc = finC * 0.8; hs.moveTo(0, 0); hs.lineTo(hh, hh * 0.6); hs.lineTo(hh, hh * 0.6 + hc * 0.35); hs.lineTo(0, hc); hs.closePath(); const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.35, bevelEnabled: false }); hg.rotateX(Math.PI / 2); const m = shadow(new THREE.Mesh(hg, wingMat)); const G = new THREE.Group(); G.add(m); G.scale.x = s; G.position.set(s * R * 0.3, R * 0.55, len / 2 - hc * 1.6); G.rotation.z = s * 0.12; root.add(G); }
  // ---- landing gear: two main legs with bogies, a nose leg
  const gearParts = [], legH = T.mainH - R * 0.5;
  const wheel = (r, w) => { const g = new THREE.CylinderGeometry(r, r, w, lowDetail ? 10 : 18); g.rotateZ(Math.PI / 2); return g; };
  for (const s of [-1, 1]) {
    const G = new THREE.Group(); G.position.set(s * (T.wide ? R * 1.9 : R * 1.6), -R * 0.5, T.mainX); root.add(G);
    const leg = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, legH, 8), metal)); leg.position.y = -legH / 2; G.add(leg);
    const rows = typeId === 'b777' ? 3 : 2, wr = T.wide ? 0.62 : 0.55;
    for (let j = 0; j < rows; j++) for (const ws of [-1, 1]) { const w = shadow(new THREE.Mesh(wheel(wr, 0.45), tire)); w.position.set(ws * 0.62, -legH + wr - (T.mainH - legH - R * 0.5) * 0 - 0.0, (j - (rows - 1) / 2) * 1.45); w.position.y = -(T.mainH - R * 0.5) + wr; G.add(w); }
    gearParts.push({ G, side: s, main: true });
  }
  { const G = new THREE.Group(); G.position.set(0, -R * 0.6, -T.noseX); root.add(G); const nl = T.mainH - R * 0.6 - 0.5; const leg = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, nl, 8), metal)); leg.position.y = -nl / 2; G.add(leg); for (const ws of [-1, 1]) { const w = shadow(new THREE.Mesh(wheel(0.5, 0.35), tire)); w.position.set(ws * 0.32, -(T.mainH - R * 0.6) + 0.5, 0); G.add(w); } gearParts.push({ G, nose: true }); }
  // ---- lights
  const lights = {};
  if (!lowDetail) {
    const glow = (col, size, x, y, z) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); s.scale.setScalar(size); root.add(s); return s; };
    const tipZ = wz - rootC / 2 + (half - R) * sweep + tipC * 0.3;
    lights.navL = glow('#ff2a1a', 2.5, -half, -R * 0.4, tipZ); lights.navR = glow('#20ff60', 2.5, half, -R * 0.4, tipZ);
    lights.strobes = [glow('#ffffff', 5, -half, -R * 0.4, tipZ + 0.5), glow('#ffffff', 5, half, -R * 0.4, tipZ + 0.5), glow('#ffffff', 3, 0, R * 0.6, len / 2 + 0.5)];
    lights.beacon = [glow('#ff2010', 3, 0, R + 0.2, 0), glow('#ff2010', 3, 0, -R - 0.2, 2)];
    lights.land = [glow('#fff8e8', 3.5, -R * 1.5, -R * 0.55, wz - rootC * 0.4), glow('#fff8e8', 3.5, R * 1.5, -R * 0.55, wz - rootC * 0.4)];
  }
  const A = {
    root, T, al, gear: 1, flaps: 0, spoilers: 0, lights,
    setGear(v) { A.gear = v; for (const p of gearParts) { if (p.nose) p.G.rotation.x = (1 - v) * 1.55; else p.G.rotation.z = p.side * (1 - v) * 1.5; p.G.visible = v > 0.02; } },
    setFlaps(v) { A.flaps = v; for (const f of flaps) f.rotation.x = v * 0.6; },
    setSpoilers(v) { A.spoilers = v; for (const s of spoilers) s.rotation.x = -v * 0.9; },
    update(t, on = true) { if (lowDetail) return; const st = (t % 1.2) < 0.06 || ((t + 0.1) % 1.2) < 0.06; for (const s of lights.strobes) s.visible = on && st; const b = (t % 1.0) < 0.12; for (const s of lights.beacon) s.visible = on && b; },
  };
  A.setGear(1); A.setFlaps(0);
  return A;
}
export { LIV, AIRLINES };
