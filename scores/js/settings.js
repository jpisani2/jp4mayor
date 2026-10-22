// Settings: team picker + appearance
import { LEAGUES, ORDER } from './config.js';
import { api } from './espn.js';
import { $, esc, store, logo, toast } from './util.js';

const S = { el: null, q: '', browse: 'nba', index: null, loading: null, cb: {} };
const INDEX_VER = 1;
const WEEK = 7 * 86400000;

export function initSettings(el, cb) {
  S.el = el; S.cb = cb;
  const cached = store.get('teamIndex', null);
  if (cached && cached.v === INDEX_VER && Array.isArray(cached.teams)) S.index = cached.teams;
  el.addEventListener('click', onClick);
  el.addEventListener('input', (e) => {
    if (e.target.id === 'teamSearch') { S.q = e.target.value; renderResults(); }
  });
}

export function openSettings() {
  render();
  const cached = store.get('teamIndex', null);
  if (!S.index || !cached || Date.now() - cached.ts > WEEK) loadIndex();
}

async function loadIndex() {
  if (S.loading) return S.loading;
  S.loading = (async () => {
    const res = await Promise.allSettled(ORDER.map(async (lg) => {
      const L = LEAGUES[lg];
      let data = await api.teams(lg, L.college ? L.allGroup : undefined);
      let list = data.sports?.[0]?.leagues?.[0]?.teams || [];
      if (!list.length && L.college) { data = await api.teams(lg); list = data.sports?.[0]?.leagues?.[0]?.teams || []; }
      return list.map((x) => slim(x.team || x, lg));
    }));
    const teams = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    if (teams.length) {
      // keep old entries for any league that failed this time
      const okLgs = new Set(ORDER.filter((_, i) => res[i].status === 'fulfilled'));
      const keep = (S.index || []).filter((t) => !okLgs.has(t.lg));
      S.index = [...teams, ...keep];
      store.set('teamIndex', { v: INDEX_VER, ts: Date.now(), teams: S.index });
    } else if (!S.index) {
      toast("Couldn't load the team list — check your connection");
    }
    renderResults();
  })().finally(() => { S.loading = null; });
  return S.loading;
}

function slim(t, lg) {
  const logos = t.logos || [];
  const lo = logos.find((l) => (l.rel || []).includes('default') && !(l.rel || []).includes('dark')) || logos[0] || {};
  return {
    lg, id: String(t.id), abbr: t.abbreviation || '', name: t.displayName || '', short: t.shortDisplayName || t.name || '',
    loc: t.location || '', nick: t.nickname || t.name || '', color: t.color || '', alt: t.alternateColor || '', logo: lo.href || t.logo || '',
  };
}

const myTeams = () => store.get('teams', []);
const isMine = (t) => myTeams().some((m) => m.lg === t.lg && m.id === t.id);

function toggle(lg, id) {
  let mine = myTeams();
  const i = mine.findIndex((m) => m.lg === lg && m.id === id);
  if (i >= 0) mine.splice(i, 1);
  else {
    const t = (S.index || []).find((x) => x.lg === lg && x.id === id);
    if (!t) return;
    mine.push(t);
  }
  store.set('teams', mine);
  renderMine();
  renderResults();
  S.cb.onTeamsChanged?.();
}

function onClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'done') { e.preventDefault(); window.dispatchEvent(new CustomEvent('scores:back')); }
  else if (act === 'toggle') toggle(a.dataset.lg, a.dataset.id);
  else if (act === 'browse') { S.browse = a.dataset.lg; renderResults(); renderBrowseChips(); }
  else if (act === 'theme') { store.set('theme', a.dataset.v); S.cb.onTheme?.(a.dataset.v); renderTheme(); }
  else if (act === 'clear') { S.q = ''; $('#teamSearch', S.el).value = ''; renderResults(); }
}

function render() {
  S.el.innerHTML = `
  <div class="snav"><span></span><h2>Settings</h2><a class="done" href="#/" data-act="done">Done</a></div>
  <div class="sbody">
    <h3 class="slabel">My teams</h3>
    <div class="sgroup" id="myTeams"></div>
    <h3 class="slabel">Add teams</h3>
    <div class="searchbox"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input id="teamSearch" type="search" placeholder="Search teams in all six leagues" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(S.q)}">
      <button class="clr" data-act="clear" aria-label="Clear">×</button></div>
    <div class="chips browse" id="browseChips"></div>
    <div class="sgroup" id="results"></div>
    <h3 class="slabel">Appearance</h3>
    <div class="seg theme" id="themeSeg"></div>
    <div class="about">
      <p>Team picks are saved on this phone. If you add Scores to your Home Screen, pick teams from the Home Screen app — it keeps its own saved settings, separate from Safari.</p>
      <p>Scores, schedules and stats come from ESPN, loaded fresh each time you open the app.</p>
    </div>
  </div>`;
  renderMine(); renderBrowseChips(); renderResults(); renderTheme();
}

function teamRow(t, mode) {
  const on = isMine(t);
  return `<button class="trow" data-act="toggle" data-lg="${t.lg}" data-id="${esc(t.id)}">
    ${logo(t.logo, 26)}<span class="tn"><b>${esc(t.name)}</b><small>${LEAGUES[t.lg].tag}</small></span>
    <span class="tact ${mode === 'mine' ? 'rm' : on ? 'on' : 'add'}" aria-label="${on ? 'Remove' : 'Add'}"></span></button>`;
}

function renderMine() {
  const box = $('#myTeams', S.el);
  if (!box) return;
  const mine = myTeams();
  box.innerHTML = mine.length ? mine.map((t) => teamRow(t, 'mine')).join('') : '<p class="snote">No teams yet. Search or browse below and tap a team to add it.</p>';
}

function renderBrowseChips() {
  const box = $('#browseChips', S.el);
  if (!box) return;
  box.hidden = !!S.q.trim();
  box.innerHTML = ORDER.map((lg) => `<button class="chip${S.browse === lg ? ' on' : ''}" data-act="browse" data-lg="${lg}">${LEAGUES[lg].tag}</button>`).join('');
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9& ]/g, ' ');

function renderResults() {
  const box = $('#results', S.el);
  if (!box) return;
  renderBrowseChips();
  const clr = $('.clr', S.el);
  if (clr) clr.hidden = !S.q;
  if (!S.index) {
    box.innerHTML = '<p class="snote"><span class="spin sm"></span> Loading teams…</p>';
    return;
  }
  const q = norm(S.q).trim();
  let list;
  if (!q) {
    list = S.index.filter((t) => t.lg === S.browse).sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const toks = q.split(/\s+/);
    const scored = [];
    for (const t of S.index) {
      const hay = norm(`${t.name} ${t.loc} ${t.nick} ${t.short} ${t.abbr} ${LEAGUES[t.lg].tag}`);
      if (!toks.every((k) => hay.includes(k))) continue;
      let sc = 0;
      const n = norm(t.name), sh = norm(t.short), ab = norm(t.abbr), nk = norm(t.nick);
      if (ab === q) sc += 5;
      if (nk === q || sh === q) sc += 4;
      if (n.startsWith(q) || sh.startsWith(q) || nk.startsWith(q)) sc += 3;
      if (hay.split(' ').some((w) => w.startsWith(toks[0]))) sc += 1;
      if (!LEAGUES[t.lg].college) sc += 0.5;
      scored.push([sc, t]);
    }
    list = scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).slice(0, 60).map((x) => x[1]);
  }
  box.innerHTML = list.length ? list.map((t) => teamRow(t, 'result')).join('') : `<p class="snote">No teams match “${esc(S.q)}”.</p>`;
}

function renderTheme() {
  const box = $('#themeSeg', S.el);
  if (!box) return;
  const cur = store.get('theme', 'auto');
  box.innerHTML = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-act="theme" data-v="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('');
}

export function refreshSettingsLogos() { if (S.el && !S.el.hidden) { renderMine(); renderResults(); } }
