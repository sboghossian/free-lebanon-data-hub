"""Data tab: the catalogue of public Lebanese datasets (research/portals/*-catalogue.jsonl) and the long-run series (*-series.json).
Both are lazy files; every series is also a CSV, and the tab lists all downloads from data/manifest.json."""
import glob, json, os, re
from email.utils import parsedate_to_datetime
from hub.lib import safe_name
from hub.fb_common import jl

TAB = {"id": "data", "label": "Data", "order": 70}
PCOLS = ["portal", "title", "title_ar", "publisher", "topic", "years", "granularity", "format", "url", "license", "updated", "notes", "link_status", "link_checked", "file_modified"]

PANEL = '''<section class="hub-panel" id="data" role="tabpanel" aria-labelledby="t-data" hidden>
  <h2>Data</h2>
  <p class="lead">Public Lebanese datasets we found, with who publishes them, the years they cover, and a link. Nothing here is copied; each row points to the original.</p>
  <div id="dataRoot"></div>
  <h3 class="d-h" id="lawH">Laws of Lebanon</h3>
  <p class="note">An index of laws and legislative decrees, 1900 to 2026: number, date, title, subject and a link to the text. Only titles, numbers, dates and short English summaries are republished.</p>
  <details class="dl-det" id="lawDet"><summary>Search the laws index <span class="mono dim" id="lawN" data-notr></span></summary><div id="lawRoot"></div></details>
  <h3 class="d-h">Long-run series</h3>
  <p class="note">National series that run for years, taken from the portals. Each card shows the first and last value, the unit, the span and a link to the source. Lines are scaled to their own range.</p>
  <div id="dSeriesRoot"></div>
  <h3 class="d-h" id="dlH">Downloads</h3>
  <p class="note">Every file the Hub publishes, as CSV or JSON. The Hub's data is CC BY-SA 4.0 unless a source says otherwise; the licence column shows each file's terms.</p>
  <p class="note">The series and world topic CSVs hold only keys and values. Join them on series_id or indicator_id with series-dictionary.csv or world-dictionary.csv (label, unit, source, licence), and on iso3 with countries.csv.</p>
  <div id="dlRoot"></div>
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
    return out
