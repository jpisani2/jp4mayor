// Compiles a hole design into a playable world: heightfield, surface map,
// water levels, colliders and auto-generated decoration.
import { S, SHAPES, SHAPE_ORDER, OBJ, CLIMATES } from './data.js';
import { shapePoly, holeTees, greens } from './hole.js';
import {
  clamp, lerp, smoothstep, fbm, mulberry32, polyBBox, pointInPoly, polyCentroid, distanceTransform,
  distToSeg, polyArea, hashStr, M2YD, polylineLength,
} from './util.js';

const MARGIN = 60;

export function compileHole(hole, opts = {}) {
  const t0 = performance.now();
  const W = hole.width, L = hole.length;
  const M = opts.margin ?? MARGIN;
  const rect = { x0: -W / 2, x1: W / 2, y0: -45, y1: L };
  const x0 = rect.x0 - M, y0 = rect.y0 - M;
  const spanX = W + 2 * M, spanY = rect.y1 - rect.y0 + 2 * M;
  let hr = Math.max(opts.minRes || 1, Math.sqrt((spanX * spanY) / (opts.maxVerts || 140000)));
  hr = Math.ceil(hr * 4) / 4;
  const hw = Math.ceil(spanX / hr) + 1, hh = Math.ceil(spanY / hr) + 1;
  const x1 = x0 + (hw - 1) * hr, y1 = y0 + (hh - 1) * hr;
  const heights = new Float32Array(hw * hh);
  const waterLevel = new Float32Array(hw * hh).fill(NaN);
  const T = hole.terrain;

  const tees = holeTees(hole);
  const teeP = tees.length ? tees[0].spot : [0, 0];
  const pin = [hole.pin.x, hole.pin.y];
  const ax = pin[0] - teeP[0], ay = pin[1] - teeP[1];
  const alen2 = Math.max(1, ax * ax + ay * ay);
  const plane = (x, y) => {
    let t = ((x - teeP[0]) * ax + (y - teeP[1]) * ay) / alen2;
    t = t < -0.3 ? -0.3 + (t + 0.3) * 0.25 : t > 1.25 ? 1.25 + (t - 1.25) * 0.25 : t;
    return T.elev * t + (T.cross / 100) * x;
  };

  // 1. base terrain: plane + rolling noise
  const seed = T.seed | 0, sc = Math.max(10, T.scale), roll = T.roll;
  for (let j = 0; j < hh; j++) {
    const y = y0 + j * hr;
    for (let i = 0; i < hw; i++) {
      const x = x0 + i * hr;
      heights[j * hw + i] = plane(x, y) + roll * 1.6 * fbm(x / sc, y / sc, seed, 3);
    }
  }
  // 2. sculpted features
  for (const f of hole.features || []) {
    const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
    const R = Math.max(f.rx, f.ry);
    const i0 = Math.max(0, Math.floor((f.x - R - x0) / hr)), i1 = Math.min(hw - 1, Math.ceil((f.x + R - x0) / hr));
    const j0 = Math.max(0, Math.floor((f.y - R - y0) / hr)), j1 = Math.min(hh - 1, Math.ceil((f.y + R - y0) / hr));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + i * hr - f.x, dy = y0 + j * hr - f.y;
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      const d = Math.sqrt((lx / f.rx) ** 2 + (ly / f.ry) ** 2);
      if (d >= 1) continue;
      let p;
      if (f.profile === 'plateau') p = 1 - smoothstep(0.55, 1, d);
      else if (f.profile === 'sharp') p = Math.pow(1 - d, 1.5) * (1 - 0.15 * d);
      else { const q = 1 - d * d; p = q * q; }
      heights[j * hw + i] += f.h * p;
    }
  }

  const H = { x0, y0, hr, hw, hh, heights };
  const hAt = (x, y) => bilinear(H, x, y);

  // Window helper on the height grid
  const win = (bb, pad) => {
    const i0 = Math.max(0, Math.floor((bb.x0 - pad - x0) / hr)), i1 = Math.min(hw - 1, Math.ceil((bb.x1 + pad - x0) / hr));
    const j0 = Math.max(0, Math.floor((bb.y0 - pad - y0) / hr)), j1 = Math.min(hh - 1, Math.ceil((bb.y1 + pad - y0) / hr));
    return { i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1, gx: x0 + i0 * hr, gy: y0 + j0 * hr };
  };

  const shapesOf = (types) => hole.shapes.filter((s) => types.includes(s.type));

  // 3. tees: flatten into raised pads
  for (const t of shapesOf(['tee'])) {
    const poly = shapePoly(t), bb = polyBBox(poly);
    const raise = t.props.raise ?? 0.5, F = 2.5 + raise * 2.2;
    const w = win(bb, F + 1);
    const mask = rasterPoly(poly, w.gx, w.gy, hr, w.w, w.h);
    const dOut = distanceTransform(mask, w.w, w.h, false);
    const c = polyCentroid(poly);
    const h0 = hAt(c[0], c[1]) + raise;
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const k = j * w.w + i, gi = (w.j0 + j) * hw + w.i0 + i;
      const t2 = mask[k] ? 1 : 1 - smoothstep(0, F, dOut[k] * hr);
      if (t2 > 0) heights[gi] = lerp(heights[gi], h0, t2);
    }
  }
  // 4. greens: designed putting surfaces
  const greenInfo = [];
  for (const g of shapesOf(['green'])) {
    const P = g.props, poly = shapePoly(g), bb = polyBBox(poly);
    const elev = P.elevation || 0, F = 6 + Math.abs(elev) * 2.5;
    const w = win(bb, F + 1);
    const mask = rasterPoly(poly, w.gx, w.gy, hr, w.w, w.h);
    const dOut = distanceTransform(mask, w.w, w.h, false);
    const c = polyCentroid(poly);
    const rad = Math.sqrt(polyArea(poly) / Math.PI);
    const h0 = hAt(c[0], c[1]) + elev;
    const sd = (P.slopeDir || 0) * Math.PI / 180;
    const dx = Math.sin(sd), dy = Math.cos(sd);
    const gseed = hashStr(g.id) % 9973;
    const tiers = P.tiers | 0, tierH = P.tierH ?? 0.6;
    const bounds = tiers === 1 ? [0] : tiers === 2 ? [-0.38, 0.38] : [];
    const target = (x, y) => {
      const along = (x - c[0]) * dx + (y - c[1]) * dy;
      let h = h0 - (P.slope / 100) * along;
      h += (P.undulation || 0) * 0.42 * fbm(x / 7.5, y / 7.5, gseed, 2);
      for (const b of bounds) h -= tierH * smoothstep(b - 0.13, b + 0.13, along / rad);
      return h;
    };
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const k = j * w.w + i, gi = (w.j0 + j) * hw + w.i0 + i;
      const t2 = mask[k] ? 1 : 1 - smoothstep(0, F, dOut[k] * hr);
      if (t2 > 0) heights[gi] = lerp(heights[gi], target(x0 + (w.i0 + i) * hr, y0 + (w.j0 + j) * hr), t2);
    }
    greenInfo.push({ shape: g, poly, c, rad, stimp: P.stimp || 10, firm: P.firmness ?? 1 });
  }
  // 5. bunkers
  for (const b of shapesOf(['bunker', 'fbunker', 'pot'])) {
    const P = b.props, poly = shapePoly(b), bb = polyBBox(poly);
    const w = win(bb, 2.5);
    const mask = rasterPoly(poly, w.gx, w.gy, hr, w.w, w.h);
    const dIn = distanceTransform(mask, w.w, w.h, true);
    const dOut = distanceTransform(mask, w.w, w.h, false);
    const depth = P.depth ?? 0.8, lip = Math.max(0.3, P.lip ?? 1.2);
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const k = j * w.w + i, gi = (w.j0 + j) * hw + w.i0 + i;
      if (mask[k]) heights[gi] -= depth * smoothstep(0, lip, (dIn[k] - 0.5) * hr);
      else heights[gi] += depth * 0.18 * (1 - smoothstep(0, 1.6, dOut[k] * hr));
    }
  }
  // 6. ponds & lakes
  const waters = [];
  for (const wt of shapesOf(['water'])) {
    const P = wt.props, poly = shapePoly(wt), bb = polyBBox(poly);
    const w = win(bb, 6);
    const mask = rasterPoly(poly, w.gx, w.gy, hr, w.w, w.h);
    const dIn = distanceTransform(mask, w.w, w.h, true);
    const dOut = distanceTransform(mask, w.w, w.h, false);
    const edge = [];
    for (let k = 0; k < mask.length; k++) if (!mask[k] && dOut[k] <= 1.5) edge.push(heights[(w.j0 + Math.floor(k / w.w)) * hw + w.i0 + (k % w.w)]);
    edge.sort((a, b) => a - b);
    const level = (edge.length ? edge[Math.floor(edge.length * 0.03)] : hAt(...polyCentroid(poly))) - 0.3;
    const depth = P.depth ?? 1.6;
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const k = j * w.w + i, gi = (w.j0 + j) * hw + w.i0 + i;
      if (mask[k]) {
        heights[gi] = Math.min(heights[gi], level - 0.15 - depth * smoothstep(0, 5, dIn[k] * hr));
        waterLevel[gi] = level;
      } else {
        const d = dOut[k] * hr;
        if (d < 5) heights[gi] = Math.min(heights[gi], level + 0.12 + d * 0.32);
        if (d <= hr * 1.01) waterLevel[gi] = level;
      }
    }
    waters.push({ shape: wt, poly, level });
  }
  // 7. creeks
  const creeks = [];
  for (const cr of shapesOf(['creek'])) {
    const P = cr.props, pts = resampleLine(shapePoly(cr), 2);
    if (pts.length < 2) continue;
    const halfW = (P.width || 4) / 2, depth = P.depth ?? 1, bank = 2.5;
    let lv = pts.map((p) => hAt(p[0], p[1]) - 0.55);
    for (let pass = 0; pass < 6; pass++) lv = lv.map((v, i) => (lv[Math.max(0, i - 1)] + v + lv[Math.min(lv.length - 1, i + 1)]) / 3);
    const bb = polyBBox(pts);
    const w = win(bb, halfW + bank + 1);
    const dist = new Float32Array(w.w * w.h).fill(1e9), lvl = new Float32Array(w.w * w.h);
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1], R = halfW + bank;
      const si0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R - w.gx) / hr)), si1 = Math.min(w.w - 1, Math.ceil((Math.max(a[0], b[0]) + R - w.gx) / hr));
      const sj0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R - w.gy) / hr)), sj1 = Math.min(w.h - 1, Math.ceil((Math.max(a[1], b[1]) + R - w.gy) / hr));
      for (let j = sj0; j <= sj1; j++) for (let i = si0; i <= si1; i++) {
        const k = j * w.w + i;
        const d = distToSeg(w.gx + i * hr, w.gy + j * hr, a[0], a[1], b[0], b[1]);
        if (d < dist[k]) { dist[k] = d; lvl[k] = (lv[s] + lv[s + 1]) / 2; }
      }
    }
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const k = j * w.w + i, d = dist[k];
      if (d > halfW + bank) continue;
      const gi = (w.j0 + j) * hw + w.i0 + i, level = lvl[k];
      let target;
      if (d < halfW) target = level - 0.1 - depth * (1 - (d / halfW) ** 2);
      else target = level + 0.1 + (d - halfW) * 0.45;
      heights[gi] = Math.min(heights[gi], target);
      if (d < halfW + 0.35) waterLevel[gi] = level;
    }
    creeks.push({ shape: cr, pts, levels: lv, halfW });
  }
  // 8. blend to plane at domain edge (seam with far terrain)
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
    const e = Math.min(i, j, hw - 1 - i, hh - 1 - j) * hr;
    if (e >= 30) continue;
    const t2 = smoothstep(0, 30, e), k = j * hw + i;
    heights[k] = lerp(plane(x0 + i * hr, y0 + j * hr), heights[k], t2);
    if (t2 < 1) waterLevel[k] = NaN;
  }

  const world = {
    hole, rect, x0, y0, x1, y1, hr, hw, hh, heights, waterLevel, plane, waters, creeks, greens: greenInfo,
    pin: { x: hole.pin.x, y: hole.pin.y }, tees,
    climate: CLIMATES[hole.climate] || CLIMATES.parkland,
  };
  world.heightAt = (x, y) => bilinear(H, x, y);
  world.normalAt = (x, y) => {
    const e = hr * 0.5;
    const dx = (world.heightAt(x + e, y) - world.heightAt(x - e, y)) / (2 * e);
    const dy = (world.heightAt(x, y + e) - world.heightAt(x, y - e)) / (2 * e);
    const l = Math.hypot(dx, dy, 1);
    return [-dx / l, -dy / l, 1 / l];
  };
  world.waterAt = (x, y) => {
    const i = Math.round((x - x0) / hr), j = Math.round((y - y0) / hr);
    if (i < 0 || j < 0 || i >= hw || j >= hh) return NaN;
    return waterLevel[j * hw + i];
  };
  world.pinHeight = world.heightAt(hole.pin.x, hole.pin.y);
  if (opts.heightsOnly) { world.ms = performance.now() - t0; return world; }

  // Surface raster -----------------------------------------------------------------------
  const sr = opts.surfRes || 0.5;
  const sw = Math.ceil((x1 - x0) / sr), sh = Math.ceil((y1 - y0) / sr);
  const surf = new Uint8Array(sw * sh).fill(hole.ground === 'native' ? S.NATIVE : S.ROUGH);
  const oob = new Uint8Array(sw * sh);
  const swin = (bb, pad) => {
    const i0 = Math.max(0, Math.floor((bb.x0 - pad - x0) / sr)), i1 = Math.min(sw - 1, Math.ceil((bb.x1 + pad - x0) / sr));
    const j0 = Math.max(0, Math.floor((bb.y0 - pad - y0) / sr)), j1 = Math.min(sh - 1, Math.ceil((bb.y1 + pad - y0) / sr));
    return { i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1, gx: x0 + i0 * sr, gy: y0 + j0 * sr };
  };
  const LOW = new Set([S.ROUGH, S.DEEP, S.NATIVE, S.MULCH, S.OOB]);
  const ordered = [...hole.shapes].sort((a, b) => SHAPE_ORDER.indexOf(a.type) - SHAPE_ORDER.indexOf(b.type));
  for (const sh of ordered) {
    const def = SHAPES[sh.type];
    const poly = shapePoly(sh);
    if (poly.length < 2) continue;
    if (def.kind === 'line') {
      const halfW = (sh.props.width || 2) / 2;
      const bb = polyBBox(poly), w = swin(bb, halfW + 1);
      const val = def.surf;
      for (let s = 0; s < poly.length - 1; s++) {
        const a = poly[s], b = poly[s + 1];
        const si0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - halfW - w.gx) / sr)), si1 = Math.min(w.w - 1, Math.ceil((Math.max(a[0], b[0]) + halfW - w.gx) / sr));
        const sj0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - halfW - w.gy) / sr)), sj1 = Math.min(w.h - 1, Math.ceil((Math.max(a[1], b[1]) + halfW - w.gy) / sr));
        for (let j = sj0; j <= sj1; j++) for (let i = si0; i <= si1; i++) {
          if (distToSeg(w.gx + i * sr, w.gy + j * sr, a[0], a[1], b[0], b[1]) <= halfW) surf[(w.j0 + j) * sw + w.i0 + i] = val;
        }
      }
      continue;
    }
    const bb = polyBBox(poly);
    const ring = sh.type === 'fairway' ? sh.props.firstCut || 0 : sh.type === 'green' ? sh.props.fringe ?? 1.3 : 0;
    const w = swin(bb, ring + 1);
    const mask = rasterPoly(poly, w.gx, w.gy, sr, w.w, w.h);
    if (ring > 0) {
      const dOut = distanceTransform(mask, w.w, w.h, false);
      const rv = sh.type === 'fairway' ? S.FIRSTCUT : S.FRINGE;
      for (let k = 0; k < mask.length; k++) {
        if (mask[k] || dOut[k] * sr > ring) continue;
        const gi = (w.j0 + Math.floor(k / w.w)) * sw + w.i0 + (k % w.w);
        const cur = surf[gi];
        if (sh.type === 'fairway' ? LOW.has(cur) : cur !== S.GREEN && cur !== S.WATER && cur !== S.BUNKER) surf[gi] = rv;
      }
    }
    for (let k = 0; k < mask.length; k++) {
      if (!mask[k]) continue;
      const gi = (w.j0 + Math.floor(k / w.w)) * sw + w.i0 + (k % w.w);
      if (sh.type === 'oob') oob[gi] = 1; else surf[gi] = def.surf;
    }
  }
  if (hole.decor?.oobEdge !== false) {
    for (let j = 0; j < sh; j++) {
      const y = y0 + (j + 0.5) * sr;
      for (let i = 0; i < sw; i++) {
        const x = x0 + (i + 0.5) * sr;
        if (x < rect.x0 || x > rect.x1 || y < rect.y0 || y > rect.y1) oob[j * sw + i] = 1;
      }
    }
  }
  Object.assign(world, { sr, sw, sh, surf, oob });
  world.surfAt = (x, y) => {
    const i = Math.floor((x - x0) / sr), j = Math.floor((y - y0) / sr);
    if (i < 0 || j < 0 || i >= sw || j >= sh) return S.OOB;
    return surf[j * sw + i];
  };
  world.isOOB = (x, y) => {
    const i = Math.floor((x - x0) / sr), j = Math.floor((y - y0) / sr);
    if (i < 0 || j < 0 || i >= sw || j >= sh) return true;
    return oob[j * sw + i] === 1;
  };
  world.greenAt = (x, y) => {
    for (const g of greenInfo) if (pointInPoly(x, y, g.poly)) return g;
    return null;
  };
  world.inDomain = (x, y) => x > x0 + 2 && x < x1 - 2 && y > y0 + 2 && y < y1 - 2;

  // Decor & colliders -------------------------------------------------------------------
  world.decor = opts.noDecor ? [] : buildDecor(world);
  const all = [...(hole.objects || []), ...world.decor.filter((d) => OBJ[d.kind])];
  world.colliders = buildColliders(world, all);
  world.ms = performance.now() - t0;
  return world;
}

export function bilinear(H, x, y) {
  let gx = (x - H.x0) / H.hr, gy = (y - H.y0) / H.hr;
  gx = clamp(gx, 0, H.hw - 1.0001); gy = clamp(gy, 0, H.hh - 1.0001);
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const k = j * H.hw + i, h = H.heights;
  return (h[k] * (1 - fx) + h[k + 1] * fx) * (1 - fy) + (h[k + H.hw] * (1 - fx) + h[k + H.hw + 1] * fx) * fy;
}

// Scanline polygon raster into a w*h mask whose cell (i,j) center is (gx+i*res, gy+j*res)
export function rasterPoly(poly, gx, gy, res, w, h) {
  const mask = new Uint8Array(w * h);
  const n = poly.length;
  const xs = [];
  for (let j = 0; j < h; j++) {
    const y = gy + j * res;
    xs.length = 0;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const ya = poly[a][1], yb = poly[b][1];
      if ((ya > y) !== (yb > y)) xs.push(poly[a][0] + ((y - ya) / (yb - ya)) * (poly[b][0] - poly[a][0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - gx) / res)), i1 = Math.min(w - 1, Math.floor((xs[k + 1] - gx) / res));
      for (let i = i0; i <= i1; i++) mask[j * w + i] = 1;
    }
  }
  return mask;
}

export function resampleLine(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0].slice()];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= l) { const t = d / l; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; }
    carry = l - (d - step);
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > step * 0.3) out.push(last.slice());
  return out;
}

// Auto decoration: surrounding forest, tee furniture, markers, stakes, reeds...
function buildDecor(world) {
  const hole = world.hole, C = world.climate, D = hole.decor || {};
  const rnd = mulberry32((hole.terrain.seed || 1) * 7 + 13);
  const out = [];
  const clearAt = (x, y, r = 2) => {
    if (!world.inDomain(x, y)) return false;
    const s = world.surfAt(x, y);
    if (s === S.WATER || s === S.PATH || s === S.GREEN || s === S.FAIRWAY || s === S.TEE || s === S.BUNKER) return false;
    for (const w of world.waters) if (pointInPoly(x, y, w.poly)) return false;
    return !(r > 1 && !Number.isNaN(world.waterAt(x, y)));
  };
  if (D.surround !== false) {
    const step = 9 / Math.sqrt(Math.max(0.2, C.surroundDensity));
    const R = world.rect;
    for (let y = world.y0 + 4; y < world.y1 - 4; y += step) {
      for (let x = world.x0 + 4; x < world.x1 - 4; x += step) {
        const jx = x + (rnd() - 0.5) * step * 0.9, jy = y + (rnd() - 0.5) * step * 0.9;
        const inside = jx > R.x0 + 3 && jx < R.x1 - 3 && jy > R.y0 + 3 && jy < R.y1 - 3;
        if (inside) continue;
        if (fbm(jx / 45, jy / 45, 31, 2) < -0.25) continue;
        if (rnd() > 0.85 || !clearAt(jx, jy)) continue;
        out.push({ kind: C.surround[Math.floor(rnd() * C.surround.length)], x: jx, y: jy, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, seed: Math.floor(rnd() * 1e6), auto: true });
      }
    }
  }
  const tees = world.tees;
  if (D.teeProps !== false && tees.length) {
    const back = tees[0];
    const dirx = world.pin.x - back.spot[0], diry = world.pin.y - back.spot[1];
    const dl = Math.hypot(dirx, diry) || 1, ux = dirx / dl, uy = diry / dl;
    const side = hole.shapes.some((s) => s.type === 'path' && shapePoly(s)[0]?.[0] < back.spot[0]) ? -1 : 1;
    const px = uy * side, py = -ux * side;
    const base = [back.spot[0] - ux * 7 + px * 7.5, back.spot[1] - uy * 7 + py * 7.5];
    const rot = Math.atan2(ux, uy);
    out.push({ kind: 'bench', x: base[0], y: base[1], s: 1, r: -rot + Math.PI / 2 * side, auto: true });
    out.push({ kind: 'washer', x: base[0] + ux * 3, y: base[1] + uy * 3, s: 1, r: 0, auto: true });
    out.push({ kind: 'bin', x: base[0] + ux * 4, y: base[1] + uy * 4, s: 1, r: 0, auto: true });
    out.push({ kind: 'sign', x: base[0] - ux * 2.5, y: base[1] - uy * 2.5, s: 1, r: -rot + Math.PI / 2 * side, auto: true });
  }
  for (const t of tees) {
    const dirx = world.pin.x - t.spot[0], diry = world.pin.y - t.spot[1];
    const dl = Math.hypot(dirx, diry) || 1;
    const px = diry / dl, py = -dirx / dl;
    for (const k of [-1, 1]) out.push({ kind: 'teemarker', x: t.spot[0] + px * 2.6 * k + dirx / dl * 1.2, y: t.spot[1] + py * 2.6 * k + diry / dl * 1.2, set: t.set, auto: true });
  }
  if (D.markers !== false) {
    // yardage plates measured back along the route
    const route = [[world.pin.x, world.pin.y], ...[...(hole.route || [])].reverse(), tees.length ? tees[0].spot : [0, 0]];
    const marks = [[100, '#d23a2e'], [150, '#f3f3f3'], [200, '#2a62d8']];
    for (const [yd, col] of marks) {
      const p = alongLine(route, yd / M2YD);
      if (p && world.surfAt(p[0], p[1]) === S.FAIRWAY) out.push({ kind: 'plate', x: p[0], y: p[1], color: col, auto: true });
    }
  }
  if (D.stakes !== false) {
    for (const w of world.waters) {
      const ring = resampleLine([...w.poly, w.poly[0]], 9);
      const c = polyCentroid(w.poly);
      for (const p of ring) {
        const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1;
        out.push({ kind: 'stake', x: p[0] + (dx / l) * 1.8, y: p[1] + (dy / l) * 1.8, color: '#d8302a', auto: true });
      }
    }
    for (const cr of world.creeks) {
      const pts = resampleLine(cr.pts, 12);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        for (const k of [-1, 1]) out.push({ kind: 'stake', x: a[0] + (-dy / l) * (cr.halfW + 2) * k, y: a[1] + (dx / l) * (cr.halfW + 2) * k, color: '#d8302a', auto: true });
      }
    }
    if (D.oobEdge !== false) {
      const R = world.rect;
      for (let x = R.x0; x <= R.x1; x += 22) { out.push({ kind: 'stake', x, y: R.y1, color: '#fafafa', auto: true }); out.push({ kind: 'stake', x, y: R.y0, color: '#fafafa', auto: true }); }
      for (let y = R.y0; y <= R.y1; y += 22) { out.push({ kind: 'stake', x: R.x0, y, color: '#fafafa', auto: true }); out.push({ kind: 'stake', x: R.x1, y, color: '#fafafa', auto: true }); }
    }
  }
  for (const w of world.waters) {
    const P = w.shape.props;
    if (P.reeds) {
      const ring = resampleLine([...w.poly, w.poly[0]], 7);
      for (const p of ring) if (rnd() < 0.45) out.push({ kind: 'reeds', x: p[0] + (rnd() - 0.5) * 1.5, y: p[1] + (rnd() - 0.5) * 1.5, s: 0.7 + rnd() * 0.5, r: rnd() * 6.28, auto: true });
    }
    if (P.lilies) {
      const bb = polyBBox(w.poly);
      for (let i = 0; i < 40; i++) {
        const x = bb.x0 + rnd() * (bb.x1 - bb.x0), y = bb.y0 + rnd() * (bb.y1 - bb.y0);
        if (pointInPoly(x, y, w.poly)) out.push({ kind: 'lily', x, y, s: 0.5 + rnd() * 0.6, r: rnd() * 6.28, auto: true });
      }
    }
    if (P.fountain) { const c = polyCentroid(w.poly); out.push({ kind: 'fountain', x: c[0], y: c[1], level: w.level, auto: true }); }
  }
  for (const b of hole.shapes.filter((s) => (s.type === 'bunker' || s.type === 'fbunker') && s.props.rake)) {
    const poly = shapePoly(b);
    const p = poly[Math.floor(rnd() * poly.length)];
    out.push({ kind: 'rake', x: p[0], y: p[1], r: rnd() * 6.28, auto: true });
  }
  return out;
}

export function alongLine(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l) { const t = d / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    d -= l;
  }
  return null;
}

function buildColliders(world, objs) {
  const cell = 8, grid = new Map();
  const list = [];
  for (const o of objs) {
    const def = OBJ[o.kind];
    if (!def || !def.col) continue;
    const s = o.s || 1, col = def.col, base = world.heightAt(o.x, o.y);
    const c = { kind: o.kind, x: o.x, y: o.y, base, s, r: o.r || 0, seed: o.seed || hashStr(o.kind + o.x.toFixed(1)) };
    let R = 0;
    if (col.trunk) { c.trunk = [col.trunk[0] * s, col.trunk[1] * s]; R = Math.max(R, c.trunk[0]); }
    if (col.canopy) { c.canopy = [col.canopy[0] * s, col.canopy[1] * s, col.canopy[2] * s, col.canopy[3]]; R = Math.max(R, c.canopy[1]); }
    if (col.solid) { c.solid = [col.solid[0] * s, col.solid[1] * s]; R = Math.max(R, c.solid[0]); }
    if (col.box) { c.box = [col.box[0] * s, col.box[1] * s, col.box[2] * s]; R = Math.max(R, Math.hypot(c.box[0], c.box[2])); }
    if (!R) continue;
    c.R = R;
    list.push(c);
    const i0 = Math.floor((o.x - R) / cell), i1 = Math.floor((o.x + R) / cell);
    const j0 = Math.floor((o.y - R) / cell), j1 = Math.floor((o.y + R) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = i + ',' + j;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
  }
  return { list, near: (x, y) => grid.get(Math.floor(x / cell) + ',' + Math.floor(y / cell)) || [] };
}

export function routeTo(world, from) {
  const pts = [from, ...(world.hole.route || []).filter((p) => p[1] > from[1] + 10), [world.pin.x, world.pin.y]];
  return { pts, len: polylineLength(pts) };
}
