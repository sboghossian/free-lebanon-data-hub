# D10 laws index (hub/laws/D10-<decade>.jsonl)

5,366 records, 1900 to 2026, one file per decade (D10-1900.jsonl ... D10-2020.jsonl).

## Sources
- Legislation database of the Legal Informatics Centre, Lebanese University: http://legallaw.ul.edu.lb (page LegisltaionSearch.aspx, public GET queries). Used for 5,335 records. Every page cached in cache/hub-D10/pages/.
- Lebanese Parliament, lp.gov.lb (public ViewLawYears/ViewLaws pages and Webservice.asmx JSON): used only for 2026, which the Centre does not list yet. 31 records (laws passed in sessions of 9 Mar, 15-16 Jul and 11 Aug 2026). They carry no law number or gazette date on the source, so law_no and gazette are null and `date` is the session date.
- Gazette issue numbers come from the Centre's OfficialJournal.aspx pages (one per year).

## Method
Queried by year (1900-2025) and by classification: Law (49462), Law promulgated by decree (49464), Law in force by operation of law (102464), Legislative decree (49481), Decree promulgated by law (49482). 1 request/second, polite UA "LebanonHub/1.0 (research)", no login.
Title_ar is the title as published (HTML residue and the "(repealed)" marker removed; the marker sets `status: "repealed"`, 180 records).
Title_en and `topic` were written by hand by the agent for each of the 5,171 distinct titles (no machine translation). Topic is one of 24 labels.

## Fields
law_no (int or null), date (ISO), title_ar, title_en, topic, gazette ("Official Gazette no. N of YYYY" or null, 5,207 filled), source (URL), license (null: the site states none), plus type_ar/type_en, status, year, gazette_site_id.

## Caveats and gaps
- law_no: numbers before about 1960 are mostly not given by the source (null). Lebanese law numbers restart per legislative term, not per year, so (law_no, year) is not unique; legislative decrees repeat numbers with letter suffixes the source drops.
- Coverage is what the Centre classified as laws and legislative decrees. Not included: ordinary decrees, ministerial decisions, constitution texts (Constitution classification not scraped), Ottoman laws (type 49463). Years with no parliament sitting show few or no laws (2007: 0).
- 2025 lists only 14 laws on the Centre, while lp.gov.lb shows 26 items passed in 2025 sessions; some 2025 laws are therefore probably missing. Not merged to avoid duplicates.
- gazette: set only when the journal year is within 1 year of the law date; the Centre uses year 1900 as a catch-all for pre-1920 items, so those are null. Where one issue number appears twice (supplements) the number may point to the supplement.
- Dates of the 1900-1920 Ottoman/Hijri items are the Centre's own recorded dates (several are 1 Jan 1900 placeholders).
- English titles are summaries-translations; truncated very long titles (about 15) were translated from the first ~300 characters shown. Treat title_ar as authoritative. Titles describe purpose, not legal effect.
- Licence: none stated by the Centre or parliament; legislation texts are public documents but redistribution terms are unconfirmed. Only titles, numbers and dates are republished (no article text).

## Refresh
cache/hub-D10/scrape.py YEAR_FROM YEAR_TO (legallaw), lp.py YEAR (parliament), oj.py (gazette map), then build.py (needs translations in cache/hub-D10/tr/ for any new title).
