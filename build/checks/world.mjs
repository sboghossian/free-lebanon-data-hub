// World tab checks (FE-C): the globe renders in swiftshader, the indicator and year change the colours, compare, scatter, lag and flows render,
// deep links, WebGL fallback, empty and error states, 0 console errors at 1400 and 390, EN and AR (rtl, no overflow).
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';

const IND = 'NY.GDP.PCAP.CD', IND2 = 'SP.POP.TOTL';
export default async function (T) {
  const { ok, sleep, open, fixture, siteDir, out, SITE } = T;
  const clean = p => p.ev('try { localStorage.removeItem("wd-prefs"); } catch (e) { 1; } 1');   // the map type and region are remembered; every test page starts clean
  const tab = async p => { await clean(p); await p.ev('document.getElementById("t-world").click()'); await sleep(250); };
  const deep = async (w, hash) => { const x = await open(w); await clean(x); await x.ev(`location.hash = ${JSON.stringify(hash)}; location.reload(); 1`); await x.wait('document.readyState === "complete" && !!window.HUB', 30000); return x; };
  const view = async (p, v) => { await p.ev(`document.querySelector('#world [data-wv="${v}"]').click()`); await sleep(300); };
  const ready = (p, ms = 40000) => p.wait('document.querySelector("#worldRoot .wd") && !document.querySelector("#wdLoad .hub-spin") && !!HUB.world.stage.el', ms);
  const fillOf = (p, iso) => p.ev(`HUB.world.stage.S.fill(${JSON.stringify(iso)})`);
  const noOverflow = (p, w) => p.ev('document.documentElement.scrollWidth').then(x => x <= w);

  // ------------------------------------------------------------------ desktop: globe, indicator, year, play
  const p = await open(1400);
  await tab(p);
  ok('world: the tab opens, panel visible, no stub empty state shown', await p.ev('!document.getElementById("world").hidden && document.getElementById("wdNone").hidden'));
  ok('world: the controls render (indicator, year slider, views, regions)', await p.wait('!!document.querySelector("#wdInd") && !!document.querySelector("#wdYear") && document.querySelectorAll("#world [data-wv]").length === 5 && document.querySelectorAll("#world [data-preset]").length === 4', 20000));
  ok('globe: the 3D globe is created (a canvas, mode globe, no WebGL fallback) under swiftshader', await p.wait('!!document.querySelector("#world .wd-gl canvas") && HUB.world.stage.mode === "globe" && !HUB.world.stage.noGL', 40000));
  await sleep(800);
  ok('globe: the canvas has a real size', await p.ev('(() => { const c = document.querySelector("#world .wd-gl canvas"); return c.clientWidth > 300 && c.clientHeight > 250; })()'));
  ok('globe: the globe holds all the country polygons and Lebanon is tagged with its rank ("Lebanon: 135th of 204" style)', await p.ev('/^Lebanon: \\d+(st|nd|rd|th) of \\d+$/.test(HUB.world.stage.S.tag) && document.querySelector(".wd-tag-in") && /Lebanon: \\d+/.test(document.querySelector(".wd-tag-in").textContent)'));
  ok('globe: pixels are drawn (the WebGL canvas has many distinct colours, not a blank frame)', await p.ev(`new Promise(res => requestAnimationFrame(() => { const c = document.querySelector("#world .wd-gl canvas"), k = document.createElement("canvas"); k.width = c.width; k.height = c.height; const x = k.getContext("2d"); x.drawImage(c, 0, 0); const seen = new Set(); let alpha = 0; for (let i = 0; i < 400; i++) { const d = x.getImageData(Math.floor(c.width * (0.25 + (i % 20) * 0.025)), Math.floor(c.height * (0.25 + Math.floor(i / 20) * 0.025)), 1, 1).data; seen.add(d[0] + "," + d[1] + "," + d[2]); alpha += d[3] > 0 ? 1 : 0; } res(seen.size >= 6 && alpha > 300); }))`));
  await p.shot('shot-wd-globe-1400.png');
  const c0 = await fillOf(p, 'FRA'), l0 = await p.ev('document.getElementById("wdLeb").textContent');
  ok('map: a country is coloured by the indicator (rgb colour) and Lebanon has its rank card', /^rgb\(/.test(c0) && /of \d+/.test(l0));
  const y0 = await p.ev('+document.getElementById("wdYear").value');
  await p.ev('(() => { const s = document.getElementById("wdYear"); s.value = 1990; s.dispatchEvent(new Event("input", { bubbles: true })); })()'); await sleep(300);
  const c1 = await fillOf(p, 'FRA');
  ok('year slider: moving it changes the year, the colours, the hash and the tag', y0 > 2000 && await p.ev(`document.getElementById("wdYearOut").textContent === "1990" && location.hash === "#world/${IND}/1990" && /1990|Lebanon/.test(HUB.world.stage.S.tag)`) && c1 !== c0, [c0, c1]);
  const sel0 = await p.ev('document.getElementById("wdInd").value');
  await p.ev(`(() => { const s = document.getElementById("wdInd"); s.value = "${IND2}"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await p.wait(`location.hash.startsWith("#world/${IND2}/")`, 15000); await sleep(300);
  const c2 = await fillOf(p, 'FRA');
  ok('indicator switch: the colours change, the slider range follows and the hash names the indicator', c2 !== c1 && sel0 === IND && await p.ev(`document.getElementById("wdInd").value === "${IND2}" && +document.getElementById("wdYear").max >= 2024`), [c1, c2]);
  ok('map: every view names its source and licence', await p.ev('/Source/.test(document.querySelector(".wd-src").textContent) && /Licence/.test(document.querySelector(".wd-src").textContent) && /CC BY/.test(document.querySelector(".wd-src").textContent)'));
  await p.ev(`(() => { const s = document.getElementById("wdInd"); s.value = "${IND}"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`); await sleep(600);
  await p.ev('(() => { const s = document.getElementById("wdYear"); s.value = 2019; s.dispatchEvent(new Event("input", { bubbles: true })); })()'); await sleep(200);
  await p.ev('document.getElementById("wdPlay").click()'); await sleep(2300);
  const yp = await p.ev('+document.getElementById("wdYear").value');
  ok('play: the year advances by itself, and Pause stops it', yp >= 2020 && await p.ev('document.getElementById("wdPlay").click(), 1') && await (async () => { await sleep(150); const a = await p.ev('+document.getElementById("wdYear").value'); await sleep(1500); return a === await p.ev('+document.getElementById("wdYear").value'); })(), yp);
  await p.ev('document.querySelector("#world [data-preset=mena]").click()'); await sleep(300);
  ok('regions: the Middle East & North Africa preset is selected and the scale-to-region option appears', await p.ev('document.querySelector("#world [data-preset=mena]").getAttribute("aria-pressed") === "true" && !document.getElementById("wdRegL").hidden'));
  await p.ev('document.querySelector("#world [data-preset=world]").click()');
  await p.ev('document.querySelector("#world [data-find]").click()'); await sleep(300);
  ok('table view: the table of values lists Lebanon', await p.ev('(() => { const d = document.getElementById("wdTbl"); d.open = true; d.dispatchEvent(new Event("toggle")); return !!document.querySelector("#wdTbl tr.hi td"); })()'));

  // ------------------------------------------------------------------ flat map and selection
  await p.ev('document.querySelector("#world [data-mode=flat]").click()'); await p.wait('HUB.world.stage.mode === "flat" && document.querySelectorAll(".wd-c").length > 150', 20000); await sleep(300);
  ok('flat map: d3-geo draws 150+ countries from the 50m geometry, coloured, Lebanon marked', await p.ev('document.querySelectorAll(".wd-c").length > 150 && document.querySelector(".wd-c[data-iso=FRA]").style.fill.startsWith("rgb") && !!document.querySelector(".wd-c.lb") && document.querySelector(".wd-lbl").textContent.length > 5'));
  ok('flat map: a hatched fill marks countries with no data', await p.ev('[...document.querySelectorAll(".wd-c")].some(c => /url/.test(c.style.fill))'));
  await p.shot('shot-wd-flat-1400.png');
  await p.ev('document.querySelector(".wd-c[data-iso=FRA]").dispatchEvent(new MouseEvent("click", { bubbles: true }))'); await sleep(250);
  ok('select: clicking a country opens its card with a Compare link; the card clears again', await p.ev('!document.getElementById("wdSel").hidden && /France/.test(document.getElementById("wdSel").textContent) && !!document.querySelector("#wdSel a[data-hash^=\\"compare/\\"]")') && await p.ev('document.getElementById("wdClear").click(), document.getElementById("wdSel").hidden'));
  await p.ev('document.querySelector(".wd-c[data-iso=FRA]").dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))'); await sleep(150);
  ok('hover: the tooltip names the country, its value and its rank', await p.ev('!document.querySelector(".wd-tip").hidden && /France/.test(document.querySelector(".wd-tip").textContent) && /of \\d+/.test(document.querySelector(".wd-tip").textContent)'));
  await p.ev('document.querySelector("#world [data-preset=mena]").click()'); await sleep(200);
  ok('flat map: a region preset zooms the map (viewBox narrows)', await p.ev('(() => { const v = document.querySelector(".wd-svg").getAttribute("viewBox").split(" "); return +v[2] < 700; })()'));
  await p.ev('document.querySelector("#world [data-preset=world]").click()');

  // ------------------------------------------------------------------ flows
  await view(p, 'flows'); await p.wait('document.querySelector("#wdFl") && !document.querySelector("#wdLoad .hub-spin") && HUB.world.stage.S.arcs.length > 0', 20000);
  ok('flows: arcs for the diaspora are drawn on the flat map from Lebanon to its destinations (paths and end dots)', await p.ev('document.querySelectorAll(".wd-arc").length >= 10 && document.querySelectorAll(".wd-end").length >= 10'));
  ok('flows: the side panel lists the top partners and a total, with the source and licence below', await p.ev('document.querySelectorAll("#wdBars li").length >= 8 && /Source/.test(document.querySelector(".wd-src").textContent) && /Licence/.test(document.querySelector(".wd-src").textContent)'));
  let flowOk = [];
  for (const id of ['diaspora', 'remit_in', 'remit_out', 'remit_world', 'refugees_in', 'refugees_out', 'immigrants', 'exports', 'imports', 'refugees_world']) {
    await p.ev(`(() => { const s = document.getElementById("wdFl"); s.value = "${id}"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    const good = await p.wait(`HUB.world.S.fl.id === "${id}" && !document.querySelector("#wdLoad .hub-spin") && HUB.world.stage.S.arcs.length > 0 && document.querySelectorAll(".wd-arc").length > 0 && document.querySelectorAll("#wdBars li").length > 0`, 12000);
    if (!good) flowOk.push(id);
  }
  ok('flows: all ten flow sets (diaspora, remittances, refugees, trade) draw arcs and a partner list', flowOk.length === 0, flowOk);
  await p.ev('document.querySelector("#world [data-mode=globe]").click()'); await p.wait('HUB.world.stage.mode === "globe"', 20000); await sleep(1200);
  await p.ev('(() => { const s = document.getElementById("wdFl"); s.value = "diaspora"; s.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(1500);
  ok('flows: arcs on the globe (arc data handed to globe.gl, canvas present)', await p.ev('HUB.world.stage.S.arcs.length >= 10 && !!document.querySelector("#world .wd-gl canvas") && !document.querySelector(".wd-gl").hidden'));
  await p.shot('shot-wd-flows-globe.png');
  await p.ev('(() => { const s = document.getElementById("wdYear"); s.value = 2000; s.dispatchEvent(new Event("input", { bubbles: true })); })()'); await sleep(300);
  ok('flows: the year slider changes the diaspora year', await p.ev('document.getElementById("wdYearOut").textContent === "2000" || !document.getElementById("wdYrBar").hidden'));
  ok('flows: 0 console errors', p.errors().length === 0, p.errors());
  await p.ev('document.querySelector("#world [data-wv=map]").click()'); await sleep(500);
  ok('views: switching back to the map keeps the same WebGL canvas (no second context)', await p.ev('document.querySelectorAll("#world canvas").length === 1'));

  // ------------------------------------------------------------------ compare
  await view(p, 'compare'); await p.wait('document.querySelector("#wdChart svg") && document.querySelector("#wdRank svg, #wdRank .hub-empty")', 20000);
  ok('compare: a line chart of Lebanon against the default peers renders (Syria ... World)', await p.ev('document.querySelectorAll("#wdChart path.hc-line").length >= 14 && document.querySelectorAll(".wd-pc").length === 18'));
  ok('compare: the default peers are Syria, Jordan, Iraq, Israel, Cyprus, Egypt, Turkey, the Gulf states, France, Greece, the US and the World', await p.ev('JSON.stringify(HUB.world.S.peers) === JSON.stringify(["SYR","JOR","IRQ","ISR","CYP","EGY","TUR","SAU","ARE","QAT","KWT","BHR","OMN","FRA","GRC","USA","WLD"])'));
  ok('compare: Lebanon is the first line and the thick one; peers get fixed colours, the rest are grey', await p.ev('(() => { const l = [...document.querySelectorAll("#wdChart path.hc-line")]; return /war/.test(l[0].getAttribute("style")) && /cedar/.test(l[1].getAttribute("style")) && /color-mix/.test(l[8].getAttribute("style")); })()'));
  ok('compare: Lebanon\'s rank over time in the world and the region is charted', await p.ev('document.querySelectorAll("#wdRank path.hc-line").length === 2'));
  ok('compare: the address is #compare/<indicator>/LBN,SYR,JOR,...', await p.ev(`location.hash.startsWith("#compare/${IND}/LBN,SYR,JOR,IRQ")`), await p.ev('location.hash'));
  await p.ev('document.querySelector("#world [data-set=near]").click()'); await sleep(300);
  ok('compare: a set of peers can be swapped (Neighbours) and a peer removed', await p.ev('document.querySelectorAll(".wd-pc").length === 8') && await p.ev('document.querySelector("#world [data-rm=SYR]").click(), document.querySelectorAll(".wd-pc").length === 7'));
  ok('compare: a country can be added from the list and the hash follows', await p.ev('(() => { const s = document.getElementById("wdAdd"); s.value = "DEU"; s.dispatchEvent(new Event("change", { bubbles: true })); return document.querySelectorAll(".wd-pc").length === 8 && /DEU/.test(location.hash); })()'));
  ok('compare: the source and licence are named', await p.ev('/Licence/.test(document.querySelector(".wd-src").textContent)'));
  await p.shot('shot-wd-compare.png');
  ok('compare: 0 console errors', p.errors().length === 0, p.errors());

  // ------------------------------------------------------------------ correlations
  await view(p, 'correlations'); await p.wait('document.querySelectorAll("#wdSc .sc-dot").length > 50 && document.querySelectorAll("#wdLagOut .lg-bar").length > 3', 25000);
  ok('scatter: 100+ country dots, the Pearson r with n, a fitted line and Lebanon highlighted', await p.ev('document.querySelectorAll("#wdSc .sc-dot").length > 100 && /r = [\\u2212-]?\\d\\.\\d\\d \\(n = \\d+\\)/.test(document.getElementById("wdStats").textContent) && !!document.querySelector("#wdSc .hc-fit") && !!document.querySelector("#wdSc .sc-dot.hi")'));
  ok('scatter: the "correlation is not causation" note is there, with an interval and a rank correlation', await p.ev('/not causation/.test(document.querySelector(".wd-cause").textContent) && /95% interval/.test(document.getElementById("wdStats").textContent) && /rank correlation/.test(document.getElementById("wdStats").textContent)'));
  const r0 = await p.ev('document.querySelector("#wdStats p").textContent');
  await p.ev('(() => { const s = document.getElementById("wdY"); s.value = "SL.UEM.TOTL.ZS"; s.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(900);
  ok('scatter: changing an indicator redraws the dots and r', await p.ev('document.querySelectorAll("#wdSc .sc-dot").length > 50') && r0 !== await p.ev('document.querySelector("#wdStats p").textContent'));
  ok('scatter: a dot hover shows the country and both values', await p.ev('(() => { const c = document.querySelector("#wdSc .sc-dot.hi"); c.dispatchEvent(new PointerEvent("pointerenter")); const t = document.querySelector("#wdSc .hc-tip"); return !t.hidden && /Lebanon/.test(t.textContent); })()'));
  ok('lag: the lagged-correlation explorer shows r at every lag with n, and names the biggest one carefully', await p.ev('document.querySelectorAll("#wdLagOut .lg-bar").length >= 6 && /Largest absolute r/.test(document.querySelector(".wd-best").textContent) && /n = \\d+/.test(document.querySelector(".wd-best").textContent) && /chance/.test(document.querySelector(".wd-warn").textContent) && /causation/.test(document.querySelector(".wd-warn").textContent)'));
  await p.ev('(() => { const s = document.getElementById("wdTr"); s.value = "levels"; s.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(300);
  ok('lag: "Levels" adds the warning about trending series; the filter box narrows the list', await p.ev('/rise or fall/.test(document.querySelector(".wd-warn").textContent)') && await p.ev('(() => { const q = document.getElementById("wdAq"); const n0 = document.querySelectorAll("#wdA option").length; q.value = "electric"; q.dispatchEvent(new Event("input", { bubbles: true })); return document.querySelectorAll("#wdA option").length < n0; })()'));
  ok('lag: Hub series (not only World ones) are on offer, and picking one gives a result with its yearly-average note', await p.ev(`(() => { const q = document.getElementById("wdBq"); q.value = "Petrol 95"; q.dispatchEvent(new Event("input", { bubbles: true })); const o = [...document.querySelectorAll("#wdB option")].find(x => x.value.startsWith("h:")); if (!o) return false; const s = document.getElementById("wdB"); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`) && await p.wait('/yearly average|change in/.test(document.querySelector("#wdLagOut").textContent) && document.querySelectorAll("#wdLagOut .lg-bar").length >= 1', 5000));
  ok('correlations: the source and licence are named for both series', await p.ev('/Licence/.test(document.querySelector("#wdLagOut .wd-src").textContent) && /Licence/.test(document.querySelector("#wdSrc .wd-src").textContent)'));
  await p.shot('shot-wd-corr.png');
  ok('correlations: 0 console errors', p.errors().length === 0, p.errors());
  ok('world: 0 console errors at 1400 across all views', p.errors().length === 0, p.errors());
  await p.close();

  // ------------------------------------------------------------------ scorecard
  const sc = await open(1400);
  await tab(sc); await view(sc, 'scorecard'); await sc.wait('document.querySelectorAll("#wdScore tbody tr a").length > 50', 20000);
  ok('scorecard: Lebanon on 60+ indicators at once, each with its latest year, value, world rank ("Nth of N") and region rank', await sc.ev('document.querySelectorAll("#wdScore tbody tr a").length >= 60 && /\\d+(st|nd|rd|th) of \\d+/.test(document.querySelector("#wdScore tbody tr:nth-child(2)").textContent) && document.querySelectorAll("#wdScore .wd-pb").length >= 60'));
  ok('scorecard: the source and licence of every indicator are named', await sc.ev('/Licence/.test(document.querySelector("#wdSrc").textContent) && document.querySelectorAll("#wdSrc .wd-s").length >= 3'));
  const first0 = await sc.ev('document.querySelector("#wdScore tbody tr:nth-child(2) a").textContent');
  await sc.ev('(() => { const s = document.getElementById("wdSort"); s.value = "hi"; s.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(200);
  ok('scorecard: sorting by rank reorders the rows (highest rank first)', await sc.ev('(() => { const w = [...document.querySelectorAll("#wdScore .wd-pb i")].map(i => parseFloat(i.style.width)); return w.length > 50 && w[0] >= w[w.length - 1] && w[0] > 90; })()') && first0 !== await sc.ev('document.querySelector("#wdScore tbody tr:nth-child(1) a").textContent'));
  await sc.ev('document.querySelector("#wdScore tbody tr:nth-child(1) a").click()'); await sc.wait('!!document.querySelector("#wdInd") && /^#world\\//.test(location.hash)', 20000); await sleep(500);
  ok('scorecard: clicking an indicator opens it on the map at that year (deep link #world/<indicator>/<year>)', await sc.ev('!!document.getElementById("wdYear") && /^#world\\/[^/]+\\/\\d{4}$/.test(location.hash) && document.getElementById("wdInd").value === decodeURIComponent(location.hash.split("/")[1])'));
  ok('scorecard: the map names its source and licence, has no download link (v10: downloads are in the Data tab), and the tab links #data/world once', await sc.ev('!!document.querySelector(".wd-src") && /Licence/.test(document.querySelector(".wd-src").textContent) && document.querySelectorAll("#world a[download]").length === 0 && document.querySelectorAll("#world a[href=\\"#data/world\\"]").length === 1'));
  ok('scorecard: 0 console errors', sc.errors().length === 0, sc.errors());
  await sc.close();

  // ------------------------------------------------------------------ deep links
  const d1 = await deep(1400, '#world/FP.CPI.TOTL.ZG/2010');
  await d1.wait('!!window.HUB && !!document.querySelector("#wdInd")', 30000); await sleep(800);
  ok('deep link: #world/<indicator>/<year> opens the World tab on that indicator and year', await d1.ev('!document.getElementById("world").hidden && document.getElementById("wdInd").value === "FP.CPI.TOTL.ZG" && document.getElementById("wdYearOut").textContent === "2010"'));
  ok('deep link: the globe appears there too (no tab click needed)', await d1.wait('!!document.querySelector("#world .wd-gl canvas")', 40000));
  await d1.ev('location.hash = "#compare/NY.GDP.PCAP.CD/LBN,SYR,JOR"'); await d1.wait('document.querySelectorAll(".wd-pc").length === 3 && !!document.querySelector("#wdChart svg")', 20000);
  ok('deep link: #compare/<indicator>/LBN,SYR,JOR shows exactly Lebanon, Syria and Jordan, 3 lines', await d1.ev('document.querySelectorAll(".wd-pc").length === 3 && document.querySelectorAll("#wdChart path.hc-line").length === 3 && /Syria/.test(document.getElementById("wdPeers").textContent)'));
  await d1.ev('location.hash = "#world/NOT.AN.INDICATOR/2010"'); await sleep(800);
  ok('deep link: an unknown indicator falls back to the default and says so', await d1.ev('/not in this build/.test(document.querySelector(".wd-bad").textContent) && document.getElementById("wdInd").value === "NY.GDP.PCAP.CD"'));
  ok('deep link: 0 console errors', d1.errors().length === 0, d1.errors());
  await d1.close();
  const d2 = await deep(1400, '#compare/SP.POP.TOTL/LBN,ISR,CYP');
  await d2.wait('document.querySelectorAll(".wd-pc").length === 3 && !!document.querySelector("#wdChart svg")', 30000);
  ok('deep link: loading #compare/... straight away works, with the chosen indicator', await d2.ev('document.getElementById("wdInd").value === "SP.POP.TOTL" && document.querySelectorAll("#wdChart path.hc-line").length === 3'));
  await d2.close();

  // ------------------------------------------------------------------ mobile 390
  const m = await open(390);
  await tab(m);
  await m.wait('!!document.querySelector("#wdInd") && !!document.querySelector("#world .wd-gl canvas")', 40000); await sleep(1000);
  ok('mobile 390: the map view has no horizontal overflow', await noOverflow(m, 390), await m.ev('document.documentElement.scrollWidth'));
  ok('mobile 390: the globe fits the screen width', await m.ev('document.querySelector(".wd-stage").getBoundingClientRect().width <= 360'));
  await m.shot('shot-wd-mobile-map.png');
  await m.ev('document.querySelector("#world [data-mode=flat]").click()'); await m.wait('document.querySelectorAll(".wd-c").length > 150', 20000); await sleep(300);
  ok('mobile 390: the flat map has no overflow', await noOverflow(m, 390));
  for (const v of ['flows', 'compare', 'correlations', 'scorecard']) {
    await view(m, v); await m.wait(v === 'flows' ? 'HUB.world.stage.S.arcs.length > 0' : v === 'compare' ? '!!document.querySelector("#wdChart svg")' : v === 'scorecard' ? 'document.querySelectorAll("#wdScore tbody tr a").length > 50' : 'document.querySelectorAll("#wdLagOut .lg-bar").length > 3 && document.querySelectorAll("#wdSc .sc-dot").length > 50', 25000); await sleep(400);
    ok(`mobile 390: ${v} has no horizontal overflow`, await noOverflow(m, 390), await m.ev('[...document.querySelectorAll("#world *")].filter(e => e.getBoundingClientRect().right > 392).slice(0, 4).map(e => e.tagName + "." + e.className).join()'));
    await m.shot(`shot-wd-mobile-${v}.png`);
  }
  ok('mobile 390: 0 console errors', m.errors().length === 0, m.errors());
  await m.close();

  // ------------------------------------------------------------------ keyboard, theme, reduced motion
  const k = await open(1400);
  await k.ev('(() => { const o = window.matchMedia.bind(window); window.matchMedia = q => /reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : o(q); })()');
  await tab(k); await k.wait('!!document.querySelector("#world .wd-gl canvas") && !!HUB.world.stage.pov()', 40000); await sleep(600);
  ok('reduced motion: the pulse ring, arc animation and camera transitions are switched off (HUB.world.reduce() is true, stage.motion is false)', await k.ev('HUB.world.reduce() === true && HUB.world.stage.motion === false'));
  const lng0 = await k.ev('HUB.world.stage.pov().lng');
  await k.ev('document.querySelector(".wd-gl").focus(), document.querySelector(".wd-gl").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))'); await sleep(300);
  ok('keyboard: the arrow keys turn the globe', Math.abs((await k.ev('HUB.world.stage.pov().lng')) - lng0) > 3, lng0);
  await k.ev('document.documentElement.dataset.theme = "light"'); await sleep(500);
  const fl = await fillOf(k, 'FRA'), gl = await k.ev('document.querySelector(".wd-lgbar").style.background');
  await k.ev('document.documentElement.dataset.theme = "dark"'); await sleep(500);
  const fd = await fillOf(k, 'FRA'), gd = await k.ev('document.querySelector(".wd-lgbar").style.background');
  ok('theme: light and dark give different colours for the same value, on the globe and the legend, with no errors', fl !== fd && gl !== gd && k.errors().length === 0, [fl, fd]);
  await k.ev('document.documentElement.dataset.theme = "light"'); await sleep(700); await k.ev('document.querySelector(".wd-main").scrollIntoView()'); await sleep(200);
  await k.shot('shot-wd-light-globe.png');
  await k.ev('document.querySelector("#world [data-mode=flat]").click()'); await sleep(1200); await k.shot('shot-wd-light-flat.png');
  await k.ev('document.documentElement.dataset.theme = "dark"'); await k.close();

  // ------------------------------------------------------------------ no WebGL: the flat map takes over
  const g = await open(1400);
  await g.ev('(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t) { return /webgl/.test(t) ? null : o.apply(this, arguments); }; })()');
  await tab(g); await g.wait('document.querySelectorAll(".wd-c").length > 150', 30000); await sleep(400);
  ok('no WebGL: the flat map is shown instead, with a note, the globe button disabled and no console error', await g.ev('HUB.world.stage.mode === "flat" && HUB.world.stage.noGL === true && !document.querySelector(".wd-fallback").hidden && /WebGL/.test(document.querySelector(".wd-fallback").textContent) && document.querySelector("#world [data-mode=globe]").disabled && !document.querySelector("#world canvas")') && g.errors().length === 0, g.errors());
  await g.ev('document.querySelector("#world [data-wv=flows]").click()'); await g.wait('document.querySelectorAll(".wd-arc").length > 5', 20000);
  ok('no WebGL: flows still draw (flat arcs)', await g.ev('document.querySelectorAll(".wd-arc").length > 5'));
  await g.close();

  // ------------------------------------------------------------------ honest empty and error states
  const fe = fixture('wd-empty', D => { D.tabs.world.n = 0; });
  const e1 = await open(1400, fe); await tab(e1); await sleep(400);
  ok('empty state: with no world data the tab says so and shows no controls', await e1.ev('!document.getElementById("wdNone").hidden && !document.querySelector("#worldRoot .wd") && /No world data/.test(document.getElementById("wdNone").textContent)'));
  await e1.close();
  const fm = fixture('wd-missing', null, { 'world/index.json': null });
  const e2 = await open(1400, fm, { allow: /index\.json|404|Failed to load/ }); await tab(e2); await sleep(1500);
  ok('error state: a missing index file shows the error with the path and a Retry button', await e2.ev('!!document.querySelector("#worldRoot .hub-err") && !!document.querySelector("#worldRoot [data-retry]") && /index\.json/.test(document.getElementById("worldRoot").textContent)'));
  symlinkSync(join(siteDir, 'data/world/index.json'), join(out, 'fx', 'wd-missing', 'data/world/index.json'));
  await e2.ev('document.querySelector("#worldRoot [data-retry]").click()'); await sleep(1500);
  ok('error state: after the file appears, Retry loads the tab', await e2.ev('!!document.getElementById("wdInd") && !document.querySelector("#worldRoot .hub-err")'));
  await e2.close();
  const fi = fixture('wd-noind', null, { 'world/indicators/NY.GDP.PCAP.CD.json': null });
  const e3 = await open(1400, fi, { allow: /NY\.GDP|404|Failed to load/ }); await tab(e3); await sleep(2500);
  ok('error state: a missing indicator file shows the error inside the view, the controls stay, and Retry works once the file exists', await e3.ev('!!document.querySelector("#wdLoad .hub-err") && !!document.getElementById("wdInd") && /NY\.GDP\.PCAP\.CD/.test(document.getElementById("wdLoad").textContent)'));
  symlinkSync(join(siteDir, 'data/world/indicators/NY.GDP.PCAP.CD.json'), join(out, 'fx', 'wd-noind', 'data/world/indicators/NY.GDP.PCAP.CD.json'));
  await e3.ev('document.querySelector("#wdLoad [data-retry]").click()'); await sleep(1500);
  ok('error state: the indicator loads after Retry', await e3.ev('!document.querySelector("#wdLoad .hub-err") && /of \\d+/.test(document.getElementById("wdLeb").textContent)'));
  await e3.close();

  // ------------------------------------------------------------------ Arabic (rtl) at 1400 and 390
  for (const w of [1400, 390]) {
    const a = await open(w, SITE, { query: '?lang=ar' });
    await tab(a); await a.wait('!!document.querySelector("#wdInd") && !!document.querySelector("#world .wd-gl canvas")', 40000); await sleep(900);
    ok(`arabic ${w}: the page is rtl, the views and indicator names are in Arabic`, await a.ev('document.documentElement.dir === "rtl" && /[\u0600-\u06FF]/.test(document.querySelector("#world [data-wv=compare]").textContent) && /[\u0600-\u06FF]/.test(document.querySelector("#wdInd option:checked").textContent)'));
    ok(`arabic ${w}: Lebanon's rank reads in Arabic ("لبنان: المرتبة ...")`, await a.ev('/لبنان: المرتبة/.test(document.getElementById("wdLeb").textContent) && /لبنان: المرتبة/.test(HUB.world.stage.S.tag)'));
    ok(`arabic ${w}: the licence and source labels are Arabic and the source names stay as they are`, await a.ev('/المصدر/.test(document.querySelector(".wd-src").textContent) && /الترخيص/.test(document.querySelector(".wd-src").textContent) && /CC BY/.test(document.querySelector(".wd-src").textContent)'));
    await a.ev('document.querySelector("#world [data-mode=flat]").click()'); await a.wait('document.querySelectorAll(".wd-c").length > 150', 20000);
    await a.ev('document.querySelector(".wd-c[data-iso=FRA]").dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))'); await sleep(200);
    ok(`arabic ${w}: the hover tooltip names the country in Arabic`, await a.ev('/فرنسا/.test(document.querySelector(".wd-tip").textContent)'));
    ok(`arabic ${w}: the map view has no horizontal overflow`, await noOverflow(a, w), await a.ev('document.documentElement.scrollWidth'));
    await a.shot(`shot-wd-ar-map-${w}.png`);
    for (const v of ['flows', 'compare', 'correlations', 'scorecard']) {
      await view(a, v); await a.wait(v === 'flows' ? 'HUB.world.stage.S.arcs.length > 0' : v === 'compare' ? '!!document.querySelector("#wdChart svg")' : v === 'scorecard' ? 'document.querySelectorAll("#wdScore tbody tr a").length > 50' : 'document.querySelectorAll("#wdLagOut .lg-bar").length > 3 && document.querySelectorAll("#wdSc .sc-dot").length > 50', 25000); await sleep(400);
      ok(`arabic ${w}: ${v} renders, rtl, no horizontal overflow`, await noOverflow(a, w) && await a.ev('document.documentElement.dir === "rtl" && /[\u0600-\u06FF]/.test(document.getElementById("wdBody").textContent)'), await a.ev('[...document.querySelectorAll("#world *")].filter(e => e.getBoundingClientRect().right > ' + (w + 2) + ').slice(0, 4).map(e => e.tagName + "." + e.className).join()'));
      if (v === 'correlations') {
        ok(`arabic ${w}: the charts stay left-to-right and the correlation note is Arabic`, await a.ev('getComputedStyle(document.querySelector("#wdSc svg")).direction === "ltr" && /[\u0600-\u06FF]/.test(document.querySelector(".wd-cause").textContent)'));
      }
      await a.shot(`shot-wd-ar-${v}-${w}.png`);
    }
    ok(`arabic ${w}: 0 console errors`, a.errors().length === 0, a.errors());
    await a.close();
  }
  // French
  const f = await open(1400, SITE, { query: '?lang=fr' });
  await tab(f); await f.wait('!!document.querySelector("#wdInd") && !!document.querySelector("#world .wd-gl canvas")', 40000); await sleep(900);
  ok('french: the rank reads "Liban : 135e sur 204" style and the sources say Licence', await f.ev('/Liban : \\d+(er|e) sur \\d+/.test(document.getElementById("wdLeb").textContent) && /Licence/.test(document.querySelector(".wd-src").textContent)'));
  ok('french: 0 console errors', f.errors().length === 0, f.errors());
  await f.close();
}
