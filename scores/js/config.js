// Scores — configuration

// If ESPN ever stops allowing direct browser requests (CORS), deploy
// relay/worker.js to Cloudflare Workers and put its URL here, e.g.
// 'https://scores-relay.yourname.workers.dev/'
export const RELAY = '';

export const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// season: [[startMonth, startDay], [endMonth, endDay]] — rough in-season window,
// used only to order the league chips on All scores.
export const LEAGUES = {
  nba: { key: 'nba', path: 'basketball/nba', tag: 'NBA', name: 'NBA', site: 'nba', sport: 'basketball', season: [[10, 1], [6, 25]] },
  nfl: { key: 'nfl', path: 'football/nfl', tag: 'NFL', name: 'NFL', site: 'nfl', sport: 'football', season: [[9, 1], [2, 15]] },
  nhl: { key: 'nhl', path: 'hockey/nhl', tag: 'NHL', name: 'NHL', site: 'nhl', sport: 'hockey', season: [[10, 1], [6, 25]] },
  mlb: { key: 'mlb', path: 'baseball/mlb', tag: 'MLB', name: 'MLB', site: 'mlb', sport: 'baseball', season: [[3, 15], [11, 5]] },
  cfb: { key: 'cfb', path: 'football/college-football', tag: 'CFB', name: 'College Football', site: 'college-football', sport: 'football', college: true, allGroup: '80', b10Group: '5', season: [[8, 20], [1, 25]] },
  cbb: { key: 'cbb', path: 'basketball/mens-college-basketball', tag: 'CBB', name: "Men's College Basketball", site: 'mens-college-basketball', sport: 'basketball', college: true, allGroup: '50', b10Group: '7', season: [[11, 1], [4, 10]] },
};

export const ORDER = ['nba', 'nfl', 'nhl', 'mlb', 'cfb', 'cbb'];

export const WINDOW_DAYS = 15;
export const LIVE_REFRESH_MS = 30000;
