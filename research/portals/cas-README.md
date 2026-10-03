# CAS (Central Administration of Statistics) leg

Portal: https://www.cas.gov.lb/ (Lebanese Republic, Presidency of the Council of Ministers). Fetched 2026-10-01.

## How it works
- WordPress site, redesigned mid-2026. No data API and no dashboard: statistics are downloadable files (xlsx/xls/pdf) linked from topic pages.
- `https://www.cas.gov.lb/wp-json/wp/v2/media?per_page=100&page=N` is public and lists every upload (520 items, 346 non-image) with `source_url`, date and mime type. This was the fastest way to enumerate the catalogue. Responses start with blank lines and a stray character, so strip before JSON parsing.
- Other public REST types: `survey` (14), `publications` (21), `pop-social-statistic` (43), `administrative-stats` (38), `new` (news), `useful-link`, `statistical-yearbook` (taxonomy, 11 terms 1995-2014). Fields are thin (title, link, date); the `acf` data is empty, so the files themselves are the data. `cpi-monthly-data`, `economic-statistic`, `national-accounts`, `announcement` return empty lists.
- Latest CPI is a rolling file overwritten each month: `https://www.cas.gov.lb/wp-content/uploads/cpi/latest/8-CPI_AUGUST2026.xlsx` (name changes with the month). Archive copies sit under `uploads/2024/10/CPI_2007-2026.xlsx`.
- Menus: Population & social conditions, National accounts, Economic statistics (CPI, ICP), Administrative statistics (11 themes), Publications, News, Surveys & censuses, Methodology & standards, Historical downloads.

## What is there
- 342 catalogue rows in `cas-catalogue.jsonl`: 103 spreadsheets, 174 PDFs, 35 landing pages, 29 other (microdata .sav, questionnaires, Word).
- Prices: CPI monthly Dec 2007-Aug 2026 (xlsx), older CPI PDFs 1998-2013, PPP and price-level docx 2017-2023, COICOP classification.
- National accounts: 2011-2024 tables (xlsx), PDFs 1997-2010 and 2022-2024 reports, SNA methodology.
- Administrative series (xlsx, mostly sourced from BDL, EDL, civil registry, customs): exchange rates 1964-2025, interest rates 1972-2025, BDL balance sheet 1965-2025, trade 1993-2025, arrivals 1996-2025, vital statistics 1999-2025, EDL 1995-2025, energy, cement, petroleum imports 1995-2025, car accidents 2007-2025, tobacco, banking tables 2004-2025.
- Surveys: Labour Force and Household Living Conditions 2018-19, Follow-up Labour Force Survey 2022, MICS 2009 and 2023 (sub-national), Household Budget 2004-05 and 2012, Living Conditions 2004 and 2007, PAPFAM 2004, Child Labour 2015, Palestinian camps census 2017, Census of buildings 2004, Multidimensional Poverty Index 2019, Gender report 2021.
- District statistical profiles 2018-2019: about 26 cazas, English and Arabic PDFs (south Lebanon cazas included).

## What is missing
- No consolidated population series: the last full census-type count is old; only survey-based residents figures (2009, 2018-19, 2022) and the registry.
- Labour force: only two survey points (2018-19, 2022). No annual unemployment series from CAS.
- Public debt, budget and electricity tariffs are not CAS products (Ministry of Finance, BDL).
- Statistical yearbooks 1995-2014 are listed as taxonomy only; the PDFs were not located in media. CPI 2008-2013 monthly exist as scanned PDFs, redundant with the xlsx.
- Apr-Jun 2026 CPI not in the cached files (only Mar and Jul-Aug 2026).
- 2025 trade yearly row not in the yearly sheet (series ends 2024; monthly sheet runs to 2025).

## Licence and reuse
No licence statement found on the portal or in the files. Treat as official statistics: credit "Central Administration of Statistics, Lebanon" and the original source (BDL, EDL, etc.) and link the file. Not CC-licensed. No explicit terms-of-use page found; the privacy-policy page is the only legal page linked.

## Caveats on the series
- Exchange rate 2020-2022 is the 1507.5 official peg, not the market rate.
- GDP 2023-24 in LBP reflects currency collapse; USD figure from CAS news: 30.5bn (2024), 25.9bn (2023).
- cpi_inflation_yoy is derived by us. cpi_annual_1998_2005 was read from a PDF and should be checked.

## Reproduce
Helper scripts and raw downloads are in `cache/portals/cas/` (fetch.py, dl.py, build_series.py, build_cat.py; needs the venv `v/` for xlrd/openpyxl).
