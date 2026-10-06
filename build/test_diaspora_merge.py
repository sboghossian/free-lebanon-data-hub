import json, os, tempfile, unittest
import diaspora_merge as dm


class Classify(unittest.TestCase):
    def test_born(self):
        o, s, m = dm.classify("Jo Doe (born 1950) is a French banker. Doe was born in Beirut, Lebanon, and moved to Paris.")
        self.assertEqual(o, "born_in_lebanon")

    def test_relative_birth_is_not_the_person(self):
        o, s, m = dm.classify("Carlos Slim was born in Mexico City. His father, Julian, was born in Jezzine, Lebanon. Linda, of Lebanese ancestry, was born in Parral.")
        self.assertEqual(o, "lebanese_descent")

    def test_raised_in_is_not_born_in(self):
        o, s, m = dm.classify("Ayah Doe (born 1982 in Montreal) is a Lebanese-Canadian founder. She was born in Canada and raised in Beirut.")
        self.assertEqual(o, "lebanese_descent")

    def test_citizen(self):
        o, s, m = dm.classify("Saad Doe (born 1970 in Riyadh) is a Lebanese businessman and politician.")
        self.assertEqual(o, "lebanese_citizen")

    def test_son_of_lebanese_born_is_descent(self):
        o, s, m = dm.classify("Nick Doe is the son of Lebanese-born Nicolas Doe, the founder of Acme.")
        self.assertEqual(o, "lebanese_descent")

    def test_no_mention_is_dropped(self):
        o, why, m = dm.classify("Jane Roe is an American founder. She studied in Boston.")
        self.assertIsNone(o)
        self.assertIn("does not mention", why)

    def test_mention_without_origin_is_dropped(self):
        o, why, m = dm.classify("Jo Roe moved to Sweden, fleeing the Lebanese Civil War with his family.")
        self.assertIsNone(o)

    def test_quote_has_no_religion_and_at_most_20_words(self):
        o, s, m = dm.classify("Edmond Jacob Safra was born on 6 August 1932, in Beirut, Lebanon, his family is of Sephardic Jewish background originally from Aleppo and with banking connections going back a long time.")
        q = dm.quote(s, m)
        self.assertLessEqual(len(q.split()), 20)
        self.assertNotRegex(q, dm.RELIG)


class Merge(unittest.TestCase):
    def test_merge_dedupes_keeps_sources_and_is_rerunnable(self):
        with tempfile.TemporaryDirectory() as d:
            co, cache = os.path.join(d, "co"), os.path.join(d, "cache")
            os.makedirs(co)
            wd = {"company": "Acme Inc.", "person": "Jo Doe", "person_qid": "Q1", "role": "founder", "hq_country_iso3": "USA", "hq_city": "Boston", "kind": "startup",
                  "source": "https://www.wikidata.org/wiki/Q9", "origin": "lebanese_citizen", "origin_source": "https://www.wikidata.org/wiki/Q1"}
            gone = dict(wd, person="Al Poe", person_qid="Q2", company="Beta")
            open(os.path.join(co, "diaspora-wikidata.jsonl"), "w").write(json.dumps(wd) + "\n" + json.dumps(gone) + "\n")
            press = [{"company": "ACME", "person": "Jo Doe", "role": "founder", "hq_country_iso3": "USA", "sources": ["https://example.com/a"], "origin": "lebanese_citizen", "origin_source": "https://example.com/a", "founded": 2015},
                     {"company": "Home Co", "person": "Li Moe", "role": "ceo", "hq_country_iso3": "LBN", "sources": ["https://example.com/b"], "origin": "born_in_lebanon"}]
            dm.CO, dm.CACHE = co, cache
            os.makedirs(cache)
            json.dump({"title": "Jo Doe"}, open(os.path.join(cache, "sitelink-Q1.json"), "w"))
            json.dump({"title": "Al Poe"}, open(os.path.join(cache, "sitelink-Q2.json"), "w"))
            json.dump({"title": "Jo Doe", "text": "Jo Doe is a Lebanese businessman."}, open(os.path.join(cache, "wp-Jo_Doe.json"), "w"))
            json.dump({"title": "Al Poe", "text": "Al Poe is an American founder."}, open(os.path.join(cache, "wp-Al_Poe.json"), "w"))
            for _ in range(2):                                        # no press file the first time, then with one: both runs work
                out, dropped = dm.main(offline=True)
                if _ == 0:
                    self.assertEqual(len(out), 1)
                    open(os.path.join(co, "diaspora-press.jsonl"), "w").write("".join(json.dumps(p) + "\n" for p in press))
            self.assertEqual(len(out), 1)                              # Acme merged, Beta dropped, Home Co (Lebanon HQ) dropped
            self.assertIsNone(out[0]["founded"])                      # press founding years are not checked against a source, so they never fill a field
            self.assertIn("https://example.com/a", out[0]["sources"])
            self.assertTrue(any("wikidata.org" in u for u in out[0]["sources"]))
            reasons = " ".join(x[2] for x in dropped)
            self.assertIn("does not mention", reasons)
            self.assertIn("outside Lebanon", reasons)
            self.assertTrue(os.path.exists(os.path.join(co, "diaspora-dropped.tsv")))


if __name__ == "__main__":
    unittest.main()
