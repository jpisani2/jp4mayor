/* Themes are per device, kept in that browser's storage and never in the
   database — so a phone in a dim room and a laptop under lights disagree
   naturally, which is the point.

   Seasonal themes live in js/seasonal/, one pair of files each (a .js and a
   .css). Each module exports the same small shape:
     SEASON   its name, e.g. "homealone"
     THEMES   its entries for the picker
     CSS      its stylesheet, loaded only while one of its themes is on
     dress(on, themeId)   builds or removes its decoration layer
     chime(ctx)           optional: its new-bet sound (also lockChime,
                          gradeChime)
     STRINGS              optional: flavor lines that replace the usual
                          wording while it's on (see flavor() below)
     stage(info)          optional: the big screen's backdrop

   Retiring one after its season is one flag below. A retired theme drops out
   of the menu picker, the join screen and the big-screen dots (all three
   read THEMES), and a device still set to it falls back to Dark. Nothing is
   deleted, so bringing it back is flipping the flag again. */

import * as halloween from "./seasonal/halloween.js";
import * as homealone from "./seasonal/homealone.js";

const SEASONS = [
  { module: halloween, retired: true },    // October; back next year
  { module: homealone, retired: false },   // the holidays
];

const CORE = [
  { id: "dark",            name: "Dark",            note: "the default, built for a dim room" },
  { id: "light",           name: "Light",           note: "for daylight" },
  { id: "lions-dark",      name: "Lions",           note: "Honolulu blue on near-black" },
  { id: "lions-light",     name: "Lions light",     note: "Honolulu blue and silver" },
  { id: "michigan",        name: "Michigan",        note: "maize on navy" },
  { id: "michigan-state",  name: "Michigan State",  note: "Spartan green on white" },
];

const live = SEASONS.filter(s => !s.retired).map(s => s.module);

export const THEMES = [...CORE, ...live.flatMap(m => m.THEMES)];

const KEY = "betroom.theme";

export const current = () => {
  try { return localStorage.getItem(KEY) || "dark"; } catch (e) { return "dark"; }
};

const seasonOf = id => live.find(m => m.THEMES.some(t => t.id === id)) ?? null;

/* The seasonal theme this device is showing, or null. */
export const activeSeason = () => seasonOf(document.documentElement.dataset.theme);
export const seasonIs = name => activeSeason()?.SEASON === name;

/* A seasonal line in place of the usual wording, while that theme is on.
   A line can be a function, for one that changes (a countdown). */
export function flavor(key, usual) {
  const line = activeSeason()?.STRINGS?.[key];
  return typeof line === "function" ? line() : line ?? usual;
}

/* The big screen's backdrop, for a seasonal theme that has one. Called on
   every big-screen redraw with what's on the board; null takes it down. */
export function stage(info) {
  live.forEach(m => m.stage?.(m === activeSeason() ? info : null));
}

/* A season's stylesheet goes in as a <link> while it's on and comes out
   when it's off. index.html may already have added it before the page
   drew, so a phone opening on a seasonal theme doesn't flash Dark first. */
function stylesheet(module, on) {
  const have = document.querySelector(`link[data-season="${module.SEASON}"]`);
  if (!on) { have?.remove(); return null; }
  if (have) return have;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = module.CSS;
  link.dataset.season = module.SEASON;
  document.head.appendChild(link);
  return link;
}

/* The phone's status bar follows the theme's ground color. */
function statusBar() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  if (meta && ground) meta.content = ground;
}

export function apply(id) {
  const chosen = THEMES.some(t => t.id === id) ? id : "dark";
  document.documentElement.dataset.theme = chosen;
  try { localStorage.setItem(KEY, chosen); } catch (e) { /* private mode */ }
  const season = seasonOf(chosen);
  // Retired seasons too, in case index.html loaded one for a device still on it.
  SEASONS.forEach(({ module }) => {
    const on = module === season;
    const link = stylesheet(module, on);
    if (!on) { module.dress(false); module.stage?.(null); }
    else {
      module.dress(true, chosen);
      if (link && !link.sheet) link.addEventListener("load", statusBar, { once: true });
    }
  });
  statusBar();
}

export const restore = () => apply(current());
