// Äänet syntetisoidaan WebAudiolla – ei äänitiedostoja.
let ctx = null, master = null, noiseBuf = null, enabled = true;
const last = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? .55 : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}
export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? .55 : 0, ctx.currentTime, .05);
}
export const soundEnabled = () => enabled;

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function noise({ dur = .3, type = 'lowpass', f0 = 800, f1 = f0, q = .7, vol = .4, a = .003, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t, Math.random()); src.stop(t + a + dur + .05);
}
function tone({ f0 = 440, f1 = f0, dur = .2, type = 'sine', vol = .3, a = .005, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + a + dur + .05);
}

const SFX = {
  mg:      () => noise({ dur: .05, type: 'highpass', f0: 1800, vol: .12 }),
  aa:      () => noise({ dur: .04, type: 'bandpass', f0: 2600, q: 2, vol: .1 }),
  amv:     () => noise({ dur: .05, type: 'highpass', f0: 1400, vol: .1 }),
  mortar:  () => { tone({ f0: 140, f1: 60, dur: .25, vol: .35 }); noise({ dur: .15, f0: 900, vol: .15 }); },
  k9:      () => { tone({ f0: 90, f1: 40, dur: .5, vol: .5 }); noise({ dur: .35, f0: 700, f1: 150, vol: .3 }); },
  tankgun: () => { tone({ f0: 110, f1: 45, dur: .35, vol: .45 }); noise({ dur: .25, f0: 1200, f1: 200, vol: .3 }); },
  missile: () => noise({ dur: .6, type: 'bandpass', f0: 500, f1: 2200, q: 1.5, vol: .18, a: .02 }),
  nasams:  () => noise({ dur: .9, type: 'bandpass', f0: 400, f1: 3000, q: 1.2, vol: .22, a: .03 }),
  boomS:   () => { noise({ dur: .3, f0: 900, f1: 120, vol: .25 }); },
  boomL:   () => { noise({ dur: .7, f0: 600, f1: 60, vol: .5 }); tone({ f0: 70, f1: 30, dur: .6, vol: .4 }); },
  enemyFire: () => noise({ dur: .07, type: 'bandpass', f0: 900, q: 1, vol: .06 }),
  tankFire:  () => { tone({ f0: 95, f1: 40, dur: .3, vol: .25 }); noise({ dur: .2, f0: 700, vol: .15 }); },
  whistle: () => tone({ f0: 1400, f1: 500, dur: 1.6, type: 'sine', vol: .08, a: .2 }),
  jet:     () => { noise({ dur: 3.2, type: 'bandpass', f0: 300, f1: 1400, q: .8, vol: .35, a: .9 }); tone({ f0: 60, f1: 45, dur: 3, type: 'sawtooth', vol: .05, a: .8 }); },
  himars:  () => { for (let k = 0; k < 8; k++) noise({ dur: .8, type: 'bandpass', f0: 300, f1: 1800, q: 1, vol: .2, a: .02, delay: k * .14 }); },
  heli:    () => { for (let k = 0; k < 10; k++) noise({ dur: .05, type: 'lowpass', f0: 300, vol: .12, delay: k * .09 }); },
  build:   () => { tone({ f0: 220, f1: 330, dur: .08, type: 'square', vol: .06 }); noise({ dur: .12, f0: 1500, vol: .08, delay: .02 }); },
  ui:      () => tone({ f0: 660, dur: .05, type: 'triangle', vol: .08 }),
  deny:    () => tone({ f0: 180, f1: 140, dur: .15, type: 'square', vol: .06 }),
  wave:    () => { tone({ f0: 330, dur: .35, type: 'sawtooth', vol: .07 }); tone({ f0: 440, dur: .5, type: 'sawtooth', vol: .07, delay: .3 }); },
  alarm:   () => { for (let k = 0; k < 3; k++) { tone({ f0: 880, dur: .14, type: 'square', vol: .06, delay: k * .32 }); tone({ f0: 660, dur: .14, type: 'square', vol: .06, delay: k * .32 + .16 }); } },
  leak:    () => tone({ f0: 300, f1: 150, dur: .4, type: 'square', vol: .08 }),
  victory: () => [523, 659, 784, 1046].forEach((f, k) => tone({ f0: f, dur: .35, type: 'triangle', vol: .12, delay: k * .14 })),
  defeat:  () => [392, 330, 262, 196].forEach((f, k) => tone({ f0: f, dur: .45, type: 'triangle', vol: .1, delay: k * .2 })),
  nuke:    () => { noise({ dur: 4.5, f0: 900, f1: 40, vol: .9, a: .01 }); tone({ f0: 55, f1: 22, dur: 4, vol: .7, a: .02 }); noise({ dur: 3, type: 'bandpass', f0: 200, f1: 60, q: .6, vol: .5, a: .4, delay: .3 }); },
  coin:    () => { tone({ f0: 988, dur: .07, type: 'square', vol: .05 }); tone({ f0: 1318, dur: .12, type: 'square', vol: .05, delay: .07 }); },
};
const GAP = { mg: .07, aa: .06, amv: .07, enemyFire: .08, boomS: .05, boomL: .08, missile: .1, mortar: .1, tankFire: .12 };

export function sfx(name) {
  if (!ctx || !enabled || !SFX[name]) return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < (GAP[name] || 0)) return;
  last[name] = now;
  try { SFX[name](); } catch (e) { /* ohitetaan */ }
}
