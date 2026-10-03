# D7 money: public finance, debt, BDL reserves, banks

Output: `series/D7-money.json` (106 series, 6,122 points, 167 KB) and `D7-money-events.json` (14 dated events: Eurobond default, IMF steps, FX regime changes).
Built 2026-10-02. All ids start with `d7-`. Series carry source URL, licence and notes; derived values say so.

## What is in it
- **Budget laws** (`d7-budget-law-*`, `-outturn-*`, `-proposal-*`): voted revenue, expenditure, deficit in LBP billion for 1998, 2000-05, 2018-20, 2022-26 (2023: expenditure only); outturns 1996-97, 1999-2000, 2003; 2009-10 government drafts. Source: MoF budget notes and Citizen Budgets.
- **Fiscal, IMF WEO** (`d7-weo-*`): general government revenue, spending, balance, primary balance, gross and net debt, GDP; 1990-2025 (debt from 2000).
- **Public debt**: MoF General Debt Overview end 2011-2024 (total, domestic, foreign, loans, Eurobonds, arrears, T-bills/T-bonds, debt/GDP), IMF Historical Public Debt 1970-2015, IMF GDD to 2024, World Bank external debt and debt service 1970-2024, central-government interest payments 1997-2024.
- **Eurobond default**: stock US$31,314m (MoF investor presentation, 27 Mar 2020); arrears and derived USD stock; events file (7, 9, 23 and 27 March 2020). Prices: 10 dated points only (see gaps).
- **BDL reserves and gold**: IMF International Liquidity, monthly 1980-01 to 2025-03 (total incl. gold, excl. gold, FX, gold value, gold ounces, SDRs, IMF position); World Bank yearly to 2024; ABL/BDL FC reserves 2023-12 to 2026-06.
- **Banks**: IMF FSI 2010-2019 (assets, deposits, loans, NPLs, capital, ROA, ROE); World Bank deposits/GDP to 2017; ABL commercial-bank balance sheet monthly 2023-12 and 2024-07 to 2026-06, weekly resident deposits to 2026-07-30.
- **IMF**: events file lists the 7 Apr 2022 staff-level agreement (46-month EFF, SDR 2,173.9m, about US$3bn, never reached the Board) and the 2022, 2025 and 2026 staff visits. No programme exists as of 2026-10-02 (Reuters, 28 Sep 2026).

## Licences
- IMF (WEO, HPD, GDD, IL, GFS, FSI): (c) IMF, PUBLIC_OPEN, terms https://www.imf.org/external/terms.htm. **Check the reuse terms before public redistribution.**
- World Bank WDI/GFDD: CC BY 4.0.
- MoF, ABL/BDL figures: licence not stated (`null`); government and association bulletins, attribution kept.
- Bond prices (BLOMINVEST, Bloomberg, L'Orient Today): `null`; a few dated quotes, cite and confirm before publishing.
- Left out: CEIC (commercial licence), Bloomberg/Refinitiv price histories.

## Cautions
- LBP series after 2019 are nominal at moving rates. The legal rate went 1,507.5 to 15,000 (1 Feb 2023) to 89,500 (31 Jan 2024). USD values built from LBP (`*-usd-derived`, ABL `*-usd`) are accounting values at that rate; only 2011-19 and 2023-24 are comparable for MoF debt.
- WEO recent years are estimates; the vintage served on 2026-10-02 is not labelled in the API.
- The World Bank expense-to-GDP series is odd after 2019 (6.3% in 2021).
- BDL changed the FX-reserve definition in January 2024; the ABL series are not comparable with older ones.
- Eurobond debt in MoF tables includes accrued interest and arrears; principal is US$31.3bn.

## Gaps
- Budget laws 1993-97, 2006-17 (MoF archive shows drafts or circulars only; the 2005 law is the last found before 2017), 2021, 2023 revenue. The 2017 law figures are only in chart images.
- Monthly BDL reserves after 2025-03 from the IMF; ABL covers 2024-07 onward with a Jan-Jun 2024 hole. Deposits 2020-23 and long monthly deposit history: BDL's statistics site returns 403 to scripts, so I did not fetch it. Stephane decides on a manual export or an agreed access route.
- Debt service on domestic debt, quarterly debt reports 2007-2022 (PDF charts, not parsed), IMF Article IV documents (imf.org returns 403 to scripts).
- Eurobond prices: no free history. 2020-23 prices absent.
- IMF datamapper and BDL are blocked; MFS and IRFCL data for Lebanon are empty in the IMF API.

## Refresh
Scripts are `D7-build-1-imf.py` to `D7-build-5-merge.py` (this folder), caches in `cache/hub-D7/`. IMF: `https://api.imf.org/external/sdmx/2.1/data/<flow>/LBN` (JSON works for WEO, HPD, GDD, IL, ER, FSIC, GFS_SOO, BOP; not MFS). World Bank: `api.worldbank.org/v2/country/LBN/indicator/<id>`. ABL bulletins: `abl.org.lb/Library/Assets/Gallery/Documents/Exe sum <Mon>-<Mon> <YYYY>.pdf` (names vary), then `pdftotext -layout`. MoF debt overview: `finance.gov.lb/en-us/Finance/PublicDebt/PDTS/`. Rerun parts 1-5 in order.
