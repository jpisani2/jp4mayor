// Shared test cases. Runner: tests/run.html (browser) or `node --test tests/` (Node).
import { parseHours, isOpenAt, statusText, isValidHours } from "../js/hours.js";
import { summarize, filterPlaces, scorePlace, pick, moodToOptions, todaySpecials, wheelCandidates } from "../js/decide.js";
import { validateRestaurants } from "../js/validate.js";
import { gridPosition } from "../js/geo.js";
import { cuisineStyle, CRAVINGS } from "../js/cuisine.js";

const eq = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (v, msg = "assertion failed") => { if (!v) throw new Error(msg); };

// Fixed reference week: 2026-10-04 is a Sunday.
const at = (dow, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return new Date(2026, 9, 4 + dow, h, m); };
const NOW = new Date(2026, 9, 10, 18, 0); // Saturday 6pm

const place = (id, extra = {}) => ({
  id, name: id, town: "Livonia", status: "open", ho: "11-22", dineIn: true, carryOut: true,
  cuisines: [], tags: [], cf: 1, dt: "2026-10-01", firstSeen: "2026-10-01", ev: "test", ...extra,
});

export const cases = [
  // ---- hours ----
  ["hours: single value applies to every day", () => {
    const w = parseHours("11-22");
    eq(w.length, 7); eq(w[3], [[660, 1320]]);
  }],
  ["hours: closed, unknown, split shift, minutes", () => {
    const w = parseHours("x,11-14/17-21,?,11:30-21:30,11-22,11-23,12-23");
    eq(w[0], []); eq(w[1], [[660, 840], [1020, 1260]]); eq(w[2], null); eq(w[3], [[690, 1290]]);
  }],
  ["hours: open/closed at boundaries", () => {
    eq(isOpenAt("11-22", at(2, "10:59")), false);
    eq(isOpenAt("11-22", at(2, "11:00")), true);
    eq(isOpenAt("11-22", at(2, "21:59")), true);
    eq(isOpenAt("11-22", at(2, "22:00")), false);
  }],
  ["hours: split shift gap is closed", () => {
    eq(isOpenAt("11-14/17-21", at(1, "15:30")), false);
    eq(statusText("11-14/17-21", at(1, "15:30")), "Opens 5pm");
  }],
  ["hours: past midnight spills into the next day", () => {
    const ho = "x,x,x,x,x,17-26,x"; // Friday 5pm–2am
    eq(isOpenAt(ho, at(5, "23:30")), true);
    eq(isOpenAt(ho, at(6, "01:30")), true, "Sat 1:30am");
    eq(isOpenAt(ho, at(6, "02:00")), false, "Sat 2am");
    eq(statusText(ho, at(6, "01:00")), "Open · until 2am");
  }],
  ["hours: 24h and unknown", () => {
    eq(isOpenAt("0-24", at(3, "03:00")), true);
    eq(statusText("0-24", at(3, "03:00")), "Open 24 hours");
    eq(isOpenAt("?", at(3, "12:00")), null);
    eq(isOpenAt(undefined, at(3, "12:00")), null);
  }],
  ["hours: validity", () => {
    ok(isValidHours("11-22")); ok(isValidHours("?")); ok(isValidHours("x,11-22,11-22,11-22,11-22,11-22,?"));
    ok(!isValidHours("11-22,11-22")); ok(!isValidHours("11am-10pm")); ok(!isValidHours("x,x,x"));
  }],

  // ---- history ----
  ["summarize: count, avg, last, daysSince", () => {
    const s = summarize([
      { restaurant_id: "a", visited_on: "2026-10-01", rating: 4 },
      { restaurant_id: "a", visited_on: "2026-09-01", rating: 2 },
      { restaurant_id: "a", visited_on: "2026-09-15" },
    ], NOW).get("a");
    eq(s.count, 3); eq(s.avg, 3); eq(s.last, "2026-10-01"); eq(s.daysSince, 9);
  }],

  // ---- filters ----
  ["filter: carry-out mode drops dine-in-only, hidden and closed", () => {
    const list = [place("a"), place("b", { carryOut: false }), place("c", { status: "closed" }), place("d")];
    const prefs = new Map([["d", { hidden: true }]]);
    eq(filterPlaces(list, { mode: "carry_out", prefs }).map((r) => r.id), ["a"]);
  }],
  ["filter: open-only respects hours, unknown allowed by default", () => {
    const list = [place("a", { ho: "11-22" }), place("b", { ho: "6-14" }), place("c", { ho: "?" })];
    eq(filterPlaces(list, { openOnly: true, when: NOW }).map((r) => r.id), ["a", "c"]);
    eq(filterPlaces(list, { openOnly: true, when: NOW, allowUnknownHours: false }).map((r) => r.id), ["a"]);
  }],
  ["filter: price, cuisine, never tried, search", () => {
    const list = [place("a", { price: 3, cuisines: ["thai"] }), place("b", { price: 1, cuisines: ["pizza"], highlights: ["detroit-style"] })];
    eq(filterPlaces(list, { maxPrice: 2 }).map((r) => r.id), ["b"]);
    eq(filterPlaces(list, { cuisines: ["thai"] }).map((r) => r.id), ["a"]);
    eq(filterPlaces(list, { neverTried: true, stats: new Map([["a", {}]]) }).map((r) => r.id), ["b"]);
    eq(filterPlaces(list, { search: "detroit" }).map((r) => r.id), ["b"]);
  }],

  // ---- scoring ----
  ["score: a place you went to yesterday ranks below the same place a month ago", () => {
    const stats = summarize([
      { restaurant_id: "recent", visited_on: "2026-10-09", rating: 5 },
      { restaurant_id: "old", visited_on: "2026-09-08", rating: 5 },
    ], NOW);
    const c = { stats, prefs: new Map(), when: NOW };
    ok(scorePlace(place("old"), c).score > scorePlace(place("recent"), c).score + 1);
  }],
  ["score: your 5★ beats your 2★ at equal recency", () => {
    const stats = summarize([
      { restaurant_id: "good", visited_on: "2026-09-10", rating: 5 },
      { restaurant_id: "meh", visited_on: "2026-09-10", rating: 2 },
    ], NOW);
    const c = { stats, prefs: new Map(), when: NOW };
    ok(scorePlace(place("good"), c).score > scorePlace(place("meh"), c).score);
  }],
  ["score: 'would not return' is a strong penalty", () => {
    const stats = summarize([{ restaurant_id: "a", visited_on: "2026-08-01", rating: 3, would_return: false }], NOW);
    const c = { stats, prefs: new Map(), when: NOW };
    const base = summarize([{ restaurant_id: "a", visited_on: "2026-08-01", rating: 3 }], NOW);
    ok(scorePlace(place("a"), c).score < scorePlace(place("a"), { ...c, stats: base }).score - 1);
  }],
  ["score: today's special adds a bonus", () => {
    const c = { stats: new Map(), prefs: new Map(), when: NOW }; // Saturday = 6
    eq(todaySpecials(place("a", { specials: [["6", "Half-off pizza"], ["12", "Taco Tue"]] }), NOW), ["Half-off pizza"]);
    ok(scorePlace(place("a", { specials: [["6", "x"]] }), c).score > scorePlace(place("b"), c).score);
  }],
  ["mood: light boosts light tags over hearty", () => {
    const { ctx } = moodToOptions({ appetite: "light" });
    const c = { stats: new Map(), prefs: new Map(), when: NOW, ...ctx };
    ok(scorePlace(place("s", { cuisines: ["sushi"] }), c).score > scorePlace(place("b", { cuisines: ["burgers"] }), c).score);
  }],
  ["mood: grab & go maps to carry-out, budget to maxPrice", () => {
    const { filter } = moodToOptions({ style: "grab", budget: 2 });
    eq(filter.mode, "carry_out"); eq(filter.maxPrice, 2);
  }],

  // ---- picking ----
  ["pick: deterministic with rng, returns alternates", () => {
    const list = ["a", "b", "c", "d"].map((id) => place(id));
    const res = pick(list, { stats: new Map(), prefs: new Map(), when: NOW }, { rng: () => 0 });
    ok(res.choice); eq(res.alternates.length, 2); ok(!res.alternates.includes(res.choice)); eq(res.poolSize, 4);
  }],
  ["pick: empty pool returns null", () => { eq(pick([], { stats: new Map(), prefs: new Map() }), null); }],
  ["pick: varies over many rolls but favors the top", () => {
    const stats = summarize([{ restaurant_id: "b", visited_on: "2026-10-09", rating: 2 }], NOW);
    const list = [place("a", { rating: { google: 4.8 } }), place("b"), place("c", { rating: { google: 3.2 } })];
    const counts = {};
    let seed = 1; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) { const id = pick(list, { stats, prefs: new Map(), when: NOW }, { rng }).choice.r.id; counts[id] = (counts[id] || 0) + 1; }
    ok(counts.a > counts.c && counts.c > (counts.b || 0), JSON.stringify(counts));
    ok(Object.keys(counts).length >= 2, "should not always pick the same place");
  }],
  ["wheel: uses favorites when there are at least 4", () => {
    const list = ["a", "b", "c", "d", "e", "f"].map((id) => place(id));
    const prefs = new Map(["a", "b", "c", "d"].map((id) => [id, { favorite: true }]));
    eq(wheelCandidates(list, { stats: new Map(), prefs, when: NOW }).map((r) => r.id), ["a", "b", "c", "d"]);
  }],

  // ---- map placement ----
  ["geo: east-west road address lands on that road's row", () => {
    const p = gridPosition("33018 W 7 Mile Rd, Livonia, MI 48152");
    eq(p.row, 2);
    ok(p.col > 0.25 && p.col < 0.45, `col ${p.col}`); // between Farmington (33500) and Merriman (31500)
  }],
  ["geo: north-south road uses the road's column and the house number for the row", () => {
    const a = gridPosition("13900 Middlebelt Rd, Livonia, MI"), b = gridPosition("19055 Middlebelt Rd, Livonia, MI");
    ok(Math.abs(a.col - b.col) < 1e-9, "same column");
    ok(a.row > 4 && a.row < 5.5, `13900 between 5 Mile and Schoolcraft: ${a.row}`);
    ok(b.row > 2 && b.row < 2.3, `19055 just south of 7 Mile: ${b.row}`);
  }],
  ["geo: Grand River is diagonal, unknown streets are null", () => {
    ok(gridPosition("27434 Grand River Ave").row < gridPosition("25029 Grand River Ave").row, "further west = further north");
    eq(gridPosition("123 Main St"), null);
    eq(gridPosition(""), null);
  }],
  ["geo: every seed-style corridor parses", () => {
    for (const a of ["29499 Plymouth Rd", "28599 Schoolcraft Rd", "35780 Five Mile Rd", "37140 Six Mile Rd", "27725 W 8 Mile Rd",
      "29505 W 9 Mile Rd", "19217 Newburgh Rd", "15439 Beech Daly Rd", "14635 Telegraph Rd", "20780 Farmington Rd"]) ok(gridPosition(a), a);
  }],

  // ---- cuisine styling ----
  ["cuisine: icon follows first matching cuisine, with a fallback", () => {
    eq(cuisineStyle(place("a", { cuisines: ["pizza", "italian"] })).icon, "pizza");
    eq(cuisineStyle(place("a", { cuisines: ["lebanese"] })).icon, "lemon");
    eq(cuisineStyle(place("a", { cuisines: ["martian"] })).icon, "tools-kitchen-2");
  }],
  ["filter: craving (anyOf) matches cuisines or tags", () => {
    const pizza = CRAVINGS.find((c) => c.key === "pizza").match, healthy = CRAVINGS.find((c) => c.key === "healthy").match;
    const list = [place("a", { cuisines: ["pizza"] }), place("b", { cuisines: ["lebanese"], tags: ["healthy"] }), place("c", { cuisines: ["bbq"] })];
    eq(filterPlaces(list, { anyOf: pizza }).map((r) => r.id), ["a"]);
    eq(filterPlaces(list, { anyOf: healthy }).map((r) => r.id), ["b"]);
  }],

  // ---- validator ----
  ["validate: good record passes, bad fields are caught", () => {
    eq(validateRestaurants([place("good-one")]).errors, []);
    const { errors } = validateRestaurants([
      place("Bad ID"), place("dup"), place("dup"),
      place("x", { ho: "11am-9pm", web: "javascript:alert(1)", status: "maybe", cuisines: ["Thai"], specials: [["Mon", "x"]] }),
    ]);
    ok(errors.some((e) => e.includes("kebab")), "id");
    ok(errors.some((e) => e.includes("duplicate")), "dup");
    for (const k of ["bad hours", "web must", "status must", "lowercase", "specials"]) ok(errors.some((e) => e.includes(k)), k);
  }],
];
