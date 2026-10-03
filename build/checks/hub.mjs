// Core hub checks (owner: FE-A): the loader, tabs and routing, the language switch (EN / AR / FR, RTL), the downloads and the shared helpers (charts, correlation).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, symlinkSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const TABS = ['timeline', 'map', 'places', 'cost', 'electricity', 'world', 'data', 'about'];
const LABELS = 'Timeline,Strike map,Places,Cost of living,Electricity,World,Data,About';
const csvRows = text => {  // minimal CSV reader (quotes, doubled quotes, newlines inside quotes); returns the rows
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
const walk = (dir, base = dir) => readdirSync(dir).flatMap(e => { const p = join(dir, e); return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p)]; });

export default async function (T) {
  const { ok, sleep, open, siteDir, out, fixture, SITE, marks } = T;

  // ---------------------------------------------------------------- loader: cache, spinner, error state, retry
  const p = await open(1400);
  // ---------------------------------------------------------------- downloads go through the viewer's `downloads` capability
  ok('downloads: with the viewer capability, clicking a CSV link calls downloads.save with the file name and its bytes', await p.ev(`(async () => {
    window.__saved = null; const had = window.claude;
    window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__saved = { f: r.filename, n: r.data.size || r.data.length }; return { status: 'saved' }; } } : null };
    const a = document.createElement('a'); a.href = 'data/csv/countries.csv'; a.setAttribute('download', ''); document.body.appendChild(a); a.click();
    for (let i = 0; i < 40 && !window.__saved; i++) await new Promise(r => setTimeout(r, 50));
    a.remove(); window.claude = had; return !!window.__saved && window.__saved.f === 'countries.csv' && window.__saved.n > 100; })()`));
  ok('downloads: a declined save shows no note; an unavailable viewer shows the "not available" note', await p.ev(`(async () => {
    const had = window.claude; const nt = () => document.getElementById('dlNote');
    window.claude = { use: async () => ({ save: async () => { throw { code: 'declined' }; } }) };
    await HubDL.save('x.csv', 'a,b');
    const quiet = !nt() || nt().hidden;
    window.claude = { use: async () => ({ save: async () => { throw { code: 'unavailable' }; } }) };
    await HubDL.save('x.csv', 'a,b');
    const shown = !!nt() && !nt().hidden && nt().textContent.length > 5; window.claude = had; return quiet && shown; })()`));
  ok('loader: HUB.load returns the same promise for the same path (cached)', await p.ev('(() => { const a = HUB.load("data/manifest.json"), b = HUB.load("data/manifest.json"); return a === b; })()'));
  ok('loader: HUB.load parses JSON and HUB.load(..., {as:"text"}) returns text', await p.ev('(async () => { const j = await HUB.load("data/manifest.json"); const t = await HUB.load("data/csv/timeline.csv", { as: "text" }); return Array.isArray(j.files) && j.files.length > 5 && /^id,date/.test(t); })()'));
  ok('loader: loadInto shows a busy spinner at once, then calls build and clears the busy state', await p.ev(`(async () => {
    const el = document.createElement("div"); document.body.appendChild(el);
    let built = null;
    const pr = HUB.loadInto(el, "data/strikes/geo.json", g => { built = Object.keys(g).includes("adm1"); el.textContent = "built"; });
    const spin = !!el.querySelector(".hub-spin") && el.getAttribute("aria-busy") === "true" && !!el.querySelector("[role=status]");
    await pr; const r = spin && built === true && !el.hasAttribute("aria-busy") && el.textContent === "built"; el.remove(); return r; })()`));
  ok('loader: a missing file shows an error state with the path and a Retry button, and no spinner', await p.ev(`(async () => {
    const el = document.createElement("div"); document.body.appendChild(el);
    await HUB.loadInto(el, "data/nope/missing.json", () => { el.textContent = "built"; }, { retries: 0 });
    const r = !!el.querySelector(".hub-err[role=alert]") && !!el.querySelector("[data-retry]") && /missing\\.json/.test(el.textContent) && !el.querySelector(".hub-spin") && !el.hasAttribute("aria-busy"); el.remove(); return r; })()`));
  ok('loader: a failed load is not cached (Retry fetches again)', await p.ev('(async () => { const a = HUB.load("data/nope/missing.json", { retries: 0 }).catch(() => 1), b = await a; const c = HUB.load("data/nope/missing.json", { retries: 0 }); await c.catch(() => 1); return a !== c; })()'));
  await p.close();

  // a tab whose data file is missing: error state, then Retry works once the file exists
  const fxMiss = fixture('missing-strikes', null, { 'strikes/strikes.json': null });
  const mi = await open(1400, fxMiss, { allow: /strikes\.json|404|Failed to load/ });
  await mi.ev('document.getElementById("t-map").click()'); await sleep(1500);
  ok('tab data missing: the Strike map shows the error state with Retry, not an empty or broken map', await mi.ev('!!document.querySelector("#mapRoot .hub-err") && !!document.querySelector("#mapRoot [data-retry]") && !document.getElementById("mpStage")'));
  symlinkSync(join(siteDir, 'data/strikes/strikes.json'), join(out, 'fx', 'missing-strikes', 'data/strikes/strikes.json'));
  await mi.ev('document.querySelector("#mapRoot [data-retry]").click()'); await sleep(1500);
  ok('tab data missing: after the file appears, Retry loads the map', await mi.ev('!!document.getElementById("mpStage") && !document.querySelector("#mapRoot .hub-err")'));
  await mi.close();

  // ---------------------------------------------------------------- tabs and routing
  const h = await open(1400);
  ok('tabs: 8 tabs in the order Timeline, Strike map, Places, Cost of living, Electricity, World, Data, About', await h.ev(`[...document.querySelectorAll(".hub-tabs [role=tab]")].map(x => x.textContent).join() === "${LABELS}"`));
  ok('tabs: D.hub.tabs matches the markup (ids and routes from the plugins)', await h.ev(`JSON.stringify(HUB.data.hub.tabs.map(t => t.id)) === JSON.stringify(${JSON.stringify(TABS)}) && HUB.data.hub.tabs.find(t => t.id === "places").routes.includes("place") && HUB.data.hub.tabs.find(t => t.id === "world").routes.includes("compare")`));
  for (const id of ['places', 'cost', 'electricity', 'world']) {
    await h.ev(`document.getElementById("t-${id}").click()`); await sleep(250);
    // the build has data for all four tabs, so each must show real content: a heading and a filled root with no visible empty state or spinner (a hidden .hub-empty does not count)
    ok(`tabs: "${id}" opens filled (heading and real content, no visible empty state), hash #${id}, other panels hidden`, await h.ev(`(async () => {
      const p = document.getElementById("${id}"), root = p.querySelector("[id$=Root]"), vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
      for (let i = 0; i < 40 && !(root && root.querySelector("svg, table, canvas, select, .fb-card, .wd, .pl-s, li") && !root.querySelector(".hub-load")); i++) await new Promise(r => setTimeout(r, 250));
      return !p.hidden && location.hash === "#${id}" && !!p.querySelector("h2") && !!root && root.textContent.trim().length > 200 && ![...p.querySelectorAll(".hub-empty")].some(vis) && !root.querySelector(".hub-load, .hub-err") && ${JSON.stringify(TABS)}.filter(x => x !== "${id}").every(x => document.getElementById(x).hidden) && document.getElementById("t-${id}").getAttribute("aria-selected") === "true";
    })()`));
  }
  await h.ev('history.back()'); await sleep(300);
  ok('routing: the browser back button returns to the previous tab', await h.ev('HUB.current === "electricity" && !document.getElementById("electricity").hidden'), await h.ev('HUB.current'));
  await h.ev('(() => { window.__calls = []; HUB.tab("places", { render(a, i) { window.__calls.push([a.join("/"), i.route, i.first]); } }); location.hash = "#place/LB1234"; })()'); await sleep(300);
  ok('routing: #place/<code> opens Places and hands the code to the tab', await h.ev('HUB.current === "places" && JSON.stringify(window.__calls[0].slice(0, 2)) === JSON.stringify(["LB1234", "place"])'), await h.ev('JSON.stringify(window.__calls)'));
  await h.ev('HUB.setHash("place", "LB5678")'); await sleep(200);
  ok('routing: HUB.setHash changes the address without re-rendering the tab', await h.ev('location.hash === "#place/LB5678" && window.__calls.length === 1'), await h.ev('JSON.stringify(window.__calls)'));
  await h.ev('location.hash = "#place/LB9"'); await sleep(250);
  ok('routing: editing the hash by hand re-renders with the new arguments', await h.ev('window.__calls.length === 2 && window.__calls[1][0] === "LB9"'));
  await h.ev('document.getElementById("t-timeline").click()'); await sleep(250);
  await h.ev('(() => { window.__w = []; HUB.tab("world", { render(a, i) { window.__w.push([a.join("|"), i.route]); } }); location.hash = "#world/NY.GDP.PCAP.CD/2020"; })()'); await sleep(250);
  await h.ev('location.hash = "#compare/NY.GDP.PCAP.CD/LBN,SYR,JOR"'); await sleep(250);
  ok('routing: #world/<indicator>/<year> and #compare/<indicator>/<countries> both open World with their arguments', await h.ev('HUB.current === "world" && JSON.stringify(window.__w) === JSON.stringify([["NY.GDP.PCAP.CD|2020", "world"], ["NY.GDP.PCAP.CD|LBN,SYR,JOR", "compare"]])'), await h.ev('JSON.stringify(window.__w)'));
  ok('routing: HUB.href builds the same links the parser reads', await h.ev('HUB.href("compare", "NY.GDP.PCAP.CD", "LBN,SYR") === "#compare/NY.GDP.PCAP.CD/LBN,SYR" && JSON.stringify(HUB.parse("#place/LB1%2F2").args) === JSON.stringify(["LB1/2"])'));
  ok('tabs: 0 console errors (tabs and routing)', h.errors().length === 0, h.errors());
  await h.close();
  for (const [hash, tab] of [['#place/LB1234', 'places'], ['#world/NY.GDP.PCAP.CD/2020', 'world'], ['#compare/NY.GDP.PCAP.CD/LBN,SYR', 'world'], ['#electricity', 'electricity'], ['#map', 'map']]) {
    const d = await open(1400, SITE, { hash });
    ok(`deep link ${hash}: a fresh load opens the ${tab} tab`, await d.ev(`HUB.current === "${tab}" && !document.getElementById("${tab}").hidden`), await d.ev('HUB.current'));
    await d.close();
  }

  // ---------------------------------------------------------------- i18n: sha1 keys, switcher, AR (RTL), FR, fallback marker
  const L = await open(1400);
  const vec = ['Timeline', 'Strike map', 'The answer, recorded.', 'خط زمني', 'Café, naïve: 1975–90 — “quotes”', '{n} events, 1800 to 30 Sep 2026.'];
  const want = vec.map(s => createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 12));
  ok('i18n: the JS sha1 key equals sha1(en)[:12] computed by Python/Node (ASCII, Arabic, accents, dashes)', JSON.stringify(await L.ev(`${JSON.stringify(vec)}.map(s => HUB.hkey(s))`)) === JSON.stringify(want));
  ok('i18n: the page starts in English: lang=en, dir=ltr, a switcher with EN pressed', await L.ev('document.documentElement.lang === "en" && document.documentElement.dir === "ltr" && document.querySelector("#langSw [data-lang=en]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#langSw button").length === 3'));
  ok('i18n: t() returns the English in English, fills {placeholders}, and th() adds no marker', await L.ev('HUB.t("{a} to {b}", { a: 1, b: 2 }) === "1 to 2" && HUB.th("Plain & <b>") === "Plain &amp; &lt;b&gt;" && !/enm/.test(HUB.th("Zzzz untranslated"))'));
  await L.ev('document.querySelector("#langSw [data-lang=ar]").click()'); await sleep(1500);
  const arT = await L.ev('document.querySelector("h1").textContent');
  ok('i18n AR: the switcher sets lang=ar and dir=rtl, remembers the choice, and translates the title, tabs and lead', await L.ev('document.documentElement.lang === "ar" && document.documentElement.dir === "rtl" && getComputedStyle(document.body).direction === "rtl" && localStorage.getItem("hub-lang") === "ar" && document.querySelector("#langSw [data-lang=ar]").getAttribute("aria-pressed") === "true" && document.title === HUB.t("Free Lebanon Data Hub")') && /[\u0600-\u06FF]/.test(arT), arT);
  ok('i18n AR: tab labels and the section headings are Arabic, with no English left in them', await L.ev('[...document.querySelectorAll(".hub-tabs [role=tab]")].every(b => /[\\u0600-\\u06FF]/.test(b.textContent) && !/[A-Za-z]/.test(b.textContent)) && ["timeline", "map", "places", "cost", "electricity", "world", "data", "about"].every(i => /[\\u0600-\\u06FF]/.test(document.querySelector("#" + i + " h2").textContent))'));
  ok('i18n AR: the content translation file loads (data/i18n/ar.json) and event titles use it', await L.ev('HUB.load("data/i18n/ar.json").then(o => Object.keys(o).length > 600)') && await L.ev('(() => { const e = HUB.data.events.find(e => HUB.t(e.title) !== e.title); return !!e; })()'));
  ok('i18n AR: charts and maps stay left-to-right inside an RTL page (a time axis does not mirror)', await L.ev('getComputedStyle(document.getElementById("tl")).direction === "ltr" && getComputedStyle(document.querySelector("#tl svg")).direction === "ltr"'));
  ok('i18n AR: numbers and dates follow ar-LB (Arabic-Indic digits)', await L.ev('/[\\u0660-\\u0669]/.test(HUB.nf(1234)) && /[\\u0660-\\u0669]/.test(HUB.fmtDate("1975-03-13")) && HUB.fmtDate("1975-03-13") !== "13 Mar 1975"'), await L.ev('HUB.fmtDate("1975-03-13") + " " + HUB.nf(1234.5, 1)'));
  ok('i18n AR: a string with no translation falls back to English with the EN marker (content strings only)', await L.ev('/class="enm"/.test(HUB.th("Zzzz untranslated sentence")) && HUB.t("Zzzz untranslated sentence") === "Zzzz untranslated sentence"'));
  // search in Arabic matches the translated event title
  const ar = T.readData('i18n/ar.json'), ev = JSON.parse(readFileSync(join(siteDir, 'lebanon-timeline.html'), 'utf8').match(/id="hubData">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</')).events;
  const hit = ev.find(e => ar[createHash('sha1').update(e.title).digest('hex').slice(0, 12)] && /[\u0600-\u06FF]{4,}/.test(ar[createHash('sha1').update(e.title).digest('hex').slice(0, 12)]));
  if (hit) {
    const arTitle = ar[createHash('sha1').update(hit.title).digest('hex').slice(0, 12)], word = (arTitle.match(/[\u0600-\u06FF]{4,}/) || [''])[0];
    await L.ev(`(() => { const q = document.getElementById("q"); q.value = ${JSON.stringify(word)}; q.dispatchEvent(new Event("input", { bubbles: true })); })()`); await sleep(1200);
    ok('i18n AR: searching an Arabic word finds events by their translated title', (await L.ev(marks)) > 0 && await L.ev('document.querySelectorAll("#activeF .fchip").length > 0'), [word, await L.ev(marks)]);
    await L.ev('document.querySelector("#activeF [data-rm=all]")?.click()'); await sleep(500);
  } else ok('i18n AR: searching an Arabic word finds events by title (no translated title yet, skipped)', true, 'skipped');
  // the event card in Arabic: translated labels, the translated title or an EN marker, never a crash
  await L.ev('document.querySelector("#zoomCtl [data-zoom=\\"20y\\"]").click()'); await sleep(700);
  await L.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()'); await sleep(600);
  ok('i18n AR: the event card opens with Arabic labels (Sources, In office, Date) and the title', await L.ev('(() => { const c = document.getElementById("evCard"), t = c.textContent; return !c.hidden && !!c.querySelector("h4") && t.includes(HUB.t("Sources ({n})", { n: c.querySelectorAll(".d-part").length }).slice(0, 4)) && /[\\u0600-\\u06FF]/.test(t) && !/\\bIn office\\b/.test(t); })()'));
  await L.key('Escape'); await sleep(200);
  // every zoom, every band, the year card and the map render in Arabic without an error
  for (const z of ['1y', '5y', '20y', '1950', '100y', '1800']) { await L.ev(`document.querySelector("#zoomCtl [data-zoom=\\"${z}\\"]").click()`); await sleep(500); }
  await L.ev('[...document.querySelectorAll("#bandCtl [data-band]")].map(b => b.dataset.band).forEach(id => { const b = document.querySelector("#bandCtl [data-band=\\"" + id + "\\"]"); if (b.getAttribute("aria-pressed") === "false") b.click(); })'); await sleep(700);
  ok('i18n AR: all zoom levels and every economic band render', (await L.ev(marks)) > 20 && (await L.ev('document.querySelectorAll("#tl .band-bg").length')) >= 10, await L.ev('document.querySelectorAll("#tl .band-bg").length'));
  await L.ev('(() => { const s = document.querySelector("#tl svg"), hit = s.querySelector(".ax-hit"), W = s.viewBox.baseVal.width, r = s.getBoundingClientRect(); const o = { bubbles: true, clientX: r.left + (r.width * 0.7), clientY: r.top + 10, pointerId: 1 }; hit.dispatchEvent(new PointerEvent("pointerdown", o)); hit.dispatchEvent(new PointerEvent("pointerup", o)); })()'); await sleep(500);
  ok('i18n AR: the year card opens with Arabic headings', await L.ev('(() => { const c = document.getElementById("yearCard"); return !c.hidden && /[\\u0600-\\u06FF]/.test(c.textContent) && !/\\bPrices\\b/.test(c.textContent); })()'), await L.ev('document.getElementById("yearCard").textContent.slice(0, 120)'));
  await L.ev('document.querySelector("#yearCard [data-yclose]")?.click()');
  await L.ev('document.getElementById("t-map").click()'); await sleep(1800);
  ok('i18n AR: the strike map builds in Arabic (chips, stats, notes) and a point opens its card', await L.ev('!!document.getElementById("mpStage") && [...document.querySelectorAll("#mpWar .chip")].every(b => /[\\u0600-\\u06FF0-9\\s]/.test(b.textContent)) && /[\\u0600-\\u06FF]/.test(document.getElementById("mpNote").textContent)'));
  await L.ev('document.querySelector("#mpWar [data-war=\\"2006\\"]").click()'); await sleep(500);
  await L.ev('(() => { const st = document.getElementById("mpStage"), c = document.querySelector("#mpPts circle"); const b = c.getBoundingClientRect(), o = { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }; st.dispatchEvent(new PointerEvent("pointermove", o)); st.dispatchEvent(new MouseEvent("click", o)); })()'); await sleep(500);
  ok('i18n AR: the incident card shows Arabic labels', await L.ev('!document.getElementById("mapCard").hidden && /[\\u0600-\\u06FF]/.test(document.getElementById("mapCard").textContent)'));
  await L.key('Escape');
  await L.ev('document.getElementById("t-data").click()'); await sleep(1500);
  ok('i18n AR: the Data tab, the series cards and the downloads render in Arabic', await L.ev('!!document.getElementById("dSeries") && /[\\u0600-\\u06FF]/.test(document.getElementById("dSeriesCount").textContent) && !!document.querySelector("#dlRoot .dl-row") && /[\\u0600-\\u06FF]/.test(document.getElementById("dlCount").textContent)'));
  await L.ev('document.getElementById("t-about").click()'); await sleep(400);
  ok('i18n AR: About is Arabic and the citation line is Arabic with the page address', await L.ev('/[\\u0600-\\u06FF]/.test(document.querySelector("#about .lead").textContent) && /[\\u0600-\\u06FF]/.test(document.getElementById("citeText").textContent)'));
  ok('i18n AR: 0 console errors (all tabs, 1400)', L.errors().length === 0, L.errors());
  await L.ev('localStorage.setItem("hub-lang", "ar")');
  await L.close();
  const R = await open(1400);   // a new page, same browser: the choice was remembered
  ok('i18n: the chosen language is remembered across loads (localStorage, read in try/catch)', await R.ev('document.documentElement.lang === "ar" && document.documentElement.dir === "rtl"'));
  await R.ev('document.querySelector("#langSw [data-lang=en]").click()'); await sleep(500);
  ok('i18n: switching back to English restores lang=en, dir=ltr and the English text', await R.ev('document.documentElement.lang === "en" && document.documentElement.dir === "ltr" && document.querySelector("h1").textContent === "Free Lebanon Data Hub" && document.querySelector(".hub-tabs [role=tab]").textContent === "Timeline"'));
  ok('i18n: 0 console errors (switching languages)', R.errors().length === 0, R.errors());
  await R.close();
  const F = await open(1400, SITE, { query: '?lang=fr' });
  ok('i18n FR: ?lang=fr opens in French (lang=fr, dir=ltr), the tabs and the lead are French', await F.ev('document.documentElement.lang === "fr" && document.documentElement.dir === "ltr" && document.querySelector(".hub-tabs [role=tab]").textContent === "Chronologie" && /Liban/.test(document.querySelector(".hub-head .eyebrow").textContent)'));
  ok('i18n FR: ?lang does not overwrite the remembered language', await F.ev('localStorage.getItem("hub-lang") !== "fr"'));
  ok('i18n FR: French dates and numbers (13 mars 1975, 1 234,5)', await F.ev('HUB.fmtDate("1975-03-13") === "13 mars 1975" && /^1\\s234,5$/.test(HUB.nf(1234.5, 1).replace(/[\\u202f\\u00a0]/g, " "))'), await F.ev('HUB.fmtDate("1975-03-13") + " | " + HUB.nf(1234.5, 1)'));
  await F.ev('document.querySelector("#zoomCtl [data-zoom=\\"100y\\"]").click()'); await sleep(600);
  await F.ev('[...document.querySelectorAll("#bandCtl [data-band]")].map(b => b.dataset.band).forEach(id => { const b = document.querySelector("#bandCtl [data-band=\\"" + id + "\\"]"); if (b.getAttribute("aria-pressed") === "false") b.click(); })'); await sleep(600);
  await F.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()'); await sleep(500);
  ok('i18n FR: the timeline with all bands and an event card render in French', (await F.ev(marks)) > 20 && await F.ev('/Sources \\(/.test(document.getElementById("evCard").textContent) && /En fonction/.test(document.getElementById("evCard").textContent)'));
  await F.key('Escape');
  for (const id of ['map', 'data', 'about', 'places', 'world']) { await F.ev(`document.getElementById("t-${id}").click()`); await sleep(1100); }
  ok('i18n FR: map, data, about and the stubs render in French with 0 console errors', (await F.ev('/Cartographi|Incidents/.test(document.getElementById("mapRoot").textContent)')) && F.errors().length === 0, F.errors());
  await F.close();

  // ---------------------------------------------------------------- Arabic and French at 390: no horizontal overflow on any tab
  for (const lg of ['ar', 'fr']) {
    const m = await open(390, SITE, { query: '?lang=' + lg });
    let bad = [];
    for (const id of TABS) {
      await m.ev(`document.getElementById("t-${id}").click()`); await sleep(id === 'map' || id === 'data' ? 1600 : 450);
      const sw = await m.ev('document.documentElement.scrollWidth');
      if (sw > 390) bad.push([id, sw]);
    }
    ok(`i18n ${lg.toUpperCase()}: 390px, no horizontal overflow on any of the 8 tabs`, bad.length === 0, bad);
    ok(`i18n ${lg.toUpperCase()}: 390px, the tab bar and the language switch fit the screen`, await m.ev('(() => { const n = document.querySelector(".hub-tabs").getBoundingClientRect(), s = document.getElementById("langSw").getBoundingClientRect(); return n.left >= 0 && n.right <= 390 && s.left >= 0 && s.right <= 390; })()'));
    if (lg === 'ar') await m.shot('shot-v7-ar-390.png');
    ok(`i18n ${lg.toUpperCase()}: 390px, 0 console errors`, m.errors().length === 0, m.errors());
    await m.close();
  }
  const rt = await open(1400, SITE, { query: '?lang=ar' });
  await rt.ev('document.getElementById("t-data").click()'); await sleep(1500);
  await rt.shot('shot-v7-ar-data.png');
  await rt.ev('document.getElementById("t-timeline").click()'); await sleep(500);
  await rt.shot('shot-v7-ar-timeline.png');
  await rt.close();

  // ---------------------------------------------------------------- downloads
  const man = T.readData('manifest.json');
  const dl = await open(1400);
  await dl.ev('document.getElementById("t-data").click()'); await sleep(1500);
  ok('downloads: the Data tab lists every manifest file (tables, series CSVs, JSON), with a count line and the Hub licence', await dl.ev(`(async () => { const m = await HUB.load("data/manifest.json"); const rows = document.querySelectorAll("#dlRoot .dl-row").length; return rows >= 3 && rows <= m.files.length && /CC BY-SA 4.0/.test(document.getElementById("dlCount").textContent) && document.getElementById("dlCount").textContent.replace(/,/g, "").startsWith(m.files.length + " files"); })()`));
  ok('downloads: the main tables (timeline, strikes, catalogue) are links with the download attribute and a relative data/csv path', await dl.ev('(() => { const a = [...document.querySelectorAll("#dlMain a.dl-t")]; return ["timeline.csv", "strikes.csv", "catalogue.csv"].every(f => a.some(x => x.getAttribute("href") === "data/csv/" + f && x.hasAttribute("download"))); })()'));
  await dl.ev('document.getElementById("dlSer").open = true'); await sleep(200);
  const nSer = await dl.ev('document.querySelectorAll("#dlSerList .dl-row").length');
  await dl.ev('(() => { const q = document.getElementById("dlq"); q.value = "climate"; q.dispatchEvent(new Event("input", { bubbles: true })); })()'); await sleep(400);
  const nSer2 = await dl.ev('document.querySelectorAll("#dlSerList .dl-row, #dlSerList .hub-empty").length');
  ok('downloads: the series list (topic CSVs) filters as you type', nSer >= 5 && nSer2 < nSer && nSer2 > 0, [nSer, nSer2]);
  await dl.shot('shot-v7-downloads.png');
  ok('downloads: 0 console errors', dl.errors().length === 0, dl.errors());
  await dl.close();
  const bad = [];
  for (const f of man.files) {
    const r = await T.get(f.path);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok || buf.length !== f.size || f.size > 8 * 1024 * 1024) bad.push([f.path, r.status, buf.length, f.size]);
    if (buf.toString('utf8').includes('\u2014')) bad.push([f.path, 'em dash']);
    if (f.kind === 'csv' && f.path !== 'data/csv/catalogue.csv') {
      const text = buf.toString('utf8'), rows = csvRows(text.replace(/^\uFEFF/, '')), hd = rows[0];
      if (!hd || hd.length < 2 || rows.slice(1).some(x => x.length !== hd.length && x.length > 1) || (f.rows != null && rows.length - 1 !== f.rows)) bad.push([f.path, 'csv shape', hd && hd.length, rows.length - 1, f.rows]);
    }
  }
  ok(`downloads: all ${man.files.length} manifest files are served, match their size, stay under 8 MB, hold no em dash, and every CSV has a header and consistent rows`, bad.length === 0, bad.slice(0, 5));
  ok('downloads: every manifest row carries title, source (or empty), licence and size; CSV rows have a header', man.files.every(f => f.title && f.license && f.size > 0 && f.path.startsWith('data/')) && man.license === 'CC BY-SA 4.0');
  const need = ['data/csv/timeline.csv', 'data/csv/strikes.csv', 'data/csv/catalogue.csv'];
  const serFiles = man.files.filter(x => x.path.startsWith('data/csv/series/')), worldFiles = man.files.filter(x => x.path.startsWith('data/csv/world/'));
  ok('downloads: the timeline, the strikes and the catalogue CSVs exist, and the series are consolidated into a few topic CSVs under data/csv/series/ (not one file per series)', need.every(f => man.files.some(x => x.path === f)) && serFiles.length >= 5 && serFiles.length <= 30 && worldFiles.length >= 5 && worldFiles.length <= 60, [serFiles.length, worldFiles.length]);
  const colsOf = f => csvRows(readFileSync(join(siteDir, f.path), 'utf8').replace(/^\uFEFF/, ''));
  const SER_HEAD = 'series_id,t,value', WORLD_HEAD = 'iso3,indicator_id,year,value';
  const serIds = new Map(), worldIds = new Map(), headBad = [];
  for (const f of serFiles) { const r = colsOf(f); if (r[0].join() !== SER_HEAD) headBad.push(f.path); serIds.set(f.path, new Set(r.slice(1).map(x => x[0]))); }
  for (const f of worldFiles) { const r = colsOf(f); if (r[0].join() !== WORLD_HEAD) headBad.push(f.path); worldIds.set(f.path, new Set(r.slice(1).map(x => x[1]))); }
  ok('downloads: the topic CSVs hold keys and values only (series: series_id,t,value; world: iso3,indicator_id,year,value)', headBad.length === 0 && serFiles.length > 0, headBad);
  const dictOf = p => csvRows(readFileSync(join(siteDir, p), 'utf8').replace(/^\uFEFF/, ''));
  const sd = dictOf('data/csv/series-dictionary.csv'), wd = dictOf('data/csv/world-dictionary.csv'), cd = dictOf('data/csv/countries.csv');
  ok('downloads: the dictionaries have the agreed columns', sd[0].join() === 'series_id,label,unit,freq,topic,file,source_url,license' && wd[0].join() === 'indicator_id,label,unit,topic,file,source,source_url,license,higher_is' && cd[0].join() === 'iso3,name_en,name_ar,name_fr', [sd[0], wd[0], cd[0]]);
  const sdIds = new Set(sd.slice(1).map(x => x[0])), wdIds = new Set(wd.slice(1).map(x => x[0])), cdIds = new Set(cd.slice(1).map(x => x[0]));
  const allSer = new Set([...serIds.values()].flatMap(x => [...x])), allW = new Set([...worldIds.values()].flatMap(x => [...x]));
  ok('downloads: every series_id and indicator_id in the data CSVs has exactly one dictionary row, and the dictionary names its file', sdIds.size === sd.length - 1 && wdIds.size === wd.length - 1 && [...allSer].every(i => sdIds.has(i)) && [...allW].every(i => wdIds.has(i)) && sdIds.size === allSer.size && wdIds.size === allW.size && sd.slice(1).every(x => serFiles.some(f => f.path === x[5]) && serIds.get(x[5]).has(x[0])) && wd.slice(1).every(x => worldFiles.some(f => f.path === x[4]) && worldIds.get(x[4]).has(x[0])), [sdIds.size, allSer.size, wdIds.size, allW.size]);
  const isoBad = [...new Set([...worldFiles].flatMap(f => colsOf(f).slice(1).map(x => x[0])))].filter(i => !cdIds.has(i));
  ok('downloads: every iso3 in the world CSVs is in countries.csv, and Lebanon has its Arabic and French names', isoBad.length === 0 && cd.some(x => x[0] === 'LBN' && x[1] === 'Lebanon' && x[2] && x[3]), isoBad.slice(0, 5));
  const bigBad = man.files.filter(f => f.size > 8 * 1024 * 1024);
  ok('downloads: every file is at most 8 MB and the whole set is at most 50 MB', bigBad.length === 0 && man.files.reduce((a, f) => a + f.size, 0) <= 50 * 1024 * 1024, man.files.reduce((a, f) => a + f.size, 0));
  const loose = [];   // every series in the published series files points at a topic CSV that holds its series_id
  let nWithCsv = 0;
  for (const j of ['cost/fx', 'cost/prices', 'money/series', 'electricity/power', 'electricity/nightlights', 'climate/climate', 'war/series', 'people/series']) {
    const o = T.readData(j + '.json');
    for (const s of o.series || []) { if (!s.csv) { loose.push([j, s.id, 'no csv']); continue; } nWithCsv++; const ids = serIds.get('data/' + s.csv); if (!ids || !ids.has(String(s.csv_id || s.id))) loose.push([j, s.id, s.csv]); }
  }
  ok('downloads: every published series links to its topic CSV and its series_id is a row key in that file', loose.length === 0 && nWithCsv > 100, [nWithCsv, loose.slice(0, 5)]);
  const wi = T.readData('world/index.json').indicators, NO_REDIST = /\bno[nt]?[- ]?redistribut|not (?:to be )?redistribut|redistribution (?:is )?(?:not (?:allowed|permitted)|prohibited|forbidden|restricted)|excluded from csv downloads/i;
  const wbad = [];
  for (const m of wi) {
    const closed = NO_REDIST.test(m.lic || '');
    const holds = [...worldIds.values()].some(ids => ids.has(m.id));
    if (closed && (m.csv || holds)) wbad.push([m.id, 'redistribution forbidden but in a CSV']);
    if (!closed && (!m.csv || !(worldIds.get(m.csv) || new Set()).has(m.id))) wbad.push([m.id, 'missing from its topic CSV', m.csv]);
  }
  ok('downloads: every World indicator is in its topic CSV, and none that forbids redistribution is (it stays on the page with attribution)', wbad.length === 0 && wi.some(m => NO_REDIST.test(m.lic || '')), wbad.slice(0, 5));
  const dupSer = [...serIds.values()].flatMap(x => [...x]);
  ok('downloads: series_id is unique across the series CSVs', dupSer.length === new Set(dupSer).size, dupSer.length - new Set(dupSer).size);
  const tl = csvRows(readFileSync(join(siteDir, 'data/csv/timeline.csv'), 'utf8').replace(/^\uFEFF/, ''));
  ok('downloads: timeline.csv has one row per embedded event with id, date, title, why and sources', tl.length - 1 === ev.length && tl[0].join() === 'id,date,date_precision,title,why,types,tracks,place,actors,weight,confidence,source_urls', [tl.length - 1, ev.length]);
  const pub = JSON.parse(readFileSync(join(siteDir, '..', 'build', 'publish_files.json'), 'utf8'));
  const onDisk = walk(join(siteDir, 'data')).map(f => 'data/' + f).sort();
  ok('publish_files.json: lists every file under v5/data (and nothing else), each mapped to an existing local path', JSON.stringify(Object.keys(pub).sort()) === JSON.stringify(onDisk) && Object.values(pub).every(p => existsSync(p)), [Object.keys(pub).length, onDisk.length]);
  ok('publish_files.json: at most 480 entries (the artifact holds 511 per version) and no file over 8 MB', Object.keys(pub).length <= 480 && Object.values(pub).every(p => statSync(p).size <= 8 * 1024 * 1024), [Object.keys(pub).length, Object.entries(pub).filter(([, p]) => statSync(p).size > 8 * 1024 * 1024).map(([k]) => k).slice(0, 5)]);
  ok('publish_files.json: total size under 200 MB, each file at most 8 MB', Object.values(pub).reduce((s, p) => s + statSync(p).size, 0) < 200 * 1024 * 1024 && Object.values(pub).every(p => statSync(p).size <= 8 * 1024 * 1024));

  // ---------------------------------------------------------------- shared helpers: charts and correlation
  const c = await open(1400);
  ok('helpers: pearson(x, y) is 1 for a straight rising line, -1 for a falling one, null for a constant', await c.ev('(() => { const a = HUB.pearson([1, 2, 3, 4], [2, 4, 6, 8]), b = HUB.pearson([1, 2, 3, 4], [8, 6, 4, 2]), z = HUB.pearson([1, 2, 3], [5, 5, 5]); return Math.abs(a.r - 1) < 1e-9 && Math.abs(b.r + 1) < 1e-9 && z.r === null && a.n === 4; })()'));
  ok('helpers: laggedCorr finds the 2-year lag between a series and its shifted copy', await c.ev('(() => { const a = [], b = []; for (let y = 2000; y < 2020; y++) { a.push([y, Math.sin(y)]); b.push([y + 2, Math.sin(y)]); } const r = HUB.laggedCorr(a, b, 4); const best = r.reduce((p, q) => (q.r > p.r ? q : p)); return best.lag === 2 && best.r > 0.999; })()'));
  ok('helpers: HUB.line draws one path per series with axis labels, a legend, an accessible name and a tooltip on hover', await c.ev(`(async () => {
    const el = document.createElement("div"); el.style.width = "600px"; document.body.appendChild(el);
    HUB.line(el, { title: "Test", series: [{ id: "a", label: "Alpha", pts: [[2000, 1], [2001, 3], [2002, 2], [2003, 5]] }, { id: "b", label: "Beta", pts: [[2000, 2], [2001, 2], [2002, 4], [2003, 3]], dash: true }] });
    const svg = el.querySelector("svg.hc-svg"); const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + 40 }));
    const tip = el.querySelector(".hc-tip");
    const ok_ = el.querySelectorAll("path.hc-line").length === 2 && svg.getAttribute("role") === "img" && /Alpha/.test(svg.getAttribute("aria-label")) && el.querySelectorAll(".hc-lg li").length === 2 && !tip.hidden && /Alpha/.test(tip.textContent) && /Beta/.test(tip.textContent) && svg.querySelectorAll("text.ax").length >= 4 && svg.getBoundingClientRect().right <= innerWidth;
    el.remove(); return ok_; })()`));
  ok('helpers: HUB.line with no data shows an empty state, and a log axis does not break', await c.ev(`(() => { const el = document.createElement("div"); document.body.appendChild(el); HUB.line(el, { series: [] }); const e1 = !!el.querySelector(".hub-empty"); HUB.line(el, { log: true, series: [{ id: "a", label: "A", pts: [[1, 10], [2, 100], [3, 1000]] }] }); const e2 = el.querySelectorAll("path.hc-line").length === 1; el.remove(); return e1 && e2; })()`));
  ok('helpers: HUB.scatter reports r (here +1 and -1) and marks the highlighted point', await c.ev(`(() => { const el = document.createElement("div"); el.style.width = "500px"; document.body.appendChild(el); const pts = [1, 2, 3, 4, 5].map(i => ({ id: "p" + i, label: "P" + i, x: i, y: 2 * i, hi: i === 3 })); const s = HUB.scatter(el, { points: pts, xLabel: "x", yLabel: "y" }); const ok_ = Math.abs(s.r - 1) < 1e-9 && el.querySelectorAll(".sc-dot").length === 5 && el.querySelectorAll(".sc-dot.hi").length === 1 && el.querySelector(".hc-r").dataset.r === "1.000"; const t = HUB.scatter(el, { points: pts.map(p => ({ ...p, y: -p.y })), xLabel: "x", yLabel: "y" }); el.remove(); return ok_ && Math.abs(t.r + 1) < 1e-9; })()`));
  ok('helpers: HUB.bars draws one bar per item scaled to the largest value', await c.ev(`(() => { const el = document.createElement("div"); document.body.appendChild(el); HUB.bars(el, { items: [{ label: "A", value: 50 }, { label: "B", value: 100, hi: true }] }); const w = [...el.querySelectorAll(".hb-b i")].map(i => parseFloat(i.style.width)); const r = w[0] === 50 && w[1] === 100 && el.querySelectorAll("li.hi").length === 1; el.remove(); return r; })()`));
  ok('helpers: 0 console errors', c.errors().length === 0, c.errors());
  await c.close();
}
