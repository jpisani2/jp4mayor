/* Brainwave — Sudoku */
(() => {
  'use strict';
  const { h, svg } = BW.util;

  const DIFFS = {
    mini:     { N: 6, br: 2, bc: 3, tech: 1, minGivens: 12, par: 120 },
    easy:     { N: 9, br: 3, bc: 3, tech: 1, minGivens: 36, par: 300 },
    medium:   { N: 9, br: 3, bc: 3, tech: 1, minGivens: 27, par: 540 },
    hard:     { N: 9, br: 3, bc: 3, tech: 2, minGivens: 0,  par: 900 },
    fiendish: { N: 9, br: 3, bc: 3, tech: 3, minGivens: 0,  par: 1500 },
  };

  /* ---------- geometry ---------- */
  const geoCache = {};
  function geo(N, br, bc) {
    const key = N + ':' + br;
    if (geoCache[key]) return geoCache[key];
    const units = [];
    for (let r = 0; r < N; r++) units.push(Array.from({ length: N }, (_, c) => r * N + c));
    for (let c = 0; c < N; c++) units.push(Array.from({ length: N }, (_, r) => r * N + c));
    for (let R = 0; R < N / br; R++) for (let C = 0; C < N / bc; C++) {
      const u = [];
      for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) u.push((R * br + r) * N + C * bc + c);
      units.push(u);
    }
    const boxOf = (i) => Math.floor(Math.floor(i / N) / br) * (N / bc) + Math.floor((i % N) / bc);
    const peers = Array.from({ length: N * N }, (_, i) => {
      const s = new Set([...units[Math.floor(i / N)], ...units[N + (i % N)], ...units[2 * N + boxOf(i)]]);
      s.delete(i);
      return [...s];
    });
    return (geoCache[key] = { N, br, bc, units, peers, boxOf, full: (1 << N) - 1 });
  }
  const bit = (d) => 1 << (d - 1);
  const popc = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  const lowDigit = (x) => 31 - Math.clz32(x & -x) + 1;

  /* ---------- exact solver (counts up to `limit`) ---------- */
  function solve(grid, G, limit, rng) {
    const { N, full, boxOf } = G;
    const rows = new Int32Array(N), cols = new Int32Array(N), boxes = new Int32Array(N);
    const g = Int8Array.from(grid);
    for (let i = 0; i < N * N; i++) {
      if (!g[i]) continue;
      const b = bit(g[i]), r = Math.floor(i / N), c = i % N, x = boxOf(i);
      if ((rows[r] | cols[c] | boxes[x]) & b) return { count: 0 };
      rows[r] |= b; cols[c] |= b; boxes[x] |= b;
    }
    let count = 0, first = null;
    (function rec() {
      if (count >= limit) return;
      let best = -1, bestMask = 0, bestN = 99;
      for (let i = 0; i < N * N; i++) {
        if (g[i]) continue;
        const m = full & ~(rows[Math.floor(i / N)] | cols[i % N] | boxes[boxOf(i)]);
        const k = popc(m);
        if (k < bestN) { bestN = k; best = i; bestMask = m; if (k <= 1) break; }
      }
      if (best < 0) { count++; if (!first) first = Array.from(g); return; }
      if (!bestN) return;
      const ds = [];
      for (let d = 1; d <= N; d++) if (bestMask & bit(d)) ds.push(d);
      const order = rng ? rng.shuffle(ds) : ds;
      const r = Math.floor(best / N), c = best % N, x = boxOf(best);
      for (const d of order) {
        const b = bit(d);
        g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
        rec();
        g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
        if (count >= limit) return;
      }
    })();
    return { count, first };
  }

  /* ---------- human-style solver for grading ---------- */
  function logicSolve(grid, G, maxTech) {
    const { N, units, peers, full } = G;
    const g = Array.from(grid);
    const cand = new Int32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue;
      let m = full;
      for (const p of peers[i]) if (g[p]) m &= ~bit(g[p]);
      cand[i] = m;
    }
    let used = 0;
    const place = (i, d) => { g[i] = d; cand[i] = 0; const b = bit(d); for (const p of peers[i]) cand[p] &= ~b; };
    for (;;) {
      let progress = false;
      for (let i = 0; i < N * N; i++) {
        if (g[i]) continue;
        if (!cand[i]) return { solved: false, used, stuck: true };
        if (popc(cand[i]) === 1) { place(i, lowDigit(cand[i])); progress = true; }
      }
      if (progress) { used = Math.max(used, 1); continue; }
      for (const u of units) {
        for (let d = 1; d <= N; d++) {
          const b = bit(d);
          let pos = -1, cnt = 0, done = false;
          for (const i of u) { if (g[i] === d) { done = true; break; } if (!g[i] && cand[i] & b) { cnt++; pos = i; } }
          if (!done && cnt === 1) { place(pos, d); progress = true; }
        }
      }
      if (progress) { used = Math.max(used, 1); continue; }
      if (maxTech < 2) break;
      // pointing pairs / box-line reduction
      for (let ui = 2 * N; ui < 3 * N; ui++) {
        const box = units[ui];
        for (let d = 1; d <= N; d++) {
          const b = bit(d);
          const pos = box.filter((i) => !g[i] && cand[i] & b);
          if (pos.length < 2) continue;
          const r0 = Math.floor(pos[0] / N), c0 = pos[0] % N;
          if (pos.every((i) => Math.floor(i / N) === r0)) for (const i of units[r0]) if (!box.includes(i) && cand[i] & b) { cand[i] &= ~b; progress = true; }
          if (pos.every((i) => i % N === c0)) for (const i of units[N + c0]) if (!box.includes(i) && cand[i] & b) { cand[i] &= ~b; progress = true; }
        }
      }
      for (let ui = 0; ui < 2 * N; ui++) {
        const line = units[ui];
        for (let d = 1; d <= N; d++) {
          const b = bit(d);
          const pos = line.filter((i) => !g[i] && cand[i] & b);
          if (pos.length < 2) continue;
          const bx = G.boxOf(pos[0]);
          if (pos.every((i) => G.boxOf(i) === bx)) for (const i of units[2 * N + bx]) if (!line.includes(i) && cand[i] & b) { cand[i] &= ~b; progress = true; }
        }
      }
      // naked pairs
      for (const u of units) {
        const pairs = u.filter((i) => !g[i] && popc(cand[i]) === 2);
        for (let a = 0; a < pairs.length; a++) for (let c = a + 1; c < pairs.length; c++) {
          if (cand[pairs[a]] !== cand[pairs[c]]) continue;
          const m = cand[pairs[a]];
          for (const i of u) if (i !== pairs[a] && i !== pairs[c] && !g[i] && cand[i] & m) { cand[i] &= ~m; progress = true; }
        }
      }
      // hidden pairs
      for (const u of units) {
        const where = {};
        for (let d = 1; d <= N; d++) {
          const pos = u.filter((i) => !g[i] && cand[i] & bit(d));
          if (pos.length === 2) where[d] = pos;
        }
        const ds = Object.keys(where).map(Number);
        for (let a = 0; a < ds.length; a++) for (let c = a + 1; c < ds.length; c++) {
          const p = where[ds[a]], q = where[ds[c]];
          if (p[0] === q[0] && p[1] === q[1]) {
            const m = bit(ds[a]) | bit(ds[c]);
            for (const i of p) if (cand[i] & ~m) { cand[i] &= m; progress = true; }
          }
        }
      }
      if (progress) { used = Math.max(used, 2); continue; }
      break;
    }
    return { solved: g.every((v) => v), used };
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    const G = geo(cfg.N, cfg.br, cfg.bc);
    const N = cfg.N, NN = N * N;
    const t0 = Date.now();
    let fallback = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const sol = solve(new Array(NN).fill(0), G, 1, rng).first;
      const puz = sol.slice();
      let givens = NN;
      const order = rng.shuffle([...Array(Math.ceil(NN / 2)).keys()]);
      for (const i of order) {
        const j = NN - 1 - i;
        const pair = i === j ? [i] : [i, j];
        if (givens - pair.length < cfg.minGivens) continue;
        const saved = pair.map((k) => puz[k]);
        pair.forEach((k) => { puz[k] = 0; });
        let ok = solve(puz, G, 2).count === 1;
        if (ok && cfg.tech < 3) ok = logicSolve(puz, G, cfg.tech).solved;
        if (ok) givens -= pair.length;
        else pair.forEach((k, x) => { puz[k] = saved[x]; });
      }
      const cand = { N, br: cfg.br, bc: cfg.bc, sol, start: puz, par: cfg.par, givens };
      if (cfg.tech === 1) return cand;
      const needs = logicSolve(puz, G, 2);
      const tech = !needs.solved ? 3 : needs.used;
      if (tech === cfg.tech) return cand;
      if (!fallback || Math.abs(tech - cfg.tech) < fallback.d) fallback = { cand, d: Math.abs(tech - cfg.tech) };
      if (Date.now() - t0 > 2500) break;
    }
    return fallback.cand;
  }

  function figure() {
    return svg(`<svg viewBox="0 0 120 120" width="132" height="132" class="sd-fig" role="img" aria-label="A three by three box containing each digit from 1 to 9 once">
      <rect x="2" y="2" width="116" height="116" rx="12" class="bg"/>
      ${[1, 2].map((k) => `<path d="M${2 + k * 38.7} 4v112M4 ${2 + k * 38.7}h112" class="ln"/>`).join('')}
      ${[5, 3, 8, 1, 9, 6, 4, 7, 2].map((d, k) => `<text x="${21 + (k % 3) * 38.7}" y="${29 + Math.floor(k / 3) * 38.7}" text-anchor="middle">${d}</text>`).join('')}
    </svg>`);
  }

  BW.registerGame({
    id: 'sudoku',
    movesLabel: 'Moves',
    movesBest: false,
    defaultDiff: 'easy',
    difficulties: [
      { id: 'mini', label: 'Mini', note: '6×6', desc: 'a quick one' },
      { id: 'easy', label: 'Easy', note: '9×9' },
      { id: 'medium', label: 'Medium', note: '9×9' },
      { id: 'hard', label: 'Hard', note: '9×9', desc: 'needs pairs and pointing' },
      { id: 'fiendish', label: 'Fiendish', note: '9×9', desc: 'beyond the usual tricks' },
    ],
    howTo: {
      goal: 'Fill the grid so every row, column and box contains each digit exactly once.',
      figure,
      rules: [
        'Tap a square, then a number. Tap the same number again to clear it.',
        'Turn on <b>Notes</b> to pencil in small candidates. Placing a digit clears it from notes in the same row, column and box.',
        'Repeated digits in a row, column or box turn red.',
        'Mini uses a 6×6 grid with 2×3 boxes and the digits 1 to 6.',
      ],
      scoring: 'Finish within par time for three stars. Hints explain the next step but cap you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const G = geo(P.N, P.br, P.bc);
      const N = P.N, NN = N * N;
      if (!ctx.state) ctx.state = { v: P.start.slice(), notes: new Array(NN).fill(0), sel: P.start.indexOf(0), notesMode: false, hist: [] };
      const S = ctx.state;
      ctx.info('Par', BW.fmtPar(P.par));
      let hintIdx = -1;

      const wrap = h('div', { class: 'gm sd' });
      const area = h('div', { class: 'gm-area' });
      const grid = h('div', { class: 'sd-grid', role: 'grid', 'aria-label': `Sudoku, ${N} by ${N}` });
      const pad = h('div', { class: 'sd-pad', style: { '--n': N } });
      const bar = h('div', { class: 'sd-bar' });
      area.append(grid);
      wrap.append(area, bar, pad);
      root.append(wrap);

      const tracks = (k, every) => { const t = []; for (let i = 0; i < k; i++) { t.push('1fr'); if ((i + 1) % every === 0 && i < k - 1) t.push('var(--bsep)'); } return t.join(' '); };
      grid.style.gridTemplateColumns = tracks(N, P.bc);
      grid.style.gridTemplateRows = tracks(N, P.br);
      const cells = [];
      for (let i = 0; i < NN; i++) {
        const r = Math.floor(i / N), c = i % N;
        const given = P.start[i] !== 0;
        const b = h('button', { class: 'sd-cell' + (given ? ' given' : ''), type: 'button', role: 'gridcell', style: { gridColumn: c + Math.floor(c / P.bc) + 1, gridRow: r + Math.floor(r / P.br) + 1 } });
        b.addEventListener('click', () => { S.sel = i; ctx.sound('nav'); paint(); ctx.save(); });
        cells.push(b);
        grid.append(b);
      }
      function size() {
        const W = area.clientWidth, H = area.clientHeight;
        const s = Math.floor(Math.min(W, H, 540));
        grid.style.width = grid.style.height = s + 'px';
        grid.style.setProperty('--fs', Math.round((s / N) * 0.52) + 'px');
        grid.style.setProperty('--nfs', Math.max(8, Math.round((s / N) * (N === 9 ? 0.24 : 0.22))) + 'px');
      }
      const ro = new ResizeObserver(size);
      ro.observe(area);

      const padBtns = [];
      for (let d = 1; d <= N; d++) {
        const b = h('button', { class: 'sd-num cap', type: 'button' }, h('span', { class: 'sd-num-d' }, String(d)), h('span', { class: 'sd-num-left' }));
        b.addEventListener('click', () => input(d));
        padBtns.push(b);
        pad.append(b);
      }
      const notesBtn = h('button', { class: 'sd-tool cap', type: 'button' },
        svg('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>'),
        h('span', { class: 'sd-tool-l' }, 'Notes'), h('span', { class: 'sd-tool-s' }));
      notesBtn.addEventListener('click', () => { S.notesMode = !S.notesMode; ctx.sound('tap'); paint(); ctx.save(); });
      const eraseBtn = h('button', { class: 'sd-tool cap', type: 'button' }, BW.ui.icon('backspace'), h('span', { class: 'sd-tool-l' }, 'Erase'));
      eraseBtn.addEventListener('click', erase);
      bar.append(notesBtn, eraseBtn);

      const conflicts = () => {
        const bad = new Set();
        for (const u of G.units) {
          const seen = {};
          for (const i of u) if (S.v[i]) (seen[S.v[i]] = seen[S.v[i]] || []).push(i);
          for (const k in seen) if (seen[k].length > 1) seen[k].forEach((i) => bad.add(i));
        }
        return bad;
      };

      function paint() {
        const bad = conflicts();
        const sel = S.sel;
        const sv = sel >= 0 ? S.v[sel] : 0;
        const peers = sel >= 0 ? new Set(G.peers[sel]) : new Set();
        const counts = new Array(N + 1).fill(0);
        S.v.forEach((x) => { if (x) counts[x]++; });
        cells.forEach((b, i) => {
          const v = S.v[i];
          b.classList.toggle('sel', i === sel);
          b.classList.toggle('peer', peers.has(i));
          b.classList.toggle('same', !!sv && v === sv && i !== sel);
          b.classList.toggle('err', bad.has(i));
          b.classList.toggle('hinted', i === hintIdx);
          b.classList.toggle('user', !!v && P.start[i] === 0);
          b.innerHTML = '';
          if (v) b.append(h('span', { class: 'sd-v' }, String(v)));
          else if (S.notes[i]) {
            const ng = h('span', { class: 'sd-notes', style: { '--nc': N === 9 ? 3 : 3 } });
            for (let d = 1; d <= N; d++) ng.append(h('span', { class: (S.notes[i] & bit(d)) ? 'on' + (sv === d ? ' hl' : '') : '' }, (S.notes[i] & bit(d)) ? String(d) : ''));
            b.append(ng);
          }
          const r = Math.floor(i / N) + 1, c = (i % N) + 1;
          b.setAttribute('aria-label', `Row ${r}, column ${c}, ${v ? v : 'empty'}${P.start[i] ? ', given' : ''}${bad.has(i) ? ', conflicts' : ''}`);
        });
        padBtns.forEach((b, k) => {
          const left = N - counts[k + 1];
          b.classList.toggle('done', left <= 0);
          b.querySelector('.sd-num-left').textContent = left > 0 ? String(left) : '';
          b.setAttribute('aria-label', `${k + 1}${left > 0 ? `, ${left} left` : ', all placed'}${S.notesMode ? ' (note)' : ''}`);
        });
        notesBtn.classList.toggle('on', S.notesMode);
        notesBtn.setAttribute('aria-pressed', String(S.notesMode));
        notesBtn.querySelector('.sd-tool-s').textContent = S.notesMode ? 'On' : 'Off';
        pad.classList.toggle('notes', S.notesMode);
      }

      const snapshot = () => ({ v: S.v.slice(), notes: S.notes.slice() });
      const pushHist = () => { S.hist.push(snapshot()); if (S.hist.length > 200) S.hist.shift(); };

      function input(d) {
        if (ctx.status !== 'playing') return;
        const i = S.sel;
        if (i < 0 || P.start[i]) { ctx.sound('error'); return; }
        if (S.notesMode) {
          if (S.v[i]) { ctx.sound('error'); return; }
          pushHist();
          S.notes[i] ^= bit(d);
          ctx.sound('tap');
          paint();
          ctx.update();
          return;
        }
        pushHist();
        if (S.v[i] === d) { S.v[i] = 0; ctx.sound('remove'); }
        else {
          S.v[i] = d;
          S.notes[i] = 0;
          for (const p of G.peers[i]) S.notes[p] &= ~bit(d);
          ctx.sound('place');
          ctx.haptic('light');
        }
        if (i === hintIdx) hintIdx = -1;
        paint();
        ctx.update({ moves: ctx.moves + 1 });
        checkWin();
      }
      function erase() {
        if (ctx.status !== 'playing') return;
        const i = S.sel;
        if (i < 0 || P.start[i] || (!S.v[i] && !S.notes[i])) { ctx.sound('error'); return; }
        pushHist();
        S.v[i] = 0; S.notes[i] = 0;
        ctx.sound('remove');
        paint();
        ctx.update({ moves: ctx.moves + 1 });
      }
      function checkWin() {
        if (S.v.some((x) => !x)) return;
        if (S.v.some((x, i) => x !== P.sol[i])) {
          if (!conflicts().size) ctx.toast('Every square is filled, but something isn’t right.');
          return;
        }
        grid.classList.add('won');
        S.sel = -1;
        paint();
        ctx.finish({ won: true, stars: BW.timeStars(ctx.elapsed, P.par, ctx.hints), note: `Par time is ${BW.fmtPar(P.par)}.` });
      }

      const onKey = (e) => {
        if (BW.sheetsOpen() > 0 || ctx.status !== 'playing') return;
        const d = Number(e.key);
        if (d >= 1 && d <= N) { input(d); e.preventDefault(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(); return; }
        if (e.key === 'n' || e.key === 'N') { S.notesMode = !S.notesMode; paint(); return; }
        const mv = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (mv) {
          e.preventDefault();
          const cur = S.sel < 0 ? 0 : S.sel;
          let nx = cur + mv;
          if (e.key === 'ArrowLeft' && cur % N === 0) nx = cur + N - 1;
          if (e.key === 'ArrowRight' && cur % N === N - 1) nx = cur - N + 1;
          S.sel = (nx + NN) % NN;
          paint();
        }
      };
      document.addEventListener('keydown', onKey);

      paint();
      size();
      if (ctx.status !== 'playing') grid.classList.add('won');

      return {
        canUndo: () => S.hist.length > 0,
        undo() {
          const s = S.hist.pop();
          S.v = s.v; S.notes = s.notes;
          paint();
          ctx.update({ moves: ctx.moves + 1 });
        },
        restart() {
          S.v = P.start.slice();
          S.notes = new Array(NN).fill(0);
          S.hist = [];
          hintIdx = -1;
          paint();
          ctx.update({ moves: 0 });
        },
        hint() {
          let i = -1, d = 0, msg = '';
          const wrong = S.v.findIndex((x, k) => x && !P.start[k] && x !== P.sol[k]);
          if (wrong >= 0) {
            pushHist();
            S.v[wrong] = 0;
            S.sel = hintIdx = wrong;
            paint();
            ctx.toast('This square was wrong, so it’s been cleared.', { ms: 3200 });
            return true;
          }
          // naked single
          for (let k = 0; k < NN && i < 0; k++) {
            if (S.v[k]) continue;
            let m = G.full;
            for (const p of G.peers[k]) if (S.v[p]) m &= ~bit(S.v[p]);
            if (popc(m) === 1) { i = k; d = lowDigit(m); msg = `Only ${d} fits here: every other digit is already in its row, column or box.`; }
          }
          // hidden single
          if (i < 0) {
            const names = ['row', 'column', 'box'];
            outer: for (let ui = 0; ui < G.units.length; ui++) {
              const u = G.units[ui];
              for (let dd = 1; dd <= N; dd++) {
                if (u.some((k) => S.v[k] === dd)) continue;
                const pos = u.filter((k) => !S.v[k] && !G.peers[k].some((p) => S.v[p] === dd));
                if (pos.length === 1) { i = pos[0]; d = dd; msg = `This is the only place for ${dd} in its ${names[Math.floor(ui / N)]}.`; break outer; }
              }
            }
          }
          if (i < 0) {
            i = S.sel >= 0 && !S.v[S.sel] ? S.sel : S.v.findIndex((x) => !x);
            if (i < 0) return false;
            d = P.sol[i];
            msg = 'No single-step move here, so one square has been revealed.';
          }
          pushHist();
          S.v[i] = d;
          S.notes[i] = 0;
          for (const p of G.peers[i]) S.notes[p] &= ~bit(d);
          S.sel = hintIdx = i;
          paint();
          ctx.toast(msg, { ms: 3800 });
          setTimeout(checkWin, 50);
          return true;
        },
        destroy() { ro.disconnect(); document.removeEventListener('keydown', onKey); },
      };
    },
  });

  BW._sudoku = { generate, solve, logicSolve, geo, DIFFS };
})();
