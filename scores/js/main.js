// Scores — app shell: header, routing, theme, refresh timers
import { LIVE_REFRESH_MS } from './config.js';
import { $, $$, store } from './util.js';
import { initFeed, loadFeed, refreshFeedLive, renderFeed, centerNow, feedHasLive, feedAge, feedTeamsChanged, feedReady } from './feed.js';
import { initAll, loadAll, goToday, allHasLive, rerenderAll, allLoaded } from './allscores.js';
import { initGame, openGame, loadGame, gameIsLive, tickUpdated, rerenderGame } from './game.js';
import { initSettings, openSettings, refreshSettingsLogos } from './settings.js';

const R = { base: 'feed', overlay: null, depth: 0, teamsDirty: false };

// ---------- theme ----------
function applyTheme(t = store.get('theme', 'auto')) {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const bg = dark ? '#151412' : '#F6F5F2';
  $$('meta[name="theme-color"]').forEach((m) => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color'; m.content = bg;
  document.head.appendChild(m);
}
function themeChanged() {
  applyTheme();
  renderFeed(); rerenderAll(); rerenderGame(); refreshSettingsLogos();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (store.get('theme', 'auto') === 'auto') themeChanged(); });

// ---------- routing ----------
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const p = h.split('/').filter(Boolean);
  if (p[0] === 'all') return { base: 'all' };
  if (p[0] === 'game' && p[1] && p[2]) return { overlay: 'game', lg: p[1], id: p[2] };
  if (p[0] === 'settings') return { overlay: 'settings' };
  return { base: 'feed' };
}

function route() {
  const r = parseHash();
  const wasOverlay = R.overlay;
  if (r.overlay) {
    R.overlay = r.overlay;
    R.depth++;
    showOverlay(r);
  } else {
    R.overlay = null;
    R.depth = 0;
    hideOverlays();
    const prevBase = R.base;
    R.base = r.base;
    showBase(prevBase !== R.base);
    if (wasOverlay === 'settings' && R.teamsDirty) {
      R.teamsDirty = false;
      loadFeed({ force: true });
      rerenderAll();
    }
  }
}

function showBase(changed) {
  const feed = R.base === 'feed';
  $('#feedView').hidden = !feed;
  $('#allView').hidden = feed;
  $$('#top .tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === R.base));
  $('#nowBtn').textContent = feed ? 'Now' : 'Today';
  document.body.dataset.view = R.base;
  if (!feed && !allLoaded()) loadAll();
}

function showOverlay(r) {
  document.body.classList.add('overlay');
  if (r.overlay === 'game') {
    $('#settingsView').hidden = true;
    const gv = $('#gameView');
    gv.hidden = false;
    openGame(r.lg, r.id);
  } else {
    $('#gameView').hidden = true;
    $('#settingsView').hidden = false;
    openSettings();
  }
}
function hideOverlays() {
  document.body.classList.remove('overlay');
  $('#gameView').hidden = true;
  $('#settingsView').hidden = true;
}

window.addEventListener('scores:back', () => {
  if (R.depth > 0 && history.length > 1 && R.cameFromApp) history.back();
  else location.replace(R.base === 'all' ? '#/all' : '#/');
});
// remember that overlays were opened from inside the app (so Back can use history)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/game"], a[href="#/settings"]');
  if (a) R.cameFromApp = true;
});

// ---------- header ----------
$('#nowBtn').addEventListener('click', () => {
  if (R.base === 'feed') centerNow(true); else goToday();
});

// ---------- refresh loop ----------
setInterval(() => {
  if (document.hidden) return;
  if (R.overlay === 'game') { if (gameIsLive()) loadGame({ quiet: true }); return; }
  if (R.overlay) return;
  if (R.base === 'feed' && feedHasLive()) refreshFeedLive();
  if (R.base === 'all' && allHasLive()) loadAll({ quiet: true });
}, LIVE_REFRESH_MS);
setInterval(() => { if (!document.hidden) tickUpdated(); }, 10000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (feedAge() > 5 * 60000 || feedHasLive()) loadFeed();
  if (R.base === 'all' && !R.overlay) loadAll({ quiet: true });
  if (R.overlay === 'game') loadGame({ quiet: true });
});

// ---------- boot ----------
applyTheme();
initFeed($('#feedView'));
initAll($('#allView'));
initGame($('#gameView'));
initSettings($('#settingsView'), {
  onTeamsChanged() { R.teamsDirty = true; feedTeamsChanged(); },
  onTheme: () => themeChanged(),
});
window.addEventListener('hashchange', route);
route();
if (store.get('teams', []).length) loadFeed();
requestAnimationFrame(() => { if (feedReady()) centerNow(false); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { });
}
