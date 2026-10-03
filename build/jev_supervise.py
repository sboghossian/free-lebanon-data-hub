#!/usr/bin/env python3
"""Jev supervision for the MITAI dossier research.

Code owns candidates, fetching, date checks, domain tiers and every write.
Jev makes one semantic call per row:
  * events:  does the fetched source passage support the event?  (noul, two phrasings)
  * sources: for domains the tier map does not know, is this a credible publisher page?

Usage:
  python3 jev_supervise.py fetch            # fetch every cited/library URL into the page cache
  python3 jev_supervise.py calibrate        # own-passage vs other-passage separation on real rows
  python3 jev_supervise.py events           # grade every event -> research/40-grounding.jsonl
  python3 jev_supervise.py sources          # grade the library -> research/41-sources-graded.jsonl
  python3 jev_supervise.py refetch [--only pdf|wayback] [--limit N] [--force]
                                            # PDFs via pdftotext, Wayback copies for cached failures
  python3 jev_supervise.py all              # fetch, events, sources, summary
Page text is untrusted data: it is only ever passed to Jev as state, never acted on.
"""
from __future__ import annotations

import gzip
import hashlib
import html.parser
import json
import os
import random
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent))
import jev  # noqa: E402  (stdlib client, key from TYPESAFE_API_KEY; optional)

ROOT = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent))
R = ROOT / "research"
CACHE = ROOT / "cache/pages"
PDF_DIR = ROOT / "cache/pdf"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

Q_STRICT = ("The SOURCE passage supports the PROPOSITION exactly as the proposition is "
            "stated, with no broadening, no added condition, and no change of scope.")
Q_EVENT = ("The SOURCE passage describes the same real-world event, law, agreement or fact as the "
           "PROPOSITION. Wording may differ; ignore whether the exact date or numbers match, "
           "those are checked separately.")
Q_CREDIBLE = ("The page at `url` comes from an identifiable, credible publisher: a government, "
              "international organisation, university or research institute, established news "
              "organisation, or reference work. It is not a content farm, SEO blog, AI-generated "
              "site, forum, or propaganda outlet.")

# Thresholds are 🧪 until `calibrate` has run on this data; GRO-1961 measured 0.30 on legal text.
STRICT_OK = 0.30
EVENT_OK = 0.60
EVENT_WEAK = 0.25

T1 = ("gov.lb", ".gov", "un.org", "worldbank.org", "imf.org", "unhcr.org", "unrwa.org", "who.int",
      "ilo.org", "unescwa.org", "undp.org", "unicef.org", "wfp.org", "unep.org", "europa.eu",
      "fatf-gafi.org", "stl-tsl.org", "itu.int", "wipo.int", "oecd.org", "reliefweb.int",
      "ohchr.org", "icj-cij.org", "unifil.unmissions.org", "presidency.gov.lb", "nna-leb.gov.lb")
T2 = (".edu", "aub.edu.lb", "lau.edu.lb", "usj.edu.lb", "ndu.edu.lb", "carnegieendowment.org",
      "carnegie-mec.org", "crisisgroup.org", "lcps-lebanon.org", "brookings.edu", "chathamhouse.org",
      "jstor.org", "cambridge.org", "tandfonline.com", "springer.com", "link.springer.com",
      "academic.oup.com", "arab-reform.net", "arabbarometer.org", "legal-agenda.com", "mei.edu",
      "ourworldindata.org", "rug.nl", "sciencedirect.com", "brill.com", "wiley.com", "ssrn.com",
      "rand.org", "csis.org", "cfr.org", "hrw.org", "amnesty.org", "gallup.com", "pewresearch.org",
      "smex.org", "washingtoninstitute.org", "atlanticcouncil.org", "iss.europa.eu", "e-ir.info",
      "sciencespo.fr", "ifpo.fr", "openedition.org", "cairn.info", "persee.fr")
T3 = ("reuters.com", "apnews.com", "afp.com", "bbc.com", "bbc.co.uk", "ft.com", "nytimes.com",
      "economist.com", "aljazeera.com", "aljazeera.net", "lorientlejour.com", "executive-magazine.com",
      "thenationalnews.com", "lemonde.fr", "annahar.com", "france24.com", "dw.com", "theguardian.com",
      "washingtonpost.com", "bloomberg.com", "wsj.com", "al-monitor.com", "naharnet.com",
      "dailystar.com.lb", "mtv.com.lb", "lbcgroup.tv", "wamda.com", "magnitt.com", "techcrunch.com",
      "restofworld.org", "arabnews.com", "timesofisrael.com", "haaretz.com", "npr.org", "cnn.com",
      "time.com", "foreignpolicy.com", "politico.com", "euronews.com", "rfi.fr", "lefigaro.fr",
      "liberation.fr", "blominvestbank.com", "byblosbank.com", "middleeasteye.net", "the961.com",
      "lbcgroup.com", "newarab.com", "english.alarabiya.net", "alarabiya.net", "asharq-al-awsat.com",
      "english.aawsat.com", "enabbaladi.net", "syria-report.com", "datacenterdynamics.com",
      "speedtest.net", "enmaeya.com", "businessnews.com.lb", "lebanonfiles.com")
T4 = ("wikipedia.org", "britannica.com", "wikimedia.org")
BLOCK = ("numbeo.com", "medium.com", "quora.com", "reddit.com", "pinterest.", "facebook.com",
         "instagram.com", "tiktok.com", "x.com", "twitter.com", "youtube.com")


# ---------- pure functions (unit-tested) ----------

def domain(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def tier_of(url: str) -> str | None:
    d = domain(url)
    if not d:
        return None
    if any(b in d for b in BLOCK):
        return "blocked"
    for name, table in (("T1", T1), ("T2", T2), ("T4", T4), ("T3", T3)):
        if any(d == t or d.endswith("." + t) or (t.startswith(".") and d.endswith(t)) for t in table):
            return name
    return None


STOP = set("the and for with from that this into over under after before about their there were was "
           "are its his her has have had not but than then when which what who whom will would could "
           "lebanon lebanese first begins ends new".split())
MONTHS = {1: ("january", "janvier", "jan"), 2: ("february", "février", "fevrier", "feb"),
          3: ("march", "mars", "mar"), 4: ("april", "avril", "apr"), 5: ("may", "mai"),
          6: ("june", "juin", "jun"), 7: ("july", "juillet", "jul"), 8: ("august", "août", "aout", "aug"),
          9: ("september", "septembre", "sep", "sept"), 10: ("october", "octobre", "oct"),
          11: ("november", "novembre", "nov"), 12: ("december", "décembre", "decembre", "dec")}


def terms(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-zà-ÿ0-9]{4,}", s.lower()) if w not in STOP}


def select_passage(text: str, claim: str, year: str | None, limit: int = 5000) -> str:
    """Top paragraphs by overlap with the claim's content words (+ year bonus), kept in page order."""
    paras = [p.strip() for p in re.split(r"\n\s*\n|(?<=[.!?])\s{2,}", text) if len(p.strip()) > 40]
    if not paras:
        return text[:limit]
    want = terms(claim)
    scored = []
    for i, p in enumerate(paras):
        pt = terms(p)
        s = len(want & pt) + (2 if year and year in p else 0)
        scored.append((s, i, p))
    best = sorted(scored, key=lambda x: (-x[0], x[1]))[: 6 if limit <= 6000 else 16]
    out, n = [], 0
    for _, _, p in sorted(best, key=lambda x: x[1]):
        if n + len(p) > limit:
            p = p[: max(0, limit - n)]
        out.append(p)
        n += len(p)
        if n >= limit:
            break
    return "\n\n".join(out)


def date_found(text: str, date: str) -> str:
    """'day' | 'month' | 'year' | 'no' : how precisely the event's date appears in the page."""
    m = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$", date or "")
    if not m:
        return "no"
    y, mo, d = m.group(1), m.group(2), m.group(3)
    if y not in text:
        return "no"
    if not mo:
        return "year"
    low = text.lower()
    names = MONTHS.get(int(mo), ())
    month_hit = any(re.search(rf"\b{re.escape(n)}\b\.?\s*,?\s*{y}", low) or
                    re.search(rf"\b{re.escape(n)}\b[^.\n]{{0,40}}{y}", low) for n in names)
    if not month_hit:
        return "year"
    if d and re.search(rf"\b0?{int(d)}(?:st|nd|rd|th|er)?\s+(?:{'|'.join(map(re.escape, names))})\b", low):
        return "day"
    if d and any(re.search(rf"\b{re.escape(n)}\s+0?{int(d)}\b", low) for n in names):
        return "day"
    return "month"


DATA_PAGES = ("ourworldindata.org/grapher", "api.worldbank.org", "data.worldbank.org", "speedtest.net/global-index",
              "datacentermap.com", "tradingeconomics.com", "macrotrends.net", "data.imf.org", "imf.org/external/datamapper",
              "worldpopulationreview.com", "populationpyramid.net", "knoema.com")


def is_data_page(url: str) -> bool:
    return any(d in (url or "") for d in DATA_PAGES)


def law_no_found(text: str, law_no: str | None) -> str:
    """'yes' | 'no' | 'n/a': is the law's number (e.g. 81/2018) literally on the page? Jev is weak on numbers."""
    if not law_no:
        return "n/a"
    m = re.search(r"(\d{1,4})\s*/\s*(\d{4})", law_no)
    if m:
        n, y = m.group(1), m.group(2)
        pat = rf"(?<!\d){n}\s*/\s*{y}(?!\d)|(?:law|loi|no\.?|number|n°)\s*{n}\b[^.\n]{{0,60}}{y}"
        return "yes" if re.search(pat, text, re.I) else "no"
    digits = re.findall(r"\d+", law_no)
    return "yes" if digits and all(d in text for d in digits) else "no"


def office_check(text: str, name: str, start: str) -> str:
    """Office rows come from list tables, so check in code: the holder's surname on the page with the
    start year within 400 characters -> grounded; surname only -> weak; neither -> unsupported."""
    words = [w for w in re.findall(r"[A-Za-zÀ-ÿ'-]{3,}", name or "") if w.lower() not in {"vacuum", "acting", "government", "cabinet"}]
    if not words:
        return "unchecked"
    sur = words[-1]
    hits = [m.start() for m in re.finditer(re.escape(sur), text, re.I)]
    if not hits:
        return "unsupported"
    y = (start or "")[:4]
    if y and any(y in text[max(0, h - 400): h + 400] for h in hits):
        return "grounded"
    return "weak"


MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
               "November", "December"]


def table_check(text: str, names: list, date: str) -> str | None:
    """Event rows cited to a list table ("List of ..."): an actor's surname within 300 characters of the
    exact day ("18 March 1938" or "March 18, 1938") -> grounded. Anything less returns None so Jev decides."""
    if len(date or "") != 10:
        return None
    y, m, d = date[:4], MONTH_NAMES[int(date[5:7]) - 1], str(int(date[8:10]))
    forms = [f"{d} {m} {y}", f"{m} {d}, {y}"]
    for name in names or []:
        words = [w for w in re.findall(r"[A-Za-zÀ-ÿ'-]{3,}", name)]
        if not words:
            continue
        for h in (mm.start() for mm in re.finditer(re.escape(words[-1]), text, re.I)):
            win = text[max(0, h - 300): h + 300]
            if any(f in win for f in forms):
                return "grounded"
    return None


def verdict(fetch: str, strict: float | None, event: float | None, dfound: str) -> str:
    if fetch != "ok" or strict is None or event is None:
        return "unchecked"
    if strict >= STRICT_OK or (event >= EVENT_OK and dfound != "no"):
        return "grounded"
    if event >= EVENT_WEAK:
        return "weak"
    return "unsupported"


# ---------- IO ----------

class _Text(html.parser.HTMLParser):
    SKIP = {"script", "style", "noscript", "nav", "footer", "header", "svg", "form", "aside"}
    BLOCKS = {"p", "div", "li", "h1", "h2", "h3", "h4", "tr", "section", "article", "br", "td", "blockquote"}

    def __init__(self):
        super().__init__()
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCKS:
            self.out.append("\n\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def html_to_text(raw: str) -> str:
    p = _Text()
    try:
        p.feed(raw)
    except Exception:  # noqa: BLE001 — malformed HTML still yields partial text
        pass
    t = "".join(p.out)
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    return re.sub(r"\n\s*\n\s*(\n\s*)+", "\n\n", t).strip()


def pdf_file_to_text(path: Path) -> str:
    """Text of a PDF on disk: pdftotext (poppler) first, pypdf if poppler is missing or yields nothing.
    Returns '' for scanned PDFs without a text layer."""
    import shutil, subprocess
    txt = ""
    if shutil.which("pdftotext"):
        try:
            out = subprocess.run(["pdftotext", "-layout", "-l", "80", str(path), "-"], capture_output=True, timeout=90)
            txt = out.stdout.decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            txt = ""
    if len(txt.strip()) < 50:
        try:
            import pypdf
            rd = pypdf.PdfReader(str(path))
            txt = "\n\n".join((pg.extract_text() or "") for pg in rd.pages[:80])
        except Exception:  # noqa: BLE001
            pass
    return re.sub(r"[ \t]+", " ", txt)


def pdf_path(url: str) -> Path:
    return PDF_DIR / (hashlib.sha1(url.encode()).hexdigest() + ".pdf")


def save_pdf(url: str, body: bytes) -> Path:
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    p = pdf_path(url)
    p.write_bytes(body)
    return p


def pdf_to_text(body: bytes) -> str:
    """Text of in-memory PDF bytes (written to a temp file for pdftotext)."""
    import tempfile
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body)
            f.flush()
            return pdf_file_to_text(Path(f.name))
    except Exception:  # noqa: BLE001
        return ""


def cache_path(url: str) -> Path:
    return CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")


ARCHIVE_ID = re.compile(r"^https?://(?:www\.)?archive\.org/(?:details|stream)/([^/?#]+)")
BOOKS = ROOT / "cache/books"


def archive_book_id(url: str) -> str | None:
    """The archive.org item id behind a book-viewer URL (details/<id>/page/n12 or stream/<id>)."""
    m = ARCHIVE_ID.match(url or "")
    return m.group(1) if m else None


def archive_text(item: str) -> str:
    """Full OCR text of an archive.org item, cached once per book. The viewer pages hold no text,
    so rows citing a page of a book are checked against the book's own _djvu.txt."""
    BOOKS.mkdir(parents=True, exist_ok=True)
    cp = BOOKS / f"{item}.txt"
    if cp.exists():
        return cp.read_text()
    meta = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"https://archive.org/metadata/{item}", headers={"User-Agent": UA}), timeout=40).read())
    names = [f["name"] for f in meta.get("files", []) if f.get("name", "").endswith("_djvu.txt")]
    if not names:
        return ""
    raw = urllib.request.urlopen(urllib.request.Request(
        f"https://archive.org/download/{item}/{urllib.parse.quote(names[0])}", headers={"User-Agent": UA}), timeout=90).read()
    text = raw.decode("utf-8", "replace")
    cp.write_text(text)
    return text


def fetch(url: str) -> dict:
    cp = cache_path(url)
    if cp.exists():
        return json.loads(cp.read_text())
    res = {"url": url, "status": "error", "http": None, "text": ""}
    book = archive_book_id(url)
    if not url.startswith("http"):
        res["status"] = "not_url"
    elif book:
        try:
            res["text"] = archive_text(book)[:4_000_000]
            res.update(status="ok" if len(res["text"]) > 200 else "empty", via="archive-ocr", http=200)
        except Exception as e:  # noqa: BLE001
            res["status"] = "timeout" if "timed out" in str(e) else "error"
    else:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en,fr;q=0.8",
                                                       "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=25) as r:
                res["http"] = r.status
                ctype = r.headers.get("Content-Type", "")
                maybe_pdf = "pdf" in ctype or urlparse(url).path.lower().endswith(".pdf")
                body = r.read(40_000_000 if maybe_pdf else 3_000_000)
                if r.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                if body[:5] == b"%PDF-" or (maybe_pdf and body[:5] != b"<!doc" and body[:5].lower() != b"<html"):
                    res["pdf_path"] = str(save_pdf(url, body))
                    res["text"] = pdf_file_to_text(Path(res["pdf_path"]))[:400_000]
                    res["status"] = "ok" if len(res["text"]) > 200 else "pdf"
                    if res["status"] == "ok":
                        res["via"] = "pdf"
                else:
                    res["text"] = html_to_text(body.decode(r.headers.get_content_charset() or "utf-8", "replace"))[:400_000]
                    res["status"] = "ok" if len(res["text"]) > 200 else "empty"
        except urllib.error.HTTPError as e:
            res.update(status=f"http_{e.code}", http=e.code)
        except Exception as e:  # noqa: BLE001
            res["status"] = "timeout" if "timed out" in str(e) else "error"
    CACHE.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps(res))
    return res


def load_events() -> list[tuple[str, dict]]:
    out = []
    for f in sorted(R.glob("*.timeline.jsonl")):
        for i, line in enumerate(f.open()):
            if line.strip():
                out.append((f"{f.name}:{i}", json.loads(line)))
    return out


def load_registers() -> list[tuple[str, dict]]:
    """Office-holders and agreements, reshaped into event-like rows so the same grader checks them."""
    out = []
    f = R / "30-offices.jsonl"
    if f.exists():
        for i, line in enumerate(f.open()):
            if line.strip():
                r = json.loads(line)
                end = r.get("end") or "present"
                out.append((f"{f.name}:{i}", {"date": r.get("start") or "", "source": r.get("source"),
                            "confidence": r.get("confidence"), "_office_name": r.get("name"),
                            "title": f"{r.get('name')} was {r.get('office')} of Lebanon from {r.get('start')} to {end}",
                            "why": r.get("note") or ""}))
    f = R / "31-agreements.jsonl"
    if f.exists():
        for i, line in enumerate(f.open()):
            if line.strip():
                r = json.loads(line)
                out.append((f"{f.name}:{i}", {"date": r.get("date_signed") or "", "source": r.get("source"),
                            "confidence": r.get("confidence"),
                            "title": f"{r.get('name')} ({', '.join(r.get('parties') or [])})",
                            "why": r.get("what_it_did") or ""}))
    return out


def load_library() -> dict[str, dict]:
    lib = {}
    for f in sorted(R.glob("src-*.jsonl")):
        for line in f.open():
            if line.strip():
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue
                u = (r.get("url") or "").strip()
                if u:
                    e = lib.setdefault(u, {**r, "files": []})
                    e["files"].append(f.name)
    return lib


def claim_of(row: dict) -> str:
    return f"{row.get('title','')}. {row.get('date','')}".strip()


def ask_event(claim: str, passage: str) -> tuple[float, float]:
    state = json.dumps({"SOURCE": passage, "PROPOSITION": claim}, ensure_ascii=False)
    r = jev.ask(state, {"supports": {"type": "noul", "instructions": Q_STRICT},
                        "same_event": {"type": "noul", "instructions": Q_EVENT}}, cache="mitai-grounding")
    a = r["answers"]
    return float(a["supports"]["noul"]), float(a["same_event"]["noul"])


# ---------- commands ----------

def cmd_fetch():
    urls = {r.get("source") for _, r in load_events() + load_registers() if (r.get("source") or "").startswith("http")}
    urls |= set(load_library())
    todo = sorted(u for u in urls if not cache_path(u).exists())
    print(f"fetch: {len(urls)} urls, {len(todo)} new")
    with ThreadPoolExecutor(max_workers=24) as ex:
        res = list(ex.map(fetch, todo))
    from collections import Counter
    print(Counter(r["status"] for r in res))


def grade_event(item):
    key, row = item
    url = row.get("source") or ""
    base = {"key": key, "title": row.get("title"), "date": row.get("date"), "url": url,
            "agent_conf": row.get("confidence")}
    if not url.startswith("http"):
        return {**base, "fetch": "not_url", "verdict": "unchecked"}
    page = fetch(url)
    if is_data_page(url):
        return {**base, "fetch": page["status"], "verdict": "data_source"}
    if page["status"] != "ok":
        return {**base, "fetch": page["status"], "verdict": "unchecked"}
    if row.get("_office_name") is not None:
        v = office_check(page["text"], row["_office_name"], row.get("date", ""))
        return {**base, "fetch": "ok", "method": "code:office", "verdict": v}
    if "/wiki/List_of_" in url and table_check(page["text"], row.get("actors"), row.get("date", "")) == "grounded":
        return {**base, "fetch": "ok", "method": "code:table", "verdict": "grounded"}
    year =(row.get("date") or "")[:4] or None
    probe = row.get("title", "") + " " + row.get("why", "")
    dfound = date_found(page["text"], row.get("date", ""))
    passage = select_passage(page["text"], probe, year)
    strict, event = ask_event(claim_of(row), jev.clip(passage, 6000))
    v, wide = verdict("ok", strict, event, dfound), False
    if v != "grounded" and len(page["text"]) > 6000:  # second chance: a wider window of the page
        s2, e2 = ask_event(claim_of(row), jev.clip(select_passage(page["text"], probe, year, limit=14000), 15000))
        if max(s2, e2) > max(strict, event):
            strict, event, wide = s2, e2, True
            v = verdict("ok", strict, event, dfound)
    lno = law_no_found(page["text"], row.get("law_no"))
    return {**base, "fetch": "ok", "strict": round(strict, 4), "same_event": round(event, 4),
            "date_found": dfound, "wide_pass": wide, "law_no": row.get("law_no"), "law_no_found": lno,
            "verdict": v}


def cmd_events():
    ev = load_events() + load_registers()
    res = jev.pool(ev, grade_event, workers=16)
    out = R / "40-grounding.jsonl"
    rows = [r if isinstance(r, dict) else {"key": ev[i][0], "verdict": "error", "error": str(r)[:200]}
            for i, r in enumerate(res)]
    tmp = out.with_suffix(".tmp")
    tmp.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    tmp.replace(out)
    from collections import Counter
    print("events:", len(rows), Counter(r["verdict"] for r in rows), "|", jev.summary())


def cmd_calibrate(n: int = 80, seed: int = 7):
    """Positives: event vs its own page passage. Negatives: the same event vs a passage chosen from a
    DIFFERENT event's page (same pillar file when possible). Reports separation for both questions."""
    random.seed(seed)
    ev = [(k, r) for k, r in load_events() if (r.get("source") or "").startswith("http")]
    ok = [(k, r, fetch(r["source"])) for k, r in random.sample(ev, min(len(ev), n * 3))]
    ok = [(k, r, p) for k, r, p in ok if p["status"] == "ok"][:n]
    pos, neg = [], []
    for i, (k, r, p) in enumerate(ok):
        claim = claim_of(r)
        own = select_passage(p["text"], r["title"] + " " + r.get("why", ""), r["date"][:4])
        other = ok[(i + len(ok) // 2) % len(ok)]
        if other[2]["url"] == p["url"]:
            continue
        foreign = select_passage(other[2]["text"], r["title"] + " " + r.get("why", ""), r["date"][:4])
        pos.append(ask_event(claim, jev.clip(own, 6000)))
        neg.append(ask_event(claim, jev.clip(foreign, 6000)))

    def auc(p, q):
        return sum((a > b) + 0.5 * (a == b) for a in p for b in q) / (len(p) * len(q))
    for j, name in enumerate(("supports", "same_event")):
        P, N = [x[j] for x in pos], [x[j] for x in neg]
        print(f"{name}: n+={len(P)} n-={len(N)} mean+={sum(P)/len(P):.3f} mean-={sum(N)/len(N):.3f} AUC={auc(P, N):.3f}")
        for t in (0.25, 0.3, 0.5, 0.6):
            tp = sum(x >= t for x in P) / len(P)
            fp = sum(x >= t for x in N) / len(N)
            print(f"   t={t}: recall {tp:.2f}  false-alarm {fp:.2f}")
    print(jev.summary())


def grade_source(item):
    url, r = item
    t = tier_of(url)
    page = fetch(url)
    alive = page["status"] in ("ok", "pdf", "empty") or (page.get("http") in (401, 403, 429))
    row = {"url": url, "domain": domain(url), "tier": t or "unmapped", "agent_tier": r.get("tier"),
           "fetch": page["status"], "alive": alive, "files": r.get("files", []),
           "title": r.get("title"), "publisher": r.get("publisher")}
    if t == "blocked":
        return {**row, "keep": False, "why": "blocked domain"}
    if t is None:
        state = {"url": url, "domain": domain(url), "title": r.get("title"), "publisher": r.get("publisher"),
                 "page_head": (page.get("text") or "")[:1500]}
        a = jev.ask(state, {"credible": {"type": "noul", "instructions": Q_CREDIBLE}}, cache="mitai-sources")
        p = float(a["answers"]["credible"]["noul"])
        row.update(jev_credible=round(p, 3), tier="T3?" if p >= 0.6 else "unmapped")
        return {**row, "keep": p >= 0.6 and alive, "why": "jev screen"}
    return {**row, "keep": alive, "why": "domain map" if alive else "dead link"}


def cmd_sources():
    lib = load_library()
    res = jev.pool(list(lib.items()), grade_source, workers=16)
    rows = [r for r in res if isinstance(r, dict)]
    out = R / "41-sources-graded.jsonl"
    tmp = out.with_suffix(".tmp")
    tmp.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    tmp.replace(out)
    from collections import Counter
    kept = [r for r in rows if r["keep"]]
    print("library:", len(rows), "kept:", len(kept), Counter(r["tier"] for r in kept), "|", jev.summary())


# ---------- refetch: PDFs and archived copies for cached failures ----------

import threading
import time
from collections import Counter
from urllib.parse import quote

POLITE_UA = "LebanonHub/1.0 (research)"
WB_API = "https://archive.org/wayback/available?url="
WAYBACK_STATUSES = ("http_401", "http_403", "http_429", "error", "timeout", "empty")
TODAY = "2026-10-03"


def status_of_http(code: int | None) -> str:
    return f"http_{code}" if code else "error"


def wayback_api_url(url: str) -> str:
    return WB_API + quote(url, safe="")


def snapshot_raw_url(snapshot_url: str) -> str:
    """Closest-snapshot URL -> raw-content form: http://web.archive.org/web/<14 digits>/<orig> becomes
    https://web.archive.org/web/<14 digits>id_/<orig>. Already-raw URLs pass through."""
    m = re.match(r"^https?://web\.archive\.org/web/(\d{4,14})(id_|if_|im_|js_|cs_)?/(.+)$", snapshot_url or "")
    if not m:
        return snapshot_url
    return f"https://web.archive.org/web/{m.group(1)}id_/{m.group(3)}"


def parse_wayback(data: dict) -> str | None:
    """Availability-API JSON -> raw snapshot URL, or None when no usable (HTTP 200) snapshot exists."""
    c = ((data or {}).get("archived_snapshots") or {}).get("closest") or {}
    if not c.get("available") or not c.get("url") or str(c.get("status", "200")) != "200":
        return None
    return snapshot_raw_url(c["url"])


def refetch_kind(rec: dict, force: bool = False) -> str | None:
    """'pdf' | 'wayback' | None: which repair a cached record needs. Repaired records and (unless
    force) records already retried are left alone."""
    if rec.get("via") or (rec.get("refetch") and not force):
        return None
    s = rec.get("status")
    if s == "pdf":
        return "pdf"
    return "wayback" if s in WAYBACK_STATUSES else None


def pdf_record(rec: dict, text: str, path: str, http: int | None = 200) -> dict:
    return {**rec, "status": "ok", "http": http, "text": text[:400_000], "via": "pdf", "pdf_path": path,
            "orig_status": rec.get("orig_status") or rec.get("status")}


def wayback_record(rec: dict, snapshot: str, text: str, http: int | None = 200, pdf: str | None = None) -> dict:
    out = {**rec, "status": "ok", "http": http, "text": text[:400_000], "via": "wayback", "snapshot": snapshot,
           "orig_status": rec.get("orig_status") or rec.get("status")}
    if pdf:
        out["pdf_path"] = pdf
    return out


def failed_record(rec: dict, result: str) -> dict:
    return {**rec, "refetch": {"date": TODAY, "result": result}}


class Throttle:
    """Minimum gap between requests per host (thread-safe)."""

    def __init__(self, gaps: dict[str, float], default: float = 0.5):
        self.gaps, self.default, self.last, self.lock = gaps, default, {}, threading.Lock()

    def wait(self, host: str):
        with self.lock:
            gap = self.gaps.get(host, self.default)
            t = max(time.monotonic(), self.last.get(host, 0) + gap)
            self.last[host] = t
        time.sleep(max(0, t - time.monotonic()))


THROTTLE = Throttle({"archive.org": 1.0, "web.archive.org": 1.0})


def _throttle_host(url: str) -> str:
    h = domain(url)
    return "archive.org" if h.endswith("archive.org") else h


def http_get(url: str, limit: int = 40_000_000, timeout: int = 45, retries: int = 4):
    """GET with per-host throttle and backoff on 429/503. Returns (http_code|None, headers|None, body, error)."""
    delay = 5.0
    for attempt in range(retries + 1):
        THROTTLE.wait(_throttle_host(url))
        req = urllib.request.Request(url, headers={"User-Agent": POLITE_UA, "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read(limit)
                if r.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                return r.status, r.headers, body, None
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < retries:
                ra = e.headers.get("Retry-After") if e.headers else None
                time.sleep(min(int(ra), 120) if ra and ra.isdigit() else delay)
                delay = min(delay * 2, 120)
                continue
            return e.code, e.headers, b"", f"http_{e.code}"
        except Exception as e:  # noqa: BLE001
            if attempt < 1:
                time.sleep(2)
                continue
            return None, None, b"", "timeout" if "timed out" in str(e) else "error"
    return None, None, b"", "error"


def body_text(url: str, headers, body: bytes) -> tuple[str, str | None]:
    """(text, saved pdf path or None) for a fetched body, PDF or HTML."""
    if body[:5] == b"%PDF-":
        p = save_pdf(url, body)
        return pdf_file_to_text(p), str(p)
    charset = (headers.get_content_charset() if headers else None) or "utf-8"
    return html_to_text(body.decode(charset, "replace")), None


def try_pdf(rec: dict) -> dict | None:
    code, hdr, body, err = http_get(rec["url"])
    if err or body[:5] != b"%PDF-":
        return None
    text, path = body_text(rec["url"], hdr, body)
    return pdf_record(rec, text, path, code) if len(text) > 200 else failed_record({**rec, "pdf_path": path}, "pdf_no_text_layer")


def try_wayback(rec: dict) -> dict:
    code, _, body, err = http_get(wayback_api_url(rec["url"]), limit=200_000)
    if err:
        return failed_record(rec, f"wayback_api_{err}")
    try:
        snap = parse_wayback(json.loads(body))
    except ValueError:
        return failed_record(rec, "wayback_api_badjson")
    if not snap:
        return failed_record(rec, "no_snapshot")
    code, hdr, body, err = http_get(snap)
    if err:
        return failed_record(rec, f"snapshot_{err}")
    text, path = body_text(rec["url"], hdr, body)
    if len(text) <= 200:
        return failed_record(rec, "snapshot_empty")
    return wayback_record(rec, snap, text, code, path)


def refetch_one(rec: dict, only: str | None = None) -> dict:
    kind = refetch_kind(rec, force=True)
    if kind == "pdf":
        out = try_pdf(rec)
        if out:  # a PDF with no text layer would be the same file in the archive, so stop here
            return out
    if kind == "wayback" or (kind == "pdf" and only is None):
        return try_wayback(rec)
    return rec


def cmd_refetch(args: list[str] | None = None):
    args = args or []
    force = "--force" in args
    only = args[args.index("--only") + 1] if "--only" in args else None
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
    recs = {f: json.loads(f.read_text()) for f in sorted(CACHE.glob("*.json"))}
    print("before:", dict(sorted(Counter(r["status"] for r in recs.values()).items())))
    todo = [(f, r) for f, r in recs.items() if refetch_kind(r, force) and only in (None, refetch_kind(r, force))]
    todo.sort(key=lambda x: (refetch_kind(x[1], True) != "pdf", x[1]["url"]))  # PDFs first
    todo = todo[:limit]
    print(f"refetch: {len(todo)} candidates", dict(Counter(refetch_kind(r, force) for _, r in todo)), flush=True)
    ok = 0
    for i, (f, r) in enumerate(todo, 1):
        new = refetch_one(r, only)
        recs[f] = new
        ok += new.get("via") is not None
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps(new))
        tmp.replace(f)
        if i % 50 == 0:
            print(f"  {i}/{len(todo)} repaired so far: {ok}", flush=True)
    after = Counter(r["status"] for r in recs.values())
    print("after: ", dict(sorted(after.items())))
    print("repaired via:", dict(Counter(r["via"] for r in recs.values() if r.get("via"))))
    print("fail by original status -> now:", dict(Counter(f"{r.get('orig_status')}->{r['status']}" for r in recs.values() if r.get("orig_status"))))
    print("retried, still failing:", dict(Counter((r.get("refetch") or {}).get("result") for r in recs.values() if r.get("refetch") and not r.get("via"))))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    {"fetch": cmd_fetch, "events": cmd_events, "sources": cmd_sources, "calibrate": cmd_calibrate,
     "refetch": lambda: cmd_refetch(sys.argv[2:]),
     "all": lambda: (cmd_fetch(), cmd_events(), cmd_sources())}[cmd]()
