"""Markup of the Timeline tab (the filter bar, the chart and the year card). hub/emit_timeline.py trims it before use."""
import html


def e(s):
    return html.escape(s, quote=True)


HINTS = ["president:Chehab", "pm:Hariri", "type:assassination", "actor:Syria", "place:South", "law:81/2018", "year:1987",
         "from:1975 to:1990", "agreement:Taif"]
PRESETS = [("assassinations", "Every assassination"), ("agreements", "Every agreement signed"), ("currency", "Currency shocks"),
           ("wars", "Wars and what the economy did next"), ("banking", "Banking laws and bank crises"),
           ("leaving", "Waves of leaving"), ("fell", "Governments that fell"), ("firsts", "Firsts in technology"),
           ("vacuums", "Vacuums and what stalled"), ("life", "Life in Lebanon")]


def panel_timeline(d):
    n, rows = len(d["events"]), d["rows"]
    ins = "".join(f"<li>{e(t)}</li>" for t in d["insights"])
    hints = "".join(f'<button type="button" class="hint" data-hint="{e(h)}">{e(h)}</button>' for h in HINTS)
    presets = "".join(f'<button type="button" class="chip pre" data-preset="{k}" aria-pressed="false">{e(l)}</button>' for k, l in PRESETS)
    return f'''
<section class="panel wide" id="timeline" role="tabpanel" aria-labelledby="t-timeline" hidden>
  <div class="tl-head">
    <p class="eyebrow">Lebanon, 1920 to 30 Sep 2026</p>
    <h2>Timeline</h2>
    <p class="lead">{n:,} events from {len(__import__("data").FILES)} research files and a list of {d["_nagr"]} agreements ({rows} timeline rows; duplicates merged, a few left out by rule). Six PESTEL tracks, agreements, life in Lebanon and three context tracks, with the economy, the people and prices underneath. Filter to isolate a pattern; tap a year for who governed and what life cost.</p>
  </div>
  <div class="fbar" id="fbar">
    <div class="fb-row">
      <div class="seg" role="group" aria-label="Time span" id="zoomCtl"></div>
      <div class="fsearch"><label class="vh" for="q">Search the timeline</label><input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="Search: Taif, Hariri, law:81/2018, president:Chehab" aria-describedby="qHints"></div>
      <button type="button" class="chip more" id="moreBtn" aria-expanded="false" aria-controls="drawer">More filters</button>
    </div>
    <div class="hints" id="qHints"><span class="k">Try</span>{hints}</div>
    <div class="drawer" id="drawer" hidden>
      <div class="dr-grid">
        <fieldset class="dr-types"><legend>Type</legend><div id="typeCtl"></div></fieldset>
        <div class="dr-col">
          <fieldset><legend>Actor</legend><input id="actorQ" type="search" autocomplete="off" placeholder="Find an actor" aria-label="Find an actor"><div class="chips sm" id="actorCtl"></div></fieldset>
          <fieldset><legend>Place</legend><div class="chips sm" id="placeCtl"></div></fieldset>
        </div>
        <div class="dr-col">
          <fieldset><legend>In office</legend>
            <label class="sel" for="presSel">President <select id="presSel"></select></label>
            <label class="sel" for="pmSel">Prime minister <select id="pmSel"></select></label>
            <label class="sel" for="govSel">BDL governor <select id="govSel"></select></label>
          </fieldset>
          <fieldset><legend>Era</legend><label class="sel" for="eraSel">Period <select id="eraSel"></select></label></fieldset>
          <fieldset><legend>Dates</legend><div class="yrs"><label class="sel" for="fromY">From <input id="fromY" type="number" min="1920" max="2026" inputmode="numeric" placeholder="1920"></label><label class="sel" for="toY">to <input id="toY" type="number" min="1920" max="2026" inputmode="numeric" placeholder="2026"></label></div><p class="note">Or drag across the year axis on the chart.</p></fieldset>
        </div>
        <div class="dr-col">
          <fieldset><legend>Evidence</legend>
            <label class="sel" for="confCtl">Agent tag <select id="confCtl"><option value="all">all tags</option><option value="noinf">hide inference</option><option value="ver">verified only</option></select></label>
            <label class="sel" for="weightCtl">Weight <select id="weightCtl"><option value="0">default for the view</option><option value="1">all events</option><option value="2">weight 2 and 3</option><option value="3">key events only</option></select></label>
            <span class="k gk">Jev grounding</span><div class="chips sm" id="grCtl"></div>
          </fieldset>
          <fieldset><legend>Office strips</legend><div class="chips sm" id="stripCtl"></div></fieldset>
        </div>
      </div>
    </div>
    <div class="presets" id="presets" role="group" aria-label="Pattern presets"><span class="k">Patterns</span>{presets}</div>
    <div class="active" id="activeF" aria-live="polite"></div>
    <div class="chips" id="laneCtl" role="group" aria-label="Tracks"></div>
  </div>
  <div id="presetNote" class="preset-note" hidden></div>
  <div id="ansRail" class="ans-rail" role="group" aria-label="The answer: 20 claims" hidden></div>
  <div id="claimNote" class="claim-note" aria-live="polite"></div>
  <div class="tl-wrap"><div id="tl" class="tl"></div><div id="yearCard" class="ycard" role="dialog" aria-label="Year context" hidden></div></div>
  <div class="band-ctl" id="bandCtl" role="group" aria-label="Bands under the tracks"></div>
  <div class="tl-legend" id="tlLegend"></div>
  <div class="tl-detail" id="tlDetail" aria-live="polite"></div>
  <h3 id="listH">All events in view</h3>
  <div id="tlList" class="tl-list"></div>
</section>'''
