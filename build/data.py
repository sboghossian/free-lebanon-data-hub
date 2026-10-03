"""Builds the JSON data block of the Free Lebanon Data Hub from the research files.

v3: all 13 timeline files, PESTEL lanes, robust merge keys, eras, long-run series.
Research files are read-only data. Keys:
  "02:14"                      row 14 of file 02 (files 01, 02, 03, 05 are frozen)
  "13@2020-08-04~Beirut port"  row of file 13 with that date and title prefix (robust to re-sorting)
"""
import glob, json, os, re
from collections import Counter
import v4, privacy

R = v4.R
CONF = {"✅": "verified", "📣": "reported", "🧪": "inference"}
RANK = {"inference": 0, "reported": 1, "verified": 2}
T_START = 1800.0
T_END = 2026 + 8 / 12 + 29.5 / 365  # 30 Sep 2026
WARN = []

FILES = {
    "01": "01-ministry-ecosystem.timeline.jsonl",
    "02": "02-politics-crisis.timeline.jsonl",
    "03": "03-regional.timeline.jsonl",
    "05": "05-history-figures.timeline.jsonl",
    "08": "08-politics-war-1920-2019.timeline.jsonl",
    "09": "09-economy-1943-2019.timeline.jsonl",
    "10": "10-innovation-1943-2019.timeline.jsonl",
    "10w": "10-world-ai.timeline.jsonl",
    "11": "11-our-work.timeline.jsonl",
    "12": "12-connectors-work.timeline.jsonl",
    "13": "13-social-1943-2026.timeline.jsonl",
    "14e": "14-environment.timeline.jsonl",
    "14l": "14-legal.timeline.jsonl",
    # v4 gap-fill, life and people files
    "21": "21-political-region-events.timeline.jsonl",
    "22": "22-economic-events.timeline.jsonl",
    "23": "23-social-events.timeline.jsonl",
    "24": "24-tech-world-events.timeline.jsonl",
    "25": "25-env-legal-events.timeline.jsonl",
    "32": "32-life.timeline.jsonl",
    "33": "33-people.timeline.jsonl",
    # v5 completeness pass
    "50": "50-mandate-1920-1949.timeline.jsonl",
    "51": "51-first-republic-1950-1974.timeline.jsonl",
    "52": "52-civil-war-1975-1990.timeline.jsonl",
    "53": "53-second-republic-1991-2022.timeline.jsonl",
    "54": "54-institutions-complete.timeline.jsonl",
    "55": "55-security-incidents.timeline.jsonl",
    "56": "56-culture-sport-media.timeline.jsonl",
    "57": "57-environment-health-infrastructure.timeline.jsonl",
    "58": "58-recency-2023-2026.timeline.jsonl",
}
FILE_LABEL = {"01": "Ministry & ecosystem", "02": "Politics & crisis", "03": "Region", "05": "History figures",
              "08": "Politics & war 1920-2019", "09": "Economy 1943-2019", "10": "Innovation 1920-2019",
              "10w": "World & Gulf tech", "13": "Social",
              "14e": "Environment", "14l": "Legal", "21": "Politics & region (v4)", "22": "Economy (v4)",
              "23": "Social (v4)", "24": "Tech & world (v4)", "25": "Environment & legal (v4)", "32": "Life in Lebanon",
              "33": "People & migration", "31": "Agreements",
              "50": "Mandate 1920-1949 (v5)", "51": "First Republic 1950-1974 (v5)", "52": "Civil war 1975-1990 (v5)",
              "53": "Second Republic 1991-2022 (v5)", "54": "Institutions (v5)", "55": "Security incidents (v5)",
              "56": "Culture, sport & media (v5)", "57": "Environment, health & infrastructure (v5)", "58": "2023-2026 (v5)"}
NEWF = {"21", "22", "23", "24", "25", "32", "33", "31", "50", "51", "52", "53", "54", "55", "56", "57", "58"}
GLOB_KEYS = set()  # keys registered from research/[5-8][0-9]-*.timeline.jsonl; rows there are normalised on load


def _label_of(slug):
    s = slug.replace("-", " ").replace("_", " ")
    s = re.sub(r"(\d{4}) (\d{4})", r"\1-\2", s)
    return s[:1].upper() + s[1:] + " (v6)"


def register_globs():
    """Every research/[5-8][0-9]-*.timeline.jsonl not already in FILES gets a key (its 2-digit prefix; a letter is added when the prefix is taken),
    a FILE_LABEL from its slug, and NEWF membership."""
    have = set(FILES.values())
    for p in sorted(glob.glob(R + "[5-8][0-9]-*.timeline.jsonl")):
        f = os.path.basename(p)
        if f in have:
            continue
        k, n = f[:2], 0
        while k in FILES:
            n += 1
            k = f[:2] + "abcdefghij"[n - 1]
        FILES[k] = f
        FILE_LABEL[k] = _label_of(re.sub(r"^\d{2}-|\.timeline\.jsonl$", "", f))
        NEWF.add(k)
        GLOB_KEYS.add(k)
        have.add(f)


register_globs()

LANES = ["pol", "econ", "soc", "tech", "env", "law", "agree", "life", "region", "world"]
PESTEL = ["pol", "econ", "soc", "tech", "env", "law"]
TRACK_NEW = {"politics": "pol", "war": "pol", "regional": "region", "social": "soc", "legal": "law", "economy": "econ",
             "crisis": "econ", "innovation": "tech", "ai": "tech", "world": "world", "environment": "env", "protest": "soc",
             "life": "life", "military": "pol", "conflict": "pol", "diplomacy": "region", "trade": "econ", "finance": "econ",
             "law": "law", "technology": "tech", "science": "tech", "disaster": "env", "region": "region"}


def clean(s):
    s = s.replace("a long-running legitimacy grievance", "a lasting dispute over legitimacy")
    if s is None:
        return None
    s = s.replace("—", ", ").replace("–", "-")
    s = s.replace("unlocks Gulf and Western capital", "opens the way for Gulf and Western capital")
    return s


# ---------------------------------------------------------------- dates
def parse_date(d):
    """Returns (t, prec, span or None, label or None). t is a decimal year."""
    d = str(d).strip()
    m = re.match(r"^(\d{4})s$", d)
    if m:
        y = int(m.group(1))
        return y + 5.0, "decade", [y, y + 10], f"{y}s"
    m = re.match(r"^(\d{4})-(\d{2}|\d{4})$", d)
    if m and (len(m.group(2)) == 4 or int(m.group(2)) > 12):
        a = int(m.group(1))
        b = int(m.group(2)) if len(m.group(2)) == 4 else int(m.group(1)[:2] + m.group(2))
        return (a + b + 1) / 2, "range", [a, b + 1], f"{a}-{b}"
    m = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$", d)
    if not m:
        return None
    y = int(m.group(1))
    if not m.group(2):
        return y + 0.5, "year", None, None
    mo = int(m.group(2))
    if not m.group(3):
        return y + (mo - 0.5) / 12, "month", None, None
    return y + (mo - 1) / 12 + (int(m.group(3)) - 0.5) / 365, "day", None, None


PREC = {"decade": 0, "range": 0, "year": 1, "month": 2, "day": 3}


# ---------------------------------------------------------------- rows
MISSING = set()  # FILES keys whose research file is not in this checkout (11, 12 are never published); skipped silently


def load_rows():
    rows, by_file = {}, {}
    for k, f in FILES.items():
        by_file[k] = []
        if not os.path.exists(R + f):
            MISSING.add(k)
            continue
        for i, line in enumerate(open(R + f, encoding="utf-8")):
            if line.strip():
                if k in GLOB_KEYS:  # files still being written by research agents: skip a broken or empty-field row, never crash
                    try:
                        r = json.loads(line)
                    except ValueError:
                        WARN.append(f"{f} line {i + 1}: not JSON, skipped")
                        continue
                    if not isinstance(r, dict) or not r.get("date") or not r.get("title"):
                        WARN.append(f"{f} line {i + 1}: no date or title, skipped")
                        continue
                    r["date"] = str(r["date"]).strip()
                    r.setdefault("track", "politics")
                    r["why"] = r.get("why") or ""
                    r["confidence"] = r.get("confidence") if r.get("confidence") in CONF else "🧪"
                    r.setdefault("source", None)
                else:
                    r = json.loads(line)
                r["f"], r["i"], r["key"], r["fk"] = k, i, f"{k}:{i}", f"{f}:{i}"
                rows[r["key"]] = r
                by_file[k].append(r)
    # agreements (31) join as rows so the merge machinery can pin them to timeline events
    by_file["31"] = []
    for a in v4.agreements():
        why = a["what_it_did"] + (f" Status: {a['status']}" + (f" ({a['status_note']})" if a.get("status_note") else "") + ".")
        r = {"date": a["date_signed"], "track": "agreement", "title": a["name"], "why": why, "source": a.get("source"),
             "confidence": a["confidence"], "weight": v4.AGR_WEIGHT.get(a["type"], 1), "type": v4.AGR_KIND.get(a["type"], "agreement"),
             "actors": a.get("parties") or [], "law_no": a.get("law_no"), "needs_source": a.get("needs_source"),
             "f": "31", "i": a["i"], "key": f"31:{a['i']}", "fk": a["fullkey"],
             "ag": {"n": a["name"], "pa": a.get("parties") or [], "k": a["type"], "st": a["status"], "sn": a.get("status_note"),
                    "wd": a["what_it_did"], "law": a.get("law_no"), "d": a["date_signed"], "pil": a["pillar"]}}
        rows[r["key"]] = r
        by_file["31"].append(r)
    return rows, by_file


def resolve(key, rows, by_file):
    if key.split(":")[0].split("@")[0] in MISSING:
        return None
    if "@" not in key:
        return key if key in rows else None
    f, rest = key.split("@", 1)
    if f in MISSING:
        return None
    date, _, pre = rest.partition("~")
    pre = pre.lower()
    cands = by_file.get(f, [])
    hit = [r for r in cands if r["date"] == date and r["title"].lower().startswith(pre)]
    if len(hit) == 1:
        return hit[0]["key"]
    if pre:
        hit2 = [r for r in cands if r["title"].lower().startswith(pre)]
        if len(hit2) == 1:
            WARN.append(f"key {key}: date changed, matched by title ({hit2[0]['date']})")
            return hit2[0]["key"]
    if len(hit) > 1:
        WARN.append(f"key {key}: ambiguous, took first")
        return hit[0]["key"]
    WARN.append(f"key {key}: not found")
    return None


# Weights for the ministry file (it had none). Assigned at synthesis; disclosed on the page.
W01 = {0: 1, 1: 3, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 1, 10: 2, 11: 2, 12: 1, 13: 2, 14: 2,
       15: 2, 16: 1, 17: 2, 18: 1, 19: 1, 20: 2, 21: 3, 22: 2, 23: 2, 24: 1, 25: 1, 26: 3, 27: 2,
       28: 1, 29: 2, 30: 1, 31: 3, 32: 2, 33: 2, 34: 2, 35: 2, 36: 3, 37: 1, 38: 3, 39: 1, 40: 1,
       41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 2, 47: 1, 48: 3, 49: 2, 50: 1, 51: 2, 52: 1, 53: 2,
       54: 1, 55: 2}

# Rows dropped by rule. The public rules are generic (a row dated after 30 Sep 2026 is handled by date, a row a fixer flagged
# as contradicted by its source is dropped). Names a maintainer must never publish come from an optional private file
# (build/privacy.py); without it, DROP stays empty and nothing extra is dropped.
_PRIV_DROP, _PRIV_REWRITE = privacy.drops()
DROP = dict(_PRIV_DROP)
PRIVATE = privacy.pattern()  # rows whose title or note match a private term are dropped and reported; None without a terms file

REWRITE = {
    # 07b #12: $400M is a press estimate, not a figure in the circular.
    "01:2": {"title": "First Circular 331 funds launch; ~$400M capacity (press estimate)", "confidence": "📣"},
    # 07b #13
    "01:52": {"title": "Ookla: Lebanon fixed broadband ranks about 141st-143rd, mobile 93rd"},
    # 07a #3b and the coordinator's wording rule: referral reported 15 Jul 2026, session day not stated.
    "01:48": {"date": "2026-07-15", "title": "MITAI draft law's referral to joint committees reported",
              "why": "Reported by MTV on 15 Jul 2026; the session day is not stated. SMEX lists four defects; the ministry is still not legally created."},
    "01:26": {"title": "Cabinet approves the draft law creating a full MITAI ministry"},
    # 07a #17: Saudi decision announced 10 Jun 2026.
    "03:42": {"date": "2026-06-10"},
}
REWRITE.update(_PRIV_REWRITE)
# Wording corrections from the fact-checks (07a, 07b), applied to titles and notes of every row.
TEXT_FIX = [
    ("At least 303 killed per Lebanon's health ministry;", "357 killed per the health ministry's final toll (early reports said 303+);"),
    ("hold 570-600 km2 of southern Lebanon by later estimates", "hold 570-600 km2 of southern Lebanon (Apr 2026 estimate; later figures vary)"),
    ("Occupation of about 570-600 sq km,", "Occupation of about 570-600 sq km (Apr 2026 estimate),"),
]

# ---------------------------------------------------------------- lanes
TRACK_LANES = {
    "01": {"economy": ["econ", "tech"], "policy": ["tech"], "innovation": ["tech"], "ai": ["tech"]},
    "02": {"politics": ["pol"], "war": ["pol"], "economy": ["econ"], "crisis": ["econ"]},
}
FILE_LANES = {"03": ["region"], "08": ["pol"], "09": ["econ"], "10": ["tech"], "10w": ["world"], "13": ["soc"], "14e": ["env"], "14l": ["law"]}
# History figures: each card goes to the pillar it is about, with a figure marker.
F05 = {0: ["tech"], 1: ["pol"], 2: ["pol"], 3: ["econ"], 4: ["econ", "law"], 5: ["pol"], 6: ["soc"], 7: ["tech"],
       8: ["soc"], 9: ["tech"], 10: ["econ"], 11: ["env", "econ"], 12: ["econ"], 13: ["pol"], 14: ["econ"],
       15: ["pol"], 16: ["pol"], 17: ["econ"], 18: ["soc"], 19: ["pol", "law"], 20: ["econ"], 21: ["econ"],
       22: ["econ"], 23: ["pol"], 24: ["econ", "tech"], 25: ["econ"], 26: ["econ"], 27: ["econ"], 28: ["soc"],
       29: ["econ"], 30: ["law", "econ"], 31: ["econ"], 32: ["econ"], 33: ["law"], 34: ["econ"],
       35: ["law", "econ"], 36: ["law", "econ"], 37: ["econ", "law"]}
# Crisis rows of file 02 mapped by content.
LANE_SET = {"02:6": ["soc", "region"], "02:8": ["env", "soc"], "02:15": ["pol", "soc"], "02:19": ["soc", "env"],
            "02:24": ["env", "econ"], "02:26": ["econ", "soc"],
            # rows that only duplicate an event owned by another pillar add no lane of their own
            "01:11": [], "01:36": [], "01:38": [], "09:41": [], "10:4": ["econ"], "10:10": [], "10:21": [],
            "10:24": [], "10:26": [], "10:28": [], "10:68": [], "10w:43": [], "10w:44": []}
LANE_ADD = {
    "01:7": ["law"], "01:26": ["law"], "01:33": ["law"], "01:48": ["law"],
    "02:38": ["law"], "02:50": ["law"], "02:61": ["law"], "02:82": ["law"],
}
REGION_ADD = [
    "08@1948-05-15~Lebanon joins", "08@1949-03-23~Israel-Lebanon armistice", "08@1958-02-01~Egypt and Syria",
    "08@1958-07-15~US Marines", "08@1967-06-05~Six-Day", "08@1970-09~Black September", "08@1976-05-31~Syrian army",
    "08@1976-10~Arab Deterrent", "08@1978-03-14~Operation Litani", "08@1978-03-19~UNSCR 425",
    "08@1982-06-06~Israel invades", "08@1982-08-21~PLO evacuation", "08@1983-05-17~Israel-Lebanon 17 May",
    "08@1985-12-28~Tripartite", "08@1989-10-22~Taif", "08@1991-05-22~Treaty of Brotherhood",
    "08@1996-04-11~Israel launches", "08@2000-05-25~Israel completes withdrawal", "08@2004-09-02~UNSCR 1559",
    "08@2013-05-25~Nasrallah confirms", "13@2011~Syrian war begins", "13@1948~Palestinian refugees",
    "13@1950~UNRWA", "09@1970s~Oil-boom", "09@2011-2016~Syrian refugees", "09@1950~Customs union",
]
for k in REGION_ADD:
    LANE_ADD.setdefault(k, []).append("region")


def lanes_of(r):
    f, key = r["f"], r["key"]
    if key in LANE_SET:
        return list(LANE_SET[key])
    if f == "31":
        return ["agree", v4.PILLAR_LANE.get(r["ag"]["pil"], "pol")]
    if f in NEWF:
        return [TRACK_NEW.get(r["track"], "soc")]
    if f in TRACK_LANES:
        return list(TRACK_LANES[f].get(r["track"], ["pol"]))
    if f == "05":
        return list(F05[r["i"]])
    return list(FILE_LANES[f])


# ---------------------------------------------------------------- merges
# Cross-file duplicates merged into one event (first key is primary and gives the id).
MERGE = [
    # v2 groups (kept as they were, some extended with the new files)
    ["02:0", "05:23", "08@2005-02-14~Rafic", "09@2005-02-14~Rafik", "13@2005-02-14~Rafic"],
    ["01:1", "05:24", "10@2013-08-22~BDL issues"],
    ["02:14", "01:11", "05:26", "10@2019-10~Banks close", "14l@2019-10~Banks impose"],
    ["02:18", "05:27"],
    ["02:19", "05:28", "13@2020-08-04~Beirut port", "14e@2020-08-04~Port blast"],
    ["02:32", "05:31", "09@2023-02-01~Official rate"],
    ["05:32", "02:33", "14l@2023-07-31~Salameh"],
    ["02:38", "03:0"], ["02:39", "03:1", "14e@2024-11-27~Ceasefire"], ["02:40", "03:2", "13@2024-12~Assad"],
    ["02:41", "03:3"], ["02:48", "05:35", "14l@2025-04-24~Parliament lifts"], ["02:50", "03:8"],
    ["02:51", "05:36", "14l@2025-07-31~Parliament passes the bank"], ["02:54", "03:12"],
    ["02:58", "05:37", "14l@2025-12-26~Cabinet approves the financial"], ["02:62", "03:20"], ["02:63", "03:23"],
    ["02:64", "03:25", "01:36", "13@2026-03-02~War resumes", "14e@2026-03-02~Hostilities resume"],
    ["02:66", "03:26", "01:38", "13@2026-03-09~Parliament extends", "14l@2026-03-09~Parliament extends"],
    ["02:67", "03:27"], ["02:68", "03:28"], ["02:70", "03:33"],
    ["02:71", "03:35", "13@2026-04-16~Ceasefire"], ["02:76", "03:43"], ["02:78", "03:44"], ["02:84", "03:53"],
    ["02:85", "03:62"],
    # politics and war
    ["02:1", "08@2005-04-26~Last Syrian", "13@2005-04-26~Syrian troops"],
    ["02:2", "08@2006-07-12~Hezbollah capture", "09@2006-07-12~34-day", "13@2006-07-12~34-day"],
    ["02:3", "08@2007-05-20~Nahr", "13@2007-05-19~Nahr"],
    ["02:4", "08@2008-05-07~7 May"], ["02:5", "08@2008-05-21~Doha", "14l@2008-05-21~Doha"],
    ["02:6", "13@2014-04~UNHCR registers"], ["02:7", "08@2014-05-25~Suleiman"],
    ["02:8", "09@2015-07-17~Naameh", "13@2015-07-17~Naameh", "14e@2015-07-17~Naameh"],
    ["02:9", "08@2015-08-22~You Stink"], ["13@2015-08-29~YouStink", "14e@2015-08-29~Over 100,000"],
    ["02:10", "08@2016-10-31~Michel Aoun"], ["02:11", "08@2017-11-04~Hariri"], ["02:12", "09@2018-04-06~CEDRE"],
    ["02:13", "08@2018-05-06~First parliamentary"],
    ["02:15", "08@2019-10-17~17 October", "13@2019-10-17~Thawra", "09@2019-10-17~Protests erupt"],
    ["02:16", "13@2019-10-29~Hariri resigns"], ["02:20", "13@2020-08-10~Diab"],
    ["02:21", "14l@2020-08-18~STL convicts"], ["02:29", "13@2022-05-15~Election"],
    ["02:47", "14l@2025-03-27~Karim Souaid", "05:34"], ["02:49", "13@2025-05-04~First municipal"],
    ["02:60", "14e@2026-01-09~Block 8"], ["02:83", "14l@2026-08-12~Parliament passes the amended"],
    ["02:86", "14l@2026-09-28~Financial gap"],
    ["08@1926-05-23~Constitution", "14l@1926-05-23~Constitution"],
    ["08@1932~Last official census", "13@1932~Last official census", "14l@1932~Census"],
    ["08@1943~Unwritten National Pact", "05:2", "13@1943~National Pact", "14l@1943~Unwritten National Pact"],
    ["08@1968-12-28~Israel destroys", "10@1968-12-28~Israeli raid"],
    ["08@1969-11-02~Cairo Agreement", "14l@1969-11-02~Cairo Agreement", "13@1969~Cairo Agreement"],
    ["08@1970-08-17~Suleiman Frangieh", "05:13"],
    ["08@1975-02-26~Sidon", "13@1975-02-26~Sidon"],
    ["08@1975-04-13~Ain el-Remmaneh", "05:15", "10@1975-04-13~Civil war", "13@1975-04-13~Civil war", "09@1975~Civil war begins"],
    ["08@1976-08-12~Tel al-Zaatar", "13@1976~Tel al-Zaatar"],
    ["08@1982-06-06~Israel invades", "13@1982-06-06~Israeli invasion"],
    ["08@1982-09-16~Sabra", "13@1982~Sabra"], ["08@1985-05-19~War of the Camps", "13@1985-05~War of the Camps"],
    ["08@1989-10-22~Taif", "05:19", "14l@1989-10-22~Taif", "13@1989~Taif"],
    ["08@1989-11-05~Rene Moawad elected", "14l@1989-11-05~Parliament ratifies"],
    ["08@1990-09-21~Constitution amended", "14l@1990-09-21~Taif constitutional"],
    ["08@1990-10-13~Syrian assault", "13@1990-10-13~War ends"],
    ["08@1992-10-31~Rafic Hariri becomes", "09@1992~Rafik Hariri becomes"],
    ["08@1996-04-11~Israel launches", "13@1996-04-11~Grapes"],
    ["08@2000-05-25~Israel completes", "13@2000-05-25~Israeli occupation"],
    ["08@2005-03-14~March 14", "13@2005-03-14~Martyrs"], ["08@2005-06-02~Journalist Samir", "13@2005-06-02~Journalist Samir"],
    ["08@2009-03-01~Special Tribunal", "14l@2009-03-01~Special Tribunal"],
    ["08@2013-05-31~Parliament extends", "14l@2013-05~Parliament extends"],
    ["08@2014-11-05~Parliament extends", "14l@2014-11-05~Parliament extends"],
    ["08@2017-06-16~New electoral law", "14l@2017-06-16~Parliament passes electoral"],
    # economy, innovation, social, law
    ["05:3", "10@1951~Intra Bank founded"], ["05:4", "09@1956-09-03~Banking", "10@1956-09-03~Banking", "14l@1956-09-03~Banking"],
    ["05:7", "10@1960-11~Haigazian"], ["05:9", "10@1963~Cedar IV"],
    ["09@1963-08-01~Banque du Liban", "10@1963-08-01~Banque du Liban", "14l@1963-08-01~Code of Money"],
    ["05:10", "09@1964-04-01~Banque du Liban", "14l@1964-04-01~Banque du Liban"],
    ["05:11", "09@1964-07~Electricite", "14e@1964~Electricity sector"],
    ["05:12", "09@1966-10-14~Intra", "10@1966-10~Intra", "14l@1966-10-14~Intra"],
    ["05:17", "09@1987~Hyperinflation"], ["05:20", "14l@1993-06-07~Riad Salameh"], ["05:21", "09@1994-05-05~Solidere"],
    ["05:22", "09@1997-12~Exchange rate fixed"], ["05:25", "09@2016~BDL starts"],
    ["05:30", "14l@2022-10-28~Law 306"], ["05:33", "14l@2025-01~Port-blast probe"],
    ["09@1975-1990~Civil-war emigration", "13@1975-1989~About 990,000", "13@1975~Civil-war exodus"],
    ["10@1940~Beirut hosts", "13@1940s~Beirut becomes"], ["10@1951-12-03~Lebanese University", "13@1951-12-03~Lebanese University"],
    ["10@1959-05-28~CLT begins", "13@1959~Television launched"], ["10@1962~Press law", "13@1962~Press law"],
    ["10@1977-07-07~Decree merges", "13@1977~Two private TV"], ["10@1985~LBC launches", "13@1985~Lebanese Forces launch"],
    ["10@1992~LBCI", "13@1992~LBCI"], ["10@1996~LBC launches satellite", "13@1996-04~LBC launches satellite"],
    ["13@1991~General amnesty", "14l@1991-08-26~General Amnesty"], ["13@2014~Parliament passes domestic", "14l@2014-05-07~Law 293"],
    ["14e@2010-08-24~Law 132", "14l@2010-08-24~Law 132"], ["14e@2019-03-29~Paris Agreement", "14l@2019-03-29~Law 115"],
    ["01:0", "10@2001~Berytech"], ["01:3", "10@2015~UK Lebanon Tech Hub", "10@2015~Speed accelerator"],
    ["01:7", "14l@2018-09-24~Parliament passes Law 81"], ["01:8", "10@2019-01-30~Afiouni"],
    ["01:21", "10w@2025-02-08~Kamal Shehadi"], ["01:22", "10w@2025-04~Shehadi outlines"],
    ["01:26", "14l@2025-09-09~Cabinet approves draft law"], ["01:48", "14l@2026-07~Parliament sends the MITAI"],
]
MERGE_NOTES = {
    "02:71": "Date conflict: the war page gives 16 Apr, '2026 in Lebanon' gives 17 Apr (5 pm US Eastern on 16 Apr is midnight in Beirut).",
    "02:84": "Date conflict: World Bank release dated 21 Aug 2026; Al Jazeera report dated 22 Aug.",
    "05:32": "Tag conflict: the politics file marks this date as unverified memory; the history file read it on Wikipedia.",
    "02:0": "Count conflict: the politics file says 22 dead; the history card says 23.",
    "02:19": "Count conflict: 218 dead in the politics file; 'more than 220' in the history file.",
    "02:64": "Some sources date the cabinet ban on Hezbollah military activity to 2 Mar, others to 5 Mar.",
    "02:3": "Date conflict: 20 May 2007 in the politics files, 19 May in the social file.",
    "02:9": "Date conflict: the politics files date the peak to 22 Aug 2015; the social and environment files date the rally of over 100,000 to 29 Aug 2015.",
    "02:47": "Date conflict: appointed and took over on 27 Mar 2025 per the politics and legal files; the history file dates his start to 4 Apr 2025.",
    "08@1970-08-17~Suleiman Frangieh": "Date conflict: Frangieh was elected on 17 Aug 1970 and took office on 23 Sep 1970; sources differ on which date they cite.",
    "08@1951-07-16~PM Riad el-Solh": "Date conflict: sources give 16 or 17 Jul 1951.",
    "05:20": "Date conflict: 7 Jun 1993 in the legal file, 1 Aug 1993 in the history file.",
    "05:30": "Date conflict: 28 Oct 2022 in the legal file (law text), 29 Oct 2022 in the history file.",
    "01:0": "Date conflict: 2001 in the innovation file, 2002 in the ministry file.",
    "01:8": "Afiouni was appointed with the Hariri III cabinet on 30 or 31 Jan 2019; the ministry file dates the office to Feb 2019.",
    "01:48": "Wording rule: the MTV report is dated 15 Jul 2026; the session day is not stated. SMEX objected on 31 Jul.",
    "03:42": "Date conflict: Reuters dates the Saudi order 10 Jun 2026; The National and AP report it on 11 Jun.",
    "02:58": "Date: 26 Dec 2025 per US News and the Washington Post; one report says 27 Dec.",
}
# Kept as inference on purpose: the sources disagree on the date (coordinator, 30 Sep 2026).
CONF_OVERRIDE = {"08@1970-08-17~Suleiman Frangieh": "inference", "08@1951-07-16~PM Riad el-Solh": "inference",
                 "02:9": "inference"}

# ---------------------------------------------------------------- v4 merges
# Curated pairs (new row, row it duplicates), checked by hand against same-day and same-year candidates.
MERGE4 = [
    ("23:1", "08:0"), ("21:115", "23:72"), ("24:24", "02:35"), ("25:72", "02:29"), ("23:62", "02:29"), ("23:41", "02:13"),
    ("25:36", "08:125"), ("24:35", "02:15"), ("21:54", "23:15"), ("23:15", "09:28"), ("32:3", "10:13"), ("25:76", "14l:61"),
    ("22:74", "25:81"), ("22:82", "25:94"), ("24:46", "01:45"), ("33:38", "13:96"), ("25:87", "02:45"), ("25:73", "13:84"),
    ("22:57", "13:79"), ("23:24", "32:23"), ("24:53", "10:52"), ("25:15", "14l:20"), ("24:6", "32:16"), ("25:70", "14l:52"),
    ("22:8", "14l:12"), ("23:13", "08:60"), ("25:26", "08:98"), ("32:31", "33:17"), ("33:26", "02:19"),
]
# Agreements (31) pinned to the timeline event that records the same signing.
AGR_MERGE = {
    1: "08:0", 3: "21:1", 5: "08:1", 6: "08:3", 7: "08:5", 10: "21:5", 12: "22:2", 13: "08:11", 14: "21:8", 19: "08:25",
    21: "08:35", 22: "08:40", 24: "08:43", 31: "08:53", 36: "08:59", 39: "08:69", 41: "08:75", 42: "08:76", 43: "14l:17",
    44: "14l:19", 45: "08:83", 46: "08:84", 48: "21:53", 54: "21:60", 56: "22:19", 58: "22:21", 59: "09:40", 62: "08:98",
    63: "25:27", 66: "08:109", 68: "21:73", 72: "21:75", 75: "09:44", 78: "14l:24", 81: "02:5", 82: "21:79", 83: "21:80",
    84: "14l:27", 86: "08:130", 91: "22:33", 92: "02:12", 93: "21:93", 100: "02:28", 103: "22:64", 106: "23:69",
    107: "02:39", 109: "03:4", 111: "14e:50", 112: "02:53", 113: "02:53", 115: "03:18", 116: "22:84", 117: "02:60",
    118: "02:62", 120: "03:32", 121: "03:35", 124: "03:38", 125: "02:73", 128: "02:75", 129: "02:76", 130: "02:77",
    131: "02:78", 132: "03:48", 133: "03:46", 134: "02:79", 135: "02:81", 136: "02:86",
}
AGR_PRIMARY_SKIP = {112}  # a 2006-2025 UNIFIL summary row; the event shows resolution 2790 (row 113) as its agreement
# Same-day or same-year look-alikes that are different events.
NO_MERGE = {("24:54", "*"), ("21:22", "*"), ("25:97", "10w:41"), ("22:84", "01:34"), ("32:14", "05:17"),
            # v5 false pairs found by review: different events with overlapping words
            ("32:14", "52:176"), ("51:114", "08:21"), ("52:2", "13:29"), ("57:27", "08:101"), ("58:15", "02:83")}
MERGE4_NOTES = {
    "32:31": "Count conflict: the life file gives 2,351,081 arrivals in 2010; the people file gives 2.168 million. Definitions differ.",
    "14l:27": "Date conflict: the agreements file dates Law 132 to 17 Aug 2010; the legal and environment files to 24 Aug 2010.",
    "02:62": "Amount conflict: about $420m in the agreements file, $430m in the politics and region files.",
}
STOPW = set("the and for with from that this into over under after before about their there were was are its his her has "
            "have had not but than then when which what who whom will would could lebanon lebanese first begins ends new "
            "of in on to a an by at as is be".split())


def _terms(s):
    return {w for w in re.findall(r"[a-z0-9]{3,}", s.lower().replace("rafik", "rafic")) if w not in STOPW}


def _sim(a, b):
    A, B = _terms(a), _terms(b)
    return len(A & B) / max(1, min(len(A), len(B)))


def auto_pairs(rows):
    """Duplicate candidates between a v4 row and any other row: dup_of titles, then same-day titles
    (overlap >= 0.4), then same month or year with near-identical titles (>= 0.75)."""
    pairs = []
    by_title = {}
    for k, r in rows.items():
        by_title.setdefault(r["title"].strip().lower(), []).append(k)
    blocked = lambda a, b: (a, "*") in NO_MERGE or (b, "*") in NO_MERGE or (a, b) in NO_MERGE or (b, a) in NO_MERGE
    keys = sorted(rows, key=lambda k: (rows[k]["f"], rows[k]["i"]))
    for a in keys:
        ra = rows[a]
        if ra["f"] not in NEWF or ra["f"] == "31":
            continue
        if ra.get("dup_of"):
            hit = [k for k in by_title.get(ra["dup_of"].strip().lower(), []) if k != a]
            if hit:
                pairs.append((a, hit[0], "dup_of"))
                continue
            WARN.append(f"dup_of not found for {a}: {ra['dup_of']}")
        for b in keys:
            rb = rows[b]
            if b == a or rb["f"] == "31" or (rb["f"] in NEWF and (rb["f"], rb["i"]) <= (ra["f"], ra["i"])) or blocked(a, b):
                continue
            da, db = ra["date"], rb["date"]
            s = None
            if len(da) == 10 and da == db:
                s = _sim(ra["title"], rb["title"])
                if s >= 0.4:
                    pairs.append((a, b, "day %.2f" % s))
                continue
            same_year = da[:4] == db[:4] and (len(da) == 4 or len(db) == 4)
            same_month = len(da) >= 7 and len(db) >= 7 and da[:7] == db[:7] and not (len(da) == 10 and len(db) == 10)
            if same_year or same_month:
                s = _sim(ra["title"], rb["title"])
                if s >= 0.75:
                    pairs.append((a, b, "near %.2f" % s))
    return pairs


def build_events():
    rows, by_file = load_rows()
    nrows = len([r for r in rows.values() if r["f"] != "31"])
    nagr = len(by_file["31"])
    dropped = []
    for k, why in DROP.items():
        kk = resolve(k, rows, by_file)
        if kk:
            dropped.append({"key": kk, "title": rows[kk]["title"], "why": why})
            rows.pop(kk)
            by_file[kk.split(":")[0]] = [r for r in by_file[kk.split(":")[0]] if r["key"] != kk]
    # rows the fixer loop marked as contradicted by their source
    for kk in [k for k, r in rows.items() if r.get("drop")]:
        r = rows.pop(kk)
        dropped.append({"key": kk, "title": r["title"], "why": "fixer: " + (r.get("drop_reason") or "contradicted by its source"), "file": FILES.get(r["f"])})
    for k, v in REWRITE.items():
        kk = resolve(k, rows, by_file)
        if kk:
            rows[kk].update(v)
    for r in rows.values():
        for a, b in TEXT_FIX:
            r["title"] = r["title"].replace(a, b)
            r["why"] = (r.get("why") or "").replace(a, b)
    # rows a maintainer marked non-public, or that match an optional private term (build/privacy.py), are dropped and reported
    for kk in [k for k, r in rows.items() if r.get("public_safe") is False or (PRIVATE and PRIVATE.search(r["title"] + " " + (r.get("why") or "")))]:
        dropped.append({"key": kk, "title": "(withheld)", "why": "excluded topic"})
        rows.pop(kk)
    # place on the axis
    unplaced = []
    for kk in list(rows):
        r = rows[kk]
        p = parse_date(r["date"])
        if p is None or p[0] < T_START or p[0] > T_END + 0.01:
            unplaced.append({"key": kk, "date": r["date"], "title": r["title"], "file": FILES.get(r["f"], "31-agreements.jsonl"),
                             "why": "date not parseable" if p is None else ("before 1800" if p[0] < T_START else "after 30 Sep 2026")})
            rows.pop(kk)
            continue
        r["_t"] = p
    lane_add = {}
    for k, v in LANE_ADD.items():
        kk = resolve(k, rows, by_file)
        if kk:
            lane_add.setdefault(kk, []).extend(v)
    # ---- groups: v3 MERGE first (their primaries give the ids), then v4 pairs
    groups, member_of = [], {}
    for g in MERGE:
        keys = [kk for kk in (resolve(k, rows, by_file) for k in g) if kk and kk in rows]
        keys = [k for k in keys if k not in member_of]
        if len(keys) < 2:
            if len(g) > 1:
                WARN.append(f"merge group {g[0]} resolved to {len(keys)} row(s)")
            continue
        grp = list(keys)
        groups.append(grp)
        for k in keys:
            member_of[k] = grp
    old = lambda k: rows[k]["f"] not in NEWF
    merge_log = []

    def join(a, b, why):
        if a not in rows or b not in rows:
            WARN.append(f"v4 merge {a}+{b}: row missing")
            return
        ga, gb = member_of.get(a), member_of.get(b)
        if ga is not None and ga is gb:
            return
        ga = ga or [a]
        gb = gb or [b]
        if any(old(k) for k in ga) and any(old(k) for k in gb):
            WARN.append(f"v4 merge {a}+{b} would join two v3 events; skipped")
            return
        if any(old(k) for k in ga) or (not any(old(k) for k in gb) and rows[gb[0]]["f"] == "31"):
            keep, add = ga, gb
        else:
            keep, add = gb, ga
        if keep not in groups:
            groups.append(keep)
        if add in groups:
            groups.remove(add)
        for k in add:
            keep.append(k)
        for k in keep:
            member_of[k] = keep
        merge_log.append((a, b, why))

    for a, b in MERGE4:
        join(a, b, "curated")
    for i, tk in AGR_MERGE.items():
        join(f"31:{i}", tk, "agreement")
    for a, b, why in auto_pairs(rows):
        join(a, b, why)
    notes = {resolve(k, rows, by_file): v for k, v in MERGE_NOTES.items()}
    notes.update({k: v for k, v in MERGE4_NOTES.items() if k in rows})
    overrides = {resolve(k, rows, by_file): v for k, v in CONF_OVERRIDE.items()}
    # new-only groups: a timeline row leads (better titles than agreement names), most precise date first
    for g in groups:
        if not any(old(k) for k in g):
            g.sort(key=lambda k: (rows[k]["f"] == "31", -PREC[rows[k]["_t"][1]], rows[k]["f"], rows[k]["i"]))
    events, seen = [], set()
    for key in sorted(rows, key=lambda k: rows[k]["_t"][0]):
        if key in seen:
            continue
        group = member_of.get(key, [key])
        seen.update(group)
        prim = rows[group[0]]
        lanes, parts, fig, deaths, ag = [], [], None, None, None
        types, actors, place, laws, ns = [], [], None, [], False
        for g in group:
            m = rows[g]
            for ln in lanes_of(m) + lane_add.get(g, []):
                if ln not in lanes:
                    lanes.append(ln)
            u = m.get("source")
            uu = u if (u and str(u).startswith("http")) else None
            part = {"file": FILE_LABEL[m["f"]], "title": clean(m["title"]), "why": clean(m["why"]),
                    "u": uu, "c": CONF[m["confidence"]], "date": m["date"],
                    "who": m.get("country") or m.get("person") or (m.get("where") if m["f"] == "10w" else None)}
            if m.get("law_no"):
                part["law"] = m["law_no"]
                if m["law_no"] not in laws:
                    laws.append(m["law_no"])
            if m["f"] == "05" and m.get("person"):
                fig = fig or m["person"]
            if m.get("deaths") and not deaths and m["f"] != "31":
                deaths = {"v": clean(str(m["deaths"])), "u": uu, "c": part["c"]}
            if m.get("needs_source"):
                part["ns"] = 1
                ns = True
            # Jev grounding of this row's source, and the source's tier
            part.update(v4.grounding(m["fk"], m.get("source") or None))
            part["tr"] = v4.url_tier(uu)
            part["lv"] = v4.part_level(part)
            ty, ac, pl, tsrc = v4.facets_for(m["fk"], m)
            if m["f"] == "31":
                part["file"] = "Agreements"
                if int(m["i"]) not in AGR_PRIMARY_SKIP or ag is None:
                    a2 = dict(m["ag"])
                    a2.update({"u": uu, "c": part["c"], "lv": part.get("lv")})
                    if ag is None or int(m["i"]) not in AGR_PRIMARY_SKIP:
                        ag = a2
            if ty and ty not in types:
                types.append(ty)
            for a in ac:
                if a not in actors:
                    actors.append(a)
            place = place or pl
            parts.append(part)
        if ag and ag["k"] == "un_resolution" and "un_resolution" not in types:
            types.append("un_resolution")
        elif ag and "agreement" not in types and "un_resolution" not in types:
            types.append("agreement")
        # most precise date among the group, if it agrees with the primary's date
        best = prim
        for g in group[1:]:
            m = rows[g]
            if PREC[m["_t"][1]] > PREC[best["_t"][1]] and m["date"].startswith(prim["date"]):
                best = m
        # the id keeps the v3 rule on the v3 rows, so claim links and anchors stay stable
        best_old = prim
        for g in group[1:]:
            m = rows[g]
            if old(g) and PREC[m["_t"][1]] > PREC[best_old["_t"][1]] and m["date"].startswith(prim["date"]):
                best_old = m
        t, prec, span, label = best["_t"]
        w = prim.get("weight")
        if w is None:
            w = W01.get(prim["i"], 2) if prim["f"] == "01" else max([rows[g].get("weight") or 0 for g in group] + [2])
        conf = max((p["c"] for p in parts), key=lambda c: RANK[c])
        if group[0] in overrides:
            conf = overrides[group[0]]
        f0 = prim["f"]
        if f0 in ("01", "02", "03", "05"):
            eid = "e" + group[0].replace(":", "_")
        else:
            slug = "-".join(re.findall(r"[a-z0-9]+", prim["title"].lower())[:2])
            eid = f"e{f0}_{best_old['date']}_{slug}"
        ev = {"id": eid, "date": best["date"], "t": round(t, 4), "prec": prec, "lanes": lanes, "w": int(w),
              "title": clean(prim["title"]), "c": conf, "parts": parts, "keys": group}
        if span:
            ev["span"] = span
        if label:
            ev["dl"] = label
        if fig:
            ev["fig"] = fig
        if deaths:
            ev["deaths"] = deaths
        note = [notes[k] for k in group if k in notes]
        if note:
            ev["note"] = " ".join(note)
        ev["ty"] = types or ["other"]
        if actors:
            ev["ac"] = actors[:10]
        if place:
            ev["pl"] = place
        if laws:
            ev["law"] = "; ".join(laws)
        if ag:
            ev["ag"] = {k: v for k, v in ag.items() if v not in (None, "", [])}
        lv = [p["lv"] for p in parts if p.get("lv")]
        ev["gr"] = max(lv, key=lambda x: v4.LEVEL_RANK[x]) if lv else "own"
        if ns:
            ev["ns"] = 1
        events.append(ev)
    ids = Counter(e["id"] for e in events)
    for e in events:
        if ids[e["id"]] > 1:
            e["id"] += "-" + e["keys"][0].split(":")[1]
    events.sort(key=lambda e: e["t"])
    return events, nrows, dropped, unplaced, merge_log, nagr


RANKED = [
    # rank, anchor, start, end, title, text, area, sources
    (1, "e02_64", "2026-03-02", "2026-09-30", "Hezbollah enters the Iran war; Israel invades from 16 Mar",
     "Over 1.2 million displaced, 4,383 killed by 10 Sep 2026 per the health ministry, civilians and fighters together, 570-600 km2 of the south occupied (Apr 2026 estimate).",
     "Safety, housing, jobs",
     [("Wikipedia, 2026 Lebanon war", "https://en.wikipedia.org/wiki/2026_Lebanon_war", "verified"),
      ("LBCI, health ministry toll", "https://www.lbcgroup.tv/news/lebanon-news/956963/lebanon-health-ministry-death-toll-rises-to-4383-since-march-2/en", "verified"),
      ("Wikipedia, occupation of southern Lebanon", "https://en.wikipedia.org/wiki/Israeli_occupation_of_Southern_Lebanon_(2026)", "verified")]),
    (2, "e02_36", "2024-09-23", "2024-11-27", "Pagers, Nasrallah killed, invasion, ceasefire",
     "Over 1.2 million displaced at peak; reconstruction needs put at $11bn by the World Bank (Mar 2025).",
     "Safety, displacement",
     [("Wikipedia, 2023-24 conflict", "https://en.wikipedia.org/wiki/Israel%E2%80%93Hezbollah_conflict_(2023%E2%80%932024)", "verified"),
      ("World Bank via Now Lebanon", "https://nowlebanon.com/world-bank-estimates-lebanons-post-war-reconstruction-and-recovery-needs-at-11-billion/", "reported")]),
    (3, "e02_14", "2019-10-15", "2026-09-30", "Deposits frozen since 2019, still not returned",
     "Gap law approved by cabinet 26 Dec 2025 (13-9), still unpassed in parliament on 28 Sep 2026; bank resolution law amended 12 Aug 2026. Savers cannot access dollars.",
     "Cash",
     [("US News / Bloomberg", "https://money.usnews.com/investing/news/articles/2025-12-26/lebanon-advances-draft-law-to-address-losses-from-economic-collapse", "verified"),
      ("Arab News", "https://www.arabnews.com/middle-east/lebanon-hopes-for-new-staff-level-agreement-with-imf-3003594", "verified")]),
    (4, "e02_24", "2021-08-11", "2021-10-09", "Fuel subsidies end, then the 9 Oct blackout: the grid collapses",
     "Power now means private generators or solar; Qatar pledged $430m for the sector (26 Jan 2026).",
     "Power",
     [("Wikipedia, liquidity crisis", "https://en.wikipedia.org/wiki/Lebanese_liquidity_crisis", "verified"),
      ("Wikipedia, 2026 in Lebanon", "https://en.wikipedia.org/wiki/2026_in_Lebanon", "verified")]),
    (5, "e02_32", "2023-02-01", "2023-02-01", "Official rate moved from 1,507 to 15,000; lira later pinned near 89,000",
     "The economy re-priced in dollars; salaries and prices are set in USD.", "Cash",
     [("Al Jazeera", "https://www.aljazeera.com/economy/2023/2/1/lebanon-devalues-official-exchange-rate-by-90-percent", "verified")]),
    (6, "e02_66", "2026-03-09", "2026-03-09", "Parliament extends its own term by two years (76-41)",
     "May 2026 elections cancelled, next vote 2028. No electoral accountability during the war.", "Accountability",
     [("Carnegie", "https://carnegieendowment.org/middle-east/diwan/2026/03/lebanons-parliament-extends-its-term-under-fire", "verified")]),
    (7, "e02_31", "2022-10-31", "2025-01-09", "26-month presidential vacuum, then Joseph Aoun and Nawaf Salam",
     "A functioning government returned in Feb 2025 and drove the reform laws.", "State services",
     [("CSIS", "https://www.csis.org/analysis/lebanon-finally-elects-president", "reported"),
      ("Wikipedia, 2025 in Lebanon", "https://en.wikipedia.org/wiki/2025_in_Lebanon", "verified")]),
    (8, "e02_39", "2024-11-27", "2026-03-02", "Ceasefire in name, Israeli strikes and five occupied points in practice",
     "Daily risk in the south and Bekaa; strikes on Beirut resumed 28 Mar 2025.", "Safety",
     [("Wikipedia, 2024 ceasefire", "https://en.wikipedia.org/wiki/2024_Israel%E2%80%93Lebanon_ceasefire_agreement", "verified")]),
    (9, "e02_52", "2025-08-05", "2026-03-05", "The state moves to monopolise arms",
     "Army roadmap, then a cabinet ban on Hezbollah military activity; disarmament stalled as of 28 Sep 2026.", "Long-run security",
     [("France 24", "https://www.france24.com/en/middle-east/20250805-lebanon-tasks-army-with-securing-a-monopoly-on-arms-in-challenge-to-hezbollah", "reported"),
      ("Naharnet", "https://www.naharnet.com/stories/en/318707-cabinet-bans-hezbollah-military-activities-demands-group-to-hand-over-arms", "verified")]),
    (10, "e02_40", "2024-12-08", "2024-12-08", "Assad falls", "Refugee returns and a new Syria border.", "Trade, refugees",
     [("Wikipedia, fall of the Assad regime", "https://en.wikipedia.org/wiki/Fall_of_the_Assad_regime", "reported")]),
    (11, "e02_38", "2024-10-25", "2025-06-10", "FATF grey list, then the EU high-risk list",
     "Extra friction on transfers, bank onboarding and remittances.", "Cash, jobs",
     [("Grey-list timeline", "https://bachirelnakib.com/lebanon-grey-list-time-line/", "reported"),
      ("Wikipedia, 2025 in Lebanon", "https://en.wikipedia.org/wiki/2025_in_Lebanon", "verified")]),
    (12, "e02_84", "2026-08-21", "2026-08-21", "World Bank sees a 6.4% contraction in 2026",
     "Jobs and incomes fall again after the war.", "Jobs",
     [("World Bank press release", "https://www.worldbank.org/en/news/press-release/2026/08/21/renewed-conflict-derails-lebanon-s-fragile-economic-recovery", "verified"),
      ("Al Jazeera (wording from search summary)", "https://www.aljazeera.com/news/2026/8/22/world-bank-projects-war-hit-lebanons-economy-to-contract-by-6-4-percent", "reported")]),
]

# v2 eras. Where 08-eras covers the same span, the better-sourced row wins (never a tag upgrade:
# each row keeps the tag of its own source).
ERAS_V2 = [
    # kind, start, end, label, conf, source, ongoing
    ("pres", "1958-09-23", "1964-09-22", "Chehab presidency", "verified", "https://en.wikipedia.org/wiki/Fouad_Chehab", False),
    ("vacuum", "2022-10-31", "2025-01-09", "No president", "reported", "https://www.csis.org/analysis/lebanon-finally-elects-president", False),
    ("war", "2023-10-08", "2024-11-27", "Southern front, then war", "reported", "https://en.wikipedia.org/wiki/Israel%E2%80%93Hezbollah_conflict_(2023%E2%80%932024)", False),
    ("war", "2026-03-02", "2026-09-30", "2026 war, occupation", "verified", "https://en.wikipedia.org/wiki/2026_Lebanon_war", True),
    ("money", "1997-12-15", "2023-02-01", "Peg at 1,507.5", "verified", "https://en.wikipedia.org/wiki/Lebanese_pound", False),
    ("money", "2013-08-22", "2019-10-15", "Circular 331", "verified", "https://www.executive-magazine.com/special-report/lebanese-start-up-funding-threatened", False),
    ("money", "2019-10-15", "2026-09-30", "Deposits frozen", "verified", "https://en.wikipedia.org/wiki/Lebanese_liquidity_crisis", True),
    ("money", "2019-01-31", "2019-10-29", "Afiouni ministry", "verified", "https://www.executive-magazine.com/opinion/the-knowledge-economy", False),
    ("money", "2024-10-25", "2026-09-30", "FATF grey list", "reported", "https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions/increased-monitoring-june-2026.html", True),
    ("money", "2025-02-08", "2026-09-30", "MITAI in office", "verified", "https://en.wikipedia.org/wiki/Kamal_Shehadi", True),
]
ERA_KINDS = {"pres", "vacuum", "war", "occupation", "period", "money"}
ERAS_REPLACED = {"Chehab presidency", "2026 Lebanon war", "Israel-Hezbollah war"}


def build_eras():
    out = []
    for line in open(R + "08-eras.jsonl"):
        if not line.strip():
            continue
        r = json.loads(line)
        if r["label"] in ERAS_REPLACED or (r["kind"] == "vacuum" and r["start"] == "2022-10-31"):
            continue
        kind = r["kind"]
        if kind == "era":
            kind = "pres" if "presidency" in r["label"].lower() else "period"
        end = r.get("end")
        out.append({"kind": kind, "start": r["start"], "end": end or "2026-09-30", "label": clean(r["label"]),
                    "c": CONF[r["confidence"]], "u": r.get("source"), "ongoing": end is None})
    for kind, s, e, lab, c, u, on in ERAS_V2:
        out.append({"kind": kind, "start": s, "end": e, "label": lab, "c": c, "u": u, "ongoing": on})
    # 1800-1920 eras (same schema as 08-eras.jsonl); a kind the strips do not draw becomes a period
    for r in v4.jl_safe("v6/eras-1800-1920.jsonl"):
        a, b = v4.iso_start(r.get("start")), v4.iso_end(r.get("end"))
        if not a or not r.get("label"):
            continue
        kind = r.get("kind") or "period"
        kind = "pres" if kind == "era" and "presidency" in r["label"].lower() else ("period" if kind not in ERA_KINDS else kind)
        out.append({"kind": kind, "start": a, "end": b or "2026-09-30", "label": clean(r["label"]),
                    "c": CONF.get(r.get("confidence"), "inference"), "u": r.get("source"), "ongoing": b is None})
    out.sort(key=lambda x: x["start"])
    return out


def build_series():
    raw = json.load(open(R + "04-economy-evidence.series.json"))
    series = raw["series"]
    extra = [
        {"id": "startup_funding_wamda", "label": "Lebanon-only startup funding per year (Wamda Year in Review)", "unit": "USD m",
         "origin": "01-ministry-ecosystem.md section 8 and 03-regional.md section 6",
         "note": "The economy file says no annual series was found; the ministry file found Wamda rows for 2023-2025. The 2022 value comes from a different source (AGBI and Executive via search, no link) and is not like-for-like.",
         "points": [["2022", 22, "reported", None, "AGBI / Executive via search (other source)"],
                    ["2023", 1.0, "verified", "https://www.wamda.com/index.php/research/pdf/2023-year-review-investments-mena", "Wamda 2023 (12 deals)"],
                    ["2024", 0.51, "reported", "https://cdn.jsdelivr.net/gh/abncharts/abncharts.public.1/abnasia.org/1738213058443_www.abnasia.org.pdf", "Wamda 2024 copy (4 deals)"],
                    ["2025", 2.8, "verified", "https://www.wamda.com/research/pdf/2025-year-review-investments-mena", "Wamda 2025 (10 deals)"]]},
        {"id": "lbp_history_points", "label": "LBP per US$, historical points", "unit": "LBP",
         "origin": "05-history-figures.md card 9", "source": "https://en.wikipedia.org/wiki/Lebanese_pound", "confidence": "verified",
         "points": [["1965", 3.07], ["1987", 500], ["1989-12", 900], ["1992", 2500]],
         "note": "1987 value is 'about 500'; 1992 value is 'over 2,500'."},
        {"id": "lbp_official_steps", "label": "Official LBP per US$, step dates", "unit": "LBP",
         "origin": "04-economy-evidence.md section 1 and 05 card 9", "source": "https://en.wikipedia.org/wiki/Lebanese_pound", "confidence": "verified",
         "points": [["1997-12", 1507.5], ["2023-02-01", 15000], ["2024-01-31", 89500], ["2026-09-30", 89500]],
         "note": "89,500 unchanged through Apr 2026 per BDL data (partly search summary). Held to 30 Sep 2026 on the chart as a flat line; later months not checked."},
        {"id": "power_sources_ab2024", "label": "Household backup power (Arab Barometer VIII, Feb-Apr 2024, n about 1,200)", "unit": "% of households",
         "origin": "04-economy-evidence.md section 4", "source": "https://www.arabbarometer.org/wp-content/uploads/AB8-Lebanon-Country-Report-EN.pdf", "confidence": "verified",
         "points": [["Generator subscription", 58], ["Solar", 27], ["Private generator", 7]]},
    ]
    long = json.load(open(R + "09-economy-longrun.series.json"))["series"]
    for s in long:
        s = dict(s)
        s["confidence"] = CONF.get(s.get("confidence"), s.get("confidence"))
        s["origin"] = "09-economy-longrun.series.json"
        if s["id"] == "lbp_usd_longrun":
            mk = []
            for d, v, note in s.pop("key_dates_market", []):
                d2 = re.sub(r"^(\d{4})-Q4$", r"\1-11", d)
                if d2 >= "2019" and not note.lower().startswith("official"):
                    mk.append([d2, v, note])
            extra.append({"id": "lbp_market_longrun", "label": "LBP per US$, parallel market (dated points)", "unit": "LBP",
                          "origin": "09-economy-longrun.series.json key_dates_market; 04 market data points",
                          "source": "https://en.wikipedia.org/wiki/Lebanese_liquidity_crisis", "confidence": "verified",
                          "points": mk})
        extra.append(s)
    return series + extra


def build_insights():
    txt = open(R + "09-economy-notes.md").read()
    sec = txt.split("## Glance insights", 1)[1] if "## Glance insights" in txt else ""
    sec = sec.split("\n## ", 1)[0]
    return [clean(m.group(1).strip()) for m in re.finditer(r"^\d+\.\s+(.+)$", sec, re.M)]


def build():
    events, nrows, dropped, unplaced, merge_log, nagr = build_events()
    ids = {e["id"] for e in events}
    ranked = []
    for rk, anchor, s, e, title, text, area, srcs in RANKED:
        assert anchor in ids, anchor
        ranked.append({"rank": rk, "anchor": anchor, "start": s, "end": e, "title": title, "text": text,
                       "area": area, "src": [{"l": a, "u": b, "c": c} for a, b, c in srcs]})
    series = build_series()
    pl_series, tables = v4.people_life_series()
    series += pl_series
    offices = v4.offices()
    eras = build_eras()
    extra = {}
    for o in offices:
        if o[6]:
            extra.setdefault(o[6], {"file": "Offices", "read": o[5] == "verified"})
    for s in series:
        for u in [s.get("source")] + list(s.get("sources") or []):
            if u and str(u).startswith("http"):
                extra.setdefault(u, {"file": "Data series", "read": s.get("confidence") == "verified"})
    for e in eras:
        if e.get("u"):
            extra.setdefault(e["u"], {"file": "Eras", "read": e["c"] == "verified"})
    for ev in events:
        ev.pop("keys", None)
    lib = v4.library(events, extra)
    return {"events": events, "rows": nrows, "ranked": ranked, "eras": eras, "series": series,
            "insights": build_insights(), "offices": offices, "tables": tables, "lib": lib,
            "_dropped": dropped, "_unplaced": unplaced, "_merges": merge_log, "_nagr": nagr}


def stats(events):
    lane = Counter(l for e in events for l in e["lanes"])
    conf = Counter(e["c"] for e in events)
    dec = Counter()
    for e in events:
        dec[int(e["t"] // 10 * 10)] += 1
    return lane, conf, dec


if __name__ == "__main__":
    d = build()
    print(len(d["events"]), "events from", d["rows"], "rows")
    lane, conf, dec = stats(d["events"])
    print("lanes", dict(lane))
    print("conf", dict(conf))
    print("decades", dict(sorted(dec.items())))
    print("dropped", d["_dropped"])
    print("unplaced", d["_unplaced"])
    print("insights", len(d["insights"]))
    for w in WARN:
        print("WARN", w)
