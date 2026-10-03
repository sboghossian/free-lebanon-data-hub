#!/usr/bin/env python3
"""Give harvest rows (files 73-75) a source Jev can read.
- "Wikipedia:<Page>" becomes a real URL (fr/ar pages by script or title).
- A news ref that is dead or blocked for good (401/403/404/410/empty/pdf) is swapped for the Wikipedia
  page the item was harvested from, which states the item; the original link stays in source_orig.
Rows are edited in place, never reordered. Usage: python3 harvest_fix_sources.py
"""
import json, os, re
from pathlib import Path
from urllib.parse import quote
import jev_supervise as js

R = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent)) / "research"
DEAD = {"http_401", "http_403", "http_404", "http_410", "empty", "pdf", "http_402", "http_526", "error", "timeout", "http_429", "http_522", "http_500"}
CANDS = {json.loads(l)["id"]: json.loads(l) for l in open(R / "v6/harvest-candidates.jsonl") if l.strip()}


def wiki_url(page: str) -> str:
    page = page.removeprefix("Wikipedia:").strip()
    lang = "ar" if re.search(r"[؀-ۿ]", page) else "fr" if re.search(r"\bau Liban\b|\ben Liban\b|^Liban\b", page) else "en"
    return f"https://{lang}.wikipedia.org/wiki/" + quote(page.replace(" ", "_"), safe="/:_()',-")


def main():
    n_wiki = n_swap = 0
    for f in sorted(R.glob("7[3-5]-harvest-*.timeline.jsonl")):
        lines = f.read_text().split("\n")
        for i, l in enumerate(lines):
            if not l.strip():
                continue
            r = json.loads(l)
            src = r.get("source") or ""
            if src.startswith("Wikipedia:"):
                r["source"] = wiki_url(src); n_wiki += 1
            elif src.startswith("http") and js.fetch(src)["status"] in DEAD:
                pages = (CANDS.get(r.get("harvest_id")) or {}).get("pages") or []
                if pages:
                    r["source_orig"] = src
                    r["source"] = wiki_url(pages[0]); n_swap += 1
            lines[i] = json.dumps(r, ensure_ascii=False)
        tmp = f.with_suffix(".tmp"); tmp.write_text("\n".join(lines)); tmp.replace(f)
    print("wikipedia refs fixed:", n_wiki, "| dead news refs swapped to harvest page:", n_swap)


if __name__ == "__main__":
    main()
