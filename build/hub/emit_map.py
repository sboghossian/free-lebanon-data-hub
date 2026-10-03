"""Strike map tab. The strike blob, the pre-projected boundaries and the optional ACLED layer are lazy files; the strike list is also a CSV."""
import json, os, re
from hub.lib import stub_panel

TAB = {"id": "map", "label": "Strike map", "order": 20}
SRC = "Wikipedia timelines, OCHA, UCDP, Airwars, ICTJ and press reports; each row links to its own source"

PANEL = '''<section class="hub-panel" id="map" role="tabpanel" aria-labelledby="t-map" hidden>
  <h2>Strike map</h2>
  <p class="lead">Where bombs fell in Lebanon in its major wars: the civil war, 2006, and 2023 to 2026.</p>
  <div id="mapRoot"><p class="hub-empty">No strike data is in this build. When it is, the map plots every incident we can document, with a source for each, and says per war what is complete and what is not.</p></div>
</section>'''


# Official tolls per war (research/hub/series/T-war-totals.json). wars = the strike-map war ids a toll covers; from/to bound the incidents counted next to it
# (needed where one id holds two tolls: 2023 to 2026). caveat = a short plain-language reading of the research note, written for this panel.
# kb = None when low and high count the same quantity (shown as a range, or one figure when they are equal); otherwise (low label, high label) and the panel shows the two figures separately, each with what it counts.
TOLL_MAP = [
    ("Civil war 1975-1990", "civil", ["civil_war"], "1975-01-01", "1990-12-31", "Estimates only: no official census of deaths exists. Official Lebanese figures of 35,000 to 40,000 are cited as far lower.", None),
    ("1978 Litani", "7882", ["1978"], "1978-01-01", "1978-12-31", "Lebanese and Palestinians killed; Israeli deaths are not counted here. Displaced: 100,000 to 250,000.", None),
    ("1982 invasion", "7882", ["1982"], "1982-06-06", "1982-12-31", "The two figures count different things, so they are not a range. Both exclude Sabra and Shatila. Counts mix civilians and fighters.",
     ("civilians only (Gabriel's estimate)", "all deaths (Lebanese authorities)")),
    ("1982 siege of Beirut", "7882", ["1982"], "1982-06-14", "1982-08-31", "The two figures count different things, so they are not a range. Overlaps with the 1982 invasion count: do not add the two.",
     ("civilians (Gabriel's estimate)", "all deaths in Beirut (Lebanese sources)")),
    ("1993 Accountability", "9396", ["1993"], "1993-07-25", "1993-07-31", "Lebanese civilian deaths only, as two readings of one source (118 in its text, 140 in its summary box). Fighters' deaths are disputed, so there is no total.", None),
    ("1996 Grapes of Wrath", "9396", ["1996"], "1996-04-11", "1996-04-27", "The two figures count different things, so they are not a range.",
     ("civilians only (Human Rights Watch)", "all Lebanese killed (Bregman)")),
    ("2006 war", "2006", ["2006"], "2006-07-12", "2006-08-14", "The two figures count different things, so they are not a range. Government counts do not separate civilians from fighters.",
     ("identified dead (Human Rights Watch)", "all deaths (Lebanese Higher Relief Council)")),
    ("2023-24 war, to the 27 Nov 2024 ceasefire", "2326", ["2023_26"], "2023-10-08", "2024-11-27", "Fighters and civilians are counted together. Displaced is the IOM figure at its peak, 25 Nov 2024.", None),
    ("2023-24 war, final MoPH count", "2326", ["2023_26"], "2023-10-08", "2024-12-05", "The last cumulative figure in our series, including late reports after the ceasefire.", None),
    ("2026 war, at the ceasefire of 16 Apr 2026", "2326", ["2023_26"], "2026-03-02", "2026-04-17", "Cumulative since 2 Mar 2026, counted on 17 Apr, the day after the ceasefire. Displaced is the government's registered total at its peak, 17 Mar 2026.", None),
    ("2026 war, latest MoPH count", "2326", ["2023_26"], "2026-03-02", "2026-09-17", "Killed and injured are from different dates. Fighters and civilians are not separated.", None),
]
def tolls(ctx):
    """data/strikes/tolls.json from research/hub/series/T-war-totals.json; None when the research file is missing."""
    p = ctx.hub_research + "series/T-war-totals.json"
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding="utf-8"))
    out = []
    for r in d.get("totals", []):
        m = next((x for x in TOLL_MAP if r["war"].startswith(x[0])), None)
        if not m:
            ctx.warn.append(f"strike map: no toll mapping for {r['war']!r}")
            continue
        lo, hi = r.get("killed_low"), r.get("killed_high")
        parts = [{"n": lo, "what": m[6][0]}, {"n": hi, "what": m[6][1]}] if m[6] and lo is not None and hi is not None and lo != hi else None
        if not parts and m[6] is None and lo is not None and hi is not None and lo != hi and "killed_basis" in r and "civilians only" in r["killed_basis"]:
            ctx.warn.append(f"strike map: {r['war']!r} has a killed_basis that says the low and high differ; add a label pair in TOLL_MAP")
        out.append({"id": len(out), "war": r["war"], "group": m[1], "wars": m[2], "from": m[3], "to": m[4], "killed_low": None if parts else lo, "killed_high": None if parts else hi, "killed_parts": parts,
                    "injured": r.get("injured"), "displaced": r.get("displaced"), "displaced_low": r.get("displaced_low"), "as_of": r.get("as_of") or "", "counted_by": r.get("counted_by") or "",
                    "source": r.get("source") or "", "license": r.get("license") or "", "caveat": m[5]})
    return out


def emit(ctx):
    S = ctx.S
    sk, geo = S["strikes"], S["geo"]
    has = bool(sk and sk.get("rows"))
    out = {"panel": PANEL, "counts": {"incidents": S["stats"]["mapped"]}, "inline": {"has": has}}
    if not has:
        return out
    blob = dict(sk)
    if S.get("acled"):
        blob["acled"] = S["acled"]
    tl = tolls(ctx)
    if tl:
        ctx.write_json("strikes/tolls.json", {"tolls": tl}, f"Strike map: official toll per war ({len(tl)} counts, who counted and when)",
                       "Lebanese Ministry of Public Health, OCHA, WHO, Human Rights Watch and other counters named in each row; Wikipedia for the older wars", "Facts as published by each counter; Wikipedia text CC BY-SA 4.0", rows=len(tl))
        out["inline"]["tolls"] = len(tl)
    ctx.write_json("strikes/strikes.json", blob, f"Strike map: {S['stats']['rows']:,} documented incidents (dictionary-encoded rows)", SRC, kind="data", rows=len(sk["rows"]))
    ctx.write_json("strikes/geo.json", geo, "Strike map: Lebanon governorate and district outlines, pre-projected", "OCHA / HDX administrative boundaries (CC BY-IGO)", "CC BY-IGO", kind="data")
    # CSV: one row per documented incident, with the place-level position (about 90 m units turned back into degrees)
    C = {c: i for i, c in enumerate(sk["cols"])}
    DT, pl = sk["dict"], sk["places"]
    lon0, lat1, k, s = geo["lon0"], geo["lat1"], geo["k"], geo["s"]
    rows = []
    for r in sk["rows"]:
        p = pl[r[C["pl"]]] if r[C["pl"]] >= 0 else None
        lat = round(lat1 - p[2] / s, 5) if p else ""
        lon = round(lon0 + p[1] / (k * s), 5) if p else ""
        place = p[0] if p else (DT["area"][r[C["ar"]]] if r[C["ar"]] >= 0 else "")
        rows.append([r[C["t"]], r[C["te"]], DT["war"][r[C["w"]]], DT["kind"][r[C["k"]]], place, p[3] if p else "", lat, lon, r[C["kl"]], r[C["inj"]], DT["actor"][r[C["a"]]] if r[C["a"]] >= 0 else "",
                     r[C["tg"]], r[C["ti"]], DT["src"][r[C["u"]]], ["verified", "reported", "inference"][r[C["c"]]] if 0 <= r[C["c"]] < 3 else "reported"])
    ctx.write_csv("csv/strikes.csv", ["date", "date_end", "war", "kind", "place", "district", "latitude", "longitude", "killed", "injured", "actor", "target", "title", "source_url", "confidence"],
                  rows, f"Strikes: {len(rows):,} documented incidents with place-level coordinates", SRC)
    return out
