// Fetch the 5 most recent Google reviews (with dates) for some places — used by the weekly routine
// ONLY when a GOOGLE_PLACES_KEY environment variable is set. Without a key it exits quietly.
//
//   node scripts/google-reviews.mjs <id> [<id> ...]      → writes .cache/google-reviews.json (not committed)
//
// Output per place: { id, gpid, rating, count, reviews: [{ stars, published: "YYYY-MM-DD", text }] }.
// The routine reads that file, writes a short summary into restaurants.json → reviews
// ({ summary, basis: "recent", n, newest, oldest, source: "google", checked }), and stores gpid on the record
// so the next lookup skips the search. Raw review text is never committed.
//
// Cost: Text Search with only place IDs is free; Place Details with reviews uses the
// "Enterprise + Atmosphere" SKU (1,000 free calls/month). ~70 places/week stays well inside that.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KEY = process.env.GOOGLE_PLACES_KEY;
if (!KEY) { console.log("No GOOGLE_PLACES_KEY set — skipping Google reviews (undated summaries stay as they are)."); process.exit(0); }

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const places = JSON.parse(readFileSync(join(root, "data", "restaurants.json"), "utf8"));
const area = JSON.parse(readFileSync(join(root, "data", "area.json"), "utf8"));
const ids = process.argv.slice(2);
const targets = ids.length ? places.filter((p) => ids.includes(p.id)) : [];
if (!targets.length) { console.error("Pass one or more restaurant ids."); process.exit(1); }

const H = (mask) => ({ "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": mask });
const day = (iso) => (iso ? iso.slice(0, 10) : null);

async function findId(p) {
  const [lat, lng] = p.ll || area.origin.ll;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: H("places.id,places.displayName,places.formattedAddress"),
    body: JSON.stringify({ textQuery: `${p.name}, ${p.addr}`, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 400 } }, maxResultCount: 1 }),
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()).places?.[0]?.id || null;
}

async function details(gpid) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${gpid}`, { headers: H("id,rating,userRatingCount,reviews") });
  if (!res.ok) throw new Error(`details ${res.status}`);
  return res.json();
}

const out = [];
for (const p of targets) {
  try {
    const gpid = p.gpid || (await findId(p));
    if (!gpid) { out.push({ id: p.id, error: "not found on Google" }); continue; }
    const d = await details(gpid);
    out.push({
      id: p.id, gpid, rating: d.rating ?? null, count: d.userRatingCount ?? null,
      reviews: (d.reviews || []).map((r) => ({ stars: r.rating, published: day(r.publishTime), text: r.text?.text || r.originalText?.text || "" })),
    });
  } catch (e) {
    out.push({ id: p.id, error: String(e.message || e) });
  }
  await new Promise((r) => setTimeout(r, 150));
}
mkdirSync(join(root, ".cache"), { recursive: true });
writeFileSync(join(root, ".cache", "google-reviews.json"), JSON.stringify(out, null, 2));
console.log(`Google reviews: ${out.filter((o) => !o.error).length} ok, ${out.filter((o) => o.error).length} failed → .cache/google-reviews.json`);
