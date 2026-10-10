// Decision engine — pure functions, no DOM, no storage. Imported by app.js and tests.
import { isOpenAt, statusText } from "./hours.js";

export const DEFAULT_WEIGHTS = {
  quality: 3,   // how good it is (your ratings, else Google/Yelp)
  recency: 2,   // how long since you last went
  novelty: 0.7, // bonus for never-tried places
  favorite: 1,  // bonus for favorites
  special: 0.5, // bonus when a special runs today
  distance: 1,  // penalty for driving time from home (full penalty at 20+ min)
};

// "3.1 mi · ~6 min" — driving distance from home (7 Mile & Inkster), precomputed in the data.
export const driveText = (r) => (r.drive ? `${r.drive.mi < 0.1 ? "<0.1" : r.drive.mi.toFixed(1)} mi · ~${Math.max(1, Math.round(r.drive.min))} min` : "");

const DAY = 86400000;
const lc = (a) => (a || []).map((s) => String(s).toLowerCase());

// Visits -> per-restaurant summary. visits: [{restaurant_id, visited_on:'YYYY-MM-DD', rating, would_return, dishes}]
export function summarize(visits, now = new Date()) {
  const by = new Map();
  for (const v of visits || []) {
    const s = by.get(v.restaurant_id) || { count: 0, ratings: [], last: null, lastVisit: null };
    s.count++;
    if (v.rating) s.ratings.push(v.rating);
    if (!s.last || v.visited_on > s.last) { s.last = v.visited_on; s.lastVisit = v; }
    by.set(v.restaurant_id, s);
  }
  for (const s of by.values()) {
    s.avg = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
    s.daysSince = s.last ? Math.max(0, Math.floor((startOfDay(now) - new Date(s.last + "T00:00:00")) / DAY)) : null;
  }
  return by;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function todaySpecials(r, date = new Date()) {
  const d = String(date.getDay());
  return (r.specials || []).filter(([days]) => String(days).includes(d)).map(([, text]) => text);
}

export function externalRating(r) {
  const rs = [r.rating?.google, r.rating?.yelp].filter((x) => typeof x === "number");
  return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
}

// ---- Filtering ---------------------------------------------------------------

// opts: { mode:'dine_in'|'carry_out'|'any', when:Date, openOnly, allowUnknownHours, cuisines[], tags[],
//         anyOf[] (craving: matches any cuisine or tag), maxPrice, maxMinutes, favoritesOnly, neverTried,
//         prefs:Map, stats:Map, search }
export function filterPlaces(places, opts = {}) {
  const { mode = "any", when = new Date(), openOnly = false, allowUnknownHours = true,
          cuisines = [], tags = [], anyOf = [], maxPrice = null, maxMinutes = null, favoritesOnly = false, neverTried = false,
          prefs = new Map(), stats = new Map(), search = "" } = opts;
  const q = search.trim().toLowerCase();
  return places.filter((r) => {
    if (r.status && r.status !== "open") return false;
    const p = prefs.get(r.id);
    if (p?.hidden) return false;
    if (mode === "carry_out" && r.carryOut === false) return false;
    if (mode === "dine_in" && r.dineIn === false) return false;
    if (openOnly) {
      const open = isOpenAt(r.ho, when);
      if (open === false || (open === null && !allowUnknownHours)) return false;
    }
    if (cuisines.length && !lc(r.cuisines).some((c) => cuisines.includes(c))) return false;
    if (anyOf.length && ![...lc(r.cuisines), ...lc(r.tags)].some((t) => anyOf.includes(t))) return false;
    if (tags.length && !tags.every((t) => lc(r.tags).includes(t) || lc(p?.my_tags).includes(t))) return false;
    if (maxPrice && r.price && r.price > maxPrice) return false;
    if (maxMinutes && r.drive && r.drive.min > maxMinutes) return false;
    if (favoritesOnly && !p?.favorite) return false;
    if (neverTried && stats.get(r.id)) return false;
    if (q && ![r.name, r.town, ...(r.cuisines || []), ...(r.tags || []), ...(r.highlights || [])]
      .some((s) => String(s || "").toLowerCase().includes(q))) return false;
    return true;
  });
}

// ---- Scoring -----------------------------------------------------------------

// ctx: { stats:Map, prefs:Map, weights, when:Date, boostTags[], penalizeTags[], preferKnown:bool }
export function scorePlace(r, ctx) {
  const w = { ...DEFAULT_WEIGHTS, ...(ctx.weights || {}) };
  const s = ctx.stats?.get(r.id);
  const p = ctx.prefs?.get(r.id);
  const when = ctx.when || new Date();

  let quality;
  if (s?.avg) quality = (s.avg - 1) / 4;                       // your rating 1..5 -> 0..1
  else {
    const ext = externalRating(r);
    quality = ext ? Math.min(1, Math.max(0, (ext - 3) / 2)) * 0.85 : 0.45; // untried = a bit uncertain
  }
  // Recency: just went -> ~0, two weeks -> ~0.63, six weeks -> ~0.95. Never been -> 1.
  const recency = s?.daysSince == null ? 1 : 1 - Math.exp(-s.daysSince / 14);
  const novelty = s ? 0 : 1;
  const favorite = p?.favorite ? 1 : 0;
  const specials = todaySpecials(r, when);

  // Distance: 0 at the door, 1 at 20+ minutes away. Unknown distance = middling.
  const far = r.drive ? Math.min(1, r.drive.min / 20) : 0.5;

  let score = w.quality * quality + w.recency * recency + w.novelty * novelty + w.favorite * favorite
            + w.special * (specials.length ? 1 : 0) - w.distance * far;

  if (s?.lastVisit?.would_return === false) score -= 1.5;
  if (isOpenAt(r.ho, when) === null) score -= 0.3;

  const tags = [...lc(r.tags), ...lc(r.cuisines), ...lc(p?.my_tags)];
  const hits = (list) => (list || []).filter((t) => tags.includes(t)).length;
  score += 0.6 * Math.min(2, hits(ctx.boostTags));
  score -= 0.6 * Math.min(2, hits(ctx.penalizeTags));
  if (ctx.preferKnown) score += s?.avg >= 4 ? 1.2 : s ? 0 : -0.8;

  return { score, quality, recency, specials, far };
}

export function reasons(r, ctx) {
  const s = ctx.stats?.get(r.id);
  const p = ctx.prefs?.get(r.id);
  const out = [];
  if (s?.avg) out.push(`You: ${s.avg.toFixed(1)}★ (${s.count} visit${s.count > 1 ? "s" : ""})`);
  else if (externalRating(r)) out.push(`${externalRating(r).toFixed(1)}★ online`);
  if (!s) out.push("Never tried");
  else if (s.daysSince != null) out.push(s.daysSince === 0 ? "Went today" : `${s.daysSince} day${s.daysSince === 1 ? "" : "s"} since last visit`);
  if (p?.favorite) out.push("Favorite");
  if (r.drive) out.push(driveText(r));
  for (const sp of todaySpecials(r, ctx.when || new Date())) out.push(sp);
  out.push(statusText(r.ho, ctx.when || new Date()));
  return out;
}

// ---- Picking -----------------------------------------------------------------

export function rank(places, ctx) {
  return places
    .map((r) => ({ r, ...scorePlace(r, ctx) }))
    .sort((a, b) => b.score - a.score);
}

// Weighted random from the top N so the answer isn't identical every time.
export function pick(places, ctx, { topN = 8, temperature = 0.6, rng = Math.random } = {}) {
  const ranked = rank(places, ctx);
  if (!ranked.length) return null;
  const pool = ranked.slice(0, topN);
  const max = pool[0].score;
  const ws = pool.map((x) => Math.exp((x.score - max) / temperature));
  let roll = rng() * ws.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < pool.length - 1 && (roll -= ws[i]) > 0) i++;
  const choice = pool[i];
  const alternates = ranked.filter((x) => x !== choice).slice(0, 2);
  return { choice, alternates, poolSize: places.length };
}

// ---- Mood --------------------------------------------------------------------

const LIGHT = ["healthy", "salad", "salads", "sushi", "poke", "mediterranean", "middle eastern", "soup", "vegetarian", "vegan", "thai", "vietnamese", "pho", "greek", "sandwiches", "deli", "bowls"];
const HEARTY = ["comfort", "bbq", "barbecue", "burgers", "pizza", "wings", "italian", "mexican", "fried chicken", "chicken", "steak", "steakhouse", "soul food", "breakfast", "diner", "coney", "chinese", "indian", "tacos", "subs"];

// answers: { style:'sit'|'grab'|'any', appetite:'light'|'hearty'|'any', novelty:'usual'|'new'|'any', budget:1|2|3|null }
export function moodToOptions(answers = {}) {
  const filter = { mode: "any", maxPrice: null };
  const ctx = { boostTags: [], penalizeTags: [], weights: {} };
  if (answers.style === "sit") filter.mode = "dine_in";
  if (answers.style === "grab") filter.mode = "carry_out";
  if (answers.appetite === "light") { ctx.boostTags = LIGHT; ctx.penalizeTags = HEARTY; }
  if (answers.appetite === "hearty") { ctx.boostTags = HEARTY; ctx.penalizeTags = LIGHT; }
  if (answers.novelty === "usual") { ctx.preferKnown = true; ctx.weights.novelty = 0; }
  if (answers.novelty === "new") { ctx.weights.novelty = 3; ctx.weights.recency = 3; }
  if (answers.budget) filter.maxPrice = answers.budget;
  return { filter, ctx };
}

// Candidates for the wheel: favorites if there are enough, otherwise the top-scored few.
export function wheelCandidates(places, ctx, { size = 10 } = {}) {
  const favs = places.filter((r) => ctx.prefs?.get(r.id)?.favorite);
  if (favs.length >= 4) return favs.slice(0, 12);
  return rank(places, ctx).slice(0, size).map((x) => x.r);
}
