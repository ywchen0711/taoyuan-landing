// How the aircraft flies. A point mass with lift, drag, thrust and weight, its attitude flown through a fly-by-wire
// law (the stick asks for a pitch and roll rate; let go and it holds the flight path and bank, as an Airbus does;
// below 30 ft it holds the pitch, so you must flare yourself), the nose kept into the airflow except for what the
// rudder asks. Engines that spool up slowly. Wheels, brakes, autobrake, reversers and spoilers on the ground.
// The ILS beams of the runway, an autopilot and autothrottle that can fly the approach, and a flight director.
import * as THREE from '../lib/three.module.min.js';
import { TYPES, FLAPS, KT, FT, threshold } from './data.js';
import { terrainH } from './world.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, G = 9.81, RHO = 1.225;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export { D2R, R2D, clamp };

export function createFlight(typeId, o) {
  const T = TYPES[typeId], m = T.mass, RW = threshold(o.rwy);
  // each type's flaps give the lift that puts it at about 4.5° of alpha at Vref+5 with full flap (a real approach attitude)
  const vapp0 = (T.vref + 5) * KT, clNeed = (m * 9.81) / (0.5 * 1.225 * vapp0 * vapp0 * T.S), clScale = (clNeed - 5.5 * 4.5 * Math.PI / 180) / FLAPS.cl0[4];
  const CL0 = FLAPS.cl0.map((v) => v * clScale);
  const F = {
    T, RW, m, pos: new THREE.Vector3(), vel: new THREE.Vector3(), hdg: 0, pitch: 0, roll: 0, p: 0, q: 0, thr: 0.4, n1: 0.55, rev: false, flapIdx: 3, flap: 3, gear: 1, gearPos: 1,
    spoArm: true, spo: 0, speedbrake: 0, brake: 0, autobrake: 'MED', onGround: false, nose: false, gpHold: 0, gammaHold: null, ap: !!o.ap, at: !!o.at, fd: o.fd !== false, gsCap: false, locCap: false,
    t: 0, wind: new THREE.Vector3(), gust: new THREE.Vector3(), td: null, events: [], crashed: null, stopped: false, quat: new THREE.Quaternion(), f: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(),
    ra: 1000, vs: 0, ias: 0, gs: 0, alpha: 0, beta: 0, track: 0, maxG: 1, nz: 1, loc: 0, gsDev: 0, along: 0, across: 0, off: false, tail: false, apOffAt: o.apOff ?? 200, fdPitch: 0, fdRoll: 0,
  };
  // ---- the start: on the approach path, dist nm from the threshold, on the localizer, at the glideslope's height (or 3000 ft)
  const startDist = o.dist * 1852, vapp = (T.vref + 5) * KT;
  const h0 = o.dist >= 9 ? 3000 * FT : Math.max(200, (startDist + 300) * Math.tan(3 * D2R) + 15);
  F.pos.set(RW.x - RW.dx * startDist, h0 + T.mainH, RW.z - RW.dz * startDist);
  F.hdg = Math.atan2(RW.dx, -RW.dz); F.vel.set(RW.dx * vapp * (o.dist >= 9 ? 1.25 : 1), 0, RW.dz * vapp * (o.dist >= 9 ? 1.25 : 1));
  if (o.dist >= 9) { F.flapIdx = F.flap = 1; F.gear = F.gearPos = 0; F.spoArm = false; F.n1 = F.thr = 0.45; } else { F.vel.y = -vapp * Math.tan(3 * D2R); F.n1 = F.thr = 0.42; }
  F.pitch = o.dist >= 9 ? 3 * D2R : 1.5 * D2R;
  // the wind (from where it blows, kt; gusts kt)
  const [wFrom, wKt, gKt] = o.wind, wr = (wFrom + 180) * D2R; F.wind0 = new THREE.Vector3(Math.sin(wr) * wKt * KT, 0, -Math.cos(wr) * wKt * KT); F.gustKt = gKt; F.shear = o.wx === 'storm';
  F.wet = o.wx === 'rain' || o.wx === 'storm';
  let gt = 0; const gn = [0, 0, 0, 0];
  const turb = (o.wx === 'storm' ? 1.0 : o.wx === 'rain' ? 0.5 : o.wx === 'cloudy' ? 0.25 : 0.08) * (1 + gKt / 10);

  function basis() { F.quat.setFromEuler(new THREE.Euler(F.pitch, -F.hdg, -F.roll, 'YXZ')); F.f.set(0, 0, -1).applyQuaternion(F.quat); F.up.set(0, 1, 0).applyQuaternion(F.quat); F.right.set(1, 0, 0).applyQuaternion(F.quat); }
  const local = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(F.quat).add(F.pos);
  const groundAt = (x, z) => { const a = Math.abs(x) < 6000 && Math.abs(z) < 6000 ? 0 : terrainH(x, z); return a; };
  F.groundAt = groundAt;
  basis();

  // ---------------------------------------------------------------- the runway, the ILS
  function guidance() {
    const dx = F.pos.x - RW.x, dz = F.pos.z - RW.z; F.along = dx * RW.dx + dz * RW.dz; F.across = dx * -RW.dz + dz * RW.dx; // across > 0: right of the centreline
    const locD = RW.ilsLen - 240 + 300 - F.along, gpi = 286 - F.along; // to the localizer antenna; to the glide path's origin
    F.loc = Math.atan2(F.across, Math.max(50, locD)) * R2D; // deg, + right of course
    const h = F.pos.y - T.mainH; F.gsH = Math.max(0, gpi) * Math.tan(3 * D2R); F.gsDev = (Math.atan2(h, Math.max(50, gpi)) * R2D) - 3; // + above the slope
    F.distNm = Math.max(0, -F.along) / 1852;
  }

  // ---------------------------------------------------------------- the autopilot and the flight director's commands
  function director() {
    const gsV = Math.hypot(F.vel.x, F.vel.z), rwyH = Math.atan2(RW.dx, -RW.dz);
    const xRate = F.vel.x * -RW.dz + F.vel.z * RW.dx; // across-track speed
    const corr = clamp(-F.across * 0.0035 - xRate * 0.06, -0.5, 0.5); F.locCap = F.locCap || Math.abs(F.loc) < 2.2;
    const wantTrack = rwyH + (F.locCap ? corr : clamp(-F.across * 0.0025, -0.5, 0.5)), trk = Math.atan2(F.vel.x, -F.vel.z);
    F.fdRoll = clamp(wrap(wantTrack - trk) * R2D * 2.4, -25, 25);
    const h = F.pos.y - T.mainH; if (!F.gsCap && F.gsDev > -0.12 && F.along > -20000) F.gsCap = true;
    const vsWant = F.gsCap ? -gsV * Math.tan(3 * D2R) + clamp((F.gsH - h) * 0.14, -4, 4) : 0;
    F.fdVs = vsWant; F.fdGamma = Math.atan2(vsWant, Math.max(30, gsV)); const gam = Math.atan2(F.vel.y, Math.max(30, gsV)); F.fdPitch = clamp(F.pitch * R2D + (F.fdGamma - gam) * R2D * 2, -6, 12);
  }

  // ---------------------------------------------------------------- one step
  F.step = (dt, I) => {
    if (F.crashed || F.stopped) return;
    F.t += dt; basis(); guidance(); director();
    // the wind: steady, gusting, turbulent, and (in a storm) shearing near the ground
    gt -= dt; if (gt <= 0) { gt = 0.6 + Math.random() * 1.8; for (let i = 0; i < 3; i++) gn[i] = (Math.random() - 0.5) * 2; }
    const gK = Math.min(1, dt * 0.8); F.gust.x += (gn[0] * F.gustKt * KT - F.gust.x) * gK; F.gust.z += (gn[1] * F.gustKt * KT - F.gust.z) * gK; F.gust.y += (gn[2] * F.gustKt * KT * 0.12 - F.gust.y) * gK;
    const lowH = F.ra * FT; let shear = 1; if (F.shear && F.ra < 600) shear = 0.55 + 0.45 * (F.ra / 600);
    F.wind.copy(F.wind0).multiplyScalar(F.ra < 30 ? 0.8 : shear).add(F.gust); void lowH;
    // the pilot (or the autopilot)
    let pIn = I.pitch, rIn = I.roll, yIn = I.yaw;
    if (F.ap && (Math.abs(pIn) > 0.35 || Math.abs(rIn) > 0.35)) apOff('pilot');
    if (F.ap && F.ra < F.apOffAt && !F.onGround) apOff('minimums');
    // controls, configuration
    F.flap += clamp(F.flapIdx - F.flap, -dt / 3.5, dt / 3.5); F.gearPos = clamp(F.gearPos + (F.gear ? 1 : -1) * dt / 7, 0, 1);
    F.vTarget = [Math.max(210, T.vref + 60), Math.max(185, T.vref + 40), Math.max(165, T.vref + 22), T.vref + 10, T.vref + 5][Math.round(F.flapIdx)] + (F.flapIdx >= 3 ? F.gustKt * 0.5 : 0); // the managed speed for the flaps set
    if (F.at && !F.onGround) { const target = F.vTarget * KT, err = target - F.ias, acc = F.accel || 0; F.atI = clamp((F.atI ?? F.thr - 0.3) + err * dt * 0.012, -0.3, 0.7); F.thr = clamp(0.3 + F.atI + err * 0.035 - acc * 0.12, 0, 1); if (F.ra < 30) { F.atRet = Math.max(0, (F.atRet ?? F.thr) - dt * 0.6); F.thr = F.atRet; } } // a PI speed hold, then RETARD in the flare
    else F.thr = clamp(F.thr + I.thr * dt * 0.5, 0, 1);
    if (I.thrSet != null) F.thr = I.thrSet;
    const n1T = 0.21 + 0.79 * F.thr; F.n1 += (n1T - F.n1) * dt * (F.n1 < 0.45 ? 0.6 : 1.0);
    // ---- the air
    const va = F.vel.clone().sub(F.wind), V = Math.max(0.1, va.length()), vh = va.clone().divideScalar(V);
    const vf = va.dot(F.f), vu = va.dot(F.up), vr = va.dot(F.right);
    F.alpha = Math.atan2(-vu, vf); F.beta = Math.atan2(vr, vf); F.ias = V; F.gs = Math.hypot(F.vel.x, F.vel.z);
    const fi = Math.floor(clamp(F.flap, 0, 3.999)), ft = F.flap - fi, cl0 = lerp(CL0[fi], CL0[fi + 1], ft), cdf = lerp(FLAPS.cd[fi], FLAPS.cd[fi + 1], ft);
    const aCrit = (14 + F.flap * 0.6) * D2R; let CL = cl0 + 5.5 * F.alpha; if (F.alpha > aCrit) CL = cl0 + 5.5 * aCrit - (F.alpha - aCrit) * 4;
    const hWing = Math.max(0, F.ra * FT); const ge = hWing < T.span ? (1 - hWing / T.span) ** 2 : 0; CL *= 1 + 0.12 * ge;
    CL -= 0.8 * F.spo + 0.25 * F.speedbrake;
    const CD = 0.021 + 0.042 * CL * CL * (1 - 0.5 * ge) + cdf + 0.018 * F.gearPos + 0.09 * F.spo + 0.03 * F.speedbrake;
    const qS = 0.5 * RHO * V * V * T.S;
    const Ldir = F.up.clone().addScaledVector(vh, -F.up.dot(vh)).normalize();
    const force = new THREE.Vector3().addScaledVector(Ldir, qS * CL).addScaledVector(vh, -qS * CD).addScaledVector(F.right, -F.beta * qS * 0.9);
    // ---- the engines
    const spool = Math.max(0, (F.n1 - 0.2) / 0.8), thrust = 2 * T.thrust * (0.025 + 0.975 * Math.pow(spool, 1.6));
    F.revOn = F.rev && F.onGround; force.addScaledVector(F.f, F.revOn ? -thrust * 0.42 : thrust);
    force.y -= m * G;
    // ---- the wheels
    const onG = F.onGround, gsp = F.gs;
    if (onG) {
      const Nf = Math.max(0, -force.y); force.y += Nf; // the ground holds it up
      const fwd = new THREE.Vector3(Math.sin(F.hdg), 0, -Math.cos(F.hdg)), side = new THREE.Vector3(Math.cos(F.hdg), 0, Math.sin(F.hdg));
      const vF = F.vel.dot(fwd), vS = F.vel.dot(side);
      // autobrake: aim for a deceleration once the spoilers are out
      let br = I.brake;
      if (F.autobrake !== 'OFF' && F.spo > 0.5 && gsp > 15 * KT && !br) { const want = F.autobrake === 'LO' ? 1.7 : F.autobrake === 'MED' ? 3.0 : 4.5; F.abCmd = clamp((F.abCmd || 0) + ((want - (-(F.accel || 0))) * 0.25) * dt * 4, 0, 1); br = F.abCmd; }
      if (I.brake > 0.1) F.autobrake = 'OFF';
      F.brake = br; const mu = (F.wet ? 0.28 : 0.5) * br + 0.012 + (F.off ? 0.08 : 0);
      force.addScaledVector(fwd, -Math.sign(vF) * Math.min(Math.abs(vF) * m / dt * 0.5, mu * Nf));
      force.addScaledVector(side, -vS * m * (F.wet ? 1.5 : 4)); // the tyres hold the line
      // steering: the rudder pedals, and the nosewheel when it is down
      const steer = F.nose ? yIn * clamp(10 / Math.max(5, gsp), 0.02, 0.5) : yIn * 0.04 * Math.min(1, gsp / 40);
      F.hdg += steer * dt;
    }
    const acc = force.divideScalar(m); F.accel = acc.dot(F.vel.clone().setY(0).normalize() || new THREE.Vector3()); F.nz = (qS * CL * Ldir.dot(F.up)) / (m * G);
    F.vel.addScaledVector(acc, dt); F.pos.addScaledVector(F.vel, dt);
    // ---- the attitude: fly-by-wire
    if (F.ap && !onG) { rIn = clamp((F.fdRoll * D2R - F.roll) * 1.6, -1, 1); }
    if (!onG) {
      let pCmd;
      if (Math.abs(rIn) > 0.05) pCmd = rIn * 15 * D2R; else { const lim = 33 * D2R; pCmd = Math.abs(F.roll) > lim ? -Math.sign(F.roll) * 5 * D2R : 0; }
      if (F.ap) pCmd = rIn * 8 * D2R;
      F.p += (pCmd - F.p) * Math.min(1, dt / 0.35); F.roll = clamp(F.roll + F.p * dt, -67 * D2R, 67 * D2R);
      const gamma = Math.atan2(F.vel.y, Math.max(1, F.gs));
      let qCmd;
      if (F.ap) { F.gammaHold = null; qCmd = clamp((F.fdGamma - gamma) * 1.5, -2 * D2R, 2 * D2R); }
      else if (Math.abs(pIn) > 0.04) { qCmd = pIn * 4.5 * D2R; F.gammaHold = null; F.pitchHold = null; }
      else if (F.ra > 30) { if (F.gammaHold == null) F.gammaHold = gamma; qCmd = clamp((F.gammaHold - gamma) * 1.5 + (1 / Math.cos(F.roll) - 1) * 0.02, -2 * D2R, 2 * D2R); }
      else { if (F.pitchHold == null) F.pitchHold = F.pitch; qCmd = (F.pitchHold - F.pitch) * 1.5 - 0.3 * D2R; F.pitchHold -= 0.3 * D2R * dt; } // flare law: the nose sinks slowly unless you hold it
      if (F.alpha > aCrit - 2 * D2R && qCmd > 0) qCmd = -1 * D2R; // the alpha floor
      F.q += (qCmd - F.q) * Math.min(1, dt / 0.4); F.pitch = clamp(F.pitch + F.q * dt, -15 * D2R, 30 * D2R);
      // the nose follows the airflow; the rudder holds it off
      const yawRate = 1.6 * F.beta + yIn * 0.22 + Math.sin(F.roll) * G / Math.max(30, V) * 0.0;
      F.hdg += yawRate * dt;
      // turbulence nudges
      F.roll += (Math.random() - 0.5) * turb * 0.004 * (F.ra > 10 ? 1 : 0.3); F.pitch += (Math.random() - 0.5) * turb * 0.0015;
    } else {
      // rolling on the wheels: wings level, the nose held up or let down
      F.roll += (0 - F.roll) * Math.min(1, dt * 3); F.p = 0;
      if (!F.nose) { const q = pIn > 0.05 ? pIn * 3 * D2R : pIn < -0.05 ? pIn * 3 * D2R : -1.4 * D2R * Math.min(1, 50 / Math.max(10, gsp)); F.pitch += q * dt; }
      else if (pIn > 0.3 && F.ias > T.vref * KT * 0.9) F.pitch += pIn * 3 * D2R * dt; // rotation (a go-around off the runway)
    }
    F.hdg = wrap(F.hdg);
    // ---- the ground: gear, nose, tail, wingtips, engines
    basis();
    const gx = T.wide ? T.r * 1.9 : T.r * 1.6;
    const mains = [local(-gx, -T.mainH, T.mainX), local(gx, -T.mainH, T.mainX)], noseP = local(0, -T.mainH, -T.noseX);
    const gnd = groundAt(F.pos.x, F.pos.z), hMain = Math.min(mains[0].y, mains[1].y) - gnd, hNose = noseP.y - gnd;
    F.ra = Math.max(0, hMain) / FT; F.vs = F.vel.y / FT * 60;
    const tailP = local(0, -T.r * 0.6, T.len / 2 - 2), tipL = local(-T.span / 2, -T.r * 0.4, 0), tipR = local(T.span / 2, -T.r * 0.4, 0), engL = local(-T.span * 0.17, -T.r * 0.45 - T.eng * 2.1, 0), engR = local(T.span * 0.17, -T.r * 0.45 - T.eng * 2.1, 0);
    if (hMain <= 0) {
      if (F.gearPos < 0.95) return crash('gearup');
      if (!onG) { const sink = -F.vel.y; F.events.push({ k: 'touch', sink, at: F.along, across: F.across, pitch: F.pitch * R2D, roll: F.roll * R2D, ias: F.ias / KT, crab: F.beta * R2D }); if (!F.td) F.td = { sink, fpm: sink / FT * 60, along: F.along, across: F.across, pitch: F.pitch * R2D, roll: F.roll * R2D, ias: F.ias / KT, crab: wrap(F.hdg - Math.atan2(F.vel.x, -F.vel.z)) * R2D, g: 1 + sink * 0.25, t: F.t };
        if (sink > 5.2) return crash('hard'); if (Math.abs(F.roll) > 11 * D2R) return crash('wing');
        if (sink > 2.2) { F.vel.y = sink * 0.3; F.bounce = (F.bounce || 0) + 1; } else F.vel.y = 0;
        F.maxG = Math.max(F.maxG, 1 + sink * 0.25); F.gpHold = 0; }
      F.pos.y -= hMain; if (F.vel.y < 0) F.vel.y = 0; F.onGround = true;
      if (F.spoArm && F.spo < 1) F.spo = Math.min(1, F.spo + dt * 2.5);
    } else if (onG && hMain > 0.3) { F.onGround = false; F.nose = false; }
    if (F.onGround && hNose <= 0) { if (!F.nose && F.vel.y < -0.1 || (!F.nose && F.td && F.t - F.td.t < 0.05 && hNose < -0.3)) F.events.push({ k: 'nosefirst' }); F.nose = true; const wb = T.noseX + T.mainX; F.pitch += Math.asin(clamp(-hNose / wb, -0.2, 0.2)); if (F.pitch < -0.5 * D2R) F.pitch = -0.5 * D2R; basis(); }
    else if (hNose > 0.2) F.nose = false;
    if (F.onGround && tailP.y - gnd < 0 && !F.tail) { F.tail = true; F.events.push({ k: 'tailstrike' }); }
    if (Math.min(tipL.y, tipR.y) - gnd < 0) return crash('wing');
    if (Math.min(engL.y, engR.y) - gnd < 0 && F.ra < 5) { F.events.push({ k: 'pod' }); return crash('pod'); }
    if (!F.onGround && hMain < -0.5) return crash('terrain');
    if (F.pos.y < gnd + 2 && (Math.abs(F.across) > 400 || F.along < -500) && F.gearPos < 0.5) return crash('terrain');
    // on the ground: off the runway? stopped?
    if (F.onGround) { F.off = Math.abs(F.across) > 31 || F.along > RW.ilsLen - 120 || F.along < -120; if (F.off && !F.offOnce) { F.offOnce = true; F.events.push({ k: 'off' }); } if (F.gs < 1.5) { F.stopped = true; F.events.push({ k: 'stop' }); } }
    if (F.onGround) F.maxG = Math.max(F.maxG, 1);
  };
  function apOff(why) { if (!F.ap) return; F.ap = false; F.events.push({ k: 'apoff', why }); F.gammaHold = null; }
  function crash(why) { F.crashed = why; F.events.push({ k: 'crash', why }); }
  F.apOff = apOff;
  F.basis = basis;
  return F;
}

// ---------------------------------------------------------------- how good was it
export function grade(F) {
  const td = F.td, T = F.T, out = { items: [], score: 0, stars: 0, crash: F.crashed };
  if (F.crashed && !td) { out.title = { zh: '墜機', en: 'Crashed' }; return out; }
  if (!td) { out.title = { zh: '沒有落地', en: 'No landing' }; return out; }
  const fpm = td.fpm; let s = 100;
  const it = (k, v, good, note) => out.items.push({ k, v, good, note });
  const vsNote = fpm < 60 ? ['奶油般的落地！', 'A butter landing!'] : fpm < 180 ? ['柔順的落地', 'A smooth landing'] : fpm < 300 ? ['結實的落地', 'A firm landing'] : fpm < 600 ? ['重落地，乘客嚇了一跳', 'A hard landing: the passengers jumped'] : ['非常重的落地，需要檢查飛機', 'A very hard landing: the aircraft needs an inspection'];
  s -= fpm < 60 ? 0 : fpm < 180 ? 4 : fpm < 300 ? 12 : fpm < 600 ? 30 : 55;
  it({ zh: '落地垂直速度', en: 'Touchdown rate' }, `${Math.round(fpm)} fpm`, fpm < 300, { zh: vsNote[0], en: vsNote[1] });
  it({ zh: 'G 值', en: 'G force' }, `${td.g.toFixed(2)} G`, td.g < 1.4);
  const tdz = td.along; s -= tdz < 150 ? 20 : tdz < 250 ? 6 : tdz <= 750 ? 0 : tdz <= 1000 ? 8 : 22;
  it({ zh: '接地點（距跑道頭）', en: 'Touchdown point (past threshold)' }, `${Math.round(tdz)} m`, tdz >= 250 && tdz <= 750, tdz < 150 ? { zh: '太早落地了', en: 'Too early' } : tdz > 1000 ? { zh: '落得太遠，跑道可能不夠', en: 'Too long: you may run out of runway' } : null);
  const cl = Math.abs(td.across); s -= cl < 3 ? 0 : cl < 8 ? 5 : cl < 15 ? 14 : 30;
  it({ zh: '偏離中心線', en: 'Off the centreline' }, `${cl.toFixed(1)} m`, cl < 5);
  const crab = Math.abs(td.crab); s -= crab < 2 ? 0 : crab < 5 ? 5 : 14; it({ zh: '機頭偏角', en: 'Crab angle' }, `${crab.toFixed(1)}°`, crab < 3, crab >= 5 ? { zh: '落地前要踩舵把機頭對正跑道', en: 'Kick the nose straight with rudder before touchdown' } : null);
  const dv = td.ias - T.vref; s -= Math.abs(dv) < 8 ? 0 : Math.abs(dv) < 15 ? 6 : 15; it({ zh: '接地速度', en: 'Touchdown speed' }, `${Math.round(td.ias)} kt (Vref ${T.vref})`, Math.abs(dv) < 10);
  it({ zh: '接地姿態', en: 'Pitch at touchdown' }, `${td.pitch.toFixed(1)}°`, td.pitch > 1 && td.pitch < T.tail - 2);
  if (F.events.some((e) => e.k === 'tailstrike')) { s -= 35; it({ zh: '機尾擦地', en: 'Tail strike' }, '!', false, { zh: '仰角太大了', en: 'The nose was too high' }); }
  if (F.events.some((e) => e.k === 'nosefirst')) { s -= 25; it({ zh: '前輪先著地', en: 'Nose wheel first' }, '!', false); }
  if (F.bounce) { s -= 10 * F.bounce; it({ zh: '彈跳', en: 'Bounces' }, `${F.bounce}`, false); }
  if (F.offOnce) { s -= 40; it({ zh: '衝出跑道', en: 'Runway excursion' }, '!', false); }
  if (F.stopped) { const left = F.RW.ilsLen - 120 - F.along; it({ zh: '停止時剩餘跑道', en: 'Runway left when stopped' }, `${Math.round(Math.max(0, left))} m`, left > 300); }
  if (F.crashed) { s = Math.min(s, 5); out.title = { zh: '墜機', en: 'Crashed' }; }
  out.score = clamp(Math.round(s), 0, 100); out.stars = out.score >= 90 ? 3 : out.score >= 70 ? 2 : out.score >= 45 ? 1 : 0;
  out.title ||= out.score >= 90 ? { zh: '完美降落！', en: 'Perfect landing!' } : out.score >= 70 ? { zh: '不錯的降落', en: 'A good landing' } : out.score >= 45 ? { zh: '安全落地', en: 'Down safely' } : { zh: '要再練習', en: 'Needs practice' };
  return out;
}
