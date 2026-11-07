/* The new-bet chime (and, under a seasonal theme, its lock and grade
   sounds), and this device's choice to hear them.

   Like the theme, the on/off choice is per device and never in the
   database — muting your phone doesn't mute the big screen.

   One audio context is made and reused for every beep. Browsers only allow a
   handful to exist at once (iPhones about four to six), so a new one per beep
   eventually goes silent. Phones also refuse to play sound until the page has
   been touched, so the first tap anywhere unlocks it. An iPhone on silent
   can't be made to beep by any web page. */

import { activeSeason } from "./theme.js";

const KEY = "betroom.sound";
let ctx = null;

export function soundOn() {
  try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; }
}

export function setSound(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* private mode */ }
  if (on) unlockAudio();
}

function context() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { ctx = new Ctx(); } catch (e) { ctx = null; }
  return ctx;
}

/* Called on the first tap or key press; harmless to call again. */
export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

/* A seasonal theme can bring its own sounds: chime() for a new bet, and
   lockChime() and gradeChime() for a bet locking and being graded. Without
   one, a new bet gets the plain two-note beep and the others stay quiet. */
function ready() {
  if (!soundOn()) return null;
  const c = context();
  return c && c.state === "running" ? c : null;
}

export function beep() {
  try {
    const c = ready();
    if (!c) return;
    const own = activeSeason()?.chime;
    if (own) { own(c); return; }
    const osc = c.createOscillator(), gain = c.createGain();
    const t = c.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.09);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  } catch (e) { /* audio is a nicety, never a failure */ }
}

function seasonal(name) {
  try {
    const c = ready();
    const own = activeSeason()?.[name];
    if (c && own) own(c);
  } catch (e) { /* likewise */ }
}

export const lockSound = () => seasonal("lockChime");
export const gradeSound = () => seasonal("gradeChime");
