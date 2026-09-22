/* ===========================================================================
   DEMO VERSION of db.js.

   The real app keeps every call to Supabase in db.js — that's rule 1 in the
   README. So this demo is the real app with exactly this one file swapped:
   same function names, same shapes, but everything lives in memory in this
   browser tab. Nothing is sent anywhere. Reload the page and it starts over.

   Also in here, and not in the real app: a handful of made-up friends who
   pick sides on the bets you post (and occasionally call one of their own),
   so the board behaves like a room with people in it.
   =========================================================================== */

export const client = null;
export const configured = () => true;

/* --- a small deterministic random, so the seeded history is always the same */

let seed = 20260921;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const live = Math.random;          // the friends use real randomness

let counter = 0;
const id = prefix => `${prefix}${++counter}`;
const clone = x => JSON.parse(JSON.stringify(x));
const wait = (ms = 40) => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();

const daysAgo = (n, hour = 13) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const dateOnly = d => {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* --- the catalog --------------------------------------------------------- */

const CATALOG = [
  ["This drive", "{home} scores on this drive", "Yes", "No", 0.38],
  ["This drive", "This drive ends in a touchdown", "Touchdown", "Anything else", 0.24],
  ["This drive", "This drive ends in a punt", "Punt", "Anything else", 0.40],
  ["This drive", "{away} gets a first down on this drive", "Yes", "No", 0.72],
  ["This drive", "Three-and-out", "Yes", "No", 0.27],
  ["Next play", "Next play is a run or a pass", "Run", "Pass", 0.42],
  ["Next play", "Next play gains ten yards or more", "Yes", "No", 0.18],
  ["Next play", "Next play has a flag on it", "Flag", "Clean", 0.09],
  ["Next play", "Next pass is complete", "Complete", "Incomplete", 0.64],
  ["Next play", "Next play goes left or right", "Left", "Right", 0.5],
  ["Scoring", "Next score is a touchdown", "Touchdown", "Field goal or safety", 0.58],
  ["Scoring", "{home} scores next", "{home}", "{away}", 0.55],
  ["Scoring", "The next field goal is good", "Good", "Missed", 0.85],
  ["Scoring", "There's a two-point try this half", "Yes", "No", 0.15],
  ["Scoring", "Someone scores before halftime", "Yes", "No", 0.8],
  ["Players", "The quarterback runs for a first down this half", "Yes", "No", 0.35],
  ["Players", "A tight end catches a touchdown", "Yes", "No", 0.3],
  ["Players", "Someone gets a sack on this drive", "Sack", "No sack", 0.2],
  ["Players", "The kicker's next kick is a touchback", "Touchback", "Returned", 0.6],
  ["Broadcast", "The announcers mention a player's mom", "Yes", "No", 0.45],
  ["Broadcast", "They show the owner's box this quarter", "Yes", "No", 0.5],
  ["Broadcast", "A replay review this quarter", "Yes", "No", 0.3],
  ["Broadcast", "The next commercial is for a truck", "Truck", "Not a truck", 0.33],
  ["Game", "{home} goes for it on a fourth down", "Yes", "No", 0.55],
  ["Game", "A challenge flag gets thrown", "Yes", "No", 0.4],
  ["Game", "There's a turnover in the fourth quarter", "Yes", "No", 0.45],
  ["Game", "The game is decided by a field goal or less", "Yes", "No", 0.3],
].map(([category, body, side_a, side_b, p], i) =>
  ({ id: String(i + 1), category, body, side_a, side_b, p, retired: false }));

/* --- the people ----------------------------------------------------------- */

const NAMES = ["Mike", "Dana", "Teddy", "Rosa", "Sam", "Nick"];

const db = {
  players: [], games: [], bets: [], picks: [], payments: [],
  flags: [], changes: [], devices: [], attendance: [],
};

let me = null;                        // whoever the visitor sat down as
const friends = () => db.players.filter(p => p.id !== me && p.name !== "Ted");

/* --- seeding: three finished games and one in the second quarter --------- */

function addPlayer(name, created) {
  const row = { id: id("p"), name, created_at: created.toISOString() };
  db.players.push(row);
  return row;
}

function addGame(fields) {
  const row = { id: id("g"), created_at: now(), kicked_off_at: null, closed_at: null, ...fields };
  db.games.push(row);
  return row;
}

let stamp = daysAgo(30).getTime();
const tick = () => new Date(stamp += 60000).toISOString();

function addBet(game, fields) {
  const created = tick();
  const row = {
    id: id("b"), game_id: game.id, category: "Custom", is_pregame: false,
    odds_edited: false, even_money: false, status: "open", result: null,
    proposer_id: null, created_at: created, locked_at: null, graded_at: null,
    ...fields,
  };
  db.bets.push(row);
  return row;
}

const resolveTeams = (text, game) => String(text)
  .replace(/\{home\}/g, game.home_team).replace(/\{away\}/g, game.away_team);

/* Everyone takes a side or sits out; both sides always end up covered. */
function seedPicks(bet, people) {
  people.forEach(p => {
    const r = rand();
    const side = r < 0.12 ? "OUT" : rand() < (bet.even_money ? 0.5 : 0.35 + bet.p * 0.3) ? "A" : "B";
    db.picks.push({ bet_id: bet.id, player_id: p.id, side, auto: false, updated_at: bet.created_at });
  });
  const mine = db.picks.filter(x => x.bet_id === bet.id);
  if (!mine.some(x => x.side === "A")) mine[0].side = "A";
  if (!mine.some(x => x.side === "B")) mine[mine.length - 1].side = "B";
}

function gradeSeed(bet) {
  const r = rand();
  bet.status = "graded";
  bet.result = r < 0.06 ? "PUSH" : r < bet.p ? "A" : "B";
  bet.locked_at = bet.created_at;
  bet.graded_at = tick();
}

function seed_() {
  const regulars = NAMES.map((n, i) => addPlayer(n, daysAgo(60 - i)));
  const ted = addPlayer("Ted", daysAgo(22));

  const past = [
    { ago: 21, away: "Packers", home: "Lions", fav: "home", spread: 2.5, total: 47.5 },
    { ago: 14, away: "Lions", home: "Vikings", fav: "away", spread: 1.5, total: 45.5 },
    { ago: 7, away: "Bears", home: "Lions", fav: "home", spread: 6.5, total: 44.5 },
  ];

  past.forEach((g, gi) => {
    const kick = daysAgo(g.ago);
    stamp = kick.getTime();
    const game = addGame({
      kickoff_date: dateOnly(kick), away_team: g.away, home_team: g.home,
      favorite: g.fav, spread: g.spread, total: g.total, base_stake: 1,
      phase: "closed", kicked_off_at: kick.toISOString(),
      closed_at: new Date(kick.getTime() + 4 * 3600e3).toISOString(),
    });
    const people = gi === 0 ? [...regulars.slice(0, 5), ted] : regulars;
    for (let i = 0; i < 9; i++) {
      const c = CATALOG[Math.floor(rand() * CATALOG.length)];
      const bet = addBet(game, {
        category: c.category, body: resolveTeams(c.body, game),
        side_a: resolveTeams(c.side_a, game), side_b: resolveTeams(c.side_b, game),
        p: c.p, proposer_id: people[i % people.length].id,
      });
      seedPicks(bet, people);
      gradeSeed(bet);
    }
  });

  // Ted is Teddy on his wife's phone. The roster screen flags it.
  db.flags.push({ id: id("f"), player_id: ted.id, similar_to: regulars[2].id,
                  reason: "one name starts with the other", created_at: daysAgo(21).toISOString(),
                  resolved_at: null });

  // Some cash already moved.
  const [mike, dana, teddy, rosa, sam] = regulars;
  db.payments.push(
    { id: id("pay"), payer_id: sam.id, payee_id: rosa.id, amount: 6, recorded_by: rosa.id,
      note: "Venmo", paid_at: daysAgo(13).toISOString(), voided_at: null, voided_by: null },
    { id: id("pay"), payer_id: teddy.id, payee_id: mike.id, amount: 4, recorded_by: mike.id,
      note: null, paid_at: daysAgo(6).toISOString(), voided_at: null, voided_by: null },
    { id: id("pay"), payer_id: dana.id, payee_id: mike.id, amount: 5, recorded_by: dana.id,
      note: "wrong person", paid_at: daysAgo(6).toISOString(),
      voided_at: daysAgo(6, 15).toISOString(), voided_by: dana.id },
  );

  // Today's game, second quarter.
  const kick = daysAgo(0, new Date().getHours() - 1);
  stamp = kick.getTime() - 3600e3;
  const game = addGame({
    kickoff_date: dateOnly(new Date()), away_team: "Buccaneers", home_team: "Lions",
    favorite: "home", spread: 4.5, total: 50.5, base_stake: 1,
    phase: "live", kicked_off_at: kick.toISOString(),
  });

  const pregame = [
    ["Lions covers the spread", "Lions covers", "Buccaneers covers", 0.5, "A"],
    ["Total points over or under 50.5", "Over", "Under", 0.5, null],
    ["Which team gets the ball first", "Buccaneers", "Lions", 0.5, "B"],
    ["Lions wins outright", "Yes", "No", 0.66, null],
    ["First score is a touchdown", "TD", "Field goal or safety", 0.6, "A"],
  ];
  pregame.forEach(([body, a, b, p, result]) => {
    const bet = addBet(game, { category: "Pregame", is_pregame: true, body,
                               side_a: a, side_b: b, p, proposer_id: mike.id });
    seedPicks(bet, regulars);
    bet.status = result ? "graded" : "locked";
    bet.result = result;
    bet.locked_at = kick.toISOString();
    bet.graded_at = result ? tick() : null;
  });

  stamp = kick.getTime();
  const inGame = [
    [CATALOG[5], "graded", "B", dana],
    [CATALOG[10], "graded", "A", rosa],
    [CATALOG[0], "locked", null, mike],
    [CATALOG[20], "locked", null, sam],
  ];
  inGame.forEach(([c, status, result, who]) => {
    const bet = addBet(game, {
      category: c.category, body: resolveTeams(c.body, game),
      side_a: resolveTeams(c.side_a, game), side_b: resolveTeams(c.side_b, game),
      p: c.p, proposer_id: who.id,
    });
    seedPicks(bet, regulars);
    bet.status = status;
    bet.result = result;
    bet.locked_at = tick();
    bet.graded_at = status === "graded" ? tick() : null;
  });

  // One still taking picks, called just now. Nobody but Nick has answered.
  const open = CATALOG[23];
  const bet = addBet(game, {
    category: open.category, body: resolveTeams(open.body, game),
    side_a: resolveTeams(open.side_a, game), side_b: resolveTeams(open.side_b, game),
    p: open.p, proposer_id: regulars[5].id, created_at: now(),
  });
  db.picks.push({ bet_id: bet.id, player_id: regulars[5].id, side: "A", auto: false,
                  updated_at: now() });
  pendingSeed = bet.id;
}

let pendingSeed = null;
seed_();

/* --- realtime, faked ------------------------------------------------------ */

let listener = () => {};
const changed = () => setTimeout(() => listener(), 0);

/* Friends answer a bet over the next few seconds, like people looking up from
   the TV one at a time. Both sides end up covered so it can always lock. */
function friendsAnswer(betId, skip = []) {
  const bet = db.bets.find(b => b.id === betId);
  if (!bet) return;
  const who = friends().filter(p => !skip.includes(p.id))
    .sort(() => live() - 0.5);
  let delay = 900;

  who.forEach((p, i) => {
    delay += 700 + live() * 1800;
    setTimeout(() => {
      const b = db.bets.find(x => x.id === betId);
      if (!b || b.status !== "open") return;
      if (db.picks.some(x => x.bet_id === betId && x.player_id === p.id)) return;
      const taken = db.picks.filter(x => x.bet_id === betId);
      const last = i === who.length - 1;
      let side = live() < 0.15 ? "OUT" : live() < b.p ? "A" : "B";
      if (last && !taken.some(x => x.side === "A")) side = "A";
      if (last && !taken.some(x => x.side === "B")) side = "B";
      db.picks.push({ bet_id: betId, player_id: p.id, side, auto: false, updated_at: now() });
      changed();
    }, delay);
  });
}

/* Now and then, someone else calls a bet. */
function friendCallsOne() {
  const game = db.games.find(g => g.phase === "live");
  if (!game || !me) return;
  const open = db.bets.filter(b => b.game_id === game.id && b.status === "open");
  if (open.length >= 3) return;
  const caller = friends()[Math.floor(live() * friends().length)];
  const c = CATALOG[Math.floor(live() * CATALOG.length)];
  if (!caller) return;
  const bet = {
    id: id("b"), game_id: game.id, category: c.category, is_pregame: false,
    body: resolveTeams(c.body, game), side_a: resolveTeams(c.side_a, game),
    side_b: resolveTeams(c.side_b, game), p: c.p, odds_edited: false, even_money: false,
    status: "open", result: null, proposer_id: caller.id, created_at: now(),
    locked_at: null, graded_at: null,
  };
  db.bets.push(bet);
  db.picks.push({ bet_id: bet.id, player_id: caller.id, side: live() < c.p ? "A" : "B",
                  auto: false, updated_at: now() });
  changed();
  friendsAnswer(bet.id, [caller.id]);
}
setInterval(friendCallsOne, 45000);

function sitDown(playerId) {
  const first = !me;
  me = playerId;
  if (first && pendingSeed) {
    const nick = db.picks.find(x => x.bet_id === pendingSeed)?.player_id;
    friendsAnswer(pendingSeed, [nick]);
    pendingSeed = null;
  }
}

/* --- reads --------------------------------------------------------------- */

const withPicks = b => ({
  ...clone(b), p: Number(b.p),
  picks: db.picks.filter(x => x.bet_id === b.id)
    .map(({ player_id, side, auto }) => ({ player_id, side, auto })),
});
const newestFirst = (a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0);

export async function fetchOpenGame() {
  await wait();
  const g = db.games.filter(g => g.phase !== "closed")
    .sort((a, b) => (b.kickoff_date > a.kickoff_date ? 1 : -1))[0];
  return g ? clone(g) : null;
}

export async function fetchPlayers() {
  await wait();
  return clone([...db.players].sort((a, b) => (a.created_at > b.created_at ? 1 : -1)));
}

export async function fetchCatalog() {
  await wait();
  return clone(CATALOG.filter(c => !c.retired));
}

export async function fetchBets(gameId) {
  await wait();
  if (!gameId) return [];
  return db.bets.filter(b => b.game_id === gameId).sort(newestFirst).map(withPicks);
}

/* --- writes -------------------------------------------------------------- */

export async function verifyRoomPassword() { await wait(); return true; }

export async function createPlayer(name) {
  await wait();
  const row = { id: id("p"), name: name.trim(), created_at: now() };
  db.players.push(row);
  return clone(row);
}

export async function rememberDevice(token, playerId) {
  await wait();
  sitDown(playerId);
}

export async function markPresent(gameId, playerId) {
  if (playerId) sitDown(playerId);
}

export async function createBet(bet, proposerId, side) {
  await wait();
  const row = { id: id("b"), result: null, created_at: now(), locked_at: null,
                graded_at: null, is_pregame: false, ...bet };
  db.bets.push(row);
  db.picks.push({ bet_id: row.id, player_id: proposerId, side, auto: false, updated_at: now() });
  friendsAnswer(row.id, [proposerId]);
  return clone(row);
}

export async function savePick(betId, playerId, side) {
  await wait();
  const existing = db.picks.find(x => x.bet_id === betId && x.player_id === playerId);
  if (existing) Object.assign(existing, { side, auto: false, updated_at: now() });
  else db.picks.push({ bet_id: betId, player_id: playerId, side, auto: false, updated_at: now() });
}

export async function autoOut(betId, playerIds) {
  await wait();
  playerIds.forEach(pid => {
    if (!db.picks.some(x => x.bet_id === betId && x.player_id === pid)) {
      db.picks.push({ bet_id: betId, player_id: pid, side: "OUT", auto: true, updated_at: now() });
    }
  });
}

const betById = betId => db.bets.find(b => b.id === betId);

export async function lockBet(betId) {
  await wait();
  Object.assign(betById(betId), { status: "locked", locked_at: now() });
}

export async function gradeBet(betId, result) {
  await wait();
  Object.assign(betById(betId), { status: "graded", result, graded_at: now() });
}

export async function ungradeBet(betId) {
  await wait();
  Object.assign(betById(betId), { status: "locked", result: null, graded_at: null });
}

export async function deleteBet(betId) {
  await wait();
  db.bets = db.bets.filter(b => b.id !== betId);
  db.picks = db.picks.filter(x => x.bet_id !== betId);
}

export async function verifyAdminPin() { await wait(); return true; }

export async function createGame(fields) {
  await wait();
  return clone(addGame({ ...fields, created_at: now() }));
}

export async function createBets(rows) {
  await wait();
  rows.forEach((r, i) => {
    const row = { id: id("b"), result: null, locked_at: null, graded_at: null,
                  created_at: new Date(Date.now() + i).toISOString(), ...r };
    db.bets.push(row);
    friendsAnswer(row.id, [me]);
  });
}

export async function setGamePhase(gameId, phase, stampField) {
  await wait();
  const g = db.games.find(x => x.id === gameId);
  g.phase = phase;
  if (stampField) g[stampField] = now();
}

export async function lockBets(ids) {
  await wait();
  ids.forEach(i => Object.assign(betById(i), { status: "locked", locked_at: now() }));
}

export async function voidBets(ids) {
  await wait();
  ids.forEach(i => Object.assign(betById(i),
    { status: "graded", result: "VOID", graded_at: now() }));
}

export async function deleteGame(gameId) {
  await wait();
  const gone = new Set(db.bets.filter(b => b.game_id === gameId).map(b => b.id));
  db.games = db.games.filter(g => g.id !== gameId);
  db.bets = db.bets.filter(b => !gone.has(b.id));
  db.picks = db.picks.filter(x => !gone.has(x.bet_id));
}

/* --- history and money --------------------------------------------------- */

export async function fetchGames() {
  await wait();
  return clone([...db.games].sort((a, b) => (b.kickoff_date > a.kickoff_date ? 1 : -1)));
}

export async function fetchAllBets() {
  await wait();
  return [...db.bets].sort(newestFirst).map(withPicks);
}

export async function fetchPayments() {
  await wait();
  return clone([...db.payments].sort((a, b) => (b.paid_at > a.paid_at ? 1 : -1)));
}

export async function createPayment(row) {
  await wait();
  db.payments.push({ id: id("pay"), paid_at: now(), voided_at: null, voided_by: null, ...row });
}

export async function voidPayment(payId, byPlayerId) {
  await wait();
  Object.assign(db.payments.find(p => String(p.id) === String(payId)),
    { voided_at: now(), voided_by: byPlayerId });
}

/* --- roster -------------------------------------------------------------- */

export async function fetchFlags() {
  await wait();
  return clone(db.flags.filter(f => !f.resolved_at));
}

export async function raiseFlag(playerId, similarTo, reason) {
  await wait();
  db.flags.push({ id: id("f"), player_id: playerId, similar_to: similarTo, reason,
                  created_at: now(), resolved_at: null });
}

export async function clearFlag(flagId) {
  await wait();
  db.flags.find(f => f.id === flagId).resolved_at = now();
}

export async function renamePlayer(playerId, name) {
  await wait();
  db.players.find(p => p.id === playerId).name = name;
}

/* The real versions are single transactions in Postgres. Here each change
   keeps a copy of exactly the rows it touched, which is what undo restores. */
function snapshotFor(playerId) {
  return {
    player: clone(db.players.find(p => p.id === playerId)),
    picks: clone(db.picks.filter(x => x.player_id === playerId)),
    payments: clone(db.payments.filter(p =>
      [p.payer_id, p.payee_id, p.recorded_by, p.voided_by].includes(playerId))),
    flags: clone(db.flags.filter(f => f.player_id === playerId || f.similar_to === playerId)),
  };
}

export async function mergePlayers(source, target) {
  await wait();
  const snap = snapshotFor(source);
  const targetPicks = new Set(db.picks.filter(x => x.player_id === target).map(x => x.bet_id));
  // Where both had a pick, the target's stands and the source's is dropped.
  snap.moved = snap.picks.map(x => x.bet_id).filter(b => !targetPicks.has(b));
  db.picks = db.picks.filter(x => !(x.player_id === source && targetPicks.has(x.bet_id)));
  db.picks.forEach(x => { if (x.player_id === source) x.player_id = target; });
  db.payments.forEach(p => ["payer_id", "payee_id", "recorded_by", "voided_by"]
    .forEach(k => { if (p[k] === source) p[k] = target; }));
  db.flags.forEach(f => {
    if (f.player_id === source || f.similar_to === source) f.resolved_at = f.resolved_at || now();
  });
  db.players = db.players.filter(p => p.id !== source);
  db.changes.push({ id: id("c"), kind: "merge", subject_name: snap.player.name,
                    target_id: target, created_at: now(), undone_at: null, snap });
}

export async function removePlayer(victim) {
  await wait();
  const snap = snapshotFor(victim);
  db.picks = db.picks.filter(x => x.player_id !== victim);
  db.flags.forEach(f => {
    if (f.player_id === victim || f.similar_to === victim) f.resolved_at = f.resolved_at || now();
  });
  db.players = db.players.filter(p => p.id !== victim);
  db.changes.push({ id: id("c"), kind: "delete", subject_name: snap.player.name,
                    target_id: null, created_at: now(), undone_at: null, snap });
}

export async function undoRosterChange(changeId) {
  await wait();
  const change = db.changes.find(c => c.id === changeId);
  const { snap } = change;

  db.players.push(clone(snap.player));
  if (change.kind === "merge") {
    // Take back exactly the picks that moved across.
    const moved = new Set(snap.moved);
    db.picks = db.picks.filter(x => !(x.player_id === change.target_id && moved.has(x.bet_id)));
  }
  db.picks.push(...clone(snap.picks));
  snap.payments.forEach(p => {
    const i = db.payments.findIndex(x => x.id === p.id);
    if (i >= 0) db.payments[i] = clone(p);
  });
  snap.flags.forEach(f => {
    const i = db.flags.findIndex(x => x.id === f.id);
    if (i >= 0) db.flags[i] = clone(f);
  });
  change.undone_at = now();
}

export async function fetchRosterChanges() {
  await wait();
  return db.changes.filter(c => !c.undone_at).sort(newestFirst).slice(0, 20)
    .map(({ snap, ...rest }) => clone(rest));
}

export async function reassignPick(betId, fromId, toId) {
  await wait();
  const pick = db.picks.find(x => x.bet_id === betId && x.player_id === fromId);
  if (pick) pick.player_id = toId;
}

/* --- realtime ------------------------------------------------------------ */

export function watchRoom(onChange, onStatus) {
  listener = onChange;
  setTimeout(() => onStatus(true), 300);
  return { unsubscribe() {} };
}
