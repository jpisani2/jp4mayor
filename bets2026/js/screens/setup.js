/* Admin: set up this week's game and open the pregame board.
   Gated behind the shared PIN — anyone who knows it gets admin on their own
   device, which is what survives the admin's phone dying at halftime. */

import { state, unlockAdmin, goto, home, isBusy, holdRender,
         createGameWithBoard } from "../store.js";
import { esc, money, matchup, localDate } from "../format.js";
import { riskA, riskB } from "../scoring.js";
import { buildBoard, toBetRows } from "../pregame.js";
import * as closeout from "./closeout.js";

let form;

export function reset() {
  form = {
    kickoff_date: nextSunday(),
    home_team: "",
    away_team: "",
    favorite: "home",
    spread: 3,
    total: 44.5,
    base_stake: 1,
    overrides: {},
  };
}
reset();

/* Next Sunday — or today, on a Sunday — in this device's own time zone. */
function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return localDate(d);
}

const teamsIn = () => form.home_team.trim() && form.away_team.trim();

/* Why the board can't be opened yet, or "" if it can. */
function problem() {
  const num = v => (String(v).trim() === "" ? NaN : Number(v));
  if (!teamsIn()) return "Fill in both teams to build the board.";
  if (form.home_team.trim().toLowerCase() === form.away_team.trim().toLowerCase()) {
    return "Home and away can't be the same team.";
  }
  if (!(num(form.base_stake) > 0)) return "Base stake has to be more than $0.";
  if (!(num(form.spread) >= 0)) return "Enter the spread — 0 or more.";
  if (!(num(form.total) > 0)) return "Enter the total — it has to be more than 0.";
  if (!form.kickoff_date) return "Pick the kickoff date.";
  return "";
}

export function view() {
  if (!state.admin) return pinView();
  if (state.game) return stillOpenView();

  const issue = problem();
  const board = issue ? [] : buildBoard(form, form.overrides);
  const favName = form.favorite === "home" ? form.home_team : form.away_team;

  return `<div class="page">
    <header class="head">
      <div>
        <h1 class="cond">This week's game</h1>
        <div class="sub">Enter the matchup and the line. Every number below fills
          itself in from the spread and the total — nudge any you disagree with.</div>
      </div>
      <button class="btn sm" id="back">Back</button>
    </header>

    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}

    <div class="setupgrid">
      <div><label class="flabel">Kickoff date</label>
        <input class="field" type="date" id="f-kickoff_date" value="${esc(form.kickoff_date)}"></div>
      <div><label class="flabel">Away team</label>
        <input class="field" id="f-away_team" value="${esc(form.away_team)}" placeholder="Bears" autocomplete="off"></div>
      <div><label class="flabel">Home team</label>
        <input class="field" id="f-home_team" value="${esc(form.home_team)}" placeholder="Packers" autocomplete="off"></div>
      <div><label class="flabel">Base stake</label>
        <input class="field num" type="number" step="0.5" min="0.5" id="f-base_stake"
               value="${esc(form.base_stake)}"></div>
      <div><label class="flabel">Spread</label>
        <input class="field num" type="number" step="0.5" min="0" id="f-spread"
               value="${esc(form.spread)}"></div>
      <div><label class="flabel">Total</label>
        <input class="field num" type="number" step="0.5" min="0" id="f-total"
               value="${esc(form.total)}"></div>
    </div>

    <div class="favrow">
      <span class="flabel">Favored</span>
      <button class="vbtn" data-fav="away" data-on="${form.favorite === "away" ? 1 : 0}">
        ${esc(form.away_team || "away")}</button>
      <button class="vbtn" data-fav="home" data-on="${form.favorite === "home" ? 1 : 0}">
        ${esc(form.home_team || "home")}</button>
      <span class="hint">${!issue
        ? `${esc(favName)} by ${esc(form.spread)}. Home field is already priced into
           the spread, so this only decides who the bets are written about.`
        : ""}</span>
    </div>

    ${issue ? `<div class="warn" style="margin-top:14px">${esc(issue)}</div>` : boardView(board)}
  </div>`;
}

/* A game is already running. Setting up another would push it out of view,
   and the database won't allow two anyway. */
function stillOpenView() {
  return `<div class="center">
    <h1 class="cond">One at a time</h1>
    <p>Tonight's game — ${esc(matchup(state.game))} — is still open. Close it
       out before setting up another.</p>
    <button class="btn primary wide" id="tocloseout">Go to close-out</button>
    <button class="linkish" id="back" style="margin-top:14px">Back</button>
  </div>`;
}

const stakeNow = () => Number(form.base_stake) || 1;

function rowNumbers(row) {
  const s = stakeNow(), p = row.pct / 100;
  return `${money(riskA(p, s))} / ${money(riskB(p, s))}`;
}

function boardView(board) {
  const busy = isBusy("setup");
  return `
    <div class="sechead"><span>Pregame board</span><span class="rule"></span></div>
    ${board.map(row => `<div class="setrow">
      <div>
        <div class="setlabel">${esc(row.body)}</div>
        <div class="setnote">${esc(row.side_a)} vs ${esc(row.side_b)} ·
          ${row.changed ? `<span class="edited">you set this</span>` : esc(row.note)}</div>
      </div>
      <div class="setctl">
        <input type="range" min="3" max="97" value="${row.pct}" data-odds="${row.key}"
               style="accent-color:${row.changed ? "var(--edit)" : "var(--a)"}">
        <span class="setpct cond num ${row.changed ? "edited" : ""}" id="pct-${row.key}">${row.pct}%</span>
        <span class="setrisk num" id="risk-${row.key}">${rowNumbers(row)}</span>
      </div>
    </div>`).join("")}

    <div class="rowbtns" style="margin-top:20px">
      <button class="btn primary" id="post" ${busy ? "disabled" : ""}>${
        busy ? "Opening…" : "Open the pregame board"}</button>
      <button class="btn" id="resetodds" ${Object.keys(form.overrides).length ? "" : "disabled"}>
        Reset to the derived numbers</button>
    </div>
    <div class="hint" style="margin-top:12px">
      Posting creates the game and opens picks straight away. Sides stay hidden
      until you kick off.
    </div>`;
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

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const redraw = () => goto("setup");

  if ($("#back")) $("#back").onclick = () => goto(home());

  if (!state.admin) {
    const pin = $("#pin");
    const go = () => unlockAdmin(pin.value.trim());
    $("#unlock").onclick = go;
    pin.onkeydown = e => { if (e.key === "Enter") go(); };
    if (document.activeElement?.id !== "pin") pin.focus();
    return;
  }

  if (state.game) {
    $("#tocloseout").onclick = () => { closeout.reset(); goto("closeout"); };
    return;
  }

  /* Text fields keep their value in the draft without redrawing, so typing
     isn't interrupted. Leaving a field redraws, since the board depends on
     it — but only once the tap that moved you has landed, or the box you
     tapped into would be swapped out from under your finger. */
  const soon = () => setTimeout(redraw, 0);
  ["home_team", "away_team"].forEach(key => {
    const el = $(`#f-${key}`);
    let typed = false;   // a redraw removing the field also "leaves" it
    el.oninput = () => { form[key] = el.value; typed = true; };
    el.onblur = () => { if (typed) { typed = false; soon(); } };
  });
  ["kickoff_date", "base_stake", "spread", "total"].forEach(key => {
    const el = $(`#f-${key}`);
    el.onchange = () => { form[key] = el.value; soon(); };
  });

  root.querySelectorAll("[data-fav]").forEach(el => {
    el.onclick = () => { form.favorite = el.dataset.fav; redraw(); };
  });

  /* While a slider is dragged, only its own numbers change; the board
     redraws once on release, so the drag isn't cancelled mid-move. */
  root.querySelectorAll("[data-odds]").forEach(el => {
    const key = el.dataset.odds;
    const move = () => {
      form.overrides[key] = +el.value;
      const row = buildBoard(form, form.overrides).find(r => r.key === key);
      const pct = $(`#pct-${key}`);
      pct.textContent = `${row.pct}%`;
      pct.classList.toggle("edited", row.changed);
      $(`#risk-${key}`).textContent = rowNumbers(row);
      el.style.accentColor = row.changed ? "var(--edit)" : "var(--a)";
    };
    el.addEventListener("pointerdown", () => holdRender(true));
    el.addEventListener("touchstart", () => holdRender(true), { passive: true });
    el.oninput = () => { holdRender(true); move(); };
    el.onchange = () => { move(); holdRender(false); redraw(); };
  });

  if ($("#resetodds")) $("#resetodds").onclick = () => { form.overrides = {}; redraw(); };

  if ($("#post")) $("#post").onclick = () => {
    if (problem()) return redraw();
    const board = buildBoard(form, form.overrides);
    createGameWithBoard({
      kickoff_date: form.kickoff_date,
      home_team: form.home_team.trim(),
      away_team: form.away_team.trim(),
      favorite: form.favorite,
      spread: Number(form.spread),
      total: Number(form.total),
      base_stake: Number(form.base_stake),
    }, toBetRows(board, null).map(({ game_id, ...row }) => row));
  };
}
