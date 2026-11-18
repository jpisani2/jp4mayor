// Menu screens: home, holes library, courses, stats, settings.
import * as THREE from 'three';
import { CLIMATES, scoreName, TEE_SETS } from '../core/data.js';
import { generateHole, emptyHole, holePar, holeYards, normalizeHole, defaultTee } from '../core/hole.js';
import { compileHole } from '../core/compile.js';
import { renderThumb } from '../core/painter.js';
import { db, getSettings, saveSettings, storageInfo, exportAll, importAll, requestPersist, DEFAULT_SETTINGS } from '../core/store.js';
import { encodeHole, encodeCourse, decodePayload, shareLink } from '../core/share.js';
import { applyVolumes, sfx, audioUnlock } from '../core/audio.js';
import { uid, M2YD, mulberry32 } from '../core/util.js';
import { h, icon, btn, modal, toast, confirmDialog, promptDialog, segmented, slider, toggle } from './ui.js';
import { buildScene, to3 } from '../game/scene.js';
import { setView, applyQuality, engine } from '../game/engine.js';

let app = null;
export function initScreens(api) { app = api; }

function screen(cls, ...kids) {
  const el = h('div', { class: `screen ${cls}` }, ...kids);
  const root = document.getElementById('app');
  root.querySelectorAll('.screen').forEach((s) => s.remove());
  if (cls !== 'home') setView(null); // menus are opaque: stop rendering 3D behind them
  root.append(el);
  setTimeout(() => el.classList.add('in'), 16);
  return el;
}
function header(title, onBack, right) {
  return h('div', { class: 'scr-head' }, h('button', { class: 'hbtn', onclick: () => { sfx.click(); onBack(); } }, icon('back')), h('h2', {}, title), right || h('span'));
}
const thumbCache = new Map();
function thumb(hole, w = 150, hgt = 210) {
  const key = hole.id + ':' + hole.updated + ':' + w;
  if (!thumbCache.has(key)) thumbCache.set(key, renderThumb(hole, w, hgt, { dpr: 2 }).toDataURL('image/jpeg', 0.82));
  return h('img', { class: 'thumb', src: thumbCache.get(key), alt: '' });
}
const units = () => getSettings().units;
const yd = (hole) => `${holeYards(hole, units())}${units() === 'm' ? 'm' : 'y'}`;

// Home background ---------------------------------------------------------------------
let homeBg = null, homeBuilding = false;
async function startHomeBackground() {
  if (homeBg) { setView(homeBg.view); return; }
  if (homeBuilding) return;
  homeBuilding = true;
  try { await buildHomeBackground(); } finally { homeBuilding = false; }
}
async function buildHomeBackground() {
  const holes = (await db.all('holes')).filter((h0) => h0.status === 'saved').sort((a, b) => b.updated - a.updated);
  const hole = holes[0] ? normalizeHole(holes[0]) : generateHole({ par: 4, climate: ['parkland', 'desert', 'tropical', 'alpine', 'autumn', 'links'][new Date().getDate() % 6], seed: 20240 + new Date().getDate() });
  hole.time = hole.time === 'midday' ? 'afternoon' : hole.time;
  await new Promise((r) => setTimeout(r, 60));
  const world = compileHole(hole);
  const sc = buildScene(world, { quality: engine.quality === 'high' ? 'medium' : engine.quality, wind: { x: 1, y: 2 } });
  sc.golfer.group.visible = false; sc.ball.visible = false; sc.ballShadow.visible = false; sc.target.visible = false;
  const cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 9000);
  const pin = world.pin, tee = defaultTee(hole)?.spot || [0, 0];
  const mid = [(pin.x + tee[0]) / 2, (pin.y + tee[1]) / 2];
  const len = Math.hypot(pin.x - tee[0], pin.y - tee[1]);
  const view = {
    scene: sc.scene, camera: cam,
    update: (dt, t) => {
      const a = t * 0.035;
      const r = len * 0.62;
      const cx = mid[0] + Math.sin(a) * r, cy = mid[1] - Math.cos(a) * r;
      cam.position.copy(to3(cx, cy, world.heightAt(cx, cy) + 38 + Math.sin(t * 0.1) * 6));
      cam.lookAt(to3(mid[0], mid[1] + len * 0.1, world.heightAt(mid[0], mid[1])));
      sc.update(dt, t, cam, to3(mid[0], mid[1], 0));
    },
  };
  homeBg = { view, sc };
  if (document.querySelector('.screen.home')) setView(view);
}
export function disposeHomeBg() { if (homeBg) { homeBg.sc.dispose(); homeBg = null; } }

// Home --------------------------------------------------------------------------------
export async function showHome() {
  const rounds = (await db.all('rounds')).filter((r) => !r.complete).sort((a, b) => b.updated - a.updated);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const el = screen('home',
    h('div', { class: 'home-shade' }),
    h('div', { class: 'logo' }, h('div', { class: 'logo-mark' }, h('span', { class: 'lm-flag' }), h('span', { class: 'lm-ball' })),
      h('h1', {}, 'FAIRWAY', h('b', {}, 'FORGE')), h('p', {}, 'Design it. Play it. Master it.')),
    h('div', { class: 'home-actions' },
      rounds[0] ? h('button', { class: 'resume-card', onclick: () => resumeRound(rounds[0]) }, h('b', {}, 'Resume round'), h('span', {}, `${rounds[0].courseName} · hole ${rounds[0].scores.filter(Boolean).length + 1} of ${rounds[0].holeIds.length}`)) : null,
      h('div', { class: 'big-row' },
        h('button', { class: 'big-btn play', onclick: () => { sfx.click(); playMenu(); } }, icon('play'), h('b', {}, 'Play'), h('span', {}, 'Holes, courses & quick rounds')),
        h('button', { class: 'big-btn design', onclick: () => { sfx.click(); newHoleFlow(); } }, icon('edit'), h('b', {}, 'Design'), h('span', {}, 'Build a new hole'))),
      h('div', { class: 'small-row' },
        h('button', { class: 'sm-btn', onclick: () => { sfx.click(); showLibrary(); } }, icon('flag'), h('span', {}, 'My Holes')),
        h('button', { class: 'sm-btn', onclick: () => { sfx.click(); showCourses(); } }, icon('map'), h('span', {}, 'Courses')),
        h('button', { class: 'sm-btn', onclick: () => { sfx.click(); showStats(); } }, icon('chart'), h('span', {}, 'Stats')),
        h('button', { class: 'sm-btn', onclick: () => { sfx.click(); showSettings(); } }, icon('gear'), h('span', {}, 'Settings')))),
    !standalone ? h('div', { class: 'install-tip' }, h('b', {}, 'Install for the full experience'), h('span', {}, 'In Safari tap Share → “Add to Home Screen”. Your holes, courses and history are saved inside the installed app.')) : null);
  el.addEventListener('pointerdown', () => audioUnlock(), { once: true });
  startHomeBackground();
  if (homeBg) setView(homeBg.view);
}

// Play menu ----------------------------------------------------------------------------
async function playMenu() {
  const holes = (await db.all('holes')).map(normalizeHole);
  const saved = holes.filter((x) => x.status === 'saved');
  const courses = await db.all('courses');
  const v = await modal({
    title: 'Play', cls: 'sheet',
    body: h('div', { class: 'menu-list' },
      menuItem('dice', 'Quick Play', 'A fresh generated hole in any climate', 'quick'),
      menuItem('flag', 'Play a Hole', `${holes.length} hole${holes.length === 1 ? '' : 's'} designed · ${saved.length} in collection`, 'hole', !holes.length),
      menuItem('map', 'Play a Course', `${courses.length} course${courses.length === 1 ? '' : 's'}`, 'course', !courses.length),
      menuItem('star', 'Random Round', 'Play 3, 6 or 9 holes from your collection', 'random', saved.length < 3)),
  });
  if (v === 'quick') quickPlay();
  else if (v === 'hole') showLibrary(true);
  else if (v === 'course') showCourses(true);
  else if (v === 'random') randomRound(saved);
}
function menuItem(ic, title, sub, value, disabled) {
  return h('button', { class: `menu-item ${disabled ? 'disabled' : ''}`, onclick: (e) => { if (disabled) return; sfx.click(); e.currentTarget.closest('.modal-wrap')._close(value); } }, icon(ic), h('div', {}, h('b', {}, title), h('span', {}, sub)));
}
async function quickPlay() {
  const sel = await pickClimateAndPar('Quick Play', 'Generate & Play');
  if (!sel) return;
  const hole = generateHole({ par: sel.par, climate: sel.climate });
  hole.name = hole.name;
  await db.put('holes', hole);
  app.play([hole], {});
}
async function randomRound(saved) {
  const n = await modal({ title: 'Random Round', body: h('p', {}, 'Holes are drawn at random from your collection.'), actions: [3, 6, 9].filter((k) => k <= saved.length).map((k) => ({ label: `${k} holes`, value: k, cls: 'primary' })).concat([{ label: 'Cancel', value: null, cls: 'ghost' }]) });
  if (!n) return;
  const pick = [...saved].sort(() => Math.random() - 0.5).slice(0, n);
  startRound({ id: 'random', name: 'Random Round', holes: pick.map((x) => x.id) }, pick);
}
async function pickClimateAndPar(title, okLabel, withMode = false) {
  let climate = 'parkland', par = 4, mode = 'generate';
  const grid = h('div', { class: 'climate-grid' }, Object.entries(CLIMATES).map(([k, c]) => h('button', { class: `cl-card cl-${k} ${k === climate ? 'on' : ''}`, onclick: (e) => { climate = k; grid.querySelectorAll('.cl-card').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sfx.tick(); } }, h('b', {}, c.name), h('span', {}, c.blurb))));
  const body = h('div', {}, h('h4', {}, 'Climate'), grid, h('h4', {}, 'Par'), segmented([[3, 'Par 3'], [4, 'Par 4'], [5, 'Par 5']], par, (v) => { par = v; }),
    withMode ? h('div', {}, h('h4', {}, 'Start from'), segmented([['generate', 'Generated layout'], ['blank', 'Simple template']], mode, (v) => { mode = v; }), h('p', { class: 'note' }, 'Generated layouts are fully editable: every bunker, tree and slope can be changed.')) : null);
  const v = await modal({ title, body, cls: 'sheet', actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: okLabel, value: 'ok', cls: 'primary' }] });
  return v === 'ok' ? { climate, par, mode } : null;
}
export async function newHoleFlow() {
  const sel = await pickClimateAndPar('New Hole', 'Start Designing', true);
  if (!sel) return;
  const hole = sel.mode === 'blank' ? emptyHole(sel.par, sel.climate) : generateHole({ par: sel.par, climate: sel.climate });
  await db.put('holes', hole);
  app.edit(hole);
}

// Library ---------------------------------------------------------------------------------
export async function showLibrary(playMode = false, tab = 'saved') {
  const holes = (await db.all('holes')).map(normalizeHole).sort((a, b) => b.updated - a.updated);
  const plays = await db.all('plays');
  const best = {}, count = {};
  for (const p of plays) { best[p.holeId] = Math.min(best[p.holeId] ?? 99, p.strokes); count[p.holeId] = (count[p.holeId] || 0) + 1; }
  const list = h('div', { class: 'card-grid' });
  const render = () => {
    list.innerHTML = '';
    const items = holes.filter((x) => (tab === 'saved' ? x.status === 'saved' : x.status !== 'saved'));
    if (!items.length) list.append(h('div', { class: 'empty' }, tab === 'saved' ? 'No holes in your collection yet. Design a hole, play it, and tap “Add to Collection” when you love it.' : 'No drafts. Tap + to design a hole.'));
    for (const hole of items) {
      const par = holePar(hole);
      list.append(h('button', { class: 'hole-card', onclick: () => holeActions(hole, playMode) },
        thumb(hole),
        h('div', { class: 'hcd-info' }, h('b', {}, hole.name), h('span', {}, `Par ${par} · ${yd(hole)} · ${CLIMATES[hole.climate].name}`),
          h('span', { class: 'hcd-stat' }, count[hole.id] ? `Best ${best[hole.id]} (${scoreName(best[hole.id], par)}) · ${count[hole.id]} play${count[hole.id] > 1 ? 's' : ''}` : 'Not played yet')),
        hole.status === 'saved' ? h('i', { class: 'hcd-star', html: icon('starFill').innerHTML }) : null));
    }
  };
  const tabs = segmented([['saved', `★ Collection (${holes.filter((x) => x.status === 'saved').length})`], ['draft', `Drafts (${holes.filter((x) => x.status !== 'saved').length})`]], tab, (v) => { tab = v; render(); });
  screen('lib',
    header(playMode ? 'Choose a Hole' : 'My Holes', () => showHome(), h('div', { class: 'head-btns' },
      h('button', { class: 'hbtn', title: 'Import', onclick: () => importCode() }, icon('download')),
      h('button', { class: 'hbtn', title: 'New', onclick: () => newHoleFlow() }, icon('plus')))),
    h('div', { class: 'scr-body' }, tabs, list));
  render();
}
async function holeActions(hole, playMode) {
  if (playMode) { app.play([hole], {}); return; }
  const v = await modal({
    title: hole.name, cls: 'sheet',
    body: h('div', {}, h('div', { class: 'act-thumb' }, thumb(hole, 220, 260)),
      h('div', { class: 'menu-list' },
        menuItem('play', 'Play', `Par ${holePar(hole)} · ${yd(hole)}`, 'play'),
        menuItem('edit', 'Edit Design', 'Open in the designer', 'edit'),
        menuItem(hole.status === 'saved' ? 'star' : 'starFill', hole.status === 'saved' ? 'Remove from Collection' : 'Add to Collection', hole.status === 'saved' ? 'Move back to drafts' : 'Make it available for courses', 'star'),
        menuItem('copy', 'Duplicate', 'Make a copy to riff on', 'dup'),
        menuItem('share', 'Share', 'Get a code or link for a friend', 'share'),
        menuItem('trash', 'Delete', 'Permanently remove this hole', 'del'))),
  });
  if (v === 'play') app.play([hole], {});
  else if (v === 'edit') app.edit(hole);
  else if (v === 'star') { hole.status = hole.status === 'saved' ? 'draft' : 'saved'; hole.updated = Date.now(); await db.put('holes', hole); toast(hole.status === 'saved' ? 'Added to collection ★' : 'Moved to drafts'); showLibrary(false, hole.status === 'saved' ? 'saved' : 'draft'); }
  else if (v === 'dup') { const c = JSON.parse(JSON.stringify(hole)); c.id = uid(); c.name = `${hole.name} II`; c.status = 'draft'; c.created = c.updated = Date.now(); await db.put('holes', c); toast('Duplicated to drafts'); showLibrary(false, 'draft'); }
  else if (v === 'share') shareHole(hole);
  else if (v === 'del') { if (await confirmDialog('Delete hole?', `“${hole.name}” will be permanently deleted from this device. Its play history is kept.`, 'Delete', true)) { await db.del('holes', hole.id); toast('Deleted'); showLibrary(false, hole.status === 'saved' ? 'saved' : 'draft'); } }
}
async function shareHole(hole) {
  const code = await encodeHole(hole);
  shareCodeModal(`Share “${hole.name}”`, code);
}
function shareCodeModal(title, code) {
  const link = shareLink(code);
  const ta = h('textarea', { class: 'field code', readonly: true }, code);
  modal({
    title, cls: 'sheet',
    body: h('div', {}, h('p', { class: 'note' }, 'Anyone with Fairway Forge can import this. Opening the link imports it automatically.'), ta,
      h('div', { class: 'sh-actions' },
        btn('Copy code', async () => { try { await navigator.clipboard.writeText(code); toast('Code copied'); } catch { ta.select(); document.execCommand('copy'); toast('Code copied'); } }, 'ghost'),
        btn('Copy link', async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch { toast('Copy failed'); } }, 'ghost'),
        navigator.share ? btn('Share…', () => navigator.share({ title: 'Fairway Forge hole', url: link }).catch(() => {}), 'primary') : null)),
    actions: [{ label: 'Done', value: 'x', cls: 'primary' }],
  });
}
export async function importCode(prefill = '') {
  const ta = h('textarea', { class: 'field code', placeholder: 'Paste a FF1… code or link' }, prefill);
  const v = await modal({ title: 'Import Hole or Course', body: ta, cls: 'sheet', actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Import', value: 'ok', cls: 'primary' }] });
  if (v !== 'ok') return;
  try { await importPayload(ta.value); } catch (e) { toast(e.message || 'Could not import'); }
}
export async function importPayload(text) {
  const data = await decodePayload(text);
  if (data.t === 'hole') {
    const hole = normalizeHole({ ...data.hole, id: uid(), status: 'saved', created: Date.now(), updated: Date.now() });
    await db.put('holes', hole);
    toast(`Imported “${hole.name}” ★`);
    showLibrary(false, 'saved');
  } else if (data.t === 'course') {
    const idMap = {};
    for (const hh of data.holes) { const nid = uid(); idMap[hh.id] = nid; await db.put('holes', normalizeHole({ ...hh, id: nid, status: 'saved', created: Date.now(), updated: Date.now() })); }
    const course = { id: uid(), name: data.course.name, holes: data.course.holes.map((i) => idMap[i]).filter(Boolean), created: Date.now(), updated: Date.now() };
    await db.put('courses', course);
    toast(`Imported course “${course.name}”`);
    showCourses();
  }
}

// Courses -------------------------------------------------------------------------------
export async function showCourses(playMode = false) {
  const courses = (await db.all('courses')).sort((a, b) => b.updated - a.updated);
  const holes = new Map((await db.all('holes')).map((x) => [x.id, normalizeHole(x)]));
  const rounds = await db.all('rounds');
  const saved = [...holes.values()].filter((x) => x.status === 'saved');
  const list = h('div', { class: 'course-list' });
  if (!courses.length) list.append(h('div', { class: 'empty' }, saved.length >= 3 ? 'Build your first course from the holes in your collection.' : `Courses are built from holes in your collection. You have ${saved.length} — add at least 3 to create a course (9 or 18 for a full round).`));
  for (const c of courses) {
    const hs = c.holes.map((id) => holes.get(id)).filter(Boolean);
    const par = hs.reduce((a, x) => a + holePar(x), 0);
    const len = hs.reduce((a, x) => a + holeYards(x, units()), 0);
    const done = rounds.filter((r) => r.courseId === c.id && r.complete);
    const bestR = done.length ? Math.min(...done.map((r) => r.scores.reduce((a, s) => a + s.strokes, 0))) : null;
    list.append(h('button', { class: 'course-card', onclick: () => courseActions(c, hs, playMode) },
      h('div', { class: 'cc-strip' }, hs.slice(0, 6).map((x) => thumb(x, 70, 100))),
      h('div', { class: 'cc-info' }, h('b', {}, c.name), h('span', {}, `${hs.length} holes · Par ${par} · ${len.toLocaleString()}${units() === 'm' ? 'm' : 'y'}`), h('span', { class: 'hcd-stat' }, bestR ? `Best round ${bestR} (${bestR - par >= 0 ? '+' : ''}${bestR - par}) · ${done.length} played` : 'Not played yet'))));
  }
  screen('lib courses',
    header(playMode ? 'Choose a Course' : 'Courses', () => showHome(), h('button', { class: 'hbtn', onclick: () => { if (saved.length < 3) { toast('Add at least 3 holes to your collection first'); return; } courseBuilder(null); } }, icon('plus'))),
    h('div', { class: 'scr-body' }, list));
}
async function courseActions(c, hs, playMode) {
  if (playMode) { startRound(c, hs); return; }
  const v = await modal({ title: c.name, cls: 'sheet', body: h('div', { class: 'menu-list' },
    menuItem('play', 'Play Round', `${hs.length} holes`, 'play'), menuItem('edit', 'Edit Course', 'Change holes and order', 'edit'),
    menuItem('card', 'Scorecards', 'Past rounds on this course', 'cards'), menuItem('share', 'Share Course', 'All holes in one code', 'share'), menuItem('trash', 'Delete', 'Remove the course (holes are kept)', 'del')) });
  if (v === 'play') startRound(c, hs);
  else if (v === 'edit') courseBuilder(c);
  else if (v === 'share') shareCodeModal(`Share “${c.name}”`, await encodeCourse(c, hs));
  else if (v === 'cards') courseCards(c, hs);
  else if (v === 'del') { if (await confirmDialog('Delete course?', 'Your holes stay in your collection.', 'Delete', true)) { await db.del('courses', c.id); showCourses(); } }
}
async function courseCards(c, hs) {
  const rounds = (await db.all('rounds')).filter((r) => r.courseId === c.id).sort((a, b) => b.updated - a.updated);
  const body = h('div', { class: 'round-list' });
  if (!rounds.length) body.append(h('p', { class: 'note' }, 'No rounds yet.'));
  for (const r of rounds) {
    const sc = r.scores.filter(Boolean);
    const tot = sc.reduce((a, s) => a + s.strokes, 0), tp = sc.reduce((a, s) => a + s.strokes - s.par, 0);
    body.append(h('div', { class: 'round-row' }, h('b', {}, new Date(r.startedAt).toLocaleDateString()), h('span', {}, `${tot} (${tp === 0 ? 'E' : tp > 0 ? '+' + tp : tp})${r.complete ? '' : ' · in progress'}`),
      h('div', { class: 'mini-scores' }, sc.map((s) => h('i', { class: `d${Math.max(-2, Math.min(2, s.strokes - s.par))}` }, s.strokes)))));
  }
  modal({ title: `${c.name} · Scorecards`, body, cls: 'sheet', actions: [{ label: 'Close', value: 1, cls: 'primary' }] });
  void hs;
}
async function courseBuilder(course) {
  const holes = (await db.all('holes')).map(normalizeHole).filter((x) => x.status === 'saved');
  const byId = new Map(holes.map((x) => [x.id, x]));
  const c = course ? { ...course, holes: course.holes.filter((id) => byId.has(id)) } : { id: uid(), name: 'My Course', holes: [], created: Date.now() };
  const nameIn = h('input', { class: 'field', value: c.name, maxlength: 40 });
  const sel = h('div', { class: 'cb-sel' }), avail = h('div', { class: 'cb-avail' }), totals = h('div', { class: 'cb-tot' });
  const render = () => {
    sel.innerHTML = ''; avail.innerHTML = '';
    c.holes.forEach((id, i) => {
      const x = byId.get(id);
      sel.append(h('div', { class: 'cb-row' }, h('span', { class: 'cb-n' }, i + 1), thumb(x, 40, 56), h('div', { class: 'cb-name' }, h('b', {}, x.name), h('span', {}, `Par ${holePar(x)} · ${yd(x)}`)),
        h('button', { class: 'hbtn sm', onclick: () => { if (i > 0) { [c.holes[i - 1], c.holes[i]] = [c.holes[i], c.holes[i - 1]]; render(); } } }, '↑'),
        h('button', { class: 'hbtn sm', onclick: () => { if (i < c.holes.length - 1) { [c.holes[i + 1], c.holes[i]] = [c.holes[i], c.holes[i + 1]]; render(); } } }, '↓'),
        h('button', { class: 'hbtn sm', onclick: () => { c.holes.splice(i, 1); render(); } }, icon('x'))));
    });
    if (!c.holes.length) sel.append(h('p', { class: 'note' }, 'Tap holes below to add them in playing order.'));
    for (const x of holes) {
      const used = c.holes.filter((id) => id === x.id).length;
      avail.append(h('button', { class: `cb-pick ${used ? 'used' : ''}`, onclick: () => { if (c.holes.length >= 18) { toast('18 holes max'); return; } c.holes.push(x.id); sfx.tick(); render(); } }, thumb(x, 64, 90), h('b', {}, x.name), h('span', {}, `Par ${holePar(x)}`), used ? h('em', {}, `×${used}`) : null));
    }
    const hs = c.holes.map((id) => byId.get(id));
    const par = hs.reduce((a, x) => a + holePar(x), 0), len = hs.reduce((a, x) => a + holeYards(x, units()), 0);
    totals.textContent = `${hs.length} holes · Par ${par} · ${len.toLocaleString()}${units() === 'm' ? ' m' : ' yds'}${hs.length === 9 || hs.length === 18 ? ' · regulation' : ''}`;
  };
  render();
  const v = await modal({ title: course ? 'Edit Course' : 'New Course', cls: 'sheet tall', body: h('div', { class: 'cb' }, h('label', { class: 'row' }, h('span', {}, 'Name'), nameIn), totals, h('h4', {}, 'Course routing'), sel, h('h4', {}, 'Your collection'), avail), actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save Course', value: 'ok', cls: 'primary' }] });
  if (v !== 'ok') return;
  if (c.holes.length < 3) { toast('A course needs at least 3 holes'); return; }
  c.name = nameIn.value.trim() || 'My Course'; c.updated = Date.now();
  await db.put('courses', c);
  toast('Course saved');
  showCourses();
}
async function startRound(course, hs) {
  const round = { id: uid(), courseId: course.id, courseName: course.name, holeIds: hs.map((x) => x.id), scores: [], startedAt: Date.now(), updated: Date.now(), complete: false };
  if (course.id !== 'random') await db.put('rounds', round);
  app.play(hs, { round: course.id === 'random' ? { ...round, courseId: null } : round });
}
async function resumeRound(r) {
  const holes = new Map((await db.all('holes')).map((x) => [x.id, normalizeHole(x)]));
  const hs = r.holeIds.map((id) => holes.get(id));
  if (hs.some((x) => !x)) { toast('Some holes from this round were deleted'); r.complete = true; await db.put('rounds', r); showHome(); return; }
  const idx = r.scores.filter(Boolean).length;
  app.play(hs, { round: r, index: idx });
}

// Stats ---------------------------------------------------------------------------------
export async function showStats() {
  const plays = (await db.all('plays')).sort((a, b) => b.date - a.date);
  const rounds = (await db.all('rounds')).filter((r) => r.complete);
  const u = units();
  const n = plays.length;
  const cnt = (f) => plays.filter(f).length;
  const fwP = plays.filter((p) => p.fairway != null);
  const longest = Math.max(0, ...plays.map((p) => p.drive || 0));
  const avgToPar = n ? plays.reduce((a, p) => a + p.strokes - p.par, 0) / n : 0;
  const tile = (v, k) => h('div', { class: 'stat-tile' }, h('b', {}, v), h('span', {}, k));
  const recent = h('div', { class: 'recent' });
  for (const p of plays.slice(0, 40)) {
    const d = p.strokes - p.par;
    recent.append(h('div', { class: 'rec-row' }, h('i', { class: `sc-s d${Math.max(-2, Math.min(2, d))}` }, p.strokes), h('div', {}, h('b', {}, p.holeName), h('span', {}, `Par ${p.par} · ${scoreName(p.strokes, p.par)} · ${p.putts} putt${p.putts === 1 ? '' : 's'}`)), h('em', {}, new Date(p.date).toLocaleDateString())));
  }
  screen('lib stats', header('Stats', () => showHome()),
    h('div', { class: 'scr-body' },
      n ? h('div', { class: 'stat-grid' },
        tile(n, 'Holes played'), tile(rounds.length, 'Rounds'), tile((avgToPar >= 0 ? '+' : '') + avgToPar.toFixed(2), 'Avg vs par'),
        tile(cnt((p) => p.strokes === 1), 'Holes in one'), tile(cnt((p) => p.strokes - p.par <= -2 && p.strokes > 1), 'Eagles+'), tile(cnt((p) => p.strokes - p.par === -1), 'Birdies'),
        tile(cnt((p) => p.strokes === p.par), 'Pars'), tile(fwP.length ? `${Math.round(fwP.filter((p) => p.fairway).length / fwP.length * 100)}%` : '–', 'Fairways hit'),
        tile(`${Math.round(cnt((p) => p.gir) / n * 100)}%`, 'Greens in reg'), tile((plays.reduce((a, p) => a + p.putts, 0) / n).toFixed(1), 'Putts / hole'),
        tile(longest ? (u === 'm' ? `${Math.round(longest)}m` : `${Math.round(longest * M2YD)}y`) : '–', 'Longest drive'), tile(plays.reduce((a, p) => a + (p.penalties || 0), 0), 'Penalties'))
        : h('div', { class: 'empty' }, 'Play a hole to start building your stats.'),
      n ? h('h4', {}, 'Recent') : null, recent));
}

// Settings -------------------------------------------------------------------------------
export async function showSettings() {
  const s = getSettings();
  const set = async (patch) => { await saveSettings(patch); applyVolumes(); };
  const info = await storageInfo();
  const swatches = (key, colors) => h('div', { class: 'swatches' }, colors.map((c) => h('button', { class: `sw ${getSettings().golfer[key] === c ? 'on' : ''}`, style: { background: c }, onclick: (e) => { const g = { ...getSettings().golfer, [key]: c }; set({ golfer: g }); e.currentTarget.parentElement.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { await importAll(JSON.parse(await f.text()), true); toast('Backup restored'); showSettings(); } catch (e) { toast(e.message || 'Import failed'); }
  } });
  screen('lib settings', header('Settings', () => showHome()),
    h('div', { class: 'scr-body' },
      h('div', { class: 'sec' }, h('h4', {}, 'Gameplay'),
        h('div', { class: 'row' }, h('span', {}, 'Swing control'), segmented([['swipe', 'Swipe'], ['meter', '3-Tap Meter']], s.swing, (v) => set({ swing: v }))),
        h('p', { class: 'note' }, 'Swipe: pull down to load power, flick straight up. Meter: tap to start, tap to set power, tap in the sweet spot.'),
        h('div', { class: 'row' }, h('span', {}, 'Difficulty'), segmented([['beginner', 'Beginner'], ['amateur', 'Amateur'], ['pro', 'Pro']], s.difficulty, (v) => set({ difficulty: v }))),
        h('div', { class: 'row' }, h('span', {}, 'Player power'), segmented([[0.88, 'Short'], [1, 'Average'], [1.1, 'Long'], [1.2, 'Tour']], s.power, (v) => set({ power: v }))),
        h('div', { class: 'row' }, h('span', {}, 'Preferred tees'), segmented(Object.entries(TEE_SETS).map(([k, v]) => [k, v.label]), s.tee, (v) => set({ tee: v }))),
        h('div', { class: 'row' }, h('span', {}, 'Units'), segmented([['y', 'Yards / feet'], ['m', 'Meters']], s.units, (v) => set({ units: v }))),
        toggle('Shot tracer', s.showTracer, (v) => set({ showTracer: v })),
        toggle('Hole flyover intro', s.intro, (v) => set({ intro: v })),
        toggle('Camera shake on drives', s.camShake, (v) => set({ camShake: v }))),
      h('div', { class: 'sec' }, h('h4', {}, 'Your Golfer'),
        h('div', { class: 'row' }, h('span', {}, 'Shirt'), swatches('shirt', ['#1f6fd1', '#d23a2e', '#2e9a4a', '#f2f2f2', '#1c1c1c', '#f0a020', '#8a3ad0', '#ff6ab0'])),
        h('div', { class: 'row' }, h('span', {}, 'Pants'), swatches('pants', ['#2b2f38', '#e8e2d0', '#5a6a8a', '#f2f2f2', '#3a4a2a', '#8a6a4a'])),
        h('div', { class: 'row' }, h('span', {}, 'Cap'), swatches('cap', ['#ffffff', '#1c1c1c', '#1f6fd1', '#d23a2e', '#2e9a4a', '#f0c020'])),
        h('div', { class: 'row' }, h('span', {}, 'Skin'), swatches('skin', ['#f3d0b5', '#e0ac85', '#c68a5e', '#9a6440', '#6a4228']))),
      h('div', { class: 'sec' }, h('h4', {}, 'Graphics & Sound'),
        h('div', { class: 'row' }, h('span', {}, 'Graphics'), segmented([['auto', 'Auto'], ['low', 'Battery'], ['medium', 'Balanced'], ['high', 'Ultra']], s.quality, async (v) => { await set({ quality: v }); applyQuality(); })),
        slider({ label: 'Master volume', min: 0, max: 1, step: 0.05, value: s.volume, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ volume: v }) }),
        slider({ label: 'Ambience', min: 0, max: 1, step: 0.05, value: s.ambience, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ ambience: v }) }),
        slider({ label: 'Effects', min: 0, max: 1, step: 0.05, value: s.sfx, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ sfx: v }) }),
        toggle('Haptics', s.haptics, (v) => set({ haptics: v }))),
      h('div', { class: 'sec' }, h('h4', {}, 'Your Data'),
        h('p', { class: 'note' }, `Everything is stored on this device inside the app${info.persisted ? ' with persistent storage enabled' : ''}. ${info.usage ? `Using ${(info.usage / 1048576).toFixed(1)} MB.` : ''} Export a backup now and then to keep it safe or move it to another device.`),
        h('div', { class: 'sh-actions' },
          btn(`${icon('upload').outerHTML}<span>Export backup</span>`, () => doExport(), 'ghost'),
          btn(`${icon('download').outerHTML}<span>Restore backup</span>`, () => fileIn.click(), 'ghost'),
          btn(`${icon('download').outerHTML}<span>Import code</span>`, () => importCode(), 'ghost'),
          !info.persisted ? btn('Protect storage', async () => { const ok = await requestPersist(); toast(ok ? 'Storage protected' : 'Install to Home Screen to protect storage'); showSettings(); }, 'ghost') : null),
        fileIn,
        btn('Reset settings', async () => { await saveSettings({ ...DEFAULT_SETTINGS }); applyVolumes(); toast('Settings reset'); showSettings(); }, 'ghost sm'),
        btn('Erase all data', async () => { if (await confirmDialog('Erase everything?', 'This permanently deletes every hole, course and score on this device. Export a backup first if you want to keep them.', 'Erase', true)) { for (const st of ['holes', 'courses', 'plays', 'rounds']) await db.clear(st); disposeHomeBg(); toast('All data erased'); showHome(); } }, 'danger sm')),
      h('p', { class: 'ver' }, 'Fairway Forge · v1.0')));
}
async function doExport() {
  const data = await exportAll();
  const json = JSON.stringify(data);
  const name = `fairway-forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Fairway Forge backup' }); return; } catch { /* fall through */ }
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a); a.click(); a.remove();
  toast('Backup saved');
}
void promptDialog; void mulberry32; void btn;
