#!/usr/bin/env python3
"""
Run this from the website folder (the one with index.html):

    python make_items.py

It reads every .png in the minecraft_items folder and writes items.js,
so the item picker + search know about every item you have a texture for.
Re-run it any time you add or remove textures.
"""
import json
import os
import sys

FOLDER = next((d for d in os.listdir(".") if d.lower() == "minecraft_items" and os.path.isdir(d)), None)
if not FOLDER:
    print("Can't find a folder called minecraft_items (any capitalisation) here. Run this from the website folder.")
    sys.exit(1)
if FOLDER != "Minecraft_Items":
    print(f"NOTE: your folder is called '{FOLDER}'. Open app.js and make ITEM_DIR = \"{FOLDER}/\" (it must match exactly).")

names = set()
problems = []
for f in os.listdir(FOLDER):
    if not f.lower().endswith(".png"):
        continue
    stem = f[:-4]
    # GitHub Pages is case-sensitive, so the picker needs exact lowercase_with_underscores names
    if stem != stem.lower() or " " in stem:
        problems.append(f)
    names.add(stem.lower().replace("_", " ").strip())

names = sorted(names)
if not names:
    print(f"No .png files found in {FOLDER}/")
    sys.exit(1)

with open("items.js", "w", encoding="utf-8") as out:
    out.write("// made by make_items.py from the " + FOLDER + " folder.\n")
    out.write("// Don't edit by hand, re-run the script instead.\n")
    out.write("const ITEMS = " + json.dumps(names, indent=1) + ";\n")

print(f"Wrote items.js with {len(names)} items.")
if problems:
    print("\nHeads up: these files have capitals or spaces in the name. They'll show a")
    print("missing image on GitHub Pages. Rename them to lowercase_with_underscores.png:")
    for p in problems[:20]:
        print("  ", p)
    if len(problems) > 20:
        print(f"   ...and {len(problems) - 20} more")
