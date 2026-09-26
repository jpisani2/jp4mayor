/* splash.js — the press-conference intro that plays over index.html.
 *
 * Loaded by one line near the top of <body> in index.html:
 *     <script src="splash.js"></script>
 * Delete that line to turn the intro off. Nothing else depends on it.
 *
 * When it plays:   first visit per browser session (sessionStorage).
 * When it doesn't: already seen this session; the link has a #section
 *                  (e.g. jp4mayor.com/#platform); the visitor's device asks
 *                  for reduced motion.
 * Skip:            Skip button, a click/tap anywhere, or Esc.
 * To rewatch:      jp4mayor.com/?splash  (always plays; ?splash&t=6 freezes at 6s)
 *
 * Dialogue, timings and bubble positions live in the LINES array below.
 * ~16.7 s long. The overlay fades out onto the campaign page underneath.
 */
(function () {
'use strict';

const KEY = 'jp4mayor-splash-seen';
const q = new URLSearchParams(location.search);
const force = q.has('splash');
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let seen = false;
try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
if (!force && (seen || location.hash || reduced)) return;
try { sessionStorage.setItem(KEY, '1'); } catch (e) {}

/* ---------------- markup ---------------- */
const style = document.createElement('style');
style.textContent = `
#sp-root{position:fixed;inset:0;z-index:1000;background:#0C1D37;overflow:hidden;cursor:pointer;
  font-family:"Libre Franklin","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;
  transition:opacity .45s ease}
#sp-root.sp-leaving{opacity:0 !important;pointer-events:none}
#sp-scene{position:absolute;inset:0;width:100%;height:100%;display:block}
#sp-scene text{font-family:inherit}
#sp-root .rp{font-size:26px;font-weight:900;letter-spacing:-.01em;fill:#12294A;fill-opacity:.075}
#sp-root .rp tspan{fill:#C9962B;fill-opacity:.22}
#sp-root .banner-t{font-size:19px;font-weight:800;letter-spacing:.16em;fill:#fff}
#sp-root .seal-t{font-size:11.5px;font-weight:800;letter-spacing:2.2px;fill:#C9962B}
#sp-root .seal-jp{font-size:38px;font-weight:900;fill:#C9962B;letter-spacing:-1px}
#sp-root .flag-t{font-weight:900;letter-spacing:.02em}
#sp-root .sign-big{font-size:46px;font-weight:900;fill:#fff;letter-spacing:-1.4px}
#sp-root .sign-big tspan{fill:#C9962B}
#sp-root .sign-small{font-size:10px;font-weight:800;letter-spacing:2px;fill:#9FB0C4}
#sp-root .bfill.press{fill:#fff}
#sp-root .bstroke.press{fill:#12294A;stroke:#12294A;stroke-linejoin:round}
#sp-root .bfill.cat{fill:#12294A}
#sp-root .bstroke.cat{fill:#C9962B;stroke:#C9962B;stroke-linejoin:round}
#sp-root .btxt{font-weight:800;letter-spacing:-.005em}
#sp-root .btxt.press{fill:#12294A}
#sp-root .btxt.cat{fill:#fff}
#sp-vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 90% at 50% 38%,rgba(12,29,55,0) 55%,rgba(12,29,55,.32) 100%)}
#sp-dim{position:absolute;inset:0;background:#0C1D37;pointer-events:none;opacity:1}
#sp-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;font-family:inherit;font-size:11px;font-weight:800;
  letter-spacing:.18em;text-transform:uppercase;color:#fff;background:rgba(12,29,55,.78);border:0;border-radius:2px;
  padding:9px 12px;cursor:pointer;transition:opacity .3s}
#sp-skip:hover{background:#0C1D37}
#sp-skip.gone{opacity:0;pointer-events:none}
#sp-root .sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
document.head.appendChild(style);

const root = document.createElement('div');
root.id = 'sp-root';
root.innerHTML = `
<svg id="sp-scene" preserveAspectRatio="xMidYMid meet" role="img"
     aria-label="Animated press conference. A cat in a suit at a campaign podium keeps telling a crowd of reporters that it is not real. They insist it is.">
<defs>
  <pattern id="sp-repeat" width="300" height="140" patternUnits="userSpaceOnUse">
    <text class="rp" x="18" y="48">JP<tspan>4</tspan>MAYOR</text>
    <text class="rp" x="168" y="118">JP<tspan>4</tspan>MAYOR</text>
  </pattern>
  <radialGradient id="sp-spot" cx="800" cy="360" r="640" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".95"/>
    <stop offset=".55" stop-color="#fff" stop-opacity=".35"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sp-flashG">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/>
    <stop offset=".18" stop-color="#fff" stop-opacity=".95"/>
    <stop offset=".45" stop-color="#FFF6DD" stop-opacity=".35"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sp-podG" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#0A1830"/>
    <stop offset=".5" stop-color="#17325A"/>
    <stop offset="1" stop-color="#0A1830"/>
  </linearGradient>
  <linearGradient id="sp-flagG" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#12294A"/><stop offset=".22" stop-color="#1E3D69"/>
    <stop offset=".45" stop-color="#0F2442"/><stop offset=".7" stop-color="#1E3D69"/>
    <stop offset="1" stop-color="#0F2442"/>
  </linearGradient>
  <linearGradient id="sp-floorG" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#1A2E4E"/><stop offset=".3" stop-color="#0C1D37"/>
  </linearGradient>
  <filter id="sp-shadow" x="-20%" y="-30%" width="140%" height="170%">
    <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0C1D37" flood-opacity=".28"/>
  </filter>
  <clipPath id="sp-eyeL"><path d="M75.5,80 Q84,69 92.5,80 Q84,90 75.5,80Z"/></clipPath>
  <clipPath id="sp-eyeR"><path d="M107.5,80 Q116,69 124.5,80 Q116,90 107.5,80Z"/></clipPath>
  <clipPath id="sp-aboveLedge" clipPathUnits="userSpaceOnUse"><rect x="-3000" y="-3000" width="7000" height="3578"/></clipPath>
  <path id="sp-sealArc" d="M-52,0 A52,52 0 1,1 52,0 A52,52 0 1,1 -52,0"/>
</defs>

<!-- ============ back wall ============ -->
<rect x="-3000" y="-2000" width="7600" height="2840" fill="#E3E8EB"/>
<rect x="-3000" y="-2000" width="7600" height="2840" fill="url(#sp-spot)"/>
<rect x="-3000" y="-2000" width="7600" height="2840" fill="url(#sp-repeat)"/>
<rect x="-3000" y="820" width="7600" height="14" fill="#C9D1D6"/>
<rect x="-3000" y="834" width="7600" height="1600" fill="url(#sp-floorG)"/>

<!-- banner (y set by layout) -->
<g id="sp-banner">
  <line x1="420" y1="-400" x2="420" y2="0" stroke="#8A96A3" stroke-width="2"/>
  <line x1="1180" y1="-400" x2="1180" y2="0" stroke="#8A96A3" stroke-width="2"/>
  <rect x="380" y="0" width="840" height="52" fill="#BF3A2E" filter="url(#sp-shadow)"/>
  <rect x="380" y="6" width="840" height="1.5" fill="#fff" opacity=".35"/>
  <rect x="380" y="44.5" width="840" height="1.5" fill="#fff" opacity=".35"/>
  <text class="banner-t" x="800" y="33" text-anchor="middle">A STEADY HAND ON MATTERS OF MODERATE IMPORTANCE</text>
</g>

<g id="sp-flags"></g>
<g id="sp-boomBack"></g>

<!-- ============ the candidate ============ -->
<path id="sp-tail" fill="none" stroke="#12294A" stroke-width="22" stroke-linecap="round"/>

<g id="sp-cat">
  <path d="M-4,200 C-4,150 34,127 100,127 C166,127 204,150 204,200 L204,340 L-4,340 Z" fill="#12294A"/>
  <path d="M85,100 h30 v36 h-30 Z" fill="#12294A"/>
  <path d="M77,127 L100,184 L123,127 Z" fill="#E6EAEC"/>
  <path d="M84,127 L100,139 L91,145 Z M116,127 L100,139 L109,145 Z" fill="#fff"/>
  <path d="M92,130 L108,130 L112,146 L100,180 L88,146 Z" fill="#BF3A2E"/>
  <path d="M93.5,130 L106.5,130 L104.5,138 L95.5,138 Z" fill="#9E2E24"/>
  <path d="M77,127 L96,176 M123,127 L104,176" stroke="#1F3D66" stroke-width="2.4" fill="none"/>
  <circle cx="82" cy="146" r="3.4" fill="#C9962B"/>
  <circle cx="82" cy="146" r="1.5" fill="#E8C063"/>

  <g id="sp-head">
    <g id="sp-earL"><path d="M66,66 L58,28 L96,51 Z" fill="#12294A"/><path d="M69,59 L63,36 L86,51 Z" fill="#26426B"/></g>
    <g id="sp-earR"><path d="M134,66 L142,28 L104,51 Z" fill="#12294A"/><path d="M131,59 L137,36 L114,51 Z" fill="#26426B"/></g>
    <path d="M100,45 C125,45 142,61 144,81 C146,102 129,123 100,123 C71,123 54,102 56,81 C58,61 75,45 100,45 Z" fill="#12294A"/>
    <ellipse cx="100" cy="100" rx="15" ry="10" fill="#18335A"/>
    <!-- eyes -->
    <g clip-path="url(#sp-eyeL)">
      <rect x="74" y="68" width="20" height="22" fill="#E2B03E"/>
      <ellipse id="sp-pupL" cx="84" cy="80" rx="1.9" ry="4.6" fill="#07101E"/>
      <circle id="sp-hlL" cx="85.6" cy="77.4" r="1.1" fill="#fff" opacity=".85"/>
      <rect id="sp-lidL" x="74" y="73" width="20" height="6" fill="#12294A"/>
      <line id="sp-lnL" x1="74" x2="94" y1="79" y2="79" stroke="#07101E" stroke-width="1.3"/>
    </g>
    <g clip-path="url(#sp-eyeR)">
      <rect x="106" y="68" width="20" height="22" fill="#E2B03E"/>
      <ellipse id="sp-pupR" cx="116" cy="80" rx="1.9" ry="4.6" fill="#07101E"/>
      <circle id="sp-hlR" cx="117.6" cy="77.4" r="1.1" fill="#fff" opacity=".85"/>
      <rect id="sp-lidR" x="106" y="73" width="20" height="6" fill="#12294A"/>
      <line id="sp-lnR" x1="106" x2="126" y1="79" y2="79" stroke="#07101E" stroke-width="1.3"/>
    </g>
    <path d="M97,91.5 L103,91.5 L100,94.8 Z" fill="#C98489"/>
    <path d="M100,94.8 L100,97 M95,96.2 Q97.5,99.2 100,97 Q102.5,99.2 105,96.2" stroke="#7089AD" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <g id="sp-mouthO">
      <ellipse id="sp-mO" cx="100" cy="99.5" rx="3.6" ry="2" fill="#07101E"/>
      <ellipse id="sp-mT" cx="100" cy="100.5" rx="2.3" ry="1" fill="#C4626A"/>
    </g>
    <g id="sp-wL" stroke="#12294A" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M72,90 L24,79"/><path d="M72,97 L22,97"/><path d="M72,104 L24,115"/>
    </g>
    <g id="sp-wR" stroke="#12294A" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M128,90 L176,79"/><path d="M128,97 L178,97"/><path d="M128,104 L176,115"/>
    </g>
  </g>
</g>

<!-- ============ podium ============ -->
<g id="sp-podium">
  <path d="M632,572 L968,572 L1012,980 L588,980 Z" fill="url(#sp-podG)"/>
  <path d="M658,600 L942,600 L976,950 L624,950 Z" fill="none" stroke="#24436F" stroke-width="2.5"/>
  <g transform="translate(800 700)">
    <circle r="76" fill="#12294A" stroke="#C9962B" stroke-width="5"/>
    <circle r="64" fill="none" stroke="#C9962B" stroke-width="1.2"/>
    <circle r="38" fill="none" stroke="#C9962B" stroke-width="1.2"/>
    <text class="seal-t"><textPath href="#sp-sealArc" startOffset="0">JP4MAYOR ★ JURISDICTION TBC ★ JP4MAYOR ★</textPath></text>
    <text class="seal-jp" y="13" text-anchor="middle">JP</text>
  </g>
  <rect x="598" y="574" width="404" height="10" fill="#000" opacity=".22"/>
  <rect x="604" y="545" width="392" height="30" rx="3" fill="#0C1D37"/>
  <rect x="604" y="545" width="392" height="4" rx="2" fill="#C9962B"/>
</g>
<g id="sp-mics">
  <rect x="774" y="538" width="52" height="9" rx="2" fill="#1B1F27"/>
  <g id="sp-micL"><path d="M788,540 C788,522 772,516 770,498" stroke="#1B1F27" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="768" cy="487" rx="7.5" ry="14" transform="rotate(-16 768 487)" fill="#1B1F27"/>
    <ellipse cx="766" cy="483" rx="3" ry="6" transform="rotate(-16 766 483)" fill="#3A404C"/></g>
  <g id="sp-micR"><path d="M812,540 C812,522 828,516 830,498" stroke="#1B1F27" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="832" cy="487" rx="7.5" ry="14" transform="rotate(16 832 487)" fill="#1B1F27"/>
    <ellipse cx="834" cy="483" rx="3" ry="6" transform="rotate(16 834 483)" fill="#3A404C"/></g>
</g>

<!-- paws / arms, in front of the podium ledge -->
<g clip-path="url(#sp-aboveLedge)">
  <g id="sp-paws">
    <path d="M58,138 Q54,152 62,163" stroke="#12294A" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path d="M58,154 L60.5,160" stroke="#E6EAEC" stroke-width="20" fill="none"/>
    <ellipse cx="62" cy="166" rx="12.5" ry="8" fill="#12294A"/>
    <path d="M57.5,161 v4.5 M62,160 v5.5 M66.5,161 v4.5" stroke="#07101E" stroke-width="1" stroke-linecap="round"/>
    <path id="sp-armR" stroke="#12294A" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path id="sp-cuffR" stroke="#E6EAEC" stroke-width="20" fill="none"/>
    <g id="sp-pawR">
      <ellipse id="sp-pawRb" cx="0" cy="0" rx="12.5" ry="8" fill="#12294A"/>
      <path id="sp-pawToes" d="M-4.5,-5 v4.5 M0,-6 v5.5 M4.5,-5 v4.5" stroke="#07101E" stroke-width="1" stroke-linecap="round"/>
      <g id="sp-beans" fill="#D98C92">
        <ellipse cx="0" cy="3.4" rx="5.2" ry="4.2"/>
        <circle cx="-6.6" cy="-3.6" r="2.3"/><circle cx="-2.3" cy="-7" r="2.3"/>
        <circle cx="2.3" cy="-7" r="2.3"/><circle cx="6.6" cy="-3.6" r="2.3"/>
      </g>
    </g>
  </g>
</g>

<g id="sp-boom"></g>
<g id="sp-crowdB"></g>
<g id="sp-sign"></g>
<g id="sp-crowdF"></g>
<g id="sp-flashes"></g>
<g id="sp-dream" style="display:none"></g>
<g id="sp-bubbles"></g>
</svg>
<div id="sp-vignette"></div>
<div id="sp-dim"></div>
<button id="sp-skip" type="button">Skip &rsaquo;</button>
<p class="sp-sr">Reporters: Mr. Mayor! Mr. Mayor! Candidate: I'm not the mayor. Reporter: Sir, people are saying it's real! Candidate: It's not real. Get away. Reporter: Then explain the yard signs! Candidate: I didn't print those. Reporter: How does a cat even ride a bike? (He pictures himself cycling down a protected bike lane in a helmet.) Candidate: In a protected lane. Reporters: He's running! Candidate: Get away.</p>`;
(document.body || document.documentElement).appendChild(root);
const htmlStyle = document.documentElement.style, prevOverflow = htmlStyle.overflow;
htmlStyle.overflow = 'hidden';
let leaving = false;

const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById('sp-' + id);
const svg = $('scene');
function el(tag, attrs, parent){
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const set = (e, k, v) => e.setAttribute(k, v);
const C = {navy:'#12294A', navy2:'#0C1D37', paper:'#F2F4F5', paper2:'#E6EAEC', red:'#BF3A2E', gold:'#C9962B'};

/* ---------------- math ---------------- */
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  io:  t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in:  t => t*t*t,
  back:t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); },
  inBack:t => { const c1 = 1.9, c3 = c1 + 1; return c3*t*t*t - c1*t*t; }
};
function track(keys, def='io'){
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++){
      const k = keys[i];
      if (t <= k[0]){ const p = keys[i-1]; return lerp(p[1], k[1], E[k[2] || def]((t - p[0]) / (k[0] - p[0]))); }
    }
    return keys[keys.length-1][1];
  };
}
const bump = (t, c, w) => { const u = Math.abs(t - c) / w; return u >= 1 ? 0 : (1-u*u)*(1-u*u); };
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const f1 = n => Math.round(n*10)/10;

/* ---------------- script ---------------- */
const CARD_AT = 16.5, END = 16.75;
const LINES = [
  {id:'m1', who:'press', by:'b330',  t0:0.45, t1:1.95, small:true, text:['Mr. Mayor!'],
    L:{c:[300,560], tip:[335,640]},  P:{c:[600,590], tip:[560,690]}},
  {id:'m2', who:'press', by:'f1320', t0:0.75, t1:1.95, small:true, text:['Mr. Mayor!!'],
    L:{c:[1330,590], tip:[1315,660]}, P:{c:[1000,640], tip:[1060,720]}},
  {id:'m3', who:'press', by:'b700',  t0:1.05, t1:1.95, small:true, text:['Over here!'],
    L:{c:[560,480], tip:[640,600]},  P:{c:[700,740], tip:[660,820]}},
  {id:'c1', who:'cat', t0:2.0, t1:3.5, speak:[0.9], text:['I’m not the mayor.'],
    L:{c:[1110,215], tip:[905,318]}, P:{c:[830,135], tip:[830,290]}},
  {id:'r1', who:'press', by:'f470', t0:3.6, t1:5.1, text:['Sir, people are','saying it’s real!'],
    L:{c:[380,470], tip:[470,612]},  P:{c:[660,640], tip:[560,780]}},
  {id:'c2', who:'cat', t0:5.2, t1:6.7, speak:[0.5, 0.75, 1.15], text:['It’s not real.','Get away.'],
    L:{c:[1110,215], tip:[905,318]}, P:{c:[830,130], tip:[830,290]}},
  {id:'r2', who:'press', by:'f1065', t0:6.85, t1:8.3, text:['Then explain','the yard signs!'],
    L:{c:[1270,430], tip:[1110,560]}, P:{c:[720,650], tip:[968,640]}},
  {id:'c3', who:'cat', t0:8.45, t1:9.8, speak:[0.95], text:['I didn’t print those.'],
    L:{c:[1110,215], tip:[905,318]}, P:{c:[830,135], tip:[830,290]}},
  {id:'r3', who:'press', by:'f1320', t0:9.95, t1:11.35, text:['How does a cat','even ride a bike?'],
    L:{c:[1250,480], tip:[1320,612]}, P:{c:[860,680], tip:[1070,800]}},
  // 11.4–13.3: he pictures it (thought cloud, see DREAM below)
  {id:'c4', who:'cat', t0:13.4, t1:14.7, speak:[1.05], text:['In a protected lane.'],
    L:{c:[1110,215], tip:[905,318]}, P:{c:[830,125], tip:[830,290]}},
  {id:'h1', who:'press', by:'f470', t0:14.8, t1:16.1, text:['HE’S RUNNING!'],
    L:{c:[380,480], tip:[462,612]},  P:{c:[650,650], tip:[560,780]}},
  {id:'h2', who:'press', by:'b1265', t0:14.95, t1:16.1, text:['HE’S RUNNING!'],
    L:{c:[1250,560], tip:[1270,640]}, P:{c:[950,760], tip:[1060,850]}},
  {id:'c5', who:'cat', t0:15.17, t1:16.0, speak:[0.45], text:['…Get away.'],
    L:{c:[1110,215], tip:[905,318]}, P:{c:[830,135], tip:[830,290]}},
];

// candidate
const trLid = track([[0,.45],[1.9,.45],[2.1,.52],[3.6,.5],[5.2,.58],[5.4,.68],[6.8,.6],[8.4,.6],[8.6,.7],
                      [9.9,.52],[11.3,.5],[11.6,.3],[13.2,.3],[13.4,0,'out'],[14.7,0],[14.95,.55],[15.2,1],[CARD_AT,1]]);
const BLINKS = [1.35, 4.55, 7.55, 10.45, 12.45];
const trEar = track([[0,3],[2.0,3],[2.3,12],[5.2,12],[5.45,34,'out'],[6.8,28],[8.4,22],[11.1,20],[11.5,-7,'out'],
                      [13.3,-7],[13.45,-5],[14.65,-5],[14.95,40,'out'],[CARD_AT,40]]);
const trTilt = track([[0,0],[2.0,-2],[3.6,3],[5.2,-3],[6.85,-6],[8.4,-4],[9.9,1],[11.3,0],[11.7,5],[13.2,5],[13.45,0],[14.75,2],[15.15,0]]);
const trLean = track([[13.25,0],[13.5,1,'out'],[14.5,1],[14.8,0]]);
const trPx = track([[0,0],[1.0,-1.2],[2.0,0],[3.6,-2.2],[5.1,-2],[5.3,0],[6.9,1.8],[8.5,1.6],[9.3,0],
                      [9.95,2.2],[11.3,1],[11.6,2.3],[13.2,2.3],[13.4,0],[14.85,0],[15.05,-1.8]]);
const trPy = track([[0,.5],[3.6,1],[5.3,0],[6.9,.6],[9.3,0],[9.95,1],[11.3,.5],[11.6,-2.6],[13.2,-2.6],[13.4,0]]);
const trRaise = track([[0,0],[2.1,0],[2.35,.32,'out'],[3.3,.32],[3.6,0],[5.15,0],[5.45,1,'back'],[6.65,1],[6.95,0],
                      [15.05,0],[15.27,1,'back'],[15.65,1],[15.9,.4]]);
const trDuck = track([[0,0],[15.6,0],[16.1,1,'inBack']]);
const trTailAmp = track([[0,.25],[5.1,.3],[5.35,.9],[6.8,.7],[8.4,.5],[11.2,.12],[11.5,.4],[13.2,.4],[13.4,.12],[14.75,.18],[14.95,1],[CARD_AT,1]]);
const trBoomDip = track([[13.2,0],[13.7,1],[14.6,1],[15.2,0]]);
// press
const trSurge = track([[0,.35],[.45,.85],[1.9,.7],[2.2,.22],[3.5,.2],[3.7,.7],[5.0,.6],[5.25,.2],[6.7,.22],[6.9,.8],
                       [8.3,.6],[8.5,.22],[9.8,.25],[10.0,.75],[11.2,.6],[11.45,.1],[14.65,.1],[14.8,1,'out'],[16.2,1],[CARD_AT,.7]]);
const trSign  = track([[6.55,0],[6.95,1,'back'],[9.7,1],[10.4,0]]);
// dims
const trStart = track([[0,1],[.7,0]]);
const trOut = track([[16.1,1],[END,0]]);

/* ---------------- layout (landscape / portrait) ---------------- */
const SAFE = { L:{x:170, y:105, w:1260, h:855}, P:{x:465, y:40, w:670, h:930} };
let mode = 'L';
function layoutView(){
  mode = (innerWidth / innerHeight) < 0.9 ? 'P' : 'L';
  const s = SAFE[mode];
  set(svg, 'viewBox', `${s.x} ${s.y} ${s.w} ${s.h}`);
  set($('banner'), 'transform', mode === 'L' ? 'translate(0 124)' : 'translate(800 -78) scale(.74) translate(-800 0)');
  layoutBubbles();
  layoutDream();
}

/* ---------------- flags ---------------- */
function flag(x, dir){
  const g = el('g', {}, $('flags'));
  el('rect', {x:x-4, y:205, width:8, height:625, fill:'#B98A2A'}, g);
  el('circle', {cx:x, cy:199, r:10, fill:'#C9962B'}, g);
  const w = 132 * dir, a = x + 6*dir;
  el('path', {d:`M${a},222 L${a+w},222 C${a+w*1.06},340 ${a+w*.9},420 ${a+w*.97},500 L${a+w*.1},500 C${a+w*.16},420 ${a},340 ${a},222 Z`, fill:'url(#sp-flagG)'}, g);
  el('path', {d:`M${a+w*.1},500 L${a+w*.97},500`, stroke:'#C9962B', 'stroke-width':8, 'stroke-dasharray':'3 3'}, g);
  const cx = a + w*.52, cy = 330, R = 26, r = 10.5; let d = '';
  for (let i = 0; i < 10; i++){ const ang = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + f1(cx + rr*Math.cos(ang)) + ',' + f1(cy + rr*Math.sin(ang)); }
  el('path', {d:d+'Z', fill:'#C9962B'}, g);
}
flag(440, 1); flag(1160, -1);

/* ---------------- boom mic ---------------- */
const boom = $('boom');
el('line', {x1:-1600, y1:0, x2:-20, y2:0, stroke:'#2A2F38', 'stroke-width':7, 'stroke-linecap':'round'}, boom);
el('rect', {x:-40, y:-9, width:30, height:18, rx:4, fill:'#1B1F27'}, boom);
(() => { // fuzzy windscreen
  const R = rng(7); let d = '';
  const n = 120;
  for (let i = 0; i <= n; i++){
    const a = i / n * Math.PI * 2, j = i % 2 ? 1 : 1.14 + R()*.12;
    d += (i ? 'L' : 'M') + f1(40 + Math.cos(a)*62*j) + ',' + f1(Math.sin(a)*25*j);
  }
  el('path', {d:d+'Z', fill:'#7B7F87'}, boom);
  el('ellipse', {cx:40, cy:-5, rx:48, ry:12, fill:'#8E929A'}, boom);
})();

/* ---------------- crowd ---------------- */
const PEOPLE = [
  // back row
  {k:'b-60',  x:-60,  r:0, hair:'plain',  hold:'none'},
  {k:'b150',  x:150,  r:0, hair:'pony',   hold:'phone', side:1},
  {k:'b330',  x:330,  r:0, hair:'cap',    hold:'mic', side:1, flag:'CH 4', fc:C.red, ft:'#fff'},
  {k:'b525',  x:525,  r:0, hair:'curly',  hold:'phone', side:-1},
  {k:'b700',  x:700,  r:0, hair:'plain',  hold:'mic', side:-1, flag:'NEWS', fc:C.gold, ft:C.navy2},
  {k:'b900',  x:900,  r:0, hair:'bun',    hold:'phone', side:1},
  {k:'b1085', x:1085, r:0, hair:'phones', hold:'mic', side:-1, flag:'WHSKR', fc:'#2F6DB5', ft:'#fff'},
  {k:'b1265', x:1265, r:0, hair:'plain',  hold:'mic', side:-1, flag:'9', fc:C.paper, ft:C.navy},
  {k:'b1455', x:1455, r:0, hair:'hat',    hold:'phone', side:-1},
  {k:'b1650', x:1650, r:0, hair:'curly',  hold:'none'},
  // front row
  {k:'f-170', x:-170, r:1, hair:'hat',    hold:'none'},
  {k:'f60',   x:60,   r:1, hair:'plain',  hold:'mic', side:1, flag:'PRESS', fc:C.paper, ft:C.red},
  {k:'f265',  x:265,  r:1, hair:'phones', hold:'camera'},
  {k:'f470',  x:470,  r:1, hair:'hat',    hold:'mic', side:1, flag:'CH 4', fc:C.red, ft:'#fff'},
  {k:'f1065', x:1065, r:1, hair:'plain',  hold:'sign'},
  {k:'f1320', x:1320, r:1, hair:'pony',   hold:'mic', side:-1, flag:'WHSKR', fc:'#2F6DB5', ft:'#fff'},
  {k:'f1530', x:1530, r:1, hair:'curly',  hold:'phone', side:-1},
  {k:'f1740', x:1740, r:1, hair:'plain',  hold:'mic', side:-1, flag:'9', fc:C.paper, ft:C.navy},
];
const byKey = {};
(() => {
  const R = rng(42);
  const rows = [{y:800, s:.8, col:'#1D2E49', rim:'rgba(150,175,210,.35)'}, {y:870, s:1, col:'#0B1526', rim:'rgba(150,175,210,.28)'}];
  for (const p of PEOPLE){
    const row = rows[p.r];
    Object.assign(p, {y: row.y + (R()-.5)*14, s: row.s * (0.94 + R()*.12), col: row.col, rim: row.rim,
      ph: R()*6.28, f: 1.6 + R()*1.4, delay: R()*.18});
    byKey[p.k] = p;
    const g = el('g', {}, $(p.r ? 'crowdF' : 'crowdB'));
    p.g = g;
    const hair = p.col === '#0B1526' ? '#111D31' : '#26385A';
    // body
    el('path', {d:'M-120,165 C-120,82 -66,58 0,58 C66,58 120,82 120,165 L120,520 L-120,520 Z', fill:p.col, stroke:p.rim, 'stroke-width':2.5}, g);
    el('rect', {x:-18, y:26, width:36, height:40, fill:p.col}, g);
    if (p.hair === 'pony') el('path', {d:'M-9,-8 C-24,30 -12,74 2,96 C14,74 22,30 9,-8 Z', fill:hair}, g);
    el('ellipse', {cx:0, cy:0, rx:38, ry:45, fill:p.col, stroke:p.rim, 'stroke-width':2.5}, g);
    if (p.hair === 'bun')   el('circle', {cx:0, cy:-44, r:17, fill:hair, stroke:p.rim, 'stroke-width':2}, g);
    if (p.hair === 'curly') for (const [cx, cy] of [[-26,-26],[-12,-40],[6,-43],[23,-33],[33,-14],[-34,-8]]) el('circle', {cx, cy, r:15, fill:hair}, g);
    if (p.hair === 'cap'){
      el('path', {d:'M-39,-6 C-39,-58 39,-58 39,-6 Z', fill:'#2B3547'}, g);
      el('path', {d:'M-22,-8 L22,-8 L28,10 L-28,10 Z', fill:'#232B3A'}, g);
      el('rect', {x:-9, y:-16, width:18, height:10, rx:3, fill:p.col}, g);
    }
    if (p.hair === 'hat'){
      el('ellipse', {cx:0, cy:-22, rx:62, ry:11, fill:'#1A2232'}, g);
      el('path', {d:'M-36,-22 C-38,-60 -20,-70 0,-64 C20,-70 38,-60 36,-22 Z', fill:'#1F2839'}, g);
      el('rect', {x:-36, y:-33, width:72, height:9, fill:'#39424F'}, g);
      const card = el('g', {transform:'translate(10 -52) rotate(-8)'}, g);
      el('rect', {x:0, y:0, width:30, height:16, fill:C.paper}, card);
      const tx = el('text', {x:15, y:11.5, 'text-anchor':'middle', 'font-size':8, 'font-weight':900, fill:C.navy}, card); tx.textContent = 'PRESS';
    }
    if (p.hair === 'phones'){
      el('path', {d:'M-40,-2 C-42,-66 42,-66 40,-2', fill:'none', stroke:'#2C3340', 'stroke-width':8}, g);
      el('ellipse', {cx:-40, cy:2, rx:11, ry:17, fill:'#2C3340'}, g);
      el('ellipse', {cx:40, cy:2, rx:11, ry:17, fill:'#2C3340'}, g);
    }
    // what they hold
    if (p.hold === 'mic' || p.hold === 'phone'){
      p.arm = el('path', {fill:'none', stroke:p.col, 'stroke-width':28, 'stroke-linecap':'round'}, g);
      p.armRim = null;
      p.tool = el('g', {}, g);
      el('circle', {cx:0, cy:4, r:15, fill:p.col}, p.tool);
      if (p.hold === 'mic'){
        el('rect', {x:-7, y:-72, width:14, height:78, rx:5, fill:'#1B1F27'}, p.tool);
        el('rect', {x:-27, y:-70, width:54, height:38, rx:3, fill:p.fc}, p.tool);
        el('rect', {x:-27, y:-70, width:54, height:6, rx:2, fill:'#000', opacity:.12}, p.tool);
        const tx = el('text', {x:0, y:-43, 'text-anchor':'middle', 'font-size':p.flag.length > 4 ? 13 : 16, class:'flag-t', fill:p.ft}, p.tool);
        tx.textContent = p.flag;
        el('circle', {cx:0, cy:-88, r:18, fill:'#2A2F38'}, p.tool);
        el('circle', {cx:-5, cy:-94, r:6, fill:'#3D434F'}, p.tool);
      } else {
        el('rect', {x:-24, y:-86, width:48, height:86, rx:7, fill:'#0A0E14'}, p.tool);
        el('rect', {x:-20, y:-81, width:40, height:76, rx:4, fill:'#A9C7E8'}, p.tool);
        el('rect', {x:-20, y:-35, width:40, height:30, fill:'#8FB0D6'}, p.tool);
        // tiny candidate on the screen
        el('path', {d:'M-9,-50 L-11,-62 L-3,-56 L3,-56 L11,-62 L9,-50 C9,-44 5,-40 0,-40 C-5,-40 -9,-44 -9,-50 Z', fill:C.navy}, p.tool);
        el('path', {d:'M-14,-34 C-14,-40 -8,-42 0,-42 C8,-42 14,-40 14,-34 Z', fill:C.navy}, p.tool);
        el('rect', {x:-13, y:-35, width:26, height:8, fill:'#1A3055'}, p.tool);
      }
    }
    if (p.hold === 'camera'){
      el('path', {d:'M70,70 Q96,20 80,-18', fill:'none', stroke:p.col, 'stroke-width':28, 'stroke-linecap':'round'}, g);
      const cam = el('g', {transform:'translate(18 -58)'}, g);
      el('rect', {x:0, y:0, width:150, height:62, rx:8, fill:'#1B1F27'}, cam);
      el('rect', {x:20, y:-16, width:70, height:14, rx:4, fill:'#2A2F38'}, cam);
      el('path', {d:'M150,6 L196,-6 L196,70 L150,56 Z', fill:'#2A2F38'}, cam);
      el('rect', {x:196, y:-8, width:8, height:80, rx:2, fill:'#12161D'}, cam);
      el('rect', {x:-30, y:12, width:32, height:36, rx:4, fill:'#12161D'}, cam);
      const tx = el('text', {x:64, y:40, 'text-anchor':'middle', 'font-size':15, 'font-weight':900, fill:'#6B7280'}, cam); tx.textContent = 'CH 4';
      p.tally = el('circle', {cx:12, cy:12, r:5.5, fill:C.red}, cam);
    }
  }
})();

/* the yard sign */
const sign = $('sign');
const signArmL = el('path', {fill:'none', stroke:'#0B1526', 'stroke-width':26, 'stroke-linecap':'round'}, sign);
const signArmR = el('path', {fill:'none', stroke:'#0B1526', 'stroke-width':26, 'stroke-linecap':'round'}, sign);
const signBoard = el('g', {}, sign);
el('rect', {x:-5, y:60, width:10, height:230, fill:'#8A6A45'}, signBoard);
el('rect', {x:-111, y:-81, width:222, height:162, fill:C.navy}, signBoard);
el('rect', {x:-104, y:-74, width:208, height:148, fill:'none', stroke:'#fff', 'stroke-width':7}, signBoard);
{
  const a = el('text', {class:'sign-big', x:0, y:-10, 'text-anchor':'middle'}, signBoard); a.innerHTML = 'JP<tspan>4</tspan>';
  const b = el('text', {class:'sign-big', x:0, y:30, 'text-anchor':'middle'}, signBoard); b.textContent = 'MAYOR';
  const c = el('text', {class:'sign-small', x:0, y:54, 'text-anchor':'middle'}, signBoard); c.textContent = 'CATS · BIKE LANES';
}
const signHands = [el('circle', {r:15, fill:'#0B1526'}, sign), el('circle', {r:15, fill:'#0B1526'}, sign)];

/* ---------------- flashes ---------------- */
const FLASHES = [];
(() => {
  const R = rng(1234);
  for (let t = 0.1; t < 16.25; t += 0.06){ const s = trSurge(t); if (R() < s*s*.26) FLASHES.push({t, u:R(), v:R(), z:.6 + R()*.7}); }
  for (let i = 0; i < 14; i++) FLASHES.push({t:14.77 + R()*.95, u:R(), v:R(), z:.8 + R()*.6});
})();
const flashPool = [];
for (let i = 0; i < 16; i++){
  const g = el('g', {style:'display:none'}, $('flashes'));
  el('circle', {r:1, fill:'url(#sp-flashG)'}, g);
  el('path', {d:'M-.7,0 L.7,0 M0,-.7 L0,.7', stroke:'#fff', 'stroke-width':.03, 'stroke-linecap':'round'}, g);
  flashPool.push(g);
}

/* ---------------- speech bubbles ---------------- */
const bubLayer = $('bubbles');
for (const b of LINES){
  b.g = el('g', {style:'display:none'}, bubLayer);
  b.stroke = el('path', {class:'bstroke ' + b.who}, b.g);
  b.fill = el('path', {class:'bfill ' + b.who}, b.g);
  b.txt = el('text', {class:'btxt ' + b.who, 'text-anchor':'middle'}, b.g);
  b.spans = b.text.map(s => { const sp = el('tspan', {}, b.txt); sp.textContent = s; return sp; });
  b.rot = b.who === 'press' ? (b.id.charCodeAt(1) % 2 ? -2.2 : 2) : 0;
  if (b.who === 'cat') b.g.setAttribute('filter', 'url(#sp-shadow)');
}
function rr(x, y, w, h, r){
  return `M${x+r},${y} H${x+w-r} Q${x+w},${y} ${x+w},${y+r} V${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} H${x+r} Q${x},${y+h} ${x},${y+h-r} V${y+r} Q${x},${y} ${x+r},${y} Z`;
}

/* ---------------- the daydream: "how does a cat even ride a bike?" ---------------- */
// He looks up and pictures it: himself, in the suit and a small helmet, cycling
// down a protected bike lane. Timings in DREAM; the cloud's position per layout.
const DREAM = {
  dots:[11.4, 11.55, 11.7], in:11.8, out:13.25,
  L:{c:[1195,268], rx:215, ry:118, dots:[[905,292,5],[930,284,7.5],[958,276,10]]},
  P:{c:[800,128], rx:290, ry:112, dots:[[905,290,5],[925,272,7.5],[945,256,10]]}
};
const dream = $('dream');
const dreamClip = el('clipPath', {id:'sp-dreamClip'}, svg.querySelector('defs'));
const dreamClipE = el('ellipse', {cx:0, cy:0}, dreamClip);
const dreamDots = [0,1,2].map(() => el('circle', {fill:'#fff', stroke:C.navy, 'stroke-width':3.5}, dream));
const dreamCloud = el('g', {}, dream);
const cloudStroke = el('path', {fill:C.navy, stroke:C.navy, 'stroke-width':8, 'stroke-linejoin':'round'}, dreamCloud);
const cloudFill = el('path', {fill:'#fff'}, dreamCloud);
const scene = el('g', {'clip-path':'url(#sp-dreamClip)'}, dreamCloud);
// sky, sun, skyline
el('rect', {x:-400, y:-200, width:800, height:240, fill:'#DCE6EF'}, scene);
el('circle', {cx:120, cy:-62, r:20, fill:C.gold, opacity:.75}, scene);
const skyline = el('g', {fill:'#C3CFDA'}, scene);
for (let k = 0; k < 3; k++) for (const [x, w, h] of [[0,46,70],[50,30,100],[84,54,56],[142,36,86],[182,60,64],[246,40,108],[290,52,72],[346,44,90]])
  el('rect', {x:x + k*400 - 600, y:28 - h, width:w, height:h}, skyline);
// the lane, curb, road
el('rect', {x:-400, y:28, width:800, height:46, fill:'#C45A4E'}, scene);
const laneMarks = el('g', {}, scene);
for (let k = 0; k < 4; k++){
  const g = el('g', {transform:`translate(${k*220 - 330} 52)`}, laneMarks);
  el('circle', {cx:-9, cy:0, r:6, fill:'none', stroke:'#fff', 'stroke-width':2, opacity:.8}, g);
  el('circle', {cx:9, cy:0, r:6, fill:'none', stroke:'#fff', 'stroke-width':2, opacity:.8}, g);
  el('path', {d:'M-9,0 L-2,-8 L6,-8 L9,0 M-2,-8 L0,0', fill:'none', stroke:'#fff', 'stroke-width':2, opacity:.8}, g);
}
el('rect', {x:-400, y:74, width:800, height:10, fill:C.paper2}, scene);
el('rect', {x:-400, y:84, width:800, height:90, fill:'#5E6975'}, scene);
const roadDash = el('g', {fill:'#fff', opacity:.85}, scene);
for (let k = 0; k < 10; k++) el('rect', {x:k*90 - 450, y:116, width:44, height:5}, roadDash);
// speed lines
const speed = el('g', {stroke:'#fff', 'stroke-width':3, 'stroke-linecap':'round'}, scene);
const speedLines = [[-40,24],[-24,34],[-6,20]].map(([y, w]) => ({y, w, e:el('line', {}, speed)}));
// rider
const rider = el('g', {}, scene);
const legFar = el('path', {fill:'none', stroke:'#0A1A33', 'stroke-width':7, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, rider);
const footFar = el('ellipse', {rx:5, ry:3, fill:'#07101E'}, rider);
const tailMini = el('path', {fill:'none', stroke:C.navy, 'stroke-width':5, 'stroke-linecap':'round'}, rider);
const wheels = [-36, 40].map(x => {
  const g = el('g', {transform:`translate(${x} 34)`}, rider);
  el('circle', {r:22, fill:'none', stroke:'#0C1D37', 'stroke-width':4}, g);
  const sp = el('g', {stroke:'#3A4A63', 'stroke-width':1.4}, g);
  for (let k = 0; k < 4; k++) el('line', {x1:0, y1:-20, x2:0, y2:20, transform:`rotate(${k*45})`}, sp);
  el('circle', {r:3, fill:'#0C1D37'}, g);
  return sp;
});
el('path', {d:'M-36,34 L0,34 L-10,-6 Z M-10,-6 L30,-4 L0,34 M30,-4 L40,34', fill:'none', stroke:C.red, 'stroke-width':4.5, 'stroke-linejoin':'round', 'stroke-linecap':'round'}, rider);
el('path', {d:'M30,-4 L28,-14 L37,-16', fill:'none', stroke:'#0C1D37', 'stroke-width':3, 'stroke-linecap':'round'}, rider);
el('ellipse', {cx:-12, cy:-9, rx:9, ry:3, fill:'#0C1D37'}, rider);
const crank = el('line', {stroke:'#0C1D37', 'stroke-width':3, 'stroke-linecap':'round'}, rider);
// body in the suit
el('path', {d:'M-8,-12 L12,-40', stroke:C.navy, 'stroke-width':17, 'stroke-linecap':'round'}, rider);
el('path', {d:'M9,-40 L13,-31 L6,-33 Z', fill:'#fff'}, rider);
el('path', {d:'M10,-36 L5,-24', stroke:C.red, 'stroke-width':3.2, 'stroke-linecap':'round'}, rider);
el('path', {d:'M12,-40 Q26,-30 34,-15', fill:'none', stroke:C.navy, 'stroke-width':6, 'stroke-linecap':'round'}, rider);
el('circle', {cx:34, cy:-15, r:3.6, fill:C.navy}, rider);
const legNear = el('path', {fill:'none', stroke:C.navy, 'stroke-width':7.5, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, rider);
const footNear = el('ellipse', {rx:5, ry:3, fill:'#07101E'}, rider);
// head, helmet, ears, happy eye, whiskers
const miniHead = el('g', {}, rider);
el('ellipse', {cx:22, cy:-56, rx:13, ry:11.5, fill:C.navy}, miniHead);
el('path', {d:'M8.5,-58 Q22,-80 36,-58 Z', fill:C.gold}, miniHead);
el('path', {d:'M10,-60 L36,-60', stroke:'#A67A1F', 'stroke-width':2}, miniHead);
el('path', {d:'M13,-64 L11,-78 L20,-68 Z M26,-68 L34,-78 L32,-63 Z', fill:C.navy}, miniHead);
el('path', {d:'M24,-56 Q27.5,-60 31,-56', fill:'none', stroke:'#E2B03E', 'stroke-width':1.8, 'stroke-linecap':'round'}, miniHead);
const miniWh = el('path', {d:'M33,-52 L46,-55 M33,-49 L46,-48', stroke:C.navy, 'stroke-width':1.4, 'stroke-linecap':'round'}, miniHead);
// bollards: nearer than the bike, that's the protection
const bollards = el('g', {}, scene);
const bolls = [];
for (let k = 0; k < 12; k++){
  const g = el('g', {}, bollards);
  el('rect', {x:-4, y:52, width:8, height:32, rx:3, fill:'#fff'}, g);
  el('rect', {x:-4, y:58, width:8, height:6, fill:C.red}, g);
  el('rect', {x:-4, y:52, width:8, height:32, rx:3, fill:'none', stroke:'#8A96A3', 'stroke-width':1}, g);
  bolls.push(g);
}
function cloudPath(rx, ry){
  const n = 14, pts = [];
  for (let i = 0; i < n; i++){ const a = i/n*Math.PI*2 + .1; pts.push([Math.cos(a)*rx, Math.sin(a)*ry]); }
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 1; i <= n; i++){
    const a = pts[i-1], b = pts[i % n], r = Math.hypot(b[0]-a[0], b[1]-a[1])*.6;
    d += ` A${f1(r)},${f1(r)} 0 0 1 ${f1(b[0])},${f1(b[1])}`;
  }
  return d + ' Z';
}
function layoutDream(){
  const D = DREAM[mode];
  const d = cloudPath(D.rx, D.ry);
  set(cloudStroke, 'd', d); set(cloudFill, 'd', d);
  set(dreamClipE, 'rx', D.rx - 4); set(dreamClipE, 'ry', D.ry - 4);
  dreamDots.forEach((c, i) => { set(c, 'cx', D.dots[i][0]); set(c, 'cy', D.dots[i][1]); set(c, 'r', D.dots[i][2]); });
}
function legPath(hip, foot, L1, L2){
  const dx = foot[0]-hip[0], dy = foot[1]-hip[1], L = Math.min(Math.hypot(dx, dy), L1 + L2 - .01);
  const a = (L1*L1 - L2*L2 + L*L)/(2*L), h = Math.sqrt(Math.max(0, L1*L1 - a*a));
  const ux = dx/L, uy = dy/L;
  const knee = [hip[0] + a*ux + h*(-uy)*-1, hip[1] + a*uy + h*(ux)*-1];
  if (knee[0] < hip[0]) { knee[0] = hip[0] + a*ux - h*(-uy)*-1; knee[1] = hip[1] + a*uy - h*ux*-1; }
  return `M${f1(hip[0])},${f1(hip[1])} L${f1(knee[0])},${f1(knee[1])} L${f1(foot[0])},${f1(foot[1])}`;
}
function renderDream(t){
  if (t < DREAM.dots[0] - .05 || t > DREAM.out + .25){ dream.style.display = 'none'; return; }
  dream.style.display = '';
  const D = DREAM[mode];
  const out = clamp((t - DREAM.out)/.18);
  dreamDots.forEach((c, i) => {
    const k = clamp((t - DREAM.dots[i])/.18);
    c.style.opacity = (Math.min(1, k*3)*(1 - out)).toFixed(3);
    set(c, 'transform', `translate(${D.dots[i][0]} ${D.dots[i][1]}) scale(${(.2 + .8*E.back(k)).toFixed(3)}) translate(${-D.dots[i][0]} ${-D.dots[i][1]})`);
  });
  const k = clamp((t - DREAM.in)/.3);
  const sc = (.25 + .75*E.back(k)) * (1 + .1*out);
  const [ox, oy] = D.dots[2];
  dreamCloud.style.opacity = (Math.min(1, k*3)*(1 - out)).toFixed(3);
  set(dreamCloud, 'transform', `translate(${ox} ${oy}) scale(${sc.toFixed(3)}) translate(${-ox} ${-oy}) translate(${D.c[0]} ${D.c[1]})`);
  if (k <= 0) return;
  const tt = t - DREAM.in;
  // scenery scrolls left
  const wrap = (x, W) => ((x % W) + W) % W - W/2;
  set(skyline, 'transform', `translate(${f1(wrap(-tt*30, 400))} 0)`);
  set(laneMarks, 'transform', `translate(${f1(wrap(-tt*260, 220))} 0)`);
  set(roadDash, 'transform', `translate(${f1(wrap(-tt*300, 90))} 0)`);
  bolls.forEach((g, i) => set(g, 'transform', `translate(${f1(wrap(i*70 - tt*260, 840))} 0)`));
  speedLines.forEach((l, i) => {
    const x0 = -64 - ((tt*140 + i*23) % 40);
    set(l.e, 'x1', f1(x0 - l.w)); set(l.e, 'x2', f1(x0)); set(l.e, 'y1', l.y); set(l.e, 'y2', l.y);
  });
  // rider
  set(rider, 'transform', `translate(-14 ${f1(-5 + Math.sin(tt*18)*1.3)}) scale(1.3)`);
  wheels.forEach(sp => set(sp, 'transform', `rotate(${f1(tt*800 % 360)})`));
  const th = tt*9, A = [Math.cos(th)*11, 34 + Math.sin(th)*11], B = [-A[0], 68 - A[1]];
  set(crank, 'x1', f1(A[0])); set(crank, 'y1', f1(A[1])); set(crank, 'x2', f1(B[0])); set(crank, 'y2', f1(B[1]));
  const hip = [-8, -12];
  set(legNear, 'd', legPath(hip, A, 25, 27)); set(legFar, 'd', legPath(hip, B, 25, 27));
  set(footNear, 'cx', f1(A[0] + 2)); set(footNear, 'cy', f1(A[1] - 1));
  set(footFar, 'cx', f1(B[0] + 2)); set(footFar, 'cy', f1(B[1] - 1));
  const w = Math.sin(tt*9);
  set(tailMini, 'd', `M-12,-14 Q${f1(-36)},${f1(-16 + w*5)} ${f1(-52)},${f1(-30 + w*7)} T${f1(-70)},${f1(-38 - w*4)}`);
  set(miniHead, 'transform', `rotate(${f1(Math.sin(tt*18)*1.5)} 22 -50)`);
}

function layoutBubbles(){
  const safe = SAFE[mode];
  for (const b of LINES){
    const L = b[mode];
    let fs = (mode === 'P' ? 34 : 27) * (b.small ? .8 : 1);
    set(b.txt, 'font-size', fs);
    const was = b.g.style.display; b.g.style.display = '';
    let maxW = 0; for (const sp of b.spans) maxW = Math.max(maxW, sp.getComputedTextLength());
    b.g.style.display = was;
    const padX = fs*.78, padY = fs*.52, lh = fs*1.16;
    const w = maxW + padX*2, h = b.spans.length*lh + padY*2 - (lh - fs)*.6;
    let cx = clamp(L.c[0], safe.x + w/2 + 14, safe.x + safe.w - w/2 - 14);
    let cy = clamp(L.c[1], safe.y + h/2 + 14, safe.y + safe.h - h/2 - 14);
    const x0 = cx - w/2, y0 = cy - h/2, r = Math.min(fs*.62, h/2);
    b.spans.forEach((sp, i) => { set(sp, 'x', f1(cx)); set(sp, 'y', f1(y0 + padY + fs*.8 + i*lh)); });
    // tail
    const [tx, ty] = L.tip, bw = fs*.9, m = r + bw*.5;
    let tail;
    if (ty > y0 + h || ty < y0){
      const ey = ty > y0 + h ? y0 + h - 2 : y0 + 2, bx = clamp(tx, x0 + m, x0 + w - m);
      const my = (ey + ty)/2;
      tail = `M${f1(bx - bw/2)},${f1(ey)} Q${f1(bx - bw*.05 + (tx-bx)*.35)},${f1(my)} ${f1(tx)},${f1(ty)} Q${f1(bx + bw*.3 + (tx-bx)*.35)},${f1(my)} ${f1(bx + bw/2)},${f1(ey)} Z`;
    } else {
      const ex = tx > x0 + w ? x0 + w - 2 : x0 + 2, by = clamp(ty, y0 + m, y0 + h - m);
      const mx = (ex + tx)/2;
      tail = `M${f1(ex)},${f1(by - bw/2)} Q${f1(mx)},${f1(by - bw*.05 + (ty-by)*.35)} ${f1(tx)},${f1(ty)} Q${f1(mx)},${f1(by + bw*.3 + (ty-by)*.35)} ${f1(ex)},${f1(by + bw/2)} Z`;
    }
    const d = rr(f1(x0), f1(y0), f1(w), f1(h), f1(r)) + ' ' + tail;
    set(b.stroke, 'd', d); set(b.fill, 'd', d);
    set(b.stroke, 'stroke-width', b.who === 'cat' ? 6 : 6);
    b.cx = cx; b.cy = cy; b.tip = [tx, ty];
  }
}

/* ---------------- render ---------------- */
const cat = $('cat'), head = $('head'), paws = $('paws');
const earL = $('earL'), earR = $('earR');
const lidL = $('lidL'), lidR = $('lidR'), lnL = $('lnL'), lnR = $('lnR');
const pupL = $('pupL'), pupR = $('pupR'), hlL = $('hlL'), hlR = $('hlR');
const mouthO = $('mouthO'), mO = $('mO'), mT = $('mT'), wL = $('wL'), wR = $('wR');
const armR = $('armR'), cuffR = $('cuffR'), pawR = $('pawR'), pawRb = $('pawRb'), beans = $('beans'), pawToes = $('pawToes');
const tail = $('tail'), micL = $('micL'), micR = $('micR');
const dim = $('dim'), skip = $('skip');
const cats = LINES.filter(b => b.who === 'cat');

function speaking(t){
  for (const b of cats){
    const s = t - b.t0 - .08;
    const segs = b.speak; const total = segs[segs.length-1];
    if (s < 0 || s > total) continue;
    // c2 has a pause between sentences
    if (segs.length === 3 && s > segs[0] && s < segs[1]) return {open:0, bob:0};
    const env = Math.min(1, s/.06, (total - s)/.08);
    const open = env * (.3 + .7*Math.abs(Math.sin(s*Math.PI*6.2 + Math.sin(s*9)*.8)));
    return {open, bob: Math.sin(s*Math.PI*5)*1.4};
  }
  return {open:0, bob:0};
}
function tailPhase(t){ let ph = 0; const dt = .05; for (let x = 0; x < t; x += dt) ph += dt*(1.3 + 4.2*trTailAmp(x)); return ph; }
function quad(p0, c, p1, u){ const a = 1-u; return [a*a*p0[0] + 2*a*u*c[0] + u*u*p1[0], a*a*p0[1] + 2*a*u*c[1] + u*u*p1[1]]; }

function render(t){
  /* ---- candidate ---- */
  const duck = trDuck(t), lean = trLean(t);
  const catDY = duck*400 + lean*8;
  const catT = `translate(585 ${f1(199.9 + catDY)}) scale(2.15)`;
  set(cat, 'transform', catT); set(paws, 'transform', catT);
  paws.style.opacity = 1 - clamp(duck*2.2);

  const sp = speaking(t);
  const tilt = trTilt(t) + sp.bob;
  const ls = 1 + .07*lean;
  set(head, 'transform', `rotate(${f1(tilt)} 100 122) translate(100 ${f1(122 + lean*4)}) scale(${ls.toFixed(3)}) translate(-100 -122)`);

  const twL = bump(t, .95, .12)*16 + bump(t, 7.05, .12)*18 + bump(t, 10.15, .1)*14 + bump(t, 10.6, .1)*14;
  const twR = bump(t, 4.1, .12)*16 + bump(t, 10.15, .1)*14 + bump(t, 16.05, .15)*-20 + bump(t, 12.1, .1)*-14;
  const ear = trEar(t);
  set(earL, 'transform', `rotate(${f1(-(ear + twL))} 81 58.5)`);
  set(earR, 'transform', `rotate(${f1(ear + twR)} 119 58.5)`);

  let lid = trLid(t);
  for (const bt of BLINKS) lid = Math.max(lid, bump(t, bt, .1));
  if (t >= CARD_AT) lid = 1;
  const lh = lid*14;
  set(lidL, 'height', f1(lh)); set(lidR, 'height', f1(lh));
  for (const ln of [lnL, lnR]){ set(ln, 'y1', f1(73 + lh)); set(ln, 'y2', f1(73 + lh)); }
  const wide = clamp(1 - lid*2.6), px = trPx(t), py = trPy(t);
  const prx = f1(lerp(1.9, 3.5, wide)*10)/10, pry = lerp(4.6, 5.4, wide);
  set(pupL, 'cx', f1(84 + px)); set(pupL, 'cy', f1(80 + py)); set(pupL, 'rx', prx); set(pupL, 'ry', f1(pry));
  set(pupR, 'cx', f1(116 + px)); set(pupR, 'cy', f1(80 + py)); set(pupR, 'rx', prx); set(pupR, 'ry', f1(pry));
  set(hlL, 'cx', f1(85.8 + px)); set(hlR, 'cx', f1(117.8 + px));

  const open = sp.open + lean*.15*(sp.open > 0);
  mouthO.style.display = open > .04 ? '' : 'none';
  set(mO, 'ry', f1((.6 + open*4.2)*10)/10); set(mT, 'cy', f1(99.5 + open*2.2)); set(mT, 'ry', f1((.4 + open*1.6)*10)/10);
  const wh = Math.sin(t*2.3)*1.5 + open*3;
  set(wL, 'transform', `rotate(${f1(-wh)} 72 97)`); set(wR, 'transform', `rotate(${f1(wh)} 128 97)`);

  // the "get away" paw
  const raise = trRaise(t);
  const shoo = raise > .6 ? Math.sin(t*Math.PI*2*3.1) * (raise - .6)/.4 : 0;
  const S0 = [142,140], P = [lerp(140, 164, raise) + shoo*3.5, lerp(165, 90, raise)], Cc = [lerp(142, 180, raise), lerp(152, 146, raise)];
  set(armR, 'd', `M${S0} Q${Cc.map(f1)} ${P.map(f1)}`);
  const c1 = quad(S0, Cc, P, .74), c2 = quad(S0, Cc, P, .85);
  set(cuffR, 'd', `M${c1.map(f1)} L${c2.map(f1)}`);
  set(pawR, 'transform', `translate(${P.map(f1).join(' ')}) rotate(${f1(shoo*13 - raise*6)})`);
  set(pawRb, 'ry', f1(lerp(8, 13, raise)));
  set(pawRb, 'rx', f1(lerp(12.5, 11.5, raise)));
  beans.style.opacity = clamp((raise - .45)/.35);
  pawToes.style.opacity = 1 - clamp(raise/.3);

  // tail
  const amp = trTailAmp(t), ph = tailPhase(t);
  const ang = 6 + amp*20*Math.sin(ph), cu = Math.sin(ph + .9);
  set(tail, 'transform', `translate(988 ${f1(630 + catDY)}) rotate(${f1(ang)})`);
  set(tail, 'd', `M0,0 C70,-10 ${f1(84 + 18*cu)},-100 ${f1(54 + 26*cu)},-168 C${f1(40 + 26*cu)},-202 ${f1(50 + 40*cu)},-232 ${f1(80 + 36*cu)},-228`);

  // mics wobble when he ducks past them
  const wob = t > 15.7 ? Math.sin((t - 15.7)*26) * Math.exp(-(t - 15.7)*5) * 7 : 0;
  set(micL, 'transform', `rotate(${f1(-wob)} 788 540)`); set(micR, 'transform', `rotate(${f1(wob*.8)} 812 540)`);

  // boom
  const dip = trBoomDip(t);
  set(boom, 'transform', `translate(${f1(590 + Math.sin(t*.9)*6 + dip*26)} ${f1(236 + Math.sin(t*1.3)*4 + dip*14)}) rotate(${f1(12 + Math.sin(t*.7)*1.2 + dip*2)})`);

  /* ---- press ---- */
  const active = {};
  for (const b of LINES) if (b.by && t >= b.t0 - .1 && t <= b.t1) active[b.by] = 1;
  for (const p of PEOPLE){
    const reach = clamp(trSurge(t - p.delay) + (active[p.k] ? .4 : 0));
    const bob = Math.sin(t*p.f*2 + p.ph)*(2 + 9*reach);
    const sway = Math.sin(t*p.f*1.26 + p.ph*1.7)*(3 + 10*reach);
    const X = p.x + sway, Y = p.y + bob - 16*reach;
    p.X = X; p.Y = Y;
    set(p.g, 'transform', `translate(${f1(X)} ${f1(Y)}) scale(${p.s.toFixed(3)})`);
    if (p.tool){
      const aimX = clamp((800 - p.x)/p.s*.1*reach, -70, 70);
      const hx = p.side*50 + aimX + Math.sin(t*p.f*2.6 + p.ph)*6*reach;
      const hy = (p.hold === 'phone' ? -150 : -126) - 40*reach + Math.cos(t*p.f*2.2 + p.ph)*5 - (active[p.k] ? 22 : 0);
      set(p.arm, 'd', `M${p.side*82},82 Q${p.side*122},${-2} ${f1(hx)},${f1(hy)}`);
      let a = 0;
      if (p.hold === 'mic'){
        const wx = X + hx*p.s, wy = Y + hy*p.s;
        a = clamp(Math.atan2(800 - wx, -(400 - wy)) * 180/Math.PI, -42, 42);
      } else a = Math.sin(t*p.f + p.ph)*5 + (800 - p.x)*.008;
      set(p.tool, 'transform', `translate(${f1(hx)} ${f1(hy)}) rotate(${f1(a)})`);
    }
    if (p.tally) p.tally.style.opacity = Math.sin(t*7) > 0 ? 1 : .25;
  }

  // yard sign
  const h = byKey.f1065, rise = trSign(t);
  const shake = Math.sin(t*Math.PI*2*3.6) * 7 * clamp((t - 6.8)/.2) * clamp((8.4 - t)/.3);
  const sx = h.X - 18 + shake*.8, sy = lerp(1120, 640, rise);
  set(signBoard, 'transform', `translate(${f1(sx)} ${f1(sy)}) rotate(${f1(shake*.9 - 3)})`);
  const g1 = [sx - Math.sin(shake*.016)*140, sy + 150], g2 = [sx - Math.sin(shake*.016)*205, sy + 215];
  set(signHands[0], 'cx', f1(g1[0])); set(signHands[0], 'cy', f1(g1[1]));
  set(signHands[1], 'cx', f1(g2[0])); set(signHands[1], 'cy', f1(g2[1]));
  set(signArmL, 'd', `M${f1(h.X - 70)},${f1(h.Y + 90)} Q${f1(h.X - 110)},${f1((h.Y + g1[1])/2)} ${f1(g1[0])},${f1(g1[1])}`);
  set(signArmR, 'd', `M${f1(h.X + 70)},${f1(h.Y + 90)} Q${f1(h.X + 60)},${f1((h.Y + g2[1])/2 + 30)} ${f1(g2[0])},${f1(g2[1])}`);
  sign.style.display = rise > .01 ? '' : 'none';

  /* ---- flashes ---- */
  const safe = SAFE[mode];
  let n = 0;
  if (!reduced) for (const f of FLASHES){
    const age = t - f.t;
    if (age < 0 || age > .22 || n >= flashPool.length) continue;
    const g = flashPool[n++], o = Math.pow(1 - age/.22, 2);
    const fx = safe.x + 40 + f.u*(safe.w - 80), fy = 600 + f.v*240, R = (60 + 70*f.z)*(0.8 + .4*o);
    g.style.display = ''; g.style.opacity = o.toFixed(3);
    set(g, 'transform', `translate(${f1(fx)} ${f1(fy)}) scale(${f1(R)})`);
  }
  for (let i = n; i < flashPool.length; i++) flashPool[i].style.display = 'none';

  /* ---- bubbles ---- */
  for (const b of LINES){
    if (t < b.t0 || t > b.t1 + .18){ b.g.style.display = 'none'; continue; }
    b.g.style.display = '';
    const inn = clamp((t - b.t0)/.26), out = clamp((t - b.t1)/.16);
    let s = (.35 + .65*E.back(inn)) * (1 - .12*out);
    const jig = b.who === 'press' ? Math.sin((t - b.t0)*38)*1.4*clamp(1 - (t - b.t0)/.45) : 0;
    b.g.style.opacity = (Math.min(1, inn*3)*(1 - out)).toFixed(3);
    const [tx, ty] = b.tip;
    set(b.g, 'transform', `translate(${f1(tx)} ${f1(ty)}) scale(${s.toFixed(3)}) translate(${f1(-tx)} ${f1(-ty)}) rotate(${f1(b.rot + jig)} ${f1(b.cx)} ${f1(b.cy)})`);
  }

  renderDream(t);

  /* ---- fades ---- */
  dim.style.opacity = trStart(t).toFixed(3);
  if (!leaving) root.style.opacity = trOut(t).toFixed(3);
  skip.classList.toggle('gone', t >= 16.1);
}


/* ---------------- playback ---------------- */
let t = 0, playing = true, last = null, done = false;
if (force && q.has('t')){ t = parseFloat(q.get('t')) || 0; playing = false; }

function finish(){
  if (done) return;
  done = true; playing = false; leaving = true;
  root.classList.add('sp-leaving');
  htmlStyle.overflow = prevOverflow;
  removeEventListener('keydown', onKey);
  setTimeout(() => { root.remove(); style.remove(); }, 500);
}
function frame(ts){
  if (done) return;
  if (last === null) last = ts;
  const dt = Math.min(.05, (ts - last)/1000); last = ts;
  if (playing){ t += dt; if (t >= END){ t = END; render(t); finish(); return; } }
  render(t);
  requestAnimationFrame(frame);
}
function onKey(e){ if (e.key === 'Escape') finish(); }

root.addEventListener('click', finish);
addEventListener('keydown', onKey);
addEventListener('resize', () => { if (!done) layoutView(); });
layoutView();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!done) layoutBubbles(); });
if (force) window.__splashSeek = x => { t = x; playing = false; render(t); };
render(t);
requestAnimationFrame(frame);
})();
