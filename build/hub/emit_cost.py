"""Cost of living tab (FE-B): the exchange rate (official and market), the minimum wage in USD and what it buys, bread, fuel, generator tariffs, CPI by category, and public money (budgets, debt, BDL reserves, banks).
Food security (v10): data/cost/food.json (WFP food prices, research/hub/series/food-wfp.json) and data/cost/ipc.json + csv/ipc.csv (IPC acute food insecurity, research/hub/food/ipc.json).
Files: data/cost/fx.json, cost/prices.json, money/series.json, money/events.json and one CSV per series. JS: build/js/tab_cost.js (shared helpers in tab_fb_shared.js), CSS build/css/tab_cost.css."""
from hub.lib import stub_panel
from hub.fb_common import load_series, jd
from hub import fb_continuity

TAB = {"id": "cost", "label": "Cost of living", "order": 50, "routes": ["money"]}   # #cost, #money


def _publish(ctx, rel, prefix, series, title, source, lic):
    paths = ctx.series_csvs(series, prefix)
    ctx.write_json(rel, {"series": [dict(s, csv=c) for s, c in zip(series, paths)]}, title, source, lic, rows=len(series))


IPC_PH = ["1", "2", "3", "4", "5", "3+"]


def _food(ctx, hub):
    """WFP food prices (one file, series ids food_<item>_<lbp|usd>_<area>) and IPC acute food insecurity (JSON for the page, CSV for the Data tab). Returns the counts, or {} when the research files are missing."""
    out = {}
    _, food = load_series(hub, "food-wfp")
    if food:
        _publish(ctx, "cost/food.json", "food-prices", food, f"Food prices: {len(food)} WFP series (retail prices, national and by governorate, LBP and US dollars)",
                 "WFP VAM market monitoring via OCHA HDX (wfp-food-prices-for-lebanon)", "CC BY-IGO (WFP, via HDX)")
        out["food"] = len(food)
    ipc = jd(hub + "food/ipc.json", None)
    if ipc and ipc.get("areas"):
        ctx.write_json("cost/ipc.json", ipc, f"IPC acute food insecurity: {len(ipc['national'])} national, {len(ipc['groups'])} group and {len(ipc['areas'])} area rows, Sep 2022 to Mar 2026",
                       ipc.get("source") or "https://data.humdata.org/dataset/lebanon-acute-food-insecurity-country-data", "CC0 (public domain), as stated on HDX", rows=len(ipc["areas"]))
        rows = []
        for lvl, key in (("national", "national"), ("group", "groups"), ("area", "areas")):
            for r in ipc.get(key, []):
                ph = r.get("phase") or {}
                cells = []
                for k in IPC_PH:
                    v = ph.get(k)
                    cells += [v[0], round(v[1] * 100, 1)] if v else ["", ""]
                tot = (ph.get("all") or [""])[0]
                rows.append([lvl, r["analysis"], r["validity"], r["from"], r["to"], r.get("group") or "", r.get("area") or "", tot] + cells)
        head = ["level", "analysis", "period_status", "from", "to", "group", "area", "people_analysed"] + [f"phase_{k.replace('+', '3plus')}_{u}" for k in IPC_PH for u in ("people", "percent")]
        ctx.write_csv("csv/ipc.csv", head, rows, f"IPC acute food insecurity in Lebanon: {len(rows)} rows (country, group and area, by analysis and period)",
                      ipc.get("source") or "https://data.humdata.org/dataset/lebanon-acute-food-insecurity-country-data", "CC0 (public domain), as stated on HDX")
        out["ipc"] = len(ipc["areas"])
    return out


def emit(ctx):
    hub = ctx.hub_research
    panel = stub_panel("cost", "Cost of living", "What things cost in Lebanon: the exchange rate (official and market), bread, fuel, generator subscriptions, the minimum wage in US dollars, prices by category, food security, and the public finances behind them.",
                       "No cost of living data is in this build yet. When it is, the charts and the downloadable series appear here.")
    _, fx = load_series(hub, "D1-fx")
    _, pr = load_series(hub, "D2-prices")
    _, mo = load_series(hub, "D7-money")
    pr, merged = fb_continuity.merge_prices(pr, hub)     # C-continuity: filled fuel and generator holes, bread, generator kWh price
    if not (fx or pr):
        return {"panel": panel, "inline": {}}
    _publish(ctx, "cost/fx.json", "fx", fx, f"Exchange rates: {len(fx)} series, LBP per USD, 1950 to 2026", "World Bank, FAOSTAT, World Bank Real Time Prices, BDL circulars (see each series)", "CC BY 4.0 / CC BY-IGO where stated; BDL decisions state no licence")
    _publish(ctx, "cost/prices.json", "prices", pr, f"Prices of daily life: {len(pr)} series (fuel, generators, bread, minimum wage, CPI)", "Ministry of Energy and Water, Ministry of Economy and Trade, WFP (HDX), Central Administration of Statistics, decrees, press copies of ministry tables where marked, World Bank (see each series)", "Official public data; most publishers state no licence (shown per series)")
    if mo:
        _publish(ctx, "money/series.json", "money", mo, f"Public money: {len(mo)} series (budgets, debt, BDL reserves, banks)", "IMF, World Bank, Ministry of Finance, Association of Banks in Lebanon (see each series)", "IMF terms apply to IMF series; World Bank CC BY 4.0; MoF and ABL state no licence")
        ev = jd(hub + "D7-money-events.json", {}) or {}
        ctx.write_json("money/events.json", ev, "Public money: dated events (Eurobond default, IMF steps, exchange-rate regime changes)", "MoF, IMF, BDL, press (see each event)", "CC BY-SA 4.0 for the compilation; facts attributed", rows=len(ev.get("events", ev) if isinstance(ev, dict) else ev))
    inline = {"fx": len(fx), "prices": len(pr), "money": len(mo)}
    inline.update(_food(ctx, hub))
    return {"panel": panel, "inline": inline}
