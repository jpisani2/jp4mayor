/* The call-a-bet sheet. Owns its own draft; commits through the store. */

import { state, stake, proposeBet, openProposeSheet, setError, isBusy,
         holdRender } from "../store.js";
import { esc, money, withTeams } from "../format.js";
import { riskA, riskB, oneOnOne } from "../scoring.js";

let draft;

export function reset() {
  draft = {
    tab: "list", category: null, search: "", chosen: null,
    pct: 50, even: false,
    custom: { body: "", a: "", b: "", pct: 50, even: false },
  };
}
reset();

/* Probability currently selected, whichever tab is showing. */
function probability() {
  if (draft.chosen) return draft.even ? 0.5 : draft.pct / 100;
  return draft.custom.even ? 0.5 : draft.custom.pct / 100;
}

export function view() {
  const categories = [...new Set(state.catalog.map(c => c.category))];
  if (!draft.category) draft.category = categories[0];

  return `<div class="sheet" id="sheet"><div class="sheetbody" data-keep-scroll="propose">
    <div class="sheettop">
      <strong>Call a bet</strong>
      <button class="btn sm" id="closesheet">Close</button>
    </div>
    ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
    ${draft.chosen ? chosenView() : draft.tab === "list" ? listView(categories) : customView()}
  </div></div>`;
}

function evenToggle(on, id) {
  return `<div class="toggle">
    <div><div>Even money</div>
      <div class="s">Drop the odds — both sides risk ${money(stake())}.</div></div>
    <button class="sw" id="${id}" data-on="${on ? 1 : 0}" role="switch"
            aria-checked="${Boolean(on)}" aria-label="Even money"></button>
  </div>`;
}

/* Nobody has picked yet, so what each side wins is the one-on-one figure. */
function riskLine(p, labelA, labelB) {
  const s = stake();
  return `Risk ${money(riskA(p, s))} to take ${esc(labelA)}
    (wins ${money(oneOnOne("A", p, s))} one-on-one) ·
    ${money(riskB(p, s))} to take ${esc(labelB)}
    (wins ${money(oneOnOne("B", p, s))} one-on-one)`;
}

function listView(categories) {
  const term = draft.search.trim().toLowerCase();
  const rows = state.catalog.filter(c => term
    ? withTeams(c.body, state.game).toLowerCase().includes(term)
    : c.category === draft.category).slice(0, 40);

  return `
    <div class="tabs">
      <button class="tab" data-on="1">From the list</button>
      <button class="tab" data-on="0" id="tocustom">Write your own</button>
    </div>
    <input class="field" id="search" placeholder="Search ${state.catalog.length} bets"
           value="${esc(draft.search)}" autocomplete="off">
    ${draft.search ? "" : `<div class="chips" data-keep-scroll="chips">${categories.map(c =>
      `<button class="gchip" data-on="${c === draft.category ? 1 : 0}"
               data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>`}
    ${rows.length ? rows.map(c => `<button class="pick" data-choose="${c.id}">
      ${esc(withTeams(c.body, state.game))}
      <div class="meta num">${esc(withTeams(c.side_a, state.game))} ${Math.round(c.p * 100)}% ·
        risk ${money(riskA(c.p, stake()))} / ${money(riskB(c.p, stake()))}</div>
    </button>`).join("") : `<div class="empty">Nothing matches that.</div>`}`;
}

function oddsLabel(labelA, pct, base) {
  const changed = pct !== base;
  return `Chance ${esc(labelA)} happens:
    <span class="${changed ? "edited" : ""}">${pct}%</span>
    ${changed ? `<span class="edited"> — changed from ${base}%</span>` : ""}`;
}

function chosenView() {
  const c = draft.chosen;
  const labelA = withTeams(c.side_a, state.game);
  const labelB = withTeams(c.side_b, state.game);
  const base = Math.round(c.p * 100);
  const changed = draft.pct !== base;
  const busy = isBusy("post");

  return `
    <div class="grp">${esc(c.category)}</div>
    <div class="sheetq">${esc(withTeams(c.body, state.game))}</div>
    ${evenToggle(draft.even, "even")}
    ${draft.even ? "" : `
      <label class="flabel" id="pctlabel">${oddsLabel(labelA, draft.pct, base)}</label>
      <input type="range" min="1" max="99" value="${draft.pct}" id="pct"
             style="accent-color:${changed ? "var(--edit)" : "var(--a)"}">`}
    <div class="riskline num" id="riskline">${riskLine(probability(), labelA, labelB)}</div>
    <div class="twoup">
      <button class="btn primary" data-post="A" ${busy ? "disabled" : ""}>Post, I'm on ${esc(labelA)}</button>
      <button class="btn primary" data-post="B" ${busy ? "disabled" : ""}>Post, I'm on ${esc(labelB)}</button>
    </div>
    <button class="linkish backlink" id="back">back to the list</button>`;
}

function customView() {
  const labelA = draft.custom.a || "A";
  const labelB = draft.custom.b || "B";
  const busy = isBusy("post");

  return `
    <div class="tabs">
      <button class="tab" data-on="0" id="tolist">From the list</button>
      <button class="tab" data-on="1">Write your own</button>
    </div>
    <label class="flabel">The bet</label>
    <input class="field" id="cbody" value="${esc(draft.custom.body)}"
           placeholder="Does Thacker finish the wings before the punt" autocomplete="off">
    <div class="twoup">
      <div><label class="flabel">Side A</label>
        <input class="field" id="ca" value="${esc(draft.custom.a)}" placeholder="Yes" autocomplete="off"></div>
      <div><label class="flabel">Side B</label>
        <input class="field" id="cb" value="${esc(draft.custom.b)}" placeholder="No" autocomplete="off"></div>
    </div>
    ${evenToggle(draft.custom.even, "ceven")}
    ${draft.custom.even ? "" : `
      <label class="flabel" id="cpctlabel">Chance Side A happens: ${draft.custom.pct}%</label>
      <input type="range" min="1" max="99" value="${draft.custom.pct}" id="cpct">`}
    <div class="riskline num" id="riskline">${riskLine(probability(), labelA, labelB)}</div>
    <div class="twoup">
      <button class="btn" data-cpost="A" ${busy ? "disabled" : ""}>Post, I'm on ${esc(labelA)}</button>
      <button class="btn" data-cpost="B" ${busy ? "disabled" : ""}>Post, I'm on ${esc(labelB)}</button>
    </div>`;
}

/* A slider updates only the numbers beside it while it's being dragged —
   rebuilding the sheet under a finger cancels the drag on phones — and the
   sheet redraws once, on release. Other people's updates wait too. */
function wireSlider(el, onMove, redraw) {
  el.addEventListener("pointerdown", () => holdRender(true));
  el.addEventListener("touchstart", () => holdRender(true), { passive: true });
  el.oninput = () => { holdRender(true); onMove(+el.value); };
  el.onchange = () => { onMove(+el.value); holdRender(false); redraw(); };
}

export function wire(root) {
  const $ = sel => root.querySelector(sel);
  const redraw = () => openProposeSheet(true);   // state unchanged, forces a render

  $("#sheet").onclick = e => { if (e.target.id === "sheet") openProposeSheet(false); };
  $("#closesheet").onclick = () => openProposeSheet(false);

  if ($("#tocustom")) $("#tocustom").onclick = () => { draft.tab = "custom"; redraw(); };
  if ($("#tolist")) $("#tolist").onclick = () => { draft.tab = "list"; redraw(); };
  if ($("#back")) $("#back").onclick = () => { draft.chosen = null; redraw(); };

  const search = $("#search");
  if (search) search.oninput = () => {
    if (draft.search === search.value) return;
    draft.search = search.value;
    redraw();
  };

  root.querySelectorAll("[data-cat]").forEach(el => {
    el.onclick = () => { draft.category = el.dataset.cat; redraw(); };
  });

  root.querySelectorAll("[data-choose]").forEach(el => {
    el.onclick = () => {
      const c = state.catalog.find(x => String(x.id) === el.dataset.choose);
      draft.chosen = c;
      draft.pct = Math.round(c.p * 100);
      draft.even = false;
      redraw();
    };
  });

  if ($("#even")) $("#even").onclick = () => { draft.even = !draft.even; redraw(); };
  if ($("#ceven")) $("#ceven").onclick = () => {
    draft.custom.even = !draft.custom.even; redraw();
  };

  if ($("#pct")) {
    const c = draft.chosen;
    const labelA = withTeams(c.side_a, state.game), labelB = withTeams(c.side_b, state.game);
    const base = Math.round(c.p * 100);
    wireSlider($("#pct"), v => {
      draft.pct = v;
      $("#pctlabel").innerHTML = oddsLabel(labelA, v, base);
      $("#pct").style.accentColor = v !== base ? "var(--edit)" : "var(--a)";
      $("#riskline").innerHTML = riskLine(probability(), labelA, labelB);
    }, redraw);
  }
  if ($("#cpct")) {
    wireSlider($("#cpct"), v => {
      draft.custom.pct = v;
      $("#cpctlabel").textContent = `Chance Side A happens: ${v}%`;
      $("#riskline").innerHTML = riskLine(probability(),
        draft.custom.a || "A", draft.custom.b || "B");
    }, redraw);
  }

  [["#cbody", "body"], ["#ca", "a"], ["#cb", "b"]].forEach(([sel, key]) => {
    const el = $(sel);
    if (el) el.oninput = () => { draft.custom[key] = el.value; };
  });

  root.querySelectorAll("[data-post]").forEach(el => {
    el.onclick = () => {
      const c = draft.chosen;
      proposeBet({
        category: c.category,
        body: withTeams(c.body, state.game),
        side_a: withTeams(c.side_a, state.game),
        side_b: withTeams(c.side_b, state.game),
        p: probability(),
        odds_edited: draft.even || draft.pct !== Math.round(c.p * 100),
        even_money: draft.even,
      }, el.dataset.post);
    };
  });

  root.querySelectorAll("[data-cpost]").forEach(el => {
    el.onclick = () => {
      const c = draft.custom;
      if (!c.body.trim() || !c.a.trim() || !c.b.trim()) {
        return setError("A custom bet needs a question and two sides.");
      }
      proposeBet({
        category: "Custom", body: c.body.trim(),
        side_a: c.a.trim(), side_b: c.b.trim(),
        p: probability(), odds_edited: false, even_money: c.even,
      }, el.dataset.cpost);
    };
  });
}
