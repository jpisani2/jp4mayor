# Clock Out
*Metro Detroit happy hours, right now.*

A static website: plain HTML, CSS and JavaScript, with no build step and no server code.

```
happyhour/
├── index.html          the page
├── css/styles.css      styling, including the 10 color palettes
├── js/data.js          the venue list (edit this to add/update places)
├── js/app.js           map, filters, list, timeline, planner, themes
├── sw.js               offline support (caches the site on phones)
├── img/                favicon + app icons
└── site.webmanifest    lets phones "Add to Home Screen" like an app
```

## Open it on your computer
Double-click `index.html`. Everything works from the folder except two things that need a real web address: offline mode and Share links. Fonts need internet; without it the page falls back to system fonts.

## Put it online (free options)
- **Netlify Drop:** go to app.netlify.com/drop and drag the whole `happy-hour-map` folder onto the page. You get a public link in seconds.
- **GitHub Pages:** create a repo, upload the contents of this folder, then turn on Settings → Pages → "Deploy from branch" (main, root).
- **Cloudflare Pages:** create a project, choose "Upload assets", and upload the folder.

After you change files on a live site, open `sw.js` and change the `VERSION` line (any new text works) so phones pick up the update. Do the same for the `?v=` numbers in `index.html`.

## Updating a place
Each venue is one line in `js/data.js`. The fields:

| field | meaning |
|---|---|
| `id` | unique key |
| `n` | name |
| `c` | city. Taylor, Allen Park, Melvindale, Lincoln Park, Ecorse, River Rouge, Wyandotte, Southgate, Riverview, Trenton, Romulus, Brownstown and Woodhaven count as Downriver; Wayne, Northville and Plymouth get a "nearby" tag; everything else is West Side. |
| `a` | address |
| `ll` | `[lat, lng]` |
| `t` | type: `bar`, `rest`, `chain`, `brew`, `lounge` |
| `r`, `rc` | Google rating and review count |
| `ph` | phone (powers the Call button) |
| `w` | website |
| `hh` | happy-hour windows `["days","start","end","label"]`, where days are digits 0=Sun … 6=Sat. Example: `["12345","15:00","18:00"]` = Mon–Fri 3–6pm. Times past midnight go above 24:00 (`"26:00"` = 2am). An empty list means "has happy hour, times unknown". |
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
