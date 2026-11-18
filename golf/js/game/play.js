// Play session: runs one hole or a full course round in 3D.
import * as THREE from 'three';
import { compileHole, routeTo } from '../core/compile.js';
import { S, SURF, CLUBS, SHOT_TYPES, WIND_MODES, DIFFICULTY, scoreName, TEE_SETS } from '../core/data.js';
import { defaultTee, holePar, shapePoly, holeTees } from '../core/hole.js';
import { clamp, lerp, M2YD, fmtShort, angleDiff, mulberry32, uid, smoothstep } from '../core/util.js';
import { getSettings, saveSettings, db } from '../core/store.js';
import { sfx, startAmbience, stopAmbience, audioUnlock } from '../core/audio.js';
import { haptic } from '../core/haptics.js';
import { renderThumb } from '../core/painter.js';
import { buildScene, to3 } from './scene.js';
import { setView, engine } from './engine.js';
import { simulate, calibrate, makeLaunch, puttRange, stimpDecel, lieFactor, BALL_R } from './physics.js';
import { SwingInput } from './swing.js';
import { h, icon, modal, btn, confetti, toast } from '../ui/ui.js';

const LOAD_LINES = ['Mowing the fairways…', 'Raking the bunkers…', 'Cutting the cup…', 'Rolling the greens…', 'Checking the wind…', 'Planting the trees…'];
const nextFrame = () => new Promise((r) => setTimeout(r, 50));

export class PlaySession {
  constructor(opts) {
    this.opts = opts;
    this.holes = opts.holes;
    this.index = opts.index || 0;
    this.round = opts.round || null;
    this.settings = getSettings();
    this.cal = calibrate(this.settings.power || 1);
    this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 9000);
    this.camPos = new THREE.Vector3(0, 30, 30); this.camLook = new THREE.Vector3();
    this.camPosT = this.camPos.clone(); this.camLookT = this.camLook.clone(); this.camK = 4;
    this.shake = 0;
    this.root = h('div', { class: 'hud' });
    document.getElementById('app').append(this.root);
    this.buildHud();
  }

  // ------------------------------------------------------------------ lifecycle
  async start() { audioUnlock(); await this.loadHole(this.index); }
  async loadHole(i) {
    this.index = i;
    const hole = this.holes[i];
    this.hole = hole;
    this.state = 'loading';
    this.showLoading(true);
    await nextFrame();
    if (this.sc) { this.sc.dispose(); this.sc = null; }
    const world = compileHole(hole);
    this.world = world;
    // wind
    const wm = WIND_MODES[hole.wind?.mode] || WIND_MODES.random;
    const rnd = mulberry32(Date.now() & 0xffffff);
    let speed, dir;
    if (hole.wind?.mode === 'fixed') { speed = hole.wind.speed; dir = hole.wind.dir; }
    else { speed = wm.min + rnd() * (wm.max - wm.min); speed *= world.climate.windBias || 1; speed = Math.min(speed, 12); dir = rnd() * 360; }
    const wr = dir * Math.PI / 180;
    this.wind = { speed, dir, x: Math.sin(wr) * speed, y: Math.cos(wr) * speed };
    this.sc = buildScene(world, { wind: this.wind, quality: engine.quality });
    this.teePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.05, 6).translate(0, -0.025, 0), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    this.sc.scene.add(this.teePeg);
    this.ripples = [];
    // ball on tee
    const tee = defaultTee(hole, this.settings.tee) || { spot: [0, 0], set: 'blue', len: hole.pin.y };
    this.tee = tee;
    this.ball = { x: tee.spot[0], y: tee.spot[1], lie: S.TEE, onTee: true };
    this.ball.h = world.heightAt(this.ball.x, this.ball.y) + BALL_R;
    this.strokes = 0; this.penalties = 0; this.putts = 0; this.shots = []; this.holeStats = { fairway: null, gir: false, drive: 0 };
    this.par = holePar(hole);
    this.aim = { heading: 0, club: 0, shot: 'normal', spin: { x: 0, y: 0 } };
    this.overview = false; this.gridOn = false;
    this.minimapBase = renderThumb(hole, 92, 150, { dpr: 2 });
    this.updateHoleCard();
    const fitFov = () => { this.camera.fov = innerWidth < innerHeight ? 62 : 46; this.camera.updateProjectionMatrix(); };
    fitFov();
    setView({ scene: this.sc.scene, camera: this.camera, update: (dt, t) => this.update(dt, t), onResize: () => { fitFov(); this.drawMinimap(); } });
    startAmbience(world.climate.ambience, speed);
    this.showLoading(false);
    this.setupShot(true);
    if (this.settings.intro) this.startIntro(); else this.snapCamera();
  }
  async exit(result) {
    stopAmbience();
    setView(null);
    if (this.sc) this.sc.dispose();
    this.root.remove();
    this.opts.onExit?.(result || {});
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    const r = this.root;
    r.innerHTML = `
      <div class="aim-area"></div>
      <div class="hud-top">
        <div class="hole-card"><div class="hc-num"></div><div class="hc-meta"></div><div class="hc-score"></div></div>
        <div class="hud-top-r">
          <div class="wind-w"><div class="wind-arrow">${'<svg viewBox="0 0 24 24"><path d="M12 2l6 9h-4v11h-4V11H6z" fill="currentColor"/></svg>'}</div><div class="wind-sp"></div></div>
          <button class="hbtn hud-menu"></button>
        </div>
      </div>
      <div class="hud-info"><div class="dist-pin"></div><div class="lie-badge"></div><div class="plays"></div></div>
      <canvas class="minimap"></canvas>
      <div class="hud-side">
        <button class="hbtn b-over" title="Overview"></button>
        <button class="hbtn b-grid" title="Read green"></button>
        <button class="hbtn b-spin" title="Ball spin"><div class="spin-ball"><i></i></div></button>
      </div>
      <div class="hud-bottom">
        <div class="club-sel"><button class="hbtn c-prev">‹</button><button class="club-info"><b class="c-name"></b><span class="c-dist"></span></button><button class="hbtn c-next">›</button></div>
        <button class="shot-type"></button>
      </div>
      <div class="swing-root"></div>
      <div class="banner"></div>
      <div class="intro-card"></div>
      <div class="loading"><div class="ld-ball"></div><div class="ld-text"></div></div>
      <div class="ff-hint">Tap to speed up</div>`;
    const q = (s) => r.querySelector(s);
    q('.hud-menu').append(icon('menu')); q('.b-over').append(icon('map')); q('.b-grid').append(icon('grid'));
    this.el = {
      num: q('.hc-num'), meta: q('.hc-meta'), score: q('.hc-score'), windA: q('.wind-arrow'), windS: q('.wind-sp'),
      dist: q('.dist-pin'), lie: q('.lie-badge'), plays: q('.plays'), mini: q('.minimap'), cname: q('.c-name'), cdist: q('.c-dist'),
      shot: q('.shot-type'), banner: q('.banner'), intro: q('.intro-card'), loading: q('.loading'), ldText: q('.ld-text'), grid: q('.b-grid'),
      spinDot: q('.spin-ball i'), ff: q('.ff-hint'), side: q('.hud-side'), bottom: q('.hud-bottom'), over: q('.b-over'),
    };
    q('.hud-menu').onclick = () => { sfx.click(); this.pauseMenu(); };
    q('.c-prev').onclick = () => this.cycleClub(-1);
    q('.c-next').onclick = () => this.cycleClub(1);
    q('.club-info').onclick = () => this.clubPicker();
    this.el.shot.onclick = () => this.shotPicker();
    q('.b-spin').onclick = () => this.spinPicker();
    this.el.grid.onclick = () => { this.gridOn = !this.gridOn; sfx.tick(); this.updateGrid(); };
    this.el.over.onclick = () => { this.overview = !this.overview; sfx.tick(); this.el.over.classList.toggle('on', this.overview); this.aimCamera(); };
    this.el.mini.onclick = () => this.el.over.click();
    // aim dragging
    const aimEl = q('.aim-area');
    let drag = null;
    aimEl.addEventListener('pointerdown', (e) => {
      audioUnlock();
      if (this.state === 'intro') { this.endIntro(); return; }
      if (this.state === 'flight') { this.ff = 4; this.el.ff.classList.remove('show'); return; }
      if (this.state !== 'aim') return;
      drag = { x: e.clientX, y: e.clientY, h: this.aim.heading, moved: false };
      (() => { try { aimEl.setPointerCapture(e.pointerId); } catch { /* synthetic */ } })();
    });
    aimEl.addEventListener('pointermove', (e) => {
      if (!drag || this.state !== 'aim') return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4 || Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      if (this.overview) return;
      const putt = this.club().putter;
      const k = putt ? 0.0011 : 0.0024;
      this.aim.heading = drag.h + dx * k;
      this.previewDirty = true;
      this.placeGolfer();
      this.aimCamera();
    });
    aimEl.addEventListener('pointerup', (e) => {
      if (!drag) return;
      if (this.overview && !drag.moved && this.state === 'aim') this.tapOverview(e.clientX, e.clientY);
      drag = null;
    });
    this.swing = new SwingInput(q('.swing-root'), {
      onBack: (p) => { if (this.state === 'aim') { this.backPower = p; this.previewPower = p; this.previewDirty = true; } },
      onCancel: () => { this.backPower = 0; this.previewPower = null; this.previewDirty = true; },
      onSwing: (res) => this.beginSwing(res),
    });
  }
  showLoading(on) {
    this.el.loading.classList.toggle('show', on);
    this.el.ldText.textContent = LOAD_LINES[Math.floor(Math.random() * LOAD_LINES.length)];
  }
  updateHoleCard() {
    const u = this.settings.units;
    const yds = u === 'm' ? `${Math.round(this.tee.len)} M` : `${Math.round(this.tee.len * M2YD)} YDS`;
    this.el.num.textContent = this.holes.length > 1 ? `HOLE ${this.index + 1}` : this.hole.name.toUpperCase();
    this.el.meta.textContent = `PAR ${this.par} · ${yds}`;
    const tot = this.round ? this.round.scores.reduce((a, s) => a + (s.strokes - s.par), 0) : 0;
    const toPar = tot === 0 ? 'E' : tot > 0 ? `+${tot}` : `${tot}`;
    this.el.score.innerHTML = `<span>Stroke ${this.strokes + 1}</span>${this.round ? `<span class="tp">${toPar}</span>` : ''}`;
    const mph = u === 'm' ? `${Math.round(this.wind.speed * 3.6)} km/h` : `${Math.round(this.wind.speed * 2.237)} mph`;
    this.el.windS.textContent = this.wind.speed < 0.5 ? 'Calm' : mph;
  }
  updateWindArrow() {
    // arrow up = blowing toward the target line direction (downwind)
    const wdir = Math.atan2(this.wind.x, this.wind.y);
    const rel = wdir - this.aim.heading;
    this.el.windA.style.transform = `rotate(${rel}rad)`;
    this.el.windA.style.opacity = this.wind.speed < 0.5 ? 0.3 : 1;
  }
  club() { return CLUBS[this.aim.club]; }
  updateHudInfo() {
    const u = this.settings.units;
    const b = this.ball, pin = this.world.pin;
    const d = Math.hypot(pin.x - b.x, pin.y - b.y);
    const onGreen = b.lie === S.GREEN;
    const dz = this.world.pinHeight - (b.h - BALL_R);
    if (onGreen || d < 30) this.el.dist.innerHTML = `${fmtShort(d, u).replace(/ ?ft/, '<small>FT</small>').replace(/m$/, '<small>M</small>')}<em>to pin</em>`;
    else this.el.dist.innerHTML = `${u === 'm' ? Math.round(d) : Math.round(d * M2YD)}<small>${u === 'm' ? 'M' : 'YDS'}</small><em>to pin</em>`;
    const L = SURF[b.lie];
    const pf = b.onTee ? 1 : lieFactor(this.club(), b.lie, d < 45);
    this.el.lie.textContent = b.onTee ? 'Tee' : `${L.name}${pf < 0.99 && !this.club().putter ? ` · ${Math.round(pf * 100)}%` : ''}`;
    this.el.lie.className = `lie-badge lie-${b.onTee ? 5 : b.lie}`;
    const elev = u === 'm' ? `${dz > 0 ? '↑' : '↓'} ${Math.abs(dz).toFixed(1)} m` : `${dz > 0 ? '↑' : '↓'} ${Math.round(Math.abs(dz) * 3.28)} ft`;
    const plays = d + dz * 1.0;
    this.el.plays.textContent = Math.abs(dz) < 0.3 ? '' : onGreen ? elev : `${elev} · plays ${u === 'm' ? Math.round(plays) : Math.round(plays * M2YD)}`;
    const c = this.club();
    this.el.cname.textContent = c.id === 'PT' ? 'Putter' : c.id;
    if (c.putter) {
      const rng = this.puttRangeM();
      this.el.cdist.textContent = u === 'm' ? `${rng} m max` : `${Math.round(rng * 3.28)} ft max`;
    } else {
      const carry = this.cal[c.id].carry * (b.onTee ? 1 : lieFactor(c, b.lie, d < 45));
      this.el.cdist.textContent = u === 'm' ? `${Math.round(carry)} m` : `${Math.round(carry * M2YD)} yds`;
    }
    this.el.shot.textContent = SHOT_TYPES[this.aim.shot]?.label || 'Normal';
    this.el.shot.style.visibility = c.putter ? 'hidden' : '';
    this.el.spinDot.style.transform = `translate(${this.aim.spin.x * 8}px, ${this.aim.spin.y * 8}px)`;
    const nearGreen = this.world.greenAt(b.x, b.y) || d < 35;
    this.el.grid.style.display = nearGreen ? '' : 'none';
    this.el.score.querySelector('span').textContent = `Stroke ${this.strokes + 1}`;
    this.updateWindArrow();
  }
  drawMinimap() {
    const cv = this.el.mini, base = this.minimapBase;
    if (!base || !this.world) return;
    const dpr = 2, W = 92, H = 150;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);
    // map world -> thumb: reconstruct transform used by renderThumb
    const hole = this.hole;
    const pts = hole.shapes.filter((s) => s.type !== 'path' && s.type !== 'oob' && s.type !== 'rough' && s.type !== 'deep').flatMap((s) => s.pts);
    pts.push([hole.pin.x, hole.pin.y]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    x0 -= 22; x1 += 22; y0 -= 22; y1 += 22;
    const scale = Math.min((W * dpr) / (x1 - x0), (H * dpr) / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const ox = cx - (W * dpr) / 2 / scale, oy = cy + (H * dpr) / 2 / scale;
    const P = (x, y) => [(x - ox) * scale, (oy - y) * scale];
    const b = P(this.ball.x, this.ball.y);
    if (this.preview?.land) {
      const l = P(this.preview.land.x, this.preview.land.y);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(...b); g.lineTo(...l); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#ffd34a'; g.beginPath(); g.arc(l[0], l[1], 5, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(b[0], b[1], 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
    this.mm = { ox, oy, scale };
  }
  banner(text, sub = '', cls = '', ms = 1600) {
    const b = this.el.banner;
    b.className = `banner show ${cls}`;
    b.innerHTML = `<div class="bn-main">${text}</div>${sub ? `<div class="bn-sub">${sub}</div>` : ''}`;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = 'banner'; }, ms);
  }

  // ------------------------------------------------------------------ shot setup
  setupShot(first = false) {
    const b = this.ball, w = this.world;
    b.h = w.heightAt(b.x, b.y) + BALL_R + (b.onTee ? 0.028 : 0);
    if (!b.onTee) b.lie = w.surfAt(b.x, b.y);
    const pin = w.pin;
    const dPin = Math.hypot(pin.x - b.x, pin.y - b.y);
    // auto club & aim
    const onGreen = b.lie === S.GREEN || (b.lie === S.FRINGE && dPin < 14);
    const target = this.autoTarget();
    this.aim.heading = Math.atan2(target[0] - b.x, target[1] - b.y);
    this.aim.club = this.autoClub(Math.hypot(target[0] - b.x, target[1] - b.y), onGreen);
    this.aim.shot = 'normal'; this.aim.spin = { x: 0, y: 0 };
    this.gridOn = this.gridOn && onGreen;
    this.overview = false; this.el.over.classList.remove('on');
    this.sc.flagStick.visible = true;
    this.sc.cupGlow.visible = onGreen;
    this.sc.golfer.setClub(this.club().id);
    this.backPower = 0; this.previewPower = null;
    this.placeGolfer();
    this.state = 'aim';
    this.configureSwing();
    this.swing.setEnabled(true);
    this.previewDirty = true;
    this.updateGrid();
    this.updateHudInfo();
    this.updateHoleCard();
    this.root.classList.add('aiming');
    this.sc.tracer.set([]);
    this.teePeg.visible = b.onTee;
    this.sc.setNearGrass(b.x, b.y);
    this.teePeg.position.set(b.x, b.h - BALL_R, -b.y);
    if (!first) this.aimCamera();
  }
  configureSwing() {
    const c = this.club(), b = this.ball;
    const L = SURF[b.onTee ? S.TEE : b.lie];
    const ideal = this.idealPower();
    this.swing.configure({ mode: this.settings.swing, difficulty: this.settings.difficulty, lieAcc: c.putter ? 1 : L.acc, ideal, putt: c.putter });
  }
  puttRangeM() {
    const b = this.ball, pin = this.world.pin;
    return puttRange(Math.hypot(pin.x - b.x, pin.y - b.y));
  }
  idealPower() {
    const c = this.club(), b = this.ball, pin = this.world.pin;
    const d = Math.hypot(pin.x - b.x, pin.y - b.y);
    if (c.putter) return clamp(d / this.puttRangeM(), 0, 1.1);
    const lf = b.onTee ? 1 : lieFactor(c, b.lie, d < 45);
    const full = this.cal[c.id].carry * lf * (SHOT_TYPES[this.aim.shot]?.power || 1);
    if (d > full * 1.08) return null;
    return clamp(Math.pow(d / full, 1 / 0.9), 0, 1.1);
  }
  autoTarget() {
    const b = this.ball, w = this.world, pin = w.pin;
    const dPin = Math.hypot(pin.x - b.x, pin.y - b.y);
    const maxCarry = this.cal[b.onTee ? 'DR' : '3W'].carry;
    if (dPin > maxCarry * 1.12) {
      const r = routeTo(w, [b.x, b.y]);
      for (let i = 1; i < r.pts.length - 1; i++) {
        const p = r.pts[i]; const d = Math.hypot(p[0] - b.x, p[1] - b.y);
        if (d > 40) return d > maxCarry * 1.05 ? [b.x + (p[0] - b.x) * maxCarry / d, b.y + (p[1] - b.y) * maxCarry / d] : p;
      }
    }
    return [pin.x, pin.y];
  }
  autoClub(dist, onGreen) {
    if (onGreen) return CLUBS.findIndex((c) => c.putter);
    const b = this.ball;
    const list = CLUBS.map((c, i) => ({ c, i })).filter(({ c }) => !c.putter && (c.id !== 'DR' || b.onTee));
    if (b.lie === S.BUNKER && Math.hypot(this.world.pin.x - b.x, this.world.pin.y - b.y) < 45) return CLUBS.findIndex((c) => c.id === 'SW');
    let best = list[0].i;
    for (let k = list.length - 1; k >= 0; k--) {
      const { c, i } = list[k];
      const lf = b.onTee ? 1 : lieFactor(c, b.lie, dist < 45);
      const roll = (this.cal[c.id].total - this.cal[c.id].carry) * 0.6;
      if (this.cal[c.id].carry * lf + roll >= dist * 0.98) { best = i; break; }
      best = list[0].i;
    }
    return best;
  }
  cycleClub(d) {
    if (this.state !== 'aim') return;
    sfx.tick(); haptic('light');
    let i = this.aim.club;
    for (let k = 0; k < CLUBS.length; k++) {
      i = (i + d + CLUBS.length) % CLUBS.length;
      if (CLUBS[i].id === 'DR' && !this.ball.onTee) continue;
      break;
    }
    this.aim.club = i;
    if (!SHOT_TYPES[this.aim.shot] || (SHOT_TYPES[this.aim.shot].wedge && !this.isWedge())) this.aim.shot = 'normal';
    this.sc.golfer.setClub(this.club().id);
    this.placeGolfer(); this.configureSwing(); this.previewDirty = true; this.updateHudInfo(); this.aimCamera();
  }
  isWedge() { return ['PW', 'GW', 'SW', 'LW', '9I'].includes(this.club().id); }
  placeGolfer() {
    const b = this.ball, g = this.sc.golfer;
    g.group.position.set(b.x, this.world.heightAt(b.x, b.y), -b.y);
    g.group.rotation.y = -this.aim.heading;
    g.pose(0);
    g.group.visible = true;
  }
  updateGrid() {
    const g = this.gridOn ? this.world.greenAt(this.ball.x, this.ball.y) || this.world.greenAt(this.world.pin.x, this.world.pin.y) : null;
    this.sc.setGreenGrid(g);
    this.el.grid.classList.toggle('on', !!g);
  }

  // ------------------------------------------------------------------ preview
  computePreview() {
    this.previewDirty = false;
    const c = this.club(), b = this.ball, w = this.world;
    const diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.amateur;
    const d = Math.hypot(w.pin.x - b.x, w.pin.y - b.y);
    const start = { x: b.x, y: b.y, h: b.h };
    const sc = this.sc;
    if (c.putter) {
      const pw = this.previewPower ?? this.idealPower() ?? 0.5;
      const g = w.greenAt(b.x, b.y);
      const L = makeLaunch(c, this.cal, { power: pw, acc: 0, lie: b.lie, heading: this.aim.heading, puttRange: this.puttRangeM(), greenDecel: stimpDecel(g ? g.stimp : 10) });
      const r = simulate(w, start, L, { flagIn: false, seed: 3 });
      const frac = diff.puttLine;
      const n = Math.max(2, Math.floor(r.path.length * frac));
      sc.puttLine.set(frac > 0 ? r.path.slice(0, n).map((p) => to3(p.x, p.y, w.heightAt(p.x, p.y) + 0.012)) : []);
      if (frac === 0) {
        // Pro: just show the start line
        const pts = [];
        for (let i = 0; i <= 12; i++) { const s = i * 0.25; const x = b.x + Math.sin(this.aim.heading) * s, y = b.y + Math.cos(this.aim.heading) * s; pts.push(to3(x, y, w.heightAt(x, y) + 0.012)); }
        sc.puttLine.set(pts);
      }
      sc.aimArc.set([]);
      sc.target.visible = false;
      this.preview = { land: { x: r.end.x, y: r.end.y } };
    } else {
      const pw = this.previewPower ?? Math.min(1, this.idealPower() ?? 1);
      const L = makeLaunch(c, this.cal, { power: pw, acc: 0, lie: b.onTee ? S.TEE : b.lie, shot: this.aim.shot, spin: this.aim.spin, heading: this.aim.heading, nearGreen: d < 45 });
      const r = simulate(w, start, L, { wind: diff.windPreview ? this.wind : { x: 0, y: 0 }, seed: 3, stopAtLand: true, flagIn: true });
      // resample the flight path into evenly spaced points so the dashes are uniform
      const raw = r.path.map((p) => to3(p.x, p.y, p.h));
      const pts = [];
      let acc = 0;
      const step = clamp(r.carry / 60, 0.8, 3.5);
      for (let i = 1; i < raw.length; i++) {
        const seg = raw[i].distanceTo(raw[i - 1]);
        acc += seg;
        while (acc >= step) { acc -= step; const t = 1 - acc / Math.max(seg, 1e-6); const p = raw[i - 1].clone().lerp(raw[i], t); if (Math.hypot(p.x - b.x, -p.z - b.y) > 2.5) pts.push(p); }
      }
      const frac = diff.preview;
      sc.aimArc.set(pts.slice(0, Math.max(2, Math.floor(pts.length * frac))));
      sc.puttLine.set([]);
      sc.target.visible = true;
      const lp = r.landing;
      const lh = w.heightAt(lp.x, lp.y);
      sc.target.position.set(lp.x, lh + 0.05, -lp.y);
      const n = w.normalAt(lp.x, lp.y);
      sc.target.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[2], -n[1]));
      this.preview = { land: { x: lp.x, y: lp.y }, carry: r.carry };
    }
    this.drawMinimap();
  }

  // ------------------------------------------------------------------ camera
  aimCamera() {
    const b = this.ball, w = this.world, hd = this.aim.heading;
    const fx = Math.sin(hd), fy = Math.cos(hd);
    const gh = w.heightAt(b.x, b.y);
    if (this.overview) {
      const land = this.preview?.land || { x: w.pin.x, y: w.pin.y };
      const mx = (b.x + land.x) / 2, my = (b.y + land.y) / 2;
      const span = Math.max(40, Math.hypot(land.x - b.x, land.y - b.y));
      this.camPosT.copy(to3(mx - fx * span * 0.35, my - fy * span * 0.35, gh + span * 1.05));
      this.camLookT.copy(to3(mx + fx * span * 0.08, my + fy * span * 0.08, w.heightAt(mx, my)));
      this.camK = 3;
      return;
    }
    const putt = this.club().putter;
    const back = putt ? 3.4 : 6.6, up = putt ? 1.7 : 2.5, side = putt ? 0.55 : -0.45;
    const rx = Math.cos(hd), ry = -Math.sin(hd);
    let cx = b.x - fx * back + rx * side, cy = b.y - fy * back + ry * side;
    let ch = Math.max(w.heightAt(cx, cy) + 0.6, gh + up);
    this.camPosT.copy(to3(cx, cy, ch));
    const ahead = putt ? Math.min(6, Math.hypot(w.pin.x - b.x, w.pin.y - b.y) * 0.7 + 1) : 30;
    const lx = b.x + fx * ahead + rx * side * 0.3, ly = b.y + fy * ahead + ry * side * 0.3;
    this.camLookT.copy(to3(lx, ly, (putt ? w.heightAt(lx, ly) : gh - 0.5 + (w.heightAt(lx, ly) - gh) * 0.6)));
    this.camK = 5;
  }
  snapCamera() { this.aimCamera(); this.camPos.copy(this.camPosT); this.camLook.copy(this.camLookT); }
  tapOverview(cx, cy) {
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.sc.terrain, false)[0];
    if (!hit) return;
    const tx = hit.point.x, ty = -hit.point.z, b = this.ball;
    this.aim.heading = Math.atan2(tx - b.x, ty - b.y);
    const onGreen = b.lie === S.GREEN;
    this.aim.club = this.autoClub(Math.hypot(tx - b.x, ty - b.y), onGreen);
    this.sc.golfer.setClub(this.club().id);
    sfx.tick(); haptic('light');
    this.placeGolfer(); this.configureSwing(); this.previewDirty = true; this.updateHudInfo();
    this.overview = false; this.el.over.classList.remove('on');
    this.aimCamera();
  }

  // ------------------------------------------------------------------ intro
  startIntro() {
    const w = this.world, b = this.ball;
    const r = routeTo(w, [b.x, b.y]);
    const pin = w.pin;
    const dir = [pin.x - b.x, pin.y - b.y]; const dl = Math.hypot(...dir); dir[0] /= dl; dir[1] /= dl;
    const pts = [], looks = [];
    const H = (x, y) => w.heightAt(x, y);
    pts.push(to3(b.x - dir[0] * 25, b.y - dir[1] * 25, H(b.x, b.y) + 22));
    looks.push(to3(b.x + dir[0] * 120, b.y + dir[1] * 120, H(b.x, b.y)));
    for (let i = 1; i < r.pts.length - 1; i++) { const p = r.pts[i]; pts.push(to3(p[0] - 30 * dir[0], p[1] - 30 * dir[1], H(p[0], p[1]) + 45)); looks.push(to3(pin.x, pin.y, H(pin.x, pin.y))); }
    const mid = [(b.x + pin.x) / 2, (b.y + pin.y) / 2];
    if (r.pts.length <= 2) { pts.push(to3(mid[0] + 25, mid[1], H(mid[0], mid[1]) + 50)); looks.push(to3(pin.x, pin.y, H(pin.x, pin.y))); }
    pts.push(to3(pin.x - dir[0] * 35 + 18, pin.y - dir[1] * 35, H(pin.x, pin.y) + 14));
    looks.push(to3(pin.x, pin.y, H(pin.x, pin.y) + 1));
    pts.push(to3(pin.x + dir[0] * 10 + 8, pin.y + dir[1] * 10, H(pin.x, pin.y) + 6));
    looks.push(to3(pin.x, pin.y, H(pin.x, pin.y)));
    this.intro = { t: 0, dur: 7.5, path: new THREE.CatmullRomCurve3(pts), look: new THREE.CatmullRomCurve3(looks) };
    this.state = 'intro';
    this.swing.setEnabled(false);
    this.root.classList.remove('aiming');
    const u = this.settings.units;
    const yds = u === 'm' ? `${Math.round(this.tee.len)} m` : `${Math.round(this.tee.len * M2YD)} yards`;
    this.el.intro.innerHTML = `<div class="ic-hole">${this.holes.length > 1 ? `Hole ${this.index + 1}` : (this.hole.status === 'saved' ? 'Signature Hole' : 'Test Round')}</div>
      <div class="ic-name">${escapeHtml(this.hole.name)}</div><div class="ic-meta">Par ${this.par} · ${yds} · ${TEE_SETS[this.tee.set]?.label || ''} tees</div><div class="ic-skip">Tap to skip</div>`;
    this.el.intro.classList.add('show');
    this.camPos.copy(pts[0]); this.camLook.copy(looks[0]);
  }
  endIntro() {
    this.el.intro.classList.remove('show');
    this.intro = null;
    this.state = 'aim';
    this.swing.setEnabled(true);
    this.root.classList.add('aiming');
    this.aimCamera();
    this.camK = 1.6;
  }

  // ------------------------------------------------------------------ swing & flight
  beginSwing(res) {
    if (this.state !== 'aim') return;
    this.state = 'swing';
    this.swing.setEnabled(false);
    this.root.classList.remove('aiming');
    this.swingRes = res;
    this.swingT = 0;
    this.swingFrom = this.backAngle();
    sfx.swing(res.power);
  }
  backAngle() { const putt = this.club().putter; return (this.backPower || 0) * (putt ? 0.55 : 2.7); }
  impact() {
    const res = this.swingRes, c = this.club(), b = this.ball, w = this.world;
    const d = Math.hypot(w.pin.x - b.x, w.pin.y - b.y);
    const g = w.greenAt(b.x, b.y);
    const L = makeLaunch(c, this.cal, {
      power: res.power, acc: res.acc, lie: b.onTee ? S.TEE : b.lie, shot: this.aim.shot, spin: this.aim.spin, heading: this.aim.heading,
      nearGreen: d < 45, puttRange: this.puttRangeM(), greenDecel: stimpDecel(g ? g.stimp : 10),
    });
    const flagIn = b.lie !== S.GREEN;
    const r = simulate(w, { x: b.x, y: b.y, h: b.h }, L, { wind: this.wind, seed: (Math.random() * 1e9) | 0, flagIn });
    this.strokes++;
    if (b.lie === S.GREEN || c.putter) this.putts++;
    this.flight = { r, t: 0, ev: 0, start: { ...b }, club: c, res, tracer: [], landCam: null, putt: c.putter, short: r.carry < 45 || c.putter };
    this.ff = 1;
    sfx.impact(c.id, res.perfect ? 1 : 0.7);
    haptic(c.putter ? 'light' : 'impact');
    if (!c.putter && c.id === 'DR' && this.settings.camShake) this.shake = 0.25;
    this.state = 'flight';
    this.sc.aimArc.set([]); this.sc.puttLine.set([]); this.sc.target.visible = false;
    this.teePeg.visible = false;
    if (res.perfect) this.banner('PERFECT', '', 'perfect', 900);
    else if (Math.abs(res.acc) > 0.55 && !c.putter) this.banner(res.acc > 0 ? 'Slice' : 'Hook', '', 'warn', 900);
    else if (res.tempo === 'slow') this.banner('Decelerated', '', 'warn', 900);
    this.el.ff.classList.toggle('show', !this.flight.short && r.duration > 4);
    setTimeout(() => this.el.ff.classList.remove('show'), 2500);
    // plan landing camera
    if (!this.flight.short) {
      const lp = r.landing, sx = b.x, sy = b.y;
      let dx = lp.x - sx, dy = lp.y - sy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const side = Math.cos(this.aim.heading) * (lp.x - sx) > 0 ? -1 : 1;
      const px = lp.x - dx * 26 + (-dy) * 16 * side, py = lp.y - dy * 26 + dx * 16 * side;
      const ph = Math.max(w.heightAt(px, py) + 4, w.heightAt(lp.x, lp.y) + 6 + r.apex * 0.12);
      this.flight.landCam = to3(px, py, ph);
    }
  }
  updateFlight(dt) {
    const f = this.flight, r = f.r, w = this.world;
    f.t += dt * (this.ff || 1) * (f.putt ? 1 : 1.0);
    const P = r.path;
    let i = f.i || 0;
    while (i < P.length - 2 && P[i + 1].t <= f.t) i++;
    f.i = i;
    const a = P[i], bb = P[Math.min(P.length - 1, i + 1)];
    const k = bb.t > a.t ? clamp((f.t - a.t) / (bb.t - a.t), 0, 1) : 1;
    const x = lerp(a.x, bb.x, k), y = lerp(a.y, bb.y, k), hh = lerp(a.h, bb.h, k);
    this.ballPos = { x, y, h: hh };
    // events
    while (f.ev < r.events.length && r.events[f.ev].t <= f.t) this.onEvent(r.events[f.ev++]);
    // tracer (air only)
    if (this.settings.showTracer && !f.putt && !f.landed) {
      f.tracer.push(to3(x, y, hh));
      this.sc.tracer.set(f.tracer);
    }
    // camera
    const ballV = to3(x, y, hh);
    if (f.putt) {
      const hd = this.aim.heading;
      this.camPosT.copy(to3(f.start.x - Math.sin(hd) * 2.4, f.start.y - Math.cos(hd) * 2.4, f.start.h + 1.2)).lerp(to3(x - Math.sin(hd) * 2.6, y - Math.cos(hd) * 2.6, hh + 1.1), Math.min(1, f.t / 2.5));
      this.camLookT.copy(ballV); this.camK = 3;
    } else if (f.short || !f.landCam) {
      const hd = this.aim.heading;
      const behind = to3(f.start.x - Math.sin(hd) * 6, f.start.y - Math.cos(hd) * 6, f.start.h + 2.5 + Math.min(10, f.t * 2));
      this.camPosT.copy(behind); this.camLookT.copy(ballV); this.camK = 3;
      if (f.landed) { const back = to3(x - Math.sin(hd) * 8, y - Math.cos(hd) * 8, hh + 3.5); this.camPosT.lerp(back, 0.5); }
    } else {
      if (f.t < 0.8) { this.camLookT.copy(ballV); this.camK = 6; }
      else { this.camPosT.copy(f.landCam); this.camLookT.copy(ballV); this.camK = f.t < 2.2 ? 1.3 : 2.5; }
    }
    if (f.t >= r.duration) this.endFlight();
  }
  onEvent(e) {
    const surfName = (s) => (s === S.BUNKER || s === S.NATIVE ? 'sand' : s === S.PATH ? 'path' : 'grass');
    switch (e.type) {
      case 'land': this.flight.landed = true; sfx.land(surfName(e.surf), e.impact || 10); if ((e.impact || 0) > 8) haptic('light'); break;
      case 'bounce': if ((e.impact || 0) > 1.5) sfx.land(surfName(e.surf), e.impact); break;
      case 'splash': sfx.splash(); haptic('medium'); this.addRipple(e.x, e.y); this.flight.landed = true; break;
      case 'tree': sfx.tree(); haptic('light'); break;
      case 'branch': case 'trunk': case 'rock': case 'cactus': sfx.trunk(); haptic('medium'); break;
      case 'pin': sfx.pin(); haptic('medium'); break;
      case 'lip': sfx.lip(); haptic('light'); this.lipped = true; break;
      case 'cup': sfx.cup(); haptic('success'); break;
      case 'plug': break;
      default: break;
    }
  }
  addRipple(x, y) {
    const lv = this.world.waterAt(x, y);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(x, (Number.isNaN(lv) ? this.world.heightAt(x, y) : lv) + 0.02, -y);
    this.sc.scene.add(m);
    this.ripples.push({ m, t: 0 });
    // spray
    const n = 60, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { p.set([m.position.x, m.position.y, m.position.z], i * 3); const a = Math.random() * 6.28, s = 0.5 + Math.random() * 1.8; vel.push([Math.cos(a) * s, 2 + Math.random() * 3.5, Math.sin(a) * s]); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
    this.sc.scene.add(pts);
    this.ripples.push({ pts, vel, t: 0 });
  }
  endFlight() {
    const f = this.flight, r = f.r, w = this.world, b = this.ball;
    this.state = 'result';
    this.el.ff.classList.remove('show');
    const u = this.settings.units;
    const fmt = (m) => (u === 'm' ? `${Math.round(m)} m` : `${Math.round(m * M2YD)} yds`);
    const from = b.onTee ? S.TEE : b.lie;
    const shot = { club: f.club.id, power: +f.res.power.toFixed(2), acc: +f.res.acc.toFixed(2), from, to: r.end.surf, carry: +r.carry.toFixed(1), total: +r.total.toFixed(1), state: r.state };
    this.shots.push(shot);
    if (this.strokes === 1 && this.par >= 4 && r.state === 'rest') {
      this.holeStats.fairway = r.end.surf === S.FAIRWAY || r.end.surf === S.FIRSTCUT;
      this.holeStats.drive = r.total;
    }
    let delay = 1500;
    if (r.state === 'holed') { this.holeOut(); return; }
    if (r.state === 'water') {
      this.strokes++; this.penalties++;
      this.banner('Splash!', 'Penalty stroke · drop at the hazard', 'bad', 2000);
      sfx.ooh();
      const drop = this.findDrop(r.lastDry, f.start);
      Object.assign(b, { x: drop[0], y: drop[1], onTee: false });
      delay = 2100;
    } else if (r.state === 'oob') {
      this.strokes++; this.penalties++;
      this.banner('Out of Bounds', 'Stroke and distance', 'bad', 2000);
      sfx.ooh();
      Object.assign(b, { x: f.start.x, y: f.start.y, onTee: f.start.onTee, lie: f.start.lie });
      delay = 2100;
    } else {
      Object.assign(b, { x: r.end.x, y: r.end.y, onTee: false });
      const s = r.end.surf;
      const name = SURF[s]?.name || '';
      if (f.putt) {
        const left = Math.hypot(w.pin.x - r.end.x, w.pin.y - r.end.y);
        const startD = Math.hypot(w.pin.x - f.start.x, w.pin.y - f.start.y);
        const travelled = Math.hypot(r.end.x - f.start.x, r.end.y - f.start.y);
        this.banner(this.lipped ? 'Lipped out!' : travelled < startD ? 'Short' : 'Long', `${fmtShort(left, u)} left`, '', 1300);
        delay = 1300;
      } else {
        let main = fmt(r.total);
        if (s === S.GREEN && this.strokes <= this.par - 2) main = 'On in regulation!';
        else if (s === S.GREEN) main = 'On the green';
        else if (s === S.BUNKER) main = 'In the bunker';
        else if (f.res.perfect && (s === S.FAIRWAY)) main = 'Great shot!';
        this.banner(main, s === S.GREEN ? `${fmtShort(Math.hypot(w.pin.x - r.end.x, w.pin.y - r.end.y), u)} to the pin` : `${name} · carry ${fmt(r.carry)}`, s === S.GREEN || s === S.FAIRWAY ? 'good' : '', 1600);
      }
    }
    this.lipped = false;
    if (w.surfAt(b.x, b.y) === S.GREEN && this.strokes <= this.par - 2) this.holeStats.gir = true;
    // gimme: tap in anything inside 18 inches (except on Pro)
    if (r.state === 'rest' && this.settings.difficulty !== 'pro' && w.surfAt(b.x, b.y) === S.GREEN && Math.hypot(w.pin.x - b.x, w.pin.y - b.y) < 0.45) {
      setTimeout(() => {
        if (this.state !== 'result') return;
        this.strokes++; this.putts++;
        this.shots.push({ club: 'PT', power: 0, acc: 0, from: S.GREEN, to: S.GREEN, carry: 0, total: 0, state: 'holed', tapin: true });
        sfx.cup(); haptic('success');
        this.holeOut();
      }, delay);
      return;
    }
    if (this.strokes >= Math.max(10, this.par + 6)) {
      setTimeout(() => { this.banner('Picked up', 'Maximum strokes reached', 'bad', 1800); this.strokes = Math.max(10, this.par + 6); setTimeout(() => this.finishHole(), 1800); }, delay);
      return;
    }
    setTimeout(() => { if (this.state === 'result') this.setupShot(); }, delay);
  }
  findDrop(pt, origin) {
    const w = this.world;
    let x = pt.x, y = pt.y;
    let dx = origin.x - x, dy = origin.y - y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (let i = 0; i < 60; i++) {
      const s = w.surfAt(x, y);
      if (i > 1 && s !== S.WATER && s !== S.BUNKER && !w.isOOB(x, y) && Number.isNaN(w.waterAt(x, y))) break;
      x += dx * 1.2; y += dy * 1.2;
    }
    return [x, y];
  }
  holeOut() {
    this.state = 'holed';
    const sn = scoreName(this.strokes, this.par);
    const diff = this.strokes - this.par;
    const cls = diff <= -1 ? 'great' : diff === 0 ? 'good' : 'bad';
    this.banner(sn, `${this.strokes} stroke${this.strokes > 1 ? 's' : ''}`, `big ${cls}`, 2600);
    if (diff <= -1 || this.strokes === 1) { confetti(this.strokes === 1 ? 260 : diff <= -2 ? 200 : 120); sfx.applause(this.strokes === 1 ? 3 : diff <= -2 ? 2.2 : 1.4); haptic('success'); }
    else if (diff === 0) sfx.applause(0.6);
    const pin = this.world.pin;
    this.ballPos = { x: pin.x, y: pin.y, h: this.world.pinHeight - 0.05 };
    this.holedT = 0;
    setTimeout(() => this.finishHole(), 2700);
  }
  async finishHole() {
    this.state = 'done';
    this.swing.setEnabled(false);
    const rec = {
      id: uid(), holeId: this.hole.id, holeName: this.hole.name, date: Date.now(), par: this.par, strokes: this.strokes, putts: this.putts,
      penalties: this.penalties, fairway: this.holeStats.fairway, gir: this.holeStats.gir, drive: Math.round(this.holeStats.drive),
      shots: this.shots, roundId: this.round?.id || null, courseId: this.round?.courseId || null, climate: this.hole.climate, tee: this.tee.set,
    };
    try { await db.put('plays', rec); } catch (e) { console.warn(e); }
    if (this.round) {
      this.round.scores[this.index] = { holeId: this.hole.id, par: this.par, strokes: this.strokes, putts: this.putts, fairway: rec.fairway, gir: rec.gir };
      this.round.complete = this.round.scores.filter(Boolean).length >= this.holes.length;
      this.round.updated = Date.now();
      try { await db.put('rounds', this.round); } catch (e) { console.warn(e); }
    }
    this.showHoleSummary(rec);
  }
  async showHoleSummary(rec) {
    const plays = (await db.all('plays')).filter((p) => p.holeId === this.hole.id);
    const best = Math.min(...plays.map((p) => p.strokes));
    const u = this.settings.units;
    const diff = rec.strokes - rec.par;
    const last = this.round ? this.index >= this.holes.length - 1 : true;
    const stat = (k, v) => h('div', { class: 'st' }, h('b', {}, v), h('span', {}, k));
    const body = h('div', { class: 'hole-sum' },
      h('div', { class: `hs-score s${clamp(diff, -3, 3)}` }, String(rec.strokes)),
      h('div', { class: 'hs-name' }, scoreName(rec.strokes, rec.par)),
      h('div', { class: 'hs-sub' }, `${this.hole.name} · Par ${rec.par}`),
      h('div', { class: 'hs-stats' },
        rec.par >= 4 ? stat('Fairway', rec.fairway == null ? '–' : rec.fairway ? '✓' : '✗') : null,
        stat('Green in Reg', rec.gir ? '✓' : '✗'), stat('Putts', rec.putts), rec.drive ? stat('Drive', u === 'm' ? `${rec.drive}m` : `${Math.round(rec.drive * M2YD)}y`) : null,
        stat('Penalties', rec.penalties), stat('Best here', Number.isFinite(best) ? best : rec.strokes), stat('Played', plays.length)),
      this.round ? this.scorecardTable() : null);
    const actions = [];
    if (this.round && !last) actions.push({ label: `Next Hole ›`, value: 'next', cls: 'primary' });
    if (this.round && last) actions.push({ label: 'Finish Round', value: 'finish', cls: 'primary' });
    if (!this.round) actions.push({ label: 'Play Again', value: 'again', cls: 'primary' });
    if (!this.round && this.hole.status !== 'saved') actions.push({ label: '★ Add to Collection', value: 'save', cls: 'gold' });
    if (!this.round) actions.push({ label: 'Edit Hole', value: 'edit', cls: 'ghost' });
    actions.push({ label: 'Exit', value: 'exit', cls: 'ghost' });
    const v = await modal({ title: null, body, actions, cls: 'sheet', dismiss: false });
    if (v === 'next') this.loadHole(this.index + 1);
    else if (v === 'again') this.loadHole(this.index);
    else if (v === 'save') {
      this.hole.status = 'saved'; this.hole.updated = Date.now();
      await db.put('holes', this.hole);
      toast('Added to your collection ★');
      this.showHoleSummary(rec);
    } else if (v === 'edit') this.exit({ edit: this.hole });
    else if (v === 'finish') this.roundSummary();
    else this.exit({});
  }
  scorecardTable() {
    const n = this.holes.length;
    const scores = this.round?.scores || [];
    const t = h('div', { class: 'scorecard' });
    const chunk = (from, to) => {
      const row = (label, f, cls = '') => h('div', { class: `sc-row ${cls}` }, h('span', { class: 'sc-l' }, label), ...Array.from({ length: to - from }, (_, k) => f(from + k)));
      t.append(row('Hole', (i) => h('span', {}, i + 1), 'sc-head'),
        row('Par', (i) => h('span', {}, holePar(this.holes[i]))),
        row('Score', (i) => {
          const s = scores[i];
          if (!s) return h('span', {}, '');
          const d = s.strokes - s.par;
          return h('span', { class: `sc-s d${clamp(d, -2, 2)}` }, s.strokes);
        }));
    };
    for (let s = 0; s < n; s += 9) chunk(s, Math.min(n, s + 9));
    const tot = scores.filter(Boolean).reduce((a, s) => a + s.strokes, 0), tp = scores.filter(Boolean).reduce((a, s) => a + s.strokes - s.par, 0);
    t.append(h('div', { class: 'sc-total' }, `Total ${tot} (${tp === 0 ? 'E' : tp > 0 ? '+' + tp : tp})`));
    return t;
  }
  async roundSummary() {
    const scores = this.round.scores.filter(Boolean);
    const tot = scores.reduce((a, s) => a + s.strokes, 0), par = scores.reduce((a, s) => a + s.par, 0);
    const tp = tot - par;
    const body = h('div', { class: 'hole-sum' },
      h('div', { class: 'hs-name' }, this.round.courseName),
      h('div', { class: `hs-score s${clamp(Math.sign(tp), -1, 1)}` }, String(tot)),
      h('div', { class: 'hs-sub' }, `${tp === 0 ? 'Even par' : tp > 0 ? `${tp} over par` : `${-tp} under par`} · ${scores.length} holes`),
      this.scorecardTable());
    if (tp < 0) { confetti(160); sfx.applause(2); }
    await modal({ title: 'Round Complete', body, actions: [{ label: 'Done', value: 'exit', cls: 'primary' }], cls: 'sheet', dismiss: false });
    this.exit({});
  }

  // ------------------------------------------------------------------ pickers & menus
  async pauseMenu() {
    if (this.state === 'flight' || this.state === 'swing') return;
    const s = this.settings;
    const body = h('div', { class: 'pause' },
      h('div', { class: 'row' }, h('span', {}, 'Swing control'), segmentedSmall([['swipe', 'Swipe'], ['meter', '3-Tap Meter']], s.swing, async (v) => { this.settings = await saveSettings({ swing: v }); this.configureSwing(); })),
      h('div', { class: 'row' }, h('span', {}, 'Difficulty'), segmentedSmall([['beginner', 'Beginner'], ['amateur', 'Amateur'], ['pro', 'Pro']], s.difficulty, async (v) => { this.settings = await saveSettings({ difficulty: v }); this.configureSwing(); this.previewDirty = true; })),
      this.round ? this.scorecardTable() : null);
    const v = await modal({ title: 'Paused', body, actions: [{ label: 'Resume', value: 'resume', cls: 'primary' }, { label: 'Restart Hole', value: 'restart', cls: 'ghost' }, { label: 'Quit', value: 'quit', cls: 'danger' }], cls: 'sheet' });
    if (v === 'restart') this.loadHole(this.index);
    else if (v === 'quit') this.exit({});
  }
  async clubPicker() {
    if (this.state !== 'aim') return;
    const u = this.settings.units, b = this.ball;
    const grid = h('div', { class: 'club-grid' });
    let chosen = null;
    CLUBS.forEach((c, i) => {
      if (c.id === 'DR' && !b.onTee) return;
      const dist = c.putter ? 'Putt' : (u === 'm' ? `${Math.round(this.cal[c.id].carry)}m` : `${Math.round(this.cal[c.id].carry * M2YD)}y`);
      grid.append(h('button', { class: `club-tile ${i === this.aim.club ? 'on' : ''}`, onclick: () => { chosen = i; grid.closest('.modal-wrap')._close('x'); } }, h('b', {}, c.id === 'PT' ? 'PT' : c.id), h('span', {}, c.name), h('em', {}, dist)));
    });
    await modal({ title: 'Choose Club', body: grid, cls: 'sheet' });
    if (chosen != null) { this.aim.club = chosen - 0; this.cycleClub(0); }
  }
  async shotPicker() {
    if (this.state !== 'aim' || this.club().putter) return;
    const grid = h('div', { class: 'shot-grid' });
    let chosen = null;
    for (const [k, st] of Object.entries(SHOT_TYPES)) {
      if (st.wedge && !this.isWedge()) continue;
      const desc = { normal: 'Stock full swing', draw: 'Curves right-to-left', fade: 'Curves left-to-right, softer', high: 'More height & spin', punch: 'Low, under the wind', chip: 'Low runner around the green', flop: 'Sky high, lands soft' }[k];
      grid.append(h('button', { class: `shot-tile ${k === this.aim.shot ? 'on' : ''}`, onclick: () => { chosen = k; grid.closest('.modal-wrap')._close('x'); } }, h('b', {}, st.label), h('span', {}, desc)));
    }
    await modal({ title: 'Shot Shape', body: grid, cls: 'sheet' });
    if (chosen) { this.aim.shot = chosen; this.configureSwing(); this.previewDirty = true; this.updateHudInfo(); }
  }
  async spinPicker() {
    if (this.state !== 'aim' || this.club().putter) return;
    const pad = h('div', { class: 'spin-pad' }, h('div', { class: 'sp-ball' }, h('i', { class: 'sp-dot' })), h('div', { class: 'sp-labels' }, h('span', { class: 't' }, 'TOPSPIN · more roll'), h('span', { class: 'b' }, 'BACKSPIN · stops fast'), h('span', { class: 'l' }, 'DRAW'), h('span', { class: 'r' }, 'FADE')));
    const ballEl = pad.querySelector('.sp-ball'), dot = pad.querySelector('.sp-dot');
    const set = (x, y) => { const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } this.aim.spin = { x, y }; dot.style.transform = `translate(${x * 60}px, ${y * 60}px)`; };
    set(this.aim.spin.x, this.aim.spin.y);
    const mv = (e) => { const r = ballEl.getBoundingClientRect(); set(((e.clientX - r.left) / r.width - 0.5) * 2.2, ((e.clientY - r.top) / r.height - 0.5) * 2.2); };
    ballEl.addEventListener('pointerdown', (e) => { (() => { try { ballEl.setPointerCapture(e.pointerId); } catch { /* synthetic */ } })(); mv(e); });
    ballEl.addEventListener('pointermove', (e) => { if (e.buttons) mv(e); });
    await modal({ title: 'Ball Spin', body: pad, actions: [{ label: 'Reset', value: 'reset', cls: 'ghost' }, { label: 'Done', value: 'ok', cls: 'primary' }], cls: 'sheet' }).then((v) => { if (v === 'reset') this.aim.spin = { x: 0, y: 0 }; });
    this.previewDirty = true; this.updateHudInfo();
  }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    const sc = this.sc; if (!sc) return;
    const w = this.world;
    if (this.state === 'intro' && this.intro) {
      const it = this.intro;
      it.t += dt;
      const k = smoothstep(0, 1, Math.min(1, it.t / it.dur));
      this.camPos.copy(it.path.getPoint(k)); this.camLook.copy(it.look.getPoint(Math.min(1, k * 1.1)));
      if (it.t >= it.dur) this.endIntro();
    }
    if (this.state === 'aim') {
      if (this.previewDirty) this.computePreview();
      sc.golfer.pose(this.backAngle());
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      const dCam = sc.target.position.distanceTo(this.camera.position);
      const s = clamp(dCam / 40, 0.6, 6) * pulse;
      sc.target.scale.set(s, s, s);
      this.ballPos = null;
    }
    if (this.state === 'swing') {
      this.swingT += dt;
      const putt = this.club().putter;
      const down = putt ? 0.32 : 0.24;
      const a0 = this.swingFrom;
      const follow = putt ? -0.5 * (0.4 + this.swingRes.power) : -2.9;
      let a;
      if (this.swingT < down) a = lerp(a0, 0, Math.pow(this.swingT / down, putt ? 1.2 : 2.2));
      else a = lerp(0, follow, Math.min(1, (this.swingT - down) / (putt ? 0.35 : 0.4)));
      sc.golfer.pose(a);
      if (this.swingT >= down && !this.impacted) { this.impacted = true; this.impact(); }
    } else this.impacted = false;
    if (this.state === 'flight' || this.state === 'result' || this.state === 'holed') {
      if (this.state === 'flight') this.updateFlight(dt);
      const putt = this.flight?.putt;
      if (this.state !== 'holed') sc.golfer.pose(putt ? -0.5 : -2.9);
    }
    if (this.state === 'holed') {
      this.holedT += dt;
      const pin = w.pin, a = this.holedT * 0.25;
      this.camPosT.copy(to3(pin.x + Math.sin(a) * 5, pin.y - Math.cos(a) * 5, w.pinHeight + 1.6));
      this.camLookT.copy(to3(pin.x, pin.y, w.pinHeight + 0.2)); this.camK = 2;
    }
    // ball
    const bp = this.ballPos || { x: this.ball.x, y: this.ball.y, h: this.ball.h };
    sc.ball.position.set(bp.x, bp.h + (0.034 - BALL_R), -bp.y);
    sc.ball.visible = this.state !== 'done' || true;
    const gh = w.heightAt(bp.x, bp.y);
    const air = bp.h - gh;
    sc.ballShadow.position.set(bp.x + 0.0, gh + 0.01, -bp.y);
    sc.ballShadow.material.opacity = clamp(0.4 - air * 0.03, 0, 0.4);
    const ss = 1 + air * 0.05; sc.ballShadow.scale.set(ss, 1, ss);
    // ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]; r.t += dt;
      if (r.m) { const s = 1 + r.t * 6; r.m.scale.set(s, 1, s); r.m.material.opacity = Math.max(0, 0.8 - r.t * 0.5); }
      if (r.pts) {
        const P = r.pts.geometry.attributes.position;
        for (let k = 0; k < P.count; k++) { const v = r.vel[k]; v[1] -= 9.8 * dt; P.setXYZ(k, P.getX(k) + v[0] * dt, P.getY(k) + v[1] * dt, P.getZ(k) + v[2] * dt); }
        P.needsUpdate = true; r.pts.material.opacity = Math.max(0, 0.9 - r.t * 0.8);
      }
      if (r.t > 1.8) { const o = r.m || r.pts; sc.scene.remove(o); o.geometry.dispose(); o.material.dispose(); this.ripples.splice(i, 1); }
    }
    // camera smoothing
    if (this.state !== 'intro') {
      const k = 1 - Math.exp(-dt * this.camK);
      this.camPos.lerp(this.camPosT, k); this.camLook.lerp(this.camLookT, Math.min(1, k * 1.6));
      // keep above terrain
      const ch = w.heightAt(this.camPos.x, -this.camPos.z) + 0.4;
      if (this.camPos.y < ch) this.camPos.y = ch;
    }
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; const s = this.shake * 0.08; this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; }
    this.camera.lookAt(this.camLook);
    sc.update(dt, t, this.camera, sc.ball.position);
  }
}

function segmentedSmall(opts, value, onChange) {
  const el = h('div', { class: 'seg sm' });
  for (const [v, l] of opts) {
    const b = h('button', { class: v === value ? 'on' : '', onclick: () => { el.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(v); } }, l);
    el.append(b);
  }
  return el;
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
void shapePoly; void holeTees; void angleDiff; void btn;
