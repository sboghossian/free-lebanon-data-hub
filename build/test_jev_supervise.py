"""Pure-function tests for jev_supervise (stdlib unittest; no network, no Jev)."""
import unittest
import jev_supervise as js


class Tier(unittest.TestCase):
    def test_map(self):
        self.assertEqual(js.tier_of("https://www.imf.org/en/Countries/LBN"), "T1")
        self.assertEqual(js.tier_of("https://pcm.gov.lb/x"), "T1")
        self.assertEqual(js.tier_of("https://www.aub.edu.lb/x"), "T2")
        self.assertEqual(js.tier_of("https://today.lorientlejour.com/article/1"), "T3")
        self.assertEqual(js.tier_of("https://en.wikipedia.org/wiki/Lebanon"), "T4")
        self.assertEqual(js.tier_of("https://www.numbeo.com/cost"), "blocked")
        self.assertIsNone(js.tier_of("https://random-blog.example/post"))

    def test_lookalike_is_not_mapped(self):
        self.assertIsNone(js.tier_of("https://imf.org.fake-news.xyz/a"))


class DateFound(unittest.TestCase):
    TEXT = "The agreement was signed on 22 October 1989 in Taif. Parliament met in November 1989."

    def test_levels(self):
        self.assertEqual(js.date_found(self.TEXT, "1989-10-22"), "day")
        self.assertEqual(js.date_found(self.TEXT, "1989-11"), "month")
        self.assertEqual(js.date_found(self.TEXT, "1989"), "year")
        self.assertEqual(js.date_found(self.TEXT, "1990-01-01"), "no")
        self.assertEqual(js.date_found(self.TEXT, "1989-03-01"), "year")
        self.assertEqual(js.date_found("On October 22, 1989 the deal", "1989-10-22"), "day")
        self.assertEqual(js.date_found("le 22 octobre 1989", "1989-10-22"), "day")
        self.assertEqual(js.date_found("x", ""), "no")


class Passage(unittest.TestCase):
    def test_picks_relevant_para_and_keeps_order(self):
        text = "\n\n".join(["Weather was mild across the region that spring season overall.",
                        "The Taif Agreement ended the civil war and amended the constitution in 1989.",
                        "Football results were announced for the national league that week again."])
        p = js.select_passage(text, "Taif Agreement ends civil war", "1989", limit=500)
        self.assertIn("Taif Agreement", p)
        self.assertLessEqual(len(p), 500)

    def test_empty(self):
        self.assertEqual(js.select_passage("", "x", None), "")


class Verdict(unittest.TestCase):
    def test_rules(self):
        self.assertEqual(js.verdict("ok", 0.5, 0.1, "no"), "grounded")
        self.assertEqual(js.verdict("ok", 0.1, 0.7, "year"), "grounded")
        self.assertEqual(js.verdict("ok", 0.1, 0.7, "no"), "weak")
        self.assertEqual(js.verdict("ok", 0.05, 0.1, "day"), "unsupported")
        self.assertEqual(js.verdict("http_403", None, None, "no"), "unchecked")


class DataPage(unittest.TestCase):
    def test_data_pages(self):
        self.assertTrue(js.is_data_page("https://ourworldindata.org/grapher/gdp-per-capita-maddison-project-database?country=LBN"))
        self.assertFalse(js.is_data_page("https://ourworldindata.org/lebanon-article"))


class LawNo(unittest.TestCase):
    def test_found(self):
        self.assertEqual(js.law_no_found("Law No. 81/2018 on electronic transactions", "Law 81/2018"), "yes")
        self.assertEqual(js.law_no_found("la loi n° 81 du 10 octobre 2018", "Law 81/2018"), "yes")
        self.assertEqual(js.law_no_found("Law 82/2018 on something", "Law 81/2018"), "no")
        self.assertEqual(js.law_no_found("anything", None), "n/a")


class Office(unittest.TestCase):
    def test_office(self):
        t = "Fouad Chehab served as President from 23 September 1958 to 22 September 1964."
        self.assertEqual(js.office_check(t, "Fouad Chehab", "1958-09-23"), "grounded")
        self.assertEqual(js.office_check(t, "Fouad Chehab", "1970-01-01"), "weak")
        self.assertEqual(js.office_check(t, "Camille Chamoun", "1952-09-23"), "unsupported")
        self.assertEqual(js.office_check(t, "Vacuum", "1988-09-23"), "unchecked")



class TableCheck(unittest.TestCase):
    TEXT = "| 12 | Khaled Chehab | 18 March 1938 | 24 October 1938 | ... long filler " + "x" * 400 + " Sami Solh | 1954"

    def test_name_near_exact_day(self):
        self.assertEqual(js.table_check(self.TEXT, ["Khaled Chehab"], "1938-03-18"), "grounded")
        self.assertEqual(js.table_check("Chehab took office on March 18, 1938.", ["Khaled Chehab"], "1938-03-18"), "grounded")

    def test_falls_back_to_jev(self):
        self.assertIsNone(js.table_check(self.TEXT, ["Khaled Chehab"], "1938-03-19"))   # wrong day
        self.assertIsNone(js.table_check(self.TEXT, ["Sami Solh"], "1938-03-18"))       # date far from name
        self.assertIsNone(js.table_check(self.TEXT, ["Khaled Chehab"], "1938-03"))      # not a day
        self.assertIsNone(js.table_check(self.TEXT, [], "1938-03-18"))
        self.assertIsNone(js.table_check(self.TEXT, None, "1938-03-18"))

class Refetch(unittest.TestCase):
    def test_wayback_api_url(self):
        u = js.wayback_api_url("https://x.org/a b?q=1&r=2")
        self.assertEqual(u, "https://archive.org/wayback/available?url=https%3A%2F%2Fx.org%2Fa%20b%3Fq%3D1%26r%3D2")

    def test_snapshot_raw_url(self):
        self.assertEqual(js.snapshot_raw_url("http://web.archive.org/web/20230115123000/https://x.org/a?b=1"),
                         "https://web.archive.org/web/20230115123000id_/https://x.org/a?b=1")
        raw = "https://web.archive.org/web/20230115123000id_/https://x.org/a"
        self.assertEqual(js.snapshot_raw_url(raw), raw)
        self.assertEqual(js.snapshot_raw_url("https://other.org/x"), "https://other.org/x")

    def test_parse_wayback(self):
        ok = {"archived_snapshots": {"closest": {"available": True, "status": "200", "timestamp": "20230115123000",
                                                  "url": "http://web.archive.org/web/20230115123000/https://x.org/a"}}}
        self.assertEqual(js.parse_wayback(ok), "https://web.archive.org/web/20230115123000id_/https://x.org/a")
        self.assertIsNone(js.parse_wayback({"archived_snapshots": {}}))
        self.assertIsNone(js.parse_wayback({}))
        bad = {"archived_snapshots": {"closest": {"available": True, "status": "404", "url": "http://web.archive.org/web/2023/x"}}}
        self.assertIsNone(js.parse_wayback(bad))

    def test_status_mapping(self):
        self.assertEqual(js.status_of_http(403), "http_403")
        self.assertEqual(js.status_of_http(None), "error")
        for st in ("http_401", "http_403", "http_429", "error", "timeout", "empty"):
            self.assertEqual(js.refetch_kind({"status": st}), "wayback")
        self.assertEqual(js.refetch_kind({"status": "pdf"}), "pdf")
        for st in ("ok", "http_404", "http_410", "not_url", "http_500"):
            self.assertIsNone(js.refetch_kind({"status": st}))

    def test_refetch_skips_done_records(self):
        self.assertIsNone(js.refetch_kind({"status": "http_403", "via": "wayback"}))
        tried = js.failed_record({"status": "http_403"}, "no_snapshot")
        self.assertIsNone(js.refetch_kind(tried))
        self.assertEqual(js.refetch_kind(tried, force=True), "wayback")

    def test_pdf_record_shape(self):
        r = js.pdf_record({"url": "u", "status": "pdf", "http": 200, "text": ""}, "t" * 300, "/c/p.pdf")
        self.assertEqual((r["status"], r["via"], r["pdf_path"], r["orig_status"]), ("ok", "pdf", "/c/p.pdf", "pdf"))
        self.assertEqual(len(r["text"]), 300)

    def test_wayback_record_shape(self):
        snap = "https://web.archive.org/web/2023id_/https://x.org/a"
        r = js.wayback_record({"url": "https://x.org/a", "status": "http_403", "http": 403, "text": ""}, snap, "body " * 100)
        self.assertEqual((r["status"], r["via"], r["snapshot"], r["orig_status"], r["http"]), ("ok", "wayback", snap, "http_403", 200))
        self.assertEqual(r["url"], "https://x.org/a")
        self.assertNotIn("pdf_path", r)

    def test_failed_record_keeps_status(self):
        r = js.failed_record({"url": "u", "status": "timeout"}, "no_snapshot")
        self.assertEqual(r["status"], "timeout")
        self.assertEqual(r["refetch"]["result"], "no_snapshot")

    def test_throttle_spaces_requests(self):
        import time
        t = js.Throttle({"h": 0.2})
        t0 = time.monotonic()
        t.wait("h"); t.wait("h"); t.wait("h")
        self.assertGreaterEqual(time.monotonic() - t0, 0.38)


if __name__ == "__main__":
    unittest.main()


class StrikePassage(unittest.TestCase):
    TEXT = ("On 12 July 2006 Israeli aircraft struck a house in Srifa, killing 26. " + "x" * 2000 +
            " On 30 July an airstrike hit a building in Qana.")

    def test_place_and_date(self):
        import strike_check as sc
        p = sc.passage(self.TEXT, ["Srifa"], "2006-07-12")
        self.assertIn("Srifa", p)
        self.assertIsNone(sc.passage(self.TEXT, ["Bint Jbeil"], "2006-07-12"))
        self.assertIn("Qana", sc.passage(self.TEXT, ["Qana", "Cana"], "2006-07-30"))

    def test_date_forms(self):
        import strike_check as sc
        self.assertEqual(sc.date_forms("2006-07-30")[:2], ["30 July 2006", "July 30, 2006"])
        self.assertEqual(sc.date_forms("2006-07"), ["July 2006"])


class ArchiveBooks(unittest.TestCase):
    def test_book_id(self):
        self.assertEqual(js.archive_book_id("https://archive.org/details/fiftythreeyearsi011832mbp/page/n12/mode/2up"), "fiftythreeyearsi011832mbp")
        self.assertEqual(js.archive_book_id("https://archive.org/stream/druzesmaronites00chur"), "druzesmaronites00chur")
        self.assertIsNone(js.archive_book_id("https://archive.org/web/2020/https://x.org"))
        self.assertIsNone(js.archive_book_id("https://en.wikipedia.org/wiki/Beirut"))
