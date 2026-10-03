# D9: fires, climate, air quality

## Outputs
- `fires/firms-lbn.json` (~165 KB): 4,524 cells of 0.05 degrees (lat/lon = cell centre) per month. `by_year` 2000-2024. Primary `cells`/`by_year` use MODIS (Terra+Aqua, 1 km) for 2000-2011 and VIIRS S-NPP (375 m) for 2012-2024. The two sensors differ in sensitivity, so counts jump at 2011/2012; do not read that jump as more fires. Extra keys give a consistent single-sensor view: `cells_modis` + `by_year_modis` (2000-2024), `by_year_viirs_snpp` (2012-2024).
- `series/D9-climate.json` (~370 KB): 20 monthly series (mean/max/min temperature in C, total precipitation in mm) for Beirut, Tripoli, Zahle, Tyre, The Cedars, 1940-01 to 2026-09 (1,041 months each).

## Sources and licences
- NASA FIRMS country archives, https://firms.modaps.eosdis.nasa.gov/data/country/{modis,viirs-snpp}/YYYY/*_Lebanon.csv. No key needed. NASA open data: free reuse with acknowledgement.
- Open-Meteo Historical Weather API (ERA5), https://archive-api.open-meteo.com/v1/archive. CC BY 4.0; attribute Open-Meteo and Copernicus/ECMWF ERA5.

## Method and caveats
- Fires: detection type 0 only (presumed vegetation fire); type 2 (offshore, 41 MODIS / 1,304 VIIRS) and type 3 (static source, 68 VIIRS) excluded. Counts are hotspot detections, not fires or burned area. Confidence not filtered.
- Climate: ERA5 reanalysis (~25 km grid), not station data. Grid-cell elevations: Beirut 33 m, Tripoli 71 m, Zahle 959 m, Tyre 9 m, Cedars 1,892 m. Monthly values from daily (Asia/Beirut); months with fewer than 27 days omitted (Sept 2026 needs 25, partial).

## Gaps
- FIRMS country archives stop at 2024. noaa20/noaa21 country files return 404. 2025-26 and NOAA-20/21 need a NASA MAP_KEY (free account); not used. Stephane decides.
- Air quality: OpenAQ v3 API returns 401 without an X-API-Key (free account). v1/v2 are retired. The public S3 archive (openaq-data-archive) needs Lebanese location IDs, which come from the API. Not fetched. With a key: `/v3/locations?coordinates=33.8938,35.5018&radius=25000`, then monthly means of pm25/no2 as series.

## Refresh
Raw files in `cache/hub-D9/` (`dl.py` fetches FIRMS, `agg.py` builds fires, `clim.py` + `mk.py` build climate). Re-run each; change the end date in clim.py. Open-Meteo throttles long ranges; clim.py sleeps between calls.
