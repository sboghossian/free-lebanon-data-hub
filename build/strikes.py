"""Strike map data: geocode research/strikes/*.jsonl against the gazetteer and emit the compact blob for the hub.

    import strikes
    S = strikes.build(events)    # events: the timeline events (list of dicts) for the "Open in timeline" link; may be []
    S["strikes"], S["geo"], S.get("acled"), S["stats"]

Geocoding order (never guesses across districts):
  1. a place that names a governorate or district ("Nabatieh Governorate", "exact location withheld") is area-level: counted, not plotted;
  2. the row's district is known: look the place up inside that district only (exact, then consonant skeleton, then fuzzy >= FUZZY_MIN);
  3. no district: only an exact or skeleton match, and only if it is unambiguous (one candidate, or one city or town outranks villages);
  4. research/strikes/geocode-overrides.jsonl (hand-checked coordinates with an evidence URL) wins when it names the row's district, and fills in rows the steps above could not place;
  5. otherwise the row is unresolved and goes to research/strikes/_unresolved.tsv with the reason and the candidates.
place_alt and the gazetteer's alternate names are used at every step (gazetteer.lookup does that).
"""
import glob
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gazetteer as G  # noqa: E402

R = os.path.join(HERE, "..", "research") + os.sep
STRIKES_DIR = R + "strikes" + os.sep
UNRESOLVED_TSV = STRIKES_DIR + "_unresolved.tsv"
OVERRIDES = STRIKES_DIR + "geocode-overrides.jsonl"
GEO_DIR = os.path.join(HERE, "geo")

FUZZY_MIN = 0.80          # district-constrained fuzzy matches only
EXACT_MIN = 0.86          # no district: exact (1.0) and skeleton (0.86) only
POPULATED = G.POPULATED   # city, town, village, locality, neighbourhood, camp
WARS = ["civil_war", "1978", "1982", "1993", "1996", "2006", "2023_26", "other"]
KINDS = ["airstrike", "drone_strike", "shelling", "artillery", "naval", "car_bomb", "bombing", "ground_assault", "massacre",
         "cluster_munition", "white_phosphorus", "explosion", "other"]
CONF = ["✅", "📣", "🧪"]
COLS = ["t", "te", "pl", "pn", "w", "k", "kl", "kt", "inj", "a", "tg", "ti", "u", "c", "n", "ar", "q"]  # q: 0 named place, 2 inferred among same-name villages, 3 fuzzy spelling
S_UNITS = 2000.0          # projected height in units (about 90 m per unit)
TITLE_MAX = 150

# Wars fought at the front: when several villages share a name, the one in the highest tier that holds exactly one is chosen and flagged "inferred".
_SOUTH, _BEKAA = {"South", "El Nabatieh"}, {"Bekaa", "Baalbek-El Hermel"}  # Beirut and Mount Lebanon are not inferred: same-name towns there stay unresolved
THEATRE = {"2023_26": [_SOUTH, _BEKAA], "2006": [_SOUTH, _BEKAA], "1993": [_SOUTH, _BEKAA], "1996": [_SOUTH, _BEKAA], "1978": [_SOUTH]}
_AREA_STRIP = re.compile(r"\b(governorate|district|caza|qada|province|region|valley)\b", re.I)
_AREA_WORDS = re.compile(r"\b(governorate|district|caza|qada|province|region|exact location withheld|withheld|unspecified)\b", re.I)
_PAREN = re.compile(r"\s*[\(\[][^)\]]*[\)\]]")


# ---------------------------------------------------------------- small pure helpers (unit-tested)

def clean_place(p):
    """Strip parentheticals ("(exact location withheld)") and trailing qualifiers that are not part of the name."""
    p = _PAREN.sub("", p or "").strip(" ,;.-")
    p = re.sub(r"\s+(area|outskirts|surroundings|vicinity|environs|suburbs?)$", "", p, flags=re.I)
    return p.strip()


def is_area_text(p):
    """True when the source names a governorate or district, or says the location was withheld, instead of a place."""
    return bool(_AREA_WORDS.search(p or ""))


def parse_killed(v):
    """killed field -> (low bound int or -1, text shown on the card or '').  '8-10' -> (8, '8-10'); 12 -> (12, ''); None -> (-1, '')."""
    if v is None or v == "":
        return -1, ""
    if isinstance(v, bool):
        return -1, ""
    if isinstance(v, (int, float)):
        return int(v), ""
    s = str(v).strip().replace("–", "-").replace("—", "-")
    m = re.match(r"^~?(\d+)\s*-\s*(\d+)$", s)
    if m:
        return int(m.group(1)), f"{m.group(1)}-{m.group(2)}"
    m = re.match(r"^~?(\d[\d,]*)\+?$", s)
    if m:
        return int(m.group(1).replace(",", "")), ("" if "+" not in s else s)
    return -1, s[:20]


def date_key(d):
    """'1982-06-06' / '1982-06' / '1982' -> sortable 'YYYY-MM-DD' (missing parts become 01); '' when unparseable."""
    m = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$", str(d or ""))
    if not m:
        return ""
    return f"{m.group(1)}-{m.group(2) or '01'}-{m.group(3) or '01'}"


def project_fn(lon0, lat0, lat_top, s_units=S_UNITS, scale=None):
    """Equirectangular projection with the cosine of the centre latitude; returns (fn(lon,lat)->(x,y) ints, scale)."""
    k = math.cos(math.radians(lat0))
    sc = scale if scale is not None else s_units
    return (lambda lon, lat: (round((lon - lon0) * k * sc), round((lat_top - lat) * sc))), k


# ---------------------------------------------------------------- geocoding

def _ring_centroid(ring):
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    if abs(a) < 1e-12:
        return ring[0]
    return cx / (3 * a), cy / (3 * a)


def _pick_by_priority(cands):
    """Among equally scored candidates choose a unique winner or return None.  A city or town (population known) outranks villages."""
    top = cands[0]["score"]
    tied = [c for c in cands if c["score"] >= top - 1e-9]
    if len(tied) == 1:
        return tied[0], tied
    # same coordinates within 1.5 km = the same place listed twice (cadastral centre + village)
    def near(a, b):
        return abs(a["lat"] - b["lat"]) < 0.014 and abs(a["lon"] - b["lon"]) < 0.017
    p0 = tied[0]["place"]
    if all(near(p0, c["place"]) for c in tied[1:]):
        return tied[0], tied
    big = [c for c in tied if c["place"]["kind"] in ("city", "town") and (c["place"].get("pop") or 0) > 0]
    if len(big) == 1:
        return big[0], tied
    return None, tied


def _theatre_pick(tied, war):
    """Disambiguate same-named villages by the war's front line; None when the tiers do not single one out."""
    for tier in THEATRE.get(war, ()):
        hit = [c for c in tied if c["place"].get("adm1") in tier]
        if len(hit) == 1:
            return hit[0]
        if len(hit) > 1:
            return None
    return None


def _is_adm_area(r):
    return r["kind"] == "area" and bool(re.match(r"^LB\d+$", str(r.get("pcode") or "")))


def load_overrides(path=None):
    """research/strikes/geocode-overrides.jsonl -> {(place key, district keys or None): record}. Curated by hand, each with an evidence URL.
    A row with a district is matched to the override that names the same district; one without a district only to an override with no district."""
    p = path or OVERRIDES
    out = {}
    if not os.path.exists(p):
        return out
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if not isinstance(r, dict) or not r.get("place") or not isinstance(r.get("lat"), (int, float)) or not isinstance(r.get("lon"), (int, float)):
                continue
            dk = frozenset(G._district_keys(r["district"])) if r.get("district") else None
            out[(G.normalize(r["place"]), dk)] = r
    return out


def _override_place(ov, index):
    """The place record an override stands for: its own coordinates, with the name and districts of the gazetteer entry its pcode points to."""
    rec = {"name": ov["place"], "lat": ov["lat"], "lon": ov["lon"], "adm1": None, "adm2": ov.get("district"), "src": "override", "name_ar": "", "pcode": ov.get("pcode"), "kind": "village"}
    if ov.get("pcode"):
        for r in index.records:
            if r.get("pcode") == ov["pcode"]:
                rec.update({"name": r["name"], "adm1": r.get("adm1"), "adm2": r.get("adm2") or rec["adm2"], "name_ar": r.get("name_ar") or ""})
                break
    return rec


def _find_override(row, overrides):
    names = [clean_place(row.get("place"))] + [clean_place(a) for a in (row.get("place_alt") or [])]
    dk = G._district_keys(row["district"]) if row.get("district") else set()
    for n in names:
        k = G.normalize(n)
        if not k:
            continue
        for (ok, odk), ov in overrides.items():
            if ok == k and odk is not None and odk & dk:
                return ov, "override"
    for n in names:
        k = G.normalize(n)
        if k and (k, None) in overrides:
            return overrides[(k, None)], "override-nodistrict"
    return None, None


def geocode(row, index=None, overrides=None):
    """Gazetteer geocoding (see the module doc) plus the curated overrides. An override that names the row's district always wins; an override
    with no district is used when the row has no usable district, or when the gazetteer could not place the row. Area-level text is never overridden."""
    ix = index or G.load()
    res = geocode_gazetteer(row, ix)
    if res["status"] == "area" or is_area_text(row.get("place")):
        return res
    ov_map = load_overrides() if overrides is None else overrides
    if not ov_map:
        return res
    ov, how = _find_override(row, ov_map)
    if ov is None:
        return res
    d_ok = bool(row.get("district")) and G.known_district(row["district"])
    if how == "override" or not d_ok or res["status"] == "unresolved":
        return {"status": "point", "place": _override_place(ov, ix), "how": "override", "score": 1.0, "cands": []}
    return res


def geocode_gazetteer(row, index=None):
    """-> dict(status='point'|'area'|'unresolved', place=<gazetteer record>|None, how, score, reason, cands)."""
    ix = index or G.load()
    name = clean_place(row.get("place"))
    alts = [clean_place(a) for a in (row.get("place_alt") or []) if a]
    alts = [a for a in alts if a and a != name]
    raw = row.get("place") or ""
    if not name and not alts:
        return {"status": "unresolved", "reason": "no place name", "cands": []}
    district = row.get("district")
    d_ok = bool(district) and G.known_district(district)
    war = row.get("war")
    if is_area_text(raw):
        stripped = re.sub(r"\s+", " ", _AREA_STRIP.sub("", name or alts[0])).strip(" -,")
        want_gov = bool(re.search(r"governorate|province", raw, re.I))
        res = G.lookup(stripped or name, alts, kinds={"area"}, limit=8, min_score=0.9, index=ix)
        res = [c for c in res if _is_adm_area(c["place"])]
        if want_gov:
            res = [c for c in res if re.match(r"^LB\d$", c["place"]["pcode"])] or res
        label = res[0]["place"]["name"] if res else (stripped or name)
        return {"status": "area", "place": {"name": label}, "how": "area-text", "score": 1.0, "cands": []}
    other_kinds = {"mountain", "other", "river"}
    res = []
    if d_ok:
        res = G.lookup(name, alts, district=district, kinds=POPULATED | {"area"}, limit=6, min_score=FUZZY_MIN, index=ix)
        res = [c for c in res if not _is_adm_area(c["place"])]
        if res:
            pick, tied = _pick_by_priority(res)
            if pick is None:
                return {"status": "unresolved", "reason": "ambiguous inside district", "cands": tied}
            return {"status": "point", "place": pick["place"], "how": pick["how"], "score": pick["score"], "cands": []}
        feat = [c for c in G.lookup(name, alts, district=district, kinds=other_kinds, limit=3, min_score=0.95, index=ix)]
        if feat:
            return {"status": "point", "place": feat[0]["place"], "how": "feature", "score": feat[0]["score"], "cands": []}
    else:
        res = G.lookup(name, alts, kinds=POPULATED | {"area"}, limit=12, min_score=EXACT_MIN, index=ix)
    pts = [c for c in res if not _is_adm_area(c["place"])]
    if not d_ok:
        if pts:
            pick, tied = _pick_by_priority(pts)
            if pick is not None:
                return {"status": "point", "place": pick["place"], "how": pick["how"], "score": pick["score"], "cands": []}
            t = _theatre_pick(tied, war) if tied[0]["score"] >= 0.95 else None  # same normalised name only, never a skeleton match
            if t is not None:
                return {"status": "point", "place": t["place"], "how": "theatre", "score": t["score"], "cands": tied}
            return {"status": "unresolved", "reason": "ambiguous: same name in several districts", "cands": tied}
        feat = G.lookup(name, alts, kinds=other_kinds, limit=3, min_score=0.95, index=ix)
        if feat:
            return {"status": "point", "place": feat[0]["place"], "how": "feature", "score": feat[0]["score"], "cands": []}
    # the place text is itself a district or governorate ("Chouf", "Kesrwan", "Bekaa Valley"): area-level
    if G.known_district(name) or G.known_district(_AREA_STRIP.sub("", name).strip()):
        ar = G.lookup(_AREA_STRIP.sub("", name).strip() or name, alts, kinds={"area"}, limit=4, min_score=0.9, index=ix)
        ar = [c for c in ar if _is_adm_area(c["place"])]
        if ar:
            return {"status": "area", "place": ar[0]["place"], "how": ar[0]["how"], "score": ar[0]["score"], "cands": []}
    if d_ok:
        # the source's district disagrees with the gazetteer: only a major city (known population) with one candidate is accepted
        g = [c for c in G.lookup(name, alts, kinds={"city", "town"}, limit=4, min_score=1.0, index=ix) if (c["place"].get("pop") or 0) > 0]
        if len(g) == 1:
            return {"status": "point", "place": g[0]["place"], "how": "city-district-mismatch", "score": g[0]["score"], "cands": []}
        glob_ = G.lookup(name, alts, kinds=POPULATED, limit=4, min_score=EXACT_MIN, index=ix)
        return {"status": "unresolved", "reason": f"not in {district}", "cands": glob_}
    return {"status": "unresolved", "reason": "no match", "cands": []}


# ---------------------------------------------------------------- geometry

def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return list(geom["coordinates"])


def _path(rings, proj):
    """Projected integer path with relative commands: 'M x y l dx dy ...z'. Drops repeated points."""
    out = []
    for ring in rings:
        pts, last = [], None
        for lon, lat in ring:
            p = proj(lon, lat)
            if p != last:
                pts.append(p)
                last = p
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        if len(pts) < 3:
            continue
        s = [f"M{pts[0][0]} {pts[0][1]}"]
        px, py = pts[0]
        body = []
        for x, y in pts[1:]:
            body.append(f"{x - px} {y - py}")
            px, py = x, y
        s.append("l" + " ".join(body) + "z")
        out.append("".join(s))
    return "".join(out)


def load_geo():
    """Boundaries pre-projected: returns (geo blob, project fn). Outer rings only carry labels."""
    with open(os.path.join(GEO_DIR, "lbn-adm1.json"), encoding="utf-8") as f1, open(os.path.join(GEO_DIR, "lbn-adm2.json"), encoding="utf-8") as f2:
        a1, a2 = json.load(f1), json.load(f2)
    lons, lats = [], []
    for f in a1["features"]:
        for poly in _rings(f["geometry"]):
            for lon, lat in poly[0]:
                lons.append(lon)
                lats.append(lat)
    lon0, lon1, lat0, lat1 = min(lons), max(lons), min(lats), max(lats)
    pad = 0.04
    lon0, lon1, lat0, lat1 = lon0 - pad, lon1 + pad, lat0 - pad, lat1 + pad
    k = math.cos(math.radians((lat0 + lat1) / 2))
    proj = lambda lon, lat: (round((lon - lon0) * k * S_UNITS), round((lat1 - lat) * S_UNITS))  # noqa: E731
    w, h = round((lon1 - lon0) * k * S_UNITS), round((lat1 - lat0) * S_UNITS)

    def label(f):
        best = max((poly[0] for poly in _rings(f["geometry"])), key=lambda r: abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))))
        cx, cy = _ring_centroid(best)
        return proj(cx, cy)

    adm1 = [{"n": f["properties"]["name"], "ar": f["properties"].get("name_ar") or "", "p": f["properties"]["pcode"], "d": _path([p[0] for p in _rings(f["geometry"])], proj),
             "l": list(label(f))} for f in a1["features"]]
    adm2 = [{"n": f["properties"]["name"], "a1": f["properties"].get("adm1"), "p": f["properties"]["pcode"],
             "d": _path([p[0] for p in _rings(f["geometry"])], proj), "l": list(label(f))} for f in a2["features"]]
    return {"w": w, "h": h, "lon0": round(lon0, 5), "lat1": round(lat1, 5), "k": round(k, 6), "s": S_UNITS, "adm1": adm1, "adm2": adm2}, proj


# ---------------------------------------------------------------- loading, timeline links, blob

def load_grounding(directory=None):
    """Jev verdicts from strike_check.py, keyed "file:line"; empty when the check has not run."""
    p = os.path.join(directory or STRIKES_DIR, "_grounding.jsonl")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return {r["key"]: r.get("verdict") for r in (json.loads(l) for l in fh if l.strip())}


LEFT_OUT = []  # rows dropped by a fixer or not supported by their own source page


def load_rows(directory=None):
    rows = []
    gr = load_grounding(directory)
    LEFT_OUT.clear()
    for p in sorted(glob.glob((directory or STRIKES_DIR) + "*.jsonl")):
        name = os.path.basename(p)
        if name.startswith("_"):
            continue
        with open(p, encoding="utf-8") as fh:
            for i, line in enumerate(fh):
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(r, dict) or not r.get("place") or not date_key(r.get("date")):
                    continue
                v = gr.get(f"{name}:{i}")
                if r.get("drop") or v == "unsupported":
                    LEFT_OUT.append((f"{name}:{i}", "dropped" if r.get("drop") else "unsupported", r.get("date"), r.get("place"), r.get("source")))
                    continue
                r["_gr"] = v
                rows.append(r)
    return rows


def _grams(text, maxn=3):
    toks = G._tokens(text)
    out = set()
    for n in range(1, maxn + 1):
        for i in range(len(toks) - n + 1):
            k = G.normalize(" ".join(toks[i:i + n]))
            if k:
                out.add(k)
    return out


def link_events(rows_geo, events):
    """{row index: event id} for rows whose day (or short day range) and place appear in a timeline event."""
    by_date = defaultdict(list)
    for e in events or []:
        if e.get("date") and len(e["date"]) == 10:
            by_date[e["date"]].append((e, _grams(" ".join([e.get("title") or "", e.get("pl") or ""] + list(e.get("ac") or [])))))
    out = {}
    if not by_date:
        return out
    for i, (r, g) in enumerate(rows_geo):
        d = date_key(r.get("date"))
        if len(str(r.get("date"))) != 10:
            continue
        keys = set()
        for n in [clean_place(r.get("place"))] + [clean_place(a) for a in r.get("place_alt") or []]:
            k = G.normalize(n, drop_qualifiers=True)
            if k:
                keys.add(k)
        if g.get("place"):
            keys.add(G.normalize(g["place"]["name"], drop_qualifiers=True))
        if not keys:
            continue
        for e, grams in by_date.get(d, ()):
            if keys & grams:
                out[i] = e["id"]
                break
    return out


class Dict:
    """Dictionary encoder: value -> index, in first-seen order."""
    def __init__(self):
        self.vals, self.idx = [], {}

    def __call__(self, v):
        if v not in self.idx:
            self.idx[v] = len(self.vals)
            self.vals.append(v)
        return self.idx[v]


def build_acled(proj, path=None):
    p = path or STRIKES_DIR + "acled-agg.json"
    if not os.path.exists(p):
        return None
    try:
        with open(p, encoding="utf-8") as fh:
            a = json.load(fh)
    except (ValueError, OSError):
        return None
    cells = a.get("cells") or []
    if not cells:
        return None
    types, places, pidx, rows = Dict(), [], {}, []
    for c in cells:
        if c.get("lat") is None or c.get("lon") is None:
            continue
        key = (c.get("location") or "", c.get("admin2") or "", round(c["lat"], 3), round(c["lon"], 3))
        if key not in pidx:
            pidx[key] = len(places)
            x, y = proj(c["lon"], c["lat"])
            places.append([key[0], key[1], x, y])
        rows.append([pidx[key], c["month"], types(c.get("sub_event_type") or c.get("event_type") or ""), c.get("count") or 0, c.get("fatalities") or 0])
    return {"attribution": a.get("attribution") or "ACLED (Armed Conflict Location & Event Data), acleddata.com", "accessed": a.get("accessed"),
            "from": a.get("from"), "to": a.get("to"), "types": types.vals, "places": places, "rows": rows}


def write_unresolved(unres, path=UNRESOLVED_TSV):
    """unres: {(place, district, war, reason): [count, cands-string, first-source]}"""
    lines = ["place\tdistrict\twar\treason\tcount\tcandidates\tsource"]
    for (pl, di, war, why), (n, cands, src) in sorted(unres.items(), key=lambda kv: (-kv[1][0], kv[0])):
        lines.append("\t".join([pl, di or "", war, why, str(n), cands, src]))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def build(events=None, rows=None, write=True, index=None):
    """Geocode everything and return {"strikes", "geo", "acled", "stats"} ready for the page's data blob."""
    ix = index or G.load()
    geo, proj = load_geo()
    rows = load_rows() if rows is None else rows
    rows = sorted(rows, key=lambda r: (date_key(r["date"]), r.get("place") or ""))
    cache = {}
    geos = []
    ovr = load_overrides()
    for r in rows:
        key = (r.get("place"), json.dumps(r.get("place_alt") or [], ensure_ascii=False), r.get("district"))
        if key not in cache:
            cache[key] = geocode(r, ix, ovr)
        geos.append(cache[key])
    evl = link_events(list(zip(rows, geos)), events)
    D = {n: Dict() for n in ("war", "kind", "place", "actor", "src", "area", "pn")}
    for w in WARS:
        D["war"](w)
    for k in KINDS:
        D["kind"](k)
    places, pidx, places_ar = [], {}, []
    out, unres = [], {}
    stats = {"by_war": defaultdict(lambda: Counter())}
    evl_out = {}
    for r, g in zip(rows, geos):
        war = r.get("war") if r.get("war") in WARS else "other"
        st = stats["by_war"][war]
        st["rows"] += 1
        if g["status"] == "unresolved":
            st["unresolved"] += 1
            cs = "; ".join(f'{c["place"]["name"]} ({c["place"].get("adm2") or c["place"].get("adm1")}, {c["score"]:.2f})' for c in g.get("cands", [])[:4])
            k = (r.get("place") or "", r.get("district") or "", war, g["reason"])
            u = unres.setdefault(k, [0, cs, r.get("source") or ""])
            u[0] += 1
            continue
        kl, kt = parse_killed(r.get("killed"))
        _, it = parse_killed(r.get("injured"))
        inj = it or ("" if r.get("injured") in (None, "") else str(r.get("injured")))
        kind = r.get("kind") if r.get("kind") in KINDS else "other"
        pl, ar = -1, -1
        q = 2 if g.get("how") in ("theatre", "city-district-mismatch") else (3 if g.get("how") == "fuzzy" else 0)
        if q == 2:
            st["inferred"] += 1
        if g.get("how") == "override":
            st["override"] += 1
        if g["status"] == "point":
            rec = g["place"]
            pk = (rec["name"], rec["lat"], rec["lon"])
            if pk not in pidx:
                x, y = proj(rec["lon"], rec["lat"])
                approx = 1 if rec["src"] == "OCHA-COD-AB-adm3" else 0
                pidx[pk] = len(places)
                places.append([rec["name"], x, y, rec.get("adm2") or rec.get("adm1") or "", approx])
                places_ar.append(rec.get("name_ar") or "")
            pl = pidx[pk]
            st["mapped"] += 1
        else:
            ar = D["area"](g["place"]["name"])
            st["area"] += 1
        pn = clean_place(r.get("place"))
        pn_i = -1 if (pl >= 0 and G.normalize(pn) == G.normalize(places[pl][0])) else D["pn"](r.get("place") or "")
        ti = (r.get("title") or "")
        ti = ti if len(ti) <= TITLE_MAX else ti[:TITLE_MAX - 1].rstrip() + "…"
        if kl > 0:
            st["killed"] += kl
        out.append([str(r["date"]),
                    "" if not r.get("date_end") else str(r["date_end"]),
                    pl, pn_i, D["war"](war), D["kind"](kind), kl, kt, inj, D["actor"](r.get("actor") or ""),
                    (r.get("target") or "")[:90], ti, D["src"](r.get("source") or ""), CONF.index(r.get("confidence")) if r.get("confidence") in CONF else 1,
                    int(r.get("count") or 1), ar, q])
    # timeline links are keyed by sorted-input order; rebuild keyed by output order (unresolved rows are not emitted)
    ridx_of = {}
    j = 0
    for i, g in enumerate(geos):
        if g["status"] != "unresolved":
            ridx_of[i] = j
            j += 1
    for i, eid in evl.items():
        if i in ridx_of:
            evl_out[str(ridx_of[i])] = eid
    blob = {"cols": COLS, "dict": {k: v.vals for k, v in D.items()}, "places": places, "places_ar": places_ar, "rows": out, "evl": evl_out,
            "unres": {w: c["unresolved"] for w, c in stats["by_war"].items() if c["unresolved"]}}
    blob["left_out"] = len(LEFT_OUT)
    if write:
        write_unresolved(unres)
        with open(os.path.join(STRIKES_DIR, "_left_out.tsv"), "w", encoding="utf-8") as fh:
            fh.write("key\twhy\tdate\tplace\tsource\n")
            fh.writelines("\t".join(str(x or "") for x in t) + "\n" for t in LEFT_OUT)
    summary = {w: dict(c) for w, c in sorted(stats["by_war"].items())}
    return {"strikes": blob, "geo": geo, "acled": build_acled(proj),
            "stats": {"by_war": summary, "mapped": sum(c["mapped"] for c in stats["by_war"].values()),
                      "area": sum(c["area"] for c in stats["by_war"].values()),
                      "unresolved": sum(c["unresolved"] for c in stats["by_war"].values()), "rows": len(rows), "places": len(places),
                      "inferred": sum(c["inferred"] for c in stats["by_war"].values()), "override": sum(c["override"] for c in stats["by_war"].values()), "events_linked": len(evl_out), "unresolved_groups": len(unres)}}


if __name__ == "__main__":
    S = build(events=[])
    print(json.dumps(S["stats"], indent=1))
    print("strikes blob bytes", len(json.dumps(S["strikes"], ensure_ascii=False, separators=(",", ":"))), "geo bytes", len(json.dumps(S["geo"], separators=(",", ":"))))
