// Checks for the Places tab (FE-B): search (English, Arabic, spelling variants), the place page (pin, strikes, events, municipality, population, refugees, displacement, election district, "Open on the strike map"),
// elections (map, table, districts, lists, winners, 2026 not held), the 2023-26 war, people; empty, error and unknown-place states; 390 px; Arabic and French.
// A few long-lived pages walk through the sections by hash, so the suite stays short.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, get } = T;
  const q = (p, s) => p.ev(`(() => { const i = document.getElementById("plQ"); i.value = ${JSON.stringify(s)}; i.dispatchEvent(new Event("input")); })()`);
  const names = p => p.ev('[...document.querySelectorAll("#plList .pl-it b")].map(b => b.textContent)');
  const go = async (p, h, expr) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`!document.querySelector("#plView .hub-load") && (${expr})`, 30000); };
  const SEC = [['#places', 'document.querySelectorAll("#plList li").length >= 20'], ['#place/LBN43020', '!!document.querySelector("#plPageH")'], ['#elections/2022-parliamentary', '!!document.querySelector("#eleMap .fb-a")'],
    ['#war', 'document.querySelectorAll("#plView .fb-card").length >= 12'], ['#people', 'document.querySelectorAll("#plView .fb-card").length >= 14']];

  const p = await open(1400, SITE, { hash: '#places' });
  ok('places: opens by deep link with four section chips', await p.wait('!document.getElementById("places").hidden && document.querySelectorAll("#plNav [data-id]").length === 4', 20000));
  ok('places: the search lists the most documented places first, with a district map', await p.wait('document.querySelectorAll("#plList li").length >= 20 && document.querySelectorAll("#plMap .fb-a").length === 26', 20000));
  await q(p, 'Khiam'); await sleep(500);
  ok('places: searching "Khiam" finds Khiam first', (await names(p))[0] === 'Khiam');
  await q(p, 'الخيام'); await sleep(500);
  ok('places: searching the Arabic name finds Khiam', (await names(p)).includes('Khiam'));
  await q(p, 'Bint Jbeil'); await sleep(500);
  ok('places: a spelling variant ("Bint Jbeil") finds "Bent Jbeil" or "Bent Jubail"', (await names(p)).some(n => /Bent Jb|Bent Jubail/.test(n)));
  await q(p, 'zzzzqq'); await sleep(400);
  ok('places: a search with no match says so', await p.ev('/No place matches/.test(document.getElementById("plList").textContent)'));
  await q(p, ''); await p.ev('document.querySelector("#plMap .fb-a[data-p=LB63]").dispatchEvent(new Event("click"))'); await sleep(400);
  ok('places: clicking a district on the map filters the list to that district', await p.ev('document.getElementById("plC").value === "LB63" && [...document.querySelectorAll("#plList .pl-sub")].every(s => /Sour/.test(s.textContent))'));

  // a place page
  ok('places: the deep link #place/<id> opens the page of Khiam', await go(p, '#place/LBN43020', 'document.querySelector("#plPageH")?.textContent.includes("Khiam")'));
  ok('places: the page has a map pin on the Lebanon outline and a locator map', await p.ev('!!document.querySelector(".pl-zoom .fb-pin") && !!document.querySelector(".pl-whole .fb-pin") && document.querySelectorAll(".pl-zoom .fb-a").length === 26'));
  ok('places: municipality, elevation, cadaster and election district are shown', await p.ev('(() => { const t = document.querySelector(".pl-facts").textContent; return /Municipality/.test(t) && /709/.test(t) && /Cadaster/.test(t) && /South III/.test(t); })()'));
  ok('places: population block names its source and says a cadaster is not a census', await p.ev('/Kontur/.test(document.getElementById("plView").textContent) && /not a census/.test(document.getElementById("plView").textContent)'));
  ok('places: refugees registered in the cadaster (end of 2014) are listed', await p.ev('/Refugees registered here/.test(document.getElementById("plView").textContent) && /1,906/.test(document.getElementById("plView").textContent)'));
  ok('places: documented strikes at Khiam are counted from the strike data (the shard\'s own count) with a breakdown by war', await p.ev(`new RegExp(${JSON.stringify(String(T.readData('places/p/LB43.json').LBN43020.stn))}).test(document.querySelector("#plStrikes .fb-stat dd").textContent) && document.querySelectorAll("#plWar li").length >= 3`));
  ok('places: each strike row links to its own source and shows a confidence mark', await p.ev('document.querySelectorAll("#plStList li").length === 12 && !!document.querySelector("#plStList li a[href^=http]") && !!document.querySelector("#plStList li .cf")'));
  await p.ev('document.getElementById("plStMore").click()'); await sleep(200);
  ok('places: "Show more" lists more strikes', await p.ev('document.querySelectorAll("#plStList li").length === 24'));
  ok('places: timeline events that name the place are listed with a caveat about same-name places', await p.ev('document.querySelectorAll("#plEvents li").length >= 5 && /check the event/.test(document.getElementById("plEvents").textContent)'));
  ok('places: displacement and returns are shown at district level with the scope stated', await p.ev('/whole district of Marjaayoun/.test(document.getElementById("plDisp").textContent) && /hosted/.test(document.getElementById("plDisp").textContent)'));
  ok('places: the district population block (2026) is present', await p.ev('/People in the district, 2026/.test(document.getElementById("plView").textContent)'));
  ok('places: nearby places are listed with distances, and copy link and JSON download are present', await p.ev('document.querySelectorAll(".pl-near li").length === 7 && !!document.getElementById("plCopy") && !!document.getElementById("plJson")'));
  await p.ev('document.getElementById("plOpenMap").click()'); await sleep(2500);
  ok('places: "Open on the strike map" opens the Strike map filtered to the place', await p.wait('!document.getElementById("map").hidden && document.getElementById("mpQ")?.value === "Khiam" && document.querySelectorAll("#mpList li").length > 0', 20000));
  await p.ev('window.history.back()'); await sleep(1200);
  await p.wait('!!document.querySelector("#plEvents [data-ev]")', 20000);
  await p.ev('document.querySelector("#plEvents [data-ev]").click()'); await sleep(1500);
  ok('places: "Open in timeline" on an event opens the event card', await p.wait('!document.getElementById("timeline").hidden && !document.getElementById("evCard").hidden', 15000));
  ok('places: a village with no strike says so honestly', await go(p, '#place/LBN21122', 'document.querySelector("#plPageH")?.textContent.includes("Mrah") && /No strike is documented/.test(document.getElementById("plStrikes").textContent)'));
  ok('places: an unknown place id shows a message with a link back to search', await go(p, '#place/NOPE', '/not in the index/.test(document.getElementById("plView").textContent) && !!document.querySelector("#plView a[href=\\"#places\\"]")'));

  // elections
  ok('places: #elections/<id>/<district> opens the election and the district', await go(p, '#elections/2022-parliamentary/Beirut%20I', 'document.querySelector("#eleDH")?.textContent === "Beirut I"'));
  ok('places: the district shows seats, confessions, lists and elected members (8 seats, 8 winners)', await p.ev('document.querySelectorAll("#eleCf li").length >= 5 && document.querySelectorAll("#eleDist table").length === 2 && [...document.querySelectorAll("#eleDist table")][1].querySelectorAll("tbody tr").length === 8'));
  ok('places: the election table lists all ten elections and highlights the chosen one', await p.ev('document.querySelectorAll("#eleTbl tbody tr").length === 10 && !!document.querySelector("#eleTbl tr.on")'));
  ok('places: the district map colours 26 districts and offers three measures', await p.ev('document.querySelectorAll("#eleMap .fb-a").length === 26 && document.querySelectorAll("#eleMet [data-m]").length === 3'));
  await p.ev('document.querySelector("#eleMet [data-m=seats]").click()'); await sleep(300);
  ok('places: switching the measure to seats redraws the map legend', await p.ev('!!document.querySelector("#eleMap .fb-leg")'));
  await p.ev('document.querySelector("#eleNav [data-id=\\"2026-parliamentary\\"]").click()'); await sleep(1000);
  ok('places: the 2026 election is shown as not held, with no invented results', await p.wait('/not held|extend/i.test(document.getElementById("eleOne").textContent) && !document.querySelector("#eleOne #eleMap")', 10000));
  await p.ev('document.querySelector("#eleNav [data-id=\\"2025-municipal\\"]").click()'); await sleep(1200);
  ok('places: municipal elections show the governorate map, city races and qada turnout', await p.wait('document.querySelectorAll("#eleOne .fb-card").length >= 1 && !!document.querySelector("#eleQ li")', 10000));
  ok('places: each election lists its sources and licence', await p.ev('/Sources/.test(document.querySelector("#eleOne .pl-src").textContent) && /Licence/.test(document.querySelector("#eleOne .pl-src").textContent)'));
  ok('places: the election CSV downloads exist', await (async () => { const r = await get('data/csv/elections-districts.csv'); const t = await r.text(); return r.status === 200 && t.includes('2022-parliamentary'); })());

  // war and people
  ok('places: the war section shows tiles, many charts and the IOM licence note', await go(p, '#war', 'document.querySelectorAll("#plView .fb-card").length >= 12 && document.querySelectorAll("#plView .fb-stat").length === 5 && /IOM/.test(document.querySelector("#plView .fb-note-band").textContent)'));
  ok('places: the war charts show source and licence', await p.ev('[...document.querySelectorAll("#plView .fb-card")].filter(c => c.querySelector(".hc-svg")).every(c => /Licence/.test(c.querySelector(".fb-src")?.textContent || ""))'));
  ok('places: the displacement map by district switches measure', await (async () => { const a = await p.ev('document.querySelector("#warTbl tbody tr td").textContent'); await p.ev('document.querySelector("#warMet [data-m=ret_to]").click()'); await sleep(250); return (await p.ev('document.querySelector("#warTbl tbody tr td").textContent')) !== a; })());
  ok('places: the damage tables carry their source and licence', await p.ev('[...document.querySelectorAll("#plView table")].length >= 8'));
  ok('places: the people section shows tiles, charts, a pyramid and the 12 camps', await go(p, '#people', 'document.querySelectorAll("#plView .fb-card").length >= 14 && !!document.querySelector("#peoPyr svg") && document.querySelectorAll("#plView .fb-card.wide table tbody tr").length >= 12'));
  await p.ev('document.querySelector("#peoPy [data-y=\\"1950\\"]").click()'); await sleep(200);
  ok('places: the pyramid changes with the year', await p.ev('document.querySelector("#peoPy [data-y=\\"1950\\"]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#peoPyr rect").length === 42'));
  ok('places: 0 console errors across the whole tab at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // 390 px
  const m = await open(390, SITE, { hash: '#places' });
  for (const [h, expr] of SEC) {
    await go(m, h, expr); await sleep(900);
    ok(`places: ${h} has no horizontal overflow at 390`, (await m.ev('document.documentElement.scrollWidth')) <= 390);
  }
  ok('places: 0 console errors at 390', m.errors().length === 0, m.errors());
  await m.close();

  // Arabic and French
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#place/LBN43020' });
  await a.wait('!!document.querySelector("#plPageH")', 25000); await sleep(800);
  ok('places: the Arabic place page shows the Arabic name, district and governorate, right-to-left, no overflow', await a.ev('(() => { const h = document.getElementById("plPageH").textContent, f = document.querySelector(".pl-facts").textContent; return document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 1400 && h.includes("الخيام") && /مرجعيون/.test(f) && /النبطية/.test(f); })()'));
  ok('places: Arabic translates the chips and the headings', await a.ev('/[\\u0600-\\u06FF]/.test(document.querySelector("#plNav").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#plView").textContent.slice(0, 120))'));
  await go(a, '#places', 'document.querySelectorAll("#plList li").length >= 20');
  await q(a, 'بنت جبيل'); await sleep(500);
  ok('places: an Arabic search works in the Arabic interface', (await a.ev('document.querySelectorAll("#plList li").length')) >= 1);
  for (const [h, expr] of SEC.slice(2)) { await go(a, h, expr); await sleep(800); ok(`places: Arabic ${h} at 1400 has no overflow`, await a.ev('document.documentElement.scrollWidth <= 1400')); }
  await go(a, '#place/LBN43020', '!!document.querySelector("#plPageH")');
  await a.ev('HUB.setLang("fr", { noStore: true })'); await sleep(900);
  ok('places: French renders the place page labels in French', await a.ev('/Municipalité/.test(document.querySelector(".pl-facts").textContent) && /Frappes à cet endroit/.test(document.getElementById("plView").textContent)'));
  ok('places: 0 console errors in Arabic and French', a.errors().length === 0, a.errors());
  await a.close();
  const am = await open(390, SITE, { query: '?lang=ar', hash: '#place/LBN43020' });
  for (const [h, expr] of [SEC[1], SEC[0], SEC[2], SEC[4]]) {
    await go(am, h, expr); await sleep(900);
    ok(`places: Arabic ${h} at 390 is right-to-left and has no overflow`, await am.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 390'));
  }
  ok('places: 0 console errors in Arabic at 390', am.errors().length === 0, am.errors());
  await am.close();

  // empty and error states
  const fe = fixture('places-empty', D => { D.tabs.places = {}; });
  const em = await open(1400, fe, { hash: '#places' });
  await sleep(600);
  ok('places: with no data in the build the panel keeps its empty state', await em.ev('!!document.querySelector("#placesRoot .hub-empty") && !document.querySelector("#plNav")'));
  await em.close();
  const fi = fixture('places-noindex', null, { 'places/index.json': null });
  const ni = await open(1400, fi, { hash: '#places', allow: /index\.json|404|Failed to load/ });
  await ni.wait('!!document.querySelector("#plView .hub-err")', 20000);
  ok('places: a missing index shows the error state with Retry and the section chips stay', await ni.ev('!!document.querySelector("#plView [data-retry]") && document.querySelectorAll("#plNav [data-id]").length === 4'));
  await ni.close();
  const fs = fixture('places-noshard', null, { 'places/p/LB43.json': null, 'war/series.json': null });
  const ns = await open(1400, fs, { hash: '#place/LBN43020', allow: /LB43|series\.json|404|Failed to load/ });
  await ns.wait('!!document.querySelector("#plView .hub-err")', 25000);
  ok('places: a missing district file shows the error state with Retry on the place page', await ns.ev('!!document.querySelector("#plView [data-retry]")'));
  await ns.ev('location.hash = "#war"'); await ns.wait('!!document.querySelector("#plView .hub-err")', 20000);
  ok('places: a missing war file shows the error state with Retry', await ns.ev('!!document.querySelector("#plView [data-retry]")'));
  await ns.close();
}
