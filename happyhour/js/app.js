/* Clock Out — the filter controls, the clock, location, and start-up. Loaded last; see js/config.js for how
   the files fit together. */
(function(CO){
"use strict";
const {DAYS, TYPES, DEALS} = CO.config;
const {$, toMin, hhmm, toast} = CO.util;
const {state, save} = CO.state;
const map = CO.map;
const {render} = CO.lists;

/* version from this script's ?v=, so index.html is the only place it's set */
const VERSION = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "dev";

const daySel = $("day"), timeIn = $("time"), sortSel = $("sort"), unvChip = $("unvChip"), q = $("q");

/* ---------- filter chips ---------- */
DAYS.forEach((d, i) => {
  const o = document.createElement("option");
  o.value = i;
  o.textContent = d;
  daySel.appendChild(o);
});
/* a chip that toggles key k in the set, remembered between visits */
function toggleChip(parent, cls, k, label, set){
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.dataset.k = k;
  b.setAttribute("aria-pressed", set().has(k));
  b.onclick = () => {
    const s = set();
    if(s.has(k)) s.delete(k); else s.add(k);
    b.setAttribute("aria-pressed", s.has(k));
    save();
    render();
  };
  $(parent).appendChild(b);
}
/* set() is read at click time because a shared link can replace the set */
Object.entries(TYPES).forEach(([k, lab]) => toggleChip("typeChips", "chip", k, lab, () => state.types));
DEALS.forEach(d => toggleChip("dealChips", "chip deal", d.k, d.lab, () => state.deals));

sortSel.value = state.sort;
sortSel.onchange = () => {
  state.sort = sortSel.value;
  if(state.sort === "near" && !state.me) locate(false);
  save();
  render();
};
unvChip.setAttribute("aria-pressed", state.unv);
unvChip.onclick = () => {
  state.unv = !state.unv;
  unvChip.setAttribute("aria-pressed", state.unv);
  save();
  render();
};
$("favChip").onclick = () => {
  state.fav = !state.fav;
  $("favChip").setAttribute("aria-pressed", state.fav);
  if(state.fav && !CO.state.favs.size) toast("Tap the ☆ on any card to add favorites");
  render();
};
/* Late night jumps the time to 9:30pm if it's currently daytime */
$("lateChip").onclick = () => {
  state.late = !state.late;
  $("lateChip").setAttribute("aria-pressed", state.late);
  if(state.late && state.t < 20*60 && state.t >= 5*60){
    state.live = false;
    state.t = 21*60 + 30;
    syncTimeInputs();
  }
  render();
};
let qT;
q.addEventListener("input", () => {
  clearTimeout(qT);
  qT = setTimeout(() => { state.q = q.value.trim().toLowerCase(); render(); }, 150);
});

/* ---------- day, time and the clock ---------- */
function syncTimeInputs(){
  daySel.value = state.day;
  timeIn.value = hhmm(state.t);
}
/* "live" = following the clock. Set by Now; picking a day or time by hand turns it off. */
function setNow(){
  const n = new Date();
  state.live = true;
  state.day = n.getDay();
  state.t = n.getHours()*60 + n.getMinutes();
  syncTimeInputs();
  render();
}
function tick(){
  if(!state.live) return;
  const n = new Date();
  const d = n.getDay(), tm = n.getHours()*60 + n.getMinutes();
  if(d === state.day && tm === state.t) return;
  state.day = d;
  state.t = tm;
  CO.plan.followClock();
  syncTimeInputs();
  render();
}
daySel.onchange = () => { state.live = false; state.day = +daySel.value; render(); };
timeIn.onchange = () => { if(timeIn.value){ state.live = false; state.t = toMin(timeIn.value); render(); } };
$("nowBtn").onclick = setNow;

/* ---------- area and location ---------- */
function setArea(a, noZoom){
  state.area = a;
  document.querySelectorAll("#areaSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.area === a));
  if(a !== "near") save();
  if(!noZoom) map.fitArea();
  render();
}
document.querySelectorAll("#areaSeg button").forEach(b => b.onclick = () => {
  const a = b.dataset.area;
  if(a === "near"){ locate(true); return; }
  setArea(a);
});
/* asArea = the Near me button (zoom to you and sort by distance); otherwise just for the distance sort */
function locate(asArea){
  if(!navigator.geolocation){ toast("Location isn't available in this browser"); return; }
  toast("Finding you…");
  navigator.geolocation.getCurrentPosition(p => {
    state.me = [p.coords.latitude, p.coords.longitude];
    $("youLegend").hidden = false;
    if(asArea){ state.sort = "near"; sortSel.value = "near"; setArea("near"); } else render();
    toast(map.inBounds(state.me) ? "Sorted by distance from you" : "You're outside the mapped area; distances still work");
  }, () => {
    toast("Couldn't get your location. Check location permissions.");
    if(state.sort === "near"){ state.sort = "ending"; sortSel.value = "ending"; render(); }
  }, {enableHighAccuracy:false, timeout:10000, maximumAge:300000});
}

/* ---------- tabs and Surprise me ---------- */
function setTab(t){
  state.tab = t;
  $("tabList").setAttribute("aria-selected", t === "list");
  $("tabTimeline").setAttribute("aria-selected", t === "timeline");
  $("listView").hidden = t !== "list";
  $("timelineView").hidden = t !== "timeline";
  render();
}
$("tabList").onclick = () => setTab("list");
$("tabTimeline").onclick = () => setTab("timeline");

/* a random place from what's running now, or else starting later */
$("surpriseBtn").onclick = () => {
  const {now, later} = CO.lists.running();
  const pool = now.length ? now : later;
  if(!pool.length){ toast("Nothing running or starting later with these filters"); return; }
  const pick = pool[Math.floor(Math.random()*pool.length)].v;
  if(state.tab !== "list") setTab("list");
  map.centerOn(pick.ll, map.W/3);
  CO.lists.select(pick.id, true);
  toast("How about " + pick.n + "?");
};

/* ---------- start ---------- */
const fromLink = CO.share.readParams();
document.querySelectorAll("#areaSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.area === state.area));
map.fitArea();
if(fromLink){ syncTimeInputs(); render(); } else setNow();

/* phones pause timers in the background, so also catch up whenever the page is shown again */
setInterval(tick, 20000);
document.addEventListener("visibilitychange", () => { if(!document.hidden) tick(); });
addEventListener("pageshow", tick);

/* offline support, only on the real website (not when opened as a file or inside a frame) */
try {
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && window.top === window.self)
    navigator.serviceWorker.register("sw.js?v=" + encodeURIComponent(VERSION)).catch(() => {});
} catch(e){}
})(window.CO);
