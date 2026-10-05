# R-trade: Lebanon trade and investment (2026-10-05)

Files in research/hub/trade/ (all JSON, validated with python3, each under 270 KB). Scripts and raw downloads: cache/trade/.

| file | content | span |
|---|---|---|
| goods-by-chapter.json | BACI value (US$) and tonnes by HS2 x flow | 1995-2024 |
| goods-by-partner.json | BACI value by partner ISO3 x flow | 1995-2024 |
| top-products.json | BACI top 25 HS6 per year and flow, HS92 labels | 1995-2024 |
| customs-chapters.json, customs-partners.json, monthly-customs.json | Lebanese Customs special trade, value and net weight | 2016 to 2026-08 (imports to 2025-12) |
| series.json | WDI trade and BoP series (topic trade) | 1960-2025 |
| investment-series.json | WDI FDI, portfolio, GFCF; UNCTAD FDI flows and stocks; IDAL projects (topic investment) | 1971-2025 |
| idal-sectors.json | IDAL supported projects by sector and year | 2003-2020 |
| vc-annual.json | startup funding headline figures, status "reported" | 2015-2025, gaps |

Reused by reference, not refetched: world/flows/W3-trade-*.json, world/indicators NE.EXP.GNFS.CD, NE.IMP.GNFS.CD, NE.TRD.GNFS.ZS, BX.KLT.DINV.WD.GD.ZS, BN.CAB.XOKA.CD, remittances, mideast/fdi-positions.json (IMF DIP), companies/startups.jsonl.

## Sources (HTTP status, sample value seen, licence)
- CEPII BACI HS92 V202601 zip (2.4 GB): 200. Lebanon 2023 imports from China US$2,097,452,891. Etalab Open Licence 2.0, cite BACI/CEPII. Republishable. Reconciled mirror data, so values differ from national and BoP figures.
- Lebanese Customs customs.gov.lb (http only, https times out): 200. ASP.NET form posts, no login. 2023 special imports US$17,517,688 thousand. No licence stated: facts with attribution only, licence null. Units "thousand"; weight read as tonnes (an inference, see check 5). Partner names are Arabic; about 130 mapped to ISO3 by hand, the rest kept in Arabic.
- World Bank WDI API: 200 for all 17 codes. Goods exports 2023 (BX.GSR.MRCH.CD) US$3,848,562,778. CC BY 4.0.
- UNCTADstat bulk US_FdiFlowsStock (7z): 200. Lebanon inflow 2024 US$1,764.119 m, 2025 2,041.797 m. CC BY 3.0 IGO per the UNCTAD Data Hub terms page, cite the UN Trade and Development Data Hub.
- IDAL investinlebanon.gov.lb yearly_statistics?year=: 200 (idal.com.lb https gives 525). 2018 supported projects US$78,546,259. No licence stated, facts only. 2008 and 2013 not published.
- Wamda PDFs (2023, 2024, 2025) and KAS/Arabnet via BLOMINVEST: 200. Lebanon 2025 US$2.8 m, 10 deals. Headline figures only. MAGNiTT reports are paid, not used.
- UN Comtrade public preview: 200 once, then 429 after 2 calls. Used only to cross-check, nothing republished. Terms not read in full, so no Comtrade value is in any file.
- Not obtained: IMF BOP and datamapper (403, terms unread), Kafalat loan statistics (page loads, 200, but the statistics tables are empty in the HTML), UNCTAD website pages (403), HS6 from Customs (not scraped; BACI covers HS6).

## Cross-checks (5 requested, 7 done)
1. Comtrade 2018 exports US$3.830 bn = WDI TX.VAL.MRCH 2018 3.830 bn (same underlying data). Match. BACI 2018 exports 4.442 bn is 16% higher. Mismatch, by design of BACI mirror reconciliation.
2. Comtrade 2022 imports 19.500 bn vs WDI TM.VAL 19.495 bn (match), Customs 19.047 bn (-2.3%), BACI 20.967 bn (+7.5%).
3. UNCTAD FDI inflow 2024 1,764 m vs WDI BX.KLT.DINV 1,843 m (+4.4%). 2023: UNCTAD 1,219 m vs WDI 655 m. 2022: 561 m vs 527 m. Mismatch in 2023; both kept as separate series, do not mix.
4. Customs 2023 exports US$2.99 bn (special trade) vs WDI customs-based 4.14 bn and BACI 4.94 bn. Mismatch: scope differs (special vs general trade, re-exports, gold).
5. Customs 2023 import net weight 11.77 m vs BACI 9.62 m tonnes (+22%). Same order, so "thousand" weight is probably tonnes, but unconfirmed. Treat tonnes as 🧪 hypothesis.
6. Imports from China 2023: Customs 2.061 bn vs BACI 2.097 bn (-1.7%). Match. Exports to UAE 2023: Customs 0.591 bn vs BACI 1.308 bn. Mismatch.
7. IDAL 2016 yearly page 58.6 m vs IDAL annual report 2016 "11 projects processed" 63.4 m. Mismatch of scope (approved versus processed).

## Gaps and caveats
- BACI ends 2024; Customs has no data before 2016 on the monthly pages (11 years offered). Customs 2026 has exports only, to August.
- BACI quantities are 0 for many gold, jewellery and diamond lines (not reported). Quantity totals are therefore lower bounds.
- FDI by sector: no free series found. FDI by origin is in mideast/fdi-positions.json (IMF, redistribute:false there).
- GFCF in WDI falls to 1.4% of GDP in 2024; this is as published and not checked against a second source.
- VC: 2016, 2018, 2019, 2020 missing. 2022 value (US$25 m) comes from a newspaper summary with no named dataset and conflicts with the 2021 KAS figure (US$16 m); treat as weak.
- Re-exports and gold dominate Lebanese exports in BACI (see top-products.json); charts should say "goods, reconciled (BACI)" and not call it the official trade balance.

## Refresh
cache/trade: wb.py + build_series.py (WDI, UNCTAD), baci_proc.py + build_goods.py (BACI zip must be re-downloaded), customs_scrape3.py + customs_proc.py (Customs, 3 parallel workers by year), idal.py. Each live call used a 0.6 s pause and UA "LebanonHub/1.0 (research)".
