/* The new-bet chime, and this device's choice to hear it.

   Like the theme, the on/off choice is per device and never in the
   database — muting your phone doesn't mute the big screen.

   One audio context is made and reused for every beep. Browsers only allow a
   handful to exist at once (iPhones about four to six), so a new one per beep
   eventually goes silent. Phones also refuse to play sound until the page has
   been touched, so the first tap anywhere unlocks it. An iPhone on silent
   can't be made to beep by any web page. */

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

/* Under a Halloween theme the chime is a theremin's "ooo-OOO-ooo" instead:
   a sine that swoops up then sinks a minor sixth, with a slow wobble. */
const haunted = () => (document.documentElement.dataset.theme || "").startsWith("halloween");

function ghostly(c) {
  const t = c.currentTime;
  const osc = c.createOscillator(), wobble = c.createOscillator();
  const depth = c.createGain(), gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.28);
  osc.frequency.exponentialRampToValueAtTime(554, t + 1.0);
  wobble.frequency.value = 6.5;
  depth.gain.value = 14;
  wobble.connect(depth).connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.12);
  gain.gain.setValueAtTime(0.11, t + 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  osc.connect(gain).connect(c.destination);
  osc.start(t); wobble.start(t);
  osc.stop(t + 1.12); wobble.stop(t + 1.12);
}

export function beep() {
  if (!soundOn()) return;
  try {
    const c = context();
    if (!c || c.state !== "running") return;
    if (haunted()) { ghostly(c); return; }
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
