"""FE-D tool: translate the content strings that gap.py lists into Arabic and French with headless `claude -p` (text in, JSON out, no tools),
validate them, and merge into build/i18n/ui_content.json ({English: {"ar", "fr"}}). Re-runnable: strings already translated are skipped.
Usage: python3 build/i18n_tools/translate.py gap.json [--only=kind,kind] [--workers=6]"""
import concurrent.futures as cf, glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(HERE, "..", "i18n")
OUT = os.path.join(UI_DIR, "ui_content.json")
GLOSS = """Glossary (Arabic / French): EDL = كهرباء لبنان / EDL; BDL = مصرف لبنان / BDL; CAS = إدارة الإحصاء المركزي / Administration centrale de la statistique; MoF = وزارة المالية / ministère des Finances;
MoPH = وزارة الصحة العامة / ministère de la Santé publique; LBP = ليرة لبنانية (ليرة) / LBP; USD = دولار أميركي / USD; IMF = صندوق النقد الدولي / FMI; World Bank = البنك الدولي / Banque mondiale;
UN = الأمم المتحدة / ONU; UNHCR = المفوضية السامية للأمم المتحدة لشؤون اللاجئين / HCR; UNRWA = الأونروا / UNRWA; WHO = منظمة الصحة العالمية / OMS; OCHA = أوتشا / OCHA; CPI = مؤشر أسعار المستهلك / IPC;
GDP = الناتج المحلي الإجمالي / PIB; WEO = آفاق الاقتصاد العالمي / WEO; EDL supply = تغذية كهرباء لبنان; Hub = المركز / le Hub; qada / caza = قضاء / caza; governorate = محافظة / gouvernorat; mukhtar = مختار / mukhtar."""
RULES = """You translate short data labels and notes of a public Lebanon data hub from English into Arabic (Modern Standard Arabic, clear and neutral, as used in Lebanese official statistics) and French.
Rules: keep every number, year, date, percentage, code, URL, dataset or file name and Latin acronym without a common Arabic form (ERA5, VIIRS, UCDP, FRED, SDMX, GWh, kWh, MW) exactly as written, using Western digits 0-9 in both languages.
Keep units and parentheses in the same order. Do not add, drop or soften any information. Do not translate personal names; transliterate them into Arabic script only when the person is a well known public figure. Use the real, official name of Lebanese parties, blocs and institutions where one exists.
Placeholders in curly braces stay untouched. French uses a space before : ; ! ? and « » guillemets only when quoting. """


def load_existing():
    d = {}
    for p in glob.glob(os.path.join(UI_DIR, "ui*.json")):
        for k, v in json.load(open(p, encoding="utf-8")).items():
            if not k.startswith("_") and v.get("ar") and v.get("fr"):
                d[k] = v
    return d


def ask(batch, model):
    items = "\n".join(json.dumps({"i": i, "en": s}, ensure_ascii=False) for i, s in enumerate(batch))
    prompt = f"{RULES}\n{GLOSS}\n\nTranslate each item. Reply with ONLY a JSON array, one object per item, in the same order: " \
             f'[{{"i": 0, "ar": "...", "fr": "..."}}, ...]. No commentary, no markdown fences.\n\nITEMS:\n{items}\n'
    r = subprocess.run(["claude", "-p", "--model", model, "--tools", "", "--no-session-persistence", "--disable-slash-commands", "--strict-mcp-config", "--output-format", "text"],
                       input=prompt, capture_output=True, text=True, timeout=900)
    txt = r.stdout.strip()
    m = re.search(r"\[.*\]", txt, re.S)
    if not m:
        raise ValueError("no JSON array: " + txt[:200] + r.stderr[:200])
    return json.loads(m.group(0))


def _norm_num(s):   # thousand separators (comma, spaces, Arabic ٬) and the decimal comma/٫ differ by language: compare numbers without them
    s = re.sub(r"(?<=\d)[,\s\u202f\u00a0\u066c](?=\d{3}(?!\d))", "", s)
    return re.sub(r"(?<=\d)[,\u066b](?=\d{1,2}(?!\d))", ".", s)


def nums(s):   # small whole numbers may become words ("round 1" -> "الجولة الأولى"); years, decimals and large figures must survive
    return sorted(x for x in re.findall(r"\d+(?:[.,]\d+)*", _norm_num(s)) if len(x) >= 3 or "." in x or "," in x)


def bad(en, ar, fr):
    why = []
    if not ar or not fr:
        return ["empty"]
    if not re.search(r"[؀-ۿ]", ar):
        why.append("ar has no Arabic letters")
    if re.search(r"[٠-٩]", ar):
        ar2 = ar.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    else:
        ar2 = ar
    if nums(en) != nums(ar2):
        why.append(f"ar numbers {nums(en)} vs {nums(ar2)}")
    if nums(en) != nums(fr.replace(" ", "").replace(" ", " ")) and nums(en) != nums(re.sub(r"(?<=\d)[  ](?=\d{3})", "", fr)):
        why.append(f"fr numbers {nums(en)} vs {nums(fr)}")
    if len(en) > 30 and fr.strip() == en.strip() and not re.fullmatch(r"[A-Z][\w' -]+(, [A-Z][\w' -]+)+", en):
        why.append("fr unchanged")
    if len(ar) > 3 * len(en) + 40:
        why.append("ar too long")
    return why


def run(batch, model, tries=2):
    last = None
    for _ in range(tries):
        try:
            res = ask(batch, model)
            by = {r["i"]: r for r in res if isinstance(r, dict) and "i" in r}
            good, redo = {}, []
            for i, s in enumerate(batch):
                r = by.get(i)
                w = bad(s, (r or {}).get("ar", ""), (r or {}).get("fr", ""))
                if w:
                    redo.append((s, w))
                else:
                    good[s] = {"ar": r["ar"].strip(), "fr": r["fr"].strip()}
            if good:
                return good, redo
            last = redo
        except Exception as e:  # network, JSON
            last = [(batch[0], [str(e)[:200]])]
    return {}, last or []


def main():
    gap = json.load(open(sys.argv[1], encoding="utf-8"))
    only = next((a[7:].split(",") for a in sys.argv if a.startswith("--only=")), None)
    workers = int(next((a[10:] for a in sys.argv if a.startswith("--workers=")), 6))
    model = next((a[8:] for a in sys.argv if a.startswith("--model=")), "sonnet")
    have = load_existing()
    cur = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    todo = []
    for kind, strings in gap.items():
        if only and kind not in only:
            continue
        todo += [(kind, s) for s in strings if s not in have and s not in cur]
    long_kinds = {"dl_source", "dl_license", "series_note", "election_text", "people_extra", "places_text", "event", "war_table"}
    batches, curb, size = [], [], 0
    for kind, s in sorted(todo, key=lambda x: (x[0] in long_kinds, x[0])):
        cap, mx = (3500, 10) if kind in long_kinds else (3500, 45)
        if curb and (size + len(s) > cap or len(curb) >= mx):
            batches.append(curb); curb, size = [], 0
        curb.append(s); size += len(s)
    if curb:
        batches.append(curb)
    print(len(todo), "strings in", len(batches), "batches", flush=True)
    failed = []
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(run, b, model): b for b in batches}
        for n, f in enumerate(cf.as_completed(futs), 1):
            good, redo = f.result()
            cur.update(good)
            failed += redo
            json.dump(dict(sorted(cur.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"batch {n}/{len(batches)}: {len(good)} ok, {len(redo)} rejected", flush=True)
    if failed:
        print("REJECTED", len(failed))
        json.dump([{"en": s, "why": w} for s, w in failed], open(os.path.join(HERE, "rejected.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
