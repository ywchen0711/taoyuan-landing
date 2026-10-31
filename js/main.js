// 桃園機場降落 Taoyuan Landing: fly a China Airlines, EVA Air or STARLUX jet down to Taoyuan International Airport.
// The menu (airline, aircraft, scenario or your own conditions), the flight (controls, cameras, callouts, the
// tower), the landing report, and a replay of the landing from the ground.
import * as THREE from '../lib/three.module.min.js';
import { TYPES, AIRLINES, SCENARIOS, RUNWAYS, TIMES, WXS, KT, FT } from './data.js';
import { buildWorld, updateLights, updateWeather } from './world.js';
import { makeAircraft } from './aircraft.js';
import { createFlight, grade, R2D, D2R, clamp } from './flight.js';
import { drawHUD } from './hud.js';
import { audioInit, engineSound, sfx, callout, radio, setMute, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view'), hud = $('hud'), hg = hud.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 200000);
let scene = null, W = null, AC = null, F = null, landLight = null;

// ---------------------------------------------------------------- choices, saves, words
const KEY = 'tpeLanding.v1';
let save = { lang: 'zh', best: {}, al: 'eva', type: 'b787', scen: 'train', cam: 'chase', tilt: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* none */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* none */ } };
const T = (o) => (typeof o === 'string' ? o : o?.[save.lang] ?? o?.zh ?? '');
const custom = { rwy: '05L', time: 'day', wx: 'cloudy', wind: 'light', dist: 6, ap: false, at: true, fd: true };
const WINDS = { calm: [[50, 0, 0], { zh: '無風', en: 'Calm' }], light: [[60, 8, 3], { zh: '微風', en: 'Light' }], cross: [[140, 18, 6], { zh: '側風', en: 'Crosswind' }], gusty: [[30, 24, 14], { zh: '強陣風', en: 'Strong gusts' }] };

// ---------------------------------------------------------------- the menu
function menu() {
  mode = 'menu'; $('menu').hidden = false; $('report').hidden = true; $('pause').hidden = true; $('flyui').hidden = true; $('coach').hidden = true; document.body.classList.remove('flying');
  const L = save.lang, al = AIRLINES[save.al];
  if (!al.types.includes(save.type)) save.type = al.types[0];
  $('alrow').innerHTML = Object.entries(AIRLINES).map(([id, a]) => `<button class="al ${id === save.al ? 'on' : ''}" data-al="${id}" style="--c:${a.tint}"><b>${T(a.name)}</b><small>${a.code} · ${a.call}</small></button>`).join('');
  $('tyrow').innerHTML = al.types.map((t) => `<button class="${t === save.type ? 'on' : ''}" data-ty="${t}">${TYPES[t].name}<small>Vref ${TYPES[t].vref} kt</small></button>`).join('');
  $('scrow').innerHTML = SCENARIOS.map((s) => `<button class="sc ${s.id === save.scen ? 'on' : ''}" data-sc="${s.id}"><b>${T(s.name)}</b><small>${T(s.desc)}</small>${save.best[s.id] != null ? `<i>${'★'.repeat(save.best[s.id].stars)}${'☆'.repeat(3 - save.best[s.id].stars)} ${save.best[s.id].score}</i>` : ''}</button>`).join('') + `<button class="sc ${save.scen === 'custom' ? 'on' : ''}" data-sc="custom"><b>${T({ zh: '自訂', en: 'Custom' })}</b><small>${T({ zh: '自己選跑道、時間、天氣和風', en: 'Choose the runway, time, weather and wind yourself' })}</small></button>`;
  const opt = (key, list, names) => `<label>${names}<select data-c="${key}">${Object.entries(list).map(([k, v]) => `<option value="${k}" ${String(custom[key]) === String(k) ? 'selected' : ''}>${T(v)}</option>`).join('')}</select></label>`;
  $('custom').hidden = save.scen !== 'custom';
  $('custom').innerHTML = opt('rwy', Object.fromEntries(Object.keys(RUNWAYS).map((k) => [k, k])), T({ zh: '跑道', en: 'Runway' })) + opt('time', TIMES, T({ zh: '時間', en: 'Time' })) + opt('wx', WXS, T({ zh: '天氣', en: 'Weather' })) + opt('wind', Object.fromEntries(Object.entries(WINDS).map(([k, v]) => [k, v[1]])), T({ zh: '風', en: 'Wind' })) + opt('dist', { 3: '3 NM', 6: '6 NM', 10: '10 NM' }, T({ zh: '起始距離', en: 'Start' }))
    + `<label><input type="checkbox" data-c="ap" ${custom.ap ? 'checked' : ''}> ${T({ zh: '自動駕駛到 200 呎', en: 'Autopilot to 200 ft' })}</label><label><input type="checkbox" data-c="at" ${custom.at ? 'checked' : ''}> ${T({ zh: '自動油門', en: 'Autothrottle' })}</label><label><input type="checkbox" data-c="fd" ${custom.fd ? 'checked' : ''}> ${T({ zh: '飛行導引', en: 'Flight director' })}</label>`;
  document.querySelectorAll('[data-t]').forEach((e) => (e.textContent = T(UI[e.dataset.t])));
  $('langBtn').textContent = L === 'zh' ? 'English' : '中文';
  $('tiltBtn').textContent = T({ zh: `📱 傾斜操控：${save.tilt ? '開' : '關'}`, en: `📱 Tilt to steer: ${save.tilt ? 'on' : 'off'}` });
}
const UI = {
  title: { zh: '桃園機場降落', en: 'Taoyuan Landing' }, sub: { zh: '駕駛華航、長榮、星宇的客機，降落台灣桃園國際機場', en: 'Fly China Airlines, EVA Air and STARLUX jets down to Taiwan Taoyuan International Airport' },
  h1: { zh: '航空公司', en: 'Airline' }, h2: { zh: '機型', en: 'Aircraft' }, h3: { zh: '任務', en: 'Scenario' }, go: { zh: '開始進場 ✈', en: 'Begin the approach ✈' },
  help: { zh: '操作說明', en: 'Controls' }, again: { zh: '再降落一次', en: 'Fly it again' }, replay: { zh: '🎬 觀看回放', en: '🎬 Watch the replay' }, back: { zh: '回到選單', en: 'Back to the menu' },
  resume: { zh: '繼續飛行', en: 'Resume' }, restart: { zh: '重新開始', en: 'Restart' },
  helpText: { zh: '俯仰：W/S 或 ↑/↓（↓ 拉機頭）　滾轉：A/D 或 ←/→　方向舵：Q/E\n油門：R 加 / F 減　襟翼：V 放下、Shift+V 收起　起落架：G\n煞車：空白鍵（按住）　反推力：X　減速板：B　自動駕駛：P　自動油門：T\n視角：C 切換，或 1 駕駛艙・2 追蹤・3 環繞・4 塔台・5 跑道旁・6 機翼\n快轉：N（自動：遠處 3 倍速，接近地面變回正常速度）　教練面板：H\n手把：左搖桿俯仰滾轉、右搖桿方向舵、RT/LT 油門、A 煞車、B 反推、X/Y 襟翼、LB 起落架、RB 視角\n\n落地訣竅：對準跑道中心線，保持 3 度下滑（PAPI 兩白兩紅），速度維持在 Vref+5。50 呎左右收油門、輕輕拉機頭「拉平」，讓主輪先著地，再放下機頭、開反推、踩煞車。\n\n觸控：左下圓盤是駕駛桿（往下拉＝拉機頭、往上推＝壓機頭、左右＝轉彎），右邊滑桿是油門，按鈕放起落架、襟翼、煞車、反推。\n\n降落步驟（飛行時左上角的教練面板會一步一步提醒你）：\n1. 對準跑道：HUD 下方的菱形偏哪邊就往哪邊轉，直到菱形在正中間。\n2. 放下起落架（G），襟翼一格一格放到最大（V）。速度太快時襟翼放不下去，先減油門。\n3. 速度保持 Vref+5（速度帶上紫色 REF 記號再上面一點）。\n4. 沿 3 度下滑：跑道左邊的 PAPI 燈兩白兩紅剛好；白太多是太高、紅太多是太低。也可以跟著 HUD 上的紫色十字飛。\n5. 50 呎：油門收到底。30 呎：輕輕拉機頭「拉平」，讓主輪先著地，下降率越小分數越高。\n6. 落地後：放下機頭、開反推（X）、煞車（空白鍵），慢下來後收反推，停在跑道上就完成了。', en: 'Pitch: W/S or ↑/↓ (↓ raises the nose)  Roll: A/D or ←/→  Rudder: Q/E\nThrottle: R more / F less  Flaps: V extend, Shift+V retract  Gear: G\nBrakes: Space (hold)  Reversers: X  Speed brake: B  Autopilot: P  Autothrottle: T\nCameras: C cycles, or 1 cockpit · 2 chase · 3 orbit · 4 tower · 5 runway side · 6 wing\nFast-forward: N (auto 3× far out, real time near the ground)  Coach panel: H\nGamepad: left stick pitch/roll, right stick rudder, RT/LT throttle, A brakes, B reversers, X/Y flaps, LB gear, RB camera\n\nHow to land: line up on the centreline, hold a 3° path (PAPI two white, two red) at Vref+5. Near 50 ft pull the thrust to idle and raise the nose gently to flare, let the mains touch first, then lower the nose, reversers on, brakes.\n\nTouch: the circle at bottom left is the yoke (pull down = nose up, push up = nose down, sideways = turn), the slider on the right is the throttle, and the buttons work the gear, flaps, brakes and reversers.\n\nStep by step (the coach panel at the top left reminds you while you fly):\n1. Line up: turn toward the diamond under the HUD until it is centred.\n2. Gear down (G), flaps out one notch at a time to full (V). If you are too fast the flaps will not go; take thrust off first.\n3. Hold Vref+5 (just above the magenta REF mark on the speed tape).\n4. Fly a 3° path: two white and two red PAPI lights left of the runway. More white is high, more red is low. Or follow the magenta cross on the HUD.\n5. At 50 ft: thrust to idle. At 30 ft: raise the nose gently to flare so the mains touch first; the softer, the better the score.\n6. On the runway: nose down, reversers (X), brakes (Space), stow the reversers when slow, and stop on the runway.' },
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-al]'); if (a) { save.al = a.dataset.al; save.type = AIRLINES[save.al].types[0]; store(); menu(); }
  const t = e.target.closest('[data-ty]'); if (t) { save.type = t.dataset.ty; store(); menu(); }
  const s = e.target.closest('[data-sc]'); if (s) { save.scen = s.dataset.sc; store(); menu(); }
});
document.addEventListener('change', (e) => { const c = e.target.closest('[data-c]'); if (!c) return; custom[c.dataset.c] = c.type === 'checkbox' ? c.checked : c.dataset.c === 'dist' ? +c.value : c.value; });
$('goBtn').onclick = () => { audioInit(); askTilt().then(() => start()); };
$('langBtn').onclick = () => { save.lang = save.lang === 'zh' ? 'en' : 'zh'; store(); menu(); };
$('helpBtn').onclick = () => { $('helpBox').hidden = !$('helpBox').hidden; };
$('tiltBtn').onclick = () => { save.tilt = !save.tilt; store(); menu(); };
$('againBtn').onclick = () => start(); $('replayBtn').onclick = () => replay(); $('menuBtn').onclick = () => menu();
$('resumeBtn').onclick = () => pause(false); $('restartBtn').onclick = () => start(); $('quitBtn').onclick = () => menu();
async function askTilt() { if (!save.tilt || typeof DeviceOrientationEvent === 'undefined' || !DeviceOrientationEvent.requestPermission) return; try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* none */ } }

// ---------------------------------------------------------------- the flight
let mode = 'menu', cfg = null, t0 = 0, rec = [], said = {}, warnT = 0, warn = null, reportT = 0, sub = null, subT = 0, camMode = save.cam, orbit = { yaw: 2.2, pitch: 0.12, dist: 0.75 }, look = { yaw: 0, pitch: 0 };
function scenarioCfg() {
  if (save.scen === 'custom') return { id: 'custom', name: { zh: '自訂', en: 'Custom' }, rwy: custom.rwy, time: custom.time, wx: custom.wx, wind: WINDS[custom.wind][0], dist: custom.dist, ap: custom.ap, at: custom.at, fd: custom.fd };
  return SCENARIOS.find((s) => s.id === save.scen) || SCENARIOS[0];
}
function disposeScene() { if (!scene) return; scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) for (const mm of [].concat(m)) { for (const k of ['map', 'emissiveMap']) mm[k]?.dispose(); mm.dispose(); } }); scene = null; }
function start() {
  audioInit(); disposeScene();
  cfg = scenarioCfg(); scene = new THREE.Scene();
  W = buildWorld(scene, renderer, cfg);
  AC = makeAircraft(save.type, save.al); scene.add(AC.root);
  if (cfg.time !== 'day') AC.root.traverse((o) => { const m = o.material; if (m?.isMeshStandardMaterial) { m.emissive = new THREE.Color(cfg.time === 'night' ? '#3a3a44' : '#1a1a1a'); if (m.map) m.emissiveMap = m.map; m.needsUpdate = true; } }); // the cabin and logo lights, faintly
  F = createFlight(save.type, { rwy: cfg.rwy, dist: cfg.dist, wind: cfg.wind, wx: cfg.wx, ap: cfg.ap, at: cfg.at, fd: cfg.fd });
  landLight = new THREE.SpotLight('#fff4e0', cfg.time === 'day' ? 0 : 900, 1500, 0.32, 0.5, 1.1); scene.add(landLight, landLight.target);
  rec = []; said = {}; warn = null; reportT = 0; coachDone = {}; coachT = 0; warpCur = 1; t0 = performance.now(); mode = 'fly'; placeCamera.c = null; lastRA = 99999;
  $('menu').hidden = true; $('report').hidden = true; $('pause').hidden = true; $('flyui').hidden = false; document.body.classList.add('flying'); setCoach(save.coach !== false); setWarp(save.warp === 1 ? 1 : 'auto');
  const A = AIRLINES[save.al], num = A.nums[(Math.random() * A.nums.length) | 0], [wd, wk] = cfg.wind;
  F.callsign = `${A.call} ${num}`; F.flightNo = `${A.code}${num}`;
  setTimeout(() => say(`${F.callsign}, Taipei Tower, runway ${spell(cfg.rwy)}, wind ${String(wd).padStart(3, '0')} at ${wk} knots, cleared to land.`, { zh: `${F.callsign}，台北塔台，跑道 ${cfg.rwy}，風向 ${String(wd).padStart(3, '0')}、${wk} 節，許可落地。`, en: `${F.callsign}, Taipei Tower, runway ${cfg.rwy}, wind ${String(wd).padStart(3, '0')} at ${wk} knots, cleared to land.` }), 1200);
  if (cfg.id === 'train') setTimeout(() => hint({ zh: '自動駕駛會帶你到 200 呎。聽到「Minimums」後，收油門（F）並在 30 呎左右輕拉機頭（S 或 ↓）。', en: 'The autopilot takes you down to 200 ft. At "Minimums", pull the thrust back (F) and near 30 ft raise the nose gently (S or ↓).' }), 7000);
  resize();
}
const spell = (r) => r.replace('L', ' left').replace('R', ' right').replace(/^0/, 'zero ').replace(/^2/, 'two ').replace(/3 /, 'three ').replace(/5 /, 'five ');
function say(radioText, subText) { radio(radioText); sub = subText; subT = 7; }
function hint(text) { sub = text; subT = 9; }
function pause(v) { if (mode !== 'fly' && mode !== 'pause') return; mode = v ? 'pause' : 'fly'; $('pause').hidden = !v; }

// ---------------------------------------------------------------- fast-forward: the long part of the approach runs quicker
let warpCur = 1;
function warpWant() {
  if (save.warp === 1 || !F) return 1;
  if (warn?.red) return 1;
  if (F.onGround) return F.gs < 40 * KT && !F.stopped ? 2 : 1;
  return clamp(1 + (F.ra - 300) / 300, 1, 3); // 3× above 900 ft, real time below 300 ft
}
function setWarp(v) { save.warp = v; store(); $('warpBtn').textContent = v === 1 ? '⏵ 1×' : '⏩ ' + T({ zh: '自動', en: 'Auto' }); }

// ---------------------------------------------------------------- the coach: what to do next, in plain words
const KEYN = {
  down: [{ zh: 'W', en: 'W' }, { zh: '搖桿往上推', en: 'push the stick up' }], up: [{ zh: 'S', en: 'S' }, { zh: '搖桿往下拉', en: 'pull the stick down' }],
  left: [{ zh: 'A', en: 'A' }, { zh: '搖桿往左', en: 'stick left' }], right: [{ zh: 'D', en: 'D' }, { zh: '搖桿往右', en: 'stick right' }],
  rudL: [{ zh: 'Q', en: 'Q' }, { zh: '搖桿往左', en: 'stick left' }], rudR: [{ zh: 'E', en: 'E' }, { zh: '搖桿往右', en: 'stick right' }],
  more: [{ zh: 'R', en: 'R' }, { zh: '油門往上推', en: 'throttle up' }], less: [{ zh: '按住 F', en: 'hold F' }, { zh: '油門拉到底', en: 'throttle to the bottom' }],
  gear: [{ zh: 'G', en: 'G' }, { zh: 'GEAR', en: 'GEAR' }], flap: [{ zh: 'V', en: 'V' }, { zh: 'FLAP+', en: 'FLAP+' }],
  rev: [{ zh: 'X', en: 'X' }, { zh: 'REV', en: 'REV' }], brake: [{ zh: '按住空白鍵', en: 'hold Space' }, { zh: '按住 BRAKE', en: 'hold BRAKE' }],
};
const K = (k) => T(KEYN[k][touch.on ? 1 : 0]);
const Z = (zh, en) => ({ zh, en });
let coachT = 0, coachDone = {};
function coachAdvice() {
  const ias = F.ias / KT, ref = F.T.vref + 5, ra = F.ra, d = F.distNm;
  if (F.crashed) return Z('💥 飛機損壞了', '💥 The aircraft is damaged');
  if (F.stopped) return Z('✅ 停住了！做得好，馬上看成績。', '✅ Stopped! Well done, your score is coming.');
  if (F.onGround) {
    const g = F.gs / KT;
    if (!F.nose && g > 60) return Z(`主輪著地！機頭輕輕往下放（${K('down')}）`, `Mains down! Lower the nose gently (${K('down')})`);
    if (Math.abs(F.across) > 8) return F.across > 0 ? Z(`偏右了，踩舵往左（${K('rudL')}）回到中心線`, `Drifting right: rudder left (${K('rudL')}) back to the centreline`) : Z(`偏左了，踩舵往右（${K('rudR')}）回到中心線`, `Drifting left: rudder right (${K('rudR')}) back to the centreline`);
    if (!F.rev && g > 70) return Z(`開反推力（${K('rev')}）幫忙減速`, `Reversers on (${K('rev')}) to slow down`);
    if (F.rev && g < 60) return Z(`速度降下來了，收反推（再按 ${K('rev')}）`, `Slow now: stow the reversers (${K('rev')} again)`);
    if (F.brake < 0.1 && F.autobrake === 'OFF') return Z(`踩煞車（${K('brake')}）直到停住`, `Brakes (${K('brake')}) until you stop`);
    return Z(`自動煞車在減速，想停快一點就${K('brake')}`, `Autobrake is slowing you; ${K('brake')} to stop sooner`);
  }
  if (warn?.text === 'STALL') return Z(`失速！機頭往下（${K('down')}）、加油門（${K('more')}）`, `Stall! Nose down (${K('down')}), more thrust (${K('more')})`);
  if (warn && /PULL UP|SINK/.test(warn.text)) return Z(`下降太快！拉機頭（${K('up')}）、加油門（${K('more')}）`, `Sinking too fast! Nose up (${K('up')}), more thrust (${K('more')})`);
  if (F.ap) return Z('自動駕駛正在飛，先看著 HUD。到 200 呎（聽到 Minimums）就交給你。', 'The autopilot is flying: watch the HUD. At 200 ft ("Minimums") it is yours.');
  if (ra < 60) {
    if (F.thr > 0.05) return Z(`收油門（${K('less')}）！`, `Thrust idle (${K('less')})!`);
    if (ra < 40 && F.vs < -350) return Z(`現在輕拉機頭（${K('up')}）拉平，讓下降變慢`, `Flare now: raise the nose gently (${K('up')})`);
    const crab = ((F.hdg * R2D - F.RW.hdg + 540) % 360) - 180;
    if (Math.abs(crab) > 3) return crab > 0 ? Z(`踩舵（${K('rudL')}）把機頭對正跑道`, `Rudder (${K('rudL')}) to line the nose up with the runway`) : Z(`踩舵（${K('rudR')}）把機頭對正跑道`, `Rudder (${K('rudR')}) to line the nose up with the runway`);
    return Z('保持住……等主輪輕輕碰地', 'Hold it... let the mains settle on');
  }
  if (!F.gear) return Z(`放下起落架（${K('gear')}）！`, `Gear down (${K('gear')})!`);
  if (F.flapIdx < 4) {
    const vmax = [340, 230, 215, 195, 180][Math.round(F.flapIdx) + 1];
    if (ias > vmax - 3) return Z(`先減速到 ${vmax} 節以下（${K('less')}），再放襟翼`, `Slow below ${vmax} kt (${K('less')}), then more flaps`);
    return Z(`放襟翼（${K('flap')}）：現在 ${F.T.flapNames[Math.round(F.flapIdx)]}，要放到 ${F.T.flapNames[4]}`, `Flaps (${K('flap')}): now ${F.T.flapNames[Math.round(F.flapIdx)]}, set ${F.T.flapNames[4]}`);
  }
  if (Math.abs(F.loc) > 0.35) return F.loc > 0 ? Z(`在跑道右邊：往左轉（${K('left')}）對準中心線，HUD 下方的菱形在左`, `Right of the runway: turn left (${K('left')}); the diamond under the HUD is on the left`) : Z(`在跑道左邊：往右轉（${K('right')}）對準中心線，HUD 下方的菱形在右`, `Left of the runway: turn right (${K('right')}); the diamond under the HUD is on the right`);
  if (F.gsDev > 0.35) return Z(`太高了：機頭稍微往下（${K('down')}），PAPI 要兩白兩紅`, `Too high: nose down a little (${K('down')}); the PAPI wants two white, two red`);
  if (F.gsDev < -0.35) return Z(`太低了：拉一點機頭（${K('up')}）、加油門（${K('more')}）`, `Too low: nose up a little (${K('up')}), more thrust (${K('more')})`);
  if (!F.at && ias > ref + 10) return Z(`太快了：減油門（${K('less')}），目標 ${ref} 節`, `Too fast: less thrust (${K('less')}), aim for ${ref} kt`);
  if (!F.at && ias < ref - 4) return Z(`太慢了：加油門（${K('more')}），目標 ${ref} 節`, `Too slow: more thrust (${K('more')}), aim for ${ref} kt`);
  return Z(`很好，保持住！速度 ${ref} 節、跟著紫色十字（飛行導引）`, `Good, hold it! ${ref} kt, follow the magenta cross (flight director)`);
}
function coach(dt) {
  if ((coachT -= dt) > 0) return; coachT = 0.2;
  const ias = F.ias / KT, ref = F.T.vref + 5, td = !!said.welcome || F.onGround;
  if (F.ra < 60 && F.thr <= 0.05 && !F.onGround) coachDone.idle = true;
  if (td) { coachDone.td = true; coachDone.idle = true; }
  if (F.onGround && (F.revOn || F.brake > 0.1 || F.autobrake !== 'OFF')) coachDone.slow = true;
  const steps = [
    [Z('對準跑道中心線', 'Line up on the centreline'), td || Math.abs(F.loc) < 0.35],
    [Z('放下起落架', 'Gear down'), F.gearPos > 0.99],
    [Z(`襟翼放到 ${F.T.flapNames[4]}`, `Flaps ${F.T.flapNames[4]}`), F.flapIdx >= 4],
    [Z(`速度 ${ref} 節（現在 ${Math.round(ias)}）`, `Speed ${ref} kt (now ${Math.round(ias)})`), td || Math.abs(ias - ref) < 8],
    [Z('沿著 3° 下滑道', 'On the 3° glide path'), td || Math.abs(F.gsDev) < 0.35],
    [Z('50 呎收油門', 'Thrust idle at 50 ft'), !!coachDone.idle],
    [Z('拉平、主輪先著地', 'Flare, mains first'), !!coachDone.td],
    [Z('反推＋煞車', 'Reversers and brakes'), !!coachDone.slow],
    [Z('停在跑道上', 'Stop on the runway'), F.stopped],
  ];
  const cur = steps.findIndex((s) => !s[1]);
  const phase = F.onGround ? Z('落地滑行', 'Rollout') : F.ra < 60 ? Z('拉平', 'Flare') : F.ra < 1000 ? Z('短五邊', 'Short final') : Z('進場', 'Approach');
  $('cPhase').textContent = `${T(phase)} · ${F.distNm.toFixed(1)} NM · ${Math.round(F.ra)} ft${warpCur > 1.05 ? `  ⏩ ${warpCur.toFixed(1)}×` : ''}`;
  $('cNow').textContent = T(coachAdvice());
  $('cSteps').innerHTML = steps.map((s, i) => `<li class="${s[1] ? 'ok' : i === cur ? 'cur' : ''}">${s[1] ? '✓' : i === cur ? '▶' : '·'} ${T(s[0])}</li>`).join('');
}
function setCoach(v) { save.coach = v; store(); $('coach').hidden = !v || mode !== 'fly'; $('coachBtn').classList.toggle('on', v); }

// ---------------------------------------------------------------- input
const keys = new Set(), inp = { pitch: 0, roll: 0, yaw: 0, thr: 0, brake: 0 };
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys.add(e.code); audioInit();
  if (mode !== 'fly') { if (e.code === 'Escape' && mode === 'pause') pause(false); return; }
  const c = e.code;
  if (c === 'KeyG') { F.gear = F.gear ? 0 : 1; sfx('gear'); }
  if (c === 'KeyV' || c === 'BracketRight' || c === 'BracketLeft') { const up = e.shiftKey || c === 'BracketLeft'; F.flapIdx = clamp(F.flapIdx + (up ? -1 : 1), 0, 4); sfx('flaps'); }
  if (c === 'KeyX') { F.rev = !F.rev; if (F.rev) F.thr = 0; }
  if (c === 'KeyB') F.speedbrake = F.speedbrake ? 0 : 1;
  if (c === 'KeyP') { if (F.ap) F.apOff('pilot'); else { F.ap = true; F.gammaHold = null; sfx('click'); } }
  if (c === 'KeyT') { F.at = !F.at; sfx('click'); }
  if (c === 'KeyC') cycleCam();
  if (c === 'KeyN') setWarp(save.warp === 1 ? 'auto' : 1);
  if (c === 'KeyH') setCoach(save.coach === false);
  const n = /^Digit([1-6])$/.exec(c); if (n) setCam(['cockpit', 'chase', 'orbit', 'tower', 'runway', 'wing'][n[1] - 1]);
  if (c === 'Escape') pause(true);
  if (c === 'KeyM') setMute(!isMuted());
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const CAMS = ['chase', 'cockpit', 'orbit', 'tower', 'runway', 'wing'];
function setCam(m) { camMode = m; save.cam = m; store(); $('camBtn').textContent = '🎥 ' + T(CAMNAMES[m]); }
function cycleCam() { setCam(CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]); }
const CAMNAMES = { cockpit: { zh: '駕駛艙', en: 'Cockpit' }, chase: { zh: '追蹤', en: 'Chase' }, orbit: { zh: '環繞', en: 'Orbit' }, tower: { zh: '塔台', en: 'Tower' }, runway: { zh: '跑道旁', en: 'Runway side' }, wing: { zh: '機翼', en: 'Wing' } };
// dragging the picture: look round in the cockpit, swing round in the orbit view
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; if (camMode === 'orbit') { orbit.yaw -= dx * 0.006; orbit.pitch = clamp(orbit.pitch + dy * 0.004, -0.2, 1.3); } else if (camMode === 'cockpit') { look.yaw = clamp(look.yaw - dx * 0.004, -2.6, 2.6); look.pitch = clamp(look.pitch - dy * 0.003, -0.8, 0.6); } });
canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('dblclick', () => { look.yaw = look.pitch = 0; });
canvas.addEventListener('wheel', (e) => { orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.001), 0.6, 6); }, { passive: true });
// touch: a yoke you drag on the left, a throttle on the right, buttons
const touch = { on: false, yoke: null, px: 0, py: 0, brake: false };
addEventListener('touchstart', () => { if (!touch.on) { touch.on = true; document.body.classList.add('touch'); } }, { passive: true });
const yoke = $('yoke'), knob = $('yokeKnob');
yoke.addEventListener('pointerdown', (e) => { touch.yoke = { id: e.pointerId, x: e.clientX, y: e.clientY }; yoke.setPointerCapture(e.pointerId); });
yoke.addEventListener('pointermove', (e) => { if (!touch.yoke || e.pointerId !== touch.yoke.id) return; touch.px = clamp((e.clientX - touch.yoke.x) / 70, -1, 1); touch.py = clamp((e.clientY - touch.yoke.y) / 70, -1, 1); knob.style.transform = `translate(${touch.px * 45}px, ${touch.py * 45}px)`; });
const yokeUp = () => { touch.yoke = null; touch.px = touch.py = 0; knob.style.transform = ''; }; yoke.addEventListener('pointerup', yokeUp); yoke.addEventListener('pointercancel', yokeUp);
$('thrSlider').addEventListener('input', (e) => { if (F) { F.at = false; F.thr = +e.target.value / 100; } });
const tb = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (F && mode === 'fly') fn(); });
tb('tGear', () => { F.gear = F.gear ? 0 : 1; sfx('gear'); }); tb('tFlapDn', () => { F.flapIdx = Math.min(4, F.flapIdx + 1); sfx('flaps'); }); tb('tFlapUp', () => { F.flapIdx = Math.max(0, F.flapIdx - 1); sfx('flaps'); });
tb('tRev', () => { F.rev = !F.rev; if (F.rev) F.thr = 0; }); tb('tAP', () => { if (F.ap) F.apOff('pilot'); else { F.ap = true; F.gammaHold = null; } }); tb('tAT', () => { F.at = !F.at; });
$('tBrake').addEventListener('pointerdown', () => (touch.brake = true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('tBrake').addEventListener(ev, () => (touch.brake = false));
$('camBtn').onclick = () => cycleCam(); $('warpBtn').onclick = () => setWarp(save.warp === 1 ? 'auto' : 1); $('coachBtn').onclick = () => setCoach(save.coach === false); $('pauseBtn').onclick = () => pause(true);
// tilting the tablet like a yoke
const tilt = { b: 0, g: 0, on: false, base: null };
addEventListener('deviceorientation', (e) => { if (!save.tilt || e.beta == null) return; tilt.on = true; const land = Math.abs(window.orientation || screen.orientation?.angle || 0) === 90; const p = land ? e.gamma : e.beta, r = land ? e.beta * Math.sign(window.orientation || screen.orientation?.angle || 1) : e.gamma; if (!tilt.base) tilt.base = p; tilt.b = clamp((p - tilt.base) / 25, -1, 1); tilt.g = clamp(r / 30, -1, 1); });
let pad = {};
function readInput(dt) {
  const k = (c) => keys.has(c), ramp = (cur, want, rate) => cur + clamp(want - cur, -rate * dt, rate * dt);
  let p = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0), r = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0), y = (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0);
  let thr = (k('KeyR') ? 1 : 0) - (k('KeyF') ? 1 : 0), brake = k('Space') || touch.brake ? 1 : 0;
  const gp = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (gp) { const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v); p += dz(gp.axes[1] || 0); r += dz(gp.axes[0] || 0); y += dz(gp.axes[2] || 0); thr += (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0); if (gp.buttons[0]?.pressed) brake = 1;
    const B = (i) => gp.buttons[i]?.pressed, edge = (i, fn) => { if (B(i) && !pad[i]) fn(); pad[i] = B(i); };
    if (F && mode === 'fly') { edge(1, () => { F.rev = !F.rev; if (F.rev) F.thr = 0; }); edge(2, () => { F.flapIdx = Math.min(4, F.flapIdx + 1); sfx('flaps'); }); edge(3, () => { F.flapIdx = Math.max(0, F.flapIdx - 1); sfx('flaps'); }); edge(4, () => { F.gear = F.gear ? 0 : 1; sfx('gear'); }); edge(5, cycleCam); edge(9, () => pause(true)); edge(8, () => { if (F.ap) F.apOff('pilot'); else F.ap = true; }); } }
  if (touch.yoke) { p += touch.py; r += touch.px; }
  if (save.tilt && tilt.on && touch.on) { p += tilt.b; r += tilt.g; }
  inp.pitch = ramp(inp.pitch, clamp(p, -1, 1), 3.5); inp.roll = ramp(inp.roll, clamp(r, -1, 1), 4); inp.yaw = ramp(inp.yaw, clamp(y, -1, 1), 3); inp.thr = thr; inp.brake = brake;
  if (thr && F) F.at = false;
  return inp;
}

// ---------------------------------------------------------------- the voices of the aircraft
const CALLS = [[2500, 'twenty five hundred'], [1000, 'one thousand'], [500, 'five hundred'], [400, 'four hundred'], [300, 'three hundred'], [200, 'minimums'], [100, 'one hundred'], [50, 'fifty'], [40, 'forty'], [30, 'thirty'], [20, 'twenty'], [10, 'ten']];
let lastRA = 99999;
function voices(dt) {
  if (F.onGround) { lastRA = 0; return; }
  for (const [h, w] of CALLS) if (lastRA > h && F.ra <= h && !said[h] && F.vs < 0) { said[h] = true; callout(w, { rate: h <= 50 ? 1.6 : 1.25 }); }
  if (F.T.airbus && F.ra < 22 && F.ra > 3 && F.thr > 0.06 && (said.retardT = (said.retardT || 0) - dt) <= 0) { said.retardT = 1.1; callout('retard', { rate: 1.4 }); }
  lastRA = F.ra;
  // warnings, most urgent first
  warn = null; const ias = F.ias / KT, alpha = F.alpha * R2D, vmax = [340, 230, 215, 195, 180][Math.round(F.flapIdx)];
  if (alpha > 14 + F.flap * 0.6 - 1.5) warn = { text: 'STALL', red: true, voice: 'stall', every: 1.2 };
  else if (F.vs < -2200 && F.ra < 1500 && F.ra > 50) warn = { text: 'PULL UP', red: true, voice: 'pull up', every: 1.4 };
  else if (F.vs < -1500 && F.ra < 1000 && F.ra > 50) warn = { text: 'SINK RATE', voice: 'sink rate', every: 2 };
  else if (F.gearPos < 0.99 && F.ra < 500 && ias < 190) warn = { text: 'TOO LOW · GEAR', red: true, voice: 'too low, gear', every: 2.5 };
  else if (F.flapIdx < 3 && F.ra < 245 && F.gearPos > 0.9) warn = { text: 'TOO LOW · FLAPS', voice: 'too low, flaps', every: 3 };
  else if (Math.abs(F.roll * R2D) > 35) warn = { text: 'BANK ANGLE', voice: 'bank angle', every: 2.5 };
  else if (F.locCap && F.gsDev < -0.5 && F.ra < 1000 && F.ra > 100) warn = { text: 'GLIDESLOPE', voice: 'glideslope', every: 3 };
  else if (ias > vmax + 5) warn = { text: 'OVERSPEED', red: true, every: 1.2, clack: true };
  warnT -= dt; if (warn && warnT <= 0) { warnT = warn.every; if (warn.voice) callout(warn.voice, { rate: 1.2, pitch: 0.7 }); if (warn.clack) sfx('clacker'); }
}

// ---------------------------------------------------------------- cameras
const tmp = new THREE.Vector3();
function placeCamera(dt, pos, quat, onGround) {
  const Tp = TYPES[save.type], fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat), up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  let fov = 50;
  if (camMode === 'cockpit') {
    const eye = pos.clone().addScaledVector(fwd, Tp.noseX + Tp.len * 0.04).addScaledVector(up, Tp.r * 0.55);
    camera.position.copy(eye); camera.quaternion.copy(quat); camera.rotateY(look.yaw); camera.rotateX(look.pitch - 0.04); fov = 58;
  } else if (camMode === 'chase') {
    const h = Math.atan2(fwd.x, -fwd.z), want = pos.clone().add(new THREE.Vector3(-Math.sin(h) * Tp.len * 1.7, Tp.len * 0.38, Math.cos(h) * Tp.len * 1.7));
    if (!placeCamera.c) placeCamera.c = want.clone(); placeCamera.c.lerp(want, Math.min(1, dt * 3)); camera.position.copy(placeCamera.c); camera.position.y = Math.max(camera.position.y, F.groundAt(camera.position.x, camera.position.z) + 2); camera.up.set(0, 1, 0); camera.lookAt(tmp.copy(pos).addScaledVector(fwd, Tp.len * 0.6));
  } else if (camMode === 'orbit') {
    const d = Tp.len * orbit.dist * 1.4; camera.position.set(pos.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * d, pos.y + Math.sin(orbit.pitch) * d, pos.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * d); camera.position.y = Math.max(camera.position.y, 2); camera.up.set(0, 1, 0); camera.lookAt(pos);
  } else if (camMode === 'tower') {
    camera.position.copy(W.tower); camera.up.set(0, 1, 0); camera.lookAt(pos); fov = clamp(2 * Math.atan(Tp.len * 2.4 / camera.position.distanceTo(pos)) * R2D, 3, 55);
  } else if (camMode === 'runway') {
    const R = F.RW, sx = R.x + R.dx * 520 - R.dz * -90, sz = R.z + R.dz * 520 + R.dx * -90; camera.position.set(sx, 2.2, sz); camera.up.set(0, 1, 0); camera.lookAt(pos); fov = clamp(2 * Math.atan(Tp.len * 1.8 / camera.position.distanceTo(pos)) * R2D, 4, 60);
  } else if (camMode === 'wing') {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat); camera.position.copy(pos).addScaledVector(right, Tp.span * 0.46).addScaledVector(up, Tp.r * 0.4).addScaledVector(fwd, -Tp.len * 0.12); camera.quaternion.copy(quat); camera.rotateY(-0.5); camera.rotateX(-0.12); fov = 55;
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  void onGround;
}

// ---------------------------------------------------------------- the replay: from the ground, as the spotters see it
let rp = null;
function replay() {
  if (!rec.length) return; $('report').hidden = true; mode = 'replay'; rp = { i: 0, t: 0 }; $('flyui').hidden = true; $('coach').hidden = true; document.body.classList.add('flying');
  hint({ zh: '回放中……點一下畫面結束', en: 'Replay... tap to finish' });
}
canvas.addEventListener('click', () => { if (mode === 'replay') endReplay(); });
function endReplay() { mode = 'report'; $('report').hidden = false; document.body.classList.remove('flying'); }

// ---------------------------------------------------------------- the report
function report() {
  mode = 'report'; const G = grade(F); $('flyui').hidden = true; $('coach').hidden = true; document.body.classList.remove('flying');
  const best = save.best[cfg.id]; if (!F.crashed && (!best || G.score > best.score)) { save.best[cfg.id] = { score: G.score, stars: G.stars }; store(); }
  $('rTitle').textContent = T(G.title); $('rStars').textContent = G.crash ? '💥' : '★'.repeat(G.stars) + '☆'.repeat(3 - G.stars); $('rScore').textContent = G.crash ? T({ zh: { gearup: '起落架沒放下！', hard: '落地太重，飛機受損', wing: '機翼擦到地面', pod: '發動機擦到地面', terrain: '撞到地面了' }[G.crash] || '墜機', en: { gearup: 'The gear was up!', hard: 'Too hard: the aircraft is damaged', wing: 'A wingtip hit the ground', pod: 'An engine hit the ground', terrain: 'You hit the ground' }[G.crash] || 'Crashed' }) : `${G.score} / 100`;
  $('rFlight').textContent = `${F.flightNo} · ${TYPES[save.type].name} · ${T(AIRLINES[save.al].name)} · RWY ${cfg.rwy}`;
  $('rItems').innerHTML = G.items.map((i) => `<li class="${i.good ? 'ok' : 'bad'}"><span>${T(i.k)}</span><b>${i.v}</b>${i.note ? `<small>${T(i.note)}</small>` : ''}</li>`).join('');
  $('report').hidden = false;
}

// ---------------------------------------------------------------- every frame
let last = performance.now(), simT = 0;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); hud.width = w * Math.min(2, devicePixelRatio || 1); hud.height = h * Math.min(2, devicePixelRatio || 1); hud.style.width = w + 'px'; hud.style.height = h + 'px'; }
addEventListener('resize', resize);
function frame(now) {
  const dt = Math.min(1 / 20, (now - last) / 1000); last = now; simT += dt;
  if (mode === 'fly') {
    const I = readInput(dt);
    warpCur += clamp(warpWant() - warpCur, -dt * 2, dt * 1.2); const sub = Math.ceil(4 * warpCur); for (let i = 0; i < sub; i++) F.step(dt * warpCur / sub, I);
    for (const e of F.events.splice(0)) {
      if (e.k === 'touch') { sfx('touch', clamp(e.sink / 2.5, 0.25, 1.2)); if (!said.welcome) { said.welcome = true; setTimeout(() => say(`${F.callsign}, welcome to Taoyuan. Vacate at the next taxiway, contact ground one two one decimal eight.`, { zh: `${F.callsign}，歡迎來到桃園。從下一個滑行道脫離跑道，聯絡地面管制 121.8。`, en: `${F.callsign}, welcome to Taoyuan. Vacate at the next taxiway, contact ground 121.8.` }), 4000); } }
      if (e.k === 'apoff') { sfx('apoff'); hint({ zh: e.why === 'minimums' ? '自動駕駛解除！現在交給你：收油門、拉平、落地。' : '自動駕駛解除。', en: e.why === 'minimums' ? 'Autopilot off! Your aircraft: thrust idle, flare, touch down.' : 'Autopilot disconnected.' }); }
      if (e.k === 'crash') { sfx('crash'); reportT = 2.5; }
      if (e.k === 'stop') reportT = 2.0;
      if (e.k === 'tailstrike') hint({ zh: '機尾擦地！', en: 'Tail strike!' });
      if (e.k === 'off') hint({ zh: '衝出跑道了！', en: 'Off the runway!' });
    }
    voices(dt); coach(dt);
    // reminders to configure for landing, on the longer approaches
    if (!F.onGround && !F.ap) { const d = F.distNm;
      if (d < 7.5 && F.flapIdx < 2 && !said.cf2) { said.cf2 = true; hint({ zh: '快到了：放下襟翼（V），讓速度慢下來。', en: 'Getting close: extend the flaps (V) and slow down.' }); }
      if (d < 5.5 && F.gear === 0 && !said.cfg) { said.cfg = true; hint({ zh: '放下起落架（G）！接著把襟翼放到最大。', en: 'Gear down (G)! Then flaps to full.' }); }
      if (d < 4 && F.flapIdx < 4 && F.gear && !said.cff) { said.cff = true; hint({ zh: `襟翼放到 ${F.T.flapNames[4]}（再按 V）。`, en: `Flaps ${F.T.flapNames[4]} (press V again).` }); } }
    if (reportT > 0 && (reportT -= dt) <= 0) report();
    rec.push([F.pos.x, F.pos.y, F.pos.z, F.quat.x, F.quat.y, F.quat.z, F.quat.w, F.gearPos, F.flap, F.spo, F.n1, F.revOn ? 1 : 0, F.ra]); if (rec.length > 30 * 150) rec.shift();
    AC.root.position.copy(F.pos); AC.root.quaternion.copy(F.quat); AC.setGear(F.gearPos); AC.setFlaps(F.flap / 4); AC.setSpoilers(Math.max(F.spo, F.speedbrake * 0.4)); AC.update(simT);
    placeCamera(dt, F.pos, F.quat, F.onGround);
    engineSound({ n1: F.n1, ias: F.ias, inside: camMode === 'cockpit', rain: W.rain, rev: F.revOn, ground: F.onGround });
    if (F.thr !== +$('thrSlider').value / 100 && !$('thrSlider').matches(':active')) $('thrSlider').value = Math.round(F.thr * 100);
  } else if (mode === 'replay' && rp) {
    rp.i = Math.min(rec.length - 1, rp.i + 1); const r = rec[rp.i]; const pos = new THREE.Vector3(r[0], r[1], r[2]), q = new THREE.Quaternion(r[3], r[4], r[5], r[6]);
    AC.root.position.copy(pos); AC.root.quaternion.copy(q); AC.setGear(r[7]); AC.setFlaps(r[8] / 4); AC.setSpoilers(r[9]); AC.update(simT);
    const ra = r[12], save0 = camMode; camMode = ra > 400 ? 'chase' : ra > 60 ? 'tower' : rp.i < rec.length - 60 ? 'runway' : 'chase'; placeCamera(dt, pos, q, false); camMode = save0;
    engineSound({ n1: r[10], ias: 70, inside: false, rain: W.rain, rev: r[11], ground: ra < 1 });
    if (rp.i >= rec.length - 1) endReplay();
  }
  if (scene && W) {
    W.follow(AC.root.position); updateLights(W, camera, simT, cfg.rwy); updateWeather(W, camera, dt);
    if (landLight) { const fwd = new THREE.Vector3(0, -0.12, -1).applyQuaternion(AC.root.quaternion); landLight.position.copy(AC.root.position).addScaledVector(fwd, TYPES[save.type].len * 0.2); landLight.target.position.copy(AC.root.position).addScaledVector(fwd, 300); landLight.intensity = cfg.time === 'day' ? 0 : F.gearPos > 0.5 ? 1500 : 0; }
    if (W.clouds && W.layer) for (const c of W.clouds) c.visible = true;
    renderer.render(scene, camera);
    if (mode === 'fly' || mode === 'pause') { const dpr = hud.width / innerWidth; hg.setTransform(dpr, 0, 0, dpr, 0, 0); drawHUD(hg, innerWidth, innerHeight, F, { view: camMode, fovV: camera.fov, warn }); } else hg.clearRect(0, 0, hud.width, hud.height);
  } else { renderer.setClearColor('#0a1428'); renderer.clear(); hg.clearRect(0, 0, hud.width, hud.height); }
  // the radio's words on the screen
  if (sub && (subT -= dt) > 0) { $('sub').hidden = false; $('sub').textContent = T(sub); } else $('sub').hidden = true;
  requestAnimationFrame(frame);
}
resize(); setCam(save.cam); menu(); requestAnimationFrame(frame);
// a world behind the menu: the airport at dusk, an aircraft on final, slowly
(function backdrop() { cfg = { id: 'bg', rwy: '05L', time: 'sunset', wx: 'clear', wind: [50, 0, 0], dist: 3 }; scene = new THREE.Scene(); W = buildWorld(scene, renderer, cfg); AC = makeAircraft(save.type, save.al); scene.add(AC.root); F = createFlight(save.type, { rwy: '05L', dist: 3, wind: [50, 0, 0], wx: 'clear', ap: true, at: true }); landLight = null; const spin = () => { if (mode !== 'menu') return; F.step(1 / 60, { pitch: 0, roll: 0, yaw: 0, thr: 0, brake: 0 }); AC.root.position.copy(F.pos); AC.root.quaternion.copy(F.quat); AC.update(simT); camMode = F.ra > 600 ? 'chase' : 'runway'; placeCamera(1 / 60, F.pos, F.quat); camMode = save.cam; if (F.ra < 150) { F = createFlight(save.type, { rwy: '05L', dist: 3, wind: [50, 0, 0], wx: 'clear', ap: true, at: true }); } setTimeout(spin, 16); }; spin(); })();
window.TPE = { orbit, get F() { return F; }, get W() { return W; }, get mode() { return mode; }, start, save, setCam, report, inp, keys, replay, get rec() { return rec; }, camera };
