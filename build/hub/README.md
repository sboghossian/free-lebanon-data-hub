# Free Lebanon Data Hub: plugin guide

The shell, the loader, the router, i18n and the checks are shared. You add data and screens by filling in **your own tab's files**. Avoid editing another tab's files, `build_timeline.py`, `check_tl.mjs` or `hub_*.js` in the same pull request; if something shared must change, say so in the PR description.

## What the build produces

```
site/lebanon-timeline.html     the shell + the core timeline data (events, eras, offices, core series). Never needs a fetch.
site/data/**                   lazy files, fetched on first use of a tab. Rebuilt from scratch on every build.
  csv/timeline.csv, csv/strikes.csv, csv/catalogue.csv, csv/series/<topic>.csv, csv/world/<topic>.csv      downloads (the last two are long-format topic files holding keys and values only: `series_id,t,value` and `iso3,indicator_id,year,value`; labels, units, sources and licences are in `csv/series-dictionary.csv`, `csv/world-dictionary.csv` and `csv/countries.csv`)
  strikes/*.json, portals/*.json, i18n/{ar,fr}.json, ...                      what the tabs load
  manifest.json              every file: path, title, kind, source, licence, size, rows
site/publish_files.json     {published path: local path} for every file under data/ (the page is site/lebanon-timeline.html)
```

Limits: at most 400 files in all (the artifact holds 511 per version, one publish call sends 255; the build asserts it), each file at most 8 MB (the build refuses more: split by year, indicator, region), the whole set under 200 MB.
Licence: the Hub's data is **CC BY-SA 4.0 unless a source says otherwise**. Pass the source's licence to `ctx.write_*` when it differs; never publish a dataset whose licence forbids redistribution.

Build: `python3 build/build_timeline.py` from the repo root (about 20 s). It exits 1 if a UI string has no Arabic or French text.
Check: `node build/check_tl.mjs site/lebanon-timeline.html build/_check_v7` (serves site/ with `python3 -m http.server`; about 12 minutes). While you work on one tab: `... build/_check_v7 --only=places,hub` runs just those `checks/*.mjs` files. Python tests: `cd build && python3 -m unittest discover -s . -p 'test_*.py'`.
Paths in the page are relative (`data/...`). If the published page is not served next to `data/`, build with `HUB_BASE=https://host/dir/ python3 build_timeline.py` (it sets `<meta name="hub-base">`, which the loader prefixes).

## The five files of a tab

For a tab with id `<tab>` (`places`, `cost`, `electricity`, `world` already exist as stubs):

| file | what it does |
|---|---|
| `build/hub/emit_<tab>.py` | `TAB = {"id", "label", "order", "routes": [...]}` and `emit(ctx)`: writes the data files, returns the panel and small inline bits |
| `build/js/tab_<tab>.js` | `HUB.tab("<tab>", { render(args, info) { ... } })` |
| `build/css/tab_<tab>.css` | the tab's styles (theme tokens, logical properties) |
| `build/checks/<tab>.mjs` | `export default async function (T) { ... }` |
| `build/i18n/ui_<tab>.json` | `{"English text": {"ar": "...", "fr": "..."}}` for every string your tab shows |

`build_timeline.py` finds them by file name: `emit_*.py` sorted by `TAB["order"]` (timeline 10, map 20, places 40, cost 50, electricity 60, world 65, data 70, about 80), `js/tab_*.js` and `css/tab_*.css` sorted by name, `i18n/ui*.json` all merged. `check_tl.mjs` runs every `checks/*.mjs` after the core checks. A tab id is also its panel id (`#places`), its button id (`#t-places`) and its root element (`#placesRoot`).

### emit_<tab>.py

```python
from hub.lib import stub_panel          # also: sha12, safe_name
TAB = {"id": "places", "label": "Places", "order": 40, "routes": ["place"]}   # routes: extra hash routes this tab owns (#place/<pcode>)

def emit(ctx):
    # ctx.d (core data), ctx.S (strike build), ctx.counts, ctx.research (research/ dir), ctx.hub_research (research/hub/ dir), ctx.build_dir
    rows = [...]                                                      # read research/hub/villages/*.jsonl here
    ctx.write_json("places/index.json", {...}, "Places: 3,500 villages and towns", source="OCHA COD-AB", license="CC BY-IGO", rows=len(rows))
    ctx.write_csv("csv/places.csv", ["pcode", "name", ...], table, "Places: one row per village", source="...")
    ctx.series_csvs(series_list, "cost")                              # adds each series to its topic's long CSV (lib.SERIES_GROUPS maps the prefix to the topic); returns the CSV path per series, None if the licence forbids redistribution. Put `dict(s, csv=path)` in your JSON; the UI says which series_id to filter
    return {
        "panel": stub_panel("places", "Places", "lead sentence", "empty-state sentence"),   # or your own <section class="hub-panel" id="places" ...>
        "inline": {"n": len(rows)},       # small bits for the JS: window.HUB.data.tabs.places (keep it under ~50 KB; it is inside the shell)
        "counts": {"places": len(rows)},  # optional: counts merged into D.counts
    }
```

Rules: write only under `data/` through `ctx` (it lists the file in `manifest.json` and `publish_files.json`); never write into `research/`; keep the panel markup English (it is translated at runtime, see i18n); give every file a title, a source URL and a licence; put heavy data in lazy files, not in `inline`. The page already links the `data-hub`-style tabs, so a panel needs only `<section class="hub-panel" id="<tab>" role="tabpanel" aria-labelledby="t-<tab>" hidden>`. Use `stub_panel` unless you need more.

### tab_<tab>.js

The scripts share one scope (an IIFE), so every helper below is a plain name, and also on `window.HUB`.

```js
HUB.tab('places', { render(args, info) {
  // runs each time the tab opens, and again when the language changes (info.lang). args = hash arguments ('#place/LB1234' -> ['LB1234']).
  // info = { route: 'place', first: true on first open, lang: true after a language change, same: the tab was already open }
  const root = $('#placesRoot');
  if (!D.tabs.places.n) return;                                   // no data in this build: the empty state from the panel stays
  hubLoadInto(root, ['data/places/index.json'], index => {       // spinner now, error state with Retry on failure, then your build runs
    root.innerHTML = `<h3>${esc(t('Search places'))}</h3>`;       // every visible string through t()
    HUB.setHash('place', 'LB1234');                               // update the address without re-rendering
  });
} });
```

`window.HUB` API (names in the shared scope are the same):

- Data: `hubLoad(path, {as:'json'|'text', retries, timeout})` returns a cached promise (a failure is not cached); `hubLoadInto(el, paths, build, opts)` shows the spinner (`.hub-load`, `aria-busy`), calls `build(...results)`, or shows `.hub-err` with a Retry button. Paths are relative to the page: `data/world/indicators/NY.GDP.PCAP.CD.json`. Fetch only what the view needs; the loader caches.
- Routing: `HUB.setHash(route, ...args)`, `HUB.href(route, ...args)` -> `'#place/LB1234'`, `HUB.parse(hash)` -> `{route, args, tab}`, `HUB.show(tab, {args})`, `HUB.current`. Links between tabs: `<a href="#place/LB1234" data-hub="places" data-hash="place/LB1234">`.
- i18n: `t(en, vars)`, `th(en)` (HTML-safe, adds the EN mark when a content string has no translation), `tc(en)` (same as `t`, for attributes), `tH(en, htmlVars)`, `tp(one, many, n, vars)`, `tpH(...)`, `N('text')` (marks a string in a table), `onLang(fn)`, `LANG`, `isRTL()`.
- Formats: `nf(n, digits)`, `fmt(n, digits)`, `fmtDate('1975-03-13')` -> `13 Mar 1975` / `13 mars 1975` / `١٣ آذار ١٩٧٥`, `fy(year)`, `nfCompact(n)`, `fmtBytes(n)`, `esc(s)`, `monShort(i)`. All follow the language through `Intl` (en-US, ar-LB, fr-FR).
- Charts: `hubLine(el, {series:[{id,label,pts:[[x,y]],dash}], height, yMin, yMax, log, xFmt, yFmt, valFmt, markers:[{x,label}], title, highlight})` (hover tooltip, arrow keys, legend, resize); `hubBars(el, {items:[{id,label,value,hi}], fmt, max})`; `hubScatter(el, {points:[{id,label,x,y,hi}], xLabel, yLabel, xFmt, yFmt, onPick})` returns `{r, n}` and prints `r = ...`; `hubSpark(pts, label)`; `pearson(xs, ys)`; `laggedCorr(a, b, maxLag)` for two `[[year, value]]` series; `niceTicks`; `HUB_COLORS` (CSS variables, so charts follow light and dark). Charts and maps stay left-to-right in Arabic on purpose.
- Misc: `store.get/set` (localStorage inside try/catch; use it, never raw `localStorage`), `nrm(s)` (accent-insensitive lower case for search), `$`, `$$`.

Do not declare a variable named `t`, `th`, `tp`, `nf`, `fy`, `N`, `HUB`, `LANG` in a scope where you call `t(...)`: a local `t` hides the translator and you get "t is not a function". Use `tm`, `tv`, `ty`.
Libraries only from cdnjs, cdn.jsdelivr.net/npm, unpkg, cdn.tailwindcss.com or code.jquery.com. No external images (textures and geometry are published files or inline). Never use the `assets` or `mcp` capabilities.

## CSS and the theme

Everything uses the tokens in `build/style.css` (`:root`, redefined for dark under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`). Never hard-code a colour.

- Surfaces and text: `--ground` (page), `--paper` (cards), `--stone`, `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-2`, `--on-strong` (text on a strong fill), `--shadow`.
- Brand: `--cedar` (primary), `--diesel` (amber), `--sea` (blue), and the soft fills `--cedar-soft`, `--diesel-soft`, `--sea-soft`.
- Status: `--good`, `--warn`, `--bad` (+ `-soft`), `--war`, `--occ`, `--vac`.
- Series colours: `--l-pol --l-econ --l-soc --l-tech --l-env --l-law --l-hist --l-region --l-world --l-work --l-agree --l-life`.
- Type: `--display` (Bricolage Grotesque; headings, controls), `--body` (Source Serif 4), `--mono` (DM Mono; numbers, ids). In Arabic they switch to IBM Plex Sans Arabic and Noto Naskh Arabic.
- Ready-made classes: `.hub-panel`, `.lead`, `.note`, `.hub-empty` (empty state), `.chip`, `.chips`, `.sel` (label + select), `.d-h` (section heading), `.mono`, `.dim`, `.cf cf-verified|reported|inference`, `.hc` chart helpers (see `build/hub.css`).
- The globe follows the tokens with a solid ocean, no photo textures, and Lebanon always findable.
- Layout: 16px side gutter comes from `.wrap`; nothing may scroll the page sideways at 390px. Put wide things in their own `overflow-x:auto` box.
- RTL: write logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align:start`). `html[dir=rtl]` mirrors the flow; time axes, charts and maps are forced `direction:ltr` in `hub.css` (add yours to that rule's list by using the class `.hc` or an `svg`).

## i18n (EN, AR, FR)

- The English text is the key. `t('Search places')` looks up `sha1('Search places')[:12]` in the language tables. Markup you emit in `emit_<tab>.py` is translated at runtime: the text nodes and the `placeholder`, `aria-label`, `title`, `alt` attributes are recorded once in English and re-translated on every language change. Anything a script renders later must go through `t()` itself. Add `data-notr` to an element to skip it (numbers, names, search-query examples).
- Plurals: `tp('{n} place', '{n} places', n)`. Placeholders are `{name}` and need a vars object: never put a value inside a JS template literal that is the argument of `t()`. HTML inside a string: `tH('{a} of {b}', {a: '<b>1</b>', b: '2'})` (the template is escaped, the vars are yours).
- Strings in tables: `N('Cost of living')` marks it for the build; translate where it is shown: `t(row.label)`.
- Where the strings live: `build/i18n/ui.json` (core) and `build/i18n/ui_<tab>.json` (yours): `{"English text": {"ar": "...", "fr": "..."}}`. Fill AR and FR yourself for **every** UI string. `build_timeline.py` collects all static text, all `t()/tH()/tp()/N()` literals and the data vocabulary, then prints `MISSING UI STRING` / `MISSING TRANSLATION` and exits 1 until each has both languages. A value of the same text is fine for names (`"OCHA": {"ar": "OCHA", "fr": "OCHA"}`).
- Content strings (event titles, why lines, strike titles, dataset fields, series labels): `th(s)` for HTML, `t(s)` / `tc(s)` for text. They are translated by hash from `data/i18n/{ar,fr}.json`, which the build assembles from `research/i18n/{ar,fr}/part-*.jsonl` (`{"h": sha1(en)[:12], "t": translation}`). A string with no translation, or whose English changed since (a stale hash), shows in English with a small **EN** mark; the page never breaks. If your tab has its own content strings (place names, indicator labels), put them in the translation source list (`research/i18n/src-strings.jsonl` is owned by the translation leg) or add them to your `ui_<tab>.json`.
- Numbers and dates: always `nf()`, `fmt()`, `fmtDate()`, `fy()`; they use `Intl` with ar-LB (Arabic-Indic digits, Levantine month names), fr-FR, en-US. Years on chart axes use `fy()`.
- Dir: `html[dir=rtl]` and `html[lang=ar]` are set by `setLang`; `HUB.onLang(fn)` runs after a change, but `render(args, info)` already gets `info.lang`.
- Language is remembered in `localStorage('hub-lang')` (try/catch via `store`); `?lang=ar` forces a language for one visit and is not stored.

## Checks (build/checks/<tab>.mjs)

```js
export default async function (T) {
  const { ok, sleep, open, fixture, marks, readData } = T;
  const p = await open(1400);                         // a page at 1400 px on the real site; open(390) for mobile; open(1400, T.SITE, { query: '?lang=ar' }) for Arabic
  await p.ev('document.getElementById("t-places").click()'); await sleep(300);
  ok('places: the tab opens', await p.ev('!document.getElementById("places").hidden'));
  await p.wait('document.querySelectorAll("#placesRoot li").length > 0', 8000);   // poll an expression
  ok('places: 0 console errors', p.errors().length === 0, p.errors());
  await p.close();
}
```

`T` = `{ ok(name, pass, detail), sleep, open(width, rel?, {query, hash, allow, ready}), fixture(name, mutateD, files), readData(rel), siteDir, out, SITE, WEB, URL_OF, get(rel), marks, checks }`. A page has `ev(js)` (awaits promises), `wait(js, ms)`, `key(name)`, `shot(file)`, `errors()`, `close()`. `fixture('x', D => {...}, {'places/index.json': '{...}' | null})` serves a copy of the page with changed core data and replaced (or, with `null`, missing) data files, so you can test empty states and error states without touching real files. `open(..., { allow: /regex/ })` ignores expected network errors (a 404 on purpose). Chrome runs with `--use-angle=swiftshader --enable-unsafe-swiftshader`, so WebGL works headless. Always close your pages. Language is shared across pages through localStorage: end an Arabic test by switching back to English or by using `?lang=`.

What every tab must pass (copy the stub's checks and extend): the tab opens by click and by deep link, 0 console errors at 1400 and 390, `document.documentElement.scrollWidth <= 390` at 390, an honest empty state when its data is missing, an error state with Retry when a fetch fails, and the same in Arabic (`dir=rtl`, no overflow).

## Deep links

`#<tab>` or `#<route>/<arg>/<arg>`: `#place/LB1234` (Places), `#world/<indicator>/<year>` and `#compare/<indicator>/LBN,SYR,JOR` (World; the `world` tab declares `routes: ["compare"]`). Your `render(args, info)` gets the arguments; call `HUB.setHash(...)` as the user changes state so the address always reproduces the view. An unknown hash falls back to the Timeline.

## Where things are

- `build/js/hub_i18n.js` (t, formats, language switch), `hub_load.js` (loader), `hub_charts.js` (charts, r), `hub_tabs.js` (router, `HUB`), `hub_data.js` (Data tab), `tl_map.js` (Strike map tab: reads `data/strikes/*.json`).
- `build/hub/lib.py` (`Ctx`), `hub/i18n.py` (string collection), `build/hub.css` (shell, loader, charts, RTL).
- The Data tab lists everything in `data/manifest.json` under Downloads; register your files through `ctx` and they appear there with their licence.

## Integration and hardening notes (2026-10-02)

- **Translation of data strings.** Every key in `build/i18n/ui*.json` now also ships in `data/i18n/<lang>.json`, so a string that data renders (series label, unit, note, election list, war table row) is translated with `t()`/`th()` even when no JS literal names it. `ui_content.json` holds ~1,700 of them, `ui_data.json` the Data tab (laws topics, enums, camp names), `ui_about.json` the About tab, `ui_fixes.json` corrections from the French audit (Berri, Baalbek, neutrality wording). Re-run when data changes: `python3 build/i18n_tools/gap.py gap.json` lists the content strings with no Arabic, `python3 build/i18n_tools/translate.py gap.json` translates them with headless `claude -p` and validates numbers and scripts, `python3 build/i18n_tools/dl_gap.py` lists Downloads titles still in English. `build/i18n_coverage.json` is written by every build (coverage per kind and language).
- **Downloads titles** are translated in the page by `dlTitle()` in `hub_data.js`: family patterns (World tables), the sentence with numbers swapped for `{n1}`, then "label (unit)".
- **Laws** (5,366 laws and decrees, `research/hub/laws`) are in the Data tab (`emit_data.py`, `data/laws/index.json` fetched when the section opens, `data/csv/laws.csv`). Licence: none stated by the sources, titles, numbers and dates only.
- **About** is `emit_about.py` (text) plus `tab_about.js` (counts, Jev verdict shares, translation coverage, copy-citation button). Nothing numeric is typed in the text.
- **Accessibility**: skip link (`#skipLink`), `--ink-3` darkened for WCAG AA, checks in `checks/a11y.mjs`. **Performance**: `checks/perf.mjs` (size budget, first paint, nothing under `data/` fetched before its tab opens). **Audit**: `checks/zz_audit.mjs` visits every tab, sub-view and language at 1400 and 390 and lists visible English left in Arabic and French. **Screenshots**: `checks/zz_shots.mjs`.
- Never run `build_timeline.py` while `check_tl.mjs` is running: the build deletes `site/data/` and the check serves it.

## v8: the "What is incomplete" fixes (2026-10-03)

Each gap listed on the About page now has a fix on the page, and About says what was done and what still cannot be done (`emit_about.py`, list `#aboutGaps`).

| Gap | Where | What | Files |
|---|---|---|---|
| Strike map | Strike map | `research/strikes/geocode-overrides.jsonl` is applied after the gazetteer (`strikes.geocode`: an override that names the row's district always wins; one with no district fills rows the gazetteer could not place; area text is never overridden). Per war, an "Official toll" panel from `research/hub/series/T-war-totals.json` shows who counted and when next to what the mapped incidents add up to | `strikes.py`, `test_strikes.py` (class `Overrides`), `hub/emit_map.py` (`TOLL_MAP`, `data/strikes/tolls.json`), `js/tl_map.js` (`mapToll`), `css/tab_map.css` |
| Places | Place page | registered voters 2014 (Interior Ministry lists via lub-anan.com), the 2022 figure scaled by the district change, a Kind column ("estimate", "registered voters, not residents"); there is NO per-place resident estimate (the research removed it on 3 Oct 2026: the cadaster split gave impossible figures), only district resident estimates by source (`cazas.json` `est`, from the P-population caza records; OCHA totals withheld where the research calls them unreliable); Arabic names from `P-arabic-names.jsonl` (the one disputed name is left out); a 1932 census note above the table | `hub/fb_places.py`, `js/tab_places.js` |
| Cost, electricity | Cost of living, Electricity | `C-continuity.json` merged by `hub/fb_continuity.py`: fuel and generator-fee series keep their ids and gain the dates the ministry listing lacks, which are `filled` (hollow dots, basis and source in the tooltip); US dollar and canister series are recomputed with the research rule after checking it reproduces the published points; bread (decisions, month by month, WFP shop price) and generator kWh prices added; the supply-hours PROXY has its own block with the method | `hub/fb_continuity.py`, `js/hub_charts.js` (`marks`), `js/tab_fb_shared.js` (`fbMarks`), `js/tab_cost.js`, `js/tab_electricity.js` |
| World | Compare | after a country's last actual year (`weo-estimates-start.json`; Lebanon's own per-indicator years from `lebanon-national.json`) the line is dashed and a shaded band is drawn; UN WPP indicators (9) are dashed from 2024; the toggle "Lebanon national sources" lays CAS and other national series over the IMF and World Bank ones | `hub/emit_world.py` (`national`), `js/tab_world_compare.js`, `js/hub_charts.js` (`estFrom`, `zones`) |
| Laws | Data | `L-patches.jsonl` applied by `source` (full-text link, English summary, three annulled laws, the 2026 budget law number) and `L-new.jsonl` added (15 laws of 2025) | `hub/emit_data.py` (`load_laws`), `js/hub_data.js` |
| Elections | Places, Elections | the 2026 election is a fact card: postponed, extension law, vote, Constitutional Council decision, new date | `js/tab_places_elections.js` (`eleStatusCard`) |
| Catalogue | Data | `research/portals/freshness.json` gives each dataset link a badge "Checked 3 Oct 2026: reachable / moved / unreachable", a filter and a summary line | `hub/emit_data.py` (`fresh_state`), `js/hub_data.js` |

Chart helpers added to `hubLine`: `series[].marks` (hollow dots on filled values, with tooltip text), `series[].estFrom` (dashed after this x), `zones` (shaded x-range with a label), `estNote`. Shared `tDates(s)` (`hub_i18n.js`) translates a data sentence that holds ISO dates.
Strings: `i18n/ui_map.json`, `ui_v8_places.json`, `ui_v8_cost.json`, `ui_v8_data.json` (elections, laws, freshness, World), `ui_v8_dl.json` (Downloads titles, sources, licences), `ui_v8_about.json`. Checks: `checks/v8_*.mjs`. Python tests: `test_v8.py`.
Run only the new checks: `node check_tl.mjs ../site/lebanon-timeline.html _check_v8b --only=v8_map,v8_places,v8_cost,v8_world,v8_elections,v8_data,v8_about`.

### v8b (2026-10-03, second pass on newer research)

- **Strike map**: `tolls.json` rows carry `killed_parts` (two labelled figures) instead of `killed_low/high` where the research says the two ends count different things (1982, siege of Beirut, 1996, 2006; labels in `emit_map.TOLL_MAP`, last field). A range is shown only for the same quantity.
- **Places**: no per-place resident estimate (removed from the research). The district block ("Residents of the district, by source") comes from `cazas.json` `est`.
- **World**: Lebanon national sources (licence not stated) are published only as `data/world/lebanon-national.json` for the Compare overlay; there is no CSV of them.
- **Timeline**: `data.py` now registers `research/[5-8][0-9]-*.timeline.jsonl`, which adds the four deep legs (80 to 83, public-domain books on archive.org) and the 2026 extension-law row (84). Their titles and why lines are translated in `i18n/ui_content.json` (made with `i18n_tools/translate.py`).
- **About**: "What is incomplete" has nine items; `#aboutN` shows the number of rows with verdict `unchecked` in `research/40-grounding.jsonl` (computed at build in `emit_about.unchecked`).
- Elections 2026 card also lists its sources. New strings: `i18n/ui_v8c.json`. New check: `checks/v8_timeline.mjs`.
