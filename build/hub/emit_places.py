"""Places tab (FE-B): a page for every village and town, plus the Lebanese datasets that are about where people live: elections, the 2023-26 war in numbers, and people.
Files: data/geo/lebanon.json, places/index.json, places/p/<caza>.json, places/cazas.json, elections/*.json, war/*.json, people/*.json, and CSV downloads.
See build/hub/README.md. JS: build/js/tab_places*.js, CSS build/css/tab_places.css, checks build/checks/places.mjs, strings build/i18n/ui_places.json."""
import json
from hub.lib import stub_panel
from hub import fb_places, fb_regional
from hub.fb_common import jd

TAB = {"id": "places", "label": "Places", "order": 40, "routes": ["place", "elections", "war", "people"]}   # #place/<id>, #elections/<id>, #war, #people

GAZ_SRC = "OCHA/CAS villages list 2017, OCHA COD-AB v02, GeoNames, HOT/OSM (via research/geo/gazetteer.jsonl); municipalities from CIB IMPACT and the CAS 2017 list"
POP_SRC = "registered voters from the Interior Ministry lists of 2014 as transcribed by lub-anan.com; district resident estimates from CAS/ILO 2018-19, the OCHA Lebanon Response Plan 2026 package, Kontur 2023, INFORM 2015 and LandScan 2013; Arabic names from GeoNames, lub-anan.com and Wikidata"
POP_LIC = "voter counts: no licence stated, facts from official lists; district resident estimates: CC BY (OCHA/LRP, Kontur, INFORM), CAS/ILO 2018-19 short excerpt with source; Arabic names: GeoNames CC BY 4.0, Wikidata CC0"
GAZ_LIC = "CC BY / CC BY-IGO / CC BY 4.0; names and coordinates that come from OpenStreetMap are ODbL 1.0 (c) OpenStreetMap contributors"


def emit(ctx):
    hub = ctx.hub_research
    S = ctx.S
    panel = stub_panel("places", "Places", "A page for every village and town in Lebanon: where it is, its municipality and district, population, strikes and events on record. Also the elections since 1992, the 2023 to 2026 war in numbers and the people of Lebanon.",
                       "No place data is in this build yet. When it is, you can search any village or town and open its page.")
    if not (S.get("strikes") and S.get("geo")):
        return {"panel": panel, "inline": {}}
    geo = S["geo"]
    ctx.write_json("geo/lebanon.json", geo, "Lebanon governorate and district outlines, pre-projected (shared by the maps)", "OCHA / HDX COD-AB administrative boundaries", "CC BY-IGO")
    R = fb_places.build(ctx, hub)
    idx = R["index"]
    ctx.write_json("places/index.json", idx, f"Places: index of {len(idx['rows']):,} villages, towns and neighbourhoods", GAZ_SRC, GAZ_LIC, rows=len(idx["rows"]))
    for cz, sh in R["shards"].items():
        n = sum(1 for _ in sh)
        ctx.write_json(f"places/p/{cz}.json", sh, f"Places: details for the {n} places of district {cz}", GAZ_SRC + "; " + POP_SRC + "; strikes from the Strike map data; events from the timeline", GAZ_LIC + "; " + POP_LIC, rows=n)
    ctx.write_csv("csv/places.csv", ["id", "name", "name_ar", "kind", "governorate", "district", "cadaster", "municipality", "union", "latitude", "longitude", "elevation_m", "population_gazetteer", "population_cadaster_kontur2023",
                                      "election_district", "documented_strikes", "timeline_events_naming_it", "registered_voters_2014", "registered_voters_2022_estimate"], R["csv_rows"], f"Places: {len(R['csv_rows']):,} villages, towns and neighbourhoods with district, municipality, elevation, population and registered voters", GAZ_SRC + "; " + POP_SRC, GAZ_LIC + "; " + POP_LIC)
    # districts: population groups, vital statistics, displacement and returns
    cz = fb_regional.cazas(hub)
    ctx.write_json("places/cazas.json", cz, f"Districts: population by group, births and deaths, displacement and returns ({len(cz['cazas'])} districts)",
                   "OCHA Lebanon Response Plan 2026 population package (HDX, CC BY); CAS vital statistics; IDMC (CC BY-IGO); Insecurity Insight (CC BY-SA 4.0)", "CC BY 4.0 unless a source says otherwise", rows=len(cz["cazas"]))
    h, rows = fb_regional.caza_csv(cz)
    ctx.write_csv("csv/districts.csv", h, rows, "Districts: population by group 2025 and 2026, displacement and returns", "OCHA Lebanon Response Plan 2026 population package (HDX dataset lebanon-population-estimates-and-displacement-figures)", "CC BY")
    # elections
    eidx, dr, lr, wr = fb_regional.elections(hub, ctx)
    ctx.write_json("elections/index.json", eidx, f"Elections: {len(eidx)} elections from 1992 to 2026", "Wikipedia, UNDP, IFES, IDEA, IPU (see each election file)", "CC BY-SA 4.0 for the compilation; facts attributed to their sources", rows=len(eidx))
    ctx.write_csv("csv/elections-districts.csv", ["election", "date", "type", "district", "seats", "registered", "voters", "turnout_pct"], dr, "Elections: districts, seats, registered voters and turnout, 1992 to 2025",
                  "Wikipedia, UNDP key results, IFES, IDEA, IPU; underlying Interior Ministry figures", "CC BY-SA 4.0 (Wikipedia); other sources state no licence, facts attributed")
    ctx.write_csv("csv/elections-lists.csv", ["election", "district", "list", "votes", "seats", "parties"], lr, "Elections: list votes and seats by district", "Wikipedia, UNDP, Interior Ministry results", "CC BY-SA 4.0 (Wikipedia); facts attributed")
    ctx.write_csv("csv/elections-winners.csv", ["election", "district", "winner", "seat", "list", "preferential_votes", "affiliation"], wr, "Elections: elected members with seat, list and preferential votes (2009, 2018, 2022)",
                  "Wikipedia lists of members, IFES", "CC BY-SA 4.0 (Wikipedia); facts attributed")
    # war and people
    wser, wtab = fb_regional.war(hub)
    ctx.write_json("war/series.json", {"series": [dict(s, csv=c) for s, c in zip(wser, ctx.series_csvs(wser, "war"))]}, f"The 2023 to 2026 war in numbers: {len(wser)} series", "MoPH, WHO, OCHA, IDMC, Insecurity Insight, UNIFIL, World Bank; each series names its source", "CC BY-SA 4.0 unless a series says otherwise", rows=len(wser))
    ctx.write_json("war/tables.json", {"tables": wtab}, f"The war: {len(wtab)} tables (damage and loss, UNIFIL, damage by place)", "World Bank RDNA and DaLA, UNDP, UN Secretary-General reports", "CC BY 3.0 IGO (World Bank); others as stated", rows=len(wtab))
    pser, pex, camps = fb_regional.people(hub)
    ctx.write_json("people/series.json", {"series": [dict(s, csv=c) for s, c in zip(pser, ctx.series_csvs(pser, "people"))]}, f"People of Lebanon: {len(pser)} series (population, births, refugees, migration, border crossings)",
                   "UN WPP 2024, UN DESA, UNHCR, CAS, UNRWA, OCHA; each series names its source", "CC BY-SA 4.0 unless a series says otherwise", rows=len(pser))
    ctx.write_json("people/extras.json", {"extras": pex, "camps": camps}, "People: 1932 census, age pyramids and the 12 Palestinian camps (2017 census)", "UN WPP 2024 (CC BY 3.0 IGO); PCBS and CAS 2017 census", "CC BY 3.0 IGO; the camp census states no licence", rows=len(camps))
    dn = json.load(open(hub + "villages/display-names.json", encoding="utf-8"))["names"]    # gazetteer name -> {en, ar, fr}: the common name shown instead of the GeoNames spelling
    return {"panel": panel, "inline": {"dn": dn, "n": len(idx["rows"]), "elections": len(eidx), "stats": R["stats"], "years": [e["id"] for e in eidx]}, "counts": {"places": len(idx["rows"])}}
