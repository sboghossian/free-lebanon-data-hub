"""Companies tab (v10, LEG B; v11 adds Lebanese abroad): Beirut-listed companies, Lebanese-led companies abroad (map and table) with revenue of those listed abroad, startups and exits, family businesses, banks.
Data: research/hub/companies/{listed,abroad,startups,family}.jsonl, family_checked.json, banks.json (see research/hub/README-CO.md).
Files: data/companies/{listed,abroad,startups,family,banks}.json (what the tab loads) and the CSVs behind them (data/csv/companies-*.csv, data/csv/series/companies-banks*.csv).
Every list is ranked by ONE stated public metric; there is no blended score. No source states a licence, so only facts (numbers, names, dates) are published, each with its source URL.
Startups and abroad companies that do not clearly meet the inclusion rule (`inclusion: unverified`) are left out of the files and counted in `excluded`.
JS: build/js/tab_companies.js, CSS build/css/tab_companies.css."""
import json, os, re
from hub.lib import stub_panel
from hub.emit_mideast import names_table

TAB = {"id": "companies", "label": "Companies", "order": 67, "routes": []}   # #companies, #companies/<view>
LIC = "Facts only, with attribution: the sources state no licence. Hub compilation: CC BY-SA 4.0"
GRANT = re.compile(r"grant|award|equity-free", re.I)
SRC = "Beirut Stock Exchange, SEC EDGAR, Wamda, Forbes Middle East, Association of Banks in Lebanon, banks' own statements (see each row)"


def _jl(path):
    if not os.path.exists(path):
        return []
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]


def _jd(path):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}


def _listed(rows):
    out = []
    for r in rows:
        out.append({"ticker": r["ticker"], "name": r["name"], "issuer": r["issuer"], "sector": r.get("sector"), "type": r["type"], "price": r.get("price"), "price_date": r.get("price_date"),
                    "price_basis": "traded" if str(r.get("price_kind", "")).startswith("traded") else "previous", "market_cap_usd": r.get("market_cap_usd"),
                    "shares": r.get("shares_outstanding"), "shares_as_of": r.get("shares_as_of"), "price_change_pct": r.get("price_change_pct"), "price_history": r.get("price_history"),
                    "source": r["source"], "shares_source": r.get("shares_source"), "confidence": r.get("confidence"), "shares_confidence": r.get("shares_confidence")})
    return out


def _startups(rows):
    keep, out = [s for s in rows if s.get("inclusion") != "unverified"], []
    for s in keep:
        rounds = [{"date": r.get("date"), "round": r.get("round"), "amount": r.get("amount") if r.get("currency") == "USD" else None, "grant": bool(GRANT.search(r.get("round") or "")),
                   "investors": r.get("investors") or [], "source": r.get("source")} for r in s["rounds"]]
        total = sum(r["amount"] or 0 for r in rounds if not r["grant"])      # grants and awards are not equity: the research does not count them either
        assert total == (s.get("disclosed_equity_funding_usd") or 0), (s["name"], total, s.get("disclosed_equity_funding_usd"))
        exits = [{"date": e.get("date"), "kind": e.get("kind"), "acquirer": e.get("acquirer"), "value": e.get("value") if e.get("value_currency") == "USD" else None, "source": e.get("source")} for e in s["exits"]]
        out.append({"name": s["name"], "founded": s.get("founded"), "founded_in": s.get("founded_in"), "hq": s.get("hq"), "sector": s.get("sector"), "inclusion": s["inclusion"], "inclusion_source": s.get("inclusion_source"),
                    "funding_usd": total, "rounds": rounds, "exits": exits, "self_reported": bool(s.get("self_reported")), "source": s["source"], "disclosure": s.get("disclosure")})
    return out, len(rows) - len(keep)


def _abroad(rows):
    keep = [a for a in rows if a.get("inclusion") != "unverified"]
    out = []
    for a in keep:
        fy = [{k: f.get(k) for k in ("fiscal_year", "period_end", "revenue", "net_income", "total_assets", "total_equity", "form", "filed", "confidence", "source")} for f in a.get("fiscal_years", [])]
        ex = a.get("exit")
        out.append({"name": a["name"], "status": a.get("status"), "ticker": a.get("ticker"), "exchange": a.get("exchange"), "listed_since": a.get("listed_since"), "founded": a.get("founded"),
                    "founded_in": a.get("founded_in"), "hq": a.get("hq"), "sector": a.get("sector"), "inclusion": a.get("inclusion"), "inclusion_source": a.get("inclusion_source"), "fiscal_years": fy,
                    "exit": {"date": ex.get("date"), "acquirer": ex.get("acquirer"), "value": ex.get("value")} if ex else None, "source": a["source"], "confidence": a.get("confidence")})
    return out, len(rows) - len(keep)


ROLES = {"founder": "founder", "co-founder": "founder", "ceo": "ceo", "chair": "exec", "executive": "exec"}


def _diaspora(rows):
    """Compact rows for the Lebanese-abroad map and table (research/hub/companies/diaspora.jsonl, built by build/diaspora_merge.py). Origin is as a source states it; nothing is guessed from a name."""
    out = []
    for r in rows:
        if not r.get("hq_country_iso3") or r["hq_country_iso3"] == "LBN" or r.get("origin") not in ("born_in_lebanon", "lebanese_citizen", "lebanese_descent"):
            continue
        out.append({"c": r["company"], "ca": r.get("company_ar") or "", "cf": r.get("company_fr") or "", "i": r["hq_country_iso3"], "h": r.get("hq_city") or "", "f": r.get("founded"), "s": r.get("industry") or "",
                    "k": r.get("kind") or "established", "p": r["person"], "r": ROLES.get((r.get("role") or "").lower(), "exec"), "rl": r.get("role") or "", "y": r.get("role_years") or "", "o": r["origin"],
                    "q": r.get("origin_quote") or "", "oq": r.get("origin_source") or "", "u": [u for u in dict.fromkeys(r.get("sources") or []) if u.startswith("http")], "st": r.get("status") or ""})
    for x in out:                       # a company that Wikidata calls a startup and a founder that is also a CEO keep one row each: (company, person, role)
        if x["ca"] == x["c"]:
            x["ca"] = ""
        if x["cf"] == x["c"]:
            x["cf"] = ""
    return out


def _family(rows, checked):
    out = []
    for r in rows:
        out.append({"year": r["year"], "rank": r["rank"], "group": r["group"], "sector": r.get("sector"), "list": r.get("list"), "country_on_list": r.get("forbes_country"), "established": r.get("forbes_established"),
                    "origin": r.get("origin"), "verdict": r.get("origin_verdict"), "source": r.get("entry_source") or r["source"], "list_source": r["source"],
                    "origin_sources": [c["source"] for c in r.get("origin_check") or []]})
    ch = [{"group": c["group"], "sources": c.get("sources") or []} for c in (checked.get("checked_not_lebanese_origin") or [])]
    return out, ch


def _banks(b):
    ser = [{"id": s["id"], "label": s["label"], "unit": s["unit"], "freq": s["freq"], "source_url": s["source"], "license": s.get("license"), "points": s["points"], "confidence": s.get("confidence")} for s in b.get("sector_series", [])]
    keys = ("fiscal_year", "total_assets_usd_million_derived", "customer_deposits_usd_million_derived", "total_equity_usd_million_derived", "net_result_usd_million_derived",
            "total_assets_lbp_million", "customer_deposits_lbp_million", "total_equity_lbp_million", "net_result_lbp_million")
    per = [{"bank": p["bank"], "ticker": p.get("bse_ticker"), "source": p["source"], "confidence": p.get("confidence"), "years": [{k: y.get(k) for k in keys} for y in p["years"]]} for p in b.get("per_bank", [])]
    facts = [{"item": f["item"], "as_of": f["as_of"], "value": f.get("value"), "source": f["source"]} for f in b.get("sector_facts", []) if f.get("value") is not None]
    return ser, per, facts


def emit(ctx):
    d = ctx.hub_research + "companies/"
    panel = stub_panel("companies", "Companies", "Lebanese companies and what the public record says about them: the Beirut Stock Exchange, companies listed abroad, startups and exits, family businesses and banks. Every list is ranked by one stated metric.",
                       "No company data is in this build yet. When it is, the lists and charts appear here.")
    listed, abroad_raw, st_raw, fam_raw = (_jl(d + n + ".jsonl") for n in ("listed", "abroad", "startups", "family"))
    banks = _jd(d + "banks.json")
    if not (listed or st_raw or banks):
        return {"panel": panel, "inline": {}}
    L = _listed(listed)
    S, st_out = _startups(st_raw)
    A, ab_out = _abroad(abroad_raw)
    F, F_ch = _family(fam_raw, _jd(d + "family_checked.json"))
    ser, per, facts = _banks(banks)
    DI = _diaspora(_jl(d + "diaspora.jsonl"))
    DLIC = "Wikidata: CC0 1.0. Wikipedia and press: facts only, linked. Hub compilation: CC BY-SA 4.0"
    ctx.write_json("companies/diaspora.json", {"names": names_table(ctx.hub_research + "world/", {r["i"] for r in DI} | {c["iso3"] for c in _jd(ctx.hub_research + "world/ne-110m.json").get("countries", [])}), "rows": DI}, f"Companies: {len(DI)} Lebanese-led companies headquartered abroad", "Wikidata, English Wikipedia, press (see each row)", DLIC, rows=len(DI))
    ctx.write_csv("csv/companies-diaspora.csv", ["company", "hq_country_iso3", "hq_city", "founded", "sector", "kind", "person", "role", "role_years", "origin", "origin_quote", "origin_source", "sources"],
                  [[r["c"], r["i"], r["h"], r["f"], r["s"], r["k"], r["p"], r["rl"], r["y"], r["o"], r["q"], r["oq"], " ".join(r["u"])] for r in DI],
                  "Companies: Lebanese abroad, one row per company and person (origin as a source states it)", "Wikidata, English Wikipedia, press (see each row)", DLIC)
    ctx.write_json("companies/listed.json", {"as_of": max([r["price_date"] for r in L if r.get("price_date")] or [""]), "securities": L}, f"Companies: {len(L)} securities on the Beirut Stock Exchange", "Beirut Stock Exchange", LIC, rows=len(L))
    ctx.write_json("companies/abroad.json", {"companies": A, "excluded": ab_out}, f"Companies: {len(A)} Lebanese companies listed abroad", "SEC EDGAR, press (see each row)", LIC, rows=len(A))
    ctx.write_json("companies/startups.json", {"startups": S, "excluded": st_out}, f"Companies: {len(S)} startups with funding rounds and exits", "Wamda, investor portfolio pages, company pages (see each row)", LIC, rows=len(S))
    ctx.write_json("companies/family.json", {"rows": F, "checked": F_ch}, f"Companies: {len(F)} family business rankings", "Forbes Middle East Top 100 Arab Family Businesses", LIC, rows=len(F))
    ctx.series_csvs(ser, "companies-banks")      # the long-format CSV holds the series; the tab shows charts only
    ctx.write_json("companies/banks.json", {"series": ser, "per_bank": per, "facts": facts}, f"Companies: banking sector totals ({len(ser)} series) and {len(per)} banks", "Association of Banks in Lebanon, IMF, banks' own statements", LIC, rows=len(ser) + len(per))
    ctx.write_csv("csv/companies-listed.csv", ["ticker", "name", "issuer", "sector", "type", "price", "price_date", "price_basis", "market_cap_usd", "shares_outstanding", "shares_as_of", "source", "shares_source", "confidence"],
                  [[r["ticker"], r["name"], r["issuer"], r["sector"], r["type"], r["price"], r["price_date"], r["price_basis"], r["market_cap_usd"], r["shares"], r["shares_as_of"], r["source"], r["shares_source"], r["confidence"]] for r in L],
                  "Companies: Beirut Stock Exchange securities, one row each", "Beirut Stock Exchange", LIC)
    ctx.write_csv("csv/companies-abroad.csv", ["company", "fiscal_year", "revenue_usd", "net_income_usd", "total_assets_usd", "total_equity_usd", "form", "filed", "confidence", "source"],
                  [[a["name"], f["fiscal_year"], f["revenue"], f["net_income"], f["total_assets"], f["total_equity"], f["form"], f["filed"], f["confidence"], f["source"]] for a in A for f in a["fiscal_years"]],
                  "Companies: revenue by fiscal year of Lebanese companies listed abroad", "SEC EDGAR", LIC)
    ctx.write_csv("csv/companies-startups.csv", ["name", "founded", "founded_in", "hq", "sector", "inclusion", "inclusion_source", "disclosed_equity_funding_usd", "rounds", "exits", "investor_reported", "source", "disclosure"],
                  [[s["name"], s["founded"], s["founded_in"], s["hq"], s["sector"], s["inclusion"], s["inclusion_source"], s["funding_usd"], len(s["rounds"]), len(s["exits"]), s["self_reported"], s["source"], s.get("disclosure") or ""] for s in S],
                  "Companies: startups, one row each (floors: undisclosed rounds add nothing)", "Wamda, investor portfolio pages (see source)", LIC)
    ctx.write_csv("csv/companies-funding-rounds.csv", ["company", "date", "round", "amount_usd", "grant_not_equity", "investors", "investor_reported", "source"],
                  [[s["name"], r["date"], r["round"], r["amount"], r["grant"], "; ".join(r["investors"]), s["self_reported"], r["source"]] for s in S for r in s["rounds"]],
                  "Companies: startup funding rounds, one row each", "Wamda, investor portfolio pages (see source)", LIC)
    ctx.write_csv("csv/companies-exits.csv", ["company", "date", "kind", "acquirer", "value_usd", "investor_reported", "source"],
                  [[s["name"], e["date"], e["kind"], e["acquirer"], e["value"], s["self_reported"], e["source"]] for s in S for e in s["exits"]],
                  "Companies: startup exits, one row each", "Wamda, Berytech, investor portfolio pages (see source)", LIC)
    ctx.write_csv("csv/companies-family.csv", ["year", "rank", "group", "sector", "list", "country_on_list", "established_on_list", "origin_verdict", "source"],
                  [[r["year"], r["rank"], r["group"], r["sector"], r["list"], r["country_on_list"], r["established"], r["verdict"], r["source"]] for r in F],
                  "Companies: family business ranks by year (Forbes Middle East list rank)", "Forbes Middle East", LIC)
    ctx.write_csv("csv/companies-banks.csv", ["bank", "fiscal_year", "total_assets_usd_million", "customer_deposits_usd_million", "total_equity_usd_million", "net_result_usd_million", "total_assets_lbp_million", "source"],
                  [[p["bank"], y["fiscal_year"], y["total_assets_usd_million_derived"], y["customer_deposits_usd_million_derived"], y["total_equity_usd_million_derived"], y["net_result_usd_million_derived"], y["total_assets_lbp_million"], p["source"]]
                   for p in per for y in p["years"]], "Companies: per-bank figures from each bank's own statements (USD derived at LBP 89,500)", "Banks' own statements on the Beirut Stock Exchange site", LIC)
    return {"panel": panel, "inline": {"listed": len(L), "startups": len(S), "abroad": len(A), "family": len(F), "banks": len(per), "series": len(ser), "diaspora": len(DI)}}
