BET ROOM DEMO
=============

This folder is a copy of the real app in bets2026/, with three changes so it
can run in public with nobody's data in it:

  js/db.js      REPLACED. Same function names as the real one, but it keeps
                everything in memory in the visitor's browser: made-up players,
                three past games, one in progress. It also plays the other
                people in the room, picking sides on whatever the visitor posts
                and now and then calling a bet of their own.
  js/config.js  REPLACED. No Supabase URL or key, on purpose.
  index.html    REPLACED. Doesn't load Supabase, adds the "Demo" strip, skips
                the room password. Any admin PIN works.

  js/store.js, js/theme.js and js/sound.js have one small edit: the browser
  storage keys say "betroom-demo." instead of "betroom." so the demo never
  touches the real app's saved seat, theme, sound or big-screen settings on
  the same website.

Everything else (styles.css, the other js files, js/screens/) is an exact copy.
Not copied, because the demo doesn't use them: README.md, sql/, js/vendor/.

Last brought in step with the real app: 2026-09-30.

KEEPING IT IN STEP WITH THE REAL APP
After changing the real app, copy the changed files over the ones here, except
the three REPLACED files above. If you copy store.js, theme.js or sound.js, redo the
storage-key edit (find "betroom." and replace it with "betroom-demo.").
If you add a new function to the real db.js, add a matching fake one to the
demo's db.js too, or the demo won't load.
