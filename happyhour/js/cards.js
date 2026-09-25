/* Clock Out — the HTML for a venue card and its week-at-a-glance chart. */
(function(CO){
"use strict";
const {DAYS, DS, WEEK, TYPE1, CF, REPORT_TO} = CO.config;
const {esc, fmtT, fmtRange, fmtDur} = CO.util;
const {effWins, openInfo, schedule, schedulePlain, spFor} = CO.hours;
const {chainCount, evInfo} = CO.venues;
const {state, favs, dist} = CO.state;

const ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 2.9 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const ICON_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';

function mapsLink(v){
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(v.n + " " + v.a + " " + (/Detroit/.test(v.c) ? "Detroit" : v.c) + " MI");
}
const telLink = v => "tel:" + v.ph.replace(/[^\d+]/g, "");
/* "Something changed?" opens an email with the place's current listing filled in */
function reportLink(v){
  const body = `Bar: ${v.n}\nAddress: ${v.a}, ${v.c}\nCurrently listed: ${schedulePlain(v)}${v.d ? " — " + v.d : ""}\n\nWhat changed:\n`;
  return "mailto:" + REPORT_TO + "?subject=" + encodeURIComponent("Clock Out: " + v.n) + "&body=" + encodeURIComponent(body);
}

function hoursLine(v){
  const o = openInfo(v, state.day, state.t);
  if(!o) return "";
  if(o.closedDay) return `<div class="hours"><span class="closed">Closed ${DAYS[state.day]}s</span></div>`;
  if(o.open) return `<div class="hours">Open till <b>${fmtT(o.until)}</b></div>`;
  if(o.opens != null) return `<div class="hours"><span class="closed">Closed at ${fmtT(state.t)}</span> · opens ${fmtT(o.opens)}</div>`;
  return `<div class="hours"><span class="closed">Closed for the night</span></div>`;
}

/* Mon–Sun bars from 8am to 2am: business hours underneath, happy hours on top */
function weekView(v){
  const A = 480, Z = 1560, span = Z - A;
  const pc = m => Math.max(0, Math.min(100, (m - A)/span*100));
  let h = '<div class="week" aria-label="Happy hours by day">';
  for(const d of WEEK){
    const o = v.hoD ? v.hoD[d] : null;
    let tr = "";
    if(o) for(const r of o) tr += `<span class="open" style="left:${pc(r[0])}%;width:${pc(r[1]) - pc(r[0])}%"></span>`;
    const ws = effWins(v, d);
    for(const w of ws) tr += `<span class="hh${w.cut ? " clip" : ""}" style="left:${pc(w.s)}%;width:${Math.max(1.5, pc(w.e) - pc(w.s))}%" title="${fmtRange(w.s, w.e)}"></span>`;
    const lab = o && o.length === 0 ? "closed" : ws.length ? ws.map(w => fmtRange(w.s, w.e)).join(", ") : "no happy hour";
    h += `<span class="d${d === state.day ? " today" : ""}">${DS[d]}</span><div class="track" role="img" aria-label="${DAYS[d]}: ${lab}">${tr}</div>`;
    for(const s of spFor(v, d)) h += `<span></span><div class="spx">★ ${esc(s.txt)}</div>`;
  }
  h += '<span></span><div class="axis"><span>8a</span><span>noon</span><span>4p</span><span>8p</span><span>12a</span><span>2a</span></div></div>';
  if(!v.hoD) h += '<p style="margin:6px 0 0">Business hours unknown; bars show happy hour only.</p>';
  return h;
}

/* kind: "now" (info = activeNow result), "later" (info = laterToday result), "unknown" or "special" */
function card(v, kind, info){
  const rate = v.r ? `<span class="rate">★ <b>${v.r.toFixed(1)}</b> (${v.rc.toLocaleString()})</span>` : "";

  let pill = "";
  if(kind === "now") pill = `<span class="pill now">Until ${fmtT(info.end)} · ${fmtDur(info.left)} left</span>`;
  else if(kind === "later"){
    const inM = info.s - state.t;
    pill = `<span class="pill soon${inM <= 60 ? " imminent" : ""}">Starts ${fmtT(info.s)} · in ${fmtDur(inM)}</span>`;
  }

  const tags = [`<span class="tag conf c${v.cf}">${CF[v.cf]}</span>`];
  if(v.t === "chain") tags.push(`<span class="tag chain">Chain${chainCount[v.n] > 1 ? " · " + chainCount[v.n] + " on map" : ""}</span>`);
  if(v.pr) tags.push(`<span class="tag price">$${v.pr[0] % 1 ? v.pr[0].toFixed(2) : v.pr[0]} ${esc(v.pr[1])}</span>`);
  if(v.ap) tags.push(`<span class="approx">times approximate</span>`);

  const dd = dist(v), ev = evInfo(v);
  const sps = spFor(v, state.day).map(s => `<div class="special"><b>${DS[state.day]}:</b> ${esc(s.txt)}</div>`).join("");

  const links = [];
  if(v.ph) links.push(`<a class="call" href="${telLink(v)}">${ICON_PHONE}Call</a>`);
  links.push(`<a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`);
  if(v.w) links.push(`<a href="${esc(v.w)}" target="_blank" rel="noopener">Website</a>`);
  links.push(`<a class="report" href="${reportLink(v)}">Something changed?</a>`);

  const sch = v.win.length ? `<div class="sched">${schedule(v)}</div>` : "";
  return `<article class="card ${kind === "now" ? "active" : kind === "later" ? "later" : ""}" id="c-${kind}-${v.id}" data-id="${v.id}" tabindex="0">
  <div class="row1"><div class="titlebox"><h3>${esc(v.n)}</h3><div class="where">${esc(v.c)}${v.near ? ' <span class="tag near">nearby</span>' : ""} · ${esc(v.a)} · ${TYPE1[v.t]}${dd != null ? " · " + dd.toFixed(1) + " mi away" : ""}</div></div>
  <div class="right"><button class="star" type="button" data-fav="${v.id}" aria-pressed="${favs.has(v.id)}" aria-label="${favs.has(v.id) ? "Remove from" : "Add to"} favorites">${ICON_STAR}</button>${rate}</div></div>
  <div class="state">${pill}${tags.join("")}</div>
  ${sch}${hoursLine(v)}${sps}${v.d ? `<div class="deals">${esc(v.d)}</div>` : ""}
  <details><summary>Why I think so <span class="ev ${ev.cls}">${ev.label}</span></summary><p style="margin:6px 0 0">${esc(v.ev)}</p></details>
  <details><summary>Week at a glance</summary>${weekView(v)}</details>
  <div class="links">${links.join("")}</div></article>`;
}

CO.cards = {card, mapsLink, telLink};
})(window.CO);
