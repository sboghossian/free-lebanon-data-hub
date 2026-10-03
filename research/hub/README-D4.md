# D4: places (villages, municipalities, cadasters, cazas)

Built 2026-10-02. Outputs in `research/hub/villages/`, record shape `{pcode,name,name_ar,adm1,adm2,attr,year,source,license}`. Every file validated with python3 (0 bad records).

| File | Records | What |
|---|---|---|
| `D4-places.jsonl` | 4,257 | Every gazetteer populated place (3,663 villages, 98 towns, 9 cities, 391 Beirut neighbourhoods, 79 localities, 17 camps). Attrs: `place_id`, lat/lon, `adm3` + `adm3_pcode`, `elevation_m` (+basis), `municipality` and `union` (names), `election_district`, `cadaster_pop_kontur2023`, `pop_gazetteer` (only 63 places). |
| `D4-municipalities.jsonl` | 1,009 | 1,001 CIB IMPACT municipalities + 8 from the CAS 2017 list that CIB lacks. Attrs: caza, elevation, lat/lon, union (CIB name, CAS union id and full name), cadaster pcodes, `election_district`, CIB municipal population estimate, COVID positives and 2-dose vaccinated, MoSA aid requests, municipal needs count 2020-22. |
| `D4-cadasters.jsonl` | 1,610 | COD-AB v02 cadasters (pcode = `adm3_pcode`). Kontur 2023 population, area, UNHCR-registered refugees at 31 Dec 2014 (Syrians, non-Syrians, PRS, PRL), IDPs 2014, returned refugees 2013, 2004 and 2013 population, `election_district`. |
| `D4-cazas.jsonl` | 26 | 2025 and 2026 population by group (Lebanese, Syrian, Palestinian, migrants), IDPs present and returned (31 May 2025), schools and health centres per caza. |
| `D4-displacement-idmc.jsonl` | 67 | IDMC displacement events 2025-01, 2025-04 and 2026-03 at caza, governorate or national level. Overlapping and some cumulative: never sum. |
| `D4-election-districts.jsonl` | 15 | Law 44/2017 districts, seats (sum 128), member cazas, Beirut quartiers. |

## Sources and licences
- OCHA/CAS villages list 2017, COD-AB v02 (Nov 2024), GeoNames, HOT/OSM via `research/geo/gazetteer.jsonl` (see `research/geo/README.md`): CC BY / CC BY-IGO / CC BY 4.0. Records whose gazetteer source includes OSM carry ODbL (1,711 of 4,257 places); attribution and share-alike apply.
- Elevation: GeoNames surveyed elevation (15 places) else the SRTM sample in GeoNames `dem`, matched by name within 3 km or nearest within 400 m (3,850 of 4,257 places). CIB elevation is used on municipalities.
- CIB IMPACT exports `open_data_export?Type=municipalities|covid|mosa|needs` (impact.gov.lb): no licence stated, recorded as `null`. Public-sector data, attribute IMPACT/CIB, confirm before bulk redistribution (see `research/portals/cib-README.md`).
- CAS municipality list by cadastral, 2 Apr 2017 (HDX `lebanon-municipalities-list`): CC BY. Union names (UNHABITAT) and municipality to cadaster mapping.
- INFORM Lebanon 2015 cadastral indicators (HDX `inform-lebanon-model`): CC BY. UNHCR and LandScan figures date from 2013-2014.
- Kontur Population Lebanon, 2023-11-01 H3 400 m hexagons (HDX `kontur-population-lebanon`): CC BY. Hexagon centres summed into cadasters (5,365,550 of 5,365,587 assigned). A modelled total residents figure, not a census.
- 2026 Lebanon Response Plan population package (HDX `lebanon-population-estimates-and-displacement-figures`): CC BY. Syrians from UNHCR databases (30 Jul 2025); displacement from IOM DTM Round 87 (31 May 2025), reused under the package's CC BY; Palestinians UNRWA; Lebanese from CAS/ILO 2018-19.
- IDMC IDU events (HDX `lbn-idmc-idu-events`): CC BY-IGO.
- Election districts: Law 44/2017, hand-coded by caza. Beirut quartiers and the Tyre-Zahrani name confirmed against Wikipedia (en) on 2026-10-02; seat counts are from memory and sum to 128 (confidence medium-high, elections leg should cross-check).

## Not included (licence or access)
- IOM DTM Lebanon (`lbn-iom-dtm-from-api`, MPM rounds 1-3): "non-commercial use only, no redistribution or derivative works". Not downloaded into outputs. The only DTM-derived figures are the CC BY LRP package numbers above.
- UNHCR VASyR microdata (login and scientific-use licence), HDX HAPI IDP series (IOM-derived), the ACLED-style adm3 conflict incident sheet inside the LRP package (source unstated, ACLED terms), WorldPop rasters (not needed).
- No public UNHCR registered-refugee count per cadaster after Dec 2014 was found; use `D4-cazas` (2026 planning figures) for the current picture.

## Gaps and cautions
- Saida caza (171 places, 48 municipalities) has `election_district: null`: COD-AB folds the Zahrani sub-district (votes in South II) into Saida (votes in South I) and no public cadaster list was found. Beirut Central District and the Beirut municipality are also null (note field says why). Lebanese vote where registered, not where they live.
- The May 2026 parliamentary election was postponed to 2028 (Wikipedia 2028 Lebanese general election, read 2026-10-02, not otherwise checked), so Law 44/2017 districts still apply.
- Village-level population only exists as Kontur cadaster sums (a cadaster may hold several villages) and 63 gazetteer values. Per-village census counts were not found as open data.
- 836 places have no municipality link (cadaster not in the CIB or CAS lists). 42 CIB municipalities have no CAS 2017 match (no union id). 1,009 municipalities is below the roughly 1,050 usually quoted (not verified), so some are missing.
- Displacement 2023-26 below caza level is not public under an open licence. `D4-cazas` holds the May 2025 snapshot; IDMC adds 2025 and March 2026 events.
- CIB COVID, MoSA and needs figures are 2020-2023 and unaudited. Municipality pcode is the cadaster code at its coordinates (a municipality can span several cadasters, all listed in `adm3_pcodes`).
- Wikipedia API returned 429 mid-run (shared budget); a handful of small calls were used.
- Overlaps with D8 files (`D8-caza-population-groups`, `D8-palestinian-camps`): join on caza `pcode`.

## Refresh
Scripts and raw downloads: `cache/hub-D4/` (`build/s1_cadasters.py`, `s2_munis.py`, `s3_places.py`, `s4_aggs.py`; run in that order with `cache/hub-D4/venv/bin/python` and `PYTHONPATH=build`). Re-download the HDX files and CIB exports first. Needs shapely, pandas, openpyxl.
