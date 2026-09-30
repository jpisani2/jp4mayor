/* Everything that isn't the board: the other screens, the theme picker and
   the sound switch. Kept behind one link so the room header stays a board
   and not a navbar. */

import { state, goto, openMenu, nameOf, switchPlayer, openRules } from "../store.js";
import { esc } from "../format.js";
import { THEMES, current, apply } from "../theme.js";
import { soundOn, setSound } from "../sound.js";
import * as settle from "./settle.js";
import * as stats from "./stats.js";
import * as roster from "./roster.js";
import * as closeout from "./closeout.js";
import * as setup from "./setup.js";
import * as past from "./past.js";

export function view() {
  const theme = current();
  const sound = soundOn();
  return `<div class="sheet" id="menusheet"><div class="sheetbody" data-keep-scroll="menu">
    <div class="sheettop">
      <strong>Menu</strong>
      <button class="btn sm" id="closemenu">Close</button>
    </div>

    <div class="menulist">
      <button class="menuitem" id="m-settle">Settle up
        <span>balances, transfers, payment log</span></button>
      <button class="menuitem" id="m-stats">Stats
        <span>lifetime, season, categories, export</span></button>
      <button class="menuitem" id="m-rules">House rules
        <span>how bets, money and grading work</span></button>
      <button class="menuitem" id="m-past">Past games
        <span>every closed night — fix a wrong result (admin)</span></button>
      <button class="menuitem" id="m-roster">Roster
        <span>merge, rename, move a stray pick</span></button>
      <button class="menuitem" id="m-admin">${state.game ? "Close out the night" : "Set up a game"}
        <span>admin${state.admin ? "" : " — needs the PIN"}</span></button>
      <button class="menuitem" id="m-switch">Switch player
        <span>you're ${esc(nameOf(state.me))} — pick another name, or use this as the big screen</span></button>
    </div>

    <div class="toggle">
      <div><div>Sound</div>
        <div class="s">A chime when a new bet goes up. This device only — an
          iPhone on silent stays quiet either way.</div></div>
      <button class="sw" id="m-sound" data-on="${sound ? 1 : 0}" role="switch"
              aria-checked="${sound}" aria-label="Sound"></button>
    </div>

    <div class="sechead"><span>Theme</span><span class="rule"></span></div>
    <div class="themegrid">
      ${THEMES.map(t => `<button class="themebtn" data-theme-id="${t.id}"
        data-on="${theme === t.id ? 1 : 0}">
        <span class="swatches" data-swatch="${t.id}"><i></i><i></i><i></i></span>
        <span class="themename">${esc(t.name)}</span>
        <span class="themenote">${esc(t.note)}</span>
      </button>`).join("")}
    </div>
    <div class="hint" style="margin-top:10px">
      This device only. Nobody else's screen changes.
    </div>
  </div></div>`;
}

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const close = () => openMenu(false);

  $("#menusheet").onclick = e => { if (e.target.id === "menusheet") close(); };
  $("#closemenu").onclick = close;

  $("#m-settle").onclick = () => { close(); settle.reset(); goto("settle"); };
  $("#m-stats").onclick  = () => { close(); stats.reset();  goto("stats"); };
  $("#m-rules").onclick  = () => openRules();
  $("#m-past").onclick   = () => { close(); past.reset();   goto("past"); };
  $("#m-roster").onclick = () => { close(); roster.reset(); goto("roster"); };
  $("#m-switch").onclick = () => switchPlayer();
  $("#m-admin").onclick  = () => {
    close();
    if (state.game) { closeout.reset(); goto("closeout"); }
    else { setup.reset(); goto("setup"); }
  };

  $("#m-sound").onclick = () => { setSound(!soundOn()); openMenu(true); };

  root.querySelectorAll("[data-theme-id]").forEach(el => {
    el.onclick = () => { apply(el.dataset.themeId); openMenu(true); };
  });
}
