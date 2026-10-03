"""Content strings the published data files carry (series labels, units, notes, election and war texts, events), by kind.
collect(data_dir) returns {kind: set(strings)}; coverage() compares them with a language table. Used by the build (About tab, translation report) and by i18n_tools/gap.py."""
import glob, json, os, re

from hub.lib import sha12

SERIES_FILES = ["cost/fx.json", "cost/prices.json", "money/series.json", "people/series.json", "war/series.json", "electricity/power.json", "electricity/nightlights.json", "climate/climate.json"]


def collect(D):
    out = {}

    def add(kind, s):
        if isinstance(s, str) and re.search(r"[A-Za-z]{3}", s):
            out.setdefault(kind, set()).add(s.strip())

    def load(rel):
        p = os.path.join(D, rel)
        return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}

    for rel in SERIES_FILES:
        for s in load(rel).get("series", []):
            add("series_label", s.get("label")); add("unit", s.get("unit")); add("series_note", s.get("notes"))
    for s in load("portals/series.json").get("series", []):
        add("unit", s.get("unit"))
    for e in load("electricity/power.json").get("events", []):
        add("event", e.get("title")); add("event", e.get("detail"))
    for e in load("money/events.json").get("events", []):
        add("event", e.get("title")); add("event", e.get("note"))
    for p in sorted(glob.glob(os.path.join(D, "elections", "[12]*.json"))):
        e = json.load(open(p, encoding="utf-8"))
        for k in ("election", "law", "status_detail", "independents_note", "note"):
            add("election_text", e.get(k))
        for n in e.get("notes") or []:
            add("election_text", n)
        for g in (e.get("national") or {}).get("party_seats") or []:
            add("party", g.get("party") or g.get("name"))
        for d in e.get("districts", []):
            add("district", d.get("district")); add("district", d.get("adm")); add("district", d.get("area")); add("election_text", d.get("qadas")); add("election_text", d.get("note"))
            for l in d.get("lists", []):
                add("list", l.get("name")); add("election_text", l.get("parties")); add("election_text", l.get("note"))
            for w in d.get("winners", []):
                add("list", w.get("list")); add("party", w.get("affiliation")); add("party", w.get("bloc")); add("election_text", w.get("note"))
    for t in load("war/tables.json").get("tables", []):
        add("war_table", t.get("label")); add("unit", t.get("unit")); add("war_table", t.get("notes")); add("war_table", t.get("title"))
        for r in t.get("rows", []):
            for c in (r if isinstance(r, list) else [r]):
                add("war_row", c)

    def walk(o, kind):
        if isinstance(o, dict):
            for k, v in o.items():
                if k not in ("source", "url", "license", "id", "ar", "pcode"):
                    walk(v, kind)
        elif isinstance(o, list):
            for v in o:
                walk(v, kind)
        elif isinstance(o, str) and len(o.split()) >= 2:
            add(kind, o)
    walk(load("people/extras.json"), "people_extra")
    cz = load("places/cazas.json")
    walk({k: v for k, v in cz.items() if k not in ("adm1", "adm2")}, "places_text")
    f = load("fires/firms-lbn.json")
    add("series_note", f.get("notes")); add("series_note", f.get("cell_ref"))
    return out


def manifest_strings(D):
    """Strings of the Downloads list: source lines and licence lines of the manifest (titles are translated by pattern in the page)."""
    m = json.load(open(os.path.join(D, "manifest.json"), encoding="utf-8")) if os.path.exists(os.path.join(D, "manifest.json")) else {"files": []}
    out = {"dl_source": set(), "dl_license": set()}
    for f in m["files"]:
        if f.get("source") and not f["source"].startswith("http"):
            out["dl_source"].add(f["source"])
        if f.get("license"):
            out["dl_license"].add(f["license"])
    return out


def coverage(strings_by_kind, table):
    """{kind: [translated, total]} against a {sha12: translation} table."""
    return {k: [sum(1 for s in v if sha12(s) in table), len(v)] for k, v in strings_by_kind.items()}
