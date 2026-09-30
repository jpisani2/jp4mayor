/* The sheet for the two admin actions taken from the board or the big
   screen: kicking off, and pulling a bet other people have picked. Asks for
   the PIN first if this device doesn't have it, then shows exactly what's
   about to happen before anything does. */

import { state, stake, nameOf, findBet, isBusy, kickoffPreview, unlockAdmin,
         kickOff, pull, closeSheet } from "../store.js";
import { esc, money, listNames, plural } from "../format.js";
import { pot } from "../scoring.js";

export function view() {
  const sheet = state.sheet;
  if (!sheet) return "";
  const title = sheet.kind === "kickoff" ? "Kick off" : "Pull this bet";

  return `<div class="sheet" id="adminsheet"><div class="sheetbody">
    <div class="sheettop">
      <strong>${title}</strong>
      <button class="btn sm" id="closeadmin">Close</button>
    </div>
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    ${!state.admin ? pinView()
      : sheet.kind === "kickoff" ? kickoffView()
      : pullView(findBet(sheet.betId))}
  </div></div>`;
}

function pinView() {
  return `<p class="hint" style="margin:10px 0 12px">This takes the admin PIN.</p>
    <input class="field" id="sheetpin" inputmode="numeric" autocomplete="off" placeholder="PIN">
    <button class="btn primary wide" id="sheetunlock">Unlock</button>`;
}

function kickoffView() {
  const { lock, dead, outs } = kickoffPreview();
  const busy = isBusy("kickoff");
  return `<div class="kolist">
      <div class="koline"><b>${plural(lock.length, "bet")}</b> will lock.</div>
      ${dead.length ? `<div class="koline"><b>${dead.length}</b> will void — nobody took
        the other side:<ul>${dead.map(b => `<li>${esc(b.body)}</li>`).join("")}</ul></div>` : ""}
      ${outs.length ? `<div class="koline">${esc(listNames(outs.map(o =>
          `${o.name}${lock.length > 1 ? ` (${o.n})` : ""}`)))}
        ${outs.length === 1 ? "hasn't" : "haven't"} answered and will be marked out${
        lock.length > 1 ? " on those bets" : ""}.</div>`
        : `<div class="koline">Everyone has answered every bet.</div>`}
      <div class="hint">After this, sides are shown and in-game betting opens.
        It can't be undone.</div>
    </div>
    <div class="rowbtns">
      <button class="btn primary" id="dokickoff" ${busy ? "disabled" : ""}>
        ${busy ? "Kicking off…" : "Kick off"}</button>
      <button class="btn" id="notyet">Not yet</button>
    </div>`;
}

function pullView(bet) {
  if (!bet || bet.status !== "open") {
    return `<div class="empty">That bet isn't taking picks any more.</div>`;
  }
  const pickers = bet.picks.filter(p => p.player_id !== bet.proposer_id)
    .map(p => nameOf(p.player_id));
  const busy = isBusy(`pull:${bet.id}`);
  return `<div class="sheetq">${esc(bet.body)}</div>
    <div class="koline">${esc(listNames(pickers))} ${pickers.length === 1 ? "has" : "have"}
      picked. Pulling it voids it for everyone${bet.status === "open" && pot(bet, stake()) > 0
      ? ` — nobody wins or loses the ${money(pot(bet, stake()))} pot` : ""}.</div>
    <div class="hint">It stays in the Settled list, marked void.</div>
    <div class="rowbtns">
      <button class="btn danger" id="dopull" ${busy ? "disabled" : ""}>Void it for everyone</button>
      <button class="btn" id="keepbet">Keep it</button>
    </div>`;
}

export function wire(root) {
  if (!state.sheet) return;
  const $ = sel => root.querySelector(sel);

  $("#adminsheet").onclick = e => { if (e.target.id === "adminsheet") closeSheet(); };
  $("#closeadmin").onclick = closeSheet;

  const pin = $("#sheetpin");
  if (pin) {
    const go = () => unlockAdmin(pin.value.trim());
    $("#sheetunlock").onclick = go;
    pin.onkeydown = e => { if (e.key === "Enter") go(); };
    if (document.activeElement?.id !== "sheetpin") pin.focus();
  }

  if ($("#dokickoff")) $("#dokickoff").onclick = () => kickOff();
  if ($("#notyet")) $("#notyet").onclick = closeSheet;
  if ($("#dopull")) $("#dopull").onclick = () => pull(state.sheet.betId);
  if ($("#keepbet")) $("#keepbet").onclick = closeSheet;
}
