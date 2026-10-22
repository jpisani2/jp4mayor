// "All scores": one league, one day at a time
import { LEAGUES, ORDER } from './config.js';
import { api, normEvent, isLive, isActiveSoon } from './espn.js';
import { gameRow, selectedSet } from './rows.js';
import { $, $$, esc, store, ymd, parseYmd, addDays, fmtLong, relDay, attachPTR, toast } from './util.js';

const S = {
  el: null, head: null, list: null,
  lg: null, date: ymd(new Date()), filter: 'top25',
  games: null, busy: false, stepping: false, err: false,
};
const cache = new Map();
const calendars = {};

export function inSeason(lg, d = new Date()) {
  const [[sm, sd], [em, ed]] = LEAGUES[lg].season;
  const x = (d.getMonth() + 1) * 100 + d.getDate();
  const a = sm * 100 + sd, b = em * 100 + ed;
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}
export function leagueOrder() {
  const now = new Date();
  return [...ORDER.filter((l) => inSeason(l, now)), ...ORDER.filter((l) => !inSeason(l, now))];
}

export function initAll(el) {
  S.el = el;
  S.lg = store.get('lastLeague', null);
  if (!LEAGUES[S.lg]) S.lg = leagueOrder()[0];
  el.innerHTML = '<div class="allhead" id="allHead"></div><div class="list" id="allList"></div>';
  S.head = $('#allHead', el);
  S.list = $('#allList', el);
  attachPTR(el, () => loadAll({ force: true }));
  S.head.addEventListener('click', onHeadClick);
  renderHead();
}

function onHeadClick(e) {
  const chip = e.target.closest('[data-lg]');
  if (chip) {
    if (chip.dataset.lg === S.lg) return;
    S.lg = chip.dataset.lg;
    store.set('lastLeague', S.lg);
    S.games = null;
    renderHead(); renderList();
    chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    loadAll();
    return;
  }
  const f = e.target.closest('[data-filter]');
  if (f) {
    if (f.dataset.filter === S.filter) return;
    S.filter = f.dataset.filter;
    S.games = null;
    renderHead(); renderList(); loadAll();
    return;
  }
  const arr = e.target.closest('[data-step]');
  if (arr && !S.stepping) step(+arr.dataset.step);
}

export function goToday() {
  S.date = ymd(new Date());
  S.games = null;
  renderHead(); renderList();
  loadAll();
  S.el.scrollTo({ top: 0 });
}

function groupsFor(lg, filter) {
  const L = LEAGUES[lg];
  if (!L.college) return undefined;
  return filter === 'b10' ? L.b10Group : L.allGroup;
}
function applyFilter(games, lg, filter) {
  if (!LEAGUES[lg].college || filter !== 'top25') return games;
  return games.filter((g) => g.home.rank || g.away.rank);
}

async function fetchDay(lg, ds, filter, force = false) {
  const groups = groupsFor(lg, filter);
  const k = `${lg}|${ds}|${groups || ''}`;
  const c = cache.get(k);
  const today = ymd(new Date());
  const ttl = ds === today ? (c && c.games.some((g) => isLive(g) || isActiveSoon(g)) ? 25000 : 90000) : ds < today ? 600000 : 300000;
  if (c && !force && Date.now() - c.ts < ttl) return c;
  const data = await api.scoreboard(lg, { dates: ds, groups });
  const info = data.leagues?.[0] || {};
  if (info.calendarType === 'day' && Array.isArray(info.calendar) && typeof info.calendar[0] === 'string' && info.calendarIsWhitelist !== false) {
    const set = calendars[lg] || new Set();
    for (const s of info.calendar) set.add(s.slice(0, 10).replace(/-/g, ''));
    calendars[lg] = set;
  }
  const entry = { ts: Date.now(), games: (data.events || []).map((e) => normEvent(e, lg)) };
  cache.set(k, entry);
  return entry;
}

export async function loadAll({ force = false, quiet = false } = {}) {
  const lg = S.lg, ds = S.date, filter = S.filter;
  if (!quiet) document.body.classList.add('busy');
  try {
    const entry = await fetchDay(lg, ds, filter, force);
    if (lg !== S.lg || ds !== S.date || filter !== S.filter) return;
    S.games = applyFilter(entry.games, lg, filter).sort((a, b) => new Date(a.date) - new Date(b.date));
    S.err = false;
  } catch {
    if (lg !== S.lg || ds !== S.date) return;
    S.err = true;
    if (!S.games) S.games = [];
    if (!quiet) toast("Couldn't reach ESPN — pull down to retry");
  } finally {
    if (!quiet) document.body.classList.remove('busy');
  }
  renderHead();
  renderList();
}

async function step(dir) {
  S.stepping = true;
  S.head.querySelector('.daybar')?.classList.add('stepping');
  const lg = S.lg, filter = S.filter;
  const cur = S.date;
  let cands;
  const cal = calendars[lg];
  if (cal && cal.size) {
    const sorted = [...cal].sort();
    cands = dir > 0 ? sorted.filter((d) => d > cur).slice(0, 8) : sorted.filter((d) => d < cur).reverse().slice(0, 8);
  }
  if (!cands || !cands.length) cands = Array.from({ length: 14 }, (_, i) => ymd(addDays(parseYmd(cur), dir * (i + 1))));
  let found = null;
  for (const d of cands) {
    try {
      const e = await fetchDay(lg, d, filter);
      if (applyFilter(e.games, lg, filter).length) { found = d; break; }
    } catch { break; }
    if (lg !== S.lg) break;
  }
  S.stepping = false;
  if (lg !== S.lg) return;
  if (found) {
    S.date = found;
    S.games = null;
    await loadAll({ quiet: true });
    S.el.scrollTo({ top: 0 });
  } else {
    S.head.querySelector('.daybar')?.classList.remove('stepping');
    toast(dir > 0 ? 'No more games coming up soon' : 'No earlier games found nearby');
  }
}

function renderHead() {
  const order = leagueOrder();
  const games = S.games || [];
  const live = games.filter(isLive).length;
  const d = parseYmd(S.date);
  const rd = relDay(d);
  const label = rd === fmtLong(d) ? rd : `${rd} · ${fmtLong(d)}`;
  const count = S.games == null ? '&nbsp;' : `${games.length} game${games.length === 1 ? '' : 's'}${live ? ` · <span class="lv">${live} live</span>` : ''}`;
  const L = LEAGUES[S.lg];
  S.head.innerHTML = `
  <div class="chips" role="tablist">${order.map((l) => `<button class="chip${l === S.lg ? ' on' : ''}${inSeason(l) ? '' : ' out'}" data-lg="${l}" role="tab">${LEAGUES[l].tag}</button>`).join('')}</div>
  <div class="daybar${S.stepping ? ' stepping' : ''}">
    <button class="arr" data-step="-1" aria-label="Previous day with games"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="day"><b>${esc(label)}</b><span>${count}</span></div>
    <button class="arr" data-step="1" aria-label="Next day with games"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
  </div>
  ${L.college ? `<div class="seg" role="tablist">${[['top25', 'Top 25'], ['b10', 'Big Ten'], ['all', 'All']].map(([k, t]) => `<button data-filter="${k}" class="${S.filter === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}`;
}

function renderList() {
  const L = LEAGUES[S.lg];
  if (S.games == null) {
    S.list.innerHTML = '<div class="skel">' + Array.from({ length: 6 }, () => '<div class="g sk nodate"><div></div><div></div></div>').join('') + '</div>';
    return;
  }
  if (!S.games.length) {
    const what = L.college ? ({ top25: 'Top 25 ', b10: 'Big Ten ', all: '' })[S.filter] : '';
    S.list.innerHTML = `<div class="empty small"><p>${S.err ? "Couldn't load games." : `No ${what}${L.tag} games on ${esc(fmtLong(parseYmd(S.date)))}.`}</p>${!inSeason(S.lg) && !S.err ? `<p class="muted">The ${esc(L.name)} is out of season — use the arrows to find games.</p>` : ''}</div>`;
    return;
  }
  const sel = selectedSet(store.get('teams', []));
  S.list.innerHTML = S.games.map((g) => gameRow(g, { sel, dateCol: false })).join('');
}

export const allHasLive = () => !!S.games && S.games.some((g) => isLive(g) || isActiveSoon(g));
export function rerenderAll() { if (S.el) { renderHead(); renderList(); } }
export const allLoaded = () => S.games != null;
export { $$ };
