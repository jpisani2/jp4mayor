/* Brainwave — River Crossing (level pack) */
(() => {
  'use strict';
  const { h } = BW.util;

  // Each entity: id, name, glyph, pilot (can row), mins (bridge levels), tint (pairing color)
  const LEVELS = [
    {
      id: 'l1', title: 'Wolf, goat & cabbage', cap: 2,
      intro: 'Only the farmer can row. Left alone, the wolf eats the goat and the goat eats the cabbage.',
      ents: [
        { id: 'F', name: 'Farmer', glyph: '🧑‍🌾', pilot: true },
        { id: 'W', name: 'Wolf', glyph: '🐺' },
        { id: 'G', name: 'Goat', glyph: '🐐' },
        { id: 'C', name: 'Cabbage', glyph: '🥬' },
      ],
      unsafe(has) {
        if (has.F) return null;
        if (has.W && has.G) return 'The wolf would eat the goat.';
        if (has.G && has.C) return 'The goat would eat the cabbage.';
        return null;
      },
    },
    {
      id: 'l2', title: 'Campers & bears', cap: 2,
      intro: 'Anyone can row. If bears ever outnumber campers on a bank where campers are, things go badly.',
      ents: [
        ...[1, 2, 3].map((k) => ({ id: 'P' + k, name: 'Camper', glyph: '🧑', pilot: true })),
        ...[1, 2, 3].map((k) => ({ id: 'B' + k, name: 'Bear', glyph: '🐻', pilot: true })),
      ],
      unsafe: bearsRule,
    },
    {
      id: 'l3', title: 'The night bridge', cap: 2, bridge: true, limit: 17,
      intro: 'Four people must cross a narrow bridge at night with one torch. At most two cross at once, moving at the slower person’s pace, and someone has to bring the torch back.',
      ents: [
        { id: 'A', name: 'Ana', glyph: '🏃‍♀️', pilot: true, mins: 1 },
        { id: 'B', name: 'Ben', glyph: '🚶', pilot: true, mins: 2 },
        { id: 'C', name: 'Cal', glyph: '🧓', pilot: true, mins: 5 },
        { id: 'D', name: 'Dot', glyph: '🐢', pilot: true, mins: 10 },
      ],
      unsafe: () => null,
    },
    {
      id: 'l4', title: 'Stars & bodyguards', cap: 2, checkBoat: true,
      intro: 'Three film stars, each with a bodyguard. No star may be with another star’s bodyguard unless their own bodyguard is there too, on the banks or in the boat.',
      ents: [
        { id: 'S1', name: 'Star', glyph: '🌟', pilot: true, tint: 1 },
        { id: 'G1', name: 'Guard', glyph: '🕶️', pilot: true, tint: 1 },
        { id: 'S2', name: 'Star', glyph: '🌟', pilot: true, tint: 2 },
        { id: 'G2', name: 'Guard', glyph: '🕶️', pilot: true, tint: 2 },
        { id: 'S3', name: 'Star', glyph: '🌟', pilot: true, tint: 3 },
        { id: 'G3', name: 'Guard', glyph: '🕶️', pilot: true, tint: 3 },
      ],
      unsafe(has) {
        for (const k of [1, 2, 3]) {
          if (!has['S' + k] || has['G' + k]) continue;
          if ([1, 2, 3].some((j) => j !== k && has['G' + j])) return 'A star would be left with another star’s bodyguard.';
        }
        return null;
      },
    },
    {
      id: 'l5', title: 'More campers, more bears', cap: 3,
      intro: 'Five campers and five bears, and a boat for three. The same rule: bears may never outnumber campers where campers are.',
      ents: [
        ...[1, 2, 3, 4, 5].map((k) => ({ id: 'P' + k, name: 'Camper', glyph: '🧑', pilot: true })),
        ...[1, 2, 3, 4, 5].map((k) => ({ id: 'B' + k, name: 'Bear', glyph: '🐻', pilot: true })),
      ],
      unsafe: bearsRule,
    },
    {
      id: 'l6', title: 'Five on the bridge', cap: 2, bridge: true, limit: 30,
      intro: 'Five people, one torch, 30 minutes. At most two cross at once, at the slower person’s pace.',
      ents: [
        { id: 'A', name: 'Ana', glyph: '🏃‍♀️', pilot: true, mins: 1 },
        { id: 'B', name: 'Ben', glyph: '🚶', pilot: true, mins: 3 },
        { id: 'C', name: 'Cal', glyph: '🧑‍🦯', pilot: true, mins: 6 },
        { id: 'D', name: 'Dot', glyph: '🧓', pilot: true, mins: 8 },
        { id: 'E', name: 'Eli', glyph: '🐢', pilot: true, mins: 12 },
      ],
      unsafe: () => null,
    },
    {
      id: 'l7', title: 'The family raft', cap: 2, checkBoat: true,
      intro: 'Only Mom, Dad and the officer can steer. Dad can’t be with the girls without Mom, Mom can’t be with the boys without Dad, and the thief can’t be with any family member without the officer.',
      ents: [
        { id: 'D', name: 'Dad', glyph: '👨', pilot: true },
        { id: 'M', name: 'Mom', glyph: '👩', pilot: true },
        { id: 'b1', name: 'Boy', glyph: '👦' },
        { id: 'b2', name: 'Boy', glyph: '👦' },
        { id: 'g1', name: 'Girl', glyph: '👧' },
        { id: 'g2', name: 'Girl', glyph: '👧' },
        { id: 'O', name: 'Officer', glyph: '👮', pilot: true },
        { id: 'T', name: 'Thief', glyph: '🦹' },
      ],
      unsafe(has) {
        const girls = has.g1 || has.g2, boys = has.b1 || has.b2;
        if (has.D && girls && !has.M) return 'Dad can’t be with the girls unless Mom is there.';
        if (has.M && boys && !has.D) return 'Mom can’t be with the boys unless Dad is there.';
        if (has.T && !has.O && (has.D || has.M || boys || girls)) return 'The thief can’t be with the family unless the officer is there.';
        return null;
      },
    },
  ];
  function bearsRule(has) {
    let p = 0, b = 0;
    for (const k in has) { if (!has[k]) continue; if (k[0] === 'P') p++; else if (k[0] === 'B') b++; }
    return p > 0 && b > p ? 'The bears would outnumber the campers.' : null;
  }

  const levelById = (id) => LEVELS.find((l) => l.id === id);

  /* ---------- rules engine ---------- */
  const hasOf = (L, idxs) => { const o = {}; idxs.forEach((i) => { o[L.ents[i].id] = true; }); return o; };
  function checkMove(L, pos, side, group, time) {
    if (!group.length) return 'Put someone in the boat first.';
    if (group.length > L.cap) return `The boat holds ${L.cap}.`;
    if (!group.some((i) => L.ents[i].pilot)) return L.bridge ? 'Someone has to carry the torch.' : 'Nobody in the boat can row.';
    if (L.checkBoat) { const m = L.unsafe(hasOf(L, group)); if (m) return m; }
    const np = pos.slice();
    group.forEach((i) => { np[i] = 1 - side; });
    for (const s of [0, 1]) {
      const m = L.unsafe(hasOf(L, np.map((p, i) => (p === s ? i : -1)).filter((i) => i >= 0)));
      if (m) return m;
    }
    if (L.bridge) {
      const t = time + Math.max(...group.map((i) => L.ents[i].mins));
      if (t > L.limit) return `That would take ${t} minutes in total. The torch only lasts ${L.limit}.`;
    }
    return null;
  }
  function* subsets(arr, maxK) {
    const n = arr.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      let k = 0;
      for (let b = mask; b; b &= b - 1) k++;
      if (k > maxK) continue;
      yield arr.filter((_, j) => mask & (1 << j));
    }
  }
  /** Shortest plan from (pos, side, time): BFS on crossings, or Dijkstra on minutes for bridges. */
  function plan(L, pos, side, time = 0) {
    const n = L.ents.length;
    const enc = (p, s) => p.reduce((a, v, i) => a | (v << i), 0) | (s << n);
    const goal = (1 << n) - 1;
    const start = { p: pos.slice(), s: side, t: time, path: [] };
    const best = new Map([[enc(pos, side), time]]);
    let frontier = [start];
    while (frontier.length) {
      if (L.bridge) frontier.sort((a, b) => a.t - b.t);
      const cur = L.bridge ? frontier.shift() : null;
      const layer = L.bridge ? [cur] : frontier;
      const next = [];
      for (const st of layer) {
        if ((enc(st.p, 0) & goal) === goal) return st;
        const here = st.p.map((v, i) => (v === st.s ? i : -1)).filter((i) => i >= 0);
        for (const g of subsets(here, L.cap)) {
          if (checkMove(L, st.p, st.s, g, st.t)) continue;
          const np = st.p.slice();
          g.forEach((i) => { np[i] = 1 - st.s; });
          const t = L.bridge ? st.t + Math.max(...g.map((i) => L.ents[i].mins)) : st.t + 1;
          const k = enc(np, 1 - st.s);
          if (best.has(k) && best.get(k) <= t) continue;
          best.set(k, t);
          const ns = { p: np, s: 1 - st.s, t, path: st.path.concat([g]) };
          if (L.bridge) frontier.push(ns); else next.push(ns);
        }
      }
      if (!L.bridge) frontier = next;
    }
    return null;
  }

  function generate(diffId) {
    const L = levelById(diffId);
    const sol = plan(L, new Array(L.ents.length).fill(0), 0, 0);
    return { level: L.id, par: sol.path.length, best: L.bridge ? sol.t : null };
  }

  BW.registerGame({
    id: 'river',
    levels: true,
    movesLabel: 'Crossings',
    defaultDiff: 'l1',
    tools: ['undo', 'hint', 'restart'],
    difficulties: LEVELS.map((L, i) => ({ id: L.id, label: `Level ${i + 1}`, note: L.title })),
    howTo: {
      goal: 'Get everyone safely to the far bank.',
      rules: [
        'Tap people on the bank by the boat to load them, then tap <b>Cross</b>. Tap someone in the boat to unload them.',
        'Each level has its own rules. They’re shown under the river, and a move that breaks one is stopped with an explanation.',
        'On the bridge levels the torch is the “boat”: crossings take as long as the slowest person, and there’s a time limit.',
        'Levels get harder as you go. Use the difficulty menu to jump to any level.',
      ],
      scoring: 'Solve it in the fewest possible crossings for three stars. A hint shows the next move but caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const L = levelById(P.level);
      const n = L.ents.length;
      if (!ctx.state) ctx.state = { pos: new Array(n).fill(0), side: 0, boat: [], time: 0, hist: [] };
      const S = ctx.state;
      let hintSet = new Set();
      let busy = false;
      const mixed = L.ents.some((e) => !e.pilot);
      const updateInfo = () => {
        if (L.bridge) ctx.info('Minutes', `${S.time}/${L.limit}`);
        else ctx.info('Par', String(P.par));
      };
      updateInfo();

      const wrap = h('div', { class: 'gm rv' + (L.bridge ? ' bridge' : '') });
      const far = h('div', { class: 'rv-bank far', 'aria-label': 'Far bank' });
      const near = h('div', { class: 'rv-bank near', 'aria-label': 'Starting bank' });
      const boatEl = h('div', { class: 'rv-boat', 'aria-label': L.bridge ? 'Crossing group' : 'Boat' });
      const river = h('div', { class: 'rv-river' }, h('div', { class: 'rv-water', 'aria-hidden': 'true' }), boatEl);
      const crossBtn = h('button', { class: 'rv-cross cap', type: 'button' }, L.bridge ? 'Cross with torch' : 'Cross');
      crossBtn.addEventListener('click', cross);
      const rule = h('p', { class: 'rv-rule' }, L.intro);
      wrap.append(
        h('div', { class: 'rv-label' }, h('span', null, 'Far bank'), h('span', { class: 'rv-count' })),
        far, river, near,
        h('div', { class: 'rv-label' }, h('span', null, 'Start'), null),
        h('div', { class: 'rv-foot' }, crossBtn, rule)
      );
      root.append(wrap);

      function token(i, where) {
        const e = L.ents[i];
        const b = h('button', {
          class: 'rv-tok cap' + (e.tint ? ' t' + e.tint : '') + (hintSet.has(i) ? ' hinted' : '') + (e.pilot && mixed ? ' pilot' : ''),
          type: 'button',
          'aria-label': `${e.name}${e.mins ? `, ${e.mins} minute${e.mins > 1 ? 's' : ''}` : ''}${where === 'boat' ? ', in the boat' : ''}`,
        }, h('span', { class: 'rv-g', 'aria-hidden': 'true' }, e.glyph), h('span', { class: 'rv-n' }, e.mins ? `${e.mins}m` : e.name));
        b.addEventListener('click', () => tapTok(i));
        return b;
      }
      function render() {
        far.innerHTML = ''; near.innerHTML = ''; boatEl.innerHTML = '';
        for (let i = 0; i < n; i++) {
          if (S.boat.includes(i)) continue;
          (S.pos[i] === 1 ? far : near).append(token(i, 'bank'));
        }
        S.boat.forEach((i) => boatEl.append(token(i, 'boat')));
        if (L.bridge) boatEl.append(h('span', { class: 'rv-torch', 'aria-hidden': 'true' }, '🔦'));
        for (let k = S.boat.length; k < L.cap; k++) boatEl.append(h('span', { class: 'rv-seat', 'aria-hidden': 'true' }));
        boatEl.classList.toggle('at-far', S.side === 1);
        crossBtn.disabled = !S.boat.length || ctx.status !== 'playing';
        wrap.querySelector('.rv-count').textContent = `${S.pos.filter((p) => p === 1).length} of ${n} across`;
      }

      function tapTok(i) {
        if (busy || ctx.status !== 'playing') return;
        if (S.boat.includes(i)) {
          S.boat = S.boat.filter((x) => x !== i);
          ctx.sound('remove');
        } else {
          if (S.pos[i] !== S.side) { ctx.sound('error'); ctx.toast(L.bridge ? 'The torch is on the other side.' : 'The boat is on the other side.'); return; }
          if (S.boat.length >= L.cap) { ctx.sound('error'); ctx.toast(`The ${L.bridge ? 'bridge' : 'boat'} holds ${L.cap}.`); return; }
          S.boat.push(i);
          ctx.sound('place');
        }
        ctx.haptic('light');
        render();
        ctx.save();
      }

      function cross() {
        if (busy || ctx.status !== 'playing') return;
        const err = checkMove(L, S.pos, S.side, S.boat, S.time);
        if (err) {
          ctx.sound('error');
          ctx.haptic('medium');
          boatEl.classList.remove('shake'); void boatEl.offsetWidth; boatEl.classList.add('shake');
          ctx.toast(err, { ms: 3400 });
          return;
        }
        S.hist.push({ pos: S.pos.slice(), side: S.side, time: S.time });
        const group = S.boat.slice();
        busy = true;
        ctx.sound('submit');
        boatEl.classList.toggle('at-far', S.side === 0);
        setTimeout(() => {
          group.forEach((i) => { S.pos[i] = 1 - S.side; });
          if (L.bridge) S.time += Math.max(...group.map((i) => L.ents[i].mins));
          S.side = 1 - S.side;
          S.boat = [];
          hintSet = new Set();
          busy = false;
          render();
          updateInfo();
          ctx.update({ moves: S.hist.length });
          if (S.pos.every((p) => p === 1)) {
            const stars = BW.moveStars(S.hist.length, P.par, ctx.hints, 4);
            ctx.finish({
              won: true, stars,
              note: L.bridge ? `Everyone crossed in ${S.time} minutes, with ${L.limit - S.time} to spare.` : S.hist.length <= P.par ? `${S.hist.length} crossings: the fewest possible.` : `The fewest possible is ${P.par} crossings.`,
            });
          }
        }, BW.util.reducedMotion() ? 0 : 520);
      }

      render();

      return {
        canUndo: () => S.hist.length > 0 && !busy,
        undo() {
          const prev = S.hist.pop();
          S.pos = prev.pos; S.side = prev.side; S.time = prev.time; S.boat = [];
          hintSet = new Set();
          render(); updateInfo();
          ctx.update({ moves: S.hist.length });
        },
        restart() {
          S.pos = new Array(n).fill(0); S.side = 0; S.boat = []; S.time = 0; S.hist = [];
          hintSet = new Set();
          render(); updateInfo();
          ctx.update({ moves: 0 });
        },
        hint() {
          const sol = plan(L, S.pos, S.side, S.time);
          if (!sol || !sol.path.length) return false;
          const g = sol.path[0];
          hintSet = new Set(g);
          S.boat = S.boat.filter((i) => hintSet.has(i));
          render();
          const names = g.map((i) => L.ents[i].name + (L.ents[i].mins ? ` (${L.ents[i].mins}m)` : ''));
          ctx.toast(`Next: send ${names.join(' and ')} across.`, { ms: 3600 });
          return true;
        },
        noHintText: 'No way forward from here. Undo a few crossings.',
        destroy() {},
      };
    },
  });

  BW._river = { LEVELS, plan, checkMove, generate };
})();
