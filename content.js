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
    "This is where I park the things I make and the things I want to remember. Some of it is finished, most of it isn't.",
    "Replace this text with your own in content.js — it's the second block from the top."
  ],

  links: [
    { label: "Email",  url: "mailto:you@example.com" },
    { label: "GitHub", url: "https://github.com/yourusername" }
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
      title: "Lawn renovation",
      year: "2026",
      status: "In progress",
      summary: "Killing off the old lawn and starting over from seed.",
      tags: ["outdoors"],
      image: "",
      about: [
        "Replace this with a couple of sentences about why you tore the lawn up. Mostly this project is photos — the log below is doing the work."
      ],
      facts: [
        { label: "Started", value: "August 2026" },
        { label: "Seed", value: "—" },
        { label: "Area", value: "—" }
      ],
      links: [],
      log: [
        { date: "2026-09-14", title: "First mow",
          note: "What height you cut at, and how it looked afterward.",
          photos: ["images/lawn/first-mow-1.jpg", "images/lawn/first-mow-2.jpg"] },
        { date: "2026-09-02", title: "Germination",
          note: "When it broke, and which patches were slow.",
          photos: ["images/lawn/germination-1.jpg", "images/lawn/germination-2.jpg", "images/lawn/germination-3.jpg"] },
        { date: "2026-08-24", title: "Seed down",
          note: "Seed type, the rate you put it down at, and what the weather did after.",
          photos: ["images/lawn/seed-1.jpg", "images/lawn/seed-2.jpg"] },
        { date: "2026-08-17", title: "Levelling",
          note: "How much sand it took, and whether it was worth it.",
          photos: ["images/lawn/level-1.jpg"] },
        { date: "2026-08-10", title: "Kill-off",
          note: "What you sprayed and how long you waited before touching anything.",
          photos: ["images/lawn/killoff-1.jpg", "images/lawn/killoff-2.jpg"] }
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
      title: "Pistons Season Hub",
      year: "2026",
      status: "In progress",
      summary: "The Pistons' 2026–27 season on one page: full schedule, home games, record, a road-trip planner, and scores updated after every game.",
      tags: ["code", "sports"],
      links: [
        { label: "Open the hub", url: "pistons/" }
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
      youtube: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      title: "Example — Big Buck Bunny",
      note: "Swap this for one of your own. Paste the YouTube link into content.js and it plays right here.",
      date: "2026"
    }
  ]
};
