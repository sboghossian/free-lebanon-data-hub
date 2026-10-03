"""Timeline tab. The core timeline data (events, ranked, eras, series, offices) stays embedded in the page shell, so the main
experience never depends on a fetch. This emitter returns the panel markup and writes the CSV downloads (timeline and core series)."""
import re, sys
sys.path.insert(0, ".")
import timeline_panel
from hub.lib import safe_name

TAB = {"id": "timeline", "label": "Timeline", "order": 10}
SRC_NOTE = "Compiled by the Hub from the sources linked on each row (mostly Wikipedia, plus official and press sources)"


def panel(ctx):
    d, n = ctx.d, len(ctx.d["events"])
    sec = timeline_panel.panel_timeline(d)

    def cut(pat, repl="", count=1, flags=re.S):
        nonlocal sec
        sec, k = re.subn(pat, repl, sec, count=count, flags=flags)
        assert k == count, (pat, k)
    cut(r'\n\s*<div id="ansRail".*?</div>')                      # answer rail
    cut(r'\n\s*<div id="claimNote".*?</div>')                    # answer lane note
    cut(r'\n\s*<div class="tl-detail" id="tlDetail".*?</div>')   # persistent detail block
    cut(r'\n\s*<h3 id="listH">.*?</h3>')                         # "All events in view"
    cut(r'\n\s*<div id="tlList".*?</div>')                       # event list
    cut(r'(role="tabpanel" aria-labelledby="t-timeline") hidden>', r'\1>')
    cut(r'\n\s*<p class="eyebrow">.*?</p>')                       # the hub header carries the eyebrow
    cut(r'<p class="lead">.*?</p>', '<p class="lead" id="tlLead" data-notr></p>')   # filled by hub_tabs.js (the count is live)
    sec = sec.replace('min="1920"', 'min="1800"').replace('placeholder="1920"', 'placeholder="1800"')
    cut(r'(<div id="yearCard".*?</div>)', r'\1<div id="evCard" class="ycard evcard" role="dialog" aria-label="Event detail" hidden></div>')
    for gone in ("tlDetail", "tlList", "listH", "claimNote", "ansRail"):
        assert gone not in sec, gone
    return sec


def emit(ctx):
    d = ctx.d
    ev_rows = []
    for e in d["events"]:
        p0 = (e.get("parts") or [{}])[0]
        urls = []
        for p in e.get("parts") or []:
            if p.get("u") and p["u"] not in urls:
                urls.append(p["u"])
        ev_rows.append([e["id"], e.get("date"), e.get("prec"), e.get("title"), (p0.get("why") or ""), "; ".join(e.get("ty") or []), "; ".join(e.get("lanes") or []),
                        e.get("pl") or "", "; ".join(e.get("ac") or []), e.get("w"), e.get("c"), " ".join(urls[:6])])
    ctx.write_csv("csv/timeline.csv", ["id", "date", "date_precision", "title", "why", "types", "tracks", "place", "actors", "weight", "confidence", "source_urls"],
                  ev_rows, f"Timeline: {len(ev_rows):,} events of Lebanon, 1800 to 30 Sep 2026", SRC_NOTE)
    for s in d["series"]:
        ctx.add_series("timeline-bands", safe_name("core-" + str(s["id"])), s.get("label") or s["id"], s.get("unit") or "", "", s.get("source") or "", None, s.get("points") or [])
    return {"panel": panel(ctx), "inline": {}}
