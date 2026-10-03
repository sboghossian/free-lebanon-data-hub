# Contributing

Thank you for helping. The Hub is only as good as its sources, so most contributions are a row, a link or a correction.
You do not need Jev, a browser or an API key for any of it. Everything below runs on Python 3 and its standard library.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Code is MIT, data is CC BY-SA 4.0
(see [DATA-LICENSE.md](DATA-LICENSE.md)); your contribution is released under the same terms.

## Quick start

```bash
git clone https://github.com/sboghossian/free-lebanon-data-hub
cd free-lebanon-data-hub
python3 build/build_timeline.py                  # about 30 seconds; writes site/lebanon-timeline.html and site/data/**
python3 -m unittest discover -s build -p 'test_*.py'
python3 -m unittest discover -s tools
python3 tools/validate_research.py               # every research file parses; every "file:line" key points at its row
```

Open `site/lebanon-timeline.html` in a browser, or serve `site/` with `python3 -m http.server` (the tabs fetch `data/...`,
which does not work over `file://`). The build exits 1 if an interface string has no Arabic or French text.

Open a pull request against `main`. Keep it small: one event, one source, one dataset or one fix.

## How to add an event

Timeline rows live in `research/NN-name.timeline.jsonl`, one JSON object per line. Add your row to the file whose range
fits the date (for example `research/53-second-republic-1991-2022.timeline.jsonl`), at the end of the file.

```json
{"date": "2026-01-12", "track": "economy", "title": "A short factual headline", "why": "One sentence of context.",
 "type": "other", "actors": ["Name"], "place": "Beirut", "law_no": null, "deaths": null,
 "source": "https://example.org/page", "confidence": "✅", "weight": 1}
```

| field | rule |
|---|---|
| `date` | `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, a decade (`1970s`) or a range (`1975-1990`). Never after 30 Sep 2026 and never before 1800; the build drops such rows. |
| `track` | `politics`, `war`, `regional`, `social`, `legal`, `economy`, `crisis`, `innovation`, `environment`, `life`, and a few more listed as `TRACK_NEW` in `build/data.py`. |
| `title`, `why` | Plain English, no marketing words, no em dashes. State the fact, not the opinion. |
| `source` | One public link to a page that states the fact. Prefer an official, academic or established press source over a blog. |
| `confidence` | One of the three tags below. |
| `weight` | 1 (minor), 2, or 3 (a key event). Optional. |

Append rows. Do not insert or delete rows in the middle of a file: files `20-facets.jsonl`, `40-grounding.jsonl` and
`research/strikes/_grounding.jsonl` point at rows by `"file:line"`. If a row has to be removed, use
`python3 tools/remap_keys.py --drop FILE.jsonl:INDEX --code build/data.py`, which removes it and fixes every key.

### Confidence tags

- `✅` verified: you read a source that states it.
- `📣` reported: a source says so and you did not check it, or sources disagree.
- `🧪` inference: a likely reading, marked as one. Add `"needs_source": true`.

Never raise a tag to make a row look better. A row with no source stays `🧪`.

### Neutrality rules

- Report what sources document. Attribute contested claims ("per the health ministry", "according to the IDF").
- For tolls, give the counter, the date and the range only where both ends count the same thing.
- No row may name a private person. Public office holders and public figures acting in their role are fine.
- Do not copy article text. Titles and one-sentence notes in your own words only.
- A mapped strike is a documented incident, not a casualty count.

## How to add a source

Every row should link to the page that supports it. To fix a weak or dead link, edit the row's `source`. To add a second
source for a fact, open an issue with the row, the link and one line on what the page says. Source tiers
(T1 official, T2 academic, T3 press, T4 reference) come from the domain tables in `build/jev_supervise.py`; add a
domain there with a one-line reason if it is missing.

## How to add a dataset

- **Catalogue entry** (a public dataset we link to): add a line to the right `research/portals/<portal>-catalogue.jsonl`
  with `portal`, `title`, `publisher`, `topic`, `years`, `granularity`, `format`, `url`, `license`, `updated`, `notes`.
  Run `python3 build/check_catalogue.py` to test the link politely (about two requests a second per host).
- **A series we host** (values, not just a link): add it to a `research/hub/series/*.json` file in the shape
  `{"id", "label", "unit", "topic", "freq", "source_url", "license", "points": [["2024-01", 89500]]}`.
  Write the source's licence exactly as it states it, or `null` if none. `build/hub/README.md` has the full contract.
- **World indicator**: `research/hub/world/indicators/<ID>.json`, see `research/hub/README-W1.md`.
- Add a short note in `research/hub/README-*.md` saying where it came from, what it is not, and how to refresh it.
- Never add a dataset whose licence forbids redistribution. If the terms are unclear, say so in the pull request and
  set `"redistribute": false`; the page will show it with attribution and offer no download.

## How to add or fix a translation

The interface and content are in English, Arabic and French.

- Interface strings: `build/i18n/ui_<tab>.json`, `{"English text": {"ar": "...", "fr": "..."}}`.
- Content strings (event titles and notes): `research/i18n/src-strings.jsonl` holds the English, and
  `research/i18n/ar/part-NN.jsonl` and `research/i18n/fr/part-NN.jsonl` hold `{"h": "<sha1(English)[:12]>", "t": "..."}`.
  To fix one, edit its `t`. `hub.lib.sha12(english)` gives the key.
- Keep numbers, names of laws and dates intact. Do not translate names of candidates.
- Translations so far were made by language models and checked by scripts and samples. Native-speaker edits are the most
  valuable contribution here.

## How Jev grounding works (optional)

Jev is a small model from [TypeSafe](https://docs.typesafe.ai) that returns typed judgments with probabilities. The Hub
uses it for one job: given a row and the text of the page it cites, does the page support the row? Code fetches the
page and chooses the passage; Jev answers one yes/no probability; code owns the thresholds and every write.
Results are in `research/40-grounding.jsonl` (verdicts `grounded`, `weak`, `unsupported`, `data_source`, `unchecked`) and are
shown on each source in the page. Jev never judges data pages, and page text is only ever passed to it as data.

Grading is optional. The checked-in verdicts are enough to build the Hub. To re-grade your new rows:

```bash
export TYPESAFE_API_KEY=...                       # the only place the key is read from
python3 build/jev_supervise.py fetch              # page cache under cache/ (git-ignored)
python3 build/jev_supervise.py events             # grades rows, writes research/40-grounding.jsonl
python3 build/strike_check.py                     # same idea for strike incidents
```

Responses are cached under `cache/jev/`, so re-running is free. Without a key the grading steps stop with an error
(`TYPESAFE_API_KEY is not set`) and the build still works. Do not commit `cache/` or your key.

## The checks

| What | Command | Needs |
|---|---|---|
| Python unit tests (data, strikes, gazetteer, i18n, emitters, harvest) | `python3 -m unittest discover -s build -p 'test_*.py'` | Python 3 |
| Tool tests | `python3 -m unittest discover -s tools` | Python 3 |
| Research JSON and key integrity | `python3 tools/validate_research.py` | Python 3 |
| Dataset link check | `python3 build/check_catalogue.py` | network |
| Browser checks (layout, i18n, accessibility, every tab) | `node build/check_tl.mjs site/lebanon-timeline.html build/_check` | Node, Chrome; about 12 minutes |

CI runs the first three plus the build on every push and pull request. It uses no network and no Jev. The browser checks
are run by hand before a release; never run the build while they run, because the build deletes `site/data/`.

## Before you open the pull request

- The build passes and the unit tests pass.
- Every new row has a public source and an honest tag.
- No private names, no personal paths, no keys. The repository is public and its history is permanent.
- You did not reorder existing rows.
