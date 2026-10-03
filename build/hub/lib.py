"""Helpers every emitter uses. An emitter gets one Ctx and writes its data files through it, so each file is listed in
publish_files.json and data/manifest.json with a title, a source and a licence."""
import csv, hashlib, io, json, os, re, shutil

DEFAULT_LICENSE = "CC BY-SA 4.0"
MAX_FILE = 8 * 1024 * 1024       # the brief: each published file is at most 8 MB
MAX_FILES = 400                  # the artifact holds at most 511 files per version (one publish call sends at most 255): stay well under
MAX_TOTAL = 200 * 1024 * 1024    # and the whole set stays under 200 MB


def sha12(en):
    """The translation key: sha1 of the exact English string, first 12 hex digits (same as research/i18n/src-strings.jsonl)."""
    return hashlib.sha1(en.encode("utf-8")).hexdigest()[:12]


def no_em(s):
    """The Hub's house rule: no em dash anywhere in what it publishes (the shell does the same). The translation keys are built from the same text."""
    return s.replace("\u2014", ", ") if isinstance(s, str) else s


def norm_ws(s):
    return re.sub(r"\s+", " ", s).strip()


class Ctx:
    """out_dir is the folder that holds lebanon-timeline.html; data files go under out_dir/data/."""

    def __init__(self, out_dir, d, S, counts, research, build_dir):
        self.out_dir, self.data_dir = out_dir, os.path.join(out_dir, "data")
        self.d, self.S, self.counts = d, S, counts    # core data (events, series ...), strike build, header counts
        self.research, self.hub_research, self.build_dir = research, os.path.join(research, "hub") + "/", build_dir
        self.files = {}       # published path -> local path
        self.manifest = []    # one row per published data file
        self.warn = []
        self.series_long = LongCsv("Series", ["series_id", "t", "value"], "csv/series/")
        self.world_long = LongCsv("World", ["iso3", "indicator_id", "year", "value"], "csv/world/")
        self.series_dict, self.world_dict, self.countries = [], [], {}   # dictionary rows (label, unit, source, licence once per id) and iso3 -> (name_en, name_ar, name_fr)

    # ---- writing
    def _path(self, rel):
        assert not rel.startswith("/") and ".." not in rel.split("/"), rel
        p = os.path.join(self.data_dir, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p

    def register(self, rel, title, source="", license=None, kind="data", title_ar=None, rows=None):
        """List a file that is already written under data/<rel> in the manifest and in publish_files."""
        p = os.path.join(self.data_dir, rel)
        size = os.path.getsize(p)
        if size > MAX_FILE:
            raise ValueError(f"data/{rel} is {size} bytes; the limit is {MAX_FILE}. Split it.")
        self.files["data/" + rel] = p
        row = {"path": "data/" + rel, "title": title, "kind": kind, "source": source or "", "license": license or DEFAULT_LICENSE, "size": size}
        if rows is not None:
            row["rows"] = rows
        self.manifest.append(row)
        return size

    def write_json(self, rel, obj, title, source="", license=None, kind="data", rows=None):
        p = self._path(rel)
        with open(p, "w", encoding="utf-8") as f:
            f.write(no_em(json.dumps(obj, ensure_ascii=False, separators=(",", ":"))))
        return self.register(rel, title, source, license, kind, rows=rows)

    def write_csv(self, rel, header, rows, title, source="", license=None):
        """UTF-8 with a BOM so Excel reads Arabic correctly; one header row."""
        p = self._path(rel)
        n = 0
        with open(p, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            for r in rows:
                w.writerow([no_em(c) for c in r])
                n += 1
        return self.register(rel, title, source, license, "csv", rows=n)

    def write_text(self, rel, text, title, source="", license=None, kind="data"):
        p = self._path(rel)
        with open(p, "w", encoding="utf-8") as f:
            f.write(no_em(text))
        return self.register(rel, title, source, license, kind)

    def add_series(self, group, sid, label, unit, freq, source_url, license, points, redistribute=None):
        """Add one series to the long-format topic CSV csv/series/<group>[-n].csv (series_id, label, unit, freq, t, value, source_url, license).
        Returns (data-relative path of the part that holds it, series_id used in that file), or (None, None) if the series may not be redistributed."""
        if not redistributable(license, redistribute):
            self.warn.append(f"series {sid} left out of the CSV downloads: its licence forbids redistribution")
            return None, None
        lic = license or "not stated by the source (Hub compilation: CC BY-SA 4.0)"
        part, sid = self.series_long.part(group, sid)
        n = 0
        for pt in csv_series_rows(points):
            part["write"]([sid, pt[0], pt[1]])
            n += 1
        part["rows"] += n
        if n:    # a series with no points has no rows in the CSV, so it gets no dictionary row either
            self.series_dict.append([sid, label or "", unit or "", freq or "", group.replace("-", " ").capitalize(), "data/" + part["rel"], source_url or "", lic])
        part["sources"].add(source_url or "")
        return part["rel"], sid

    def series_csvs(self, series, prefix, default_source=""):
        """Add every series ({"id","label","unit","freq","source_url","license","points":[[t, v], ...]}, the research/hub/series format) to its topic's long CSV (SERIES_GROUPS maps prefix to topic).
        Returns the data-relative CSV path per series (None if left out); sets s["csv_id"] when the series_id in that file differs from s["id"]."""
        out = []
        for s in series:
            sid = safe_name(s.get("id") or s.get("label"))
            rel, used = self.add_series(SERIES_GROUPS.get(prefix, prefix), sid, s.get("label") or s.get("id"), s.get("unit"), s.get("freq"),
                                        s.get("source_url") or s.get("source") or default_source, s.get("license") or None, s.get("points"), s.get("redistribute"))
            if used and used != s.get("id"):
                s["csv_id"] = used
            out.append(rel)
        return out

    def add_world(self, group, rows, ind_id, label, unit, source, license, redistribute=None, source_url="", higher_is=""):
        """Add one World indicator ([[iso3, country, year, value], ...]) to the topic's long CSV csv/world/<group>[-n].csv. Returns the path, or None if it may not be redistributed."""
        if not redistributable(license, redistribute):
            self.warn.append(f"world indicator {ind_id} left out of the CSV downloads: its licence forbids redistribution")
            return None
        part, ind_id = self.world_long.part(group, ind_id)
        for iso, name, year, v in rows:
            part["write"]([iso, ind_id, year, v])
            part["rows"] += 1
        self.world_dict.append([ind_id, label, unit, group.replace("-", " ").capitalize(), "data/" + part["rel"], source, source_url, license or "CC BY-SA 4.0", higher_is])
        part["sources"].add(source or "")
        return part["rel"]

    def flush_long_csvs(self):
        """Write the topic CSVs collected by add_series and add_world, and list them in the manifest. Call once, after every emitter has run."""
        for lc, what in ((self.series_long, "series"), (self.world_long, "indicators")):
            for g, parts in sorted(lc.groups.items()):
                for i, pt in enumerate(parts):
                    p = self._path(pt["rel"])
                    with open(p, "w", encoding="utf-8-sig", newline="") as f:
                        f.write(pt["text"]())
                    part = f", part {i + 1} of {len(parts)}" if len(parts) > 1 else ""
                    topic = g.replace("-", " ").capitalize()
                    self.register(pt["rel"], f"{lc.label}: {topic}, {len(pt['ids'])} {what}, long format{part}",
                                  "See the source_url column" if what == "series" else "See the source column",
                                  "CC BY-SA 4.0 for the compilation; each row carries its own source and licence", "csv", rows=pt["rows"])

    def write_dictionaries(self):
        """series-dictionary.csv, world-dictionary.csv and countries.csv: one row per id, so the data CSVs carry only keys and values. Call after every emitter has run."""
        self.write_csv("csv/series-dictionary.csv", ["series_id", "label", "unit", "freq", "topic", "file", "source_url", "license"], self.series_dict,
                       "Series dictionary: label, unit, frequency, topic, file, source and licence of every series_id", "See the source_url column", "CC BY-SA 4.0 for the compilation; each row carries its own licence")
        self.write_csv("csv/world-dictionary.csv", ["indicator_id", "label", "unit", "topic", "file", "source", "source_url", "license", "higher_is"], self.world_dict,
                       "World dictionary: label, unit, topic, file, source and licence of every indicator_id", "See the source column", "CC BY-SA 4.0 for the compilation; each row carries its own licence")
        self.write_csv("csv/countries.csv", ["iso3", "name_en", "name_ar", "name_fr"], [[k, *v] for k, v in sorted(self.countries.items())],
                       "Countries and groups: names in English, Arabic and French for every iso3 code", "Natural Earth and World Bank country names", "CC BY-SA 4.0")

    def total_size(self):
        return sum(r["size"] for r in self.manifest)


SERIES_GROUPS = {"fx": "cost-of-living", "prices": "cost-of-living", "money": "public-money", "power": "electricity", "nightlights": "electricity", "climate": "climate",
                 "war": "war-and-displacement", "people": "people", "core": "timeline-bands", "portal": "open-data-portals"}
NO_REDIST = re.compile(r"\bno[nt]?[- ]?redistribut|not (?:to be )?redistribut|redistribution (?:is )?(?:not (?:allowed|permitted)|prohibited|forbidden|restricted)|excluded from csv downloads", re.I)


def redistributable(license, flag=None):
    """False when a record says redistribute: false or its licence text forbids redistribution (such data is shown on the page with attribution, never offered as a download)."""
    return flag is not False and not NO_REDIST.search(license or "")


class LongCsv:
    """Rows of many series or indicators in few long-format CSV files: one group per topic, a new part (group-2.csv ...) whenever a part would pass `limit` bytes.
    An item (series or indicator) is never split across parts; part(group, item) returns the part that item goes into."""

    def __init__(self, label, header, folder, limit=6 * 1024 * 1024):
        self.label, self.header, self.folder, self.limit, self.groups = label, header, folder, limit, {}

    def _new(self, group, n):
        buf, w = io.StringIO(), None
        w = csv.writer(buf)
        w.writerow(self.header)
        rel = self.folder + safe_name(group) + ("" if n == 1 else f"-{n}") + ".csv"
        pt = {"rel": rel, "ids": {}, "rows": 0, "sources": set(), "buf": buf}
        pt["text"] = lambda: buf.getvalue()
        pt["write"] = lambda row: w.writerow([no_em(c) for c in row])
        return pt

    def part(self, group, item):
        parts = self.groups.setdefault(group, [])
        if any(item in pt["ids"] for pt in parts):    # the same id twice in one group: the second gets a suffix
            k = 2
            while any(f"{item}-{k}" in pt["ids"] for pt in parts):
                k += 1
            item = f"{item}-{k}"
        if not parts:
            parts.append(self._new(group, 1))
        pt = parts[-1]
        if pt["buf"].tell() > self.limit:
            pt = self._new(group, len(parts) + 1)
            parts.append(pt)
        pt["ids"][item] = item
        return pt, item


def csv_series_rows(points):
    for pt in points or []:
        if isinstance(pt, (list, tuple)) and len(pt) >= 2:
            yield [pt[0], pt[1]]


def safe_name(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(s)).strip("_")[:90] or "x"


def stub_panel(tab, title, lead, empty):
    """The panel of a tab that has no data yet: heading, a one-line lead and an honest empty state. The tab's JS replaces #<tab>Root."""
    return (f'<section class="hub-panel" id="{tab}" role="tabpanel" aria-labelledby="t-{tab}" hidden>\n'
            f'  <h2>{title}</h2>\n  <p class="lead">{lead}</p>\n'
            f'  <div id="{tab}Root"><p class="hub-empty">{empty}</p></div>\n</section>')
