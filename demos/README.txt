Demos live here — one folder per project.

Each folder needs an index.html that works on its own. Open it directly in a
browser; if it runs there, it runs embedded in the project page.

To attach it to a project, add this to that project in content.js:

  demo: {
    src: "demos/bet-tracker/index.html",
    ratio: "16 / 10",              // shape of the box; try "4 / 3" or "1 / 1"
    note: "Nothing is saved between visits."
  }

Notes
- Keep it self-contained. Scripts, styles and images can live in the folder
  beside index.html, but don't rely on anything outside demos/.
- It shares no styling with the rest of the site, so give it its own CSS.
- Make it work at around 700px wide. That's roughly the space it gets on a
  laptop, and it shrinks from there on a phone.
- Anything the demo saves in the browser stays on that visitor's machine.
  Don't count on it being there next time.
