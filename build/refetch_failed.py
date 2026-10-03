#!/usr/bin/env python3
"""Retry cached fetches that failed for transient reasons (429, timeout, connection error).

The swarm hit Wikipedia and news sites hard, so many cached pages hold a rate-limit status rather
than text. This re-fetches only those, slowly, so the Jev checks can read them.
Usage: python3 refetch_failed.py [workers=4] [delay_s=0.5]
"""
import json
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import jev_supervise as js

RETRY = {"http_429", "timeout", "error", "http_503", "http_502", "http_500"}


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    delay = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    todo = []
    for p in js.CACHE.glob("*"):
        try:
            r = json.loads(p.read_text())
        except (ValueError, OSError):
            continue
        if r.get("status") in RETRY and r.get("url"):
            todo.append((p, r["url"]))
    print("retrying", len(todo))

    def one(item):
        p, url = item
        p.unlink(missing_ok=True)
        time.sleep(delay)
        return js.fetch(url)["status"]

    with ThreadPoolExecutor(max_workers=workers) as ex:
        print(Counter(ex.map(one, todo)))


if __name__ == "__main__":
    main()
