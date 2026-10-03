"""Shared readers for the FE-B tabs (places, cost, electricity). Not a plugin: the build only loads hub/emit_*.py.
Everything here reads research/hub/** and returns plain Python objects; the emitters write the published files through ctx."""
import json, os, re

INCLUDE_IOM_TOTALS = os.environ.get("HUB_INCLUDE_IOM", "") == "1"   # D6 asks Stephane to decide; off = the 5 IOM-derived displacement series stay out
IOM_IDS = {"idp_displaced_since_oct2023_cum", "idp_remaining_displaced_2024_25", "idp_back_in_cadaster_2024_25", "idp_stock_dtm_2026", "idp_returned_dtm_2026"}


def jl(path):
    out = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except ValueError:
                        pass
    return out


def jd(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def rnd(v, k=4):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return v
    if isinstance(v, float):
        r = round(v, k)
        return int(r) if r == int(r) and abs(r) < 1e15 else r
    return v


def clean_series(series, keep_extra=("derived", "unit_confidence", "confidence")):
    """Series in the research/hub/series contract, trimmed for publishing: points rounded, non-numeric points dropped, no empty series."""
    out = []
    for s in series:
        pts = []
        for p in s.get("points") or []:
            if isinstance(p, (list, tuple)) and len(p) >= 2 and isinstance(p[1], (int, float)) and not isinstance(p[1], bool) and re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", str(p[0])):
                pts.append([str(p[0]), rnd(p[1])])
        if not pts:
            continue
        o = {"id": s["id"], "label": s.get("label") or s["id"], "unit": s.get("unit") or "", "freq": s.get("freq") or "", "source_url": s.get("source_url") or s.get("source") or "",
             "license": s.get("license"), "notes": (s.get("notes") or "")[:600], "points": pts}
        for k in keep_extra:
            if s.get(k) not in (None, "", False):
                o[k] = s[k]
        o = {k: v for k, v in o.items() if v is not None or k == "license"}
        out.append(o)
    return out


def load_series(hub, name):
    d = jd(hub + "series/" + name + ".json", {}) or {}
    return d, clean_series(d.get("series") or [])


# Election districts -> caza P-codes (COD-AB adm2). Cazas shared by several districts (Beirut, Saida/Zahrani) list every district; the page averages them.
G_BEIRUT, G_BEKAA, G_BAALBEK = ["LB11"], ["LB23", "LB24", "LB25"], ["LB21", "LB22"]
G_ML, G_ML_ALL = ["LB31", "LB32", "LB33", "LB36"], ["LB31", "LB32", "LB33", "LB34", "LB35", "LB36"]
G_N, G_AKKAR = ["LB52", "LB53", "LB54", "LB55", "LB56", "LB57"], ["LB51"]
G_S, G_NAB = ["LB61", "LB62", "LB63"], ["LB41", "LB42", "LB43", "LB44"]
DISTRICT_CAZAS = {
    # five traditional governorates (1992 to 2005)
    "Beirut": G_BEIRUT, "Mount Lebanon": G_ML_ALL, "North": G_N + G_AKKAR, "South": G_S + G_NAB, "Bekaa": G_BEKAA + G_BAALBEK,
    # 2009 qada districts
    "Akkar": G_AKKAR, "Minieh-Dennieh": ["LB55"], "Tripoli": ["LB56"], "Zgharta": ["LB57"], "Bcharre": ["LB53"], "Koura": ["LB54"], "Batroun": ["LB52"], "Jbeil": ["LB34"], "Keserwan": ["LB35"],
    "Metn": ["LB36"], "Baabda": ["LB32"], "Aley": ["LB31"], "Chouf": ["LB33"], "Beirut 1": G_BEIRUT, "Beirut 2": G_BEIRUT, "Beirut 3": G_BEIRUT, "Baalbek-Hermel": G_BAALBEK, "Zahle": ["LB25"],
    "West Bekaa-Rachaya": ["LB23", "LB24"], "Saida": ["LB61"], "Zahrani": ["LB61"], "Jezzine": ["LB62"], "Marjayoun-Hasbaya": ["LB42", "LB43"], "Nabatieh": ["LB44"], "Tyre": ["LB63"], "Bint Jbeil": ["LB41"],
    # 2016 and 2025 municipal governorates
    "Keserwan-Jbeil": ["LB34", "LB35"], "Mount Lebanon (incl. Keserwan-Jbeil)": G_ML_ALL,
    # Law 44/2017 (2018, 2022)
    "Beirut I": G_BEIRUT, "Beirut II": G_BEIRUT, "Mount Lebanon I": ["LB34", "LB35"], "Mount Lebanon II": ["LB36"], "Mount Lebanon III": ["LB32"], "Mount Lebanon IV": ["LB31", "LB33"],
    "North I": ["LB51"], "North II": ["LB55", "LB56"], "North III": ["LB52", "LB53", "LB54", "LB57"], "Bekaa I": ["LB25"], "Bekaa II": ["LB23", "LB24"], "Bekaa III": G_BAALBEK,
    "South I": ["LB61", "LB62"], "South II": ["LB63"], "South III": ["LB41", "LB42", "LB43", "LB44"],
}
# the Mount Lebanon / North / South governorates of 2016 and 2025 differ from the traditional ones, so a scheme is chosen per election
SCHEMES = {
    "gov5": {"Beirut": G_BEIRUT, "Mount Lebanon": G_ML_ALL, "North": G_N + G_AKKAR, "South": G_S + G_NAB, "Bekaa": G_BEKAA + G_BAALBEK},
    "gov8": {"Beirut": G_BEIRUT, "Mount Lebanon": G_ML, "Keserwan-Jbeil": ["LB34", "LB35"], "North": G_N, "Akkar": G_AKKAR, "Bekaa": G_BEKAA, "Baalbek-Hermel": G_BAALBEK, "South": G_S, "Nabatieh": G_NAB,
             "Mount Lebanon (incl. Keserwan-Jbeil)": G_ML_ALL},
}


def election_scheme(eid):
    year = int(eid[:4])
    if year <= 2005:
        return "gov5"
    if eid.endswith("municipal"):
        return "gov8"
    return None


def district_cazas(eid, district):
    sch = election_scheme(eid)
    if sch:
        return SCHEMES[sch].get(district, [])
    return DISTRICT_CAZAS.get(district, [])
