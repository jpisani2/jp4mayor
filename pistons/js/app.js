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
  ["today","betting","schedule","home","summary","trips"].forEach(k => $("#p-" + k).hidden = k !== t);
  store.set("pistons-tab", t);
  if (t === "today" && typeof renderToday === "function" && GAMES.length) renderToday();
  if (t === "betting" && typeof renderBetting === "function" && GAMES.length) renderBetting();
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

/* ---------- today dashboard ---------- */
let DASH = null, DASH_LATEST = null, DASH_DATES = [], DASH_PICK = "latest", DB = null;
const P = { sort: "pts", dir: -1, view: store.get("pistons-pview") === "l10" ? "l10" : "season" };
let BOXES = [];
let LINES = [], FUTURES = null;
const safeUrl = u => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
const num = v => (typeof v === "number" && isFinite(v)) ? v : null;
const pct = v => num(v) === null ? "–" : (v <= 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(1));
const isoDay = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");

function recordFromGames(){
  const p = GAMES.filter(g => g.wl);
  const r = arr => { const w = arr.filter(g => g.wl === "W").length; return w + "–" + (arr.length - w); };
  let streak = "–";
  if (p.length) { const last = p[p.length-1].wl; let n = 0; for (let i = p.length-1; i >= 0 && p[i].wl === last; i--) n++; streak = last + n; }
  return { n:p.length, overall:r(p), home:r(p.filter(g => g.home)), road:r(p.filter(g => !g.home)), l10:r(p.slice(-10)), streak, played:p };
}

function marginChart(played){
  if (!played.length) return `<p class="empty">The chart fills in after the opener on Oct 20. Each bar is one game's final margin.</p>`;
  const box = $("#p-today").clientWidth || 0;
  const W = box ? Math.round(Math.min(720, Math.max(280, (window.innerWidth > 900 ? box * 7 / 12 : box) - 40))) : 640, H = 190, L = 34, R = 8, T = 12, B = 22;
  const max = Math.max(10, ...played.map(g => Math.abs(g.det - g.oppPts)));
  const top = Math.ceil(max / 10) * 10;
  const slots = Math.max(played.length, 20);
  const bw = (W - L - R) / slots, y0 = T + (H - T - B) / 2, sc = (H - T - B) / 2 / top;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Final margin of each game played">`;
  [-top, 0, top].forEach(v => { const yy = y0 - v * sc; s += `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"${v === 0 ? "" : ' stroke-dasharray="3 3"'}/><text x="${L-6}" y="${yy+4}" font-size="11" text-anchor="end">${v > 0 ? "+" + v : v}</text>`; });
  played.forEach((g, i) => {
    const m = g.det - g.oppPts, h = Math.max(2, Math.abs(m) * sc), x = L + i * bw + bw * 0.15, w = Math.max(2, bw * 0.7);
    const yy = m >= 0 ? y0 - h : y0;
    s += `<g class="mbar"><title>${esc(fmtDate(g.date, {month:"short", day:"numeric"}))} ${g.home ? "vs" : "@"} ${esc(ABBR[g.opp] || g.opp)}: ${g.wl} ${g.det}–${g.oppPts} (${m > 0 ? "+" : ""}${m})</title><rect x="${L + i*bw}" y="${T}" width="${bw}" height="${H-T-B}" fill="transparent"/><rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="2" fill="${m >= 0 ? "var(--win)" : "var(--loss)"}"/></g>`;
  });
  s += `<text x="${L}" y="${H-6}" font-size="11">Game 1</text><text x="${W-R}" y="${H-6}" font-size="11" text-anchor="end">Game ${slots}</text>`;
  return s + `</svg><div class="legend"><span><i style="background:var(--win)"></i>Win margin</span><span><i style="background:var(--loss)"></i>Loss margin</span><span>Hover a bar for the score</span></div>`;
}

function lastGamePanel(g){
  if (!g) return `<div class="panel"><h3>Last game</h3><p class="empty">No games yet. Preseason opens Mon Oct 5 vs Phoenix; the regular season opens Tue Oct 20 vs Boston.</p></div>`;
  const win = num(g.det) !== null && num(g.opp) !== null && g.det > g.opp;
  const oppName = esc(g.opponent || "Opponent");
  const q = g.quarters && Array.isArray(g.quarters.det) && Array.isArray(g.quarters.opp) && g.quarters.det.length ? g.quarters : null;
  const qLabels = q ? (q.labels || q.det.map((_, i) => i < 4 ? String(i+1) : "OT" + (i > 4 ? i - 3 : ""))) : [];
  const box = Array.isArray(g.box) ? g.box : [];
  let firstBench = box.findIndex(p => !p.starter);
  const boxRows = box.map((p, i) => `<tr${i === firstBench && i > 0 ? ' class="bench-start"' : ""}><td>${esc(p.name)}</td><td>${esc(p.min ?? "")}</td><td><b>${esc(p.pts ?? "")}</b></td><td>${esc(p.reb ?? "")}</td><td>${esc(p.ast ?? "")}</td><td class="hidden-sm">${esc(p.stl ?? "")}</td><td class="hidden-sm">${esc(p.blk ?? "")}</td><td>${esc(p.fg ?? "")}</td><td class="hidden-sm">${esc(p.tp ?? "")}</td><td class="hidden-sm">${num(p.pm) === null ? "" : (p.pm > 0 ? "+" : "") + p.pm}</td></tr>`).join("");
  const link = safeUrl(g.link);
  return `<div class="panel"><h3>Last game<span class="tag">${esc(g.type || "")}</span></h3>
    <div class="muted" style="font-size:13.5px">${g.date ? esc(fmtDate(g.date, {weekday:"long", month:"long", day:"numeric"})) : ""}${g.home ? " · Little Caesars Arena" : ""}</div>
    <div class="score">
      <div class="tm"><span>Detroit</span><b>Pistons</b></div>
      <div class="pts"><span class="${win ? "" : "lo"}">${esc(g.det)}</span><span class="wl ${win ? "W" : "L"}">${win ? "W" : "L"}</span><span class="${win ? "lo" : ""}">${esc(g.opp)}</span></div>
      <div class="tm r"><span>${g.home ? "vs" : "@"}</span><b>${oppName}</b></div>
    </div>
    ${q ? `<table class="mini qtr"><thead><tr><th></th>${qLabels.map(l => `<th>${esc(l)}</th>`).join("")}<th>T</th></tr></thead><tbody>
      <tr><td>DET</td>${q.det.map(v => `<td>${esc(v)}</td>`).join("")}<td>${esc(g.det)}</td></tr>
      <tr><td>${esc(g.oppAbbr || "OPP")}</td>${q.opp.map(v => `<td>${esc(v)}</td>`).join("")}<td>${esc(g.opp)}</td></tr></tbody></table>` : ""}
    ${g.summary ? `<p style="margin:0 0 4px;font-size:15px">${esc(g.summary)}</p>` : ""}
    ${Array.isArray(g.leaders) && g.leaders.length ? `<div class="leaders">${g.leaders.map(l => `<div class="leader"><div class="k">${esc(l.k)}</div><b>${esc(l.name)}</b><span>${esc(l.line)}</span></div>`).join("")}</div>` : ""}
    ${box.length ? `<details><summary style="cursor:pointer;font-weight:600">Pistons box score</summary><div class="tbl-wrap" style="margin-top:8px"><table class="mini box"><thead><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th class="hidden-sm">Stl</th><th class="hidden-sm">Blk</th><th>FG</th><th class="hidden-sm">3PT</th><th class="hidden-sm">+/-</th></tr></thead><tbody>${boxRows}</tbody></table></div></details>` : ""}
    ${link ? `<p style="margin:10px 0 0;font-size:13.5px"><a href="${esc(link)}" target="_blank" rel="noopener">Full box score ↗</a></p>` : ""}
    ${presserBlock(g)}
  </div>`;
}

/* postgame press conferences: links found by the morning task, else a YouTube search */
function presserBlock(g){
  const list = (Array.isArray(g.pressers) ? g.pressers : []).map(p => ({ ...p, url: safeUrl(p && p.url) })).filter(p => p.url);
  const q = encodeURIComponent(`Detroit Pistons postgame press conference ${g.opponent || ""} ${g.date ? fmtDate(g.date, {month:"long", day:"numeric", year:"numeric"}) : ""}`.replace(/\s+/g, " ").trim());
  const search = `https://www.youtube.com/results?search_query=${q}`;
  const items = list.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="pr-play" aria-hidden="true">▶</span><span><b>${esc(p.who || p.title || "Press conference")}</b>${p.title && p.who ? `<small>${esc(p.title)}</small>` : ""}</span><em>${esc(p.source || (/youtu/i.test(p.url) ? "YouTube" : "Video"))}</em></a></li>`).join("");
  return `<div class="pressers"><div class="k">Postgame pressers</div>
    ${items ? `<ul>${items}</ul>` : `<p class="empty" style="font-size:13.5px">Not posted yet when the dashboard was built.</p>`}
    <a class="pr-more" href="${esc(search)}" target="_blank" rel="noopener">${items ? "More on YouTube" : "Search YouTube for this game's pressers"} ↗</a>
  </div>`;
}

/* previous day's dashboard, for day-over-day movement */
const PREV_CACHE = {}, PREV_PENDING = {};
function prevDash(){
  const D = DASH;
  if (!D || !D.date) return null;
  const pd = DASH_DATES.find(x => x < D.date);
  if (!pd) return null;
  if (pd in PREV_CACHE) return PREV_CACHE[pd] ? { date: pd, doc: PREV_CACHE[pd] } : null;
  if (DB && !PREV_PENDING[pd]) {
    PREV_PENDING[pd] = true;
    DB.doc("daily/" + pd).get().then(snap => { PREV_CACHE[pd] = snap.exists ? snap.data() : null; renderToday(); })
      .catch(() => { PREV_CACHE[pd] = null; });
  }
  return null;
}
const teamKey = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isDet = t => /detroit|pistons/i.test(String(t || ""));
function rankMoves(st){
  const out = {}, pv = prevDash();
  if (!pv || !st || !Array.isArray(st.rows)) return { moves: out, since: null };
  const ps = pv.doc && pv.doc.standings;
  if (!ps || !Array.isArray(ps.rows) || (ps.title || "") !== (st.title || "")) return { moves: out, since: null };
  const prev = {}; ps.rows.forEach(x => { prev[teamKey(x.team)] = Number(x.rank); });
  st.rows.forEach(x => { const k = teamKey(x.team), was = prev[k]; if (was && Number(x.rank)) out[k] = was - Number(x.rank); });
  return { moves: out, since: pv.date };
}
const shortDay = d => fmtDate(d, {month:"short", day:"numeric"});
function moveTag(delta, since){
  if (!delta) return "";
  const up = delta > 0, n = Math.abs(delta);
  return `<span class="mv ${up ? "up" : "down"}" title="${up ? "Up" : "Down"} ${n} since ${esc(shortDay(since))}" aria-label="${up ? "up" : "down"} ${n}">${up ? "▲" : "▼"}${n}</span>`;
}
const ordinal = n => { const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function recordPanel(){
  const r = recordFromGames(), d = (DASH && DASH.record) || {};
  const st = DASH && DASH.standings;
  const live = st && Array.isArray(st.rows) && !/2025-26/.test(st.title || "");
  const detRow = live ? st.rows.find(x => isDet(x.team)) : null;
  const seedTxt = d.conf ? esc(d.conf) : (detRow && Number(detRow.rank) ? ordinal(Number(detRow.rank)) : "–");
  let seedMove = "";
  if (detRow) { const m = rankMoves(st); seedMove = moveTag(m.moves[teamKey(detRow.team)], m.since); }
  const gbRaw = d.gb !== undefined && d.gb !== null && d.gb !== "" ? d.gb : (detRow ? detRow.gb : "");
  const gb = gbRaw !== "" && gbRaw !== undefined ? esc(gbRaw) : "–";
  const avg = r.n ? r.played.reduce((s, g) => s + g.det - g.oppPts, 0) / r.n : null;
  return `<div class="panel"><h3>Record</h3>
    <div class="recgrid">
      <div><b>${r.overall}</b><span>Overall</span></div>
      <div><b>${r.n ? r.l10 : "–"}</b><span>Last ${r.n && r.n < 10 ? r.n : 10}</span></div>
      <div><b>${seedTxt}${seedMove}</b><span>East seed</span></div>
      <div><b>${gb}</b><span>Games back</span></div>
      <div><b>${r.home}</b><span>Home</span></div>
      <div><b>${r.road}</b><span>Road</span></div>
      <div><b>${r.n ? r.streak : "–"}</b><span>Streak</span></div>
      <div><b>${avg === null ? "–" : (avg > 0 ? "+" : "") + avg.toFixed(1)}</b><span>Avg margin</span></div>
    </div>
    <h3 style="margin-top:14px;font-size:17px">Season so far</h3>${marginChart(r.played)}
  </div>`;
}

function standingsPanel(st){
  if (!st || !Array.isArray(st.rows) || !st.rows.length) return `<div class="panel"><h3>East standings</h3><p class="empty">Standings will appear after the first refresh.</p></div>`;
  const hasL10 = st.rows.some(x => x.l10), hasStrk = st.rows.some(x => x.strk);
  const { moves, since } = rankMoves(st);
  const anyMove = Object.values(moves).some(v => v);
  return `<div class="panel"><h3>${esc(st.title || "East standings")}</h3>
    <table class="mini stand"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>GB</th>${hasL10 ? `<th class="hidden-sm">L10</th>` : ""}${hasStrk ? `<th>Strk</th>` : ""}</tr></thead><tbody>
    ${st.rows.map(x => `<tr class="${isDet(x.team) ? "det" : ""}${x.rank === 7 || x.rank === 11 ? " cut" : ""}"><td>${esc(x.rank)}</td><td>${esc(x.team)}${moveTag(moves[teamKey(x.team)], since)}</td><td>${esc(x.w)}</td><td>${esc(x.l)}</td><td>${esc(x.gb ?? "")}</td>${hasL10 ? `<td class="hidden-sm">${esc(x.l10 ?? "")}</td>` : ""}${hasStrk ? `<td>${esc(x.strk ?? "")}</td>` : ""}</tr>`).join("")}
    </tbody></table>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">${st.note ? esc(st.note) + " " : ""}${since ? (anyMove ? `Arrows show seed changes since ${esc(shortDay(since))}. ` : `No seed changes since ${esc(shortDay(since))}. `) : ""}Dashed lines: top 6 go straight to the playoffs, 7–10 play in.</p></div>`;
}

/* last-N player averages from stored box scores */
const splitMA = v => { const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(v ?? "").trim()); return m ? [Number(m[1]), Number(m[2])] : null; };
function lastNRows(n){
  const D = DASH || {};
  const cutoff = D.forDate || isoDay(new Date());
  const games = BOXES.filter(g => g && g.date && g.date <= cutoff && Array.isArray(g.box) && g.box.length && !/preseason/i.test(g.type || ""))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  const acc = {};
  games.forEach(g => g.box.forEach(p => {
    if (!p || !p.name) return;
    const a = acc[p.name] = acc[p.name] || { name: p.name, gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, ftSeen: false };
    a.gp++; ["min","pts","reb","ast","stl","blk"].forEach(k => { a[k] += Number(p[k]) || 0; });
    const fg = splitMA(p.fg), tp = splitMA(p.tp), ft = splitMA(p.ft);
    if (fg) { a.fgm += fg[0]; a.fga += fg[1]; } if (tp) { a.tpm += tp[0]; a.tpa += tp[1]; } if (ft) { a.ftm += ft[0]; a.fta += ft[1]; a.ftSeen = true; }
  }));
  const pos = {}; ((D.players && D.players.rows) || []).forEach(r => { pos[r.name] = r.pos; });
  const rows = Object.values(acc).map(a => ({ name: a.name, pos: pos[a.name] || "", gp: a.gp,
    min: a.min / a.gp, pts: a.pts / a.gp, reb: a.reb / a.gp, ast: a.ast / a.gp, stl: a.stl / a.gp, blk: a.blk / a.gp,
    fg: a.fga ? a.fgm / a.fga : null, tp: a.tpa ? a.tpm / a.tpa : null, ft: a.ftSeen && a.fta ? a.ftm / a.fta : null }));
  return { rows, games };
}

function playersPanel(pl){
  const cols = [["name","Player"],["gp","GP"],["min","MIN"],["pts","PTS"],["reb","REB"],["ast","AST"],["stl","STL",1],["blk","BLK",1],["fg","FG%"],["tp","3P%"],["ft","FT%",1]];
  const toggle = `<div class="seg" role="group" aria-label="Stat range"><button type="button" data-pview="season" aria-pressed="${P.view === "season"}">Season</button><button type="button" data-pview="l10" aria-pressed="${P.view === "l10"}">Last 10 games</button></div>`;
  let title, note, src;
  if (P.view === "l10") {
    const l = lastNRows(10);
    src = l.rows;
    title = l.games.length && l.games.length < 10 ? `Player stats · last ${l.games.length} game${l.games.length > 1 ? "s" : ""}` : "Player stats · last 10 games";
    note = l.games.length
      ? `Per-game averages over the Pistons' last ${l.games.length} game${l.games.length > 1 ? "s" : ""} (${esc(shortDay(l.games[l.games.length-1].date))} – ${esc(shortDay(l.games[0].date))}), from box scores. GP counts games played in that stretch.`
      : "";
  } else {
    src = pl && Array.isArray(pl.rows) ? pl.rows : [];
    title = (pl && pl.title) || "Player stats";
    note = pl && pl.note ? esc(pl.note) : "";
  }
  const head = `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 12px;margin-bottom:10px"><h3 style="margin:0">${esc(title)}</h3>${toggle}</div>`;
  if (!src.length) {
    const msg = P.view === "l10" ? "Last-10 averages start with the first regular-season game on Oct 20 and fill in as box scores come in." : "Player stats will appear after the first refresh.";
    return `<div class="panel">${head}<p class="empty">${msg}</p></div>`;
  }
  const rows = src.slice().sort((a,b) => {
    if (P.sort === "name") return P.dir * String(a.name).localeCompare(String(b.name));
    const x = num(a[P.sort]), y = num(b[P.sort]);
    if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1;
    return P.dir * (x - y);
  });
  const cell = (k, v) => k === "name" ? esc(v) : (["fg","tp","ft"].includes(k) ? pct(num(v)) : (num(v) === null ? "–" : (k === "gp" ? Math.round(v) : v.toFixed(1))));
  return `<div class="panel">${head}
    <div class="tbl-wrap" style="border:0"><table class="mini box"><thead><tr>${cols.map(([k,l,sm]) => `<th${sm ? ' class="hidden-sm"' : ""}><button type="button" class="sort-btn" data-psort="${k}"${P.sort === k ? ` aria-sort="${P.dir > 0 ? "ascending" : "descending"}"` : ""}>${l}${P.sort === k ? (P.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(([k,,sm]) => `<td${sm ? ' class="hidden-sm"' : ""}>${k === "pts" ? "<b>" + cell(k, r[k]) + "</b>" : cell(k, r[k])}${k === "name" && r.pos ? ` <span class="muted" style="font-size:12px">${esc(r.pos)}</span>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${note ? `<p class="muted" style="font-size:12.5px;margin:8px 0 0">${note}</p>` : ""}</div>`;
}

function injuriesPanel(list, note){
  const cls = s => /out/i.test(s) ? "out" : (/question|doubt|day/i.test(s) ? "q" : "p");
  return `<div class="panel"><h3>Injury report</h3>
    ${Array.isArray(list) && list.length ? list.map(i => `<div class="inj"><div><b>${esc(i.name)}</b><div class="muted" style="font-size:13.5px">${esc(i.detail || "")}${i.updated ? " · " + esc(i.updated) : ""}</div></div><span class="st ${cls(i.status)}">${esc(i.status)}</span></div>`).join("") : `<p class="empty">No Pistons injuries listed.</p>`}
    ${note ? `<p class="muted" style="font-size:12.5px;margin:8px 0 0">${esc(note)}</p>` : ""}</div>`;
}

function newsPanel(list){
  return `<div class="panel"><h3>Headlines</h3>
    ${Array.isArray(list) && list.length ? `<ul class="news">${list.map(n => { const u = safeUrl(n.url); return `<li><div class="when">${esc(n.date ? fmtDate(n.date, {month:"short", day:"numeric"}) : "")}${n.source ? " · " + esc(n.source) : ""}</div>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n.title)}</a>` : `<b>${esc(n.title)}</b>`}${n.blurb ? `<p>${esc(n.blurb)}</p>` : ""}</li>`; }).join("")}</ul>` : `<p class="empty">No new headlines.</p>`}</div>`;
}

function nextPanel(n, up){
  if (!n) return `<div class="panel"><h3>Next game</h3><p class="empty">The next game preview will appear after the first refresh.</p></div>`;
  return `<div class="panel prev"><h3>Next game<span class="tag">${esc(n.type || "")}</span></h3>
    <div class="opp">${n.home ? "vs" : "@"} ${esc(n.opponent)}</div>
    <div class="muted" style="font-size:14px">${n.date ? esc(fmtDate(n.date, {weekday:"long", month:"short", day:"numeric"})) : ""}${n.time ? " · " + esc(fmtTime(n.time)) + " ET" : ""}${n.tv ? " · " + esc(n.tv) : ""}${n.venue ? " · " + esc(n.venue) : ""}</div>
    ${n.oppRecord ? `<div class="kv" style="margin-top:8px"><span class="nowrap" style="flex:none">Opponent record</span><b class="long">${esc(n.oppRecord)}</b></div>` : ""}
    ${n.preview ? `<p>${esc(n.preview)}</p>` : ""}
    ${n.watch ? `<p><b>Watch for:</b> ${esc(n.watch)}</p>` : ""}
    ${Array.isArray(up) && up.length ? `<div class="upnext"><div class="eyebrow" style="margin-bottom:4px">After that</div>${up.map(u => `<div class="kv"><span>${esc(u.date ? fmtDate(u.date) : "")}${u.type && u.type !== "Regular season" ? " · " + esc(u.type) : ""}</span><b>${u.home ? "vs" : "@"} ${esc(u.opponent)}${u.time ? " · " + esc(fmtTime(u.time)) : ""}</b></div>`).join("")}</div>` : ""}
  </div>`;
}

function renderToday(){
  const el = $("#p-today");
  const D = DASH || {};
  const picker = DASH_DATES.length ? `<div><label for="dash-day">Dashboard for</label><select id="dash-day"><option value="latest"${DASH_PICK === "latest" ? " selected" : ""}>Latest</option>${DASH_DATES.map(d => `<option value="${esc(d)}"${DASH_PICK === d ? " selected" : ""}>${esc(fmtDate(d, {weekday:"short", month:"short", day:"numeric"}))}</option>`).join("")}</select></div>` : "";
  let sub = "Waiting for the first morning refresh.";
  if (D.updated) {
    const u = new Date(D.updated);
    sub = (D.forDate ? "Covers everything through " + fmtDate(D.forDate, {weekday:"short", month:"short", day:"numeric"}) + " · " : "") + "refreshed " + u.toLocaleString("en-US", {weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
    if (DASH_PICK === "latest" && Date.now() - u.getTime() > 36 * 3600e3) sub += " · the next refresh is due tomorrow morning";
  }
  el.innerHTML = `
    <div class="dash-top"><div><div class="eyebrow">${esc(D.phase || "Daily dashboard")}</div><h2>${D.date ? esc(fmtDate(D.date, {weekday:"long", month:"long", day:"numeric"})) : "Pistons daily"}</h2><div class="sub">${esc(sub)}</div></div>${picker}</div>
    ${D.headline ? `<div class="headline">${esc(D.headline)}</div>` : ""}
    <div class="dgrid">
      <div class="span-7">${lastGamePanel(D.lastGame)}</div>
      <div class="span-5">${nextPanel(D.nextGame, D.upcoming)}</div>
      <div class="span-7">${recordPanel()}</div>
      <div class="span-5">${standingsPanel(D.standings)}</div>
      <div class="span-12">${playersPanel(D.players)}</div>
      <div class="span-5">${injuriesPanel(D.injuries, D.injuryNote)}</div>
      <div class="span-7">${newsPanel(D.news)}</div>
    </div>`;
  const sel = $("#dash-day");
  if (sel) sel.addEventListener("change", () => pickDay(sel.value));
  el.querySelectorAll("[data-pview]").forEach(b => b.addEventListener("click", () => {
    P.view = b.dataset.pview; store.set("pistons-pview", P.view); renderToday();
    const again = el.querySelector(`[data-pview="${P.view}"]`); if (again) again.focus();
  }));
  el.querySelectorAll("[data-psort]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.psort;
    if (P.sort === k) P.dir = -P.dir; else { P.sort = k; P.dir = k === "name" ? 1 : -1; }
    renderToday();
    const again = el.querySelector(`[data-psort="${k}"]`); if (again) again.focus();
  }));
}

let rzT = null, lastW = window.innerWidth;
window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; renderToday(); renderBetting(); } }, 200); });
async function pickDay(d){
  DASH_PICK = d;
  if (d === "latest" || !DB) { DASH = DASH_LATEST; renderToday(); return; }
  try {
    const snap = await DB.doc("daily/" + d).get();
    DASH = snap.exists ? snap.data() : DASH_LATEST;
  } catch(e) { DASH = DASH_LATEST; }
  renderToday();
}

/* ---------- betting ---------- */
const sgn = n => num(n) === null ? "–" : (n === 0 ? "PK" : (n > 0 ? "+" : "") + (Number.isInteger(n) ? n : n.toFixed(1)));
const mlTxt = n => num(n) === null ? "–" : (n > 0 ? "+" + n : String(n));
const implied = n => num(n) === null ? null : (n < 0 ? -n / (-n + 100) : 100 / (n + 100));
const hasFinal = l => num(l.det) !== null && num(l.opp) !== null;
const counts = l => !/preseason/i.test(l.type || "");
function atsOf(l){ if (!hasFinal(l) || num(l.spread) === null) return null; const m = l.det - l.opp + l.spread; return { m, r: m > 0 ? "W" : m < 0 ? "L" : "P" }; }
function ouOf(l){ if (!hasFinal(l) || num(l.total) === null) return null; const t = l.det + l.opp; return { t, r: t > l.total ? "O" : t < l.total ? "U" : "P" }; }
const tally = (arr, f) => { const c = { W:0, L:0, P:0, O:0, U:0 }; arr.forEach(l => { const x = f(l); if (x) c[x.r]++; }); return c; };
const wlp = c => `${c.W}–${c.L}${c.P ? "–" + c.P : ""}`;
const oup = c => `${c.O}–${c.U}${c.P ? "–" + c.P : ""}`;
const lineTxt = l => num(l.spread) === null ? "–" : (l.spread === 0 ? "PK" : "DET " + sgn(l.spread));

function coverChart(list){
  const pts = list.map(l => ({ l, a: atsOf(l) })).filter(x => x.a);
  if (!pts.length) return `<p class="empty">Fills in once regular-season games have a final score and a closing line. Each bar is how much the Pistons beat (or missed) the spread by.</p>`;
  const box = $("#p-betting").clientWidth || 0;
  const W = box ? Math.round(Math.min(720, Math.max(280, (window.innerWidth > 900 ? box * 7 / 12 : box) - 40))) : 640, H = 180, L = 34, R = 8, T = 12, B = 22;
  const top = Math.ceil(Math.max(10, ...pts.map(x => Math.abs(x.a.m))) / 10) * 10;
  const slots = Math.max(pts.length, 20), bw = (W - L - R) / slots, y0 = T + (H - T - B) / 2, sc = (H - T - B) / 2 / top;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cover margin against the spread, by game">`;
  [-top, 0, top].forEach(v => { const yy = y0 - v * sc; s += `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"${v === 0 ? "" : ' stroke-dasharray="3 3"'}/><text x="${L-6}" y="${yy+4}" font-size="11" text-anchor="end">${v > 0 ? "+" + v : v}</text>`; });
  pts.forEach(({ l, a }, i) => {
    const h = Math.max(2, Math.abs(a.m) * sc), x = L + i * bw + bw * 0.15, w = Math.max(2, bw * 0.7), yy = a.m >= 0 ? y0 - h : y0;
    const fill = a.r === "W" ? "var(--win)" : a.r === "L" ? "var(--loss)" : "var(--muted)";
    s += `<g><title>${esc(shortDay(l.date))} ${l.home ? "vs" : "@"} ${esc(l.oppAbbr || l.opponent || "")}: ${lineTxt(l)}, final ${l.det}–${l.opp}. ${a.r === "W" ? "Covered by " + Math.abs(a.m) : a.r === "L" ? "Missed by " + Math.abs(a.m) : "Push"}</title><rect x="${L + i*bw}" y="${T}" width="${bw}" height="${H-T-B}" fill="transparent"/><rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="2" fill="${fill}"/></g>`;
  });
  const avg = pts.reduce((t, x) => t + x.a.m, 0) / pts.length;
  s += `<text x="${L}" y="${H-6}" font-size="11">Game 1</text><text x="${W-R}" y="${H-6}" font-size="11" text-anchor="end">Game ${slots}</text></svg>`;
  return s + `<div class="legend"><span><i style="background:var(--win)"></i>Covered</span><span><i style="background:var(--loss)"></i>Didn't cover</span><span>Avg vs spread <b style="color:var(--ink)">${avg > 0 ? "+" : ""}${avg.toFixed(1)}</b></span></div>`;
}

function nextLinePanel(){
  const today = isoDay(new Date());
  const open = LINES.filter(l => !hasFinal(l) && l.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const l = open[0];
  const ng = (DASH && DASH.nextGame) || null;
  if (!l) {
    const g = ng || nextGames()[0];
    const who = g ? `${g.home ? "vs" : "@"} ${esc(g.opponent || fullName(g.opp))}` : "";
    return `<div class="panel"><h3>Next line</h3>${who ? `<div class="prev"><div class="opp">${who}</div><div class="muted" style="font-size:14px">${g.date ? esc(fmtDate(g.date, {weekday:"long", month:"short", day:"numeric"})) : ""}</div></div>` : ""}<p class="empty" style="margin-top:8px">No line posted yet. Sportsbooks usually post NBA lines the day before, and the dashboard picks them up the next morning.</p></div>`;
  }
  const p = implied(l.mlDet);
  const move = (now, was, fmt) => num(was) !== null && num(now) !== null && was !== now ? `<small>Opened ${fmt(was)}</small>` : (num(was) !== null ? `<small>Unchanged since open</small>` : "");
  const fav = num(l.spread) === null ? "" : l.spread < 0 ? `Detroit favored by ${Math.abs(l.spread)}` : l.spread > 0 ? `Detroit a ${l.spread}-point underdog` : "Pick'em";
  return `<div class="panel prev"><h3>Next line<span class="tag">${esc(l.type || "")}</span></h3>
    <div class="opp">${l.home ? "vs" : "@"} ${esc(l.opponent || "")}</div>
    <div class="muted" style="font-size:14px">${esc(fmtDate(l.date, {weekday:"long", month:"short", day:"numeric"}))}${fav ? " · " + esc(fav) : ""}</div>
    <div class="bet-line">
      <div><span>Spread</span><b>${lineTxt(l)}</b>${move(l.spread, l.spreadOpen, sgn)}</div>
      <div><span>Total (O/U)</span><b>${num(l.total) === null ? "–" : l.total}</b>${move(l.total, l.totalOpen, v => v)}</div>
      <div><span>Moneyline</span><b>${mlTxt(l.mlDet)}</b><small>${esc(l.oppAbbr || "Opp")} ${mlTxt(l.mlOpp)}${p !== null ? ` · implies ${Math.round(p * 100)}% DET` : ""}</small></div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:6px 0 0">${esc(l.book || "Sportsbook")}${l.updated ? " · as of " + esc(new Date(l.updated).toLocaleString("en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})) : ""}</p></div>`;
}

function lastLinePanel(){
  const done = LINES.filter(l => hasFinal(l)).sort((a, b) => b.date.localeCompare(a.date));
  const l = done[0];
  if (!l) return `<div class="panel"><h3>Last line</h3><p class="empty">No graded games yet. After each game this shows the closing spread, the final, and whether the Pistons covered and the game went over or under.</p></div>`;
  const a = atsOf(l), o = ouOf(l), won = l.det > l.opp, diff = Math.abs(l.det - l.opp);
  let explain = "";
  if (a) {
    const need = l.spread < 0 ? `needed to win by more than ${Math.abs(l.spread)}` : l.spread > 0 ? `could lose by up to ${l.spread - (Number.isInteger(l.spread) ? 1 : 0.5)}` : "needed to win";
    explain = `${won ? "Won" : "Lost"} by ${diff} as ${l.spread < 0 ? "a " + Math.abs(l.spread) + "-point favorite" : l.spread > 0 ? "a " + l.spread + "-point underdog" : "a pick'em"} (${need}).`;
  }
  return `<div class="panel prev"><h3>Last line<span class="tag">${esc(l.type || "")}</span></h3>
    <div class="opp">${l.home ? "vs" : "@"} ${esc(l.opponent || "")}</div>
    <div class="muted" style="font-size:14px">${esc(fmtDate(l.date, {weekday:"long", month:"short", day:"numeric"}))} · Final ${won ? "W" : "L"} ${l.det}–${l.opp}</div>
    <div class="bet-line">
      <div><span>Spread ${esc(lineTxt(l))}</span><b>${a ? `<span class="verdict ${a.r}">${a.r === "W" ? "Covered" : a.r === "L" ? "No cover" : "Push"}</span>` : "–"}</b>${a ? `<small>${a.r === "P" ? "Landed on the number" : (a.r === "W" ? "By " : "Missed by ") + Math.abs(a.m)}</small>` : ""}</div>
      <div><span>Total ${num(l.total) === null ? "–" : l.total}</span><b>${o ? `<span class="verdict ${o.r}">${o.r === "O" ? "Over" : o.r === "U" ? "Under" : "Push"}</span>` : "–"}</b>${o ? `<small>${o.t} points scored</small>` : ""}</div>
      <div><span>Moneyline ${mlTxt(l.mlDet)}</span><b><span class="verdict ${won ? "W" : "L"}">${won ? "Cashed" : "Lost"}</span></b>${num(l.mlDet) !== null && won ? `<small>$100 returned $${(100 + (l.mlDet > 0 ? l.mlDet : 10000 / -l.mlDet)).toFixed(0)}</small>` : ""}</div>
    </div>
    ${explain ? `<p>${esc(explain)}</p>` : ""}</div>`;
}

function betRecordsPanel(){
  const g = LINES.filter(l => counts(l) && hasFinal(l)).sort((a, b) => a.date.localeCompare(b.date));
  const ats = tally(g, atsOf), ou = tally(g, ouOf);
  const graded = ats.W + ats.L;
  const fav = g.filter(l => num(l.spread) !== null && l.spread < 0), dog = g.filter(l => num(l.spread) !== null && l.spread > 0);
  const l10 = g.filter(l => atsOf(l)).slice(-10);
  const t = (v, k) => `<div><b>${g.length ? v : "–"}</b><span>${k}</span></div>`;
  return `<div class="panel"><h3>Against the spread</h3>
    <div class="bet-tiles">
      ${t(wlp(ats), "ATS record")}${t(graded ? Math.round(ats.W / graded * 100) + "%" : "–", "Cover rate")}
      ${t(wlp(tally(l10, atsOf)), `Last ${l10.length && l10.length < 10 ? l10.length : 10} ATS`)}${t(oup(ou), "Overs–unders")}
      ${t(wlp(tally(g.filter(l => l.home), atsOf)), "Home ATS")}${t(wlp(tally(g.filter(l => !l.home), atsOf)), "Road ATS")}
      ${t(wlp(tally(fav, atsOf)), g.length ? `As favorite (${fav.length})` : "As favorite")}${t(wlp(tally(dog, atsOf)), g.length ? `As underdog (${dog.length})` : "As underdog")}
    </div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">Regular season, NBA Cup and playoffs, graded against the closing line. Preseason lines show in the log but don't count.</p></div>`;
}

function betLogPanel(){
  const rows = LINES.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return `<div class="panel"><h3>Line log</h3><p class="empty">Every Pistons game with a posted line will be listed here, newest first.</p></div>`;
  return `<div class="panel"><h3>Line log</h3><div class="tbl-wrap" style="border:0"><table class="mini box betlog"><thead><tr><th>Date</th><th>Opponent</th><th>Spread</th><th>O/U</th><th class="hidden-sm">ML</th><th>Final</th><th>ATS</th><th>Total</th></tr></thead><tbody>
    ${rows.map(l => { const a = atsOf(l), o = ouOf(l), f = hasFinal(l); return `<tr><td>${esc(shortDay(l.date))}</td><td>${l.home ? "vs" : "@"} ${esc(l.oppAbbr || l.opponent || "")}${counts(l) ? "" : ` <span class="pill">Pre</span>`}</td><td>${esc(lineTxt(l).replace("DET ", ""))}</td><td>${num(l.total) === null ? "–" : l.total}</td><td class="hidden-sm">${mlTxt(l.mlDet)}</td><td>${f ? `${l.det > l.opp ? "W" : "L"} ${l.det}–${l.opp}` : `<span class="muted">Upcoming</span>`}</td><td>${a ? `<span class="verdict ${a.r}" style="font-size:11px;padding:3px 6px">${a.r === "W" ? "Cover" : a.r === "L" ? "Miss" : "Push"}</span>` : "–"}</td><td>${o ? `<span class="verdict ${o.r}" style="font-size:11px;padding:3px 6px">${o.r === "O" ? "Over" : o.r === "U" ? "Under" : "Push"}</span>` : "–"}</td></tr>`; }).join("")}
    </tbody></table></div></div>`;
}

function futuresPanel(){
  const f = FUTURES;
  if (!f || !Array.isArray(f.items) || !f.items.length) return `<div class="panel"><h3>Futures</h3><p class="empty">Season-long odds will appear after the next refresh.</p></div>`;
  return `<div class="panel"><h3>Futures</h3>${f.items.map(i => `<div class="kv"><span>${esc(i.market)}${i.book ? ` <span class="muted" style="font-size:12px">· ${esc(i.book)}</span>` : ""}</span><b>${esc(i.odds)}</b></div>`).join("")}
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">${f.asOf ? "As of " + esc(fmtDate(f.asOf, {month:"short", day:"numeric", year:"numeric"})) + ". " : ""}${f.note ? esc(f.note) : ""}</p></div>`;
}

/* ---------- matchup model ---------- */
const MODEL_DEFAULT = { recent: 40, ats: 25, hca: 2, rest: true };
let MW = (() => { try { const v = JSON.parse(store.get("pistons-model") || "null"); if (v && typeof v === "object") return Object.assign({}, MODEL_DEFAULT, v); } catch(e) {} return Object.assign({}, MODEL_DEFAULT); })();
let MATCHUPS = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f1 = v => num(v) === null ? "–" : v.toFixed(1);
function phi(x){ const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); const pr = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - pr : pr; }
function seasonAdj(v, prior, gp){
  if (num(v) === null) return num(prior);
  if (num(prior) !== null && num(gp) !== null && gp < 10) return (gp * v + (10 - gp) * prior) / 10;
  return v;
}
function teamEff(t, r){
  const so = seasonAdj(t.ppg, t.priorPpg, t.gp), sd = seasonAdj(t.oppg, t.priorOppg, t.gp);
  const ro = num(t.l10ppg) !== null ? t.l10ppg : so, rd = num(t.l10oppg) !== null ? t.l10oppg : sd;
  if (so === null || sd === null) return null;
  return { off: (1 - r) * so + r * ro, def: (1 - r) * sd + r * rd };
}
function project(m, w){
  if (!m || !m.det || !m.opp) return null;
  const r = clamp((w.recent ?? 40) / 100, 0, 1);
  const D = teamEff(m.det, r), O = teamEff(m.opp, r);
  if (!D || !O) return null;
  const L = num(m.league && m.league.ppg) !== null ? m.league.ppg : (D.off + D.def + O.off + O.def) / 4;
  const pd = D.off + O.def - L, po = O.off + D.def - L;
  const base = pd - po, total = pd + po;
  const hca = m.neutral ? 0 : (m.home ? 1 : -1) * clamp(Number(w.hca) || 0, 0, 5);
  let rest = 0;
  if (w.rest && num(m.det.rest) !== null && num(m.opp.rest) !== null) {
    if (m.det.rest === 0 && m.opp.rest > 0) rest = -1.5; else if (m.opp.rest === 0 && m.det.rest > 0) rest = 1.5;
  }
  let ats = 0;
  if (num(m.det.atsMargin) !== null && num(m.opp.atsMargin) !== null) ats = clamp(clamp((w.ats ?? 25) / 100, 0, 1) * (m.det.atsMargin - m.opp.atsMargin) / 2, -3, 3);
  const margin = base + hca + rest + ats;
  return { margin, total, det: total / 2 + margin / 2, opp: total / 2 - margin / 2, win: phi(margin / 12.5),
    parts: [["Scoring matchup", base, `${100 - Math.round(r * 100)}% season, ${Math.round(r * 100)}% last 10, each offense vs the other defense`], ["Home court", hca, m.neutral ? "Neutral site" : (m.home ? "Pistons at home" : "Pistons on the road")], ["Rest", rest, w.rest ? `Days of rest: DET ${m.det.rest ?? "?"}, ${m.oppAbbr || "OPP"} ${m.opp.rest ?? "?"}` : "Off"], ["ATS form", ats, `Avg cover margin DET ${num(m.det.atsMargin) === null ? "–" : sgn(+m.det.atsMargin.toFixed(1))}, ${m.oppAbbr || "OPP"} ${num(m.opp.atsMargin) === null ? "–" : sgn(+m.opp.atsMargin.toFixed(1))}`]] };
}
function leanOf(pj, line, abbr){
  const out = { side: null, total: null };
  if (pj && line && num(line.spread) !== null) {
    const e = pj.margin + line.spread;
    out.side = { edge: e, pick: Math.abs(e) < 1.5 ? null : (e > 0 ? "DET " + sgn(line.spread) : (abbr || "OPP") + " " + sgn(-line.spread)), det: e > 0 };
  }
  if (pj && line && num(line.total) !== null) {
    const e = pj.total - line.total;
    out.total = { edge: e, pick: Math.abs(e) < 2 ? null : (e > 0 ? "Over " + line.total : "Under " + line.total), over: e > 0 };
  }
  return out;
}
const strength = e => Math.abs(e) >= 4 ? "Stronger lean" : Math.abs(e) >= 1.5 ? "Lean" : "No clear lean";

function nextMatchup(){
  const today = isoDay(new Date());
  return MATCHUPS.filter(m => m.date >= today && !LINES.some(l => l.date === m.date && hasFinal(l))).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function compareRows(m){
  const d = m.det || {}, o = m.opp || {}, ab = esc(m.oppAbbr || "OPP");
  const net = t => num(t.ppg) !== null && num(t.oppg) !== null ? t.ppg - t.oppg : null;
  const l10net = t => num(t.l10ppg) !== null && num(t.l10oppg) !== null ? t.l10ppg - t.l10oppg : null;
  const tot = t => num(t.avgTotal) !== null ? t.avgTotal : (num(t.ppg) !== null && num(t.oppg) !== null ? t.ppg + t.oppg : null);
  const better = (a, b, hi) => num(a) === null || num(b) === null || a === b ? [0, 0] : ((a > b) === hi ? [1, 0] : [0, 1]);
  const row = (label, a, b, cmp, sub) => { const [x, y] = cmp || [0, 0]; return `<tr${sub ? ' class="sub"' : ""}><td>${label}</td><td${x ? ' class="best"' : ""}>${a}</td><td${y ? ' class="best"' : ""}>${b}</td></tr>`; };
  const pctOf = s => { const m2 = /^(\d+)\D+(\d+)/.exec(String(s || "")); return m2 && (+m2[1] + +m2[2]) ? +m2[1] / (+m2[1] + +m2[2]) : null; };
  const split = m.home ? ["Home ATS (DET) / Road ATS (" + ab + ")", d.atsHome, o.atsAway] : ["Road ATS (DET) / Home ATS (" + ab + ")", d.atsAway, o.atsHome];
  return `<table class="mini cmp"><thead><tr><th></th><th>DET</th><th>${ab}</th></tr></thead><tbody>
    <tr class="grp"><td colspan="3">Form</td></tr>
    ${row("Record", esc(d.record || "–"), esc(o.record || "–"), better(pctOf(d.record), pctOf(o.record), true))}
    ${row("Last 10", esc(d.l10 || "–"), esc(o.l10 || "–"), better(pctOf(d.l10), pctOf(o.l10), true))}
    ${row("Streak / seed", esc([d.streak, d.conf].filter(Boolean).join(" · ") || "–"), esc([o.streak, o.conf].filter(Boolean).join(" · ") || "–"))}
    ${row("Days of rest", num(d.rest) === null ? "–" : d.rest, num(o.rest) === null ? "–" : o.rest, better(d.rest, o.rest, true))}
    <tr class="grp"><td colspan="3">Scoring</td></tr>
    ${row("Points per game", f1(d.ppg), f1(o.ppg), better(d.ppg, o.ppg, true))}
    ${row("Points allowed", f1(d.oppg), f1(o.oppg), better(d.oppg, o.oppg, false))}
    ${row("Net per game", net(d) === null ? "–" : sgn(+net(d).toFixed(1)), net(o) === null ? "–" : sgn(+net(o).toFixed(1)), better(net(d), net(o), true))}
    ${row("Last 10: scored / allowed", num(d.l10ppg) === null ? "–" : f1(d.l10ppg) + " / " + f1(d.l10oppg), num(o.l10ppg) === null ? "–" : f1(o.l10ppg) + " / " + f1(o.l10oppg), better(l10net(d), l10net(o), true))}
    <tr class="grp"><td colspan="3">Betting</td></tr>
    ${row("ATS", esc(d.ats || "–"), esc(o.ats || "–"), better(pctOf(d.ats), pctOf(o.ats), true))}
    ${row("ATS last 10", esc(d.atsL10 || "–"), esc(o.atsL10 || "–"), better(pctOf(d.atsL10), pctOf(o.atsL10), true))}
    ${row(split[0], esc(split[1] || "–"), esc(split[2] || "–"), better(pctOf(split[1]), pctOf(split[2]), true))}
    ${row("Avg cover margin", num(d.atsMargin) === null ? "–" : sgn(+d.atsMargin.toFixed(1)), num(o.atsMargin) === null ? "–" : sgn(+o.atsMargin.toFixed(1)), better(d.atsMargin, o.atsMargin, true))}
    ${row("Over–under", esc(d.ou || "–"), esc(o.ou || "–"))}
    ${row("O/U last 10", esc(d.ouL10 || "–"), esc(o.ouL10 || "–"))}
    ${row("Avg game total", tot(d) === null ? "–" : f1(tot(d)), tot(o) === null ? "–" : f1(tot(o)))}
  </tbody></table>`;
}

function projectionHtml(m, line){
  const pj = project(m, MW);
  if (!pj) return `<p class="empty">Not enough scoring data yet for a projection.</p>`;
  const ab = esc(m.oppAbbr || "OPP"), ln = leanOf(pj, line, m.oppAbbr);
  const imp = line ? implied(line.mlDet) : null;
  const maxAbs = Math.max(4, ...pj.parts.map(p => Math.abs(p[1])));
  const bar = v => { const w = Math.abs(v) / maxAbs * 50; return `<span class="pbar"><i style="${v >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`};background:${v >= 0 ? "var(--win)" : "var(--loss)"}"></i></span>`; };
  return `
    <div class="proj-score"><div><span>DET</span><b>${pj.det.toFixed(0)}</b></div><div class="muted">–</div><div><span>${ab}</span><b>${pj.opp.toFixed(0)}</b></div></div>
    <div class="bet-line">
      <div><span>Model margin</span><b>${pj.margin >= 0 ? "DET" : ab} by ${Math.abs(pj.margin).toFixed(1)}</b><small>${line && num(line.spread) !== null ? `Line ${esc(lineTxt(line))}` : "No line yet"}</small></div>
      <div><span>Model total</span><b>${pj.total.toFixed(1)}</b><small>${line && num(line.total) !== null ? `Line ${line.total}` : "No line yet"}</small></div>
      <div><span>DET win chance</span><b>${Math.round(pj.win * 100)}%</b><small>${imp !== null ? `Moneyline implies ${Math.round(imp * 100)}%` : "No moneyline yet"}</small></div>
    </div>
    ${line ? `<div class="leans">
      ${ln.side ? `<div><span class="eyebrow">Spread</span><b>${ln.side.pick ? esc(ln.side.pick) : "No clear lean"}</b><small>${strength(ln.side.edge)} · model is ${Math.abs(ln.side.edge).toFixed(1)} pts ${ln.side.det ? "better for DET" : "better for " + ab} than the line</small></div>` : ""}
      ${ln.total ? `<div><span class="eyebrow">Total</span><b>${ln.total.pick ? esc(ln.total.pick) : "No clear lean"}</b><small>${strength(ln.total.edge)} · model is ${Math.abs(ln.total.edge).toFixed(1)} pts ${ln.total.over ? "above" : "below"} the total</small></div>` : ""}
    </div>` : ""}
    <div class="parts"><div class="eyebrow" style="margin:10px 0 4px">How the margin is built (DET view)</div>
      ${pj.parts.map(([k, v, note]) => `<div class="part"><span>${esc(k)}<small>${esc(note)}</small></span>${bar(v)}<b>${sgn(+v.toFixed(1))}</b></div>`).join("")}
      <div class="part total"><span>Projected margin</span><span></span><b>${sgn(+pj.margin.toFixed(1))}</b></div>
    </div>`;
}

function modelRecordHtml(){
  const graded = MATCHUPS.map(m => ({ m, l: LINES.find(x => x.date === m.date && hasFinal(x) && counts(x)) })).filter(x => x.l);
  if (!graded.length) return `<p class="empty">Once games with a saved matchup are final, this grades the model's picks against the closing line, using the weights above.</p>`;
  const c = { aw: 0, al: 0, ap: 0, sw: 0, sl: 0, ow: 0, ol: 0, op: 0 };
  graded.forEach(({ m, l }) => {
    const pj = project(m, MW); if (!pj) return;
    const ln = leanOf(pj, l, m.oppAbbr), a = atsOf(l), o = ouOf(l);
    if (ln.side && a) {
      if (a.r === "P") c.ap++; else { const hit = (ln.side.det && a.r === "W") || (!ln.side.det && a.r === "L"); hit ? c.aw++ : c.al++; if (Math.abs(ln.side.edge) >= 1.5) hit ? c.sw++ : c.sl++; }
    }
    if (ln.total && o) { if (o.r === "P") c.op++; else { const hit = (ln.total.over && o.r === "O") || (!ln.total.over && o.r === "U"); hit ? c.ow++ : c.ol++; } }
  });
  const pc = (w, l) => w + l ? ` (${Math.round(w / (w + l) * 100)}%)` : "";
  return `<div class="bet-tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))">
    <div><b>${c.aw}–${c.al}${c.ap ? "–" + c.ap : ""}</b><span>Spread picks${pc(c.aw, c.al)}</span></div>
    <div><b>${c.sw}–${c.sl}</b><span>Leans of 1.5+ pts${pc(c.sw, c.sl)}</span></div>
    <div><b>${c.ow}–${c.ol}${c.op ? "–" + c.op : ""}</b><span>Total picks${pc(c.ow, c.ol)}</span></div>
  </div><p class="muted" style="font-size:12.5px;margin:8px 0 0">${graded.length} graded game${graded.length > 1 ? "s" : ""}. Inputs are frozen the morning of each game; the record recalculates when you move the sliders. 52.4% is roughly break-even at standard -110 odds.</p>`;
}

function matchupPanel(){
  const m = nextMatchup();
  if (!m) return `<div class="panel"><h3>Matchup &amp; projection</h3><p class="empty">Starts with the regular season. Each morning before a game, this compares the Pistons and their opponent (form, scoring, ATS, over/under, rest, injuries) and builds a projected score from a weighted blend you can adjust.</p></div>`;
  const line = LINES.find(l => l.date === m.date) || null;
  const o = m.opp || {}, ab = esc(m.oppAbbr || "OPP");
  const inj = Array.isArray(o.injuries) && o.injuries.length ? o.injuries.map(i => `<div class="inj"><div><b>${esc(i.name)}</b><div class="muted" style="font-size:13px">${esc(i.detail || "")}</div></div><span class="st ${/out/i.test(i.status) ? "out" : /question|doubt|day/i.test(i.status) ? "q" : "p"}">${esc(i.status)}</span></div>`).join("") : `<p class="empty">No ${ab} injuries listed.</p>`;
  const h2h = Array.isArray(m.h2h) && m.h2h.length ? m.h2h.map(g => `<div class="kv"><span>${esc(shortDay(g.date))}${g.season ? " · " + esc(g.season) : ""} ${g.home ? "vs" : "@"} ${ab}</span><b>${g.det > g.opp ? "W" : "L"} ${g.det}–${g.opp}</b></div>`).join("") : `<p class="empty">First meeting this season.</p>`;
  return `<div class="panel"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 12px"><h3 style="margin:0">Matchup: ${m.home ? "vs" : "@"} ${esc(m.opponent || "")}<span class="tag">${esc(m.type || "")}</span></h3><span class="muted" style="font-size:13px">${esc(fmtDate(m.date, {weekday:"long", month:"short", day:"numeric"}))}${m.asOf ? " · data as of " + esc(new Date(m.asOf).toLocaleString("en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})) : ""}</span></div>
    <div class="dgrid" style="margin-top:12px">
      <div class="span-6">${compareRows(m)}
        <div class="eyebrow" style="margin:14px 0 4px">${ab} injuries</div>${inj}
        <div class="eyebrow" style="margin:14px 0 4px">Head to head</div>${h2h}
      </div>
      <div class="span-6">
        <div class="eyebrow" style="margin-bottom:6px">Projection</div>
        <div id="proj-out">${projectionHtml(m, line)}</div>
        <details class="weights"${store.get("pistons-model-open") === "1" ? " open" : ""}><summary>Adjust the weights</summary>
          <label>Recent form vs season <output id="w-recent-o">${MW.recent}% last 10</output><input type="range" id="w-recent" min="0" max="100" step="5" value="${MW.recent}"></label>
          <label>ATS trend weight <output id="w-ats-o">${MW.ats}%</output><input type="range" id="w-ats" min="0" max="100" step="5" value="${MW.ats}"></label>
          <label>Home court <output id="w-hca-o">${(+MW.hca).toFixed(1)} pts</output><input type="range" id="w-hca" min="0" max="4" step="0.5" value="${MW.hca}"></label>
          <label class="chk"><input type="checkbox" id="w-rest"${MW.rest ? " checked" : ""}> Back-to-back adjustment (1.5 pts)</label>
          <button type="button" class="iconbtn" id="w-reset" style="width:auto;padding:0 12px;font-size:13px">Reset to defaults</button>
        </details>
        <div class="eyebrow" style="margin:14px 0 6px">Model track record</div>
        <div id="model-rec">${modelRecordHtml()}</div>
      </div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:10px 0 0">How it works: each team's offense and defense is a blend of season and last-10 points per game (early in the season, last season's numbers fill in until 10 games are played). Projected points = team's offense + opponent's defense − league average. Home court, back-to-backs and a lightly weighted ATS-form term shift the margin. A simple model for comparing against the line, not a prediction to bet on.</p>
  </div>`;
}

function wireModel(){
  const el = $("#p-betting"), m = nextMatchup();
  if (!el || !m) return;
  const line = LINES.find(l => l.date === m.date) || null;
  const save = () => { store.set("pistons-model", JSON.stringify(MW)); const po = $("#proj-out"), mr = $("#model-rec"); if (po) po.innerHTML = projectionHtml(m, line); if (mr) mr.innerHTML = modelRecordHtml(); };
  const bind = (id, key, fmt, parse) => { const i = $("#" + id); if (!i) return; i.addEventListener("input", () => { MW[key] = parse(i.value); const o = $("#" + id + "-o"); if (o) o.textContent = fmt(MW[key]); save(); }); };
  bind("w-recent", "recent", v => v + "% last 10", Number);
  bind("w-ats", "ats", v => v + "%", Number);
  bind("w-hca", "hca", v => (+v).toFixed(1) + " pts", Number);
  const rc = $("#w-rest"); if (rc) rc.addEventListener("change", () => { MW.rest = rc.checked; save(); });
  const rs = $("#w-reset"); if (rs) rs.addEventListener("click", () => { MW = Object.assign({}, MODEL_DEFAULT); store.set("pistons-model", JSON.stringify(MW)); renderBetting(); });
  const dt = el.querySelector("details.weights"); if (dt) dt.addEventListener("toggle", () => store.set("pistons-model-open", dt.open ? "1" : "0"));
}

function renderBetting(){
  const el = $("#p-betting");
  if (!el) return;
  el.innerHTML = `
    <div class="dgrid">
      <div class="span-6">${nextLinePanel()}</div>
      <div class="span-6">${lastLinePanel()}</div>
      <div class="span-12">${matchupPanel()}</div>
      <div class="span-5">${betRecordsPanel()}</div>
      <div class="span-7"><div class="panel"><h3>Cover margin by game</h3>${coverChart(LINES.filter(l => counts(l) && hasFinal(l)).sort((a, b) => a.date.localeCompare(b.date)))}</div></div>
      <div class="span-8">${betLogPanel()}</div>
      <div class="span-4">${futuresPanel()}</div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:14px 0 0">Lines are DraftKings numbers from ESPN, checked each morning. Graded games use the closing line. For information only, not betting advice. 21+. If you or someone you know has a gambling problem, call 1-800-GAMBLER.</p>`;
  wireModel();
}

/* ---------- boot ---------- */
function renderAll(){ mergeGames(); renderHero(); renderToday(); renderBetting(); renderSchedule(); renderHome(); renderSummary(); renderTrips(); }
renderAll();
showTab(store.get("pistons-tab") || "today");

/* ---------- static data: data/results.js + data/daily.js stand in for the hosted database ---------- */
function loadScript(path){
  return new Promise(res => { const s = document.createElement("script"); s.src = path + "?t=" + Date.now(); s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
}
async function loadStaticDb(){
  await Promise.all([loadScript("data/results.js"), loadScript("data/daily.js")]);
  const R = window.PISTONS_RESULTS || {}, D = window.PISTONS_DAILY || {};
  const cols = { results: R.games || {}, games: D.games || {}, lines: D.lines || {}, matchups: D.matchups || {}, daily: D.days || {} };
  const docs = { "dashboard/latest": D.latest || null, "dashboard/index": { dates: Object.keys(D.days || {}) }, "betting/futures": D.futures || null,
    "meta/status": R.updated ? { updated: R.updated } : (D.updated ? { updated: D.updated } : null) };
  const snap = v => ({ exists: !!v, data: () => v || undefined });
  const docAt = path => { if (path in docs) return docs[path]; const [c, id] = path.split("/"); return (cols[c] || {})[id] || null; };
  return {
    doc: path => ({ onSnapshot: cb => { cb(snap(docAt(path))); return () => {}; }, get: async () => snap(docAt(path)) }),
    collection: name => ({ onSnapshot: cb => { cb({ docs: Object.entries(cols[name] || {}).map(([id, v]) => ({ id, data: () => v })) }); return () => {}; } })
  };
}

(async () => {
  const db = await loadStaticDb();
  if (!db) return;
  DB = db;
  try {
    db.collection("lines").onSnapshot(snap => {
      LINES = snap.docs.map(d => Object.assign({ date: d.id }, d.data() || {})).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
      renderBetting();
    }, () => {});
    db.collection("matchups").onSnapshot(snap => {
      MATCHUPS = snap.docs.map(d => Object.assign({ date: d.id }, d.data() || {})).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
      renderBetting();
    }, () => {});
    db.doc("betting/futures").onSnapshot(snap => { FUTURES = snap.exists ? snap.data() : null; renderBetting(); }, () => {});
    db.collection("games").onSnapshot(snap => {
      BOXES = snap.docs.map(d => { const v = d.data() || {}; return Object.assign({ date: d.id }, v); });
      renderToday();
    }, () => {});
    db.doc("dashboard/latest").onSnapshot(snap => {
      DASH_LATEST = snap.exists ? snap.data() : null;
      if (DASH_PICK === "latest") { DASH = DASH_LATEST; renderToday(); }
    }, () => {});
    db.doc("dashboard/index").onSnapshot(snap => {
      const v = snap.exists ? snap.data() : null;
      DASH_DATES = (v && Array.isArray(v.dates) ? v.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []).sort().reverse();
      renderToday();
    }, () => {});
    db.collection("results").onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(d => { const v = d.data(); if (v) next[d.id] = v; });
      RESULTS = next; renderAll();
    }, () => {});
    db.doc("meta/status").onSnapshot(snap => {
      const v = snap.exists ? snap.data() : null;
      if (v && v.updated) $("#status").textContent = "Scores and the Today dashboard update every morning · scores last checked " + new Date(v.updated).toLocaleString("en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"}) + ".";
    }, () => {});
  } catch(e) {}
})();
})();
