/* ===========================================================================
   Entry point. Picks a screen, renders it, wires it. Nothing else.
   =========================================================================== */

import { state, onChange, boot } from "./store.js";
import { esc } from "./format.js";
import { restore } from "./theme.js";
import { unlockAudio } from "./sound.js";
import * as join from "./screens/join.js";
import * as seat from "./screens/seat.js";
import * as room from "./screens/room.js";
import * as setup from "./screens/setup.js";
import * as closeout from "./screens/closeout.js";
import * as settle from "./screens/settle.js";
import * as stats from "./screens/stats.js";
import * as idle from "./screens/idle.js";
import * as roster from "./screens/roster.js";
import * as rules from "./screens/rules.js";
import * as past from "./screens/past.js";
import * as offline from "./screens/offline.js";
import * as big from "./screens/bigscreen.js";

const root = document.getElementById("app");
const dot = document.getElementById("live");

const SCREENS = { join, seat, room, setup, closeout, settle, stats, idle, roster,
                  rules, past, offline, big };

const STATIC = {
  loading: () => `<div class="center"><p>Connecting…</p></div>`,

  unconfigured: () => `<div class="center">
    <h1 class="cond">Almost there</h1>
    <p>Open <code>js/config.js</code> and paste your Supabase publishable key in,
       replacing PASTE_YOUR_PUBLISHABLE_KEY_HERE.</p>
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
  </div>`,
};

/* The whole screen is rebuilt on every change, which would otherwise throw
   away whatever you were in the middle of typing: the cursor, the keyboard,
   and on fields that aren't saved anywhere (a PIN, a new name) the text
   itself. So before each rebuild, note the field in use and any scrolled
   panels, and put them back afterwards. Panels opt in with data-keep-scroll. */
const TYPED = new Set(["text", "search", "password", "number", "email", "tel", "url", ""]);

function capture() {
  const el = document.activeElement;
  const field = el && el.id && root.contains(el) &&
    (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && TYPED.has(el.type)))
    ? { id: el.id, value: el.value, start: el.selectionStart, end: el.selectionEnd }
    : null;
  const scrolls = {};
  root.querySelectorAll("[data-keep-scroll]").forEach(p => {
    scrolls[p.dataset.keepScroll] = p.scrollTop;
  });
  return { field, scrolls };
}

function putBack({ field, scrolls }) {
  root.querySelectorAll("[data-keep-scroll]").forEach(p => {
    const top = scrolls[p.dataset.keepScroll];
    if (top) p.scrollTop = top;
  });
  if (!field) return;
  const el = document.getElementById(field.id);
  if (!el || el.disabled) return;
  if (el.value !== field.value) {
    el.value = field.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));   // keep drafts in step
  }
  el.focus({ preventScroll: true });
  try { el.setSelectionRange(field.start, field.end); } catch (e) { /* number fields */ }
}

/* A new screen starts at the top. Without this, opening Settle or Stats from
   halfway down the board lands mid-page with its Back button scrolled off
   the top — on an iPhone, tucked up under the address bar. */
let shown = null;

function render() {
  dot.dataset.live = state.live ? "1" : "0";
  const kept = state.screen === shown ? capture() : null;

  const screen = SCREENS[state.screen];
  if (screen) {
    root.innerHTML = screen.view();
    screen.wire(root);
  } else {
    root.innerHTML = (STATIC[state.screen] ?? STATIC.loading)();
  }

  if (kept) putBack(kept);
  if (state.screen !== shown) {
    shown = state.screen;
    window.scrollTo(0, 0);
  }
}

/* Phones won't play sound until the page has been touched. */
["pointerdown", "keydown"].forEach(type =>
  document.addEventListener(type, unlockAudio, { capture: true, passive: true }));

restore();
onChange(render);
boot();
