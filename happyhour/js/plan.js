/* Clock Out — "Plan my night": chains 2–3 happy hours that line up, and shows the route on the map. */
(function(CO){
"use strict";
const {DAYS, DS, AREAS} = CO.config;
const {$, esc, fmtT, toMin, hhmm, miles, toast, openPop, closePop} = CO.util;
const {activeNow, effWins, spFor} = CO.hours;
const {state, baseVisible} = CO.state;
const map = CO.map;

let lastPlan = null;
/* the filters and time the route on the map was planned for; null = no route showing */
let planKey = null, planT = 0;

/* Greedy: at each stop, score every place you could reach while its happy hour is on (or starting within 45 min)
   and take the best. Favors longer happy hours, higher ratings, shorter drives, surer info and less waiting.
   Drive time is a rough guess from straight-line miles. shuffle adds some randomness for "Shuffle". */
function planNight(start, nStops, shuffle){
  const d = state.day;
  const pool = VENUES.filter(v => baseVisible(v) && v.win.length);
  const used = new Set();
  const steps = [];
  let t = start, prev = state.me;
  for(let i = 0; i < nStops; i++){
    let best = null;
    for(const v of pool){
      if(used.has(v.id)) continue;
      const dm = prev ? miles(prev, v.ll) : 0;
      if(prev && dm > (i === 0 ? 12 : 6)) continue;
      const drive = prev ? Math.round(dm*2.8) + 4 : 0;
      const arrive = t + drive;
      const a = activeNow(v, d, arrive);
      let startAt = arrive, end;
      if(a){
        if(a.left < 30) continue;
        end = a.end;
      } else {
        const w = effWins(v, d).filter(w => w.s > arrive && w.s <= arrive + 45).sort((x, y) => x.s - y.s)[0];
        if(!w) continue;
        startAt = w.s;
        end = w.e;
      }
      const score = Math.min(end - startAt, 120)/60*1.2
        + (v.r || 4)
        - (prev ? dm*0.45 : 0)
        - (v.cf - 1)*0.8
        - (startAt - arrive)/60
        + (shuffle ? Math.random()*1.6 : 0);
      if(!best || score > best.score) best = {v, score, drive, dm, arrive:startAt, end};
    }
    if(!best) break;
    used.add(best.v.id);
    /* stay up to 80 minutes (2 hours at the last stop), or until the happy hour ends */
    const leave = Math.min(best.end, best.arrive + (i === nStops - 1 ? 120 : 80));
    steps.push({...best, leave});
    t = leave;
    prev = best.v.ll;
  }
  return steps;
}

function showPlan(shuffle){
  const start = toMin($("planStart").value || hhmm(state.t));
  const n = +$("planStops").value;
  const steps = planNight(start, n, shuffle);
  lastPlan = steps;
  $("planSub").textContent = `${DAYS[state.day]} · ${state.area === "near" ? "near you" : AREAS[state.area].name}${state.deals.size ? " · with your deal filters" : ""}${state.me ? "" : " · turn on Near me to start from your location"}`;
  if(!steps.length){
    $("planOut").innerHTML = `<div class="empty">Nothing lines up from ${fmtT(start)} on ${DAYS[state.day]}. Try an earlier start, another day or a different area.</div>`;
    return;
  }
  $("planOut").innerHTML = steps.map((s, i) => `${i && s.drive ? `<div class="plan-drive">🚗 about ${s.drive} min drive (${s.dm.toFixed(1)} mi)</div>` : ""}<div class="plan-step"><span class="num">${i + 1}</span><div><h3>${esc(s.v.n)}</h3><div class="where">${esc(s.v.c)} · ${esc(s.v.a)}</div><div class="sched"><b>${fmtT(s.arrive)}–${fmtT(s.leave)}</b> · happy hour until ${fmtT(s.end)}</div>${spFor(s.v, state.day).map(x => `<div class="special"><b>${DS[state.day]}:</b> ${esc(x.txt)}</div>`).join("")}${s.v.d ? `<div class="deals">${esc(s.v.d)}</div>` : ""}</div></div>`).join("");
}

/* ---------- route on the map ---------- */
function routeKey(){
  return [state.day, state.area, [...state.types].sort().join(), [...state.deals].sort().join(), state.unv, state.late, state.fav, state.q].join("|");
}
function clearPlan(){
  map.clearRoute();
  planKey = null;
  $("clearRoute").hidden = true;
}
function drawPlan(){
  clearPlan();
  if(!lastPlan || !lastPlan.length) return;
  planKey = routeKey();
  planT = state.t;
  $("clearRoute").hidden = false;
  map.drawRoute(lastPlan.map(s => s.v.ll));
}
/* on every render: drop the route once the filters or the time have moved away from what it was planned for */
function checkStale(){
  if(planKey !== null && (routeKey() !== planKey || Math.abs(state.t - planT) > 2)) clearPlan();
}
/* when the clock moves on in live mode (even past midnight), keep the route */
function followClock(){
  if(planKey !== null){ planKey = routeKey(); planT = state.t; }
}

$("planBtn").onclick = () => { $("planStart").value = hhmm(state.t); showPlan(false); openPop("planPop"); };
$("planStart").onchange = () => showPlan(false);
$("planStops").onchange = () => showPlan(false);
$("planShuffle").onclick = () => showPlan(true);
$("clearRoute").onclick = () => { clearPlan(); toast("Route cleared"); };
$("planMap").onclick = () => {
  closePop("planPop");
  drawPlan();
  if(lastPlan && lastPlan.length){
    CO.lists.select(lastPlan[0].v.id, false);
    toast("Your route is on the map");
    $("mapbox").scrollIntoView({behavior:"smooth", block:"nearest"});
  }
};

CO.plan = {checkStale, followClock};
})(window.CO);
