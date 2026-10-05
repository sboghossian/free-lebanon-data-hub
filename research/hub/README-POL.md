# POL: religion and politics data (2026-10-05, leg R-religion)

Research only. Files: `villages/P-sects-2014.jsonl`, `politics/qada-sects-2014.json`, `politics/district-sects.json`, `politics/history.json`. All validated with python3 (0 bad records).
Label to show everywhere: **registered voters by sect, 2014 lists; not residents**. Never beside the Strike map. No "dominant sect" wording; shares only.

## P-sects-2014.jsonl (1,465 rows, one per voter list)
Source: lub-anan.com sect page of each town (`<town page>/المذاهب/`), which transcribes the Interior Ministry 2014 lists. No licence stated, so facts only (`license: null`), no page text copied. URLs come from `registered_voters_source_url` in P-population.jsonl.
- Row: `place_id, pcode, name, name_ar, year, total, by_sect, other, label, note, source, license`. 1,385 rows join to the gazetteer (`place_id`; 1,286 have a `pcode`, the rest are LBX places); 80 are voter-list localities with no gazetteer match (`place_id` null, `unmatched_to_gazetteer: true`).
- `by_sect` holds only non-zero fixed keys (Maronite ... Not stated). `total` includes Not stated. 56 rows carry the P-population `note` that a section is also listed as its own place: do not sum places (sum 3,547,965 against the national 3,514,588).
- Mapping (Arabic label to key): ماروني Maronite; روم ارثوذكس Greek Orthodox; روم كاثوليك Greek Catholic; ارمن ارثوذكس/كاثوليك Armenian Orthodox/Catholic; سريان ارثوذكس/كاثوليك Syriac; لاتيني Latin; انجيلي (بروتستانت) Evangelical; اشوري Assyrian; مسيحي Christian minorities/unspecified; سني Sunni; شيعي Shia; درزي Druze; علوي Alawite; اسرائيلي Jewish; غير مذكور Not stated. Folded: قبطي, قبطي ارثوذكس, قبطي كاثوليك into Copt; كلدان, كلدان كاثوليك, كلدان ارثوذكس into Chaldean (sub-rite detail is lost, counts kept).
- Kept verbatim in `other` (350 rows): ارمن بروتستانت (Armenian Protestant), نسطوري (Nestorian), لا طائفي (non-sectarian), مختلف (miscellaneous), شهود يهوه, هندوسي, بهائي, بوذي, اسماعيليي (Ismaili), للتدقيق (to verify).
- Checks, all passed: every row sums to its page total; each Christian, Muslim and misc subtotal matches; each total equals `registered_voters_2014`; Sour = Shia 19,496 of 29,410.
- One parent URL (Almat, Jbeil) returned 404 on the sect page; it is not one of the 1,465 lists, so nothing is missing from the file.

## qada-sects-2014.json
National, 6 governorate and 29 qada pages, same keys. lub-anan splits Saida (city and Zahrani villages) and Beirut (three 2009-law districts), and groups Akkar with the North and Baalbek-Hermel with the Bekaa. All 29 pages sum back to the official CAS/DGCS caza totals (26 cazas) and to 3,514,588 nationally.

## district-sects.json (15 districts of the 2017 law)
- `lists_2014`: all 15, summed from qada pages (Beirut I = Achrafieh, Remeil, Saife, Medouar; Beirut II = the other eight quartiers). This is the only complete layer.
- `lists_2017_wikipedia`: qada counts for Mount Lebanon I and IV, North II and III, Bekaa II (Wikipedia tables citing Lebanon Files; secondary). `lists_2018_wikipedia_counts` (Bekaa I) and `shares_wikipedia` (8 districts) are page-text figures, rounded, secondary.
- `registered_2018/2022` are copied from `elections/*.json` for context; they are a different compilation, not a measure of change. Lists, winners and blocs are not repeated.
- Not found: sect composition of the 2018 or 2022 lists themselves, for any district. elections.gov.lb is a JS app with no API; moim.gov.lb sits behind Cloudflare (not bypassed).

## history.json (18 tables, each `id, title, year, rows, source, license, note`)
Mutasarrifate 1860 (The Monthly), 1895 estimate and 1913 count (Chamie via Wikipedia), 1922 and 1932 (Chamie), 1932 residents and emigrants (Maktabi, and The Monthly as cross-check; they differ by sect, flagged), laws timeline 1926 to 2017, seats per sect and district for 1927 (16 new seats), 1943/47, 1951 (derived counts), 1953, 1957, 1960 law (national by sect), Taif 64/64, 1992 to 2005 governorate blocks, 2008 law, 2017 law, Beirut I voters 1960 and 1972, double qaimaqamate (description, approximate, no polygons).
- Estimates are flagged `estimate: true`. Source arithmetic errors are stated in the notes (1913 total, 1922 and 1932 Chamie rows).
- Gaps: seats per qada under the 1960 law and under the 2000 law; any 1926 first-chamber table; Mutasarrifate 1860s beyond the single Monthly table. 2006 sect estimates were left out on purpose (publisher's own, contested).

## Licences and rebuild
Wikipedia text CC BY-SA 4.0 (facts only); The Monthly all rights reserved (numbers as cited facts); lub-anan no licence (facts). Raw HTML: `cache/lub-sects/raw/` (1,495 pages, reruns are free). Scripts: `cache/lub-sects/{crawl,build}.py`, `cache/pol-build/*.py`, Wikipedia cache `cache/pol-wiki/`.
