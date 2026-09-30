/* Settling up.

   The transfer list is a suggestion, never an instruction — somebody always
   has two twenties and no fives. The payments log is what's real, so the
   screen says so and puts logging a payment right underneath. */

import { state, goto, home, isBusy, logPayment, undoPayment } from "../store.js";
import { esc, money } from "../format.js";
import { balancesAcrossGames, roundAgainstYourself, suggestTransfers, leaverPlan,
         CARRY_UNDER } from "../ledger.js";

let form = { payer: "", payee: "", amount: "", note: "" };
let leaving = "";
let confirmVoid = null;

export function reset() {
  form = { payer: state.me ?? "", payee: "", amount: "", note: "" };
  leaving = "";
  confirmVoid = null;
}

const nameOf = id => state.players.find(p => p.id === id)?.name ?? "—";

export function view() {
  if (!state.history.loaded) return `<div class="center"><p>Working it out…</p></div>`;

  const { games, bets, payments } = state.history;
  const rows = balancesAcrossGames(games, bets, payments, state.players);
  const rounded = roundAgainstYourself(rows);
  const transfers = suggestTransfers(rounded);
  const square = transfers.length === 0;
  const leaver = leaving ? rows.find(r => r.id === leaving) : null;
  const plan = leaver ? leaverPlan(leaver, rows) : null;
  const carried = rounded.filter(r => r.carry);

  return `<div class="page">
    <header class="head">
      <div>
        <h1 class="cond">Settling up</h1>
        <div class="sub">Round against yourself: whoever owes rounds up, and the
          extra dollars go to whoever is still owed most. Under
          ${money(CARRY_UNDER)} carries over to next week.
          ${state.history.refreshing ? `<span class="updating">updating…</span>` : ""}</div>
      </div>
      <button class="btn sm" id="back">Back</button>
    </header>

    ${state.notice ? `<div class="banner">${esc(state.notice)}</div>` : ""}
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}

    ${square && !leaver ? `<div class="empty">Everyone is square${
        carried.length ? " — anything under $1 carries over" : ""}.</div>` : `
      <div class="sechead"><span>${leaver ? "If they leave now" : "Fewest handoffs"}</span><span class="rule"></span></div>
      ${leaver ? leaverView(leaver, plan) : transfers.map(t => `
        <div class="transfer">
          <span class="tnames">${esc(t.fromName)} <span class="arrow">→</span> ${esc(t.toName)}</span>
          <span class="tamount cond num">$${t.amount}</span>
        </div>`).join("")}
      <div class="hint" style="margin-top:10px">
        Suggested — log what actually gets paid.
      </div>`}

    <div class="sechead"><span>Balances</span><span class="rule"></span></div>
    <table class="board num">
      <thead><tr><th>Player</th><th>Exact</th><th>Hand over / get</th><th></th></tr></thead>
      <tbody>${rounded.map(r => `<tr>
        <td class="${r.id === state.me ? "you" : ""}">${esc(r.name)}</td>
        <td class="${tone(r.exact)}">${money(r.exact)}</td>
        <td class="${tone(r.whole)}">${r.whole !== 0 ? "$" + Math.abs(r.whole)
          : r.carry ? `<span class="hint">carries over</span>` : "—"}</td>
        <td>${r.exact <= -CARRY_UNDER
          ? `<button class="linkish" data-leaving="${r.id}">${
              leaving === r.id ? "never mind" : "leaving early"}</button>`
          : ""}</td>
      </tr>`).join("")}</tbody>
    </table>

    <div class="sechead"><span>Log a payment</span><span class="rule"></span></div>
    <div class="payform">
      ${who("payer", "Who paid")}
      ${who("payee", "Who got it")}
      <div><label class="flabel">Amount</label>
        <input class="field num" id="amount" inputmode="decimal" value="${esc(form.amount)}"
               placeholder="0.00" autocomplete="off"></div>
      <div><label class="flabel">Note (optional)</label>
        <input class="field" id="note" value="${esc(form.note)}" placeholder="" autocomplete="off"></div>
    </div>
    <div class="rowbtns">
      <button class="btn primary" id="logpay" ${canLog() ? "" : "disabled"}>${
        isBusy("logpay") ? "Logging…" : "Log it"}</button>
    </div>

    ${paymentLog()}
  </div>`;
}

const canLog = () => !isBusy("logpay") && form.payer && form.payee &&
  Number(form.amount) > 0 && form.payer !== form.payee;

function who(key, label) {
  return `<div><label class="flabel">${label}</label>
    <select class="field" id="${key}">
      <option value="">—</option>
      ${state.players.map(p => `<option value="${p.id}"
        ${form[key] === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
    </select></div>`;
}

function leaverView(leaver, plan) {
  const after = plan.after;
  return `
    <div class="hint" style="margin-bottom:12px">
      ${esc(leaver.name)} owes ${money(Math.abs(leaver.exact))} and hands over
      <b>$${plan.total}</b>. Everyone owed at least a dollar gets one, then the
      rest pays down whoever is owed most until it runs out.
    </div>
    ${plan.payments.map(p => `<div class="transfer">
      <span class="tnames">${esc(leaver.name)} <span class="arrow">→</span> ${esc(p.toName)}</span>
      <span class="tamount cond num">$${p.amount}</span>
    </div>`).join("")}
    <div class="hint" style="margin-top:10px">
      Leaves ${plan.remaining.filter(r => r.left > 0.005)
        .map(r => `${esc(r.name)} at ${money(r.left)}`).join(", ") || "everyone else square"}.
      ${Math.abs(after) < 0.005 ? `${esc(leaver.name)} walks out at zero.`
        : `${esc(leaver.name)} walks out at ${money(after)}, which carries over.`}
    </div>`;
}

function paymentLog() {
  const { payments } = state.history;
  if (!payments.length) return "";

  return `<div class="sechead"><span>Payment log</span><span class="rule"></span></div>
    ${payments.slice(0, 30).map(p => {
      const asking = confirmVoid === p.id;
      const busy = isBusy(`voidpay:${p.id}`);
      return `<div class="logrow ${p.voided_at ? "voided" : ""}">
      <div>
        <div class="logline">${esc(nameOf(p.payer_id))} → ${esc(nameOf(p.payee_id))}
          <b class="num">${money(Number(p.amount))}</b></div>
        <div class="lognote">${new Date(p.paid_at).toLocaleDateString()} ·
          recorded by ${esc(nameOf(p.recorded_by))}${p.note ? " · " + esc(p.note) : ""}${
          p.voided_at ? ` · <span class="down">voided by ${esc(nameOf(p.voided_by))}</span>` : ""}</div>
        ${asking ? `<div class="warn" style="margin:8px 0 0">Void ${esc(nameOf(p.payer_id))} →
          ${esc(nameOf(p.payee_id))} ${money(Number(p.amount))}? It stays in the log,
          crossed out.</div>` : ""}
      </div>
      ${p.voided_at ? "" : asking
        ? `<div class="rowbtns" style="margin:0;flex-wrap:nowrap">
            <button class="btn sm danger" data-reallyvoid="${p.id}" ${busy ? "disabled" : ""}>Void</button>
            <button class="btn sm" data-keepvoid="1">Keep</button></div>`
        : `<button class="btn sm" data-void="${p.id}">Void</button>`}
    </div>`;
    }).join("")}`;
}

const tone = n => n > 0.005 ? "up" : n < -0.005 ? "down" : "";

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const redraw = () => goto("settle");

  if (!state.history.loaded) return;

  $("#back").onclick = () => goto(home());

  root.querySelectorAll("[data-leaving]").forEach(el => {
    el.onclick = () => {
      leaving = leaving === el.dataset.leaving ? "" : el.dataset.leaving;
      redraw();
    };
  });

  ["payer", "payee"].forEach(key => {
    const el = $(`#${key}`);
    el.onchange = () => { form[key] = el.value; redraw(); };
  });
  $("#amount").oninput = () => {
    const was = canLog();
    form.amount = $("#amount").value;
    if (canLog() !== was) $("#logpay").disabled = !canLog();
  };
  $("#note").oninput = () => { form.note = $("#note").value; };

  $("#logpay").onclick = () => {
    if (!canLog()) return;
    const { payer, payee, amount, note } = form;
    logPayment(payer, payee, amount, note, () => {
      form = { payer: state.me ?? "", payee: "", amount: "", note: "" };   // only once it's saved
    });
  };

  root.querySelectorAll("[data-void]").forEach(el => {
    el.onclick = () => { confirmVoid = el.dataset.void; redraw(); };
  });
  root.querySelectorAll("[data-reallyvoid]").forEach(el => {
    el.onclick = () => { confirmVoid = null; undoPayment(el.dataset.reallyvoid); };
  });
  if ($("[data-keepvoid]")) $("[data-keepvoid]").onclick = () => { confirmVoid = null; redraw(); };
}
