# Brainwave

Brain teasers for a sharper morning.

## Putting it on your website
Upload this whole `brainwave` folder to your site (for example so it lives at `yoursite.com/brainwave/`).
Every link inside is relative, so any folder name or location works.

- Your site needs **HTTPS** for offline mode and the Home Screen app to work fully.
- On iPhone: open the page in Safari → Share → **Add to Home Screen**.

## Updating later
When files change, the version in `sw.js` (`VERSION`) is bumped so phones pick up the new files.
The app shows an "Update" prompt when a new version is ready.

## Trying it on your computer
Double-clicking `index.html` works for a quick look (offline mode is skipped).
For the full experience run a tiny local server in this folder, e.g. `python -m http.server`,
then open http://localhost:8000.
