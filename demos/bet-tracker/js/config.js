/* DEMO config. No database: the demo's db.js keeps everything in memory, so
   there is no URL or key here on purpose. The two tunables match the real app. */

export const SUPABASE_URL = "";
export const SUPABASE_KEY = "";

/* How many silent bets in a row before someone drops off other people's
   screens. See the spec: only player-made picks count, never an auto-out. */
export const DORMANT_AFTER = 5;

/* Most bets that can be open at once. */
export const MAX_OPEN_BETS = 10;
