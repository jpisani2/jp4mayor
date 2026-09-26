# Eat Em Up

A game-day guide for Sunday, Sept 27, 2026 in downtown Detroit (Lions 1:00 PM, Tigers 3:10 PM). The whole site is one file: `index.html`.

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The whole site. All the CSS, JavaScript, map and data are inside it. |
| `README.md` | This file. You don't need to upload it for the site to work. |

It doesn't need a build step, a server or a database. It loads Google Fonts from the internet. If the fonts can't load, it falls back to system fonts.

## Put it on GitHub

1. Create a new repository on GitHub, for example `eat-em-up`.
2. Click **Add file → Upload files** and drag in `index.html` (and `README.md` if you want it).
3. Click **Commit changes**.

## Serve it

**Option A: your own hosting.** Upload `index.html` to the web root, or to a subfolder like `/eat-em-up/`. If your host deploys from GitHub, point it at this repo's `main` branch. It's a plain static file, so no settings are needed.

**Option B: GitHub Pages (free).** Go to the repo's **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**, then **main** and **/ (root)**, and click Save. After a minute the site is live at `https://<your-username>.github.io/eat-em-up/`.

## Notes

- **Saved picks stay on each phone.** Your play, "We're at" spot, audibles, route, "Been here" checks and theme are stored in that phone's browser. They survive refreshes but don't sync between the four of you.
- **Clock.** On game day the Live section follows the real Detroit clock. Before that, it runs in preview mode with a time you set.
- **Hours and info were checked Sept 25, 2026.** Places marked "call first" didn't post clear Sunday hours.
- **Editing.** Spots, hours and plans are plain data near the top of the `<script>` block in `index.html` (`SPOTS`, `PLAYS`, `GEO`, `GD`). Edit, commit, and your host picks it up.
