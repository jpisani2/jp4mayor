/* Pistons Yearbook 2026-27 — page script.
   Reads: data/yearbook.js (bios, career, frozen preseason projections), the hub's data files
   (results, daily box scores, team season log, contracts, milestones, schedule) and the Pregame page's
   matchup file for next-game lines. Everything is computed in the browser; nothing is fetched from ESPN. */
(function () {
"use strict";
const M = window.YBModel;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const isNum = v => typeof v === "number" && isFinite(v);
const f1 = v => isNum(v) ? v.toFixed(1) : "–";
const f0 = v => isNum(v) ? Math.round(v).toLocaleString("en-US") : "–";
const pc = v => isNum(v) ? (v * 100).toFixed(1) + "%" : "–";
const pcs = v => isNum(v) ? (v * 100).toFixed(1) : "–";
const sgn = v => isNum(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) : "–";
const seasonLabel = y => (y - 1) + "-" + String(y).slice(2);
const ord = n => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const SEASON_START = "2026-10-20";
// regular season only: preseason, the NBA Cup championship and the playoffs don't count (the schedule loads later, so read it each time)
const seasonEnd = () => (((window.PISTONS_DATA || {}).sched) || []).map(g => g.date).filter(Boolean).sort().pop() || "2027-04-11";
const isReg = (d, type) => !!d && d >= SEASON_START && d <= seasonEnd() && !/preseason|playoff|play-in|postseason|championship|cup final/i.test(type || "");
const CONFIG = window.YB_CONFIG || {};
const BASE = CONFIG.base || "../";          // where the hub's data files live (jp4mayor.com/pistons/)
const SELF = CONFIG.self || "";             // where this yearbook's data lives

/* ---------- theme (shared with the hub: localStorage "pistons-skin") ---------- */
const root = document.documentElement;
function effectiveSkin() {
  const pref = store.get("pistons-skin"); if (pref) return pref;
  const host = root.getAttribute("data-theme");
  if (host === "light") return "light"; if (host === "dark") return "navy";
  return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "navy" : "light";
}
function paintSkin() { const s = effectiveSkin(); document.querySelectorAll(".skin button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skin === s))); }
function applySkin() { const p = store.get("pistons-skin"); if (p) root.setAttribute("data-skin", p); else root.removeAttribute("data-skin"); paintSkin(); }
document.querySelectorAll(".skin button").forEach(b => b.addEventListener("click", () => { store.set("pistons-skin", b.dataset.skin); applySkin(); }));
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintSkin); } catch (e) {}
new MutationObserver(paintSkin).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
applySkin();

/* ---------- load data ---------- */
function loadScript(src) {
  return new Promise(res => { const s = document.createElement("script"); s.src = src + (src.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 300000); s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
}
async function loadAll() {
  if (CONFIG.inline) return;
  await Promise.all([
    loadScript(SELF + "data/yearbook.js"), loadScript(BASE + "data/results.js"), loadScript(BASE + "data/daily.js"), loadScript(BASE + "data/team.js"),
    loadScript(BASE + "data/cap.js"), loadScript(BASE + "data/milestones.js"), loadScript(BASE + "pregame/data/pregame.js"), loadScript(BASE + "pregame/data/matchup.js")
  ]);
}

/* ---------- names ---------- */
const nkey = n => { const w = String(n || "").toLowerCase().replace(/[.'’,]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").trim().split(/\s+/); return w.length > 1 ? w[0].slice(0, 3) + w[w.length - 1] : w[0] || ""; };

/* ---------- state ---------- */
let YB, PLAYERS = [], PAGES = [], HUB = {}, TEAM = {}, cur = 0;
const ui = { trendStat: store.get("yb-trend") || "pts", careerTab: "pg", ldrMode: "proj", ldrSort: { k: "pts", dir: -1 } };

function todayET() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value; return g("year") + "-" + g("month") + "-" + g("day");
}
const dObj = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s, o) => dObj(s).toLocaleDateString("en-US", o || { month: "short", day: "numeric" });

function ma(s) { const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(String(s || "")); return m ? [+m[1], +m[2]] : [0, 0]; }

/* Season box scores: the team.js season log (Tue/Fri) plus the newest box scores in daily.js (every morning). */
function buildSeason() {
  const res = (window.PISTONS_RESULTS || {}).games || {};
  const daily = window.PISTONS_DAILY || {};
  const log = ((window.PISTONS_TEAM || {}).log) || [];
  const games = {};
  for (const g of log) {
    if (!g || !isReg(g.d, g.type)) continue;
    games[g.d] = { d: g.d, opp: g.opp, home: !!g.home, det: g.det, oppPts: g.oppPts, rows: (g.p || []).map(r => ({ key: nkey(r[0]), name: r[0], min: +r[1] || 0, pts: r[2], reb: r[3], ast: r[4], stl: r[5], blk: r[6], tpm: r[7], tpa: r[8], fgm: r[9], fga: r[10], ftm: r[11], fta: r[12], gs: r[13] ? 1 : 0 })) };
  }
  for (const [d, g] of Object.entries(daily.games || {})) {
    if (!isReg(d, g.type) || !g.box) continue;
    games[d] = { d, opp: g.opponent, home: !!g.home, det: g.det, oppPts: g.opp, rows: g.box.map(p => { const fg = ma(p.fg), tp = ma(p.tp), ft = ma(p.ft); return { key: nkey(p.name), name: p.name, min: +p.min || 0, pts: +p.pts || 0, reb: +p.reb || 0, ast: +p.ast || 0, stl: +p.stl || 0, blk: +p.blk || 0, tpm: tp[0], tpa: tp[1], fgm: fg[0], fga: fg[1], ftm: ft[0], fta: ft[1], gs: p.starter ? 1 : 0, pm: p.pm }; }) };
  }
  const list = Object.values(games).sort((a, b) => a.d < b.d ? -1 : 1);
  const finals = Object.entries(res).filter(([d, r]) => isReg(d, r && (r.type || r.note))).length;
  TEAM = { games: list, gp: Math.max(finals, list.length) };
  TEAM.left = Math.max(0, 82 - TEAM.gp);
  // preseason box scores, for a note before the opener
  TEAM.pre = Object.entries(daily.games || {}).filter(([d, g]) => /preseason/i.test(g.type || "") && d >= "2026-09-01" && g.box).map(([d, g]) => ({ d, rows: g.box }));
}
const CNT = ["min", "pts", "reb", "ast", "stl", "blk", "tpm", "tpa", "fgm", "fga", "ftm", "fta"];
function actualFor(p) {
  const k = nkey(p.name), games = [];
  const tot = { gp: 0, gs: 0 }; CNT.forEach(c => tot[c] = 0);
  for (const g of TEAM.games) {
    const r = g.rows.find(x => x.key === k);
    if (!r || !(r.min > 0)) continue;
    tot.gp++; tot.gs += r.gs; CNT.forEach(c => tot[c] += r[c] || 0);
    games.push(Object.assign({ d: g.d, opp: g.opp, home: g.home, win: isNum(g.det) && isNum(g.oppPts) ? g.det > g.oppPts : null, score: isNum(g.det) ? g.det + "–" + g.oppPts : "" }, r));
  }
  let pre = null;
  const pg = TEAM.pre.map(g => g.rows.find(x => nkey(x.name) === k)).filter(r => r && +r.min > 0);
  if (pg.length) pre = { gp: pg.length, pts: pg.reduce((a, r) => a + (+r.pts || 0), 0) / pg.length, min: pg.reduce((a, r) => a + (+r.min || 0), 0) / pg.length, reb: pg.reduce((a, r) => a + (+r.reb || 0), 0) / pg.length, ast: pg.reduce((a, r) => a + (+r.ast || 0), 0) / pg.length };
  return { tot, games, pre };
}
const per = (t, k) => t.gp ? t[k] / t.gp : null;
const tsOf = t => (t.fga + 0.44 * t.fta) > 0 ? t.pts / (2 * (t.fga + 0.44 * t.fta)) : null;
const efgOf = t => t.fga > 0 ? (t.fgm + 0.5 * t.tpm) / t.fga : null;

function projNow(p, act) {
  const pre = p.proj;
  if (!act.tot.gp) return null;
  const a = { gp: act.tot.gp, min: act.tot.min }; ["pts", "reb", "ast", "stl", "blk", "tpm", "tpa", "fgm", "fga", "ftm", "fta"].forEach(k => a[k] = act.tot[k]);
  return M.blend(pre, a, TEAM.gp, TEAM.left, p.status === "Two-way");
}

/* ---------- small renderers ---------- */
function photo(p, cls) {
  const src = CONFIG.noPhotos ? "" : "https://a.espncdn.com/i/headshots/nba/players/full/" + p.id + ".png";
  return `<div class="photowrap ${cls || ""}"><div class="photo"><span class="fallback" aria-hidden="true">${esc(p.num || p.name.split(" ").map(w => w[0]).join(""))}</span>${src ? `<img src="${src}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ""}</div></div>`;
}
function statusPills(p) {
  const out = [];
  if (p.status === "Two-way") out.push(`<span class="pill tw">Two-way</span>`);
  if (p.status === "Camp") out.push(`<span class="pill camp">Training camp</span>`);
  if (p.rookieYear) out.push(`<span class="pill new">Rookie</span>`);
  else if (p.newTeam) out.push(`<span class="pill new">New</span>`);
  const inj = ((window.PISTONS_DAILY || {}).latest || {}).injuries || [];
  const i = inj.find(x => nkey(x.name) === nkey(p.name));
  if (i) out.push(`<span class="pill inj" title="${esc(i.detail || "")}">${esc(i.status)}</span>`);
  return out.join("");
}
const AWD = { AS: "All-Star", NBA1: "All-NBA 1st team", NBA2: "All-NBA 2nd team", NBA3: "All-NBA 3rd team", DEF1: "All-Defensive 1st team", DEF2: "All-Defensive 2nd team", ROY: "Rookie of the Year", MIP: "Most Improved" };
function awards(p) {
  const out = [];
  for (const r of p.bref.adv || []) {
    if (!r[19]) continue;
    for (const t of String(r[19]).split(",")) {
      const m = /^([A-Z]+)-(\d+)$/.exec(t);
      if (m) { if (+m[2] <= 5) out.push(`${m[1].replace("CPOY", "Clutch POY")} ${ord(+m[2])} (${r[0]})`); }
      else if (AWD[t]) out.push(`${AWD[t]} (${r[0]})`);
    }
  }
  return out;
}
function capFor(p) {
  if (p.status === "Two-way") return "Two-way contract";
  if (p.status === "Camp") return "Exhibit 10 (camp) contract";
  const C = (window.PISTONS_CAP || {}).det; if (!C) return "";
  const row = (C.players || []).find(x => nkey(x.name) === nkey(p.capName || p.name)); if (!row) return "";
  const seasons = (window.PISTONS_CAP || {}).seasons || [];
  let last = 0; row.sal.forEach((v, i) => { if (v) last = i; });
  const m = v => "$" + (v / 1e6).toFixed(1) + "M";
  const partial = (row.partial || []).length ? " (not fully guaranteed)" : "";
  return `${m(row.sal[0])} in 2026-27; signed through ${seasons[last] || ""}${partial}`;
}
function age(p) { return M.ageAt(p.dob, todayET()); }
function expText(p) {
  const s = M.seasons(p.espn.r);
  if (!s.length) return "Rookie season";
  const det = s.filter(x => x.teams.includes("DET")).length;
  const nth = s.length + 1;
  return `${ord(nth)} NBA season` + (det ? `, ${ord(det + 1)} with Detroit` : ", 1st with Detroit");
}

/* ---------- charts ---------- */
function niceMax(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e; }
const STATNAME = { pts: "Points", reb: "Rebounds", ast: "Assists", min: "Minutes", stl: "Steals", blk: "Blocks", tpm: "3-pointers made" };

/* game-by-game line with the season average and the preseason projection band */
function trendChart(p, act, stat) {
  const W = 640, H = 230, L = 34, Rr = 12, T = 12, B = 30;
  const gs = act.games; const n = gs.length;
  const vals = gs.map(g => g[stat] || 0);
  const band = stat === "min" ? p.proj.range.min : p.proj.range[stat];
  const proj = stat === "min" ? p.proj.g.min : p.proj.g[stat];
  const max = niceMax(Math.max(...vals, band ? band[1] : 0, 1) * 1.05);
  const x = i => L + (n <= 1 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(STATNAME[stat])} by game, 2026-27">`;
  for (const t of ticks) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--rule2)" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${t % 1 ? t.toFixed(1) : t}</text>`;
  if (band) s += `<rect x="${L}" width="${W - L - Rr}" y="${y(band[1])}" height="${Math.max(1, y(band[0]) - y(band[1]))}" fill="var(--band)"/><line x1="${L}" x2="${W - Rr}" y1="${y(proj)}" y2="${y(proj)}" stroke="var(--proj)" stroke-width="1.5"/>`;
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  s += `<line x1="${L}" x2="${W - Rr}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  if (n > 1) s += `<polyline points="${vals.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ")}" fill="none" stroke="var(--actual)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  vals.forEach((v, i) => { s += `<circle cx="${x(i)}" cy="${y(v)}" r="${n > 40 ? 2.5 : 4}" fill="var(--actual)" stroke="var(--paper)" stroke-width="1.5"/>`; });
  const step = Math.max(1, Math.ceil(n / 8));
  gs.forEach((g, i) => { if (i % step === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(fmtDate(g.d, { month: "numeric", day: "numeric" }))}</text>`; });
  const hw = n > 1 ? (W - L - Rr) / (n - 1) : 60;
  gs.forEach((g, i) => { s += `<rect x="${x(i) - hw / 2}" y="${T}" width="${hw}" height="${H - T - B}" fill="transparent" data-tip="${esc(`<b>${fmtDate(g.d, { weekday: "short", month: "short", day: "numeric" })}</b> ${g.home ? "vs" : "@"} ${g.opp}${g.win === null ? "" : " · " + (g.win ? "W " : "L ") + g.score}<br>${f0(g.min)} min · ${g.pts} pts · ${g.reb} reb · ${g.ast} ast<br>${g.fgm}-${g.fga} FG · ${g.tpm}-${g.tpa} 3P · ${g.ftm}-${g.fta} FT`)}"/>`; });
  return s + `</svg>`;
}

/* one row of the projected-vs-actual chart: band = 80% range, tick = projection, dot = actual */
function rangeRow(label, lo, proj, hi, act, fmt, pctScale) {
  const W = 300, H = 22, pad = 4;
  let mn = 0, mx = niceMax(Math.max(hi, act || 0) * 1.08);
  if (pctScale) { // percentages: a window around the projection, widened to fit the actual mark
    mn = Math.max(0, Math.min(lo, isNum(act) ? act : lo) - 0.05); mx = Math.min(1, Math.max(hi, isNum(act) ? act : hi) + 0.05);
  }
  const x = v => pad + (W - 2 * pad) * Math.max(0, Math.min(1, (v - mn) / (mx - mn)));
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="${pad}" x2="${W - pad}" y1="11" y2="11" stroke="var(--rule2)" stroke-width="2"/>`;
  s += `<rect x="${x(lo)}" y="4" width="${Math.max(2, x(hi) - x(lo))}" height="14" rx="3" fill="var(--band)" stroke="var(--proj)" stroke-width="1"/>`;
  s += `<rect x="${x(proj) - 1.5}" y="2" width="3" height="18" fill="var(--proj)"/>`;
  if (isNum(act)) s += `<circle cx="${x(act)}" cy="11" r="6" fill="var(--actual)" stroke="var(--paper)" stroke-width="2"/>`;
  s += `</svg>`;
  let verdict = "";
  if (isNum(act)) verdict = act > hi ? `<span class="verdict up">Above</span>` : act < lo ? `<span class="verdict dn">Below</span>` : "";
  const tip = `<b>${label}</b><br>Projection ${fmt(proj)} (likely range ${fmt(lo)}–${fmt(hi)})${isNum(act) ? "<br>Actual so far " + fmt(act) : ""}`;
  return `<div class="lab">${label}</div><div data-tip="${esc(tip)}">${s}</div><div class="vals">${isNum(act) ? `<b>${fmt(act)}</b> <span class="muted">/ ${fmt(proj)}</span>` : `<b>${fmt(proj)}</b>`}${verdict}</div>`;
}

/* points (or reb/ast) per game by season, with the 2026-27 projection and its range */
function careerChart(p, stat, act) {
  const ss = M.seasons(p.espn.r);
  const pts = ss.map(s => ({ y: s.y, v: s.gp ? s[stat] / s.gp : 0, gp: s.gp }));
  const pr = { y: 2027, v: p.proj.g[stat], lo: p.proj.range[stat][0], hi: p.proj.range[stat][1] };
  const now = act.tot.gp ? per(act.tot, stat) : null;
  const all = pts.concat([pr]);
  const W = 640, H = 200, L = 34, Rr = 16, T = 14, B = 28;
  const max = niceMax(Math.max(...all.map(a => a.hi || a.v), now || 0, 1) * 1.05);
  const n = all.length;
  const x = i => L + (n <= 1 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(STATNAME[stat])} per game by season with the 2026-27 projection">`;
  for (const t of [0, max / 2, max]) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--rule2)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${t % 1 ? t.toFixed(1) : t}</text>`;
  if (pts.length) {
    s += `<polyline points="${pts.map((a, i) => x(i) + "," + y(a.v)).join(" ")}" fill="none" stroke="var(--actual)" stroke-width="2"/>`;
    s += `<line x1="${x(pts.length - 1)}" y1="${y(pts[pts.length - 1].v)}" x2="${x(n - 1)}" y2="${y(pr.v)}" stroke="var(--proj)" stroke-width="2" stroke-dasharray="4 4"/>`;
  }
  pts.forEach((a, i) => { s += `<circle cx="${x(i)}" cy="${y(a.v)}" r="4.5" fill="var(--actual)" stroke="var(--paper)" stroke-width="1.5"/><rect x="${x(i) - 22}" y="${T}" width="44" height="${H - T - B}" fill="transparent" data-tip="${esc(`<b>${seasonLabel(a.y)}</b><br>${a.v.toFixed(1)} ${STATNAME[stat].toLowerCase()} a game in ${a.gp} games`)}"/>`; });
  const xi = x(n - 1);
  s += `<line x1="${xi}" x2="${xi}" y1="${y(pr.hi)}" y2="${y(pr.lo)}" stroke="var(--proj)" stroke-width="2"/><line x1="${xi - 6}" x2="${xi + 6}" y1="${y(pr.hi)}" y2="${y(pr.hi)}" stroke="var(--proj)" stroke-width="2"/><line x1="${xi - 6}" x2="${xi + 6}" y1="${y(pr.lo)}" y2="${y(pr.lo)}" stroke="var(--proj)" stroke-width="2"/>`;
  s += `<rect x="${xi - 6}" y="${y(pr.v) - 6}" width="12" height="12" transform="rotate(45 ${xi} ${y(pr.v)})" fill="var(--paper)" stroke="var(--proj)" stroke-width="2"/>`;
  if (isNum(now)) s += `<circle cx="${xi}" cy="${y(now)}" r="5.5" fill="var(--actual)" stroke="var(--paper)" stroke-width="2"/>`;
  s += `<rect x="${xi - 24}" y="${T}" width="48" height="${H - T - B}" fill="transparent" data-tip="${esc(`<b>2026-27 projection</b><br>${pr.v.toFixed(1)} a game (likely ${pr.lo.toFixed(1)}–${pr.hi.toFixed(1)})${isNum(now) ? "<br>So far: " + now.toFixed(1) : ""}`)}"/>`;
  all.forEach((a, i) => { s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${a.y === 2027 ? "26-27" : seasonLabel(a.y).slice(2)}</text>`; });
  return s + `</svg>`;
}

/* ---------- player pages ---------- */
function idBlock(p) {
  const aw = awards(p);
  const facts = [
    ["Height / weight", `${p.ht}, ${p.wt} lb`], ["Age", `${age(p)} (born ${fmtDate(p.dob, { month: "short", day: "numeric", year: "numeric" })})`],
    ["Born", p.born], ["College", p.college], ["High school", (p.bref.hs || "–").replace(/, (?=[A-Z][^,]* in )/g, "; ")],
    ["Draft", p.bref.draft || "Undrafted"], ["Experience", expText(p)],
    ["How he got here", p.acq], ["Contract", capFor(p) || "–"]
  ];
  if (aw.length) {
    const by = {}; aw.forEach(a => { const m = /^(.*) \((\d{4}-\d{2})\)$/.exec(a); if (!m) return; (by[m[2]] = by[m[2]] || []).push(m[1]); });
    const order = x => /All-NBA|Rookie of|Most Imp|MVP/.test(x) ? 0 : /All-Star/.test(x) ? 1 : 2;
    facts.push(["Honors", Object.keys(by).sort().reverse().slice(0, 3).map(y => `<b>${y}:</b> ${by[y].sort((a, b) => order(a) - order(b)).map(esc).join(", ")}`).join("<br>")]);
  }
  return `<div class="idhead">${photo(p)}<div class="nameblock"><div class="jersey" aria-hidden="true">${esc(p.num)}</div><h1 class="pname">${esc(p.name)}</h1>
    <div class="pmeta">${p.num ? "#" + esc(p.num) : "Number TBA"} · ${esc(p.pos)}${p.bref.shoots ? " · Shoots " + esc(p.bref.shoots.toLowerCase()) : ""}</div><div class="pills">${statusPills(p)}</div></div></div>
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === "Honors" ? v : esc(v)}</dd></div>`).join("")}</dl>
    ${p.role ? `<div><p class="eyebrow">Scouting note</p><p class="role">${esc(p.role)}</p></div>` : ""}`;
}

function seasonSoFar(p, act) {
  const t = act.tot;
  if (!t.gp) {
    const pre = act.pre;
    const opener = (window.PISTONS_DATA && window.PISTONS_DATA.sched || [])[0];
    return `<section class="sec"><p class="eyebrow">2026-27 so far</p><h2>This season</h2>
      <div class="empty">${TEAM.gp ? `No regular-season minutes yet (${TEAM.gp} team games played).` : `The regular season starts ${opener ? fmtDate(opener.date, { weekday: "long", month: "long", day: "numeric" }) + " vs. " + esc(opener.opp) : "Oct. 20"}. His numbers fill in here after each game.`}
      ${pre ? `<br>Preseason: ${pre.gp} game${pre.gp > 1 ? "s" : ""}, ${pre.pts.toFixed(1)} points, ${pre.reb.toFixed(1)} rebounds and ${pre.ast.toFixed(1)} assists in ${pre.min.toFixed(1)} minutes a game.` : ""}</div></section>`;
  }
  const last = act.games.slice(-10), l = { gp: last.length }; CNT.forEach(c => l[c] = last.reduce((a, g) => a + (g[c] || 0), 0));
  const p36 = k => t.min ? t[k] / t.min * 36 : null;
  const tile = (k, lab, sub) => `<div class="tile"><div class="k">${lab}</div><div class="v">${f1(per(t, k))}</div><div class="s">${sub}</div></div>`;
  const trendSel = ["pts", "reb", "ast", "min"].map(k => `<button type="button" data-trend="${k}" aria-pressed="${ui.trendStat === k}">${k === "min" ? "MIN" : k.toUpperCase()}</button>`).join("");
  return `<section class="sec"><p class="eyebrow">2026-27 so far</p><h2>This season</h2><p class="sub">${t.gp} game${t.gp > 1 ? "s" : ""}, ${t.gs} start${t.gs === 1 ? "" : "s"} · Detroit has played ${TEAM.gp}</p>
    <div class="tiles">${tile("pts", "Points", "Last 10: " + f1(per(l, "pts")))}${tile("reb", "Rebounds", "Last 10: " + f1(per(l, "reb")))}${tile("ast", "Assists", "Last 10: " + f1(per(l, "ast")))}${tile("min", "Minutes", "Last 10: " + f1(per(l, "min")))}</div>
    <div class="line"><span>FG <b>${t.fgm}-${t.fga}</b> ${pc(t.fga ? t.fgm / t.fga : null)}</span><span>3P <b>${t.tpm}-${t.tpa}</b> ${pc(t.tpa ? t.tpm / t.tpa : null)}</span><span>FT <b>${t.ftm}-${t.fta}</b> ${pc(t.fta ? t.ftm / t.fta : null)}</span><span>TS <b>${pc(tsOf(t))}</b></span><span>eFG <b>${pc(efgOf(t))}</b></span></div>
    <div class="line"><span class="muted">Per 36:</span><span><b>${f1(p36("pts"))}</b> pts</span><span><b>${f1(p36("reb"))}</b> reb</span><span><b>${f1(p36("ast"))}</b> ast</span><span><b>${f1(p36("stl"))}</b> stl</span><span><b>${f1(p36("blk"))}</b> blk</span></div>
    <div class="chart-head"><div class="seg" role="group" aria-label="Stat to chart">${trendSel}</div>
      <div class="legend"><span><i></i>Each game</span><span><i class="avg"></i>Season average</span><span><i class="band"></i>Projected range</span></div></div>
    <div class="chartbox" id="trend">${trendChart(p, act, ui.trendStat)}</div></section>`;
}

function projectionSec(p, act) {
  const pr = p.proj, now = projNow(p, act), t = act.tot;
  const rows = [["min", "Minutes"], ["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"], ["stl", "Steals"], ["blk", "Blocks"], ["tpm", "3-pointers"]];
  const pcts = [["fg", "FG%"], ["tp", "3P%"], ["ft", "FT%"]];
  const tr = rows.map(([k, lab]) => `<tr><td class="l">${lab}</td><td>${f1(pr.g[k])}</td><td class="muted">${f1(pr.range[k][0])}–${f1(pr.range[k][1])}</td>${now ? `<td>${f1(per(t, k))}</td><td><b>${f1(now.g[k])}</b></td>` : ""}<td>${f0(now ? now.tot[k] : pr.tot ? pr.tot[k] : pr.g[k] * pr.gp)}</td></tr>`).join("")
    + pcts.map(([k, lab]) => `<tr><td class="l">${lab}</td><td>${pcs(pr.pct[k])}</td><td class="muted">${pcs(pr.pctRange[k][0])}–${pcs(pr.pctRange[k][1])}</td>${now ? `<td>${pcs(t[{ fg: "fga", tp: "tpa", ft: "fta" }[k]] ? t[{ fg: "fgm", tp: "tpm", ft: "ftm" }[k]] / t[{ fg: "fga", tp: "tpa", ft: "fta" }[k]] : null)}</td><td><b>${pcs(now.pct[k])}</b></td>` : ""}<td></td></tr>`).join("")
    + `<tr class="tot"><td class="l">Games</td><td>${pr.gp}</td><td class="muted">${pr.gpRange[0]}–${pr.gpRange[1]}</td>${now ? `<td>${t.gp}</td><td><b>${Math.round(now.gp)}</b></td>` : ""}<td></td></tr>`;
  const head = `<tr><th class="l">Per game</th><th>Preseason</th><th>Likely range</th>${now ? `<th>So far</th><th>Now</th>` : ""}<th>Season total</th></tr>`;
  const pj = p.bref.proj36;
  const br36 = pj ? `<p class="note">Second opinion: Basketball Reference's own projection works out to <b>${f1(pj[13])}</b> points, <b>${f1(pj[7])}</b> rebounds and <b>${f1(pj[8])}</b> assists per 36 minutes. This model: <b>${f1(pr.rate.pts * 36)}</b>, <b>${f1(pr.rate.reb * 36)}</b> and <b>${f1(pr.rate.ast * 36)}</b>.</p>` : "";
  const csel = ["pts", "reb", "ast"].map(k => `<button type="button" data-cstat="${k}" aria-pressed="${(ui.cstat || "pts") === k}">${k.toUpperCase()}</button>`).join("");
  const noHist = pr.noNBA ? `<p class="note">No NBA box scores yet, so this is a placeholder: league-average ${({ G: "guard", W: "wing", B: "big" })[p.grp]} rates, trimmed for a rookie, in about ${f1(pr.g.min)} minutes a game. The range is wide on purpose.</p>` : "";
  const vsRows = rows.map(([k, lab]) => rangeRow(lab.replace("3-pointers", "3PM").replace("Minutes", "MIN").replace("Points", "PTS").replace("Rebounds", "REB").replace("Assists", "AST").replace("Steals", "STL").replace("Blocks", "BLK"), pr.range[k][0], pr.g[k], pr.range[k][1], t.gp ? per(t, k) : null, f1)).join("")
    + pcts.map(([k, lab]) => { const m = { fg: ["fgm", "fga"], tp: ["tpm", "tpa"], ft: ["ftm", "fta"] }[k]; const a = t[m[1]] ? t[m[0]] / t[m[1]] : null; return rangeRow(lab, pr.pctRange[k][0], pr.pct[k], pr.pctRange[k][1], t.gp ? a : null, v => pcs(v), 1); }).join("");
  return `<section class="sec"><p class="eyebrow">Projection</p><h2>2026-27 projection</h2>
    <p class="sub">Preseason numbers were frozen on Oct. 13${now ? "; the Now column blends them with his games so far and updates after every game" : " and start blending with real games after his first one"}. Ranges cover the middle 80% of outcomes.</p>
    <div class="scroll"><table class="t">${head}${tr}</table></div>${noHist}${br36}
    <div class="chart-head"><div><p class="eyebrow" style="margin:0">By season</p></div><div class="seg" role="group" aria-label="Stat by season">${csel}</div></div>
    <div class="chartbox" id="cchart">${careerChart(p, ui.cstat || "pts", act)}</div>
    <div class="legend"><span><i></i>Per game by season</span><span><i class="tick" style="transform:rotate(45deg);width:8px;height:8px;background:transparent;border:2px solid var(--proj)"></i>2026-27 projection and range</span>${t.gp ? `<span><i class="dot"></i>2026-27 so far</span>` : ""}</div>
    <div style="margin-top:18px"><p class="eyebrow">Projected vs. actual</p>
    ${t.gp ? "" : `<p class="sub">The dots for his actual numbers appear after his first regular-season game.</p>`}
    <div class="rr">${vsRows}</div>
    <div class="legend" style="margin-top:8px"><span><i class="band"></i>Likely range</span><span><i class="tick"></i>Projection</span><span><i class="dot"></i>Actual</span></div></div></section>`;
}

function nextGameSec(p) {
  const PG = window.PISTONS_PREGAME, MU = window.PISTONS_MATCHUPS || {};
  const today = todayET();
  const g = PG && (PG.games || []).filter(x => x.date >= today).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const sched = ((window.PISTONS_DATA || {}).sched || []).find(x => x.date >= today);
  let body;
  if (g) {
    const mu = MU["g" + g.date.replace(/-/g, "")];
    const rows = mu && mu.proj && mu.proj.rows || [];
    const r = rows.find(x => nkey(x[0]) === nkey(p.name));
    const vs = mu ? (mu.home ? "vs " : "at ") + (mu.opp && mu.opp.name || "") : "";
    if (r) body = `<p class="sub">${esc(fmtDate(g.date, { weekday: "long", month: "short", day: "numeric" }))} ${esc(vs)}${g.phase === "Preseason" ? " (preseason)" : ""}</p>
      <div class="tiles"><div class="tile"><div class="k">Minutes</div><div class="v">${r[2]}</div></div><div class="tile"><div class="k">Points</div><div class="v">${f1(r[3])}</div><div class="s">Range ${esc(r[7])}</div></div><div class="tile"><div class="k">Rebounds</div><div class="v">${f1(r[4])}</div><div class="s">Range ${esc(r[8])}</div></div><div class="tile"><div class="k">Assists</div><div class="v">${f1(r[5])}</div><div class="s">Range ${esc(r[9])}</div></div></div>
      <p class="note">${r[6]} threes projected (range ${esc(r[10])}). From the <a href="${BASE}pregame/">Pistons Pregame</a> model; ranges cover the middle 60%.${mu.proj.projNote ? " " + esc(mu.proj.projNote) : ""}</p>`;
    else body = `<p class="sub">${esc(fmtDate(g.date, { weekday: "long", month: "short", day: "numeric" }))} ${esc(vs)}</p><div class="empty">The Pregame model didn't project him for this game${(g.projNote || "").includes(p.name.split(" ").slice(-1)[0]) ? ": " + esc(g.projNote) : "."}</div>`;
  } else {
    body = `<div class="empty">${sched ? `Next up: ${esc(fmtDate(sched.date, { weekday: "long", month: "short", day: "numeric" }))} ${sched.home ? "vs." : "at"} ${esc(sched.opp)}. ` : ""}The game-day projection appears here once the <a href="${BASE}pregame/">Pregame</a> preview is posted on the morning of the game.</div>`;
  }
  return `<section class="sec"><p class="eyebrow">Next game</p><h2>Next game line</h2>${body}</section>`;
}

/* milestones: career and Pistons round numbers, plus Pistons top-10 lists */
function milestones(p, act, now) {
  const t = act.tot, pr = now || null;
  const pgOf = k => pr ? (pr.rate[k] * pr.mpg) : p.proj.g[k];
  const avail = pr ? pr.avail : p.proj.avail;
  const sched = (window.PISTONS_DATA || {}).sched || [];
  const add = { pts: t.pts, reb: t.reb, ast: t.ast, stl: t.stl, blk: t.blk, tpm: t.tpm, g: t.gp };
  const stats = [["pts", "points", 1000, 500], ["reb", "rebounds", 500, 250], ["ast", "assists", 500, 250], ["tpm", "3-pointers", 100, 100], ["stl", "steals", 100, 100], ["blk", "blocks", 100, 100], ["g", "games", 100, 100]];
  const cur = (base, k) => (k === "g" ? base.gp : base[k]) + (add[k] || 0);
  const items = [];
  const when = (need, k) => {
    const pg = k === "g" ? 1 : pgOf(k);
    const e = M.eta(need, pg, avail); if (!e) return null;
    const n = TEAM.gp + e.teamGames;
    if (n > 82) return { label: "2027-28", n, games: e.games, next: true };
    // games 22 and 23 have no date yet (the NBA Cup window), so there is no day or opponent to show
    const g = sched.find(x => x.n === n);
    if (!g || !g.date) return { label: g ? "Dec. (date TBD)" : "This season", n, games: e.games };
    return { label: fmtDate(g.date, { month: "short", day: "numeric" }), n, games: e.games, date: g.date, opp: g.opp, home: g.home };
  };
  const remGames = Math.max(0, (pr ? pr.rem : p.proj.gp));
  for (const [k, name, step, small] of stats) {
    const c = cur(p.career, k); if (!c && k !== "g") continue;
    const st = c < 2 * step ? small : step;
    const target = Math.floor(c / st) * st + st;
    const need = target - c;
    const w = when(need, k);
    const perG = k === "g" ? 1 : pgOf(k);
    if (!w || need > (remGames * perG) * 1.0 + 0.001) continue;
    items.push({ what: `${target.toLocaleString("en-US")} career ${name}`, need, cur: c, target, w, prog: c / target, how: `${c.toLocaleString("en-US")} now · ${need.toLocaleString("en-US")} to go (about ${w.games} game${w.games === 1 ? "" : "s"})` });
  }
  const L = ((window.PISTONS_MILESTONES || {}).leaders || {}).stats || {};
  const names = { pts: "points", reb: "rebounds", ast: "assists", stl: "steals", blk: "blocks", tpm: "3-pointers", g: "games" };
  for (const k of Object.keys(names)) {
    const list = L[k]; if (!list || !list.length) continue;
    const c = cur(p.det, k); if (!c) continue;
    const others = list.filter(([n]) => nkey(n) !== nkey(p.name));
    const above = others.filter(([, v]) => v > c).sort((a, b) => a[1] - b[1]);
    const rank = others.filter(([, v]) => v > c).length + 1;
    const nxt = above[0]; if (!nxt) continue;
    const need = nxt[1] - c + 1;
    const perG = k === "g" ? 1 : pgOf(k);
    if (need > remGames * perG) continue;
    const w = when(need, k); if (!w) continue;
    const newRank = others.filter(([, v]) => v > nxt[1]).length + 1;
    const inTop = rank <= 10;
    items.push({ what: inTop ? `Passes ${nxt[0]} for ${ord(newRank)} in Pistons ${names[k]}` : `Enters the Pistons top 10 in ${names[k]}`, need, cur: c, target: nxt[1] + 1, w, prog: c / (nxt[1] + 1), franchise: true,
      how: `${c.toLocaleString("en-US")} as a Piston · ${nxt[0]} has ${nxt[1].toLocaleString("en-US")}` });
  }
  items.sort((a, b) => a.w.n - b.w.n);
  return items.slice(0, 6);
}
function milestoneSec(p, act) {
  const now = projNow(p, act);
  const items = milestones(p, act, now);
  const body = items.length ? `<ul class="ms">${items.map(i => `<li><span class="what">${esc(i.what)}</span><span class="when">${esc(i.w.label)}</span><span class="bar2" aria-hidden="true"><i style="width:${Math.min(100, i.prog * 100).toFixed(1)}%"></i></span><span class="how">${esc(i.how)}${i.w.opp ? ` · projected ${i.w.home ? "vs" : "at"} ${esc(i.w.opp)}` : ""}</span></li>`).join("")}</ul>`
    : `<div class="empty">Nothing within reach this season at his projected pace.</div>`;
  return `<section class="sec"><p class="eyebrow">Milestone watch</p><h2>Within reach</h2><p class="sub">Dates assume his projected per-game numbers and that he plays ${Math.round((now ? now.avail : p.proj.avail) * 100)}% of the remaining games. Regular season only.</p>${body}</section>`;
}

function careerSec(p, act) {
  const tabs = [["pg", "Per game"], ["tot", "Totals"], ["adv", "Advanced"], ["po", "Playoffs"]];
  const tabBtns = tabs.map(([k, l]) => `<button type="button" data-ctab="${k}" aria-pressed="${ui.careerTab === k}">${l}</button>`).join("");
  const C = M.COL;
  const team = r => r[1] === "TOT" ? "2 teams" : r[1];
  const pgRow = (lab, tm, r) => { const g = r[C.gp] || 0, d = v => g && isNum(v) ? (v / g).toFixed(1) : "–"; const ts = (r[C.fga] + 0.44 * r[C.fta]) > 0 ? r[C.pts] / (2 * (r[C.fga] + 0.44 * r[C.fta])) : null;
    return `<td>${lab}</td><td class="l">${tm}</td><td>${g}</td><td>${r[C.gs]}</td><td>${f1(r[C.mpg])}</td><td>${d(r[C.pts])}</td><td>${d(r[C.reb])}</td><td>${d(r[C.ast])}</td><td>${d(r[C.stl])}</td><td>${d(r[C.blk])}</td><td>${d(r[C.tov])}</td><td>${d(r[C.tpm])}</td><td>${pcs(r[C.fga] ? r[C.fgm] / r[C.fga] : null)}</td><td>${pcs(r[C.tpa] ? r[C.tpm] / r[C.tpa] : null)}</td><td>${pcs(r[C.fta] ? r[C.ftm] / r[C.fta] : null)}</td><td>${pcs(ts)}</td>`; };
  const toRow = c => [0, "", c.gp, c.gs || 0, c.gp ? c.min / c.gp : 0, c.fgm, c.fga, c.tpm, c.tpa, c.ftm, c.fta, c.oreb || 0, 0, c.reb, c.ast, c.blk, c.stl, 0, isNum(c.tov) ? c.tov : NaN, c.pts, 0, 0];
  let table = "";
  const t = act.tot;
  if (ui.careerTab === "pg" || ui.careerTab === "po") {
    const rows = ui.careerTab === "pg" ? p.espn.r : p.espn.p;
    if (!rows.length) table = `<div class="empty">${ui.careerTab === "po" ? "No playoff games yet." : "No NBA regular-season games yet."}</div>`;
    else {
      let body = rows.map(r => `<tr>${pgRow(seasonLabel(r[0]), team(r), r)}</tr>`).join("");
      const sum = { gp: 0, gs: 0, min: 0 }; ["fgm", "fga", "tpm", "tpa", "ftm", "fta", "reb", "ast", "blk", "stl", "tov", "pts"].forEach(k => sum[k] = 0);
      rows.filter(r => r[1] !== "TOT").forEach(r => { sum.gp += r[C.gp]; sum.gs += r[C.gs]; sum.min += r[C.gp] * r[C.mpg]; ["fgm", "fga", "tpm", "tpa", "ftm", "fta", "reb", "ast", "blk", "stl", "tov", "pts"].forEach(k => sum[k] += r[C[k]]); });
      body += `<tr class="tot">${pgRow("Career", "", toRow(sum))}</tr>`;
      if (ui.careerTab === "pg") {
        if (t.gp) body += `<tr class="now">${pgRow("2026-27", "DET", toRow(Object.assign({}, t, { tov: NaN })))}</tr>`;
        const g = p.proj.g, gp = p.proj.gp;
        body += `<tr class="projrow"><td>26-27 proj.</td><td class="l">DET</td><td>${gp}</td><td></td><td>${f1(g.min)}</td><td>${f1(g.pts)}</td><td>${f1(g.reb)}</td><td>${f1(g.ast)}</td><td>${f1(g.stl)}</td><td>${f1(g.blk)}</td><td>${f1(g.tov)}</td><td>${f1(g.tpm)}</td><td>${pcs(p.proj.pct.fg)}</td><td>${pcs(p.proj.pct.tp)}</td><td>${pcs(p.proj.pct.ft)}</td><td>${pcs(p.proj.ts)}</td></tr>`;
      }
      table = `<div class="scroll"><table class="t"><tr><th class="l">Season</th><th class="l">Tm</th><th>GP</th><th>GS</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>3PM</th><th>FG%</th><th>3P%</th><th>FT%</th><th>TS%</th></tr>${body}</table></div>`;
    }
  } else if (ui.careerTab === "tot") {
    const rows = p.espn.r;
    if (!rows.length) table = `<div class="empty">No NBA regular-season games yet.</div>`;
    else {
      const tr = (lab, tm, r) => `<td>${lab}</td><td class="l">${tm}</td><td>${r[C.gp]}</td><td>${f0(r[C.gp] * r[C.mpg])}</td><td>${f0(r[C.pts])}</td><td>${f0(r[C.reb])}</td><td>${f0(r[C.ast])}</td><td>${f0(r[C.stl])}</td><td>${f0(r[C.blk])}</td><td>${f0(r[C.tpm])}</td><td>${r[C.fgm]}-${r[C.fga]}</td><td>${r[C.ftm]}-${r[C.fta]}</td><td>${r[C.dd]}</td><td>${r[C.td]}</td>`;
      const c = p.career;
      table = `<div class="scroll"><table class="t"><tr><th class="l">Season</th><th class="l">Tm</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>3PM</th><th>FG</th><th>FT</th><th>DD</th><th>TD</th></tr>${rows.map(r => `<tr>${tr(seasonLabel(r[0]), team(r), r)}</tr>`).join("")}
        <tr class="tot"><td>Career</td><td class="l"></td><td>${c.gp}</td><td>${f0(c.min)}</td><td>${f0(c.pts)}</td><td>${f0(c.reb)}</td><td>${f0(c.ast)}</td><td>${f0(c.stl)}</td><td>${f0(c.blk)}</td><td>${f0(c.tpm)}</td><td>${c.fgm}-${c.fga}</td><td>${c.ftm}-${c.fta}</td><td>${c.dd}</td><td>${c.td}</td></tr>
        ${p.det.gp && p.det.gp !== c.gp ? `<tr class="tot"><td>With DET</td><td class="l"></td><td>${p.det.gp}</td><td>${f0(p.det.min)}</td><td>${f0(p.det.pts)}</td><td>${f0(p.det.reb)}</td><td>${f0(p.det.ast)}</td><td>${f0(p.det.stl)}</td><td>${f0(p.det.blk)}</td><td>${f0(p.det.tpm)}</td><td>${p.det.fgm}-${p.det.fga}</td><td>${p.det.ftm}-${p.det.fta}</td><td>${p.det.dd}</td><td>${p.det.td}</td></tr>` : ""}</table></div>`;
    }
  } else {
    const rows = p.bref.adv || [];
    if (!rows.length) table = `<div class="empty">No NBA advanced numbers yet.</div>`;
    else table = `<div class="scroll"><table class="t"><tr><th class="l">Season</th><th class="l">Tm</th><th>MIN</th><th>PER</th><th>TS%</th><th>3PAr</th><th>FTr</th><th>REB%</th><th>AST%</th><th>STL%</th><th>BLK%</th><th>TOV%</th><th>USG%</th><th>WS</th><th>WS/48</th><th>BPM</th><th>VORP</th></tr>
      ${rows.map(r => `<tr><td>${r[0]}</td><td class="l">${esc(r[1] === "2TM" ? "2 teams" : r[1])}</td><td>${f0(r[4])}</td><td>${f1(r[5])}</td><td>${pcs(r[6])}</td><td>${isNum(r[7]) ? r[7].toFixed(3).replace(/^0/, "") : "–"}</td><td>${isNum(r[8]) ? r[8].toFixed(3).replace(/^0/, "") : "–"}</td><td>${f1(r[9])}</td><td>${f1(r[10])}</td><td>${f1(r[11])}</td><td>${f1(r[12])}</td><td>${f1(r[13])}</td><td>${f1(r[14])}</td><td>${f1(r[15])}</td><td>${isNum(r[16]) ? r[16].toFixed(3).replace(/^0/, "").replace(/^-0/, "-") : "–"}</td><td>${f1(r[17])}</td><td>${f1(r[18])}</td></tr>`).join("")}</table></div>
      <p class="note">From Basketball Reference. PER and box plus-minus (BPM) are all-in-one ratings; league average PER is 15 and average BPM is 0. Win shares (WS) estimate wins added.</p>`;
  }
  // career highs
  const h = p.espn.h || {}, hp = p.espn.hp || {};
  const hi = (o, k, lab) => o[k] ? `<div><div class="k">${lab}</div><div class="v">${o[k][0]}</div><div class="muted" style="font-size:12px">${esc(fmtDate(o[k][1], { month: "short", day: "numeric", year: "numeric" }))} ${o[k][2] === "vs" ? "vs" : "@"} ${esc(o[k][3])}</div></div>` : "";
  const highs = h.pts ? `<p class="eyebrow" style="margin-top:16px">Career highs, regular season</p><div class="mini">${hi(h, "pts", "Points")}${hi(h, "reb", "Rebounds")}${hi(h, "ast", "Assists")}${hi(h, "tpm", "3-pointers")}${hi(h, "stl", "Steals")}${hi(h, "blk", "Blocks")}</div>
    <p class="note">${h.n20} games with 20+ points${h.n30 ? `, ${h.n30} with 30+` : ""}${h.n40 ? `, ${h.n40} with 40+` : ""}.${hp.pts ? ` Playoff high: ${hp.pts[0]} points (${fmtDate(hp.pts[1], { month: "short", day: "numeric", year: "numeric" })} ${hp.pts[2] === "vs" ? "vs" : "@"} ${esc(hp.pts[3])}).` : ""} Through 2025-26.</p>` : "";
  return `<section class="sec"><p class="eyebrow">Career</p><h2>The record</h2><div class="chart-head" style="margin-top:4px"><div class="seg" role="group" aria-label="Career table">${tabBtns}</div></div><div style="margin-top:10px">${table}</div>${highs}</section>`;
}

function shotSec(p) {
  const zs = p.bref.zones || [], ob = p.bref.onoff || [];
  if (!zs.length) return "";
  const z = zs.find(r => r[1] === "2TM") || zs[0];
  const o = ob.find(r => r[1] === "2TM") || ob[0];
  const names = ["At the rim (0-3 ft)", "3-10 ft", "10-16 ft", "16 ft to the line", "Threes"];
  const share = z.slice(3, 8), fg = z.slice(8, 13);
  const rows = names.map((n, i) => `<div class="zl">${n.replace(" (0-3 ft)", "").replace("16 ft to the line", "Long 2s")}</div><div class="zb" data-tip="${esc(`<b>${n}</b><br>${pcs(share[i])}% of his shots · made ${isNum(fg[i]) ? pcs(fg[i]) + "%" : "–"}`)}"><i style="width:${(share[i] || 0) * 100}%"></i></div><div class="zv">${isNum(share[i]) ? Math.round(share[i] * 100) + "%" : "–"} <span class="muted">${isNum(fg[i]) ? "· " + pcs(fg[i]) : ""}</span></div>`).join("");
  const posCols = ["#1D428A", "#2F5DB8", "#8C98B0", "#C8102E", "#7A0A1C"];
  const posNames = ["PG", "SG", "SF", "PF", "C"];
  const mix = o ? o.slice(2, 7) : null;
  return `<section class="sec"><p class="eyebrow">2025-26${z[1] && z[1] !== "DET" ? " · " + (z[1] === "2TM" ? "2 teams" : z[1]) : ""}</p><h2>Shot profile</h2><p class="sub">Share of his field-goal attempts by distance, with his percentage from each zone.</p>
    <div class="zones">${rows}</div>
    <div class="mini"><div><div class="k">Avg. shot distance</div><div class="v">${f1(z[2])} ft</div></div><div><div class="k">2s assisted</div><div class="v">${isNum(z[13]) ? Math.round(z[13] * 100) + "%" : "–"}</div></div><div><div class="k">3s assisted</div><div class="v">${isNum(z[14]) ? Math.round(z[14] * 100) + "%" : "–"}</div></div><div><div class="k">Corner 3s</div><div class="v">${isNum(z[15]) ? Math.round(z[15] * 100) + "%" : "–"}</div><div class="muted" style="font-size:12px">${isNum(z[16]) ? "made " + pcs(z[16]) + "%" : ""}</div></div><div><div class="k">Dunks</div><div class="v">${z[17] ?? "–"}</div></div></div>
    ${o ? `<p class="eyebrow" style="margin-top:16px">On the floor</p><div class="mini"><div><div class="k">Team +/- per 100 with him on</div><div class="v ${o[7] >= 0 ? "pos" : "neg"}">${sgn(o[7])}</div></div><div><div class="k">On minus off</div><div class="v ${o[8] >= 0 ? "pos" : "neg"}">${sgn(o[8])}</div></div><div><div class="k">And-ones</div><div class="v">${o[9]}</div></div><div><div class="k">Shooting fouls drawn</div><div class="v">${o[10]}</div></div></div>
      <p class="note" style="margin-top:10px">Where he played (estimated share of minutes by position):</p>
      <div class="posmix" role="img" aria-label="${posNames.map((n, i) => n + " " + mix[i] + "%").join(", ")}">${mix.map((v, i) => v ? `<i style="width:${v}%;background:${posCols[i]}" data-tip="${posNames[i]} ${v}%"></i>` : "").join("")}</div>
      <div class="legend" style="margin-top:6px">${mix.map((v, i) => v ? `<span><i style="background:${posCols[i]};height:8px;width:8px"></i>${posNames[i]} ${v}%</span>` : "").join("")}</div>` : ""}
    <p class="note">From Basketball Reference's shooting and play-by-play tables.</p></section>`;
}

function splitRows(rows) {
  const head = `<tr><th class="l">Split</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG%</th><th>3P%</th><th>FT%</th><th>TS%</th></tr>`;
  return `<div class="scroll"><table class="t">${head}${rows.map(([lab, a]) => { if (!a || !a.gp) return ""; const d = k => (a[k] / a.gp).toFixed(1); const ts = (a.fga + 0.44 * a.fta) > 0 ? a.pts / (2 * (a.fga + 0.44 * a.fta)) : null;
    return `<tr><td>${lab}</td><td>${a.gp}</td><td>${d("min")}</td><td>${d("pts")}</td><td>${d("reb")}</td><td>${d("ast")}</td><td>${pcs(a.fga ? a.fgm / a.fga : null)}</td><td>${pcs(a.tpa ? a.tpm / a.tpa : null)}</td><td>${pcs(a.fta ? a.ftm / a.fta : null)}</td><td>${pcs(ts)}</td></tr>`; }).join("")}</table></div>`;
}
const MONTH = { "10": "October", "11": "November", "12": "December", "01": "January", "02": "February", "03": "March", "04": "April" };
function splitsSec(p, act) {
  const k14 = ["gp", "min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "tpm", "tpa", "ftm", "fta"];
  const fromArr = a => a ? Object.fromEntries(k14.map((k, i) => [k, a[i]])) : null;
  let rows, title, sub;
  if (act.tot.gp >= 5) {
    const gs = act.games, sumOf = list => { if (!list.length) return null; const o = { gp: list.length }; CNT.forEach(c => o[c] = list.reduce((a, g) => a + (g[c] || 0), 0)); return o; };
    const dates = ((window.PISTONS_DATA || {}).sched || []).map(g => g.date);
    const restOf = g => { const i = dates.indexOf(g.d); if (i <= 0) return 9; return Math.round((dObj(g.d) - dObj(dates[i - 1])) / 864e5) - 1; };
    rows = [["Home", sumOf(gs.filter(g => g.home))], ["Road", sumOf(gs.filter(g => !g.home))], ["Wins", sumOf(gs.filter(g => g.win === true))], ["Losses", sumOf(gs.filter(g => g.win === false))],
      ["Started", sumOf(gs.filter(g => g.gs))], ["Off the bench", sumOf(gs.filter(g => !g.gs))], ["Back-to-back", sumOf(gs.filter(g => restOf(g) === 0))], ["1 day rest", sumOf(gs.filter(g => restOf(g) === 1))], ["2+ days rest", sumOf(gs.filter(g => restOf(g) >= 2))]];
    const months = {}; gs.forEach(g => (months[g.d.slice(5, 7)] = months[g.d.slice(5, 7)] || []).push(g));
    Object.keys(months).forEach(m => rows.push([MONTH[m] || m, sumOf(months[m])]));
    title = "2026-27 splits"; sub = "From Detroit's box scores this season.";
  } else if (p.espn.s26) {
    const s = p.espn.s26;
    rows = [["Home", fromArr(s.home)], ["Road", fromArr(s.road)], ["Wins", fromArr(s.wins)], ["Losses", fromArr(s.losses)], ["Back-to-back", fromArr(s.b2b)], ["1 day rest", fromArr(s.rest1)], ["2+ days rest", fromArr(s.rest2)]];
    Object.keys(s.m || {}).sort().forEach(m => rows.push([MONTH[m.slice(5)] || m, fromArr(s.m[m])]));
    title = "2025-26 splits"; sub = `Last season${s.t && s.t.join(",") !== "DET" ? " (" + s.t.join(", ") + ")" : ""}, from ESPN game logs. Rest counts days since his previous game. This season's splits replace these after his fifth game.`;
  } else return "";
  return `<section class="sec"><p class="eyebrow">Splits</p><h2>${title}</h2><p class="sub">${sub}</p>${splitRows(rows)}</section>`;
}

function availabilitySec(p, act) {
  const inj = (((window.PISTONS_TEAM || {}).injuries) || []).filter(x => nkey(x.name) === nkey(p.name));
  const ss = M.seasons(p.espn.r);
  const lastRows = ss.slice(-3).map(s => `${seasonLabel(s.y)}: ${s.gp} of 82`).join(" · ");
  const missed = TEAM.gp ? TEAM.gp - act.tot.gp : null;
  const now = ((((window.PISTONS_DAILY || {}).latest || {}).injuries) || []).find(x => nkey(x.name) === nkey(p.name));
  const nowHtml = now ? `<p class="sub"><span class="pill inj">${esc(now.status)}</span> Current injury report${now.updated ? " (" + esc(now.updated) + ")" : ""}: ${esc(now.detail || "")}</p>` : "";
  return `<section class="sec"><p class="eyebrow">Availability</p><h2>Games and injuries</h2>
    <p class="sub">${lastRows ? "Games played: " + lastRows + "." : "No NBA seasons yet."}${missed !== null ? ` This season he has missed ${missed} of ${TEAM.gp}.` : ""} The model expects about ${p.proj.gp} games${p.status === "Two-way" ? " (two-way players can be active for at most 50)" : ""}.</p>
    ${nowHtml}${inj.length ? `<div class="scroll"><table class="t"><tr><th class="l">From</th><th class="l">To</th><th class="l">Status</th><th class="l">Detail</th></tr>${inj.map(x => `<tr><td>${esc(fmtDate(x.from))}</td><td class="l">${x.open ? "Now" : esc(fmtDate(x.to))}</td><td class="l">${esc(x.status)}</td><td class="l" style="white-space:normal">${esc(x.detail)}</td></tr>`).join("")}</table></div>` : `<div class="empty">No injury-report stints logged this regular season yet.</div>`}</section>`;
}

function sourcesSec(p) {
  return `<section class="sec"><p class="note">Sources: <a href="https://www.espn.com/nba/player/_/id/${p.id}">ESPN</a> (career, game logs, highs) and <a href="https://www.basketball-reference.com/players/${p.bref.id ? p.bref.id[0] + "/" + p.bref.id : ""}.html">Basketball Reference</a> (advanced, shooting, on/off, transactions) through 2025-26; this season from Detroit's box scores on the <a href="${BASE}">Season Hub</a>. How the projection works: <a href="#leaders">see the leaders page</a>.</p></section>`;
}

/* ---------- advanced analytics ---------- */
// 2025-26 league per-game team averages (Basketball Reference "League Average" row) and fixed reference points
const LGPG = { fgm: 42.0, fga: 89.1, tpm: 13.3, tpa: 37.0, ftm: 18.4, fta: 23.5, pts: 115.6 };
const LG = { ts: LGPG.pts / (2 * (LGPG.fga + 0.44 * LGPG.fta)), efg: (LGPG.fgm + 0.5 * LGPG.tpm) / LGPG.fga, tpar: LGPG.tpa / LGPG.fga, ftr: LGPG.fta / LGPG.fga, per: 15, bpm: 0, ws48: 0.1, usg: 20 };
const ADV = { mp: 4, per: 5, ts: 6, tpar: 7, ftr: 8, trb: 9, ast: 10, stl: 11, blk: 12, tov: 13, usg: 14, ws: 15, ws48: 16, bpm: 17, vorp: 18 };
const LAST_SEASON = "2025-26";
const d3 = v => isNum(v) ? v.toFixed(3).replace(/^0/, "").replace(/^-0/, "−") : "–";
const pct1 = v => isNum(v) ? v.toFixed(1) + "%" : "–";
function advRow(p, season) { const rows = (p.bref.adv || []).filter(r => r[0] === season); return rows.find(r => /^\dTM$|^TOT$/.test(r[1])) || rows[0] || null; }
function advSeasons(p) { const by = {}; for (const r of p.bref.adv || []) if (!by[r[0]] || /^\dTM$|^TOT$/.test(r[1])) by[r[0]] = r; return Object.keys(by).sort().map(k => by[k]); }
const ADV_METRICS = [
  ["per", "PER", f1, LG.per, false, "Player efficiency rating: one per-minute number for everything in the box score. League average is 15."],
  ["bpm", "Box plus-minus", sgn, LG.bpm, false, "Points per 100 possessions he adds over an average player, estimated from the box score. 0 is average, +5 is All-Star level."],
  ["vorp", "VORP", f1, null, false, "Value over replacement player: box plus-minus turned into a season total, compared with a minimum-salary fill-in."],
  ["ws", "Win shares", f1, null, false, "Estimated wins he added to the team's total."],
  ["ws48", "WS per 48", d3, LG.ws48, false, "Win shares per 48 minutes. League average is .100."],
  ["ts", "True shooting", v => pcs(v) + "%", LG.ts, false, "Points per shot, counting threes and free throws. League average in 2025-26: " + pcs(LG.ts) + "%."],
  ["usg", "Usage", pct1, LG.usg, null, "Share of the team's plays he finishes with a shot, free throws or a turnover while on the floor. Average is 20%."],
  ["ast", "Assist %", pct1, null, false, "Share of teammates' baskets he assists while on the floor."],
  ["tov", "Turnover %", pct1, null, true, "Turnovers per 100 of his plays. Lower is better."],
  ["trb", "Rebound %", pct1, null, false, "Share of available rebounds he grabs while on the floor."],
  ["stl", "Steal %", pct1, null, false, "Share of opponent possessions that end in his steal."],
  ["blk", "Block %", pct1, null, false, "Share of opponent 2-point tries he blocks."],
  ["tpar", "3-point rate", d3, LG.tpar, null, "Share of his shots that are threes. League average in 2025-26: " + d3(LG.tpar) + "."],
  ["ftr", "Free-throw rate", d3, LG.ftr, null, "Free-throw attempts per shot. League average in 2025-26: " + d3(LG.ftr) + "."]
];
function advPool(season, minMin) { return PLAYERS.map(q => ({ q, r: advRow(q, season) })).filter(x => x.r && x.r[ADV.mp] >= minMin); }
function advRank(p, key, lowerBetter, season) {
  const pool = advPool(season, 500).filter(x => isNum(x.r[ADV[key]]));
  const me = pool.find(x => x.q === p); if (!me) return null;
  pool.sort((a, b) => lowerBetter ? a.r[ADV[key]] - b.r[ADV[key]] : b.r[ADV[key]] - a.r[ADV[key]]);
  return { rank: pool.indexOf(me) + 1, of: pool.length };
}
/* usage vs true shooting, every Piston with 300+ minutes last season, this player highlighted */
function usgTsChart(p, season) {
  const pool = advPool(season, 300).filter(x => isNum(x.r[ADV.usg]) && isNum(x.r[ADV.ts]));
  if (pool.length < 3 || !pool.some(x => x.q === p)) return "";
  const W = 640, H = 300, L = 44, Rr = 14, T = 14, B = 38;
  const xs = pool.map(x => x.r[ADV.usg]).concat([LG.usg]), ys = pool.map(x => x.r[ADV.ts]).concat([LG.ts]);
  const x0 = Math.floor(Math.min(...xs) - 2), x1 = Math.ceil(Math.max(...xs) + 2), y0 = Math.min(...ys) - 0.02, y1 = Math.max(...ys) + 0.02;
  const x = v => L + (W - L - Rr) * (v - x0) / (x1 - x0), y = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Usage against true shooting for Detroit players, ${season}">`;
  const xt = []; for (let v = Math.ceil(x0 / 5) * 5; v <= x1; v += 5) xt.push(v);
  const yt = []; for (let v = Math.ceil(y0 * 20) / 20; v <= y1 + 1e-9; v += 0.05) yt.push(v);
  xt.forEach(v => { s += `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - B}" stroke="var(--rule2)"/><text x="${x(v)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${v}%</text>`; });
  yt.forEach(v => { s += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule2)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${(v * 100).toFixed(0)}%</text>`; });
  s += `<line x1="${x(LG.usg)}" x2="${x(LG.usg)}" y1="${T}" y2="${H - B}" stroke="var(--proj)" stroke-dasharray="4 4"/><line x1="${L}" x2="${W - Rr}" y1="${y(LG.ts)}" y2="${y(LG.ts)}" stroke="var(--proj)" stroke-dasharray="4 4"/>`;
  s += `<text x="${W - Rr - 4}" y="${T + 12}" text-anchor="end" font-size="11" fill="var(--muted)">More shots, more efficient</text><text x="${L + 4}" y="${H - B - 6}" font-size="11" fill="var(--muted)">Fewer shots, less efficient</text>`;
  s += `<text x="${(L + W - Rr) / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--muted)">Usage (share of team plays) · dashed lines = league average</text>`;
  pool.filter(z => z.q !== p).forEach(({ q, r }) => { s += `<circle cx="${x(r[ADV.usg])}" cy="${y(r[ADV.ts])}" r="5" fill="var(--proj)" opacity=".75" data-tip="${esc(`<b>${q.name}</b><br>Usage ${pct1(r[ADV.usg])} · TS ${pcs(r[ADV.ts])}% · ${f0(r[ADV.mp])} min`)}"/>`; });
  const me = pool.find(z => z.q === p).r, mx = x(me[ADV.usg]), my = y(me[ADV.ts]);
  const last = p.name.split(" ").slice(1).join(" ") || p.name;
  s += `<circle cx="${mx}" cy="${my}" r="8" fill="var(--actual)" stroke="var(--paper)" stroke-width="2" data-tip="${esc(`<b>${p.name}</b><br>Usage ${pct1(me[ADV.usg])} · TS ${pcs(me[ADV.ts])}% · ${f0(me[ADV.mp])} min`)}"/>`;
  s += `<text x="${mx + (mx > W - 140 ? -12 : 12)}" y="${my + 4}" text-anchor="${mx > W - 140 ? "end" : "start"}" font-size="12" font-weight="700" fill="var(--ink)">${esc(last)}</text>`;
  return s + `</svg>`;
}
/* small multiples: one rating per panel, by season */
function arcPanel(rows, key, label, fmt, ref) {
  const pts = rows.filter(r => isNum(r[ADV[key]])).map(r => ({ s: r[0], v: r[ADV[key]], mp: r[ADV.mp] }));
  if (pts.length < 2) return "";
  const W = 200, H = 78, L = 6, Rr = 6, T = 10, B = 16;
  const vs = pts.map(a => a.v).concat(isNum(ref) ? [ref] : []);
  let lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < 1e-6) { hi += 1; lo -= 1; } const padv = (hi - lo) * 0.15; lo -= padv; hi += padv;
  const x = i => L + i * (W - L - Rr) / (pts.length - 1), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} by season">`;
  if (isNum(ref)) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(ref)}" y2="${y(ref)}" stroke="var(--proj)" stroke-dasharray="3 3"/>`;
  s += `<polyline points="${pts.map((a, i) => x(i).toFixed(1) + "," + y(a.v).toFixed(1)).join(" ")}" fill="none" stroke="var(--actual)" stroke-width="2"/>`;
  pts.forEach((a, i) => { s += `<circle cx="${x(i)}" cy="${y(a.v)}" r="${i === pts.length - 1 ? 4 : 3}" fill="var(--actual)" stroke="var(--paper)" stroke-width="1.2" data-tip="${esc(`<b>${a.s}</b> · ${label} ${fmt(a.v)}<br>${f0(a.mp)} minutes`)}"/>`; });
  s += `<text x="${L}" y="${H - 3}" font-size="10" fill="var(--muted)">${pts[0].s.slice(2)}</text><text x="${W - Rr}" y="${H - 3}" text-anchor="end" font-size="10" fill="var(--muted)">${pts[pts.length - 1].s.slice(2)}</text>`;
  s += `</svg>`;
  const first = pts[0].v, lastv = pts[pts.length - 1].v;
  return `<div class="arc"><div class="k">${esc(label)}</div><div class="v">${fmt(lastv)}<span class="muted" style="font-size:12px;font-weight:600"> from ${fmt(first)}</span></div>${s}</div>`;
}
/* rate stats straight from the box-score totals, one row per season */
function rateRows(p) {
  const C = M.COL, by = {};
  for (const r of p.espn.r || []) { if (!by[r[0]] || r[1] === "TOT") by[r[0]] = r; }
  return Object.keys(by).map(Number).sort((a, b) => a - b).map(y => {
    const r = by[y], gp = r[C.gp], mn = gp * r[C.mpg];
    if (!gp || !(mn > 0)) return null;
    const g = k => r[C[k]] || 0, p36 = k => g(k) * 36 / mn;
    const gmsc = (g("pts") + 0.4 * g("fgm") - 0.7 * g("fga") - 0.4 * (g("fta") - g("ftm")) + 0.7 * g("oreb") + 0.3 * g("dreb") + g("stl") + 0.7 * g("ast") + 0.7 * g("blk") - 0.4 * g("pf") - g("tov")) / gp;
    const two = 2 * (g("fgm") - g("tpm")), three = 3 * g("tpm"), ft = g("ftm"), pts = g("pts") || 1;
    return { y, tm: r[1] === "TOT" ? "2 teams" : r[1], gp, p36pts: p36("pts"), p36reb: p36("reb"), p36ast: p36("ast"), p36stocks: (g("stl") + g("blk")) * 36 / mn, astTo: g("tov") ? g("ast") / g("tov") : null, gmsc,
      ppsa: (g("fga") + 0.44 * g("fta")) > 0 ? g("pts") / (g("fga") + 0.44 * g("fta")) : null, efg: g("fga") ? (g("fgm") + 0.5 * g("tpm")) / g("fga") : null, mix: [two / pts, three / pts, ft / pts], oreb36: p36("oreb"), pf36: p36("pf") };
  }).filter(Boolean);
}
/* live numbers for this season, from Detroit's box scores (no turnovers in those boxes, so no full usage) */
function liveAdv(p, act) {
  const t = act.tot; if (!t.gp) return null;
  const k = nkey(p.name);
  let tShots = 0, tMin = 0, pmSum = 0, pmMin = 0, pmN = 0;
  for (const g of TEAM.games) {
    const me = g.rows.find(x => x.key === k); if (!me || !(me.min > 0)) continue;
    g.rows.forEach(x => { tShots += (x.fga || 0) + 0.44 * (x.fta || 0); tMin += x.min || 0; });
    if (isNum(me.pm)) { pmSum += me.pm; pmMin += me.min; pmN++; }
  }
  const myShots = t.fga + 0.44 * t.fta;
  const shotShare = tShots > 0 && t.min > 0 ? 100 * myShots * (tMin / 5) / (t.min * tShots) : null;
  const pts = act.games.map(g => g.pts || 0).sort((a, b) => a - b);
  const q = f => pts.length ? pts[Math.min(pts.length - 1, Math.max(0, Math.round(f * (pts.length - 1))))] : null;
  const mean = pts.reduce((a, b) => a + b, 0) / (pts.length || 1);
  const sd = pts.length > 1 ? Math.sqrt(pts.reduce((a, b) => a + (b - mean) ** 2, 0) / (pts.length - 1)) : null;
  return { ts: tsOf(t), efg: efgOf(t), tpar: t.fga ? t.tpa / t.fga : null, ftr: t.fga ? t.fta / t.fga : null, shotShare, pm36: pmMin > 0 ? pmSum * 36 / pmMin : null, pmGames: pmMin > 0, pmN,
    p36: t.min > 0 ? { pts: t.pts * 36 / t.min, reb: t.reb * 36 / t.min, ast: t.ast * 36 / t.min, stocks: (t.stl + t.blk) * 36 / t.min } : null,
    floor: q(0.1), median: q(0.5), ceil: q(0.9), sd, dbl: pts.filter(v => v >= 10).length / (pts.length || 1), gp: t.gp };
}
function advancedSec(p, act) {
  const all = advSeasons(p);
  let season = LAST_SEASON, row = advRow(p, LAST_SEASON);
  if (!row && all.length) { row = all[all.length - 1]; season = row[0]; }
  const live = liveAdv(p, act);
  let html = `<section class="sec"><p class="eyebrow">Advanced analytics</p><h2>Beyond the box score</h2>`;
  if (!row && !live) return html + `<div class="empty">No NBA minutes yet, so there are no advanced numbers. They start with his first regular-season game.</div></section>`;
  // live block first once the season has started
  if (live) {
    const tile = (k, v, s, cls) => `<div><div class="k">${k}</div><div class="v ${cls || ""}">${v}</div>${s ? `<div class="muted" style="font-size:12px">${s}</div>` : ""}</div>`;
    const cmp = (v, ref) => !isNum(v) || !isNum(ref) ? "" : v >= ref ? "pos" : "neg";
    html += `<p class="eyebrow" style="margin-top:4px">2026-27 so far · ${live.gp} game${live.gp === 1 ? "" : "s"}</p><div class="mini">
      ${tile("True shooting", pcs(live.ts) + "%", "Lg avg " + pcs(LG.ts) + "%", cmp(live.ts, LG.ts))}${tile("Effective FG", pcs(live.efg) + "%", "Lg avg " + pcs(LG.efg) + "%", cmp(live.efg, LG.efg))}
      ${tile("Shot share", isNum(live.shotShare) ? live.shotShare.toFixed(1) + "%" : "–", "of team shots while on court")}${tile("3-point rate", d3(live.tpar), "Lg avg " + d3(LG.tpar))}
      ${tile("Free-throw rate", d3(live.ftr), "Lg avg " + d3(LG.ftr))}${live.pmGames ? tile("Plus-minus per 36", sgn(live.pm36), "team margin with him on" + (live.pmN < live.gp ? ` · last ${live.pmN} games` : ""), isNum(live.pm36) ? (live.pm36 >= 0 ? "pos" : "neg") : "") : ""}
      ${live.p36 ? tile("Per 36 minutes", f1(live.p36.pts) + " pts", f1(live.p36.reb) + " reb · " + f1(live.p36.ast) + " ast · " + f1(live.p36.stocks) + " stl+blk") : ""}
      ${tile("Scoring range", isNum(live.floor) ? live.floor + "–" + live.ceil : "–", "10th to 90th percentile game · median " + (live.median ?? "–"))}
      ${tile("Double figures", Math.round(live.dbl * 100) + "%", "of his games" + (isNum(live.sd) ? " · game-to-game SD " + live.sd.toFixed(1) : ""))}</div>
      <p class="note">Calculated from Detroit's box scores. Those boxes don't list turnovers, so this uses shot share (shots plus 0.44 × free throws, per minute, against the team's) in place of full usage, and leaves out game score.</p>`;
  }
  if (row) {
    const small = row[ADV.mp] < 250;
    html += `<p class="eyebrow" style="margin-top:${live ? 18 : 4}px">${season} ratings${row[1] && row[1] !== "DET" ? " · " + esc(/TM$/.test(row[1]) ? "2 teams" : row[1]) : ""} · ${f0(row[ADV.mp])} minutes</p>
      <div class="mini advt">${ADV_METRICS.map(([key, label, fmt, ref, lowerBetter, tip]) => {
        const v = row[ADV[key]]; if (!isNum(v)) return "";
        const rk = season === LAST_SEASON ? advRank(p, key, lowerBetter, season) : null;
        const cls = isNum(ref) && lowerBetter !== null ? ((lowerBetter ? v <= ref : v >= ref) ? "pos" : "neg") : "";
        const sub = [isNum(ref) ? "Lg avg " + fmt(ref) : "", rk && lowerBetter !== null ? `${ord(rk.rank)} of ${rk.of} on DET` : ""].filter(Boolean).join(" · ");
        return `<div data-tip="${esc(`<b>${label}</b><br>${tip}`)}"><div class="k">${label}</div><div class="v ${cls}">${fmt(v)}</div>${sub ? `<div class="muted" style="font-size:12px">${sub}</div>` : ""}</div>`;
      }).join("")}</div>
      <p class="note">From Basketball Reference. Roster ranks count players on this year's roster with 500+ minutes last season, wherever they played.${small ? " Small sample: fewer than 250 minutes, so read these loosely." : ""} Tap or hover a number for what it means.</p>`;
    const chart = season === LAST_SEASON ? usgTsChart(p, season) : "";
    if (chart) html += `<p class="eyebrow" style="margin-top:16px">Volume vs. efficiency, ${season}</p><p class="sub" style="margin-bottom:0">How much of the offense he carried and how efficiently, next to this year's teammates (300+ minutes).</p><div class="chartbox">${chart}</div>`;
  }
  const arcs = [["per", "PER", f1, LG.per], ["bpm", "Box plus-minus", sgn, LG.bpm], ["ws48", "WS per 48", d3, LG.ws48], ["ts", "True shooting", v => pcs(v) + "%", null], ["usg", "Usage", pct1, LG.usg], ["ast", "Assist %", pct1, null]].map(([k, l, f, r]) => arcPanel(all, k, l, f, r)).join("");
  if (arcs) html += `<p class="eyebrow" style="margin-top:16px">Career arc</p><p class="sub" style="margin-bottom:6px">Each rating by season (traded seasons combined). Dashed line = league average.</p><div class="arcs">${arcs}</div>`;
  const rr = rateRows(p);
  if (rr.length) {
    const mix = m => `<span class="mixbar" role="img" aria-label="${Math.round(m[0] * 100)}% of points from 2s, ${Math.round(m[1] * 100)}% from 3s, ${Math.round(m[2] * 100)}% from free throws"><i style="width:${(m[0] * 100).toFixed(1)}%;background:var(--actual)"></i><i style="width:${(m[1] * 100).toFixed(1)}%;background:var(--proj)"></i><i style="width:${(m[2] * 100).toFixed(1)}%;background:var(--bad)"></i></span>`;
    html += `<p class="eyebrow" style="margin-top:16px">Rate stats by season</p><div class="scroll"><table class="t"><tr><th class="l">Season</th><th class="l">Tm</th><th>PTS/36</th><th>REB/36</th><th>AST/36</th><th>STL+BLK/36</th><th>AST/TO</th><th>Game score</th><th>Pts/shot</th><th>eFG%</th><th class="l">Points from 2s · 3s · FTs</th></tr>
      ${rr.map(r => `<tr><td>${seasonLabel(r.y)}</td><td class="l">${esc(r.tm)}</td><td>${f1(r.p36pts)}</td><td>${f1(r.p36reb)}</td><td>${f1(r.p36ast)}</td><td>${f1(r.p36stocks)}</td><td>${isNum(r.astTo) ? r.astTo.toFixed(2) : "–"}</td><td>${f1(r.gmsc)}</td><td>${isNum(r.ppsa) ? r.ppsa.toFixed(2) : "–"}</td><td>${pcs(r.efg)}</td><td class="l">${mix(r.mix)}<span class="muted" style="font-size:12px"> ${Math.round(r.mix[0] * 100)} · ${Math.round(r.mix[1] * 100)} · ${Math.round(r.mix[2] * 100)}</span></td></tr>`).join("")}</table></div>
      <p class="note">Calculated from ESPN season totals. Game score is John Hollinger's single-game rating averaged over the season (about 10 is average, 20+ is a big night). Pts/shot = points per shot attempt counting free throws (league average ${(LG.ts * 2).toFixed(2)}).</p>`;
  }
  return html + `</section>`;
}

function playerSpread(p) {
  const act = actualFor(p);
  const left = idBlock(p) + seasonSoFar(p, act) + projectionSec(p, act) + nextGameSec(p) + advancedSec(p, act);
  const right = milestoneSec(p, act) + careerSec(p, act) + shotSec(p) + splitsSec(p, act) + availabilitySec(p, act) + sourcesSec(p);
  return { left, right, act };
}

/* ---------- cover, contents, leaders ---------- */
function teamRecord() {
  const res = (window.PISTONS_RESULTS || {}).games || {};
  let w = 0, l = 0; Object.entries(res).forEach(([d, g]) => { if (isReg(d, g.type || g.note) && isNum(g.det)) g.det > g.opp ? w++ : l++; });
  return { w, l };
}
function leadersBy(k, n, mode) {
  const vals = PLAYERS.map(p => ({ p, v: valueFor(p, k, mode || "proj") })).filter(x => isNum(x.v));
  return vals.sort((a, b) => b.v - a.v).slice(0, n);
}
function valueFor(p, k, mode) {
  if (mode === "adv") {
    if (k === "onoff") { const o = (p.bref.onoff || []).filter(r => r[0] === LAST_SEASON); const r = o.find(x => /^\dTM$|^TOT$/.test(x[1])) || o[0]; return r && isNum(r[8]) ? r[8] : null; }
    const r = advRow(p, LAST_SEASON); return r && isNum(r[ADV[k]]) ? r[ADV[k]] : null;
  }
  if (mode === "proj") return k === "gp" ? p.proj.gp : k === "fg" || k === "tp" || k === "ft" ? p.proj.pct[k] : k === "ts" ? p.proj.ts : p.proj.g[k];
  const a = p._act || (p._act = actualFor(p)), t = a.tot;
  if (!t.gp) return null;
  const actual = k === "gp" ? t.gp : k === "fg" ? (t.fga ? t.fgm / t.fga : null) : k === "tp" ? (t.tpa ? t.tpm / t.tpa : null) : k === "ft" ? (t.fta ? t.ftm / t.fta : null) : k === "ts" ? tsOf(t) : per(t, k);
  if (mode === "act") return actual;
  if (!isNum(actual)) return null;
  if (k === "gp") return null;
  return actual - valueFor(p, k, "proj");
}
function coverSpread() {
  const rec = teamRecord(), sched = (window.PISTONS_DATA || {}).sched || [];
  const today = todayET(), nxt = sched.find(g => g.date >= today);
  const newCount = PLAYERS.filter(p => p.newTeam).length, rookies = PLAYERS.filter(p => p.rookieYear).length;
  const teamPts = PLAYERS.reduce((a, p) => a + p.proj.g.pts * p.proj.avail, 0);
  const teamReb = PLAYERS.reduce((a, p) => a + p.proj.g.reb * p.proj.avail, 0);
  const teamAst = PLAYERS.reduce((a, p) => a + p.proj.g.ast * p.proj.avail, 0);
  const left = `<div class="cover-title"><span class="t1">Detroit Pistons</span><span class="t2">Yearbook</span><span class="t3">The 2026-27 season</span></div>
    <div class="stripe" aria-hidden="true"></div>
    <div class="tiles"><div class="tile"><div class="k">Record</div><div class="v">${rec.w + rec.l ? rec.w + "-" + rec.l : "0-0"}</div><div class="s">${rec.w + rec.l ? "Regular season" : "Opener Oct. 20"}</div></div>
      <div class="tile"><div class="k">Roster</div><div class="v">${PLAYERS.length}</div><div class="s">${PLAYERS.filter(p => p.status === "Two-way").length} two-way, ${PLAYERS.filter(p => p.status === "Camp").length} camp</div></div>
      <div class="tile"><div class="k">New faces</div><div class="v">${newCount}</div><div class="s">${rookies} rookies</div></div>
      <div class="tile"><div class="k">Last season</div><div class="v">60-22</div><div class="s">1st in the East</div></div></div>
    ${nxt ? `<p class="role">Next game: <b>${esc(fmtDate(nxt.date, { weekday: "long", month: "long", day: "numeric" }))}</b> ${nxt.home ? "vs." : "at"} ${esc(nxt.opp)}${nxt.tv ? " on " + esc(nxt.tv) : ""}.</p>` : ""}
    <section class="sec"><p class="eyebrow">How to use it</p><p class="role" style="font-weight:400">Every player gets a spread: who he is and what the model expects on the left, what he has done on the right. ${CONFIG.inline ? `This copy is a snapshot of the data as of ${esc(fmtDate(YB.asOf, { month: "short", day: "numeric", year: "numeric" }))}, so it doesn't update on its own. The live yearbook fills in this season's numbers from Detroit's box scores every morning` : "The numbers for this season fill in from Detroit's box scores every morning"}, and each projection shifts toward what he is actually doing as the games pile up.</p></section>
    <p><a href="#contents">Open the contents &#8250;</a></p>`;
  const card = (k, lab, fmt) => `<div class="card"><p class="eyebrow" style="margin:0">${lab}</p><ol>${leadersBy(k, 3).map(x => `<li><a href="#${x.p.slug}">${esc(x.p.name)}</a><b>${fmt(x.v)}</b></li>`).join("")}</ol></div>`;
  const right = `<section class="sec"><p class="eyebrow">Projected leaders</p><h2>Who the model likes</h2><p class="sub">Per game, from the preseason projections frozen Oct. 13.</p>
    <div class="ldr">${card("pts", "Points", f1)}${card("reb", "Rebounds", f1)}${card("ast", "Assists", f1)}${card("tpm", "3-pointers", f1)}${card("stl", "Steals", f1)}${card("blk", "Blocks", f1)}</div></section>
    <section class="sec"><p class="eyebrow">Adds up to</p><h2>The team, by the numbers</h2>
    <div class="mini"><div><div class="k">Points a game</div><div class="v">${f1(teamPts)}</div><div class="muted" style="font-size:12px">117.8 last season</div></div><div><div class="k">Rebounds</div><div class="v">${f1(teamReb)}</div><div class="muted" style="font-size:12px">45.6 last season</div></div><div><div class="k">Assists</div><div class="v">${f1(teamAst)}</div><div class="muted" style="font-size:12px">27.8 last season</div></div><div><div class="k">Minutes fit</div><div class="v">${f1(YB.teamMinutes)}</div><div class="muted" style="font-size:12px">per game, all players</div></div></div>
    <p class="note">Each player's projected per-game line times the share of games he is expected to play, summed over the roster. It lands close to last season's team numbers, which is a useful check that the minutes and rates hang together.</p></section>`;
  return { left, right };
}
function contentsSpread() {
  const face = (p, i) => `<a class="face" href="#${p.slug}">${photo(p)}<span class="fn"><span>${esc(p.num)}</span>${esc(p.name)}</span><span class="fs">${esc(p.pos)}${p.status !== "Standard" ? " · " + esc(p.status === "Camp" ? "Camp" : "Two-way") : ""} · p. ${i + 4}</span><span class="fs">Proj. ${f1(p.proj.g.pts)} pts · ${f1(p.proj.g.reb)} reb · ${f1(p.proj.g.ast)} ast</span></a>`;
  const half = Math.ceil(PLAYERS.length / 2);
  return {
    left: `<section class="sec"><p class="eyebrow">Contents</p><h2>The class of 2026-27</h2><p class="sub">In jersey-number order. Tap a player to open his page. Page 3 ranks everyone.</p><div class="facegrid">${PLAYERS.slice(0, half).map((p, i) => face(p, i)).join("")}</div></section>`,
    right: `<section class="sec"><p class="eyebrow">Contents, continued</p><div class="facegrid">${PLAYERS.slice(half).map((p, i) => face(p, i + half)).join("")}</div></section>`
  };
}
function leadersSpread() {
  const cols = [["gp", "GP", v => isNum(v) ? Math.round(v) : "–"], ["min", "MIN", f1], ["pts", "PTS", f1], ["reb", "REB", f1], ["ast", "AST", f1], ["stl", "STL", f1], ["blk", "BLK", f1], ["tpm", "3PM", f1], ["fg", "FG%", pcs], ["tp", "3P%", pcs], ["ft", "FT%", pcs], ["ts", "TS%", pcs]];
  const anyAct = PLAYERS.some(p => (p._act || (p._act = actualFor(p))).tot.gp);
  if (!anyAct && ui.ldrMode !== "proj" && ui.ldrMode !== "adv") ui.ldrMode = "proj";
  const mode = ui.ldrMode;
  if (mode === "adv") cols.splice(0, cols.length, ["mp", "MIN", f0], ["per", "PER", f1], ["bpm", "BPM", sgn], ["vorp", "VORP", f1], ["ws", "WS", f1], ["ws48", "WS/48", d3], ["ts", "TS%", pcs], ["usg", "USG%", f1], ["ast", "AST%", f1], ["tov", "TOV%", f1], ["trb", "REB%", f1], ["stl", "STL%", f1], ["blk", "BLK%", f1], ["onoff", "On-off", sgn]);
  if (!cols.some(c => c[0] === ui.ldrSort.k)) ui.ldrSort = { k: mode === "adv" ? "bpm" : "pts", dir: -1 };
  const fmtDiff = (k, v) => { if (!isNum(v)) return "–"; const pct = ["fg", "tp", "ft", "ts"].includes(k); const s = pct ? (v * 100) : v; return `<span class="${s > 0.05 ? "pos" : s < -0.05 ? "neg" : ""}">${sgn(s)}</span>`; };
  const { k: sk, dir } = ui.ldrSort;
  const list = PLAYERS.map(p => ({ p, v: Object.fromEntries(cols.map(([k]) => [k, valueFor(p, k, mode)])) }))
    .sort((a, b) => { const x = a.v[sk], y = b.v[sk]; if (!isNum(x) && !isNum(y)) return 0; if (!isNum(x)) return 1; if (!isNum(y)) return -1; return (x - y) * dir; });
  const modes = [["proj", "Projected"], ["act", "2026-27 actual"], ["diff", "Actual vs. projected"], ["adv", "Advanced, 2025-26"]];
  const seg = modes.map(([k, l]) => `<button type="button" data-lmode="${k}" aria-pressed="${mode === k}" ${k !== "proj" && k !== "adv" && !anyAct ? "disabled title=\"After the first game\"" : ""}>${l}</button>`).join("");
  const table = `<div class="scroll"><table class="t sortable"><tr><th class="l">Player</th>${cols.map(([k, l]) => `<th data-sort="${k}" ${sk === k ? `aria-sort="${dir < 0 ? "descending" : "ascending"}"` : ""} tabindex="0">${l}</th>`).join("")}</tr>
    ${list.map(({ p, v }) => `<tr><td><a href="#${p.slug}">${esc(p.name)}</a></td>${cols.map(([k, , fm]) => `<td>${mode === "diff" ? fmtDiff(k, v[k]) : fm(v[k])}</td>`).join("")}</tr>`).join("")}</table></div>`;
  const m = YB.model;
  const left = `<section class="sec"><p class="eyebrow">Leaders</p><h2>The whole roster</h2><p class="sub">${mode === "proj" ? "Preseason projections, per game. GP is projected games." : mode === "act" ? "This season's actual numbers, per game." : mode === "diff" ? "Actual minus projected, per game (percentages in points). Green is ahead of the projection." : "Last season's Basketball Reference ratings, wherever each player was (traded seasons combined). On-off is the team's net rating per 100 possessions with him on the floor minus with him off. Rookies have none yet."} Tap a column to sort.</p>
    <div class="seg" role="group" aria-label="Numbers to show" style="margin-bottom:10px">${seg}</div>${table}</section>`;
  const right = `<section class="sec"><p class="eyebrow">Method</p><h2>How the projections work</h2>
    <p class="role" style="font-weight:400">The preseason projection is a Marcel-style forecast, the simplest kind that holds up well against fancier systems.</p>
    <ol class="role" style="font-weight:400;padding-left:20px;margin:0;display:flex;flex-direction:column;gap:6px">
      <li><b>Rates from the last three seasons.</b> Points, rebounds, assists and the rest are counted per minute, with 2025-26 weighted ${m.weights[0]}, 2024-25 weighted ${m.weights[1]} and 2023-24 weighted ${m.weights[2]}.</li>
      <li><b>Pulled toward average.</b> Each player gets about 200 minutes of a league-average guard, wing or big (2025-26 Basketball Reference per-minute numbers) mixed in, so small samples don't run wild. Shooting percentages are pulled toward the league mark the same way, and players who rarely shoot threes are pulled toward a lower 3-point mark.</li>
      <li><b>Age.</b> Rates rise a little for players under 27 (up to 6% at 21 and younger) and fall a little after 28 (down to 4% at 33 and older).</li>
      <li><b>Minutes that fit.</b> Each player's minutes come from his recent minutes per game. Then the whole roster is fitted to a ${m.teamMin}-minute game: mid-rotation players give up the most, stars and deep reserves the least.</li>
      <li><b>Games.</b> His share of games played over three seasons, pulled toward 80%. Two-way players are capped at 50.</li>
      <li><b>Rookies and players with no NBA games</b> get league-average rates for their position, trimmed for a rookie, in short minutes, with a very wide range.</li>
      <li><b>During the season</b> the preseason rates count as ${m.inSeasonK} minutes of play, so his real numbers take over as minutes pile up. Remaining games use his playing rate this season so far.</li>
    </ol>
    <p class="note">Ranges cover the middle 80% of outcomes and come from how much data the player has and how settled his role is. New arrivals get a wider minutes range. Game-day lines on each page come from the separate Pistons Pregame model.</p></section>`;
  return { left, right };
}

/* ---------- pages, navigation ---------- */
function buildPages() {
  PAGES = [{ id: "cover", title: "Cover" }, { id: "contents", title: "Contents" }, { id: "leaders", title: "Leaders" }]
    .concat(PLAYERS.map(p => ({ id: p.slug, title: p.name, p })));
}
function pageIndexFromHash() {
  const h = decodeURIComponent((location.hash || "").slice(1)).toLowerCase();
  if (!h) return CONFIG.start ? Math.max(0, PAGES.findIndex(x => x.id === CONFIG.start)) : 0;
  let i = PAGES.findIndex(x => x.id === h);
  if (i < 0) { const p = PLAYERS.find(x => (x.alias || []).includes(h)); if (p) i = PAGES.findIndex(x => x.id === p.slug); }
  return i < 0 ? 0 : i;
}
function render(dir) {
  const pg = PAGES[cur];
  let s;
  try {
    if (pg.id === "cover") s = coverSpread(); else if (pg.id === "contents") s = contentsSpread(); else if (pg.id === "leaders") s = leadersSpread(); else s = playerSpread(pg.p);
  } catch (e) {
    // one bad section shouldn't leave the previous page on screen under the new page's address
    console.error(e);
    s = { left: `<div class="empty">This page couldn't be drawn. Try reloading, or turn to another page.</div>`, right: "" };
  }
  const n = cur + 1, folioL = `<span class="folio">${pg.p ? esc(pg.p.name) + " · " : ""}Pistons Yearbook 2026-27</span>`, folioR = `<span class="folio">Page ${n} of ${PAGES.length}</span>`;
  const sp = $("#spread");
  sp.classList.remove("in-next", "in-prev"); void sp.offsetWidth;
  sp.innerHTML = `<article class="leaf left" aria-label="${esc(pg.title)}, left page">${s.left}${folioL}</article><article class="leaf right" aria-label="${esc(pg.title)}, right page">${s.right}${folioR}</article>`;
  if (dir) sp.classList.add(dir > 0 ? "in-next" : "in-prev");
  // wide tables scroll sideways: make those focusable so the arrow keys can scroll them
  sp.querySelectorAll(".scroll").forEach(el => { if (el.scrollWidth > el.clientWidth) el.tabIndex = 0; });
  $("#pageno").textContent = `Page ${n} of ${PAGES.length}`;
  if (pg.p) {
    const nm = String(pg.p.name || ""), sp = nm.indexOf(" "), hasNum = pg.p.num !== undefined && pg.p.num !== null && pg.p.num !== "";
    /* the first name is dropped on the narrowest phones */
    $("#pwho").innerHTML = (hasNum ? `<b>#${esc(pg.p.num)}</b>` : "") + (sp > 0 ? `<span class="fn">${esc(nm.slice(0, sp + 1))}</span>${esc(nm.slice(sp + 1))}` : esc(nm));
  } else $("#pwho").innerHTML = "";
  watchName();
  $("#prev").disabled = cur === 0; $("#next").disabled = cur === PAGES.length - 1;
  document.title = (pg.p ? pg.p.name + " · " : "") + "Pistons Yearbook 2026-27";
  document.querySelectorAll("#dots button").forEach((b, i) => { if (i === cur) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
}
/* sticky player label (Oct 17, 2026): once the player's name block scrolls under the top bar,
   the bar shows his number and name in place of "Page n of N" */
let nameRaf = 0;
function watchName() {
  const bar = $("#bar"), name = document.querySelector("#spread .pname");
  if (!bar) return;
  if (!name || !$("#pwho").textContent) { bar.classList.remove("past"); return; }
  bar.classList.toggle("past", name.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
}
window.addEventListener("scroll", () => { if (!nameRaf) nameRaf = requestAnimationFrame(() => { nameRaf = 0; watchName(); }); }, { passive: true });
window.addEventListener("resize", () => watchName());
function go(i, fromHash) {
  if (i < 0 || i >= PAGES.length) return;
  const dir = i > cur ? 1 : i < cur ? -1 : 0;
  cur = i;
  if (!fromHash) { const id = PAGES[i].id; if (("#" + id) !== location.hash) { try { history.pushState(null, "", "#" + id); } catch (e) { location.hash = id; } } }
  render(dir);
  closeToc();
  const top = $("#desk").getBoundingClientRect().top + window.scrollY - 64;
  if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}
function buildDots() {
  $("#dots").innerHTML = PAGES.map((p, i) => `<button type="button" aria-label="Page ${i + 1}: ${esc(p.title)}" data-go="${i}"></button>`).join("");
}
function tocHtml() {
  return `<ol>${PAGES.map((p, i) => `<li><a href="#${p.id}" ${i === cur ? 'aria-current="page"' : ""}><span class="n">${p.p ? esc(p.p.num) : ""}</span><span>${esc(p.title)}</span><span class="pg">p. ${i + 1}</span></a></li>`).join("")}</ol>`;
}
function openToc() { const t = $("#tocpop"); t.innerHTML = tocHtml(); t.hidden = false; $("#tocbtn").setAttribute("aria-expanded", "true"); }
function closeToc() { $("#tocpop").hidden = true; $("#tocbtn").setAttribute("aria-expanded", "false"); }

/* ---------- events ---------- */
function wire() {
  $("#prev").addEventListener("click", () => go(cur - 1));
  $("#next").addEventListener("click", () => go(cur + 1));
  $("#tocbtn").addEventListener("click", e => { e.stopPropagation(); $("#tocpop").hidden ? openToc() : closeToc(); });
  document.addEventListener("click", e => {
    if (!$("#tocpop").hidden && !e.target.closest("#tocpop") && !e.target.closest("#tocbtn")) closeToc();
    const d = e.target.closest("[data-go]"); if (d) { go(+d.dataset.go); return; }
    const t = e.target.closest("[data-trend]"); if (t) { ui.trendStat = t.dataset.trend; store.set("yb-trend", ui.trendStat); render(0); return; }
    const c = e.target.closest("[data-cstat]"); if (c) { ui.cstat = c.dataset.cstat; render(0); return; }
    const ct = e.target.closest("[data-ctab]"); if (ct) { ui.careerTab = ct.dataset.ctab; render(0); return; }
    const lm = e.target.closest("[data-lmode]"); if (lm && !lm.disabled) { ui.ldrMode = lm.dataset.lmode; render(0); return; }
    const so = e.target.closest("th[data-sort]"); if (so) { const k = so.dataset.sort; ui.ldrSort = { k, dir: ui.ldrSort.k === k ? -ui.ldrSort.dir : -1 }; render(0); return; }
    const a = e.target.closest('a[href^="#"]'); if (a) { const id = a.getAttribute("href").slice(1); const i = PAGES.findIndex(p => p.id === id); if (i >= 0) { e.preventDefault(); go(i); } }
  });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select")) return;
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && (e.altKey || e.ctrlKey || e.metaKey || e.target.closest(".scroll"))) return;
    if (e.key === "ArrowRight") go(cur + 1); else if (e.key === "ArrowLeft") go(cur - 1); else if (e.key === "Escape") closeToc();
    else if ((e.key === "Enter" || e.key === " ") && e.target.matches("th[data-sort]")) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener("popstate", () => go(pageIndexFromHash(), true));
  window.addEventListener("hashchange", () => { const i = pageIndexFromHash(); if (i !== cur) go(i, true); });
  // swipe
  let sx = 0, sy = 0, st = 0, tracking = false;
  const desk = $("#desk");
  desk.addEventListener("touchstart", e => { if (e.touches.length !== 1 || e.target.closest(".scroll")) { tracking = false; return; } tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
  desk.addEventListener("touchend", e => { if (!tracking) return; tracking = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - st < 800) go(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
  // tooltips
  const tip = $("#tip");
  const show = (el, x, y) => { tip.innerHTML = el.getAttribute("data-tip"); tip.hidden = false; const r = tip.getBoundingClientRect(); let L = x + 14, T = y + 14; if (L + r.width > innerWidth - 8) L = x - r.width - 14; if (T + r.height > innerHeight - 8) T = y - r.height - 14; tip.style.left = Math.max(8, L) + "px"; tip.style.top = Math.max(8, T) + "px"; };
  document.addEventListener("pointermove", e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) show(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener("pointerdown", e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el && e.pointerType !== "mouse") show(el, e.clientX, e.clientY); });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });
}

/* ---------- start ---------- */
(async function start() {
  await loadAll();
  YB = window.PISTONS_YEARBOOK;
  if (!YB) { $("#spread").innerHTML = `<article class="leaf left"><div class="empty">The yearbook data didn't load. Try reloading the page.</div></article>`; return; }
  if (CONFIG.hubHref) $("#hublink").href = CONFIG.hubHref;
  PLAYERS = YB.players.slice().sort((a, b) => { const x = a.num === "" || a.num == null ? 999 : +a.num, y = b.num === "" || b.num == null ? 999 : +b.num; return x - y || a.name.localeCompare(b.name); });
  PLAYERS.forEach(p => { if (p.rookie && !(p.espn.r || []).length) p.rookieYear = true; });
  if (CONFIG.only) PLAYERS = PLAYERS.filter(p => CONFIG.only.includes(p.slug));
  buildSeason();
  buildPages();
  if (CONFIG.only) PAGES = PAGES.filter(p => p.p);
  buildDots();
  wire();
  cur = pageIndexFromHash();
  render(0);
})();
})();
