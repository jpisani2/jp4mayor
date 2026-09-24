# 48240 Happy Hour Map

A static website: plain HTML, CSS and JavaScript, with no build step and no server code.

```
happy-hour-map/
├── index.html          the page
├── css/styles.css      all styling (light + dark themes)
├── js/data.js          the venue list (edit this to add/update places)
├── js/app.js           map, filters, list, "Back to map" button
├── img/                favicon + app icons
└── site.webmanifest    lets phones "Add to Home Screen" like an app
```

## Open it on your computer
Double-click `index.html`. It works straight from the folder. You only need internet for the fonts; without it the page falls back to system fonts.

## Put it online (free options)
- **Netlify Drop:** go to app.netlify.com/drop and drag the whole `happy-hour-map` folder onto the page. You get a public link in seconds.
- **GitHub Pages:** create a repo, upload the contents of this folder, then turn on Settings → Pages → "Deploy from branch" (main, root).
- **Cloudflare Pages:** create a project, choose "Upload assets", and upload the folder.

## Updating a place
Each venue is one line in `js/data.js`. The fields:

| field | meaning |
|---|---|
| `id` | unique key |
| `n` | name |
| `c` | city |
| `a` | address |
| `ll` | `[lat, lng]` |
| `t` | type: `bar`, `rest`, `chain`, `brew`, `lounge` |
| `r`, `rc` | Google rating and review count |
| `ph` | phone |
| `w` | website |
| `hh` | list of windows `["days","start","end","label"]`, where days are digits 0=Sun … 6=Sat. Example: `["12345","15:00","18:00"]` = Mon–Fri 3–6pm. An empty list means "has happy hour, times unknown". |
| `ap` | `1` = times approximate |
| `d` | deals |
| `cf` | confidence: `1` confirmed, `2` likely, `3` unverified (hidden unless toggled) |
| `ev`, `dt` | evidence notes and latest evidence date |

Research date: Sep 24, 2026.
