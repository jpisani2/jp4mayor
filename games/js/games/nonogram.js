/* Brainwave — Nonogram */
(() => {
  'use strict';
  const { h, svg } = BW.util;

  const DIFFS = {
    easy:   { n: 5,  par: 75,  density: [0.5, 0.68] },
    medium: { n: 8,  par: 240, density: [0.5, 0.64] },
    hard:   { n: 10, par: 420, density: [0.48, 0.62] },
    expert: { n: 12, par: 720, density: [0.46, 0.6] },
  };

  const cluesOf = (line) => {
    const out = [];
    let run = 0;
    for (const v of line) { if (v === 1) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out;
  };
  const sameClue = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* ---------- line solver: -1 unknown, 0 empty, 1 filled ---------- */
  function solveLine(clue, line) {
    const n = line.length, k = clue.length;
    const memo = new Map();
    const fits = (i, len) => {
      if (i + len > n) return false;
      for (let t = i; t < i + len; t++) if (line[t] === 0) return false;
      return i + len === n || line[i + len] !== 1;
    };
    function ok(i, j) {
      const key = i * 64 + j;
      if (memo.has(key)) return memo.get(key);
      let res = false;
      if (j === k) {
        res = true;
        for (let t = i; t < n; t++) if (line[t] === 1) { res = false; break; }
      } else {
        if (i < n && line[i] !== 1 && ok(i + 1, j)) res = true;
        if (!res && fits(i, clue[j]) && ok(Math.min(n, i + clue[j] + 1), j + 1)) res = true;
      }
      memo.set(key, res);
      return res;
    }
    if (!ok(0, 0)) return null;
    const canF = new Array(n).fill(false), canE = new Array(n).fill(false);
    const seen = new Set();
    (function mark(i, j) {
      const key = i * 64 + j;
      if (seen.has(key)) return;
      seen.add(key);
      if (j === k) { for (let t = i; t < n; t++) canE[t] = true; return; }
      if (i < n && line[i] !== 1 && ok(i + 1, j)) { canE[i] = true; mark(i + 1, j); }
      const len = clue[j];
      if (fits(i, len) && ok(Math.min(n, i + len + 1), j + 1)) {
        for (let t = i; t < i + len; t++) canF[t] = true;
        if (i + len < n) canE[i + len] = true;
        mark(Math.min(n, i + len + 1), j + 1);
      }
    })(0, 0);
    return line.map((v, t) => (canF[t] && !canE[t] ? 1 : canE[t] && !canF[t] ? 0 : v));
  }

  /** Solve by line logic alone. Returns the grid (may contain -1 if stuck) or null on contradiction. */
  function lineSolve(rows, cols, n) {
    const g = new Array(n * n).fill(-1);
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < n; r++) {
        const line = g.slice(r * n, r * n + n);
        const res = solveLine(rows[r], line);
        if (!res) return null;
        for (let c = 0; c < n; c++) if (res[c] !== line[c]) { g[r * n + c] = res[c]; changed = true; }
      }
      for (let c = 0; c < n; c++) {
        const line = Array.from({ length: n }, (_, r) => g[r * n + c]);
        const res = solveLine(cols[c], line);
        if (!res) return null;
        for (let r = 0; r < n; r++) if (res[r] !== line[r]) { g[r * n + c] = res[r]; changed = true; }
      }
    }
    return g;
  }

  function makeImage(n, rng, density) {
    let g = Array.from({ length: n * n }, () => (rng.chance(0.56) ? 1 : 0));
    if (n >= 8) {
      // one smoothing pass turns noise into blobs
      const s = g.slice();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        let cnt = 0, tot = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) { tot++; cnt += g[rr * n + cc]; }
        }
        s[r * n + c] = cnt * 2 > tot ? 1 : cnt * 2 === tot ? g[r * n + c] : 0;
      }
      g = s;
    }
    if (rng.chance(0.65)) {
      for (let r = 0; r < n; r++) for (let c = 0; c < Math.floor(n / 2); c++) g[r * n + (n - 1 - c)] = g[r * n + c];
    }
    const d = g.reduce((a, b) => a + b, 0) / (n * n);
    return d >= density[0] && d <= density[1] ? g : null;
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    const n = cfg.n;
    for (let tries = 0; tries < 3000; tries++) {
      const img = makeImage(n, rng, cfg.density);
      if (!img) continue;
      const rows = [], cols = [];
      for (let r = 0; r < n; r++) rows.push(cluesOf(img.slice(r * n, r * n + n)));
      for (let c = 0; c < n; c++) cols.push(cluesOf(Array.from({ length: n }, (_, r) => img[r * n + c])));
      const solved = lineSolve(rows, cols, n);
      if (solved && solved.every((v) => v !== -1)) return { n, sol: img, rows, cols, par: cfg.par };
    }
    throw new Error('nonogram generation failed');
  }

  function figure() {
    return svg(`<svg viewBox="0 0 150 96" width="190" height="122" class="ng-fig" role="img" aria-label="A row with the clue 3 1 has a run of three filled squares, a gap, then one filled square">
      <text x="6" y="56" class="t">3 1</text>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${40 + i * 18}" y="40" width="16" height="16" rx="3" class="${[0, 1, 2, 4].includes(i) ? 'f' : 'e'}"/>`).join('')}
      <path d="M95 46l6 6M101 46l-6 6" class="x"/>
      <path d="M40 66h52" class="u"/><path d="M112 66h16" class="u"/>
      <text x="62" y="82" class="s">3</text><text x="116" y="82" class="s">1</text>
    </svg>`);
  }

  BW.registerGame({
    id: 'nonogram',
    movesLabel: 'Moves',
    movesBest: false,
    defaultDiff: 'easy',
    difficulties: [
      { id: 'easy', label: 'Easy', note: '5×5' },
      { id: 'medium', label: 'Medium', note: '8×8' },
      { id: 'hard', label: 'Hard', note: '10×10' },
      { id: 'expert', label: 'Expert', note: '12×12' },
    ],
    howTo: {
      goal: 'Fill in squares to reveal a hidden picture.',
      figure,
      rules: [
        'The numbers beside each row and above each column list its runs of filled squares, in order.',
        '<b>3 1</b> means a run of three, at least one gap, then a run of one.',
        'Use <b>Mark</b> to put an × on squares you know are empty. Drag across a line to fill or mark several at once.',
        'Every puzzle can be solved by logic alone, no guessing needed. A clue fades when its line matches.',
      ],
      scoring: 'Finish within par time for three stars. A hint fixes one square but caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const n = P.n;
      if (!ctx.state) ctx.state = { cells: new Array(n * n).fill(0), hist: [], mode: 'fill' };
      const S = ctx.state;
      ctx.info('Par', BW.fmtPar(P.par));
      let hintIdx = -1;

      const maxR = Math.max(...P.rows.map((r) => Math.max(1, r.length)));
      const maxC = Math.max(...P.cols.map((c) => Math.max(1, c.length)));
      const sep = (i) => Math.floor(i / 5);
      const nSep = Math.floor((n - 1) / 5);

      const wrap = h('div', { class: 'gm ng' });
      const area = h('div', { class: 'gm-area' });
      const grid = h('div', { class: 'ng-grid', role: 'grid', 'aria-label': `Nonogram, ${n} by ${n}` });
      const modeBar = h('div', { class: 'ng-modes' });
      area.append(grid);
      wrap.append(area, modeBar);
      root.append(wrap);

      // grid tracks: clue column + cells with thin separator tracks every 5
      const colTracks = ['auto'];
      for (let c = 0; c < n; c++) { colTracks.push('var(--cs)'); if (c % 5 === 4 && c < n - 1) colTracks.push('var(--sep)'); }
      grid.style.gridTemplateColumns = colTracks.join(' ');
      const rowTracks = ['auto'];
      for (let r = 0; r < n; r++) { rowTracks.push('var(--cs)'); if (r % 5 === 4 && r < n - 1) rowTracks.push('var(--sep)'); }
      grid.style.gridTemplateRows = rowTracks.join(' ');
      const gc = (c) => c + sep(c) + 2;

      const colClueEls = P.cols.map((cl, c) => {
        const e = h('div', { class: 'ng-cc', style: { gridColumn: gc(c), gridRow: 1 } }, (cl.length ? cl : [0]).map((x) => h('span', null, String(x))));
        grid.append(e);
        return e;
      });
      const rowClueEls = P.rows.map((cl, r) => {
        const e = h('div', { class: 'ng-rc', style: { gridColumn: 1, gridRow: gc(r) } }, (cl.length ? cl : [0]).map((x) => h('span', null, String(x))));
        grid.append(e);
        return e;
      });
      const cells = [];
      for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n), c = i % n;
        const e = h('div', { class: 'ng-cell', role: 'gridcell', 'data-i': i, style: { gridColumn: gc(c), gridRow: gc(r) } });
        cells.push(e);
        grid.append(e);
      }

      function size() {
        const W = area.clientWidth, H = area.clientHeight;
        if (!W || !H) return;
        const sepPx = 3;
        const csW = (W - 10 - nSep * sepPx) / (n + maxR * 0.62);
        const csH = (H - 10 - nSep * sepPx) / (n + maxC * 0.66);
        const cs = Math.max(14, Math.min(54, Math.floor(Math.min(csW, csH))));
        grid.style.setProperty('--cs', cs + 'px');
        grid.style.setProperty('--sep', sepPx + 'px');
        grid.style.setProperty('--cf', Math.max(10, Math.min(19, Math.round(cs * 0.5))) + 'px');
      }
      const ro = new ResizeObserver(size);
      ro.observe(area);

      function paint() {
        cells.forEach((e, i) => {
          e.classList.toggle('on', S.cells[i] === 1);
          e.classList.toggle('x', S.cells[i] === 2);
          e.classList.toggle('hinted', i === hintIdx);
          const r = Math.floor(i / n) + 1, c = (i % n) + 1;
          e.setAttribute('aria-label', `Row ${r}, column ${c}, ${S.cells[i] === 1 ? 'filled' : S.cells[i] === 2 ? 'marked empty' : 'blank'}`);
        });
        for (let r = 0; r < n; r++) {
          const line = S.cells.slice(r * n, r * n + n);
          rowClueEls[r].classList.toggle('done', sameClue(cluesOf(line), P.rows[r]));
        }
        for (let c = 0; c < n; c++) {
          const line = Array.from({ length: n }, (_, r) => S.cells[r * n + c]);
          colClueEls[c].classList.toggle('done', sameClue(cluesOf(line), P.cols[c]));
        }
      }

      function renderModes() {
        modeBar.innerHTML = '';
        [['fill', 'Fill', '<rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor"/>'], ['mark', 'Mark', '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>']].forEach(([m, label, ic]) => {
          const b = h('button', { class: 'ng-mode cap' + (S.mode === m ? ' on' : ''), type: 'button', 'aria-pressed': String(S.mode === m) }, svg(`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${ic}</svg>`), h('span', null, label));
          b.addEventListener('click', () => { if (S.mode !== m) { S.mode = m; ctx.sound('tap'); renderModes(); ctx.save(); } });
          modeBar.append(b);
        });
      }

      /* ----- painting with pointer: one stroke = one move ----- */
      let stroke = null;
      const cellAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el && el.classList && el.classList.contains('ng-cell') && grid.contains(el) ? Number(el.dataset.i) : -1;
      };
      function apply(i) {
        if (stroke.done.has(i)) return;
        if (stroke.axis === 'r' && Math.floor(i / n) !== stroke.r0) return;
        if (stroke.axis === 'c' && i % n !== stroke.c0) return;
        const cur = S.cells[i];
        let next = cur;
        if (stroke.action === 'fill' && cur === 0) next = 1;
        else if (stroke.action === 'mark' && cur === 0) next = 2;
        else if (stroke.action === 'clearFill' && cur === 1) next = 0;
        else if (stroke.action === 'clearMark' && cur === 2) next = 0;
        stroke.done.add(i);
        if (next === cur) return;
        S.cells[i] = next;
        stroke.changes.push([i, cur, next]);
        if (i === hintIdx) hintIdx = -1;
        ctx.sound(next === 1 ? 'place' : next === 2 ? 'tap' : 'remove');
        ctx.haptic('light');
        paint();
      }
      grid.addEventListener('pointerdown', (e) => {
        if (ctx.status !== 'playing') return;
        const i = cellAt(e.clientX, e.clientY);
        if (i < 0) return;
        e.preventDefault();
        const cur = S.cells[i];
        const action = S.mode === 'fill' ? (cur === 1 ? 'clearFill' : cur === 2 ? 'clearMark' : 'fill') : cur === 2 ? 'clearMark' : cur === 1 ? 'clearFill' : 'mark';
        stroke = { action, r0: Math.floor(i / n), c0: i % n, axis: null, done: new Set(), changes: [], pid: e.pointerId };
        try { grid.setPointerCapture(e.pointerId); } catch {}
        apply(i);
      });
      grid.addEventListener('pointermove', (e) => {
        if (!stroke || e.pointerId !== stroke.pid) return;
        const i = cellAt(e.clientX, e.clientY);
        if (i < 0) return;
        if (!stroke.axis) {
          const r = Math.floor(i / n), c = i % n;
          if (r === stroke.r0 && c !== stroke.c0) stroke.axis = 'r';
          else if (c === stroke.c0 && r !== stroke.r0) stroke.axis = 'c';
          else return;
        }
        apply(i);
      });
      const end = () => {
        if (!stroke) return;
        const st = stroke;
        stroke = null;
        if (!st.changes.length) return;
        S.hist.push(st.changes);
        if (S.hist.length > 300) S.hist.shift();
        ctx.update({ moves: ctx.moves + 1 });
        checkWin();
      };
      grid.addEventListener('pointerup', end);
      grid.addEventListener('pointercancel', end);

      function checkWin() {
        for (let r = 0; r < n; r++) if (!sameClue(cluesOf(S.cells.slice(r * n, r * n + n)), P.rows[r])) return;
        for (let c = 0; c < n; c++) if (!sameClue(cluesOf(Array.from({ length: n }, (_, r) => S.cells[r * n + c])), P.cols[c])) return;
        grid.classList.add('won');
        ctx.finish({ won: true, stars: BW.timeStars(ctx.elapsed, P.par, ctx.hints), note: `Par time is ${BW.fmtPar(P.par)}.` });
      }

      renderModes();
      paint();
      size();
      if (ctx.status !== 'playing') grid.classList.add('won');

      return {
        canUndo: () => S.hist.length > 0,
        undo() {
          const ch = S.hist.pop();
          for (let k = ch.length - 1; k >= 0; k--) S.cells[ch[k][0]] = ch[k][1];
          paint();
          ctx.update({ moves: Math.max(0, ctx.moves - 1) });
        },
        restart() {
          S.cells = new Array(n * n).fill(0);
          S.hist = [];
          hintIdx = -1;
          paint();
          ctx.update({ moves: 0 });
        },
        hint() {
          // 1) a wrongly filled square, 2) an unfilled square that should be filled, 3) a wrongly marked one
          let pick = -1, msg = '';
          const wrongFill = [], missing = [];
          for (let i = 0; i < n * n; i++) {
            if (S.cells[i] === 1 && P.sol[i] === 0) wrongFill.push(i);
            else if (S.cells[i] !== 1 && P.sol[i] === 1) missing.push(i);
          }
          if (wrongFill.length) { pick = wrongFill[0]; S.cells[pick] = 2; msg = 'That square should be empty.'; }
          else if (missing.length) { pick = missing[Math.floor(Math.random() * missing.length)]; S.cells[pick] = 1; msg = 'Filled in one square.'; }
          if (pick < 0) return false;
          hintIdx = pick;
          paint();
          ctx.toast(msg);
          setTimeout(() => { if (hintIdx === pick) { hintIdx = -1; paint(); } }, 1600);
          setTimeout(checkWin, 50);
          return true;
        },
        destroy() { ro.disconnect(); },
      };
    },
  });

  BW._nonogram = { generate, lineSolve, cluesOf, DIFFS };
})();
