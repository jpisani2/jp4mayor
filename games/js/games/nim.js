/* Brainwave — Nim */
(() => {
  'use strict';
  const { h } = BW.util;

  const DIFFS = {
    easy:   { piles: 1, size: [13, 21], max: 3, misere: false, skill: 0.35, rule: 'Take 1, 2 or 3 sticks. Whoever takes the last stick wins.' },
    medium: { piles: 3, size: [1, 7],   max: 0, misere: false, skill: 0.7,  rule: 'Take any number of sticks from one pile. Whoever takes the last stick wins.' },
    hard:   { piles: 4, size: [1, 8],   max: 0, misere: true,  skill: 1,    rule: 'Take any number of sticks from one pile. Whoever takes the last stick loses.' },
    expert: { piles: 4, size: [3, 12],  max: 4, misere: false, skill: 1,    rule: 'Take 1 to 4 sticks from one pile. Whoever takes the last stick wins.' },
  };

  /* ---------- perfect play by memoized search ---------- */
  const memo = new Map();
  function legal(piles, cfg) {
    const out = [];
    piles.forEach((p, i) => { const lim = cfg.max ? Math.min(cfg.max, p) : p; for (let t = 1; t <= lim; t++) out.push({ i, t }); });
    return out;
  }
  function wins(piles, cfg) {
    // true if the player about to move can force a win
    const key = (cfg.misere ? 'm' : 'n') + cfg.max + ':' + piles.slice().sort((a, b) => a - b).join(',');
    if (memo.has(key)) return memo.get(key);
    let res;
    if (piles.every((p) => p === 0)) res = cfg.misere; // opponent took the last stick
    else {
      res = false;
      for (const m of legal(piles, cfg)) {
        const np = piles.slice(); np[m.i] -= m.t;
        if (!wins(np, cfg)) { res = true; break; }
      }
    }
    memo.set(key, res);
    return res;
  }
  function bestMove(piles, cfg) {
    for (const m of legal(piles, cfg)) {
      const np = piles.slice(); np[m.i] -= m.t;
      if (!wins(np, cfg)) return m;
    }
    return null;
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    for (let tries = 0; tries < 500; tries++) {
      const piles = Array.from({ length: cfg.piles }, () => rng.range(cfg.size[0], cfg.size[1]));
      if (wins(piles, cfg)) return { piles };
    }
    return { piles: cfg.piles === 1 ? [17] : [3, 4, 5].concat(cfg.piles > 3 ? [6] : []) };
  }

  BW.registerGame({
    id: 'nim',
    movesLabel: 'Turns',
    movesBest: false,
    defaultDiff: 'easy',
    tools: ['hint', 'new'],
    nextLabel: 'New game',
    loseTitle: 'The computer wins.',
    difficulties: [
      { id: 'easy', label: 'Easy', note: 'One pile', desc: 'take 1 to 3' },
      { id: 'medium', label: 'Medium', note: 'Three piles', desc: 'classic Nim' },
      { id: 'hard', label: 'Hard', note: 'Four piles', desc: 'last stick loses' },
      { id: 'expert', label: 'Expert', note: 'Four piles', desc: 'take 1 to 4' },
    ],
    howTo: {
      goal: 'Outplay the computer.',
      rules: [
        'You and the computer take turns removing sticks. You always go first.',
        'Tap a stick to select it and every stick after it in that pile, then tap <b>Take</b>.',
        'The rules for each level are shown under the piles. Read them closely: on Hard, taking the last stick <b>loses</b>.',
        'You always start from a position you can win. On Hard and Expert, the computer never makes a mistake.',
      ],
      scoring: 'Win for three stars. Winning with a hint earns two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const cfg = DIFFS[ctx.diff];
      if (!ctx.state) ctx.state = { piles: P.piles.slice(), turn: 'you', sel: null, last: null };
      const S = ctx.state;
      let cpuTimer = 0, taking = null, hint = null;

      const wrap = h('div', { class: 'gm nm' });
      const status = h('div', { class: 'nm-status', 'aria-live': 'polite' });
      const pilesEl = h('div', { class: 'nm-piles' });
      const takeBtn = h('button', { class: 'nm-take cap', type: 'button' });
      takeBtn.addEventListener('click', take);
      wrap.append(status, pilesEl, h('div', { class: 'nm-foot' }, takeBtn, h('p', { class: 'nm-rule' }, cfg.rule)));
      root.append(wrap);

      function render() {
        const over = ctx.status !== 'playing';
        status.innerHTML = '';
        status.className = 'nm-status ' + (over ? '' : S.turn);
        status.append(h('span', { class: 'nm-turn' }, over ? (ctx.status === 'won' ? 'You win!' : 'Computer wins') : S.turn === 'you' ? 'Your move' : 'Computer is thinking…'));
        if (S.last) status.append(h('span', { class: 'nm-last' }, S.last));
        pilesEl.innerHTML = '';
        S.piles.forEach((p, i) => {
          const pile = h('div', { class: 'nm-pile' + (cfg.piles === 1 ? ' single' : ''), 'aria-label': `Pile ${i + 1}: ${p} stick${p === 1 ? '' : 's'}` });
          if (cfg.piles > 1) pile.append(h('span', { class: 'nm-pile-n' }, String(p)));
          const sticks = h('div', { class: 'nm-sticks' });
          for (let k = 0; k < p; k++) {
            const fromEnd = p - k; // 1 = last stick
            const selected = S.sel && S.sel.i === i && fromEnd <= S.sel.t;
            const cpu = taking && taking.i === i && fromEnd <= taking.t;
            const hinted = hint && hint.i === i && fromEnd <= hint.t;
            const s = h('button', { class: 'nm-stick' + (selected ? ' sel' : '') + (cpu ? ' cpu' : '') + (hinted ? ' hinted' : ''), type: 'button', 'aria-label': `Pile ${i + 1}, stick ${k + 1}` });
            s.addEventListener('click', () => pick(i, fromEnd));
            sticks.append(s);
          }
          if (!p) sticks.append(h('span', { class: 'nm-empty' }, 'empty'));
          pile.append(sticks);
          pilesEl.append(pile);
        });
        const n = S.sel ? S.sel.t : 0;
        takeBtn.textContent = n ? `Take ${n}` : 'Take';
        takeBtn.disabled = !n || S.turn !== 'you' || over;
      }

      function pick(i, fromEnd) {
        if (ctx.status !== 'playing' || S.turn !== 'you') return;
        const lim = cfg.max || Infinity;
        let t = Math.min(fromEnd, lim);
        if (S.sel && S.sel.i === i && S.sel.t === t) { S.sel = null; ctx.sound('remove'); }
        else { S.sel = { i, t }; ctx.sound('tap'); }
        if (fromEnd > lim) ctx.toast(`You can take at most ${lim}.`);
        render(); ctx.save();
      }

      function endCheck(byYou) {
        if (S.piles.some((p) => p > 0)) return false;
        const youTookLast = byYou;
        const won = cfg.misere ? !youTookLast : youTookLast;
        S.turn = 'over';
        render();
        ctx.finish(won
          ? { won: true, stars: ctx.hints ? 2 : 3, note: cfg.misere ? 'The computer had to take the last stick.' : 'You took the last stick.' }
          : { won: false, extra: h('p', { class: 'r-note' }, cfg.misere ? 'You had to take the last stick.' : 'The computer took the last stick. You started from a winning position, so there was a way. Try a hint next time.') });
        render();
        return true;
      }

      function take() {
        if (!S.sel || S.turn !== 'you' || ctx.status !== 'playing') return;
        const { i, t } = S.sel;
        S.piles[i] -= t;
        S.sel = null; hint = null;
        S.last = `You took ${t} from ${cfg.piles === 1 ? 'the pile' : 'pile ' + (i + 1)}.`;
        ctx.sound('submit');
        ctx.haptic('light');
        ctx.update({ moves: ctx.moves + 1 });
        if (endCheck(true)) return;
        S.turn = 'cpu';
        render();
        ctx.save();
        scheduleCpu();
      }

      function scheduleCpu() {
        clearTimeout(cpuTimer);
        cpuTimer = setTimeout(() => {
          let m = Math.random() < cfg.skill ? bestMove(S.piles, cfg) : null;
          if (!m) { const opts = legal(S.piles, cfg); m = opts[Math.floor(Math.random() * opts.length)]; }
          taking = m;
          render();
          ctx.sound('tap');
          cpuTimer = setTimeout(() => {
            S.piles[m.i] -= m.t;
            taking = null;
            S.last = `Computer took ${m.t} from ${cfg.piles === 1 ? 'the pile' : 'pile ' + (m.i + 1)}.`;
            ctx.sound('unflip');
            if (endCheck(false)) return;
            S.turn = 'you';
            render();
            ctx.save();
          }, BW.util.reducedMotion() ? 150 : 650);
        }, BW.util.reducedMotion() ? 150 : 750);
      }

      render();
      if (S.turn === 'cpu' && ctx.status === 'playing') scheduleCpu();

      return {
        canHint: () => S.turn === 'you',
        hint() {
          if (S.turn !== 'you') return false;
          const m = bestMove(S.piles, cfg);
          if (m) {
            hint = m; S.sel = { i: m.i, t: m.t };
            ctx.toast(`Take ${m.t} from ${cfg.piles === 1 ? 'the pile' : 'pile ' + (m.i + 1)}.`, { ms: 3200 });
          } else {
            const big = S.piles.indexOf(Math.max(...S.piles));
            hint = { i: big, t: 1 }; S.sel = { i: big, t: 1 };
            ctx.toast('There’s no winning move right now. Take one and hope the computer slips.', { ms: 3600 });
          }
          render();
          return true;
        },
        noHintText: 'Wait for your turn.',
        destroy() { clearTimeout(cpuTimer); },
      };
    },
  });

  BW._nim = { wins, bestMove, generate, DIFFS };
})();
