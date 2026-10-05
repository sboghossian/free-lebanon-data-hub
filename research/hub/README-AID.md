# Aid and NGOs research (leg R-aid), retrieved 2026-10-05

Research only. Nothing here is wired into the build. Files are in `research/hub/aid/`.

| File | Rows | Span | Source | Licence |
|---|---|---|---|---|
| fts-years.json | 21 years | 2006-2026 (2026 partial) | OCHA FTS API, flow endpoint grouped by organisation | none stated; FTS terms page not readable, facts only, attribute OCHA FTS |
| fts-appeals.json | 28 plans | 2006-2026 | FTS plan and flow endpoints, HAPI funding as cross-check | as above; HAPI CC BY-IGO |
| fts-donors.json | 21 years, 290 donors | 2006-2026 | FTS flows, source organisation | as FTS |
| oecd-donors.json | 123 donors and aggregates | 1960-2024 | OECD DAC2A, SDMX | CC BY 4.0 per OECD terms, dataset page not re-read |
| wb-projects.jsonl | 140 | 1955-2026 | World Bank projects API v3 | CC BY 4.0 |
| presence.jsonl | 7,622 | Oct 2023 to Mar 2025 | HDX Lebanon Operational Presence (HAPI + two XLSX snapshots) | CC BY-IGO (CKAN metadata) |
| hrp-projects.jsonl | 2,849 | 2021-2025 plans | HPC project search API (HDX HRP projects dataset) | CC BY-IGO (CKAN metadata) |
| reach-selfreported.jsonl | 86 | 2019-2025 | LRP and LCRP end-of-year dashboards, hand-read | none stated; numbers only, every row `self_reported: true` |

## Rules that matter
- Never add FTS, OECD ODA, World Bank commitments or IATI. They overlap. IATI is not used here at all.
- FTS `total_usd` per year is the sum of paid and committed flows that are Lebanon-only (boundary single). It equals the FTS groupby total in all 21 years. Pledges are excluded and shown apart.
- FTS totals include Pass through flows (a UN agency or pooled fund passing money on), so one dollar can appear twice. `by_flow_type_usd` and `usd_excl_pass_through` expose this. 2023 example: 191.8 of 813.4 million.
- The year is the FTS usage year, not the donation date.
- Recipient lists: `top_recipients` (first-level recipient, pooled funds shown) and `top_recipients_final` (after pooled funds). Top 25 each, plus totals by organisation type and subtype.
- Appeals: 3RP plans are regional. `requirements_usd` is whole-plan; `requirements_lebanon_usd_hapi` is the Lebanon part, checked against the sum of Lebanon projects in the HRP file and the LRP dashboards. LCRP (now LRP) has no FTS plan of its own.
- HRP `requested_usd` is requested, not received or spent. 3RP project locations are national only; the OLBN plans carry governorates (pcodes LB1 to LB8).
- Presence is self-reported by partners and says who is there, not how much. Sectors are named differently between the HAPI quarter (Q1 2025) and the monthly XLSX (Oct 2023 to Dec 2024). Activity-level rows were reduced to one row per organisation, sector, district and month. A 2024 CSV snapshot was dropped because the XLSX covers the same months. Org type is blank where no source gave it (about 29 per cent of monthly rows).
- Reach figures are agency self-reports. Group totals are the sector with the highest count per group, not unique people. Where a dashboard contradicts itself the row note says which figure was used (2020, 2022, 2023, 2025).
- World Bank: `commitment_usd` is `curr_total_commitment`; additional-financing projects may repeat their parent, so do not sum. One project has a future approval date (flagged).

## HAPI identifier
HAPI rejected `base64("LebanonHub:research")` as invalid (the v2 encoder needs an `@` in the contact). The identifier used encodes `LebanonHub` with the placeholder contact `research@lebanonhub.example`. Register a real contact before any public launch.

## Not obtained
- OECD CRS (sector and channel): not retried. DAC2A only.
- People reached by district as data: not published as an API. HAPI has one operational-presence period only (Q1 2025); HDX has no 2023 Q1 to Sep 2023 or post-March 2025 file listed.
- UNHCR Annual Results Report 2024: HTTP 403, skipped. HDX and FTS terms pages: JS shell or empty, not read.
- 2015-2018 reach rows and any 2026 reach row (2026 dashboards not yet published).
- ReliefWeb API (needs approved appname), IATI Datastore (needs key), Daleel Madani (bot challenge), Gulf donor lists, NGO registries.

## Decisions for the orchestrator
- Show FTS and OECD on separate charts, never summed.
- Keep `self_reported` visible wherever reach or presence is shown.
- Provide a real HAPI contact.
