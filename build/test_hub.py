"""Tests for the hub plugin helpers: translation keys, string collection, file registration and limits (python3 -m unittest test_hub)."""
import json, os, tempfile, unittest
from hub import i18n, lib


class Keys(unittest.TestCase):
    def test_sha12_matches_the_translation_source(self):
        self.assertEqual(len(lib.sha12("x")), 12)
        # the research source strings use the same key (first line of research/i18n/src-strings.jsonl)
        p = os.path.join(os.path.dirname(__file__), "..", "research", "i18n", "src-strings.jsonl")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                r = json.loads(f.readline())
            self.assertEqual(lib.sha12(r["en"]), r["h"])

    def test_no_em_dash(self):
        self.assertEqual(lib.no_em("a — b"), "a ,  b")
        self.assertEqual(lib.no_em(5), 5)


class Collect(unittest.TestCase):
    def test_static_text_and_attributes(self):
        html = '<body><main><h2>Timeline</h2><input placeholder="Search it" aria-label="Find"><p data-notr>Skip me</p><button data-hint="x">president:Chehab</button><p>12,345</p><script>t("no")</script></main>'
        got = i18n.static_strings(html)
        self.assertIn("Timeline", got)
        self.assertIn("Search it", got)
        self.assertIn("Find", got)
        self.assertNotIn("Skip me", got)          # data-notr
        self.assertNotIn("president:Chehab", got)  # query examples are not translated
        self.assertNotIn("12,345", got)            # no letters
        self.assertNotIn("no", got)                # script

    def test_js_literals(self):
        src = "t('One'); tH(\"Two {a}\", {}); N('Three'); tp('{n} item', '{n} items', n); tpH('{n} a', '{n} b', n); x.t('no'); at('no'); t(`Four`); t(variable); t('It\\'s')"
        got, bad = i18n.js_strings([("x.js", src)])
        self.assertEqual(sorted(got), sorted(["One", "Two {a}", "Three", "{n} item", "{n} items", "{n} a", "{n} b", "Four", "It's"]))
        self.assertEqual(bad, [])
        got, bad = i18n.js_strings([("y.js", "t(`bad ${v}`)")])
        self.assertEqual(len(bad), 1)

    def test_report_and_tables(self):
        ui = {"A": {"ar": "ا", "fr": "a"}, "B": {"ar": "ب"}}
        miss_ui, miss_tr = i18n.report(["A", "B", "C"], ui)
        self.assertEqual(miss_ui, ["C"])
        self.assertEqual(miss_tr, [("B", "fr")])
        t = i18n.lang_tables(["A", "B", "C"], ui)
        self.assertEqual(t["ar"], {lib.sha12("A"): "ا", lib.sha12("B"): "ب"})
        self.assertEqual(t["fr"], {lib.sha12("A"): "a"})

    def test_stale_translations_are_dropped(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "i18n", "ar"))
            h_ok, h_live, h_stale = lib.sha12("ok"), lib.sha12("live"), lib.sha12("old text")
            with open(os.path.join(d, "i18n", "ar", "part-01.jsonl"), "w", encoding="utf-8") as f:
                for h, t in [(h_ok, "ا"), (h_live, "ب"), (h_stale, "ج"), (lib.sha12("empty"), "  "), ("bad", 3)]:
                    f.write(json.dumps({"h": h, "t": t}, ensure_ascii=False) + "\n")
                f.write("not json\n")
            out, st = i18n.content_translations("ar", d, {h_live}, {h_ok})
            self.assertEqual(out, {h_ok: "ا", h_live: "ب"})
            self.assertEqual(st["stale"], 1)
            self.assertEqual(i18n.content_translations("fr", d, set(), set())[0], {})   # no files: empty, not an error


class Files(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ctx = lib.Ctx(self.tmp.name, {}, {}, {}, "/nonexistent/", "/nonexistent")

    def tearDown(self):
        self.tmp.cleanup()

    def test_write_registers_manifest_and_publish_list(self):
        self.ctx.write_json("a/b.json", {"x": "p — q"}, "Title", "https://example.org", None, rows=1)
        self.ctx.write_csv("csv/c.csv", ["h1", "h2"], [["1", "2"], ["é", "x — y"]], "CSV", "src", "CC BY 4.0")
        self.assertEqual(sorted(self.ctx.files), ["data/a/b.json", "data/csv/c.csv"])
        m = {r["path"]: r for r in self.ctx.manifest}
        self.assertEqual(m["data/a/b.json"]["license"], lib.DEFAULT_LICENSE)      # CC BY-SA 4.0 unless a source says otherwise
        self.assertEqual(m["data/csv/c.csv"]["license"], "CC BY 4.0")
        self.assertEqual(m["data/csv/c.csv"]["rows"], 2)
        self.assertNotIn("—", open(self.ctx.files["data/a/b.json"], encoding="utf-8").read())
        self.assertTrue(open(self.ctx.files["data/csv/c.csv"], encoding="utf-8").read().startswith("﻿h1,h2"))   # BOM for Excel

    def test_limits_and_paths(self):
        with self.assertRaises(ValueError):
            self.ctx.write_text("big.txt", "x" * (lib.MAX_FILE + 1), "Too big")
        with self.assertRaises(AssertionError):
            self.ctx.write_text("../escape.txt", "x", "bad")

    def test_series_csvs(self):
        """Series go into one long-format CSV per topic (series_id, t, value); the labels and units are in series-dictionary.csv. A second series with the same id gets a suffix."""
        out = self.ctx.series_csvs([{"id": "a b", "label": "A", "unit": "USD", "points": [["2000", 1], ["2001", 2]]}, {"id": "a b", "label": "A again", "points": [["2000", 3]]}], "prices")
        self.assertEqual(out, ["csv/series/cost-of-living.csv", "csv/series/cost-of-living.csv"])
        self.ctx.flush_long_csvs()
        self.ctx.write_dictionaries()
        text = open(self.ctx.files["data/csv/series/cost-of-living.csv"], encoding="utf-8-sig").read()
        self.assertTrue(text.startswith("series_id,t,value"))
        self.assertIn("a_b,2001,2", text)
        self.assertIn("a_b-2,2000,3", text)
        self.assertIn("a_b,A,USD", open(self.ctx.files["data/csv/series-dictionary.csv"], encoding="utf-8-sig").read())


if __name__ == "__main__":
    unittest.main()
