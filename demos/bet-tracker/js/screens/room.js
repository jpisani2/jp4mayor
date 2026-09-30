/* The live board: open bets, locked bets, settled bets, scoreboard. */

import { state, stake, nameOf, betsBy, awaiting, isPregame, isBlind, isBusy,
         pick, lock, ungrade, pull, pullNeedsAdmin, openProposeSheet, openSheet,
         goto, openMenu, visibleBets, toggleInPlayAll } from "../store.js";
import { MAX_OPEN_BETS } from "../config.js";
import { esc, money, matchup } from "../format.js";
import { riskFor, takers, pot, canLock, settle, ifThisHits, winIfJoined, oneOnOne,
         rollUp, inPlay } from "../scoring.js";
import * as propose from "./propose.js";
import * as menu from "./menu.js";
import * as grading from "./grading.js";
import * as adminsheet from "./adminsheet.js";

export function view() {
  if (!state.game) return closedView();

  const open = betsBy("open"), locked = betsBy("locked"), graded = betsBy("graded");
  const totals = rollUp(state.bets, state.players, stake());
  const mine = totals[state.me]?.net ?? 0;
  const full = open.length >= MAX_OPEN_BETS;

  return `
  <div class="wrap">
    ${inPlayBar()}
    <header class="head">
      <div>
        <h1 class="cond">${esc(matchup(state.game))}</h1>
        <div class="sub">Base stake ${money(stake())} · you're ${esc(nameOf(state.me))}
          · <button class="linkish" id="menulink">menu</button></div>
      </div>
      <div class="yournet">
        <div class="v cond num ${tone(mine)}">${money(mine)}</div>
        <div class="k">your net</div>
      </div>
    </header>

    ${state.notice ? `<div class="banner">${esc(state.notice)}</div>` : ""}
    ${state.error && !state.sheet ? `<div class="err">${esc(state.error)}</div>` : ""}

    ${section(isPregame() ? `Pregame board (${open.length})` : `Taking picks (${open.length})`)}
    ${open.length ? open.map(openCard).join("")
      : `<div class="empty">${isPregame()
          ? "The pregame board is empty."
          : "Nothing on the table. Call one before the next snap."}</div>`}

    ${locked.length ? section(`Locked, waiting on the result (${locked.length})`)
      + locked.map(lockedCard).join("") : ""}

    ${graded.length ? section(`Settled (${graded.length})`)
      + graded.map(gradedCard).join("") : ""}

    ${section("Scoreboard")}
    ${scoreboard(totals)}
  </div>

  <div class="fab"><div class="inner">
    ${isPregame() ? `
      <button class="btn primary wide" id="kickoff">Kick off — close the pregame board</button>
      <div class="fabnote">Admin only. Shows what will lock before anything happens.</div>`
    : `<button class="btn primary wide" id="callbet" ${full ? "disabled" : ""}>
        ${full ? "Ten bets already open" : "Call a bet"}
      </button>`}
  </div></div>

  ${state.proposing ? propose.view() : ""}
  ${state.menu ? menu.view() : ""}
  ${adminsheet.view()}`;
}

/* The night was closed out while this phone was on the board. */
function closedView() {
  return `<div class="center">
    <h1 class="cond">That's the night</h1>
    <p>The night's been closed out. Balances and the season table are on the
       midweek screen.</p>
    <button class="btn primary wide" id="toidle">See where everyone stands</button>
  </div>`;
}

export function wire(root) {
  if (!state.game) {
    root.querySelector("#toidle").onclick = () => goto("idle");
    return;
  }

  root.querySelectorAll("[data-pick]").forEach(el => {
    el.onclick = () => pick(el.dataset.pick, el.dataset.side);
  });
  root.querySelectorAll("[data-lock]").forEach(el => {
    el.onclick = () => lock(el.dataset.lock);
  });
  root.querySelectorAll("[data-ungrade]").forEach(el => {
    el.onclick = () => ungrade(el.dataset.ungrade);
  });
  root.querySelectorAll("[data-pull]").forEach(el => {
    el.onclick = () => {
      const bet = state.bets.find(b => b.id === el.dataset.pull);
      if (bet && pullNeedsAdmin(bet)) openSheet({ kind: "pull", betId: bet.id });
      else pull(el.dataset.pull);
    };
  });
  grading.wire(root);

  const callbet = root.querySelector("#callbet");
  if (callbet) callbet.onclick = () => {
    propose.reset();
    openProposeSheet(true);
  };

  const kick = root.querySelector("#kickoff");
  if (kick) kick.onclick = () => openSheet({ kind: "kickoff" });

  const allLink = root.querySelector("#inplayall");
  if (allLink) allLink.onclick = () => toggleInPlayAll();

  const menuLink = root.querySelector("#menulink");
  if (menuLink) menuLink.onclick = () => openMenu(true);

  if (state.menu) menu.wire(root);
  if (state.proposing) propose.wire(root);
  adminsheet.wire(root);
}

/* --- pieces -------------------------------------------------------------- */

/* Pinned to the top: how much you have riding on bets not yet graded.
   Before kickoff other people's totals stay hidden — with risk depending on
   the side taken, a total would give away a blind pick. */
function inPlayBar() {
  const bets = visibleBets(), s = stake();
  const me = inPlay(bets, state.me, s);
  const others = !isPregame();
  const rows = state.players
    .map(p => ({ p, t: inPlay(bets, p.id, s) }))
    .filter(r => r.p.id === state.me || r.t.total > 0.001)
    .sort((x, y) => y.t.total - x.t.total);

  return `<div class="inplay">
    <div class="ipline">
      <div><span class="ipk">You have in play</span>
        <span class="ipv cond num">${money(me.total)}</span></div>
      ${others ? `<button class="linkish" id="inplayall">${
        state.inPlayAll ? "hide" : "everyone"}</button>` : ""}
    </div>
    <div class="ipsplit num">${money(me.locked)} locked · ${money(me.open)} on open bets</div>
    ${others && state.inPlayAll ? `<div class="ipall num">${rows.map(r => {
      const you = r.p.id === state.me ? ` class="you"` : "";
      return `<span${you}>${esc(r.p.name)}</span><span${you}>${money(r.t.total)}</span>`;
    }).join("")}</div>
    <div class="ipnote">Locked bets plus current picks, not yet graded.</div>` : ""}
  </div>`;
}

const tone = n => n > 0.001 ? "up" : n < -0.001 ? "down" : "";
const section = title => `<div class="sechead"><span>${esc(title)}</span><span class="rule"></span></div>`;

/* What you'd actually win on this side, counting who's already in. When
   sides are hidden before kickoff, a live figure would give the counts away,
   so it shows the one-on-one figure and says so. */
function winLine(bet, side, blind) {
  const s = stake();
  if (blind) return `win ${money(oneOnOne(side, bet.p, s))} one-on-one`;
  const win = winIfJoined(bet, side, s, state.me);
  return `win ${money(win)} now`;
}

function sideButton(bet, side, blind) {
  const mine = bet.picks.find(p => p.player_id === state.me)?.side;
  const label = side === "A" ? bet.side_a : bet.side_b;

  return `<button class="side" data-s="${side}" data-mine="${mine === side ? 1 : 0}"
            data-pick="${bet.id}" data-side="${side}">
    <div class="nm">${esc(label)}</div>
    <div class="rk num">risk ${money(riskFor(side, bet.p, stake()))}</div>
    <div class="py num">${winLine(bet, side, blind)}</div>
    ${blind ? "" : `<div class="takers">${takers(bet, side)
      .map(id => `<span class="chip">${esc(nameOf(id))}</span>`).join("")}</div>`}
  </button>`;
}

/* Pull: the caller can always see it while the bet's open (free if nobody
   else is on it, PIN if they are); an admin can pull any open bet. */
function pullLink(bet) {
  const mineToPull = bet.proposer_id && bet.proposer_id === state.me;
  if (!mineToPull && !state.admin) return "";
  const busy = isBusy(`pull:${bet.id}`);
  return ` <button class="linkish" data-pull="${bet.id}" ${busy ? "disabled" : ""}>${
    pullNeedsAdmin(bet) ? "pull this bet (voids it)" : "pull this bet"}</button>`;
}

function openCard(bet) {
  const s = stake();
  const blind = isBlind(bet);
  const mine = bet.picks.find(p => p.player_id === state.me)?.side;
  const sittingOut = takers(bet, "OUT");
  const missing = awaiting(bet);
  const lockable = canLock(bet);
  const myWin = !blind && (mine === "A" || mine === "B") ? ifThisHits(bet, mine, s) : null;
  const inCount = takers(bet, "A").length + takers(bet, "B").length;
  const locking = isBusy(`lock:${bet.id}`);

  return `<article class="card">
    <div class="grp">${esc(bet.category)}${badge(bet)}${
      bet.proposer_id ? "" : ` · from the big screen`}</div>
    <div class="q">${esc(bet.body)}</div>
    <div class="sides">${sideButton(bet, "A", blind)}${sideButton(bet, "B", blind)}</div>

    <div class="potrow">
      ${blind
        ? `<span><b>${inCount}</b> in${mine && mine !== "OUT"
            ? ` · you're on ${esc(mine === "A" ? bet.side_a : bet.side_b)}` : ""}</span>`
        : `<span>Pot <b class="num">${money(pot(bet, s))}</b>${
            myWin !== null ? ` · you'd win <b class="num">${money(myWin)}</b>` : ""}</span>`}
      <button class="linkish" data-pick="${bet.id}" data-side="OUT">${
        mine === "OUT" ? "sitting out" : "sit this one out"}</button>
    </div>

    ${(sittingOut.length || missing.length) ? `<div class="who">
      ${sittingOut.length ? `out: ${sittingOut.map(id => esc(nameOf(id))).join(", ")}. ` : ""}
      ${missing.length ? `no answer yet: ${missing.map(p => esc(p.name)).join(", ")}` : ""}
    </div>` : ""}

    ${blind ? `<div class="who">
      Sides stay hidden until kickoff. Change your mind as often as you like.${pullLink(bet)}
    </div>` : `
      <div class="rowbtns">
        <button class="btn wide" data-lock="${bet.id}" ${lockable && !locking ? "" : "disabled"}>
          ${locking ? "Locking…"
            : lockable ? "Lock it — ball's about to be snapped"
            : `Needs someone on ${esc(takers(bet, "A").length ? bet.side_b : bet.side_a)}`}
        </button>
      </div>
      <div class="who">${lockable
        ? "Anyone who hasn't picked when this locks is marked out."
        : "A bet with everyone on one side pays nobody, so it can't lock."}${pullLink(bet)}
      </div>`}
  </article>`;
}

function badge(bet) {
  if (bet.even_money) return ` <span class="edited">· even money</span>`;
  if (bet.odds_edited) return ` <span class="edited">· odds changed to ${Math.round(bet.p * 100)}%</span>`;
  return "";
}

function lockedCard(bet) {
  const names = side => takers(bet, side).map(id => esc(nameOf(id))).join(", ") || "—";
  return `<article class="card">
    <div class="grp">${esc(bet.category)}</div>
    <div class="q">${esc(bet.body)}</div>
    <div class="lineup">
      <span class="nmA">${esc(bet.side_a)}</span> — ${names("A")}<br>
      <span class="nmB">${esc(bet.side_b)}</span> — ${names("B")}
    </div>
    ${canLock(bet) ? "" : `<div class="warn" style="margin-top:8px">Nobody is on ${
      esc(takers(bet, "A").length ? bet.side_b : bet.side_a)}, so this settles as a void
      whichever way it goes.</div>`}
    ${grading.gradeRow(bet)}
  </article>`;
}

function gradedCard(bet) {
  const nets = settle(bet, stake());
  const busy = isBusy(`grade:${bet.id}`);
  return `<article class="card">
    <div class="grp">${esc(bet.category)}</div>
    <div class="q" style="margin-bottom:6px">${esc(bet.body)}</div>
    <div class="result">Result: <b>${esc(grading.resultLabel(bet))}</b></div>
    <div class="splits">${Object.entries(nets).map(([id, net]) =>
      `<div class="split"><span>${esc(nameOf(id))}</span>
        <span class="num ${tone(net)}">${money(net)}</span></div>`).join("")}</div>
    <div class="rowbtns">
      <button class="btn sm" data-ungrade="${bet.id}" ${busy ? "disabled" : ""}>Graded wrong — undo</button>
    </div>
  </article>`;
}

function scoreboard(totals) {
  return `<table class="board num">
    <thead><tr><th>Player</th><th>In</th><th>W–L–P</th><th>Risked</th><th>Net</th></tr></thead>
    <tbody>${state.players.map(p => {
      const r = totals[p.id];
      return `<tr>
        <td class="${p.id === state.me ? "you" : ""}">${esc(p.name)}</td>
        <td>${r.bets}</td>
        <td>${r.wins}–${r.losses}–${r.pushes}</td>
        <td>${money(r.risked)}</td>
        <td class="${tone(r.net)}">${money(r.net)}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}
