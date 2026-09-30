/* Couldn't reach the database when the app opened. Almost always a weak
   signal or Wi-Fi that hasn't joined yet, so say that, and keep retrying on
   our own every ten seconds. */

import { state, retryBoot } from "../store.js";
import { esc } from "../format.js";

export function view() {
  return `<div class="center">
    <h1 class="cond">Can't connect</h1>
    <p>Can't reach the Bet Room right now. Check your signal or Wi-Fi —
       it'll keep trying on its own.</p>
    <button class="btn primary wide" id="retry">Try again</button>
    ${state.error ? `<div class="hint" style="margin-top:16px">${esc(state.error)}</div>` : ""}
  </div>`;
}

export function wire(root) {
  root.querySelector("#retry").onclick = () => retryBoot();
}
