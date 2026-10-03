"""Merges research/hub/series/C-continuity.json into the Cost of living and Electricity series.
Not a plugin: emit_cost.py and emit_electricity.py call merge_prices(pr, hub) and merge_power(pw, hub).

What the merge does
- fuel prices and generator fixed fees: the continuous series replace the ministry listing under the same id (so every chart, the explorer and the CSVs pick them up);
  dates or months that the ministry listing lacked and that came from press copies, aggregator copies or an inference are listed in `filled` {t: [basis, source]} and drawn with a hollow marker;
- derived series (fuel in US dollars, the generator fee in dollars, the minimum wage in petrol canisters) are recomputed with the same rule the research used, after checking that the rule
  reproduces the published points;
- bread, generator price per kWh, and the ministry's cut hours outside Beirut are added;
- the electricity supply-hours PROXY is added with `proxy: true`, its basis per month, and a short method note written for the page (the research note is long; the full method is in research/hub/series/C-continuity.json).
"""
import copy
import re

from hub.fb_common import jd, clean_series, rnd

REPLACE = {"fuel_petrol95_lbp_20l": "fuel_petrol95_lbp_20l_continuous", "fuel_petrol98_lbp_20l": "fuel_petrol98_lbp_20l_continuous", "fuel_diesel_lbp_20l": "fuel_diesel_lbp_20l_continuous",
           "fuel_lpg10kg_lbp": "fuel_lpg10kg_lbp_continuous", "gen_fixed_5a_lbp_month": "gen_metered_fixed_fee_5a_lbp_month", "gen_fixed_10a_lbp_month": "gen_metered_fixed_fee_10a_lbp_month"}
ADD_COST = ["gen_kwh_urban_lbp", "gen_kwh_rural_lbp", "bread_standard_bundle_bakery_lbp", "bread_small_bundle_bakery_lbp", "bread_large_bundle_bakery_lbp_c",
            "bread_standard_bundle_bakery_lbp_monthly_inforce", "bread_pita_800g_retail_median_wfp_lbp"]
ADD_POWER = ["gen_cut_hours_month_outside_beirut", "edl_supply_hours_ministry_outside_beirut", "edl_supply_hours_proxy_monthly", "edl_supply_hours_proxy_monthly_computed_only",
             "edl_supply_hours_proxy_yearly", "edl_gross_energy_used_gwh_m", "electricity_demand_model_gwh_m"]
SECONDARY = {"press_relay", "aggregator_relay", "inferred_bracketed"}      # a primary basis (ministry PDF or table) is not marked: the ministry itself says it
NOTES = {   # short notes written for the page; the research notes are in C-continuity.json
    "fuel": "Ministry of Energy and Water price tables. Where the ministry listing has holes, dates are filled from press and aggregator copies of the same table: hollow dots, with the source in the tooltip.",
    "gen_fee": "The fixed monthly part of the ministry's guideline tariff for metered generator subscribers. Months the ministry web table leaves blank are read from its monthly statement PDFs; hollow dots are press copies or inferred from the months either side.",
    "gen_kwh": "The ministry's guideline price per kWh for metered generator subscribers, from its monthly statements, its web table and press copies of the statements.",
    "bread_dec": "Maximum bakery price set by Ministry of Economy and Trade decisions; each value holds until the next decision. Bundle weights change between decisions, so compare a series with itself.",
    "bread_month": "The standard-bundle price in force at the end of each month, derived from the decisions. Hollow dots: months that carry a value forward over a decision we could not retrieve.",
    "bread_wfp": "Retail price, median of the shops surveyed by WFP. A market price, not a regulated one: it runs above the bakery price set by decision.",
    "cut": "Average hours of power cut per month outside Beirut, as printed in the ministry's monthly tariff statements until March 2019.",
    "hours_min": "Hours a day with any supply outside Beirut: 24 minus the ministry's cut hours. Hours with any current, not energy, so it runs above the proxy.",
    "proxy": "PROXY, NOT AN OFFICIAL SERIES. Hours of supply estimated as the energy EDL put on the grid in a month, divided by the demand full supply would meet: 24 x 0.82 x energy / demand. "
             "Months with observed energy are computed (medium confidence). The others are constrained to annual totals, extrapolated or interpolated, or taken from an official statement (low confidence). "
             "Demand after 2022 is an assumption. It measures energy, so it runs below counts of hours with any current. It tracks night lights (r = 0.92 over 86 months) and survey hours.",
    "energy": "The energy behind the proxy: observed in computed months, back-solved from the hours otherwise.",
    "demand": "Demand used by the proxy: annual figures spread over the months with the 2010 to 2018 seasonal shape. Modelled, not metered; after 2022 it is held at the 2022 level.",
}
NOTE_OF = {"fuel_petrol95_lbp_20l_continuous": "fuel", "fuel_petrol98_lbp_20l_continuous": "fuel", "fuel_diesel_lbp_20l_continuous": "fuel", "fuel_lpg10kg_lbp_continuous": "fuel",
           "gen_metered_fixed_fee_5a_lbp_month": "gen_fee", "gen_metered_fixed_fee_10a_lbp_month": "gen_fee",
           "gen_kwh_urban_lbp": "gen_kwh", "gen_kwh_rural_lbp": "gen_kwh", "bread_standard_bundle_bakery_lbp": "bread_dec", "bread_small_bundle_bakery_lbp": "bread_dec", "bread_large_bundle_bakery_lbp_c": "bread_dec",
           "bread_standard_bundle_bakery_lbp_monthly_inforce": "bread_month", "bread_pita_800g_retail_median_wfp_lbp": "bread_wfp", "gen_cut_hours_month_outside_beirut": "cut",
           "edl_supply_hours_ministry_outside_beirut": "hours_min", "edl_supply_hours_proxy_monthly": "proxy", "edl_supply_hours_proxy_monthly_computed_only": "proxy", "edl_supply_hours_proxy_yearly": "proxy",
           "edl_gross_energy_used_gwh_m": "energy", "electricity_demand_model_gwh_m": "demand"}
LABEL = {"edl_supply_hours_proxy_monthly": "Supply hours per day, PROXY (energy-equivalent, not an official series)",
         "edl_supply_hours_proxy_monthly_computed_only": "Supply hours per day, PROXY: only months with observed energy",
         "edl_supply_hours_proxy_yearly": "Supply hours per day, PROXY: yearly mean",
         "edl_gross_energy_used_gwh_m": "Energy to the grid behind the supply-hours proxy",
         "electricity_demand_model_gwh_m": "Electricity demand behind the supply-hours proxy (modelled)"}
FX_PEG = 89500   # the rate the research used for months after the last market-rate month


def _by_id(d):
    return {s["id"]: s for s in (d.get("series") or [])} if d else {}


def _prep(c, extra_keys=()):
    """One C series cleaned for publishing, keeping its extra keys, with the page note."""
    s = clean_series([c], keep_extra=("derived", "proxy", "confidence"))[0]
    s["notes"] = NOTES[NOTE_OF[c["id"]]] if c["id"] in NOTE_OF else s["notes"]
    return s


def _filled_fuel(c):
    return {t: [v.get("basis"), v.get("src") or ""] for t, v in (c.get("added_points") or {}).items() if v.get("basis") in SECONDARY}


def _filled_monthly(c):
    out = {}
    basis, src = c.get("basis") or {}, c.get("source_by_month") or {}
    for t, b in basis.items():
        if b in SECONDARY:
            out[t] = [b, src.get(t) or ""]
    return out


def _fx(pr):
    s = next((x for x in pr if x["id"] == "fx_lbp_usd_market_monthly"), None)
    return {p[0]: p[1] for p in s["points"]} if s else {}


def _derive_usd(lbp_pts, fx, filled):
    out = []
    for t, v in lbp_pts:
        out.append([t, rnd(v / (fx.get(t[:7]) or FX_PEG), 4)])
    return out


def _same(a, b, tol=2e-3):
    A = {p[0]: p[1] for p in a}
    common = [t for t in b if t in A]
    return len(common) >= 10 and all(abs(A[t] - b[t]) <= tol * max(1, abs(b[t])) for t in common)


def merge_prices(pr, hub):
    """pr: cleaned D2 prices series. Returns (series list, info dict). On any surprise the original series are kept."""
    C = _by_id(jd(hub + "series/C-continuity.json"))
    if not C:
        return pr, {}
    pr = [copy.deepcopy(s) for s in pr]
    ix = {s["id"]: s for s in pr}
    pet0 = [list(p) for p in (ix.get("fuel_petrol95_lbp_20l") or {}).get("points", [])]     # the ministry listing as it was, to check the rule against
    fx = _fx(pr)
    info = {"replaced": [], "added": [], "recomputed": []}
    filled_by = {}
    for old, new in REPLACE.items():
        c, s = C.get(new), ix.get(old)
        if not c or not s:
            continue
        ps = _prep(c)
        s["points"], s["notes"], s["source_url"] = ps["points"], ps["notes"], ps["source_url"] or s["source_url"]
        f = _filled_fuel(c) if old.startswith("fuel_") else _filled_monthly(c)
        if f:
            s["filled"] = f
        filled_by[old] = f
        info["replaced"].append(old)
    # derived US dollar series follow their pound series (same rule as the research: monthly market rate, else 89,500), only if the rule reproduces the published points
    for usd, lbp in (("fuel_petrol95_usd_market_20l", "fuel_petrol95_lbp_20l"), ("fuel_diesel_usd_market_20l", "fuel_diesel_lbp_20l"), ("fuel_lpg10kg_usd_market", "fuel_lpg10kg_lbp"),
                     ("gen_fixed_5a_usd_market", "gen_fixed_5a_lbp_month")):
        if usd in ix and lbp in ix:
            new = _derive_usd(ix[lbp]["points"], fx, filled_by.get(lbp) or {})
            if _same(new, {p[0]: p[1] for p in ix[usd]["points"]}):
                ix[usd]["points"] = new
                if filled_by.get(lbp):
                    ix[usd]["filled"] = filled_by[lbp]
                info["recomputed"].append(usd)
    # the minimum wage in petrol canisters: wage in force / last petrol 95 price of the month
    can, wage, pet = ix.get("min_wage_in_petrol_canisters"), ix.get("min_wage_private_lbp_month"), ix.get("fuel_petrol95_lbp_20l")
    if can and wage and pet and pet0:
        def last_of(points):
            last, lastt = {}, {}
            for t, v in points:
                last[t[:7]], lastt[t[:7]] = v, t
            return last, lastt

        def wage_at(m):
            cur = None
            for t, v in wage["points"]:
                if t[:7] <= m:
                    cur = v
            return cur
        last0, _ = last_of(pet0)
        old = {p[0]: p[1] for p in can["points"]}
        if all(abs(wage_at(m) / last0[m] - v) <= 2e-3 * max(1, v) for m, v in old.items() if m in last0 and wage_at(m)):
            last, lastt = last_of(pet["points"])
            ms = sorted(m for m in last if wage_at(m) and m >= "2012-01")
            can["points"] = [[m, rnd(wage_at(m) / last[m], 4)] for m in ms]
            ff = filled_by.get("fuel_petrol95_lbp_20l") or {}
            can["filled"] = {m: ff[lastt[m]] for m in ms if lastt[m] in ff}
            info["recomputed"].append(can["id"])
    for cid in ADD_COST:
        c = C.get(cid)
        if not c or cid in ix:
            continue
        s = _prep(c)
        if cid == "bread_standard_bundle_bakery_lbp_monthly_inforce":
            f = {m: ["uncertain", ""] for m in c.get("uncertain_months") or []}
            f.update({m: ["held", ""] for m in c.get("held_months") or []})
            s["filled"] = f
        s["topic"] = "cost of living"
        pr.append(s)
        info["added"].append(cid)
    return pr, info


def merge_power(pw, hub):
    C = _by_id(jd(hub + "series/C-continuity.json"))
    if not C:
        return pw, {}
    pw = [copy.deepcopy(s) for s in pw]
    have = {s["id"] for s in pw}
    added = []
    for cid in ADD_POWER:
        c = C.get(cid)
        if not c or cid in have:
            continue
        s = _prep(c)
        if cid in LABEL:
            s["label"] = LABEL[cid]
        if c.get("proxy"):
            s["proxy"] = True
        if isinstance(c.get("basis"), dict) and c["id"].startswith(("edl_supply_hours_proxy_monthly", "edl_gross", "electricity_demand")):
            if c["id"] != "electricity_demand_model_gwh_m":
                s["filled"] = {t: [b, ""] for t, b in c["basis"].items() if b != "computed"}
        pw.append(s)
        added.append(cid)
    return pw, {"added": added}
