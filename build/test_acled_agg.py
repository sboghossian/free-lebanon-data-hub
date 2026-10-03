import io, json, os, sys, contextlib, tempfile, unittest
sys.path.insert(0, os.path.dirname(__file__))
import acled_agg as A

ROWS = [
    {"event_date": "2024-09-23", "event_type": "Explosions/Remote violence", "sub_event_type": "Air/drone strike",
     "admin2": "Bint Jbeil", "location": "Bint Jbeil", "latitude": "33.1203", "longitude": "35.4328", "fatalities": "3"},
    {"event_date": "2024-09-25", "event_type": "Explosions/Remote violence", "sub_event_type": "Air/drone strike",
     "admin2": "Bint Jbeil", "location": "Bint Jbeil", "latitude": "33.12031", "longitude": "35.43281", "fatalities": "2"},
    {"event_date": "2024-10-01", "event_type": "Battles", "sub_event_type": "Armed clash",
     "admin2": "Marjayoun", "location": "Khiam", "latitude": "33.3", "longitude": "35.6", "fatalities": ""},
    {"event_date": "bad", "event_type": "x"},
]


class T(unittest.TestCase):
    def test_aggregate(self):
        agg = A.aggregate(ROWS)
        self.assertEqual(len(agg), 2)
        c = agg[("Bint Jbeil", "Bint Jbeil", "2024-09", "Explosions/Remote violence", "Air/drone strike")]
        self.assertEqual((c["count"], c["fatalities"], c["lat"], c["lon"]), (2, 5, 33.1203, 35.4328))
        k = agg[("Khiam", "Marjayoun", "2024-10", "Battles", "Armed clash")]
        self.assertEqual((k["count"], k["fatalities"]), (1, 0))

    def test_output_no_raw_rows(self):
        out = A.to_output(A.aggregate(ROWS), "2026-10-01", "2026-10-01")
        s = json.dumps(out)
        self.assertEqual(out["events_aggregated"], 3)
        self.assertIn("ACLED", out["attribution"])
        self.assertNotIn("event_date", s)
        self.assertNotIn("2024-09-23", s)

    def test_cursor_pagination(self):
        pages = [{"data": ROWS[:2], "next_cursor": 77}, {"data": ROWS[2:3], "next_cursor": None}]
        urls = []
        def fake(url, token):
            urls.append(url); return pages[len(urls) - 1]
        got = [r for rows, _ in A.fetch_all("t", "2026-10-01", fake) for r in rows]
        self.assertEqual(len(got), 3)
        self.assertIn("cursor=0", urls[0]); self.assertIn("cursor=77", urls[1])
        self.assertIn("country=Lebanon", urls[0])

    def test_creds_env_and_file(self):
        self.assertIsNone(A.get_credentials({}, "/nonexistent"))
        self.assertEqual(A.get_credentials({"ACLED_EMAIL": "a@b", "ACLED_PASSWORD": "p"}, "/nonexistent"), ("a@b", "p"))
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as f:
            f.write('# c\nACLED_EMAIL=x@y\nACLED_PASSWORD="pw"\n')
        try:
            self.assertEqual(A.get_credentials({}, f.name), ("x@y", "pw"))
        finally:
            os.unlink(f.name)

    def test_no_creds_exits_zero(self):
        old = (A.get_credentials,)
        A.get_credentials = lambda *a, **k: None
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                rc = A.main()
        finally:
            A.get_credentials = old[0]
        self.assertEqual(rc, 0)
        self.assertIn("ACLED_EMAIL", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
