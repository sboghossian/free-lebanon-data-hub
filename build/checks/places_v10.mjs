// v10 checks, Places: the Religion layer (off by default, caption, legend naming every group, never on the strike shading), the sect-share chart on a town page with its caption,
// the district Politics block (2018, 2022, "not for the town"), the Services block and layer, "Communities and seats over time", the one "Data behind this tab" link, Arabic RTL, empty and error states.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const CAP_EN = 'Registered voters by sect, 2014 (Interior Ministry lists via lub-anan.com). Not residents.';
  const go = async (p, h, expr) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`!document.querySelector("#plView .hub-load") && (${expr})`, 30000); };

  // data files
  const S = readData('places/sects-2014.json'), P = readData('places/politics.json'), H = readData('places/history.json'), F = readData('places/facilities.json');
  ok('v10 places: the sect file has 20 groups and one row per voter list, each row adding up to its total', S.groups.length === 20 && Object.keys(S.rows).length > 1300 && Object.values(S.rows).every(r => r[0] === r.slice(1).reduce((a, b) => a + b, 0)));
  ok('v10 places: Sour has 19,496 Shia registered voters of 29,410', (() => { const r = S.rows.LBN63110; return r && r[0] === 29410 && r[1 + S.groups.indexOf('Shia')] === 19496; })());
  ok('v10 places: the politics file holds 15 districts for 2018 and for 2022, each with seats by bloc adding up to its seats', ['2018-parliamentary', '2022-parliamentary'].every(e => { const d = P.elections[e].districts; return Object.keys(d).length === 15 && Object.values(d).every(x => x.blocs.reduce((a, b) => a + b[1], 0) === x.seats); }));
  ok('v10 places: the history file has 18 tables and the 2014 national count', H.tables.length === 18 && H.national_2014.total === 3514588);
  ok('v10 places: the facilities file has 3,574 points with a kind each', F.rows.length === 3574 && F.rows.every(r => r[0] >= 0 && r[0] < F.kinds.length));
  const man = readData('manifest.json').files.map(f => f.path);
  ok('v10 places: the new downloads are listed in the manifest (they appear in the Data tab)', ['csv/places-sects-2014.csv', 'csv/places-services.csv', 'csv/facilities.csv', 'csv/elections-blocs.csv', 'csv/history-tables.csv', 'places/sects-2014.json'].every(f => man.includes('data/' + f)));
    ok('v10 places: the district shard carries the services counts of Khiam (one public school)', (() => { const k = readData('places/p/LB43.json').LBN43020.sv; return Array.isArray(k) && k.length === 6 && k[3] === 1; })());

  // the layers
  const p = await open(1400, SITE, { hash: '#places' });
  ok('v10 places: the search view has two map layers, both off by default, and no religion dots or facility dots', await p.wait('document.querySelectorAll("#plMap .fb-a").length === 26', 20000) && await p.ev('document.querySelectorAll("#plLy [data-ly]").length === 2 && [...document.querySelectorAll("#plLy [data-ly]")].every(b => b.getAttribute("aria-pressed") === "false") && !document.querySelector(".pl-dot, .pl-sv")'));
  ok('v10 places: by default the map shows the strike shading and its legend', await p.ev('!!document.querySelector("#plMap .fb-leg") && /Documented strikes/.test(document.getElementById("plMapCap").textContent)'));
  await p.ev('document.querySelector("#plLy [data-ly=religion]").click()');
  ok('v10 places: the Religion layer draws a dot per voter list', await p.wait('document.querySelectorAll("#plMap .pl-dot").length > 1300', 20000));
  ok('v10 places: no Religion dot names a group in its tooltip (Stephane, 2026-10-05: no dominant-sect labels in text)', await p.ev(`(() => { const G = ${JSON.stringify(S.groups.map(g => g.split('/')[0].trim()))}; return [...document.querySelectorAll('#plMap .pl-dot title')].every(x => !G.some(g => x.textContent.includes(g))); })()`));
  ok('v10 places: its caption is "Registered voters by sect, 2014 (Interior Ministry lists via lub-anan.com). Not residents."', await p.ev(`document.getElementById("plMapCap").textContent.startsWith(${JSON.stringify(CAP_EN)})`));
  ok('v10 places: its legend names all 20 groups', await p.ev('document.querySelectorAll("#plMapEx .pl-lg li").length === 20 && /Shia/.test(document.getElementById("plMapEx").textContent) && /Maronite/.test(document.getElementById("plMapEx").textContent) && /Not stated/.test(document.getElementById("plMapEx").textContent)'));
  ok('v10 places: while the Religion layer is on, the strike counts beside the place list are hidden', await p.ev('getComputedStyle(document.querySelector("#plList .pl-ct")).display === "none"'));
  ok('v10 places: with the layer on the strike shading and its legend are gone (religion is never drawn on the strike data)', await p.ev('!document.querySelector("#plMap .fb-leg") && [...document.querySelectorAll("#plMap .fb-a")].every(a => !/--war/.test(a.getAttribute("style") || "")) && !/strike/i.test(document.getElementById("plMapCap").textContent + document.getElementById("plMap").getAttribute("aria-label")) && !/strike/i.test(document.querySelector("#plMap svg").getAttribute("aria-label"))'));
  ok('v10 places: the dots use theme tokens, not hard-coded colours', await p.ev('[...document.querySelectorAll("#plMap .pl-dot")].every(c => /var\\(--/.test(c.getAttribute("style")))'));
  ok('v10 places: a dot says it shows registered voters by sect in 2014, not residents, and points to the place page', await p.ev('/registered voters by sect, 2014; not residents/.test(document.querySelector("#plMap .pl-dot title").textContent)'));
  ok('v10 places: no text names a "dominant" group', await p.ev('!/dominant|majority sect|sect of the town/i.test(document.getElementById("placesRoot").textContent)'));
  await p.ev('document.querySelector("#plLy [data-ly=services]").click()');
  ok('v10 places: the Services layer replaces it (a layer at a time) with a dot per facility', await p.wait('document.querySelectorAll("#plMap .pl-sv").length > 3000 && !document.querySelector("#plMap .pl-dot")', 20000));
  ok('v10 places: its caption names OpenStreetMap, the CERD list and the coverage caveat', await p.ev('/OpenStreetMap contributors/.test(document.getElementById("plMapCap").textContent) && /CERD/.test(document.getElementById("plMapCap").textContent) && /unmapped/.test(document.getElementById("plMapCap").textContent)'));
  const n0 = await p.ev('document.querySelectorAll("#plMap .pl-sv").length');
  await p.ev('document.querySelector("#plMapEx [data-cat=pharmacy]").click()'); await sleep(900);
  ok('v10 places: a legend button switches one kind of facility off', await p.wait(`document.querySelectorAll("#plMap .pl-sv").length < ${n0 - 900}`, 8000) && await p.ev('document.querySelector("#plMapEx [data-cat=pharmacy]").getAttribute("aria-pressed") === "false"'));
  await p.ev('document.querySelector("#plLy [data-ly=services]").click()'); await sleep(500);
  ok('v10 places: switching the layer off brings back the strike shading', await p.wait('!document.querySelector("#plMap .pl-sv") && !!document.querySelector("#plMap .fb-leg")', 8000));
  await p.ev('document.querySelector("#plLy [data-ly=religion]").click()'); await p.wait('document.querySelectorAll("#plMap .pl-dot").length > 1300', 20000);
  const id = await p.ev('document.querySelector("#plMap .pl-dot").dataset.id');
  await p.ev('document.querySelector("#plMap .pl-dot").dispatchEvent(new MouseEvent("click", { bubbles: true }))');
  ok('v10 places: a dot opens the page of its place', await p.wait(`!!document.querySelector("#plPageH") && location.hash.includes(${JSON.stringify(id)})`, 20000));
  ok('v10 places: 0 console errors on the layers', p.errors().length === 0, p.errors());

  // a town page: sect shares, politics, services
  ok('v10 places: Sour opens with its sect chart under the caption', await go(p, '#place/LBN63110', '!!document.querySelector("#plSect .hc-bars li")'));
  ok('v10 places: the sect block carries the caption, bars with counts and shares, and a link to the list as transcribed', await p.ev(`(() => { const b = document.getElementById("plSect"); return b.querySelector(".pl-cap").textContent === ${JSON.stringify(CAP_EN)} && /19,496/.test(b.textContent) && /66%/.test(b.textContent) && b.querySelectorAll(".hc-bars li").length >= 8 && !!b.querySelector("a[href*=lub-anan]"); })()`));
  ok('v10 places: the largest group is the first bar and the chart names no "dominant" group', await p.ev('/Shia/.test(document.querySelector("#plSect .hc-bars li .hb-l").textContent) && !/dominant/i.test(document.getElementById("plSect").textContent)'));
  ok('v10 places: nothing in the sect block links to or opens the strike map', await p.ev('!document.querySelector("#plSect a[data-hub=map], #plSect #plOpenMap, #plSect [href*=\\"#map\\"]")'));
  ok('v10 places: the Politics block says the results are for the election district, not the town', await p.wait('document.querySelectorAll("#plPol .fb-card[data-e]").length === 2', 15000) && await p.ev('/election district South II/.test(document.querySelector("#plPol .pl-cap").textContent) && /not for (Sour|Tyre)/.test(document.querySelector("#plPol .pl-cap").textContent)'));
  ok('v10 places: it shows 2022 and 2018 with seats by bloc, list votes and turnout', await p.ev('(() => { const c = [...document.querySelectorAll("#plPol .fb-card[data-e]")]; return c.length === 2 && c.every(x => /Turnout/.test(x.textContent) && x.querySelectorAll("[data-bl] li").length >= 2 && x.querySelectorAll("[data-ls] li").length >= 2) && /2022/.test(c[0].textContent) && /2018/.test(c[1].textContent); })()'));
  ok('v10 places: the bloc bars add up to the seats of South II (7) in both years', await p.ev('[...document.querySelectorAll("#plPol .fb-card[data-e]")].every(c => [...c.querySelectorAll("[data-bl] .hb-v")].reduce((a, v) => a + (+v.textContent.replace(/,/g, "")), 0) === 7)'));
  ok('v10 places: the Services block always carries the radius and OpenStreetMap caveats, with counts or an honest empty line', await p.ev('/km of this place/.test(document.getElementById("plSvc").textContent) && /OpenStreetMap/.test(document.getElementById("plSvc").textContent) && (document.querySelectorAll("#plSvc .fb-stat").length === 6 || !!document.querySelector("#plSvc .hub-empty"))'));
  ok('v10 places: the order is population, sect chart, politics, services, then strikes', await p.ev('(() => { const h = [...document.querySelectorAll("#plView h4.pl-s")].map(x => x.id || x.textContent); const i = n => h.findIndex(x => x === n); return i("plSectH") > 0 && i("plPolH") === i("plSectH") + 1 && i("plSvcH") === i("plPolH") + 1; })()'));
  ok('v10 places: one "Data behind this tab" link to #data/places', await p.ev('document.querySelectorAll("#placesRoot a[href=\\"#data/places\\"]").length === 1'));
  // a village with no list by sect row and one without an election district
  const none = Object.keys(readData('places/p/LB43.json')).find(k => !S.rows[k]);
  ok('v10 places: a place with no voter list says so', await go(p, `#place/${none}`, '!!document.querySelector("#plSect .hub-empty, #plSect .hc-bars")') && await p.ev('!!document.querySelector("#plSect .pl-cap")'));
  ok('v10 places: Khiam shows six counts, one public school', await go(p, '#place/LBN43020', 'document.querySelectorAll("#plSvc .fb-stat").length === 6') && await p.ev('(() => { const d = [...document.querySelectorAll("#plSvc .fb-stat")].map(x => x.querySelector("dt").textContent + "=" + x.querySelector("dd").textContent); return d.some(x => /Public schools=1/.test(x)) && d.some(x => /Hospitals=0/.test(x)); })()'));
  ok('v10 places: 0 console errors on the town pages', p.errors().length === 0, p.errors());
  // the strike map never shows religion
  await p.ev('location.hash = "#map"'); await sleep(1500);
  ok('v10 places: the Strike map tab shows no sect data, layer or caption', await p.ev('!document.querySelector("#map .pl-dot, #map .pl-lg") && !/registered voters by sect|Sunni|Shia|Maronite/i.test(document.getElementById("map").textContent)'));
  await p.close();

  // Communities and seats over time
  const h = await open(1400, SITE, { hash: '#history' });
  ok('v10 places: #history opens with five section chips and the sub-view', await h.wait('!document.getElementById("places").hidden && document.querySelectorAll("#plNav [data-id]").length === 5 && document.querySelectorAll("#plView details.pl-hd").length === 18', 25000));
  ok('v10 places: the history chip is pressed and the address is #history', await h.ev('document.querySelector("#plNav [data-id=history]").getAttribute("aria-pressed") === "true" && location.hash === "#history"'));
  ok('v10 places: the 2014 voters chart, the 1860 estimate and the 1932 census are charted, with the 2014 caption', await h.ev(`document.querySelectorAll("#plHn li").length >= 12 && document.querySelectorAll("#plH60 li").length >= 4 && document.querySelectorAll("#plH32 li").length >= 8 && document.getElementById("plView").textContent.includes(${JSON.stringify(CAP_EN)})`));
  ok('v10 places: the 1843 to 1861 qaimaqamate is described and marked approximate, with no map', await h.ev('!!document.querySelector("#plH-double-qaimaqamate-1843-1861 .fb-tag") && !document.querySelector("#plH-double-qaimaqamate-1843-1861 svg") && /no map is drawn/.test(document.getElementById("plH-double-qaimaqamate-1843-1861").textContent)'));
  await h.ev('document.querySelector("#plH-seats-2017-law").open = true'); await sleep(200);
  ok('v10 places: the 2017 law table has 15 districts and a total row, with seats by community', await h.ev('document.querySelectorAll("#plH-seats-2017-law tbody tr").length === 16 && /Maronite 7/.test(document.getElementById("plH-seats-2017-law").textContent)'));
  ok('v10 places: every table names its source and licence', await h.ev('[...document.querySelectorAll("#plView details.pl-hd")].every(d => /Source/.test(d.querySelector(".pl-vsrc").textContent) && /Licence/.test(d.querySelector(".pl-vsrc").textContent))'));
  ok('v10 places: estimates are tagged', await h.ev('document.querySelectorAll("#plView .fb-tag").length >= 3'));
  ok('v10 places: the history view never says "dominant"', await h.ev('!/dominant/i.test(document.getElementById("plView").textContent)'));
  ok('v10 places: 0 console errors on #history', h.errors().length === 0, h.errors());
  await h.close();

  // 390 px
  for (const hash of ['#history', '#place/LBN63110', '#places']) {
    const m = await open(390, SITE, { hash });
    await m.wait('!document.querySelector("#plView .hub-load") && !!document.querySelector("#plView *")', 25000); await sleep(1200);
    if (hash === '#places') { await m.ev('document.querySelector("#plLy [data-ly=religion]").click()'); await m.wait('document.querySelectorAll("#plMap .pl-dot").length > 1300', 20000); }
    ok(`v10 places: ${hash} has no horizontal overflow at 390 and no console errors`, (await m.ev('document.documentElement.scrollWidth')) <= 390 && m.errors().length === 0, m.errors());
    await m.close();
  }

  // Arabic and French
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#place/LBN63110' });
  await a.wait('!!document.querySelector("#plSect .hc-bars li") && document.querySelectorAll("#plPol .fb-card[data-e]").length === 2', 25000); await sleep(500);
  ok('v10 places ar: the page is right-to-left and the sect block, politics and services are in Arabic with the Arabic caption', await a.ev('(() => { const x = s => /[\\u0600-\\u06FF]/.test(document.querySelector(s).textContent); return document.documentElement.dir === "rtl" && x("#plSect .pl-cap") && x("#plPol .pl-cap") && x("#plSvc .note") && document.querySelector("#plSect .pl-cap").textContent.startsWith("الناخبون المسجّلون بحسب الطائفة"); })()'));
  ok('v10 places ar: the sect bars are in Arabic with Arabic-Indic digits', await a.ev('/[٠-٩]/.test(document.querySelector("#plSect .hc-bars").textContent) && /الشيعة|شيعي/.test(document.querySelector("#plSect .hc-bars").textContent)'));
  ok('v10 places ar: no English from the new blocks (headings and notes)', await a.ev('(() => { const t = ["#plSectH", "#plPolH", "#plSvcH", "#plSect .pl-cap", "#plPol .pl-cap", "#plSvc .note"].map(s => document.querySelector(s).textContent).join(" "); return !/Registered voters|Politics|Services|Results for|Facilities mapped/.test(t); })()'));
  ok('v10 places ar: no horizontal overflow and no console errors', await a.ev('document.documentElement.scrollWidth <= 1400') && a.errors().length === 0, a.errors());
  await go(a, '#history', 'document.querySelectorAll("#plView details.pl-hd").length === 18');
  ok('v10 places ar: the history view is Arabic (lead, section headings, table titles)', await a.ev('(() => { const x = s => /[\\u0600-\\u06FF]/.test(s); return x(document.querySelector("#plView .lead").textContent) && x(document.querySelector("#plHs-people").textContent) && [...document.querySelectorAll("#plView details.pl-hd summary b")].every(b => x(b.textContent)); })()'));
  await go(a, '#places', 'document.querySelectorAll("#plList li").length >= 20');
  await a.ev('document.querySelector("#plLy [data-ly=religion]").click()'); await a.wait('document.querySelectorAll("#plMap .pl-dot").length > 1300', 20000);
  ok('v10 places ar: the Religion layer caption and legend are Arabic and the map stays left-to-right', await a.ev('/[\\u0600-\\u06FF]/.test(document.getElementById("plMapCap").textContent) && document.getElementById("plMapCap").textContent.startsWith("الناخبون المسجّلون") && document.querySelectorAll("#plMapEx .pl-lg li").length === 20 && getComputedStyle(document.querySelector("#plMap svg")).direction === "ltr"'));
  ok('v10 places ar: the layer buttons are Arabic', await a.ev('[...document.querySelectorAll("#plLy [data-ly]")].every(b => /[\\u0600-\\u06FF]/.test(b.textContent))'));
  await a.ev('HUB.setLang("fr", { noStore: true })'); await sleep(900);
  ok('v10 places fr: the Religion layer caption is French', await a.ev('document.getElementById("plMapCap").textContent.startsWith("Électeurs inscrits par confession, 2014")'));
  ok('v10 places: 0 console errors in Arabic and French', a.errors().length === 0, a.errors());
  await a.close();

  // empty and error states: the rest of the page keeps working
  const fx = fixture('places-v10-nosects', null, { 'places/sects-2014.json': null, 'places/politics.json': null });
  const x = await open(1400, fx, { hash: '#place/LBN63110', allow: /sects-2014|politics|404|Failed to load/ });
  await x.wait('!!document.querySelector("#plPageH") && !!document.querySelector("#plSect .hub-err") && !!document.querySelector("#plPol .hub-err")', 30000);
  ok('v10 places: a missing sect file or politics file shows the error state with Retry in its own block, and the rest of the page works', await x.ev('!!document.querySelector("#plSect [data-retry]") && !!document.querySelector("#plPol [data-retry]") && document.querySelectorAll("#plView .fb-tbl").length >= 1 && !!document.querySelector("#plStrikes")'));
  await x.close();
  const fh = fixture('places-v10-nohistory', null, { 'places/history.json': null });
  const y = await open(1400, fh, { hash: '#history', allow: /history\.json|404|Failed to load/ });
  await y.wait('!!document.querySelector("#plView .hub-err")', 25000);
  ok('v10 places: a missing history file shows the error state with Retry and the chips stay', await y.ev('!!document.querySelector("#plView [data-retry]") && document.querySelectorAll("#plNav [data-id]").length === 5'));
  await y.close();

  // screenshots for review (saved next to the check output, v10-*.png)
  const sc = async (page, sel, name, off = -80) => { await page.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.scrollIntoView({ block: "start" }); window.scrollBy(0, ${off}); } })()`); await sleep(500); await page.shot(name); };
  const s1 = await open(1400, SITE, { hash: '#places' });
  await s1.wait('document.querySelectorAll("#plMap .fb-a").length === 26', 20000);
  await s1.ev('document.querySelector("#plLy [data-ly=religion]").click()'); await s1.wait('document.querySelectorAll("#plMap .pl-dot").length > 1300', 20000); await sleep(600);
  await sc(s1, '#plLy', 'v10-places-religion.png');
  await s1.ev('document.querySelector("#plLy [data-ly=services]").click()'); await s1.wait('document.querySelectorAll("#plMap .pl-sv").length > 3000', 20000); await sleep(600);
  await sc(s1, '#plLy', 'v10-places-services.png');
  await go(s1, '#place/LBN63110', '!!document.querySelector("#plSect .hc-bars li") && document.querySelectorAll("#plPol .fb-card[data-e]").length === 2'); await sleep(400);
  await sc(s1, '#plSectH', 'v10-place-sect.png');
  await sc(s1, '#plPolH', 'v10-place-politics.png');
  await sc(s1, '#plSvcH', 'v10-place-services.png');
  await go(s1, '#history', 'document.querySelectorAll("#plView details.pl-hd").length === 18'); await sleep(500);
  await sc(s1, '#plNav', 'v10-history.png', -20);
  await s1.ev('document.querySelector("#plH-seats-2017-law").open = true'); await sc(s1, '#plHs-laws', 'v10-history-laws.png', -20);
  ok('v10 places: screenshots taken, 0 console errors', s1.errors().length === 0, s1.errors());
  await s1.close();
  const s2 = await open(390, SITE, { query: '?lang=ar', hash: '#place/LBN63110' });
  await s2.wait('!!document.querySelector("#plSect .hc-bars li") && document.querySelectorAll("#plPol .fb-card[data-e]").length === 2', 25000); await sleep(500);
  await sc(s2, '#plSectH', 'v10-place-sect-ar-390.png');
  await sc(s2, '#plPolH', 'v10-place-politics-ar-390.png');
  await s2.close();
}
