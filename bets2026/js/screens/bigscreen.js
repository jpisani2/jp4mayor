/* The big screen: a laptop or iPad on the coffee table showing all the action.

   It is not a player. It never claims a seat or counts toward attendance, so
   it can lock and grade (which anyone may do) but never picks or proposes.
   Pregame sides stay hidden here the same as on the phones — this screen is
   the one everybody can see. */

import { state, stake, nameOf, betsBy, awaiting, isPregame, isBlind,
         lock, grade, ungrade, pull, goto, leaveBigScreen,
         FRESH_MS, AUTO_EVERY, autoPaused, setAutoBet, setAutoEvery,
         throwRandomBet } from "../store.js";
import { esc, money, matchup } from "../format.js";
import { riskA, riskB, takers, pot, canLock, settle, rollUp, inPlay,
         gameTotals } from "../scoring.js";
import { balancesAcrossGames, roundAgainstYourself, suggestTransfers } from "../ledger.js";
import * as closeout from "./closeout.js";

const FEED_LENGTH = 8;
const FLASH_MS = 2600;      // the whole-screen flash when a bet lands
const BANNER_MS = 12000;    // the "new bet" banner across the top
const tone = n => n > 0.005 ? "up" : n < -0.005 ? "down" : "";
const plus = n => (n > 0.005 ? "+" : "") + money(n);

export function view() {
  return `<div class="big">
    ${header()}
    ${alerts()}
    ${state.notice ? `<div class="banner">${esc(state.notice)}</div>` : ""}
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    ${state.game ? liveView() : idleView()}
  </div>`;
}

/* --- layout -------------------------------------------------------------- */

function header() {
  const g = state.game;
  const tag = !g ? "" : isPregame()
    ? `<span class="bphase pre">Pregame</span>` : `<span class="bphase">Live</span>`;
  return `<header class="bhead">
    <div class="btitle">
      <h1 class="cond">${g ? esc(matchup(g)) : "Bet Room"}</h1>
      ${tag}
      ${g ? `<span class="bsub num">base stake ${money(stake())}</span>` : ""}
    </div>
    <div class="bactions">
      ${g ? `<button class="btn" id="bclose">Close out the night</button>` : ""}
      <button class="linkish" id="bexit">exit big screen</button>
    </div>
  </header>`;
}

function liveView() {
  const open = betsBy("open"), locked = betsBy("locked");
  return `
    ${tiles()}
    ${autoBar()}
    <div class="bgrid">
      <main class="bmain">
        ${section(`${isPregame() ? "Pregame board" : "Taking picks"} (${open.length})`)}
        ${open.length ? `<div class="bcards">${open.map(openCard).join("")}</div>`
          : `<div class="empty">Nothing taking picks. Call one from a phone.</div>`}

        ${locked.length ? section(`Waiting on the result (${locked.length})`)
          + `<div class="bcards">${locked.map(lockedCard).join("")}</div>` : ""}
      </main>
      <aside class="bside">
        ${leaderboard()}
        ${feed()}
        ${owes()}
      </aside>
    </div>`;
}

function idleView() {
  return `<div class="bgrid">
    <main class="bmain">
      <div class="bidle">
        <h2 class="cond">No game running</h2>
        <p>Set up the next game from a phone. This screen picks it up on its own.</p>
      </div>
    </main>
    <aside class="bside">${owes()}</aside>
  </div>`;
}

const section = title =>
  `<div class="sechead"><span>${esc(title)}</span><span class="rule"></span></div>`;

/* --- new-bet alert ------------------------------------------------------- */

/* The screen re-renders on every change, which would restart a CSS animation
   each time. A negative delay equal to the time already elapsed picks each
   animation up where it left off instead. */
const since = id => Date.now() - state.fresh[id];
const resume = ms => `style="animation-delay:-${Math.max(0, ms)}ms"`;

function alerts() {
  const ids = Object.keys(state.fresh);
  if (!ids.length) return "";
  const newest = ids.sort((a, b) => state.fresh[b] - state.fresh[a])[0];
  const age = since(newest);
  const bet = state.bets.find(b => b.id === newest);
  return `
    ${age < FLASH_MS ? `<div class="bflash" ${resume(age)}></div>` : ""}
    ${bet && age < BANNER_MS ? `<div class="bnew" ${resume(age)}>
      <span class="bnewk">New bet</span>
      <span class="bnewq">${esc(bet.body)}</span>
      ${bet.proposer_id ? `<span class="bnewby">called by ${esc(nameOf(bet.proposer_id))}</span>`
                        : `<span class="bnewby">thrown out by the big screen</span>`}
    </div>` : ""}`;
}

/* --- random bets --------------------------------------------------------- */

function autoBar() {
  const auto = state.autoBet;
  return `<div class="bauto">
    <span class="bautok">Random bets</span>
    <button class="sw" id="bautoon" data-on="${auto.on ? 1 : 0}" role="switch"
      aria-checked="${auto.on}" aria-label="Throw out a random bet on a timer"></button>
    <span class="bautoevery">every
      ${AUTO_EVERY.map(m => `<button class="vbtn" data-every="${m}"
        data-on="${auto.every === m ? 1 : 0}">${m} min</button>`).join("")}
    </span>
    <span class="bnext num" id="bnext">${nextLabel()}</span>
    <button class="btn sm" id="bthrow" ${autoPaused() ? "disabled" : ""}>Throw one now</button>
  </div>`;
}

function nextLabel() {
  const auto = state.autoBet;
  if (!auto.on) return "off";
  if (autoPaused()) return "paused until kickoff";
  const left = Math.max(0, Math.ceil((auto.nextAt - Date.now()) / 1000));
  return `next in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/* --- summary tiles ------------------------------------------------------- */

function tiles() {
  const t = gameTotals(state.bets, stake());
  const hidden = isPregame();
  const tile = (value, label) => `<div class="btile">
    <div class="btv cond num">${value}</div><div class="btl">${label}</div></div>`;
  return `<div class="btiles">
    ${tile(t.called, "bets called")}
    ${tile(money(t.wagered), "wagered on settled + locked bets")}
    ${tile(t.biggestPot ? money(t.biggestPot) : "—", "biggest pot")}
    ${tile(hidden ? "—" : money(t.inPlay), hidden ? "in play · hidden until kickoff" : "in play right now")}
  </div>`;
}

/* --- bet cards ----------------------------------------------------------- */

function sideBlock(bet, side, blind) {
  const s = stake();
  const risk = side === "A" ? riskA(bet.p, s) : riskB(bet.p, s);
  const other = side === "A" ? riskB(bet.p, s) : riskA(bet.p, s);
  const names = takers(bet, side);
  return `<div class="bside-${side} bsidebox">
    <div class="bsn">${esc(side === "A" ? bet.side_a : bet.side_b)}</div>
    <div class="bsr num">risk ${money(risk)} · pays ${(other / risk).toFixed(2)}×</div>
    ${blind ? "" : `<div class="takers">${names.length
      ? names.map(id => `<span class="chip">${esc(nameOf(id))}</span>`).join("")
      : `<span class="bnone">nobody yet</span>`}</div>`}
  </div>`;
}

function openCard(bet) {
  const blind = isBlind(bet);
  const lockable = canLock(bet);
  const missing = awaiting(bet);
  const inCount = takers(bet, "A").length + takers(bet, "B").length;
  const fresh = state.fresh[bet.id] !== undefined;
  const house = !bet.proposer_id;

  return `<article class="card bcard${fresh ? " fresh" : ""}" ${fresh ? resume(since(bet.id)) : ""}>
    <div class="grp">${fresh ? `<span class="bnewtag">new</span> ` : ""}${esc(bet.category)}${
      house ? " · thrown out by the big screen" : ""}${
      house && !bet.picks.length ? ` · <button class="linkish" data-pull="${bet.id}">pull</button>` : ""}</div>
    <div class="q">${esc(bet.body)}</div>
    <div class="bsides">${sideBlock(bet, "A", blind)}${sideBlock(bet, "B", blind)}</div>
    <div class="potrow">
      ${blind ? `<span><b>${inCount}</b> in · sides hidden until kickoff</span>`
              : `<span>Pot <b class="num">${money(pot(bet, stake()))}</b></span>`}
      ${missing.length ? `<span class="bwait">waiting on ${missing.map(p => esc(p.name)).join(", ")}</span>` : ""}
    </div>
    ${blind ? "" : `<div class="rowbtns">
      <button class="btn wide" data-lock="${bet.id}" ${lockable ? "" : "disabled"}>
        ${lockable ? "Lock it"
          : !takers(bet, "A").length && !takers(bet, "B").length ? "Needs someone on each side"
          : `Needs someone on ${esc(takers(bet, "A").length ? bet.side_b : bet.side_a)}`}
      </button></div>`}
  </article>`;
}

function lockedCard(bet) {
  const names = side => takers(bet, side).map(id => esc(nameOf(id))).join(", ") || "—";
  return `<article class="card bcard">
    <div class="grp">${esc(bet.category)} · pot <span class="num">${money(pot(bet, stake()))}</span></div>
    <div class="q">${esc(bet.body)}</div>
    <div class="lineup">
      <span class="nmA">${esc(bet.side_a)}</span> — ${names("A")}<br>
      <span class="nmB">${esc(bet.side_b)}</span> — ${names("B")}
    </div>
    <div class="grades bgrades">
      <button class="gbtn" data-k="A" data-grade="${bet.id}" data-result="A">${esc(bet.side_a)} hit</button>
      <button class="gbtn" data-k="B" data-grade="${bet.id}" data-result="B">${esc(bet.side_b)} hit</button>
      <button class="gbtn" data-grade="${bet.id}" data-result="PUSH">Push</button>
      <button class="gbtn" data-grade="${bet.id}" data-result="VOID">Void</button>
    </div>
  </article>`;
}

/* --- side panels --------------------------------------------------------- */

function leaderboard() {
  const s = stake();
  const totals = rollUp(state.bets, state.players, s);
  const hideInPlay = isPregame();
  const playing = state.players
    .filter(p => state.bets.some(b => b.picks.some(x => x.player_id === p.id && x.side !== "OUT")))
    .map(p => ({ p, r: totals[p.id], ip: inPlay(state.bets, p.id, s).total }))
    .sort((a, b) => b.r.net - a.r.net);

  return `<section class="bpanel">
    ${section("Tonight")}
    ${playing.length ? `<table class="board num">
      <thead><tr><th>Player</th><th>W–L–P</th>${hideInPlay ? "" : "<th>In play</th>"}<th>Net</th></tr></thead>
      <tbody>${playing.map(({ p, r, ip }) => `<tr>
        <td>${esc(p.name)}</td>
        <td>${r.wins}–${r.losses}–${r.pushes}</td>
        ${hideInPlay ? "" : `<td>${money(ip)}</td>`}
        <td class="${tone(r.net)}">${money(r.net)}</td>
      </tr>`).join("")}</tbody>
    </table>` : `<div class="empty">Nobody has picked anything yet.</div>`}
  </section>`;
}

function feed() {
  const graded = state.bets
    .filter(b => b.status === "graded")
    .sort((a, b) => new Date(b.graded_at ?? 0) - new Date(a.graded_at ?? 0))
    .slice(0, FEED_LENGTH);

  return `<section class="bpanel">
    ${section("Results")}
    ${graded.length ? graded.map(bet => {
      const nets = Object.entries(settle(bet, stake()));
      const label = bet.result === "A" ? bet.side_a : bet.result === "B" ? bet.side_b
                  : bet.result === "PUSH" ? "Push" : "Void";
      const flat = bet.result === "PUSH" || bet.result === "VOID";
      return `<div class="bfeed">
        <div class="bfq">${esc(bet.body)}</div>
        <div class="bfr">${esc(label)}${flat ? " — no money moved" : ""}</div>
        ${flat ? "" : `<div class="bfn num">${nets
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => `<span class="${tone(n)}">${esc(nameOf(id))} ${plus(n)}</span>`)
          .join(" · ")}</div>`}
        <button class="linkish" data-ungrade="${bet.id}">graded wrong — undo</button>
      </div>`;
    }).join("") : `<div class="empty">Nothing settled yet tonight.</div>`}
  </section>`;
}

function owes() {
  if (!state.history.loaded) {
    return `<section class="bpanel">${section("Who owes whom")}
      <div class="empty">Working it out…</div></section>`;
  }
  const { games, bets, payments } = state.history;
  const rows = balancesAcrossGames(games, bets, payments, state.players);
  const transfers = suggestTransfers(roundAgainstYourself(rows));

  return `<section class="bpanel">
    ${section("Who owes whom")}
    ${transfers.length ? transfers.map(t => `<div class="btransfer">
      <span>${esc(t.fromName)} <span class="arrow">→</span> ${esc(t.toName)}</span>
      <span class="num">$${t.amount}</span></div>`).join("")
      : `<div class="empty">Everyone is square.</div>`}
    ${transfers.length ? `<div class="hint">Tonight plus anything carried over, rounded
      against yourself. Suggested — log what actually gets paid.</div>` : ""}
  </section>`;
}

/* --- wiring -------------------------------------------------------------- */

export function wire(root) {
  keepAwake();

  root.querySelectorAll("[data-lock]").forEach(el => {
    el.onclick = () => lock(el.dataset.lock);
  });
  root.querySelectorAll("[data-grade]").forEach(el => {
    el.onclick = () => grade(el.dataset.grade, el.dataset.result);
  });
  root.querySelectorAll("[data-ungrade]").forEach(el => {
    el.onclick = () => ungrade(el.dataset.ungrade);
  });
  root.querySelectorAll("[data-pull]").forEach(el => {
    el.onclick = () => pull(el.dataset.pull);
  });
  root.querySelectorAll("[data-every]").forEach(el => {
    el.onclick = () => setAutoEvery(Number(el.dataset.every));
  });
  const autoOn = root.querySelector("#bautoon");
  if (autoOn) autoOn.onclick = () => setAutoBet(!state.autoBet.on);
  const throwNow = root.querySelector("#bthrow");
  if (throwNow) throwNow.onclick = () => throwRandomBet();
  startCountdown();

  const close = root.querySelector("#bclose");
  if (close) close.onclick = () => { closeout.reset(); goto("closeout"); };
  root.querySelector("#bexit").onclick = () => leaveBigScreen();
}

/* The countdown ticks by rewriting one line of text, not by re-rendering the
   whole screen every second — that would swallow taps mid-press. */
let countdown = null;
function startCountdown() {
  if (countdown) return;
  countdown = setInterval(() => {
    const el = document.getElementById("bnext");
    if (el) el.textContent = nextLabel();
  }, 1000);
}

/* A dashboard that dims itself after two minutes isn't much of a dashboard.
   Where the browser supports it, hold a screen wake lock while this is up. */
let wakeLock = null;
function keepAwake() {
  if (wakeLock || !("wakeLock" in navigator)) return;
  navigator.wakeLock.request("screen")
    .then(lock => {
      wakeLock = lock;
      lock.addEventListener("release", () => { wakeLock = null; });
    })
    .catch(() => { /* not allowed right now — the next redraw tries again */ });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.screen === "big") keepAwake();
});
