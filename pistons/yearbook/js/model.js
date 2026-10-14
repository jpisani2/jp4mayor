/* Pistons Yearbook projection model. Shared by the build script (node) and the page (browser).
   Preseason: Marcel-style. Last three seasons weighted 6/3/1 by minutes, regressed toward the
   2025-26 league average for the player's position group, adjusted for age, with minutes fitted
   to a 240-minute team game. In season: the frozen preseason rates are blended with this season's
   numbers, leaning on the real numbers more as minutes pile up. */
(function (root) {
  "use strict";
  // per-36 league rates by position group, 2025-26 (Basketball Reference per-minute table, minute-weighted)
  const LEAGUE = {
    G: { fgm: 6.135, fga: 13.738, tpm: 2.359, tpa: 6.507, ftm: 2.672, fta: 3.273, oreb: 1.02, reb: 4.698, ast: 4.909, stl: 1.377, blk: 0.426, tov: 2.162, pts: 17.312 },
    W: { fgm: 6.545, fga: 14.038, tpm: 2.178, tpa: 6.005, ftm: 2.861, fta: 3.574, oreb: 1.441, reb: 6.161, ast: 3.6, stl: 1.261, blk: 0.572, tov: 2.023, pts: 18.092 },
    B: { fgm: 6.262, fga: 12.341, tpm: 1.425, tpa: 4.041, ftm: 2.763, fta: 3.747, oreb: 2.665, reb: 8.995, ast: 3.063, stl: 1.111, blk: 1.167, tov: 1.946, pts: 16.72 },
    ALL: { fgm: 6.261, fga: 13.293, tpm: 1.987, tpa: 5.52, ftm: 2.742, fta: 3.502, oreb: 1.695, reb: 6.533, ast: 3.988, stl: 1.259, blk: 0.721, tov: 2.057, pts: 17.251 }
  };
  const STATS = ["pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "oreb"];
  // ESPN season row: [yr,tm,gp,gs,mpg,fgm,fga,tpm,tpa,ftm,fta,oreb,dreb,reb,ast,blk,stl,pf,tov,pts,dd,td] (counts are season totals)
  const COL = { gp: 2, gs: 3, mpg: 4, fgm: 5, fga: 6, tpm: 7, tpa: 8, ftm: 9, fta: 10, oreb: 11, dreb: 12, reb: 13, ast: 14, blk: 15, stl: 16, pf: 17, tov: 18, pts: 19, dd: 20, td: 21 };
  const P = {
    weights: { 0: 6, 1: 3, 2: 1 },      // seasons back from the last one
    regMin: 2000,                       // regression, in weighted minutes (6/3/1 units), about 200 real minutes
    pctK: { fg: 1000, tp: 1250, ft: 500 }, // regression for percentages, in weighted attempts (6/3/1 units)
    availPrior: 0.80,                   // share of games a typical rotation player plays
    teamMin: 241,                       // minutes per team game incl. a little overtime
    inSeasonK: 400,                     // in-season: prior rates are worth this many minutes
    inSeasonMinG: 8,                    // in-season: prior minutes are worth this many games
    inSeasonAvailG: 15,                 // in-season: prior availability is worth this many team games
    inSeasonPctK: { fg: 150, tp: 250, ft: 100 }
  };

  // one row per season (2TM/TOT row if traded, else the single row)
  function seasons(rows) {
    const by = {};
    for (const r of rows || []) {
      const y = r[0];
      if (!by[y]) by[y] = [];
      by[y].push(r);
    }
    return Object.keys(by).map(Number).sort((a, b) => a - b).map(y => {
      const rs = by[y], tot = rs.find(r => r[1] === "TOT");
      const r = tot || rs[0];
      const o = { y, teams: rs.filter(x => x[1] !== "TOT").map(x => x[1]), gp: r[COL.gp], gs: r[COL.gs], mpg: r[COL.mpg] };
      o.min = o.gp * o.mpg;
      for (const s of STATS) o[s] = r[COL[s]];
      return o;
    });
  }

  function ageAt(dob, when) {
    const d = new Date(dob), w = new Date(when);
    let a = w.getUTCFullYear() - d.getUTCFullYear();
    if (w.getUTCMonth() < d.getUTCMonth() || (w.getUTCMonth() === d.getUTCMonth() && w.getUTCDate() < d.getUTCDate())) a--;
    return a;
  }
  // yearly change in production by age (age during the projected season)
  function ageDelta(age) {
    if (age <= 21) return 0.06; if (age === 22) return 0.05; if (age === 23) return 0.04; if (age === 24) return 0.03;
    if (age === 25) return 0.02; if (age === 26) return 0.01; if (age <= 28) return 0; if (age === 29) return -0.01;
    if (age === 30) return -0.015; if (age === 31) return -0.02; if (age === 32) return -0.03; return -0.04;
  }
  const AGE_SHARE = { pts: 1, ast: 1, stl: 0.5, blk: 0.5, fgm: 1, fga: 1, tpm: 1, tpa: 1, ftm: 1, fta: 1, reb: 0.5, oreb: 0.5, tov: 0.5 };

  /* Raw preseason projection for one player (before the team-minutes fit).
     p: {grp:"G"|"W"|"B", dob, rows:[espn rows], rookie:{mpg, gpShare}, newTeam:bool, twoWay:bool}
     lastYear: the last completed season (2026 = 2025-26). */
  function prior(p, lastYear, when) {
    const L = LEAGUE[p.grp] || LEAGUE.ALL;
    const age = ageAt(p.dob, when);
    const dAge = ageDelta(age);
    const ss = seasons(p.rows).filter(s => s.y <= lastYear && s.y > lastYear - 3 && s.gp > 0);
    let W = 0, Wg = 0, Wgp = 0, Wn = 0;
    const num = {};
    for (const s of STATS) num[s] = 0;
    for (const s of ss) {
      const w = P.weights[lastYear - s.y];
      W += w * s.min; Wg += w * s.gp; Wgp += w * 82; Wn += w;
      for (const k of STATS) num[k] += w * s[k];
    }
    const out = { age, dAge, grp: p.grp, wMin: W, seasonsUsed: ss.map(s => s.y), noNBA: ss.length === 0 };
    // per-minute rates, regressed
    const rate = {};
    for (const k of STATS) {
      let base = (num[k] + P.regMin * L[k] / 36) / (W + P.regMin);
      if (out.noNBA) base = (L[k] / 36) * (["pts", "fgm", "fga", "ftm", "fta", "ast", "tpm", "tpa"].includes(k) ? 0.85 : 1);
      rate[k] = base * (1 + dAge * (AGE_SHARE[k] || 0));
    }
    // shooting percentages, regressed toward league
    const lg = { fg: LEAGUE.ALL.fgm / LEAGUE.ALL.fga, tp: LEAGUE.ALL.tpm / LEAGUE.ALL.tpa, ft: LEAGUE.ALL.ftm / LEAGUE.ALL.fta };
    const lgG = { fg: L.fgm / L.fga, tp: lg.tp, ft: lg.ft };
    const pct = {}, att = {};
    const pairs = { fg: ["fgm", "fga"], tp: ["tpm", "tpa"], ft: ["ftm", "fta"] };
    for (const [k, [m, a]] of Object.entries(pairs)) {
      const K = P.pctK[k];
      let target = lgG[k];
      // players who rarely shoot threes make them less often: pull them toward a lower mark
      if (k === "tp" && W > 0) target -= 0.06 * Math.max(0, 1 - (num.tpa / W * 36) / 4);
      pct[k] = out.noNBA ? lgG[k] - (k === "ft" ? 0.03 : 0.02) : (num[m] + K * target) / (num[a] + K);
      att[k] = num[a];
      const adj = age <= 24 ? { fg: 0.006, tp: 0.005, ft: 0.005 }[k] : age >= 32 ? { fg: -0.005, tp: -0.004, ft: 0 }[k] : 0;
      pct[k] += adj;
    }
    // re-derive made shots from attempts and regressed percentages so they agree
    rate.fgm = rate.fga * pct.fg; rate.tpm = rate.tpa * pct.tp; rate.ftm = rate.fta * pct.ft;
    out.rate = rate; out.pct = pct; out.attW = att;
    // minutes and availability
    let mpg;
    if (out.noNBA) mpg = (p.rookie && p.rookie.mpg) || 6;
    else {
      mpg = W / Wg;
      mpg = (mpg * Wg + 18 * 20) / (Wg + 20); // light pull toward 18 mpg (20 weighted games)
      mpg *= 1 + dAge * 0.5;
    }
    let avail = out.noNBA ? ((p.rookie && p.rookie.gpShare) || 0.5) : (Wg + 4 * P.availPrior * 82) / (Wgp + 4 * 82);
    out.mpgRaw = Math.min(mpg, 37.5);
    out.avail = Math.min(avail, 0.95);
    if (p.twoWay) out.avail = Math.min(out.avail, 50 / 82);
    // uncertainty (relative, one standard deviation)
    const rel = P.regMin / (P.regMin + W);
    out.uRate = out.noNBA ? 0.35 : 0.04 + 0.4 * rel;
    out.uMin = out.noNBA ? 0.45 : 0.06 + 0.3 * rel + (p.newTeam ? 0.06 : 0);
    return out;
  }

  /* Fit everyone's minutes to a 240-minute game. Players with mid-sized roles give up the most;
     a 34-minute star and a 6-minute reserve barely move. */
  function fitMinutes(list) {
    const sumA = () => list.reduce((a, x) => a + x.mpg * x.avail, 0);
    for (const x of list) x.mpg = x.mpgRaw;
    for (let it = 0; it < 30; it++) {
      const over = sumA() - P.teamMin;
      if (Math.abs(over) < 0.05) break;
      const w = list.map(x => Math.max(0, x.mpg * (1 - x.mpg / 40)) * x.avail);
      const W = w.reduce((a, b) => a + b, 0);
      if (!W) break;
      list.forEach((x, i) => { x.mpg = Math.max(3, Math.min(37.5, x.mpg - over * (w[i] / W) / x.avail)); });
    }
    return sumA();
  }

  const Z80 = 1.2816; // 10th to 90th percentile
  function perGame(pr) {
    const g = {};
    for (const k of STATS) g[k] = pr.rate[k] * pr.mpg;
    g.min = pr.mpg;
    return g;
  }
  /* Final preseason projection: per game, ranges, totals. */
  function finish(pr) {
    const g = perGame(pr);
    const u = Math.sqrt(pr.uRate * pr.uRate + pr.uMin * pr.uMin);
    const gp = Math.round(82 * pr.avail);
    const range = {};
    for (const k of STATS) range[k] = [Math.max(0, g[k] * (1 - Z80 * u)), g[k] * (1 + Z80 * u)];
    range.min = [Math.max(0, g.min * (1 - Z80 * pr.uMin)), Math.min(42, g.min * (1 + Z80 * pr.uMin))];
    const pr2 = {};
    const att = { fg: g.fga * gp, tp: g.tpa * gp, ft: g.fta * gp };
    const K = P.pctK;
    for (const k of ["fg", "tp", "ft"]) {
      const p = pr.pct[k];
      const sdModel = Math.sqrt(p * (1 - p) / ((pr.attW[k] || 0) / 3.3 + K[k] / 3.3));
      const sdSeason = att[k] > 0 ? Math.sqrt(p * (1 - p) / att[k]) : 0.1;
      const sd = Math.sqrt(sdModel * sdModel + sdSeason * sdSeason);
      pr2[k] = [Math.max(0, p - Z80 * sd), Math.min(1, p + Z80 * sd)];
    }
    const gpSd = pr.noNBA ? 18 : 12;
    const tot = {};
    for (const k of STATS) tot[k] = g[k] * gp;
    tot.min = g.min * gp;
    return { g, range, pct: pr.pct, pctRange: pr2, gp, gpRange: [Math.max(0, Math.round(gp - Z80 * gpSd)), Math.min(82, Math.round(gp + Z80 * gpSd))], tot,
      ts: g.pts / (2 * (g.fga + 0.44 * g.fta)), avail: pr.avail, rate: pr.rate, mpg: pr.mpg, u, uRate: pr.uRate, uMin: pr.uMin };
  }

  /* In-season blend. pre: frozen preseason projection (finish() output). act: {gp, min, pts, ...totals, fgm, fga, ...}
     teamGP: team games played; teamLeft: team games left; twoWay: bool */
  function blend(pre, act, teamGP, teamLeft, twoWay) {
    const K = P.inSeasonK, out = { g: {}, tot: {}, pct: {}, range: {} };
    const rate = {};
    // a stat the box scores don't carry (turnovers, offensive rebounds) keeps its preseason rate
    for (const k of STATS) rate[k] = act[k] === undefined ? pre.rate[k] : (pre.rate[k] * K + act[k]) / (K + (act.min || 0));
    const mpg = (pre.mpg * P.inSeasonMinG + (act.min || 0)) / (P.inSeasonMinG + (act.gp || 0));
    const avail = Math.min(0.97, (pre.avail * P.inSeasonAvailG + (act.gp || 0)) / (P.inSeasonAvailG + teamGP));
    let rem = avail * teamLeft;
    if (twoWay) rem = Math.min(rem, Math.max(0, 50 - (act.gp || 0)));
    const gp = (act.gp || 0) + rem;
    for (const k of STATS) {
      out.tot[k] = (act[k] === undefined ? rate[k] * (act.min || 0) : act[k]) + rem * rate[k] * mpg;
      out.g[k] = gp > 0 ? out.tot[k] / gp : rate[k] * mpg;
    }
    out.tot.min = (act.min || 0) + rem * mpg;
    out.g.min = gp > 0 ? out.tot.min / gp : mpg;
    const pk = P.inSeasonPctK, pairs = { fg: ["fgm", "fga"], tp: ["tpm", "tpa"], ft: ["ftm", "fta"] };
    for (const [k, [m, a]] of Object.entries(pairs)) {
      const p = (pre.pct[k] * pk[k] + (act[m] || 0)) / (pk[k] + (act[a] || 0));
      const remAtt = rem * rate[a] * mpg;
      out.pct[k] = (act[a] || 0) + remAtt > 0 ? ((act[m] || 0) + remAtt * p) / ((act[a] || 0) + remAtt) : p;
    }
    // range shrinks as the season is played
    const share = gp > 0 ? rem / gp : 1;
    const u = Math.max(0.02, pre.u * Math.sqrt(share));
    for (const k of STATS) out.range[k] = [out.g[k] * (1 - Z80 * u), out.g[k] * (1 + Z80 * u)];
    out.gp = gp; out.rem = rem; out.avail = avail; out.mpg = mpg; out.rate = rate; out.u = u;
    out.ts = out.g.pts / (2 * (out.g.fga + 0.44 * out.g.fta));
    return out;
  }

  /* Games needed for a milestone and the projected team game number it lands in. */
  function eta(need, perGameVal, avail) {
    if (need <= 0) return { games: 0, teamGames: 0 };
    if (!(perGameVal > 0)) return null;
    const games = Math.ceil(need / perGameVal - 1e-9);
    return { games, teamGames: Math.ceil(games / Math.max(0.2, avail)) };
  }

  const api = { LEAGUE, STATS, COL, P, seasons, ageAt, ageDelta, prior, fitMinutes, finish, blend, eta, perGame };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.YBModel = api;
})(typeof window !== "undefined" ? window : globalThis);
