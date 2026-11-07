/* Part: the little flourishes a seasonal theme puts on a bet as it locks or
   gets graded, and the Man of the House crown. Used by the board and the big
   screen. The markup is always the same; only a seasonal stylesheet gives
   it a look (under the other themes these are empty, invisible spans).

   The whole screen is redrawn on every change, which would restart the
   animation each time, so each flourish carries --t0: minus the time it has
   already been running, which the stylesheet uses as its delay. */

import { state, LOCK_FX_MS, GRADE_FX_MS } from "../store.js";

const elapsed = (when, ms) => {
  const age = Date.now() - when;
  return age >= 0 && age < ms ? age : null;
};

/* Frost over the card and a padlock clicking shut. */
export function lockFx(bet) {
  const age = elapsed(state.justLocked[bet.id], LOCK_FX_MS);
  if (age === null) return "";
  return `<span class="lockfx" aria-hidden="true" style="--t0:-${age}ms"><i class="frost"></i><i class="padlock"></i></span>`;
}

/* A burst of snow and confetti over the winners. `side` is "A" (the left
   half), "B" (the right) or null (across the whole thing). Positions come
   from the bet's id, so the burst doesn't jump about between redraws. */
export function globeFx(bet, side = null) {
  const age = elapsed(state.justGraded[bet.id], GRADE_FX_MS);
  if (age === null) return "";
  let seed = [...String(bet.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const [lo, hi] = side === "A" ? [8, 46] : side === "B" ? [54, 92] : [8, 92];
  const colors = ["#ffffff", "#ffffff", "#ff3b3b", "#2fd36b", "#ffc93c", "#62b8f5"];
  const bits = Array.from({ length: 22 }, (_, i) => {
    const c = colors[i % colors.length], snow = c === "#ffffff";
    const x = lo + rnd() * (hi - lo), dx = (rnd() - .5) * 120, dy = -40 - rnd() * 90;
    return `<i style="--x:${x.toFixed(1)}%;--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--c:${c};` +
      `--s:${snow ? 5 + Math.round(rnd() * 4) : 6}px;--r:${snow ? "50%" : "1px"};--dl:${(rnd() * .25).toFixed(2)}s"></i>`;
  }).join("");
  return `<span class="globefx" aria-hidden="true" style="--t0:-${age}ms">${bits}</span>`;
}

export const isFresh = (bet, kind) =>
  elapsed((kind === "lock" ? state.justLocked : state.justGraded)[bet.id],
          kind === "lock" ? LOCK_FX_MS : GRADE_FX_MS) !== null;

/* After a name: the crown, if they're the reigning Man of the House. */
export const crown = (id, crowned, title = "Man of the House") =>
  crowned.includes(id) ? `<span class="crown" role="img" aria-label="${title}" title="${title}"></span>` : "";
