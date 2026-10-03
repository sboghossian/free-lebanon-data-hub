# Lebanon map base: gazetteer and boundaries

Built 2026-10-01 for the Free Lebanon Data Hub strike map (brief: `tasks/v6-map-brief.md`).
Rebuild: `python3 research/geo/build_gazetteer.py` and `python3 research/geo/build_boundaries.py` (raw downloads are cached in `cache/geo/`).
Tests: `cd build && python3 -m unittest test_gazetteer`.

## Files

| File | What | Size |
|---|---|---|
| `research/geo/gazetteer.jsonl` | 15,278 places, one JSON object per line | 4.6 MB |
| `build/gazetteer.py` | `normalize(name)`, `skeleton(key)`, `lookup(name, alts, district)`, `similarity(a, b)`, `known_district(d)` | |
| `build/test_gazetteer.py` | 14 tests (about 110 name pairs) | |
| `build/geo/lbn-adm1.json` | 8 governorates, GeoJSON, 4-decimal coordinates | 43 KB |
| `build/geo/lbn-adm2.json` | 26 districts (cazas), GeoJSON, 4-decimal coordinates | 78 KB |

## Sources and licences

| Source | Used for | Licence |
|---|---|---|
| OCHA/CAS "Lebanon: Villages/Settlements" locations list, 2 May 2017 (HDX `lebanon-villages-settlements`, source: Central Administration of Statistics) | Base layer: 2,708 localities with P-codes `LBN#####`, Arabic names, coordinates, Beirut neighbourhoods | CC BY |
| GeoNames Lebanon dump `LB.zip` (geonames.org) | Alternate spellings (French, BGN, Arabic), population, camps, natural features | CC BY 4.0 |
| OCHA COD-AB Lebanon v02, valid 13 Nov 2024, reviewed 30 Oct 2025 (HDX `cod-ab-lbn`, source: Council for Development and Reconstruction) | Admin 1 (8), admin 2 (26), admin 3 (1,627 cadastral units); point-in-polygon placement; boundary files | CC BY-IGO |
| HOT/OSM "Populated Places of Lebanon", export 6 Sep 2026 (HDX `hotosm_lbn_populated_places`) | English/Arabic names and extra settlements | ODbL, (c) OpenStreetMap contributors |

Attribution is required for all four. Because OSM data is ODbL, records whose `src` contains `OSM-HOT` carry share-alike terms. Records with no `OSM-HOT` in `src` are free of it.

Considered and not used: Who's On First (`whosonfirst-data-admin-lbn`, 2015 SHP, redundant), OCHA 2015 villages shapefile (superseded by the 2017 list).

## Which list is the "P-code list"

- `pcode`: the OCHA/CAS locality code (`LBN11062`), present on 2,708 base records. Places that came only from GeoNames/OSM have none.
- `adm3_pcode`: the COD-AB cadastral unit code (numeric string, e.g. `51133`). Also on admin-3 centre records.
- `adm2_pcode`: COD-AB district code (`LB32`). Districts and governorates also appear as `kind: area` records whose `pcode` is `LB1`..`LB8` / `LB11`..`LB63`.

## Record schema

`name, alt[], lat, lon, adm1, adm2, adm3, pcode, kind, pop, src` plus extras `adm2_pcode, adm3_pcode, name_ar`.
`alt` holds Arabic spellings first, then Latin variants (max 4 + 14), with duplicates collapsed ignoring case, hyphens and spaces.
`src` joins the sources that contributed, e.g. `OCHA-CAS-2017+GeoNames+OSM-HOT`.
`adm1`/`adm2`/`adm3` are COD-AB names (district spellings such as `Marjaayoun`, `Bent Jbeil`, `El Meten`, `Sour`, `Saida`). Zahrani is folded into `Saida` in COD-AB; `lookup` accepts `Zahrani` as an alias.

## Counts

| kind | records | | kind | records |
|---|---|---|---|---|
| city | 9 | | area | 1,800 |
| town | 98 | | mountain | 1,767 |
| village | 3,663 | | river | 203 |
| locality | 79 | | other | 7,251 |
| neighbourhood | 391 | | **total** | **15,278** |
| camp | 17 | | | |

- Populated places (city to camp): 4,257. 95.7% have at least one alternate spelling (mean 2.9); 85.2% have an Arabic name.
- Merge outcome: 2,708 OCHA records; 2,297 GeoNames and 1,653 OSM records merged into them; 1,442 GeoNames-only and 65 OSM-only places added; 42 cadastral centres with no matching place added as `locality`.
- Camps: all 12 UNRWA camps (Beddawi, Burj el-Barajneh, Burj el-Shemali, Dbayeh, Ein el-Hilweh, El Buss, Mar Elias, Mieh Mieh, Nahr el-Bared, Rashidieh, Shatila, Wavel), plus Jisr el-Bacha, Tel al-Zaatar (destroyed 1976) and three others from GeoNames (`Mukhayyam ad Dikwanah`, `Mukhayyam an Nabatiyah`, `Mukhayyam Sabra`, not renamed).
- Beirut neighbourhoods: OCHA's 71 Beirut localities (Hamra, Achrafieh, Gemmayze, Verdun, Ras Beirut, Zoqaq el Blat, Minet el Hosn, and so on) plus GeoNames sections. Southern-suburb places (Haret Hreik, Ghobeire, Chiyah, Laylaki, Bourj el-Barajneh, Mreije, Jnah, Ouzai, Bir Hassan) are in the data as `Baabda`/`El Meten` places, not as neighbourhoods of `Beirut`.
- `adm1` is missing on 35 records: Anti-Lebanon ridge points on the Syrian border and a few places in the disputed Shebaa/Ghajar strip that fall outside the COD-AB polygons. 29 more points just outside the polygons take adm1/adm2 from the nearest cadastral centre within about 13 km and have `adm3: null`.

## Name matching (`build/gazetteer.py`)

`normalize(name)` folds diacritics and apostrophes, drops Arabic-article tokens (el, al, ash, ech, en, ...), unifies ch/sh, q/k/c, ou/u, y/i, ei/ey/ay/ai, double letters, e/i and o/u, strips trailing -a/-e/-eh/-iyeh, canonicalises word families (Kfar/Kfr/Kafr/Kefr, Deir/Dayr/Der, Ain/Ein/Ayn, Bint/Bent, Jabal/Jebel, Tell/Tal, Burj/Borj, Khirbet, Haret, Wadi/Oued, Beit/Bayt) and splits glued prefixes (Kfarchouba). Whole-name aliases cover exonyms (Tyre/Sour, Sidon/Saida, Tripoli/Trablus, Byblos/Jbeil, Beirut/Beyrouth, Dahieh/Dahiyeh). Arabic names are normalised separately (tashkeel, alef/ya/ta marbuta forms, ال).

`lookup(name, alts=[], district=None, kinds=None, limit=5, min_score=0.6)` returns `{score, how, place}`:
- 1.0 `exact`: same normalised name (or Arabic name); scores are scaled by 0.98 for alternate names, 0.95 for a name with qualifiers dropped ("camp", "town of"), and by a kind weight (cities and villages 1.0, areas 0.96, natural features 0.9-0.94).
- 0.86 `skeleton`: same consonant skeleton (Bint Jbeil / Bent Jubayl).
- below 0.86 `fuzzy`: similar spelling, same first consonant.
- With `district`, only places in that district or governorate are considered, in any spelling. An unrecognised district returns `[]` (use `known_district` to check). The geocoder should retry without a district rather than trust a weak match.
- Ties break by population, so Nabatieh (city) outranks the village Nabaat, which has the same normalised key. A bare name with no district can still hit several same-named villages (Khiam exists in Marjaayoun and Chouf); pass the district.

## Boundaries (`research/geo/build_boundaries.py`)

Topological simplification: rings are cut at the vertices where the set of districts sharing them changes, each arc is Douglas-Peucker simplified once (tolerance 0.0013 degrees, about 145 m), then rebuilt, so neighbouring districts keep identical borders. Governorates are dissolved from the simplified districts by cancelling shared edges, so every governorate vertex is also a district vertex. Checks: 0 self-intersections; governorate areas equal the sum of their districts; district area change at most 0.61%. Properties: `name`, `name_ar`, `pcode` (districts also `adm1`). Boundaries are the 2014-vintage CDR cadastre, not a survey of the Blue Line or the Shebaa Farms.

## Caveats

- GeoNames population figures are often stale or wrong (Aley shows 130,000); `pop` is filled on only 63 records and is indicative only.
- Natural and infrastructure features (`mountain`, `river`, `other`, `area`) come from GeoNames only and are not exhaustive. `other` includes 3,900 wadis, hills, ridges, airports, castles, monasteries and ruins.
- Merging is heuristic (same normalised name or Arabic name within 6 km, same skeleton within 2.5 km, near-identical spelling within 300 m). A 14-record sample per tier looked right apart from a couple of doubtful Arabic-tier merges (`Marj BG` into `El Marj`, `Hriq el Kfour` into `Kfour`); some near-duplicates remain unmerged (for example `Yohmor el Beqaa` and `Yohmor West Bekaa`). Not exhaustively audited.
- Two records are manual: `Dahieh` (centre = Haret Hreik, an area with no official boundary) and `Shebaa Farms` (approximate centre of a disputed area, no authoritative boundary).
- Coordinates for GeoNames-only places are GeoNames' own and can be off by a few hundred metres; GeoNames-only village names are often in French spelling (Ouadi, Deir, Chebaa). Use `alt` and `normalize`, not the display name, to match.
- Cadastral centres (`OCHA-COD-AB-adm3` records) are polygon centroids, not village centres.
