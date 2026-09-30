/* Admin: end the night.

   Bets still taking picks are voided without asking — nobody committed to
   them. Locked bets each need an answer, because this is the last moment
   anyone remembers what actually happened. Void sits beside the grade
   buttons, and each answer is confirmed before it counts. */

import { state, stake, nameOf, unlockAdmin, goto, isBusy,
         closeOutNight, scrapGame, home } from "../store.js";
import { esc, money, matchup, plural } from "../format.js";
import { takers, rollUp, pot } from "../scoring.js";
import * as grading from "./grading.js";

let confirmingDelete = false;

export function reset() { confirmingDelete = false; }

export function view() {
  if (!state.admin) return pinView();
  if (!state.game) return goneView();

  const unanswered = state.bets.filter(b => b.status === "locked");
  const openStill = state.bets.filter(b => b.status === "open");
  const graded = state.bets.filter(b => b.status === "graded");
  const anyGraded = graded.some(b => b.result !== "VOID");
  const closing = isBusy("closeout");

  return `<div class="page">
    <header class="head">
      <div>
        <h1 class="cond">${esc(matchup(state.game))}</h1>
        <div class="sub">${graded.length} settled · ${unanswered.length} awaiting a result
          · ${openStill.length} still taking picks</div>
      </div>
      <button class="btn sm" id="back">Back</button>
    </header>

    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}

    ${unanswered.length ? `
      <div class="sechead"><span>Needs an answer (${unanswered.length})</span><span class="rule"></span></div>
      ${unanswered.map(card).join("")}
    ` : `<div class="sechead"><span>Nothing left to grade</span><span class="rule"></span></div>`}

    ${openStill.length ? `<div class="hint" style="margin:14px 0">
      ${openStill.length} bet${openStill.length === 1 ? "" : "s"} never locked and will be
      voided when you close out. Nobody committed to ${openStill.length === 1 ? "it" : "them"},
      so there is nothing to settle.
    </div>` : ""}

    <div class="sechead"><span>Where it finished</span><span class="rule"></span></div>
    ${scoreboard()}

    <div class="rowbtns" style="margin-top:22px">
      <button class="btn primary" id="closeout" ${unanswered.length || closing ? "disabled" : ""}>
        ${unanswered.length ? `Answer ${unanswered.length} more first`
          : closing ? "Closing out…" : "Close out the night"}
      </button>
    </div>
    <div class="hint" style="margin-top:10px">
      Closing out frees you to set up next week's game. A wrong grade can still be
      fixed afterwards from Past games in the menu.
    </div>

    <div class="sechead"><span>Delete this game</span><span class="rule"></span></div>
    ${anyGraded ? `<div class="hint">
      Bets have already been graded and balances have moved, so this game can't
      be deleted — close it out instead. Deleting is for a game set up wrong
      before anyone played it.
    </div>` : confirmingDelete ? deleteConfirm() : `
      <div class="hint">Nothing has been graded, so this game can still be removed.</div>
      <div class="rowbtns"><button class="btn" id="delete">Delete this game</button></div>`}
  </div>`;
}

/* Says exactly what goes, and above all any money already locked in. */
function deleteConfirm() {
  const locked = state.bets.filter(b => b.status === "locked");
  const riding = locked.reduce((sum, b) => sum + pot(b, stake()), 0);
  const people = new Set(state.bets.flatMap(b =>
    b.picks.filter(p => !p.auto).map(p => p.player_id))).size;
  const busy = isBusy("delete");

  return `
    ${locked.length ? `<div class="warn">${plural(locked.length, "bet is", "bets are")} locked
      with <span class="num">${money(riding)}</span> riding. Deleting erases
      ${locked.length === 1 ? "it" : "them"} and everyone's picks.</div>` : ""}
    <div class="hint">Deletes ${esc(matchup(state.game))}, its ${plural(state.bets.length, "bet")},
      and picks from ${plural(people, "person", "people")}. Not reversible.</div>
    <div class="rowbtns">
      <button class="btn danger" id="reallydelete" ${busy ? "disabled" : ""}>
        Delete ${esc(matchup(state.game))}</button>
      <button class="btn" id="keep">Keep it</button>
    </div>`;
}

function card(bet) {
  const names = side => takers(bet, side).map(id => esc(nameOf(id))).join(", ") || "—";
  return `<article class="card">
    <div class="grp">${esc(bet.category)}</div>
    <div class="q">${esc(bet.body)}</div>
    <div class="lineup">
      <span class="nmA">${esc(bet.side_a)}</span> — ${names("A")}<br>
      <span class="nmB">${esc(bet.side_b)}</span> — ${names("B")}
    </div>
    ${grading.gradeRow(bet, { voidLabel: "Never happened" })}
  </article>`;
}

function scoreboard() {
  const totals = rollUp(state.bets, state.players, stake());
  const ranked = [...state.players].sort((a, b) => totals[b.id].net - totals[a.id].net);
  return `<table class="board num">
    <thead><tr><th>Player</th><th>In</th><th>W–L–P</th><th>Net</th></tr></thead>
    <tbody>${ranked.map(p => {
      const r = totals[p.id];
      return `<tr>
        <td>${esc(p.name)}</td>
        <td>${r.bets}</td>
        <td>${r.wins}–${r.losses}–${r.pushes}</td>
        <td class="${r.net > 0.001 ? "up" : r.net < -0.001 ? "down" : ""}">${money(r.net)}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}

function pinView() {
  return `<div class="center">
    <h1 class="cond">Admin</h1>
    <p>Enter the shared PIN.</p>
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    <input class="field" id="pin" inputmode="numeric" autocomplete="off" placeholder="PIN">
    <button class="btn primary wide" id="unlock">Unlock</button>
    <button class="linkish" id="back" style="margin-top:14px">Back</button>
  </div>`;
}

function goneView() {
  return `<div class="center">
    <h1 class="cond">All closed out</h1>
    <p>Nothing is running.</p>
    <button class="btn primary wide" id="back">Back</button>
  </div>`;
}

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const redraw = () => goto("closeout");

  if ($("#back")) $("#back").onclick = () => goto(home());

  if (!state.admin) {
    const pin = $("#pin");
    const go = () => unlockAdmin(pin.value.trim());
    $("#unlock").onclick = go;
    pin.onkeydown = e => { if (e.key === "Enter") go(); };
    if (document.activeElement?.id !== "pin") pin.focus();
    return;
  }

  grading.wire(root);

  if ($("#closeout")) $("#closeout").onclick = () => closeOutNight();
  if ($("#delete")) $("#delete").onclick = () => { confirmingDelete = true; redraw(); };
  if ($("#keep")) $("#keep").onclick = () => { confirmingDelete = false; redraw(); };
  if ($("#reallydelete")) $("#reallydelete").onclick = () => { confirmingDelete = false; scrapGame(); };
}
