"""Electricity tab (FE-B): EDL supply hours, production and fuel imports, generators, night lights by governorate, plus the climate and fire-hotspot panel (D9).
Files: data/electricity/power.json, electricity/nightlights.json, climate/climate.json, fires/firms-lbn.json and one CSV per series. JS: build/js/tab_electricity.js, CSS build/css/tab_electricity.css.
The fires file is also read by the Strike map layer toggle (tab_electricity.js hooks the map without editing tl_map.js)."""
from hub.lib import stub_panel
from hub.fb_common import load_series, jd
from hub import fb_continuity

TAB = {"id": "electricity", "label": "Electricity", "order": 60, "routes": ["climate"]}   # #electricity, #climate


def _publish(ctx, rel, prefix, series, title, source, lic, extra=None):
    paths = ctx.series_csvs(series, prefix)
    o = {"series": [dict(s, csv=c) for s, c in zip(series, paths)]}
    o.update(extra or {})
    ctx.write_json(rel, o, title, source, lic, rows=len(series))


def emit(ctx):
    hub = ctx.hub_research
    panel = stub_panel("electricity", "Electricity", "Hours of public power, generator tariffs, production and fuel imports, and night lights seen from space, by governorate. Below them, the climate and the fire hotspots NASA has detected since 2000.",
                       "No electricity data is in this build yet. When it is, the charts and the downloadable series appear here.")
    raw, pw = load_series(hub, "D3-power")
    # two regional supply-hours points (Beirut, Bekaa; year assumed, low confidence) cite only a search-engine copy of a publication (exa.ai): left out of the public Hub until a primary source is found
    pw = [s for s in pw if s["id"] not in ("edl_supply_hours_beirut_urban", "edl_supply_hours_bekaa")]
    pw, merged = fb_continuity.merge_power(pw, hub)     # C-continuity: the supply-hours PROXY with its basis per month, the ministry's cut hours outside Beirut
    _, nl = load_series(hub, "D3-nightlights")
    _, cl = load_series(hub, "D9-climate")
    fires = jd(hub + "fires/firms-lbn.json")
    if not (pw or nl or cl or fires):
        return {"panel": panel, "inline": {}}
    inline = {"power": len(pw), "nl": len(nl), "climate": len(cl), "fires": bool(fires)}
    if pw:
        _publish(ctx, "electricity/power.json", "power", pw, f"Electricity: {len(pw)} series (EDL supply, production, fuel imports, generators, World Bank indicators)", "EDL via CAS and Open Data Lebanon, BDL, UNFCCC inventory, World Bank, press (see each series)",
                 "World Bank CC BY 4.0; EDL, CAS, BDL and press figures state no licence (shown per series)", {"events": raw.get("events", []), "notes": raw.get("notes", "")})
    if nl:
        _publish(ctx, "electricity/nightlights.json", "nightlights", nl, f"Night lights by governorate: {len(nl)} monthly series, 2012 to 2025", "World Bank Light Every Night (VIIRS DNB composites), computed for Lebanon's governorates", "ODbL 1.0 (World Bank Light Every Night)", {"notes": jd(hub + "series/D3-nightlights.json", {}).get("notes", "")})
    if cl:
        _publish(ctx, "climate/climate.json", "climate", cl, f"Climate: {len(cl)} monthly series (temperature and rain) for five places, 1940 to 2026", "Open-Meteo Historical Weather API (ERA5, Copernicus/ECMWF)", "CC BY 4.0 (Open-Meteo, Copernicus ERA5)")
    if fires:
        n = len(fires.get("cells", []))
        ctx.write_json("fires/firms-lbn.json", fires, f"Fire hotspots: {n:,} grid cells per month, 2000 to 2024", fires.get("source") or "NASA FIRMS (MODIS and VIIRS)", fires.get("license") or "NASA open data, free reuse with acknowledgement", rows=n)
        rows = [[c[0], c[1], c[2], c[3]] for c in fires.get("cells", [])]
        ctx.write_csv("csv/fires.csv", ["latitude", "longitude", "month", "hotspots"], rows, f"Fire hotspots: {len(rows):,} cells of 0.05 degrees per month, 2000 to 2024 (MODIS to 2011, VIIRS from 2012)", fires.get("source") or "NASA FIRMS", fires.get("license") or "NASA open data, free reuse with acknowledgement")
    return {"panel": panel, "inline": inline}
