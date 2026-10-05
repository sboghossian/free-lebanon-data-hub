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


ATT_SRC = "https://data.humdata.org/dataset/aid-security-risk-in-lebanon"
ATT_ADM1 = {"Beirut Governorate": "LB1", "Beqaa Governorate": "LB2", "Mount Lebanon Governorate": "LB3", "Nabatieh Governorate": "LB4", "North Governorate": "LB5", "South Governorate": "LB6", "Akkar Governorate": "LB7", "Baalbek-Hermel Governorate": "LB8"}   # to the pcodes of strikes/geo.json adm1
ATT_CATS = ["health_care", "education", "aid_worker", "water"]


def attacks(ctx):
    """The separate layer 'Attacks on health care, schools and aid' (Insecurity Insight via HDX, CC BY-SA 4.0): data/strikes/attacks.json (dictionary-encoded rows, loaded only when the layer is switched on) and csv/attacks.csv.
    These rows never enter strikes.json, so no strike count, total or CSV can include them. Returns the row count, or 0 when the research file is missing."""
    p = ctx.hub_research + "attacks/insecurity-insight.jsonl"
    if not os.path.exists(p):
        return 0
    src = [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    seen = {}
    def norm(v):
        return re.sub(r"\s+", " ", v.replace("IDP Refugee Camp", "IDP/Refugee Camp")).strip()
    for r in src:
        for f in ("perpetrator", "weapon", "location"):
            for x in ((r.get(f) or "").split(", ") if f == "perpetrator" else [r.get(f) or ""]):
                if x.strip():
                    seen.setdefault(norm(x).lower(), {}).setdefault(norm(x), 0)
                    seen[norm(x).lower()][norm(x)] += 1
    canon = {k: max(v, key=v.get) for k, v in seen.items()}      # one spelling per value that differs only by case or the slash ("No information", "IDP/Refugee Camp"): the most common one
    def cn(v):
        return canon[norm(v).lower()]
    D = {k: [] for k in ("gov", "perp", "weapon", "loc", "vg")}
    def ix(k, v):
        if v not in D[k]:
            D[k].append(v)
        return D[k].index(v)
    unknown = [r["category"] for r in src if r["category"] not in ATT_CATS]
    if unknown:
        ctx.warn(f"attacks: unknown categories {sorted(set(unknown))}")
    withc = sum(1 for r in src if r.get("lat") is not None and r.get("lon") is not None)
    if withc:
        ctx.warn(f"attacks: {withc} rows now have coordinates; the layer only shades governorates, add point drawing in tl_map.js")
    rows = []
    for r in sorted(src, key=lambda r: (r["date"], r["event_id"]), reverse=True):
        pp = [ix("perp", cn(x)) for x in (r.get("perpetrator") or "").split(", ") if x.strip()]
        rows.append([r["date"], ATT_CATS.index(r["category"]) if r["category"] in ATT_CATS else -1, ix("gov", r["admin1"]) if r.get("admin1") else -1, pp,
                     ix("weapon", cn(r["weapon"])) if r.get("weapon") else -1, ix("loc", cn(r["location"])) if r.get("location") else -1, ix("vg", r["victim_group"]) if r.get("victim_group") else -1,
                     r.get("killed"), r.get("injured"), r.get("kidnapped"), r.get("arrested"), r["event_id"]])
    ids = {}
    for r in src:
        ids[r["event_id"]] = ids.get(r["event_id"], 0) + 1
    gov = [{"n": g, "p": ATT_ADM1.get(g)} for g in D["gov"]]
    obj = {"cols": ["d", "c", "g", "pp", "w", "l", "vg", "k", "i", "kd", "ar", "id"], "cats": ATT_CATS, "gov": gov, "perp": D["perp"], "weapon": D["weapon"], "loc": D["loc"], "vg": D["vg"], "rows": rows,
           "dup_events": sum(1 for n in ids.values() if n > 1), "with_coords": withc, "source": ATT_SRC, "license": "CC BY-SA 4.0",
           "credit": "Insecurity Insight, Aid Security Risk in Lebanon (Humanitarian Data Exchange), published 2026-09-28"}
    ctx.write_json("strikes/attacks.json", obj, f"Attacks on health care, schools and aid in Lebanon: {len(rows):,} rows (Insecurity Insight), separate from the strike map counts", ATT_SRC, "CC BY-SA 4.0", rows=len(rows))
    ctx.write_csv("csv/attacks.csv", ["date", "category", "governorate", "district", "latitude", "longitude", "geo_precision", "perpetrator_type", "perpetrator", "weapon", "location", "facility", "victim_group", "killed", "injured", "kidnapped", "arrested", "event_id", "source_url", "license"],
                  [[r["date"], r["category"], r.get("admin1") or "", r.get("admin2") or "", "" if r.get("lat") is None else r["lat"], "" if r.get("lon") is None else r["lon"], r.get("geo_precision") or "", r.get("perpetrator_type") or "",
                    r.get("perpetrator") or "", r.get("weapon") or "", r.get("location") or "", r.get("facility") or "", r.get("victim_group") or "", r.get("killed"), r.get("injured"), r.get("kidnapped"), r.get("arrested"), r["event_id"], ATT_SRC, "CC BY-SA 4.0"] for r in src],
                  f"Attacks on health care, schools and aid in Lebanon: {len(src):,} rows, no coordinates (Insecurity Insight; not a complete or representative list, not independently verified, per the publisher)", ATT_SRC, "CC BY-SA 4.0")
    return len(rows)


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
    na = attacks(ctx)
    if na:
        out["inline"]["attacks"] = na
    ctx.write_csv("csv/strikes.csv", ["date", "date_end", "war", "kind", "place", "district", "latitude", "longitude", "killed", "injured", "actor", "target", "title", "source_url", "confidence"],
                  rows, f"Strikes: {len(rows):,} documented incidents with place-level coordinates", SRC)
    return out
