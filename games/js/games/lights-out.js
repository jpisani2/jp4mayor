/* Brainwave — Lights Out */
(() => {
  'use strict';
  const { h, svg } = BW.util;

  const DIFFS = {
    easy:   { n: 4, m: 2, p: 0.32, par: [4, 6] },
    medium: { n: 5, m: 2, p: 0.42, par: [7, 11] },
    hard:   { n: 6, m: 2, p: 0.38, par: [11, 16] },
    expert: { n: 5, m: 3, p: 0.4,  par: [10, 15] },
  };

  /* ---------- linear algebra over GF(p) ---------- */
  const mats = {};
  function matrix(n) {
    if (mats[n]) return mats[n];
    const N = n * n;
    const A = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const j = r * n + c;
      for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) A[rr * n + cc][j] = 1;
      }
    }
    return (mats[n] = A);
  }
  const inv = (a, p) => { for (let x = 1; x < p; x++) if ((a * x) % p === 1) return x; return 1; };

  function solveMod(A, b, p) {
    const N = A.length;
    const M = A.map((row, i) => [...row, ((b[i] % p) + p) % p]);
    const where = new Array(N).fill(-1);
    let row = 0;
    for (let col = 0; col < N && row < N; col++) {
      let sel = -1;
      for (let i = row; i < N; i++) if (M[i][col] % p) { sel = i; break; }
      if (sel < 0) continue;
      [M[sel], M[row]] = [M[row], M[sel]];
      const iv = inv(M[row][col], p);
      for (let k = col; k <= N; k++) M[row][k] = (M[row][k] * iv) % p;
      for (let i = 0; i < N; i++) {
        if (i !== row && M[i][col]) {
          const f = M[i][col];
          for (let k = col; k <= N; k++) M[i][k] = (((M[i][k] - f * M[row][k]) % p) + p) % p;
        }
      }
      where[col] = row;
      row++;
    }
    for (let i = row; i < N; i++) if (M[i][N] % p) return null;
    const x0 = new Array(N).fill(0);
    for (let col = 0; col < N; col++) if (where[col] >= 0) x0[col] = M[where[col]][N];
    const basis = [];
    for (let f = 0; f < N; f++) {
      if (where[f] >= 0) continue;
      const v = new Array(N).fill(0);
      v[f] = 1;
      for (let col = 0; col < N; col++) if (where[col] >= 0) v[col] = (p - M[where[col]][f]) % p;
      basis.push(v);
    }
    return { x0, basis };
  }

  /** Fewest presses that turn `board` fully off. Returns press-count vector or null. */
  function minSolution(board, n, m) {
    const A = matrix(n);
    const target = board.map((v) => (m - v) % m);
    const sol = solveMod(A, target, m);
    if (!sol) return null;
    const { x0, basis } = sol;
    const k = basis.length;
    const total = m ** k;
    let best = null, bestW = Infinity;
    const coef = new Array(k).fill(0);
    for (let t = 0; t < total; t++) {
      let tt = t;
      for (let i = 0; i < k; i++) { coef[i] = tt % m; tt = Math.floor(tt / m); }
      const x = x0.slice();
      for (let i = 0; i < k; i++) if (coef[i]) for (let j = 0; j < x.length; j++) x[j] = (x[j] + coef[i] * basis[i][j]) % m;
      const w = x.reduce((a, b) => a + b, 0);
      if (w < bestW) { bestW = w; best = x; }
    }
    return best;
  }
  const weight = (x) => x.reduce((a, b) => a + b, 0);

  function press(board, j, n, m) {
    const r = Math.floor(j / n), c = j % n;
    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) {
        const i = rr * n + cc;
        board[i] = (board[i] + 1) % m;
      }
    }
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    const { n, m } = cfg;
    const N = n * n;
    let best = null;
    for (let tries = 0; tries < 600; tries++) {
      const board = new Array(N).fill(0);
      for (let j = 0; j < N; j++) {
        if (rng.chance(cfg.p)) {
          const times = m === 3 ? 1 + rng.int(2) : 1;
          for (let t = 0; t < times; t++) press(board, j, n, m);
        }
      }
      if (board.every((v) => v === 0)) continue;
      const sol = minSolution(board, n, m);
      const par = weight(sol);
      const cand = { n, m, start: board, par };
      if (par >= cfg.par[0] && par <= cfg.par[1]) return cand;
      if (!best || Math.abs(par - cfg.par[0]) < Math.abs(best.par - cfg.par[0])) best = cand;
    }
    return best;
  }

  function starsFor(moves, par, hints) {
    let s = moves <= par ? 3 : moves <= par + Math.max(2, Math.ceil(par * 0.4)) ? 2 : 1;
    if (hints > 0) s = Math.min(s, 2);
    return s;
  }

  /* ---------- how-to figure: a 3×3 showing the plus-shaped flip ---------- */
  function figure() {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const on = (r === 1 || c === 1) && !(r !== 1 && c !== 1) ;
      const center = r === 1 && c === 1;
      cells.push(`<rect x="${6 + c * 34}" y="${6 + r * 34}" width="28" height="28" rx="7" class="${on ? 'f-on' : 'f-off'}"/>${center ? `<circle cx="${20 + c * 34}" cy="${20 + r * 34}" r="5" class="f-dot"/>` : ''}`);
    }
    return svg(`<svg viewBox="0 0 114 114" width="132" height="132" class="lo-fig" role="img" aria-label="Tapping the center tile flips it and the four tiles next to it">${cells.join('')}</svg>`);
  }

  BW.registerGame({
    id: 'lights-out',
    movesLabel: 'Moves',
    defaultDiff: 'easy',
    difficulties: [
      { id: 'easy', label: 'Easy', note: '4×4' },
      { id: 'medium', label: 'Medium', note: '5×5' },
      { id: 'hard', label: 'Hard', note: '6×6' },
      { id: 'expert', label: 'Expert', note: '5×5', desc: 'three colors' },
    ],
    howTo: {
      goal: 'Turn every light off.',
      figure,
      rules: [
        'Tapping a tile flips it <b>and</b> the tiles directly above, below, left and right of it.',
        'Order doesn’t matter, and tapping the same tile twice cancels out. Every board can be solved.',
        'On <b>Expert</b>, tiles cycle through three states: off → yellow (one dot) → coral (two dots) → off.',
      ],
      scoring: 'Par is the fewest taps that can solve the board. Match par for three stars. Using a hint caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const { n, m } = P;
      if (!ctx.state) ctx.state = { board: P.start.slice(), hist: [] };
      const S = ctx.state;
      let hintCell = -1;
      let locked = false;

      ctx.info('Par', String(P.par));

      const grid = h('div', { class: `lo-board${m === 3 ? ' tri' : ''}`, style: { '--n': n }, role: 'grid', 'aria-label': `Lights Out board, ${n} by ${n}` });
      const cells = [];
      for (let j = 0; j < n * n; j++) {
        const r = Math.floor(j / n), c = j % n;
        const b = h('button', { class: 'lo-cell cap', type: 'button', style: { '--d': r + c } });
        b.addEventListener('click', () => tap(j));
        cells.push(b);
        grid.append(b);
      }
      root.append(h('div', { class: 'lo-wrap' }, grid));

      function paint() {
        cells.forEach((b, j) => {
          const v = S.board[j];
          b.classList.toggle('v1', v === 1);
          b.classList.toggle('v2', v === 2);
          b.classList.toggle('hinted', j === hintCell);
          const r = Math.floor(j / n) + 1, c = (j % n) + 1;
          b.setAttribute('aria-label', `Row ${r}, column ${c}, ${v === 0 ? 'off' : v === 1 ? (m === 3 ? 'yellow' : 'on') : 'coral'}`);
        });
      }

      function ripple(j) {
        const r = Math.floor(j / n), c = j % n;
        for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) {
            const b = cells[rr * n + cc];
            b.classList.remove('ripple');
            void b.offsetWidth;
            b.classList.add('ripple');
          }
        }
      }

      function tap(j) {
        if (locked || ctx.status !== 'playing') return;
        const wasOn = S.board[j] !== 0;
        press(S.board, j, n, m);
        S.hist.push(j);
        if (j === hintCell) hintCell = -1;
        paint();
        ripple(j);
        ctx.sound(wasOn ? 'unflip' : 'flip');
        ctx.haptic('light');
        ctx.update({ moves: S.hist.length });
        if (S.board.every((v) => v === 0)) win();
      }

      function win() {
        locked = true;
        grid.classList.add('won');
        const moves = S.hist.length;
        const stars = starsFor(moves, P.par, ctx.hints);
        const note = moves <= P.par ? `You matched par: ${P.par} taps.` : `Par was ${P.par}. You took ${moves}.`;
        ctx.finish({ won: true, stars, note });
      }

      if (ctx.status !== 'playing') { locked = true; }
      paint();

      return {
        canUndo: () => S.hist.length > 0,
        undo() {
          const j = S.hist.pop();
          for (let t = 0; t < m - 1; t++) press(S.board, j, n, m);
          paint();
          ripple(j);
          ctx.update({ moves: S.hist.length });
        },
        restart() {
          S.board = P.start.slice();
          S.hist = [];
          hintCell = -1;
          paint();
          ctx.update({ moves: 0 });
        },
        canHint: () => hintCell < 0,
        hint() {
          const sol = minSolution(S.board, n, m);
          if (!sol) return false;
          const j = sol.findIndex((x) => x > 0);
          if (j < 0) return false;
          hintCell = j;
          paint();
          return true;
        },
        noHintText: 'Tap the highlighted tile first.',
        destroy() {},
      };
    },
  });

  // exposed for tests
  BW._lightsOut = { minSolution, press, generate, DIFFS };
})();
