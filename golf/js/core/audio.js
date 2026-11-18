// Procedural audio: every sound is synthesized live with WebAudio (no files).
import { getSettings } from './store.js';

let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, brownBuf = null;
let amb = null;

export function audioUnlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.connect(comp);
    comp.connect(master);
    noiseBuf = makeNoise(2, 'white');
    brownBuf = makeNoise(4, 'brown');
    applyVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export function applyVolumes() {
  if (!ctx) return;
  const s = getSettings();
  master.gain.value = s.volume;
  sfxBus.gain.value = s.sfx;
  ambBus.gain.value = s.ambience * 0.6;
}
function makeNoise(sec, type) {
  const len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
const now = () => ctx.currentTime;
function noiseSrc(buf = noiseBuf, loop = false) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop;
  if (!loop) s.playbackRate.value = 0.9 + Math.random() * 0.2;
  return s;
}
function env(g, t, a, peak, d, sustain = 0) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
}
function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function burst(vol, dur, ftype, f, q, t = now(), dest = sfxBus) {
  const s = noiseSrc(), fl = filt(ftype, f, q), g = ctx.createGain();
  chain(s, fl, g, dest); env(g, t, 0.003, vol, dur); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return { s, fl, g };
}
function tone(vol, dur, type, f, t = now(), f2 = null, dest = sfxBus) {
  const o = osc(type, f), g = ctx.createGain();
  chain(o, g, dest); env(g, t, 0.004, vol, dur);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}

export const sfx = {
  swing(power = 1) {
    if (!ctx) return; const t = now();
    const { fl } = burst(0.25 * power + 0.05, 0.28, 'bandpass', 500, 1.2, t);
    fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
  },
  impact(club, quality = 1) {
    if (!ctx) return; const t = now();
    if (club === 'PT') { tone(0.5, 0.06, 'sine', 1100, t); burst(0.25, 0.03, 'bandpass', 3000, 2, t); return; }
    const wood = club === 'DR' || club.endsWith('W');
    burst(0.9, 0.02, 'highpass', 2500, 0.7, t);
    burst(0.6 * quality, 0.06, 'bandpass', wood ? 1400 : 3200, 1.5, t);
    if (wood) { tone(0.22 * quality, 0.22, 'triangle', 1750, t, 1650); tone(0.12, 0.18, 'sine', 3400, t); }
    else tone(0.35, 0.05, 'sine', 240, t, 120);
  },
  land(surface, speed = 10) {
    if (!ctx) return; const t = now(), v = Math.min(1, speed / 25);
    if (surface === 'sand') { burst(0.35 * v + 0.1, 0.25, 'lowpass', 1800, 0.5, t); return; }
    if (surface === 'path') { tone(0.5 * v + 0.1, 0.05, 'square', 900, t, 600); burst(0.4 * v, 0.04, 'highpass', 2000, 1, t); return; }
    burst(0.5 * v + 0.08, 0.09, 'lowpass', 500, 1, t);
    tone(0.25 * v, 0.08, 'sine', 140, t, 70);
  },
  splash() {
    if (!ctx) return; const t = now();
    const { fl } = burst(0.8, 0.6, 'bandpass', 1200, 0.8, t);
    fl.frequency.setValueAtTime(600, t); fl.frequency.exponentialRampToValueAtTime(3500, t + 0.4);
    for (let i = 0; i < 6; i++) tone(0.08, 0.06, 'sine', 900 + Math.random() * 1600, t + 0.15 + Math.random() * 0.5, 2000 + Math.random() * 1000);
  },
  tree() {
    if (!ctx) return; const t = now();
    for (let i = 0; i < 5; i++) burst(0.25, 0.12, 'bandpass', 2500 + Math.random() * 3000, 0.8, t + i * 0.05 + Math.random() * 0.04);
    tone(0.25, 0.07, 'triangle', 380, t + 0.02, 250);
  },
  trunk() { if (!ctx) return; const t = now(); tone(0.6, 0.12, 'triangle', 300, t, 180); burst(0.4, 0.05, 'bandpass', 1200, 2, t); },
  pin() { if (!ctx) return; const t = now(); tone(0.5, 0.4, 'sine', 1800, t, 1700); tone(0.3, 0.3, 'sine', 2600, t); },
  cup() {
    if (!ctx) return; const t = now();
    for (let i = 0; i < 4; i++) { tone(0.35 / (i + 1), 0.05, 'triangle', 1300 - i * 120, t + i * 0.07); burst(0.2 / (i + 1), 0.03, 'bandpass', 3500, 2, t + i * 0.07); }
    tone(0.5, 0.15, 'sine', 160, t + 0.32, 90);
  },
  lip() { if (!ctx) return; const t = now(); tone(0.3, 0.05, 'triangle', 1400, t); tone(0.2, 0.05, 'triangle', 1200, t + 0.08); },
  click() { if (!ctx) return; tone(0.08, 0.03, 'sine', 1800); },
  tick() { if (!ctx) return; tone(0.05, 0.02, 'square', 2400); },
  perfect() { if (!ctx) return; const t = now(); tone(0.15, 0.25, 'sine', 1320, t); tone(0.12, 0.3, 'sine', 1760, t + 0.07); },
  error() { if (!ctx) return; tone(0.12, 0.2, 'sawtooth', 220, now(), 140); },
  applause(strength = 1) {
    if (!ctx) return; const t = now(), dur = 1.5 + strength * 2, n = Math.floor(40 + strength * 140);
    for (let i = 0; i < n; i++) {
      const at = t + Math.pow(Math.random(), 0.7) * dur;
      const fade = 1 - (at - t) / (dur + 0.4);
      burst(0.05 + 0.07 * Math.random() * fade, 0.025, 'bandpass', 1200 + Math.random() * 2400, 1.4, at);
    }
    if (strength > 1) for (let i = 0; i < 5; i++) {
      const at = t + 0.1 + Math.random() * 0.6, o = tone(0.04, 0.6, 'sawtooth', 300 + Math.random() * 200, at, 500);
      void o;
    }
  },
  ooh() {
    if (!ctx) return; const t = now();
    for (let i = 0; i < 12; i++) {
      const o = osc('sawtooth', 160 + Math.random() * 120), f = filt('bandpass', 500, 4), g = ctx.createGain();
      chain(o, f, g, sfxBus); env(g, t + Math.random() * 0.15, 0.2, 0.025, 0.9);
      o.frequency.linearRampToValueAtTime(o.frequency.value * 0.8, t + 1.1); o.start(t); o.stop(t + 1.3);
    }
  },
};

// Ambience ---------------------------------------------------------------------------------
export function startAmbience(kind, windSpeed = 3) {
  if (!ctx) return;
  stopAmbience();
  const out = ctx.createGain(); out.gain.value = 0; out.connect(ambBus);
  out.gain.linearRampToValueAtTime(1, now() + 2);
  const nodes = [];
  // wind bed
  const w = noiseSrc(brownBuf, true), wf = filt('lowpass', 400 + windSpeed * 40, 0.6), wg = ctx.createGain();
  wg.gain.value = 0.05 + Math.min(0.35, windSpeed * 0.03);
  const lfo = osc('sine', 0.13), lg = ctx.createGain(); lg.gain.value = wg.gain.value * 0.6;
  lfo.connect(lg); lg.connect(wg.gain); lfo.start();
  chain(w, wf, wg, out); w.start(); nodes.push(w, lfo);
  if (kind === 'links' || kind === 'tropical') {
    // ocean surf
    const s = noiseSrc(brownBuf, true), sf = filt('lowpass', 700, 0.5), sg = ctx.createGain();
    sg.gain.value = 0.12;
    const sl = osc('sine', 0.09), sl2 = ctx.createGain(); sl2.gain.value = 0.1;
    sl.connect(sl2); sl2.connect(sg.gain); sl.start();
    chain(s, sf, sg, out); s.start(); nodes.push(s, sl);
  }
  if (kind === 'mountain') {
    const s = noiseSrc(noiseBuf, true), sf = filt('bandpass', 2600, 0.7), sg = ctx.createGain(); sg.gain.value = 0.012;
    chain(s, sf, sg, out); s.start(); nodes.push(s);
  }
  let alive = true;
  const birds = () => {
    if (!alive) return;
    const t = now();
    if (kind === 'birds' || kind === 'autumn' || kind === 'mountain') songbird(out, t, kind === 'mountain' ? 0.5 : 1);
    else if (kind === 'tropical') { if (Math.random() < 0.6) tropicalBird(out, t); else songbird(out, t, 0.7); }
    else if (kind === 'links') gull(out, t);
    else if (kind === 'desert') { if (Math.random() < 0.5) cactusWren(out, t); }
    const next = kind === 'desert' ? 5 + Math.random() * 9 : kind === 'links' ? 6 + Math.random() * 10 : 1.5 + Math.random() * 5;
    amb.timer = setTimeout(birds, next * 1000);
  };
  amb = { out, nodes, timer: setTimeout(birds, 1200), stop: () => { alive = false; } };
  if (kind === 'desert' || kind === 'tropical') {
    // insects: amplitude-modulated high tone
    const o = osc('sine', kind === 'desert' ? 4200 : 5200), g = ctx.createGain(); g.gain.value = 0;
    const m = osc('square', kind === 'desert' ? 28 : 40), mg = ctx.createGain(); mg.gain.value = 0.004;
    m.connect(mg); mg.connect(g.gain); chain(o, g, out); o.start(); m.start(); nodes.push(o, m);
  }
}
export function stopAmbience() {
  if (!amb || !ctx) return;
  const a = amb; amb = null;
  a.stop(); clearTimeout(a.timer);
  a.out.gain.cancelScheduledValues(now());
  a.out.gain.setValueAtTime(a.out.gain.value, now());
  a.out.gain.linearRampToValueAtTime(0, now() + 0.8);
  setTimeout(() => { for (const n of a.nodes) { try { n.stop(); } catch { /* */ } } a.out.disconnect(); }, 1000);
}
function chirp(dest, t, f0, f1, dur, vol, type = 'sine') {
  const o = osc(type, f0), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.random() * 1.6 - 0.8; chain(o, g, p, dest); } else chain(o, g, dest);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}
function songbird(dest, t, vol) {
  const base = 2600 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const tt = t + i * (0.09 + Math.random() * 0.06);
    chirp(dest, tt, base * (0.9 + Math.random() * 0.3), base * (0.7 + Math.random() * 0.8), 0.07 + Math.random() * 0.06, 0.03 * vol);
  }
}
function tropicalBird(dest, t) {
  const base = 900 + Math.random() * 700;
  for (let i = 0; i < 3; i++) chirp(dest, t + i * 0.22, base, base * 1.6, 0.18, 0.03, 'triangle');
}
function gull(dest, t) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
    const tt = t + i * 0.28;
    const o = osc('sawtooth', 1300), f = filt('bandpass', 1500, 3), g = ctx.createGain();
    chain(o, f, g, dest);
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.025, tt + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.24);
    o.frequency.setValueAtTime(1500, tt); o.frequency.exponentialRampToValueAtTime(900, tt + 0.24);
    o.start(tt); o.stop(tt + 0.26);
  }
}
function cactusWren(dest, t) {
  for (let i = 0; i < 6; i++) chirp(dest, t + i * 0.1, 2000, 1700, 0.07, 0.02, 'square');
}
export function audioTime() { return ctx ? ctx.currentTime : 0; }
