# Playmaker — iPhone web app

Draw up a football play, then run it against a simulated defense.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The whole game |
| `manifest.webmanifest` | App name, icon and full-screen settings |
| `sw.js` | Lets the game work offline after the first visit |
| `icons/` | Home-screen icons (`apple-touch-icon.png` is the iPhone one) |

## Put it online (one time)

iPhones only install web apps from a real **https://** address, so the folder has to be hosted somewhere. Any static host works. Two easy options:

- **Netlify Drop:** go to https://app.netlify.com/drop and drag this whole `playmaker` folder onto the page. You get an https link right away. Sign up (free) if you want to keep the link.
- **Your existing website:** upload the folder as-is, e.g. to `https://yoursite.com/playmaker/`. Keep the files together; all the paths are relative.

GitHub Pages and Cloudflare Pages work too.

## Install it on an iPhone

1. Open the link in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it from the new Playmaker icon. It opens full-screen with no browser bars, and it keeps working offline.

A small tip in the app explains this the first time someone opens it in Safari.

## Updating it later

1. Replace the files on your host.
2. Open `sw.js` and change `VERSION` (e.g. `playmaker-v1` → `playmaker-v2`).

Phones pick up the new version the next time they open the app while online. It may take one extra launch.

## Good to know

- Saved plays, drive stats and settings live on each phone. They don't sync between devices. To share a play, use **Playbook → Copy code**; the other person pastes it in **Import code**.
- On iPhone, the home-screen app keeps its own storage, separate from Safari. Plays saved while using it in Safari won't show up in the installed app.
