# Your website

A small, fast, hand-built site for projects, pictures and videos.
No frameworks, no build step, no monthly fee. Free to host.

---

## What's in this folder

There are **two pages**. `jp4mayor.com` opens on the campaign page, and a
link there takes visitors through to the real site.

| File | What it's for |
|---|---|
| **content.js** | **The file you edit.** Projects, log entries, pictures, videos. |
| `index.html` | The campaign page — the front door. Edit the text directly in this file. |
| `campaign.css` | Styling for the campaign page only. Navy, red and gold; no dark mode by design. |
| `projects.html` | The list of projects, plus the pictures, videos and about tabs. |
| `project.html` | One project's page. The same file serves every project — it reads which one from the web address. |
| `styles.css` | Styling for the projects side of the site. |
| `app.js` | The code that turns `content.js` into pages. |
| `images/` | Your picture files. One folder per project keeps it sane. |
| `demos/` | Anything playable that gets embedded in a project page. |
| `404.html` | Shown if someone hits a bad link. |
| `.nojekyll` | Tells GitHub to serve the files as-is. Leave it alone. |

## See it right now

Double-click `index.html`. It opens in your browser and works offline.
That's the whole site — what you see is exactly what visitors will get.

## Editing the campaign page

Unlike the projects site, the campaign page's words live directly in
`index.html`. Open it in a text editor and change the text between the tags —
the planks, the positions list, the endorsements. The structure will hold.

Two things worth keeping: the "not a real campaign" note in the footer, which
is what keeps the joke a joke, and the `projects.html` links, which are how
anyone reaches your actual site.

### Years that update themselves

Anywhere you want the current year to appear, write it like this:

```html
<span class="js-year">2026</span>
```

The page rewrites it to whatever year the visitor is actually in. The number
you type between the tags is just a fallback, so put the current year there.
The portrait plaque already works this way.

---

## Part 1 — Put it online (free, about 15 minutes)

These files already live in `Desktop\jp4mayor` on your laptop. This section
takes that folder and puts it on the web.

**1. Make a GitHub account** at [github.com](https://github.com).
Your username becomes part of the temporary web address, so pick something
you won't mind seeing — it stops mattering once your domain is attached.

**2. Install GitHub Desktop** from [desktop.github.com](https://desktop.github.com),
open it, and sign in with the account you just made.

**3. Turn the folder into a repository.**
In GitHub Desktop: `File` → `Add local repository` → browse to
`Desktop\jp4mayor` → it will say the folder isn't a repository yet and offer
to **create a repository here**. Click that, then **Create repository**.

**4. Publish it.**
Click **Publish repository**. **Untick "Keep this code private"** — GitHub
Pages needs a public repository on a free account. Name it `jp4mayor`.

**5. Turn on Pages.**
On github.com, open your new repository → **Settings** → **Pages** in the left
sidebar. Under *Build and deployment* set **Source** to `Deploy from a branch`,
branch `main`, folder `/ (root)`. Click **Save**.

Wait a minute or two and refresh. GitHub shows the live address:
`https://YOURUSERNAME.github.io/jp4mayor/`

### Publishing changes after that

1. Change files in `Desktop\jp4mayor` — edit `content.js`, drop photos into `images/`.
2. Open GitHub Desktop. Your changes are listed on the left.
3. Type a few words in the summary box, click **Commit to main**.
4. Click **Push origin**.

Live in about a minute. Hard-refresh with `Ctrl + Shift + R` if you don't see it.

## Part 2 — Your .com address

### Buy it

Any registrar works. [Cloudflare](https://www.cloudflare.com/products/registrar/),
[Porkbun](https://porkbun.com) and [Namecheap](https://www.namecheap.com) are all
reasonable and sell domains at or near cost — roughly $10–15 a year for a `.com`.
Avoid the first-year-$1 offers that renew at $40.

Skip the upsells. You do **not** need their hosting, their website builder, their
email, or their SEO package. Do keep **WHOIS privacy** if it's free (most include it).

### Point it at GitHub

In your registrar's DNS settings, add these records. Delete any "parking"
or placeholder records they created for you.

**Four A records** — host/name `@` (or blank, meaning the bare domain):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**Four AAAA records** — same host `@`, for IPv6:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

**One CNAME record** — host `www`, pointing to `YOURUSERNAME.github.io`
(note the trailing dot if your registrar wants one).

### Tell GitHub about it

Back in **Settings → Pages → Custom domain**, type `yourdomain.com` and click
**Save**. GitHub adds a file called `CNAME` to your repo — that's expected,
leave it there.

DNS takes anywhere from ten minutes to a few hours to spread. Once the check
passes, tick **Enforce HTTPS**. That box may be greyed out for up to 24 hours
while GitHub issues your certificate — it's free and automatic, just wait.

**One thing to avoid:** don't point `www` at your bare domain instead of at
`YOURUSERNAME.github.io`. It half-works and then breaks HTTPS.

---

## Part 3 — Adding your stuff

Open `content.js` in any plain text editor (TextEdit, Notepad, VS Code).
You can also edit it right on github.com: click the file, then the pencil icon.

### A new project

Copy an existing block and change it. Only `title` is required.

```js
{
  id: "fence",                 // short, no spaces — becomes project.html?id=fence
  page: true,                  // gives it its own page
  title: "Rebuilding the back fence",
  year: "2026",
  status: "In progress",       // In progress · Planned · Finished · Shelved
  summary: "Forty feet of cedar and a rented post-hole digger.",
  tags: ["outdoors"],
  image: "images/fence.jpg",   // optional thumbnail for the list
  about: ["A paragraph or two for the top of the page."],
  facts: [{ label: "Started", value: "May 2026" }],
  links: [],
  log: []
}
```

Leave out `page` and `id` and the project just stays a row on the list with no
page behind it. That's fine for small things — you can always promote one later
by adding those two lines.

Tags become clickable filters automatically once you have two or more.

### A log entry

This is the part you'll use most. Each project has a `log` list; add an entry
every time something happens.

```js
{
  date: "2026-09-14",              // always YYYY-MM-DD
  title: "First mow",              // optional
  note: "Cut at three inches. Looked better than it had any right to.",
  photos: ["images/lawn/first-mow-1.jpg", "images/lawn/first-mow-2.jpg"]
}
```

Order doesn't matter — entries sort themselves by date, newest at the top. Every
field except `date` is optional, so a photo with no words is a valid entry, and
so is a note with no photo.

Photos in a log belong to that project. The Pictures tab is for one-off shots
that aren't part of anything.

### An embedded demo

Build the thing as a page that works on its own, put it in its own folder under
`demos/`, then point a project at it:

```js
demo: {
  src: "demos/bet-tracker/index.html",
  ratio: "16 / 10",
  note: "Nothing is saved between visits."
}
```

It runs live inside the project page. There's a working example in
`demos/bet-tracker/` — open that folder's `index.html` directly in your browser
and you'll see the rule: if it works on its own, it works embedded. More detail
in `demos/README.txt`.

### A new picture

Drop the file into `images/`, then add a line:

```js
{ src: "images/fence.jpg", caption: "Day one", date: "2026" }
```

Anything with a missing file shows a soft placeholder tile instead of a broken
image, so you can lay the page out before the photos exist.

### A new video

Paste the YouTube link — any format works:

```js
{
  youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "The fence, finished",
  note: "Ninety seconds, no narration.",
  date: "2026"
}
```

The video plays **on your page**, not on YouTube. Nothing loads from YouTube
until a visitor actually clicks play, which keeps the page fast.

### Publishing a change

Upload the changed file to your repo (drag it in, or edit in place on
github.com and commit). The live site updates within a minute or so.
If you don't see it, hard-refresh: `Cmd/Ctrl + Shift + R`.

---

## Changing the look

Everything visual lives in the first 50 lines of `styles.css`. The accent
color is `--accent` — one value for light mode, one for dark. Change those
two lines and the whole site follows.

Fonts are set just below, and come from Google Fonts via the `<link>` at the
top of `index.html`. Swap the font names in both places to change them.

The light/dark switch in the corner remembers each visitor's choice, and
defaults to whatever their computer is set to.
