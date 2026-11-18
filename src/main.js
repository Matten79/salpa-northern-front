import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SECTORS, FIN_OUTLINE, BORDER_LINE, CITIES } from './sectors.js';
import { ICONS } from './icons.js';
import { initAudio, sfx, setSoundEnabled } from './audio.js';

// ================= PERUSVAKIOT =================
const W = 30, H = 18, BORDER = 24, N = W * H, INF = 1e9;
const FIELD = 0, FOREST = 1, ROAD = 2, SWAMP = 3, LAKE = 4, FELL = 5, SEA = 6;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const idx = (x, z) => z * W + x, ix = i => i % W, iz = i => (i / W) | 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);

function hash2(i, j) {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = t => t * t * (3 - 2 * t);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function bres(x0, z0, x1, z1, cb) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dz = -Math.abs(z1 - z0), sz = z0 < z1 ? 1 : -1, err = dx + dz;
  cb(x0, z0);
  while (!(x0 === x1 && z0 === z1)) {
    const e2 = 2 * err; let nx = x0, nz = z0;
    if (e2 >= dz) { err += dz; nx += sx; }
    if (e2 <= dx) { err += dx; nz += sz; }
    if (nx !== x0 && nz !== z0) cb(nx, z0);
    x0 = nx; z0 = nz; cb(x0, z0);
  }
}
function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * Math.min(1, t);
}

// ================= MÄÄRITYKSET =================
const DEFS = {
  // mult = vahinkokerroin [jalkaväki, kevyt, raskas, lennokki, helikopteri]
  mg:       { name: 'Konekivääriasema', nameEn: 'Machine-gun post', descEn: 'Cheap. Effective against infantry, also shoots drones.', short: 'KK', cost: 100, range: 3.5, interval: 0.18, dmg: 5, mult: [1, .3, .05, .6, .25], hp: 80, ground: true, air: true, desc: 'Halpa. Tehokas jalkaväkeä vastaan, ampuu myös lennokkeja.' },
  mortar:   { name: 'Raskas kranaatinheitin', nameEn: 'Heavy mortar', descEn: 'Long range and area damage. Cannot fire at very close range.', short: 'KRH', cost: 200, range: 6.5, minRange: 1.5, interval: 3.2, dmg: 45, splash: 1.2, mult: [1, .5, .25, 0, 0], hp: 90, ground: true, desc: 'Pitkä kantama ja aluevaikutus. Ei ammu aivan lähelle.' },
  atgm:     { name: 'Panssarintorjuntaohjus', nameEn: 'Anti-tank missile', descEn: 'Destroys tanks and IFVs. Also hits helicopters.', short: 'PST', cost: 250, range: 5, interval: 2.6, dmg: 140, mult: [.4, 1, 1, 0, .6], hp: 90, ground: true, air: true, desc: 'Tuhoaa panssarivaunuja ja BMP:itä. Osuu myös helikoptereihin.' },
  aa:       { name: 'Ilmatorjunta', nameEn: 'Anti-aircraft gun', descEn: 'Shoots down drones. Weak against helicopters.', short: 'IT', cost: 180, range: 5, interval: 0.25, dmg: 9, mult: [0, 0, 0, 1, .5], hp: 80, air: true, desc: 'Ampuu lennokit alas. Helikoptereihin se tehoaa huonosti.' },
  k9:       { name: 'K9 Moukari', nameEn: 'K9 Thunder', descEn: 'Self-propelled howitzer: very long range and wide blast. Reaches enemy artillery.', short: 'K9', cost: 320, range: 9, minRange: 2.5, interval: 4.5, dmg: 85, splash: 1.6, mult: [1, .7, .45, 0, 0], hp: 110, ground: true, locked: true, desc: 'Panssarihaupitsi: erittäin pitkä kantama ja laaja iskualue. Yltää vihollisen tykistöön.' },
  nasams:   { name: 'NASAMS', nameEn: 'NASAMS', descEn: 'Surface-to-air missile system: long range, destroys helicopters and drones.', short: 'NAS', cost: 300, range: 7.5, interval: 2.4, dmg: 110, mult: [0, 0, 0, 1, 1], hp: 90, air: true, locked: true, desc: 'Ilmatorjuntaohjusjärjestelmä: pitkä kantama, tuhoaa helikopterit ja lennokit.' },
  leo:      { name: 'Leopard 2A6', nameEn: 'Leopard 2A6', descEn: 'Mobile main battle tank. Select it and tap a tile to move.', short: 'LEO', cost: 360, mobile: true, range: 4.5, interval: 2.2, dmg: 170, mult: [.5, 1, .95, 0, .3], hp: 260, armor: .45, speed: 1.3, ground: true, air: true, locked: true, desc: 'Liikkuva panssarivaunu. Valitse se ja napauta ruutua siirtääksesi.' },
  amv:      { name: 'Patria AMV', nameEn: 'Patria AMV', descEn: 'Fast armoured vehicle with an infantry squad. Move it where it is needed.', short: 'AMV', cost: 170, mobile: true, range: 3.3, interval: .2, dmg: 6, mult: [1, .35, .05, .5, .2], hp: 150, armor: .25, speed: 2.1, ground: true, air: true, locked: true, desc: 'Nopea panssariajoneuvo jalkaväkiryhmällä. Siirrä se sinne, missä tarvitaan.' },
  obstacle: { name: 'Hammaskivet', nameEn: 'Tank traps', descEn: 'Stops vehicles, slows infantry. Can be placed on a road.', short: 'Este', cost: 30, passive: true, desc: 'Pysäyttää ajoneuvot, hidastaa jalkaväkeä. Voi asettaa tielle.' },
  apmine:   { name: 'Henkilömiinoite', nameEn: 'Anti-personnel mines', descEn: 'Explodes when infantry steps on it (4 times). Vehicles do not trigger it.', short: 'HM', cost: 40, passive: true, charges: 4, dmg: 110, desc: 'Räjähtää jalkaväen kohdalla (4 kertaa). Ajoneuvot eivät laukaise sitä.' },
  mine:     { name: 'Panssarimiinoite', nameEn: 'Anti-tank mines', descEn: 'Explodes under a vehicle (3 times). Does not block movement.', short: 'Miina', cost: 60, passive: true, charges: 3, dmg: 160, desc: 'Räjähtää ajoneuvon alla (3 kertaa). Ei estä kulkua.' },
};
const dn = d => L(d.name, d.nameEn || d.name), dd = d => L(d.desc, d.descEn || d.desc);
const TOWERS = new Set(['mg', 'mortar', 'atgm', 'aa', 'k9', 'nasams']);
const MOBILE = new Set(['leo', 'amv']);
const NONBLOCK = new Set(['mine', 'apmine']);
const ARMOR_RED = 0;
const EDEF = {
  inf:   { name: 'Jalkaväki', hp: 60, speed: 1.0, armor: 0, cls: 'inf', reward: 10, leak: 1, atk: { range: 1.8, dmg: 1.5, interval: 2 } },
  bmp:   { name: 'BMP', hp: 200, speed: 1.5, armor: 1, cls: 'veh', reward: 28, leak: 2, atk: { range: 3, dmg: 4, interval: 1.2 } },
  tank:  { name: 'Panssarivaunu', hp: 650, speed: 0.9, armor: 2, cls: 'veh', reward: 55, leak: 4, atk: { range: 4, dmg: 22, interval: 3.5 } },
  drone: { name: 'Lennokki', hp: 28, speed: 2.6, armor: 3, cls: 'air', reward: 14, leak: 1, kamikaze: 40 },
  heli:  { name: 'Taisteluhelikopteri', hp: 320, speed: 1.15, armor: 4, cls: 'air', heli: true, reward: 45, leak: 2, atk: { range: 3.4, dmg: 15, interval: 2.8 } },
  ew:    { name: 'Häirintäasema', hp: 300, speed: .8, armor: 1, cls: 'veh', ew: true, reward: 40, leak: 2, atk: { range: 2.5, dmg: 4, interval: 1.5 } },
  spec:  { name: 'Erikoisjoukot', hp: 80, speed: 1.0, armor: 0, cls: 'inf', reward: 15, leak: 1, atk: { range: 2, dmg: 5, interval: 1.5 } },
  battery: { name: 'Tykistöpatteri', hp: 520, speed: 0, armor: 1, cls: 'veh', static: true, reward: 70, leak: 0 },
};
const FORT_HP = [1, 2, 3.5], FORT_RED = [0, .3, .5], FORT_COST = [90, 170];
const FORT_NAME = [['Ei linnoitettu', 'None'], ['Hiekkasäkit', 'Sandbags'], ['Betonibunkkeri', 'Concrete bunker']];
// maastokustannus [kesä, talvi][FIELD, FOREST, ROAD, SWAMP, LAKE, FELL, SEA]
const COST = {
  inf: [[1.2, 1.6, 1, 2.5, INF, 2.2, INF], [1.2, 1.6, 1, 1.4, 1.2, 2.4, INF]],
  veh: [[1.8, 3.5, 1, INF, INF, INF, INF], [1.8, 3.5, 1, 2.2, 1.6, INF, INF]],
};
const PAL_BASE = [
  [0x86ad4b, 0x4c7a35, 0x5e5e60, 0x7c7a4c, 0x3a78b8, 0x9c9a80, 0x2d5f90],
  [0xedf2f5, 0xd2dde2, 0x8d9297, 0xc6d1d4, 0xaed6ec, 0xf9fbfc, 0x3f6f9a],
];
const BASEH = [.30, .32, .31, .26, .12, .62, .08];
const TERRAIN_NAME = [['pelto', 'field'], ['metsä', 'forest'], ['tie', 'road'], ['suo', 'swamp'], ['järvi', 'lake'], ['tunturi', 'fell'], ['meri', 'sea']];

// ================= TILA =================
let cfg = SECTORS[0], PAL = PAL_BASE, battleWaves = 10;
let screen = 'intro';
let winter = false, money = 650, lives = 20, wave = 0, phase = 'build', speed = 1;
let paused = false, gameOver = false, running = false, endless = false;
let tool = null, selected = null, pendingTile = -1, barrageWarned = false, deerWarned = false, leaveArmed = 0;
let units = [], cleared = new Set(), cond = 'clear', nextCond = 'clear', specDone = false;
const structs = new Map();
const rubble = new Map();
let enemies = [], projectiles = [], effects = [], barrages = [], queue = [], barrageTimes = [], deer = [];
const L = (fi, en) => (settings.lang === 'en' ? en : fi);
const B = (fi, en) => ({ fi, en });             // kaksikielinen raporttirivi
const rt = r => (r && typeof r === 'object' ? L(r.fi, r.en) : r);
// --- asetukset
const SET_KEY = 'salpa.asetukset';
const settings = { gfx: matchMedia('(pointer: coarse)').matches ? 'med' : 'high', sound: true, lang: 'fi', auto: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SET_KEY)) || {}); } catch (e) { /* oletukset */ }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* ohitetaan */ } }
let spawnTimer = 0, waveTime = 0, hpMult = 1, dmgMult = 1;
let fields = { inf: null, veh: null };
const terr = new Uint8Array(N);
const spawns = { veh: [], inf: [] };

// ================= KAMPANJA: SEKTOREIDEN UHKA =================
// Uhka 0–100 per sektori. ≥ RED = kiireellinen (punainen), ≥ YELLOW = uhka kasvaa (keltainen).
const SAVE_KEY = 'salpa.kampanja.v2';
const RED = 75, YELLOW = 40, CAMPAIGN_WEEKS = 12, MAX_RESIL = 5;
const AGG = { kaakko: 1.25, ekarjala: 1.05, pkarjala: .95, kainuu: .9, koillismaa: .8, ylalappi: .7 };
let progress = null;
function newCampaign() {
  const threat = {};
  for (const s of SECTORS) threat[s.id] = 10 + Math.round(Math.random() * 25);
  threat.kaakko = 82;                                   // avaushyökkäys Kaakkois-Suomeen
  const others = SECTORS.filter(s => s.id !== 'kaakko');
  threat[others[(Math.random() * others.length) | 0].id] = 50 + Math.round(Math.random() * 15);
  const forecast = {}; for (const o of SECTORS) forecast[o.id] = Math.round((5 + Math.random() * 12) * (AGG[o.id] || 1) * 1.05);
  return {
    v: 2, week: 1, threat, forecast, resil: MAX_RESIL, wins: 0, losses: 0, held: {}, best: {}, over: null,
    report: [B('Vihollinen keskittää joukkoja Vaalimaan suunnalle. Puolusta Kaakkois-Suomea!', 'The enemy is massing troops near Vaalimaa. Defend South-East Finland!')],
    support: { f35: 0, himars: 0 }, funds: 300, unlocked: {}, upg: { budget: 0, support: 0 }, reserve: 0, mobilizeCd: 0, forts: {}, battle: null,
  };
}
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) progress = s; } catch (e) { /* ei tallennusta */ }
if (!progress) progress = newCampaign();
// vanhemman tallennuksen täydennys
if (!progress.forecast) { progress.forecast = {}; for (const o of SECTORS) progress.forecast[o.id] = Math.round((5 + Math.random() * 12) * (AGG[o.id] || 1) * (1 + progress.week * .05)); }
for (const [k, v] of Object.entries({ funds: 300, unlocked: {}, upg: { budget: 0, support: 0 }, reserve: 0, mobilizeCd: 0, forts: {}, battle: null, support: { f35: 0, himars: 0 } })) if (progress[k] === undefined) progress[k] = v;
function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ohitetaan */ } }
const threatOf = id => progress.threat[id] || 0;
const levelOf = t => t >= RED ? 'red' : t >= YELLOW ? 'yellow' : 'calm';
const LEVEL = {
  red:    { col: '#e5383b', label: 'KIIREELLINEN', labelEn: 'URGENT', text: 'Suurhyökkäys käynnissä', textEn: 'Major offensive under way', badge: '!!' },
  yellow: { col: '#ffc531', label: 'Uhka kasvaa', labelEn: 'Threat rising', text: 'Vihollinen tunnustelee rajaa', textEn: 'Enemy probing the border', badge: '!' },
  calm:   { col: '#9aa7b2', label: 'Rauhallinen', labelEn: 'Quiet', text: 'Ei välitöntä uhkaa', textEn: 'No immediate threat', badge: '' },
};
const wavesFor = (s, t) => t >= RED ? s.waves : 6;
let battleResolved = false;
// Taistelun tulos -> viikko kuluu, muiden sektoreiden uhka kasvaa
function resolveBattle(id, win) {
  if (battleResolved || progress.over) return;
  battleResolved = true;
  const s = SECTORS.find(x => x.id === id);
  const rep = [];
  const wasRed = threatOf(id) >= RED;
  if (win) {
    progress.wins++; progress.held[id] = (progress.held[id] || 0) + 1;
    progress.threat[id] = Math.round(Math.random() * 10);
    const gain = (wasRed ? 300 : 180) + lives * 5;
    progress.funds += gain;
    rep.push(B(`✓ ${s.name}: hyökkäys torjuttu. Sektori rauhoittui. Määrärahat +${gain} M€.`, `✓ ${s.nameEn}: attack repelled. Funds +${gain} M€.`));
    // linnoitukset säilyvät
    progress.forts[id] = {
      structs: [...structs.values()].map(x => ({ kind: x.kind, i: x.i, lvl: x.lvl, fort: x.fort, charges: x.charges })),
      units: units.filter(u => !u.dead).map(u => ({ kind: u.kind, i: u.i })),
      cleared: [...cleared],
    };
  } else {
    progress.losses++; progress.resil--;
    progress.threat[id] = 85;
    progress.funds += 50;
    progress.forts[id] = null;
    rep.push(B(`✗ ${s.name}: puolustus murtui (kestävyys −1). Sektorin asemat menetettiin.`, `✗ ${s.nameEn || s.name}: defence broken (resilience −1). Positions lost.`));
  }
  progress.battle = null;
  tickWeek(id, rep);
}
// viikko kuluu: muiden sektoreiden uhka kasvaa, kiireellisistä rangaistus
function rollInc(id, week) { return Math.round((5 + Math.random() * 12) * (AGG[id] || 1) * (1 + week * .05)); }
function makeForecast() { progress.forecast = {}; for (const o of SECTORS) progress.forecast[o.id] = rollInc(o.id, progress.week); }
function tickWeek(id, rep) {
  if (progress.nukeEsc) {
    progress.nukeEsc = false;
    for (const o of SECTORS) if (o.id !== id) progress.threat[o.id] = Math.min(100, threatOf(o.id) + 15);
    rep.push(B('☢ Ydinisku kiihdytti vihollisen painostusta kaikilla muilla sektoreilla (uhka +15).', '☢ The nuclear strike escalated enemy pressure in all other sectors (threat +15).'));
  }
  for (const o of SECTORS) {
    if (o.id === id) continue;
    const before = threatOf(o.id);
    if (before >= RED) {
      progress.resil--;
      rep.push(B(`⚠ ${o.name}: hyökkäykseen ei vastattu – vihollinen eteni (kestävyys −1).`, `⚠ ${o.nameEn}: attack left unanswered – the enemy advanced (resilience −1).`));
    }
    const inc = progress.forecast && progress.forecast[o.id] != null ? progress.forecast[o.id] : rollInc(o.id, progress.week);
    const after = Math.min(100, before + inc);
    progress.threat[o.id] = after;
    if (levelOf(before) !== levelOf(after)) {
      if (levelOf(after) === 'red') rep.push(B(`🔴 ${o.name}: hyökkäys alkaa – KIIREELLINEN!`, `🔴 ${o.nameEn}: offensive starting – URGENT!`));
      else if (levelOf(after) === 'yellow') rep.push(B(`🟡 ${o.name}: vihollisen toiminta lisääntyy.`, `🟡 ${o.nameEn}: enemy activity increasing.`));
    }
  }
  // aina vähintään yksi uhattu sektori
  if (!SECTORS.some(o => threatOf(o.id) >= YELLOW)) {
    const o = SECTORS.filter(x => x.id !== id).sort((a, b) => threatOf(b.id) - threatOf(a.id))[0];
    progress.threat[o.id] = YELLOW + 5; rep.push(B(`🟡 ${o.name}: vihollisen toiminta lisääntyy.`, `🟡 ${o.nameEn}: enemy activity increasing.`));
  }
  progress.resil = Math.max(0, progress.resil);
  progress.week++;
  makeForecast();
  if (progress.mobilizeCd > 0) progress.mobilizeCd--;
  if (progress.resil <= 0) { progress.over = 'lost'; rep.push(B('Valtakunnan puolustuskestävyys loppui.', 'The nation\'s defensive resilience is exhausted.')); }
  else if (progress.week > CAMPAIGN_WEEKS) { progress.over = 'won'; rep.push(B('Talvi on ohi – itäraja piti!', 'Winter is over – the eastern border held!')); }
  progress.report = rep;
  saveProgress();
}

// ================= SEKTORIN MAASTON LUONTI =================
function genSector(c) {
  const sx = c.seed * 13.7, sz = c.seed * 7.1;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const n = vnoise(x * .33 + sx, z * .33 + sz) * .65 + vnoise(x * .85 + 7.3 + sx, z * .85 + 3.1 + sz) * .35;
    terr[idx(x, z)] = n > c.forest ? FOREST : FIELD;
  }
  const blob = (list, type) => {
    for (const [cx, cz, r] of list || []) for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + .5 - cx, z + .5 - cz) + (vnoise(x * .7 + 50 + sx, z * .7 + 20) - .5) * 1.4;
      if (d < r) {
        const i = idx(x, z);
        if (type === SWAMP && (terr[i] === LAKE || terr[i] === FELL)) continue;
        if (type === LAKE && terr[i] === FELL) continue;
        terr[i] = type;
      }
    }
  };
  blob(c.fells, FELL); blob(c.lakes, LAKE); blob(c.swamps, SWAMP);
  if (c.sea) for (let z = 0; z < H; z++) for (let x = 0; x < c.sea.xMax; x++) {
    if (z + .5 + (vnoise(x * .6 + 90, z * .6) - .5) * 1.6 > c.sea.z) terr[idx(x, z)] = SEA;
  }
  for (const r of c.rivers || []) for (let k = 0; k < r.length - 1; k++)
    bres(r[k][0], r[k][1], r[k + 1][0], r[k + 1][1], (x, z) => { terr[idx(x, z)] = LAKE; });
  for (const r of c.roads) for (let k = 0; k < r.length - 1; k++)
    bres(r[k][0], r[k][1], r[k + 1][0], r[k + 1][1], (x, z) => { terr[idx(x, z)] = ROAD; });
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, z); if (terr[i] !== FOREST) continue;
    const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
      const nx = x + dx, nz = z + dz; return nx >= 0 && nz >= 0 && nx < W && nz < H && terr[idx(nx, nz)] === ROAD;
    });
    if (nearRoad && hash2(x + c.seed, z + 99) < c.clearing) terr[i] = FIELD;
  }
  spawns.veh = []; spawns.inf = [];
  for (let z = 0; z < H; z++) {
    const i = idx(W - 1, z), t = terr[i];
    if (t === ROAD) spawns.veh.push(i);
    if (t !== LAKE && t !== SEA && t !== FELL && (t === ROAD || z % 3 === 1)) spawns.inf.push(i);
  }
  PAL = [PAL_BASE[0].slice(), PAL_BASE[1].slice()];
  for (const [k, v] of Object.entries(c.pal || {})) PAL[0][k] = v;
}

// ================= REITINHAKU =================
function tileCost(cls, i, isWinter, extra) {
  let kind = structs.has(i) ? structs.get(i).kind : null;
  if (extra && extra.i === i) kind = extra.kind;
  if (kind && TOWERS.has(kind)) return INF;
  let c = COST[cls][isWinter ? 1 : 0][terr[i]];
  if (kind === 'obstacle') { if (cls === 'veh') return INF; c += 2; }
  return c;
}
function dijkstra(costFn) {
  const cost = new Float64Array(N), dist = new Float64Array(N).fill(INF);
  for (let i = 0; i < N; i++) cost[i] = costFn(i);
  const hd = [], hi = [];
  const push = (d, i) => {
    hd.push(d); hi.push(i); let k = hd.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= hd[k]) break;[hd[p], hd[k]] = [hd[k], hd[p]];[hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
  };
  const pop = () => {
    const d = hd[0], i = hi[0]; const ld = hd.pop(), li = hi.pop();
    if (hd.length) {
      hd[0] = ld; hi[0] = li; let k = 0;
      for (; ;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < hd.length && hd[l] < hd[m]) m = l; if (r < hd.length && hd[r] < hd[m]) m = r;
        if (m === k) break;[hd[m], hd[k]] = [hd[k], hd[m]];[hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
      }
    }
    return [d, i];
  };
  for (let z = 0; z < H; z++) { const i = idx(0, z); if (cost[i] < INF) { dist[i] = 0; push(0, i); } }
  while (hd.length) {
    const [d, i] = pop(); if (d > dist[i]) continue;
    const x = ix(i), z = iz(i);
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const j = idx(nx, nz); if (cost[j] >= INF) continue;
      const diag = dx && dz;
      if (diag && (cost[idx(x + dx, z)] >= INF || cost[idx(x, z + dz)] >= INF)) continue;
      const nd = d + (cost[i] + cost[j]) * .5 * (diag ? 1.4142 : 1);
      if (nd < dist[j]) { dist[j] = nd; push(nd, j); }
    }
  }
  return { dist, cost };
}
function bestNext(f, c) {
  const x = ix(c), z = iz(c); let best = -1, bv = INF;
  for (const [dx, dz] of DIRS) {
    const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
    const j = idx(nx, nz); if (f.cost[j] >= INF || f.dist[j] >= f.dist[c]) continue;
    const diag = dx && dz;
    if (diag && (f.cost[idx(x + dx, z)] >= INF || f.cost[idx(x, z + dz)] >= INF)) continue;
    const v = f.dist[j] + (f.cost[c] + f.cost[j]) * .5 * (diag ? 1.4142 : 1);
    if (v < bv) { bv = v; best = j; }
  }
  return best;
}
function recomputeFields() {
  fields.inf = dijkstra(i => tileCost('inf', i, winter));
  fields.veh = dijkstra(i => tileCost('veh', i, winter));
  updatePreview();
}
function pathOk(kind, i) {
  for (const cls of ['inf', 'veh']) {
    if (kind === 'obstacle' && cls === 'inf') continue;
    if (!spawns[cls].length) continue;
    const fs = dijkstra(j => tileCost(cls, j, false, { i, kind })).dist;
    if (!spawns[cls].some(s => fs[s] < INF)) return false;
    const fc = winter ? dijkstra(j => tileCost(cls, j, true, { i, kind })).dist : fs;
    for (const e of enemies) if (!e.dead && !e.d.static && e.cls === cls && fc[e.cur] >= INF) return false;
  }
  return true;
}

// ================= SCENE =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .98;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKY = [0x9fc4dd, 0xc3d2dc];
scene.background = new THREE.Color(SKY[0]);
scene.fog = new THREE.Fog(SKY[0], 45, 90);
// taivaskupoli: liukuväri horisontista zeniittiin
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x5f93c4) }, bottom: { value: new THREE.Color(SKY[0]) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6, 0., 1.); gl_FragColor = vec4(mix(bottom, top, pow(h, .7)), 1.); }',
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12), skyMat);
skyDome.position.set(15, 0, 9); skyDome.renderOrder = -10; scene.add(skyDome);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 200);
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .12;
controls.maxPolarAngle = 1.25; controls.minDistance = 6; controls.maxDistance = 50;
controls.screenSpacePanning = false;
function resetCamera() {
  const portrait = innerWidth < innerHeight;
  controls.target.set(W / 2 - 1, 0, H / 2);
  if (portrait) camera.position.set(W / 2 - 1 - 20, 38, H / 2);
  else camera.position.set(W / 2 - 1, 22, H / 2 + 17);
  controls.update();
}
resetCamera();

const hemi = new THREE.HemisphereLight(0xe4f0ff, 0x4a5a3a, 1.4); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(W / 2 + 16, 24, H / 2 - 14);
sun.target.position.set(W / 2, 0, H / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.normalBias = .02;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
function applyGfx() {
  const lv = settings.gfx;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lv === 'high' ? 2 : lv === 'med' ? 1.5 : 1));
  renderer.shadowMap.enabled = lv !== 'low'; sun.castShadow = lv !== 'low';
  const ms = lv === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  renderer.setSize(innerWidth, innerHeight);
  if (typeof setupPost === 'function') setupPost();
}
// --- jälkikäsittely (vain korkea grafiikka): varjostus (GTAO) ja hehku (bloom)
let composer = null, gtao = null, bloom = null;
function setupPost() {
  if (composer) { composer.dispose && composer.dispose(); composer = null; }
  if (settings.gfx !== 'high') return;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.blendIntensity = .85;
    // läpinäkyvät (tekstit, palkit, efektit, vesi) eivät saa varjostaa
    gtao._overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse(o => {
        if (!o.visible) return;
        if (o.isPoints || o.isLine || o.isSprite || (o.material && !Array.isArray(o.material) && o.material.transparent)) { o.visible = false; cache.push(o); }
      });
    };
    gtao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.2, thickness: 1.2, scale: 1 });
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .35, .92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  } catch (e) { composer = null; }
}
applyGfx();
// --- sääolosuhteet
const COND = {
  clear: { name: 'Selkeä', en: 'Clear', icon: '☀️', range: 0 },
  night: { name: 'Yö', en: 'Night', icon: '🌙', range: -.8, desc: 'kantamat −0,8', descEn: 'ranges −0.8' },
  fog:   { name: 'Sumu', en: 'Fog', icon: '🌫️', range: -.7, noAir: true, desc: 'kantamat −0,7, ei lentotukea', descEn: 'ranges −0.7, no air support' },
  storm: { name: 'Lumimyräkkä', en: 'Snowstorm', icon: '🌨️', range: -.7, noAir: true, desc: 'kantamat −0,7, ei lentotukea', descEn: 'ranges −0.7, no air support' },
};
const snowGeo = new THREE.BufferGeometry();
{ const a = new Float32Array(1800 * 3); for (let k = 0; k < 1800; k++) { a[k * 3] = -4 + Math.random() * (W + 8); a[k * 3 + 1] = Math.random() * 9; a[k * 3 + 2] = -3 + Math.random() * (H + 6); } snowGeo.setAttribute('position', new THREE.BufferAttribute(a, 3)); }
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .07, transparent: true, opacity: .85, depthWrite: false }));
snow.visible = false; scene.add(snow);
function pickCond(n) {
  if (n <= 1) return 'clear';
  const r = Math.random();
  if (r < .45) return 'clear';
  if (r < .7) return 'night';
  if (r < .85) return 'fog';
  return seasonOf(n) ? 'storm' : 'fog';
}
// Ympäristö (taivas, sumu, valot, lumisade) liukuu kohti tavoitetta – ei äkillisiä vaihtoja.
const mkEnv = () => ({ bg: new THREE.Color(SKY[0]), fogN: 45, fogF: 90, hI: 1.4, sI: 2.2, hC: new THREE.Color(0xe4f0ff), sC: new THREE.Color(0xfff4e0), snow: 0 });
const env = mkEnv(), envT = mkEnv();
function setCondition(c, instant) {
  cond = c;
  let bg = SKY[winter ? 1 : 0], fogN = 45, fogF = 90, hI = 1.4, sI = 2.2, hC = 0xe4f0ff, sC = 0xfff4e0;
  if (c === 'night') { bg = 0x16213a; fogN = 30; fogF = 75; hI = .45; sI = .5; hC = 0x8fa6d8; sC = 0x9fb4ff; }
  else if (c === 'fog') { bg = winter ? 0xd5dce0 : 0xb4bec4; fogN = 12; fogF = 44; hI = 1.2; sI = 1.1; }
  else if (c === 'storm') { bg = 0xc9d2d8; fogN = 14; fogF = 48; hI = 1.1; sI = .9; }
  envT.bg.setHex(bg); envT.fogN = fogN; envT.fogF = fogF; envT.hI = hI; envT.sI = sI; envT.hC.setHex(hC); envT.sC.setHex(sC); envT.snow = c === 'storm' ? 1 : 0;
  if (instant) { env.bg.copy(envT.bg); env.hC.copy(envT.hC); env.sC.copy(envT.sC); for (const k of ['fogN', 'fogF', 'hI', 'sI', 'snow']) env[k] = envT[k]; applyEnv(); }
}
function applyEnv() {
  scene.background.copy(env.bg);
  skyMat.uniforms.bottom.value.copy(env.bg);
  skyMat.uniforms.top.value.copy(env.bg).multiplyScalar(.62).lerp(new THREE.Color(0x2c5a92), cond === 'night' || cond === 'fog' || cond === 'storm' ? .05 : .35); scene.fog.color.copy(env.bg); scene.fog.near = env.fogN; scene.fog.far = env.fogF;
  hemi.intensity = env.hI; hemi.color.copy(env.hC); sun.intensity = env.sI; sun.color.copy(env.sC);
  snow.material.opacity = .85 * env.snow; snow.visible = env.snow > .02;
}
function envStep(dt) {
  const k = 1 - Math.exp(-dt / 1.3);            // n. 4 s siirtymä
  env.bg.lerp(envT.bg, k); env.hC.lerp(envT.hC, k); env.sC.lerp(envT.sC, k);
  for (const key of ['fogN', 'fogF', 'hI', 'sI', 'snow']) env[key] += (envT[key] - env[key]) * k;
  applyEnv();
  // värien liukuvaihdot (vuodenaika)
  for (const f of fades) {
    f.t = Math.min(f.T, f.t + dt); const a = f.t / f.T, e = a * a * (3 - 2 * a);
    if (f.arr) { for (let i = 0; i < f.arr.length; i++) f.arr[i] = f.from[i] + (f.to[i] - f.from[i]) * e; f.attr.needsUpdate = true; }
    else f.mat.color.copy(f.from).lerp(f.to, e);
  }
  fades = fades.filter(f => f.t < f.T);
}
let fades = [];
function fadeAttr(attr, before, T = 3.5) { if (!attr) return; const to = Float32Array.from(attr.array); attr.array.set(before); attr.needsUpdate = true; fades.push({ arr: attr.array, attr, from: before, to, t: 0, T }); }
function fadeMat(mat, before, T = 3.5) { const to = mat.color.clone(); mat.color.copy(before); fades.push({ mat, from: before, to, t: 0, T }); }

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const MAT = {
  base: M(0x8d99a3), fin: M(0x4e6878), dark: M(0x2f3a42), metal: M(0x6c757d), stone: M(0xb9b6ab),
  sand: M(0xb59f6b), concrete: M(0x9ea3a6), mine: M(0x4b4a3a), warn: M(0xffcc33), white: M(0xf4f6f8), blue: M(0x1d4f9c),
  enemy: M(0x34363a), enemy2: M(0x4a4c50), accent: M(0xff8a1f), inf: M(0x5b5848), rubble: M(0x3b3b3b),
  house: M(0xc9b08a), roof: M(0x7a3e2e), flatRoof: M(0x5b6066), street: M(0x55585c), houseB: M(0xdcd6c8), houseR: M(0x8e3b2c),
  deer: M(0x7a6a58), deerL: M(0xe8e1d4), antler: M(0xcdbf9f),
  finG: M(0x5a6b45), finG2: M(0x4b5a3a), spec: M(0x3c4a3a), purple: M(0xb27ce0),
};
function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}
let world = new THREE.Group(); scene.add(world);
let townGround = null;

// --- maasto (instanced, pysyvä)
const tileGeo = new THREE.BoxGeometry(1, 1, 1); tileGeo.translate(0, .5, 0);
const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial(), N);
tiles.receiveShadow = true; scene.add(tiles);
const tileH = new Float32Array(N);
const tileTop = i => tileH[i];
const dummy = new THREE.Object3D(), tmpCol = new THREE.Color();
function refreshTile(i) {
  const x = ix(i), z = iz(i), t = terr[i];
  let h = BASEH[t];
  if (t === LAKE) h += winter ? .03 : 0;
  else if (t === FELL) h += vnoise(x * .9 + 31, z * .9) * .35;
  else if (t !== SEA) h += hash2(x, z) * .04;
  tileH[i] = h;
  dummy.position.set(x + .5, 0, z + .5); dummy.scale.set(1, h, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
  tiles.setMatrixAt(i, dummy.matrix);
  tmpCol.setHex(PAL[winter ? 1 : 0][t]);
  if (t === FELL && !winter) tmpCol.lerp(new THREE.Color(0xdedbd0), clamp((h - .7) * 2, 0, .6));
  if (x >= BORDER) tmpCol.multiplyScalar(.8);
  tmpCol.multiplyScalar(.94 + hash2(x + 3, z + 5) * .08);
  tiles.setColorAt(i, tmpCol);
}
function refreshAllTiles() {
  for (let i = 0; i < N; i++) refreshTile(i);
  tiles.instanceMatrix.needsUpdate = true; tiles.instanceColor.needsUpdate = true;
}

// --- puut (sektorikohtainen)
const treeGeo = mergeGeometries([
  new THREE.CylinderGeometry(.03, .04, .14, 5).translate(0, .07, 0),
  new THREE.ConeGeometry(.2, .36, 6).translate(0, .3, 0),
  new THREE.ConeGeometry(.15, .32, 6).translate(0, .5, 0),
  new THREE.ConeGeometry(.09, .22, 6).translate(0, .68, 0),
]);
treeGeo.computeVertexNormals();
let trees = null; const treeOf = new Map(); const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
// --- ympäröivä maasto, vesi ja kivet
const waterTex = (() => {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), hgt = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * Math.PI * 2, v = y / n * Math.PI * 2;
    hgt[y * n + x] = Math.sin(u * 3 + v) * .5 + Math.sin(u * 5 - v * 4) * .3 + Math.sin(u * 2 + v * 7) * .2 + Math.sin(u * 11 + v * 3) * .1;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = hgt[y * n + (x + 1) % n] - hgt[y * n + (x - 1 + n) % n], dy = hgt[((y + 1) % n) * n + x] - hgt[((y - 1 + n) % n) * n + x];
    const k = (y * n + x) * 4; img.data[k] = 128 - dx * 90; img.data[k + 1] = 128 - dy * 90; img.data[k + 2] = 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
})();
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2b6aa6, roughness: .42, metalness: 0, transparent: true, opacity: .85, normalMap: waterTex, normalScale: new THREE.Vector2(.22, .22) });
let lakeWater = null, seaWater = null, outerGround = [], outerTrees = null, rocks = null;
function quadsFor(test, y) {
  const pos = [], idxs = []; let v = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, z); if (!test(terr[i])) continue;
    pos.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1);
    idxs.push(v, v + 2, v + 1, v, v + 3, v + 2); v += 4;
  }
  if (!v) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idxs);
  const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 4, pos[k + 2] / 4); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
const outerMat = new THREE.MeshLambertMaterial({ color: 0x7ea048 });
const outerSeaMat = new THREE.MeshStandardMaterial({ color: 0x24598e, roughness: .45, metalness: 0, normalMap: waterTex, normalScale: new THREE.Vector2(.2, .2) });
function buildSurroundings() {
  const lg = quadsFor(t => t === LAKE, .145), sg = quadsFor(t => t === SEA, .1);
  lakeWater = lg ? new THREE.Mesh(lg, waterMat) : null; seaWater = sg ? new THREE.Mesh(sg, waterMat) : null;
  if (lakeWater) { lakeWater.receiveShadow = true; lakeWater.visible = !winter; world.add(lakeWater); }
  if (seaWater) { seaWater.receiveShadow = true; world.add(seaWater); }
  // ympäröivä maa: kartta ei enää leiju tyhjän päällä
  outerGround = [];
  const seaSouth = !!cfg.sea;
  const rects = [[-120, -4.7, -120, 120], [30, 120, -120, 120], [-4.7, 30, -120, -1], [0, 30, -1, 0], [-4.7, 30, 19, 120], [0, 30, 18, 19]];
  for (const [x0, x1, z0, z1] of rects) {
    const south = z0 >= 18, isSea = seaSouth && south && true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), isSea ? outerSeaMat : outerMat);
    m.position.set((x0 + x1) / 2, isSea ? .1 : .27, (z0 + z1) / 2); m.receiveShadow = true; world.add(m); outerGround.push(m);
  }
  // reunametsät
  const n = settings.gfx === 'low' ? 400 : 1800, list = [];
  let seed = cfg.seed * 7919 + 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < n * 3 && list.length < n; k++) {
    const x = -40 + rnd() * 110, z = -30 + rnd() * 78;
    if (x > -5 && x < 30.3 && z > -1.3 && z < 19.3) continue;
    if (seaSouth && z > 18) continue;
    const dEdge = Math.max(0, Math.max(-5 - x, x - 30.3, -1.3 - z, z - 19.3));
    if (vnoise(x * .18 + cfg.seed, z * .18) < (1 - cfg.forest) * .9 - Math.max(0, .35 - dEdge * .05)) continue;
    if (rnd() < dEdge / 70) continue;
    list.push([x, z]);
  }
  outerTrees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, list.length));
  outerTrees.castShadow = false; outerTrees.receiveShadow = true;
  list.forEach(([x, z], k) => {
    const sc = (.8 + rnd() * .6) * cfg.trees.scale; dummy.position.set(x, .27, z); dummy.scale.set(sc * cfg.trees.slim, sc, sc * cfg.trees.slim); dummy.rotation.y = rnd() * 6; dummy.updateMatrix();
    outerTrees.setMatrixAt(k, dummy.matrix);
    tmpCol.setHex(winter ? cfg.trees.winterCol : cfg.trees.col).multiplyScalar(.75 + rnd() * .3); outerTrees.setColorAt(k, tmpCol);
  });
  dummy.rotation.set(0, 0, 0);
  world.add(outerTrees);
  // kivet pelloille ja tuntureille
  const rk = [];
  for (let i = 0; i < N; i++) {
    const t = terr[i], pr = t === FELL ? .7 : t === FIELD ? .12 : t === FOREST ? .1 : 0;
    if (hash2(i, 77 + cfg.seed) < pr) rk.push(i);
  }
  const rg = new THREE.IcosahedronGeometry(.07, 0);
  rocks = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, rk.length * 2));
  rocks.castShadow = true; rocks.receiveShadow = true;
  let c = 0;
  for (const i of rk) for (let k = 0; k < 2; k++) {
    const x = ix(i) + .15 + hash2(i, k + 3) * .7, z = iz(i) + .15 + hash2(k + 5, i) * .7, sc = .6 + hash2(i + k, 9) * 1.2;
    dummy.position.set(x, tileTop(i) + .02, z); dummy.scale.set(sc, sc * .6, sc); dummy.rotation.set(hash2(i, k) * 3, hash2(k, i) * 3, 0); dummy.updateMatrix();
    rocks.setMatrixAt(c, dummy.matrix); tmpCol.setHex(0x8a8a84).multiplyScalar(.7 + hash2(i, k + 11) * .5); rocks.setColorAt(c, tmpCol); c++;
  }
  rocks.count = c; dummy.rotation.set(0, 0, 0);
  if (c) world.add(rocks);
  colorOuter(false);
}
function colorOuter(fade) {
  const target = new THREE.Color(PAL[winter ? 1 : 0][FOREST]).lerp(new THREE.Color(PAL[winter ? 1 : 0][FIELD]), winter ? .5 : .15).multiplyScalar(winter ? .92 : .66);
  if (fade) { const before = outerMat.color.clone(); outerMat.color.copy(target); fadeMat(outerMat, before); } else outerMat.color.copy(target);
  if (outerTrees && outerTrees.instanceColor) {
    const b = Float32Array.from(outerTrees.instanceColor.array);
    for (let k = 0; k < outerTrees.count; k++) { tmpCol.setHex(winter ? cfg.trees.winterCol : cfg.trees.col).multiplyScalar(.75 + hash2(k, 31) * .3); outerTrees.setColorAt(k, tmpCol); }
    outerTrees.instanceColor.needsUpdate = true;
    if (fade) fadeAttr(outerTrees.instanceColor, b);
  }
  if (lakeWater) lakeWater.visible = !winter;
  if (rocks && rocks.count) for (let k = 0; k < rocks.count; k++) { /* kivet pysyvät */ }
}
function buildTrees() {
  treeOf.clear();
  const forestTiles = []; for (let i = 0; i < N; i++) if (terr[i] === FOREST) forestTiles.push(i);
  const per = cfg.trees.n;
  trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, forestTiles.length * per));
  trees.castShadow = true; trees.receiveShadow = true; world.add(trees);
  let k = 0;
  for (const i of forestTiles) {
    const x = ix(i), z = iz(i), list = [];
    for (let t = 0; t < per; t++) {
      const s = (.8 + hash2(x * 7 + t, z * 3) * .55) * cfg.trees.scale;
      dummy.position.set(x + .2 + hash2(x + t * 11, z) * .6, tileTop(i), z + .2 + hash2(x, z + t * 13) * .6);
      dummy.scale.set(s * cfg.trees.slim, s, s * cfg.trees.slim); dummy.rotation.y = hash2(t, x + z); dummy.updateMatrix();
      trees.setMatrixAt(k, dummy.matrix); list.push(k++);
    }
    treeOf.set(i, list);
  }
  if (!forestTiles.length) trees.setMatrixAt(0, ZERO);
  dummy.rotation.set(0, 0, 0);
  colorTrees();
}
function colorTrees() {
  for (let k = 0; k < trees.count; k++) {
    tmpCol.setHex(winter ? cfg.trees.winterCol : cfg.trees.col).multiplyScalar(.85 + hash2(k, 7) * .3);
    trees.setColorAt(k, tmpCol);
  }
  trees.instanceColor.needsUpdate = true;
}
function clearTrees(i) {
  const l = treeOf.get(i); if (!l) return;
  for (const k of l) trees.setMatrixAt(k, ZERO);
  trees.instanceMatrix.needsUpdate = true; treeOf.delete(i);
}

function label(text, size = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 60px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(text, 256, 64);
  g.fillStyle = '#fff'; g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(4 * size, size, 1); return s;
}
// --- rajamerkit (sektorikohtaiset, maaston korkeuden mukaan)
function coloredGeo(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const POST_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Suomen rajapyykki: sini-valkoiset raidat, sininen huippu
const FIN_POST_GEO = (() => {
  const parts = [], band = .068, n = 10;
  for (let k = 0; k < n; k++) parts.push(coloredGeo(new THREE.BoxGeometry(.075, band, .075).translate(0, band / 2 + k * band, 0), k % 2 ? 0x1f63c4 : 0xf4f6f8));
  parts.push(coloredGeo(new THREE.ConeGeometry(.056, .08, 4).rotateY(Math.PI / 4).translate(0, n * band + .04, 0), 0x1f63c4));
  return mergeGeometries(parts);
})();
// Venäjän rajapyykki: puna-vihreät raidat, valkoinen jalusta
const RUS_POST_GEO = (() => {
  const parts = [], band = .07, n = 11, b0 = .035;
  parts.push(coloredGeo(new THREE.BoxGeometry(.27, b0, .27).translate(0, b0 / 2, 0), 0xf2f2f0));
  for (let k = 0; k < n; k++) parts.push(coloredGeo(new THREE.BoxGeometry(.085, band, .085).translate(0, b0 + band / 2 + k * band, 0), k % 2 ? 0x2f8a3f : 0xc7262c));
  parts.push(coloredGeo(new THREE.ConeGeometry(.064, .06, 4).rotateY(Math.PI / 4).translate(0, b0 + n * band + .03, 0), 0xc7262c));
  return mergeGeometries(parts);
})();
// valkoinen rajamerkki itse rajalinjalla
const MARK_GEO = mergeGeometries([
  coloredGeo(new THREE.CylinderGeometry(.026, .03, .2, 6).translate(0, .1, 0), 0xf4f6f8),
  coloredGeo(new THREE.ConeGeometry(.026, .03, 6).translate(0, .215, 0), 0xf4f6f8),
]);
const BORDER_LINE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .3, depthWrite: false });
function buildBorder() {
  // ei tolppia vesille eikä teille
  const water = t => t === LAKE || t === SEA || t === ROAD;
  for (let z = 0; z < H; z++) {
    const fi = idx(BORDER - 1, z), ru = idx(BORDER, z);
    const y = Math.max(tileTop(fi), tileTop(ru));
    world.add(mesh(new THREE.BoxGeometry(.03, .01, 1), BORDER_LINE_MAT, BORDER, y + .006, z + .5, false));
    if (z % 2 !== 0) continue;
    const zz = z + .5;
    if (!water(terr[fi])) { const p = mesh(FIN_POST_GEO, POST_MAT, BORDER - .32, tileTop(fi), zz); p.rotation.y = .1; world.add(p); }
    if (!water(terr[ru])) { const p = mesh(RUS_POST_GEO, POST_MAT, BORDER + .32, tileTop(ru), zz); p.rotation.y = -.08; world.add(p); }
    if (!water(terr[fi]) && !water(terr[ru])) world.add(mesh(MARK_GEO, POST_MAT, BORDER, y, zz + .15));
  }
}

// --- kaupunki: kerrostalokorttelit
const FACADES = ['#ece8de', '#ddcca6', '#c9cdcb', '#e8d892', '#a95c45', '#dcdfe0', '#b7c4cc'];
function makeFacadeTex(col, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 62, 128, 3); g.fillRect(0, 126, 128, 2);
  for (let fl = 0; fl < 2; fl++) for (let w = 0; w < 4; w++) {
    const x = w * 32 + 7, y = fl * 64 + 16;
    const lit = hash2(fl * 7 + w + seed * 13, seed) < .22;
    g.fillStyle = lit ? '#f2d98a' : '#3b4956'; g.fillRect(x, y, 18, 28);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 18, 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const facadeTex = FACADES.map((c, k) => makeFacadeTex(c, k + 1));
const facadeMatCache = new Map();
function facadeMat(ci, rx, ry) {
  const key = `${ci}_${rx}_${ry}`;
  if (!facadeMatCache.has(key)) {
    const t = facadeTex[ci].clone(); t.repeat.set(rx, ry); t.needsUpdate = true;
    facadeMatCache.set(key, new THREE.MeshLambertMaterial({ map: t }));
  }
  return facadeMatCache.get(key);
}
const FLOOR_H = .11, GROUND_Y = .28;
function apartment(x, z, w, d, floors, ci) {
  const h = floors * FLOOR_H;
  const wx = Math.max(1, Math.round(w / .17)), wz = Math.max(1, Math.round(d / .17));
  const sideX = facadeMat(ci, wz / 4, floors / 2), sideZ = facadeMat(ci, wx / 4, floors / 2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideX, sideX, MAT.flatRoof, MAT.flatRoof, sideZ, sideZ]);
  m.position.set(x, GROUND_Y + h / 2, z); m.castShadow = true; m.receiveShadow = true; world.add(m);
  // konehuone katolla
  world.add(mesh(new THREE.BoxGeometry(Math.min(.2, w * .4), .06, Math.min(.2, d * .4)), MAT.flatRoof, x, GROUND_Y + h + .03, z));
}
function smallHouse(x, z, s, mat) {
  const hb = new THREE.BoxGeometry(.4 * s, .26 * s, .32 * s), rf = new THREE.ConeGeometry(.34 * s, .22 * s, 4); rf.rotateY(Math.PI / 4);
  world.add(mesh(hb, mat, x, GROUND_Y + .13 * s, z));
  world.add(mesh(rf, MAT.roof, x, GROUND_Y + .26 * s + .11 * s, z));
}
function buildTown() {
  townGround = mesh(new THREE.BoxGeometry(4.7, .28, H + 2), M(winter ? 0xdfe6e9 : 0x7d8f6a), -2.35, .14, H / 2, false);
  world.add(townGround);
  // kadut: kartalta tulevat tiet jatkuvat kaupunkiin + pohjois–etelä-katu
  const streets = [];
  for (let z = 0; z < H; z++) if (terr[idx(0, z)] === ROAD) streets.push(z + .5);
  for (const sz of streets) world.add(mesh(new THREE.BoxGeometry(4.7, .02, .55), MAT.street, -2.35, GROUND_Y + .01, sz, false));
  for (const sx of [-1.8, -3.25]) world.add(mesh(new THREE.BoxGeometry(.26, .02, H + 2), MAT.street, sx, GROUND_Y + .011, H / 2, false));
  let seed = cfg.seed * 977 + 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const dens = clamp(cfg.townSize / 12, .55, 1);
  const north = !!cfg.north;
  const cols = [{ x0: -1.64, x1: -.1 }, { x0: -3.1, x1: -1.96 }, { x0: -4.66, x1: -3.4 }];
  const blocked = (z0, z1) => streets.some(sz => z1 > sz - .38 && z0 < sz + .38);
  for (const col of cols) {
    let z = -.9;
    while (z < H + .9) {
      const r = rnd();
      let w, d, floors, kind;
      if (north && r < .45) kind = 'house';
      else if (r < (north ? .7 : .5)) kind = 'lamella';
      else if (r < (north ? .85 : .72)) kind = 'cross';
      else kind = 'tower';
      const cw = col.x1 - col.x0;
      if (kind === 'lamella') { w = .42 + rnd() * .14; d = 1.1 + rnd() * 1.0; floors = north ? 2 + ((rnd() * 2) | 0) : 3 + ((rnd() * 3) | 0); }
      else if (kind === 'cross') { w = Math.min(cw - .1, 1.0 + rnd() * .4); d = .42 + rnd() * .1; floors = north ? 2 + ((rnd() * 2) | 0) : 4 + ((rnd() * 3) | 0); }
      else if (kind === 'tower') { w = d = .5 + rnd() * .16; floors = north ? 3 + ((rnd() * 2) | 0) : 7 + ((rnd() * 5) | 0); }
      else { w = d = .5; floors = 0; }
      const z0 = z, z1 = z + d;
      if (z1 > H + 1) break;
      if (blocked(z0, z1)) { z += .2; continue; }
      if (rnd() < dens) {
        const xc = col.x0 + w / 2 + rnd() * Math.max(0, cw - w);
        const zc = (z0 + z1) / 2;
        if (kind === 'house') {
          smallHouse(xc, zc, .9 + rnd() * .3, rnd() < .5 ? MAT.houseR : MAT.house);
          if (cw > 1 && rnd() < .7) smallHouse(Math.min(col.x1 - .25, xc + .6), zc + (rnd() - .5) * .2, .85 + rnd() * .3, rnd() < .5 ? MAT.houseR : MAT.houseB);
        } else {
          apartment(xc, zc, w, d, floors, (rnd() * FACADES.length) | 0);
          // vierekkäinen toinen talo, jos tilaa jää
          if (kind !== 'cross' && cw - w > .6 && rnd() < dens) {
            const w2 = .42 + rnd() * .12, x2 = xc + (xc - col.x0 < cw / 2 ? 1 : -1) * (w / 2 + w2 / 2 + .14);
            if (x2 - w2 / 2 > col.x0 - .01 && x2 + w2 / 2 < col.x1 + .01) apartment(x2, zc, w2, Math.min(d, .9 + rnd() * .6), Math.max(2, floors - 1 - ((rnd() * 2) | 0)), (rnd() * FACADES.length) | 0);
          }
        }
      }
      z = z1 + .12 + rnd() * .1;
    }
  }
  applyTownWinter();
  const a = label(L('SUOMI', 'FINLAND')); a.position.set(BORDER - 3, 1.6, -1); world.add(a);
  const b = label(L('VENÄJÄ', 'RUSSIA')); b.position.set(BORDER + 3, 1.6, -1); world.add(b);
  const c = label(cfg.city.toUpperCase(), .9); c.position.set(-2.3, north ? 1.7 : 2.6, H / 2); world.add(c);
}
function applyTownWinter() {
  MAT.flatRoof.color.setHex(winter ? 0xe9eef1 : 0x5b6066);
  MAT.roof.color.setHex(winter ? 0xe3e9ec : 0x7a3e2e);
  MAT.street.color.setHex(winter ? 0x9aa0a5 : 0x55585c);
  if (townGround) townGround.material.color.setHex(winter ? 0xdfe6e9 : 0x7d8f6a);
}

// --- elinvoimapalkit
const BAR_BG = new THREE.SpriteMaterial({ color: 0x111111, depthTest: false, transparent: true, opacity: .7 });
const BAR_E = new THREE.SpriteMaterial({ color: 0xffd23f, depthTest: false });
const BAR_T = new THREE.SpriteMaterial({ color: 0x5ab4ff, depthTest: false });
function makeBar(w, mat) {
  const root = new THREE.Group();
  const bg = new THREE.Sprite(BAR_BG); bg.scale.set(w, .07, 1); bg.renderOrder = 20;
  const fg = new THREE.Sprite(mat); fg.scale.set(w, .07, 1); fg.renderOrder = 21;
  root.add(bg, fg);
  return { root, set(f) { f = clamp(f, 0, 1); fg.visible = f > .001; fg.scale.x = w * Math.max(f, .001); fg.center.set(.5 / Math.max(f, .001), .5); } };
}

// --- valinnan korostus
const hlMat = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: .45, depthWrite: false });
const hl = new THREE.Mesh(new THREE.PlaneGeometry(.96, .96).rotateX(-Math.PI / 2), hlMat);
hl.visible = false; hl.renderOrder = 5; scene.add(hl);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64).rotateX(-Math.PI / 2), ringMat);
ring.visible = false; ring.renderOrder = 6; scene.add(ring);
const ringIn = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 48).rotateX(-Math.PI / 2), ringMat);
ringIn.visible = false; scene.add(ringIn);
function showRange(x, z, y, r, rMin) {
  ring.visible = r > 0; ring.position.set(x, y + .05, z); ring.scale.setScalar(r);
  ringIn.visible = !!rMin; if (rMin) { ringIn.position.set(x, y + .05, z); ringIn.scale.setScalar(rMin); }
}
const towerRange = (def, lvl, i) => Math.max(1.5, def.range + .5 * (lvl - 1) + (terr[i] === FELL ? 1 : 0) + (phase === 'wave' ? COND[cond].range : 0));

// ================= RAKENNELMIEN MALLIT =================
function makeStructMesh(kind) {
  const g = new THREE.Group(); const t = new THREE.Group(); t.position.y = .12;
  const base = () => g.add(mesh(new THREE.CylinderGeometry(.36, .4, .12, 6), MAT.base, 0, .06, 0));
  if (kind === 'mg') {
    base(); g.add(t);
    t.add(mesh(new THREE.BoxGeometry(.26, .18, .26), MAT.fin, 0, .09, 0));
    const b = mesh(new THREE.CylinderGeometry(.03, .03, .38, 5), MAT.dark, .25, .13, 0); b.rotation.z = Math.PI / 2; t.add(b);
  } else if (kind === 'mortar') {
    base(); g.add(t);
    t.add(mesh(new THREE.BoxGeometry(.3, .05, .3), MAT.fin, 0, .03, 0));
    const tube = mesh(new THREE.CylinderGeometry(.07, .08, .55, 7), MAT.metal, .08, .28, 0); tube.rotation.z = -.7; t.add(tube);
    const leg = mesh(new THREE.CylinderGeometry(.015, .015, .3, 4), MAT.dark, .14, .12, .08); leg.rotation.x = .4; t.add(leg);
  } else if (kind === 'atgm') {
    base(); g.add(t);
    for (const a of [0, 2.1, 4.2]) { const l = mesh(new THREE.CylinderGeometry(.015, .015, .32, 4), MAT.dark, Math.cos(a) * .08, .13, Math.sin(a) * .08); l.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); t.add(l); }
    t.add(mesh(new THREE.BoxGeometry(.42, .13, .13), MAT.fin, .05, .32, 0));
    t.add(mesh(new THREE.BoxGeometry(.1, .1, .16), MAT.dark, -.12, .32, 0));
  } else if (kind === 'aa') {
    base(); g.add(t);
    t.add(mesh(new THREE.BoxGeometry(.32, .16, .32), MAT.fin, 0, .08, 0));
    for (const zz of [-.07, .07]) { const b = mesh(new THREE.CylinderGeometry(.025, .025, .45, 5), MAT.dark, .14, .3, zz); b.rotation.z = -.8; t.add(b); }
    const radar = new THREE.Group(); radar.position.set(-.1, .2, 0); g.add(radar);
    radar.add(mesh(new THREE.CylinderGeometry(.02, .02, .2, 4), MAT.dark, 0, .1, 0));
    radar.add(mesh(new THREE.BoxGeometry(.04, .14, .3), MAT.white, 0, .24, 0));
    g.userData.radar = radar;
  } else if (kind === 'k9') {
    g.add(t); t.position.y = 0;
    t.add(mesh(new THREE.BoxGeometry(.62, .16, .4), MAT.finG, 0, .14, 0));
    for (const z of [-.18, .18]) t.add(mesh(new THREE.BoxGeometry(.64, .1, .08), MAT.dark, 0, .06, z));
    t.add(mesh(new THREE.BoxGeometry(.32, .16, .32), MAT.finG2, -.06, .3, 0));
    const b = mesh(new THREE.CylinderGeometry(.035, .04, .7, 6), MAT.dark, .3, .42, 0); b.rotation.z = -1.15; t.add(b);
  } else if (kind === 'nasams') {
    base(); g.add(t);
    t.add(mesh(new THREE.BoxGeometry(.3, .08, .3), MAT.fin, 0, .04, 0));
    const pod = new THREE.Group(); pod.position.set(0, .18, 0); pod.rotation.z = .6; t.add(pod);
    pod.add(mesh(new THREE.BoxGeometry(.46, .16, .26), MAT.finG, 0, 0, 0));
    for (const z of [-.06, .06]) for (const y of [-.04, .04]) pod.add(mesh(new THREE.CylinderGeometry(.025, .025, .02, 6).rotateZ(Math.PI / 2), MAT.dark, .235, y, z));
    const radar = new THREE.Group(); radar.position.set(-.26, .12, .2); g.add(radar);
    radar.add(mesh(new THREE.BoxGeometry(.04, .2, .16), MAT.white, 0, .1, 0));
    g.userData.radar = radar;
  } else if (kind === 'leo') {
    g.add(mesh(new THREE.BoxGeometry(.66, .17, .4), MAT.finG, 0, .12, 0));
    for (const z of [-.19, .19]) g.add(mesh(new THREE.BoxGeometry(.68, .11, .07), MAT.dark, 0, .06, z));
    g.add(t); t.position.y = .22;
    t.add(mesh(new THREE.BoxGeometry(.36, .13, .3), MAT.finG2, -.04, .06, 0));
    t.add(mesh(new THREE.BoxGeometry(.08, .03, .12), MAT.blue, -.16, .135, 0));
    const b = mesh(new THREE.CylinderGeometry(.03, .03, .6, 6), MAT.dark, .42, .07, 0); b.rotation.z = Math.PI / 2; t.add(b);
  } else if (kind === 'amv') {
    g.add(mesh(new THREE.BoxGeometry(.6, .18, .3), MAT.finG, 0, .17, 0));
    g.add(mesh(new THREE.BoxGeometry(.16, .1, .28), MAT.finG2, .26, .14, 0));
    for (const x of [-.21, -.07, .07, .21]) for (const z of [-.15, .15]) g.add(mesh(new THREE.CylinderGeometry(.06, .06, .05, 8).rotateX(Math.PI / 2), MAT.dark, x, .07, z));
    g.add(t); t.position.y = .27;
    t.add(mesh(new THREE.BoxGeometry(.16, .07, .14), MAT.finG2, 0, .03, 0));
    t.add(mesh(new THREE.BoxGeometry(.06, .03, .1), MAT.blue, -.07, .075, 0));
    const b = mesh(new THREE.CylinderGeometry(.015, .015, .26, 5), MAT.dark, .17, .04, 0); b.rotation.z = Math.PI / 2; t.add(b);
  } else if (kind === 'obstacle') {
    const c = new THREE.ConeGeometry(.15, .32, 4);
    for (const [x, z] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22], [0, 0]]) g.add(mesh(c, MAT.stone, x, .16, z));
  } else if (kind === 'apmine') {
    const d = new THREE.CylinderGeometry(.05, .05, .05, 6);
    for (const [x, z] of [[-.22, -.18], [.15, -.24], [-.05, .12], [.24, .16], [-.25, .22]]) g.add(mesh(d, MAT.mine, x, .025, z, false));
    g.add(mesh(new THREE.CylinderGeometry(.012, .012, .3, 4), MAT.dark, .32, .15, -.3));
    g.add(mesh(new THREE.ConeGeometry(.08, .1, 3).rotateX(Math.PI).rotateZ(Math.PI / 2), MAT.accent, .32, .3, -.3));
  } else if (kind === 'mine') {
    const d = new THREE.CylinderGeometry(.09, .09, .04, 8);
    for (const [x, z] of [[-.2, -.15], [.18, -.2], [0, .2]]) g.add(mesh(d, MAT.mine, x, .02, z, false));
    g.add(mesh(new THREE.CylinderGeometry(.012, .012, .3, 4), MAT.dark, .3, .15, .3));
    g.add(mesh(new THREE.BoxGeometry(.02, .1, .14), MAT.warn, .3, .3, .3));
  }
  g.userData.turret = t;
  return g;
}
function addFortMesh(s) {
  if (s.fort === 1) {
    const sb = mesh(new THREE.TorusGeometry(.47, .08, 4, 8), MAT.sand, 0, .08, 0); sb.rotation.x = Math.PI / 2; s.group.add(sb);
  } else if (s.fort === 2) {
    const wall = (w, d, x, z) => s.group.add(mesh(new THREE.BoxGeometry(w, .32, d), MAT.concrete, x, .16, z));
    wall(1, .09, 0, -.46); wall(1, .09, 0, .46); wall(.09, .82, -.46, 0); wall(.09, .82, .46, 0);
  }
}
function addLevelMark(s) {
  s.group.add(mesh(new THREE.BoxGeometry(.12, .03, .05), MAT.warn, -.25, .13 + (s.lvl - 2) * .05, .28, false));
}

// ================= YKSIKKÖMALLIT =================
const proto = {};
{
  let g = new THREE.Group();
  const body = new THREE.BoxGeometry(.09, .2, .09), head = new THREE.BoxGeometry(.07, .07, .07);
  for (const [x, z] of [[0, 0], [-.14, .1], [-.12, -.12]]) { g.add(mesh(body, MAT.inf, x, .1, z)); g.add(mesh(head, MAT.enemy, x, .24, z)); }
  proto.inf = g;
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.52, .18, .32), MAT.enemy, 0, .13, 0));
  g.add(mesh(new THREE.BoxGeometry(.32, .02, .33), MAT.accent, -.05, .23, 0));
  const tb = new THREE.Group(); tb.position.y = .24; tb.name = 't'; g.add(tb);
  tb.add(mesh(new THREE.BoxGeometry(.18, .09, .16), MAT.enemy2, 0, .05, 0));
  const br = mesh(new THREE.CylinderGeometry(.018, .018, .3, 4), MAT.dark, .18, .06, 0); br.rotation.z = Math.PI / 2; tb.add(br);
  proto.bmp = g;
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.64, .2, .42), MAT.enemy, 0, .14, 0));
  for (const z of [-.2, .2]) g.add(mesh(new THREE.BoxGeometry(.66, .12, .08), MAT.dark, 0, .07, z));
  const tt = new THREE.Group(); tt.position.y = .25; tt.name = 't'; g.add(tt);
  tt.add(mesh(new THREE.BoxGeometry(.34, .14, .3), MAT.enemy2, -.02, .07, 0));
  tt.add(mesh(new THREE.BoxGeometry(.2, .02, .31), MAT.accent, -.02, .145, 0));
  const tb2 = mesh(new THREE.CylinderGeometry(.03, .03, .55, 5), MAT.dark, .38, .08, 0); tb2.rotation.z = Math.PI / 2; tt.add(tb2);
  proto.tank = g;
  g = new THREE.Group();
  const bd = mesh(new THREE.CylinderGeometry(.04, .03, .34, 5), MAT.enemy, 0, 0, 0); bd.rotation.z = Math.PI / 2; g.add(bd);
  g.add(mesh(new THREE.BoxGeometry(.1, .02, .52), MAT.enemy2, -.02, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(.06, .025, .2), MAT.accent, -.15, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(.06, .12, .02), MAT.enemy2, -.15, .05, 0));
  proto.drone = g;
  // taisteluhelikopteri
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.42, .16, .16), MAT.enemy, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(.12, .1, .12), MAT.enemy2, .22, -.01, 0));
  g.add(mesh(new THREE.BoxGeometry(.5, .05, .05), MAT.enemy, -.4, .03, 0));
  g.add(mesh(new THREE.BoxGeometry(.04, .14, .1), MAT.accent, -.64, .07, 0));
  g.add(mesh(new THREE.BoxGeometry(.06, .02, .4), MAT.enemy2, .02, -.06, 0));
  const rotor = new THREE.Group(); rotor.name = 'r'; rotor.position.y = .13; g.add(rotor);
  rotor.add(mesh(new THREE.BoxGeometry(1.0, .01, .05), MAT.dark, 0, 0, 0, false));
  rotor.add(mesh(new THREE.BoxGeometry(.05, .01, 1.0), MAT.dark, 0, 0, 0, false));
  proto.heli = g;
  // häirintäasema
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.5, .2, .3), MAT.enemy, 0, .16, 0));
  for (const x of [-.16, .16]) for (const z of [-.15, .15]) g.add(mesh(new THREE.CylinderGeometry(.06, .06, .05, 8).rotateX(Math.PI / 2), MAT.dark, x, .06, z));
  g.add(mesh(new THREE.CylinderGeometry(.015, .015, .5, 4), MAT.dark, -.1, .5, 0));
  const dsh = mesh(new THREE.CylinderGeometry(.13, .05, .05, 8), MAT.purple, .1, .34, 0); dsh.rotation.z = .6; dsh.name = 'd'; g.add(dsh);
  const ewRing = new THREE.Mesh(new THREE.RingGeometry(3.85, 4, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb27ce0, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  ewRing.position.y = .06; ewRing.name = 'ring'; g.add(ewRing);
  proto.ew = g;
  // erikoisjoukot
  g = new THREE.Group();
  for (const [x, z] of [[0, 0], [-.12, .1], [-.12, -.1], [-.22, 0]]) { g.add(mesh(body, MAT.spec, x, .1, z)); g.add(mesh(head, MAT.accent, x, .24, z)); }
  proto.spec = g;
  // tykistöpatteri
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.1, .03, .9), MAT.inf, 0, .02, 0, false));
  for (const z of [-.22, .22]) {
    g.add(mesh(new THREE.BoxGeometry(.32, .14, .2), MAT.enemy, .05, .1, z));
    const b = mesh(new THREE.CylinderGeometry(.03, .035, .6, 6), MAT.dark, -.22, .26, z); b.rotation.z = 1.1; g.add(b);
  }
  g.add(mesh(new THREE.BoxGeometry(.18, .12, .5), MAT.accent, .38, .08, 0));
  proto.battery = g;
  // poro
  g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.34, .15, .14), MAT.deer, 0, .3, 0));
  g.add(mesh(new THREE.BoxGeometry(.2, .05, .12), MAT.deerL, 0, .22, 0));
  const neck = mesh(new THREE.BoxGeometry(.07, .17, .08), MAT.deerL, .17, .4, 0); neck.rotation.z = -.5; g.add(neck);
  const hd = new THREE.Group(); hd.position.set(.23, .47, 0); hd.name = 'h'; g.add(hd);
  hd.add(mesh(new THREE.BoxGeometry(.13, .07, .07), MAT.deer, .04, 0, 0));
  for (const zz of [-.04, .04]) {
    const a = mesh(new THREE.CylinderGeometry(.008, .012, .2, 3), MAT.antler, -.01, .1, zz); a.rotation.set(zz * 6, 0, .35); hd.add(a);
    const b = mesh(new THREE.CylinderGeometry(.006, .008, .09, 3), MAT.antler, .04, .15, zz * 1.6); b.rotation.z = -.6; hd.add(b);
  }
  const legG = new THREE.BoxGeometry(.03, .23, .03);
  for (const [x, z] of [[.12, .05], [.12, -.05], [-.12, .05], [-.12, -.05]]) g.add(mesh(legG, MAT.deer, x, .115, z));
  g.add(mesh(new THREE.BoxGeometry(.04, .04, .05), MAT.deerL, -.18, .34, 0));
  proto.deer = g;
}

// ================= EFEKTIT =================
const boomGeo = new THREE.IcosahedronGeometry(1, 0);
let shockwaves = [];
const debrisGeo = new THREE.BoxGeometry(.05, .05, .05), smokeGeo = new THREE.IcosahedronGeometry(1, 1);
let debris = [];
function boom(x, y, z, r, color = 0xffa040) {
  const bm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }); bm.color.multiplyScalar(2.2);
  const m = new THREE.Mesh(boomGeo, bm);
  if (r >= .4 && settings.gfx !== 'low') {
    for (let k = 0; k < (r >= .8 ? 7 : 4); k++) {
      const d = new THREE.Mesh(debrisGeo, MAT.rubble); d.position.set(x, y, z); world.add(d);
      const a = Math.random() * 6.28, sp = 1 + Math.random() * 2 * r;
      debris.push({ m: d, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 3 * r, t: 1.2, kind: 'deb' });
    }
    for (let k = 0; k < (r >= .8 ? 3 : 1); k++) {
      const sm = new THREE.Mesh(smokeGeo, new THREE.MeshLambertMaterial({ color: 0x5a5a5a, transparent: true, opacity: .55, depthWrite: false, flatShading: true }));
      sm.position.set(x + (Math.random() - .5) * r, y + .1, z + (Math.random() - .5) * r); sm.scale.setScalar(.12 * r + .05); world.add(sm);
      debris.push({ m: sm, vy: .5 + Math.random() * .4, t: 2.2, T: 2.2, grow: .35 * r + .15, kind: 'smoke' });
    }
  }
  m.position.set(x, y, z); m.scale.setScalar(r * .2); world.add(m);
  effects.push({ obj: m, t: .45, T: .45, r, kind: 'boom' });
  if (r > .3) shockwaves.push({ x, z, r: r * 2.5 });
  if (r >= .8) sfx('boomL'); else if (r >= .35) sfx('boomS');
}
function puff(p) {
  const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xbfbfbf, transparent: true, opacity: .5, depthWrite: false }));
  m.position.copy(p); m.scale.setScalar(.05); world.add(m);
  effects.push({ obj: m, t: .5, T: .5, r: .12, kind: 'boom' });
}
function tracer(a, b, color, life = .07) {
  const lm = new THREE.LineBasicMaterial({ color, transparent: true }); lm.color.multiplyScalar(1.8);
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lm);
  world.add(l); effects.push({ obj: l, t: life, T: life, kind: 'fade' });
}
function updateDebris(dt) {
  for (const d of debris) {
    d.t -= dt;
    if (d.kind === 'deb') { d.vy -= 9 * dt; d.m.position.x += d.vx * dt; d.m.position.z += d.vz * dt; d.m.position.y = Math.max(.3, d.m.position.y + d.vy * dt); d.m.rotation.x += dt * 8; d.m.rotation.z += dt * 6; }
    else { d.m.position.y += d.vy * dt; d.m.scale.addScalar(d.grow * dt); d.m.material.opacity = .55 * Math.max(0, d.t / d.T); }
    if (d.t <= 0) { world.remove(d.m); if (d.kind === 'smoke') d.m.material.dispose(); }
  }
  debris = debris.filter(d => d.t > 0);
  for (const w of wrecks) {
    w.t -= dt; w.st -= dt;
    if (w.st <= 0 && w.t > 6) { w.st = .35; const p = w.m.position.clone(); p.y += .3; puffDark(p); }
    if (w.t < 3) w.m.position.y -= dt * .08;
    if (w.t <= 0) world.remove(w.m);
  }
  wrecks = wrecks.filter(w => w.t > 0);
}
let wrecks = [];
const MAT_BURNT = new THREE.MeshLambertMaterial({ color: 0x1e1c1a, flatShading: true });
function puffDark(p) {
  const m = new THREE.Mesh(smokeGeo, new THREE.MeshLambertMaterial({ color: 0x2e2e2e, transparent: true, opacity: .45, depthWrite: false, flatShading: true }));
  m.position.copy(p); m.scale.setScalar(.08); world.add(m);
  debris.push({ m, vy: .45, t: 2.4, T: 2.4, grow: .22, kind: 'smoke' });
}
function addWreck(e) {
  if (settings.gfx === 'low' || e.cls !== 'veh' || e.d.static) return;
  const w = proto[e.type].clone();
  w.traverse(o => { if (o.isMesh) o.material = MAT_BURNT; });
  w.position.copy(e.mesh.position); w.rotation.copy(e.mesh.rotation); w.rotation.z = (Math.random() - .5) * .2;
  world.add(w); wrecks.push({ m: w, t: 22, st: 0 });
}
function updateEffects(dt) {
  for (const f of effects) {
    f.t -= dt; const k = Math.max(0, f.t / f.T);
    f.obj.material.opacity = (f.kind === 'boom' ? .9 : 1) * k;
    if (f.kind === 'boom') f.obj.scale.setScalar(f.r * (.2 + .8 * (1 - k)));
    if (f.t <= 0) { world.remove(f.obj); if (f.kind === 'fade') f.obj.geometry.dispose(); f.obj.material.dispose(); }
  }
  effects = effects.filter(f => f.t > 0);
}

// ================= POROT =================
function deerPassable(i) {
  const t = terr[i]; if (t === LAKE && !winter) return false; if (t === SEA) return false;
  const s = structs.get(i); return !(s && TOWERS.has(s.kind));
}
function randomDeerTile(nearX, nearZ, rad) {
  for (let k = 0; k < 40; k++) {
    const x = nearX == null ? (Math.random() * W) | 0 : clamp(Math.round(nearX + (Math.random() - .5) * 2 * rad), 0, W - 1);
    const z = nearZ == null ? (Math.random() * H) | 0 : clamp(Math.round(nearZ + (Math.random() - .5) * 2 * rad), 0, H - 1);
    const i = idx(x, z); if (deerPassable(i)) return i;
  }
  return -1;
}
function spawnDeer(n) {
  // porot tulevat pieninä tokkina
  let made = 0;
  while (made < n) {
    const c = randomDeerTile(); if (c < 0) break;
    const herd = Math.min(n - made, 2 + ((Math.random() * 3) | 0));
    for (let k = 0; k < herd; k++) {
      const m = proto.deer.clone(); m.scale.setScalar(.85 + Math.random() * .3);
      const d = { x: ix(c) + .5 + (Math.random() - .5) * .8, z: iz(c) + .5 + (Math.random() - .5) * .8, rot: Math.random() * 6, state: 'graze', t: Math.random() * 4, tx: 0, tz: 0, mesh: m, head: m.getObjectByName('h'), ph: Math.random() * 6 };
      d.mesh.position.set(d.x, tileTop(c), d.z); world.add(m); deer.push(d);
    }
    made += herd;
  }
}
function updateDeer(dt) {
  for (const d of deer) {
    // uhka: viholliset tai räjähdykset lähellä
    let fx = 0, fz = 0, threat = false;
    for (const e of enemies) {
      if (e.dead || e.cls === 'air') continue;
      const dx = d.x - e.x, dz = d.z - e.z, dd = Math.hypot(dx, dz);
      if (dd < 1.8 && dd > 1e-3) { fx += dx / dd; fz += dz / dd; threat = true; }
    }
    for (const s of shockwaves) {
      const dx = d.x - s.x, dz = d.z - s.z, dd = Math.hypot(dx, dz);
      if (dd < s.r && dd > 1e-3) { fx += dx / dd * 2; fz += dz / dd * 2; threat = true; }
    }
    if (threat) { d.state = 'flee'; d.t = 1.2; d.fx = fx; d.fz = fz; }
    d.t -= dt;
    let sp = 0, dirx = 0, dirz = 0;
    if (d.state === 'flee') {
      const l = Math.hypot(d.fx, d.fz) || 1; dirx = d.fx / l; dirz = d.fz / l; sp = 1.7;
      if (d.t <= 0) { d.state = 'graze'; d.t = 2 + Math.random() * 3; }
    } else if (d.state === 'walk') {
      const dx = d.tx - d.x, dz = d.tz - d.z, l = Math.hypot(dx, dz);
      if (l < .1 || d.t <= 0) { d.state = 'graze'; d.t = 2 + Math.random() * 5; }
      else { dirx = dx / l; dirz = dz / l; sp = .45; }
    } else if (d.t <= 0) {
      const tgt = randomDeerTile(d.x, d.z, 3);
      if (tgt >= 0) { d.state = 'walk'; d.tx = ix(tgt) + .2 + Math.random() * .6; d.tz = iz(tgt) + .2 + Math.random() * .6; d.t = 12; }
      else d.t = 2;
    }
    if (sp > 0) {
      const nx = clamp(d.x + dirx * sp * dt, .1, W - .1), nz = clamp(d.z + dirz * sp * dt, .1, H - .1);
      const ni = idx(Math.floor(nx), Math.floor(nz));
      if (deerPassable(ni)) { d.x = nx; d.z = nz; d.rot = lerpAngle(d.rot, -Math.atan2(dirz, dirx), dt * 6); }
      else if (d.state === 'walk') { d.state = 'graze'; d.t = .5; }
      else { const t0 = d.fx; d.fx = -d.fz; d.fz = t0; }
    }
    const ci = idx(clamp(Math.floor(d.x), 0, W - 1), clamp(Math.floor(d.z), 0, H - 1));
    d.ph += dt * (sp > 1 ? 14 : 6);
    d.mesh.position.set(d.x, tileTop(ci) + (sp > 0 ? Math.abs(Math.sin(d.ph)) * (sp > 1 ? .05 : .015) : 0), d.z);
    d.mesh.rotation.y = d.rot;
    if (d.head) d.head.rotation.z = d.state === 'graze' ? -.9 + Math.sin(d.ph * .3) * .1 : 0;
  }
  shockwaves = [];
}
function deerBlocking(x, z) {
  for (const d of deer) if (Math.abs(d.x - x) < .55 && Math.abs(d.z - z) < .55) return true;
  return false;
}

// ================= RAKENTAMINEN =================
function canPlace(kind, i) {
  if (i < 0) return L('Kartan ulkopuolella', 'Outside the map');
  if (ix(i) >= BORDER) return L('Rakentaa voi vain Suomen puolelle', 'You can only build on the Finnish side');
  if (structs.has(i)) return L('Ruutu on jo käytössä', 'Tile already in use');
  if (terr[i] === LAKE) return L('Järveen ei voi rakentaa', 'Cannot build on a lake');
  if (terr[i] === SEA) return L('Mereen ei voi rakentaa', 'Cannot build on the sea');
  if (money < DEFS[kind].cost) return L('Rahat eivät riitä', 'Not enough money');
  if (DEFS[kind].mobile) {
    if (!unitPassable(i)) return L('Ajoneuvo ei pääse tähän maastoon', 'The vehicle cannot enter this terrain');
    if (units.some(u => !u.dead && u.i === i)) return L('Ruudussa on jo ajoneuvo', 'A vehicle is already here');
    return null;
  }
  if (units.some(u => !u.dead && u.i === i)) return L('Ruudussa on oma ajoneuvo', 'Your vehicle is on this tile');
  if (!NONBLOCK.has(kind)) {
    for (const e of enemies) {
      if (e.dead || e.cls === 'air') continue;
      if (e.cur === i || e.next === i || Math.hypot(e.x - ix(i) - .5, e.z - iz(i) - .5) < .8) return L('Vihollinen on ruudussa', 'An enemy is on this tile');
    }
    if (!pathOk(kind, i)) return L('Vihollisen reittiä ei saa sulkea kokonaan', 'You must not block the enemy route completely');
  }
  return null;
}
function clearTile(i) {
  if (terr[i] !== FOREST) return;
  terr[i] = FIELD; cleared.add(i); clearTrees(i); refreshTile(i); tiles.instanceMatrix.needsUpdate = true; tiles.instanceColor.needsUpdate = true;
}
function build(kind, i, free) {
  const def = DEFS[kind];
  if (def.mobile) return spawnUnit(kind, i, free);
  clearTile(i);
  if (rubble.has(i)) { world.remove(rubble.get(i)); rubble.delete(i); }
  const s = { kind, def, i, x: ix(i) + .5, z: iz(i) + .5, lvl: 1, fort: 0, cd: 0, dead: false, charges: def.charges || 0, spent: def.cost };
  s.maxHp = def.hp || 0; s.hp = s.maxHp;
  s.group = makeStructMesh(kind); s.group.position.set(s.x, tileTop(i), s.z); world.add(s.group);
  if (def.hp) { s.bar = makeBar(.7, BAR_T); s.bar.root.position.y = 1; s.bar.root.visible = false; s.group.add(s.bar.root); }
  structs.set(i, s);
  if (!free) { money -= def.cost; sfx('build'); }
  for (const d of deer) if (Math.floor(d.x) === ix(i) && Math.floor(d.z) === iz(i) && TOWERS.has(kind)) { d.state = 'flee'; d.t = 1; d.fx = d.x - s.x || .5; d.fz = d.z - s.z || .5; d.x += d.fx * .3; d.z += d.fz * .3; }
  if (!def.passive || kind === 'obstacle') recomputeFields();
  return s;
}
function calcMaxHp(s) { return s.def.hp * FORT_HP[s.fort] * (1 + .2 * (s.lvl - 1)); }
function hurtStruct(s, dmg) {
  if (s.mobile) return hurtUnit(s, dmg);
  if (s.dead || !s.def.hp) return;
  s.hp -= dmg * (1 - FORT_RED[s.fort]);
  if (s.hp <= 0) { destroyStruct(s, true); return; }
  s.bar.root.visible = true; s.bar.set(s.hp / s.maxHp);
  if (selected === s) refreshPanel();
}
function destroyStruct(s, byEnemy) {
  if (s.mobile) return removeUnit(s, byEnemy);
  if (s.dead) return;
  s.dead = true; world.remove(s.group); structs.delete(s.i);
  if (byEnemy) {
    boom(s.x, tileTop(s.i) + .3, s.z, .8);
    toast(L(`${s.def.name} tuhoutui!`, `${s.def.nameEn} destroyed!`), 'warn');
    if (TOWERS.has(s.kind)) {
      const r = new THREE.Group(); r.position.set(s.x, tileTop(s.i), s.z);
      for (let k = 0; k < 4; k++) { const b = mesh(new THREE.BoxGeometry(.18, .08, .14), MAT.rubble, (Math.random() - .5) * .5, .04, (Math.random() - .5) * .5); b.rotation.y = Math.random() * 3; r.add(b); }
      world.add(r); rubble.set(s.i, r);
    }
  }
  if (selected === s) select(null);
  if (!NONBLOCK.has(s.kind)) recomputeFields();
}

// ================= OMAT AJONEUVOT (Leopard, AMV) =================
function unitPassable(i) {
  if (i < 0 || ix(i) >= BORDER) return false;
  const st = structs.get(i); if (st && TOWERS.has(st.kind)) return false;
  return COST.veh[winter ? 1 : 0][terr[i]] < INF;
}
function spawnUnit(kind, i, free) {
  const def = DEFS[kind];
  const u = { kind, def, mobile: true, i, x: ix(i) + .5, z: iz(i) + .5, lvl: 1, fort: 0, cd: 0, dead: false, path: [], rot: 0, spent: def.cost, hp: def.hp, maxHp: def.hp };
  u.group = makeStructMesh(kind); u.group.position.set(u.x, tileTop(i), u.z); world.add(u.group);
  u.bar = makeBar(.6, BAR_T); u.bar.root.position.y = .75; u.bar.root.visible = false; u.group.add(u.bar.root);
  units.push(u);
  if (!free) { money -= def.cost; sfx('build'); }
  return u;
}
function hurtUnit(u, dmg) {
  if (u.dead) return;
  u.hp -= dmg * (1 - (u.def.armor || 0));
  if (u.hp <= 0) { removeUnit(u, true); return; }
  u.bar.root.visible = true; u.bar.set(u.hp / u.maxHp);
  if (selected === u) refreshPanel();
}
function removeUnit(u, byEnemy) {
  if (u.dead) return;
  u.dead = true; world.remove(u.group);
  units = units.filter(x => x !== u);
  if (byEnemy) { boom(u.x, tileTop(u.i) + .3, u.z, .9); toast(L(`${u.def.name} tuhoutui!`, `${u.def.nameEn} destroyed!`), 'warn'); }
  if (selected === u) select(null);
}
function unitPath(from, to) {
  if (!unitPassable(to)) return null;
  const dist = new Float64Array(N).fill(INF), prev = new Int32Array(N).fill(-1);
  const open = [from]; dist[from] = 0;
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k;
    const c = open.splice(bi, 1)[0]; if (c === to) break;
    const x = ix(c), z = iz(c);
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const j = idx(nx, nz); if (!unitPassable(j)) continue;
      const diag = dx && dz; if (diag && (!unitPassable(idx(x + dx, z)) || !unitPassable(idx(x, z + dz)))) continue;
      const nd = dist[c] + COST.veh[winter ? 1 : 0][terr[j]] * (diag ? 1.414 : 1);
      if (nd < dist[j]) { if (dist[j] >= INF) open.push(j); dist[j] = nd; prev[j] = c; }
    }
  }
  if (dist[to] >= INF) return null;
  const path = []; for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  return path;
}
const moveMarker = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
moveMarker.visible = false; scene.add(moveMarker);
function orderMove(u, i) {
  const p = unitPath(u.i, i);
  if (!p) { toast(L('Ajoneuvo ei pääse sinne.', 'The vehicle cannot get there.'), 'warn', 1800); sfx('deny'); return; }
  u.path = p; sfx('ui');
  moveMarker.visible = true; moveMarker.position.set(ix(i) + .5, tileTop(i) + .06, iz(i) + .5); moveMarker.userData.t = 1.5;
}
function updateUnits(dt) {
  for (const u of units) {
    if (u.dead) continue;
    if (u.path.length) {
      const n = u.path[0];
      if (!unitPassable(n)) { u.path = []; }
      else {
        const tx = ix(n) + .5, tz = iz(n) + .5, dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
        const st = u.def.speed / Math.min(COST.veh[winter ? 1 : 0][terr[u.i]], 4) * dt;
        if (d <= st) { u.x = tx; u.z = tz; u.i = n; u.path.shift(); clearTile(n); }
        else { u.x += dx / d * st; u.z += dz / d * st; u.rot = lerpAngle(u.rot, -Math.atan2(dz, dx), dt * 6); }
      }
    }
    u.group.position.set(u.x, tileTop(u.i), u.z);
    u.group.rotation.y = u.rot;
    if (selected === u && !u.path.length) showRange(u.x, u.z, tileTop(u.i), towerRange(u.def, 1, u.i));
  }
  if (moveMarker.visible) { moveMarker.userData.t -= dt; moveMarker.material.opacity = Math.max(0, moveMarker.userData.t / 1.5); if (moveMarker.userData.t <= 0) moveMarker.visible = false; }
}

// ================= VIHOLLISET =================
function spawnEnemy(type, atTile) {
  const d = EDEF[type];
  const e = {
    type, d, cls: d.cls, armor: d.armor, hp: d.hp * hpMult, maxHp: d.hp * hpMult,
    speed: d.speed * (.92 + Math.random() * .16), dead: false, atkCd: Math.random() * 1.5, hover: 0,
    ox: (Math.random() - .5) * .3, oz: (Math.random() - .5) * .3, rot: Math.PI, tgt: null,
  };
  if (e.cls === 'air') {
    e.x = W + .5; e.z = 1 + Math.random() * (H - 2); e.y = d.heli ? 1.5 : 1.8; e.ox = e.oz = 0;
  } else if (atTile !== undefined) {
    e.cur = atTile; e.next = null; e.x = ix(atTile) + .5; e.z = iz(atTile) + .5; e.y = tileTop(atTile);
    if (d.static) { e.ox = e.oz = 0; e.rot = 0; }
  } else {
    const f = fields[e.cls];
    let list = spawns[e.cls].filter(i => f.dist[i] < INF); if (!list.length) list = spawns[e.cls];
    if (!list.length) return;
    const s = list[(Math.random() * list.length) | 0];
    e.cur = s; e.next = s; e.x = W + .3; e.z = iz(s) + .5; e.y = tileTop(s);
  }
  e.mesh = proto[type].clone(); e.turret = e.mesh.getObjectByName('t');
  e.bar = makeBar(type === 'tank' || d.static ? .6 : .45, BAR_E); e.bar.root.position.y = type === 'drone' ? .3 : .6; e.bar.root.visible = !!d.static;
  if (d.static) {
    e.bar.set(1);
    e.mark = new THREE.Mesh(new THREE.RingGeometry(.75, .85, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
    e.mark.position.y = .1; e.mark.visible = false; e.mesh.add(e.mark);
  }
  e.rotor = e.mesh.getObjectByName('r'); e.ring = e.mesh.getObjectByName('ring');
  if (d.heli) sfx('heli');
  e.mesh.add(e.bar.root);
  world.add(e.mesh); enemies.push(e);
}
function hurt(e, dmg, mult) {
  if (e.dead) return; const m = mult[e.armor]; if (!m) return;
  e.hp -= dmg * m;
  if (e.hp <= 0) {
    kill(e); money += e.d.reward; boom(e.x, e.y + .2, e.z, e.type === 'tank' || e.d.static || e.d.heli ? .8 : .4);
    if (e.d.static) toast(L('Vihollisen tykistöpatteri tuhottu – tykistötuli lakkaa!', 'Enemy artillery battery destroyed – barrages stop!'), 'ok');
  }
  else { e.bar.root.visible = true; e.bar.set(e.hp / e.maxHp); }
}
function kill(e) { e.dead = true; world.remove(e.mesh); if (e.hp <= 0) addWreck(e); }
function leak(e) {
  kill(e); lives = Math.max(0, lives - e.d.leak); sfx('leak');
  const fl = $('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
  if (lives <= 0) endGame(false);
}
function nearestTower(x, z, range) {
  let best = null, bd = range;
  for (const s of structs.values()) {
    if (s.dead || !TOWERS.has(s.kind)) continue;
    const d = Math.hypot(s.x - x, s.z - z); if (d <= bd) { bd = d; best = s; }
  }
  for (const u of units) {
    if (u.dead) continue;
    const d = Math.hypot(u.x - x, u.z - z); if (d <= bd) { bd = d; best = u; }
  }
  return best;
}
function updateEnemy(e, dt) {
  const d = e.d;
  if (d.static) { e.mesh.visible = e.vis !== false; e.mesh.position.set(e.x, e.y, e.z); if (e.mark) e.mark.visible = !!e.located; return; }
  if (d.heli) {
    if (e.rotor) e.rotor.rotation.y += dt * 25;
    const tg = nearestTower(e.x, e.z, d.atk.range);
    if (tg) {
      e.rot = lerpAngle(e.rot, -Math.atan2(tg.z - e.z, tg.x - e.x), dt * 4);
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = d.atk.interval;
        const to = V(tg.x, tileTop(tg.i) + .3, tg.z);
        tracer(V(e.x, e.y, e.z), to, 0xffb36b, .15); boom(to.x, to.y, to.z, .35); sfx('enemyFire');
        hurtStruct(tg, d.atk.dmg * dmgMult);
      }
    } else {
      const tz = e.hz ?? (e.hz = 1 + Math.random() * (H - 2));
      const dx = -1 - e.x, dz = tz - e.z, dist = Math.hypot(dx, dz);
      e.x += dx / dist * e.speed * dt; e.z += dz / dist * e.speed * dt;
      e.rot = lerpAngle(e.rot, -Math.atan2(dz, dx), dt * 3);
      if (e.x < -.6) { leak(e); return; }
    }
    e.y = 1.5 + Math.sin(performance.now() * .002 + e.oz * 9) * .06;
    e.mesh.visible = e.vis !== false;
    e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y = e.rot; e.mesh.rotation.z = tg ? 0 : .12;
    return;
  }
  if (e.ring) e.ring.material.opacity = .25 + .2 * Math.abs(Math.sin(performance.now() * .003));
  if (e.cls === 'air') {
    if (!e.tgt || e.tgt.dead) e.tgt = nearestTower(e.x, e.z, INF);
    const tx = e.tgt ? e.tgt.x : -.8, tz = e.tgt ? e.tgt.z : e.z;
    const dx = tx - e.x, dz = tz - e.z, dist = Math.hypot(dx, dz);
    const st = e.speed * dt;
    if (dist > 1e-3) { e.x += dx / dist * Math.min(st, dist); e.z += dz / dist * Math.min(st, dist); e.rot = lerpAngle(e.rot, -Math.atan2(dz, dx), dt * 6); }
    const ty = e.tgt ? tileTop(e.tgt.i) + .35 : 1.8;
    e.y += ((dist < 1.4 ? ty : 1.8) - e.y) * Math.min(1, dt * 3);
    if (dist < .25) {
      if (e.tgt) { kill(e); boom(e.x, e.y, e.z, .7); hurtStruct(e.tgt, d.kamikaze * dmgMult); }
      else leak(e);
    }
  } else {
    const f = fields[e.cls];
    if (e.next === null) {
      if (ix(e.cur) === 0) e.next = -1;
      else { const n = bestNext(f, e.cur); e.next = n < 0 ? -1 : n; }
    }
    const tx = e.next === -1 ? -.7 : ix(e.next) + .5, tz = e.next === -1 ? e.z : iz(e.next) + .5;
    const dx = tx - e.x, dz = tz - e.z, dist = Math.hypot(dx, dz);
    const c = Math.min(f.cost[e.cur] < INF ? f.cost[e.cur] : 3, 5);
    let st = e.speed / c * dt;
    if (e.cls === 'veh' && deer.length && deerBlocking(e.x + dx / (dist || 1) * .4, e.z + dz / (dist || 1) * .4)) {
      st *= .3;
      if (!deerWarned) { deerWarned = true; toast('🦌 Porot tukkivat tien – vihollisen kolonna hidastuu!', 'info'); }
    }
    if (dist <= st) {
      e.x = tx; e.z = tz;
      if (e.next === -1) { leak(e); return; }
      if (e.next !== e.cur) { e.cur = e.next; enterTile(e); }
      e.next = null;
    } else {
      e.x += dx / dist * st; e.z += dz / dist * st;
      e.rot = lerpAngle(e.rot, -Math.atan2(dz, dx), dt * 6);
    }
    e.y = tileTop(e.cur);
    if (e.dead) return;
    e.atkCd -= dt;
    if (e.atkCd <= 0) {
      const s = nearestTower(e.x, e.z, d.atk.range);
      if (s) {
        e.atkCd = d.atk.interval;
        const from = new THREE.Vector3(e.x, e.y + .3, e.z), to = new THREE.Vector3(s.x, tileTop(s.i) + .3, s.z);
        tracer(from, to, e.type === 'tank' ? 0xffb36b : 0xffe2b8, e.type === 'tank' ? .12 : .06);
        if (e.type === 'tank') boom(to.x, to.y, to.z, .35);
        sfx(e.type === 'tank' ? 'tankFire' : 'enemyFire');
        if (e.turret) e.turret.rotation.y = -Math.atan2(s.z - e.z, s.x - e.x) - e.rot;
        hurtStruct(s, d.atk.dmg * dmgMult);
      } else e.atkCd = .3;
    }
  }
  e.mesh.visible = e.vis !== false;
  e.mesh.position.set(e.x + e.ox, e.y + (e.type === 'inf' ? Math.abs(Math.sin(performance.now() * .012 + e.ox * 40)) * .02 : 0), e.z + e.oz);
  e.mesh.rotation.y = e.rot;
}
function enterTile(e) {
  const s = structs.get(e.cur);
  if (s && s.kind === 'apmine' && e.cls === 'inf') {
    boom(e.x, e.y + .1, e.z, .6);
    hurt(e, DEFS.apmine.dmg, [1, .1, 0, 0, 0]);
    for (const o of enemies) if (o !== e && !o.dead && o.cls === 'inf' && Math.hypot(o.x - e.x, o.z - e.z) < .7) hurt(o, DEFS.apmine.dmg * .5, [1, 0, 0, 0, 0]);
    s.charges--;
    if (s.charges <= 0) destroyStruct(s, false); else if (selected === s) refreshPanel();
  }
  if (s && s.kind === 'mine' && e.cls === 'veh') {
    boom(e.x, e.y + .1, e.z, .9);
    hurt(e, DEFS.mine.dmg, [0, 1, 1, 0, 0]);
    s.charges--;
    if (s.charges <= 0) destroyStruct(s, false); else if (selected === s) refreshPanel();
  }
}

// ================= TORNIT =================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function updateTowers(dt) {
  const ews = enemies.filter(e => !e.dead && e.d.ew);
  for (const s of [...structs.values(), ...units]) {
    if (!TOWERS.has(s.kind) && !s.mobile) continue;
    if (s.dead) continue;
    const d = s.def, Lv = s.lvl;
    const jam = ews.some(e => Math.hypot(e.x - s.x, e.z - s.z) < 4);
    const range = towerRange(d, Lv, s.i) * (jam ? .85 : 1), dmg = d.dmg * (1 + .45 * (Lv - 1)), interval = d.interval * (1 - .1 * (Lv - 1)) * (jam ? 1.7 : 1);
    if (s.group.userData.radar) s.group.userData.radar.rotation.y += dt * 2.5;
    s.cd -= dt;
    let tgt = null, tp = INF;
    for (const e of enemies) {
      if (e.dead) continue; const air = e.cls === 'air';
      if (air && !d.air) continue; if (!air && !d.ground) continue; if (!d.mult[e.armor]) continue; if (!e.vis) continue;
      const dist = Math.hypot(e.x - s.x, e.z - s.z);
      if (dist > range || (d.minRange && dist < d.minRange)) continue;
      const p = e.d.static ? 50 : air ? e.x * 1.2 : fields[e.cls].dist[e.cur];
      if (p < tp) { tp = p; tgt = e; }
    }
    if (!tgt) continue;
    const t = s.group.userData.turret;
    t.rotation.y = lerpAngle(t.rotation.y, -Math.atan2(tgt.z - s.z, tgt.x - s.x), dt * 12);
    if (s.cd > 0) continue;
    s.cd = interval;
    const top = tileTop(s.i), muzzle = V(s.x, top + .38, s.z);
    const tpos = V(tgt.x + tgt.ox, tgt.y + (tgt.cls === 'air' ? 0 : .15), tgt.z + tgt.oz);
    if (s.mobile) t.rotation.y = lerpAngle(t.rotation.y, -Math.atan2(tgt.z - s.z, tgt.x - s.x) - s.rot, 1);
    if (s.kind === 'mg' || s.kind === 'aa' || s.kind === 'amv') {
      tracer(muzzle, tpos, s.kind === 'aa' ? 0xbfe6ff : 0xfff1a8);
      hurt(tgt, dmg, d.mult); sfx(s.kind);
    } else if (s.kind === 'leo') {
      tracer(muzzle, tpos, 0xffd28a, .1); boom(tpos.x, tpos.y, tpos.z, .45, 0xffc060); boom(muzzle.x, muzzle.y, muzzle.z, .2, 0xfff1a8);
      hurt(tgt, dmg, d.mult); sfx('tankgun');
    } else if (s.kind === 'mortar' || s.kind === 'k9') {
      const m = mesh(new THREE.SphereGeometry(.06, 5, 4), MAT.dark, muzzle.x, muzzle.y, muzzle.z, false); world.add(m);
      const dist = Math.hypot(tpos.x - s.x, tpos.z - s.z);
      projectiles.push({ kind: 'shell', mesh: m, from: muzzle, to: V(tgt.x, tgt.y, tgt.z), t: 0, T: 1 + dist * .08, h: 1.5 + dist * .15, dmg, splash: d.splash, mult: d.mult });
      boom(muzzle.x, muzzle.y + .1, muzzle.z, .2, 0xfff1a8); sfx(s.kind === 'k9' ? 'k9' : 'mortar');
    } else if (s.kind === 'atgm' || s.kind === 'nasams') {
      const m = mesh(new THREE.CylinderGeometry(.025, .025, .18, 5).rotateZ(Math.PI / 2), MAT.white, muzzle.x, muzzle.y, muzzle.z, false); world.add(m);
      projectiles.push({ kind: 'missile', mesh: m, pos: muzzle.clone(), target: tgt, last: tpos, dmg, mult: d.mult, puffT: 0, speed: s.kind === 'nasams' ? 10 : 7 });
      sfx(s.kind === 'nasams' ? 'nasams' : 'missile');
    }
  }
}
function updateProjectiles(dt) {
  for (const p of projectiles) {
    if (p.kind === 'shell') {
      p.t += dt; const k = Math.min(1, p.t / p.T);
      p.mesh.position.lerpVectors(p.from, p.to, k); p.mesh.position.y += Math.sin(Math.PI * k) * p.h;
      if (k >= 1) {
        p.done = true; boom(p.to.x, p.to.y + .1, p.to.z, p.splash * .8);
        if (iceyeT > 0) p.dmg *= 1.25;
        for (const e of enemies) {
          if (e.dead || e.cls === 'air') continue;
          const dd = Math.hypot(e.x - p.to.x, e.z - p.to.z);
          if (dd < p.splash) hurt(e, p.dmg * (1 - dd / p.splash * .5), p.mult);
        }
      }
    } else {
      if (!p.target.dead) p.last.set(p.target.x + p.target.ox, p.target.y + .15, p.target.z + p.target.oz);
      const dir = p.last.clone().sub(p.pos); const dist = dir.length(); const st = (p.speed || 7) * dt;
      p.pos.addScaledVector(dir.normalize(), Math.min(st, dist));
      p.mesh.position.copy(p.pos); p.mesh.rotation.y = -Math.atan2(dir.z, dir.x);
      p.puffT -= dt; if (p.puffT <= 0) { puff(p.pos); p.puffT = .04; }
      if (dist <= st + .05) {
        p.done = true; boom(p.last.x, p.last.y, p.last.z, .5);
        if (!p.target.dead) hurt(p.target, p.dmg, p.mult);
      }
    }
    if (p.done) { world.remove(p.mesh); p.mesh.geometry.dispose(); }
  }
  projectiles = projectiles.filter(p => !p.done);
}

// ================= TYKISTÖ =================
const barrageGeo = new THREE.RingGeometry(1.0, 1.15, 32).rotateX(-Math.PI / 2);
function triggerBarrage() {
  if (!enemies.some(e => !e.dead && e.d.static)) return;
  const towers = [...structs.values()].filter(s => TOWERS.has(s.kind));
  if (!towers.length) return;
  const s = towers[(Math.random() * towers.length) | 0];
  const x = s.x + (Math.random() - .5) * 1.2, z = s.z + (Math.random() - .5) * 1.2;
  const r = new THREE.Mesh(barrageGeo, new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
  r.position.set(x, tileTop(s.i) + .08, z); r.scale.setScalar(1.3); world.add(r);
  barrages.push({ x, z, t: 2.2, ring: r }); sfx('whistle');
  if (cond === 'clear') for (const e of enemies) if (e.d.static && !e.dead && !e.located) { e.located = true; toast(L('Vastatykistötutka paikansi vihollisen patterin!', 'Counter-battery radar located the enemy battery!'), 'ok', 3000); }
  if (!barrageWarned) { barrageWarned = true; toast(L('Vihollisen tykistö ampuu asemiasi! Linnoita ne.', 'Enemy artillery is shelling your positions! Fortify them.'), 'warn'); }
}
function updateBarrages(dt) {
  for (const b of barrages) {
    b.t -= dt; b.ring.material.opacity = .4 + .4 * Math.abs(Math.sin(b.t * 8));
    if (b.t <= 0) {
      world.remove(b.ring); b.ring.material.dispose();
      for (let k = 0; k < 3; k++) boom(b.x + (Math.random() - .5), .5, b.z + (Math.random() - .5), .9, 0xff9a40);
      for (const s of [...structs.values()]) if (TOWERS.has(s.kind) && Math.hypot(s.x - b.x, s.z - b.z) < 1.3) hurtStruct(s, 60 * (1 + .1 * wave));
    }
  }
  barrages = barrages.filter(b => b.t > 0);
}

// ================= AALLOT JA VUODENAJAT =================
const seasonOf = n => cfg.winter.includes(n);
function waveComp(n) {
  const m = cfg.mix;
  return {
    inf: Math.round((4 + n * 2) * m.inf),
    bmp: n >= 3 ? Math.round((n - 1) * .8 * m.bmp) : 0,
    tank: n >= 5 ? Math.round((n - 4) * .7 * m.tank) : 0,
    drone: n >= 4 ? Math.round((n - 2) * .7 * m.drone) : 0,
    heli: n >= 6 ? Math.round((n - 5) * .5 * (m.heli || 1)) : 0,
    ew: n >= 7 ? Math.max(0, Math.floor((n - 4) / 3)) : 0,
  };
}
let autoT = -1, autoShown = -1;
const AUTO_SEC = 10;
function startWave() {
  if (phase !== 'build' || gameOver) return;
  autoT = -1; showCountdown();
  wave++; phase = 'wave'; waveTime = 0; spawnTimer = 0; specDone = wave < 5; specTile = -1; specMark.visible = false;
  hpMult = (1 + .12 * (wave - 1)) * (1 + (progress.week - 1) * .04); dmgMult = 1 + .06 * (wave - 1);
  const c = waveComp(wave), items = [];
  const W8 = { inf: 0, bmp: .35, tank: .6, drone: Math.random(), heli: .5, ew: .45 };
  for (const [t, n] of Object.entries(c)) for (let k = 0; k < n; k++) items.push({ t, key: Math.random() + (t === 'drone' ? Math.random() : W8[t]) });
  items.sort((a, b) => a.key - b.key); queue = items.map(i => i.t);
  if (!spawns.veh.length) queue = queue.filter(t => EDEF[t].cls !== 'veh');
  barrageTimes = [];
  if (wave >= 6) for (let k = 0; k < Math.floor((wave - 4) / 2); k++) barrageTimes.push(3 + Math.random() * 20);
  barrageTimes.sort((a, b) => a - b);
  if (barrageTimes.length) {
    // vihollisen tykistöpatteri Venäjän puolella
    const opts = []; for (let z = 1; z < H - 1; z++) for (let x = BORDER + 2; x < W - 1; x++) { const i = idx(x, z); if (terr[i] !== LAKE && terr[i] !== SEA && terr[i] !== ROAD) opts.push(i); }
    if (opts.length) {
      const bi = opts[(Math.random() * opts.length) | 0]; spawnEnemy('battery', bi);
      toast(L('Vihollisen tykistöpatteri rajan takana! Paikanna se ICEYElla – tai vastatykistötutka paikantaa sen ensimmäisestä tulituksesta, jos sää on selkeä.', 'Enemy artillery battery across the border! Locate it with ICEYE – or counter-battery radar finds it after its first salvo in clear weather.'), 'warn', 5500);
    }
  }
  if (!specDone) specTile = pickSpecTile();
  setCondition(cond = nextCond);
  if (cond !== 'clear') toast(`${COND[cond].icon} ${L(COND[cond].name, COND[cond].en)}: ${L(COND[cond].desc, COND[cond].descEn)}`, 'info', 3500);
  sfx('wave');
  preview.visible = false;
  select(null);
  updateHUD(true);
}
function endWave() {
  phase = 'build'; iceyeT = 0; specMark.visible = false;
  for (const e of enemies) if (e.d.static && !e.dead) kill(e);
  setCondition('clear');
  nextCond = pickCond(wave + 1);
  const bonus = 120 + 25 * wave; money += bonus;
  progress.best[cfg.id] = Math.max(progress.best[cfg.id] || 0, wave); saveProgress();
  toast(L(`Aalto ${wave} torjuttu! +${bonus} €`, `Wave ${wave} repelled! +${bonus} €`), 'ok');
  if (wave === battleWaves && !endless) { endGame(true); }
  const w = seasonOf(wave + 1);
  if (w !== winter) setWinter(w, true);
  if (nextCond === 'storm' && !seasonOf(wave + 1)) nextCond = 'fog';
  preview.visible = true; updateHUD(true);
  saveBattle();
  if (!gameOver) autoT = AUTO_SEC;
}
function setWinter(w, announce) {
  winter = w;
  const tb = tiles.instanceColor ? Float32Array.from(tiles.instanceColor.array) : null;
  const trb = trees && trees.instanceColor ? Float32Array.from(trees.instanceColor.array) : null;
  const mats = [MAT.flatRoof, MAT.roof, MAT.street].concat(townGround ? [townGround.material] : []);
  const mb = mats.map(m => m.color.clone());
  refreshAllTiles(); colorTrees();
  for (const s of structs.values()) s.group.position.y = tileTop(s.i);
  for (const [ri, r] of rubble) r.position.y = tileTop(ri);
  applyTownWinter();
  colorOuter(!!announce);
  if (announce) {
    if (tb) fadeAttr(tiles.instanceColor, tb);
    if (trb) fadeAttr(trees.instanceColor, trb);
    mats.forEach((m, k) => fadeMat(m, mb[k]));
  }
  setCondition(phase === 'wave' ? cond : 'clear');
  recomputeFields();
  if (announce) toast(w ? L('❄️ Talvi saapui – järvet ja suot jäätyivät. Panssarit pääsevät jäitä pitkin!', '❄️ Winter has come – lakes and swamps froze. Tanks can now cross the ice!') : L('☀️ Sulan maan aika – jäät sulivat, järvet ja suot ovat taas esteitä.', '☀️ The thaw – the ice melted, lakes and swamps are obstacles again.'), 'info', 5000);
}
function endGame(win) {
  gameOver = true; autoT = -1; showCountdown(); const o = $('overlay'); o.hidden = false;
  const first = !battleResolved;
  if (first) sfx(win ? 'victory' : 'defeat');
  resolveBattle(cfg.id, win);
  const rep = first ? `<ul class="report">${progress.report.map(r => `<li>${rt(r)}</li>`).join('')}</ul>` : '';
  o.querySelector('.box').innerHTML = win
    ? L(`<h2>🇫🇮 ${cfg.name} pitää!</h2><p>Torjuit kaikki ${battleWaves} aaltoa. ${cfg.city} on turvassa. Puolustuskykyä jäljellä ${lives}/20.</p><h3>Tilannekatsaus</h3>`, `<h2>🇫🇮 ${cfg.nameEn} holds!</h2><p>You repelled all ${battleWaves} waves. ${cfg.city} is safe. Defence ${lives}/20 left.</p><h3>Situation report</h3>`) + `${rep}<div class="row2"><button class="primary" id="mapBtn2">🗺 ${L('Takaisin kartalle', 'Back to map')}</button>${first ? `<button id="contBtn">${L('Jatka loputtomasti', 'Continue endlessly')}</button>` : ''}</div>`
    : L(`<h2>Puolustus murtui</h2><p>Kestit ${Math.max(0, wave - 1)} aaltoa. Vihollinen pääsi ${cfg.cityIn}.</p><h3>Tilannekatsaus</h3>`, `<h2>Defence broken</h2><p>You held ${Math.max(0, wave - 1)} waves. The enemy reached ${cfg.city}.</p><h3>Situation report</h3>`) + `${rep}<div class="row2"><button class="primary" id="mapBtn2">🗺 ${L('Takaisin kartalle', 'Back to map')}</button></div>`;
  $('mapBtn2').onclick = () => { o.hidden = true; showMap(); };
  if (win && first) $('contBtn').onclick = () => { endless = true; gameOver = false; o.hidden = true; };
}

// ================= REITTIESIKATSELU =================
let preview = new THREE.Group();
const prevMat = {
  veh: new THREE.LineDashedMaterial({ color: 0xff9a3c, dashSize: .35, gapSize: .15, transparent: true, opacity: .9 }),
  inf: new THREE.LineDashedMaterial({ color: 0x8fd8ff, dashSize: .1, gapSize: .12, transparent: true, opacity: .9 }),
};
function updatePreview() {
  for (const c of [...preview.children]) { preview.remove(c); c.geometry.dispose(); }
  for (const cls of ['veh', 'inf']) {
    const f = fields[cls]; if (!f) continue;
    const starts = cls === 'veh' ? spawns.veh : spawns.inf.filter((s, k) => k % 2 === 0 && terr[s] !== ROAD);
    const off = cls === 'veh' ? 0 : .12;
    for (const s of starts) {
      if (f.dist[s] >= INF) continue;
      const pts = [V(W, tileTop(s) + .07 + off, iz(s) + .5 + off)]; let c = s, guard = 0;
      while (guard++ < 300) {
        pts.push(V(ix(c) + .5 + off, tileTop(c) + .07 + off, iz(c) + .5 + off));
        if (ix(c) === 0) break;
        const n = bestNext(f, c); if (n < 0) break; c = n;
      }
      pts.push(V(-.6, .35, iz(c) + .5 + off));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), prevMat[cls]);
      l.computeLineDistances(); preview.add(l);
    }
  }
}

// ================= SEKTORIN LATAUS =================
function loadSector(id, snap) {
  cfg = SECTORS.find(s => s.id === id) || SECTORS[0];
  battleWaves = snap ? snap.waves : wavesFor(cfg, threatOf(cfg.id)); battleResolved = false;
  units = []; cleared = new Set(); moveMarker.visible = false;
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  structs.clear(); rubble.clear();
  strikes = []; nukes = []; radZones = []; shake = 0; sats = []; iceyeT = 0; specTile = -1; specMark.visible = false; supportMode = null; pendingStrike = -1; strikeRing.visible = strikeDisk.visible = false;
  enemies = []; projectiles = []; effects = []; debris = []; wrecks = []; barrages = []; queue = []; barrageTimes = []; deer = []; shockwaves = [];
  money = cfg.money + 100 + (progress.upg.budget || 0) * 100; lives = 20; wave = 0; phase = 'build'; speed = 1; paused = false; gameOver = false; endless = false;
  if (!snap && progress.reserve > 0) { money += 250; progress.reserve--; }
  tool = null; selected = null; pendingTile = -1; barrageWarned = false; deerWarned = false; leaveArmed = 0;
  genSector(cfg);
  winter = seasonOf(1);
  cond = 'clear'; nextCond = 'clear';
  refreshAllTiles();
  buildTrees();
  buildTown();
  buildBorder();
  buildSurroundings();
  fades = []; setCondition('clear', true);
  preview = new THREE.Group(); world.add(preview);
  if (cfg.reindeer) spawnDeer(cfg.reindeer);
  // säilyneet asemat tai kesken jäänyt taistelu
  const keep = snap || progress.forts[cfg.id];
  if (keep) {
    for (const i of keep.cleared || []) { if (terr[i] === FOREST) clearTile(i); else cleared.add(i); }
    for (const d of keep.structs || []) {
      if (structs.has(d.i)) continue;
      const st = build(d.kind, d.i, true);
      for (let l = 2; l <= (d.lvl || 1); l++) { st.lvl = l; st.group.userData.turret.scale.setScalar(1 + .1 * (l - 1)); addLevelMark(st); }
      for (let f = 1; f <= (d.fort || 0); f++) { st.fort = f; addFortMesh(st); }
      if (st.def.hp) { st.maxHp = calcMaxHp(st); st.hp = d.hp != null ? Math.min(d.hp, st.maxHp) : st.maxHp; if (st.hp < st.maxHp) { st.bar.root.visible = true; st.bar.set(st.hp / st.maxHp); } }
      if (d.charges != null) st.charges = d.charges;
      if (d.spent) st.spent = d.spent;
      st.kept = snap ? !!d.kept : true;
    }
    for (const d of keep.units || []) { const u = spawnUnit(d.kind, d.i, true); u.kept = snap ? !!d.kept : true; if (d.hp != null) { u.hp = d.hp; if (u.hp < u.maxHp) { u.bar.root.visible = true; u.bar.set(u.hp / u.maxHp); } } }
    if (!snap && ((keep.structs || []).length || (keep.units || []).length)) setTimeout(() => toast(L('Aiemmin rakennetut asemat ovat yhä paikallaan.', 'Your earlier positions are still in place.'), 'ok', 3500), 1200);
  }
  if (snap) {
    money = snap.money; lives = snap.lives; wave = snap.wave; nextCond = snap.nextCond || 'clear';
    if (seasonOf(wave + 1) !== winter) { winter = seasonOf(wave + 1); refreshAllTiles(); colorTrees(); applyTownWinter(); for (const st of structs.values()) st.group.position.y = tileTop(st.i); }
  } else if (!progress.battle) {
    nextCond = 'clear';
  }
  recomputeFields();
  rebuildTools();
  setTool(null); select(null);
  hl.visible = ring.visible = ringIn.visible = false;
  resetCamera();
  screen = 'sector'; running = true;
  document.body.classList.remove('onmap');
  $('mapScreen').hidden = true;
  $('sectorName').textContent = L(cfg.name, cfg.nameEn);
  updateHUD(true);
  if (snap) toast(L(`Taistelu jatkuu: ${cfg.name}, aalto ${wave + 1}/${battleWaves}.`, `Battle resumes: ${cfg.nameEn || cfg.name}, wave ${wave + 1}/${battleWaves}.`), 'info', 4000);
  else toast(L(`${cfg.name}: puolusta ${cfg.cityTo} – ${battleWaves} aaltoa${battleWaves === cfg.waves ? ' (suurhyökkäys)' : ' (tunnusteluisku)'}.`, `${cfg.nameEn || cfg.name}: defend ${cfg.city} – ${battleWaves} waves${battleWaves === cfg.waves ? ' (major offensive)' : ' (probing attack)'}.`), 'info', 4000);
  saveBattle();
  maybeStartTutorial();
  autoT = AUTO_SEC;
}
// --- kesken jääneen taistelun tallennus (rakennusvaiheessa)
function saveBattle() {
  if (screen !== 'sector' || gameOver || battleResolved || phase !== 'build') return;
  progress.battle = {
    id: cfg.id, waves: battleWaves, wave, money, lives, nextCond,
    cleared: [...cleared],
    structs: [...structs.values()].map(x => ({ kind: x.kind, i: x.i, lvl: x.lvl, fort: x.fort, charges: x.charges, hp: x.hp, spent: x.spent, kept: !!x.kept })),
    units: units.filter(u => !u.dead).map(u => ({ kind: u.kind, i: u.i, hp: u.hp, kept: !!u.kept })),
  };
  saveProgress();
}

// ================= STRATEGINEN KARTTA =================
const KMAP = 58;
const proj = (lon, lat) => [(lon - 20) * .47 * KMAP + 12, (70.25 - lat) * KMAP + 10];
const pstr = pts => pts.map(([lo, la]) => proj(lo, la).map(v => v.toFixed(1)).join(',')).join(' ');
function clipBorder(lat0, lat1) {
  const out = [];
  for (let k = 0; k < BORDER_LINE.length - 1; k++) {
    const a = BORDER_LINE[k], b = BORDER_LINE[k + 1];
    const inA = a[1] >= lat0 && a[1] <= lat1;
    if (inA) out.push(a);
    for (const L of [lat0, lat1]) {
      if ((a[1] - L) * (b[1] - L) < 0) { const t = (L - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, L]); }
    }
  }
  const last = BORDER_LINE[BORDER_LINE.length - 1]; if (last[1] >= lat0 && last[1] <= lat1) out.push(last);
  return out;
}
let mapSel = SECTORS[0].id, resetArmed = 0, mapTapId = null;
function mostUrgent() { return [...SECTORS].sort((a, b) => threatOf(b.id) - threatOf(a.id))[0].id; }
function buildMap() {
  const svg = $('mapSvg');
  const rus = [...BORDER_LINE, [33.5, BORDER_LINE[BORDER_LINE.length - 1][1]], [33.5, 59.8], [BORDER_LINE[0][0], 59.8]];
  let h = `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" stroke-opacity=".06" stroke-width="3"/></pattern>
    <marker id="arrR" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e5383b"/></marker>
    <marker id="arrY" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ffc531"/></marker></defs>`;
  h += `<polygon points="${pstr(rus)}" fill="#2a3036"/><polygon points="${pstr(rus)}" fill="url(#hatch)"/>`;
  h += `<polygon points="${pstr(FIN_OUTLINE)}" fill="#46613f" stroke="#dfe7ea" stroke-width="1.5" stroke-linejoin="round"/>`;
  const [rx, ry] = proj(32.4, 65.6);
  h += `<text x="${rx}" y="${ry}" class="mlabel big" text-anchor="middle">${L('VENÄJÄ', 'RUSSIA')}</text>`;
  const [fx, fy] = proj(25.6, 63.4);
  h += `<text x="${fx}" y="${fy}" class="mlabel big" text-anchor="middle" fill-opacity=".5">${L('SUOMI', 'FINLAND')}</text>`;
  for (const c of CITIES) {
    const [x, y] = proj(c.lon, c.lat);
    h += c.capital ? `<text x="${x}" y="${y + 4}" text-anchor="middle" class="star">★</text>` : `<circle cx="${x}" cy="${y}" r="3" fill="#f2f5f7"/>`;
    h += `<text x="${x - 6}" y="${y + 4}" class="mlabel" text-anchor="end">${c.name}</text>`;
  }
  for (const s of SECTORS) {
    const pts = clipBorder(s.lat[0], s.lat[1]);
    const lv = levelOf(threatOf(s.id)), LV = LEVEL[lv], sel = s.id === mapSel;
    if (lv !== 'calm') {
      const [ax, ay] = proj(...s.crossing), [bx, by] = proj(...s.target);
      const mx = ax + (bx - ax) * .8, my = ay + (by - ay) * .8;
      h += `<line x1="${ax + 6}" y1="${ay}" x2="${mx}" y2="${my}" stroke="${LV.col}" stroke-width="${lv === 'red' ? 3.5 : 2.2}" stroke-dasharray="${lv === 'red' ? '7 4' : '4 5'}" marker-end="url(#${lv === 'red' ? 'arrR' : 'arrY'})" class="${lv === 'red' ? 'pulse' : ''}"/>`;
    }
    if (sel) h += `<polyline points="${pstr(pts)}" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>`;
    h += `<polyline points="${pstr(pts)}" fill="none" stroke="${LV.col}" stroke-width="${sel ? 9 : 7}" stroke-linecap="round" stroke-linejoin="round" class="${lv === 'red' ? 'pulse' : ''}"/>`;
    h += `<polyline points="${pstr(pts)}" fill="none" stroke="transparent" stroke-width="34" class="hit" data-id="${s.id}"/>`;
    const [mx, my] = proj(...s.crossing);
    h += `<g class="hit" data-id="${s.id}"><circle cx="${mx + 16}" cy="${my}" r="${sel ? 13 : 11}" fill="${LV.col}" stroke="${sel ? '#fff' : '#0d141b'}" stroke-width="2"/>`;
    h += `<text x="${mx + 16}" y="${my + 4.5}" text-anchor="middle" class="num">${LV.badge || s.no}</text>`;
    h += `<text x="${mx + 32}" y="${my + 4}" class="mlabel sec">${s.short}</text>`;
    if (progress.upg.iceye && progress.forecast && !progress.over) {
      const nxt = Math.min(100, threatOf(s.id) + (progress.forecast[s.id] || 0)), up = levelOf(nxt) !== levelOf(threatOf(s.id));
      h += `<text x="${mx + 32 + s.short.length * 7.6 + 6}" y="${my + 4}" class="mlabel fc ${up ? 'up' : ''}">▲${progress.forecast[s.id]}</text>`;
    }
    h += `</g>`;
  }
  svg.innerHTML = h;
  svg.querySelectorAll('.hit').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.id, isMarker = el.tagName.toLowerCase() === 'g';
    // toinen napautus jo valitun uhatun sektorin palloon -> suoraan taisteluun
    if (isMarker && id === mapSel && mapTapId === id && !progress.over && levelOf(threatOf(id)) !== 'calm' && (!progress.battle || progress.battle.id === id)) { mapTapId = null; goSector(id); return; }
    mapTapId = isMarker ? id : null;
    mapSel = id; buildMap(); renderBrief();
  }));
}
function seasonRange(arr, n) {
  const w = arr.filter(x => x <= n);
  if (!w.length) return L('ei talvea', 'no winter');
  return L(`aallot ${w[0]}–${w[w.length - 1]}`, `waves ${w[0]}–${w[w.length - 1]}`);
}
function renderBrief() {
  const p = progress;
  if (p.over) {
    $('brief').innerHTML = `<div class="prog"><b class="brand">SALPA</b> · ${L('Kampanja päättyi', 'Campaign over')}</div>
      <h2>${p.over === 'won' ? L('🇫🇮 Itäraja piti!', '🇫🇮 The eastern border held!') : L('Puolustus romahti', 'The defence collapsed')}</h2>
      <p>${p.over === 'won' ? L(`Kestit ${CAMPAIGN_WEEKS} viikkoa. Torjuttuja hyökkäyksiä ${p.wins}, menetettyjä taisteluita ${p.losses}.`, `You held for ${CAMPAIGN_WEEKS} weeks. Attacks repelled ${p.wins}, battles lost ${p.losses}.`) : L(`Valtakunnan puolustuskestävyys loppui viikolla ${p.week - 1}. Torjuttuja hyökkäyksiä ${p.wins}.`, `National resilience ran out in week ${p.week - 1}. Attacks repelled ${p.wins}.`)}</p>
      <ul class="report">${p.report.map(r => `<li>${rt(r)}</li>`).join('')}</ul>
      <button class="primary big" id="newCampBtn">${L('Uusi kampanja', 'New campaign')} ▶</button>`;
    $('newCampBtn').onclick = () => { progress = newCampaign(); saveProgress(); mapSel = mostUrgent(); buildMap(); renderBrief(); };
    return;
  }
  const s = SECTORS.find(x => x.id === mapSel);
  const t = threatOf(s.id), lv = levelOf(t), LV = LEVEL[lv], waves = wavesFor(s, t);
  const reds = SECTORS.filter(x => levelOf(threatOf(x.id)) === 'red').length;
  const hearts = '♥'.repeat(p.resil) + '♡'.repeat(MAX_RESIL - p.resil);
  const pb = p.battle, pbS = pb && SECTORS.find(x => x.id === pb.id);
  const here = pb && pb.id === s.id;
  const startMoney = s.money + 100 + (p.upg.budget || 0) * 100 + (p.reserve > 0 ? 250 : 0);
  let goTxt, goDis = false;
  if (here) goTxt = L(`Jatka taistelua (aalto ${pb.wave + 1}/${pb.waves}) ▶`, `Resume battle (wave ${pb.wave + 1}/${pb.waves}) ▶`);
  else if (pb) { goTxt = L(`Kesken: ${pbS.name}`, `In progress: ${pbS.nameEn || pbS.name}`); goDis = true; }
  else if (lv === 'calm') { goTxt = L('Ei hyökkäystä – valitse uhattu sektori', 'No attack – pick a threatened sector'); goDis = true; }
  else goTxt = L('Puolusta sektoria ▶', 'Defend sector ▶');
  $('brief').innerHTML = `
    <div class="prog"><b class="brand">SALPA</b> · ${L('Viikko', 'Week')} <b>${p.week}/${CAMPAIGN_WEEKS}</b> · ${L('Kestävyys', 'Resilience')} <span class="hearts">${hearts}</span>
      <button class="ico-btn" id="setBtn2" title="${L('Asetukset', 'Settings')}">${ICONS.gear}</button></div>
    <div class="campbar">
      <button id="shopBtn">🛒 ${L('Hankinnat', 'Procurement')} <b>${p.funds} M€</b></button>
      <button id="mobBtn" ${p.mobilizeCd > 0 || pb ? 'disabled' : ''} title="${L('Kutsu reservi: kuluttaa viikon, seuraavat 2 taistelua +250 €', 'Mobilise reserves: takes a week, next 2 battles +250 €')}">📣 ${p.mobilizeCd > 0 ? L(`Reservi (${p.mobilizeCd} vk)`, `Reserves (${p.mobilizeCd} wk)`) : L('Kutsu reservi', 'Mobilise')}</button>
    </div>
    ${p.reserve > 0 ? `<div class="okline">📣 ${L(`Reservi käytössä: vielä ${p.reserve} taistelua +250 €`, `Reserves active: ${p.reserve} more battles +250 €`)}</div>` : ''}
    ${pb ? `<div class="resume">⏸ ${L(`Kesken jäänyt taistelu: <b>${pbS.name}</b>, aalto ${pb.wave + 1}/${pb.waves}`, `Unfinished battle: <b>${pbS.nameEn || pbS.name}</b>, wave ${pb.wave + 1}/${pb.waves}`)}
      <div class="row2"><button class="primary" id="resumeBtn">${L('Jatka', 'Resume')} ▶</button><button id="abandonBtn">${L('Luovu (tappio)', 'Abandon (loss)')}</button></div></div>` : ''}
    ${p.report.length ? `<div class="sitrep"><b>${L('Tilannekatsaus', 'Situation report')}</b><ul class="report">${p.report.map(r => `<li>${rt(r)}</li>`).join('')}</ul></div>` : ''}
    <h2><span class="no" style="background:${LV.col}">${LV.badge || s.no}</span> ${L(s.name, s.nameEn || s.name)}</h2>
    <div class="sub">${s.area} · ${L('puolustettava', 'defend')}: <b>${s.city}</b></div>
    <div class="threat ${lv}"><div class="tl"><b>${L(LV.label, LV.labelEn)}</b><span>${L(LV.text, LV.textEn)}</span></div>
      <div class="bar"><i style="width:${t}%;background:${LV.col}"></i></div></div>
    <p>${L(s.desc, s.descEn || s.desc)}</p>
    <ul class="facts">${(settings.lang === 'en' && s.factsEn ? s.factsEn : s.facts).map(f => `<li>${f}</li>`).join('')}
      <li>❄️ ${L('Talvi', 'Winter')}: ${seasonRange(s.winter, waves)}</li>
      ${s.reindeer ? `<li>🦌 ${L('Poroja maastossa – ne hidastavat vihollisen ajoneuvoja', 'Reindeer roam here – they slow enemy vehicles')}</li>` : ''}
      ${p.upg.iceye && p.forecast ? `<li>🛰 ${L('ICEYE-ennuste: uhka', 'ICEYE forecast: threat')} +${p.forecast[s.id]} ${L('ensi viikolla', 'next week')}${levelOf(Math.min(100, t + p.forecast[s.id])) !== lv ? L(` → <b>${LEVEL[levelOf(Math.min(100, t + p.forecast[s.id]))].label}</b>`, ` → <b>${LEVEL[levelOf(Math.min(100, t + p.forecast[s.id]))].labelEn}</b>`) : ''}</li>` : ''}
      ${p.forts[s.id] && p.forts[s.id].structs.length ? `<li>🛡 ${L(`Säilyneitä asemia: ${p.forts[s.id].structs.length + p.forts[s.id].units.length}`, `Surviving positions: ${p.forts[s.id].structs.length + p.forts[s.id].units.length}`)}</li>` : ''}
    </ul>
    <div class="row"><span>${L('Taistelu', 'Battle')}</span><b>${lv === 'calm' ? '–' : `${waves} ${L('aaltoa', 'waves')}${lv === 'red' ? L(' (suurhyökkäys)', ' (major offensive)') : L(' (tunnusteluisku)', ' (probing attack)')}`}</b></div>
    <div class="row"><span>${L('Aloitusbudjetti', 'Starting budget')}</span><b>${startMoney} €</b></div>
    <div class="row"><span>${L('Torjuttu täällä', 'Repelled here')}</span><b>${p.held[s.id] || 0}×</b></div>
    <button class="primary big" id="goBtn" ${goDis ? 'disabled' : ''}>${goTxt}</button>
    ${!goDis ? `<div class="tip">${L('Vinkki: napauta kartalla sektorin palloa uudelleen, niin pääset suoraan taisteluun.', 'Tip: tap the sector marker again to go straight into battle.')}</div>` : ''}
    ${reds > 1 ? `<p class="warn">⚠ ${L(`${reds} sektoria on kiireellisiä. Jokainen viikko, jonka kiireellinen sektori jää ilman puolustusta, vie kestävyyttä.`, `${reds} sectors are urgent. Every week an urgent sector is left undefended costs resilience.`)}</p>` : reds === 1 && lv !== 'red' ? `<p class="warn">⚠ ${L('Kiireellinen sektori jää ilman puolustusta, jos taistelet täällä – kestävyys −1.', 'The urgent sector will be left undefended if you fight here – resilience −1.')}</p>` : ''}
    <div class="secList">${SECTORS.map(x => { const l = levelOf(threatOf(x.id)); return `<button data-id="${x.id}" class="${x.id === mapSel ? 'sel' : ''} lv-${l}"><i style="background:${LEVEL[l].col}"></i>${LEVEL[l].badge ? LEVEL[l].badge + ' ' : ''}${x.short}</button>`; }).join('')}</div>
    <button class="ghost" id="resetCampBtn">${L('Aloita kampanja alusta', 'Restart campaign')}</button>`;
  $('goBtn').onclick = () => { if (!goDis) goSector(s.id); };
  $('setBtn2').onclick = openSettings;
  $('shopBtn').onclick = openShop;
  $('mobBtn').onclick = () => {
    if (performance.now() - resetArmed > 3000) { resetArmed = performance.now(); $('mobBtn').textContent = L('Kuluttaa viikon – napauta uudelleen', 'Takes a week – tap again'); return; }
    resetArmed = 0;
    progress.reserve += 2; progress.mobilizeCd = 4;
    const rep = [B('📣 Reservi kutsuttu: seuraavat 2 taistelua +250 € aloitusbudjetti.', '📣 Reserves mobilised: next 2 battles +250 € starting budget.')];
    tickWeek(null, rep); sfx('ui');
    if (SECTORS.some(x => levelOf(threatOf(x.id)) === 'red')) sfx('alarm');
    mapSel = mostUrgent(); buildMap(); renderBrief();
  };
  if (pb) {
    $('resumeBtn').onclick = () => goSector(pb.id);
    $('abandonBtn').onclick = () => {
      if (performance.now() - resetArmed > 3000) { resetArmed = performance.now(); $('abandonBtn').textContent = L('Varmasti?', 'Sure?'); return; }
      resetArmed = 0;
      cfg = pbS; battleResolved = false; lives = 0; units = []; structs.clear(); cleared = new Set();
      resolveBattle(pb.id, false); mapSel = mostUrgent(); buildMap(); renderBrief();
    };
  }
  $('brief').querySelectorAll('.secList button').forEach(b => b.onclick = () => { mapSel = b.dataset.id; buildMap(); renderBrief(); });
  $('resetCampBtn').onclick = () => {
    if (performance.now() - resetArmed > 3000) { resetArmed = performance.now(); $('resetCampBtn').textContent = L('Varmasti? Napauta uudelleen', 'Sure? Tap again'); return; }
    progress = newCampaign(); saveProgress(); mapSel = mostUrgent(); buildMap(); renderBrief();
  };
}
function goSector(id) {
  const pb = progress.battle;
  if (pb && pb.id === id) loadSector(id, pb); else loadSector(id);
}
function showMap() {
  screen = 'map'; running = false; autoT = -1; showCountdown();
  mapSel = progress.battle ? progress.battle.id : mostUrgent(); mapTapId = null;
  setTool(null); select(null); fades = []; setCondition('clear', true);
  if (SECTORS.some(x => levelOf(threatOf(x.id)) === 'red')) sfx('alarm');
  document.body.classList.add('onmap');
  $('mapScreen').hidden = false; $('overlay').hidden = true;
  buildMap(); renderBrief();
}

// ================= MODAALIT: ASETUKSET JA HANKINNAT =================
function openModal(html) { const m = $('modal'); m.querySelector('.box').innerHTML = html + `<button class="close" id="modalClose">✕</button>`; m.hidden = false; $('modalClose').onclick = closeModal; }
function closeModal() { $('modal').hidden = true; if (pausedBySettings) { pausedBySettings = false; paused = false; updateHUD(true); } }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function openSettings() {
  const opt = (key, val, label) => `<button class="seg ${settings[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}">${label}</button>`;
  openModal(`<h2>${ICONS.gear} ${L('Asetukset', 'Settings')}</h2>
    <div class="setrow"><span>${L('Grafiikka', 'Graphics')}</span><div class="segs">${opt('gfx', 'high', L('Korkea', 'High'))}${opt('gfx', 'med', L('Keski', 'Medium'))}${opt('gfx', 'low', L('Matala', 'Low'))}</div></div>
    <p class="small">${L('Matala: ei varjoja ja pienempi tarkkuus – sujuvampi heikoilla puhelimilla.', 'Low: no shadows and lower resolution – smoother on weak phones.')}</p>
    <div class="setrow"><span>${L('Äänet', 'Sound')}</span><div class="segs">${opt('sound', true, L('Päällä', 'On'))}${opt('sound', false, L('Pois', 'Off'))}</div></div>
    <div class="setrow"><span>${L('Aallot alkavat automaattisesti', 'Waves start automatically')}</span><div class="segs">${opt('auto', true, L('Päällä', 'On'))}${opt('auto', false, L('Pois', 'Off'))}</div></div>
    <div class="setrow"><span>${L('Kieli', 'Language')}</span><div class="segs">${opt('lang', 'fi', 'Suomi')}${opt('lang', 'en', 'English')}</div></div>
    <div class="setrow"><span>${L('Opastus', 'Tutorial')}</span><button id="tutReset">${L('Näytä opastus uudelleen', 'Show tutorial again')}</button></div>`);
  $('modal').querySelectorAll('.seg').forEach(b => b.onclick = () => {
    const k = b.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; if (v === 'false') v = false;
    settings[k] = v; saveSettings(); sfx('ui');
    if (k === 'gfx') applyGfx();
    if (k === 'sound') { setSoundEnabled(v); if (v) { initAudio(); sfx('ui'); } }
    if (k === 'lang') applyLang();
    if (k === 'auto' && v && screen === 'sector' && phase === 'build' && autoT < 0) autoT = AUTO_SEC;
    openSettings();
  });
  $('tutReset').onclick = () => { try { localStorage.removeItem(TUT_KEY); } catch (e) { /* */ } toast(L('Opastus näytetään seuraavassa taistelussa.', 'The tutorial will show in the next battle.'), 'ok', 2500); closeModal(); };
}
const SHOP = [
  { k: 'leo', cost: 400 }, { k: 'k9', cost: 350 }, { k: 'nasams', cost: 450 }, { k: 'amv', cost: 250 },
  { k: 'budget', upg: true, max: 3, cost: 150, icon: '💶', name: 'Lisäbudjetti', nameEn: 'Extra budget', desc: '+100 € aloitusbudjettia jokaiseen taisteluun.', descEn: '+100 € starting budget in every battle.' },
  { k: 'iceye', upg: true, max: 1, cost: 300, svg: true, name: 'ICEYE-tilaus', nameEn: 'ICEYE subscription', desc: 'Ylilennot 90 s välein (muuten 180 s), tutkakuva kestää 30 s. Kartalla näkyy ensi viikon uhkaennuste.', descEn: 'Passes every 90 s (otherwise 180 s), radar image lasts 30 s. The map shows next week\'s threat forecast.' },
  { k: 'support', upg: true, max: 2, cost: 200, icon: '📡', name: 'Tulituen tehostus', nameEn: 'Fire support boost', desc: 'F-35:n ja HIMARSin latausaika −1 min.', descEn: 'F-35 and HIMARS cooldown −1 min.' },
];
function openShop() {
  const p = progress;
  const rows = SHOP.map(it => {
    const d = DEFS[it.k];
    const owned = it.upg ? (p.upg[it.k] || 0) >= it.max : !!p.unlocked[it.k];
    const lvl = it.upg ? ` (${p.upg[it.k] || 0}/${it.max})` : '';
    const name = it.upg ? L(it.name, it.nameEn) : d.name;
    const desc = it.upg ? L(it.desc, it.descEn) : `${L(d.desc, d.descEn || d.desc)} ${L('Hinta taistelussa', 'Cost in battle')}: ${d.cost} €.`;
    return `<div class="shopitem ${owned ? 'owned' : ''}"><span class="sico">${it.svg ? ICONS[it.k] : it.upg ? it.icon : ICONS[it.k]}</span>
      <div class="sinfo"><b>${name}${lvl}</b><small>${desc}</small></div>
      <button class="primary" data-k="${it.k}" ${owned || p.funds < it.cost ? 'disabled' : ''}>${owned ? (it.upg ? L('Maksimi', 'Max') : L('Hankittu', 'Owned')) : `${it.cost} M€`}</button></div>`;
  }).join('');
  openModal(`<h2>🛒 ${L('Hankinnat', 'Procurement')}</h2><p class="small">${L('Määrärahoja kertyy torjutuista hyökkäyksistä. Hankitut kalustot ovat käytössä kaikissa taisteluissa.', 'Funds are earned by repelling attacks. Purchased equipment is available in all battles.')} <b>${L('Käytettävissä', 'Available')}: ${p.funds} M€</b></p>${rows}`);
  $('modal').querySelectorAll('.shopitem button').forEach(b => b.onclick = () => {
    const it = SHOP.find(x => x.k === b.dataset.k); if (!it || p.funds < it.cost) return;
    p.funds -= it.cost;
    if (it.upg) p.upg[it.k] = (p.upg[it.k] || 0) + 1; else p.unlocked[it.k] = true;
    saveProgress(); sfx("coin"); rebuildTools(); openShop(); buildMap(); renderBrief();
  });
}
function applyStaticTexts() {
  const T = (id, fi, en, attr) => { const el = $(id); if (!el) return; if (attr) el.setAttribute(attr, L(fi, en)); else el.innerHTML = L(fi, en); };
  T('introText', INTRO_FI, INTRO_EN);
  T('startBtn', '🗺 Avaa kartta', '🗺 Open map');
  T('tagline', 'Itärajan puolustus – Vaalimaalta Ylä-Lappiin', 'Defending the eastern border – from Vaalimaa to Upper Lapland');
  T('camBtn', 'Palauta kamera', 'Reset camera', 'title');
  T('setBtn', 'Asetukset', 'Settings', 'title');
  T('leaveBtn', 'Strateginen kartta', 'Strategic map', 'title');
  T('waveLbl', 'Aalto', 'Wave');
  document.title = 'Salpa: Northern Front';
}
const INTRO_FI = $('introText') ? $('introText').innerHTML : '';
const INTRO_EN = `<p>The eastern border is split into <b>six sectors</b> from South-East Finland to Upper Lapland. Each has its own terrain, roads and a city to defend. The enemy attacks from different directions – you decide where to send your forces.</p>
  <ul>
    <li><b>Terrain matters:</b> infantry moves through forests and swamps, vehicles stick to roads and fields. Lakes, sea and fells stop vehicles.</li>
    <li><b>Fells</b> (Lapland): positions on a fell see far, +1 range.</li>
    <li><b>Tank traps</b> stop vehicles. Funnel the enemy into kill zones – but never block the route completely.</li>
    <li><b>Attacks:</b> on the map a red border = urgent major offensive, yellow = threat rising. Each battle takes a week, and meanwhile the threat grows elsewhere. Leaving an urgent sector undefended costs national resilience. Hold for 12 weeks.</li>
    <li><b>Fire support:</b> ✈️ F-35 and 🚀 HIMARS are called in battle (hotkeys F and H). They recharge for 4 minutes after use. The ☢ nuclear strike can be used once per campaign.</li>
    <li><b>🛰 ICEYE:</b> the Finnish radar satellite sees through darkness and clouds. At night, in fog and snowstorms enemies are only visible near your positions – an ICEYE pass reveals them all, locates the artillery battery and the special forces landing zone (hotkey I).</li>
    <li><b>Procurement:</b> repelled attacks earn funds for Leopard 2A6, K9 Thunder, NASAMS and Patria AMV.</li>
    <li><b>Fortify:</b> tanks, drones, helicopters and artillery destroy your positions. Positions survive in a sector you hold.</li>
    <li><b>Winter</b> freezes lakes and swamps. Night, fog and snowstorms shorten ranges.</li>
    <li><b>Reindeer</b> graze in the north and can block an enemy column on the road.</li>
  </ul>
  <p><small>Controls: drag = pan · two fingers / right mouse = rotate and zoom · keys 1–9 = buildings, space = wave, F/H = fire support.</small></p>`;
function applyLang() {
  document.documentElement.lang = settings.lang;
  if (typeof applyStaticTexts === 'function') applyStaticTexts();
  rebuildTools();
  if (screen === 'map') { buildMap(); renderBrief(); }
  if (screen === 'sector') { updateHUD(true); updateSupportUI(true); if (selected) refreshPanel(); }
}

// ================= AALLON AUTOMAATTINEN ALOITUS =================
function countdownTick(dt) {
  if (autoT < 0 || screen !== 'sector' || phase !== 'build' || gameOver) { if (autoShown !== -1) showCountdown(); return; }
  const blocked = !settings.auto || tut || !$('modal').hidden || !$('overlay').hidden;
  if (blocked) { if (autoShown !== -1) showCountdown(); return; }
  if (!paused) {
    const before = Math.ceil(autoT);
    autoT -= dt;
    const after = Math.ceil(autoT);
    if (after !== before && after <= 3 && after > 0) sfx('ui');
    if (autoT <= 0) { autoT = -1; startWave(); return; }
  }
  showCountdown();
}
function showCountdown() {
  const el = $('countdown');
  const on = autoT > 0 && screen === 'sector' && phase === 'build' && !gameOver && settings.auto && !tut && $('modal').hidden && $('overlay').hidden;
  if (!on) { el.hidden = true; autoShown = -1; return; }
  const n = Math.ceil(autoT), key = n * 10 + (paused ? 1 : 0);
  if (key === autoShown && !el.hidden) return;
  autoShown = key; el.hidden = false;
  el.classList.toggle('urgent', n <= 3 && !paused);
  el.innerHTML = `<div class="cd-label">${L(`Aalto ${wave + 1} alkaa`, `Wave ${wave + 1} starts in`)}</div><div class="cd-num" data-n="${n}">${n}</div><div class="cd-sub">${paused ? L('⏸ tauko', '⏸ paused') : L('paina ▶ aloittaaksesi heti', 'press ▶ to start now')}</div>`;
}

// ================= OPASTUS =================
const TUT_KEY = 'salpa.opastus.v1';
let tut = null, tutHl = null;
const TUT = [
  { fi: 'Tervetuloa rajalle! Vihollinen hyökkää <b>idästä (oikealta)</b> ja yrittää läpi kaupunkiin lännessä. Katkoviivat näyttävät reitit: <span class="lv">oranssi</span> = ajoneuvot, <span class="li">sininen</span> = jalkaväki.',
    en: 'Welcome to the border! The enemy attacks <b>from the east (right)</b> and tries to reach the city in the west. Dashed lines show their routes: <span class="lv">orange</span> = vehicles, <span class="li">blue</span> = infantry.', next: true },
  { fi: 'Valitse alapalkista <b>Konekivääriasema</b>.', en: 'Pick the <b>Machine-gun post</b> from the bottom bar.', hl: () => toolEls.mg, done: () => tool === 'mg' },
  { fi: 'Rakenna se jalkaväen reitin varrelle: napauta ruutua (puhelimessa kahdesti). Valkoinen rengas näyttää kantaman.', en: 'Build it next to the infantry route: tap a tile (twice on a phone). The white ring shows its range.', done: () => [...structs.values()].some(x => x.kind === 'mg') },
  { fi: 'Hyvä! Panssareita vastaan tarvitaan <b>Panssarintorjuntaohjus</b>. Rakenna se tien lähelle.', en: 'Good! Against armour you need an <b>Anti-tank missile</b>. Build one near the road.', hl: () => toolEls.atgm, done: () => [...structs.values()].some(x => x.kind === 'atgm'), skip: true },
  { fi: 'Kun olet valmis, paina <b>Aloita aalto</b>.', en: 'When you are ready, press <b>Start wave</b>.', hl: () => $('waveBtn'), done: () => phase === 'wave' },
  { fi: 'Napauta omaa asemaa: voit <b>päivittää</b>, <b>linnoittaa</b> ja <b>korjata</b> sen. Linnoitus suojaa vihollisen tulelta.', en: 'Tap one of your positions: you can <b>upgrade</b>, <b>fortify</b> and <b>repair</b> it. Fortification protects against enemy fire.', done: () => !!selected, skip: true },
  { fi: 'Hätätilanteessa tilaa <b>tulitukea</b>: F-35 iskee panssareihin, HIMARS tuhoaa alueen. Ne latautuvat 4 minuuttia. <b>Ydinisku</b> on kertakäyttöinen viimeinen keino.', en: 'In an emergency call <b>fire support</b>: the F-35 strikes armour, HIMARS saturates an area. They recharge for 4 minutes. The <b>nuclear strike</b> is a single-use last resort.', hl: () => $('support'), next: true },
  { fi: 'Siinä perusteet! Kampanjakartalla voit hankkia uutta kalustoa määrärahoilla. Onnea, puolustaja!', en: 'That is the basics! On the campaign map you can buy new equipment with funds. Good luck, defender!', next: true, last: true },
];
function maybeStartTutorial() {
  let done = false; try { done = !!localStorage.getItem(TUT_KEY); } catch (e) { /* */ }
  tut = done ? null : { step: 0 }; renderTut();
}
function endTutorial() { tut = null; try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { /* */ } renderTut(); }
function renderTut() {
  if (tutHl) { tutHl.classList.remove('tut-hl'); tutHl = null; }
  const el = $('tut');
  if (!tut || screen !== 'sector') { el.hidden = true; return; }
  const st = TUT[tut.step];
  el.hidden = false;
  el.innerHTML = `<div class="tstep">${tut.step + 1}/${TUT.length}</div><div class="ttext">${L(st.fi, st.en)}</div>
    <div class="tbtns">${st.next ? `<button class="primary" id="tutNext">${st.last ? L('Valmis', 'Done') : L('Seuraava', 'Next')}</button>` : st.skip ? `<button id="tutNext">${L('Ohita vaihe', 'Skip step')}</button>` : ''}<button class="ghost" id="tutSkip">${L('Ohita opastus', 'Skip tutorial')}</button></div>`;
  if ($('tutNext')) $('tutNext').onclick = () => { if (st.last) endTutorial(); else { tut.step++; renderTut(); } };
  $('tutSkip').onclick = endTutorial;
  const h = st.hl && st.hl(); if (h) { h.classList.add('tut-hl'); tutHl = h; }
}
function tutorialTick() {
  if (!tut) return;
  const st = TUT[tut.step];
  if (st.done && st.done()) { tut.step++; if (tut.step >= TUT.length) endTutorial(); else renderTut(); }
}

// ================= UI =================
function toast(msg, kind = 'info', ms = 3200) {
  const d = document.createElement('div'); d.className = `toast panel ${kind}`; d.textContent = msg;
  d.style.animationDuration = ms + 'ms';
  $('toasts').appendChild(d); setTimeout(() => d.remove(), ms);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
const toolEls = {};
const TOOL_LABEL = { mg: ['Konekivääri', 'Machine gun'], mortar: ['Kranaatinheitin', 'Mortar'], atgm: ['Pst-ohjus', 'Anti-tank'], aa: ['Ilmatorjunta', 'Anti-air'], obstacle: ['Hammaskivet', 'Tank traps'], apmine: ['Henkilömiinat', 'AP mines'], mine: ['Panssarimiinat', 'AT mines'], k9: ['K9 Moukari', 'K9 Thunder'], nasams: ['NASAMS', 'NASAMS'], leo: ['Leopard', 'Leopard'], amv: ['Patria AMV', 'Patria AMV'] };
const toolLabel = (d, k) => L(...TOOL_LABEL[k]);
const refundOf = x => Math.round(x.spent * (x.kept ? .3 : .6));
function dismantle(x) {
  money += refundOf(x); destroyStruct(x, false); sfx('coin');
  toast(L(`${x.def.name} purettu, +${refundOf(x)} €`, `${x.def.nameEn} dismantled, +${refundOf(x)} €`), 'ok', 1600);
  updateHUD(true); saveBattle();
}
function rebuildTools() {
  $('tools').innerHTML = '';
  for (const k in toolEls) delete toolEls[k];
  for (const [k, d] of Object.entries(DEFS)) {
    if (d.locked && !progress.unlocked[k]) continue;
    const b = document.createElement('button'); b.className = 'tool' + (d.mobile ? ' mob' : '');
    b.title = `${L(d.name, d.nameEn || d.name)} – ${d.cost} €`;
    b.innerHTML = `<span class="ico">${ICONS[k]}</span><span>${toolLabel(d, k)}</span><small>${d.cost} €</small>`;
    b.onclick = () => { sfx('ui'); setTool(tool === k ? null : k); };
    $('tools').appendChild(b); toolEls[k] = b;
  }
  const b = document.createElement('button'); b.className = 'tool demo';
  b.title = L('Pura asemia ja esteitä (palautus 60 %)', 'Dismantle positions and obstacles (60 % refund)');
  b.innerHTML = `<span class="ico">${ICONS.demolish}</span><span>${L('Pura', 'Dismantle')}</span><small>+60 %</small>`;
  b.onclick = () => { sfx('ui'); setTool(tool === 'demolish' ? null : 'demolish'); };
  $('tools').appendChild(b); toolEls.demolish = b;
}
rebuildTools();
function setTool(k) {
  if (k && supportMode) { supportMode = null; pendingStrike = -1; strikeRing.visible = strikeDisk.visible = false; }
  tool = k; pendingTile = -1; hl.visible = false; ring.visible = ringIn.visible = false;
  for (const [kk, el] of Object.entries(toolEls)) el.classList.toggle('sel', kk === k);
  if (k === 'demolish') { select(null); $('hint').hidden = false; $('hint').innerHTML = `<span class="hico">${ICONS.demolish}</span><b>${L('Pura', 'Dismantle')}</b> – ${L('napauta omaa asemaa, estettä, miinoitetta tai ajoneuvoa purkaaksesi sen. Saat takaisin 60 % hinnasta (aiemmista taisteluista säilyneistä 30 %).', 'tap your position, obstacle, minefield or vehicle to dismantle it. You get 60 % of the cost back (30 % for positions kept from earlier battles).')}<br><small>${isTouch ? L('Puhelimessa: napauta kahdesti.', 'On a phone: tap twice.') : L('Esc peruu.', 'Esc cancels.')}</small>`; return; }
  if (k) { select(null); $('hint').hidden = false; $('hint').innerHTML = `<span class="hico">${ICONS[k]}</span><b>${dn(DEFS[k])}</b> – ${dd(DEFS[k])}${TOWERS.has(k) ? L(' Tunturilla +1 kantama.', ' +1 range on a fell.') : ''}<br><small>${isTouch ? L('Napauta ruutua, napauta uudelleen rakentaaksesi.', 'Tap a tile, tap again to build.') : L('Klikkaa ruutua rakentaaksesi. Esc peruu.', 'Click a tile to build. Esc cancels.')}</small>`; }
  else $('hint').hidden = true;
}
function select(s) {
  selected = s;
  if (!s) { $('panel').hidden = true; if (!tool) { ring.visible = ringIn.visible = false; } return; }
  setTool(null); refreshPanel();
  if (TOWERS.has(s.kind) || s.mobile) showRange(s.x, s.z, tileTop(s.i), towerRange(s.def, s.lvl, s.i), s.def.minRange);
  else ring.visible = ringIn.visible = false;
}
function refreshPanel() {
  const s = selected; if (!s) return; const p = $('panel'); p.hidden = false;
  const refund = refundOf(s);
  let html = `<h3><span class="hico">${ICONS[s.kind]}</span>${dn(s.def)}</h3>`;
  if (s.mobile) {
    const rep = Math.ceil((1 - s.hp / s.maxHp) * s.def.cost * .5);
    html += `<p class="mtip">${L('Napauta kartalta ruutua, niin ajoneuvo ajaa sinne.', 'Tap a tile on the map to drive there.')}</p>
      <div class="row"><span>${L('Kunto', 'Condition')}</span><b>${Math.ceil(s.hp)}/${Math.round(s.maxHp)}</b></div>
      <div class="row"><span>${L('Vahinko / kantama', 'Damage / range')}</span><b>${s.def.dmg} / ${towerRange(s.def, 1, s.i).toFixed(1)}</b></div>
      <div class="btns">
        <button data-a="rep" ${rep <= 0 || money < rep ? 'disabled' : ''}>🔧 ${L('Korjaa', 'Repair')}${rep > 0 ? ` ${rep} €` : ''}</button>
        <button data-a="sell">🔨 ${L('Pura', 'Dismantle')} +${refund} €</button>
      </div>`;
  } else if (TOWERS.has(s.kind)) {
    const up = Math.round(s.def.cost * .8 * s.lvl), fc = FORT_COST[s.fort];
    const rep = Math.ceil((1 - s.hp / s.maxHp) * s.def.cost * .5);
    html += `<div class="row"><span>${L('Taso', 'Level')}</span><b>${s.lvl}/3</b></div>
      <div class="row"><span>${L('Kunto', 'Condition')}</span><b>${Math.ceil(s.hp)}/${Math.round(s.maxHp)}</b></div>
      <div class="row"><span>${L('Linnoitus', 'Fortification')}</span><b>${L(...FORT_NAME[s.fort])}</b></div>
      <div class="row"><span>${L('Vahinko / kantama', 'Damage / range')}</span><b>${Math.round(s.def.dmg * (1 + .45 * (s.lvl - 1)))} / ${towerRange(s.def, s.lvl, s.i).toFixed(1)}${terr[s.i] === FELL ? ' ⛰' : ''}</b></div>
      <div class="btns">
        <button data-a="up" ${s.lvl >= 3 || money < up ? 'disabled' : ''}>⬆ ${L('Päivitä', 'Upgrade')}${s.lvl < 3 ? ` ${up} €` : ''}</button>
        <button data-a="fort" ${s.fort >= 2 || money < fc ? 'disabled' : ''}>🛡 ${L('Linnoita', 'Fortify')}${s.fort < 2 ? ` ${fc} €` : ''}</button>
        <button data-a="rep" ${rep <= 0 || money < rep ? 'disabled' : ''}>🔧 ${L('Korjaa', 'Repair')}${rep > 0 ? ` ${rep} €` : ''}</button>
        <button data-a="sell">🔨 ${L('Pura', 'Dismantle')} +${refund} €</button>
      </div>`;
  } else {
    html += `<p>${dd(s.def)}</p>${NONBLOCK.has(s.kind) ? `<div class="row"><span>${L('Miinoja jäljellä', 'Mines left')}</span><b>${s.charges}</b></div>` : ''}
      <div class="btns"><button data-a="sell">🔨 ${L('Pura', 'Dismantle')} +${refund} €</button></div>`;
  }
  html += `<button class="close" data-a="close">✕</button>`;
  p.innerHTML = html;
  p.querySelectorAll('button').forEach(b => b.onclick = () => panelAction(b.dataset.a));
}
function panelAction(a) {
  const s = selected; if (!s) return;
  if (a === 'close') return select(null);
  if (a === 'sell') { dismantle(s); return; }
  else if (a === 'up') {
    const c = Math.round(s.def.cost * .8 * s.lvl); if (money < c || s.lvl >= 3) return;
    money -= c; s.spent += c; const r = s.hp / s.maxHp; s.lvl++; s.maxHp = calcMaxHp(s); s.hp = s.maxHp * r;
    s.group.userData.turret.scale.setScalar(1 + .1 * (s.lvl - 1)); addLevelMark(s);
    showRange(s.x, s.z, tileTop(s.i), towerRange(s.def, s.lvl, s.i), s.def.minRange);
  } else if (a === 'fort') {
    const c = FORT_COST[s.fort]; if (money < c || s.fort >= 2) return;
    money -= c; s.spent += c; const r = s.hp / s.maxHp; s.fort++; s.maxHp = calcMaxHp(s); s.hp = s.maxHp * r; addFortMesh(s);
  } else if (a === 'rep') {
    const c = Math.ceil((1 - s.hp / s.maxHp) * s.def.cost * .5); if (money < c) return;
    money -= c; s.hp = s.maxHp; s.bar.root.visible = false;
  }
  if (s.bar && !s.dead) s.bar.set(s.hp / s.maxHp);
  if (a !== 'sell') sfx('build');
  updateHUD(true); if (selected) refreshPanel();
  saveBattle();
}
let lastHud = '';
function updateHUD(force) {
  if (screen !== 'sector') return;
  const key = `${money}|${lives}|${wave}|${phase}|${winter}|${speed}|${paused}|${cond}|${nextCond}`;
  if (!force && key === lastHud) return;
  const moneyChanged = !lastHud.startsWith(money + '|'); lastHud = key;
  $('money').textContent = money; $('lives').textContent = lives;
  $('wave').textContent = `${wave}/${battleWaves}`;
  $('season').textContent = (winter ? L('❄️ Talvi', '❄️ Winter') : L('☀️ Sula maa', '☀️ Thaw')) + (phase === 'wave' && cond !== 'clear' ? ` · ${COND[cond].icon} ${L(COND[cond].name, COND[cond].en)}` : '');
  $('speedBtn').textContent = speed + '×'; $('pauseBtn').textContent = paused ? '▶' : '⏸';
  const wb = $('waveBtn'); wb.disabled = phase !== 'build';
  wb.textContent = phase === 'build' ? L(`▶ Aloita aalto ${wave + 1}`, `▶ Start wave ${wave + 1}`) : L(`Aalto ${wave} käynnissä…`, `Wave ${wave} in progress…`);
  for (const [k, el] of Object.entries(toolEls)) if (DEFS[k]) el.classList.toggle('poor', money < DEFS[k].cost);
  if (phase === 'build') {
    const c = waveComp(wave + 1), parts = [];
    if (c.inf) parts.push(`${c.inf}× ${L('jalkaväki', 'infantry')}`); if (c.bmp && spawns.veh.length) parts.push(`${c.bmp}× BMP`);
    if (c.tank && spawns.veh.length) parts.push(`${c.tank}× ${L('panssarivaunu', 'tank')}`); if (c.drone) parts.push(`${c.drone}× ${L('lennokki', 'drone')}`);
    if (c.heli) parts.push(`${c.heli}× ${L('taisteluhelikopteri', 'attack helicopter')}`); if (c.ew && spawns.veh.length) parts.push(`${c.ew}× ${L('häirintäasema', 'EW jammer')}`);
    const art = (wave + 1 >= 6 ? L(' · tykistöpatteri rajan takana', ' · artillery battery across the border') : '') + (wave + 1 >= 5 ? L(' · erikoisjoukkojen uhka', ' · special forces threat') : '');
    const nc = COND[nextCond]; const condTxt = nextCond !== 'clear' ? `<br>${nc.icon} <b>${L('Sää', 'Weather')}: ${L(nc.name, nc.en)}</b> – ${L(nc.desc, nc.descEn)}` : '';
    $('intel').innerHTML = `<b>${L('Tiedustelu, aalto', 'Intel, wave')} ${wave + 1}${seasonOf(wave + 1) ? L(' (talvi)', ' (winter)') : ''}:</b> ${parts.join(', ')}${art}${condTxt}<br><small><span class="lv">━ ━</span> ${L('ajoneuvojen reitti', 'vehicle route')} &nbsp; <span class="li">┅┅</span> ${L('jalkaväen reitit', 'infantry routes')}</small>`;
    $('intel').hidden = false;
  } else $('intel').hidden = true;
  if (moneyChanged && selected) refreshPanel();
}
$('waveBtn').onclick = startWave;
$('speedBtn').onclick = () => { speed = speed === 3 ? 1 : speed + 1; updateHUD(true); };
$('pauseBtn').onclick = () => { paused = !paused; updateHUD(true); };
$('camBtn').onclick = resetCamera;
let pausedBySettings = false;
$('setBtn').onclick = () => { if (!paused) { paused = true; pausedBySettings = true; updateHUD(true); } openSettings(); };
$('leaveBtn').onclick = () => {
  const fighting = !gameOver && !battleResolved && wave > 0;
  if (fighting && performance.now() - leaveArmed > 3000) {
    leaveArmed = performance.now(); toast(L('Vetäytyminen lasketaan tappioksi (kestävyys −1). Napauta 🗺 uudelleen vetäytyäksesi.', 'Retreating counts as a loss (resilience −1). Tap 🗺 again to retreat.'), 'warn', 3500); return;
  }
  if (fighting) resolveBattle(cfg.id, false);
  else if (!battleResolved && wave === 0) { progress.battle = null; saveProgress(); }
  showMap();
};
addEventListener('keydown', e => {
  if (screen !== 'sector') return;
  if (e.key === 'Escape') { setTool(null); select(null); if (supportMode) cancelSupport(); }
  if (e.key === 'f' || e.key === 'F') setSupportMode('f35');
  if (e.key === 'h' || e.key === 'H') setSupportMode('himars');
  if (e.key === 'n' || e.key === 'N') setSupportMode('nuke');
  if (e.key === 'i' || e.key === 'I') setSupportMode('iceye');
  if (e.key === ' ') { e.preventDefault(); phase === 'build' ? startWave() : (paused = !paused, updateHUD(true)); }
  const n = parseInt(e.key); const ks = Object.keys(toolEls); if (n >= 1 && n <= ks.length) setTool(ks[n - 1]);
});

// --- syöte
let isTouch = matchMedia('(pointer: coarse)').matches;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.3), hit = new THREE.Vector3();
let lastHit = new THREE.Vector3();
function unitAt(x, z) { let b = null, bd = .6; for (const u of units) { const d = Math.hypot(u.x - x, u.z - z); if (!u.dead && d < bd) { bd = d; b = u; } } return b; }
function tileAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return -1;
  lastHit.copy(hit);
  const x = Math.floor(hit.x), z = Math.floor(hit.z);
  if (x < 0 || z < 0 || x >= W || z >= H) return -1;
  return idx(x, z);
}
function previewTile(i) {
  if (i < 0 || !tool) { hl.visible = false; ring.visible = ringIn.visible = false; return null; }
  if (tool === 'demolish') {
    const has = structs.has(i) || units.some(u => !u.dead && u.i === i);
    hl.visible = true; hl.position.set(ix(i) + .5, tileTop(i) + .03, iz(i) + .5); hlMat.color.setHex(has ? 0xff9933 : 0x777777);
    ring.visible = ringIn.visible = false; return null;
  }
  const err = canPlace(tool, i);
  hl.visible = true; hl.position.set(ix(i) + .5, tileTop(i) + .03, iz(i) + .5);
  hlMat.color.setHex(err ? 0xff9933 : 0x4da3ff);
  const d = DEFS[tool];
  if (d.range) showRange(ix(i) + .5, iz(i) + .5, tileTop(i), towerRange(d, 1, i), d.minRange); else ring.visible = ringIn.visible = false;
  return err;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; isTouch = e.pointerType === 'touch'; });
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || down) return;
  if (supportMode) previewStrike(tileAt(e.clientX, e.clientY));
  else if (tool) previewTile(tileAt(e.clientX, e.clientY));
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dtm = performance.now() - down.t; down = null;
  if (moved > 8 || dtm > 600 || screen !== 'sector' || gameOver) return;
  const i = tileAt(e.clientX, e.clientY);
  if (supportMode) {
    if (i < 0) { toast(L('Valitse kohde kartalta.', 'Pick a target on the map.'), 'warn', 1500); return; }
    if ((isTouch || supportMode === 'nuke') && pendingStrike !== i) { pendingStrike = i; previewStrike(i); if (supportMode === 'nuke') toast(L('☢ Vahvista ydinisku napauttamalla samaa kohtaa uudelleen.', '☢ Confirm the nuclear strike by tapping the same spot again.'), 'warn', 2500); return; }
    callStrike(supportMode, i); return;
  }
  if (tool === 'demolish') {
    const target = (i >= 0 && unitAt(lastHit.x, lastHit.z)) || (i >= 0 && structs.get(i)) || null;
    if (!target) { toast(L('Ruudussa ei ole purettavaa.', 'Nothing to dismantle here.'), 'warn', 1500); sfx('deny'); return; }
    if (isTouch && pendingTile !== i) { pendingTile = i; previewTile(i); return; }
    pendingTile = -1; dismantle(target); previewTile(i); return;
  }
  if (tool) {
    if (isTouch && pendingTile !== i) { pendingTile = i; const err = previewTile(i); if (err && i >= 0) toast(err, 'warn', 1800); return; }
    const err = i < 0 ? L('Kartan ulkopuolella', 'Outside the map') : canPlace(tool, i);
    if (err) { toast(err, 'warn', 1800); previewTile(i); sfx('deny'); return; }
    build(tool, i); pendingTile = -1; previewTile(i); updateHUD(true); saveBattle();
    if (money < DEFS[tool].cost) setTool(null);
  } else {
    const u = i >= 0 ? unitAt(lastHit.x, lastHit.z) : null;
    if (u) { select(u); sfx('ui'); return; }
    if (selected && selected.mobile && i >= 0 && !structs.has(i)) { orderMove(selected, i); return; }
    select(i >= 0 && structs.has(i) ? structs.get(i) : null);
    if (i >= 0 && !structs.has(i)) {
      const t = terr[i];
      $('hint').hidden = false;
      const tn = L(...TERRAIN_NAME[t]);
      $('hint').innerHTML = `<b>${tn[0].toUpperCase() + tn.slice(1)}</b>${t === FELL ? L(' – ajoneuvot eivät pääse, asemat näkevät kauas (+1 kantama)', ' – vehicles cannot pass, positions see far (+1 range)') : t === SWAMP ? (winter ? L(' – jäätynyt, kantaa panssarit', ' – frozen, carries tanks') : L(' – ajoneuvot eivät pääse', ' – impassable for vehicles')) : t === LAKE ? (winter ? L(' – jäätynyt, kantaa kaiken', ' – frozen, carries everything') : L(' – este kaikille', ' – blocks everyone')) : ''}`;
      clearTimeout(previewTile.tm); previewTile.tm = setTimeout(() => { if (!tool) $('hint').hidden = true; }, 2500);
    }
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});
$('startBtn').onclick = () => { $('overlay').hidden = true; showMap(); };
setSoundEnabled(settings.sound);
applyStaticTexts(); document.documentElement.lang = settings.lang;
addEventListener('pointerdown', () => initAudio(), { capture: true });
addEventListener('keydown', () => initAudio(), { capture: true });
// --- kansikuva (aloitusruutu)
$('coverBg').style.backgroundImage = `url(${$('coverImg').src})`;
function closeCover() {
  const c = $('cover'); if (!c || c.classList.contains('out')) return;
  c.classList.add('out'); setTimeout(() => c.remove(), 600);
  removeEventListener('keydown', coverKey);
}
function coverKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeCover(); } }
$('cover').addEventListener('click', closeCover);
addEventListener('keydown', coverKey);

// ================= TULITUKI: F-35 JA HIMARS =================
const SUPPORT = {
  iceye:  { name: 'ICEYE', cd: 180, key: 'i', desc: 'Tutkasatelliitin ylilento: paljastaa kaikki viholliset myös pimeällä ja sumussa, paikantaa tykistöpatterin ja erikoisjoukkojen laskeutumisalueen. HIMARS ja tykistö osuvat paljastettuihin kohteisiin tarkemmin.', descEn: 'Radar satellite pass: reveals all enemies even at night and in fog, locates the artillery battery and the special forces landing zone. HIMARS and artillery hit revealed targets more accurately.' },
  f35:    { name: 'F-35', icon: '✈️', cd: 240, radius: 3.5, key: 'f', descEn: 'Fighter precision strike: guided bombs on the heaviest vehicles in the area, and shoots down drones and helicopters.', desc: 'Hävittäjän täsmäisku: ohjautuvat pommit kohdealueen raskaimpiin ajoneuvoihin ja lennokkien alasampuminen.' },
  himars: { name: 'HIMARS', icon: '🚀', cd: 240, radius: 1.8, key: 'h', descEn: 'Rocket artillery: an eight-rocket salvo. Destroys everything on the ground in the area.', desc: 'Raketinheitin: kahdeksan raketin aluetuli. Tuhoaa maalla kaiken kohdealueella.' },
  nuke:   { name: 'Ydinisku', nameEn: 'Nuclear strike', cd: 0, radius: 6, once: true, key: 'n',
    desc: 'Kertakäyttöinen koko kampanjassa. Tuhoaa kaiken 6 ruudun säteellä – myös omat asemat lähellä räjähdystä – ja jättää säteilyalueen. Vihollisen painostus kiihtyy muilla sektoreilla.',
    descEn: 'Single use per campaign. Destroys everything within 6 tiles – including your own positions near ground zero – and leaves a radiation zone. Enemy pressure escalates in other sectors.' },
};
if (!progress.support) progress.support = { f35: 0, himars: 0 };
if (progress.support.iceye == null) progress.support.iceye = 0;
for (const k of ['f35', 'himars']) progress.support[k] = Math.min(progress.support[k] || 0, SUPPORT[k].cd);
let supportMode = null, pendingStrike = -1, strikes = [], supportUiT = 0;
const strikeRingMat = new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide });
const strikeRing = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 56).rotateX(-Math.PI / 2), strikeRingMat);
const strikeDisk = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: .16, depthWrite: false }));
strikeRing.visible = strikeDisk.visible = false; strikeRing.renderOrder = strikeDisk.renderOrder = 7; scene.add(strikeRing, strikeDisk);
const groundY = (x, z) => (x >= 0 && z >= 0 && x < W && z < H) ? tileTop(idx(Math.floor(x), Math.floor(z))) : .3;
// F-35 malli
const JET_PROTO = (() => {
  const g = new THREE.Group(), mJet = M(0x66737b), mDark = M(0x3b444a);
  g.add(mesh(new THREE.BoxGeometry(.9, .11, .15), mJet, 0, 0, 0));
  const nose = mesh(new THREE.ConeGeometry(.075, .28, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4), mJet, .58, 0, 0); g.add(nose);
  g.add(mesh(new THREE.BoxGeometry(.18, .06, .1), M(0x9fb6c2), .3, .07, 0));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute([.22, 0, 0, -.34, 0, .52, -.4, 0, 0, .22, 0, 0, -.4, 0, 0, -.34, 0, -.52], 3));
  wg.computeVertexNormals();
  g.add(mesh(wg, new THREE.MeshLambertMaterial({ color: 0x5c686f, flatShading: true, side: THREE.DoubleSide }), 0, -.01, 0));
  for (const s of [-1, 1]) {
    const t = mesh(new THREE.BoxGeometry(.16, .16, .02), mDark, -.36, .1, s * .08); t.rotation.x = s * .4; g.add(t);
    g.add(mesh(new THREE.BoxGeometry(.12, .015, .14), mJet, -.42, 0, s * .12));
  }
  g.add(mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa040 }), -.47, 0, 0, false));
  g.scale.setScalar(1.25);
  return g;
})();
function setSupportMode(k) {
  if (screen !== 'sector' || gameOver) return;
  if (supportMode === k) { cancelSupport(); return; }
  if (phase !== 'wave') { toast(L('Tulitukea voi tilata vain hyökkäyksen aikana.', 'Fire support can only be called during an attack.'), 'warn', 2200); return; }
  if (k === 'iceye') {
    if (progress.support.iceye > 0) { toast(L(`ICEYE: seuraava ylilento ${fmtCd(progress.support.iceye)}.`, `ICEYE: next pass in ${fmtCd(progress.support.iceye)}.`), 'warn', 2200); return; }
    activateIceye(); return;
  }
  if (k === 'f35' && COND[cond].noAir) { toast(L('Sää estää lentotoiminnan.', 'Weather prevents air operations.'), 'warn', 2200); sfx('deny'); return; }
  if (k === 'nuke' && progress.nukeUsed) { toast(L('Ydinisku on jo käytetty tässä kampanjassa.', 'The nuclear strike has already been used this campaign.'), 'warn', 2500); sfx('deny'); return; }
  if (progress.support[k] > 0) { toast(L(`${SUPPORT[k].name} latautuu vielä ${fmtCd(progress.support[k])}.`, `${SUPPORT[k].name} recharging: ${fmtCd(progress.support[k])}.`), 'warn', 2200); return; }
  setTool(null); select(null);
  supportMode = k; pendingStrike = -1;
  $('hint').hidden = false;
  $('hint').innerHTML = `<span class="hico">${ICONS[k]}</span><b>${L(SUPPORT[k].name, SUPPORT[k].nameEn || SUPPORT[k].name)}</b> – ${dd(SUPPORT[k])}<br><small>${k === 'nuke' ? L('Napauta kohdetta ja vahvista napauttamalla uudelleen.', 'Tap a target and confirm by tapping again.') : isTouch ? L('Napauta kohdetta, napauta uudelleen vahvistaaksesi.', 'Tap a target, tap again to confirm.') : L('Klikkaa kohdetta. Esc peruu.', 'Click a target. Esc cancels.')}</small>`;
  strikeRingMat.color.setHex(k === 'nuke' ? 0xff3b30 : 0xff7a3c);
  updateSupportUI(true);
}
function cancelSupport() {
  supportMode = null; pendingStrike = -1; strikeRing.visible = strikeDisk.visible = false;
  if (!tool) $('hint').hidden = true;
  updateSupportUI(true);
}
function previewStrike(i) {
  if (i < 0 || !supportMode) { strikeRing.visible = strikeDisk.visible = false; return; }
  const r = SUPPORT[supportMode].radius, x = ix(i) + .5, z = iz(i) + .5, y = tileTop(i) + .07;
  for (const m of [strikeRing, strikeDisk]) { m.visible = true; m.position.set(x, y, z); m.scale.setScalar(r); }
}
function supportCd(k) { if (k === 'iceye') return progress.upg.iceye ? 90 : 180; return Math.max(120, SUPPORT[k].cd - (progress.upg.support || 0) * 60); }
const iceyeDur = () => (progress.upg.iceye ? 30 : 20);
function fmtCd(s) { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function callStrike(k, i) {
  const x = ix(i) + .5, z = iz(i) + .5;
  if (k === 'nuke') { cancelSupport(); launchNuke(x, z); return; }
  progress.support[k] = supportCd(k); saveProgress(); sfx(k === 'f35' ? 'jet' : 'himars');
  cancelSupport();
  if (k === 'himars') {
    toast(L('🚀 HIMARS: tulitehtävä vahvistettu – raketit matkalla!', '🚀 HIMARS: fire mission confirmed – rockets inbound!'), 'ok', 2500);
    for (let n = 0; n < 8; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (iceyeT > 0 ? .8 : 1.5);
      const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
      const m = mesh(new THREE.CylinderGeometry(.035, .035, .32, 5).rotateZ(Math.PI / 2), MAT.white, -6, .6, z, false);
      m.visible = false; world.add(m);
      strikes.push({ kind: 'rocket', mesh: m, from: V(-6, .6, clamp(z + (n - 2.5) * .15, 0, H)), to: V(tx, groundY(tx, tz), tz), t: -n * .14, T: 1.6, h: 5.5, puffT: 0 });
    }
  } else {
    toast(L('✈️ F-35: täsmäisku tulossa!', '✈️ F-35: precision strike inbound!'), 'ok', 2500);
    const m = JET_PROTO.clone(); m.position.set(-10, 3, z); world.add(m);
    strikes.push({ kind: 'jet', mesh: m, x: -10, z, y: 3, tx: x, tz: z, dropped: false });
  }
  updateSupportUI(true);
}
function updateStrikes(dt) {
  for (const s of strikes) {
    if (s.kind === 'rocket') {
      s.t += dt; if (s.t < 0) continue;
      s.mesh.visible = true;
      const k = Math.min(1, s.t / s.T);
      const prev = s.mesh.position.clone();
      s.mesh.position.lerpVectors(s.from, s.to, k); s.mesh.position.y += Math.sin(Math.PI * k) * s.h;
      const dir = s.mesh.position.clone().sub(prev);
      if (dir.lengthSq() > 1e-8) s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      s.puffT -= dt; if (s.puffT <= 0) { puff(s.mesh.position); s.puffT = .03; }
      if (k >= 1) {
        s.done = true; world.remove(s.mesh); s.mesh.geometry.dispose();
        boom(s.to.x, s.to.y + .15, s.to.z, 1.1, 0xffb040);
        for (const e of enemies) {
          if (e.dead || e.cls === 'air') continue;
          const d = Math.hypot(e.x - s.to.x, e.z - s.to.z);
          if (d < 1.4) hurt(e, 260 * (iceyeT > 0 ? 1.25 : 1) * (1 - d / 1.4 * .4), [1, 1, .85, 0, 0]);
        }
      }
    } else if (s.kind === 'jet') {
      s.x += 13 * dt;
      s.mesh.position.set(s.x, s.y + Math.sin(s.x * .3) * .05, s.z);
      s.mesh.rotation.x = Math.sin(s.x * .25) * .12;
      if (!s.dropped && s.x >= s.tx - 3.2) {
        s.dropped = true;
        // ilmatorjunta: lennokit alas
        for (const e of enemies) if (!e.dead && e.cls === 'air' && Math.hypot(e.x - s.tx, e.z - s.tz) < 4.5) {
          tracer(V(s.x, s.y, s.z), V(e.x, e.y, e.z), 0xbfe6ff, .25); hurt(e, 9999, [0, 0, 0, 1, 1]);
        }
        // täsmäpommit raskaimpiin maalikohteisiin
        const tg = enemies.filter(e => !e.dead && e.cls !== 'air' && Math.hypot(e.x - s.tx, e.z - s.tz) < SUPPORT.f35.radius)
          .sort((a, b) => (b.armor - a.armor) || (b.hp - a.hp)).slice(0, 4);
        const aims = tg.length ? tg : [null];
        aims.forEach((e, n) => {
          const m = mesh(new THREE.CylinderGeometry(.03, .03, .2, 5).rotateZ(Math.PI / 2), MAT.dark, s.x, s.y - .1, s.z + (n - 1.5) * .1, false);
          world.add(m);
          strikes.push({ kind: 'bomb', mesh: m, from: V(s.x, s.y - .1, s.z), target: e, last: e ? V(e.x, e.y, e.z) : V(s.tx, groundY(s.tx, s.tz), s.tz), t: -n * .12, T: 1.0 });
        });
      }
      if (s.x > W + 10) { s.done = true; world.remove(s.mesh); }
    } else if (s.kind === 'bomb') {
      s.t += dt; if (s.t < 0) { s.mesh.position.x += 13 * dt; s.from.x += 13 * dt; continue; }
      if (s.target && !s.target.dead) s.last.set(s.target.x, s.target.y, s.target.z);
      const k = Math.min(1, s.t / s.T);
      s.mesh.position.lerpVectors(s.from, s.last, k * k);
      s.mesh.rotation.z = -k * 1.2;
      if (k >= 1) {
        s.done = true; world.remove(s.mesh); s.mesh.geometry.dispose();
        boom(s.last.x, s.last.y + .15, s.last.z, 1.0, 0xffc060);
        if (s.target) hurt(s.target, 700, [.6, 1, 1, 0]);
        for (const e of enemies) {
          if (e.dead || e.cls === 'air' || e === s.target) continue;
          if (Math.hypot(e.x - s.last.x, e.z - s.last.z) < .8) hurt(e, 160, [1, .8, .5, 0]);
        }
      }
    }
  }
  strikes = strikes.filter(s => !s.done);
}
function tickSupport(dt) {
  for (const k in SUPPORT) if (progress.support[k] > 0) progress.support[k] = Math.max(0, progress.support[k] - dt);
}
const supEls = {};
for (const [k, d] of Object.entries(SUPPORT)) {
  const b = document.createElement('button'); b.className = 'sup';
  b.title = dd(d);
  b.innerHTML = `<span class="ic">${ICONS[k]}</span><span class="nm">${d.name}</span><span class="st"></span><i class="fill"></i>`;
  b.onclick = () => setSupportMode(k);
  if (k === 'nuke') b.classList.add('nuke');
  if (k === 'iceye') b.classList.add('iceye');
  $('support').appendChild(b); supEls[k] = b;
}
// ================= YDINISKU =================
let nukes = [], radZones = [], shake = 0;
function launchNuke(x, z) {
  progress.nukeUsed = true; progress.nukeEsc = true; saveProgress();
  toast(L('☢ YDINISKU LAUKAISTU – osumaan 3 sekuntia!', '☢ NUCLEAR STRIKE LAUNCHED – impact in 3 seconds!'), 'warn', 3000);
  sfx('alarm');
  const y = groundY(x, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.set(x, y + .08, z); ring.scale.setScalar(SUPPORT.nuke.radius); world.add(ring);
  const missile = mesh(new THREE.CylinderGeometry(.06, .06, .6, 6), MAT.white, x - 4, 14, z, false); world.add(missile);
  nukes.push({ x, z, y, t: 0, T: 3, ring, missile, phase: 'in' });
  updateSupportUI(true);
}
function detonate(n) {
  const { x, z, y } = n, R0 = SUPPORT.nuke.radius;
  world.remove(n.ring); world.remove(n.missile);
  sfx('nuke');
  const fl = $('flash'); fl.classList.add('nukeflash'); setTimeout(() => fl.classList.remove('nukeflash'), 900);
  shake = 1.6;
  // tulipallo ja sienipilvi
  const fire = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 1, depthWrite: false }));
  fire.position.set(x, y + .5, z); world.add(fire);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.5, .9, 1, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0x7a5a48, transparent: true, opacity: .95, flatShading: true }));
  stem.position.set(x, y, z); world.add(stem);
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xc27a4a, emissive: 0x5a2008, transparent: true, opacity: .95, flatShading: true }));
  cap.position.set(x, y + 1, z); world.add(cap);
  const shock = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
  shock.position.set(x, y + .1, z); world.add(shock);
  n.fx = { fire, stem, cap, shock }; n.phase = 'blast'; n.t = 0;
  // vahinko viholliselle
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.z - z) < R0) hurt(e, 1e6, [1, 1, 1, 1, 1]);
  // omat asemat ja ajoneuvot
  for (const st of [...structs.values(), ...units]) {
    const d = Math.hypot(st.x - x, st.z - z);
    if (d < 2.5) destroyStruct(st, true);
    else if (d < 4.5 && st.def.hp) hurtStruct(st, st.maxHp * .6 / (1 - (st.mobile ? (st.def.armor || 0) : FORT_RED[st.fort])));
  }
  // metsät palavat, maa hiiltyy
  for (let zz = 0; zz < H; zz++) for (let xx = 0; xx < W; xx++) {
    const i = idx(xx, zz), d = Math.hypot(xx + .5 - x, zz + .5 - z);
    if (d < R0 - 1) { clearTile(i); }
    if (d < 3.2 && terr[i] !== LAKE && terr[i] !== SEA) { tmpCol.setHex(0x3a332c).multiplyScalar(.8 + hash2(xx, zz) * .4); tiles.setColorAt(i, tmpCol); }
  }
  tiles.instanceColor.needsUpdate = true;
  for (const d of deer) { if (Math.hypot(d.x - x, d.z - z) < R0) { d.state = 'flee'; d.t = 3; d.fx = d.x - x || .5; d.fz = d.z - z || .5; } }
  shockwaves.push({ x, z, r: R0 * 2 });
  // säteilyalue
  const zone = new THREE.Mesh(new THREE.CircleGeometry(3, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8ff3a, transparent: true, opacity: .12, depthWrite: false }));
  zone.position.set(x, y + .09, z); world.add(zone);
  radZones.push({ x, z, r: 3, mesh: zone });
  recomputeFields();
  toast(L('☢ Ydinisku osui. Säteilyalue vahingoittaa jalkaväkeä.', '☢ Nuclear strike hit. The radiation zone damages infantry.'), 'warn', 4000);
}
function updateNukes(dt) {
  for (const n of nukes) {
    n.t += dt;
    if (n.phase === 'in') {
      const k = Math.min(1, n.t / n.T);
      n.ring.material.opacity = .4 + .4 * Math.abs(Math.sin(n.t * 10));
      n.missile.position.set(n.x - 4 * (1 - k), n.y + 14 * (1 - k), n.z); n.missile.rotation.z = .28;
      if (k >= 1) detonate(n);
    } else if (n.phase === 'blast') {
      const { fire, stem, cap, shock } = n.fx, t = n.t;
      fire.scale.setScalar(Math.min(3.2, .5 + t * 6)); fire.material.opacity = Math.max(0, 1 - t / 1.4);
      fire.material.color.setHex(t < .4 ? 0xfff1c0 : 0xff9a40);
      const h = Math.min(5.5, t * 2.4);
      stem.scale.set(1 + t * .1, h, 1 + t * .1); stem.position.y = n.y + h / 2;
      cap.position.y = n.y + h + .3; cap.scale.set(1.2 + Math.min(1.8, t * .9), .7 + Math.min(.9, t * .4), 1.2 + Math.min(1.8, t * .9));
      shock.scale.setScalar(.5 + t * 9); shock.material.opacity = Math.max(0, .8 - t / 1.2);
      if (t > 5) { const o = Math.max(0, 1 - (t - 5) / 4); stem.material.opacity = cap.material.opacity = .95 * o; }
      if (t > 9) { for (const m of [fire, stem, cap, shock]) world.remove(m); n.done = true; }
    }
  }
  nukes = nukes.filter(n => !n.done);
  for (const zn of radZones) {
    zn.mesh.material.opacity = .1 + .05 * Math.sin(performance.now() * .004);
    for (const e of enemies) if (!e.dead && e.cls === 'inf' && Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r) hurt(e, 14 * dt, [1, 0, 0, 0, 0]);
  }
  if (shake > 0) shake = Math.max(0, shake - dt);
}
function updateSupportUI(force) {
  for (const [k, b] of Object.entries(supEls)) {
    if (k === 'nuke') {
      const used = !!progress.nukeUsed;
      b.classList.toggle('ready', !used && phase === 'wave'); b.classList.toggle('armed', supportMode === k); b.classList.toggle('cooling', used);
      b.querySelector('.nm').textContent = L('Ydinisku', 'Nuke');
      b.querySelector('.st').textContent = supportMode === k ? L('VALITSE KOHDE', 'PICK TARGET') : used ? L('käytetty', 'used') : L('1× kampanja', '1× campaign');
      b.querySelector('.fill').style.width = used ? '0%' : '100%';
      continue;
    }
    const cd = progress.support[k] || 0, ready = cd <= 0;
    b.classList.toggle('ready', ready && phase === 'wave');
    b.classList.toggle('armed', supportMode === k);
    b.classList.toggle('cooling', !ready);
    b.querySelector('.st').textContent = k === 'iceye' && iceyeT > 0 ? L(`KUVA ${Math.ceil(iceyeT)} s`, `IMAGE ${Math.ceil(iceyeT)} s`) : supportMode === k ? L('VALITSE KOHDE', 'PICK TARGET') : ready ? (phase === 'wave' ? L('VALMIS', 'READY') : L('valmiina', 'ready')) : fmtCd(cd);
    if (k === 'iceye') b.classList.toggle('active', iceyeT > 0);
    b.querySelector('.fill').style.width = ready ? '100%' : `${(1 - cd / supportCd(k)) * 100}%`;
    b.classList.toggle('blocked', k === 'f35' && phase === 'wave' && !!COND[cond].noAir);
  }
}

// ================= ICEYE: TUTKASATELLIITTI JA NÄKYVYYS =================
let iceyeT = 0, sats = [];
const SPOT = { aa: 5, nasams: 7.5 };
function updateVisibility(dt) {
  if (iceyeT > 0) { iceyeT = Math.max(0, iceyeT - dt); if (iceyeT === 0) { specMark.visible = false; toast(L('ICEYE: tutkakuva vanheni.', 'ICEYE: radar image expired.'), 'info', 2000); } }
  const daylight = cond === 'clear';
  const spotters = [...structs.values()].filter(x => TOWERS.has(x.kind)).concat(units.filter(u => !u.dead));
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.d.static) { e.vis = iceyeT > 0 || !!e.located; if (iceyeT > 0) e.located = true; continue; }
    if (daylight || iceyeT > 0 || e.x < 4) { e.vis = true; continue; }
    const air = e.cls === 'air'; let v = false;
    for (const sp of spotters) { const r = air ? (SPOT[sp.kind] || 3.5) : 3.5; if (Math.abs(sp.x - e.x) < r && Math.hypot(sp.x - e.x, sp.z - e.z) < r) { v = true; break; } }
    e.vis = v;
  }
}
const SAT_PROTO = (() => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.4, .25, .25), M(0xd8dde2), 0, 0, 0, false));
  for (const z of [-.55, .55]) g.add(mesh(new THREE.BoxGeometry(.32, .02, .7), M(0x2a4a7a), 0, 0, z, false));
  g.add(mesh(new THREE.BoxGeometry(.05, .5, .05), M(0x888888), 0, -.3, 0, false));
  g.scale.setScalar(1.4);
  return g;
})();
const sweepMat = new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide });
function activateIceye() {
  progress.support.iceye = supportCd('iceye'); saveProgress();
  const sat = SAT_PROTO.clone(); sat.position.set(-8, 13, H / 2); world.add(sat);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(.8, H + 2).rotateX(-Math.PI / 2), sweepMat); sweep.position.set(-1, .7, H / 2); sweep.visible = false; world.add(sweep);
  sats.push({ sat, sweep, t: 0 });
  sfx('ui'); toast(L('🛰 ICEYE-ylilento – tutkakuva tulossa…', '🛰 ICEYE pass – radar image incoming…'), 'ok', 2000);
  updateSupportUI(true);
}
function updateSats(dt) {
  for (const s of sats) {
    s.t += dt;
    s.sat.position.x = -8 + s.t * 18; s.sat.rotation.x = s.t * .3;
    if (s.t > .6 && !s.swept) {
      s.sweep.visible = true; s.sweep.position.x = -1 + (s.t - .6) * 28;
      if (s.sweep.position.x > W + 1) {
        s.swept = true; s.sweep.visible = false;
        iceyeT = iceyeDur();
        for (const e of enemies) if (e.d.static && !e.dead) e.located = true;
        const msgs = [L(`ICEYE: kaikki viholliset näkyvissä ${iceyeDur()} s.`, `ICEYE: all enemies visible for ${iceyeDur()} s.`)];
        if (enemies.some(e => e.d.static && !e.dead)) msgs.push(L('Tykistöpatteri paikannettu.', 'Artillery battery located.'));
        if (specTile >= 0) { specMark.visible = true; specMark.position.set(ix(specTile) + .5, tileTop(specTile) + .08, iz(specTile) + .5); msgs.push(L('Erikoisjoukkojen laskeutumisalue havaittu.', 'Special forces landing zone detected.')); }
        toast('🛰 ' + msgs.join(' '), 'ok', 4000); sfx('coin');
      }
    }
    if (s.t > 2.6) { world.remove(s.sat); world.remove(s.sweep); s.done = true; }
  }
  sats = sats.filter(s => !s.done);
  if (specMark.visible) specMark.material.opacity = .5 + .4 * Math.abs(Math.sin(performance.now() * .005));
}

// ================= ERIKOISJOUKOT SELUSTAAN =================
function pickSpecTile() {
  const f = fields.inf, opts = [];
  for (let z = 0; z < H; z++) for (let x = 9; x < BORDER - 5; x++) {
    const i = idx(x, z);
    if (f.dist[i] >= INF || structs.has(i)) continue;
    if ([...structs.values()].some(st => Math.hypot(st.x - x - .5, st.z - z - .5) < 2.2)) continue;
    opts.push(i);
  }
  return opts.length ? opts[(Math.random() * opts.length) | 0] : -1;
}
let specTile = -1;
const specMark = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
specMark.visible = false; scene.add(specMark);
function spawnSpecialForces() {
  specDone = true; specMark.visible = false;
  let c = specTile; specTile = -1;
  if (c < 0 || structs.has(c)) c = pickSpecTile();
  if (c < 0) return;
  const n = 2 + Math.floor(wave / 4);
  for (let k = 0; k < n; k++) spawnEnemy('spec', c);
  for (const e of enemies.slice(-n)) { e.ox = (Math.random() - .5) * .5; e.oz = (Math.random() - .5) * .5; }
  toast(L('⚠ Erikoisjoukkoja havaittu selustassa!', '⚠ Special forces spotted behind our lines!'), 'warn', 3500);
  sfx('alarm');
}

// ================= PÄÄSILMUKKA =================
function update(dt) {
  if (phase === 'wave') {
    waveTime += dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && queue.length) { spawnEnemy(queue.shift()); spawnTimer = .75; }
    while (barrageTimes.length && barrageTimes[0] <= waveTime) { barrageTimes.shift(); triggerBarrage(); }
  }
  updateVisibility(dt);
  for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
  updateUnits(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateBarrages(dt);
  updateEffects(dt);
  updateDebris(dt);
  if (deer.length) updateDeer(dt);
  updateStrikes(dt);
  updateNukes(dt);
  updateSats(dt);
  if (phase === 'wave') tickSupport(dt);
  enemies = enemies.filter(e => !e.dead);
  if (phase === 'wave' && !specDone && waveTime > 12 + (wave % 3) * 3) spawnSpecialForces();
  if (phase === 'wave' && !queue.length && specDone && !enemies.some(e => !e.d.static) && !barrages.length && !gameOver) endWave();
}

// käynnistys: näytetään ensimmäinen sektori taustalla
genSector(cfg); winter = false; refreshAllTiles(); buildTrees(); buildTown(); buildBorder(); buildSurroundings();
preview = new THREE.Group(); world.add(preview); recomputeFields();
document.body.classList.add('onmap');

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rawDt); last = now;
  if (screen === 'map') return;
  if (screen === 'sector' && running && !paused && !gameOver) for (let k = 0; k < speed; k++) update(dt);
  else if (screen === 'sector' && deer.length && !paused) updateDeer(dt);
  updateHUD(false);
  if (screen === 'sector' && !paused) envStep(dt);
  waterTex.offset.x = (now * .00002) % 1; waterTex.offset.y = (now * .000013) % 1;
  countdownTick(rawDt);
  if (screen === 'sector' && (now - supportUiT > 250)) { supportUiT = now; updateSupportUI(); }
  if (snow.visible && !paused) { const a = snowGeo.attributes.position.array; for (let k = 1; k < a.length; k += 3) { a[k] -= dt * 2.2; a[k - 1] -= dt * .8; if (a[k] < 0) { a[k] = 9; a[k - 1] = -4 + Math.random() * (W + 8); } } snowGeo.attributes.position.needsUpdate = true; }
  if (screen === 'sector') tutorialTick();
  const t = controls.target, cx = clamp(t.x, -4, W + 1), cz = clamp(t.z, -1, H + 1);
  camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.x = cx; t.z = cz;
  controls.update();
  let sx = 0, sy = 0;
  if (shake > 0) { const a = shake * .25; sx = (Math.random() - .5) * a; sy = (Math.random() - .5) * a; camera.position.x += sx; camera.position.y += sy; }
  if (composer) composer.render(); else renderer.render(scene, camera);
  camera.position.x -= sx; camera.position.y -= sy;
}
requestAnimationFrame(frame);
