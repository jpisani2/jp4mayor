// Data checks for data/*.json. Pure — used by scripts/validate.mjs (Node, weekly routine) and tests/run.html.
import { isValidHours } from "./hours.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/\S+$/i;
const STATUS = ["open", "closed_temp", "closed"];

// -> { errors: [], warnings: [] }
export function validateRestaurants(list, area = null) {
  const errors = [], warnings = [];
  if (!Array.isArray(list)) return { errors: ["restaurants.json must be an array"], warnings };
  const seen = new Set();
  list.forEach((r, i) => {
    const at = `#${i} ${r?.id || r?.name || ""}`.trim();
    const err = (m) => errors.push(`${at}: ${m}`);
    const warn = (m) => warnings.push(`${at}: ${m}`);
    if (!r || typeof r !== "object") return err("not an object");

    if (!ID.test(r.id || "")) err("id must be lowercase-kebab-case");
    if (seen.has(r.id)) err("duplicate id"); seen.add(r.id);
    if (!r.name || typeof r.name !== "string") err("name required");
    if (!r.town) warn("missing town");
    if (!r.addr) warn("missing addr");

    if (r.ll != null) {
      if (!Array.isArray(r.ll) || r.ll.length !== 2 || !r.ll.every((n) => typeof n === "number")) err("ll must be [lat, lng]");
      else if (area?.bbox) {
        const [lat, lng] = r.ll, b = area.bbox;
        if (lat < b.latMin || lat > b.latMax || lng < b.lngMin || lng > b.lngMax) warn(`ll ${lat},${lng} is outside the area box — double-check the address`);
      }
    }

    for (const k of ["cuisines", "tags", "highlights"]) {
      if (r[k] != null && (!Array.isArray(r[k]) || !r[k].every((s) => typeof s === "string" && s.trim()))) err(`${k} must be an array of strings`);
    }
    if (!r.cuisines?.length) warn("no cuisines");
    if ((r.cuisines || []).some((c) => c !== c.toLowerCase())) err("cuisines must be lowercase");
    if ((r.tags || []).some((c) => c !== c.toLowerCase())) err("tags must be lowercase");

    if (r.price != null && ![1, 2, 3, 4].includes(r.price)) err("price must be 1–4 or null");
    for (const k of ["dineIn", "carryOut", "delivery"]) if (r[k] != null && typeof r[k] !== "boolean") err(`${k} must be true/false/null`);
    if (!isValidHours(r.ho)) err(`bad hours "${r.ho}"`);
    if (r.ho == null || r.ho === "?") warn("hours unknown");

    for (const k of ["web", "menuUrl"]) if (r[k] != null && !URL_RE.test(r[k])) err(`${k} must be an http(s) URL`);
    for (const k of ["order", "social"]) {
      if (r[k] == null) continue;
      if (typeof r[k] !== "object" || Array.isArray(r[k])) err(`${k} must be an object of name → URL`);
      else for (const [n, u] of Object.entries(r[k])) if (!URL_RE.test(u)) err(`${k}.${n} must be an http(s) URL`);
    }
    if (r.specials != null) {
      if (!Array.isArray(r.specials) || !r.specials.every((s) => Array.isArray(s) && /^[0-6]{1,7}$/.test(String(s[0])) && typeof s[1] === "string"))
        err('specials must be [["days 0-6", "text"], ...]');
    }
    if (r.rating != null) {
      for (const k of ["google", "yelp"]) if (r.rating[k] != null && !(r.rating[k] >= 1 && r.rating[k] <= 5)) err(`rating.${k} must be 1–5`);
      if (r.rating.count != null && !Number.isInteger(r.rating.count)) err("rating.count must be an integer");
    }
    if (!STATUS.includes(r.status)) err(`status must be one of ${STATUS.join("/")}`);
    if (![1, 2, 3].includes(r.cf)) err("cf must be 1, 2 or 3");
    if (!DATE.test(r.dt || "")) err("dt must be YYYY-MM-DD");
    if (!DATE.test(r.firstSeen || "")) err("firstSeen must be YYYY-MM-DD");
    if (!r.ev) warn("no evidence notes (ev)");
  });
  return { errors, warnings };
}

export function validateNews(list) {
  const errors = [];
  if (!Array.isArray(list)) return { errors: ["news.json must be an array"], warnings: [] };
  list.forEach((n, i) => {
    if (!n.title) errors.push(`news #${i}: title required`);
    if (n.url != null && !URL_RE.test(n.url)) errors.push(`news #${i}: bad url`);
    if (n.date != null && !DATE.test(n.date)) errors.push(`news #${i}: date must be YYYY-MM-DD`);
  });
  return { errors, warnings: [] };
}

export function validateMeta(meta) {
  const errors = [];
  if (!meta || typeof meta !== "object") errors.push("meta.json must be an object");
  else if (!meta.updated || isNaN(Date.parse(meta.updated))) errors.push("meta.updated must be an ISO timestamp");
  return { errors, warnings: [] };
}
