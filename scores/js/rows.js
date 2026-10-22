// Game row (mockup C "Stacked rows"), shared by My teams and All scores
import { LEAGUES } from './config.js';
import { statusOf } from './espn.js';
import { esc, logo, fmtDow, fmtMonDay, readableColor } from './util.js';

function teamLine(t, g, sel, showRank) {
  const final = g.state === 'post' && t.score != null;
  const other = t === g.home ? g.away : g.home;
  let lost = false;
  if (final) {
    if (t.winner || other.winner) lost = !t.winner;
    else lost = Number(t.score) < Number(other.score);
  }
  const isSel = sel.has(`${g.lg}:${t.id}`);
  return `<div class="tl">${logo(t.logo, 22)}${showRank ? `<span class="rk">${t.rank || ''}</span>` : ''}<span class="nm${isSel ? ' b' : ''}">${esc(t.short || t.abbr || 'TBD')}</span><span class="sc${lost ? ' dim' : ''}">${t.score != null && g.state !== 'pre' ? esc(t.score) : ''}</span></div>`;
}

export function gameRow(g, { sel = new Set(), dateCol = true } = {}) {
  const st = statusOf(g);
  const d = new Date(g.date);
  const college = !!LEAGUES[g.lg]?.college;
  const selTeam = sel.has(`${g.lg}:${g.away.id}`) ? g.away : sel.has(`${g.lg}:${g.home.id}`) ? g.home : null;
  const stripe = selTeam ? readableColor(selTeam.color, selTeam.alt) : '';
  const cls = ['g', `s-${g.state}`, st.live ? 'live' : '', st.cls === 'off' ? 'off' : '', dateCol ? '' : 'nodate'].filter(Boolean).join(' ');
  return `<a class="${cls}" href="#/game/${g.lg}/${g.id}" data-key="${esc(g.key)}" data-state="${g.state}" data-t="${+d}"${stripe ? ` style="--tc:${stripe}"` : ''}>
${dateCol ? `<div class="gd"><span class="dow">${esc(fmtDow(d))}</span><span class="md">${esc(fmtMonDay(d))}</span><span class="lgt">${LEAGUES[g.lg].tag}</span></div>` : ''}
<div class="gt">${teamLine(g.away, g, sel, college)}${teamLine(g.home, g, sel, college)}</div>
<div class="gs"><span class="st ${st.cls}">${st.live ? '<i class="dot"></i>' : ''}${esc(st.text)}</span>${g.tv ? `<span class="tv">${esc(g.tv)}</span>` : ''}</div>
</a>`;
}

export function selectedSet(teams) {
  return new Set(teams.map((t) => `${t.lg}:${t.id}`));
}
