/* Brainwave — game shell: session, timer, tools, difficulty, how-to, results */
(() => {
  'use strict';
  const { h, fmtTime } = BW.util;
  const { icon, button, iconButton, sheet, confirm, toast, stars } = BW.ui;

  BW.games = {};
  BW.registerGame = (def) => { BW.games[def.id] = Object.assign({}, BW.meta(def.id), def); };

  const TOOLS = {
    undo: { icon: 'undo', label: 'Undo' },
    hint: { icon: 'hint', label: 'Hint' },
    restart: { icon: 'restart', label: 'Restart' },
    new: { icon: 'new', label: 'New' },
  };

  const TITLES = {
    3: ['Flawless.', 'Clean solve.', 'Sharp.', 'Textbook.'],
    2: ['Solved.', 'Nicely done.', 'Got it.'],
    1: ['Solved.', 'Got there.', 'Done and dusted.'],
  };

  /** Read-only peek at a game's saved session (for the hub). */
  BW.peekSession = (id) => {
    const saved = BW.store.get('save:' + id, null);
    if (!saved) return null;
    const s = saved.sessions && saved.sessions[saved.diff];
    if (!s || s.status !== 'playing' || !s.started) return null;
    return { diff: saved.diff, elapsed: s.elapsed, moves: s.moves, at: s.at };
  };

  function chip(label) {
    const valueEl = h('span', { class: 'chip-value' }, '–');
    const labelEl = h('span', { class: 'chip-label' }, label);
    const el = h('div', { class: 'chip' }, valueEl, labelEl);
    el._v = valueEl; el._l = labelEl;
    return el;
  }
  const setChip = (c, label, value) => { if (label != null) c._l.textContent = label; c._v.textContent = value; };

  BW.openGame = function (id) {
    const def = BW.games[id];
    const saveKey = 'save:' + id;
    const saved = BW.store.get(saveKey, null) || { diff: def.defaultDiff || def.difficulties[0].id, sessions: {} };
    if (!def.difficulties.some((d) => d.id === saved.diff)) saved.diff = def.difficulties[0].id;
    let diff = saved.diff;
    let session = null;
    let inst = {};
    let timerOn = false, lastTick = 0, tickId = 0, lastSave = 0, saveTimer = 0;
    const offs = [];
    const diffInfo = (d = diff) => def.difficulties.find((x) => x.id === d);

    /* ---------- DOM ---------- */
    const els = {};
    const el = h('div', { class: 'view game-view', style: { '--accent': def.color, '--accent-deep': def.deep }, 'data-game': id },
      h('header', { class: 'g-head' },
        iconButton('back', 'Back to games', () => { location.hash = '#/'; }),
        h('div', { class: 'g-heading' },
          h('h1', { class: 'g-name' }, def.name),
          (els.diffBtn = h('button', { class: 'diff-pill', type: 'button', onclick: () => { BW.sound('nav'); chooseDifficulty(); } }))
        ),
        iconButton('help', 'How to play', () => showHowTo(false))
      ),
      (els.stats = h('div', { class: 'g-stats' },
        (els.timeChip = chip('Time')),
        (els.movesChip = chip(def.movesLabel || 'Moves')),
        (els.extraChip = chip(''))
      )),
      (els.board = h('main', { class: 'g-board' })),
      (els.tools = h('footer', { class: 'g-tools' }))
    );
    const toolBtns = {};
    (def.tools || ['undo', 'hint', 'restart', 'new']).forEach((t) => {
      const b = h('button', { class: 'tool cap', type: 'button' }, icon(TOOLS[t].icon), h('span', null, TOOLS[t].label));
      b.addEventListener('click', () => onTool(t));
      toolBtns[t] = b;
      els.tools.append(b);
    });

    /* ---------- persistence ---------- */
    function persist() {
      clearTimeout(saveTimer);
      if (!session) return;
      session.at = Date.now();
      saved.diff = diff;
      saved.sessions[diff] = session;
      BW.store.set(saveKey, saved);
      lastSave = performance.now();
    }
    function persistSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 350); }

    /* ---------- timer ---------- */
    const paused = () => document.hidden || BW.sheetsOpen() > 0;
    function tick() {
      const now = performance.now();
      session.elapsed += now - lastTick;
      lastTick = now;
      renderTime();
      if (now - lastSave > 5000) persist();
    }
    function startTimer() {
      if (timerOn || !session || session.status !== 'playing' || !session.started || paused()) return;
      timerOn = true;
      lastTick = performance.now();
      tickId = setInterval(tick, 250);
    }
    function stopTimer() {
      if (!timerOn) return;
      tick();
      timerOn = false;
      clearInterval(tickId);
    }

    /* ---------- rendering ---------- */
    function renderTime() { setChip(els.timeChip, null, fmtTime(session.elapsed)); }
    function renderStats() {
      els.timeChip.hidden = !BW.settings.timer;
      renderTime();
      setChip(els.movesChip, null, def.movesValue ? def.movesValue(ctx) : String(session.moves));
    }
    function updateHeader() {
      const d = diffInfo();
      els.diffBtn.innerHTML = '';
      els.diffBtn.append(h('span', null, d.label), h('span', { class: 'diff-note' }, d.note), icon('chevDown'));
      els.diffBtn.setAttribute('aria-label', `Difficulty: ${d.label}, ${d.note}. Change difficulty`);
    }
    function refreshTools() {
      const playing = session.status === 'playing';
      if (toolBtns.undo) toolBtns.undo.disabled = !playing || !(inst.canUndo && inst.canUndo());
      if (toolBtns.hint) toolBtns.hint.disabled = !playing || (inst.canHint ? !inst.canHint() : false);
      if (toolBtns.restart) toolBtns.restart.disabled = !playing || session.moves === 0;
      if (toolBtns.new) {
        toolBtns.new.classList.toggle('pulse', !playing);
        toolBtns.new.querySelector('span').textContent = playing ? 'New' : 'Next';
      }
    }

    /* ---------- session lifecycle ---------- */
    function fresh(d) {
      const seed = BW.newSeed();
      const puzzle = def.generate(d, BW.RNG(seed));
      return { seed, puzzle, state: null, elapsed: 0, moves: 0, hints: 0, status: 'playing', started: false, at: Date.now() };
    }
    function loadSession() {
      let s = saved.sessions[diff];
      if (!s || s.status !== 'playing') { s = fresh(diff); saved.sessions[diff] = s; }
      session = s;
      persist();
      mount();
    }
    function mount() {
      stopTimer();
      if (inst.destroy) inst.destroy();
      els.board.innerHTML = '';
      els.extraChip.hidden = true;
      inst = def.mount(els.board, ctx) || {};
      updateHeader();
      renderStats();
      refreshTools();
      startTimer();
    }
    function markStarted() {
      if (!session.started) {
        session.started = true;
        BW.stats.started(id, diff);
      }
      BW.store.set('last', { id, at: Date.now() });
    }
    async function newPuzzle() {
      if (session.status === 'playing' && session.started && session.moves > 0) {
        const ok = await confirm({ title: 'Start a new puzzle?', body: 'This one will be recorded as unsolved.', ok: 'Start new puzzle' });
        if (!ok) return;
        stopTimer();
        BW.stats.result(id, diff, { won: false, time: Math.round(session.elapsed), moves: session.moves, hints: session.hints });
      }
      session = fresh(diff);
      saved.sessions[diff] = session;
      persist();
      mount();
      BW.sound('flip');
    }
    function switchDiff(d) {
      stopTimer();
      persist();
      diff = d;
      saved.diff = d;
      loadSession();
    }

    /* ---------- tools ---------- */
    async function onTool(t) {
      if (t === 'new') { BW.sound('tap'); return newPuzzle(); }
      if (session.status !== 'playing') return;
      if (t === 'undo') {
        if (inst.canUndo && inst.canUndo()) { inst.undo(); BW.sound('undo'); BW.haptic('light'); }
      } else if (t === 'hint') {
        const ok = inst.hint && inst.hint();
        if (ok) {
          markStarted();
          session.hints++;
          BW.sound('hint');
          BW.haptic('light');
          renderStats(); refreshTools(); persist(); startTimer();
        } else {
          BW.sound('error');
          toast(inst.noHintText || 'No hint available right now.');
        }
      } else if (t === 'restart') {
        BW.sound('tap');
        const ok = await confirm({ title: 'Restart this puzzle?', body: 'Your moves reset to zero. The clock keeps running.', ok: 'Restart' });
        if (!ok) return;
        inst.restart && inst.restart();
        BW.sound('undo');
      }
    }

    /* ---------- finishing ---------- */
    function finish({ won, stars: st = 0, note, extra }) {
      if (session.status !== 'playing') return;
      markStarted();
      stopTimer();
      session.status = won ? 'won' : 'lost';
      const time = Math.round(session.elapsed);
      const res = BW.stats.result(id, diff, { won, time, moves: session.moves, stars: st, hints: session.hints });
      session.result = Object.assign({ won, stars: st, time, moves: session.moves, hints: session.hints, note }, res);
      persist();
      refreshTools();
      renderStats();
      BW.haptic('heavy');
      if (won) {
        BW.sound('win');
        setTimeout(() => BW.ui.confetti([def.color, def.deep, '#FFC93C', '#9C99FF', '#FF94BC', '#45D3B8']), 280);
      } else BW.sound('lose');
      setTimeout(() => showResult(extra), won ? 950 : 1100);
      BW.emit('finished', { id, diff, won });
    }

    function showResult(extra) {
      const r = session.result;
      if (!r || !document.body.contains(el)) return;
      const rec = BW.stats.rec(id, diff);
      const titleList = r.won ? TITLES[r.stars] || TITLES[1] : [def.loseTitle || 'Not this time.'];
      const title = titleList[Math.floor(Math.random() * titleList.length)];
      const stat = (label, value, tag) =>
        h('div', { class: 'r-stat' }, h('span', { class: 'r-value' }, value), h('span', { class: 'r-label' }, label), tag ? h('span', { class: 'tag tag-accent' }, tag) : null);
      const starRow = r.won ? stars(r.stars, 3, 'big pop') : null;
      const body = h('div', { class: 'result' },
        starRow,
        h('div', { class: 'r-grid' },
          stat('Time', fmtTime(r.time), r.newBestTime ? 'New best' : null),
          stat(def.movesLabel || 'Moves', String(r.moves), r.newBestMoves ? 'New best' : null),
          r.hints ? stat(r.hints === 1 ? 'Hint' : 'Hints', String(r.hints))
            : r.prevBestTime != null ? stat('Best time', fmtTime(rec.bestTime))
            : stat('Solved', String(rec.won))
        ),
        r.note ? h('p', { class: 'r-note' }, r.note) : null,
        extra || null
      );
      const s = sheet({
        title,
        body,
        cls: 'result-sheet',
        actions: [
          button('Next puzzle', { kind: 'accent', onClick: () => { s.close(); newPuzzle(); } }),
          button('Back to games', { kind: 'ghost', onClick: () => { s.close(); location.hash = '#/'; } }),
        ],
      });
      if (starRow) {
        starRow.querySelectorAll('.star.on').forEach((_, i) => setTimeout(() => BW.sound('star'), 260 + i * 170));
      }
    }

    /* ---------- difficulty ---------- */
    function chooseDifficulty() {
      const list = h('div', { class: 'diff-list' });
      const sh = sheet({ title: 'Difficulty', body: list });
      def.difficulties.forEach((d) => {
        const rec = BW.stats.rec(id, d.id);
        const s = saved.sessions[d.id];
        const inProg = s && s.status === 'playing' && s.started && d.id !== diff;
        const side = inProg ? h('span', { class: 'tag' }, 'In progress') : rec.won ? h('span', { class: 'diff-best' }, `Best ${fmtTime(rec.bestTime)}`) : null;
        const b = h('button', { class: 'diff-row cap' + (d.id === diff ? ' on' : ''), type: 'button', 'aria-pressed': String(d.id === diff) },
          h('span', { class: 'diff-main' }, h('span', { class: 'diff-label' }, d.label), h('span', { class: 'diff-desc' }, d.note + (d.desc ? ` · ${d.desc}` : ''))),
          side,
          d.id === diff ? icon('check', 'diff-check') : null
        );
        b.addEventListener('click', () => { BW.sound('tap'); sh.close(); if (d.id !== diff) switchDiff(d.id); });
        list.append(b);
      });
    }

    /* ---------- how to play ---------- */
    function showHowTo(first) {
      const ht = def.howTo;
      const body = h('div', { class: 'howto' },
        h('p', { class: 'howto-goal' }, ht.goal),
        ht.figure ? h('div', { class: 'howto-fig' }, ht.figure()) : null,
        h('ul', { class: 'howto-list' }, ht.rules.map((r) => h('li', { html: r }))),
        ht.scoring ? h('p', { class: 'howto-score' }, icon('star'), h('span', { html: ht.scoring })) : null
      );
      const s = sheet({
        title: `How to play ${def.name}`,
        body,
        actions: [button(first ? 'Start playing' : 'Got it', { kind: 'accent', onClick: () => s.close() })],
      });
      BW.store.set('seen:' + id, true);
    }

    /* ---------- game context ---------- */
    const ctx = {
      get puzzle() { return session.puzzle; },
      get state() { return session.state; },
      set state(v) { session.state = v; },
      get diff() { return diff; },
      get diffInfo() { return diffInfo(); },
      get hints() { return session.hints; },
      get moves() { return session.moves; },
      get status() { return session.status; },
      update({ moves } = {}) {
        if (session.status !== 'playing') return;
        markStarted();
        if (moves != null) session.moves = moves;
        startTimer();
        renderStats();
        refreshTools();
        persistSoon();
      },
      refresh() { refreshTools(); renderStats(); },
      save: persistSoon,
      info(label, value) { els.extraChip.hidden = false; setChip(els.extraChip, label, value); },
      finish,
      sound: BW.sound,
      haptic: BW.haptic,
      toast,
    };

    /* ---------- global listeners ---------- */
    const onVis = () => { if (document.hidden) { stopTimer(); persist(); } else startTimer(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', persist);
    offs.push(() => document.removeEventListener('visibilitychange', onVis));
    offs.push(() => window.removeEventListener('pagehide', persist));
    offs.push(BW.on('sheet', (n) => { if (n > 0) stopTimer(); else startTimer(); }));
    offs.push(BW.on('settings', (k) => { renderStats(); inst.onSettings && inst.onSettings(k); }));

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--accent', def.color);
    rootStyle.setProperty('--accent-deep', def.deep);

    loadSession();
    if (!BW.store.get('seen:' + id, false)) setTimeout(() => { if (document.body.contains(el)) showHowTo(true); }, 350);

    return {
      el,
      destroy() {
        stopTimer();
        persist();
        offs.forEach((f) => f());
        inst.destroy && inst.destroy();
        rootStyle.removeProperty('--accent');
        rootStyle.removeProperty('--accent-deep');
      },
    };
  };
})();
