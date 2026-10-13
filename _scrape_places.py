"""One-off scraper: active CivMC nations + settlements from CivWiki infoboxes."""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = {
    "User-Agent": "CivMCShopsBot/1.0 (shop directory; https://github.com/PengdiGit/civmc-shops)"
}
OUT = Path(__file__).with_name("places.js")

# Extra inhabited places the nation list / thin infoboxes miss (wiki-backed).
CURATED = {
    "Icenia": [
        "Icenia City",
        "Southshire",
        "Selsey",
        "Cortesia Del Mar",
        "Sneedland",
        "Basaltington",
    ],
    "Estalia": ["Port Royal", "Suramir", "Shroom City", "Zorweth"],
    "Pavia": ["Pavia City"],
    "Commonwealth": ["Commonwealth"],
    "Imperial Federation": ["New Callisto", "Imperia"],
    "Yoahtl": ["New Yoahtl City"],
    "Lambat": ["Lambat City"],
    "Mount Augusta": ["Mount Augusta"],
    "Doom City": ["Doom City"],
    "Volterra": ["Volterra"],
    "SPQR": ["Roma"],
    "Nassau": ["Nassau"],
    "Winterbourne": ["Winterbourne"],
    "Danzilona": ["New Danzilona"],
    "Nara": ["Nara"],
    "Groveheart": ["Groveheart"],
    "Withervale": ["Withervale"],
    "Salerno": ["Salerno"],
    "Griffin": ["Griffin"],
    "Heikki": ["Heikki"],
    "Kaltsburg": ["Kaltsburg"],
    "Melvera": ["Aurilles", "Bushberry"],
    "Bloom": ["Bloom City", "Lilly", "Cape Meridian", "Kattegat"],
    "Icarus": ["Blue Cove", "Derne", "Port Elowen", "Temporal Isles"],
}

# Skip wiki "Active" rows that are clearly absorbed/annexed husks.
SKIP_STATUS = re.compile(r"(?i)\b(absorbed|annexed)\b")


def api(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request("https://civwiki.org/w/api.php?" + q, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def clean_cell(s: str) -> str:
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.I | re.S)
    s = re.sub(r"<ref[^/]*/>", "", s, flags=re.I)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", s)
    s = re.sub(r"\[https?://[^\]]+\]", "", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("\xa0", " ")
    return " ".join(s.split()).strip()


def extract_link_title(cell: str) -> str:
    m = re.search(r"\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]", cell)
    if m:
        return (m.group(2) or m.group(1)).strip()
    return clean_cell(cell)


def is_active_status(status: str) -> bool:
    st = clean_cell(status)
    if not st or not re.search(r"(?i)^active\b", st):
        return False
    if SKIP_STATUS.search(st):
        return False
    if re.search(r"(?i)^inactive\b", st):
        return False
    return True


def parse_nations_list(wt: str):
    nations = []
    m = re.search(
        r"==\s*List of nations\s*==\s*(\{\|.*?^\|\})",
        wt,
        flags=re.M | re.S,
    )
    if not m:
        return nations
    table = m.group(1)
    chunks = re.split(r"(?m)^\|-\s*$", table)
    for chunk in chunks:
        lines = []
        for line in chunk.splitlines():
            if line.startswith("!") or line.startswith("{|") or line.startswith("|+") or line.startswith("|}"):
                continue
            if line.startswith("|"):
                lines.append(line[1:].strip())
            elif lines:
                lines[-1] = (lines[-1] + " " + line.strip()).strip()
        if len(lines) < 3:
            continue
        colloquial_raw, official_raw, status_raw = lines[0], lines[1], lines[2]
        colloquial = extract_link_title(colloquial_raw)
        if not colloquial or colloquial.lower() in {"colloquial names", "name"}:
            continue
        mlink = re.search(r"\[\[([^\]|#]+)", colloquial_raw)
        page = mlink.group(1).strip() if mlink else colloquial
        nations.append(
            {
                "name": colloquial,
                "official": clean_cell(official_raw),
                "status": clean_cell(status_raw),
                "page": page,
                "active": is_active_status(status_raw),
            }
        )
    return nations


def strip_templates_shallow(s: str) -> str:
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    # Drop broken/unclosed template leftovers
    s = re.sub(r"\{\{[^}]*$", "", s)
    s = re.sub(r"\{\{[^}]*", "", s)
    return s


def parse_infobox_fields(wt: str, keys):
    m = re.search(r"\{\{[Ii]nfobox[^\n]*", wt)
    if not m:
        return {}
    start = m.start()
    i = start
    depth = 0
    end = None
    while i < len(wt) - 1:
        if wt[i : i + 2] == "{{":
            depth += 1
            i += 2
            continue
        if wt[i : i + 2] == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                end = i
                break
            continue
        i += 1
    block = wt[start:end] if end else wt[start : start + 12000]

    out = {}
    for key in keys:
        # Stop at next |key= line (must have =), not bare continuation
        pat = rf"(?im)^\|\s*{re.escape(key)}\s*=\s*(.*?)(?=^\|\s*[\w_]+\s*=|\Z)"
        mm = re.search(pat, block, flags=re.M | re.S)
        if mm:
            out[key] = mm.group(1).strip()
    return out


def normalize_place_name(name: str) -> str:
    name = name.strip(" .;:-")
    name = re.sub(r"\s*\(CivMC\)\s*$", "", name)
    name = re.sub(r"\s*\(CivClassic[^)]*\)\s*$", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    # Title-case wiki quirks like "the UNDERGROUND"
    if name.lower().startswith("the ") and name[4:].isupper():
        name = "The " + name[4:].title()
    return name


def is_junk_name(name: str) -> bool:
    if not name or len(name) > 60 or len(name) < 2:
        return True
    low = name.lower()
    if low in {"citation needed", "n/a", "none", "tba", "unknown", "undefined", "n/a"}:
        return True
    if re.fullmatch(r"\d+px", low):
        return True
    if low.startswith("file:") or "{{" in name or "}}" in name:
        return True
    if re.search(r"(?i)^(flag of|province of|collapsible)", low):
        return True
    return False


def split_settlements(raw: str):
    if not raw:
        return []
    raw = strip_templates_shallow(raw)
    # Normalize HTML breaks and wiki line breaks into separators
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"\[\[File:[^\]]+\]\]", "", raw, flags=re.I)
    raw = re.sub(r"\[\[Image:[^\]]+\]\]", "", raw, flags=re.I)

    names = []
    links = re.findall(r"\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]", raw)
    if links:
        for target, label in links:
            if target.lower().startswith("file:") or target.lower().startswith("image:"):
                continue
            # Skip section links that are just anchors on the same page unless labeled
            name = normalize_place_name(label or target.split("#")[-1] if "#" in target and not label else (label or target))
            if "#" in (label or target) and not label:
                # Free_Danzilonan_Republic#New_Danzilona -> New Danzilona
                name = normalize_place_name(target.split("#")[-1].replace("_", " "))
            if not is_junk_name(name):
                names.append(name)
    else:
        # Split bullets / commas / newlines
        chunks = re.split(r"[\n•·]|,\s+|\s+/\s+|^\*\s*|\s+\*\s+", raw)
        for chunk in chunks:
            name = normalize_place_name(clean_cell(chunk))
            name = re.sub(r"^\*\s*", "", name)
            if not is_junk_name(name):
                names.append(name)

    seen = set()
    out = []
    for n in names:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out


def fetch_page_wikitext(title: str):
    for t in [title, f"{title} (CivMC)"]:
        try:
            data = api(
                {
                    "action": "parse",
                    "page": t,
                    "prop": "wikitext",
                    "format": "json",
                    "formatversion": "2",
                }
            )
            if "error" in data:
                continue
            return data["parse"]["wikitext"], data["parse"]["title"]
        except Exception:
            continue
    return "", title


def parse_if_states(wt: str):
    """Inhabited IF states/cities from the Active States table."""
    cities = []
    m = re.search(r"==\s*Active States\s*==\s*(\{\|.*?^\|\})", wt, flags=re.M | re.S)
    if not m:
        return cities
    table = m.group(1)
    dead_status = re.compile(
        r"(?i)uninhabited|turned into|joined nation|national park|independent\b"
    )
    # Independent in IF table means left IF (Withervale/Groveheart) - skip as IF cities
    chunks = re.split(r"(?m)^\|-\s*$", table)
    for chunk in chunks:
        lines = []
        for line in chunk.splitlines():
            if line.startswith("!") or line.startswith("{|") or line.startswith("|+") or line.startswith("|}"):
                continue
            if line.startswith("|"):
                lines.append(line[1:].strip())
            elif lines:
                lines[-1] = (lines[-1] + " " + line.strip()).strip()
        if len(lines) < 5:
            continue
        name_cell = lines[1]
        status = clean_cell(lines[4])
        if dead_status.search(status):
            continue
        # Keep Full State, Inhabited Territory, Free City, SAR, Sub-State, Territory
        if not re.search(
            r"(?i)full state|inhabited|free city|special administrative|sub-state|territory",
            status,
        ):
            continue
        for name in split_settlements(name_cell):
            cities.append(name)
    return list(dict.fromkeys(cities))


def merge_cities(*lists):
    seen = set()
    out = []
    for lst in lists:
        for c in lst or []:
            k = c.lower()
            if k not in seen and not is_junk_name(c):
                seen.add(k)
                out.append(c)
    return out


def main():
    data = api(
        {
            "action": "parse",
            "page": "List_of_nations_on_CivMC",
            "prop": "wikitext",
            "format": "json",
            "formatversion": "2",
        }
    )
    nations_all = parse_nations_list(data["parse"]["wikitext"])
    active = [n for n in nations_all if n["active"]]
    print(f"Parsed {len(nations_all)} nations, {len(active)} active (after absorb/annex filter)")
    for n in active:
        print(" -", n["name"], "|", n["status"][:70])

    # IF states list
    if_wt, _ = fetch_page_wikitext(
        "List of states and territories in the Imperial Federation (CivMC)"
    )
    if_cities = parse_if_states(if_wt) if if_wt else []
    print(f"IF inhabited states: {len(if_cities)}")

    places = []
    for i, n in enumerate(active):
        print(f"[{i+1}/{len(active)}] {n['page']}...")
        wt, resolved = fetch_page_wikitext(n["page"])
        cities = []
        if wt:
            fields = parse_infobox_fields(
                wt,
                ["capital_city", "capital", "settlements", "cities", "towns", "territories"],
            )
            for key in ("capital_city", "capital", "settlements", "cities", "towns"):
                if key in fields:
                    cities.extend(split_settlements(fields[key]))
            # Territories only for Icenia-style federations (often states that are shop cities)
            if n["name"] in {"Icenia", "Imperial Federation", "Pavia", "Union State"}:
                if "territories" in fields:
                    cities.extend(split_settlements(fields["territories"]))

        curated = CURATED.get(n["name"], [])
        extra = []
        if n["name"] == "Imperial Federation":
            extra = if_cities

        cities = merge_cities(cities, curated, extra)
        source = "infobox"
        if not cities:
            cities = [n["name"]]
            source = "fallback-nation-as-city"
        elif curated or extra:
            source = "infobox+curated" if cities else source

        places.append(
            {
                "nation": n["name"],
                "official": n["official"],
                "page": resolved,
                "cities": cities,
                "source": source,
            }
        )
        time.sleep(0.3)

    nations = sorted({p["nation"] for p in places}, key=str.lower)
    by_nation = {p["nation"]: p["cities"] for p in places}
    # City -> nations that contain it (for reverse filter)
    city_nations = {}
    for nation, cities in by_nation.items():
        for c in cities:
            city_nations.setdefault(c, []).append(nation)
    all_cities = sorted(city_nations.keys(), key=str.lower)

    payload = {
        "nations": nations,
        "byNation": by_nation,
        "cities": all_cities,
        "cityNations": city_nations,
        "source": "https://civwiki.org/wiki/List_of_nations_on_CivMC",
        "updated": time.strftime("%Y-%m-%d"),
    }
    js = (
        "// Active CivMC nations + settlements from CivWiki (active rows only).\n"
        "// Sources: List of nations on CivMC + nation infoboxes + IF states list.\n"
        "// Regenerate with: python _scrape_places.py\n"
        "const CIVMC_PLACES = "
        + json.dumps(payload, indent=2, ensure_ascii=False)
        + ";\n"
    )
    OUT.write_text(js, encoding="utf-8")
    Path(__file__).with_name("_places_scrape.json").write_text(
        json.dumps(places, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Wrote {OUT.name}: {len(nations)} nations, {len(all_cities)} cities")
    missing = [p["nation"] for p in places if p["source"] == "fallback-nation-as-city"]
    print("Fallback-only:", ", ".join(missing))


if __name__ == "__main__":
    main()
