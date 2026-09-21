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
      title: "Bet tracking app",
      year: "2026",
      status: "In progress",
      summary: "A web app for tracking bets, which turned into something closer to a game.",
      tags: ["code"],
      image: "",
      about: [
        "Replace this with what the thing actually does and who it's for. Two or three paragraphs is plenty.",
        "Worth writing down: what you thought you were building when you started, and what it turned into. That's usually the interesting part."
      ],
      facts: [
        { label: "Started", value: "2026" },
        { label: "Built with", value: "—" },
        { label: "State", value: "Playable, unfinished" }
      ],
      links: [],
      // The demo is a self-contained page inside the demos/ folder.
      // Build it so it works on its own, drop it in, and it appears here.
      demo: {
        src: "demos/bet-tracker/index.html",
        ratio: "16 / 10",
        note: "Runs right here in the page. Nothing is saved between visits."
      },
      log: [
        { date: "2026-09-10", title: "Scoring rewrite",
          note: "What changed and why the first version didn't work.",
          photos: [] },
        { date: "2026-08-28", title: "First playable",
          note: "The point where it stopped being a spreadsheet.",
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
