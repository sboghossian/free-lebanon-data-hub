"""Aid and NGOs tab (leg B-aid). Research in research/hub/aid/ (see research/hub/README-AID.md).
Files: data/aid/fts-years.json, donors.json, appeals.json, presence.json, wb.json, reach.json and one CSV per dataset (csv/aid-*.csv), all through ctx.
Rules carried from the research: FTS, OECD ODA and World Bank commitments overlap and are never added; FTS totals hold pass-through flows; presence and reach figures are self-reported by the agencies.
JS: build/js/tab_aid.js, CSS: build/css/tab_aid.css, strings: build/i18n/ui_aid.json."""
import calendar, json, os, re
from collections import defaultdict

TAB = {"id": "aid", "label": "Aid & NGOs", "order": 68}
FTS_URL, OECD_URL, WB_URL, HDX_URL = "https://fts.unocha.org/", "https://data-explorer.oecd.org/", "https://projects.worldbank.org/", "https://data.humdata.org/dataset/lebanon-operational-presence"
LIC_NONE = "Not stated by the publisher; only figures are used, with attribution to the publisher. Compilation CC BY-SA 4.0."
SECTOR_NAME = {"Gender Based Violence": "Gender-based violence", "GBV": "Gender-based violence", "Water Sanitation Hygiene": "Water, sanitation and hygiene", "WASH": "Water, sanitation and hygiene",
               "Basic Assistance": "Basic assistance", "Food Security": "Food security", "Child Protection": "Child protection", "Emergency Shelter and NFI": "Emergency shelter and NFI",
               "Site Management": "Site management", "Camp Coordination / Management": "Camp coordination and management", "Social Stability": "Social stability"}


def jl(path):
    out = []
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
    return out


def jd(path, default=None):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return default


def src(name, url, lic, note=""):
    return {"name": name, "url": url, "license": lic, "retrieved": "2026-10-05", "note": note}


def fts_years(ctx, A):
    y, dn = jd(A + "fts-years.json"), jd(A + "fts-donors.json")
    if not y:
        return 0
    out, csv_y, csv_r = [], [], []
    for r in y["years"]:
        ft = r.get("by_flow_type_usd") or {}
        pt = ft.get("Pass through", 0) or 0
        st = r.get("by_status_usd") or {}
        out.append({"y": r["year"], "p": bool(r.get("partial_year")), "tot": r["total_usd"], "pt": pt, "fl": r.get("incoming_flow_count"), "pl": r.get("pledges_not_in_total_usd") or 0,
                    "paid": st.get("paid", 0), "com": st.get("commitment", 0),
                    "ty": [[x["org_type"], x.get("org_subtype") or "", x["usd"], x.get("organisations")] for x in r.get("by_recipient_type", [])],
                    "rc": [[x["name"], x["org_type"], x.get("org_subtype") or "", x["usd"]] for x in r.get("top_recipients", [])[:15]], "ns": r.get("recipient_not_specified_usd") or 0})
        csv_y.append([r["year"], "partial to 2026-10-05" if r.get("partial_year") else "full year", r["total_usd"], pt, r["total_usd"] - pt, r.get("incoming_flow_count"), r.get("pledges_not_in_total_usd") or 0, st.get("paid", 0), st.get("commitment", 0)])
        for x in r.get("top_recipients", []):
            csv_r.append([r["year"], x["rank"], x["name"], x["org_type"], x.get("org_subtype") or "", x["usd"]])
    meta = y["meta"]
    s = src("UN OCHA Financial Tracking Service (FTS)", FTS_URL, None, meta.get("license_note", ""))
    ctx.write_json("aid/fts-years.json", {"src": s, "years": out, "note": meta.get("year_basis", "")}, f"Aid to Lebanon over time: FTS reported funding by year, {out[0]['y']} to {out[-1]['y']}", FTS_URL, LIC_NONE, rows=len(out))
    ctx.write_csv("csv/aid-fts-by-year.csv", ["year", "coverage", "total_usd", "pass_through_usd", "total_excluding_pass_through_usd", "incoming_flows", "pledges_not_in_total_usd", "paid_usd", "commitment_usd"], csv_y,
                  "Aid to Lebanon: FTS reported funding by year (paid and committed flows, pass-through shown apart)", FTS_URL, LIC_NONE)
    ctx.write_csv("csv/aid-fts-recipients.csv", ["year", "rank", "recipient", "org_type", "org_subtype", "usd"], csv_r, "Aid to Lebanon: FTS top 25 first-level recipients by year", FTS_URL, LIC_NONE)
    return len(out)


def donors(ctx, A):
    f, o = jd(A + "fts-donors.json"), jd(A + "oecd-donors.json")
    if not (f and o):
        return 0
    idx, names, yrs, csv_f = {}, [], {}, []
    for r in f["years"]:
        rows = []
        for d in r["donors"]:
            if d["org_id"] not in idx:
                idx[d["org_id"]] = len(names)
                names.append([d["name"], d["org_type"], d.get("org_subtype") or ""])
            rows.append([idx[d["org_id"]], d["usd"], d.get("usd_excl_pass_through", d["usd"])])
            csv_f.append([r["year"], d["name"], d["org_type"], d.get("org_subtype") or "", d["usd"], d.get("usd_excl_pass_through", d["usd"])])
        rows.sort(key=lambda x: -x[1])
        yrs[str(r["year"])] = {"p": bool(r.get("partial_year")), "tot": r["total_usd"], "n": r.get("donor_count"), "rows": rows,
                               "ty": [[x["org_type"], x.get("org_subtype") or "", x["usd"], x.get("usd_excl_pass_through", x["usd"])] for x in r.get("by_donor_type", [])]}
    keys = {"net": "net_oda_usd_m", "hum": "humanitarian_aid_usd_m", "const": "net_oda_constant_2024_usd_m"}
    od, csv_o = [], []
    for d in o["donors"]:
        e = {"c": d["code"], "n": d["name"], "k": d["kind"]}
        for k, kk in keys.items():
            if k == "const" and d["kind"] != "aggregate":
                continue
            ser = sorted((int(yy), v) for yy, v in (d.get(kk) or {}).items() if v is not None)
            if ser:
                e[k] = ser
        od.append(e)
        years = sorted({int(yy) for kk in ("net_oda_usd_m", "humanitarian_aid_usd_m", "oda_grants_usd_m", "oda_loans_net_usd_m", "gross_oda_usd_m", "net_oda_constant_2024_usd_m") for yy, v in (d.get(kk) or {}).items() if v is not None})
        for yy in years:
            csv_o.append([d["code"], d["name"], d["kind"], yy] + [(d.get(kk) or {}).get(str(yy)) for kk in ("net_oda_usd_m", "net_oda_constant_2024_usd_m", "oda_grants_usd_m", "oda_loans_net_usd_m", "gross_oda_usd_m", "humanitarian_aid_usd_m")])
    m = o["meta"]
    ctx.write_json("aid/donors.json", {"fts": {"src": src("UN OCHA Financial Tracking Service (FTS)", FTS_URL, None, f["meta"].get("license_note", "")), "donors": names, "years": yrs},
                                      "oecd": {"src": src("OECD Development Assistance Committee, table DAC2A", m.get("url") or OECD_URL, m.get("license") or "CC BY 4.0", m.get("license_note", "")), "donors": od, "last": 2024}},
                   f"Aid donors to Lebanon: FTS source organisations ({len(names)}) and OECD DAC donors ({len(od)}), by year", FTS_URL + " ; " + OECD_URL, "FTS: not stated by the publisher (figures only). OECD: CC BY 4.0. Compilation CC BY-SA 4.0.", rows=len(names) + len(od))
    ctx.write_csv("csv/aid-fts-donors.csv", ["year", "donor", "org_type", "org_subtype", "usd", "usd_excluding_pass_through"], csv_f, "Aid donors to Lebanon: FTS source organisation by year", FTS_URL, LIC_NONE)
    ctx.write_csv("csv/aid-oecd-donors.csv", ["code", "donor", "kind", "year", "net_oda_usd_m", "net_oda_constant_2024_usd_m", "oda_grants_usd_m", "oda_loans_net_usd_m", "gross_oda_usd_m", "humanitarian_aid_usd_m"], csv_o,
                  "Aid donors to Lebanon: OECD DAC2A official development assistance by donor and year, US dollars millions (aggregate rows contain their members)", m.get("url") or OECD_URL, "CC BY 4.0 (OECD terms of use)")
    return len(names)


def appeals(ctx, A):
    a = jd(A + "fts-appeals.json")
    if not a:
        return 0
    keep = ["plan_id", "code", "name", "year", "type", "scope", "requirements_usd", "funding_planwide_usd", "funding_to_lebanon_usd", "pct_funded", "pct_funded_planwide", "requirements_lebanon_usd_hapi", "pct_funded_lebanon_hapi_basis", "notes"]
    rows = [{k: p.get(k) for k in keep} for p in a["appeals"]]
    ctx.write_json("aid/appeals.json", {"src": [src("UN OCHA Financial Tracking Service (FTS), plans and flows", FTS_URL, None, a["meta"].get("pct_funded", "")), src("OCHA Humanitarian API (HAPI), funding, for the Lebanon part of regional plans", "https://hapi.humdata.org/", "CC BY-IGO")], "appeals": rows},
                   f"Humanitarian appeals covering Lebanon: {len(rows)} plans, requirements and funding", FTS_URL, "FTS: not stated by the publisher (figures only). HAPI: CC BY-IGO. Compilation CC BY-SA 4.0.", rows=len(rows))
    ctx.write_csv("csv/aid-appeals.csv", keep, [[p.get(k) for k in keep] for p in a["appeals"]], "Humanitarian appeals covering Lebanon: requirements, funding and percent funded (regional plans are whole-plan figures)", FTS_URL,
                  "FTS: not stated by the publisher (figures only). HAPI: CC BY-IGO. Compilation CC BY-SA 4.0.")
    return len(rows)


def wb(ctx, A):
    p = jl(A + "wb-projects.jsonl")
    if not p:
        return 0
    rows = [{"id": x["project_id"], "name": x["name"], "date": x["approval_date"], "status": x["status"], "usd": x["commitment_usd"], "sectors": x["sectors"], "agency": (x.get("implementing_agency") or "").strip(),
             "closing": x.get("closing_date"), "future": bool(x.get("approval_date_is_future"))} for x in p]
    ctx.write_json("aid/wb.json", {"src": src("World Bank Projects and Operations", "https://search.worldbank.org/api/v3/projects?countrycode_exact=LB", "CC BY 4.0"), "projects": rows},
                   f"World Bank projects in Lebanon: {len(rows)} projects, 1955 to 2026", WB_URL, "CC BY 4.0", rows=len(rows))
    ctx.write_csv("csv/aid-wb-projects.csv", ["project_id", "name", "approval_date", "status", "commitment_usd", "grant_usd", "sectors", "implementing_agency", "closing_date", "url"],
                  [[x["project_id"], x["name"], x["approval_date"], x["status"], x["commitment_usd"], x["grant_usd"], "; ".join(x["sectors"]), (x.get("implementing_agency") or "").strip(), x.get("closing_date"), x["url"]] for x in p],
                  "World Bank projects in Lebanon: commitments as listed per project (additional-financing projects can repeat a parent, so do not add them)", "https://search.worldbank.org/api/v3/projects?countrycode_exact=LB", "CC BY 4.0")
    return len(rows)


def presence(ctx, A):
    pr = jl(A + "presence.jsonl")
    if not pr:
        return 0
    geo = {f["properties"]["pcode"]: f["properties"] for f in (jd(os.path.join(ctx.build_dir, "geo", "lbn-adm2.json"), {}) or {}).get("features", [])}
    types = ["United Nations", "International NGO", "National NGO"]
    otype, ofull = {}, {}
    for r in pr:
        k = r["org_acronym"].strip().lower()
        if r.get("org_type") and k not in otype:
            otype[k] = types.index(r["org_type"])
        if r.get("org") and k not in ofull:
            ofull[k] = r["org"].strip()
    label = {}
    for r in pr:
        label.setdefault(r["org_acronym"].strip().lower(), r["org_acronym"].strip())
    okeys = sorted(label, key=lambda k: label[k].lower())
    oi = {k: i for i, k in enumerate(okeys)}
    dis = sorted({(r["admin2_pcode"], r["admin2"]) for r in pr})
    di = {p: i for i, (p, _) in enumerate(dis)}
    sec = sorted({SECTOR_NAME.get(r["sector"], r["sector"]) for r in pr})
    si = {s: i for i, s in enumerate(sec)}
    per = sorted({("%s-Q%d" % (r["period_start"][:4], (int(r["period_start"][5:7]) - 1) // 3 + 1)) if r["period_kind"] == "quarter" else r["period_start"][:7] for r in pr})
    pi = {p: i for i, p in enumerate(per)}
    seen, rows, csv = set(), [], []
    for r in pr:
        pk = ("%s-Q%d" % (r["period_start"][:4], (int(r["period_start"][5:7]) - 1) // 3 + 1)) if r["period_kind"] == "quarter" else r["period_start"][:7]
        k = r["org_acronym"].strip().lower()
        key = (oi[k], di[r["admin2_pcode"]], si[SECTOR_NAME.get(r["sector"], r["sector"])], pi[pk])
        if key in seen:
            continue
        seen.add(key)
        rows.append(list(key))
        csv.append([label[k], ofull.get(k, ""), types[otype[k]] if k in otype else "", SECTOR_NAME.get(r["sector"], r["sector"]), r["admin2_pcode"], r["admin2"], r["admin1"], pk, r["source"]])
    csv.sort(key=lambda x: (x[7], x[5], x[3], x[0].lower()))
    ctx.write_json("aid/presence.json", {"src": [src("OCHA Lebanon Operational Presence (HDX), self-reported by partners", HDX_URL, "CC BY-IGO", "Monthly files October 2023 to December 2024 and the HAPI quarter 2025-Q1."),
                                                 src("OCHA Humanitarian API (HAPI), operational presence", "https://hapi.humdata.org/api/v2/coordination-context/operational-presence?location_code=LBN", "CC BY-IGO")],
                                         "periods": per, "districts": [[p, n, (geo.get(p) or {}).get("name_ar") or ""] for p, n in dis], "sectors": sec, "types": types,
                                         "orgs": [[label[k], ofull.get(k, ""), otype.get(k, -1)] for k in okeys], "rows": rows},
                   f"Who works where: {len(okeys)} organisations in {len(dis)} districts, {calendar.month_name[int(per[0][5:7])]} {per[0][:4]} to the {['first', 'second', 'third', 'fourth'][int(per[-1][-1]) - 1]} quarter of {per[-1][:4]} (self-reported by partners)", HDX_URL, "CC BY-IGO", rows=len(rows))
    ctx.write_csv("csv/aid-presence.csv", ["organisation", "organisation_name", "organisation_type", "sector", "district_pcode", "district", "governorate", "period", "source"], csv,
                  "Who works where: operational presence by organisation, sector, district and month (self-reported by partners; says who is there, not how much)", HDX_URL, "CC BY-IGO")
    return len(okeys)


def reach(ctx, A):
    r = jl(A + "reach-selfreported.jsonl")
    if not r:
        return 0
    rows = [{k: x.get(k) for k in ("year", "plan", "scope", "sector_or_group", "indicator", "unit", "people_targeted", "people_reached", "source_title", "source", "note")} for x in r]
    ref = next((s for s in ((jd(ctx.hub_research + "series/D8-people.json", {}) or {}).get("series") or []) if s.get("id") == "unhcr_syrian_refugees_yearend"), None)
    refs = {"label": "Syrian refugees in Lebanon, year-end (UNHCR registered)", "points": [p for p in ref["points"] if p[0] >= "2019"], "source": ref.get("source_url"), "license": "CC BY 4.0"} if ref else None
    ctx.write_json("aid/reach.json", {"src": src("LCRP and LRP end-of-year inter-sector dashboards, UNHCR Operational Data Portal, read by hand", "https://data.unhcr.org/en/country/lbn", None, "Self-reported by the agencies."),
                                      "rows": rows, "refugees": refs},
                   f"People reached, self-reported by the agencies: {len(rows)} figures from the LCRP and LRP dashboards, 2019 to 2025", "https://data.unhcr.org/en/country/lbn", LIC_NONE, rows=len(rows))
    ctx.write_csv("csv/aid-reach.csv", ["year", "plan", "scope", "sector_or_group", "indicator", "unit", "people_targeted", "people_reached", "self_reported", "source_title", "source", "note"],
                  [[x["year"], x["plan"], x["scope"], x["sector_or_group"], x["indicator"], x["unit"], x["people_targeted"], x["people_reached"], "yes", x["source_title"], x["source"], x["note"]] for x in rows],
                  "People reached, self-reported by the agencies (LCRP and LRP dashboards, 2019 to 2025)", "https://data.unhcr.org/en/country/lbn", LIC_NONE)
    return len(rows)


def emit(ctx):
    A = ctx.hub_research + "aid/"
    n = {"fts": fts_years(ctx, A), "donors": donors(ctx, A), "appeals": appeals(ctx, A), "wb": wb(ctx, A), "orgs": presence(ctx, A), "reach": reach(ctx, A)}
    lead = "Who funds aid to Lebanon, what the appeals asked for, who works where, and what the agencies say they reached. Every chart names its source. Funding figures from different sources overlap and are never added together."
    empty = "No aid data is in this build yet. When it is, the charts appear here."
    panel = (f'<section class="hub-panel" id="aid" role="tabpanel" aria-labelledby="t-aid" hidden>\n  <h2>Aid &amp; NGOs</h2>\n  <p class="lead">{lead}</p>\n  <div id="aidRoot"><p class="hub-empty">{empty}</p></div>\n'
             '  <p class="aid-data"><a href="#data/aid" data-hub="data" data-hash="data/aid">Data behind this tab</a></p>\n</section>')
    ok = n["fts"] > 0
    return {"panel": panel, "inline": {"n": n["fts"], **{k: v for k, v in n.items() if k != "fts"}} if ok else {}}
