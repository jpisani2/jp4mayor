/* Brainwave — UI kit: icons, pictograms, buttons, sheets, toasts, confetti */
(() => {
  'use strict';
  const { h, svg, reducedMotion } = BW.util;

  /* ---------------- Icons (24px, stroke = currentColor) ---------------- */
  const P = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    back: P('<path d="M15 5l-7 7 7 7"/>'),
    help: P('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>'),
    undo: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    hint: P('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>'),
    restart: P('<path d="M4 4v5h5"/><path d="M4.6 15a8 8 0 1 0 1.8-8.3L4 9"/>'),
    new: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 9.5l.9 1.6 1.6.9-1.6.9-.9 1.6-.9-1.6-1.6-.9 1.6-.9z" fill="currentColor"/>'),
    play: P('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    stats: P('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    settings: P('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>'),
    close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: P('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    chevDown: P('<path d="M6 9l6 6 6-6"/>'),
    chevRight: P('<path d="M9 6l6 6-6 6"/>'),
    backspace: P('<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>'),
    lock: P('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    share: P('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    download: P('<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5"/><path d="M5 20h14"/>'),
    upload: P('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 20h14"/>'),
    trash: P('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>'),
    sun: P('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    repeat: P('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
    star: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2.8l2.75 5.8 6.35.75-4.7 4.35 1.25 6.3L12 16.85 6.35 20l1.25-6.3L2.9 9.35l6.35-.75z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  };
  const icon = (name, cls) => {
    const el = svg(ICONS[name] || ICONS.help);
    if (cls) el.setAttribute('class', cls);
    return el;
  };

  /* ---------------- Game pictograms (48px, drawn in ink + white) ---------------- */
  const INK = '#22213F';
  const PICTS = {
    'lights-out': `<svg viewBox="0 0 48 48"><g stroke="${INK}" stroke-width="2.4">${[0, 1, 2].map((r) => [0, 1, 2].map((c) => {
      const on = [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]].some(([a, b]) => a === r && b === c);
      return `<rect x="${3 + c * 15}" y="${3 + r * 15}" width="12" height="12" rx="3.5" fill="${on ? '#fff' : 'none'}"/>`;
    }).join('')).join('')}</g></svg>`,
    'code-breaker': `<svg viewBox="0 0 48 48"><g stroke="${INK}" stroke-width="2.4"><circle cx="8" cy="18" r="5.5" fill="#fff"/><circle cx="20" cy="18" r="5.5" fill="${INK}"/><circle cx="32" cy="18" r="5.5" fill="#fff"/><circle cx="44" cy="18" r="3.4" fill="none" stroke-dasharray="2.4 2.4"/></g><g fill="${INK}"><circle cx="9" cy="35" r="2.6"/><circle cx="17" cy="35" r="2.6"/></g><circle cx="25" cy="35" r="2.3" fill="none" stroke="${INK}" stroke-width="1.8"/></svg>`,
    nonogram: `<svg viewBox="0 0 48 48"><g fill="${INK}"><rect x="16" y="16" width="9" height="9" rx="2"/><rect x="27" y="16" width="9" height="9" rx="2"/><rect x="27" y="27" width="9" height="9" rx="2"/><rect x="16" y="38" width="9" height="9" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/></g><g fill="${INK}" font-family="Gabarito,sans-serif" font-weight="800" font-size="10"><text x="3" y="24">2</text><text x="3" y="35">1</text><text x="19" y="11">1</text><text x="30" y="11">2</text></g></svg>`,
    binary: `<svg viewBox="0 0 48 48" font-family="Gabarito,sans-serif" font-weight="800" font-size="17"><rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" stroke="${INK}" stroke-width="2.2"/><rect x="26" y="26" width="20" height="20" rx="5" fill="#fff" stroke="${INK}" stroke-width="2.2"/><text x="7.5" y="18" fill="${INK}">1</text><text x="31" y="42" fill="${INK}">1</text><text x="30" y="18" fill="${INK}">0</text><text x="6" y="42" fill="${INK}">0</text></svg>`,
    sudoku: `<svg viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.4"/><path d="M17 3v42M31 3v42M3 17h42M3 31h42" stroke="${INK}" stroke-width="1.6"/><g fill="${INK}" font-family="Gabarito,sans-serif" font-weight="800" font-size="11"><text x="6.5" y="14">5</text><text x="21" y="28">3</text><text x="35" y="42">9</text></g></svg>`,
    river: `<svg viewBox="0 0 48 48" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"><path d="M10 22h28l-4 8H14z" fill="#fff" stroke-linejoin="round"/><path d="M24 22V9l8 9h-8"/><path d="M3 37c4 0 4-3 8-3s4 3 8 3 4-3 8-3 4 3 8 3 4-3 8-3"/></svg>`,
    make24: `<svg viewBox="0 0 48 48"><rect x="3" y="7" width="42" height="34" rx="9" fill="#fff" stroke="${INK}" stroke-width="2.4"/><text x="24" y="32.5" text-anchor="middle" fill="${INK}" font-family="Gabarito,sans-serif" font-weight="900" font-size="20">24</text></svg>`,
    sequence: `<svg viewBox="0 0 48 48" font-family="Gabarito,sans-serif" font-weight="800"><g fill="${INK}" font-size="12"><text x="2" y="20">2</text><text x="14" y="20">4</text><text x="26" y="20">8</text></g><rect x="33" y="7" width="13" height="17" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.2"/><text x="36" y="20.5" font-size="12" fill="${INK}">?</text><path d="M4 33c5-6 9-6 13 0s9 6 13 0 9-6 13 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    jugs: `<svg viewBox="0 0 48 48" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"><path d="M5 12h14v30a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#fff"/><path d="M5 30h14v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="${INK}"/><path d="M26 22h17v20a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" fill="#fff"/><path d="M26 36h17v6a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" fill="${INK}"/></svg>`,
    nim: `<svg viewBox="0 0 48 48" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"><path d="M24 6v8"/><path d="M16 20v8M24 20v8M32 20v8"/><path d="M8 34v8M16 34v8M24 34v8M32 34v8"/><path d="M40 34v8" stroke-opacity=".3"/></svg>`,
  };
  const pict = (id) => svg(PICTS[id] || PICTS['lights-out']);

  /* ---------------- Buttons ---------------- */
  function button(label, opts = {}) {
    const { kind = 'secondary', iconName, onClick, cls = '', attrs = {} } = opts;
    const b = h('button', Object.assign({ class: `btn cap btn-${kind} ${cls}`, type: 'button' }, attrs), iconName ? icon(iconName) : null, label ? h('span', null, label) : null);
    if (onClick) b.addEventListener('click', (e) => { BW.sound('tap'); onClick(e); });
    return b;
  }
  function iconButton(name, label, onClick, cls = '') {
    const b = h('button', { class: `icon-btn ${cls}`, type: 'button', 'aria-label': label, title: label }, icon(name));
    if (onClick) b.addEventListener('click', (e) => { BW.sound('nav'); onClick(e); });
    return b;
  }
  function stars(n, max = 3, cls = '') {
    return h('span', { class: `stars ${cls}`, role: 'img', 'aria-label': `${n} of ${max} stars` },
      Array.from({ length: max }, (_, i) => h('span', { class: 'star' + (i < n ? ' on' : '') }, icon('star'))));
  }

  /* ---------------- Sheets ---------------- */
  let openSheets = 0;
  let toastEl = null, toastTimer = 0;
  const closers = new Set();
  function closeAll() { [...closers].forEach((c) => c()); }
  function sheet({ title, body, actions = [], dismissable = true, onClose, cls = '' }) {
    const backdrop = h('div', { class: 'sheet-backdrop' });
    const panel = h('div', { class: `sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog', tabindex: '-1' },
      h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
      title ? h('h2', { class: 'sheet-title' }, title) : null,
      body || null,
      actions.length ? h('div', { class: 'sheet-actions' }, actions) : null
    );
    const wrap = h('div', { class: 'sheet-wrap' }, backdrop, panel);
    document.body.append(wrap);
    openSheets++;
    if (toastEl) toastEl.classList.remove('show');
    BW.emit('sheet', openSheets);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    setTimeout(() => panel.focus({ preventScroll: true }), 60);
    let closed = false;
    closers.add(close);
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(); };
    document.addEventListener('keydown', onKey);
    function close(val) {
      if (closed) return;
      closed = true;
      closers.delete(close);
      document.removeEventListener('keydown', onKey);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 320);
      openSheets--;
      BW.emit('sheet', openSheets);
      onClose && onClose(val);
    }
    backdrop.addEventListener('click', () => dismissable && close());
    return { close, el: panel };
  }
  BW.sheetsOpen = () => openSheets;

  function confirmSheet({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      let result = false;
      const s = sheet({
        title,
        body: body ? h('p', { class: 'sheet-text' }, body) : null,
        actions: [
          button(ok, { kind: danger ? 'danger' : 'primary', onClick: () => { result = true; s.close(); } }),
          button(cancel, { kind: 'ghost', onClick: () => s.close() }),
        ],
        onClose: () => resolve(result),
      });
    });
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, { action, onAction, ms = 2400 } = {}) {
    if (!toastEl) {
      toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(toastEl);
    }
    toastEl.innerHTML = '';
    toastEl.append(h('span', null, msg));
    if (action) toastEl.append(h('button', { class: 'toast-action', onclick: () => { hide(); onAction && onAction(); } }, action));
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    const hide = () => toastEl.classList.remove('show');
    toastTimer = setTimeout(hide, ms);
  }

  /* ---------------- Confetti ---------------- */
  function confetti(colors = ['#FFC93C', '#45D3B8', '#9C99FF', '#FF94BC', '#FF8E6A']) {
    if (reducedMotion()) return;
    const cv = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
    document.body.append(cv);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const parts = Array.from({ length: 110 }, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const sp = 7 + Math.random() * 9;
      return {
        x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.42,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        w: 6 + Math.random() * 6, hgt: 4 + Math.random() * 6,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: colors[Math.floor(Math.random() * colors.length)],
        round: Math.random() < 0.35,
      };
    });
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save();
        g.globalAlpha = Math.max(0, 1 - t / 1900);
        g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt);
        g.restore();
      }
      if (t < 1900) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* ---------------- Toggle & segmented controls ---------------- */
  function toggle(checked, onChange, label) {
    const input = h('input', { type: 'checkbox', class: 'switch', role: 'switch', 'aria-label': label });
    input.checked = !!checked;
    input.addEventListener('change', () => { BW.sound(input.checked ? 'place' : 'remove'); onChange(input.checked); });
    return input;
  }
  function segmented(options, value, onChange, label) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    const render = () => {
      wrap.innerHTML = '';
      options.forEach((o) => {
        const b = h('button', { type: 'button', class: 'seg-opt' + (o.value === value ? ' on' : ''), role: 'radio', 'aria-checked': String(o.value === value) }, o.label);
        b.addEventListener('click', () => { if (value === o.value) return; value = o.value; BW.sound('tap'); render(); onChange(value); });
        wrap.append(b);
      });
    };
    render();
    return wrap;
  }

  BW.ui = { closeAll, icon, pict, button, iconButton, stars, sheet, confirm: confirmSheet, toast, confetti, toggle, segmented };
})();
