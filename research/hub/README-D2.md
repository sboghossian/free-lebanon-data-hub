# D2 prices of daily life (leg D2, built 2026-10-02)

Output: `research/hub/series/D2-prices.json` (207 series, ~34,000 points, 0.9 MB). Contract: `{"series":[{id,label,unit,topic,freq,source_url,license,points,notes}]}`; extra keys `derived`, `unit_confidence`, `confidence` mark derived and weak series.
Rebuild: scratch scripts and raw downloads are in `cache/hub-D2/` (`python3 d2_make.py`; re-run `crawl.py 1|2|5` and `cpifetch.py`/`cpifetch2.py` first to refresh).

## Sources, licences, coverage
- Fuel (8 series): Ministry of Energy and Water price tables, energyandwater.gov.lb/en/prices?type=1 (petrol 95/98, diesel, kerosene) and type=5 (10 kg gas cylinder). Public ajax endpoint, polite 0.6 s pacing. 2010-10 to 2026-09, LBP per 20 L; USD variants at market rate. Licence: none stated (null).
- Generators (8): same site, type=2. Fixed fee 5 A and 10 A (printed in LBP only from Aug 2024), 20 L diesel reference, last column (reads as LBP/kWh, header says "cut hours": hypothesis). 2013-2018 values are bare numbers with no unit (hypothesis: thousand LBP). Press-sourced fixed fee and kWh points for 2022-23 and Aug 2025 (secondary).
- CPI (180): CAS dashboard data service (cas.gov.lb/economic-statistics/cpi, wp-json/cas-cpi/v2), base Dec 2013 = 100, Jan 2014 to Aug 2026. Lebanon all 12 divisions plus rent, utilities, total, YoY and MoM; 7 headline series for each of 6 governorates; education and fuel supplementary indices; 101 COICOP subclasses (bread and cereals, electricity, hospital services, ...). Licence: none stated (null).
- Minimum wage (4): decrees 8733/1996, 2008 cabinet, 7426/2012, 9129/2022, 10598/2022, 11226/2023, 13164/2024, 699/2025 (28,000,000 LBP from 1 Aug 2025). USD at official rate (1998-2026) and at market rate (2012-2026); petrol canisters per wage.
- Bread (4): Economy Ministry decisions (economy.gov.lb, NNA, LBCI, L'Orient Today, Kataeb). Medium bundle at bakery 2022-2026 (80,000 LBP from 17 Sep 2026), large bundle 2022-24, pre-2022 standard bundle.
- Public salary multiplier (1): x3 (2022-11), x7 (2023-05), x9 (2023-12), x13 (2024-12), +6 decided Feb 2026 (19 on paper).
- FX reference (2): market rate monthly = World Bank Real Time Prices via HDX (CC BY; contains ML estimates); official rate = regime table.

## Gaps and cautions
- Ministry web listing has holes in fuel: 24 Feb-21 Mar 2024, 11 May-22 Aug 2024, 9 Oct-4 Nov 2024, 16 Nov 2024-2 Jan 2025, 8 Jan-20 Feb 2025, 1-20 Oct 2025, 3 Jan-25 May 2026 (partly filled from press), 12 Aug-28 Sep 2026 (partly filled). 22 Mar-10 May 2024 filled from the DGO page. Several tables per day exist in 2022-23; the series keeps the last of each date. Four x10 typos in the ministry table were corrected and are logged in the series notes.
- Generator fixed fees are blank in the ministry table for Jan 2019-Jul 2024; the kWh column conflicts with a press figure for Aug 2025. Do not publish generator kWh numbers as verified.
- CPI: CAS publishes no data before Jan 2014 in this service. Older PDFs (1998-2007 base Dec 2007 = 100, 2008-2013) are at cas.gov.lb/statistics/historical-downloads/?type=cpi, not parsed (messy layout, rebasing needed). Food division is missing for May 2020 and a few governorate housing months in the source. Subclass indices reach millions (item re-basing): use changes, not levels.
- Min wage: nothing sourced before 1996 (value 1996-2007 is 300,000). Effective months for 2008, 2022-10 and 2024-04 are decision months. Decree 11343/2023 effect not retrieved.
- Bread weights change between decisions; the 65,000 level is assumed to hold 26 Sep 2024 to 9 Mar 2026. Salary multiplier months for 2022-11, 2024-12 and 2026-03 are lower confidence (see notes).
- USD conversions use monthly rates: +-10-15% in 2020-2023.
- Licences: ministry and CAS pages state none; this is official public data but redistribution terms are unstated. Stephane to decide before publishing.
