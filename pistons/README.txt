PISTONS SEASON HUB - website files
==================================

Upload everything in this folder to your web host, keeping the folder structure:

  index.html          the page
  favicon.svg         browser-tab icon
  css/styles.css      styles and the three color themes
  js/app.js           page logic (Today, Betting, schedule, calendar, summary, trips, countdown)
  data/schedule.js    the 2026-27 schedule and road-trip estimates
  data/results.js     final scores                         <-- changes during the season
  data/daily.js       Today dashboard + betting data       <-- changes during the season

It is a plain static site: no server code or database. It works on any host
(GitHub Pages, Netlify, your own hosting, a subfolder of an existing site),
and you can also open index.html straight from this folder to preview it.

TABS
  Today     daily dashboard: headline, last game and box score, next game,
            record (last 10, seed change arrows), East standings with daily
            movement arrows, player stats (season / last 10 games), injuries,
            headlines, and a picker for the last 14 days.
  Betting   next and last line (cover / over-under results), matchup comparison
            with the next opponent, a projection with adjustable weights and its
            track record, ATS records, cover-margin chart, line log, futures.
  Schedule, Home games, Season summary, Road trips   as before.

UPDATING DURING THE SEASON
Two files change; upload them again after they are replaced:
  data/results.js   final scores, keyed by game date, e.g.
                    "2026-10-20": {"det": 112, "opp": 105, "opponent": "Boston", "home": true},
  data/daily.js     one line of data written from the Pistons Season Hub
                    (the Claude-hosted version updates itself every morning;
                    this file is a snapshot of it). Replace the whole file.
The page adds a timestamp when it loads both files, so visitors see updates
right away.

SCHEDULE CHANGES
The schedule lives in data/schedule.js. If the NBA moves a game, the date and
time can be edited there (each game has "date", "iso" and "time").

Betting information is for entertainment only, not advice. 21+.
If you or someone you know has a gambling problem, call 1-800-GAMBLER.

Unofficial fan page, not affiliated with the Detroit Pistons or the NBA.
