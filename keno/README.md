# Club Keno, by the numbers

A single-page site for Michigan Club Keno: exact odds for every spot, the Plus 3 / The Jack / Kicker math, a bet-escalation calculator, three group-night ladders with simulated results, a ticket simulator, and a night tracker for the table. Built to be used mostly on an iPhone.

Everything runs in the browser. There's no build step, no server, and no dependencies beyond Google Fonts (the page falls back to system fonts if they don't load).

## Files

| File | What it is |
|---|---|
| `index.html` | The whole site: HTML, CSS, and JavaScript |
| `manifest.webmanifest` | Lets the site be added to the iPhone home screen as an app |
| `sw.js` | Service worker that keeps the site working if the signal drops |
| `icons/` | Home-screen and browser icons |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Deploy on GitHub Pages

1. Create a new repository on GitHub (for example `club-keno`). It can be public, or private if your GitHub plan supports Pages on private repos.
2. Upload everything in this folder to the root of the repository, keeping the `icons` folder. On github.com: **Add file → Upload files**, drag the files in, and commit. Make sure `.nojekyll` gets uploaded too (on a Mac, press Cmd+Shift+. in Finder to show hidden files).
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose the `main` branch and the `/ (root)` folder, and save.
4. After a minute or two, the site is live at `https://YOUR-USERNAME.github.io/club-keno/`. The address also appears at the top of the Pages settings.

To update the site later, upload a new `index.html` over the old one. Because pages load from the network first, the update shows up on the next visit.

## Put it on your iPhone home screen

1. Open the site's address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Tap **Add**.

It opens full-screen like an app, with its own icon, and keeps working if the bar's signal drops after you've opened it once.

## What's saved on the phone

- **Your night** settings (budget and draws per ticket) and the **night tracker** are saved in the phone's browser storage, so they survive closing the app.
- The **ticket simulator** saves nothing. Reloading the page starts a fresh game.
- Nothing is ever sent anywhere.

## Notes

- Odds are calculated exactly from the Michigan Club Keno bet-slip paytable (20 of 80 drawn; Plus 3 draws 23). Paytables can change, so check the current slip.
- Ladder statistics come from simulations run in the page, so figures can shift slightly between settings.
- Not affiliated with the Michigan Lottery. Michigan Problem Gambling Helpline: 1-800-270-7117.
