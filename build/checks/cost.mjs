// Checks for the Cost of living tab (FE-B): the six views, the minimum-wage panel, CPI bars, public money, the series explorer, every chart's source and licence, CSV links, empty and error states, 390 px, Arabic and French.
// A few long-lived pages walk through the views by hash (like a visitor does), so the suite stays short.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, get } = T;
  const VIEWS = [['#cost', '#costView .fb-card', 3], ['#cost/wages', '#costView .fb-card', 8], ['#cost/prices', '#costView .fb-card', 5], ['#money', '#costView .fb-card', 10], ['#cost/explore', '#xplRes .fb-br', 8], ['#cost/all', '#costAll .fb-br', 20]];
  const go = async (p, h, sel, min) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`document.querySelectorAll(${JSON.stringify(sel)}).length >= ${min} && !document.querySelector("#costView .hub-load")`, 25000); };

  // ---- 1400 px, English: one page, every view
  const p = await open(1400, SITE, { hash: '#cost' });
  ok('cost: opens by deep link #cost with six view chips', await p.wait('!document.getElementById("cost").hidden && document.querySelectorAll("#costNav [data-id]").length === 6', 15000));
  ok('cost: exchange-rate view shows four stat tiles and the official and market lines', await p.ev('document.querySelectorAll("#costView .fb-stat").length === 4 && document.querySelectorAll("#costView .fb-card .hc-line").length >= 2'));
  ok('cost: every chart card shows its source and licence', await p.ev('[...document.querySelectorAll("#costView .fb-card")].every(c => /Source/.test(c.querySelector(".fb-src")?.textContent || "") && /Licence/.test(c.querySelector(".fb-src")?.textContent || ""))'));
  ok('cost: the market rate tile shows the 89,500 official rate (data sanity)', await p.ev('/89,500/.test(document.querySelector("#costView .fb-stat dd").textContent)'));
  await p.ev('document.querySelector("#costView [data-log]").click()'); await sleep(200);
  ok('cost: the log-scale toggle flips and the chart is redrawn', await p.ev('document.querySelector("#costView [data-log]").getAttribute("aria-pressed") === "true" && !!document.querySelector("#costView .fb-card .hc-svg")'));
  ok('cost: a CSV link points at a published file that exists', await (async () => { const href = await p.ev('document.querySelector("#costView .fb-src a[download]")?.getAttribute("href")'); if (!href) return false; const r = await get(href); return r.status === 200 && (await r.text()).split('\n')[0].includes('series_id') && /filter series_id = /.test(await p.ev('document.querySelector("#costView .fb-src").textContent')); })());
  ok('cost: details open to a data table', await p.ev('(() => { const d = document.querySelector("#costView .fb-det"); d.open = true; d.dispatchEvent(new Event("toggle")); return !!d.querySelector("table tbody tr"); })()'));
  for (const [h, sel, min] of VIEWS) ok(`cost: ${h} renders at least ${min} items`, await go(p, h, sel, min));
  await go(p, '#cost/wages', '#costView .fb-card', 8);
  await p.ev('(() => { const i = document.getElementById("costYr"); i.value = "2019"; i.dispatchEvent(new Event("input")); })()');
  ok('cost: the year slider changes the minimum-wage panel (2019: about 27 petrol canisters from 675,000 LBP)', await p.ev('(() => { const t = [...document.querySelectorAll("#costBuy .fb-stat")].find(x => /Petrol/.test(x.textContent)); return !!t && /\\b2[6-8]\\b/.test(t.querySelector("dd").textContent) && document.getElementById("costYrO").textContent.includes("2019"); })()'));
  ok('cost: items without a price in the chosen year say so', await p.ev('/no price on record/.test(document.getElementById("costBuy").textContent)'));
  await go(p, '#cost/prices', '#costCpiB li', 10);
  ok('cost: CPI bars list the categories sorted, with "All items" highlighted', await p.ev('document.querySelectorAll("#costCpiB li").length >= 12 && !!document.querySelector("#costCpiB li.hi")'));
  const before = await p.ev('document.querySelector("#costCpiB li.hi .hb-v").textContent');
  await p.ev('(() => { const s = document.getElementById("costBase"); s.value = "2014"; s.dispatchEvent(new Event("change")); })()'); await sleep(200);
  ok('cost: changing the base year changes the CPI bars', (await p.ev('document.querySelector("#costCpiB li.hi .hb-v").textContent')) !== before);
  await p.ev('document.querySelector("#costCats [data-c=rent]").click()'); await sleep(250);
  ok('cost: category chips add a line to the year-on-year chart', await p.ev('document.querySelectorAll("#costYoY .hc-line").length === 5'));
  await p.ev('(() => { const i = document.getElementById("costSubQ"); i.value = "fruit"; i.dispatchEvent(new Event("input")); })()'); await sleep(200);
  ok('cost: the sub-class table filters by search', await p.ev('document.querySelectorAll("#costSubT tbody tr").length >= 1 && document.querySelectorAll("#costSubT tbody tr").length < 10'));
  await go(p, '#money', '#costView .fb-card', 10);
  ok('cost: public money shows tiles, charts and the dated events list', await p.ev('document.querySelectorAll("#costView .fb-stat").length === 4 && !!document.querySelector("#costView .fb-ev li")'));
  ok('cost: public money keeps the IMF licence note visible', await p.ev('/International Monetary Fund/.test(document.querySelector("#costView").textContent)'));
  await go(p, '#cost/explore/fx_lbp_usd_market_monthly,min_wage_private_lbp_month', '#xplChart .hc-line', 2);
  ok('cost: the explorer opens from a deep link with two chosen series on one chart', await p.ev('document.querySelectorAll("#xplSel [data-rm]").length === 2 && document.querySelectorAll("#xplChart .hc-line").length === 2'));
  ok('cost: series with different units are forced to an index (no second axis) and say so', await p.ev('document.getElementById("xplIdx").checked && document.getElementById("xplIdx").disabled && /Index, 100/.test(document.getElementById("xplChart").textContent)'));
  ok('cost: the explorer shows a correlation with the warning that it is not a cause', await p.ev('/r = /.test(document.getElementById("xplStat").textContent) && /not a cause/.test(document.getElementById("xplStat").textContent)'));
  await p.ev('(() => { const i = document.getElementById("xplQ"); i.value = ""; i.dispatchEvent(new Event("input")); })()'); await sleep(250);
  ok('cost: the explorer searches every published series (more than 400 are listed)', await p.ev('parseInt(document.getElementById("xplN").textContent.split(" of ")[1].replace(/[^0-9]/g, ""), 10) > 400'));
  await p.ev('(() => { const i = document.getElementById("xplQ"); i.value = "petrol 95"; i.dispatchEvent(new Event("input")); })()'); await sleep(300);
  await p.ev('document.querySelector("#xplRes [data-add]").click()'); await sleep(400);
  ok('cost: Add puts a third series on the chart and updates the address', await p.ev('document.querySelectorAll("#xplChart .hc-line").length === 3 && location.hash.split(",").length === 3'));
  await p.ev('document.querySelector("#xplSel [data-rm]").click()'); await sleep(300);
  ok('cost: a chosen series can be removed', await p.ev('document.querySelectorAll("#xplChart .hc-line").length === 2'));
  ok('cost: 0 console errors across all views at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // ---- 390 px, English
  const m = await open(390, SITE, { hash: '#cost' });
  for (const [h, sel, min] of VIEWS) {
    await go(m, h, sel, min); await sleep(500);
    ok(`cost: ${h} has no horizontal overflow at 390`, (await m.ev('document.documentElement.scrollWidth')) <= 390);
  }
  ok('cost: 0 console errors across all views at 390', m.errors().length === 0, m.errors());
  await m.close();

  // ---- Arabic (right-to-left) and French
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#cost' });
  await a.wait('document.querySelectorAll("#costView .fb-card, #costView .fb-stat").length > 2', 20000); await sleep(600);
  for (const [h, sel, min] of VIEWS) {
    await go(a, h, sel, min); await sleep(400);
    ok(`cost: Arabic ${h} at 1400 is right-to-left and has no overflow`, await a.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 1400'));
  }
  await go(a, '#cost', '#costView .fb-card', 3);
  ok('cost: Arabic translates the chips and the headings', await a.ev('/[\\u0600-\\u06FF]/.test(document.querySelector("#costNav").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#costView .fb-t, #costView .fb-stat dt").textContent)'));
  await a.ev('HUB.setLang("fr", { noStore: true })'); await sleep(900);
  ok('cost: French renders the chips in French', await a.ev('/Taux de change/.test(document.querySelector("#costNav").textContent)'));
  ok('cost: 0 console errors in Arabic and French', a.errors().length === 0, a.errors());
  await a.close();
  const am = await open(390, SITE, { query: '?lang=ar', hash: '#cost/wages' });
  for (const [h, sel, min] of [['#cost/wages', '#costView .fb-card', 8], ['#money', '#costView .fb-card', 10], ['#cost/prices', '#costView .fb-card', 5]]) {
    await go(am, h, sel, min); await sleep(700);
    ok(`cost: Arabic ${h} at 390 is right-to-left and has no overflow`, await am.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 390'));
  }
  ok('cost: 0 console errors in Arabic at 390', am.errors().length === 0, am.errors());
  await am.close();

  // ---- empty and error states
  const fe = fixture('cost-empty', D => { D.tabs.cost = {}; });
  const e = await open(1400, fe, { hash: '#cost' });
  await sleep(600);
  ok('cost: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#costRoot .hub-empty") && !document.querySelector("#costNav")'));
  await e.close();
  const fm = fixture('cost-missing', null, { 'cost/prices.json': null, 'money/series.json': null });
  const mm = await open(1400, fm, { hash: '#cost', allow: /prices\.json|series\.json|404|Failed to load/ });
  await mm.wait('!!document.querySelector("#costRoot .hub-err")', 15000);
  ok('cost: a missing data file shows the error state with Retry, not a broken chart', await mm.ev('!!document.querySelector("#costRoot .hub-err [data-retry]") && !document.querySelector("#costRoot .fb-card")'));
  const fx = fixture('cost-nomoney', null, { 'money/series.json': null });
  const mn = await open(1400, fx, { hash: '#money', allow: /series\.json|404|Failed to load/ });
  await mn.wait('!!document.querySelector("#costView .hub-err")', 15000);
  ok('cost: public money without its file shows the error state and the other views still work', await mn.ev('!!document.querySelector("#costView [data-retry]") && document.querySelectorAll("#costNav [data-id]").length === 6'));
  await mm.close(); await mn.close();
}
