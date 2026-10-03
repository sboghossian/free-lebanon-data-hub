#!/usr/bin/env python3
"""Build research/geo/gazetteer.jsonl from OCHA-CAS localities + GeoNames + OSM (HOT) + COD-AB.

Run: python3 research/geo/build_gazetteer.py   (inputs are cached under cache/geo/)
Sources are merged by normalised name + distance; see README.md.
"""
import collections
import json
import math
import os
import re
import sys
import unicodedata
import warnings
from difflib import SequenceMatcher

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "cache", "geo")
OUT = os.path.join(ROOT, "research", "geo", "gazetteer.jsonl")
sys.path.insert(0, os.path.join(ROOT, "build"))
from gazetteer import normalize, skeleton, is_arabic  # noqa: E402

warnings.filterwarnings("ignore")


# ------------------------------------------------------------------ geometry
def _rings(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return polys


def _in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_poly(x, y, poly):
    if not _in_ring(x, y, poly[0]):
        return False
    return not any(_in_ring(x, y, h) for h in poly[1:])


class AdminIndex:
    """Point-in-polygon over COD-AB admin3 (cadastral) polygons, with adm2/adm1 names via properties."""
    CELL = 0.05

    def __init__(self, path):
        d = json.load(open(path, encoding="utf-8"))
        self.feats = []
        self.grid = collections.defaultdict(list)
        for f in d["features"]:
            p = f["properties"]
            polys = _rings(f["geometry"])
            xs = [c[0] for poly in polys for c in poly[0]]
            ys = [c[1] for poly in polys for c in poly[0]]
            bb = (min(xs), min(ys), max(xs), max(ys))
            idx = len(self.feats)
            self.feats.append((bb, polys, p))
            for gx in range(int(bb[0] / self.CELL), int(bb[2] / self.CELL) + 1):
                for gy in range(int(bb[1] / self.CELL), int(bb[3] / self.CELL) + 1):
                    self.grid[(gx, gy)].append(idx)

    def find(self, lon, lat):
        best = None
        for i in self.grid.get((int(lon / self.CELL), int(lat / self.CELL)), ()):
            bb, polys, p = self.feats[i]
            if bb[0] <= lon <= bb[2] and bb[1] <= lat <= bb[3] and any(_in_poly(lon, lat, pl) for pl in polys):
                if p["adm3_pcode"] == "0" or p["adm3_name"] == "Conflict":
                    best = best or p        # tiny disputed slivers: only if nothing better
                    continue
                return p
        if best is None:                    # coastal / off-polygon: nearest centre within ~4 km
            near = None
            for gx in range(int(lon / self.CELL) - 1, int(lon / self.CELL) + 2):
                for gy in range(int(lat / self.CELL) - 1, int(lat / self.CELL) + 2):
                    for i in self.grid.get((gx, gy), ()):
                        p = self.feats[i][2]
                        if p["adm3_pcode"] == "0":
                            continue
                        dd = (p["center_lon"] - lon) ** 2 + (p["center_lat"] - lat) ** 2
                        if near is None or dd < near[0]:
                            near = (dd, p)
            if near and near[0] < 0.04 ** 2:
                return near[1]
        return best

    def nearest(self, lon, lat, max_deg=0.12):
        """Nearest adm3 centre (for points just outside the polygons, e.g. the Shebaa/Ghajar edge)."""
        best = None
        r = int(max_deg / self.CELL) + 1
        for gx in range(int(lon / self.CELL) - r, int(lon / self.CELL) + r + 1):
            for gy in range(int(lat / self.CELL) - r, int(lat / self.CELL) + r + 1):
                for i in self.grid.get((gx, gy), ()):
                    p = self.feats[i][2]
                    if p["adm3_pcode"] == "0":
                        continue
                    dd = math.hypot(p["center_lon"] - lon, p["center_lat"] - lat)
                    if dd <= max_deg and (best is None or dd < best[0]):
                        best = (dd, p)
        return best[1] if best else None


def hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


# ------------------------------------------------------------------ names
def fold(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[‘’ʻʼʿʾ′`´]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def letters(s):
    return re.sub(r"[^a-z]", "", fold(s).lower())


def clean_alts(primary, alts, ar_primary=None, cap_latin=14, cap_ar=4):
    """Dedupe variants: Arabic first, then Latin; drop the primary, junk and near-duplicates."""
    seen_l = {letters(primary)}
    seen_a = set()
    lat, ara = [], []
    for a in alts:
        a = (a or "").strip()
        if len(a) < 2 or re.fullmatch(r"[\d\W]+", a):
            continue
        if is_arabic(a):
            k = normalize(a)
            if k and k not in seen_a:
                seen_a.add(k)
                ara.append(a)
        else:
            if a == a.lower():                         # GeoNames chat-style transliterations ("alkhyam")
                continue
            k = letters(a)
            if len(k) >= 2 and k not in seen_l:
                seen_l.add(k)
                lat.append(fold(a) if re.search(r"[^\x00-\x7f]", a) is None else a)
    return ara[:cap_ar] + lat[:cap_latin]


def _near_spelling(a, b):
    """Same token count and every token pair similar (blocks 'Ouata el Kalb' vs 'Wadi el Kalb')."""
    ta, tb = a.split(), b.split()
    return (len(ta) == len(tb) and SequenceMatcher(None, a, b).ratio() >= 0.8
            and all(SequenceMatcher(None, x, y).ratio() >= 0.75 for x, y in zip(ta, tb)))


# ------------------------------------------------------------------ record store
class Store:
    CELL = 0.06

    def __init__(self):
        self.recs = []
        self.grid = collections.defaultdict(list)

    def add(self, r):
        r["_k"] = {normalize(r["name"])} | {normalize(a) for a in r["alt"] if not is_arabic(a)}
        r["_ar"] = {normalize(a) for a in r["alt"] + [r.get("name_ar") or ""] if is_arabic(a)}
        r["_p"] = normalize(r["name"])
        r["_ps"] = skeleton(r["_p"])
        self.recs.append(r)
        self.grid[(int(r["lon"] / self.CELL), int(r["lat"] / self.CELL))].append(r)
        return r

    def near(self, lat, lon):
        gx, gy = int(lon / self.CELL), int(lat / self.CELL)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                yield from self.grid.get((gx + dx, gy + dy), ())

    def match(self, name, alts, lat, lon, ar=()):
        """Find an existing record for the same place. Primary-name evidence required on one side."""
        pk = normalize(name)
        pks = skeleton(pk)
        akeys = {normalize(a) for a in alts if not is_arabic(a)} | {pk}
        arset = {normalize(a) for a in list(alts) + list(ar) if is_arabic(a)} - {""}
        best = None
        for c in self.near(lat, lon):
            d = hav(lat, lon, c["lat"], c["lon"])
            if d > 6:
                continue
            ok = 0
            if pk in c["_k"] or c["_p"] in akeys:
                ok = 1
            elif arset and (arset & c["_ar"]):
                ok = 1
            elif d <= 2.5 and pks and pks == c["_ps"]:
                ok = 2
            elif d <= 0.3 and len(pk) >= 5 and _near_spelling(pk, c["_p"]):
                ok = 3                      # same spot, near-identical spelling
            if ok and (best is None or (ok, d) < (best[0], best[1])):
                best = (ok, d, c)
        return best[2] if best else None


def merge_into(c, r):
    """Fold record r into existing c: alts, Arabic, population, src, kind precedence."""
    for a in r["alt"] + ([r["name"]] if normalize(r["name"]) != normalize(c["name"]) else []):
        if a not in c["alt"]:
            c["alt"].append(a)
    if r.get("name_ar") and not c.get("name_ar"):
        c["name_ar"] = r["name_ar"]
    if r.get("pop") and not c.get("pop"):
        c["pop"] = r["pop"]
    for s in r["src"]:
        if s not in c["src"]:
            c["src"].append(s)
    if KIND_RANK[r["kind"]] > KIND_RANK[c["kind"]]:
        c["kind"] = r["kind"]
    c["_k"] |= r["_k"]
    c["_ar"] |= r["_ar"]


OFFICIAL_CAMPS = [
    ("Shatila", ["Shatila", "Chatila", "Shatilla"]),
    ("Burj el-Barajneh", ["Burj el-Barajneh", "Borj el Brajne", "Burj al Barajinah", "El Burj Barajn", "Borj el Barajneh"]),
    ("Ein el-Hilweh", ["Ein el-Hilweh", "Ain el Hiloue", "Ain al Hilwi", "Ain el Hilweh"]),
    ("Mieh Mieh", ["Mieh Mieh", "Miyeh wa Miyeh"]),
    ("Rashidieh", ["Rashidieh", "Rachidiye", "Rashidiyeh"]),
    ("El Buss", ["El Buss", "El Bass", "Al Buss"]),
    ("Burj el-Shemali", ["Burj el-Shemali", "Borj ech Chmali", "Burj ash Shamali", "Borj Chemali", "Burj el Shamali"]),
    ("Beddawi", ["Beddawi", "Beddaoui", "Baddawi"]),
    ("Nahr el-Bared", ["Nahr el-Bared", "Nahr El Bared", "Nahr al Barid"]),
    ("Wavel", ["Wavel", "Camp Wavel", "Wayval", "Jalil"]),
    ("Dbayeh", ["Dbayeh", "Dbaiye", "Dubayyah"]),
    ("Mar Elias", ["Mar Elias", "Mar Ilyas", "Mar Elyas"]),
    ("Jisr el-Bacha", ["Jisr el Bacha", "Camp Jisr el Bacha", "Jisr al Basha"]),
    ("Tel al-Zaatar", ["Tall az Zatar", "Mukhayyam Tall az Zatar", "Tel al Zaatar", "Tal al Zaatar"]),
]

CITY_KEYS = {(normalize(n), d) for n, d in [
    ("Beirut", "Beirut"), ("Tripoli", "Tripoli"), ("Saida", "Saida"), ("Sour", "Sour"), ("Zahle", "Zahle"),
    ("Jounieh", "Kesrwane"), ("Nabatieh", "El Nabatieh"), ("Nabatiye el Tahta", "El Nabatieh"), ("Baalbek", "Baalbek"), ("Jbeil", "Jbeil")]}

CITY_FIX = {("Nabatiye el Tahta", "El Nabatieh"): ("Nabatieh", "Nabatiyeh", "Nabatiye"),
            ("Jbail", "Jbeil"): ("Jbeil", "Byblos", "Jubayl"),
            ("Sour", "Sour"): ("Sour", "Tyre", "Sur"),
            ("Saida", "Saida"): ("Saida", "Sidon", "Sayda")}

KIND_RANK = {"locality": 0, "village": 1, "neighbourhood": 2, "town": 3, "city": 4, "camp": 5,
             "area": 1, "mountain": 1, "river": 1, "other": 0}


# ------------------------------------------------------------------ loaders
def load_ocha():
    import openpyxl
    wb = openpyxl.load_workbook(os.path.join(CACHE, "ocha_loc.xlsx"), read_only=True)
    rows = list(wb["Locations"].iter_rows(values_only=True))[1:]
    out = []
    for r in rows:
        if not r[1] or r[3] is None:
            continue
        name = re.sub(r"\s+", " ", str(r[1])).strip()
        ar = re.sub(r"\s+", " ", str(r[2] or "")).strip()
        out.append({"name": name, "alt": [ar] if ar else [], "name_ar": ar or None, "lat": float(r[3]), "lon": float(r[4]),
                    "pcode": r[0], "kind": "neighbourhood" if r[10] == "Beirut" else "village", "pop": None,
                    "src": ["OCHA-CAS-2017"]})
    return out


GN_POP_KIND = {"PPLC": "city", "PPLA": "town", "PPLA2": "town", "PPLA3": "town", "PPLX": "neighbourhood",
               "PPLQ": "locality", "PPLH": "locality", "PPLW": "locality", "PPLL": "locality", "PPLCH": "locality"}
GN_OTHER = {"MT": "mountain", "MTS": "mountain", "PK": "mountain", "STM": "river", "STMI": "river",
            "AREA": "area", "LCTY": "area", "RGN": "area", "RGNH": "area",
            "HLL": "other", "HLLS": "other", "RDGE": "other", "PASS": "other", "VAL": "other", "PLN": "other",
            "PLAT": "other", "ISL": "other", "ISLS": "other", "CAPE": "other", "PT": "other", "BAY": "other",
            "WAD": "other", "WADS": "other", "AIRP": "other", "AIRB": "other", "AIRF": "other", "AIRH": "other",
            "MILB": "other", "BRKS": "other", "FT": "other", "PRT": "other", "DAM": "other", "PS": "other",
            "HSP": "other", "UNIV": "other", "CSTL": "other", "MSTY": "other", "RUIN": "other", "CMP": "other"}


def gn_rows():
    for line in open(os.path.join(CACHE, "LB.txt"), encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 19:
            continue
        yield {"id": f[0], "name": f[1], "ascii": f[2], "alts": [x for x in f[3].split(",") if x], "lat": float(f[4]),
               "lon": float(f[5]), "cls": f[6], "code": f[7], "pop": int(f[14] or 0)}


def gn_primary(g):
    n = fold(g["name"])
    return n if n else g["ascii"]


def load_geonames_populated():
    out = []
    for g in gn_rows():
        c = g["code"]
        if c == "CMPRF" or (c == "CMP" and g["name"].startswith("Mukhayyam")):
            kind = "camp"
        elif c == "PPL":
            kind = "town" if g["pop"] >= 8000 else "village"
        elif c in GN_POP_KIND:
            kind = GN_POP_KIND[c]
            if c == "PPLA" and g["pop"] >= 50000:
                kind = "city"
        else:
            continue
        name = gn_primary(g)
        out.append({"name": name, "alt": [a for a in g["alts"] + [g["name"]]], "name_ar": None, "lat": g["lat"], "lon": g["lon"],
                    "pcode": None, "kind": kind, "pop": g["pop"] or None, "src": ["GeoNames"], "gn": g["id"]})
    return out


def load_geonames_other():
    out = []
    for g in gn_rows():
        c = g["code"]
        if c == "CMP" and g["name"].startswith("Mukhayyam"):
            continue
        kind = GN_OTHER.get(c)
        if not kind:
            continue
        out.append({"name": gn_primary(g), "alt": g["alts"] + [g["name"]], "name_ar": None, "lat": g["lat"], "lon": g["lon"],
                    "pcode": None, "kind": kind, "pop": None, "src": ["GeoNames"], "gn": g["id"], "code": c})
    return out


def centroid(geom):
    pts = [c for poly in _rings(geom) if geom["type"] != "Point" for c in poly[0]] if geom["type"] != "Point" else [geom["coordinates"]]
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)


def load_osm():
    d = json.load(open(os.path.join(CACHE, "populated_places.geojson"), encoding="utf-8"))
    out = []
    for f in d["features"]:
        p = f["properties"]
        if not p.get("place"):
            continue
        ar = p.get("name_ar") or (p["name"] if p.get("name") and is_arabic(p["name"]) else None)
        lat_name = p.get("name_en") or p.get("name_latin") or (p["name"] if p.get("name") and not is_arabic(p["name"]) else None)
        if not (lat_name or ar):
            continue
        if not lat_name:
            continue                     # Arabic-only OSM nodes: no Latin spelling to key on, skip
        lat, lon = centroid(f["geometry"])
        kind = {"city": "city", "town": "town", "village": "village"}.get(p["place"], "locality")
        pop = None
        try:
            pop = int(re.sub(r"\D", "", str(p.get("population") or "")) or 0) or None
        except ValueError:
            pass
        alts = [a for a in (ar, p.get("name_latin"), p.get("name")) if a and a != lat_name]
        out.append({"name": re.sub(r"\s+", " ", lat_name).strip(), "alt": alts, "name_ar": ar, "lat": lat, "lon": lon,
                    "pcode": None, "kind": kind, "pop": pop, "src": ["OSM-HOT"]})
    return out


# ------------------------------------------------------------------ build
def prep(r):
    r["_k"] = {normalize(r["name"])} | {normalize(a) for a in r["alt"] if not is_arabic(a)}
    r["_ar"] = {normalize(a) for a in r["alt"] + [r.get("name_ar") or ""] if is_arabic(a)}
    return r


def main():
    adm = AdminIndex(os.path.join(CACHE, "lbn_admin3.geojson"))
    store = Store()
    stats = collections.Counter()

    base = load_ocha()
    for r in base:
        store.add(r)
    stats["ocha"] = len(base)

    for label, rows in (("geonames_pop", load_geonames_populated()), ("osm", load_osm())):
        for r in rows:
            m = store.match(r["name"], r["alt"], r["lat"], r["lon"], [r["name_ar"]] if r.get("name_ar") else [])
            prep(r)
            if m:
                merge_into(m, r)
                stats[label + "_merged"] += 1
            else:
                store.add(r)
                stats[label + "_new"] += 1

    # adm3 cadastral units with no matching place: add the cadastral centre as a locality
    seen = set()
    for bb, polys, p in adm.feats:
        if p["adm3_pcode"] in seen or p["adm3_pcode"] == "0":
            continue
        seen.add(p["adm3_pcode"])
        lat, lon = p["center_lat"], p["center_lon"]
        ar = p.get("adm3_name1")
        r = {"name": p["adm3_name"], "alt": [ar] if ar else [], "name_ar": ar, "lat": lat, "lon": lon, "pcode": None,
             "kind": "locality", "pop": None, "src": ["OCHA-COD-AB-adm3"]}
        prep(r)
        m = store.match(r["name"], r["alt"], lat, lon, [ar] if ar else [])
        if m:
            merge_into(m, r)
            stats["adm3_merged"] += 1
        else:
            store.add(r)
            stats["adm3_new"] += 1

    places = list(store.recs)

    # natural + infrastructure features: deduped among themselves only
    nat = Store()
    for r in load_geonames_other():
        prep(r)
        m = None
        for c in nat.near(r["lat"], r["lon"]):
            if c["kind"] == r["kind"] and (c["_k"] & r["_k"]) and hav(r["lat"], r["lon"], c["lat"], c["lon"]) < 1.0:
                m = c
                break
        if m:
            merge_into(m, r)
        else:
            nat.add(r)
    places += nat.recs
    stats["natural"] = len(nat.recs)

    # admin units (districts and governorates) as area records, plus two named conflict areas
    for lvl, fn in ((1, "lbn_admin1.geojson"), (2, "lbn_admin2.geojson")):
        for f in json.load(open(os.path.join(CACHE, fn), encoding="utf-8"))["features"]:
            p = f["properties"]
            ar = p.get("adm%d_name1" % lvl)
            places.append({"name": p["adm%d_name" % lvl], "alt": [ar] if ar else [], "name_ar": ar, "lat": p["center_lat"],
                           "lon": p["center_lon"], "pcode": p["adm%d_pcode" % lvl], "kind": "area", "pop": None,
                           "src": ["OCHA-COD-AB-adm%d" % lvl], "_adm_level": lvl})
    places.append({"name": "Dahieh", "alt": ["Dahiyeh", "Dahiya", "Al-Dahiyah", "Beirut Southern Suburbs", "Southern Suburbs",
                                              "الضاحية الجنوبية", "الضاحية"],
                   "name_ar": "الضاحية الجنوبية", "lat": 33.8529, "lon": 35.5088,
                   "pcode": None, "kind": "area", "pop": None, "src": ["manual (centre = Haret Hreik, OCHA-CAS)"]})
    places.append({"name": "Shebaa Farms", "alt": ["Shebaa Farms area", "Mazari Shebaa", "Mazari Shib'a", "Chebaa Farms",
                                                      "مزارع شبعا"],
                   "name_ar": "مزارع شبعا", "lat": 33.3, "lon": 35.73, "pcode": None,
                   "kind": "area", "pop": None, "src": ["manual (approximate centre of the disputed area, no authoritative boundary)"]})

    for r in places:
        if r["kind"] == "camp":
            hit = None
            for official, variants in OFFICIAL_CAMPS:        # primary-name match first, alt names second
                if normalize(r["name"]) in {normalize(v) for v in variants}:
                    hit = official
                    break
            for official, variants in OFFICIAL_CAMPS:
                if hit:
                    break
                if {normalize(v) for v in variants} & r["_k"]:
                    hit = official
            if hit and r["name"] != hit:
                r["alt"] = [r["name"]] + r["alt"]
                r["name"] = hit

    # administrative placement by point-in-polygon, then write
    a1 = {}
    for f in json.load(open(os.path.join(CACHE, "lbn_admin2.geojson"), encoding="utf-8"))["features"]:
        a1[f["properties"]["adm2_pcode"]] = f["properties"]
    n_noadm = n_approx = 0
    kinds = collections.Counter()
    rows = []
    for r in places:
        p = adm.find(r["lon"], r["lat"])
        adm1 = adm2 = adm3 = a2c = a3c = None
        if p is None and not r.get("_adm_level"):
            q = adm.nearest(r["lon"], r["lat"])
            if q:
                adm1, adm2, a2c = q["adm1_name"], q["adm2_name"], q["adm2_pcode"]
                n_approx += 1
        if p:
            a2c = p["adm2_pcode"] if p["adm2_pcode"] != "Conflict" else None
            adm1, adm2 = (p["adm1_name"], p["adm2_name"]) if a2c else (None, None)
            adm3, a3c = (p["adm3_name"], p["adm3_pcode"]) if p["adm3_pcode"] != "0" else (None, None)
        if r.get("_adm_level"):
            if r["_adm_level"] == 1:
                adm1, adm2, adm3, a2c, a3c = r["name"], None, None, None, None
            else:
                adm2, a2c = r["name"], r["pcode"]
                adm1 = a1[a2c]["adm1_name"]
                adm3 = a3c = None
        if not adm1:
            n_noadm += 1
        alt = clean_alts(r["name"], ([r["name_ar"]] if r.get("name_ar") else []) + r["alt"], r.get("name_ar"))
        if r["kind"] in ("village", "town", "city", "locality"):
            r["kind"] = "city" if (normalize(r["name"]), adm2) in CITY_KEYS else ("town" if r["kind"] == "city" else r["kind"])
        fix = CITY_FIX.get((r["name"], adm2))
        if fix:
            alt = [r["name"]] + [x for x in fix[1:] if x not in alt] + alt
            r["name"] = fix[0]
            alt = clean_alts(r["name"], alt, r.get("name_ar"))
        rec = {"name": r["name"], "alt": alt, "lat": round(r["lat"], 5), "lon": round(r["lon"], 5), "adm1": adm1,
               "adm2": adm2, "adm3": adm3, "pcode": r["pcode"], "kind": r["kind"], "pop": r.get("pop"),
               "src": "+".join(r["src"]), "adm2_pcode": a2c, "adm3_pcode": a3c, "name_ar": r.get("name_ar")}
        rows.append(rec)
        kinds[rec["kind"]] += 1
    order = {"city": 0, "town": 1, "village": 2, "locality": 3, "neighbourhood": 4, "camp": 5, "area": 6, "mountain": 7, "river": 8, "other": 9}
    rows.sort(key=lambda x: (order[x["kind"]], x["adm2"] or "", x["name"]))
    with open(OUT, "w", encoding="utf-8") as fh:
        for rec in rows:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(json.dumps({"total": len(rows), "kinds": kinds, "no_adm": n_noadm, "adm_nearest": n_approx, "stats": stats}, ensure_ascii=False, default=dict))


if __name__ == "__main__":
    main()
