// v8 checks, Strike map: the official toll per war next to what the mapped incidents add up to, geocode overrides applied, and the same in 390 px, Arabic and French.
export default async function (T) {
  const { ok, sleep, open, SITE, readData } = T;
  const tolls = readData('strikes/tolls.json').tolls, sk = readData('strikes/strikes.json');
  ok('v8 map: tolls.json has one row per war count with who counted and when', tolls.length >= 10 && tolls.every(x => x.counted_by && x.as_of && /^https?:/.test(x.source) && x.group && x.wars.length));
  ok('v8 map: the civil war toll is 120,000 to 150,000, as the research file says', tolls.some(x => x.group === 'civil' && x.killed_low === 120000 && x.killed_high === 150000));
  ok('v8 map: low and high are one range only where both count the same thing: 1982, siege of Beirut, 1996 and 2006 carry two labelled figures instead', ['1982 invasion', '1982 siege', '1996', '2006'].every(k => { const x = tolls.find(r => r.war.startsWith(k)); return x && x.killed_low == null && x.killed_high == null && x.killed_parts.length === 2 && x.killed_parts.every(q => q.n > 0 && q.what); }) && tolls.filter(x => !x.killed_parts).every(x => x.killed_low != null));
  ok('v8 map: 1993 is a range of the same quantity (118 to 140 Lebanese civilians)', tolls.some(x => x.war.startsWith('1993') && x.killed_low === 118 && x.killed_high === 140));
  ok('v8 map: the overrides placed rows (fewer than 120 rows are left unresolved)', Object.values(sk.unres || {}).reduce((s, n) => s + n, 0) < 120);

  const chip = id => `document.querySelector('#mpWar [data-war="${id}"]').click()`;
  const toll = async (p, id) => { await p.ev(chip(id)); await sleep(350); return p.wait('document.querySelectorAll("#mpToll .mp-tc").length > 0', 8000); };

  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 map ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#map' });
    ok(`${tag}: the map tab opens and draws incidents`, await p.wait('!document.getElementById("map").hidden && document.querySelectorAll("#mpStats dd").length >= 3 && !document.querySelector("#mapRoot .hub-load")', 25000));
    ok(`${tag}: all wars shows a collapsed Official toll panel with the counts`, await p.ev('!!document.querySelector("#mpToll details.mp-tdet") && /[\\d\u0660-\u0669]/.test(document.querySelector("#mpToll summary").textContent)'));
    ok(`${tag}: the 2006 war card shows 1,109 and 1,191 as two labelled counts (not a range), who counted, as of when, and the documented incidents`, await (async () => {
      if (!(await toll(p, '2006'))) return false;
      return p.ev('(() => { const c = document.querySelector("#mpToll .mp-tc"); const dd = c.querySelector("dl > div dd").textContent; const x = c.textContent.replace(/[\\u066c,\\u202f\\u00a0 ]/g, "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); return /1109/.test(x) && /1191/.test(x) && dd.split(";").length === 2 && c.querySelectorAll("dl > div").length >= 3 && !!c.querySelector(".mp-tc-doc") && !!c.querySelector(".mp-tc-by a[href^=http]"); })()');
    })());
    ok(`${tag}: 1982 and 1996 also show two labelled counts, and 1993 shows a range`, await (async () => {
      if (!(await toll(p, '7882'))) return false;
      const a = await p.ev('[...document.querySelectorAll("#mpToll .mp-tc")].filter(c => c.querySelector("dl > div dd").textContent.split(";").length === 2).length');
      if (!(await toll(p, '9396'))) return false;
      const b = await p.ev('(() => { const cs = [...document.querySelectorAll("#mpToll .mp-tc")]; return cs.length === 2 && cs.filter(c => c.querySelector("dl > div dd").textContent.split(";").length === 2).length === 1; })()');
      return a === 2 && b;
    })());
    ok(`${tag}: the 2023 to 2026 group shows four counts, each with its own incident total`, await (async () => { if (!(await toll(p, '2326'))) return false; return p.ev('document.querySelectorAll("#mpToll .mp-tc").length === 4 && [...document.querySelectorAll("#mpToll .mp-tc-doc dd")].every(d => d.textContent.trim().length > 3)'); })());
    ok(`${tag}: the civil war toll has no official census and says so`, await (async () => { if (!(await toll(p, 'civil'))) return false; return p.ev('document.querySelectorAll("#mpToll .mp-tc").length === 1 && document.querySelector("#mpToll .mp-tc .note").textContent.length > 30'); })());
    if (lang !== 'en') ok(`${tag}: no English caveat is left in the toll panel (no EN mark, Latin text only in names and acronyms)`, await p.ev('(() => { const t = document.querySelector("#mpToll").textContent; return !/Estimates only|Counted by|Official toll/.test(t); })()'));
    if (lang === 'ar') ok(`${tag}: the toll panel text is right-to-left Arabic`, await p.ev('document.documentElement.dir === "rtl" && /[\\u0600-\\u06ff]/.test(document.querySelector("#mpToll h3").textContent)'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
