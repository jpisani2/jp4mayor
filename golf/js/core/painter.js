// 2D painter: renders a hole's surfaces with turf patterns. Used for the 3D
// ground texture, the designer map, minimaps and thumbnails.
import { CLIMATES, SHAPES, SHAPE_ORDER, SAND_COLORS, WATER_COLORS, PATH_MATERIALS, OBJ } from './data.js';
import { shapePoly, holeTees } from './hole.js';
import { mulberry32, fbm, polyArea, polyBBox, hashStr } from './util.js';

const patCache = new Map();
function noiseCanvas(size, freq, seed, contrast = 1) {
  const key = `n${size}_${freq}_${seed}_${contrast}`;
  if (patCache.has(key)) return patCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  // periodic value noise: lattice wraps so the texture tiles seamlessly
  const rnd = mulberry32(seed * 977 + 13);
  const octs = [];
  let per = Math.max(2, Math.round(freq * 2)), amp = 0.5, norm = 0;
  for (let o = 0; o < 4; o++) { const grid = new Float32Array(per * per); for (let i = 0; i < grid.length; i++) grid[i] = rnd() * 2 - 1; octs.push({ per, amp, grid }); norm += amp; per *= 2; amp *= 0.5; }
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0;
    for (const o of octs) {
      const fx = (x / size) * o.per, fy = (y / size) * o.per;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const i0 = ix % o.per, i1 = (ix + 1) % o.per, j0 = iy % o.per, j1 = (iy + 1) % o.per;
      const a = o.grid[j0 * o.per + i0], b = o.grid[j0 * o.per + i1], c2 = o.grid[j1 * o.per + i0], d = o.grid[j1 * o.per + i1];
      n += ((a * (1 - tx) + b * tx) * (1 - ty) + (c2 * (1 - tx) + d * tx) * ty) * o.amp;
    }
    n /= norm;
    const v = Math.max(0, Math.min(255, 128 + n * 128 * contrast * 1.6));
    const k = (y * size + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  patCache.set(key, c);
  return c;
}
function speckleCanvas(color, count, rmin, rmax, seed, size = 128, shape = 'dot') {
  const key = `s${color}_${count}_${rmin}_${rmax}_${seed}_${shape}`;
  if (patCache.has(key)) return patCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = color; g.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = rmin + rnd() * (rmax - rmin);
    g.globalAlpha = 0.35 + rnd() * 0.6;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      if (shape === 'blade') {
        g.lineWidth = r * 0.45; g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + (rnd() - 0.5) * r * 2, y + oy - r * 2.5); g.stroke();
      } else { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
    }
  }
  patCache.set(key, c);
  return c;
}
function pattern(ctx, canvas, metersPerPx) {
  const p = ctx.createPattern(canvas, 'repeat');
  if (p.setTransform) p.setTransform(new DOMMatrix().scaleSelf(metersPerPx, metersPerPx));
  return p;
}
export function tone(hex, amt) {
  // amt -1..1 darken/lighten
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return '#' + ((1 << 24) + ((r | 0) << 16) + ((g | 0) << 8) + (bl | 0)).toString(16).slice(1);
}

function tracePath(ctx, poly, closed) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  if (closed) ctx.closePath();
}

function holeAxis(hole) {
  const tees = holeTees(hole);
  const t = tees.length ? tees[0].spot : [0, 0];
  return Math.atan2(hole.pin.x - t[0], hole.pin.y - t[1]);
}

// view: { scale, ox, oy } world->canvas: cx=(x-ox)*scale, cy=(oy-y)*scale
// opt: { mode: 'texture'|'editor'|'thumb', world, bounds:{x0,y0,x1,y1}, lod }
export function paintHole(ctx, hole, view, opt = {}) {
  const C = (CLIMATES[hole.climate] || CLIMATES.parkland).c;
  const mode = opt.mode || 'editor';
  const detail = mode !== 'thumb';
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, -view.scale, -view.ox * view.scale, view.oy * view.scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const b = opt.bounds || { x0: -hole.width / 2 - 60, x1: hole.width / 2 + 60, y0: -105, y1: hole.length + 60 };
  const groundCol = hole.ground === 'native' ? C.native : C.rough;
  ctx.fillStyle = groundCol;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  const mpp = 1 / view.scale; // meters per canvas pixel
  if (detail) {
    // large scale mottling & fine grain
    ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern(ctx, noiseCanvas(256, 3, 5), 0.9);
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pattern(ctx, noiseCanvas(128, 8, 9, 1.5), 0.12);
    if (mpp < 0.6) ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (hole.ground === 'native') speckle(ctx, b, C.nativeSpeck, 'native');
  }
  const axis = holeAxis(hole);
  const shapes = [...hole.shapes].sort((a, b2) => SHAPE_ORDER.indexOf(a.type) - SHAPE_ORDER.indexOf(b2.type));
  for (const sh of shapes) paintShape(ctx, sh, C, hole, axis, detail, mode, mpp);

  // tree shading for texture mode
  if (mode === 'texture' && opt.world) {
    const objs = [...hole.objects, ...opt.world.decor.filter((d) => OBJ[d.kind])];
    for (const o of objs) {
      const def = OBJ[o.kind];
      if (def.cat !== 'tree' && def.cat !== 'shrub' && def.cat !== 'rock') continue;
      const r = (def.col.canopy ? def.col.canopy[1] : def.col.solid ? def.col.solid[0] * 1.5 : 1) * (o.s || 1) * (def.cat === 'tree' ? 0.75 : 0.9);
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
      g.addColorStop(0, 'rgba(20,30,10,0.34)'); g.addColorStop(1, 'rgba(20,30,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function speckle(ctx, b, color, kind, poly) {
  const can = kind === 'deep' ? speckleCanvas(color, 160, 1.2, 2.4, 3, 128, 'blade')
    : kind === 'rough' ? speckleCanvas(color, 220, 0.6, 1.3, 4, 128, 'blade')
      : speckleCanvas(color, 260, 0.6, 1.8, 7);
  ctx.fillStyle = pattern(ctx, can, kind === 'native' ? 0.06 : 0.07);
  if (poly) ctx.fill(); else ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
}

function stripes(ctx, poly, angle, width, color, alpha, checker = false) {
  const bb = polyBBox(poly);
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  const R = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + width;
  ctx.save();
  tracePath(ctx, poly, true); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(-angle);
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let y = -R, k = 0; y < R; y += width, k++) {
    if (!checker) { if (k % 2 === 0) ctx.fillRect(-R, y, 2 * R, width); }
    else {
      for (let x = -R, m = 0; x < R; x += width, m++) if ((k + m) % 2 === 0) ctx.fillRect(x, y, width, width);
    }
  }
  ctx.restore();
}

function paintShape(ctx, sh, C, hole, axis, detail, mode, mpp) {
  const def = SHAPES[sh.type];
  const poly = shapePoly(sh);
  if (poly.length < 2) return;
  const P = sh.props;
  const closed = def.kind === 'area';
  if (!closed) {
    const w = P.width || 2;
    if (sh.type === 'creek') {
      tracePath(ctx, poly, false);
      ctx.strokeStyle = '#5b6b3a'; ctx.lineWidth = w + 2.6; ctx.stroke();
      ctx.strokeStyle = '#6d5a3c'; ctx.lineWidth = w + 1; ctx.stroke();
      ctx.strokeStyle = WATER_COLORS.blue.deep; ctx.lineWidth = w; ctx.stroke();
      if (mode !== 'texture') { ctx.strokeStyle = WATER_COLORS.blue.shallow; ctx.lineWidth = w * 0.55; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1; }
      return;
    }
    const m = PATH_MATERIALS[P.material] || PATH_MATERIALS.concrete;
    tracePath(ctx, poly, false);
    ctx.strokeStyle = sh.type === 'trail' ? tone(m.edge, 0.1) : m.edge; ctx.lineWidth = w + (sh.type === 'trail' ? 0.6 : 0.35); ctx.stroke();
    ctx.strokeStyle = m.c; ctx.lineWidth = w; ctx.stroke();
    if (detail && mpp < 0.5) {
      ctx.globalAlpha = 0.2; ctx.globalCompositeOperation = 'overlay';
      ctx.strokeStyle = pattern(ctx, noiseCanvas(128, 10, 21, 1.6), 0.03); ctx.lineWidth = w; ctx.stroke();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    return;
  }
  tracePath(ctx, poly, true);
  switch (sh.type) {
    case 'rough': {
      ctx.fillStyle = tone(C.rough, (P.tone || 0) * 0.25); ctx.fill();
      if (detail) { ctx.save(); ctx.clip(); speckle(ctx, polyBBox(poly), tone(C.rough, -0.2), 'rough'); ctx.restore(); }
      break;
    }
    case 'deep': {
      ctx.fillStyle = tone(C.deep, (P.tone || 0) * 0.25); ctx.fill();
      if (detail) { ctx.save(); ctx.clip(); speckle(ctx, polyBBox(poly), tone(C.deep, 0.25), 'deep'); speckle(ctx, polyBBox(poly), tone(C.deep, -0.3), 'rough'); ctx.restore(); }
      break;
    }
    case 'native': case 'waste': case 'trail': {
      ctx.fillStyle = tone(C.native, (P.tone || 0) * 0.25 + (sh.type === 'waste' ? 0.08 : 0)); ctx.fill();
      if (detail) { ctx.save(); ctx.clip(); speckle(ctx, polyBBox(poly), C.nativeSpeck, 'native'); ctx.restore(); }
      ctx.strokeStyle = tone(C.native, -0.18); ctx.lineWidth = 0.5; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'mulch': {
      ctx.strokeStyle = tone(C.mulch, -0.3); ctx.lineWidth = 0.4; ctx.stroke();
      ctx.fillStyle = C.mulch; ctx.fill();
      if (detail) {
        const rnd = mulberry32(hashStr(sh.id));
        const bb = polyBBox(poly), area = polyArea(poly);
        const palettes = { mixed: ['#e8423f', '#f5c242', '#f2f2f2', '#c04ad8', '#ff8a3d'], red: ['#d8262b', '#f04848'], white: ['#ffffff', '#f2f0e0'], purple: ['#8d4ad8', '#c070f0'], yellow: ['#f5c242', '#ffe27a'] };
        const pal = palettes[P.flowers] || palettes.mixed;
        ctx.save(); tracePath(ctx, poly, true); ctx.clip();
        for (let i = 0; i < area * 3; i++) {
          const x = bb.x0 + rnd() * (bb.x1 - bb.x0), y = bb.y0 + rnd() * (bb.y1 - bb.y0);
          ctx.fillStyle = rnd() < 0.35 ? '#3f7a2a' : pal[Math.floor(rnd() * pal.length)];
          ctx.beginPath(); ctx.arc(x, y, 0.1 + rnd() * 0.14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'fairway': {
      const fc = P.firstCut || 0;
      if (fc > 0) { ctx.strokeStyle = C.first; ctx.lineWidth = fc * 2; ctx.stroke(); }
      const base = tone(C.fairway, (P.tone || 0) * 0.25);
      ctx.fillStyle = base; ctx.fill();
      if (P.mow !== 'none') {
        const ang = P.mow === 'diagonal' ? axis + Math.PI / 4 : P.mow === 'lengthwise' ? axis + Math.PI / 2 : axis;
        stripes(ctx, poly, ang, P.stripe || 9, tone(C.fairway2, (P.tone || 0) * 0.25), 0.85, P.mow === 'checker');
      }
      if (detail) {
        ctx.save(); tracePath(ctx, poly, true); ctx.clip();
        ctx.globalAlpha = 0.18; ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = pattern(ctx, noiseCanvas(256, 4, 12), 0.5);
        const bb = polyBBox(poly); ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
        ctx.restore();
      }
      tracePath(ctx, poly, true);
      ctx.strokeStyle = tone(C.fairway, -0.12); ctx.lineWidth = 0.35; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'tee': {
      ctx.strokeStyle = C.first; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = C.tee; ctx.fill();
      stripes(ctx, poly, axis + Math.PI / 2, 1.6, tone(C.tee, 0.12), 0.7);
      break;
    }
    case 'green': {
      const fr = P.fringe ?? 1.3;
      ctx.strokeStyle = C.fringe; ctx.lineWidth = fr * 2; ctx.stroke();
      ctx.fillStyle = C.green; ctx.fill();
      stripes(ctx, poly, axis, 2.4, C.green2, 0.55);
      if (detail) {
        const bb = polyBBox(poly), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2);
        g.addColorStop(0, 'rgba(255,255,220,0.10)'); g.addColorStop(1, 'rgba(0,30,0,0.08)');
        tracePath(ctx, poly, true); ctx.fillStyle = g; ctx.fill();
      }
      break;
    }
    case 'bunker': case 'fbunker': case 'pot': {
      const sand = (SAND_COLORS[P.sand] || SAND_COLORS.white).c;
      ctx.strokeStyle = tone(C.rough, -0.25); ctx.lineWidth = sh.type === 'pot' ? 0.8 : 0.6; ctx.stroke();
      ctx.fillStyle = sand; ctx.fill();
      if (detail) {
        ctx.save(); tracePath(ctx, poly, true); ctx.clip();
        ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = pattern(ctx, noiseCanvas(128, 16, 33, 1.6), 0.03);
        const bb = polyBBox(poly); ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
        ctx.globalCompositeOperation = 'source-over';
        if (P.rake && mpp < 0.4) {
          ctx.strokeStyle = tone(sand, -0.15); ctx.lineWidth = 0.06; ctx.globalAlpha = 0.35;
          for (let y = bb.y0; y < bb.y1; y += 0.35) { ctx.beginPath(); ctx.moveTo(bb.x0, y); for (let x = bb.x0; x <= bb.x1; x += 1) ctx.lineTo(x, y + Math.sin(x * 0.4 + y) * 0.15); ctx.stroke(); }
        }
        // inner shadow toward lip
        ctx.globalAlpha = 0.25; ctx.strokeStyle = tone(sand, -0.4); ctx.lineWidth = 1.2; tracePath(ctx, poly, true); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'water': {
      const wc = WATER_COLORS[P.color] || WATER_COLORS.blue;
      const shore = P.shore || 'grass';
      if (shore === 'sand') { ctx.strokeStyle = '#e8dcb5'; ctx.lineWidth = 4; ctx.stroke(); }
      else if (shore === 'rocks') { ctx.strokeStyle = '#8a8a82'; ctx.lineWidth = 2.4; ctx.stroke(); }
      else if (shore === 'wall') { ctx.strokeStyle = '#9a8e7a'; ctx.lineWidth = 1.2; ctx.stroke(); }
      else { ctx.strokeStyle = '#4e6a32'; ctx.lineWidth = 1.6; ctx.stroke(); }
      ctx.fillStyle = mode === 'texture' ? '#5a5a3e' : wc.deep; ctx.fill();
      if (mode !== 'texture') {
        ctx.save(); ctx.clip();
        ctx.strokeStyle = wc.shallow; ctx.lineWidth = 5; ctx.globalAlpha = 0.6; tracePath(ctx, poly, true); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'oob': {
      if (mode === 'texture') break;
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      const bb = polyBBox(poly);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6;
      for (let d = bb.x0 - (bb.y1 - bb.y0); d < bb.x1; d += 4) { ctx.beginPath(); ctx.moveTo(d, bb.y0); ctx.lineTo(d + (bb.y1 - bb.y0), bb.y1); ctx.stroke(); }
      ctx.restore();
      tracePath(ctx, poly, true); ctx.setLineDash([2, 2]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    default: ctx.fillStyle = '#888'; ctx.fill();
  }
}

// Top-down thumbnail with trees & pin -----------------------------------------------
export function renderThumb(hole, w = 240, h = 360, opt = {}) {
  const c = opt.canvas || document.createElement('canvas');
  const dpr = opt.dpr || 1;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  const bx0 = -hole.width / 2, bx1 = hole.width / 2, by0 = -30, by1 = hole.length;
  // fit the playing corridor
  const pts = hole.shapes.filter((s) => s.type !== 'path' && s.type !== 'oob' && s.type !== 'rough' && s.type !== 'deep').flatMap((s) => s.pts);
  pts.push([hole.pin.x, hole.pin.y]);
  let fb = polyBBox(pts.length ? pts : [[bx0, by0], [bx1, by1]]);
  const pad = 22;
  fb = { x0: fb.x0 - pad, x1: fb.x1 + pad, y0: fb.y0 - pad, y1: fb.y1 + pad };
  const scale = Math.min((w * dpr) / (fb.x1 - fb.x0), (h * dpr) / (fb.y1 - fb.y0));
  const cx = (fb.x0 + fb.x1) / 2, cy = (fb.y0 + fb.y1) / 2;
  const view = { scale, ox: cx - (w * dpr) / 2 / scale, oy: cy + (h * dpr) / 2 / scale };
  paintHole(ctx, hole, view, { mode: 'thumb', bounds: { x0: view.ox, x1: view.ox + w * dpr / scale, y0: view.oy - h * dpr / scale, y1: view.oy } });
  ctx.save();
  ctx.setTransform(scale, 0, 0, -scale, -view.ox * scale, view.oy * scale);
  for (const o of hole.objects) {
    const def = OBJ[o.kind]; if (!def) continue;
    const r = (def.col.canopy ? def.col.canopy[1] : 1.2) * (o.s || 1);
    ctx.fillStyle = def.cat === 'tree' ? 'rgba(20,60,20,0.85)' : def.cat === 'rock' ? 'rgba(120,120,110,0.9)' : 'rgba(40,80,30,0.7)';
    if (def.cat === 'amenity') continue;
    ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(r, 1.6 / scale * dpr), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const px = (hole.pin.x - view.ox) * scale, py = (view.oy - hole.pin.y) * scale;
  ctx.fillStyle = '#fff'; ctx.fillRect(px - 0.75 * dpr, py - 11 * dpr, 1.5 * dpr, 11 * dpr);
  ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.moveTo(px, py - 11 * dpr); ctx.lineTo(px + 7 * dpr, py - 8.5 * dpr); ctx.lineTo(px, py - 6 * dpr); ctx.fill();
  return c;
}
export { noiseCanvas, speckleCanvas };
