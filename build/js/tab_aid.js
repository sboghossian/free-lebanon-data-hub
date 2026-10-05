/* ------------------------------------------------------------ Aid & NGOs tab (leg B-aid). Data (lazy): data/aid/fts-years.json, donors.json, appeals.json, presence.json, wb.json, reach.json, data/geo/lebanon.json (map).
   Views: aid over time (FTS), donors (FTS and OECD, side by side, never added), appeals, who works where, World Bank projects, people reached (self-reported by the agencies). Hash: #aid, #aid/<view>.
   Rules in every view: each chart names its source and licence; FTS, OECD ODA and World Bank commitments overlap and are never summed; reach and presence are self-reported. Downloads live in the Data tab (#data/aid). */
const AID_VIEWS = [{ id: 'time', label: N('Aid over time') }, { id: 'donors', label: N('Donors') }, { id: 'appeals', label: N('Appeals') }, { id: 'where', label: N('Who works where') }, { id: 'wb', label: N('World Bank projects') }, { id: 'reach', label: N('People reached') }];
const AID = { view: 'time', year: null, fy: null, fx: false, fd: null, oy: null, om: 'net', od: null, sec: '', per: '', dist: '', show: 24, wbs: 'all', wbShow: 25, ry: null };
/* words that FTS, OECD and the World Bank use; marked here so the build checks their translations */
const AID_WORDS = [N('Governments'), N('Multilateral Organizations'), N('NGOs'), N('Not specified'), N('Other'), N('Pooled Funds'), N('Private Organizations'), N('Red Cross/Red Crescent Organizations'),
  N('Country-based UN Pooled Funds'), N('Global UN Pooled Funds'), N('International Government Entities'), N('International NGOs'), N('International Private Organizations'), N('International Red Cross/Red Crescent Movement'),
  N('Internationally Affiliated Organizations'), N('Local Governments'), N('Local NGOs/CSOs'), N('Local/National Private Organizations'), N('National Governments'), N('National NGOs/CSOs'), N('Other Multilateral Organizations'),
  N('Other Pooled Funds'), N('Red Cross/Red Crescent National Societies'), N('UN Agencies'), N('country'), N('multilateral'), N('private foundation'), N('postcode lottery'), N('aggregate'),
  N('Flash appeal'), N('Regional response plan'), N('Active'), N('Closed'), N('Dropped'), N('Pipeline'), N('United Nations'), N('International NGO'), N('National NGO'), N('Not stated'),
  N('Basic assistance'), N('Food security'), N('Child protection'), N('Protection'), N('Health'), N('Livelihood'), N('Cash programming'), N('Nutrition'), N('Education'), N('Water, sanitation and hygiene'), N('Shelter'),
  N('Gender-based violence'), N('Emergency shelter and NFI'), N('Site management'), N('Camp coordination and management'), N('Social stability'),
  N('Public Administration'), N('Social Protection'), N('Water, Sanitation and Waste Management'), N('Transportation'), N('Energy and Extractives'), N('Industry, Trade and Services'), N('Agriculture, Fishing and Forestry'),
  N('Information and Communications Technologies'), N('Financial Sector'), N('(Historic)Electric Power & Other Energy'), N('Social Sustainability and Inclusion'), N('Energy and Mineral Resources'), N('Digital Development'), N('(Historic)Multisector'),
  N('Food Security and Agriculture'), N('All populations'), N('Vulnerable Lebanese'), N('Displaced Syrians'), N('Palestine refugees in Lebanon'), N('Palestinian refugees from Syria'), N('Migrants'), N('Livelihoods'), N('Water, Sanitation and Hygiene'), N('Site Management and Coordination'), N('Basic Assistance'),
  N('individuals'), N('households'), N('consultations'), N('students'), N('MSMEs'), N('services'), N('children')];
const aidUsd = v => t('US$ {n}', { n: nfCompact(v) });
const aidUsdFull = v => t('US$ {n}', { n: nf(v) });
const aidPct = v => nf(v, 0) + '%';
const aidSrcOne = s => {
  const nm = `<bdi>${s.url && /^https?:/.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}</bdi>`;
  const lic = s.license ? `<bdi>${esc(String(s.license).split(/[(;]/)[0].trim())}</bdi>` : esc(t('Not stated by the publisher'));
  return `${nm}. ${esc(t('Licence'))}: ${lic}.${s.retrieved ? ' ' + esc(t('Retrieved {d}', { d: fmtDate(s.retrieved) })) + '.' : ''}`;
};
const aidSrc = (list, extra) => `<p class="aid-src note"><b>${esc(t('Source'))}</b>: ${[].concat(list).map(aidSrcOne).join(' ')}${extra ? ' ' + esc(extra) : ''}</p>`;
/* a card (same look as the other tabs): returns the element to fill. o = {title, unit, note, wide, srcs, extra} */
function aidCard(parent, o) {
  const f = document.createElement('figure');
  f.className = 'fb-card' + (o.wide ? ' wide' : '');
  f.innerHTML = `<figcaption><h4 class="fb-t">${o.tag ? `<span class="aid-tag">${esc(o.tag)}</span>` : ''}${esc(o.title)}</h4>${o.unit ? `<p class="fb-u mono dim">${esc(o.unit)}</p>` : ''}${o.note ? `<p class="note">${esc(o.note)}</p>` : ''}</figcaption><div class="aid-ctl" data-ctl hidden></div><div class="aid-body" data-out></div>${o.srcs ? aidSrc(o.srcs, o.extra) : ''}`;
  parent.appendChild(f);
  return { fig: f, ctl: f.querySelector('[data-ctl]'), out: f.querySelector('[data-out]') };
}
function aidLine(el, o) {
  if (el._ch) el._ch.destroy();
  el._ch = hubLine(el, o);
  fbFixTicks(el);
  if (window.MutationObserver) new MutationObserver(() => fbFixTicks(el)).observe(el, { childList: true });
}
const aidYearSel = (id, years, cur, label, partial) => `<label class="sel" for="${id}">${esc(label)}<select id="${id}">${years.map(y => `<option value="${y}"${y === cur ? ' selected' : ''}>${fy(y)}${partial && partial.includes(y) ? ' ' + esc(t('(part of the year)')) : ''}</option>`).join('')}</select></label>`;
/* a ranked list: items [{id, label (html), value}], o = {fmt, sel, onPick, max}; with onPick the labels are buttons */
function aidRank(el, items, o) {
  const mx = o.max || Math.max(...items.map(i => i.value), 1);
  el.innerHTML = items.length ? `<ul class="aid-rk">${items.map(i => `<li${i.id === o.sel ? ' class="on"' : ''}>${o.onPick ? `<button type="button" class="aid-rl" data-id="${esc(i.id)}" aria-pressed="${i.id === o.sel}">${i.label}</button>` : `<span class="aid-rl">${i.label}</span>`}<span class="aid-rb" aria-hidden="true"><i style="width:${(Math.max(0, i.value) / mx * 100).toFixed(1)}%"></i></span><span class="aid-rv mono">${esc(o.fmt(i.value))}</span></li>`).join('')}</ul>` : `<p class="hub-empty">${esc(t('No data for this selection.'))}</p>`;
  if (o.onPick) el.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => o.onPick(b.dataset.id)));
}
const aidLab = (name, sub) => `<bdi>${esc(name)}</bdi>${sub ? `<span class="dim">${esc(sub)}</span>` : ''}`;
const aidType = (ty, sub) => t(sub || ty);

/* ---------- view: aid over time (FTS) ---------- */
function aidTime(el) {
  fbLoad(el, ['data/aid/fts-years.json'], F => {
    const Y = F.years, full = Y.filter(r => !r.p), part = Y.filter(r => r.p), last = full[full.length - 1], peak = full.reduce((a, r) => (r.tot > a.tot ? r : a), full[0]);
    if (!Y.some(r => r.y === AID.year)) AID.year = last.y;
    el.innerHTML = fbStats([
      { k: t('Latest full year'), v: aidUsd(last.tot), n: fy(last.y) },
      { k: t('Highest year'), v: aidUsd(peak.tot), n: fy(peak.y) },
      { k: t('Years on record'), v: t('{a} to {b}', { a: fy(Y[0].y), b: fy(Y[Y.length - 1].y) }), n: t('{n} years', { n: nf(Y.length) }) }]) +
      `<p class="aid-band">${esc(t('FTS counts money that donors and agencies report to the UN. It is voluntary and incomplete, and it counts money moved, not what it achieved. A year is the usage year FTS records, not the date of the gift.'))}</p><div class="fb-grid" data-g></div>`;
    const g = el.querySelector('[data-g]'), maxV = Math.max(...Y.map(r => r.tot));
    const c1 = aidCard(g, { title: t('Humanitarian funding reported to FTS, per year'), unit: t('US dollars per year, paid and committed flows to Lebanon'), wide: true, srcs: [F.src],
      note: t('Marked: the 2006 war, the 2019 to 2020 financial crisis, the Beirut port explosion of 4 August 2020 and the war of 2023 to 2026. A year is marked when the event fell in it. The dashed line is a part year.') });
    aidLine(c1.out, { series: [{ id: 'tot', label: t('Reported total'), pts: Y.map(r => [r.y, r.tot]), estFrom: part.length ? last.y : null }, { id: 'ex', label: t('Excluding pass-through flows'), pts: Y.map(r => [r.y, r.tot - r.pt]), dash: true, estFrom: part.length ? last.y : null }],
      height: 290, yMin: 0, yMax: Math.ceil(maxV * 1.18 / 5e8) * 5e8, xFmt: v => fy(Math.round(v)), yFmt: nfCompact, valFmt: aidUsd, title: t('Humanitarian funding reported to FTS, per year'),
      markers: [{ x: 2006, label: t('War') }, { x: 2020, label: t('Port blast') }], zones: [{ x0: 2018.5, x1: 2020.5, label: t('Crisis') }, { x0: 2022.5, x1: 2027, label: t('War') }] });
    c1.out.insertAdjacentHTML('afterend', `<p class="note">${esc(t('Pass-through flows are money one agency or fund passes on to another, so one dollar can be counted twice. The dashed line leaves them out. Pledges are not included.'))}${part.length ? ' ' + esc(t('{y} is a part year, up to {d}.', { y: fy(part[0].y), d: fmtDate(F.src.retrieved) })) : ''}</p>`);
    const c2 = aidCard(g, { title: t('Who received it'), wide: true, srcs: [F.src], extra: t('Recipients are the first organisation to receive the money, so pooled funds appear as recipients.') });
    c2.ctl.hidden = false;
    c2.ctl.innerHTML = aidYearSel('aidYr', Y.map(r => r.y).reverse(), AID.year, t('Year'), part.map(r => r.y));
    const draw = () => {
      const r = Y.find(x => x.y === AID.year), by = new Map();
      r.ty.forEach(x => { const k = x[1] || x[0]; by.set(k, { v: (by.get(k) ? by.get(k).v : 0) + x[2], ty: x[0], sub: x[1] }); });
      const types = [...by].sort((a, b) => b[1].v - a[1].v).slice(0, 8).map(([k, o]) => ({ id: k, label: aidLab(t(o.sub || o.ty), o.sub ? t(o.ty) : ''), value: o.v }));
      c2.out.innerHTML = `<p class="note">${esc(t('In {y} FTS recorded {a} to Lebanon, of which {b} ({c}) is pass-through.', { y: fy(r.y), a: aidUsdFull(r.tot), b: aidUsdFull(r.pt), c: aidPct(r.tot ? r.pt / r.tot * 100 : 0) }))}</p><h5 class="aid-h">${esc(t('By type of recipient'))}</h5><div data-ty></div><h5 class="aid-h">${esc(t('Largest recipients'))}</h5><div data-rc></div>`;
      aidRank(c2.out.querySelector('[data-ty]'), types, { fmt: aidUsd });
      aidRank(c2.out.querySelector('[data-rc]'), r.rc.map(x => ({ id: x[0], label: aidLab(x[0], aidType(x[1], x[2])), value: x[3] })).slice(0, 12), { fmt: aidUsd });
    };
    c2.ctl.querySelector('select').addEventListener('change', ev => { AID.year = +ev.target.value; draw(); });
    draw();
  });
}

/* ---------- view: donors. FTS and OECD sit side by side and are never added ---------- */
function aidDonors(el) {
  fbLoad(el, ['data/aid/donors.json'], X => {
    const F = X.fts, O = X.oecd, fyrs = Object.keys(F.years).map(Number).sort((a, b) => b - a), fpart = fyrs.filter(y => F.years[y].p);
    const od = O.donors.filter(d => d.k !== 'aggregate'), agg = O.donors.filter(d => d.k === 'aggregate'), oyrs = [], o0 = Math.min(...O.donors.map(d => (d.net || [[O.last]])[0][0])); for (let y = O.last; y >= o0; y--) oyrs.push(y);
    if (!F.years[AID.fy]) AID.fy = fyrs.find(y => !F.years[y].p);
    if (!AID.oy) AID.oy = O.last - 1;
    el.innerHTML = `<p class="aid-band">${esc(t('Two sources, kept apart. FTS counts humanitarian funding that donors and agencies report to the UN. The OECD counts official development assistance disbursed by donor governments and agencies. They overlap, so no figure on this page adds one to the other.'))}</p><div class="fb-grid" data-g></div>`;
    const g = el.querySelector('[data-g]');
    /* FTS */
    const cf = aidCard(g, { title: t('FTS: donors to Lebanon'), unit: t('US dollars, by the organisation that gave the money'), srcs: [F.src], note: t('Source organisations include governments, EU bodies, UN agencies and pooled funds. Pass-through money passed on by an agency or fund appears again under its own name.') });
    cf.ctl.hidden = false;
    cf.ctl.innerHTML = aidYearSel('aidFy', fyrs, AID.fy, t('Year'), fpart) + `<button type="button" class="chip sm-c" id="aidFx" aria-pressed="${AID.fx}">${esc(t('Leave out pass-through flows'))}</button>`;
    const drawF = () => {
      const Y = F.years[AID.fy], k = AID.fx ? 2 : 1, rows = Y.rows.map(r => ({ id: String(r[0]), n: F.donors[r[0]], v: r[k] })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
      if (AID.fd == null || !F.donors[AID.fd]) AID.fd = rows.length ? +rows[0].id : null;
      const tys = new Map(); Y.ty.forEach(x => { const q = x[1] || x[0]; tys.set(q, { v: (tys.get(q) ? tys.get(q).v : 0) + x[AID.fx ? 3 : 2], ty: x[0], sub: x[1] }); });
      cf.out.innerHTML = `<p class="note">${esc(t('{n} donors recorded in {y}.', { n: nf(Y.n || rows.length), y: fy(AID.fy) }))}</p><h5 class="aid-h">${esc(t('By type of donor'))}</h5><div data-ty></div><h5 class="aid-h">${esc(t('Largest donors. Pick one to see its years.'))}</h5><div data-rk></div><div data-ch class="hc"></div>`;
      aidRank(cf.out.querySelector('[data-ty]'), [...tys].sort((a, b) => b[1].v - a[1].v).slice(0, 6).map(([q, o]) => ({ id: q, label: aidLab(t(o.sub || o.ty), o.sub ? t(o.ty) : ''), value: o.v })), { fmt: aidUsd });
      aidRank(cf.out.querySelector('[data-rk]'), rows.slice(0, 12).map(r => ({ id: r.id, label: aidLab(r.n[0], aidType(r.n[1], r.n[2])), value: r.v })), { fmt: aidUsd, sel: String(AID.fd), onPick: id => { AID.fd = +id; drawF(); } });
      const pts = fyrs.slice().reverse().map(y => { const r = F.years[y].rows.find(q => q[0] === AID.fd); return r ? [y, r[k]] : null; }).filter(Boolean);
      if (AID.fd != null) aidLine(cf.out.querySelector('[data-ch]'), { series: [{ id: 'd', label: F.donors[AID.fd][0], pts }], height: 200, yMin: 0, xFmt: v => fy(Math.round(v)), yFmt: nfCompact, valFmt: aidUsd, title: F.donors[AID.fd][0], legend: true });
    };
    cf.ctl.querySelector('select').addEventListener('change', ev => { AID.fy = +ev.target.value; drawF(); });
    cf.ctl.querySelector('#aidFx').addEventListener('click', ev => { AID.fx = !AID.fx; ev.currentTarget.setAttribute('aria-pressed', String(AID.fx)); drawF(); });
    drawF();
    /* OECD */
    const co = aidCard(g, { title: t('OECD: official development assistance to Lebanon'), unit: t('US dollars, net disbursements by donor'), srcs: [O.src], note: t('Multilateral rows show what the organisation itself disbursed, not what governments gave it. The latest year is preliminary.') });
    co.ctl.hidden = false;
    co.ctl.innerHTML = aidYearSel('aidOy', oyrs, AID.oy, t('Year'), [O.last]) + `<span class="chips" role="group" aria-label="${esc(t('Measure'))}">${[['net', t('Net ODA')], ['hum', t('Humanitarian aid')]].map(([id, lb]) => `<button type="button" class="chip sm-c" data-m="${id}" aria-pressed="${AID.om === id}">${esc(lb)}</button>`).join('')}</span>`;
    const drawO = () => {
      const m = AID.om, rows = od.map(d => ({ d, v: ((d[m] || []).find(p => p[0] === AID.oy) || [])[1] })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
      if (!AID.od || !od.some(d => d.c === AID.od)) AID.od = rows.length ? rows[0].d.c : null;
      co.out.innerHTML = `<p class="note">${esc(t('{n} donors with a figure in {y}.', { n: nf(rows.length), y: fy(AID.oy) }))}</p><h5 class="aid-h">${esc(t('Largest donors. Pick one to see its years.'))}</h5><div data-rk></div><div data-ch class="hc"></div>`;
      aidRank(co.out.querySelector('[data-rk]'), rows.slice(0, 12).map(r => ({ id: r.d.c, label: aidLab(r.d.n, t(r.d.k)), value: r.v * 1e6 })), { fmt: aidUsd, sel: AID.od, onPick: id => { AID.od = id; drawO(); } });
      const dd = od.find(d => d.c === AID.od);
      if (dd && dd[m]) aidLine(co.out.querySelector('[data-ch]'), { series: [{ id: 'd', label: dd.n, pts: dd[m].map(p => [p[0], p[1] * 1e6]) }], height: 200, yMin: 0, xFmt: v => fy(Math.round(v)), yFmt: nfCompact, valFmt: aidUsd, title: dd.n, legend: true });
    };
    co.ctl.querySelector('select').addEventListener('change', ev => { AID.oy = +ev.target.value; drawO(); });
    co.ctl.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { AID.om = b.dataset.m; co.ctl.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawO(); }));
    drawO();
    const all = agg.find(d => d.c === 'ALLD');
    if (all && all.net) {
      const ca = aidCard(g, { title: t('OECD: all official donors, net ODA to Lebanon, {a} to {b}', { a: fy(all.net[0][0]), b: fy(all.net[all.net.length - 1][0]) }), unit: t('US dollars per year, current prices and constant 2024 prices'), wide: true, srcs: [O.src], note: t('This total already contains every donor in the list above. Do not add them.') });
      aidLine(ca.out, { series: [{ id: 'cur', label: t('Current prices'), pts: all.net.map(p => [p[0], p[1] * 1e6]) }].concat(all.const ? [{ id: 'con', label: t('Constant 2024 prices'), pts: all.const.map(p => [p[0], p[1] * 1e6]), dash: true }] : []),
        height: 260, yMin: 0, xFmt: v => fy(Math.round(v)), yFmt: nfCompact, valFmt: aidUsd, title: t('OECD: all official donors, net ODA to Lebanon, {a} to {b}', { a: fy(all.net[0][0]), b: fy(all.net[all.net.length - 1][0]) }) });
    }
  });
}

/* ---------- view: appeals (requirements against funding) ---------- */
function aidFundRows(list, o) {
  const mx = Math.max(...list.map(p => Math.max(o.req(p) || 0, o.fund(p) || 0)), 1);
  return `<ul class="aid-fl">${list.map(p => {
    const rq = o.req(p), fu = o.fund(p) || 0, pc = o.pct(p);
    const txt = o.say ? o.say(rq, fu, pc) : rq ? (pc != null ? t('Asked for {a}. Funding reported: {b}. {c} funded.', { a: aidUsd(rq), b: aidUsd(fu), c: aidPct(pc) }) : t('Asked for {a}. Funding reported: {b}.', { a: aidUsd(rq), b: aidUsd(fu) })) : t('No requirement stated. Funding reported: {b}.', { b: aidUsd(fu) });
    return `<li class="aid-fr"><div class="aid-fh">${esc(fy(p.year))} <span class="dim"><bdi>${esc(p.name)}</bdi>${p.type && p.type !== 'Other' ? ' · ' + esc(t(p.type)) : ''}</span></div><div class="aid-fb" aria-hidden="true">${rq ? `<i class="rq" style="width:${(rq / mx * 100).toFixed(1)}%"></i>` : ''}<i class="fu" style="width:${(Math.min(fu, mx) / mx * 100).toFixed(1)}%"></i></div><p class="aid-fv">${esc(txt)}</p>${o.extra ? o.extra(p) : ''}</li>`;
  }).join('')}</ul>`;
}
const aidKey = () => `<p class="aid-key" aria-hidden="true"><span><i class="rq"></i>${esc(t('Asked for'))}</span><span><i class="fu"></i>${esc(t('Funding reported'))}</span></p>`;
function aidAppeals(el) {
  fbLoad(el, ['data/aid/appeals.json'], A => {
    const all = A.appeals, left = all.filter(p => p.scope === 'global' && !p.funding_to_lebanon_usd), P = all.filter(p => !left.includes(p)).sort((a, b) => b.year - a.year || b.plan_id - a.plan_id);
    const loc = P.filter(p => p.scope === 'country'), reg = P.filter(p => p.scope !== 'country');
    el.innerHTML = `<p class="aid-band">${esc(t('Appeals are what the UN and its partners asked donors for. The share funded is funding reported to FTS divided by what was asked. Regional refugee plans cover several countries: their bars are whole-plan figures, and the Lebanon part is shown where OCHA gives it.'))}</p><div class="fb-grid one" data-g></div>`;
    const g = el.querySelector('[data-g]');
    const c1 = aidCard(g, { title: t('Appeals for Lebanon only'), unit: t('US dollars. Bars are scaled to the largest plan in this card.'), srcs: A.src, wide: true });
    c1.out.innerHTML = aidKey() + aidFundRows(loc, { req: p => p.requirements_usd, fund: p => p.funding_planwide_usd, pct: p => p.pct_funded });
    const c2 = aidCard(g, { title: t('Regional refugee response plans, whole-plan figures'), unit: t('US dollars. Bars are scaled to the largest plan in this card.'), srcs: A.src, wide: true,
      note: t('These plans cover Lebanon and neighbouring countries. Earlier plans for Iraqi refugees are kept because they list funding to Lebanon.') });
    c2.out.innerHTML = aidKey() + aidFundRows(reg, { req: p => p.requirements_usd, fund: p => p.funding_planwide_usd, pct: p => p.pct_funded_planwide, extra: p => `<p class="aid-fv sub">${esc(p.requirements_lebanon_usd_hapi ? t('Lebanon part, per OCHA HAPI: asked for {a}{c}. FTS reports {b} to Lebanon.', { a: aidUsd(p.requirements_lebanon_usd_hapi), b: aidUsd(p.funding_to_lebanon_usd || 0), c: p.pct_funded_lebanon_hapi_basis != null ? ', ' + t('{p} funded', { p: aidPct(p.pct_funded_lebanon_hapi_basis) }) : '' }) : t('FTS reports {b} to Lebanon.', { b: aidUsd(p.funding_to_lebanon_usd || 0) }))}</p>` });
    if (left.length) g.insertAdjacentHTML('beforeend', `<p class="note">${esc(tp('{n} global COVID-19 plan that lists no funding to Lebanon is left out.', '{n} global COVID-19 plans that list no funding to Lebanon are left out.', left.length))}</p>`);
  });
}

/* ---------- view: who works where (operational presence, self-reported by partners) ---------- */
const aidPerLab = p => /-Q\d$/.test(p) ? t('Quarter {q} {y}', { q: nf(+p.slice(-1)), y: fy(+p.slice(0, 4)) }) : fbLongDate(p);
const aidJoin = a => a.join(LANG === 'ar' ? '، ' : ', ');
function aidWhere(el) {
  fbLoad(el, ['data/aid/presence.json', 'data/geo/lebanon.json'], (P, geo) => {
    const arN = {}; P.districts.forEach(d => { arN[d[0]] = d[2]; });
    const G = Object.assign({}, geo, { adm2: geo.adm2.map(a => Object.assign({}, a, { ar: arN[a.p] || a.ar })) });
    const dn = i => (LANG === 'ar' && P.districts[i][2]) ? P.districts[i][2] : P.districts[i][1], dIdx = {}; P.districts.forEach((d, i) => { dIdx[d[0]] = i; });
    const monthly = P.periods.filter(p => !/-Q/.test(p)), TYPES = P.types.concat([N('Not stated')]);
    el.innerHTML = `<p class="aid-band"><span class="aid-tag">${esc(t('Self-reported by partners'))}</span>${esc(t('Operational presence says which organisations report activity in a district and a sector. It does not say how much they do or how many people they reach. Counts are of distinct organisations, so they cannot be added across districts or sectors.'))}</p><div class="fb-grid one" data-g></div>`;
    const card = aidCard(el.querySelector('[data-g]'), { title: t('Organisations present, by district and sector'), wide: true, srcs: P.src, extra: t('Sector names follow each source. The monthly files (October 2023 to December 2024) and the 2025 quarter file name some sectors differently, for example Shelter and Emergency shelter and NFI, so they appear apart. Only spellings of the same name are merged. An organisation\'s type is the one the source gives for it in any month; where none does, it shows as not stated.') });
    card.out.innerHTML = '<div data-s></div><div class="aid-mapwrap" data-m></div><div data-o></div>';
    card.ctl.hidden = false;
    card.ctl.innerHTML = `<label class="sel" for="aidSec">${esc(t('Sector'))}<select id="aidSec"><option value="">${esc(t('All sectors'))}</option>${P.sectors.map((s, i) => `<option value="${i}"${String(i) === AID.sec ? ' selected' : ''}>${esc(t(s))}</option>`).join('')}</select></label>` +
      `<label class="sel" for="aidPer">${esc(t('Period'))}<select id="aidPer"><option value="">${esc(t('Any month, {a} to {b}', { a: aidPerLab(monthly[0]), b: aidPerLab(P.periods[P.periods.length - 1]) }))}</option>${P.periods.map((p, i) => `<option value="${i}"${String(i) === AID.per ? ' selected' : ''}>${esc(aidPerLab(p))}</option>`).join('')}</select></label>`;
    const draw = () => {
      const si = AID.sec === '' ? -1 : +AID.sec, pi = AID.per === '' ? -1 : +AID.per, rows = P.rows.filter(r => (si < 0 || r[2] === si) && (pi < 0 || r[3] === pi));
      const dO = new Map(), orgs = new Map();
      rows.forEach(r => { if (!dO.has(r[1])) dO.set(r[1], new Map()); const m = dO.get(r[1]); if (!m.has(r[0])) m.set(r[0], new Set()); m.get(r[0]).add(r[2]); if (!orgs.has(r[0])) orgs.set(r[0], new Set()); orgs.get(r[0]).add(r[1]); });
      const cnt = i => (dO.get(i) || new Map()).size, mx = Math.max(1, ...P.districts.map((_, i) => cnt(i))), rank = P.districts.map((_, i) => i).sort((a, b) => cnt(b) - cnt(a) || dn(a).localeCompare(dn(b))).filter(i => cnt(i));
      const tyc = [0, 0, 0, 0]; orgs.forEach((_, o) => { const k = P.orgs[o][2]; tyc[k < 0 ? 3 : k]++; });
      $('[data-s]', el).innerHTML = fbStats([{ k: t('Organisations'), v: nf(orgs.size), n: t('distinct, in this selection') }, { k: t('Districts with at least one'), v: nf(rank.length) + ' / ' + nf(P.districts.length), n: t('of the districts in the data') },
        { k: t('Most organisations in one district'), v: rank.length ? nf(cnt(rank[0])) : '', n: rank.length ? dn(rank[0]) : '' }]) + `<h5 class="aid-h">${esc(t('Organisations by type'))}</h5><div data-ty></div>`;
      aidRank($('[data-ty]', el), TYPES.map((n, k) => ({ id: n, label: aidLab(t(n)), value: tyc[k] })), { fmt: v => nf(v) });
      const sel = AID.dist && dIdx[AID.dist] != null && cnt(dIdx[AID.dist]) ? dIdx[AID.dist] : null;
      $('[data-m]', el).innerHTML = `<div><h5 class="aid-h">${esc(t('Organisations per district. Pick a district.'))}</h5>${fbMap(G, { level: 'adm2', click: true, labels: false, aria: t('Map of Lebanon by district: organisations present'),
        fill: a => { const v = dIdx[a.p] == null ? 0 : cnt(dIdx[a.p]); return { fill: v ? fbShade(Math.sqrt(v / mx), '--sea') : 'var(--stone)', title: tp('{n} organisation', '{n} organisations', v), on: a.p === AID.dist }; } })}${fbLegend(0, mx, v => nf(v), '--sea')}</div><div><h5 class="aid-h">${esc(t('Districts, ranked by number of organisations'))}</h5><div data-dr></div></div>`;
      fbMapClicks($('[data-m]', el), p => { AID.dist = AID.dist === p ? '' : p; AID.show = 24; draw(); });
      aidRank($('[data-dr]', el), rank.map(i => ({ id: P.districts[i][0], label: aidLab(dn(i)), value: cnt(i) })), { fmt: v => nf(v), sel: AID.dist, onPick: p => { AID.dist = AID.dist === p ? '' : p; AID.show = 24; draw(); } });
      const o = $('[data-o]', el);
      if (sel != null) {
        const lst = [...dO.get(sel)].map(([oi, ss]) => ({ oi, ss: [...ss].map(s => P.sectors[s]) })).sort((a, b) => b.ss.length - a.ss.length || P.orgs[a.oi][0].localeCompare(P.orgs[b.oi][0]));
        o.innerHTML = `<h5 class="aid-h">${esc(t('Organisations in {d}, ranked by number of sectors', { d: dn(sel) }))}</h5><ul class="aid-pl">${lst.slice(0, AID.show).map(x => { const og = P.orgs[x.oi]; return `<li><span class="aid-pn"><b><bdi>${esc(og[0])}</bdi></b>${og[1] ? ` <span class="dim"><bdi>${esc(og[1])}</bdi></span>` : ''}</span><span class="aid-pv">${esc(tp('{n} sector', '{n} sectors', x.ss.length))}</span><span class="aid-pm"><span class="aid-ty">${esc(t(TYPES[og[2] < 0 ? 3 : og[2]]))}</span>${esc(aidJoin(x.ss.map(s => t(s))))}</span></li>`; }).join('')}</ul>${lst.length > AID.show ? `<button type="button" class="chip" data-more>${esc(t('Show more'))}</button>` : ''}`;
        const mb = $('[data-more]', o); if (mb) mb.addEventListener('click', () => { AID.show += 24; draw(); });
      } else {
        const top = [...orgs].map(([oi, ds]) => ({ oi, n: ds.size })).sort((a, b) => b.n - a.n || P.orgs[a.oi][0].localeCompare(P.orgs[b.oi][0])).slice(0, 15);
        o.innerHTML = `<h5 class="aid-h">${esc(t('Organisations present in the most districts'))}</h5><div data-og></div>`;
        aidRank($('[data-og]', o), top.map(x => ({ id: String(x.oi), label: aidLab(P.orgs[x.oi][0], t(TYPES[P.orgs[x.oi][2] < 0 ? 3 : P.orgs[x.oi][2]])), value: x.n })), { fmt: v => tp('{n} district', '{n} districts', v) });
      }
    };
    $('#aidSec', el).addEventListener('change', ev => { AID.sec = ev.target.value; draw(); });
    $('#aidPer', el).addEventListener('change', ev => { AID.per = ev.target.value; draw(); });
    draw();
  });
}

/* ---------- view: World Bank projects ---------- */
function aidCols(el, items, o) {
  const W = 640, H = 210, L = 8, B = 24, T = 16, n = items.length, mx = Math.max(...items.map(i => i.v), 1), bw = (W - 2 * L) / n, big = items.reduce((a, i) => (i.v > a.v ? i : a), items[0]);
  const bars = items.map((i, k) => { const h = i.v / mx * (H - B - T); return `<rect x="${(L + k * bw + bw * 0.12).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${(i.v ? Math.max(h, 1) : 0).toFixed(1)}" tabindex="0" aria-label="${esc(fy(i.x) + ': ' + o.fmt(i.v))}"><title>${esc(fy(i.x) + ': ' + o.fmt(i.v))}</title></rect>`; }).join('');
  const ticks = items.map((i, k) => (i.x % 5 === 0 ? `<text x="${(L + k * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(fy(i.x))}</text>` : '')).join('');
  el.innerHTML = `<svg class="aid-cols" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(o.aria(big))}"><line x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}"/><text x="${L}" y="11">${esc(o.fmt(mx))}</text>${bars}${ticks}</svg>`;
}
function aidWb(el) {
  fbLoad(el, ['data/aid/wb.json'], W => {
    const P = W.projects, STAT = ['Active', 'Closed', 'Dropped', 'Pipeline'], appr = P.filter(p => (p.status === 'Active' || p.status === 'Closed') && p.usd && p.date), by = new Map();
    appr.forEach(p => { const y = +p.date.slice(0, 4); by.set(y, (by.get(y) || 0) + p.usd); });
    const y0 = Math.min(...by.keys()), y1 = Math.max(...by.keys()), items = []; for (let y = y0; y <= y1; y++) items.push({ x: y, v: by.get(y) || 0 });
    el.innerHTML = `<p class="aid-band">${esc(t('World Bank commitments are loans and grants, mostly to the Lebanese government and its agencies. They can overlap with the ODA the OECD counts and with FTS funding, so they are never added to the other figures here.'))}</p><div class="fb-grid one" data-g></div>`;
    const g = el.querySelector('[data-g]');
    const c1 = aidCard(g, { title: t('World Bank commitments by year of approval'), unit: t('US dollars, as listed for each project'), wide: true, srcs: [W.src],
      note: t('Active and closed projects with an approval date and a commitment. Additional-financing projects can repeat the commitment of the project they extend, so read the bars as an upper bound, not a total.') });
    aidCols(c1.out, items, { fmt: aidUsd, aria: b => t('Columns of commitments by year, {a} to {b}. The largest is {y}: {v}.', { a: fy(y0), b: fy(y1), y: fy(b.x), v: aidUsd(b.v) }) });
    const c2 = aidCard(g, { title: t('Projects'), wide: true, srcs: [W.src], extra: t('Dropped and pipeline projects are listed but left out of the chart.') });
    c2.ctl.hidden = false;
    c2.ctl.innerHTML = `<span class="chips" role="group" aria-label="${esc(t('Status'))}">${['all'].concat(STAT).map(s => `<button type="button" class="chip sm-c" data-s="${s}" aria-pressed="${AID.wbs === s}">${esc(s === 'all' ? t('All') : t(s))}<span class="ct">${nf(s === 'all' ? P.length : P.filter(p => p.status === s).length)}</span></button>`).join('')}</span>`;
    const draw = () => {
      const list = P.filter(p => AID.wbs === 'all' || p.status === AID.wbs).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      c2.out.innerHTML = `<ul class="aid-pl">${list.slice(0, AID.wbShow).map(p => `<li><span class="aid-pn"><a href="${esc('https://projects.worldbank.org/en/projects-operations/project-detail/' + p.id)}" target="_blank" rel="noopener noreferrer"><bdi>${esc(p.name)}</bdi></a><span class="aid-st ${p.status === 'Active' ? 'act' : p.status === 'Dropped' ? 'drop' : ''}">${esc(t(p.status))}</span></span><span class="aid-pv">${p.usd ? esc(aidUsd(p.usd)) : esc(t('no commitment listed'))}</span><span class="aid-pm">${p.date ? esc((p.future ? t('Approval planned {d}', { d: fmtDate(p.date) }) : t('Approved {d}', { d: fmtDate(p.date) }))) : esc(t('No approval date'))}${p.sectors.length ? ' · ' + esc(aidJoin(p.sectors.map(s => t(s)))) : ''}${p.agency ? ' · ' : ''}${p.agency ? `<bdi>${esc(p.agency)}</bdi>` : ''}</span></li>`).join('')}</ul>${list.length > AID.wbShow ? `<button type="button" class="chip" data-more>${esc(t('Show more'))}</button>` : ''}`;
      const mb = c2.out.querySelector('[data-more]'); if (mb) mb.addEventListener('click', () => { AID.wbShow += 25; draw(); });
    };
    c2.ctl.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { AID.wbs = b.dataset.s; AID.wbShow = 25; c2.ctl.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
    draw();
  });
}

/* ---------- view: people reached (self-reported by the agencies) ---------- */
const AID_GEN = N('Reached by population group: each group is shown with the sector that reported the highest count for it, so these are not unique people and the groups are not additive to a unique total.');
function aidReach(el) {
  fbLoad(el, ['data/aid/reach.json'], R => {
    const rows = R.rows, years = [...new Set(rows.map(r => r.year))].sort((a, b) => b - a), SR = t('Self-reported by the agencies');
    if (!years.includes(AID.ry)) AID.ry = years[0];
    const ref = {}; ((R.refugees || {}).points || []).forEach(p => { ref[+p[0]] = p[1]; });
    const note = n => (n ? `<p class="aid-fv sub">${th(n)}</p>` : '');
    el.innerHTML = `<p class="aid-band"><span class="aid-tag">${esc(SR)}</span>${esc(t('These figures come from the agencies\' own end-of-year dashboards. They are not checked here. Groups and sectors overlap, so they do not add up to a number of unique people, and units differ between sectors.'))}</p><div class="fb-grid one" data-g></div>`;
    const g = el.querySelector('[data-g]');
    const c1 = aidCard(g, { tag: SR, title: t('Individuals reached across all populations'), unit: t('Individuals reached against the plan target, by year'), wide: true, srcs: [R.src].concat(R.refugees ? [{ name: R.refugees.label, url: R.refugees.source, license: R.refugees.license }] : []),
      note: t('The plan is called LCRP in the dashboards up to 2023 and LRP from 2024.') });
    const tot = rows.filter(r => r.scope === 'total').sort((a, b) => b.year - a.year);
    c1.out.innerHTML = aidKey() + aidFundRows(tot.map(r => ({ year: r.year, name: r.plan, type: '', requirements_usd: r.people_targeted, funding_planwide_usd: r.people_reached, note: r.note })), { req: p => p.requirements_usd, fund: p => p.funding_planwide_usd, pct: p => (p.requirements_usd ? p.funding_planwide_usd / p.requirements_usd * 100 : null),
      say: (rq, fu, pc) => (rq ? t('Reached {a} of a target of {b} ({c} of the target, calculated here).', { a: nf(fu), b: nf(rq), c: aidPct(pc) }) : t('Reached {a}. No target printed.', { a: nf(fu) })),
      extra: p => (ref[p.year] ? `<p class="aid-fv sub">${esc(t('Registered Syrian refugees at the end of {y}, UNHCR: {n}', { y: fy(p.year), n: nf(ref[p.year]) }))}</p>` : '') + note(p.note) });
    const c2 = aidCard(g, { tag: SR, title: t('Reached, by population group'), wide: true, note: t(AID_GEN) });
    c2.ctl.hidden = false;
    c2.ctl.innerHTML = aidYearSel('aidRy', years, AID.ry, t('Year'));
    const c3 = aidCard(g, { tag: SR, title: t('Reached, by sector'), wide: true, note: t('Each figure is in the unit its sector reports, which can be people, households, consultations or services.') });
    const draw = () => {
      const yr = rows.filter(r => r.year === AID.ry), grp = yr.filter(r => r.scope === 'population group'), sec = yr.filter(r => r.scope === 'sector'), srcs = [];
      yr.forEach(r => { if (r.source && !srcs.some(s => s.url === r.source)) srcs.push({ name: r.source_title, url: r.source, license: null }); });
      const gmx = Math.max(...grp.map(r => Math.max(r.people_targeted || 0, r.people_reached || 0)), 1);
      c2.out.innerHTML = `<ul class="aid-fl">${grp.map(r => `<li class="aid-fr"><div class="aid-fh">${esc(t(r.sector_or_group))}</div><div class="aid-fb" aria-hidden="true">${r.people_targeted ? `<i class="rq" style="width:${(r.people_targeted / gmx * 100).toFixed(1)}%"></i>` : ''}<i class="fu" style="width:${(Math.min(r.people_reached, gmx) / gmx * 100).toFixed(1)}%"></i></div><p class="aid-fv">${esc(r.people_targeted ? t('Reached {a} of a target of {b}.', { a: nf(r.people_reached), b: nf(r.people_targeted) }) : t('Reached {a}. No target printed.', { a: nf(r.people_reached) }))}</p>${note(r.note.startsWith(AID_GEN) ? r.note.slice(AID_GEN.length).trim() : r.note)}</li>`).join('')}</ul>` + aidKey() + aidSrc(srcs);
      c3.out.innerHTML = `<ul class="aid-pl">${sec.map(r => `<li><span class="aid-pn"><b>${esc(t(r.sector_or_group))}</b> <span class="dim">${th(r.indicator)}</span></span><span class="aid-pv">${esc(nf(r.people_reached))} ${esc(t(r.unit))}</span>${r.people_targeted || r.note ? `<span class="aid-pm">${r.people_targeted ? esc(t('Target {n}', { n: nf(r.people_targeted) })) + ' ' : ''}${r.note ? th(r.note) : ''}</span>` : ''}</li>`).join('')}</ul>` + aidSrc(srcs);
    };
    c2.ctl.querySelector('select').addEventListener('change', ev => { AID.ry = +ev.target.value; draw(); });
    draw();
  });
}

const AID_RENDER = { time: aidTime, donors: aidDonors, appeals: aidAppeals, where: aidWhere, wb: aidWb, reach: aidReach };
HUB.tab('aid', { render(args, info) {
  const root = $('#aidRoot');
  if (!(D.tabs.aid && D.tabs.aid.n)) return;                                  // no data in this build: the empty state from the panel stays
  const v = AID_VIEWS.some(x => x.id === args[0]) ? args[0] : 'time';
  AID.view = v;
  root.innerHTML = '<div class="fb-nav" id="aidNav"></div><div id="aidView"></div>';
  const show = id => { AID.view = id; HUB.setHash('aid', ...(id === 'time' ? [] : [id])); AID_RENDER[id]($('#aidView')); };
  fbNav($('#aidNav'), AID_VIEWS.map(x => ({ id: x.id, label: t(x.label) })), v, show);
  AID_RENDER[v]($('#aidView'));
} });
