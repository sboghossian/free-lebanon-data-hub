"""v4 enrichment for the MITAI dossier: facets, Jev grounding, source tiers, offices, agreements,
people and price series, and the source library. Research files are read-only data."""
import ast, glob, json, os, re
import privacy
from collections import Counter
from urllib.parse import urlparse

ROOT = os.environ.get("HUB_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R = os.environ.get("LEBANON_RESEARCH", os.path.join(ROOT, "research") + "/")  # the env override is for fixture builds in tests
BUILD = os.path.join(ROOT, "build") + "/"


def jl(f):
    return [json.loads(l) for l in open(R + f) if l.strip()]


# ---------------------------------------------------------------- domain tiers (copied from jev_supervise.py by parsing, no import)
def _tier_tables():
    src = open(BUILD + "jev_supervise.py").read()
    tree = ast.parse(src)
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            n = node.targets[0].id
            if n in ("T1", "T2", "T3", "T4", "BLOCK", "DATA_PAGES"):
                out[n] = ast.literal_eval(node.value)
    return out


TT = _tier_tables()


def domain(url):
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def tier_of(url):
    d = domain(url)
    if not d:
        return None
    if any(b in d for b in TT["BLOCK"]):
        return "bl"
    for name in ("T1", "T2", "T4", "T3"):
        for t in TT[name]:
            if d == t or d.endswith("." + t) or (t.startswith(".") and d.endswith(t)):
                return name
    return None


def is_data_page(url):
    return any(d in (url or "") for d in TT["DATA_PAGES"])


# ---------------------------------------------------------------- graded library and grounding
GRADED = {r["url"]: r for r in jl("41-sources-graded.jsonl")}
DOMAIN_TIER = {}
for _r in GRADED.values():
    DOMAIN_TIER.setdefault(_r["domain"], Counter())[_r["tier"]] += 1
TIER_CODE = {"T1": "T1", "T2": "T2", "T3": "T3", "T4": "T4", "T3?": "T3?", "unmapped": "un", "blocked": "bl"}


def url_tier(u):
    """Tier of a source URL: the graded library first, then the domain map, then the library's
    Jev screen of the same domain. 'un' = unmapped (no tier known)."""
    if not u or not str(u).startswith("http"):
        return None
    g = GRADED.get(u)
    if g:
        return TIER_CODE.get(g["tier"], "un")
    t = tier_of(u)
    if t:
        return t
    c = DOMAIN_TIER.get(domain(u))
    if c:
        best = c.most_common(1)[0][0]
        return TIER_CODE.get(best, "un")
    return "un"


GROUND = {r["key"]: r for r in jl("40-grounding.jsonl")}
VCODE = {"grounded": "g", "weak": "w", "unsupported": "u", "unchecked": "x", "data_source": "d"}
LEVEL_RANK = {"strong": 5, "unrated": 4, "data": 3, "weak": 2, "unchk": 1, "unsup": 0}


def grounding(fullkey, url):
    """Jev verdict for a row, only if Jev read the same URL the page now shows."""
    g = GROUND.get(fullkey)
    if not g or (g.get("url") or None) != (url or None):
        return {"g": "x", "f": "none"}
    out = {"g": VCODE[g["verdict"]]}
    if g.get("same_event") is not None:
        out["s"] = round(g["same_event"], 2)
    if g["fetch"] != "ok":
        out["f"] = g["fetch"].replace("http_", "")
    if g.get("law_no_found") in ("yes", "no"):
        out["lf"] = g["law_no_found"]
    return out


def part_level(p):
    g, tr = p.get("g"), p.get("tr")
    if g == "g":
        return "strong" if tr in ("T1", "T2", "T3", "T4") else "unrated"
    return {"w": "weak", "u": "unsup", "d": "data"}.get(g, "unchk")


# ---------------------------------------------------------------- facets
FACETS = {r["key"]: r for r in jl("20-facets.jsonl")}
ALIAS = {"Rafik Hariri": "Rafic Hariri", "Banque du Liban": "BDL", "Central bank": "BDL", "Lebanese government": "Lebanese state",
         "Government": "Lebanese state", "Government of Lebanon": "Lebanese state", "Lebanese State": "Lebanese state",
         "Lebanese Army": "Lebanese Army", "Army": "Lebanese Army", "Lebanese Armed Forces": "Lebanese Army", "LAF": "Lebanese Army",
         "parliament": "Parliament", "Lebanese Parliament": "Parliament", "IDF": "Israel", "Israeli army": "Israel",
         "Fuad Siniora": "Fouad Siniora", "Emile Lahoud": "Émile Lahoud", "United Nations": "UN", "US": "United States",
         "USA": "United States", "Hizbullah": "Hezbollah", "Ministry of Public Health": "Health Ministry",
         "Public Health Ministry": "Health Ministry", "Bechara el-Khoury": "Bechara El Khoury"}
DROP_ACTOR = {"Lebanon", "Lebanese", "Lebanese people", ""}
ACTOR_HINT = {"United States": ["u.s.", " us ", "american", "washington"], "France": ["french"], "BDL": ["banque du liban", "central bank"],
              "Parliament": ["mps", "deputies", "parliamentary"], "Palestinians": ["palestinian"], "Saudi Arabia": ["saudi"],
              "UN": ["united nations", "un ", "unsc", "security council"], "Syria": ["syrian"], "Israel": ["israeli"],
              "Iran": ["iranian"], "PLO": ["palestine liberation"], "Lebanese state": ["government", "the state"],
              "Cabinet": ["cabinet", "government"], "Lebanese Army": ["army"], "EU": ["european union", "european"]}
# Optional private terms (see privacy.py): screened out of actors and source titles. Does nothing without a terms file.
BLOCK_NAMES = privacy.pattern() or re.compile(r"(?!)")


def norm_actor(a):
    a = (a or "").strip()
    a = ALIAS.get(a, a)
    if a in DROP_ACTOR or BLOCK_NAMES.search(a):
        return None
    return a


def facets_for(fullkey, row):
    """type, actors, place for a row. The row's own values win; Jev-tagged actors are kept only
    when the row's text names them (Jev tends to expand a surname into every holder of it)."""
    f = FACETS.get(fullkey, {})
    ty = row.get("type") or f.get("type") or "other"
    place = row.get("place") or f.get("place")
    actors = []
    if row.get("actors"):
        cand = [(a, True) for a in row["actors"]]
    else:
        cand = [(a, False) for a in f.get("actors", [])]
    txt = " " + (row.get("title", "") + " " + (row.get("why") or "")).lower() + " "
    jev = [a for a, own in cand if not own]
    for a, own in cand:
        n = norm_actor(a)
        if not n:
            continue
        if not own:
            ok = a.lower() in txt or n.lower() in txt or any(h in txt for h in ACTOR_HINT.get(n, []))
            if not ok and " " in a:
                sur = a.split()[-1].lower()
                same = [b for b in jev if b.split()[-1].lower() == sur and norm_actor(b) != n]
                ok = sur in txt and not same
            if not ok:
                continue
        if n not in actors:
            actors.append(n)
    return ty, actors, place, ("row" if row.get("type") else "jev")


# ---------------------------------------------------------------- offices
OFF_CODE = {"President": "P", "Prime Minister": "PM", "Cabinet": "C", "Speaker": "S", "BDL Governor": "G",
            "Army Commander": "A", "Finance Minister": "F", "Parliament": "L", "High Commissioner": "H"}
CONF = {"✅": "verified", "📣": "reported", "🧪": "inference"}


def jl_safe(f):
    """Rows of a research file that may be missing or half-written by a running agent: broken lines are skipped."""
    out = []
    try:
        for l in open(R + f):
            if l.strip():
                try:
                    out.append(json.loads(l))
                except ValueError:
                    pass
    except OSError:
        pass
    return out


def iso_start(d):
    d = str(d or "").strip()
    return d + ("-01-01" if len(d) == 4 else "-01" if len(d) == 7 else "") if re.match(r"^\d{4}(-\d{2}){0,2}$", d) else None


def iso_end(d):
    d = str(d or "").strip()
    return d + ("-12-31" if len(d) == 4 else "-28" if len(d) == 7 else "") if re.match(r"^\d{4}(-\d{2}){0,2}$", d) else None


def offices():
    """[code, name, start, end, acting, tag, source, note, grounding]. Codes are P, PM, ... for 1920 on; every row of
    research/v6/offices-1800-1920.jsonl (Emir, Qaimaqam, Mutasarrif, Governor ...) gets the code 'R:<office>' and is drawn on the Rulers strip."""
    out = []
    for i, r in enumerate(jl("30-offices.jsonl")):
        g = GROUND.get(f"30-offices.jsonl:{i}", {})
        out.append([OFF_CODE[r["office"]], r["name"], r["start"], r["end"], 1 if r.get("acting") else 0,
                    CONF[r["confidence"]], r.get("source"), (r.get("note") or "")[:160], VCODE.get(g.get("verdict"), "x")])
    for r in jl_safe("v6/offices-1800-1920.jsonl"):
        a, b = iso_start(r.get("start")), iso_end(r.get("end"))
        if not r.get("office") or not r.get("name") or not a:
            continue
        out.append(["R:" + str(r["office"]).strip(), str(r["name"]).strip(), a, b, 1 if r.get("acting") else 0,
                    CONF.get(r.get("confidence"), "inference"), r.get("source"), (r.get("note") or "")[:160], "x"])
    return out


# ---------------------------------------------------------------- series: people and prices
def _usd_from_note(note):
    m = re.search(r"USD\s*([\d,]+(?:\.\d+)?)", note or "")
    return float(m.group(1).replace(",", "")) if m else None


def people_life_series():
    out = []
    ppl = json.load(open(R + "33-people.series.json"))
    for s in ppl["series"]:
        pts = [[p[0], p[1], (p[2] if len(p) > 2 else "") or ""] for p in s["points"] if p[1] is not None]
        out.append({"id": "ppl_" + s["id"], "label": s["label"], "unit": s.get("unit"), "source": s.get("source"),
                    "confidence": CONF.get(s.get("confidence"), s.get("confidence")), "note": s.get("note"),
                    "origin": "33-people.series.json", "points": pts})
    life = json.load(open(R + "32-life-index.series.json"))
    by = {s["id"]: s for s in life["series"]}

    def mk(sid, label, unit, pts, base):
        return {"id": sid, "label": label, "unit": unit, "source": base.get("source"), "sources": base.get("sources", []),
                "note": base.get("note"), "origin": "32-life-index.series.json", "confidence": "mixed", "points": pts}
    bm = by["big_mac"]
    out.append(mk("px_bigmac_usd", "Big Mac, US$ (Economist index)", "USD", [[p[0], p[1], p[4]] for p in bm["points"] if p[2] == "USD"], bm))
    out.append(mk("px_bigmac_lbp", "Big Mac, LBP (Economist index)", "LBP", [[p[0], p[1], p[4]] for p in bm["points"] if p[2] == "LBP"], bm))
    br = by["bread_bundle"]
    out.append(mk("px_bread", "Bread bundle, LBP (official price)", "LBP", [[p[0], p[1], p[4]] for p in br["points"] if p[2] == "LBP"], br))
    pe = by["benzine_20l"]
    out.append(mk("px_petrol", "Petrol 95, 20 litres, LBP (ministry table)", "LBP", [[p[0], p[1], p[4]] for p in pe["points"] if p[2] == "LBP"], pe))
    mw = by["min_wage"]
    mpts = []
    for p in mw["points"]:
        d, v, unit, kind, note = p
        if unit == "USD":
            mpts.append([d, v, note])
            continue
        usd = _usd_from_note(note)
        if usd is not None:
            mpts.append([d, usd, f"{fmt_int(v)} LBP; {note}"])
        elif d < "2019-10":
            mpts.append([d, round(v / 1507.5), f"{fmt_int(v)} LBP converted at the 1,507.5 peg (calculation). {note}"])
    out.append(mk("px_minwage_usd", "Minimum wage, US$ a month", "USD", mpts, mw))
    return out, ppl.get("tables", [])


def fmt_int(v):
    try:
        return f"{int(v):,}"
    except Exception:
        return str(v)


# ---------------------------------------------------------------- agreements
AGR_KIND = {"un_resolution": "un_resolution", "ceasefire": "agreement"}
PILLAR_LANE = {"P": "pol", "E": "econ", "L": "law", "R": "region", "S": "soc"}
AGR_WEIGHT = {"accord": 2, "treaty": 2, "constitutional": 2, "ceasefire": 2, "border": 2, "maritime": 2}


def agreements():
    rows = jl("31-agreements.jsonl")
    for i, r in enumerate(rows):
        r["i"] = i
        r["fullkey"] = f"31-agreements.jsonl:{i}"
    return rows


# ---------------------------------------------------------------- source library
SRC_FILES = ["src-political.jsonl", "src-economic.jsonl", "src-social.jsonl", "src-tech.jsonl", "src-env-legal.jsonl",
             "src-agreements.jsonl", "src-offices.jsonl", "src-people.jsonl", "src-life.jsonl",
             "src-v5-mandate-1920-1949.jsonl", "src-v5-first-republic-1950-1974.jsonl", "src-v5-civil-war-1975-1990.jsonl",
             "src-v5-second-republic-1991-2022.jsonl", "src-v5-institutions-complete.jsonl", "src-v5-security-incidents.jsonl",
             "src-v5-culture-sport-media.jsonl", "src-v5-environment-health-infrastructure.jsonl", "src-v5-recency-2023-2026.jsonl"]
# every research/src-v6-*.jsonl joins by glob (files may be missing a trailing newline or be half-written: read with jl_safe)
SRC_FILES += sorted(os.path.basename(p) for p in glob.glob(R + "src-v6-*.jsonl"))
EXCLUDE_URL = re.compile(r"linkedin\.com/(in|posts)/|mitai-lebanon_the-ministry")
LANE_PILLAR = {"pol": "P", "econ": "E", "soc": "S", "tech": "T", "env": "En", "law": "L", "region": "R", "world": "W",
               "agree": "L", "life": "S", "work": None}


def library(events, extra_urls):
    """Every unique source: the graded library (41) plus every link cited by an event, an office row,
    an agreement or a data series. Rows are compact arrays; see LIB_COLS."""
    src = {}
    for f in SRC_FILES:
        for r in (jl_safe(f) if f.startswith("src-v6-") else jl(f)):
            if not r.get("url"):
                continue
            s = src.setdefault(r["url"], {"pillars": set(), "years": [], "read": False, "title": None, "publisher": None, "published": None})
            s["pillars"].update(r.get("pillars") or [])
            if r.get("years"):
                s["years"].append(str(r["years"]))
            s["read"] = s["read"] or bool(r.get("read"))
            s["title"] = s["title"] or r.get("title")
            s["publisher"] = s["publisher"] or r.get("publisher")
            s["published"] = s["published"] or r.get("published")
    cited = {}
    for e in events:
        for p in e["parts"]:
            u = p.get("u")
            if u:
                c = cited.setdefault(u, {"lanes": set(), "years": set(), "read": False, "fetch": None, "file": p["file"]})
                c["lanes"].update(e["lanes"])
                c["years"].add(int(e["t"]))
                c["read"] = c["read"] or p["c"] == "verified"
                c["fetch"] = c["fetch"] or p.get("f") or ("ok" if p.get("g") in ("g", "w", "u", "d") else None)
    for u, meta in extra_urls.items():
        c = cited.setdefault(u, {"lanes": set(), "years": set(), "read": False, "fetch": None, "file": meta.get("file")})
        c["read"] = c["read"] or meta.get("read", False)
        if meta.get("fetch"):
            c["fetch"] = c["fetch"] or meta["fetch"]
    rows = []
    urls = list(GRADED) + [u for u in cited if u not in GRADED]
    for u in urls:
        if not u or not str(u).startswith("http") or EXCLUDE_URL.search(u):
            continue
        g, s, c = GRADED.get(u), src.get(u, {}), cited.get(u)
        if g:
            tier = TIER_CODE.get(g["tier"], "un")
            alive = 1 if g["alive"] else 0
            mread = 1 if g["fetch"] == "ok" else 0
            keep = 1 if g["keep"] else 0
            why = g["why"]
            title, pub = g.get("title") or s.get("title"), g.get("publisher") or s.get("publisher")
        else:
            tier = url_tier(u) or "un"
            f = (c or {}).get("fetch")
            alive = 0 if f in ("404", "410", "error") else (None if f in (None, "none", "not_url", "timeout") else 1)
            mread = 1 if f == "ok" else 0
            keep = 0 if tier == "bl" or alive == 0 else 1
            why = "cited by the timeline"
            title, pub = None, None
        pillars = sorted(s.get("pillars", set()))
        years = ", ".join(sorted(set(s.get("years", []))))[:24]
        if c:
            if not pillars:
                pillars = sorted({LANE_PILLAR[l] for l in c["lanes"] if LANE_PILLAR.get(l)})
            if not years and c["years"]:
                a, b = min(c["years"]), max(c["years"])
                years = str(a) if a == b else f"{a}-{b}"
        aread = 1 if (s.get("read") or (c and c["read"])) else 0
        t = (title or "").strip()
        if BLOCK_NAMES.search(t) or BLOCK_NAMES.search(u):
            continue
        rows.append([u, t[:110], (pub or domain(u))[:40], tier, "".join(p if len(p) == 1 else "n" for p in pillars),
                     years, alive, mread, aread, keep, why])
    return rows


LIB_COLS = ["url", "title", "publisher", "tier", "pillars (P E S T n=Environment L R W)", "years", "alive", "machine-read",
            "agent-read", "kept", "graded by"]
