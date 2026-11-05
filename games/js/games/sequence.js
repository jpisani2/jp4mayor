/* Brainwave — What Comes Next */
(() => {
  'use strict';
  const { h } = BW.util;

  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
  const by = (d) => (d >= 0 ? `up by ${d}` : `down by ${-d}`);
  const signed = (c) => (c >= 0 ? `add ${c}` : `subtract ${-c}`);
  const build = (len, a0, step) => { const s = [a0]; for (let i = 1; i < len; i++) s.push(step(s, i)); return s; };
  const GAPS = 'Look at the gaps between neighboring terms.';

  const GEN = {
    easy: [
      (r) => { const d = r.pick([2, 3, 4, 5, 6, 7, 8, 9]) * (r.chance(0.25) ? -1 : 1); const a = d < 0 ? r.range(60, 90) : r.range(1, 30); return { seq: build(7, a, (s) => s[s.length - 1] + d), rule: `Each term goes ${by(d)}.`, hint: GAPS }; },
      (r) => { const q = r.pick([2, 3]); const a = r.range(1, q === 2 ? 6 : 3); return { seq: build(7, a, (s) => s[s.length - 1] * q), rule: `Each term is ${q === 2 ? 'double' : 'triple'} the one before.`, hint: 'Compare each term with the one before it. Is it a multiple?' }; },
      (r) => { const k = r.range(1, 6); return { seq: Array.from({ length: 7 }, (_, i) => (k + i) ** 2), rule: `Square numbers: ${k}×${k}, ${k + 1}×${k + 1}, ${k + 2}×${k + 2}, and so on.`, hint: 'Each of these is a number multiplied by itself.' }; },
      (r) => { const p = r.range(2, 9); let q = r.range(1, 9); if (q === p) q = p === 9 ? 1 : p + 1; const a = r.range(1, 20); return { seq: build(7, a, (s, i) => s[s.length - 1] + (i % 2 ? p : q)), rule: `Add ${p}, then ${q}, and repeat.`, hint: 'The gaps follow a pattern of their own.' }; },
      (r) => { const d0 = r.range(1, 4); const a = r.range(1, 20); return { seq: build(7, a, (s, i) => s[s.length - 1] + d0 + i - 1), rule: `The gap grows by 1 each time: +${d0}, +${d0 + 1}, +${d0 + 2}, …`, hint: GAPS }; },
    ],
    medium: [
      (r) => { const s0 = r.range(2, 4), d0 = r.range(1, 6), a = r.range(1, 15); return { seq: build(7, a, (s, i) => s[s.length - 1] + d0 + (i - 1) * s0), rule: `The gap grows by ${s0} each time: +${d0}, +${d0 + s0}, +${d0 + 2 * s0}, …`, hint: 'Write out the gaps, then look at how the gaps change.' }; },
      (r) => { const c = r.pick([-1, 1, 2, 3]); const a = r.range(2, 5); return { seq: build(7, a, (s) => s[s.length - 1] * 2 + c), rule: `Double the last term, then ${signed(c)}.`, hint: 'Each term is roughly twice the one before.' }; },
      (r) => { const a = r.range(1, 6), b = r.range(a, 9); const s = [a, b]; while (s.length < 7) s.push(s[s.length - 1] + s[s.length - 2]); return { seq: s, rule: 'Each term is the sum of the two before it.', hint: 'Try combining two neighboring terms.' }; },
      (r) => { const k = r.range(1, 3); return { seq: Array.from({ length: 7 }, (_, i) => (k + i) ** 3), rule: `Cube numbers: ${k}×${k}×${k}, ${k + 1}×${k + 1}×${k + 1}, and so on.`, hint: 'These grow faster than squares.' }; },
      (r) => { const m = r.pick([2, 3]), c = r.range(1, 6), a = r.range(1, 5); return { seq: build(7, a, (s, i) => (i % 2 ? s[s.length - 1] * m : s[s.length - 1] + c)), rule: `Multiply by ${m}, then add ${c}, and repeat.`, hint: 'Two different steps take turns.' }; },
      (r) => { const k = r.range(0, 5); return { seq: PRIMES.slice(k, k + 7), rule: 'Prime numbers: each can only be divided evenly by 1 and itself.', hint: 'What do all of these numbers have in common?' }; },
    ],
    hard: [
      (r) => { const a1 = r.range(1, 15), a2 = r.range(20, 40), d1 = r.range(2, 7), d2 = -r.range(1, 5); const seq = []; for (let i = 0; i < 8; i++) seq.push(i % 2 ? a2 + Math.floor(i / 2) * d2 : a1 + Math.floor(i / 2) * d1); return { seq, rule: `Two sequences take turns: one goes ${by(d1)}, the other goes ${by(d2)}.`, hint: 'Read every other term.' }; },
      (r) => { const g0 = r.range(1, 3), q = r.pick([2, 3]), a = r.range(1, 10); return { seq: build(7, a, (s, i) => s[s.length - 1] + g0 * q ** (i - 1)), rule: `The gaps multiply by ${q} each time: +${g0}, +${g0 * q}, +${g0 * q * q}, …`, hint: 'Write out the gaps. How do they grow?' }; },
      (r) => { const s = [r.range(0, 2), r.range(1, 3), r.range(1, 4)]; while (s.length < 7) s.push(s[s.length - 1] + s[s.length - 2] + s[s.length - 3]); return { seq: s, rule: 'Each term is the sum of the three before it.', hint: 'Try adding up more than two earlier terms.' }; },
      (r) => { const a = r.range(1, 2); return { seq: build(7, a, (s, i) => s[s.length - 1] * (i + 1)), rule: 'Multiply by 2, then 3, then 4, and so on.', hint: 'Divide each term by the one before it.' }; },
      (r) => { const q = r.pick([-2, -3]), a = r.range(1, 3); return { seq: build(7, a, (s) => s[s.length - 1] * q), rule: `Multiply by ${q} each time.`, hint: 'Watch the signs as well as the sizes.' }; },
      (r) => { const k = r.range(1, 4), c = r.pick([-1, 1, 2, 3, -2]); return { seq: Array.from({ length: 7 }, (_, i) => (k + i) ** 2 + c), rule: `Square numbers, then ${signed(c)}.`, hint: 'Each term is close to a familiar kind of number.' }; },
    ],
    expert: [
      (r) => { const a = r.range(1, 20), o = r.range(0, 1); return { seq: build(7, a, (s, i) => s[s.length - 1] + PRIMES[o + i - 1]), rule: `The gaps are the prime numbers: +${PRIMES[o]}, +${PRIMES[o + 1]}, +${PRIMES[o + 2]}, +${PRIMES[o + 3]}, …`, hint: GAPS }; },
      (r) => { const F = [1, 1, 2, 3, 5, 8, 13, 21, 34]; const o = r.range(0, 2), a = r.range(1, 10); return { seq: build(7, a, (s, i) => s[s.length - 1] + F[o + i - 1]), rule: 'The gaps follow the Fibonacci pattern: each gap is the sum of the two gaps before it.', hint: GAPS }; },
      (r) => { const ds = (x) => String(Math.abs(x)).split('').reduce((t, c) => t + Number(c), 0); const a = r.range(10, 40); return { seq: build(7, a, (s) => s[s.length - 1] + ds(s[s.length - 1])), rule: 'Add the digits of each term to itself. For example, 23 → 23 + 2 + 3 = 28.', hint: 'The gaps depend on the digits of each term.' }; },
      (r) => { const st = r.pick([[1, 2], [2, 1], [1, 3]]); const s = st.slice(); while (s.length < 7) s.push(s[s.length - 1] * s[s.length - 2]); return { seq: s, rule: 'Each term is the product of the two before it.', hint: 'Try multiplying two neighboring terms.' }; },
      (r) => { const a1 = r.range(1, 4), a2 = r.range(5, 20), d = r.range(2, 7); const seq = []; for (let i = 0; i < 8; i++) seq.push(i % 2 ? a2 + Math.floor(i / 2) * d : a1 * 2 ** Math.floor(i / 2)); return { seq, rule: `Two sequences take turns: one doubles, the other goes up by ${d}.`, hint: 'Read every other term.' }; },
      (r) => { const a = r.range(1, 10), g0 = r.range(1, 4), s0 = r.range(1, 3); const gaps = [g0]; for (let i = 1; i < 6; i++) gaps.push(gaps[i - 1] + s0 + i - 1); return { seq: build(7, a, (s, i) => s[s.length - 1] + gaps[i - 1]), rule: `The gaps between the gaps grow by 1 each time.`, hint: 'Write the gaps, then the gaps between those.' }; },
    ],
  };
  const DIFFS = { easy: { par: 30 }, medium: { par: 60 }, hard: { par: 90 }, expert: { par: 120 } };
  const MAX_TRIES = 3;

  function generate(diffId, rng) {
    const g = rng.pick(GEN[diffId])(rng);
    const seq = g.seq;
    return { shown: seq.slice(0, -1), answer: seq[seq.length - 1], rule: g.rule, hint: g.hint, par: DIFFS[diffId].par };
  }

  BW.registerGame({
    id: 'sequence',
    movesLabel: 'Tries',
    movesBest: false,
    defaultDiff: 'easy',
    tools: ['hint', 'new'],
    loseTitle: 'Out of tries.',
    movesValue: (ctx) => `${ctx.moves}/${MAX_TRIES}`,
    difficulties: [
      { id: 'easy', label: 'Easy', note: 'One simple rule' },
      { id: 'medium', label: 'Medium', note: 'Growing gaps, famous numbers' },
      { id: 'hard', label: 'Hard', note: 'Interleaved and layered rules' },
      { id: 'expert', label: 'Expert', note: 'Gaps of gaps and stranger rules' },
    ],
    howTo: {
      goal: 'Work out the rule and enter the next number.',
      rules: [
        'Each sequence follows one rule. Type the number that comes next and tap <b>Check</b>.',
        'You get three tries. Answers can be negative.',
        'The first hint nudges you toward the rule. The second shows the gaps between terms.',
        'Every answer comes with the rule explained.',
      ],
      scoring: 'Right first time with no hints earns three stars. Each wrong try or hint costs one, down to one star.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      if (!ctx.state) ctx.state = { input: '', wrong: [] };
      const S = ctx.state;

      const wrap = h('div', { class: 'gm sq' });
      const seqEl = h('div', { class: 'sq-seq', role: 'list', 'aria-label': 'Sequence' });
      const gapsEl = h('div', { class: 'sq-gaps', 'aria-label': 'Gaps between terms' });
      const hintEl = h('p', { class: 'sq-hint' });
      const wrongEl = h('div', { class: 'sq-wrong' });
      const display = h('div', { class: 'sq-display', 'aria-live': 'polite' });
      const keys = h('div', { class: 'sq-keys' });
      const check = h('button', { class: 'sq-check cap', type: 'button' }, 'Check');
      check.addEventListener('click', submit);
      wrap.append(h('div', { class: 'sq-top' }, seqEl, gapsEl, hintEl, wrongEl), h('div', { class: 'sq-bottom' }, display, keys, check));
      root.append(wrap);

      ['1', '2', '3', '⌫', '4', '5', '6', '−', '7', '8', '9', '0'].forEach((k) => {
        const b = h('button', { class: 'sq-key cap', type: 'button', 'aria-label': k === '⌫' ? 'Delete' : k === '−' ? 'Minus' : k }, k === '⌫' ? BW.ui.icon('backspace') : k);
        b.addEventListener('click', () => press(k));
        keys.append(b);
      });

      function render() {
        seqEl.innerHTML = '';
        P.shown.forEach((x) => seqEl.append(h('span', { class: 'sq-term', role: 'listitem' }, String(x))));
        const done = ctx.status !== 'playing';
        seqEl.append(h('span', { class: 'sq-term q' + (done ? ' revealed' : ''), role: 'listitem', 'aria-label': done ? `Answer ${P.answer}` : 'Next term, unknown' }, done ? String(P.answer) : '?'));
        gapsEl.innerHTML = '';
        if (ctx.hints >= 2 || done) {
          const all = P.shown.concat(done ? [P.answer] : []);
          for (let i = 1; i < all.length; i++) {
            const d = all[i] - all[i - 1];
            gapsEl.append(h('span', { class: 'sq-gap' }, (d >= 0 ? '+' : '−') + Math.abs(d)));
          }
        }
        gapsEl.hidden = !gapsEl.childNodes.length;
        hintEl.textContent = ctx.hints >= 1 && !done ? P.hint : '';
        hintEl.hidden = !hintEl.textContent;
        wrongEl.innerHTML = '';
        S.wrong.forEach((w) => wrongEl.append(h('span', { class: 'sq-wr' }, String(w))));
        display.textContent = S.input === '' ? ' ' : S.input.replace('-', '−');
        display.classList.toggle('empty', S.input === '');
        check.disabled = done || S.input === '' || S.input === '-';
        keys.querySelectorAll('button').forEach((b) => { b.disabled = done; });
      }
      function press(k) {
        if (ctx.status !== 'playing') return;
        if (k === '⌫') S.input = S.input.slice(0, -1);
        else if (k === '−') S.input = S.input.startsWith('-') ? S.input.slice(1) : '-' + S.input;
        else if (S.input.replace('-', '').length < 9) S.input = (S.input === '0' ? '' : S.input === '-0' ? '-' : S.input) + k;
        ctx.sound('tap');
        render();
        ctx.save();
      }
      function submit() {
        if (ctx.status !== 'playing' || S.input === '' || S.input === '-') return;
        const val = Number(S.input);
        const tries = ctx.moves + 1;
        ctx.update({ moves: tries });
        if (val === P.answer) {
          render();
          seqEl.classList.add('won');
          const penalty = S.wrong.length + ctx.hints;
          ctx.finish({ won: true, stars: Math.max(1, 3 - penalty), note: P.rule });
          render();
          return;
        }
        S.wrong.push(val);
        S.input = '';
        ctx.sound('error');
        ctx.haptic('medium');
        display.classList.remove('shake'); void display.offsetWidth; display.classList.add('shake');
        if (tries >= MAX_TRIES) {
          ctx.finish({ won: false, extra: h('div', { class: 'r-code' }, h('span', { class: 'r-code-label' }, `The answer was ${P.answer}`), h('p', { class: 'r-note' }, P.rule)) });
        } else ctx.toast(`Not ${val}. ${MAX_TRIES - tries} ${MAX_TRIES - tries === 1 ? 'try' : 'tries'} left.`);
        render();
      }
      const onKey = (e) => {
        if (BW.sheetsOpen() > 0 || ctx.status !== 'playing') return;
        if (/^[0-9]$/.test(e.key)) press(e.key);
        else if (e.key === '-') press('−');
        else if (e.key === 'Backspace') press('⌫');
        else if (e.key === 'Enter') submit();
      };
      document.addEventListener('keydown', onKey);
      render();

      return {
        canHint: () => ctx.hints < 2,
        hint() { setTimeout(render, 0); return true; },
        noHintText: 'That’s both hints for this one.',
        destroy() { document.removeEventListener('keydown', onKey); },
      };
    },
  });

  BW._sequence = { GEN, generate };
})();
