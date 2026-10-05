import { createHash } from 'node:crypto';
// v8 checks, Cost of living and Electricity: C-continuity merged (filled dates as hollow dots with their source), bread and generator kWh series, the supply-hours PROXY with its method.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const pr = readData('cost/prices.json').series, by = Object.fromEntries(pr.map(s => [s.id, s]));
  const pet = by.fuel_petrol95_lbp_20l;
  ok('v8 cost: petrol 95 now has 1,000 dates (the ministry listing had 932) and 70 filled dates with a basis and a source', pet.points.length === 1000 && Object.keys(pet.filled).length === 70 && Object.values(pet.filled).every(v => ['press_relay', 'aggregator_relay'].includes(v[0]) && v[1]));
  ok('v8 cost: the generator fixed fee runs from 2018-06 with no gaps (98 months) and marks the inferred months', by.gen_fixed_5a_lbp_month.points.length === 98 && Object.values(by.gen_fixed_5a_lbp_month.filled || {}).some(v => v[0] === 'inferred_bracketed'));
  ok('v8 cost: US dollar series follow the filled pound series (same number of dates), and the canisters series gained months', by.fuel_petrol95_usd_market_20l.points.length === 1000 && by.min_wage_in_petrol_canisters.points.length > 168);
  ok('v8 cost: bread decisions, the month-by-month series, the WFP shop price and the generator kWh prices are published', ['bread_standard_bundle_bakery_lbp', 'bread_standard_bundle_bakery_lbp_monthly_inforce', 'bread_pita_800g_retail_median_wfp_lbp', 'gen_kwh_urban_lbp', 'gen_kwh_rural_lbp'].every(id => by[id] && by[id].points.length > 10));
  const pw = readData('electricity/power.json').series, bp = Object.fromEntries(pw.map(s => [s.id, s]));
  ok('v8 electricity: the proxy series is flagged proxy, labelled PROXY, has 103 months and a basis for every month that is not computed', bp.edl_supply_hours_proxy_monthly.proxy === true && /PROXY/.test(bp.edl_supply_hours_proxy_monthly.label) && bp.edl_supply_hours_proxy_monthly.points.length === 103 && Object.keys(bp.edl_supply_hours_proxy_monthly.filled).length === 54);
  ok('v8 electricity: the method note says it is a proxy, not an official series', /PROXY, NOT AN OFFICIAL SERIES/.test(bp.edl_supply_hours_proxy_monthly.notes));

  const hover = async (p, sel, n) => p.ev(`(() => { const svg = document.querySelector(${JSON.stringify(sel)}); const r = svg.getBoundingClientRect(); for (let i = 1; i < ${n}; i++) { svg.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + r.width * i / ${n}, clientY: r.top + 40, bubbles: true })); const f = document.querySelector(${JSON.stringify(sel)}).parentElement.querySelector(".hc-fn"); if (f && !document.querySelector(${JSON.stringify(sel)}).parentElement.querySelector(".hc-tip").hidden) return f.textContent; } return ""; })()`);
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 cost ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#cost/wages' });
    ok(`${tag}: the wages and prices view draws its cards`, await p.wait('document.querySelectorAll("#costView .fb-card").length >= 11 && !document.querySelector("#costView .hub-load")', 30000));
    ok(`${tag}: the fuel, generator and bread charts show hollow dots for filled values, with a note under the chart`, await p.ev('(() => { const cards = [...document.querySelectorAll("#costView .fb-card")]; const withFl = cards.filter(c => c.querySelectorAll(".hc-fl").length > 3); return withFl.length >= 3 && withFl.every(c => !!c.querySelector(".fb-fillnote")); })()'));
    ok(`${tag}: the generator kWh card and the two bread cards are there`, await p.ev('document.querySelectorAll("#costView .fb-card").length >= 12 && [...document.querySelectorAll("#costView .fb-card h4")].length >= 12'));
    if (lang === 'en') {
      ok(`${tag}: hovering a filled date shows its basis and source in the tooltip`, /press copy|TheFuelPrice/.test(await hover(p, '#costView .fb-card:nth-of-type(4) .hc-svg', 80) || await (async () => { for (let i = 1; i <= 12; i++) { const t = await hover(p, `#costView .fb-card:nth-of-type(${i}) .hc-svg`, 90); if (/press copy|TheFuelPrice/.test(t)) return t; } return ''; })()));
      ok(`${tag}: the minimum-wage panel still lists bread and generator items`, await p.ev('/Bread bundles, standard size/.test(document.getElementById("costBuy").textContent) && /generator/.test(document.getElementById("costBuy").textContent)'));
    } else ok(`${tag}: no English left in the card titles and notes of the new charts`, await p.ev('!/Generator price per kWh|Bread: the set price|Hollow dots|Shop price/.test(document.getElementById("costView").textContent)'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();

    const e = await open(w, SITE, { query: q, hash: '#electricity' });
    ok(`${tag} electricity: the public power view draws`, await e.wait('document.querySelectorAll("#elView .fb-card").length >= 6 && !document.querySelector("#elView .hub-load")', 30000));
    ok(`${tag} electricity: the PROXY block is set apart, says proxy and gives the method`, await e.ev('(() => { const b = document.querySelector("#elView .fb-proxy"); return !!b && !!b.querySelector(".fb-proxy-tag b") && b.querySelector(".fb-proxy-m").textContent.length > 300 && b.querySelectorAll(".fb-card").length === 3; })()'));
    ok(`${tag} electricity: the proxy chart has hollow dots for the months that are not computed`, await e.ev('document.querySelectorAll("#elView .fb-proxy .fb-card")[0].querySelectorAll(".hc-fl").length > 20'));
    if (lang === 'en') ok(`${tag} electricity: the proxy is labelled as a proxy and not official in the text`, await e.ev('/PROXY/.test(document.querySelector("#elView .fb-proxy-tag").textContent) && /not an official series/i.test(document.querySelector("#elView .fb-proxy").textContent)'));
    else ok(`${tag} electricity: no English left in the proxy block`, await e.ev('!/Our estimate|Method\\.|energy-equivalent|Hollow dots/.test(document.querySelector("#elView .fb-proxy").textContent)'));
    ok(`${tag} electricity: no horizontal overflow`, (await e.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag} electricity: 0 console errors`, e.errors().length === 0, e.errors());
    await e.close();
  }
  const a = await open(1400, SITE, { hash: '#data/electricity' });   // v10: every series lives in the Data tab
  await a.wait('document.querySelectorAll("#dxSerL .dx-sr").length > 10', 25000);
  await a.ev('(() => { const i = document.getElementById("dxSq"); i.value = "PROXY"; i.dispatchEvent(new Event("input")); })()'); await sleep(400);
  ok('v8 electricity: the series list (Data tab, #data/electricity) tags the proxy series "proxy, not official"', await a.ev('[...document.querySelectorAll("#dxSerL .dx-sr")].some(r => /proxy, not official/.test(r.textContent))'));
  await a.close();

  // ---- v10: Food security view (WFP food prices, IPC acute food insecurity) and the new World indicators
  const fp = readData('cost/food.json').series, ipc = readData('cost/ipc.json');
  ok('v10 food: food.json holds the 436 WFP series, each with a source, the CC BY-IGO licence and a CSV in the topic file', fp.length === 436 && fp.every(s => /^https:\/\/data\.humdata\.org/.test(s.source_url) && /CC BY-IGO/.test(s.license) && /^csv\/series\/food-prices/.test(s.csv || '')));
  ok('v10 food: no US dollar price from September 2019 to February 2024 (WFP converts at the official rate, which was far from the market rate)', fp.filter(s => /_usd_/.test(s.id)).every(s => s.points.every(p => p[0] < '2019-09' || p[0] >= '2024-03')));
  ok('v10 food: ipc.json has 13 national rows; the latest (Mar 2026 projection) puts 24% and 1,241,715 people in phase 3 or above', ipc.national.length === 13 && ipc.national.some(r => r.analysis === 'Mar 2026' && r.phase['3+'][0] === 1241715 && r.phase['3+'][1] === 0.24) && /CC0/.test(ipc.license));
  const man = readData('manifest.json'), files = (man.files || man).map(f => f.path);
  ok('v10 food: the IPC table and the food-price CSV are in the manifest (the Data tab lists them) with their licences', ['data/csv/ipc.csv', 'data/cost/ipc.json', 'data/cost/food.json'].every(f => files.includes(f)) && files.some(f => /csv\/series\/food-prices/.test(f)));
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v10 food ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#cost/food' });
    ok(`${tag}: the Food security chip is one of six views and the view draws prices and IPC bars`, await p.wait('document.querySelectorAll("#costNav [data-id]").length === 6 && document.querySelector("#costNav [data-id=food]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#foodChart .fb-card .hc-line").length >= 1 && document.querySelectorAll("#foodBarsB li").length >= 10 && !document.querySelector("#costView .hub-load")', 40000));
    await sleep(400); await p.shot(`shot-v10-food-${lang}-${w}.png`);
    if (lang !== 'fr') { for (const [id, nm] of [['foodChart', 'chart'], ['foodStack', 'ipc'], ['foodBars', 'areas']]) { await p.ev(`document.getElementById("${id}").scrollIntoView({ block: "start" })`); await sleep(300); await p.shot(`shot-v10-food-${nm}-${lang}-${w}.png`); } await p.ev('window.scrollTo(0, 0)'); }
    ok(`${tag}: eight tiles (three for the price, four for the IPC country total)`, await p.ev('document.querySelectorAll("#foodNow .fb-stat").length === 3 && document.querySelectorAll("#foodI .fb-stat").length === 4'));
    ok(`${tag}: the price card names its source and licence and links the CSV; the IPC block names HDX, CC0 and links ipc.csv`, await p.ev('(() => { const a = document.querySelector("#foodChart .fb-src").textContent, b = document.querySelector("#foodI > .fb-src, #foodI .fb-src").textContent; return /humdata/.test(a) && /CC BY-IGO/.test(a) && !!document.querySelector("#foodChart .fb-src a[download]") && /humdata/.test(b) && /CC0/.test(b) && !!document.querySelector("#foodI a[href$=\\"csv/ipc.csv\\"]"); })()'));
    ok(`${tag}: the IPC stack bar shows phases and its legend lists the shares`, await p.ev('document.querySelectorAll("#foodStack .fd-stack i").length >= 3 && document.querySelectorAll("#foodStack .fd-leg li").length === 5'));
    // choose another commodity and the US dollar series: the line is broken over Sep 2019 to Feb 2024, not joined
    await p.ev('(() => { const s = document.getElementById("foodItem"); s.value = "eggs_30_pcs"; s.dispatchEvent(new Event("change")); const c = document.getElementById("foodCur"); c.value = "usd"; c.dispatchEvent(new Event("change")); })()'); await sleep(500);
    ok(`${tag}: US dollars for eggs draws two separate runs (before Sep 2019 and after Feb 2024), with the note that explains the gap`, await p.ev('document.querySelectorAll("#foodChart .hc-line").length === 2 && document.querySelectorAll("#foodChart .fb-card .note").length >= 1 && document.querySelector("#foodChart .fb-card figcaption .note").textContent.length > 150'));
    await p.ev('(() => { const a = document.getElementById("foodArea"); a.value = "compare"; a.dispatchEvent(new Event("change")); })()'); await sleep(500);
    ok(`${tag}: comparing governorates draws one line per governorate plus the national median`, await p.ev('document.querySelectorAll("#foodChart .hc-line").length >= 7'));
    await p.ev('(() => { const a = document.getElementById("foodCur"); a.value = "lbp"; a.dispatchEvent(new Event("change")); const i = document.getElementById("foodItem"); i.value = "bread_pita_800_g"; i.dispatchEvent(new Event("change")); const a2 = document.getElementById("foodArea"); a2.value = "south"; a2.dispatchEvent(new Event("change")); })()'); await sleep(500);
    ok(`${tag}: a single governorate (South) in pounds draws one line and a log-scale toggle`, await p.ev('document.querySelectorAll("#foodChart .hc-line").length === 1 && !!document.querySelector("#foodChart [data-log]") && document.getElementById("foodArea").value === "south"'));
    // IPC: another analysis changes the bars; a group chip filters; show all expands
    const b0 = await p.ev('document.getElementById("foodBarsB").textContent');
    await p.ev('(() => { const s = document.getElementById("foodIpc"); s.selectedIndex = 4; s.dispatchEvent(new Event("change")); })()'); await sleep(400);
    ok(`${tag}: choosing an older analysis redraws the bars`, (await p.ev('document.getElementById("foodBarsB").textContent')) !== b0 && await p.ev('document.querySelectorAll("#foodBarsB li").length >= 10'));
    await p.ev('document.querySelector("#foodGrp [data-g=syrian]")?.click()'); await sleep(300);
    ok(`${tag}: the Syrian refugees chip keeps only refugee areas`, await p.ev('(() => { const l = [...document.querySelectorAll("#foodBarsB .hb-l")]; return document.querySelector("#foodGrp [data-g=syrian]").getAttribute("aria-pressed") === "true" && l.length > 5 && l.every(x => /\\(|Refugees|refugees|لاجئ|réfugiés|Syri|سوري/.test(x.textContent)); })()'));
    await p.ev('document.querySelector("#foodGrp [data-g=all]").click()'); await sleep(300);
    const n15 = await p.ev('document.querySelectorAll("#foodBarsB li").length');
    await p.ev('document.getElementById("foodAll")?.click()'); await sleep(300);
    ok(`${tag}: Show all lists every area (more than the first ${n15})`, n15 <= 15 && (await p.ev('document.querySelectorAll("#foodBarsB li").length')) > n15);
    if (lang !== 'en') ok(`${tag}: no English left in the Food security headings, stats, notes and chips`, await p.ev('!/Food prices|Acute food insecurity|Latest price|A year earlier|Show all|Analysis and period|By area|Country total over time|current period|Lebanese residents|Crisis|The IPC classifies|Each point is the median/.test(document.getElementById("costView").textContent)'));
    if (lang === 'ar') ok(`${tag}: right-to-left with Arabic headings`, await p.ev('document.documentElement.dir === "rtl" && /[\\u0600-\\u06FF]/.test(document.querySelector("#costView h3").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#foodIpc option").textContent)'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  const ff = fixture('food-missing', null, { 'cost/food.json': null, 'cost/ipc.json': null });
  const fm = await open(1400, ff, { hash: '#cost/food', allow: /food\.json|ipc\.json|404|Failed to load/ });
  await fm.wait('document.querySelectorAll("#costView [data-retry]").length >= 2', 15000);
  ok('v10 food: missing food files show an error state with Retry in each block, not a broken chart', await fm.ev('document.querySelectorAll("#costView [data-retry]").length === 2 && !document.querySelector("#costView .fb-card")'));
  await fm.close();
  const fe = fixture('food-none', D => { D.tabs.cost.food = 0; D.tabs.cost.ipc = 0; });
  const fn = await open(1400, fe, { hash: '#cost/food' });
  await fn.wait('document.querySelectorAll("#costView .hub-empty").length >= 2', 15000);
  ok('v10 food: a build with no food data says so (two honest empty states)', await fn.ev('document.querySelectorAll("#costView .hub-empty").length === 2 && !document.querySelector("#costView .fb-card")'));
  await fn.close();

  // the World tab: the 12 new governance, jobs and schooling indicators are listed with their source and licence, and open on the map
  const wi = readData('world/index.json').indicators, wby = Object.fromEntries(wi.map(m => [m.id, m]));
  const NEW = [['GOV_WGI_CC.EST', 'Governance'], ['GOV_WGI_GE.EST', 'Governance'], ['GOV_WGI_PV.EST', 'Governance'], ['GOV_WGI_RL.EST', 'Governance'], ['GOV_WGI_RQ.EST', 'Governance'], ['GOV_WGI_VA.EST', 'Governance'], ['TI.CPI', 'Governance'], ['ILO.UNE.YOUTH', 'Labour'], ['ILO.UNE.FEM', 'Labour'], ['ILO.UNE.MALE', 'Labour'], ['UIS.GER.1', 'Education'], ['UIS.GER.2T3', 'Education']];
  ok('v10 world: all 12 new indicators are in the World index under Governance, Labour or Education, with source, licence and a Lebanon value', NEW.every(([id, tp]) => wby[id] && wby[id].topic === tp && wby[id].src && /^https?:/.test(wby[id].url) && wby[id].lic && wby[id].lbn && wby[id].csv));
  ok('v10 world: the WGI and jobs and schooling licences are CC BY 4.0; the CPI licence states both CC BY 4.0 (Our World in Data) and CC BY-ND 4.0 (Transparency International)', NEW.filter(([id]) => id !== 'TI.CPI').every(([id]) => wby[id].lic === 'CC BY 4.0') && /CC BY 4\.0/.test(wby['TI.CPI'].lic) && /CC BY-ND 4\.0/.test(wby['TI.CPI'].lic));
  const sha = x => createHash('sha1').update(x).digest('hex').slice(0, 12), tr = { ar: readData('i18n/ar.json'), fr: readData('i18n/fr.json') };
  ok('v10 world: Arabic and French text for the 12 labels and their units ships in data/i18n (it is in ui_map.json; emit_world.py reads only ui_world.json for label_ar and label_fr, so the picker shows these 12 in English until the entries are copied there)', NEW.every(([id]) => ['ar', 'fr'].every(l => tr[l][sha(wby[id].label)] && tr[l][sha(wby[id].unit)])));
  for (const [lang, q] of [['en', ''], ['ar', '?lang=ar']]) {
    const w = await open(1400, SITE, { query: q, hash: '#world/GOV_WGI_CC.EST/2024' });
    ok(`v10 world ${lang}: Control of Corruption opens on the map at 2024 and names World Bank and CC BY 4.0`, await w.wait('!document.getElementById("world").hidden && document.getElementById("wdInd")?.value === "GOV_WGI_CC.EST" && /CC BY 4\\.0/.test(document.querySelector("#wdSrc")?.textContent || "") && /World Bank/.test(document.querySelector("#wdSrc").textContent)', 40000));
    ok(`v10 world ${lang}: the indicator picker lists the Governance, Labour and Education groups with the new indicators`, await w.ev('(() => { const o = [...document.querySelectorAll("#wdInd option")].map(x => x.value); return ["GOV_WGI_VA.EST", "TI.CPI", "ILO.UNE.YOUTH", "ILO.UNE.FEM", "ILO.UNE.MALE", "UIS.GER.1", "UIS.GER.2T3"].every(i => o.includes(i)); })()'));
    ok(`v10 world ${lang}: 0 console errors`, w.errors().length === 0, w.errors());
    await w.close();
  }
  const wc = await open(1400, SITE, { hash: '#world/TI.CPI/2024' });
  ok('v10 world: the CPI view shows both licence statements in its source line', await wc.wait('/CC BY-ND 4\\.0/.test(document.querySelector("#wdSrc")?.textContent || "") && /Transparency International/.test(document.querySelector("#wdSrc").textContent)', 40000));
  await wc.close();
}
