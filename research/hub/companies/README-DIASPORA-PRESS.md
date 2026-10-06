# Diaspora press leg (v11 Lebanese abroad)

File: diaspora-press.jsonl, 213 rows (one per company, person, role), 178 companies. Facts only, license null. HAQQ Legal AI excluded (headquartered in Lebanon, so it is in the startups list instead).

Rule applied: a row exists only when the cited page states the person's (or the founders') Lebanese origin and the role is given at the source. Origin was never inferred from a name. Every origin_quote was machine-checked as present in the origin_source page (whitespace-insensitive).

## Counts
By kind: startup 55, established 108, listed 50.
By HQ country (ISO3): USA 59, ARE 55, MEX 13, GBR 12, CAN 10, FRA 10, CHE 10, AUS 6, BRA 5, NGA 5, KWT 4, SAU 3, SLE 3, JPN 3, QAT 2, DEU 2, SGP 2, CIV 2, EGY 1, NLD 1, MLI 1, CMR 1, COD 1, ZAF 1, SEN 1.

## Sources used
Forbes Middle East list pages (nationality fields, about 45 rows), Wikipedia (about 60 rows, many established groups), The961, Kataeb, Al-Monitor, Arab America, The National, Economy Middle East, Entrepreneur ME, The Beiruter, LebNet community news, company blogs and press releases.

## Caveats
- Several quotes are list-level or short (for example a list title naming Lebanese honourees, "Lebanese businessman"). Treat those as medium confidence.
- hq_city, founded, status and company_url were partly filled by the research agents from memory and are not page-verified. Several cities are null.
- Forbes ME nationality fields pair founders and nationalities by order; origin is "lebanese" where the source gives only a nationality.
- Some roles are regional heads of global firms (Omnicom MENA, Barclays MENA, GE MENAT, HSBC ME) or past/deceased holders; role reflects the source date.
- Startups are thinner than established groups: about 55 startup rows.

## Not reached
L'Orient Today / Le Jour, Forbes.com, EU-Startups, Sifted, Les Echos and arabfounders.net returned 403 or empty to curl. So Seeqnce, Tioopo Capital, Storyland, Cherpa, Elum, Davis, XFOLIO, Jedo and ChefXChange are missing. Wamda, MAGNiTT, Endeavor and investor portfolio pages gave no usable origin statements. Nuwa, Zeneat, Wiwa, Sabis, Dime, Matic, Mumzworld, Bayt, Brandable, Swvl, Careem, Tabby, Fetchr were not confirmed or are HQ'd in Lebanon (Toters). Not checked: Cyprus, Spain, Italy, Belgium, East Asia startups.
