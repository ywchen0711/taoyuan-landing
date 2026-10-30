// The world around Taoyuan Airport: the farmland of Taoyuan with its many ponds (埤塘), the coast and the Taiwan
// Strait with its wind turbines, Dayuan, Luzhu, Taoyuan and Zhongli, the Linkou hills and the Central Mountain Range
// far away, and the airport: two runways painted like the real ones, taxiways, aprons, Terminals 1 and 2, the tower,
// the hangars, parked aircraft, and all the lights: approach lights and their running "rabbit", PAPI, edge,
// centreline, touchdown zone, threshold and end lights, taxiway lights, city and street lights.
import * as THREE from '../lib/three.module.min.js';
import { STRIPS, RUNWAYS, U, RGT, threshold } from './data.js';
import { makeAircraft } from './aircraft.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const along = (x, z) => x * U[0] + z * U[1], across = (x, z) => x * RGT[0] + z * RGT[1];
const at = (a, c) => [U[0] * a + RGT[0] * c, U[1] * a + RGT[1] * c]; // world x, z from (along, across)
export const coastAt = (a) => -3900 + 700 * Math.sin(a / 5200 + 0.6) + 260 * Math.sin(a / 1700); // the coast, as an "across" distance for each "along"
const noise2 = (x, z) => Math.sin(x * 0.00041 + Math.sin(z * 0.00023) * 2) * 0.5 + Math.sin(z * 0.00037 - x * 0.00011) * 0.35 + Math.sin((x + z) * 0.0011) * 0.15;
export function terrainH(x, z) { // the land's height (m): flat round the airport, the Linkou hills rising to the south-east
  const c = across(x, z), a = along(x, z); if (c < 5200) return 0;
  const k = Math.min(1, (c - 5200) / 5000); return k * k * (120 + 110 * noise2(x, z) + 60 * Math.sin(a / 2300));
}

export function buildWorld(scene, renderer, o) {
  const W = { scene, lights: null, papi: [], turbines: [], clouds: [], rain: null, t: 0, cityMats: [], wet: o.wx === 'rain' || o.wx === 'storm' };
  const night = o.time === 'night', dusk = o.time === 'sunset';
  // ---------------------------------------------------------------- sky, sun, fog
  const sunDir = night ? new THREE.Vector3(-0.3, 0.45, 0.5).normalize() : dusk ? new THREE.Vector3(-0.85, 0.07, -0.25).normalize() : new THREE.Vector3(0.35, 0.8, 0.45).normalize();
  const skyTop = night ? '#05081a' : dusk ? '#2a3a6a' : o.wx === 'clear' ? '#3a78c8' : '#6a7a90', skyHor = night ? '#141c34' : dusk ? '#f2a060' : o.wx === 'clear' ? '#bcd8f0' : '#a8b0bc';
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(skyTop) }, hor: { value: new THREE.Color(skyHor) }, sun: { value: sunDir }, sunCol: { value: new THREE.Color(night ? '#c8d4ff' : dusk ? '#ffb070' : '#fff6e0') }, night: { value: night ? 1 : 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top, hor, sun, sunCol; uniform float night; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ float y = max(vD.y, 0.); vec3 c = mix(hor, top, pow(y, 0.55)); if (vD.y < 0.) c = mix(hor, hor*0.6, min(1., -vD.y*4.));
        float s = max(dot(vD, sun), 0.); c += sunCol * (pow(s, 600.) * 4. * (1.-night) + pow(s, 8.) * 0.35 + pow(s, 2.) * 0.08 * (1.-night));
        if (night > 0.5) { vec3 q = floor(vD * 420.); float st = step(0.9975, h(q)) * smoothstep(0.02, 0.3, vD.y); c += vec3(st); c += vec3(0.9,0.92,1.0) * pow(s, 900.) * 3.; }
        gl_FragColor = vec4(c, 1.); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat); sky.scale.setScalar(150000); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky); W.sky = sky;
  const fogCol = new THREE.Color(skyHor).lerp(new THREE.Color(night ? '#0a0e1c' : '#9aa4b4'), o.wx === 'rain' || o.wx === 'storm' ? 0.6 : 0.2);
  scene.fog = new THREE.FogExp2(fogCol, { clear: 0.000035, cloudy: 0.00005, rain: 0.00022, storm: 0.00014 }[o.wx] * (dusk ? 1.3 : 1));
  scene.background = fogCol;
  const hemi = new THREE.HemisphereLight(night ? '#3a4a7a' : dusk ? '#ffc8a0' : '#dcecff', night ? '#101418' : '#4a5a3a', night ? 0.6 : dusk ? 0.75 : o.wx === 'clear' ? 1.0 : 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(night ? '#8090c8' : dusk ? '#ffb070' : '#fff4e0', night ? 0.25 : dusk ? 1.6 : o.wx === 'clear' ? 2.6 : 1.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 800 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target); W.sun = sun; W.sunDir = sunDir;
  renderer.toneMappingExposure = night ? 1.3 : dusk ? 1.0 : 0.95;
  W.follow = (p) => { sun.position.copy(p).addScaledVector(sunDir, 400); sun.target.position.copy(p); sky.position.copy(p).setY(0); };

  // ---------------------------------------------------------------- the land: one big painted map, plus fine detail
  const R = rng(7), MAP = 36000, PX = 4096, mc = canvas(PX, PX), m = mc.getContext('2d');
  const toPx = (x, z) => [(x / MAP + 0.5) * PX, (z / MAP + 0.5) * PX], k = PX / MAP;
  m.fillStyle = '#6a8a4a'; m.fillRect(0, 0, PX, PX);
  // field patchwork, laid along the runways' direction like the real farm roads
  m.save(); m.translate(PX / 2, PX / 2); m.rotate(Math.atan2(U[1], U[0]));
  const fieldCols = ['#7a9a52', '#8aa85a', '#6a8a44', '#9aa86a', '#8a9a5a', '#a8a070', '#5f8a4a', '#94b066'];
  for (let i = -PX * 0.75; i < PX * 0.75; i += 3 + R() * 4) for (let j = -PX * 0.75; j < PX * 0.75; j += 4 + R() * 6) { m.fillStyle = fieldCols[(R() * fieldCols.length) | 0]; m.fillRect(i, j, 3 + R() * 4, 4 + R() * 6); }
  m.restore();
  // towns: grey patches
  const towns = [[3200, -2900, 1500, '大園'], [-1800, 6500, 2400, '蘆竹'], [-9000, 11500, 3200, '桃園'], [-13500, 4500, 2800, '中壢'], [-9500, -4200, 1800, '觀音'], [7600, 1800, 1400, '南崁']].map(([a, c, r, n]) => { const [x, z] = at(a, c); return { x, z, r, n }; });
  for (const T of towns) { const [px, pz] = toPx(T.x, T.z); for (let i = 0; i < 260; i++) { const ang = R() * 6.28, d = Math.sqrt(R()) * T.r * k; m.fillStyle = ['#8a8478', '#9a948a', '#7a7468', '#a49a8a'][i % 4]; m.fillRect(px + Math.cos(ang) * d, pz + Math.sin(ang) * d, 2 + R() * 4, 2 + R() * 4); } }
  // the ponds of Taoyuan: thousands once, still hundreds
  W.ponds = [];
  for (let i = 0; i < 900; i++) { const x = (R() - 0.5) * MAP * 0.9, z = (R() - 0.5) * MAP * 0.9, c = across(x, z), a = along(x, z); if (c < coastAt(a) + 300 || c > 9000) continue; if (Math.abs(c) < 1700 && Math.abs(a) < 2800) continue; const [px, pz] = toPx(x, z), r = (25 + R() * 70) * k; m.fillStyle = R() < 0.5 ? '#4a7a8a' : '#3a6a7a'; m.beginPath(); m.ellipse(px, pz, r, r * (0.6 + R() * 0.5), R() * 3, 0, 7); m.fill(); W.ponds.push([x, z]); }
  // roads: Freeway 2 to the airport, the coastal road, farm roads
  const road = (pts, w, col) => { m.strokeStyle = col; m.lineWidth = w * k; m.lineCap = 'round'; m.beginPath(); pts.forEach(([a, c], i) => { const [x, z] = at(a, c), [px, pz] = toPx(x, z); i ? m.lineTo(px, pz) : m.moveTo(px, pz); }); m.stroke(); };
  W.roads = [[[2600, 2000], [5000, 3600], [8000, 4200], [12000, 4600]], [[-16000, -3200], [-6000, -3300], [0, -3100], [6000, -2600], [16000, -2300]], [[-14000, 900], [-6000, 1400], [-2600, 1500]], [[-3000, 2400], [-7000, 6000], [-9000, 11000]]];
  for (const r of W.roads) road(r, 34, '#5a5854');
  for (let i = 0; i < 40; i++) { const a0 = (R() - 0.5) * 30000, c0 = coastAt(a0) + 500 + R() * 9000; road([[a0, c0], [a0 + (R() - 0.5) * 3000, c0 + 2000 + R() * 3000]], 10, '#8a8270'); }
  // the beach and the sea (the sea is transparent here: a water surface lies under it)
  m.globalCompositeOperation = 'destination-out';
  m.beginPath(); for (let a = -MAP; a <= MAP; a += 200) { const [x, z] = at(a, coastAt(a)), [px, pz] = toPx(x, z); a === -MAP ? m.moveTo(px, pz) : m.lineTo(px, pz); } { const [x, z] = at(MAP, -MAP), [px, pz] = toPx(x, z); m.lineTo(px, pz); const [x2, z2] = at(-MAP, -MAP), [px2, pz2] = toPx(x2, z2); m.lineTo(px2, pz2); } m.closePath(); m.fill();
  m.globalCompositeOperation = 'source-over';
  m.strokeStyle = '#d8ccaa'; m.lineWidth = 60 * k; m.beginPath(); for (let a = -MAP; a <= MAP; a += 200) { const [x, z] = at(a, coastAt(a) + 30), [px, pz] = toPx(x, z); a === -MAP ? m.moveTo(px, pz) : m.lineTo(px, pz); } m.stroke();
  // the airport grounds: mown grass
  m.save(); m.translate(PX / 2, PX / 2); m.rotate(Math.atan2(U[1], U[0])); m.fillStyle = '#6f9450'; m.fillRect(-2400 * k, -1350 * k, 4800 * k, 2700 * k); m.restore();
  const mapTex = texOf(mc); mapTex.anisotropy = 16;
  // fine detail laid over the big map
  const dc = canvas(256, 256), dg = dc.getContext('2d'), img = dg.createImageData(256, 256); for (let i = 0; i < img.data.length; i += 4) { const v = 200 + Math.random() * 55; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } dg.putImageData(img, 0, 0);
  const detail = texOf(dc); detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.colorSpace = THREE.NoColorSpace;
  const groundMat = new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.95, alphaTest: 0.5 });
  groundMat.onBeforeCompile = (sh) => { sh.uniforms.dmap = { value: detail }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D dmap; varying vec3 vWp;').replace('#include <map_fragment>', '#include <map_fragment>\nfloat dd = texture2D(dmap, vWp.xz / 7.0).r * texture2D(dmap, vWp.xz / 53.0).r; diffuseColor.rgb *= 0.55 + 0.55 * dd;'); };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); W.ground = ground;
  // beyond the map: plain land, and the sea everywhere north-west
  const far = new THREE.Mesh(new THREE.RingGeometry(MAP * 0.7, 160000, 64, 1), new THREE.MeshStandardMaterial({ color: '#5a7a44', roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -2; scene.add(far);
  const seaMat = new THREE.MeshStandardMaterial({ color: night ? '#0a1424' : dusk ? '#2a4a6a' : '#1e5a7a', roughness: 0.18, metalness: 0.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300000, 300000), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; scene.add(sea); W.sea = sea;
  { const [sx, sz] = at(0, -150000 - 3900); sea.position.x = sx; sea.position.z = sz; sea.rotation.z = -Math.atan2(U[1], U[0]); } // its edge along the coast
  // ---------------------------------------------------------------- hills and far mountains
  {
    const g = new THREE.PlaneGeometry(40000, 40000, 160, 160); g.rotateX(-Math.PI / 2); const P = g.attributes.position, col = [];
    const [ox, oz] = at(0, 14000);
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + ox, z = P.getZ(i) + oz, h = terrainH(x, z); P.setY(i, h > 0.5 ? h : -3); const c = new THREE.Color(h > 140 ? '#4a6a3a' : '#5a7a44').lerp(new THREE.Color('#6a7a52'), Math.random() * 0.3); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const hills = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); hills.position.set(ox, 0, oz); hills.receiveShadow = true; scene.add(hills);
    // the Central Mountain Range and Yangmingshan, far off: a jagged band
    const ring = new THREE.BufferGeometry(), pos = [], idx = [], nSeg = 220;
    for (let i = 0; i <= nSeg; i++) { const t = i / nSeg, ang = -0.25 + t * 2.6, dir = [Math.cos(ang) * RGT[0] - Math.sin(ang) * U[0] * 0, 0]; void dir;
      const bear = Math.atan2(RGT[0], -RGT[1]) - 1.3 + t * 2.6, d = 45000 + 15000 * Math.sin(t * 7), x = Math.sin(bear) * d, z = -Math.cos(bear) * d;
      const h = 900 + 1900 * Math.abs(Math.sin(t * 13.1) * Math.sin(t * 5.3 + 1)) + 400 * Math.sin(t * 41);
      pos.push(x, -50, z, x * 1.05, h, z * 1.05); if (i < nSeg) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
    ring.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ring.setIndex(idx); ring.computeVertexNormals();
    scene.add(new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ color: night ? '#0a0e18' : '#4a5a6a', roughness: 1, side: THREE.DoubleSide })));
  }

  // ---------------------------------------------------------------- the runways
  const asph = (len, id) => {
    const H = 8192, Wd = 512, c = canvas(Wd, H), g = c.getContext('2d'), pxm = H / len, pw = Wd / 60;
    g.fillStyle = '#3a3c3e'; g.fillRect(0, 0, Wd, H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * Wd, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 10); }
    // rubber where the wheels come down, near both ends
    for (const end of [0, 1]) for (let i = 0; i < 260; i++) { const y = (end ? H - (200 + Math.random() * 700) * pxm : (200 + Math.random() * 700) * pxm), x = Wd / 2 + (Math.random() - 0.5) * 22 * pw; g.fillStyle = `rgba(10,10,10,${0.1 + Math.random() * 0.15})`; g.fillRect(x, y, 3 + Math.random() * 18, 30 + Math.random() * 80); }
    g.fillStyle = '#f4f4ec';
    g.fillRect(1 * pw, 0, 0.9 * pw, H); g.fillRect(Wd - 1.9 * pw, 0, 0.9 * pw, H); // edge lines
    for (let y = 300 * pxm; y < H - 300 * pxm; y += 60 * pxm) g.fillRect(Wd / 2 - 0.45 * pw, y, 0.9 * pw, 36 * pxm); // centreline
    // each end: piano keys, the number, touchdown zone, aiming point
    const ends = Object.values(RUNWAYS).filter((r) => r.strip === id);
    for (const r of ends) {
      // the canvas's top is the runway's 053 end: for a landing toward 053 the threshold is at the bottom, so turn the frame round
      g.save(); if (r.dir > 0) { g.translate(Wd, H); g.rotate(Math.PI); }
      const y0 = 120 * pxm; // the threshold, 120 m in; the runway runs on toward +y in this frame
      for (let i = 0; i < 16; i++) { const x = (i < 8 ? 3 + i * 3.4 : 60 - 3 - (16 - i) * 3.4 + 1.6); g.fillRect(x * pw, y0, 1.8 * pw, 30 * pxm); }
      g.fillRect(0, y0 - 1.6 * pxm, Wd, 1.2 * pxm);
      // the designator, read by the pilot coming in from -y: the letter nearer the threshold, the number beyond it
      const word = (txt, yy) => { g.save(); g.translate(Wd / 2, yy); g.rotate(Math.PI); g.scale(pw * 6.5 / (18 * pxm * 0.62), 1); g.font = `bold ${Math.round(18 * pxm)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore(); };
      word(r.name.slice(2), y0 + 48 * pxm); word(r.name.slice(0, 2), y0 + 76 * pxm);
      // touchdown zone bars and the aiming point
      for (const [d, n] of [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]]) for (const s of [-1, 1]) for (let j = 0; j < n; j++) g.fillRect(Wd / 2 + s * (4 + j * 3.2) * pw - (s < 0 ? 1.8 * pw : 0), y0 + d * pxm, 1.8 * pw, 22 * pxm);
      for (const s of [-1, 1]) g.fillRect(Wd / 2 + s * 6.5 * pw - (s < 0 ? 10 * pw : 0), y0 + 400 * pxm, 10 * pw, 48 * pxm);
      g.restore();
    }
    const t = texOf(c); t.anisotropy = 16; return t;
  };
  W.runwayMeshes = [];
  for (const [id, S] of Object.entries(STRIPS)) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(S.w + 30, S.len + 120), new THREE.MeshStandardMaterial({ color: '#5a5c58', roughness: 0.95 }));
    shoulder.rotation.set(-Math.PI / 2, 0, -Math.atan2(U[0], -U[1])); shoulder.position.set(S.cx, 0.05, S.cz); shoulder.receiveShadow = true; scene.add(shoulder);
    const mat = new THREE.MeshStandardMaterial({ map: asph(S.len, id), roughness: W.wet ? 0.25 : 0.85, metalness: W.wet ? 0.15 : 0 });
    const rwm = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.len), mat);
    rwm.rotation.set(-Math.PI / 2, 0, -Math.atan2(U[0], -U[1])); rwm.position.set(S.cx, 0.12, S.cz); rwm.receiveShadow = true; scene.add(rwm); W.runwayMeshes.push(rwm);
  }
  // taxiways and aprons: a parallel taxiway inside each runway, links across, high-speed exits
  const taxiMat = new THREE.MeshStandardMaterial({ color: '#4a4c4c', roughness: 0.9 }), apronMat = new THREE.MeshStandardMaterial({ color: '#8a8a84', roughness: 0.92 });
  const yellow = new THREE.MeshBasicMaterial({ color: '#d8b020' });
  const strip = (a, c, len, w, mat, ang = 0, y = 0.08) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat); const [x, z] = at(a, c); g.rotation.set(-Math.PI / 2, 0, -Math.atan2(U[0], -U[1]) + ang); g.position.set(x, y, z); g.receiveShadow = true; scene.add(g); return g; };
  W.taxi = [];
  for (const s of [-1, 1]) {
    strip(0, s * 560, 3700, 23, taxiMat); strip(0, s * 560, 3700, 0.3, yellow, 0, 0.1); W.taxi.push([0, s * 560, 3700]);
    for (const a of [-1700, -900, 0, 900, 1700]) { strip(a, s * 660, 200, 23, taxiMat, Math.PI / 2 * 0 + 0, 0.081).rotation.z += Math.PI / 2; }
    for (const a of [-1200, 600]) { const g = strip(a, s * 640, 320, 23, taxiMat, s * 0.52, 0.082); void g; }
  }
  strip(-250, 0, 1500, 700, apronMat, 0, 0.06); strip(1100, 0, 900, 520, apronMat, 0, 0.06);
  // ---------------------------------------------------------------- buildings
  const winTex = (() => { const c = canvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); for (let y = 4; y < 128; y += 12) for (let x = 4; x < 128; x += 10) { if (Math.random() < 0.55) { g.fillStyle = `rgba(255,${200 + Math.random() * 40},${130 + Math.random() * 80},${0.6 + Math.random() * 0.4})`; g.fillRect(x, y, 6, 6); } } const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const bmat = (col, glass) => { const mm = new THREE.MeshStandardMaterial({ color: col, roughness: glass ? 0.3 : 0.8, metalness: glass ? 0.3 : 0 }); if (night || dusk) { mm.emissiveMap = winTex; mm.emissive = new THREE.Color('#ffd8a0'); mm.emissiveIntensity = night ? 1.6 : 0.6; } return mm; };
  const box = (a, c, w, d, h, mat, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); const [x, z] = at(a, c); b.position.set(x, h / 2, z); b.rotation.y = -Math.atan2(U[0], -U[1]) + rot; b.castShadow = b.receiveShadow = true; scene.add(b); return b; };
  const glass = bmat('#9ab0c4', true), white = bmat('#d8dcdc'), conc = bmat('#a8a49a');
  // Terminal 1 (north-east) and Terminal 2 (south-west): long halls with curving roofs, and their piers
  const terminal = (a, c, L, D, H) => { box(a, c, D, L, H, glass); const roof = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.75, D * 0.75, L, 24, 1, false, -0.7, 1.4), white); const [x, z] = at(a, c); roof.rotation.set(0, -Math.atan2(U[0], -U[1]), Math.PI / 2); roof.rotation.order = 'YXZ'; roof.position.set(x, H - D * 0.75 * Math.cos(0.7) + 2, z); roof.castShadow = true; scene.add(roof); };
  terminal(1250, 60, 320, 110, 22); terminal(-420, 60, 420, 130, 26);
  for (const [a, len] of [[1050, 420], [1450, 420], [-650, 520], [-200, 520]]) { box(a, -110, 40, len * 0 + 40, 14, conc); box(a, 120, 34, 260, 12, glass, Math.PI / 2); }
  // the tower
  { const [x, z] = at(380, 120); const sh = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 62, 16), white); sh.position.set(x, 31, z); sh.castShadow = true; scene.add(sh); const cab = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 9, 16), glass); cab.position.set(x, 66, z); scene.add(cab); const top = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 16), white); top.position.set(x, 71.5, z); scene.add(top); W.tower = new THREE.Vector3(x, 72, z); }
  // hangars (with their owners' names), cargo sheds, a fuel farm
  const hangar = (a, c, w, d, h, name, col) => { box(a, c, w, d, h, bmat('#c8ccd0')); const roof = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.6, w * 0.6, d, 20, 1, false, -0.98, 1.96), bmat('#b0b4b8')); const [x, z] = at(a, c); roof.rotation.set(0, -Math.atan2(U[0], -U[1]), Math.PI / 2); roof.rotation.order = 'YXZ'; roof.position.set(x, h - w * 0.6 * Math.cos(0.98), z); scene.add(roof);
    const tc = canvas(1024, 160), tg = tc.getContext('2d'); tg.fillStyle = '#e8ecee'; tg.fillRect(0, 0, 1024, 160); tg.fillStyle = col; tg.font = 'bold 96px Arial'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(name, 512, 84);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.125), new THREE.MeshStandardMaterial({ map: texOf(tc), roughness: 0.7 })); const [sx, sz] = at(a, c - d / 2 - 0.5); sign.position.set(sx, h * 0.78, sz); sign.rotation.y = Math.atan2(-RGT[0], -RGT[1]); scene.add(sign); };
  hangar(-1500, -330, 110, 90, 34, 'CHINA AIRLINES', '#8a3a7a'); hangar(-1200, 330, 120, 90, 36, 'EVA AIR', '#1f6a4a'); hangar(1900, 330, 90, 80, 30, 'STARLUX', '#8a6a3a');
  for (let i = 0; i < 6; i++) box(-2000 + i * 150, -330, 120, 70, 16, conc);
  for (let i = 0; i < 6; i++) { const [x, z] = at(2300 + (i % 3) * 40, -330 + Math.floor(i / 3) * 40); const t = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 14, 20), white); t.position.set(x, 7, z); scene.add(t); }
  // aircraft at the gates (the three airlines, a few others), nose in to the piers
  const fleet = [['cal', 'a350'], ['eva', 'b777'], ['sjx', 'a321'], ['cal', 'b777'], ['eva', 'b787'], ['sjx', 'a350'], ['cal', 'a321'], ['eva', 'a321'], ['cal', 'a350'], ['eva', 'b787']];
  fleet.forEach(([al, ty], i) => { const ac = makeAircraft(ty, al, { lowDetail: true }); const a = -800 + i * 260 + (i > 4 ? 300 : 0), c = (i % 2 ? 1 : -1) * 170; const [x, z] = at(a, c); ac.root.position.set(x, 0, z); ac.root.rotation.y = -Math.atan2(RGT[0] * (i % 2 ? -1 : 1), -RGT[1] * (i % 2 ? -1 : 1)); ac.setGear(1); scene.add(ac.root); });
  // ---------------------------------------------------------------- towns: blocks of flats and houses
  {
    const N = 5200, geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const mat = bmat('#c8c0b0'); mat.vertexColors = false;
    const im = new THREE.InstancedMesh(geo, mat, N); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let n = 0;
    for (const T of towns) { const cnt = Math.round(T.r * T.r / 3000); for (let i = 0; i < cnt && n < N; i++) { const ang = R() * 6.28, d = Math.sqrt(R()) * T.r, x = T.x + Math.cos(ang) * d, z = T.z + Math.sin(ang) * d; if (across(x, z) < coastAt(along(x, z)) + 100) continue; const big = R() < 0.18 * (1 - d / T.r), w = big ? 18 + R() * 20 : 8 + R() * 10, h = big ? 30 + R() * 70 : 6 + R() * 12; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(U[0], -U[1]) + (R() < 0.3 ? R() : 0)); M.compose(new THREE.Vector3(x, terrainH(x, z), z), q, new THREE.Vector3(w, h, w * (0.7 + R() * 0.8))); im.setMatrixAt(n, M); im.setColorAt(n, col.set(['#d8d0c0', '#c0b8a8', '#e0dcd0', '#b0a898', '#c8c0b8'][(R() * 5) | 0])); n++; } }
    for (let i = 0; i < 1400 && n < N; i++) { const x = (R() - 0.5) * 30000, z = (R() - 0.5) * 30000, c = across(x, z), a = along(x, z); if (c < coastAt(a) + 200 || (Math.abs(c) < 1600 && Math.abs(a) < 2900)) continue; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(U[0], -U[1])); M.compose(new THREE.Vector3(x, terrainH(x, z), z), q, new THREE.Vector3(10 + R() * 30, 5 + R() * 9, 10 + R() * 20)); im.setMatrixAt(n, M); im.setColorAt(n, col.set(R() < 0.3 ? '#a8a8b0' : '#d0c8b8')); n++; }
    im.count = n; im.castShadow = false; im.receiveShadow = true; scene.add(im);
  }
  // ---------------------------------------------------------------- the coast's wind turbines
  {
    const white2 = new THREE.MeshStandardMaterial({ color: '#f0f2f4', roughness: 0.5 });
    for (let i = 0; i < 26; i++) { const a = -14000 + i * 1150, c = coastAt(a) + 140, [x, z] = at(a, c);
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 80, 10), white2); tw.position.y = 40; g.add(tw);
      const hub = new THREE.Group(); hub.position.set(0, 81, 2.5); g.add(hub); const nac = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 9), white2); nac.position.set(0, 81, 0); g.add(nac);
      for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 42, 0.6), white2); bl.position.y = 21; const arm = new THREE.Group(); arm.rotation.z = (b / 3) * Math.PI * 2; arm.add(bl); hub.add(arm); }
      g.rotation.y = Math.atan2(RGT[0], RGT[1]); hub.userData.spd = 1.1 + Math.random() * 0.4; W.turbines.push(hub); }
  }
  // ---------------------------------------------------------------- lights
  W.lights = buildLights(scene, night, dusk, W);
  // ---------------------------------------------------------------- clouds and rain
  buildClouds(scene, o, W, night, dusk);
  return W;
}

// ======================================================================== the lights, as glowing points
function lightMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 }, uDay: { value: 0 }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `attribute vec3 color; attribute float size; attribute vec2 dir; attribute float flash; attribute float phase;
      uniform float uScale, uDay, uTime; uniform vec3 uCam; varying vec3 vCol; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = max(1.0, -mv.z);
        vA = 1.0; if (dot(dir, dir) > 0.0) { vec3 tc = normalize(uCam - position); vA *= smoothstep(-0.05, 0.45, dot(normalize(vec3(dir.x, 0.0, dir.y)), tc)); }
        if (flash > 0.0) { float f = fract(uTime * flash - phase); vA *= f < 0.07 ? 3.0 : 0.0; }
        float px = size * uScale / d; vA *= mix(1.0, 0.55, uDay) * clamp(px / 1.2, mix(0.7, 0.3, uDay), 1.0);
        gl_PointSize = clamp(px * mix(1.0, 0.6, uDay), mix(2.4, 1.6, uDay), 40.0); vCol = color;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.0, r); a = a * a * vA; if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, a);
        #include <logdepthbuf_fragment>
      }`,
  });
}
function buildLights(scene, night, dusk, W) {
  const P = [], C = [], S = [], D = [], F = [], PH = [];
  const add = (x, z, col, size = 1, dir = [0, 0], flash = 0, phase = 0, y = 0.5) => { P.push(x, y, z); const c = new THREE.Color(col); C.push(c.r, c.g, c.b); S.push(size); D.push(dir[0], dir[1]); F.push(flash); PH.push(phase); return P.length / 3 - 1; };
  const WH = '#fff4d8', RED = '#ff3020', GRN = '#30ff70', BLU = '#3a70ff', AMB = '#ffb040';
  for (const id of Object.keys(RUNWAYS)) {
    const T = threshold(id), d = [T.dx, T.dz], r = [-d[1], d[0]], L = T.S.len - 240, pt = (al, ac) => [T.x + d[0] * al + r[0] * ac, T.z + d[1] * al + r[1] * ac];
    const face = [-d[0], -d[1]]; // these lights shine toward the approaching aircraft
    // threshold (green) and, on the far end, the runway's end (red, facing this way)
    for (let i = -14; i <= 14; i++) { const [x, z] = pt(0, i * 2.1); add(x, z, GRN, 1.3, face); const [x2, z2] = pt(L, i * 2.1); add(x2, z2, RED, 1.1, face); }
    // edges every 60 m (the last 600 m amber), the centreline every 15 m (white, then red and white, then red), the touchdown zone
    for (let a = 0; a <= L; a += 60) for (const s of [-1, 1]) { const [x, z] = pt(a, s * 31); add(x, z, a > L - 600 ? AMB : WH, 1.1, face); }
    for (let a = 7; a <= L; a += 15) { const [x, z] = pt(a, 0.8); const left = L - a; add(x, z, left < 300 ? RED : left < 900 ? ((a / 15) % 2 < 1 ? RED : WH) : WH, 0.8, face, 0, 0, 0.18); }
    for (let a = 60; a <= 900; a += 60) for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const [x, z] = pt(a, s * (9 + j * 1.5)); add(x, z, WH, 0.7, face, 0, 0, 0.18); }
    // the approach lights: 900 m of centre bars, crossbars at 300 m, side rows near the threshold, and the running rabbit
    for (let a = 30; a <= 900; a += 30) { for (let j = -2; j <= 2; j++) { const [x, z] = pt(-a, j * 1.0); add(x, z, WH, 1.4, face, 0, 0, 0.5 + a * 0.004); }
      const [fx, fz] = pt(-a, 0); add(fx, fz, '#ffffff', 2.4, face, 2.0, 1 - a / 900, 1.2 + a * 0.004);
      if (a <= 270) for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const [x, z] = pt(-a, s * (11 + j * 1.5)); add(x, z, RED, 1.2, face); } }
    for (const s of [-1, 1]) for (let j = 3; j <= 14; j++) { const [x, z] = pt(-300, s * j * 1.6); add(x, z, WH, 1.4, face); }
    // PAPI: four lights left of the runway, 330 m in; their colour is set each frame from the angle they are seen at
    const papi = []; for (let j = 0; j < 4; j++) { const [x, z] = pt(330, -(42 + j * 9)); papi.push({ i: add(x, z, WH, 2.0, face, 0, 0, 0.9), x, z, th: [3.5, 3.17, 2.83, 2.5][j], rwy: id }); }
    W.papi.push(...papi);
  }
  // taxiways: blue edges, green centrelines
  for (const s of [-1, 1]) for (let a = -1850; a <= 1850; a += 45) { for (const e of [-1, 1]) { const [x, z] = at(a, s * 560 + e * 12); add(x, z, BLU, 0.6); } const [x, z] = at(a + 22, s * 560); add(x, z, GRN, 0.45, [0, 0], 0, 0, 0.15); }
  // aprons: high mast floodlights; the towns and streets at night
  for (let a = -900; a <= 1500; a += 160) for (const c of [-250, 250]) { const [x, z] = at(a, c); add(x, z, '#ffe8c0', 3.5, [0, 0], 0, 0, 30); }
  if (night || dusk) {
    for (const rd of W.roads) for (let i = 0; i < rd.length - 1; i++) { const [a0, c0] = rd[i], [a1, c1] = rd[i + 1], n = Math.hypot(a1 - a0, c1 - c0) / 45; for (let k = 0; k < n; k++) { const t = k / n; const [x, z] = at(a0 + (a1 - a0) * t, c0 + (c1 - c0) * t); add(x, z, '#ffb060', 1.2, [0, 0], 0, 0, 9); } }
    const Rr = rng(31); for (let i = 0; i < 9000; i++) { const x = (Rr() - 0.5) * 32000, z = (Rr() - 0.5) * 32000, c = across(x, z), a = along(x, z); if (c < coastAt(a) + 150 || (Math.abs(c) < 1500 && Math.abs(a) < 2900)) continue; const town = Rr() < 0.75; add(x, z, Rr() < 0.6 ? '#ffc880' : '#e8f0ff', town ? 0.9 : 0.7, [0, 0], 0, 0, 4 + terrainH(x, z)); }
    for (const t of W.turbines) { const p = t.parent.position; add(p.x, p.z, RED, 2.5, [0, 0], 0.5, Math.random(), 84); }
  }
  // the tower's beacon
  add(W.tower.x, W.tower.z, '#ffffff', 3, [0, 0], 0.4, 0, 74);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('size', new THREE.Float32BufferAttribute(S, 1));
  g.setAttribute('dir', new THREE.Float32BufferAttribute(D, 2)); g.setAttribute('flash', new THREE.Float32BufferAttribute(F, 1)); g.setAttribute('phase', new THREE.Float32BufferAttribute(PH, 1));
  const mat = lightMaterial(); mat.uniforms.uDay.value = night ? 0 : dusk ? 0.5 : 1;
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, mat, geo: g };
}
// the PAPI's colours, and the lights' time and camera
export function updateLights(W, cam, t, rwy) {
  const L = W.lights; L.mat.uniforms.uTime.value = t; L.mat.uniforms.uCam.value.copy(cam.position); L.mat.uniforms.uScale.value = innerHeight * 0.9;
  const col = L.geo.attributes.color;
  for (const p of W.papi) { const d = Math.hypot(cam.position.x - p.x, cam.position.z - p.z), ang = Math.atan2(cam.position.y - 0.9, d) * 180 / Math.PI, white = ang > p.th; col.setXYZ(p.i, white ? 1 : 1, white ? 0.96 : 0.12, white ? 0.86 : 0.08); }
  col.needsUpdate = true;
  for (const h of W.turbines) h.rotation.z += h.userData.spd * 0.016;
}

// ======================================================================== clouds and rain
function buildClouds(scene, o, W, night, dusk) {
  const c = canvas(256, 256), g = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const x = 60 + Math.random() * 136, y = 80 + Math.random() * 90, r = 30 + Math.random() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const tex = texOf(c), n = { clear: 40, cloudy: 160, rain: 260, storm: 300 }[o.wx], base = { clear: 1800, cloudy: 1100, rain: 260, storm: 420 }[o.wx];
  const tint = night ? '#4a5068' : dusk ? '#ffc8a8' : o.wx === 'clear' || o.wx === 'cloudy' ? '#ffffff' : '#9aa0a8';
  const mat = new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, depthWrite: false, fog: true, opacity: o.wx === 'rain' || o.wx === 'storm' ? 0.85 : 0.75 });
  const R = rng(17);
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(mat); const ang = R() * 6.28, d = 800 + R() * 22000; s.position.set(Math.cos(ang) * d, base + R() * (o.wx === 'clear' ? 900 : 500), Math.sin(ang) * d); const sz = 500 + R() * 1400; s.scale.set(sz, sz * 0.45, 1); scene.add(s); W.clouds.push(s); }
  W.cloudBase = base; W.layer = o.wx === 'rain' || o.wx === 'storm';
  if (W.layer) { const deck = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), new THREE.MeshBasicMaterial({ color: night ? '#1a1e2a' : '#8a9098', transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })); deck.rotation.x = -Math.PI / 2; deck.position.y = base + 160; scene.add(deck); W.deck = deck; }
  if (o.wx === 'rain' || o.wx === 'storm') {
    const N = 3000, pos = new Float32Array(N * 6); for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 60, z = (Math.random() - 0.5) * 80; pos.set([x, y, z, x + 0.15, y - 1.6, z], i * 6); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: night ? '#8a96b0' : '#c8d0dc', transparent: true, opacity: 0.35 })); rain.frustumCulled = false; scene.add(rain); W.rain = rain;
  }
}
export function updateWeather(W, cam, dt) {
  if (W.rain) { W.rain.position.copy(cam.position); W.rain.position.y -= 30; const p = W.rain.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { let y = p.getY(i) - dt * 40; if (y < 0) y += 60; p.setY(i, y); p.setY(i + 1, y - 1.6); } p.needsUpdate = true; }
  if (W.deck) W.deck.position.set(cam.position.x, W.deck.position.y, cam.position.z);
}
