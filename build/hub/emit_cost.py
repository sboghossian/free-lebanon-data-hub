"""Cost of living tab (FE-B): the exchange rate (official and market), the minimum wage in USD and what it buys, bread, fuel, generator tariffs, CPI by category, and public money (budgets, debt, BDL reserves, banks).
Files: data/cost/fx.json, cost/prices.json, money/series.json, money/events.json and one CSV per series. JS: build/js/tab_cost.js (shared helpers in tab_fb_shared.js), CSS build/css/tab_cost.css."""
from hub.lib import stub_panel
from hub.fb_common import load_series, jd
from hub import fb_continuity

TAB = {"id": "cost", "label": "Cost of living", "order": 50, "routes": ["money"]}   # #cost, #money


def _publish(ctx, rel, prefix, series, title, source, lic):
    paths = ctx.series_csvs(series, prefix)
    ctx.write_json(rel, {"series": [dict(s, csv=c) for s, c in zip(series, paths)]}, title, source, lic, rows=len(series))


def emit(ctx):
    hub = ctx.hub_research
    panel = stub_panel("cost", "Cost of living", "What things cost in Lebanon: the exchange rate (official and market), bread, fuel, generator subscriptions, the minimum wage in US dollars, prices by category, and the public finances behind them.",
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
    return {"panel": panel, "inline": {"fx": len(fx), "prices": len(pr), "money": len(mo)}}
