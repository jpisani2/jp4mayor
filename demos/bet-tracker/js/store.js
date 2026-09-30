/* ===========================================================================
   The single source of truth for what the app is currently showing, plus the
   only place a re-render is triggered. Screens read state and call actions;
   they never mutate state directly and never call render themselves.
   =========================================================================== */

import * as db from "./db.js";
import { DORMANT_AFTER, MAX_OPEN_BETS } from "./config.js";
import { isDormant, canLock, takers } from "./scoring.js";
import { withTeams } from "./format.js";
import { beep } from "./sound.js";

/* Big screen random bets: interval choices in minutes, and where this device
   remembers its setting. Declared before state, which reads them. */
export const AUTO_EVERY = [2, 3, 5, 10];   // minutes
const AUTO_KEY = "betroom-demo.autobet";

/* Screens that show history (balances, stats, past games). Opening one always
   fetches fresh history, and it stays live while it's showing. */
const HISTORY_SCREENS = new Set(["settle", "stats", "idle", "roster", "past"]);

export const state = {
  screen: "loading",   // loading | unconfigured | offline | join | seat | idle
                       // | room | setup | closeout | settle | stats | roster
                       // | past | rules | big
  game: null,
  players: [],
  bets: [],
  attendance: null,    // player ids in tonight's game; null = couldn't tell
  catalog: [],
  me: null,
  live: false,
  error: "",
  notice: "",
  proposing: false,
  menu: false,
  sheet: null,         // { kind: "kickoff" } | { kind: "pull", betId }
  confirmGrade: null,  // { betId, result } waiting for Confirm
  busy: {},            // action key -> true while its save is in flight
  inPlayAll: false,    // everyone's in-play totals expanded in the room
  bigScreen: false,    // this device is the shared dashboard, not a player
  fresh: {},           // big screen: bet id -> when it first appeared
  autoBet: loadAutoBet(), // big screen: random bets { on, every, since }
  admin: false,
  rulesFrom: null,     // where the rules screen's Back button goes
  history: { games: [], bets: [], payments: [], loaded: false, refreshing: false },
  roster: { flags: [], changes: [], loaded: false },
};

/* --- rendering ------------------------------------------------------------ */

/* While a slider is being dragged, redraws wait: replacing the page under a
   finger cancels the drag on phones. Whatever was missed draws on release.
   The hold lapses by itself if a release is never seen. */
let onRender = () => {};
let held = false, missed = false, holdTimer = null;

export const onChange = fn => { onRender = fn; };
export function render() {
  if (held) { missed = true; return; }
  onRender();
}

export function holdRender(on) {
  clearTimeout(holdTimer);
  held = on;
  if (on) holdTimer = setTimeout(() => holdRender(false), 2000);
  else if (missed) { missed = false; onRender(); }
}

export function setError(message) {
  state.error = message ? String(message) : "";
  render();
}

export function notify(message, ms = 4000) {
  state.notice = message;
  render();
  setTimeout(() => {
    if (state.notice === message) { state.notice = ""; render(); }
  }, ms);
}

/* Runs a write with its button disabled until it finishes, so a double tap
   only ever does it once. */
export const isBusy = key => Boolean(state.busy[key]);

async function run(key, fn) {
  if (state.busy[key]) return;
  state.busy[key] = true;
  render();
  try { await fn(); }
  catch (e) { state.error = e.message || String(e); }
  finally { delete state.busy[key]; render(); }
}

/* --- derived ------------------------------------------------------------- */

export const stake = () => Number(state.game?.base_stake ?? 1);
export const nameOf = id => state.players.find(p => p.id === id)?.name ?? "—";
export const betsBy = status => visibleBets().filter(b => b.status === status);
export const findBet = id => state.bets.find(b => b.id === id);

export const phase = () => state.game?.phase ?? "live";
export const isPregame = () => phase() === "pregame";

/* Before kickoff the room shows the pregame board and nothing else. */
export function visibleBets() {
  return isPregame() ? state.bets.filter(b => b.is_pregame) : state.bets;
}

/* Sides on a pregame bet stay hidden until kickoff. */
export const isBlind = bet => isPregame() && bet.is_pregame;

/* Who is in tonight's game: anyone who opened the app for it, plus anyone
   who has made a pick themselves (in case their check-in didn't save). If
   attendance couldn't be read, returns null and everyone counts. */
function tonight() {
  if (!state.attendance) return null;
  const ids = new Set(state.attendance);
  state.bets.forEach(b => b.picks.forEach(p => { if (!p.auto) ids.add(p.player_id); }));
  return ids;
}

/* Players who still appear in other people's "waiting on" lines, and who get
   marked out when a bet locks: in tonight, and not gone quiet. */
export const presentPlayers = () => {
  const here = tonight();
  return state.players.filter(p =>
    (!here || here.has(p.id)) && !isDormant(p.id, state.bets, DORMANT_AFTER));
};

/* Check this device's player in to the current game. Covers a phone that was
   opened before the game was set up and has been sitting on the midweek
   screen since. The big screen is not a player and never checks in. */
function checkIn() {
  if (state.bigScreen || !state.me || !state.game || !state.attendance) return;
  if (state.attendance.includes(state.me)) return;
  state.attendance.push(state.me);
  db.markPresent(state.game.id, state.me).catch(() => { /* next reload retries */ });
}

export const awaiting = bet =>
  presentPlayers().filter(p => !bet.picks.some(x => x.player_id === p.id));

/* Where Back goes: the big screen if this device is one, otherwise the board
   or the midweek screen. */
export const home = () => state.bigScreen ? "big" : state.game ? "room" : "idle";

/* Pulling your own bet is free while nobody else is on it. Once anyone else
   has picked, it takes the admin PIN and voids it for everyone. */
export const pullNeedsAdmin = bet =>
  bet.picks.some(p => p.player_id !== bet.proposer_id);

/* What kickoff is about to do, for the confirmation. */
export function kickoffPreview() {
  const open = state.bets.filter(b => b.is_pregame && b.status === "open");
  const lock = open.filter(canLock), dead = open.filter(b => !canLock(b));
  const missing = new Map();
  lock.forEach(b => awaiting(b).forEach(p =>
    missing.set(p.id, (missing.get(p.id) ?? 0) + 1)));
  const outs = [...missing].map(([id, n]) => ({ id, name: nameOf(id), n }));
  return { lock, dead, outs };
}

/* --- loading ------------------------------------------------------------- */

async function refreshHistory() {
  const [games, bets, payments] = await Promise.all([
    db.fetchGames(), db.fetchAllBets(), db.fetchPayments(),
  ]);
  state.history = { games, bets, payments, loaded: true, refreshing: false };
}

const historyWanted = () => state.bigScreen || HISTORY_SCREENS.has(state.screen);

/* Fresh history for a screen that shows it. The last numbers stay up with an
   "updating…" note while it loads, rather than a blank page. */
let historyBusy = false, historyAgain = false;

export async function loadHistory() {
  if (historyBusy) { historyAgain = true; return; }
  historyBusy = true;
  state.history.refreshing = true;
  render();
  try { await refreshHistory(); }
  catch (e) { state.history.refreshing = false; state.error = e.message || String(e); }
  finally {
    historyBusy = false;
    render();
    if (historyAgain) { historyAgain = false; loadHistory(); }
  }
}

/* One refresh at a time. A change that arrives mid-refresh isn't dropped:
   it queues exactly one more, so a burst of picks at the snap costs at most
   one extra round trip and the screen always ends on the latest. */
let loading = false, queued = null;

export async function reload({ announce = false } = {}) {
  if (loading) {
    queued = { announce: announce || Boolean(queued?.announce) };
    return;
  }
  loading = true;
  try {
    const openBefore = betsBy("open").length;
    const known = new Set(state.bets.map(b => b.id));
    const [game, players] = await Promise.all([db.fetchOpenGame(), db.fetchPlayers()]);
    state.game = game;
    state.players = players;
    [state.bets, state.attendance] = await Promise.all([
      db.fetchBets(game?.id), db.fetchAttendance(game?.id)]);
    checkIn();
    if (historyWanted()) await refreshHistory();
    if (state.bigScreen) markFresh(betsBy("open").filter(b => !known.has(b.id)));
    else if (announce && betsBy("open").length > openBefore) beep();
    state.error = "";
    render();
  } catch (e) {
    setError(e.message || e);
  } finally {
    loading = false;
    if (queued) { const next = queued; queued = null; reload(next); }
  }
}

/* --- big screen: new-bet alert ------------------------------------------ */

/* How long a new bet stays lit up on the big screen. */
export const FRESH_MS = 45000;

function markFresh(bets) {
  if (!bets.length) return;
  const now = Date.now();
  bets.forEach(b => {
    state.fresh[b.id] = now;
    setTimeout(() => { delete state.fresh[b.id]; render(); }, FRESH_MS);
  });
  beep();
  setTimeout(beep, 320);   // a double chime, so it carries across the room
}

/* --- big screen: random bets --------------------------------------------- */

function loadAutoBet() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_KEY) || "{}");
    const every = AUTO_EVERY.includes(saved.every) ? saved.every : 3;
    return { on: Boolean(saved.on), every, since: Date.now() };
  } catch (e) { return { on: false, every: 3, since: Date.now() }; }
}

function saveAutoBet() {
  try {
    localStorage.setItem(AUTO_KEY,
      JSON.stringify({ on: state.autoBet.on, every: state.autoBet.every }));
  } catch (e) { /* private mode */ }
}

/* Random bets only run while a game is live: the pregame board is its own
   fixed set, and there is nothing to bet on between games. */
export const autoPaused = () => !state.game || isPregame();

/* The timer runs off the bets themselves, not this device: the next random
   bet is due one interval after the last one any big screen threw. Every big
   screen shows the same countdown, and two screens can't double up. */
const houseBets = () => state.bets.filter(b => !b.proposer_id && !b.is_pregame);

export function nextThrowAt() {
  const auto = state.autoBet;
  if (!auto.on) return 0;
  const last = Math.max(0, ...houseBets().map(b => Date.parse(b.created_at) || 0));
  return Math.max(last, auto.since) + auto.every * 60000;
}

export function setAutoBet(on) {
  state.autoBet.on = on;
  state.autoBet.since = Date.now();
  saveAutoBet();
  render();
}

export function setAutoEvery(minutes) {
  state.autoBet.every = minutes;
  saveAutoBet();
  render();
}

let throwing = false;
let ticker = null;

function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    const auto = state.autoBet;
    if (!state.bigScreen || !auto.on || throwing) return;
    if (autoPaused()) { auto.since = Date.now(); return; }
    if (Date.now() >= nextThrowAt()) throwRandomBet({ scheduled: true });
  }, 1000);
}

const HOUSE_SQL = "alter table bets alter column proposer_id drop not null;";

/* Throw a random catalog bet onto the board. The big screen never takes a
   side. If nobody touched the last one it threw, that one is swapped out
   rather than left clogging the board — but only after checking the
   database that nobody has picked it since this screen last looked. */
export async function throwRandomBet({ scheduled = false } = {}) {
  if (throwing || autoPaused()) return;
  throwing = true;
  try {
    const game = state.game;
    const every = state.autoBet.every * 60000;

    if (scheduled) {
      const since = new Date(Date.now() - every + 5000).toISOString();
      if ((await db.fetchHouseBetsSince(game.id, since)).length) {
        await reload();    // another big screen got there first
        return;
      }
    }

    const untouched = state.bets.filter(b =>
      b.status === "open" && !b.proposer_id && !b.picks.length);
    let removed = 0;
    for (const bet of untouched) {
      if (await db.deleteBetIfUnpicked(bet.id, null)) removed += 1;
    }

    const stillOpen = state.bets.filter(b => b.status === "open").length - removed;
    if (stillOpen >= MAX_OPEN_BETS) {
      notify(`Board is full — no random bet this time`);
      return;
    }

    const used = new Set(state.bets.map(b => b.body));
    const fresh = state.catalog.filter(c => !used.has(withTeams(c.body, game)));
    const pool = fresh.length ? fresh : state.catalog;
    if (!pool.length) return setError("The bet catalog is empty, so there's nothing to throw out.");

    const c = pool[Math.floor(Math.random() * pool.length)];
    const made = await db.createHouseBet({
      game_id: game.id, status: "open",
      category: c.category,
      body: withTeams(c.body, game),
      side_a: withTeams(c.side_a, game),
      side_b: withTeams(c.side_b, game),
      p: Number(c.p), odds_edited: false, even_money: false,
    });

    // Two screens firing in the same second: the earlier bet stays.
    if (scheduled) {
      const since = new Date(Date.parse(made.created_at) - 10000).toISOString();
      const twins = await db.fetchHouseBetsSince(game.id, since);
      if (twins[0] && twins[0].id !== made.id) await db.deleteBetIfUnpicked(made.id, null);
    }
    await reload();
  } catch (e) {
    if (e?.code === "23502" || /proposer_id/.test(e?.message ?? "")) {
      state.autoBet.on = false;
      saveAutoBet();
      setError("The database won't take a bet without a proposer yet. In Supabase, " +
               "open the SQL editor and run this once: " + HOUSE_SQL);
    } else setError(e.message || e);
  } finally {
    throwing = false;
  }
}

/* --- start-up ------------------------------------------------------------ */

let started = false, retryTimer = null;

export async function boot() {
  clearTimeout(retryTimer);
  if (!db.configured()) { state.screen = "unconfigured"; return render(); }

  try {
    const [game, players, catalog] = await Promise.all([
      db.fetchOpenGame(), db.fetchPlayers(), db.fetchCatalog(),
    ]);
    state.game = game;
    state.players = players;
    state.catalog = catalog;
    [state.bets, state.attendance] = await Promise.all([
      db.fetchBets(game?.id), db.fetchAttendance(game?.id)]);
  } catch (e) {
    // A dropped signal, not a setup problem: say so, and keep trying.
    state.screen = "offline";
    state.error = e.message || String(e);
    render();
    retryTimer = setTimeout(boot, 10000);
    return;
  }

  state.error = "";
  state.admin = localStorage.getItem("betroom-demo.admin") === "1";

  const saved = localStorage.getItem("betroom-demo.player");
  const known = saved && state.players.some(p => p.id === saved);
  const big = localStorage.getItem("betroom-demo.bigscreen") === "1"
           && localStorage.getItem("betroom-demo.pw");

  if (big) {
    state.bigScreen = true;
    startTicker();
    goto("big");
    refreshHistory().then(render).catch(e => setError(e.message || e));
  } else if (known) {
    state.me = saved;
    checkIn();
    goto(state.game ? "room" : "idle");
  } else {
    goto(localStorage.getItem("betroom-demo.pw") ? "seat" : "join");
  }

  if (!started) {
    started = true;
    db.watchRoom(() => reload({ announce: true }), up => { state.live = up; render(); });
    // Backstop for a phone that suspended its socket.
    setInterval(() => reload({ announce: true }), 20000);
    // A phone waking up, or the tab coming back, catches up straight away.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reload();
    });
  }
}

export function retryBoot() {
  state.screen = "loading";
  render();
  boot();
}

/* --- navigation ---------------------------------------------------------- */

/* Screens call goto with their own name to redraw; only a real change of
   screen clears half-finished confirmations and fetches fresh history. */
export function goto(screen) {
  const changed = state.screen !== screen;
  state.screen = screen;
  state.error = "";
  if (changed) {
    state.confirmGrade = null;
    state.sheet = null;
    if (HISTORY_SCREENS.has(screen)) loadHistory();
  }
  render();
}

export function openRules() {
  state.rulesFrom = state.screen;
  state.menu = false;
  goto("rules");
}

export const closeRules = () => goto(state.rulesFrom || home());

export function openProposeSheet(open) {
  state.proposing = open;
  render();
}

export function toggleInPlayAll() {
  state.inPlayAll = !state.inPlayAll;
  render();
}

export function openMenu(open) {
  state.menu = open;
  render();
}

/* The kickoff and pull-a-bet sheets: PIN first if needed, then confirm. */
export function openSheet(sheet) {
  state.sheet = sheet;
  state.error = "";
  render();
}

export const closeSheet = () => openSheet(null);

/* --- seats --------------------------------------------------------------- */

export async function submitPassword(pw) {
  try {
    if (!await db.verifyRoomPassword(pw)) return setError("That password doesn't match.");
    localStorage.setItem("betroom-demo.pw", "1");
    goto("seat");
  } catch (e) { setError(e.message || e); }
}

export async function takeSeat(playerId) {
  try {
    state.me = playerId;
    localStorage.setItem("betroom-demo.player", playerId);

    let token = localStorage.getItem("betroom-demo.device");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("betroom-demo.device", token);
    }
    await db.rememberDevice(token, playerId);
    checkIn();
    goto(state.game ? "room" : "idle");
  } catch (e) { setError(e.message || e); }
}

/* The big screen is reached from the seat picker and remembered on this
   device, so a laptop left on the coffee table comes back to it on refresh. */
export function enterBigScreen() {
  state.bigScreen = true;
  startTicker();
  try { localStorage.setItem("betroom-demo.bigscreen", "1"); } catch (e) { /* private mode */ }
  goto("big");
  refreshHistory().then(render).catch(e => setError(e.message || e));
}

export function leaveBigScreen() {
  state.bigScreen = false;
  try { localStorage.removeItem("betroom-demo.bigscreen"); } catch (e) { /* private mode */ }
  const saved = localStorage.getItem("betroom-demo.player");
  const known = saved && state.players.some(p => p.id === saved);
  if (known) state.me = saved;
  checkIn();
  goto(known ? (state.game ? "room" : "idle") : "seat");
}

/* Hand this device to someone else, or turn it into the big screen. Only
   the device forgets who it was: picks belong to the player, not the phone,
   so nothing moves. The room password and admin unlock stay put. */
export function switchPlayer() {
  state.me = null;
  state.menu = false;
  state.inPlayAll = false;
  try { localStorage.removeItem("betroom-demo.player"); } catch (e) { /* private mode */ }
  goto("seat");
}

export async function addPlayer(name) {
  try {
    const player = await db.createPlayer(name);
    await flagIfSimilar(player.id, name);
    state.players = await db.fetchPlayers();
    await takeSeat(player.id);
  } catch (e) { setError(e.message || e); }
}

/* --- bets ---------------------------------------------------------------- */

export function proposeBet(draft, side) {
  return run("post", async () => {
    await db.createBet({ ...draft, game_id: state.game.id, status: "open" }, state.me, side);
    state.proposing = false;
    await reload();
    notify("Bet posted — everyone picks a side");
  });
}

export async function pick(betId, side) {
  const bet = findBet(betId);
  if (!bet || bet.status !== "open") return;
  try {
    await db.savePick(betId, state.me, side);
    await reload();
  } catch (e) { setError(e.message || e); }
}

/* Locks only if both sides are still covered in the database, not just on
   this screen. A second tap on a bet someone else just locked is quiet. */
export function lock(betId) {
  return run(`lock:${betId}`, async () => {
    const result = await db.lockBetChecked(betId, presentPlayers().map(p => p.id));
    await reload();
    if (result === "one_sided") {
      const bet = findBet(betId);
      const empty = bet && (takers(bet, "A").length ? bet.side_b : bet.side_a);
      setError(bet
        ? `Someone switched sides — this needs someone on ${empty} again before it can lock.`
        : "Someone switched sides — it needs both sides covered before it can lock.");
    }
  });
}

/* Grading asks first: tap a result, see who wins what, then Confirm. */
export function askGrade(betId, result) {
  state.confirmGrade = { betId, result };
  render();
}

export function cancelGrade() {
  state.confirmGrade = null;
  render();
}

export function grade(betId, result) {
  return run(`grade:${betId}`, async () => {
    await db.gradeBet(betId, result);
    state.confirmGrade = null;
    await reload();
  });
}

export function ungrade(betId) {
  return run(`grade:${betId}`, async () => {
    await db.ungradeBet(betId);
    await reload();
  });
}

/* A past game's result, changed after the night was closed. Admin only. */
export function regrade(betId, result) {
  if (!state.admin) return setError("Changing a past result needs the admin PIN.");
  return run(`regrade:${betId}`, async () => {
    await db.gradeBet(betId, result);
    await refreshHistory();
    notify("Result changed — balances updated");
  });
}

/* Pull a bet off the board. Nobody else on it: it's deleted. Anyone else on
   it: admin only, and it's voided for everyone so there's a record. */
export function pull(betId) {
  const bet = findBet(betId);
  if (!bet) return;
  return run(`pull:${betId}`, async () => {
    if (!pullNeedsAdmin(bet)) {
      const gone = await db.deleteBetIfUnpicked(betId, bet.proposer_id);
      if (!gone) notify("Someone just picked it — pulling it now voids it and needs the admin PIN", 6000);
    } else {
      if (!state.admin) throw new Error("Pulling a bet other people have picked needs the admin PIN.");
      await db.voidBets([betId]);
      notify("Bet pulled — voided for everyone");
    }
    state.sheet = null;
    await reload();
  });
}

/* --- admin --------------------------------------------------------------- */

export async function unlockAdmin(pin) {
  try {
    if (!await db.verifyAdminPin(pin)) return setError("That PIN doesn't match.");
    state.admin = true;
    state.error = "";
    localStorage.setItem("betroom-demo.admin", "1");
    render();
  } catch (e) { setError(e.message || e); }
}

const OPEN_ALREADY = "Tonight's game is still open — close it out before setting up another.";

export function createGameWithBoard(fields, betRows) {
  return run("setup", async () => {
    if (await db.fetchOpenGame()) {
      await reload();
      throw new Error(OPEN_ALREADY);
    }
    try {
      await db.createGameWithBoard({ ...fields, phase: "pregame" },
        betRows.map(r => ({ ...r, proposer_id: state.me })));
    } catch (e) {
      if (e?.code === "23505") { await reload(); throw new Error(OPEN_ALREADY); }
      throw e;
    }
    await reload();
    goto("room");
    notify(`Pregame board is up — ${betRows.length} bets, pick before kickoff`);
  });
}

/* Kickoff closes the pregame board: both-sided bets lock, one-sided ones
   void, and in-game betting opens. */
export function kickOff() {
  return run("kickoff", async () => {
    const r = await db.kickOff(state.game.id, presentPlayers().map(p => p.id));
    state.sheet = null;
    await reload();
    notify(`Kickoff — ${r.locked} pregame bet${r.locked === 1 ? "" : "s"} locked` +
           (r.voided ? `, ${r.voided} voided with no action` : ""), 6000);
  });
}

/* Closing out the night. Bets still taking picks are voided without asking —
   nobody committed to them. Locked bets each need an answer first, which the
   close-out screen enforces before it calls this. */
export function closeOutNight() {
  return run("closeout", async () => {
    const stillOpen = state.bets.filter(b => b.status === "open");
    await db.voidBets(stillOpen.map(b => b.id));
    await db.setGamePhase(state.game.id, "closed", "closed_at");
    await reload();
    goto(home());
  });
}

export function scrapGame() {
  return run("delete", async () => {
    const gone = await db.deleteGameIfUngraded(state.game.id);
    await reload();
    if (!gone) throw new Error("A bet was just graded, so this game can't be deleted now — close it out instead.");
    goto(home());
  });
}

/* --- money --------------------------------------------------------------- */

export function logPayment(payerId, payeeId, amount, note, onSaved) {
  return run("logpay", async () => {
    await db.createPayment({
      payer_id: payerId, payee_id: payeeId,
      amount: Number(amount), recorded_by: state.me, note: note || null,
    });
    onSaved?.();
    await refreshHistory();
    notify("Payment logged");
  });
}

export function undoPayment(id) {
  return run(`voidpay:${id}`, async () => {
    await db.voidPayment(id, state.me);
    await refreshHistory();
  });
}

/* --- roster -------------------------------------------------------------- */

export async function loadRoster() {
  try {
    const [flags, changes] = await Promise.all([db.fetchFlags(), db.fetchRosterChanges()]);
    state.roster = { flags, changes, loaded: true };
    render();
  } catch (e) { setError(e.message || e); }
}

/* Deliberately trigger-happy: a false flag costs the admin one tap, a missed
   one costs a split record nobody notices. */
export function looksLike(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, "");
  const x = norm(a), y = norm(b);
  if (!x || !y) return null;
  if (x === y) return "same name";
  if (x.startsWith(y) || y.startsWith(x)) return "one name starts with the other";
  if (editDistance(x, y) <= 2) return "nearly identical spelling";
  const first = s => s.trim().split(/\s+/)[0].toLowerCase();
  if (first(a) === first(b)) return "same first name";
  return null;
}

function editDistance(a, b) {
  const grid = Array.from({ length: a.length + 1 },
    (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) grid[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1,
                            grid[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return grid[a.length][b.length];
}

async function flagIfSimilar(playerId, name) {
  const hit = state.players
    .filter(p => p.id !== playerId)
    .map(p => ({ p, why: looksLike(name, p.name) }))
    .find(x => x.why);
  if (hit) await db.raiseFlag(playerId, hit.p.id, hit.why);
}

export async function renamePlayer(id, name) {
  const clean = String(name).trim();
  if (!clean) return;
  try {
    await db.renamePlayer(id, clean);
    state.players = await db.fetchPlayers();
    await flagIfSimilar(id, clean);
    await loadRoster();
  } catch (e) { setError(e.message || e); }
}

export async function mergePlayers(source, target) {
  try {
    await db.mergePlayers(source, target);
    if (state.me === source) {
      state.me = target;
      localStorage.setItem("betroom-demo.player", target);
    }
    state.players = await db.fetchPlayers();
    await Promise.all([reload(), loadHistory(), loadRoster()]);
    notify("Merged — every stat recalculated");
  } catch (e) { setError(e.message || e); }
}

export async function removePlayer(id) {
  try {
    await db.removePlayer(id);
    state.players = await db.fetchPlayers();
    await Promise.all([reload(), loadHistory(), loadRoster()]);
  } catch (e) { setError(e.message || e); }
}

export async function undoRosterChange(id) {
  try {
    await db.undoRosterChange(id);
    state.players = await db.fetchPlayers();
    await Promise.all([reload(), loadHistory(), loadRoster()]);
    notify("Put back");
  } catch (e) { setError(e.message || e); }
}

export async function clearFlag(id) {
  try { await db.clearFlag(id); await loadRoster(); }
  catch (e) { setError(e.message || e); }
}

export async function reassignPick(betId, fromId, toId) {
  try { await db.reassignPick(betId, fromId, toId); await reload(); }
  catch (e) { setError(e.message || e); }
}

