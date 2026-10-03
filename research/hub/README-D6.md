# D6: the 2023-26 war in numbers

Built 2026-10-02. Files: `series/D6-war.json` (37 series), `series/D6-war-tables.json` (8 non-time tables), `villages/D6-displacement.jsonl` (584 place records, 4 attribute families). Series carry an extra `point_src` list where sources are mixed.

## Sources, licences, coverage
| What | Source | Licence | Span |
|---|---|---|---|
| Killed/injured since 2 Mar 2026 (MoPH) | WHO EMRO Lebanon Emergency Sitreps 2-30 (MoPH-PHEOC), OCHA Flash Updates 1-52, news-quoted MoPH figures compiled in Wikipedia's timeline | WHO, OCHA: none stated in the files (null); Wikipedia part CC BY-SA 4.0 | 2 Mar-17 Sep 2026, 112 killed points, 69 injured points |
| Killed/injured since 8 Oct 2023 | OCHA Flash Updates 1-49 (MoPH figures) | null | 14 Nov 2023-5 Dec 2024 |
| Displacement 2023-26 | OCHA flash updates; IOM DTM Mobility Snapshots 104-118 (ReliefWeb); IDMC GIDD and IDU (HDX); WHO sitreps (DRM/MoSA) | IDMC CC BY-IGO; others null | Nov 2023-29 Sep 2026 |
| Places | Lebanon Response Plan 2026 population package (HDX, CC BY): district displacement/returns, 408 cadasters' conflict incidents; IDMC IDU; Insecurity Insight; World Bank RDNA; UNDP/CNRS-L | as stated per record | 2023-26 |
| Health attacks | WHO SSA via sitreps; Insecurity Insight monthly sums | WHO null; II CC BY-SA 4.0 (share-alike) | Mar-Jul 2026; Oct 2023-Sep 2026 |
| Damage and loss USD | World Bank RDNA Mar 2025 and DaLA Nov 2024; UNDP+CNRS-L building assessments (south, Beirut/Mt Lebanon); CNRS-L agriculture; government statements | WB CC BY 3.0 IGO; others null | 2023-26 |
| UNIFIL | UN SG 1701 reports S/2024/222 to S/2026/566; HDX DFoM file | UN docs null; HDX CC BY-IGO | 2023-26 |
| Schools as shelters | OCHA Flash Updates (MEHE figures) | null | Mar-Jul 2026 |

## Left out on purpose (licence)
- IOM DTM datasets (HDX `lbn-iom-dtm-from-api`, village-level data): IOM's HDX terms are non-commercial, no redistribution, no derivative works. Not copied. DECISION FOR STEPHANE: I did reproduce IOM's headline totals (IDPs, returnees) as printed in OCHA flash updates and IOM's public ReliefWeb snapshots, labelled as such in each series note. Drop those 5 series (`idp_*`) if you read the terms strictly.
- ACLED (HDX `lebanon-acled-conflict-data`, "hdx-other"): redistribution terms restrictive. Not used. HDX HAPI (IOM-derived): not used.
- ReliefWeb API needs an approved appname: not used; pages were read as HTML.

## Gaps and cautions
- No World Bank RDNA exists yet for the 2026 war (Aug 2026 Economic Monitor: GDP -6.4%, inflation 17.5%). The PM's "USD 3-4 bn direct cost" is a reported statement; I did not find the World Bank text (low confidence it is a World Bank figure).
- UNDP's site refuses our client (HTTP 403, not bypassed). South Lebanon and Beirut/Mt Lebanon damage numbers come from news reprints of the release; only 6 named cadasters. Village "Aaitaroun" vs "Ainatha" differs between copies (medium confidence in Aaitaroun). No UNOSAT Lebanon 2024 or 2026 product found as open data.
- Not found: WHO sitreps after #30 (22 Jul), OCHA flash updates after #52 (31 Aug; appeal closed), exact MoPH counts 25 Sep-3 Oct 2024 and before 14 Nov 2023, IOM rounds 89-103 (Mar-Jun 2026), MoPH counts per caza, injured after 17 Aug 2026 (killed 4,386 on 17 Sep).
- MoPH counts include combatants and are revised; WHO SSA counts are revised after verification (53 killed on 24 Mar became 42 on 27 Mar).
- 2024 "injured" (18 Apr-20 Sep 2024) is derived: OCHA casualties minus deaths. 12 Dec 2024 "back in cadaster" 902,717 excluded (probable typo, a hypothesis).
- Government displaced count froze at 1,049,328 from 17 Mar to 18 Jun 2026; the IOM stock fell 844,243 to 704,445 in one week as the count was re-based. Do not chart them as one line.
- The LRP incident sheet (`conflict_incidents_*`) does not name its underlying dataset. If it is ACLED-derived, drop those 408 rows.
- Insecurity Insight counts open-source incidents only; zero months mean none recorded.

## Refresh
Scripts and raw downloads: `cache/hub-D6/`. Run `python3 build_war.py` there (reads `fu/` OCHA texts, `who/` sitrep texts, `dtm/`, HDX files, `data_manual.py`, `wiki_killed.py`). New figures: OCHA flash updates end Aug 2026, so use IOM weekly snapshots (reliefweb.int, search "Mobility Snapshot Lebanon") and MoPH; re-run `ext26.py` for new flash updates, add new WHO rows to `data_manual.py`, re-fetch Wikipedia timeline via the MediaWiki API for MoPH news figures.
