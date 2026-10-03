"""Optional private-terms filter.

A maintainer can keep a list of names and phrases that must never reach the published Hub. The list is private, so it
is never part of this repository. When the file is absent (the normal case for contributors) every function here is
a no-op and the build does nothing extra.

  HUB_PRIVATE_TERMS   path of the terms file (default ~/.config/lebanon-hub/private-terms.txt)
                      one case-insensitive regex per line; blank lines and lines starting with # are ignored
  private-drops.json  optional, beside the terms file:
                      {"drop": {"<row key>": "<reason>"}, "rewrite": {"<row key>": {"title": "..."}}}
"""
import json, os, re

TERMS_FILE = os.environ.get("HUB_PRIVATE_TERMS", os.path.expanduser("~/.config/lebanon-hub/private-terms.txt"))
DROPS_FILE = os.path.join(os.path.dirname(TERMS_FILE), "private-drops.json")


def _lines(path):
    try:
        with open(path, encoding="utf-8") as f:
            return [l.strip() for l in f if l.strip() and not l.lstrip().startswith("#")]
    except OSError:
        return []


def pattern():
    """Compiled regex of all private terms, or None when there is no terms file."""
    parts = _lines(TERMS_FILE)
    return re.compile("|".join(f"(?:{p})" for p in parts), re.I) if parts else None


def drops():
    """({row key: reason}, {row key: field updates}) from private-drops.json; two empty dicts when absent."""
    try:
        with open(DROPS_FILE, encoding="utf-8") as f:
            j = json.load(f)
    except (OSError, ValueError):
        return {}, {}
    return j.get("drop") or {}, j.get("rewrite") or {}


def search(text):
    """First private-term match in text, or None. Always None when no terms file exists."""
    p = pattern()
    return p.search(text) if p else None
