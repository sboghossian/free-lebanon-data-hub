# D5 Elections (hub/elections/*.json)

Built 2026-10-02. One file per election in the contract shape (`<year>-<type>.json`). The leg-id filename prefix was not used because the contract fixes these names; every file carries `source` and `license`.

## Files and coverage
| File | Level | Seats by confession | Registered / voters / turnout | Lists | Winners |
|---|---|---|---|---|---|
| 2022-parliamentary | 15 districts | yes | yes, all 15 (UNDP, sums match national) | 103 lists, votes + seats | 128 with preferential votes |
| 2018-parliamentary | 15 districts | yes | registered/voters approximate, turnout official | 77 lists, votes + seats | 128 with preferential votes |
| 2009-parliamentary | 26 qada districts | yes | yes, all 26 | none (block vote); March 14/8 seats per district | 128 with votes and affiliation, plus unsuccessful candidates |
| 2005, 2000, 1996, 1992 | 5 governorates | yes (qada allocation summed) | national only | partial, 2005 and 2000 by round | none |
| 2016-municipal | 8 governorates | n/a | Beirut only; qada turnout; 6 city races | city lists | none |
| 2025-municipal | 8 governorates | n/a | yes, all 8 (UNDP); qada turnout; Beirut list race | Beirut | none |
| 2026-parliamentary | none | n/a | n/a | n/a | n/a |

2026: not held. Parliament extended its term by two years in March 2026 (war); election now expected May 2028. IFES lists 2026-05-10 as Cancelled. Confidence: medium-high (Wikipedia plus IFES; the news article they cite was not opened).

## Sources and licences
- Wikipedia (MediaWiki API wikitext): general election pages, members-of-parliament lists 2005-2009, 2018-2022, 2022-2026, municipal pages. CC BY-SA 4.0, attribute.
- UNDP key results: 2022 parliamentary brochure (registered and actual voters per district) and 2025 municipal brochure (per governorate). Source data is the Interior Ministry. UNDP prints "Copyright, all rights reserved": only facts were taken, attributed. Stephane: confirm you are comfortable publishing those numbers.
- IFES "Elections in Lebanon" district overview (Sept 2011): 2009 registered, voters, winners, votes. No licence stated, facts only.
- IPU Parline archive (1992-2000 round facts), IDEA turnout database (national registered, voters, turnout 1992-2022), EU EOM 2005 final report, RECEF 2009 results (cross-check). No licences stated.
- Not used: elections.gov.lb (a new single-page app, no public results API found), Information International and LCPS (results behind paid or PDF-only reports not reached).

## Known issues (all flagged in each file's `notes`)
- 2018 per-district registered/voters come from a Wikipedia list and disagree with official turnout by 1 to 3 points in Mount Lebanon II, North II, Bekaa II, South III. Registered sums to 3,736,539 vs national 3,746,483. The 2018 lists table has 77 lists summing to 1,807,265 votes (it may omit small lists).
- 2022: one source row corrected (Fadi Karam, Koura, Greek Orthodox) to match the legal allocation. Ghassan Skaff (Bekaa II) is kept with a `note` that he died in office.
- 2009: Edgard Maalouf's printed vote count (88,577) is implausible and was withheld. District voters sum to 1,649,391 (50.6%) against IDEA 1,758,901 (53.98%); both are in the file. IFES affiliations are as of 2011, not ballot lists.
- 1992-2005: no per-district registered voters, turnout or winners found in a free structured source. 2005 winners exist only in a noisy Wikipedia list (130 rows, replacements mixed in) and were not used. National figures differ by source (Nohlen vs IDEA vs IPU) and the alternates are kept in `national`.
- 2016 municipal: official governorate registered/voters not found except Beirut. 2025 qada turnout (Wikipedia) differs from the Ministry final for six Bekaa and Beirut qadas; both are kept.
- Not done: municipal winners, per-municipality turnout, Interior Ministry result PDFs (moim.gov.lb 2025 results PDFs exist per governorate, in Arabic, large).

## Refresh
Scripts and raw downloads are in `cache/hub-D5/`: `emit_modern.py` (2018, 2022), `emit_2009.py` (needs `ifes_final.json` from `parse_ifes*.py`), `emit_old.py`, `emit_muni.py`. Re-fetch the Wikipedia wikitext with the MediaWiki API (`action=parse&prop=wikitext`), rerun, and re-check that winners equal seats and confession counts match the allocation (the scripts assert and print mismatches).
