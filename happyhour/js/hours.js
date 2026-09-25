/* Clock Out — time logic: business hours, happy-hour windows, and what's running when.
   Times are minutes after midnight. Windows that run past midnight end above 1440 (2am = 1560)
   and count toward the day they start. Nothing here touches the page. */
(function(CO){
"use strict";
const {WEEK} = CO.config;
const {esc, fmtRange, daysLabel} = CO.util;

/* ho string → per-day (Sun→Sat) lists of [open, close]; [] = closed that day, null = unknown.
   "11-26" = the same every day; "x,11-26,..." = one value per day; "11-14+16-22" = split hours */
function parseHours(s){
  if(!s) return null;
  const parts = s.split(",");
  const toks = parts.length === 1 ? Array(7).fill(parts[0]) : parts;
  return toks.map(t => {
    if(t === "x") return [];
    if(t === "?" || !t) return null;
    return t.split("+").map(r => {
      const [a, b] = r.split("-").map(Number);
      return [Math.round(a*60), Math.round(b*60)];
    });
  });
}

/* a venue's happy-hour windows on day d, trimmed to its posted hours.
   cut = ends early because the bar closes; lateStart = starts late because the bar opens later */
function effWins(v, d){
  const out = [];
  const hrs = v.hoD ? v.hoD[d] : null;
  for(const w of v.win){
    if(!w.days.includes(d)) continue;
    if(hrs && hrs.length === 0) continue;
    if(!hrs){ out.push({s:w.s, e:w.e, label:w.label, cut:false}); continue; }
    for(const r of hrs){
      const a = Math.max(w.s, r[0]), b = Math.min(w.e, r[1]);
      if(b - a >= 15) out.push({s:a, e:b, label:w.label, cut:b < w.e, lateStart:a > w.s});
    }
  }
  return out;
}

/* the window running at time t on day d, including last night's if it runs past midnight.
   If several are running, the one with the most time left. */
function activeNow(v, d, t){
  let best = null;
  const prev = (d + 6) % 7;
  for(const w of effWins(v, d)){
    if(w.s <= t && t < w.e){
      const left = w.e - t;
      if(!best || left > best.left) best = {w, left, end:w.e};
    }
  }
  for(const w of effWins(v, prev)){
    if(w.e > 1440 && t + 1440 >= w.s && t + 1440 < w.e){
      const left = w.e - (t + 1440);
      if(!best || left > best.left) best = {w, left, end:w.e};
    }
  }
  return best;
}

/* the next window starting after t on day d, including ones starting after midnight (e.g. "24:00") */
function laterToday(v, d, t){
  let best = null;
  for(const w of effWins(v, d)){
    if(w.s > t && (!best || w.s < best.s)) best = {w, s:w.s};
  }
  return best;
}

/* is the bar open at time t on day d? null when its hours are unknown */
function openInfo(v, d, t){
  if(!v.hoD) return null;
  const today = v.hoD[d], prev = v.hoD[(d + 6) % 7];
  if(prev) for(const r of prev){ if(r[1] > 1440 && t + 1440 < r[1]) return {open:true, until:r[1]}; }
  if(today === null) return null;
  if(today.length === 0) return {closedDay:true};
  for(const r of today){ if(r[0] <= t && t < r[1]) return {open:true, until:r[1]}; }
  const next = today.filter(r => r[0] > t).sort((a, b) => a[0] - b[0])[0];
  return next ? {open:false, opens:next[0]} : {open:false, done:true};
}

/* the whole week's happy hours as HTML, grouping days with the same times: "<b>Mon–Fri</b> 3–6 pm · ..." */
function schedule(v){
  const groups = new Map();
  for(let d = 0; d < 7; d++) for(const w of effWins(v, d)){
    const k = w.s + "-" + w.e + "-" + w.label + "-" + (w.cut ? 1 : 0);
    if(!groups.has(k)) groups.set(k, {w, days:[]});
    groups.get(k).days.push(d);
  }
  if(!groups.size) return v.win.length ? "Not during posted business hours" : "";
  return [...groups.values()]
    .sort((a, b) => (WEEK.indexOf(a.days[0]) - WEEK.indexOf(b.days[0])) || a.w.s - b.w.s)
    .map(g => {
      const w = g.w;
      const all = w.label.startsWith("All day");
      return `<b>${daysLabel(g.days)}</b> ${all && w.e - w.s >= 600 ? "all day" : fmtRange(w.s, w.e)}${w.label && !all ? " (" + esc(w.label.toLowerCase()) + ")" : ""}${w.cut ? " <span class=\"approx\">till close</span>" : ""}`;
    })
    .join(" · ");
}
function schedulePlain(v){ return schedule(v).replace(/<[^>]+>/g, "") || "times unknown"; }

/* day-specific specials on day d */
function spFor(v, d){ return v.sp.filter(s => s.days.includes(d)); }

/* for the Late night filter: a window starting 8pm or later, ending 10pm or later, or running past midnight */
function lateOK(v, d){
  return effWins(v, d).some(w => w.s >= 1200 || w.e >= 1320) || effWins(v, (d + 6) % 7).some(w => w.e > 1440);
}

CO.hours = {parseHours, effWins, activeNow, laterToday, openInfo, schedule, schedulePlain, spFor, lateOK};
})(window.CO);
