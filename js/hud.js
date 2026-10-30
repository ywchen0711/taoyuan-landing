// What the pilot reads: a head-up display in the cockpit view (pitch ladder, flight path vector, flight director,
// speed and altitude tapes, heading, ILS deviation, modes, warnings), a small flight display and map for the outside
// views, and the window frames of the cockpit.
import { KT, FT } from './data.js';
import { R2D } from './flight.js';

const GREEN = '#5aff8a', MAG = '#ff5af0', AMBER = '#ffb030', RED = '#ff4040', CY = '#5ae8ff';
export function drawHUD(g, W, H, F, o) {
  g.clearRect(0, 0, W, H);
  const cockpit = o.view === 'cockpit', s = Math.min(W, H) / 700, ppd = H / o.fovV; // pixels per degree (conformal in the cockpit)
  if (cockpit) frame(g, W, H);
  g.save(); g.lineWidth = 2 * s; g.font = `${Math.round(15 * s)}px "Consolas", "Menlo", monospace`; g.textBaseline = 'middle';
  const col = cockpit ? GREEN : '#ffffff';
  g.strokeStyle = col; g.fillStyle = col; g.shadowColor = cockpit ? 'rgba(0,60,20,.9)' : 'rgba(0,0,0,.8)'; g.shadowBlur = 3 * s;
  const cx = cockpit ? W / 2 : 215 * s + 16, cy = cockpit ? H * 0.46 : H - 150 * s - 20, k = cockpit ? ppd : 3.2 * s;
  const pitch = F.pitch * R2D, roll = F.roll * R2D, gamma = Math.atan2(F.vel.y, Math.max(1, F.gs)) * R2D, trk = Math.atan2(F.vel.x, -F.vel.z), drift = ((trk - F.hdg + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * R2D;
  // ---- the attitude: horizon and pitch ladder (in a round window outside the cockpit)
  g.save();
  if (!cockpit) { g.beginPath(); g.arc(cx, cy, 110 * s, 0, 7); g.fillStyle = 'rgba(10,20,40,.55)'; g.fill(); g.clip(); }
  g.translate(cx, cy); g.rotate(-roll * Math.PI / 180);
  if (!cockpit) { g.fillStyle = 'rgba(70,130,220,.55)'; g.fillRect(-300 * s, -600 * s, 600 * s, 600 * s + pitch * k); g.fillStyle = 'rgba(150,100,50,.6)'; g.fillRect(-300 * s, pitch * k, 600 * s, 600 * s); g.fillStyle = col; }
  g.beginPath(); g.moveTo(-(cockpit ? W : 300 * s), pitch * k); g.lineTo(cockpit ? W : 300 * s, pitch * k); g.stroke();
  for (let p = -30; p <= 30; p += 5) { if (!p) continue; const y = (pitch - p) * k, w = (p % 10 ? 40 : 70) * s; g.setLineDash(p < 0 ? [8 * s, 6 * s] : []); g.beginPath(); g.moveTo(-w, y); g.lineTo(-w * 0.35, y); g.moveTo(w * 0.35, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]); if (p % 10 === 0) { g.textAlign = 'right'; g.fillText(Math.abs(p), -w - 6 * s, y); g.textAlign = 'left'; g.fillText(Math.abs(p), w + 6 * s, y); } }
  g.restore();
  // the bank scale
  g.save(); g.translate(cx, cy); for (const b of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) { g.save(); g.rotate(b * Math.PI / 180); g.beginPath(); g.moveTo(0, -(cockpit ? 190 : 100) * s); g.lineTo(0, -(cockpit ? (b % 30 ? 182 : 176) : 92) * s); g.stroke(); g.restore(); }
  g.rotate(-roll * Math.PI / 180); g.beginPath(); g.moveTo(0, -(cockpit ? 172 : 88) * s); g.lineTo(-7 * s, -(cockpit ? 160 : 78) * s); g.lineTo(7 * s, -(cockpit ? 160 : 78) * s); g.closePath(); g.stroke(); g.restore();
  // the aircraft's own symbol, the flight path vector, the flight director
  g.save(); g.translate(cx, cy);
  g.strokeStyle = cockpit ? col : '#ffd34d'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(-60 * s, 0); g.lineTo(-22 * s, 0); g.lineTo(-12 * s, 10 * s); g.moveTo(60 * s, 0); g.lineTo(22 * s, 0); g.lineTo(12 * s, 10 * s); g.stroke();
  g.strokeStyle = col; g.lineWidth = 2 * s;
  const fx = drift * k, fy = (pitch - gamma) * k; g.beginPath(); g.arc(fx, fy, 8 * s, 0, 7); g.moveTo(fx - 8 * s, fy); g.lineTo(fx - 24 * s, fy); g.moveTo(fx + 8 * s, fy); g.lineTo(fx + 24 * s, fy); g.moveTo(fx, fy - 8 * s); g.lineTo(fx, fy - 16 * s); g.stroke();
  if (F.fd && !F.onGround && F.ra > 30) { g.strokeStyle = MAG; g.lineWidth = 3 * s; const py = (pitch - F.fdPitch) * k, rx = (F.fdRoll - roll) * 1.6 * s; g.beginPath(); g.moveTo(-70 * s, py); g.lineTo(70 * s, py); g.moveTo(rx, -70 * s); g.lineTo(rx, 70 * s); g.stroke(); }
  g.restore();
  // ---- the speed tape (left), the altitude tape (right)
  const tapeH = (cockpit ? 300 : 220) * s, lx = cockpit ? cx - 300 * s : cx - 135 * s, rx = cockpit ? cx + 300 * s : cx + 135 * s;
  const ias = F.ias / KT, alt = (F.pos.y - F.T.mainH) / FT, vs = F.vs;
  tape(g, lx, cy, tapeH, ias, 10, 4, s, 'left', col, [[F.T.vref, MAG, 'REF'], [F.T.vref + 5, CY, '']]);
  tape(g, rx, cy, tapeH, alt, 100, 0.6, s, 'right', col, []);
  // speed trend
  const trend = (F.accel || 0) / KT * 10; g.save(); g.strokeStyle = AMBER; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(lx + 36 * s, cy); g.lineTo(lx + 36 * s, cy - trend * 4 * s); g.stroke(); g.restore();
  g.textAlign = 'left'; g.fillText(`${vs > 0 ? '+' : ''}${Math.round(vs / 50) * 50}`, rx + 58 * s, cy + tapeH / 2 - 10 * s);
  if (F.ra < 2500) { g.save(); g.font = `bold ${Math.round(20 * s)}px monospace`; g.textAlign = 'center'; g.fillStyle = F.ra < 200 ? AMBER : col; g.fillText(`RA ${Math.round(F.ra)}`, rx, cy + tapeH / 2 + 26 * s); g.restore(); }
  // ---- heading
  const hdg = ((F.hdg * R2D) + 360) % 360, hy = cockpit ? cy + 210 * s : cy + 128 * s, hw = cockpit ? 220 * s : 120 * s;
  g.save(); g.beginPath(); g.rect(cx - hw, hy - 20 * s, hw * 2, 40 * s); g.clip(); g.textAlign = 'center';
  for (let d = Math.floor(hdg / 5) * 5 - 40; d <= hdg + 40; d += 5) { const x = cx + (d - hdg) * (hw / 30); g.beginPath(); g.moveTo(x, hy - 18 * s); g.lineTo(x, hy - (d % 10 ? 12 : 6) * s); g.stroke(); if (d % 10 === 0) g.fillText(String(((d % 360) + 360) % 360 / 10 | 0).padStart(2, '0'), x, hy + 6 * s); }
  const rb = cx + (((F.RW.hdg - hdg + 540) % 360) - 180) * (hw / 30); g.fillStyle = MAG; g.beginPath(); g.moveTo(rb, hy - 20 * s); g.lineTo(rb - 6 * s, hy - 30 * s); g.lineTo(rb + 6 * s, hy - 30 * s); g.closePath(); g.fill();
  g.restore(); g.textAlign = 'center'; g.fillText(Math.round(hdg).toString().padStart(3, '0'), cx, hy - 34 * s);
  // ---- the ILS: localizer below, glideslope to the right of the attitude
  g.save(); const dot = (cockpit ? 36 : 22) * s;
  for (let i = -2; i <= 2; i++) if (i) { g.beginPath(); g.arc(cx + i * dot, cy + (cockpit ? 160 : 92) * s, 4 * s, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + (cockpit ? 240 : 112) * s, cy + i * dot, 4 * s, 0, 7); g.stroke(); }
  g.fillStyle = MAG; const lx2 = cx + Math.max(-2.4, Math.min(2.4, F.loc / 0.6)) * dot * -1 * -1, ly2 = cy + (cockpit ? 160 : 92) * s;
  diamond(g, cx - Math.max(-2.4, Math.min(2.4, F.loc / 0.6)) * dot, ly2, 8 * s); diamond(g, cx + (cockpit ? 240 : 112) * s, cy + Math.max(-2.4, Math.min(2.4, F.gsDev / 0.3)) * dot, 8 * s); void lx2;
  g.restore();
  // ---- modes, configuration
  g.textAlign = 'left'; g.font = `bold ${Math.round(15 * s)}px monospace`;
  const mx = cockpit ? cx - 300 * s : cx - 200 * s, my = cockpit ? cy - 230 * s : cy - 150 * s - 14;
  const modes = [[F.at ? 'A/THR SPEED' : 'MAN THR', F.at ? GREEN : '#cccccc'], [F.ap ? 'AP1  LOC  G/S' : F.fd ? 'FD   LOC  G/S' : 'MANUAL', F.ap ? GREEN : CY]];
  modes.forEach(([t, c], i) => { g.fillStyle = c; g.fillText(t, mx + i * 160 * s, my); });
  const fl = F.T.flapNames[Math.round(F.flapIdx)], conf = [`FLAPS ${fl}${Math.abs(F.flap - F.flapIdx) > 0.02 ? '…' : ''}`, F.gearPos > 0.99 ? 'GEAR ▼▼▼' : F.gearPos > 0.01 ? 'GEAR ···' : 'GEAR UP', F.spo > 0.1 ? 'SPOILERS' : F.spoArm ? 'SPLR ARM' : '', `BRK ${F.autobrake}`, F.revOn ? 'REV' : '', F.speedbrake ? 'SPD BRK' : ''].filter(Boolean);
  conf.forEach((t, i) => { g.fillStyle = t.includes('▼') ? GREEN : t === 'GEAR UP' ? '#cccccc' : t.includes('···') ? AMBER : t === 'REV' ? GREEN : col; g.fillText(t, cockpit ? cx + 140 * s : cx + 215 * s, (cockpit ? cy - 230 * s : cy - 110 * s) + i * 18 * s); });
  g.fillStyle = col; g.fillText(`N1 ${Math.round(F.n1 * 100)}%`, cockpit ? cx - 300 * s : cx + 215 * s, cockpit ? cy + 250 * s : cy + 60 * s);
  g.fillText(`${F.RW.R.name}  ${F.distNm.toFixed(1)} NM`, cockpit ? cx + 140 * s : cx + 215 * s, cockpit ? cy + 250 * s : cy + 78 * s);
  const w = F.wind0, wdir = ((Math.atan2(-w.x, w.z) * R2D) + 360) % 360, wkt = Math.hypot(w.x, w.z) / KT;
  g.fillText(`WIND ${Math.round(wdir).toString().padStart(3, '0')}/${Math.round(wkt)}${F.gustKt ? 'G' + Math.round(wkt + F.gustKt) : ''}`, cockpit ? cx - 300 * s : cx + 215 * s, cockpit ? cy + 270 * s : cy + 96 * s);
  // ---- warnings
  if (o.warn) { g.save(); g.font = `bold ${Math.round(30 * s)}px Arial`; g.textAlign = 'center'; g.fillStyle = o.warn.red ? RED : AMBER; g.shadowColor = '#000'; g.shadowBlur = 8; if ((performance.now() / 300 | 0) % 2 || !o.warn.red) g.fillText(o.warn.text, W / 2, cockpit ? cy - 120 * s : H * 0.25); g.restore(); }
  g.restore();
  if (!cockpit) map(g, W, H, F, s);
}
function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.7, y); g.closePath(); g.fill(); }
function tape(g, x, cy, h, v, step, ppu, s, side, col, bugs) {
  g.save(); const w = 64 * s, x0 = side === 'left' ? x - w : x; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, cy - h / 2, w, h); g.beginPath(); g.rect(x0, cy - h / 2, w, h); g.clip(); g.fillStyle = col; g.strokeStyle = col;
  const span = h / 2 / (ppu * s), lo = Math.floor((v - span) / step) * step; g.textAlign = side === 'left' ? 'right' : 'left';
  for (let t = lo; t <= v + span; t += step) { const y = cy - (t - v) * ppu * s; g.beginPath(); g.moveTo(side === 'left' ? x : x, y); g.lineTo(side === 'left' ? x - 10 * s : x + 10 * s, y); g.stroke(); if (t % (step * 2) === 0) g.fillText(Math.round(t), side === 'left' ? x - 14 * s : x + 14 * s, y); }
  for (const [b, c, txt] of bugs) { const y = cy - (b - v) * ppu * s; g.fillStyle = c; g.fillRect(side === 'left' ? x - 6 * s : x, y - 2 * s, 6 * s, 4 * s); if (txt) { g.font = `${Math.round(11 * s)}px monospace`; g.fillText(txt, side === 'left' ? x - 16 * s : x + 16 * s, y); } }
  g.restore();
  g.save(); g.fillStyle = '#000'; g.strokeStyle = col; g.lineWidth = 2 * s; const bw = 70 * s, bx = side === 'left' ? x - w - 6 * s : x + 2 * s; g.fillRect(bx, cy - 15 * s, bw, 30 * s); g.strokeRect(bx, cy - 15 * s, bw, 30 * s); g.fillStyle = col; g.font = `bold ${Math.round(18 * s)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.round(v), bx + bw / 2, cy); g.restore();
}
function frame(g, W, H) { // the cockpit's window posts and the glare shield
  g.save(); g.fillStyle = '#1a1c20';
  g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.78); g.quadraticCurveTo(W * 0.5, H * 0.7, W, H * 0.78); g.lineTo(W, H); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(W * 0.16, H * 0.78); g.lineTo(W * 0.21, 0); g.lineTo(W * 0.235, 0); g.lineTo(W * 0.19, H * 0.77); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(W * 0.84, H * 0.78); g.lineTo(W * 0.79, 0); g.lineTo(W * 0.765, 0); g.lineTo(W * 0.81, H * 0.77); g.closePath(); g.fill();
  g.fillRect(0, 0, W, H * 0.025); g.restore();
}
function map(g, W, H, F, s) { // a little map, north up, 12 nm across
  const R = 90 * s, cx = W - R - 20, cy = H - R - 20 - (document.body.classList.contains('touch') ? 0 : 0), sc = R / (6 * 1852);
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = 'rgba(10,20,40,.6)'; g.fill(); g.clip();
  const P = (x, z) => [cx + (x - F.pos.x) * sc, cy + (z - F.pos.z) * sc];
  // the runway and its approach line
  const T = F.RW, a = P(T.x, T.z), b = P(T.x + T.dx * (T.ilsLen - 240), T.z + T.dz * (T.ilsLen - 240)), c0 = P(T.x - T.dx * 20000, T.z - T.dz * 20000);
  g.strokeStyle = 'rgba(255,90,240,.7)'; g.setLineDash([6 * s, 6 * s]); g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(a[0], a[1]); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#fff'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  // the aircraft
  g.translate(cx, cy); g.rotate(F.hdg); g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(0, -10 * s); g.lineTo(7 * s, 8 * s); g.lineTo(0, 4 * s); g.lineTo(-7 * s, 8 * s); g.closePath(); g.fill();
  g.restore(); g.save(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = `${Math.round(11 * s)}px monospace`; g.textAlign = 'center'; g.fillText('N', cx, cy - R + 10 * s); g.restore();
}
