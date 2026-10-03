"""D7 builder, part 2: World Bank WDI/GFDD + Ministry of Finance debt overview (end 2011-2024)."""
import json, os
C = os.path.join(os.environ.get("HUB_ROOT", "."), "cache/hub-D7")
S = []
WB_LIC = "CC BY 4.0"


def add(id, label, unit, freq, src, lic, pts, notes=""):
    pts = [[t, v] for t, v in pts if v is not None]
    if pts:
        S.append(dict(id=id, label=label, unit=unit, topic="public-money", freq=freq, source_url=src,
                      license=lic, points=pts, notes=notes))


wb = json.load(open(f"{C}/wb.json"))
WBU = "https://api.worldbank.org/v2/country/LBN/indicator/"
spec = [
    ("FI.RES.TOTL.CD", "d7-wb-reserves-total", "Total reserves incl. gold", "USD million", 1e6, ""),
    ("FI.RES.XGLD.CD", "d7-wb-reserves-excl-gold", "Total reserves minus gold", "USD million", 1e6, ""),
    ("FI.RES.TOTL.MO", "d7-wb-reserves-months-imports", "Total reserves in months of imports", "months", 1, ""),
    ("DT.DOD.DECT.CD", "d7-wb-external-debt", "External debt stocks, total", "USD million", 1e6, "Includes private nonguaranteed debt and short-term debt."),
    ("DT.DOD.DPPG.CD", "d7-wb-external-debt-ppg", "External debt stocks, public and publicly guaranteed", "USD million", 1e6, ""),
    ("DT.DOD.DPNG.CD", "d7-wb-external-debt-png", "External debt stocks, private nonguaranteed", "USD million", 1e6, ""),
    ("DT.DOD.DECT.GN.ZS", "d7-wb-external-debt-pct-gni", "External debt stocks", "% of GNI", 1, ""),
    ("DT.TDS.DECT.CD", "d7-wb-external-debt-service", "Debt service on external debt, total", "USD million", 1e6,
     "Actual payments made; Eurobond payments stopped in March 2020."),
    ("DT.TDS.DECT.EX.ZS", "d7-wb-debt-service-pct-exports", "Total external debt service", "% of exports of goods, services and primary income", 1, ""),
    ("GC.REV.XGRT.GD.ZS", "d7-wb-revenue-pct-gdp", "Government revenue excluding grants", "% of GDP", 1,
     "WDI central government series (IMF GFS based)."),
    ("GC.TAX.TOTL.GD.ZS", "d7-wb-tax-revenue-pct-gdp", "Tax revenue", "% of GDP", 1, "WDI central government series."),
    ("GC.XPN.TOTL.GD.ZS", "d7-wb-expense-pct-gdp", "Government expense", "% of GDP", 1,
     "WDI central government series; values after 2019 are affected by the collapse of the exchange rate."),
    ("GC.NLD.TOTL.GD.ZS", "d7-wb-net-lending-pct-gdp", "Net lending (+) / net borrowing (-)", "% of GDP", 1, "WDI central government series."),
    ("GC.XPN.INTP.CN", "d7-wb-interest-payments-lbp", "Interest payments (central government)", "LBP billion", 1e9, "Debt service on public debt, interest only."),
    ("GC.XPN.INTP.RV.ZS", "d7-wb-interest-pct-revenue", "Interest payments", "% of revenue", 1, ""),
    ("FM.LBL.BMNY.CN", "d7-wb-broad-money-lbp", "Broad money", "LBP billion", 1e9, "Series ends 2017 in WDI."),
    ("FM.LBL.BMNY.GD.ZS", "d7-wb-broad-money-pct-gdp", "Broad money", "% of GDP", 1, "Series ends 2017 in WDI."),
    ("GFDD.OI.02", "d7-wb-bank-deposits-pct-gdp", "Bank deposits", "% of GDP", 1, "World Bank Global Financial Development Database; ends 2017."),
    ("GFDD.DI.01", "d7-wb-private-credit-pct-gdp", "Private credit by deposit money banks", "% of GDP", 1, "GFDD; ends 2017."),
    ("GFDD.SI.04", "d7-wb-credit-to-deposits", "Bank credit to bank deposits", "%", 1, "GFDD; ends 2017."),
    ("FB.BNK.CAPA.ZS", "d7-wb-bank-capital-to-assets", "Bank capital to assets", "%", 1, ""),
    ("FB.AST.NPER.ZS", "d7-wb-bank-npl", "Bank nonperforming loans to total gross loans", "%", 1, ""),
    ("FR.INR.DPST", "d7-wb-deposit-rate", "Deposit interest rate", "%", 1, "Ends 2019."),
    ("FR.INR.LEND", "d7-wb-lending-rate", "Lending interest rate", "%", 1, "Ends 2019."),
]
for code, sid, lab, unit, div, note in spec:
    if code in wb and wb[code]["pts"]:
        add(sid, lab + " (World Bank)", unit, "yearly", WBU + code, WB_LIC,
            [(t, round(v / div, 3)) for t, v in wb[code]["pts"]],
            ("World Bank WDI/GFDD, retrieved 2026-10-02. " + note).strip())

# ---- Ministry of Finance, General Debt Overview, end 2011-end 2024 ----
MOF = "https://www.finance.gov.lb/en-us/Finance/PublicDebt/PDTS/Documents/General%20Debt%20Overview%20as%20as%2031Dec2024.pdf"
LIC = None
Y = [str(y) for y in range(2011, 2025)]
tbl = {
    "gross": [80937, 81795, 95712, 100364, 106031, 112910, 119892, 128347, 138150, 144108, 151309, 153484, 737588, 4147356],
    "dom": [49340, 50198, 56312, 61752, 65195, 70528, 74077, 77852, 87279, 89762, 93247, 91169, 91317, 69985],
    "for": [31597, 36776, 39400, 38612, 40836, 42382, 45815, 50495, 50871, 54346, 58062, 62315, 646271, 4077371],
    "loans": [4107, 3987, 3867, 3762, 3275, 3142, 3476, 3270, 3095, 3142, 3005, 3149, 34128, 207804],
    "euro": [27490, 32789, 35533, 34850, 37561, 39240, 42339, 47225, 47776, 51204, 55057, 59166, 612143, 3869567],
    "arrears": [0, 0, 0, 0, 0, 0, 0, 0, 0, 7180, 14240, 21448, 261307, 1910070],
    "rate": [1507.5] * 12 + [15000, 89500],
    "gdp": [60190, 66352, 70654, 72462, 75213, 76307, 79717, 83349, 80359, 91139, 246092, 621364, 2257806, 2728402],
    "pct": [134, 131, 135, 139, 141, 148, 150, 154, 172, 249, 235, 217, 170, 152],
    "tb": [49095, 50039, 56184, 61596, 65055, 70310, 73843, 77576, 86935, 89424, 92947, 90911, 90738, 68161],
}
mn = ("Ministry of Finance / BDL, Public Debt Directorate, General Debt Overview (end 2011 - end 2024). Foreign amounts are "
      "translated into LBP at the end-of-period rate (1,507.5 to 2022, 15,000 end-2023, 89,500 end-2024) and include accrued "
      "interest; Iraq fuel and IMF SDR are excluded. Excludes any BDL recapitalisation. ")
for k, sid, lab, extra in [
    ("gross", "d7-mof-gross-debt-lbp", "Gross public debt (domestic + foreign)", ""),
    ("dom", "d7-mof-domestic-debt-lbp", "Gross domestic debt", ""),
    ("for", "d7-mof-foreign-debt-lbp", "Gross foreign debt", ""),
    ("loans", "d7-mof-foreign-loans-lbp", "Foreign loans (bilateral, multilateral, other)", ""),
    ("euro", "d7-mof-eurobonds-lbp", "Eurobonds outstanding incl. accrued interest, in LBP at the end-of-period rate", ""),
    ("arrears", "d7-mof-eurobond-arrears-lbp", "Eurobond arrears (unpaid principal, coupons and estimated accrued interest)",
     "Zero before the March 2020 default. "),
    ("tb", "d7-mof-tbills-tbonds-lbp", "Outstanding LBP T-bills and T-bonds (incl. accrued interest)", ""),
]:
    add(sid, lab + " (MoF)", "LBP billion", "yearly", MOF, LIC, list(zip(Y, tbl[k])), mn + extra)
add("d7-mof-gross-debt-pct-gdp", "Gross public debt as % of GDP (MoF, indicative)", "% of GDP", "yearly", MOF, LIC,
    list(zip(Y, tbl["pct"])),
    "MoF indicative figure; GDP from Central Administration of Statistics (published April 2026); debt for 2020-2024 re-valued at the "
    "exchange rate used by the CAS for GDP (3,810 / 12,563 / 30,477 / 87,043 / 89,475 LBP per USD). Method may be revised.")
add("d7-mof-eurobonds-usd-derived", "Eurobonds incl. accrued interest, USD (derived: MoF LBP amount / MoF end-of-period rate)", "USD million",
    "yearly", MOF, LIC, [(y, round(e / r * 1000, 0)) for y, e, r in zip(Y, tbl["euro"], tbl["rate"])],
    "Derived by D7, not published by MoF: LBP billion / end-of-period rate. Includes accrued interest and arrears; principal is "
    "US$31,314 million per the MoF investor presentation of 27 March 2020.")
add("d7-mof-eurobond-arrears-usd-derived", "Eurobond arrears, USD (derived)", "USD million", "yearly", MOF, LIC,
    [(y, round(a / r * 1000, 0)) for y, a, r in zip(Y, tbl["arrears"], tbl["rate"]) if a],
    "Derived by D7: MoF arrears in LBP divided by the MoF end-of-period rate.")
add("d7-mof-gross-debt-usd-derived", "Gross public debt, USD at MoF end-of-period rate (derived)", "USD million", "yearly", MOF, LIC,
    [(y, round(g / r * 1000, 0)) for y, g, r in zip(Y, tbl["gross"], tbl["rate"])],
    "Derived by D7. The official rate changed to 15,000 on 2023-02-01 and 89,500 on 2024-01-31, far from the market rate in 2020-22, "
    "so only 2011-2019 and 2023-2024 are on a comparable footing.")

json.dump(S, open(f"{C}/part2_wb_mof.json", "w"))
print(len(S), "series from WB + MoF")
