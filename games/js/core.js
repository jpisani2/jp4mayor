/* Brainwave — core: helpers, RNG, storage, settings, sound, haptics, stats */
(() => {
  'use strict';
  const BW = (window.BW = window.BW || {});
  BW.version = '1.0.0';

  /* ---------------- DOM helpers ---------------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function svg(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }
  function fmtTime(ms) {
    if (ms == null) return '–';
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
  }
  function fmtDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return ms > 0 ? '<1m' : '0m';
    if (m < 60) return `${m}m`;
    const hh = Math.floor(m / 60);
    return `${hh}h ${m % 60}m`;
  }
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function keyToDate(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(k, n) {
    const d = keyToDate(k);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  BW.util = { h, svg, fmtTime, fmtDuration, dateKey, keyToDate, addDays, clamp, reducedMotion };

  /* ---------------- Event bus ---------------- */
  const listeners = {};
  BW.on = (evt, fn) => {
    (listeners[evt] = listeners[evt] || new Set()).add(fn);
    return () => listeners[evt].delete(fn);
  };
  BW.emit = (evt, data) => (listeners[evt] || []).forEach((fn) => fn(data));

  /* ---------------- Seeded RNG ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  BW.hashString = (s) => {
    let h1 = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 3432918353);
      h1 = (h1 << 13) | (h1 >>> 19);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ (h1 >>> 16)) >>> 0;
  };
  BW.RNG = function (seed) {
    const f = mulberry32(seed >>> 0);
    const r = {
      seed,
      next: f,
      int: (n) => Math.floor(f() * n),
      range: (a, b) => a + Math.floor(f() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      chance: (p) => f() < p,
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(f() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
    return r;
  };
  BW.newSeed = () => {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return (Math.random() * 2 ** 32) >>> 0; }
  };

  /* ---------------- Storage ---------------- */
  const PREFIX = 'bw1:';
  const mem = {};
  let lsOK = true;
  try { localStorage.setItem(PREFIX + '__t', '1'); localStorage.removeItem(PREFIX + '__t'); } catch { lsOK = false; }
  const store = {
    get(k, fallback) {
      try {
        const raw = lsOK ? localStorage.getItem(PREFIX + k) : mem[k];
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(k, v) {
      const s = JSON.stringify(v);
      try { if (lsOK) localStorage.setItem(PREFIX + k, s); else mem[k] = s; } catch { mem[k] = s; }
    },
    remove(k) {
      try { if (lsOK) localStorage.removeItem(PREFIX + k); } catch {}
      delete mem[k];
    },
    keys() {
      const out = new Set(Object.keys(mem));
      try {
        if (lsOK) for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX)) out.add(k.slice(PREFIX.length));
        }
      } catch {}
      return [...out];
    },
    dump() {
      const o = {};
      for (const k of this.keys()) o[k] = this.get(k);
      return o;
    },
    load(obj) { for (const [k, v] of Object.entries(obj)) this.set(k, v); },
    clear() { for (const k of this.keys()) this.remove(k); },
    available: lsOK,
  };
  BW.store = store;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

  /* ---------------- Settings & theme ---------------- */
  const DEFAULTS = { theme: 'system', sound: true, haptics: true, timer: true, symbols: true };
  BW.settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  BW.effectiveTheme = () => (BW.settings.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : BW.settings.theme);
  BW.applyTheme = () => {
    const root = document.documentElement;
    if (BW.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', BW.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', BW.effectiveTheme() === 'dark' ? '#16162E' : '#F1F0F8');
  };
  darkMQ.addEventListener && darkMQ.addEventListener('change', BW.applyTheme);
  BW.setSetting = (k, v) => {
    BW.settings[k] = v;
    store.set('settings', BW.settings);
    if (k === 'theme') BW.applyTheme();
    BW.emit('settings', k);
  };
  BW.applyTheme();

  /* ---------------- Sound (synthesised, no files) ---------------- */
  const Sound = {
    ctx: null,
    master: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(f, t0, dur, o = {}) {
      const { type = 'sine', vol = 0.15, to = null, attack = 0.006 } = o;
      const c = this.ctx;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },
    lib: {
      tap(t) { this.tone(880, t, 0.06, { vol: 0.1, to: 680 }); },
      nav(t) { this.tone(1046, t, 0.035, { vol: 0.05 }); },
      flip(t) { this.tone(540, t, 0.1, { type: 'triangle', vol: 0.16, to: 820 }); },
      unflip(t) { this.tone(760, t, 0.1, { type: 'triangle', vol: 0.13, to: 470 }); },
      place(t) { this.tone(660, t, 0.07, { vol: 0.14, to: 760 }); },
      remove(t) { this.tone(440, t, 0.07, { vol: 0.11, to: 330 }); },
      submit(t) { this.tone(523, t, 0.08, { type: 'triangle', vol: 0.13 }); this.tone(784, t + 0.07, 0.11, { type: 'triangle', vol: 0.13 }); },
      hint(t) { [988, 1319, 1760].forEach((f, i) => this.tone(f, t + i * 0.06, 0.14, { vol: 0.07 })); },
      undo(t) { this.tone(620, t, 0.08, { vol: 0.1, to: 410 }); },
      error(t) { this.tone(196, t, 0.16, { type: 'square', vol: 0.045, to: 150 }); },
      star(t) { this.tone(1568, t, 0.22, { vol: 0.09 }); this.tone(2093, t + 0.04, 0.2, { vol: 0.05 }); },
      win(t) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.085, 0.34, { type: 'triangle', vol: 0.15 }));
        this.tone(1318.5, t + 0.34, 0.55, { vol: 0.07 });
      },
      lose(t) { [392, 329.6, 261.6].forEach((f, i) => this.tone(f, t + i * 0.15, 0.32, { type: 'triangle', vol: 0.12 })); },
    },
    play(name) {
      if (!BW.settings.sound) return;
      const c = this.ensure();
      if (!c || !this.lib[name]) return;
      try { this.lib[name].call(this, c.currentTime + 0.005); } catch {}
    },
  };
  BW.sound = (name) => Sound.play(name);
  document.addEventListener('pointerdown', () => { if (BW.settings.sound) Sound.ensure(); }, { passive: true, capture: true });

  /* ---------------- Haptics ---------------- */
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  BW.isIOS = isIOS;
  BW.isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  function iosTick() {
    // iOS 18+ plays a system haptic when a switch-style checkbox toggles from a user gesture.
    try {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.head.appendChild(label);
      label.click();
      document.head.removeChild(label);
    } catch {}
  }
  BW.haptics = {
    supported: 'vibrate' in navigator || isIOS,
    fire(kind = 'light') {
      if (!BW.settings.haptics) return;
      if (navigator.vibrate) { try { navigator.vibrate(kind === 'heavy' ? [14, 50, 14] : kind === 'medium' ? 14 : 7); } catch {} return; }
      if (isIOS) iosTick();
    },
  };
  BW.haptic = (k) => BW.haptics.fire(k);

  /* ---------------- Game catalog ---------------- */
  BW.catalog = [
    { id: 'lights-out', cat: 'logic', name: 'Lights Out', blurb: 'Flip tiles and their neighbors until the board goes dark', color: '#FFC93C', deep: '#D9A116' },
    { id: 'code-breaker', cat: 'logic', name: 'Code Breaker', blurb: 'Crack a hidden color code from clues', color: '#45D3B8', deep: '#1E9E87' },
    { id: 'nonogram', cat: 'logic', name: 'Nonogram', blurb: 'Reveal a hidden picture from number clues', color: '#9C99FF', deep: '#6763DB', soon: true },
    { id: 'binary', cat: 'logic', name: 'Binary Grid', blurb: 'Balance the 0s and 1s in every line', color: '#FF94BC', deep: '#D9628F', soon: true },
    { id: 'sudoku', cat: 'logic', name: 'Sudoku', blurb: 'Fill every row, column and box', color: '#72C7FF', deep: '#3A97D6', soon: true },
    { id: 'river', cat: 'logic', name: 'River Crossing', blurb: 'Get everyone across without disaster', color: '#93DA72', deep: '#5BAA3D', soon: true },
    { id: 'make24', cat: 'numbers', name: 'Make 24', blurb: 'Four numbers, four operations, one target', color: '#FF8E6A', deep: '#D9623F', soon: true },
    { id: 'sequence', cat: 'numbers', name: 'What Comes Next', blurb: 'Find the rule hiding in the sequence', color: '#CBA4FF', deep: '#9A6AE0', soon: true },
    { id: 'jugs', cat: 'numbers', name: 'Water Jugs', blurb: 'Pour your way to an exact amount', color: '#62D8EA', deep: '#2CA9BD', soon: true },
    { id: 'nim', cat: 'numbers', name: 'Nim', blurb: 'Outthink the computer in a game of piles', color: '#FF7676', deep: '#D44848', soon: true },
  ];
  BW.meta = (id) => BW.catalog.find((g) => g.id === id);

  /* ---------------- Stats & activity ---------------- */
  const blankRec = () => ({ played: 0, won: 0, bestTime: null, bestMoves: null, totalTime: 0, starSum: 0, cur: 0, best: 0, hist: [] });
  const Activity = {
    get() { return store.get('activity', { days: {}, best: 0 }); },
    bump(field) {
      const a = this.get();
      const k = dateKey();
      const d = (a.days[k] = a.days[k] || { p: 0, s: 0, t: 0 });
      d[field] = (d[field] || 0) + 1;
      store.set('activity', a);
      const s = this.streak(a);
      if (s.current > (a.best || 0)) { a.best = s.current; store.set('activity', a); }
    },
    addTime(ms) {
      const a = this.get();
      const k = dateKey();
      const d = (a.days[k] = a.days[k] || { p: 0, s: 0, t: 0 });
      d.t = (d.t || 0) + ms;
      store.set('activity', a);
    },
    streak(a = this.get()) {
      const today = dateKey();
      const solved = (k) => a.days[k] && a.days[k].s > 0;
      const doneToday = solved(today);
      let k = doneToday ? today : addDays(today, -1);
      let n = 0;
      while (solved(k)) { n++; k = addDays(k, -1); }
      return { current: n, best: Math.max(a.best || 0, n), doneToday };
    },
  };
  BW.activity = Activity;

  BW.stats = {
    get(id) { return store.get('stats:' + id, { d: {} }); },
    rec(id, diff) { return this.get(id).d[diff] || blankRec(); },
    started(id, diff) {
      const s = this.get(id);
      const r = (s.d[diff] = s.d[diff] || blankRec());
      r.played++;
      store.set('stats:' + id, s);
      Activity.bump('p');
    },
    result(id, diff, { won, time = 0, moves = 0, stars = 0, hints = 0 }) {
      const s = this.get(id);
      const r = (s.d[diff] = s.d[diff] || blankRec());
      const out = { prevBestTime: r.bestTime, prevBestMoves: r.bestMoves, newBestTime: false, newBestMoves: false };
      r.hist.push({ w: won ? 1 : 0, t: time, m: moves, s: stars, h: hints, at: Date.now() });
      if (r.hist.length > 40) r.hist = r.hist.slice(-40);
      if (won) {
        r.won++;
        r.totalTime += time;
        r.starSum += stars;
        r.cur++;
        r.best = Math.max(r.best, r.cur);
        if (r.bestTime == null || time < r.bestTime) { out.newBestTime = r.bestTime != null; r.bestTime = time; }
        if (r.bestMoves == null || moves < r.bestMoves) { out.newBestMoves = r.bestMoves != null; r.bestMoves = moves; }
      } else {
        r.cur = 0;
      }
      store.set('stats:' + id, s);
      if (won) Activity.bump('s');
      Activity.addTime(time);
      return out;
    },
    summary(id) {
      const s = this.get(id);
      const t = { played: 0, won: 0, starSum: 0, time: 0, bestTime: null, recent: [] };
      for (const [diff, r] of Object.entries(s.d)) {
        t.played += r.played; t.won += r.won; t.starSum += r.starSum; t.time += r.totalTime;
        r.hist.forEach((x) => t.recent.push(Object.assign({ diff }, x)));
      }
      t.recent.sort((a, b) => a.at - b.at);
      return t;
    },
  };
})();
