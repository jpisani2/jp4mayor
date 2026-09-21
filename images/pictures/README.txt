Drop picture files in here and they show up on the Pictures tab
automatically -- no editing content.js, no fussing with the images/ folder.

How it works: a GitHub Action watches this folder. Every time a picture
lands here (through GitHub's web uploader, the GitHub app, or a laptop
push), it regenerates images/photos-manifest.json with a caption guessed
from the filename and a date pulled from when the file was added. Don't
edit photos-manifest.json by hand -- it gets overwritten on the next push.

Tips
- Use .jpg for photographs, .png for screenshots. .webp and .gif work too.
- Keep files under about 1 MB each so the page loads fast. Exporting at
  around 2000 pixels on the long edge is plenty for a website.
- The filename becomes the caption, so name it the way you want it to
  read: "back-porch-after-paint.jpg" shows up as "Back porch after paint".
  Dashes and underscores become spaces.
- Want a specific caption instead of a filename guess, or a photo that
  shouldn't go through the auto list? The old way still works: put the
  file in images/ and add a line to the `photos` list in content.js.

To upload straight from your phone, no computer involved:
  1. Open github.com in your phone's browser and sign in.
  2. Go to the jp4mayor repo, then into images/pictures.
  3. Tap "Add file" -> "Upload files".
  4. Pick photos from your camera roll (or "Choose Files" on Android).
  5. Scroll down, leave "Commit directly to the main branch" selected,
     and tap "Commit changes".
The site updates within a couple of minutes.
