/* Clock Out — what the user has picked (day, time, filters, selection, favorites)
   and which venues pass the filters. */
(function(CO){
"use strict";
const {TYPES} = CO.config;
const {store, miles} = CO.util;
const {lateOK} = CO.hours;

const saved = store.get("clockout.state", {});
const state = {
  day: 0,                  // 0 = Sunday
  t: 0,                    // minutes after midnight
  live: false,             // following the clock: set by Now, turned off by picking a day or time
  types: new Set(saved.types || Object.keys(TYPES)),
  deals: new Set(saved.deals || []),
  unv: !!saved.unv,        // include unverified
  sort: saved.sort || "ending",
  area: saved.area && saved.area !== "near" ? saved.area : "all",
  q: "",                   // search text, lowercased
  late: false,
  fav: false,              // favorites only
  sel: null,               // selected venue id
  me: null,                // [lat, lng] once located
  tab: "list"
};
const favs = new Set(store.get("clockout.favs", []));

/* remembered between visits: types, deals, unverified, sort and area ("Near me" isn't, since it needs location) */
function save(){
  store.set("clockout.state", {types:[...state.types], deals:[...state.deals], unv:state.unv, sort:state.sort, area:state.area});
}
function saveFavs(){ store.set("clockout.favs", [...favs]); }

function inArea(v){
  if(state.area === "all" || state.area === "near") return true;
  return v.area === state.area;
}
/* every filter except Late night (the planner and specials ignore that one) */
function baseVisible(v){
  return state.types.has(v.t)
    && (state.unv || v.cf < 3)
    && inArea(v)
    && (!state.q || state.q.split(/\s+/).every(w => v.hay.includes(w)))
    && [...state.deals].every(k => v.deals.has(k))
    && (!state.fav || favs.has(v.id));
}
function visible(v){ return baseVisible(v) && (!state.late || lateOK(v, state.day)); }
function dist(v){ return state.me ? miles(v.ll, state.me) : null; }

CO.state = {state, favs, save, saveFavs, baseVisible, visible, dist};
})(window.CO);
