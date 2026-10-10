# Dinner Decider

A phone-first web app for "what's for dinner?" around home. The area is 9 Mile, Lahser, Plymouth Rd and Newburgh, counting places on both sides of each road.

- **Decide for me**: picks a place from what's open now. It weighs your ratings (or online ratings if you haven't been), how long it's been since your last visit, favorites, and today's specials.
- **Mood**: 4 taps (sit down or grab & go, light or hearty, a favorite or something new, budget).
- **Spin the wheel**: spins your favorites, or the top picks that are open now.
- **Browse**: filters for open now, cuisine, price, favorites and never tried, plus a "surprise me" button.
- **History**: every visit with date, dine-in or carry-out, a rating, the dishes you ate (each rated, with an "order again" flag) and notes. The restaurant page shows your "usual".

The restaurant data in `data/restaurants.json` is refreshed **weekly by a Claude scheduled routine** (`routine/PROMPT.md`). You don't have to update anything by hand. Your own history is stored in **Supabase**, so it syncs between your phone and computer.

## One-time setup

### 1. Put it on GitHub Pages
1. Create a repo, e.g. `jp4mayor/takeout`, and push this folder. The easiest way without the command line is GitHub Desktop: *Add local repository* → choose this folder → *Publish*.
2. In the repo, go to **Settings → Pages → Build and deployment**, choose *Deploy from a branch*, then pick `main` and `/ (root)`.
3. Choose where it lives:
   - **No DNS work:** if your .com already serves your `jp4mayor.github.io` user site, this repo is automatically served at `https://<your>.com/takeout/`.
   - **Subdomain:** add a DNS `CNAME` record from `dinner` to `jp4mayor.github.io`. Then enter `dinner.<your>.com` under Settings → Pages → Custom domain. GitHub adds a `CNAME` file for you.

### 2. Sync your history with Supabase
1. In Supabase, open your project, then **SQL Editor** → paste `supabase/schema.sql` → **Run**.
2. Go to **Authentication → URL Configuration**. Set the Site URL to the app's address, and add the same address under Redirect URLs.
3. Go to **Project Settings → API** and copy the *Project URL* and *anon public* key into `js/config.js`. The anon key is designed to be public, and Row Level Security keeps your rows private.
4. Open the app, go to **Settings**, enter your email, and tap the link in the email. Anything you logged before signing in moves into your account.
5. Optional but recommended: **Authentication → Sign In / Providers → Email**, turn off *Allow new users to sign up*. Only you need an account.

Until step 3 is done, the app still works, but your history is saved only in that one browser.

### 3. Turn on the weekly update
Once the repo is on GitHub, create a weekly Claude routine (for example Mondays at 6am) on the repo using `routine/PROMPT.md`. In Claude Code, ask: *"schedule a weekly routine on jp4mayor/takeout using routine/PROMPT.md"*.

Each run does the following:
- refreshes about 30 of the stalest places, so every place is rechecked every month or so
- adds up to 25 newly found places
- marks closures without ever deleting a place
- rewrites the local food news
- validates the data, then commits

The home screen shows *"data updated <date>"*. The date turns red if no update has happened in 2 weeks.

## Data
`data/restaurants.json` has one place per line. The fields are documented in `routine/PROMPT.md`. A few highlights:
- `ho` is the hours, Sun→Sat, like `"x,11-22,11-22,11-22,11-22,11-23,12-23"`. `x` means closed, `?` means unknown, and times past midnight are written as 24+ (`"17-26"` = 5pm–2am).
- `cf` is a confidence level (1 confirmed, 2 likely, 3 unverified). `ev` is a note on where the facts came from, and `dt` is the date they were last checked.
- `specials` uses `[["2","Taco Tuesday"]]` with day digits 0=Sun…6=Sat. A matching special gives a place a small boost on that day.

`data/area.json` defines the boundary, along with address-number hints the routine uses to decide what's inside.

## Local preview and tests
There's no build step and nothing to install.

```bash
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
```

Then open http://localhost:8080. The tests and data validation run at http://localhost:8080/tests/run.html. With Node installed you can also use `npm test` and `npm run validate`.
