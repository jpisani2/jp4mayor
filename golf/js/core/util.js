// Shared math, noise, spline & polygon helpers.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const DEG = Math.PI / 180;
export const M2YD = 1.09361;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const deepClone = (o) => JSON.parse(JSON.stringify(o));

// Seeded RNG ---------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Value noise / fbm (deterministic per seed) --------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f, seed + i * 17) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}

// Splines --------------------------------------------------------------------
function crPoint(p0, p1, p2, p3, t, tension = 0.5) {
  const t2 = t * t, t3 = t2 * t;
  const v0x = (p2[0] - p0[0]) * tension, v0y = (p2[1] - p0[1]) * tension;
  const v1x = (p3[0] - p1[0]) * tension, v1y = (p3[1] - p1[1]) * tension;
  return [
    (2 * p1[0] - 2 * p2[0] + v0x + v1x) * t3 + (-3 * p1[0] + 3 * p2[0] - 2 * v0x - v1x) * t2 + v0x * t + p1[0],
    (2 * p1[1] - 2 * p2[1] + v0y + v1y) * t3 + (-3 * p1[1] + 3 * p2[1] - 2 * v0y - v1y) * t2 + v0y * t + p1[1],
  ];
}
export function splineClosed(pts, seg = 8, tension = 0.5) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const s = Math.max(2, Math.min(24, Math.ceil(len / 2.5), seg * 2));
    for (let j = 0; j < s; j++) out.push(crPoint(p0, p1, p2, p3, j / s, tension));
  }
  return out;
}
export function splineOpen(pts, seg = 8, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return pts.slice();
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const s = Math.max(2, Math.min(30, Math.ceil(len / 2)));
    for (let j = 0; j < s; j++) out.push(crPoint(p0, p1, p2, p3, j / s, tension));
  }
  out.push(pts[n - 1].slice());
  return out;
}

// Polygons ---------------------------------------------------------------------
export function polyBBox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1 };
}
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}
export function polyCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}
export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function distToPolyline(px, py, line, closed = false) {
  let d = Infinity;
  const n = line.length;
  for (let i = 0; i < n - 1; i++) d = Math.min(d, distToSeg(px, py, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
  if (closed && n > 2) d = Math.min(d, distToSeg(px, py, line[n - 1][0], line[n - 1][1], line[0][0], line[0][1]));
  return d;
}
// Ramer-Douglas-Peucker simplification
export function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let maxD = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = simplify(pts.slice(0, idx + 1), eps), r = simplify(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}
export function polylineLength(line) {
  let L = 0;
  for (let i = 1; i < line.length; i++) L += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return L;
}
// Shape presets: returns control points around origin with given radii
export function blobPoints(cx, cy, rx, ry, rot = 0, n = 8, wobble = 0.15, seed = 1) {
  const rnd = mulberry32(seed);
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + (rnd() * 2 - 1) * wobble;
    const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

// Chamfer distance transform over a grid mask (1 = inside). Returns Float32Array
// distances (in cells) to the nearest cell of the opposite state.
export function distanceTransform(mask, w, h, insideDist = true) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = (mask[i] ? insideDist : !insideDist) ? INF : 0;
  const a = 1, b = 1.4142;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + a);
    if (y > 0) {
      v = Math.min(v, d[i - w] + a);
      if (x > 0) v = Math.min(v, d[i - w - 1] + b);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + b);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i]; if (v === 0) continue;
    if (x < w - 1) v = Math.min(v, d[i + 1] + a);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + a);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + b);
      if (x > 0) v = Math.min(v, d[i + w - 1] + b);
    }
    d[i] = v;
  }
  return d;
}

export function fmtDist(m, units) {
  return units === 'm' ? `${Math.round(m)}m` : `${Math.round(m * M2YD)}y`;
}
export function fmtDistLong(m, units) {
  return units === 'm' ? `${Math.round(m)} m` : `${Math.round(m * M2YD)} yds`;
}
export function fmtShort(m, units) {
  // for putts: feet/meters with decimals
  if (units === 'm') return m < 10 ? `${m.toFixed(1)}m` : `${Math.round(m)}m`;
  const ft = m * 3.28084;
  return ft < 60 ? `${Math.round(ft)} ft` : `${Math.round(m * M2YD)}y`;
}
export const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
