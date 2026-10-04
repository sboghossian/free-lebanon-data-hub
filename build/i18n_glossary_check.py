"""Check every Arabic and French content translation of the Hub against research/i18n/glossary-{ar,fr}.json.

Where translations live (same order as build_timeline.py / hub/i18n.py, later wins):
  research/i18n/<lang>/part-*.jsonl      {"h", "t"}            English source = research/i18n/src-strings.jsonl by hash
  build/i18n/ui*.json                    {English: {ar, fr}}   English source = the key; hash = sha12(key)
Content files checked by default: the part files, ui_content.json (translate.py output) and ui_fixes.json (corrections to part strings).
The other ui*.json files are interface strings: they still take part in precedence (a hash they override is not checked in the part
file), and --ui-all checks them too. Only the translation that actually ships (the last one in build order) is checked.

Two checks per translation:
  terms    an English glossary term (whole word, case-sensitive, longest match first) whose canonical form and accepted variants
           all are absent from the translation.
  numbers  digits present in the English but missing from the translation (thousand and decimal separators ignored, Arabic-Indic
           and Persian digits read as Western).

Writes research/i18n/fix-gloss-<lang>-{1,2}.jsonl, one line per flagged string:
  {"h", "en", "current", "file", "expected": [{"term", "canonical", "variants_ok"}], "numbers_missing": [...]}
The two halves split by hash range when that leaves no file shared; otherwise by file (balanced by line count, greedy, stable).

Usage: python3 build/i18n_glossary_check.py [--ui-all] [--no-write] [--max-spelled=N]   (N: whole numbers up to N may be words; 10 by default, 0 = every digit)
"""
import glob
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
I18N = os.path.join(ROOT, "research", "i18n")
UI_DIR = os.path.join(HERE, "i18n")
sys.path.insert(0, HERE)
from hub.lib import sha12  # noqa: E402

LANGS = ("ar", "fr")
CONTENT_UI = ("ui_content.json", "ui_fixes.json")

# ---------------------------------------------------------------- normalisation

_AR_MARKS = re.compile("[ً-ٰٟـ‌‍]")
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_APOS = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "‐": "-", "‑": "-", " ": " ", " ": " ", " ": " "})


def norm_ws(s):
    return re.sub(r"\s+", " ", s).strip()


def norm_en(s):
    return norm_ws(unicodedata.normalize("NFC", s).translate(_APOS))


def norm_ar(s):
    s = unicodedata.normalize("NFC", s).translate(_APOS)
    s = _AR_MARKS.sub("", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي")
    return norm_ws(s)


def norm_fr(s):
    return norm_ws(unicodedata.normalize("NFC", s).translate(_APOS)).casefold()


NORM = {"ar": norm_ar, "fr": norm_fr}

# ---------------------------------------------------------------- terms

_AR_LETTER = "ء-ي"
_AR_PREFIX = "[وف]?(?:لل|[بكل]?(?:ال)?)"
_AR_SUFFIX = "(?:هما|هم|هن|ها|كم|كن|نا|ه|ك)?"

# A glossary key is often used as a modifier ("Syria's tutelage", "Druze PSP", "Israel-Lebanon talks"), and the right translation is then the
# adjective, not the canonical noun. Stems below (prefix match, any ending) are accepted for those keys, on top of the glossary forms.
DERIVED = {
    "ar": {
        "Druze": ["درز", "دروز"], "Syria": ["سوري"], "Syrians": ["سوري"], "Palestinian": ["فلسطين"], "Palestinians": ["فلسطين"], "Palestine": ["فلسطين"],
        "Shia": ["شيع"], "Sunni": ["سني", "سنة"], "Lebanon": ["لبنان"], "Israel": ["اسرائيل"], "Maronite": ["مارون"], "Maronites": ["مارون"],
        "Alawite": ["علوي"], "Armenian": ["ارمن"], "Iran": ["ايران"], "Iraq": ["عراق"], "Egypt": ["مصر"], "Jordan": ["اردن"], "Saudi": ["سعود"],
        "Mediterranean": ["متوسط"], "Christian": ["مسيح"], "Christians": ["مسيح"], "Turkey": ["ترك"], "Russia": ["روس"], "France": ["فرنس"],
        "Britain": ["بريطان", "انكليز", "انجليز"], "Kuwait": ["كويت"], "Qatar": ["قطر"], "Libya": ["ليب"], "Cyprus": ["قبرص"],
    },
    "fr": {
        "Lebanon": ["libanais", "libano"], "Israel": ["israélien", "israélo", "israelien"], "Syria": ["syrien", "syro"], "Iran": ["iranien", "irano"],
        "Palestine": ["palestinien"], "Iraq": ["irakien", "irako"], "Egypt": ["égyptien"], "Jordan": ["jordanien"], "Saudi Arabia": ["saoudien"],
        "Turkey": ["turc"], "Russia": ["russe", "russo"], "France": ["français", "franco"], "Kuwait": ["koweït"], "Qatar": ["qatari"],
        "Cyprus": ["chypriote"], "Libya": ["libyen"], "Morocco": ["marocain"], "Algeria": ["algérien"], "Lebanese Army": ["armée libanaise"],
        "Netanyahu": ["netanyahou"], "Maronites": ["maronite"], "Druze": ["druze"], "Alawite": ["alaouite"], "Mediterranean": ["méditerranée"],
    },
}


def _alt(forms):
    return "|".join(re.escape(f) for f in sorted(set(forms), key=len, reverse=True))


def _inflect(lang, forms):
    """Case and number variants that are not a different spelling: Arabic sound plural ون/ين, French plural s on the last word, French au/du for le."""
    out = list(forms)
    for f in forms:
        if lang == "ar":
            if f.endswith("ون") or f.endswith("ين"):
                out.append(f[:-2] + ("ين" if f.endswith("ون") else "ون"))
        elif f.startswith(("le ", "les ")):   # "au Caire", "du Caire", "aux États-Unis"
            rest = f.split(" ", 1)[1]
            out += [("au ", "du ")[i] + rest for i in (0, 1)] if f.startswith("le ") else ["aux " + rest, "des " + rest]
        elif f.endswith("s") and len(f) > 4:
            out.append(f[:-1])
        elif len(f) > 3 and not f.endswith(("s", "x")):
            out.append(f + "s")
    return out


def form_regex(lang, forms, derived=()):
    """Compiled regex for a set of accepted forms in one language, on text normalised with NORM[lang]."""
    forms = _inflect(lang, [NORM[lang](f) for f in forms if f and f.strip()])
    stems = [NORM[lang](x) for x in derived]
    if lang == "fr":
        rx = r"(?<!\w)(?:" + _alt(forms) + r")(?!\w)"
        return re.compile(rx + (r"|(?<!\w)(?:" + _alt(stems) + r")\w*" if stems else ""))
    loose, tight = [], []   # Arabic: a longer form can sit inside a word (the clitics, the plural); a short one (عون, صور) must be a token
    for f in forms:
        (loose if len(f.replace(" ", "")) >= 4 else tight).append(f)
        if f.startswith("ال") and len(f) >= 5:
            tight.append(f[2:])   # the article may drop ("أرز" for "الأرز")
    parts = []
    if loose:
        parts.append("(?:" + _alt(loose) + ")")
    if tight:
        parts.append(f"(?<![{_AR_LETTER}])" + _AR_PREFIX + "(?:" + _alt(tight) + ")" + _AR_SUFFIX + f"(?![{_AR_LETTER}])")
    if stems:
        parts.append(f"(?<![{_AR_LETTER}])" + _AR_PREFIX + "(?:" + _alt(stems) + ")" + f"[{_AR_LETTER}]*")
    return re.compile("|".join(parts))


class Glossary:
    def __init__(self, lang, data):
        self.lang = lang
        self.data = {norm_en(k): v for k, v in data.items() if k.strip() and v.get("canonical")}
        keys = sorted(self.data, key=len, reverse=True)
        self.en_re = re.compile(r"(?<!\w)(?:" + _alt(keys) + r")(?!\w)") if keys else None
        self._rx = {}

    def terms_in(self, en):
        """Glossary keys found in the English as whole words; leftmost, longest first, so 'Mount Lebanon' hides 'Lebanon'."""
        return [] if not self.en_re else [m.group(0) for m in self.en_re.finditer(norm_en(en))]

    def accepted(self, term):
        e = self.data[term]
        return [e["canonical"]] + list(e.get("variants_ok") or [])

    def ok(self, term, translation):
        rx = self._rx.get(term)
        if rx is None:
            rx = self._rx[term] = form_regex(self.lang, self.accepted(term), DERIVED[self.lang].get(term, ()))
        return bool(rx.search(NORM[self.lang](translation)))

    def missing(self, en, translation):
        """[{term, canonical, variants_ok}] for the glossary terms in `en` that the translation renders with neither form. One row per canonical."""
        out, seen = [], set()
        for t in dict.fromkeys(self.terms_in(en)):
            if self.ok(t, translation):
                continue
            e = self.data[t]
            if e["canonical"] in seen:
                continue
            seen.add(e["canonical"])
            out.append({"term": t, "canonical": e["canonical"], "variants_ok": list(e.get("variants_ok") or [])})
        return out


# ---------------------------------------------------------------- numbers

_RUN = re.compile(r"\d+")
_MERGE = re.compile(r"\d{1,3}(?:[ ,.\u066c]\d{3}(?!\d))+(?:[.,\u066b]\d+)?|\d+(?:[.,\u066b]\d+)*")
_EN_NUM = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)(?!,\d)|\d+\.\d+(?!\d)(?!\.\d)|\d+")
_DECADE = re.compile(r"(?<![\d.,])'?(?:\d{4}|\d{2})s\b")                    # 1980s, '90s: the translation says "الثمانينيات" or "années 1980"
_TIME = re.compile(r"\b(\d{1,2}):(\d{2})\b")                                # 17:00 -> "17 h"
_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")                          # 1980-07-20 -> "20 juillet 1980": the month becomes a word
_RANGE = re.compile(r"\b(\d{2})(\d{2})[-/](\d{2})(?!\d)")                     # 1989-90, 1952/53 -> "1989-1990"; 2023-09 (a month) asks for nothing
_ORD = re.compile(r"\b(\d+)(?:st|nd|rd|th)\b")


def _digits(s):
    return unicodedata.normalize("NFC", s).translate(_APOS).translate(_DIGITS)


def en_requirements(s, lang="fr"):
    """[(number, {accepted alternatives})] the English asks of a translation. Numbers are digit-only strings: '1,234.5' -> '12345'.
    Not required, because the translation writes them as words: decades, the minutes of a time on the hour, the month of a date, the
    short second year of a range as a month, Arabic ordinals. A short range year may be written in full (90 or 1990); a figure ending in
    000 may be written 'N thousand' (N), and one ending in 000000 'N million'."""
    s = _digits(s)
    req = []
    s = _DECADE.sub(" ", s)
    if lang == "ar":
        s = _ORD.sub(" ", s)

    def iso(m):
        req.append((m.group(1), set()))
        req.append((m.group(3), set()))
        return " "

    def rng(m):
        req.append((m.group(1) + m.group(2), set()))
        if not 1 <= int(m.group(3)) <= 12:
            req.append((m.group(3), {m.group(1) + m.group(3)}))
        return " "

    def tm(m):
        req.append((m.group(1), set()))
        if m.group(2) != "00":
            req.append((m.group(2), set()))
        return " "

    s = _ISO.sub(iso, s)
    s = _RANGE.sub(rng, s)
    s = _TIME.sub(tm, s)
    for m in _EN_NUM.findall(s):
        n = re.sub(r"\D", "", m)
        alt = set()
        if n.endswith("000000") and len(n) > 6:
            alt.add(n[:-6])
        if n.endswith("000") and len(n) > 3:
            alt.add(n[:-3])
        req.append((n, alt))
    seen, out = set(), []
    for n, alt in req:
        if n not in seen:
            seen.add(n)
            out.append((n, alt))
    return out


def tr_numbers(s):
    """Every number a translation may be carrying: each digit run, and each run merged across thousand or decimal separators of any language
    (comma, point, space, narrow no-break space, Arabic ٬ and ٫), as digit-only strings."""
    s = _digits(s)
    return set(_RUN.findall(s)) | {re.sub(r"\D", "", m) for m in _MERGE.findall(s)}


def _z(n):
    return n.lstrip("0") or "0"


def numbers_missing(en, translation, lang="fr", max_spelled=0):
    """Digit strings the English has and the translation lacks. Whole numbers up to max_spelled are not required (written as words, dual
    forms and ordinals are normal in both languages); 0 asks for every digit."""
    have = {_z(h) for h in tr_numbers(translation)}
    out = []
    for n, alt in en_requirements(en, lang):
        if _z(n) in have or any(_z(a) in have for a in alt) or n == "1000" or int(n) <= max_spelled and len(n) <= 2:
            continue
        out.append(n)
    return sorted(out, key=lambda x: (len(x), x))


# ---------------------------------------------------------------- sources

def rel(p):
    return os.path.relpath(p, ROOT)


def load_src():
    src = {}
    with open(os.path.join(I18N, "src-strings.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            src[r["h"]] = r["en"]
    return src


def ui_files(build_dir=UI_DIR):
    """Same order as hub.i18n.load_ui: ui.json, then ui_*.json sorted."""
    files = [os.path.join(build_dir, "ui.json")] + sorted(glob.glob(os.path.join(build_dir, "ui_*.json")))
    return [p for p in files if os.path.exists(p)]


def effective(lang, src, i18n_dir=I18N, build_dir=UI_DIR):
    """{hash: (translation, file, english or None)} for the translation that ships, last write in build order wins."""
    eff, shadowed = {}, 0
    for p in sorted(glob.glob(os.path.join(i18n_dir, lang, "part-*.jsonl"))):
        with open(p, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                h, t = r.get("h"), r.get("t")
                if not h or not isinstance(t, str) or not t.strip() or h not in src:
                    continue
                shadowed += h in eff
                eff[h] = (t, p, src[h])
    for p in ui_files(build_dir):
        with open(p, encoding="utf-8") as f:
            ui = json.load(f)
        for en, v in ui.items():
            if en.startswith("_") or not v.get(lang):
                continue
            h = sha12(en)
            shadowed += h in eff
            eff[h] = (v[lang], p, en)
    return eff, shadowed


# ---------------------------------------------------------------- run + split

def check(lang, gloss, eff, include_ui_all=False, max_spelled=10):
    rows, scanned, extra = [], 0, 0
    for h, (t, path, en) in sorted(eff.items()):
        if os.path.basename(path).startswith("ui") and not include_ui_all and os.path.basename(path) not in CONTENT_UI:
            continue
        scanned += 1
        miss, nums = gloss.missing(en, t), numbers_missing(en, t, lang, max_spelled)
        if miss or nums:
            rows.append({"h": h, "en": en, "current": t, "file": rel(path), "expected": miss, "numbers_missing": nums})
        elif max_spelled and numbers_missing(en, t, lang, 0):
            extra += 1   # would be flagged by --max-spelled=0: only numbers up to the limit are missing
    return rows, scanned, extra


def split_two(rows):
    """(first, second, how). Hash range when the files' hash ranges do not overlap, else whole files, greedy by size (largest first)."""
    if not rows:
        return [], [], "empty"
    by_file = {}
    for r in rows:
        by_file.setdefault(r["file"], []).append(r)
    hs = sorted(r["h"] for r in rows)
    ranges = sorted((min(x["h"] for x in v), max(x["h"] for x in v), f) for f, v in by_file.items())
    if all(ranges[i][1] < ranges[i + 1][0] for i in range(len(ranges) - 1)):
        cut = hs[len(hs) // 2]
        return [r for r in rows if r["h"] < cut], [r for r in rows if r["h"] >= cut], f"hash range (cut {cut})"
    order = sorted(by_file, key=lambda f: ("/ui" in f or f.startswith("build/"), f))   # the part files in order, then the ui files
    best = min(range(1, len(order)), key=lambda i: abs(sum(len(by_file[f]) for f in order[:i]) * 2 - len(rows))) if len(order) > 1 else 1
    first = [r for f in order[:best] for r in by_file[f]]
    second = [r for f in order[best:] for r in by_file[f]]
    return first, second, "by file (a file's hashes span the range, so a hash cut would share files): " + f"{os.path.basename(order[0])} .. {os.path.basename(order[best - 1])} | {os.path.basename(order[best]) if best < len(order) else '-'} .."


def write_queue(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        for r in sorted(rows, key=lambda r: r["h"]):
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main(argv):
    ui_all, write = "--ui-all" in argv, "--no-write" not in argv
    max_spelled = int(next((a.split("=", 1)[1] for a in argv if a.startswith("--max-spelled=")), 10))
    src, summary = load_src(), {}
    for lang in LANGS:
        with open(os.path.join(I18N, f"glossary-{lang}.json"), encoding="utf-8") as f:
            gloss = Glossary(lang, json.load(f))
        eff, shadowed = effective(lang, src)
        rows, scanned, extra = check(lang, gloss, eff, ui_all, max_spelled)
        a, b, how = split_two(rows)
        if write:
            write_queue(os.path.join(I18N, f"fix-gloss-{lang}-1.jsonl"), a)
            write_queue(os.path.join(I18N, f"fix-gloss-{lang}-2.jsonl"), b)
        files = {}
        for r in rows:
            files[r["file"]] = files.get(r["file"], 0) + 1
        summary[lang] = {
            "effective_translations": len(eff), "checked": scanned, "shadowed_overridden": shadowed, "flagged": len(rows), "extra_if_max_spelled_0": extra,
            "terms_only": sum(1 for r in rows if r["expected"] and not r["numbers_missing"]),
            "numbers_only": sum(1 for r in rows if r["numbers_missing"] and not r["expected"]),
            "both": sum(1 for r in rows if r["expected"] and r["numbers_missing"]),
            "queue_1": len(a), "queue_2": len(b), "split": how, "by_file": dict(sorted(files.items())),
        }
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
