"""Places: one record per village and town, joined to its municipality, cadaster, strikes and timeline events.
build(ctx) returns {"index": ..., "shards": {caza pcode: {place id: detail}}, "csv_rows": [...], "stats": {...}}."""
import json, os, re
from collections import Counter, defaultdict
import gazetteer as G
import privacy
from hub.fb_common import jl, jd

POP_KINDS = ["city", "town", "village", "locality", "neighbourhood", "camp"]
TEXT_KINDS = {"city", "town", "village"}      # timeline text is matched only to these (a neighbourhood name like "Port" is too common a word)
STOP_KEYS = {"lebanon", "south", "north", "bekaa", "metn", "beirut southern suburb", "dahieh"}
KIND_SHORT = ["airstrike", "drone_strike", "shelling", "artillery", "naval", "car_bomb", "bombing", "ground_assault", "massacre", "cluster_munition", "white_phosphorus", "explosion", "other"]
MAX_EV, MAX_ST = 40, 400
SV_KEYS = ["hospitals", "clinics", "pharmacies", "public_schools", "other_schools", "universities"]
SV_KIND = {"hospital": 0, "clinic": 1, "pharmacy": 2, "public_school": 3, "school": 4, "kindergarten": 4, "college": 5, "university": 5}
SV_RADIUS = {"city": 3.0, "town": 2.0}   # km around the place's point; every other kind 1 km


def svc_counts(places, fac_rows):
    """Facilities within a radius of each place (3 km for a city, 2 km for a town, 1 km otherwise). Neighbours share points,
    so counts overlap: a city is no longer emptied by the villages around it (the nearest-place rule did that to Sour)."""
    import math
    grid = defaultdict(list)
    for x in fac_rows:
        k = SV_KIND.get(x[0])
        if k is not None and x[3] is not None:
            grid[(int(x[3] * 20), int(x[4] * 20))].append((x[3], x[4], k))
    out = {}
    for p in places:
        r = SV_RADIUS.get(p["kind"], 1.0)
        la, lo, c = p["lat"], p["lon"], [0] * len(SV_KEYS)
        cosl = math.cos(math.radians(la))
        gy, gx = int(la * 20), int(lo * 20)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for (a, b, k) in grid.get((gy + dy, gx + dx), ()):
                    if math.hypot((a - la) * 111.32, (b - lo) * 111.32 * cosl) <= r:
                        c[k] += 1
        out[p["id"]] = (c, r)
    return out   # order of det["sv"] (v10: services per place, P-services.jsonl)


def _cap_tokens(text):
    """Candidate place names in an English sentence: runs of capitalised words (with small connector words), up to 3 words."""
    toks = re.findall(r"[A-Za-zÀ-ɏ'’\-]+", text)
    out = set()
    n = len(toks)
    for i in range(n):
        if not toks[i][:1].isupper():
            continue
        run = [toks[i]]
        out.add(toks[i])
        for j in range(i + 1, min(n, i + 3)):
            w = toks[j]
            if w[:1].isupper() or w.lower() in ("el", "al", "ed", "es", "en", "ech", "ez", "et", "ain", "ras", "deir"):
                run.append(w)
                out.add(" ".join(run))
            else:
                break
    return out


def build(ctx, hub):
    d, S = ctx.d, ctx.S
    gz = {}
    for g in jl(ctx.research + "geo/gazetteer.jsonl"):
        if g["kind"] in POP_KINDS:
            gz[(g["name"], round(g["lat"], 5), round(g["lon"], 5))] = g
    rows = jl(hub + "villages/D4-places.jsonl")
    cad = {r["pcode"]: r for r in jl(hub + "villages/D4-cadasters.jsonl")}
    munis = defaultdict(list)
    for m in jl(hub + "villages/D4-municipalities.jsonl"):
        munis[(m["adm2"], m["name"])].append(m)
    damage = {r["pcode"]: r for r in jl(hub + "villages/D6-displacement.jsonl") if "buildings_completely_destroyed" in r["attr"]}
    # P: registered voters (Interior Ministry lists, 2014) and Arabic names (there is no per-place resident estimate: the research removed it on 2026-10-03; district-level estimates are in fb_regional.cazas) the other files lacked (the one disputed name is left out)
    pop = {r["attr"]["place_id"]: r["attr"] for r in jl(hub + "villages/P-population.jsonl") if r["attr"].get("place_id")}
    ar_extra = {r["attr"]["place_id"]: (r["name_ar"], r["attr"].get("name_ar_source") or "") for r in jl(hub + "villages/P-arabic-names.jsonl")
                if r["attr"].get("place_id") and r.get("name_ar") and r["attr"].get("name_ar_confidence") in ("high", "medium")}
    for f in ("P-arabic-osm.jsonl", "P-arabic-osm-consonant.jsonl"):  # nearest OSM place with the same name (strict) or the same consonants (reviewed)
        if os.path.exists(hub + "villages/" + f):
            ar_extra.update({r["place_id"]: (r["name_ar"], "osm") for r in jl(hub + "villages/" + f) if r["place_id"] not in ar_extra})
    svc = {r["attr"]["place_id"]: r["attr"] for r in jl(hub + "villages/P-services.jsonl") if r["attr"].get("place_id")}   # v10: facilities mapped to the nearest place within 3 km
    places, by_id = [], {}
    for r in rows:
        a = r["attr"]
        g = gz.get((r["name"], round(a["lat"], 5), round(a["lon"], 5))) or {}
        alts = [x for x in (g.get("alt") or []) if not G.is_arabic(x)][:4]
        ar, ar_src = r.get("name_ar") or "", ""
        if not ar and a["place_id"] in ar_extra:
            ar, ar_src = ar_extra[a["place_id"]]
        p = {"id": a["place_id"], "name": r["name"], "ar": ar, "ars": ar_src, "kind": a["kind"], "gov": r["adm1"] or "", "caza": r["adm2"] or "", "cz": a.get("adm2_pcode") or "LB0",
             "lat": a["lat"], "lon": a["lon"], "alts": alts, "a": a, "src": r}
        places.append(p)
        by_id[p["id"]] = p
    svn = svc_counts(places, jd(hub + "services/facilities.json", {}).get("rows", []))   # v10: facilities within a radius of each place
    # ---- strikes: map every strike place (name, x, y in projected units) to the gazetteer place at the same spot
    sk, geo = S["strikes"], S["geo"]
    C = {c: i for i, c in enumerate(sk["cols"])}
    DT = sk["dict"]
    spot = defaultdict(list)
    for p in places:
        spot[(round(p["lat"], 2), round(p["lon"], 2))].append(p)
    pl2id, pl_name = {}, {}
    for i, (name, x, y, dist, ap) in enumerate(sk["places"]):
        lat, lon = geo["lat1"] - y / geo["s"], geo["lon0"] + x / (geo["k"] * geo["s"])
        cand = []
        for dy in (-0.01, 0, 0.01):
            for dx in (-0.01, 0, 0.01):
                cand += spot.get((round(lat + dy, 2), round(lon + dx, 2)), [])
        cand = [p for p in cand if abs(p["lat"] - lat) < 0.0012 and abs(p["lon"] - lon) < 0.0012]
        if not cand:
            continue
        nk = G.normalize(name)
        cand.sort(key=lambda p: (-(G.normalize(p["name"]) == nk), -G.similarity(name, p["name"]), abs(p["lat"] - lat) + abs(p["lon"] - lon)))
        pl2id[i] = cand[0]["id"]
        pl_name[cand[0]["id"]] = name
    st = defaultdict(list)
    ev_by = {e["id"]: e for e in d["events"]}
    evl = sk.get("evl") or {}
    st_ev = defaultdict(set)
    for ri, r in enumerate(sk["rows"]):
        pi = r[C["pl"]]
        if pi < 0 or pi not in pl2id:
            continue
        pid = pl2id[pi]
        eid = evl.get(str(ri)) or evl.get(ri)
        if eid and eid in ev_by:
            st_ev[pid].add(eid)
        kl = r[C["kl"]]
        st[pid].append([r[C["t"]], r[C["te"]] if r[C["te"]] != r[C["t"]] else "", DT["war"][r[C["w"]]], DT["kind"][r[C["k"]]], kl, r[C["kt"]] if C.get("kt") is not None else "", r[C["ti"]],
                        DT["src"][r[C["u"]]], r[C["c"]], eid if eid in ev_by else "", r[C["q"]]])
    # ---- events that name a place: strike-linked ones plus capitalised names in the title and why lines that match exactly one village or town
    key2ids = defaultdict(list)
    for p in places:
        if p["kind"] in TEXT_KINDS:
            k = G.normalize(p["name"])
            if len(k.replace(" ", "")) >= 4 and k not in STOP_KEYS:
                key2ids[k].append(p["id"])
    uniq = {}
    for k, v in key2ids.items():
        if len(v) > 1:
            v = [i for i in v if i.startswith("LBN")]   # same name twice: keep the one with an OCHA code if only one has it
        if len(v) == 1:
            uniq[k] = v[0]
    ev_hits = defaultdict(list)
    norm_cache = {}
    for e in d["events"]:
        text = e["title"] + " . " + " . ".join((pp.get("why") or "") for pp in e["parts"][:3])
        seen = set()
        for cnd in _cap_tokens(text):
            k = norm_cache.get(cnd)
            if k is None:
                k = norm_cache[cnd] = G.normalize(cnd)
            pid = uniq.get(k)
            if pid and pid not in seen:
                seen.add(pid)
                ev_hits[pid].append(e)
    for pid, ids in st_ev.items():
        have = {e["id"] for e in ev_hits[pid]}
        for eid in ids:
            if eid not in have:
                ev_hits[pid].append(ev_by[eid])
    # ---- records
    index_rows, shards, csv_rows = [], defaultdict(dict), []
    cazas, caza_idx = [], {}
    for p in sorted(places, key=lambda p: (p["cz"], p["name"])):
        if p["cz"] not in caza_idx:
            caza_idx[p["cz"]] = len(cazas)
            cazas.append({"p": p["cz"], "n": p["caza"], "g": p["gov"]})
    kinds = POP_KINDS
    for p in places:
        a = p["a"]
        evs = sorted(ev_hits.get(p["id"], []), key=lambda e: (-e["w"], e["date"]))
        n_ev = len(evs)
        keep = sorted(evs[:MAX_EV], key=lambda e: e["date"])
        sts = sorted(st.get(p["id"], []), key=lambda r: r[0])[:MAX_ST]
        n_st = len(st.get(p["id"], []))
        det = {}
        if a.get("municipality"):
            det["mu"] = a["municipality"]
            if a.get("municipality_ar"):
                det["mua"] = a["municipality_ar"]
        if a.get("union"):
            det["un"] = a["union"]
        for k, kk in (("elevation_m", "el"), ("election_district", "ed"), ("election_district_note", "edn"), ("pop_gazetteer", "pg"), ("cadaster_pop_kontur2023", "pk"), ("adm3", "cd"), ("adm3_pcode", "cp")):
            if a.get(k) not in (None, ""):
                det[kk] = a[k]
        c = cad.get(a.get("adm3_pcode"))
        if c:
            ca = c["attr"]
            det["cad"] = {k: ca[k] for k in ("area_km2_codab", "pop_npmplt_2004", "pop_landscan_2013", "syrians_unhcr_2014", "non_syrians_unhcr_2014", "prs_2014", "prl_2014") if ca.get(k) is not None}
            det["cad"]["n"] = c["name"]
        mm = []
        for mname in a.get("municipality") or []:
            for m in munis.get((p["caza"], mname), [])[:1]:
                ma = m["attr"]
                mm.append({"n": m["name"], "pop": ma.get("pop_municipal_est_cib"), "pcr": ma.get("covid_pcr_positive_cumulative_cib"), "vac": ma.get("covid_vaccinated_2_doses_cib"),
                           "aid": ma.get("mosa_aid_requests_cib"), "needs": ma.get("municipal_needs_reported_2020_22_cib")})
        if mm:
            det["mn"] = mm
        dm = damage.get(p["id"])
        if dm:
            det["dmg"] = {"destroyed": dm["attr"].get("buildings_completely_destroyed"), "note": dm["attr"].get("note") or "", "date": dm["attr"].get("imagery_date") or "", "src": dm["source"], "lic": dm.get("license")}
        if sts:
            det["st"] = sts
        if keep:
            det["ev"] = [[e["id"], e["date"], e["title"]] for e in keep]
        det["evn"] = n_ev
        det["stn"] = n_st
        if p["id"] in pl_name:
            det["sn"] = pl_name[p["id"]]
        if "OSM" in (a.get("src_flags") or "") or p["ars"] == "osm":
            det["osm"] = 1
        if p["ars"]:
            det["ars"] = p["ars"]
        q = pop.get(p["id"]) or {}
        if q.get("registered_voters_2014") is not None:
            det["rv"] = [q["registered_voters_2014"], q.get("registered_voters_2014_female"), q.get("registered_voters_2014_male")]
            if q.get("registered_voters_source_url"):
                det["rvu"] = q["registered_voters_source_url"]
            if q.get("registered_voters_note"):
                det["rvn"] = q["registered_voters_note"]
            if q.get("registered_voters_2022_scaled_est") is not None:
                det["rv22"] = q["registered_voters_2022_scaled_est"]
        sv, svr = svn.get(p["id"], ([0] * len(SV_KEYS), 1.0))
        det["svr"] = svr
        if any(sv):
            det["sv"] = sv
        shards[p["cz"]][p["id"]] = det
        index_rows.append([p["id"], p["name"], p["ar"], kinds.index(p["kind"]), caza_idx[p["cz"]], round(p["lat"], 5), round(p["lon"], 5), "|".join(p["alts"]), n_st, n_ev])
        csv_rows.append([p["id"], p["name"], p["ar"], p["kind"], p["gov"], p["caza"], det.get("cd", ""), "; ".join(a.get("municipality") or []), "; ".join(a.get("union") or []), p["lat"], p["lon"], det.get("el", ""),
                         det.get("pg", ""), det.get("pk", ""), det.get("ed", ""), n_st, n_ev,
                         (det.get("rv") or [""])[0], det.get("rv22", "")])
    index = {"cols": ["id", "name", "name_ar", "kind", "caza", "lat", "lon", "alts", "strikes", "events"], "kinds": kinds, "cazas": cazas, "rows": index_rows}
    stats = {"places": len(places), "with_strikes": sum(1 for p in places if st.get(p["id"])), "with_events": sum(1 for p in places if ev_hits.get(p["id"])), "with_voters": sum(1 for p in places if "rv" in shards[p["cz"]][p["id"]]),
             "arabic_from_p": sum(1 for p in places if p["ars"]), "mapped_strike_places": len(pl2id)}
    return {"index": index, "shards": shards, "csv_rows": csv_rows, "stats": stats}


# ---------------------------------------------------------------- v10: religion (registered voters by sect), services, district politics, history tables
SECT_GROUPS = ["Maronite", "Greek Orthodox", "Greek Catholic", "Armenian Orthodox", "Armenian Catholic", "Syriac Orthodox", "Syriac Catholic", "Latin", "Evangelical", "Chaldean", "Assyrian", "Copt",
               "Christian minorities/unspecified", "Sunni", "Shia", "Druze", "Alawite", "Jewish", "Not stated", "Other"]
SECT_SRC = "Interior Ministry voter lists of 2014 as transcribed by lub-anan.com (https://www.lub-anan.com/)"
SECT_LABEL = "registered voters by sect, 2014; not residents"
SVC_SRC = "OpenStreetMap health and education facilities, HOT export on HDX, snapshot 2026-10-03 (https://data.humdata.org/dataset/hotosm_lbn_health_facilities, https://data.humdata.org/dataset/hotosm_lbn_education_facilities); CERD public schools list 2017 (https://data.humdata.org/dataset/lebanon-public-schools-and-unrwa-schools-for-palestine-refugees)"
SVC_LIC = "ODbL 1.0 for the OpenStreetMap rows, credit OpenStreetMap contributors (the derived table stays share-alike); CC0 for the CERD public schools"
POL_ELECTIONS = ["2018-parliamentary", "2022-parliamentary"]
BLOC_NONE, BLOC_CHANGED = "No bloc listed", "Changed bloc during the term"


def norm_bloc(b):
    """The parliamentary bloc Wikipedia lists for an elected member. Stray marks are stripped; members whose entry says they left, were expelled or later became independent go in one group."""
    if not b:
        return BLOC_NONE
    b = re.sub(r"^[^A-Za-z]+", "", b).strip()
    if re.search(r"withdrew|expelled|until .* then|then independent", b, re.I):
        return BLOC_CHANGED
    return {"Independent National bloc": "Independent National Bloc"}.get(b, b)


GUARD_TERMS = privacy.pattern()   # the optional private-terms list (build/privacy.py); None when absent, so nothing is withheld
PRACTITIONERS = {"doctor", "dentist"}   # named after a private person: the point stays, the name is not published


def sect_row(r):
    by = r["by_sect"]
    return [r["total"]] + [by.get(g, 0) for g in SECT_GROUPS[:-1]] + [sum((r.get("other") or {}).values())]


def v10(ctx, hub, R):
    """Writes the v10 files through ctx. Returns the small inline bits for the JS."""
    ids = {x[0] for x in R["index"]["rows"]}
    # ---- registered voters by sect, 2014
    sects = jl(hub + "villages/P-sects-2014.jsonl")
    rows, ov = {}, []
    for r in sects:
        pid = r.get("place_id")
        if pid in ids:
            sr = sect_row(r)
            assert sr[0] == sum(sr[1:]), (pid, sr)    # the research checked it; the build repeats it
            rows[pid] = sr
            if r.get("note"):
                ov.append(pid)
    ctx.write_json("places/sects-2014.json", {"year": 2014, "label": SECT_LABEL, "groups": SECT_GROUPS, "rows": rows, "overlap": ov},
                   f"Places: registered voters by sect, 2014, for {len(rows):,} villages and towns (counts per sect; not residents)", SECT_SRC, "No licence stated by the source: facts (counts) only, attributed", rows=len(rows))
    h = ["place_id", "name", "name_ar", "year", "registered_voters_total"] + [g.replace("/", " or ").lower().replace(" ", "_") for g in SECT_GROUPS[:-1]] + ["other_groups_total", "other_groups_detail", "note", "source"]
    out = []
    for r in sects:
        sr = sect_row(r)
        out.append([r.get("place_id") or "", r["name"], r.get("name_ar") or "", r["year"]] + sr + ["; ".join(f"{k}: {v}" for k, v in (r.get("other") or {}).items()), r.get("note") or "", r.get("source") or ""])
    ctx.write_csv("csv/places-sects-2014.csv", h, out, f"Places: registered voters by sect, 2014, one row per voter list ({len(out):,} lists; not residents)", SECT_SRC, "No licence stated by the source: facts (counts) only, attributed")
    # ---- services
    sv = jl(hub + "villages/P-services.jsonl")
    svn = svc_counts([{"id": x[0], "kind": x[3], "lat": x[5], "lon": x[6]} for x in R["index"]["rows"]], jd(hub + "services/facilities.json", {}).get("rows", []))
    ctx.write_csv("csv/places-services.csv", ["place_id", "name", "name_ar", "governorate", "district", "kind", "radius_km"] + SV_KEYS + ["osm_snapshot"],
                  [[r["attr"].get("place_id"), r["name"], r.get("name_ar") or "", r.get("adm1") or "", r.get("adm2") or "", r["attr"].get("kind"), svn.get(r["attr"].get("place_id"), (None, None))[1]]
                   + (svn.get(r["attr"].get("place_id"), ([0] * len(SV_KEYS), None))[0]) + [r["attr"].get("osm_snapshot")] for r in sv],
                  f"Places: health and education facilities within 3 km of each city, 2 km of each town and 1 km of other places ({len(sv):,} places; neighbours share points, so counts overlap)", SVC_SRC, SVC_LIC)
    fac = jd(hub + "services/facilities.json", {})
    kinds = fac.get("kinds") or []
    def names(x):    # a name that trips the build's excluded-terms guard is withheld, the point stays
        if x[0] in PRACTITIONERS or (GUARD_TERMS and GUARD_TERMS.search((x[1] or "") + " " + (x[2] or ""))):
            return ("", "")
        return (x[1] or "", x[2] or "")
    withheld = sum(1 for x in fac.get("rows", []) if names(x)[0] == "" and (x[1] or x[2]))
    frows = [[kinds.index(x[0]), *names(x), x[3], x[4], x[6] or ""] for x in fac.get("rows", [])]
    ctx.write_json("places/facilities.json", {"kinds": kinds, "snapshot": fac.get("snapshot"), "rows": frows},
                   f"Health and education facilities in Lebanon: {len(frows):,} points for the map layer (OpenStreetMap, CERD public schools)", SVC_SRC, SVC_LIC, rows=len(frows))
    ctx.write_csv("csv/facilities.csv", fac.get("columns") or ["kind", "name", "name_ar", "lat", "lon", "src", "place_id"], [[x[0], *names(x)] + list(x[3:]) for x in fac.get("rows", [])],
                  f"Health and education facilities in Lebanon: {len(frows):,} points with source id and nearest place", SVC_SRC, SVC_LIC)
    # ---- politics of the election district (2018, 2022): seats by bloc, list votes, turnout
    pol, blocs_csv = {}, []
    for eid in POL_ELECTIONS:
        e = jd(hub + f"elections/{eid}.json") or {}
        dd = {}
        for x in e.get("districts", []):
            bc = Counter(norm_bloc(w.get("bloc")) for w in x.get("winners", []))
            assert sum(bc.values()) == x["seats"], (eid, x["district"])
            order = sorted(bc.items(), key=lambda kv: (kv[0] in (BLOC_NONE, BLOC_CHANGED), -kv[1], kv[0]))
            dd[x["district"]] = {"q": x.get("qadas") or "", "seats": x["seats"], "reg": x.get("registered"), "vot": x.get("voters"), "to": x.get("turnout"), "tc": x.get("turnout_computed"),
                                 "blocs": [list(kv) for kv in order], "lists": [[l["name"], l.get("votes"), l.get("seats"), l.get("pct_of_district")] for l in sorted(x.get("lists", []), key=lambda l: -(l.get("votes") or 0))]}
            blocs_csv += [[eid, x["district"], b, n] for b, n in order]
        pol[eid] = {"date": e.get("date"), "name": e.get("election"), "src": e.get("source"), "lic": e.get("license"), "notes": e.get("notes") or [], "districts": dd}
    ctx.write_json("places/politics.json", {"elections": pol}, "Election districts 2018 and 2022: seats by parliamentary bloc, list votes and turnout (the results the town page shows for its district)",
                   "Wikipedia (2018 and 2022 Lebanese general elections, lists of members), UNDP key results brochure 2022; underlying results from the Interior Ministry", "CC BY-SA 4.0 (Wikipedia); official results, no licence stated; UNDP figures as facts, attributed", rows=sum(len(v["districts"]) for v in pol.values()))
    ctx.write_csv("csv/elections-blocs.csv", ["election", "district", "bloc", "seats"], blocs_csv, "Elections 2018 and 2022: seats won by parliamentary bloc, per electoral district (the bloc Wikipedia lists for each elected member)",
                  "Wikipedia lists of members of the 2018-2022 and 2022-2026 Parliaments", "CC BY-SA 4.0 (Wikipedia contributors); facts attributed")
    # ---- history tables and the 2014 national count
    hist = jd(hub + "politics/history.json", {})
    nat = (jd(hub + "politics/qada-sects-2014.json", {}) or {}).get("national") or {}
    hn = {"total": nat.get("total"), "by_sect": nat.get("by_sect"), "other": sum((nat.get("other") or {}).values()), "year": 2014}
    ctx.write_json("places/history.json", {"title": hist.get("title"), "tables": hist.get("tables", []), "national_2014": hn},
                   f"Communities and seats over time: {len(hist.get('tables', []))} national tables, 1860 to 2017, plus the 2014 voter count by sect",
                   "The Monthly; Wikipedia (Mount Lebanon Mutasarrifate, Greater Lebanon, Demographics of Lebanon, Lebanese general elections 1927 to 2022); IFES; IPU Parline; lub-anan.com", "Wikipedia CC BY-SA 4.0 (facts only); The Monthly and lub-anan.com: facts cited with attribution", rows=len(hist.get("tables", [])))
    flat = []
    for tb in hist.get("tables", []):
        for i, r in enumerate(tb["rows"]):
            lab = next((str(r[k]) for k in ("sect", "district", "group", "law_year", "statement") if r.get(k) is not None), str(i))
            for k, v in r.items():
                if isinstance(v, dict):
                    flat += [[tb["id"], tb.get("year"), lab, f"{k}: {kk}", vv] for kk, vv in v.items()]
                elif v is not None and k not in ("sect", "district", "group", "statement"):
                    flat.append([tb["id"], tb.get("year"), lab, k, v])
                elif k == "statement":
                    flat.append([tb["id"], tb.get("year"), str(i + 1), "statement", v])
    ctx.write_csv("csv/history-tables.csv", ["table_id", "year", "row", "field", "value"], flat, "Communities and seats over time: every cell of the national history tables, long format (table_id, year, row, field, value)",
                  "The Monthly; Wikipedia; IFES; IPU Parline (see data/places/history.json for each table's source)", "Wikipedia CC BY-SA 4.0 (facts only); other sources: facts cited with attribution")
    return {"sects": len(rows), "facilities": len(frows), "names_withheld": withheld}
