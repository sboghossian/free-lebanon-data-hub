"""Middle East tab (LEG B-mideast): Lebanon next to 16 neighbours and regional partners.
Reads research/hub/mideast/ (countries, FDI positions, migrant stock, Syrian refugees in five hosts, UCDP events in Lebanon), research/85-regional-shocks.timeline.jsonl,
and the World tab's indicators (research/hub/world/, through the loaders of emit_world, which this file imports and never edits). Writes lazy files under data/mideast/:
  index.json            countries (names en/ar/fr), indicator list (label, unit, source, licence, estimate rule), entity names for every partner code, region presets
  indicators.json       the open indicators (World Bank, ILO, UNESCO, UN, OWID, V-Dem ...) for the 17 economies: years + one value array per ISO3
  indicators-imf.json   the IMF WEO ones, kept apart because the IMF terms are not an open licence (shown with attribution, no CSV)
  refugees.json, migrants.json, remittances.json, fdi.json, ucdp.json, shocks.json, lebanon.json (province outlines), geo.json (Natural Earth outlines for the region map)
  csv/mideast/*.csv     downloads for the open datasets (UCDP, UNHCR, UN DESA, KNOMAD, the shocks list). IMF data are not offered as CSV.
The tab shows one link, "Data behind this tab" (#data/mideast); no tables are printed on the tab itself."""
import glob, json, os
from hub import emit_world as W
from hub.lib import safe_name

TAB = {"id": "mideast", "label": "Middle East", "order": 66, "routes": []}   # #mideast/<view>/<arg>

PANEL = '''<section class="hub-panel" id="mideast" role="tabpanel" aria-labelledby="t-mideast" hidden>
  <h2>Middle East</h2>
  <p class="lead">Lebanon next to its neighbours and regional partners: indicators, migration, money, Syrian refugees, conflict events and dated regional shocks. Each chart names its source.</p>
  <div id="mideastRoot"><p class="hub-empty">No Middle East data is in this build yet. When it is, you can compare Lebanon with the region on indicators, ties, refugees and conflict events.</p></div>
  <p class="me-data"><a href="#data/mideast" data-hub="data" data-hash="data/mideast">Data behind this tab</a></p>
</section>'''

BBOX = (18, 8, 68, 46)          # Natural Earth countries that touch this box are drawn on the region map
OPEN_MIN_LBN = 2                # an indicator needs at least two Lebanese points and three economies with data to be charted
SHOCK_CONF = {"✅": "verified", "\U0001f4e3": "reported", "\U0001f9ea": "inference"}
NOTE_MAX = 700


def jload(p):
    return json.load(open(p, encoding="utf-8"))


def countries(hm):
    c = jload(hm + "countries.json")
    rows = [{"iso3": r["iso3"], "n": r["name"], "ar": r["name_ar"], "fr": r["name_fr"], "land": bool(r.get("land_neighbour_of_lebanon")), "gcc": bool(r.get("gcc_member"))} for r in c["rows"]]
    return c, rows


def indicators(ctx, hw, iso, ui, est_from):
    """Returns (meta list, open file, imf file). Values trimmed to the 17 economies and to the years that hold data for them."""
    meta, open_f, imf_f = [], {}, {}
    for p in sorted(glob.glob(hw + "indicators/*.json")):
        d = jload(p)
        vals = {k: [W.sig(x) for x in d["values"].get(k, [])] for k in iso if d["values"].get(k)}
        vals = {k: v for k, v in vals.items() if any(x is not None for x in v)}
        lb = vals.get("LBN") or []
        if sum(1 for x in lb if x is not None) < OPEN_MIN_LBN or len(vals) < 4:
            continue
        have = [i for i in range(len(d["years"])) if any(v[i] is not None for v in vals.values())]
        a, b = have[0], have[-1]
        ys = d["years"][a:b + 1]
        vals = {k: v[a:b + 1] for k, v in vals.items()}
        iid = d["id"]
        is_imf = iid.startswith("WEO.")
        tk = (d.get("topic") or "").strip().lower()
        ti, tlab = W.TOPIC_ID.get(tk, (99, (d.get("topic") or "Other").strip().capitalize()))
        m = {"id": iid, "label": d["label"], "unit": d["unit"], "topic": tlab, "to": ti, "src": d.get("source") or "", "url": d.get("source_url") or "", "lic": d.get("license") or "",
             "hi": d.get("higher_is") or "neutral", "y0": ys[0], "y1": ys[-1], "imf": is_imf, "n": len(vals)}
        note = (d.get("notes") or "").strip()
        if note:
            m["note"] = note if len(note) <= NOTE_MAX else note[:NOTE_MAX].rsplit(" ", 1)[0] + " ..."
        if "World Population Prospects" in m["src"]:
            m["wpp"] = W.WPP_LAST_ESTIMATE
        tr = ui.get(d["label"], {}), ui.get(d["unit"], {}), ui.get(tlab, {})
        for lg in ("ar", "fr"):
            if tr[0].get(lg):
                m["label_" + lg] = tr[0][lg]
            if tr[1].get(lg):
                m["unit_" + lg] = tr[1][lg]
            if tr[2].get(lg):
                m["topic_" + lg] = tr[2][lg]
        meta.append(m)
        (imf_f if is_imf else open_f)[iid] = {"years": ys, "values": vals}
    meta.sort(key=lambda m: (m["to"], m["label"].lower()))
    return meta, open_f, imf_f


def names_table(hw, codes):
    """{iso3: [en, ar, fr]} for every partner code that any Ties view can show (Natural Earth names, World Bank names, the World tab's own Arabic and French list)."""
    ent = W.entities(hw)
    ne = jload(hw + "ne-110m.json")["countries"] + jload(hw + "ne-50m.json")["countries"]
    out = {}
    for c in ne:
        out.setdefault(c["iso3"], [c["name"], c.get("name_ar") or "", c.get("name_fr") or ""])
    for k, e in ent.items():
        out.setdefault(k, [e["n"], "", ""])
        if not out[k][0]:
            out[k][0] = e["n"]
    for k, (ar, fr) in W.NAME_T.items():
        out.setdefault(k, [k, "", ""])
        out[k][1], out[k][2] = out[k][1] or ar, out[k][2] or fr
    return {k: out[k] for k in sorted(codes) if k in out}


def region_geo(ctx, hw):
    d = jload(hw + "ne-50m.json")
    keep = []
    for c in d["countries"]:
        if any(BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3] for poly in c["g"] for ring in poly for lon, lat in ring):
            keep.append({"iso3": c["iso3"], "n": c["name"], "g": c["g"]})
    m = d["meta"]
    ctx.write_json("mideast/geo.json", {"countries": keep, "bbox": list(BBOX)}, "Middle East map outlines, Natural Earth 50m countries", m.get("source_url") or "https://www.naturalearthdata.com/",
                   "Public domain (Natural Earth terms of use). Natural Earth draws de facto boundaries; the Hub takes no position on them.", rows=len(keep))
    return len(keep)


def lebanon_outline(ctx):
    """The nine provinces (OCHA COD-AB via build/geo/lbn-adm1.json) as lon/lat rings, three decimals, for the conflict-event map."""
    g = jload(os.path.join(ctx.build_dir, "geo", "lbn-adm1.json"))
    prov = []
    for f in g["features"]:
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = []
        for poly in polys:
            r = [[round(x, 3), round(y, 3)] for x, y in poly[0]]
            dd = [r[0]] + [p for i, p in enumerate(r[1:], 1) if p != r[i - 1]]
            if len(dd) > 3:
                rings.append(dd)
        prov.append({"n": f["properties"]["name"], "ar": f["properties"].get("name_ar") or "", "p": f["properties"].get("pcode"), "r": rings})
    ctx.write_json("mideast/lebanon.json", {"provinces": prov}, "Lebanon province outlines for the conflict-event map", "OCHA Common Operational Datasets, Lebanon administrative boundaries (adm1)",
                   "CC BY-IGO", rows=len(prov))
    return len(prov)


def refugees(ctx, hm):
    d = jload(hm + "refugees-hosts.json")
    keep = {k: d[k] for k in ("id", "title", "source", "source_url", "license", "license_population", "unit", "notes", "hosts", "years", "rows", "lebanon_share")}
    ctx.write_json("mideast/refugees.json", keep, "Syrian refugees in Lebanon, Jordan, Turkey, Iraq and Egypt, 2011 to 2025, with refugees per 1,000 residents", d["source"] + " (" + d["source_url"] + ")",
                   "CC BY-IGO (UNHCR via HDX); population CC BY 4.0 (World Bank)", rows=len(d["rows"]))
    rows = [[r["host"], r["year"], r["refugees"], r["asylum_seekers"], r["population"], r["per_1000_pop"]] for r in d["rows"]]
    ctx.write_csv("csv/mideast/syrian-refugees-hosts.csv", ["host_iso3", "year", "refugees", "asylum_seekers", "population", "refugees_per_1000_residents"], rows,
                  "Middle East: Syrian refugees in five host countries, 2011 to 2025", d["source_url"], "CC BY-IGO (UNHCR via HDX); population CC BY 4.0 (World Bank)")
    return len(d["rows"])


def migrants(ctx, hm):
    d = jload(hm + "migrants-od.json")
    ab = d["lebanese_born_abroad"]
    out = {"title": d["title"], "source": d["source"], "source_url": d["source_url"], "license": d["license"], "citation": d["citation"], "unit": d["unit"], "years": d["years"], "notes": d["notes"],
           "pairs": d["region_pairs"]["rows"], "abroad": {"unit": ab["unit"], "world_total": ab["world_total"], "rows": ab["rows"], "regions": ab.get("regions")}}
    ctx.write_json("mideast/migrants.json", out, "Middle East: migrant stock among 17 economies and Lebanese-born people abroad, 1990 to 2024", d["source"] + " (" + d["source_url"] + ")", d["license"],
                   rows=len(out["pairs"]) + len(ab["rows"]))
    rows = []
    for o, de, ty, st in d["region_pairs"]["rows"]:
        rows += [["region_pair", o, de, ty, y, v] for y, v in zip(d["years"], st)]
    for m49, iso, name, ty, st in ab["rows"]:
        rows += [["born_in_lebanon_abroad", "LBN", iso, ty, y, v] for y, v in zip(d["years"], st)]
    ctx.write_csv("csv/mideast/migrant-stock-regional.csv", ["set", "origin_iso3", "destination_iso3", "type", "year", "people_at_1_july"], rows,
                  "Middle East: UN DESA migrant stock, region pairs and Lebanese-born people abroad, 1990 to 2024", d["source_url"], d["license"])
    return len(out["pairs"])


def remittances(ctx, hw):
    out, rows = {}, []
    for key, stem in (("to", "W3-remittances-to-lebanon-2021"), ("from", "W3-remittances-from-lebanon-2021")):
        f = jload(hw + f"flows/{stem}.json")
        out[key] = {"flows": f["flows"], "year": f["year"], "unit": f["unit"]}
        out["source"], out["source_url"], out["license"], out["notes"] = f["source"], f["source_url"], f["license"], f["notes"]
        rows += [[key + "_lebanon", a, b, f["year"], v] for a, b, v in f["flows"]]
    ctx.write_json("mideast/remittances.json", out, "Middle East: estimated remittances to and from Lebanon by partner country, 2021 (modelled)", out["source"] + " (" + out["source_url"] + ")",
                   out["license"], rows=len(rows))
    ctx.write_csv("csv/mideast/remittances-lebanon-2021.csv", ["direction", "from_iso3", "to_iso3", "year", "million_us_dollars_modelled"], rows,
                  "Middle East: modelled bilateral remittances to and from Lebanon, 2021", out["source_url"], out["license"])
    return len(rows)


def fdi(ctx, hm):
    d = jload(hm + "fdi-positions.json")
    code = lambda c: "PSE" if c == "WBG" else c
    keep = [[code(r[0]), code(r[1]), r[2], r[3], r[4]] for r in d["rows"] if (r[0] == "LBN" or r[1] == "LBN") and r[3] == "O" and not any(ch.isdigit() for ch in r[0] + r[1])]
    out = {"title": d["title"], "source": d["source"], "source_url": d["source_url"], "license": d["license"], "citation": d["citation"], "unit": "US$ million at year end", "years": d["years"],
           "notes": d["notes"], "indicators": d["indicators"], "columns": ["reporter", "counterpart", "indicator", "dv_type", "values_by_year"], "rows": keep,
           "names": {code(k): v for k, v in d["names"].items() if not any(ch.isdigit() for ch in k)}}
    ctx.write_json("mideast/fdi.json", out, "Middle East: direct investment positions between Lebanon and partner economies, 2009 to 2024 (IMF DIP, shown with attribution, not offered as CSV)",
                   d["source"] + " (" + d["source_url"] + ")", "IMF Copyright and Usage terms (as archived 29 May 2024): IMF data may be copied, published and distributed, including commercially, if it appears accurately with the attribution 'Source: International Monetary Fund'. Shown here with that attribution; no CSV download, outside the CC BY-SA claim.", rows=len(keep))
    return len(keep)


def ucdp(ctx, hm):
    d = jload(hm + "ucdp-events.json")
    keep = {k: d[k] for k in ("id", "title", "source", "source_url", "license", "citation", "n", "years", "type_labels", "columns", "sides", "adm1", "rows", "by_year")}
    ctx.write_json("mideast/ucdp.json", keep, "Conflict events located in Lebanon, 1989 to 2024 (UCDP GED 25.1)", d["source"] + " (" + d["source_url"] + ")", "CC BY 4.0", rows=len(d["rows"]))
    C = {c: i for i, c in enumerate(d["columns"])}
    tl, sides, adm = d["type_labels"], d["sides"], d["adm1"]
    rows = [[r[C["id"]], r[C["date_start"]], r[C["date_end"]], r[C["date_prec"]], r[C["lat"]], r[C["lon"]], r[C["where_prec"]], tl[str(r[C["type"]])], sides[r[C["side_a"]]], sides[r[C["side_b"]]],
             r[C["best"]], r[C["low"]], r[C["high"]], r[C["deaths_civilians"]], (adm[r[C["adm_1"]]] if r[C["adm_1"]] is not None else "")] for r in d["rows"]]
    ctx.write_csv("csv/mideast/ucdp-ged-lebanon.csv", ["ucdp_event_id", "date_start", "date_end", "date_precision", "lat", "lon", "where_precision", "violence_type", "side_a", "side_b", "deaths_best",
                                                        "deaths_low", "deaths_high", "deaths_civilians", "province"], rows,
                  "Middle East: UCDP georeferenced events located in Lebanon, 1989 to 2024 (GED 25.1)", d["source_url"], "CC BY 4.0 (UCDP). " + d["citation"])
    return len(rows)


def shocks(ctx):
    rows = []
    for l in open(os.path.join(ctx.research, "85-regional-shocks.timeline.jsonl"), encoding="utf-8"):
        if l.strip():
            r = json.loads(l)
            rows.append({"date": r["date"], "track": r["track"], "title": r["title"], "why": r["why"], "type": r["type"], "actors": r.get("actors") or [], "place": r.get("place") or "",
                         "deaths": r.get("deaths"), "src": [s.strip() for s in (r.get("source") or "").split(";") if s.strip().startswith("http")], "c": SHOCK_CONF.get(r.get("confidence"), "reported"),
                         "dup": r.get("dup_of")})
    rows.sort(key=lambda r: r["date"])
    ctx.write_json("mideast/shocks.json", {"rows": rows}, f"Middle East: {len(rows)} dated regional events that touched Lebanon, 2012 to 2026", "Sources linked on each row (press and agency reports)",
                   None, rows=len(rows))
    ctx.write_csv("csv/mideast/regional-shocks.csv", ["date", "title", "what_happened", "type", "actors", "confidence", "also_on_timeline_as", "sources"],
                  [[r["date"], r["title"], r["why"], r["type"], "; ".join(r["actors"]), r["c"], r["dup"] or "", " ".join(r["src"])] for r in rows],
                  "Middle East: regional shocks that touched Lebanon, dated and sourced", "Sources in the last column", None)
    return len(rows)


def emit(ctx):
    hm, hw = ctx.hub_research + "mideast/", ctx.hub_research + "world/"
    if not os.path.exists(hm + "countries.json"):
        ctx.warn.append("mideast: research/hub/mideast is missing")
        return {"panel": PANEL, "inline": {"n": 0}}
    c, rows = countries(hm)
    iso = [r["iso3"] for r in rows]
    ui = W.load_ui(ctx.build_dir)
    est_from = jload(hw + "weo-estimates-start.json") if os.path.exists(hw + "weo-estimates-start.json") else {}
    meta, open_f, imf_f = indicators(ctx, hw, iso, ui, est_from)
    ctx.write_json("mideast/indicators.json", open_f, f"Middle East: {len(open_f)} open indicators for 17 economies (World Bank, ILO, UNESCO UIS, UN, Transparency International, V-Dem, OWID)",
                   "Each indicator names its source in mideast/index.json (the same series as the World tab)", "CC BY 4.0 unless the indicator says otherwise (UN DESA CC BY 3.0 IGO, UNHCR CC BY-IGO, V-Dem CC BY-SA 4.0)", rows=len(open_f))
    ctx.write_json("mideast/indicators-imf.json", imf_f, f"Middle East: {len(imf_f)} IMF World Economic Outlook indicators for 17 economies (shown with attribution, not offered as CSV)",
                   "IMF World Economic Outlook database", "IMF Copyright and Usage terms (as archived 29 May 2024): IMF data may be copied, published and distributed, including commercially, if it appears accurately with the attribution 'Source: International Monetary Fund'. Shown here with that attribution; no CSV download, outside the CC BY-SA claim.", rows=len(imf_f))
    nref, nmig, nrem, nfdi, nuc, nsh = refugees(ctx, hm), migrants(ctx, hm), remittances(ctx, hw), fdi(ctx, hm), ucdp(ctx, hm), shocks(ctx)
    ngeo, nprov = region_geo(ctx, hw), lebanon_outline(ctx)
    mig = jload(hm + "migrants-od.json")
    codes = set(iso) | {r[1] for r in mig["lebanese_born_abroad"]["rows"]}
    codes |= {x for f in ("W3-remittances-to-lebanon-2021", "W3-remittances-from-lebanon-2021") for r in jload(hw + f"flows/{f}.json")["flows"] for x in r[:2]}
    codes |= {x for r in jload(ctx.data_dir + "/mideast/fdi.json")["rows"] for x in r[:2]}
    names = names_table(hw, codes - {"LBN"} | {"LBN"})
    for r in rows:
        names[r["iso3"]] = [r["n"], r["ar"], r["fr"]]
    presets = {"levant": ["LBN", "SYR", "JOR", "PSE", "ISR", "CYP"], "gulf": ["LBN", "SAU", "ARE", "KWT", "QAT", "BHR", "OMN"], "neighbours": ["LBN", "SYR", "ISR", "CYP"],
               "big": ["LBN", "TUR", "IRN", "EGY", "SAU", "ISR"], "all": iso}
    index = {"countries": rows, "names": names, "indicators": meta, "est_from": {k: est_from[k] for k in iso if k in est_from}, "presets": presets, "region_note": c["region_definition"],
             "boundaries_note": c["notes"], "updated": "2026-10-05", "flows": {"refugees": nref, "migrants": nmig, "remittances": nrem, "fdi": nfdi, "ucdp": nuc, "shocks": nsh}}
    ctx.write_json("mideast/index.json", index, f"Middle East: index of {len(meta)} indicators, 17 economies and partner names", "Compiled by the Hub from the sources named in each indicator", None, rows=len(meta))
    return {"panel": PANEL, "inline": {"n": len(meta), "events": nuc, "shocks": nsh}, "counts": {}}
