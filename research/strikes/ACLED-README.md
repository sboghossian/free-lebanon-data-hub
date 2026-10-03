# ACLED adapter

Optional. Adds ACLED's Lebanon events (2016 to today) to the strike map as monthly aggregates. Docs checked 2026-10-01 at acleddata.com/api-documentation.

## Register
1. Create a free myACLED account at https://acleddata.com (Register).
2. Put the login in your environment, or in `.env` at the repo root (never commit it):
   ```
   ACLED_EMAIL=you@example.com
   ACLED_PASSWORD=your-password
   ```

## Run
```
python3 build/acled_agg.py
python3 -m unittest build/test_acled_agg.py   # no network
```
With no credentials it prints these steps and exits 0.

How it works: POST `https://acleddata.com/oauth/token` (password grant, client_id `acled`, scope `authenticated`; token valid 24 h) then GET `https://acleddata.com/api/acled/read` with a Bearer token, `country=Lebanon`, `event_date` BETWEEN 2016-01-01 and today, cursor pagination (5,000 rows per page, follow `next_cursor` until null). Output: `research/strikes/acled-agg.json`, with counts and summed fatalities per (location, admin2, month, event_type, sub_event_type), the location's lat/lon, and an attribution string. No raw rows are written. Your account tier may limit history or recency; the API reports this in `data_query_restrictions`, which is saved in the output.

## What the terms allow on a public page
From ACLED's Content Usage Terms, Attribution Policy (both updated 8 July 2025) and EULA:
- Allowed with credit: use of data and visualisations, if ACLED is clearly and prominently cited, including on the map itself, with access date, filters used and how the data were manipulated.
- Say ACLED, or ACLED (Armed Conflict Location & Event Data), with the ampersand. Do not call it a "project". Do not use the ACLED logo.
- Prohibited: attributing your own analysis to ACLED; building a dataset or platform that competes with or substitutes for ACLED; offering services to others without authorisation; training or improving ML/LLM systems in ways the EULA restricts; harmful or defaming use.
- Not confirmed: whether publishing the aggregate file itself, in a public repo or download, counts as redistribution. Read the EULA (acleddata.com/eula) and ask ACLED via acleddata.com/contact before publishing the JSON. Showing the map with attribution is the safer route than offering the file for download.
- Keep the attribution string from the JSON on the map layer, and keep ACLED data out of any LLM or training pipeline.
