import * as store from "./store.js";
import { isOpenAt, statusText, weekText } from "./hours.js";
import {
  DEFAULT_WEIGHTS, summarize, filterPlaces, pick, rank, reasons, moodToOptions,
  wheelCandidates, todaySpecials, externalRating,
} from "./decide.js";
import { cuisineStyle, CRAVINGS, cravingByKey } from "./cuisine.js";
import { gridPosition, EW_ROADS, NS_ROADS, roadCol } from "./geo.js";

// ---- state -------------------------------------------------------------------
const S = {
  places: [], byId: new Map(), meta: {}, news: [],
  visits: [], prefs: new Map(), settings: {}, stats: new Map(),
  mode: lsGet("takeout.mode") || "any",          // any | dine_in | carry_out
  openNow: lsGet("takeout.open") !== "0",
  browse: { search: "", craving: "", maxPrice: "", fav: false, never: false, sort: "score", view: "list", sel: null },
  mood: { step: 0, answers: {} },
  tonight: lsJSON("takeout.tonight"),            // { id, date }
  wheelRot: 0, navCount: 0,
};
const app = document.getElementById("app");

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function lsJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }

// ---- helpers -----------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
const price = (p) => (p ? "$".repeat(p) : "");
const SPECIAL_CASE = { bbq: "BBQ", "tex-mex": "Tex-Mex" };
const cuisineText = (r, n = 9) => (r.cuisines || []).slice(0, n).map((c) => SPECIAL_CASE[c] || c.replace(/\b\w/g, (m) => m.toUpperCase())).join(" · ");
const metaLine = (r, n) => [cuisineText(r, n), price(r.price), r.town].filter(Boolean).join(" · ");
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
const ago = (days) => (days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`);
const MODE_LABEL = { dine_in: "Dine in", carry_out: "Carry-out", delivery: "Delivery", any: "Either" };
const enc = encodeURIComponent;

function ico(r, cls = "") {
  const { icon, color } = cuisineStyle(r);
  return `<span class="ico ${cls}" style="--c:${color}" aria-hidden="true"><i class="ti ti-${icon}"></i></span>`;
}
function openPill(r) {
  const open = isOpenAt(r.ho);
  return `<span class="pill ${open === true ? "ok" : open === false ? "no" : ""}">${esc(statusText(r.ho))}</span>`;
}
const notStatus = (w) => !/^Open|^Opens|^Closed|^Hours/.test(w);

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
}

// Scoring context: your history + your weight settings, optionally overlaid by mood tweaks.
function ctx(extra = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(S.settings.weights || {}), ...(extra.weights || {}) };
  return { stats: S.stats, prefs: S.prefs, when: new Date(), ...extra, weights };
}
function refreshStats() { S.stats = summarize(S.visits); }

// ---- theme -------------------------------------------------------------------
function setTheme(t) {
  lsSet("takeout.theme", t);
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#16141a" : "#f6f2ea");
}

// ---- boot --------------------------------------------------------------------
async function boot() {
  const [places, meta, news] = await Promise.all([
    fetch("data/restaurants.json").then((r) => r.json()).catch(() => []),
    fetch("data/meta.json").then((r) => r.json()).catch(() => ({})),
    fetch("data/news.json").then((r) => r.json()).catch(() => []),
  ]);
  S.places = places; S.meta = meta; S.news = news;
  S.byId = new Map(places.map((p) => [p.id, p]));
  try { await store.init(); } catch (e) { console.error(e); toast("Couldn't reach your account — showing device data"); }
  await reload();
  window.addEventListener("hashchange", () => { S.navCount++; route(); });
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
}

async function reload() {
  try {
    const d = await store.loadAll();
    S.visits = d.visits; S.prefs = d.prefs; S.settings = d.settings;
  } catch (e) { console.error(e); toast("Couldn't load your history"); }
  refreshStats();
}

// ---- router ------------------------------------------------------------------
function route() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const parts = (path || "/").split("/").filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(query));
  const tab = { browse: "browse", history: "history", settings: "settings", r: "browse", log: "browse" }[parts[0]] || "home";
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  window.scrollTo(0, 0);
  delete app.dataset.place; delete app.dataset.visit;
  switch (parts[0]) {
    case undefined: viewHome(); break;
    case "decide": viewDecide(q); break;
    case "mood": viewMood(); break;
    case "spin": viewSpin(); break;
    case "browse": viewBrowse(); break;
    case "r": viewPlace(parts[1]); break;
    case "log": viewLog(parts[1], parts[2]); break;
    case "history": viewHistory(); break;
    case "settings": viewSettings(); break;
    default: viewHome();
  }
  renderTonight();
}

// ---- shared bits -------------------------------------------------------------
function filterChips({ open = true } = {}) {
  return `
    <button class="chip" aria-pressed="${S.mode === "carry_out"}" data-act="mode" data-v="carry_out"><i class="ti ti-shopping-bag" aria-hidden="true"></i>Carry-out</button>
    <button class="chip" aria-pressed="${S.mode === "dine_in"}" data-act="mode" data-v="dine_in"><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i>Dine in</button>
    ${open ? `<button class="chip hot" aria-pressed="${S.openNow}" data-act="open"><i class="ti ti-clock" aria-hidden="true"></i>Open now</button>` : ""}`;
}

// Compact place row used in lists, alternates and the map card.
function prow(r, { why = true } = {}) {
  const p = S.prefs.get(r.id);
  const w = why ? reasons(r, ctx()).filter(notStatus).slice(0, 3).join(" · ") : "";
  return `<a class="prow" href="#/r/${enc(r.id)}">
    ${ico(r)}
    <div class="body">
      <div class="name">${esc(r.name)}${p?.favorite ? '<span class="fav" aria-label="Favorite">♥</span>' : ""}</div>
      <div class="meta">${esc(metaLine(r, 2))}</div>
      ${w ? `<div class="why">${esc(w)}</div>` : ""}
    </div>
    ${openPill(r)}
  </a>`;
}

function emptyState(msg, extra = "") { return `<div class="empty"><p>${msg}</p>${extra}</div>`; }
function backLink(href = "#/", label = "Back") {
  return `<a class="back" href="${href}" data-act="back"><i class="ti ti-chevron-left" aria-hidden="true"></i>${esc(label)}</a>`;
}
function dataBadge() {
  const n = S.places.filter((r) => r.status === "open").length;
  const when = S.meta.updated ? fmtDate(S.meta.updated.slice(0, 10)) : "never";
  const days = S.meta.updated ? Math.floor((Date.now() - new Date(S.meta.updated)) / 86400000) : 999;
  return `<p class="badge ${days > 14 ? "stale" : ""}">${n} places · data updated ${esc(when)}${store.mode() === "local" ? " · history saved on this device" : ""}</p>`;
}

// ---- tonight's pick bar ------------------------------------------------------
function setTonight(r) {
  S.tonight = { id: r.id, date: todayISO() };
  lsSet("takeout.tonight", JSON.stringify(S.tonight));
}
function renderTonight() {
  const bar = document.getElementById("tonight");
  const t = S.tonight;
  const r = t && t.date === todayISO() ? S.byId.get(t.id) : null;
  const onIt = location.hash.startsWith(`#/r/${enc(t?.id || "")}`) || /^#\/(decide|mood|log)/.test(location.hash);
  if (!r || onIt) { bar.hidden = true; return; }
  bar.style.setProperty("--c", cuisineStyle(r).color);
  bar.innerHTML = `<a href="#/r/${enc(r.id)}">${ico(r)}<span style="min-width:0"><b>${esc(r.name)}</b><small>Tonight's pick · ${esc(statusText(r.ho))}</small></span></a>
    <button data-act="tonight-x" aria-label="Clear tonight's pick"><i class="ti ti-x"></i></button>`;
  bar.hidden = false;
}

// ---- Home --------------------------------------------------------------------
function viewHome() {
  const h = new Date().getHours();
  const hello = h < 11 ? "Planning <em>ahead</em>?" : h < 16 ? "What's for <em>lunch</em>?" : h < 21 ? "What's for <em>dinner</em>?" : "Late-night <em>bite</em>?";
  const openCount = filterPlaces(S.places, { mode: S.mode, openOnly: true, allowUnknownHours: false, prefs: S.prefs }).length;

  // Jump back in: places you've been, most recent first.
  const seen = new Set(), back = [];
  for (const v of S.visits) {
    if (seen.has(v.restaurant_id) || !S.byId.has(v.restaurant_id)) continue;
    seen.add(v.restaurant_id); back.push(S.byId.get(v.restaurant_id));
    if (back.length === 10) break;
  }
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const fresh = S.places.filter((r) => r.firstSeen && r.firstSeen >= cutoff && r.firstSeen > (S.meta.baseline || "") && r.status === "open");

  app.innerHTML = `
    <h1>${hello}</h1>
    <p class="sub">${openCount} place${openCount === 1 ? "" : "s"} open near home right now</p>
    <div class="chips">${filterChips()}</div>
    <a class="decide-card" href="#/decide"><strong>Decide for me</strong><span>Picked from your history and what's open</span><i class="ti ti-sparkles" aria-hidden="true"></i></a>

    ${back.length ? `<h2>Jump back in</h2><div class="shelf">${back.map((r) => `
      <a class="shelf-item" href="#/r/${enc(r.id)}">${ico(r)}<b>${esc(r.name)}</b><small>${esc(ago(S.stats.get(r.id)?.daysSince ?? 0))}</small></a>`).join("")}</div>` : ""}

    ${fresh.length ? `<h2>New around here</h2><div class="shelf">${fresh.slice(0, 10).map((r) => `
      <a class="shelf-item" href="#/r/${enc(r.id)}">${ico(r)}<b>${esc(r.name)}</b><small>${esc(r.town)}</small></a>`).join("")}</div>` : ""}

    <h2>Browse by craving</h2>
    <div class="tiles">${CRAVINGS.map((c) => `<button class="tile" style="--c:${c.color}" data-act="craving" data-k="${c.key}">${esc(c.label)}<i class="ti ti-${c.icon}" aria-hidden="true"></i></button>`).join("")}</div>

    <ul class="menu">
      <li><a href="#/mood"><span>In the mood for…<small>Four quick taps</small></span><i class="ti ti-arrow-right" aria-hidden="true"></i></a></li>
      <li><a href="#/spin"><span>Spin the wheel<small>Leave it to fate</small></span><i class="ti ti-arrow-right" aria-hidden="true"></i></a></li>
      <li><a href="#/browse"><span>Browse everything<small>List or map</small></span><i class="ti ti-arrow-right" aria-hidden="true"></i></a></li>
    </ul>

    ${S.news.length ? `<h2>Around town</h2><ul class="menu" style="margin-top:0">${S.news.slice(0, 4).map((n) => `<li>${safeUrl(n.url)
      ? `<a href="${esc(n.url)}" target="_blank" rel="noopener"><span style="font:.92rem var(--body)">${esc(n.title)}<small>${esc([n.source, n.date && fmtDate(n.date)].filter(Boolean).join(" · "))}</small></span><i class="ti ti-external-link" aria-hidden="true"></i></a>`
      : `<a><span style="font:.92rem var(--body)">${esc(n.title)}</span></a>`}</li>`).join("")}</ul>` : ""}
    ${dataBadge()}`;
}

// ---- Decide / result ---------------------------------------------------------
function viewDecide(q = {}) {
  const includeClosed = q.all === "1";
  const pool = filterPlaces(S.places, { mode: S.mode, openOnly: S.openNow && !includeClosed, prefs: S.prefs, stats: S.stats });
  const c = ctx();
  app.innerHTML = resultHTML(pick(pool, c), c, { includeClosed, again: "#/decide", source: "Picked" });
}

function resultHTML(res, c, { includeClosed = false, again, source }) {
  if (!res) {
    return `${backLink()}${emptyState(
      includeClosed || !S.openNow ? "Nothing matches. Try clearing Dine in / Carry-out." : "Nothing open right now matches.",
      includeClosed || !S.openNow ? "" : `<a class="btn" href="${again}${again.includes("?") ? "&" : "?"}all=1">Include places that are closed now</a>`)}`;
  }
  const r = res.choice.r;
  setTonight(r);
  const { color } = cuisineStyle(r);
  const p = S.prefs.get(r.id) || {};
  const why = reasons(r, c).filter(notStatus);
  const usual = dishSummary(r.id).filter((d) => d.again === true || (d.avg ?? 0) >= 4).slice(0, 4);
  const dishes = usual.length ? usual.map((d) => [d.name, d.avg ? "★".repeat(Math.round(d.avg)) : "", true]) : (r.highlights || []).slice(0, 4).map((h) => [h, "", false]);
  return `
    <div class="hero" style="--c:${color}">
      ${backLink()}
      <p class="eyebrow">Tonight, try</p>
      <i class="ti ti-${cuisineStyle(r).icon} big-ico" aria-hidden="true"></i>
      <h1>${esc(r.name)}</h1>
      <p class="meta">${esc(metaLine(r))}</p>
    </div>
    <div class="pills">${openPill(r)}${why.map((w) => `<span class="pill ${/★/.test(w) ? "warn" : ""}">${esc(w)}</span>`).join("")}</div>
    ${dishes.length ? `<h2 style="margin-top:18px">${usual.length ? "Your usual" : "Known for"}</h2>
      <ul class="dishes">${dishes.map(([n, s, mine]) => `<li><b style="font-weight:500">${esc(n)}</b><span class="${mine ? "again" : ""}">${s}</span></li>`).join("")}</ul>` : ""}
    <div class="actions-row">
      <a class="btn primary" href="#/r/${enc(r.id)}">Let's go</a>
      <button class="btn round" data-act="reroll" aria-label="Something else"><i class="ti ti-refresh"></i></button>
      <button class="btn round ${p.favorite ? "on" : ""}" data-act="fav" data-id="${esc(r.id)}" aria-pressed="${!!p.favorite}" aria-label="Favorite"><i class="ti ti-heart"></i></button>
    </div>
    ${res.alternates.length ? `<div class="alts"><h2>Or maybe</h2><div class="rows">${res.alternates.map((x) => prow(x.r)).join("")}</div></div>` : ""}
    <p class="pool">${source} from ${res.poolSize} place${res.poolSize === 1 ? "" : "s"}${includeClosed || !S.openNow ? "" : " open now"}</p>`;
}

// ---- Mood --------------------------------------------------------------------
const MOOD_Q = [
  { key: "style", q: "Sit down, or grab & go?", a: [["sit", "Sit down"], ["grab", "Grab & go"], ["any", "Either"]] },
  { key: "appetite", q: "Light, or <em>hearty</em>?", a: [["light", "Light"], ["hearty", "Hearty"], ["any", "Whatever"]] },
  { key: "novelty", q: "An old favorite, or something <em>new</em>?", a: [["usual", "A favorite"], ["new", "Something new"], ["any", "Surprise me"]] },
  { key: "budget", q: "What's the budget?", a: [["1", "$"], ["2", "$$"], ["3", "$$$"], ["", "Doesn't matter"]] },
];

function viewMood() {
  const m = S.mood;
  if (m.step < MOOD_Q.length) {
    const Q = MOOD_Q[m.step];
    app.innerHTML = `${backLink()}
      <section class="mood">
        <p class="eyebrow">${m.step + 1} of ${MOOD_Q.length}</p>
        <h1>${Q.q}</h1>
        <div class="choices">${Q.a.map(([v, l]) => `<button class="choice" data-act="mood" data-k="${Q.key}" data-v="${v}">${l}</button>`).join("")}</div>
      </section>`;
    return;
  }
  const answers = { ...m.answers, budget: m.answers.budget ? Number(m.answers.budget) : null };
  const { filter, ctx: mctx } = moodToOptions(answers);
  const c = ctx(mctx);
  let pool = filterPlaces(S.places, { ...filter, openOnly: S.openNow, prefs: S.prefs, stats: S.stats });
  if (answers.novelty === "usual") {
    const known = pool.filter((r) => S.stats.get(r.id));
    if (known.length) pool = known;
  }
  app.innerHTML = `${resultHTML(pick(pool, c), c, { again: "#/mood", source: "Matched" })}
    <p class="center"><button class="link" data-act="mood-reset">Answer again</button></p>`;
}

// ---- Spin --------------------------------------------------------------------
function viewSpin() {
  const pool = filterPlaces(S.places, { mode: S.mode, openOnly: S.openNow, prefs: S.prefs, stats: S.stats });
  const cands = wheelCandidates(pool, ctx());
  S.wheel = cands;
  if (cands.length < 2) {
    app.innerHTML = `${backLink()}${emptyState("Not enough places open right now to spin.", `<a class="btn" href="#/browse">Browse instead</a>`)}`;
    return;
  }
  const n = cands.length, seg = 360 / n, R = 150;
  const slice = (i) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180, a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0), x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
    const mid = (i + 0.5) * seg;
    const label = cands[i].name.length > 16 ? cands[i].name.slice(0, 15) + "…" : cands[i].name;
    return `<path d="M${R},${R} L${x0},${y0} A${R},${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1},${y1} Z" fill="${cuisineStyle(cands[i]).color}"/>
      <text transform="rotate(${mid - 90} ${R} ${R}) translate(${R + 30} ${R + 4})" class="wl">${esc(label)}</text>`;
  };
  const allFav = cands.every((r) => S.prefs.get(r.id)?.favorite);
  app.innerHTML = `${backLink()}
    <h1>Spin the <em>wheel</em></h1>
    <div class="chips">${filterChips()}</div>
    <section class="spin">
      <p class="eyebrow">${allFav ? "Your favorites" : "Top picks"}</p>
      <div class="wheel-wrap">
        <div class="pointer" aria-hidden="true"></div>
        <svg id="wheel" viewBox="0 0 300 300" role="img" aria-label="Wheel with ${n} restaurants" style="transform: rotate(${S.wheelRot}deg)">
          ${cands.map((_, i) => slice(i)).join("")}
          <circle cx="150" cy="150" r="22" class="hub"/>
        </svg>
      </div>
      <button class="btn primary" style="width:100%" data-act="spin">Spin</button>
      <div id="spin-result"></div>
    </section>`;
}

function doSpin(btn) {
  const cands = S.wheel; const n = cands.length; const seg = 360 / n;
  const win = Math.floor(Math.random() * n);
  const target = 360 - (win + 0.5) * seg;              // brings winner's center to the top pointer
  const cur = ((S.wheelRot % 360) + 360) % 360;
  S.wheelRot += 360 * 5 + ((target - cur + 360) % 360);
  const wheel = document.getElementById("wheel");
  btn.disabled = true;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  wheel.style.transition = reduce ? "none" : "transform 3.2s cubic-bezier(.12,.7,.15,1)";
  wheel.style.transform = `rotate(${S.wheelRot}deg)`;
  setTimeout(() => {
    btn.disabled = false; btn.textContent = "Spin again";
    const r = cands[win];
    setTonight(r); renderTonight();
    document.getElementById("spin-result").innerHTML = prow(r);
  }, reduce ? 50 : 3300);
}

// ---- Browse ------------------------------------------------------------------
function browseList() {
  const b = S.browse;
  const crave = cravingByKey(b.craving);
  let list = filterPlaces(S.places, {
    mode: S.mode, openOnly: S.openNow, anyOf: crave ? crave.match : [], maxPrice: b.maxPrice ? Number(b.maxPrice) : null,
    favoritesOnly: b.fav, neverTried: b.never, prefs: S.prefs, stats: S.stats, search: b.search,
  });
  if (b.sort === "score") list = rank(list, ctx()).map((x) => x.r);
  if (b.sort === "name") list.sort((a, z) => a.name.localeCompare(z.name));
  if (b.sort === "rating") list.sort((a, z) => (S.stats.get(z.id)?.avg ?? externalRating(z) ?? 0) - (S.stats.get(a.id)?.avg ?? externalRating(a) ?? 0));
  if (b.sort === "longest") list.sort((a, z) => (S.stats.get(z.id)?.daysSince ?? 1e6) - (S.stats.get(a.id)?.daysSince ?? 1e6));
  return list;
}

function viewBrowse() {
  const b = S.browse;
  const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${l}</option>`;
  app.innerHTML = `
    <h1 class="page-title">Browse</h1>
    <div class="search-wrap"><i class="ti ti-search" aria-hidden="true"></i><input class="search" type="search" placeholder="Pizza, shawarma, Luigi's…" value="${esc(b.search)}" data-b="search" aria-label="Search"></div>
    <div class="chips">
      <button class="chip" aria-pressed="${b.view === "list"}" data-act="view" data-v="list"><i class="ti ti-list" aria-hidden="true"></i>List</button>
      <button class="chip" aria-pressed="${b.view === "map"}" data-act="view" data-v="map"><i class="ti ti-map" aria-hidden="true"></i>Map</button>
      ${filterChips()}
      <button class="chip" aria-pressed="${b.fav}" data-act="bchip" data-k="fav"><i class="ti ti-heart" aria-hidden="true"></i>Favorites</button>
      <button class="chip" aria-pressed="${b.never}" data-act="bchip" data-k="never">Never tried</button>
    </div>
    <div class="selects">
      <select data-b="craving" aria-label="Food">${opt("", "All food", b.craving)}${CRAVINGS.map((c) => opt(c.key, esc(c.label), b.craving)).join("")}</select>
      <select data-b="sort" aria-label="Sort">${opt("score", "Best bet", b.sort)}${opt("rating", "Top rated", b.sort)}${opt("longest", "Longest since visit", b.sort)}${opt("name", "A–Z", b.sort)}</select>
      <select data-b="maxPrice" aria-label="Price">${opt("", "Any price", b.maxPrice)}${[1, 2, 3].map((p) => opt(p, "Up to " + price(p), b.maxPrice)).join("")}</select>
    </div>
    <div id="blist"></div>`;
  renderBrowseList();
}

function renderBrowseList() {
  const list = browseList();
  const el = document.getElementById("blist");
  if (!list.length) { el.innerHTML = emptyState("No places match those filters."); return; }
  const head = `<div class="listhead"><span class="count">${list.length} place${list.length === 1 ? "" : "s"}</span><button class="btn small" data-act="surprise"><i class="ti ti-dice-5" aria-hidden="true"></i>Surprise me</button></div>`;
  if (S.browse.view === "map") { el.innerHTML = head + mapHTML(list); return; }
  el.innerHTML = head + `<div class="rows">${list.map((r) => prow(r)).join("")}</div>`;
}

// Drawn road-grid map. Pins are placed from the street address (see geo.js).
function mapHTML(list) {
  const W = 340, H = 330, L = 12, Rm = 12, T = 14, B = 44;
  const X = (col) => L + col * (W - L - Rm), Y = (row) => T + (row / 6) * (H - T - B);
  const roads = [
    ...EW_ROADS.map((r) => `<line class="road" x1="${L}" y1="${Y(r.row)}" x2="${W - Rm}" y2="${Y(r.row)}"/><text class="rl" x="${L + 2}" y="${Y(r.row) - 3}">${r.name}</text>`),
    ...NS_ROADS.map((r, i) => `<line class="road" x1="${X(roadCol(r.num))}" y1="${T}" x2="${X(roadCol(r.num))}" y2="${H - B}"/><text class="rl" x="${X(roadCol(r.num))}" y="${H - B + 12 + (i % 2) * 11}" text-anchor="middle">${r.name}</text>`),
  ];
  const gr = [21800, 23500, 25000, 27400, 29400, 32400].map((n) => gridPosition(`${n} Grand River`)).map((p) => `${X(p.col)},${Y(p.row)}`).join(" ");
  const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let unplaced = 0;
  const pins = list.map((r) => {
    const g = gridPosition(r.addr);
    if (!g) { unplaced++; return ""; }
    const h = hash(r.id);
    const x = X(g.col) + ((h % 9) - 4) * 1.6, y = Y(g.row) + (((h >> 4) % 9) - 4) * 1.6; // nudge same-plaza pins apart
    const sel = S.browse.sel === r.id;
    return `<g class="pin ${sel ? "sel" : ""}" data-act="pin" data-id="${esc(r.id)}" role="button" aria-label="${esc(r.name)}" tabindex="0">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sel ? 8 : 6}" fill="${cuisineStyle(r).color}"/></g>`;
  });
  const selPlace = S.browse.sel && list.find((r) => r.id === S.browse.sel);
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of ${list.length} places">
      ${roads.join("")}
      <polyline class="road diag" points="${gr}" fill="none"/>
      ${pins.join("")}
    </svg>
    <div id="map-card">${selPlace ? prow(selPlace) : `<p class="map-note">Tap a dot to see the place.${unplaced ? ` ${unplaced} couldn't be placed from their address.` : ""}</p>`}</div>`;
}

// ---- Place detail ------------------------------------------------------------
function dishSummary(rid) {
  const map = new Map();
  for (const v of S.visits.filter((v) => v.restaurant_id === rid)) {
    for (const d of v.dishes || []) {
      const k = d.name.trim().toLowerCase();
      const s = map.get(k) || { name: d.name.trim(), ratings: [], count: 0, again: null, last: v.visited_on };
      s.count++; if (d.rating) s.ratings.push(d.rating);
      if (v.visited_on >= s.last) { s.last = v.visited_on; if (d.order_again != null) s.again = d.order_again; }
      map.set(k, s);
    }
  }
  return [...map.values()].map((s) => ({ ...s, avg: s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null }))
    .sort((a, b) => (b.again === true) - (a.again === true) || (b.avg ?? 0) - (a.avg ?? 0) || b.count - a.count);
}

const dayNames = (days) => {
  const n = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ds = String(days).split("").map(Number);
  return ds.length === 7 ? "Daily" : ds.map((d) => n[d]).join(", ");
};

function viewPlace(id) {
  id = decodeURIComponent(id || "");
  const r = S.byId.get(id);
  if (!r) { app.innerHTML = `${backLink("#/browse")}${emptyState("That place isn't in the list anymore.")}`; return; }
  app.dataset.place = id;
  const p = S.prefs.get(id) || {};
  const s = S.stats.get(id);
  const visits = S.visits.filter((v) => v.restaurant_id === id);
  const dishes = dishSummary(id);
  const { icon, color } = cuisineStyle(r);
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${enc(`${r.name}, ${r.addr || r.town || ""}`)}`;
  const order = Object.entries(r.order || {}).filter(([, u]) => safeUrl(u));
  const social = Object.entries(r.social || {}).filter(([, u]) => safeUrl(u));
  const SOCIAL = { fb: ["Facebook", "brand-facebook"], ig: ["Instagram", "brand-instagram"], x: ["X", "brand-x"], tiktok: ["TikTok", "brand-tiktok"] };
  const CF = { 1: "Confirmed", 2: "Likely", 3: "Unverified" };
  const specials = todaySpecials(r);
  const ext = externalRating(r);

  app.innerHTML = `
    <div class="hero" style="--c:${color}">
      ${backLink("#/browse")}
      <p class="eyebrow">${esc(r.town || "")}</p>
      <i class="ti ti-${icon} big-ico" aria-hidden="true"></i>
      <h1>${esc(r.name)}</h1>
      <p class="meta">${esc(metaLine(r))}</p>
    </div>
    <div class="pills">
      ${openPill(r)}
      ${ext ? `<span class="pill warn">${ext.toFixed(1)}★ online${r.rating?.count ? ` (${r.rating.count})` : ""}</span>` : ""}
      ${[r.dineIn && "Dine in", r.carryOut && "Carry-out", r.delivery && "Delivery"].filter(Boolean).map((m) => `<span class="pill">${m}</span>`).join("")}
      ${r.status !== "open" ? `<span class="pill no">${r.status === "closed_temp" ? "Temporarily closed" : "Closed"}</span>` : ""}
    </div>
    <div class="actions-row">
      <a class="btn primary" href="#/log/${enc(id)}">Log a visit</a>
      ${r.phone ? `<a class="btn round" href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}" aria-label="Call"><i class="ti ti-phone"></i></a>` : ""}
      <a class="btn round" href="${esc(dir)}" target="_blank" rel="noopener" aria-label="Directions"><i class="ti ti-map-pin"></i></a>
      <button class="btn round ${p.favorite ? "on" : ""}" data-act="fav" data-id="${esc(id)}" aria-pressed="${!!p.favorite}" aria-label="Favorite"><i class="ti ti-heart"></i></button>
    </div>
    <div class="linkrow">
      ${safeUrl(r.web) ? `<a class="btn small" href="${esc(r.web)}" target="_blank" rel="noopener"><i class="ti ti-world" aria-hidden="true"></i>Website</a>` : ""}
      ${safeUrl(r.menuUrl) ? `<a class="btn small" href="${esc(r.menuUrl)}" target="_blank" rel="noopener">Menu</a>` : ""}
      ${order.map(([k, u]) => `<a class="btn small" href="${esc(u)}" target="_blank" rel="noopener"><i class="ti ti-shopping-bag" aria-hidden="true"></i>Order${k === "online" ? " online" : " · " + esc(k)}</a>`).join("")}
      ${social.map(([k, u]) => `<a class="btn small round" href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(SOCIAL[k]?.[0] || k)}"><i class="ti ti-${SOCIAL[k]?.[1] || "world"}"></i></a>`).join("")}
    </div>

    <section class="you">
      <h2>You & ${esc(r.name)}</h2>
      ${s ? `<p class="muted small">${s.count} visit${s.count > 1 ? "s" : ""}${s.avg ? ` · avg ${s.avg.toFixed(1)}★` : ""} · last ${fmtDate(s.last)} (${ago(s.daysSince).toLowerCase()})</p>` : `<p class="muted small">Never been. Log it when you go.</p>`}
      ${dishes.length ? `<h3>Your dishes</h3><ul class="dishes">${dishes.map((d) => `<li><b style="font-weight:500">${esc(d.name)}</b><span class="${d.again ? "again" : ""}">${d.avg ? stars(Math.round(d.avg)) : ""}${d.count > 1 ? ` ×${d.count}` : ""}${d.again === true ? " · again" : d.again === false ? " · skip" : ""}</span></li>`).join("")}</ul>` : ""}
      ${visits.length ? `<h3>Visits</h3><ul class="visits">${visits.map((v) => `<li><a href="#/log/${enc(id)}/${enc(v.id)}"><b style="font-weight:500">${fmtDate(v.visited_on)}</b> · ${MODE_LABEL[v.mode] || ""}${v.rating ? " · " + stars(v.rating) : ""}${v.notes ? `<span>${esc(v.notes)}</span>` : ""}</a></li>`).join("")}</ul>` : ""}
      <label class="note">My notes<textarea data-act="pnotes" rows="2" placeholder="Ask for extra garlic sauce">${esc(p.notes || "")}</textarea></label>
    </section>

    ${r.highlights?.length ? `<h2>Known for</h2><ul class="dishes">${r.highlights.map((h) => `<li><span style="color:var(--ink);font-size:.95rem">${esc(h)}</span></li>`).join("")}</ul>` : ""}
    ${r.specials?.length ? `<h2>Specials</h2><ul class="dishes">${r.specials.map(([days, t]) => `<li><span style="color:var(--ink);white-space:normal">${esc(t)}</span><span class="${specials.includes(t) ? "again" : ""}">${specials.includes(t) ? "Today" : dayNames(days)}</span></li>`).join("")}</ul>` : ""}

    <h2>Hours</h2>
    <table class="hours">${weekText(r.ho).map(([d, t], i) => `<tr class="${i === new Date().getDay() ? "today" : ""}"><th>${d}</th><td>${esc(t)}</td></tr>`).join("")}</table>

    <section class="info">
      ${r.addr ? `<p>${esc(r.addr)}</p>` : ""}
      ${r.phone ? `<p>${esc(r.phone)}</p>` : ""}
      <details><summary>Info: ${CF[r.cf] || "Unverified"}${r.dt ? ` · checked ${fmtDate(r.dt)}` : ""}</summary><p class="small">${esc(r.ev || "")}</p></details>
      <button class="link danger" data-act="hide" data-id="${esc(id)}">${p.hidden ? "Unhide this place" : "Hide this place from suggestions"}</button>
    </section>`;
}

// ---- Log a visit -------------------------------------------------------------
function viewLog(rid, vid) {
  rid = decodeURIComponent(rid || ""); vid = vid ? decodeURIComponent(vid) : null;
  const r = S.byId.get(rid);
  if (!r) { app.innerHTML = emptyState("Unknown place."); return; }
  const v = vid ? S.visits.find((x) => x.id === vid) : null;
  const dishes = v?.dishes?.length ? v.dishes : [{}];
  const known = [...new Set([...dishSummary(rid).map((d) => d.name), ...(r.highlights || [])])];
  const defMode = v?.mode || (S.mode === "any" ? (r.dineIn === false ? "carry_out" : "dine_in") : S.mode);

  app.innerHTML = `${backLink(`#/r/${enc(rid)}`, r.name)}
    <h1 class="page-title">${v ? "Edit visit" : "Log a <em>visit</em>"}</h1>
    <form id="logform" class="form">
      <label>Date<input type="date" name="visited_on" value="${esc(v?.visited_on || todayISO())}" max="${todayISO()}" required></label>
      <fieldset><legend>How</legend><div class="seg">${["dine_in", "carry_out", "delivery"].map((m) => `<label><input type="radio" name="mode" value="${m}" ${defMode === m ? "checked" : ""}><span>${MODE_LABEL[m]}</span></label>`).join("")}</div></fieldset>
      <fieldset><legend>Overall</legend>${starInput("rating", v?.rating)}</fieldset>
      <fieldset><legend>Go back?</legend><div class="seg">
        ${[["true", "Yes"], ["false", "No"], ["", "Not sure"]].map(([val, l]) => `<label><input type="radio" name="would_return" value="${val}" ${String(v?.would_return ?? "") === val ? "checked" : ""}><span>${l}</span></label>`).join("")}
      </div></fieldset>
      <fieldset><legend>What you ate</legend>
        <datalist id="known-dishes">${known.map((d) => `<option value="${esc(d)}">`).join("")}</datalist>
        <div id="dish-rows">${dishes.map((d, i) => dishRow(d, i)).join("")}</div>
        <button type="button" class="btn small" data-act="add-dish">+ Another dish</button>
      </fieldset>
      <label>Notes<textarea name="notes" rows="3" placeholder="Anything worth remembering">${esc(v?.notes || "")}</textarea></label>
      <div class="row">
        <button class="btn primary" type="submit">Save</button>
        ${v ? `<button class="btn danger" type="button" data-act="del-visit" data-id="${esc(v.id)}">Delete</button>` : ""}
      </div>
    </form>`;
  app.dataset.place = rid;
  app.dataset.visit = vid || "";
}

let dishSeq = 100;
function dishRow(d = {}, i = dishSeq++) {
  return `<div class="dish-row">
    <input name="dish_name" list="known-dishes" placeholder="Dish" value="${esc(d.name || "")}" aria-label="Dish name">
    ${starInput(`dish_rating_${i}`, d.rating, true)}
    <label class="check"><input type="checkbox" name="dish_again" ${d.order_again ? "checked" : ""}> Again</label>
  </div>`;
}

function starInput(name, val, small = false) {
  return `<div class="stars ${small ? "sm" : ""}" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) =>
    `<label><input type="radio" name="${name}" value="${n}" ${val == n ? "checked" : ""}><span aria-label="${n} star${n > 1 ? "s" : ""}">★</span></label>`).join("")}</div>`;
}

async function submitLog(form) {
  const fd = new FormData(form);
  const rid = app.dataset.place, vid = app.dataset.visit || undefined;
  const wr = fd.get("would_return");
  const visit = {
    ...(vid ? { id: vid } : {}),
    restaurant_id: rid,
    visited_on: fd.get("visited_on"),
    mode: fd.get("mode") || "dine_in",
    rating: fd.get("rating") ? Number(fd.get("rating")) : null,
    would_return: wr === "true" ? true : wr === "false" ? false : null,
    notes: fd.get("notes")?.trim() || null,
  };
  const dishes = [...form.querySelectorAll(".dish-row")].map((row) => ({
    name: row.querySelector('[name="dish_name"]').value.trim(),
    rating: Number(row.querySelector(".stars input:checked")?.value) || null,
    order_again: row.querySelector('[name="dish_again"]').checked || null,
  }));
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await store.saveVisit(visit, dishes);
    await reload();
    toast("Saved");
    location.hash = `#/r/${enc(rid)}`;
  } catch (e) {
    console.error(e); toast("Couldn't save — try again"); btn.disabled = false;
  }
}

// ---- History -----------------------------------------------------------------
function viewHistory() {
  const byMonth = new Map();
  for (const v of S.visits) {
    const k = new Date(v.visited_on + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(v);
  }
  const top = [...S.stats.entries()].filter(([, s]) => s.avg).sort((a, b) => b[1].avg - a[1].avg || b[1].count - a[1].count).slice(0, 5);
  app.innerHTML = `<h1 class="page-title">History</h1>
    ${S.visits.length ? `
      ${top.length ? `<h2>Your top spots</h2><ol class="top">${top.map(([id, s]) => `<li><a href="#/r/${enc(id)}">${esc(S.byId.get(id)?.name || id)}</a><span>${s.avg.toFixed(1)}★ · ${s.count}×</span></li>`).join("")}</ol>` : ""}
      ${[...byMonth].map(([m, vs]) => `<h2>${esc(m)}</h2><div class="rows">${vs.map((v) => {
        const r = S.byId.get(v.restaurant_id);
        return `<a class="prow" href="#/r/${enc(v.restaurant_id)}">${r ? ico(r) : ""}<div class="body">
          <div class="name">${esc(r?.name || v.restaurant_id)}</div>
          <div class="meta">${fmtDate(v.visited_on)} · ${MODE_LABEL[v.mode] || ""}${v.rating ? " · " + stars(v.rating) : ""}</div>
          ${v.dishes?.length ? `<div class="why">${esc(v.dishes.map((d) => d.name).join(", "))}</div>` : ""}</div></a>`;
      }).join("")}</div>`).join("")}`
    : emptyState("No visits yet. After you eat somewhere, open it and tap “Log a visit”.", `<a class="btn" href="#/">Find dinner</a>`)}`;
}

// ---- Settings ----------------------------------------------------------------
const WEIGHT_LABELS = {
  quality: ["How good it is", "Your ratings (or online ratings if you haven't been)"],
  recency: ["Time since last visit", "Higher = avoids places you just went"],
  novelty: ["Try new places", "Bonus for places you've never been"],
  favorite: ["Favorites", "Bonus for places you've hearted"],
  special: ["Today's specials", "Bonus when a special runs today"],
};

function viewSettings() {
  const w = { ...DEFAULT_WEIGHTS, ...(S.settings.weights || {}) };
  const m = store.mode();
  const theme = lsGet("takeout.theme") || "auto";
  app.innerHTML = `<h1 class="page-title">Settings</h1>
    <section class="panel">
      <h2>Appearance</h2>
      <div class="seg" role="radiogroup" aria-label="Theme">
        ${[["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]].map(([v, l]) => `<button role="radio" aria-checked="${theme === v}" data-act="theme" data-v="${v}">${l}</button>`).join("")}
      </div>
      <p class="muted small">Auto follows your phone's light/dark setting.</p>
    </section>
    <section class="panel">
      <h2>Your history</h2>
      ${m === "cloud" ? `<p>Synced to your account. <button class="link" data-act="signout">Sign out</button></p>`
        : m === "signed-out" ? `<p>Sign in to sync your visits between devices.</p>
            <form id="signin" class="row"><input type="email" name="email" required placeholder="you@example.com" aria-label="Email"><button class="btn primary">Email me a link</button></form>`
        : `<p class="muted small">Saved on this device only. Add your Supabase keys in <code>js/config.js</code> to sync across phone + computer.</p>`}
      <p><button class="btn small" data-act="export">Download a backup</button></p>
    </section>
    <section class="panel">
      <h2>How “Decide for me” weighs things</h2>
      ${Object.entries(WEIGHT_LABELS).map(([k, [l, d]]) => `<label class="range"><span><b>${l}</b><small>${d}</small></span>
        <input type="range" min="0" max="5" step="0.1" value="${w[k]}" data-w="${k}"><output>${Number(w[k]).toFixed(1)}</output></label>`).join("")}
      <button class="link" data-act="reset-weights">Reset to defaults</button>
    </section>
    <section class="panel">
      <h2>About the data</h2>
      <p class="small">${S.places.length} places inside 9 Mile · Lahser · Plymouth · Newburgh. Refreshed automatically every week.</p>
      ${S.meta.updated ? `<p class="muted small">Last update ${fmtDate(S.meta.updated.slice(0, 10))}${S.meta.summary ? ` — ${esc(S.meta.summary)}` : ""}</p>` : ""}
    </section>`;
}

// ---- events ------------------------------------------------------------------
async function toggleFav(id) {
  const p = S.prefs.get(id) || {};
  try {
    S.prefs.set(id, await store.setPref(id, { favorite: !p.favorite }));
    toast(!p.favorite ? "Added to favorites" : "Removed from favorites");
  } catch (err) { console.error(err); toast("Couldn't save"); }
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "back") {
    // Prefer real history (keeps Browse filters/scroll context); fall back to the link's href.
    if (S.navCount > 0) { e.preventDefault(); history.back(); }
    return;
  }
  if (act === "mode") {
    S.mode = S.mode === el.dataset.v ? "any" : el.dataset.v; lsSet("takeout.mode", S.mode);
    return location.hash.startsWith("#/browse") ? viewBrowse() : route();
  }
  if (act === "open") {
    S.openNow = !S.openNow; lsSet("takeout.open", S.openNow ? "1" : "0");
    return location.hash.startsWith("#/browse") ? viewBrowse() : route();
  }
  if (act === "craving") {
    S.browse = { ...S.browse, craving: el.dataset.k, search: "", sel: null };
    location.hash = "#/browse";
    return;
  }
  if (act === "view") { S.browse.view = el.dataset.v; S.browse.sel = null; return viewBrowse(); }
  if (act === "pin") { S.browse.sel = el.dataset.id; return renderBrowseList(); }
  if (act === "reroll") return route();
  if (act === "mood") { S.mood.answers[el.dataset.k] = el.dataset.v; S.mood.step++; return viewMood(); }
  if (act === "mood-reset") { S.mood = { step: 0, answers: {} }; return viewMood(); }
  if (act === "spin") return doSpin(el);
  if (act === "bchip") { S.browse[el.dataset.k] = !S.browse[el.dataset.k]; el.setAttribute("aria-pressed", S.browse[el.dataset.k]); return renderBrowseList(); }
  if (act === "surprise") {
    const list = browseList();
    const res = pick(list, ctx(), { topN: list.length });
    if (res) { setTonight(res.choice.r); location.hash = `#/r/${enc(res.choice.r.id)}`; }
    return;
  }
  if (act === "fav") {
    const id = el.dataset.id; await toggleFav(id);
    const on = !!S.prefs.get(id)?.favorite;
    el.classList.toggle("on", on); el.setAttribute("aria-pressed", on);
    return;
  }
  if (act === "hide") {
    const id = el.dataset.id; const p = S.prefs.get(id) || {};
    try { S.prefs.set(id, await store.setPref(id, { hidden: !p.hidden })); toast(!p.hidden ? "Hidden from suggestions" : "Unhidden"); }
    catch (err) { console.error(err); toast("Couldn't save"); }
    return viewPlace(id);
  }
  if (act === "tonight-x") { S.tonight = null; lsSet("takeout.tonight", "null"); return renderTonight(); }
  if (act === "theme") { setTheme(el.dataset.v); return viewSettings(); }
  if (act === "add-dish") { document.getElementById("dish-rows").insertAdjacentHTML("beforeend", dishRow()); return; }
  if (act === "del-visit") {
    if (!confirm("Delete this visit?")) return;
    try { await store.deleteVisit(el.dataset.id); await reload(); toast("Deleted"); location.hash = `#/r/${enc(app.dataset.place)}`; }
    catch (err) { console.error(err); toast("Couldn't delete"); }
    return;
  }
  if (act === "signout") { await store.signOut(); await reload(); return viewSettings(); }
  if (act === "export") {
    const data = await store.exportAll();
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })),
      download: `dinner-history-${todayISO()}.json`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    return;
  }
  if (act === "reset-weights") { S.settings.weights = {}; await store.saveSettings(S.settings); return viewSettings(); }
});

// Keyboard access for map pins (SVG <g> elements).
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".pin")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.b) {
    S.browse[el.dataset.b] = el.value; S.browse.sel = null;
    clearTimeout(S._bt); S._bt = setTimeout(renderBrowseList, el.type === "search" ? 150 : 0);
  }
  if (el.dataset.w) {
    el.nextElementSibling.textContent = Number(el.value).toFixed(1);
    S.settings.weights = { ...(S.settings.weights || {}), [el.dataset.w]: Number(el.value) };
    clearTimeout(S._wt); S._wt = setTimeout(() => store.saveSettings(S.settings).catch(() => toast("Couldn't save")), 400);
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.dataset.act === "pnotes") {
    const id = app.dataset.place;
    try { S.prefs.set(id, await store.setPref(id, { notes: e.target.value.trim() || null })); toast("Note saved"); }
    catch { toast("Couldn't save note"); }
  }
});

document.addEventListener("submit", async (e) => {
  if (e.target.id === "logform") { e.preventDefault(); return submitLog(e.target); }
  if (e.target.id === "signin") {
    e.preventDefault();
    try { await store.signIn(new FormData(e.target).get("email")); toast("Check your email for the sign-in link"); }
    catch (err) { console.error(err); toast("Couldn't send the link"); }
  }
});

// Re-apply "auto" theme color when the phone switches light/dark.
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => setTheme(lsGet("takeout.theme") || "auto"));

boot();
