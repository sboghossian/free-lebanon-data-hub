/* ------------------------------------------------------------ v4 bands: Economy / People / Prices groups, and the PM and BDL governor strips */
// Population: the modelled resident series reaches back to 1920, so the 100-year view has a line.
Object.assign(BY_BAND.pop, { map: yearMap('ppl_pop_resident_model'), sub: N('modelled (OWID, UN)'), src: 'ppl_pop_resident_model' });
const mBands = [
  { id: 'emig', name: N('Net migration'), sub: N('modelled; <0 = leaving'), map: yearMap('ppl_emig_wb_net_migration_model'), kind: 'line', dom: [-300000, 760000], ticks: [200000, 600000],
    tf: v => t('{v}k', { v: v / 1000 }), rf: v => t('{v} people, net (modelled)', { v: fmt(v, 0) }), src: 'ppl_emig_wb_net_migration_model' },
  { id: 'refug', name: N('Refugees registered'), sub: N('UNHCR Syrians, UNRWA'), draw: drawMulti, dom: [0, 1200000], ticks: [500000, 1000000], tf: v => t('{v}m', { v: v / 1e6 }),
    ser: [['ppl_syrian_refugees_unhcr', N('Syrians (UNHCR)'), 'm1'], ['ppl_palestine_refugees_unrwa', N('Palestine refugees (UNRWA)'), 'm2']] },
  { id: 'air', name: N('Airport passengers'), sub: N('Beirut, a year'), map: yearMap('ppl_airport_pax_annual'), kind: 'bars', dom: [0, 9e6], ticks: [3e6, 6e6], tf: v => t('{v}m', { v: v / 1e6 }),
    rf: v => t('{v} million passengers', { v: fmt(v / 1e6, 2) }), src: 'ppl_airport_pax_annual' },
  { id: 'tour', name: N('Tourist arrivals'), sub: N('a year'), map: yearMap('ppl_tourist_arrivals'), kind: 'line', dom: [0, 2.4e6], ticks: [1e6, 2e6], tf: v => t('{v}m', { v: v / 1e6 }),
    rf: v => t('{v} million arrivals', { v: fmt(v / 1e6, 2) }), src: 'ppl_tourist_arrivals' },
  { id: 'bigmac', name: N('Big Mac, US$'), sub: N('Economist index'), draw: drawPts, src: 'px_bigmac_usd', dom: [0, 7], ticks: [2, 4, 6], tf: v => '$' + v, rf: v => t('US${v}', { v: fmt(v, 2) }) },
  { id: 'bmlbp', name: N('Big Mac, LBP'), sub: N('Economist index, log'), draw: drawPts, src: 'px_bigmac_lbp', log: true, dom: [1000, 1e6], ticks: [1e4, 1e5], tf: v => t('{v}k', { v: fmt(v / 1000) }), rf: v => t('{v} LBP', { v: fmt(v, 0) }) },
  { id: 'bread', name: N('Bread bundle'), sub: N('LBP, official, log'), draw: drawPts, src: 'px_bread', log: true, dom: [1000, 1e5], ticks: [1e4], tf: v => t('{v}k', { v: fmt(v / 1000) }), rf: v => t('{v} LBP', { v: fmt(v, 0) }) },
  { id: 'petrol', name: N('Petrol, 20 L'), sub: N('LBP, ministry, log'), draw: drawPts, src: 'px_petrol', log: true, dom: [1e4, 1e7], ticks: [1e5, 1e6], tf: v => v >= 1e6 ? t('{v}m', { v: fmt(v / 1e6) }) : t('{v}k', { v: fmt(v / 1000) }), rf: v => t('{v} LBP', { v: fmt(v, 0) }) },
  { id: 'minwage', name: N('Minimum wage'), sub: N('US$ a month'), draw: drawPts, src: 'px_minwage_usd', dom: [0, 500], ticks: [200, 400], tf: v => '$' + v, rf: v => t('US${v} a month', { v: fmt(v, 0) }) },
];
mBands.forEach(b => { BANDS.push(b); BY_BAND[b.id] = b; });
const BAND_GROUPS = [[N('Economy'), ['gdppc', 'lbp', 'infl', 'debt', 'remit', 'gdpusd']], [N('People'), ['pop', 'emig', 'refug', 'air', 'tour']],
  [N('Prices'), ['bigmac', 'bmlbp', 'bread', 'petrol', 'minwage']]];
function bandCtlHTML() {
  return BAND_GROUPS.map(([g, ids]) => `<span class="bgrp" role="group" aria-label="${esc(t('{g} bands', { g: t(g) }))}"><span class="k bc-k">${esc(t(g))}</span>${ids.map(id => `<button type="button" class="chip bc" data-band="${id}" aria-pressed="${TL.bands.has(id)}">${esc(t(BY_BAND[id].name))}</button>`).join('')}</span>`).join('');
}
function bandHead(b, top, BH, L, W, R) {
  return `<text class="gut" x="18" y="${top + 16}">${esc(t(b.name))}</text><text class="gut-s" x="18" y="${top + 29}">${esc(t(b.sub))}</text><rect class="band-bg" x="${L}" y="${top}" width="${W - R - L}" height="${BH}"/>`;
}
function bandHatch(a, c, note, x, z, top, BH) {
  const xa = x(Math.max(a, z.x0)), xb = x(Math.min(c, z.x1));
  if (xb - xa < 2) return '';
  return `<rect class="gap-z" x="${f1(xa)}" y="${top + 2}" width="${f1(xb - xa)}" height="${BH - 4}"/>` + (xb - xa > note.length * 5.4 + 16 ? `<text class="gap-t" x="${f1(xa + 6)}" y="${top + BH - 7}">${esc(note)}</text>` : '');
}
function bandTicks(b, y, L, W, R) {
  return b.ticks.map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="ax tki" x="${L + 3}" y="${f1(y(v) - 2)}">${b.tf(v)}</text>`).join('');
}
// Dated price points (month or year, some spans). Drawn where they exist, hatched before the first.
function drawPts(b, top, BH, x, z, L, W, R) {
  const s = SER[b.src] || { points: [] };
  const pts = s.points.map(p => {
    const d = String(p[0]), r = d.match(/^(\d{4})-(\d{4})$/);
    if (r) return { d, t: (+r[1] + +r[2] + 1) / 2, a: +r[1], c: +r[2] + 1, v: p[1], n: p[2] || '' };
    const t = dy(d);
    return isNaN(t) ? null : { d, t, v: p[1], n: p[2] || '' };
  }).filter(o => o && typeof o.v === 'number').sort((p, q) => p.t - q.t);
  const y = b.log ? logS(b.dom[0], b.dom[1], top + BH - 3, top + 4) : lin(b.dom[0], b.dom[1], top + BH - 3, top + 4);
  const cy = v => f1(y(Math.max(v, b.log ? b.dom[0] : -1e12)));
  let g = bandHead(b, top, BH, L, W, R) + bandTicks(b, y, L, W, R) + '<g clip-path="url(#tlclip)">';
  if (pts.length > 1) g += `<path class="bd-line px-l" d="${pts.map((o, i) => (i ? 'L' : 'M') + f1(x(o.t)) + ',' + cy(o.v)).join(' ')}"/>`;
  pts.forEach(o => {
    if (o.a != null) g += `<line class="spn-b" x1="${f1(x(o.a))}" x2="${f1(x(o.c))}" y1="${cy(o.v)}" y2="${cy(o.v)}"/>`;
    g += `<circle class="pt" cx="${f1(x(o.t))}" cy="${cy(o.v)}" r="3" data-tip="${tipA(pdate(o.d) + ': ' + b.rf(o.v), o.n ? ' ' + t(o.n) : ' ' + tc(serLabel(b.src)))}"/>`;
  });
  g += '</g>';
  if (pts.length) g += bandHatch(z.x0, Math.floor(pts[0].a != null ? pts[0].a : pts[0].t), t('no citable price before {y}', { y: fy(Math.floor(pts[0].a != null ? pts[0].a : pts[0].t)) }), x, z, top, BH);
  else g += bandHatch(z.x0, z.x1, t('no data'), x, z, top, BH);
  const get = (t, yr) => { const o = pts.filter(q => Math.floor(q.t) === yr || (q.a != null && yr >= q.a && yr < q.c)).pop(); return o ? b.rf(o.v) + (o.d !== String(yr) ? ' (' + pdate(o.d) + ')' : '') : ''; };
  return { g, get };
}
// Two yearly series on one band.
function drawMulti(b, top, BH, x, z, L, W, R) {
  const y = lin(b.dom[0], b.dom[1], top + BH - 3, top + 4);
  let g = bandHead(b, top, BH, L, W, R) + `<line class="gl-0" x1="${L}" x2="${W - R}" y1="${f1(y(0))}" y2="${f1(y(0))}"/>` + bandTicks(b, y, L, W, R) + '<g clip-path="url(#tlclip)">';
  const maps = b.ser.map(([id, label, cls]) => ({ id, label, cls, m: yearMap(id) }));
  maps.forEach(s => {
    const ys = Object.keys(s.m).map(Number).sort((p, q) => p - q);
    if (ys.length > 1) g += `<path class="bd-line ${s.cls}" d="${ys.map((yr, i) => (i ? 'L' : 'M') + f1(x(yr + 0.5)) + ',' + f1(y(s.m[yr]))).join(' ')}"/>`;
    const last = ys.filter(yr => yr + 0.5 <= z.x1 && yr + 0.5 >= z.x0).pop();
    if (last != null && x(last + 0.5) > L + 120) g += `<text class="lab bd-lab" x="${f1(x(last + 0.5) - 4)}" y="${f1(y(s.m[last]) + (s.cls === 'm2' ? 11 : -4))}" text-anchor="end">${esc(t(s.label).split(' (')[0])}</text>`;
  });
  g += '</g>';
  const first = Math.min(...maps.map(s => Math.min(...Object.keys(s.m).map(Number))));
  g += bandHatch(z.x0, first, t('no registration data before {y}', { y: fy(first) }), x, z, top, BH);
  const get = (tm, yr) => maps.filter(s => s.m[yr] != null).map(s => t(s.label).split(' (')[0] + ' ' + t('{v}m', { v: fmt(s.m[yr] / 1e6, 2) })).join(' · ');
  return { g, get };
}
// Office strips for prime ministers and BDL governors, packed into rows where terms overlap (disputes).
function officeStrip(code, yy, x, z) {
  const isR = code === 'R', rowH = 15, list = (isR ? [].concat(...RULER_CODES.map(c => OFFS[c])) : (OFFS[code] || [])).filter(o => o.name !== 'Vacuum')
    .map(o => ({ o, a: Math.max(dy(o.a), z.x0), b: Math.min(o.open ? (isR ? 1920.67 : NOW_T) : dy(o.b), z.x1) })).filter(q => q.b > z.x0 && q.a < z.x1).sort((p, q) => p.a - q.a);
  if (isR && !list.length) return { g: '', h: 0 };
  const rows = pack(list, x, -1), pick = code === 'PM' ? F.pm : F.gov;
  let g = `<text class="gut-s strip-l" x="8" y="${yy + 11}">${esc(isR ? t('Rulers') : code === 'PM' ? t('Prime ministers') : t('BDL governors'))}</text>`;
  list.forEach(q => {
    const ey = yy + q.k * rowH, xa = x(q.a), xb = Math.max(x(q.b), xa + 2), parts = q.o.name.split(' '), lab = isR && /^(I|II|III|IV|V|VI|VII|\d+)$/.test(parts[parts.length - 1]) ? parts.slice(-2).join(' ') : parts[parts.length - 1];
    const tipx = tipA(offName(q.o.code) + ': ' + q.o.name, ` ${t('{a} to {b}', { a: fmtDate(q.o.a), b: q.o.open ? (isR ? t('end not recorded') : t('now')) : fmtDate(q.o.b) })}${q.o.acting ? ', ' + t('acting') : ''}${q.o.note ? '. ' + q.o.note : ''}${isR ? '' : ' ' + t('Click to filter.')}`);
    g += `<rect class="era off-s s-${isR ? 'R' : code}${q.o.acting ? ' acting' : ''}${!isR && pick === q.o.name ? ' sel' : ''}" x="${f1(xa)}" y="${ey + 1}" width="${f1(xb - xa)}" height="${rowH - 3}" rx="2"${isR ? '' : ` data-office="${code}" data-name="${esc(q.o.name)}"`} data-tip="${tipx}"/>`;
    if (xb - xa > lab.length * 5.6 + 8) g += `<text class="era-t" x="${f1(xa + 4)}" y="${ey + rowH - 5}" pointer-events="none">${esc(lab)}</text>`;
  });
  return { g, h: Math.max(rows * rowH, 14) + 3 };
}
