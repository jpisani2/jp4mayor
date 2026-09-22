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
        { label: "Open the hub →", url: "pistons/" }
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
