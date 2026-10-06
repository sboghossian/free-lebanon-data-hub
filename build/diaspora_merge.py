"""Merge the Lebanese-abroad research files into research/hub/companies/diaspora.jsonl (re-runnable).

Inputs (the press file may be absent or grow later):
  research/hub/companies/diaspora-wikidata.jsonl   Wikidata (CC0), one row per (company, person, role)
  research/hub/companies/diaspora-press.jsonl      press rows (facts only); same fields, plus "sources" (list of URLs) or "source"
Every Wikidata row is checked against the person's English Wikipedia article (MediaWiki API, cached under cache/diaspora-wp/):
  born_in_lebanon  the article says the person was born in a place in Lebanon
  lebanese_citizen the article calls the person Lebanese (nationality) or says Lebanese citizenship
  lebanese_descent "of Lebanese descent", Lebanese-American and similar, Lebanese parents
  none of these, or no Lebanon/Lebanese in the article: the row is dropped (diaspora-dropped.tsv, with the reason).
Rows whose person or company matches the private-terms list are dropped with reason "name guard" (never printed).
Output rows keep every source URL in "sources", plus origin, origin_quote (<= 20 words) and origin_source (article URL).
Run: python3 build/diaspora_merge.py [--offline]   (offline: use only cached articles; uncached rows are dropped as "article not fetched")
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
CO = os.path.join(ROOT, "research", "hub", "companies")
CACHE = os.path.join(ROOT, "cache", "diaspora-wp")
UA = "LebanonHub/1.0 (research)"
ORIGINS = ("born_in_lebanon", "lebanese_citizen", "lebanese_descent")
# A hyphenated "Lebanese-Swiss" / "Lebanese-American" says neither birthplace nor nationality nor descent: shown as "described as Lebanese"
HYPHEN_ONLY = re.compile(r"\bLebanese[- ](?:[A-Z][a-z]+-?)+")
DESCENT_WORDS = re.compile(r"descent|origin|ancestry|heritage|extraction|roots|parentage|\b(?:son|daughter|child|grandson|granddaughter) of\b|parents|immigrants?", re.I)
NAME_FIX = {"Saad Harirị": "Saad Hariri"}   # stray combining character in the Wikidata label
PLACES = ("Lebanon", "Beirut", "Zahle", "Zahlé", "Sidon", "Saida", "Tyre", "Byblos", "Jbeil", "Jounieh", "Baalbek", "Batroun", "Aley", "Bsharri", "Bcharre", "Zgharta", "Metn", "Matn", "Keserwan", "Kesrouan",
          "Nabatieh", "Mount Lebanon", "Bhamdoun", "Chouf", "Shouf", "Broummana", "Deir el Qamar", "Dayr al-Qamar", "Jezzine", "Hasbaya", "Rashaya", "Bint Jbeil", "Marjayoun", "Akkar", "Ghazir", "Bikfaya", "Ain Zhalta", "Beit Mery", "Dhour el Choueir")
KIN = re.compile(r"\b(father|mother|parents?|grandfather|grandmother|grandparents?|wife|husband|brother|sister|son|daughter|uncle|aunt|cousin|ancestors?|family)\b", re.I)
_last = [0.0]


STOP = {"inc", "ltd", "llc", "plc", "sa", "ag", "gmbh", "corp", "corporation", "company", "co", "group", "holding", "holdings", "the"}


def norm(s):
    return " ".join(w for w in re.sub(r"[^a-z0-9]+", " ", (s or "").lower().replace("&", " and ")).split() if w not in STOP)


def api(url, tries=6):
    wait = 4
    for i in range(tries):
        dt = time.time() - _last[0]
        if dt < 0.6:
            time.sleep(0.6 - dt)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(float(e.headers.get("Retry-After") or wait)); wait = min(wait * 2, 90); continue
            raise
        except (urllib.error.URLError, TimeoutError, ValueError):
            time.sleep(wait); wait = min(wait * 2, 90)
    return None


def _cpath(name):
    return os.path.join(CACHE, re.sub(r"[^A-Za-z0-9_.-]", "_", name) + ".json")


def _cget(name):
    try:
        return json.load(open(_cpath(name), encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _cput(name, obj):
    os.makedirs(CACHE, exist_ok=True)
    json.dump(obj, open(_cpath(name), "w", encoding="utf-8"), ensure_ascii=False)


def enwiki_titles(qids, offline):
    """QID -> English Wikipedia title (None when the person has no article)."""
    out, need = {}, []
    for q in qids:
        c = _cget("sitelink-" + q)
        if c is not None:
            out[q] = c.get("title")
        else:
            need.append(q)
    if offline:
        return out
    for i in range(0, len(need), 40):
        chunk = need[i:i + 40]
        j = api("https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&sitefilter=enwiki&format=json&ids=" + "|".join(chunk))
        if not j:
            continue
        for q in chunk:
            e = (j.get("entities") or {}).get(q) or {}
            t = ((e.get("sitelinks") or {}).get("enwiki") or {}).get("title")
            _cput("sitelink-" + q, {"title": t}); out[q] = t
    return out


def article(title, offline):
    c = _cget("wp-" + title)
    if c is not None or offline:
        return c
    j = api("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=" + urllib.parse.quote(title))
    if not j:
        return None
    pg = list((j.get("query") or {}).get("pages", {}).values())
    if not pg or "missing" in pg[0]:
        return None
    c = {"title": pg[0].get("title", title), "text": pg[0].get("extract") or ""}
    _cput("wp-" + title, c)
    return c


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z\"(])|\n+", text) if s.strip()]


RELIG = re.compile(r"\b(?:Christian|Christians|Maronite|Maronites|Jewish|Jew|Muslim|Muslims|Druze|Orthodox|Catholic|Sunni|Shia|Shi'?ite|Sephardic|Melkite|Armenian Apostolic|Protestant)\b", re.I)


def quote(sent, m):
    """The evidence only: at most 20 words around the match (no religion, no more family detail than the match itself)."""
    w = sent.split()
    pre = len(sent[:m.start()].split())
    n = len(m.group(0).split())
    a = max(0, pre - 4)
    seg = w[a:min(len(w), pre + n + 4)][:20]
    for i, x in enumerate(seg[:6]):
        if ")" in x and "(" not in " ".join(seg[:i + 1]):
            seg = seg[i + 1:]; break                      # the window started inside a parenthesis of dates
    for i, x in enumerate(seg):
        if RELIG.search(x):
            seg = seg[:i]                                 # cut before any religion word
            while seg and seg[-1].lower().strip(",;") in ("a", "an", "the", "of", "to", "in", "and", "family", "his", "her", "their", "from", "into", "is", "was", "are"):
                seg.pop()
            break
    while seg and seg[-1].lower().strip(",;") in ("is", "was", "his", "her", "family", "a", "an", "the", "of", "to", "and"):
        seg.pop()
    return " ".join(seg).strip(" ,;")


PLACE_RE = "|".join(re.escape(p) for p in PLACES)
GAP = r"(?:(?!raised|moved|grew|brought|educated|lived|studied|returned)[^.;]){0,50}?"
BORN = re.compile(r"\b(?:[Bb]orn|b\.)\b(?: and (?:raised|brought up|educated))?" + GAP + r"\b(?:in|at|near)\s+(?:the\s+)?(?:[A-Z][^\s,.;()]*(?:\s|,\s*)){0,3}?\(?(" + PLACE_RE + r")\b|\b[Bb]orn in Lebanon\b|\bnative of (?:" + PLACE_RE + r")\b")
LEB_BORN = re.compile(r"\bLebanese-born\b", re.I)
CITIZEN = re.compile(r"\bLebanese (?:citizen|citizenship|national|nationality|passport)\b|\b(?:citizen|national) of Lebanon\b|\b(?:is|was|as) an? (?:[A-Za-z]+,? ){0,4}Lebanese(?![- ](?:American|Canadian|Brazilian|Mexican|French|British|Australian|Swiss|Armenian|Argentine|Colombian|Venezuelan|Swedish|German|Italian|Spanish|Nigerian|Ghanaian))\b(?!-)|\bLebanese (?:businessman|businesswoman|entrepreneur|billionaire|executive|investor|banker|tycoon|industrialist|magnate|publisher|producer|singer|rapper|engineer|financier|film|record|media)\b", re.I)
DESCENT = re.compile(r"\b(?:of|with|from) (?:partial |part |mixed |full |paternal |maternal )?Lebanese (?:descent|origin|ancestry|heritage|extraction|roots|parentage|background)\b|\bLebanese[- ](?:American|Canadian|Brazilian|Mexican|French|British|Australian|Swiss|Armenian|Argentine|Argentinian|Colombian|Venezuelan|Swedish|German|Italian|Spanish|Nigerian|Ghanaian|Palestinian|Egyptian|Syrian|Emirati|Kuwaiti|Saudi|Cypriot|Greek|Turkish|Danish|Dutch|Belgian|English|Scottish|Irish|Cuban|Chilean|Ecuadorian|Peruvian|Uruguayan)\b|\b(?:American|Canadian|Brazilian|Mexican|French|British|Australian|Swiss|Argentine|Colombian|Venezuelan|Swedish|German|Italian|Spanish|Nigerian|Ghanaian)-Lebanese\b|\bLebanese (?:parents|father|mother|immigrants?|family|grandparents?|grandfather|grandmother|ancestry|ancestors?)\b|\b(?:parents|father|mother|family|grandparents?) (?:were|was|are|is) (?:both )?(?:\w+ ){0,3}Lebanese\b|\b(?:Christians?|Maronites?|Muslims?|Druze|families|family|parents|father|mother|immigrants?) (?:\\w+ ){0,2}from Lebanon\b|\b(?:sons?|daughters?|children|child|grandsons?|granddaughters?) of (?:the )?(?:\\w+ ){0,2}Lebanese-born\b|\b(?:emigrated|immigrated|migrated) from (?:" + PLACE_RE + r")\b", re.I)


def classify(text):
    """-> (origin, sentence, match) or (None, reason). Born beats citizen beats descent."""
    if not re.search(r"Leban", text):
        return None, "article does not mention Lebanon or Lebanese", None
    sents = sentences(text)
    head = sents
    found = {}
    for s in sents:
        if KIN.search(re.sub(r"^.*?\bborn\b", "", s, count=1)) and "born" in s and re.search(r"\b(?:father|mother|parents?|grandfather|grandmother|wife|husband|son|daughter|brother|sister|uncle)\b[^.]{0,40}\bborn\b", s, re.I):
            continue                                  # a relative was born there, not the person
        for key, rx, pool in (("born_in_lebanon", BORN, head), ("lebanese_citizen", CITIZEN, sents), ("lebanese_descent", DESCENT, sents)):
            if key in found or s not in pool:
                continue
            m = rx.search(s)
            if key == "born_in_lebanon" and not m:
                lb = LEB_BORN.search(s)
                if lb and not re.search(r"\b(?:of|to|and|his|her|their)\s+(?:the\s+)?(?:\w+\s+){0,2}$", s[:lb.start()], re.I) and not KIN.search(s[max(0, lb.start() - 40):lb.start()]):
                    m = lb
            if m and key == "born_in_lebanon" and KIN.search(s[:m.start() + 4]):
                m = None                                  # "his father, X, was born in Beirut": a relative, not the person
            if m and not re.search(r"Leban|" + PLACE_RE, quote(s, m)):
                m = None                                  # the clipped quote would not show the evidence (religion cut it off)
            if m:
                if key == "born_in_lebanon" and "Tripoli" in s and "Lebanon" not in s:
                    continue
                found[key] = (s, m)
    for k in ORIGINS:
        if k in found:
            return k, found[k][0], found[k][1]
    return None, "article mentions Lebanon or Lebanese but does not state the person's origin", None


def jl(path):
    if not os.path.exists(path):
        return []
    out = []
    for l in open(path, encoding="utf-8"):
        l = l.strip()
        if l:
            try:
                out.append(json.loads(l))
            except ValueError:
                pass
    return out


def srcs(r):
    s = list(r.get("sources") or [])
    for k in ("source", "company_source", "role_source", "wikipedia", "company_url_source"):
        if r.get(k):
            s.append(r[k])
    return [u for u in dict.fromkeys(s) if isinstance(u, str) and u.startswith("http")]


def main(offline=False):
    wd = jl(os.path.join(CO, "diaspora-wikidata.jsonl"))
    press = jl(os.path.join(CO, "diaspora-press.jsonl"))
    guard = None
    try:
        import privacy
        guard = privacy.pattern()
    except Exception:
        pass
    dropped, kept = [], {}
    titles = enwiki_titles(sorted({r["person_qid"] for r in wd if r.get("person_qid")}), offline)
    for r in wd:
        who, co = r.get("person") or "", r.get("company") or ""
        q = r.get("person_qid")
        t = titles.get(q)
        if not t:
            dropped.append((co, who, "no English Wikipedia article to verify the origin (or not fetched)")); continue
        a = article(t, offline)
        if not a:
            dropped.append((co, who, "article not fetched")); continue
        origin, s, m = classify(a["text"])
        if not origin:
            dropped.append((co, who, s)); continue
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(a["title"].replace(" ", "_"))
        row = {k: r.get(k) for k in ("company", "company_ar", "company_fr", "company_qid", "company_url", "hq_country_iso3", "hq_city", "founded", "industry", "kind", "status", "person", "person_qid", "role", "role_years")}
        if origin == "lebanese_descent" and HYPHEN_ONLY.search(quote(s, m)) and not DESCENT_WORDS.search(quote(s, m)):
            origin = "described_lebanese"
        row.update({"origin": origin, "origin_quote": quote(s, m), "origin_source": url, "wikidata_origin": r.get("origin"),
                    "sources": list(dict.fromkeys([r.get("source"), r.get("origin_source"), r.get("wikipedia"), url] + srcs(r))), "license": "CC0 1.0 (Wikidata); article facts only"})
        row["sources"] = [u for u in row["sources"] if u]
        kept[(norm(co), norm(who))] = row
    for r in press:
        who, co = r.get("person") or "", r.get("company") or ""
        o = {"lebanese": "described_lebanese"}.get(r.get("origin"), r.get("origin"))   # the source says "Lebanese" with no detail
        r = dict(r, origin=o, industry=r.get("industry") or r.get("sector"),
                 hq_city=None, founded=None, status=None)   # press rows: city, founding year and status were not checked against the source, so they are not published
        if o not in ORIGINS + ("described_lebanese",) or not srcs(r) or not (r.get("origin_source") or srcs(r)):
            dropped.append((co, who, "press row without a valid origin or source URL")); continue
        if not r.get("hq_country_iso3") or r.get("hq_country_iso3") == "LBN":
            dropped.append((co, who, "headquarters not outside Lebanon")); continue
        row = {k: r.get(k) for k in ("company", "company_ar", "company_fr", "company_qid", "company_url", "hq_country_iso3", "hq_city", "founded", "industry", "kind", "status", "person", "person_qid", "role", "role_years", "origin", "origin_quote", "origin_source")}
        row["origin_source"] = r.get("origin_source") or srcs(r)[0]
        row["sources"] = srcs(r) + ([row["origin_source"]] if row["origin_source"] not in srcs(r) else [])
        row["license"] = r.get("license") or "Facts only, with attribution (press sources state no licence)"
        k = (norm(co), norm(who))
        if k in kept:                          # same company and person in Wikidata: merge the source URLs, fill empty fields, keep the Wikipedia-verified origin
            w = kept[k]
            w["sources"] = list(dict.fromkeys(w["sources"] + row["sources"]))
            for f, v in row.items():
                if f not in ("sources", "origin", "origin_quote", "origin_source", "license") and w.get(f) in (None, "") and v not in (None, ""):
                    w[f] = v
        else:
            kept[k] = row
    for row in kept.values():
        row["person"] = NAME_FIX.get(row.get("person"), row.get("person"))
    out = []
    for k, row in kept.items():
        if guard and (guard.search(row.get("person") or "") or guard.search(row.get("company") or "")):
            dropped.append((row.get("company"), row.get("person"), "name guard")); continue
        out.append(row)
    out.sort(key=lambda r: ((r.get("hq_country_iso3") or ""), norm(r["company"]), norm(r["person"])))
    with open(os.path.join(CO, "diaspora.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(CO, "diaspora-dropped.tsv"), "w", encoding="utf-8") as f:
        f.write("company\tperson\treason\n")
        for c, p, why in sorted(dropped, key=lambda x: (str(x[0]), str(x[1]))):
            f.write(f"{c}\t{p}\t{why}\n")
    n_guard = sum(1 for d in dropped if d[2] == "name guard")
    print(f"kept {len(out)} rows, dropped {len(dropped)} (name guard hits: {n_guard}); press rows read: {len(press)}")
    return out, dropped


if __name__ == "__main__":
    main("--offline" in sys.argv)
