// v8 checks, Places: registered voters 2014 with source ("registered voters, not residents"), resident estimates only by district with source and kind (none per place), Arabic names from P-arabic-names, the 1932 census note.
export default async function (T) {
  const { ok, sleep, open, SITE, readData } = T;
  const idx = readData('places/index.json'), rows = idx.rows;
  ok('v8 places: more than 3,600 places have an Arabic name (720 added from GeoNames, lub-anan.com and Wikidata)', rows.filter(r => r[2]).length > 3600);
  ok('v8 places: the Arabic name of a place that had none is in the index (El Borj, Akkar)', (rows.find(r => r[0] === 'LBX-377b85dd') || [])[2] === 'البرج');
  const sh = readData('places/p/LB63.json'), sour = sh.LBN63110 || {};
  ok('v8 places: Sour has registered voters 2014 (women and men), the lub-anan source link and a 2022 scaled estimate', !!sour.rv && sour.rv[0] === 29410 && /lub-anan/.test(sour.rvu) && !!sour.rv22);
  ok('v8 places: no place has a resident estimate of its own (the research removed the per-place model)', Object.keys(readData('places/p/LB63.json')).every(k => !('re' in sh[k]) && !('ren' in sh[k])) && Object.keys(readData('places/p/LB32.json')).every(k => { const d = readData('places/p/LB32.json')[k]; return !('re' in d); }));
  const csv = await (await T.get('data/csv/places.csv')).text();
  ok('v8 places: places.csv has the voter columns and no resident-estimate column', /registered_voters_2014/.test(csv.split('\n')[0]) && !/resident_estimate/.test(csv.split('\n')[0]));
  const cz = readData('places/cazas.json').cazas, est = (cz.LB63 || {}).est || {};
  ok('v8 places: each of the 26 districts carries resident estimates by source and registered voters by year (Sour: CAS 2018-19, OCHA 2025 and 2026, Kontur, voters 2014 to 2025)', Object.values(cz).filter(c => c.est && c.est.cas).length === 26 && est.cas === 255700 && est.rv14 === 174743 && est.rv25 === 214968 && !!est.lrp26 && !!est.kon);
  ok('v8 places: Marjaayoun has its OCHA totals withheld (the research calls them unreliable)', !!cz.LB43.est.lrp_bad && !cz.LB43.est.lrp26);

  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 places ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#place/LBN63110' });
    ok(`${tag}: the place page opens`, await p.wait('!document.getElementById("places").hidden && !!document.querySelector("#plPageH") && !document.querySelector("#placesRoot .hub-load")', 25000));
    ok(`${tag}: the population table has registered voters with a source and a kind, and no per-place resident estimate`, await p.ev('(() => { const t = [...document.querySelectorAll("#placesRoot .fb-tbl")].find(x => x.querySelectorAll("th[scope=col]").length === 4); if (!t) return false; const r = [...t.querySelectorAll("tbody tr")]; return r.length >= 2 && r.every(x => x.children.length === 4 && x.children[3].textContent.trim().length > 3 && x.children[2].textContent.trim().length > 1) && !/(Resident estimate|Estimation des résidents|تقدير عدد السكان)/.test(t.textContent); })()'));
    ok(`${tag}: a second table gives the district's resident estimates by source and year, each with a source and a kind, and the voters by year`, await p.ev('(() => { const h = document.getElementById("plEstH"); const t = h && h.nextElementSibling && h.nextElementSibling.nextElementSibling; if (!t) return false; const r = [...t.querySelectorAll("tbody tr")]; return r.length >= 8 && r.every(x => x.children.length === 4 && x.children[2].textContent.trim().length > 2 && x.children[3].textContent.trim().length > 3); })()'));
    ok(`${tag}: the 1932 census note is above the table`, await p.ev('/(1932|١٩٣٢)/.test(document.querySelector("#placesRoot h4.pl-s + p.note")?.textContent || "")'));
    if (lang === 'en') {
      ok(`${tag}: the voters row says registered voters, not residents; the district block says there is no estimate for single places and none is a census count`, await p.ev('(() => { const x = document.querySelector("#placesRoot").textContent; return /registered voters, not residents/.test(x) && /no resident estimate for single places/.test(x) && /none is a census count/.test(x) && !/modelled allocation/.test(x); })()'));
    } else ok(`${tag}: no English left in the population blocks`, await p.ev('(() => { const h = [document.querySelector("#placesRoot h4.pl-s"), document.getElementById("plEstH")]; const t = h.map(x => x.nextElementSibling.textContent + (x.nextElementSibling.nextElementSibling || {}).textContent).join(" "); return !/Registered voters|Residents|registered voters, not residents|Interior Ministry|survey estimate|planning estimate|CAS, ILO/.test(t); })()'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#place/LBX-377b85dd' });
  ok('v8 places ar: the Arabic name added from P-arabic-names is the page title and the source is credited', await a.wait('!!document.querySelector("#plPageH")', 20000) && await a.ev('document.querySelector("#plPageH").textContent.trim() === "البرج" && /lub-anan/.test(document.querySelector(".pl-src").textContent)'));
  await a.close();
  // a place whose voter list overlaps nothing (no "do not add up" note): the transcribed-list link must be a link, not escaped text
  for (const [w, q] of [[390, ''], [390, '?lang=ar'], [1400, '?lang=fr']]) {
    const k = await open(w, SITE, { query: q, hash: '#place/LBN43020' });
    ok(`v8 places ${q || 'en'} ${w}: Khiam shows its voter list as a link, no escaped HTML and no overflow`, await k.wait('!!document.querySelector("#plPageH")', 25000) && await k.ev('!/&lt;|<a href/.test(document.getElementById("placesRoot").textContent) && !!document.querySelector("#placesRoot p.note a[href*=lub-anan]")') && (await k.ev('document.documentElement.scrollWidth')) <= w);
    ok(`v8 places ${q || 'en'} ${w}: 0 console errors on Khiam`, k.errors().length === 0, k.errors());
    await k.close();
  }
}
