# D1 exchange rates (hub/series/D1-fx.json)

Seven series, all LBP per USD.

| id | span | freq | source | licence |
|---|---|---|---|---|
| fx_official_annual | 1950-2025 | yearly | World Bank PA.NUS.FCRF (1960+), Penn World Table 7.1 via FRED (1950-59) | CC BY 4.0 / not stated for PWT 7.1 |
| fx_official_monthly | 1970-01 to 2026-07 | monthly | FAOSTAT via HDX (lbn_faostat_exchange_rates.csv) | CC BY-IGO |
| fx_market_monthly | 2012-01 to 2026-08 | monthly | World Bank Real Time Prices via HDX, "Market Average" row | CC BY 4.0 |
| fx_sayrafa_milestones | 2021-05 to 2023-12 | 22 dated points | BDL daily press releases + press | null (BDL states none) |
| fx_bank_rate_lollar | 2020-04 to 2023-02 | 3 steps | BDL Circular 151 and amendments | null |
| fx_official_peg_steps | 1997-12 to 2024-01-31 | 3 steps | BDL decisions via Wikipedia, Credit Libanais, L'Orient Today | CC BY-SA (Wikipedia summary) |
| fx_customs_rate | 2023-05 | 1 point | ReliefWeb / Ministry of Finance | null |

## Key facts
- Peg 1,507.5 (announced Dec 1997; first month at 1,507.5 in the data is Jan 1999; to 31 Jan 2023), 15,000 from 1 Feb 2023, 89,500 from 31 Jan 2024 (decision 48/4/24 of 15 Feb 2024, applied from 31 Jan 2024). Jul-Dec 2023 official = 15,000; the 85,500 and 89,500 rates of 2023 are Sayrafa platform rates (series fx_sayrafa_milestones), corrected 2026-10-02.
- Market rate monthly average: 1,515 (Jul 2019), 8,190 (Jul 2020), 25,998 (Dec 2021), 98,265 (Mar 2023), about 89,500 since late 2023.
- Lollar bank rate: 3,900 (21 Apr 2020), 8,000 (9 Dec 2021), 15,000 (1 Feb 2023).

## Gaps and cautions
- No daily or weekly market series under an open licence was found. Commercial aggregators (lirarate, exchange-rates.org, BRITE) were not scraped.
- BDL's website returns HTTP 403 to scripted requests, so the full Sayrafa daily Excel (bdl.gov.lb/sayrafa.php) was not fetched; Sayrafa is a sparse sample. Not circumvented. Stephane could download it by hand if wanted.
- FAOSTAT monthly official has a gap from Apr 2021 to Dec 2022 (peg unchanged at 1,507.5; see annual series).
- Annual 2020-2022 official = 1,507.5; the blended FAOSTAT annual effective rates (e.g. 4,190 in 2020) are not used.
- WB market series is partly ML-estimated and revised weekly.
- Not collected: NSSF, VAT and other multiple rates, 2024-2026 intramonth moves.

## Refresh
Re-download the HDX CSVs (package ids lebanon-real-time-prices, lbn-faostat-food-prices) and the World Bank API; raw copies in cache/hub-D1/. Rebuild with cache/hub-D1/build.py.
