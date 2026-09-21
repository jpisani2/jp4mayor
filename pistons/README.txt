PISTONS SEASON HUB - website files
==================================

Upload everything in this folder to your web host, keeping the folder structure:

  index.html          the page
  favicon.svg         browser-tab icon
  css/styles.css      styles and the three color themes
  js/app.js           page logic (schedule, calendar, summary, trips, countdown)
  data/schedule.js    the 2026-27 schedule and road-trip estimates
  data/results.js     final scores  <-- the only file that changes during the season

It is a plain static site: no server code or database. It works on any host
(GitHub Pages, Netlify, your own hosting, a subfolder of an existing site),
and you can also open index.html straight from this folder to preview it.

UPDATING SCORES
Add each final score to data/results.js, for example:
  "2026-10-20": {"det": 112, "opp": 105, "opponent": "Boston", "home": true},
and set "updated" to the time you changed it, e.g. "2026-10-21T02:30:00-04:00".
Then upload just that one file again. The page adds a timestamp when it loads
results.js, so visitors see the new scores right away.

SCHEDULE CHANGES
The schedule lives in data/schedule.js. If the NBA moves a game, the date and
time can be edited there (each game has "date", "iso" and "time").

Unofficial fan page, not affiliated with the Detroit Pistons or the NBA.
