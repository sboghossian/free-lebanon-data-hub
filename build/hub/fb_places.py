"""Places: one record per village and town, joined to its municipality, cadaster, strikes and timeline events.
build(ctx) returns {"index": ..., "shards": {caza pcode: {place id: detail}}, "csv_rows": [...], "stats": {...}}."""
import json, os, re
from collections import defaultdict
import gazetteer as G
from hub.fb_common import jl

POP_KINDS = ["city", "town", "village", "locality", "neighbourhood", "camp"]
TEXT_KINDS = {"city", "town", "village"}      # timeline text is matched only to these (a neighbourhood name like "Port" is too common a word)
STOP_KEYS = {"lebanon", "south", "north", "bekaa", "metn", "beirut southern suburb", "dahieh"}
KIND_SHORT = ["airstrike", "drone_strike", "shelling", "artillery", "naval", "car_bomb", "bombing", "ground_assault", "massacre", "cluster_munition", "white_phosphorus", "explosion", "other"]
MAX_EV, MAX_ST = 40, 400


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
        if "OSM" in (a.get("src_flags") or ""):
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
        shards[p["cz"]][p["id"]] = det
        index_rows.append([p["id"], p["name"], p["ar"], kinds.index(p["kind"]), caza_idx[p["cz"]], round(p["lat"], 5), round(p["lon"], 5), "|".join(p["alts"]), n_st, n_ev])
        csv_rows.append([p["id"], p["name"], p["ar"], p["kind"], p["gov"], p["caza"], det.get("cd", ""), "; ".join(a.get("municipality") or []), "; ".join(a.get("union") or []), p["lat"], p["lon"], det.get("el", ""),
                         det.get("pg", ""), det.get("pk", ""), det.get("ed", ""), n_st, n_ev,
                         (det.get("rv") or [""])[0], det.get("rv22", "")])
    index = {"cols": ["id", "name", "name_ar", "kind", "caza", "lat", "lon", "alts", "strikes", "events"], "kinds": kinds, "cazas": cazas, "rows": index_rows}
    stats = {"places": len(places), "with_strikes": sum(1 for p in places if st.get(p["id"])), "with_events": sum(1 for p in places if ev_hits.get(p["id"])), "with_voters": sum(1 for p in places if "rv" in shards[p["cz"]][p["id"]]),
             "arabic_from_p": sum(1 for p in places if p["ars"]), "mapped_strike_places": len(pl2id)}
    return {"index": index, "shards": shards, "csv_rows": csv_rows, "stats": stats}
