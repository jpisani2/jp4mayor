// node scripts/validate.mjs  — exits 1 on any error. Run before every data commit.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateRestaurants, validateNews, validateMeta } from "../js/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

let failed = false;
const report = (name, { errors, warnings }) => {
  for (const w of warnings) console.warn(`  warn  ${name}: ${w}`);
  for (const e of errors) console.error(`  ERROR ${name}: ${e}`);
  if (errors.length) failed = true;
  console.log(`${errors.length ? "✗" : "✓"} ${name} — ${errors.length} errors, ${warnings.length} warnings`);
};

try {
  const area = load("area.json");
  const places = load("restaurants.json");
  report("restaurants.json", validateRestaurants(places, area));
  report("news.json", validateNews(load("news.json")));
  report("meta.json", validateMeta(load("meta.json")));
  const open = places.filter((p) => p.status === "open").length;
  console.log(`${places.length} places (${open} open)`);
} catch (e) {
  console.error("Could not read/parse data:", e.message);
  failed = true;
}
process.exit(failed ? 1 : 0);
