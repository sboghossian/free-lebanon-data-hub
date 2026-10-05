"""Trade & investment tab (LEG B-trade): goods trade by product and partner (BACI, Lebanese Customs), services and the current account (WDI), foreign investment, IDAL projects, venture funding.
Reads research/hub/trade/ (R-trade), research/hub/mideast/fdi-positions.json, research/hub/world/ (current account, Natural Earth outlines, country names). Writes lazy files under data/trade/:
  overview.json     yearly goods totals from BACI, Customs annual totals summed from the monthly file, the WDI series, the Lebanese current account
  chapters.json     BACI value by HS2 chapter, flow and year (chapter names)           partners.json   BACI value by partner, flow and year (names in three languages)
  products.json     BACI top 25 HS6 products per year and flow                         customs.json    Customs monthly totals, annual totals by chapter and by partner (no weight)
  investment.json   FDI, stocks, capital formation, IDAL projects and sectors, venture funding   fdi-origin.json   IMF direct investment positions (shown, never offered as CSV)
  world-geo.json    Natural Earth 110m outlines for the partner map
  csv/trade/*.csv and csv/series/{trade,investment}*.csv   downloads (the IMF file and sources that forbid redistribution have none)
The tab shows one link, "Data behind this tab" (#data/trade); it prints no tables."""
import json, os
from hub import emit_world as W
from hub.emit_mideast import names_table

TAB = {"id": "trade", "label": "Trade & investment", "order": 63, "routes": []}   # #trade/<view>/<flow>/<year>

PANEL = '''<section class="hub-panel" id="trade" role="tabpanel" aria-labelledby="t-trade" hidden>
  <h2>Trade &amp; investment</h2>
  <p class="lead">What Lebanon sells and buys abroad, with whom, and how much money comes in as investment. Each chart names its source and licence, and says when two sources measure the same thing differently.</p>
  <div id="tradeRoot"><p class="hub-empty">No trade or investment data is in this build yet. When it is, you can see exports, imports, products, partners and investment.</p></div>
  <p class="tr-data"><a href="#data/trade" data-hub="data" data-hash="data/trade">Data behind this tab</a></p>
</section>'''

BACI_LIC = "Etalab Open Licence 2.0 (cite BACI/CEPII)"
NO_LIC = "Not stated by the source: facts (numbers) with attribution only"
IMF_LIC = "IMF Copyright and Usage terms (as archived 29 May 2024): IMF data may be copied, published and distributed, including commercially, if it appears accurately with the attribution 'Source: International Monetary Fund'. Shown here with that attribution; no CSV download, outside the CC BY-SA claim."


def jload(p):
    return json.load(open(p, encoding="utf-8"))


def meta(d):
    return {k: d.get(k) for k in ("source", "source_url", "license", "citation", "note", "unit") if d.get(k) is not None}


def totals(rows, vi=3):
    out = {}
    for r in rows:
        out[(r[0], r[1])] = out.get((r[0], r[1]), 0) + r[vi]
    return out


def overview(ctx, ht, hw):
    ch = jload(ht + "goods-by-chapter.json")
    tot = totals(ch["rows"])
    years = sorted({y for y, _ in tot})
    mon = jload(ht + "monthly-customs.json")
    cu, cn = {}, {}
    for m, f, v, _w in mon["rows"]:
        k = (int(m[:4]), f)
        cu[k] = cu.get(k, 0) + v
        cn[k] = cn.get(k, 0) + 1
    cy = sorted({y for y, _ in cu} | {2026})
    series = [s for s in jload(ht + "series.json")["series"]]
    ca = jload(hw + "indicators/BN.CAB.XOKA.CD.json")
    pts = [[str(y), v] for y, v in zip(ca["years"], ca["values"]["LBN"]) if v is not None]
    series.append({"id": "wb_bn_cab_xoka_cd", "label": "Current account balance (BoP)", "unit": "current US$", "topic": "trade", "freq": "yearly", "source_url": ca["source_url"],
                   "license": ca["license"], "points": pts, "notes": "Same series as on the World tab. World Bank WDI code BN.CAB.XOKA.CD. Negative means a deficit."})
    csvs = ctx.series_csvs(series, "trade")
    series = [dict(s, csv=c) for s, c in zip(series, csvs)]
    out = {"years": years, "baci": {f: [tot.get((y, f)) for y in years] for f in "XM"}, "baci_meta": meta(ch),
           "customs": {"years": cy, "X": [round(cu[(y, "X")]) if (y, "X") in cu else None for y in cy], "M": [round(cu[(y, "M")]) if (y, "M") in cu else None for y in cy],
                       "months": {f: {str(y): cn.get((y, f), 0) for y in cy} for f in "XM"}, "meta": meta(mon), "partial": mon.get("partial_year_note")},
           "series": series}
    ctx.write_json("trade/overview.json", out, "Trade: goods exports and imports 1995 to 2024 (BACI), Customs annual totals, WDI trade series and current account", ch["source"] + " (" + ch["source_url"] + ")",
                   "BACI: " + BACI_LIC + "; WDI CC BY 4.0; Customs: " + NO_LIC, rows=len(years))
    ctx.write_csv("csv/trade/goods-totals-baci.csv", ["year", "exports_usd", "imports_usd", "balance_usd"],
                  [[y, tot.get((y, "X")), tot.get((y, "M")), (tot.get((y, "X")) or 0) - (tot.get((y, "M")) or 0)] for y in years],
                  "Trade: Lebanon goods exports, imports and balance by year, 1995 to 2024 (BACI, reconciled mirror data)", ch["source_url"], BACI_LIC)
    return len(years), ch


def chapters(ctx, ch):
    ctx.write_json("trade/chapters.json", {"meta": meta(ch), "chapters": ch["chapters"], "rows": [[r[0], r[1], r[2], r[3]] for r in ch["rows"]]},
                   "Trade: Lebanon goods by HS2 chapter, 1995 to 2024 (BACI)", ch["source"] + " (" + ch["source_url"] + ")", BACI_LIC, rows=len(ch["rows"]))
    ctx.write_csv("csv/trade/goods-by-chapter-baci.csv", ["year", "flow_X_export_M_import", "hs2_chapter", "chapter_name", "value_usd", "quantity_tonnes"],
                  [[r[0], r[1], r[2], ch["chapters"].get(r[2], ""), r[3], r[4]] for r in ch["rows"]],
                  "Trade: Lebanon goods by HS2 chapter, 1995 to 2024 (BACI; quantity 0 means not reported)", ch["source_url"], BACI_LIC)
    return len(ch["rows"])


def partners(ctx, ht, hw, hm):
    d = jload(ht + "goods-by-partner.json")
    cp = jload(ht + "customs-partners.json")
    codes = {r[2] for r in d["rows"]} | {r[2] for r in cp["rows"] if r[2]} | {r[1] for r in jload(hm + "fdi-positions.json")["rows"] if len(r[1]) == 3 and r[1].isalpha()} | {"LBN"}
    names = names_table(hw, codes)
    for k, v in d["partners"].items():
        if k not in names:
            names[k] = [v, "", ""]
    names = {k: v for k, v in names.items()}
    ctx.write_json("trade/partners.json", {"meta": meta(d), "names": names, "rows": d["rows"]}, "Trade: Lebanon goods by partner country, 1995 to 2024 (BACI)",
                   d["source"] + " (" + d["source_url"] + ")", BACI_LIC, rows=len(d["rows"]))
    ctx.write_csv("csv/trade/goods-by-partner-baci.csv", ["year", "flow_X_export_M_import", "partner_iso3", "partner_name", "value_usd"],
                  [[r[0], r[1], r[2], d["partners"].get(r[2], "")  , r[3]] for r in d["rows"]], "Trade: Lebanon goods by partner country, 1995 to 2024 (BACI)", d["source_url"], BACI_LIC)
    return len(d["rows"]), names


def products(ctx, ht):
    d = jload(ht + "top-products.json")
    rows = [[int(y), f, p[0], p[1], p[2], p[3]] for y, fl in d["years"].items() for f, ps in fl.items() for p in ps]
    ctx.write_json("trade/products.json", {"meta": meta(d), "years": d["years"]}, "Trade: top 25 HS6 products per year and flow, 1995 to 2024 (BACI, HS92 names)",
                   d["source"] + " (" + d["source_url"] + ")", BACI_LIC, rows=len(rows))
    ctx.write_csv("csv/trade/top-products-baci.csv", ["year", "flow_X_export_M_import", "hs6", "description_hs92", "value_usd", "quantity_tonnes"], rows,
                  "Trade: top 25 HS6 products per year and flow (BACI, HS92 names; quantity 0 means not reported)", d["source_url"], BACI_LIC)
    return len(rows)


def customs(ctx, ht):
    mon, cc, cp = jload(ht + "monthly-customs.json"), jload(ht + "customs-chapters.json"), jload(ht + "customs-partners.json")
    # Weight is left out on purpose: the Customs page does not state the unit (the research read it as tonnes, unconfirmed).
    cm = {k: v for k, v in meta(mon).items() if k != "unit"}
    out = {"meta": cm, "partial": mon.get("partial_year_note"), "partial_annual": cc.get("partial_year_note"), "months": [[r[0], r[1], r[2]] for r in mon["rows"]],
           "chapters": cc["chapters"], "by_chapter": [[r[0], r[1], r[2], r[3]] for r in cc["rows"]],
           "by_partner": [[r[0], r[1], r[2], r[3], r[4]] for r in cp["rows"]], "partner_note": cp.get("note")}
    ctx.write_json("trade/customs.json", out, "Trade: Lebanese Customs monthly totals 2016 to 2026, annual totals by chapter and by partner (special trade, no weight)",
                   mon["source"] + " (" + mon["source_url"] + ")", NO_LIC, rows=len(out["months"]) + len(out["by_chapter"]) + len(out["by_partner"]))
    ctx.write_csv("csv/trade/customs-monthly.csv", ["month", "flow_X_export_M_import", "value_usd"], out["months"], "Trade: Lebanese Customs monthly special-trade totals, 2016 to 2026 (value only)",
                  mon["source_url"], NO_LIC)
    ctx.write_csv("csv/trade/customs-by-chapter.csv", ["year", "flow_X_export_M_import", "hs2_chapter", "chapter_name", "value_usd"],
                  [[r[0], r[1], r[2], cc["chapters"].get(r[2], ""), r[3]] for r in out["by_chapter"]], "Trade: Lebanese Customs annual totals by HS2 chapter, special trade (value only; 2026 is year to date)",
                  cc["source_url"], NO_LIC)
    ctx.write_csv("csv/trade/customs-by-partner.csv", ["year", "flow_X_export_M_import", "partner_iso3", "partner_name_arabic_if_unmapped", "value_usd"], out["by_partner"],
                  "Trade: Lebanese Customs annual totals by partner, special trade (value only; 2026 is year to date)", cp["source_url"], NO_LIC)
    return len(out["months"])


def investment(ctx, ht):
    inv, idal, vc = jload(ht + "investment-series.json"), jload(ht + "idal-sectors.json"), jload(ht + "vc-annual.json")
    series = inv["series"]
    csvs = ctx.series_csvs(series, "investment")
    series = [dict(s, csv=c) for s, c in zip(series, csvs)]
    out = {"series": series, "idal": {"source": idal["source"], "license": idal["license"], "years": idal["years"]},
           "vc": {"title": vc["title"], "unit": vc["unit"], "status": vc["status"], "gaps": vc.get("gaps"), "note": vc.get("redistribute_note"), "rows": vc["rows"]}}
    ctx.write_json("trade/investment.json", out, "Trade: foreign direct investment, capital formation, IDAL projects and venture funding (WDI, UNCTAD, IDAL, Wamda and others)",
                   "World Bank WDI, UNCTADstat, IDAL, Wamda, KAS/Arabnet (each series names its own)", "WDI CC BY 4.0; UNCTAD CC BY 3.0 IGO; IDAL and venture funding: " + NO_LIC, rows=len(series))
    rows = [[int(y), s["sector"], s["usd"], s["jobs"]] for y, ss in idal["years"].items() for s in ss]
    ctx.write_csv("csv/trade/idal-projects-by-sector.csv", ["year", "sector", "investment_size_usd", "jobs"], rows, "Trade: IDAL-supported projects by sector and year, 2003 to 2020 (2008 and 2013 not published)",
                  idal["source"], NO_LIC)
    ctx.write_csv("csv/trade/venture-funding-annual.csv", ["year", "usd", "deals", "status", "source", "source_url", "note"],
                  [[r["year"], r["usd"], r["deals"], r["status"], r["source"], r["source_url"], r.get("note") or ""] for r in vc["rows"]],
                  "Trade: annual venture funding into Lebanese startups, headline figures as published (reported; 2016, 2018, 2019, 2020 missing)", "See the source_url column", NO_LIC)
    return len(series)


def fdi_origin(ctx, hm):
    p = hm + "fdi-positions.json"
    if not os.path.exists(p):
        ctx.warn.append("trade: research/hub/mideast/fdi-positions.json is missing, FDI by origin is left out")
        return 0
    d = jload(p)
    keep = [[r[0], r[1], r[2], r[3], r[4]] for r in d["rows"] if r[3] == "O" and r[2] in ("OTWD_D_NETAL_FALL_ALL", "INWD_D_NETLA_FALL_ALL") and (r[1] == "LBN" or r[0] == "LBN")]
    out = {"title": d["title"], "source": d["source"], "source_url": d["source_url"], "license": IMF_LIC, "citation": d["citation"], "unit": "US$ million at year end", "years": d["years"], "notes": d["notes"],
           "indicators": {k: v for k, v in d["indicators"].items() if k in ("OTWD_D_NETAL_FALL_ALL", "INWD_D_NETLA_FALL_ALL")}, "names": d["names"], "columns": d["columns"], "rows": keep}
    ctx.write_json("trade/fdi-origin.json", out, "Trade: direct investment positions by partner economy, 2009 to 2024 (IMF DIP, shown with attribution, not offered as CSV)",
                   d["source"] + " (" + d["source_url"] + ")", IMF_LIC, rows=len(keep))
    return len(keep)


def world_geo(ctx, hw):
    d = jload(hw + "ne-110m.json")
    out = []
    for c in d["countries"]:
        if c["iso3"] in ("ATA",):
            continue
        g = [[[[round(x, 1), round(y, 1)] for x, y in ring] for ring in poly] for poly in c["g"]]
        out.append({"iso3": c["iso3"], "g": g})
    m = d["meta"]
    ctx.write_json("trade/world-geo.json", {"countries": out}, "Trade: world map outlines, Natural Earth 110m countries", m.get("source_url") or "https://www.naturalearthdata.com/",
                   "Public domain (Natural Earth terms of use). Natural Earth draws de facto boundaries; the Hub takes no position on them.", rows=len(out))
    return len(out)


def emit(ctx):
    ht, hw, hm = ctx.hub_research + "trade/", ctx.hub_research + "world/", ctx.hub_research + "mideast/"
    if not os.path.exists(ht + "goods-by-chapter.json"):
        ctx.warn.append("trade: research/hub/trade is missing")
        return {"panel": PANEL, "inline": {"n": 0}}
    n_years, ch = overview(ctx, ht, hw)
    nch, (npart, names) = chapters(ctx, ch), partners(ctx, ht, hw, hm)
    nprod, ncus, ninv, nfdi, ngeo = products(ctx, ht), customs(ctx, ht), investment(ctx, ht), fdi_origin(ctx, hm), world_geo(ctx, hw)
    return {"panel": PANEL, "inline": {"n": n_years, "chapters": nch, "partners": npart, "products": nprod, "customs": ncus, "series": ninv, "fdi": nfdi}, "counts": {}}
