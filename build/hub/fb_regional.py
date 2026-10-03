"""Places tab, regional sections: cazas (population groups, vital statistics, displacement), elections, the 2023-26 war, people.
Each function reads research/hub/** and returns the objects the emitter publishes."""
import glob, os
from hub.fb_common import jl, jd, load_series, district_cazas, election_scheme, IOM_IDS, INCLUDE_IOM_TOTALS, rnd

ELECTION_ORDER = ["1992-parliamentary", "1996-parliamentary", "2000-parliamentary", "2005-parliamentary", "2009-parliamentary", "2016-municipal", "2018-parliamentary", "2022-parliamentary", "2025-municipal", "2026-parliamentary"]
CAZA_CSV = [("lebanese_2026", "lebanese_2026"), ("syrians_2026", "syrians_2026"), ("palestinians_2026", "palestinians_2026"), ("migrants_2026_preliminary", "migrants_2026_preliminary"), ("total_2026", "total_2026"),
            ("lebanese_2025", "lebanese_2025"), ("syrians_2025", "syrians_2025"), ("total_2025", "total_2025")]


def cazas(hub):
    out, gov = {}, {}
    def slot(r):
        return out.setdefault(r["pcode"], {"n": r["name"], "ar": r.get("name_ar") or "", "g": r["adm1"] or ""})
    for r in jl(hub + "villages/D8-caza-population-groups.jsonl"):
        slot(r)["pop"] = {k: v for k, v in r["attr"].items() if isinstance(v, (int, float))}
    for r in jl(hub + "villages/D8-caza-vital-stats.jsonl"):
        slot(r)["vital"] = {k: v for k, v in r["attr"].items() if isinstance(v, (int, float))}
    for r in jl(hub + "villages/D4-cazas.jsonl"):
        a = {k: v for k, v in r["attr"].items() if isinstance(v, (int, float)) and not k.startswith("pop_")}
        slot(r)["x"] = a
        if r["attr"].get("election_district"):
            slot(r)["ed"] = r["attr"]["election_district"]
    for r in jl(hub + "villages/D6-displacement.jsonl"):
        a = r["attr"]
        if any(k.startswith("conflict_incidents") for k in a):
            continue    # the source sheet does not name its underlying dataset (possibly ACLED terms): left out
        if "idps_hosted_31may2025" in a or "returned_to_district_oct2024_may2025" in a:
            slot(r).setdefault("disp", {}).update({k: v for k, v in a.items() if isinstance(v, (int, float))})
        elif r["pcode"] and r["pcode"].startswith("LB") and len(r["pcode"]) == 3 and ("physical_damage_usd_million_oct2023_dec2024" in a or "explosive_weapon_incidents" in a or "health_incidents" in a):
            g = gov.setdefault(r["pcode"], {"n": r["name"], "ar": r.get("name_ar") or ""})
            g.setdefault("war", {}).update({k: v for k, v in a.items() if isinstance(v, (int, float))})
    # district resident estimates by source and year, and registered voters (research/hub/villages/P-population.jsonl, records of kind "caza"); there is no per-place estimate
    EST = {"cas": "resident_estimate_cas_2018_19", "lrp25": "resident_estimate_lrp_2025_total", "lrp26": "resident_estimate_lrp_2026_total", "kon": "resident_estimate_kontur_2023",
           "np04": "resident_estimate_2004_npmplt", "ls13": "resident_estimate_2013_landscan", "rv14": "registered_voters_2014", "rv18": "registered_voters_2018", "rv22": "registered_voters_2022", "rv25": "registered_voters_2025"}
    for r in jl(hub + "villages/P-population.jsonl"):
        a = r["attr"]
        if a.get("kind") != "caza" or r["pcode"] not in out:
            continue
        e = {k: a[v] for k, v in EST.items() if isinstance(a.get(v), (int, float))}
        if a.get("resident_estimate_lrp_note"):      # the research says these totals look unreliable for this district: they are not shown
            e.pop("lrp25", None)
            e.pop("lrp26", None)
            e["lrp_bad"] = 1
        out[r["pcode"]]["est"] = e
    ev = []
    for r in jl(hub + "villages/D4-displacement-idmc.jsonl"):
        a = r["attr"]
        o = {"p": r["pcode"] or "", "n": r["name"], "lv": a.get("level"), "v": a.get("figure"), "q": a.get("qualifier"), "role": a.get("role"), "d": a.get("date"), "e": a.get("date_end"), "by": a.get("reporting_source"),
             "t": (a.get("description") or "")[:260], "id": a.get("idmc_id")}
        ev.append(o)
    return {"cazas": out, "gov": gov, "idmc": ev}


def caza_csv(cz):
    header = ["pcode", "name", "governorate"] + [c[0] for c in CAZA_CSV] + ["idps_hosted_31may2025", "idps_displaced_from_here_31may2025", "returned_to_district_oct2024_may2025", "returned_from_district_oct2024_may2025",
                                                                          "public_schools_2025", "private_schools_2025"]
    rows = []
    for p, c in sorted(cz["cazas"].items()):
        pop, dp, x = c.get("pop", {}), c.get("disp", {}), c.get("x", {})
        rows.append([p, c["n"], c["g"]] + [pop.get(k, "") for k, _ in CAZA_CSV] + [dp.get("idps_hosted_31may2025", ""), dp.get("idps_displaced_from_here_31may2025", ""), dp.get("returned_to_district_oct2024_may2025", ""),
                                                                                  dp.get("returned_from_district_departure_oct2024_may2025", ""), x.get("public_schools_2025", ""), x.get("private_schools_2025", "")])
    return header, rows


def elections(hub, ctx):
    """Publishes research/hub/elections/*.json as data/elections/<id>.json plus a small index with the district-to-caza mapping, and three CSVs."""
    idx, d_rows, l_rows, w_rows = [], [], [], []
    files = {os.path.basename(p)[:-5]: p for p in glob.glob(hub + "elections/*.json")}
    order = [e for e in ELECTION_ORDER if e in files] + sorted(e for e in files if e not in ELECTION_ORDER)
    for eid in order:
        e = jd(files[eid])
        groups = [{"district": x["district"], "cazas": district_cazas(eid, x["district"])} for x in e.get("districts", [])]
        e["geo"] = {"scheme": election_scheme(eid) or "law", "groups": groups}
        nat = e.get("national") or {}
        reg = nat.get("registered") or nat.get("registered_total")
        seats = sum((x.get("seats") or 0) for x in e.get("districts", [])) or None
        idx.append({"id": eid, "name": e.get("election"), "date": e.get("date") or e.get("scheduled_date"), "type": e.get("type"), "held": e.get("held", True), "status": e.get("status"),
                    "registered": reg, "voters": nat.get("voters"), "turnout": nat.get("turnout"), "districts": len(e.get("districts", [])), "seats": seats if e.get("type") == "parliamentary" else None})
        rel = f"elections/{eid}.json"
        ctx.write_json(rel, e, f"{e.get('election')}: districts, lists, winners", "; ".join(e["source"]) if isinstance(e.get("source"), list) else str(e.get("source") or ""), e.get("license"), rows=len(e.get("districts", [])))
        for x in e.get("districts", []):
            d_rows.append([eid, e.get("date") or "", e.get("type"), x["district"], x.get("seats") if x.get("seats") is not None else "", x.get("registered") or "", x.get("voters") or "", x.get("turnout") if x.get("turnout") is not None else ""])
            for l in x.get("lists") or []:
                l_rows.append([eid, x["district"], l.get("name"), l.get("votes", ""), l.get("seats", ""), l.get("parties", "")])
            for w in x.get("winners") or []:
                w_rows.append([eid, x["district"], w.get("name"), w.get("seat", ""), w.get("list") or "", w.get("votes", ""), w.get("affiliation") or ""])
    return idx, d_rows, l_rows, w_rows


def war(hub):
    d, ser = load_series(hub, "D6-war")
    if not INCLUDE_IOM_TOTALS:
        ser = [s for s in ser if s["id"] not in IOM_IDS]
    tables = (jd(hub + "series/D6-war-tables.json", {}) or {}).get("tables", [])
    return ser, tables


def people(hub):
    d, ser = load_series(hub, "D8-people")
    ex = jd(hub + "series/D8-people-extras.json", {}) or {}
    camps = []
    for r in jl(hub + "villages/D8-palestinian-camps.jsonl"):
        a = r["attr"]
        camps.append({"n": r["name"], "ar": r.get("name_ar") or "", "cz": a.get("caza_pcode"), "adm2": r["adm2"], "lat": a.get("lat"), "lon": a.get("lon"),
                      **{k[len("census_2017_"):]: v for k, v in a.items() if k.startswith("census_2017_")}})
    return ser, ex, camps
