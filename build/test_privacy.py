import importlib, json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load(terms_path):
    os.environ["HUB_PRIVATE_TERMS"] = terms_path
    import privacy
    return importlib.reload(privacy)


class PrivacyTest(unittest.TestCase):
    def test_absent_file_is_a_no_op(self):
        p = load(os.path.join(tempfile.mkdtemp(), "none.txt"))
        self.assertIsNone(p.pattern())
        self.assertIsNone(p.search("anything"))
        self.assertEqual(p.drops(), ({}, {}))

    def test_terms_and_drops_are_read_when_present(self):
        d = tempfile.mkdtemp()
        open(os.path.join(d, "t.txt"), "w").write("# note\n\nfoo\\d+\n")
        json.dump({"drop": {"01:1": "why"}, "rewrite": {"01:2": {"title": "x"}}}, open(os.path.join(d, "private-drops.json"), "w"))
        p = load(os.path.join(d, "t.txt"))
        self.assertTrue(p.search("a FOO12 b"))
        self.assertIsNone(p.search("foo"))
        self.assertEqual(p.drops(), ({"01:1": "why"}, {"01:2": {"title": "x"}}))

    def tearDown(self):
        os.environ.pop("HUB_PRIVATE_TERMS", None)


if __name__ == "__main__":
    unittest.main()
