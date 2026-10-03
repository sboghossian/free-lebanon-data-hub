"""D7 builder, part 3: budget laws (MoF documents), Eurobond price points, events file."""
import json, os
C = os.path.join(os.environ.get("HUB_ROOT", "."), "cache/hub-D7")
OUT = os.path.join(os.environ.get("HUB_ROOT", "."), "research/hub")
S = []
MOFB = "https://www.finance.gov.lb/en-us/Finance/BI/ABDP/"


def add(id, label, unit, freq, src, pts, notes, lic=None):
    S.append(dict(id=id, label=label, unit=unit, topic="public-money", freq=freq, source_url=src,
                  license=lic, points=pts, notes=notes))


D = "https://www.finance.gov.lb/en-us/Finance/BI/ABDP/Annual%20Budget%20Documents%20and%20Process/"
bn = ("Ministry of Finance, Annual Budget Documents (budget notes, summaries, Citizen Budget editions). Budget = the budget law "
      "as voted, in LBP billion, excluding Treasury advances (e.g. to EDL) and net Treasury operations unless stated. ")
src_rev = MOFB
# law totals: year -> (revenue, expenditure, deficit)
law = {
    "2000": (5389, 8590, -3201), "2001": (4900, 9900, -5000), "2002": (5500, 9375, -3875), "2003": (6475, 8600, -2125),
    "2004": (6400, 9400, -3000), "2005": (6917, 10000, -3083), "2018": (18686.8, 23891.2, -5204.4),
    "2019": (18782.9, 23105.5, -4322.6), "2020": (13395.9, 18231, -4836), "2022": (29985, 40873, -10888),
    "2024": (308435, 308435, 0), "2025": (445214, 445214, 0), "2026": (538415, 538415, 0),
}
rev = [[y, v[0]] for y, v in law.items()]
rev.insert(0, ["1998", 4600])  # approximate, per 1998 budget report
exp = [[y, v[1]] for y, v in law.items()]
exp.insert(-3, ["2023", 199307.4])  # 2023 law total, from Citizen Budget 2024 comparison table
exp = sorted(exp, key=lambda p: p[0])
dfc = [[y, v[2]] for y, v in law.items()]
extra = ("Documents found on the MoF site cover 1997-2005 and 2018-2026 only; no budget law figures were extracted for 1993-1996, "
         "2006-2017 (MoF lists government proposals or circulars only), 2021 or 2023 revenue. ")
add("d7-budget-law-revenue", "Budget law: total budgeted revenue", "LBP billion", "yearly", src_rev, rev,
    bn + extra + "1998 is approximate (budget report: about LL 4,600 billion). 2024-2026 laws are balanced on paper (calculated deficit 0%), "
    "excluding EDL advances and other Treasury items.")
add("d7-budget-law-expenditure", "Budget law: total budgeted expenditure", "LBP billion", "yearly", src_rev, exp,
    bn + extra + "2019 is derived (revenue 18,782.9 plus deficit 4,322.6); 2023 is the 2023 law total (Citizen Budget 2024, "
    "comparison table). 2019 and 2020 laws were voted with Treasury advances to EDL on top.")
add("d7-budget-law-deficit", "Budget law: budgeted deficit (-) / surplus", "LBP billion", "yearly", src_rev, dfc,
    bn + extra + "2022 is derived (revenue 29,985 minus expenditure 40,873); the others are stated in the documents. "
    "The 2020 law also foresaw a total deficit up to LBP 7,673 billion once the EDL advance is counted.")

out_y = [["1996", 7225], ["1997", 9162], ["1999", 8452], ["2000", 8190], ["2003", 8810]]
out_r = [["1996", 3533], ["1997", 3753], ["1999", 4868], ["2000", 4089], ["2003", 6219]]
out_d = [["1997", -5409], ["1999", -3584], ["2000", -4101], ["2003", -2591]]
on = ("Outturn as reported in MoF budget reports and notes (1998 Budget Report, 2000 Budget Summary, 2001 and 2004 Budget Notes); "
      "1996-97 per BDL data quoted by the 1998 report; includes Treasury operations for 1996-97, budget only after. ")
add("d7-budget-outturn-expenditure", "Budget outturn: total expenditure", "LBP billion", "yearly", src_rev, out_y, on)
add("d7-budget-outturn-revenue", "Budget outturn: total revenue", "LBP billion", "yearly", src_rev, out_r, on)
add("d7-budget-outturn-deficit", "Budget outturn: deficit (-)", "LBP billion", "yearly", src_rev, out_d, on)
add("d7-budget-law-interest", "Budget law: budgeted interest payments", "LBP billion", "yearly", src_rev,
    [["2000", 3900], ["2001", 4300], ["2003", 4000], ["2004", 4300]],
    bn + "Debt service bill in the budget notes; later laws not extracted.")

prop = [("2009", 11389, 16304, -4915), ("2010", 12880, 19538, -6658)]
pn = ("Government draft budget as published by the MoF (2009 summary tables; 2010 tables including Council of Ministers amendments of "
      "18 June 2010). Drafts sent to Parliament, not an enacted law as far as the MoF archive shows. ")
add("d7-budget-proposal-revenue", "Budget proposal: total revenue", "LBP billion", "yearly", src_rev, [[y, r] for y, r, e, d in prop], pn)
add("d7-budget-proposal-expenditure", "Budget proposal: total expenditure", "LBP billion", "yearly", src_rev, [[y, e] for y, r, e, d in prop], pn)
add("d7-budget-proposal-deficit", "Budget proposal: deficit (-)", "LBP billion", "yearly", src_rev, [[y, d] for y, r, e, d in prop], pn)

# ---- Eurobond prices (public dated quotes) ----
BBI = "https://blog.blominvestbank.com/"
add("d7-eurobond-bbi", "BLOM Bond Index (BBI): defaulted Lebanese Eurobonds, price level", "points (cents on the dollar, ex-coupon)",
    "weekly", BBI + "wp-content/uploads/2026/09/Lebanese-Eurobonds-Trade-at-Their-Highest-Level-Since-Default-After-IMF-Visit-US-Bonds-Rise-to-Multidecade-Highs.pdf",
    [["2026-08-06", 28.72], ["2026-09-03", 29.68], ["2026-09-10", 29.57], ["2026-09-18", 29.66], ["2026-09-24", 29.80]],
    "Dated points taken from BLOMINVEST weekly bond notes (6 Aug 2026 'Lebanese Eurobonds Rally as Diplomatic Hopes Boost Market Sentiment'; "
    "3 Sep, 10 Sep and 24 Sep 2026 notes). Not a full history; BLOMINVEST publishes the BBI weekly. Licence not stated: confirm before publishing.")
add("d7-eurobond-price-press", "Lebanese Eurobond price level quoted in the press (approximate, across maturities)", "cents on the dollar",
    "monthly", "https://www.bloomberg.com/news/articles/2026-01-12/lebanese-bonds-rally-to-six-year-high-on-hopes-over-banking-law",
    [["2024-02", 6], ["2025-12", 23.5], ["2026-01-12", 28.4], ["2026-02", 30], ["2026-07-18", 25]],
    "Approximate levels quoted in articles. 2024-02 is an upper bound ('less than 6 cents', Bloomberg 12 Jan 2026); 2025-12 and 2026-01-12 "
    "from the same Bloomberg article; 2026-02 ('around 30 cents at the end of February') and 2026-07-18 ('around 25 cents') from "
    "L'Orient Today, 18 Jul 2026. Licence not stated: confirm before publishing. No free full price history exists; Eurobond prices before 2024 are not public.")

json.dump(S, open(f"{C}/part3_budget.json", "w"))
print(len(S), "series (budget + bonds)")

events = [
    {"date": "2020-03-07", "title": "Lebanon announces it will withhold payment on its US$1.2bn 6.375% Eurobond due 9 March 2020",
     "source": "https://www.finance.gov.lb/en-us/Finance/PublicDebt/Pages/Eurobonds-Restructuring-Information-for-Creditors.aspx", "type": "default"},
    {"date": "2020-03-09", "title": "US$1.2bn Eurobond matures unpaid", "type": "default",
     "source": "https://www.finance.gov.lb/en-us/Finance/PublicDebt/Pages/Eurobonds-Restructuring-Information-for-Creditors.aspx"},
    {"date": "2020-03-23", "title": "Lebanon discontinues payments on all its outstanding US$-denominated Eurobonds", "type": "default",
     "source": "https://www.finance.gov.lb/en-us/Finance/PublicDebt/Info%20for%20Creditors/Lebanon%20will%20discontinue%20payments%20on%20all%20its%20foreign%20currency%20denominated%20Eurobonds.pdf"},
    {"date": "2020-03-27", "title": "MoF investor presentation: Eurobonds of US$31,314m to be restructured; BDL FX holdings c. US$29bn in January 2020 (US$22bn liquid)",
     "type": "default", "source": "https://www.finance.gov.lb/en-us/Finance/PublicDebt/Info%20for%20Creditors/Investor%20Presentation%2027%20March%202020_Final.pdf"},
    {"date": None, "title": "Council of Ministers suspends Eurobond prescription periods until 9 March 2028", "type": "default",
     "source": "https://www.finance.gov.lb/en-us/Finance/PublicDebt/Pages/Eurobonds-Restructuring-Information-for-Creditors.aspx"},
    {"date": "2022-04-07", "title": "IMF staff-level agreement with Lebanon on a 46-month Extended Fund Facility, access SDR 2,173.9 million (about US$3 billion), subject to prior actions and Board approval; no Board approval followed",
     "type": "imf", "source": "https://www.imf.org/en/news/articles/2022/04/07/pr22108-imf-reaches-agreement-on-economic-policies-with-lebanon-for-a-four-year-fund-facility"},
    {"date": "2022-09-21", "title": "IMF staff visit: prior actions under the April 2022 agreement still pending before the Board can consider a programme", "type": "imf",
     "source": "https://reliefweb.int/report/lebanon/imf-staff-concludes-visit-lebanon-september-21-2022"},
    {"date": "2025-06-05", "title": "IMF staff concludes mission to Lebanon (press release 25/182)", "type": "imf",
     "source": "https://www.imf.org/en/news/articles/2025/06/05/pr-25182-lebanon-imf-staff-concludes-mission-to-lebanon"},
    {"date": "2026-02-13", "title": "IMF staff visit 10-13 February 2026: discussed the draft financial-gap (FSDR) law, bank resolution law amendments and a medium-term fiscal framework (press release 26/050)",
     "type": "imf", "source": "https://www.imf.org/en/news/articles/2026/02/13/pr-26050-lebanon-imf-staff-concludes-visit"},
    {"date": "2026-09-18", "title": "IMF staff visit 15-18 September 2026: welcomed bank resolution law amendments and budget management; FSDR law still to be aligned with international standards; no programme yet (press release 26/297)",
     "type": "imf", "source": "https://www.imf.org/en/news/articles/2026/09/18/pr26297-lebanon-imf-staff-concludes-visit-to-lebanon"},
    {"date": "2026-09-28", "title": "Finance Minister says Lebanon hopes for a new IMF staff-level agreement; a full programme still requires the financial gap law (Reuters)",
     "type": "imf", "source": "https://www.reuters.com/world/middle-east/lebanon-hopes-for-new-staff-level-agreement-with-imf-2026-09-28/"},
    {"date": "2023-02-01", "title": "BDL changes the official exchange rate from LBP 1,507.5 to LBP 15,000 per US dollar", "type": "fx",
     "source": "https://brite.blominvestbank.com/series/Commercial-Banks-Deposits-with-BDL-3179/"},
    {"date": "2024-01-31", "title": "Banks required (Circular 167) to convert foreign-currency balance-sheet accounts at LBP 89,500 per US dollar", "type": "fx",
     "source": "https://brite.blominvestbank.com/series/Commercial-Banks-Deposits-with-BDL-3179/"},
    {"date": "2026-01-12", "title": "Lebanese Eurobonds reach about 28.4 cents on the dollar, highest since March 2020 (Bloomberg)", "type": "market",
     "source": "https://www.bloomberg.com/news/articles/2026-01-12/lebanese-bonds-rally-to-six-year-high-on-hopes-over-banking-law"},
]
json.dump({"events": events, "note": "Dated money events (default, IMF, FX regime, bonds). Each carries a source URL. D7 leg, 2026-10-02."},
          open(f"{OUT}/D7-money-events.json", "w"), ensure_ascii=False, indent=1)
print(len(events), "events")
