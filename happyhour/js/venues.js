/* Clock Out — gets VENUES (from data.js) ready for the app, once, on load: parses happy hours and
   business hours, puts each place in an area, tags its deals and builds its search text. */
(function(CO){
"use strict";
const {TYPE1, DEALS} = CO.config;
const {toMin} = CO.util;
const {parseHours} = CO.hours;

const DOWNRIVER = new Set(AREA_CITIES.downriver);
const NEARBY = new Set(NEARBY_CITIES);
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* how many of each chain are on the map, for the "Chain · 3 on map" tag */
const chainCount = {};
VENUES.forEach(v => { if(v.t === "chain") chainCount[v.n] = (chainCount[v.n] || 0) + 1; });

const byId = new Map();
VENUES.forEach(v => {
  if(!byId.has(v.id)) byId.set(v.id, v);
  v.win = v.hh.map(w => ({days:w[0].split("").map(Number), s:toMin(w[1]), e:toMin(w[2]), label:w[3] || ""}));
  v.sp = (v.sp || []).map(s => ({days:s[0].split("").map(Number), txt:s[1]}));
  v.hoD = parseHours(v.ho);
  v.area = DOWNRIVER.has(v.c) ? "downriver" : "west";
  v.near = NEARBY.has(v.c);
  const txt = (v.d || "") + " " + v.sp.map(s => s.txt).join(" ");
  v.deals = new Set(DEALS.filter(d => d.re.test(txt)).map(d => d.k));
  v.hay = (v.n + " " + v.c + " " + v.a + " " + txt + " " + TYPE1[v.t]).toLowerCase();
  /* evidence date: "Aug 2026" → {y:2026, mo:7}; "2026" → {y:2026, mo:null}; anything else → null */
  const m = String(v.dt || "").match(/(?:([A-Za-z]{3})[a-z]*\s+)?(20\d\d)/);
  const mo = m && m[1] ? MON.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) : -1;
  v.evd = m ? {y:+m[2], mo:mo >= 0 ? mo : null} : null;
});

/* evidence freshness badge: green within 6 months, amber within 18, grey after that or undated */
function evInfo(v){
  if(!v.evd) return {cls:"stale", label:"Undated"};
  const n = new Date();
  const mo = v.evd.mo == null ? 0 : v.evd.mo;
  const age = (n.getFullYear() - v.evd.y)*12 + (n.getMonth() - mo);
  const label = (v.evd.mo != null ? MON[v.evd.mo] + " " : "") + v.evd.y;
  return {cls:age <= 6 ? "fresh" : age <= 18 ? "mid" : "stale", label};
}

CO.venues = {byId, chainCount, evInfo};
})(window.CO);
