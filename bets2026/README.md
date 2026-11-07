# Bet Room — how the code is arranged

Plain ES modules, loaded natively by the browser. No build step, no npm, no
bundler. Edit a file, commit it, it's live. That is the point: this has to be
fixable from a phone at halftime, and still work in two years without anyone
updating a dependency.

## The four rules

Everything follows these. If a change would break one, the change is wrong.

**1. Only `db.js` talks to Supabase.**
No screen imports the client or writes a query. If data comes from the
database, it arrives through a named function in that file. This is why the
whole app can be repointed at a different backend by editing one file, and why
you never have to hunt for where a write happens.

**2. Only `scoring.js` and `ledger.js` compute money.**
`scoring.js` settles bets; `ledger.js` turns those settlements plus the
payment log into balances and transfers. Both mirror views in the database
(the latest definitions are in `sql/`).
When a number looks wrong there are a known few places to check, and they must
agree with the database. No screen works out a payout on its own.

**3. Only `store.js` changes state, and only it triggers a render.**
Screens read from `state` and call actions. They never mutate it and never
call `render()`. One path in, one path out, so there is no question about what
caused a redraw.

**4. Each screen is one file that knows nothing about the others.**
A screen exports `view()` returning HTML and `wire(root)` attaching handlers.
It does not know what screen came before or comes next — `app.js` decides that.
New screens get added without touching existing ones. The pieces several
screens share (the grade confirmation, the admin sheet, the propose sheet and
the menu) are parts, not screens: they're drawn inside whichever screen uses
them.

## The files

```
index.html          Shell. Loads the stylesheet, Supabase, and app.js (and,
                    before anything draws, a seasonal theme's stylesheet if
                    this device is on one).
styles.css          The core styling. Semantic colors documented at the top.
                    Seasonal themes bring their own (see js/seasonal/).
sql/
  2026-09-safeguards.sql
                    Run once in Supabase's SQL editor: all-or-nothing
                    locking, kickoff, posting and set-up; guarded deletes;
                    no picks on closed bets; views matching scoring.js.
  2026-10-closeout.sql
                    Run once too: closing out the night in one step, which
                    refuses while a locked bet still needs a result.
js/
  vendor/
    supabase.js     Our own copy of supabase-js v2, so it never changes under
                    us. If it's missing, index.html falls back to the CDN.
  config.js         The only file you edit to deploy: URL, key, two tunables.
  format.js         Display helpers. No state, no database, no DOM.
  sound.js          The new-bet chime and this device's sound on/off.
  rules.js          The house rules, as data. Edit freely.
  scoring.js        Settlement math. Mirrors the SQL views.
  pregame.js        The eleven pregame bets and how they derive from the line.
  ledger.js         Balances, rounding, and who hands what to whom.
  theme.js          The themes, which one this device chose, and which
                    seasonal themes are retired (one flag each).
  seasonal/         One .js and one .css per seasonal theme. See "Seasonal
                    themes" below.
    halloween.js/.css   October. Retired until next year.
    homealone.js/.css   The holidays: Home Alone, night and morning.
  db.js             Every Supabase call.
  store.js          State, derived values, actions, realtime wiring.
  app.js            Picks a screen, renders it, wires it. Nothing else.
  screens/
    join.js         Room password.
    seat.js         Claim a seat from the roster.
    room.js         The live board and scoreboard.
    propose.js      The call-a-bet sheet.
    setup.js        Admin: create a game, tune the board, open it.
    closeout.js     Admin: end the night, grade the stragglers, delete a game.
    settle.js       Balances, suggested transfers, the payment log.
    stats.js        Range filters, streaks, categories, CSV export.
    idle.js         Midweek: what you owe, last game, season table.
    roster.js       Admin: merge, rename, delete, move a stray pick.
    rules.js        The house rules screen (text lives in js/rules.js).
    past.js         Past games: every closed night; admin fixes a result.
    offline.js      "Can't connect" — shown when the database can't be
                    reached at start-up; retries on its own.
    menu.js         Part: everything that isn't the board, themes, sound.
                    Everyday items first; admin ones below Themes.
    grading.js      Part: grade buttons that ask to confirm first.
    flourish.js     Part: a seasonal theme's lock and grade flourishes, and
                    the Man of the House crown.
    adminsheet.js   Part: PIN then confirm, for kickoff and pulling a bet.
    bigscreen.js    The shared dashboard for a laptop or iPad. Not a player:
                    it locks, grades, kicks off and closes out, but never picks.
```

## Two things that look odd but aren't

**The whole screen re-renders on every change.** Not because it's clever, but
because at six players and ten bets it costs nothing, and incremental DOM
updates are where realtime bugs hide. Two costs are paid for it in `app.js`
and `store.js`: before each redraw, the field you're typing in (its text and
cursor) and any panel marked `data-keep-scroll` are noted and put back after,
so nobody's keyboard drops when someone else picks; and while a slider is
being dragged, redraws wait until it's let go.

**Realtime just refetches.** Any change to `bets`, `picks`, `games` or
`payments` triggers a full reload rather than applying a diff. Reconciling
state by hand is how two phones end up disagreeing. Refetching cannot drift.
Reloads run one at a time; a change that arrives mid-reload queues exactly one
more, so nothing is dropped, and anything waiting on a reload waits for that
queued one. A phone waking up reloads straight away.

History (every game, bet and payment, for balances and stats) is the one big
read, so it isn't repeated on every pick. Tonight's bets are already fresh and
are folded into it; the full read happens when a history screen opens, when a
payment or game changes, when a bet outside tonight's game changes (a past
result fixed, a merge), when a phone wakes up, and on the 20-second backstop
while realtime is down. It's read in pages, because Supabase silently stops
at its "Max rows" setting (1000 by default).

## Where the constraints come from

Balances under $1 either way carry over rather than generate a transfer, so
following the suggested transfers exactly actually ends at "Everyone is
square". A voided bet — including one graded with nobody on one side — never
happened as far as stats are concerned.

`picks.auto` marks a row the system created rather than a player. Without it, a
silent player would be revived by the auto-out that noticed they were silent,
and dormancy could never trigger at all.

Inputs are `font-size: 16px` because iOS zooms the page when a smaller input
takes focus.

The four semantic colors — `--a`, `--b`, `--up`, `--down` — carry meaning and
must not be reused for decoration. A theme recolors the environment through
`--brand` and the greys, and leaves those four in their roles. Where a team
color sits too close to one of them, the semantic color is nudged along its
own hue rather than swapped: side B shifts toward teal under Lions, side A
toward orange under Michigan, money green brightens under Michigan State.
Under Home Alone, holly red is the brand, so money lost moves to raspberry and
money won to a bright mint. Amber is still amber everywhere.

## Seasonal themes

A seasonal theme is a pair of files in `js/seasonal/`: a `.js` that builds
its decorations and a `.css` that dresses the app. Each `.js` exports the
same small shape (`SEASON`, `THEMES`, `CSS`, `dress()`, and optionally
`chime()`, `lockChime()`, `gradeChime()`, `STRINGS`, `stage()` and `SINCE`)
so `theme.js` treats them all alike:

- A theme's stylesheet loads only while that theme is on, so no other theme
  downloads it. Its swatches for the picker stay in `styles.css`, so they show
  from inside any theme.
- Its decorations live in one layer at the back of the page, outside `#app`,
  so the redraw on every change never restarts them. They take no taps and
  are hidden from screen readers.
- `sound.js` asks the active theme for its sounds and falls back to the
  plain beep (and silence for locks and grades).
- Screens ask for a seasonal line with `flavor(key, usual)` from `theme.js`
  and get the usual wording under every other theme.

**Retiring one after its season is one flag**: set `retired: true` for it in
`SEASONS` at the top of `js/theme.js`. It drops out of the menu picker, the
join screen and the big-screen dots, and any device still on it falls back
to Dark. Nothing is deleted, so bringing it back is setting `retired` to
false again.

On a phone set to reduce motion, every seasonal theme keeps only its still
decorations.

### Home Alone (the holidays)

Two versions: **Home Alone** (a snowed-in house after dark, every window lit,
rigged for intruders) and **Home Alone light** (Christmas morning: sun on
fresh snow, icicles, frost at the corners, and the evidence of last night's
traps).

On phones and laptops there's falling snow (three layers, fewer on a phone),
a strand of lights that twinkles and now and then runs a chase, a tree in
one corner, the front door with its wreath in the other, and every 30–90
seconds one trap at random: a paint can on a rope, toy cars and marbles, a
flashlight beam (night), footprints in the snow, the spider back as a
tarantula, or iced front steps glinting (morning).

On the big screen the backdrop is the house from John's reference photo, the
approved v2-1 prototype: the party train behind the French doors with
tonight's players on name tags (the leader up front), a window lit for each
player home, the delivery guy's run once a minute with a stack of pizzas
that grows with the money riding on open bets, a flashlight sweep when an
open bet goes lopsided (3 to 1 or worse, at least 4 people — a first guess,
tune it in `lonely()` in `bigscreen.js`), a plain van down the street at
night and a crowbar by the door in the morning. The board sits on a frosted
panel across the lower part of the screen. A new bet springs a trap (a paint
can swings across, the screen flashes, the border lights chase); a lock
frosts the card over and clicks a padlock shut; a grade gives the winners a
snow-globe burst. Before kickoff nothing on the house gives a hidden pick
away.

The extras that come with it: the close-out screen names **Man of the
House**, **The Wet Bandits** and **Left Behind**, and the Man of the House
wears a crown on the board, Stats and the big screen until the next night is
closed out; Stats gets an ornament tree per player (one ornament per win
since `SINCE` in `homealone.js`, sized by the winnings, voids never count);
setup offers four optional Christmas-week bets; the idle big screen counts
down to Christmas; and a set of lines replaces the usual wording (all in
`STRINGS` in `homealone.js`). None of it changes the rules, the money or the
database.

Sounds are synthesized: sleigh bells for a new bet, a knock at the door for a
lock, a sleigh-bell flourish for a grade. The title font is Mountains of
Christmas from Google Fonts, loaded only while the theme is on.

All artwork is drawn for this app. No movie stills, no photos of the actors,
none of the movie's people, and none of its names or signs: the party
cutouts and the delivery guy (green beanie, red car, a lit pizza slice on the
roof sign) are original.

The two backdrop photos are free under the
[Unsplash License](https://unsplash.com/license) and load straight from
Unsplash's CDN, only while the theme is on. If Unsplash can't be reached,
the painted sky and every drawn piece still show. Credits:

- House covered in Christmas lights at night: [Nellie Adamyan](https://unsplash.com/photos/a-house-covered-in-christmas-lights-at-night--FG6wI-hDO8) (night)
- Snow-covered tree in front of a house: [David Mirabal](https://unsplash.com/photos/_uAQ2eSS850) (morning)

### Halloween (October) — retired

`halloween.js` and `halloween.css`: a haunted sky, the moon, fog, bats, a
spider on its thread, ghosts, cobwebs, embers or falling leaves, a black cat
and jack-o'-lanterns. The new-bet chime is a theremin, and on the big screen
a new bet brings lightning and a swarm of bats. Under Halloween, pumpkin
orange is the brand, so side A moves to candle-yellow and money lost to
blood red. The title font is Creepster (Windows falls back to Chiller).

Photo credits (Unsplash License):

- Haunted house in fog: [m wrona](https://unsplash.com/photos/gray-wooden-house-covered-by-fog-pCgxm-HDMNs) (dark sky)
- Moon behind trees: [Aron Visuals](https://unsplash.com/photos/full-moon-behind-a-tree-silhouettes-4zxSWESyZio)
- Field of jack-o'-lanterns: [Taylor Rooney](https://unsplash.com/photos/brown-pumpkin-lot-L86gqddPTQs) (dark, bottom edge)
- Misty forest: [Rythik](https://unsplash.com/photos/silhouette-photography-of-house-surrounded-by-withered-trees-bxkyazW_6KY) (light sky)
- Pumpkins at golden hour: [Elijah Pilchard](https://unsplash.com/photos/pumpkins-in-a-field-during-golden-hour-0ZQG2WeU8KM) (light, bottom edge)

To bring it back next October, set `retired: false` for it in `js/theme.js`
(and probably `retired: true` for Home Alone).

## Adding or updating `js/vendor/supabase.js`

Open this in a browser and save the page as `js/vendor/supabase.js`:

    https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js

To see which version that is, open
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/package.json` and note the
`"version"` line here: **version: (not yet saved)**. Only replace the file on
purpose, and try the site before committing it.
