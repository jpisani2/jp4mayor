/* Clock Out — the map: a hand-drawn SVG of the area's roads, the venue markers, pan and zoom,
   and the planner's route. lat/lng become x/y with a straight linear conversion inside CO.config.MAP. */
(function(CO){
"use strict";
const {MAP, AREAS} = CO.config;
const {$, reducedMotion} = CO.util;
const {state, favs, visible} = CO.state;
const {byId} = CO.venues;

const {W, H} = MAP;
const X = lng => (lng - MAP.lng0)/(MAP.lng1 - MAP.lng0)*W;
const Y = lat => (MAP.lat1 - lat)/(MAP.lat1 - MAP.lat0)*H;
const inBounds = ll => ll[0] > MAP.lat0 && ll[0] < MAP.lat1 && ll[1] > MAP.lng0 && ll[1] < MAP.lng1;

/* ---------- base map data ---------- */
/* east–west roads: [name, lat, west end lng?, east end lng?] (no ends = full width) */
const EW=[["10 Mile",42.4695],["9 Mile",42.4550],["8 Mile",42.4425],["7 Mile",42.4275],["6 Mile",42.4135],["5 Mile",42.3995],["Schoolcraft · I-96",42.3845],["Plymouth",42.3685],["Joy",42.3570],["Warren",42.3410],["Ford",42.3265],["Cherry Hill",42.3105],["Van Born",42.2697,-83.452,-83.180],["Ecorse",42.2565,-83.452,-83.140],["Goddard",42.2270,-83.452,-83.160],["Northline",42.2115,-83.452,-83.175],["Eureka",42.1975,-83.452,-83.146],["Pennsylvania",42.1850,-83.400,-83.160],["Sibley",42.1700,-83.420,-83.160],["King",42.1558,-83.300,-83.170],["West Rd",42.1400,-83.285,-83.175],["Van Horn",42.1265,-83.300,-83.178]];
/* north–south roads: [name, lng, south end lat?, north end lat?] */
const NSR=[["Haggerty",-83.4335,42.26],["Newburgh",-83.4125,42.26],["Wayne",-83.3877,42.19,42.345],["Farmington",-83.3735,42.27],["Merriman",-83.3545,42.18],["Middlebelt",-83.3335,42.15],["Inkster",-83.3130,42.18],["Beech Daly",-83.2960,42.19],["Telegraph",-83.2745],["Pardee",-83.2575,42.19,42.28],["Southfield",-83.2190,42.255],["Greenfield",-83.1965,42.29],["Schaefer",-83.1800,42.275]];
/* diagonal roads and highways: [name, [[lat,lng], ...], label position [lat, lng, angle]?] */
const DIAG=[["Grand River",[[42.492,-83.452],[42.4700,-83.3970],[42.4650,-83.3760],[42.4338,-83.3016],[42.4254,-83.2787],[42.4077,-83.2349],[42.3950,-83.2035],[42.3870,-83.1851],[42.372,-83.150],[42.366,-83.122]]],["Michigan Ave",[[42.2765,-83.452],[42.2823,-83.3816],[42.2881,-83.3363],[42.2967,-83.2900],[42.3012,-83.2673],[42.3055,-83.2485],[42.3072,-83.2377],[42.3203,-83.1818],[42.328,-83.150],[42.333,-83.122]]],
 ["Fort St",[[42.300,-83.130],[42.2750,-83.1560],[42.2623,-83.1677],[42.2551,-83.1737],[42.2351,-83.1807],[42.2220,-83.1818],[42.2126,-83.1803],[42.1986,-83.1798],[42.1935,-83.1795],[42.1750,-83.1830],[42.1600,-83.1860],[42.1460,-83.1873],[42.1300,-83.1900],[42.1100,-83.1920]],[42.232,-83.1812,-87]],
 ["Jefferson · Biddle",[[42.2900,-83.1240],[42.2752,-83.1329],[42.2580,-83.1389],[42.2424,-83.1446],[42.2290,-83.1482],[42.2041,-83.1485],[42.1940,-83.1541],[42.1761,-83.1685],[42.1602,-83.1744],[42.1413,-83.1784],[42.1100,-83.1860]],[42.215,-83.1498,-89]],
 ["Dix · Dix-Toledo",[[42.3050,-83.1640],[42.2692,-83.1819],[42.2582,-83.1902],[42.2398,-83.1946],[42.2207,-83.1937],[42.2006,-83.2085],[42.1981,-83.2145],[42.1800,-83.2320],[42.1396,-83.2655],[42.1100,-83.2890]],[42.170,-83.2400,-50]],
 ["Allen Rd",[[42.2980,-83.1760],[42.2845,-83.1859],[42.2665,-83.2003],[42.2596,-83.2059],[42.2523,-83.2160],[42.2341,-83.2288],[42.2130,-83.2300],[42.1850,-83.2290],[42.1625,-83.2275],[42.1457,-83.2258],[42.1400,-83.2267],[42.1200,-83.2280]],[42.195,-83.2300,-90]]];
const HWY=[["I-75",[[42.3000,-83.1300],[42.2860,-83.1550],[42.2750,-83.1760],[42.2615,-83.1985],[42.2420,-83.2120],[42.2230,-83.2250],[42.1985,-83.2400],[42.1700,-83.2450],[42.1405,-83.2475],[42.1100,-83.2650]],[42.228,-83.2230,-55]]];
/* the Detroit River, as one polygon of [lat,lng] */
const WATER=[[42.320,-83.100],[42.300,-83.113],[42.285,-83.118],[42.270,-83.124],[42.255,-83.130],[42.240,-83.136],[42.225,-83.142],[42.205,-83.1440],[42.195,-83.1460],[42.185,-83.1520],[42.175,-83.1600],[42.160,-83.1670],[42.145,-83.1710],[42.130,-83.1760],[42.100,-83.1830],[42.100,-83.080],[42.320,-83.080]];
/* islands: [name, outline [[lat,lng], ...], label [lat, lng]] */
const ISLANDS=[["GROSSE ILE",[[42.172,-83.1500],[42.166,-83.1380],[42.150,-83.1300],[42.125,-83.1280],[42.100,-83.1350],[42.092,-83.1500],[42.100,-83.1640],[42.120,-83.1690],[42.140,-83.1655],[42.160,-83.1590]],[42.134,-83.1480]]];
/* city labels: [name, lat, lng, font size? (default 24)] */
const CITIES=[["FARMINGTON HILLS",42.486,-83.372],["FARMINGTON",42.452,-83.398],["LIVONIA",42.392,-83.392],["REDFORD",42.414,-83.300],["WEST DETROIT",42.398,-83.205],["GARDEN CITY",42.334,-83.352],["WESTLAND",42.298,-83.405],["DEARBORN HTS",42.352,-83.262],["DEARBORN",42.296,-83.212],["INKSTER",42.284,-83.318],["WAYNE",42.266,-83.398],["ALLEN PARK",42.2485,-83.2090,17],["TAYLOR",42.240,-83.300],["MELVINDALE",42.2865,-83.1700,17],["LINCOLN PARK",42.2320,-83.1920,17],["RIVER ROUGE",42.2830,-83.1420,17],["ECORSE",42.2490,-83.1520,17],["WYANDOTTE",42.2160,-83.1620,17],["SOUTHGATE",42.2080,-83.2100,17],["RIVERVIEW",42.1780,-83.2080,17],["TRENTON",42.1220,-83.2000,17],["WOODHAVEN",42.1195,-83.2450,17],["BROWNSTOWN",42.1430,-83.3300,17],["ROMULUS",42.2360,-83.4050,17],["METRO AIRPORT",42.2120,-83.3530,17]];
const FONT = "Barlow Condensed, Arial Narrow, sans-serif";

/* ---------- draw the base map ---------- */
const svg = $("map");
const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent){
  const e = document.createElementNS(SVGNS, tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(e);
  return e;
}
const pts = a => a.map(p => X(p[1]) + "," + Y(p[0])).join(" ");

/* layers, bottom to top: roads, road labels, route line, markers, route stops, selection */
const gBase = el("g", {});
const gRoads = el("g", {}, gBase);
const gLbl = el("g", {}, gBase);
const gPlan = el("g", {});
const gMark = el("g", {});

el("rect", {x:-3000, y:-3000, width:7000, height:7000, fill:"var(--mapbg)"}, gRoads);
el("polygon", {points:pts(WATER), fill:"var(--road)", opacity:.55}, gRoads);
ISLANDS.forEach(i => el("polygon", {points:pts(i[1]), fill:"var(--mapbg)", stroke:"var(--road-major)", "stroke-width":2}, gRoads));
CITIES.forEach(c => {
  const t = el("text", {x:X(c[2]), y:Y(c[1]), "text-anchor":"middle", fill:"var(--road-major)", "font-family":FONT, "font-weight":"700", "font-size":String(c[3] || 24), "letter-spacing":c[3] ? "2" : "3"}, gRoads);
  t.textContent = c[0];
});
EW.forEach(r => {
  const mile = /Mile/.test(r[0]);
  el("line", {x1:r[2] != null ? X(r[2]) : -3000, x2:r[3] != null ? X(r[3]) : 4000, y1:Y(r[1]), y2:Y(r[1]), stroke:mile ? "var(--road-major)" : "var(--road)", "stroke-width":mile ? 4 : 3}, gRoads);
});
NSR.forEach(r => el("line", {y1:r[3] != null ? Y(r[3]) : -3000, y2:r[2] != null ? Y(r[2]) : 4000, x1:X(r[1]), x2:X(r[1]), stroke:"var(--road)", "stroke-width":3}, gRoads));
DIAG.forEach(r => el("polyline", {points:pts(r[1]), fill:"none", stroke:"var(--road-major)", "stroke-width":5, "stroke-linejoin":"round"}, gRoads));
HWY.forEach(r => {
  el("polyline", {points:pts(r[1]), fill:"none", stroke:"var(--road-major)", "stroke-width":9, "stroke-linejoin":"round", opacity:.8}, gRoads);
  el("polyline", {points:pts(r[1]), fill:"none", stroke:"var(--mapbg)", "stroke-width":2.5, "stroke-linejoin":"round", "stroke-dasharray":"14 10"}, gRoads);
});
ISLANDS.forEach(i => {
  const t = el("text", {x:X(i[2][1]), y:Y(i[2][0]), "text-anchor":"middle", fill:"var(--road-major)", "font-family":FONT, "font-weight":"700", "font-size":"18", "letter-spacing":"2"}, gRoads);
  t.textContent = i[0];
});
{
  const x = X(-83.128), y = Y(42.205);
  const t = el("text", {x, y, "text-anchor":"middle", fill:"var(--roadlabel)", "font-family":FONT, "font-weight":"700", "font-size":"18", "letter-spacing":"4", transform:`rotate(-72 ${x} ${y})`}, gRoads);
  t.textContent = "DETROIT RIVER";
}

/* road labels are resized and moved on every zoom (see applyVB) so they stay readable and on screen */
const labels = [];
const labelAttrs = {fill:"var(--roadlabel)", "font-family":FONT, "font-weight":"600", "font-size":"17", "letter-spacing":"1"};
EW.forEach(r => {
  const t = el("text", {x:8, y:Y(r[1]) - 6, ...labelAttrs}, gLbl);
  t.textContent = r[0].toUpperCase();
  labels.push({t, kind:"ew", v:r[1], w0:r[2]});
});
DIAG.concat(HWY).forEach(r => {
  if(!r[2]) return;
  const t = el("text", {"text-anchor":"middle", ...labelAttrs}, gLbl);
  t.textContent = r[0].toUpperCase();
  labels.push({t, kind:"pt", v:r[2]});
});
NSR.forEach(r => {
  const t = el("text", {x:X(r[1]) + 5, y:H - 10, ...labelAttrs}, gLbl);
  t.textContent = r[0].toUpperCase();
  labels.push({t, kind:"ns", v:r[1], s0:r[2]});
});

const gPlanTop = el("g", {style:"pointer-events:none"});
const gSel = el("g", {style:"pointer-events:none;display:none"});
svg.appendChild(gPlan);
svg.appendChild(gMark);
svg.appendChild(gPlanTop);
svg.appendChild(gSel);
const selRing = el("circle", {class:"selring", fill:"none", stroke:"var(--ink)"}, gSel);
const selTag = el("text", {fill:"var(--ink)", stroke:"var(--mapbg)", "stroke-linejoin":"round", "paint-order":"stroke", "font-family":FONT, "font-weight":"800"}, gSel);
const you = el("g", {style:"display:none"}, gMark);
const youC = el("circle", {r:7, fill:"var(--sign)", stroke:"var(--surface)", "stroke-width":3}, you);
const youR = el("circle", {r:16, fill:"none", stroke:"var(--sign)", "stroke-width":2, opacity:.5}, you);

/* one marker per venue: a halo (pulses when happy hour is on) and a dot */
const markers = {};
VENUES.forEach(v => {
  const g = el("g", {"data-id":v.id, style:"cursor:pointer"}, gMark);
  const halo = el("circle", {cx:X(v.ll[1]), cy:Y(v.ll[0]), r:0, fill:"var(--glow)", class:"pulse"}, g);
  const c = el("circle", {cx:X(v.ll[1]), cy:Y(v.ll[0]), r:6}, g);
  const title = el("title", {}, g);
  title.textContent = v.n;
  markers[v.id] = {g, c, halo};
  g.addEventListener("click", e => { e.stopPropagation(); CO.lists.select(v.id, true); });
});

/* ---------- view box (what part of the map is showing) ---------- */
let vb = {x:0, y:0, w:W, h:H};

/* the view box that fits a lat/lng box, padded, at the map's aspect ratio */
function boxVB(lat0, lat1, lng0, lng1, pad){
  pad = pad || 0.06;
  const x0 = X(lng0), x1 = X(lng1), y0 = Y(lat1), y1 = Y(lat0);
  let w = x1 - x0, h = y1 - y0;
  w *= 1 + pad*2;
  h *= 1 + pad*2;
  const cx = (x0 + x1)/2, cy = (y0 + y1)/2;
  if(w/h < W/H) w = h*W/H; else h = w*H/W;
  return {x:cx - w/2, y:cy - h/2, w, h};
}
function areaVB(){
  if(state.area === "near" && state.me){
    const d = 0.06;
    return boxVB(state.me[0] - d, state.me[0] + d, state.me[1] - d*1.35, state.me[1] + d*1.35, 0);
  }
  const b = AREAS[state.area] || AREAS.all;
  return state.area === "all" ? {x:0, y:0, w:W, h:H} : boxVB(b.box[0], b.box[1], b.box[2], b.box[3]);
}

/* apply vb; k = zoom factor, used to keep labels, markers and the route the same size on screen */
function applyVB(){
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const k = vb.w/W;
  labels.forEach(l => {
    if(l.kind === "pt"){
      const x = X(l.v[1]), y = Y(l.v[0]);
      l.t.setAttribute("x", x);
      l.t.setAttribute("y", y);
      l.t.setAttribute("font-size", 17*k);
      l.t.setAttribute("transform", `rotate(${l.v[2]} ${x} ${y}) translate(0 ${-9*k})`);
      return;
    }
    if(l.kind === "ew"){
      /* keep the label left of the view, clear of the zoom buttons near the bottom, and on the road */
      const low = Y(l.v) > vb.y + vb.h - 105*k;
      l.t.setAttribute("x", Math.max(vb.x + (low ? 150 : 8)*k, l.w0 != null ? X(l.w0) + 8*k : -1e9));
      l.t.setAttribute("font-size", 17*k);
      l.t.setAttribute("y", Y(l.v) - 6*k);
    } else {
      const x = X(l.v) + 5*k, y = Math.min(vb.y + vb.h - 10*k, l.s0 != null ? Y(l.s0) - 10*k : 1e9);
      l.t.setAttribute("x", x);
      l.t.setAttribute("y", y);
      l.t.setAttribute("font-size", 17*k);
      l.t.setAttribute("transform", `rotate(-90 ${x} ${y})`);
    }
  });
  youC.setAttribute("r", 7*k);
  youC.setAttribute("stroke-width", 3*k);
  youR.setAttribute("r", 16*k);
  youR.setAttribute("stroke-width", 2*k);
  /* route pieces (drawRoute tags them with data-k) */
  svg.querySelectorAll("[data-k]").forEach(n => {
    const t = n.dataset.k;
    if(t === "line"){ n.setAttribute("stroke-width", 4*k); n.setAttribute("stroke-dasharray", `${10*k} ${7*k}`); }
    if(t === "c") n.setAttribute("r", 13*k);
    if(t === "t"){ n.setAttribute("font-size", 17*k); n.setAttribute("y", +n.dataset.cy + 6*k); }
  });
  paint();
}

let animId = 0;
function stopAnim(){ if(animId){ cancelAnimationFrame(animId); animId = 0; } }
/* ease the view box to target t over about half a second */
function glideTo(t){
  stopAnim();
  const from = {...vb};
  if(reducedMotion()){ vb = t; applyVB(); return; }
  const t0 = performance.now(), D = 480;
  const step = now => {
    const p = Math.min(1, (now - t0)/D), e = p < .5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2)/2;
    vb = {x:from.x + (t.x - from.x)*e, y:from.y + (t.y - from.y)*e, w:from.w + (t.w - from.w)*e, h:from.h + (t.h - from.h)*e};
    applyVB();
    animId = p < 1 ? requestAnimationFrame(step) : 0;
  };
  animId = requestAnimationFrame(step);
}

/* Move the map to a place picked from the list or timeline. Stays put if it's already in view; otherwise
   zooms out just enough to show it and the previously selected place (never zooms in, never past the full map).
   The margins keep it clear of the edges, and of the legend along the bottom. */
const MX = .1, MT = .1, MB = .25;
function inView(v){
  const x = X(v.ll[1]), y = Y(v.ll[0]);
  return x >= vb.x + vb.w*MX && x <= vb.x + vb.w*(1 - MX) && y >= vb.y + vb.h*MT && y <= vb.y + vb.h*(1 - MB);
}
function focusPlace(id, prevId){
  const v = byId.get(id);
  if(!v || inView(v)) return;
  const p = prevId && prevId !== id ? byId.get(prevId) : null;
  const pv = p && visible(p) ? p : null;
  const pp = [v].concat(pv ? [pv] : []).map(p => [X(p.ll[1]), Y(p.ll[0])]);
  const xs = pp.map(p => p[0]), ys = pp.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(vb.w, (x1 - x0)/(1 - 2*MX), (y1 - y0)/(1 - MT - MB)*W/H);
  let t;
  if(w >= W){
    t = {x:0, y:0, w:W, h:H};
  } else {
    const h = w*H/W;
    t = {x:(x0 + x1)/2 - w/2, y:(y0 + y1)/2 - h*(MT + (1 - MT - MB)/2), w, h};
  }
  glideTo(t);
}

/* zoom by factor f around map point (cx, cy), or the center */
function zoom(f, cx, cy){
  stopAnim();
  const nw = Math.min(W*1.2, Math.max(W/8, vb.w*f)), nh = nw*H/W;
  if(cx == null){ cx = vb.x + vb.w/2; cy = vb.y + vb.h/2; }
  vb.x = cx - (cx - vb.x)*nw/vb.w;
  vb.y = cy - (cy - vb.y)*nh/vb.h;
  vb.w = nw;
  vb.h = nh;
  applyVB();
}
function centerOn(ll, w){
  stopAnim();
  w = w || W/3.2;
  const h = w*H/W;
  vb = {x:X(ll[1]) - w/2, y:Y(ll[0]) - h/2, w, h};
  applyVB();
}
/* show the whole of the selected area */
function fitArea(){
  stopAnim();
  vb = areaVB();
  applyVB();
}

$("zin").onclick = () => zoom(0.7);
$("zout").onclick = () => zoom(1/0.7);
$("zreset").onclick = fitArea;

/* ---------- pan, pinch and wheel ---------- */
/* screen point → map point */
function fit(){
  const r = svg.getBoundingClientRect();
  const s = Math.min(r.width/vb.w, r.height/vb.h) || 1;
  return {r, s, ox:(r.width - vb.w*s)/2, oy:(r.height - vb.h*s)/2};
}
function toUser(cx, cy){
  const f = fit();
  return {x:vb.x + (cx - f.r.left - f.ox)/f.s, y:vb.y + (cy - f.r.top - f.oy)/f.s};
}
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const p = toUser(e.clientX, e.clientY);
  zoom(e.deltaY > 0 ? 1.15 : 1/1.15, p.x, p.y);
}, {passive:false});

let drag = null;
const ptrs = new Map();
svg.addEventListener("pointerdown", e => {
  stopAnim();
  ptrs.set(e.pointerId, e);
  if(ptrs.size === 1) drag = {x:e.clientX, y:e.clientY, vx:vb.x, vy:vb.y, moved:false};
  else drag = null;
});
svg.addEventListener("pointermove", e => {
  if(ptrs.has(e.pointerId)){
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, e);
    /* two fingers: pinch zoom around their midpoint */
    if(ptrs.size === 2){
      const [a, b] = [...ptrs.values()];
      const o = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1];
      const d1 = Math.hypot(prev.clientX - o.clientX, prev.clientY - o.clientY), d2 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if(d1 > 0 && d2 > 0){
        const q = toUser((a.clientX + b.clientX)/2, (a.clientY + b.clientY)/2);
        zoom(d1/d2, q.x, q.y);
      }
      return;
    }
  }
  if(!drag) return;
  const f = fit();
  const dx = (e.clientX - drag.x)/f.s, dy = (e.clientY - drag.y)/f.s;
  /* a few pixels of slop so a tap on a marker isn't treated as a drag */
  if(!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4){
    drag.moved = true;
    svg.classList.add("drag");
    try { svg.setPointerCapture(e.pointerId); } catch(_){}
  }
  if(!drag.moved) return;
  vb.x = drag.vx - dx;
  vb.y = drag.vy - dy;
  /* only move the view while dragging; labels and markers catch up on release */
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
});
function endPtr(e){
  ptrs.delete(e.pointerId);
  if(drag && drag.moved) applyVB();
  svg.classList.remove("drag");
  if(ptrs.size === 0) setTimeout(() => drag = null, 0);
}
svg.addEventListener("pointerup", endPtr);
svg.addEventListener("pointercancel", endPtr);
svg.addEventListener("click", () => { if(drag && drag.moved) return; CO.lists.select(null); });

/* ---------- markers ---------- */
/* venue id → "now" | "later" | "unknown" | "idle", set by lists.render */
let statusMap = {};
function setStatus(m){ statusMap = m; }

function paint(){
  const k = vb.w/W;
  VENUES.forEach(v => {
    const m = markers[v.id];
    const st = statusMap[v.id];
    const show = visible(v);
    m.g.style.display = show ? "" : "none";
    if(!show) return;
    let r = 5.5, fill = "var(--idle)", stroke = "var(--mapbg)", sw = 1.5;
    if(st === "now"){ r = 9; fill = "var(--glow)"; stroke = "var(--glow-ink)"; }
    else if(st === "later"){ r = 7; fill = "var(--mapbg)"; stroke = "var(--later)"; sw = 3; }
    else if(st === "unknown"){ r = 5; fill = "var(--mapbg)"; stroke = "var(--idle)"; sw = 2; }
    if(favs.has(v.id) && st !== "now"){ stroke = "var(--glow)"; sw = Math.max(sw, 2.5); }
    const isSel = state.sel === v.id;
    if(isSel){ r = 19; fill = "var(--ink)"; stroke = "var(--mapbg)"; sw = 4.5; }
    m.c.setAttribute("r", r*k);
    m.c.setAttribute("fill", fill);
    m.c.setAttribute("stroke", stroke);
    m.c.setAttribute("stroke-width", sw*k);
    m.halo.setAttribute("r", st === "now" && !isSel ? 18*k : 0);
    if(st === "now") gMark.appendChild(m.g);   // happy-hour markers on top
  });
  if(state.me){
    you.style.display = "";
    you.setAttribute("transform", `translate(${X(state.me[1])} ${Y(state.me[0])})`);
    gMark.appendChild(you);
  }
  if(state.sel && markers[state.sel]) gMark.appendChild(markers[state.sel].g);
  paintSel();
}

/* ring and name label on the selected place; the name flips left if it would run off the edge */
function paintSel(){
  const v = state.sel && byId.get(state.sel);
  if(!v || !visible(v)){ gSel.style.display = "none"; return; }
  const k = vb.w/W, cx = X(v.ll[1]), cy = Y(v.ll[0]);
  gSel.style.display = "";
  selRing.setAttribute("cx", cx);
  selRing.setAttribute("cy", cy);
  selRing.setAttribute("r", 19*k);
  selRing.setAttribute("stroke-width", 4*k);
  selTag.textContent = v.n;
  selTag.setAttribute("font-size", 27*k);
  selTag.setAttribute("stroke-width", 7*k);
  selTag.setAttribute("y", cy + 9*k);
  let tw = v.n.length*13*k;
  try { tw = selTag.getComputedTextLength() || tw; } catch(e){}
  const right = cx + 30*k + tw <= vb.x + vb.w - 8*k;
  selTag.setAttribute("text-anchor", right ? "start" : "end");
  selTag.setAttribute("x", right ? cx + 30*k : cx - 30*k);
}

/* ---------- planner route ---------- */
function clearRoute(){
  gPlan.innerHTML = "";
  gPlanTop.innerHTML = "";
}
/* dashed line through the stops, numbered circles on top, then zoom to fit them */
function drawRoute(lls){
  const k = vb.w/W;
  const p = lls.map(ll => [X(ll[1]), Y(ll[0])]);
  if(p.length > 1) el("polyline", {"data-k":"line", points:p.map(q => q.join(",")).join(" "), fill:"none", stroke:"var(--ink)", "stroke-width":4*k, "stroke-dasharray":`${10*k} ${7*k}`, "stroke-linecap":"round"}, gPlan);
  p.forEach((q, i) => {
    el("circle", {"data-k":"c", cx:q[0], cy:q[1], r:13*k, fill:"var(--ink)", stroke:"var(--mapbg)", "stroke-width":2*k}, gPlanTop);
    const t = el("text", {"data-k":"t", "data-cy":q[1], x:q[0], y:q[1] + 6*k, "text-anchor":"middle", fill:"var(--bg)", "font-family":FONT, "font-weight":"800", "font-size":17*k}, gPlanTop);
    t.textContent = i + 1;
  });
  const lats = lls.map(ll => ll[0]), lngs = lls.map(ll => ll[1]);
  stopAnim();
  vb = boxVB(Math.min(...lats) - 0.01, Math.max(...lats) + 0.01, Math.min(...lngs) - 0.015, Math.max(...lngs) + 0.015, 0.15);
  applyVB();
}

CO.map = {W, inBounds, fitArea, centerOn, focusPlace, setStatus, paint, clearRoute, drawRoute};
})(window.CO);
