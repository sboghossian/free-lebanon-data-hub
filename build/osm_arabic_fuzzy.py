"""Arabic names for places that have none, from nearby OpenStreetMap features, by consonant match.

The strict pass (P-arabic-osm.jsonl, exact normalised key within 2 km) matched 5 of 632. GeoNames
transliterations ("Beit ez Zahle") rarely equal OSM's Latin spelling, so this pass compares the
place's Latin name with the OSM feature's ARABIC name instead: both are reduced to a consonant
string in one shared alphabet and scored with difflib. Rows are flagged match="consonant".

Usage: python3 build/osm_arabic_fuzzy.py [--refresh]
"""
import difflib, json, math, os, re, sys, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gazetteer  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VIL = os.path.join(ROOT, "research", "hub", "villages")
CACHE = os.path.join(ROOT, "cache", "osm-arabic-names.json")
OUT = os.path.join(VIL, "P-arabic-osm-consonant.jsonl")
MAX_M, MIN_RATIO = 1000, 0.85
PLACES = {"village", "hamlet", "neighbourhood", "suburb", "locality", "town", "city", "quarter", "isolated_dwelling"}
# reviewed by hand 2026-10-04: same consonants, different place (farm vs shrine, Mrah vs Mazraa)
REJECT = {"Mrah es Saiyed", "Mazraat Kfardibiane"}

QUERY = """[out:json][timeout:180];
area["ISO3166-1"="LB"][admin_level=2]->.lb;
(nwr["name:ar"](area.lb); nwr["place"]["name"](area.lb););
out center tags;"""

AR = {"ب": "b", "ت": "t", "ث": "t", "ج": "j", "ح": "h", "خ": "X", "د": "d", "ذ": "z", "ر": "r",
      "ز": "z", "س": "s", "ش": "C", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "غ": "G", "ف": "f",
      "ق": "k", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "", "ع": "", "ء": "",
      "أ": "", "إ": "", "آ": "", "ا": "", "ى": "", "ئ": "", "ؤ": "", "و": "", "ي": "", "پ": "b"}


def fetch(refresh):
    if os.path.exists(CACHE) and not refresh:
        return json.load(open(CACHE))
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=urllib.parse.urlencode({"data": QUERY}).encode(),
                                 headers={"User-Agent": "LebanonHub/1.0 (research)"})
    els = json.load(urllib.request.urlopen(req, timeout=240))["elements"]
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(els, open(CACHE, "w"), ensure_ascii=False)
    return els


def ar_key(s):
    s = re.sub(r"[ً-ْـ]", "", s)              # harakat, tatweel
    out = []
    for w in s.split():
        if w.startswith("ال") and len(w) > 3:
            w = w[2:]
        out.append("".join(AR.get(c, "") for c in w))
    return re.sub(r"(.)\1+", r"\1", "".join(out))


def lat_key(s):
    key = gazetteer.normalize(s)
    out = []
    for w in key.split():
        if w in gazetteer.ARTICLES:
            continue
        w = re.sub(r"(?<=[aeiouy])h$", "", w)                   # Zahleh -> zahle
        for a, b in (("kh", "X"), ("sh", "C"), ("ch", "C"), ("gh", "G"), ("th", "t"), ("dh", "z"),
                     ("q", "k"), ("c", "k"), ("g", "j")):
            w = w.replace(a, b)
        w = re.sub(r"[aeiouwy'`]", "", w)
        out.append(w)
    return re.sub(r"(.)\1+", r"\1", "".join(out))


def metres(a, b):
    dy = (a[0] - b[0]) * 111_320
    dx = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def arabic_of(tags):
    for k in ("name:ar", "name"):
        v = tags.get(k, "")
        if v and gazetteer.is_arabic(v):
            return v.strip()
    return ""


def main():
    els = fetch("--refresh" in sys.argv)
    feats = []
    for e in els:
        tags = e.get("tags", {})
        ar = arabic_of(tags)
        lat, lon = (e.get("lat"), e.get("lon")) if "lat" in e else (e.get("center", {}).get("lat"), e.get("center", {}).get("lon"))
        if ar and lat is not None and tags.get("place") in PLACES:
            feats.append({"id": f"{e['type']}/{e['id']}", "ar": ar, "k": ar_key(ar), "ll": (lat, lon),
                          "place": tags.get("place", "")})
    named = {json.loads(l).get("attr", {}).get("place_id") for l in open(os.path.join(VIL, "P-arabic-names.jsonl"))}
    named |= {json.loads(l).get("place_id") for l in open(os.path.join(VIL, "P-arabic-osm.jsonl"))}
    rows, missing = [], 0
    for l in open(os.path.join(VIL, "D4-places.jsonl")):
        p = json.loads(l)
        a = p.get("attr", {})
        pid = a.get("place_id") or p.get("place_id")
        if p.get("name_ar") or a.get("name_ar") or pid in named or a.get("lat") is None or p["name"] in REJECT:
            continue
        missing += 1
        lk = lat_key(p["name"])
        if len(lk) < 3:
            continue
        best = None
        for f in feats:
            d = metres((a["lat"], a["lon"]), f["ll"])
            if d > MAX_M or len(f["k"]) < 3:
                continue
            r = difflib.SequenceMatcher(None, lk, f["k"]).ratio()
            if r >= MIN_RATIO and (best is None or (r, -d) > (best[0], -best[1])):
                best = (r, d, f)
        if best:
            r, d, f = best
            rows.append({"place_id": pid, "pcode": p.get("pcode"), "name": p["name"], "name_ar": f["ar"],
                         "osm_id": f["id"], "osm_place": f["place"] or None, "distance_m": round(d),
                         "match": "consonant", "score": round(r, 2), "latin_key": lk, "arabic_key": f["k"],
                         "source": "OpenStreetMap", "license": "ODbL 1.0"})
    with open(OUT, "w") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"features {len(feats)}  missing {missing}  matched {len(rows)}  -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
