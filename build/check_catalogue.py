#!/usr/bin/env python3
"""Catalogue freshness: HEAD (then a 1 KB ranged GET if HEAD fails) for every dataset URL in
research/portals/*-catalogue.jsonl -> research/portals/freshness.json.
Records only what the server says (status, Last-Modified, Content-Length); it never logs in or evades a block.
  python3 check_catalogue.py
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlparse

PORTALS = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent)) / "research/portals"
UA = "LebanonHub/1.0 (research)"
CHECKED = "2026-10-03"
GAP = 0.5  # seconds between requests per host (<= 2/s)

_lock, _last = threading.Lock(), {}


def wait(host: str):
    with _lock:
        t = max(time.monotonic(), _last.get(host, 0) + GAP)
        _last[host] = t
    time.sleep(max(0, t - time.monotonic()))


def status_name(code: int | None, err: str | None = None) -> str:
    if code is None:
        return "timeout" if err and "timed out" in err else "error"
    return "ok" if 200 <= code < 300 else f"http_{code}"


def length_of(headers, ranged: bool) -> int | None:
    """Content-Length, or the total after the slash of Content-Range for a ranged GET."""
    cr = headers.get("Content-Range")
    if ranged and cr:
        m = re.search(r"/(\d+)$", cr)
        if m:
            return int(m.group(1))
    cl = headers.get("Content-Length")
    return int(cl) if cl and cl.isdigit() else None


def ascii_url(url: str) -> str:
    """Percent-encode non-ASCII path/query characters (Arabic file names) so urllib can send them."""
    return quote(url, safe="%:/?#[]@!$&'()*+,;=-._~")


def request(url: str, method: str, retry: int = 3):
    url = ascii_url(url)
    wait(urlparse(url).hostname or "")
    hdr = {"User-Agent": UA, "Accept-Encoding": "identity"}
    if method == "GET":
        hdr["Range"] = "bytes=0-1023"
    req = urllib.request.Request(url, headers=hdr, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            if method == "GET":
                r.read(1024)
            return r.status, r.headers, None
    except urllib.error.HTTPError as e:
        return e.code, e.headers, None
    except Exception as e:  # noqa: BLE001
        if retry and "nodename nor servname" not in str(e):  # transient reset/timeout: polite retries
            time.sleep(4 * (4 - retry))
            return request(url, method, retry - 1)
        return None, None, str(e)


def check(url: str) -> dict:
    code, h, err = request(url, "HEAD")
    method = "HEAD"
    if code is None or code >= 400:
        code2, h2, err2 = request(url, "GET")
        if code2 is not None and (code is None or code2 < code):
            code, h, err, method = code2, h2, err2, "GET"
        elif code is None:
            err = err2 or err
    rec = {"status": status_name(code, err), "http": code, "last_modified": None, "content_length": None,
           "checked": CHECKED}
    if h is not None:
        rec["last_modified"] = h.get("Last-Modified")
        rec["content_length"] = length_of(h, method == "GET")
    return rec


def catalogue_urls() -> list[str]:
    urls = set()
    for f in sorted(PORTALS.glob("*-catalogue.jsonl")):
        for line in f.open():
            if line.strip():
                try:
                    u = (json.loads(line).get("url") or "").strip()
                except json.JSONDecodeError:
                    continue
                if u.startswith("http"):
                    urls.add(u)
    return sorted(urls)


def main():
    urls = catalogue_urls()
    print(f"checking {len(urls)} urls", flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(check, urls))
    out = dict(zip(urls, res))
    dest = PORTALS / "freshness.json"
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    tmp.replace(dest)
    from collections import Counter
    print(dict(Counter(r["status"] for r in res)), "with Last-Modified:", sum(bool(r["last_modified"]) for r in res))


if __name__ == "__main__":
    main()
