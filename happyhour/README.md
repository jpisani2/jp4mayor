# Clock Out
*Metro Detroit happy hours, right now.*

A static website: plain HTML, CSS and JavaScript, with no build step and no server code.

```
happyhour/
├── index.html          the page
├── check.html          data checker: open after editing js/data.js
├── css/styles.css      styling, including the 10 color palettes
├── js/data.js          the venue list and city→area lists (edit this to add/update places)
├── js/                 the app, one job per file (see "How the code is organized")
├── sw.js               offline support (caches the site on phones)
├── img/                favicon + app icons
├── site.webmanifest    lets phones "Add to Home Screen" like an app
└── tools/serve.ps1     a local web server for testing (nothing to install)
```

## Open it on your computer
Double-click `index.html`. Everything works from the folder except two things that need a real web address: offline mode and Share links. Fonts need internet; without it the page falls back to system fonts.

To test those two as well, run a local web server from PowerShell, then open http://localhost:8765/ (Ctrl+C stops it):

```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

## How the code is organized
Plain scripts, no build step and nothing to install. Each file in `js/` does one job and shares it on `window.CO` (for example `CO.hours`); later files use what earlier ones shared. `index.html` loads them in this order:

| file | what it does |
|---|---|
| `config.js` | names, areas, map bounds, deal filters and themes; loaded in `<head>` and by `check.html` |
| `data.js` | the venues and which area each city is in |
| `util.js` | formatting, distance, saved settings, toast, pop-ups, layout |
| `hours.js` | time logic: business hours, happy-hour windows, what's running when |
| `venues.js` | gets the venue data ready once on load |
| `state.js` | what the user has picked, and which venues pass the filters |
| `cards.js` | the HTML for a venue card |
| `map.js` | the hand-drawn map, markers, pan/zoom and the planner's route |
| `plan.js` | Plan my night |
| `lists.js` | the lists, timeline and status line, and selecting a place |
| `themes.js`, `share.js` | color themes and Share links |
| `app.js` | the filter controls, the clock, location and start-up |
| `check.js` | the rules `check.html` runs (not part of the site itself) |

A new file goes in `index.html` in the right spot, with the same `?v=` as the others; the offline cache finds it automatically.

## Put it online (free options)
- **Netlify Drop:** go to app.netlify.com/drop and drag the whole `happyhour` folder onto the page. You get a public link in seconds.
- **GitHub Pages:** create a repo, upload the contents of this folder, then turn on Settings → Pages → "Deploy from branch" (main, root).
- **Cloudflare Pages:** create a project, choose "Upload assets", and upload the folder.

After you change files on a live site, change every `?v=` value in `index.html` to the same new one (find-and-replace the old value; any new text works, e.g. `2026-10-02-1`). That's the only place the version lives: the offline cache in `sw.js` picks it up from there. Venue data and the page itself are always fetched fresh when online, so a data update still reaches people if you forget; styling and app changes reach them one visit later.

## Updating a place
Each venue is one line in `js/data.js`. After editing, open `check.html` (double-click it, or visit `/check.html` on the live site). It lists **errors** (the venue will show wrong or not at all, e.g. a bad time, a city that isn't listed, coordinates off the map) and **warnings** (probably a mistake, e.g. a happy hour on a day the business hours say it's closed). Fix the errors before you publish.

A new city has to be added to `AREA_CITIES` at the top of `js/data.js` under `west` or `downriver` (and to `NEARBY_CITIES` if it should get the "nearby" tag).

The fields:

| field | meaning |
|---|---|
| `id` | unique key |
| `n` | name |
| `c` | city. Must be listed in `AREA_CITIES` at the top of `js/data.js`, which decides whether it's West Side or Downriver. |
| `a` | address |
| `ll` | `[lat, lng]` |
| `t` | type: `bar`, `rest`, `chain`, `brew`, `lounge` |
| `r`, `rc` | Google rating and review count |
| `ph` | phone (powers the Call button) |
| `w` | website |
| `hh` | happy-hour windows `["days","start","end","label"]`, where days are digits 0=Sun … 6=Sat. Example: `["12345","15:00","18:00"]` = Mon–Fri 3–6pm. Times past midnight go above 24:00 (`"26:00"` = 2am). A happy hour that starts at or after midnight (`"24:00"`) goes on the night it belongs to, e.g. Friday for early Saturday morning. An empty list means "has happy hour, times unknown". |
| `ap` | `1` = times approximate |
| `d` | everyday deals (shown every day) |
| `sp` | day-specific specials `["days","text"]`, e.g. `["2","$1.99 Taco Tuesday"]`. These only show on those days. |
| `pr` | cheapest drink price `[price,"kind"]`, e.g. `[2,"beer"]`. Powers the price badge and "Cheapest drinks" sort. |
| `ho` | business hours Sun→Sat, comma-separated, in hours (`11-26` = 11am–2am, `16.5-22` = 4:30–10pm, `x` = closed, `?` = unknown). One value alone means the same every day. Happy hours are hidden on closed days and cut off at closing time. |
| `cf` | confidence: `1` confirmed, `2` likely, `3` unverified (hidden unless toggled) |
| `ev`, `dt` | evidence notes and latest evidence date (`"Aug 2026"` or `"2026"`). The date badge turns green within 6 months, amber within 18, grey after that. |

The deal filters (Margaritas, Wings, Half-off, Tacos, Music & karaoke, Pool) are picked up automatically from the words in `d` and `sp`.

## Reports
"Something changed?" on each card opens an email to bar@jp4mayor.com with the bar's details filled in. To change the address, edit `REPORT_TO` near the top of `js/app.js`.

Research date: Sep 24, 2026 (Downriver added Sep 25, 2026).
