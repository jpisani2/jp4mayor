/* The house rules. Read-only; the text lives in js/rules.js. Reached from
   the menu and from the "Who are you?" screen, and Back returns to
   whichever of those it came from. */

import { closeRules } from "../store.js";
import { esc } from "../format.js";
import { SECTIONS } from "../rules.js";

export function view() {
  return `<div class="page">
    <header class="head">
      <div>
        <h1 class="cond">House rules</h1>
        <div class="sub">Settled in advance so nobody relitigates them at 11pm.</div>
      </div>
      <button class="btn sm" id="back">Back</button>
    </header>

    ${SECTIONS.map(section => `
      <div class="sechead"><span>${esc(section.title)}</span><span class="rule"></span></div>
      <ol class="rules">
        ${section.rules.map(r => `<li>
          <span class="ruletext">${esc(r.text)}</span>
          ${r.settled ? `<span class="rulewhy">${esc(r.settled)}</span>` : ""}
        </li>`).join("")}
      </ol>`).join("")}

    <div class="rowbtns" style="margin-top:22px">
      <button class="btn" id="back2">Back</button>
    </div>
  </div>`;
}

export function wire(root) {
  root.querySelector("#back").onclick = closeRules;
  root.querySelector("#back2").onclick = closeRules;
}
