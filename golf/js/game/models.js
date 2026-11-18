// Procedural low-poly models: every tree, cactus, rock and prop is built from code.
import * as THREE from 'three';
import { noise2, mulberry32 } from '../core/util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _n3 = new THREE.Matrix3(), _c = new THREE.Color(), _p = new THREE.Vector3(), _nn = new THREE.Vector3();

export const col = (hex) => new THREE.Color(hex);

// Foliage atlas ---------------------------------------------------------------------------
// One 1024px texture drawn in code: broadleaf clusters, conifer needles, palm fronds, grass,
// plus a solid white patch used by trunks & other opaque parts. Colors are near-white so
// per-vertex/instance color supplies the hue.
export const REG = {
  leaf: [0, 0.5, 0.5, 1], needle: [0.5, 0.5, 1, 1], frond: [0, 0, 0.5, 0.5], grass: [0.5, 0.25, 1, 0.5], solid: [0.5, 0, 1, 0.25],
};
const SOLID_UV = [0.75, 0.125];
let atlasTex = null;
export function foliageTexture(renderer) {
  if (atlasTex) return atlasTex;
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = mulberry32(90210);
  const gray = (lo, hi, warm = 0) => { const v = lo + rnd() * (hi - lo); return `rgb(${Math.min(255, v * (1 + warm * 0.06)) | 0},${v | 0},${Math.max(0, v * (0.86 - warm * 0.05)) | 0})`; };
  // solid patch
  g.fillStyle = '#ffffff'; g.fillRect(512, 768, 512, 256);
  // broadleaf cluster (0..512, 0..512)
  g.save(); g.beginPath(); g.rect(4, 4, 504, 504); g.clip();
  g.strokeStyle = 'rgb(120,105,80)'; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2; g.lineWidth = 3 + rnd() * 3;
    g.beginPath(); g.moveTo(256, 256); g.quadraticCurveTo(256 + Math.cos(a + 0.4) * 90, 256 + Math.sin(a + 0.4) * 90, 256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200); g.stroke();
  }
  for (let i = 0; i < 520; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 215;
    const x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r;
    const len = 13 + rnd() * 12, wid = len * (0.42 + rnd() * 0.15), rot = a + (rnd() - 0.5) * 1.6;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = gray(200 + (r / 215) * 30, 255, rnd() < 0.3 ? 1 : 0);
    g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -wid * 1.25, len, 0); g.quadraticCurveTo(0, wid * 1.25, -len, 0); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-len * 0.8, 0); g.lineTo(len * 0.8, 0); g.stroke();
    g.restore();
  }
  g.restore();
  // conifer branch (512..1024, 0..512): branch runs left (trunk) -> right (tip), centered vertically
  g.save(); g.beginPath(); g.rect(516, 4, 504, 504); g.clip();
  const twig = (x0, y0, x1, y1, w, nl, nlen) => {
    g.strokeStyle = 'rgb(110,95,75)'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    for (let i = 0; i < nl; i++) {
      const t = i / nl, px = x0 + dx * t, py = y0 + dy * t, ln = nlen * (1 - t * 0.55) * (0.7 + rnd() * 0.5);
      for (const s of [-1, 1]) {
        const ang = s * (0.9 + rnd() * 0.4);
        const nx = ux * Math.cos(ang) - uy * Math.sin(ang), ny = ux * Math.sin(ang) + uy * Math.cos(ang);
        g.strokeStyle = gray(200, 255); g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + nx * ln, py + ny * ln); g.stroke();
      }
    }
  };
  twig(520, 256, 1010, 256, 6, 90, 34);
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.09, x = 520 + 490 * t, s = i % 2 ? 1 : -1, l = 170 * (1 - t * 0.8);
    twig(x, 256, x + l * 0.75, 256 + s * l * 0.75, 3, 30, 24);
  }
  g.restore();
  // palm frond (0..512, 512..1024): rachis along x at y=768, leaflets to both sides
  g.save(); g.beginPath(); g.rect(4, 516, 504, 504); g.clip();
  for (let i = 0; i < 70; i++) {
    const t = i / 70, x = 10 + t * 490, ln = 230 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)) * (0.85 + rnd() * 0.2);
    for (const s of [-1, 1]) {
      g.fillStyle = gray(205, 255, 1);
      g.beginPath(); g.moveTo(x, 768); g.quadraticCurveTo(x + ln * 0.35, 768 + s * ln * 0.55, x + ln * 0.42, 768 + s * ln * 0.98); g.lineTo(x + ln * 0.42 + 4, 768 + s * ln * 0.98); g.quadraticCurveTo(x + ln * 0.4 + 9, 768 + s * ln * 0.5, x + 9, 768); g.fill();
    }
  }
  g.strokeStyle = 'rgb(200,190,140)'; g.lineWidth = 7; g.beginPath(); g.moveTo(6, 768); g.lineTo(506, 768); g.stroke();
  g.restore();
  // grass blades (512..1024, 512..768): bases on the bottom edge
  g.save(); g.beginPath(); g.rect(516, 516, 504, 250); g.clip();
  for (let i = 0; i < 260; i++) {
    const x = 530 + rnd() * 470, h = 90 + rnd() * 150, lean = (rnd() - 0.5) * 70, w = 3 + rnd() * 4;
    const grd = g.createLinearGradient(0, 766, 0, 766 - h);
    const v = 215 + rnd() * 40;
    grd.addColorStop(0, `rgb(${v * 0.72 | 0},${v * 0.76 | 0},${v * 0.62 | 0})`); grd.addColorStop(1, `rgb(${v | 0},${v | 0},${v * 0.82 | 0})`);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(x - w, 768); g.quadraticCurveTo(x + lean * 0.4, 766 - h * 0.6, x + lean, 766 - h); g.quadraticCurveTo(x + lean * 0.4 + w * 0.3, 766 - h * 0.6, x + w, 768); g.fill();
  }
  g.restore();
  // Alpha bleed: transparent canvas pixels are black, which darkens leaf edges once mipmapped.
  // Give every transparent texel a light foliage color (alpha stays 0) and flip rows for GL.
  const src = g.getImageData(0, 0, S, S).data;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    const sr = y * S * 4, dr = (S - 1 - y) * S * 4;
    for (let x = 0; x < S * 4; x += 4) {
      const a = src[sr + x + 3];
      if (a === 0) { data[dr + x] = 205; data[dr + x + 1] = 210; data[dr + x + 2] = 190; data[dr + x + 3] = 0; }
      else { data[dr + x] = src[sr + x]; data[dr + x + 1] = src[sr + x + 1]; data[dr + x + 2] = src[sr + x + 2]; data[dr + x + 3] = a; }
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  atlasTex = t;
  return t;
}
const ruv = (reg, u, v) => [reg[0] + (reg[2] - reg[0]) * u, reg[1] + (reg[3] - reg[1]) * v];

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  // quad with explicit corners (p00,p10,p11,p01), uv pairs, per-corner colors & normals
  quad(ps, uvs, cols, ns) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(ps[i].x, ps[i].y, ps[i].z);
      this.nor.push(ns[i].x, ns[i].y, ns[i].z);
      this.col.push(cols[i].r, cols[i].g, cols[i].b);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    return this;
  }
  // o: { pos:[x,y,z], rot:[x,y,z], scale:[x,y,z]|n, color: Color|fn(p,n)->Color, jitter, seed, radial:[x,y,z]|null, radialMix, flat }
  add(geo, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const sc = o.scale == null ? [1, 1, 1] : typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale;
    _e.set(...(o.rot || [0, 0, 0]));
    _q.setFromEuler(_e);
    _m.compose(_v.set(...(o.pos || [0, 0, 0])), _q, _s.set(...sc));
    g.applyMatrix4(_m);
    const P = g.attributes.position;
    if (o.jitter) {
      const f = o.jfreq || 1.3, seed = o.seed || 0;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        const kx = Math.round(x * 1000) / 1000, ky = Math.round(y * 1000) / 1000, kz = Math.round(z * 1000) / 1000;
        P.setXYZ(i,
          x + noise2(kx * f + kz * 0.7, ky * f, seed) * o.jitter,
          y + noise2(ky * f + kx * 0.3, kz * f, seed + 5) * o.jitter,
          z + noise2(kz * f + ky * 0.5, kx * f, seed + 9) * o.jitter);
      }
    }
    g.computeVertexNormals();
    const N = g.attributes.normal;
    if (o.radial) {
      const rc = new THREE.Vector3(...o.radial), mixv = o.radialMix ?? 0.75;
      for (let i = 0; i < P.count; i++) {
        _p.set(P.getX(i), P.getY(i), P.getZ(i));
        _nn.copy(_p).sub(rc);
        if (o.axial) _nn.y = _nn.y * 0.25 + 0.6 * Math.hypot(_nn.x, _nn.z) * 0.5;
        _nn.normalize();
        _v.set(N.getX(i), N.getY(i), N.getZ(i)).lerp(_nn, mixv).normalize();
        N.setXYZ(i, _v.x, _v.y, _v.z);
      }
    }
    for (let i = 0; i < P.count; i++) {
      this.pos.push(P.getX(i), P.getY(i), P.getZ(i));
      this.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      let c = o.color;
      if (typeof c === 'function') c = c(_p.set(P.getX(i), P.getY(i), P.getZ(i)), i);
      c = c || _c.set(1, 1, 1);
      this.col.push(c.r, c.g, c.b);
      this.uv.push(SOLID_UV[0], SOLID_UV[1]);
    }
    g.dispose();
    return this;
  }
  addRaw(positions, colors) {
    // positions: flat array of triangles; computes flat normals
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      this.pos.push(P.getX(i), P.getY(i), P.getZ(i));
      this.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const c = colors[Math.floor(i / 3)] || colors[0];
      this.col.push(c.r, c.g, c.b);
      this.uv.push(SOLID_UV[0], SOLID_UV[1]);
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const cyl = (rt, rb, h, seg = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(0, h / 2, 0);
const blob = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg, 1, true).translate(0, h / 2, 0);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const shade = (base, y0, y1, lo = 0.55, hi = 1.15) => (p) => {
  const t = Math.max(0, Math.min(1, (p.y - y0) / (y1 - y0)));
  return _c.copy(base).multiplyScalar(lo + (hi - lo) * t);
};
const speckled = (a, b, f, seed) => (p) => (noise2(p.x * f + p.z * 0.6, p.y * f, seed) > 0.25 ? _c.copy(b) : _c.copy(a));

const LOD = { on: false, density: 1, size: 1 };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
// Palm/fern frond: a curved, V-folded strip textured with leaflets
function frond(gb, base, yaw, len, w, droop, color, tipColor, fan = false) {
  const segs = 7, pts = [];
  const dx = Math.sin(yaw), dz = Math.cos(yaw), px = Math.cos(yaw), pz = -Math.sin(yaw);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, l = t * len;
    const y = base[1] + l * 0.35 - droop * l * l / len;
    const c = V3(base[0] + dx * l, y, base[2] + dz * l);
    const ww = fan ? w * (0.35 + t * 0.8) : w;
    const fold = ww * 0.3;
    pts.push({ c, l: V3(c.x + px * ww, c.y - fold, c.z + pz * ww), r: V3(c.x - px * ww, c.y - fold, c.z - pz * ww), t });
  }
  const reg = REG.frond;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const ca = _c.copy(color).lerp(tipColor, a.t).clone(), cb = _c.copy(color).lerp(tipColor, b.t).clone();
    const n = V3(0, 1, 0);
    // left half (v 0.5 -> 1) and right half (v 0.5 -> 0)
    gb.quad([a.c, b.c, b.l, a.l], [ruv(reg, a.t, 0.5), ruv(reg, b.t, 0.5), ruv(reg, b.t, 1), ruv(reg, a.t, 1)], [ca, cb, cb, ca], [n, n, n, n]);
    gb.quad([a.r, b.r, b.c, a.c], [ruv(reg, a.t, 0), ruv(reg, b.t, 0), ruv(reg, b.t, 0.5), ruv(reg, a.t, 0.5)], [ca, cb, cb, ca], [n, n, n, n]);
  }
}
// Crossed grass cards
function grassCards(gb, n, h, w, color, tip, rnd, spread = 0.15) {
  const reg = REG.grass;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI + rnd() * 0.5;
    const ox = (rnd() - 0.5) * spread, oz = (rnd() - 0.5) * spread;
    const ax = Math.cos(a) * w / 2, az = Math.sin(a) * w / 2;
    const hh = h * (0.8 + rnd() * 0.4), lean = (rnd() - 0.5) * 0.25 * h;
    const p00 = V3(ox - ax, 0, oz - az), p10 = V3(ox + ax, 0, oz + az), p11 = V3(ox + ax + lean, hh, oz + az), p01 = V3(ox - ax + lean, hh, oz - az);
    const n0 = V3(0, 1, 0);
    gb.quad([p00, p10, p11, p01], [ruv(reg, 0, 0), ruv(reg, 1, 0), ruv(reg, 1, 1), ruv(reg, 0, 1)], [color, color, tip, tip], [n0, n0, n0, n0]);
  }
}
// Broadleaf canopy: dark inner volume + leaf-cluster cards scattered over each lobe
function leafCanopy(gb, rnd, blobs, base, o = {}) {
  const C = V3(...(o.center || [0, blobs[0][1], 0]));
  const sq = o.squash ?? 1;
  let y0 = Infinity, y1 = -Infinity, R = 0;
  for (const [x, y, z, r] of blobs) { y0 = Math.min(y0, y - r * sq); y1 = Math.max(y1, y + r * sq); R = Math.max(R, Math.hypot(x - C.x, z - C.z) + r); }
  const reg = o.region || REG.leaf;
  const tmp = new THREE.Vector3();
  blobs.forEach(([x, y, z, r], bi) => {
    if (o.core !== false) gb.add(blob(r * 0.74, 0), { pos: [x, y, z], scale: [1, sq, 1], color: _c.copy(base).multiplyScalar(0.42), jitter: r * 0.1, seed: bi * 3 + 1, radial: [C.x, C.y, C.z] });
    const n = Math.round(r * r * (o.density ?? 2.6) * 0.75 * LOD.density) + (LOD.on ? 2 : 3);
    for (let k = 0; k < n; k++) {
      const d = V3(rnd() * 2 - 1, rnd() * 2 - 1 + 0.25, rnd() * 2 - 1).normalize();
      const p = V3(x, y, z).add(tmp.copy(d).multiplyScalar(r * (0.55 + rnd() * 0.45)).multiply(V3(1, sq, 1)));
      const s = (o.cardSize ?? 1) * (1.2 + r * 0.38) * (0.8 + rnd() * 0.45) * 1.15 * LOD.size;
      const fn = d.clone().add(V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2)).normalize();
      const t1 = new THREE.Vector3().crossVectors(fn, Math.abs(fn.y) < 0.9 ? UP : V3(1, 0, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(fn, t1);
      const roll = rnd() * Math.PI * 2, cr = Math.cos(roll), sr = Math.sin(roll);
      const u = t1.clone().multiplyScalar(cr).addScaledVector(t2, sr).multiplyScalar(s / 2);
      const v = t2.clone().multiplyScalar(cr).addScaledVector(t1, -sr).multiplyScalar(s / 2);
      const ps = [p.clone().sub(u).sub(v), p.clone().add(u).sub(v), p.clone().add(u).add(v), p.clone().sub(u).add(v)];
      const bright = 0.85 + rnd() * 0.3;
      const cols = ps.map((q) => {
        const hy = (q.y - y0) / Math.max(0.1, y1 - y0);
        const out = Math.min(1, Math.hypot(q.x - C.x, q.z - C.z) / Math.max(0.5, R));
        return base.clone().multiplyScalar((0.55 + 0.4 * hy + 0.2 * out) * bright);
      });
      const ns = ps.map((q) => q.clone().sub(C).normalize().lerp(fn, 0.25).normalize());
      gb.quad(ps, [ruv(reg, 0, 0), ruv(reg, 1, 0), ruv(reg, 1, 1), ruv(reg, 0, 1)], cols, ns);
    }
  });
}
// Conifer: stacked whorls of drooping needle-branch cards around a dark core
function conifer(gb, rnd, o) {
  const { H, R, tiers, base, y0 = 1.2 } = o;
  const reg = REG.needle;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), y = y0 + t * (H - y0 - 0.8), r = R * Math.pow(1 - t, 1.1) * 0.95 + 0.3;
    gb.add(cone(r * 0.62, (H - y0) / tiers * 1.9, LOD.on ? 5 : 7), { pos: [0, y - 0.5, 0], color: _c.copy(base).multiplyScalar(0.38), jitter: 0.1, seed: i, radial: [0, y + 1, 0], radialMix: 0.6 });
    const k = Math.max(3, Math.round((5 + r * 2) * LOD.density));
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2 + rnd() * 0.5 + i * 0.9;
      const droop = 0.22 + rnd() * 0.3 + t * 0.1;
      const L = r * (0.95 + rnd() * 0.3), wdt = (0.6 + r * 0.32) * (0.9 + rnd() * 0.3) * LOD.size;
      const dir = V3(Math.cos(a) * Math.cos(droop), -Math.sin(droop), Math.sin(a) * Math.cos(droop));
      const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
      const tilt = (rnd() - 0.5) * 0.9;
      side.applyAxisAngle(dir, tilt);
      const b0 = V3(0, y + rnd() * 0.4, 0).addScaledVector(dir, 0.15);
      const tip = b0.clone().addScaledVector(dir, L);
      const hw = side.clone().multiplyScalar(wdt / 2);
      const ps = [b0.clone().sub(hw.clone().multiplyScalar(0.5)), tip.clone().sub(hw), tip.clone().add(hw), b0.clone().add(hw.clone().multiplyScalar(0.5))];
      const shadeY = 0.6 + 0.5 * t;
      const cIn = base.clone().multiplyScalar(0.5 * shadeY + 0.15), cOut = base.clone().multiplyScalar(1.05 * shadeY + 0.1);
      const ns = ps.map((q) => V3(q.x, 0.55 * Math.hypot(q.x, q.z) + 0.3, q.z).normalize());
      gb.quad(ps, [ruv(reg, 0, 0.5 - 0.25), ruv(reg, 1, 0), ruv(reg, 1, 1), ruv(reg, 0, 0.5 + 0.25)], [cIn, cOut, cOut, cIn], ns);
    }
  }
  // spire
  for (let j = 0; j < 3; j++) {
    const a = j * Math.PI / 3, s = V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.45);
    const b = V3(0, H - 1.6, 0), tp = V3(0, H + 0.2, 0);
    const n0 = V3(Math.cos(a + 1.57), 0.3, Math.sin(a + 1.57)).normalize();
    const cc = base.clone().multiplyScalar(1.05);
    gb.quad([b.clone().sub(s), b.clone().add(s), tp.clone().add(s.clone().multiplyScalar(0.2)), tp.clone().sub(s.clone().multiplyScalar(0.2))], [ruv(reg, 0.2, 0), ruv(reg, 0.2, 1), ruv(reg, 1, 1), ruv(reg, 1, 0)], [cc, cc, cc, cc], [n0, n0, n0, n0]);
  }
}
function blades(gb, n, h, spread, color, tip, rnd) { grassCards(gb, Math.max(2, Math.round(n / 8)), h, Math.max(0.35, spread * 2.2), color, tip, rnd, spread); }

// Species ---------------------------------------------------------------------------------
const BARK = col('#5a4331'), BARK_D = col('#3f2f22');
function leafColor(kind, fall, rnd) {
  const sets = {
    oak: fall ? ['#b8561e', '#c98a2c', '#9a3f1c', '#7a6a2a'] : ['#3f6b2a', '#4a7a31'],
    maple: fall ? ['#d4411d', '#e8762a', '#f0aa30', '#b52a1a'] : ['#477d2e', '#558f36'],
    birch: fall ? ['#e2b72e', '#f0cc4a'] : ['#6e9a3a', '#82aa47'],
    aspen: fall ? ['#f0c232', '#e8a822'] : ['#79a43f', '#8cb04a'],
    willow: fall ? ['#c8b03a'] : ['#7a9a3a'],
  };
  const a = sets[kind] || ['#4a7a31'];
  return col(a[Math.floor(rnd() * a.length)]).multiplyScalar(1.05);
}
// branching limbs that show through the leaf cards
function limbs(gb, rnd, n, y0, y1, len, r, color) {
  if (LOD.on) n = Math.min(n, 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8, tilt = 0.6 + rnd() * 0.5, y = y0 + rnd() * (y1 - y0);
    gb.add(cyl(r * 0.45, r, len * (0.7 + rnd() * 0.5), 4, true), { pos: [0, y, 0], rot: [Math.sin(a) * tilt, 0, Math.cos(a) * tilt], color });
  }
}

const SPECIES = {
  oak(gb, rnd, o) {
    const leaf = leafColor('oak', o.fall, rnd);
    gb.add(cyl(0.26, 0.45, 4.6, 8), { color: BARK, jitter: 0.05 });
    limbs(gb, rnd, 5, 3.2, 4.6, 3.2, 0.2, BARK);
    const blobs = [[0, 7.8, 0, 3.1], [2.5, 6.8, 0.6, 2.4], [-2.3, 7, -0.8, 2.5], [0.6, 6.5, 2.4, 2.3], [-0.8, 6.3, -2.4, 2.3], [1.2, 8.8, -1.2, 2], [-1.4, 8.6, 1.3, 1.9]];
    blobs.forEach((b) => { b[0] += (rnd() - 0.5) * 0.8; b[2] += (rnd() - 0.5) * 0.8; b[3] *= 0.9 + rnd() * 0.2; });
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 7, 0] });
  },
  maple(gb, rnd, o) {
    const leaf = leafColor('maple', o.fall, rnd);
    gb.add(cyl(0.22, 0.38, 4.4, 8), { color: BARK, jitter: 0.03 });
    limbs(gb, rnd, 4, 3.5, 4.5, 2.8, 0.16, BARK);
    const blobs = [[0, 8, 0, 3], [1.9, 7, 0.8, 2.2], [-1.8, 7.2, -0.9, 2.3], [0.5, 9.8, 0.2, 2.1], [-0.4, 6.6, 1.9, 2], [0.4, 6.8, -2, 2]];
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 7.8, 0] });
  },
  birch(gb, rnd, o) {
    const leaf = leafColor('birch', o.fall, rnd);
    gb.add(cyl(0.12, 0.2, 10, 7), { color: speckled(col('#ebe7de'), col('#2c2a28'), 3.2, o.v) });
    gb.add(cyl(0.07, 0.1, 3, 5), { pos: [0, 5, 0], rot: [0, 0, 0.6], color: col('#e6e2d8') });
    const blobs = [];
    for (let i = 0; i < 6; i++) { const a = i * 2.1; blobs.push([Math.cos(a) * 1.1, 5 + i * 0.95, Math.sin(a) * 1.1, 1.4 + rnd() * 0.45]); }
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 7.6, 0], squash: 1.2, cardSize: 0.75, density: 3.2 });
  },
  aspen(gb, rnd, o) {
    const leaf = leafColor('aspen', o.fall, rnd);
    gb.add(cyl(0.1, 0.17, 10.5, 7), { color: speckled(col('#dcdccb'), col('#3a3a32'), 2.5, o.v) });
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push([(rnd() - 0.5) * 1.2, 6 + i * 1.3, (rnd() - 0.5) * 1.2, 1.5]);
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 7.6, 0], squash: 1.5, cardSize: 0.7, density: 3.4 });
  },
  pine(gb, rnd, o) {
    gb.add(cyl(0.18, 0.34, 12.5, 8), { color: col('#6a4630'), jitter: 0.05 });
    limbs(gb, rnd, 6, 9.5, 12, 2.6, 0.1, BARK_D);
    const leaf = col('#3a6a30');
    const bl = [[0, 12.6, 0, 2.2], [1.8, 11.4, 0.4, 1.8], [-1.6, 11.6, -0.6, 1.9], [0.3, 11, 1.8, 1.7], [-0.4, 10.6, -1.8, 1.6], [1, 13.4, -0.8, 1.4], [-2.2, 10.4, 1, 1.3]];
    leafCanopy(gb, rnd, bl, leaf, { center: [0, 11.6, 0], squash: 0.55, region: REG.needle, cardSize: 1.1, density: 3 });
  },
  spruce(gb, rnd, o) {
    gb.add(cyl(0.16, 0.36, 4, 7), { color: BARK_D });
    conifer(gb, rnd, { H: 15, R: 3.7, tiers: 9, base: col(rnd() < 0.5 ? '#2c5634' : '#335e3a') });
  },
  fir(gb, rnd, o) {
    gb.add(cyl(0.14, 0.3, 3.5, 7), { color: BARK_D });
    conifer(gb, rnd, { H: 16, R: 2.8, tiers: 10, base: col('#3a6a3c'), y0: 1 });
  },
  willow(gb, rnd, o) {
    const leaf = leafColor('willow', o.fall, rnd);
    gb.add(cyl(0.35, 0.55, 3.4, 8), { color: BARK, jitter: 0.06 });
    limbs(gb, rnd, 6, 2.8, 3.6, 3.4, 0.18, BARK);
    leafCanopy(gb, rnd, [[0, 6.2, 0, 4], [2, 5.4, 1, 2.6], [-2, 5.6, -1, 2.6]], leaf, { center: [0, 5, 0], squash: 0.75 });
    // hanging curtains
    const reg = REG.grass;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2, r = 3.4 + rnd() * 1.2, top = 6.4 + rnd() * 0.6, len = 3.6 + rnd() * 1.4;
      const c0 = V3(Math.cos(a) * r, top, Math.sin(a) * r), side = V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.8);
      const out = V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.5);
      const b0 = c0.clone().add(out).setY(top - len);
      const n0 = V3(Math.cos(a), 0.4, Math.sin(a)).normalize();
      const cT = leaf.clone().multiplyScalar(0.95), cB = leaf.clone().multiplyScalar(0.6);
      gb.quad([b0.clone().sub(side), b0.clone().add(side), c0.clone().add(side), c0.clone().sub(side)], [ruv(reg, 0, 1), ruv(reg, 1, 1), ruv(reg, 1, 0), ruv(reg, 0, 0)], [cB, cB, cT, cT], [n0, n0, n0, n0]);
    }
  },
  cypress(gb, rnd, o) {
    gb.add(cyl(0.15, 0.25, 1.5, 6), { color: BARK_D });
    const leaf = col('#3a603a');
    const blobs = [];
    for (let i = 0; i < 7; i++) blobs.push([(rnd() - 0.5) * 0.4, 1.8 + i * 1.35, (rnd() - 0.5) * 0.4, 1.5 - Math.abs(i - 2.5) * 0.15]);
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 6, 0], squash: 1.1, region: REG.needle, cardSize: 0.7, density: 3.5 });
  },
  monterey(gb, rnd, o) {
    gb.add(cyl(0.25, 0.45, 3, 6), { rot: [0, 0, -0.25], color: BARK, jitter: 0.06 });
    gb.add(cyl(0.16, 0.26, 3, 5), { pos: [0.7, 2.8, 0], rot: [0, 0, -0.9], color: BARK });
    gb.add(cyl(0.14, 0.22, 2.4, 5), { pos: [0.5, 2.6, 0], rot: [0.7, 0, 0.4], color: BARK });
    const leaf = col('#45683a');
    const p = [[2.5, 5.2, 0, 3.2], [0.2, 5.8, 0.5, 2.6], [3.8, 4.6, -0.6, 2.2], [1.4, 6.3, -1, 2.2], [-0.8, 4.8, -0.4, 1.8]];
    leafCanopy(gb, rnd, p, leaf, { center: [1.5, 5, 0], squash: 0.38, region: REG.needle, cardSize: 1.1 });
  },
  palm(gb, rnd, o) {
    const segs = 9, bend = 0.06 + rnd() * 0.05;
    let x = 0, y = 0, ang = 0;
    for (let i = 0; i < segs; i++) {
      const l = 1.08, r0 = 0.24 - i * 0.008;
      gb.add(cyl(r0 - 0.02, r0, l, 7), { pos: [x, y, 0], rot: [0, 0, -ang], color: i % 2 ? col('#8a7356') : col('#6f5a42') });
      x += Math.sin(ang) * l; y += Math.cos(ang) * l; ang += bend;
    }
    const top = [x, y, 0];
    const g = col('#5a9a38'), tip = col('#9ab855');
    const n = 11;
    for (let i = 0; i < n; i++) frond(gb, top, (i / n) * Math.PI * 2 + rnd() * 0.3, 4.4 + rnd() * 0.8, 1.15, 1.4 + rnd() * 0.6, g, tip);
    for (let i = 0; i < 5; i++) frond(gb, [top[0], top[1] + 0.2, 0], (i / 5) * Math.PI * 2 + 0.5, 2.8, 0.9, 0.15, g, tip);
    for (let i = 0; i < 4; i++) frond(gb, [top[0], top[1] - 0.3, 0], (i / 4) * Math.PI * 2 + 0.2, 2.4, 0.8, 2.2, col('#8a7a4a'), col('#a08a55'));
    for (let i = 0; i < 3; i++) gb.add(blob(0.16, 0), { pos: [top[0] + Math.cos(i * 2) * 0.25, top[1] - 0.25, Math.sin(i * 2) * 0.25], color: col('#6a4a20') });
  },
  fanpalm(gb, rnd, o) {
    gb.add(cyl(0.26, 0.36, 11, 7), { color: (p) => _c.set('#8a7a66').multiplyScalar(0.85 + 0.15 * Math.sin(p.y * 6)) });
    gb.add(new THREE.ConeGeometry(0.95, 2.6, 8, 1, true).translate(0, -1.3, 0), { pos: [0, 11.2, 0], rot: [Math.PI, 0, 0], color: col('#7a6040'), jitter: 0.12, seed: o.v });
    const g = col('#5f9050'), tip = col('#80b066');
    for (let i = 0; i < 18; i++) frond(gb, [0, 11, 0], (i / 18) * Math.PI * 2 + rnd() * 0.2, 2.1 + rnd() * 0.5, 1.0, 0.25 + rnd() * 0.4, g, tip, true);
  },
  saguaro(gb, rnd, o) {
    const green = col('#5d7d3c'), dark = col('#466231');
    const ribbed = (geo, r) => {
      const P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + 0.1 * Math.cos(a * 12);
        P.setX(i, x * k); P.setZ(i, z * k);
      }
      void r; return geo;
    };
    const ribCol = (p) => { const a = Math.atan2(p.z, p.x); return Math.cos(a * 12) > 0.3 ? _c.copy(green) : _c.copy(dark); };
    const H = 6 + rnd() * 2.5;
    gb.add(ribbed(new THREE.CylinderGeometry(0.36, 0.42, H, 16, 1, true).translate(0, H / 2, 0)), { color: ribCol });
    gb.add(ribbed(new THREE.SphereGeometry(0.36, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), { pos: [0, H, 0], color: ribCol });
    const arms = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + rnd(), h = 2.4 + rnd() * 2.2, out = 0.75 + rnd() * 0.4, up = 1.4 + rnd() * 1.8;
      const dx = Math.cos(a), dz = Math.sin(a);
      gb.add(new THREE.CylinderGeometry(0.25, 0.27, out, 12).rotateZ(Math.PI / 2).translate(out / 2, 0, 0).rotateY(-a), { pos: [0, h, 0], color: ribCol });
      gb.add(new THREE.SphereGeometry(0.27, 12, 8), { pos: [dx * out, h, dz * out], color: green });
      gb.add(ribbed(new THREE.CylinderGeometry(0.25, 0.27, up, 12, 1, true).translate(0, up / 2, 0)), { pos: [dx * out, h, dz * out], color: ribCol });
      gb.add(ribbed(new THREE.SphereGeometry(0.25, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)), { pos: [dx * out, h + up, dz * out], color: ribCol });
    }
  },
  joshua(gb, rnd, o) {
    const bark = col('#6b5a44'), spike = col('#5d6e3a');
    gb.add(cyl(0.22, 0.34, 2.6, 7), { color: bark, jitter: 0.05 });
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + rnd(), tilt = 0.5 + rnd() * 0.4, l = 1.5 + rnd();
      gb.add(cyl(0.12, 0.18, l, 6), { pos: [0, 2.4, 0], rot: [Math.sin(a) * tilt, 0, Math.cos(a) * tilt], color: bark });
      tips.push([-Math.cos(a) * Math.sin(tilt) * l, 2.4 + Math.cos(tilt) * l, Math.sin(a) * Math.sin(tilt) * l]);
    }
    for (const t of tips) for (let k = 0; k < 7; k++) {
      const a = k * 0.9, b = 0.4 + (k % 3) * 0.5;
      gb.add(new THREE.ConeGeometry(0.18, 0.9, 4).translate(0, 0.45, 0), { pos: t, rot: [Math.cos(a) * b, a, Math.sin(a) * b], color: spike });
    }
  },
  paloverde(gb, rnd, o) {
    const bark = col('#8b9a55'), leaf = col(rnd() < 0.3 ? '#c8c84a' : '#9aaf55');
    gb.add(cyl(0.16, 0.26, 1.8, 6), { color: bark });
    for (let i = 0; i < 3; i++) gb.add(cyl(0.08, 0.14, 2.4, 5), { pos: [0, 1.6, 0], rot: [Math.sin(i * 2.1) * 0.8, 0, Math.cos(i * 2.1) * 0.8], color: bark });
    const blobs = [];
    for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 2.4; blobs.push([Math.cos(a) * r, 3.3 + rnd() * 1.1, Math.sin(a) * r, 0.9 + rnd() * 0.5]); }
    leafCanopy(gb, rnd, blobs, leaf.clone().multiplyScalar(1.2), { center: [0, 3, 0], squash: 0.6, cardSize: 0.8, core: false, density: 3.5 });
  },
  bush(gb, rnd, o) {
    const leaf = col(o.fall && rnd() < 0.5 ? '#b04a28' : rnd() < 0.5 ? '#4a8034' : '#558a38');
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push([(rnd() - 0.5) * 1.2, 0.65 + rnd() * 0.4, (rnd() - 0.5) * 1.2, 0.75 + rnd() * 0.35]);
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 0.3, 0], cardSize: 0.55, density: 4 });
  },
  hibiscus(gb, rnd, o) {
    SPECIES.bush(gb, rnd, o);
    const fl = col(rnd() < 0.5 ? '#e8303a' : '#ff6aa0');
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, e = rnd() * 1.2;
      gb.add(blob(0.11, 0), { pos: [Math.cos(a) * Math.cos(e) * 1.05, 0.8 + Math.sin(e) * 0.8, Math.sin(a) * Math.cos(e) * 1.05], color: fl });
    }
  },
  fern(gb, rnd, o) {
    const g = col('#4a8a32'), t = col('#7ab048');
    for (let i = 0; i < 11; i++) frond(gb, [0, 0.05, 0], (i / 11) * Math.PI * 2 + rnd() * 0.4, 1.3 + rnd() * 0.4, 0.38, 0.7, g, t);
  },
  gorse(gb, rnd, o) {
    const leaf = col('#4a6a32'), fl = col('#f0d030');
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push([(rnd() - 0.5) * 1.4, 0.7 + rnd() * 0.3, (rnd() - 0.5) * 1.4, 0.75 + rnd() * 0.3]);
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 0.3, 0], region: REG.needle, cardSize: 0.55, density: 4 });
    for (let i = 0; i < 30; i++) { const a = rnd() * Math.PI * 2, e = rnd() * 1.3, R = 1 + rnd() * 0.3; gb.add(blob(0.06, 0), { pos: [Math.cos(a) * Math.cos(e) * R, 0.6 + Math.sin(e) * 0.8, Math.sin(a) * Math.cos(e) * R], color: fl }); }
  },
  heather(gb, rnd, o) {
    const a = col('#a070a8');
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push([(rnd() - 0.5) * 1.6, 0.18, (rnd() - 0.5) * 1.6, 0.6 + rnd() * 0.4]);
    leafCanopy(gb, rnd, blobs, a, { center: [0, -0.2, 0], squash: 0.45, region: REG.needle, cardSize: 0.5, density: 4 });
  },
  fescue(gb, rnd, o) { grassCards(gb, 5, 0.95, 0.9, col('#9a8a50'), col('#e0d090'), rnd, 0.25); },
  reeds(gb, rnd, o) {
    const g = col('#5a7a3a'), br = col('#5a3a22');
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * 1, z = (rnd() - 0.5) * 1, h = 1.2 + rnd() * 0.7;
      gb.add(cyl(0.015, 0.025, h, 4), { pos: [x, 0, z], rot: [(rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2], color: g });
      if (rnd() < 0.6) gb.add(cyl(0.045, 0.045, 0.22, 5), { pos: [x, h - 0.1, z], color: br });
    }
    grassCards(gb, 4, 1.1, 0.9, col('#4f7a32'), col('#9aba5a'), rnd, 0.3);
  },
  flowers(gb, rnd, o) {
    const pal = ['#e8423f', '#f5c242', '#ffffff', '#b04ad8', '#ff8a3d', '#4a7ae8'].map(col);
    const g = col('#3f7a2a');
    for (let i = 0; i < 18; i++) {
      const x = (rnd() - 0.5) * 1.6, z = (rnd() - 0.5) * 1.6, h = 0.2 + rnd() * 0.25;
      gb.add(cyl(0.01, 0.012, h, 3), { pos: [x, 0, z], color: g });
      gb.add(blob(0.05, 0), { pos: [x, h, z], color: pal[Math.floor(rnd() * pal.length)] });
    }
    grassCards(gb, 4, 0.35, 1.2, g, col('#6aaa45'), rnd, 0.6);
  },
  pricklypear(gb, rnd, o) {
    const g = col('#6e8f45'), fruit = col(rnd() < 0.5 ? '#c03a6a' : '#e8b030');
    const pads = [];
    const add = (x, y, z, ry, rz, d) => {
      gb.add(new THREE.SphereGeometry(0.32, 8, 6), { pos: [x, y, z], rot: [0, ry, rz], scale: [1, 1.25, 0.28], color: shade(g, 0, 1.6, 0.75, 1.1) });
      pads.push([x, y, z]);
      if (d < 2) for (let k = 0; k < 2; k++) if (rnd() < 0.75) add(x + (rnd() - 0.5) * 0.5, y + 0.45, z + (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.8, d + 1);
    };
    add(0, 0.3, 0, 0, 0, 0); add(0.35, 0.28, 0.2, 1.4, 0.3, 1);
    for (const p of pads) if (rnd() < 0.4) gb.add(blob(0.05, 0), { pos: [p[0], p[1] + 0.38, p[2]], color: fruit });
  },
  barrel(gb, rnd, o) {
    const g = col('#5f7f3a');
    const s = new THREE.SphereGeometry(0.4, 18, 10);
    const P = s.attributes.position;
    for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getZ(i), P.getX(i)), k = 1 + 0.08 * Math.cos(a * 16); P.setX(i, P.getX(i) * k); P.setZ(i, P.getZ(i) * k); }
    gb.add(s, { pos: [0, 0.4, 0], scale: [1, 1.25, 1], color: shade(g, 0, 0.9, 0.7, 1.15) });
    for (let i = 0; i < 8; i++) gb.add(blob(0.05, 0), { pos: [Math.cos(i) * 0.14, 0.9, Math.sin(i) * 0.14], color: col('#e8c030') });
  },
  ocotillo(gb, rnd, o) {
    const c = col('#5a5a3a'), red = col('#d8402a');
    for (let i = 0; i < 13; i++) {
      const a = rnd() * Math.PI * 2, t = 0.15 + rnd() * 0.35, l = 3 + rnd() * 1.5;
      gb.add(cyl(0.02, 0.035, l, 4), { rot: [Math.sin(a) * t, 0, Math.cos(a) * t], color: c });
      gb.add(cyl(0.01, 0.03, 0.35, 4), { pos: [-Math.cos(a) * Math.sin(t) * l, Math.cos(t) * l, Math.sin(a) * Math.sin(t) * l], rot: [Math.sin(a) * t, 0, Math.cos(a) * t], color: red });
    }
  },
  creosote(gb, rnd, o) {
    const leaf = col('#7f8f48');
    const blobs = [];
    for (let i = 0; i < 5; i++) blobs.push([(rnd() - 0.5) * 1.1, 0.55 + rnd() * 0.3, (rnd() - 0.5) * 1.1, 0.45 + rnd() * 0.3]);
    leafCanopy(gb, rnd, blobs, leaf, { center: [0, 0.2, 0], cardSize: 0.45, density: 5 });
    limbs(gb, rnd, 5, 0, 0.2, 0.8, 0.03, col('#5a4a38'));
  },
  boulder(gb, rnd, o) {
    gb.add(blob(1, 1), { pos: [0, 0.35, 0], scale: [1.25, 0.85, 1], color: (p) => _c.set('#8c8a84').multiplyScalar(0.8 + 0.3 * noise2(p.x * 2, p.y * 2 + p.z, o.v)), jitter: 0.22, seed: o.v, jfreq: 1.1 });
  },
  rocks(gb, rnd, o) {
    for (let i = 0; i < 5; i++) gb.add(blob(0.25 + rnd() * 0.35, 0), { pos: [(rnd() - 0.5) * 1.6, 0.1, (rnd() - 0.5) * 1.6], scale: [1, 0.7, 1], color: col(rnd() < 0.5 ? '#8a8780' : '#9a958c'), jitter: 0.08, seed: i });
  },
  desertrock(gb, rnd, o) {
    const layers = ['#b5703f', '#c98a55', '#a65f35', '#d39a65'].map(col);
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const h = 0.35 + rnd() * 0.3, w = 2.4 - i * 0.4 + rnd() * 0.3;
      gb.add(box(w, h, w * 0.8), { pos: [(rnd() - 0.5) * 0.3, y + h / 2, (rnd() - 0.5) * 0.3], rot: [0, rnd(), 0], color: layers[i], jitter: 0.08, seed: i + o.v, jfreq: 2 });
      y += h;
    }
  },
  // Furniture -----------------------------------------------------------------------
  bench(gb) {
    const wood = col('#8a5a35'), metal = col('#2d2d2d');
    for (let i = 0; i < 3; i++) gb.add(box(1.8, 0.04, 0.12), { pos: [0, 0.45, -0.15 + i * 0.14], color: wood });
    for (let i = 0; i < 2; i++) gb.add(box(1.8, 0.1, 0.04), { pos: [0, 0.62 + i * 0.14, -0.26], rot: [-0.15, 0, 0], color: wood });
    for (const x of [-0.75, 0.75]) { gb.add(box(0.06, 0.45, 0.4), { pos: [x, 0.22, -0.02], color: metal }); gb.add(box(0.06, 0.4, 0.05), { pos: [x, 0.65, -0.26], color: metal }); }
  },
  washer(gb) {
    gb.add(cyl(0.05, 0.05, 0.85, 6), { color: col('#2f5f3a') });
    gb.add(box(0.22, 0.28, 0.16), { pos: [0, 0.98, 0], color: col('#3d7f4c') });
    gb.add(cyl(0.015, 0.015, 0.3, 4), { pos: [0, 1.12, 0], color: col('#cfcfcf') });
  },
  bin(gb) {
    gb.add(cyl(0.27, 0.25, 0.85, 10), { color: col('#2f4a33') });
    gb.add(cyl(0.29, 0.29, 0.05, 10), { pos: [0, 0.85, 0], color: col('#24382a') });
  },
  sign(gb) {
    const wood = col('#4a3424');
    for (const x of [-0.5, 0.5]) gb.add(box(0.08, 1.4, 0.08), { pos: [x, 0.7, 0], color: wood });
    gb.add(box(1.15, 0.75, 0.06), { pos: [0, 1.05, 0], color: col('#f0ece0') });
    gb.add(box(1.05, 0.65, 0.07), { pos: [0, 1.05, 0], color: col('#1f4d2f') });
  },
  post(gb) {
    gb.add(box(0.1, 0.6, 0.1), { pos: [0, 0.3, 0], color: col('#f0f0f0') });
    gb.add(box(0.12, 0.1, 0.12), { pos: [0, 0.62, 0], color: col('#2a62d8') });
  },
  cart(gb) {
    const w = col('#f2f2f2'), dk = col('#2a2a2a'), seat = col('#c9b38a');
    gb.add(box(1.2, 0.35, 2.3), { pos: [0, 0.45, 0], color: w });
    gb.add(box(1.15, 0.5, 0.6), { pos: [0, 0.75, -0.85], color: w });
    gb.add(box(1.05, 0.15, 0.6), { pos: [0, 0.75, 0.15], color: seat });
    gb.add(box(1.05, 0.55, 0.12), { pos: [0, 1.05, 0.48], color: seat });
    gb.add(box(1.3, 0.05, 1.9), { pos: [0, 1.95, 0.1], color: w });
    for (const x of [-0.55, 0.55]) for (const z of [-0.6, 0.85]) gb.add(cyl(0.02, 0.02, 1.4, 4), { pos: [x, 0.6, z], color: dk });
    for (const x of [-0.58, 0.58]) for (const z of [-0.75, 0.75]) gb.add(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 10).rotateZ(Math.PI / 2), { pos: [x, 0.2, z], color: dk });
    gb.add(cyl(0.14, 0.14, 0.9, 8), { pos: [0.3, 0.7, 0.95], rot: [-0.3, 0, 0], color: col('#b02a2a') });
  },
  shelter(gb) {
    const wood = col('#6a4a30'), roof = col('#3a5a3a');
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) gb.add(box(0.16, 2.6, 0.16), { pos: [x, 1.3, z], color: wood });
    gb.add(new THREE.ConeGeometry(2.8, 1.2, 4).rotateY(Math.PI / 4), { pos: [0, 3.2, 0], color: roof });
    gb.add(box(3.4, 0.1, 3.4), { pos: [0, 0.05, 0], color: col('#a8a090') });
    gb.add(box(2.6, 0.06, 0.4), { pos: [0, 0.48, -1.2], color: wood });
  },
  bridge(gb) {
    const wood = col('#7a5636'), dk = col('#5a3e26');
    const n = 16, L = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5, z = t * L, y = 0.6 + (1 - 4 * t * t) * 0.7;
      gb.add(box(2.2, 0.08, L / n * 0.92), { pos: [0, y, z], rot: [-t * 1.2, 0, 0], color: i % 2 ? wood : dk });
      if (i % 3 === 0) for (const x of [-1.05, 1.05]) gb.add(box(0.08, 0.9, 0.08), { pos: [x, y + 0.45, z], color: dk });
    }
    for (const x of [-1.05, 1.05]) for (let i = 0; i < n - 1; i++) {
      const t0 = i / (n - 1) - 0.5, t1 = (i + 1) / (n - 1) - 0.5;
      const y0 = 1.5 + (1 - 4 * t0 * t0) * 0.7, y1 = 1.5 + (1 - 4 * t1 * t1) * 0.7;
      gb.add(box(0.07, 0.07, L / (n - 1) * 1.02), { pos: [x, (y0 + y1) / 2, (t0 + t1) / 2 * L], rot: [-Math.atan2(y1 - y0, L / (n - 1)), 0, 0], color: wood });
    }
  },
  fence(gb) {
    const wood = col('#8a6a48');
    for (const x of [-2, 0, 2]) gb.add(box(0.12, 1.1, 0.12), { pos: [x, 0.55, 0], color: wood, jitter: 0.02 });
    for (const y of [0.45, 0.85]) gb.add(box(4.1, 0.09, 0.07), { pos: [0, y, 0], rot: [0, 0, (y - 0.6) * 0.05], color: wood });
  },
  wall(gb, rnd) {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      const w = 0.4 + rnd() * 0.25;
      gb.add(box(w, 0.24, 0.65 - r * 0.06), { pos: [-2 + i * 0.47 + (r % 2) * 0.2, 0.12 + r * 0.24, 0], rot: [0, (rnd() - 0.5) * 0.2, 0], color: col(rnd() < 0.5 ? '#8c877c' : '#a09a8c'), jitter: 0.04, seed: r * 9 + i, jfreq: 3 });
    }
  },
  // decor (instanced with per-instance color)
  teemarker(gb) { gb.add(new THREE.SphereGeometry(0.11, 10, 8), { pos: [0, 0.1, 0], color: col('#ffffff') }); },
  plate(gb) { gb.add(cyl(0.18, 0.18, 0.025, 14), { color: col('#ffffff') }); },
  stake(gb) { gb.add(cyl(0.022, 0.022, 0.75, 5), { pos: [0, -0.05, 0], color: col('#ffffff') }); },
  rake(gb) {
    gb.add(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4).rotateZ(Math.PI / 2), { pos: [0, 0.03, 0], color: col('#d9d2bd') });
    gb.add(box(0.06, 0.04, 0.55), { pos: [0.8, 0.03, 0], color: col('#d0a020') });
  },
  lily(gb) {
    const s = new THREE.CircleGeometry(0.35, 10, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
    gb.add(s, { color: col('#3f7a32') });
  },
};

export const SPECIES_INFO = { // sway factors & variant counts
  oak: { sway: 0.02, v: 2 }, maple: { sway: 0.02, v: 2 }, birch: { sway: 0.03, v: 2 }, aspen: { sway: 0.035, v: 2 },
  pine: { sway: 0.015, v: 2 }, spruce: { sway: 0.012, v: 2 }, fir: { sway: 0.012, v: 2 }, willow: { sway: 0.03, v: 1 },
  cypress: { sway: 0.015, v: 1 }, monterey: { sway: 0.012, v: 2 }, palm: { sway: 0.03, v: 2 }, fanpalm: { sway: 0.02, v: 1 },
  saguaro: { sway: 0, v: 3 }, joshua: { sway: 0, v: 2 }, paloverde: { sway: 0.025, v: 2 }, bush: { sway: 0.03, v: 2 },
  hibiscus: { sway: 0.03, v: 1 }, fern: { sway: 0.06, v: 1 }, gorse: { sway: 0.02, v: 2 }, heather: { sway: 0.02, v: 1 },
  fescue: { sway: 0.15, v: 2 }, reeds: { sway: 0.1, v: 2 }, flowers: { sway: 0.15, v: 2 }, pricklypear: { sway: 0, v: 2 },
  barrel: { sway: 0, v: 1 }, ocotillo: { sway: 0.03, v: 2 }, creosote: { sway: 0.04, v: 2 }, boulder: { sway: 0, v: 3 },
  rocks: { sway: 0, v: 2 }, desertrock: { sway: 0, v: 2 },
};

const geoCache = new Map();
export function speciesGeometry(kind, variant = 0, opts = {}) {
  const key = `${kind}:${variant}:${opts.fall ? 1 : 0}:${opts.lod ? 1 : 0}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const fn = SPECIES[kind];
  if (!fn) return null;
  const gb = new GeoBuilder();
  const rnd = mulberry32(variant * 7919 + kind.length * 104729 + 3);
  // low-detail build for background trees: fewer, larger cards and simpler limbs
  Object.assign(LOD, opts.lod ? { on: true, density: 0.42, size: 1.45 } : { on: false, density: 1, size: 1 });
  try { fn(gb, rnd, { v: variant * 13 + 1, fall: !!opts.fall }); } finally { Object.assign(LOD, { on: false, density: 1, size: 1 }); }
  const g = gb.build();
  geoCache.set(key, g);
  return g;
}
export function hasSpecies(kind) { return !!SPECIES[kind]; }

// Grass tuft for ground scatter
export function tuftGeometry(variant = 0, height = 0.28) {
  const gb = new GeoBuilder();
  const rnd = mulberry32(variant + 77);
  // three crossed grass cards; color comes from the instance (sampled from the ground)
  grassCards(gb, 3, height, height * 1.6, new THREE.Color(0.7, 0.7, 0.7), new THREE.Color(1.15, 1.15, 1.1), rnd, height * 0.3);
  return gb.build();
}

// Golfer ---------------------------------------------------------------------------------
export function buildGolfer(colors) {
  const root = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const shirt = mat(colors.shirt), pants = mat(colors.pants), skin = mat(colors.skin), cap = mat(colors.cap);
  const shoe = mat('#f4f4f4'), glove = mat('#fafafa'), shaft = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.8, roughness: 0.3 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#2b2d31', metalness: 0.6, roughness: 0.35 });
  const capsule = (r, l, m) => { const me = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m); me.castShadow = true; return me; };
  // Golfer faces +X, target is -Z (left side toward target)
  const hips = new THREE.Group(); hips.position.set(0, 0.95, 0); root.add(hips);
  const pelvis = capsule(0.15, 0.16, pants); pelvis.rotation.x = Math.PI / 2; pelvis.scale.set(1, 1, 0.8); hips.add(pelvis);
  const legs = [];
  for (const z of [-0.13, 0.13]) {
    const thigh = new THREE.Group(); thigh.position.set(0, 0, z); hips.add(thigh);
    const t = capsule(0.075, 0.38, pants); t.position.y = -0.24; thigh.add(t);
    const knee = new THREE.Group(); knee.position.y = -0.46; thigh.add(knee);
    const c = capsule(0.062, 0.36, pants); c.position.y = -0.22; knee.add(c);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.11), shoe); s.position.set(0.06, -0.46, 0); s.castShadow = true; knee.add(s);
    thigh.rotation.z = -0.12; knee.rotation.z = 0.24;
    legs.push({ thigh, knee });
  }
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  const torso = new THREE.Group(); spine.add(torso);
  const chest = capsule(0.17, 0.32, shirt); chest.position.y = 0.3; chest.scale.set(0.85, 1, 1.15); torso.add(chest);
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin); head.position.y = 0.12; head.castShadow = true; neck.add(head);
  const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap); capMesh.position.y = 0.14; neck.add(capMesh);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 14, 1, false, -Math.PI / 2, Math.PI), cap); brim.position.set(0.07, 0.145, 0); brim.scale.set(1.3, 1, 1); neck.add(brim);
  const shoulderL = new THREE.Vector3(0.02, 0.5, -0.2), shoulderR = new THREE.Vector3(0.02, 0.5, 0.2);
  const armL = capsule(0.05, 0.5, shirt), armR = capsule(0.05, 0.5, shirt);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glove), handR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
  root.add(armL, armR, handL, handR);
  const club = new THREE.Group(); root.add(club);
  const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 1, 6).translate(0, -0.5, 0), shaft); club.add(shaftMesh);
  const clubHead = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.07), headMat); club.add(clubHead);
  shaftMesh.castShadow = clubHead.castShadow = true;

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const placeLimb = (mesh, a, b) => {
    tmp.subVectors(b, a); const len = tmp.length();
    mesh.position.copy(a).addScaledVector(tmp, 0.5);
    mesh.quaternion.setFromUnitVectors(up, tmp.normalize());
    mesh.scale.set(1, Math.max(0.3, len / 0.6), 1);
  };
  let clubLen = 1.1;
  const state = { club: 'DR' };
  function setClub(id) {
    state.club = id;
    clubLen = id === 'DR' ? 1.14 : id.endsWith('W') ? 1.08 : id === 'PT' ? 0.86 : id === 'LW' || id === 'SW' ? 0.9 : 0.98 - (parseInt(id) || 7) * 0.01;
    shaftMesh.scale.y = clubLen;
    clubHead.position.set(0.03, -clubLen, 0);
    clubHead.scale.set(id === 'DR' ? 1.2 : 0.9, id === 'DR' ? 1.6 : 1, id === 'DR' ? 1.6 : 0.6);
  }
  setClub('DR');
  // pose: swing angle a (0 = address, + = backswing, - = follow through), putt flag
  const ballPos = new THREE.Vector3();
  function pose(a, opts = {}) {
    const putt = state.club === 'PT';
    const stance = putt ? 0.82 : 0.95;
    const reach = putt ? 0.55 : clubLen * 0.55 + 0.38;
    void reach;
    const lean = putt ? 0.55 : 0.42;
    hips.position.y = stance;
    spine.rotation.z = -lean;
    const turn = -(putt ? a * 0.15 : clamp(a, -2.6, 3) * 0.32);
    spine.rotation.y = turn; hips.rotation.y = turn * 0.4;
    neck.rotation.y = -turn * 0.8; neck.rotation.z = lean * 0.5 + (a < -1 ? -0.4 : 0);
    // arm pivot (between shoulders) in root space
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const sL = shoulderL.clone().applyMatrix4(torso.matrixWorld).applyMatrix4(inv);
    const sR = shoulderR.clone().applyMatrix4(torso.matrixWorld).applyMatrix4(inv);
    const pivot = sL.clone().add(sR).multiplyScalar(0.5);
    const armLen = putt ? 0.58 : 0.6;
    // swing plane: contains target line (-Z) and the line from shoulders to ball
    const L = armLen + clubLen, py = pivot.y - 0.03;
    const toBall = new THREE.Vector3(Math.sqrt(Math.max(0.05, L * L - py * py)), -py, 0).normalize();
    const axis = new THREE.Vector3(0, 0, -1).cross(toBall).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, a);
    const armDir = toBall.clone().applyQuaternion(q);
    const hands = pivot.clone().addScaledVector(armDir, armLen);
    const cock = putt ? 0 : (a > 0 ? Math.min(1.5, a * 0.6) : Math.max(-1.5, a * 0.6));
    const q2 = new THREE.Quaternion().setFromAxisAngle(axis, cock);
    const clubDir = armDir.clone().applyQuaternion(q2);
    placeLimb(armL, sL, hands); placeLimb(armR, sR, hands);
    handL.position.copy(hands); handR.position.copy(hands).addScaledVector(clubDir, 0.08);
    club.position.copy(hands);
    club.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), clubDir);
    ballPos.copy(hands).addScaledVector(clubDir, clubLen);
    void opts; void tmp2;
  }
  pose(0);
  // offset so the club head rests at the local origin (ball position)
  const base = new THREE.Group(); base.add(root);
  function fitToBall() { root.position.set(0, 0, 0); pose(0); root.position.set(-ballPos.x, -Math.max(0, ballPos.y) * 0, -ballPos.z); }
  fitToBall();
  base.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: base, pose, setClub: (id) => { setClub(id); fitToBall(); }, legs };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
