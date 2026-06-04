#!/usr/bin/env python3
"""Find images in public/ that are not referenced in any source file."""

import os
import re
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
IMAGE_DIR = REPO_ROOT / "public" / "images" / "SAT-Style Questions"
SRC_DIR = REPO_ROOT / "src"
PUBLIC_DIR = REPO_ROOT / "public"

# Collect all image filenames referenced in source
referenced = set()

extensions = {".ts", ".tsx", ".js", ".json"}
image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def add_reference(raw):
    filename = os.path.basename(urllib.parse.unquote(raw))
    if Path(filename).suffix.lower() in image_extensions:
        referenced.add(filename)


for path in SRC_DIR.rglob("*"):
    if path.suffix not in extensions:
        continue
    text = path.read_text(errors="replace")
    # Match both encoded (%20) and unencoded (space) paths
    for raw in re.findall(r'/images/SAT-Style[^"\')\s]+', text):
        add_reference(raw)

# Also scan public/ (index.html etc)
for path in PUBLIC_DIR.glob("*.html"):
    text = path.read_text(errors="replace")
    for raw in re.findall(r'/images/SAT-Style[^"\')\s]+', text):
        add_reference(raw)

# Also check root index.html
root_html = REPO_ROOT / "index.html"
if root_html.exists():
    text = root_html.read_text(errors="replace")
    for raw in re.findall(r'/images/SAT-Style[^"\')\s]+', text):
        add_reference(raw)

# Collect all on-disk filenames
on_disk = {f.name for f in IMAGE_DIR.iterdir() if f.is_file() and f.suffix.lower() in image_extensions}

unreferenced = on_disk - referenced
missing = referenced - on_disk

print(f"On disk:      {len(on_disk)}")
print(f"Referenced:   {len(referenced)}")
print(f"Unreferenced: {len(unreferenced)} (safe to delete)")
print(f"Missing refs: {len(missing)} (broken image links)")

if missing:
    print("\n--- BROKEN REFS (referenced but not on disk) ---")
    for f in sorted(missing)[:20]:
        print(f"  {f}")
    if len(missing) > 20:
        print(f"  ... and {len(missing) - 20} more")

output = REPO_ROOT / "scripts" / "images" / "unreferenced_images.txt"
if unreferenced:
    with open(output, "w") as fh:
        for name in sorted(unreferenced):
            fh.write(name + "\n")
    print(f"\nWrote list to {output.relative_to(REPO_ROOT)}")
elif output.exists():
    output.unlink()
