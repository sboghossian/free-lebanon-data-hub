/* ------------------------------------------------------------ Electricity tab (FE-B). Data: data/electricity/power.json (D3), data/electricity/nightlights.json, data/climate/climate.json and data/fires/firms-lbn.json (D9),
   data/geo/lebanon.json (maps), data/cost/prices.json (generator tariffs). Views: public power, night lights, climate and fires, all series. Hash: #electricity, #electricity/<view>, #climate.
   The fire-hotspot layer toggle on the Strike map is added at the bottom of this file: it wraps the map tab's renderer and redraw without editing tl_map.js. */
const EL_VIEWS = [{ id: 'power', label: N('Public power') }, { id: 'lights', label: N('Night lights') }, { id: 'climate', label: N('Climate and fires') }, { id: 'all', label: N('All series') }];
const EL = { view: 'power', P: null, year: 2019, place: 'beirut', fireFrom: 2000, fireTo: 2024, sensor: 'modis' };
const NL_GOV = [['LBN', N('Lebanon')], ['LB1', N('Beirut')], ['LB2', N('Bekaa')], ['LB3', N('Mount Lebanon')], ['LB4', N('Nabatieh')], ['LB5', N('North')], ['LB6', N('South')], ['LB7', N('Akkar')], ['LB8', N('Baalbek-Hermel')]];
const CL_PLACES = [['beirut', N('Beirut')], ['tripoli', N('Tripoli')], ['zahle', N('Zahle')], ['tyre', N('Tyre')], ['the_cedars', N('The Cedars')]];
const elS = id => EL.P[id];
const elCard = (g, o) => fbCard(g, o);

function elPower(el) {
  const S = elS, nat = S('edl_supply_hours_national_official'), lastH = fbLast(nat), gs = S('generator_share_of_demand_pct'), um = S('unmet_demand_edl_pct');
  el.innerHTML = fbStats([
    { k: t('EDL supply today'), v: lastH ? nf(lastH[1], 0) + ' ' + t('h a day') : '', n: t('national average, {d}', { d: lastH ? fbLongDate(lastH[0]) : '' }) },
    { k: t('Before the collapse'), v: S('edl_supply_hours_pre_crisis_est') ? '~' + nf(S('edl_supply_hours_pre_crisis_est').points[0][1], 0) + ' ' + t('h a day') : '', n: t('typical, 2019 (survey recall and estimates)') },
    { k: t('Demand met by private generators'), v: gs ? nf(fbLast(gs)[1], 0) + '%' : '', n: t('{y}, from {a}% in {z}', { y: gs ? fy(fbLast(gs)[0]) : '', a: gs ? nf(gs.points[0][1], 0) : '', z: gs ? fy(gs.points[0][0]) : '' }) },
    { k: t('Demand EDL does not meet'), v: um ? nf(fbLast(um)[1], 0) + '%' : '', n: t('{y}, from {a}% in {z}', { y: um ? fy(fbLast(um)[0]) : '', a: um ? nf(um.points[0][1], 0) : '', z: um ? fy(um.points[0][0]) : '' }) }]) +
    `<p class="fb-note-band">${esc(t('There is no official time series of supply hours. Our estimate is a proxy and is labelled as one. The dated points are statements from the ministry, EDL, surveys and the press; a range is shown at its midpoint. Refugee-household figures (VASyR) are self-reported by Syrian households.'))}</p><div class="fb-grid" data-g></div>`;
  const g = el.querySelector('[data-g]'), C = o => elCard(g, o);
  const px = S('edl_supply_hours_proxy_monthly');
  if (px) {
    const box = document.createElement('section'); box.className = 'fb-proxy wide'; box.setAttribute('aria-label', t('Supply hours: the proxy')); g.appendChild(box);
    box.innerHTML = `<p class="fb-proxy-tag"><b>${esc(t('PROXY'))}</b> ${esc(t('Our estimate, not an official series.'))}</p><p class="note fb-proxy-m"><b>${esc(t('Method'))}.</b> ${esc(t(px.notes))}</p><div class="fb-grid" data-pg></div>`;
    const pg = box.querySelector('[data-pg]'), PC = o => elCard(pg, o);
    PC({ title: t('Hours of public electricity per day: the proxy against official figures'), unit: t('hours per day'), series: [{ s: px, label: t('Proxy: energy-equivalent hours') }, { s: S('edl_supply_hours_ministry_outside_beirut'), label: t('Ministry figure outside Beirut, hours with any current (to 2019)'), dash: true },
      { s: nat, label: t('Official and press statements') }], gran: 'm', height: 270, yMin: 0, yMax: 24, fillNote: t('Hollow dots: months not computed from observed energy (constrained to annual totals, interpolated, extrapolated or taken from a statement). The tooltip names the basis.') }).fig.classList.add('wide');
    PC({ title: t('Energy and demand behind the proxy'), unit: t('GWh per month'), series: [{ s: S('edl_gross_energy_used_gwh_m'), label: t('Energy to the grid') }, { s: S('electricity_demand_model_gwh_m'), label: t('Demand (modelled)') }], gran: 'm', height: 230, fillNote: t('Hollow dots: months where the energy was back-solved, not observed.') });
    PC({ title: t('Yearly mean of the proxy'), unit: t('hours per day'), series: [{ s: S('edl_supply_hours_proxy_yearly'), label: t('Proxy, yearly mean') }], gran: 'y', height: 200, yMin: 0, yMax: 24, note: t('2026 is January to July only.') });
  }
  C({ title: t('Hours of public electricity per day'), unit: t('hours per day, dated statements'), series: [
    { s: nat, label: t('National average, official and press') }, { s: S('edl_supply_hours_households_survey'), label: t('Households, HRW survey') }, { s: S('grid_hours_vasyr_refugee_households'), label: t('Refugee households, VASyR') },
    { s: S('edl_supply_hours_pre_crisis_est'), label: t('Typical before 2019') }, { s: S('grid_hours_akkar_vasyr'), label: t('Akkar, VASyR') }, { s: S('grid_hours_north_vasyr'), label: t('North, VASyR') }], gran: 'm', height: 270, yMin: 0, yMax: 24 }).fig.classList.add('wide');
  C({ title: t('Grid, generator and cut hours'), unit: t('hours per day, Syrian refugee households (VASyR)'), series: [{ s: S('grid_hours_vasyr_refugee_households'), label: t('National grid') }, { s: S('generator_hours_vasyr_refugee_households'), label: t('Private generator') }, { s: S('power_cut_hours_vasyr_refugee_households'), label: t('No power') }], gran: 'y', height: 230, yMin: 0, yMax: 24,
    note: t('These are households reporting for themselves, not the national picture.') });
  C({ title: t('EDL production and purchases'), unit: t('GWh a year, 1995 to 2018'), series: [{ s: S('edl_production_gwh'), label: t('Own plants') }, { s: S('edl_purchases_gwh'), label: t('Purchases') }, { s: S('network_consumption_gwh'), label: t('Delivered to the network') }], gran: 'y', height: 250 });
  C({ title: t('Monthly production'), unit: t('GWh a month, 1995 to October 2019'), series: [{ s: S('edl_production_thermal_gwh_m'), label: t('Thermal') }, { s: S('edl_production_hydro_gwh_m'), label: t('Hydro') }, { s: S('edl_purchases_gwh_m'), label: t('Purchases') }], gran: 'm', height: 250 });
  C({ title: t('Imported electricity'), unit: t('GWh a year'), series: [{ s: S('edl_import_syria_gwh'), label: t('From Syria') }, { s: S('edl_purchase_karpowership_gwh'), label: t('Power barges (Karpowership)') }, { s: S('edl_import_egypt_gwh'), label: t('From Egypt') }], gran: 'y', height: 230 });
  C({ title: t('Treasury transfers to EDL'), unit: t('LBP billion a month, 2009 to March 2019'), series: [{ s: S('treasury_transfers_to_edl_lbp_bn'), label: t('Transfers') }], gran: 'm', height: 230, note: t('Nominal pounds at the official rate, which was fixed at 1,507.5 in this period.') });
  C({ title: t('Petroleum imports by product'), unit: t('tonnes a year, 1995 to 2018 (the whole economy, not power alone)'), series: [{ s: S('import_gasoil_t'), label: t('Gas oil (diesel)') }, { s: S('import_fueloil_t'), label: t('Fuel oil') }, { s: S('import_gasoline_t'), label: t('Gasoline') }, { s: S('import_lpg_t'), label: t('Liquid gas') }, { s: S('import_kerosene_t'), label: t('Kerosene') }], gran: 'y', height: 260,
    note: t('Fuel imports for the power plants alone are not published openly.') });
  // after the collapse: a small table (2019 to 2022), then generators, then the World Bank indicators
  const rows = [['edl_thermal_production_gwh_2020_22', N('EDL thermal plants')], ['total_public_supply_gwh_2020_22', N('Total public supply after losses')], ['electricity_demand_gwh_2020_22', N('Estimated demand')], ['private_generation_gwh_2020_22', N('Private generators')], ['solar_pv_generation_gwh', N('Rooftop solar')]];
  const yrs = ['2019', '2020', '2021', '2022'], pick = (s, y) => { const p = s && s.points.find(q => q[0] === y); return p ? p[1] : null; };
  const tb = document.createElement('div'); tb.className = 'fb-card wide';
  tb.innerHTML = `<h4 class="fb-t">${esc(t('After the collapse, 2019 to 2022'))}</h4><p class="fb-u mono dim">${esc(t('GWh a year'))}</p>` +
    fbTable([{ h: t('Item') }].concat(yrs.map(y => ({ h: fy(y), cls: 'num' }))), rows.map(([id, lb]) => [t(lb)].concat(yrs.map(y => { const v = pick(S(id), y); return v == null ? '' : nf(v, 0); })))) +
    fbSrcLine(rows.map(r => S(r[0])).filter(Boolean)) + `<p class="note">${esc(t('From the national greenhouse gas inventory report (UNFCCC), citing EDL and the Lebanese Center for Energy Conservation. Fuel for power plants is only in a chart there, so it is not tabulated.'))}</p>`;
  g.appendChild(tb);
  C({ title: t('Generator subscription (5 A) in US dollars'), unit: t('USD per month at the market rate'), series: [{ s: EL.P.gen_fixed_5a_usd_market, label: t('5 A subscription') }], gran: 'm', height: 230,
    note: t('EDL raised its own tariff in November 2022, the first rise since the 1990s (IMF). EDL tariff history per kWh is not yet in the Hub, so the two are not compared on one chart.') });
  C({ title: t('Electricity use per person'), unit: t('kWh per person a year, World Bank'), series: [{ s: S('wb_eg_use_elec_kh_pc'), label: t('Consumption per person') }], gran: 'y', height: 220 });
  C({ title: t('Losses on the grid'), unit: t('% of output, World Bank'), series: [{ s: S('wb_eg_elc_loss_zs'), label: t('Transmission and distribution losses') }], gran: 'y', height: 220, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%',
    note: t('This counts technical losses only as reported to the World Bank; it does not include unbilled or stolen power as EDL reports it.') });
  C({ title: t('Where the electricity comes from'), unit: t('% of electricity produced, World Bank'), series: [{ s: S('wb_eg_elc_petr_zs'), label: t('Oil') }, { s: S('wb_eg_elc_hyro_zs'), label: t('Hydro') }, { s: S('wb_eg_elc_rnew_zs'), label: t('Renewables (all)') }], gran: 'y', height: 230, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
  C({ title: t('Access to electricity'), unit: t('% of population, World Bank'), series: [{ s: S('wb_eg_elc_accs_zs'), label: t('All') }, { s: S('wb_eg_elc_accs_ru_zs'), label: t('Rural') }], gran: 'y', height: 200, yMin: 90, yMax: 100.5, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%',
    note: t('Access means any connection. It does not measure hours of supply.') });
  const ev = (EL.events || []).slice().sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  if (ev.length) {
    const d = document.createElement('div'); d.className = 'fb-card wide';
    d.innerHTML = `<h4 class="fb-t">${esc(t('Blackouts and supply milestones'))}</h4><ul class="fb-ev">${ev.map(e => `<li><span class="mono">${esc(fbLongDate(e.date))}</span> <b>${th(e.title)}</b>. ${th(e.detail || '')} ${e.source && /^https?:/.test(e.source) ? `<a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(e.source))}</a>` : ''}</li>`).join('')}</ul><p class="note">${esc(t('Each line links to its own source; the licence of those pages is not stated.'))}</p>`;
    g.appendChild(d);
  }
}

/* ---------- night lights by governorate ---------- */
function elAnnual(s) {  // {year: mean of the monthly values}, partial years marked
  const by = {};
  s.points.forEach(p => { const y = p[0].slice(0, 4); (by[y] || (by[y] = [])).push(p[1]); });
  return Object.fromEntries(Object.entries(by).map(([y, a]) => [y, { v: a.reduce((x, z) => x + z, 0) / a.length, n: a.length }]));
}
function elLights(el) {
  el.innerHTML = '<div id="elLg"></div>';
  fbLoad($('#elLg'), ['data/geo/lebanon.json', 'data/electricity/nightlights.json'], (geo, nl) => {
    const N_ = fbIndex([nl]), ann = {};
    NL_GOV.forEach(([c]) => { const s = N_['nl_mean_' + c]; if (s) ann[c] = elAnnual(s); });
    const years = Object.keys(ann.LBN || {}).map(Number).sort((a, b) => a - b), y0 = years[0], y1 = years[years.length - 1];
    if (!years.length) { $('#elLg').innerHTML = `<p class="hub-empty">${esc(t('No night-light data is in this build.'))}</p>`; return; }
    if (EL.year < y0 || EL.year > y1) EL.year = 2019;
    const lf = c => ann[c] && ann[c][EL.year] ? ann[c][EL.year].v : null, lmax = 90, shade = v => v == null ? 'var(--stone)' : fbShade(Math.log10(1 + v) / Math.log10(1 + lmax), '--diesel');
    const L = ann.LBN, ys = years.filter(y => L[y].n >= 6), peak = ys.filter(y => y <= 2019).reduce((b, y) => L[y].v > L[b].v ? y : b, ys[0]), low = ys.reduce((b, y) => L[y].v < L[b].v ? y : b, ys[0]);
    $('#elLg').innerHTML = `<p class="lead">${esc(t('Satellites record the light Lebanon emits at night. Light follows electricity, but also streets, generators, solar panels and the weather, so read it as a rough signal of where the grid and private power were running.'))}</p>
      <p class="fb-note-band">${esc(t("Lebanon's mean night-time radiance was highest around {a} ({va}), fell to {vb} in {b}, and stood at {vc} in {c}. Unit: nW/cm2/sr, annual average of monthly values.", { a: fy(peak), va: nf(L[peak].v, 1), b: fy(low), vb: nf(L[low].v, 1), c: fy(y1) + (L[y1].n < 12 ? ' ' + t('(January to June)') : ''), vc: nf(L[y1].v, 1) }))}</p>
      <div class="fb-yr"><label for="elYr">${esc(t('Year'))}</label><input type="range" id="elYr" min="${y0}" max="${y1}" step="1" value="${EL.year}"><output id="elYrO" for="elYr">${fy(EL.year)}</output></div>
      <div class="fb-mapwrap"><div id="elMap"></div><div id="elTbl"></div></div><div class="fb-grid" data-g></div>`;
    const draw = () => {
      $('#elYrO').textContent = fy(EL.year) + (ann.LBN[EL.year] && ann.LBN[EL.year].n < 12 ? ' *' : '');
      $('#elMap').innerHTML = fbMap(geo, { level: 'adm1', fill: a => ({ fill: shade(lf(a.p)), title: lf(a.p) == null ? '' : nf(lf(a.p), 1) + ' nW/cm2/sr' }), labels: true, extra: (() => { const b = geo.adm1.find(a => a.p === 'LB1'); return b ? `<circle cx="${b.l[0]}" cy="${b.l[1]}" r="46" class="fb-a" style="fill:${shade(lf('LB1'))};stroke:var(--ink);stroke-width:3"><title>${esc(t('Beirut'))}${lf('LB1') == null ? '' : ': ' + nf(lf('LB1'), 1)}</title></circle>` : ''; })(), aria: t('Map of night-time radiance by governorate') }) + fbLegend(0, lmax, v => nf(v, 0), '--diesel') + `<p class="note">${esc(t('Colour is on a log scale, so the dimmer regions stay visible next to Beirut, which is far brighter than the rest.'))}</p>` + fbSrcLine([N_.nl_mean_LBN].filter(Boolean));
      const base = 2012;
      $('#elTbl').innerHTML = fbTable([{ h: t('Governorate') }, { h: fy(base), cls: 'num' }, { h: fy(EL.year), cls: 'num' }, { h: t('Change'), cls: 'num' }], NL_GOV.map(([c, lb]) => { const a = ann[c] && ann[c][base], b = lf(c); return [t(lb), a ? nf(a.v, 1) : '', b == null ? '' : nf(b, 1), a && b != null ? nf((b / a.v - 1) * 100, 0) + '%' : '']; })) +
        `<p class="note">${esc(t('Mean radiance, nW/cm2/sr. A year marked * has fewer than twelve months.'))}</p>`;
    };
    $('#elYr').addEventListener('input', ev => { EL.year = +ev.target.value; draw(); });
    draw();
    const g = $('#elLg').querySelector('[data-g]');
    elCard(g, { title: t('Night lights by governorate'), unit: t('mean radiance, nW/cm2/sr, monthly, 2012 to June 2025, log scale'), series: NL_GOV.filter(x => x[0] !== 'LBN' && N_['nl_mean_' + x[0]]).map(([c, lb]) => ({ s: N_['nl_mean_' + c], label: t(lb) })), log: true, logStart: true, gran: 'm', height: 300,
      note: t('Winter months are noisier because of cloud: the series nl_cf_* in the download holds the number of cloud-free observations.') }).fig.classList.add('wide');
    elCard(g, { title: t('Lebanon: mean night-time radiance'), unit: t('nW/cm2/sr, monthly'), series: [{ s: N_.nl_mean_LBN, label: t('Lebanon') }], gran: 'm', height: 230 });
    elCard(g, { title: t('Beirut and Mount Lebanon'), unit: t('nW/cm2/sr, monthly'), series: [{ s: N_.nl_mean_LB1, label: t('Beirut') }, { s: N_.nl_mean_LB3, label: t('Mount Lebanon') }], gran: 'm', height: 230 });
    const nt = document.createElement('p'); nt.className = 'note';
    nt.textContent = t('Source: World Bank Light Every Night (VIIRS day/night band, monthly composites, stray-light corrected), computed here for the governorates; licence ODbL. Months missing in the archive: March 2014, October and November 2017, August 2021, June and August 2022, October 2024. The archive stops in June 2025. Not used because they need a login: Colorado School of Mines EOG and NASA Black Marble.');
    $('#elLg').appendChild(nt);
  });
}

/* ---------- climate (Open-Meteo ERA5) and fire hotspots (NASA FIRMS) ---------- */
function elYearly(s, how) {  // monthly -> [[year, value]] for years that have all twelve months
  const by = {};
  s.points.forEach(p => { (by[p[0].slice(0, 4)] || (by[p[0].slice(0, 4)] = [])).push(p[1]); });
  return Object.entries(by).filter(([, a]) => a.length === 12).map(([y, a]) => [y, +(a.reduce((x, z) => x + z, 0) / (how === 'sum' ? 1 : 12)).toFixed(2)]);
}
const elPseudo = (s, pts, label) => ({ id: s.id + '_yr', label, unit: s.unit, points: pts, source_url: s.source_url, license: s.license, csv: s.csv, csv_id: s.csv_id || s.id });
function elClimate(el) {
  el.innerHTML = `<p class="lead">${esc(t('How the climate of five places has changed since 1940, and where NASA satellites have detected fire hotspots since 2000.'))}</p><h3 class="d-h">${esc(t('Climate'))}</h3><div id="elCl"></div><h3 class="d-h">${esc(t('Fire hotspots'))}</h3><div id="elFi"></div>`;
  fbLoad($('#elCl'), ['data/climate/climate.json'], cj => {
    const C = fbIndex([cj]), cs = (p, k) => C['D9.climate.' + p + '.' + k];
    const ann = {};
    CL_PLACES.forEach(([p]) => { ann[p] = { temp: cs(p, 'temp_mean') ? elYearly(cs(p, 'temp_mean'), 'mean') : [], rain: cs(p, 'precip') ? elYearly(cs(p, 'precip'), 'sum') : [] }; });
    const mean = (a, y0, y1) => { const v = a.filter(p => +p[0] >= y0 && +p[0] <= y1).map(p => p[1]); return v.length ? v.reduce((x, z) => x + z, 0) / v.length : null; };
    const lastY = ann.beirut.temp.length ? +ann.beirut.temp[ann.beirut.temp.length - 1][0] : 2025;
    $('#elCl').innerHTML = `<div class="chips fb-nav" id="elPl"></div><div id="elClTop"></div><div class="fb-grid" data-g></div><p class="note">${esc(t('Source: Open-Meteo Historical Weather API (ERA5 reanalysis, about 25 km grid, not station data), CC BY 4.0, attribution Open-Meteo and Copernicus/ECMWF. Elevations of the grid cells: Beirut 33 m, Tripoli 71 m, Zahle 959 m, Tyre 9 m, The Cedars 1,892 m. Only years with all twelve months are used.'))}</p>`;
    const top = () => {
      const p = EL.place, a = ann[p], b0 = mean(a.temp, 1961, 1990), b1 = mean(a.temp, lastY - 9, lastY), r0 = mean(a.rain, 1961, 1990), r1 = mean(a.rain, lastY - 9, lastY), lb = t((CL_PLACES.find(x => x[0] === p) || [0, ''])[1]);
      $('#elClTop').innerHTML = fbStats([
        { k: t('Mean temperature {a} to {b}', { a: fy(lastY - 9), b: fy(lastY) }), v: b1 == null ? '' : nf(b1, 1) + ' °C', n: lb },
        { k: t('Change from the 1961 to 1990 average'), v: b0 == null || b1 == null ? '' : (b1 - b0 >= 0 ? '+' : '') + nf(b1 - b0, 1) + ' °C', n: t('mean {a} °C in 1961 to 1990', { a: b0 == null ? '' : nf(b0, 1) }) },
        { k: t('Rain a year, {a} to {b}', { a: fy(lastY - 9), b: fy(lastY) }), v: r1 == null ? '' : nf(r1, 0) + ' mm', n: t('{a} mm in 1961 to 1990', { a: r0 == null ? '' : nf(r0, 0) }) }]);
      // warming stripes: one bar a year, colour = departure from the 1961 to 1990 mean
      const t0 = a.temp, W = 860, w = W / Math.max(1, t0.length);
      const bars = t0.map((q, i) => { const d = b0 == null ? 0 : q[1] - b0, f = Math.min(1, Math.abs(d) / 2), c = `color-mix(in srgb, var(${d >= 0 ? '--war' : '--sea'}) ${Math.round(10 + 85 * f)}%, var(--paper))`; return `<rect x="${(i * w).toFixed(2)}" y="0" width="${(w + 0.4).toFixed(2)}" height="100" style="fill:${c}"><title>${esc(fy(q[0]) + ': ' + (d >= 0 ? '+' : '') + nf(d, 1) + ' °C')}</title></rect>`; }).join('');
      $('#elStripes').innerHTML = `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none" class="fb-stripes" role="img" aria-label="${esc(t('Warming stripes: one bar for each year, blue below the 1961 to 1990 average and red above it'))}">${bars}</svg><div class="fb-leg"><span class="mono">${esc(t2(t0.length ? t0[0][0] : ''))}</span><i style="background:linear-gradient(90deg,${fbShadeSea()},var(--paper),${fbShadeWar()})"></i><span class="mono">${esc(t2(t0.length ? t0[t0.length - 1][0] : ''))}</span></div><p class="note">${esc(t('Blue: cooler than the 1961 to 1990 average. Red: warmer. Full colour is 2 °C away.'))}</p>`;
    };
    const t2 = y => y ? fy(y) : '';
    $('#elClTop').insertAdjacentHTML('afterend', '');
    fbNav($('#elPl'), CL_PLACES.map(([id, lb]) => ({ id, label: t(lb) })), EL.place, id => { EL.place = id; top(); }, t('Place'));
    const g = $('#elCl').querySelector('[data-g]');
    const st = document.createElement('div'); st.className = 'fb-card wide'; st.innerHTML = `<h4 class="fb-t">${esc(t('Warming stripes'))}</h4><div id="elStripes"></div>`; g.appendChild(st);
    top();
    const base = cs('beirut', 'temp_mean');
    elCard(g, { title: t('Mean temperature by year'), unit: '°C', series: CL_PLACES.map(([p, lb]) => cs(p, 'temp_mean') ? { s: elPseudo(cs(p, 'temp_mean'), ann[p].temp, t(lb)), label: t(lb) } : null).filter(Boolean), gran: 'y', height: 260, yFmt: v => nf(v, 0), valFmt: v => nf(v, 1) + ' °C' });
    elCard(g, { title: t('Rain by year'), unit: 'mm', series: CL_PLACES.map(([p, lb]) => cs(p, 'precip') ? { s: elPseudo(cs(p, 'precip'), ann[p].rain, t(lb)), label: t(lb) } : null).filter(Boolean), gran: 'y', height: 260, valFmt: v => nf(v, 0) + ' mm' });
    if (base) elCard(g, { title: t('Monthly temperature, Beirut'), unit: '°C', series: [{ s: cs('beirut', 'temp_max'), label: t('Hottest') }, { s: cs('beirut', 'temp_mean'), label: t('Mean') }, { s: cs('beirut', 'temp_min'), label: t('Coolest') }], from: 2000, gran: 'm', height: 240, yFmt: v => nf(v, 0), valFmt: v => nf(v, 1) + ' °C',
      note: t('Monthly mean of the daily maximum, mean and minimum.') });
  });
  const fi = $('#elFi');
  fbLoad(fi, ['data/fires/firms-lbn.json', 'data/geo/lebanon.json'], (F, geo) => {
    const yrs = Object.keys(F.by_year_modis || F.by_year).map(Number).sort((a, b) => a - b);
    const mk = (obj, label) => ({ id: label, label, unit: 'hotspots', points: Object.entries(obj || {}).map(([y, n]) => [String(y), n]), source_url: F.source, license: F.license, csv: 'csv/fires.csv' });
    fi.innerHTML = `<p class="note fb-lead">${esc(t('NASA satellites detect heat from active fires. A hotspot is a detection, not a fire and not a burned area. Strikes and fires both show up, and so do agricultural burns; this layer is not an attribution of cause.'))}</p>
      <div class="d-filters"><label class="sel" for="elSens">${esc(t('Sensor'))} <select id="elSens"><option value="modis">${esc(t('MODIS, 2000 to 2024 (1 km)'))}</option><option value="viirs">${esc(t('VIIRS, 2012 to 2024 (375 m)'))}</option></select></label>
      <label class="sel" for="elF0">${esc(t('From'))} <select id="elF0"></select></label><label class="sel" for="elF1">${esc(t('To'))} <select id="elF1"></select></label></div>
      <div class="fb-mapwrap"><div id="elFmap"></div><div id="elFtxt"></div></div><div class="fb-grid" data-g></div>`;
    const sel0 = $('#elF0'), sel1 = $('#elF1'), opts = yrs.map(y => `<option value="${y}">${fy(y)}</option>`).join('');
    sel0.innerHTML = opts; sel1.innerHTML = opts; $('#elSens').value = EL.sensor;
    const draw = () => {
      EL.sensor = $('#elSens').value;
      const lo = EL.sensor === 'viirs' ? 2012 : 2000;
      let a = Math.max(lo, +sel0.value || lo), b = +sel1.value || 2024;
      if (b < a) b = a;
      sel0.value = a; sel1.value = b; EL.fireFrom = a; EL.fireTo = b;
      const cells = (EL.sensor === 'viirs' ? F.cells.filter(c => +c[2].slice(0, 4) >= 2012) : (F.cells_modis || F.cells)).filter(c => +c[2].slice(0, 4) >= a && +c[2].slice(0, 4) <= b);
      const agg = new Map();
      cells.forEach(c => { const k = c[0] + ',' + c[1]; agg.set(k, (agg.get(k) || 0) + c[3]); });
      const mx = Math.max(1, ...agg.values()), cw = (F.grid || 0.05) * geo.k * geo.s, ch = (F.grid || 0.05) * geo.s;
      const rects = [...agg.entries()].map(([k, n]) => { const [la, lo2] = k.split(',').map(Number), [x, y] = fbProj(geo, la + (F.grid || 0.05) / 2, lo2 - (F.grid || 0.05) / 2); return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" style="fill:var(--diesel);fill-opacity:${(0.18 + 0.8 * Math.sqrt(n / mx)).toFixed(2)}"><title>${esc(nf(n) + ' ' + t('hotspots'))}</title></rect>`; }).join('');
      $('#elFmap').innerHTML = fbMap(geo, { level: 'adm1', fill: () => ({ fill: 'var(--stone)' }), extra: rects, aria: t('Map of fire hotspots detected by NASA satellites') }) + fbSrcLine([{ source_url: F.source, license: F.license, csv: 'csv/fires.csv', label: 'fires' }]);
      const tot = [...agg.values()].reduce((x, z) => x + z, 0), by = EL.sensor === 'viirs' ? F.by_year_viirs_snpp : F.by_year_modis;
      const pk = Object.entries(by || {}).filter(([y]) => +y >= a && +y <= b).sort((x, z) => z[1] - x[1])[0];
      $('#elFtxt').innerHTML = fbStats([{ k: t('Hotspots, {a} to {b}', { a: fy(a), b: fy(b) }), v: nf(tot), n: t('in {n} grid cells of 0.05 degrees', { n: nf(agg.size) }) }, { k: t('Busiest year'), v: pk ? fy(pk[0]) : '', n: pk ? t('{n} hotspots', { n: nf(pk[1]) }) : '' }]) + `<p class="note">${esc(t('Squares are 0.05 degrees, about 5 km. Darker means more detections in the period. NASA publishes country archives to 2024; 2025 and 2026 and the NOAA-20 and NOAA-21 satellites need a free NASA key and are not included.'))}</p>`;
    };
    $('#elSens').addEventListener('change', draw); sel0.addEventListener('change', draw); sel1.addEventListener('change', draw);
    sel0.value = EL.fireFrom; sel1.value = EL.fireTo; draw();
    const g = fi.querySelector('[data-g]');
    elCard(g, { title: t('Fire hotspots per year'), unit: t('hotspots detected in Lebanon, by satellite sensor'), series: [{ s: mk(F.by_year_modis, t('MODIS (2000 to 2024)')), label: t('MODIS (2000 to 2024)') }, { s: mk(F.by_year_viirs_snpp, t('VIIRS (2012 to 2024)')), label: t('VIIRS (2012 to 2024)') }], gran: 'y', height: 260,
      note: t('VIIRS sees smaller fires than MODIS, so its counts are higher. Compare each line with itself, never one sensor with the other.') }).fig.classList.add('wide');
    const nt = document.createElement('p'); nt.className = 'note'; nt.textContent = t('Air quality (OpenAQ) is not included: its data service needs a free API key.'); fi.appendChild(nt);
  });
}
const fbShadeSea = () => 'color-mix(in srgb, var(--sea) 95%, var(--paper))', fbShadeWar = () => 'color-mix(in srgb, var(--war) 95%, var(--paper))';
function elAllView(el) {
  el.innerHTML = `<p class="lead">${esc(t('Every series behind this tab, with its unit, span, licence and a CSV download.'))}</p><div id="elAll"></div>`;
  const keep = Object.values(EL.P).filter(s => s.csv && !/^cpi_|^fuel_|^bread_|^min_wage|^fx_|^gen_|^public_salary/.test(s.id));
  fbLoad($('#elAll'), ['data/electricity/nightlights.json', 'data/climate/climate.json'], (nl, cl) => { fbBrowse($('#elAll'), keep.concat(nl.series || [], cl.series || []), { per: 30 }); });
}
const EL_RENDER = { power: elPower, lights: elLights, climate: elClimate, all: elAllView };
HUB.tab('electricity', { render(args, info) {
  const root = $('#electricityRoot');
  if (!root || !(D.tabs.electricity && (D.tabs.electricity.power || D.tabs.electricity.nl || D.tabs.electricity.climate))) return;
  const v = info.route === 'climate' ? 'climate' : (EL_VIEWS.some(x => x.id === args[0]) ? args[0] : (info.lang ? EL.view : 'power'));
  EL.view = v;
  const need = ['data/electricity/power.json'];
  fbLoad(root, need, pw => {
    const prices = hubLoad('data/cost/prices.json').catch(() => ({ series: [] }));
    return prices.then(pr => {
      EL.P = fbIndex([pw, pr]); EL.events = pw.events || [];
      root.innerHTML = `<div class="chips fb-nav" id="elNav"></div><div id="elView"></div>`;
      const show = id => {
        EL.view = id;
        HUB.setHash(id === 'climate' ? 'climate' : 'electricity', ...(id === 'power' || id === 'climate' ? [] : [id]));
        const el = $('#elView'); el.innerHTML = ''; EL_RENDER[id](el);
      };
      fbNav($('#elNav'), EL_VIEWS.map(x => ({ id: x.id, label: t(x.label) })), v, show);
      EL_RENDER[v]($('#elView'));
    });
  });
} });

/* ---------- Strike map: NASA fire hotspots layer (toggle in the side panel, drawn on a canvas over the map, follows the time brush) ---------- */
const FBF = { data: null, on: false, busy: false };
function fbFiresDraw() {
  const cv = $('#fbFireCv'), st = $('#mpStage');
  if (!cv || !st || typeof GEO === 'undefined' || !GEO || !MAP.W) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(MAP.W * dpr) || cv.height !== Math.round(MAP.H * dpr)) { cv.width = Math.round(MAP.W * dpr); cv.height = Math.round(MAP.H * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, MAP.W, MAP.H);
  const note = $('#fbFireNote');
  if (!FBF.on || !FBF.data) { if (note) note.hidden = true; return; }
  const F = FBF.data, ym = d => { const x = new Date(d * 864e5); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
  const m0 = MAP.t0 == null ? -Infinity : ym(MAP.t0), m1 = MAP.t1 == null ? Infinity : ym(MAP.t1), agg = new Map();
  (F.cells_modis || F.cells).forEach(q => { const m = +q[2].slice(0, 4) * 12 + (+q[2].slice(5, 7) - 1); if (m >= m0 && m <= m1) { const k = q[0] + ',' + q[1]; agg.set(k, (agg.get(k) || 0) + q[3]); } });
  const g = F.grid || 0.05, mx = Math.max(1, ...agg.values()), col = (getComputedStyle($('#mapRoot')).getPropertyValue('--diesel') || '#b8860b').trim() || '#b8860b';
  const w = g * GEO.k * GEO.s * MAP.k, h = g * GEO.s * MAP.k;
  c.fillStyle = col;
  agg.forEach((n, k) => {
    const [la, lo] = k.split(',').map(Number), x = (lo - g / 2 - GEO.lon0) * GEO.k * GEO.s * MAP.k + MAP.tx, y = (GEO.lat1 - la - g / 2) * GEO.s * MAP.k + MAP.ty;
    if (x < -w || x > MAP.W || y < -h || y > MAP.H) return;
    c.globalAlpha = 0.15 + 0.7 * Math.sqrt(n / mx); c.fillRect(x, y, w, h);
  });
  c.globalAlpha = 1;
  if (note) { note.hidden = false; note.textContent = agg.size ? t('NASA FIRMS hotspots (MODIS), {n} detections in {c} cells. Squares are about 5 km; the archive covers November 2000 to December 2024.', { n: nf([...agg.values()].reduce((x, z) => x + z, 0)), c: nf(agg.size) }) : t('No fire hotspots on record for this period. The NASA archive covers November 2000 to December 2024.'); }
}
function fbFiresMount() {
  const side = $('.mp-side'), st = $('#mpStage');
  if (!side || !st || $('#fbFireOn')) return;
  side.insertAdjacentHTML('beforeend', `<label class="mp-chk"><input type="checkbox" id="fbFireOn"${FBF.on ? ' checked' : ''}> ${esc(t('NASA fire hotspots layer (2000 to 2024)'))}</label><p class="mp-ac-note" id="fbFireNote" hidden></p>`);
  const cv = document.createElement('canvas'); cv.id = 'fbFireCv'; cv.className = 'fb-fire-cv'; cv.setAttribute('aria-hidden', 'true'); st.appendChild(cv);
  $('#fbFireOn').addEventListener('change', ev => {
    FBF.on = ev.target.checked;
    if (FBF.on && !FBF.data) hubLoad('data/fires/firms-lbn.json').then(d => { FBF.data = d; fbFiresDraw(); }, () => { FBF.on = false; ev.target.checked = false; const n = $('#fbFireNote'); n.hidden = false; n.textContent = t('The fire data could not be loaded.'); });
    else fbFiresDraw();
  });
  fbFiresDraw();
}
function fbFiresWait() {
  if (!(D.tabs.electricity && D.tabs.electricity.fires)) return;
  const t0 = Date.now(), poll = () => { if ($('#mpStage') && typeof MAP !== 'undefined' && MAP.built) fbFiresMount(); else if (Date.now() - t0 < 20000) setTimeout(poll, 150); };
  poll();
}
(function () {
  const orig = hubRenderers.map, redraw = mapRedraw;
  hubRenderers.map = (args, info) => { if (orig) orig(args, info); fbFiresWait(); };
  mapRedraw = function () { redraw.apply(this, arguments); fbFiresDraw(); };
})();
