# Open Data Lebanon (opendatalebanon.org) leg, crawled 2026-10-01

## How it works
- Next.js app (App Router, server-rendered). No public JSON API and no sitemap/robots file (both return the 404 page).
- Catalogue list: `https://www.opendatalebanon.org/en/data?page=N` (15 per page, 11 pages, 153 resources). Full metadata
  is embedded in each page's RSC payload (`self.__next_f.push`): id, slug, title, description, downloadUrl,
  externalUrl, format, publishedAt, updatedAt, sourceOrg, categories, regions. `&sort=az` reveals one record
  that default sort missed at crawl time (Lebanon State Budget), so use two sorts and dedupe by id.
- Detail page: `/en/data/<slug>`. Category pages: `/en/categories/<slug>`. Search: `/en/search`.
- `GET /api/file-proxy?url=<urlencoded storage.googleapis.com/odl-files-test-odl/...>` serves the 96 files hosted in
  the site's own Google Cloud bucket (xlsx, xls, csv, pdf, doc). Direct bucket URLs return 403; only the proxy works,
  and it rejects non-bucket URLs (403). Public, no login.
- The other 57 resources are links to original publishers (HDX, UN Data, MoPH, Gherbal, BRITE, UNHCR and others).

## What is there (153 resources)
Formats on the portal: PDF 84, Excel 27, Web app 20, HTML 12, CSV 9, Infographic 1. Category counts (multi-label):
Economy 67, Social 56, Health 47, Education 32, Environment 28, Agriculture 26, Legal 22, Industry 16, Gender 13,
Energy 10, Transport 10, Special needs 8. Top publishers: Ministry of Public Health 16, CERD 15, CAS 13, Gherbal
Initiative 13, UNDP 7, UN Data 6, Ministry of Tourism 5, World Bank 4, BRITE 4.
Downloaded 96 bucket files (about 254 MB, mostly PDFs) to `cache/portals/odl/files/<id>.<ext>`; metadata in
`cache/portals/odl/datasets_raw.json`. Catalogue: `odl-catalogue.jsonl` (extra fields: original_url, file_proxy, odl_categories).

## Machine-readable data worth using (CAS tables mirrored as Excel)
Vital statistics 1999-2024 by governorate (births, deaths, marriages, divorces); cement deliveries 1993-2019; EDL
electricity 1995-2018; imported petroleum 1995-2019; Beirut airport 2005-2018; border arrivals 1996-2018; car
accidents 2007-2018; labour force survey 2018-19 tables EA1-EA25; industrial exports and permits; tobacco 2002-2019;
weather 1996-2018; UCDP Lebanon events CSV 1989-2023; World Bank remittance matrix (May 2021). 25 series extracted to
`odl-series.json` (script: `cache/portals/odl/series.py`).

## What is missing
- No CPI, GDP, national accounts, debt, exchange-rate or population series. ODL mirrors CAS only for a few
  activity tables. Those must come from CAS, BDL, MoF, World Bank, IMF directly.
- Metadata is thin: no licence field set on any resource, no dataFrom/dataTo, no row counts. Years in the
  catalogue are inferred from titles, else the publication year.
- "Lebanon - Food Prices" hosts a FAOSTAT dataset index, not prices. The 2020 State Budget and most reports are PDF only.
- Latest items are 2026 reports (UNDP socioeconomic impact of the 2024 war, CNRS post-war recovery). The vital data
  file's 2025 year holds Jan-Jul only.
- UCDP extract is a trimmed three-column file (year, admin area, best estimate); treat counts as indicative.

## Licence and reuse
Site footer: "All data from original sources." Reuse terms belong to each original publisher (CAS, MoPH, UNDP, World
Bank, UCDP; check each source). BRITE (BLOMINVEST) workbooks say "Redistribution restricted without prior permission", so no
BRITE values are in our series. Credit both ODL and the original publisher. Platform is a citizen initiative (Dr Wissam Sammouri).

## Leads found on the way
- Gherbal Initiative (elgherbal.org) hosts Ministry of Finance, BDL, customs, elections, prisons and judiciary
  dashboards. It is a React app backed by Firebase and a 66 MB `/search-index.json` (cached in `cache/portals/odl/ext/`). No open
  API was found; not pursued.
- data.un.org CSV links on ODL are query pages; the DownloadHandler URL tried returned 404.
- HDX datasets (villages/settlements, cadastral pcodes, health centres, IDMC displacement events) are directly downloadable from HDX.

## Politeness
Under 1 request per second, UA "LebanonHub/1.0 (research)", about 170 requests total, no login, no rate-limit evasion.
