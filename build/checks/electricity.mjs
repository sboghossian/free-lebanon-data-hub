// Checks for the Electricity tab (FE-B): public power, night-light map by governorate, climate and fire hotspots, the fire layer on the Strike map, source and licence on every chart, 390 px, Arabic, empty and error states.
// A few long-lived pages walk through the views by hash, so the suite stays short.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE } = T;
  const VIEWS = [['#electricity', '#elView .fb-card', 8], ['#electricity/lights', '#elLg .fb-card', 3], ['#climate', '#elView .fb-card', 5]];
  const go = async (p, h, sel, min) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`document.querySelectorAll(${JSON.stringify(sel)}).length >= ${min} && !document.querySelector("#elView .hub-load")`, 30000); };
  const count = 'document.getElementById("fbFireCv") ? (() => { const cv = document.getElementById("fbFireCv"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })() : -1';

  const p = await open(1400, SITE, { hash: '#electricity' });
  ok('electricity: opens by deep link with three view chips (no "All series" view)', await p.wait('!document.getElementById("electricity").hidden && document.querySelectorAll("#elNav [data-id]").length === 3 && !document.querySelector("#elNav [data-id=all]")', 15000));
  ok('electricity: one "Data behind this tab" link to #data/electricity, and no series table', await p.ev('document.querySelectorAll("#electricity a[href=\\"#data/electricity\\"]").length === 1 && !document.getElementById("elAll")'));
  ok('electricity: supply-hours chart plots the dated statements as separate series with a legend', await p.wait('document.querySelectorAll("#elView .fb-card.wide .hc-lg li").length >= 6', 15000));
  ok('electricity: four stat tiles and the honest note that no official hours series exists', await p.ev('document.querySelectorAll("#elView .fb-stat").length === 4 && /no official time series/.test(document.querySelector("#elView .fb-note-band").textContent)'));
  ok('electricity: every chart card shows its source and licence', await p.ev('[...document.querySelectorAll("#elView .fb-card")].filter(c => c.querySelector(".hc-svg")).every(c => /Source/.test(c.querySelector(".fb-src")?.textContent || "") && /Licence/.test(c.querySelector(".fb-src")?.textContent || ""))'));
  ok('electricity: generator subscription in dollars is charted from the cost data', await p.ev('[...document.querySelectorAll("#elView .fb-t")].some(h => /Generator subscription/.test(h.textContent))'));
  ok('electricity: blackout milestones list has dated entries with source links', await p.ev('document.querySelectorAll("#elView .fb-ev li").length >= 8 && !!document.querySelector("#elView .fb-ev a")'));
  for (const [h, sel, min] of VIEWS.slice(1)) ok(`electricity: ${h} renders at least ${min} items`, await go(p, h, sel, min));

  // night lights
  await go(p, '#electricity/lights', '#elMap .fb-a[data-p]', 8);
  ok('electricity: the night-light map draws the eight governorates and a Beirut marker', await p.ev('document.querySelectorAll("#elMap .fb-a[data-p]").length === 8 && document.querySelectorAll("#elMap circle.fb-a").length === 1'));
  const t19 = await p.ev('document.querySelector("#elTbl tbody tr:nth-child(2) td:nth-child(3)").textContent');
  await p.ev('(() => { const i = document.getElementById("elYr"); i.value = "2022"; i.dispatchEvent(new Event("input")); })()'); await sleep(250);
  ok('electricity: the year slider changes the map table (Beirut is dimmer in 2022 than in 2019)', await p.ev(`(() => { const v = parseFloat(document.querySelector("#elTbl tbody tr:nth-child(2) td:nth-child(3)").textContent); return v < parseFloat(${JSON.stringify(t19)}) && document.getElementById("elYrO").textContent.includes("2022"); })()`));
  ok('electricity: the headline sentence is computed from the data (peak, low and latest years)', await p.ev('/highest around 2019/.test(document.querySelector("#elLg .fb-note-band").textContent) && /fell to/.test(document.querySelector("#elLg .fb-note-band").textContent)'));
  ok('electricity: the night-light map has a legend and a source and licence line (open database licence)', await p.ev('!!document.querySelector("#elMap .fb-leg") && /Licence/.test(document.querySelector("#elMap .fb-src").textContent) && /(Open Database|ODbL)/.test(document.querySelector("#elMap .fb-src").textContent)'));

  // climate and fires
  await go(p, '#climate', '.fb-stripes rect', 50); await p.wait('document.querySelectorAll("#elFmap rect").length > 20', 30000);
  ok('electricity: warming stripes draw one bar for each full year (86 for 1940 to 2025)', await p.ev('document.querySelectorAll(".fb-stripes rect").length >= 80'));
  const s0 = await p.ev('document.querySelectorAll("#elClTop .fb-stat dd")[0].textContent');
  await p.ev('document.querySelector("#elPl [data-id=the_cedars]").click()'); await sleep(250);
  ok('electricity: choosing a place changes the climate figures', (await p.ev('document.querySelectorAll("#elClTop .fb-stat dd")[0].textContent')) !== s0);
  ok('electricity: fire hotspot map has grid cells and honest wording (a detection, not a fire)', await p.ev('document.querySelectorAll("#elFmap rect").length > 20 && /not a fire/.test(document.querySelector("#elFi").textContent)'));
  const n0 = await p.ev('document.querySelectorAll("#elFmap rect").length');
  await p.ev('(() => { const s = document.getElementById("elSens"); s.value = "viirs"; s.dispatchEvent(new Event("change")); })()'); await sleep(250);
  ok('electricity: the sensor choice redraws the fire map and keeps VIIRS to 2012 on', await p.ev(`document.getElementById("elF0").value === "2012" && document.querySelectorAll("#elFmap rect").length !== ${n0}`));
  ok('electricity: fires per year has one line for each sensor, with the warning not to compare them', await p.ev('document.querySelectorAll("#elFi .fb-card.wide .hc-line").length === 2 && /never one sensor with the other/.test(document.querySelector("#elFi .fb-card.wide").textContent)'));

  // the fire layer on the Strike map (same page)
  await p.ev('location.hash = "#map"');
  ok('electricity: the Strike map gets a NASA fire-hotspots toggle in its side panel', await p.wait('!!document.getElementById("fbFireOn")', 30000));
  await p.ev('document.getElementById("fbFireOn").click()'); await sleep(1500);
  ok('electricity: switching the layer on draws hotspot squares on the map canvas', (await p.ev(count)) > 500);
  ok('electricity: the layer shows its count and the NASA archive span', await p.ev('/detections/.test(document.getElementById("fbFireNote").textContent) && /2024/.test(document.getElementById("fbFireNote").textContent)'));
  await p.ev('(() => { const a = document.getElementById("mpT0"), b = document.getElementById("mpT1"); a.value = "2026-03-01"; b.value = "2026-03-02"; a.dispatchEvent(new Event("change")); b.dispatchEvent(new Event("change")); })()'); await sleep(600);
  ok('electricity: the layer follows the time brush (none for 2026, which NASA has not published)', (await p.ev(count)) === 0 && await p.ev('/No fire hotspots/.test(document.getElementById("fbFireNote").textContent)'));
  await p.ev('document.getElementById("mpTR").click()'); await sleep(500);
  ok('electricity: clearing the period brings the squares back, and zooming redraws them (redraw hook)', await (async () => { const a = await p.ev(count); await p.ev('document.querySelector("#mpStage .mp-zoom [data-z=\\"1.6\\"]").click()'); await sleep(400); const b = await p.ev(count); return a > 500 && b > 0 && b !== a; })());
  await p.ev('document.getElementById("fbFireOn").click()'); await sleep(300);
  ok('electricity: switching the layer off clears the canvas', (await p.ev(count)) === 0);
  ok('electricity: 0 console errors across the tab and the Strike map layer at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // 390 px
  const m = await open(390, SITE, { hash: '#electricity' });
  for (const [h, sel, min] of VIEWS) {
    await go(m, h, sel, min); await sleep(1200);
    ok(`electricity: ${h} has no horizontal overflow at 390`, (await m.ev('document.documentElement.scrollWidth')) <= 390);
  }
  await m.ev('location.hash = "#map"'); await m.wait('!!document.getElementById("fbFireOn")', 30000);
  ok('electricity: the fire toggle fits on the Strike map at 390', (await m.ev('document.documentElement.scrollWidth')) <= 390);
  ok('electricity: 0 console errors at 390', m.errors().length === 0, m.errors());
  await m.close();

  // Arabic
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#electricity' });
  await a.wait('document.querySelectorAll("#elView .fb-card, #elView .fb-stat").length > 2', 25000); await sleep(800);
  ok('electricity: Arabic translates the chips and headings, right-to-left, no overflow', await a.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 1400 && /[\\u0600-\\u06FF]/.test(document.querySelector("#elNav").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#elView").textContent.slice(0, 80))'));
  for (const [h, sel, min] of VIEWS.slice(1, 3)) { await go(a, h, sel, min); await sleep(900); ok(`electricity: Arabic ${h} at 1400 has no overflow`, await a.ev('document.documentElement.scrollWidth <= 1400')); }
  await a.ev('location.hash = "#map"'); await a.wait('!!document.getElementById("fbFireOn")', 30000);
  ok('electricity: the fire toggle label is in Arabic on the Strike map', await a.ev('/[\\u0600-\\u06FF]/.test(document.getElementById("fbFireOn").parentElement.textContent)'));
  ok('electricity: 0 console errors in Arabic', a.errors().length === 0, a.errors());
  await a.close();
  const am = await open(390, SITE, { query: '?lang=ar', hash: '#electricity/lights' });
  for (const [h, sel, min] of [['#electricity/lights', '#elLg .fb-card', 3], ['#climate', '#elView .fb-card', 5]]) {
    await go(am, h, sel, min); await sleep(1500);
    ok(`electricity: Arabic ${h} at 390 is right-to-left and has no overflow`, await am.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 390'));
  }
  ok('electricity: 0 console errors in Arabic at 390', am.errors().length === 0, am.errors());
  await am.close();

  // empty and error states
  const fe = fixture('el-empty', D => { D.tabs.electricity = {}; });
  const e = await open(1400, fe, { hash: '#electricity' });
  await sleep(600);
  ok('electricity: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#electricityRoot .hub-empty") && !document.querySelector("#elNav")'));
  await e.close();
  const fm = fixture('el-missing', null, { 'electricity/nightlights.json': null, 'fires/firms-lbn.json': null });
  const n = await open(1400, fm, { hash: '#electricity/lights', allow: /nightlights|firms|404|Failed to load/ });
  await n.wait('!!document.querySelector("#elLg .hub-err")', 20000);
  ok('electricity: night lights without their file show the error state with Retry (the other views still work)', await n.ev('!!document.querySelector("#elLg [data-retry]") && document.querySelectorAll("#elNav [data-id]").length === 3'));
  await n.ev('location.hash = "#climate"'); await n.wait('!!document.querySelector("#elFi .hub-err")', 25000);
  ok('electricity: a missing fires file shows an error in the fire section only; the climate section still loads', await n.ev('!!document.querySelector("#elFi [data-retry]") && document.querySelectorAll("#elCl .fb-card").length >= 3'));
  await n.ev('location.hash = "#map"'); await n.wait('!!document.getElementById("fbFireOn")', 30000);
  await n.ev('document.getElementById("fbFireOn").click()'); await sleep(1500);
  ok('electricity: if the fire file fails the map toggle switches itself off and says so', await n.ev('!document.getElementById("fbFireOn").checked && /could not be loaded/.test(document.getElementById("fbFireNote").textContent)'));
  await n.close();
}
