/* ===========================================================================
   Settling up: balances, rounding, and who hands what to whom.

   Two ledgers. The bets ledger is what happened; the payments ledger is cash
   that actually moved. Balance is one minus the other, which mirrors the
   `balances` view in the database. Nothing is stored as a total, so paying
   someone changes what they owe and never touches their record.

   Everything is tracked to the cent. Rounding happens once, here, for the
   settle-up screens only. This is the only file that works out balances —
   the settle, midweek and big screens all ask it.
   =========================================================================== */

import { rollUp } from "./scoring.js";

/* Under a dollar either way carries over to next week rather than asking
   anyone to hand over a single dollar for a few cents. */
export const CARRY_UNDER = 1;
const CENT = 0.005;

export const isSquare = row => Math.abs(row.exact) < CARRY_UNDER;
export const carries = row => isSquare(row) && Math.abs(row.exact) >= CENT;

/* Balances across every game. The stake lives on the game, so each game
   settles on its own stake and the results are summed; then payments come
   off. Positive means owed money, negative means owes it. */
export function balancesAcrossGames(games, bets, payments, players) {
  const running = new Map();
  games.forEach(g => {
    const mine = bets.filter(b => b.game_id === g.id);
    const totals = rollUp(mine, players, Number(g.base_stake));
    players.forEach(p => {
      running.set(p.id, (running.get(p.id) ?? 0) + (totals[p.id]?.net ?? 0));
    });
  });

  const live = payments.filter(p => !p.voided_at);
  return players.map(p => {
    const received = live.filter(x => x.payee_id === p.id)
      .reduce((s, x) => s + Number(x.amount), 0);
    const paid = live.filter(x => x.payer_id === p.id)
      .reduce((s, x) => s + Number(x.amount), 0);
    return { id: p.id, name: p.name, exact: (running.get(p.id) ?? 0) - received + paid };
  });
}

/* Round against yourself. Whoever owes a dollar or more rounds up to the
   next whole dollar. Those dollars are then shared out one at a time to
   whoever is still owed the most — so the few extra dollars that rounding
   up creates go to the people who'd otherwise lose the most by rounding
   down, and nobody ends up more than a few cents over. Anyone under a
   dollar either way carries over.

   Each row gains `whole`: whole dollars to hand over (negative) or receive
   (positive), and `carry`: true when a balance under $1 is riding over. */
export function roundAgainstYourself(rows) {
  const out = rows.map(r => ({ ...r, whole: 0, carry: false }));
  const up = x => Math.ceil(x - 1e-9);

  const payers = out.filter(r => r.exact <= -CARRY_UNDER);
  payers.forEach(r => { r.whole = -up(-r.exact); });
  let purse = payers.reduce((s, r) => s - r.whole, 0);

  // Small debts normally carry over. But if the people owed $1 or more can't
  // otherwise be covered — two people owing 80¢ each to someone owed $1.60 —
  // the small debtors chip in a dollar each, biggest debt first, until they
  // can be.
  const owed = out.filter(r => r.exact >= CENT);
  const need = owed.filter(r => r.exact >= CARRY_UNDER)
    .reduce((s, r) => s + Math.floor(r.exact + 1e-9), 0);
  const small = out.filter(r => r.exact <= -CENT && r.exact > -CARRY_UNDER)
    .sort((a, b) => a.exact - b.exact);
  for (const r of small) {
    if (purse >= need) break;
    r.whole = -1;
    payers.push(r);
    purse += 1;
  }

  // Nobody should be handed a whole dollar more than they're owed. With many
  // people owing and few owed, rounding everyone up could do that — so the
  // payer who rounded up the most hands over a dollar less instead, and their
  // few cents carry over like any other balance under $1.
  const room = owed.reduce((s, r) => s + up(r.exact), 0);
  const over = r => r.exact - r.whole;          // for a payer: how far they rounded up
  while (purse > room) {
    const p = payers.reduce((a, b) => over(b) > over(a) ? b : a);
    p.whole += 1;
    purse -= 1;
  }

  // Share the dollars out one at a time to whoever is still owed the most.
  while (purse > 0) {
    const open = owed.filter(r => r.whole < up(r.exact));
    if (!open.length) break;
    const next = open.reduce((a, b) => (b.exact - b.whole) > (a.exact - a.whole) ? b : a);
    next.whole += 1;
    purse -= 1;
  }

  out.forEach(r => { r.carry = r.whole === 0 && Math.abs(r.exact) >= CENT; });
  return out;
}

/* Fewest handoffs that clear the rounded amounts: match the largest payer
   to the largest receiver, repeat. */
export function suggestTransfers(rows) {
  const payers = rows.filter(r => r.whole < 0)
    .map(r => ({ ...r, left: -r.whole })).sort((a, b) => b.left - a.left);
  const getters = rows.filter(r => r.whole > 0)
    .map(r => ({ ...r, left: r.whole })).sort((a, b) => b.left - a.left);

  const transfers = [];
  let gi = 0;
  for (const payer of payers) {
    while (payer.left > 0 && gi < getters.length) {
      const getter = getters[gi];
      const amount = Math.min(payer.left, getter.left);
      transfers.push({ from: payer.id, fromName: payer.name,
                       to: getter.id, toName: getter.name, amount });
      payer.left -= amount;
      getter.left -= amount;
      if (getter.left === 0) gi += 1;
    }
  }
  return transfers;
}

/* Someone leaving early rounds their debt up to the next whole dollar. Then:
     1. skip anyone owed under a dollar
     2. everyone else gets $1, highest owed first if it won't stretch
     3. whatever is left pays down whoever is owed most, repeatedly — which
        levels the remaining balances rather than clearing one person
   If everyone is paid off before the purse runs out, the leaver simply hands
   over less. `total` is what they actually hand over and `after` is where
   they stand afterwards (under $1 carries over). */
export function leaverPlan(leaver, rows) {
  const owes = Math.abs(Math.min(0, leaver.exact));
  let purse = Math.ceil(owes - 1e-9);

  const creditors = rows
    .filter(r => r.id !== leaver.id && r.exact >= 1)
    .map(r => ({ id: r.id, name: r.name, owed: r.exact, paid: 0 }))
    .sort((a, b) => b.owed - a.owed);

  const left = c => c.owed - c.paid;

  // Step 2 — a dollar each, biggest creditor first if it runs short.
  for (const c of creditors) {
    if (purse < 1) break;
    c.paid += 1;
    purse -= 1;
  }

  // Step 3 — keep paying whoever is currently owed most, while anyone is.
  while (purse >= 1 && creditors.some(c => left(c) > CENT)) {
    creditors.sort((a, b) => left(b) - left(a));
    const [top, next] = creditors;
    const gap = next ? left(top) - left(next) : left(top);
    const give = Math.min(purse, Math.max(1, Math.floor(gap)));
    top.paid += give;
    purse -= give;
  }

  const payments = creditors.filter(c => c.paid > 0)
    .map(c => ({ to: c.id, toName: c.name, amount: c.paid }))
    .sort((a, b) => b.amount - a.amount);
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return {
    total,
    after: leaver.exact + total,
    payments,
    remaining: creditors.map(c => ({ ...c, left: left(c) })),
  };
}
