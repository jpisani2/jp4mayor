/* Brainwave — Code Breaker */
(() => {
  'use strict';
  const { h, svg } = BW.util;

  const COLORS = [
    { name: 'Red', c: '#F0605D' },
    { name: 'Orange', c: '#FF9F43' },
    { name: 'Yellow', c: '#FFD43F' },
    { name: 'Green', c: '#52C47C' },
    { name: 'Blue', c: '#4F82FF' },
    { name: 'Purple', c: '#A070FF' },
    { name: 'Pink', c: '#FF7EC8' },
    { name: 'Teal', c: '#2DC6C6' },
  ];
  // Symbols so colors never carry meaning alone (24-unit box, centerd at 12,12)
  const SYM = [
    '<circle cx="12" cy="12" r="4.6"/>',
    '<path d="M12 6.6l5.4 9.4H6.6z"/>',
    '<rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.4"/>',
    '<path d="M12 5.8l6.2 6.2-6.2 6.2L5.8 12z"/>',
    '<path d="M10.2 6.5h3.6v3.7h3.7v3.6h-3.7v3.7h-3.6v-3.7H6.5v-3.6h3.7z"/>',
    '<path d="M12 6.2l1.7 3.7 4 .4-3 2.7.9 4-3.6-2.1-3.6 2.1.9-4-3-2.7 4-.4z"/>',
    '<path d="M12 6.4l4.9 2.8v5.6L12 17.6l-4.9-2.8V9.2z"/>',
    '<path d="M8.2 6.6L12 10.4l3.8-3.8 1.6 1.6-3.8 3.8 3.8 3.8-1.6 1.6-3.8-3.8-3.8 3.8-1.6-1.6 3.8-3.8-3.8-3.8z"/>',
  ];

  const DIFFS = {
    easy:   { pegs: 4, colors: 6, repeat: false, rows: 10, par: 5 },
    medium: { pegs: 4, colors: 6, repeat: true,  rows: 10, par: 5 },
    hard:   { pegs: 5, colors: 7, repeat: true,  rows: 10, par: 6 },
    expert: { pegs: 6, colors: 8, repeat: true,  rows: 12, par: 8 },
  };

  function score(guess, secret) {
    let exact = 0;
    const a = {}, b = {};
    guess.forEach((g, i) => {
      if (g === secret[i]) exact++;
      else { a[g] = (a[g] || 0) + 1; b[secret[i]] = (b[secret[i]] || 0) + 1; }
    });
    let near = 0;
    for (const k in a) near += Math.min(a[k], b[k] || 0);
    return [exact, near];
  }

  function generate(diffId, rng) {
    const cfg = DIFFS[diffId];
    let secret;
    if (cfg.repeat) secret = Array.from({ length: cfg.pegs }, () => rng.int(cfg.colors));
    else secret = rng.shuffle([...Array(cfg.colors).keys()]).slice(0, cfg.pegs);
    return Object.assign({ secret }, cfg);
  }

  function pegEl(color, opts = {}) {
    const { tag = 'span', cls = '', label } = opts;
    const el = h(tag, { class: `peg ${color == null ? 'empty' : 'filled'} ${cls}`, style: color != null ? { '--pc': COLORS[color].c } : null, 'aria-label': label || (color == null ? 'empty' : COLORS[color].name) });
    if (tag === 'button') el.type = 'button';
    if (color != null) el.append(svg(`<svg viewBox="0 0 24 24" class="sym" aria-hidden="true">${SYM[color]}</svg>`));
    return el;
  }

  function feedbackEl(exact, near, pegs) {
    const cols = Math.ceil(pegs / 2);
    const marks = [];
    for (let i = 0; i < pegs; i++) marks.push(h('i', { class: i < exact ? 'x' : i < exact + near ? 'o' : '' }));
    return h('span', { class: 'fb', style: { '--fc': cols }, role: 'img', 'aria-label': `${exact} in the right spot, ${near} right color wrong spot` }, marks);
  }

  function figure() {
    const row = h('div', { class: 'cb-fig' },
      h('div', { class: 'cb-fig-row' }, h('span', { class: 'fb', style: { '--fc': 1 } }, h('i', { class: 'x' })), h('span', null, 'Right color, right spot')),
      h('div', { class: 'cb-fig-row' }, h('span', { class: 'fb', style: { '--fc': 1 } }, h('i', { class: 'o' })), h('span', null, 'Right color, wrong spot')),
      h('div', { class: 'cb-fig-row' }, h('span', { class: 'fb', style: { '--fc': 1 } }, h('i')), h('span', null, 'Not in the code (or already counted)'))
    );
    return row;
  }

  BW.registerGame({
    id: 'code-breaker',
    movesLabel: 'Guesses',
    defaultDiff: 'easy',
    tools: ['hint', 'new'],
    loseTitle: 'Out of guesses.',
    difficulties: [
      { id: 'easy', label: 'Easy', note: '4 pegs', desc: '6 colors, no repeats' },
      { id: 'medium', label: 'Medium', note: '4 pegs', desc: '6 colors, repeats allowed' },
      { id: 'hard', label: 'Hard', note: '5 pegs', desc: '7 colors, repeats allowed' },
      { id: 'expert', label: 'Expert', note: '6 pegs', desc: '8 colors, repeats allowed' },
    ],
    movesValue: (ctx) => `${ctx.moves}/${ctx.puzzle.rows}`,
    howTo: {
      goal: 'Work out the hidden color code.',
      figure,
      rules: [
        'Tap colors to fill a row, then tap <b>Guess</b>. Tap a slot to choose which one to fill next.',
        'Each guess gets clues. They tell you how many pegs are right, but not which ones.',
        'On Easy every color appears at most once. From Medium up, colors can repeat.',
        '<b>Press and hold</b> a color to cross it out as a reminder that it isn’t in the code.',
      ],
      scoring: 'Crack it within par for three stars. A hint locks one correct peg in place but caps you at two.',
    },
    generate,

    mount(root, ctx) {
      const P = ctx.puzzle;
      const { pegs, colors, rows, repeat } = P;
      if (!ctx.state) ctx.state = { guesses: [], fb: [], cur: new Array(pegs).fill(null), sel: 0, revealed: [], ruled: [] };
      const S = ctx.state;
      ctx.info('Par', String(P.par));

      const wrap = h('div', { class: 'cb', style: { '--p': pegs } });
      const secretRow = h('div', { class: 'cb-secret', 'aria-label': 'Hidden code' });
      const rowsEl = h('div', { class: 'cb-rows' });
      const palette = h('div', { class: 'cb-palette', style: { '--cols': colors <= 6 ? colors : 4 } });
      const actions = h('div', { class: 'cb-actions' });
      wrap.append(secretRow, rowsEl, h('div', { class: 'cb-input' }, palette, actions));
      root.append(wrap);

      const isLocked = (i) => S.revealed.includes(i);
      const firstOpen = (from = 0) => {
        for (let k = 0; k < pegs; k++) {
          const i = (from + k) % pegs;
          if (!isLocked(i) && S.cur[i] == null) return i;
        }
        for (let k = 0; k < pegs; k++) { const i = (from + k) % pegs; if (!isLocked(i)) return i; }
        return 0;
      };
      if (isLocked(S.sel)) S.sel = firstOpen();

      /* ----- rendering ----- */
      function renderSecret() {
        secretRow.innerHTML = '';
        const done = ctx.status !== 'playing';
        P.secret.forEach((c, i) => {
          const known = done || isLocked(i);
          secretRow.append(known ? pegEl(c, { cls: 'secret' + (done ? ' reveal' : '') }) : h('span', { class: 'peg hidden', 'aria-label': 'hidden' }, '?'));
        });
      }
      function renderRows() {
        rowsEl.innerHTML = '';
        const curIdx = S.guesses.length;
        for (let r = 0; r < rows; r++) {
          const row = h('div', { class: 'cb-row' + (r === curIdx && ctx.status === 'playing' ? ' current' : r > curIdx ? ' future' : '') });
          row.append(h('span', { class: 'cb-num' }, String(r + 1)));
          const slots = h('div', { class: 'cb-slots' });
          if (r < curIdx) {
            S.guesses[r].forEach((c) => slots.append(pegEl(c)));
            row.append(slots, feedbackEl(S.fb[r][0], S.fb[r][1], pegs));
          } else if (r === curIdx && ctx.status === 'playing') {
            S.cur.forEach((c, i) => {
              const locked = isLocked(i);
              const b = pegEl(c, { tag: 'button', cls: 'slot' + (i === S.sel ? ' sel' : '') + (locked ? ' locked' : ''), label: `Slot ${i + 1}, ${c == null ? 'empty' : COLORS[c].name}${locked ? ', locked by hint' : ''}` });
              if (locked) b.append(BW.ui.icon('lock', 'lock'));
              b.addEventListener('click', () => {
                if (locked) { ctx.sound('error'); return; }
                if (S.sel === i && S.cur[i] != null) { S.cur[i] = null; ctx.sound('remove'); }
                else ctx.sound('nav');
                S.sel = i;
                renderRows(); ctx.save();
              });
              slots.append(b);
            });
            row.append(slots, h('span', { class: 'fb fb-pending', style: { '--fc': Math.ceil(pegs / 2) } }, Array.from({ length: pegs }, () => h('i'))));
          } else {
            for (let i = 0; i < pegs; i++) slots.append(h('span', { class: 'peg ghost' }));
            row.append(slots, h('span', { class: 'fb fb-pending', style: { '--fc': Math.ceil(pegs / 2) } }));
          }
          rowsEl.append(row);
        }
        const cur = rowsEl.children[Math.min(curIdx, rows - 1)];
        if (cur) requestAnimationFrame(() => {
          const top = cur.offsetTop, bottom = top + cur.offsetHeight;
          const viewTop = rowsEl.scrollTop, viewBottom = viewTop + rowsEl.clientHeight;
          if (bottom + 8 > viewBottom) rowsEl.scrollTo({ top: bottom + 8 - rowsEl.clientHeight, behavior: 'smooth' });
          else if (top - 8 < viewTop) rowsEl.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
        });
      }
      function renderPalette() {
        palette.innerHTML = '';
        for (let c = 0; c < colors; c++) {
          const ruled = S.ruled.includes(c);
          const b = h('button', { class: 'cb-color cap' + (ruled ? ' ruled' : ''), type: 'button', style: { '--pc': COLORS[c].c }, 'aria-label': `${COLORS[c].name}${ruled ? ', crossed out' : ''}. Press and hold to ${ruled ? 'restore' : 'cross out'}` },
            svg(`<svg viewBox="0 0 24 24" class="sym" aria-hidden="true">${SYM[c]}</svg>`));
          let timer = 0, held = false;
          b.addEventListener('pointerdown', () => {
            held = false;
            timer = setTimeout(() => {
              held = true;
              const k = S.ruled.indexOf(c);
              if (k >= 0) S.ruled.splice(k, 1); else S.ruled.push(c);
              ctx.sound(k >= 0 ? 'place' : 'remove');
              ctx.haptic('medium');
              renderPalette(); ctx.save();
            }, 430);
          });
          const cancel = () => clearTimeout(timer);
          b.addEventListener('pointerup', cancel);
          b.addEventListener('pointerleave', cancel);
          b.addEventListener('pointercancel', cancel);
          b.addEventListener('contextmenu', (e) => e.preventDefault());
          b.addEventListener('click', () => { if (held) { held = false; return; } choose(c); });
          palette.append(b);
        }
      }
      function renderActions() {
        actions.innerHTML = '';
        const last = S.guesses[S.guesses.length - 1];
        const reuse = h('button', { class: 'cb-act cap', type: 'button', 'aria-label': 'Copy your last guess into this row', disabled: !last || ctx.status !== 'playing' }, BW.ui.icon('repeat'), h('span', null, 'Last'));
        reuse.addEventListener('click', () => {
          if (!last) return;
          for (let i = 0; i < pegs; i++) if (!isLocked(i)) S.cur[i] = last[i];
          S.sel = firstOpen();
          ctx.sound('place');
          renderRows(); ctx.save();
        });
        const del = h('button', { class: 'cb-act cap', type: 'button', 'aria-label': 'Clear a slot', disabled: ctx.status !== 'playing' }, BW.ui.icon('backspace'));
        del.addEventListener('click', backspace);
        const go = h('button', { class: 'cb-go cap', type: 'button', disabled: ctx.status !== 'playing' }, 'Guess');
        go.addEventListener('click', submit);
        actions.append(reuse, del, go);
      }
      function renderAll() { renderSecret(); renderRows(); renderPalette(); renderActions(); }

      /* ----- input ----- */
      function choose(c) {
        if (ctx.status !== 'playing') return;
        if (isLocked(S.sel)) S.sel = firstOpen();
        S.cur[S.sel] = c;
        ctx.sound('place');
        ctx.haptic('light');
        S.sel = firstOpen((S.sel + 1) % pegs);
        renderRows();
        ctx.update();
      }
      function backspace() {
        if (ctx.status !== 'playing') return;
        let i = S.sel;
        if (S.cur[i] == null || isLocked(i)) {
          // clear the last filled, unlocked slot
          i = -1;
          for (let k = pegs - 1; k >= 0; k--) if (S.cur[k] != null && !isLocked(k)) { i = k; break; }
        }
        if (i < 0) { ctx.sound('error'); return; }
        S.cur[i] = null;
        S.sel = i;
        ctx.sound('remove');
        renderRows(); ctx.save();
      }
      function shake(msg) {
        ctx.sound('error');
        ctx.haptic('medium');
        const cur = rowsEl.querySelector('.cb-row.current');
        if (cur) { cur.classList.remove('shake'); void cur.offsetWidth; cur.classList.add('shake'); }
        if (msg) ctx.toast(msg);
      }
      function submit() {
        if (ctx.status !== 'playing') return;
        if (S.cur.some((c) => c == null)) return shake('Fill every slot first.');
        if (!repeat && new Set(S.cur).size !== pegs) return shake('No repeated colors on Easy.');
        const guess = S.cur.slice();
        const [exact, near] = score(guess, P.secret);
        S.guesses.push(guess);
        S.fb.push([exact, near]);
        S.cur = new Array(pegs).fill(null);
        S.revealed.forEach((i) => { S.cur[i] = P.secret[i]; });
        S.sel = firstOpen();
        ctx.sound('submit');
        ctx.haptic('light');
        ctx.update({ moves: S.guesses.length });
        const n = S.guesses.length;
        if (exact === pegs) {
          let stars = n <= P.par ? 3 : n <= P.par + 2 ? 2 : 1;
          if (ctx.hints > 0) stars = Math.min(stars, 2);
          renderAll();
          ctx.finish({ won: true, stars, note: n <= P.par ? `Cracked in ${n}. Par is ${P.par}.` : `Cracked in ${n}. Par is ${P.par}.` });
        } else if (n >= rows) {
          renderAll();
          const code = h('div', { class: 'r-code' }, h('span', { class: 'r-code-label' }, 'The code was'), h('div', { class: 'r-code-pegs' }, P.secret.map((c) => pegEl(c))));
          ctx.finish({ won: false, extra: code });
        } else {
          renderRows();
          renderActions();
        }
      }

      const onKey = (e) => {
        if (BW.sheetsOpen() > 0 || ctx.status !== 'playing') return;
        if (e.key >= '1' && e.key <= String(colors)) choose(Number(e.key) - 1);
        else if (e.key === 'Backspace') backspace();
        else if (e.key === 'Enter') submit();
      };
      document.addEventListener('keydown', onKey);

      renderAll();

      return {
        canHint: () => S.revealed.length < pegs - 1,
        hint() {
          const open = [];
          for (let i = 0; i < pegs; i++) if (!isLocked(i)) open.push(i);
          if (open.length <= 1) return false;
          const i = open[Math.floor(Math.random() * open.length)];
          S.revealed.push(i);
          S.cur[i] = P.secret[i];
          if (S.sel === i) S.sel = firstOpen();
          renderAll();
          const slot = rowsEl.querySelectorAll('.cb-row.current .slot')[i];
          if (slot) slot.classList.add('just-revealed');
          return true;
        },
        noHintText: 'That’s the last hint for this code.',
        onSettings() { renderAll(); },
        destroy() { document.removeEventListener('keydown', onKey); },
      };
    },
  });

  BW._codeBreaker = { score, generate, DIFFS };
})();
