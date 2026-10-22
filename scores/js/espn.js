// ESPN feed access + normalization into one simple game shape
import { BASE, STANDINGS_BASE, RELAY, LEAGUES } from './config.js';
import { fmtTime } from './util.js';

export async function getJSON(url, timeout = 15000) {
  const full = RELAY ? RELAY + (RELAY.includes('?') ? '' : '?url=') + encodeURIComponent(url) : url;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(full, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const api = {
  scoreboard(lg, { dates, groups, limit = 500 } = {}) {
    const L = LEAGUES[lg];
    return getJSON(`${BASE}/${L.path}/scoreboard?${qs({ dates, groups, limit })}`);
  },
  schedule(lg, teamId, { season, seasontype } = {}) {
    const L = LEAGUES[lg];
    return getJSON(`${BASE}/${L.path}/teams/${teamId}/schedule?${qs({ season, seasontype })}`);
  },
  summary(lg, id) {
    const L = LEAGUES[lg];
    return getJSON(`${BASE}/${L.path}/summary?event=${id}`);
  },
  // (ESPN's /teams feed doesn't allow browser requests, so team lists use these two)
  groups(lg, groups) {
    const L = LEAGUES[lg];
    return getJSON(`${BASE}/${L.path}/groups?${qs({ groups })}`);
  },
  standings(lg, group) {
    const L = LEAGUES[lg];
    return getJSON(`${STANDINGS_BASE}/${L.path}/standings?${qs({ group })}`, 30000);
  },
};

export const espnGameUrl = (lg, id) => `https://www.espn.com/${LEAGUES[lg].site}/game/_/gameId/${id}`;

// ---------- normalization ----------
function pickRecord(c) {
  if (Array.isArray(c.records) && c.records.length) {
    const r = c.records.find((r) => r.type === 'total' || r.name === 'overall' || r.name === 'All Splits') || c.records[0];
    return r.summary || r.displayValue || '';
  }
  if (Array.isArray(c.record) && c.record.length) {
    const r = c.record.find((r) => r.type === 'total') || c.record[0];
    return r.displayValue || r.summary || '';
  }
  if (typeof c.record === 'string') return c.record;
  return '';
}

export function normTeam(c = {}) {
  const t = c.team || {};
  const logos = t.logos || [];
  const logo = t.logo || (logos.find((l) => !(l.rel || []).includes('dark')) || logos[0] || {}).href || '';
  let score = c.score;
  if (score && typeof score === 'object') score = score.displayValue ?? score.value;
  if (score === '' || score === undefined) score = null;
  const rank = c.curatedRank?.current ?? c.rank;
  return {
    id: String(t.id ?? c.id ?? ''),
    abbr: t.abbreviation || '',
    name: t.displayName || t.name || '',
    short: t.shortDisplayName || t.name || t.abbreviation || '',
    loc: t.location || '',
    color: t.color || '',
    alt: t.alternateColor || '',
    logo,
    score: score == null ? null : String(score),
    winner: c.winner === true,
    rank: rank && rank <= 25 ? rank : null,
    record: pickRecord(c),
    homeAway: c.homeAway,
    hits: c.hits, errors: c.errors,
  };
}

function pickTV(comp = {}, ev = {}) {
  const items = [];
  for (const g of comp.geoBroadcasts || []) {
    const tv = !g.type || /tv/i.test(g.type.shortName || 'TV');
    items.push({ nat: /national/i.test(g.market?.type || ''), name: g.media?.shortName, tv });
  }
  for (const b of comp.broadcasts || ev.broadcasts || []) {
    if (Array.isArray(b.names)) for (const n of b.names) items.push({ nat: /national/i.test(b.market || ''), name: n, tv: true });
    else if (b.media) {
      const mk = typeof b.market === 'string' ? b.market : b.market?.type || '';
      items.push({ nat: /national/i.test(mk), name: b.media.shortName, tv: !b.type || /tv/i.test(b.type.shortName || 'TV') });
    }
  }
  const named = items.filter((i) => i.name && i.tv);
  const nat = named.filter((i) => i.nat);
  const list = [...new Set((nat.length ? nat : named).map((i) => i.name))];
  return list.slice(0, 2).join(', ');
}

export function normEvent(ev, lg) {
  const comp = ev.competitions?.[0] || {};
  const st = comp.status || ev.status || {};
  const type = st.type || {};
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === 'home') || cs[0];
  const away = cs.find((c) => c.homeAway === 'away') || cs[1];
  return {
    key: `${lg}:${ev.id}`,
    id: String(ev.id),
    lg,
    date: ev.date || comp.date,
    timeValid: comp.timeValid !== false && ev.timeValid !== false,
    state: type.state || 'pre',
    statusName: type.name || '',
    completed: !!type.completed,
    detail: type.detail || '',
    shortDetail: type.shortDetail || '',
    clock: st.displayClock || '',
    period: st.period || 0,
    seasonType: ev.seasonType?.type ?? ev.season?.type ?? null,
    home: normTeam(home),
    away: normTeam(away),
    tv: pickTV(comp, ev),
    note: comp.notes?.[0]?.headline || '',
    venue: comp.venue?.fullName || '',
  };
}

// ---------- status text ----------
export function periodName(lg, p, seasonType) {
  if (!p) return '';
  if (lg === 'cbb') return p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? 'OT' : `${p - 2}OT`;
  if (lg === 'nhl') {
    if (p <= 3) return ['1st', '2nd', '3rd'][p - 1];
    if (p === 4) return 'OT';
    return seasonType === 3 ? `${p - 3}OT` : 'SO';
  }
  if (lg === 'mlb') return ordinal(p);
  if (p <= 4) return `Q${p}`;
  return p === 5 ? 'OT' : `${p - 4}OT`;
}
export const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

export function statusOf(g) {
  const n = g.statusName || '';
  if (/POSTPONED/.test(n)) return { text: 'PPD', cls: 'off' };
  if (/CANCEL/.test(n)) return { text: 'Canceled', cls: 'off' };
  if (/SUSPENDED/.test(n)) return { text: 'Suspended', cls: 'off' };
  if (/FORFEIT/.test(n)) return { text: 'Forfeit', cls: 'final' };
  if (/DELAY/.test(n)) return { text: 'Delayed', cls: 'off', live: g.state === 'in' };
  if (g.state === 'post') {
    const s = g.shortDetail || '';
    return { text: /^final/i.test(s) ? s.replace(/^final/i, 'Final') : 'Final', cls: 'final' };
  }
  if (g.state === 'in') return { text: liveText(g), cls: 'live', live: true };
  return { text: g.timeValid ? fmtTime(new Date(g.date)) : 'TBD', cls: 'pre' };
}

function liveText(g) {
  const n = g.statusName || '';
  const sd = g.shortDetail || '';
  if (g.lg === 'mlb') return sd.replace(/\s+/g, ' ') || 'Live';
  if (/HALFTIME/.test(n)) return 'Half';
  const pn = periodName(g.lg, g.period, g.seasonType);
  if (/END_PERIOD|END_OF_PERIOD/.test(n) || /^end/i.test(sd)) return pn ? `End ${pn}` : sd;
  if (/SHOOTOUT/.test(n)) return 'SO';
  if (g.clock && pn && g.clock !== '0:00') return `${pn} ${g.clock}`;
  if (pn && g.clock === '0:00') return `End ${pn}`;
  return sd || 'Live';
}

export const isLive = (g) => g.state === 'in';

// Rough “does this game still need watching” — live, or due to start soon.
export function isActiveSoon(g, now = Date.now()) {
  if (g.state === 'in') return true;
  if (g.state === 'pre') {
    const t = +new Date(g.date);
    return t - now < 15 * 60000 && now - t < 6 * 3600000;
  }
  return false;
}
