"""v10 Data tab helpers (hub/emit_data.py): search normalisation, topic rules, time keys and sparklines. Run: cd build && python3 -m unittest test_data_v10"""
import json, os, unittest
from hub.emit_data import dx_norm, dx_key, file_topic, spark, _tx, FILE_TOPIC, TOPICS, SPARK

V5 = os.path.expanduser("~/lebanon-miti/v5/data/manifest.json")


class Norm(unittest.TestCase):
    def test_arabic(self):
        self.assertEqual(dx_norm("بَعْلَبَكّ"), dx_norm("بعلبك"))
        self.assertEqual(dx_norm("إلغاء"), "الغاء")
        self.assertEqual(dx_norm("آذار"), "اذار")
        self.assertEqual(dx_norm("على"), "علي")
        self.assertEqual(dx_norm("مدرسة"), "مدرسه")
        self.assertEqual(dx_norm("قانون ٨١/٢٠١٨"), "قانون 81 2018")
        self.assertEqual(dx_norm("بـيـروت"), "بيروت")

    def test_latin(self):
        self.assertEqual(dx_norm("Électricité, Zahlé!"), "electricite zahle")
        self.assertEqual(dx_norm(None), "")

    def test_key_skips_known_words(self):
        self.assertEqual(dx_key("Beirut Beyrouth", skip=("Beirut",)), "beyrouth")


class Topics(unittest.TestCase):
    def test_rules(self):
        self.assertEqual(file_topic("data/csv/series/cost-of-living-2.csv"), "cost")
        self.assertEqual(file_topic("data/places/p/LB11.json"), "places")
        self.assertEqual(file_topic("data/csv/attacks.csv"), "map")
        self.assertEqual(file_topic("data/csv/world/economy.csv"), "world")
        self.assertEqual(file_topic("data/csv/mideast/ucdp-ged-lebanon.csv"), "mideast")
        self.assertEqual(file_topic("data/csv/series/companies-banks.csv"), "companies")
        self.assertEqual(file_topic("data/csv/aid-reach.csv"), "aid")
        self.assertEqual(file_topic("data/csv/laws.csv"), "")
        self.assertTrue({tp for _, tp in FILE_TOPIC} == set(TOPICS))

    @unittest.skipUnless(os.path.exists(V5), "no v5 build")
    def test_every_topic_has_files(self):
        paths = [f["path"] for f in json.load(open(V5))["files"]]
        self.assertTrue(all(any(file_topic(p) == tp for p in paths) for tp in TOPICS))


class Spark(unittest.TestCase):
    def test_time_keys(self):
        self.assertEqual(_tx("2020"), 2020)
        self.assertAlmostEqual(_tx("2020-07"), 2020.5)
        self.assertAlmostEqual(_tx("2020-Q3"), 2020.5)
        self.assertIsNone(_tx("AB 2024"))

    def test_downsample(self):
        pts = [[str(1900 + i), i] for i in range(200)]
        t0, t1, n, flat = spark(pts)
        self.assertEqual((t0, t1, n), ("1900", "2099", 200))
        self.assertLessEqual(len(flat), 2 * SPARK)
        self.assertEqual(flat[:2], [1900, 0])
        self.assertEqual(flat[-2:], [2099, 199])

    def test_categories_and_bad_values(self):
        self.assertEqual(spark([["Solar", 27], ["Generator", 58]]), (None, None, 0, []))
        self.assertEqual(spark([["2020", None], ["2021", float("nan")], ["2022", True]]), (None, None, 0, []))


if __name__ == "__main__":
    unittest.main()
