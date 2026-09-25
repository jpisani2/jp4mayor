/* Clock Out — the lists, timeline and status line, and selecting a place.
   render() is the one place that recomputes what's running; call it after any change to state. */
(function(CO){
"use strict";
const {DAYS, AREAS, CF} = CO.config;
const {$, esc, fmtT, fmtRange, reducedMotion, fitCtl, toast} = CO.util;
const {effWins, activeNow, laterToday, schedule, spFor} = CO.hours;
const {byId} = CO.venues;
const {state, favs, saveFavs, baseVisible, visible, dist} = CO.state;
const {card, mapsLink, telLink} = CO.cards;
const map = CO.map;

/* venue id → "now" | "later" | "unknown" | "idle" for the current day and time */
let statusMap = {};
let nowList = [], laterList = [];

/* list order: the chosen sort, otherwise ending soonest / starting soonest / top rated */
function sorter(kind){
  return (a, b) => {
    const s = state.sort;
    if(s === "near" && state.me) return dist(a.v) - dist(b.v);
    if(s === "rating") return (b.v.r || 0) - (a.v.r || 0);
    if(s === "cheap"){
      const pa = a.v.pr ? a.v.pr[0] : 99, pb = b.v.pr ? b.v.pr[0] : 99;
      return pa - pb || (b.v.r || 0) - (a.v.r || 0);
    }
    if(kind === "now") return a.i.left - b.i.left || a.v.cf - b.v.cf;
    if(kind === "later") return a.i.s - b.i.s || a.v.cf - b.v.cf;
    return (b.v.r || 0) - (a.v.r || 0);
  };
}

function render(){
  CO.plan.checkStale();
  const d = state.day, t = state.t;
  statusMap = {};
  const now = [], later = [], unknown = [], special = [];
  let otherDays = 0;
  VENUES.forEach(v => {
    const vis = visible(v);
    if(baseVisible(v) && spFor(v, d).length) special.push({v});
    if(!v.win.length){ statusMap[v.id] = "unknown"; if(vis) unknown.push({v}); return; }
    const a = activeNow(v, d, t);
    if(a){ statusMap[v.id] = "now"; if(vis) now.push({v, i:a}); return; }
    const l = laterToday(v, d, t);
    if(l){ statusMap[v.id] = "later"; if(vis) later.push({v, i:l}); return; }
    statusMap[v.id] = "idle";
    if(vis) otherDays++;
  });
  map.setStatus(statusMap);
  now.sort(sorter("now"));
  later.sort(sorter("later"));
  unknown.sort(sorter("x"));
  special.sort(sorter("x"));
  nowList = now;
  laterList = later;

  const filt = state.q || state.deals.size || state.fav || state.late;
  $("listNow").innerHTML = now.length
    ? now.map(x => card(x.v, "now", x.i)).join("")
    : `<div class="empty">Nothing ${filt ? "matching your filters " : ""}running at ${fmtT(t)} on ${DAYS[d]}${later.length ? ". The next one starts at " + fmtT(later.slice().sort((a, b) => a.i.s - b.i.s)[0].i.s) + "." : ". Try an afternoon between 3 and 6."}</div>`;
  $("listLater").innerHTML = later.length
    ? later.map(x => card(x.v, "later", x.i)).join("")
    : `<div class="empty">No more happy hours start later on ${DAYS[d]}.</div>`;
  $("listUnknown").innerHTML = unknown.map(x => card(x.v, "unknown")).join("");
  $("listSpecial").innerHTML = special.length
    ? special.map(x => card(x.v, "special")).join("")
    : `<div class="empty">No day-specific specials on file for ${DAYS[d]}.</div>`;

  $("nNow").textContent = now.length;
  $("nLater").textContent = later.length;
  $("nUnknown").textContent = unknown.length;
  $("nSpecial").textContent = special.length;
  $("laterDay").textContent = DAYS[d];
  $("spDay").textContent = DAYS[d] + "'s";
  $("bigStatus").innerHTML = `<b>${now.length}</b> happy hour${now.length === 1 ? "" : "s"} running`;
  const areaName = state.area === "near" ? "near you" : AREAS[state.area].name;
  $("metaStatus").textContent = `${DAYS[d]} at ${fmtT(t)} · ${areaName} · ${later.length} more start later · ${otherDays} at other times${state.unv ? "" : " · unverified hidden"}`;

  if(state.tab === "timeline") renderTimeline();
  /* drop the selection if the filters now hide it */
  if(state.sel){ const v = byId.get(state.sel); if(!v || !visible(v)) state.sel = null; }
  map.paint();
  if(state.sel) select(state.sel, false); else $("tip").hidden = true;
  fitCtl();
}

/* one row per place with a happy hour that day, 10am to 2am, sorted by start */
function renderTimeline(){
  const d = state.day, t = state.t, A = 600, Z = 1560, span = Z - A;
  const pc = m => Math.max(0, Math.min(100, (m - A)/span*100));
  const rows = [];
  VENUES.forEach(v => {
    if(!visible(v)) return;
    const ws = effWins(v, d).filter(w => w.s < Z);
    if(ws.length) rows.push({v, ws, s:Math.min(...ws.map(w => w.s))});
  });
  rows.sort((a, b) => a.s - b.s || a.ws[0].e - b.ws[0].e);
  $("tlDay").textContent = "on " + DAYS[d];
  $("nTl").textContent = rows.length;
  const ticks = [[600,"10a"],[720,"noon"],[900,"3p"],[1080,"6p"],[1260,"9p"],[1440,"12a"],[1560,"2a"]];
  const nowL = t >= A && t <= Z ? `<span class="nowline" style="left:${pc(t)}%"></span>` : "";
  let h = `<div class="tl-axis"><span></span><div class="ticks">${ticks.map(x => `<span style="left:${pc(x[0])}%">${x[1]}</span>`).join("")}</div></div>`;
  h += rows.map(r => `<button type="button" class="tl-row" data-id="${r.v.id}" aria-label="${esc(r.v.n)}: ${r.ws.map(w => fmtRange(w.s, w.e)).join(" and ")}"><span class="nm">${esc(r.v.n)} <small>${esc(r.v.c)}</small></span><span class="bar">${r.ws.map(w => `<i class="${w.s <= t && t < w.e ? "on" : ""}" style="left:${pc(w.s)}%;width:${Math.max(1, pc(w.e) - pc(w.s))}%"></i>`).join("")}${nowL}</span></button>`).join("");
  $("timeline").innerHTML = rows.length ? h : `<div class="empty" style="border:0">No happy hours on ${DAYS[d]} match your filters.</div>`;
}

/* select a place (or null to clear): highlight its card, show its map tip, and repaint markers.
   fromMap = picked on the map, so scroll its card into view */
function select(id, fromMap){
  state.sel = id;
  document.querySelectorAll(".card.sel").forEach(c => c.classList.remove("sel"));
  const tip = $("tip");
  if(!id){ tip.hidden = true; map.paint(); return; }
  const v = byId.get(id);
  if(!v) return;
  const c = document.querySelector(`.card[data-id="${id}"]`);
  if(c){
    c.classList.add("sel");
    if(fromMap && state.tab === "list"){
      const det = c.closest("details");
      if(det) det.open = true;
      c.scrollIntoView({behavior:reducedMotion() ? "auto" : "smooth", block:"center"});
    }
  }
  const st = statusMap[id];
  const a = activeNow(v, state.day, state.t), l = laterToday(v, state.day, state.t);
  const when = st === "now" && a ? "Happy hour until " + fmtT(a.end) : st === "later" && l ? "Starts " + fmtT(l.s) : v.win.length ? schedule(v) : "Times unknown";
  tip.innerHTML = `<b>${esc(v.n)}</b> · ${esc(v.c)}<br>${when} · <span class="tag conf c${v.cf}" style="font-size:10px">${CF[v.cf]}</span><br>${v.ph ? `<a href="${telLink(v)}">Call</a> · ` : ""}<a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`;
  tip.hidden = false;
  map.paint();
}
/* select from the list or timeline, and move the map to it */
function pick(id){
  const prev = state.sel;
  select(id, false);
  map.focusPlace(id, prev);
}

/* ---------- clicks in the lists ---------- */
const lists = $("lists");
lists.addEventListener("click", e => {
  const fb = e.target.closest("[data-fav]");
  if(fb){
    const id = fb.dataset.fav;
    if(favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    /* a place can have more than one card (e.g. "now" and "specials") */
    document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => {
      b.setAttribute("aria-pressed", favs.has(id));
      b.setAttribute("aria-label", (favs.has(id) ? "Remove from" : "Add to") + " favorites");
    });
    toast(favs.has(id) ? "Added to favorites" : "Removed from favorites");
    if(state.fav) render(); else map.paint();
    return;
  }
  const row = e.target.closest(".tl-row");
  if(row){ pick(row.dataset.id); return; }
  if(e.target.closest("a,summary,details,button")) return;
  const c = e.target.closest(".card");
  if(c) pick(c.dataset.id);
});
lists.addEventListener("keydown", e => {
  if(e.key === "Enter" && e.target.classList.contains("card")) pick(e.target.dataset.id);
});

CO.lists = {render, select, running:() => ({now:nowList, later:laterList})};
})(window.CO);
