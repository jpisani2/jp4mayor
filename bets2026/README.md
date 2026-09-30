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
index.html          Shell. Loads the stylesheet, Supabase, and app.js.
styles.css          All styling. Semantic colors documented at the top.
sql/
  2026-09-safeguards.sql
                    Run once in Supabase's SQL editor: all-or-nothing
                    locking, kickoff, posting and set-up; guarded deletes;
                    no picks on closed bets; views matching scoring.js.
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
  theme.js          The six themes and which one this device chose.
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
    grading.js      Part: grade buttons that ask to confirm first.
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
more, so nothing is dropped. A phone waking up reloads straight away.

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
Amber is still amber everywhere.

## Adding or updating `js/vendor/supabase.js`

Open this in a browser and save the page as `js/vendor/supabase.js`:

    https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js

To see which version that is, open
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/package.json` and note the
`"version"` line here: **version: (not yet saved)**. Only replace the file on
purpose, and try the site before committing it.
