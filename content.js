/* ============================================================
   content.js  —  THIS IS THE ONLY FILE YOU NEED TO EDIT.
   Add projects, log entries, pictures and videos below.
   Save. Upload. Done.
   ============================================================ */

const SITE = {

  /* ---------- 1. WHO YOU ARE (shows at the top of every page) ---------- */
  name: "John Pisani",
  tagline: "Projects, pictures, and things worth keeping.",

  about: [
    "A place to keep the stuff I need online: projects I'm working on, pictures, videos, and anything else that doesn't have a better home. Some of it is finished. Most of it isn't."
  ],

  links: [
    /* Hidden for now. To bring them back, remove this comment's opening
       and closing markers.
    { label: "Email",  url: "mailto:you@example.com" },
    { label: "GitHub", url: "https://github.com/yourusername" }
    */
  ],


  /* ============================================================
     2. PROJECTS

     Only `title` is required. Everything else is optional — leave
     a field out and that part of the page simply doesn't appear.

       id       a short name with no spaces. Makes the web address:
                project.html?id=lawn   ← this is how the page is found.
       page     true gives the project its own page. Leave it out and
                the project stays a single row on the projects list.
       status   In progress · Planned · Finished · Shelved
       summary  one sentence, shown in the list
       about    paragraphs for the top of the project page
       facts    the small label/value strip under the title
       demo     embeds something playable — see the bet tracker below
       log      dated entries, newest shown first (order here doesn't
                matter, they get sorted by date automatically)

     A log entry:
       { date: "2026-09-14",          ← always YYYY-MM-DD
         title: "First mow",           ← optional
         note: "What happened.",       ← optional
         photos: ["images/lawn/a.jpg"] ← optional, as many as you like
       }
     ============================================================ */

  projects: [

    {
      id: "lawn",
      page: true,
      title: "Front lawn",
      year: "2026",
      status: "In progress",
      summary: "Pulling the weeds and crabgrass out of the front lawn by hand and seeding it back, photographed from the same three spots every few days.",
      tags: ["outdoors"],
      image: "lawn/th/IMG_7507.jpg",
      about: [
        "The front lawn was thin and full of weeds and crabgrass. At the end of August I redid one patch under the maple. Then on September 6 I pulled the rest of the weeds and crabgrass by hand and seeded most of the lawn with Pennington seed, the official grass seed of the Detroit Tigers. About 300 square feet in all.",
        "After that it was watering, three or four times a day, until a couple of days of heavy rain around September 17 and 18 did it for me. The first mow was September 22.",
        "The full photo log is linked above. Every photo there is lined up with the others from the same spot, matched on fixed landmarks like the sidewalk joints, the mailbox post and the curb corner, then rotated and cropped to the same frame. Nothing inside the photos is retouched. You can drag across a photo to compare any two dates, or step through them in order."
      ],
      facts: [
        { label: "Started", value: "Late August 2026" },
        { label: "Seed", value: "Pennington" },
        { label: "Area", value: "About 300 sq ft" },
        { label: "Watering", value: "3 to 4 times a day" },
        { label: "First mow", value: "Sep 22" }
      ],
      links: [
        { label: "Open the photo log", url: "lawn/" }
      ],
      log: [
        { date: "2026-11-19", title: "Mid-November",
          note: "Ten weeks after seeding. Filled in, and holding up as the leaves come down.",
          photos: ["images/lawn/2026-11-19-sidewalk.jpg", "images/lawn/2026-11-19-curb.jpg", "images/lawn/2026-11-19-driveway.jpg"] },
        { date: "2026-09-22", title: "First mow",
          note: "Sixteen days after seeding. From the curb strip by the mailbox.",
          photos: ["lawn/img/IMG_7507.jpg"] },
        { date: "2026-09-18", title: "After the rain",
          note: "A couple of days of heavy rain around the 17th and 18th, so the hose got a break.",
          photos: ["lawn/img/IMG_7481.jpg"] },
        { date: "2026-09-11", title: "Five days after seeding",
          note: "All three spots on the same morning. Still watering three or four times a day.",
          photos: ["lawn/img/IMG_7466.jpg", "lawn/img/IMG_7465.jpg", "lawn/img/IMG_7463.jpg"] },
        { date: "2026-09-07", title: "Under the maple",
          note: "First photos of the patch under the tree, which I seeded at the end of August.",
          photos: ["lawn/img/IMG_7443.jpg"] },
        { date: "2026-09-06", title: "Weeds out, seed down",
          note: "Pulled the weeds and crabgrass by hand and seeded most of the lawn with Pennington. This is the start date for everything except the patch under the tree. Also the first photos of the curb strip.",
          photos: ["lawn/img/IMG_7424.jpg", "lawn/img/IMG_7427.jpg"] },
        { date: "2026-09-02", title: "Before the weeding",
          photos: ["lawn/img/IMG_7391.jpg"] },
        { date: "2026-08-21", title: "Starting point",
          note: "From the front walk. Thin, dry, and bare along the sidewalk.",
          photos: ["lawn/img/IMG_7335.jpg"] }
      ]
    },

    {
      id: "bet-tracker",
      page: true,
      title: "Bet Room",
      year: "2026",
      status: "In progress",
      summary: "A web app for the small bets my friends and I make on each other while the game is on. Anyone can call a bet, everyone picks a side from their phone, and it settles up at the end of the night.",
      tags: ["code"],
      image: "",
      about: [
        "The idea is simple: while the game is on, someone says \"I bet the Lions go for it on fourth down,\" and then nobody remembers who took what. Bet Room fixes that. Everyone opens it on their own phone, and the board updates live for all of them.",
        "Anyone can call a bet, either from a list of ready-made ones (next play, this drive, what the announcers will say) or by writing their own. Whoever calls it sets the odds and takes a side. Everyone else picks a side or sits out, and anyone can lock it before the snap. If nobody has taken the other side, it can't lock, because a bet with everyone on the same side doesn't pay anybody.",
        "The money works like odds, not flat bets. Your risk is twice the base stake times the chance your side happens, so backing the longshot is cheap and backing the favorite costs more. The winners split the whole pot in proportion to what they risked. Before a bet locks, each card shows what you'd win if your side hits.",
        "Before kickoff there's a pregame board of eleven bets, and all of them are worked out from just the spread and the total. Picks stay hidden until kickoff, so nobody can wait to see where everyone else went. At kickoff, bets with both sides covered lock, and one-sided bets are voided.",
        "At the end of the night, the admin grades anything still open and closes out the game. The settle-up screen works out the fewest handoffs that square everyone, rounding against yourself: if you owe, you round up, and if you're owed, you round down. If someone has to leave early, there's a plan for that too. Payments get logged and never deleted (a mistaken one is voided but stays in the log), and balances carry over from week to week until someone pays.",
        "Behind that: stats by season, streaks, a who's-good-at-what table by category, and a CSV export. There's also a roster screen for when Teddy shows up as \"Ted\" on his wife's phone. It merges the two names and recalculates every stat, and the merge can be undone. There are six color themes, including Lions and Michigan, and each phone picks its own.",
        "It's plain JavaScript with no build step, so I can fix it from my phone at halftime. The data lives in Supabase, a hosted Postgres database that pushes changes to every phone as they happen. The real app sits behind a room password, so the demo above is a copy with its database swapped for a fake one that runs in your browser. The people are made up, and the bets you post get picked by them. Everything else is the real code."
      ],
      facts: [
        { label: "Started", value: "2026" },
        { label: "Built with", value: "JavaScript, Supabase" },
        { label: "Used on", value: "Game days" },
        { label: "State", value: "In use, still changing" }
      ],
      links: [],
      demo: {
        src: "demos/bet-tracker/index.html",
        ratio: "3 / 4",
        note: "The real app, with made-up friends and fake money. Tap a name to sit down. Nothing is saved, and reloading starts over."
      },
      log: [
        { date: "2026-09-21", title: "Public demo",
          note: "The real app is behind a room password, so there's now a copy anyone can try, embedded above. Everything talks to the database through one file, so the demo swaps that file for a fake one that runs in the browser, with made-up friends who pick sides on whatever you post. The rest is the real code. Also fixed two small bugs found while building it: Settle up threw an error the first time it opened, and on the setup screen, tapping from one team name straight into the other lost the tap.",
          photos: [] }
      ]
    },

    {
      id: "pistons",
      page: true,
      title: "Pistons Season Hub",
      year: "2026",
      status: "In progress",
      summary: "The Pistons' 2026–27 season on one page that keeps itself up to date: a morning dashboard, betting lines, team and league stats, the schedule and road trips, plus a preview before every game and a recap within minutes of the final.",
      tags: ["code", "sports"],
      image: "",
      about: [
        "It started as the schedule: every game, home games by month, a season summary, and a road-trip planner for picking an away game to drive to. Then it kept growing. It's now nine tabs and two companion sites, and almost all of it updates without me touching it.",
        "Today is the morning dashboard: a short overnight briefing, the last game with its box score and postgame press conferences, the next game, the record, East standings with arrows for who moved, player stats for the season or the last 10 games, injuries, headlines, and team buzz from the beat writers. A picker goes back through the last 14 days.",
        "Team has power rankings, advanced stats with league ranks, the game log, injury history, contracts and the cap, the rotation, and a milestone tracker for Cade. League has the standings scenarios, a playoff projection from 10,000 simulations of the rest of the season, award odds, every transaction in the league, what former Pistons are doing, and the Motor City Cruise. History has this day in Pistons history and a search across the whole season.",
        "Betting has the next and last line and whether it covered, a matchup comparison, a projection with weights you can adjust and a running record of how it's done, against-the-spread records, and futures. It's there for fun, not advice.",
        "Pregame is a preview for every game: tale of the tape, injuries, who to watch, a projected line for each player with an over or under call, keys to the game, talking points, and a call. It's written that morning and updated a couple of times before tip. Postgame is the recap: how the game went, the top nights, team stats, talking points, and the season so far. It goes up within about ten minutes of the final buzzer.",
        "Behind it are a handful of scheduled Claude jobs. One writes the morning dashboard, one does the preview and recap on game days, one pulls in news and transactions twice a day, and one rebuilds the team and league stats twice a week. Each one writes its own data file and pushes it straight to this site, so the page itself stays plain JavaScript with no server. The numbers come from ESPN, Basketball Reference and the like, and every news item has to come with its source."
      ],
      facts: [
        { label: "Started", value: "September 2026" },
        { label: "Tabs", value: "9, plus Pregame and Postgame" },
        { label: "Updates", value: "Every morning, and around every game" },
        { label: "Built with", value: "JavaScript, no server" }
      ],
      links: [
        { label: "Open the hub", url: "pistons/" },
        { label: "Pregame", url: "pistons/pregame/" },
        { label: "Postgame", url: "pistons/recaps/" }
      ],
      log: [
        { date: "2026-10-11", title: "Team, League and History",
          note: "Three more tabs, plus team buzz and league transactions that refresh twice a day.",
          photos: [] },
        { date: "2026-10-10", title: "Pregame and Postgame",
          note: "Two companion sites: a preview before every game and a recap right after. The data now goes straight to the site instead of through my laptop.",
          photos: [] },
        { date: "2026-10-03", title: "Today and Betting",
          note: "A dashboard that rewrites itself every morning, and a Betting tab with lines, a projection and its track record.",
          photos: [] },
        { date: "2026-09-21", title: "First version",
          note: "The full 2026–27 schedule, home games, a season summary, a road-trip planner, and scores filled in after every game.",
          photos: [] }
      ]
    },

    {
      id: "signals",
      page: true,
      title: "Sideline Signals",
      year: "2026",
      status: "In progress",
      summary: "A phone app for cracking the other team's play-call signals from the bleachers at my nephew's middle school football games.",
      tags: ["code", "sports"],
      image: "",
      about: [
        "Middle school coaches call plays from the sideline with hand signs: touch the hat, the nose, the chest, clap. I go to my nephew's games, and I wanted a way to keep them interesting between snaps. So this is a notebook for the signs. Write down what the coach does, write down what the offense runs, and see if the code falls out. It only uses what anyone in the bleachers can see.",
        "It's built for one thumb in the stands. When the coach signals, tap each sign in the order you see it. After the snap, tap what happened: run left, middle or right, QB keep, short pass, deep pass, screen, punt, kick, or trick play. The signal gets saved with the result and the pad clears for the next play. You can mark the down if you catch it. If you miss the signal entirely, tap the result anyway. It still counts toward what they like to run.",
        "The hard part is that coaches hide the real sign among decoys, and the app doesn't know which system they're using. So it tries all of them: the whole signal, the first sign, the second, the third, the last, the same signs in any order, how many signs there were, whether one particular sign showed up at all, and the sign right before or right after every other sign (that last one catches the classic \"the sign after the hat is the real one\"). Each theory gets graded the same way: hide one play, predict it from all the others, and repeat for every play. A theory only counts if it beats just guessing their favorite play.",
        "Once the signal you're entering matches a pattern it has seen enough times, the top of the screen makes a call: \"Locked in: PASS, Pass Short, 5 of 5,\" plus which theory it's reading from and how often that theory has been right. With less evidence it says \"Leaning\" instead. How much counts as enough (three matching plays, 70% consistent) can be changed in Setup. The Insights tab shows the best theory, a cheat sheet of what each sign means under it, and a sign-by-sign table. A sign that shows up a lot but splits evenly between run and pass is probably a decoy.",
        "If nothing beats guessing, Insights says so, and suggests they might be using a wristband or sending plays in with a player.",
        "It's one HTML file with no server. Everything saves on the phone, so a refresh mid-game doesn't lose anything, and once it's been opened it works at fields with no cell signal. It can go on the home screen like an app, has a light theme for bright sun, and exports the log as a spreadsheet. The demo above is the same code with a made-up game already loaded, where the real sign is always the one right after Hat."
      ],
      facts: [
        { label: "Started", value: "September 2026" },
        { label: "Built with", value: "One HTML file, no server" },
        { label: "Used at", value: "My nephew's games" },
        { label: "Record", value: "0 real games so far" }
      ],
      links: [
        { label: "Open the app", url: "signals/" }
      ],
      demo: {
        src: "demos/signals/index.html",
        ratio: "3 / 4",
        note: "The real app with a made-up game of 26 plays. After it makes a call, the Insights tab shows how it worked the code out."
      },
      log: [
        { date: "2026-09-22", title: "First version",
          note: "Built and working against the sample game. The right theory first takes the top spot at play 14 and holds it from play 24 on. It hasn't seen a real game yet. That's next, from the bleachers.",
          photos: [] }
      ]
    },

    {
      id: "keno",
      page: true,
      title: "Club Keno, by the numbers",
      year: "2026",
      status: "In progress",
      summary: "Michigan Club Keno worked out exactly: what every spot game really pays back, whether the add-ons are worth it, and three ways to run a group night.",
      tags: ["code"],
      image: "",
      about: [
        "Club Keno is the Michigan Lottery's bar keno: 20 numbers drawn out of 80, and you pick anywhere from 1 to 10 of them. The ticket prints the odds, but it counts a $1 prize on a $1 bet as a win. This site works out what the paytable actually returns.",
        "Spot games 2 through 10 all pay back between 63 and 66 cents per dollar in the long run. The 2-spot returns the most, 66.1 cents, but only pays about once every 17 draws. The 3-spot is the better balance: 65.2 cents, and a win of $2 or more about once every 6.5 draws. The 1-spot wins most often and returns the least, 50 cents, because its only prize is $2.",
        "The add-ons get the same treatment. Plus 3 doubles the bet for three extra numbers, and it's a bad deal except on 8- and 9-spot. The Jack's value depends on how big the jackpot has grown. The Kicker can't be worked out at all, because Michigan doesn't publish how often each multiplier comes up. There's also a section on why doubling-up systems don't work: the bets grow fast, the $20-per-draw cap ends them within a few rounds, and no betting pattern changes the average. Every dollar still loses about 35 cents.",
        "The rest is for a group night with a shared budget. There are three ladders: start small, move up a rung whenever a stage ends with the group behind, and stop as soon as the group is ahead. Each one is tested with 40,000 simulated nights, run in the browser. The 3-Spot Batch usually has the smallest busts and the best average, and The Climb gives the best shot at a big night. The night tracker is for the table: pick a ladder, tap each draw's result, and it says what to buy next and when to stop. The ladders often finish ahead, but the wins are small and the losses are large, and the page says so.",
        "There's also a ticket simulator for playing with fake money, and the cashing rules from the back of the ticket. It's one HTML file with no server. It goes on the phone's home screen like an app and keeps working if the bar's signal drops. Not affiliated with the Michigan Lottery."
      ],
      facts: [
        { label: "Started", value: "September 2026" },
        { label: "Built with", value: "One HTML file, no server" },
        { label: "Based on", value: "The Club Keno bet slip" },
        { label: "Simulated", value: "40,000 nights per ladder" }
      ],
      links: [
        { label: "Open the site", url: "keno/" }
      ],
      log: [
        { date: "2026-09-22", title: "First version",
          note: "Odds for every spot, the add-on math, three group-night ladders, a ticket simulator, and a night tracker for the table.",
          photos: [] }
      ]
    },

    {
      id: "ploppy",
      page: true,
      title: "Ploppy 3-2 simulator",
      year: "2026",
      status: "In progress",
      summary: "A simulator for the Ploppy 3-2 roulette system: $3 on black, $2 on the third column, and a bigger bet after every miss. It plays thousands of sessions to show where each way of raising the bet really ends up.",
      tags: ["code"],
      image: "",
      about: [
        "Ploppy 3-2 is a roulette system. Every spin you put $3 on black and $2 on the third column, and after any spin where neither one hits, the bet goes up. This site simulates it: pick how the bet goes up, set a bankroll, and see where tens of thousands of sessions end up.",
        "Between the two bets, 26 of the 37 numbers on a single-zero wheel pay something. The four black numbers in the third column (6, 15, 24 and 33) hit both bets for +$7. Twenty-two others hit one of them for +$1. The other eleven, the ten red numbers outside the column plus zero, lose both for −$5. So it wins about 70% of spins and still loses 2.7 cents per dollar bet, the same as anything else on a single-zero table. On a double-zero wheel it's 5.3 cents.",
        "There are four ways to raise the bet after a miss: doubling (1, 2, 4, 8…), Fibonacci (1, 2, 3, 5, 8…), linear (1, 2, 3, 4…), and flat, which never raises it. A big hit drops you back to the starting bet. A small hit steps you down one level, but only once your bankroll is back above where it was before the loss that moved you up. A session ends after the set number of spins, when you're ahead by your quit amount, or when you can't cover the next bet.",
        "Each run plays every system with the same settings, up to 100,000 sessions each, then charts where the sessions finished and lines the four up side by side. On the defaults ($500 bankroll, 100 spins, single zero, $3 and $2), Fibonacci finishes ahead in more than half the sessions but busts about four times in ten. Doubling busts close to six times in ten. Flat never busts and finishes ahead about a third of the time, and it loses the least on average because it bets the least. Every one of them loses money over time. The progressions only change the shape: lots of small wins, paid for by fewer, much bigger losses.",
        "It's one HTML file with no server, and the simulations run right in the browser. It goes on the phone's home screen like an app."
      ],
      facts: [
        { label: "Started", value: "September 2026" },
        { label: "Built with", value: "One HTML file, no server" },
        { label: "Systems", value: "Doubling, Fibonacci, linear, flat" },
        { label: "Simulated", value: "Up to 100,000 sessions per system" }
      ],
      links: [
        { label: "Open the simulator", url: "ploppy/" }
      ],
      log: [
        { date: "2026-09-23", title: "First version",
          note: "Four progressions, single- and double-zero wheels, five bet sizes from $0.30/$0.20 up to $30/$20, and an optional quit-when-ahead amount.",
          photos: [] }
      ]
    },

    {
      id: "takeout",
      page: true,
      title: "Dinner Decider",
      year: "2026",
      status: "In progress",
      summary: "A phone app for “what's for dinner?” that picks from the 276 places around home, based on what I've liked, what's open, and how long it's been since I went.",
      tags: ["code", "food"],
      image: "",
      about: [
        "Most nights the question isn't where's good. It's where haven't we been in a while that's open right now. Dinner Decider covers every restaurant inside 9 Mile, Lahser, Plymouth Rd and Newburgh, counting places on both sides of each road. That's 276 so far, each with hours, cuisine, price, dine-in or carry-out, and the drive time from the house.",
        "Decide for me picks one place from what's open now. It weighs my own ratings (or the online ones for places I haven't tried), how long it's been since the last visit, favorites, a small bonus for anywhere I've never been, any special running today, and how far the drive is. Mood narrows it down first with four taps: sit down or grab and go, light or hearty, a favorite or something new, and budget. Spin the wheel spins my favorites or the top picks that are open now. Browse is the plain list with filters and a surprise-me button.",
        "History is what makes it better over time. Every visit gets a date, dine-in or carry-out, a rating, the dishes (each rated, with an order-again flag) and notes. Each restaurant's page shows my usual, so I don't have to remember what I got last time.",
        "The restaurant list keeps itself current. Once a week a scheduled Claude job rechecks the 30 or so stalest places, so every place gets looked at about once a month. It adds new places it finds, marks closures without ever deleting anything, and rewrites a short local food news section. Every place carries a confidence level and the date its facts were last checked. The home screen says when the data was last updated, and the date turns red if two weeks go by without one.",
        "It's plain JavaScript with no build step. My history is stored in Supabase, so it syncs between my phone and computer. It goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "October 2026" },
        { label: "Area", value: "9 Mile to Plymouth, Newburgh to Lahser" },
        { label: "Places", value: "276" },
        { label: "Built with", value: "JavaScript, Supabase" }
      ],
      links: [
        { label: "Open the app", url: "takeout/" }
      ],
      log: [
        { date: "2026-10-10", title: "First version",
          note: "276 places, 157 of them added in one sweep from Restaurantji, OpenStreetMap and a couple I reported missing. Every place has real coordinates and a drive time, 207 have a short summary of their reviews, and 23 more are waiting to be confirmed.",
          photos: [] }
      ]
    },

    {
      id: "happyhour",
      page: true,
      title: "Clock Out",
      year: "2026",
      status: "In progress",
      summary: "Metro Detroit happy hours, right now. Pick a day and time and see what's running across the west side and Downriver, with the deals and how recently each one was confirmed.",
      tags: ["code", "food"],
      image: "",
      about: [
        "Happy hour listings online are mostly old or copied from each other, and a lot of bars don't post theirs at all. Clock Out covers 275 bars, pubs, restaurants, breweries and lounges across the west side (Livonia, Redford, Dearborn, Westland, Farmington and around) and Downriver (Melvindale and River Rouge south to Woodhaven and Brownstown, plus Romulus). Pick a day and time, or just tap Now, and it shows what's running, what starts later, and that day's specials like taco nights.",
        "To build it I pulled every bar, pub, restaurant with a bar, chain, brewery and lounge Google Maps shows in those areas, about 1,450 results, and trimmed them down to the real candidates. For each one I checked Google's happy-hour tags and business hours, searched its reviews for “happy hour” and noted how recent they were, then went through official sites, Facebook and Instagram posts, and happy hour guides.",
        "Every place is tagged by how sure I am. Confirmed (90 places) means the times come from the place itself, its Google listing, or a post or review from the last year or so. Likely (108) means a chain's standard schedule, a third-party guide, or older evidence. Unverified (77) means old or thin evidence, and those stay hidden unless you turn them on. A colored dot shows how fresh the evidence is. Happy hours are cut off at the bar's closing time and hidden on days it's closed.",
        "Plan my night picks two or three stops in a row and draws the route on a hand-drawn map. There's also a tonight timeline, sorting by ending soonest, nearest, top rated or cheapest drinks, a surprise-me button, share links, and ten color themes named after Detroit things like Coney, Belle Isle and Eastern Market. Every card has a “Something changed?” button that opens an email to me with the bar's details filled in.",
        "Bars change their specials all the time, so it won't stay right on its own. Every Monday a scheduled job rechecks a batch of places, and once a month two more look for new places on the west side and Downriver. They only research and flag. Nothing changes on the site until I approve it. It's plain HTML, CSS and JavaScript with no server, works offline once it's loaded, and goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "September 2026" },
        { label: "Places", value: "275" },
        { label: "Areas", value: "West side and Downriver" },
        { label: "Rechecked", value: "A batch every week" }
      ],
      links: [
        { label: "Open the site", url: "happyhour/" }
      ],
      log: [
        { date: "2026-10-03", title: "Seven more places",
          note: "Seven west side places added.",
          photos: [] },
        { date: "2026-09-25", title: "Downriver added",
          note: "Melvindale and River Rouge south to Woodhaven and Brownstown, plus Romulus. About 870 more map results, trimmed to about 180 real candidates.",
          photos: [] },
        { date: "2026-09-24", title: "First version",
          note: "The west side: about 550 map results trimmed to about 190 real candidates, each checked for happy-hour times, deals and business hours.",
          photos: [] }
      ]
    },

    {
      id: "weather",
      page: true,
      title: "Weather Almanac",
      year: "2026",
      status: "In progress",
      summary: "A weather app for any place that puts the forecast next to the record: radar, alerts, four forecast models side by side, and what this date has looked like every year since 1940.",
      tags: ["code"],
      image: "",
      about: [
        "Most weather apps give one forecast and a radar. Weather Almanac pulls from the sources forecasters actually use and puts them on one page for any place I search. National Weather Service alerts always sit at the top. Below that: the next 48 hours, a 16-day outlook with each day's normal range behind it, a radar loop, the latest reading from the nearest weather station, the atmosphere, sun and moon times, and air quality and UV.",
        "Model showdown lines up four global forecast models (ECMWF, GFS, ICON and GEM) plus an ensemble, and says in plain words whether they agree or already disagree today. The bigger picture shows NOAA's national outlook maps, and Forecast discussion is the local Weather Service office's own write-up of what they're thinking.",
        "The history is the almanac part. It downloads the daily record for that spot back to 1940 and shows today's date in every one of those years, plus how this year so far compares with the 1991–2020 normal.",
        "At a glance rates the conditions for a bike ride and for flying a small drone. Sections can be hidden or reordered, and hidden ones don't download anything. It's plain JavaScript with no server, all the data comes from free public sources (Open-Meteo, the National Weather Service, NOAA and Iowa State's radar archive), and it goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "October 2026" },
        { label: "Places", value: "Anywhere, with Weather Service extras in the U.S." },
        { label: "History", value: "Back to 1940" },
        { label: "Built with", value: "JavaScript, no server" }
      ],
      links: [
        { label: "Open the app", url: "weather/" }
      ],
      log: [
        { date: "2026-10-18", title: "First version",
          note: "Forecast, radar, alerts, four models side by side, and the daily record back to 1940.",
          photos: [] }
      ]
    },

    {
      id: "scores",
      page: true,
      title: "Scores",
      year: "2026",
      status: "In progress",
      summary: "Scores and schedules for my teams in one list, live while games are on, plus every score in the NBA, NFL, NHL, MLB and college football and basketball.",
      tags: ["code", "sports"],
      image: "",
      about: [
        "Scores is one scrolling list for the teams I pick: every game from the last 15 days and the next 15, finished, live and upcoming, with a Now button that jumps straight to what's on. Teams can come from the NBA, NFL, NHL, MLB, college football and men's college basketball. Live games refresh every 30 seconds.",
        "All scores is the whole slate for any day, league by league, with Top 25 and Big Ten filters for college. Leagues that are in season come first.",
        "Tapping a game opens the details: box score, play-by-play, leaders, team stats, win probability, the matchup predictor before the game, recent results for both teams, and game info like where it's on TV.",
        "Everything comes from ESPN's public scores feed, loaded fresh each time the app opens, so there's no server and nothing to keep updated. My teams are saved on the phone, it has light and dark modes, and it goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "October 2026" },
        { label: "Leagues", value: "NBA, NFL, NHL, MLB, college football and basketball" },
        { label: "Live games", value: "Refresh every 30 seconds" },
        { label: "Built with", value: "JavaScript, ESPN's public feed" }
      ],
      links: [
        { label: "Open the app", url: "scores/" }
      ],
      log: [
        { date: "2026-10-22", title: "First version",
          note: "My teams feed, all scores by league, and full game details.",
          photos: [] }
      ]
    },

    {
      id: "brainwave",
      page: true,
      title: "Brainwave",
      year: "2026",
      status: "In progress",
      summary: "Ten brain teasers for the morning, from Sudoku and nonograms to Make 24 and Nim, each with its own difficulty levels, hints, stars and a daily streak.",
      tags: ["code", "games"],
      image: "",
      about: [
        "Brainwave is a set of ten puzzles to do with coffee. Six are logic puzzles: Lights Out, Code Breaker, Nonogram, Binary Grid, Sudoku and River Crossing. Four are number puzzles: Make 24, What Comes Next, Water Jugs and Nim.",
        "Every puzzle except River Crossing is made fresh each time, with four or five difficulty levels, from a 6×6 mini Sudoku up to fiendish. River Crossing is a pack of seven hand-built levels, starting with the wolf, the goat and the cabbage. Nim is played against the computer, and on the top levels it doesn't make mistakes.",
        "Each solve earns one to three stars, based on time or number of moves against a par for that level. Using a hint caps it at two. Hints explain themselves where they can: the Sudoku hint says why a number goes where it does instead of just filling it in. Solving any puzzle keeps the daily streak going, a calendar shows which days I played, and stats keep the best time and fewest moves for each puzzle.",
        "It's plain HTML, CSS and JavaScript with no server. Progress stays on the phone, it works offline, and it goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "November 2026" },
        { label: "Puzzles", value: "10, six logic and four numbers" },
        { label: "Levels", value: "Up to five per puzzle" },
        { label: "Built with", value: "JavaScript, no server" }
      ],
      links: [
        { label: "Open the app", url: "games/" }
      ],
      log: [
        { date: "2026-11-05", title: "First version",
          note: "Ten puzzles, with stars, hints, stats and a daily streak.",
          photos: [] }
      ]
    },

    {
      id: "fairwayforge",
      page: true,
      title: "Fairway Forge",
      year: "2026",
      status: "In progress",
      summary: "A golf game where I design the holes myself, play them in 3D on my phone, and string the favorites together into courses.",
      tags: ["code", "games"],
      image: "",
      about: [
        "Fairway Forge is a hole designer and a golf game in one. I paint the hole the way a course architect would sketch it: tee boxes, fairway, rough, fescue, bunkers, pot bunkers, water, creeks, cart paths and out of bounds. Then I shape the ground with elevation, side slopes, tiered greens and rolling contours, place the pin, and drop in trees, plants, rocks and course furniture like benches, ball washers and a wooden bridge. If I don't feel like drawing, it can generate a par 3, 4 or 5 and I can edit from there.",
        "Six climates set the look: parkland, alpine, desert, tropical, links and autumn, each with its own grass, sky and trees (palms in the tropics, saguaros and Joshua trees in the desert). Time of day runs from early morning to golden hour, and wind from calm to a gale.",
        "Then it plays the hole in 3D. There are 14 clubs from driver to putter, seven shot types including draw, fade, punch, chip and run, and flop, and a swing meter. The ball flight accounts for launch, spin and wind, and the ball bounces and rolls differently off fairway, rough, sand and green. Three difficulty levels change how forgiving the swing meter is and how much help there is reading putts.",
        "Favorite holes go into a collection, and up to 18 of them can be routed into a course with scorecards and stats. Random Round makes up holes on the spot to play. Holes and courses can be shared with a link. It's built on Three.js with no build step and no server, everything stays on the phone, and it goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "November 2026" },
        { label: "Climates", value: "6" },
        { label: "Clubs", value: "14, driver to putter" },
        { label: "Built with", value: "JavaScript, Three.js" }
      ],
      links: [
        { label: "Open the game", url: "golf/" }
      ],
      log: [
        { date: "2026-11-18", title: "First version",
          note: "The hole designer, 3D play, collections, courses up to 18 holes, and share links.",
          photos: [] }
      ]
    },

    {
      id: "playmaker",
      page: true,
      title: "Playmaker",
      year: "2026",
      status: "In progress",
      summary: "Draw up a football play on my phone, then run it against a simulated defense and see if it moves the chains.",
      tags: ["code", "games"],
      image: "",
      about: [
        "Playmaker is a play designer and a football game. I start from one of 13 plays, from HB Dive and Power O to Mesh, Smash and Four Verticals, or from a blank field. Drag players into place, tap one to give him a job, and draw his route point by point. Numbered badges set the QB's read order, and one tap flips the whole play to the other side.",
        "The defense picks a front (4-3, 3-4, nickel or dime), a coverage from Cover 0 through Cover 4 plus 2-Man, and a blitz, based on my personnel and the down and distance. I see the alignment before the snap, and the call is revealed after the play. I can also set the defense myself to see how a play holds up against one look. On harder levels defenders react faster, shed blocks sooner, tackle better and jump more routes.",
        "On pass plays I tap a receiver to throw, and a ring around each one shows who's open. Holding and dragging scrambles the QB or steers the runner after a catch or handoff. Or I switch to the AI QB and watch it work through the reads on its own. Downs, distance and field position carry over from play to play, so every drive is a real drive, with a play-by-play log, slow-motion replays, and Run it back to try the same snap again.",
        "Plays save to a playbook and can be shared as a code that someone else pastes in. It's one HTML file with no server, works offline, and goes on the home screen like an app."
      ],
      facts: [
        { label: "Started", value: "November 2026" },
        { label: "Plays", value: "13 to start from, plus my own" },
        { label: "Defense", value: "4 fronts, 6 coverages, 4 blitzes" },
        { label: "Built with", value: "One HTML file, no server" }
      ],
      links: [
        { label: "Open the game", url: "playmaker/" }
      ],
      log: [
        { date: "2026-11-18", title: "First version",
          note: "13 starting plays, a play designer, an AI defense with three difficulty levels, and full drives.",
          photos: [] }
      ]
    }

    /* House remodel: hidden until there's something to show. To bring it
       back, put a comma after the closing brace just above this comment
       and remove this comment's opening and closing markers.

    {
      id: "remodel",
      page: true,
      title: "House remodel",
      year: "2026",
      status: "Planned",
      summary: "Documenting the whole thing from before the first wall comes down.",
      tags: ["home"],
      image: "",
      about: [
        "Not started yet. The plan is to log it as it happens rather than write it up afterward, when everything has been forgotten.",
        "Replace this with what you're actually doing and why."
      ],
      facts: [
        { label: "Starting", value: "—" },
        { label: "Rooms", value: "—" }
      ],
      links: [],
      log: []
    }
    */

  ],


  /* ---------- 3. PICTURES ----------
     One-off photos that don't belong to a project. Anything tied to
     a project goes in that project's log instead.

     You shouldn't need to touch this list anymore. Drop a photo into
     images/pictures/ (from your phone via GitHub's website, or however
     else) and it appears on the Pictures tab on its own — see
     images/pictures/README.txt. This array is still here for anything you
     want to caption by hand instead; those entries are merged with the
     automatic ones when the page loads.
  ----------------------------------- */
  photos: [],


  /* ---------- 4. VIDEOS ----------
     Paste any YouTube link — the long one, the short one, or the bare ID.
  --------------------------------- */
  videos: [
    {
      youtube: "https://www.youtube.com/watch?v=JZyWVIUJHSc",
      title: "Biking Across the Gordie Howe Bridge",
      note: "First day for biking across the Gordie Howe Bridge from the US to Canada, 8/5/2026.",
      date: "August 2026"
    },
    {
      youtube: "https://www.youtube.com/watch?v=wSi6JSniOi8",
      title: "Northern Michigan Bike Trip, June 2026",
      note: "Burt Lake to Cheboygan to Mackinaw City to Petoskey to Burt Lake.",
      date: "June 2026"
    },
    {
      youtube: "https://www.youtube.com/watch?v=oSEr88N_WIc",
      title: "Gozo Coastal Walk",
      note: "A walk from Mgarr Harbour to Mgarr ix-Xini. Gozo, Malta.",
      date: "September 2025"
    },
    {
      youtube: "https://www.youtube.com/watch?v=OjuP7Phfbfg",
      title: "White Pine Trail, Howard City to Cadillac, May 2025",
      note: "Howard City to Paris to Cadillac, Michigan bike ride.",
      date: "May 2025"
    },
    {
      youtube: "https://www.youtube.com/watch?v=EcsFMisbT-Y",
      title: "Detroit Bike Ride Memorial Day 2025",
      note: "Riverwalk, Dequindre Cut, Eastern Market, downtown Detroit bike ride.",
      date: "May 2025"
    }
  ]
};
