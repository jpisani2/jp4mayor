/* ===========================================================================
   The settlement math. Mirrors the SQL views exactly (see sql/).

   If a number ever looks wrong, there are two places to check and they must
   agree: the `settlements` view in the database and this file. Nothing else
   in the app may compute a payout.
   =========================================================================== */

export const riskA = (p, stake) => 2 * stake * p;
export const riskB = (p, stake) => 2 * stake * (1 - p);
export const riskFor = (side, p, stake) =>
  side === "A" ? riskA(p, stake) : side === "B" ? riskB(p, stake) : 0;

export const takers = (bet, side) =>
  bet.picks.filter(p => p.side === side).map(p => p.player_id);

export function pot(bet, stake) {
  return takers(bet, "A").length * riskA(bet.p, stake)
       + takers(bet, "B").length * riskB(bet.p, stake);
}

/* A bet needs action on both sides or it pays nobody. */
export const canLock = bet =>
  takers(bet, "A").length > 0 && takers(bet, "B").length > 0;

/* The result that actually counts. A graded bet with nobody on one side
   never had a bet in it, whatever was tapped, so it settles as a void —
   the same rule kickoff applies. Without this, the winners of a one-sided
   bet would be nobody and the losers' money would simply vanish. */
export function effectiveResult(bet) {
  if (bet.status !== "graded") return null;
  if (bet.result !== "VOID" && !canLock(bet)) return "VOID";
  return bet.result;
}

/* Voids leave no trace in anyone's record: not a bet, not a push, not money
   risked. Pushes were real bets that tied, so they still count. */
export const counts = bet =>
  bet.status === "graded" && effectiveResult(bet) !== "VOID";

/* What each player nets on one graded bet. Winners split the whole pot in
   proportion to what they risked; losers lose their risk; pushes and voids
   are zero. Always sums to zero. */
export function settle(bet, stake, result = effectiveResult(bet)) {
  const out = {};
  const A = takers(bet, "A"), B = takers(bet, "B");

  if (result === "PUSH" || result === "VOID" || !A.length || !B.length) {
    [...A, ...B].forEach(id => { out[id] = 0; });
    return out;
  }

  const rA = riskA(bet.p, stake), rB = riskB(bet.p, stake);
  const total = A.length * rA + B.length * rB;
  const share = total / (result === "A" ? A.length : B.length);

  A.forEach(id => { out[id] = result === "A" ? share - rA : -rA; });
  B.forEach(id => { out[id] = result === "B" ? share - rB : -rB; });
  return out;
}

/* What one player would net if a side hits, given who is currently in. */
export function ifThisHits(bet, side, stake) {
  const list = takers(bet, side);
  if (!list.length) return null;
  return pot(bet, stake) / list.length - riskFor(side, bet.p, stake);
}

/* What this player would net if they were on `side` and it hit, counting
   everyone already in. If they're on the other side now, they move. */
export function winIfJoined(bet, side, stake, playerId) {
  const moved = {
    ...bet,
    picks: [...bet.picks.filter(p => p.player_id !== playerId),
            { player_id: playerId, side }],
  };
  return ifThisHits(moved, side, stake);
}

/* One against one: what a side wins if exactly one person takes each side.
   Used where live counts are hidden (pregame) or nobody has picked yet. */
export const oneOnOne = (side, p, stake) => riskFor(side === "A" ? "B" : "A", p, stake);

/* What one player stands to lose on bets not yet graded: their side's risk
   on every locked bet, plus current picks on open bets (which can still
   change). Sitting out risks nothing. */
export function inPlay(bets, playerId, stake) {
  const out = { locked: 0, open: 0, total: 0 };
  bets.forEach(bet => {
    if (bet.status !== "locked" && bet.status !== "open") return;
    const side = bet.picks.find(p => p.player_id === playerId)?.side;
    out[bet.status] += riskFor(side, bet.p, stake);
  });
  out.total = out.locked + out.open;
  return out;
}

/* Headline numbers for one game, for the big screen. Wagered counts what
   was actually committed — locked and settled bets, voids excluded. In play
   is every pot still unresolved, open bets included. */
export function gameTotals(bets, stake) {
  const committed = bets.filter(b => b.status === "locked" || counts(b));
  const pots = committed.map(b => pot(b, stake));
  return {
    called: bets.length,
    wagered: pots.reduce((sum, v) => sum + v, 0),
    biggestPot: pots.length ? Math.max(...pots) : 0,
    inPlay: bets.filter(b => b.status === "open" || b.status === "locked")
      .reduce((sum, b) => sum + pot(b, stake), 0),
  };
}

/* Per-player totals across a set of graded bets. Voids are skipped
   entirely, so they don't pad anyone's bets, pushes or risked. */
export function rollUp(bets, players, stake) {
  const rows = {};
  players.forEach(p => {
    rows[p.id] = { net: 0, risked: 0, wins: 0, losses: 0, pushes: 0, bets: 0 };
  });

  bets.filter(counts).forEach(bet => {
    const result = effectiveResult(bet);
    const nets = settle(bet, stake, result);
    Object.entries(nets).forEach(([id, net]) => {
      const row = rows[id];
      if (!row) return;
      const side = bet.picks.find(p => p.player_id === id)?.side;
      row.net += net;
      row.bets += 1;
      row.risked += riskFor(side, bet.p, stake);
      if (result === "PUSH") row.pushes += 1;
      else if (result === side) row.wins += 1;
      else row.losses += 1;
    });
  });

  return rows;
}

/* Silent on the last N decided bets in a row. Only player-made picks count:
   an auto-out is the system's doing, so a quiet player is never revived by
   the mechanism that noticed they were quiet. */
export function isDormant(playerId, bets, after) {
  const decided = bets
    .filter(b => b.status !== "open")
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    .slice(0, after);
  if (decided.length < after) return false;
  return decided.every(b =>
    !b.picks.some(p => p.player_id === playerId && !p.auto));
}
