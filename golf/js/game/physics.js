// Golf ball physics: aerodynamic flight (drag, Magnus lift, spin, wind), surface
// bounces with spin bite, rolling on slopes with green speed, trees, flagstick & cup.
import { S, SURF, CLUBS, SHOT_TYPES } from '../core/data.js';
import { clamp, mulberry32 } from '../core/util.js';

const G = 9.81, R = 0.02135, RHO = 1.225, MASS = 0.04593, AREA = Math.PI * R * R;
const K = (0.5 * RHO * AREA) / MASS;
export const CUP_R = 0.054, BALL_R = R;
const ROLL_G = G * 5 / 7;

export function stimpDecel(stimp) { return (1.83 * 1.83) / (2 * stimp * 0.3048); }
function surfProps(world, s, x, y) {
  const base = SURF[s] || SURF[S.ROUGH];
  if (s === S.GREEN && world.greenAt) {
    const g = world.greenAt(x, y);
    if (g) return { ...base, roll: stimpDecel(g.stimp), rest: base.rest * (g.firm === 0 ? 0.72 : g.firm === 2 ? 1.3 : 1), grab: base.grab * (g.firm === 0 ? 1.25 : g.firm === 2 ? 0.75 : 1) };
  }
  return base;
}

/**
 * Simulate a shot.
 * start {x,y,h}, launch {speed, angle(rad), heading(rad), backspin(rpm), tilt(rad), roll(bool)}
 * opts {wind:{x,y}, seed, flagIn, stopAtLand, maxT}
 */
export function simulate(world, start, launch, opts = {}) {
  const rng = mulberry32(opts.seed || 1);
  const wind = opts.wind || { x: 0, y: 0 };
  const flagIn = opts.flagIn !== false;
  const pin = world.pin, pinH = world.pinHeight ?? world.heightAt(pin.x, pin.y);
  const path = [], events = [];
  const p = { x: start.x, y: start.y, h: start.h };
  const hd = launch.heading;
  const ca = Math.cos(launch.angle);
  const v = { x: launch.speed * ca * Math.sin(hd), y: launch.speed * ca * Math.cos(hd), h: launch.speed * Math.sin(launch.angle) };
  let bs = (launch.backspin || 0) * Math.PI / 30, ss = bs * Math.sin(launch.tilt || 0);
  bs *= Math.cos(launch.tilt || 0);
  const rx = Math.cos(hd), ry = -Math.sin(hd); // right vector (backspin axis)
  let mode = launch.roll ? 'roll' : 'flight';
  let t = 0, nextRec = 0, carry = null, landing = null, apex = start.h, bounces = 0;
  let lastDry = { x: p.x, y: p.y }, state = 'rest';
  const inTree = new Set();
  const dt = 1 / 240, maxT = opts.maxT || 40;
  const rec = () => { path.push({ t, x: p.x, y: p.y, h: p.h }); };
  rec();
  const ev = (type, extra = {}) => events.push({ t, type, x: p.x, y: p.y, h: p.h, ...extra });
  let stillTime = 0;

  while (t < maxT) {
    t += dt;
    if (mode === 'flight') {
      const gnd0 = world.heightAt(p.x, p.y);
      const hAbove = Math.max(0, p.h - gnd0);
      const wf = clamp(0.35 + hAbove / 22, 0.35, 1.3);
      const vrx = v.x - wind.x * wf, vry = v.y - wind.y * wf, vrh = v.h;
      const sp = Math.hypot(vrx, vry, vrh) || 1e-6;
      const wmag = Math.hypot(bs, ss);
      const Sp = clamp((R * wmag) / sp, 0, 0.5);
      const Cd = 0.22 + 0.32 * Sp;
      const CL = Math.min(0.34, 1.85 * Sp);
      // omega = bs*r - ss*u ; lift dir = omega x vrel
      const ox = bs * rx, oy = bs * ry, oh = -ss;
      let lx = oy * vrh - oh * vry, ly = oh * vrx - ox * vrh, lh = ox * vry - oy * vrx;
      const ll = Math.hypot(lx, ly, lh) || 1;
      lx /= ll; ly /= ll; lh /= ll;
      const kd = K * Cd * sp, kl = K * CL * sp * sp * (wmag > 1 ? 1 : wmag);
      v.x += (-kd * vrx + kl * lx) * dt;
      v.y += (-kd * vry + kl * ly) * dt;
      v.h += (-kd * vrh + kl * lh - G) * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.h += v.h * dt;
      const decay = Math.exp(-dt / 22); bs *= decay; ss *= decay;
      if (p.h > apex) apex = p.h;
      if (!world.inDomain(p.x, p.y)) { state = 'oob'; ev('oob'); break; }
      if (world.surfAt(p.x, p.y) !== S.WATER) lastDry = { x: p.x, y: p.y };
      // obstacles
      const near = world.colliders.near(p.x, p.y);
      for (const c of near) hitObstacle(c, p, v, rng, inTree, ev, dt);
      // flagstick
      if (flagIn) {
        const dxp = p.x - pin.x, dyp = p.y - pin.y, dp = Math.hypot(dxp, dyp);
        if (dp < 0.0125 + R && p.h > pinH && p.h < pinH + 2.3) {
          const nx = dxp / (dp || 1), ny = dyp / (dp || 1), vd = v.x * nx + v.y * ny;
          if (vd < 0) { v.x -= 1.6 * vd * nx; v.y -= 1.6 * vd * ny; v.x *= 0.3; v.y *= 0.3; ev('pin'); }
        }
      }
      const gnd = world.heightAt(p.x, p.y);
      const wl = world.waterAt(p.x, p.y);
      if (!Number.isNaN(wl) && wl > gnd && p.h - R <= wl && world.surfAt(p.x, p.y) === S.WATER) {
        p.h = wl; state = 'water'; ev('splash', { speed: Math.hypot(v.x, v.y, v.h) });
        if (carry == null) { carry = Math.hypot(p.x - start.x, p.y - start.y); landing = { x: p.x, y: p.y, surf: S.WATER }; }
        break;
      }
      if (p.h - R <= gnd) {
        p.h = gnd + R;
        const s = world.surfAt(p.x, p.y);
        const sp2 = Math.hypot(v.x, v.y, v.h);
        if (carry == null) { carry = Math.hypot(p.x - start.x, p.y - start.y); landing = { x: p.x, y: p.y, surf: s }; }
        // slam dunk
        if (Math.hypot(p.x - pin.x, p.y - pin.y) < CUP_R && Math.hypot(v.x, v.y) < 7) { state = 'holed'; ev('cup', { dunk: true }); rec(); break; }
        const n = world.normalAt(p.x, p.y);
        const vn = v.x * n[0] + v.y * n[1] + v.h * n[2];
        if (vn < 0) {
          const P = surfProps(world, s, p.x, p.y);
          const impact = -vn;
          let tx = v.x - vn * n[0], ty = v.y - vn * n[1], th = v.h - vn * n[2];
          const e0 = P.rest * clamp(1.12 - impact / 45, 0.45, 1.08);
          // Coulomb friction: tangential impulse limited by mu * normal impulse
          const tl0 = Math.hypot(tx, ty, th);
          if (tl0 > 1e-4) {
            const dv = Math.min(tl0 * 0.92, P.fric * 1.05 * (1 + e0) * impact + 0.3);
            const f = (tl0 - dv) / tl0;
            tx *= f; ty *= f; th *= f;
          }
          const tl = Math.hypot(tx, ty, th);
          if (tl > 1e-4 && bs > 0) {
            const bite = bs * R * P.grab * clamp(impact / 10, 0.25, 1.35);
            const nl = Math.max(tl - bite, -Math.min(2.2, tl * 0.4));
            const k = nl / tl;
            tx *= k; ty *= k; th *= k;
          }
          // side spin kick
          const kick = ss * R * P.grab * 0.35;
          tx += rx * kick; ty += ry * kick;
          const e = e0;
          v.x = tx - vn * e * n[0]; v.y = ty - vn * e * n[1]; v.h = th - vn * e * n[2];
          bs *= 0.4; ss *= 0.4;
          bounces++;
          ev(bounces === 1 ? 'land' : 'bounce', { surf: s, speed: sp2, impact });
          if (s === S.BUNKER && impact > 6 && rng() < 0.35) { v.x *= 0.1; v.y *= 0.1; v.h = 0; ev('plug'); }
          if (impact * e < 0.9) mode = 'roll';
        }
      }
    } else if (mode === 'roll') {
      const s = world.surfAt(p.x, p.y);
      const P = surfProps(world, s, p.x, p.y);
      const n = world.normalAt(p.x, p.y);
      const gx = ROLL_G * n[2] * n[0], gy = ROLL_G * n[2] * n[1], gh = -ROLL_G * (1 - n[2] * n[2]);
      const gmag = Math.hypot(gx, gy, gh);
      const sp = Math.hypot(v.x, v.y, v.h);
      let decel = P.roll;
      if (sp < 0.6 && s !== S.GREEN && s !== S.FRINGE) decel *= 1.6;
      // leftover backspin makes the ball check up after landing
      if (bs > 30) { decel += Math.min(6, bs * R * P.grab * 0.9); bs *= Math.exp(-dt * 3.5); }
      if (sp > 1e-3) {
        const ax = gx - decel * v.x / sp, ay = gy - decel * v.y / sp, ah = gh - decel * v.h / sp;
        const nvx = v.x + ax * dt, nvy = v.y + ay * dt, nvh = v.h + ah * dt;
        if (nvx * v.x + nvy * v.y + nvh * v.h < 0 && gmag < decel) { v.x = v.y = v.h = 0; }
        else { v.x = nvx; v.y = nvy; v.h = nvh; }
      } else if (gmag > decel * 1.08) {
        v.x += gx * dt * 0.5; v.y += gy * dt * 0.5; v.h += gh * dt * 0.5;
      } else { v.x = v.y = v.h = 0; }
      const ph = p.h;
      p.x += v.x * dt; p.y += v.y * dt;
      if (!world.inDomain(p.x, p.y)) { state = 'oob'; ev('oob'); break; }
      const gnd = world.heightAt(p.x, p.y);
      const ballistic = ph + v.h * dt;
      if (ballistic - R > gnd + 0.04 && sp > 2.5) { p.h = ballistic; mode = 'flight'; }
      else {
        p.h = gnd + R;
        const n2 = world.normalAt(p.x, p.y);
        const vn = v.x * n2[0] + v.y * n2[1] + v.h * n2[2];
        v.x -= vn * n2[0]; v.y -= vn * n2[1]; v.h -= vn * n2[2];
      }
      const s2 = world.surfAt(p.x, p.y);
      if (s2 !== S.WATER) lastDry = { x: p.x, y: p.y };
      const wl = world.waterAt(p.x, p.y);
      if (s2 === S.WATER && !Number.isNaN(wl) && wl > gnd + 0.02) { state = 'water'; p.h = wl; ev('splash', { speed: sp }); break; }
      // obstacles at ground level
      for (const c of world.colliders.near(p.x, p.y)) if (c.solid || c.trunk || c.box) hitObstacle(c, p, v, rng, inTree, ev, dt);
      // cup
      const dxp = p.x - pin.x, dyp = p.y - pin.y, dp = Math.hypot(dxp, dyp);
      const hs = Math.hypot(v.x, v.y);
      if (dp < CUP_R + R * 0.25) {
        if (hs < 1.3 || (dp < CUP_R * 0.6 && hs < 1.7)) { state = 'holed'; ev('cup'); p.x = pin.x; p.y = pin.y; p.h = gnd - 0.06; rec(); break; }
        if (!events.some((e) => e.type === 'lip' && t - e.t < 0.3) && hs < 2.4) {
          const ang = (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.9);
          const c = Math.cos(ang), sn = Math.sin(ang);
          const nx = v.x * c - v.y * sn, ny = v.x * sn + v.y * c;
          v.x = nx * 0.55; v.y = ny * 0.55; ev('lip');
        }
      } else if (flagIn && dp < 0.0125 + R + 0.01) {
        if (hs < 2.5) { state = 'holed'; ev('cup', { pin: true }); p.x = pin.x; p.y = pin.y; p.h = gnd - 0.06; rec(); break; }
        v.x = -v.x * 0.3; v.y = -v.y * 0.3; ev('pin');
      }
      if (Math.hypot(v.x, v.y, v.h) < 0.02) {
        stillTime += dt;
        if (stillTime > 0.15 && gmag <= decel * 1.08) { state = 'rest'; break; }
      } else stillTime = 0;
    }
    if (opts.stopAtLand && carry != null) break;
    if (t >= nextRec) { rec(); nextRec = t + 1 / 60; }
  }
  rec();
  if (state === 'rest' && world.isOOB(p.x, p.y)) state = 'oob';
  const end = { x: p.x, y: p.y, h: p.h, surf: world.surfAt(p.x, p.y) };
  return {
    path, events, end, state, carry: carry ?? Math.hypot(p.x - start.x, p.y - start.y), landing: landing || { x: p.x, y: p.y, surf: end.surf },
    total: Math.hypot(p.x - start.x, p.y - start.y), apex: apex - start.h, lastDry, duration: t,
  };
}

function hitObstacle(c, p, v, rng, inTree, ev, dt) {
  const dx = p.x - c.x, dy = p.y - c.y, hr = Math.hypot(dx, dy);
  const z = p.h - c.base;
  if (z < -0.5) return;
  const bounceCyl = (rad, height, rest, type) => {
    if (hr < rad + R && z < height) {
      const nx = dx / (hr || 1), ny = dy / (hr || 1), vd = v.x * nx + v.y * ny;
      if (vd < 0) {
        v.x -= (1 + rest) * vd * nx; v.y -= (1 + rest) * vd * ny;
        v.x *= 0.7; v.y *= 0.7; v.h *= 0.7;
        p.x = c.x + nx * (rad + R + 0.01); p.y = c.y + ny * (rad + R + 0.01);
        ev(type);
      }
      return true;
    }
    return false;
  };
  if (c.solid && bounceCyl(c.solid[0], c.solid[1], 0.35, c.kind === 'saguaro' || c.kind === 'pricklypear' || c.kind === 'barrel' ? 'cactus' : 'rock')) return;
  if (c.trunk && bounceCyl(c.trunk[0], c.trunk[1] + (c.canopy ? c.canopy[0] - c.canopy[2] - c.trunk[1] : 0) * 0.5 + 0.01, 0.45, 'trunk')) return;
  if (c.box) {
    const cs = Math.cos(-c.r), sn = Math.sin(-c.r);
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
    const [bx, bh, by] = c.box;
    if (Math.abs(lx) < bx + R && Math.abs(ly) < by + R && z < bh) {
      // push out along smallest axis
      const px = bx + R - Math.abs(lx), py = by + R - Math.abs(ly), ph = bh - z;
      const lvx = v.x * cs - v.y * sn, lvy = v.x * sn + v.y * cs;
      let nlx = lvx, nly = lvy;
      if (ph < px && ph < py && v.h < 0) { p.h = c.base + bh + R; v.h = -v.h * 0.3; }
      else if (px < py) nlx = -lvx * 0.35; else nly = -lvy * 0.35;
      const ic = Math.cos(c.r), is = Math.sin(c.r);
      v.x = nlx * ic - nly * is; v.y = nlx * is + nly * ic;
      ev('trunk');
    }
    return;
  }
  if (c.canopy) {
    const [cy, rad, hh, dens] = c.canopy;
    const qd = (hr / rad) ** 2 + ((z - cy) / hh) ** 2;
    if (qd < 1) {
      if (!inTree.has(c)) {
        inTree.add(c); ev('tree');
        if (rng() < (dens / 11) * (1.1 - qd * 0.5)) {
          const sp = Math.hypot(v.x, v.y, v.h) * (0.12 + rng() * 0.25);
          const a = rng() * Math.PI * 2;
          v.x = Math.cos(a) * sp; v.y = Math.sin(a) * sp; v.h = (rng() - 0.7) * sp;
          ev('branch');
        }
      }
      const damp = Math.exp(-dens * 0.85 * dt * (1.25 - qd));
      const sp = Math.hypot(v.x, v.y, v.h);
      v.x = v.x * damp + (rng() - 0.5) * sp * 0.5 * dt; v.y = v.y * damp + (rng() - 0.5) * sp * 0.5 * dt; v.h = v.h * damp + (rng() - 0.6) * sp * 0.4 * dt;
    }
  }
}

// Club calibration --------------------------------------------------------------------
const FLAT = {
  heightAt: () => 0, normalAt: () => [0, 0, 1], surfAt: () => S.FAIRWAY, waterAt: () => NaN, isOOB: () => false, inDomain: () => true,
  colliders: { near: () => [] }, pin: { x: 1e6, y: 1e6 }, pinHeight: 0, greenAt: () => null,
};
const calCache = new Map();
export function calibrate(powerScale = 1) {
  const key = powerScale.toFixed(2);
  if (calCache.has(key)) return calCache.get(key);
  const out = {};
  for (const c of CLUBS) {
    if (c.putter) { out[c.id] = { speed: 0, carry: 0, total: 0 }; continue; }
    const target = (c.carry / 1.09361) * powerScale;
    let lo = 10, hi = 110;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const r = simulate(FLAT, { x: 0, y: 0, h: R }, { speed: mid, angle: c.launch * Math.PI / 180, heading: 0, backspin: c.spin, tilt: 0 }, { stopAtLand: true, flagIn: false });
      if (r.carry < target) lo = mid; else hi = mid;
    }
    const speed = (lo + hi) / 2;
    const full = simulate(FLAT, { x: 0, y: 0, h: R }, { speed, angle: c.launch * Math.PI / 180, heading: 0, backspin: c.spin, tilt: 0 }, { flagIn: false });
    out[c.id] = { speed, carry: target, total: full.total, apex: full.apex };
  }
  calCache.set(key, out);
  return out;
}

// Turns swing input into launch conditions -----------------------------------------------
export const PUTT_RANGES = [3, 5, 8, 12, 18, 25, 35, 50];
export function puttRange(dist) {
  for (const r of PUTT_RANGES) if (r >= dist * 1.25) return r;
  return PUTT_RANGES[PUTT_RANGES.length - 1];
}
export function lieFactor(club, lie, nearGreen) {
  const L = SURF[lie] || SURF[S.ROUGH];
  if (lie === S.BUNKER) return club.sand ? (nearGreen ? 0.62 : 0.82) : club.id === 'DR' || club.id.endsWith('W') ? 0.45 : 0.7;
  if (lie === S.TEE) return 1;
  if ((club.id === 'DR') && lie !== S.TEE) return 0.82;
  return L.power;
}
export function makeLaunch(club, cal, o) {
  // o: { power, acc, lie, shot, spin:{x,y}, heading, nearGreen, puttRange, greenDecel }
  if (club.putter) {
    const d = Math.max(0.05, o.power) * o.puttRange;
    const speed = Math.sqrt(2 * o.greenDecel * d);
    return { speed, angle: 0, heading: o.heading + o.acc * 0.022, backspin: 0, tilt: 0, roll: true };
  }
  const st = SHOT_TYPES[o.shot] || SHOT_TYPES.normal;
  const L = SURF[o.lie] || SURF[S.ROUGH];
  const lf = lieFactor(club, o.lie, o.nearGreen);
  const p = Math.max(0.02, o.power);
  const speed = cal[club.id].speed * Math.pow(p, 0.78) * st.power * lf;
  let angle = club.launch + st.launch - (o.spin?.y || 0) * 1.5;
  if (o.lie === S.BUNKER && club.sand) angle += 6;
  if (o.lie === S.ROUGH || o.lie === S.DEEP) angle += 1.5;
  angle = clamp(angle, 2, 62);
  let rpm = club.spin * st.spin * L.spin * (1 - (o.spin?.y || 0) * 0.5) * (0.75 + 0.25 * p);
  if (o.lie === S.BUNKER && club.sand) rpm *= 1.6;
  const accMul = L.acc;
  const heading = o.heading + o.acc * 0.03 * accMul;
  const tilt = o.acc * 0.26 * accMul + st.curve * 0.13 + (o.spin?.x || 0) * 0.2;
  return { speed, angle: angle * Math.PI / 180, heading, backspin: rpm, tilt, roll: false };
}
