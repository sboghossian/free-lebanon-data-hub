# CIB / IMPACT open data (impact.cib.gov.lb)

Checked 2026-10-01. Portal: "Impact Open Data", run by the Central Inspection Board (CIB) as part of the IMPACT e-government platform.

## How it works
- Angular single-page app. `home.html` loads `main.<hash>.js` plus one lazy chunk (`4.<hash>.js`, the open-data page).
- Runtime config is a public file: `https://impact.cib.gov.lb/assets/configs/settings.json` (saved in cache). It names the backends:
  - `openServices` = https://impact.gov.lb/impactservices
  - `blobServer` = https://impact.gov.lb/blob
  - `impactSivisUrl` = https://impact.cib.gov.lb/sivis (chart/dashboard backend); `daemSivisUrl` = https://daem.impact.gov.lb/impactservices/sivis
  - Related sub-portals: cp.cib.gov.lb, im.cib.gov.lb, lp.impact.gov.lb (parliament), development.impact.gov.lb (rural), hospital.impact.gov.lb, bank.impact.gov.lb, daem.impact.gov.lb, tmo.gov.lb.
- No login, key or token needed for the endpoints below. Requests used the UA "LebanonHub/1.0 (research)", at most 1 per second.

## Endpoints that work
- Excel exports: `GET https://impact.gov.lb/blob/open_data_export?Type=<t>` where t is one of `municipalities, towns, hospitals, covid, vaccine, decisions, needs, mosa, permits`. Returns .xlsx. `vaccine` (12 MB) and `permits` (1.6 MB) take 1-3 minutes; others are fast. Use a 280 s timeout.
- Lookups: `GET https://impact.gov.lb/impactservices/palookups?filter=<name>` JSON. Names: mouhafaza, kadaa, municipalities, article_type, article_issuer, public_sector, main_public_institution, incident_type, measure_type, need_types, news_entity_type. Use ONE filter per call: repeated or combined filters returned 502.
- `GET .../impactservices/ping` returns `{}`.
- Static file: `https://impact.cib.gov.lb/assets/docs/Copy_of_Damage_assessment_overview.xlsx` (Beirut blast damage to public assets).

## Endpoints that failed
- `impact.cib.gov.lb/sivis/dashboard?names=...` and `/aggregation?names=...`: 500 or timeout. These feed the dashboard charts. Dashboard names seen in code: vaccine-breakdown, vaccine-registration, rural-development, daem-registration, daem-payment. Names are unconfirmed, so nothing was extracted.
- bank.impact.gov.lb and lp.impact.gov.lb do not resolve; hospital.impact.gov.lb and im.cib.gov.lb gave certificate or redirect errors; daem and development redirect (probably login).

## What is there
Nine Excel exports, all in cache (`export_*.xlsx`):
| Type | Rows | Content |
|---|---|---|
| municipalities | 1,001 | name AR/EN, caza, governorate, elevation, address, lat/lon, union |
| towns | 3,533 | town names mapped to caza |
| hospitals | 184 | contacts, caza, governorate |
| covid | 1,001 | PCR positives, 2-dose vaccinated, population per municipality |
| vaccine | 462,728 | date x municipality: cases, doses 1/2/3 (2020-2023) |
| decisions | 4,954 | municipal COVID decisions 2020-2022 |
| needs | 922 | municipal needs 2020-2022 |
| mosa | 1,317 | Social Affairs aid request counts |
| permits | 88,409 | lockdown movement permits, Feb-Jun 2021 (not building permits) |
Governorate counts of municipalities (export): Mount Lebanon 318, South 145, North 140, Nabatieh 117, Akkar 116, Bekaa 89, Baalbek-Hermel 75, Beirut 1.

## Extracted series
`cib-series.json`: monthly national sums from the vaccine export, 2020-02 to 2023-12: cases (total 1.21M), dose 1 (2.61M), dose 2 (2.30M), dose 3 (0.67M). The cases total is close to the publicly reported national figure, but it was not audited. The portal holds no CPI, GDP, labour, debt or trade series; those are for CAS and others.

## Gaps and cautions
- Almost entirely COVID-era and municipal-directory data. Nothing before 2020. Most files are frozen at 2022-2023.
- Data quality: 176 malformed dates in vaccine, about 60 in permits (years like 0202, 12021); permits has an "Other" bucket with huge counts. Municipality names are Arabic only in most sheets; join through lat/lon or the municipalities export.
- Lookup `municipalities` lists 1,385 entries vs 1,001 in the export (the export likely covers only municipalities with coordinates).
- No licence or terms statement was found on the portal, so licence is recorded as null. Treat as public-sector open data with attribution to IMPACT/CIB, and confirm before bulk redistribution.
- Backend is slow and intermittent (502/500, 30 s+ responses). Retry politely; do not hammer.
- Cache: `cache/portals/cib/` (settings.json, JS bundles, 9 exports, lookup_*.json, damage.xlsx, vaccine_monthly.json, build.py).
