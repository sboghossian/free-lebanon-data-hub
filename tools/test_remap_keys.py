import json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import remap_keys as rk


def write(p, rows):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write("".join(json.dumps(r) + "\n" for r in rows))


def read(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


class RemapTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.root = os.path.join(self.d, "research")
        write(os.path.join(self.root, "50-a.timeline.jsonl"), [{"title": f"t{i}"} for i in range(5)])
        write(os.path.join(self.root, "20-facets.jsonl"), [{"key": f"50-a.timeline.jsonl:{i}", "f": i} for i in range(5)])
        write(os.path.join(self.root, "strikes", "_grounding.jsonl"), [{"key": f"50-a.timeline.jsonl:{i}"} for i in (0, 2, 4)])
        self.terms = os.path.join(self.d, "terms.txt")
        open(self.terms, "w").write("# comment\nsecret\\w*\n")
        code = os.path.join(self.d, "code.py")
        open(code, "w").write('X = ["50:4", "50:1"]\n')
        self.code = code

    def test_drop_by_index_rekeys_everything(self):
        rk.run(self.root, None, ["50-a.timeline.jsonl:1"], [self.code], None)
        self.assertEqual([r["title"] for r in read(os.path.join(self.root, "50-a.timeline.jsonl"))], ["t0", "t2", "t3", "t4"])
        self.assertEqual([r["key"] for r in read(os.path.join(self.root, "20-facets.jsonl"))],
                         ["50-a.timeline.jsonl:0", "50-a.timeline.jsonl:1", "50-a.timeline.jsonl:2", "50-a.timeline.jsonl:3"])
        self.assertEqual([r["key"] for r in read(os.path.join(self.root, "strikes", "_grounding.jsonl"))],
                         ["50-a.timeline.jsonl:0", "50-a.timeline.jsonl:1", "50-a.timeline.jsonl:3"])
        self.assertEqual(open(self.code).read(), 'X = ["50:4", "50:1"]\n'.replace("50:4", "50:3"))   # 50:1 was removed, so it is left (and warned about)

    def test_terms_remove_matching_rows(self):
        write(os.path.join(self.root, "50-a.timeline.jsonl"), [{"title": "ok"}, {"title": "a Secretword here"}, {"title": "ok2"}])
        write(os.path.join(self.root, "20-facets.jsonl"), [{"key": f"50-a.timeline.jsonl:{i}"} for i in range(3)])
        rk.run(self.root, rk.load_terms(self.terms), [], [], None)
        self.assertEqual(len(read(os.path.join(self.root, "50-a.timeline.jsonl"))), 2)
        self.assertEqual([r["key"] for r in read(os.path.join(self.root, "20-facets.jsonl"))], ["50-a.timeline.jsonl:0", "50-a.timeline.jsonl:1"])

    def test_no_removal_changes_nothing(self):
        before = open(os.path.join(self.root, "20-facets.jsonl")).read()
        rk.run(self.root, None, [], [], None)
        self.assertEqual(open(os.path.join(self.root, "20-facets.jsonl")).read(), before)


if __name__ == "__main__":
    unittest.main()
