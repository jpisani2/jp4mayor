// Hours format (borrowed from happy-hour-map, extended):
//   ho = "Sun,Mon,Tue,Wed,Thu,Fri,Sat"  — 7 comma-separated day values
//   ho = "11-22"                         — a single value means every day
// Day value: "x" closed · "?" unknown · "11-22" · "11:30-21:30" · "11-14/17-21" (split shift)
// End times past midnight go above 24 ("17-26" = 5pm–2am). "0-24" = open 24 hours.

const toMin = (t) => {
  const [h, m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
};

// -> array[7]: null (unknown) | [] (closed) | [[startMin, endMin], ...]
export function parseHours(ho) {
  if (!ho || typeof ho !== "string") return Array(7).fill(null);
  let days = ho.split(",").map((s) => s.trim());
  if (days.length === 1) days = Array(7).fill(days[0]);
  if (days.length !== 7) return Array(7).fill(null);
  return days.map((d) => {
    if (d === "?" || d === "") return null;
    if (d === "x") return [];
    const ranges = [];
    for (const part of d.split("/")) {
      const m = part.match(/^(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)$/);
      if (!m) return null;
      ranges.push([toMin(m[1]), toMin(m[2])]);
    }
    return ranges;
  });
}

// Valid = 1 or 7 day values, each "x", "?", or well-formed ranges.
export function isValidHours(ho) {
  if (ho === undefined || ho === null) return true;
  if (typeof ho !== "string") return false;
  let raw = ho.split(",").map((s) => s.trim());
  if (raw.length === 1) raw = Array(7).fill(raw[0]);
  if (raw.length !== 7) return false;
  const week = parseHours(ho);
  return week.every((d, i) => d !== null || raw[i] === "?");
}

// true / false / null (unknown)
export function isOpenAt(ho, date = new Date()) {
  const week = parseHours(ho);
  const day = date.getDay();
  const min = date.getHours() * 60 + date.getMinutes();
  const today = week[day];
  const yday = week[(day + 6) % 7];
  // Spill-over from yesterday's late shift (e.g. "17-26" covers 0:00–2:00 today).
  if (yday && yday.some(([, e]) => e > 1440 && min < e - 1440)) return true;
  if (today === null) return null;
  return today.some(([s, e]) => min >= s && min < e);
}

export function fmtMin(m) {
  m = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

// Short human status, e.g. "Open · until 9pm", "Opens 11am", "Closed today", "Hours unknown"
export function statusText(ho, date = new Date()) {
  const week = parseHours(ho);
  const day = date.getDay();
  const min = date.getHours() * 60 + date.getMinutes();
  const yday = week[(day + 6) % 7];
  const spill = yday && yday.find(([, e]) => e > 1440 && min < e - 1440);
  if (spill) return `Open · until ${fmtMin(spill[1])}`;
  const today = week[day];
  if (today === null) return "Hours unknown";
  const cur = today.find(([s, e]) => min >= s && min < e);
  if (cur) {
    if (cur[0] === 0 && cur[1] >= 1440) return "Open 24 hours";
    return `Open · until ${fmtMin(cur[1])}`;
  }
  const next = today.find(([s]) => s > min);
  if (next) return `Opens ${fmtMin(next[0])}`;
  return today.length ? "Closed for today" : "Closed today";
}

// Human readable week for the detail page: [["Sun","11am–9pm"], ...]
export function weekText(ho) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return parseHours(ho).map((d, i) => [
    names[i],
    d === null ? "?" : d.length === 0 ? "Closed" : d.map(([s, e]) => (s === 0 && e >= 1440 ? "24 hours" : `${fmtMin(s)}–${fmtMin(e)}`)).join(", "),
  ]);
}
