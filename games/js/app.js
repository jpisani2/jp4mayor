/* Brainwave — app: router, home, stats, settings, boot */
(() => {
  'use strict';
  const { h, svg, fmtTime, fmtDuration, dateKey, addDays, keyToDate } = BW.util;
  const { icon, pict, button, iconButton, sheet, confirm, toast, stars, toggle, segmented } = BW.ui;

  const appEl = document.getElementById('app');
  const tabbar = document.getElementById('tabbar');
  let current = null;

  const WAVE = '<svg viewBox="0 0 64 20" class="wave" aria-hidden="true"><path d="M2 10c5 0 5-7 10-7s5 14 10 14 5-14 10-14 5 14 10 14 5-14 10-14 5 7 10 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* =========================== HOME =========================== */
  function greeting() {
    const hr = new Date().getHours();
    if (hr < 5) return 'Still up?';
    if (hr < 12) return 'Good morning.';
    if (hr < 17) return 'Good afternoon.';
    return 'Good evening.';
  }

  function streakChip() {
    const s = BW.activity.streak();
    if (!s.current) return null;
    return h('div', { class: 'streak' + (s.doneToday ? ' done' : ''), title: s.doneToday ? 'Streak extended today' : 'Solve a puzzle today to keep your streak' },
      icon('sun'), h('span', { class: 'streak-n' }, String(s.current)), h('span', { class: 'streak-l' }, s.current === 1 ? 'day' : 'days'));
  }

  function tile(g) {
    const sum = BW.stats.summary(g.id);
    const prog = !g.soon && BW.peekSession(g.id);
    let meta;
    if (g.soon) meta = h('span', { class: 't-meta soon' }, 'Coming soon');
    else if (prog) meta = h('span', { class: 't-meta' }, h('span', { class: 'dot' }), 'In progress');
    else if (BW.games[g.id] && BW.games[g.id].levels) {
      const st = BW.stats.get(g.id);
      const done = BW.games[g.id].difficulties.filter((d) => st.d[d.id] && st.d[d.id].won).length;
      meta = h('span', { class: 't-meta' }, icon('star'), `${done} of ${BW.games[g.id].difficulties.length} levels`);
    }
    else if (sum.won) meta = h('span', { class: 't-meta' }, icon('star'), `${sum.won} solved`);
    else meta = h('span', { class: 't-meta' }, 'New');
    const el = h(g.soon ? 'div' : 'button', {
      class: 'tile cap' + (g.soon ? ' soon' : ''),
      type: g.soon ? null : 'button',
      style: { '--c': g.color, '--cd': g.deep },
      'aria-label': g.soon ? `${g.name}, coming soon` : `${g.name}. ${g.blurb}`,
    },
      h('span', { class: 't-pict' }, pict(g.id)),
      h('span', { class: 't-name' }, g.name),
      h('span', { class: 't-blurb' }, g.blurb),
      meta
    );
    if (!g.soon) el.addEventListener('click', () => { BW.sound('tap'); BW.haptic('light'); location.hash = '#/play/' + g.id; });
    return el;
  }

  function continueCard() {
    const last = BW.store.get('last', null);
    if (!last || !BW.games[last.id]) return null;
    const p = BW.peekSession(last.id);
    if (!p) return null;
    const g = BW.games[last.id];
    const d = g.difficulties.find((x) => x.id === p.diff);
    const el = h('button', { class: 'resume cap', type: 'button', style: { '--c': g.color, '--cd': g.deep } },
      h('span', { class: 'resume-pict' }, pict(g.id)),
      h('span', { class: 'resume-text' },
        h('span', { class: 'resume-title' }, `Continue ${g.name}`),
        h('span', { class: 'resume-sub' }, `${d ? d.label : ''} · ${fmtTime(p.elapsed)} · ${p.moves} ${(g.movesLabel || 'moves').toLowerCase()}`)
      ),
      icon('chevRight', 'resume-go')
    );
    el.addEventListener('click', () => { BW.sound('tap'); location.hash = '#/play/' + g.id; });
    return el;
  }

  function installTip() {
    if (window.BW_PREVIEW || !BW.isIOS || BW.isStandalone() || BW.store.get('tipDismissed', false)) return null;
    const el = h('div', { class: 'tip' },
      h('div', { class: 'tip-text' },
        h('strong', null, 'Put Brainwave on your Home Screen'),
        h('span', null, 'In Safari, tap ', h('span', { class: 'tip-ico' }, icon('share')), ' Share, then Add to Home Screen. It opens full screen and works offline.')
      ),
      iconButton('close', 'Dismiss tip', () => { BW.store.set('tipDismissed', true); el.remove(); }, 'tip-x')
    );
    return el;
  }

  function HomeView() {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const cats = [
      { id: 'logic', name: 'Logic' },
      { id: 'numbers', name: 'Numbers' },
    ];
    const scroll = h('div', { class: 'scroll home' },
      h('header', { class: 'home-head' },
        h('div', { class: 'wordmark', 'aria-label': 'Brainwave' }, h('span', null, 'brainwave'), svg(WAVE)),
        streakChip()
      ),
      h('div', { class: 'greet' }, h('h2', null, greeting()), h('p', null, dateStr)),
      installTip(),
      continueCard(),
      cats.map((c) => {
        const games = BW.catalog.filter((g) => g.cat === c.id);
        return h('section', { class: 'cat' },
          h('h3', { class: 'cat-title' }, c.name),
          h('div', { class: 'tiles' }, games.map(tile))
        );
      })
    );
    return { el: h('div', { class: 'view home-view' }, scroll), tab: 'home' };
  }

  /* =========================== STATS =========================== */
  function activityGrid() {
    const a = BW.activity.get();
    const today = dateKey();
    // 5 full weeks ending this week (weeks start Monday)
    const t = keyToDate(today);
    const dow = (t.getDay() + 6) % 7; // Mon=0
    const end = addDays(today, 6 - dow);
    const start = addDays(end, -34);
    const cells = [];
    for (let i = 0; i < 35; i++) {
      const k = addDays(start, i);
      const s = (a.days[k] && a.days[k].s) || 0;
      const lvl = s === 0 ? 0 : s < 3 ? 1 : s < 6 ? 2 : 3;
      const future = k > today;
      const d = keyToDate(k);
      cells.push(h('span', {
        class: `act-cell l${lvl}` + (k === today ? ' today' : '') + (future ? ' future' : ''),
        title: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${s} solved`,
        'aria-label': future ? '' : `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${s} solved`,
      }));
    }
    return h('div', { class: 'act' },
      h('div', { class: 'act-days', 'aria-hidden': 'true' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => h('span', null, x))),
      h('div', { class: 'act-grid' }, cells),
      h('div', { class: 'act-legend' }, h('span', null, 'Fewer'), [0, 1, 2, 3].map((l) => h('span', { class: `act-cell l${l}` })), h('span', null, 'More'))
    );
  }

  function gameStats(g) {
    const s = BW.stats.get(g.id);
    const sum = BW.stats.summary(g.id);
    const rows = g.difficulties.map((d) => {
      const r = s.d[d.id];
      if (!r || !r.played) return null;
      return h('tr', null,
        h('th', { scope: 'row' }, d.label),
        h('td', null, `${r.won}/${r.played}`),
        h('td', null, fmtTime(r.bestTime)),
        h('td', null, r.bestMoves == null ? '–' : String(r.bestMoves)),
        h('td', null, r.won ? (r.starSum / r.won).toFixed(1) : '–')
      );
    }).filter(Boolean);
    const recent = sum.recent.slice(-14);
    return h('section', { class: 'gstat', style: { '--c': g.color, '--cd': g.deep } },
      h('div', { class: 'gstat-head' },
        h('span', { class: 'gstat-pict' }, pict(g.id)),
        h('h3', null, g.name),
        h('span', { class: 'gstat-sub' }, sum.played ? `${Math.round((sum.won / sum.played) * 100)}% solved` : '')
      ),
      rows.length
        ? h('table', { class: 'gstat-table' },
            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Level'), h('th', { scope: 'col' }, 'Solved'), h('th', { scope: 'col' }, 'Best'), h('th', { scope: 'col' }, g.movesLabel === 'Guesses' ? 'Fewest' : 'Fewest'), h('th', { scope: 'col' }, 'Avg ★'))),
            h('tbody', null, rows))
        : h('p', { class: 'muted small' }, 'Not played yet.'),
      recent.length
        ? h('div', { class: 'recent', 'aria-label': 'Recent results, oldest first' },
            h('span', { class: 'recent-label' }, 'Recent'),
            h('div', { class: 'recent-strip' }, recent.map((x) => h('span', { class: `rc ${x.w ? 's' + x.s : 'lost'}`, title: x.w ? `${x.s}★ · ${fmtTime(x.t)}` : 'Unsolved' }))))
        : null
    );
  }

  function StatsView() {
    const a = BW.activity.get();
    const streak = BW.activity.streak(a);
    const live = BW.catalog.filter((g) => BW.games[g.id]).map((g) => BW.games[g.id]);
    let solved = 0;
    live.forEach((g) => { solved += BW.stats.summary(g.id).won; });
    const thinking = Object.values(a.days).reduce((t, d) => t + (d.t || 0), 0);
    const played = live.filter((g) => BW.stats.summary(g.id).played > 0);

    const scroll = h('div', { class: 'scroll' },
      h('header', { class: 'page-head' }, h('h1', null, 'Stats')),
      h('div', { class: 'big-stats' },
        h('div', { class: 'bs' }, h('span', { class: 'bs-v' }, String(streak.current)), h('span', { class: 'bs-l' }, `Day streak, best ${streak.best}`)),
        h('div', { class: 'bs' }, h('span', { class: 'bs-v' }, String(solved)), h('span', { class: 'bs-l' }, 'Puzzles solved')),
        h('div', { class: 'bs' }, h('span', { class: 'bs-v' }, fmtDuration(thinking)), h('span', { class: 'bs-l' }, 'Time thinking'))
      ),
      h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Last five weeks'), activityGrid()),
      played.length
        ? played.map(gameStats)
        : h('div', { class: 'empty-state' },
            h('p', null, 'Your times, stars and streaks will show up here once you’ve played a puzzle.'),
            button('Play Lights Out', { kind: 'primary', onClick: () => { location.hash = '#/play/lights-out'; } }))
    );
    return { el: h('div', { class: 'view' }, scroll), tab: 'stats' };
  }

  /* =========================== SETTINGS =========================== */
  function row(label, sub, control) {
    return h('div', { class: 'set-row' }, h('div', { class: 'set-text' }, h('span', { class: 'set-label' }, label), sub ? h('span', { class: 'set-sub' }, sub) : null), control);
  }
  function actionRow(label, sub, iconName, onClick, danger) {
    const b = h('button', { class: 'set-row set-action' + (danger ? ' danger' : ''), type: 'button' },
      h('div', { class: 'set-text' }, h('span', { class: 'set-label' }, label), sub ? h('span', { class: 'set-sub' }, sub) : null), icon(iconName));
    b.addEventListener('click', () => { BW.sound('tap'); onClick(); });
    return b;
  }

  async function exportBackup() {
    const payload = { app: 'brainwave', v: 1, exported: new Date().toISOString(), data: BW.store.dump() };
    const json = JSON.stringify(payload);
    const name = `brainwave-backup-${dateKey()}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Brainwave backup' });
        BW.store.set('lastBackup', Date.now());
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    BW.store.set('lastBackup', Date.now());
    toast('Backup saved.');
  }
  function importBackup() {
    const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    document.body.append(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      let payload;
      try { payload = JSON.parse(await f.text()); } catch { payload = null; }
      if (!payload || payload.app !== 'brainwave' || typeof payload.data !== 'object') {
        BW.sound('error');
        toast('That file isn’t a Brainwave backup.');
        return;
      }
      const when = payload.exported ? new Date(payload.exported).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'an earlier date';
      const ok = await confirm({ title: 'Restore this backup?', body: `Your current progress will be replaced with the backup from ${when}.`, ok: 'Restore backup' });
      if (!ok) return;
      BW.store.clear();
      BW.store.load(payload.data);
      location.hash = '#/';
      location.reload();
    });
    input.click();
  }
  async function eraseAll() {
    const ok = await confirm({ title: 'Erase all progress?', body: 'Stats, streaks, saved puzzles and settings will be deleted from this device. This can’t be undone.', ok: 'Erase everything', danger: true });
    if (!ok) return;
    BW.store.clear();
    location.hash = '#/';
    location.reload();
  }

  function SettingsView() {
    const s = BW.settings;
    const lastBackup = BW.store.get('lastBackup', null);
    const offline = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
    const scroll = h('div', { class: 'scroll' },
      h('header', { class: 'page-head' }, h('h1', null, 'Settings')),
      h('section', { class: 'panel set-group' },
        h('h2', { class: 'panel-title' }, 'Appearance'),
        row('Theme', 'System follows your phone’s setting', segmented([
          { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
        ], s.theme, (v) => BW.setSetting('theme', v), 'Theme'))
      ),
      h('section', { class: 'panel set-group' },
        h('h2', { class: 'panel-title' }, 'Feel'),
        row('Sound effects', 'Follows your ringer switch', toggle(s.sound, (v) => { BW.setSetting('sound', v); if (v) BW.sound('tap'); }, 'Sound effects')),
        BW.haptics.supported ? row('Haptics', BW.isIOS ? 'Light taps on supported iPhones' : null, toggle(s.haptics, (v) => { BW.setSetting('haptics', v); if (v) BW.haptic('medium'); }, 'Haptics')) : null,
        row('Show timer', 'Times are still recorded when hidden', toggle(s.timer, (v) => BW.setSetting('timer', v), 'Show timer')),
        row('Color symbols', 'Shapes on color pegs, so color isn’t the only clue', toggle(s.symbols, (v) => BW.setSetting('symbols', v), 'Color symbols'))
      ),
      h('section', { class: 'panel set-group' },
        h('h2', { class: 'panel-title' }, 'Your data'),
        h('p', { class: 'set-note' }, 'Progress is stored only on this device. Removing Brainwave from your Home Screen deletes it, so keep a backup.'),
        actionRow('Back up progress', lastBackup ? `Last backup ${new Date(lastBackup).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Save a file you can restore later', 'download', exportBackup),
        actionRow('Restore from backup', 'Replace progress with a backup file', 'upload', importBackup),
        actionRow('Erase all progress', null, 'trash', eraseAll, true)
      ),
      h('p', { class: 'about' }, `Brainwave ${BW.version}`, offline ? ' · Works offline' : '')
    );
    return { el: h('div', { class: 'view' }, scroll), tab: 'settings' };
  }

  /* =========================== ROUTER =========================== */
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const [name, arg] = parts;
    let view;
    try {
      if (name === 'play' && BW.games[arg]) view = BW.openGame(arg);
      else if (name === 'stats') view = StatsView();
      else if (name === 'settings') view = SettingsView();
      else view = HomeView();
    } catch (err) {
      console.error(err);
      view = HomeView();
    }
    BW.ui.closeAll();
    if (current && current.destroy) current.destroy();
    appEl.innerHTML = '';
    appEl.append(view.el);
    view.el.classList.add('enter');
    current = view;
    const isGame = name === 'play' && BW.games[arg];
    document.body.dataset.view = isGame ? 'game' : view.tab;
    tabbar.querySelectorAll('a').forEach((a) => {
      const on = a.dataset.tab === view.tab;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function buildTabbar() {
    const tabs = [
      { tab: 'home', href: '#/', label: 'Play', icon: 'play' },
      { tab: 'stats', href: '#/stats', label: 'Stats', icon: 'stats' },
      { tab: 'settings', href: '#/settings', label: 'Settings', icon: 'settings' },
    ];
    tabbar.append(...tabs.map((t) => {
      const a = h('a', { href: t.href, 'data-tab': t.tab }, icon(t.icon), h('span', null, t.label));
      a.addEventListener('click', () => BW.sound('nav'));
      return a;
    }));
  }

  function applyBodyFlags() {
    document.body.classList.toggle('no-symbols', !BW.settings.symbols);
  }

  /* =========================== BOOT =========================== */
  buildTabbar();
  applyBodyFlags();
  BW.on('settings', (k) => {
    applyBodyFlags();
    if (k === 'theme' && document.body.dataset.view === 'settings') { /* stay put */ }
  });
  // Re-render the home screen when returning to the app (streaks/dates may have changed)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (document.body.dataset.view === 'home' || document.body.dataset.view === 'stats')) route();
  });
  window.addEventListener('hashchange', route);
  // Enable :active styles on iOS, and block pinch-zoom gestures inside the app
  document.addEventListener('touchstart', () => {}, { passive: true });
  ['gesturestart', 'gesturechange'].forEach((e) => document.addEventListener(e, (ev) => ev.preventDefault()));
  route();
  requestAnimationFrame(() => document.body.classList.add('ready'));

  // Offline support
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version of Brainwave is ready.', { action: 'Update', ms: 8000, onAction: () => nw.postMessage('skipWaiting') });
          }
        });
      });
    }).catch(() => {});
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      location.reload();
    });
  }
})();
