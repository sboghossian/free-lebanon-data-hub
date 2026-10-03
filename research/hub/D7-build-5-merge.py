"""D7 builder, part 5: merge the part JSONs into hub/series/D7-money.json and validate."""
import json, os, re
C = os.path.join(os.environ.get("HUB_ROOT", "."), "cache/hub-D7")
OUT = os.path.join(os.environ.get("HUB_ROOT", "."), "research/hub/series/D7-money.json")
allS = []
for p in ["part1_imf", "part2_wb_mof", "part3_budget", "part4_abl"]:
    allS += json.load(open(f"{C}/{p}.json"))
ids = [s["id"] for s in allS]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
pat = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
for s in allS:
    assert set(s) == {"id", "label", "unit", "topic", "freq", "source_url", "license", "points", "notes"}, s["id"]
    assert s["freq"] in ("daily", "weekly", "monthly", "yearly"), s["id"]
    assert s["source_url"].startswith("http"), s["id"]
    s["points"] = sorted(([str(t), v] for t, v in s["points"]), key=lambda p: p[0])
    ts = [p[0] for p in s["points"]]
    assert len(ts) == len(set(ts)), ("dup t", s["id"])
    for t, v in s["points"]:
        assert pat.match(t) and isinstance(v, (int, float)), (s["id"], t, v)
json.dump({"series": allS}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(allS), "series,", sum(len(s["points"]) for s in allS), "points,", os.path.getsize(OUT) // 1024, "KB")
for s in allS: print(f'{s["id"]:48s} {s["freq"][:1]} {s["points"][0][0]:>10} {s["points"][-1][0]:>10} n={len(s["points"])}')
