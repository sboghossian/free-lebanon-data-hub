# P: place population and Arabic names (2026-10-02)

Files in `research/hub/villages/`, places contract `{pcode,name,name_ar,adm1,adm2,attr,year,source,license}`, validated with python3 (0 bad records).
- `P-population.jsonl` (4,369): 2,931 gazetteer places with `resident_estimate`; 1,385 places and 80 unmatched voter-list localities (`kind: voter_list_locality`) with `registered_voters_2014`; 26 caza records; 11 governorate records (2004, 2007).
- `P-arabic-names.jsonl` (721): Arabic names for places that had none in D4-places (1,353 lacked one; 632 still do).

## What the numbers are
Lebanon has had no census since 1932. Nothing here is a count of residents.
- `registered_voters_2014`: voters on the Interior Ministry lists issued on disc in 2014, per town (1,465 lists, incl. female/male). Transcribed by lub-anan.com (no licence stated; facts only, names of individuals not taken). Label: registered voters, not residents. The sum of the 1,465 lists is 3,547,965 against the published 3,514,588: 26 sections are also listed inside a parent town (flagged in `registered_voters_note`), so do not sum places.
- `registered_voters_2022_scaled_est`: the 2014 town count times the caza change in registered voters 2014 to 2022 (CAS/DGCS). An estimate, not the official 2022 figure.
- Caza records carry official caza totals for 2014, 2018, 2022 and 2025 (D8, CAS/DGCS). UNDP 2022 district counts are in `elections/2022-parliamentary.json`.
- `resident_estimate` (place): OCHA/LRP 2026 caza total (CC BY) x Kontur 2023 cadaster share (CC BY) x share inside the cadaster. Inside shared cadasters the share follows 2014 registered voters where a place has them (2,109 places), else nearest place to each Kontur hexagon (223); 599 places are alone in their cadaster. `caza_calibration_factor` shows how far Kontur alone sits from the caza total (0.41 Marjaayoun to 4.17 Akkar), and `resident_estimate_kontur2023_uncalibrated` keeps the raw value. Confidence: low. Cadaster fields (`cadaster_resident_estimate_*`: Kontur 2023, NPMPLT 2004, LandScan 2013) are firmer than the place split.
- Caza records: `resident_estimate_cas_2018_19` (CAS/ILO LFHLCS Table 1.1, rounded to 100, copyright CAS/ILO, excerpt with source), LRP 2025/2026 totals, Kontur 2023, NPMPLT 2004 and LandScan 2013 sums. Governorates: CAS 2004 (survey, PDF) and 2007 (reported via a secondary copy of Lebanon in Figures 2008, not checked against the primary).

## Arabic names
Sources, in order: GeoNames alternate names (CC BY 4.0, 716), lub-anan.com (4), Wikidata (CC0, 1). Only names verified by a Latin-name match plus coordinates are kept (confidence high, 716; medium 4; disputed 1, the other source is listed in `name_ar_other_sources`). Coordinate-only matches were tested and dropped: they returned the neighbouring district (e.g. Sassine returned Achrafieh).
- OCHA P-code lists, CIB municipality names and OSM-HOT were already used by D4; re-checking added nothing.
- Arabic Wikipedia geosearch (`cache/hub-P/p5_arwiki.py`) returned HTTP 429 on every call (shared limit), so it was not run. Rerun later for the 632 left.

## Not found / not done
- Per-town registered voters for 2018 and 2022: the ministry lists are per-person search or disc-only, and the L'Orient Today town map (2022) blocks scripts. Not obtained.
- OCHA COD-PS and UNFPA have no Lebanon subnational file (COD-PS global lacks LBN). CAS 2004 and 2007 by caza: only governorate tables found.
- Places not in the gazetteer, hamlets and neighbourhoods inside shared cadasters often get no `resident_estimate` (note field says why).

## Refresh
`cache/hub-P/`: `scrape_lub.py` (lub-anan, 1,465 pages, ~25 min), `p2_ar_geonames.py`, `p3_ar_wikidata.py` (needs `wd.json` from the Wikidata SPARQL endpoint), `p4_voronoi.py` (venv in `cache/hub-D4/venv`), `p5_arwiki.py`, then `p7_build.py` and `p8_pop.py`. Raw: `lub_towns.jsonl`, `ilo.txt`, `cas2004.txt`.
