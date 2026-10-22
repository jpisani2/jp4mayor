// Box score / preview for one game, fetched live from ESPN when opened
import { LEAGUES, LIVE_REFRESH_MS } from './config.js';
import { api, normEvent, statusOf, periodName, espnGameUrl, ordinal } from './espn.js';
import { esc, logo, fmtLong, fmtTime, fmtFull, ago, readableColor, colorDistance, store, isDark } from './util.js';

const G = {
  el: null, lg: null, id: null, d: null, g: null, ts: 0, err: false,
  tab: 'summary', boxSide: null, period: null, scoringOnly: false, open: new Set(),
  loading: null,
};

export function initGame(el) {
  G.el = el;
  el.addEventListener('click', onClick);
}

export function openGame(lg, id) {
  if (G.lg !== lg || G.id !== id) {
    Object.assign(G, { lg, id, d: null, g: null, ts: 0, err: false, tab: 'summary', boxSide: null, period: null, scoringOnly: false, open: new Set() });
    G.el.scrollTop = 0;
  }
  render();
  return loadGame();
}

export function loadGame({ quiet = false } = {}) {
  if (G.loading) return G.loading;
  const { lg, id } = G;
  G.loading = (async () => {
    try {
      const d = await api.summary(lg, id);
      if (lg !== G.lg || id !== G.id) return;
      G.d = d; G.g = parseGame(d, lg, id); G.ts = Date.now(); G.err = false;
    } catch {
      if (lg !== G.lg || id !== G.id) return;
      G.err = true;
    }
    render();
  })().finally(() => { G.loading = null; });
  return G.loading;
}

export const gameIsLive = () => !!G.g && G.g.state === 'in';
export const gameKey = () => `${G.lg}:${G.id}`;
export function tickUpdated() {
  const u = G.el?.querySelector('.upd');
  if (u && G.ts) u.textContent = `Updated ${ago(G.ts)}`;
}
export function rerenderGame() { if (G.g || G.err) render(); }

function parseGame(d, lg, id) {
  const comp = d.header?.competitions?.[0] || {};
  const g = normEvent({ id, date: comp.date, competitions: [comp], season: d.header?.season }, lg);
  const cs = comp.competitors || [];
  g.rawHome = cs.find((c) => c.homeAway === 'home') || cs[0] || {};
  g.rawAway = cs.find((c) => c.homeAway === 'away') || cs[1] || {};
  if (!g.venue) g.venue = d.gameInfo?.venue?.fullName || '';
  const city = d.gameInfo?.venue?.address;
  g.city = city ? [city.city, city.state].filter(Boolean).join(', ') : '';
  if (!g.tv && Array.isArray(d.broadcasts)) {
    const n = d.broadcasts.map((b) => b.media?.shortName || b.station).filter(Boolean);
    g.tv = [...new Set(n)].slice(0, 2).join(', ');
  }
  // team colors that read well together
  let ac = readableColor(g.away.color, g.away.alt);
  let hc = readableColor(g.home.color, g.home.alt);
  if (colorDistance(ac, hc) < 70) hc = readableColor(g.home.alt, g.home.color);
  if (colorDistance(ac, hc) < 70) hc = isDark() ? '#9a958d' : '#6f6b65';
  g.ac = ac; g.hc = hc;
  return g;
}

// ---------------- events ----------------
function onClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'back') { e.preventDefault(); window.dispatchEvent(new CustomEvent('scores:back')); return; }
  if (act === 'tab') { G.tab = a.dataset.v; render(); G.el.scrollTop = 0; return; }
  if (act === 'side') { G.boxSide = a.dataset.v; render(); return; }
  if (act === 'period') { G.period = +a.dataset.v; render(); return; }
  if (act === 'scoring') { G.scoringOnly = !G.scoringOnly; render(); return; }
  if (act === 'drive') { const k = a.dataset.v; G.open.has(k) ? G.open.delete(k) : G.open.add(k); render(); return; }
  if (act === 'retry') { G.err = false; render(); loadGame(); }
}

// ---------------- render ----------------
function render() {
  const el = G.el;
  if (!el) return;
  const keepTop = el.scrollTop;
  const wraps = [...el.querySelectorAll('.tblwrap')].map((w) => w.scrollLeft);
  const chipsLeft = el.querySelector('.pchips')?.scrollLeft || 0;
  const L = LEAGUES[G.lg];
  if (!G.g) {
    el.innerHTML = `<div class="gtop">${nav(L, null)}</div>` + (G.err
      ? `<div class="empty small"><p>Couldn't load this game from ESPN.</p><button class="btn" data-act="retry">Try again</button></div>`
      : `<div class="gload"><span class="spin"></span></div>`);
    return;
  }
  const g = G.g;
  const pre = g.state === 'pre' || (g.state === 'post' && !g.completed && !(G.d.boxscore?.players || []).length);
  let html = `<div class="gtop">${nav(L, g)}${board(g, pre)}${pre ? '' : lineScore(g)}${pre ? '' : tabs()}</div>`;
  html += '<div class="gbody">';
  if (pre) html += preview(g);
  else if (G.tab === 'summary') html += summary(g);
  else if (G.tab === 'box') html += boxTab(g);
  else html += playsTab(g);
  html += `<div class="foot"><a class="btn ghost" href="${esc(espnGameUrl(G.lg, G.id))}" target="_blank" rel="noopener">Open on ESPN</a><div class="upd">${G.err ? "Couldn't refresh · " : ''}Updated ${ago(G.ts)}</div></div>`;
  html += '</div>';
  el.innerHTML = html;
  el.scrollTop = keepTop;
  el.querySelectorAll('.tblwrap').forEach((w, i) => { if (wraps[i]) w.scrollLeft = wraps[i]; });
  const pc = el.querySelector('.pchips');
  if (pc) pc.scrollLeft = chipsLeft || pc.querySelector('.on')?.offsetLeft - 40 || 0;
}

function nav(L, g) {
  const date = g ? fmtLong(new Date(g.date)) : '';
  return `<div class="gnav"><a href="#/" class="back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Back</a><span class="gmeta">${L.tag}${date ? ' · ' + esc(date) : ''}</span><span class="gnav-r"></span></div>`;
}

function board(g, pre) {
  const st = statusOf(g);
  const side = (t, raw, c) => `<div class="bteam">
    ${logo(t.logo, 48, 'blogo')}
    <div class="bname">${t.rank ? `<span class="rk">${t.rank}</span>` : ''}${esc(t.short || t.abbr)}</div>
    <div class="brec">${esc(t.record || '')}</div></div>`;
  const final = g.state === 'post';
  const lost = (t, o) => final && (t.winner || o.winner ? !t.winner : Number(t.score) < Number(o.score));
  const sc = (t, o) => pre ? '' : `<div class="bscore${lost(t, o) ? ' dim' : ''}">${esc(t.score ?? '')}</div>`;
  let mid;
  if (pre) {
    const d = new Date(g.date);
    mid = `<div class="bmid pre"><span class="bst">${st.cls === 'off' ? esc(st.text) : g.timeValid ? esc(fmtTime(d)) : 'TBD'}</span><span class="bsub">${esc(fmtLong(d))}</span>${g.tv ? `<span class="btv">${esc(g.tv)}</span>` : ''}</div>`;
  } else {
    mid = `<div class="bmid"><span class="bst ${st.cls}">${st.live ? '<i class="dot"></i>' : ''}${esc(st.text)}</span>${g.tv ? `<span class="btv">${esc(g.tv)}</span>` : ''}</div>`;
  }
  return `<div class="board${pre ? ' pre' : ''}" style="--ac:${g.ac};--hc:${g.hc}">${side(g.away, g.rawAway, g.ac)}${sc(g.away, g.home)}${mid}${sc(g.home, g.away)}${side(g.home, g.rawHome, g.hc)}</div>`;
}

// ---------------- line score ----------------
const REG = { nba: 4, nfl: 4, cfb: 4, cbb: 2, nhl: 3, mlb: 9 };
function colLabel(lg, i, seasonType) {
  const p = i + 1;
  if (lg === 'mlb') return String(p);
  if (p <= REG[lg]) return String(p);
  if (lg === 'nhl') return p === 4 ? 'OT' : seasonType === 3 ? `${p - 3}OT` : 'SO';
  const ot = p - REG[lg];
  return ot === 1 ? 'OT' : `${ot}OT`;
}
function lineScore(g) {
  const lg = g.lg;
  const la = g.rawAway.linescores || [], lh = g.rawHome.linescores || [];
  const n = Math.max(REG[lg], la.length, lh.length);
  if (!la.length && !lh.length) return '';
  const cur = g.state === 'in' ? g.period : 0;
  const cols = Array.from({ length: n }, (_, i) => i);
  const v = (arr, i) => { const x = arr[i]; return x == null ? '' : esc(x.displayValue ?? x.value ?? ''); };
  let extraH = '<th class="tot">T</th>';
  let extra = (t) => `<td class="tot">${esc(t.score ?? '')}</td>`;
  if (lg === 'mlb') {
    const he = mlbHE();
    extraH = '<th class="tot">R</th><th class="tot">H</th><th class="tot">E</th>';
    extra = (t, side) => `<td class="tot">${esc(t.score ?? '')}</td><td class="tot">${esc(he[side].h)}</td><td class="tot">${esc(he[side].e)}</td>`;
  }
  const row = (t, arr, side) => `<tr><th>${logo(t.logo, 16, 'mlo')}${esc(t.abbr)}</th>${cols.map((i) => `<td class="${i + 1 === cur ? 'cur' : ''}">${v(arr, i)}</td>`).join('')}${extra(t, side)}</tr>`;
  return `<div class="lines${lg === 'mlb' ? ' mlb' : ''}"><table>
  <thead><tr><th></th>${cols.map((i) => `<th class="${i + 1 === cur ? 'cur' : ''}">${colLabel(lg, i, g.seasonType)}</th>`).join('')}${extraH}</tr></thead>
  <tbody>${row(g.away, la, 'away')}${row(g.home, lh, 'home')}</tbody></table></div>`;
}
function mlbHE() {
  const g = G.g;
  const out = { away: { h: g.away.hits ?? g.rawAway.hits ?? '', e: g.away.errors ?? g.rawAway.errors ?? '' }, home: { h: g.home.hits ?? g.rawHome.hits ?? '', e: g.home.errors ?? g.rawHome.errors ?? '' } };
  for (const t of G.d.boxscore?.teams || []) {
    const side = t.homeAway || (String(t.team?.id) === g.home.id ? 'home' : 'away');
    const flat = flatStats(t.statistics || []);
    const h = flat.find((s) => s.name === 'hits' && (!s.group || s.group === 'batting'));
    const e = flat.find((s) => s.name === 'errors');
    if (out[side].h === '' && h) out[side].h = h.displayValue;
    if (out[side].e === '' && e) out[side].e = e.displayValue;
  }
  return out;
}

function tabs() {
  const t = (k, label) => `<button data-act="tab" data-v="${k}" class="${G.tab === k ? 'on' : ''}">${label}</button>`;
  return `<div class="tabs3">${t('summary', 'Summary')}${t('box', 'Box score')}${t('plays', LEAGUES[G.lg].sport === 'football' ? 'Drives' : 'Plays')}</div>`;
}

// ---------------- summary ----------------
function summary(g) {
  return [leadersBlock(g, 'Game leaders'), winProb(g), teamStats(g)].filter(Boolean).join('') || '<div class="empty small"><p>No summary yet.</p></div>';
}

const NBA_LEAD = [['points', 'PTS'], ['rebounds', 'REB'], ['assists', 'AST']];
function leadersBlock(g, title) {
  const L = G.d.leaders;
  if (!Array.isArray(L) || !L.length) return '';
  const byTeam = (id) => L.find((x) => String(x.team?.id) === String(id));
  const A = byTeam(g.away.id), H = byTeam(g.home.id);
  if (!A && !H) return '';
  const basketball = LEAGUES[G.lg].sport === 'basketball';
  let cats;
  if (basketball) cats = NBA_LEAD;
  else {
    const src = (A || H).leaders || [];
    cats = src.slice(0, 3).map((c) => [c.name, c.shortDisplayName || c.abbreviation || c.displayName]);
  }
  const rows = cats.map(([name, ab]) => {
    const ca = A?.leaders?.find((c) => c.name === name);
    const ch = H?.leaders?.find((c) => c.name === name);
    if (!ca?.leaders?.length && !ch?.leaders?.length) return '';
    const label = basketball ? ab : (ca || ch).displayName || ab;
    return `<div class="lead"><div class="lcat">${esc(label)}</div><div class="lpair">${leader(ca?.leaders?.[0], name, ab, 'away')}${leader(ch?.leaders?.[0], name, ab, 'home')}</div></div>`;
  }).join('');
  if (!rows) return '';
  return `<section class="card"><h3>${title}</h3>${rows}</section>`;
}
function leader(x, cat, ab, side) {
  if (!x) return '<div class="ld empty"></div>';
  const a = x.athlete || {};
  const head = a.headshot?.href;
  const line = statLine(a.id, cat) || x.summary || '';
  const basketball = LEAGUES[G.lg].sport === 'basketball';
  const big = basketball ? `${esc(x.displayValue)} <small>${esc(ab)}</small>` : esc(x.displayValue);
  return `<div class="ld ${side}">${head ? `<img class="hs" src="${esc(head)}" alt="" loading="lazy">` : '<span class="hs"></span>'}
  <div class="ldt"><span class="lnm">${esc(a.shortName || a.displayName || '')}</span><span class="lval${String(x.displayValue || '').length > 6 ? ' long' : ''}">${big}</span>${line && line !== x.displayValue ? `<span class="lline">${esc(line)}</span>` : ''}</div></div>`;
}
// short stat line from the box score, e.g. "12-21 FG · 5 REB · 3 AST"
function statLine(athId, cat) {
  if (LEAGUES[G.lg].sport !== 'basketball' || !athId) return '';
  for (const p of G.d.boxscore?.players || []) {
    const s = p.statistics?.[0];
    if (!s) continue;
    const names = s.names || s.labels || [];
    const a = (s.athletes || []).find((x) => String(x.athlete?.id) === String(athId));
    if (!a || !a.stats?.length) continue;
    const v = (n) => a.stats[names.indexOf(n)];
    const parts = [];
    if (cat === 'points') parts.push(`${v('FG')} FG`, `${v('3PT')} 3PT`);
    else if (cat === 'rebounds') parts.push(`${v('OREB')} OFF`, `${v('DREB')} DEF`);
    else parts.push(`${v('TO')} TO`, `${v('MIN')} MIN`);
    return parts.filter((x) => !/^undefined/.test(x)).join(' · ');
  }
  return '';
}

function winProb(g) {
  const wp = G.d.winprobability;
  if (!Array.isArray(wp) || wp.length < 3) return '';
  const pts = wp.map((p) => +p.homeWinPercentage).filter((x) => !isNaN(x));
  if (pts.length < 3) return '';
  const W = 340, H = 120, n = pts.length - 1;
  const xy = pts.map((p, i) => [(i / n) * W, (1 - p) * H]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${W},${H / 2}L0,${H / 2}Z`;
  const last = pts[pts.length - 1];
  const fav = last >= 0.5 ? g.home : g.away;
  const pct = Math.round((last >= 0.5 ? last : 1 - last) * 100);
  const col = last >= 0.5 ? g.hc : g.ac;
  // quarter markers from plays
  let marks = '';
  const plays = G.d.plays || [];
  if (plays.length) {
    const idx = new Map(wp.map((p, i) => [String(p.playId), i]));
    let lastP = null;
    for (const pl of plays) {
      const p = pl.period?.number;
      if (lastP != null && p !== lastP && idx.has(String(pl.id))) {
        const x = (idx.get(String(pl.id)) / n) * W;
        marks += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${H}" class="wpq"/>`;
      }
      lastP = p;
    }
  }
  return `<section class="card"><h3>Win probability</h3>
  <div class="wphead"><span>${logo(fav.logo, 18, 'mlo')}<b>${esc(fav.abbr)}</b> ${pct}%</span></div>
  <div class="wp"><div class="wpl">${logo(g.home.logo, 16, 'mlo')}<span>${logo(g.away.logo, 16, 'mlo')}</span></div>
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><clipPath id="wpTop"><rect x="0" y="0" width="${W}" height="${H / 2}"/></clipPath><clipPath id="wpBot"><rect x="0" y="${H / 2}" width="${W}" height="${H / 2}"/></clipPath></defs>
    <path d="${area}" fill="${g.hc}" opacity=".18" clip-path="url(#wpTop)"/>
    <path d="${area}" fill="${g.ac}" opacity=".18" clip-path="url(#wpBot)"/>
    ${marks}
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="wpmid"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg></div></section>`;
}

function flatStats(arr, group = '') {
  const out = [];
  for (const s of arr || []) {
    if (Array.isArray(s.stats)) out.push(...flatStats(s.stats, s.name || group));
    else out.push({ ...s, group });
  }
  return out;
}

const PREF = {
  basketball: [['fieldGoalPct', 'FG%'], ['threePointFieldGoalPct', '3PT%'], ['freeThrowPct', 'FT%'], ['totalRebounds', 'Rebounds'], ['assists', 'Assists'], ['totalTurnovers|turnovers', 'Turnovers', 1], ['steals', 'Steals'], ['blocks', 'Blocks'], ['pointsInPaint', 'Points in paint'], ['fastBreakPoints', 'Fast break pts']],
  football: [['totalYards', 'Total yards'], ['netPassingYards', 'Passing'], ['rushingYards', 'Rushing'], ['firstDowns', 'First downs'], ['thirdDownEff', '3rd down'], ['fourthDownEff', '4th down'], ['turnovers', 'Turnovers', 1], ['totalPenaltiesYards', 'Penalties'], ['sacksYardsLost', 'Sacks–yards'], ['possessionTime', 'Possession']],
  hockey: [['shotsTotal|shots', 'Shots'], ['powerPlayGoals', 'Power play goals'], ['powerPlayOpportunities', 'Power plays'], ['faceoffPercent', 'Faceoff %'], ['hits', 'Hits'], ['blockedShots', 'Blocked shots'], ['takeaways', 'Takeaways'], ['giveaways', 'Giveaways', 1], ['penaltyMinutes', 'Penalty minutes', 1]],
  baseball: [['hits', 'Hits'], ['homeRuns', 'Home runs'], ['RBIs', 'RBI'], ['walks', 'Walks'], ['strikeouts', 'Strikeouts'], ['avg', 'Batting avg'], ['LOB|leftOnBase', 'Left on base', 1], ['errors', 'Errors', 1]],
};
function teamStats(g) {
  const T = G.d.boxscore?.teams || [];
  if (T.length < 2) return '';
  const find = (side) => T.find((t) => t.homeAway === side) || T.find((t) => String(t.team?.id) === (side === 'home' ? g.home.id : g.away.id));
  const A = flatStats(find('away')?.statistics), H = flatStats(find('home')?.statistics);
  if (!A.length || !H.length) return '';
  const sport = LEAGUES[G.lg].sport;
  const rows = [];
  const used = new Set();
  for (const [names, label, lowGood] of PREF[sport] || []) {
    for (const nm of names.split('|')) {
      const a = A.find((s) => s.name === nm && (sport !== 'baseball' || !s.group || s.group === 'batting' || nm === 'errors'));
      const h = H.find((s) => s.name === nm && (sport !== 'baseball' || !s.group || s.group === 'batting' || nm === 'errors'));
      if (a && h) { rows.push({ label, a: a.displayValue, h: h.displayValue, lowGood }); used.add(nm); break; }
    }
  }
  if (rows.length < 4) {
    for (const a of A) {
      if (rows.length >= 10) break;
      if (used.has(a.name)) continue;
      const h = H.find((s) => s.name === a.name && s.group === a.group);
      if (!h || a.displayValue == null) continue;
      rows.push({ label: a.label || a.displayName || a.abbreviation || a.name, a: a.displayValue, h: h.displayValue });
      used.add(a.name);
    }
  }
  if (!rows.length) return '';
  const num = (v) => { const s = String(v ?? ''); return /^-?[\d.]+%?$/.test(s.trim()) ? parseFloat(s) : null; };
  const body = rows.map((r) => {
    const a = num(r.a), h = num(r.h);
    let bar = '';
    let ab = '', hb = '';
    if (a != null && h != null && a + h > 0) {
      const pa = (a / (a + h)) * 100;
      bar = `<div class="sbar"><i style="width:${pa.toFixed(1)}%;background:var(--ac)"></i><i style="width:${(100 - pa).toFixed(1)}%;background:var(--hc)"></i></div>`;
      if (a !== h) { const aBetter = r.lowGood ? a < h : a > h; aBetter ? (ab = ' b') : (hb = ' b'); }
    }
    return `<div class="srow"><span class="sv${ab}">${esc(r.a)}</span><span class="sl">${esc(r.label)}</span><span class="sv r${hb}">${esc(r.h)}</span>${bar}</div>`;
  }).join('');
  return `<section class="card" style="--ac:${g.ac};--hc:${g.hc}"><h3>Team stats</h3>
  <div class="shead"><span>${logo(g.away.logo, 18, 'mlo')}${esc(g.away.abbr)}</span><span>${esc(g.home.abbr)}${logo(g.home.logo, 18, 'mlo')}</span></div>${body}</section>`;
}

// ---------------- box score ----------------
function boxTab(g) {
  const P = G.d.boxscore?.players || [];
  if (!P.length) return '<div class="empty small"><p>The box score will appear once the game is underway.</p></div>';
  if (!G.boxSide) {
    const my = new Set(store.get('teams', []).map((t) => `${t.lg}:${t.id}`));
    G.boxSide = my.has(`${G.lg}:${g.home.id}`) && !my.has(`${G.lg}:${g.away.id}`) ? 'home' : 'away';
  }
  const t = G.boxSide === 'home' ? g.home : g.away;
  const team = P.find((p) => String(p.team?.id) === t.id) || P[G.boxSide === 'home' ? 1 : 0];
  const sw = `<div class="seg teams">${['away', 'home'].map((s) => { const x = g[s]; return `<button data-act="side" data-v="${s}" class="${G.boxSide === s ? 'on' : ''}">${logo(x.logo, 18, 'mlo')}${esc(x.short || x.abbr)}</button>`; }).join('')}</div>`;
  if (!team) return sw + '<div class="empty small"><p>No stats yet.</p></div>';
  const basketball = LEAGUES[G.lg].sport === 'basketball';
  const body = basketball ? hoopsTable(team.statistics?.[0]) : (team.statistics || []).map((s) => genericTable(s)).join('');
  return sw + (body || '<div class="empty small"><p>No stats yet.</p></div>');
}

const HOOPS_COLS = ['MIN', 'PTS', 'REB', 'AST', 'FG', '3PT', 'FT', 'STL', 'BLK', 'TO', 'PF', '+/-'];
function hoopsTable(s) {
  if (!s) return '';
  const names = s.names || s.labels || [];
  const cols = HOOPS_COLS.filter((c) => names.includes(c));
  const idx = cols.map((c) => names.indexOf(c));
  const athletes = s.athletes || [];
  const row = (a) => {
    const at = a.athlete || {};
    const nm = `<td class="pn"><span>${esc(at.shortName || at.displayName || '')}</span><small>${esc(at.position?.abbreviation || '')}</small></td>`;
    if (!a.stats?.length || a.didNotPlay) {
      return `<tr class="dnp">${nm}<td colspan="${cols.length}" class="why">${esc(a.reason || 'DNP')}</td></tr>`;
    }
    return `<tr>${nm}${idx.map((i, k) => `<td class="${cols[k] === 'PTS' ? 'pts' : ''}">${esc(a.stats[i] ?? '')}</td>`).join('')}</tr>`;
  };
  const starters = athletes.filter((a) => a.starter);
  const bench = athletes.filter((a) => !a.starter);
  const head = (label) => `<tr class="sec"><th class="pn">${label}</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
  const totals = s.totals?.length ? `<tr class="tot"><td class="pn"><span>Team</span></td>${idx.map((i) => `<td>${esc(s.totals[i] ?? '')}</td>`).join('')}</tr>` : '';
  return `<div class="tblwrap"><table class="box hoops">
  <tbody>${starters.length ? head('Starters') + starters.map(row).join('') : ''}${bench.length ? head(starters.length ? 'Bench' : 'Players') + bench.map(row).join('') : ''}${totals}</tbody></table></div>
  <p class="swipe">Swipe the table for more stats</p>`;
}

function genericTable(s) {
  const labels = s.labels || s.names || [];
  const athletes = s.athletes || [];
  if (!labels.length || !athletes.length) return '';
  const raw = s.text || s.displayName || s.name || s.type || '';
  const title = raw.replace(/^.*?\s(?=(Passing|Rushing|Receiving|Fumbles|Defensive|Interceptions|Kick Returns|Punt Returns|Kicking|Punting)$)/, '');
  const isBat = /bat/i.test(s.type || s.name || '');
  const row = (a) => {
    const at = a.athlete || {};
    const pos = a.position?.abbreviation || at.position?.abbreviation || '';
    const sub = isBat && a.starter === false;
    const nm = `<td class="pn${sub ? ' sub' : ''}"><span>${esc(at.shortName || at.displayName || '')}</span><small>${esc(pos)}</small></td>`;
    if (!a.stats?.length) return `<tr class="dnp">${nm}<td colspan="${labels.length}" class="why">${esc(a.reason || '—')}</td></tr>`;
    return `<tr>${nm}${a.stats.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
  };
  const totals = s.totals?.length ? `<tr class="tot"><td class="pn"><span>Team</span></td>${s.totals.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>` : '';
  return `<h4 class="tbltitle">${esc(cap(title))}</h4><div class="tblwrap"><table class="box">
  <thead><tr><th class="pn"></th>${labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
  <tbody>${athletes.map(row).join('')}${totals}</tbody></table></div>`;
}
const cap = (s) => String(s).replace(/^\w/, (c) => c.toUpperCase());

// ---------------- plays ----------------
function teamBadge(id, fallbackAbbr) {
  const g = G.g;
  let t = null, c = '#888';
  if (String(id) === g.home.id) { t = g.home; c = g.hc; } else if (String(id) === g.away.id) { t = g.away; c = g.ac; }
  const ab = t?.abbr || fallbackAbbr || '';
  if (!ab) return '<span class="tb none"></span>';
  return `<span class="tb" style="--c:${c}">${esc(ab)}</span>`;
}
function periodChips(periods, cur, extra = '') {
  return `<div class="pbar"><div class="pchips">${periods.map((p) => `<button data-act="period" data-v="${p.n}" class="${p.n === cur ? 'on' : ''}">${esc(p.label)}</button>`).join('')}</div>${extra}</div>`;
}
const scoringToggle = () => `<button class="tog${G.scoringOnly ? ' on' : ''}" data-act="scoring" role="switch" aria-checked="${G.scoringOnly}"><i></i>Scoring only</button>`;

function playsTab(g) {
  const sport = LEAGUES[G.lg].sport;
  if (sport === 'football') return drivesTab(g);
  if (sport === 'baseball') return mlbPlays(g);
  const plays = (G.d.plays || []).filter((p) => p.text);
  if (!plays.length) return '<div class="empty small"><p>Play-by-play isn\'t available for this game.</p></div>';
  const nums = [...new Set(plays.map((p) => p.period?.number).filter(Boolean))].sort((a, b) => a - b);
  if (G.period == null || !nums.includes(G.period)) G.period = g.state === 'in' && nums.includes(g.period) ? g.period : nums[nums.length - 1];
  const label = (n) => {
    if (G.lg === 'nhl') return periodName('nhl', n, g.seasonType);
    if (G.lg === 'cbb') return n <= 2 ? `${ordinal(n)} half` : periodName('cbb', n);
    return periodName(G.lg, n);
  };
  let list = plays.filter((p) => p.period?.number === G.period);
  if (G.scoringOnly) list = list.filter((p) => p.scoringPlay);
  list = list.slice().reverse();
  const rows = list.map((p) => `<div class="play${p.scoringPlay ? ' scoring' : ''}">
    <span class="pclk">${esc(p.clock?.displayValue || '')}</span>${teamBadge(p.team?.id)}
    <span class="ptx">${esc(p.text)}</span><span class="psc">${p.awayScore != null ? `${esc(p.awayScore)}-${esc(p.homeScore)}` : ''}</span></div>`).join('');
  return periodChips(nums.map((n) => ({ n, label: label(n) })), G.period, scoringToggle()) +
    `<div class="plays">${rows || '<div class="empty small"><p>No scoring plays in this period.</p></div>'}</div>`;
}

function drivesTab(g) {
  const dr = G.d.drives || {};
  let drives = [...(dr.previous || [])];
  if (dr.current && !drives.some((d) => d.id === dr.current.id)) drives.push(dr.current);
  if (!drives.length) {
    const sp = G.d.scoringPlays || [];
    if (!sp.length) return '<div class="empty small"><p>Drive chart isn\'t available for this game.</p></div>';
  }
  const pOf = (d) => d.start?.period?.number || d.plays?.[0]?.period?.number || 0;
  const nums = [...new Set(drives.map(pOf).filter(Boolean))].sort((a, b) => a - b);
  if (G.period == null || !nums.includes(G.period)) G.period = g.state === 'in' && nums.includes(g.period) ? g.period : nums[nums.length - 1];
  let list = drives.filter((d) => pOf(d) === G.period);
  if (G.scoringOnly) list = list.filter((d) => d.isScore);
  list = list.slice().reverse();
  const rows = list.map((d) => {
    const k = String(d.id);
    const isCur = !!dr.current && d.id === dr.current.id && g.state === 'in';
    const open = isCur ? !G.open.has(k) : G.open.has(k);
    const res = d.displayResult || d.result || (dr.current && d.id === dr.current.id ? 'In progress' : '');
    const desc = d.description || [d.offensivePlays != null ? `${d.offensivePlays} plays` : '', d.yards != null ? `${d.yards} yds` : '', d.timeElapsed?.displayValue || ''].filter(Boolean).join(', ');
    const plays = open ? `<div class="dplays">${(d.plays || []).map((p) => `<div class="play${p.scoringPlay ? ' scoring' : ''}"><span class="pclk">${esc(p.clock?.displayValue || '')}</span><span class="ptx">${p.start?.downDistanceText ? `<small>${esc(p.start.downDistanceText)}</small>` : ''}${esc(p.text || '')}</span><span class="psc">${p.scoringPlay && p.awayScore != null ? `${esc(p.awayScore)}-${esc(p.homeScore)}` : ''}</span></div>`).join('')}</div>` : '';
    const lastScore = [...(d.plays || [])].reverse().find((p) => p.awayScore != null);
    return `<div class="drive${d.isScore ? ' scoring' : ''}${open ? ' open' : ''}">
      <button class="dhead" data-act="drive" data-v="${esc(k)}">${teamBadge(d.team?.id, d.team?.abbreviation)}
        <span class="dtx"><b>${esc(res)}</b><small>${esc(desc)}${d.start?.clock?.displayValue ? ` · started ${esc(d.start.clock.displayValue)}` : ''}</small></span>
        <span class="psc">${d.isScore && lastScore ? `${esc(lastScore.awayScore)}-${esc(lastScore.homeScore)}` : ''}</span><i class="chev"></i></button>${plays}</div>`;
  }).join('');
  return periodChips(nums.map((n) => ({ n, label: periodName(G.lg, n) })), G.period, scoringToggle()) +
    `<div class="drives">${rows || '<div class="empty small"><p>No scoring drives in this quarter.</p></div>'}</div>`;
}

const PITCH = /^(ball|strike|foul|pitch|pickoff|start-|end-|intent-ball|batter-pitcher|substitution-defensive)/i;
function mlbPlays(g) {
  const all = (G.d.plays || []).filter((p) => p.text && !PITCH.test(p.type?.type || '') && !/pitches to|^(Ball|Strike|Foul)\b/i.test(p.text) && p.pitchType == null);
  if (!all.length) return '<div class="empty small"><p>Play-by-play isn\'t available for this game.</p></div>';
  const nums = [...new Set(all.map((p) => p.period?.number).filter(Boolean))].sort((a, b) => a - b);
  if (G.period == null || !nums.includes(G.period)) G.period = g.state === 'in' && nums.includes(g.period) ? g.period : nums[nums.length - 1];
  let list = all.filter((p) => p.period?.number === G.period);
  if (G.scoringOnly) list = list.filter((p) => p.scoringPlay);
  list = list.slice().reverse();
  let lastHalf = null, rows = '';
  for (const p of list) {
    const half = /bot/i.test(p.period?.type || p.period?.displayValue || '') ? 'Bottom' : 'Top';
    if (half !== lastHalf) { rows += `<div class="half">${half} ${ordinal(G.period)}</div>`; lastHalf = half; }
    const tid = p.team?.id || (half === 'Top' ? g.away.id : g.home.id);
    rows += `<div class="play${p.scoringPlay ? ' scoring' : ''}">${teamBadge(tid)}<span class="ptx">${esc(p.text)}</span><span class="psc">${p.awayScore != null ? `${esc(p.awayScore)}-${esc(p.homeScore)}` : ''}</span></div>`;
  }
  return periodChips(nums.map((n) => ({ n, label: ordinal(n) })), G.period, scoringToggle()) +
    `<div class="plays mlb">${rows || '<div class="empty small"><p>No scoring plays this inning.</p></div>'}</div>`;
}

// ---------------- preview ----------------
function preview(g) {
  const d = G.d;
  const parts = [];
  const date = new Date(g.date);
  const st = statusOf(g);
  const info = [
    ['When', st.cls === 'off' ? st.text : `${fmtFull(date)}${g.timeValid ? ', ' + fmtTime(date) : ''}`],
    ['TV', g.tv],
    ['Where', [g.venue, g.city].filter(Boolean).join(' · ')],
    ['Note', g.note],
  ].filter(([, v]) => v);
  parts.push(`<section class="card"><h3>Game info</h3>${info.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</section>`);

  const pred = d.predictor;
  if (pred?.homeTeam?.gameProjection && pred?.awayTeam?.gameProjection) {
    const a = parseFloat(pred.awayTeam.gameProjection), h = parseFloat(pred.homeTeam.gameProjection);
    if (!isNaN(a) && !isNaN(h)) {
      parts.push(`<section class="card" style="--ac:${g.ac};--hc:${g.hc}"><h3>Matchup predictor</h3>
      <div class="srow"><span class="sv b">${a.toFixed(1)}%</span><span class="sl">Win chance (ESPN)</span><span class="sv r b">${h.toFixed(1)}%</span>
      <div class="sbar"><i style="width:${(a / (a + h) * 100).toFixed(1)}%;background:var(--ac)"></i><i style="width:${(h / (a + h) * 100).toFixed(1)}%;background:var(--hc)"></i></div></div>
      <div class="shead"><span>${logo(g.away.logo, 18, 'mlo')}${esc(g.away.abbr)}</span><span>${esc(g.home.abbr)}${logo(g.home.logo, 18, 'mlo')}</span></div></section>`);
    }
  }

  const l5 = d.lastFiveGames;
  if (Array.isArray(l5) && l5.length) {
    const rowsFor = (t) => {
      const x = l5.find((y) => String(y.team?.id) === t.id);
      if (!x?.events?.length) return '';
      return `<div class="l5"><div class="l5t">${logo(t.logo, 20, 'mlo')}<b>${esc(t.short || t.abbr)}</b></div><div class="l5g">${x.events.slice(0, 5).map((e) => {
        const res = e.gameResult || '';
        return `<span class="l5e ${res === 'W' ? 'w' : res === 'L' ? 'l' : ''}"><b>${esc(res)}</b><small>${esc(e.atVs || '')} ${esc(e.opponent?.abbreviation || '')}</small><small>${esc(e.score || '')}</small></span>`;
      }).join('')}</div></div>`;
    };
    const body = rowsFor(g.away) + rowsFor(g.home);
    if (body) parts.push(`<section class="card"><h3>Recent results</h3>${body}</section>`);
  }

  const lead = leadersBlock(g, 'Season leaders');
  if (lead) parts.push(lead);
  return parts.join('');
}
