/* ------------------------------------------------------------ Cost of living tab (FE-B). Data: data/cost/fx.json, data/cost/prices.json (D1, D2), data/money/series.json (D7).
   Views: exchange rate, wages and prices (with "what a month's minimum wage buys"), prices by category (CPI), public money, all series. Hash: #cost, #cost/<view>, #money. */
const COST_VIEWS = [{ id: 'fx', label: N('Exchange rate') }, { id: 'wages', label: N('Wages and prices') }, { id: 'prices', label: N('Prices by category') }, { id: 'food', label: N('Food security') }, { id: 'money', label: N('Public money') }, { id: 'explore', label: N('Compare any series') }];
const COST = { view: 'fx', S: null, year: 2024, base: 2019, cats: new Set(['total', 'food', 'housing', 'transport']), money: null };
const CPI_CATS = [['total', N('All items')], ['food', N('Food and drink')], ['alcohol_tobacco', N('Alcohol and tobacco')], ['clothing', N('Clothing and shoes')], ['housing', N('Housing, water, electricity, fuels')],
  ['furnishings', N('Furnishings and home upkeep')], ['health', N('Health')], ['transport', N('Transport')], ['communication', N('Communication')], ['recreation', N('Recreation and culture')], ['education', N('Education')],
  ['restaurants_hotels', N('Restaurants and hotels')], ['misc', N('Other goods and services')], ['rent', N('Rent')], ['utilities', N('Water, electricity and gas')]];
const BUYS = [
  { id: 'petrol', label: N('Petrol 95, 20 L canisters'), s: 'fuel_petrol95_lbp_20l', age: 0.6 },
  { id: 'diesel', label: N('Diesel, 20 L canisters'), s: 'fuel_diesel_lbp_20l', age: 0.6 },
  { id: 'gas', label: N('Gas cylinders, 10 kg'), s: 'fuel_lpg10kg_lbp', age: 0.6 },
  { id: 'bread', label: N('Bread bundles, standard size'), s: 'bread_standard_bundle_bakery_lbp_monthly_inforce', age: 0.2 },
  { id: 'gen', label: N('Months of a 5 A generator subscription'), s: 'gen_fixed_5a_lbp_month', age: 1.2 }];
const costSeries = id => COST.S[id];
const costX = iso => fbT(iso);
const costBuy = (it, Y) => {
  const x = Y + 0.5, w = fbAt(costSeries('min_wage_private_lbp_month'), x, 40), pr = costSeries(it.s) ? fbAt(costSeries(it.s), x, it.age) : null;
  return w && pr && (!it.to || x <= it.to) ? w / pr : null;
};
const costCard = (el, o) => fbCard(el, o);
const mult = v => '×' + (v >= 100 ? nf(v, 0) : nf(v, 1));

function costFx(el) {
  const mkt = costSeries('fx_lbp_usd_market_monthly'), off = costSeries('fx_lbp_usd_official_monthly'), a = costSeries('fx_official_annual'), sy = costSeries('fx_sayrafa_milestones'), lo = costSeries('fx_bank_rate_lollar'), pg = costSeries('fx_official_peg_steps');
  const m = fbLast(mkt), o = fbLast(off), j19 = mkt && mkt.points.find(p => p[0] === '2019-07');
  el.innerHTML = fbStats([
    { k: t('Official rate'), v: o ? nf(o[1], 0) : '', n: t('LBP per US dollar, {d}', { d: o ? fbLongDate(o[0]) : '' }) },
    { k: t('Market rate'), v: m ? nf(m[1], 0) : '', n: t('LBP per US dollar, {d}', { d: m ? fbLongDate(m[0]) : '' }) },
    { k: t('Market rate, July 2019'), v: j19 ? nf(j19[1], 0) : '', n: t('LBP per US dollar') },
    { k: t('Market rate since July 2019'), v: m && j19 ? mult(m[1] / j19[1]) : '', n: t('how many times more pounds a dollar costs') }]) + '<div class="fb-grid" data-g></div>' +
    `<p class="fb-note-band">${esc(t('The official rate was held at 1,507.5 pounds to the dollar from December 1997 to January 2023. From 2019 Lebanon had several rates at once: the official peg, the bank rate for dollar deposits (the "lollar"), the Sayrafa platform and the market. They were merged step by step between 2023 and 2024.'))}</p>`;
  const g = el.querySelector('[data-g]');
  const mk = [{ x: costX('2021-05-20'), label: t('Sayrafa') }, { x: costX('2023-02-01'), label: t('15,000') }, { x: costX('2024-01-31'), label: t('89,500') }];
  costCard(g, { title: t('Official and market rate'), unit: t('LBP per US dollar, monthly, 2012 to 2026'), series: [{ s: mkt, label: t('Market rate') }, { s: off, label: t('Official rate'), dash: true }], log: true, markers: mk, height: 270,
    note: t('The market rate is the national monthly median of the World Bank Real Time Prices survey, partly estimated by the World Bank. The official rate is the regime value set by the central bank.') }).fig.classList.add('wide');
  costCard(g, { title: t('Official rate, 1950 to 2025'), unit: t('LBP per US dollar, annual average, log scale'), series: [{ s: a, label: t('Official rate') }], logStart: true, log: true, gran: 'y', note: t('1950 to 1959 comes from the Penn World Table, 1960 on from the World Bank.') });
  const steps = pg ? fbStep(pg, '2026-09') : null, lolS = lo ? fbStep(lo, '2023-02') : null;
  costCard(g, { title: t('The other rates, 2020 to 2024'), unit: t('LBP per US dollar'), series: [{ s: sy, label: t('Sayrafa (dated points)') }, { s: lolS || lo, label: t('Bank rate for dollar deposits') }, { s: steps || pg, label: t('Official peg'), dash: true }],
    from: 2019.5, gran: 'd', height: 250, note: t('Sayrafa is a sparse sample: the central bank website blocks automated downloads, so the full daily file is not included.') });
}

function costWages(el) {
  const wu = costSeries('min_wage_private_usd_official_monthly'), wm = costSeries('min_wage_private_usd_market_monthly'), wl = costSeries('min_wage_private_lbp_month'), can = costSeries('min_wage_in_petrol_canisters');
  const wlast = fbLast(wl), mlast = fbLast(wm);
  el.innerHTML = fbStats([
    { k: t('Minimum wage today'), v: wlast ? nf(wlast[1], 0) + ' ' + t('LBP') : '', n: t('per month, private sector, since {d}', { d: wlast ? fbLongDate(wlast[0]) : '' }) },
    { k: t('In US dollars, market rate'), v: mlast ? '$' + nf(mlast[1], 0) : '', n: fbLongDate(mlast ? mlast[0] : '2026') },
    { k: t('In US dollars, January 2012'), v: wm ? '$' + nf(wm.points[0][1], 0) : '', n: t('market rate') }]) +
    `<h4 class="fb-t">${esc(t("What a month's minimum wage buys"))}</h4><p class="note">${esc(t('The decree minimum wage divided by the price at mid-year. Prices are the ministry and bakery listings in the series below; an item is left out in years with no price on record.'))}</p>
    <div class="fb-yr"><label for="costYr">${esc(t('Year'))}</label><input type="range" id="costYr" min="2011" max="2026" step="1" value="${COST.year}"><output id="costYrO" for="costYr">${fy(COST.year)}</output></div>
    <div id="costBuy"></div><div class="fb-grid" data-g></div>`;
  const draw = () => {
    const Y = COST.year, f = v => v == null ? '' : nf(v, v >= 10 ? 0 : 1);
    $('#costYrO').textContent = fy(Y);
    const wmY = fbAt(wm, Y + 0.5, 1);
    $('#costBuy').innerHTML = fbStats(BUYS.map(it => { const a = costBuy(it, 2019), b = costBuy(it, Y), c = costBuy(it, 2026); return { k: t(it.label), v: b == null ? t('no price on record') : f(b), n: [a != null ? fy(2019) + ': ' + f(a) : '', c != null ? fy(2026) + ': ' + f(c) : ''].filter(Boolean).join(' · ') }; })) +
      `<p class="note">${esc(wmY != null ? t('In {y} the minimum wage was worth about ${v} at the market rate.', { y: fy(Y), v: nf(wmY, 0) }) : t('No market-rate conversion is on record for {y}.', { y: fy(Y) }))}</p>`;
  };
  $('#costYr').addEventListener('input', ev => { COST.year = +ev.target.value; draw(); });
  draw();
  const g = el.querySelector('[data-g]');
  costCard(g, { title: t('Minimum wage in US dollars'), unit: t('USD per month'), series: [{ s: wm, label: t('At the market rate') }, { s: wu, label: t('At the official rate, to September 2019'), dash: true, to: 2019.75 }], from: 1998, gran: 'm', height: 250,
    note: t('The decree minimum for private-sector workers, converted at the monthly rate. After October 2019 the official rate is not what people paid, so the official-rate line stops there. In 2020 to 2023 a monthly market rate can be 10 to 15% off the rate on a given day, so the dollar value is approximate.') });
  costCard(g, { title: t('Petrol canisters per minimum wage'), unit: t('20 L canisters of petrol 95 that one month of the minimum wage buys'), series: [{ s: can, label: t('Canisters per month') }], height: 250, gran: 'm' });
  costCard(g, { title: t('Petrol and diesel in US dollars'), unit: t('USD per 20 L canister at the market rate, weekly'), series: [{ s: costSeries('fuel_petrol95_usd_market_20l'), label: t('Petrol 95') }, { s: costSeries('fuel_diesel_usd_market_20l'), label: t('Diesel') }], height: 250, gran: 'd',
    note: t('Ministry of Energy and Water price tables. The pound price is converted at the monthly market rate.') });
  costCard(g, { title: t('Fuel prices in pounds'), unit: t('LBP per 20 L canister, weekly, log scale'), series: [{ s: costSeries('fuel_petrol95_lbp_20l'), label: t('Petrol 95') }, { s: costSeries('fuel_diesel_lbp_20l'), label: t('Diesel') }, { s: costSeries('fuel_kerosene_lbp_20l'), label: t('Kerosene (to 2017)') }], log: true, logStart: true, gran: 'd', height: 250,
    note: t('The ministry listing has holes. Dates filled from press copies of the same table are hollow dots; the gaps that remain are joined by a straight line.') });
  costCard(g, { title: t('Household gas cylinder (10 kg)'), unit: t('USD at the market rate, weekly'), series: [{ s: costSeries('fuel_lpg10kg_usd_market'), label: t('Gas cylinder') }], gran: 'd', height: 230 });
  costCard(g, { title: t('Bread bundle in pounds'), unit: t('LBP per bundle at the bakery, price in force at each month end, log scale'), series: [{ s: costSeries('bread_standard_bundle_bakery_lbp_monthly_inforce'), label: t('Standard bundle (about 800 to 960 g)') }, { s: costSeries('bread_small_bundle_bakery_lbp'), label: t('Small bundle') }, { s: costSeries('bread_large_bundle_bakery_lbp_c'), label: t('Large bundle (to 2024)') }], log: true, logStart: true, gran: 'd', height: 250,
    note: t('Bundle weights change between decisions, so compare a series with itself, not with another bundle.'), fillNote: t('Hollow dots: months that carry a value forward over a decision we could not retrieve, or after the last decision found.') });
  costCard(g, { title: t('Bread: the set price and the shop price'), unit: t('LBP, standard bundle at the bakery and 800 g pita in shops (median of the markets WFP surveys)'), series: [{ s: costSeries('bread_standard_bundle_bakery_lbp_monthly_inforce'), label: t('Bakery price set by decision') }, { s: costSeries('bread_pita_800g_retail_median_wfp_lbp'), label: t('Shop price, 800 g pita (WFP)') }], log: true, gran: 'm', height: 250,
    note: t('The shop price runs above the bakery price set by decision, and it covers the months between decisions.') });
  costCard(g, { title: t('Bread bundle in US dollars'), unit: t('USD per medium bundle at the market rate'), series: [{ s: costSeries('bread_medium_bundle_bakery_usd_market'), label: t('Medium bundle') }], gran: 'd', height: 230 });
  costCard(g, { title: t('Generator subscription'), unit: t('LBP per month, ministry guideline fixed fee, metered subscribers, 5 A and 10 A'), series: [{ s: costSeries('gen_fixed_5a_lbp_month'), label: t('5 A') }, { s: costSeries('gen_fixed_10a_lbp_month'), label: t('10 A') }], gran: 'm', height: 230,
    note: t('Months the ministry web table leaves blank are read from its monthly statement PDFs. Per-kWh prices are in the next chart.'), fillNote: t('Hollow dots: months taken from press copies of the ministry statement, or inferred from the months either side.') });
  costCard(g, { title: t('Generator price per kWh'), unit: t('LBP per kWh, ministry guideline for metered subscribers'), series: [{ s: costSeries('gen_kwh_urban_lbp'), label: t('Cities and dense areas') }, { s: costSeries('gen_kwh_rural_lbp'), label: t('Villages, remote areas or above 700 m') }], gran: 'm', height: 230, log: true,
    note: t('The guideline is the ministry price. What operators charge can differ.') });
  costCard(g, { title: t('Generator subscription in US dollars'), unit: t('USD per month, 5 A, at the market rate'), series: [{ s: costSeries('gen_fixed_5a_usd_market'), label: t('5 A') }], gran: 'm', height: 230 });
  costCard(g, { title: t('Public pay as a multiple of the 2019 base'), unit: t('multiple of the pre-crisis base salary (civil servants, cumulative decisions)'), series: [{ s: costSeries('public_salary_multiplier_admin'), label: t('Multiple') }], gran: 'm', height: 220,
    note: t('Months for November 2022, December 2024 and March 2026 have lower confidence. The 2026 figure is decided, not necessarily paid.') });
}

function costYoY(s) {  // year-on-year change in %, from a monthly index
  const m = new Map(s.points.map(p => [p[0], p[1]])), pts = [];
  s.points.forEach(p => { const y = +p[0].slice(0, 4) - 1, q = m.get(y + p[0].slice(4)); if (q > 0 && p[1] > 0) pts.push([p[0], (p[1] / q - 1) * 100]); });
  return { id: s.id + '_yoy', label: s.label, unit: '%', points: pts, source_url: s.source_url, license: s.license, csv: s.csv, csv_id: s.csv_id || s.id };
}
function costPricesView(el) {
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const catS = id => costSeries('cpi_lebanon_' + id);
  el.innerHTML = `<p class="lead">${esc(t('The Central Administration of Statistics consumer price index, base December 2013 = 100. It is published from January 2014, by division, by region and for 101 sub-classes.'))}</p>
    <div class="d-filters"><label class="sel" for="costBase">${esc(t('Compare prices now with'))} <select id="costBase">${years.map(y => `<option value="${y}"${y === COST.base ? ' selected' : ''}>${esc(t('December {y}', { y: fy(y) }))}</option>`).join('')}</select></label></div>
    <div id="costCpiBars" class="fb-card"></div><div class="fb-grid" data-g></div><h4 class="fb-t">${esc(t('Sub-classes'))}</h4><p class="note">${esc(t('Sub-class indices were re-based in the source and some reach millions, so extreme changes below can be artefacts of re-basing. Check them against the division index above.'))}</p><div id="costSub"></div>`;
  const at = (s, y) => { const p = s.points.find(q => q[0] === y + '-12') || s.points.filter(q => q[0] <= y + '-12').pop(); return p ? p[1] : null; };
  const bars = () => {
    const b = COST.base, items = CPI_CATS.map(([id, lb]) => { const s = catS(id); if (!s) return null; const l = fbLast(s), v0 = at(s, b); return l && v0 ? { id, label: t(lb), value: l[1] / v0, hi: id === 'total' } : null; }).filter(Boolean).sort((x, y) => y.value - x.value);
    const last = fbLast(catS('total'));
    $('#costCpiBars').innerHTML = `<h4 class="fb-t">${esc(t('How much prices have risen'))}</h4><p class="fb-u mono dim">${esc(t('price level in {d} divided by December {y}', { d: last ? fbLongDate(last[0]) : '', y: fy(b) }))}</p><div id="costCpiB"></div>${fbSrcLine([catS('total')])}`;
    hubBars($('#costCpiB'), { items, fmt: mult });
  };
  $('#costBase').addEventListener('change', ev => { COST.base = +ev.target.value; bars(); });
  bars();
  const g = el.querySelector('[data-g]');
  const yoyCard = document.createElement('div'); yoyCard.className = 'fb-card wide'; g.appendChild(yoyCard);
  yoyCard.innerHTML = `<h4 class="fb-t">${esc(t('Year-on-year inflation by category'))}</h4><p class="fb-u mono dim">${esc(t('% change over 12 months, computed from the monthly index'))}</p><div class="chips sm" id="costCats" role="group" aria-label="${esc(t('Categories'))}"></div><div id="costYoY"></div><div data-src></div>`;
  const yoy = () => {
    const ids = CPI_CATS.map(c => c[0]).filter(id => COST.cats.has(id) && catS(id));
    $('#costCats').innerHTML = CPI_CATS.filter(c => catS(c[0])).map(([id, lb]) => `<button type="button" class="chip sm-c" data-c="${id}" aria-pressed="${COST.cats.has(id)}">${esc(t(lb))}</button>`).join('');
    const ss = ids.map(id => ({ s: costYoY(catS(id)), label: t(CPI_CATS.find(c => c[0] === id)[1]) }));
    const ch = $('#costYoY'); ch.innerHTML = '';
    const card = fbCard(ch, { title: t('Year-on-year inflation by category'), series: ss, gran: 'm', height: 260, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%', table: false });
    card.fig.querySelector('figcaption').remove(); card.fig.classList.add('flat');
  };
  $('#costCats').addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (!b) return; COST.cats.has(b.dataset.c) ? COST.cats.delete(b.dataset.c) : COST.cats.add(b.dataset.c); if (!COST.cats.size) COST.cats.add('total'); yoy(); });
  yoy();
  const reg = [['lebanon', t('Lebanon')], ['beirut', t('Beirut')], ['mount_lebanon', t('Mount Lebanon')], ['north', t('North')], ['bekaa', t('Bekaa')], ['south', t('South')], ['nabatieh', t('Nabatieh')]];
  fbCard(g, { title: t('All-items price index by region'), unit: t('index, December 2013 = 100, log scale'), series: reg.map(([id, lb]) => ({ s: costSeries('cpi_' + id + '_total'), label: lb })), log: true, logStart: true, gran: 'm', height: 260, note: t('The index was set to 100 in December 2013 in each region, so levels compare how fast prices rose, not how expensive each region is.') });
  fbCard(g, { title: t('Food, housing, transport and health'), unit: t('Lebanon, index, December 2013 = 100, log scale'), series: ['food', 'housing', 'transport', 'health'].map(id => ({ s: catS(id), label: t(CPI_CATS.find(c => c[0] === id)[1]) })), log: true, logStart: true, gran: 'm', height: 260 });
  fbCard(g, { title: t('Rent'), unit: t('Lebanon, index, December 2013 = 100'), series: [{ s: costSeries('cpi_lebanon_rent_old'), label: t('Old rent') }, { s: costSeries('cpi_lebanon_rent_new'), label: t('New rent') }, { s: costSeries('cpi_lebanon_rent_owner'), label: t('Owner-occupied') }], gran: 'm', height: 230, log: true });
  fbCard(g, { title: t('Month-on-month change, all items'), unit: t('%'), series: [{ s: costSeries('cpi_lebanon_total_mom'), label: t('All items') }], gran: 'm', height: 230, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
  // sub-classes: change since the chosen December, searchable
  const subs = Object.values(COST.S).filter(s => /^cpi_sub_/.test(s.id));
  const subName = s => { const m = /^CPI subclass (\d+): (.*)$/.exec(s.label); if (!m) return s.label; if (LANG === 'en') return m[1] + ': ' + m[2]; const tr = t(s.label), i = tr.indexOf(':'); return m[1] + ': ' + (i >= 0 ? tr.slice(i + 1).trim() : m[2]); };
  const el2 = $('#costSub');
  const drawSub = () => {
    const b = COST.base;
    const rows = subs.map(s => { const l = fbLast(s), v0 = at(s, b); return [subName(s), l && v0 ? l[1] / v0 : null, s.id, s]; }).filter(r => r[1] != null).sort((x, y) => y[1] - x[1]);
    el2.dataset.n = rows.length;
    el2.innerHTML = `<div class="d-filters"><label class="vh" for="costSubQ">${esc(t('Search sub-classes'))}</label><input type="search" id="costSubQ" placeholder="${esc(t('Search sub-classes'))}" autocomplete="off"><span class="mono dim" id="costSubN"></span></div><div id="costSubT"></div>${fbSrcLine([subs[0]])}`;
    const draw2 = () => {
      const w = nrm($('#costSubQ').value).split(/\s+/).filter(Boolean), list = rows.filter(r => w.every(x => nrm(r[0]).includes(x)));
      $('#costSubN').textContent = t('{a} of {b} series', { a: nf(Math.min(40, list.length)), b: nf(list.length) });
      $('#costSubT').innerHTML = fbTable([{ h: t('Sub-class') }, { h: t('Change since December {y}', { y: fy(b) }), cls: 'num' }], list.slice(0, 40).map(r => [r[0], mult(r[1])]), {});
    };
    $('#costSubQ').addEventListener('input', draw2); draw2();
  };
  if (subs.length) drawSub(); else el2.innerHTML = '';
  $('#costBase').addEventListener('change', () => { if (subs.length) drawSub(); });
}

/* ---------- public money (D7) ---------- */
function costMoneyView(el) {
  el.innerHTML = '';
  fbLoad(el, ['data/money/series.json', 'data/money/events.json'], (ms, ev) => {
    const M = fbIndex([ms]), s = id => M[id], def = [{ x: fbT('2020-03-09'), label: t('Eurobond default') }];
    const wr = fbLast(s('d7-weo-gross-debt-pct-gdp')), res = fbLast(s('d7-bdl-reserves-total-gold-mv')), dep = fbLast(s('d7-abl-res-dep-usd')), eu = fbLast(s('d7-mof-eurobonds-usd-derived'));
    el.innerHTML = `<p class="lead">${esc(t('Budgets, public debt, central bank reserves and banks. Pound amounts after 2019 are nominal at a moving exchange rate: compare them across years only with care, or use the percent-of-GDP and dollar series.'))}</p>` + fbStats([
      { k: t('Gross public debt, % of GDP'), v: wr ? nf(wr[1], 0) + '%' : '', n: t('IMF World Economic Outlook, {y}', { y: wr ? fy(wr[0]) : '' }) },
      { k: t('Central bank reserves with gold'), v: res ? '$' + nf(res[1] / 1000, 1) + t('bn') : '', n: t('IMF, {d}', { d: res ? fbLongDate(res[0]) : '' }) },
      { k: t('Resident deposits in banks'), v: dep ? '$' + nf(dep[1] / 1000, 1) + t('bn') : '', n: t('at the legal rate, {d}', { d: dep ? fbLongDate(dep[0]) : '' }) },
      { k: t('Eurobonds incl. interest'), v: eu ? '$' + nf(eu[1] / 1000, 1) + t('bn') : '', n: t('Ministry of Finance, end {y}', { y: eu ? fy(eu[0]) : '' }) }]) + '<div class="fb-grid" data-g></div>';
    const g = el.querySelector('[data-g]'), C = (o) => fbCard(g, o);
    C({ title: t('Public debt'), unit: t('% of GDP'), series: [{ s: s('d7-weo-gross-debt-pct-gdp'), label: t('Gross debt, IMF') }, { s: s('d7-weo-net-debt-pct-gdp'), label: t('Net debt, IMF') }, { s: s('d7-mof-gross-debt-pct-gdp'), label: t('Gross debt, Ministry of Finance'), dash: true }], gran: 'y', height: 250, markers: def, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 0) + '%',
      note: t('IMF figures for recent years are estimates; the vintage is not labelled in the API.') });
    C({ title: t('Revenue and spending'), unit: t('general government, % of GDP'), series: [{ s: s('d7-weo-revenue-pct-gdp'), label: t('Revenue') }, { s: s('d7-weo-expenditure-pct-gdp'), label: t('Expenditure') }], gran: 'y', height: 250, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
    C({ title: t('Deficit'), unit: t('% of GDP'), series: [{ s: s('d7-weo-balance-pct-gdp'), label: t('Overall balance') }, { s: s('d7-weo-primary-balance-pct-gdp'), label: t('Primary balance') }], gran: 'y', height: 230, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
    C({ title: t('Central bank reserves'), unit: t('USD million, monthly, 1980 to March 2025'), series: [{ s: s('d7-bdl-reserves-total-gold-mv'), label: t('With gold at market value') }, { s: s('d7-bdl-reserves-excl-gold'), label: t('Without gold') }], gran: 'm', height: 250,
      note: t('The central bank changed the definition of foreign-currency reserves in January 2024, so the later bank-association series is not comparable.') });
    C({ title: t('Deposits in commercial banks'), unit: t('USD million at the legal rate, monthly'), series: [{ s: s('d7-abl-res-dep-usd'), label: t('Resident, all currencies') }, { s: s('d7-abl-res-dep-fc-usd'), label: t('Resident, foreign currency') }, { s: s('d7-abl-nr-dep-usd'), label: t('Non-resident') }], gran: 'm', height: 250,
      note: t('Pound balances are converted at the legal rate (89,500 from 2024), an accounting value rather than a market one.') });
    C({ title: t('Foreign-currency deposits, weekly'), unit: t('USD million, resident private sector'), series: [{ s: s('d7-abl-res-dep-fc-weekly-usd'), label: t('Resident foreign-currency deposits') }], gran: 'd', height: 220 });
    C({ title: t('Banks before the crisis'), unit: t('%, 2010 to 2019'), series: [{ s: s('d7-banks-npl-ratio'), label: t('Non-performing loans, % of loans') }, { s: s('d7-banks-regulatory-capital-ratio'), label: t('Capital to risk-weighted assets') }, { s: s('d7-banks-fx-loans-share'), label: t('Foreign-currency loans, % of loans') }], gran: 'y', height: 240, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
    C({ title: t('External debt'), unit: t('USD million'), series: [{ s: s('d7-wb-external-debt'), label: t('Total external debt') }, { s: s('d7-wb-external-debt-ppg'), label: t('Public and publicly guaranteed') }, { s: s('d7-wb-external-debt-service'), label: t('Debt service') }], gran: 'y', height: 250 });
    C({ title: t('Eurobonds'), unit: t('USD million, incl. accrued interest, end of year'), series: [{ s: s('d7-mof-eurobonds-usd-derived'), label: t('Eurobonds outstanding') }, { s: s('d7-mof-eurobond-arrears-usd-derived'), label: t('Arrears') }], gran: 'y', height: 230,
      note: t('Derived from Ministry of Finance pound amounts at its end-of-period rate. Principal is US$31.3 billion.') });
    C({ title: t('Interest payments'), unit: t('% of government revenue'), series: [{ s: s('d7-wb-interest-pct-revenue'), label: t('Interest, % of revenue') }], gran: 'y', height: 220, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
    C({ title: t('Budget laws'), unit: t('LBP billion, as voted'), series: [{ s: s('d7-budget-law-revenue'), label: t('Revenue') }, { s: s('d7-budget-law-expenditure'), label: t('Expenditure') }, { s: s('d7-budget-law-deficit'), label: t('Deficit') }], gran: 'y', height: 250,
      note: t('Nominal pounds: the pound lost most of its value from 2019, so later laws are not comparable with earlier ones. No budget law was found for 1993 to 1997, 2006 to 2017 and 2021.') });
    C({ title: t('Gross domestic product'), unit: t('USD million, nominal, IMF'), series: [{ s: s('d7-weo-gdp-usd'), label: t('GDP') }], gran: 'y', height: 230 });
    const evs = (ev && ev.events) || [];
    if (evs.length) {
      const d = document.createElement('div'); d.className = 'fb-card wide';
      d.innerHTML = `<h4 class="fb-t">${esc(t('Dated events'))}</h4><ul class="fb-ev">${evs.slice().sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1).map(e => `<li><span class="mono">${esc(fbLongDate(e.date))}</span> ${th(e.title)}${e.source && /^https?:/.test(e.source) ? ` <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(e.source))}</a>` : ''}</li>`).join('')}</ul><p class="note">${esc(t('Source and licence are the page linked on each line; the compilation is CC BY-SA 4.0.'))}</p>`;
      g.appendChild(d);
    }
    el.insertAdjacentHTML('beforeend', `<p class="note">${esc(t('IMF series carry the IMF terms of use; World Bank series are CC BY 4.0; Ministry of Finance and bank-association figures state no licence. Left out: commercial price histories (Bloomberg, CEIC).'))}</p>`);
  });
}

/* ---------- compare any series: search every series the Lebanese tabs publish, plot up to six, index them to 100, see how they move together ---------- */
const XPL = { ids: [], idx: false, log: false, q: '', all: null };
const XPL_FILES = ['data/cost/fx.json', 'data/cost/prices.json', 'data/money/series.json', 'data/electricity/power.json', 'data/electricity/nightlights.json', 'data/climate/climate.json', 'data/people/series.json', 'data/war/series.json'];
const XPL_GROUP = { fx: N('Exchange rates'), prices: N('Prices'), money: N('Public money'), power: N('Electricity'), nightlights: N('Night lights'), climate: N('Climate'), people: N('People'), war: N('The 2023 to 2026 war') };
function costExploreView(el, preset) {
  if (preset && preset.length) XPL.ids = preset.slice(0, 6);
  el.innerHTML = `<p class="lead">${esc(t('Pick any of the series the Lebanese tabs publish, put up to six on one chart, and compare how they moved. Series with different units are shown as an index, so you compare change and never two axes.'))}</p><div id="xplBody"></div>`;
  const body = $('#xplBody');
  const loadAll = () => Promise.all(XPL_FILES.map(f => hubLoad(f).then(o => (o.series || []).map(s => Object.assign({}, s, { _g: f.split('/').pop().replace('.json', '').replace('series', f.includes('people') ? 'people' : f.includes('war') ? 'war' : 'money') })), () => [])));
  fbLoad(body, ['data/cost/fx.json'], () => loadAll().then(parts => {
    if (!body.isConnected) return;
    XPL.all = [].concat(...parts);
    XPL.ids = XPL.ids.filter(id => XPL.all.some(s => s.id === id));
    body.innerHTML = `<h4 class="fb-t">${esc(t('Your chart'))}</h4><div class="chips sm" id="xplSel" role="group" aria-label="${esc(t('Chosen series'))}"></div>
      <div class="d-filters"><label class="mp-chk"><input type="checkbox" id="xplIdx"> ${esc(t('Index to 100 at the first date they share'))}</label><label class="mp-chk"><input type="checkbox" id="xplLog"> ${esc(t('Log scale'))}</label></div><div id="xplChart"></div><div id="xplStat"></div>
      <div class="d-filters"><label class="vh" for="xplQ">${esc(t('Search series'))}</label><input id="xplQ" type="search" autocomplete="off" placeholder="${esc(t('Search series'))}" value="${esc(XPL.q)}"><span class="mono dim" id="xplN"></span></div><ul class="fb-brl" id="xplRes"></ul>`;
    const sel = () => XPL.ids.map(id => XPL.all.find(s => s.id === id)).filter(Boolean);
    const units = () => new Set(sel().map(s => s.unit));
    const draw = () => {
      const S = sel(), mixed = units().size > 1, idx = XPL.idx || mixed;
      $('#xplIdx').checked = idx; $('#xplIdx').disabled = mixed; $('#xplLog').checked = XPL.log;
      $('#xplSel').innerHTML = S.map(s => `<button type="button" class="chip sm-c" data-rm="${esc(s.id)}" aria-label="${esc(t('Remove {s}', { s: t(s.label) }))}">${esc(t(s.label).slice(0, 48))} ×</button>`).join('') || `<span class="note">${esc(t('Nothing chosen yet: use Add on a series above.'))}</span>`;
      HUB.setHash('cost', 'explore', ...(XPL.ids.length ? [XPL.ids.join(',')] : []));
      const ch = $('#xplChart'); ch.innerHTML = ''; $('#xplStat').innerHTML = '';
      if (!S.length) return;
      let ser = S.map(s => ({ s, label: t(s.label).slice(0, 60) }));
      if (idx) {
        const t0 = Math.max(...S.map(s => fbPts(s)[0][0])), t1 = Math.min(...S.map(s => fbPts(s)[fbPts(s).length - 1][0]));
        ser = S.map(s => { const base = fbAt(s, t0 + 1e-6, 100); const pts = fbPts(s).filter(p => p[0] >= t0 && p[0] <= t1); return { s: Object.assign({}, s, { _p: pts.map(p => [p[0], base ? p[1] / base * 100 : NaN]).filter(p => Number.isFinite(p[1])), points: pts.map(p => [p[0] + '', base ? p[1] / base * 100 : null]) }), label: t(s.label).slice(0, 60) }; });
        ser.forEach(x => { x.s._p = x.s._p; });
      }
      fbCard(ch, { title: idx ? t('Index, 100 at the first shared date') : (S[0].unit ? t(S[0].unit) : t('Series')), unit: idx ? t('index') : t(S[0].unit), series: ser, gran: 'm', height: 300, log: false, logStart: XPL.log, yFmt: undefined, table: false });
      const logCtl = ch.querySelector('[data-log]'); if (logCtl) logCtl.remove();
      if (S.length >= 2) {
        const a0 = S[0], b0 = S[1], y0 = Math.ceil(Math.max(fbPts(a0)[0][0], fbPts(b0)[0][0])), y1 = Math.floor(Math.min(fbPts(a0)[fbPts(a0).length - 1][0], fbPts(b0)[fbPts(b0).length - 1][0])), ys = [];
        for (let y = y0; y <= y1; y++) ys.push(y);
        const r = pearson(ys.map(y => fbAt(a0, y + 0.99, 1.5) ?? NaN), ys.map(y => fbAt(b0, y + 0.99, 1.5) ?? NaN));
        $('#xplStat').innerHTML = `<p class="note">${esc(r.r == null ? t('Not enough shared years to compute a correlation.') : t('Correlation of the first two series on yearly values: r = {r} over {n} shared years. A correlation is not a cause: series that both rise over time correlate strongly.', { r: fmt(r.r, 2), n: nf(r.n) }))}</p>`;
      }
    };
    const list = () => {
      const w = nrm(XPL.q).split(/\s+/).filter(Boolean), found = XPL.all.filter(s => w.every(x => nrm(s.label + ' ' + s.id + ' ' + (s.unit || '')).includes(x)) && !XPL.ids.includes(s.id));
      $('#xplN').textContent = t('{a} of {b} series', { a: nf(Math.min(10, found.length)), b: nf(found.length) });
      $('#xplRes').innerHTML = found.slice(0, 10).map(s => `<li class="fb-br"><div class="fb-br-t"><b>${th(s.label)}</b> <span class="chip sm-c fb-tag">${esc(t(XPL_GROUP[s._g] || s._g))}</span></div><div class="fb-br-m mono dim">${esc(s.unit || '')} · ${esc(s.points[0][0])} to ${esc(s.points[s.points.length - 1][0])}</div><div class="fb-br-l"><button type="button" class="chip sm-c" data-add="${esc(s.id)}"${XPL.ids.length >= 6 ? ' disabled' : ''}>${esc(t('Add'))}</button></div></li>`).join('') || `<li class="hub-empty">${esc(t('No series match.'))}</li>`;
    };
    $('#xplQ').addEventListener('input', ev => { XPL.q = ev.target.value; list(); });
    $('#xplRes').addEventListener('click', ev => { const b = ev.target.closest('[data-add]'); if (b && XPL.ids.length < 6) { XPL.ids.push(b.dataset.add); list(); draw(); } });
    $('#xplSel').addEventListener('click', ev => { const b = ev.target.closest('[data-rm]'); if (b) { XPL.ids = XPL.ids.filter(i => i !== b.dataset.rm); list(); draw(); } });
    $('#xplIdx').addEventListener('change', ev => { XPL.idx = ev.target.checked; draw(); });
    $('#xplLog').addEventListener('change', ev => { XPL.log = ev.target.checked; draw(); });
    list(); draw();
  }));
}
/* ---------- food security (v10): WFP food prices (data/cost/food.json) and IPC acute food insecurity (data/cost/ipc.json) ---------- */
const FOOD = { item: 'bread_pita_800_g', area: 'national', cur: 'lbp', ipc: '', grp: 'all', all: false };
const FOOD_ITEMS = [['bread_pita_800_g', N('Pita bread, 800 g')], ['wheat_flour_900_g', N('Wheat flour, 900 g')], ['rice_imported_egyptian_900_g', N('Egyptian rice, 900 g')], ['pasta_spaghetti_500_g', N('Spaghetti, 500 g')],
  ['bulgur_brown_900_g', N('Brown bulgur, 900 g')], ['sugar_white_5_kg', N('White sugar, 5 kg')], ['salt_700_g', N('Salt, 700 g')], ['tea_160_g', N('Tea, 160 g')], ['oil_sunflower_5_l', N('Sunflower oil, 5 L')],
  ['eggs_30_pcs', N('Eggs, 30 pieces')], ['milk_powder_750_g', N('Powdered milk, 750 g')], ['cheese_picon_160_g', N('Picon cheese, 160 g')], ['meat_chicken_whole_frozen_kg', N('Whole frozen chicken, per kg')],
  ['meat_beef_canned_200_g', N('Canned beef, 200 g')], ['fish_sardine_canned_125_g', N('Canned sardines, 125 g')], ['fish_tuna_canned_185_g', N('Canned tuna, 185 g')], ['beans_white_900_g', N('White beans, 900 g')],
  ['chickpeas_900_g', N('Chickpeas, 900 g')], ['lentils_900_g', N('Lentils, 900 g')], ['lentils_green_kg', N('Green lentils, per kg')], ['lentils_red_kg', N('Red lentils, per kg')],
  ['tomatoes_paste_660_g', N('Tomato paste, 660 g')], ['potatoes_kg', N('Potatoes, per kg')], ['carrots_kg', N('Carrots, per kg')], ['cabbage_kg', N('Cabbage, per kg')], ['cucumbers_greenhouse_kg', N('Greenhouse cucumbers, per kg')],
  ['lettuce_head', N('Lettuce, per head')], ['spinach_kg', N('Spinach, per kg')], ['apples_kg', N('Apples, per kg')],
  ['fuel_petrol_gasoline_95_octane_20_l', N('Petrol 95, 20 L (WFP survey)')], ['fuel_diesel_20_l', N('Diesel, 20 L (WFP survey)')], ['fuel_gas_10_kg', N('Cooking gas, 10 kg (WFP survey)')]];
const FOOD_AREAS = [['beirut', N('Beirut')], ['mount_lebanon', N('Mount Lebanon')], ['north', N('North')], ['akkar', N('Akkar')], ['baalbek_hermel', N('Baalbek-Hermel')], ['bekaa', N('Bekaa')], ['south', N('South')], ['nabatieh', N('Nabatieh')]];
const FOOD_ID = /^food_(.+)_(lbp|usd)_(national|beirut|mount_lebanon|north|akkar|baalbek_hermel|bekaa|south|nabatieh)$/;
function foodIndex(list) {
  const m = new Map();
  (list.series || list).forEach(s => { const x = FOOD_ID.exec(s.id); if (x) m.set(x[1] + '|' + x[2] + '|' + x[3], s); });
  return m;
}
function foodRuns(s, label, color, split) {  // split: a gap of more than six months breaks the line (WFP dollar prices skip Sep 2019 to Feb 2024, and a straight line across would invent them)
  const runs = [];
  s.points.forEach((p, i) => { if (!i || (split && fbT(p[0]) - fbT(s.points[i - 1][0]) > 0.5)) runs.push([]); runs[runs.length - 1].push(p); });
  return runs.map((pts, i) => ({ s: Object.assign({}, s, { id: s.id + '#' + i, csv_id: s.csv_id || s.id, points: pts, _p: null }), color,
    label: runs.length > 1 ? label + ', ' + t('{a} to {b}', { a: fbLongDate(pts[0][0]), b: fbLongDate(pts[pts.length - 1][0]) }) : label }));
}
function foodPrices(el, F) {
  const idx = foodIndex(F), has = (it, cur, ar) => idx.get(it + '|' + cur + '|' + ar);
  const items = FOOD_ITEMS.filter(x => has(x[0], 'lbp', 'national')), nm = id => { const x = FOOD_ITEMS.find(y => y[0] === id); return x ? t(x[1]) : id; };
  if (!items.some(x => x[0] === FOOD.item)) FOOD.item = items.length ? items[0][0] : '';
  const areaName = a => a === 'national' ? t('Lebanon, national median') : t(FOOD_AREAS.find(x => x[0] === a)[1]);
  el.innerHTML = `<div class="d-filters fd-ctl"><label class="sel" for="foodItem">${esc(t('Commodity'))} <select id="foodItem">${items.map(x => `<option value="${x[0]}">${esc(t(x[1]))}</option>`).join('')}</select></label>
    <label class="sel" for="foodCur">${esc(t('Price in'))} <select id="foodCur"><option value="lbp">${esc(t('Lebanese pounds'))}</option><option value="usd">${esc(t('US dollars'))}</option></select></label>
    <label class="sel" for="foodArea">${esc(t('Where'))} <select id="foodArea"></select></label></div><div id="foodNow"></div><div id="foodChart" class="fb-grid one"></div>`;
  const draw = () => {
    const it = FOOD.item, cur = FOOD.cur;
    const ars = ['national'].concat(FOOD_AREAS.map(x => x[0]).filter(a => has(it, cur, a)));
    if (FOOD.area === 'compare' ? ars.length <= 2 : !ars.includes(FOOD.area)) FOOD.area = 'national';
    $('#foodItem').value = it; $('#foodCur').value = cur;
    $('#foodArea').innerHTML = ars.map(a => `<option value="${a}">${esc(areaName(a))}</option>`).join('') + (ars.length > 2 ? `<option value="compare">${esc(t('All governorates side by side'))}</option>` : '');
    $('#foodArea').value = FOOD.area;
    const ch = $('#foodChart'); ch.innerHTML = '';
    const cmp = FOOD.area === 'compare', one = has(it, cur, cmp ? 'national' : FOOD.area);
    const unitTxt = cur === 'lbp' ? t('Lebanese pounds, monthly median across the markets surveyed') : t('US dollars at the official rate, monthly median across the markets surveyed');
    if (!one) { $('#foodNow').innerHTML = `<p class="hub-empty">${esc(t('No price on record for this choice.'))}</p>`; return; }
    let ser = [];
    if (cmp) {
      ser = ars.filter(a => a !== 'national').flatMap((a, i) => { const r = foodRuns(has(it, cur, a), areaName(a), HUB_COLORS[i % HUB_COLORS.length], cur === 'usd'); return [r[r.length - 1]]; });
      const nat = foodRuns(has(it, cur, 'national'), areaName('national'), 'var(--ink-3)', cur === 'usd'); const last = nat[nat.length - 1]; last.dash = true; ser.push(last);
    } else ser = foodRuns(one, areaName(FOOD.area), HUB_COLORS[0], cur === 'usd');
    const lp = fbLast(one), prev = lp && one.points.find(p => p[0] === (+lp[0].slice(0, 4) - 1) + lp[0].slice(4)), first = one.points[0];
    const vf = v => cur === 'usd' ? '$' + nf(v, v < 10 ? 2 : 1) : nf(v, 0);
    $('#foodNow').innerHTML = fbStats([
      { k: t('Latest price'), v: lp ? vf(lp[1]) : '', n: (cmp ? areaName('national') + ', ' : '') + (lp ? fbLongDate(lp[0]) : '') },
      { k: t('A year earlier'), v: prev ? vf(prev[1]) : t('no price on record'), n: prev ? fbLongDate(prev[0]) : '' },
      { k: t('Change since the first month on record'), v: lp && first && first[1] > 0 ? mult(lp[1] / first[1]) : '', n: t('from {d}', { d: fbLongDate(first[0]) }) + (cur === 'lbp' ? ', ' + t('how many times more pounds it costs') : '') }]);
    const card = fbCard(ch, { title: nm(it) + (cmp ? ', ' + t('by governorate') : ''), unit: unitTxt, series: ser, gran: 'm', height: 300, log: cur === 'lbp', logStart: cur === 'lbp', yFmt: v => cur === 'usd' ? '$' + nf(v, v < 10 ? 1 : 0) : nfCompact(v), valFmt: vf,
      note: t('Each point is the median of the retail prices the surveyed markets reported that month. The set of markets changes over time, so a step can reflect coverage as much as price.') + (cur === 'usd' ? ' ' + t('WFP converts pounds to dollars at the official rate. From September 2019 to February 2024 that rate was far from what people paid, so those months are left out and the line is broken, not joined.') + (cmp ? ' ' + t('Only the latest run of each governorate is drawn; choose one governorate to see the earlier months.') : '') : '') });
    card.fig.classList.add('wide');
  };
  $('#foodItem').addEventListener('change', ev => { FOOD.item = ev.target.value; draw(); });
  $('#foodCur').addEventListener('change', ev => { FOOD.cur = ev.target.value; draw(); });
  $('#foodArea').addEventListener('change', ev => { FOOD.area = ev.target.value; draw(); });
  draw();
}
const IPC_MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const IPC_GRP = { lebanese: N('Lebanese residents'), syrian: N('Syrian refugees'), newsyr: N('Newly displaced Syrians'), palestinian: N('Palestinian refugees'), other: N('Other groups') };
const IPC_PH = [['1', N('Minimal or none'), 'color-mix(in srgb, var(--bad) 12%, var(--paper))'], ['2', N('Stressed'), 'color-mix(in srgb, var(--bad) 30%, var(--paper))'], ['3', N('Crisis'), 'color-mix(in srgb, var(--bad) 52%, var(--paper))'],
  ['4', N('Emergency'), 'color-mix(in srgb, var(--bad) 76%, var(--paper))'], ['5', N('Catastrophe'), 'var(--bad)']];   // one hue, darker with severity: the phase is also written out beside every swatch
const IPC_FIX = { Baadba: 'Baabda', Baaldek: 'Baalbek', Jbell: 'Jbeil', Zahie: 'Zahle', Rashaya: 'Rachaya' };
const IPC_PL = { 'bent jbeil': 'Bint Jbeil', 'el batroun': 'Batroun', 'el hermel': 'Hermel', 'el koura': 'Koura', 'el meten': 'Metn', 'el minieh-dennie': 'Minieh-Dennieh', 'el nabatieh': 'Nabatieh', kesrwane: 'Keserwan', marjaayoun: 'Marjayoun', 'west bekaa': 'West Bekaa', 'bcharre-zgharta': ['Bcharre', 'Zgharta'] };
const IPC_PAL = { 'lebanon - palestinians': 'Palestinian refugees in Lebanon', 'palestinian refugees in lebanon': 'Palestinian refugees in Lebanon', 'palestinian refugees in lebanon (prl)': 'Palestinian refugees in Lebanon', 'palestinian refugees from syria (prs)': 'Palestinian refugees from Syria', 'palestinian refugees': 'Palestinian refugees' };
const IPC_PN = [N('Rachaya'), N('Palestinian refugees in Lebanon'), N('Palestinian refugees from Syria')];   // place names that no other tab translates
function ipcPlaces(base) {   // district names as the Hub spells them, in the page language, one by one when the source joins several
  const k = base.toLowerCase(), one = x => { const c = IPC_PL[x.trim().toLowerCase()] || x.trim(); return DN[c] ? dnName(c) : t(c); };
  if (IPC_PAL[k]) return t(IPC_PAL[k]);
  if (Array.isArray(IPC_PL[k])) return IPC_PL[k].map(one).join(' - ');
  return base.split(/\s+-\s+|\s*&\s*/).map(one).join(base.includes('&') ? ' & ' : ' - ');
}
const ipcYm = a => { const m = /^(\w{3}) (\d{4})$/.exec(a); return m ? m[2] + '-' + (IPC_MON[m[1]] || '01') : a; };   // "Mar 2026" -> "2026-03"
const ipcKey = r => r.analysis + '|' + r.validity;
function ipcClass(raw) {
  if (/palestin|_prl|\bprs\b|\bprl\b/i.test(raw)) return 'palestinian';
  if (/new refugees|newly displaced/i.test(raw)) return 'newsyr';
  if (/\bsyr\b|syrian|refugees/i.test(raw)) return 'syrian';
  if (/^others?$/i.test(raw.trim())) return 'other';
  return 'lebanese';
}
function ipcName(r) {   // the area as the source names it, with its population group spelled out and obvious typos corrected
  let a = (r.area || '').trim();
  if (/^(lebanese residents|syrian refugees)$/i.test(a) && r.group) a = r.group + ' ' + a;
  const c = ipcClass(a), base = a.replace(/\s+-\s+(Leb|Syr)( \(new refugees\))?$/i, '').replace(/\s+(Syrian Refugees|Lebanese Residents|Refugees)$/i, '').replace(/_PRL$/, '').replace(/^_/, '').replace(/\s+/g, ' ').trim()
    .replace(/\b(Baadba|Baaldek|Jbell|Zahie|Rashaya)\b/gi, m => IPC_FIX[m[0].toUpperCase() + m.slice(1).toLowerCase()] || m);
  const nm = ipcPlaces(base);
  return { c, name: /palestin|^others?$/i.test(base) || /^(lebanese residents|syrian refugees)$/i.test(base) ? nm : nm + ' (' + t(IPC_GRP[c]) + ')' };
}
const ipcWhen = r => t('{a} to {b}', { a: fbLongDate(r.from.slice(0, 7)), b: fbLongDate(r.to.slice(0, 7)) });
const ipcLabel = r => t('{a} analysis, {v}', { a: fbLongDate(ipcYm(r.analysis)), v: r.validity === 'current' ? t('current period') : t('projection') }) + ': ' + ipcWhen(r);
function foodIpc(el, I) {
  const nat = I.national.slice().sort((x, y) => ipcYm(y.analysis).localeCompare(ipcYm(x.analysis)) || x.from.localeCompare(y.from));   // latest analysis first; its current period before its projection
  if (!nat.some(r => ipcKey(r) === FOOD.ipc)) FOOD.ipc = ipcKey(nat[0]);
  const lat = nat[0], prv = nat.find(r => r.analysis !== lat.analysis && r.validity === 'current') || nat[1];
  const ph = r => r.phase['3+'] || [0, 0], pc = v => nf(v * 100, 0) + '%';
  el.innerHTML = fbStats([
    { k: t('In crisis or worse (IPC phase 3 or above)'), v: pc(ph(lat)[1]), n: ipcLabel(lat) },
    { k: t('People in crisis or worse'), v: nf(ph(lat)[0], 0), n: t('IPC estimate, not a count') },
    { k: t('In emergency (phase 4)'), v: lat.phase['4'] ? nf(lat.phase['4'][0], 0) : '', n: t('people') },
    { k: t('Previous analysis'), v: prv ? pc(ph(prv)[1]) : '', n: prv ? ipcLabel(prv) : '' }]) +
    `<p class="note">${esc(t('The IPC classifies people into five phases of acute food insecurity. Phase 3 (crisis) and above is the usual headline figure. These are IPC estimates (IPC, FAO, WFP and partners), not counts of people.'))}</p>
    <div class="d-filters fd-ctl"><label class="sel" for="foodIpc">${esc(t('Analysis and period'))} <select id="foodIpc">${nat.map(r => `<option value="${esc(ipcKey(r))}">${esc(ipcLabel(r))}</option>`).join('')}</select></label></div>
    <div class="fb-grid"><div class="fb-card" id="foodStack"></div><div class="fb-card" id="foodTrend"></div></div><h4 class="fb-t">${esc(t('By area'))}</h4><div class="chips sm" id="foodGrp" role="group" aria-label="${esc(t('Population group'))}"></div><div id="foodBars" class="fb-card"></div>
    ${fbSrcLine([{ source_url: I.source, license: I.license, csv: 'csv/ipc.csv', id: 'ipc' }])}`;
  const sel = () => nat.find(r => ipcKey(r) === FOOD.ipc);
  const draw = () => {
    const cur = sel(), seg = IPC_PH.filter(p => cur.phase[p[0]] && cur.phase[p[0]][1] > 0);
    $('#foodIpc').value = FOOD.ipc;
    $('#foodStack').innerHTML = `<h4 class="fb-t">${esc(t('The whole country'))}</h4><p class="fb-u mono dim">${esc(ipcLabel(cur))}</p>
      <div class="fd-stack" role="img" aria-label="${esc(t('Share of people in each IPC phase'))}">${seg.map(p => `<i style="flex:${cur.phase[p[0]][1]};background:${p[2]}"></i>`).join('')}</div>
      <ul class="fd-leg">${IPC_PH.map(p => cur.phase[p[0]] ? `<li><span class="fd-sw" style="background:${p[2]}"></span><span>${esc(t('Phase {n}', { n: nf(+p[0], 0) }))}, ${esc(t(p[1]))}</span><span class="mono">${esc(pc(cur.phase[p[0]][1]))} · ${esc(nf(cur.phase[p[0]][0], 0))}</span></li>` : '').join('')}</ul>`;
    $('#foodTrend').innerHTML = `<h4 class="fb-t">${esc(t('Country total over time'))}</h4><p class="fb-u mono dim">${esc(t('share of people in crisis or worse, by analysis and period'))}</p><div id="foodTrendB"></div>`;
    const chron = nat.slice().sort((x, y) => x.from.localeCompare(y.from) || ipcYm(x.analysis).localeCompare(ipcYm(y.analysis)));
    hubBars($('#foodTrendB'), { items: chron.map(r => ({ id: ipcKey(r), label: ipcLabel(r), value: ph(r)[1] * 100, hi: ipcKey(r) === FOOD.ipc })), fmt: v => nf(v, 0) + '%' });
    const rows = I.areas.filter(r => ipcKey(r) === FOOD.ipc && r.phase['3+']).map(r => Object.assign({ n: ipcName(r) }, { r }));
    const grps = [...new Set(rows.map(x => x.n.c))];
    if (FOOD.grp !== 'all' && !grps.includes(FOOD.grp)) FOOD.grp = 'all';
    $('#foodGrp').innerHTML = [['all', t('All groups')]].concat(Object.keys(IPC_GRP).filter(g => grps.includes(g)).map(g => [g, t(IPC_GRP[g])])).map(([g, lb]) => `<button type="button" class="chip sm-c" data-g="${g}" aria-pressed="${g === FOOD.grp}">${esc(lb)}</button>`).join('');
    const list = rows.filter(x => FOOD.grp === 'all' || x.n.c === FOOD.grp).sort((a, b) => b.r.phase['3+'][1] - a.r.phase['3+'][1] || b.r.phase['3+'][0] - a.r.phase['3+'][0]);
    const shown = FOOD.all ? list : list.slice(0, 15), skipped = I.areas.filter(r => ipcKey(r) === FOOD.ipc && !r.phase['3+']).length;
    $('#foodBars').innerHTML = `<p class="fb-u mono dim">${esc(t('share of people in crisis or worse (phase 3 or above), highest first'))}</p><div id="foodBarsB"></div>${list.length > 15 ? `<button type="button" class="chip" id="foodAll">${esc(FOOD.all ? t('Show fewer') : t('Show all {n} areas', { n: nf(list.length) }))}</button>` : ''}
      <p class="note">${esc(t('Areas are the analysis units each IPC round used, and they differ between rounds: from March 2025 some districts are grouped, and from October 2025 each district is split by population group. Compare areas within one round; across rounds compare the country total. Area names are the source\'s, with obvious typos corrected.'))}${skipped ? ' ' + esc(tp('{n} area has no phase split in the source and is left out.', '{n} areas have no phase split in the source and are left out.', skipped)) : ''}</p>
      <details class="fb-det"><summary>${esc(t('Show the data table'))}</summary>${fbTable([{ h: t('Area') }, { h: t('People analysed'), cls: 'num', fmt: v => nf(v, 0) }, { h: t('People in phase 3 or above'), cls: 'num', fmt: v => nf(v, 0) }, { h: t('Share in phase 3 or above'), cls: 'num', fmt: v => pc(v) }, { h: t('People in phase 4'), cls: 'num', fmt: v => nf(v, 0) }],
        list.map(x => [x.n.name, (x.r.phase.all || [0])[0], x.r.phase['3+'][0], x.r.phase['3+'][1], x.r.phase['4'] ? x.r.phase['4'][0] : 0]), {})}</details>`;
    hubBars($('#foodBarsB'), { items: shown.map(x => ({ id: x.n.name, label: x.n.name, value: x.r.phase['3+'][1] * 100 })), fmt: v => nf(v, 0) + '%' });
    const more = $('#foodAll'); if (more) more.addEventListener('click', () => { FOOD.all = !FOOD.all; draw(); });
  };
  $('#foodIpc').addEventListener('change', ev => { FOOD.ipc = ev.target.value; FOOD.all = false; draw(); });
  $('#foodGrp').addEventListener('click', ev => { const b = ev.target.closest('[data-g]'); if (b) { FOOD.grp = b.dataset.g; FOOD.all = false; draw(); } });
  draw();
}
function costFoodView(el) {
  const inl = (D.tabs.cost || {});
  el.innerHTML = `<p class="lead">${esc(t('Food security in Lebanon: what a basket of staple foods costs, from the WFP market surveys, and how many people the IPC classifies as acutely food insecure, by area and period.'))}</p>
    <h3 class="d-h">${esc(t('Food prices'))}</h3><div id="foodP"></div><h3 class="d-h">${esc(t('Acute food insecurity (IPC)'))}</h3><div id="foodI"></div>`;
  if (inl.food) fbLoad($('#foodP'), ['data/cost/food.json'], F => foodPrices($('#foodP'), F)); else $('#foodP').innerHTML = `<p class="hub-empty">${esc(t('No food price data is in this build.'))}</p>`;
  if (inl.ipc) fbLoad($('#foodI'), ['data/cost/ipc.json'], I => foodIpc($('#foodI'), I)); else $('#foodI').innerHTML = `<p class="hub-empty">${esc(t('No IPC data is in this build.'))}</p>`;
}
const COST_RENDER = { fx: costFx, wages: costWages, prices: costPricesView, food: costFoodView, money: costMoneyView, explore: costExploreView };
HUB.tab('cost', { render(args, info) {
  const root = $('#costRoot');
  if (!root || !(D.tabs.cost && (D.tabs.cost.fx || D.tabs.cost.prices))) return;
  let v = info.route === 'money' ? 'money' : (COST_VIEWS.some(x => x.id === args[0]) ? args[0] : (info.lang ? COST.view : 'fx'));
  COST.view = v;
  const pre = v === 'explore' && args[1] ? args[1].split(',').filter(Boolean) : null;
  fbLoad(root, ['data/cost/fx.json', 'data/cost/prices.json'], (fx, pr) => {
    COST.S = fbIndex([fx, pr]);
    root.innerHTML = `<div class="chips fb-nav" id="costNav"></div><div id="costView"></div><p class="note dx-link"><a href="#data/cost" data-hub="data" data-hash="data/cost">${esc(t('Data behind this tab'))}</a></p>`;
    const show = id => {
      COST.view = id;
      HUB.setHash(id === 'money' ? 'money' : 'cost', ...(id === 'fx' || id === 'money' ? [] : [id]));
      const el = $('#costView'); el.innerHTML = '';
      COST_RENDER[id](el);
    };
    fbNav($('#costNav'), COST_VIEWS.map(x => ({ id: x.id, label: t(x.label) })), v, show);
    COST_RENDER[v]($('#costView'), pre);
  });
} });
