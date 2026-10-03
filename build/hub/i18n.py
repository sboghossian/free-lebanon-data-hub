"""UI strings for EN / AR / FR.
build/i18n/ui.json (and ui_<tab>.json, one per tab plugin) map the English string to its translations: {"English text": {"ar": "...", "fr": "..."}}.
The English text is the key; "en" may be repeated in the value. At runtime t(en) looks up sha1(en)[:12]. This module collects every English string the page can show:
  - the text nodes and the placeholder, aria-label, title and alt attributes of the static markup,
  - every literal given to t(), tH(), tp() and N() in the JS parts,
  - the data vocabulary (event types, ranked areas, ruler offices),
and reports the ones that have no AR or FR translation. `python3 build/hub/i18n.py` runs the check on its own (exit 1 when something is missing)."""
import glob, json, os, re, sys
from html.parser import HTMLParser
from hub.lib import sha12, norm_ws

LATIN = re.compile(r"[A-Za-z]{2}")
ATTRS = ("placeholder", "aria-label", "title", "alt")


def load_ui(build_dir):
    ui = {}
    files = [os.path.join(build_dir, "i18n", "ui.json")] + sorted(glob.glob(os.path.join(build_dir, "i18n", "ui_*.json")))
    for p in files:
        if not os.path.exists(p):
            continue
        for en, v in json.load(open(p, encoding="utf-8")).items():
            if en.startswith("_"):
                continue
            ui.setdefault(en, {}).update({k: x for k, x in v.items() if k in ("ar", "fr") and x})
    return ui


class _Static(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.notr = [], 0, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "textarea"):
            self.skip += 1
        if tag not in ("br", "img", "input", "meta", "link", "hr", "path", "line", "rect", "circle"):
            self.notr.append("data-notr" in a or bool(self.notr and self.notr[-1]))
        if not (self.notr and self.notr[-1]):
            for k in ATTRS:
                if k in a and a[k] and LATIN.search(a[k]):
                    self.out.append(a[k])

    def handle_endtag(self, tag):
        if tag in ("script", "style", "textarea"):
            self.skip -= 1
        elif self.notr and tag not in ("br", "img", "input", "meta", "link", "hr", "path", "line", "rect", "circle"):
            self.notr.pop()

    def handle_data(self, data):
        if self.skip or (self.notr and self.notr[-1]):
            return
        if LATIN.search(data):
            self.out.append(norm_ws(data))


def static_strings(html):
    """Strings of the markup the page ships (not of what scripts render later). Text nodes are normalised like the JS walker does."""
    body = html.split("<body", 1)[-1]
    p = _Static()
    p.feed(body)
    return [s for s in p.out if s and not re.match(r"^[a-z]+:\S+( [a-z]+:\S+)*$", s)]   # search-query examples (president:Chehab) are not translated


_LIT = r"""(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`$\\]*)`)"""
_CALL = re.compile(r"(?<![\w$.])(t|tH|N)\(\s*" + _LIT)
_TP = re.compile(r"(?<![\w$.])tp[H]?\(\s*" + _LIT + r"\s*,\s*" + _LIT)


def _unesc(s):
    return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t", "u": "\\u"}.get(m.group(1), m.group(1)), s)


def js_strings(js_parts):
    """Literals in t('..'), tH('..'), N('..') and both literals of tp('..', '..', n) and tpH(..). Returns (strings, problems): a template literal with ${} is a problem."""
    out, bad = [], []
    for name, src in js_parts:
        for m in _CALL.finditer(src):
            s = next(g for g in m.groups()[1:] if g is not None)
            out.append(_unesc(s))
        for m in _TP.finditer(src):
            g = m.groups()
            out.append(_unesc(next(x for x in g[0:3] if x is not None)))
            out.append(_unesc(next(x for x in g[3:6] if x is not None)))
        for m in re.finditer(r"(?<![\w$.])(?:t|tH|N)\(\s*`[^`]*\$\{", src):
            bad.append(f"{name}: template literal with ${{}} inside t(): {src[m.start():m.start() + 70]!r}")
    return out, bad


TYPE_W = {"un_resolution": "UN resolution", "tech_launch": "tech launch", "ai": "AI", "life": "life in Lebanon"}


def data_vocab(d):
    """English words the UI shows from data values: event types, ranked areas, ruler offices, confidence words."""
    v = set()
    for e in d["events"]:
        for t in (e.get("ty") or []):
            v.add(TYPE_W.get(t) or t.replace("_", " "))
        if "life" in (e.get("lanes") or []):
            v.add("life in Lebanon")
        a = e.get("ag")
        if a and a.get("k"):
            v.add(TYPE_W.get(a["k"]) or a["k"].replace("_", " "))
    for r in d["ranked"]:
        if r.get("area"):
            v.add(r["area"])
    for o in d["offices"]:
        if str(o[0]).startswith("R:"):
            v.add(str(o[0])[2:])
    v.update(["verified", "reported", "inference"])
    return sorted(v)


def needed(html, js_parts, d):
    st, bad = js_strings(js_parts)
    return sorted(set(static_strings(html)) | set(st) | set(data_vocab(d))), bad


def report(strings, ui):
    miss_ui = [s for s in strings if s not in ui]
    miss_tr = [(s, l) for s in strings if s in ui for l in ("ar", "fr") if not ui[s].get(l)]
    return miss_ui, miss_tr


def lang_tables(strings, ui):
    """{lang: {sha12(en): translation}} for the strings the page can show, embedded in the page so the UI switches without a fetch."""
    return {l: {sha12(s): ui[s][l] for s in strings if s in ui and ui[s].get(l)} for l in ("ar", "fr")}


def content_translations(lang, research, live_hashes, src_hashes):
    """Assemble research/i18n/<lang>/part-*.jsonl ({"h", "t"}) into {hash: translation}. A hash that is neither in the source strings nor in
    the live data is stale and dropped; strings with no translation are simply absent, and the page falls back to English with a marker."""
    out, stale, n = {}, 0, 0
    for p in sorted(glob.glob(os.path.join(research, "i18n", lang, "part-*.jsonl"))):
        for line in open(p, encoding="utf-8"):
            try:
                r = json.loads(line)
            except ValueError:
                continue
            n += 1
            h, t = r.get("h"), r.get("t")
            if not h or not isinstance(t, str) or not t.strip():
                continue
            if h not in src_hashes and h not in live_hashes:
                stale += 1
                continue
            out[h] = t
    return out, {"read": n, "kept": len(out), "stale": stale}


if __name__ == "__main__":
    sys.exit("run it through build_timeline.py (it needs the built page); `python3 build_timeline.py` prints MISSING UI STRING lines")
