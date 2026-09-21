(function(){
const DATA = window.PISTONS_DATA;
const SCHED = DATA.sched, AWAY = DATA.away;
const NAMES = {"Boston":"Celtics","Miami":"Heat","Philadelphia":"76ers","New York":"Knicks","Charlotte":"Hornets","Brooklyn":"Nets","Washington":"Wizards","LA Lakers":"Lakers","San Antonio":"Spurs","New Orleans":"Pelicans","Toronto":"Raptors","Atlanta":"Hawks","Orlando":"Magic","Milwaukee":"Bucks","Denver":"Nuggets","Memphis":"Grizzlies","Indiana":"Pacers","Phoenix":"Suns","Cleveland":"Cavaliers","Oklahoma City":"Thunder","Chicago":"Bulls","Portland":"Trail Blazers","Sacramento":"Kings","Golden State":"Warriors","Utah":"Jazz","Dallas":"Mavericks","Houston":"Rockets","Minnesota":"Timberwolves","LA Clippers":"Clippers"};
const ABBR = {"Boston":"BOS","Miami":"MIA","Philadelphia":"PHI","New York":"NYK","Charlotte":"CHA","Brooklyn":"BKN","Washington":"WAS","LA Lakers":"LAL","San Antonio":"SAS","New Orleans":"NOP","Toronto":"TOR","Atlanta":"ATL","Orlando":"ORL","Milwaukee":"MIL","Denver":"DEN","Memphis":"MEM","Indiana":"IND","Phoenix":"PHX","Cleveland":"CLE","Oklahoma City":"OKC","Chicago":"CHI","Portland":"POR","Sacramento":"SAC","Golden State":"GSW","Utah":"UTA","Dallas":"DAL","Houston":"HOU","Minnesota":"MIN","LA Clippers":"LAC"};
const MONTHS = [["2026-10","October"],["2026-11","November"],["2026-12","December"],["2027-01","January"],["2027-02","February"],["2027-03","March"],["2027-04","April"]];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };
const fullName = c => NAMES[c] ? (c.startsWith("LA ") ? "LA " + NAMES[c] : c + " " + NAMES[c]) : c;
const dObj = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const fmtDate = (s, opts) => dObj(s).toLocaleDateString("en-US", opts || {weekday:"short", month:"short", day:"numeric"});
const fmtTime = t => { if (!t) return "TBD"; let [h,m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + String(m).padStart(2,"0") + " " + ap; };
const dayDiff = (a, b) => Math.round((dObj(b) - dObj(a)) / 86400000);
const money = n => "$" + Math.round(n).toLocaleString("en-US");

/* ---------- theme ---------- */
const root = document.documentElement;
function effectiveSkin(){
  const pref = store.get("pistons-skin");
  if (pref) return pref;
  const host = root.getAttribute("data-theme");
  if (host === "light") return "light";
  if (host === "dark") return "navy";
  return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "navy" : "light";
}
function paintSkinButtons(){
  const s = effectiveSkin();
  document.querySelectorAll(".skin button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skin === s)));
}
function applySkin(){
  const pref = store.get("pistons-skin");
  if (pref) root.setAttribute("data-skin", pref); else root.removeAttribute("data-skin");
  paintSkinButtons();
}
document.querySelectorAll(".skin button").forEach(b => b.addEventListener("click", () => { store.set("pistons-skin", b.dataset.skin); applySkin(); renderSummary(); }));
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintSkinButtons); } catch(e){}
new MutationObserver(paintSkinButtons).observe(root, {attributes:true, attributeFilter:["data-theme"]});
applySkin();

/* ---------- results merge ---------- */
let RESULTS = {};   // date -> {det, opp, opponent?, home?, note?, time?}
let GAMES = [];
function mergeGames(){
  const byDate = {};
  SCHED.forEach(g => { if (!g.tbd) byDate[g.date] = true; });
  const extra = Object.keys(RESULTS).filter(d => !byDate[d] && d >= "2026-12-03" && d <= "2026-12-11").sort();
  let ei = 0;
  GAMES = SCHED.map(g => {
    let x = Object.assign({}, g);
    if (g.tbd && ei < extra.length) {
      const r = RESULTS[extra[ei++]];
      x = { n:g.n, date:extra[ei-1], time:r.time || "", home:!!r.home, opp:r.opponent || "TBD", tv:r.tv || "", conf:r.conf || "", tz:"", note:r.note || "NBA Cup window game", filled:true };
      if (r.time) { x.iso = x.date + "T" + r.time + ":00-05:00"; }
    }
    const r = !x.tbd && RESULTS[x.date];
    if (r && typeof r.det === "number" && typeof r.opp === "number") { x.det = r.det; x.oppPts = r.opp; x.wl = r.det > r.opp ? "W" : "L"; }
    return x;
  });
  let w = 0, l = 0;
  GAMES.forEach(g => { if (g.wl) { g.wl === "W" ? w++ : l++; g.rec = w + "–" + l; } });
}

/* ---------- hero ---------- */
let cdTimer = null;
function tipTime(g){ return g.iso ? new Date(g.iso) : null; }
function nextGames(){
  const now = new Date();
  const upcoming = GAMES.filter(g => !g.tbd && !g.wl && tipTime(g) && tipTime(g).getTime() + 3*3600e3 > now.getTime());
  return upcoming;
}
function nextCard(el, label, g){
  if (!g) { el.innerHTML = `<div class="lab">${esc(label)}</div><div class="opp">Season complete</div>`; return; }
  const live = tipTime(g) <= new Date();
  el.innerHTML = `<div class="lab">${esc(label)}</div>
    <div class="opp">${g.home ? "vs" : "@"} ${esc(fullName(g.opp))}</div>
    <div class="meta">${esc(fmtDate(g.date, {weekday:"long", month:"short", day:"numeric"}))} · ${esc(fmtTime(g.time))} ET${g.tv ? " · " + esc(g.tv) : ""}${g.home ? " · Little Caesars Arena" : ""}</div>
    <div class="cd" data-iso="${esc(g.iso)}" aria-live="off">${live ? `<div style="min-width:auto;padding:6px 10px"><b>Game on</b></div>` : ""}</div>`;
}
function tick(){
  document.querySelectorAll(".cd[data-iso]").forEach(el => {
    const ms = new Date(el.dataset.iso) - new Date();
    if (ms <= 0) return;
    const d = Math.floor(ms/864e5), h = Math.floor(ms%864e5/36e5), m = Math.floor(ms%36e5/6e4), s = Math.floor(ms%6e4/1e3);
    el.innerHTML = [[d,"days"],[h,"hrs"],[m,"min"],[s,"sec"]].map(([v,u]) => `<div><b>${String(v).padStart(u==="days"?1:2,"0")}</b><span>${u}</span></div>`).join("");
  });
}
function renderHero(){
  const played = GAMES.filter(g => g.wl);
  const w = played.filter(g => g.wl === "W").length, l = played.length - w;
  $("#rec-big").textContent = w + "–" + l;
  const split = f => { const p = played.filter(f); const ww = p.filter(g => g.wl === "W").length; return ww + "–" + (p.length - ww); };
  const last = played[played.length - 1];
  $("#rec-splits").innerHTML = played.length
    ? `<span>Home <b>${split(g => g.home)}</b></span><span>Road <b>${split(g => !g.home)}</b></span><span>Last <b>${last.wl} ${last.det}–${last.oppPts}</b> ${last.home ? "vs" : "@"} ${esc(ABBR[last.opp] || last.opp)}</span>`
    : `<span>Opening night Oct 20 vs Boston</span><span><b>40</b> home · <b>40</b> road · <b>2</b> TBD</span>`;
  const up = nextGames();
  const n1 = up[0];
  let n2, l2 = "Next home game";
  if (n1 && n1.home) { n2 = up.slice(1).find(g => g.home); l2 = "Following home game"; }
  else n2 = up.find(g => g.home);
  nextCard($("#next-1"), "Next up", n1);
  nextCard($("#next-2"), l2, n2);
  tick();
  if (!cdTimer) cdTimer = setInterval(tick, 1000);
}

/* ---------- tabs ---------- */
function showTab(t){
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  ["schedule","home","summary","trips"].forEach(k => $("#p-" + k).hidden = k !== t);
  store.set("pistons-tab", t);
}
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

/* ---------- schedule ---------- */
const S = { view: store.get("pistons-view") || "list", f: "all", month: "all", calIdx: 0 };
const fm = $("#f-month");
fm.innerHTML = `<option value="all">All months</option>` + MONTHS.map(([k,n]) => `<option value="${k}">${n}</option>`).join("");
fm.addEventListener("change", () => { S.month = fm.value; if (S.month !== "all") S.calIdx = MONTHS.findIndex(m => m[0] === S.month); renderSchedule(); });
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => { S.view = b.dataset.view; store.set("pistons-view", S.view); renderSchedule(); }));
document.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => { S.f = b.dataset.f; renderSchedule(); }));

function gameNotes(g){
  const p = [];
  if (g.cup) p.push(`<span class="pill cup">NBA Cup</span>`);
  if (g.n === 1) p.push(`<span class="pill">Opener</span>`);
  if (g.date === "2027-04-07") p.push(`<span class="pill">Home finale</span>`);
  if (g.date === "2027-04-11") p.push(`<span class="pill">Finale</span>`);
  if (g.filled) p.push(`<span class="pill">${esc(g.note)}</span>`);
  return p.join("");
}
function resultCell(g){
  if (g.wl) return `<span class="res"><span class="${g.wl === "W" ? "w" : "l"}">${g.wl}</span> ${g.det}–${g.oppPts}</span>`;
  const t = tipTime(g);
  if (t && t < new Date()) return `<span class="muted nowrap">Final pending</span>`;
  return "";
}
function filterGame(g){
  if (S.f === "home" && !(g.home && !g.tbd)) return false;
  if (S.f === "away" && (g.home || g.tbd)) return false;
  if (S.month !== "all") { const k = g.tbd ? "2026-12" : g.date.slice(0,7); if (k !== S.month) return false; }
  return true;
}
function renderList(){
  const nxt = nextGames()[0];
  let rows = "", cur = "";
  GAMES.filter(filterGame).forEach(g => {
    const mk = g.tbd ? "2026-12" : g.date.slice(0,7);
    if (mk !== cur) { cur = mk; rows += `<tr class="monthrow"><td colspan="8">${MONTHS.find(m => m[0] === mk)[1]}</td></tr>`; }
    if (g.tbd) { rows += `<tr><td class="muted">${g.n}</td><td class="nowrap">Dec 3–11</td><td><span class="muted">TBD: NBA Cup knockout, or a game added by the league</span></td><td>TBD</td><td></td><td></td><td class="hidden-sm"></td><td class="hidden-sm"></td></tr>`; return; }
    rows += `<tr class="${g.home ? "home" : ""}${nxt && nxt.n === g.n ? " next-row" : ""}">
      <td class="muted">${g.n}</td>
      <td class="nowrap">${esc(fmtDate(g.date))}</td>
      <td><span class="opp-cell"><span class="ha ${g.home ? "h" : "a"}">${g.home ? "VS" : "@"}</span>${esc(fullName(g.opp))}</span></td>
      <td class="nowrap">${esc(fmtTime(g.time))}</td>
      <td><span class="tv">${esc(g.tv)}</span></td>
      <td>${resultCell(g)}</td>
      <td class="hidden-sm muted nowrap">${g.rec || ""}</td>
      <td class="hidden-sm">${gameNotes(g)}</td></tr>`;
  });
  $("#sched-list").innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Date</th><th>Opponent</th><th>Tip</th><th>TV</th><th>Result</th><th class="hidden-sm">Record</th><th class="hidden-sm">Notes</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="muted">No games match these filters.</td></tr>`}</tbody></table></div>`;
}
function renderCal(){
  const [key, name] = MONTHS[S.calIdx];
  const [y, m] = key.split("-").map(Number);
  const first = new Date(y, m-1, 1), days = new Date(y, m, 0).getDate();
  const byDate = {};
  GAMES.forEach(g => { if (!g.tbd && filterGame(Object.assign({}, g, {}))) (byDate[g.date] = byDate[g.date] || []).push(g); });
  const today = new Date(); const tkey = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0") + "-" + String(today.getDate()).padStart(2,"0");
  let cells = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < first.getDay(); i++) cells += `<div class="day out"></div>`;
  for (let d = 1; d <= days; d++) {
    const k = key + "-" + String(d).padStart(2,"0");
    const gs = (S.f === "all" || true) ? (byDate[k] || []) : [];
    let inner = gs.map(g => `<div class="g ${g.home ? "h" : "a"}" title="${esc((g.home ? "vs " : "@ ") + fullName(g.opp) + " · " + fmtTime(g.time) + " ET" + (g.tv ? " · " + g.tv : ""))}"><b>${g.home ? "vs" : "@"} ${esc(ABBR[g.opp] || g.opp)}</b><span class="t">${g.wl ? g.wl + " " + g.det + "–" + g.oppPts : esc(fmtTime(g.time))}</span></div>`).join("");
    if (key === "2026-12" && d >= 3 && d <= 11 && S.f !== "away" && S.f !== "home" && d === 3 && GAMES.some(g => g.tbd)) inner += `<div class="g tbd">2 TBD games Dec 3–11</div>`;
    cells += `<div class="day${k === tkey ? " today" : ""}"><span class="num">${d}</span>${inner}</div>`;
  }
  const trail = (7 - (first.getDay() + days) % 7) % 7;
  for (let i = 0; i < trail; i++) cells += `<div class="day out"></div>`;
  $("#sched-cal").innerHTML = `<div class="cal-head"><button type="button" class="iconbtn" id="cal-prev" aria-label="Previous month">‹</button><h3>${name} ${y}</h3><button type="button" class="iconbtn" id="cal-next" aria-label="Next month">›</button></div><div class="cal">${cells}</div>`;
  $("#cal-prev").disabled = S.calIdx === 0; $("#cal-next").disabled = S.calIdx === MONTHS.length - 1;
  $("#cal-prev").onclick = () => { S.calIdx = Math.max(0, S.calIdx - 1); renderCal(); };
  $("#cal-next").onclick = () => { S.calIdx = Math.min(MONTHS.length - 1, S.calIdx + 1); renderCal(); };
}
function renderSchedule(){
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === S.view)));
  document.querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === S.f)));
  fm.hidden = S.view === "cal";
  $("#sched-list").hidden = S.view !== "list"; $("#sched-cal").hidden = S.view !== "cal";
  if (S.view === "list") renderList(); else renderCal();
}
(function initCalMonth(){
  const now = new Date(); const k = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
  const i = MONTHS.findIndex(m => m[0] === k); S.calIdx = i >= 0 ? i : 0;
})();

/* ---------- analytics ---------- */
function stats(){
  const G = GAMES;
  const dated = G.filter(g => !g.tbd);
  const homes = dated.filter(g => g.home), aways = dated.filter(g => !g.home);
  const b2b = [];
  for (let i = 1; i < G.length; i++) { const a = G[i-1], b = G[i]; if (!a.tbd && !b.tbd && dayDiff(a.date, b.date) === 1) b2b.push([a,b]); }
  const wins = [];
  for (let i = 2; i < G.length; i++) { const a = G[i-2], c = G[i]; if (!a.tbd && !c.tbd && dayDiff(a.date, c.date) <= 3) wins.push([i-2, i]); }
  const clusters = [];
  wins.forEach(([s,e]) => { const last = clusters[clusters.length-1]; if (last && s <= last[1]) last[1] = e; else clusters.push([s,e]); });
  const rest = []; for (let i = 1; i < G.length; i++) if (!G[i].tbd && !G[i-1].tbd) rest.push({g:G[i], r:dayDiff(G[i-1].date, G[i].date) - 1});
  const streaks = []; let cur = null;
  G.forEach(g => { const k = g.tbd ? "tbd" : (g.home ? "H" : "A"); if (cur && cur.k === k) cur.games.push(g); else { cur = {k, games:[g]}; streaks.push(cur); } });
  const homestands = streaks.filter(s => s.k === "H"), trips = streaks.filter(s => s.k === "A");
  const homeGaps = []; for (let i = 1; i < homes.length; i++) homeGaps.push({from:homes[i-1], to:homes[i], d:dayDiff(homes[i-1].date, homes[i].date)});
  const maxBreak = rest.reduce((m, x) => x.r > m.r ? x : m, {r:-1});
  return {G, dated, homes, aways, b2b, clusters, rest, homestands, trips, homeGaps, maxBreak};
}
const count = (arr, f) => arr.filter(f).length;
const kv = (label, val, sub) => `<div class="kv${sub ? " sub" : ""}"><span>${label}</span><b>${val}</b></div>`;
const recOf = arr => { const p = arr.filter(g => g.wl); const w = count(p, g => g.wl === "W"); return {w, l:p.length - w, n:p.length, margin:p.length ? p.reduce((s,g) => s + g.det - g.oppPts, 0) / p.length : null}; };
const early = g => g.time && g.time < "19:00", late = g => g.time && g.time >= "21:00";

/* ---------- home tab ---------- */
function renderHome(){
  const st = stats();
  const hb2b = st.b2b.filter(([a,b]) => a.home && b.home);
  const inB2B = new Set(hb2b.flat().map(g => g.n));
  const wknd = g => [5,6,0].includes(dObj(g.date).getDay());
  const longest = st.homeGaps.reduce((m,x) => x.d > m.d ? x : m, {d:0});
  const tiles = [[st.homes.length, "home games scheduled"], [hb2b.length, "home back-to-backs"], [count(st.homes, wknd), "on Fri–Sun"], [count(st.homes, early), "start before 7 PM"], [longest.d, "days: longest wait between home games"]];
  let prev = null;
  const rows = st.homes.map((g, i) => {
    const since = prev ? dayDiff(prev.date, g.date) : "—"; prev = g;
    const pills = [inB2B.has(g.n) ? `<span class="pill b2b">Back-to-back</span>` : "", wknd(g) ? `<span class="pill">Weekend</span>` : "", early(g) ? `<span class="pill">Early start</span>` : "", g.cup ? `<span class="pill cup">NBA Cup</span>` : ""].join("");
    return `<tr><td class="muted">${i+1}</td><td class="nowrap">${esc(fmtDate(g.date))}</td><td>${esc(fullName(g.opp))}</td><td class="nowrap">${esc(fmtTime(g.time))}</td><td><span class="tv">${esc(g.tv)}</span></td><td class="muted">${since}</td><td>${resultCell(g)}</td><td>${pills}</td><td class="note hidden-sm">${esc(g.homeNote || "")}</td></tr>`;
  }).join("");
  const byMonth = MONTHS.map(([k,n]) => [n.slice(0,3), count(st.homes, g => g.date.startsWith(k))]);
  $("#p-home").innerHTML = `
    <div class="tiles">${tiles.map(([v,l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <div class="grid" style="margin-bottom:16px">
      <div class="panel"><h3>Key stretches</h3><ul class="stretch">
        <li><b>4-game homestands:</b> Nov 27–Dec 2 (4 games in 6 days), Feb 17–Mar 1, Mar 5–13, Mar 25–31.</li>
        <li><b>Home back-to-backs:</b> ${hb2b.map(([a,b]) => `${fmtDate(a.date,{month:"short",day:"numeric"})}–${dObj(b.date).getDate()} (${ABBR[a.opp]}, ${ABBR[b.opp]})`).join(", ")}.</li>
        <li><b>Longest waits:</b> ${st.homeGaps.slice().sort((a,b) => b.d - a.d).slice(0,3).map(x => `${fmtDate(x.from.date,{month:"short",day:"numeric"})} → ${fmtDate(x.to.date,{month:"short",day:"numeric"})} (${x.d} days)`).join(", ")}. The Dec gap is the NBA Cup window; a TBD game may land there.</li>
        <li><b>Holiday dates:</b> Nov 27 (day after Thanksgiving), Dec 27, Dec 30, New Year's Day. No Christmas game.</li>
        <li><b>Check the opener:</b> Tue Oct 20 vs Boston is listed at 3:00 PM. Confirm before taking the afternoon off.</li>
      </ul></div>
      <div class="panel"><h3>Home games by month</h3>
        <table class="mini"><thead><tr><th>Month</th><th>Games</th></tr></thead><tbody>${byMonth.map(([m,c]) => `<tr><td>${m}</td><td>${c}</td></tr>`).join("")}</tbody></table>
        <p class="muted" style="font-size:13px;margin:8px 0 0">March is the busiest month with 10 home dates.</p></div>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Date</th><th>Opponent</th><th>Tip</th><th>TV</th><th title="Days since the previous home game">Days since</th><th>Result</th><th>Flags</th><th class="hidden-sm">Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- summary tab ---------- */
function monthChart(st){
  const data = MONTHS.map(([k,n]) => ({m:n.slice(0,3), h:count(st.homes, g => g.date.startsWith(k)), a:count(st.aways, g => g.date.startsWith(k))}));
  const W = 520, H = 230, L = 30, B = 26, T = 22, R = 6, max = 18;
  const bw = (W - L - R) / data.length, y = v => H - B - (v / max) * (H - B - T);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Home and away games by month">`;
  [0,6,12,18].forEach(v => { s += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y(v)+4}" font-size="11" text-anchor="end">${v}</text>`; });
  data.forEach((d, i) => {
    const x = L + i*bw + bw*0.22, w = bw*0.56;
    const yh = y(d.h), ya = y(d.h + d.a);
    s += `<g><title>${d.m}: ${d.h} home, ${d.a} away</title>`;
    s += `<rect x="${x}" y="${yh}" width="${w}" height="${Math.max(0, y(0) - yh)}" fill="var(--home)" rx="2"/>`;
    s += `<rect x="${x}" y="${ya}" width="${w}" height="${Math.max(0, yh - ya - 2)}" fill="var(--away)" rx="2"/>`;
    s += `<text x="${x + w/2}" y="${ya - 6}" font-size="12" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${d.h + d.a}</text>`;
    s += `<text x="${x + w/2}" y="${H - 8}" font-size="12" text-anchor="middle">${d.m}</text></g>`;
  });
  return s + `</svg><div class="legend"><span><i style="background:var(--home)"></i>Home</span><span><i style="background:var(--away)"></i>Away</span><span>Dec also has 2 TBD games</span></div>`;
}
function renderSummary(){
  const st = stats(), G = st.G;
  const type = (a,b) => count(st.b2b, ([x,y]) => x.home === a && y.home === b);
  const four = count(st.clusters, ([s,e]) => e - s + 1 >= 4);
  const nat = ["NBC","ESPN","Prime Video","Peacock","NBA TV"];
  const dows = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], dowIdx = [1,2,3,4,5,6,0];
  const tz = [["Eastern","ET"],["Central","CT"],["Mountain","MT"],["Pacific","PT"]];
  const teams = Object.keys(ABBR).map(c => { const gs = st.dated.filter(g => g.opp === c); const any = gs[0] || {}; return {c, conf:any.conf || "", div:any.div || "", h:count(gs, g => g.home), a:count(gs, g => !g.home), first:gs[0] ? gs[0].date : ""}; })
    .sort((x,y) => (x.conf + x.div + x.c).localeCompare(y.conf + y.div + y.c));
  const R = [["Overall", G], ["Home", st.homes], ["Away", st.aways], ["vs East", st.dated.filter(g => g.conf === "East")], ["vs West", st.dated.filter(g => g.conf === "West")], ["2nd night of back-to-back", st.b2b.map(p => p[1])], ["National TV", st.dated.filter(g => g.tv && g.tv !== "NBA TV")], ["NBA Cup group", st.dated.filter(g => g.cup)]];
  $("#p-summary").innerHTML = `<div class="grid">
    <div class="panel"><h3>Season overview</h3>
      ${kv("Total games", G.length)}${kv("Home", st.homes.length)}${kv("Away", st.aways.length)}${kv("TBD (NBA Cup window, Dec 3–11)", count(G, g => g.tbd))}
      ${kv("First game", fmtDate(st.dated[0].date, {month:"short", day:"numeric", year:"numeric"}))}${kv("Last game", fmtDate(st.dated[st.dated.length-1].date, {month:"short", day:"numeric", year:"numeric"}))}
      ${kv("Season length", (dayDiff(st.dated[0].date, st.dated[st.dated.length-1].date) + 1) + " days")}${kv("NBA Cup group games", count(st.dated, g => g.cup))}</div>
    <div class="panel"><h3>Rest &amp; fatigue</h3>
      ${kv("Back-to-backs", st.b2b.length)}${kv("Home → Home", type(true,true), 1)}${kv("Away → Away", type(false,false), 1)}${kv("Home → Away", type(true,false), 1)}${kv("Away → Home", type(false,true), 1)}
      ${kv("3-games-in-4-nights stretches", st.clusters.length)}${kv("…of those, 4 games in 6 days", four, 1)}
      ${kv("Games after 1 day off", count(st.rest, x => x.r === 1))}${kv("Games after 2+ days off", count(st.rest, x => x.r >= 2))}
      ${kv("Longest break", st.maxBreak.r + " days (All-Star, ends " + fmtDate(st.maxBreak.g.date, {month:"short", day:"numeric"}) + ")")}</div>
    <div class="panel"><h3>Homestands &amp; road trips</h3>
      ${kv("Longest homestand", Math.max(...st.homestands.map(s => s.games.length)) + " games")}${kv("Longest road trip", Math.max(...st.trips.map(s => s.games.length)) + " games")}
      ${kv("Homestands of 2+ games", count(st.homestands, s => s.games.length >= 2))}${kv("Road trips of 2+ games", count(st.trips, s => s.games.length >= 2))}
      ${kv("4-game homestands", count(st.homestands, s => s.games.length === 4))}${kv("4-game road trips", count(st.trips, s => s.games.length === 4))}</div>
    <div class="panel" style="grid-column:span 1"><h3>Games by month</h3>${monthChart(st)}</div>
    <div class="panel"><h3>Record splits</h3><table class="mini"><thead><tr><th>Split</th><th>W</th><th>L</th><th>Win %</th><th>Margin</th></tr></thead><tbody>
      ${R.map(([n, arr]) => { const r = recOf(arr); return `<tr><td>${n}</td><td>${r.w}</td><td>${r.l}</td><td>${r.n ? (r.w / r.n * 100).toFixed(1) + "%" : "–"}</td><td>${r.margin === null ? "–" : (r.margin > 0 ? "+" : "") + r.margin.toFixed(1)}</td></tr>`; }).join("")}
      </tbody></table><p class="muted" style="font-size:13px;margin:8px 0 0">Fills in as scores post each night.</p></div>
    <div class="panel"><h3>Day of week</h3><table class="mini"><thead><tr><th>Day</th><th>Home</th><th>Away</th><th>Total</th></tr></thead><tbody>
      ${dows.map((d, i) => { const h = count(st.homes, g => dObj(g.date).getDay() === dowIdx[i]), a = count(st.aways, g => dObj(g.date).getDay() === dowIdx[i]); return `<tr><td>${d}</td><td>${h}</td><td>${a}</td><td>${h + a}</td></tr>`; }).join("")}</tbody></table></div>
    <div class="panel"><h3>Tip-off times (ET)</h3><table class="mini"><thead><tr><th>Window</th><th>Home</th><th>Away</th><th>Total</th></tr></thead><tbody>
      ${[["Before 7 PM", early], ["7–9 PM", g => g.time && !early(g) && !late(g)], ["9 PM or later", late]].map(([n, f]) => { const h = count(st.homes, f), a = count(st.aways, f); return `<tr><td>${n}</td><td>${h}</td><td>${a}</td><td>${h + a}</td></tr>`; }).join("")}</tbody></table>
      <h3 style="margin-top:16px">Road games by time zone</h3><table class="mini"><tbody>${tz.map(([n, c]) => `<tr><td>${n}</td><td>${count(st.aways, g => g.tz === c)}</td></tr>`).join("")}</tbody></table></div>
    <div class="panel"><h3>National TV</h3><table class="mini"><thead><tr><th>Network</th><th>Home</th><th>Away</th><th>Total</th></tr></thead><tbody>
      ${nat.map(n => { const h = count(st.homes, g => g.tv === n), a = count(st.aways, g => g.tv === n); return `<tr><td>${n}</td><td>${h}</td><td>${a}</td><td>${h + a}</td></tr>`; }).join("")}
      <tr><td><b>National (excl. NBA TV)</b></td><td>${count(st.homes, g => g.tv && g.tv !== "NBA TV")}</td><td>${count(st.aways, g => g.tv && g.tv !== "NBA TV")}</td><td><b>${count(st.dated, g => g.tv && g.tv !== "NBA TV")}</b></td></tr></tbody></table>
      <h3 style="margin-top:16px">Conference split</h3><table class="mini"><thead><tr><th></th><th>Home</th><th>Away</th><th>Total</th></tr></thead><tbody>
      ${["East","West"].map(c => `<tr><td>${c}</td><td>${count(st.homes, g => g.conf === c)}</td><td>${count(st.aways, g => g.conf === c)}</td><td>${count(st.dated, g => g.conf === c)}</td></tr>`).join("")}</tbody></table></div>
  </div>
  <div class="panel" style="margin-top:16px"><h3>Opponents</h3><div class="tbl-wrap" style="border:0"><table class="mini"><thead><tr><th style="text-align:left">Team</th><th style="text-align:left">Conf</th><th style="text-align:left" class="hidden-sm">Division</th><th>Home</th><th>Away</th><th>Total</th><th>First meeting</th></tr></thead><tbody>
    ${teams.map(t => `<tr><td style="text-align:left">${esc(fullName(t.c))}</td><td style="text-align:left">${t.conf}</td><td style="text-align:left" class="hidden-sm">${t.div}</td><td>${t.h}</td><td>${t.a}</td><td>${t.h + t.a}</td><td class="nowrap">${t.first ? fmtDate(t.first, {month:"short", day:"numeric"}) : ""}</td></tr>`).join("")}
  </tbody></table></div><p class="muted" style="font-size:13px;margin:8px 0 0">Six East teams show 3 games; the 2 TBD December games bring two of them to 4.</p></div>`;
}

/* ---------- trips tab ---------- */
const T = { rate: store.get("pistons-rate") || "all", sort: "date" };
function renderTrips(){
  const rates = [["all","All"],["Top pick","Top picks"],["Good","Good"],["Possible","Possible"],["Skip","Skip"]];
  const list = GAMES.filter(g => !g.tbd && !g.home && AWAY[g.date]).map(g => Object.assign({g}, AWAY[g.date]))
    .filter(t => T.rate === "all" || t.rating === T.rate)
    .sort((a,b) => T.sort === "cost" ? a.total - b.total : a.g.date.localeCompare(b.g.date));
  const cls = r => ({"Top pick":"top","Good":"good","Possible":"possible","Skip":"skip"}[r]);
  $("#p-trips").innerHTML = `
    <div class="bar">
      <div class="seg" role="group" aria-label="Rating">${rates.map(([k,n]) => `<button type="button" id="r-${k.replace(/\s/g,"")}" data-rate="${k}" aria-pressed="${T.rate === k}">${n}</button>`).join("")}</div>
      <span class="spacer"></span>
      <label class="muted" for="t-sort" style="font-size:14px">Sort</label>
      <select id="t-sort"><option value="date"${T.sort === "date" ? " selected" : ""}>By date</option><option value="cost"${T.sort === "cost" ? " selected" : ""}>By est. cost</option></select>
    </div>
    <div class="trips">${list.map(t => { const g = t.g; return `<article class="trip${t.rating === "Skip" ? " skipped" : ""}">
      <div class="row1"><div><div class="when">${esc(fmtDate(g.date, {weekday:"long", month:"short", day:"numeric"}))} · ${esc(fmtTime(g.time))} ET</div><h4>@ ${esc(fullName(g.opp))}</h4></div><span class="rate ${cls(t.rating)}">${esc(t.rating)}</span></div>
      <div class="cost"><b>${money(t.total)}</b><span>est. · ticket ${money(t.ticket)} + ${t.mode === "Drive" ? "gas" : "flight"} ${money(t.travel)} + ${t.nights ? t.nights + " night" + (t.nights > 1 ? "s" : "") + " × " + money(t.hotel) : "no hotel"}</span></div>
      <div class="facts"><span class="pill">${t.mode === "Drive" ? "Drive" : "Fly"} · ${esc(t.route)}</span><span class="pill">${t.since}d after home game</span><span class="pill">${t.to === "" ? "Season over after" : t.to + "d before next home"}</span>${g.tv ? `<span class="pill">${esc(g.tv)}</span>` : ""}${g.wl ? `<span class="pill b2b">${g.wl} ${g.det}–${g.oppPts}</span>` : ""}</div>
      <p>${esc(t.note)}</p></article>`; }).join("")}</div>
    <div class="foot" style="margin-top:16px">
      <div>Estimates for 1 traveler. Tickets are the 2025-26 average cheapest resale seat for that home team (Sportscasting) and don't include resale fees, often 20–30% more. Hotels are average nightly rates by city (Engine, May 2024–Apr 2026); Toronto is an estimate. Airfare is a rough typical round trip from DTW, not a live quote. Gas is about $0.15/mile.</div>
    </div>`;
  document.querySelectorAll("[data-rate]").forEach(b => b.addEventListener("click", () => { T.rate = b.dataset.rate; store.set("pistons-rate", T.rate); renderTrips(); }));
  $("#t-sort").addEventListener("change", e => { T.sort = e.target.value; renderTrips(); });
}

/* ---------- boot ---------- */
function renderAll(){ mergeGames(); renderHero(); renderSchedule(); renderHome(); renderSummary(); renderTrips(); }
renderAll();
showTab(store.get("pistons-tab") || "schedule");

/* ---------- scores: data/results.js (cache-busted so updates show right away) ---------- */
function applyResults(){
  const R = window.PISTONS_RESULTS || {};
  RESULTS = Object.assign({}, R.games || {});
  renderAll();
  if (R.updated) $("#status").textContent = "Scores update nightly after games · last updated " + new Date(R.updated).toLocaleString("en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"}) + ".";
}
(function loadResults(){
  const s = document.createElement("script");
  s.src = "data/results.js?t=" + Date.now();
  s.onload = applyResults;
  s.onerror = function(){};
  document.head.appendChild(s);
})();
})();
