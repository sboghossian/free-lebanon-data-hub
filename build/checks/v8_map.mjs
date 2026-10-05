// v8 checks, Strike map: the official toll per war next to what the mapped incidents add up to, geocode overrides applied, and the same in 390 px, Arabic and French.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
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

  // ---- v10: the separate layer "Attacks on health care, schools and aid (Insecurity Insight)": off by default, never mixed with the strike counts
  const at = readData('strikes/attacks.json'), man = readData('manifest.json'), mf = (man.files || man).map(f => f.path);
  const cnt = c => at.rows.filter(r => r[1] === at.cats.indexOf(c)).length;
  ok('v10 attacks: attacks.json holds the 1,001 rows (health care 815, education 58, aid workers 58, water 70), CC BY-SA 4.0, with a source and credit', at.rows.length === 1001 && cnt('health_care') === 815 && cnt('education') === 58 && cnt('aid_worker') === 58 && cnt('water') === 70 && at.license === 'CC BY-SA 4.0' && /^https:\/\/data\.humdata\.org/.test(at.source) && /Insecurity Insight/.test(at.credit));
  ok('v10 attacks: no row has coordinates (the publisher censors them), so none can be drawn', at.with_coords === 0 && at.cols.indexOf('lat') < 0);
  ok('v10 attacks: the rows are NOT in strikes.json or csv/strikes.csv (no strike count can include them); the layer file and its CSV are in the manifest', !JSON.stringify(sk).includes('SiND') && !/Insecurity/.test(JSON.stringify(sk.dict)) && ['data/strikes/attacks.json', 'data/csv/attacks.csv', 'data/csv/strikes.csv'].every(f => mf.includes(f)));
  ok('v10 attacks: 24 event ids appear in two sheets and the file says so (rows are not unique incidents)', at.dup_events === 24);
  const snap = p => p.ev('[...document.querySelectorAll("#mpStats dd, #mpTop li, #mpNote, #mpMore")].map(e => e.textContent).join("|") + "#" + document.querySelectorAll("#mpPts *").length + "#" + document.querySelectorAll("#mpList li").length');
  const num = x => +String(x).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, '');
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v10 attacks ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#map' });
    await p.wait('document.querySelectorAll("#mpStats dd").length >= 3 && !document.querySelector("#mapRoot .hub-load")', 25000);
    ok(`${tag}: the layer is off by default: unchecked box, hidden panel, no shading, and attacks.json has not been fetched`, await p.ev('!document.getElementById("mpAttOn").checked && document.getElementById("mpAttBox").hidden && document.getElementById("mpAtt").children.length === 0 && !performance.getEntriesByType("resource").some(r => /attacks\\.json/.test(r.name))'));
    const s0 = await snap(p);
    await p.ev('document.getElementById("mpAttOn").click()');
    ok(`${tag}: switching it on shows the panel with 4 kinds, a per-kind table, bars by governorate, the credit and a CSV link`, await p.wait('!document.getElementById("mpAttBox").hidden && document.querySelectorAll("#mpAttList li").length >= 20 && document.querySelectorAll("#mpAttCats [data-ac]").length === 4 && document.querySelectorAll("#mpAttSum tbody tr").length === 4 && document.querySelectorAll("#mpAttGovB li").length >= 8', 15000));
    await sleep(500); await p.shot(`shot-v10-attacks-${lang}-${w}.png`);
    if (lang !== 'fr') { for (const [id, nm] of [['mpStage', 'map'], ['mpAttBox', 'box'], ['mpAttList', 'list']]) { await p.ev(`document.getElementById("${id}").scrollIntoView({ block: "start" })`); await sleep(300); await p.shot(`shot-v10-attacks-${nm}-${lang}-${w}.png`); } await p.ev('window.scrollTo(0, 0)'); }
    ok(`${tag}: the four kind counts add up to the 1,001 rows`, await p.ev('[...document.querySelectorAll("#mpAttCats .ct")].map(e => e.textContent.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, "")).reduce((a, b) => a + +b, 0) === 1001'));
    ok(`${tag}: the eight governorates that rows name are shaded under the points, each with its row count; none is drawn as a dot`, await p.ev('document.querySelectorAll("#mpAtt path").length === 8 && document.querySelectorAll("#mpLb .mp-att-n").length === 8 && !document.querySelector("#mpAttBox circle")'));
    ok(`${tag}: totals unchanged with the layer on (incidents, places, killed, top places, toll, list, dots on the map)`, (await snap(p)) === s0);
    ok(`${tag}: the credit names Insecurity Insight and CC BY-SA 4.0 and links the source and the CSV; rows with no governorate and the one with no outline are listed`, await p.ev('(() => { const c = document.getElementById("mpAttCredit"); return /Insecurity Insight/.test(c.textContent) && /CC BY-SA 4\\.0/.test(c.textContent) && /humdata/.test(c.innerHTML) && !!c.querySelector("a[href$=\\"csv/attacks.csv\\"]") && document.querySelectorAll("#mpAttGovB li").length === 10; })()'));
    // kinds and dates
    const n0 = await p.ev('document.getElementById("mpAttN").textContent');
    await p.ev('document.querySelector("#mpAttCats [data-ac=health_care]").click()'); await sleep(300);
    ok(`${tag}: switching Health care off removes 815 rows from the list and the shading; the strike totals still do not move`, (await p.ev('document.getElementById("mpAttN").textContent')) !== n0 && (await p.ev('document.querySelector("#mpAttCats [data-ac=health_care]").getAttribute("aria-pressed")')) === 'false' && (await snap(p)) === s0);
    await p.ev('document.querySelector("#mpAttCats [data-ac=health_care]").click()'); await sleep(200);
    await p.ev('(() => { const a = document.getElementById("mpT0"), b = document.getElementById("mpT1"); a.value = "2026-03-01"; b.value = "2026-12-31"; a.dispatchEvent(new Event("change")); b.dispatchEvent(new Event("change")); })()'); await sleep(500);
    const want = at.rows.filter(r => r[0] >= '2026-03-01' && r[0] <= '2026-12-31').length;
    ok(`${tag}: the From and To dates narrow the layer to the ${want} rows of those dates`, num(await p.ev('[...document.querySelectorAll("#mpAttCats .ct")].map(e => e.textContent).join(" ")').then(x => x.split(' ').map(num).reduce((a, b) => a + b, 0))) === want);
    await p.ev('document.getElementById("mpTR").click()'); await sleep(300);
    await p.ev('document.getElementById("mpAttMore").click()'); await sleep(200);
    ok(`${tag}: Show more adds rows to the list`, (await p.ev('document.querySelectorAll("#mpAttList li").length')) === 50);
    if (lang !== 'en') ok(`${tag}: no English left in the layer (headings, notes, kinds, perpetrators, weapons)`, await p.ev('!/Rows by governorate|Every row|Kind of attack|Israeli Defence Forces|Reported perpetrator|Aerial Bomb|No governorate stated|Health Building|Insecurity Insight, Aid Security|Health care|Water systems|Shading on the map/.test(document.getElementById("mpAttBox").textContent + document.getElementById("mpAttNote").textContent)'));
    if (lang === 'ar') ok(`${tag}: the layer is right-to-left Arabic`, await p.ev('document.documentElement.dir === "rtl" && /[\\u0600-\\u06ff]/.test(document.querySelector("#mpAttH").textContent) && /[\\u0600-\\u06ff]/.test(document.querySelector("#mpAttList li").textContent)'));
    ok(`${tag}: no horizontal overflow with the layer on`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    await p.ev('document.getElementById("mpAttOn").click()'); await sleep(400);
    ok(`${tag}: switching it off hides the panel and clears the shading; totals are as they were`, await p.ev('document.getElementById("mpAttBox").hidden && document.getElementById("mpAtt").children.length === 0 && document.querySelectorAll("#mpLb .mp-att-n").length === 0') && (await snap(p)) === s0);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  // a missing layer file shows the error state with Retry, and the map itself keeps working
  const fa = fixture('attacks-missing', null, { 'strikes/attacks.json': null });
  const pa = await open(1400, fa, { hash: '#map', allow: /attacks\.json|404|Failed to load/ });
  await pa.wait('document.querySelectorAll("#mpStats dd").length >= 3', 25000);
  await pa.ev('document.getElementById("mpAttOn").click()');
  ok('v10 attacks: a missing layer file shows an error with Retry inside the layer panel, not a broken map', await pa.wait('!!document.querySelector("#mpAttIn [data-retry]")', 15000) && await pa.ev('document.querySelectorAll("#mpStats dd").length >= 3 && document.getElementById("mpAtt").children.length === 0'));
  await pa.close();
}
