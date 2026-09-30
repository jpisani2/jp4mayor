/* Presentation helpers. No state, no database, no DOM. */

export const money = n => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);

export const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Catalog bets are written with {home} and {away} so they read as real team
   names once a game is loaded. */
export function withTeams(text, game) {
  if (!game) return String(text);
  return String(text)
    .replace(/\{home\}/g, game.home_team)
    .replace(/\{away\}/g, game.away_team);
}

export const matchup = game => game ? `${game.away_team} at ${game.home_team}` : "";

/* "Amy", "Amy and Bob", "Amy, Bob and Cal". */
export function listNames(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

export const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;

/* Today's date as YYYY-MM-DD in this device's own time zone. */
export function localDate(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
