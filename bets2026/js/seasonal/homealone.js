/* ===========================================================================
   Home Alone (the holidays, 2026). Two themes:

     homealone        night: a snowed-in house after dark, every window lit,
                      lights along the roof, snow falling, rigged for
                      intruders.
     homealone-light  Christmas morning: sun on fresh snow, icicles, frost at
                      the corners, and the evidence of last night's traps.

   Like every seasonal theme (see js/theme.js), this exports THEMES, CSS,
   dress(), chime() and friends. Everything drawn here is drawn for this app:
   no movie stills, no photos of the actors, none of the movie's people. The
   party cutouts and the delivery guy are original. The two phone backdrop
   photos are free-license Unsplash shots of snowy houses (credits in the
   README); if Unsplash can't be reached, the painted sky and every drawn
   piece still show.

   Three layers, all outside #app so the redraw on every change never
   restarts them, none of which takes a tap or is read by screen readers:

     #homealone   phones and laptops: sky, snow, string lights, a tree, the
                  front door, and a trap now and then.
     #ha-stage    the big screen: the house from John's reference photo (the
                  approved v2-1 prototype), with the party train, the
                  delivery run, and the game extras wired into it.
   =========================================================================== */

import { spider as tarantula } from "./halloween.js";

export const SEASON = "homealone";

export const THEMES = [
  { id: "homealone",       name: "Home Alone",       note: "a snowed-in house after dark, rigged for intruders" },
  { id: "homealone-light", name: "Home Alone light", note: "Christmas morning, and the evidence of last night's traps" },
];

export const CSS = new URL("./homealone.css", import.meta.url).href;

/* The day the theme went live. The ornament trees count wins from here on,
   and the Man of the House crown only goes to nights closed out since. */
export const SINCE = "2026-11-08";

const FONT = "https://fonts.googleapis.com/css2?family=Mountains+of+Christmas:wght@700&display=swap";

/* ---------------------------------------------------------------------------
   Lines that stand in for the usual wording while either theme is on. All
   in one place so the wording is easy to change. Screens ask for them with
   flavor(key, usual) from theme.js; under any other theme they get usual.
   --------------------------------------------------------------------------- */

const DAY = 86400000;
function toChristmas(now = new Date()) {
  const y = now.getFullYear();
  const today = new Date(y, now.getMonth(), now.getDate());
  let xmas = new Date(y, 11, 25);
  if (today > xmas) xmas = new Date(y + 1, 11, 25);
  return Math.round((xmas - today) / DAY);
}

export const STRINGS = {
  seatHeading:  "Who's home tonight?",
  gameOpen:     "Two guys in a van were spotted on the block.",
  locked:       "The house is locked down.",
  settle:       "Pay up before the family gets back from Paris.",
  loading:      "Setting the traps…",
  emptyBoard:   "Quiet house. Too quiet.",
  oneSided:     "Nobody took the bait.",
  boardHeader:  "Order up: tonight's board",
  offline:      "The power's out on the block.",
  awardMan:     "Man of the House",
  awardBandits: "The Wet Bandits",
  awardLeft:    "Left Behind",
  idleCorner: () => {
    const n = toChristmas();
    return n === 0 ? "Merry Christmas" : `${n} day${n === 1 ? "" : "s"} to Christmas`;
  },
};

/* ---------------------------------------------------------------------------
   Sound. All synthesized here, nothing recorded.
   --------------------------------------------------------------------------- */

/* One sleigh bell: a bright, inharmonic strike that dies fast. */
function bell(c, t, f, level = 0.05) {
  [1, 2.76, 5.4].forEach((k, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = i ? "sine" : "triangle";
    o.frequency.setValueAtTime(f * k, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level / (i + 1), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16 + 0.05 / (i + 1));
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.25);
  });
}

/* A short wash of bright noise, the jingle under the bells. */
function shimmer(c, t, dur = 0.5, level = 0.035) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  hp.type = "highpass"; hp.frequency.value = 6500;
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hp).connect(g).connect(c.destination);
  src.start(t);
}

/* New bet: a sleigh-bell jingle in place of the beep. */
export function chime(c) {
  const t = c.currentTime;
  [0, 0.12, 0.24, 0.42, 0.5, 0.58].forEach((dt, i) =>
    bell(c, t + dt, 2100 + (i % 3) * 180 + Math.random() * 60));
  shimmer(c, t, 0.75);
}

/* A bet locks: a knock at the door. */
export function lockChime(c) {
  const t = c.currentTime;
  [0, 0.17].forEach(dt => {
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t + dt);
    o.frequency.exponentialRampToValueAtTime(70, t + dt + 0.09);
    lp.type = "lowpass"; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(0.32, t + dt + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.14);
    o.connect(lp).connect(g).connect(c.destination);
    o.start(t + dt); o.stop(t + dt + 0.16);
  });
}

/* A bet is graded: a sleigh-bell flourish, climbing. */
export function gradeChime(c) {
  const t = c.currentTime;
  [1568, 1760, 2093, 2349, 2637, 3136].forEach((f, i) => bell(c, t + i * 0.07, f, 0.045));
  shimmer(c, t + 0.2, 0.9, 0.03);
}

/* ---------------------------------------------------------------------------
   Small shared drawings.
   --------------------------------------------------------------------------- */

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r1 = (a, b) => a + rnd() * (b - a);
const f = n => n.toFixed(1);
const range = n => Array.from({ length: n }, (_, i) => i);
const BULBS = ["#ff3b3b", "#2fd36b", "#ffc93c", "#3d8bff"];

function wreath(cx, cy, r, bigBow) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#133d24" stroke-width="${r * .6}"/>`;
  for (let a = 0; a < 360; a += 20) { const t = a * Math.PI / 180;
    s += `<circle cx="${f(cx + Math.cos(t) * r)}" cy="${f(cy + Math.sin(t) * r)}" r="${f(r * .27)}" fill="${a % 40 ? "#1d5a33" : "#174a2a"}"/>`; }
  for (let a = 30; a < 360; a += 45) { const t = a * Math.PI / 180;
    s += `<circle cx="${f(cx + Math.cos(t) * r * 1.05)}" cy="${f(cy + Math.sin(t) * r * 1.05)}" r="${f(r * .1)}" fill="#e3242b"/>`; }
  const by = bigBow ? cy - r * .85 : cy + r * .9, k = bigBow ? 1.5 : 1;
  s += `<path d="M${cx} ${by} c${-r * .3 * k} ${-r * .45 * k} ${-r * .85 * k} ${-r * .35 * k} ${-r * .7 * k} ${r * .1 * k} c${r * .1 * k} ${r * .3 * k} ${r * .4 * k} ${r * .1 * k} ${r * .7 * k} ${-r * .1 * k} Z
          M${cx} ${by} c${r * .3 * k} ${-r * .45 * k} ${r * .85 * k} ${-r * .35 * k} ${r * .7 * k} ${r * .1 * k} c${-r * .1 * k} ${r * .3 * k} ${-r * .4 * k} ${r * .1 * k} ${-r * .7 * k} ${-r * .1 * k} Z" fill="#d01822"/>`;
  s += `<path d="M${cx - 2} ${by + 2} q${-r * .2} ${r * .7} ${-r * .5} ${r * 1.4} l${r * .2} ${r * .05} q${r * .2} ${-r * .6} ${r * .35} ${-r * 1.4} Z M${cx + 2} ${by + 2} q${r * .2} ${r * .7} ${r * .5} ${r * 1.4} l${-r * .2} ${r * .05} q${-r * .2} ${-r * .6} ${-r * .35} ${-r * 1.4} Z" fill="#a8121a"/>`;
  return s + `<circle cx="${cx}" cy="${by}" r="${f(r * .16)}" fill="#e3242b"/>`;
}

/* A paint can on its bail handle. */
const paintCan = `<svg viewBox="0 0 60 70" aria-hidden="true">
  <path d="M10 22 Q30 -4 50 22" fill="none" stroke="#3a3f47" stroke-width="2.6"/>
  <rect x="8" y="20" width="44" height="46" rx="4" fill="#9aa3ad"/>
  <rect x="8" y="20" width="44" height="46" rx="4" fill="url(#ha-cansheen)"/>
  <rect x="8" y="30" width="44" height="22" fill="#e9ecef"/>
  <rect x="8" y="30" width="44" height="5" fill="#c62d2d"/>
  <ellipse cx="30" cy="20" rx="22" ry="4" fill="#7e8892"/>
  <path d="M14 20 q2 10 0 14 q-2 4 2 6 q4 -3 1 -8 q-2 -6 3 -12 Z" fill="#f5f5f2"/>
  <defs><linearGradient id="ha-cansheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/>
    <stop offset=".35" stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
</svg>`;

const toyCar = color => `<svg viewBox="0 0 60 30" aria-hidden="true">
  <path d="M4 20 L8 12 Q10 9 14 9 L22 9 L28 3 L42 3 L48 9 L54 10 Q58 11 58 15 L58 20 Z" fill="${color}"/>
  <path d="M30 5 L40 5 L45 9 L26 9 Z" fill="#bfe3ff" opacity=".8"/>
  <circle cx="16" cy="22" r="5" fill="#141414"/><circle cx="46" cy="22" r="5" fill="#141414"/>
  <circle cx="16" cy="22" r="2" fill="#9aa"/><circle cx="46" cy="22" r="2" fill="#9aa"/>
</svg>`;

const marble = c => `<i class="ha-marble" style="--c:${c}"></i>`;

const footprint = `<svg viewBox="0 0 20 34" aria-hidden="true"><ellipse cx="10" cy="22" rx="7" ry="10"/><ellipse cx="10" cy="6" rx="5" ry="5"/></svg>`;

/* A Christmas tree with blinking lights and a star. */
function tree() {
  seed = 23;
  const tiers = [[60, 22, 28], [60, 44, 40], [60, 70, 52], [60, 98, 64]];
  let s = `<svg viewBox="0 0 120 140" aria-hidden="true">
    <rect x="53" y="118" width="14" height="16" fill="#4a2c18"/>`;
  tiers.forEach(([cx, y, w]) => {
    s += `<path d="M${cx} ${y - 22} L${cx + w} ${y + 22} Q${cx} ${y + 28} ${cx - w} ${y + 22} Z" fill="#14532d"/>`;
    s += `<path d="M${cx - w * .9} ${y + 19} Q${cx} ${y + 24} ${cx + w * .9} ${y + 19} Q${cx + w * .4} ${y + 14} ${cx} ${y + 17} Q${cx - w * .4} ${y + 14} ${cx - w * .9} ${y + 19} Z" fill="#eaf2fb" opacity=".9"/>`;
  });
  range(26).forEach(i => {
    const t = r1(.1, .97), y = 4 + t * 118, half = t * 60;
    const x = 60 + r1(-.85, .85) * half;
    s += `<circle class="ha-bulb" cx="${f(x)}" cy="${f(y)}" r="2.6" fill="${BULBS[i % 4]}" style="--d:${r1(.9, 2.4).toFixed(2)}s;--dl:-${r1(0, 2).toFixed(2)}s"/>`;
  });
  s += `<path class="ha-star" d="M60 -12 l4 9 l10 1 l-7.5 6.5 l2.5 10 l-9 -5.5 l-9 5.5 l2.5 -10 l-7.5 -6.5 l10 -1 Z" fill="#ffe27a"/>`;
  return s + `</svg>`;
}

/* The front door, with its wreath and the steps (which ice over by morning). */
function door() {
  return `<svg viewBox="0 0 120 170" aria-hidden="true">
    <rect x="6" y="0" width="108" height="150" fill="#ece6da"/>
    <rect x="18" y="12" width="84" height="138" fill="#0d0e12"/>
    <g fill="none" stroke="#24262c" stroke-width="2.5"><rect x="28" y="24" width="28" height="48"/><rect x="64" y="24" width="28" height="48"/>
      <rect x="28" y="82" width="28" height="56"/><rect x="64" y="82" width="28" height="56"/></g>
    <circle cx="92" cy="84" r="3" fill="#c9a24e"/>
    ${wreath(60, 58, 17, true)}
    <g class="ha-steps"><rect x="0" y="150" width="120" height="10" fill="#9c958a"/><rect x="-10" y="160" width="140" height="10" fill="#8d867b"/></g>
    <g class="ha-ice"><path d="M2 150 L118 150 L118 153 L2 153 Z M-8 160 L128 160 L128 163 L-8 163 Z" fill="#dff4ff"/>
      <path class="ha-glint" d="M30 151 l3 -6 l3 6 l6 1 l-6 1 l-3 6 l-3 -6 l-6 -1 Z" fill="#fff"/>
      <path class="ha-glint ha-g2" d="M88 161 l2.5 -5 l2.5 5 l5 1 l-5 1 l-2.5 5 l-2.5 -5 l-5 -1 Z" fill="#fff"/></g>
  </svg>`;
}

/* A strand drooping across the top of the screen, swag after swag. */
function strand() {
  const W = 1800, swag = 150, n = W / swag;
  let wire = "", bulbs = "", k = 0;
  for (let i = 0; i < n; i++) {
    const x0 = i * swag, x1 = x0 + swag, mid = x0 + swag / 2;
    wire += `M${x0} 6 Q${mid} 46 ${x1} 6 `;
    for (let j = 1; j <= 5; j++) {
      const t = j / 6, x = x0 + swag * t, y = 6 + 80 * t * (1 - t);
      bulbs += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f((t - .5) * -30)})"><rect x="-2.6" y="0" width="5.2" height="4" rx="1" fill="#2a2d33"/>
        <path class="ha-b ha-c${k % 4}" style="--i:${k};--d:${(1 + (k * 7919 % 13) / 9).toFixed(2)}s;--dl:-${((k * 104729) % 23 / 10).toFixed(1)}s" d="M0 3 C5 6 5 15 0 19 C-5 15 -5 6 0 3 Z"/></g>`;
      k++;
    }
  }
  return `<svg viewBox="0 0 ${W} 70" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    <path d="${wire}" fill="none" stroke="#1d2a1d" stroke-width="2"/>${bulbs}</svg>`;
}

/* Icicles hanging along the top edge, for Christmas morning. */
function icicles() {
  seed = 41;
  let d = "M0 0 ";
  for (let x = 0; x < 1800;) {
    const w = r1(8, 22), h = rnd() < .3 ? r1(28, 60) : r1(8, 22);
    d += `L${f(x)} 4 L${f(x + w / 2)} ${f(h)} L${f(x + w)} 4 `;
    x += w + r1(0, 10);
  }
  d += "L1800 0 Z";
  return `<svg viewBox="0 0 1800 64" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    <defs><linearGradient id="ha-ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe3ff" stop-opacity=".75"/></linearGradient></defs>
    <rect width="1800" height="6" fill="#f4f9ff"/><path d="${d}" fill="url(#ha-ice)"/></svg>`;
}

/* The snowbank piled along the bottom edge. */
function drift() {
  seed = 57;
  let d = "M0 60 L0 34 ";
  for (let x = 0; x <= 1800; x += 60) d += `Q${f(x + 30)} ${f(r1(10, 26))} ${f(x + 60)} ${f(r1(26, 36))} `;
  d += "L1800 60 Z";
  return `<svg viewBox="0 0 1800 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="#f2f6fc"/><path d="${d}" fill="url(#ha-driftshade)"/>
    <defs><linearGradient id="ha-driftshade" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#9fb3d6" stop-opacity="0"/><stop offset="1" stop-color="#9fb3d6" stop-opacity=".5"/></linearGradient></defs>
  </svg>`;
}

/* ---------------------------------------------------------------------------
   Snow, on a canvas. Three layers at different sizes and speeds: small and
   slow far away, big and quick up close. Fewer flakes on a phone, none at
   all with reduce motion, and nothing drawn while the tab is in the
   background or the canvas is hidden.
   --------------------------------------------------------------------------- */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function snowfall(canvas, { density = 5200, cap = 320, phoneCap = 70 } = {}) {
  const x = canvas.getContext("2d");
  let W = 0, H = 0, Dp = 1, flakes = [], t = 0, stopped = false;
  const LAYERS = [
    { z: .15, r: .9, vy: .35, a: .45 },
    { z: .5,  r: 1.7, vy: .75, a: .7 },
    { z: 1,   r: 2.9, vy: 1.35, a: .9 },
  ];
  function size() {
    Dp = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = canvas.clientWidth * Dp;
    H = canvas.height = canvas.clientHeight * Dp;
    const area = canvas.clientWidth * canvas.clientHeight;
    const n = Math.round(Math.min(innerWidth < 700 ? phoneCap : cap, area / density));
    flakes = range(n).map(i => {
      const L = LAYERS[i % 3];
      return { x: Math.random() * W, y: Math.random() * H, L, ph: Math.random() * 6.28,
               r: (L.r + Math.random() * .6) * Dp, vy: (L.vy + Math.random() * .25) * Dp };
    });
  }
  function frame() {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (document.hidden || !canvas.getClientRects().length) return;
    if (canvas.clientWidth * Dp !== W) size();
    t += 1 / 60;
    x.clearRect(0, 0, W, H);
    x.fillStyle = "#fff";
    for (const fl of flakes) {
      fl.y += fl.vy;
      fl.x += (Math.sin(t * .7 + fl.ph) * .45 * (.4 + fl.L.z) + .15) * Dp;
      if (fl.y > H + 6) { fl.y = -6; fl.x = Math.random() * W; }
      if (fl.x > W + 6) fl.x = -6;
      x.globalAlpha = fl.L.a;
      x.beginPath(); x.arc(fl.x, fl.y, fl.r, 0, 6.283); x.fill();
    }
  }
  size();
  addEventListener("resize", size);
  requestAnimationFrame(frame);
  return () => { stopped = true; removeEventListener("resize", size); };
}

/* ---------------------------------------------------------------------------
   The phone and laptop backdrop.
   --------------------------------------------------------------------------- */

const ID = "homealone";
let stopSnow = null, trapTimer = null, chaseTimer = null;

function build() {
  const el = document.createElement("div");
  el.id = ID;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="ha-sky"></div>
    <div class="ha-frost ha-frost-l"></div><div class="ha-frost ha-frost-r"></div>
    <canvas class="ha-snow"></canvas>
    <div class="ha-beam"></div>
    <div class="ha-lights">${strand()}</div>
    <div class="ha-icicles">${icicles()}</div>
    <div class="ha-can"><div class="ha-rope"></div>${paintCan}</div>
    <div class="ha-spider"><div class="ha-thread"></div>${tarantula}</div>
    <div class="ha-prints">${range(7).map(i => `<span class="ha-print ha-p${i}">${footprint}</span>`).join("")}</div>
    <div class="ha-drift">${drift()}</div>
    <div class="ha-tree">${tree()}</div>
    <div class="ha-door">${door()}</div>
    <div class="ha-floor">
      <div class="ha-toy ha-toy1">${toyCar("#d6262b")}</div>
      <div class="ha-toy ha-toy2">${toyCar("#2b62d6")}</div>
      ${["#4fb3ff", "#ffcc33", "#ff5a5a", "#6fe08a", "#d0d0ff", "#ff9f40"].map(marble).join("")}
    </div>
    <div class="ha-evidence">
      <div class="ha-tipped">${paintCan}</div>
      ${["#4fb3ff", "#ffcc33", "#ff5a5a"].map(marble).join("")}
      <div class="ha-toy ha-toyrest">${toyCar("#d6262b")}</div>
    </div>`;
  return el;
}

/* One trap at a time, at random, every 30 to 90 seconds. Which ones can
   go off depends on the hour: the flashlight needs the dark, and the front
   steps only ice over by morning. */
const TRAPS = {
  can:    { ms: 7000,  when: "both" },
  cars:   { ms: 6500,  when: "both" },
  beam:   { ms: 5000,  when: "night" },
  prints: { ms: 14000, when: "both" },
  spider: { ms: 11000, when: "both" },
  ice:    { ms: 4500,  when: "morning" },
};

function springTrap() {
  const el = document.getElementById(ID);
  if (!el) return;
  const morning = document.documentElement.dataset.theme === "homealone-light";
  if (!document.hidden && !reduced() && el.getClientRects().length) {
    const pool = Object.entries(TRAPS).filter(([, t]) =>
      t.when === "both" || t.when === (morning ? "morning" : "night"));
    const [name, trap] = pool[Math.floor(Math.random() * pool.length)];
    el.dataset.trap = name;
    setTimeout(() => { if (el.dataset.trap === name) delete el.dataset.trap; }, trap.ms);
  }
  trapTimer = setTimeout(springTrap, 30000 + Math.random() * 60000);
}

/* Every so often the bulbs stop twinkling and run a chase. */
function chase() {
  const el = document.getElementById(ID);
  if (!el) return;
  el.classList.add("ha-chasing");
  setTimeout(() => el.classList.remove("ha-chasing"), 4800);
  chaseTimer = setTimeout(chase, 22000 + Math.random() * 14000);
}

function loadFont() {
  if (document.querySelector(`link[href="${FONT}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT;
  document.head.appendChild(link);
}

/* On or off; harmless to call repeatedly. Switching between night and
   morning keeps the same layer — the stylesheet decides what shows. */
export function dress(on) {
  const have = document.getElementById(ID);
  if (!on) {
    if (have) { have.remove(); stopSnow?.(); stopSnow = null; }
    clearTimeout(trapTimer); clearTimeout(chaseTimer);
    return;
  }
  loadFont();
  if (have) return;
  const el = build();
  document.body.prepend(el);
  if (!reduced()) stopSnow = snowfall(el.querySelector(".ha-snow"), { density: 6500, cap: 220, phoneCap: 60 });
  clearTimeout(trapTimer); clearTimeout(chaseTimer);
  trapTimer = setTimeout(springTrap, 8000 + Math.random() * 12000);
  chaseTimer = setTimeout(chase, 15000);
}

/* ===========================================================================
   The big screen: the house.

   Drawn from John's reference photo — the approved v2-1 prototype, as it
   was signed off, with the plain van down the street added at night and the
   morning version alongside. Pure SVG and CSS, a canvas for the snow and a
   short script for the delivery run. No images.
   =========================================================================== */

/* ---------- layout ---------- */
const G = 652;                                   // porch / house base
const MX0 = 330, MX1 = 1270;                     // main block
const CORN = 254, CORNB = 286;                   // main cornice top / bottom
const U = [441, 591, 798, 1009, 1162], UW = 70, UH = 112, UT = 304;     // upstairs windows
const D = [435, 588, 1012, 1165], DW = 88, DH = 166, DT = 470;          // French doors
const DX = 798;                                  // front door
const W1 = 702, W1B = 742, W2 = 794, W2B = 828;  // terrace walls (top, bottom)
const ST0 = 724, ST1 = 872;                      // steps, left and right
const SIL = "#2a1207";

/* What changes between night and morning. Everything else is shared. */
const PALETTE = {
  night: {
    sky: ["#020309", "#070b1d", "#141a33"], stars: true, far: "#0b1024",
    room: "url(#room)", roomdeep: "url(#roomdeep)", warm: "#ffe7b0", lit: true,
    wall: [".55", ".25", ".12"], roofsnow: ["#b9c5dc", "#7d8aa8"], ground: ["#8090b5", "#4a5678"],
    wing: ".22", vig: ".7", walk: "#3f4866", garden: "#0b0d14", garden2: "#0a0c12", smoke: "#8f9bbd",
    capsnow: "#eef3fb", dark: "#0a0f1c",
  },
  morning: {
    sky: ["#5d9ad6", "#9cc6ec", "#e3f0fa"], stars: false, far: "#7d8ea8",
    room: "url(#dayglass)", roomdeep: "url(#dayglass)", warm: "#d7dbe2", lit: false,
    wall: [".12", ".05", ".0"], roofsnow: ["#ffffff", "#dfe8f6"], ground: ["#ffffff", "#d7e2f2"],
    wing: ".0", vig: ".18", walk: "#8d97ac", garden: "#cfd9e8", garden2: "#c3cfe1", smoke: "#c8d0de",
    capsnow: "#ffffff", dark: "#4e5d70",
  },
};

let P = PALETTE.night;

const head = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const torso = (sh, wa, top) =>
  `<path d="M${-sh} ${top + 6} Q${-sh - 4} ${top + 8} ${-sh - 4} ${top + 18} L${-wa} 0 L${wa} 0 L${sh + 4} ${top + 18} Q${sh + 4} ${top + 8} ${sh} ${top + 6} Q${sh * .45} ${top - 2} 0 ${top - 2} Q${-sh * .45} ${top - 2} ${-sh} ${top + 6} Z"/>`;
const legs = (w) => `<path d="M${-w} 0 L${-w + 3} 70 L-3 70 L0 8 L3 70 L${w - 3} 70 L${w} 0 Z"/>`;
const neck = (top) => `<rect x="-5" y="${top - 12}" width="10" height="14" rx="3"/>`;
const arm = (d, w = 10) => `<path d="${d}" fill="none" stroke="${SIL}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const glass = (x, y) => `<path d="M${x - 7} ${y - 14} L${x + 7} ${y - 14} L${x + 2} ${y - 3} L${x - 2} ${y - 3} Z"/><rect x="${x - 1}" y="${y - 3}" width="2" height="7"/><rect x="${x - 5}" y="${y + 3}" width="10" height="2"/>`;
const FIG = {
  suit: () => head(0, -116, 13) + neck(-98) + torso(30, 23, -96) + legs(22),
  toast: () => FIG.suit() + arm("M27 -86 Q46 -100 40 -134") + glass(40, -138),
  lady: () => `<ellipse cx="0" cy="-127" rx="15" ry="10"/>` + head(0, -112, 12) + neck(-96) +
    `<circle cx="-24" cy="-86" r="10"/><circle cx="24" cy="-86" r="10"/>` + torso(24, 16, -94) + `<path d="M-16 0 L-30 70 L30 70 L16 0 Z"/>`,
  hat: () => `<ellipse cx="0" cy="-125" rx="23" ry="4.5"/><path d="M-13 -125 Q-14 -144 0 -145 Q14 -144 13 -125 Z"/>` + head(0, -114, 13) + neck(-97) + torso(31, 24, -95) + legs(23),
  santa: () => `<path d="M-15 -122 Q-6 -150 16 -146 Q24 -144 26 -132 Q14 -140 15 -122 Z"/><circle cx="27" cy="-130" r="6"/><rect x="-17" y="-126" width="34" height="8" rx="4"/>` + head(0, -112, 13) + neck(-96) + torso(32, 26, -94) + legs(25),
  long: () => `<path d="M-16 -112 Q-18 -132 0 -133 Q18 -132 16 -112 L19 -84 L-19 -84 Z"/>` + head(0, -114, 12) + neck(-96) + torso(24, 17, -92) + `<path d="M-17 0 L-26 70 L26 70 L17 0 Z"/>`,
  big: () => head(0, -112, 15) + neck(-94) + torso(38, 33, -92) + arm("M-36 -80 Q-44 -46 -26 -40") + `<rect x="10" y="-112" width="18" height="3.5" rx="1.5"/>` + legs(31),
  wave: () => `<ellipse cx="0" cy="-127" rx="14" ry="9"/>` + head(0, -113, 12) + neck(-97) + torso(25, 17, -94) + arm("M-23 -86 Q-44 -104 -38 -138", 9) + `<path d="M-17 0 L-28 70 L28 70 L17 0 Z"/>`,
  couple: () => `<g transform="translate(-17 0)">${FIG.lady()}</g><g transform="translate(19 2) rotate(-4)">${FIG.suit()}</g>` + arm("M-4 -78 Q8 -70 4 -58", 9),
};

/* Warm-white mini lights. Most are steady; a few twinkle. Unlit by day. */
function dots(pts, r = 2.1, color = P.warm) {
  return pts.map(([x, y]) => {
    const t = P.lit && rnd() < .18 ? ` class="tw" style="--d:${r1(.8, 2.6).toFixed(2)}s;--dl:${(-r1(0, 3)).toFixed(2)}s"` : "";
    if (!P.lit) rnd();
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${P.lit ? r : r * .8}" fill="${P.lit ? color : "#c6ccd6"}"${t}/>`;
  }).join("");
}
function rectPts(x, y, w, h, every) {
  const pts = [], per = 2 * (w + h), n = Math.round(per / every);
  for (let i = 0; i < n; i++) {
    let d = i * per / n;
    if (d < w) pts.push([x + d, y]); else if ((d -= w) < h) pts.push([x + w, y + d]);
    else if ((d -= h) < w) pts.push([x + w - d, y + h]); else pts.push([x, y + h - (d - w)]);
  }
  return pts;
}
function outline(x, y, w, h, every = 11) {
  return (P.lit ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ffd98a" stroke-width="7" opacity=".55" filter="url(#glow)"/>` : "") +
    dots(rectPts(x, y, w, h, every));
}
function sash(x, y, w, h, cols, rows, sw = 2.6) {
  let s = `<g stroke="#f1ece2" stroke-width="${sw}" fill="none">`;
  for (let i = 1; i < cols; i++) s += `<line x1="${f(x + w * i / cols)}" x2="${f(x + w * i / cols)}" y1="${y}" y2="${y + h}"/>`;
  for (let j = 1; j < rows; j++) s += `<line x1="${x}" x2="${x + w}" y1="${f(y + h * j / rows)}" y2="${f(y + h * j / rows)}"/>`;
  return s + `</g>`;
}
function shutters(cx, top, w, h, gap = 8) {
  const sw = w * .46;
  const one = x => `<rect x="${f(x)}" y="${top}" width="${f(sw)}" height="${h}" fill="#0d0e11"/>` +
    `<rect x="${f(x + 5)}" y="${top + 6}" width="${f(sw - 10)}" height="${f(h * .45 - 8)}" fill="none" stroke="#24262c" stroke-width="2"/>` +
    `<rect x="${f(x + 5)}" y="${f(top + h * .45 + 4)}" width="${f(sw - 10)}" height="${f(h * .55 - 10)}" fill="none" stroke="#24262c" stroke-width="2"/>`;
  return one(cx - w / 2 - gap - sw) + one(cx + w / 2 + gap);
}
const sheers = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sheer)" opacity="${P.lit ? .42 : .6}"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hem)"/>`;
function snowcap(x, y, w, t = 5) {
  return `<path d="M${f(x - 3)} ${f(y + 1)} q${f(w * .25)} ${-t - 2} ${f(w * .5)} ${-t} q${f(w * .3)} 1 ${f(w * .5 + 6)} ${t - 1} Z" fill="${P.capsnow}"/>`;
}
function tinyTree(cx, base, h) {
  let s = `<path d="M${cx} ${base - h} L${cx + h * .38} ${base} L${cx - h * .38} ${base} Z" fill="#163a24"/>`;
  const pts = []; for (let i = 0; i < 18; i++) { const t = r1(.15, .95); pts.push([cx + r1(-.32, .32) * h * t, base - h + t * h]); }
  const cols = ["#ff4d4d", "#4dd17a", "#ffd04d", "#4d9bff"];
  s += pts.map(([x, y], i) => `<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${cols[i % 4]}" class="tw" style="--d:${r1(.8, 2).toFixed(2)}s;--dl:-${r1(0, 2).toFixed(2)}s"/>`).join("");
  return s + `<path d="M${cx} ${base - h - 9} l3 6 l7 0 l-5 4 l2 7 l-7 -4 l-7 4 l2 -7 l-5 -4 l7 0 Z" fill="#ffe27a"/>`;
}
function shrubs(x0, x1, base, hMin, hMax) {
  let body = "", caps = "", pts = [];
  for (let x = x0; x < x1; x += r1(38, 54)) {
    const r = r1(hMin, hMax), cx = x + r1(-6, 6), cy = base - r * .62;
    body += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 1.08)}" ry="${f(r * .74)}" fill="${rnd() < .5 ? "#0f2a17" : "#13321c"}"/>`;
    caps += `<path d="M${f(cx - r * .9)} ${f(cy - r * .3)} Q${f(cx)} ${f(cy - r * 1.02)} ${f(cx + r * .9)} ${f(cy - r * .3)} Q${f(cx + r * .3)} ${f(cy - r * .55)} ${f(cx)} ${f(cy - r * .45)} Q${f(cx - r * .4)} ${f(cy - r * .55)} ${f(cx - r * .9)} ${f(cy - r * .3)} Z" fill="${P.lit ? "#dfe8f5" : "#ffffff"}"/>`;
    for (let k = 0; k < r * .9; k++) {
      const a = r1(0, Math.PI * 2), d = Math.sqrt(rnd());
      pts.push([cx + Math.cos(a) * d * r, cy + Math.sin(a) * d * r * .68]);
    }
  }
  return `<g>${body}</g>` + (P.lit ? `<g filter="url(#glowS)" opacity=".7">${pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#ffd77a"/>`).join("")}</g>` : "") +
    caps + (P.lit ? dots(pts, 1.5, "#fff2c8") : "");
}
function branch(x, y, len, ang, w, depth, out) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  out.push(`<path d="M${f(x)} ${f(y)} L${f(x2)} ${f(y2)}" stroke-width="${f(Math.max(w, .6))}"/>`);
  if (depth <= 0) return;
  const n = depth > 3 ? 2 : 3;
  for (let i = 0; i < n; i++) branch(x2, y2, len * r1(.62, .8), ang + r1(-.6, .6), w * .66, depth - 1, out);
}
function wrappedTree(cx, base, h) {
  let s = `<path d="M${cx - 3} ${base} L${cx - 2} ${base - h * .55} L${cx + 2} ${base - h * .55} L${cx + 3} ${base} Z" fill="#1a120c"/>`;
  const out = []; branch(cx, base - h * .5, h * .22, -Math.PI / 2, 3, 4, out);
  s += `<g stroke="#1a120c" stroke-linecap="round" fill="none">${out.join("")}</g>`;
  const pts = []; for (let y = base; y > base - h * .5; y -= 7) pts.push([cx + (Math.round((base - y) / 7) % 2 ? 3 : -3), y]);
  for (let i = 0; i < 70; i++) { const a = r1(-Math.PI, 0), d = Math.sqrt(rnd()) * h * .42; pts.push([cx + Math.cos(a) * d * 1.1, base - h * .55 + Math.sin(a) * d * .9]); }
  if (!P.lit) return s;
  return s + `<g filter="url(#glowS)" opacity=".6">${pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#ffd77a"/>`).join("")}</g>` + dots(pts, 1.6, "#fff2c8");
}
function stoneWall(x0, x1, top, bot) {
  let s = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bot - top}" fill="#5d5a55"/>`;
  for (let y = top + 2; y < bot - 2; y += r1(5, 8)) {
    const h = r1(4, 7);
    for (let x = x0 + r1(-20, 0); x < x1; x += r1(18, 46)) {
      const w = r1(16, 44), c = Math.round(r1(110, 150));
      s += `<rect x="${f(Math.max(x, x0))}" y="${f(y)}" width="${f(Math.min(w, x1 - Math.max(x, x0)))}" height="${f(h)}" fill="rgb(${c},${c - 6},${c - 14})" opacity=".7"/>`;
    }
  }
  s += `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bot - top}" fill="url(#wallnight)"/>`;
  s += `<rect x="${x0 - 2}" y="${top - 5}" width="${x1 - x0 + 4}" height="7" fill="#8f8b84"/>`;
  return s + `<path d="M${x0 - 3} ${top - 3} Q${(x0 + x1) / 2} ${top - 12} ${x1 + 3} ${top - 3} Z" fill="${P.lit ? "#e5ecf7" : "#ffffff"}"/>`;
}

/* A window one of tonight's players lights up. Dark until someone is home
   to take it; it fades on and off rather than snapping. */
let slotCount = 0;
function slot(x, y, w, h, opacity) {
  const k = slotCount++;
  return `<g class="slot" data-slot="${k}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.lit ? "url(#roomdeep)" : "url(#daylamp)"}" opacity="${opacity}"/>
    <rect class="off" x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.lit ? P.dark : "url(#dayglass)"}"/></g>`;
}

/* The order windows light in as players arrive: the dormers first, then
   out along the wings. */
const SLOT_ORDER = [16, 17, 3, 11, 2, 10, 7, 15, 6, 14, 18, 1, 9, 19, 0, 8, 20, 5, 13, 4, 12];

function wing(x0, x1, side) {
  let s = "";
  const top = 316, base = G;
  if (side < 0) {
    s += `<path d="M${x0 - 20} ${top} L${x1 + 4} ${top} L${x1 + 4} 214 L${x0 + 60} 214 Z" fill="url(#roof)"/>`;
    s += `<path d="M${x0 - 20} ${top - 6} L${x0 + 60} 218 L${x1 + 4} 218 L${x1 + 4} ${top - 10} q-60 6 -120 0 q-70 7 -130 -2 q-50 6 -94 4 Z" fill="url(#roofsnow)"/>`;
  } else {
    s += `<rect x="${x0 - 4}" y="${top - 40}" width="${x1 - x0 + 30}" height="40" fill="${P.lit ? "#0b0d14" : "#5a6272"}"/>`;
    for (let x = x0 + 6; x < x1 + 20; x += 13) s += `<rect x="${x}" y="${top - 36}" width="6" height="28" rx="3" fill="#d8d2c6"/>`;
    s += `<rect x="${x0 - 6}" y="${top - 44}" width="${x1 - x0 + 34}" height="8" fill="#e2dccf"/><rect x="${x0 - 6}" y="${top - 8}" width="${x1 - x0 + 34}" height="6" fill="#e2dccf"/>`;
    s += snowcap(x0 - 6, top - 44, x1 - x0 + 34, 5);
    s += `<rect x="${x0 + 14}" y="${top - 112}" width="${x1 - x0 - 4}" height="70" fill="${P.lit ? "#141821" : "#c9c2b4"}"/>`;
    [x0 + 60, x0 + 150, x0 + 240].forEach(cx => {
      s += slot(cx - 26, top - 104, 52, 60, .75) + sash(cx - 26, top - 104, 52, 60, 2, 3, 2) + outline(cx - 26, top - 104, 52, 60, 10);
    });
  }
  s += `<rect x="${x0 - 22}" y="${top}" width="${x1 - x0 + 44}" height="20" fill="#e5dfd3"/><rect x="${x0 - 22}" y="${top + 20}" width="${x1 - x0 + 44}" height="10" fill="url(#soffit)"/>`;
  s += `<rect x="${x0}" y="${top + 20}" width="${x1 - x0}" height="${base - top - 20}" fill="url(#brick)"/><rect x="${x0}" y="${top + 20}" width="${x1 - x0}" height="${base - top - 20}" fill="url(#wallnight)"/>`;
  s += `<rect x="${x0}" y="${top + 20}" width="${x1 - x0}" height="${base - top - 20}" fill="#03050c" opacity="${P.wing}"/>`;
  const xs = side < 0 ? [x0 + 44, x0 + 124, x0 + 204, x0 + 284] : [x1 - 284, x1 - 204, x1 - 124, x1 - 44];
  [[350, 104, 2, 4], [474, 156, 2, 5]].forEach(([yt, h, c, rws]) => {
    s += `<rect x="${xs[0] - 36}" y="${yt - 8}" width="${xs[3] - xs[0] + 72}" height="${h + 16}" fill="#d9d2c5"/><rect x="${xs[0] - 36}" y="${yt - 8}" width="${xs[3] - xs[0] + 72}" height="${h + 16}" fill="#03050c" opacity="${P.lit ? .35 : .08}"/>`;
    xs.forEach((cx, j) => {
      r1(4, 8);   // keeps the rest of the drawing exactly as approved
      s += slot(cx - 26, yt, 52, h, (j + (side < 0 ? 0 : 1)) % 3 ? .78 : .6);
      s += sheers(cx - 26, yt, 52, h) + `<rect x="${cx - 26}" y="${yt}" width="52" height="${h}" fill="#2a1406" opacity="${P.lit ? .3 : .08}"/>` + sash(cx - 26, yt, 52, h, c, rws, 2.2);
      s += `<rect x="${cx - 26}" y="${yt}" width="52" height="${h}" fill="none" stroke="#e9e3d7" stroke-width="4"/>`;
      s += outline(cx - 29, yt - 3, 58, h + 6, 11);
    });
    s += snowcap(xs[0] - 40, yt + h + 8, xs[3] - xs[0] + 80, 4);
  });
  return s;
}

/* The plain, unmarked van, parked in the shadows down the street. */
const van = () => `<g id="ha-van" transform="translate(1356 846) scale(.62)" opacity=".92">
  <ellipse cx="120" cy="40" rx="130" ry="7" fill="#000" opacity=".35"/>
  <path d="M0 30 L0 -40 Q0 -52 12 -52 L170 -52 Q182 -52 188 -42 L222 -6 Q232 2 232 14 L232 30 Z" fill="#141a26"/>
  <path d="M176 -44 L214 -8 L176 -8 Z" fill="#0b0f18"/><rect x="10" y="-44" width="150" height="34" fill="#0f141e"/>
  <line x1="120" y1="-48" x2="120" y2="28" stroke="#0a0d14" stroke-width="2"/>
  <path d="M0 -52 q60 -8 172 -2 l2 4 q-100 -5 -174 2 Z" fill="#cbd6ea" opacity=".85"/>
  ${[44, 190].map(x => `<circle cx="${x}" cy="30" r="17" fill="#07090d"/><circle cx="${x}" cy="30" r="7" fill="#3a3f48"/>`).join("")}
  <rect x="224" y="2" width="8" height="8" rx="2" fill="#3b3f46"/>
</g>`;

/* Leaning by the front door the morning after. */
const crowbar = () => `<g id="ha-crowbar">
  <path d="M858 ${G - 2} L842 ${G - 92} q-2 -10 6 -12 l6 -1" fill="none" stroke="#2c2f36" stroke-width="5" stroke-linecap="round"/>
  <path d="M858 ${G - 2} l5 -3" stroke="#2c2f36" stroke-width="5" stroke-linecap="round"/>
  <path d="M843 ${G - 88} L852 ${G - 6}" stroke="#7b818c" stroke-width="1.2" opacity=".7"/></g>`;

/* The traps' aftermath, by daylight: a paint can tipped over on the steps,
   marbles everywhere, a toy car, and tracks in the snow. */
const aftermath = () => {
  seed = 77;
  let s = `<g id="ha-aftermath">`;
  s += `<g transform="translate(748 ${G + 30}) rotate(78)"><rect x="-16" y="-20" width="32" height="38" rx="3" fill="#9aa3ad"/><rect x="-16" y="-10" width="32" height="16" fill="#e9ecef"/>
    <rect x="-16" y="-10" width="32" height="4" fill="#c62d2d"/><ellipse cx="0" cy="-20" rx="16" ry="3.5" fill="#7e8892"/></g>`;
  s += `<path d="M770 ${G + 25} q30 -4 52 8 q18 10 -6 14 q-30 4 -48 -6 Z" fill="#f4f4f0"/>`;
  range(16).forEach(i => s += `<circle cx="${f(r1(ST0 + 6, ST1 - 6))}" cy="${f(G + 10 + r1(0, 120))}" r="${f(r1(2.6, 3.6))}" fill="${["#4fb3ff", "#ffcc33", "#ff5a5a", "#6fe08a"][i % 4]}"/>`);
  s += `<g transform="translate(830 ${G - 12}) scale(.6)">${toyCar("#d6262b").replace(/<\/?svg[^>]*>/g, "")}</g>`;
  for (let k = 0; k < 9; k++) {
    const x = 560 - k * 48, y = 852 - k * 3;
    s += `<ellipse cx="${x}" cy="${y + (k % 2 ? 6 : 0)}" rx="7" ry="4" fill="#b7c6de"/>`;
  }
  return s + `</g>`;
};

/* The party train: cutouts riding a hidden loop behind the sheer curtains
   on the French doors. Tonight's players ride with name tags, the leader up
   front; with more players than cutouts the train just gets longer. */
const KINDS = ["toast", "lady", "hat", "couple", "santa", "big", "wave", "long", "suit", "lady", "toast", "hat"];
const GAP = 105;

const escSvg = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function train(names) {
  seed = 97;
  const n = Math.max(KINDS.length, names.length);
  const L = n * GAP;
  const riders = shift => range(n).map(i => {
    const k = KINDS[i % KINDS.length], x = i * GAP;
    const s = r1(.82, .92);
    const name = names[n - 1 - i];   // the front of the train is the far right
    const spin = (k === "toast" || k === "hat") && !name ? `class="spin" style="--d:${r1(6, 10).toFixed(1)}s"` : "";
    const tag = name ? `<g class="tag"><rect x="-30" y="-78" width="60" height="18" rx="3" fill="#fff6e0" stroke="#c0262b" stroke-width="1.5"/>
      <text x="0" y="-64.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#2a1207"
        font-family="ui-sans-serif,system-ui,sans-serif">${escSvg(name.length > 9 ? name.slice(0, 8) + "…" : name)}</text></g>` : "";
    return `<g transform="translate(${x + shift} ${DT + 138}) scale(${s.toFixed(3)})"><g class="ride" style="--d:${r1(1.2, 2).toFixed(2)}s;--dl:${(-r1(0, 2)).toFixed(2)}s"><g filter="url(#soft)" opacity=".9"><g ${spin} fill="${SIL}">${FIG[k]()}</g></g>${tag}</g></g>`;
  }).join("");
  return `<g class="train" style="--loop:${L}px;animation-duration:${(L / 25).toFixed(1)}s">${riders(260 - L)}${riders(260)}</g>`;
}

/* The pizzas: one box up to six, with the money in play on open bets. */
const stackOnStep = n => range(n).map(i => {
  const y = G - 6 - i * 8, x = DX - 35 + (i % 2 ? 1 : 0) + (i % 3 === 2 ? 2 : 0);
  return `<rect x="${x}" y="${y}" width="34" height="8" fill="${i % 2 ? "#cca46c" : "#d8b47e"}"/><rect x="${x}" y="${y + 3}" width="34" height="2" fill="#c0262b"/>`;
}).join("");
const stackCarried = n => range(n).map(i => {
  const y = -58 - i * 8;
  return `<rect x="${6 + (i % 2)}" y="${y}" width="38" height="8" fill="${i % 2 ? "#cca46c" : "#d8b47e"}"/><rect x="${6 + (i % 2)}" y="${y + 3}" width="38" height="2" fill="#c0262b"/>`;
}).join("");

function buildHouse(variant) {
  P = PALETTE[variant];
  seed = 11;
  slotCount = 0;
  const night = variant === "night";

  let svg = `<svg viewBox="-540 0 2680 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.sky[0]}"/><stop offset=".55" stop-color="${P.sky[1]}"/><stop offset="1" stop-color="${P.sky[2]}"/>
  </linearGradient>
  <pattern id="brick" width="44" height="16" patternUnits="userSpaceOnUse">
    <rect width="44" height="16" fill="#3a1a14"/>
    <rect x=".8" y=".8" width="20.6" height="6.6" fill="#7a3426"/><rect x="22.8" y=".8" width="20.6" height="6.6" fill="#6c2d21"/>
    <rect x="-10.2" y="8.8" width="20.6" height="6.6" fill="#64291f"/><rect x="11.8" y="8.8" width="20.6" height="6.6" fill="#7f3829"/><rect x="33.8" y="8.8" width="20.6" height="6.6" fill="#64291f"/>
  </pattern>
  <pattern id="brick2" width="44" height="16" patternUnits="userSpaceOnUse" patternTransform="translate(9 5)">
    <rect width="44" height="16" fill="none"/>
    <rect x=".8" y=".8" width="20.6" height="6.6" fill="#8a3b2b" opacity=".35"/><rect x="11.8" y="8.8" width="20.6" height="6.6" fill="#4e2018" opacity=".35"/>
  </pattern>
  <linearGradient id="wallnight" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#03050c" stop-opacity="${P.wall[0]}"/><stop offset=".5" stop-color="#03050c" stop-opacity="${P.wall[1]}"/><stop offset="1" stop-color="#03050c" stop-opacity="${P.wall[2]}"/>
  </linearGradient>
  <linearGradient id="soffit" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe6b8" stop-opacity="${night ? .45 : 0}"/><stop offset="1" stop-color="#ffe6b8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1f26"/><stop offset="1" stop-color="#2b2f38"/></linearGradient>
  <linearGradient id="roofsnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.roofsnow[0]}"/><stop offset="1" stop-color="${P.roofsnow[1]}"/></linearGradient>
  <linearGradient id="groundsnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.ground[0]}"/><stop offset="1" stop-color="${P.ground[1]}"/></linearGradient>
  <radialGradient id="room" cx="50%" cy="55%" r="72%">
    <stop offset="0" stop-color="#fff0c8"/><stop offset=".6" stop-color="#ffd690"/><stop offset="1" stop-color="#e9a95a"/>
  </radialGradient>
  <radialGradient id="roomdeep" cx="50%" cy="55%" r="72%">
    <stop offset="0" stop-color="#ffe2a2"/><stop offset=".6" stop-color="#f4b866"/><stop offset="1" stop-color="#c98035"/>
  </radialGradient>
  <linearGradient id="dayglass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8d9fb5"/><stop offset=".45" stop-color="#5f7189"/><stop offset=".5" stop-color="#9fb2c8"/><stop offset="1" stop-color="#55657b"/>
  </linearGradient>
  <radialGradient id="daylamp" cx="50%" cy="60%" r="70%"><stop offset="0" stop-color="#ffe9b8"/><stop offset="1" stop-color="#d9a868"/></radialGradient>
  <pattern id="sheer" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="#fffaf0" opacity=".35"/><rect width="3.5" height="10" fill="#fff" opacity=".45"/>
  </pattern>
  <linearGradient id="hem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".2" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="spill" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc874" stop-opacity="${night ? .42 : 0}"/><stop offset="1" stop-color="#ffc874" stop-opacity="0"/></radialGradient>
  <radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd590" stop-opacity="${night ? .5 : 0}"/><stop offset="1" stop-color="#ffd590" stop-opacity="0"/></radialGradient>
  <radialGradient id="lamp" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${night ? "#fff6d8" : "#e6e1d6"}"/><stop offset=".5" stop-color="${night ? "#ffd47a" : "#cfc8b8"}"/><stop offset="1" stop-color="${night ? "#d99a3a" : "#a9a291"}"/></radialGradient>
  <radialGradient id="vig" cx="50%" cy="52%" r="78%"><stop offset=".6" stop-color="#020308" stop-opacity="0"/><stop offset="1" stop-color="#020308" stop-opacity="${P.vig}"/></radialGradient>
  <linearGradient id="car" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8282c"/><stop offset=".6" stop-color="#8e1a1f"/><stop offset="1" stop-color="#5e0f13"/></linearGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff8d8" stop-opacity=".55"/><stop offset="1" stop-color="#fff8d8" stop-opacity="0"/></linearGradient>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="glowS" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation=".9"/></filter>
  <filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <clipPath id="fdclip">${D.map(cx => `<rect x="${cx - DW / 2}" y="${DT}" width="${DW}" height="${DH}"/>`).join("")}</clipPath>
  ${U.map((cx, i) => `<clipPath id="u${i}"><rect x="${cx - UW / 2}" y="${UT}" width="${UW}" height="${UH}"/></clipPath>`).join("")}
</defs>`;

  /* sky and the dark beyond — wider than the prototype (which was 1600
     across), so a wide TV never runs out of street at the sides */
  svg += `<rect x="-580" width="2760" height="900" fill="url(#sky)"/>`;
  if (P.stars) for (let i = 0; i < 100; i++) svg += `<circle cx="${f(r1(-560, 2160))}" cy="${f(r1(0, 260))}" r="${f(r1(.4, 1.2))}" fill="#cfd8ff" opacity="${f(r1(.1, .45))}"/>`;
  else for (let i = 0; i < 100; i++) { rnd(); rnd(); rnd(); rnd(); }
  if (!night) svg += `<circle cx="1480" cy="110" r="70" fill="#fff9e0" opacity=".55" filter="url(#blur6)"/><circle cx="1480" cy="110" r="34" fill="#fffdf2"/>`;
  const far = []; for (let x = -580; x < 2200; x += r1(90, 160)) branch(x, 560, r1(110, 170), -Math.PI / 2 + r1(-.1, .1), r1(6, 10), 6, far);
  svg += `<g stroke="${P.far}" stroke-linecap="round" fill="none">${far.join("")}</g>`;
  svg += `<rect x="-580" y="560" width="2760" height="340" fill="${P.garden}"/>`;

  /* side wings */
  svg += wing(-30, MX0, -1) + wing(MX1, 1630, 1);

  /* main block: roof, chimney, dormers */
  svg += `<path d="M314 ${CORN} L1286 ${CORN} L1176 118 L424 118 Z" fill="url(#roof)"/>`;
  svg += `<path d="M322 ${CORN - 6} L428 122 L1172 122 L1278 ${CORN - 6} q-60 8 -120 1 q-70 8 -140 0 q-70 8 -140 -1 q-70 8 -140 0 q-70 9 -140 1 q-60 7 -112 -1 Z" fill="url(#roofsnow)"/>`;
  svg += `<path d="M424 120 L1176 120" stroke="${night ? "#e3ebf8" : "#ffffff"}" stroke-width="5"/>`;
  svg += `<rect x="1060" y="70" width="58" height="90" fill="url(#brick)"/><rect x="1060" y="70" width="58" height="90" fill="url(#wallnight)"/><rect x="1054" y="62" width="70" height="10" fill="#26150f"/>`;
  svg += `<path d="M1052 64 q18 -12 36 -6 q22 -8 38 4 l0 3 l-74 0 Z" fill="${night ? "#e1e9f6" : "#ffffff"}"/>`;
  svg += `<g class="smoke" filter="url(#blur6)" fill="${P.smoke}">${[0, -3.3, -6.6].map(dl => `<circle cx="1089" cy="56" r="15" style="--dl:${dl}s"/>`).join("")}</g>`;
  [598, 998].forEach(cx => {
    svg += `<rect x="${cx - 48}" y="150" width="96" height="${CORN - 146}" fill="#e7e1d5"/><rect x="${cx - 48}" y="150" width="96" height="${CORN - 146}" fill="url(#wallnight)"/>`;
    svg += `<path d="M${cx - 60} 154 L${cx} 104 L${cx + 60} 154 Z" fill="#ece6da"/><path d="M${cx - 46} 148 L${cx} 114 L${cx + 46} 148 Z" fill="#d7d0c3"/>`;
    svg += `<path d="M${cx - 64} 154 L${cx} 100 L${cx + 64} 154 L${cx + 54} 154 L${cx} 110 L${cx - 54} 154 Z" fill="${night ? "#e3ebf8" : "#ffffff"}"/>`;
    r1(4, 7);
    svg += slot(cx - 27, 166, 54, 74, 1) + sheers(cx - 27, 166, 54, 74);
    svg += sash(cx - 27, 166, 54, 74, 3, 4, 2.2) + `<rect x="${cx - 27}" y="166" width="54" height="74" fill="none" stroke="#f1ece2" stroke-width="4"/>`;
    svg += outline(cx - 31, 162, 62, 82, 10);
    svg += snowcap(cx - 34, 244, 68, 4);
  });

  /* main block: walls and cornice */
  svg += `<rect x="${MX0}" y="${CORNB}" width="${MX1 - MX0}" height="${G - CORNB}" fill="url(#brick)"/>`;
  svg += `<rect x="${MX0}" y="${CORNB}" width="${MX1 - MX0}" height="${G - CORNB}" fill="url(#brick2)"/>`;
  svg += `<rect x="${MX0}" y="${CORNB}" width="${MX1 - MX0}" height="${G - CORNB}" fill="url(#wallnight)"/>`;
  [...U.map(cx => [cx, UT + UH / 2, 1]), ...D.map(cx => [cx, DT + DH / 2, 1.3]), [DX, 560, 1.5]].forEach(([cx, cy, k]) =>
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="${100 * k}" ry="${95 * k}" fill="url(#spill)" style="mix-blend-mode:screen"/>`);
  svg += `<rect x="310" y="${CORN}" width="980" height="22" fill="#ece7dc"/><rect x="316" y="${CORN + 22}" width="968" height="10" fill="#d6d0c4"/>`;
  svg += `<rect x="${MX0}" y="${CORNB}" width="${MX1 - MX0}" height="34" fill="url(#soffit)"/>`;
  for (let x = 318; x < 1284; x += r1(16, 36)) {
    const h = rnd() < .18 ? r1(14, 28) : r1(3, 11);
    svg += `<path d="M${f(x)} ${CORN + 22} l3 0 l-1.5 ${f(h)} Z" fill="#dce6f7" opacity=".8"/>`;
  }

  /* upstairs windows, each with someone (or something) in it */
  U.forEach((cx, i) => {
    const x = cx - UW / 2;
    svg += shutters(cx, UT - 2, UW, UH + 4, 9);
    svg += `<rect x="${x - 6}" y="${UT - 16}" width="${UW + 12}" height="12" fill="#5b2419"/>`;
    for (let k = x - 4; k < x + UW + 6; k += 5) svg += `<line x1="${k}" x2="${k}" y1="${UT - 16}" y2="${UT - 4}" stroke="#2c110b" stroke-width="1"/>`;
    svg += `<rect x="${x}" y="${UT}" width="${UW}" height="${UH}" fill="${P.room}" class="room" style="--d:${r1(4, 8).toFixed(1)}s"/>`;
    let inside = "";
    if (i === 1) inside = `<g transform="translate(${cx} ${UT + UH + 8}) scale(.72)"><g class="dance"><g fill="${SIL}">
        <ellipse cx="0" cy="-128" rx="14" ry="9"/>${head(0, -113, 12)}${neck(-97)}${torso(24, 17, -94)}</g>
        <g class="arms">${arm("M-22 -86 Q-44 -106 -36 -140", 9)}${arm("M22 -86 Q44 -106 36 -140", 9)}</g></g></g>
        <g stroke="#2a1508" stroke-width="1" opacity=".5"><line x1="${cx - 26}" y1="${UT}" x2="${cx - 26}" y2="${UT + 32}"/><line x1="${cx + 26}" y1="${UT}" x2="${cx + 26}" y2="${UT + 32}"/></g>`;
    else if (i === 3) inside = `<g transform="translate(${cx} ${UT + UH + 8}) scale(.68)"><g class="sway" fill="${SIL}">${FIG.couple()}</g></g>`;
    else if (i === 4) inside = tinyTree(cx + 6, UT + UH, 80);
    else if (i === 0) inside = `<g fill="${SIL}" opacity=".85"><path d="M${cx - 28} ${UT + 58} L${cx - 12} ${UT + 58} L${cx - 8} ${UT + 78} L${cx - 32} ${UT + 78} Z"/><rect x="${cx - 21}" y="${UT + 78}" width="3" height="34"/></g>`;
    else inside = `<g transform="translate(${cx + 14} ${UT + UH + 8}) scale(.66)"><g class="sway" style="animation-duration:5s" fill="${SIL}">${FIG.hat()}</g></g>`;
    svg += `<g clip-path="url(#u${i})"><g filter="url(#soft)" opacity="${night ? 1 : .55}">${inside}</g>${sheers(x, UT, UW, UH)}</g>`;
    svg += sash(x, UT, UW, UH / 2, 3, 2) + sash(x, UT + UH / 2, UW, UH / 2, 3, 2);
    svg += `<rect x="${x}" y="${UT}" width="${UW}" height="${UH}" fill="none" stroke="#f1ece2" stroke-width="5"/><line x1="${x}" x2="${x + UW}" y1="${UT + UH / 2}" y2="${UT + UH / 2}" stroke="#f1ece2" stroke-width="4"/>`;
    svg += `<rect x="${x - 6}" y="${UT + UH}" width="${UW + 12}" height="7" fill="#d8d1c3"/>` + snowcap(x - 7, UT + UH + 1, UW + 14, 4);
    svg += outline(x - 4, UT - 4, UW + 8, UH + 8, 11);
  });

  /* French doors, with the party train behind them */
  D.forEach(cx => {
    const x = cx - DW / 2;
    svg += shutters(cx, DT - 2, DW, DH + 2, 9);
    svg += `<rect x="${cx - 22}" y="${DT - 26}" width="44" height="16" fill="#c9c1b2"/><rect x="${cx - 22}" y="${DT - 26}" width="44" height="16" fill="url(#wallnight)"/>`;
    svg += `<rect x="${x}" y="${DT}" width="${DW}" height="${DH}" fill="${P.room}" class="room" style="--d:${r1(3, 6).toFixed(1)}s"/>`;
  });
  svg += `<g clip-path="url(#fdclip)"><g id="ha-train" opacity="${night ? 1 : .6}"></g>
    ${D.map(cx => sheers(cx - DW / 2, DT, DW, DH)).join("")}</g>`;
  D.forEach(cx => {
    const x = cx - DW / 2;
    svg += sash(x, DT, DW / 2, DH, 2, 5, 2.4) + sash(x + DW / 2, DT, DW / 2, DH, 2, 5, 2.4);
    svg += `<rect x="${x}" y="${DT}" width="${DW}" height="${DH}" fill="none" stroke="#f1ece2" stroke-width="6"/><line x1="${cx}" x2="${cx}" y1="${DT}" y2="${DT + DH}" stroke="#f1ece2" stroke-width="5"/>`;
    svg += `<rect x="${x}" y="${DT + DH - 26}" width="${DW}" height="26" fill="#ece6da"/>`;
    svg += `<rect x="${cx - 7}" y="${DT + 92}" width="3" height="12" fill="#c9a24e"/><rect x="${cx + 4}" y="${DT + 92}" width="3" height="12" fill="#c9a24e"/>`;
    svg += outline(x - 4, DT - 4, DW + 8, DH + 6, 11);
  });

  /* the entry: arched portico, lantern, black door */
  svg += `<ellipse cx="${DX}" cy="560" rx="170" ry="150" fill="url(#spill)" style="mix-blend-mode:screen"/>`;
  svg += `<path d="M718 ${G} L718 488 Q${DX} 418 878 488 L878 ${G} Z" fill="url(#brick)"/>`;
  svg += `<path d="M718 ${G} L718 488 Q${DX} 418 878 488 L878 ${G} Z" fill="#ffb760" opacity="${night ? .16 : 0}"/>`;
  svg += `<path d="M736 ${G} L736 500 Q${DX} 446 860 500 L860 ${G}" fill="none" stroke="#5b2419" stroke-width="12"/>`;
  svg += `<path d="M742 530 A56 30 0 0 1 854 530 Z" fill="${P.room}"/>`;
  svg += `<g stroke="#f1ece2" stroke-width="2.4">${[-60, -30, 0, 30, 60].map(a => `<line x1="${DX}" y1="530" x2="${f(DX + 56 * Math.sin(a * Math.PI / 180))}" y2="${f(530 - 30 * Math.cos(a * Math.PI / 180))}"/>`).join("")}</g>`;
  svg += `<path d="M742 530 A56 30 0 0 1 854 530" fill="none" stroke="#f1ece2" stroke-width="5"/>`;
  svg += `<rect x="740" y="530" width="116" height="${G - 530}" fill="#f1ece2"/>`;
  [[746, 22], [828, 22]].forEach(([x, w]) => {
    svg += `<rect x="${x}" y="538" width="${w}" height="${G - 548}" fill="${P.room}"/>` + sheers(x, 538, w, G - 548) + sash(x, 538, w, G - 548, 1, 4, 2);
  });
  svg += `<rect x="772" y="536" width="52" height="${G - 536}" fill="#0a0b0e"/>`;
  svg += `<g fill="none" stroke="#1b1d22" stroke-width="2.5"><rect x="778" y="546" width="18" height="40"/><rect x="800" y="546" width="18" height="40"/><rect x="778" y="594" width="18" height="48"/><rect x="800" y="594" width="18" height="48"/></g>`;
  svg += `<rect x="790" y="600" width="16" height="4" fill="#c9a24e"/><circle cx="816" cy="600" r="2.6" fill="#c9a24e"/>`;
  svg += wreath(DX, 566, 15, true);
  [700, 878].forEach(x => {
    svg += `<rect x="${x}" y="492" width="18" height="${G - 492}" fill="#ece6da"/><rect x="${x + 12}" y="492" width="6" height="${G - 492}" fill="#c8c1b3"/>`;
    svg += `<rect x="${x - 4}" y="488" width="26" height="8" fill="#f4efe5"/><rect x="${x - 4}" y="${G - 8}" width="26" height="8" fill="#f4efe5"/>`;
  });
  svg += `<path d="M676 494 L676 480 Q${DX} 396 920 480 L920 494 Q${DX} 414 676 494 Z" fill="#f2ede3"/>`;
  svg += `<path d="M676 494 Q${DX} 414 920 494 L920 500 Q${DX} 422 676 500 Z" fill="#cfc8ba"/>`;
  svg += `<path d="M672 482 Q${DX} 392 924 482 Q${DX} 404 672 482 Z" fill="${night ? "#e8eef9" : "#ffffff"}"/>`;
  svg += `<line x1="${DX}" y1="452" x2="${DX}" y2="470" stroke="#0b0c10" stroke-width="2"/>`;
  svg += `<circle cx="${DX}" cy="492" r="46" fill="url(#pool)" style="mix-blend-mode:screen"/>`;
  svg += `<path d="M${DX - 10} 470 L${DX + 10} 470 L${DX + 13} 478 L${DX - 13} 478 Z" fill="#0b0c10"/>`;
  svg += `<path d="M${DX - 11} 478 L${DX + 11} 478 L${DX + 8} 504 L${DX - 8} 504 Z" fill="url(#lamp)"/>`;
  svg += `<g stroke="#0b0c10" stroke-width="1.6" fill="none"><path d="M${DX - 11} 478 L${DX - 8} 504 L${DX + 8} 504 L${DX + 11} 478"/><line x1="${DX}" y1="478" x2="${DX}" y2="504"/></g>`;
  svg += `<path d="M${DX - 9} 504 L${DX + 9} 504 L${DX} 512 Z" fill="#0b0c10"/>`;
  svg += dots((() => { const p = []; for (let t = 0; t <= 1.0001; t += 1 / 26) { const x = 676 + 244 * t; p.push([x, 480 - 4 * 84 * t * (1 - t) - 3]); } return p; })(), 2.1);
  if (night) svg += `<path d="M676 476 Q${DX} 392 920 476" fill="none" stroke="#ffd98a" stroke-width="7" opacity=".45" filter="url(#glow)"/>`;

  svg += `<rect x="${MX0}" y="${G - 10}" width="${MX1 - MX0}" height="12" fill="#4a3a33"/>`;
  svg += `<rect x="692" y="${G - 4}" width="212" height="10" fill="#a29b90"/>` + snowcap(690, G - 4, 216, 4);
  if (!night) svg += crowbar();

  /* the garden: shrubs, walls, steps */
  svg += `<rect x="-580" y="${G}" width="2760" height="${W1 - G}" fill="${P.garden}"/>`;
  svg += shrubs(-570, ST0 - 30, G + 46, 26, 40) + shrubs(ST1 + 30, 2170, G + 46, 26, 40);
  svg += wrappedTree(ST0 - 52, G + 40, 160) + wrappedTree(ST1 + 52, G + 40, 160);
  svg += stoneWall(-580, ST0 - 8, W1, W1B) + stoneWall(ST1 + 8, 2180, W1, W1B);
  svg += `<rect x="-580" y="${W1B}" width="2760" height="${W2 - W1B}" fill="${P.garden2}"/>`;
  svg += shrubs(-540, 640, W2 + 6, 18, 28) + shrubs(960, 2140, W2 + 6, 18, 28);
  svg += stoneWall(-580, ST0 - 26, W2, W2B) + stoneWall(ST1 + 26, 2180, W2, W2B);
  for (let i = 0, y = G + 6; y < 892; i++, y += 22) {
    const grow = Math.min(i, 10) * 2.2;
    svg += `<rect x="${ST0 - grow}" y="${y}" width="${ST1 - ST0 + 2 * grow}" height="22" fill="#4b221a"/>`;
    svg += `<rect x="${ST0 - grow}" y="${y}" width="${ST1 - ST0 + 2 * grow}" height="22" fill="url(#brick)" opacity=".6"/>`;
    svg += `<rect x="${ST0 - grow - 2}" y="${y}" width="${ST1 - ST0 + 2 * grow + 4}" height="5" fill="#9c958a"/>`;
    svg += `<path d="M${ST0 - grow - 2} ${y + 1} q14 -5 26 0 Z M${ST1 + grow + 2} ${y + 1} q-14 -5 -26 0 Z" fill="${night ? "#e5ecf7" : "#ffffff"}"/>`;
  }
  svg += `<rect x="${ST0}" y="${G + 6}" width="${ST1 - ST0}" height="${900 - G}" fill="url(#wallnight)" opacity=".5"/>`;
  svg += `<ellipse cx="${DX}" cy="${G + 40}" rx="140" ry="50" fill="url(#pool)" style="mix-blend-mode:screen"/>`;
  [[ST0 + 6, -1], [ST1 - 6, 1]].forEach(([x, k]) => {
    let r = `<g stroke="#07080b" fill="none" stroke-linecap="round">`;
    r += `<path d="M${x} ${G - 34} L${x} ${G + 6} M${x} ${G - 34} L${x + k * 14} ${W2B + 40}" stroke-width="4"/>`;
    for (let t = 0; t <= 1; t += .08) {
      const y = G - 34 + t * (W2B + 74 - G), xx = x + k * 14 * t;
      r += `<line x1="${f(xx)}" y1="${f(y)}" x2="${f(xx)}" y2="${f(y + 34)}" stroke-width="1.6"/>`;
    }
    svg += r + `<path d="M${x} ${G - 34} L${x + k * 14} ${W2B + 40}" stroke-width="5" stroke="#07080b"/></g>`;
  });

  /* ground snow and the sidewalk */
  svg += `<path d="M-580 ${W2B} L2180 ${W2B} L2180 900 L-580 900 Z" fill="url(#groundsnow)"/>`;
  svg += `<rect x="-580" y="872" width="2760" height="28" fill="${P.walk}"/><path d="M-580 872 Q400 864 800 872 T2180 870 L2180 876 L-580 876 Z" fill="${night ? "#cfd9ea" : "#ffffff"}"/>`;
  if (!night) svg += aftermath();

  /* the big oak, bare, framing the right; the van waits behind it */
  if (night) svg += van();
  const oak = []; branch(1618, 900, 360, -Math.PI / 2 - .02, 22, 7, oak);
  svg += `<g stroke="#07080c" stroke-linecap="round" fill="none">${oak.join("")}</g>`;

  /* someone's out there with a flashlight */
  svg += `<g id="ha-sweep"><path d="M-120 860 L1500 260 L1500 520 Z" fill="url(#beam)"/></g>`;

  /* the delivery car, parked out front */
  const CX0 = 40, CY = 872;
  svg += `<g id="car">
  <ellipse cx="${CX0 + 150}" cy="${CY + 2}" rx="160" ry="8" fill="#000" opacity=".35"/>
  <path d="M${CX0} ${CY - 30} L${CX0 + 6} ${CY - 70} Q${CX0 + 10} ${CY - 84} ${CX0 + 26} ${CY - 86} L${CX0 + 70} ${CY - 92}
     L${CX0 + 100} ${CY - 132} Q${CX0 + 106} ${CY - 140} ${CX0 + 120} ${CY - 140} L${CX0 + 200} ${CY - 140} Q${CX0 + 216} ${CY - 140} ${CX0 + 226} ${CY - 128}
     L${CX0 + 262} ${CY - 86} L${CX0 + 292} ${CY - 80} Q${CX0 + 304} ${CY - 76} ${CX0 + 304} ${CY - 62} L${CX0 + 304} ${CY - 30} Z" fill="url(#car)"/>
  <path d="M${CX0 + 82} ${CY - 92} L${CX0 + 106} ${CY - 128} L${CX0 + 156} ${CY - 128} L${CX0 + 156} ${CY - 92} Z" fill="#1a2a3c"/>
  <path d="M${CX0 + 164} ${CY - 92} L${CX0 + 164} ${CY - 128} L${CX0 + 214} ${CY - 128} L${CX0 + 246} ${CY - 92} Z" fill="#1a2a3c"/>
  <path d="M${CX0 + 90} ${CY - 100} L${CX0 + 108} ${CY - 124} L${CX0 + 124} ${CY - 124} Z" fill="#6f8fb0" opacity=".35"/>
  <line x1="${CX0 + 160}" y1="${CY - 92}" x2="${CX0 + 160}" y2="${CY - 30}" stroke="#5e0f13" stroke-width="2"/>
  <rect x="${CX0 + 186}" y="${CY - 80}" width="16" height="4" rx="2" fill="#3d0a0d"/>
  <rect x="${CX0}" y="${CY - 40}" width="304" height="10" fill="#3d0a0d"/>
  <rect x="${CX0 + 292}" y="${CY - 70}" width="12" height="12" rx="3" fill="${night ? "#fff6d0" : "#d9dde3"}"/>
  ${night ? `<path d="M${CX0 + 304} ${CY - 64} L${CX0 + 420} ${CY - 90} L${CX0 + 420} ${CY - 40} Z" fill="#fff3c4" opacity=".12"/>` : ""}
  <rect x="${CX0 - 2}" y="${CY - 70}" width="8" height="14" rx="2" fill="#ff3b30"/>
  <path d="M${CX0} ${CY - 92} q60 -6 70 0 l30 -40 q50 -6 120 0 l2 2 q-60 -4 -118 1 l-30 40 q-40 -4 -74 -1 Z" fill="#dfe8f5"/>
  ${[CX0 + 66, CX0 + 244].map(x => `<circle cx="${x}" cy="${CY - 22}" r="24" fill="#0a0b0e"/><circle cx="${x}" cy="${CY - 22}" r="12" fill="#6b717c"/><circle cx="${x}" cy="${CY - 22}" r="4" fill="#2a2d33"/>`).join("")}
  <g transform="translate(${CX0 + 100} ${CY - 172})">
    <rect x="-4" y="22" width="8" height="10" fill="#1a1a1a"/><rect x="-40" y="29" width="80" height="4" rx="2" fill="#1a1a1a"/>
    <rect x="-70" y="0" width="140" height="26" rx="6" fill="#fff4dc"/>
    <rect x="-70" y="0" width="140" height="26" rx="6" fill="none" stroke="#c0262b" stroke-width="3"/>
    <g transform="translate(0 13)">
      <path d="M-15 -8 L15 -8 L0 10 Z" fill="#f0b64a"/><path d="M-16 -9 Q0 -14 16 -9 L15 -6 Q0 -10 -15 -6 Z" fill="#c98a3a"/>
      <circle cx="-5" cy="-3" r="2.6" fill="#c0262b"/><circle cx="5" cy="-2" r="2.6" fill="#c0262b"/><circle cx="0" cy="4" r="2.2" fill="#c0262b"/>
      <circle cx="-40" cy="0" r="4" fill="#c0262b"/><circle cx="40" cy="0" r="4" fill="#c0262b"/>
    </g>
  </g>
  <circle cx="${CX0 + 100}" cy="${CY - 159}" r="80" fill="url(#pool)" opacity=".5" style="mix-blend-mode:screen"/>
  <path d="M${CX0 + 186} ${CY - 70} L${CX0 + 186} ${CY - 46} M${CX0 + 120} ${CY - 70} L${CX0 + 120} ${CY - 46}" stroke="#5e0f13" stroke-width="1.5"/>
  <g class="exhaust" filter="url(#blur3)" fill="#a8b3cf">${[0, -1, -2].map(dl => `<circle cx="${CX0 - 4}" cy="${CY - 34}" r="6" style="--dl:${dl}s"/>`).join("")}</g>
</g>`;

  /* the delivery guy, an original: green beanie, navy puffer, mustard scarf */
  svg += `<g id="pizzabox" opacity="0"></g>`;
  svg += `<g id="guy" opacity="0"><g id="guyflip">
  <g id="legB"><rect x="-4.5" y="-44" width="9" height="40" rx="4" fill="#2e3646"/><path d="M-5 -6 L8 -6 Q11 -6 11 -2 L11 0 L-5 0 Z" fill="#3a2516"/></g>
  <g id="legF"><rect x="-4.5" y="-44" width="9" height="40" rx="4" fill="#3c465a"/><path d="M-5 -6 L8 -6 Q11 -6 11 -2 L11 0 L-5 0 Z" fill="#4a3020"/></g>
  <path d="M-14 -84 Q-16 -60 -13 -40 L13 -40 Q16 -60 14 -84 Q0 -90 -14 -84 Z" fill="#203560"/>
  <g stroke="#2c4678" stroke-width="1.5"><line x1="-14" x2="14" y1="-74" y2="-74"/><line x1="-14" x2="14" y1="-63" y2="-63"/><line x1="-13" x2="13" y1="-52" y2="-52"/></g>
  <path d="M-10 -86 Q0 -80 10 -86 L10 -80 Q0 -76 -10 -80 Z M-8 -82 Q-18 -74 -22 -60 L-17 -59 Q-13 -72 -4 -79 Z" fill="#e3a83a"/>
  <circle cx="2" cy="-95" r="10" fill="#e6b48e"/><circle cx="11.5" cy="-94" r="2.4" fill="#d9a07a"/>
  <path d="M-9 -98 Q-9 -111 2 -112 Q13 -111 13 -98 Z" fill="#2f7d4a"/><rect x="-10" y="-100" width="24" height="5" rx="2" fill="#256a3d"/><circle cx="2" cy="-114" r="4.5" fill="#f2f2ee"/>
  <g id="boxes"></g>
  <path id="armF" d="M4 -78 Q14 -70 16 -62" stroke="#1a2c50" stroke-width="7" fill="none" stroke-linecap="round"/>
</g></g>`;

  svg += `<rect x="-580" width="2760" height="900" fill="url(#vig)"/></svg>`;
  return svg;
}

/* ---------- the stage: building it, and keeping it in step ---------- */

let stageEl = null, built = "", lastTrain = "", lastBoxes = 0, fired = new Set(), sweeping = false;
let raf = 0, stageSnowStop = null, LOOP = 60, START = performance.now() - 2000;

function ensureStage(variant) {
  if (!stageEl) {
    stageEl = document.createElement("div");
    stageEl.id = "ha-stage";
    stageEl.setAttribute("aria-hidden", "true");
    stageEl.innerHTML = `<div class="ha-house"></div><canvas class="ha-stagesnow"></canvas>`;
    document.body.prepend(stageEl);
  }
  if (built !== variant) {
    stageEl.querySelector(".ha-house").innerHTML = buildHouse(variant);
    stageEl.dataset.variant = variant;
    built = variant; lastTrain = ""; lastBoxes = 0;
  }
  if (!raf && !reduced()) raf = requestAnimationFrame(tick);
  if (!stageSnowStop && !reduced()) stageSnowStop = snowfall(stageEl.querySelector(".ha-stagesnow"));
}

function takeDown() {
  if (!stageEl) return;
  stageEl.remove();
  stageEl = null; built = ""; lastTrain = ""; lastBoxes = 0;
  cancelAnimationFrame(raf); raf = 0;
  stageSnowStop?.(); stageSnowStop = null;
}

/* Keyframes for the run: [time 0..1, x, y(feet), scale, facing, carrying]. */
const K = [
  [0.00, 210, 880, .92, 1, 1], [0.03, 210, 880, .92, 1, 1],
  [0.16, 790, 884, .92, 1, 1],
  [0.33, 798, G + 2, .74, 1, 1],
  [0.37, 790, G + 2, .74, 1, 1], [0.40, 790, G + 2, .74, -1, 0],
  [0.55, 790, 884, .92, -1, 0],
  [0.68, 210, 880, .92, -1, 0], [0.70, 210, 880, .92, -1, 0],
];

function place(now) {
  const $ = id => stageEl.querySelector("#" + id);
  const guy = $("guy"), flip = $("guyflip"), legF = $("legF"), legB = $("legB");
  const boxes = $("boxes"), armF = $("armF"), box = $("pizzabox");
  if (!guy) return;
  const p = ((now - START) / 1000 % LOOP) / LOOP;
  box.setAttribute("opacity", p > .385 && p < .96 ? 1 : 0);
  if (p > K[K.length - 1][0]) { guy.setAttribute("opacity", 0); return; }
  let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], t = Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0] || 1)));
  const x = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t, s = a[3] + (b[3] - a[3]) * t;
  const moving = Math.hypot(b[1] - a[1], b[2] - a[2]) > 1;
  const climbing = Math.abs(b[2] - a[2]) > 50;
  const step = moving ? Math.sin(now / (climbing ? 150 : 120)) : 0;
  const bob = moving ? Math.abs(step) * -2.5 : 0;
  guy.setAttribute("opacity", p < .02 ? p / .02 : p > .69 ? (.7 - p) / .01 : 1);
  guy.setAttribute("transform", `translate(${x.toFixed(1)} ${(y + bob).toFixed(1)}) scale(${s.toFixed(3)})`);
  flip.setAttribute("transform", `scale(${b[4] < 0 && a[4] < 0 ? -1 : a[4] < 0 || (b[4] < 0 && t > .5) ? -1 : 1} 1)`);
  legF.setAttribute("transform", `rotate(${(step * 24).toFixed(1)} 0 -44)`);
  legB.setAttribute("transform", `rotate(${(-step * 24).toFixed(1)} 0 -44)`);
  const carry = a[5] && b[5];
  boxes.setAttribute("opacity", carry ? 1 : 0);
  armF.setAttribute("d", carry ? "M4 -78 Q14 -70 16 -62" : `M2 -78 Q${(4 + step * 6).toFixed(1)} -64 ${(3 + step * 8).toFixed(1)} -52`);
}

function tick(now) {
  if (!stageEl) { raf = 0; return; }
  raf = requestAnimationFrame(tick);
  if (document.hidden || stageEl.hidden) return;
  place(now);
}

/* A flashlight sweeps across the house, once. */
function sweep() {
  if (!stageEl || sweeping || reduced()) return;
  const g = stageEl.querySelector("#ha-sweep");
  if (!g) return;
  sweeping = true;
  g.classList.remove("go"); void g.getBoundingClientRect(); g.classList.add("go");
  setTimeout(() => { g.classList.remove("go"); sweeping = false; }, 4200);
}

/* Called on every big-screen redraw with what's on the board, or with null
   when the big screen isn't showing (or another theme is on). Only what
   changed is touched, so nothing restarts mid-stride.
     info.names     tonight's players, the leader first
     info.boxes     pizzas on the step, 1 to 6
     info.lopsided  ids of open bets that have gone lopsided */
export function stage(info) {
  if (!info) {
    takeDown();
    return;
  }
  const variant = document.documentElement.dataset.theme === "homealone-light" ? "morning" : "night";
  ensureStage(variant);
  stageEl.hidden = false;

  // Who's home: one window per player, in a fixed order.
  const lit = Math.min(info.names.length, SLOT_ORDER.length);
  const on = new Set(SLOT_ORDER.slice(0, lit).map(String));
  stageEl.querySelectorAll(".slot").forEach(el => el.classList.toggle("on", on.has(el.dataset.slot)));

  const key = info.names.join("\u0001");
  if (key !== lastTrain) {
    stageEl.querySelector("#ha-train").innerHTML = train(info.names);
    lastTrain = key;
  }

  const n = Math.max(1, Math.min(6, info.boxes | 0));
  if (n !== lastBoxes) {
    stageEl.querySelector("#pizzabox").innerHTML = stackOnStep(n);
    stageEl.querySelector("#boxes").innerHTML = stackCarried(n);
    lastBoxes = n;
  }
  if (reduced()) stageEl.querySelector("#pizzabox").setAttribute("opacity", 1);

  // Intruder alert: once per lopsided bet, not on every redraw.
  const fresh = info.lopsided.filter(id => !fired.has(id));
  fresh.forEach(id => fired.add(id));
  if (fresh.length) sweep();
}

/* For tests: jump the delivery run to a moment, and see what fired. */
export const _debug = {
  seek: sec => stageEl && place(START + sec * 1000),
  fired: () => [...fired],
};
