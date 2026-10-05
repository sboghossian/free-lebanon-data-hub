/* Trade & investment tab (LEG B-trade): Overview, By product, By partner, Customs monthly, Investment. Data: data/trade/* (built by build/hub/emit_trade.py). Guide: build/hub/README.md.
   One top-level name (TR). Charts and maps stay left-to-right in Arabic. Routes: #trade/<view>/<X|M>/<year>.
   Every chart names its source and licence. BACI, Lebanese Customs and the World Bank measure goods trade differently, so the three are never added or mixed in one total. */
const TR = { v: {}, S: null, c: {} };
HUB.tab('trade', { render(args, info) { TR.render(args, info); } });
HUB.trade = TR;
(function () {
  const E = esc;
  const VIEWS = [['overview', N('Overview')], ['product', N('By product')], ['partner', N('By partner')], ['customs', N('Customs monthly')], ['investment', N('Investment')]];
  const VIEW_IDS = VIEWS.map(v => v[0]);
  const st = TR.S = { view: 'overview', flow: 'X', year: null, ch: null, partner: null, cflow: 'X', cyear: null, ovFlow: 'X', fdiFlow: 'in', gfcf: 'usd', idalYear: null, oSide: 'partner', oYear: null };
  const FLOWS = [['X', N('Exports')], ['M', N('Imports')]];
  const FL = f => (f === 'X' ? t('Exports') : t('Imports'));
  const usd = v => (v == null ? '–' : (LANG === 'ar' ? nfCompact(v) + ' $' : 'US$ ' + nfCompact(v)));
  const mill = v => t('US$ {n} million', { n: nf(v / 1e6, 0) });
  const pct = v => fmt(v, 1) + '%';
  const sum = (rows, i) => rows.reduce((s, r) => s + r[i], 0);
  const srcLine = items => {
    const seen = new Set(), rows = items.filter(i => i && !seen.has(i.src + i.lic) && seen.add(i.src + i.lic)).map(i =>
      `<span class="tr-s">${i.url ? `<a href="${E(i.url)}" target="_blank" rel="noopener" data-notr>${E(i.src)}</a>` : `<span data-notr>${E(i.src)}</span>`} <span class="dim">(${E(t('Licence'))}: <span data-notr>${E(i.lic || t('not stated'))}</span>)</span></span>`);
    return `<p class="tr-src note"><b>${E(t('Source'))}:</b> ${rows.join('; ')}</p>`;
  };
  const SRC = {
    baci: { src: 'CEPII BACI (HS92, version 202601)', url: 'https://www.cepii.fr/DATA_DOWNLOAD/baci/doc/baci_webpage.html', lic: 'Etalab Open Licence 2.0' },
    customs: { src: 'Lebanese Customs Administration, External Trade Statistics', url: 'http://www.customs.gov.lb/Trade_Statistics/Monthly/Monthly_Statistics.aspx', lic: '' },
    wdi: { src: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/country/lebanon', lic: 'CC BY 4.0' },
    unctad: { src: 'UNCTADstat, FDI flows and stocks', url: 'https://unctadstat.unctad.org/datacentre/dataviewer/US.FdiFlowsStock', lic: 'CC BY 3.0 IGO' },
    idal: { src: 'IDAL, investments supported (yearly statistics)', url: 'http://www.investinlebanon.gov.lb/en/about_us/investments_supported_by_idal/yearly_statistics', lic: '' },
    imf: { src: 'IMF, Direct Investment Positions by Counterpart Economy (DIP)', url: 'https://data.imf.org/en/datasets/IMF.STA:DIP', lic: 'IMF terms of use' },
    ne: { src: 'Natural Earth', url: 'https://www.naturalearthdata.com/', lic: 'Public domain' }
  };
  const chip = (attrs, on, text) => `<button type="button" class="chip" ${attrs} aria-pressed="${!!on}">${E(text)}</button>`;
  const optHTML = (v, text, sel) => `<option value="${E(v)}"${String(v) === String(sel) ? ' selected' : ''}>${E(text)}</option>`;
  const selHTML = (id, label, opts) => `<label class="sel"><span>${E(label)}</span><select id="${id}">${opts}</select></label>`;
  const flowChips = (cur, attr) => `<div class="chips tr-flow" role="group" aria-label="${E(t('Flow'))}">${FLOWS.map(([f, l]) => chip(`${attr}="${f}"`, cur === f, t(l))).join('')}</div>`;
  const nameOf = k => { const n = TR.names && TR.names[k]; if (!n) return k; return (LANG === 'ar' && n[1]) || (LANG === 'fr' && n[2]) || n[0] || k; };
  /* ranked bars: items [{id, label, sub, value, share, on}] */
  function bars(el, items, pick) {
    items = items.filter(i => Number.isFinite(i.value));
    if (!items.length) { el.innerHTML = `<p class="hub-empty">${E(t('No data to chart.'))}</p>`; return; }
    const mx = Math.max(...items.map(i => Math.abs(i.value)), 1);
    el.innerHTML = `<ul class="tr-bars">${items.map(i => `<li class="${i.on ? 'on' : ''}${i.gap ? ' gap' : ''}${i.weak ? ' weak' : ''}"${i.id != null ? ` data-id="${E(i.id)}"` : ''}${pick ? ` tabindex="0" role="button" aria-pressed="${!!i.on}"` : ''}><span class="tb-l">${E(i.label)}${i.sub ? ` <span class="dim">${E(i.sub)}</span>` : ''}</span><span class="tb-b" aria-hidden="true"><i style="width:${(Math.abs(i.value) / mx * 100).toFixed(1)}%"></i></span><span class="tb-v mono">${E(i.text != null ? i.text : usd(i.value))}${i.share != null ? ` <span class="dim">${E(pct(i.share))}</span>` : ''}</span></li>`).join('')}</ul>`;
    if (pick) el.querySelectorAll('li[data-id]').forEach(li => { const go = () => pick(li.dataset.id); li.addEventListener('click', go); li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  }
  const line = (el, series, o = {}) => hubLine(el, Object.assign({ series, height: 270, yFmt: v => nfCompact(v), valFmt: usd }, o));
  const years = (a, b) => { const o = []; for (let y = a; y <= b; y++) o.push(y); return o; };
  const ptsOf = (ys, vs) => ys.map((y, i) => [y, vs[i]]).filter(p => p[1] != null);
  const wdi = (S, id) => { const s = S.find(x => x.id === id); return s ? s.points.map(p => [+p[0], p[1]]) : []; };
  const at = (pts, y) => { const p = pts.find(q => q[0] === y); return p ? p[1] : null; };
  const last = pts => (pts.length ? pts[pts.length - 1] : null);
  const card = (id, title, extra = '') => `<section class="tr-card" id="${id}"><h3 class="d-h">${E(title)}</h3>${extra}<div class="tr-body"></div></section>`;
  Object.assign(TR, { E, usd, mill, pct, sum, bars, line, srcLine, SRC, chip, optHTML, selHTML, flowChips, FL, years, ptsOf, wdi, at, last, nameOf, card, VIEWS, FLOWS });

  /* ---------------------------------------------------------------- router */
  function applyRoute(args) {
    const v = (args[0] || '').toLowerCase();
    if (VIEW_IDS.includes(v)) st.view = v;
    const f = (args[1] || '').toUpperCase();
    if (f === 'X' || f === 'M') { st.flow = f; st.cflow = f; }
    if (/^\d{4}$/.test(args[2] || '')) { st.year = +args[2]; st.cyear = +args[2]; }
  }
  TR.hash = () => {
    if (st.view === 'product' || st.view === 'partner') HUB.setHash('trade', st.view, st.flow, st.year || '');
    else if (st.view === 'customs') HUB.setHash('trade', st.view, st.cflow, st.cyear || '');
    else HUB.setHash('trade', st.view);
  };
  TR.render = function (args, info) {
    const root = $('#tradeRoot'), n = D.tabs && D.tabs.trade && D.tabs.trade.n;
    if (!n) return;
    applyRoute(args || []);
    TR.root = root;
    hubLoadInto(root, ['data/trade/overview.json'], ov => { TR.ov = ov; TR.mount(); });
  };
  TR.mount = function () {
    const root = TR.root;
    if (TR.cur && TR.v[TR.cur] && TR.v[TR.cur].unmount) TR.v[TR.cur].unmount();
    root.innerHTML = `<div class="tr"><div class="chips tr-nav" role="group" aria-label="${E(t('Trade views'))}">${VIEWS.map(([v, l]) => chip(`data-tv="${v}"`, st.view === v, t(l))).join('')}</div>`
      + `${st.view === 'investment' ? '' : `<p class="note tr-def">${E(t('Goods trade is shown from three sources that measure it differently: BACI (reconciled mirror data), Lebanese Customs and the World Bank (balance of payments). Their totals differ, so each chart names the measure it uses and the sources are never added together.'))}</p>`}<div id="trBody"></div></div>`;
    root.querySelectorAll('[data-tv]').forEach(b => b.addEventListener('click', () => { if (st.view !== b.dataset.tv) { st.view = b.dataset.tv; TR.hash(); TR.mount(); } }));
    TR.cur = st.view;
    TR.v[st.view].mount($('#trBody'));
  };

  /* ================================================================ Overview */
  TR.v.overview = {
    mount(body) {
      const ov = TR.ov, S = ov.series, ys = ov.years, X = ov.baci.X, M = ov.baci.M, li = ys.length - 1;
      const bal = ys.map((y, i) => (X[i] != null && M[i] != null ? X[i] - M[i] : null));
      body.innerHTML = `<section class="tr-card" id="trOv1"><h3 class="d-h">${E(t('Goods: exports, imports and balance'))}</h3><p class="tr-big mono" id="trOvBig"></p><div id="trOvC1"></div>${srcLine([SRC.baci])}<p class="note">${E(t('Goods only, from BACI: mirror data reconciled between Lebanon and its partners, in current US dollars. It is not the official trade balance.'))}</p></section>`
        + `<section class="tr-card" id="trOv2"><h3 class="d-h">${E(t('The same flow, four measures'))}</h3><div class="tr-bar">${flowChips(st.ovFlow, 'data-of')}</div><div id="trOvC2"></div><ul class="tr-fig" id="trOvFig"></ul>`
        + `<p class="note" id="trOvNote"></p>${srcLine([SRC.baci, SRC.customs, SRC.wdi])}</section>`
        + `<section class="tr-card" id="trOv3"><h3 class="d-h">${E(t('Services and the current account'))}</h3><div id="trOvC3"></div>${srcLine([SRC.wdi])}<p class="note">${E(t('Balance of payments basis, current US dollars. Services are mostly travel and transport. A negative current account balance is a deficit.'))}</p></section>`;
      const q = s => body.querySelector(s);
      q('#trOvBig').innerHTML = tH('{y}: exports {x}, imports {m}, balance {b}.', { y: E(fy(ys[li])), x: `<b>${E(usd(X[li]))}</b>`, m: `<b>${E(usd(M[li]))}</b>`, b: `<b>${E(usd(bal[li]))}</b>` });
      line(q('#trOvC1'), [{ id: 'x', label: t('Exports (BACI)'), pts: ptsOf(ys, X) }, { id: 'm', label: t('Imports (BACI)'), pts: ptsOf(ys, M) }, { id: 'b', label: t('Balance, exports minus imports (BACI)'), pts: ptsOf(ys, bal), dash: true }], { title: t('Goods: exports, imports and balance') });
      const cu = ov.customs;
      const draw2 = () => {
        const f = st.ovFlow, bs = f === 'X' ? X : M;
        const cus = cu.years.map((y, i) => [y, cu[f][i], cu.months[f][y]]).filter(p => p[1] != null && p[2] === 12 && p[0] <= 2025);
        const bop = wdi(S, f === 'X' ? 'wb_bx_gsr_mrch_cd' : 'wb_bm_gsr_mrch_cd'), cb = wdi(S, f === 'X' ? 'wb_tx_val_mrch_cd_wt' : 'wb_tm_val_mrch_cd_wt').filter(p => p[0] >= 1995);
        const m = [{ id: 'baci', label: t('BACI, reconciled mirror data'), pts: ptsOf(ys, bs), src: 'BACI' }, { id: 'cus', label: t('Lebanese Customs, special trade'), pts: cus.map(p => [p[0], p[1]]), dash: true },
          { id: 'bop', label: t('World Bank, balance of payments basis'), pts: bop }, { id: 'cb', label: t('World Bank, customs-based'), pts: cb, dash: true }];
        line(q('#trOvC2'), m, { title: t('The same flow, four measures') + ', ' + FL(f) });
        q('#trOvFig').innerHTML = m.map(s => { const v24 = at(s.pts, 2024), l = last(s.pts); return `<li><b>${E(s.label)}</b>: ` + (v24 != null ? E(t('{y}: {v}', { y: fy(2024), v: usd(v24) }))
          : E(t('no value for {y}; latest {l}: {v}', { y: fy(2024), l: fy(l[0]), v: usd(l[1]) }))) + '</li>'; }).join('');
        const fx = FL(f).toLowerCase();
        q('#trOvNote').textContent = t('BACI (reconciled mirror data), Lebanese Customs (special trade) and the World Bank (balance of payments, and a customs-based series) do not measure the same thing: scope and coverage differ, for example special versus general trade, re-exports and gold. Their {f} totals therefore differ, and no chart adds or averages them.', { f: fx });
      };
      draw2();
      body.querySelectorAll('[data-of]').forEach(b => b.addEventListener('click', () => { st.ovFlow = b.dataset.of; body.querySelectorAll('[data-of]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.of === st.ovFlow))); draw2(); }));
      line(q('#trOvC3'), [{ id: 'sx', label: t('Services exports'), pts: wdi(S, 'wb_bx_gsr_nfsv_cd') }, { id: 'sm', label: t('Services imports'), pts: wdi(S, 'wb_bm_gsr_nfsv_cd') },
        { id: 'ca', label: t('Current account balance'), pts: wdi(S, 'wb_bn_cab_xoka_cd').filter(p => p[0] >= 2002), dash: true }], { title: t('Services and the current account') });
    }
  };

  /* ================================================================ By product: HS2 chapters, a chapter over time, top 25 HS6 products */
  const loadAll = (el, paths, build) => hubLoadInto(el, paths, build);
  TR.v.product = {
    mount(body) {
      body.innerHTML = '<div id="trPrBox"></div>';
      loadAll(body.querySelector('#trPrBox'), ['data/trade/chapters.json', 'data/trade/products.json'], (ch, pr) => {
        const rows = ch.rows, names = ch.chapters, yrs = [...new Set(rows.map(r => r[0]))].sort((a, b) => a - b);
        if (st.year == null || !yrs.includes(st.year)) st.year = yrs[yrs.length - 1];
        const cname = c => (names[c] ? t(names[c]) : c);
        const clabel = c => c + ' ' + cname(c);
        const all = [...new Set(rows.map(r => r[2]))].sort();
        const box = body.querySelector('#trPrBox');
        box.innerHTML = `<div class="tr-bar">${flowChips(st.flow, 'data-fl')}${selHTML('trYear', t('Year'), yrs.slice().reverse().map(y => optHTML(y, fy(y), st.year)).join(''))}</div>`
          + `<div class="tr-two"><section class="tr-card"><h3 class="d-h" id="trChH"></h3><p class="tr-big mono" id="trChBig"></p><div id="trChBars"></div></section>`
          + `<section class="tr-card"><h3 class="d-h" id="trLnH"></h3><div class="tr-bar">${selHTML('trChSel', t('Chapter'), all.map(c => optHTML(c, clabel(c), st.ch)).join(''))}</div><div id="trLnC"></div></section></div>`
          + `<section class="tr-card"><h3 class="d-h" id="trHsH"></h3><div id="trHsBars"></div></section>`
          + `${srcLine([SRC.baci])}<p class="note">${E(t('BACI values are reconciled mirror data in current US dollars, so they differ from Lebanese Customs and from balance of payments figures. Re-exports and precious metals can make up large parts of the export lines. Product names are the HS92 names published by BACI, in English.'))}</p>`;
        const q = s => box.querySelector(s);
        const draw = () => {
          const f = st.flow, y = st.year, ofy = rows.filter(r => r[0] === y && r[1] === f && r[3] > 0), tot = sum(ofy, 3);
          if (!st.ch || !names[st.ch]) st.ch = ofy.length ? ofy.slice().sort((a, b) => b[3] - a[3])[0][2] : '71';
          q('#trChH').textContent = t('Chapters, {f}, {y}', { f: FL(f).toLowerCase(), y: fy(y) });
          q('#trChBig').textContent = tot ? usd(tot) : '';
          bars(q('#trChBars'), ofy.slice().sort((a, b) => b[3] - a[3]).slice(0, 15).map(r => ({ id: r[2], label: clabel(r[2]), value: r[3], share: tot ? r[3] / tot * 100 : null, on: r[2] === st.ch })), c => { st.ch = c; draw(); });
          q('#trChSel').value = st.ch;
          q('#trLnH').textContent = t('{c} over time, {f}', { c: clabel(st.ch), f: FL(f).toLowerCase() });
          line(q('#trLnC'), [{ id: st.ch, label: clabel(st.ch), pts: rows.filter(r => r[1] === f && r[2] === st.ch).map(r => [r[0], r[3]]) }], { height: 230, title: clabel(st.ch) });
          const hs = (pr.years[String(y)] || {})[f] || [];
          q('#trHsH').textContent = t('Top 25 products (HS6), {f}, {y}', { f: FL(f).toLowerCase(), y: fy(y) });
          bars(q('#trHsBars'), hs.map((p, i) => ({ id: p[0], label: (i + 1) + '. ' + p[0] + ' ' + p[1], value: p[2], share: tot ? p[2] / tot * 100 : null })));
        };
        draw();
        box.querySelectorAll('[data-fl]').forEach(b => b.addEventListener('click', () => { st.flow = b.dataset.fl; box.querySelectorAll('[data-fl]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fl === st.flow))); st.ch = null; TR.hash(); draw(); }));
        q('#trYear').addEventListener('change', ev => { st.year = +ev.target.value; TR.hash(); draw(); });
        q('#trChSel').addEventListener('change', ev => { st.ch = ev.target.value; draw(); });
      });
    }
  };

  /* ================================================================ By partner: ranked bars, a world map, a partner over time */
  let GEO = null;
  const mapSVG = (geo, vals, sel, tipf) => {
    const mx = Math.max(...Object.values(vals), 1), X = lon => (lon + 180).toFixed(1), Y = lat => (85 - lat).toFixed(1);
    if (!GEO) GEO = geo.countries.map(c => ({ iso: c.iso3, d: c.g.map(poly => poly.map(r => 'M' + r.map(p => X(p[0]) + ' ' + Y(p[1])).join('L') + 'Z').join('')).join('') }));
    const body = GEO.map(c => { const v = vals[c.iso], o = v ? (0.16 + 0.84 * Math.sqrt(v / mx)).toFixed(2) : null;
      return `<path d="${c.d}" class="tr-c${v ? ' has' : ''}${c.iso === sel ? ' sel' : ''}" data-iso="${c.iso}" fill-rule="evenodd"${o ? ` style="fill-opacity:${o}"` : ''}><title>${E(tipf(c.iso, v))}</title></path>`; }).join('');
    return `<svg class="tr-map" viewBox="0 8 360 135" role="img" aria-label="${E(t('World map: Lebanese partners shaded by value'))}">${body}<circle cx="215.9" cy="51.1" r="1.7" class="tr-leb"><title>${E(nameOf('LBN'))}</title></circle></svg>`;
  };
  TR.v.partner = {
    mount(body) {
      body.innerHTML = '<div id="trPaBox"></div>';
      loadAll(body.querySelector('#trPaBox'), ['data/trade/partners.json', 'data/trade/world-geo.json'], (pa, geo) => {
        TR.names = Object.assign({}, TR.names, pa.names);
        const rows = pa.rows, yrs = [...new Set(rows.map(r => r[0]))].sort((a, b) => a - b);
        if (st.year == null || !yrs.includes(st.year)) st.year = yrs[yrs.length - 1];
        const box = body.querySelector('#trPaBox');
        box.innerHTML = `<div class="tr-bar">${flowChips(st.flow, 'data-fl')}${selHTML('trYear', t('Year'), yrs.slice().reverse().map(y => optHTML(y, fy(y), st.year)).join(''))}</div>`
          + `<div class="tr-two tr-two-map"><section class="tr-card"><h3 class="d-h" id="trPaH"></h3><p class="tr-big mono" id="trPaBig"></p><div id="trPaMap" class="tr-mapbox"></div><p class="note">${E(t('Shading shows each partner\'s value for the year and flow chosen. Select a partner on the map or in the list to see it over time.'))}</p></section>`
          + `<section class="tr-card"><h3 class="d-h">${E(t('Largest partners'))}</h3><div id="trPaBars"></div></section></div>`
          + `<section class="tr-card"><h3 class="d-h" id="trPlH"></h3><div class="tr-bar">${selHTML('trPaSel', t('Partner'), '')}</div><div id="trPlC"></div></section>`
          + `${srcLine([SRC.baci, SRC.ne])}<p class="note">${E(t('BACI values are reconciled mirror data in current US dollars: a partner\'s figure can differ from what Lebanese Customs reports for the same partner. Natural Earth draws de facto boundaries; the Hub takes no position on them.'))}</p>`;
        const q = s => box.querySelector(s);
        const cum = {};
        rows.forEach(r => { if (r[1] === st.flow) cum[r[2]] = (cum[r[2]] || 0) + r[3]; });
        const draw = () => {
          const f = st.flow, y = st.year, ofy = rows.filter(r => r[0] === y && r[1] === f && r[3] > 0 && r[2] !== 'LBN').sort((a, b) => b[3] - a[3]), tot = sum(ofy, 3);
          if (!st.partner || !pa.names[st.partner]) st.partner = ofy.length ? ofy[0][2] : 'ARE';
          q('#trPaH').textContent = t('Partners, {f}, {y}', { f: FL(f).toLowerCase(), y: fy(y) });
          q('#trPaBig').textContent = tot ? usd(tot) : '';
          const vals = Object.fromEntries(ofy.map(r => [r[2], r[3]]));
          q('#trPaMap').innerHTML = mapSVG(geo, vals, st.partner, (iso, v) => nameOf(iso) + (v ? ': ' + usd(v) + ' (' + pct(v / tot * 100) + ')' : ''));
          q('#trPaMap').querySelectorAll('path.has').forEach(p => p.addEventListener('click', () => { st.partner = p.dataset.iso; draw(); }));
          bars(q('#trPaBars'), ofy.slice(0, 15).map(r => ({ id: r[2], label: nameOf(r[2]), value: r[3], share: r[3] / tot * 100, on: r[2] === st.partner })), p => { st.partner = p; draw(); });
          const opts = Object.entries(cum).sort((a, b) => b[1] - a[1]).filter(([k]) => k !== 'LBN').map(([k]) => k);
          q('#trPaSel').innerHTML = opts.map(k => optHTML(k, nameOf(k), st.partner)).join('');
          q('#trPlH').textContent = t('{p} over time, {f}', { p: nameOf(st.partner), f: FL(f).toLowerCase() });
          line(q('#trPlC'), [{ id: st.partner, label: nameOf(st.partner), pts: rows.filter(r => r[1] === f && r[2] === st.partner).map(r => [r[0], r[3]]) }], { height: 230, title: nameOf(st.partner) });
        };
        draw();
        box.querySelectorAll('[data-fl]').forEach(b => b.addEventListener('click', () => { st.flow = b.dataset.fl; box.querySelectorAll('[data-fl]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fl === st.flow))); Object.keys(cum).forEach(k => delete cum[k]); rows.forEach(r => { if (r[1] === st.flow) cum[r[2]] = (cum[r[2]] || 0) + r[3]; }); st.partner = null; TR.hash(); draw(); }));
        q('#trYear').addEventListener('change', ev => { st.year = +ev.target.value; TR.hash(); draw(); });
        q('#trPaSel').addEventListener('change', ev => { st.partner = ev.target.value; draw(); });
      });
    }
  };

  /* ================================================================ Customs monthly: Lebanese Customs monthly totals, by chapter and by partner. Weight is left out: the source does not state the unit. */
  TR.v.customs = {
    mount(body) {
      body.innerHTML = '<div id="trCuBox"></div>';
      loadAll(body.querySelector('#trCuBox'), ['data/trade/customs.json', 'data/trade/partners.json'], (cu, pa) => {
        TR.names = Object.assign({}, TR.names, pa.names);
        const mon = cu.months, lastM = f => mon.filter(r => r[1] === f).map(r => r[0]).sort().pop();
        const mname = ym => monShort(+ym.slice(5) - 1) + ' ' + fy(+ym.slice(0, 4));
        const box = body.querySelector('#trCuBox');
        const ptsM = f => mon.filter(r => r[1] === f).map(r => [+r[0].slice(0, 4) + (+r[0].slice(5, 7) - 1) / 12, r[2]]);
        box.innerHTML = `<section class="tr-card"><h3 class="d-h">${E(t('Monthly totals, Lebanese Customs'))}</h3><div id="trCuC"></div>${srcLine([SRC.customs])}`
          + `<p class="note" id="trCuNote"></p></section>`
          + `<div class="tr-bar">${flowChips(st.cflow, 'data-fl')}${selHTML('trYear', t('Year'), '')}</div><p class="note" id="trCuPart"></p>`
          + `<div class="tr-two"><section class="tr-card"><h3 class="d-h" id="trCuChH"></h3><p class="tr-big mono" id="trCuBig"></p><div id="trCuCh"></div></section>`
          + `<section class="tr-card"><h3 class="d-h" id="trCuPaH"></h3><div id="trCuPa"></div></section></div>${srcLine([SRC.customs])}`;
        const q = s => box.querySelector(s);
        const xl = v => { const y = Math.floor(v + 1e-6); return monShort(Math.round((v - y) * 12)) + ' ' + fy(y); };
        line(q('#trCuC'), [{ id: 'x', label: t('Exports'), pts: ptsM('X') }, { id: 'm', label: t('Imports'), pts: ptsM('M') }], { xFmt: xl, title: t('Monthly totals, Lebanese Customs') });
        q('#trCuNote').textContent = t('Special trade, as the Customs Administration publishes it, in US dollars. Imports are published to {m} and exports to {x}. Customs also publishes a weight, but its unit is not stated on the source page and could not be confirmed, so weight is left out here.', { m: mname(lastM('M')), x: mname(lastM('X')) });
        const yearsOf = f => [...new Set(cu.by_chapter.filter(r => r[1] === f).map(r => r[0]))].sort((a, b) => b - a);
        const draw = () => {
          const f = st.cflow, ys = yearsOf(f);
          if (st.cyear == null || !ys.includes(st.cyear)) st.cyear = ys.includes(2025) ? 2025 : ys[0];
          const y = st.cyear;
          q('#trYear').innerHTML = ys.map(v => optHTML(v, fy(v), y)).join('');
          const nm = mon.filter(r => r[1] === f && r[0].slice(0, 4) === String(y)).length, partial = nm > 0 && nm < 12;
          q('#trCuPart').textContent = partial ? t('{y} is year to date for this flow.', { y: fy(y) }) : '';
          const ch = cu.by_chapter.filter(r => r[0] === y && r[1] === f && r[3] > 0), tot = sum(ch, 3), pa = cu.by_partner.filter(r => r[0] === y && r[1] === f && r[4] > 0);
          q('#trCuChH').textContent = t('Chapters, {f}, {y}', { f: FL(f).toLowerCase(), y: fy(y) });
          q('#trCuBig').textContent = tot ? usd(tot) : '';
          bars(q('#trCuCh'), ch.sort((a, b) => b[3] - a[3]).slice(0, 15).map(r => ({ label: r[2] + ' ' + (cu.chapters[r[2]] ? t(cu.chapters[r[2]]) : ''), value: r[3], share: tot ? r[3] / tot * 100 : null })));
          const ptot = sum(pa, 4), by = {};
          pa.forEach(r => { const k = r[2] || r[3]; by[k] = [r[2] ? nameOf(r[2]) : r[3], (by[k] ? by[k][1] : 0) + r[4]]; });
          q('#trCuPaH').textContent = t('Partners, {f}, {y}', { f: FL(f).toLowerCase(), y: fy(y) });
          bars(q('#trCuPa'), Object.values(by).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, v]) => ({ label: n, value: v, share: ptot ? v / ptot * 100 : null })));
        };
        draw();
        box.querySelectorAll('[data-fl]').forEach(b => b.addEventListener('click', () => { st.cflow = b.dataset.fl; box.querySelectorAll('[data-fl]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fl === st.cflow))); TR.hash(); draw(); }));
        q('#trYear').addEventListener('change', ev => { st.cyear = +ev.target.value; TR.hash(); draw(); });
      });
    }
  };

  /* ================================================================ Investment: FDI (WDI and UNCTAD side by side), stocks, capital formation, IDAL, FDI by origin (IMF), venture funding */
  const aggregate = k => /\d/.test(k);
  TR.v.investment = {
    mount(body) {
      body.innerHTML = '<div id="trInBox"></div>';
      loadAll(body.querySelector('#trInBox'), ['data/trade/investment.json', 'data/trade/fdi-origin.json', 'data/trade/partners.json'], (inv, fo, pa) => {
        TR.names = Object.assign({}, TR.names, pa.names);
        const S = inv.series, g = id => wdi(S, id), box = body.querySelector('#trInBox');
        const idal = inv.idal.years, idy = Object.keys(idal).map(Number).sort((a, b) => a - b), allY = years(idy[0], idy[idy.length - 1]);
        if (st.idalYear == null || !idal[st.idalYear]) st.idalYear = idy[idy.length - 1];
        const fy_ = fo.years;
        if (st.oYear == null || !fy_.includes(st.oYear)) st.oYear = 2022;
        box.innerHTML = `<section class="tr-card"><h3 class="d-h">${E(t('Foreign direct investment: net inflows and outflows'))}</h3><div class="tr-bar"><div class="chips tr-flow" role="group" aria-label="${E(t('Direction'))}">${chip('data-fd="in"', st.fdiFlow === 'in', t('Inflows'))}${chip('data-fd="out"', st.fdiFlow === 'out', t('Outflows'))}</div></div>`
          + `<div id="trFdC"></div><p class="note" id="trFdNote"></p>${srcLine([SRC.wdi, SRC.unctad])}</section>`
          + `<div class="tr-two"><section class="tr-card"><h3 class="d-h">${E(t('Foreign direct investment: stock'))}</h3><div id="trStC"></div>${srcLine([SRC.unctad])}</section>`
          + `<section class="tr-card"><h3 class="d-h">${E(t('Gross fixed capital formation'))}</h3><div class="tr-bar"><div class="chips tr-flow" role="group" aria-label="${E(t('Unit'))}">${chip('data-gf="usd"', st.gfcf === 'usd', t('US dollars'))}${chip('data-gf="pct"', st.gfcf === 'pct', t('Percent of GDP'))}</div></div><div id="trGfC"></div><p class="note" id="trGfNote"></p>${srcLine([SRC.wdi])}</section></div>`
          + `<section class="tr-card"><h3 class="d-h">${E(t('Projects granted IDAL incentives, by year'))}</h3><div id="trIdY"></div><p class="note">${E(t('Investment size and jobs of projects that received incentives under the investment law, as IDAL publishes them. These are approvals, not total investment in Lebanon. IDAL does not publish 2008 and 2013.'))}</p>`
          + `<div class="tr-bar">${selHTML('trIdSel', t('Year'), idy.slice().reverse().map(y => optHTML(y, fy(y), st.idalYear)).join(''))}</div><h4 class="d-h" id="trIdSecH"></h4><div id="trIdSec"></div>${srcLine([SRC.idal])}</section>`
          + `<section class="tr-card"><h3 class="d-h">${E(t('Direct investment positions by partner economy'))}</h3><div class="tr-bar"><label class="sel"><span>${E(t('Reported by'))}</span><select id="trOSide">${optHTML('partner', t('The partner economy (about its investment in Lebanon)'), st.oSide)}${optHTML('lebanon', t('Lebanon (about investment received)'), st.oSide)}</select></label>${selHTML('trOYear', t('Year'), fy_.slice().reverse().map(y => optHTML(y, fy(y), st.oYear)).join(''))}</div>`
          + `<p class="tr-big mono" id="trOBig"></p><div id="trOBars"></div>${srcLine([SRC.imf])}<p class="note">${E(t('Positions are stocks at year end in US dollars, not annual flows, and are net of the other direction. The IMF terms do not allow redistribution, so this chart is shown with attribution and there is no download. Lebanon reports many gaps, and 2023 and 2024 cover fewer partners. Regional groups overlap with countries and are not shown.'))}</p></section>`
          + `<section class="tr-card"><h3 class="d-h">${E(t('Venture funding into Lebanese startups, by year'))}</h3><div id="trVc"></div><ul class="tr-vsrc" id="trVcSrc"></ul>`
          + `<p class="note">${E(t('Headline figures as published, marked reported: they come from press and report summaries, not from one dataset. Years with no free published total are shown as gaps, not as zero.'))} <a href="#companies" data-hub="companies" data-hash="companies">${E(t('Individual startups are on the Companies tab.'))}</a></p></section>`;
        const q = s => box.querySelector(s);
        const lbl = { w: t('World Bank (balance of payments)'), u: t('UNCTAD') };
        const drawFd = () => {
          const f = st.fdiFlow, w = g(f === 'in' ? 'wb_bx_klt_dinv_cd_wd' : 'wb_bm_klt_dinv_cd_wd'), u = g(f === 'in' ? 'unctad_fdi_flow_inward' : 'unctad_fdi_flow_outward');
          line(q('#trFdC'), [{ id: 'w', label: lbl.w, pts: w }, { id: 'u', label: lbl.u, pts: u, dash: true }], { title: t('Foreign direct investment: net inflows and outflows') });
          const common = w.map(p => p[0]).filter(y => at(u, y) != null), y = common.includes(2023) ? 2023 : common[common.length - 1];
          q('#trFdNote').textContent = y != null ? t('The two sources differ and are never added or averaged. For example in {y}, UNCTAD reports {u} and the World Bank {w}.', { y: fy(y), u: mill(at(u, y)), w: mill(at(w, y)) }) : '';
        };
        drawFd();
        box.querySelectorAll('[data-fd]').forEach(b => b.addEventListener('click', () => { st.fdiFlow = b.dataset.fd; box.querySelectorAll('[data-fd]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fd === st.fdiFlow))); drawFd(); }));
        line(q('#trStC'), [{ id: 'si', label: t('Inward stock'), pts: g('unctad_fdi_stock_inward') }, { id: 'so', label: t('Outward stock'), pts: g('unctad_fdi_stock_outward'), dash: true }], { height: 230, title: t('Foreign direct investment: stock') });
        const drawGf = () => {
          const p = st.gfcf === 'usd', s = g(p ? 'wb_ne_gdi_ftot_cd' : 'wb_ne_gdi_ftot_zs');
          line(q('#trGfC'), [{ id: 'g', label: t('Gross fixed capital formation'), pts: s }], { height: 230, yFmt: v => (p ? nfCompact(v) : fmt(v, 0) + '%'), valFmt: v => (p ? usd(v) : pct(v)), title: t('Gross fixed capital formation') });
          const z = g('wb_ne_gdi_ftot_zs'), l = last(z);
          q('#trGfNote').textContent = l ? t('As published by the World Bank; the fall from 2020 (to {p} of GDP in {y}) has not been checked against a second source.', { p: pct(l[1]), y: fy(l[0]) }) : '';
        };
        drawGf();
        box.querySelectorAll('[data-gf]').forEach(b => b.addEventListener('click', () => { st.gfcf = b.dataset.gf; box.querySelectorAll('[data-gf]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.gf === st.gfcf))); drawGf(); }));
        const sizeOf = y => (idal[y] ? sum2(idal[y], 'usd') : null), jobsOf = y => (idal[y] ? sum2(idal[y], 'jobs') : null);
        function sum2(a, k) { return a.reduce((s, r) => s + r[k], 0); }
        bars(q('#trIdY'), allY.map(y => idal[y] ? { id: y, label: fy(y), value: sizeOf(y), sub: t('{n} jobs', { n: nf(jobsOf(y)) }), on: y === st.idalYear } : { label: fy(y), value: 0, text: t('not published'), gap: true }), y => { st.idalYear = +y; q('#trIdSel').value = y; drawId(); });
        const drawId = () => {
          const y = st.idalYear, rows = (idal[y] || []).slice().sort((a, b) => b.usd - a.usd);
          q('#trIdSecH').textContent = t('Sectors, {y}', { y: fy(y) });
          bars(q('#trIdSec'), rows.map(r => ({ label: t(r.sector), value: r.usd, sub: t('{n} jobs', { n: nf(r.jobs) }) })));
          q('#trIdY').querySelectorAll('li[data-id]').forEach(li => { const on = li.dataset.id === String(y); li.classList.toggle('on', on); li.setAttribute('aria-pressed', String(on)); });
        };
        drawId();
        q('#trIdSel').addEventListener('change', ev => { st.idalYear = +ev.target.value; drawId(); });
        const drawO = () => {
          const side = st.oSide, yi = fo.years.indexOf(st.oYear), ind = side === 'partner' ? 'OTWD_D_NETAL_FALL_ALL' : 'INWD_D_NETLA_FALL_ALL';
          const rows = fo.rows.filter(r => r[2] === ind && (side === 'partner' ? r[1] === 'LBN' : r[0] === 'LBN')).map(r => [side === 'partner' ? r[0] : r[1], r[4][yi]]).filter(r => r[1] != null && r[1] > 0 && !aggregate(r[0]) && r[0] !== 'LBN');
          const nm = k => (TR.names[k] ? nameOf(k) : (fo.names[k] || k)), world = fo.rows.find(r => r[2] === ind && r[3] === 'O' && (side === 'partner' ? r[1] === 'LBN' && r[0] === 'G001' : r[0] === 'LBN' && r[1] === 'G001'));
          const wv = world ? world[4][yi] : null;
          q('#trOBig').textContent = wv ? t('All partners together, as reported: {v}', { v: usd(wv * 1e6) }) : '';
          bars(q('#trOBars'), rows.sort((a, b) => b[1] - a[1]).slice(0, 15).map(r => ({ label: nm(r[0]), value: r[1] * 1e6, share: wv ? r[1] / wv * 100 : null })));
        };
        drawO();
        q('#trOSide').addEventListener('change', ev => { st.oSide = ev.target.value; drawO(); });
        q('#trOYear').addEventListener('change', ev => { st.oYear = +ev.target.value; drawO(); });
        const vc = inv.vc, vy = years(vc.rows[0].year, vc.rows[vc.rows.length - 1].year), byY = Object.fromEntries(vc.rows.map(r => [r.year, r]));
        bars(q('#trVc'), vy.map(y => { const r = byY[y]; if (!r) return { label: fy(y), value: 0, text: t('no figure found'), gap: true };
          const weak = /^Weak/.test(r.note || ''); return { label: fy(y), value: r.usd, sub: [r.deals != null ? t('{n} deals', { n: nf(r.deals) }) : '', weak ? t('weak source') : ''].filter(Boolean).join(', '), weak }; }));
        q('#trVcSrc').innerHTML = vc.rows.map(r => `<li><span class="mono">${E(fy(r.year))}</span> <a href="${E(r.source_url)}" target="_blank" rel="noopener" data-notr>${E(r.source)}</a> <span class="cf cf-reported">${E(t('reported'))}</span></li>`).join('');
      });
    }
  };
})();
