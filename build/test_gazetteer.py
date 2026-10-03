"""Tests for gazetteer.normalize / lookup. Run: python3 -m unittest build/test_gazetteer.py (or pytest)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gazetteer as gz  # noqa: E402

# Spellings of the same place that must normalise to the SAME key.
SAME = [
    ("Aita al-Shaab", "Ayta ash Shab", "Aita ech Chaab", "Aita el Chaab"),
    ("Aitaroun", "Aytaroun", "Aitarun"),
    ("Khiam", "El Khiam", "Al-Khiyam", "Khiyam"),
    ("Dahieh", "Dahiyeh", "Dahiya", "Dahiyah", "Al-Dahiyeh"),
    ("Kfar Kila", "Kafr Kila", "Kfar Kela", "Kefr Kila"),
    ("Kfar Chouba", "Kfarchouba", "Kfar Shouba", "Kafr Shuba"),
    ("Deir Qanoun en Nahr", "Dayr Qanun an Nahr", "Der Kanoun el Nahr"),
    ("Ain Ebel", "Ayn Ibil", "Ein Ebel", "Aïn Ebel"),
    ("Ain el-Hilweh", "Ein al-Hilweh", "'Ayn al-Hilwah", "Aïn el Hilwé"),
    ("Nabatieh", "Nabatiyeh", "El Nabatieh", "Nabatiya", "Nabatiyé"),
    ("Marjayoun", "Marjeyoun", "Marjaayoun", "Marjayun"),
    ("Baalbek", "Baalbeck", "Ba'albek", "Balbek"),
    ("Tyre", "Sour", "Sur"),
    ("Sidon", "Saida", "Sayda", "Seida"),
    ("Tripoli", "Trablus", "Tarablus", "Trablous"),
    ("Beirut", "Beyrouth", "Bayrut", "Beyrut"),
    ("Byblos", "Jbeil", "Jubayl", "Jbail"),
    ("Hasbaya", "Hasbaiya", "Hasbayya", "Hasbeya"),
    ("Rachaya", "Rashaya", "Rashayya", "Rachaiya"),
    ("Zahle", "Zahleh", "Zahlé", "Zahla"),
    ("Jezzine", "Jezzin", "Jizzin", "Jezzine"),
    ("Naqoura", "Naqura", "En Naqoura", "An-Naqurah", "Nakoura"),
    ("Qana", "Kana", "Cana", "Qāna"),
    ("Bekaa", "Beqaa", "Bika'a", "Biqa", "Bekaa Valley"),
    ("Chouf", "Shouf", "Shuf", "El Chouf"),
    ("Hermel", "El Hermel", "Hirmil", "Al-Hermil"),
    ("Jabal Amel", "Jebel Amel", "Jabal 'Amil", "Jbal Amil"),
    ("Bsharri", "Bcharre", "Bsherri", "Becharre"),
    ("Wadi Khaled", "Ouadi Khaled", "Wadi Khalid", "Oued Khaled"),
    ("Burj el-Shemali", "Bourj ech Chemali", "Borj Shemali"),
    ("Abu Qamha", "Abou Kamha", "Abu Kamha"),
    ("Western Bekaa", "West Bekaa", "West Beqaa"),
]

# Pairs that are the same place but only at consonant-skeleton level (similarity >= 0.8, normalize differs).
SIMILAR = [
    ("Bint Jbeil", "Bent Jubayl"),
    ("Haret Hreik", "Harat Hurayk"),
    ("Marwahin", "Marouhine"),
    ("Tarbikha", "Tarbikhah"),
    ("Bra'shit", "Brashit"),
    ("Beit ed-Dine", "Beiteddine"),
    ("Hirmil", "Hermel"),
    ("Trablus", "Tripoli"),
    ("Burj el-Shemali", "Burj ash Shamali"),
    ("Ain Ebel", "Ain Ibel"),
]

# Different places that must NOT be merged.
DIFFERENT = [
    ("Aitaroun", "Aita al-Shaab"),
    ("Kfar Kila", "Kfar Chouba"),
    ("Tyre", "Tripoli"),
    ("Bint Jbeil", "Jbeil"),
    ("Khiam", "Khirbet Selm"),
    ("Deir Mimas", "Deir Qanoun"),
    ("Sidon", "Beirut"),
    ("Ain Ebel", "Ain el Hilweh"),
]


class NormalizeTests(unittest.TestCase):
    def test_same_place_same_key(self):
        for group in SAME:
            keys = {gz.normalize(n) for n in group}
            self.assertEqual(len(keys), 1, "%s -> %s" % (group, {n: gz.normalize(n) for n in group}))

    def test_similar_pairs_score_high(self):
        for a, b in SIMILAR:
            self.assertGreaterEqual(gz.similarity(a, b), 0.8, (a, b, gz.normalize(a), gz.normalize(b)))

    def test_different_places_stay_apart(self):
        for a, b in DIFFERENT:
            self.assertLess(gz.similarity(a, b), 0.8, (a, b, gz.normalize(a), gz.normalize(b)))

    def test_diacritics_apostrophes_hyphens(self):
        self.assertEqual(gz.normalize("Deïr Mâr Eliâs"), gz.normalize("Deir Mar Elias"))
        self.assertEqual(gz.normalize("Ba'albek"), gz.normalize("Baalbek"))
        self.assertEqual(gz.normalize("Ain-el-Hilweh"), gz.normalize("Ain el Hilweh"))

    def test_empty_and_odd_input(self):
        self.assertEqual(gz.normalize(""), "")
        self.assertEqual(gz.normalize(None), "")
        self.assertEqual(gz.normalize("El"), "el")      # an article on its own is kept, not erased

    def test_arabic(self):
        self.assertEqual(gz.normalize("الخيام"), gz.normalize("خيام"))
        self.assertEqual(gz.normalize("عيتا الشعب"), gz.normalize("عيتا  الشعب"))
        self.assertEqual(gz.normalize("صور"), "صور")


@unittest.skipUnless(os.path.exists(gz.GAZETTEER_PATH), "gazetteer.jsonl not built")
class LookupTests(unittest.TestCase):
    def top(self, name, **kw):
        res = gz.lookup(name, **kw)
        return res[0]["place"] if res else None

    def test_core_villages(self):
        self.assertEqual(self.top("Ayta ash Shab", district="Bint Jbeil")["name"].lower().replace(" ", ""), "aitaechchaab")
        p = self.top("El Khiam", district="Marjayoun")
        self.assertEqual((p["adm2"], round(p["lat"], 1)), ("Marjaayoun", 33.3))
        self.assertEqual(self.top("Aitaroun")["adm2"], "Bent Jbeil")

    def test_dahieh_and_haret_hreik(self):
        d = self.top("Dahiyeh")
        self.assertEqual((d["name"], d["kind"]), ("Dahieh", "area"))
        h = self.top("Haret Hreik")
        self.assertIn("Hr", h["name"])
        self.assertEqual(h["adm2"], "Baabda")
        self.assertEqual(self.top("Dahieh")["lat"], d["lat"])

    def test_city_exonyms(self):
        self.assertEqual(self.top("Tyre")["name"], "Sour")
        self.assertEqual(self.top("Sidon")["adm2"], "Saida")
        self.assertEqual(self.top("Beyrouth", kinds={"city"})["name"], "Beirut")
        self.assertEqual(self.top("Nabatiyeh", kinds={"city"})["adm2"], "El Nabatieh")

    def test_district_filter_never_crosses(self):
        # Several villages are called Qlayaa/Khiam-like across districts; a district must pin the result.
        for q, d in (("Khiam", "Marjayoun"), ("Qana", "Tyre"), ("Marwahin", "Sour"), ("Yaroun", "Bint Jbeil")):
            for c in gz.lookup(q, district=d, limit=20, min_score=0.3):
                self.assertTrue(c["place"]["adm2"] and gz.normalize(c["place"]["adm2"]) in
                                {gz.normalize(d), gz.normalize({"Tyre": "Sour", "Marjayoun": "Marjaayoun", "Bint Jbeil": "Bent Jbeil"}.get(d, d))}
                                or c["place"]["adm1"] and gz.normalize(c["place"]["adm1"]) == gz.normalize(d), (q, d, c["place"]))
        # Khiam exists in Marjayoun and (as El Khiam) in Chouf: filtering must drop the Chouf one.
        self.assertEqual({c["place"]["adm2"] for c in gz.lookup("Khiam", district="Marjayoun")}, {"Marjaayoun"})
        self.assertEqual({c["place"]["adm2"] for c in gz.lookup("Khiam", district="Chouf")}, {"Chouf"})

    def test_district_spelling_variants(self):
        for d in ("Tyre", "Sour", "Sur", "Bint Jbeil", "Bent Jbeil", "Marjayoun", "Nabatieh", "Zahrani", "South Lebanon"):
            self.assertTrue(gz.known_district(d), d)
        self.assertEqual(gz.lookup("Khiam", district="Atlantis"), [])

    def test_alts_and_arabic(self):
        self.assertEqual(self.top("x", alts=["Khiam"], district="Marjayoun")["name"], "Khiam")
        self.assertEqual(self.top("الخيام", district="Marjayoun")["name"], "Khiam")

    def test_camps_and_neighbourhoods(self):
        self.assertEqual(self.top("Shatila", kinds={"camp"})["kind"], "camp")
        self.assertEqual(self.top("Ein el-Hilweh camp")["name"], "Ein el-Hilweh")
        self.assertEqual(self.top("Burj el-Barajneh", kinds={"camp"})["adm2"], "Baabda")
        self.assertEqual(self.top("Achrafieh", district="Beirut")["kind"], "neighbourhood")

    def test_scores_sorted_and_bounded(self):
        res = gz.lookup("Kfar Kila", limit=10, min_score=0.3)
        self.assertEqual([c["score"] for c in res], sorted((c["score"] for c in res), reverse=True))
        self.assertTrue(all(0 <= c["score"] <= 1 for c in res))
        self.assertEqual(gz.lookup("", limit=3), [])


if __name__ == "__main__":
    unittest.main()
