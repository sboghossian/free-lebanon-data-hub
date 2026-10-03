#!/usr/bin/env python3
"""Answer fields (type, place, actors) for every timeline row -> research/20-facets.jsonl.

Rows that already carry type/place keep them. For the rest, Jev makes two Choice calls in one
request (type, place). Actors come from a code gazetteer (organisations, states, parties, and every
office-holder in 30-offices.jsonl), never from a model. Keyed by "file:line", so it never edits the
research files the fixer agents are working on.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import jev  # noqa: E402

R = Path(os.environ.get("HUB_ROOT", Path(__file__).resolve().parent.parent)) / "research"

TYPES = {
    "war": "a war or armed conflict as a whole, or its start or end",
    "battle": "a specific battle, offensive, siege or military operation",
    "attack": "a bombing, strike, raid or armed attack (not an assassination)",
    "assassination": "the killing or attempted killing of a named public figure",
    "massacre": "the mass killing of civilians",
    "ceasefire": "a ceasefire, truce or end of hostilities",
    "occupation": "a foreign military presence or occupation starting or continuing",
    "withdrawal": "a foreign force withdrawing",
    "election": "a parliamentary, presidential or municipal election or vote for an office",
    "government": "a cabinet or prime minister taking office, or a new president in office",
    "resignation": "a government, prime minister or official resigning or falling",
    "vacuum": "a vacancy or deadlock in the presidency or government",
    "agreement": "a treaty, accord, pact, deal or memorandum signed",
    "un_resolution": "a UN Security Council or General Assembly resolution",
    "law": "a law passed, amended or repealed, or a constitutional change",
    "decree": "a decree, circular or regulation issued by the executive or central bank",
    "court": "a court ruling, indictment, investigation, trial or arrest",
    "protest": "a protest, demonstration, uprising or civil movement",
    "strike": "a labour strike or union action",
    "crisis": "an economic, financial or political crisis breaking out",
    "currency": "an exchange-rate move, devaluation, peg or currency policy",
    "banking": "a bank collapse, banking rule, deposit restriction or central bank event",
    "budget": "a state budget, public debt, default or fiscal measure",
    "aid": "a donor conference, aid package, loan or grant",
    "investment": "an investment, company founding, listing, acquisition or funding round",
    "trade": "trade, exports, imports, customs or a sanction affecting trade",
    "infrastructure": "infrastructure built or destroyed: port, airport, roads, water, buildings",
    "energy": "electricity, fuel, gas or energy supply",
    "disaster": "an explosion, fire, flood, earthquake or other disaster",
    "environment": "pollution, forests, waste, climate or protected nature",
    "health": "health, hospitals, epidemics or medicine",
    "education": "schools, universities or education policy",
    "migration": "emigration, brain drain, diaspora or return",
    "refugees": "refugees or displaced people",
    "demography": "population counts, census or demographic change",
    "media": "newspapers, television, radio or press freedom",
    "culture": "arts, music, festivals, food, tourism culture or heritage",
    "sport": "sport",
    "tech_launch": "a technology product, startup or tech programme launched",
    "telecom": "telephone, mobile, internet or broadband",
    "ai": "artificial intelligence",
    "science": "science or research achievement",
    "diplomacy": "diplomatic talks, recognition, relations or envoys",
    "visit": "an official or papal visit",
    "other": "none of the above fits",
}
PLACES = {
    "Beirut": "in Beirut or its suburbs (including Dahieh)",
    "South": "in South Lebanon or Nabatieh (south of the Awali or Litani, the border area)",
    "North": "in North Lebanon or Akkar (Tripoli and the north)",
    "Bekaa": "in the Bekaa Valley or Baalbek-Hermel",
    "Mount Lebanon": "in Mount Lebanon or the Chouf (outside Beirut)",
    "National": "country-wide, or a national decision with no single location",
    "Abroad": "outside Lebanon (another country, the UN, a foreign capital)",
}

ORGS = {
    "Syria": r"\bSyria[n]?\b|\bDamascus\b|\bAssad\b|al-Sharaa", "Israel": r"\bIsrael[i]?\b|\bIDF\b",
    "Hezbollah": r"\bHezbollah\b|\bHizbullah\b", "Amal": r"\bAmal\b", "PLO": r"\bPLO\b|\bFatah\b|\bPalestinian (?:fighters|factions|guerrillas)",
    "Palestinians": r"\bPalestinian", "Lebanese Forces": r"\bLebanese Forces\b", "Kataeb": r"\bKataeb\b|\bPhalang",
    "Free Patriotic Movement": r"\bFree Patriotic Movement\b|\bFPM\b", "Future Movement": r"\bFuture Movement\b",
    "PSP": r"\bProgressive Socialist\b|\bPSP\b", "LAF": r"\bLebanese (?:Army|Armed Forces)\b|\bLAF\b",
    "United States": r"\bUnited States\b|\bU\.S\.(?!\$)|\bUS\b(?!\$)|\bWashington\b|\bAmerican\b(?! University)", "France": r"\bFrance\b|\bFrench\b|\bParis\b",
    "Saudi Arabia": r"\bSaudi", "Iran": r"\bIran(?:ian)?\b|\bIRGC\b", "Qatar": r"\bQatar", "UAE": r"\bUAE\b|\bEmirat",
    "Egypt": r"\bEgypt", "Jordan": r"\bJordan", "Cyprus": r"\bCyprus|\bCypriot", "Turkey": r"\bTurk(?:ey|ish|iye)",
    "Iraq": r"\bIraq", "Russia": r"\bRussia|\bSoviet", "China": r"\bChin(?:a|ese)\b", "EU": r"\bEU\b|\bEuropean Union\b",
    "UN": r"\bUN\b|\bUnited Nations\b|\bSecurity Council\b|\bUNSC\b", "UNIFIL": r"\bUNIFIL\b", "UNHCR": r"\bUNHCR\b",
    "UNRWA": r"\bUNRWA\b", "IMF": r"\bIMF\b|\bInternational Monetary Fund\b", "World Bank": r"\bWorld Bank\b",
    "FATF": r"\bFATF\b", "Arab League": r"\bArab League\b", "BDL": r"\bBDL\b|\bBanque du Liban\b|\bcentral bank\b",
    "Parliament": r"\b[Pp]arliament\b|\bMPs?\b", "Cabinet": r"\b[Cc]abinet\b|\bCouncil of Ministers\b",
    "EDL": r"\bEDL\b|\bElectricit[eé] du Liban\b", "MEA": r"\bMEA\b|\bMiddle East Airlines\b", "MITAI": r"\bMITAI\b",
    "Ogero": r"\bOgero\b", "AUB": r"\bAUB\b|\bAmerican University of Beirut\b", "USJ": r"\bUSJ\b|\bSaint[- ]Joseph\b",
    "Intra Bank": r"\bIntra Bank\b|\bIntra\b(?!-)", "Solidere": r"\bSolidere\b", "STL": r"\bSpecial Tribunal\b|\bSTL\b",
}
COMMON = {"michel", "fouad", "rafic", "saad", "nabih", "emile", "amine", "elias", "camille", "charles",
          "joseph", "najib", "tammam", "salim", "selim", "rashid", "sami", "riad", "hassan", "ahmad"}


def office_patterns() -> dict[str, str]:
    """Every office-holder: match the full name, or a distinctive surname (≥5 letters)."""
    out = {}
    f = R / "30-offices.jsonl"
    if not f.exists():
        return out
    for line in f.open():
        if not line.strip():
            continue
        r = json.loads(line)
        name = (r.get("name") or "").strip()
        if not name or r.get("office") in ("Cabinet", "Parliament") or name.lower().startswith("vacuum"):
            continue
        parts = [p for p in re.split(r"\s+", name) if p]
        sur = parts[-1] if parts else ""
        pat = re.escape(name)
        if len(sur) >= 5 and sur.lower() not in COMMON:
            pat += r"|\b" + re.escape(sur) + r"\b"
        out[name] = pat
    return out


def actors_of(text: str, extra: dict[str, str]) -> list[str]:
    found = [k for k, p in {**ORGS, **extra}.items() if re.search(p, text)]
    # a surname match can hit several holders of the same family name: keep full-name hits when present
    full = [k for k in extra if k in text]
    if full:
        surs = {k.split()[-1] for k in full}
        found = [k for k in found if k in full or k in ORGS or k.split()[-1] not in surs]
    return found[:8]


def main():
    extra = office_patterns()
    rows = []
    for f in sorted(R.glob("*.timeline.jsonl")):
        for i, line in enumerate(f.open()):
            if line.strip():
                rows.append((f"{f.name}:{i}", json.loads(line)))

    def one(item):
        key, r = item
        text = f"{r.get('title','')}. {r.get('why','')}"
        out = {"key": key, "actors": sorted(set((r.get("actors") or []) + actors_of(text, extra)))}
        need_type = r.get("type") not in TYPES
        need_place = not r.get("place")
        if need_type or need_place:
            qs = {}
            if need_type:
                qs["type"] = {"type": "choice", "instructions": "Which kind of event is `event`? Pick the most specific fit.", "criteria": TYPES}
            if need_place:
                qs["place"] = {"type": "choice", "instructions": "Where in Lebanon did `event` happen, or where was it decided?", "criteria": PLACES}
            a = jev.ask({"event": {"date": r.get("date"), "title": r.get("title"), "why": r.get("why")}}, qs, cache="mitai-facets")["answers"]
            if need_type:
                out.update(type=a["type"]["choice"], type_conf=round(float(a["type"].get("confidence", 0)), 3), type_src="jev")
            if need_place:
                out.update(place=a["place"]["choice"], place_conf=round(float(a["place"].get("confidence", 0)), 3), place_src="jev")
        if not need_type:
            out.update(type=r["type"], type_src="row")
        if not need_place:
            out.update(place=r["place"], place_src="row")
        return out

    res = jev.pool(rows, one, workers=16)
    good = [x for x in res if isinstance(x, dict)]
    bad = [rows[i][0] for i, x in enumerate(res) if not isinstance(x, dict)]
    p = R / "20-facets.jsonl"
    tmp = p.with_suffix(".tmp")
    tmp.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in good) + "\n")
    tmp.replace(p)
    from collections import Counter
    print("facets:", len(good), "errors:", len(bad), "| types:", Counter(x["type"] for x in good).most_common(12))
    print("places:", Counter(x.get("place") for x in good), "| srcs:", Counter(x["type_src"] for x in good))
    print(jev.summary())


if __name__ == "__main__":
    main()
