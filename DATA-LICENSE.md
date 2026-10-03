# Data licence

## The Hub's own data: CC BY-SA 4.0

The compilation, the timeline rows, the translations and every file the Hub produces itself are licensed under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
You may copy, reuse and adapt them if you credit the Hub and the original source of the item, and share your changes
under the same licence.

Suggested credit: `Boghossian, Stephane, with Claude. Free Lebanon Data Hub. https://github.com/sboghossian/free-lebanon-data-hub`

The code (everything under `build/` and `tools/`) is under the MIT licence, see [LICENSE](LICENSE).

## Third-party sources keep their own terms

The CC BY-SA 4.0 grant covers what the Hub added. It does not relicense what a source published. Every file the build
writes lists its own licence in `site/data/manifest.json`, and the per-dataset notes are in `research/hub/README-*.md`.
Where a source states no licence, only facts are republished, with attribution, and the file says so.

| Source family | Terms | Where it appears |
|---|---|---|
| Wikipedia text and tables | CC BY-SA 4.0 | most timeline rows, elections, offices |
| World Bank Open Data, Real Time Prices, KNOMAD | CC BY 4.0 (some CC BY 3.0 IGO) | exchange rates, prices, world indicators |
| Our World in Data, Ember, Energy Institute (via OWID) | CC BY 4.0 | world and energy series |
| Open-Meteo, Copernicus ERA5 | CC BY 4.0 | climate series |
| OCHA, UNHCR, FAOSTAT via HDX | CC BY and CC BY-IGO | places, displacement, exchange rates |
| GeoNames | CC BY 4.0 | Arabic place names |
| Wikidata | CC0 | Arabic place names |
| OpenStreetMap contributors | ODbL 1.0 | place names and coordinates taken from OSM |
| World Bank Light Every Night | ODbL 1.0 | night lights |
| Kontur population | CC BY 4.0 | district resident estimates |
| V-Dem | CC BY-SA 4.0 | governance indicators |
| NASA FIRMS | free to use with acknowledgement | fire hotspots |
| Natural Earth | public domain | world map outlines |
| UNDP, IFES, IPU Parline, IDEA | no open licence stated; facts only, attributed | elections |
| Lebanese ministries, CAS, BDL, EDL, Parliament | no licence stated; facts only, attributed | official figures, laws index |
| ACLED | attribution required, under ACLED's terms; the data is not in this repository | optional strike aggregates (see `research/strikes/ACLED-README.md`) |

## What is excluded from downloads (`redistribute: false`)

These sources are shown in the page with attribution, but the Hub does not offer them as CSV or JSON downloads and
does not put them under CC BY-SA:

| Source | Why | Files |
|---|---|---|
| IMF World Economic Outlook, April 2026 | The [IMF terms](https://www.imf.org/en/About/copyright-and-terms) allow reuse with attribution but ask for permission for bulk automated download. This is not an open licence. | 13 files in `research/hub/world/indicators/WEO.*.json`, flagged `"redistribute": false` |
| World Bank WITS and UN Comtrade trade flows | No open licence stated by WITS; UN Comtrade has its own terms. | trade series in the World tab |
| CAS figures with no stated licence | Shown with attribution, not offered as a CSV. | flagged per series in the manifest |

The build enforces this: a series flagged `redistribute: false`, or whose licence text forbids redistribution, is drawn on the page but never written to a download file (`redistributable()` in `build/hub/lib.py`).

## Laws index

The index holds titles, numbers, dates and short English summaries of public legislation, each with a link to the full
text. The Hub never republishes article text, because neither the Legal Informatics Centre of the Lebanese University
nor the Parliament states a licence.

## Removing something

If you hold rights to an item and want it removed, open an issue using the "Correction" template. We will remove it
and rebuild.
