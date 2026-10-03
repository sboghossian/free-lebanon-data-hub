#!/usr/bin/env python3
"""Re-fetch failed Wikipedia pages through the MediaWiki API (action=parse, redirects followed).

The page endpoint rate-limited the swarm (429) and some titles failed on encoding. The API at one
request per second is allowed and follows redirects. Results go into the same page cache under the
original URL, so every Jev check reads them unchanged. Usage: python3 wiki_refetch.py [delay_s=1.0]
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter

import jev_supervise as js

UA = "LebanonHub/1.0 (research; stephane.bio) python-urllib"


def title_of(url: str) -> tuple[str, str] | None:
    p = urllib.parse.urlparse(url)
    if not (p.hostname or "").endswith("wikipedia.org") or not p.path.startswith("/wiki/"):
        return None
    lang = p.hostname.split(".")[0]
    return lang, urllib.parse.unquote(p.path[len("/wiki/"):]).replace("_", " ")


def api_text(lang: str, title: str) -> tuple[str, str]:
    q = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "text", "format": "json",
                                "formatversion": 2, "redirects": 1})
    req = urllib.request.Request(f"https://{lang}.wikipedia.org/w/api.php?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = json.loads(r.read().decode("utf-8"))
    if "error" in d:
        return "missing", ""
    return "ok", js.html_to_text(d["parse"]["text"])[:400_000]


def main():
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
    todo = []
    for p in js.CACHE.glob("*"):
        try:
            r = json.loads(p.read_text())
        except (ValueError, OSError):
            continue
        if r.get("status") != "ok" and title_of(r.get("url") or ""):
            todo.append((p, r))
    print("wikipedia pages to retry:", len(todo))
    out = Counter()
    for p, r in todo:
        lang, title = title_of(r["url"])
        try:
            st, text = api_text(lang, title)
        except Exception as e:  # noqa: BLE001
            st, text = ("http_429" if "429" in str(e) else "error"), ""
            if st == "http_429":
                time.sleep(10)
        out[st] += 1
        if st == "ok":
            p.write_text(json.dumps({**r, "status": "ok", "http": 200, "text": text, "via": "mediawiki-api"}))
        time.sleep(delay)
    print(out)


if __name__ == "__main__":
    main()
