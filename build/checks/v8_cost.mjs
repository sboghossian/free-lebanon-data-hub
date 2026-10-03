// v8 checks, Cost of living and Electricity: C-continuity merged (filled dates as hollow dots with their source), bread and generator kWh series, the supply-hours PROXY with its method.
export default async function (T) {
  const { ok, sleep, open, SITE, readData } = T;
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
  const a = await open(1400, SITE, { hash: '#electricity/all' });
  await a.wait('document.querySelectorAll("#elAll .fb-br").length > 10', 25000);
  await a.ev('(() => { const i = document.querySelector("#elAll input[type=search]"); i.value = "PROXY"; i.dispatchEvent(new Event("input")); })()'); await sleep(400);
  ok('v8 electricity: the series list tags the proxy series "proxy, not official"', await a.ev('[...document.querySelectorAll("#elAll .fb-br")].some(r => /proxy, not official/.test(r.textContent))'));
  await a.close();
}
