// Airlines, aircraft, the runways of Taoyuan, and the scenarios. Units: metres, seconds, kg, newtons (knots and
// feet only on the screen).
export const KT = 0.514444, FT = 0.3048, NM = 1852;
const N = (zh, en) => ({ zh, en });

// the four aircraft, roughly to their real size and numbers
// len/span/height (m), fuselage radius, engines' radius, landing mass (kg), wing area (m²), max thrust per engine (N),
// lift with each flap setting (CL at zero alpha) and drag of it, Vref (kt), tail-strike pitch (deg)
export const TYPES = {
  a321: { name: 'Airbus A321neo', short: 'A321neo', len: 44.5, span: 35.8, height: 11.8, r: 2.0, eng: 1.05, mass: 70000, S: 122.6, thrust: 147000, vref: 136, tail: 9.7, wide: false, tip: 'sharklet', flapNames: ['0', '1', '2', '3', 'FULL'], airbus: true, mainX: 1.2, mainH: 3.3, noseX: 17 },
  a350: { name: 'Airbus A350-900', short: 'A350', len: 66.8, span: 64.75, height: 17.1, r: 3.0, eng: 1.6, mass: 190000, S: 442, thrust: 374000, vref: 140, tail: 10.0, wide: true, tip: 'curve', flapNames: ['0', '1', '2', '3', 'FULL'], airbus: true, mainX: 2.0, mainH: 4.7, noseX: 27 },
  b787: { name: 'Boeing 787-10', short: '787-10', len: 68.3, span: 60.1, height: 17.0, r: 2.9, eng: 1.5, mass: 195000, S: 377, thrust: 340000, vref: 151, tail: 8.9, wide: true, tip: 'raked', flapNames: ['UP', '1', '5', '20', '30'], airbus: false, mainX: 2.4, mainH: 4.6, noseX: 29 },
  b777: { name: 'Boeing 777-300ER', short: '777-300ER', len: 73.9, span: 64.8, height: 18.5, r: 3.1, eng: 1.9, mass: 235000, S: 436.8, thrust: 512000, vref: 152, tail: 8.4, wide: true, tip: 'raked', flapNames: ['UP', '1', '5', '20', '30'], airbus: false, mainX: 2.8, mainH: 4.9, noseX: 31 },
};
export const FLAPS = { cl0: [0.22, 0.5, 0.78, 1.02, 1.3], cd: [0, 0.006, 0.016, 0.032, 0.058], vmax: [340, 230, 215, 195, 180] };

export const AIRLINES = {
  cal: { name: N('中華航空', 'China Airlines'), call: 'Dynasty', code: 'CI', types: ['a350', 'b777', 'a321'], tint: '#b04a8a', nums: [5, 6, 31, 103, 931] },
  eva: { name: N('長榮航空', 'EVA Air'), call: 'EVA', code: 'BR', types: ['b787', 'b777', 'a321'], tint: '#1f6a4a', nums: [12, 26, 51, 196, 892] },
  sjx: { name: N('星宇航空', 'STARLUX'), call: 'Starwalker', code: 'JX', types: ['a350', 'a321'], tint: '#8a6a3a', nums: [2, 8, 12, 801, 862] },
};

// Taoyuan (RCTP / TPE): two parallel runways on 053°/233°, the terminals between them. x is east, z is south.
export const HDG = 53;
const rad = (d) => (d * Math.PI) / 180;
export const U = [Math.sin(rad(HDG)), -Math.cos(rad(HDG))]; // along the runways, toward 053
export const RGT = [Math.cos(rad(HDG)), Math.sin(rad(HDG))]; // to the right of 053 (toward 143)
const rw = (off, along, len) => ({ cx: RGT[0] * off + U[0] * along, cz: RGT[1] * off + U[1] * along, len, w: 60 });
export const STRIPS = { L: rw(-760, 150, 3660), R: rw(760, -150, 3800) }; // 05L/23R to the north-west, 05R/23L to the south-east
// a runway end to land on: the strip, the direction (+1 lands toward 053), its name
export const RUNWAYS = {
  '05L': { strip: 'L', dir: 1, name: '05L', hdg: 53, ils: 110.3 }, '05R': { strip: 'R', dir: 1, name: '05R', hdg: 53, ils: 111.7 },
  '23R': { strip: 'L', dir: -1, name: '23R', hdg: 233, ils: 109.3 }, '23L': { strip: 'R', dir: -1, name: '23L', hdg: 233, ils: 110.9 },
};
// the threshold point and the landing direction of a runway end (world x, z)
export function threshold(id) {
  const R = RUNWAYS[id], S = STRIPS[R.strip], d = [U[0] * R.dir, U[1] * R.dir], half = S.len / 2 - 120; // a displaced bit before the threshold
  return { x: S.cx - d[0] * half, z: S.cz - d[1] * half, dx: d[0], dz: d[1], hdg: R.hdg, S, R, ilsLen: S.len };
}

// scenarios: where you start, the weather, the light, the wind, the help
export const SCENARIOS = [
  { id: 'train', name: N('新手練習', 'First landing'), desc: N('三浬短五邊、無風、白天。自動駕駛幫你飛到 200 呎，最後的拉平與落地交給你。', 'A 3 nm final, no wind, daytime. The autopilot flies you down to 200 ft; the flare and touchdown are yours.'), dist: 3, time: 'day', wx: 'clear', wind: [50, 0, 0], ap: true, at: true, fd: true, rwy: '05L' },
  { id: 'ils', name: N('ILS 進場', 'ILS approach'), desc: N('十浬外、3000 呎，自己攔截航向道和下滑道，手動飛完整個進場。', 'From 10 nm at 3000 ft: capture the localizer and glideslope and fly the whole approach by hand.'), dist: 10, time: 'day', wx: 'cloudy', wind: [60, 8, 0], ap: false, at: true, fd: true, rwy: '05L' },
  { id: 'sunset', name: N('黃昏返航', 'Sunset return'), desc: N('夕陽從台灣海峽落下，城市的燈一盞盞亮起。', 'The sun sets over the Taiwan Strait as the city lights come on.'), dist: 6, time: 'sunset', wx: 'clear', wind: [230, 6, 2], ap: false, at: true, fd: true, rwy: '23R' },
  { id: 'night', name: N('夜間降落', 'Night landing'), desc: N('只看得到跑道燈和進場燈，PAPI 告訴你高了還是低了。', 'Nothing but runway and approach lights; the PAPI tells you if you are high or low.'), dist: 6, time: 'night', wx: 'clear', wind: [40, 7, 3], ap: false, at: true, fd: true, rwy: '05R' },
  { id: 'cross', name: N('側風挑戰', 'Crosswind'), desc: N('東北季風 20 節側吹。進場要「蟹行」，落地前踩舵把機頭對正。', 'A 20 kt north-east monsoon crosswind. Crab on the approach, then kick the nose straight with rudder before touchdown.'), dist: 6, time: 'day', wx: 'cloudy', wind: [130, 20, 6], ap: false, at: true, fd: true, rwy: '05L' },
  { id: 'rain', name: N('雨夜低能見度', 'Rain and fog at night'), desc: N('大雨、低雲、跑道濕滑。直到 200 呎才看得到跑道燈。', 'Heavy rain, low cloud, a wet runway. You will not see the lights until 200 ft.'), dist: 8, time: 'night', wx: 'rain', wind: [20, 12, 6], ap: false, at: true, fd: true, rwy: '05R' },
  { id: 'typhoon', name: N('颱風外圍', 'Typhoon outskirts'), desc: N('強陣風、亂流、風切。真正的機長也會緊張的那種天氣。', 'Strong gusts, turbulence, wind shear. The weather real captains worry about.'), dist: 6, time: 'day', wx: 'storm', wind: [160, 26, 14], ap: false, at: false, fd: true, rwy: '23L' },
];
export const TIMES = { day: N('白天', 'Day'), sunset: N('黃昏', 'Sunset'), night: N('夜晚', 'Night') };
export const WXS = { clear: N('晴朗', 'Clear'), cloudy: N('多雲', 'Cloudy'), rain: N('下雨', 'Rain'), storm: N('暴風雨', 'Storm') };
