// "My teams" feed: 15 days back / 15 days ahead for every selected team, one list
import { LEAGUES, WINDOW_DAYS } from './config.js';
import { api, normEvent, isActiveSoon, isLive } from './espn.js';
import { gameRow, selectedSet } from './rows.js';
import { $, esc, store, startOfDay, addDays, ymd, attachPTR, toast } from './util.js';

const S = {
  el: null, list: null,
  games: null, // array of normalized games
  loadedAt: 0, loading: null,
  userScrolled: false, centeredOnce: false,
  failed: false,
};

const teams = () => store.get('teams', []);

export function initFeed(el) {
  S.el = el;
  el.innerHTML = '<div class="list" id="feedList"></div>';
  S.list = $('#feedList', el);
  attachPTR(el, () => loadFeed({ force: true }));
  const mark = () => { S.userScrolled = true; };
  el.addEventListener('touchstart', mark, { passive: true });
  el.addEventListener('wheel', mark, { passive: true });
  const cached = store.get('feedCache', null);
  if (cached && cached.key === teamsKey() && Array.isArray(cached.games)) {
    S.games = cached.games;
    S.loadedAt = cached.ts || 0;
  }
  renderFeed();
}

const teamsKey = () => teams().map((t) => `${t.lg}:${t.id}`).sort().join(',');

export function renderFeed({ keepScroll = true } = {}) {
  const ts = teams();
  const top = S.el.scrollTop;
  if (!ts.length) {
    S.list.innerHTML = `<div class="empty">
      <h2>Pick your teams</h2>
      <p>Choose teams from the NBA, NFL, NHL, MLB and college to build your feed. All scores works right away.</p>
      <a class="btn" href="#/settings">Pick teams</a></div>`;
    return;
  }
  if (!S.games) {
    S.list.innerHTML = skeleton(8);
    return;
  }
  if (!S.games.length) {
    S.list.innerHTML = `<div class="empty"><h2>No games right now</h2><p>None of your teams play in the last or next ${WINDOW_DAYS} days.</p><a class="btn ghost" href="#/all">See all scores</a></div>`;
    return;
  }
  const sel = selectedSet(ts);
  S.list.innerHTML =
    `<div class="edge">${WINDOW_DAYS} days back</div>` +
    S.games.map((g) => gameRow(g, { sel })).join('') +
    `<div class="edge">${WINDOW_DAYS} days ahead</div>`;
  if (keepScroll) S.el.scrollTop = top;
}

function skeleton(n) {
  return '<div class="skel">' + Array.from({ length: n }, () => '<div class="g sk"><div></div><div></div></div>').join('') + '</div>';
}

// Put the live game(s) dead center; otherwise last final just above center and next game just below.
export function centerNow(smooth = false) {
  const rows = [...S.list.querySelectorAll('a.g')];
  if (!rows.length) return;
  const vh = S.el.clientHeight;
  const live = rows.filter((r) => r.classList.contains('live'));
  let mid;
  if (live.length) {
    const a = live[0], b = live[live.length - 1];
    mid = (a.offsetTop + b.offsetTop + b.offsetHeight) / 2;
  } else {
    const now = Date.now();
    const next = rows.find((r) => r.dataset.state === 'pre' || +r.dataset.t > now);
    if (next) mid = next.offsetTop - 4;
    else { const last = rows[rows.length - 1]; mid = last.offsetTop + last.offsetHeight + 4; }
  }
  S.el.scrollTo({ top: Math.max(0, mid - vh / 2), behavior: smooth ? 'smooth' : 'auto' });
  S.userScrolled = false;
}

async function teamGames(t, ws, we) {
  const first = await api.schedule(t.lg, t.id);
  const evs = [...(first.events || [])];
  const s = first.season || first.requestedSeason || {};
  const year = s.year, type = s.type;
  const ds = evs.map((e) => +new Date(e.date));
  const minD = ds.length ? Math.min(...ds) : Infinity;
  const maxD = ds.length ? Math.max(...ds) : -Infinity;
  const more = [];
  if (year && type) {
    if (minD > ws) more.push(prevType(year, type));
    if (maxD < we) more.push(nextType(year, type));
  }
  const extra = await Promise.allSettled(more.filter(Boolean).map((p) => api.schedule(t.lg, t.id, p)));
  for (const r of extra) if (r.status === 'fulfilled') evs.push(...(r.value.events || []));
  const out = new Map();
  for (const ev of evs) {
    const d = +new Date(ev.date);
    if (d < ws || d >= we) continue;
    out.set(ev.id, normEvent(ev, t.lg));
  }
  return [...out.values()];
}
function prevType(y, t) {
  return { 1: { season: y - 1, seasontype: 3 }, 2: { season: y, seasontype: 1 }, 3: { season: y, seasontype: 2 }, 4: { season: y, seasontype: 3 } }[t];
}
function nextType(y, t) {
  return { 1: { season: y, seasontype: 2 }, 2: { season: y, seasontype: 3 }, 3: { season: y + 1, seasontype: 1 }, 4: { season: y + 1, seasontype: 1 } }[t];
}

const etDate = (d) => {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const g = (k) => p.find((x) => x.type === k).value;
    return `${g('year')}${g('month')}${g('day')}`;
  } catch { return ymd(d); }
};

// Freshen live / about-to-start games from the league scoreboard (more current than team schedules).
async function overlay(map) {
  const need = new Map();
  const now = Date.now();
  for (const g of map.values()) {
    if (!isActiveSoon(g, now)) continue;
    const d = new Date(g.date);
    if (!need.has(g.lg)) need.set(g.lg, new Set());
    need.get(g.lg).add(etDate(d)).add(ymd(d));
  }
  let changed = false;
  await Promise.allSettled([...need].map(async ([lg, dates]) => {
    const L = LEAGUES[lg];
    for (const d of dates) {
      const data = await api.scoreboard(lg, { dates: d, groups: L.college ? L.allGroup : undefined });
      for (const ev of data.events || []) {
        const k = `${lg}:${ev.id}`;
        if (!map.has(k)) continue;
        const old = map.get(k);
        const fresh = normEvent(ev, lg);
        for (const side of ['home', 'away']) if (!fresh[side].logo) fresh[side].logo = old[side].logo;
        if (!fresh.tv) fresh.tv = old.tv;
        map.set(k, fresh);
        changed = true;
      }
    }
  }));
  return changed;
}

export function loadFeed({ force = false } = {}) {
  if (S.loading) return S.loading;
  S.loading = (async () => {
    const ts = teams();
    if (!ts.length) { S.games = []; renderFeed(); return; }
    const first = !S.games;
    const now = new Date();
    const ws = +addDays(startOfDay(now), -WINDOW_DAYS);
    const we = +addDays(startOfDay(now), WINDOW_DAYS + 1);
    document.body.classList.add('busy');
    try {
      const res = await Promise.allSettled(ts.map((t) => teamGames(t, ws, we)));
      const ok = res.filter((r) => r.status === 'fulfilled');
      if (!ok.length) throw new Error('all failed');
      const map = new Map();
      for (const r of ok) for (const g of r.value) map.set(g.key, g);
      await overlay(map);
      S.games = [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
      S.loadedAt = Date.now();
      S.failed = false;
      store.set('feedCache', { key: teamsKey(), ts: S.loadedAt, games: S.games });
      if (ok.length < ts.length) toast("Some teams didn't load — pull down to retry");
    } catch (e) {
      S.failed = true;
      if (!S.games) S.games = [];
      toast(S.games.length ? "Couldn't reach ESPN — showing saved scores" : "Couldn't reach ESPN — pull down to retry");
    } finally {
      document.body.classList.remove('busy');
    }
    renderFeed();
    if (first || !S.userScrolled || force) centerNow(false);
  })().finally(() => { S.loading = null; });
  return S.loading;
}

// Quick live refresh (scoreboard only) — called every ~30s while something is live.
export async function refreshFeedLive() {
  if (!S.games || S.loading) return;
  const map = new Map(S.games.map((g) => [g.key, g]));
  const changed = await overlay(map);
  if (!changed) return;
  S.games = [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  store.set('feedCache', { key: teamsKey(), ts: S.loadedAt, games: S.games });
  renderFeed();
}

export const feedHasLive = () => !!S.games && S.games.some((g) => isActiveSoon(g) || isLive(g));
export const feedAge = () => Date.now() - S.loadedAt;
export function feedTeamsChanged() {
  S.games = null;
  S.loadedAt = 0;
  renderFeed();
}
export const feedReady = () => !!S.games;
export { esc };
