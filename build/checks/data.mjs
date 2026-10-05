// v10 checks, Data tab ("centralize"): the one home of every dataset. Topic filter (#data/<topic>), every series with span, source, licence, sparkline and
// download, every manifest file sorted into a topic, the one search box across datasets, series, files, places, laws, events, companies and aid organisations,
// the "Data behind this tab" link in every topic tab (and no series table or download list left in them), downloads through the viewer, empty and error states, 390 px, Arabic and French.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const TOPICS = ['timeline', 'map', 'places', 'cost', 'electricity', 'trade', 'world', 'mideast', 'companies', 'aid'];
  const man = readData('manifest.json'), si = readData('series/index.json'), C = Object.fromEntries(si.cols.map((c, i) => [c, i]));
  const D0 = JSON.parse((await (await T.get('lebanon-timeline.html')).text()).match(/<script type="application\/json" id="hubData">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
  const inl = D0.tabs.data, rules = inl.rules.map(([p, tp]) => [new RegExp(p), tp]), topicOf = p => (rules.find(r => r[0].test(p)) || [0, ''])[1];
  const files = man.files.map(f => f.path), byTopic = tp => files.filter(p => topicOf(p) === tp);

  // ---- data: the series index, the topic rules and the search shards
  ok('data v10: series/index.json lists at least 1,200 series, each with a label, a topic, a span, a licence column and a download that is in the manifest', si.rows.length >= 1200 && si.rows.every(r => r[C.label] && (r[C.topic] === '' || TOPICS.includes(r[C.topic])) && (!r[C.file] || files.includes(r[C.file]))), si.rows.filter(r => r[C.file] && !files.includes(r[C.file])).slice(0, 3));
  ok('data v10: every series that a tab publishes as a topic CSV is in the index (series-dictionary.csv ids)', await (async () => { const d = (await (await T.get('data/csv/series-dictionary.csv')).text()).replace(/^\uFEFF/, '').split('\n').slice(1).filter(Boolean).map(l => l.split(',')[0]); const ids = new Set(si.rows.map(r => r[C.csv_id])); return d.length > 1000 && d.every(i => ids.has(i)); })());
  ok('data v10: the World (76) and Middle East (75) indicators are in the index with Lebanon\'s line', si.rows.filter(r => r[C.topic] === 'world').length >= 70 && si.rows.filter(r => r[C.topic] === 'mideast').length >= 70 && si.rows.filter(r => /lbn/.test(r[C.flags])).every(r => r[C.spark].length > 0 || r[C.n] === 0));
  ok('data v10: every series key is unique and sparklines hold at most 48 points', new Set(si.rows.map(r => r[C.key])).size === si.rows.length && si.rows.every(r => r[C.spark].length <= 96 && r[C.spark].length % 2 === 0));
  ok('data v10: each of the 9 topics has published files', TOPICS.every(tp => byTopic(tp).length > 0), TOPICS.map(tp => tp + ':' + byTopic(tp).length).join(' '));
  ok('data v10: only the Hub-wide files have no topic (catalogue, laws, portals, dictionaries, translations, search, manifest)', files.filter(p => !topicOf(p)).every(p => /^data\/(csv\/(catalogue|laws|series-dictionary)\.csv|csv\/series\/open-data-portals|portals\/|laws\/|i18n\/|search\/|series\/|manifest)/.test(p)), files.filter(p => !topicOf(p)));
  const shards = Object.keys(inl.search || {});
  ok('data v10: the search index is sharded under data/search/ (catalogue, places, laws, events, orgs), each file under 8 MB, under the 400-file limit', ['catalogue', 'places', 'laws', 'events', 'orgs'].every(k => shards.includes(k) && files.includes(`data/search/${k}.json`)) && man.files.filter(f => /^data\/search\//.test(f.path)).every(f => f.size <= 8 * 1024 * 1024) && files.length + 1 < 400, files.length);
  const sp = readData('search/places.json'), sl = readData('search/laws.json'), se = readData('search/events.json');
  ok('data v10: the shards cover every place, law and timeline event', sp.rows.length === readData('places/index.json').rows.length && sl.rows.length === readData('laws/index.json').rows.length && se.rows.length === D0.events.length);
  ok('data v10: Arabic in the index is normalised (no vowel marks, one alef, ya for alef maqsura, ha for ta marbuta)', se.rows.every(r => !/[\u064b-\u0652\u0623\u0625\u0622\u0649\u0629\u0640]/.test(r[5])) && sp.rows.some(r => /beyrouth/.test(r[5])));

  // ---- 1400 px, English: All, then a topic, then each "Data behind this tab" link
  const p = await open(1400, SITE, { hash: '#data' });
  ok(`data v10: the tab opens with one search box, ${TOPICS.length + 1} topic chips (All and the ${TOPICS.length} tabs) and All pressed`, await p.wait(`document.querySelectorAll("#dxNav [data-tp]").length === ${TOPICS.length + 1} && !!document.getElementById("dxQ")`, 15000) && await p.ev('document.querySelector("#dxNav [data-tp=\\"\\"]").getAttribute("aria-pressed") === "true"'));
  ok('data v10: All lists every series (30 at a time, each with a sparkline, source, licence and a download)', await p.wait('document.querySelectorAll("#dxSerL .dx-sr").length === 30', 20000) && await p.ev(`/of ${si.rows.length.toLocaleString('en-US')} series/.test(document.getElementById("dxSerN").textContent) && [...document.querySelectorAll("#dxSerL .dx-sr")].every(r => !!r.querySelector("svg.sp, .dx-nosp") && /Licence/.test(r.textContent) && !!r.querySelector("a[download]"))`));
  ok('data v10: All keeps the catalogue, the laws and the full downloads list', await p.wait('document.querySelectorAll("#dList .d-row").length > 10 && document.querySelectorAll("#dlRoot .dl-row").length > 10', 20000) && await p.ev('!document.getElementById("dxAll").hidden && !!document.getElementById("lawDet")'));
  await p.ev('(() => { const i = document.getElementById("dxSq"); i.value = "bread"; i.dispatchEvent(new Event("input")); })()'); await sleep(400);
  ok('data v10: the series filter narrows the list (bread)', await p.ev('(() => { const r = [...document.querySelectorAll("#dxSerL .dx-sr")]; return r.length > 0 && r.length < 30 && r.every(x => /bread/i.test(x.textContent)); })()'));
  await p.ev('(() => { const i = document.getElementById("dxSq"); i.value = ""; i.dispatchEvent(new Event("input")); })()'); await sleep(300);
  await p.ev('document.querySelector("#dxNav [data-tp=cost]").click()'); await sleep(500);
  const nCost = si.rows.filter(r => r[C.topic] === 'cost').length;
  ok('data v10: the Cost chip sets #data/cost, hides the All sections, and lists only cost series and cost files', await p.ev(`location.hash === "#data/cost" && document.getElementById("dxAll").hidden && !document.getElementById("dxFilesSec").hidden && /of ${nCost.toLocaleString('en-US')} series/.test(document.getElementById("dxSerN").textContent) && document.querySelectorAll("#dxFileL .dl-row").length === ${byTopic('cost').length}`));
  ok('data v10: the topic heading names the tab and links back to it', await p.ev('/Data behind the Cost of living tab/.test(document.getElementById("dxHead").textContent) && document.getElementById("dxBack").getAttribute("href") === "#cost"'));
  ok('data v10: 0 console errors (All and a topic)', p.errors().length === 0, p.errors());
  // each topic tab: one link to its Data view, and no series table or download list left in the tab
  const TABS = [['cost', '#costRoot'], ['trade', '#trade'], ['electricity', '#electricityRoot'], ['world', '#worldRoot'], ['places', '#placesRoot'], ['companies', '#companiesRoot'], ['aid', '#aid'], ['mideast', '#mideast']];
  for (const [tab, sel] of TABS) {
    await p.ev(`location.hash = "#${tab}"`);
    const there = await p.wait(`!!document.querySelector(${JSON.stringify(sel + ' a[href="#data/' + tab + '"]')})`, 25000);
    ok(`data v10: ${tab} has one "Data behind this tab" link to #data/${tab}, and no series table, "All series" view or download link`, there && await p.ev(`document.querySelectorAll("#${tab} a[href=\\"#data/${tab}\\"]").length === 1 && !document.querySelector("#${tab} #costAll, #${tab} #elAll, #${tab} #peoAll, #${tab} #warAll, #${tab} [data-id=all], #${tab} .wd-src a[download]") && !/All series in this section|Every series/.test(document.getElementById("${tab}").textContent)`));
    await p.ev(`document.querySelector("#${tab} a[href=\\"#data/${tab}\\"]").click()`); await sleep(700);
    ok(`data v10: the ${tab} link opens the Data tab filtered to ${tab}`, await p.wait(`HUB.current === "data" && location.hash === "#data/${tab}" && document.querySelector("#dxNav [data-tp=${tab}]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#dxFileL .dl-row").length === ${byTopic(tab).length}`, 8000));
  }
  ok('data v10: Places has no election Downloads line and no "All series in this section" in People or War', await (async () => { await p.ev('location.hash = "#elections"'); await p.wait('!!document.getElementById("eleTrend")', 15000); const a = await p.ev('!document.querySelector("#places a[href*=\\"elections-\\"][download]")'); await p.ev('location.hash = "#people"'); await sleep(2500); const b = await p.ev('!document.getElementById("peoAll")'); await p.ev('location.hash = "#war"'); await sleep(2500); return a && b && await p.ev('!document.getElementById("warAll")'); })());
  ok('data v10: 0 console errors (every topic tab and its link)', p.errors().length === 0, p.errors());
  await p.close();

  // ---- search
  const s = await open(1400, SITE, { hash: '#data' });
  await s.wait('!!document.getElementById("dxQ")', 15000);
  const q = async v => { await s.ev(`(() => { const i = document.getElementById("dxQ"); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input")); })()`); return s.wait(`document.getElementById("dxRes").dataset.q === ${JSON.stringify(v)} && !document.querySelector("#dxRes .hub-load")`, 25000); };
  const hit = (kind, re) => s.ev(`[...document.querySelectorAll("#dxRes [data-kind=${kind}] .dx-r a")].some(a => ${re}.test(a.textContent + " " + a.getAttribute("href")))`);
  await q('baalbek');
  ok('search: "baalbek" finds the town (links to #place/LBN21010) and the address keeps the query', await hit('places', '/#place\\/LBN21010/') && await s.ev('location.hash === "#data/search/baalbek"'));
  await q('بَعْلَبَكّ');
  ok('search: the Arabic name with vowel marks finds the same town', await hit('places', '/#place\\/LBN21010/'));
  await q('Beyrouth');
  ok('search: the French name finds Beirut', await hit('places', '/#place\\/LBN11009/'));
  await q('81/2018');
  ok('search: a law number (81/2018) finds the law', await hit('laws', '/81%2F2018/'));
  await s.ev('document.querySelector("#dxRes [data-kind=laws] .dx-r a").click()');
  ok('search: the law result opens the laws section, filtered to it', await s.wait('document.getElementById("lawDet").open && document.getElementById("lawQ") && document.getElementById("lawQ").value === "81/2018" && document.querySelectorAll("#lawList .d-row").length >= 1', 25000));
  await q('bread');
  ok('search: "bread" finds series, and a series result opens its row in the Data tab', await hit('series', '/bread/i') && await (async () => { await s.ev('document.querySelector("#dxRes [data-kind=series] .dx-r a").click()'); return s.wait('/^#data\\/series\\//.test(location.hash) && document.querySelectorAll("#dxSerL .dx-sr").length === 1 && !!document.querySelector("#dxSerL .dx-focus") && !document.getElementById("dxSerAll").hidden', 8000); })());
  await q('laws csv');
  ok('search: files are found by name and link to the download', await hit('files', '/data\\/csv\\/laws\\.csv/'));
  await q('UNHCR');
  ok('search: aid organisations are found and link to the Aid tab', await hit('orgs', '/#aid\\//'));
  await q('Bashir Jirji Baz');
  ok('search: timeline event titles are found', await hit('events', '/Jirji Baz/'));
  await s.ev('document.querySelector("#dxRes [data-kind=events] .dx-r a").click()');
  ok('search: an event result opens the Timeline and the event card', await s.wait('HUB.current === "timeline" && !document.getElementById("evCard").hidden', 8000));
  await s.ev('location.hash = "#data"'); await sleep(600);
  await q('Anghami');
  ok('search: a company result opens the Companies tab with the name in its search box', await (async () => { await s.ev('document.querySelector("#dxRes [data-kind=orgs] a[data-cq]").click()'); return s.wait('HUB.current === "companies" && document.getElementById("cmpQ") && document.getElementById("cmpQ").value === "Anghami"', 15000); })());
  await s.ev('location.hash = "#data"'); await sleep(600);
  await q('zzqxv nothing');
  ok('search: no match says so', await s.ev('!!document.getElementById("dxNone")'));
  ok('search: the catalogue is searched too (electricity)', await q('electricity') && await hit('catalogue', '/^/'));
  ok('downloads: with the viewer, a series download link goes through downloads.save', await s.ev(`(async () => {
    window.__saved = null; const had = window.claude;
    window.claude = { use: async n => n === 'downloads' ? { save: async r => { window.__saved = { f: r.filename, n: r.data.size || r.data.length }; return { status: 'saved' }; } } : null };
    document.querySelector("#dxSerL a[download]").click();
    for (let i = 0; i < 60 && !window.__saved; i++) await new Promise(r => setTimeout(r, 50));
    window.claude = had; return !!window.__saved && /\\.(csv|json)$/.test(window.__saved.f) && window.__saved.n > 100; })()`));
  ok('search: 0 console errors', s.errors().length === 0, s.errors());
  await s.close();

  // ---- 390 px and the other languages
  for (const [w, lang] of [[390, 'en'], [1400, 'ar'], [390, 'ar'], [1400, 'fr']]) {
    const tag = `data v10 ${lang} ${w}`, m = await open(w, SITE, { query: lang === 'en' ? '' : '?lang=' + lang, hash: '#data/places' });
    ok(`${tag}: #data/places opens filtered, with series rows and files`, await m.wait('document.querySelectorAll("#dxSerL .dx-sr").length > 5 && document.querySelectorAll("#dxFileL .dl-row").length > 5', 25000));
    if (lang === 'ar') ok(`${tag}: right to left, the chips and the topic heading are Arabic`, await m.ev('document.documentElement.dir === "rtl" && /[\\u0600-\\u06FF]/.test(document.getElementById("dxNav").textContent) && /[\\u0600-\\u06FF]/.test(document.getElementById("dxHead").textContent) && !/[A-Za-z]{4}/.test(document.getElementById("dxNav").textContent)'));
    if (lang === 'fr') ok(`${tag}: the chips and the heading are French`, await m.ev('/Lieux/.test(document.getElementById("dxNav").textContent) && /Données derrière l\'onglet/.test(document.getElementById("dxHead").textContent)'));
    await m.ev(`(() => { const i = document.getElementById("dxQ"); i.value = ${JSON.stringify(lang === 'ar' ? 'بعلبك' : 'Baalbek')}; i.dispatchEvent(new Event("input")); })()`);
    ok(`${tag}: the search finds Baalbek`, await m.wait('[...document.querySelectorAll("#dxRes [data-kind=places] a")].some(a => /LBN21010/.test(a.getAttribute("href")))', 25000));
    ok(`${tag}: no horizontal overflow`, (await m.ev('document.documentElement.scrollWidth')) <= w, await m.ev('document.documentElement.scrollWidth'));
    ok(`${tag}: 0 console errors`, m.errors().length === 0, m.errors());
    await m.close();
  }

  // ---- empty and error states
  const fm = fixture('dx-missing', null, { 'series/index.json': null, 'search/places.json': null });
  const e = await open(1400, fm, { hash: '#data', allow: /series\/index|search\/places|404|Failed to load/ });
  ok('data v10: a missing series index shows the error state with Retry, and the catalogue still loads', await e.wait('!!document.querySelector("#dxSer .hub-err [data-retry]") && document.querySelectorAll("#dList .d-row").length > 10', 25000));
  await e.ev('(() => { const i = document.getElementById("dxQ"); i.value = "beirut"; i.dispatchEvent(new Event("input")); })()');
  ok('data v10: a missing search shard shows the error state with Retry in the results', await e.wait('!!document.querySelector("#dxRes .hub-err [data-retry]")', 25000));
  await e.close();
  const fz = fixture('dx-empty', D => { D.tabs.data.search = {}; }, { 'series/index.json': JSON.stringify({ cols: si.cols, rows: [] }) });
  const z = await open(1400, fz, { hash: '#data/cost' });
  ok('data v10: with no series in the build the list says so, and the files of the topic still show', await z.wait('!!document.querySelector("#dxSerL .hub-empty") && document.querySelectorAll("#dxFileL .dl-row").length > 0', 25000));
  await z.ev('(() => { const i = document.getElementById("dxQ"); i.value = "laws csv"; i.dispatchEvent(new Event("input")); })()');
  ok('data v10: with no search shards the box still searches the files', await z.wait('!!document.querySelector("#dxRes [data-kind=files] a")', 15000));
  ok('data v10: 0 console errors (empty and error fixtures)', z.errors().length === 0, z.errors());
  await z.close();
}
