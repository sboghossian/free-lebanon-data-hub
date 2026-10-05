# Companies research (leg R-companies), built 2026-10-05

Files are in `research/hub/companies/`. Every record has `source` (URL), `license` (null where none is stated) and `confidence` (verified, reported or estimate). No licence is stated by any source, so only facts (numbers, names, dates) are kept, with attribution, never copied prose. Nothing here is a blended score. Each list is ranked by one stated metric.

## Ranking metric of each list
- `listed.jsonl` (25 securities of 9 issuers on the Beirut Stock Exchange). Metric: market capitalisation in USD = last price x shares outstanding, common shares only, on the BSE session of 2026-10-02. Preferred shares and GDRs carry a price but no market cap (GDR shares are already in the common count). Solidere A and B are valued on their own class. BSE's own total capitalisation that day was USD 17,963,141,932; the common caps here add to USD 17.02 billion, the difference being preferred shares and how GDRs are counted.
- `abroad.jsonl` (3 companies). No rank. Metric: revenue by fiscal year (USD, IFRS) from SEC XBRL for Anghami; net income, assets and equity are shown beside it. Investcom (delisted 2006) and Fadel Partners are context rows.
- `startups.jsonl` (57 companies). Metric: total disclosed equity funding in USD (`disclosed_equity_funding_usd`), the sum of announced round amounts that carry an amount. Grants and awards are not summed. Undisclosed rounds add nothing, so totals are floors. Exits are listed with acquirer and value where stated.
- `family.jsonl` (9 rows: 3 groups x years). Metric: rank in the Forbes Middle East Top 100 Arab Family Businesses (Forbes' own composite editorial rank, not ours). Lists for 2021 to 2026 were read; 2018 to 2020 could not be fetched.
- `banks.json`. Sector series: ABL month-end totals (assets, deposits, loans, capital), plus IMF yearly figures for 2011 to 2019. Per-bank: six listed banks, ranked by total assets (USD derived at LBP 89,500) for the latest year, from each bank's own consolidated statements only.

## Inclusion rule and flags
A company is included when it was founded in Lebanon or is headquartered there, with an independent public source. `inclusion` says which: `founded_in_lebanon`, `hq_lebanon`, or `unverified` (source does not say where it was founded or based, or says elsewhere). 28 of 57 startups meet the rule; 29 are kept as flagged leads (Berytech Fund I and II portfolio lists, French-incorporated or New York-based firms with Lebanese teams). Filter on `inclusion` before publishing.
Investor portfolio pages (MEVP, Berytech, Phoenician) are self-reported; records using them have `self_reported: true`.
HAQQ Legal AI (Wamda, 2026-02-02: Lebanon-based, USD 3 million to date) qualifies under the same rule and is listed. Disclosure: the Hub's builder works at HAQQ Legal AI.

## How the numbers were made
- Listed: BSE equities page and listed-securities page (http only). Shares outstanding come from the bank's own 2025 statements for Audi, BLC, BOB and BLOM (verified); for Solidere, Byblos, BEMO and the two cement companies they are the BSE-listed counts stated as 100 percent of capital (reported). BLC and BOB list only 33.19 and 41.90 percent of their shares, so the full count from their statements is used. Many prices are stale: only Solidere A and B and Bank of Beirut traded on 2 Oct 2026; others show the previous close and BSE gives no last-trade date.
- Price history: not available. The BSE historical page returns a server runtime error and its charts are images.
- Anghami FY2020 to FY2024 are from SEC companyfacts (verified). FY2025 revenue is the sum of three segment lines in the 20-F filed 2026-04-30 (the method reproduces 2023 and 2024 exactly); a 20-F/A of 2026-06-18 was not read.
- Banks: Audi and BLOM read from text layers; BLC, BOB, BEMO and Byblos read by eye from scanned pages. Figures are in LBP as published; USD is derived at 89,500 and is an accounting value. Byblos 2025 statements were not yet on the BSE site.

## Not in scope or not found
- Crunchbase, MAGNITT and Tracxn amounts were not used (Tracxn amounts looked wrong; it listed Egypt's Qardy as a Lebanese company).
- Family: Chalhoub (Syrian origin), Sayegh (Jaffa, Jordan), MAG, ASTRA and Nuqul were checked and are not Lebanese-origin (`family_checked.json`). Fattal is HQ Beirut since 1965 but founded in Damascus on one source and in Beirut on Forbes. Averda's second source was read only through search results.
- Banks: no sector series for 2020 to 2023 (central bank site returns 403 to scripts); no per-bank totals for unlisted banks.
- Startup dates are announcement dates; founding years differ between sources in several cases and the note says so.
