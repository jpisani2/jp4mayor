/* Past games: every closed night, and the one place a wrong grade can be
   fixed after close-out. Anyone can look; changing a result takes the admin
   PIN, because it moves money that may already have changed hands and
   nobody is in the room to notice. Logged payments are never touched, so
   the balances simply recalculate. */

import { state, goto, home, isBusy, unlockAdmin, regrade } from "../store.js";
import { esc, money, matchup, plural } from "../format.js";
import { settle, canLock } from "../scoring.js";
import * as grading from "./grading.js";

let gameId = null;
let changing = null;   // { betId, result } — result null until one is chosen

export function reset() { gameId = null; changing = null; }

const nameOf = id => state.players.find(p => p.id === id)?.name ?? "—";
const tone = n => n > 0.005 ? "up" : n < -0.005 ? "down" : "";
const signed = n => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + money(Math.abs(n));

export function view() {
  if (!state.history.loaded) return `<div class="center"><p>Finding past games…</p></div>`;
  const game = gameId && state.history.games.find(g => g.id === gameId);
  return game ? gameView(game) : listView();
}

function header(title, sub) {
  return `<header class="head">
    <div>
      <h1 class="cond">${title}</h1>
      <div class="sub">${sub}${state.history.refreshing
        ? ` · <span class="updating">updating…</span>` : ""}</div>
    </div>
    <button class="btn sm" id="back">Back</button>
  </header>`;
}

function listView() {
  const games = state.history.games.filter(g => g.phase === "closed");
  return `<div class="page">
    ${header("Past games", "Every closed night, newest first.")}
    ${state.notice ? `<div class="banner">${esc(state.notice)}</div>` : ""}
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    ${games.length ? games.map(g => {
      const graded = state.history.bets.filter(b => b.game_id === g.id && b.status === "graded");
      return `<button class="menuitem pastgame" data-game="${g.id}">
        ${esc(matchup(g))}
        <span>${esc(g.kickoff_date)} · ${plural(graded.length, "bet")} · stake ${money(Number(g.base_stake))}</span>
      </button>`;
    }).join("") : `<div class="empty">No games have been closed out yet.</div>`}
  </div>`;
}

function gameView(game) {
  const s = Number(game.base_stake);
  const bets = state.history.bets
    .filter(b => b.game_id === game.id && b.status === "graded")
    .sort((a, b) => new Date(a.graded_at ?? a.created_at) - new Date(b.graded_at ?? b.created_at));

  return `<div class="page">
    ${header(esc(matchup(game)), `${esc(game.kickoff_date)} · base stake ${money(s)}`)}
    ${state.notice ? `<div class="banner">${esc(state.notice)}</div>` : ""}
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    ${state.admin ? "" : `<div class="card">
      <div class="q" style="margin-bottom:6px">Fixing a result takes the admin PIN.</div>
      <input class="field" id="pastpin" inputmode="numeric" autocomplete="off" placeholder="PIN">
      <button class="btn" id="pastunlock">Unlock</button>
    </div>`}
    ${bets.length ? bets.map(b => betCard(b, s)).join("")
      : `<div class="empty">No graded bets in this game.</div>`}
  </div>`;
}

const OPTIONS = bet => [["A", `${bet.side_a} hit`], ["B", `${bet.side_b} hit`],
                        ["PUSH", "Push"], ["VOID", "Void"]];

function betCard(bet, s) {
  const nets = settle(bet, s);
  const mine = changing?.betId === bet.id;

  return `<article class="card">
    <div class="grp">${esc(bet.category)}</div>
    <div class="q" style="margin-bottom:6px">${esc(bet.body)}</div>
    <div class="result">Result: <b>${esc(grading.resultLabel(bet))}</b></div>
    <div class="splits">${Object.entries(nets).map(([id, net]) =>
      `<div class="split"><span>${esc(nameOf(id))}</span>
        <span class="num ${tone(net)}">${money(net)}</span></div>`).join("")}</div>
    ${!state.admin ? "" : !mine ? `<div class="rowbtns">
      <button class="btn sm" data-change="${bet.id}">Change result</button></div>`
      : changing.result ? preview(bet, s, changing.result) : chooser(bet)}
  </article>`;
}

function chooser(bet) {
  return `<div class="gconfirm">
    <div class="gcq">Change it to:</div>
    <div class="grades">
      ${OPTIONS(bet).filter(([r]) => r !== bet.result).map(([r, label]) =>
        `<button class="gbtn" ${r === "A" || r === "B" ? `data-k="${r}"` : ""}
          data-to="${r}">${esc(label)}</button>`).join("")}
    </div>
    <div class="rowbtns"><button class="btn sm" data-cancelchange="1">Cancel</button></div>
  </div>`;
}

/* Everyone's before and after, so the fix is seen before it counts. */
function preview(bet, s, result) {
  const before = settle(bet, s);
  const after = settle(bet, s, result);
  const label = OPTIONS(bet).find(([r]) => r === result)[1];
  const busy = isBusy(`regrade:${bet.id}`);
  return `<div class="gconfirm">
    <div class="gcq">Change to <b>${esc(label)}</b>?${
      canLock(bet) ? "" : " Nobody was on one side, so it still settles as a void."}</div>
    <div class="gce num">${Object.keys(before).map(id =>
      `<div>${esc(nameOf(id))} <span class="${tone(before[id])}">${signed(before[id])}</span>
        → <span class="${tone(after[id])}">${signed(after[id])}</span></div>`).join("")}</div>
    <div class="hint">Payments already logged stay as they are — balances just move.</div>
    <div class="rowbtns">
      <button class="btn primary" data-doregrade="${bet.id}" data-result="${result}"
        ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Confirm"}</button>
      <button class="btn" data-cancelchange="1">Cancel</button>
    </div>
  </div>`;
}

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const redraw = () => goto("past");

  if (!state.history.loaded) return;

  $("#back").onclick = () => {
    if (gameId) { gameId = null; changing = null; redraw(); }
    else goto(home());
  };

  root.querySelectorAll("[data-game]").forEach(el => {
    el.onclick = () => { gameId = el.dataset.game; changing = null; redraw(); };
  });

  const pin = $("#pastpin");
  if (pin) {
    const go = () => unlockAdmin(pin.value.trim());
    $("#pastunlock").onclick = go;
    pin.onkeydown = e => { if (e.key === "Enter") go(); };
  }

  root.querySelectorAll("[data-change]").forEach(el => {
    el.onclick = () => { changing = { betId: el.dataset.change, result: null }; redraw(); };
  });
  root.querySelectorAll("[data-to]").forEach(el => {
    el.onclick = () => { changing.result = el.dataset.to; redraw(); };
  });
  root.querySelectorAll("[data-cancelchange]").forEach(el => {
    el.onclick = () => { changing = null; redraw(); };
  });
  root.querySelectorAll("[data-doregrade]").forEach(el => {
    el.onclick = async () => {
      await regrade(el.dataset.doregrade, el.dataset.result);
      if (!state.error) { changing = null; redraw(); }
    };
  });
}
