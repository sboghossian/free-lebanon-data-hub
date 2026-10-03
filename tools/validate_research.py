#!/usr/bin/env python3
"""Check that every JSON and JSONL file under research/ and build/i18n parses, and that "file:line" keys point at a real row.
No network. Exit code 1 on the first class of problem found, after listing all of them.
Usage: python3 tools/validate_research.py [repo_root]"""
import collections, json, os, re, sys

KEY = re.compile(r"^(.+\.jsonl):(\d+)$")


def main(root):
    bad, rows = [], {}
    for sub in ("research", "build/i18n", "build/geo"):
        for dp, _, fn in os.walk(os.path.join(root, sub)):
            for f in sorted(fn):
                p = os.path.join(dp, f)
                rel = os.path.relpath(p, root)
                try:
                    if f.endswith(".jsonl"):
                        with open(p, encoding="utf-8") as fh:
                            rows[f if f not in rows else rel] = [json.loads(l) for l in fh if l.strip()]
                    elif f.endswith(".json"):
                        with open(p, encoding="utf-8") as fh:
                            json.load(fh)
                except (ValueError, UnicodeDecodeError) as e:
                    bad.append(f"{rel}: {e}")
    broken = collections.Counter()
    for name, rs in rows.items():
        for r in rs:
            m = KEY.match(str(r.get("key", ""))) if isinstance(r, dict) else None
            if m and m.group(1) in rows:
                if int(m.group(2)) >= len(rows[m.group(1)]):
                    broken[name] += 1
                elif m.group(1).endswith(".timeline.jsonl") and r.get("title") and r["title"] != rows[m.group(1)][int(m.group(2))].get("title"):
                    broken[name] += 1   # a grounding row whose title is not the title of the row its key names: keys are out of step
    bad += [f"{n}: {c} keys point past the end of their file or at a row with another title" for n, c in sorted(broken.items())]
    print(f"checked {sum(len(v) for v in rows.values()):,} JSONL rows in {len(rows)} files")
    for b in bad:
        print("PROBLEM", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
