"""Free Lebanon Data Hub: site/lebanon-timeline.html (the shell, with the core timeline embedded) plus site/data/** (lazy files, CSV downloads, manifest, translations).
Run it from anywhere: python3 build/build_timeline.py. Needs only the Python standard library; no network, no Jev.
Each tab is a plugin: build/hub/emit_<tab>.py (data files and panel markup), build/js/tab_<tab>.js, build/css/tab_<tab>.css, build/checks/<tab>.mjs, build/i18n/ui_<tab>.json.
They are found by file name; see build/hub/README.md. Writes site/publish_files.json ({published path: local path}). Never publishes.
Environment: HUB_ROOT (repo root), HUB_OUT (output html), HUB_BASE (prefix for data/ paths), HUB_PRIVATE_TERMS (optional, see build/privacy.py)."""
import glob, importlib, json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data, strikes, privacy
from hub import lib, i18n, i18n_cov

BUILD = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("HUB_ROOT", os.path.dirname(BUILD))
OUT = os.environ.get("HUB_OUT", os.path.join(ROOT, "site", "lebanon-timeline.html"))  # HUB_OUT is for fixture builds in tests
OUT_DIR = os.path.dirname(OUT)
HUB_BASE = os.environ.get("HUB_BASE", "")  # prefix for the relative data/ paths if the published page is not served next to its files (see build/hub/README.md)
PUBLISH = os.path.join(OUT_DIR, "publish_files.json")
os.makedirs(OUT_DIR, exist_ok=True)
shutil.rmtree(os.path.join(OUT_DIR, "data"), ignore_errors=True)   # data/ is rebuilt from scratch, so no stale file is ever published
d = data.build()
n = len(d["events"])
S = strikes.build(d["events"])  # geocodes research/strikes/*.jsonl; writes research/strikes/_unresolved.tsv
counts = {"events": n, "sources": len(d["lib"]), "datasets": 0, "incidents": S["stats"]["mapped"]}

# ---- plugins: build/hub/emit_<tab>.py, ordered by TAB["order"]
ctx = lib.Ctx(OUT_DIR, d, S, counts, data.R, BUILD)
mods = []
for p in sorted(glob.glob(os.path.join(BUILD, "hub", "emit_*.py"))):
    m = importlib.import_module("hub." + os.path.basename(p)[:-3])
    assert m.TAB["id"] == os.path.basename(p)[5:-3], (p, m.TAB)
    mods.append(m)
mods.sort(key=lambda m: (m.TAB.get("order", 50), m.TAB["id"]))
tabs_meta, panels, inline, extra_counts = [], {}, {}, []
for m in mods:
    tid = m.TAB["id"]
    r = m.emit(ctx) or {}
    panels[tid] = r.get("panel") or lib.stub_panel(tid, m.TAB["label"], "", "")
    inline[tid] = r.get("inline") or {}
    counts.update(r.get("counts") or {})
    extra_counts += [(k, v) for k, v in (r.get("count_labels") or {}).items()]
    tabs_meta.append({"id": tid, "label": m.TAB["label"], "routes": m.TAB.get("routes", [])})
assert [t["id"] for t in tabs_meta][0] == "timeline", tabs_meta

# ---- core data embedded in the shell: only the keys the timeline reads (claims and lib are empty here)
KEEP = ["events", "ranked", "eras", "series", "offices"]
blob_d = {k: d[k] for k in KEEP}
blob_d["claims"] = []
blob_d["lib"] = []
blob_d["counts"] = counts
blob_d["hub"] = {"tabs": tabs_meta, "licence": lib.DEFAULT_LICENSE}
blob_d["tabs"] = inline

css = "\n".join(open(os.path.join(BUILD, f)).read() for f in ["style.css", "v4.css", "map.css", "hub.css"])
css += "\n" + "\n".join(open(p).read() for p in sorted(glob.glob(os.path.join(BUILD, "css", "tab_*.css"))))
JS_PARTS = ["00_core.js", "hub_i18n.js", "hub_load.js", "hub_dl.js", "hub_charts.js", "tl_state.js", "tl_filters.js", "tl_detail.js", "tl_yearcard.js", "tl_evcard.js", "tl_render.js", "tl_bands.js",
            "tl_events.js", "hub_tabs.js", "hub_data.js", "tl_map.js"] + [os.path.relpath(p, os.path.join(BUILD, "js")) for p in sorted(glob.glob(os.path.join(BUILD, "js", "tab_*.js")))] + ["99_boot.js"]
js_parts = [(f, open(os.path.join(BUILD, "js", f)).read()) for f in JS_PARTS]
js = "\n".join(s for _, s in js_parts)


def fmt_n(k):
    return f"{counts[k]:,}"


COUNT_LABEL = {"events": "Events", "sources": "Sources", "datasets": "Datasets", "incidents": "Mapped incidents"}
cnt_html = "".join(f'<div><dt>{COUNT_LABEL[k]}</dt><dd data-count="{k}">{fmt_n(k)}</dd></div>' for k in COUNT_LABEL)
head = f'''<header class="hub-head">
  <div class="hub-top">
    <p class="eyebrow">Lebanon, 1800 to 30 Sep 2026</p>
    <div class="lang-sw" id="langSw" role="group" aria-label="Language"><button type="button" data-lang="en" lang="en" aria-pressed="true" data-notr>English</button><button type="button" data-lang="ar" lang="ar" aria-pressed="false" data-notr>العربية</button><button type="button" data-lang="fr" lang="fr" aria-pressed="false" data-notr>Français</button></div>
  </div>
  <h1>Free Lebanon Data Hub</h1>
  <p class="lead">Most Lebanese data is scattered, or was never published. This hub puts what exists in one place. Every item has a source. Where there is none, it says so.</p>
  <dl class="hub-counts" id="hubCounts" aria-label="What the hub holds">{cnt_html}</dl>
</header>'''
tabs = '<nav class="hub-tabs" role="tablist" aria-label="Sections">' + "".join(
    f'<button type="button" role="tab" id="t-{t["id"]}" data-tab="{t["id"]}" aria-controls="{t["id"]}" aria-selected="{"true" if t["id"] == "timeline" else "false"}" tabindex="{0 if t["id"] == "timeline" else -1}">{t["label"]}</button>' for t in tabs_meta) + '</nav>'
sections = "\n".join(panels[t["id"]] for t in tabs_meta)


LD = json.dumps({"@context": "https://schema.org", "@type": "Dataset", "name": "Free Lebanon Data Hub",
                 "description": "Sourced data on Lebanon: a timeline from 1800, strikes in its wars, places, cost of living, electricity, world indicators, elections, laws and a catalogue of public datasets.",
                 "creator": {"@type": "Person", "name": "Stephane Boghossian"}, "license": "https://creativecommons.org/licenses/by-sa/4.0/", "inLanguage": ["en", "ar", "fr"],
                 "spatialCoverage": {"@type": "Country", "name": "Lebanon"}, "temporalCoverage": "1800/2026-09-30", "isAccessibleForFree": True}, separators=(",", ":"))


def page(blob_json, i18n_json):
    return f'''<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="hub-base" content="{HUB_BASE}">
<title>Free Lebanon Data Hub</title>
<meta name="description" content="The free data hub on Lebanon: a sourced timeline from 1800, a strike map, every village and town, cost of living, electricity, the world compared, laws and public datasets. English, Arabic, French.">
<script type="application/ld+json">{LD}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400..700&display=swap">
<style>
{css}
</style>
</head>
<body>
<a class="skip" href="#main" id="skipLink">Skip to the content</a>
<main class="wrap tl-only" id="main">
{head}
{tabs}
{sections}
<footer class="hub-foot"><a href="https://github.com/sboghossian/free-lebanon-data-hub" rel="noopener">Open source on GitHub</a><span data-notr>MIT · CC BY-SA 4.0</span></footer>
</main>
<div id="tip" role="tooltip" hidden></div>
<script type="application/json" id="hubData">{blob_json}</script>
<script>
window.TL_ONLY = true;
{js}
</script>
</body>
</html>
'''


# ---- i18n: UI strings embedded in the page, content translations as data/i18n/<lang>.json. The markup does not depend on the translations, so build it first.
ui = i18n.load_ui(BUILD)
html0 = page("{}", "")
strings, bad = i18n.needed(html0, js_parts, d)
miss_ui, miss_tr = i18n.report(strings, ui)
tables = i18n.lang_tables(strings, ui)
blob_d["i18n"] = tables
src_strings = [json.loads(l) for l in open(data.R + "i18n/src-strings.jsonl", encoding="utf-8")] if os.path.exists(data.R + "i18n/src-strings.jsonl") else []
src_hashes = {r["h"] for r in src_strings}
live_hashes = set()
for e in d["events"]:
    live_hashes.add(lib.sha12(e["title"]))
    for p in e["parts"]:
        live_hashes.add(lib.sha12(p["title"]))
        if p.get("why"):
            live_hashes.add(lib.sha12(p["why"]))
tr_stats = {}
cov_data = i18n_cov.collect(os.path.join(OUT_DIR, "data"))   # content strings of the data files (series, notes, elections, war); the core 15k are src-strings.jsonl
cov_en = {r["en"] for r in src_strings} | {x for v in cov_data.values() for x in v}
cov_report = {"content_strings": len(cov_en), "ui_strings": len(strings), "ui_missing": len(miss_ui) + len(miss_tr)}
for lg in ("ar", "fr"):
    content, st = i18n.content_translations(lg, data.R, live_hashes, src_hashes)
    cov = sum(1 for h in src_hashes if h in content)
    st["coverage"] = f"{cov}/{len(src_hashes)}"
    tr_stats[lg] = st
    full = dict(content)
    full.update(tables[lg])
    full.update({lib.sha12(k): v[lg] for k, v in ui.items() if v.get(lg)})   # strings that data renders (not literals in the JS) live in ui_*.json too and ship in the lazy file
    same = sum(1 for x in cov_en if full.get(lib.sha12(x)) == x)
    done = sum(1 for x in cov_en if lib.sha12(x) in full)
    cov_report[lg] = {"translated": done, "same_as_english": same, "pct": round(100 * done / len(cov_en), 1),
                      "by_kind": {k: [sum(1 for x in v if lib.sha12(x) in full), len(v)] for k, v in sorted(cov_data.items())},
                      "core": [sum(1 for h in src_hashes if h in full), len(src_hashes)]}
    ctx.write_json(f"i18n/{lg}.json", full, {"ar": "Arabic translations: interface and content", "fr": "French translations: interface and content"}[lg],
                   "Translations by the Hub; keys are sha1(English)[:12]", "CC BY-SA 4.0", kind="data", rows=len(full))
blob_d["tabs"].setdefault("about", {})["tr"] = {lg: {"pct": cov_report[lg]["pct"], "total": len(cov_en)} for lg in ("ar", "fr")}
open(os.path.join(BUILD, "i18n_coverage.json"), "w", encoding="utf-8").write(json.dumps(cov_report, ensure_ascii=False, indent=1))
print("translation coverage", json.dumps({k: (v if not isinstance(v, dict) else {a: b for a, b in v.items() if a != "by_kind"}) for k, v in cov_report.items()}))
blob = json.dumps(blob_d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

# ---- manifest and publish list
ctx.write_dictionaries()
ctx.flush_long_csvs()    # the topic CSVs (series and world) are written once every emitter has added its rows
manifest = {"generated": "2026-10-02", "license": lib.DEFAULT_LICENSE, "note": "The Hub's data is CC BY-SA 4.0 unless a source says otherwise. Each file lists its own licence.",
            "files": sorted(ctx.manifest, key=lambda f: (f["kind"] != "csv", f["path"]))}
mpath = os.path.join(OUT_DIR, "data", "manifest.json")
open(mpath, "w", encoding="utf-8").write(json.dumps(manifest, ensure_ascii=False, indent=1))
ctx.files["data/manifest.json"] = mpath
total = ctx.total_size() + os.path.getsize(mpath)
assert total < lib.MAX_TOTAL, total
assert len(ctx.files) <= lib.MAX_FILES, (len(ctx.files), "files; the artifact holds at most 511 per version, so keep the set under", lib.MAX_FILES)
for rel, p in ctx.files.items():
    assert os.path.getsize(p) <= lib.MAX_FILE, (rel, os.path.getsize(p))
open(PUBLISH, "w").write(json.dumps(dict(sorted(ctx.files.items())), indent=1))

html = page(blob, "")
html = html.replace("—", ", ")
# Optional private-terms guard (build/privacy.py). Without a terms file nothing is scanned and nothing is reported.
PRIVATE = privacy.pattern()


def scan(text):
    return {"private term": [m.start() for m in PRIVATE.finditer(text)]} if PRIVATE else {}


bad_terms = scan(html)
for w, hits in bad_terms.items():
    for h in hits[:5]:
        data.WARN.append(f"EXCLUDED TERM {w!r} at {h}: ...{html[max(0, h - 80):h + 60]!r}...")
for rel, p in ctx.files.items():   # the same guard on every published data file (strikes, timeline CSV, catalogue, translations)
    if rel.endswith("manifest.json"):
        continue
    txt = open(p, encoding="utf-8").read()
    for w, hits in scan(txt).items():
        for h in hits[:3]:
            data.WARN.append(f"EXCLUDED TERM {w!r} in {rel} at {h}: ...{txt[max(0, h - 60):h + 40]!r}...")
open(OUT, "w").write(html)
size = len(html.encode())
assert size < 8_000_000, size  # the artifact limit is 16 MB; heavy data lives in data/ files
print("wrote", OUT, size, "bytes;", n, "events")
print("data files", len(ctx.files), "total", total, "bytes; publish list", PUBLISH)
print("strikes", json.dumps(S["stats"]))
print("translations", json.dumps(tr_stats))
print("em dashes", html.count("—"), "; excluded-term hits", {w: len(h) for w, h in bad_terms.items() if h})
for s in miss_ui:
    print("MISSING UI STRING", json.dumps(s, ensure_ascii=False))
for s, lg in miss_tr:
    print("MISSING TRANSLATION", lg, json.dumps(s, ensure_ascii=False))
for b in bad:
    print("I18N PROBLEM", b)
print("ui strings", len(strings), "missing", len(miss_ui), "untranslated", len(miss_tr))
for w in data.WARN:
    print("WARN", w)
if miss_ui or miss_tr or bad:
    sys.exit(1)
