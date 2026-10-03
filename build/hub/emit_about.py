"""About tab: what is in the Hub, how rows are checked, what is incomplete, how to cite, licences.
The numbers are not typed here: tab_about.js fills them from the build (counts, source verdicts, translation coverage), so the text never goes stale."""
import json, os

TAB = {"id": "about", "label": "About", "order": 80}

PANEL = '''<section class="hub-panel" id="about" role="tabpanel" aria-labelledby="t-about" hidden>
  <h2>About</h2>
  <div class="about">
  <p class="lead">The most complete free hub of data on Lebanon that we could build. Lebanese data is scattered, or was never published. So it is collected here, with a source on every row.</p>
  <dl class="about-stats" id="aboutStats" data-notr></dl>
  <h3>Who built it</h3>
  <p>Built by Stephane Boghossian with Claude.</p>
  <h3>What is in it</h3>
  <ul>
    <li>Timeline: events from 1800 to today, each with a date, a link to its source and a confidence tag.</li>
    <li>Strike map: documented incidents in the civil war, in 2006 and from 2023 to 2026.</li>
    <li>Places: a page for every village and town, with its strikes, events, municipality, registered voters, displacement and election district, and population estimates for each district.</li>
    <li>Cost of living and electricity: exchange rates, bread, fuel, generators, wages, prices by category, supply hours, production and night lights.</li>
    <li>World: Lebanon against the Middle East, Europe, the US and the world on dozens of indicators from 1960 to 2026, with flows of people, money and trade.</li>
    <li>Data: public Lebanese datasets, long-run series, elections, public money, the 2023 to 2026 war, fires, climate and an index of laws. Every file can be downloaded.</li>
  </ul>
  <h3>How rows are checked</h3>
  <ol>
    <li>Research agents read pages and write one row per fact: a date or a value, a link to the page and a confidence tag.</li>
    <li>Jev, a small model that judges text, checks that the page we cite says what the row says. Each source shows its verdict. Jev does not judge data pages.</li>
    <li>Audit passes, run by agents that did not write the rows, re-read samples against their sources and scan whole files for impossible values. Rows they find wrong are corrected, or dropped if the source contradicts them.</li>
    <li>Tags: verified means an agent read a source that states it. Reported means a source says so and we did not check. Inference means a likely reading, marked as one.</li>
  </ol>
  <dl class="about-stats" id="aboutJev" data-notr></dl>
  <h3>What is incomplete</h3>
  <p class="note">What we did about each gap, and what cannot be done.</p>
  <ul id="aboutGaps">
    <li><b>Timeline before 1920.</b> Done: four deeper passes over public-domain books, archives and Wikipedia add events for 1800 to 1830, 1831 to 1860, 1861 to 1890 and 1891 to 1919, each with a link to its page. Not possible: the further back, the fewer sources survive, and old books give their author's view, so these years stay thinner than later ones.</li>
    <li><b>Sources code cannot read.</b> Done: PDFs are read as text, archived copies on web.archive.org are used where a page is gone, and scanned books are read by OCR. Not possible: paywalls, bot blocks and dead links cannot be read, and we do not get around them. Rows still not machine-checked: <b id="aboutN" data-notr></b>.</li>
    <li><b>Strike map.</b> Done: hand-checked place corrections put more incidents on the map, and each war shows its official toll next to the incidents we documented: who counted, when, and a range only where both ends count the same thing. Not possible: no complete public record of the civil war exists, some incidents still have no usable place and are not drawn, and the mapped totals are not casualty counts.</li>
    <li><b>Places and population.</b> Done: each town shows its registered voters for 2014, labelled as registered voters and not residents, each district shows resident estimates from several sources, and more places have Arabic names. Not possible: Lebanon has had no census since 1932, so there is no true population count, we publish no resident estimate for a single place (a model we tried gave impossible results and was removed), and village names are still spelled in many ways.</li>
    <li><b>Cost of living and electricity.</b> Done: holes in fuel prices and generator fees are filled from ministry statements and press copies, marked with hollow dots and their source, and bread and generator prices per kWh are added. Supply hours are shown as a proxy, labelled as one, with its method. Not possible: there is no official series of electricity supply hours, the ministry's own pages hold no archive for the missing fuel dates, and some series are still dated points.</li>
    <li><b>World.</b> Done: values after a country's last actual year are dashed and shaded, UN projections are marked, and Lebanon's national figures can be laid over the international series, with their source. Not possible: Lebanon still has gaps in some years, national figures carry no open licence so they are left out of the downloads, and each indicator is as its source publishes it.</li>
    <li><b>Laws.</b> Done: the laws of 2025 are completed from the Parliament's site, and each law links to its full text and has an English title and summary. Not possible: the index holds titles, numbers, dates and summaries, never the article text; numbers before about 1960 are still partial, and a few recent laws may be absent.</li>
    <li><b>Elections.</b> Done: the 2026 election is shown as a fact card with its sources: postponed by Law 41/2026 of 9 March 2026, which extends parliament's term to 31 May 2028, and the Constitutional Council's decision of 7 April 2026. Not possible: there are no results, because no vote has been held, and no new date is set.</li>
    <li><b>Dataset catalogue.</b> Done: each dataset link shows when it was last checked and whether it was reachable, moved or unreachable. Not possible: a reachable link does not show that the file is current.</li>
  </ul>
  <h3>Languages</h3>
  <p>The interface and the content are in English, Arabic and French. Translations were made by language models, then checked by scripts and by sample audits. No native editor has read all of it yet. A text with no translation shows in English with a small EN mark. Names of candidates are not translated.</p>
  <dl class="about-stats" id="aboutLang" data-notr></dl>
  <h3>How to cite</h3>
  <p>Cite the hub, and the original source of any item you reuse. Each item links to it.</p>
  <p><code class="cite" id="citeText" data-notr></code> <button type="button" class="chip" id="citeCopy">Copy the citation</button> <span class="dim" id="citeDone" role="status" aria-live="polite"></span></p>
  <h3>Open source</h3>
  <p>The Hub's code and data are open. Anyone can fix a row, add a source or a dataset, or translate.</p>
  <ul class="about-oss">
    <li><a href="https://github.com/sboghossian/free-lebanon-data-hub" rel="noopener">The Hub on GitHub</a></li>
    <li><a href="https://github.com/sboghossian/free-lebanon-data-hub/blob/main/CONTRIBUTING.md" rel="noopener">How to contribute</a></li>
    <li><a href="https://github.com/sboghossian/free-lebanon-data-hub/issues" rel="noopener">Report a problem or suggest a dataset</a></li>
    <li>The code is under the MIT licence.</li>
    <li>The data is under CC BY-SA 4.0, unless a source says otherwise.</li>
  </ul>
  <h3>Licence</h3>
  <p>The data of the Hub is licensed CC BY-SA 4.0 unless a source says otherwise. You may copy and reuse it with credit to the Hub and to the original source, and you must share your changes under the same licence.</p>
  <ul>
    <li>The Data tab lists the licence of every file you can download.</li>
    <li>Wikipedia text and tables: CC BY-SA 4.0. World Bank, Open-Meteo and most Our World in Data series: CC BY 4.0. OCHA and UNHCR data: CC BY-IGO.</li>
    <li>IMF data keeps the IMF terms of use. NASA fire data is free to use with acknowledgement.</li>
    <li>ACLED data, if shown: attribution to ACLED is required, under its terms of use.</li>
    <li>Place names come from OCHA, GeoNames (CC BY 4.0) and OpenStreetMap contributors (ODbL).</li>
    <li>Where a source states no licence, only facts are republished, with attribution, and the file says so.</li>
  </ul>
  </div>
</section>'''


def _rows(ctx, rel):
    for m in ctx.manifest:
        if m["path"] == "data/" + rel:
            return m.get("rows") or 0
    return 0


def unchecked(research):
    """Rows whose source code could not read, from research/40-grounding.jsonl (verdict "unchecked"); None when the file is missing."""
    p = research + "40-grounding.jsonl"
    if not os.path.exists(p):
        return None
    n = 0
    with open(p, encoding="utf-8") as f:
        for line in f:
            try:
                n += json.loads(line).get("verdict") == "unchecked"
            except ValueError:
                pass
    return n


def emit(ctx):
    series = sum(_rows(ctx, r) for r in ["cost/fx.json", "cost/prices.json", "money/series.json", "people/series.json", "war/series.json", "electricity/power.json",
                                          "electricity/nightlights.json", "climate/climate.json", "portals/series.json"])
    countries = 0
    p = os.path.join(ctx.data_dir, "world", "index.json")
    if os.path.exists(p):
        ent = json.load(open(p, encoding="utf-8")).get("entities", {})
        countries = sum(1 for v in ent.values() if v.get("g") == 0)
    inline = {"series": series, "countries": countries, "laws": _rows(ctx, "laws/index.json"), "files": len(ctx.manifest) + 3, "unchecked": unchecked(ctx.research)}
    return {"panel": PANEL, "inline": inline}
