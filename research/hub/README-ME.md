# R-mideast: Middle East lens, research files (2026-10-05)

Region (17 economies): Lebanon, Syria, Jordan, Iraq, Israel, Palestine, Egypt, Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman, Yemen, Iran, Turkey, Cyprus. This is the Hub's working definition, not a UN or World Bank region.
Research only: nothing here is wired into the build. Raw downloads and build scripts are in `cache/v10-mideast/` (scratch).

## Files in `research/hub/mideast/`

| file | what | source | licence |
|---|---|---|---|
| `countries.json` | 17 rows: iso3, iso2, M49, names en/ar/fr, names used by World Bank, IMF, UN DESA | Natural Earth, WB, IMF, UN DESA | public domain / short labels |
| `fdi-positions.json` | direct investment positions by counterpart, 2009-2024, US$ million; 1,144 series | IMF DIP (api.imf.org SDMX) | IMF copyright terms, access PUBLIC_OPEN. **redistribute:false** |
| `migrants-od.json` | 143 origin-destination pairs among the 17 plus Lebanese-born by 76 destinations and 20 world regions, 1990-2024 (8 years) | UN DESA International Migrant Stock 2024, Table 1 | CC BY 3.0 IGO |
| `refugees-hosts.json` | Syrian refugees in LBN, JOR, TUR, IRQ, EGY 2011-2025, per 1,000 residents, Lebanon's share and rank | UNHCR population API; population from `world/indicators/W2-SP.POP.TOTL.json` | CC BY-IGO (UNHCR, via HDX); WB CC BY 4.0 |
| `ucdp-events.json` | 2,385 events located in Lebanon, 1989-2024, compact columns | UCDP GED 25.1 | CC BY 4.0 |

`research/85-regional-shocks.timeline.jsonl`: 20 rows, same 13 keys as file 84, tracks that exist elsewhere. 11 carry `dup_of` (exact existing title, better date or source), 9 are new.

## Things to know before using the numbers
- **FDI units**: the IMF API returns US dollars although it tags SCALE=6. Converted to millions. Check: USA outward position in Canada 2023 = 426,255 (USD 426 bn).
- **FDI side**: use partner-reported rows (counterpart LBN, dv_type O) for origin. Lebanon's own report has gaps. IMF aggregates (G001 World, U150 Europe, GX451 Persian Gulf) overlap with countries: never sum a column. Largest 2022 partner-reported outward positions in Lebanon: France 1.1 bn, Luxembourg 0.35 bn, Germany 0.31 bn, USA 0.30 bn (US$ million in file).
- **IMF terms page** refused script access (403), so the terms were not read. File is flagged `redistribute:false`, like WEO. Orchestrator decides.
- **Migrants**: stocks at 1 July, not flows. A missing pair is unreported, not zero (no Jordan-Lebanon pair, for instance). The 2024 Syrian stock in Lebanon (784,884) equals UNHCR's end-2023 figure.
- **Refugees**: Lebanon's UNHCR series is a registered stock; registration was suspended in May 2015. Per capita uses total population, which already includes refugees. 2025 falls to 532,357; cause not isolated.
- **UCDP**: only events located in Lebanon. 2024 holds 1,114 events and 4,339 best-estimate deaths. No qualifying events in 2004, 2007, 2009-2010, 2019, 2021-2022: a coding threshold, not calm. GED 25.1 stops at 2024.
- **Timeline**: sources were read as search results plus a few full pages (Press TV copy, CSIS, Al Jazeera 2015). Rows marked 📣 rest on one family of sources. 2026 rows were checked against NPR, CNN and Times of Israel pages only through search summaries.

## Not obtained
- Tourists by nationality (no machine-readable table; cas.gov.lb and mot.gov.lb 404 per scout).
- Product-level WITS trade for neighbours (not in scope here; WITS has no open licence).
- Captagon seizure series, Iraq fuel volumes, Egypt gas volumes: no open dataset. Events only.
- UNRWA fields, Arab Barometer: not requested in this leg.
- Jordan electricity supply to Lebanon: planned 8 Sep 2021, no delivery source found, so no row.

## Refresh
`python3 cache/v10-mideast/build_{ucdp,ref,mig,fdi,tl}.py` after re-downloading: `ged251-csv.zip`, `ims.xlsx`, `unhcr.py` output, IMF XML (`dip_lbn.xml`, `dip_mirror.xml`, see build_fdi.py for the keys).
