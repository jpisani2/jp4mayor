/* The grade buttons on a locked bet, used by the board, the big screen and
   close-out. Tapping a result doesn't grade it: the row turns into "Grade as
   Over hit? Amy +$2.40 · Bob −$2.40 · Confirm · Cancel", so a mis-tap at a
   crowded table costs nothing. The pending answer lives in the store, so a
   pick landing elsewhere doesn't wipe it. */

import { state, stake, nameOf, isBusy, askGrade, cancelGrade, grade } from "../store.js";
import { esc, money } from "../format.js";
import { settle, canLock, effectiveResult } from "../scoring.js";

const label = (bet, result) =>
  result === "A" ? `${bet.side_a} hit` : result === "B" ? `${bet.side_b} hit`
  : result === "PUSH" ? "a push" : "void";

const signed = n => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + money(Math.abs(n));
const tone = n => n > 0.005 ? "up" : n < -0.005 ? "down" : "";

/* Who wins and loses what if this bet grades this way. */
export function effect(bet, result, s) {
  if (result === "PUSH" || result === "VOID" || !canLock(bet)) {
    return `<span class="hint">everyone gets their risk back</span>`;
  }
  return Object.entries(settle(bet, s, result))
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `<span class="${tone(n)}">${esc(nameOf(id))} ${signed(n)}</span>`)
    .join(" · ");
}

/* How a graded bet's result reads, including the one-sided safety net. */
export function resultLabel(bet) {
  const r = effectiveResult(bet);
  if (r !== bet.result) return "Void — nobody was on the other side";
  return r === "A" ? bet.side_a : r === "B" ? bet.side_b : r === "PUSH" ? "Push" : "Void";
}

export function gradeRow(bet, { voidLabel = "Void", extraClass = "" } = {}) {
  const pending = state.confirmGrade?.betId === bet.id ? state.confirmGrade.result : null;
  const busy = isBusy(`grade:${bet.id}`);

  if (pending) {
    return `<div class="gconfirm">
      <div class="gcq">Grade as <b>${esc(label(bet, pending))}</b>?</div>
      <div class="gce num">${effect(bet, pending, stake())}</div>
      <div class="rowbtns">
        <button class="btn primary" data-confirmgrade="${bet.id}" data-result="${pending}"
          ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Confirm"}</button>
        <button class="btn" data-cancelgrade="1">Cancel</button>
      </div>
    </div>`;
  }

  return `<div class="grades ${extraClass}">
    <button class="gbtn" data-k="A" data-askgrade="${bet.id}" data-result="A">${esc(bet.side_a)} hit</button>
    <button class="gbtn" data-k="B" data-askgrade="${bet.id}" data-result="B">${esc(bet.side_b)} hit</button>
    <button class="gbtn" data-askgrade="${bet.id}" data-result="PUSH">Push</button>
    <button class="gbtn" data-askgrade="${bet.id}" data-result="VOID">${esc(voidLabel)}</button>
  </div>`;
}

export function wire(root) {
  root.querySelectorAll("[data-askgrade]").forEach(el => {
    el.onclick = () => askGrade(el.dataset.askgrade, el.dataset.result);
  });
  root.querySelectorAll("[data-confirmgrade]").forEach(el => {
    el.onclick = () => grade(el.dataset.confirmgrade, el.dataset.result);
  });
  root.querySelectorAll("[data-cancelgrade]").forEach(el => {
    el.onclick = () => cancelGrade();
  });
}
