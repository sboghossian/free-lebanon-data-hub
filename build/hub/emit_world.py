"""World tab (FE-C): a 3D globe and a flat map of Lebanon against the world, compare charts, correlations and flows.
Reads research/hub/world/ (indicators, flows, Natural Earth geometry, entity names) and research/hub/series/ (Lebanon's own series), and writes lazy files under data/world/:
  index.json                  indicators (label, unit, topic, source, licence, default year), entities (names, aggregate flag), presets, flows
  indicators/<id>.json        one file per indicator: years + a value array per ISO3 (trimmed to the years that have data)
  geo/ne-110m.json, ne-50m.json   Natural Earth countries (globe, flat map)
  flows/<id>.json             Lebanon's flows (diaspora, remittances, refugees, trade)
  lebanon-annual.json         Lebanon's own series as annual values (World indicators plus the Hub series), for the lagged-correlation explorer
  csv/world/<topic>[-n].csv   long-format CSV per topic group (iso3, indicator_id, year, value; labels, units, sources and licences are in csv/world-dictionary.csv); indicators that forbid redistribution are left out
Labels, units and topic names are translated from build/i18n/ui_world.json (the same file the UI strings live in)."""
import glob, json, math, os, re
from hub.lib import safe_name, norm_ws

TAB = {"id": "world", "label": "World", "order": 65, "routes": ["compare"]}   # #world/<indicator>/<year> and #compare/<indicator>/LBN,SYR

TOPICS = [("economy", "Economy"), ("prices", "Prices and inflation"), ("money-flows", "Money flows"), ("public-finance", "Public finance"), ("trade", "Trade"),
          ("labour", "Labour"), ("inequality", "Inequality and poverty"), ("tourism", "Tourism"), ("energy", "Energy"), ("technology", "Technology"),
          ("environment", "Environment"), ("people", "Population"), ("health", "Health"), ("education", "Education"), ("development", "Development"),
          ("migration and displacement", "Migration and displacement"), ("conflict and safety", "Conflict and safety"), ("governance", "Governance")]
TOPIC_ID = {k: (i, lab) for i, (k, lab) in enumerate(TOPICS)}
HUB_TOPICS = {"cost-of-living": "Cost of living", "public-money": "Public money", "public": "Public money", "electricity": "Electricity", "population": "Population", "migration": "Migration",
              "climate": "Climate", "health": "Health", "displacement": "Displacement", "refugees": "Refugees", "war": "War", "fx": "Exchange rates", "emigration": "Emigration",
              "transport": "Transport", "unifil": "UNIFIL", "education": "Education"}
MENA = ["DZA", "BHR", "DJI", "EGY", "IRN", "IRQ", "ISR", "JOR", "KWT", "LBN", "LBY", "MLT", "MAR", "OMN", "PSE", "QAT", "SAU", "SYR", "TUN", "ARE", "YEM"]   # the World Bank's MENA list
GULF = ["SAU", "ARE", "QAT", "KWT", "BHR", "OMN"]
# (id, file stem, direction relative to Lebanon, kind). The labels are in the JS (translated); unit, source and licence come from the file itself.
FLOWS = [("diaspora", "W3-emigrant-stock-2024-all-years", "out"), ("remit_in", "W3-remittances-to-lebanon-2021", "in"), ("remit_out", "W3-remittances-from-lebanon-2021", "out"),
         ("remit_world", "W3-remittances-global-top-2021", "world"), ("refugees_in", "W3-unhcr-refugees-in-lebanon-all-years", "in"),
         ("refugees_out", "W3-unhcr-lebanese-refugees-abroad-all-years", "out"), ("immigrants", "W3-immigrant-stock-2024-all-years", "in"),
         ("exports", "W3-trade-exports-all-years", "out"), ("imports", "W3-trade-imports-all-years", "in"), ("refugees_world", "W2-unhcr-refugees-2025", "world")]
NAME_T = {   # Arabic and French names for the countries and territories that Natural Earth 110m does not draw (the 110m file carries the others)
    "ABW": ("أروبا", "Aruba"), "AND": ("أندورا", "Andorre"), "ASM": ("ساموا الأمريكية", "Samoa américaines"), "ATG": ("أنتيغوا وباربودا", "Antigua-et-Barbuda"), "BHR": ("البحرين", "Bahreïn"),
    "BMU": ("برمودا", "Bermudes"), "BRB": ("بربادوس", "Barbade"), "CHI": ("جزر القنال", "Îles Anglo-Normandes"), "COM": ("جزر القمر", "Comores"), "CPV": ("الرأس الأخضر", "Cap-Vert"),
    "CUW": ("كوراساو", "Curaçao"), "CYM": ("جزر كايمان", "Îles Caïmans"), "DMA": ("دومينيكا", "Dominique"), "FRO": ("جزر فارو", "Îles Féroé"), "FSM": ("ميكرونيزيا", "Micronésie"),
    "GIB": ("جبل طارق", "Gibraltar"), "GRD": ("غرينادا", "Grenade"), "GUM": ("غوام", "Guam"), "HKG": ("هونغ كونغ", "Hong Kong"), "IMN": ("جزيرة مان", "Île de Man"), "KIR": ("كيريباتي", "Kiribati"),
    "KNA": ("سانت كيتس ونيفيس", "Saint-Christophe-et-Niévès"), "LCA": ("سانت لوسيا", "Sainte-Lucie"), "LIE": ("ليختنشتاين", "Liechtenstein"), "MAC": ("ماكاو", "Macao"),
    "MAF": ("سانت مارتن (الجزء الفرنسي)", "Saint-Martin (partie française)"), "MCO": ("موناكو", "Monaco"), "MDV": ("جزر المالديف", "Maldives"), "MHL": ("جزر مارشال", "Îles Marshall"),
    "MLT": ("مالطا", "Malte"), "MNP": ("جزر ماريانا الشمالية", "Îles Mariannes du Nord"), "MUS": ("موريشيوس", "Maurice"), "NRU": ("ناورو", "Nauru"), "PLW": ("بالاو", "Palaos"),
    "PYF": ("بولينيزيا الفرنسية", "Polynésie française"), "SGP": ("سنغافورة", "Singapour"), "SMR": ("سان مارينو", "Saint-Marin"), "STP": ("ساو تومي وبرينسيبي", "Sao Tomé-et-Principe"),
    "SXM": ("سانت مارتن (الجزء الهولندي)", "Saint-Martin (partie néerlandaise)"), "SYC": ("سيشل", "Seychelles"), "TCA": ("جزر توركس وكايكوس", "Îles Turques-et-Caïques"), "TON": ("تونغا", "Tonga"),
    "TUV": ("توفالو", "Tuvalu"), "VCT": ("سانت فنسنت وجزر غرينادين", "Saint-Vincent-et-les-Grenadines"), "VGB": ("جزر فيرجن البريطانية", "Îles Vierges britanniques"),
    "VIR": ("جزر فيرجن الأمريكية", "Îles Vierges des États-Unis"), "WSM": ("ساموا", "Samoa")}
PANEL = '''<section class="hub-panel" id="world" role="tabpanel" aria-labelledby="t-world" hidden>
  <h2>World</h2>
  <p class="lead">Lebanon against the Middle East, Europe, the United States and the world, on dozens of indicators from 1960 to 2026, on a globe and a flat map.</p>
  <div id="worldRoot"></div>
  <p class="hub-empty" id="wdNone" hidden>No world data is in this build yet. When it is, you can pick an indicator, a year and countries to compare.</p>
</section>'''


def sig(x, n=7):
    if x is None or isinstance(x, bool):
        return None
    if not isinstance(x, (int, float)) or math.isnan(x) or math.isinf(x):
        return None
    if x == int(x) and abs(x) < 1e15:
        return int(x)
    return float(f"{x:.{n}g}")


def load_ui(build_dir):
    """Every build/i18n/ui*.json merged (ui_world.json last, so it wins): indicator labels may be translated in another tab's file."""
    out = {}
    for p in sorted(glob.glob(os.path.join(build_dir, "i18n", "ui*.json")), key=lambda p: os.path.basename(p) == "ui_world.json"):
        out.update(json.load(open(p, encoding="utf-8")))
    return out


def entities(hw):
    ent = {}
    for f in ("W1-wb-entities.json", "W2-countries.json"):
        p = hw + f
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding="utf-8"))
        for k, v in (d.get("entities") or d).items():
            if isinstance(v, dict) and "name" in v:
                ent.setdefault(k, {"n": v["name"], "g": 1 if v.get("aggregate") else 0})
    return ent


def indicators(ctx, hw, ent, ui):
    out, wide = [], 0
    for p in sorted(glob.glob(hw + "indicators/*.json")):
        d = json.load(open(p, encoding="utf-8"))
        years = d["years"]
        vals = {k: [sig(x) for x in v] for k, v in d["values"].items()}
        vals = {k: v for k, v in vals.items() if any(x is not None for x in v)}
        have = [i for i in range(len(years)) if any(v[i] is not None for v in vals.values())]
        if not have:
            continue
        a, b = have[0], have[-1]
        ys = years[a:b + 1]
        vals = {k: v[a:b + 1] for k, v in vals.items()}
        iid = d["id"]
        fid = safe_name(iid)
        isagg = lambda k: bool(ent.get(k, {}).get("g")) if k in ent else k.startswith("OWID_")
        counts = [sum(1 for k, v in vals.items() if not isagg(k) and v[i] is not None) for i in range(len(ys))]
        nmax = max(counts)
        lb = vals.get("LBN") or []
        lpts = [(ys[i], lb[i]) for i in range(len(lb)) if lb[i] is not None]
        dy = next((ys[i] for i in range(len(ys) - 1, -1, -1) if counts[i] >= 0.6 * nmax and (not lb or lb[i] is not None)), None)
        if dy is None:
            dy = next((ys[i] for i in range(len(ys) - 1, -1, -1) if counts[i] >= 0.6 * nmax), ys[-1])
        tk = (d.get("topic") or "").strip().lower()
        ti, tlab = TOPIC_ID.get(tk, (99, (d.get("topic") or "Other").strip().capitalize()))
        lic = d.get("license") or ""
        file = {"id": iid, "label": d["label"], "unit": d["unit"], "topic": tlab, "source": d.get("source") or "", "source_url": d.get("source_url") or "", "license": lic,
                "higher_is": d.get("higher_is") or "neutral", "years": ys, "values": vals}
        ctx.write_json(f"world/indicators/{fid}.json", file, f"World: {d['label']} ({d['unit']}), {len(vals)} countries and groups, {ys[0]} to {ys[-1]}", d.get("source") or d.get("source_url") or "", lic, rows=len(vals))
        rows = [[k, (ent.get(k) or {}).get("n", k), y, x] for k, v in sorted(vals.items()) for y, x in zip(ys, v) if x is not None]
        csvp = ctx.add_world(re.sub(r"[^a-z0-9]+", "-", tlab.lower()).strip("-"), rows, iid, d["label"], d["unit"], d.get("source_url") or d.get("source") or "", lic, d.get("redistribute"), d.get("source_url") or "", file["higher_is"])
        wide += len(vals)
        tr = ui.get(d["label"], {}), ui.get(d["unit"], {})
        lr = None    # Lebanon in the latest year it has a value: [year, value, world rank, n, MENA rank, MENA n]; rank 1 is the highest value
        if lpts:
            ly, lv = lpts[-1]
            i = ys.index(ly)
            world = [x[i] for k, x in vals.items() if not isagg(k) and x[i] is not None]
            mena = [x[i] for k, x in vals.items() if k in MENA and x[i] is not None]
            lr = [ly, lv, 1 + sum(1 for x in world if x > lv), len(world), 1 + sum(1 for x in mena if x > lv), len(mena)]
        meta = {"id": iid, "f": f"data/world/indicators/{fid}.json", "label": d["label"], "unit": d["unit"], "topic": tlab, "to": ti, "src": d.get("source") or "", "url": d.get("source_url") or "",
                "lic": lic, "hi": file["higher_is"], "y0": ys[0], "y1": ys[-1], "dy": dy, "n": nmax, "lbn": list(lpts[-1]) if lpts else None, "ln": len(lpts), "lr": lr, "est": iid.startswith("WEO."),
                "csv": "data/" + csvp if csvp else None}
        for lg in ("ar", "fr"):
            if tr[0].get(lg):
                meta["label_" + lg] = tr[0][lg]
            if tr[1].get(lg):
                meta["unit_" + lg] = tr[1][lg]
        out.append(meta)
        for k, v in vals.items():     # keep the entity table to the codes that have data somewhere
            ent.setdefault(k, {"n": k, "g": 1 if k.startswith("OWID_") else 0})
    out.sort(key=lambda m: (m["to"], m["label"].lower()))
    return out, wide


WEO_ALIAS = {"WEO.NGDPD": "NY.GDP.MKTP.CD", "WEO.NGDPDPC": "NY.GDP.PCAP.CD", "WEO.NGDP_RPCH": "NY.GDP.MKTP.KD.ZG", "WEO.PCPIPCH": "FP.CPI.TOTL.ZG", "WEO.LUR": "SL.UEM.TOTL.ZS"}   # IMF series that Lebanon's own national figures can be laid over
WPP_LAST_ESTIMATE = 2023      # UN WPP 2024: estimates through 2023, projections (medium variant) from 2024 (lebanon-national.json meta)


def national(ctx, hw, inds):
    """Lebanon's own national figures (CAS and others) as an overlay for the Compare view, the year each country's IMF estimates start, and the UN projection years."""
    out = {}
    est = json.load(open(hw + "weo-estimates-start.json", encoding="utf-8")) if os.path.exists(hw + "weo-estimates-start.json") else {}
    p = hw + "lebanon-national.json"
    ln = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None
    have = {m["id"] for m in inds}
    est_lbn = {}
    if ln:
        la = (ln.get("meta", {}).get("imf_weo_lebanon") or {}).get("latest_actual_year_by_indicator") or {}
        est_lbn = {"WEO." + k: v for k, v in la.items() if "WEO." + k in have}
        nat, nmap = {}, {}
        for key, v in ln["indicators"].items():
            iid = key[3:] if key.startswith("W2-") else key
            nat[iid] = {"label": v["label"], "unit": v["unit"], "source": v.get("source") or "", "url": v.get("source_url") or "", "lic": v.get("license") or "", "note": v.get("note") or "",
                        "years": {y: sig(x) for y, x in v["years"].items()}}
        for iid in nat:
            if iid in have:
                nmap[iid] = iid
        for w, n in WEO_ALIAS.items():
            if w in have and n in nat:
                nmap[w] = n
        ctx.write_json("world/lebanon-national.json", {"meta": ln["meta"], "indicators": nat}, f"Lebanon's own national figures: {len(nat)} indicators (CAS and other national sources) to lay over the international series",
                       "Central Administration of Statistics (Lebanon), UN WPP 2024 via Our World in Data; each indicator names its source", "Facts as published by each source; CAS states no licence, so these figures are shown with attribution and are not offered as a CSV download", rows=len(nat))
        # no CSV: most of these figures carry no licence (CAS states none), so they are shown with attribution in Compare and kept out of the downloadable CSVs
        out["map"] = nmap
        out["f"] = "data/world/lebanon-national.json"
    wpp = {m["id"]: WPP_LAST_ESTIMATE for m in inds if "World Population Prospects" in (m["src"] or "")}
    for m in inds:
        if m["id"] in wpp:
            m["wpp"] = wpp[m["id"]]
    return {"est_from": est, "est_lbn": est_lbn, "national": out}


def geo(ctx, hw, ent):
    ne = json.load(open(hw + "ne-110m.json", encoding="utf-8"))
    for c in ne["countries"]:
        e = ent.setdefault(c["iso3"], {"n": c["name"], "g": 0})
        e["n"] = c["name"]
        e["ar"], e["fr"] = c.get("name_ar"), c.get("name_fr")
        e["c"] = c.get("continent")
        e["ll"] = c.get("label")
    for stem in ("ne-110m", "ne-50m"):
        d = json.load(open(hw + stem + ".json", encoding="utf-8"))
        m = d["meta"]
        ctx.write_json(f"world/geo/{stem}.json", d, f"World map geometry, Natural Earth {stem[3:]} countries", m.get("source_url") or m.get("source", ""), "Public domain (Natural Earth terms of use)", rows=len(d["countries"]))
    return [c["iso3"] for c in ne["countries"] if c.get("continent") == "Europe"] + ["CYP"]


def flows(ctx, hw):
    out = []
    for fid, stem, direction in FLOWS:
        p = hw + f"flows/{stem}.json"
        if not os.path.exists(p):
            ctx.warn.append(f"world: flow file missing {stem}")
            continue
        d = json.load(open(p, encoding="utf-8"))
        lic = d.get("license") or ""
        ctx.write_json(f"world/flows/{fid}.json", d, f"World flows: {d['label']} ({d['unit']})", d.get("source_url") or d.get("source") or "", lic, rows=len(d["flows"]))
        out.append({"id": fid, "f": f"data/world/flows/{fid}.json", "dir": direction, "unit": d["unit"], "years": bool(d.get("years")), "n": len(d["flows"]), "src": d.get("source") or "",
                    "url": d.get("source_url") or "", "lic": lic, "label": d["label"]})
    return out


def annual_points(s):
    freq, by = s.get("freq"), {}
    for pt in s.get("points") or []:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2 or sig(pt[1]) is None or not re.match(r"^\d{4}", str(pt[0])):
            continue
        by.setdefault(int(str(pt[0])[:4]), []).append((str(pt[0]), pt[1]))
    need = {"monthly": 9, "weekly": 35, "daily": 200}.get(freq, 1)
    out = []
    for y, l in sorted(by.items()):
        if freq in ("monthly", "weekly", "daily") and len({t for t, _ in l}) < need:
            continue
        out.append([y, sig(sum(v for _, v in l) / len(l))])
    return out


def lebanon_series(ctx, hr, inds, ui):
    """Lebanon's own series as yearly values: the World indicators for LBN and the Hub series (monthly, weekly or daily ones averaged over a year that has enough points)."""
    out, seen = [], set()
    for m in inds:
        d = json.load(open(os.path.join(ctx.data_dir, m["f"][5:]), encoding="utf-8"))
        lb = d["values"].get("LBN")
        if not lb:
            continue
        pts = [[d["years"][i], lb[i]] for i in range(len(lb)) if lb[i] is not None]
        if len(pts) >= 8:
            r = {"id": "w:" + m["id"], "label": m["label"], "unit": m["unit"], "grp": m["topic"], "kind": "world", "src": m["url"] or m["src"], "lic": m["lic"], "pts": pts}
            for lg in ("ar", "fr"):
                if m.get("label_" + lg):
                    r["label_" + lg] = m["label_" + lg]
            out.append(r)
    for p in sorted(glob.glob(hr + "series/*.json")):
        d = json.load(open(p, encoding="utf-8"))
        for s in d.get("series") or []:
            pts = annual_points(s)
            if len(pts) < 8 or len({v for _, v in pts}) < 3:
                continue
            key = (s.get("label"), s.get("unit"), pts[0][0], pts[-1][0], len(pts))
            if key in seen:
                continue
            seen.add(key)
            freq = s.get("freq")
            r = {"id": "h:" + s["id"], "label": norm_ws(s["label"]), "unit": s.get("unit") or "", "grp": HUB_TOPICS.get(s.get("topic"), "Other"), "kind": "hub",
                 "src": s.get("source_url") or "", "lic": s.get("license") or "", "pts": pts}
            if freq in ("monthly", "weekly", "daily"):
                r["agg"] = "mean of " + freq + " values"
            out.append(r)
    ctx.write_json("world/lebanon-annual.json", {"series": out}, f"Lebanon's own series as yearly values ({len(out)} series)", "Compiled from the sources named in each series", None, rows=len(out))
    return out


def emit(ctx):
    hw, hr = ctx.hub_research + "world/", ctx.hub_research
    if not os.path.isdir(hw + "indicators"):
        return {"panel": PANEL, "inline": {"n": 0}}
    ui = load_ui(ctx.build_dir)
    ent = entities(hw)
    inds, wide = indicators(ctx, hw, ent, ui)
    europe = geo(ctx, hw, ent)
    fl = flows(ctx, hw)
    ls = lebanon_series(ctx, hr, inds, ui)
    nat = national(ctx, hw, inds)
    for iso, e in ent.items():
        if iso in NAME_T and not e.get("ar"):
            e["ar"], e["fr"] = NAME_T[iso]
        for k in ("ar", "fr"):
            if not e.get(k):
                e.pop(k, None)
    ctx.countries = {iso: (e["n"], e.get("ar", ""), e.get("fr", "")) for iso, e in sorted(ent.items())}
    index = {"indicators": inds, "entities": ent, "presets": {"mena": MENA, "gulf": GULF, "europe": europe}, "flows": fl, "topics": [t for _, t in TOPICS],
             "lebanon": {"n": len(ls), "f": "data/world/lebanon-annual.json"}, "geo": {"110": "data/world/geo/ne-110m.json", "50": "data/world/geo/ne-50m.json"}, "updated": "2026-10-03", **nat}
    ctx.write_json("world/index.json", index, f"World: index of {len(inds)} indicators, country names and groups, flows", "Compiled by the Hub from the sources named in each indicator file", None, rows=len(inds))
    return {"panel": PANEL, "inline": {"n": len(inds)}, "counts": {}}
