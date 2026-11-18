// Hole data model, geometry helpers and the procedural hole generator.
import { SHAPES, CLIMATES, NAME_WORDS, OBJ, TEE_SETS } from './data.js';
import {
  uid, mulberry32, splineClosed, splineOpen, polyCentroid, pointInPoly, blobPoints, clamp,
  fbm, distToPolyline, polyArea, M2YD, DEG, polylineLength,
} from './util.js';

export const HOLE_VERSION = 1;

// Cached sampled geometry per shape ------------------------------------------------
const polyCache = new WeakMap();
export function shapePoly(shape) {
  const key = shape.pts.length + ':' + shape.pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(';');
  const c = polyCache.get(shape);
  if (c && c.key === key) return c.poly;
  const kind = SHAPES[shape.type]?.kind;
  const poly = kind === 'line' ? splineOpen(shape.pts) : splineClosed(shape.pts);
  polyCache.set(shape, { key, poly });
  return poly;
}
export function shapeIsLine(shape) { return SHAPES[shape.type]?.kind === 'line'; }

export function rectPoints(cx, cy, w, h, rot = 0) {
  // rounded rectangle as 8 control points; w across (x), h along (y); rot radians CCW
  const hw = w / 2, hh = h / 2, k = 0.82;
  const local = [[-hw * k, -hh], [hw * k, -hh], [hw, -hh * k], [hw, hh * k], [hw * k, hh], [-hw * k, hh], [-hw, hh * k], [-hw, -hh * k]];
  const c = Math.cos(rot), s = Math.sin(rot);
  return local.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

export function makeShape(type, cx, cy, opts = {}) {
  const def = SHAPES[type];
  const [rx, ry] = opts.size || def.size || [10, 10];
  const rot = opts.rot || 0;
  let pts;
  if (opts.pts) pts = opts.pts;
  else if (def.kind === 'line') pts = [[cx - 15, cy], [cx, cy + 5], [cx + 15, cy]];
  else if (def.rect) pts = rectPoints(cx, cy, rx, ry, rot);
  else pts = blobPoints(cx, cy, rx, ry, rot, type === 'pot' ? 6 : 8, type === 'pot' ? 0.05 : 0.16, opts.seed || Math.floor(Math.random() * 1e6));
  return { id: uid(), type, pts, props: { ...JSON.parse(JSON.stringify(def.props)), ...(opts.props || {}) } };
}

export function teeSpot(teeShape) {
  if (teeShape.props.sx != null) return [teeShape.props.sx, teeShape.props.sy];
  return polyCentroid(teeShape.pts);
}
const TEE_ORDER = ['black', 'blue', 'white', 'gold', 'red'];
export function holeTees(hole) {
  const tees = hole.shapes.filter((s) => s.type === 'tee');
  return tees.map((t) => ({ shape: t, spot: teeSpot(t), set: t.props.set, len: routeLength(hole, teeSpot(t)) }))
    .sort((a, b) => b.len - a.len);
}
export function defaultTee(hole, prefer) {
  const tees = holeTees(hole);
  if (!tees.length) return null;
  if (prefer) {
    const exact = tees.find((t) => t.set === prefer);
    if (exact) return exact;
    const pi = TEE_ORDER.indexOf(prefer);
    let best = tees[0], bd = 99;
    for (const t of tees) { const d = Math.abs(TEE_ORDER.indexOf(t.set) - pi); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  return tees[0];
}
export function routeLength(hole, from) {
  const pts = [from, ...(hole.route || []).filter((p) => p[1] > from[1] - 5), [hole.pin.x, hole.pin.y]];
  return polylineLength(pts);
}
export function holeYards(hole, units = 'y') {
  const t = defaultTee(hole);
  const m = t ? t.len : hole.pin.y;
  return units === 'm' ? Math.round(m) : Math.round(m * M2YD);
}
export function suggestPar(hole) {
  const t = defaultTee(hole);
  const yd = (t ? t.len : hole.pin.y) * M2YD;
  return yd < 250 ? 3 : yd < 480 ? 4 : yd < 640 ? 5 : 6;
}
export function holePar(hole) { return hole.parAuto === false ? hole.par : suggestPar(hole); }

export function greens(hole) { return hole.shapes.filter((s) => s.type === 'green'); }
export function greenAt(hole, x, y) {
  for (const g of greens(hole)) if (pointInPoly(x, y, shapePoly(g))) return g;
  return null;
}

// Hole creation ------------------------------------------------------------------
export function emptyHole(par = 4, climate = 'parkland') {
  const len = par === 3 ? 170 : par === 4 ? 370 : 500;
  const C = CLIMATES[climate];
  const hole = baseHole(par, climate);
  hole.length = Math.round(len + 50);
  hole.shapes.push(makeShape('tee', 0, 0, { size: [7, 10], props: { set: 'blue' } }));
  hole.shapes.push(makeShape('green', 0, len, { size: [13, 15], seed: 7, props: { slopeDir: 180 } }));
  if (par > 3) {
    hole.shapes.push(makeShape('fairway', 0, len * 0.62, { pts: [[-16, len * 0.42], [-17, len * 0.62], [-14, len * 0.86], [0, len * 0.93], [14, len * 0.86], [17, len * 0.62], [16, len * 0.42], [0, len * 0.38]] }));
  }
  hole.pin = { x: 0, y: len };
  if (C.ground === 'native') {
    hole.shapes.unshift(makeShape('rough', 0, len / 2, { pts: [[-30, -15], [-34, len * 0.5], [-32, len + 20], [0, len + 32], [32, len + 20], [34, len * 0.5], [30, -15], [0, -24]] }));
  }
  return hole;
}

function baseHole(par, climate) {
  const C = CLIMATES[climate];
  return {
    id: uid(), v: HOLE_VERSION, name: randomName(climate, Math.random), par, parAuto: true, status: 'draft',
    created: Date.now(), updated: Date.now(),
    climate, time: 'midday', wind: { mode: 'random', speed: 3, dir: 0 },
    width: 200, length: 450, ground: C.ground,
    terrain: { elev: 0, cross: 0, roll: 0.8, scale: 60, seed: Math.floor(Math.random() * 99999) },
    shapes: [], features: [], objects: [], route: [], pin: { x: 0, y: 380 },
    decor: { surround: true, teeProps: true, markers: true, stakes: true, oobEdge: true },
  };
}

export function randomName(climate, rnd) {
  const w = NAME_WORDS[climate] || NAME_WORDS.parkland;
  return `${w.a[Math.floor(rnd() * w.a.length)]} ${w.b[Math.floor(rnd() * w.b.length)]}`;
}

// Normalize / migrate loaded holes
export function normalizeHole(h) {
  const b = baseHole(h.par || 4, h.climate || 'parkland');
  const out = { ...b, ...h };
  out.terrain = { ...b.terrain, ...(h.terrain || {}) };
  out.decor = { ...b.decor, ...(h.decor || {}) };
  out.wind = { ...b.wind, ...(h.wind || {}) };
  out.shapes = (h.shapes || []).filter((s) => SHAPES[s.type]).map((s) => ({ ...s, props: { ...SHAPES[s.type].props, ...(s.props || {}) } }));
  out.objects = (h.objects || []).filter((o) => OBJ[o.kind]);
  out.features = h.features || [];
  out.route = h.route || [];
  return out;
}

// Terrain feature presets
export const FEATURES = {
  hill: { label: 'Hill', rx: 35, ry: 30, h: 4, profile: 'smooth' },
  mound: { label: 'Mound', rx: 6, ry: 5, h: 1.3, profile: 'smooth' },
  ridge: { label: 'Ridge', rx: 30, ry: 6, h: 2.2, profile: 'sharp' },
  plateau: { label: 'Plateau', rx: 22, ry: 18, h: 3, profile: 'plateau' },
  dune: { label: 'Dune', rx: 14, ry: 8, h: 3.2, profile: 'sharp' },
  valley: { label: 'Valley', rx: 32, ry: 26, h: -3.5, profile: 'smooth' },
  hollow: { label: 'Hollow', rx: 7, ry: 6, h: -1.2, profile: 'smooth' },
  swale: { label: 'Swale', rx: 26, ry: 5, h: -1.2, profile: 'smooth' },
};
export function makeFeature(kind, x, y, rot = 0) {
  const f = FEATURES[kind];
  return { id: uid(), kind, x, y, rx: f.rx, ry: f.ry, rot, h: f.h, profile: f.profile };
}
export function makeObject(kind, x, y, s = 1, r = Math.random() * Math.PI * 2) {
  return { id: uid(), kind, x, y, s, r, seed: Math.floor(Math.random() * 1e6) };
}

// Procedural generator ---------------------------------------------------------------
export function generateHole({ par = 4, climate = 'parkland', seed = Math.floor(Math.random() * 1e9), difficulty = 1 } = {}) {
  const rnd = mulberry32(seed);
  const R = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const sgn = () => (rnd() < 0.5 ? -1 : 1);
  const C = CLIMATES[climate];
  const hole = baseHole(par, climate);
  hole.name = randomName(climate, rnd);
  hole.time = pick(['morning', 'midday', 'midday', 'afternoon', 'afternoon', 'sunset']);
  hole.terrain.seed = Math.floor(rnd() * 99999);
  const isLinks = climate === 'links', isDesert = climate === 'desert', isTrop = climate === 'tropical', isAlpine = climate === 'alpine';

  // --- Centerline routing
  const len = par === 3 ? R(135, 195) : par === 4 ? R(330, 410) : R(455, 535);
  const dir = (deg) => [Math.sin(deg * DEG), Math.cos(deg * DEG)];
  const route = [[0, 0]];
  let corner1 = null, corner2 = null, turn1 = 0, turn2 = 0;
  if (par === 3) {
    const a = R(-6, 6);
    const d = dir(a); route.push([d[0] * len, d[1] * len]);
  } else {
    const c1 = par === 4 ? R(215, 250) : R(225, 262);
    turn1 = rnd() < 0.68 ? R(12, 30) * sgn() : R(-5, 5);
    corner1 = [R(-4, 4), c1];
    route.push(corner1);
    if (par === 4) {
      const d = dir(turn1); route.push([corner1[0] + d[0] * (len - c1), corner1[1] + d[1] * (len - c1)]);
    } else {
      const seg2 = R(160, 195);
      const d = dir(turn1);
      corner2 = [corner1[0] + d[0] * seg2, corner1[1] + d[1] * seg2];
      turn2 = rnd() < 0.5 ? -turn1 * R(0.6, 1.1) : R(-10, 10);
      route.push(corner2);
      const d2 = dir(turn1 + turn2), rest = len - c1 - seg2;
      route.push([corner2[0] + d2[0] * rest, corner2[1] + d2[1] * rest]);
    }
  }
  const end = route[route.length - 1];
  const lastHeading = Math.atan2(end[0] - route[route.length - 2][0], end[1] - route[route.length - 2][1]);
  // sample along the route by arc length
  const segs = [];
  let tot = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, s0: tot, h: Math.atan2(b[0] - a[0], b[1] - a[1]) }); tot += l;
  }
  const at = (s) => {
    s = clamp(s, -60, tot + 80);
    let sg = segs[0];
    for (const g of segs) if (s >= g.s0) sg = g;
    const t = (s - sg.s0) / sg.l;
    // smooth heading near corners
    let h = sg.h;
    const idx = segs.indexOf(sg);
    const blend = 30;
    if (idx > 0 && s - sg.s0 < blend) h = lerpAngle(segs[idx - 1].h, sg.h, 0.5 + 0.5 * (s - sg.s0) / blend);
    if (idx < segs.length - 1 && sg.s0 + sg.l - s < blend) h = lerpAngle(sg.h, segs[idx + 1].h, 0.5 - 0.5 * (sg.s0 + sg.l - s) / blend);
    return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * t, y: sg.a[1] + (sg.b[1] - sg.a[1]) * t, h };
  };
  const off = (s, lat) => { const p = at(s); return [p.x + Math.cos(p.h) * lat, p.y - Math.sin(p.h) * lat]; };

  let minX = 0, maxX = 0, maxY = 0;
  for (const p of route) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
  hole.width = Math.round(Math.max(par === 3 ? 170 : 190, 2 * Math.max(-minX, maxX) + 130));
  hole.length = Math.round(maxY + 48);
  hole.route = route.slice(1, -1).map((p) => [p[0], p[1]]);

  // --- Terrain
  const T = hole.terrain;
  T.elev = par === 3 && (isAlpine || rnd() < 0.3) ? R(-16, -4) : R(-7, 9) * (isAlpine ? 1.8 : 1);
  T.cross = R(-2.2, 2.2) * (isAlpine ? 1.5 : 1);
  T.roll = isLinks ? R(1.6, 2.4) : isDesert ? R(0.8, 1.6) : R(0.6, 1.5);
  T.scale = isLinks ? R(30, 45) : R(45, 80);
  const nHills = Math.floor(R(3, 6));
  for (let i = 0; i < nHills; i++) {
    const s = R(0, tot + 30), side = sgn();
    const [x, y] = off(s, side * R(45, 80));
    const f = makeFeature(rnd() < 0.75 ? 'hill' : 'plateau', x, y, R(0, Math.PI));
    f.rx = R(25, 55); f.ry = R(20, 45); f.h = R(2, 7) * (isAlpine ? 1.6 : 1);
    hole.features.push(f);
  }
  for (let i = 0; i < Math.floor(R(2, 5)); i++) {
    const a = R(0, Math.PI * 2), r = R(16, 26);
    const f = makeFeature(rnd() < 0.8 ? 'mound' : 'hollow', end[0] + Math.sin(a) * r, end[1] + Math.cos(a) * r, R(0, 3));
    f.h *= R(0.7, 1.4); hole.features.push(f);
  }
  if (isLinks) {
    for (let i = 0; i < Math.floor(R(8, 14)); i++) {
      const s = R(-10, tot + 30), side = sgn();
      const [x, y] = off(s, side * R(32, 70));
      const f = makeFeature('dune', x, y, R(0, Math.PI)); f.h = R(2, 5); f.rx = R(10, 22); hole.features.push(f);
    }
    for (let i = 0; i < 3; i++) {
      const s = R(120, tot - 40);
      const [x, y] = off(s, R(-14, 14));
      const f = makeFeature(rnd() < 0.5 ? 'swale' : 'mound', x, y, R(0, 3)); f.h *= 0.8; hole.features.push(f);
    }
  }
  if (par > 3 && rnd() < 0.5) {
    const s = R(140, tot - 80); const [x, y] = off(s, R(-10, 10));
    const f = makeFeature(rnd() < 0.5 ? 'ridge' : 'swale', x, y, -at(s).h + Math.PI / 2); f.h *= R(0.5, 0.9); f.rx = R(20, 35); hole.features.push(f);
  }

  // --- Fairway
  const fwStart = par === 3 ? tot - 55 : par === 4 ? R(165, 190) : R(165, 185);
  const fwEnd = tot - R(16, 22);
  const baseW = isLinks ? R(19, 24) : R(14, 18);
  const fwHalf = (s) => {
    let w = baseW + fbm(s / 70, 3.3, seed % 999, 2) * 6;
    if (s > fwEnd - 50) w *= 0.75 + 0.25 * (fwEnd - s) / 50;
    return Math.max(8, w);
  };
  const hasFairway = par > 3 || rnd() < 0.5;
  if (hasFairway) {
    const L = [], Rt = [];
    const step = par === 3 ? 12 : 26;
    const fws = par === 3 ? tot - 50 : fwStart;
    for (let s = fws; s <= fwEnd + 0.1; s += step) {
      const w = par === 3 ? 9 : fwHalf(s);
      L.push(off(s, -w)); Rt.push(off(s, w));
    }
    L.push(off(fwEnd + 6, -6)); Rt.push(off(fwEnd + 6, 6));
    // polygon: start cap, left side forward, right side back
    const fw = makeShape('fairway', 0, 0, { pts: [off(fws - 7, 0), ...L, ...Rt.reverse()] });
    fw.props.mow = pick(['stripes', 'stripes', 'checker', 'diagonal']);
    hole.shapes.push(fw);
  }

  // --- Rough corridor for native-ground climates
  if (C.ground === 'native') {
    const L = [], Rt = [];
    for (let s = -8; s <= tot + 22; s += 25) {
      const inFw = s > fwStart - 10 && s < fwEnd;
      const w = (inFw ? fwHalf(s) : 10) + R(10, 15) + (s > tot - 30 ? 10 : 0);
      L.push(off(s, -w)); Rt.push(off(s, w));
    }
    const ro = makeShape('rough', 0, 0, { pts: [off(-18, 0), ...L, off(tot + 34, 0), ...Rt.reverse()] });
    hole.shapes.unshift(ro);
  }

  // --- Green
  const gRx = R(11, 14.5), gRy = R(12.5, 17);
  const green = makeShape('green', end[0], end[1], { size: [gRx, gRy], rot: -lastHeading, seed: Math.floor(rnd() * 1e6) });
  green.props.slope = R(0.8, 2.6);
  green.props.slopeDir = ((lastHeading / DEG + 180 + R(-65, 65)) + 360) % 360;
  green.props.undulation = R(0.15, 0.6);
  green.props.tiers = rnd() < 0.22 ? 1 : 0;
  green.props.stimp = Math.round(R(9.5, 12) * 2) / 2;
  green.props.elevation = R(0, 1.3);
  hole.shapes.push(green);
  const gPoly = shapePoly(green);
  for (let i = 0; i < 20; i++) {
    const a = R(0, Math.PI * 2), r = R(0, 0.45);
    const px = end[0] + Math.sin(a) * gRx * r, py = end[1] + Math.cos(a) * gRy * r;
    if (pointInPoly(px, py, gPoly)) { hole.pin = { x: px, y: py }; break; }
    hole.pin = { x: end[0], y: end[1] };
  }

  // --- Tees
  const teeDefs = par === 3 ? [['blue', 0], ['white', R(14, 22)], ['red', R(32, 45)]] : [['black', -R(10, 16)], ['blue', 0], ['white', R(20, 30)], ['red', R(48, 65)]];
  if (par !== 3 && rnd() < 0.5) teeDefs.shift();
  for (const [set, s] of teeDefs) {
    const p = at(s);
    const t = makeShape('tee', 0, 0, { pts: rectPoints(p.x + R(-2, 2), p.y, R(6, 8), R(8, 12), -p.h) });
    t.props.set = set; t.props.raise = R(0.3, 0.9);
    hole.shapes.push(t);
  }

  // --- Greenside bunkers
  const nGB = isLinks ? Math.floor(R(1, 3)) : Math.floor(R(1, 3.6) + (difficulty > 1 ? 1 : 0));
  const angles = [140, 220, 95, 265, 30, 330, 180].sort(() => rnd() - 0.5).slice(0, nGB);
  for (const a0 of angles) {
    const a = lastHeading + a0 * DEG;
    const rr = Math.hypot(Math.sin(a0 * DEG) * gRx, Math.cos(a0 * DEG) * gRy) + R(3.5, 5.5);
    const cx = end[0] + Math.sin(a) * rr, cy = end[1] + Math.cos(a) * rr;
    if (isLinks) hole.shapes.push(makeShape('pot', cx, cy, { size: [R(2.2, 3.2), R(2.2, 3)], rot: -a, seed: Math.floor(rnd() * 1e6) }));
    else hole.shapes.push(makeShape('bunker', cx, cy, { size: [R(5, 9), R(2.6, 4)], rot: -a, seed: Math.floor(rnd() * 1e6), props: { sand: C.sand } }));
  }
  // --- Fairway bunkers
  if (par > 3) {
    const nFB = isLinks ? 0 : Math.floor(R(1, 3));
    for (let i = 0; i < nFB; i++) {
      const s = R(205, 255), inside = turn1 !== 0 ? Math.sign(turn1) : sgn();
      const side = i === 0 ? inside : -inside;
      const [x, y] = off(s, side * (fwHalf(s) + R(-3, 5)));
      hole.shapes.push(makeShape('fbunker', x, y, { size: [R(9, 16), R(4, 6.5)], rot: Math.PI / 2 - at(s).h, seed: Math.floor(rnd() * 1e6), props: { sand: C.sand } }));
    }
    if (par === 5) {
      const s = tot - R(90, 120);
      const [x, y] = off(s, sgn() * (fwHalf(s) - R(0, 4)));
      hole.shapes.push(makeShape('fbunker', x, y, { size: [R(10, 18), R(4, 7)], rot: Math.PI / 2 - at(s).h, seed: Math.floor(rnd() * 1e6), props: { sand: C.sand } }));
    }
    if (isLinks) {
      for (let i = 0; i < Math.floor(R(3, 7)); i++) {
        const s = R(150, tot - 40);
        const [x, y] = off(s, R(-1, 1) * fwHalf(s) * 0.9);
        hole.shapes.push(makeShape('pot', x, y, { size: [R(2, 3), R(2, 3)], seed: Math.floor(rnd() * 1e6) }));
      }
    }
  }

  // --- Water
  const waterChance = (par === 3 ? 0.45 : 0.32) * (isTrop ? 1.6 : isDesert ? 0.7 : isLinks ? 0.4 : 1);
  if (rnd() < waterChance) {
    if (par === 3) {
      const s = tot - R(32, 44), [x, y] = off(s, R(-12, 12));
      hole.shapes.push(makeShape('water', x, y, { size: [R(18, 28), R(9, 13)], rot: -lastHeading, seed: Math.floor(rnd() * 1e6), props: { color: C.water, fountain: rnd() < 0.4, lilies: rnd() < 0.4 } }));
    } else if (rnd() < 0.7) {
      const s = R(200, tot - 100), side = sgn();
      const [x, y] = off(s, side * (fwHalf(s) + R(14, 22)));
      hole.shapes.push(makeShape('water', x, y, { size: [R(12, 18), R(25, 45)], rot: -at(s).h, seed: Math.floor(rnd() * 1e6), props: { color: C.water, fountain: rnd() < 0.3 } }));
    } else {
      const s = par === 4 ? R(120, 150) : tot - R(95, 130);
      const pts = [];
      for (let l = -90; l <= 90; l += 22) pts.push(off(s + Math.sin(l * 0.05) * 8 + R(-4, 4), l));
      const c = makeShape('creek', 0, 0, { pts }); c.props.width = R(3.5, 5.5);
      hole.shapes.push(c);
    }
  }

  // --- Cart path / trail
  const pSide = sgn();
  const pathPts = [];
  for (let s = -12; s <= tot + 25; s += 38) {
    const inFw = s > fwStart && s < fwEnd;
    const lat = pSide * ((inFw ? fwHalf(s) : 14) + R(18, 24));
    pathPts.push(off(s + R(-6, 6), s < 0 ? pSide * 14 : s > tot - 10 ? pSide * 28 : lat));
  }
  const useTrail = isLinks && rnd() < 0.6;
  const path = makeShape(useTrail ? 'trail' : 'path', 0, 0, { pts: pathPts });
  path.props.material = useTrail ? 'dirt' : isLinks ? 'shell' : isAlpine ? 'asphalt' : isTrop && rnd() < 0.4 ? 'pavers' : 'concrete';
  hole.shapes.push(path);

  // --- Deep rough strips (links/desert)
  if (isLinks || rnd() < 0.3) {
    for (const side of [-1, 1]) {
      const L = [], Rr = [];
      for (let s = 30; s <= tot - 30; s += 22) {
        const w = (s > fwStart && s < fwEnd ? fwHalf(s) : 10);
        L.push(off(s + R(-5, 5), side * (w + R(7, 13)))); Rr.push(off(s + R(-5, 5), side * (w + R(24, 42))));
      }
      if (L.length > 2) hole.shapes.unshift(makeShape('deep', 0, 0, { pts: [...L, ...Rr.reverse()] }));
    }
  }

  // --- Vegetation
  const corridor = (x, y) => {
    for (const sh of hole.shapes) {
      if (['fairway', 'green', 'tee', 'bunker', 'fbunker', 'pot', 'water'].includes(sh.type)) {
        const poly = shapePoly(sh);
        if (pointInPoly(x, y, poly)) return true;
        if (distToPolyline(x, y, poly, true) < (sh.type === 'green' ? 7 : 3)) return true;
      } else if (sh.type === 'path' || sh.type === 'creek' || sh.type === 'trail') {
        if (distToPolyline(x, y, shapePoly(sh)) < sh.props.width / 2 + 2.5) return true;
      }
    }
    return Math.abs(x) > hole.width / 2 - 2 || y > hole.length - 2 || y < -38;
  };
  const treeKinds = C.trees.filter((k) => OBJ[k].cat === 'tree');
  const shrubKinds = C.trees.filter((k) => OBJ[k].cat !== 'tree');
  const place = (kind, x, y, s) => { if (!corridor(x, y)) hole.objects.push(makeObject(kind, x, y, s, R(0, Math.PI * 2))); };
  const treeDensity = isLinks ? 0.15 : isDesert ? 0.35 : 1;
  for (let s = -10; s <= tot + 30; s += R(7, 12)) {
    for (const side of [-1, 1]) {
      if (rnd() > treeDensity) continue;
      if (fbm(s / 55, side * 4, seed % 777, 2) > 0.25) continue;
      const w = s > fwStart && s < fwEnd ? fwHalf(s) : 12;
      const [x, y] = off(s, side * (w + R(14, 32)));
      place(isLinks ? pick(shrubKinds) : pick(treeKinds), x, y, R(0.8, 1.25));
      if (rnd() < 0.5) { const [x2, y2] = off(s + R(-4, 4), side * (w + R(30, 50))); place(pick(treeKinds.length ? treeKinds : shrubKinds), x2, y2, R(0.8, 1.3)); }
    }
  }
  // clusters & specimen trees
  for (let i = 0; i < Math.floor(R(4, 8)); i++) {
    const [cx, cy] = off(R(-10, tot + 30), sgn() * R(30, 85));
    const kind = rnd() < 0.7 ? pick(treeKinds.length ? treeKinds : shrubKinds) : pick(shrubKinds.length ? shrubKinds : treeKinds);
    const n = Math.floor(R(2, 7));
    for (let j = 0; j < n; j++) place(kind, cx + R(-9, 9), cy + R(-9, 9), R(0.7, 1.3));
  }
  // shrubs & plants
  for (let i = 0; i < Math.floor(R(10, 25)); i++) {
    const [x, y] = off(R(-20, tot + 25), sgn() * R(20, 60));
    if (shrubKinds.length) place(pick(shrubKinds), x, y, R(0.7, 1.3));
  }
  if (isDesert) {
    for (let i = 0; i < 40; i++) {
      const [x, y] = off(R(-20, tot + 30), sgn() * R(24, 90));
      place(pick(['saguaro', 'creosote', 'creosote', 'barrel', 'pricklypear', 'desertrock', 'ocotillo']), x, y, R(0.7, 1.3));
    }
  }
  // tee area flowers
  if (!isDesert && !isLinks && rnd() < 0.7) {
    const p = at(-4);
    hole.shapes.push(makeShape('mulch', p.x + pSide * 9, p.y - 6, { size: [R(3, 5), R(1.8, 2.5)], rot: -p.h }));
  }
  if (climate === 'tropical' || climate === 'parkland') {
    hole.objects.push(makeObject('cart', ...off(-6, pSide * 13), 1, -at(0).h + R(-0.4, 0.4)));
  }
  hole.wind = { mode: isLinks ? pick(['breezy', 'windy', 'gale']) : 'random', speed: 3, dir: 0 };
  hole.parAuto = true;
  hole.par = suggestPar(hole);
  return hole;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}

export function holeSummary(hole, units) {
  return { par: holePar(hole), yards: holeYards(hole, units), climate: CLIMATES[hole.climate]?.name || hole.climate };
}
export function teeSetsOf(hole) { return holeTees(hole).map((t) => ({ set: t.set, label: TEE_SETS[t.set]?.label || t.set, len: t.len })); }
export { polyArea };
