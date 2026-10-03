"""D7 builder, part 1: IMF (WEO, HPD, GDD, IL, GFS, FSI), World Bank, MoF debt overview.
Reads caches in cache/hub-D7/. Appends series dicts to SERIES (pickled to part1.json)."""
import json, sys, os
C = os.path.join(os.environ.get("HUB_ROOT", "."), "cache/hub-D7")
sys.path.insert(0, C)
from imf import parse

SERIES = []
IMF_LIC = "© International Monetary Fund; access level PUBLIC_OPEN on the IMF data portal; terms at https://www.imf.org/external/terms.htm"
WB_LIC = "CC BY 4.0"


def add(id, label, unit, topic, freq, src, lic, pts, notes=""):
    pts = [[t, v] for t, v in pts if v is not None]
    if not pts:
        return
    SERIES.append(dict(id=id, label=label, unit=unit, topic=topic, freq=freq, source_url=src,
                       license=lic, points=pts, notes=notes))


def fnum(x, div=1.0, nd=4):
    return None if x is None else round(float(x) / div, nd)


def per(t):  # IMF period -> YYYY / YYYY-MM
    return t.replace("-M", "-") if "-M" in t else t


# ---- IMF WEO (latest via IMF SDMX API) ----
WEO = "https://api.imf.org/external/sdmx/2.1/data/WEO/LBN..A"
weo = {d["INDICATOR"]: o for d, n, o in parse(open(f"{C}/weo.json").read())}
wnote = ("IMF World Economic Outlook, latest vintage served by the IMF SDMX API on 2026-10-02. "
         "General government, calendar year. Recent years are staff estimates or projections; "
         "nominal LBP figures after 2019 are distorted by the multiple exchange rates. ")
spec = [
    ("GGR", "General government revenue", "LBP billion", 1e9, "d7-weo-revenue-lbp"),
    ("GGX", "General government expenditure", "LBP billion", 1e9, "d7-weo-expenditure-lbp"),
    ("GGXCNL", "General government net lending/borrowing (overall balance)", "LBP billion", 1e9, "d7-weo-balance-lbp"),
    ("GGXONLB", "General government primary balance", "LBP billion", 1e9, "d7-weo-primary-balance-lbp"),
    ("GGXWDG", "General government gross debt", "LBP billion", 1e9, "d7-weo-gross-debt-lbp"),
    ("GGXWDN", "General government net debt", "LBP billion", 1e9, "d7-weo-net-debt-lbp"),
    ("NGDP", "Nominal GDP", "LBP billion", 1e9, "d7-weo-gdp-lbp"),
    ("NGDPD", "Nominal GDP", "USD million", 1e6, "d7-weo-gdp-usd"),
    ("GGR_NGDP", "General government revenue", "% of GDP", 1, "d7-weo-revenue-pct-gdp"),
    ("GGX_NGDP", "General government expenditure", "% of GDP", 1, "d7-weo-expenditure-pct-gdp"),
    ("GGXCNL_NGDP", "General government net lending/borrowing", "% of GDP", 1, "d7-weo-balance-pct-gdp"),
    ("GGXONLB_NGDP", "General government primary balance", "% of GDP", 1, "d7-weo-primary-balance-pct-gdp"),
    ("GGXWDG_NGDP", "General government gross debt", "% of GDP", 1, "d7-weo-gross-debt-pct-gdp"),
    ("GGXWDN_NGDP", "General government net debt", "% of GDP", 1, "d7-weo-net-debt-pct-gdp"),
]
for code, lab, unit, div, sid in spec:
    add(sid, lab + " (IMF WEO)", unit, "public-money", "yearly", WEO, IMF_LIC,
        [(t, fnum(v, div)) for t, v in sorted(weo[code].items())], wnote)

# ---- IMF Historical Public Debt + Global Debt Database ----
hp = parse(open(f"{C}/j_HPD.json").read())[0][2]
add("d7-hpd-gross-debt-pct-gdp", "General government gross debt (IMF Historical Public Debt)", "% of fiscal-year GDP",
    "public-money", "yearly", "https://api.imf.org/external/sdmx/2.1/data/HPD/LBN", IMF_LIC,
    [(t, fnum(v)) for t, v in sorted(hp.items())],
    "IMF Historical Public Debt Database (HPD). Ends 2015; for later years see WEO and Ministry of Finance series.")
for d, n, o in parse(open(f"{C}/j_GDD.json").read()):
    nm = n["INDICATOR"]
    if "Percent of GDP" in nm and nm.startswith("Debt instruments"):
        import re as _re
        sid = "d7-gdd-" + _re.sub(r"[^a-z]+", "-", nm.replace("Debt instruments, ", "").replace(", Percent of GDP", "").lower()).strip("-")
        add(sid, nm.replace(", Percent of GDP", "") + " (IMF Global Debt Database)", "% of GDP", "public-money", "yearly",
            "https://api.imf.org/external/sdmx/2.1/data/GDD/LBN", IMF_LIC,
            [(t, fnum(v)) for t, v in sorted(o.items())], "IMF Global Debt Database, Lebanon, to 2024.")

# ---- IMF International Liquidity: BDL reserves and gold (monthly) ----
IL = "https://api.imf.org/external/sdmx/2.1/data/IL/LBN"
ilnote = ("IMF International Liquidity (IL) as reported by BDL; latest observation 2025-03 in the IMF database on 2026-10-02. "
          "Gold at market value. Includes only what Lebanon reports to the IMF; see the ABL series for 2024-26. ")
il = {}
for d, n, o in parse(open(f"{C}/x_IL.json").read()):
    if d["FREQUENCY"] == "M":
        il[(d["INDICATOR"], d["UNIT"])] = o
il_spec = [
    (("TRGMV_REVS", "USD"), "d7-bdl-reserves-total-gold-mv", "BDL total reserves incl. gold at market value", "USD million", 1e6),
    (("RXF11_REVS", "USD"), "d7-bdl-reserves-excl-gold", "BDL reserves excluding gold", "USD million", 1e6),
    (("RXF11FX_REVS", "USD"), "d7-bdl-reserves-fx", "BDL foreign exchange reserves (excl. gold, IMF position, SDRs)", "USD million", 1e6),
    (("RGOLDNV_REVS", "USD"), "d7-bdl-gold-value", "BDL gold holdings, value as reported", "USD million", 1e6),
    (("RGV_REVS", "FTO"), "d7-bdl-gold-fto", "BDL gold holdings, volume", "fine troy ounces", 1.0),
    (("TRRPIMF_REVS", "USD"), "d7-bdl-imf-reserve-position", "Reserve position in the IMF", "USD million", 1e6),
    (("RXDR_REVS", "USD"), "d7-bdl-sdr-holdings", "BDL SDR holdings", "USD million", 1e6),
]
for key, sid, lab, unit, div in il_spec:
    if key in il:
        add(sid, lab, unit, "public-money", "monthly", IL, IMF_LIC,
            [(per(t), fnum(v, div, 2)) for t, v in sorted(il[key].items())], ilnote)
ilann = {}
for d, n, o in parse(open(f"{C}/x_IL.json").read()):
    if d["FREQUENCY"] == "A" and d["INDICATOR"] == "TRGMV_REVS" and d["UNIT"] == "USD":
        ilann = o
add("d7-bdl-reserves-total-gold-mv-yearly", "BDL total reserves incl. gold at market value, year-end", "USD million",
    "public-money", "yearly", IL, IMF_LIC, [(t, fnum(v, 1e6, 2)) for t, v in sorted(ilann.items())], ilnote)

# ---- IMF GFS central government 1993-1996 ----
GFS = "https://api.imf.org/external/sdmx/2.1/data/GFS_SOO/LBN"
gl = {"G1_T": "Central government revenue", "G11_T": "Central government tax revenue",
      "G24_T": "Central government interest payable"}
for d, n, o in parse(open(f"{C}/j_GFS_SOO.json").read()):
    if d["SECTOR"] == "S1311" and d["INDICATOR"] in gl and d["TYPE_OF_TRANSFORMATION"] in ("XDC", "POGDP_PT"):
        pct = d["TYPE_OF_TRANSFORMATION"] == "POGDP_PT"
        add("d7-gfs-" + d["INDICATOR"][:-2].lower() + ("-pct-gdp" if pct else "-lbp"),
            gl[d["INDICATOR"]] + " (IMF GFS)", "% of GDP" if pct else "LBP billion", "public-money", "yearly", GFS, IMF_LIC,
            [(t, fnum(v, 1 if pct else 1e9)) for t, v in sorted(o.items())],
            "IMF Government Finance Statistics, central government excluding social security; only 1993-1996 are reported.")

# ---- IMF FSI deposit takers (annual to 2019) ----
FSI = "https://api.imf.org/external/sdmx/2.1/data/FSIC/LBN"
fs = {d["INDICATOR"]: o for d, n, o in parse(open(f"{C}/j_FSIC.json").read()) if d["FREQUENCY"] == "A"}
fnote = "IMF Financial Soundness Indicators, deposit takers (Lebanon). Last reported year 2019. "
for code, sid, lab, unit, div in [
    ("FSI283_TA_USD", "d7-banks-total-assets-usd", "Deposit takers total assets", "USD million", 1e6),
    ("FSI55_F2MC_USD", "d7-banks-customer-deposits-usd", "Deposit takers customer deposits", "USD million", 1e6),
    ("FSI303_TGF4_USD", "d7-banks-gross-loans-usd", "Deposit takers total gross loans", "USD million", 1e6),
    ("AQ12_NPF4_USD", "d7-banks-npl-usd", "Deposit takers nonperforming loans", "USD million", 1e6),
    ("AQ12_CFSI_PT", "d7-banks-npl-ratio", "Nonperforming loans to total gross loans", "%", 1),
    ("FSI688_CFSI_PT", "d7-banks-regulatory-capital-ratio", "Regulatory capital to risk-weighted assets", "%", 1),
    ("FSI626_CFSI_PT", "d7-banks-tier1-ratio", "Tier 1 capital to risk-weighted assets", "%", 1),
    ("ROA_CFSI_PT", "d7-banks-roa", "Return on assets", "%", 1),
    ("ROE_CFSI_PT", "d7-banks-roe", "Return on equity", "%", 1),
    ("FSI131_AFSI_PT", "d7-banks-fx-loans-share", "Foreign currency loans to total loans", "%", 1),
    ("FSI680_AFSI_PT", "d7-banks-fx-liabilities-share", "Foreign currency liabilities to total liabilities", "%", 1),
    ("FSI765_CFSI_PT", "d7-banks-liquid-to-st-liabilities", "Liquid assets to short-term liabilities", "%", 1),
]:
    if code in fs:
        add(sid, lab + " (IMF FSI)", unit, "public-money", "yearly", FSI, IMF_LIC,
            [(t, fnum(v, div, 3)) for t, v in sorted(fs[code].items())], fnote)

json.dump(SERIES, open(f"{C}/part1_imf.json", "w"))
print(len(SERIES), "series from IMF")
