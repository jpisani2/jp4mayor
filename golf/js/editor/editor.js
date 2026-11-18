// Hole designer: top-down touch editor with quick stamps and deep per-object tuning.
import { SHAPES, SHAPE_ORDER, CLIMATES, OBJ, OBJ_CATS, TIMES, WIND_MODES, TEE_SETS, SAND_COLORS, WATER_COLORS, PATH_MATERIALS } from '../core/data.js';
import {
  shapePoly, makeShape, makeFeature, makeObject, FEATURES, holeTees, holePar, suggestPar, generateHole, teeSpot, routeLength, normalizeHole,
} from '../core/hole.js';
import { compileHole } from '../core/compile.js';
import { paintHole, tone } from '../core/painter.js';
import { pointInPoly, distToPolyline, simplify, polyCentroid, polyArea, clamp, M2YD, uid, deepClone, debounce, distToSeg, mulberry32 } from '../core/util.js';
import { db, getSettings } from '../core/store.js';
import { sfx } from '../core/audio.js';
import { haptic } from '../core/haptics.js';
import { h, icon, btn, slider, segmented, toggle, select, toast, confirmDialog, promptDialog, modal } from '../ui/ui.js';

const AREA_TYPES = Object.keys(SHAPES).filter((k) => SHAPES[k].kind === 'area');
const TREE_COLORS = {
  oak: '#3f6b2a', maple: '#477d2e', birch: '#7aa040', aspen: '#86ad46', pine: '#2f5a2a', spruce: '#22452a', fir: '#2e5732', willow: '#7a9a3a',
  cypress: '#2f4f2a', monterey: '#35552c', palm: '#4d8a2e', fanpalm: '#4f8040', saguaro: '#5d7d3c', joshua: '#5d6e3a', paloverde: '#9aaf55',
  bush: '#3f6e2c', hibiscus: '#d8303a', fern: '#4a8a32', gorse: '#c8b030', heather: '#8a5a8e', fescue: '#c4b06a', reeds: '#5a7a3a',
  flowers: '#e8423f', pricklypear: '#6e8f45', barrel: '#5f7f3a', ocotillo: '#8a5a3a', creosote: '#6b7a3a', boulder: '#8c8a84', rocks: '#9a958c', desertrock: '#b5703f',
};
const FALL = { oak: '#b8561e', maple: '#d4411d', birch: '#e2b72e', aspen: '#f0c232' };

export class Editor {
  constructor({ hole, onExit, onPlay }) {
    this.hole = normalizeHole(hole);
    this.onExit = onExit; this.onPlay = onPlay;
    this.settings = getSettings();
    this.undoStack = []; this.redoStack = [];
    this.tab = 'shapes';
    this.tool = { mode: 'select' };
    this.sel = null;
    this.brush = { mode: 'single', size: 12, density: 0.5, kind: null };
    this.showContours = true; this.showYardage = true;
    this.pointers = new Map();
    this.pending = null;
    this.dirty = true;
    this.buildDom();
    this.fit();
    this.recompute();
    this.loop();
    this.save = debounce(() => this.persist(), 500);
    this.recomputeDeb = debounce(() => this.recompute(), 250);
  }

  // ----------------------------------------------------------------- DOM
  buildDom() {
    const root = this.root = h('div', { class: 'editor' });
    this.canvas = h('canvas', { class: 'ed-canvas' });
    this.ctx = this.canvas.getContext('2d');
    const top = h('div', { class: 'ed-top' },
      h('button', { class: 'hbtn', onclick: () => this.exit() }, icon('back')),
      h('button', { class: 'ed-title', onclick: () => this.openHoleSheet() }, h('b', { class: 'ed-name' }), h('span', { class: 'ed-meta' })),
      h('button', { class: 'hbtn ed-undo', onclick: () => this.undo() }, icon('undo')),
      h('button', { class: 'hbtn ed-redo', onclick: () => this.redo() }, icon('redo')),
      h('button', { class: 'btn primary ed-play', onclick: () => this.play() }, icon('play'), h('span', {}, 'Play')));
    this.hint = h('div', { class: 'ed-hint' });
    this.doneBar = h('div', { class: 'ed-donebar' },
      btn('Cancel', () => { this.pending = null; this.doneBar.classList.remove('show'); this.dirty = true; }, 'ghost'),
      btn('Finish line', () => this.finishPendingLine(), 'primary'));
    this.floatR = h('div', { class: 'ed-float' },
      h('button', { class: 'hbtn on', title: 'Contours', onclick: (e) => { this.showContours = !this.showContours; e.currentTarget.classList.toggle('on', this.showContours); this.dirty = true; } }, icon('layers')),
      h('button', { class: 'hbtn on', title: 'Yardages', onclick: (e) => { this.showYardage = !this.showYardage; e.currentTarget.classList.toggle('on', this.showYardage); this.dirty = true; } }, icon('target')),
      h('button', { class: 'hbtn', title: 'Fit', onclick: () => { this.fit(); this.dirty = true; } }, icon('fit')));
    this.tray = h('div', { class: 'ed-tray' });
    this.brushBar = h('div', { class: 'ed-brushbar' });
    const tabs = [['select', 'Select', 'select'], ['shapes', 'Shapes', 'shape'], ['terrain', 'Terrain', 'mountain'], ['plants', 'Plants', 'tree'], ['objects', 'Objects', 'bench'], ['hole', 'Hole', 'flag']];
    this.dock = h('div', { class: 'ed-dock' }, tabs.map(([k, l, ic]) => h('button', { class: `dk dk-${k}`, onclick: () => this.setTab(k) }, icon(ic), h('span', {}, l))));
    this.sheet = h('div', { class: 'ed-sheet' });
    root.append(this.canvas, top, this.hint, this.floatR, this.doneBar, this.brushBar, this.tray, this.sheet, this.dock);
    document.getElementById('app').append(root);
    this.bindPointer();
    window.addEventListener('resize', this.onResize = () => { this.resize(); this.dirty = true; });
    this.resize();
    this.setTab('shapes');
    this.updateTop();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width || innerWidth; this.H = r.height || innerHeight;
    this.dpr = Math.min(2.5, devicePixelRatio || 1);
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
  }
  updateTop() {
    const u = this.settings.units;
    const tees = holeTees(this.hole);
    const len = tees.length ? tees[0].len : 0;
    this.root.querySelector('.ed-name').textContent = this.hole.name;
    this.root.querySelector('.ed-meta').textContent = `Par ${holePar(this.hole)} · ${u === 'm' ? Math.round(len) + ' m' : Math.round(len * M2YD) + ' yds'} · ${CLIMATES[this.hole.climate].name}${this.hole.status === 'saved' ? ' · ★' : ''}`;
    this.root.querySelector('.ed-undo').disabled = !this.undoStack.length;
    this.root.querySelector('.ed-redo').disabled = !this.redoStack.length;
  }
  setHint(t) { this.hint.textContent = t || ''; this.hint.classList.toggle('show', !!t); }

  setTab(k) {
    sfx.tick();
    this.tab = k;
    this.dock.querySelectorAll('.dk').forEach((b) => b.classList.toggle('on', b.classList.contains(`dk-${k}`)));
    this.tray.innerHTML = ''; this.brushBar.innerHTML = ''; this.brushBar.classList.remove('show');
    this.pending = null; this.doneBar.classList.remove('show');
    if (k === 'select') { this.tool = { mode: 'select' }; this.tray.classList.remove('show'); this.setHint('Tap anything to select it · drag to move · pinch to zoom'); return; }
    if (k === 'hole') { this.tray.classList.remove('show'); this.tool = { mode: 'select' }; this.openHoleSheet(); return; }
    this.tray.classList.add('show');
    const items = [];
    if (k === 'shapes') {
      for (const t of ['fairway', 'green', 'tee', 'bunker', 'fbunker', 'pot', 'water', 'creek', 'path', 'waste', 'rough', 'deep', 'native', 'mulch', 'trail', 'oob']) items.push({ key: t, label: SHAPES[t].label, kind: 'shape' });
      items.push({ key: 'pin', label: 'Move Pin', kind: 'pin' });
      items.push({ key: 'route', label: 'Line of Play', kind: 'route' });
      this.setHint('Pick a piece · tap the map to stamp it, or drag to draw your own outline');
    } else if (k === 'terrain') {
      for (const f of Object.keys(FEATURES)) items.push({ key: f, label: FEATURES[f].label, kind: 'feature' });
      items.push({ key: 'land', label: 'Land Shape…', kind: 'land' });
      this.setHint('Tap to raise or lower ground · select a feature to stretch, rotate and tune its height');
    } else if (k === 'plants') {
      const cl = this.hole.climate;
      items.push({ key: 'mix', label: `${CLIMATES[cl].name} Mix`, kind: 'object' });
      const native = Object.keys(OBJ).filter((o) => (OBJ[o].cat === 'tree' || OBJ[o].cat === 'shrub') && OBJ[o].climates.includes(cl));
      const other = Object.keys(OBJ).filter((o) => (OBJ[o].cat === 'tree' || OBJ[o].cat === 'shrub') && !OBJ[o].climates.includes(cl));
      for (const o of native) items.push({ key: o, label: OBJ[o].label, kind: 'object' });
      items.push({ sep: 'Other climates' });
      for (const o of other) items.push({ key: o, label: OBJ[o].label, kind: 'object' });
      this.buildBrushBar();
      this.setHint('Tap to plant one · switch to Brush and drag to paint a whole stand of trees');
    } else if (k === 'objects') {
      for (const o of Object.keys(OBJ).filter((o) => OBJ[o].cat === 'rock' || OBJ[o].cat === 'amenity')) items.push({ key: o, label: OBJ[o].label, kind: 'object' });
      this.buildBrushBar();
      this.setHint('Tap to place rocks, benches, carts, bridges, walls…');
    }
    for (const it of items) {
      if (it.sep) { this.tray.append(h('div', { class: 'tr-sep' }, it.sep)); continue; }
      const b = h('button', { class: 'tr-item', onclick: () => this.pickItem(it, b) }, trayIcon(it, this.hole), h('span', {}, it.label));
      this.tray.append(b);
    }
    this.tool = { mode: 'select' };
  }
  buildBrushBar() {
    this.brushBar.innerHTML = '';
    this.brushBar.classList.add('show');
    this.brushBar.append(
      segmented([['single', 'Single'], ['brush', 'Brush'], ['erase', 'Eraser']], this.brush.mode, (v) => {
        this.brush.mode = v;
        if (v === 'erase') { this.tool = { mode: 'erase' }; this.tray.querySelectorAll('.tr-item').forEach((x) => x.classList.remove('on')); this.setHint('Drag over trees and objects to remove them'); }
        else if (this.tool.mode === 'erase') this.tool = { mode: 'select' };
      }),
      slider({ label: 'Size', min: 4, max: 40, value: this.brush.size, unit: 'm', onInput: (v) => { this.brush.size = v; } }),
      slider({ label: 'Density', min: 0.1, max: 1, step: 0.05, value: this.brush.density, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { this.brush.density = v; } }));
  }
  pickItem(it, el) {
    sfx.tick(); haptic('light');
    this.tray.querySelectorAll('.tr-item').forEach((x) => x.classList.remove('on'));
    if (it.kind === 'land') { this.openHoleSheet('terrain'); return; }
    el.classList.add('on');
    this.select(null);
    if (it.kind === 'shape') {
      this.tool = { mode: 'place', what: 'shape', key: it.key };
      this.setHint(SHAPES[it.key].kind === 'line' ? `${SHAPES[it.key].label}: drag to draw, or tap points then Finish` : `${SHAPES[it.key].label}: tap to stamp · drag to draw a custom outline`);
    } else if (it.kind === 'feature') { this.tool = { mode: 'place', what: 'feature', key: it.key }; this.setHint(`${FEATURES[it.key].label}: tap where it should go`); }
    else if (it.kind === 'object') {
      if (this.brush.mode === 'erase') this.brush.mode = 'single', this.buildBrushBar();
      this.tool = { mode: 'place', what: 'object', key: it.key };
      this.setHint(this.brush.mode === 'brush' ? 'Drag to paint' : 'Tap to place · keep tapping to place more');
    } else if (it.kind === 'pin') { this.tool = { mode: 'pin' }; this.setHint('Tap the green to set the hole location'); }
    else if (it.kind === 'route') { this.tool = { mode: 'route' }; this.setHint('Tap to add dogleg aim points along the line of play · drag points to adjust'); this.sel = { kind: 'route' }; }
    this.dirty = true;
  }

  // ----------------------------------------------------------------- view transform
  fit() {
    const hole = this.hole;
    const pts = hole.shapes.flatMap((s) => s.pts);
    pts.push([hole.pin.x, hole.pin.y], [0, 0]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    x0 -= 30; x1 += 30; y0 -= 30; y1 += 30;
    const topPad = 70, botPad = 190;
    const sc = Math.min(this.W / (x1 - x0), (this.H - topPad - botPad) / (y1 - y0));
    this.scale = clamp(sc, 0.3, 40);
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2 - ((botPad - topPad) / 2) / this.scale;
  }
  w2s(x, y) { return [(x - this.cx) * this.scale + this.W / 2, (this.cy - y) * this.scale + this.H / 2]; }
  s2w(sx, sy) { return [(sx - this.W / 2) / this.scale + this.cx, this.cy - (sy - this.H / 2) / this.scale]; }

  // ----------------------------------------------------------------- compute overlays
  recompute() {
    const hole = this.hole;
    const world = compileHole(hole, { heightsOnly: true, maxVerts: 45000, margin: 30 });
    this.world = world;
    const { hw, hh, hr, heights } = world;
    const c = document.createElement('canvas'); c.width = hw; c.height = hh;
    const g = c.getContext('2d'), img = g.createImageData(hw, hh);
    const L = [-0.5, 0.55, 0.67];
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < heights.length; i++) { mn = Math.min(mn, heights[i]); mx = Math.max(mx, heights[i]); }
    for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
      const k = j * hw + i;
      const dx = (heights[j * hw + Math.min(hw - 1, i + 1)] - heights[j * hw + Math.max(0, i - 1)]) / (2 * hr);
      const dy = (heights[Math.min(hh - 1, j + 1) * hw + i] - heights[Math.max(0, j - 1) * hw + i]) / (2 * hr);
      const l = Math.hypot(dx, dy, 1);
      const sh = (-dx * L[0] - dy * L[1] + L[2]) / l - L[2];
      const v = clamp(128 + sh * 260, 0, 255);
      const row = hh - 1 - j; // canvas row 0 = top = max y
      const p = (row * hw + i) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.shadeCanvas = c;
    // contour segments
    const range = mx - mn;
    const step = range < 5 ? 0.5 : range < 25 ? 1 : 2;
    this.contourStep = step;
    const segs = [], major = [];
    for (let j = 0; j < hh - 1; j++) for (let i = 0; i < hw - 1; i++) {
      const a = heights[j * hw + i], b = heights[j * hw + i + 1], cc = heights[(j + 1) * hw + i + 1], d = heights[(j + 1) * hw + i];
      const lo = Math.min(a, b, cc, d), hi = Math.max(a, b, cc, d);
      for (let lv = Math.ceil(lo / step) * step; lv < hi; lv += step) {
        const pts = [];
        const edge = (h0, h1, x0, y0, x1, y1) => { if ((h0 < lv) !== (h1 < lv)) { const t = (lv - h0) / (h1 - h0); pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); } };
        const X = world.x0 + i * hr, Y = world.y0 + j * hr;
        edge(a, b, X, Y, X + hr, Y); edge(b, cc, X + hr, Y, X + hr, Y + hr); edge(cc, d, X + hr, Y + hr, X, Y + hr); edge(d, a, X, Y + hr, X, Y);
        if (pts.length >= 4) (Math.abs(lv / (step * 5) - Math.round(lv / (step * 5))) < 1e-6 ? major : segs).push(pts[0], pts[1], pts[2], pts[3]);
      }
    }
    this.contours = { segs, major };
    this.dirty = true;
  }

  // ----------------------------------------------------------------- render
  loop() {
    if (this.dead) return;
    requestAnimationFrame(() => this.loop());
    if (!this.dirty) return;
    this.dirty = false;
    this.render();
  }
  render() {
    const ctx = this.ctx, dpr = this.dpr, W = this.W, H = this.H, hole = this.hole;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1a12'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale * dpr;
    const ox = this.cx - W / 2 / this.scale, oy = this.cy + H / 2 / this.scale;
    const M = 30;
    const dom = { x0: -hole.width / 2 - M, x1: hole.width / 2 + M, y0: -45 - M, y1: hole.length + M };
    const vis = { x0: Math.max(dom.x0, ox), x1: Math.min(dom.x1, ox + W / this.scale), y0: Math.max(dom.y0, oy - H / this.scale), y1: Math.min(dom.y1, oy) };
    if (vis.x1 > vis.x0 && vis.y1 > vis.y0) paintHole(ctx, hole, { scale: s, ox, oy }, { mode: 'editor', bounds: vis });
    // world-space overlays
    ctx.save();
    ctx.setTransform(s, 0, 0, -s, -ox * s, oy * s);
    if (this.shadeCanvas && this.world) {
      const wd = this.world;
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.75;
      ctx.imageSmoothingEnabled = true;
      ctx.save(); ctx.scale(1, -1);
      ctx.drawImage(this.shadeCanvas, wd.x0 - wd.hr / 2, -(wd.y1 + wd.hr / 2), wd.x1 - wd.x0 + wd.hr, wd.y1 - wd.y0 + wd.hr);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (this.showContours && this.contours) {
      const px = 1 / s;
      ctx.lineWidth = px * 1 * dpr; ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      drawSegs(ctx, this.contours.segs);
      ctx.lineWidth = px * 1.6 * dpr; ctx.strokeStyle = 'rgba(255,255,255,0.38)';
      drawSegs(ctx, this.contours.major);
    }
    // domain outline / OOB
    ctx.lineWidth = 2 / s * dpr; ctx.setLineDash([6 / s * dpr, 5 / s * dpr]); ctx.strokeStyle = hole.decor.oobEdge ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)';
    ctx.strokeRect(-hole.width / 2, -45, hole.width, hole.length + 45); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(5,15,10,0.45)';
    ctx.fillRect(dom.x0, dom.y0, M, dom.y1 - dom.y0); ctx.fillRect(dom.x1 - M, dom.y0, M, dom.y1 - dom.y0);
    ctx.fillRect(dom.x0 + M, dom.y0, dom.x1 - dom.x0 - 2 * M, M); ctx.fillRect(dom.x0 + M, dom.y1 - M, dom.x1 - dom.x0 - 2 * M, M);
    // terrain features
    for (const f of hole.features) this.drawFeature(ctx, f, s);
    // objects
    const objs = [...hole.objects].sort((a, b) => (OBJ[a.kind].cat === 'tree') - (OBJ[b.kind].cat === 'tree'));
    for (const o of objs) this.drawObject(ctx, o, s);
    ctx.restore();
    // screen-space overlays
    this.drawRoute(ctx);
    this.drawTees(ctx);
    this.drawPin(ctx);
    this.drawSelection(ctx);
    this.drawPending(ctx);
  }
  drawFeature(ctx, f, s) {
    const active = this.tab === 'terrain' || this.sel?.id === f.id;
    if (!active) return;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.rot || 0);
    ctx.beginPath(); ctx.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
    const up = f.h >= 0;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(f.rx, f.ry));
    g.addColorStop(0, up ? 'rgba(255,200,120,0.32)' : 'rgba(90,170,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([5 / s * this.dpr, 4 / s * this.dpr]); ctx.lineWidth = 1.5 / s * this.dpr;
    ctx.strokeStyle = up ? 'rgba(255,210,140,0.9)' : 'rgba(140,200,255,0.9)'; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    const [sx, sy] = this.w2s(f.x, f.y);
    const c = this.ctx;
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.font = '700 11px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    const t = `${up ? '+' : ''}${f.h.toFixed(1)}m`;
    c.strokeText(t, sx, sy + 4); c.fillText(t, sx, sy + 4);
    c.restore();
  }
  drawObject(ctx, o, s) {
    const def = OBJ[o.kind]; if (!def) return;
    const sc = o.s || 1;
    const minR = 3.5 / s * this.dpr;
    const fall = CLIMATES[this.hole.climate].fall;
    const colr = (fall && FALL[o.kind]) || TREE_COLORS[o.kind] || '#777';
    if (def.cat === 'tree' || def.cat === 'shrub') {
      const r = Math.max(minR, (def.col.canopy ? def.col.canopy[1] : def.col.solid ? def.col.solid[0] * 1.4 : 1) * sc);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.arc(o.x + r * 0.25, o.y - r * 0.3, r, 0, Math.PI * 2); ctx.fill();
      if (o.kind === 'saguaro' || o.kind === 'barrel' || o.kind === 'pricklypear') {
        ctx.fillStyle = colr; ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = tone(colr, -0.35); ctx.lineWidth = r * 0.18;
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + (o.r || 0); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(a) * r * 1.4, o.y + Math.sin(a) * r * 1.4); ctx.stroke(); }
      } else if (o.kind === 'palm' || o.kind === 'fanpalm' || o.kind === 'fern' || o.kind === 'ocotillo') {
        ctx.strokeStyle = colr; ctx.lineWidth = Math.max(r * 0.22, minR * 0.4); ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + (o.r || 0); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.quadraticCurveTo(o.x + Math.cos(a + 0.3) * r * 0.6, o.y + Math.sin(a + 0.3) * r * 0.6, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r); ctx.stroke(); }
      } else {
        const g = ctx.createRadialGradient(o.x - r * 0.3, o.y + r * 0.3, r * 0.1, o.x, o.y, r);
        g.addColorStop(0, tone(colr, 0.3)); g.addColorStop(1, tone(colr, -0.25));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
        if (def.cat === 'tree' && r > minR * 1.5) {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = r * 0.06;
          ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.98, 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else if (def.cat === 'rock') {
      const r = Math.max(minR, (def.col.solid ? def.col.solid[0] : 1) * sc);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(o.x + r * 0.2, o.y - r * 0.25, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = TREE_COLORS[o.kind] || '#999';
      ctx.beginPath();
      const rnd = mulberry32(o.seed || 1);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.75 + rnd() * 0.3); ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else {
      const b = def.col.box || [0.5, 1, 0.5];
      const bx = Math.max(minR, (o.kind === 'bridge' ? 1.2 : b[0]) * sc), by = Math.max(minR * 0.6, (o.kind === 'bridge' ? 4 : b[2]) * sc);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(-(o.r || 0));
      ctx.fillStyle = { bench: '#8a5a35', cart: '#f2f2f2', shelter: '#3a5a3a', bridge: '#7a5636', fence: '#8a6a48', wall: '#9a958c', sign: '#1f4d2f', washer: '#2f5f3a', bin: '#2f4a33', post: '#2a62d8' }[o.kind] || '#ccc';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1 / s * this.dpr;
      ctx.fillRect(-bx, -by, bx * 2, by * 2); ctx.strokeRect(-bx, -by, bx * 2, by * 2);
      ctx.restore();
    }
  }
  drawRoute(ctx) {
    const hole = this.hole, d = this.dpr;
    const tees = holeTees(hole);
    if (!tees.length) return;
    const pts = [tees[0].spot, ...hole.route, [hole.pin.x, hole.pin.y]];
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
    const show = this.showYardage || this.tool.mode === 'route' || this.sel?.kind === 'route';
    if (show) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.setLineDash([7, 6]);
      ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = this.w2s(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
      const u = this.settings.units;
      ctx.font = '700 11px system-ui'; ctx.textAlign = 'center';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], m = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const [x, y] = this.w2s((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const t = u === 'm' ? `${Math.round(m)}m` : `${Math.round(m * M2YD)}y`;
        pill(ctx, x + 18, y, t);
      }
      for (const p of hole.route) { const [x, y] = this.w2s(p[0], p[1]); ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    // yardage arcs from green center
    if (this.showYardage) {
      const [gx, gy] = this.w2s(hole.pin.x, hole.pin.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      for (const yd of [100, 150, 200, 250]) {
        const r = (yd / M2YD) * this.scale;
        ctx.beginPath(); ctx.arc(gx, gy, r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 10px system-ui';
        ctx.fillText(this.settings.units === 'm' ? `${Math.round(yd / M2YD)}` : `${yd}`, gx, gy + r + 11);
      }
    }
    ctx.restore();
  }
  drawTees(ctx) {
    const d = this.dpr;
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
    for (const t of this.hole.shapes.filter((s) => s.type === 'tee')) {
      const sp = teeSpot(t);
      const [x, y] = this.w2s(sp[0], sp[1]);
      ctx.fillStyle = TEE_SETS[t.props.set]?.color || '#fff'; ctx.strokeStyle = t.props.set === 'black' ? '#fff' : '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x - 6, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 6, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  drawPin(ctx) {
    const d = this.dpr, p = this.hole.pin;
    const [x, y] = this.w2s(p.x, p.y);
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 28); ctx.stroke();
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x + 17, y - 23); ctx.lineTo(x, y - 17); ctx.fill();
    ctx.restore();
  }
  drawSelection(ctx) {
    const sel = this.sel; if (!sel) return;
    const d = this.dpr;
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
    if (sel.kind === 'shape') {
      const sh = this.findShape(sel.id); if (!sh) { ctx.restore(); return; }
      const poly = shapePoly(sh), line = SHAPES[sh.type].kind === 'line';
      ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
      ctx.beginPath(); poly.forEach((p, i) => { const [x, y] = this.w2s(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (!line) ctx.closePath(); ctx.stroke();
      const pts = sh.pts, n = pts.length;
      // midpoints (insert handles)
      for (let i = 0; i < (line ? n - 1 : n); i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const [x, y] = this.w2s((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x + 2.5, y); ctx.moveTo(x, y - 2.5); ctx.lineTo(x, y + 2.5); ctx.stroke();
      }
      pts.forEach((p, i) => {
        const [x, y] = this.w2s(p[0], p[1]);
        ctx.fillStyle = sel.point === i ? '#ff5a4a' : '#ffd34a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, sel.point === i ? 9 : 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      if (sh.type === 'tee') {
        const sp = teeSpot(sh); const [x, y] = this.w2s(sp[0], sp[1]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (sel.kind === 'feature') {
      const f = this.hole.features.find((x) => x.id === sel.id); if (!f) { ctx.restore(); return; }
      for (const hd of this.featureHandles(f)) {
        const [x, y] = this.w2s(hd.x, hd.y);
        ctx.fillStyle = hd.k === 'rot' ? '#7cd4ff' : '#ffd34a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      const [x, y] = this.w2s(f.x, f.y);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
    } else if (sel.kind === 'object') {
      const o = this.hole.objects.find((x) => x.id === sel.id); if (!o) { ctx.restore(); return; }
      const [x, y] = this.w2s(o.x, o.y);
      const r = Math.max(14, objRadius(o) * this.scale + 4);
      ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }
  drawPending(ctx) {
    const p = this.pending; if (!p) return;
    const d = this.dpr;
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
    if (p.kind === 'lasso' || p.kind === 'tapline') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash(p.kind === 'tapline' ? [6, 5] : []);
      ctx.beginPath(); p.pts.forEach((q, i) => { const [x, y] = this.w2s(q[0], q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (p.kind === 'lasso' && p.area) ctx.closePath();
      ctx.stroke(); ctx.setLineDash([]);
      if (p.kind === 'tapline') for (const q of p.pts) { const [x, y] = this.w2s(q[0], q[1]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (p.kind === 'brush' || p.kind === 'erase') {
      const [x, y] = this.w2s(p.at[0], p.at[1]);
      ctx.strokeStyle = p.kind === 'erase' ? '#ff6a5a' : '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(x, y, this.brush.size * this.scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------- hit testing
  findShape(id) { return this.hole.shapes.find((s) => s.id === id); }
  featureHandles(f) {
    const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
    const rotD = f.ry + 28 / this.scale;
    return [
      { k: 'rx', x: f.x + c * f.rx, y: f.y + s * f.rx },
      { k: 'ry', x: f.x - s * f.ry, y: f.y + c * f.ry },
      { k: 'rot', x: f.x + s * rotD, y: f.y - c * rotD },
    ];
  }
  hitTest(sx, sy) {
    const [wx, wy] = this.s2w(sx, sy);
    const near = (x, y, r) => { const [a, b] = this.w2s(x, y); return Math.hypot(a - sx, b - sy) < r; };
    const sel = this.sel;
    if (sel?.kind === 'shape') {
      const sh = this.findShape(sel.id);
      if (sh) {
        for (let i = sh.pts.length - 1; i >= 0; i--) if (near(sh.pts[i][0], sh.pts[i][1], 20)) return { kind: 'point', shape: sh, i };
        const line = SHAPES[sh.type].kind === 'line', n = sh.pts.length;
        for (let i = 0; i < (line ? n - 1 : n); i++) {
          const a = sh.pts[i], b = sh.pts[(i + 1) % n];
          if (near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 16)) return { kind: 'mid', shape: sh, i };
        }
        if (sh.type === 'tee') { const sp = teeSpot(sh); if (near(sp[0], sp[1], 16)) return { kind: 'teespot', shape: sh }; }
      }
    }
    if (sel?.kind === 'feature') {
      const f = this.hole.features.find((x) => x.id === sel.id);
      if (f) for (const hd of this.featureHandles(f)) if (near(hd.x, hd.y, 20)) return { kind: 'fhandle', f, k: hd.k };
    }
    if (this.tool.mode === 'route' || sel?.kind === 'route') {
      for (let i = 0; i < this.hole.route.length; i++) if (near(this.hole.route[i][0], this.hole.route[i][1], 20)) return { kind: 'routept', i };
    }
    if (near(this.hole.pin.x, this.hole.pin.y - 0, 18) || (() => { const [x, y] = this.w2s(this.hole.pin.x, this.hole.pin.y); return sx > x - 4 && sx < x + 20 && sy > y - 32 && sy < y - 14; })()) return { kind: 'pin' };
    // objects
    for (let i = this.hole.objects.length - 1; i >= 0; i--) {
      const o = this.hole.objects[i];
      const r = Math.max(12, objRadius(o) * this.scale);
      if (near(o.x, o.y, r)) return { kind: 'object', o };
    }
    const featHit = () => {
      for (let i = this.hole.features.length - 1; i >= 0; i--) {
        const f = this.hole.features[i];
        const dx = wx - f.x, dy = wy - f.y, c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
        const lx = dx * c + dy * s, ly = -dx * s + dy * c;
        if ((lx / f.rx) ** 2 + (ly / f.ry) ** 2 < 1) return { kind: 'feature', f };
      }
      return null;
    };
    if (this.tab === 'terrain') { const fh = featHit(); if (fh) return fh; }
    const order = [...this.hole.shapes].sort((a, b) => SHAPE_ORDER.indexOf(b.type) - SHAPE_ORDER.indexOf(a.type));
    for (const sh of order) {
      const poly = shapePoly(sh);
      if (SHAPES[sh.type].kind === 'line') { if (distToPolyline(wx, wy, poly) < (sh.props.width || 2) / 2 + 10 / this.scale) return { kind: 'shape', shape: sh }; }
      else if (pointInPoly(wx, wy, poly)) return { kind: 'shape', shape: sh };
    }
    if (this.tab !== 'terrain') { const fh = featHit(); if (fh && this.sel?.kind === 'feature') return fh; }
    return null;
  }

  // ----------------------------------------------------------------- pointer handling
  bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.pDown(e));
    c.addEventListener('pointermove', (e) => this.pMove(e));
    c.addEventListener('pointerup', (e) => this.pUp(e));
    c.addEventListener('pointercancel', (e) => this.pUp(e, true));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(e.offsetX, e.offsetY, f);
    }, { passive: false });
  }
  zoomAt(sx, sy, f) {
    const [wx, wy] = this.s2w(sx, sy);
    this.scale = clamp(this.scale * f, 0.25, 60);
    this.cx = wx - (sx - this.W / 2) / this.scale;
    this.cy = wy + (sy - this.H / 2) / this.scale;
    this.dirty = true;
  }
  pos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  pDown(e) {
    (() => { try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ } })();
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // start pinch; abandon single-finger gesture
      if (this.drag?.committed) this.commit();
      this.drag = null;
      if (this.pending?.kind === 'lasso' || this.pending?.kind === 'brush' || this.pending?.kind === 'erase') this.pending = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: this.scale, m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w0: this.s2w((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      return;
    }
    if (this.pointers.size > 2) return;
    const [wx, wy] = this.s2w(...p);
    this.drag = { start: p, last: p, w0: [wx, wy], moved: false, t: performance.now() };
    const mode = this.tool.mode;
    if (mode === 'select' || mode === 'route' || mode === 'pin') {
      const hit = this.hitTest(...p);
      this.drag.hit = hit;
      if (mode === 'pin' && !hit) this.drag.hit = { kind: 'pinplace' };
    } else if (mode === 'place' && this.tool.what === 'object' && this.brush.mode === 'brush') {
      this.pending = { kind: 'brush', at: [wx, wy], lastPaint: null };
      this.pushUndo(); this.drag.committed = true;
      this.paintAt(wx, wy);
    } else if (mode === 'erase') {
      this.pending = { kind: 'erase', at: [wx, wy] };
      this.pushUndo(); this.drag.committed = true;
      this.eraseAt(wx, wy);
    }
    this.dirty = true;
  }
  pMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.scale = clamp(this.pinch.s0 * d / Math.max(10, this.pinch.d0), 0.25, 60);
      this.cx = this.pinch.w0[0] - (m[0] - this.W / 2) / this.scale;
      this.cy = this.pinch.w0[1] + (m[1] - this.H / 2) / this.scale;
      this.dirty = true;
      return;
    }
    const dr = this.drag; if (!dr) return;
    if (!dr.moved && Math.hypot(p[0] - dr.start[0], p[1] - dr.start[1]) > 7) dr.moved = true;
    if (!dr.moved) return;
    const [wx, wy] = this.s2w(...p);
    const [lx, ly] = this.s2w(...dr.last);
    const dx = wx - lx, dy = wy - ly;
    dr.last = p;
    const mode = this.tool.mode;
    if (this.pending?.kind === 'brush') { this.pending.at = [wx, wy]; this.paintAt(wx, wy); this.dirty = true; return; }
    if (this.pending?.kind === 'erase') { this.pending.at = [wx, wy]; this.eraseAt(wx, wy); this.dirty = true; return; }
    if (mode === 'place' && (this.tool.what === 'shape')) {
      if (!this.pending || this.pending.kind !== 'lasso') this.pending = { kind: 'lasso', pts: [dr.w0], area: SHAPES[this.tool.key].kind === 'area' };
      this.pending.pts.push([wx, wy]);
      this.dirty = true; return;
    }
    const hit = dr.hit;
    if (hit && !dr.committed && hit.kind !== 'pinplace') { this.pushUndo(); dr.committed = true; }
    if (!hit) { this.cx -= dx; this.cy -= dy; dr.last = this.pos(e); this.dirty = true; return; }
    switch (hit.kind) {
      case 'point': hit.shape.pts[hit.i] = [hit.shape.pts[hit.i][0] + dx, hit.shape.pts[hit.i][1] + dy]; this.sel.point = hit.i; break;
      case 'mid': {
        const sh = hit.shape, a = sh.pts[hit.i], b = sh.pts[(hit.i + 1) % sh.pts.length];
        sh.pts.splice(hit.i + 1, 0, [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy]);
        dr.hit = { kind: 'point', shape: sh, i: hit.i + 1 }; this.sel.point = hit.i + 1; break;
      }
      case 'teespot': { const sp = teeSpot(hit.shape); hit.shape.props.sx = sp[0] + dx; hit.shape.props.sy = sp[1] + dy; break; }
      case 'fhandle': {
        const f = hit.f, rx = wx - f.x, ry = wy - f.y;
        if (hit.k === 'rot') f.rot = Math.atan2(rx, -ry);
        else {
          const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
          if (hit.k === 'rx') f.rx = clamp(Math.abs(rx * c + ry * s), 1.5, 200);
          else f.ry = clamp(Math.abs(-rx * s + ry * c), 1.5, 200);
        }
        this.recomputeDeb(); break;
      }
      case 'routept': this.hole.route[hit.i] = [this.hole.route[hit.i][0] + dx, this.hole.route[hit.i][1] + dy]; break;
      case 'pin': this.hole.pin.x += dx; this.hole.pin.y += dy; break;
      case 'object': hit.o.x += dx; hit.o.y += dy; if (this.sel?.id !== hit.o.id) this.select({ kind: 'object', id: hit.o.id }); break;
      case 'feature': hit.f.x += dx; hit.f.y += dy; if (this.sel?.id !== hit.f.id) this.select({ kind: 'feature', id: hit.f.id }); this.recomputeDeb(); break;
      case 'shape':
        if (this.sel?.id !== hit.shape.id) this.select({ kind: 'shape', id: hit.shape.id });
        for (const q of hit.shape.pts) { q[0] += dx; q[1] += dy; }
        if (hit.shape.props.sx != null) { hit.shape.props.sx += dx; hit.shape.props.sy += dy; }
        if (hit.shape.type === 'green' && pointInPoly(this.hole.pin.x - dx, this.hole.pin.y - dy, shapePoly(hit.shape))) { /* keep pin with green */ }
        break;
      default: break;
    }
    if (hit.kind !== 'fhandle' && hit.kind !== 'feature' && (hit.kind !== 'object')) this.recomputeDeb();
    this.dirty = true;
  }
  pUp(e, cancelled) {
    this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.drag = null; return; }
    const dr = this.drag; this.drag = null;
    if (!dr || cancelled) return;
    const [wx, wy] = this.s2w(...dr.last);
    const mode = this.tool.mode;
    if (this.pending?.kind === 'brush' || this.pending?.kind === 'erase') { this.pending = null; this.commit(); this.dirty = true; return; }
    if (dr.committed && dr.moved) { this.commit(); if (dr.hit?.kind === 'shape' || dr.hit?.kind === 'point') this.refreshSheet(); return; }
    if (!dr.moved) {
      // tap
      if (mode === 'place') return this.placeAt(...dr.w0);
      if (mode === 'pin') { this.pushUndo(); this.hole.pin = { x: dr.w0[0], y: dr.w0[1] }; if (!this.hole.shapes.some((s) => s.type === 'green' && pointInPoly(dr.w0[0], dr.w0[1], shapePoly(s)))) toast('Tip: the hole should sit on a green'); this.commit(); return; }
      if (mode === 'route') {
        const hit = dr.hit;
        if (hit?.kind === 'routept') { this.sel = { kind: 'route', point: hit.i }; this.openRouteSheet(hit.i); this.dirty = true; return; }
        this.pushUndo();
        const r = this.hole.route; r.push(dr.w0); r.sort((a, b) => a[1] - b[1]);
        this.commit(); this.openRouteSheet(); return;
      }
      const hit = dr.hit;
      if (!hit) { this.select(null); return; }
      if (hit.kind === 'point') { this.sel.point = hit.i; this.refreshSheet(); this.dirty = true; return; }
      if (hit.kind === 'mid') { this.pushUndo(); const sh = hit.shape, a = sh.pts[hit.i], b = sh.pts[(hit.i + 1) % sh.pts.length]; sh.pts.splice(hit.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); this.sel.point = hit.i + 1; this.commit(); return; }
      if (hit.kind === 'shape') return this.select({ kind: 'shape', id: hit.shape.id });
      if (hit.kind === 'object') return this.select({ kind: 'object', id: hit.o.id });
      if (hit.kind === 'feature') return this.select({ kind: 'feature', id: hit.f.id });
      if (hit.kind === 'pin') return this.select(null);
      return;
    }
    // drag released in place mode with lasso
    if (mode === 'place' && this.pending?.kind === 'lasso') {
      const pts = this.pending.pts; this.pending = null;
      const area = SHAPES[this.tool.key].kind === 'area';
      const eps = Math.max(0.6, 4 / this.scale);
      let simp = simplify(pts, eps);
      if (area) {
        if (simp.length > 2 && Math.hypot(simp[0][0] - simp[simp.length - 1][0], simp[0][1] - simp[simp.length - 1][1]) < eps * 3) simp.pop();
        if (simp.length < 3 || polyArea(simp) < 2) { this.placeAt(...pts[0]); return; }
        while (simp.length > 40) simp = simplify(simp, eps *= 1.5);
      } else if (simp.length < 2) return;
      this.pushUndo();
      const sh = makeShape(this.tool.key, 0, 0, { pts: simp.map((q) => [q[0], q[1]]) });
      this.hole.shapes.push(sh);
      this.commit();
      this.afterPlaceShape(sh);
    }
    void wx; void wy;
  }
  placeAt(x, y) {
    const t = this.tool;
    const axis = this.holeAxis();
    if (t.what === 'shape') {
      const def = SHAPES[t.key];
      if (def.kind === 'line') {
        if (!this.pending || this.pending.kind !== 'tapline') this.pending = { kind: 'tapline', pts: [] };
        this.pending.pts.push([x, y]);
        this.doneBar.classList.toggle('show', this.pending.pts.length >= 1);
        this.dirty = true; haptic('light');
        return;
      }
      this.pushUndo();
      const sh = makeShape(t.key, x, y, { rot: def.rect || t.key === 'green' || t.key === 'fairway' || t.key === 'fbunker' ? -axis + (t.key === 'fbunker' ? Math.PI / 2 : 0) : Math.random() * Math.PI });
      if (t.key === 'water') sh.props.color = CLIMATES[this.hole.climate].water;
      if (t.key.includes('bunker') || t.key === 'pot') sh.props.sand = t.key === 'pot' ? sh.props.sand : CLIMATES[this.hole.climate].sand;
      if (t.key === 'tee') { const used = new Set(this.hole.shapes.filter((s) => s.type === 'tee').map((s) => s.props.set)); sh.props.set = ['blue', 'white', 'red', 'black', 'gold'].find((s) => !used.has(s)) || 'white'; }
      if (t.key === 'fairway') { sh.pts = makeShape('fairway', x, y, { size: [16, 45], rot: -axis }).pts; }
      this.hole.shapes.push(sh);
      if (t.key === 'green' && !this.hole.shapes.some((s) => s !== sh && s.type === 'green')) this.hole.pin = { x, y };
      this.commit(); haptic('medium'); sfx.click();
      this.afterPlaceShape(sh);
    } else if (t.what === 'feature') {
      this.pushUndo();
      const f = makeFeature(t.key, x, y, t.key === 'ridge' || t.key === 'swale' || t.key === 'dune' ? -axis + Math.PI / 2 : 0);
      this.hole.features.push(f);
      this.commit(); haptic('medium');
      this.select({ kind: 'feature', id: f.id });
      this.recompute();
    } else if (t.what === 'object') {
      this.pushUndo();
      const kind = t.key === 'mix' ? this.mixKind() : t.key;
      const o = makeObject(kind, x, y, OBJ[kind].cat === 'amenity' ? 1 : 0.85 + Math.random() * 0.35, OBJ[kind].cat === 'amenity' ? -axis : Math.random() * Math.PI * 2);
      this.hole.objects.push(o);
      this.commit(); haptic('light'); sfx.tick();
      this.sel = { kind: 'object', id: o.id };
      this.refreshSheet(true);
    }
  }
  afterPlaceShape(sh) {
    this.tray.querySelectorAll('.tr-item').forEach((x) => x.classList.remove('on'));
    this.tool = { mode: 'select' };
    this.select({ kind: 'shape', id: sh.id });
    this.setHint('Drag the yellow points to reshape · tap + to add a point');
  }
  finishPendingLine() {
    const p = this.pending;
    this.doneBar.classList.remove('show');
    if (!p || p.pts.length < 2) { this.pending = null; this.dirty = true; return; }
    this.pushUndo();
    const sh = makeShape(this.tool.key, 0, 0, { pts: p.pts });
    this.hole.shapes.push(sh);
    this.pending = null;
    this.commit();
    this.afterPlaceShape(sh);
  }
  mixKind() {
    const C = CLIMATES[this.hole.climate];
    const list = C.trees.filter((k) => OBJ[k] && (OBJ[k].cat === 'tree' || OBJ[k].cat === 'shrub'));
    return list[Math.floor(Math.random() * list.length)];
  }
  paintAt(x, y) {
    const pend = this.pending;
    const R = this.brush.size;
    const kind0 = this.tool.key;
    if (pend.lastPaint && Math.hypot(x - pend.lastPaint[0], y - pend.lastPaint[1]) < R * 0.5) return;
    pend.lastPaint = [x, y];
    const n = Math.max(1, Math.round(R * R * 0.01 * this.brush.density * 3));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const kind = kind0 === 'mix' ? this.mixKind() : kind0;
      const minD = Math.max(1.2, objRadius({ kind, s: 1 }) * (1.6 - this.brush.density));
      if (this.hole.objects.some((o) => Math.hypot(o.x - px, o.y - py) < minD)) continue;
      if (this.blockedForPlant(px, py)) continue;
      this.hole.objects.push(makeObject(kind, px, py, 0.8 + Math.random() * 0.45));
    }
  }
  blockedForPlant(x, y) {
    for (const sh of this.hole.shapes) {
      if (['green', 'tee', 'water', 'bunker', 'fbunker', 'pot', 'fairway'].includes(sh.type) && pointInPoly(x, y, shapePoly(sh))) return true;
      if (sh.type === 'path' && distToPolyline(x, y, shapePoly(sh)) < sh.props.width) return true;
    }
    return false;
  }
  eraseAt(x, y) {
    const R = this.brush.size;
    const before = this.hole.objects.length;
    this.hole.objects = this.hole.objects.filter((o) => Math.hypot(o.x - x, o.y - y) > R);
    if (this.hole.objects.length !== before) haptic('light');
  }
  holeAxis() {
    const tees = holeTees(this.hole);
    const t = tees.length ? tees[0].spot : [0, 0];
    return Math.atan2(this.hole.pin.x - t[0], this.hole.pin.y - t[1]);
  }

  // ----------------------------------------------------------------- history & persistence
  pushUndo() {
    this.undoStack.push(JSON.stringify(this.hole));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }
  commit() {
    this.hole.updated = Date.now();
    if (this.hole.parAuto !== false) this.hole.par = suggestPar(this.hole);
    this.save();
    this.recomputeDeb();
    this.updateTop();
    this.dirty = true;
  }
  undo() {
    if (!this.undoStack.length) return;
    sfx.tick();
    this.redoStack.push(JSON.stringify(this.hole));
    this.hole = JSON.parse(this.undoStack.pop());
    this.afterHistory();
  }
  redo() {
    if (!this.redoStack.length) return;
    sfx.tick();
    this.undoStack.push(JSON.stringify(this.hole));
    this.hole = JSON.parse(this.redoStack.pop());
    this.afterHistory();
  }
  afterHistory() {
    if (this.sel && !this.selectedItem()) this.select(null); else this.refreshSheet();
    this.save(); this.recompute(); this.updateTop(); this.dirty = true;
  }
  async persist() { try { await db.put('holes', this.hole); } catch (e) { console.warn(e); } }

  // ----------------------------------------------------------------- selection & inspector
  selectedItem() {
    const s = this.sel; if (!s) return null;
    if (s.kind === 'shape') return this.findShape(s.id);
    if (s.kind === 'feature') return this.hole.features.find((f) => f.id === s.id);
    if (s.kind === 'object') return this.hole.objects.find((o) => o.id === s.id);
    if (s.kind === 'route') return this.hole.route;
    return null;
  }
  select(sel) {
    this.sel = sel;
    if (sel) { sfx.tick(); haptic('light'); }
    this.refreshSheet(true);
    this.dirty = true;
  }
  closeSheet() { this.sheet.classList.remove('show'); this.sheet.innerHTML = ''; this.root.classList.remove('sheet-open'); }
  sheetFrame(title, ...content) {
    this.sheet.innerHTML = '';
    const head = h('div', { class: 'sh-head' }, h('div', { class: 'sh-grab' }), h('b', {}, title), h('button', { class: 'hbtn sm', onclick: () => { this.select(null); this.closeSheet(); } }, icon('x')));
    let collapsed = false;
    head.querySelector('.sh-grab').onclick = () => { collapsed = !collapsed; this.sheet.classList.toggle('collapsed', collapsed); };
    head.querySelector('b').onclick = () => { collapsed = !collapsed; this.sheet.classList.toggle('collapsed', collapsed); };
    this.sheet.append(head, h('div', { class: 'sh-body' }, ...content));
    this.sheet.classList.add('show'); this.root.classList.add('sheet-open');
  }
  refreshSheet(reset) {
    const s = this.sel, it = this.selectedItem();
    if (!s || !it) { if (!this.holeSheetOpen) this.closeSheet(); return; }
    this.holeSheetOpen = false;
    const ch = (fn, recompute = true) => (v) => { this.pushUndoThrottled(); fn(v); this.commitLight(recompute); };
    if (s.kind === 'shape') this.shapeSheet(it, ch);
    else if (s.kind === 'feature') this.featureSheet(it, ch);
    else if (s.kind === 'object') this.objectSheet(it, ch);
    if (reset) this.sheet.scrollTop = 0;
  }
  pushUndoThrottled() {
    const now = performance.now();
    if (!this.lastUndoT || now - this.lastUndoT > 800) this.pushUndo();
    this.lastUndoT = now;
  }
  commitLight(recompute) { this.hole.updated = Date.now(); if (this.hole.parAuto !== false) this.hole.par = suggestPar(this.hole); this.save(); if (recompute) this.recomputeDeb(); this.updateTop(); this.dirty = true; }
  actionsRow(onDup, onDel, extra = []) {
    return h('div', { class: 'sh-actions' }, ...extra, btn(`${icon('copy').outerHTML}<span>Duplicate</span>`, onDup, 'ghost sm'), btn(`${icon('trash').outerHTML}<span>Delete</span>`, onDel, 'danger sm'));
  }
  transformRow(sh) {
    const xf = (fn) => () => { this.pushUndo(); const c = polyCentroid(sh.pts); sh.pts = sh.pts.map((p) => fn(p, c)); if (sh.props.sx != null) { const q = fn([sh.props.sx, sh.props.sy], c); sh.props.sx = q[0]; sh.props.sy = q[1]; } this.commit(); };
    const rot = (a) => xf((p, c) => { const dx = p[0] - c[0], dy = p[1] - c[1], co = Math.cos(a), si = Math.sin(a); return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co]; });
    const scl = (k) => xf((p, c) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]);
    const stretch = (kx) => xf((p, c) => { const a = this.holeAxis(); const dx = p[0] - c[0], dy = p[1] - c[1]; const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a); const u2 = u * kx; return [c[0] + u2 * Math.cos(a) + v * Math.sin(a), c[1] - u2 * Math.sin(a) + v * Math.cos(a)]; });
    return h('div', { class: 'sh-xf' },
      h('button', { class: 'xbtn', onclick: rot(0.2) }, '⟲'), h('button', { class: 'xbtn', onclick: rot(-0.2) }, '⟳'),
      h('button', { class: 'xbtn', onclick: scl(0.9) }, '−'), h('button', { class: 'xbtn', onclick: scl(1.1) }, '+'),
      h('button', { class: 'xbtn wide', onclick: stretch(0.88) }, 'Narrow'), h('button', { class: 'xbtn wide', onclick: stretch(1.12) }, 'Widen'));
  }
  shapeSheet(sh, ch) {
    const def = SHAPES[sh.type], P = sh.props;
    const line = def.kind === 'line';
    const kids = [];
    const swap = { bunker: ['bunker', 'fbunker', 'pot', 'waste'], fbunker: ['bunker', 'fbunker', 'pot', 'waste'], pot: ['bunker', 'fbunker', 'pot', 'waste'], waste: ['waste', 'native', 'bunker'], rough: ['rough', 'deep', 'native'], deep: ['rough', 'deep', 'native'], native: ['native', 'rough', 'deep', 'waste'], path: ['path', 'trail'], trail: ['trail', 'path'] }[sh.type];
    if (swap) kids.push(h('div', { class: 'row' }, h('span', {}, 'Type'), select(swap.map((t) => [t, SHAPES[t].label]), sh.type, (v) => { this.pushUndo(); sh.type = v; sh.props = { ...SHAPES[v].props, ...sh.props }; this.commit(); this.refreshSheet(); })));
    switch (sh.type) {
      case 'fairway':
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Mowing'), segmented([['stripes', 'Stripes'], ['checker', 'Checker'], ['diagonal', 'Diagonal'], ['lengthwise', 'Lengthwise'], ['none', 'None']], P.mow, ch((v) => { P.mow = v; }, false))));
        kids.push(slider({ label: 'Stripe width', min: 3, max: 20, step: 0.5, value: P.stripe, unit: ' m', onInput: ch((v) => { P.stripe = v; }, false) }));
        kids.push(slider({ label: 'First cut collar', min: 0, max: 5, step: 0.2, value: P.firstCut, unit: ' m', onInput: ch((v) => { P.firstCut = v; }, false) }));
        kids.push(slider({ label: 'Turf tone', min: -1, max: 1, step: 0.05, value: P.tone, fmt: (v) => (v > 0 ? 'Lighter' : v < 0 ? 'Darker' : 'Natural'), onInput: ch((v) => { P.tone = v; }, false) }));
        break;
      case 'green':
        kids.push(dialRow('Slope direction (downhill)', P.slopeDir, ch((v) => { P.slopeDir = v; })));
        kids.push(slider({ label: 'Slope', min: 0, max: 5, step: 0.1, value: P.slope, unit: '%', onInput: ch((v) => { P.slope = v; }) }));
        kids.push(slider({ label: 'Undulation', min: 0, max: 1.5, step: 0.05, value: P.undulation, fmt: (v) => (v < 0.2 ? 'Flat' : v < 0.6 ? 'Gentle' : v < 1 ? 'Rolling' : 'Wild'), onInput: ch((v) => { P.undulation = v; }) }));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Tiers'), segmented([[0, 'None'], [1, 'Two-tier'], [2, 'Three-tier']], P.tiers, ch((v) => { P.tiers = v; }))));
        kids.push(slider({ label: 'Tier step height', min: 0.2, max: 1.5, step: 0.05, value: P.tierH, unit: ' m', onInput: ch((v) => { P.tierH = v; }) }));
        kids.push(slider({ label: 'Elevation', min: -2, max: 3, step: 0.1, value: P.elevation, fmt: (v) => (v > 0.15 ? `Raised ${v.toFixed(1)}m` : v < -0.15 ? `Sunken ${(-v).toFixed(1)}m` : 'At grade'), onInput: ch((v) => { P.elevation = v; }) }));
        kids.push(slider({ label: 'Green speed (Stimp)', min: 7, max: 14, step: 0.5, value: P.stimp, fmt: (v) => `${v} ${v < 9 ? '· slow' : v < 11 ? '· medium' : v < 12.5 ? '· fast' : '· lightning'}`, onInput: ch((v) => { P.stimp = v; }, false) }));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Firmness'), segmented([[0, 'Soft'], [1, 'Medium'], [2, 'Firm']], P.firmness, ch((v) => { P.firmness = v; }, false))));
        kids.push(slider({ label: 'Fringe width', min: 0, max: 3, step: 0.1, value: P.fringe, unit: ' m', onInput: ch((v) => { P.fringe = v; }, false) }));
        kids.push(btn('Random pin position', () => { this.pushUndo(); const poly = shapePoly(sh); const c = polyCentroid(poly); for (let i = 0; i < 40; i++) { const x = c[0] + (Math.random() - 0.5) * 20, y = c[1] + (Math.random() - 0.5) * 20; if (pointInPoly(x, y, poly) && distToPolyline(x, y, poly, true) > 3) { this.hole.pin = { x, y }; break; } } this.commit(); }, 'ghost sm'));
        break;
      case 'tee':
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Tee markers'), segmented(Object.entries(TEE_SETS).map(([k, v]) => [k, v.label]), P.set, ch((v) => { P.set = v; }, false))));
        kids.push(slider({ label: 'Pad height', min: 0, max: 2.5, step: 0.1, value: P.raise, unit: ' m', onInput: ch((v) => { P.raise = v; }) }));
        kids.push(h('p', { class: 'note' }, 'Drag the white circle to move where the ball is teed.'));
        break;
      case 'bunker': case 'fbunker': case 'pot':
        kids.push(slider({ label: 'Depth', min: 0.2, max: 2.5, step: 0.05, value: P.depth, unit: ' m', onInput: ch((v) => { P.depth = v; }) }));
        kids.push(slider({ label: 'Face', min: 0.3, max: 4, step: 0.1, value: P.lip, fmt: (v) => (v < 0.8 ? 'Sheer revetted' : v < 1.6 ? 'Steep' : v < 2.6 ? 'Sloped' : 'Shallow'), onInput: ch((v) => { P.lip = v; }) }));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Sand'), segmented(Object.entries(SAND_COLORS).map(([k, v]) => [k, v.label]), P.sand, ch((v) => { P.sand = v; }, false))));
        kids.push(toggle('Raked & rake in bunker', P.rake, ch((v) => { P.rake = v; }, false)));
        break;
      case 'water':
        kids.push(slider({ label: 'Depth', min: 0.5, max: 4, step: 0.1, value: P.depth, unit: ' m', onInput: ch((v) => { P.depth = v; }) }));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Water'), segmented(Object.entries(WATER_COLORS).map(([k, v]) => [k, v.label]), P.color, ch((v) => { P.color = v; }, false))));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Shoreline'), segmented([['grass', 'Grass'], ['rocks', 'Rocks'], ['sand', 'Beach'], ['wall', 'Stone Wall']], P.shore, ch((v) => { P.shore = v; }, false))));
        kids.push(toggle('Fountain', P.fountain, ch((v) => { P.fountain = v; }, false)));
        kids.push(toggle('Lily pads', P.lilies, ch((v) => { P.lilies = v; }, false)));
        kids.push(toggle('Cattail reeds on shore', P.reeds, ch((v) => { P.reeds = v; }, false)));
        break;
      case 'rough': case 'deep':
        kids.push(slider({ label: 'Grass tufts', min: 0, max: 1, step: 0.05, value: P.tufts, fmt: (v) => `${Math.round(v * 100)}%`, onInput: ch((v) => { P.tufts = v; }, false) }));
        kids.push(slider({ label: 'Tone', min: -1, max: 1, step: 0.05, value: P.tone, fmt: (v) => (v > 0 ? 'Lighter' : v < 0 ? 'Darker' : 'Natural'), onInput: ch((v) => { P.tone = v; }, false) }));
        break;
      case 'native': case 'waste':
        kids.push(slider({ label: 'Tone', min: -1, max: 1, step: 0.05, value: P.tone, fmt: (v) => (v > 0 ? 'Lighter' : v < 0 ? 'Darker' : 'Natural'), onInput: ch((v) => { P.tone = v; }, false) }));
        break;
      case 'mulch':
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Flowers'), segmented([['mixed', 'Mixed'], ['red', 'Red'], ['white', 'White'], ['purple', 'Purple'], ['yellow', 'Yellow']], P.flowers, ch((v) => { P.flowers = v; }, false))));
        break;
      case 'path': case 'trail':
        kids.push(slider({ label: 'Width', min: 0.8, max: 5, step: 0.1, value: P.width, unit: ' m', onInput: ch((v) => { P.width = v; }, false) }));
        kids.push(h('div', { class: 'row' }, h('span', {}, 'Surface'), segmented(Object.entries(PATH_MATERIALS).map(([k, v]) => [k, v.label]), P.material, ch((v) => { P.material = v; }, false))));
        break;
      case 'creek':
        kids.push(slider({ label: 'Width', min: 1.5, max: 12, step: 0.1, value: P.width, unit: ' m', onInput: ch((v) => { P.width = v; }) }));
        kids.push(slider({ label: 'Depth', min: 0.3, max: 2.5, step: 0.05, value: P.depth, unit: ' m', onInput: ch((v) => { P.depth = v; }) }));
        break;
      case 'oob': kids.push(h('p', { class: 'note' }, 'Balls coming to rest inside this zone are out of bounds (stroke and distance).')); break;
      default: break;
    }
    const pointTools = h('div', { class: 'sh-points' },
      h('span', { class: 'note' }, `${sh.pts.length} points${this.sel.point != null ? ` · point ${this.sel.point + 1} selected` : ''}`),
      this.sel.point != null ? btn('Delete point', () => { if (sh.pts.length <= (line ? 2 : 3)) { toast('Need more points'); return; } this.pushUndo(); sh.pts.splice(this.sel.point, 1); this.sel.point = null; this.commit(); this.refreshSheet(); }, 'ghost sm') : null,
      btn('Smooth', () => { this.pushUndo(); sh.pts = smoothPts(sh.pts, line); this.commit(); this.refreshSheet(); }, 'ghost sm'),
      btn('Add detail', () => { this.pushUndo(); sh.pts = subdivide(sh.pts, line); this.commit(); this.refreshSheet(); }, 'ghost sm'));
    const area = !line ? polyArea(shapePoly(sh)) : 0;
    const u = this.settings.units;
    const info = !line ? `${u === 'm' ? Math.round(area) + ' m²' : Math.round(area * 10.764).toLocaleString() + ' sq ft'}` : '';
    this.sheetFrame(`${def.label}${info ? ` · ${info}` : ''}`,
      this.transformRow(sh), ...kids, pointTools,
      this.actionsRow(() => { this.pushUndo(); const c = deepClone(sh); c.id = uid(); c.pts = c.pts.map((p) => [p[0] + 8, p[1] + 8]); if (c.props.sx != null) { c.props.sx += 8; c.props.sy += 8; } this.hole.shapes.push(c); this.commit(); this.select({ kind: 'shape', id: c.id }); },
        () => { if (sh.type === 'tee' && this.hole.shapes.filter((s) => s.type === 'tee').length <= 1) { toast('A hole needs at least one tee box'); return; } this.pushUndo(); this.hole.shapes = this.hole.shapes.filter((s) => s !== sh); this.commit(); this.select(null); }));
  }
  featureSheet(f, ch) {
    this.sheetFrame(FEATURES[f.kind]?.label || 'Terrain',
      slider({ label: 'Height', min: -12, max: 20, step: 0.1, value: f.h, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m`, onInput: ch((v) => { f.h = v; }) }),
      slider({ label: 'Width', min: 2, max: 150, step: 0.5, value: f.rx, unit: ' m', onInput: ch((v) => { f.rx = v; }) }),
      slider({ label: 'Length', min: 2, max: 150, step: 0.5, value: f.ry, unit: ' m', onInput: ch((v) => { f.ry = v; }) }),
      slider({ label: 'Rotation', min: 0, max: 180, step: 1, value: Math.round(((f.rot || 0) * 180 / Math.PI + 360) % 180), unit: '°', onInput: ch((v) => { f.rot = v * Math.PI / 180; }) }),
      h('div', { class: 'row' }, h('span', {}, 'Profile'), segmented([['smooth', 'Rounded'], ['sharp', 'Peaked'], ['plateau', 'Flat-top']], f.profile, ch((v) => { f.profile = v; }))),
      h('p', { class: 'note' }, 'Drag the yellow handles to stretch, the blue handle to rotate.'),
      this.actionsRow(() => { this.pushUndo(); const c = { ...f, id: uid(), x: f.x + 10, y: f.y + 10 }; this.hole.features.push(c); this.commit(); this.select({ kind: 'feature', id: c.id }); },
        () => { this.pushUndo(); this.hole.features = this.hole.features.filter((x) => x !== f); this.commit(); this.select(null); }));
  }
  objectSheet(o, ch) {
    const def = OBJ[o.kind];
    const same = Object.keys(OBJ).filter((k) => OBJ[k].cat === def.cat);
    this.sheetFrame(def.label,
      h('div', { class: 'row' }, h('span', {}, 'Kind'), select(same.map((k) => [k, OBJ[k].label]), o.kind, ch((v) => { o.kind = v; this.refreshSheet(); }, false))),
      slider({ label: 'Size', min: 0.4, max: 2.2, step: 0.05, value: o.s || 1, fmt: (v) => `${Math.round(v * 100)}%`, onInput: ch((v) => { o.s = v; }, false) }),
      slider({ label: 'Rotation', min: 0, max: 360, step: 1, value: Math.round(((o.r || 0) * 180 / Math.PI + 360) % 360), unit: '°', onInput: ch((v) => { o.r = v * Math.PI / 180; }, false) }),
      btn('Shuffle shape', () => { this.pushUndo(); o.seed = Math.floor(Math.random() * 1e6); this.commit(); }, 'ghost sm'),
      this.actionsRow(() => { this.pushUndo(); const c = { ...o, id: uid(), x: o.x + 3, y: o.y + 3, seed: Math.floor(Math.random() * 1e6) }; this.hole.objects.push(c); this.commit(); this.select({ kind: 'object', id: c.id }); },
        () => { this.pushUndo(); this.hole.objects = this.hole.objects.filter((x) => x !== o); this.commit(); this.select(null); }));
  }
  openRouteSheet(pointIdx) {
    const r = this.hole.route;
    this.sheetFrame('Line of Play',
      h('p', { class: 'note' }, 'The line of play sets the hole yardage and where players aim off the tee on doglegs. Tap the map to add aim points.'),
      h('div', { class: 'sh-points' }, h('span', { class: 'note' }, `${r.length} aim point${r.length === 1 ? '' : 's'}`),
        pointIdx != null ? btn('Delete point', () => { this.pushUndo(); r.splice(pointIdx, 1); this.commit(); this.openRouteSheet(); }, 'ghost sm') : null,
        btn('Clear all', () => { this.pushUndo(); r.length = 0; this.commit(); this.openRouteSheet(); }, 'ghost sm'),
        btn('Done', () => { this.tool = { mode: 'select' }; this.sel = null; this.closeSheet(); this.tray.querySelectorAll('.tr-item').forEach((x) => x.classList.remove('on')); this.dirty = true; }, 'primary sm')));
  }
  openHoleSheet(section) {
    this.select(null);
    this.holeSheetOpen = true;
    const hole = this.hole, T = hole.terrain, D = hole.decor;
    const ch = (fn, rc = true) => (v) => { this.pushUndoThrottled(); fn(v); this.commitLight(rc); };
    const climateCards = h('div', { class: 'climate-grid' }, Object.entries(CLIMATES).map(([k, c]) =>
      h('button', { class: `cl-card cl-${k} ${hole.climate === k ? 'on' : ''}`, onclick: (e) => {
        this.pushUndo(); hole.climate = k; hole.ground = c.ground;
        for (const s of hole.shapes) { if (s.type === 'water') s.props.color = c.water; if (s.type === 'bunker' || s.type === 'fbunker') s.props.sand = c.sand; }
        this.commit(); e.currentTarget.parentElement.querySelectorAll('.cl-card').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on');
      } }, h('b', {}, c.name), h('span', {}, c.blurb))));
    const windRow = h('div', {});
    const renderWind = () => {
      windRow.innerHTML = '';
      windRow.append(h('div', { class: 'row' }, h('span', {}, 'Wind'), segmented([...Object.entries(WIND_MODES).map(([k, v]) => [k, v.label]), ['fixed', 'Custom']], hole.wind.mode, ch((v) => { hole.wind.mode = v; renderWind(); }, false))));
      if (hole.wind.mode === 'fixed') {
        windRow.append(slider({ label: 'Wind speed', min: 0, max: 15, step: 0.5, value: hole.wind.speed, fmt: (v) => (this.settings.units === 'm' ? `${Math.round(v * 3.6)} km/h` : `${Math.round(v * 2.237)} mph`), onInput: ch((v) => { hole.wind.speed = v; }, false) }));
        windRow.append(dialRow('Blowing toward', hole.wind.dir, ch((v) => { hole.wind.dir = v; }, false)));
      }
    };
    renderWind();
    const parRow = h('div', { class: 'row' }, h('span', {}, 'Par'), segmented([['auto', `Auto (${suggestPar(hole)})`], [3, '3'], [4, '4'], [5, '5'], [6, '6']], hole.parAuto !== false ? 'auto' : hole.par, ch((v) => { if (v === 'auto') { hole.parAuto = true; hole.par = suggestPar(hole); } else { hole.parAuto = false; hole.par = v; } }, false)));
    const terrainSec = h('div', { class: 'sec' }, h('h4', {}, 'Land Shape'),
      slider({ label: 'Elevation change (tee → green)', min: -30, max: 30, step: 0.5, value: T.elev, fmt: (v) => (v > 0 ? `Uphill +${v} m` : v < 0 ? `Downhill ${v} m` : 'Level'), onInput: ch((v) => { T.elev = v; }) }),
      slider({ label: 'Side slope', min: -6, max: 6, step: 0.1, value: T.cross, fmt: (v) => (v > 0 ? `Rises right ${v}%` : v < 0 ? `Rises left ${-v}%` : 'None'), onInput: ch((v) => { T.cross = v; }) }),
      slider({ label: 'Rolling ground', min: 0, max: 4, step: 0.05, value: T.roll, fmt: (v) => (v < 0.3 ? 'Flat' : v < 1 ? 'Gentle' : v < 2 ? 'Rolling' : 'Rugged'), onInput: ch((v) => { T.roll = v; }) }),
      slider({ label: 'Roll size', min: 15, max: 150, step: 1, value: T.scale, unit: ' m', onInput: ch((v) => { T.scale = v; }) }),
      btn(`${icon('dice').outerHTML}<span>New random ground</span>`, () => { this.pushUndo(); T.seed = Math.floor(Math.random() * 99999); this.commit(); }, 'ghost sm'));
    this.sheetFrame('Hole Settings',
      h('div', { class: 'sec' },
        h('div', { class: 'row' }, h('span', {}, 'Name'), h('input', { class: 'field', value: hole.name, maxlength: 40, onchange: (e) => { this.pushUndo(); hole.name = e.target.value.trim() || 'Untitled'; this.commit(); } })),
        parRow,
        toggle('★ In my collection (available for courses)', hole.status === 'saved', ch((v) => { hole.status = v ? 'saved' : 'draft'; }, false))),
      h('div', { class: 'sec' }, h('h4', {}, 'Climate'), climateCards),
      h('div', { class: 'sec' }, h('h4', {}, 'Conditions'),
        h('div', { class: 'row' }, h('span', {}, 'Time of day'), segmented(Object.entries(TIMES).map(([k, v]) => [k, v.label]), hole.time, ch((v) => { hole.time = v; }, false))),
        windRow,
        h('div', { class: 'row' }, h('span', {}, 'Base ground'), segmented([['rough', 'Grass rough'], ['native', 'Native / desert']], hole.ground, ch((v) => { hole.ground = v; }, false)))),
      terrainSec,
      h('div', { class: 'sec' }, h('h4', {}, 'Property'),
        slider({ label: 'Property width', min: 100, max: 400, step: 5, value: hole.width, unit: ' m', onInput: ch((v) => { hole.width = v; }) }),
        slider({ label: 'Property length', min: 120, max: 750, step: 5, value: hole.length, unit: ' m', onInput: ch((v) => { hole.length = v; }) }),
        toggle('White-stake out of bounds at property line', D.oobEdge, ch((v) => { D.oobEdge = v; }, false)),
        toggle('Forest & scenery beyond the property', D.surround, ch((v) => { D.surround = v; }, false)),
        toggle('Tee furniture (bench, ball washer, sign)', D.teeProps, ch((v) => { D.teeProps = v; }, false)),
        toggle('Fairway yardage markers', D.markers, ch((v) => { D.markers = v; }, false)),
        toggle('Hazard & boundary stakes', D.stakes, ch((v) => { D.stakes = v; }, false))),
      h('div', { class: 'sec' }, h('h4', {}, 'Start Over'),
        h('div', { class: 'sh-actions' },
          btn(`${icon('dice').outerHTML}<span>Generate new layout</span>`, () => this.regenerate(), 'ghost sm'),
          btn(`${icon('trash').outerHTML}<span>Clear everything</span>`, async () => { if (await confirmDialog('Clear hole?', 'Removes all shapes, terrain and objects. You can undo this.', 'Clear', true)) { this.pushUndo(); const keepTee = hole.shapes.filter((s) => s.type === 'tee' || s.type === 'green'); hole.shapes = keepTee; hole.features = []; hole.objects = []; hole.route = []; this.commit(); } }, 'danger sm'))));
    if (section === 'terrain') setTimeout(() => terrainSec.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  async regenerate() {
    const parSel = await modal({ title: 'Generate a new layout', body: h('p', {}, `Creates a fresh ${CLIMATES[this.hole.climate].name} layout you can then customize. Your current design can be restored with Undo.`), actions: [{ label: 'Par 3', value: 3 }, { label: 'Par 4', value: 4 }, { label: 'Par 5', value: 5 }, { label: 'Cancel', value: null, cls: 'ghost' }] });
    if (!parSel) return;
    this.pushUndo();
    const g = generateHole({ par: parSel, climate: this.hole.climate });
    Object.assign(this.hole, { ...g, id: this.hole.id, name: this.hole.name, status: this.hole.status, created: this.hole.created });
    this.commit(); this.recompute(); this.fit(); this.closeSheet(); this.holeSheetOpen = false;
  }

  // ----------------------------------------------------------------- exit / play
  validate() {
    const tees = this.hole.shapes.filter((s) => s.type === 'tee');
    if (!tees.length) { toast('Add a tee box first'); return false; }
    const onGreen = this.hole.shapes.some((s) => s.type === 'green' && pointInPoly(this.hole.pin.x, this.hole.pin.y, shapePoly(s)));
    if (!onGreen) { toast('Place the pin on a green'); return false; }
    return true;
  }
  async play() {
    if (!this.validate()) return;
    await this.persist();
    this.destroy();
    this.onPlay?.(this.hole);
  }
  async exit() {
    await this.persist();
    this.destroy();
    this.onExit?.(this.hole);
  }
  destroy() { this.dead = true; window.removeEventListener('resize', this.onResize); this.root.remove(); }
}

// helpers ---------------------------------------------------------------------------------
function objRadius(o) {
  const def = OBJ[o.kind]; if (!def) return 1;
  const s = o.s || 1;
  if (def.col.canopy) return def.col.canopy[1] * s;
  if (def.col.solid) return def.col.solid[0] * 1.4 * s;
  if (def.col.box) return Math.hypot(def.col.box[0], def.col.box[2]) * s;
  return 1 * s;
}
function drawSegs(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < s.length; i += 4) { ctx.moveTo(s[i], s[i + 1]); ctx.lineTo(s[i + 2], s[i + 3]); }
  ctx.stroke();
}
function pill(ctx, x, y, t) {
  const w = ctx.measureText(t).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 9, w, 18, 9) : ctx.rect(x - w / 2, y - 9, w, 18); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 4);
}
function smoothPts(pts, line) {
  const n = pts.length;
  return pts.map((p, i) => {
    if (line && (i === 0 || i === n - 1)) return p;
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    return [p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25];
  });
}
function subdivide(pts, line) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    out.push(pts[i]);
    if (line && i === n - 1) break;
    const b = pts[(i + 1) % n];
    out.push([(pts[i][0] + b[0]) / 2, (pts[i][1] + b[1]) / 2]);
  }
  return out.length > 60 ? pts : out;
}
function dialRow(label, value, onChange) {
  const size = 84;
  const val = h('span', { class: 'sl-val' }, `${Math.round(value)}°`);
  const knob = h('div', { class: 'dial' }, h('div', { class: 'dial-arrow' }), h('span', { class: 'dn' }, 'N'));
  const set = (deg) => { knob.querySelector('.dial-arrow').style.transform = `rotate(${deg}deg)`; val.textContent = `${Math.round(deg)}° ${compass(deg)}`; };
  set(value);
  const mv = (e) => {
    const r = knob.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    set(deg); onChange(Math.round(deg));
  };
  knob.addEventListener('pointerdown', (e) => { (() => { try { knob.setPointerCapture(e.pointerId); } catch { /* synthetic */ } })(); mv(e); });
  knob.addEventListener('pointermove', (e) => { if (e.buttons) mv(e); });
  void size;
  return h('div', { class: 'row dial-row' }, h('div', {}, h('span', {}, label), h('br'), val, h('div', { class: 'note' }, '0° points toward the green')), knob);
}
function compass(d) { return ['↑ toward green', '↗', '→ right', '↘', '↓ toward tee', '↙', '← left', '↖'][Math.round(d / 45) % 8]; }

function trayIcon(it, hole) {
  const c = document.createElement('canvas');
  c.width = c.height = 88;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const C = CLIMATES[hole.climate].c;
  const blob = (fill, stroke, rx = 16, ry = 12) => { g.fillStyle = fill; g.beginPath(); g.ellipse(22, 22, rx, ry, -0.3, 0, Math.PI * 2); g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2.5; g.stroke(); } };
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.arc(22, 22, 21, 0, Math.PI * 2); g.fill();
  if (it.kind === 'shape') {
    const k = it.key;
    const map = {
      fairway: [C.fairway, C.first, 18, 9], green: [C.green, C.fringe, 13, 11], tee: [C.tee, C.first, 9, 13], bunker: [SAND_COLORS.white.c, '#7a7a5a', 15, 8], fbunker: [SAND_COLORS.white.c, '#7a7a5a', 18, 6],
      pot: [SAND_COLORS.tan.c, '#5a4a3a', 7, 7], water: [WATER_COLORS.blue.deep, WATER_COLORS.blue.shallow, 17, 12], waste: [C.native, null, 17, 11], rough: [C.rough, null, 18, 14], deep: [C.deep, null, 18, 12],
      native: [C.native, null, 17, 13], mulch: [C.mulch, '#e8423f', 15, 8], oob: ['rgba(255,255,255,0.15)', '#ffffff', 16, 12],
    };
    if (map[k]) {
      blob(map[k][0], map[k][1], map[k][2], map[k][3]);
      if (k === 'fairway') { g.fillStyle = C.fairway2; g.fillRect(14, 14, 5, 16); g.fillRect(25, 14, 5, 16); }
      if (k === 'tee') { g.fillStyle = '#2a62d8'; g.beginPath(); g.arc(18, 22, 2.5, 0, 7); g.arc(26, 22, 2.5, 0, 7); g.fill(); }
      if (k === 'green') { g.fillStyle = '#111'; g.beginPath(); g.arc(24, 21, 2, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(24, 21); g.lineTo(24, 8); g.stroke(); g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(24, 8); g.lineTo(32, 10.5); g.lineTo(24, 13); g.fill(); }
    } else {
      const m = k === 'creek' ? [WATER_COLORS.blue.deep, 6] : k === 'path' ? ['#cfcbc2', 5] : ['#9b7a55', 3.5];
      g.strokeStyle = m[0]; g.lineWidth = m[1]; g.lineCap = 'round';
      g.beginPath(); g.moveTo(6, 34); g.bezierCurveTo(16, 6, 28, 38, 38, 10); g.stroke();
    }
  } else if (it.kind === 'pin') {
    g.fillStyle = C.green; g.beginPath(); g.ellipse(22, 30, 14, 7, 0, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(22, 30); g.lineTo(22, 6); g.stroke();
    g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(22, 6); g.lineTo(34, 10); g.lineTo(22, 14); g.fill();
  } else if (it.kind === 'route') {
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(10, 38); g.lineTo(16, 16); g.lineTo(34, 8); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(16, 16, 4, 0, 7); g.fill();
  } else if (it.kind === 'feature' || it.kind === 'land') {
    const f = FEATURES[it.key] || { h: 1, rx: 10, ry: 10 };
    const up = f.h >= 0;
    const gr = g.createLinearGradient(0, 10, 0, 38);
    gr.addColorStop(0, up ? '#d9b06a' : '#4a8fd8'); gr.addColorStop(1, up ? '#6a8a3a' : '#2a5a8a');
    g.fillStyle = gr; g.beginPath();
    const w = Math.min(18, 6 + f.rx * 0.25), ht = it.kind === 'land' ? 12 : Math.min(16, 4 + Math.abs(f.h) * 3);
    g.moveTo(4, 32);
    if (up) g.quadraticCurveTo(22, 32 - ht * 2.2 * (f.profile === 'plateau' ? 0.8 : 1), 40, 32); else g.quadraticCurveTo(22, 32 + ht, 40, 32);
    g.lineTo(40, 40); g.lineTo(4, 40); g.fill();
    if (it.kind === 'land') { g.fillStyle = '#fff'; g.font = '700 16px system-ui'; g.textAlign = 'center'; g.fillText('⚙', 22, 22); }
  } else if (it.kind === 'object') {
    const k = it.key === 'mix' ? null : it.key;
    const def = k ? OBJ[k] : null;
    const fall = CLIMATES[hole.climate].fall;
    if (!def) { // mix
      const list = CLIMATES[hole.climate].trees;
      list.slice(0, 3).forEach((t, i) => { g.fillStyle = (fall && FALL[t]) || TREE_COLORS[t] || '#4a7a31'; g.beginPath(); g.arc(14 + i * 8, 24 - (i % 2) * 6, 9, 0, 7); g.fill(); });
    } else if (def.cat === 'tree' || def.cat === 'shrub') {
      const col = (fall && FALL[k]) || TREE_COLORS[k] || '#4a7a31';
      if (k === 'saguaro') { g.fillStyle = col; g.fillRect(19, 6, 7, 32); g.fillRect(10, 18, 5, 12); g.fillRect(10, 26, 10, 4); g.fillRect(30, 14, 5, 12); g.fillRect(25, 22, 10, 4); }
      else if (k === 'palm' || k === 'fanpalm') { g.strokeStyle = '#8a7356'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 40); g.quadraticCurveTo(20, 24, 24, 12); g.stroke(); g.strokeStyle = col; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.moveTo(24, 12); g.quadraticCurveTo(24 + Math.cos(a) * 8, 8 + Math.sin(a) * 2, 24 + Math.cos(a) * 14, 14 + Math.abs(Math.sin(a)) * 6); g.stroke(); } }
      else if (['spruce', 'fir', 'cypress'].includes(k)) { g.fillStyle = col; g.beginPath(); g.moveTo(22, 4); g.lineTo(k === 'cypress' ? 28 : 34, 36); g.lineTo(k === 'cypress' ? 16 : 10, 36); g.fill(); g.fillStyle = '#4a3424'; g.fillRect(20, 36, 4, 5); }
      else if (def.cat === 'tree') { g.fillStyle = k === 'birch' || k === 'aspen' ? '#e8e4dc' : '#5a4331'; g.fillRect(20, 24, 4, 16); g.fillStyle = col; g.beginPath(); g.arc(22, 18, 13, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(18, 13, 6, 0, 7); g.fill(); }
      else { g.fillStyle = col; g.beginPath(); g.ellipse(22, 28, 14, 10, 0, 0, 7); g.fill(); if (k === 'gorse' || k === 'hibiscus' || k === 'flowers') { g.fillStyle = k === 'gorse' ? '#f0d030' : k === 'hibiscus' ? '#ff4060' : '#fff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(14 + (i * 7) % 18, 22 + (i * 5) % 10, 2, 0, 7); g.fill(); } } }
    } else if (def.cat === 'rock') { g.fillStyle = TREE_COLORS[k]; g.beginPath(); g.moveTo(8, 34); g.lineTo(14, 16); g.lineTo(26, 12); g.lineTo(36, 22); g.lineTo(38, 34); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(14, 16); g.lineTo(26, 12); g.lineTo(22, 22); g.fill(); }
    else {
      g.fillStyle = '#ddd'; g.font = '600 9px system-ui'; g.textAlign = 'center';
      const glyph = { bench: '🪑', washer: '🧽', bin: '🗑️', sign: '🪧', cart: '🛺', shelter: '⛺', bridge: '🌉', fence: '🚧', wall: '🧱', post: '📍' }[k] || '◆';
      g.font = '22px system-ui'; g.fillText(glyph, 22, 30);
    }
  }
  c.className = 'tr-ic';
  return c;
}
void routeLength; void distToSeg; void AREA_TYPES; void promptDialog;
