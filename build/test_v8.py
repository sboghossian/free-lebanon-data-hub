"""Tests for the v8 emitters: C-continuity merge, law patches, link freshness, map tolls (python3 -m unittest test_v8). They read the real research files, so they also guard the data contracts."""
import json, os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hub import fb_continuity as fc, emit_data, emit_map, emit_about, fb_regional
from hub.fb_common import load_series

HUB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "hub") + os.sep


class Continuity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, cls.pr0 = load_series(HUB, "D2-prices")
        cls.pr, cls.info = fc.merge_prices(cls.pr0, HUB)
        cls.ix = {s["id"]: s for s in cls.pr}
        cls.C = {s["id"]: s for s in json.load(open(HUB + "series/C-continuity.json", encoding="utf-8"))["series"]}

    def test_fuel_series_keep_their_ids_and_gain_dates(self):
        old = {s["id"]: s for s in self.pr0}
        for sid in ("fuel_petrol95_lbp_20l", "fuel_diesel_lbp_20l", "fuel_lpg10kg_lbp"):
            self.assertGreater(len(self.ix[sid]["points"]), len(old[sid]["points"]))
            ap = self.C[fc.REPLACE[sid] if sid in fc.REPLACE else sid].get("added_points") or {}
            self.assertEqual(set(self.ix[sid]["filled"]), {t for t, v in ap.items() if v.get("basis") in fc.SECONDARY})   # exactly the dates the research gives a press or aggregator basis
            self.assertTrue({t for t, v in ap.items() if v.get("basis") in fc.SECONDARY} <= {p[0] for p in self.ix[sid]["points"]})
            for t, (basis, src) in self.ix[sid]["filled"].items():
                self.assertIn(basis, fc.SECONDARY)
                self.assertTrue(src)

    def test_original_points_are_unchanged(self):
        old = {p[0]: p[1] for p in next(s for s in self.pr0 if s["id"] == "fuel_petrol95_lbp_20l")["points"]}
        new = {p[0]: p[1] for p in self.ix["fuel_petrol95_lbp_20l"]["points"]}
        self.assertTrue(all(new[t] == v for t, v in old.items()))

    def test_derived_dollar_series_are_recomputed_by_the_research_rule(self):
        self.assertIn("fuel_petrol95_usd_market_20l", self.info["recomputed"])
        fx = {p[0]: p[1] for p in self.ix["fx_lbp_usd_market_monthly"]["points"]}
        for t, usd in self.ix["fuel_petrol95_usd_market_20l"]["points"][-5:]:
            lbp = {p[0]: p[1] for p in self.ix["fuel_petrol95_lbp_20l"]["points"]}[t]
            self.assertAlmostEqual(usd, lbp / (fx.get(t[:7]) or fc.FX_PEG), places=3)

    def test_canisters_gain_the_months_that_had_no_table(self):
        old = {s["id"]: s for s in self.pr0}["min_wage_in_petrol_canisters"]
        self.assertGreater(len(self.ix["min_wage_in_petrol_canisters"]["points"]), len(old["points"]))

    def test_generator_fee_is_the_continuous_ministry_series(self):
        s = self.ix["gen_fixed_5a_lbp_month"]
        self.assertEqual(len(s["points"]), 98)
        self.assertEqual(s["points"][0][0], "2018-06")

    def test_bread_months_mark_uncertain_and_held(self):
        s = self.ix["bread_standard_bundle_bakery_lbp_monthly_inforce"]
        kinds = {v[0] for v in s["filled"].values()}
        self.assertEqual(kinds, {"uncertain", "held"})

    def test_notes_are_the_short_page_notes_not_the_research_text(self):
        for sid in ("fuel_petrol95_lbp_20l", "gen_fixed_5a_lbp_month", "bread_pita_800g_retail_median_wfp_lbp"):
            self.assertLess(len(self.ix[sid]["notes"]), 400)

    def test_missing_continuity_file_changes_nothing(self):
        pr, info = fc.merge_prices(self.pr0, "/nonexistent/")
        self.assertEqual(pr, self.pr0)
        self.assertEqual(info, {})

    def test_proxy_is_flagged_and_labelled_and_marks_non_computed_months(self):
        pw, info = fc.merge_power([], HUB)
        s = {x["id"]: x for x in pw}["edl_supply_hours_proxy_monthly"]
        self.assertTrue(s["proxy"])
        self.assertIn("PROXY", s["label"])
        self.assertTrue(s["notes"].startswith("PROXY, NOT AN OFFICIAL SERIES"))
        self.assertEqual(len(s["filled"]), 54)                       # 103 months minus the 49 computed ones
        self.assertNotIn("2018-01", s["filled"])
        self.assertIn("2020-06", s["filled"])


class Laws(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = emit_data.load_laws(HUB)
        cls.C = {c: i for i, c in enumerate(emit_data.LAW_COLS)}

    def test_new_2025_laws_are_added_once(self):
        titles = [r[self.C["title_en"]] for r in self.rows if "reforming the banks" in r[self.C["title_en"]]]
        self.assertEqual(len(titles), 1)
        self.assertEqual(len(self.rows), 5366 + 15)

    def test_patches_add_summaries_and_statuses(self):
        self.assertGreaterEqual(sum(1 for r in self.rows if r[self.C["summary_en"]]), 1000)
        ann = [r for r in self.rows if r[self.C["status"]].startswith("annulled by Constitutional Council")]
        self.assertEqual(len(ann), 3)
        budget = [r for r in self.rows if "General Budget Law for 2026" in r[self.C["summary_en"]]]
        self.assertEqual(budget[0][self.C["law_no"]], 40)
        self.assertEqual(budget[0][self.C["status"]], "number from press reports")

    def test_full_text_link_is_stored_only_when_it_differs_from_the_source(self):
        for r in self.rows:
            self.assertNotEqual(r[self.C["fulltext"]], r[self.C["source"]])


class Freshness(unittest.TestCase):
    def test_states(self):
        f = emit_data.fresh_state
        self.assertEqual(f({"status": "ok", "http": 200}), "reachable")
        self.assertEqual(f({"status": "ok", "http": 301}), "moved")
        self.assertEqual(f({"status": "moved", "http": None}), "moved")
        self.assertEqual(f({"status": "timeout", "http": None}), "unreachable")
        self.assertEqual(f({"status": "error", "http": None}), "unreachable")
        self.assertEqual(f({"status": "ok", "http": 404}), "unreachable")

    def test_last_modified_header(self):
        self.assertEqual(emit_data._modified("Thu, 29 Jun 2023 12:24:49 GMT"), "2023-06-29")
        self.assertEqual(emit_data._modified(None), "")
        self.assertEqual(emit_data._modified("not a date"), "")

    def test_catalogue_rows_carry_the_status(self):
        rows = emit_data.load_portals(os.path.join(HUB, "..", "portals") + os.sep)
        self.assertEqual(len(emit_data.PCOLS), len(rows[0]))
        self.assertEqual({r[13] for r in rows}, {"2026-10-03"})


class Tolls(unittest.TestCase):
    def test_every_research_count_maps_to_a_war_group(self):
        class Ctx:
            hub_research = HUB
            warn = []
        t = emit_map.tolls(Ctx())
        self.assertEqual(len(t), 11)
        self.assertEqual(Ctx.warn, [])
        self.assertEqual({x["group"] for x in t}, {"civil", "7882", "9396", "2006", "2326"})
        self.assertTrue(all(x["from"] <= x["to"] and x["counted_by"] and x["as_of"] and x["caveat"] for x in t))

    def test_low_and_high_are_a_range_only_when_they_count_the_same_quantity(self):
        class Ctx:
            hub_research = HUB
            warn = []
        t = {x["war"].split(",")[0].split(" (")[0]: x for x in emit_map.tolls(Ctx())}
        civ = next(x for x in emit_map.tolls(Ctx()) if x["group"] == "civil")
        self.assertEqual((civ["killed_low"], civ["killed_high"], civ["killed_parts"]), (120000, 150000, None))
        for w in ("1982 invasion", "1996 Grapes of Wrath", "2006 war", "1982 siege of Beirut"):
            x = t[w]
            self.assertIsNone(x["killed_low"])
            self.assertIsNone(x["killed_high"])
            self.assertEqual(len(x["killed_parts"]), 2)
            self.assertTrue(all(p["what"] for p in x["killed_parts"]))
        x = t["1993 Accountability"]
        self.assertEqual((x["killed_low"], x["killed_high"], x["killed_parts"]), (118, 140, None))


class AboutAndPlaces(unittest.TestCase):
    def test_unchecked_count_is_the_unchecked_verdicts_of_the_grounding_file(self):
        research = os.path.join(HUB, "..") + os.sep
        n = sum(1 for l in open(research + "40-grounding.jsonl", encoding="utf-8") if json.loads(l).get("verdict") == "unchecked")
        self.assertEqual(emit_about.unchecked(research), n)
        self.assertGreater(n, 0)
        self.assertIsNone(emit_about.unchecked("/nonexistent/"))

    def test_districts_carry_estimates_by_source_and_no_place_has_one(self):
        cz = fb_regional.cazas(HUB)["cazas"]
        self.assertEqual(sum(1 for c in cz.values() if c.get("est", {}).get("cas")), 26)
        sour = cz["LB63"]["est"]
        self.assertEqual((sour["cas"], sour["rv14"], sour["rv25"]), (255700, 174743, 214968))
        self.assertTrue(cz["LB43"]["est"].get("lrp_bad"))                      # the research calls Marjaayoun's OCHA totals unreliable
        self.assertNotIn("lrp26", cz["LB43"]["est"])
        for line in open(HUB + "villages/P-population.jsonl", encoding="utf-8"):
            a = json.loads(line)["attr"]
            self.assertNotIn("resident_estimate", a)                            # the per-place estimate is gone from the research file

    def test_the_deep_legs_and_the_2026_row_are_registered_as_timeline_files(self):
        import data
        names = set(data.FILES.values())
        for f in ("80-deep-1800-1830.timeline.jsonl", "81-deep-1831-1860.timeline.jsonl", "82-deep-1861-1890.timeline.jsonl", "83-deep-1891-1919.timeline.jsonl", "84-election-2026.timeline.jsonl"):
            self.assertIn(f, names)


if __name__ == "__main__":
    unittest.main()
