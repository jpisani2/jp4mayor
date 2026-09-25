/* Clock Out — small shared helpers: formatting, distance, saved settings, and page bits
   (toast, pop-ups, layout) that several files use. */
(function(CO){
"use strict";
const {DS, WEEK} = CO.config;

const $ = id => document.getElementById(id);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* localStorage that never throws (private windows, blocked storage) */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

/* ---------- times: minutes after midnight; past midnight goes above 1440 (2am = 1560) ---------- */
const toMin = s => { const [h, m] = s.split(":").map(Number); return h*60 + m; };
const hhmm = m => String(Math.floor(m/60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

/* 930 → "3:30 pm" */
function fmtT(m){
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  if(m === 0) return "midnight";
  if(m === 720) return "noon";
  let h = Math.floor(m/60);
  const mm = m % 60, ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + (mm ? ":" + String(mm).padStart(2, "0") : "") + " " + ap;
}
/* "3–6 pm", or "11 am–2 pm" when the halves differ */
function fmtRange(s, e){
  const a = fmtT(s), b = fmtT(e);
  if(a.slice(-2) === b.slice(-2) && !/noon|midnight/.test(a + b)) return a.slice(0, -3) + "–" + b;
  return a + "–" + b;
}
/* 95 → "1h 35m" */
function fmtDur(m){
  m = Math.round(m);
  if(m < 60) return m + "m";
  const h = Math.floor(m/60), r = m % 60;
  return h + "h" + (r ? " " + r + "m" : "");
}
/* [1,2,3,4,5] → "Mon–Fri", [1,3] → "Mon, Wed", all seven → "Daily" */
function daysLabel(days){
  const set = new Set(days);
  if(set.size === 7) return "Daily";
  const idx = WEEK.filter(d => set.has(d)).map(d => WEEK.indexOf(d));
  const parts = [];
  let i = 0;
  while(i < idx.length){
    let j = i;
    while(j + 1 < idx.length && idx[j+1] === idx[j] + 1) j++;
    const a = DS[WEEK[idx[i]]], b = DS[WEEK[idx[j]]];
    parts.push(j - i >= 2 ? a + "–" + b : (j > i ? a + ", " + b : a));
    i = j + 1;
  }
  return parts.join(", ");
}

/* straight-line miles between two [lat, lng] points */
function miles(a, b){
  const R = 3958.8, r = Math.PI/180;
  const dl = (b[0] - a[0])*r, dg = (b[1] - a[1])*r;
  const x = Math.sin(dl/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

/* escape text before putting it into HTML */
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
}

/* ---------- toast ---------- */
let toastT;
function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- pop-ups: focus the first control on open, hand focus back on close ---------- */
let lastFocus = null;
function openPop(id){
  lastFocus = document.activeElement;
  const p = $(id);
  p.hidden = false;
  const f = p.querySelector("button,select,input");
  if(f) f.focus();
}
function closePop(id){
  $(id).hidden = true;
  if(lastFocus && lastFocus.focus) lastFocus.focus();
}
document.querySelectorAll(".pop").forEach(p => {
  p.addEventListener("click", e => { if(e.target === p || e.target.closest("[data-close]")) closePop(p.id); });
});
document.addEventListener("keydown", e => {
  if(e.key === "Escape") document.querySelectorAll(".pop:not([hidden])").forEach(p => closePop(p.id));
});

/* ---------- layout ---------- */
/* the controls bar is sticky on wide screens; the CSS needs its height */
function fitCtl(){
  const c = $("controls");
  const h = matchMedia("(max-width:700px)").matches ? 0 : c.offsetHeight;
  document.documentElement.style.setProperty("--ctl-h", h + "px");
}
window.addEventListener("resize", fitCtl);

/* "Back to map" button, shown once you've scrolled past the map */
(function(){
  const b = $("toTop");
  const narrow = () => matchMedia("(max-width:900px)").matches;
  const target = () => narrow() ? document.querySelector(".status") : null;
  function upd(){
    const t = target();
    const lim = t ? t.getBoundingClientRect().top + scrollY + 120 : 350;
    const on = scrollY > lim;
    b.classList.toggle("show", on);
    b.tabIndex = on ? 0 : -1;
  }
  addEventListener("scroll", upd, {passive:true});
  addEventListener("resize", upd);
  upd();
  b.addEventListener("click", () => {
    const t = target();
    const y = t ? Math.max(0, t.getBoundingClientRect().top + scrollY - 8) : 0;
    scrollTo({top:y, behavior:reducedMotion() ? "auto" : "smooth"});
  });
})();

CO.util = {$, reducedMotion, store, toMin, hhmm, fmtT, fmtRange, fmtDur, daysLabel, miles, esc, toast, openPop, closePop, fitCtl};
})(window.CO);
