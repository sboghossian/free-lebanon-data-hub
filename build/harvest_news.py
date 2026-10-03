#!/usr/bin/env python3
"""v6 news harvest: Wikipedia -> dated Lebanon candidate items -> Jev judgments -> deduped survivors.

Code owns fetching, parsing, thresholds and every write;
Jev (cheap typed judgments) makes one semantic call per candidate. Fetched text is untrusted DATA.

  python3 harvest_news.py fetch     # Special:Export batches -> cache/harvest/raw (polite, cached, idempotent)
  python3 harvest_news.py extract   # wikitext -> Lebanon-filtered candidate items (cache/harvest/extracted.jsonl)
  python3 harvest_news.py judge     # Jev lebanon_event / significance / track -> cache/harvest/judged.jsonl
  python3 harvest_news.py dedupe    # thresholds, within-set + vs-timeline Jev same_event -> research/v6/harvest-*
  python3 harvest_news.py all
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent))
CACHE = ROOT / "cache/harvest"
RAW = CACHE / "raw"
R = ROOT / "research"
V6 = R / "v6"
UA = "LebanonHub/1.0 (research)"
DAY_FROM, DAY_TO = date(1995, 1, 1), date(2026, 9, 30)  # daily portal pages only exist from 2002-04-04
MIN_YEAR, MAX_DATE = 1800, "2026-09-30"
JEV_CACHE = "lebanon-harvest"
LEB_OK, SIG_OK = 0.6, 0.5  # spec thresholds
SAME_OK = 0.6  # calibrated in jev_supervise: 89% agreement, 1% false alarm

# ---------------------------------------------------------------- months, dates

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7,
    "août": 8, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12,
    "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7, "أغسطس": 8, "سبتمبر": 9,
    "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12, "كانون الثاني": 1, "شباط": 2, "آذار": 3, "نيسان": 4, "أيار": 5,
    "حزيران": 6, "تموز": 7, "آب": 8, "أيلول": 9, "تشرين الأول": 10, "تشرين الثاني": 11, "كانون الأول": 12,
}
_M = "|".join(sorted(map(re.escape, MONTHS), key=len, reverse=True))
_D = r"(?P<d>1er|\d{1,2})(?:st|nd|rd|th)?"
_WD = r"(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?"
_LEAD = rf"^(?:(?:On|In)\s+)?{_WD}"
_SEP = r"[\s:–—\-,.]*"
P_DMY = re.compile(rf"{_LEAD}{_D}\s+(?P<m>{_M})\.?,?\s+(?P<y>\d{{4}})\b", re.I)
P_MDY = re.compile(rf"{_LEAD}(?P<m>{_M})\.?\s+{_D}(?:\s*(?:[–-]|au|et|to|and)\s*\d{{1,2}}(?:er)?)?,?\s+(?P<y>\d{{4}})\b", re.I)
P_MY = re.compile(rf"{_LEAD}(?P<m>{_M})\.?,?\s+(?P<y>\d{{4}})\b", re.I)
P_DM = re.compile(rf"{_LEAD}{_D}(?:\s*(?:[–-]|au|et|to|and)\s*\d{{1,2}}(?:er)?)?\s+(?P<m>{_M})\b\.?", re.I)
P_MD = re.compile(rf"{_LEAD}(?P<m>{_M})\.?\s+{_D}(?:\s*(?:[–-]|au|et|to|and)\s*\d{{1,2}}(?:er)?)?\b(?!\s*,?\s*\d{{4}})", re.I)
P_Y_SEP = re.compile(r"^(?:(?:In|Since|By)\s+)?(?P<y>1[89]\d\d|20[0-2]\d)(?=\s*[–—:\-]|\s*$)")
P_Y_LEAD = re.compile(r"^(?P<y>1[89]\d\d|20[0-2]\d)\b(?![,\d%’'])")
P_M = re.compile(rf"^(?P<m>{_M})\b(?=\s*[–—:\-])", re.I)
P_D = re.compile(r"^(?P<d>\d{1,2})(?=\s*[–—:\-]\s)")


def _dnum(s: str | None) -> int | None:
    return None if not s else (1 if s.lower() == "1er" else int(s))


def parse_date_prefix(text: str, year: int | None = None, month: int | None = None, day: int | None = None,
                      lead_year: bool = False):
    """Consume date tokens at the start of `text` ("5 January", "June 5, 1982", "1840", "October:"), falling
    back to the year/month/day context. Returns (iso, prec, rest) or None when no year is known."""
    y, m, d = year, month, day
    s, got = text.strip(), False
    for _ in range(0 if day else 3):  # a day already fixed by a heading wins: "Since 12 July ..." is a reference
        hit = None
        for pat in (P_DMY, P_MDY, P_MY, P_DM, P_MD, P_Y_SEP, P_M):
            mo = pat.match(s)
            if mo:
                hit = mo
                break
        if not hit and lead_year and not got:
            hit = P_Y_LEAD.match(s)
        if not hit and m and not d:
            hit = P_D.match(s)
        if not hit:
            break
        g = hit.groupdict()
        if g.get("y"):
            y = int(g["y"])
        if g.get("m"):
            m = MONTHS[g["m"].lower().rstrip(".")]
            d = _dnum(g.get("d")) if g.get("d") else None
        elif g.get("d"):
            d = _dnum(g["d"])
        s = re.sub(rf"^{_SEP}", "", s[hit.end():]).strip()
        got = True
    if not y:
        return None
    if m and d:
        try:
            date(y, m, d)
        except ValueError:
            d = None  # impossible day (e.g. 31 June): keep the month
    prec = "day" if (m and d) else "month" if m else "year"
    iso = f"{y:04d}" + (f"-{m:02d}" if m else "") + (f"-{d:02d}" if (m and d) else "")
    return iso, prec, s


def heading_date(text: str):
    """A heading that is only a date ("8 October", "November 2024", "2023", "August 1") -> (y, m, d)."""
    t = strip_markup(text).strip()
    mo = P_DMY.match(t) or P_MDY.match(t) or P_MY.match(t) or P_DM.match(t) or P_MD.match(t)
    if mo and not t[mo.end():].strip(" .:"):
        g = mo.groupdict()
        return (int(g["y"]) if g.get("y") else None, MONTHS[g["m"].lower().rstrip(".")], _dnum(g.get("d")))
    if re.fullmatch(r"(?:1[89]\d\d|20[0-2]\d)", t):
        return (int(t), None, None)
    mo = re.fullmatch(rf"({_M})\.?", t, re.I)
    if mo:
        return (None, MONTHS[mo.group(1).lower().rstrip(".")], None)
    return None


def title_date(title: str):
    """'Portal:Current events/2006 July 12' -> '2006-07-12'."""
    m = re.search(r"/(\d{4}) (" + _M + r") (\d{1,2})$", title, re.I)
    if not m:
        return None
    return f"{int(m.group(1)):04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(3)):02d}"


# ---------------------------------------------------------------- wikitext cleaning

_TPL_INNER = re.compile(r"\{\{[^{}]*\}\}")
_SIMPLE_TPL = re.compile(r"\{\{\s*(?:nowrap|lang|lang-\w+|small|transl|transliteration|nobr|bdi|abbr)\s*\|(?:[^{}|]*\|)?([^{}|]*)(?:\|[^{}]*)?\}\}", re.I)
_FRDATE = re.compile(r"\{\{\s*(?:date\+?|1er)\s*\|\s*([^{}|]+?)\s*(?:\|\s*([^{}|]+?)\s*)?(?:\|\s*(\d{4})\s*)?\}\}", re.I)
_CONVERT = re.compile(r"\{\{\s*(?:convert|cvt)\s*\|\s*([\d.,]+)\s*\|\s*([a-zA-Z²³]+)[^{}]*\}\}", re.I)


def strip_templates(s: str) -> str:
    """Remove {{...}} templates, nested ones too; keep the text of nowrap/lang and 'N unit' of convert."""
    s = re.sub(r"\{\{\s*(?:nbsp|spaces?|·|\*|snd|spnd|ndash|mdash)\s*\}\}", " ", s, flags=re.I)
    s = _FRDATE.sub(lambda m: " ".join(x for x in (("1er" if m.group(0).lower().startswith("{{1er") else ""), m.group(1), m.group(2), m.group(3)) if x), s)
    for _ in range(12):
        s2 = _CONVERT.sub(r"\1 \2", s)
        s2 = _SIMPLE_TPL.sub(r"\1", s2)
        s2 = _TPL_INNER.sub("", s2)
        if s2 == s:
            break
        s = s2
    return re.sub(r"\{\{|\}\}", "", s)


_REF_FULL = re.compile(r"<ref\b[^>]*?(?<!/)>.*?</ref\s*>", re.S | re.I)
_REF_SELF = re.compile(r"<ref\b[^>]*/>", re.I)
_FILELINK = re.compile(r"\[\[\s*(?:File|Image|Category|Fichier|Catégorie|ملف)\s*:(?:[^\[\]]|\[\[[^\[\]]*\]\])*\]\]", re.I)
_WLINK = re.compile(r"\[\[(?:[^\]|\[]*\|)?([^\]\[]*)\]\]")
_XLINK = re.compile(r"\[(?:https?:)?//[^\s\]]+(?:\s+([^\]]*))?\]")


def strip_markup(s: str) -> str:
    """Wikitext -> plain text: refs, comments, templates, file links, link markup, quotes, html."""
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = _REF_FULL.sub("", s)
    s = _REF_SELF.sub("", s)
    s = strip_templates(s)
    s = _FILELINK.sub("", s)
    for _ in range(3):
        s = _WLINK.sub(r"\1", s)

    def xl(m):
        lab = (m.group(1) or "").strip()
        return "\x01" if (not lab or re.fullmatch(r"\(.*\)", lab)) else lab  # "[url (Reuters)]" is a citation
    s = _XLINK.sub(xl, s)
    s = re.sub(r"\s*\x01(?:\s*,?\s*\x01)*(?:\s*,(?=\s))?", "", s)
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"</?[a-zA-Z][^>]*>", "", s)
    s = re.sub(r"'{2,5}", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = re.sub(r"(?:,\s*)+$", "", s)
    return s.strip(" ,;")


_ARCHIVE = ("web.archive.org", "archive.org", "archive.is", "archive.today", "archive.ph", "webcitation.org")


def extract_refs(raw: str) -> list[str]:
    """Source URLs of a raw bullet: [https://... (Reuters)] links, |url= in cite templates/<ref>, bare <ref>url</ref>.
    Archive copies are kept only when nothing else is cited."""
    out: list[str] = []
    pats = (r"\[(https?://[^\s\]|]+)", r"(?<![\w-])url\s*=\s*(https?://[^\s|}<\]]+)", r"<ref[^>/]*>\s*(https?://[^\s<|\]]+)")
    for p in pats:
        out += [m.group(1) for m in re.finditer(p, raw, re.I)]
    seen, urls = set(), []
    for u in out:
        u = u.rstrip(".,;)'\"")
        if u not in seen:
            seen.add(u)
            urls.append(u)
    live = [u for u in urls if not any(a in u for a in _ARCHIVE)]
    return live or urls


# ---------------------------------------------------------------- bullets

def logical_lines(text: str, prose: bool = False) -> list[str]:
    """Physical lines joined when a <ref> or {{template}} spans several lines (cite templates often do)."""
    out, buf, n = [], None, 0

    def open_(s):
        return (s.count("{{") - s.count("}}") > 0) or (len(re.findall(r"<ref\b[^>]*?(?<!/)>", s, re.I)) > len(re.findall(r"</ref\s*>", s, re.I)))
    for ln in text.split("\n"):
        if buf is not None:
            buf += " " + ln.strip()
            n += 1
            if not open_(buf) or n > 60:
                out.append(buf)
                buf = None
            continue
        lead = ln.lstrip()
        if open_(ln) and (lead.startswith(("*", ":", ";", "#")) or (prose and lead[:1] not in ("{", "|", "!", "=", "<", ""))):
            buf, n = ln, 0
        else:
            out.append(ln)
    if buf is not None:
        out.append(buf)
    return out


_HEAD = re.compile(r"^(={2,6})\s*(.*?)\s*={2,6}\s*$")
SKIP_SECTIONS = ("births", "deaths", "incumbents", "references", "see also", "external links", "further reading",
                 "notes", "sources", "bibliography", "gallery", "naissances", "décès", "deces", "notes et références",
                 "voir aussi", "liens externes", "bibliographie", "références", "annexes",
                 "المواليد", "مواليد", "الوفيات", "وفيات", "ولادات", "الولادات", "انظر أيضا", "مراجع", "وصلات خارجية")


def split_bullets(wikitext: str) -> list[dict]:
    """Bullet lines (starting with *) with nesting kept: each dict has raw, depth, parents (raw text of ancestors,
    outermost first) and headings [(level, plain text)] in force. Children later inherit the parents as prefix."""
    out, stack, heads = [], [], []
    for ln in logical_lines(wikitext):
        h = _HEAD.match(ln)
        if h:
            lvl = len(h.group(1))
            heads = [x for x in heads if x[0] < lvl] + [(lvl, strip_markup(h.group(2)))]
            stack = []
            continue
        if ln.startswith((";", "|-", "{|", "|}", "{{")):
            stack = []  # a category label or table row ends the bullet family
        m = re.match(r"^(\*+)\s*(.*)$", ln)
        if not m:
            continue
        depth, body = len(m.group(1)), m.group(2)
        stack = stack[: depth - 1]
        stack += [""] * (depth - 1 - len(stack))
        out.append({"raw": body, "depth": depth, "parents": list(stack), "headings": list(heads)})
        stack.append(body)
    return out


def item_text(b: dict, maxparent: int = 220) -> str:
    """Plain text of a bullet with its ancestors as prefix ("parent: child")."""
    parts = []
    for p in b["parents"] + [b["raw"]]:
        t = strip_markup(p)
        if t:
            parts.append(t[:maxparent] if p is not b["raw"] else t)
    text = parts[0] if parts else ""
    for t in parts[1:]:
        text += (" " if text[-1:] in ".!?:;" else ": ") + t
    return text


def candidate_id(date_s: str, text: str) -> str:
    norm = " ".join(re.findall(r"[a-z0-9À-ɏ؀-ۿ]+", text.lower()))
    return hashlib.sha1(f"{date_s}|{norm}".encode()).hexdigest()[:12]


# ---------------------------------------------------------------- Lebanon filter

_CORE = (r"lebanon|lebanese|liban\b|libanais|beirut|beyrouth|hezbollah|hizbollah|hizballah|hizbullah|hizb allah|unifil|sidon|"
         r"saida\b|baalbek|baalbeck|bekaa|beqaa|nabatieh|nabatiyeh|byblos|jbeil|jubayl|zahle|zahlé|akkar|litani|shebaa|"
         r"hermel|marjayoun|bint jbeil|naqoura|jezzine|jounieh|chouf\b|shouf\b|kesrouan|keserwan|batroun|bcharre|bsharri|"
         r"rashaya|qlayaat|khiam|dahieh|dahiyeh|dahiya|nahr el-bared|nahr al-bared|ain al-hilweh|ein el-hilweh|"
         r"sabra and shatila|shatila|taif agreement|cedar revolution|bkerke|gemayel|hariri|jumblatt|junblatt|"
         r"camille chamoun|rene moawad|elias hrawi|emile lahoud|michel aoun|michel (?:suleiman|sleiman)|nabih berri|"
         r"hassan nasrallah|fouad siniora|fuad siniora|najib mikati|hassan diab|tammam salam|samir geagea|"
         r"suleiman frangieh|bechara el-khoury|bishara al-khuri|riad (?:al-)?solh|fouad chehab|fuad shihab|"
         r"charles h[eé]lou|elias sarkis|rashid karami|salim al-hoss|selim hoss|raymond edd[eé]|riad salameh|"
         r"naim qassem|hashem safieddine|mughniy[ae]h|mustafa badreddine|fuad shukr|joseph aoun|nawaf salam|"
         r"abbas al-musawi|elie hobeika|saad haddad|antoine lahad|samir kassir|gebran tueni|musa al-sadr|"
         r"fakhr al-din|emir bashir|bashir shihab|youssef karam|yusuf karam|mutasarrif|qaimaqam|"
         r"lebanese forces|syrian occupation of lebanon|"
         r"\bmaronite patriarch|druze.{0,40}(?:chouf|shouf|aley|hasbaya)|(?:chouf|shouf|aley|hasbaya).{0,40}druze")
_CORE_RE = re.compile(r"(?<![A-Za-z])(?:" + _CORE + r")", re.I)
_CASE_RE = re.compile(r"\b(?:Tyre|Qana|Phalang\w+|Kataeb|Amal (?:Movement|militia|party)|Hezb\w*|Mount Lebanon|Lebanon)\b")


def lebanon_match(text: str, year: int | None = None) -> bool:
    """True when the text carries a Lebanon term. Tripoli alone never counts (Libya); it passes only through a
    Lebanon term such as 'Tripoli, Lebanon' or 'north Lebanon'. Maronite/Druze alone count before 1920."""
    if _CORE_RE.search(text) or _CASE_RE.search(text):
        return True
    low = text.lower()
    if "maronite" in low and "druze" in low:
        return True
    return bool(year and year < 1920 and ("maronite" in low or "druze" in low or "druse" in low))


# ---------------------------------------------------------------- pages -> items

PROSE_PAGES = {"17 October Revolution"}  # paragraphs, not bullets: split into dated sentences
TABLE_PAGES = {"Timeline of Lebanese history"}  # | year || date || event rows
PASS_ALL = {"inleb", "timeline", "fr_year", "fr_timeline", "ar_year", "article", "fr_article"}  # whole page is about Lebanon


def page_group(host: str, title: str, hint: str | None = None) -> str:
    if hint:
        return hint
    t = title.replace("_", " ")
    if host.startswith("fr."):
        return "fr_year" if re.match(r"^\d{4} au Liban$", t) else "fr_timeline"
    if host.startswith("ar."):
        return "ar_year"
    if t.startswith("Portal:Current events/"):
        return "cevents"
    if re.match(r"^\d{4} in Lebanon$", t):
        return "inleb"
    if re.match(r"^\d{4} in the Ottoman Empire$", t):
        return "ottoman"
    if re.match(r"^\d{4}$", t):
        return "worldyear"
    if t == "List of years in Lebanon":
        return "list"
    return "timeline"


def _title_years(title: str) -> list[int]:
    return [int(y) for y in re.findall(r"(?<!\d)(1[89]\d\d|20[0-2]\d)(?!\d)", title)]


def _ctx_from_heads(heads, year):
    y, m, d, explicit = year, None, None, False
    for _, htxt in heads:
        hd = heading_date(htxt)
        if not hd:
            continue
        yy, mm, dd = hd
        if yy:
            y, m, d, explicit = yy, None, None, True
        if mm:
            m, d = mm, None
            if yy:
                y = yy
        if dd:
            d = dd
    return y, m, d, explicit


def _skipped(heads) -> bool:
    return any(h[1].lower().startswith(SKIP_SECTIONS) for h in heads)


def _in_range(iso: str) -> bool:
    return int(iso[:4]) >= MIN_YEAR and iso <= MAX_DATE[: len(iso)]


def _mk(iso, prec, text, refs, title, group, section):
    return {"date": iso, "prec": prec, "text": text, "refs": refs, "page": title, "group": group, "section": section}


def table_items(text: str, title: str, group: str) -> list[dict]:
    """Rows of `{| ... |-  | year || date || event` tables (Timeline of Lebanese history)."""
    out, last_year = [], None
    for blk in re.split(r"\n\|-[^\n]*\n", text):
        cells = []
        for ln in logical_lines(blk):
            if ln.startswith("|") and not ln.startswith(("|}", "|+")):
                cells += [re.sub(r'^\s*(?:\w+\s*=\s*"[^"]*"\s*)+\|\s*', "", c) for c in ln[1:].split("||")]
        if len(cells) < 3:
            continue
        ycell = strip_markup(cells[0])
        ym = re.match(r"^(\d{3,4})(?!\s*(?:BC|BCE))", ycell)
        last_year = int(ym.group(1)) if ym and "BC" not in ycell.upper() else (last_year if not ycell else None)
        if not last_year:
            continue
        raw_ev = cells[2] if len(cells) > 2 else ""
        body = strip_markup(raw_ev)
        dcell = strip_markup(cells[1])
        pd = parse_date_prefix(dcell + " –", year=last_year) if dcell else None
        iso, prec = (pd[0], pd[1]) if pd else (f"{last_year:04d}", "year")
        if len(body) < 25 or not _in_range(iso):
            continue
        out.append(_mk(iso, prec, body, extract_refs(raw_ev), title, group, "table"))
    return out


_PA = re.compile(rf"\b(?P<d>\d{{1,2}})(?:st|nd|rd|th|er)?\s+(?P<m>{_M})\.?,?(?:\s+(?P<y>\d{{4}}))?\b", re.I)
_PB = re.compile(rf"\b(?P<m>{_M})\.?\s+(?P<d>\d{{1,2}})(?:st|nd|rd|th)?\b,?(?:\s+(?P<y>\d{{4}}))?", re.I)
_PC = re.compile(rf"\b(?P<m>{_M})\.?,?\s+(?P<y>\d{{4}})\b", re.I)
ARTICLE_SKIP = SKIP_SECTIONS + ("footnotes", "citations", "works cited", "further reading", "gallery", "legacy and memory")


def prose_items(text: str, title: str, group: str, carry: bool = True) -> list[dict]:
    """Dated sentences of a prose page. A sentence takes the first 'D Month [YYYY]' (or 'Month D, YYYY', or
    'Month YYYY') it contains. carry=True lets a missing year come from the previous dated sentence (protest
    timelines); carry=False (history articles) demands the year in the sentence itself. Refs: those cited inside
    the sentence's paragraph slot."""
    out, year, skip = [], None, False
    for ln in logical_lines(text, prose=True):
        hd = _HEAD.match(ln)
        if hd:
            skip = strip_markup(hd.group(2)).lower().startswith(ARTICLE_SKIP)
            continue
        if skip or len(ln) < 80 or ln[0] in "*|!{=;:#<[" or ln.startswith("File:"):
            continue
        if not carry:
            year = None
        refs_by_slot: list[list[str]] = []

        def hold(m):
            refs_by_slot.append(extract_refs(m.group(0)))
            return f"⟦{len(refs_by_slot) - 1}⟧"
        marked = _REF_SELF.sub("", _REF_FULL.sub(hold, ln))
        for sent in re.split(r"(?<=[.!?⟧])\s+(?=[A-ZÀ-ÖØ-Þ⟦\"“])", marked):
            slots = [int(x) for x in re.findall(r"⟦(\d+)⟧", sent)]
            plain = strip_markup(re.sub(r"⟦\d+⟧", "", sent))
            if len(plain) < 40:
                continue
            hit = _PA.search(plain) or _PB.search(plain)
            iso = prec = None
            if hit:
                g = hit.groupdict()
                if g.get("y"):
                    year = int(g["y"])
                if year:
                    m, d = MONTHS[g["m"].lower().rstrip(".")], int(g["d"])
                    try:
                        date(year, m, d)
                        iso, prec = f"{year:04d}-{m:02d}-{d:02d}", "day"
                    except ValueError:
                        pass
            if not iso and not carry:
                mc = _PC.search(plain)
                if mc:
                    iso, prec = f"{int(mc.group('y')):04d}-{MONTHS[mc.group('m').lower().rstrip('.')]:02d}", "month"
            if iso and _in_range(iso):
                out.append(_mk(iso, prec, plain, [u for sl in slots for u in refs_by_slot[sl]], title, group, "prose"))
    return out


def items_from_page(host: str, title: str, text: str, hint: str | None = None) -> list[dict]:
    """All dated, Lebanon-filtered items of one page (pure: no network)."""
    group = page_group(host, title, hint)
    if group == "list":
        return []
    t = title.replace("_", " ")
    out: list[dict] = []
    if group in ("article", "fr_article"):
        return prose_items(text, t, group, carry=False)
    if t in PROSE_PAGES:
        return [i for i in prose_items(text, t, group) if lebanon_match(i["text"])]
    if t in TABLE_PAGES:
        out += table_items(text, t, group)
    fixed = title_date(t) if group == "cevents" else None
    ys = _title_years(t) if group != "cevents" else []
    cur_year, ymax, last_m = (ys[0] if ys else None), (ys[-1] if ys else None), None
    bullets = split_bullets(text)
    for i, b in enumerate(bullets):
        heads = b["headings"]
        if _skipped(heads):
            continue
        body = item_text(b)
        has_child = i + 1 < len(bullets) and bullets[i + 1]["depth"] > b["depth"]
        refs = extract_refs(b["raw"])
        if fixed:
            iso, prec, rest = fixed, "day", body
        else:
            y, m, d, explicit = _ctx_from_heads(heads, cur_year)
            if m and not explicit and last_m and m < last_m and cur_year and ymax and cur_year < ymax:
                cur_year += 1
                y = cur_year
            if m:
                last_m = m
            pd = parse_date_prefix(body, year=y, month=m, day=d, lead_year=(group in ("timeline", "ottoman")))
            if not pd:
                continue
            iso, prec, rest = pd
            own0 = strip_markup(b["raw"])
            if prec != "day" and b["parents"] and own0:  # "* Event (2011-2017):" / "** 21 juillet: ..." -> date from the child
                pd2 = parse_date_prefix(own0, year=y, month=m, day=d, lead_year=(group in ("timeline", "ottoman")))
                if pd2 and len(pd2[0]) > len(iso) and pd2[0][:4] == iso[:4]:
                    pre = item_text({"parents": b["parents"], "raw": ""})
                    iso, prec, rest = pd2[0], pd2[1], (pre + ": " if pre else "") + pd2[2]
        own = strip_markup(b["raw"])
        if len(rest) < 25 or (has_child and (own.endswith(":") or len(own) < 40)):
            continue
        if not _in_range(iso):
            continue
        sec = " > ".join(h[1] for h in heads)[:80]
        out.append(_mk(iso, prec, rest, refs, t, group, sec))
    if group not in PASS_ALL:
        out = [i for i in out if lebanon_match(i["text"], int(i["date"][:4]))]
    return out


# ---------------------------------------------------------------- fetch (Special:Export batches, polite, cached)

class Gate:
    """Spaces request starts (one shared clock) and holds everyone off after a 429."""
    def __init__(self, gap: float):
        self.gap, self.next, self.lock = gap, 0.0, threading.Lock()

    def wait(self):
        with self.lock:
            now = time.monotonic()
            t = max(now, self.next)
            self.next = t + self.gap
        if t > now:
            time.sleep(t - now)

    def penalty(self, secs: float):
        with self.lock:
            self.next = max(self.next, time.monotonic() + secs)


GATE = Gate(0.8)
_xml_ns = re.compile(r"^\{.*\}")


def norm_title(t: str) -> str:
    t = t.replace("_", " ").strip()
    return t[:1].upper() + t[1:]


def raw_path(host: str, title: str) -> Path:
    return RAW / host.split(".")[0] / (hashlib.sha1(norm_title(title).encode()).hexdigest()[:16] + ".json")


def load_raw(host: str, title: str):
    p = raw_path(host, title)
    try:
        return json.loads(p.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def save_raw(host: str, rec: dict):
    p = raw_path(host, rec["title"])
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(rec, ensure_ascii=False))
    tmp.replace(p)


def export_batch(host: str, titles: list[str], tries: int = 8) -> dict[str, dict]:
    """One Special:Export POST for up to ~50 titles -> {normalised title: record}. Titles absent from the answer are
    'missing'. Retries with backoff on 429/5xx, honouring Retry-After."""
    body = urllib.parse.urlencode({"pages": "\n".join(titles), "curonly": "1", "action": "submit"}).encode()
    last = None
    for a in range(tries):
        GATE.wait()
        req = urllib.request.Request(f"https://{host}/wiki/Special:Export", data=body, method="POST",
                                     headers={"User-Agent": UA, "Accept-Encoding": "identity"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            if b"</mediawiki>" not in data[-200:]:
                raise OSError("truncated export")
            root = ET.fromstring(data)
            break
        except urllib.error.HTTPError as e:
            last = e
            wait = float(e.headers.get("retry-after") or 0) or min(60, 3 * 2 ** a)
            GATE.penalty(wait)
            time.sleep(wait)
        except (OSError, ET.ParseError, urllib.error.URLError) as e:
            last = e
            time.sleep(min(30, 2 ** a))
    else:
        raise RuntimeError(f"export failed for {host} ({len(titles)} titles): {last}")
    out: dict[str, dict] = {}
    for pg in root.iter():
        if _xml_ns.sub("", pg.tag) != "page":
            continue
        kids = {_xml_ns.sub("", c.tag): c for c in pg}
        title = (kids["title"].text or "").strip()
        text = ""
        rev = kids.get("revision")
        if rev is not None:
            for c in rev:
                if _xml_ns.sub("", c.tag) == "text":
                    text = c.text or ""
        rd = kids.get("redirect")
        m = re.match(r"\s*#REDIRECT\s*\[\[([^\]|#]+)", text, re.I)
        target = (rd.get("title") if rd is not None else None) or (m.group(1).strip() if m else None)
        out[norm_title(title)] = {"host": host, "title": title, "status": "redirect" if target else "ok",
                                  "redirect_to": target, "text": "" if target else text, "ts": int(time.time())}
    for t in titles:
        k = norm_title(t)
        if k not in out:
            out[k] = {"host": host, "title": k, "status": "missing", "redirect_to": None, "text": "", "ts": int(time.time())}
    return out


def fetch_titles(host: str, titles: list[str], batch: int = 50, workers: int = 4) -> Counter:
    """Fetch every title not yet cached (missing pages are cached too), following redirects up to 3 hops."""
    stats: Counter = Counter()
    frontier = list(dict.fromkeys(norm_title(t) for t in titles))
    for _ in range(4):
        need = [t for t in frontier if load_raw(host, t) is None]
        chunks = [need[i:i + batch] for i in range(0, len(need), batch)]

        def run(ch):
            res = export_batch(host, ch)
            for rec in res.values():
                save_raw(host, rec)
            return res
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for n, res in enumerate(ex.map(run, chunks), 1):
                stats.update(rec["status"] for rec in res.values())
                if n % 10 == 0:
                    print(f"  {host}: {n}/{len(chunks)} batches", flush=True)
        nxt = []
        for t in frontier:
            rec = load_raw(host, t)
            if rec and rec["status"] == "redirect" and rec["redirect_to"]:
                nxt.append(norm_title(re.sub(r"#.*$", "", rec["redirect_to"])))
        frontier = list(dict.fromkeys(nxt))
        if not frontier:
            break
    return stats


def apply_hint(host: str, titles: list[str], hint: str) -> None:
    """Tag cached pages (and the targets of their redirects) with a source group the title alone cannot tell."""
    for t in titles:
        rec = load_raw(host, t)
        for _ in range(4):
            if not rec:
                break
            if rec["status"] == "redirect" and rec["redirect_to"]:
                rec = load_raw(host, norm_title(re.sub(r"#.*$", "", rec["redirect_to"])))
                continue
            if rec["status"] == "ok" and rec.get("hint") != hint:
                rec["hint"] = hint
                save_raw(host, rec)
            break


ARTICLES_EN = [
    "History of Lebanon", "Emirate of Mount Lebanon", "Mount Lebanon Mutasarrifate", "1860 civil conflict in Mount Lebanon and Damascus",
    "1840 Mount Lebanon uprising", "Great Famine of Mount Lebanon", "French Mandate for Syria and the Lebanon", "State of Greater Lebanon",
    "Lebanese Civil War", "1958 Lebanon crisis", "1982 Lebanon War", "South Lebanon conflict (1985–2000)", "1978 South Lebanon conflict",
    "Siege of Beirut", "Sabra and Shatila massacre", "Syrian occupation of Lebanon", "Cedar Revolution", "Assassination of Rafic Hariri",
    "Special Tribunal for Lebanon", "2006 Lebanon War", "2007 Lebanon conflict", "2008 conflict in Lebanon", "Doha Agreement (2008)",
    "Syrian civil war spillover in Lebanon", "2020 Beirut explosion", "Lebanese liquidity crisis", "Lebanese general election, 2022",
    "2022–2025 Lebanese presidential election", "Israel–Hezbollah conflict (2023–present)", "2024 Lebanon electronic device attacks",
    "Israeli invasion of Lebanon (2024)", "2024 Israel–Lebanon ceasefire agreement", "2026 Lebanon war", "Operation Grapes of Wrath",
    "Operation Accountability", "1996 Qana shelling", "Israeli withdrawal from Southern Lebanon (2000)", "Taif Agreement",
    "Mountain War (Lebanon)", "Battle of the Hotels", "Black Saturday (1975)", "Karantina massacre", "Damour massacre",
    "Siege of Tel al-Zaatar", "1983 Beirut barracks bombing", "April 1983 United States Embassy bombing", "Multinational Force in Lebanon",
    "Lebanon hostage crisis", "Battle of Nahr al-Bared (2007)", "1912 Italian bombardment of Beirut", "Lebanese Independence Day",
    "Lebanese–Israeli conflict", "Israel–Lebanon relations", "Hezbollah", "Amal Movement", "Lebanese Forces", "Kataeb Party",
    "Palestinian insurgency in South Lebanon", "Lebanese protests (2019–2021)" , "2005 Lebanese protests", "Beirut port explosion investigation",
    "2023–2024 Lebanon–Israel border clashes", "UNIFIL", "Syrian–Lebanese border", "Lebanese parliamentary election, 2018",
    "Lebanese parliamentary election, 2009", "Lebanese parliamentary election, 2005", "Lebanese parliamentary election, 1992",
    "Lebanese presidential election, 1988", "Lebanese presidential election, 2016", "Ottoman Syria", "Beirut Vilayet", "Bashir Shihab II",
    "Lebanese pound", "Banque du Liban", "Lebanese Army", "Cabinet of Lebanon", "Beirut Madinati", "Lebanese Parliament",
    "Lebanese banking crisis", "COVID-19 pandemic in Lebanon", "2021 Lebanon fuel crisis", "2019–2020 Lebanese financial crisis",
]
ARTICLES_FR = ["Guerre du Liban", "Histoire du Liban", "Chronologie de la guerre du Liban", "Liban sous mandat français", "Invasion du Liban de 1982"]


def day_titles() -> list[str]:
    out, d = [], DAY_FROM
    while d <= DAY_TO:
        out.append(f"Portal:Current events/{d.year} {d.strftime('%B')} {d.day}")
        d += timedelta(days=1)
    return out


_HZ = "Timeline of the Israel–Hezbollah conflict"
TIMELINE_SEEDS = [
    "List of years in Lebanon", "Timeline of Lebanese history", "Timeline of Beirut", "Timeline of Tripoli, Lebanon",
    "Timeline of Tripoli", "Timeline of Sidon", "Timeline of Tyre, Lebanon", "Timeline of the Lebanese Civil War",
    "Timeline of the 2006 Lebanon War", "Timeline of the 2006 Lebanon War (July)", "Timeline of the 2006 Lebanon War (early August)",
    "Timeline of the 2006 Lebanon War (mid August)", "Timeline of the 2006 Lebanon War (late August)",
    "Timeline of the Hezbollah–Israel conflict (2023–present)", "Timeline of the 2026 Lebanon war",
    f"{_HZ} (8 October – 23 November 2023)", f"{_HZ} (24 November 2023 – 1 January 2024)",
    f"{_HZ} (2 January – 31 March 2024)", f"{_HZ} (1 April – 26 July 2024)", f"{_HZ} (27 July 2024 – 16 September 2024)",
    f"{_HZ} (17 September – 26 November 2024)", f"{_HZ} (27 November 2024 – 26 February 2026)",
    f"{_HZ} (2 March 2026 – present)", "Timeline of the 2024 Israel–Hezbollah war", "Timeline of the 2023 Israel–Hezbollah conflict",
    "17 October Revolution", "Timeline of the 17 October Revolution", "2019–2021 Lebanese protests",
    "Timeline of the Syrian occupation of Lebanon", "Timeline of the 1982 Lebanon War", "Timeline of the 2005 Lebanese protests",
]
LINK_OK = re.compile(r"hezbollah|lebanon|lebanese|beirut|tripoli, lebanon|sidon|tyre, lebanon", re.I)


def seed_plan() -> dict[str, list[str]]:
    en = day_titles()
    en += [f"{y} in Lebanon" for y in range(1800, 2027)]
    en += [f"{y} in the Ottoman Empire" for y in range(1800, 1919)]
    en += [str(y) for y in range(1800, 2004)]  # world year pages: Lebanon-filtered; covers the years before daily pages
    en += TIMELINE_SEEDS
    return {"en.wikipedia.org": en,
            "fr.wikipedia.org": [f"{y} au Liban" for y in range(1800, 2027)] + ["Chronologie du Liban"],
            "ar.wikipedia.org": [f"{y} في لبنان" for y in range(1800, 2027)]}


def discover_links() -> list[str]:
    """Timeline pages linked from the timeline hubs we already hold (the Israel-Hezbollah sub-pages, 2026 war pages...)."""
    found = []
    for f in (RAW / "en").glob("*.json"):
        rec = json.loads(f.read_text())
        if rec["status"] != "ok" or page_group("en.wikipedia.org", rec["title"], rec.get("hint")) != "timeline":
            continue
        for m in re.finditer(r"\[\[(Timeline of [^\]|#]+)", rec["text"]):
            t = norm_title(m.group(1))
            if LINK_OK.search(t) and load_raw("en.wikipedia.org", t) is None:
                found.append(t)
    return sorted(set(found))


def cmd_fetch():
    t0 = time.time()
    for host, titles in seed_plan().items():
        st = fetch_titles(host, titles)
        print(f"fetch {host}: {len(titles)} titles, new {dict(st)}", flush=True)
    for host, titles, hint in (("en.wikipedia.org", ARTICLES_EN, "article"), ("fr.wikipedia.org", ARTICLES_FR, "fr_article")):
        st = fetch_titles(host, titles)
        apply_hint(host, titles, hint)
        print(f"fetch {hint}: {len(titles)} titles, new {dict(st)}", flush=True)
    for rnd in range(3):
        more = discover_links()
        if not more:
            break
        st = fetch_titles("en.wikipedia.org", more)
        print(f"discovered round {rnd + 1}: {len(more)} timeline pages {dict(st)}", flush=True)
    st: dict = {}
    for f in RAW.rglob("*.json"):
        rec = json.loads(f.read_text())
        k = f"{rec['host'].split('.')[0]}:{page_group(rec['host'], rec['title'], rec.get('hint'))}"
        st.setdefault(k, Counter())[rec["status"]] += 1
    (CACHE / "stage-fetch.json").write_text(json.dumps({k: dict(v) for k, v in sorted(st.items())}, indent=1))
    print(f"fetch done: {sum(sum(v.values()) for v in st.values())} cached pages, {time.time() - t0:.0f}s")


# ---------------------------------------------------------------- extract

def iter_pages():
    for f in sorted(RAW.rglob("*.json")):
        try:
            rec = json.loads(f.read_text())
        except json.JSONDecodeError:
            continue
        if rec.get("status") == "ok" and rec.get("text"):
            yield rec


def cmd_extract():
    by_id: dict[str, dict] = {}
    raw_n, per_group, per_page_group = Counter(), Counter(), Counter()
    for rec in iter_pages():
        items = items_from_page(rec["host"], rec["title"], rec["text"], rec.get("hint"))
        g = page_group(rec["host"], rec["title"], rec.get("hint"))
        per_page_group[g] += 1
        for it in items:
            raw_n[g] += 1
            cid = candidate_id(it["date"], it["text"])
            c = by_id.get(cid)
            if c is None:
                by_id[cid] = {"id": cid, "date": it["date"], "prec": it["prec"], "text": it["text"], "refs": list(it["refs"]),
                              "pages": [it["page"]], "groups": [g]}
            else:
                c["refs"] += [u for u in it["refs"] if u not in c["refs"]]
                if it["page"] not in c["pages"]:
                    c["pages"].append(it["page"])
                if g not in c["groups"]:
                    c["groups"].append(g)
    rows = sorted(by_id.values(), key=lambda c: (c["date"], c["id"]))
    out = CACHE / "extracted.jsonl"
    out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    st = {"pages_with_text_by_group": dict(per_page_group), "items_by_group_before_merge": dict(raw_n),
          "candidates_unique": len(rows), "by_year": dict(sorted(Counter(r["date"][:4] for r in rows).items()))}
    (CACHE / "stage-extract.json").write_text(json.dumps(st, indent=1))
    print("extract:", json.dumps({k: v for k, v in st.items() if k != "by_year"}))


def load_extracted() -> list[dict]:
    return [json.loads(l) for l in (CACHE / "extracted.jsonl").read_text().splitlines() if l.strip()]


# ---------------------------------------------------------------- Jev judgments

sys.path.insert(0, str(Path(__file__).parent))
import jev  # noqa: E402
from jev_supervise import Q_EVENT, terms  # noqa: E402

Q_LEB = ("TEXT reports a specific event that happened in Lebanon, or was done to or by Lebanon's state, people or "
         "territory. A mere mention of Lebanon is not enough.")
Q_SIG = ("A careful historian writing the most complete national timeline of Lebanon would include this event: it changed "
         "politics, security, the economy, society, law, the environment or culture at national level, or it killed or "
         "displaced people.")
TRACKS = {
    "Political/war": "government, politics, elections, diplomacy inside Lebanon, security, armed conflict, attacks, strikes, assassinations",
    "Economic": "economy, banking, currency, trade, prices, debt, energy and fuel markets, labour and strikes over pay",
    "Social": "society, communities, health, education, migration, refugees, demographics, protests over social issues, crime",
    "Technological": "technology, telecoms, internet, infrastructure, innovation, science",
    "Environmental": "environment, pollution, waste, fires, floods, earthquakes, weather, natural disasters, water",
    "Legal": "laws, courts, tribunals, judicial rulings, treaties, sanctions, constitutional and regulatory acts",
    "Regional": "relations with other states, regional diplomacy, foreign events that shaped Lebanon",
    "Culture/sport": "culture, arts, film, music, media, religion events, heritage, sport",
}
QUESTIONS = {
    "lebanon_event": {"type": "noul", "instructions": Q_LEB},
    "significance": {"type": "noul", "instructions": Q_SIG},
    "track": {"type": "choice", "instructions": "Which track of a national timeline of Lebanon does the event in TEXT mainly belong to?",
              "criteria": TRACKS},
}
_WAR = re.compile(r"\b(kill|killed|killing|strike|strikes|airstrike|attack|shell|shelling|bomb|bombing|missile|rocket|troops|invad|"
                  r"clash|ceasefire|cease-fire|war|battle|massacre|assassinat|siege|offensive|raid|militia|fighting|casualt|wounded)", re.I)


def map_track(choice: str, text: str) -> str:
    if choice == "Political/war":
        return "war" if _WAR.search(text) else "politics"
    return {"Economic": "economy", "Social": "social", "Technological": "innovation", "Environmental": "environment",
            "Legal": "legal", "Regional": "regional", "Culture/sport": "culture"}.get(choice, "politics")


def judge_one(c: dict) -> dict:
    state = json.dumps({"date": c["date"], "text": jev.clip(c["text"], 1000), "page": c["pages"][0]}, ensure_ascii=False)
    a = jev.ask(state, QUESTIONS, cache=JEV_CACHE)["answers"]
    return {"id": c["id"], "lebanon_event": round(float(a["lebanon_event"]["noul"]), 4),
            "significance": round(float(a["significance"]["noul"]), 4), "choice": a["track"]["choice"],
            "track_conf": round(float(a["track"].get("confidence", 0)), 3)}


COST_F = CACHE / "cost.json"


def add_cost():
    """Jev's `usage` is per process; keep a running total across runs (cached calls cost nothing)."""
    tot = json.loads(COST_F.read_text()) if COST_F.exists() else {"input_tokens": 0, "calls": 0}
    tot["input_tokens"] += jev.usage["input_tokens"]
    tot["calls"] += jev.usage["calls"]
    tot["usd"] = round(tot["input_tokens"] / 1e6 * 0.042, 4)
    COST_F.write_text(json.dumps(tot))
    jev.usage.update(input_tokens=0, calls=0)
    return tot


UNRESOLVED: dict = {}


def pool_checked(items, fn, label: str, workers: int = 16):
    """jev.pool with a circuit breaker: persistent Jev errors stop the run instead of burning through the list."""
    probe = items[:200]
    res = jev.pool(probe, fn, workers=workers)
    errs = [r for r in res if isinstance(r, Exception)]
    if probe and len(errs) > 0.5 * len(probe):
        raise SystemExit(f"{label}: Jev erroring persistently ({len(errs)}/{len(probe)}): {errs[0]!r}")
    res += jev.pool(items[200:], fn, workers=workers)
    for _ in range(3):  # failures are retried with fewer workers; an unresolved one must never read as "score 0" silently
        bad = [i for i, r in enumerate(res) if isinstance(r, Exception)]
        if not bad:
            break
        time.sleep(3)
        again = jev.pool([items[i] for i in bad], fn, workers=4)
        for i, r in zip(bad, again):
            res[i] = r
    errs = sum(isinstance(r, Exception) for r in res)
    UNRESOLVED[label] = errs
    if errs > 0.05 * len(items):
        raise SystemExit(f"{label}: {errs}/{len(items)} Jev errors after retry; stopping. First: {[r for r in res if isinstance(r, Exception)][0]!r}")
    return res


def cmd_judge():
    cands = load_extracted()
    t0 = time.time()
    res = pool_checked(cands, judge_one, "judge")
    ok = [r for r in res if isinstance(r, dict)]
    (CACHE / "judged.jsonl").write_text("\n".join(json.dumps(r) for r in ok) + "\n")
    tot = add_cost()
    print(f"judge: {len(ok)}/{len(cands)} judged in {time.time() - t0:.0f}s | {json.dumps(tot)}")


# ---------------------------------------------------------------- dedupe (code picks pairs, Jev answers same_event)

def span(iso: str) -> tuple[int, int]:
    """Date interval as day ordinals: day +-2 days, month = whole month, year = whole year."""
    p = iso.split("-")
    y = int(p[0])
    if len(p) == 3:
        o = date(y, int(p[1]), int(p[2])).toordinal()
        return o - 2, o + 2
    if len(p) == 2:
        m = int(p[1])
        a = date(y, m, 1)
        b = date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
        return a.toordinal(), b.toordinal()
    return date(y, 1, 1).toordinal(), date(y, 12, 31).toordinal()


def dkey(iso: str) -> tuple:
    c = iso.count("-")
    return (c, date.fromisoformat(iso).toordinal() if c == 2 else None, iso[:7], iso[:4])


def compat_k(a: tuple, b: tuple) -> bool:
    c = min(a[0], b[0])
    if c == 0:
        return a[3] == b[3]
    if c == 1:
        return a[2] == b[2]
    return abs(a[1] - b[1]) <= 2


def date_compat(a: str, b: str) -> bool:
    """Same day +-2 days for day precision, same month for month, same year for year (the coarser side rules)."""
    return compat_k(dkey(a), dkey(b))


NON_EN = ("fr_year", "fr_timeline", "ar_year", "fr_article")


def non_en(r: dict) -> bool:
    return bool(r.get("groups")) and all(g in NON_EN for g in r["groups"])


def overlap(ta: set, tb: set) -> float:
    inter = len(ta & tb)
    if not inter or (inter < 2 and min(len(ta), len(tb)) > 3):
        return 0.0
    return inter / (len(ta) * len(tb)) ** 0.5


OVERLAP_MIN = 0.15
TOPK = 6


def load_existing() -> list[dict]:
    rows, seen = [], set()
    for f in sorted(R.glob("*.timeline.jsonl")):
        for ln in f.open():
            if ln.strip():
                r = json.loads(ln)
                d, t = (r.get("date") or ""), (r.get("title") or "")
                if re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", d) and (d, t) not in seen:
                    seen.add((d, t))
                    rows.append({"date": d, "title": t, "terms": terms(t + " " + (r.get("why") or ""))})
    tsv = V6 / "00-existing-index.tsv"
    if tsv.exists():
        for ln in tsv.read_text().splitlines():
            p = ln.split("\t")
            if len(p) >= 4 and re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", p[0]) and (p[0], p[3]) not in seen:
                seen.add((p[0], p[3]))
                rows.append({"date": p[0], "title": p[3], "terms": terms(p[3])})
    return rows


def ask_same(source: str, proposition: str) -> float:
    state = json.dumps({"SOURCE": jev.clip(source, 1200), "PROPOSITION": jev.clip(proposition, 600)}, ensure_ascii=False)
    r = jev.ask(state, {"same_event": {"type": "noul", "instructions": Q_EVENT}}, cache=JEV_CACHE)
    return float(r["answers"]["same_event"]["noul"])


def cand_claim(c: dict) -> str:
    return f"{c['text']}. {c['date']}"


def quality(c: dict):
    return (-c["significance"], -len(c["text"]), -len(c["refs"]), c["id"])


def cluster_survivors(rows: list[dict]) -> tuple[list[dict], int, list]:
    """Star clustering: best candidate becomes head; unassigned neighbours with same_event >= SAME_OK fold into it."""
    for r in rows:
        r["_t"] = terms(r["text"])
    by_year = defaultdict(list)
    for i, r in enumerate(rows):
        r["_k"] = dkey(r["date"])
        by_year[r["date"][:4]].append(i)
    pairs: dict[tuple[int, int], float] = {}
    nbr = defaultdict(list)
    for idx in by_year.values():
        for a_pos, i in enumerate(idx):
            ki, ti, ni = rows[i]["_k"], rows[i]["_t"], non_en(rows[i])
            for j in idx[a_pos + 1:]:
                if not compat_k(ki, rows[j]["_k"]):
                    continue
                s = overlap(ti, rows[j]["_t"])
                if s < OVERLAP_MIN and (ni or non_en(rows[j])) and ki[0] == 2 == rows[j]["_k"][0]:
                    s = 0.05 + 0.01 * (ki[1] == rows[j]["_k"][1])  # cross-language: terms cannot match, date only
                if s >= OVERLAP_MIN or 0.05 <= s < 0.07:
                    nbr[i].append((s, j))
                    nbr[j].append((s, i))
    for i, lst in nbr.items():
        for s, j in sorted(lst, reverse=True)[:TOPK]:
            pairs[(min(i, j), max(i, j))] = s
    keys = list(pairs)
    res = pool_checked(keys, lambda k: ask_same(cand_claim(rows[k[0]]), cand_claim(rows[k[1]])), "dedupe-within")
    score = {k: (r if isinstance(r, float) else 0.0) for k, r in zip(keys, res)}
    order = sorted(range(len(rows)), key=lambda i: quality(rows[i]))
    adj = defaultdict(list)
    for (x, y), sc in score.items():
        if sc >= SAME_OK:
            adj[x].append(y)
            adj[y].append(x)
    head_of, members = {}, defaultdict(list)
    for i in order:
        if i in head_of:
            continue
        head_of[i] = i
        for j in adj.get(i, []):
            if j not in head_of:
                head_of[j] = i
                members[i].append(j)
    heads, merged = [], 0
    for i in order:
        if head_of[i] == i:
            h = rows[i]
            h["_merged"] = [(rows[j]["date"], rows[j]["text"][:200]) for j in members[i]]
            for j in members[i]:
                h["refs"] += [u for u in rows[j]["refs"] if u not in h["refs"]]
                h["pages"] += [pg for pg in rows[j]["pages"] if pg not in h["pages"]]
                h["groups"] += [g for g in rows[j].get("groups", []) if g not in h["groups"]]
                merged += 1
            heads.append(h)
    return heads, merged, list(score.values())


def dedupe_vs_timeline(heads: list[dict]) -> list[float]:
    ex = load_existing()
    by_year = defaultdict(list)
    for e in ex:
        by_year[e["date"][:4]].append(e)
    todo = []
    for h in heads:
        t, kh = terms(h["text"]), dkey(h["date"])
        cands = []
        for e in by_year.get(h["date"][:4], []):
            ke = dkey(e["date"])
            if not compat_k(kh, ke):
                continue
            sc = overlap(t, e["terms"])
            if sc < OVERLAP_MIN and non_en(h) and kh[0] >= 1 and ke[0] >= 1:
                sc = 0.05 + (0.01 if kh[0] == ke[0] == 2 and kh[1] == ke[1] else 0)  # cross-language: date only
            cands.append((sc, e))
        top = [e for sc, e in sorted(cands, key=lambda x: -x[0])[: (8 if non_en(h) else TOPK)] if sc >= min(OVERLAP_MIN, 0.05) and (sc >= OVERLAP_MIN or non_en(h))]
        h["_ex"] = top
        todo += [(h["id"], e) for e in top]
    byid = {h["id"]: h for h in heads}
    res = pool_checked(todo, lambda k: ask_same(cand_claim(byid[k[0]]), f"{k[1]['title']}. {k[1]['date']}"), "dedupe-timeline")
    best: dict[str, tuple[float, str]] = {}
    for (cid, e), r in zip(todo, res):
        sc = r if isinstance(r, float) else 0.0
        if cid not in best or sc > best[cid][0]:
            best[cid] = (sc, e["title"])
    for h in heads:
        sc, title = best.get(h["id"], (0.0, None))
        h["dup_score"] = round(sc, 4) if title else None
        h["dup_of"] = title if sc >= SAME_OK else None
    return [v[0] for v in best.values()]


def year_range(y: int) -> str:
    return "pre2004" if y < 2004 else "y2004_2015" if y <= 2015 else "y2016_2026"


def cmd_dedupe():
    cands = {c["id"]: c for c in load_extracted()}
    judged = {j["id"]: j for j in (json.loads(l) for l in (CACHE / "judged.jsonl").read_text().splitlines() if l.strip())}
    ext = json.loads((CACHE / "stage-extract.json").read_text())
    rows, n_leb, n_both = [], 0, 0
    for cid, c in cands.items():
        j = judged.get(cid)
        if not j:
            continue
        if j["lebanon_event"] < LEB_OK:
            continue
        n_leb += 1
        if j["significance"] < SIG_OK:
            continue
        n_both += 1
        rows.append({**c, "lebanon_event": j["lebanon_event"], "significance": j["significance"], "track": map_track(j["choice"], c["text"]),
                     "dup_of": None, "dup_score": None})
    n_judged = len(judged)
    heads, merged, within = cluster_survivors(rows)
    dedupe_vs_timeline(heads)
    heads.sort(key=lambda r: (r["date"], r["id"]))
    with (CACHE / "merged-sample.jsonl").open("w") as f:  # for spot-checking the within-set clusters
        for h in heads:
            if h.get("_merged"):
                f.write(json.dumps({"head": [h["date"], h["text"][:200]], "merged": h["_merged"]}, ensure_ascii=False) + "\n")
    V6.mkdir(parents=True, exist_ok=True)
    keep = ("id", "date", "prec", "text", "refs", "pages", "lebanon_event", "significance", "track", "dup_of", "dup_score")
    (V6 / "harvest-candidates.jsonl").write_text("\n".join(json.dumps({k: r[k] for k in keep}, ensure_ascii=False) for r in heads) + "\n")
    nd = [r for r in heads if not r["dup_of"]]
    by_year = Counter(r["date"][:4] for r in heads)
    nd_year = Counter(r["date"][:4] for r in nd)
    rng = Counter(year_range(int(r["date"][:4])) for r in nd)
    src_surv = Counter(g for r in heads for g in set(r.get("groups", [])))
    tot = add_cost()
    near = {"lebanon_0.45-0.6_and_sig>=0.5": sum(1 for j in judged.values() if 0.45 <= j["lebanon_event"] < LEB_OK and j["significance"] >= SIG_OK),
            "lebanon_0.45-0.6_and_sig>=0.7": sum(1 for j in judged.values() if 0.45 <= j["lebanon_event"] < LEB_OK and j["significance"] >= 0.7),
            "sig_0.4-0.5_and_lebanon>=0.6": sum(1 for j in judged.values() if 0.4 <= j["significance"] < SIG_OK and j["lebanon_event"] >= LEB_OK),
            "both>=0.7": sum(1 for j in judged.values() if j["lebanon_event"] >= 0.7 and j["significance"] >= 0.7),
            "both>=0.8": sum(1 for j in judged.values() if j["lebanon_event"] >= 0.8 and j["significance"] >= 0.8)}
    st = {"generated": "2026-10-01", "fetch": json.loads((CACHE / "stage-fetch.json").read_text()) if (CACHE / "stage-fetch.json").exists() else None,
          "extract": ext,
          "stages": {"candidates_extracted": len(cands), "judged": n_judged,
                     "dropped_lebanon_event_lt_0.6": n_judged - n_leb, "kept_lebanon_event": n_leb,
                     "dropped_significance_lt_0.5": n_leb - n_both, "kept_both_thresholds": n_both,
                     "merged_within_set_same_event": merged, "survivors": len(heads),
                     "dup_of_existing_timeline": len(heads) - len(nd), "survivors_not_dup": len(nd)},
          "thresholds": {"lebanon_event": LEB_OK, "significance": SIG_OK, "same_event": SAME_OK, "overlap_min": OVERLAP_MIN, "topk": TOPK},
          "survivors_by_source_group": dict(src_surv), "survivors_by_year": dict(sorted(by_year.items())),
          "survivors_not_dup_by_year": dict(sorted(nd_year.items())), "not_dup_by_range": {k: rng.get(k, 0) for k in ("pre2004", "y2004_2015", "y2016_2026")},
          "near_miss_bands": near, "jev_errors_unresolved": dict(UNRESOLVED), "jev_cost": tot}
    (V6 / "harvest-stats.json").write_text(json.dumps(st, indent=1))
    print("dedupe:", json.dumps(st["stages"]), json.dumps(st["not_dup_by_range"]), json.dumps(tot))


def cmd_all():
    cmd_fetch()
    cmd_extract()
    cmd_judge()
    cmd_dedupe()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    {"fetch": cmd_fetch, "extract": cmd_extract, "judge": cmd_judge, "dedupe": cmd_dedupe, "all": cmd_all}[cmd]()
