/* Brainwave — Water Jugs */
(() => {
  'use strict';
  const { h } = BW.util;

  const DIFFS = {
    easy:   { jugs: 2, capRange: [2, 9],  tap: true,  par: [4, 6] },
    medium: { jugs: 2, capRange: [4, 13], tap: true,  par: [7, 10] },
    hard:   { jugs: 3, capRange: [2, 12], tap: true,  par: [6, 9] },
    expert: { jugs: 3, capRange: [3, 14], tap: false, par: [7, 12] },
  };

  function moves(a, caps, tap) {
    const out = [];
    for (let i = 0; i < a.length; i++) {
      if (tap && a[i] < caps[i]) out.push({ t: 'fill', i });
      if (tap && a[i] > 0) out.push({ t: 'empty', i });
      for (let j = 0; j < a.length; j++) if (i !== j && a[i] > 0 && a[j] < caps[j]) out.push({ t: 'pour', i, j });
    }
    return out;
  }
  function apply(a, m, caps) {
    const b = a.slice();
    if (m.t === 'fill') b[m.i] = caps[m.i];
    else if (m.t === 'empty') b[m.i] = 0;
    else { const x = Math.min(b[m.i], caps[m.j] - b[m.j]); b[m.i] -= x; b[m.j] += x; }
    return b;
  }
  /** Shortest list of moves from `a` to any jug holding `target`. */
  function bfs(a, caps, target, tap) {
    if (a.includes(target)) return [];
    const seen = new Map([[a.join(','), null]]);
    let q = [a];
    while (q.length) {
      const nq = [];
      for (const s of q) for (const m of moves(s, caps, tap)) {
        const t = apply(s, m, caps);
        const k = t.join(',');
        if (seen.has(k)) continue;
        seen.set(k, { from: s.join(','), m });
        if (t.includes(target)) {
          const path = [];
          let cur = k;
          while (seen.get(cur)) { path.unshift(seen.get(cur).m); cur = seen.get(cur).from; }
          return path;
        }
        nq.push(t);
      }
      q = nq;
    }
    return null;
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    for (let tries = 0; tries < 4000; tries++) {
      let caps = [];
      while (caps.length < cfg.jugs) {
        const c = rng.range(cfg.capRange[0], cfg.capRange[1]);
        if (!caps.includes(c)) caps.push(c);
      }
      caps.sort((x, y) => y - x);
      const start = cfg.tap ? caps.map(() => 0) : caps.map((c, i) => (i === 0 ? c : 0));
      const target = rng.range(1, caps[0] - 1);
      if (caps.includes(target) || start.includes(target)) continue;
      const path = bfs(start, caps, target, cfg.tap);
      if (path && path.length >= cfg.par[0] && path.length <= cfg.par[1]) return { caps, start, target, tap: cfg.tap, par: path.length };
    }
    return { caps: [5, 3], start: [0, 0], target: 4, tap: true, par: 6 };
  }

  const describe = (m, caps) => m.t === 'fill' ? `Fill the ${caps[m.i]} L jug.` : m.t === 'empty' ? `Empty the ${caps[m.i]} L jug.` : `Pour the ${caps[m.i]} L jug into the ${caps[m.j]} L jug.`;

  BW.registerGame({
    id: 'jugs',
    movesLabel: 'Moves',
    defaultDiff: 'easy',
    difficulties: [
      { id: 'easy', label: 'Easy', note: '2 jugs', desc: 'with a tap' },
      { id: 'medium', label: 'Medium', note: '2 jugs', desc: 'longer solutions' },
      { id: 'hard', label: 'Hard', note: '3 jugs', desc: 'with a tap' },
      { id: 'expert', label: 'Expert', note: '3 jugs', desc: 'no tap, no drain' },
    ],
    howTo: {
      goal: 'Get an exact amount of water into any jug.',
      rules: [
        'Jugs have no markings, so you can only fill one to the top, empty it, or pour one into another.',
        'Tap a jug to pick it up, then tap another jug to pour into it. Pouring stops when the first jug is empty or the second is full.',
        'With a jug picked up, use <b>Fill</b> or <b>Empty</b> below.',
        'On <b>Expert</b> there’s no tap and no drain: you start with the big jug full and can only pour between jugs.',
      ],
      scoring: 'Par is the fewest moves possible. Match it for three stars. A hint shows the next move and caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const caps = P.caps;
      if (!ctx.state) ctx.state = { a: P.start.slice(), sel: -1, hist: [] };
      const S = ctx.state;
      ctx.info('Par', String(P.par));
      let hint = null;
      const maxCap = Math.max(...caps);

      const wrap = h('div', { class: 'gm jg' });
      const goal = h('div', { class: 'jg-goal' }, h('span', { class: 'jg-goal-l' }, 'Measure exactly'), h('span', { class: 'jg-goal-v' }, `${P.target} L`));
      const row = h('div', { class: 'jg-row' });
      const acts = h('div', { class: 'jg-acts' });
      const fillBtn = h('button', { class: 'jg-act cap', type: 'button' }, 'Fill');
      const emptyBtn = h('button', { class: 'jg-act cap', type: 'button' }, 'Empty');
      fillBtn.addEventListener('click', () => doMove({ t: 'fill', i: S.sel }));
      emptyBtn.addEventListener('click', () => doMove({ t: 'empty', i: S.sel }));
      if (P.tap) acts.append(fillBtn, emptyBtn);
      else acts.append(h('p', { class: 'jg-note' }, 'No tap and no drain: pour between jugs only.'));
      wrap.append(goal, row, acts);
      root.append(wrap);

      const jugEls = caps.map((c, i) => {
        const water = h('span', { class: 'jg-water' });
        const amt = h('span', { class: 'jg-amt' });
        const body = h('span', { class: 'jg-body', style: { '--fill-h': `${(c / maxCap) * 100}%`, '--ticks': c } }, water);
        const b = h('button', { class: 'jg-jug', type: 'button' }, h('span', { class: 'jg-cap' }, `${c} L`), h('span', { class: 'jg-frame' }, body), amt);
        b.addEventListener('click', () => tapJug(i));
        row.append(b);
        return { b, water, amt };
      });

      function render() {
        jugEls.forEach((j, i) => {
          j.water.style.height = `${(S.a[i] / caps[i]) * 100}%`;
          j.amt.textContent = `${S.a[i]} L`;
          j.b.classList.toggle('sel', S.sel === i);
          j.b.classList.toggle('hit', S.a[i] === P.target);
          j.b.classList.toggle('hinted', !!hint && (hint.i === i || hint.j === i));
          j.b.setAttribute('aria-label', `${caps[i]} liter jug holding ${S.a[i]} liters${S.sel === i ? ', picked up' : ''}`);
        });
        fillBtn.disabled = S.sel < 0 || S.a[S.sel] === caps[S.sel] || ctx.status !== 'playing';
        emptyBtn.disabled = S.sel < 0 || S.a[S.sel] === 0 || ctx.status !== 'playing';
        fillBtn.classList.toggle('hinted', !!hint && hint.t === 'fill');
        emptyBtn.classList.toggle('hinted', !!hint && hint.t === 'empty');
      }
      function tapJug(i) {
        if (ctx.status !== 'playing') return;
        if (S.sel === -1) { S.sel = i; ctx.sound('tap'); }
        else if (S.sel === i) { S.sel = -1; ctx.sound('remove'); }
        else {
          const from = S.sel;
          if (S.a[from] === 0) { ctx.sound('error'); ctx.toast('That jug is empty.'); S.sel = i; render(); return; }
          if (S.a[i] === caps[i]) { ctx.sound('error'); ctx.toast('That jug is already full.'); return; }
          return doMove({ t: 'pour', i: from, j: i });
        }
        render(); ctx.save();
      }
      function doMove(m) {
        if (ctx.status !== 'playing' || m.i < 0) return;
        S.hist.push(S.a.slice());
        S.a = apply(S.a, m, caps);
        if (m.t !== 'pour') S.sel = m.i; else S.sel = -1;
        hint = null;
        ctx.sound(m.t === 'empty' ? 'unflip' : 'flip');
        ctx.haptic('light');
        render();
        ctx.update({ moves: S.hist.length });
        if (S.a.includes(P.target)) {
          S.sel = -1; render();
          const n = S.hist.length;
          ctx.finish({ won: true, stars: BW.moveStars(n, P.par, ctx.hints, 3), note: n <= P.par ? `${n} moves: the fewest possible.` : `The fewest possible is ${P.par} moves.` });
        }
      }
      render();

      return {
        canUndo: () => S.hist.length > 0,
        undo() { S.a = S.hist.pop(); S.sel = -1; hint = null; render(); ctx.update({ moves: S.hist.length }); },
        restart() { S.a = P.start.slice(); S.sel = -1; S.hist = []; hint = null; render(); ctx.update({ moves: 0 }); },
        hint() {
          const path = bfs(S.a, caps, P.target, P.tap);
          if (!path || !path.length) return false;
          hint = path[0];
          S.sel = hint.i;
          render();
          ctx.toast(describe(hint, caps), { ms: 3200 });
          return true;
        },
        destroy() {},
      };
    },
  });

  BW._jugs = { bfs, generate, DIFFS };
})();
