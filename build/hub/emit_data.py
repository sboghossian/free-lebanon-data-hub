"""Data tab: the one home of every dataset (v10). It writes the catalogue of public Lebanese datasets (research/portals/*-catalogue.jsonl), the portal series
(*-series.json), the laws index, data/series/index.json (every series the tabs publish, with a sparkline) and the search index data/search/<kind>.json.
The page filters everything by topic (one per tab, #data/<topic>) and lists every download from data/manifest.json."""
import glob, json, os, re, unicodedata
from email.utils import parsedate_to_datetime
from hub.lib import safe_name, sha12
from hub import i18n as hub_i18n
from hub.fb_common import jl

TAB = {"id": "data", "label": "Data", "order": 70}
PCOLS = ["portal", "title", "title_ar", "publisher", "topic", "years", "granularity", "format", "url", "license", "updated", "notes", "link_status", "link_checked", "file_modified"]

PANEL = '''<section class="hub-panel" id="data" role="tabpanel" aria-labelledby="t-data" hidden>
  <h2>Data</h2>
  <p class="lead">Every dataset, series and file behind the Hub, in one place. Search them all, or pick a topic to see the data behind one tab. Each item names its source and licence, and can be downloaded.</p>
  <div id="dxSearch" class="dx-search"></div>
  <div class="chips fb-nav dx-nav" id="dxNav" role="group" aria-label="Topics"></div>
  <div id="dxHead"></div>
  <h3 class="d-h" id="dxSerH">Series</h3>
  <p class="note">Each line is scaled to its own range, so compare shapes, not heights. A series in a topic CSV is one series_id in that file; its label, unit, source and licence are in series-dictionary.csv.</p>
  <div id="dxSer"></div>
  <div id="dxFilesSec" hidden><h3 class="d-h" id="dxFilesH">Files</h3><div id="dxFiles"></div></div>
  <div id="dxAll">
  <h3 class="d-h" id="catH">Catalogue of public datasets</h3>
  <p class="note">Public Lebanese datasets we found, with who publishes them, the years they cover, and a link. Nothing here is copied; each row points to the original.</p>
  <div id="dataRoot"></div>
  <h3 class="d-h" id="lawH">Laws of Lebanon</h3>
  <p class="note">An index of laws and legislative decrees, 1900 to 2026: number, date, title, subject and a link to the text. Only titles, numbers, dates and short English summaries are republished.</p>
  <details class="dl-det" id="lawDet"><summary>Search the laws index <span class="mono dim" id="lawN" data-notr></span></summary><div id="lawRoot"></div></details>
  <div id="dxPortal" hidden><div id="dSeriesRoot"></div></div>
  <h3 class="d-h" id="dlH">Downloads</h3>
  <p class="note">Every file the Hub publishes, as CSV or JSON. The Hub's data is CC BY-SA 4.0 unless a source says otherwise; the licence column shows each file's terms.</p>
  <p class="note">The series and world topic CSVs hold only keys and values. Join them on series_id or indicator_id with series-dictionary.csv or world-dictionary.csv (label, unit, source, licence), and on iso3 with countries.csv.</p>
  <div id="dlRoot"></div>
  </div>
</section>'''


def fresh_state(f):
    """research/portals/freshness.json row -> reachable, moved or unreachable."""
    st, http = f.get("status"), f.get("http")
    if st == "ok" and isinstance(http, int) and 200 <= http < 300:
        return "reachable"
    if st == "moved" or (isinstance(http, int) and 300 <= http < 400):
        return "moved"
    return "unreachable"


def _modified(v):
    """The Last-Modified header of a file, as YYYY-MM-DD ('' when absent or unreadable)."""
    try:
        return parsedate_to_datetime(v).strftime("%Y-%m-%d") if v else ""
    except (TypeError, ValueError):
        return ""


def load_portals(PORT):
    fresh = {}
    try:
        fresh = json.load(open(PORT + "freshness.json", encoding="utf-8"))
    except (OSError, ValueError):
        pass
    rows, seen = [], set()
    for p in sorted(glob.glob(PORT + "*-catalogue.jsonl")):
        slug = os.path.basename(p).split("-catalogue")[0]
        for line in open(p):
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if not isinstance(r, dict) or not r.get("title"):
                continue
            row = [str(r.get("portal") or slug)] + [("" if r.get(k) is None else str(r.get(k)))[:300] for k in PCOLS[1:12]]
            f = fresh.get(r.get("url") or "")
            row += [fresh_state(f), f.get("checked") or "", _modified(f.get("last_modified"))] if f else ["", "", ""]
            if (row[0], row[8], row[1]) in seen:
                continue
            seen.add((row[0], row[8], row[1]))
            rows.append(row)
    return rows


def load_pseries(PORT):
    out = []
    for p in sorted(glob.glob(PORT + "*-series.json")):
        slug = os.path.basename(p).split("-series")[0]
        try:
            ser = json.load(open(p)).get("series", [])
        except (ValueError, OSError):
            continue
        for s in ser:
            pts = [[str(pt[0]), round(float(pt[1]), 4)] for pt in s.get("points") or []
                   if len(pt) > 1 and re.match(r"\d{4}(-\d{2})?$", str(pt[0])) and isinstance(pt[1], (int, float)) and not isinstance(pt[1], bool)]
            ys = [int(m.group(0)) for pt in s.get("points") or [] for m in [re.match(r"\d{4}", str(pt[0]))] if m]
            out.append({"id": s.get("id"), "label": s.get("label") or s.get("id"), "unit": s.get("unit") or "", "portal": slug,
                        "url": s.get("source_url") or s.get("source") or "", "license": s.get("license") or "", "from": min(ys) if ys else None, "to": max(ys) if ys else None,
                        "n": len(s.get("points") or []), "notes": (s.get("notes") or "")[:200], "pts": sorted(pts)})
    return out


LAW_COLS = ["law_no", "date", "title_ar", "title_en", "topic", "type", "status", "gazette", "source", "summary_en", "fulltext"]
LAW_URL = "http://legallaw.ul.edu.lb/Law.aspx?lawId="
LAW_LICENSE = "No licence stated by the Legal Informatics Centre (Lebanese University) or the Parliament. Only titles, numbers, dates and short English summaries of public legislation are republished, with a link to the full text; no article text."


def _compact(url):
    """The Centre's links are stored as the lawId only (the page rebuilds them); other links stay whole."""
    return url[len(LAW_URL):] if url.startswith(LAW_URL) and url[len(LAW_URL):].isdigit() else url


def load_laws(hub):
    """Laws from D10-*.jsonl, with research/hub/laws/L-patches.jsonl applied (full-text link, English summary, a few status and number fixes) and L-new.jsonl added (2025 laws the Centre lacks)."""
    patches = {}
    for r in jl(hub + "laws/L-patches.jsonl"):
        if r.get("key") and isinstance(r.get("set"), dict):
            patches.setdefault(r["key"], {}).update(r["set"])
    recs = []
    for p in sorted(glob.glob(hub + "laws/D10-*.jsonl")):
        recs += jl(p)
    seen = {(r.get("date"), r.get("title_ar")) for r in recs}
    for r in jl(hub + "laws/L-new.jsonl"):
        if (r.get("date"), r.get("title_ar")) not in seen:
            recs.append(r)
    rows = []
    for r in recs:
        if not r.get("title_ar") and not r.get("title_en"):
            continue
        r = dict(r, **patches.get(r.get("source") or "", {}))
        src = r.get("source") or ""
        status = r.get("status")
        if r.get("law_no_confidence"):
            status = "number from press reports"
        elif status == "repealed" or (status or "").startswith("annulled by Constitutional Council"):
            pass
        elif status:
            status = "not yet numbered"
        full = r.get("fulltext_url") or ""
        rows.append([r.get("law_no"), r.get("date") or "", r.get("title_ar") or "", r.get("title_en") or "", r.get("topic") or "", r.get("type_en") or "", status or "", r.get("gazette") or "",
                     _compact(src), r.get("summary_en") or "", "" if full == src else _compact(full)])
    rows.sort(key=lambda x: (x[1], x[0] or 0), reverse=True)
    return rows


# ---------------------------------------------------------------- v10: the Data tab is the one home of every dataset
# Each published file and series gets a topic (one per tab); the page filters by it (#data/<topic>). The rules go to the page in D.tabs.data.rules,
# so files registered after this emitter (topic CSVs, dictionaries, translations) are sorted by the same rules. First match wins; no match = the Hub as a whole.
TOPICS = ["timeline", "map", "places", "cost", "electricity", "trade", "world", "mideast", "companies", "aid"]
FILE_TOPIC = [
    (r"^data/(csv/timeline\.csv|csv/series/timeline-bands)", "timeline"),
    (r"^data/(strikes/|csv/strikes\.csv|csv/attacks\.csv)", "map"),
    (r"^data/(places/|elections/|people/|war/|geo/lebanon\.json|csv/(places|districts|facilities|history-tables|elections-)|csv/series/(people|war-and-displacement))", "places"),
    (r"^data/(cost/|money/|csv/ipc\.csv|csv/series/(cost-of-living|public-money|food-prices))", "cost"),
    (r"^data/(electricity/|climate/|fires/|csv/fires\.csv|csv/series/(electricity|climate))", "electricity"),
    (r"^data/(trade/|csv/trade/|csv/series/(trade|investment)\.csv)", "trade"),
    (r"^data/(world/|csv/world/|csv/world-dictionary\.csv|csv/countries\.csv)", "world"),
    (r"^data/(mideast/|csv/mideast/)", "mideast"),
    (r"^data/(companies/|csv/companies-|csv/series/companies-)", "companies"),
    (r"^data/(aid/|csv/aid-)", "aid"),
]
# JSON files that are not series lists (or repeat other series): never opened when the series are gathered
NOT_SERIES = re.compile(r"^data/(places/p/|world/(indicators|flows|geo)/|world/lebanon-annual\.json|strikes/|i18n/|laws/|elections/|mideast/(geo|lebanon|ucdp)\.json|fires/|geo/|search/|series/)")
SPARK = 48          # at most this many points per sparkline
_AR = str.maketrans({"ٱ": "ا", "ى": "ي", "ة": "ه", **{chr(0x660 + i): str(i) for i in range(10)}, **{chr(0x6F0 + i): str(i) for i in range(10)}})
_MARKS = re.compile("[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]")


def file_topic(path):
    return next((tp for pat, tp in FILE_TOPIC if re.match(pat, path)), "")


def dx_norm(s):
    """Search form of a string, the same as dxNorm() in tab_data.js: no accents, no Arabic vowel marks or tatweel, one alef, ya for alef maqsura,
    ha for ta marbuta, Western digits, lower case, punctuation as spaces."""
    s = _MARKS.sub("", unicodedata.normalize("NFD", str(s or ""))).translate(_AR).lower()
    return re.sub(r"[\W_]+", " ", s).strip()


def dx_key(*parts, skip=()):
    """The distinct normalised words of parts, minus the words already in skip (the fields the page normalises itself)."""
    have = set(" ".join(dx_norm(x) for x in skip).split())
    out = []
    for p in parts:
        for w in dx_norm(p).split():
            if w not in have:
                have.add(w)
                out.append(w)
    return " ".join(out)


def _tx(s):
    """'YYYY', 'YYYY-MM', 'YYYY-MM-DD' or 'YYYY-Qn' as a decimal year (None if unreadable)."""
    m = re.match(r"(\d{4})(?:-Q([1-4])|-(\d{2})(?:-(\d{2}))?)?$", str(s).strip())
    if not m:
        return None
    y = int(m.group(1))
    if m.group(2):
        return y + (int(m.group(2)) - 1) / 4
    return y + (int(m.group(3) or 1) - 1) / 12 + (int(m.group(4) or 1) - 1) / 365.25


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def spark(points):
    """[[t, v], ...] -> (first t, last t, number of points, flat [x, y, x, y ...] with at most SPARK points, evenly picked, first and last kept)."""
    pts = sorted((x, p[1], str(p[0])) for p in points or [] if isinstance(p, (list, tuple)) and len(p) > 1 and _num(p[1]) for x in [_tx(p[0])] if x is not None)
    if not pts:
        return None, None, 0, []
    n = len(pts)
    pick = sorted({round(i * (n - 1) / (SPARK - 1)) for i in range(SPARK)}) if n > SPARK else range(n)
    flat = []
    for i in pick:
        x, v = pts[i][0], pts[i][1]
        flat += [round(x, 3), float(f"{v:.4g}") if v != int(v) or abs(v) >= 1e6 else int(v)]
    return pts[0][2], pts[-1][2], n, flat


def _load(ctx, rel):
    p = ctx.files.get("data/" + rel) or os.path.join(ctx.data_dir, rel)
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


class Tr:
    """English -> Arabic or French, from the UI tables (build/i18n/ui*.json) and the content translations (research/i18n/<lang>/part-*.jsonl)."""

    def __init__(self, ctx):
        self.ui = hub_i18n.load_ui(ctx.build_dir)
        self.content = {}
        for lg in ("ar", "fr"):
            m = self.content[lg] = {}
            for p in sorted(glob.glob(os.path.join(ctx.research, "i18n", lg, "part-*.jsonl"))):
                for r in jl(p):
                    if r.get("h") and isinstance(r.get("t"), str):
                        m[r["h"]] = r["t"]

    def __call__(self, en, lg):
        if not en:
            return ""
        return (self.ui.get(en) or {}).get(lg) or self.content[lg].get(sha12(en)) or ""


SER_COLS = ["key", "id", "label", "unit", "topic", "file", "csv_id", "source_url", "license", "t0", "t1", "n", "flags", "spark", "label_ar", "label_fr"]


def gather_series(ctx, tr):
    """Every series the Hub publishes, one row each (SER_COLS): the "series" lists of the data files written so far, the core timeline bands,
    and the World and Middle East indicators (their sparkline is Lebanon's line). file is the download that holds the series (a topic CSV, filtered on csv_id, or the JSON)."""
    csv_of = {sid: pt["rel"] for parts in ctx.series_long.groups.values() for pt in parts for sid in pt["ids"]}
    rows, keys = [], set()

    def add(sid, label, unit, topic, file, csv_id, src, lic, points, flags="", ar="", fr=""):
        t0, t1, n, flat = spark(points)
        key, k = str(sid), 2
        while key in keys:
            key, k = f"{sid}~{k}", k + 1
        keys.add(key)
        rows.append([key, str(sid), label or str(sid), unit or "", topic, file or "", csv_id or "", src or "", lic or "", t0, t1, n, flags, flat,
                     ar or tr(label, "ar"), fr or tr(label, "fr")])

    for f in list(ctx.manifest):
        p = f["path"]
        if not p.endswith(".json") or NOT_SERIES.match(p):
            continue
        o = _load(ctx, p[5:])
        ser = o.get("series") if isinstance(o, dict) else None
        if not isinstance(ser, list):
            continue
        portal = p == "data/portals/series.json"
        for s in ser:
            if not isinstance(s, dict) or not (s.get("id") or s.get("label")):
                continue
            sid = safe_name(f"{s.get('portal')}-{s.get('id')}") if portal else (s.get("csv_id") or s.get("id"))
            # a series JSON that does not carry its CSV path (the key is absent, not null) is found in the topic CSVs by its id
            csv = csv_of.get(sid) if portal else s["csv"] if "csv" in s else csv_of.get(safe_name(sid))
            sid = sid if portal or "csv" in s else safe_name(sid)
            flags = ",".join(x for x in ("proxy" if s.get("proxy") else "", "derived" if s.get("derived") else "", "low" if s.get("confidence") == "low" else "") if x)
            add(s.get("id") or s.get("label"), s.get("label"), s.get("unit"), file_topic(p), "data/" + csv if csv else p, sid if csv else "",
                s.get("source_url") or s.get("url") or s.get("source"), s.get("license"), s.get("points") or s.get("pts"), flags)
    for s in ctx.d.get("series") or []:                      # core timeline bands (embedded in the page; the download is the topic CSV)
        sid = safe_name("core-" + str(s["id"]))
        add(s["id"], s.get("label"), s.get("unit"), "timeline", "data/" + csv_of[sid] if sid in csv_of else "", sid if sid in csv_of else "",
            s.get("source"), s.get("license"), s.get("points"))
    wi = _load(ctx, "world/index.json")
    for m in wi.get("indicators") or []:                     # World: one row per indicator, Lebanon's values for the sparkline
        f = _load(ctx, (m.get("f") or "")[5:])
        lbn = (f.get("values") or {}).get("LBN") or []
        pts = [[str(y), v] for y, v in zip(f.get("years") or [], lbn) if _num(v)]
        add(m["id"], m.get("label"), m.get("unit"), "world", m.get("csv") or m.get("f"), m["id"] if m.get("csv") else "", m.get("url"), m.get("lic"), pts, "lbn", m.get("label_ar"), m.get("label_fr"))
    mi = _load(ctx, "mideast/index.json")
    if mi.get("indicators"):
        val = {**_load(ctx, "mideast/indicators.json"), **_load(ctx, "mideast/indicators-imf.json")}
        for m in mi["indicators"]:
            d = val.get(m["id"]) or {}
            pts = [[str(y), v] for y, v in zip(d.get("years") or [], (d.get("values") or {}).get("LBN") or []) if _num(v)]
            file = "data/mideast/indicators-imf.json" if m.get("imf") else "data/mideast/indicators.json"
            add(m["id"], m.get("label"), m.get("unit"), "mideast", file, "", m.get("url"), m.get("lic"), pts, "lbn", m.get("label_ar"), m.get("label_fr"))
    return rows


SEARCH_COLS = ["id", "en", "ar", "date", "meta", "key"]   # key: normalised words not already in en, ar or meta (Arabic and French names, alternative spellings, numbers)
SEARCH_LIC = "CC BY-SA 4.0 for the index; it holds titles, names, numbers and dates only, and each item keeps its own source and licence"


def search_rows(ctx, tr, portals, laws):
    """The search index, one list per kind: rows [id, en, ar, date, meta, key]. The page links each kind to its tab (see tab_data_search.js)."""
    S = {}
    S["catalogue"] = [[r[8], r[1], r[2], r[5], r[3], dx_key(r[0], r[4], skip=(r[1], r[2], r[3]))] for r in portals if r[8]]
    S["laws"] = []
    for r in laws:
        no, date = r[0], r[1] or ""
        lid = f"{no}/{date[:4]}" if no is not None and date[:4].isdigit() else ""
        S["laws"].append([lid, r[3], r[2], date, r[5], dx_key(lid, f"{no} {date[:4]}" if lid else "", skip=(r[3], r[2], r[5]))])
    pl = _load(ctx, "places/index.json")
    if pl.get("rows"):
        C = {c: i for i, c in enumerate(pl["cols"])}
        cz = pl.get("cazas") or []
        S["places"] = []
        for r in pl["rows"]:
            caza = cz[r[C["caza"]]]["n"] if isinstance(r[C["caza"]], int) and r[C["caza"]] < len(cz) else ""
            alts = (r[C["alts"]] or "").replace("|", " ") if "alts" in C else ""
            S["places"].append([r[C["id"]], r[C["name"]], r[C["name_ar"]] or "", "", caza, dx_key(alts, tr(r[C["name"]], "fr"), tr(caza, "ar"), skip=(r[C["name"]], r[C["name_ar"]], caza))])
    S["events"] = [[e["id"], e["title"], "", str(e.get("date") or ""), "", dx_key(tr(e["title"], "ar"), tr(e["title"], "fr"), skip=(e["title"],))] for e in ctx.d.get("events") or []]
    org = []
    L = _load(ctx, "companies/listed.json").get("securities") or []
    org += [["companies/listed", s.get("name"), "", "", s.get("sector") or "", dx_key(s.get("ticker"), s.get("issuer"), skip=(s.get("name"), s.get("sector")))] for s in L if s.get("name")]
    A = _load(ctx, "companies/abroad.json").get("companies") or []
    org += [["companies/abroad", c.get("name"), "", "", c.get("sector") or "", dx_key(c.get("ticker"), c.get("exchange"), skip=(c.get("name"), c.get("sector")))] for c in A if c.get("name")]
    ST = _load(ctx, "companies/startups.json").get("startups") or []
    org += [["companies/startups", c.get("name"), "", str(c.get("founded") or ""), c.get("sector") or "", ""] for c in ST if c.get("name")]
    FA = {r.get("group"): r for r in _load(ctx, "companies/family.json").get("rows") or [] if r.get("group")}
    org += [["companies/family", g, "", "", r.get("sector") or "", ""] for g, r in sorted(FA.items())]
    BK = _load(ctx, "companies/banks.json").get("per_bank") or []
    org += [["companies/banks", b.get("bank"), "", "", "Banks", dx_key(b.get("ticker"), skip=(b.get("bank"),))] for b in BK if b.get("bank")]
    DI, byco = _load(ctx, "companies/diaspora.json").get("rows") or [], {}
    for r in DI:                                   # v11 Lebanese abroad: one result per company; its people's names are searchable too
        if r.get("c"):
            e = byco.setdefault(r["c"], {"s": r.get("s") or "", "p": []})
            e["p"].append(r.get("p") or "")
    org += [["companies/abroad", c, "", "", e["s"], dx_key(*e["p"], skip=(c,))] for c, e in sorted(byco.items())]
    P = _load(ctx, "aid/presence.json")
    types = P.get("types") or []
    org += [["aid/where", o[1] or o[0], "", "", types[o[2]] if isinstance(o[2], int) and 0 <= o[2] < len(types) else "", dx_key(o[0], skip=(o[1],))] for o in P.get("orgs") or [] if o and (o[0] or o[1])]
    DN = _load(ctx, "aid/donors.json")
    seen = {dx_norm(o[1]) for o in org}
    for d in (DN.get("fts") or {}).get("donors") or []:
        if d and d[0] and dx_norm(d[0]) not in seen:
            seen.add(dx_norm(d[0]))
            org.append(["aid/donors", d[0], "", "", d[1] if len(d) > 1 else "", ""])
    for d in (DN.get("oecd") or {}).get("donors") or []:
        if isinstance(d, dict) and d.get("n") and d.get("k") != "aggregate" and dx_norm(d["n"]) not in seen:
            seen.add(dx_norm(d["n"]))
            org.append(["aid/donors", d["n"], "", "", "OECD DAC donor", dx_key(d.get("c"), skip=(d["n"],))])
    S["orgs"] = org
    return {k: v for k, v in S.items() if v}


def emit_centre(ctx, out, portals, laws):
    """Writes data/series/index.json (every series) and data/search/<kind>.json (the search index); puts the topic rules and the shard list in the page."""
    tr = Tr(ctx)
    ser = gather_series(ctx, tr)
    ctx.write_json("series/index.json", {"cols": SER_COLS, "rows": ser}, f"Every series the Hub publishes ({len(ser):,}): label, unit, span, source, licence, sparkline points and the file to download",
                   "Compiled by the Hub from the sources named on each row", "CC BY-SA 4.0 for the index; each series keeps its own licence (license column)", rows=len(ser))
    shards = {}
    for kind, rows in search_rows(ctx, tr, portals, laws).items():
        rel = f"search/{kind}.json"
        ctx.write_json(rel, {"kind": kind, "cols": SEARCH_COLS, "rows": rows}, f"Search index: {kind}, {len(rows):,} items (titles, names and dates)", "Compiled by the Hub from its own data files", SEARCH_LIC, rows=len(rows))
        shards[kind] = len(rows)
    out["inline"].update({"rules": [[p, tp] for p, tp in FILE_TOPIC], "topics": TOPICS, "series": len(ser), "search": shards})


def emit(ctx):
    PORT = ctx.research + "portals/"
    portals, pseries = load_portals(PORT), load_pseries(PORT)
    out = {"panel": PANEL, "counts": {"datasets": len(portals)}, "inline": {"portals": len(portals), "pseries": len(pseries)}}
    checked = sorted({r[13] for r in portals if r[13]})
    if checked:
        out["inline"]["fresh"] = {"checked": checked[-1], **{k: sum(1 for r in portals if r[12] == k) for k in ("reachable", "moved", "unreachable")}}
    ctx.write_json("portals/catalogue.json", {"cols": PCOLS, "rows": portals}, f"Catalogue of {len(portals):,} public Lebanese datasets (title, publisher, years, link, licence)",
                   "Open Data Lebanon, Central Administration of Statistics, CIB IMPACT; each row links to its original; link status checked by the Hub", "CC BY-SA 4.0 for the catalogue; each linked dataset keeps its own licence", rows=len(portals))
    # series: the card list needs only the series; the sparkline points live in the same file (one fetch)
    ctx.write_json("portals/series.json", {"series": pseries}, f"Long-run series from the portals ({len(pseries)} series)", "Open Data Lebanon, Central Administration of Statistics", rows=len(pseries))
    cat_csv = [[r[i] for i in range(len(PCOLS))] for r in portals]
    ctx.write_csv("csv/catalogue.csv", PCOLS, cat_csv, f"Dataset catalogue: {len(portals):,} public Lebanese datasets", "Open Data Lebanon, Central Administration of Statistics, CIB IMPACT",
                  "CC BY-SA 4.0 for the catalogue; each linked dataset keeps its own licence")
    for s in pseries:
        ctx.add_series("open-data-portals", safe_name(f"{s['portal']}-{s['id']}"), s["label"], s["unit"], "", s["url"], s["license"] or None, s["pts"])
    laws = load_laws(ctx.hub_research)
    if laws:
        yrs = sorted(r[1][:4] for r in laws if r[1][:4].isdigit())
        ctx.write_json("laws/index.json", {"cols": LAW_COLS, "url": LAW_URL, "rows": laws}, f"Laws of Lebanon: {len(laws):,} laws and legislative decrees, {yrs[0]} to {yrs[-1]} (titles, numbers, dates)",
                       "Legal Informatics Centre, Lebanese University (legallaw.ul.edu.lb); Lebanese Parliament (lp.gov.lb) for 2026", LAW_LICENSE, rows=len(laws))
        ctx.write_csv("csv/laws.csv", LAW_COLS[:8] + ["source_url", "summary_en", "fulltext_url"], [r[:8] + [LAW_URL + r[8] if r[8].isdigit() else r[8], r[9], (LAW_URL + r[10] if r[10].isdigit() else r[10]) or (LAW_URL + r[8] if r[8].isdigit() else r[8])] for r in laws],
                      f"Laws of Lebanon: {len(laws):,} laws and legislative decrees (titles, numbers, dates, English summaries)", "Legal Informatics Centre, Lebanese University (legallaw.ul.edu.lb); Lebanese Parliament (lp.gov.lb) for 2026", LAW_LICENSE)
        out["inline"]["laws"] = len(laws)
        out["counts"]["laws"] = len(laws)
    emit_centre(ctx, out, portals, laws)
    return out
