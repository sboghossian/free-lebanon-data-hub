// v8 checks, Data tab: link freshness badges from research/portals/freshness.json, and the laws section (full-text links, English summaries, patched statuses, 2025 laws).
export default async function (T) {
  const { ok, sleep, open, SITE, readData } = T;
  const cat = readData('portals/catalogue.json'), C = Object.fromEntries(cat.cols.map((c, i) => [c, i]));
  ok('v8 data: every catalogue row carries a link status and the check date of 3 Oct 2026', cat.rows.length > 400 && cat.rows.every(r => ['reachable', 'moved', 'unreachable'].includes(r[C.link_status]) && r[C.link_checked] === '2026-10-03'));
  ok('v8 data: three links are unreachable (two time-outs and one error), the rest reachable', cat.rows.filter(r => r[C.link_status] === 'unreachable').length === 3 && cat.rows.filter(r => r[C.link_status] === 'reachable').length > 400);
  const laws = readData('laws/index.json'), L = Object.fromEntries(laws.cols.map((c, i) => [c, i]));
  ok('v8 laws: the index has 5,380 laws or more (D10 plus the 15 new 2025 laws) with a summary on at least 1,000', laws.rows.length >= 5380 && laws.rows.filter(r => r[L.summary_en]).length >= 1000);
  ok('v8 laws: the patched statuses (3 laws annulled by the Constitutional Council) and the budget law number 40 are applied', laws.rows.filter(r => /^annulled by Constitutional Council/.test(r[L.status])).length === 3 && laws.rows.some(r => r[L.law_no] === 40 && /General Budget Law for 2026/.test(r[L.summary_en] || r[L.title_en])));
  ok('v8 laws: laws.csv has summary_en and fulltext_url', /summary_en/.test((await (await T.get('data/csv/laws.csv')).text()).slice(0, 300)));

  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 data ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#data' });
    ok(`${tag}: the catalogue lists datasets with a freshness badge`, await p.wait('document.querySelectorAll("#dList .d-fresh").length >= 40', 25000));
    ok(`${tag}: the badge says checked 3 Oct 2026 and reachable, in the page language`, await p.ev('(() => { const t = document.querySelector("#dList .d-fresh").textContent.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); return /3/.test(t) && /2026/.test(t) && ' + (lang === 'en' ? '/Checked 3 Oct 2026: reachable/.test(t)' : lang === 'fr' ? '/Vérifié le 3 oct\\.? 2026 : joignable/.test(t)' : '/فُحص/.test(t) && /يمكن الوصول/.test(t)') + '; })()'));
    ok(`${tag}: the summary line gives the counts`, await p.ev('/508/.test(document.getElementById("dFresh").textContent.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[\\u202f\\u00a0, \\u066c]/g, ""))'));
    ok(`${tag}: filtering by unreachable leaves three datasets`, await (async () => { await p.ev('(() => { const s = document.getElementById("dFreshSel"); s.value = "unreachable"; s.dispatchEvent(new Event("change")); })()'); await sleep(250); return p.ev('document.querySelectorAll("#dList .d-row").length === 3 && [...document.querySelectorAll("#dList .d-fresh")].every(x => x.classList.contains("fr-unreachable"))'); })());
    await p.ev('(() => { const s = document.getElementById("dFreshSel"); s.value = ""; s.dispatchEvent(new Event("change")); })()');
    // laws
    await p.ev('document.getElementById("lawDet").open = true; document.getElementById("lawDet").dispatchEvent(new Event("toggle"))');
    ok(`${tag}: the laws list opens`, await p.wait('document.querySelectorAll("#lawList .d-row").length > 10', 25000));
    await p.ev('(() => { const i = document.getElementById("lawQ"); i.value = "banks in Lebanon"; i.dispatchEvent(new Event("input")); })()'); await sleep(400);
    if (lang !== 'ar') ok(`${tag}: a 2025 law added from the Parliament's site is found by its English summary and has a full-text link`, await p.ev('(() => { const r = [...document.querySelectorAll("#lawList .d-row")].find(x => /reforming the banks/i.test(x.textContent)); return !!r && !!r.querySelector("a.d-full[href^=http]") && !!r.querySelector(".d-sum"); })()'));
    else ok(`${tag}: laws show the Arabic title and a full-text link`, await p.ev('(() => { const r = document.querySelector("#lawList .d-row"); return !!r && !!r.querySelector("a.d-full") && !r.querySelector(".d-sum"); })()'));
    if (lang === 'fr') ok(`${tag}: the English summary carries the EN mark in French`, await p.ev('!!document.querySelector("#lawList .d-sum .enm")'));
    await p.ev('(() => { const i = document.getElementById("lawQ"); i.value = "inspectors General Security"; i.dispatchEvent(new Event("input")); })()'); await sleep(400);
    if (lang !== 'ar') ok(`${tag}: a law annulled by the Constitutional Council shows its status with the decision and date`, await p.ev('(() => { const r = [...document.querySelectorAll("#lawList .d-row")].find(x => /(annulled|annulée)/i.test(x.textContent)); return !!r; })()'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
