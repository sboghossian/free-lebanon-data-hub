"""Lebanon gazetteer: transliteration-tolerant normalisation and place lookup.

    from gazetteer import normalize, lookup
    lookup("Ayta ash Shab", district="Bint Jbeil")

Data: research/geo/gazetteer.jsonl (built by research/geo/build_gazetteer.py).
Pure standard library.
"""
import json
import os
import re
import unicodedata
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
GAZETTEER_PATH = os.path.join(HERE, "..", "research", "geo", "gazetteer.jsonl")

# ---------------------------------------------------------------- normalisation

ARTICLES = {"el", "al", "ar", "as", "ash", "ad", "an", "at", "az", "ez", "es", "ed", "en", "er",
            "et", "ech", "esh", "eth", "edh", "ezz", "ezzi", "l", "the", "of"}
QUALIFIERS = {"town", "village", "city", "camp", "refugee", "district", "area", "suburb", "suburbs",
              "neighbourhood", "neighborhood", "municipality", "region", "governorate", "caza",
              "mukhayyam", "mukhaiam", "kaza", "qada", "qadaa", "locality", "of", "the"}
# glued prefixes that get split off: kfarchouba -> kfar chouba
GLUE_PREFIXES = ("kfar", "kafr", "kefr", "deir", "dayr", "beit", "bayt", "burj", "bourj", "borj",
                 "jabal", "jebel", "khirbet", "khirbat", "tell")
# token-level canonical forms, applied AFTER the character rules below
TOKEN_GROUPS = {
    "kfr": "kfar kafr kefr kfr kefar kafar kefer kfer kfir kifr kfur kfour",
    "dir": "dair der dir dayr dar",
    "bnt": "bint bent bnt bnat",
    "jbl": "jabal jebel jbel jbal jabel jebal jbl jebl",
    "tl": "tel tal tl tell tall",
    "tlt": "talet telet tilat tallet tellet",
    "bit": "bait bet bit bayt",
    "brj": "burj borj bordj brj burg",
    "khrb": "khirbit khirbat khirbet khurbat khorbet kherbet khirbi khurbit khirba khorba khirb khurb",
    "hrt": "hart hrat hirit harit harat hirat hrit hrt hara",
    "ain": "ain ein ayn aain",
    "ksr": "kasr ksar ksr kaser kasir",
    "nhr": "nahr nahar nehr nahir nhr",
    "wad": "wad ued wadi wadie",
    "hush": "hush hawsh hosh haush hush",
    "mrj": "marj merj marg mrj",
    "abd": "abdel abdul abdal abd",
}
TOKEN_MAP = {v: k for k, vs in TOKEN_GROUPS.items() for v in vs.split()}
# whole-name aliases (exonyms and old names); keys/values are written naturally, normalised at import
CITY_ALIAS_GROUPS = [
    ["Sour", "Tyre", "Sur"],
    ["Saida", "Sidon", "Sayda", "Saidon"],
    ["Tripoli", "Trablus", "Tarablus", "Trablous", "Tarabulus"],
    ["Jbeil", "Byblos", "Jubayl", "Jubail", "Gebal"],
    ["Baalbek", "Baalbeck", "Baalbak", "Balbek", "Heliopolis"],
    ["Bekaa", "Beqaa", "Biqa", "Bika", "Bekaa Valley"],
    ["Zahle", "Zahleh", "Zahlah"],
    ["Marjayoun", "Marjeyoun", "Marjuyun", "Marj Uyun", "Merjayoun"],
    ["Bsharri", "Bcharre", "Bsherri", "Bsharre", "Becharre"],
    ["Hasbaya", "Hasbaiya", "Hasbayya", "Hasbeya"],
    ["Rachaya", "Rashaya", "Rashayya", "Rashaiya"],
    ["Metn", "Matn", "El Meten", "Meten", "Al Matn"],
    ["Keserwan", "Kesrwane", "Kisrawan", "Kesrouane", "Kisrwan"],
    ["Chouf", "Shouf", "Shuf"],
    ["Western Bekaa", "West Bekaa", "West Beqaa", "Bekaa Gharbi"],
    ["Minieh-Dennie", "Minieh-Danniyeh", "Minyeh-Dinniyeh", "Miniyeh Dinniyeh"],
    ["South", "South Lebanon", "South Governorate", "Janub"],
    ["North", "North Lebanon", "North Governorate", "Shamal"],
    ["Mount Lebanon", "Jabal Lubnan", "Jebel Loubnan"],
    ["Nabatieh", "Nabatiyeh", "Nabatiye", "Nabatiya", "Nabatieh Governorate"],
    ["Dahieh", "Dahiyeh", "Dahiya", "Dahiyah", "Dahiye", "Beirut Southern Suburbs", "Southern Suburbs"],
]


def _fold(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("ı", "i").replace("ß", "ss").replace("œ", "oe").replace("ø", "o")


_AR_RE = re.compile(r"[؀-ۿ]")
_AR_MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def is_arabic(s):
    return bool(_AR_RE.search(s or ""))


def _normalize_ar(s):
    s = _AR_MARKS.sub("", s)
    s = re.sub("[أإآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^ء-ي\s]", " ", s)
    toks = [t for t in s.split() if t]
    toks = [t[2:] if (t.startswith("ال") and len(t) > 4) else t for t in toks]
    toks = [t for t in toks if t != "ال"]
    return " ".join(toks)


def _tokens(s):
    s = _fold(s).lower()
    s = re.sub(r"[-_/.,;:()\[\]\"–—]", " ", s)
    s = re.sub(r"[‘’ʻʼʿʾ′`´']", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = s.split()
    out = []
    for t in toks:
        for p in GLUE_PREFIXES:
            if t.startswith(p) and len(t) - len(p) >= 3 and t != p:
                out.extend([p, t[len(p):]])
                break
        else:
            out.append(t)
    return out


def _char_rules(t):
    """Per-token transliteration folding. Order matters."""
    t = re.sub(r"^ou(?=[aei])", "w", t)          # ouadi -> wadi
    t = t.replace("sch", "sh").replace("tch", "sh")
    t = t.replace("ch", "sh").replace("ck", "k").replace("th", "t").replace("dh", "d")
    t = t.replace("q", "k").replace("c", "k")
    t = t.replace("ou", "u").replace("oo", "u").replace("ee", "i")
    t = t.replace("y", "i")
    t = re.sub(r"(ai|ei|ae)", "ai", t)
    t = re.sub(r"(.)\1+", r"\1", t)              # collapse double letters
    t = t.replace("e", "i").replace("o", "u")
    t = re.sub(r"(.)\1+", r"\1", t)
    return t


def _strip_end(t):
    if len(t) <= 3:
        return t
    while len(t) > 3 and (t[-1] in "aeiu" or (t[-1] == "h" and t[-2] in "aeiu")):
        t = t[:-2] if t[-1] == "h" else t[:-1]
    return t


def _norm_tokens(name):
    out = []
    for t in _tokens(name):
        t = {"oued": "wadi", "ouad": "wadi"}.get(t, t)
        if t in ARTICLES:
            out.append("\x00" + t)               # tentative article, dropped below if other tokens remain
            continue
        c = _char_rules(t)
        c = TOKEN_MAP.get(c, TOKEN_MAP.get(t, c))
        out.append(c if c in TOKEN_GROUPS else _strip_end(c))
    real = [x for x in out if not x.startswith("\x00")]
    if not real:
        real = [x[1:] for x in out]
    return real


_ALIAS = {}


def normalize(name, drop_qualifiers=False):
    """Canonical comparison key for a Lebanese place name (Latin or Arabic)."""
    if not name:
        return ""
    if is_arabic(name):
        return _normalize_ar(name)
    toks = _norm_tokens(name)
    if drop_qualifiers:
        q = {_char_rules(x) for x in QUALIFIERS}
        kept = [t for t in toks if t not in q and t not in QUALIFIERS]
        toks = kept or toks
    key = " ".join(toks)
    return _ALIAS.get(key, key)


def skeleton(key):
    """Consonant skeleton of a normalised key (vowels, w, y dropped); '' if too short to be selective."""
    toks = []
    for t in key.split():
        if t in TOKEN_GROUPS:
            toks.append(t)
            continue
        s = re.sub(r"[aeiouwy]", "", t)
        s = re.sub(r"(.)\1+", r"\1", s)
        if s:
            toks.append(s)
    sk = " ".join(toks)
    return sk if len(sk.replace(" ", "")) >= 3 else ""


for _g in CITY_ALIAS_GROUPS:
    _canon = " ".join(_norm_tokens(_g[0]))
    for _n in _g:
        _ALIAS[" ".join(_norm_tokens(_n))] = _canon


# ---------------------------------------------------------------- lookup

KIND_WEIGHT = {"city": 1.0, "town": 1.0, "village": 1.0, "locality": 0.99, "neighbourhood": 0.99,
               "camp": 0.99, "area": 0.96, "mountain": 0.94, "river": 0.92, "other": 0.9}
POPULATED = {"city", "town", "village", "locality", "neighbourhood", "camp"}

_DATA = {}


DISTRICT_EXTRA = {"Zahrani": "Saida", "Zahrani District": "Saida", "Nabatieh Governorate": "El Nabatieh",
                  "Bekaa Governorate": "Bekaa", "Akkar Governorate": "Akkar", "Beirut Governorate": "Beirut"}


def _district_keys(d):
    for k, v in DISTRICT_EXTRA.items():            # districts that COD-AB folded into a neighbour
        if normalize(d) == normalize(k):
            d = v
    k = normalize(d)
    return {k, skeleton(k)} - {""}


class Index:
    def __init__(self, records):
        self.records = records
        self.by_key, self.by_skel, self.by_tri = {}, {}, {}
        self.forms = []                      # per record: [(key, is_primary)]
        self.dist = []                       # per record: set of district/governorate keys
        self.by_dist = {}
        for i, r in enumerate(records):
            forms, seen = [], set()
            for j, n in enumerate([r["name"]] + list(r.get("alt") or [])):
                k = normalize(n)
                if k and k not in seen:
                    seen.add(k)
                    forms.append((k, j == 0))
            self.forms.append(forms)
            for k, prim in forms:
                self.by_key.setdefault(k, []).append((i, prim))
                if not is_arabic(k):
                    sk = skeleton(k)
                    if sk:
                        self.by_skel.setdefault(sk, []).append((i, prim))
                    for t in {k[x:x + 3] for x in range(max(1, len(k) - 2))}:
                        self.by_tri.setdefault(t, set()).add(i)
            ds = set()
            for f in (r.get("adm2"), r.get("adm1")):
                if f:
                    ds |= _district_keys(f)
            self.dist.append(ds)
            for d in ds:
                self.by_dist.setdefault(d, []).append(i)


def load(path=None):
    path = os.path.abspath(path or GAZETTEER_PATH)
    if path not in _DATA:
        with open(path, encoding="utf-8") as f:
            _DATA[path] = Index([json.loads(l) for l in f if l.strip()])
    return _DATA[path]


def known_district(district):
    """True if the district/governorate name is recognised (any spelling) by the gazetteer."""
    return bool(_district_keys(district) & set(load().by_dist))


def _query_forms(name, alts):
    forms = {}
    for n in [name] + list(alts or []):
        if not n:
            continue
        cands = [(n, 1.0)]
        base = re.split(r"[,(]", n)[0].strip()
        if base and base != n:
            cands.append((base, 0.97))
        for c, w in cands:
            k = normalize(c)
            if k:
                forms[k] = max(forms.get(k, 0), w)
            if not is_arabic(c):
                k2 = normalize(c, drop_qualifiers=True)
                if k2 and k2 != k:
                    forms[k2] = max(forms.get(k2, 0), 0.95 * w)
    return forms


def _score(qk, rk):
    if qk == rk:
        return 1.0, "exact"
    if is_arabic(qk) or is_arabic(rk):
        return 0.0, ""
    qs, rs = skeleton(qk), skeleton(rk)
    if qs and qs == rs:
        return 0.86, "skeleton"
    if len(qk) >= 5 and len(rk) >= 5:
        r = SequenceMatcher(None, qk, rk).ratio()
        if r >= 0.88 and qs[:1] == rs[:1]:
            return 0.5 + 0.35 * r, "fuzzy"
    return 0.0, ""


def lookup(name, alts=(), district=None, kinds=None, limit=5, min_score=0.6, index=None):
    """Candidate places for a name (plus alternative spellings), best first.

    district: a caza/governorate name in any spelling. When given, only places inside it are returned
    (an unrecognised district returns []). kinds: optional set of kinds to keep.
    Returns [{"score", "how", "place"}]; score 1.0 = same normalised name, ~0.86 = same consonant
    skeleton, <0.86 = fuzzy.
    """
    ix = index or load()
    qf = _query_forms(name, alts)
    if not qf:
        return []
    allowed = None
    if district:
        ks = _district_keys(district)
        allowed = set()
        for k in ks:
            allowed |= set(ix.by_dist.get(k, ()))
        if not allowed:
            return []
    cand = set()
    for qk in qf:
        cand.update(i for i, _ in ix.by_key.get(qk, ()))
        sk = skeleton(qk)
        if sk:
            cand.update(i for i, _ in ix.by_skel.get(sk, ()))
        if allowed is not None:
            cand.update(allowed)             # small set: allow fuzzy over the whole district
        elif len(qk) >= 5:
            tris = [qk[x:x + 3] for x in range(len(qk) - 2)]
            hits = {}
            for t in tris:
                for i in ix.by_tri.get(t, ()):
                    hits[i] = hits.get(i, 0) + 1
            need = max(2, int(0.6 * len(tris)))
            cand.update(i for i, h in hits.items() if h >= need)
    if allowed is not None:
        cand &= allowed
    out = []
    for i in cand:
        r = ix.records[i]
        if kinds and r["kind"] not in kinds:
            continue
        best, how = 0.0, ""
        for rk, prim in ix.forms[i]:
            for qk, qw in qf.items():
                s, h = _score(qk, rk)
                s *= qw * (1.0 if prim else 0.98)
                if s > best:
                    best, how = s, h
        if best <= 0:
            continue
        best *= KIND_WEIGHT.get(r["kind"], 0.9)
        if best >= min_score:
            out.append({"score": round(best, 4), "how": how, "place": r})
    out.sort(key=lambda c: (-c["score"], -(c["place"].get("pop") or 0), c["place"]["name"]))
    return out[:limit]


def similarity(a, b):
    """Name-to-name score (0..1) using the same rules as lookup, no data needed."""
    best = 0.0
    for qk, qw in _query_forms(a, ()).items():
        for rk, rw in _query_forms(b, ()).items():
            best = max(best, _score(qk, rk)[0] * min(qw, rw))
    return round(best, 4)
