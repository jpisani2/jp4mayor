// Small helpers shared across views

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const parseYmd = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fDow = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const fMonDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fFull = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export const fmtTime = (d) => fTime.format(d).replace(/\s?([AP])\.?M\.?/i, ' $1M');
export const fmtDow = (d) => fDow.format(d);
export const fmtMonDay = (d) => fMonDay.format(d);
export const fmtLong = (d) => fLong.format(d);
export const fmtFull = (d) => fFull.format(d);

export function relDay(d) {
  const t = startOfDay(new Date());
  const x = startOfDay(d);
  const diff = Math.round((x - t) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return fmtLong(d);
}

export function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} hr ago`;
}

// ---- storage (everything prefixed "scores.") ----
export const store = {
  get(key, def) {
    try { const v = localStorage.getItem('scores.' + key); return v == null ? def : JSON.parse(v); } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('scores.' + key, JSON.stringify(val)); } catch { /* storage full or blocked */ }
  },
  del(key) { try { localStorage.removeItem('scores.' + key); } catch { } },
};

// ---- theme ----
export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

// ---- logos ----
// ESPN's image combiner serves resized PNGs, much lighter than the 500px originals.
export function logoSrc(href, px) {
  if (!href) return '';
  const m = href.match(/^https?:\/\/a\.espncdn\.com\/(i\/teamlogos\/[^?]+\.png)/i);
  if (!m) return href;
  let path = m[1];
  if (isDark() && !/-dark\//.test(path)) path = path.replace('/500/', '/500-dark/');
  const s = Math.round(px * 2);
  return `https://a.espncdn.com/combiner/i?img=/${path}&w=${s}&h=${s}`;
}
function lightSrc(href, px) {
  const m = href && href.match(/^https?:\/\/a\.espncdn\.com\/(i\/teamlogos\/[^?]+\.png)/i);
  if (!m) return href || '';
  const s = Math.round(px * 2);
  return `https://a.espncdn.com/combiner/i?img=/${m[1].replace('/500-dark/', '/500/')}&w=${s}&h=${s}`;
}
export function logo(href, px, cls = 'lo') {
  if (!href) return `<span class="${cls} nologo"></span>`;
  const src = logoSrc(href, px);
  // fallbacks: light resized logo, then the original file
  const fb = [...new Set([lightSrc(href, px), href])].filter((u) => u !== src).join(' ');
  return `<img class="${cls}" src="${esc(src)}" data-fb="${esc(fb)}" width="${px}" height="${px}" alt="" loading="lazy" decoding="async">`;
}
// Walk the fallback list if a logo fails (e.g. no dark variant); hide if nothing loads.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const list = (img.dataset.fb || '').split(' ').filter(Boolean);
  if (list.length) { img.dataset.fb = list.slice(1).join(' '); img.src = list[0]; }
  else img.style.visibility = 'hidden';
}, true);

export const hex = (c) => (c && /^[0-9a-f]{6}$/i.test(c) ? '#' + c : null);

// Pick a team color that reads on the current background.
export function readableColor(primary, alt) {
  const dark = isDark();
  for (const c of [primary, alt]) {
    const h = hex(c);
    if (!h) continue;
    const l = lum(h);
    if (dark ? l > 0.07 : l < 0.82) return h;
  }
  return dark ? '#8a867f' : '#55524d';
}
export function lum(h) {
  const n = parseInt(h.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function colorDistance(a, b) {
  if (!a || !b) return 999;
  const p = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export function toast(msg, ms = 2600) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

// Pull-to-refresh for a scroll container. Works with iOS rubber-band
// (scrollTop goes negative) and with plain touch dragging elsewhere.
export function attachPTR(scroller, onRefresh) {
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<span class="ptr-spin"></span>';
  scroller.prepend(ind);
  let startY = null, pulled = 0, busy = false;
  const THRESH = 64;
  const show = (d) => {
    ind.style.opacity = Math.min(1, d / THRESH);
    ind.style.transform = `translateY(${Math.min(d, THRESH * 1.4) * 0.6}px) rotate(${d * 4}deg)`;
    ind.classList.toggle('armed', d >= THRESH);
  };
  const reset = () => { ind.style.opacity = 0; ind.style.transform = ''; ind.classList.remove('armed'); };
  scroller.addEventListener('touchstart', (e) => {
    if (busy) return;
    startY = scroller.scrollTop <= 0 ? e.touches[0].clientY : null; pulled = 0;
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (startY == null || busy) return;
    const native = -scroller.scrollTop; // iOS bounce
    const drag = e.touches[0].clientY - startY;
    pulled = Math.max(native, scroller.scrollTop <= 0 ? drag : 0);
    if (pulled > 4) show(pulled); else reset();
  }, { passive: true });
  scroller.addEventListener('touchend', async () => {
    if (startY == null || busy) return;
    startY = null;
    if (pulled >= THRESH) {
      busy = true;
      ind.classList.add('spinning');
      ind.style.opacity = 1;
      try { await onRefresh(); } finally {
        busy = false; ind.classList.remove('spinning'); reset();
      }
    } else reset();
  });
}
