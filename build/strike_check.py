#!/usr/bin/env python3
"""Jev check for strike incidents: does the cited page say that PLACE was hit on DATE?

Code finds the passages that name the place (any spelling the row or the gazetteer knows) and
the date; Jev answers one noul per row. Rows citing a dataset page are marked data_source.
Output: research/strikes/_grounding.jsonl keyed "file:line". Page text is untrusted data.
Usage: python3 strike_check.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import gazetteer
import jev_supervise as js
from jev_supervise import jev

S = js.R / "strikes"
DATA_HOSTS = ("data.humdata.org", "ucdp.uu.se", "ucdpapi.pcr.uu.se", "acleddata.com")
Q = ("The SOURCE passage reports that the PROPOSITION's place in Lebanon was struck, bombed, shelled or "
     "attacked, on or close to the PROPOSITION's date. Other places or dates in the passage do not count.")
OK, WEAK = 0.6, 0.3
MONTHS = js.MONTH_NAMES


def date_forms(date: str) -> list[str]:
    """Strings a page may use for the row's date, most specific first."""
    if len(date) == 10:
        y, m, d = date[:4], MONTHS[int(date[5:7]) - 1], str(int(date[8:10]))
        return [f"{d} {m} {y}", f"{m} {d}, {y}", f"{d} {m}", f"{m} {d}"]
    if len(date) == 7:
        return [f"{MONTHS[int(date[5:7]) - 1]} {date[:4]}"]
    return [date[:4]]


def place_hits(text: str, names: list[str]) -> list[int]:
    """Offsets where any spelling of the place appears (case-insensitive, then a folded match)."""
    hits = []
    low = text.lower()
    for n in names:
        n = (n or "").strip()
        if len(n) < 3:
            continue
        hits += [m.start() for m in re.finditer(re.escape(n.lower()), low)]
    if not hits:  # spellings differ: compare folded tokens
        keys = {gazetteer.normalize(n) for n in names if n}
        for m in re.finditer(r"[A-Za-zÀ-ÿ'\-]{3,}(?:[ \-][A-Za-zÀ-ÿ'\-]{2,}){0,2}", text):
            if gazetteer.normalize(m.group(0)) in keys:
                hits.append(m.start())
    return sorted(set(hits))


def passage(text: str, names: list[str], date: str, limit: int = 5000) -> str | None:
    hits = place_hits(text, names)
    if not hits:
        return None
    forms = date_forms(date)
    near = lambda h: any(f in text[max(0, h - 1500): h + 1500] for f in forms)
    hits.sort(key=lambda h: (not near(h), h))
    out, used = [], 0
    for h in hits[:6]:
        w = text[max(0, h - 600): h + 600]
        out.append(w)
        used += len(w)
        if used >= limit:
            break
    return "\n...\n".join(out)[:limit]


def load_rows() -> list[tuple[str, dict]]:
    rows = []
    for f in sorted(S.glob("*.jsonl")):
        if f.name.startswith("_"):
            continue
        for i, line in enumerate(f.open()):
            if line.strip():
                rows.append((f"{f.name}:{i}", json.loads(line)))
    return rows


def check(item):
    key, r = item
    url = r.get("source") or ""
    base = {"key": key}
    if not url.startswith("http"):
        return {**base, "verdict": "unchecked", "fetch": "not_url"}
    if any(h in url for h in DATA_HOSTS):
        return {**base, "verdict": "data_source"}
    page = js.fetch(url)
    if page["status"] != "ok":
        return {**base, "verdict": "unchecked", "fetch": page["status"]}
    names = [r.get("place") or ""] + list(r.get("place_alt") or [])
    names = [re.sub(r"\s*\(.*?\)", "", n) for n in names]
    p = passage(page["text"], names, r.get("date") or "")
    if p is None:
        return {**base, "verdict": "unsupported", "fetch": "ok", "why": "place not on page"}
    claim = f"{r.get('place')}: {r.get('title')}. Date: {r.get('date')}."
    a = jev.ask(json.dumps({"SOURCE": p, "PROPOSITION": claim}, ensure_ascii=False),
                {"hit": {"type": "noul", "instructions": Q}}, cache="lebanon-strike-ground")["answers"]
    s = float(a["hit"]["noul"])
    v = "grounded" if s >= OK else "weak" if s >= WEAK else "unsupported"
    return {**base, "verdict": v, "fetch": "ok", "score": round(s, 3), "date_found": js.date_found(page["text"], r.get("date") or "")}


def main():
    rows = load_rows()
    res = jev.pool(rows, check, workers=16)
    out = [r if isinstance(r, dict) else {"key": rows[i][0], "verdict": "error", "error": str(r)[:200]} for i, r in enumerate(res)]
    tmp = S / "_grounding.tmp"
    tmp.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in out) + "\n")
    tmp.replace(S / "_grounding.jsonl")
    jev.flush()
    from collections import Counter
    print("strikes:", len(out), Counter(r["verdict"] for r in out), "|", jev.summary())


if __name__ == "__main__":
    main()
