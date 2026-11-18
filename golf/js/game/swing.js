// Touch swing controllers: swipe (pull back, flick through) and classic 3-tap meter.
import { DIFFICULTY } from '../core/data.js';
import { clamp } from '../core/util.js';
import { haptic } from '../core/haptics.js';
import { sfx } from '../core/audio.js';

export class SwingInput {
  constructor(root, cb) {
    this.root = root; this.cb = cb; this.enabled = false; this.mode = 'swipe'; this.diff = DIFFICULTY.amateur;
    this.idealTick = null; this.difficultyMul = 1;
    root.innerHTML = `
      <div class="swipe-pad">
        <svg class="swipe-svg" width="100%" height="100%"></svg>
        <div class="swipe-hint"><div class="swipe-ball"></div><span>Pull down to power up, then swing up</span></div>
        <div class="power-read"></div>
      </div>
      <div class="meter">
        <div class="meter-bar"><div class="meter-over"></div><div class="meter-sweet"></div><div class="meter-fill"></div><div class="meter-ideal"></div><div class="meter-mark"></div><div class="meter-pow"></div></div>
        <div class="meter-hint">Tap to start</div>
      </div>`;
    this.pad = root.querySelector('.swipe-pad');
    this.svg = root.querySelector('.swipe-svg');
    this.hint = root.querySelector('.swipe-hint');
    this.read = root.querySelector('.power-read');
    this.meter = root.querySelector('.meter');
    this.mFill = root.querySelector('.meter-fill'); this.mMark = root.querySelector('.meter-mark'); this.mPow = root.querySelector('.meter-pow');
    this.mIdeal = root.querySelector('.meter-ideal'); this.mHint = root.querySelector('.meter-hint'); this.mSweet = root.querySelector('.meter-sweet');
    this.pad.addEventListener('pointerdown', (e) => this.down(e));
    this.pad.addEventListener('pointermove', (e) => this.move(e));
    this.pad.addEventListener('pointerup', (e) => this.up(e));
    this.pad.addEventListener('pointercancel', (e) => this.up(e, true));
    this.meter.addEventListener('pointerdown', (e) => { e.preventDefault(); this.tap(); });
    this.m = null;
  }
  configure({ mode, difficulty, lieAcc = 1, ideal = null, putt = false }) {
    this.mode = mode; this.diff = DIFFICULTY[difficulty] || DIFFICULTY.amateur;
    this.lieAcc = lieAcc; this.ideal = ideal; this.putt = putt;
    this.pad.style.display = mode === 'swipe' ? '' : 'none';
    this.meter.style.display = mode === 'meter' ? '' : 'none';
    this.mIdeal.style.display = ideal != null ? '' : 'none';
    if (ideal != null) this.mIdeal.style.left = `${clamp(ideal, 0, 1.1) / 1.1 * 100}%`;
    const sweetW = this.diff.perfect / lieAcc * 100 * 0.9;
    this.mSweet.style.width = `${sweetW}%`;
    this.hint.querySelector('span').textContent = putt ? 'Pull down for speed, then stroke up' : 'Pull down to power up, then swing up';
    this.resetVisual();
  }
  setEnabled(on) { this.enabled = on; this.root.classList.toggle('disabled', !on); if (!on) this.cancel(); }
  cancel() { this.s = null; this.m = null; this.resetVisual(); }
  resetVisual() {
    this.svg.innerHTML = ''; this.read.textContent = ''; this.hint.style.opacity = '';
    this.mFill.style.width = '0%'; this.mMark.style.left = '0%'; this.mPow.style.display = 'none';
    this.mHint.textContent = 'Tap to start swing';
  }
  // ---- Swipe ------------------------------------------------------------------------
  down(e) {
    if (!this.enabled || this.mode !== 'swipe') return;
    e.preventDefault();
    (() => { try { this.pad.setPointerCapture(e.pointerId); } catch { /* synthetic */ } })();
    const r = this.pad.getBoundingClientRect();
    this.s = { id: e.pointerId, x0: e.clientX - r.left, y0: e.clientY - r.top, low: 0, lowX: 0, power: 0, phase: 'back', t: performance.now(), pts: [], lastTick: 0, r };
    this.s.maxPx = clamp(r.height * 0.62, 120, 260);
    this.hint.style.opacity = '0';
    haptic('light');
  }
  move(e) {
    const s = this.s;
    if (!s || e.pointerId !== s.id) return;
    const x = e.clientX - s.r.left, y = e.clientY - s.r.top;
    const dy = y - s.y0;
    s.pts.push([x, y, performance.now()]);
    if (s.phase === 'back') {
      if (dy > s.low) {
        s.low = dy; s.lowX = x;
        s.power = clamp(dy / s.maxPx, 0, 1.12);
        this.cb.onBack?.(s.power);
        const tick = Math.floor(s.power * 10);
        if (tick !== s.lastTick) { s.lastTick = tick; if (tick >= 10) haptic('medium'); else haptic('light'); }
      }
      if (s.low > 6 && dy < s.low - 10) { s.phase = 'down'; s.tDown = performance.now(); s.downStart = [x, s.y0 + s.low]; }
    } else if (s.phase === 'down') {
      if (y < s.y0 - 26) {
        // finished swing: measure deviation from straight vertical through low point
        const dxPath = x - s.lowX;
        const travel = Math.max(40, s.low + 26);
        const ang = Math.atan2(dxPath, travel);
        const tol = 0.42 * this.diff.tol;
        let acc = clamp(ang / tol, -1.2, 1.2);
        const dur = (performance.now() - s.tDown) / 1000;
        let power = s.power;
        let tempo = 'good';
        if (dur > 0.55) { power *= 0.9; tempo = 'slow'; }
        this.finish(power, acc, tempo);
        return;
      }
    }
    this.drawSwipe(x, y);
  }
  up(e, cancelled) {
    const s = this.s;
    if (!s || e.pointerId !== s.id) return;
    this.s = null;
    this.resetVisual();
    if (!cancelled) this.cb.onCancel?.();
  }
  drawSwipe(x, y) {
    const s = this.s; if (!s) return;
    const lowY = s.y0 + s.low;
    const p = s.power;
    const col = p > 1 ? '#ff5a4a' : p > 0.92 ? '#ffd34a' : '#ffffff';
    const tol = 0.42 * this.diff.tol, pz = this.diff.perfect * tol / this.lieAcc;
    const up = 220;
    const zx = Math.tan(pz) * up, ax = Math.tan(tol) * up;
    let ideal = '';
    if (this.ideal != null) {
      const iy = s.y0 + clamp(this.ideal, 0, 1.12) * s.maxPx;
      ideal = `<line x1="${s.x0 - 26}" y1="${iy}" x2="${s.x0 + 26}" y2="${iy}" stroke="#7CFFB2" stroke-width="3" stroke-linecap="round"/><text x="${s.x0 + 32}" y="${iy + 4}" fill="#7CFFB2" font-size="11" font-weight="700">PIN</text>`;
    }
    this.svg.innerHTML = `
      <line x1="${s.x0}" y1="${s.y0}" x2="${s.x0}" y2="${s.y0 + s.maxPx}" stroke="rgba(255,255,255,.18)" stroke-width="10" stroke-linecap="round"/>
      <line x1="${s.x0}" y1="${s.y0}" x2="${s.x0}" y2="${s.y0 + Math.min(s.low, s.maxPx * 1.12)}" stroke="${col}" stroke-width="10" stroke-linecap="round" opacity=".9"/>
      <line x1="${s.x0}" y1="${s.y0 + s.maxPx}" x2="${s.x0}" y2="${s.y0 + s.maxPx * 1.12}" stroke="rgba(255,80,60,.35)" stroke-width="10" stroke-linecap="round"/>
      ${ideal}
      ${s.phase === 'down' ? `<path d="M${s.lowX},${lowY} L${s.lowX - ax},${lowY - up} L${s.lowX + ax},${lowY - up} Z" fill="rgba(255,255,255,.07)"/>
      <path d="M${s.lowX},${lowY} L${s.lowX - zx},${lowY - up} L${s.lowX + zx},${lowY - up} Z" fill="rgba(124,255,178,.25)"/>
      <line x1="${s.lowX}" y1="${lowY}" x2="${x}" y2="${y}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` : ''}
      <circle cx="${x}" cy="${y}" r="16" fill="rgba(255,255,255,.25)" stroke="#fff" stroke-width="2"/>`;
    this.read.textContent = `${Math.round(p * 100)}%`;
    this.read.style.top = `${lowY}px`; this.read.style.left = `${s.x0 + 30}px`;
    this.read.style.color = col;
  }
  finish(power, acc, tempo) {
    this.s = null; this.m = null;
    const perfectZone = this.diff.perfect / this.lieAcc;
    let perfect = Math.abs(acc) < perfectZone;
    if (power > 1) acc *= 1 + (power - 1) * 8;
    if (perfect && power <= 1.0) acc = 0; else perfect = false;
    this.resetVisual();
    this.cb.onSwing?.({ power, acc, perfect, tempo });
    if (perfect) { sfx.perfect(); haptic('success'); }
  }
  // ---- Meter -------------------------------------------------------------------------
  tap() {
    if (!this.enabled || this.mode !== 'meter') return;
    const now = performance.now();
    if (!this.m) {
      this.m = { phase: 'up', t0: now, pos: 0, power: 0 };
      this.mHint.textContent = 'Tap to set power';
      haptic('light');
      const speed = 0.95 * this.diff.meterSpeed; // bar-units per second
      const step = () => {
        const m = this.m; if (!m) return;
        const t = (performance.now() - m.t0) / 1000;
        if (m.phase === 'up') {
          m.pos = t * speed;
          this.cb.onBack?.(Math.min(1.1, m.pos));
          if (m.pos >= 1.1) { m.phase = 'downAuto'; m.power = 1.1; m.t1 = performance.now(); this.mPow.style.display = ''; this.mPow.style.left = '100%'; }
        } else {
          const tt = (performance.now() - m.t1) / 1000;
          m.pos = m.power - tt * speed * 1.25;
          if (m.pos < -0.12) { this.finish(m.power, -1.1, 'miss'); return; }
        }
        this.mFill.style.width = `${clamp(m.phase === 'up' ? m.pos : m.power, 0, 1.1) / 1.1 * 100}%`;
        this.mMark.style.left = `${clamp(m.pos, -0.12, 1.1) / 1.1 * 100}%`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return;
    }
    const m = this.m;
    if (m.phase === 'up') {
      m.power = Math.max(0.03, m.pos); m.phase = 'down'; m.t1 = now;
      this.mPow.style.display = ''; this.mPow.style.left = `${m.power / 1.1 * 100}%`;
      this.mHint.textContent = 'Tap in the sweet spot';
      haptic('medium');
    } else {
      const sweet = this.diff.perfect / this.lieAcc * 0.9 * 1.1 / 2;
      const center = sweet;
      const acc = clamp((m.pos - center) / (0.2 * this.diff.tol), -1.2, 1.2);
      this.finish(m.power, Math.abs(m.pos - center) < sweet ? 0.0001 : acc, 'good');
    }
  }
}
