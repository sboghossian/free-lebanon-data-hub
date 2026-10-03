"""FE-D tool: list the English content strings the data files carry that data/i18n/ar.json has no translation for, grouped by kind.
Usage: python3 build/i18n_tools/gap.py [out.json]   (reads v5/data; run after build_timeline.py)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from hub import i18n_cov
from hub.lib import sha12

D = os.path.join(HERE, "..", "..", "v5", "data")
ar = json.load(open(os.path.join(D, "i18n", "ar.json")))
res = {}
for src in (i18n_cov.collect(D), i18n_cov.manifest_strings(D)):
    for k, v in src.items():
        miss = sorted(s for s in v if sha12(s) not in ar)
        if miss:
            res[k] = miss
for k, v in sorted(res.items()):
    print(f"{k:16s} {len(v):5d} strings {sum(len(x) for x in v):7d} chars")
if len(sys.argv) > 1:
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
