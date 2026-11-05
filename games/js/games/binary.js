/* Brainwave — Binary Grid (Takuzu) */
(() => {
  'use strict';
  const { h, svg } = BW.util;

  const DIFFS = {
    easy:   { n: 6,  keep: 0.42, logic: true,  par: 90 },
    medium: { n: 8,  keep: 0.3,  logic: true,  par: 210 },
    hard:   { n: 10, keep: 0,    logic: true,  par: 360 },
    expert: { n: 12, keep: 0,    logic: false, par: 600 },
  };

  const linesCache = {};
  function lines(n) {
    if (linesCache[n]) return linesCache[n];
    const L = [];
    for (let r = 0; r < n; r++) L.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) L.push(Array.from({ length: n }, (_, r) => r * n + c));
    return (linesCache[n] = L);
  }

  /* One deduction pass on a line. -1 contradiction, 1 changed, 0 nothing. */
  function lineStep(g, idx, n) {
    const half = n / 2;
    let ch = 0;
    for (let i = 0; i + 2 < n; i++) {
      const a = g[idx[i]];
      if (a !== -1 && a === g[idx[i + 1]] && a === g[idx[i + 2]]) return -1;
    }
    let c0 = 0, c1 = 0;
    for (const k of idx) { if (g[k] === 0) c0++; else if (g[k] === 1) c1++; }
    if (c0 > half || c1 > half) return -1;
    for (let i = 0; i < n; i++) {
      if (g[idx[i]] !== -1) continue;
      const L1 = i >= 1 ? g[idx[i - 1]] : -1, L2 = i >= 2 ? g[idx[i - 2]] : -1;
      const R1 = i + 1 < n ? g[idx[i + 1]] : -1, R2 = i + 2 < n ? g[idx[i + 2]] : -1;
      let v = -1;
      if (L1 !== -1 && L1 === L2) v = 1 - L1;
      else if (R1 !== -1 && R1 === R2) v = 1 - R1;
      else if (L1 !== -1 && L1 === R1) v = 1 - L1;
      if (v !== -1) {
        g[idx[i]] = v; ch = 1;
        if (v === 0) c0++; else c1++;
        if (c0 > half || c1 > half) return -1;
      }
    }
    if (c0 === half || c1 === half) {
      const v = c0 === half ? 1 : 0;
      for (const k of idx) if (g[k] === -1) { g[k] = v; ch = 1; }
    }
    return ch;
  }
  function dupLines(g, n) {
    const L = lines(n);
    for (const set of [L.slice(0, n), L.slice(n)]) {
      const seen = new Set();
      for (const idx of set) {
        let s = '';
        for (const k of idx) { if (g[k] === -1) { s = null; break; } s += g[k]; }
        if (s == null) continue;
        if (seen.has(s)) return true;
        seen.add(s);
      }
    }
    return false;
  }
  function propagate(g, n) {
    const L = lines(n);
    let changed = true;
    while (changed) {
      changed = false;
      for (const idx of L) {
        const r = lineStep(g, idx, n);
        if (r < 0) return false;
        if (r > 0) changed = true;
      }
      if (dupLines(g, n)) return false;
    }
    return true;
  }
  function solve(g0, n, limit, rng) {
    let count = 0, first = null;
    (function rec(g) {
      if (count >= limit) return;
      if (!propagate(g, n)) return;
      const e = g.indexOf(-1);
      if (e < 0) { count++; if (!first) first = g.slice(); return; }
      const order = rng && rng.chance(0.5) ? [1, 0] : [0, 1];
      for (const v of order) {
        const c = g.slice(); c[e] = v;
        rec(c);
        if (count >= limit) return;
      }
    })(g0.slice());
    return { count, first };
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    const n = cfg.n;
    const sol = solve(new Array(n * n).fill(-1), n, 1, rng).first;
    const puz = sol.slice();
    const minGivens = Math.ceil(n * n * cfg.keep);
    let givens = n * n;
    // Pass 1: remove while plain deduction still solves it (fast, and guarantees one solution)
    for (const i of rng.shuffle([...Array(n * n).keys()])) {
      if (givens <= minGivens) break;
      const v = puz[i];
      puz[i] = -1;
      const t = puz.slice();
      if (propagate(t, n) && t.indexOf(-1) < 0) givens--; else puz[i] = v;
    }
    // Pass 2 (Expert): keep removing while the answer stays unique, within a time budget
    if (!cfg.logic) {
      const t0 = Date.now();
      for (const i of rng.shuffle([...Array(n * n).keys()])) {
        if (Date.now() - t0 > 600) break;
        if (puz[i] === -1) continue;
        const v = puz[i];
        puz[i] = -1;
        if (solve(puz, n, 2).count === 1) givens--; else puz[i] = v;
      }
    }
    return { n, sol, start: puz, par: cfg.par };
  }

  /* A human-explainable next step on a (correct-so-far) grid. */
  function explainStep(g, n) {
    const L = lines(n);
    const half = n / 2;
    for (let li = 0; li < L.length; li++) {
      const idx = L[li];
      const kind = li < n ? 'row' : 'column';
      for (let i = 0; i < n; i++) {
        if (g[idx[i]] !== -1) continue;
        const L1 = i >= 1 ? g[idx[i - 1]] : -1, L2 = i >= 2 ? g[idx[i - 2]] : -1;
        const R1 = i + 1 < n ? g[idx[i + 1]] : -1, R2 = i + 2 < n ? g[idx[i + 2]] : -1;
        if (L1 !== -1 && L1 === L2) return { i: idx[i], v: 1 - L1, why: `Two ${L1}s in a row, so the next square must be ${1 - L1}.` };
        if (R1 !== -1 && R1 === R2) return { i: idx[i], v: 1 - R1, why: `Two ${R1}s in a row, so the square before them must be ${1 - R1}.` };
        if (L1 !== -1 && L1 === R1) return { i: idx[i], v: 1 - L1, why: `A square between two ${L1}s must be ${1 - L1}.` };
      }
    }
    for (let li = 0; li < L.length; li++) {
      const idx = L[li];
      const kind = li < n ? 'row' : 'column';
      let c0 = 0, c1 = 0;
      for (const k of idx) { if (g[k] === 0) c0++; else if (g[k] === 1) c1++; }
      if ((c0 === half || c1 === half) && c0 + c1 < n) {
        const v = c0 === half ? 1 : 0;
        const k = idx.find((x) => g[x] === -1);
        return { i: k, v, why: `This ${kind} already has all ${half} of its ${1 - v}s, so the rest are ${v}s.` };
      }
    }
    return null;
  }

  function violations(g, n) {
    const bad = new Set();
    const L = lines(n);
    const half = n / 2;
    for (const idx of L) {
      for (let i = 0; i + 2 < n; i++) {
        const a = g[idx[i]];
        if (a !== -1 && a === g[idx[i + 1]] && a === g[idx[i + 2]]) [0, 1, 2].forEach((d) => bad.add(idx[i + d]));
      }
      let c0 = 0, c1 = 0;
      for (const k of idx) { if (g[k] === 0) c0++; else if (g[k] === 1) c1++; }
      if (c0 > half) idx.forEach((k) => g[k] === 0 && bad.add(k));
      if (c1 > half) idx.forEach((k) => g[k] === 1 && bad.add(k));
    }
    for (const set of [L.slice(0, n), L.slice(n)]) {
      const map = new Map();
      for (const idx of set) {
        if (idx.some((k) => g[k] === -1)) continue;
        const s = idx.map((k) => g[k]).join('');
        if (map.has(s)) { idx.forEach((k) => bad.add(k)); map.get(s).forEach((k) => bad.add(k)); }
        else map.set(s, idx);
      }
    }
    return bad;
  }

  function figure() {
    const row = (vals, cls) => vals.map((v, i) => `<g transform="translate(${i * 30} 0)"><rect width="26" height="26" rx="7" class="${v === '' ? 'e' : 'v' + v}"/>${v === '' ? '' : `<text x="13" y="18.5" text-anchor="middle" class="v${v}">${v}</text>`}</g>`).join('');
    return svg(`<svg viewBox="0 0 176 92" width="200" height="105" class="bn-fig" role="img" aria-label="Examples: after two zeros comes a one; three in a row is not allowed">
      <g transform="translate(0 4)">${row([0, 0, 1, '', '', ''])}</g>
      <g transform="translate(0 52)">${row([1, 1, 1, '', '', ''])}</g>
      <path d="M94 61l12 12M106 61l-12 12" stroke="var(--bad)" stroke-width="3" stroke-linecap="round"/>
    </svg>`);
  }

  BW.registerGame({
    id: 'binary',
    movesLabel: 'Moves',
    movesBest: false,
    defaultDiff: 'easy',
    difficulties: [
      { id: 'easy', label: 'Easy', note: '6×6' },
      { id: 'medium', label: 'Medium', note: '8×8' },
      { id: 'hard', label: 'Hard', note: '10×10' },
      { id: 'expert', label: 'Expert', note: '12×12', desc: 'may need lookahead' },
    ],
    howTo: {
      goal: 'Fill every square with a 0 or a 1.',
      figure,
      rules: [
        'No more than <b>two</b> of the same digit next to each other, across or down.',
        'Every row and column has the <b>same number</b> of 0s and 1s.',
        'No two rows are identical, and no two columns are identical.',
        'Tap a square to cycle through 0, 1 and blank. Squares that break a rule turn red.',
      ],
      scoring: 'Finish within par time for three stars. Hints explain the next logical step but cap you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const n = P.n;
      if (!ctx.state) ctx.state = { g: P.start.slice(), hist: [] };
      const S = ctx.state;
      ctx.info('Par', BW.fmtPar(P.par));
      let hintIdx = -1;

      const wrap = h('div', { class: 'gm' });
      const area = h('div', { class: 'gm-area' });
      const grid = h('div', { class: 'bn-grid', style: { '--n': n }, role: 'grid', 'aria-label': `Binary grid, ${n} by ${n}` });
      area.append(grid);
      wrap.append(area);
      root.append(wrap);

      const cells = [];
      for (let i = 0; i < n * n; i++) {
        const given = P.start[i] !== -1;
        const b = h(given ? 'div' : 'button', { class: 'bn-cell' + (given ? ' given' : ' cap'), type: given ? null : 'button', role: 'gridcell' });
        if (!given) b.addEventListener('click', () => tap(i));
        cells.push(b);
        grid.append(b);
      }
      function size() {
        const W = area.clientWidth, H = area.clientHeight;
        const s = Math.floor(Math.min(W, H, 520));
        grid.style.width = grid.style.height = s + 'px';
        grid.style.setProperty('--fs', Math.max(12, Math.round((s / n) * 0.44)) + 'px');
      }
      const ro = new ResizeObserver(size);
      ro.observe(area);

      function paint() {
        const bad = violations(S.g, n);
        cells.forEach((b, i) => {
          const v = S.g[i];
          b.classList.toggle('v0', v === 0);
          b.classList.toggle('v1', v === 1);
          b.classList.toggle('err', bad.has(i));
          b.classList.toggle('hinted', i === hintIdx);
          b.textContent = v === -1 ? '' : String(v);
          const r = Math.floor(i / n) + 1, c = (i % n) + 1;
          b.setAttribute('aria-label', `Row ${r}, column ${c}, ${v === -1 ? 'blank' : v}${P.start[i] !== -1 ? ', given' : ''}${bad.has(i) ? ', breaks a rule' : ''}`);
        });
      }

      function set(i, v) {
        S.hist.push([i, S.g[i]]);
        if (S.hist.length > 400) S.hist.shift();
        S.g[i] = v;
      }
      function tap(i) {
        if (ctx.status !== 'playing') return;
        const cur = S.g[i];
        const next = cur === -1 ? 0 : cur === 0 ? 1 : -1;
        set(i, next);
        if (i === hintIdx) hintIdx = -1;
        paint();
        ctx.sound(next === -1 ? 'remove' : next === 0 ? 'place' : 'flip');
        ctx.haptic('light');
        ctx.update({ moves: ctx.moves + 1 });
        checkWin();
      }
      function checkWin() {
        if (S.g.indexOf(-1) >= 0) return;
        if (violations(S.g, n).size) return;
        grid.classList.add('won');
        ctx.finish({ won: true, stars: BW.timeStars(ctx.elapsed, P.par, ctx.hints), note: `Par time is ${BW.fmtPar(P.par)}.` });
      }

      paint();
      size();
      if (ctx.status !== 'playing') grid.classList.add('won');

      return {
        canUndo: () => S.hist.length > 0,
        undo() {
          const [i, v] = S.hist.pop();
          S.g[i] = v;
          paint();
          ctx.update({ moves: ctx.moves + 1 });
        },
        restart() {
          S.g = P.start.slice();
          S.hist = [];
          hintIdx = -1;
          paint();
          ctx.update({ moves: 0 });
        },
        hint() {
          const wrong = [];
          for (let i = 0; i < n * n; i++) if (S.g[i] !== -1 && S.g[i] !== P.sol[i]) wrong.push(i);
          let msg;
          if (wrong.length) {
            hintIdx = wrong[0];
            set(hintIdx, -1);
            msg = 'This square was wrong, so it’s been cleared.';
          } else {
            const step = explainStep(S.g, n);
            if (step && P.sol[step.i] === step.v) { hintIdx = step.i; set(step.i, step.v); msg = step.why; }
            else {
              const empty = [];
              for (let i = 0; i < n * n; i++) if (S.g[i] === -1) empty.push(i);
              if (!empty.length) return false;
              hintIdx = empty[Math.floor(Math.random() * empty.length)];
              set(hintIdx, P.sol[hintIdx]);
              msg = 'No simple step here, so one square has been filled in.';
            }
          }
          paint();
          ctx.toast(msg, { ms: 3600 });
          setTimeout(checkWin, 50);
          return true;
        },
        destroy() { ro.disconnect(); },
      };
    },
  });

  BW._binary = { generate, solve, propagate, violations, explainStep, DIFFS };
})();
