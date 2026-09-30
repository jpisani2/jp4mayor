/* ===========================================================================
   Every call to Supabase lives here. No screen may import the client or
   write a query. If data comes from the database, it comes through a named
   function in this file.

   The multi-step jobs (posting a bet, setting up a game, kickoff, locking,
   the guarded deletes) run inside the database as one all-or-nothing step
   when the functions from sql/2026-09-safeguards.sql are installed. Until
   they are, each falls back to doing the same thing from here, re-reading
   first so it acts on the freshest data it can.
   =========================================================================== */

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export const configured = () =>
  Boolean(SUPABASE_KEY) && !SUPABASE_KEY.startsWith("PASTE_");

/* Calls a database function. Returns MISSING if it isn't installed, so the
   caller can fall back; any other failure throws as usual. Once a function
   is known to be missing it isn't asked for again until the page reloads. */
const MISSING = Symbol("missing");
const absent = new Set();

async function rpc(name, args) {
  if (absent.has(name)) return MISSING;
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      absent.add(name);
      return MISSING;
    }
    throw error;
  }
  return data;
}

const bothSides = bet =>
  bet.picks.some(p => p.side === "A") && bet.picks.some(p => p.side === "B");

const shapeBet = b => ({ ...b, p: Number(b.p), picks: b.picks ?? [] });

/* --- reads --------------------------------------------------------------- */

export async function fetchOpenGame() {
  const { data, error } = await client.from("games").select("*")
    .neq("phase", "closed")
    .order("kickoff_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchPlayers() {
  const { data, error } = await client.from("players").select("*")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function fetchCatalog() {
  const { data, error } = await client.from("bet_catalog").select("*")
    .eq("retired", false).order("id");
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row, p: Number(row.p) }));
}

/* Who has opened the app for this game. Returns null instead of throwing if
   the table can't be read, so the board falls back to the whole roster
   rather than breaking. */
export async function fetchAttendance(gameId) {
  if (!gameId) return [];
  const { data, error } = await client.from("attendance").select("player_id")
    .eq("game_id", gameId);
  if (error) return null;
  return (data ?? []).map(row => row.player_id);
}

export async function fetchBets(gameId) {
  if (!gameId) return [];
  const { data, error } = await client.from("bets")
    .select("*, picks(player_id, side, auto)")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(shapeBet);
}

/* One bet, straight from the database, for the checks made just before
   acting on it. Null if it's gone. */
export async function fetchBet(betId) {
  const { data, error } = await client.from("bets")
    .select("*, picks(player_id, side, auto)")
    .eq("id", betId).maybeSingle();
  if (error) throw error;
  return data ? shapeBet(data) : null;
}

/* Random bets the big screen threw since a moment in time, oldest first. */
export async function fetchHouseBetsSince(gameId, sinceIso) {
  const { data, error } = await client.from("bets").select("id, created_at")
    .eq("game_id", gameId).is("proposer_id", null).eq("is_pregame", false)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* --- writes -------------------------------------------------------------- */

export async function verifyRoomPassword(pw) {
  const { data, error } = await client.rpc("check_room_password", { pw });
  if (error) throw error;
  return Boolean(data);
}

export async function createPlayer(name) {
  const { data, error } = await client.from("players")
    .insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data;
}

export async function rememberDevice(token, playerId) {
  const { error } = await client.from("devices").upsert({
    token, player_id: playerId, last_seen: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function markPresent(gameId, playerId) {
  if (!gameId) return;
  await client.from("attendance").upsert(
    { game_id: gameId, player_id: playerId },
    { onConflict: "game_id,player_id", ignoreDuplicates: true });
}

/* The bet and the caller's own pick land together or not at all. */
export async function createBet(bet, proposerId, side) {
  const id = await rpc("post_bet", { bet: { ...bet, proposer_id: proposerId }, side });
  if (id !== MISSING) return id;

  const { data, error } = await client.from("bets")
    .insert({ ...bet, proposer_id: proposerId }).select().single();
  if (error) throw error;
  const pick = await client.from("picks")
    .insert({ bet_id: data.id, player_id: proposerId, side });
  if (pick.error) {
    await client.from("bets").delete().eq("id", data.id);   // don't leave it half-posted
    throw pick.error;
  }
  return data.id;
}

/* A bet thrown out by the big screen. Nobody proposed it, so it starts with
   no proposer and no pick — players take whichever sides they like. */
export async function createHouseBet(bet) {
  const { data, error } = await client.from("bets")
    .insert({ ...bet, proposer_id: null }).select().single();
  if (error) throw error;
  return data;
}

export async function savePick(betId, playerId, side) {
  const { error } = await client.from("picks").upsert(
    { bet_id: betId, player_id: playerId, side, auto: false,
      updated_at: new Date().toISOString() },
    { onConflict: "bet_id,player_id" });
  if (error) throw error;
}

/* Everyone still in the room who never answered is marked out, flagged auto
   so it does not count as activity for dormancy. A real pick that landed a
   split second earlier always wins: an out is only added where there's no
   pick at all. */
async function autoOut(betId, playerIds) {
  if (!playerIds.length) return;
  const { error } = await client.from("picks").upsert(
    playerIds.map(id => ({ bet_id: betId, player_id: id, side: "OUT", auto: true })),
    { onConflict: "bet_id,player_id", ignoreDuplicates: true });
  if (error) throw error;
}

/* Lock one bet. Re-checks it first, so a bet somebody just emptied a side
   of can't slip through. Returns "locked", "one_sided" or "not_open" (it was
   already locked, graded or pulled — nothing to do). */
export async function lockBetChecked(betId, presentIds) {
  const r = await rpc("lock_bet", { b: betId, present: presentIds });
  if (r !== MISSING) return r;

  const bet = await fetchBet(betId);
  if (!bet || bet.status !== "open") return "not_open";
  if (!bothSides(bet)) return "one_sided";
  await autoOut(betId, presentIds.filter(id => !bet.picks.some(p => p.player_id === id)));
  const { error } = await client.from("bets")
    .update({ status: "locked", locked_at: new Date().toISOString() })
    .eq("id", betId).eq("status", "open");
  if (error) throw error;
  return "locked";
}

/* Grading, and re-grading a bet from a past game: same write either way. */
export async function gradeBet(betId, result) {
  const { error } = await client.from("bets")
    .update({ status: "graded", result, graded_at: new Date().toISOString() })
    .eq("id", betId);
  if (error) throw error;
}

export async function ungradeBet(betId) {
  const { error } = await client.from("bets")
    .update({ status: "locked", result: null, graded_at: null })
    .eq("id", betId);
  if (error) throw error;
}

export async function voidBets(ids) {
  if (!ids.length) return;
  const { error } = await client.from("bets")
    .update({ status: "graded", result: "VOID", graded_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

/* Delete an open bet, but only if nobody other than `keep` has picked it
   (pass null for a random bet, which nobody owns). True if it went. */
export async function deleteBetIfUnpicked(betId, keep) {
  const r = await rpc("delete_bet_if_unpicked", { b: betId, keep_player: keep });
  if (r !== MISSING) return Boolean(r);

  const bet = await fetchBet(betId);
  if (!bet) return true;
  if (bet.status !== "open") return false;
  if (bet.picks.some(p => p.player_id !== keep)) return false;
  const { error } = await client.from("bets").delete().eq("id", betId);
  if (error) throw error;
  return true;
}

export async function verifyAdminPin(pin) {
  const { data, error } = await client.rpc("check_admin_pin", { pin });
  if (error) throw error;
  return Boolean(data);
}

/* The game and its pregame board land together. The database only allows
   one open game, so a second set-up fails rather than hiding the first. */
export async function createGameWithBoard(fields, rows) {
  const id = await rpc("create_game_with_board", { game: fields, board: rows });
  if (id !== MISSING) return id;

  const { data, error } = await client.from("games").insert(fields).select().single();
  if (error) throw error;
  if (rows.length) {
    const { error: e2 } = await client.from("bets")
      .insert(rows.map(r => ({ ...r, game_id: data.id })));
    if (e2) {
      await client.from("games").delete().eq("id", data.id);
      throw e2;
    }
  }
  return data.id;
}

export async function setGamePhase(gameId, phase, stamp) {
  const patch = { phase };
  if (stamp) patch[stamp] = new Date().toISOString();
  const { error } = await client.from("games").update(patch).eq("id", gameId);
  if (error) throw error;
}

/* Kickoff: everything with action on both sides locks (unanswered players
   marked out), everything one-sided voids, and the game goes live. Works
   from a fresh read of the board, not whatever this screen last saw. */
export async function kickOff(gameId, presentIds) {
  const r = await rpc("kick_off", { g: gameId, present: presentIds });
  if (r !== MISSING) return r;

  const open = (await fetchBets(gameId)).filter(b => b.is_pregame && b.status === "open");
  const lockable = open.filter(bothSides), dead = open.filter(b => !bothSides(b));
  for (const bet of lockable) {
    await autoOut(bet.id, presentIds.filter(id => !bet.picks.some(p => p.player_id === id)));
  }
  if (lockable.length) {
    const { error } = await client.from("bets")
      .update({ status: "locked", locked_at: new Date().toISOString() })
      .in("id", lockable.map(b => b.id)).eq("status", "open");
    if (error) throw error;
  }
  await voidBets(dead.map(b => b.id));
  await setGamePhase(gameId, "live", "kicked_off_at");
  return { locked: lockable.length, voided: dead.length };
}

/* Deletes a game and everything in it — but only while no bet has a real
   grade. True if it went, false if a grade got there first. */
export async function deleteGameIfUngraded(gameId) {
  const r = await rpc("delete_game_if_ungraded", { g: gameId });
  if (r !== MISSING) return Boolean(r);

  const bets = await fetchBets(gameId);
  if (bets.some(b => b.status === "graded" && b.result !== "VOID")) return false;
  const { error } = await client.from("games").delete().eq("id", gameId);
  if (error) throw error;
  return true;
}

/* --- history and money --------------------------------------------------- */

export async function fetchGames() {
  const { data, error } = await client.from("games").select("*")
    .order("kickoff_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* Every bet ever, for the stats and balance screens. A season is a few
   hundred rows, so one fetch beats paging. */
export async function fetchAllBets() {
  const { data, error } = await client.from("bets")
    .select("*, picks(player_id, side, auto)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(shapeBet);
}

export async function fetchPayments() {
  const { data, error } = await client.from("payments").select("*")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPayment(row) {
  const { error } = await client.from("payments").insert(row);
  if (error) throw error;
}

/* Voids stay visible in the log rather than disappearing. */
export async function voidPayment(id, byPlayerId) {
  const { error } = await client.from("payments")
    .update({ voided_at: new Date().toISOString(), voided_by: byPlayerId })
    .eq("id", id);
  if (error) throw error;
}

/* --- roster -------------------------------------------------------------- */

export async function fetchFlags() {
  const { data, error } = await client.from("name_flags").select("*")
    .is("resolved_at", null).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function raiseFlag(playerId, similarTo, reason) {
  const { error } = await client.from("name_flags")
    .insert({ player_id: playerId, similar_to: similarTo, reason });
  if (error) throw error;
}

export async function clearFlag(id) {
  const { error } = await client.from("name_flags")
    .update({ resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function renamePlayer(id, name) {
  const { error } = await client.from("players").update({ name }).eq("id", id);
  if (error) throw error;
}

/* Merges and deletes run as one transaction in the database — half a merge
   would be worse than none. */
export async function mergePlayers(source, target) {
  const { error } = await client.rpc("merge_players", { source, target });
  if (error) throw error;
}

export async function removePlayer(victim) {
  const { error } = await client.rpc("delete_player", { victim });
  if (error) throw error;
}

export async function undoRosterChange(change) {
  const { error } = await client.rpc("undo_roster_change", { change });
  if (error) throw error;
}

export async function fetchRosterChanges() {
  const { data, error } = await client.from("roster_changes").select("*")
    .is("undone_at", null).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}

/* For when someone taps in on the wrong phone. */
export async function reassignPick(betId, fromId, toId) {
  const { error } = await client.from("picks")
    .update({ player_id: toId }).eq("bet_id", betId).eq("player_id", fromId);
  if (error) throw error;
}

/* --- realtime ------------------------------------------------------------ */

/* Any change to bets, picks, games or payments just refetches. At six
   players and ten bets that costs less than reconciling state by hand, and
   cannot drift. */
export function watchRoom(onChange, onStatus) {
  const ch = client.channel("room");
  ["bets", "picks", "games", "payments"].forEach(table =>
    ch.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  return ch.subscribe(status => onStatus(status === "SUBSCRIBED"));
}
