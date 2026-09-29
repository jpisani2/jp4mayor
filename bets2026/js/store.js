/* ===========================================================================
   The single source of truth for what the app is currently showing, plus the
   only place a re-render is triggered. Screens read state and call actions;
   they never mutate state directly and never call render themselves.
   =========================================================================== */

import * as db from "./db.js";
import { DORMANT_AFTER, MAX_OPEN_BETS } from "./config.js";
import { isDormant, canLock } from "./scoring.js";
import { beep, withTeams } from "./format.js";

/* Big screen random bets: interval choices in minutes, and where this device
   remembers its setting. Declared before state, which reads them. */
export const AUTO_EVERY = [2, 3, 5, 10];   // minutes
const AUTO_KEY = "betroom.autobet";

export const state = {
  screen: "loading",   // loading | unconfigured | join | seat | idle | room
                       //          | setup | closeout | settle | stats
  game: null,
  players: [],
  bets: [],
  catalog: [],
  me: null,
  live: false,
  error: "",
  notice: "",
  proposing: false,
  menu: false,
  inPlayAll: false,    // everyone's in-play totals expanded in the room
  bigScreen: false,    // this device is the shared dashboard, not a player
  fresh: {},           // big screen: bet id -> when it first appeared
  autoBet: loadAutoBet(), // big screen: random bets { on, every, nextAt }
  admin: false,
  history: { games: [], bets: [], payments: [], loaded: false },
  roster: { flags: [], changes: [], loaded: false },
};

let onRender = () => {};
export const onChange = fn => { onRender = fn; };
export const render = () => onRender();

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

/* --- derived ------------------------------------------------------------- */

export const stake = () => Number(state.game?.base_stake ?? 1);
export const nameOf = id => state.players.find(p => p.id === id)?.name ?? "—";
export const betsBy = status => visibleBets().filter(b => b.status === status);

export const phase = () => state.game?.phase ?? "live";
export const isPregame = () => phase() === "pregame";

/* Before kickoff the room shows the pregame board and nothing else. */
export function visibleBets() {
  return isPregame() ? state.bets.filter(b => b.is_pregame) : state.bets;
}

/* Sides on a pregame bet stay hidden until kickoff. */
export const isBlind = bet => isPregame() && bet.is_pregame;

/* Players who still appear in other people's "waiting on" lines. */
export const presentPlayers = () =>
  state.players.filter(p => !isDormant(p.id, state.bets, DORMANT_AFTER));

export const awaiting = bet =>
  presentPlayers().filter(p => !bet.picks.some(x => x.player_id === p.id));

/* Where Back goes: the big screen if this device is one, otherwise the board
   or the midweek screen. */
export const home = () => state.bigScreen ? "big" : state.game ? "room" : "idle";

/* --- loading ------------------------------------------------------------- */

/* The big screen shows balances across every game, so it keeps the full
   history current rather than loading it once like the settle-up screen. */
async function refreshHistory() {
  const [games, bets, payments] = await Promise.all([
    db.fetchGames(), db.fetchAllBets(), db.fetchPayments(),
  ]);
  state.history = { games, bets, payments, loaded: true };
}

let loading = false;

export async function reload({ announce = false } = {}) {
  if (loading) return;
  loading = true;
  try {
    const openBefore = betsBy("open").length;
    const known = new Set(state.bets.map(b => b.id));
    const [game, players] = await Promise.all([db.fetchOpenGame(), db.fetchPlayers()]);
    state.game = game;
    state.players = players;
    state.bets = await db.fetchBets(game?.id);
    if (state.bigScreen) {
      await refreshHistory();
      markFresh(betsBy("open").filter(b => !known.has(b.id)));
    } else if (announce && betsBy("open").length > openBefore) beep();
    state.error = "";
    render();
  } catch (e) {
    setError(e.message || e);
  } finally {
    loading = false;
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
    return { on: Boolean(saved.on), every,
             nextAt: saved.on ? Date.now() + every * 60000 : 0 };
  } catch (e) { return { on: false, every: 3, nextAt: 0 }; }
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

export function setAutoBet(on) {
  state.autoBet.on = on;
  state.autoBet.nextAt = on ? Date.now() + state.autoBet.every * 60000 : 0;
  saveAutoBet();
  render();
}

export function setAutoEvery(minutes) {
  state.autoBet.every = minutes;
  if (state.autoBet.on) state.autoBet.nextAt = Date.now() + minutes * 60000;
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
    if (autoPaused()) { auto.nextAt = Date.now() + auto.every * 60000; return; }
    if (Date.now() >= auto.nextAt) {
      auto.nextAt = Date.now() + auto.every * 60000;
      throwRandomBet();
    }
  }, 1000);
}

const HOUSE_SQL = "alter table bets alter column proposer_id drop not null;";

/* Throw a random catalog bet onto the board. The big screen never takes a
   side. If nobody touched the last one it threw, that one is swapped out
   rather than left clogging the board. */
export async function throwRandomBet() {
  if (throwing || autoPaused()) return;
  throwing = true;
  try {
    const untouched = state.bets.filter(b =>
      b.status === "open" && !b.proposer_id && !b.picks.length);
    for (const bet of untouched) await db.deleteBet(bet.id);

    const stillOpen = state.bets.filter(b => b.status === "open").length - untouched.length;
    if (stillOpen >= MAX_OPEN_BETS) {
      notify(`Board is full — no random bet this time`);
      return;
    }

    const used = new Set(state.bets.map(b => b.body));
    const fresh = state.catalog.filter(c => !used.has(withTeams(c.body, state.game)));
    const pool = fresh.length ? fresh : state.catalog;
    if (!pool.length) return setError("The bet catalog is empty, so there's nothing to throw out.");

    const c = pool[Math.floor(Math.random() * pool.length)];
    await db.createHouseBet({
      game_id: state.game.id, status: "open",
      category: c.category,
      body: withTeams(c.body, state.game),
      side_a: withTeams(c.side_a, state.game),
      side_b: withTeams(c.side_b, state.game),
      p: Number(c.p), odds_edited: false, even_money: false,
    });
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

export async function boot() {
  if (!db.configured()) { state.screen = "unconfigured"; return render(); }

  try {
    const [game, players, catalog] = await Promise.all([
      db.fetchOpenGame(), db.fetchPlayers(), db.fetchCatalog(),
    ]);
    state.game = game;
    state.players = players;
    state.catalog = catalog;
    state.bets = await db.fetchBets(game?.id);
  } catch (e) {
    state.screen = "unconfigured";
    return setError("Couldn't reach the database: " + (e.message || e));
  }

  state.admin = localStorage.getItem("betroom.admin") === "1";

  const saved = localStorage.getItem("betroom.player");
  const known = saved && state.players.some(p => p.id === saved);
  const big = localStorage.getItem("betroom.bigscreen") === "1"
           && localStorage.getItem("betroom.pw");

  if (big) {
    state.bigScreen = true;
    state.screen = "big";
    startTicker();
    refreshHistory().then(render).catch(e => setError(e.message || e));
  } else if (known) {
    state.me = saved;
    state.screen = state.game ? "room" : "idle";
    db.markPresent(state.game?.id, saved);
  } else {
    state.screen = localStorage.getItem("betroom.pw") ? "seat" : "join";
  }

  render();
  db.watchRoom(() => reload({ announce: true }), up => { state.live = up; render(); });

  // Backstop for a phone that suspended its socket.
  setInterval(() => reload({ announce: true }), 20000);
}

/* --- actions ------------------------------------------------------------- */

export async function submitPassword(pw) {
  try {
    if (!await db.verifyRoomPassword(pw)) return setError("That password doesn't match.");
    localStorage.setItem("betroom.pw", "1");
    state.error = "";
    state.screen = "seat";
    render();
  } catch (e) { setError(e.message || e); }
}

export async function takeSeat(playerId) {
  try {
    state.me = playerId;
    localStorage.setItem("betroom.player", playerId);

    let token = localStorage.getItem("betroom.device");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("betroom.device", token);
    }
    await db.rememberDevice(token, playerId);
    await db.markPresent(state.game?.id, playerId);

    state.screen = state.game ? "room" : "idle";
    render();
  } catch (e) { setError(e.message || e); }
}

/* The big screen is reached from the seat picker and remembered on this
   device, so a laptop left on the coffee table comes back to it on refresh. */
export function enterBigScreen() {
  state.bigScreen = true;
  state.screen = "big";
  startTicker();
  state.error = "";
  try { localStorage.setItem("betroom.bigscreen", "1"); } catch (e) { /* private mode */ }
  render();
  refreshHistory().then(render).catch(e => setError(e.message || e));
}

export function leaveBigScreen() {
  state.bigScreen = false;
  try { localStorage.removeItem("betroom.bigscreen"); } catch (e) { /* private mode */ }
  const saved = localStorage.getItem("betroom.player");
  const known = saved && state.players.some(p => p.id === saved);
  if (known) state.me = saved;
  state.screen = known ? (state.game ? "room" : "idle") : "seat";
  render();
}

/* Hand this device to someone else, or turn it into the big screen. Only
   the device forgets who it was: picks belong to the player, not the phone,
   so nothing moves. The room password and admin unlock stay put. */
export function switchPlayer() {
  state.me = null;
  state.menu = false;
  state.inPlayAll = false;
  try { localStorage.removeItem("betroom.player"); } catch (e) { /* private mode */ }
  state.screen = "seat";
  state.error = "";
  render();
}

export async function addPlayer(name) {
  try {
    const player = await db.createPlayer(name);
    await flagIfSimilar(player.id, name);
    state.players = await db.fetchPlayers();
    await takeSeat(player.id);
  } catch (e) { setError(e.message || e); }
}

export async function proposeBet(draft, side) {
  try {
    await db.createBet({ ...draft, game_id: state.game.id, proposer_id: state.me,
                         status: "open" }, state.me, side);
    state.proposing = false;
    await reload();
    notify("Bet posted — everyone picks a side");
  } catch (e) { setError(e.message || e); }
}

export async function pick(betId, side) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet || bet.status !== "open") return;
  try {
    await db.savePick(betId, state.me, side);
    await reload();
  } catch (e) { setError(e.message || e); }
}

export async function lock(betId) {
  const bet = state.bets.find(b => b.id === betId);
  if (!bet) return;
  try {
    await db.autoOut(betId, awaiting(bet).map(p => p.id));
    await db.lockBet(betId);
    await reload();
  } catch (e) { setError(e.message || e); }
}

export async function grade(betId, result) {
  try { await db.gradeBet(betId, result); await reload(); }
  catch (e) { setError(e.message || e); }
}

export async function ungrade(betId) {
  try { await db.ungradeBet(betId); await reload(); }
  catch (e) { setError(e.message || e); }
}

export async function pull(betId) {
  try { await db.deleteBet(betId); await reload(); }
  catch (e) { setError(e.message || e); }
}

/* --- admin --------------------------------------------------------------- */

export async function unlockAdmin(pin) {
  try {
    if (!await db.verifyAdminPin(pin)) return setError("That PIN doesn't match.");
    state.admin = true;
    state.error = "";
    localStorage.setItem("betroom.admin", "1");
    render();
  } catch (e) { setError(e.message || e); }
}

export function goto(screen) {
  state.screen = screen;
  state.error = "";
  render();
}

export async function createGameWithBoard(fields, betRows) {
  try {
    const game = await db.createGame({ ...fields, phase: "pregame" });
    await db.createBets(betRows.map(r => ({ ...r, game_id: game.id,
                                            proposer_id: state.me })));
    await reload();
    state.screen = "room";
    render();
    notify(`Pregame board is up — ${betRows.length} bets, pick before kickoff`);
  } catch (e) { setError(e.message || e); }
}

/* Kickoff closes the pregame board: both-sided bets lock, one-sided ones
   void, and in-game betting opens. */
export async function kickOff() {
  const open = state.bets.filter(b => b.is_pregame && b.status === "open");
  const lockable = open.filter(canLock);
  const dead = open.filter(b => !canLock(b));
  try {
    for (const bet of lockable) {
      await db.autoOut(bet.id, awaiting(bet).map(p => p.id));
    }
    await db.lockBets(lockable.map(b => b.id));
    await db.voidBets(dead.map(b => b.id));
    await db.setGamePhase(state.game.id, "live", "kicked_off_at");
    await reload();
    notify(`Kickoff — ${lockable.length} pregame bets locked` +
           (dead.length ? `, ${dead.length} voided with no action` : ""), 6000);
  } catch (e) { setError(e.message || e); }
}

/* Closing out the night. Bets still taking picks are voided without asking —
   nobody committed to them. Locked bets each need an answer first, which the
   close-out screen enforces before it calls this. */
/* --- history, money, stats ----------------------------------------------- */

export async function loadHistory() {
  try {
    const [games, bets, payments] = await Promise.all([
      db.fetchGames(), db.fetchAllBets(), db.fetchPayments(),
    ]);
    state.history = { games, bets, payments, loaded: true };
    render();
  } catch (e) { setError(e.message || e); }
}

export async function logPayment(payerId, payeeId, amount, note) {
  try {
    await db.createPayment({
      payer_id: payerId, payee_id: payeeId,
      amount: Number(amount), recorded_by: state.me, note: note || null,
    });
    await loadHistory();
    notify("Payment logged");
  } catch (e) { setError(e.message || e); }
}

export async function undoPayment(id) {
  try {
    await db.voidPayment(id, state.me);
    await loadHistory();
  } catch (e) { setError(e.message || e); }
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
      localStorage.setItem("betroom.player", target);
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

export async function closeOutNight() {
  const stillOpen = state.bets.filter(b => b.status === "open");
  try {
    await db.voidBets(stillOpen.map(b => b.id));
    await db.setGamePhase(state.game.id, "closed", "closed_at");
    await reload();
    state.screen = home();
    render();
  } catch (e) { setError(e.message || e); }
}

export async function scrapGame() {
  try {
    await db.deleteGame(state.game.id);
    await reload();
    state.screen = home();
    render();
  } catch (e) { setError(e.message || e); }
}

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
