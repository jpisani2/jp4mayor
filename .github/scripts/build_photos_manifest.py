#!/usr/bin/env python3
"""
Regenerates images/photos-manifest.json from whatever picture files are
sitting in images/pictures/. Run automatically by
.github/workflows/photos-manifest.yml every time that folder changes on
main -- you shouldn't need to run this by hand, and anything typed into
photos-manifest.json directly will be overwritten on the next push.

Caption: guessed from the filename (dashes/underscores become spaces, a
leading YYYY-MM-DD is stripped, first letter capitalized).
Date: the date the file was first committed to the repo, from git history.
"""
import json
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PICTURES_DIR = REPO_ROOT / "images" / "pictures"
OUT_FILE = REPO_ROOT / "images" / "photos-manifest.json"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def caption_from_filename(filename):
    stem = Path(filename).stem
    stem = re.sub(r"^\d{4}-\d{2}-\d{2}[-_ ]*", "", stem)
    stem = re.sub(r"[-_]+", " ", stem).strip()
    if not stem:
        return ""
    return stem[0].upper() + stem[1:]


def date_added(rel_path):
    try:
        result = subprocess.run(
            ["git", "log", "--diff-filter=A", "--follow", "--format=%aI", "--", rel_path],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        )
        lines = [line for line in result.stdout.strip().splitlines() if line]
        if lines:
            return lines[-1][:10]
    except Exception:
        pass
    return ""


def main():
    entries = []
    if PICTURES_DIR.exists():
        for f in sorted(PICTURES_DIR.iterdir()):
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
                rel = f.relative_to(REPO_ROOT).as_posix()
                entries.append({
                    "src": rel,
                    "caption": caption_from_filename(f.name),
                    "date": date_added(rel),
                })

    entries.sort(key=lambda e: e["date"], reverse=True)
    OUT_FILE.write_text(json.dumps(entries, indent=2) + "\n")
    print("Wrote {} photo(s) to {}".format(len(entries), OUT_FILE.relative_to(REPO_ROOT)))


if __name__ == "__main__":
    main()
