# diaspora-wikidata.jsonl (Lebanese abroad, Wikidata leg)

64 rows, 56 companies, built 2026-10-06 from the Wikidata Query Service (CC0). One row per (company, person, role). UA LebanonHub/1.0 (research), 1.5 s between queries.

## Queries (all run once per role property P112, P169, P488, P1037)
Origin clauses (a person is kept if any one holds; `origin` takes the strongest: citizen, then born, then descent):
- citizen: `?p wdt:P27 ?cz . VALUES ?cz {wd:Q822 wd:Q130842 wd:Q3326429}` (Lebanon, French mandate of Lebanon, Mount Lebanon Mutasarrifate)
- born: `?p wdt:P19 ?pl . {?pl wdt:P17 wd:Q822} UNION {?pl wdt:P131+ ?a . ?a wdt:P17 wd:Q822}`
- descent: `?p wdt:P172 ?eg . VALUES ?eg {Q2606511 Q3026387 + 47 "Lebanese X" ethnic groups}` (found with `?e wdt:P31 wd:Q41710` and "Lebanese" in the label)
Core: `SELECT DISTINCT ?c ?p WHERE { ?c wdt:<P112|P169|P488|P1037> ?p . <origin clause> }`
Inverse: `?p wdt:<P108|P1830> ?c . ?c wdt:P112 ?p . <origin clause>`. P39: `?p p:P39 ?st . ?st ps:P39 ?pos . ?st pq:P642 ?c . ?pos wdt:P279* ?r` for CEO/chair/president classes: 0 hits.
Then batch queries (80 to 100 QIDs) for labels (en, ar, fr), P856, enwiki sitelink, P571, P576, P452, P414, P159 to P17 to P298 (with P131* fallback), P31, P749, P1366, P580/P582 qualifiers, and a founder count per company (more than 1 founder gives co-founder).

## Cleaning
Kept only items typed business, enterprise, company, firm, publisher, record label, chain etc. (657 role rows dropped as parties, newspapers, dioceses, NGOs, schools, museums). 4 items typed only "organization" or "restaurant" kept by hand (Cellectis, Violet, Testset Media, Droubi's). Dropped by hand: Armenian Caritas, Theatre national de la Colline, Halunkenbande. 62 rows dropped for HQ in Lebanon; 9 for no country; 5 for HQ in two countries. `executive` rows dropped when the same person already has a founder/ceo/chair row. Status: closed if P576; acquired if P749 or P1366; else active if founded known.

## Counts
Origin: lebanese_citizen 38, born_in_lebanon 22, lebanese_descent 4.
Kind: established 29, startup 27, listed 8. Role: founder 32, co-founder 11, ceo 17, chair 2, executive 2.
Country: USA 19, FRA 9, GBR 7, CAN 5, MEX 5, ARE 4, CHE 4, ARM 2, BRA 2, ESP 2, SAU 2, COD 1, ITA 1, SWE 1.

## Gaps and caveats
- Wikidata covers famous people and large firms; it misses nearly all startups. Expect press sources to add far more.
- Citizenship and origin are Wikidata statements, not verified here (e.g. Carlos Slim, Edmond Safra carry a Lebanon citizenship claim). Person labels are as stored ("40" is Noah Shebib's Wikidata label).
- `founded` can be a brand or group date, not the legal entity; Wikidata `kind` is a rule, not a fact.
- Skipped for missing or double HQ data: Republic New York, Empirica Capital, Asis Boats, Nour Productions, Logisoft (Beirut and Nicosia), Sfeir-Semler Gallery (Hamburg and Beirut).
- Companies without any English or other label were dropped. role_years only where Wikidata has P580/P582.
- Delete requests: the page points to a GitHub issue.
