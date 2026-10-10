// Place a restaurant on the drawn road-grid map from its street address alone.
// The home area is a square-mile road grid, so "33018 W 7 Mile" = on the 7 Mile line,
// at house number 33018 (between Farmington Rd ~33500 and Merriman ~31500).

// East–west roads → row (0 = 9 Mile at the top, 6 = Plymouth at the bottom).
export const EW_ROADS = [
  { name: "9 Mile", row: 0, re: /\b(9|nine) mile\b/i },
  { name: "8 Mile", row: 1, re: /\b(8|eight) mile\b/i },
  { name: "7 Mile", row: 2, re: /\b(7|seven) mile\b/i },
  { name: "6 Mile", row: 3, re: /\b(6|six) mile\b/i },
  { name: "5 Mile", row: 4, re: /\b(5|five) mile\b/i },
  { name: "Schoolcraft", row: 5, re: /\bschoolcraft\b/i },
  { name: "Plymouth", row: 6, re: /\bplymouth (rd|road)\b/i },
];

// North–south roads → east–west house number where they cross the grid.
export const NS_ROADS = [
  { name: "Newburgh", num: 37500, re: /\b(newburgh|halsted)\b/i },
  { name: "Levan", num: 35500, re: /\blevan\b/i },
  { name: "Farmington", num: 33500, re: /\bfarmington (rd|road)\b/i },
  { name: "Merriman", num: 31500, re: /\b(merriman|orchard lake)\b/i },
  { name: "Middlebelt", num: 29500, re: /\bmiddlebelt\b/i },
  { name: "Inkster", num: 27500, re: /\binkster\b/i },
  { name: "Beech Daly", num: 25800, re: /\bbeech daly\b/i },
  { name: "Telegraph", num: 24000, re: /\btelegraph\b/i },
  { name: "Lahser", num: 22000, re: /\blahser\b/i },
];

// North–south house number → row (piecewise linear between known cross streets).
const NS_NUM_TO_ROW = [[11650, 6], [13150, 5], [15400, 4], [17300, 3], [19300, 2], [20500, 1], [22450, 0]];
// Grand River runs diagonally: house number → row.
const GRAND_RIVER = [[21800, 2.6], [25000, 1.6], [27400, 1.05], [29400, 0.6], [32400, 0]];

const WEST = 38200, EAST = 21500; // house-number span of the map, west → east

function interp(table, v) {
  if (v <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    if (v <= x1) return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}

// -> { col: 0..1 (west→east), row: 0..6 (north→south) } or null if the address can't be placed
export function gridPosition(addr) {
  if (!addr) return null;
  const m = String(addr).match(/^\s*(\d{4,5})\s+(.+?)(,|$)/);
  if (!m) return null;
  const num = Number(m[1]);
  const street = m[2];
  const col = (n) => Math.min(1, Math.max(0, (WEST - n) / (WEST - EAST)));

  if (/\bgrand river\b/i.test(street)) return { col: col(num), row: interp(GRAND_RIVER, num) };
  const ew = EW_ROADS.find((r) => r.re.test(street));
  if (ew) return { col: col(num), row: ew.row };
  const ns = NS_ROADS.find((r) => r.re.test(street));
  if (ns) return { col: col(ns.num), row: interp(NS_NUM_TO_ROW, num) };
  return null;
}

export const roadCol = (num) => (WEST - num) / (WEST - EAST);
