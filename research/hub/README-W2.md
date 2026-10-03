# W2 world indicators B: people, society, governance, conflict, environment

26 indicator files in `hub/world/indicators/W2-<id>.json` (contract schema; file name carries the leg prefix, the `id` field does not). Also `hub/world/W2-index.json` (one row per indicator with coverage and Lebanon's latest value), `hub/world/W2-countries.json` (ISO3 to name, ISO2, region, income, aggregate flag, from the World Bank country list) and `hub/world/flows/W2-unhcr-refugees-2025.json` (top 600 origin-to-asylum refugee flows, 2025, 98.6% of all flows). Years axis is 1960..2026; `null` means no data. Total size 7.5 MB, largest file 142 KB.

## Indicators, sources, licences
| id | what | source | licence | span |
|---|---|---|---|---|
| SP.POP.TOTL, SP.POP.GROW, SM.POP.NETM | population, growth, net migration | World Bank WDI (UN WPP) | CC BY 4.0 | 1960-2025 |
| SP.DYN.LE00.IN, SP.DYN.IMRT.IN, SH.DYN.MORT | life expectancy, infant and under-5 mortality | WDI (UN WPP, UN IGME) | CC BY 4.0 | 1960-2024 |
| SP.DYN.TFRT.IN, SP.DYN.CBRT.IN, SP.DYN.CDRT.IN | fertility, birth and death rates | WDI (UN WPP) | CC BY 4.0 | 1960-2024 |
| SP.URB.TOTL.IN.ZS, SP.POP.0014.TO.ZS, SP.POP.65UP.TO.ZS | urbanisation, age shares | WDI (UN WUP, WPP) | CC BY 4.0 | 1960-2025 |
| SE.TER.ENRR, SE.ADT.LITR.ZS | tertiary enrolment, adult literacy | WDI (UNESCO UIS) | CC BY 4.0 | 1970-2025 |
| VC.IHR.PSRC.P5 | homicide rate | WDI (UNODC) | CC BY 4.0 | 1990-2023 |
| EG.FEC.RNEW.ZS | renewables share of final energy | WDI (IEA) | CC BY 4.0 as stated by WDI | 1990-2022 |
| UNDP.HDI, UNDP.MYS | Human Development Index, mean years of schooling | UNDP HDR 2025 time series | CC BY 3.0 IGO | 1990-2023 |
| VDEM.ELECDEM, VDEM.LIBDEM, VDEM.REGIME | electoral and liberal democracy index, regime type | V-Dem Democracy Report 2026 via OWID | CC BY-SA 4.0 (OWID lists CC BY 4.0; the stricter one is recorded) | 1960-2025 |
| UCDP.DEATHS | conflict deaths by location | UCDP via OWID | CC BY 4.0 | 1989-2026 (2026 partial) |
| OWID.CO2PC | CO2 per capita, territorial | Global Carbon Project via OWID | CC BY 4.0 | 1960-2024 |
| UNHCR.REF.ORIGIN, UNHCR.REF.ASYLUM, UNHCR.IDP | refugees by origin, by asylum country, IDPs | UNHCR Refugee Population Statistics API | CC BY-IGO (UNHCR's HDX listing) | 1960-2025 (IDP 1993+) |

Beyond the brief I added net migration's neighbours (birth, death, under-5 mortality, age shares, literacy), liberal democracy and regime type, IDPs and the refugee flows file.

## Skipped: licence does not allow redistribution
- **Military expenditure % GDP (SIPRI via World Bank, MS.MIL.XPND.GD.ZS).** The WDI series metadata says SIPRI terms apply: no commercial use without a separate licence, and use of more than 10% of a SIPRI dataset needs SIPRI authorisation. Not included. SIPRI direct (sipri.org) carries the same terms. Needs Stephane's call or a SIPRI permission.
- **World Happiness Report (Cantril ladder).** The WHR data-sharing page offers the Figure 2.1 data "for free" but states no redistribution licence, and the underlying Gallup World Poll data is Gallup's. Not included; OWID's copy cites the same WHR policy.
- World Bank `SM.POP.REFG` and `SM.POP.REFG.OR` return no data from the API now; UNHCR is used directly instead.

## Aggregates
WB-sourced files carry all 78 World Bank aggregates (WLD, MEA, EUU, ...). UNHCR files and UCDP carry computed WLD, MEA, EUU (sums of members; MEA is the World Bank region incl. Afghanistan and Pakistan; UNHCR WLD also counts origins with no ISO3 code, e.g. unknown, Western Sahara, Tibet). UNDP gives WLD only; CO2 gives WLD and EUU; V-Dem gives no aggregates. USA is a country row everywhere.

## Gaps and cautions
- Only ISO3 codes in the World Bank country list are kept, so V-Dem's historic states (West Germany, Yugoslavia, ...) and UCDP's Abkhazia, South Ossetia are dropped. Kosovo is XKX.
- UNHCR refugee files show 0 where a country has no row in a year, so early years read as 0 rather than unknown. IDP files use null for not reported.
- UNHCR excludes Palestine refugees under UNRWA; Lebanon's hosted figure (535,168 in 2025) is UNHCR-mandate refugees only.
- UCDP 2026 is a partial year. Lebanon: 4,335 deaths in 2024, 347 in 2025, 4,365 in 2026 so far.
- WDI marks IEA-derived series CC BY 4.0, but IEA's own terms are stricter; flag if the build wants to be conservative on EG.FEC.RNEW.ZS.
- HDI and mean years of schooling stop at 2023; Lebanon HDI 0.752.

## Refresh
Scripts in `cache/hub-W2/`: `fetch_wb.py` (WB API, per_page 20000), `fetch_unhcr.py` (one request per year, 0.6 s apart), OWID CSVs from `ourworldindata.org/grapher/<slug>.csv?csvType=full&useColumnShortNames=true`, UNDP CSV from hdr.undp.org, then `python3 build_w2.py` regenerates every file. The WB licence per series comes from `WDISeries.csv` in the WDI bulk zip (column License Type).
