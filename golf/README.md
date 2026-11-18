# Fairway Forge

Design golf holes, play them in 3D, collect your favorites, and build them into courses. It runs on your phone as an installable web app with no build step and no server.

## Put it on GitHub Pages

1. Create a new repository on GitHub (for example `fairway-forge`).
2. Upload everything in this folder to the repository root: `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/` and `icons/`. You can drag the files onto the repo page with **Add file → Upload files**, or use GitHub Desktop.
3. In the repo, open **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. After a minute your game is live at `https://<your-username>.github.io/<repo-name>/`.

## Install on your iPhone

1. Open the GitHub Pages link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the home-screen icon from then on.

The home-screen app has its **own storage**, separate from Safari. Everything you create inside it (holes, collection, courses, scores, settings) stays in that installed app. Holes made in a regular Safari tab won't appear there, so do your designing from the icon. Deleting the home-screen icon deletes its data, so use **Settings → Export backup** now and then.

## Updating the game

Upload the changed files to the same repository. The app checks the network first, so the next launch picks up the new version, and your saved data is not touched. If you change `sw.js`, also change `VERSION` at the top of the file.

## How the code is organized

| Folder | What's in it |
|---|---|
| `js/core/` | Data tables (surfaces, climates, clubs), hole model and generator, terrain compiler, 2D painter, storage, sharing, audio, haptics |
| `js/game/` | 3D engine, scene builder, procedural models, ball physics, swing input, play session |
| `js/editor/` | The hole designer |
| `js/ui/` | Menus, library, courses, stats, settings, UI toolkit |
| `js/vendor/` | Three.js r170 (local copy so the app works offline) |

To test locally, serve the folder with any static web server (the import map and service worker need `http://`, not `file://`).
