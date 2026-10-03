"""D7 builder, part 4: ABL 'Key Indicators' PDFs (commercial banks' balance sheet, deposits, BDL FC reserves).
Reads cache/hub-D7/abl/Exe_sum_*.txt (pdftotext -layout output)."""
import glob, json, os, re
from datetime import datetime
C = os.path.join(os.environ.get("HUB_ROOT", "."), "cache/hub-D7")
MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
num = lambda s: -float(s.strip("()").replace(",", "")) if s.startswith("(") else float(s.replace(",", ""))
NUM = r"\(?\d[\d,]*\.?\d*\)?"

bs = {}      # (key, 'YYYY-MM') -> LBP billion
ind = {}     # (key, 'YYYY-MM') -> USD million
wk_fc = {}   # 'YYYY-MM-DD' -> USD million
wk_lbp = {}  # date -> (demand, time, total) LBP billion
ITEMS = [
    (r"1- Deposits of Commercial Banks at BDL", "bdl_dep"), (r"2- Claims on Resident Private Sector", "claims_priv"),
    (r"3- Claims on Public Sector", "claims_pub"), (r"4- Foreign Assets", "foreign_assets"),
    (r"5- Resident Private Sector Deposits", "res_dep"), (r"6- Public Sector Deposits", "pub_dep"),
    (r"7- Deposits of Non Resident Private Sector", "nr_dep"), (r"8- Non Resident Financial Sector Liabilities", "nr_fin_liab"),
    (r"9- Capital Accounts", "capital"), (r"10- Other Liabilities", "other_liab"),
    (r"11- Total \(Assets = Liabilities\)", "total"),
]


def ym(tok):
    m, y = tok.split("-")
    return f"{y}-{MON[m]:02d}"


def fkey(f):
    n = os.path.basename(f)
    y = int(re.findall(r"20\d\d", n)[-1])
    ms = [MON[m.capitalize()] for m in re.findall(r"(?i)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)", n)]
    return (y, ms[-1] if "2026" in n and False else ms[-1])


for f in sorted(glob.glob(f"{C}/abl/Exe_sum_*.txt"), key=fkey):  # oldest first; later bulletins overwrite (revisions)
    L = open(f, errors="ignore").read().split("\n")
    # --- indicators block: header with a year column then Mon-YYYY columns ---
    sec = None
    hdr = None
    for i, ln in enumerate(L):
        s = re.sub(r"\s+", " ", ln).strip()
        m = re.match(r"^(20\d\d|2023) ((?:[A-Z][a-z]{2}-20\d\d ?){2,4})$", s)
        if m and hdr is None and "Consolidated" not in "".join(L[max(0, i - 3):i]):
            hdr = (m.group(1), m.group(2).split())
        if hdr:
            mm = re.match(r"^\d+- (BDL [A-Za-z ]+?) \(end of period\)\s*(?:\d)?\s*((?:" + NUM + r" ?){3,5})$", s) or \
                re.match(r"^(?:\d )?\d+- (BDL [A-Za-z ]+?) \(end of period\) ?\d? ((?:" + NUM + r" ?){3,5})$", s)
            if mm:
                vals = mm.group(2).split()
                cols = ["%s-12" % hdr[0]] + [ym(t) for t in hdr[1]]
                if len(vals) == len(cols):
                    for c, v in zip(cols, vals):
                        ind[(mm.group(1).strip(), c)] = num(v)
    # --- balance sheet ---
    cols = None
    for i, ln in enumerate(L):
        s = re.sub(r"\s+", " ", ln).strip()
        if s.startswith("Consolidated Balance Sheet of Commercial Banks"):
            for j in range(i + 1, i + 6):
                t = re.findall(r"[A-Z][a-z]{2}-20\d\d", L[j])
                if len(t) >= 3:
                    cols = [ym(x) for x in t]
                    break
            continue
        if cols:
            for pat, key in ITEMS:
                m = re.match(r"^" + pat + r"\s+((?:" + NUM + r" ?){3,5})", s)
                if m and len(m.group(1).split()) == len(cols):
                    for c, v in zip(cols, m.group(1).split()):
                        bs[(key, c)] = num(v)
            m = re.match(r"^- in (LBP|FC) ((?:" + NUM + r" ?){3,5})$", s)
            if m and len(m.group(2).split()) == len(cols):
                # attribute to the last seen parent item
                for c, v in zip(cols, m.group(2).split()):
                    bs[(last + "_" + m.group(1).lower(), c)] = num(v)
            for pat, key in ITEMS:
                if re.match(r"^" + pat, s):
                    last = key
    # --- weekly deposits ---
    mode = None
    for ln in L:
        s = re.sub(r"\s+", " ", ln).strip()
        if "Resident Private Sector Deposits in LBP" in s:
            mode = "lbp"
        elif "Resident Private Sector Deposits in FC" in s:
            mode = "fc"
        d = re.match(r"^(\d{1,2})/(\d{1,2})/(20\d\d) ((?:" + NUM + r" ?)+)", s)
        if d and mode:
            iso = f"{d.group(3)}-{int(d.group(1)):02d}-{int(d.group(2)):02d}"
            v = d.group(4).split()
            if mode == "fc":
                wk_fc[iso] = num(v[0])
            elif len(v) >= 3:
                wk_lbp[iso] = (num(v[0]), num(v[1]), num(v[2]))

rate = lambda c: 15000.0 if c <= "2023-12" else 89500.0
S = []
ABL = "https://www.abl.org.lb/english/lebanese-banking-sector/main-indicators"
bn = ("Association of Banks in Lebanon (ABL) 'Key Indicators' bulletins, from BDL data. Consolidated balance sheet of commercial banks, end of month, "
      "foreign-currency items translated at the legal rate in force (LBP 89,500 per USD from 31 Jan 2024 per BDL Circular 167; LBP 15,000 for "
      "Dec 2023), so USD amounts are accounting values, not market values. Covers Dec 2023 and Sep 2024 - Jul 2026 only (bulletins found); "
      "latest figure in this build is the last month listed. ")


def add(id, label, unit, freq, pts, notes, src=ABL):
    pts = sorted([[t, v] for t, v in pts])
    if pts:
        S.append(dict(id=id, label=label, unit=unit, topic="public-money", freq=freq, source_url=src, license=None, points=pts, notes=notes))


names = {"total": "Commercial banks: total assets (= liabilities)", "res_dep": "Commercial banks: resident private-sector deposits",
         "res_dep_fc": "Commercial banks: resident private-sector deposits in foreign currency",
         "nr_dep": "Commercial banks: non-resident private-sector deposits", "nr_dep_fc": "Commercial banks: non-resident deposits in foreign currency",
         "pub_dep": "Commercial banks: public-sector deposits", "bdl_dep": "Commercial banks: deposits at BDL",
         "claims_priv": "Commercial banks: claims on the resident private sector (loans)", "claims_pub": "Commercial banks: claims on the public sector",
         "foreign_assets": "Commercial banks: foreign assets", "capital": "Commercial banks: capital accounts"}
for k, lab in names.items():
    pts = [(c, round(v / rate(c) * 1000, 0)) for (kk, c), v in bs.items() if kk == k]
    add("d7-abl-" + k.replace("_", "-") + "-usd", lab, "USD million (at legal rate)", "monthly", pts, bn)
add("d7-abl-res-dep-lbp-lbp", "Commercial banks: resident private-sector deposits in LBP", "LBP billion", "monthly",
    [(c, v) for (kk, c), v in bs.items() if kk == "res_dep_lbp"], bn.split(" Covers")[0] + " Covers Dec 2023 and Sep 2024 - Jul 2026 only.")
for lab_key, sid in [("BDL FC Gross Reserves", "d7-bdl-fc-gross-reserves-abl"), ("BDL Foreign Currencies", "d7-bdl-foreign-currencies-abl"),
                     ("BDL Foreign Securities", "d7-bdl-foreign-securities-abl")]:
    pts = [(c, v) for (k, c), v in ind.items() if k == lab_key]
    add(sid, lab_key + " (end of period)", "USD million", "monthly", pts,
        "ABL Key Indicators, from BDL. Definition revised from January 2024 (BDL Central Council decision 37/20/24 of 13 Sep 2024): foreign assets "
        "include monetary gold, non-resident foreign securities and deposits with correspondents; they exclude Lebanese sovereign bonds and BDL "
        "FX loans to resident banks. Not comparable with older BDL gross reserves.")
add("d7-abl-res-dep-fc-weekly-usd", "Resident private-sector deposits in foreign currency at commercial and MLT banks (weekly)", "USD million",
    "weekly", list(wk_fc.items()), "ABL Key Indicators weekly table, from BDL; foreign-currency deposits in US dollars, as published (no rate conversion).")
add("d7-abl-res-dep-lbp-weekly", "Resident private-sector deposits in LBP at commercial and MLT banks, total (weekly)", "LBP billion", "weekly",
    [(d, v[2]) for d, v in wk_lbp.items()], "ABL Key Indicators weekly table, from BDL.")
json.dump(S, open(f"{C}/part4_abl.json", "w"))
print(len(S), "series; balance-sheet cells", len(bs), "indicator cells", len(ind), "weekly fc", len(wk_fc), "weekly lbp", len(wk_lbp))
for s in S: print(s["id"], len(s["points"]), s["points"][0], s["points"][-1])
