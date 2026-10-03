#!/usr/bin/env python3
"""
jev.py: stdlib-only client for TypeSafe's System One endpoint (Jev). Optional: the Hub builds without it.

Jev returns typed judgments with probabilities, not prose: a Choice picks one of
your options, a Noul is P(yes), a Score is a position on your ordered levels.
The Hub uses it where code already has the candidates and needs one semantic
call to decide: does a page support a timeline row, which place does a row name.
Code owns thresholds and every write.

    from jev import ask, pool
    res = ask(state, {"keep": {"type": "noul", "instructions": "..."}}, cache="rss")
    res["answers"]["keep"]["noul"]            # 0..1

Design contract (same as the other 60-Meta scripts):
  * Python stdlib only, no venv needed.
  * Every response is cached by a hash of the request under cache/jev/<name>.json
    (git-ignored): re-running to try a new threshold costs nothing.
  * Model is pinned: thresholds are calibrated per model version.
  * Raises JevError on failure. Callers decide whether to fall back to their
    heuristic, a Jev outage must never stop a nightly job.

Docs: https://docs.typesafe.ai/api.md
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Iterable

MODEL = "jev-1.13.0"  # pinned; move deliberately and re-check thresholds
ENDPOINT = "https://api.typesafe.ai/v1/systemone"
ROOT = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent))
CACHE_DIR = Path(os.environ.get("JEV_CACHE_DIR", ROOT / "cache" / "jev"))
TIMEOUT_S = 30
RETRIES = 4
MAX_STATE_CHARS = 60_000  # ~15k tokens; the model's state+question budget is 32k

usage = {"calls": 0, "cached": 0, "input_tokens": 0, "errors": 0}
_caches: dict[str, dict] = {}
_dirty: dict[str, int] = {}
_lock = threading.Lock()


class JevError(RuntimeError):
    pass


def _cache(name: str) -> dict:
    if name not in _caches:
        f = CACHE_DIR / f"{name}.json"
        try:
            _caches[name] = json.loads(f.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            _caches[name] = {}
        _dirty[name] = 0
    return _caches[name]


def flush() -> None:
    """Persist every dirty cache (write-then-rename so a reader never sees half a file)."""
    with _lock:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        for name, n in _dirty.items():
            if not n:
                continue
            f = CACHE_DIR / f"{name}.json"
            tmp = f.with_suffix(f".{os.getpid()}.tmp")
            tmp.write_text(json.dumps(_caches[name]), encoding="utf-8")
            tmp.replace(f)
            _dirty[name] = 0


def clip(text: str, limit: int = MAX_STATE_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "\n[...truncated]"


def _load_key() -> str | None:
    """The key comes from the environment variable TYPESAFE_API_KEY only."""
    return os.environ.get("TYPESAFE_API_KEY") or None


def available() -> bool:
    return bool(_load_key())


def ask(state: Any, questions: dict, cache: str = "default") -> dict:
    """One request: a state and a map of questions. Returns {model, answers, usage}."""
    body = json.dumps({"model": MODEL, "state": state, "questions": questions}, sort_keys=True)
    key = hashlib.sha256(body.encode()).hexdigest()
    with _lock:
        c = _cache(cache)
        if key in c:
            usage["cached"] += 1
            return c[key]

    api_key = _load_key()
    if not api_key:
        raise JevError("TYPESAFE_API_KEY is not set")

    last: Exception | None = None
    for attempt in range(RETRIES):
        req = urllib.request.Request(
            ENDPOINT, data=body.encode(), method="POST",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
                res = json.loads(r.read())
            if "answers" not in res:
                raise JevError(f"no answers in response: {str(res)[:160]}")
            with _lock:
                usage["calls"] += 1
                usage["input_tokens"] += (res.get("usage") or {}).get("input_tokens", 0)
                c[key] = res
                _dirty[cache] += 1
                should_flush = _dirty[cache] >= 50
            if should_flush:
                flush()
            return res
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            last = JevError(f"HTTP {e.code}: {detail}")
            if e.code != 429 and e.code < 500:
                break  # a bad request will not get better on retry
            wait = float(e.headers.get("retry-after") or 2 ** attempt)
            time.sleep(min(wait, 30))
        # OSError covers URLError, timeouts and dropped connections (RemoteDisconnected,
        # ConnectionResetError, SSL); HTTPException covers a truncated response.
        except (OSError, http.client.HTTPException, json.JSONDecodeError) as e:
            last = e
            time.sleep(2 ** attempt)
    with _lock:
        usage["errors"] += 1
    raise JevError(str(last))


def pool(items: Iterable, fn: Callable, workers: int = 16) -> list:
    """Map fn over items with bounded concurrency; results keep input order.
    fn exceptions are returned in place (not raised) so one bad item never kills a batch."""
    def safe(x):
        try:
            return fn(x)
        except Exception as e:  # noqa: BLE001 caller inspects per item
            return e
    try:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            return list(ex.map(safe, items))
    finally:
        flush()


def cost_usd() -> float:
    """Input tokens are billed at $0.042 per Mtok (docs.typesafe.ai/models, 2026-09-25); output is free."""
    return usage["input_tokens"] / 1e6 * 0.042


def summary() -> str:
    return (f"jev: {usage['calls']} calls, {usage['cached']} cached, {usage['errors']} errors, "
            f"{usage['input_tokens']:,} input tokens (~${cost_usd():.3f})")


if __name__ == "__main__":  # smoke test: python3 jev.py
    r = ask("Help! My payouts have been failing for 3 days.",
            {"urgent": {"type": "noul", "instructions": "Does this convey urgency?"}}, cache="smoke")
    flush()
    print(json.dumps(r["answers"]), "|", summary())
