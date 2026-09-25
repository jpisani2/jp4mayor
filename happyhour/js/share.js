/* Clock Out — Share links. The link's #hash holds the day, time and filters,
   e.g. #d=5&t=1730&a=downriver&deal=marg.wings */
(function(CO){
"use strict";
const {DAYS, TYPES, AREAS, DEALS} = CO.config;
const {$, fmtT, hhmm, toast} = CO.util;
const {state} = CO.state;

function shareParams(){
  const p = new URLSearchParams();
  p.set("d", state.day);
  p.set("t", hhmm(state.t).replace(":", ""));
  if(state.area !== "all" && state.area !== "near") p.set("a", state.area);
  if(state.q) p.set("q", state.q);
  if(state.deals.size) p.set("deal", [...state.deals].join("."));
  if(state.late) p.set("late", "1");
  if(state.types.size < Object.keys(TYPES).length) p.set("type", [...state.types].join("."));
  return p;
}

/* uses the phone's share sheet when there is one, otherwise copies the link */
$("shareBtn").onclick = async () => {
  let top = true;
  try { top = window.top === window.self; } catch(e){ top = false; }
  if(!top || !/^https?:$/.test(location.protocol)){ toast("Share links work from the website version of Clock Out"); return; }
  const url = location.origin + location.pathname + "#" + shareParams().toString();
  const text = `Happy hours ${DAYS[state.day]} at ${fmtT(state.t)}`;
  try {
    if(navigator.share){ await navigator.share({title:"Clock Out", text, url}); return; }
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch(e){
    if(e && e.name === "AbortError") return;
    prompt("Copy this link:", url);
  }
};

/* on load: apply a shared link's settings. Returns false when the page wasn't opened from one.
   Only valid values are used, since anyone can edit a link. */
function readParams(){
  let p;
  try { p = new URLSearchParams((location.hash || "").replace(/^#/, "") || location.search); } catch(e){ return false; }
  if(!p.has("d") && !p.has("t")) return false;
  if(p.has("d")){ const d = +p.get("d"); if(d >= 0 && d <= 6) state.day = d; }
  const tt = p.get("t");
  if(tt && /^\d{3,4}$/.test(tt)){ const n = tt.padStart(4, "0"); state.t = +n.slice(0, 2)*60 + +n.slice(2); }
  if(p.get("a") && AREAS[p.get("a")]) state.area = p.get("a");
  if(p.get("q")){ state.q = p.get("q").toLowerCase(); $("q").value = p.get("q"); }
  if(p.get("deal")){
    state.deals = new Set(p.get("deal").split(".").filter(k => DEALS.some(x => x.k === k)));
    document.querySelectorAll("#dealChips .chip").forEach(b => b.setAttribute("aria-pressed", state.deals.has(b.dataset.k)));
  }
  if(p.get("late") === "1"){ state.late = true; $("lateChip").setAttribute("aria-pressed", "true"); }
  if(p.get("type")){
    const ts = p.get("type").split(".").filter(k => TYPES[k]);
    if(ts.length){
      state.types = new Set(ts);
      document.querySelectorAll("#typeChips .chip").forEach(b => b.setAttribute("aria-pressed", state.types.has(b.dataset.k)));
    }
  }
  return true;
}

CO.share = {readParams};
})(window.CO);
