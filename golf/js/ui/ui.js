// Small DOM toolkit: element builder, modals, toasts, icons.
import { sfx } from '../core/audio.js';
import { haptic } from '../core/haptics.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);

export function btn(label, onClick, cls = '') {
  return h('button', { class: `btn ${cls}`, onclick: (e) => { sfx.click(); haptic('light'); onClick?.(e); } }, typeof label === 'string' ? h('span', { html: label }) : label);
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

export function modal({ title, body, actions = [], cls = '', dismiss = true }) {
  return new Promise((resolve) => {
    const close = (v) => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 250); resolve(v); };
    const wrap = h('div', { class: `modal-wrap ${cls}`, onclick: (e) => { if (dismiss && e.target === wrap) close(null); } },
      h('div', { class: 'modal' },
        title ? h('div', { class: 'modal-title' }, title) : null,
        h('div', { class: 'modal-body' }, body),
        actions.length ? h('div', { class: 'modal-actions' }, actions.map((a) => btn(a.label, () => close(a.value ?? a.label), a.cls || ''))) : null));
    document.body.append(wrap);
    setTimeout(() => wrap.classList.add('show'), 16);
    wrap._close = close;
  });
}
export async function confirmDialog(title, msg, ok = 'OK', danger = false) {
  const r = await modal({ title, body: h('p', {}, msg), actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: ok, value: true, cls: danger ? 'danger' : 'primary' }] });
  return r === true;
}
export async function promptDialog(title, value = '', placeholder = '') {
  const input = h('input', { class: 'field', value, placeholder, maxlength: 40 });
  setTimeout(() => input.focus(), 250);
  const r = await modal({ title, body: input, actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save', value: 'ok', cls: 'primary' }] });
  return r === 'ok' ? input.value.trim() : null;
}

export function slider({ label, min, max, step = 1, value, unit = '', fmt, onInput }) {
  const out = h('span', { class: 'sl-val' });
  const show = (v) => { out.textContent = fmt ? fmt(v) : `${v}${unit}`; };
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { show(+inp.value); onInput?.(+inp.value); });
  show(value);
  return h('label', { class: 'slider' }, h('div', { class: 'sl-top' }, h('span', {}, label), out), inp);
}
export function segmented(options, value, onChange) {
  const el = h('div', { class: 'seg' });
  for (const [v, label] of options) {
    const b = h('button', { class: v === value ? 'on' : '', onclick: () => { sfx.tick(); el.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(v); } }, label);
    el.append(b);
  }
  return el;
}
export function toggle(label, value, onChange) {
  const inp = h('input', { type: 'checkbox' });
  inp.checked = !!value;
  inp.addEventListener('change', () => { sfx.tick(); onChange(inp.checked); });
  return h('label', { class: 'toggle' }, h('span', {}, label), inp, h('i'));
}
export function select(options, value, onChange) {
  const s = h('select', { class: 'field', onchange: () => onChange(s.value) }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  return s;
}

export function confetti(n = 120) {
  const colors = ['#ffd34a', '#ff5a4a', '#4ad1ff', '#7cff8a', '#ffffff', '#c47cff'];
  const box = h('div', { class: 'confetti' });
  for (let i = 0; i < n; i++) {
    const p = h('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${2 + Math.random() * 1.6}s`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4500);
}

const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICONS = {
  back: P('<path d="M15 18l-6-6 6-6"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  undo: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
  redo: P('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'),
  play: P('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  map: P('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  grid: P('<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  cam: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'),
  share: P('<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  star: P('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>'),
  starFill: P('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z" fill="currentColor"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  flag: P('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6" fill="currentColor"/>'),
  select: P('<path d="M5 3l14 7-6 2-2 6z"/>'),
  brush: P('<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 1-1 3-2 4 4 0 8-1 9-4"/>'),
  eraser: P('<path d="M7 21h10M3 15l8-8 7 7-6 6H6z"/><path d="M11 7l3-3 7 7-3 3"/>'),
  tree: P('<path d="M12 22v-6"/><path d="M12 2l-6 9h3l-4 6h14l-4-6h3z"/>'),
  mountain: P('<path d="M2 20l7-12 4 6 3-4 6 10z"/>'),
  shape: P('<path d="M4 14c0-6 4-10 9-10s7 4 7 8-4 8-9 8-7-2-7-6z"/>'),
  bench: P('<path d="M3 11h18M5 11v8M19 11v8M4 7h16v4H4z"/>'),
  hole: P('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'),
  eye: P('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  layers: P('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  fit: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  dice: P('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  check: P('<path d="M5 12l5 5L20 7"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  rotate: P('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  minus: P('<path d="M5 12h14"/>'),
  route: P('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17c0-6 12-4 12-10"/>'),
  scale: P('<path d="M4 20L20 4M14 4h6v6M10 20H4v-6"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'),
  download: P('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  upload: P('<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  wind: P('<path d="M3 8h11a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h7"/>'),
  card: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>'),
  target: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
};
export const icon = (name, cls = '') => h('i', { class: `ic ${cls}`, html: ICONS[name] || '' });
