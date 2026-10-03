/* ------------------------------------------------------------ v4 year context card: who governed, the people, the economy, prices, life */
let YC = null;
function ycRow(k, v) { return `<div class="yc-r"><dt>${esc(t(k))}</dt><dd>${v}</dd></div>`; }
const ND = () => `<span class="nd">${esc(t('no data'))}</span>`;
function ycOffices(y) {
  const d0 = y + '-01-01', off = officesAt(d0), out = [];
  if (y < 1920) {  // before Greater Lebanon: the rulers list
    RULER_CODES.filter(c => off[c] && off[c].length).forEach(c => out.push(ycRow(offName(c), holderText(c, off[c], off).html)));
    if (!out.length) out.push(ycRow('Ruler', `<span class="nd">${esc(t('no record in the rulers list'))}</span>`));
    const chR = [];
    RULER_CODES.forEach(k => (OFFS[k] || []).forEach(o => { if (o.a.slice(0, 4) === String(y) && o.a > d0) chR.push(`${offName(k)}: ${esc(o.name)}${o.acting ? ' (' + esc(t('acting')) + ')' : ''} ${esc(t('from {d}', { d: fmtDate(o.a) }))}`); }));
    if (chR.length) out.push(`<div class="yc-ch"><span class="k">${esc(t('Changes during {y}', { y: fy(y) }))}</span>${chR.join('; ')}</div>`);
    return `<div class="yc-s"><span class="k">${esc(t('Rulers on 1 Jan {y}', { y: fy(y) }))}</span><dl>${out.join('')}</dl></div>`;
  }
  if (off.P.length) out.push(ycRow('President', holderText('P', off.P, off).html));
  else out.push(ycRow('President', `<span class="nd">${esc(t('not in the office list before 1941'))}</span>`));
  if (off.H.length && y <= 1946) out.push(ycRow('High Commissioner', holderText('H', off.H, off).html));
  const cab = off.C.length === 1 ? ` <span class="dim">· ${esc(off.C[0].name)}</span>` : '';
  out.push(ycRow('Prime minister', off.PM.length ? holderText('PM', off.PM, off).html + cab : ND()));
  out.push(ycRow('Speaker', off.S.length ? holderText('S', off.S, off).html : ND()));
  out.push(ycRow('BDL governor', off.G.length ? holderText('G', off.G, off).html : `<span class="nd">${esc(y < 1963 ? t('no central bank until 1963') : t('no data'))}</span>`));
  const ch = [];
  ['P', 'PM', 'S', 'G'].forEach(k => (OFFS[k] || []).forEach(o => {
    if (o.a.slice(0, 4) === String(y) && o.a > d0) ch.push(`${esc(t(OFF_NAME[k]))}: ${o.name === 'Vacuum' ? esc(t('vacuum from {d}', { d: fmtDate(o.a) })) : esc(o.name) + (o.acting ? ' (' + esc(t('acting')) + ')' : '') + ' ' + esc(t('from {d}', { d: fmtDate(o.a) }))}`);
  }));
  if (ch.length) out.push(`<div class="yc-ch"><span class="k">${esc(t('Changes during {y}', { y: fy(y) }))}</span>${ch.join('; ')}</div>`);
  return `<div class="yc-s"><span class="k">${esc(t('In office on 1 Jan {y}', { y: fy(y) }))}</span><dl>${out.join('')}</dl></div>`;
}
function ycMarket(y) {
  const m = MKT.filter(o => Math.floor(o.t) === y).pop();
  if (!m) return '';
  const u = serSrc('lbp_market_longrun') || serSrc('lbp_usd_market_datapoints');
  return `<br><span class="yv" data-tip="${tipA(t('Parallel market'), ' ' + t(m.n))}">${esc(t('market {v} LBP', { v: fmt(m.v, 0) }))} <span class="dim">(${esc(pdate(m.d))})</span></span>${u ? ` <a class="sl" href="${esc(u)}" target="_blank" rel="noopener">${esc(hostOf(u))}</a>` : ''}`;
}
function ycLife(y) {
  const l = EV.filter(e => e.lanes.includes('life') && e._y0 <= y && e._y1 >= y)
    .sort((a, b) => (a._y0 === y ? 0 : 1) - (b._y0 === y ? 0 : 1) || b.w - a.w || a.t - b.t).slice(0, 2);
  if (!l.length) return `<p class="nd">${esc(t('No life fact found for this year.'))}</p>`;
  return '<ul class="yc-life">' + l.map(e => {
    const p = e.parts.find(q => q.u);
    return `<li><button type="button" class="lnk" data-id="${e.id}">${th(e.title)}</button> <span class="dim">${esc(edate(e))}</span>${p ? ` <a class="sl" href="${esc(p.u)}" target="_blank" rel="noopener">${esc(hostOf(p.u))}</a>` : ''}</li>`;
  }).join('') + '</ul>';
}
function yearCardHTML(y) {
  const emII = yval('ppl_emig_information_international', y);
  const people = [
    ycRow('Population', numSrc('ppl_pop_resident_model', y, fMil, 1)),
    ycRow('Emigrants counted', emII ? numSrc('ppl_emig_information_international', y, fInt) : ND()),
    ycRow('Net migration, modelled', numSrc('ppl_emig_wb_net_migration_model', y, fInt)),
    ycRow('Syrian refugees registered', numSrc('ppl_syrian_refugees_unhcr', y, fInt)),
    ycRow('Palestine refugees registered', numSrc('ppl_palestine_refugees_unrwa', y, fInt)),
    ycRow('Airport passengers', numSrc('ppl_airport_pax_annual', y, fMil)),
    ycRow('Tourist arrivals', numSrc('ppl_tourist_arrivals', y, fMil)),
  ].join('');
  const usdpc = yval('gdp_per_capita_usd', y);
  const econ = [
    ycRow('GDP per capita', numSrc('gdp_pc_maddison', y, v => t('{v} int$ (2011 prices)', { v: fmt(v, 0) })) + (usdpc ? '<br>' + numSrc('gdp_per_capita_usd', y, v => t('US${v} current', { v: fmt(v, 0) })) : '')),
    ycRow('LBP per US$', numSrc('lbp_usd_longrun', y, v => t('official') + ' ' + fLbp(v), 1) + ycMarket(y)),
    ycRow('Inflation', numSrc('inflation_cpi_longrun', y, fPct)),
  ].join('');
  const prices = [
    ycRow('Big Mac', numSrc('px_bigmac_usd', y, fUsd) + (yval('px_bigmac_lbp', y) ? '<br>' + numSrc('px_bigmac_lbp', y, fLbp) : '')),
    ycRow('Bread bundle', numSrc('px_bread', y, fLbp)),
    ycRow('Petrol, 20 litres', numSrc('px_petrol', y, fLbp)),
    ycRow('Minimum wage', numSrc('px_minwage_usd', y, v => t('{v} a month', { v: fUsd(v) }))),
  ].join('');
  const nEv = EV.filter(e => e._y0 <= y && e._y1 >= y).length;
  return `<div class="yc-top"><button type="button" class="yc-nav" data-ystep="-1" aria-label="${esc(t('Previous year'))}"${y <= 1800 ? ' disabled' : ''}>‹</button><h4 id="ycH" tabindex="-1">${fy(y)}</h4><button type="button" class="yc-nav" data-ystep="1" aria-label="${esc(t('Next year'))}"${y >= 2026 ? ' disabled' : ''}>›</button><button type="button" class="yc-x" data-yclose="1" aria-label="${esc(t('Close the year card'))}">×</button></div>
  <p class="yc-sub">${esc(tp('{n} event touches this year.', '{n} events touch this year.', nEv))} <button type="button" class="lnk" data-yfilter="${y}">${esc(t('Show only {y}', { y: fy(y) }))}</button></p>
  ${ycOffices(y)}
  <div class="yc-s"><span class="k">${esc(t('People'))}</span><dl>${people}</dl></div>
  <div class="yc-s"><span class="k">${esc(t('Economy'))}</span><dl>${econ}</dl></div>
  <div class="yc-s"><span class="k">${esc(t('Prices'))}</span><dl>${prices}</dl></div>
  <div class="yc-s"><span class="k">${esc(t('Life in Lebanon'))}</span>${ycLife(y)}</div>
  <p class="note yc-foot">${esc(t('Every number links to its source; hover a number for the source\'s note. "no data" means nothing citable was found for this year.'))}</p>`;
}
function openYearCard(y, opts = {}) {
  y = Math.max(1800, Math.min(2026, Math.floor(+y)));
  if (!Number.isFinite(y)) return;
  YC = y;
  const c = $('#yearCard');
  c.innerHTML = yearCardHTML(y);
  c.hidden = false;
  if (opts.focus !== false) { const h = $('#ycH'); if (h) h.focus({ preventScroll: true }); }
}
function closeYearCard() {
  const c = $('#yearCard');
  if (c.hidden) return;
  c.hidden = true; YC = null;
}
