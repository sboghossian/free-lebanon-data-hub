# D3: electricity and night lights

Built 2026-10-02. Outputs: `series/D3-power.json` (56 series + 12 events), `series/D3-nightlights.json`.

## Power: what is in it
| Block | Series ids | Span | Source |
|---|---|---|---|
| EDL production, purchases, network supply (annual and monthly) | `edl_production_gwh`, `edl_purchases_gwh`, `network_consumption_gwh`, `*_m`, imports from Syria/Egypt, Karpowership | annual 1995-2018, monthly 1995-01 to 2019-10 | EDL via the Central Administration of Statistics (CAS), republished on Open Data Lebanon (ODL) |
| Treasury transfers to EDL | `treasury_transfers_to_edl_lbp_bn` | monthly 2009-01 to 2019-03 | Ministry of Finance via CAS/ODL |
| Petroleum imports | `import_*_t` | annual 1995-2017/18 | Ministry of Energy and Water via CAS/ODL (economy-wide, not power-only) |
| BDL electricity production | `bdl_electricity_production_gwh_m` | 2023-09 to 2025-08 only | Banque du Liban, source EDL |
| Post-crisis balance | `edl_thermal_production_gwh_2020_22`, `total_public_supply_gwh_2020_22`, `electricity_demand_gwh_2020_22`, `private_generation_gwh_2020_22`, `solar_pv_generation_gwh`, fuel imports 2011/2020-22 | 2019-2022 | Lebanon national GHG inventory report (UNFCCC), Table 9 and 14, citing EDL 2023 and LCEC 2023 |
| Generator share | `generator_share_of_demand_pct`, `unmet_demand_edl_pct` | 2008, 2018, 2022 | World Bank 2020; inventory report |
| Supply hours | `edl_supply_hours_*`, `grid_hours_*`, `generator_hours_*`, `power_cut_hours_*` | 2018-2026, sparse | Ministry plan, IMF, L'Orient Today, HRW, Libnanews, UNHCR VASyR |
| Capacity | `capacity_available_mw_2018_2026`, `peak_demand_mw` | 2018-2026 | World Bank, JICA, Ministry, EDF plan |
| World Bank indicators | `wb_eg_*`, `wb_ic_*` | 1990-2024 | World Bank WDI API |

`events` (top-level key, not in the series contract) lists blackout and supply milestones with a source each.

## Licences
- World Bank WDI: CC BY 4.0. Everything else: the source states no licence (ODL lists none; CAS, EDL, BDL, ministries, press and UN pages give no reuse terms), so `license` is null. These are official statistics and short factual figures; Stephane should decide whether to keep them in the public Hub.
- Not included: EIA/countryeconomy generation and capacity (2000-2024). It counts private generation, so it is not comparable with EDL, and the licence is unclear.

## Gaps and cautions
- **Supply hours are not a clean series.** No open official time series exists. Points are dated statements; ranges are stored as midpoints and the range sits in `notes`. VASyR series are self-reported by Syrian refugee households. Regional points: Beirut urban 21.2 h and Bekaa 12 h (IMF, year assumed 2018, low confidence), Akkar 2.6 h and North 3.5 h (VASyR 2021). Regional breakdown for 2022 exists in VASyR 2022 Figure 4 but the text extraction was unreadable; not used.
- **BDL**: the site is behind a Cloudflare browser check, which I did not get around. Only the 24 months quoted on the public page text were retrieved. The full 1993-2025 series is available there as XLS/CSV.
- **No monthly data for 2019-11 to 2023-08** except the annual inventory figures. EDL's own site (edl.gov.lb) was not tried.
- Fuel imports for power alone are not published openly. `import_gasoil_t` and `import_fueloil_t` are economy-wide. Fuel for power plants 2019-22 is only in a chart in the inventory report.
- Capacity points mix installed, available and effective capacity (see notes). 2024 figure is one expert's estimate.
- Installed capacity per plant, 2023-2026 EDL production by month, Iraqi swap volumes and generator tariffs by month: not collected. Generator tariffs are in `research/32-life-index.series.json`.

## Refresh
- ODL files: `https://www.opendatalebanon.org/en/data/electricity` and `/petroleum-products` (use the page's `/api/file-proxy?url=` links; the direct storage URL is denied). Parsers: `cache/hub-D3/build_power1.py`.
- WB: `cache/hub-D3/wb.py`. BDL: download XLS from the BDL link in the series. Then rerun `build_power.py`, `build_power2.py`.

## Night lights (done, open and login-free)
- File `series/D3-nightlights.json`: 26 series, 155 monthly points each, 2012-01 to 2025-06. Per governorate (LB1-LB8) and Lebanon: mean radiance (`nl_mean_*`), summed radiance (`nl_sum_*`), cloud-free observations per pixel (`nl_cf_*`, a quality flag). Unit nW/cm2/sr.
- Source: World Bank Light Every Night, public bucket `s3://globalnightlight/composites/npp_YYYYMM_*` (VIIRS DNB monthly composites, Suomi NPP, stray-light corrected), licence ODbL per the AWS registry (https://registry.opendata.aws/wb-light-every-night/). No account or key. Computed with rasterio by reading only the Lebanon window of each global COG over HTTP, masked to `build/geo/lbn-adm1.json`. Script and raw output: `cache/hub-D3/nl.py`, `nlw.py`, `build_nl.py`.
- Not used because they need a login: Colorado School of Mines EOG VNL (Keycloak sign-in), NASA Black Marble VNP46 (Earthdata). The `eoatlas/nightlight` ADM1/ADM2 dataset (CC BY 4.0, to 2024-05) is a dead link (domain does not resolve).
- Gaps: 2014-03, 2017-10, 2017-11, 2021-08, 2022-06, 2022-08, 2024-10 are missing in the archive; the archive stops at 2025-06 (nothing for 2025-07 to 2026-10). Governorate level only; caza level not computed. Product switches from rp2 to ops at 2017-04 (no visible break). Cloud cover makes winter months noisier: check `nl_cf_*`.
- Reading it: Lebanon mean radiance rises 3.3 (2012) to about 4.5 (2018-19), falls to 1.65 (2022), recovers to 2.8 (2025 H1). Beirut: about 87 (2012) to 27 (2022) to 63 (2025). These are annual averages of monthly means computed here, not an official statistic.
- Refresh: extend `months` from `keys.json` (re-list the bucket) and rerun `nlw.py` then `build_nl.py`.
