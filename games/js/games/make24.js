/* Brainwave — Make 24 */
(() => {
  'use strict';
  const { h } = BW.util;

  /* ---------- exact fractions ---------- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const OPS = {
    '+': (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d),
    '−': (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d),
    '×': (a, b) => R(a.n * b.n, a.d * b.d),
    '÷': (a, b) => (b.n === 0 ? null : R(a.n * b.d, a.d * b.n)),
  };
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const fmt = (x) => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`);

  /** Count solution paths; return the first path's opening step for hints. */
  function solve(items, target, limit = 5000) {
    let count = 0, first = null, intPath = false;
    (function rec(list, path, allInt) {
      if (count >= limit) return;
      if (list.length === 1) {
        if (eq(list[0].v, target)) { count++; if (!first) first = path; if (allInt) intPath = true; }
        return;
      }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        const rest = list.filter((_, k) => k !== i && k !== j);
        const tries = [[A, '+', B], [A, '×', B], [A, '−', B], [B, '−', A], [A, '÷', B], [B, '÷', A]];
        for (const [x, op, y] of tries) {
          const r = OPS[op](x.v, y.v);
          if (!r) continue;
          rec(rest.concat([{ v: r, id: -1 }]), path.concat([{ a: x.id, op, b: y.id, r }]), allInt && r.d === 1 && r.n >= 0);
        }
      }
    })(items, [], true);
    return { count, first, intPath };
  }

  const DIFFS = {
    easy:   { max: 9,  target: () => 24, ok: (s) => s.count >= 30 && s.intPath, par: 40 },
    medium: { max: 9,  target: () => 24, ok: (s) => s.count >= 3 && s.count <= 16, par: 75 },
    hard:   { max: 13, target: () => 24, ok: (s) => s.count >= 1 && s.count <= 6, par: 150 },
    expert: { max: 13, target: (rng) => rng.range(25, 60), ok: (s) => s.count >= 1 && s.count <= 8, par: 150 },
  };

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    for (let tries = 0; tries < 5000; tries++) {
      const nums = Array.from({ length: 4 }, () => rng.range(1, cfg.max));
      const target = cfg.target(rng);
      const s = solve(nums.map((x, i) => ({ v: R(x), id: i })), R(target));
      if (cfg.ok(s)) return { nums, target, par: cfg.par, paths: s.count };
    }
    return { nums: [3, 8, 3, 8], target: 24, par: cfg.par, paths: 1 };
  }

  const fracEl = (x) => x.d === 1
    ? h('span', { class: 'm24-int' }, String(x.n))
    : h('span', { class: 'm24-frac', 'aria-label': `${x.n} over ${x.d}` }, h('span', null, String(x.n)), h('span', { class: 'bar' }), h('span', null, String(x.d)));

  BW.registerGame({
    id: 'make24',
    movesLabel: 'Steps',
    movesBest: false,
    defaultDiff: 'easy',
    difficulties: [
      { id: 'easy', label: 'Easy', note: 'Target 24', desc: 'numbers 1–9, many answers' },
      { id: 'medium', label: 'Medium', note: 'Target 24', desc: 'numbers 1–9, few answers' },
      { id: 'hard', label: 'Hard', note: 'Target 24', desc: 'numbers 1–13, may need fractions' },
      { id: 'expert', label: 'Expert', note: 'New targets', desc: 'any target from 25 to 60' },
    ],
    howTo: {
      goal: 'Combine all four numbers to hit the target.',
      rules: [
        'Tap a number, an operation, then another number. The two combine into one new number.',
        'Keep going until one number is left. Use every number exactly once.',
        'Fractions are allowed along the way, as long as the final answer is exact. For example, 8 ÷ 3 makes ⁸⁄₃.',
        'Undo steps back one combination. Restart puts the four numbers back.',
      ],
      scoring: 'Solve within par time for three stars. A hint shows the next combination and caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const target = R(P.target);
      if (!ctx.state) ctx.state = { tiles: P.nums.map((x, i) => ({ id: i, v: R(x) })), next: 4, sel: -1, op: null, steps: [], hist: [] };
      const S = ctx.state;
      ctx.info('Par', BW.fmtPar(P.par));
      let hint = null;

      const wrap = h('div', { class: 'gm m24' });
      const head = h('div', { class: 'm24-target' }, h('span', { class: 'm24-make' }, 'Make'), h('span', { class: 'm24-goal' }, String(P.target)));
      const log = h('div', { class: 'm24-log', 'aria-live': 'polite' });
      const tilesEl = h('div', { class: 'm24-tiles' });
      const opsEl = h('div', { class: 'm24-ops' });
      wrap.append(head, log, tilesEl, opsEl);
      root.append(wrap);

      const OP_NAMES = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' };
      function render() {
        log.innerHTML = '';
        if (!S.steps.length) log.append(h('span', { class: 'm24-log-empty' }, 'Use all four numbers'));
        S.steps.forEach((t) => log.append(h('span', { class: 'm24-step' }, t)));
        tilesEl.innerHTML = '';
        S.tiles.forEach((t, k) => {
          if (!t) { tilesEl.append(h('span', { class: 'm24-slot' })); return; }
          const b = h('button', {
            class: 'm24-tile cap' + (S.sel === k ? ' sel' : '') + (hint && (hint.a === t.id || hint.b === t.id) ? ' hinted' : ''),
            type: 'button', 'aria-label': fmt(t.v), 'aria-pressed': String(S.sel === k),
          }, fracEl(t.v));
          b.addEventListener('click', () => tapTile(k));
          tilesEl.append(b);
        });
        opsEl.innerHTML = '';
        Object.keys(OPS).forEach((op) => {
          const b = h('button', { class: 'm24-op cap' + (S.op === op ? ' on' : '') + (hint && hint.op === op ? ' hinted' : ''), type: 'button', 'aria-label': OP_NAMES[op], 'aria-pressed': String(S.op === op) }, op);
          b.addEventListener('click', () => tapOp(op));
          opsEl.append(b);
        });
      }
      function tapTile(k) {
        if (ctx.status !== 'playing') return;
        if (S.sel === -1) { S.sel = k; ctx.sound('tap'); }
        else if (S.sel === k) { S.sel = -1; S.op = null; ctx.sound('remove'); }
        else if (!S.op) { S.sel = k; ctx.sound('tap'); }
        else return combine(S.sel, S.op, k);
        render(); ctx.save();
      }
      function tapOp(op) {
        if (ctx.status !== 'playing') return;
        if (S.sel === -1) { ctx.sound('error'); ctx.toast('Pick a number first.'); return; }
        S.op = S.op === op ? null : op;
        ctx.sound('tap');
        render(); ctx.save();
      }
      function combine(i, op, j) {
        const a = S.tiles[i], b = S.tiles[j];
        const r = OPS[op](a.v, b.v);
        if (!r) { ctx.sound('error'); ctx.toast('You can’t divide by zero.'); return; }
        S.hist.push(JSON.stringify({ tiles: S.tiles, steps: S.steps, next: S.next }));
        S.tiles[j] = { id: S.next++, v: r };
        S.tiles[i] = null;
        S.steps = S.steps.concat([`${fmt(a.v)} ${op} ${fmt(b.v)} = ${fmt(r)}`]);
        S.sel = j; S.op = null;
        hint = null;
        ctx.sound('place');
        ctx.haptic('light');
        const left = S.tiles.filter(Boolean);
        render();
        ctx.update({ moves: S.hist.length });
        if (left.length === 1) {
          if (eq(left[0].v, target)) {
            S.sel = -1; render();
            tilesEl.classList.add('won');
            ctx.finish({ won: true, stars: BW.timeStars(ctx.elapsed, P.par, ctx.hints), note: S.steps.join('   ·   ') });
          } else {
            ctx.sound('error');
            tilesEl.classList.remove('shake'); void tilesEl.offsetWidth; tilesEl.classList.add('shake');
            ctx.toast(`That makes ${fmt(left[0].v)}, not ${P.target}. Undo and try another way.`, { ms: 3400 });
          }
        }
      }
      render();

      return {
        canUndo: () => S.hist.length > 0,
        undo() {
          const s = JSON.parse(S.hist.pop());
          S.tiles = s.tiles; S.steps = s.steps; S.next = s.next; S.sel = -1; S.op = null;
          hint = null;
          render();
          ctx.update({ moves: S.hist.length });
        },
        restart() {
          S.tiles = P.nums.map((x, i) => ({ id: i, v: R(x) })); S.next = 4; S.sel = -1; S.op = null; S.steps = []; S.hist = [];
          hint = null;
          render();
          ctx.update({ moves: 0 });
        },
        hint() {
          const items = S.tiles.filter(Boolean);
          let s = solve(items, target, 1);
          let msg = '';
          if (!s.count) {
            S.tiles = P.nums.map((x, i) => ({ id: i, v: R(x) })); S.next = 4; S.steps = []; S.hist = [];
            s = solve(S.tiles.filter(Boolean), target, 1);
            msg = `That path can’t reach ${P.target}, so the numbers are back. `;
            ctx.update({ moves: 0 });
          }
          const st = s.first[0];
          const byId = (id) => S.tiles.findIndex((t) => t && t.id === id);
          hint = { a: st.a, b: st.b, op: st.op };
          S.sel = byId(st.a); S.op = st.op;
          render();
          const A = S.tiles[byId(st.a)].v, B = S.tiles[byId(st.b)].v;
          ctx.toast(`${msg}Try ${fmt(A)} ${st.op} ${fmt(B)}.`, { ms: 3600 });
          return true;
        },
        destroy() {},
      };
    },
  });

  BW._make24 = { solve, generate, R, DIFFS };
})();
