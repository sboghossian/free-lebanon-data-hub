"""FE-D tool: which Downloads titles does the page (hub_data.js dlTitle) still show in English? Mirrors dlTitle: family patterns, number-normalised keys, "label (unit)" parts.
Usage: python3 build/i18n_tools/dl_gap.py [lang] [out.json]"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, ".."))
from hub.lib import sha12
D = os.path.join(HERE, "..", "..", "v5", "data")
lang = sys.argv[1] if len(sys.argv) > 1 else "ar"
T = json.load(open(os.path.join(D, "i18n", lang + ".json")))
look = lambda s: T.get(sha12(s))
def trLU(s):
    v = look(s)
    if v is not None: return v
    m = re.match(r"^(.*\S)\s+\(([^()]*(?:\([^()]*\)[^()]*)*)\)$", s)
    if not m: return None
    a, b = trLU(m.group(1)), trLU(m.group(2))
    return a + " (" + b + ")" if a is not None and b is not None else None
def resolve(s):
    m = re.match(r"^World: (.+), one row per country, one column per year$", s)
    if m and trLU(m.group(1)) is not None: return "pattern"
    m = re.match(r"^World: (.+), (\d+) countries and groups, (\d{4}) to (\d{4})$", s)
    if m and trLU(m.group(1)) is not None: return "pattern"
    nums = []
    key = re.sub(r"\d[\d,.]*\d|\d", lambda x: (nums.append(x.group(0)), "{n%d}" % len(nums))[1], s)
    if (nums and look(key) is not None) or look(s) is not None: return "key"
    if trLU(s) is not None: return "parts"
    return None
m = json.load(open(os.path.join(D, "manifest.json")))["files"]
miss, how = [], {}
for f in m:
    r = resolve(f["title"]); how[r] = how.get(r, 0) + 1
    if r is None: miss.append(f)
print(how, "of", len(m))
keys = {}
for f in miss:
    nums = []
    key = re.sub(r"\d[\d,.]*\d|\d", lambda x: (nums.append(x.group(0)), "{n%d}" % len(nums))[1], f["title"])
    keys.setdefault(key, []).append(f["path"])
print(len(keys), "distinct keys unresolved; series CSV:", sum(1 for f in miss if f["path"].startswith("data/csv/series/")))
if len(sys.argv) > 2: json.dump({"dl_title": sorted(keys)}, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
