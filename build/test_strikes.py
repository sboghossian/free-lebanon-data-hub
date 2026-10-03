"""Tests for build/strikes.py: place cleaning, geocoding rules, killed parsing, projection and the compact blob.
Run: cd build && python3 -m unittest test_strikes
Uses the real gazetteer (research/geo/gazetteer.jsonl) and boundaries (build/geo)."""
import json
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gazetteer as G  # noqa: E402
import strikes as S  # noqa: E402


def geo(place, district=None, war="2023_26", alt=()):
    r = S.geocode({"place": place, "place_alt": list(alt), "district": district, "war": war})
    p = r.get("place") or {}
    return r["status"], p.get("name"), p.get("adm2"), r.get("how"), r.get("reason")


class Helpers(unittest.TestCase):
    def test_clean_place(self):
        self.assertEqual(S.clean_place("Nabatieh Governorate (exact location withheld)"), "Nabatieh Governorate")
        self.assertEqual(S.clean_place("Khiam outskirts"), "Khiam")
        self.assertEqual(S.clean_place("  Bint Jbeil area "), "Bint Jbeil")
        self.assertEqual(S.clean_place(None), "")

    def test_is_area_text(self):
        for t in ("Nabatieh Governorate", "Bint Jbeil District", "South (exact location withheld)", "Tyre caza"):
            self.assertTrue(S.is_area_text(t), t)
        for t in ("Khiam", "Beirut", "Marjayoun"):
            self.assertFalse(S.is_area_text(t), t)

    def test_parse_killed(self):
        self.assertEqual(S.parse_killed(None), (-1, ""))
        self.assertEqual(S.parse_killed(12), (12, ""))
        self.assertEqual(S.parse_killed("8-10"), (8, "8-10"))
        self.assertEqual(S.parse_killed("27–60"), (27, "27-60"))
        self.assertEqual(S.parse_killed("1,200"), (1200, ""))
        self.assertEqual(S.parse_killed("dozens"), (-1, "dozens"))
        self.assertEqual(S.parse_killed(True), (-1, ""))

    def test_date_key(self):
        self.assertEqual(S.date_key("1982-06-06"), "1982-06-06")
        self.assertEqual(S.date_key("1982-06"), "1982-06-01")
        self.assertEqual(S.date_key("1982"), "1982-01-01")
        self.assertEqual(S.date_key("June 1982"), "")
        self.assertEqual(S.date_key(None), "")

    def test_projection_is_integer_and_north_up(self):
        proj, k = S.project_fn(35.0, 33.9, 34.7)
        x1, y1 = proj(35.5, 34.0)
        x2, y2 = proj(35.5, 33.5)
        self.assertIsInstance(x1, int)
        self.assertLess(y1, y2)               # further north has a smaller y
        self.assertAlmostEqual(k, 0.83, places=2)

    def test_dict_encoder_is_stable(self):
        d = S.Dict()
        self.assertEqual([d("a"), d("b"), d("a")], [0, 1, 0])
        self.assertEqual(d.vals, ["a", "b"])


class Normaliser(unittest.TestCase):
    """The geocoder relies on gazetteer.normalize; these are the spellings the strike sources actually use."""

    def test_variants_share_a_key(self):
        groups = [("Ayta ash Shab", "Aita al-Shaab", "Aita Ech Chaab"), ("Kafr Kila", "Kfar Kila", "Kfarkela"), 
                  ("Tyre", "Sour", "Tyr"), ("Sidon", "Saida"), ("Dahieh", "Dahiyeh", "Beirut Southern Suburbs"), ("Marjayoun", "Marjaayoun", "Marj Uyun")]
        for g in groups:
            keys = {G.normalize(n) for n in g}
            self.assertEqual(len(keys), 1, (g, keys))

    def test_skeleton_joins_vowel_variants(self):
        sk = {G.skeleton(G.normalize(n)) for n in ("Bint Jbeil", "Bent Jbeil", "Bint Jubayl")}
        self.assertEqual(len(sk), 1, sk)

    def test_different_places_differ(self):
        self.assertNotEqual(G.normalize("Khiam"), G.normalize("Kfar Kila"))
        self.assertNotEqual(G.normalize("Tyre"), G.normalize("Tripoli"))

    def test_arabic_and_empty(self):
        self.assertEqual(G.normalize(""), "")
        self.assertEqual(G.normalize(None), "")
        self.assertTrue(G.is_arabic("خيام"))


class Geocoder(unittest.TestCase):
    def test_exact_with_district(self):
        self.assertEqual(geo("Khiam", "Marjayoun")[:3], ("point", "Khiam", "Marjaayoun"))

    def test_district_picks_the_right_namesake(self):
        self.assertEqual(geo("Khiam", "Chouf")[1:3], ("El Khiam", "Chouf"))

    def test_place_alt_and_alternate_spellings(self):
        self.assertEqual(geo("Ayta ash Shab", "Bint Jbeil")[1], "Aita Ech Chaab")
        self.assertEqual(geo("zzz unknown", None, alt=["Qana"])[1], "Qana")
        self.assertEqual(geo("خيام", "Marjayoun")[1], "Khiam")      # Arabic name

    def test_never_guesses_across_districts(self):
        # Kfar Kila is in Marjaayoun; a source that files it under Bint Jbeil gets no point
        st, name, _, _, reason = geo("Kfar Kila", "Bint Jbeil")
        self.assertEqual(st, "unresolved")
        self.assertIn("not in Bint Jbeil", reason)

    def test_unknown_and_empty(self):
        self.assertEqual(geo("Zzzzvillage")[0], "unresolved")
        self.assertEqual(S.geocode({"place": "", "place_alt": []})["status"], "unresolved")

    def test_ambiguous_name_outside_the_front_is_unresolved(self):
        st, _, _, _, reason = geo("Khiam", None, war="civil_war")
        self.assertEqual(st, "unresolved")
        self.assertIn("ambiguous", reason)

    def test_ambiguous_name_at_the_front_is_inferred_and_flagged(self):
        r = geo("Khiam", None, war="2023_26")
        self.assertEqual((r[0], r[1], r[2], r[3]), ("point", "Khiam", "Marjaayoun", "theatre"))

    def test_front_line_inference_needs_a_same_name_match(self):
        # a consonant-skeleton hit is not enough to pick a village by the front line
        for place in ("Majdal", "Basta"):
            self.assertNotEqual(geo(place, None, war="2023_26")[3], "theatre", place)

    def test_governorate_and_district_text_is_area_level(self):
        for t in ("Nabatieh Governorate (exact location withheld)", "Baalbek-Hermel Governorate", "Mount Lebanon Governorate (exact location withheld)"):
            self.assertEqual(geo(t)[0], "area", t)
        self.assertEqual(geo("Chouf", "Chouf")[0], "area")
        self.assertEqual(geo("Bekaa Valley", "Zahle")[0], "area")

    def test_city_beats_the_district_of_the_same_name(self):
        r = geo("Beirut")
        self.assertEqual((r[0], r[1]), ("point", "Beirut"))
        self.assertEqual(geo("Tyre")[1], "Sour")
        self.assertEqual(geo("Sidon")[1], "Saida")

    def test_exonyms_and_neighbourhoods(self):
        self.assertEqual(geo("Dahieh")[0], "point")
        self.assertEqual(geo("Haret Hreik")[0], "point")

    def test_fuzzy_only_inside_a_district(self):
        # a misspelling resolves inside its district, but with no district it must not be guessed
        self.assertEqual(geo("Aitaroun", "Bint Jbeil")[0], "point")
        self.assertEqual(geo("Aytaroonn", "Bint Jbeil")[0] in ("point", "unresolved"), True)
        st = geo("Qxqxqxq")[0]
        self.assertEqual(st, "unresolved")


class Geometry(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.geo, proj = S.load_geo()
        cls._proj = staticmethod(proj)

    def test_projection_params_and_counts(self):
        g = self.geo
        self.assertEqual((len(g["adm1"]), len(g["adm2"])), (8, 26))
        self.assertGreater(g["h"], g["w"])
        for k in ("w", "h", "lon0", "lat1", "k", "s"):
            self.assertIn(k, g)

    def test_paths_are_compact_integer_relative(self):
        d = self.geo["adm2"][0]["d"]
        self.assertTrue(d.startswith("M"))
        self.assertIsNone(re.search(r"\d\.\d", d))             # integers only
        self.assertIn("l", d)
        self.assertLess(len(json.dumps(self.geo)), 90_000)

    def test_labels_lie_in_the_box(self):
        for a in self.geo["adm1"]:
            x, y = a["l"]
            self.assertTrue(0 <= x <= self.geo["w"] and 0 <= y <= self.geo["h"], a["n"])

    def test_projected_place_is_inside_the_box(self):
        x, y = self._proj(35.5, 33.89)  # Beirut
        self.assertTrue(0 <= x <= self.geo["w"] and 0 <= y <= self.geo["h"])


class Blob(unittest.TestCase):
    ROWS = [
        {"war": "2006", "date": "2006-07-30", "date_end": None, "place": "Qana", "place_alt": [], "district": "Tyre", "kind": "airstrike", "actor": "Israel (IDF)", "target": "home",
         "killed": "27-60", "injured": 9, "title": "Qana: air strike on a home", "source": "https://example.org/a", "confidence": "✅", "count": 1},
        {"war": "2006", "date": "2006-07-30", "date_end": None, "place": "Qana", "place_alt": [], "district": "Tyre", "kind": "shelling", "actor": None, "target": None,
         "killed": None, "injured": None, "title": "Qana: shelling", "source": "https://example.org/a", "confidence": "\U0001F4E3", "count": 1},
        {"war": "2023_26", "date": "2024-01-06", "date_end": None, "place": "Nabatieh Governorate (exact location withheld)", "place_alt": [], "district": None, "kind": "artillery",
         "actor": "Israel", "target": None, "killed": 2, "injured": None, "title": "Artillery fire", "source": "https://example.org/b", "confidence": "✅", "count": 1},
        {"war": "civil_war", "date": "1982-06", "date_end": None, "place": "Khiam", "place_alt": [], "district": None, "kind": "massacre", "actor": None, "target": None,
         "killed": 5, "injured": None, "title": "Khiam: ambiguous", "source": "https://example.org/c", "confidence": "\U0001F9EA", "count": 1},
    ]
    EVENTS = [{"id": "e1", "date": "2006-07-30", "title": "Israeli air strike on Qana kills civilians", "pl": "South", "ac": ["Israel"]},
              {"id": "e2", "date": "2006-07-30", "title": "Something else in Beirut", "pl": "Beirut", "ac": []}]

    @classmethod
    def setUpClass(cls):
        cls.out = S.build(events=cls.EVENTS, rows=[dict(r) for r in cls.ROWS], write=False)
        cls.b = cls.out["strikes"]

    def test_statuses_by_war(self):
        w = self.out["stats"]["by_war"]
        self.assertEqual(w["2006"]["mapped"], 2)
        self.assertEqual(w["2023_26"]["area"], 1)
        self.assertEqual(w["civil_war"]["unresolved"], 1)           # Khiam in the civil war: ambiguous, never guessed
        self.assertEqual(self.out["stats"]["mapped"], 2)

    def test_rows_are_sorted_and_columnar(self):
        self.assertEqual(self.b["cols"][0], "t")
        self.assertEqual(len(self.b["rows"]), 3)                     # unresolved rows are not emitted
        self.assertTrue(all(len(r) == len(self.b["cols"]) for r in self.b["rows"]))
        self.assertEqual([r[0] for r in self.b["rows"]], sorted(r[0] for r in self.b["rows"]))

    def test_dictionary_encoding(self):
        c = {n: i for i, n in enumerate(self.b["cols"])}
        r0 = self.b["rows"][0]
        self.assertEqual(self.b["dict"]["war"][r0[c["w"]]], "2006")
        self.assertEqual(self.b["dict"]["src"][r0[c["u"]]], "https://example.org/a")
        self.assertEqual(len(self.b["dict"]["src"]), 2)              # two rows share one source string
        self.assertEqual(r0[c["kl"]], 27)
        self.assertEqual(r0[c["kt"]], "27-60")

    def test_places_are_integer_and_shared(self):
        self.assertEqual(len(self.b["places"]), 1)                   # both Qana rows use one place
        n, x, y, d, ap = self.b["places"][0]
        self.assertEqual(n, "Qana")
        self.assertTrue(isinstance(x, int) and isinstance(y, int))

    def test_timeline_link_needs_date_and_place(self):
        self.assertEqual(self.b["evl"], {"0": "e1", "1": "e1"})      # e2 shares the day but not the place

    def test_unresolved_counts_are_kept(self):
        self.assertEqual(self.b["unres"], {"civil_war": 1})

    def test_no_acled_file_means_no_acled(self):
        if not os.path.exists(S.STRIKES_DIR + "acled-agg.json"):
            self.assertIsNone(self.out["acled"])


class RealData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = S.build(events=[], write=False)

    def test_real_rows_geocode_and_stay_small(self):
        out = self.out
        st = out["stats"]
        self.assertGreater(st["mapped"], 2000)
        self.assertEqual(st["mapped"] + st["area"] + st["unresolved"], st["rows"])
        size = len(json.dumps(out["strikes"], ensure_ascii=False, separators=(",", ":")))
        self.assertLess(size, 1_500_000)

    def test_no_point_is_outside_the_map_box(self):
        out = self.out
        w, h = out["geo"]["w"], out["geo"]["h"]
        for n, x, y, d, ap in out["strikes"]["places"]:
            self.assertTrue(-5 <= x <= w + 5 and -5 <= y <= h + 5, (n, x, y))


class Acled(unittest.TestCase):
    def test_compact_blob_from_aggregates(self):
        import tempfile
        p = os.path.join(tempfile.mkdtemp(), "acled-agg.json")
        cells = [{"location": "Khiam", "admin2": "Marjayoun", "month": "2024-01", "event_type": "Explosions/Remote violence", "sub_event_type": "Air/drone strike", "count": 4, "fatalities": 2, "lat": 33.3, "lon": 35.6},
                 {"location": "Khiam", "admin2": "Marjayoun", "month": "2024-02", "event_type": "Battles", "sub_event_type": "Armed clash", "count": 1, "fatalities": 0, "lat": 33.3, "lon": 35.6},
                 {"location": "Nowhere", "admin2": "", "month": "2024-02", "event_type": "x", "sub_event_type": "", "count": 1, "fatalities": 0, "lat": None, "lon": None}]
        with open(p, "w", encoding="utf-8") as f:
            json.dump({"attribution": "ACLED (Armed Conflict Location & Event Data)", "accessed": "2026-10-01", "from": "2016-01-01", "to": "2026-10-01", "cells": cells}, f)
        _, proj = S.load_geo()
        a = S.build_acled(proj, p)
        self.assertEqual(len(a["places"]), 1)                       # the cell with no coordinates is skipped
        self.assertEqual(len(a["rows"]), 2)
        self.assertEqual(a["rows"][0][3:], [4, 2])
        self.assertIn("ACLED", a["attribution"])
        self.assertEqual(a["types"], ["Air/drone strike", "Armed clash"])

    def test_missing_or_empty_file_is_none(self):
        self.assertIsNone(S.build_acled(lambda lon, lat: (0, 0), "/nonexistent/acled.json"))


class Unresolved(unittest.TestCase):
    def test_tsv_columns(self):
        import tempfile
        p = os.path.join(tempfile.mkdtemp(), "u.tsv")
        S.write_unresolved({("Kafra", "", "2023_26", "ambiguous"): [3, "Kafra (Aley, 1.00)", "https://x"]}, p)
        with open(p, encoding="utf-8") as f:
            lines = f.read().splitlines()
        self.assertEqual(lines[0].split("\t")[:5], ["place", "district", "war", "reason", "count"])
        self.assertEqual(lines[1].split("\t")[4], "3")


if __name__ == "__main__":
    unittest.main()


class LeftOut(unittest.TestCase):
    def test_drop_and_unsupported_are_left_out(self):
        import tempfile, json as _j
        import strikes as S_
        d = tempfile.mkdtemp() + "/"
        rows = [{"war": "2006", "date": "2006-07-13", "place": "Srifa", "kind": "airstrike", "source": "https://x/a"},
                {"war": "2006", "date": "2006-07-14", "place": "Qana", "kind": "airstrike", "source": "https://x/b", "drop": True},
                {"war": "2006", "date": "2006-07-15", "place": "Tyre", "kind": "airstrike", "source": "https://x/c"}]
        open(d + "2006-t.jsonl", "w").write("\n".join(_j.dumps(r) for r in rows) + "\n")
        open(d + "_grounding.jsonl", "w").write(_j.dumps({"key": "2006-t.jsonl:2", "verdict": "unsupported"}) + "\n"
                                               + _j.dumps({"key": "2006-t.jsonl:0", "verdict": "grounded"}) + "\n")
        got = S_.load_rows(d)
        self.assertEqual([r["place"] for r in got], ["Srifa"])
        self.assertEqual(got[0]["_gr"], "grounded")
        self.assertEqual(sorted(t[1] for t in S_.LEFT_OUT), ["dropped", "unsupported"])


class Overrides(unittest.TestCase):
    """research/strikes/geocode-overrides.jsonl: hand-checked coordinates applied after the gazetteer."""
    OV = {
        (G.normalize("Kafra"), None): {"place": "Kafra", "district": None, "lat": 33.17431, "lon": 35.3509, "pcode": None, "precision": "village", "evidence": "https://x/kafra"},
        (G.normalize("Beaufort Castle"), frozenset(G._district_keys("Nabatieh"))): {"place": "Beaufort Castle", "district": "Nabatieh", "lat": 33.3244, "lon": 35.532, "pcode": None, "precision": "exact", "evidence": "https://x/b"},
    }

    def g(self, place, district=None, ov=None):
        r = S.geocode({"place": place, "place_alt": [], "district": district, "war": "2023_26"}, overrides=self.OV if ov is None else ov)
        return r["status"], r.get("how"), (r.get("place") or {}).get("lat")

    def test_no_district_row_uses_the_districtless_override(self):
        self.assertEqual(self.g("Kafra", None)[:2], ("point", "override"))        # four villages share the name: unresolved without the override
        self.assertEqual(self.g("Kafra", None, ov={})[0], "unresolved")

    def test_override_with_a_district_needs_that_district(self):
        self.assertEqual(self.g("Beaufort Castle", "Nabatieh")[:2], ("point", "override"))
        self.assertEqual(self.g("Beaufort Castle", "El Nabatieh")[:2], ("point", "override"))   # spelling of the district does not matter
        self.assertEqual(self.g("Beaufort Castle", None, ov={k: v for k, v in self.OV.items() if k[1] is not None})[0], "unresolved")

    def test_a_resolved_row_with_a_known_district_keeps_the_gazetteer_point(self):
        st, how, lat = self.g("Kafra", "Bint Jbeil")
        self.assertEqual((st, how), ("point", "exact"))   # the districtless override does not move a place the gazetteer already found

    def test_area_text_is_never_overridden(self):
        ov = {(G.normalize("Nabatieh"), None): {"place": "Nabatieh", "lat": 1.0, "lon": 2.0, "district": None}}
        self.assertEqual(S.geocode({"place": "Nabatieh Governorate", "district": None, "war": "2023_26"}, overrides=ov)["status"], "area")

    def test_the_real_file_loads_and_places_more_rows(self):
        ov = S.load_overrides()
        self.assertGreater(len(ov), 50)
        for r in ov.values():
            self.assertTrue(r.get("evidence"), r["place"])
            self.assertTrue(33.0 < r["lat"] < 34.8 and 35.0 < r["lon"] < 36.7, r["place"])
        base = S.build(events=[], write=False)
        self.assertGreater(base["stats"]["override"], 50)
        self.assertLess(base["stats"]["unresolved"], 266)

    def test_override_place_takes_name_and_districts_from_its_pcode(self):
        rec = S._override_place({"place": "Aitaroun", "district": "Bint Jbeil", "lat": 33.11564, "lon": 35.46783, "pcode": "LBN41003"}, G.load())
        self.assertEqual(rec["src"], "override")
        self.assertTrue(rec["adm1"])
        self.assertAlmostEqual(rec["lat"], 33.11564)

    def test_malformed_override_lines_are_skipped(self):
        import tempfile
        d = tempfile.mkdtemp()
        p = os.path.join(d, "o.jsonl")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write('{"place": "A", "lat": 33.5, "lon": 35.5}\nnot json\n{"place": "B"}\n\n')
        self.assertEqual(len(S.load_overrides(p)), 1)
        self.assertEqual(S.load_overrides(os.path.join(d, "missing.jsonl")), {})
