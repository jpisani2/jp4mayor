/* The Halloween dressing: a haunted sky, the moon, fog, bats, a spider on
   its thread, a ghost, cobwebs, embers or falling leaves, a black cat and a
   row of jack-o'-lanterns.

   It all lives in one layer at the back of <body>, outside #app, so the
   full-screen redraw on every change never touches it and nothing restarts
   mid-flight. It never takes a tap (pointer-events: none in the stylesheet)
   and it's hidden from screen readers. Which pieces show, and in what colors,
   is decided by styles.css per theme; this file only builds the shapes.

   The photographs come from Unsplash (free under the Unsplash License) and
   load straight from their CDN, only while a Halloween theme is on. If they
   can't load, the painted sky and every drawn piece still show. Credits are
   in the README. */

const ID = "spooky";
const FONT = "https://fonts.googleapis.com/css2?family=Creepster&display=swap";

const bat = () => `<svg viewBox="0 0 100 50" aria-hidden="true">
  <path class="wl" d="M48 24 C42 15 31 11 19 14 C14 15 8 12 2 8 C6 16 6 22 10 27 C14 24 18 26 20 31 C24 27 30 28 33 33 C36 28 42 27 48 30 Z"/>
  <path class="wr" d="M52 24 C58 15 69 11 81 14 C86 15 92 12 98 8 C94 16 94 22 90 27 C86 24 82 26 80 31 C76 27 70 28 67 33 C64 28 58 27 52 30 Z"/>
  <ellipse cx="50" cy="28" rx="5.5" ry="8"/>
  <circle cx="50" cy="19" r="4.6"/>
  <path d="M46 17 L46.6 10 L49 15 Z M54 17 L53.4 10 L51 15 Z"/>
  <circle class="eye" cx="48.3" cy="19" r=".9"/><circle class="eye" cx="51.7" cy="19" r=".9"/>
</svg>`;

/* A corner web: spokes out from the corner, each ring sagging toward it. */
function web() {
  const spokes = 8, rings = [26, 48, 72, 98, 126, 156], R = 190;
  const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const ang = i => (Math.PI / 2) * (i / (spokes - 1));
  let d = "";
  for (let i = 0; i < spokes; i++) { const [x, y] = pt(R, ang(i)); d += `M0 0 L${x.toFixed(1)} ${y.toFixed(1)} `; }
  rings.forEach(r => {
    for (let i = 0; i < spokes - 1; i++) {
      const [x1, y1] = pt(r, ang(i)), [x2, y2] = pt(r, ang(i + 1));
      const [cx, cy] = pt(r * 0.82, (ang(i) + ang(i + 1)) / 2);
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
  });
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><path d="${d}"/></svg>`;
}

const spider = `<svg viewBox="0 0 40 44" aria-hidden="true">
  <g class="legs">
    <path d="M17 22 C10 16 6 14 2 16 M17 25 C10 22 5 22 1 26 M17 28 C11 28 6 31 3 36 M18 30 C14 33 11 38 10 43"/>
    <path d="M23 22 C30 16 34 14 38 16 M23 25 C30 22 35 22 39 26 M23 28 C29 28 34 31 37 36 M22 30 C26 33 29 38 30 43"/>
  </g>
  <ellipse cx="20" cy="28" rx="6.5" ry="8"/>
  <circle cx="20" cy="18" r="4.2"/>
  <circle class="eye" cx="18.4" cy="17.4" r="1"/><circle class="eye" cx="21.6" cy="17.4" r="1"/>
</svg>`;

const ghost = `<svg viewBox="0 0 60 80" aria-hidden="true">
  <defs><radialGradient id="sp-gh" cx="40%" cy="30%" r="75%">
    <stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e9e4f5"/><stop offset="1" stop-color="#b9b0d6"/>
  </radialGradient></defs>
  <path class="body" fill="url(#sp-gh)" d="M30 4 C14 4 6 16 6 32 L6 72 L14 64 L22 74 L30 64 L38 74 L46 64 L54 72 L54 32 C54 16 46 4 30 4 Z"/>
  <ellipse cx="22" cy="30" rx="4" ry="6" fill="#1b1028"/><ellipse cx="38" cy="30" rx="4" ry="6" fill="#1b1028"/>
  <ellipse cx="30" cy="45" rx="5" ry="6.5" fill="#1b1028"/>
</svg>`;

/* A jack-o'-lantern whose face is lit from inside; the flicker is CSS. */
const lantern = (k) => `<svg viewBox="0 0 120 104" aria-hidden="true">
  <defs>
    <radialGradient id="sp-pk${k}" cx="45%" cy="40%" r="70%">
      <stop offset="0" stop-color="#ffab40"/><stop offset=".6" stop-color="#f57c00"/><stop offset="1" stop-color="#a33d00"/>
    </radialGradient>
    <radialGradient id="sp-fire${k}" cx="50%" cy="55%" r="60%">
      <stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff8a00"/>
    </radialGradient>
  </defs>
  <path d="M58 20 C57 12 60 6 66 3 L69 7 C65 9 63 14 64 20 Z" fill="#4e6b2a"/>
  <ellipse cx="34" cy="60" rx="30" ry="38" fill="url(#sp-pk${k})"/>
  <ellipse cx="86" cy="60" rx="30" ry="38" fill="url(#sp-pk${k})"/>
  <ellipse cx="60" cy="60" rx="32" ry="41" fill="url(#sp-pk${k})"/>
  <path d="M44 24 C40 40 40 80 44 96 M76 24 C80 40 80 80 76 96" stroke="#b34700" stroke-width="2" fill="none" opacity=".55"/>
  <g class="face" fill="url(#sp-fire${k})">
    <path d="M30 48 L44 34 L50 52 Z"/><path d="M90 48 L76 34 L70 52 Z"/>
    <path d="M55 58 L60 50 L65 58 Z"/>
    <path d="M26 66 C40 74 80 74 94 66 C90 84 76 92 60 92 C44 92 30 84 26 66 Z
             M38 72 L42 79 L46 73 Z M74 73 L78 79 L82 72 Z" fill-rule="evenodd"/>
  </g>
</svg>`;

const cat = `<svg viewBox="0 0 90 120" aria-hidden="true">
  <path class="tail" d="M58 112 C80 112 88 96 82 80 C78 70 70 70 72 78 C76 90 70 102 56 104 Z"/>
  <path d="M20 118 C14 100 16 78 26 64 C20 58 18 48 20 38 L22 20 L32 32 C36 30 44 30 48 32 L58 20 L60 38 C62 48 60 58 54 64 C64 78 66 100 60 118 Z"/>
  <g class="eyes"><ellipse cx="31" cy="44" rx="4" ry="3.4"/><ellipse cx="49" cy="44" rx="4" ry="3.4"/></g>
  <g class="pupils"><ellipse cx="31" cy="44" rx="1" ry="3"/><ellipse cx="49" cy="44" rx="1" ry="3"/></g>
</svg>`;

const leaf = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 2 L58 22 L72 14 L68 34 L90 30 L78 46 L92 56 L70 60 L74 78 L54 66 L52 98 L48 98 L46 66 L26 78 L30 60 L8 56 L22 46 L10 30 L32 34 L28 14 L42 22 Z"/></svg>`;

const range = n => Array.from({ length: n }, (_, i) => i);

function build() {
  const el = document.createElement("div");
  el.id = ID;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="sp-sky"></div>
    <div class="sp-moon"></div>
    <div class="sp-flash"></div>
    <div class="sp-patch"></div>
    <div class="sp-fog sp-fog1"></div><div class="sp-fog sp-fog2"></div>
    <div class="sp-web sp-web-l">${web()}</div>
    <div class="sp-web sp-web-r">${web()}</div>
    ${range(7).map(i => `<div class="sp-bat sp-bat${i}">${bat()}</div>`).join("")}
    <div class="sp-ghost sp-ghost1">${ghost}</div>
    <div class="sp-ghost sp-ghost2">${ghost}</div>
    <div class="sp-spider"><div class="sp-thread"></div>${spider}</div>
    ${range(14).map(i => `<i class="sp-ember sp-e${i}"></i>`).join("")}
    ${range(12).map(i => `<div class="sp-leaf sp-l${i}">${leaf}</div>`).join("")}
    <div class="sp-cat">${cat}</div>
    <div class="sp-lanterns">
      <div class="sp-lantern sp-lan0">${lantern(0)}</div>
      <div class="sp-lantern sp-lan1">${lantern(1)}</div>
      <div class="sp-lantern sp-lan2">${lantern(2)}</div>
    </div>`;
  return el;
}

function loadFont() {
  if (document.querySelector(`link[href="${FONT}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT;
  document.head.appendChild(link);
}

/* On or off; harmless to call repeatedly. Switching between the two
   Halloween themes keeps the same layer — only the stylesheet changes. */
export function dress(on) {
  const have = document.getElementById(ID);
  if (!on) { have?.remove(); return; }
  loadFont();
  if (!have) document.body.prepend(build());
}
