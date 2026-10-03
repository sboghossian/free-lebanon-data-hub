# W1 world indicators A: economy and money (hub/world/indicators/)

38 files, 1960-2026 (67 year slots), 4.9 MB total. Contract: `{id,label,unit,topic,source,source_url,license,higher_is,years,values{ISO3|aggregate:[...]}}`; `null` = no data. Extra fields: `lastupdated`. Lebanon = `LBN`.

## Sources and licences
- **World Bank WDI API** (23 files, id = WB code). CC BY 4.0. ~260 entities: ~215 economies plus WB aggregates (`WLD`, `MEA` = Middle East and North Africa, `EUU`, ...). Entity names, regions and income groups: `hub/world/W1-wb-entities.json`.
  NY.GDP.PCAP.CD, NY.GDP.PCAP.PP.CD, NY.GDP.MKTP.CD, NY.GDP.MKTP.KD.ZG, FP.CPI.TOTL.ZG, SL.UEM.TOTL.ZS, GC.DOD.TOTL.GD.ZS, BX.TRF.PWKR.DT.GD.ZS, BX.TRF.PWKR.CD, BX.KLT.DINV.WD.GD.ZS, NE.TRD.GNFS.ZS, NE.EXP.GNFS.CD, NE.IMP.GNFS.CD, BN.CAB.XOKA.CD, BN.CAB.XOKA.GD.ZS, ST.INT.RCPT.CD, FI.RES.TOTL.CD, FM.LBL.BMNY.GD.ZS, EG.ELC.ACCS.ZS, IT.NET.USER.ZS, IT.CEL.SETS.P2, SI.POV.GINI, SI.POV.DDAY.
- **IMF World Economic Outlook, April 2026** (13 files, id = `WEO.<code>`, e.g. `WEO.GGXWDG_NGDP` = government gross debt % GDP, `WEO.NGDP_RPCH`, `WEO.PCPIPCH`, `WEO.LUR`, `WEO.BCA_NGDPD`, `WEO.NGDPD`, `WEO.NGDPDPC`, `WEO.PPPPC`, `WEO.GGXCNL_NGDP`, `WEO.GGR_NGDP`, `WEO.GGX_NGDP`, `WEO.NGSD_NGDP`, `WEO.NID_NGDP`). Pulled from the IMF SDMX API (api.imf.org). Licence: IMF Copyright and Usage terms, re-read 2026-10-02 via the Wayback copy of the 2024-10-11 version (imf.org returns 403 to scripts). They allow download, copying, derivative works and redistribution of WEO statistical data with attribution ("Source: International Monetary Fund, Database Name"), but prohibit bulk automated download without permission, and the licence is bespoke, not open. All 13 WEO files are `redistribute: false`: shown with attribution, excluded from CSV downloads and the CC BY-SA claim. WEO.NGDPD is in plain US$ (unit "US$"), not billions. Four series (GGR_NGDP, GGX_NGDP, NGSD_NGDP, NID_NGDP) are not in the IMF DataMapper; source_url points to the WEO dataset on data.imf.org. MEA means Middle East, North Africa, Afghanistan and Pakistan (WB 2025 definition). Values after each country's last actual year are IMF estimates or projections (2026 present for 203 of 209 economies).
- **Our World in Data** (2 files): `OWID.per_capita_electricity_generation`, `OWID.per_capita_electricity_demand` (kWh/person, 2000-2024 for most). CC BY 4.0; built on Ember (2000+) and Energy Institute data.

## Lebanon coverage (LBN)
GDP per capita 1988-2024; growth 1989-2024; WB inflation 2009-2025 (IMF WEO has 1980-2025); unemployment 1991-2023; remittances and current account 2002-2023; FDI 1988-2024; tourism receipts 1995-2020; Gini and poverty 2011-2022; internet 1990-2024; mobile 1960-2022; electricity access 2000-2024.

## Gaps and cautions
- **IMF omits Lebanon for 2026** (WEO Apr 2026 ends at 2025 for LBN): no projection exists to show. WEO has no unemployment (LUR) for LBN after 2023, and no total investment (NID) for LBN.
- **IMF direct datamapper (www.imf.org) returns 403** to scripted clients, so it was not used. api.imf.org (public SDMX) serves the same WEO series.
- WEO files carry `WLD`, `EUU` and IMF group codes (G110 Advanced, G200 EMDE, G400 Middle East and Central Asia, ...; names in `W1-wb-entities.json` under `imf_aggregates`). No `MEA` there: IMF's Middle East and Central Asia group is not the World Bank MENA. IMF `KOS`/`WBG` were renamed `XKX`/`PSE`.
- WB aggregates are missing for current account, reserves, Gini (no `WLD`). WB GC.DOD.TOTL.GD.ZS (central government debt) is sparse (120 entities, LBN 1997-1999 only); use `WEO.GGXWDG_NGDP` for debt.
- Not found as a single clean source: 2025 and 2026 WB values (lag one to two years). Tourism receipts for LBN stop at 2020.
- Not in OWID: electricity per capita before 2000 for most countries.

## Refresh
`python3 cache/hub-W1/fetch_w1.py` (raw responses cached in `cache/hub-W1/raw/`; delete a file there to refetch). OWID files were built from `owid_gen.csv` / `owid_dem.csv` downloaded from `ourworldindata.org/grapher/<slug>.csv?useColumnShortNames=true`. Edit `WB` / `IMF` lists in the script to add indicators. User-agent `LebanonHub/1.0 (research)`, 0.6 s between calls.
