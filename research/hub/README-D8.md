# D8 People and refugees (2026-10-02)

Builders: `cache/hub-D8/b1_series.py`..`b6_camps.py` (run b1, b2, b3, b4, b5, b6 in order; raw downloads are in `cache/hub-D8/`).

## Files
- `series/D8-people.json`: 79 series, ~3,250 points. Strict `{"series":[...]}`.
- `series/D8-people-extras.json`: `facts` (1932 census, 2017 camp census) and `age_pyramids_wpp2024` (9 years).
- `villages/D8-caza-population-groups.jsonl` (26 cazas, OCHA pcode LB##): Lebanese, Syrians, Palestinians, migrants, 2025 and 2026.
- `villages/D8-caza-vital-stats.jsonl` (26 cazas): births, deaths, marriages, divorces 2011-2025; registered voters 2009-2025.
- `villages/D8-palestinian-camps.jsonl` (12 UNRWA camps): 2017 census counts by nationality.
- `world/flows/D8-*.json` (4): emigrant stock 2024, immigrant stock 2024, UNHCR refugees in Lebanon 2025, UNHCR Lebanese abroad 2025.

## Sources and licences
- UN WPP 2024 (population.un.org/wpp, CC BY 3.0 IGO): population, sex, age shares, median age, fertility, life expectancy, mortality, births, deaths, net migration, 1950-2026 (2024+ projected).
- UN DESA International Migrant Stock 2024 (CC BY 3.0 IGO): emigrant and immigrant stock 1990-2024, flows by country.
- UNHCR Refugee Data Finder API (api.unhcr.org/population/v1) and Operational Data Portal (data.unhcr.org, CC BY 4.0): refugees by year 1964-2025, Syrian refugees monthly 2013-2026 (total and 4 regions), Lebanese refugees abroad.
- OCHA / LRP 2026 population package (HDX, CC BY): per-caza Lebanese, Syrian, Palestinian, migrant counts.
- UNRWA (HDX, CC BY-IGO): 2025 Q4 field total. PCBS/CAS 2017 camp census: licence not stated (null).
- CAS (cas.gov.lb) tables 1, 3, 26: vital statistics, voters, border arrivals/departures by region 1996-2025, airport passengers 1993-2025. No licence stated; credit CAS and the original source (Civil Status, General Security, BDL). Included as official statistics, with licence null.
- Reported (not primary), licence null: Ministry of Labour domestic-worker permits (via ILO, ODI), ILO estimates, Information International emigration counts (via UNDP 2023 and Nidaa al-Watan 2025).

## Caveats (read before charting)
- Lebanon has had no census since 1932. All population series are modelled estimates. WPP 2026 (5.90m) and LRP 2026 (5.37m) differ by design.
- UNHCR portal series: 2026-06 jumps from 490,424 to 889,625 (the widget now lists registered plus awaiting-registration refugees). Possible definitional break, cause unverified. Year-end 2025 (532,357) reflects de-registration and returns; LRP says 1.12m Syrians are present.
- UNRWA 2025 Q4 field total (228,274) is far below older registered figures (469,555 in 2018). Definition unverified; kept as a single separate point.
- CAS vital stats: 2025 may be provisional. The year-total sheet (births 78,764) and caza sheet (70,986) disagree for 2025, and the caza sheet total for 2011 (96,759) differs from the summary (98,490). Source error dropped: Tripoli births 2018 (122,029, a voter figure) removed. Deaths 2025 (+22% on 2024) include war and late registrations; not split.
- Border arrivals/departures count all travellers incl. Lebanese; not a tourism series. 1998 net balance anomaly is in the source.
- UN DESA stock undercounts the diaspora. No official emigration series exists.
- Migrant domestic workers: only reported figures (2010-2020 permits, ILO 250k estimate) plus IOM MPM via LRP (164,097 in 2026, preliminary).
- 1932 census totals differ between secondary sources (861,399 vs 793,396 residents); not checked against the primary report.

## Gaps and not done
- No airport data by month or by airline (not public in machine form found). General Security and ODL monthly tables not pulled.
- No UNHCR district-level Syrian counts: the portal only exposes 4 regions; district data sits in dashboards without an open API. UNRWA per-camp registered counts: UNRWA site returned 403 to scripts; only 2017 census camp counts included.
- ILO / IOM microdata, Ministry of Labour primary permit tables, and the 2022 CAS LFS emigration-intention tables (cached in `cache/portals/cas/files/`) are not yet extracted.

## Refresh
Re-run the b*.py scripts. UNHCR and WPP URLs are stable; CAS file names change each year (cache/portals/cas). LRP package: HDX dataset `lebanon-population-estimates-and-displacement-figures`.
