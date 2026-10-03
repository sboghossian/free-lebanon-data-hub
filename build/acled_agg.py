#!/usr/bin/env python3
"""ACLED adapter for the Free Lebanon Data Hub. Runs only with credentials.

Pulls Lebanon events (2016-01-01 -> today) from the ACLED API and aggregates
them to counts per (location, admin2, month, event_type, sub_event_type), with
summed fatalities and the location's lat/lon. Writes only the aggregate to
research/strikes/acled-agg.json. No raw rows are written. Credentials are read
from the environment (ACLED_EMAIL, ACLED_PASSWORD) or an optional .env file at the repo root, and are never printed or
written. API docs checked 2026-10-01 (acleddata.com/api-documentation).
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict

TOKEN_URL = "https://acleddata.com/oauth/token"
READ_URL = "https://acleddata.com/api/acled/read"
ROOT = os.environ.get("HUB_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_FILE = os.path.join(ROOT, ".env")
OUT_PATH = os.path.join(ROOT, "research", "strikes", "acled-agg.json")
START = "2016-01-01"
PAGE_ROWS = 5000  # documented page size

SETUP = """ACLED credentials not found, so nothing was fetched (exit 0).

Set up:
  1. Register a free myACLED account at https://acleddata.com (Register).
  2. Export your login (never commit it), or put it in a .env file at the repo root (git-ignored):
       ACLED_EMAIL=you@example.com
       ACLED_PASSWORD=your-password
  3. Re-run: python3 build/acled_agg.py
Read research/strikes/ACLED-README.md before publishing anything derived from it."""


def load_env(path=ENV_FILE):
    vals = {}
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return vals


def get_credentials(environ=None, env_path=ENV_FILE):
    environ = os.environ if environ is None else environ
    f = load_env(env_path)
    email = environ.get("ACLED_EMAIL") or f.get("ACLED_EMAIL")
    pw = environ.get("ACLED_PASSWORD") or f.get("ACLED_PASSWORD")
    return (email, pw) if email and pw else None


def _post(url, data):
    req = urllib.request.Request(
        url, data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def get_token(email, password):
    d = _post(TOKEN_URL, {"username": email, "password": password,
                          "grant_type": "password", "client_id": "acled",
                          "scope": "authenticated"})
    return d["access_token"]


def build_url(end_date, cursor):
    q = OrderedDict([
        ("_format", "json"), ("country", "Lebanon"),
        ("event_date", f"{START}|{end_date}"), ("event_date_where", "BETWEEN"),
        ("fields", "event_id_cnty|event_date|event_type|sub_event_type|admin2|"
                   "location|latitude|longitude|fatalities"),
        ("cursor", str(cursor)),
    ])
    return READ_URL + "?" + urllib.parse.urlencode(q, safe="|")


def fetch_page(url, token, retries=3):
    for i in range(retries):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < retries - 1:
                time.sleep(5 * (i + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def fetch_all(token, end_date, fetch=fetch_page):
    """Yield (rows, restrictions) per page using cursor pagination."""
    cursor = 0
    seen = set()
    while True:
        d = fetch(build_url(end_date, cursor), token)
        yield d.get("data") or [], d.get("data_query_restrictions")
        cursor = d.get("next_cursor")
        if cursor in (None, "", 0) or cursor in seen:
            return
        seen.add(cursor)


def aggregate(rows, agg=None):
    """Aggregate raw rows into the output cells. Mutates/returns agg dict."""
    agg = {} if agg is None else agg
    for r in rows:
        date = str(r.get("event_date") or "")
        if len(date) < 7:
            continue
        key = (r.get("location") or "", r.get("admin2") or "", date[:7],
               r.get("event_type") or "", r.get("sub_event_type") or "")
        try:
            fat = int(float(r.get("fatalities") or 0))
        except (TypeError, ValueError):
            fat = 0
        cell = agg.setdefault(key, {"count": 0, "fatalities": 0, "lat": None, "lon": None})
        cell["count"] += 1
        cell["fatalities"] += fat
        if cell["lat"] is None:
            try:
                cell["lat"] = round(float(r["latitude"]), 4)
                cell["lon"] = round(float(r["longitude"]), 4)
            except (KeyError, TypeError, ValueError):
                pass
    return agg


def attribution(accessed, end_date):
    return (f"Armed Conflict Location & Event Data (ACLED), acleddata.com. "
            f"Data accessed {accessed}; filters: country=Lebanon, event dates "
            f"{START} to {end_date}. Aggregated by the Free Lebanon Data Hub to "
            f"counts per location, month and event type (fatalities summed); "
            f"this aggregation is the Hub's own work, not ACLED's.")


def to_output(agg, accessed, end_date, restrictions=None):
    cells = [{"location": k[0], "admin2": k[1], "month": k[2], "event_type": k[3],
              "sub_event_type": k[4], "count": v["count"],
              "fatalities": v["fatalities"], "lat": v["lat"], "lon": v["lon"]}
             for k, v in sorted(agg.items())]
    return {"source": "ACLED", "attribution": attribution(accessed, end_date),
            "accessed": accessed, "from": START, "to": end_date,
            "query_restrictions": restrictions, "cells": cells,
            "events_aggregated": sum(c["count"] for c in cells)}


def main():
    creds = get_credentials()
    if not creds:
        print(SETUP)
        return 0
    today = dt.date.today().isoformat()
    try:
        token = get_token(*creds)
        agg, restr, pages = {}, None, 0
        for rows, r in fetch_all(token, today):
            aggregate(rows, agg)
            restr = r or restr
            pages += 1
            print(f"page {pages}: {len(rows)} rows", file=sys.stderr)
    except urllib.error.HTTPError as e:
        print(f"ACLED request failed: HTTP {e.code}. Check your login and tier.", file=sys.stderr)
        return 1
    except (urllib.error.URLError, KeyError, ValueError) as e:
        print(f"ACLED request failed: {type(e).__name__}", file=sys.stderr)
        return 1
    out = to_output(agg, today, today, restr)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f"wrote {OUT_PATH}: {len(out['cells'])} cells, {out['events_aggregated']} events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
