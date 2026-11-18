import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SECTORS, FIN_OUTLINE, BORDER_LINE, CITIES } from './sectors.js';
import { ICONS } from './icons.js';

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
  mg:       { name: 'Konekivääriasema', short: 'KK', cost: 100, range: 3.5, interval: 0.18, dmg: 5, mult: [1, .3, .05, .6], hp: 80, ground: true, air: true, desc: 'Halpa. Tehokas jalkaväkeä vastaan, ampuu myös lennokkeja.' },
  mortar:   { name: 'Raskas kranaatinheitin', short: 'KRH', cost: 200, range: 6.5, minRange: 1.5, interval: 3.2, dmg: 45, splash: 1.2, mult: [1, .5, .25, 0], hp: 90, ground: true, desc: 'Pitkä kantama ja aluevaikutus. Ei ammu aivan lähelle.' },
  atgm:     { name: 'Panssarintorjuntaohjus', short: 'PST', cost: 250, range: 5, interval: 2.6, dmg: 140, mult: [.4, 1, 1, 0], hp: 90, ground: true, desc: 'Tuhoaa panssarivaunuja ja BMP:itä.' },
  aa:       { name: 'Ilmatorjunta', short: 'IT', cost: 180, range: 5, interval: 0.25, dmg: 9, mult: [0, 0, 0, 1], hp: 80, air: true, desc: 'Ampuu vain lennokkeja – ne iskevät asemiisi.' },
  obstacle: { name: 'Hammaskivet', short: 'Este', cost: 30, passive: true, desc: 'Pysäyttää ajoneuvot, hidastaa jalkaväkeä. Voi asettaa tielle.' },
  mine:     { name: 'Panssarimiinoite', short: 'Miina', cost: 60, passive: true, charges: 3, dmg: 160, desc: 'Räjähtää ajoneuvon alla (3 kertaa). Ei estä kulkua.' },
};
const TOWERS = new Set(['mg', 'mortar', 'atgm', 'aa']);
const EDEF = {
  inf:   { name: 'Jalkaväki', hp: 60, speed: 1.0, armor: 0, cls: 'inf', reward: 8, leak: 1, atk: { range: 1.8, dmg: 2.5, interval: 2 } },
  bmp:   { name: 'BMP', hp: 240, speed: 1.5, armor: 1, cls: 'veh', reward: 22, leak: 2, atk: { range: 3, dmg: 6, interval: 1.2 } },
  tank:  { name: 'Panssarivaunu', hp: 650, speed: 0.9, armor: 2, cls: 'veh', reward: 55, leak: 4, atk: { range: 4, dmg: 30, interval: 3.5 } },
  drone: { name: 'Lennokki', hp: 28, speed: 2.6, armor: 3, cls: 'air', reward: 14, leak: 1, kamikaze: 40 },
};
const FORT_HP = [1, 2, 3.5], FORT_RED = [0, .3, .5], FORT_COST = [90, 170];
const FORT_NAME = ['Ei linnoitettu', 'Hiekkasäkit', 'Betonibunkkeri'];
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
const TERRAIN_NAME = ['pelto', 'metsä', 'tie', 'suo', 'järvi', 'tunturi', 'meri'];

// ================= TILA =================
let cfg = SECTORS[0], PAL = PAL_BASE, battleWaves = 10;
let screen = 'intro';
let winter = false, money = 650, lives = 20, wave = 0, phase = 'build', speed = 1;
let paused = false, gameOver = false, running = false, endless = false;
let tool = null, selected = null, pendingTile = -1, barrageWarned = false, deerWarned = false, leaveArmed = 0;
const structs = new Map();
const rubble = new Map();
let enemies = [], projectiles = [], effects = [], barrages = [], queue = [], barrageTimes = [], deer = [];
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
  return { v: 2, week: 1, threat, resil: MAX_RESIL, wins: 0, losses: 0, held: {}, best: {}, report: ['Vihollinen keskittää joukkoja Vaalimaan suunnalle. Puolusta Kaakkois-Suomea!'], over: null, support: { f35: 0, himars: 0 } };
}
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) progress = s; } catch (e) { /* ei tallennusta */ }
if (!progress) progress = newCampaign();
function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ohitetaan */ } }
const threatOf = id => progress.threat[id] || 0;
const levelOf = t => t >= RED ? 'red' : t >= YELLOW ? 'yellow' : 'calm';
const LEVEL = {
  red:    { col: '#e5383b', label: 'KIIREELLINEN', text: 'Suurhyökkäys käynnissä', badge: '!!' },
  yellow: { col: '#ffc531', label: 'Uhka kasvaa', text: 'Vihollinen tunnustelee rajaa', badge: '!' },
  calm:   { col: '#9aa7b2', label: 'Rauhallinen', text: 'Ei välitöntä uhkaa', badge: '' },
};
const wavesFor = (s, t) => t >= RED ? s.waves : 6;
let battleResolved = false;
// Taistelun tulos -> viikko kuluu, muiden sektoreiden uhka kasvaa
function resolveBattle(id, win) {
  if (battleResolved || progress.over) return;
  battleResolved = true;
  const s = SECTORS.find(x => x.id === id);
  const rep = [];
  if (win) {
    progress.wins++; progress.held[id] = (progress.held[id] || 0) + 1;
    progress.threat[id] = Math.round(Math.random() * 10);
    rep.push(`✓ ${s.name}: hyökkäys torjuttu. Sektori rauhoittui.`);
  } else {
    progress.losses++; progress.resil--;
    progress.threat[id] = 85;
    rep.push(`✗ ${s.name}: puolustus murtui (kestävyys −1). Vihollinen jatkaa painostusta.`);
  }
  for (const o of SECTORS) {
    if (o.id === id) continue;
    const before = threatOf(o.id);
    if (before >= RED) {
      progress.resil--;
      rep.push(`⚠ ${o.name}: hyökkäykseen ei vastattu – vihollinen eteni (kestävyys −1).`);
    }
    const inc = Math.round((5 + Math.random() * 12) * (AGG[o.id] || 1) * (1 + progress.week * .05));
    const after = Math.min(100, before + inc);
    progress.threat[o.id] = after;
    if (levelOf(before) !== levelOf(after)) {
      if (levelOf(after) === 'red') rep.push(`🔴 ${o.name}: hyökkäys alkaa – KIIREELLINEN!`);
      else if (levelOf(after) === 'yellow') rep.push(`🟡 ${o.name}: vihollisen toiminta lisääntyy.`);
    }
  }
  // aina vähintään yksi uhattu sektori
  if (!SECTORS.some(o => threatOf(o.id) >= YELLOW)) {
    const o = SECTORS.filter(x => x.id !== id).sort((a, b) => threatOf(b.id) - threatOf(a.id))[0];
    progress.threat[o.id] = YELLOW + 5; rep.push(`🟡 ${o.name}: vihollisen toiminta lisääntyy.`);
  }
  progress.resil = Math.max(0, progress.resil);
  progress.week++;
  if (progress.resil <= 0) { progress.over = 'lost'; rep.push('Valtakunnan puolustuskestävyys loppui.'); }
  else if (progress.week > CAMPAIGN_WEEKS) { progress.over = 'won'; rep.push('Talvi on ohi – itäraja piti!'); }
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
    for (const e of enemies) if (!e.dead && e.cls === cls && fc[e.cur] >= INF) return false;
  }
  return true;
}

// ================= SCENE =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKY = [0x9fc4dd, 0xc3d2dc];
scene.background = new THREE.Color(SKY[0]);
scene.fog = new THREE.Fog(SKY[0], 45, 90);
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

scene.add(new THREE.HemisphereLight(0xe4f0ff, 0x4a5a3a, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(W / 2 + 10, 28, H / 2 - 10);
sun.target.position.set(W / 2, 0, H / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const MAT = {
  base: M(0x8d99a3), fin: M(0x4e6878), dark: M(0x2f3a42), metal: M(0x6c757d), stone: M(0xb9b6ab),
  sand: M(0xb59f6b), concrete: M(0x9ea3a6), mine: M(0x4b4a3a), warn: M(0xffcc33), white: M(0xf4f6f8), blue: M(0x1d4f9c),
  enemy: M(0x34363a), enemy2: M(0x4a4c50), accent: M(0xff8a1f), inf: M(0x5b5848), rubble: M(0x3b3b3b),
  house: M(0xc9b08a), roof: M(0x7a3e2e), flatRoof: M(0x5b6066), street: M(0x55585c), houseB: M(0xdcd6c8), houseR: M(0x8e3b2c),
  deer: M(0x7a6a58), deerL: M(0xe8e1d4), antler: M(0xcdbf9f),
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
const treeGeo = new THREE.ConeGeometry(.17, .6, 5); treeGeo.translate(0, .3, 0);
let trees = null; const treeOf = new Map(); const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
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
  const a = label('SUOMI'); a.position.set(BORDER - 3, 1.6, -1); world.add(a);
  const b = label('VENÄJÄ'); b.position.set(BORDER + 3, 1.6, -1); world.add(b);
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
const towerRange = (def, lvl, i) => def.range + .5 * (lvl - 1) + (terr[i] === FELL ? 1 : 0);

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
  } else if (kind === 'obstacle') {
    const c = new THREE.ConeGeometry(.15, .32, 4);
    for (const [x, z] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22], [0, 0]]) g.add(mesh(c, MAT.stone, x, .16, z));
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
function boom(x, y, z, r, color = 0xffa040) {
  const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
  m.position.set(x, y, z); m.scale.setScalar(r * .2); world.add(m);
  effects.push({ obj: m, t: .45, T: .45, r, kind: 'boom' });
  if (r > .3) shockwaves.push({ x, z, r: r * 2.5 });
}
function puff(p) {
  const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xbfbfbf, transparent: true, opacity: .5, depthWrite: false }));
  m.position.copy(p); m.scale.setScalar(.05); world.add(m);
  effects.push({ obj: m, t: .5, T: .5, r: .12, kind: 'boom' });
}
function tracer(a, b, color, life = .07) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true }));
  world.add(l); effects.push({ obj: l, t: life, T: life, kind: 'fade' });
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
  if (i < 0) return 'Kartan ulkopuolella';
  if (ix(i) >= BORDER) return 'Rakentaa voi vain Suomen puolelle';
  if (structs.has(i)) return 'Ruutu on jo käytössä';
  if (terr[i] === LAKE) return 'Järveen ei voi rakentaa';
  if (terr[i] === SEA) return 'Mereen ei voi rakentaa';
  if (money < DEFS[kind].cost) return 'Rahat eivät riitä';
  if (kind !== 'mine') {
    for (const e of enemies) {
      if (e.dead || e.cls === 'air') continue;
      if (e.cur === i || e.next === i || Math.hypot(e.x - ix(i) - .5, e.z - iz(i) - .5) < .8) return 'Vihollinen on ruudussa';
    }
    if (!pathOk(kind, i)) return 'Vihollisen reittiä ei saa sulkea kokonaan';
  }
  return null;
}
function build(kind, i) {
  const def = DEFS[kind];
  if (terr[i] === FOREST) { terr[i] = FIELD; clearTrees(i); refreshTile(i); tiles.instanceMatrix.needsUpdate = true; tiles.instanceColor.needsUpdate = true; }
  if (rubble.has(i)) { world.remove(rubble.get(i)); rubble.delete(i); }
  const s = { kind, def, i, x: ix(i) + .5, z: iz(i) + .5, lvl: 1, fort: 0, cd: 0, dead: false, charges: def.charges || 0, spent: def.cost };
  s.maxHp = def.hp || 0; s.hp = s.maxHp;
  s.group = makeStructMesh(kind); s.group.position.set(s.x, tileTop(i), s.z); world.add(s.group);
  if (def.hp) { s.bar = makeBar(.7, BAR_T); s.bar.root.position.y = 1; s.bar.root.visible = false; s.group.add(s.bar.root); }
  structs.set(i, s);
  money -= def.cost;
  for (const d of deer) if (Math.floor(d.x) === ix(i) && Math.floor(d.z) === iz(i) && TOWERS.has(kind)) { d.state = 'flee'; d.t = 1; d.fx = d.x - s.x || .5; d.fz = d.z - s.z || .5; d.x += d.fx * .3; d.z += d.fz * .3; }
  if (!def.passive || kind === 'obstacle') recomputeFields();
  return s;
}
function calcMaxHp(s) { return s.def.hp * FORT_HP[s.fort] * (1 + .2 * (s.lvl - 1)); }
function hurtStruct(s, dmg) {
  if (s.dead || !s.def.hp) return;
  s.hp -= dmg * (1 - FORT_RED[s.fort]);
  if (s.hp <= 0) { destroyStruct(s, true); return; }
  s.bar.root.visible = true; s.bar.set(s.hp / s.maxHp);
  if (selected === s) refreshPanel();
}
function destroyStruct(s, byEnemy) {
  if (s.dead) return;
  s.dead = true; world.remove(s.group); structs.delete(s.i);
  if (byEnemy) {
    boom(s.x, tileTop(s.i) + .3, s.z, .8);
    toast(`${s.def.name} tuhoutui!`, 'warn');
    if (TOWERS.has(s.kind)) {
      const r = new THREE.Group(); r.position.set(s.x, tileTop(s.i), s.z);
      for (let k = 0; k < 4; k++) { const b = mesh(new THREE.BoxGeometry(.18, .08, .14), MAT.rubble, (Math.random() - .5) * .5, .04, (Math.random() - .5) * .5); b.rotation.y = Math.random() * 3; r.add(b); }
      world.add(r); rubble.set(s.i, r);
    }
  }
  if (selected === s) select(null);
  if (s.kind !== 'mine') recomputeFields();
}

// ================= VIHOLLISET =================
function spawnEnemy(type) {
  const d = EDEF[type];
  const e = {
    type, d, cls: d.cls, armor: d.armor, hp: d.hp * hpMult, maxHp: d.hp * hpMult,
    speed: d.speed * (.92 + Math.random() * .16), dead: false, atkCd: Math.random() * 1.5,
    ox: (Math.random() - .5) * .3, oz: (Math.random() - .5) * .3, rot: Math.PI, tgt: null,
  };
  if (e.cls === 'air') {
    e.x = W + .5; e.z = 1 + Math.random() * (H - 2); e.y = 1.8; e.ox = e.oz = 0;
  } else {
    const f = fields[e.cls];
    let list = spawns[e.cls].filter(i => f.dist[i] < INF); if (!list.length) list = spawns[e.cls];
    if (!list.length) return;
    const s = list[(Math.random() * list.length) | 0];
    e.cur = s; e.next = s; e.x = W + .3; e.z = iz(s) + .5; e.y = tileTop(s);
  }
  e.mesh = proto[type].clone(); e.turret = e.mesh.getObjectByName('t');
  e.bar = makeBar(type === 'tank' ? .6 : .45, BAR_E); e.bar.root.position.y = type === 'drone' ? .3 : .6; e.bar.root.visible = false;
  e.mesh.add(e.bar.root);
  world.add(e.mesh); enemies.push(e);
}
function hurt(e, dmg, mult) {
  if (e.dead) return; const m = mult[e.armor]; if (!m) return;
  e.hp -= dmg * m;
  if (e.hp <= 0) { kill(e); money += e.d.reward; boom(e.x, e.y + .2, e.z, e.type === 'tank' ? .7 : .4); }
  else { e.bar.root.visible = true; e.bar.set(e.hp / e.maxHp); }
}
function kill(e) { e.dead = true; world.remove(e.mesh); }
function leak(e) {
  kill(e); lives = Math.max(0, lives - e.d.leak);
  const fl = $('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
  if (lives <= 0) endGame(false);
}
function nearestTower(x, z, range) {
  let best = null, bd = range;
  for (const s of structs.values()) {
    if (s.dead || !TOWERS.has(s.kind)) continue;
    const d = Math.hypot(s.x - x, s.z - z); if (d <= bd) { bd = d; best = s; }
  }
  return best;
}
function updateEnemy(e, dt) {
  const d = e.d;
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
        if (e.turret) e.turret.rotation.y = -Math.atan2(s.z - e.z, s.x - e.x) - e.rot;
        hurtStruct(s, d.atk.dmg * dmgMult);
      } else e.atkCd = .3;
    }
  }
  e.mesh.position.set(e.x + e.ox, e.y + (e.type === 'inf' ? Math.abs(Math.sin(performance.now() * .012 + e.ox * 40)) * .02 : 0), e.z + e.oz);
  e.mesh.rotation.y = e.rot;
}
function enterTile(e) {
  const s = structs.get(e.cur);
  if (s && s.kind === 'mine' && e.cls === 'veh') {
    boom(e.x, e.y + .1, e.z, .9);
    hurt(e, DEFS.mine.dmg, [0, 1, 1, 0]);
    s.charges--;
    if (s.charges <= 0) destroyStruct(s, false); else if (selected === s) refreshPanel();
  }
}

// ================= TORNIT =================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function updateTowers(dt) {
  for (const s of structs.values()) {
    if (!TOWERS.has(s.kind)) continue;
    const d = s.def, L = s.lvl;
    const range = towerRange(d, L, s.i), dmg = d.dmg * (1 + .45 * (L - 1)), interval = d.interval * (1 - .1 * (L - 1));
    if (s.group.userData.radar) s.group.userData.radar.rotation.y += dt * 2.5;
    s.cd -= dt;
    let tgt = null, tp = INF;
    for (const e of enemies) {
      if (e.dead) continue; const air = e.cls === 'air';
      if (air && !d.air) continue; if (!air && !d.ground) continue; if (!d.mult[e.armor]) continue;
      const dist = Math.hypot(e.x - s.x, e.z - s.z);
      if (dist > range || (d.minRange && dist < d.minRange)) continue;
      const p = air ? e.x * 1.2 : fields[e.cls].dist[e.cur];
      if (p < tp) { tp = p; tgt = e; }
    }
    if (!tgt) continue;
    const t = s.group.userData.turret;
    t.rotation.y = lerpAngle(t.rotation.y, -Math.atan2(tgt.z - s.z, tgt.x - s.x), dt * 12);
    if (s.cd > 0) continue;
    s.cd = interval;
    const top = tileTop(s.i), muzzle = V(s.x, top + .38, s.z);
    const tpos = V(tgt.x + tgt.ox, tgt.y + (tgt.cls === 'air' ? 0 : .15), tgt.z + tgt.oz);
    if (s.kind === 'mg' || s.kind === 'aa') {
      tracer(muzzle, tpos, s.kind === 'aa' ? 0xbfe6ff : 0xfff1a8);
      hurt(tgt, dmg, d.mult);
    } else if (s.kind === 'mortar') {
      const m = mesh(new THREE.SphereGeometry(.06, 5, 4), MAT.dark, muzzle.x, muzzle.y, muzzle.z, false); world.add(m);
      const dist = Math.hypot(tpos.x - s.x, tpos.z - s.z);
      projectiles.push({ kind: 'shell', mesh: m, from: muzzle, to: V(tgt.x, tgt.y, tgt.z), t: 0, T: 1 + dist * .08, h: 1.5 + dist * .15, dmg, splash: d.splash, mult: d.mult });
      boom(muzzle.x, muzzle.y + .1, muzzle.z, .2, 0xfff1a8);
    } else if (s.kind === 'atgm') {
      const m = mesh(new THREE.CylinderGeometry(.025, .025, .18, 5).rotateZ(Math.PI / 2), MAT.white, muzzle.x, muzzle.y, muzzle.z, false); world.add(m);
      projectiles.push({ kind: 'missile', mesh: m, pos: muzzle.clone(), target: tgt, last: tpos, dmg, mult: d.mult, puffT: 0 });
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
        for (const e of enemies) {
          if (e.dead || e.cls === 'air') continue;
          const dd = Math.hypot(e.x - p.to.x, e.z - p.to.z);
          if (dd < p.splash) hurt(e, p.dmg * (1 - dd / p.splash * .5), p.mult);
        }
      }
    } else {
      if (!p.target.dead) p.last.set(p.target.x + p.target.ox, p.target.y + .15, p.target.z + p.target.oz);
      const dir = p.last.clone().sub(p.pos); const dist = dir.length(); const st = 7 * dt;
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
  const towers = [...structs.values()].filter(s => TOWERS.has(s.kind));
  if (!towers.length) return;
  const s = towers[(Math.random() * towers.length) | 0];
  const x = s.x + (Math.random() - .5) * 1.2, z = s.z + (Math.random() - .5) * 1.2;
  const r = new THREE.Mesh(barrageGeo, new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
  r.position.set(x, tileTop(s.i) + .08, z); r.scale.setScalar(1.3); world.add(r);
  barrages.push({ x, z, t: 2.2, ring: r });
  if (!barrageWarned) { barrageWarned = true; toast('Vihollisen tykistö ampuu asemiasi! Linnoita ne.', 'warn'); }
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
    inf: Math.round((5 + n * 2.2) * m.inf),
    bmp: n >= 2 ? Math.round(n * .9 * m.bmp) : 0,
    tank: n >= 4 ? Math.round((n - 2) * .6 * m.tank) : 0,
    drone: n >= 3 ? Math.round((n - 1) * .8 * m.drone) : 0,
  };
}
function startWave() {
  if (phase !== 'build' || gameOver) return;
  wave++; phase = 'wave'; waveTime = 0; spawnTimer = 0;
  hpMult = 1 + .14 * (wave - 1); dmgMult = 1 + .06 * (wave - 1);
  const c = waveComp(wave), items = [];
  const W8 = { inf: 0, bmp: .35, tank: .6, drone: Math.random() };
  for (const [t, n] of Object.entries(c)) for (let k = 0; k < n; k++) items.push({ t, key: Math.random() + (t === 'drone' ? Math.random() : W8[t]) });
  items.sort((a, b) => a.key - b.key); queue = items.map(i => i.t);
  if (!spawns.veh.length) queue = queue.filter(t => EDEF[t].cls !== 'veh');
  barrageTimes = [];
  if (wave >= 5) for (let k = 0; k < Math.floor((wave - 3) / 2); k++) barrageTimes.push(3 + Math.random() * 20);
  barrageTimes.sort((a, b) => a - b);
  preview.visible = false;
  select(null);
  updateHUD(true);
}
function endWave() {
  phase = 'build';
  const bonus = 80 + 15 * wave; money += bonus;
  progress.best[cfg.id] = Math.max(progress.best[cfg.id] || 0, wave); saveProgress();
  toast(`Aalto ${wave} torjuttu! +${bonus} €`, 'ok');
  if (wave === battleWaves && !endless) { endGame(true); }
  const w = seasonOf(wave + 1);
  if (w !== winter) setWinter(w, true);
  preview.visible = true; updateHUD(true);
}
function setWinter(w, announce) {
  winter = w;
  refreshAllTiles(); colorTrees();
  for (const s of structs.values()) s.group.position.y = tileTop(s.i);
  for (const [ri, r] of rubble) r.position.y = tileTop(ri);
  applyTownWinter();
  scene.background.setHex(SKY[w ? 1 : 0]); scene.fog.color.setHex(SKY[w ? 1 : 0]);
  recomputeFields();
  if (announce) toast(w ? '❄️ Talvi saapui – järvet ja suot jäätyivät. Panssarit pääsevät jäitä pitkin!' : '☀️ Sulan maan aika – jäät sulivat, järvet ja suot ovat taas esteitä.', 'info', 5000);
}
function endGame(win) {
  gameOver = true; const o = $('overlay'); o.hidden = false;
  const first = !battleResolved;
  resolveBattle(cfg.id, win);
  const rep = first ? `<ul class="report">${progress.report.map(r => `<li>${r}</li>`).join('')}</ul>` : '';
  o.querySelector('.box').innerHTML = win
    ? `<h2>🇫🇮 ${cfg.name} pitää!</h2><p>Torjuit kaikki ${battleWaves} aaltoa. ${cfg.city} on turvassa. Puolustuskykyä jäljellä ${lives}/20.</p><h3>Tilannekatsaus</h3>${rep}<div class="row2"><button class="primary" id="mapBtn2">🗺 Takaisin kartalle</button>${first ? '<button id="contBtn">Jatka loputtomasti</button>' : ''}</div>`
    : `<h2>Puolustus murtui</h2><p>Kestit ${Math.max(0, wave - 1)} aaltoa. Vihollinen pääsi ${cfg.cityIn}.</p><h3>Tilannekatsaus</h3>${rep}<div class="row2"><button class="primary" id="mapBtn2">🗺 Takaisin kartalle</button></div>`;
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
function loadSector(id) {
  cfg = SECTORS.find(s => s.id === id) || SECTORS[0];
  battleWaves = wavesFor(cfg, threatOf(cfg.id)); battleResolved = false;
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  structs.clear(); rubble.clear();
  strikes = []; supportMode = null; pendingStrike = -1; strikeRing.visible = strikeDisk.visible = false;
  enemies = []; projectiles = []; effects = []; barrages = []; queue = []; barrageTimes = []; deer = []; shockwaves = [];
  money = cfg.money; lives = 20; wave = 0; phase = 'build'; speed = 1; paused = false; gameOver = false; endless = false;
  tool = null; selected = null; pendingTile = -1; barrageWarned = false; deerWarned = false; leaveArmed = 0;
  genSector(cfg);
  winter = seasonOf(1);
  refreshAllTiles();
  buildTrees();
  buildTown();
  buildBorder();
  scene.background.setHex(SKY[winter ? 1 : 0]); scene.fog.color.setHex(SKY[winter ? 1 : 0]);
  preview = new THREE.Group(); world.add(preview);
  if (cfg.reindeer) spawnDeer(cfg.reindeer);
  recomputeFields();
  setTool(null); select(null);
  hl.visible = ring.visible = ringIn.visible = false;
  resetCamera();
  screen = 'sector'; running = true;
  document.body.classList.remove('onmap');
  $('mapScreen').hidden = true;
  $('sectorName').textContent = cfg.name;
  updateHUD(true);
  toast(`${cfg.name}: puolusta ${cfg.cityTo} – ${battleWaves} aaltoa${battleWaves === cfg.waves ? ' (suurhyökkäys)' : ' (tunnusteluisku)'}.`, 'info', 4000);
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
  h += `<text x="${rx}" y="${ry}" class="mlabel big" text-anchor="middle">VENÄJÄ</text>`;
  const [fx, fy] = proj(25.6, 63.4);
  h += `<text x="${fx}" y="${fy}" class="mlabel big" text-anchor="middle" fill-opacity=".5">SUOMI</text>`;
  for (const c of CITIES) {
    const [x, y] = proj(c.lon, c.lat);
    h += c.capital ? `<text x="${x}" y="${y + 4}" text-anchor="middle" class="star">★</text>` : `<circle cx="${x}" cy="${y}" r="3" fill="#f2f5f7"/>`;
    h += `<text x="${x - 6}" y="${y + 4}" class="mlabel" text-anchor="end">${c.name}</text>`;
  }
  for (const s of SECTORS) {
    const pts = clipBorder(s.lat[0], s.lat[1]);
    const lv = levelOf(threatOf(s.id)), L = LEVEL[lv], sel = s.id === mapSel;
    if (lv !== 'calm') {
      const [ax, ay] = proj(...s.crossing), [bx, by] = proj(...s.target);
      const mx = ax + (bx - ax) * .8, my = ay + (by - ay) * .8;
      h += `<line x1="${ax + 6}" y1="${ay}" x2="${mx}" y2="${my}" stroke="${L.col}" stroke-width="${lv === 'red' ? 3.5 : 2.2}" stroke-dasharray="${lv === 'red' ? '7 4' : '4 5'}" marker-end="url(#${lv === 'red' ? 'arrR' : 'arrY'})" class="${lv === 'red' ? 'pulse' : ''}"/>`;
    }
    if (sel) h += `<polyline points="${pstr(pts)}" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>`;
    h += `<polyline points="${pstr(pts)}" fill="none" stroke="${L.col}" stroke-width="${sel ? 9 : 7}" stroke-linecap="round" stroke-linejoin="round" class="${lv === 'red' ? 'pulse' : ''}"/>`;
    h += `<polyline points="${pstr(pts)}" fill="none" stroke="transparent" stroke-width="34" class="hit" data-id="${s.id}"/>`;
    const [mx, my] = proj(...s.crossing);
    h += `<g class="hit" data-id="${s.id}"><circle cx="${mx + 16}" cy="${my}" r="${sel ? 13 : 11}" fill="${L.col}" stroke="${sel ? '#fff' : '#0d141b'}" stroke-width="2"/>`;
    h += `<text x="${mx + 16}" y="${my + 4.5}" text-anchor="middle" class="num">${L.badge || s.no}</text>`;
    h += `<text x="${mx + 32}" y="${my + 4}" class="mlabel sec">${s.short}</text></g>`;
  }
  svg.innerHTML = h;
  svg.querySelectorAll('.hit').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.id, isMarker = el.tagName.toLowerCase() === 'g';
    // toinen napautus jo valitun uhatun sektorin palloon -> suoraan taisteluun
    if (isMarker && id === mapSel && mapTapId === id && !progress.over && levelOf(threatOf(id)) !== 'calm') { mapTapId = null; loadSector(id); return; }
    mapTapId = isMarker ? id : null;
    mapSel = id; buildMap(); renderBrief();
  }));
}
function seasonRange(arr, n) {
  const w = arr.filter(x => x <= n);
  if (!w.length) return 'ei talvea';
  return `aallot ${w[0]}–${w[w.length - 1]}`;
}
function renderBrief() {
  const p = progress;
  if (p.over) {
    $('brief').innerHTML = `<div class="prog"><b class="brand">SALPA</b> · Kampanja päättyi</div>
      <h2>${p.over === 'won' ? '🇫🇮 Itäraja piti!' : 'Puolustus romahti'}</h2>
      <p>${p.over === 'won' ? `Kestit ${CAMPAIGN_WEEKS} viikkoa. Torjuttuja hyökkäyksiä ${p.wins}, menetettyjä taisteluita ${p.losses}.` : `Valtakunnan puolustuskestävyys loppui viikolla ${p.week - 1}. Torjuttuja hyökkäyksiä ${p.wins}.`}</p>
      <ul class="report">${p.report.map(r => `<li>${r}</li>`).join('')}</ul>
      <button class="primary big" id="newCampBtn">Uusi kampanja ▶</button>`;
    $('newCampBtn').onclick = () => { progress = newCampaign(); saveProgress(); mapSel = mostUrgent(); buildMap(); renderBrief(); };
    return;
  }
  const s = SECTORS.find(x => x.id === mapSel);
  const t = threatOf(s.id), lv = levelOf(t), L = LEVEL[lv], waves = wavesFor(s, t);
  const reds = SECTORS.filter(x => levelOf(threatOf(x.id)) === 'red').length;
  const hearts = '♥'.repeat(p.resil) + '♡'.repeat(MAX_RESIL - p.resil);
  $('brief').innerHTML = `
    <div class="prog"><b class="brand">SALPA</b> · Viikko <b>${p.week}/${CAMPAIGN_WEEKS}</b> · Kestävyys <span class="hearts">${hearts}</span></div>
    ${p.report.length ? `<div class="sitrep"><b>Tilannekatsaus</b><ul class="report">${p.report.map(r => `<li>${r}</li>`).join('')}</ul></div>` : ''}
    <h2><span class="no" style="background:${L.col}">${L.badge || s.no}</span> ${s.name}</h2>
    <div class="sub">${s.area} · puolustettava: <b>${s.city}</b></div>
    <div class="threat ${lv}"><div class="tl"><b>${L.label}</b><span>${L.text}</span></div>
      <div class="bar"><i style="width:${t}%;background:${L.col}"></i></div></div>
    <p>${s.desc}</p>
    <ul class="facts">${s.facts.map(f => `<li>${f}</li>`).join('')}
      <li>❄️ Talvi: ${seasonRange(s.winter, waves)}</li>
      ${s.reindeer ? `<li>🦌 Poroja maastossa – ne hidastavat vihollisen ajoneuvoja</li>` : ''}
    </ul>
    <div class="row"><span>Taistelu</span><b>${lv === 'calm' ? '–' : `${waves} aaltoa${lv === 'red' ? ' (suurhyökkäys)' : ' (tunnusteluisku)'}`}</b></div>
    <div class="row"><span>Aloitusbudjetti</span><b>${s.money} €</b></div>
    <div class="row"><span>Torjuttu täällä</span><b>${p.held[s.id] || 0}×</b></div>
    <button class="primary big" id="goBtn" ${lv === 'calm' ? 'disabled' : ''}>${lv === 'calm' ? 'Ei hyökkäystä – valitse uhattu sektori' : 'Puolusta sektoria ▶'}</button>
    ${lv !== 'calm' ? '<div class="tip">Vinkki: napauta kartalla sektorin palloa uudelleen, niin pääset suoraan taisteluun.</div>' : ''}
    ${reds > 1 ? `<p class="warn">⚠ ${reds} sektoria on kiireellisiä. Jokainen viikko, jonka kiireellinen sektori jää ilman puolustusta, vie kestävyyttä.</p>` : reds === 1 && lv !== 'red' ? `<p class="warn">⚠ Kiireellinen sektori jää ilman puolustusta, jos taistelet täällä – kestävyys −1.</p>` : ''}
    <div class="secList">${SECTORS.map(x => { const l = levelOf(threatOf(x.id)); return `<button data-id="${x.id}" class="${x.id === mapSel ? 'sel' : ''} lv-${l}"><i style="background:${LEVEL[l].col}"></i>${LEVEL[l].badge ? LEVEL[l].badge + ' ' : ''}${x.short}</button>`; }).join('')}</div>
    <button class="ghost" id="resetCampBtn">Aloita kampanja alusta</button>`;
  $('goBtn').onclick = () => { if (lv !== 'calm') loadSector(s.id); };
  $('brief').querySelectorAll('.secList button').forEach(b => b.onclick = () => { mapSel = b.dataset.id; buildMap(); renderBrief(); });
  $('resetCampBtn').onclick = () => {
    if (performance.now() - resetArmed > 3000) { resetArmed = performance.now(); $('resetCampBtn').textContent = 'Varmasti? Napauta uudelleen'; return; }
    progress = newCampaign(); saveProgress(); mapSel = mostUrgent(); buildMap(); renderBrief();
  };
}
function showMap() {
  screen = 'map'; running = false;
  mapSel = mostUrgent(); mapTapId = null;
  setTool(null); select(null);
  document.body.classList.add('onmap');
  $('mapScreen').hidden = false; $('overlay').hidden = true;
  buildMap(); renderBrief();
}

// ================= UI =================
function toast(msg, kind = 'info', ms = 3200) {
  const d = document.createElement('div'); d.className = `toast panel ${kind}`; d.textContent = msg;
  d.style.animationDuration = ms + 'ms';
  $('toasts').appendChild(d); setTimeout(() => d.remove(), ms);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
const toolEls = {};
for (const [k, d] of Object.entries(DEFS)) {
  const b = document.createElement('button'); b.className = 'tool';
  b.title = `${d.name} – ${d.cost} €`;
  b.innerHTML = `<span class="ico">${ICONS[k]}</span><span>${(w => w[0].toUpperCase() + w.slice(1))(d.name.split(' ').slice(-1)[0])}</span><small>${d.cost} €</small>`;
  b.onclick = () => setTool(tool === k ? null : k);
  $('tools').appendChild(b); toolEls[k] = b;
}
function setTool(k) {
  if (k && supportMode) { supportMode = null; pendingStrike = -1; strikeRing.visible = strikeDisk.visible = false; }
  tool = k; pendingTile = -1; hl.visible = false; ring.visible = ringIn.visible = false;
  for (const [kk, el] of Object.entries(toolEls)) el.classList.toggle('sel', kk === k);
  if (k) { select(null); $('hint').hidden = false; $('hint').innerHTML = `<span class="hico">${ICONS[k]}</span><b>${DEFS[k].name}</b> – ${DEFS[k].desc}${TOWERS.has(k) ? ' Tunturilla +1 kantama.' : ''}<br><small>${isTouch ? 'Napauta ruutua, napauta uudelleen rakentaaksesi.' : 'Klikkaa ruutua rakentaaksesi. Esc peruu.'}</small>`; }
  else $('hint').hidden = true;
}
function select(s) {
  selected = s;
  if (!s) { $('panel').hidden = true; if (!tool) { ring.visible = ringIn.visible = false; } return; }
  setTool(null); refreshPanel();
  if (TOWERS.has(s.kind)) showRange(s.x, s.z, tileTop(s.i), towerRange(s.def, s.lvl, s.i), s.def.minRange);
  else ring.visible = ringIn.visible = false;
}
function refreshPanel() {
  const s = selected; if (!s) return; const p = $('panel'); p.hidden = false;
  const refund = Math.round(s.spent * .6);
  let html = `<h3><span class="hico">${ICONS[s.kind]}</span>${s.def.name}</h3>`;
  if (TOWERS.has(s.kind)) {
    const up = Math.round(s.def.cost * .8 * s.lvl), fc = FORT_COST[s.fort];
    const rep = Math.ceil((1 - s.hp / s.maxHp) * s.def.cost * .5);
    html += `<div class="row"><span>Taso</span><b>${s.lvl}/3</b></div>
      <div class="row"><span>Kunto</span><b>${Math.ceil(s.hp)}/${Math.round(s.maxHp)}</b></div>
      <div class="row"><span>Linnoitus</span><b>${FORT_NAME[s.fort]}</b></div>
      <div class="row"><span>Vahinko / kantama</span><b>${Math.round(s.def.dmg * (1 + .45 * (s.lvl - 1)))} / ${towerRange(s.def, s.lvl, s.i).toFixed(1)}${terr[s.i] === FELL ? ' ⛰' : ''}</b></div>
      <div class="btns">
        <button data-a="up" ${s.lvl >= 3 || money < up ? 'disabled' : ''}>⬆ Päivitä${s.lvl < 3 ? ` ${up} €` : ''}</button>
        <button data-a="fort" ${s.fort >= 2 || money < fc ? 'disabled' : ''}>🛡 Linnoita${s.fort < 2 ? ` ${fc} €` : ''}</button>
        <button data-a="rep" ${rep <= 0 || money < rep ? 'disabled' : ''}>🔧 Korjaa${rep > 0 ? ` ${rep} €` : ''}</button>
        <button data-a="sell">💰 Myy +${refund} €</button>
      </div>`;
  } else {
    html += `<p>${s.def.desc}</p>${s.kind === 'mine' ? `<div class="row"><span>Miinoja jäljellä</span><b>${s.charges}</b></div>` : ''}
      <div class="btns"><button data-a="sell">💰 Poista +${refund} €</button></div>`;
  }
  html += `<button class="close" data-a="close">✕</button>`;
  p.innerHTML = html;
  p.querySelectorAll('button').forEach(b => b.onclick = () => panelAction(b.dataset.a));
}
function panelAction(a) {
  const s = selected; if (!s) return;
  if (a === 'close') return select(null);
  if (a === 'sell') { money += Math.round(s.spent * .6); destroyStruct(s, false); }
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
  updateHUD(true); if (selected) refreshPanel();
}
let lastHud = '';
function updateHUD(force) {
  if (screen !== 'sector') return;
  const key = `${money}|${lives}|${wave}|${phase}|${winter}|${speed}|${paused}`;
  if (!force && key === lastHud) return;
  const moneyChanged = !lastHud.startsWith(money + '|'); lastHud = key;
  $('money').textContent = money; $('lives').textContent = lives;
  $('wave').textContent = `${wave}/${battleWaves}`;
  $('season').textContent = winter ? '❄️ Talvi' : '☀️ Sula maa';
  $('speedBtn').textContent = speed + '×'; $('pauseBtn').textContent = paused ? '▶' : '⏸';
  const wb = $('waveBtn'); wb.disabled = phase !== 'build';
  wb.textContent = phase === 'build' ? `▶ Aloita aalto ${wave + 1}` : `Aalto ${wave} käynnissä…`;
  for (const [k, el] of Object.entries(toolEls)) el.classList.toggle('poor', money < DEFS[k].cost);
  if (phase === 'build') {
    const c = waveComp(wave + 1), parts = [];
    if (c.inf) parts.push(`${c.inf}× jalkaväki`); if (c.bmp && spawns.veh.length) parts.push(`${c.bmp}× BMP`);
    if (c.tank && spawns.veh.length) parts.push(`${c.tank}× panssarivaunu`); if (c.drone) parts.push(`${c.drone}× lennokki`);
    const art = wave + 1 >= 5 ? ' · tykistötulta odotettavissa' : '';
    $('intel').innerHTML = `<b>Tiedustelu, aalto ${wave + 1}${seasonOf(wave + 1) ? ' (talvi)' : ''}:</b> ${parts.join(', ')}${art}<br><small><span class="lv">━ ━</span> ajoneuvojen reitti &nbsp; <span class="li">┅┅</span> jalkaväen reitit</small>`;
    $('intel').hidden = false;
  } else $('intel').hidden = true;
  if (moneyChanged && selected) refreshPanel();
}
$('waveBtn').onclick = startWave;
$('speedBtn').onclick = () => { speed = speed === 3 ? 1 : speed + 1; updateHUD(true); };
$('pauseBtn').onclick = () => { paused = !paused; updateHUD(true); };
$('camBtn').onclick = resetCamera;
$('leaveBtn').onclick = () => {
  const fighting = !gameOver && !battleResolved && wave > 0;
  if (fighting && performance.now() - leaveArmed > 3000) {
    leaveArmed = performance.now(); toast('Vetäytyminen lasketaan tappioksi (kestävyys −1). Napauta 🗺 uudelleen vetäytyäksesi.', 'warn', 3500); return;
  }
  if (fighting) resolveBattle(cfg.id, false);
  showMap();
};
addEventListener('keydown', e => {
  if (screen !== 'sector') return;
  if (e.key === 'Escape') { setTool(null); select(null); if (supportMode) cancelSupport(); }
  if (e.key === 'f' || e.key === 'F') setSupportMode('f35');
  if (e.key === 'h' || e.key === 'H') setSupportMode('himars');
  if (e.key === ' ') { e.preventDefault(); phase === 'build' ? startWave() : (paused = !paused, updateHUD(true)); }
  const n = parseInt(e.key); if (n >= 1 && n <= 6) setTool(Object.keys(DEFS)[n - 1]);
});

// --- syöte
let isTouch = matchMedia('(pointer: coarse)').matches;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.3), hit = new THREE.Vector3();
function tileAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return -1;
  const x = Math.floor(hit.x), z = Math.floor(hit.z);
  if (x < 0 || z < 0 || x >= W || z >= H) return -1;
  return idx(x, z);
}
function previewTile(i) {
  if (i < 0 || !tool) { hl.visible = false; ring.visible = ringIn.visible = false; return null; }
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
    if (i < 0) { toast('Valitse kohde kartalta.', 'warn', 1500); return; }
    if (isTouch && pendingStrike !== i) { pendingStrike = i; previewStrike(i); return; }
    callStrike(supportMode, i); return;
  }
  if (tool) {
    if (isTouch && pendingTile !== i) { pendingTile = i; const err = previewTile(i); if (err && i >= 0) toast(err, 'warn', 1800); return; }
    const err = i < 0 ? 'Kartan ulkopuolella' : canPlace(tool, i);
    if (err) { toast(err, 'warn', 1800); previewTile(i); return; }
    build(tool, i); pendingTile = -1; previewTile(i); updateHUD(true);
    if (money < DEFS[tool].cost) setTool(null);
  } else {
    select(i >= 0 && structs.has(i) ? structs.get(i) : null);
    if (i >= 0 && !structs.has(i)) {
      const t = terr[i];
      $('hint').hidden = false;
      $('hint').innerHTML = `<b>${TERRAIN_NAME[t][0].toUpperCase() + TERRAIN_NAME[t].slice(1)}</b>${t === FELL ? ' – ajoneuvot eivät pääse, asemat näkevät kauas (+1 kantama)' : t === SWAMP ? (winter ? ' – jäätynyt, kantaa panssarit' : ' – ajoneuvot eivät pääse') : t === LAKE ? (winter ? ' – jäätynyt, kantaa kaiken' : ' – este kaikille') : ''}`;
      clearTimeout(previewTile.tm); previewTile.tm = setTimeout(() => { if (!tool) $('hint').hidden = true; }, 2500);
    }
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
$('startBtn').onclick = () => { $('overlay').hidden = true; showMap(); };
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
  f35:    { name: 'F-35', icon: '✈️', cd: 600, radius: 3.5, key: 'f', desc: 'Hävittäjän täsmäisku: ohjautuvat pommit kohdealueen raskaimpiin ajoneuvoihin ja lennokkien alasampuminen.' },
  himars: { name: 'HIMARS', icon: '🚀', cd: 600, radius: 1.8, key: 'h', desc: 'Raketinheitin: kahdeksan raketin aluetuli. Tuhoaa maalla kaiken kohdealueella.' },
};
if (!progress.support) progress.support = { f35: 0, himars: 0 };
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
  if (phase !== 'wave') { toast('Tulitukea voi tilata vain hyökkäyksen aikana.', 'warn', 2200); return; }
  if (progress.support[k] > 0) { toast(`${SUPPORT[k].name} latautuu vielä ${fmtCd(progress.support[k])}.`, 'warn', 2200); return; }
  setTool(null); select(null);
  supportMode = k; pendingStrike = -1;
  $('hint').hidden = false;
  $('hint').innerHTML = `<span class="hico">${ICONS[k]}</span><b>${SUPPORT[k].name}</b> – ${SUPPORT[k].desc}<br><small>${isTouch ? 'Napauta kohdetta, napauta uudelleen vahvistaaksesi.' : 'Klikkaa kohdetta. Esc peruu.'}</small>`;
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
function fmtCd(s) { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function callStrike(k, i) {
  const x = ix(i) + .5, z = iz(i) + .5;
  progress.support[k] = SUPPORT[k].cd; saveProgress();
  cancelSupport();
  if (k === 'himars') {
    toast('🚀 HIMARS: tulitehtävä vahvistettu – raketit matkalla!', 'ok', 2500);
    for (let n = 0; n < 8; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.5;
      const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
      const m = mesh(new THREE.CylinderGeometry(.035, .035, .32, 5).rotateZ(Math.PI / 2), MAT.white, -6, .6, z, false);
      m.visible = false; world.add(m);
      strikes.push({ kind: 'rocket', mesh: m, from: V(-6, .6, clamp(z + (n - 2.5) * .15, 0, H)), to: V(tx, groundY(tx, tz), tz), t: -n * .14, T: 1.6, h: 5.5, puffT: 0 });
    }
  } else {
    toast('✈️ F-35: täsmäisku tulossa!', 'ok', 2500);
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
          if (d < 1.4) hurt(e, 260 * (1 - d / 1.4 * .4), [1, 1, .85, 0]);
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
          tracer(V(s.x, s.y, s.z), V(e.x, e.y, e.z), 0xbfe6ff, .25); hurt(e, 9999, [0, 0, 0, 1]);
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
  b.title = d.desc;
  b.innerHTML = `<span class="ic">${ICONS[k]}</span><span class="nm">${d.name}</span><span class="st"></span><i class="fill"></i>`;
  b.onclick = () => setSupportMode(k);
  $('support').appendChild(b); supEls[k] = b;
}
function updateSupportUI(force) {
  for (const [k, b] of Object.entries(supEls)) {
    const cd = progress.support[k] || 0, ready = cd <= 0;
    b.classList.toggle('ready', ready && phase === 'wave');
    b.classList.toggle('armed', supportMode === k);
    b.classList.toggle('cooling', !ready);
    b.querySelector('.st').textContent = supportMode === k ? 'VALITSE KOHDE' : ready ? (phase === 'wave' ? 'VALMIS' : 'valmiina') : fmtCd(cd);
    b.querySelector('.fill').style.width = ready ? '100%' : `${(1 - cd / SUPPORT[k].cd) * 100}%`;
  }
}

// ================= PÄÄSILMUKKA =================
function update(dt) {
  if (phase === 'wave') {
    waveTime += dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && queue.length) { spawnEnemy(queue.shift()); spawnTimer = .75; }
    while (barrageTimes.length && barrageTimes[0] <= waveTime) { barrageTimes.shift(); triggerBarrage(); }
  }
  for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateBarrages(dt);
  updateEffects(dt);
  if (deer.length) updateDeer(dt);
  updateStrikes(dt);
  if (phase === 'wave') tickSupport(dt);
  enemies = enemies.filter(e => !e.dead);
  if (phase === 'wave' && !queue.length && !enemies.length && !barrages.length && !gameOver) endWave();
}

// käynnistys: näytetään ensimmäinen sektori taustalla
genSector(cfg); winter = false; refreshAllTiles(); buildTrees(); buildTown(); buildBorder();
preview = new THREE.Group(); world.add(preview); recomputeFields();
document.body.classList.add('onmap');

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (screen === 'map') return;
  if (screen === 'sector' && running && !paused && !gameOver) for (let k = 0; k < speed; k++) update(dt);
  else if (screen === 'sector' && deer.length && !paused) updateDeer(dt);
  updateHUD(false);
  if (screen === 'sector' && (now - supportUiT > 250)) { supportUiT = now; updateSupportUI(); }
  const t = controls.target, cx = clamp(t.x, -4, W + 1), cz = clamp(t.z, -1, H + 1);
  camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.x = cx; t.z = cz;
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
