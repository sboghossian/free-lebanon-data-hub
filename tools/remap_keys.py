#!/usr/bin/env python3
"""Remove rows from the research JSONL files and keep every "file:line" key consistent.

Several files are keyed by line: research/20-facets.jsonl, 40-grounding.jsonl and strikes/_grounding.jsonl hold
rows whose "key" is "<jsonl file name>:<line index>" (index among the non-blank lines of that file). Delete a row from
the source file and every later key of that file is off by one. This tool removes rows and rewrites the keys.

A row is removed when
  * its line matches a private term (one case-insensitive regex per line in the terms file; optional), or
  * it is listed with --drop FILE.jsonl:INDEX (index counted before any removal).
Keyed rows that point at a removed row are removed too. Nothing changes when no row is removed.

Code that names rows by key ("01:29" is row 29 of the file whose key prefix is 01) is rewritten when --code is given.

Usage:
  python3 tools/remap_keys.py [--root research] [--terms FILE] [--drop FILE:IDX ...] [--code build/data.py ...] [--dry-run]
"""
import argparse, ast, collections, json, os, re, sys

KEY = re.compile(r"^(.+\.jsonl):(\d+)$")
CODE_KEY = re.compile(r"""(["'])(\d{2}[a-z]?):(\d+)\1""")


def load_terms(path):
    if not path or not os.path.exists(path):
        return None
    parts = [l.strip() for l in open(path, encoding="utf-8") if l.strip() and not l.lstrip().startswith("#")]
    return re.compile("|".join(f"(?:{p})" for p in parts), re.I) if parts else None


def jsonl_files(root):
    out = []
    for dp, _, fn in os.walk(root):
        out += [os.path.join(dp, f) for f in fn if f.endswith(".jsonl")]
    return sorted(out)


def prefix_map(root, data_py):
    """Key prefix ('01', '14e', ...) to file name, from the FILES literal of data.py plus the [5-8][0-9] glob files."""
    m = {}
    if data_py and os.path.exists(data_py):
        for node in ast.parse(open(data_py, encoding="utf-8").read()).body:
            if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", None) == "FILES":
                m.update(ast.literal_eval(node.value))
    for f in os.listdir(root):
        mm = re.match(r"^([5-8]\d)-.*\.timeline\.jsonl$", f)
        if mm and f not in m.values():
            m.setdefault(mm.group(1), f)
    return m


def run(root, terms, drops, code_files, data_py, dry=False):
    explicit = collections.defaultdict(set)
    for d in drops:
        f, _, i = d.rpartition(":")
        explicit[os.path.basename(f)].add(int(i))
    files = jsonl_files(root)
    names = collections.Counter(os.path.basename(p) for p in files)
    ambiguous = {n for n, c in names.items() if c > 1}   # e.g. i18n/ar/part-01.jsonl and i18n/fr/part-01.jsonl; never a key target
    rows = {}      # basename -> list of (line text)
    removed = collections.defaultdict(set)
    for p in files:
        b = os.path.basename(p) if os.path.basename(p) not in ambiguous else os.path.relpath(p, root)
        lines = [l for l in open(p, encoding="utf-8").read().split("\n") if l.strip()]
        rows[b] = lines
        for i, l in enumerate(lines):
            if i in explicit.get(b, ()) or (terms and terms.search(l)):
                removed[b].add(i)
    # old index -> new index, per file
    newidx = {}
    for b, lines in rows.items():
        k, m = 0, {}
        for i in range(len(lines)):
            if i not in removed.get(b, ()):
                m[i] = k
                k += 1
        newidx[b] = m
    stats = collections.Counter()
    for p in files:
        b = os.path.basename(p) if os.path.basename(p) not in ambiguous else os.path.relpath(p, root)
        out = []
        for i, l in enumerate(rows[b]):
            if i in removed.get(b, ()):
                stats["removed " + b] += 1
                continue
            try:
                r = json.loads(l)
            except ValueError:
                out.append(l)
                continue
            m = KEY.match(str(r.get("key", ""))) if isinstance(r, dict) else None
            if m and m.group(1) in newidx:
                new = newidx[m.group(1)].get(int(m.group(2)))
                if new is None:
                    stats["orphan removed " + b] += 1
                    continue
                if new != int(m.group(2)):
                    r["key"] = f"{m.group(1)}:{new}"
                    l = json.dumps(r, ensure_ascii=False)
                    stats["rekeyed " + b] += 1
            out.append(l)
        if len(out) != len(rows[b]) or any(a != c for a, c in zip(out, rows[b])):
            if not dry:
                open(p, "w", encoding="utf-8").write("\n".join(out) + "\n")
    pm = prefix_map(root, data_py)
    for cf in code_files:
        src = open(cf, encoding="utf-8").read()

        def fix(mo):
            pre, idx = mo.group(2), int(mo.group(3))
            f = pm.get(pre)
            if f is None or not removed.get(f):
                return mo.group(0)
            new = newidx[f].get(idx)
            if new is None:
                print(f"WARNING {cf}: key {pre}:{idx} points at a removed row", file=sys.stderr)
                return mo.group(0)
            stats["code keys " + cf] += new != idx
            return f"{mo.group(1)}{pre}:{new}{mo.group(1)}"
        new_src = CODE_KEY.sub(fix, src)
        if new_src != src and not dry:
            open(cf, "w", encoding="utf-8").write(new_src)
    for k, v in sorted(stats.items()):
        print(k, v)
    return removed, newidx


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default="research")
    ap.add_argument("--terms", default=os.environ.get("HUB_PRIVATE_TERMS", os.path.expanduser("~/.config/lebanon-hub/private-terms.txt")))
    ap.add_argument("--drop", action="append", default=[], metavar="FILE:IDX")
    ap.add_argument("--code", action="append", default=[], metavar="PY_FILE")
    ap.add_argument("--data-py", default="build/data.py")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    run(a.root, load_terms(a.terms), a.drop, a.code, a.data_py, a.dry_run)
