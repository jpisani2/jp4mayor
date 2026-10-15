/* Themes are per device, kept in that browser's storage and never in the
   database — so a phone in a dim room and a laptop under lights disagree
   naturally, which is the point. */

import { dress } from "./halloween.js";

export const THEMES = [
  { id: "dark",            name: "Dark",            note: "the default, built for a dim room" },
  { id: "light",           name: "Light",           note: "for daylight" },
  { id: "lions-dark",      name: "Lions",           note: "Honolulu blue on near-black" },
  { id: "lions-light",     name: "Lions light",     note: "Honolulu blue and silver" },
  { id: "michigan",        name: "Michigan",        note: "maize on navy" },
  { id: "michigan-state",  name: "Michigan State",  note: "Spartan green on white" },
  { id: "halloween",       name: "Halloween",       note: "a haunted house, fog, bats and jack-o'-lanterns" },
  { id: "halloween-light", name: "Halloween light", note: "a misty pumpkin patch, falling leaves, something on a thread" },
];

const KEY = "betroom.theme";

export const current = () => {
  try { return localStorage.getItem(KEY) || "dark"; } catch (e) { return "dark"; }
};

export function apply(id) {
  const chosen = THEMES.some(t => t.id === id) ? id : "dark";
  document.documentElement.dataset.theme = chosen;
  try { localStorage.setItem(KEY, chosen); } catch (e) { /* private mode */ }
  dress(chosen.startsWith("halloween"));
  // The phone's status bar follows the theme's ground color.
  const meta = document.querySelector('meta[name="theme-color"]');
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  if (meta && ground) meta.content = ground;
}

export const restore = () => apply(current());
