/* Middle East tab (LEG B-mideast): Lebanon next to 16 neighbours and regional partners. Neighbours (indicators), Ties (migration, remittances, direct investment), Refugees across hosts,
   Conflict events (UCDP GED in Lebanon), Regional shocks. Data: data/mideast/* (built by build/hub/emit_mideast.py). Guide: build/hub/README.md.
   Every tab script shares one scope, so this tab keeps ONE top-level name (ME). tab_mideast.js is one file, so the views sit in blocks below. Charts and maps stay left-to-right in Arabic.
   Routes: #mideast/neighbours/<indicator>/<ISO3,ISO3>, #mideast/ties/<tie>/<year>, #mideast/refugees/<people|per1000>, #mideast/conflict/<year>, #mideast/shocks. */
const ME = { v: {}, idx: null, S: null };
HUB.tab('mideast', { render(args, info) { ME.render(args, info); } });
HUB.mideast = ME;   // for the checks and the console
(function () {
  const E = esc;
  const VIEWS = [['neighbours', N('Neighbours')], ['ties', N('Ties')], ['refugees', N('Refugees')], ['conflict', N('Conflict events')], ['shocks', N('Regional shocks')]];
  const VIEW_IDS = VIEWS.map(v => v[0]);
  const st = ME.S = { view: 'neighbours', ind: 'NY.GDP.PCAP.CD', year: null, sel: ['SYR', 'JOR', 'ISR', 'CYP', 'EGY'], tie: 'abroad', tieYear: null, tieSel: null, fdiSide: 'partner', fdiMeasure: 'total', fdiDir: 'in',
    refMode: 'people', refYear: null, cYear: 2024, cTypes: [1, 2, 3], shockType: 'all', zoom: 'region' };
  // Words that data shows through t(): N() lets the build find them.
  const NAMES = [N('Economy'), N('Prices and inflation'), N('Money flows'), N('Public finance'), N('Trade'), N('Labour'), N('Inequality and poverty'), N('Tourism'), N('Energy'), N('Technology'), N('Environment'),
    N('Population'), N('Health'), N('Education'), N('Development'), N('Migration and displacement'), N('Conflict and safety'), N('Governance'), N('Other')];
  const lang2 = (o, k) => (LANG !== 'en' && o[k + '_' + LANG]) || o[k];
  const nameOf = k => { const n = ME.idx && ME.idx.names[k]; if (!n) return k; return (LANG === 'ar' && n[1]) || (LANG === 'fr' && n[2]) || n[0] || k; };
  const REGION = () => ME.idx.countries.map(c => c.iso3);
  const isRegion = k => ME.idx.countries.some(c => c.iso3 === k);
  const lbl = m => lang2(m, 'label'), unitOf = m => lang2(m, 'unit'), topicOf = m => lang2(m, 'topic');
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const compact = v => { const a = Math.abs(v); return a >= 10000 ? nfCompact(v) : fmt(v, a < 10 ? 2 : a < 100 ? 1 : 0); };
  const fv = (m, v) => {   // a value with its unit: "US$ 4.5K", "14.6% of GDP", "77.9 years"
    if (v == null) return '–';
    const u = m.unit, ul = unitOf(m);
    if (/US\$/.test(u)) return (LANG === 'ar' ? '' : 'US$ ') + compact(v) + (LANG === 'ar' ? ' $' : '');
    if (/^%/.test(u)) return fmt(v, Math.abs(v) < 10 ? 2 : 1) + '%' + (ul.replace(/^%/, '').trim() ? ' ' + ul.replace(/^%/, '').trim() : '');
    return compact(v) + ' ' + ul;
  };
  Object.assign(ME, { nameOf, fv, lbl, median });
  const srcLine = items => {   // every view names its source and licence: items [{src, url, lic}]
    const seen = new Set(), rows = items.filter(i => i && !seen.has(i.src + i.lic) && seen.add(i.src + i.lic)).map(i =>
      `<span class="me-s">${i.url ? `<a href="${E(i.url)}" target="_blank" rel="noopener" data-notr>${E(i.src)}</a>` : `<span data-notr>${E(i.src)}</span>`} <span class="dim">(${E(t('Licence'))}: <span data-notr>${E(i.lic || t('not stated'))}</span>)</span></span>`);
    return `<p class="me-src note"><b>${E(t('Source'))}:</b> ${rows.join('; ')}</p>`;
  };
  ME.srcLine = srcLine;
  /* ranked bars that handle negative values: items [{id, label, value, hi, est, sub}]; fmt(value) gives the text */
  function bars(el, items, fmtv, opts = {}) {
    items = items.filter(i => Number.isFinite(i.value));
    if (!items.length) { el.innerHTML = `<p class="hub-empty">${E(t('No data to chart.'))}</p>`; return; }
    const lo = Math.min(0, ...items.map(i => i.value)), hi = Math.max(0, ...items.map(i => i.value)), span = hi - lo || 1, z = -lo / span * 100;
    el.innerHTML = `<ul class="me-bars">${items.map(i => {
      const a = Math.min(i.value, 0), b = Math.max(i.value, 0), left = (a - lo) / span * 100, w = Math.max((b - a) / span * 100, 0.6);
      return `<li class="${i.hi ? 'hi' : ''}${i.reg ? ' reg' : ''}${i.on ? ' on' : ''}"${i.id ? ` data-id="${E(i.id)}"` : ''}${opts.pick ? ' tabindex="0" role="button"' : ''}${opts.pick ? ` aria-pressed="${!!i.on}"` : ''}><span class="mb-l">${E(i.label)}${i.sub ? ` <span class="dim">${E(i.sub)}</span>` : ''}</span><span class="mb-b" aria-hidden="true">${z > 0.5 && z < 99.5 ? `<u style="inset-inline-start:${z.toFixed(1)}%"></u>` : ''}<i style="inset-inline-start:${left.toFixed(1)}%;width:${w.toFixed(1)}%"></i></span><span class="mb-v mono">${E(fmtv(i.value))}${i.est ? ` <span class="me-est">${E(t('est.'))}</span>` : ''}</span></li>`;
    }).join('')}</ul>`;
    if (opts.pick) el.querySelectorAll('li[data-id]').forEach(li => { const go = () => opts.pick(li.dataset.id); li.addEventListener('click', go); li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  }
  ME.bars = bars;
  const chip = (attrs, on, text) => `<button type="button" class="chip" ${attrs} aria-pressed="${!!on}">${E(text)}</button>`;
  const selectHTML = (id, label, opts, sel) => `<label class="sel"><span>${E(label)}</span><select id="${id}">${opts}</select></label>`;
  const optHTML = (v, text, sel) => `<option value="${E(v)}"${v === sel ? ' selected' : ''}>${E(text)}</option>`;
  Object.assign(ME, { chip, selectHTML, optHTML });
  const csvOf = s => String(s || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);

  /* ---------------------------------------------------------------- router: #mideast/<view>/<a>/<b> */
  function applyRoute(args) {
    const v = (args[0] || '').toLowerCase();
    if (VIEW_IDS.includes(v)) st.view = v; else if (!args.length && !ME.mounted) st.view = 'neighbours';
    const a = args[1], b = args[2];
    if (st.view === 'neighbours') {
      if (a && ME.idx.indicators.some(m => m.id === a)) st.ind = a; else if (a) ME.badLink = true;
      if (b) { const l = csvOf(b).filter((x, i, arr) => isRegion(x) && x !== 'LBN' && arr.indexOf(x) === i); if (l.length) st.sel = l; }
    } else if (st.view === 'ties') {
      if (a && ME.TIES && ME.TIES.some(x => x.id === a)) st.tie = a; else if (a && !ME.TIES) st.tie = a;
      if (/^\d{4}$/.test(b || '')) st.tieYear = +b;
    } else if (st.view === 'refugees') {
      if (a === 'people' || a === 'per1000') st.refMode = a;
    } else if (st.view === 'conflict') {
      if (/^\d{4}$/.test(a || '') && +a >= 1989 && +a <= 2024) st.cYear = +a;
    }
  }
  ME.render = function (args, info) {
    const root = $('#mideastRoot'), n = D.tabs && D.tabs.mideast && D.tabs.mideast.n;
    if (!n) return;
    ME.badLink = false;
    if (ME.idx) { applyRoute(args || []); ME.mount(); return; }
    hubLoadInto(root, ['data/mideast/index.json'], idx => { ME.idx = idx; applyRoute(args || []); ME.mount(); });
  };
  ME.mount = function () {
    const root = $('#mideastRoot');
    if (ME.cur && ME.v[ME.cur] && ME.v[ME.cur].unmount) ME.v[ME.cur].unmount();
    ME.mounted = true;
    root.innerHTML = `<div class="me"><div class="chips me-nav" role="group" aria-label="${E(t('Middle East views'))}">${VIEWS.map(([v, l]) => chip(`data-mv="${v}"`, st.view === v, t(l))).join('')}</div>`
      + `${ME.badLink ? `<p class="note me-bad">${E(t('That address is not in this build. Showing the default view.'))}</p>` : ''}`
      + `<p class="note me-def">${E(t('The Middle East here means 17 economies: Lebanon, Syria, Jordan, Iraq, Israel, Palestine, Egypt, Saudi Arabia, the UAE, Kuwait, Qatar, Bahrain, Oman, Yemen, Iran, Turkey and Cyprus. This is the Hub\'s working definition, not a UN or World Bank region. Borders are drawn as Natural Earth draws them; the Hub takes no position on them.'))}</p>`
      + `<div id="meBody"></div></div>`;
    root.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => { if (st.view !== b.dataset.mv) { st.view = b.dataset.mv; ME.hash(); ME.mount(); } }));
    ME.cur = st.view;
    ME.v[st.view].mount($('#meBody'));
  };
  ME.hash = () => {
    const v = st.view;
    if (v === 'neighbours') HUB.setHash('mideast', v, st.ind, ['LBN'].concat(st.sel).join(','));
    else if (v === 'ties') HUB.setHash('mideast', v, st.tie, st.tieYear || '');
    else if (v === 'refugees') HUB.setHash('mideast', v, st.refMode);
    else if (v === 'conflict') HUB.setHash('mideast', v, st.cYear);
    else HUB.setHash('mideast', v);
  };
  ME.NAMES = NAMES;
  ME.tn = s => { const k = String(s || '').trim(); return NAMES.includes(k) ? t(k) : k; };
  ME.st = st; ME.E = E; ME.csvOf = csvOf; ME.isRegion = isRegion; ME.REGION = REGION; ME.topicOf = topicOf; ME.unitOf = unitOf;
  // the map and the views live in the blocks that follow

  /* ================================================================ Neighbours: pick an indicator, ranked values for a year, and a line chart for chosen economies */
  const PRESETS = [['neighbours', N('Land and sea neighbours')], ['levant', N('Levant')], ['gulf', N('Gulf')], ['big', N('Largest economies')], ['all', N('All 17')]];
  const prepInd = d => { if (!d._p) { d._p = 1; d.yi = new Map(d.years.map((y, i) => [y, i])); } return d; };
  const valOf = (d, k, y) => { const a = d.values[k], i = d.yi.get(y); const v = a && i != null ? a[i] : null; return v == null ? null : v; };
  const estFromOf = (m, iso) => (m.imf ? (ME.idx.est_from[iso] != null ? ME.idx.est_from[iso] : null) : (m.wpp != null ? m.wpp : null));
  const isEst = (m, iso, y) => { const e = estFromOf(m, iso); return e != null && y > e; };
  function defYear(m, d) {   // the latest year in which Lebanon has a value and most economies do too
    const ys = d.years, cnt = ys.map(y => REGION().filter(k => valOf(d, k, y) != null).length), mx = Math.max(...cnt), lb = ys.map(y => valOf(d, 'LBN', y) != null);
    for (let i = ys.length - 1; i >= 0; i--) if (lb[i] && cnt[i] >= 0.6 * mx) return ys[i];
    for (let i = ys.length - 1; i >= 0; i--) if (cnt[i] >= 0.6 * mx) return ys[i];
    return ys[ys.length - 1];
  }
  ME.v.neighbours = {
    mount(body) {
      const idx = ME.idx;
      body.innerHTML = `<div class="me-bar"><label class="sel me-indsel"><span>${E(t('Indicator'))}</span><select id="meInd" aria-label="${E(t('Indicator'))}"></select></label>`
        + `<label class="sel"><span>${E(t('Year'))}</span><select id="meYear" aria-label="${E(t('Year'))}"></select></label></div>`
        + `<div class="me-bar" id="mePre" role="group" aria-label="${E(t('Pick economies'))}"></div><div class="me-bar chips" id="meChips" role="group" aria-label="${E(t('Economies on the chart'))}"></div>`
        + `<div id="meNb"></div>`;
      const nb = body.querySelector('#meNb');
      hubLoadInto(nb, ['data/mideast/indicators.json', 'data/mideast/indicators-imf.json'], (open, imf) => {
        const DATA = Object.assign({}, open, imf), by = new Map(), q = s => body.querySelector(s);
        idx.indicators.forEach(m => { if (!by.has(m.topic)) by.set(m.topic, []); by.get(m.topic).push(m); });
        q('#meInd').innerHTML = [...by].map(([tp_, list]) => `<optgroup label="${E(ME.tn(lang2(list[0], 'topic')))}">${list.filter(m => DATA[m.id]).map(m => optHTML(m.id, lbl(m), st.ind)).join('')}</optgroup>`).join('');
        q('#mePre').innerHTML = `<span class="me-pl">${E(t('Quick picks'))}</span>` + PRESETS.map(([k, l]) => chip(`data-pre="${k}"`, false, t(l))).join('');
        q('#meChips').innerHTML = idx.countries.map(c => c.iso3 === 'LBN' ? `<button type="button" class="chip" data-c="LBN" aria-pressed="true" disabled>${E(nameOf('LBN'))}</button>` : chip(`data-c="${c.iso3}"`, st.sel.includes(c.iso3), nameOf(c.iso3))).join('');
        const draw = () => {
          const m = idx.indicators.find(x => x.id === st.ind) || idx.indicators[0], d = prepInd(DATA[m.id]);
          if (st.ind !== m.id) st.ind = m.id;
          const cnt = y => REGION().filter(k => valOf(d, k, y) != null).length;
          const ys = d.years.filter(y => cnt(y) >= 3).reverse();
          if (st.year == null || !d.yi.has(st.year) || cnt(st.year) < 3) st.year = defYear(m, d);
          q('#meYear').innerHTML = ys.map(y => optHTML(String(y), fy(y), String(st.year))).join('');
          q('#meInd').value = m.id;
          q('#meChips').querySelectorAll('[data-c]').forEach(b => { if (b.dataset.c !== 'LBN') b.setAttribute('aria-pressed', String(st.sel.includes(b.dataset.c))); });
          const rows = REGION().map(k => ({ id: k, v: valOf(d, k, st.year) })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
          const lb = valOf(d, 'LBN', st.year), vs = rows.map(r => r.v), rank = lb == null ? null : 1 + vs.filter(x => x > lb).length;
          const lpts = d.years.map(y => [y, valOf(d, 'LBN', y)]).filter(p => p[1] != null);
          const last = lpts[lpts.length - 1];
          let h = `<div class="me-main"><div class="me-col"><h3 class="d-h">${E(t('Values in {year}', { year: fy(st.year) }))}</h3><p class="note">${E(t('Click an economy to add it to or remove it from the chart. Lebanon is always shown.'))}</p><div id="meBars"></div></div>`;
          h += `<aside class="me-side" aria-live="polite"><div class="me-card"><h3 class="d-h">${E(nameOf('LBN'))}</h3>`;
          if (lb != null) {
            h += `<p class="me-rank mono">${E(fv(m, lb))}${isEst(m, 'LBN', st.year) ? ` <span class="me-est">${E(t('est.'))}</span>` : ''}</p><p class="note">${E(t('Rank {r} of {n} economies with a value in {year}, where 1 is the highest value.', { r: nf(rank), n: nf(rows.length), year: fy(st.year) }))} ${E(t('Median of these economies: {v}.', { v: fv(m, median(vs)) }))}</p>`;
          } else h += `<p class="note">${E(last ? t('Lebanon has no value for {year}. Its latest is {v} in {y}.', { year: fy(st.year), v: fv(m, last[1]), y: fy(last[0]) }) : t('Lebanon has no value for this indicator.'))}</p>`;
          h += `<div class="me-sp">${hubSpark(lpts, lbl(m))}</div>${lpts.length ? `<p class="note">${E(t('Lebanon: {n} yearly values, {a} to {b}.', { n: nf(lpts.length), a: fy(lpts[0][0]), b: fy(last[0]) }))}</p>` : ''}</div></aside></div>`;
          h += `<h3 class="d-h">${E(lbl(m))}</h3><div id="meChart"></div>`;
          h += `<p class="note">${E(unitOf(m))}${m.imf ? ' ' + E(t('Values after the IMF\'s last actual year for each economy are estimates or projections and are drawn dashed; they are marked "est." in the list.')) : ''}${m.wpp != null ? ' ' + E(t('UN projections after {y} are drawn dashed.', { y: fy(m.wpp) })) : ''}</p>`;
          h += m.note ? `<details class="me-det"><summary>${E(t('About this indicator'))}</summary><p>${th(m.note)}</p></details>` : '';
          h += srcLine([{ src: m.src, url: m.url, lic: m.lic }]);
          nb.innerHTML = h;
          bars(nb.querySelector('#meBars'), rows.map(r => ({ id: r.id, label: nameOf(r.id), value: r.v, hi: r.id === 'LBN', on: r.id === 'LBN' || st.sel.includes(r.id), est: isEst(m, r.id, st.year) })), v => fv(m, v), { pick: toggle });
          const series = ['LBN'].concat(st.sel).map(k => ({ id: k, label: nameOf(k), pts: d.years.map(y => [y, valOf(d, k, y)]).filter(p => p[1] != null), estFrom: estFromOf(m, k) })).filter(s => s.pts.length);
          hubLine(nb.querySelector('#meChart'), { series, height: 300, yFmt: /^%/.test(m.unit) ? (v => fmt(v, Math.abs(v) < 10 ? 1 : 0) + '%') : undefined, valFmt: v => fv(m, v), title: lbl(m), estNote: m.imf || m.wpp != null ? t('estimate') : '' });
        };
        const toggle = k => {
          if (k === 'LBN') return;
          st.sel = st.sel.includes(k) ? st.sel.filter(x => x !== k) : st.sel.concat(k);
          ME.hash(); draw();
        };
        q('#meInd').addEventListener('change', ev => { st.ind = ev.target.value; st.year = null; ME.hash(); draw(); });
        q('#meYear').addEventListener('change', ev => { st.year = +ev.target.value; draw(); });
        q('#meChips').addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (b && !b.disabled) toggle(b.dataset.c); });
        q('#mePre').addEventListener('click', ev => { const b = ev.target.closest('[data-pre]'); if (!b) return; st.sel = idx.presets[b.dataset.pre].filter(k => k !== 'LBN'); ME.hash(); draw(); });
        draw();
      });
    }
  };

  /* ================================================================ the region map: Natural Earth outlines (data/mideast/geo.json), a fill per economy, arcs from Lebanon, tooltip, zoom to the Levant */
  const BOXES = { region: [24, 64, 11, 43, 12], levant: [31.8, 40.2, 29.2, 37.6, 46] };   // lon0, lon1, lat0, lat1, scale (SVG units per degree of latitude)
  const KX = Math.cos(28 * Math.PI / 180);
  const geoCache = {};
  function geoPaths(geo, zoom) {
    const key = zoom;
    if (geoCache[key]) return geoCache[key];
    const b = BOXES[zoom], S = b[4], px = lon => ((lon - b[0]) * KX * S), py = lat => ((b[3] - lat) * S), W = (b[1] - b[0]) * KX * S, H = (b[3] - b[2]) * S, out = { W, H, c: {}, ctr: {} };
    geo.countries.forEach(c => {
      out.c[c.iso3] = c.g.map(poly => poly.map(ring => 'M' + ring.map(p => px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('L') + 'Z').join('')).join('');
      let best = null;   // a point to hang arcs on: the mean of the largest outer ring
      c.g.forEach(poly => { if (!best || poly[0].length > best.length) best = poly[0]; });
      if (best) out.ctr[c.iso3] = [px(best.reduce((s, p) => s + p[0], 0) / best.length), py(best.reduce((s, p) => s + p[1], 0) / best.length)];
    });
    return (geoCache[key] = out);
  }
  const fillOf = f => `color-mix(in srgb, var(--cedar) ${Math.round(14 + 76 * f)}%, var(--paper))`;
  const fillNeg = f => `color-mix(in srgb, var(--diesel) ${Math.round(14 + 76 * f)}%, var(--paper))`;
  /* host: element; o: {geo, zoom, vals: {iso: value}, tip: iso => html, arcs: [{a, b, v}], sel, onPick, aria}. Returns nothing; the legend is drawn under the map. */
  function regionMap(host, o) {
    const g = geoPaths(o.geo, o.zoom), vals = o.vals || {}, ks = Object.keys(vals).filter(k => Number.isFinite(vals[k])), mx = Math.max(1e-9, ...ks.map(k => Math.abs(vals[k]))), neg = ks.some(k => vals[k] < 0);
    const alias = k => (k === 'CYN' ? 'CYP' : k), val = k => vals[alias(k)];
    const order = Object.keys(g.c).sort((a, b) => (isRegion(alias(a)) ? 1 : 0) - (isRegion(alias(b)) ? 1 : 0) || (a === 'LBN' ? 1 : 0) - (b === 'LBN' ? 1 : 0));
    let s = `<rect class="me-sea" width="${g.W}" height="${g.H}"/>`;
    order.forEach(k => {
      const v = val(k), has = Number.isFinite(v), reg = isRegion(alias(k)), nm = nameOf(alias(k));
      const f = has ? Math.sqrt(Math.abs(v) / mx) : 0, st_ = has ? `fill:${v < 0 ? fillNeg(f) : fillOf(f)}` : '';
      s += `<path class="me-c${reg ? ' reg' : ''}${k === 'LBN' ? ' lb' : ''}${has ? ' has' : ''}${o.sel === alias(k) ? ' sel' : ''}" data-iso="${alias(k)}" d="${g.c[k]}" style="${st_}"${reg ? ` aria-label="${E(nm)}"` : ''}><title>${E(nm + (has ? ': ' + (o.fmt ? o.fmt(v) : v) : ''))}</title></path>`;
    });
    const mxa = Math.max(1e-9, ...(o.arcs || []).map(a => Math.abs(a.v)));
    (o.arcs || []).forEach(a => {
      const p = g.ctr[a.a], q = g.ctr[a.b];
      if (!p || !q) return;
      const mxp = (p[0] + q[0]) / 2, myp = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, bend = Math.min(60, len * 0.28);
      s += `<path class="me-arc" d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}Q${(mxp - dy / len * bend).toFixed(1)} ${(myp + dx / len * bend).toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}" style="stroke-width:${(0.7 + 3.2 * Math.sqrt(Math.abs(a.v) / mxa)).toFixed(2)}px"/>`;
    });
    const lc = g.ctr.LBN;
    if (lc) s += `<circle class="me-dot" cx="${lc[0].toFixed(1)}" cy="${lc[1].toFixed(1)}" r="${o.zoom === 'levant' ? 4 : 2.6}"/><text class="me-lbl" x="${(lc[0] - 8).toFixed(1)}" y="${(lc[1] + 3).toFixed(1)}" text-anchor="end">${E(nameOf('LBN'))}</text>`;
    const stops = [0, 0.25, 0.5, 0.75, 1].map(fillOf).join(',');
    host.innerHTML = `<div class="me-stage" dir="ltr"><svg class="me-svg" viewBox="0 0 ${g.W.toFixed(0)} ${g.H.toFixed(0)}" role="group" aria-label="${E(o.aria || '')}">${s}</svg><div class="me-tip" hidden></div>`
      + `<div class="me-zoom" role="group" aria-label="${E(t('Map extent'))}">${chip('data-z="region"', o.zoom === 'region', t('Region'))}${chip('data-z="levant"', o.zoom === 'levant', t('Levant'))}</div></div>`
      + `<div class="me-legend" dir="ltr"><div class="me-lgbar" style="background:linear-gradient(to right,${stops})"></div><div class="me-lgt"><span>0</span><span>${E(o.fmt ? o.fmt(mx) : fmt(mx, 0))}</span></div>`
      + `<p class="me-lgn"><span class="me-hatch"></span> ${E(t('No value'))}<br><i class="me-arcsw"></i> ${E(t('Arcs join Lebanon and its partners; width follows the value.'))}${neg ? ' ' + E(t('Amber means a negative value.')) : ''} ${E(t('Colour follows the square root of the value.'))}</p></div>`;
    const svg = host.querySelector('svg'), tip = host.querySelector('.me-tip'), stage = host.querySelector('.me-stage');
    svg.addEventListener('pointermove', ev => {
      const p = ev.target.closest && ev.target.closest('path.me-c');
      if (!p || !p.dataset.iso) { tip.hidden = true; return; }
      const r = stage.getBoundingClientRect();
      tip.innerHTML = o.tip ? o.tip(p.dataset.iso) : E(nameOf(p.dataset.iso));
      tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, ev.clientX - r.left + 12)) + 'px'; tip.style.top = Math.max(4, ev.clientY - r.top - tip.offsetHeight - 8) + 'px';
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.addEventListener('click', ev => { const p = ev.target.closest && ev.target.closest('path.me-c.reg'); if (p && o.onPick) o.onPick(p.dataset.iso); });
    host.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => { if (o.onZoom) o.onZoom(b.dataset.z); }));
  }
  ME.regionMap = regionMap;

  /* ================================================================ Ties: migrants, remittances, direct investment, on a region map with ranked bars */
  const TIES = ME.TIES = [{ id: 'abroad', grp: N('People'), label: N('Lebanese-born people abroad, by destination') }, { id: 'inregion', grp: N('People'), label: N('People in Lebanon born in other economies of the region') },
    { id: 'corridors', grp: N('People'), label: N('Largest migrant corridors among the 17 economies') }, { id: 'remin', grp: N('Money'), label: N('Remittances sent to Lebanon, 2021 (modelled)') },
    { id: 'remout', grp: N('Money'), label: N('Remittances sent from Lebanon, 2021 (modelled)') }, { id: 'fdi', grp: N('Money'), label: N('Direct investment positions between Lebanon and partners') }];
  const usd = v => (LANG === 'ar' ? '' : 'US$ ') + compact(v * 1e6) + (LANG === 'ar' ? ' $' : '');
  const FDI_M = { total: '_FALL_', equity: '_F51_', debt: '_FL_' };
  function tieData(id, D) {
    const mig = D.mig, has = k => D.geo.countries.some(c => c.iso3 === k), yi = y => mig.years.indexOf(y), r = { items: [], vals: {}, arcs: [], years: null, fmt: nf, notes: [], src: [], total: null, totalLabel: '' };
    const finish = (rows, src, o = {}) => {   // rows: [{o, d, p (partner iso), v, label}]
      rows = rows.filter(x => Number.isFinite(x.v) && x.v !== 0).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      rows.forEach(x => { r.vals[x.p] = (r.vals[x.p] || 0) + x.v; });
      r.items = rows.slice(0, 15).map(x => ({ id: x.p, label: x.label || nameOf(x.p), value: x.v, reg: isRegion(x.p) && x.p !== 'LBN' && !o.nohi, on: st.tieSel === x.p }));
      r.arcs = rows.filter(x => has(x.o) && has(x.d)).slice(0, o.arcs || 14).map(x => ({ a: x.o, b: x.d, v: x.v }));
      r.rows = rows; r.src = src; r.total = rows.reduce((s, x) => s + x.v, 0);
      const reg = rows.filter(x => isRegion(x.p) && x.p !== 'LBN');
      r.regTotal = reg.reduce((s, x) => s + x.v, 0); r.regN = reg.length; r.allPos = rows.every(x => x.v > 0); r.n = rows.length;
    };
    const migSrc = { src: mig.source, url: mig.source_url, lic: mig.license }, remSrc = { src: D.rem.source, url: D.rem.source_url, lic: D.rem.license }, fdiSrc = { src: D.fdi.source, url: D.fdi.source_url, lic: D.fdi.license };
    if (id === 'abroad' || id === 'inregion' || id === 'corridors') {
      r.years = mig.years; if (yi(st.tieYear) < 0) st.tieYear = mig.years[mig.years.length - 1];
      const i = yi(st.tieYear);
      if (id === 'abroad') {
        finish(mig.abroad.rows.map(x => ({ o: 'LBN', d: x[1], p: x[1], v: x[4][i] })), [migSrc]);
        r.totalLabel = t('Born in Lebanon, living in the {n} destinations UN DESA reports', { n: nf(mig.abroad.rows.length) });
        r.notes = [t('Stocks at 1 July, not flows. UN DESA counts people by place of birth, citizenship or refugee status, depending on what each country reports. Lebanese-born people in destinations that publish no figure are not counted here.')];
      } else if (id === 'inregion') {
        finish(mig.pairs.filter(x => x[1] === 'LBN').map(x => ({ o: x[0], d: 'LBN', p: x[0], v: x[3][i] })), [migSrc]);
        r.totalLabel = t('Living in Lebanon, born in or citizens of the origins listed');
        r.notes = [t('Only the origins that UN DESA reports for Lebanon appear. A missing origin is unreported, not zero (Jordanians in Lebanon, for example). Syrian and Palestinian figures include refugees, so they are not a census of residents.')];
      } else {
        finish(mig.pairs.map(x => ({ o: x[0], d: x[1], p: x[1], v: x[3][i], label: t('{a} to {b}', { a: nameOf(x[0]), b: nameOf(x[1]) }) })), [migSrc], { nohi: true, arcs: 20 });
        r.vals = {}; r.rows.forEach(x => { r.vals[x.d] = (r.vals[x.d] || 0) + x.v; });
        r.totalLabel = t('People living in the other economies of this tab, by country of residence (shading)');
        r.notes = [t('Only pairs that UN DESA publishes are shown. A missing pair is unreported, not zero. The shading adds up the published pairs, so it is a lower bound.')];
      }
      r.unit = t('people'); r.fmt = nf;
    } else if (id === 'remin' || id === 'remout') {
      const f = D.rem[id === 'remin' ? 'to' : 'from'];
      finish(f.flows.map(x => ({ o: x[0], d: x[1], p: id === 'remin' ? x[0] : x[1], v: x[2] })), [remSrc]);
      r.fmt = usd; r.unit = t('million US$');
      r.totalLabel = id === 'remin' ? t('Estimated remittances received by Lebanon from {n} countries', { n: nf(r.n) }) : t('Estimated remittances sent from Lebanon to {n} countries', { n: nf(r.n) });
      r.notes = [t('Modelled estimates, not measured bilateral flows: the World Bank allocates each country\'s total by migrant numbers and incomes. 2021 is the latest edition. Lebanon and Israel are assumed to exchange nothing.')];
    } else {
      const F = D.fdi, i = F.years.indexOf(st.tieYear);
      r.years = F.years; if (i < 0) st.tieYear = 2022;
      const yy = F.years.indexOf(st.tieYear), into = st.fdiDir === 'in', mk = FDI_M[st.fdiMeasure] || '_FALL_', pr = st.fdiSide === 'partner', rows = [];
      F.rows.forEach(x => {
        const [rep, cp, ind, , vals] = x, o = ind.startsWith('OTWD'), inw = ind.startsWith('INWD');
        if (!ind.includes(mk)) return;
        // partner-reported: the partner is the reporter and Lebanon the counterpart. Into Lebanon = the partner's outward position in Lebanon.
        if (pr && cp === 'LBN' && ((into && o) || (!into && inw))) rows.push({ o: into ? rep : 'LBN', d: into ? 'LBN' : rep, p: rep, v: vals[yy] });
        else if (!pr && rep === 'LBN' && ((into && inw) || (!into && o))) rows.push({ o: into ? cp : 'LBN', d: into ? 'LBN' : cp, p: cp, v: vals[yy] });
      });
      finish(rows, [fdiSrc]);
      r.fmt = usd; r.unit = t('million US$');
      r.totalLabel = t('Sum of the {n} partner positions listed (net, year end)', { n: nf(r.n) });
      r.notes = [t('Positions (stocks) at year end, not annual flows. "Net" means liabilities less assets for inward and assets less liabilities for outward positions. IMF aggregates such as "World" or "Europe" overlap with countries and are left out. Lebanon\'s own reports have many gaps, so partner reports are the default; 2023 and 2024 cover fewer economies than 2011 to 2022.')];
    }
    return r;
  }
  ME.v.ties = {
    mount(body) {
      body.innerHTML = `<div class="me-bar"><label class="sel me-indsel"><span>${E(t('Tie'))}</span><select id="meTie" aria-label="${E(t('Tie'))}">`
        + ['People', 'Money'].map(g => `<optgroup label="${E(t(g))}">${TIES.filter(x => x.grp === g).map(x => optHTML(x.id, t(x.label), st.tie)).join('')}</optgroup>`).join('') + `</select></label>`
        + `<label class="sel" id="meTieYL"><span>${E(t('Year'))}</span><select id="meTieY" aria-label="${E(t('Year'))}"></select></label></div>`
        + `<div class="me-bar" id="meFdiBar"><label class="sel"><span>${E(t('Direction'))}</span><select id="meFdiDir"><option value="in">${E(t('Into Lebanon'))}</option><option value="out">${E(t('From Lebanon'))}</option></select></label>`
        + `<label class="sel"><span>${E(t('Reported by'))}</span><select id="meFdiSide"><option value="partner">${E(t('The partner economy'))}</option><option value="lebanon">${E(t('Lebanon'))}</option></select></label>`
        + `<label class="sel"><span>${E(t('Instruments'))}</span><select id="meFdiM"><option value="total">${E(t('All instruments'))}</option><option value="equity">${E(t('Equity'))}</option><option value="debt">${E(t('Debt'))}</option></select></label></div>`
        + `<div id="meTies"></div>`;
      const q = s => body.querySelector(s), host = q('#meTies');
      hubLoadInto(host, ['data/mideast/migrants.json', 'data/mideast/remittances.json', 'data/mideast/fdi.json', 'data/mideast/geo.json'], (mig, rem, fdi, geo) => {
        const D = { mig, rem, fdi, geo };
        const draw = () => {
          if (!TIES.some(x => x.id === st.tie)) st.tie = 'abroad';
          const meta = TIES.find(x => x.id === st.tie), r = tieData(st.tie, D), isF = st.tie === 'fdi';
          q('#meTie').value = st.tie; q('#meFdiBar').hidden = !isF; q('#meTieYL').hidden = !r.years;
          if (r.years) q('#meTieY').innerHTML = r.years.slice().reverse().map(y => optHTML(String(y), fy(y), String(st.tieYear))).join('');
          q('#meFdiDir').value = st.fdiDir; q('#meFdiSide').value = st.fdiSide; q('#meFdiM').value = st.fdiMeasure;
          const yr = r.years ? (LANG === 'ar' ? '\u060c ' : ', ') + fy(st.tieYear) : '';
          const outside = Object.keys(r.vals).filter(k => !D.geo.countries.some(c => c.iso3 === k)).length;
          let h = `<div class="me-main"><div class="me-col"><h3 class="d-h">${E(t(meta.label))}${E(yr)}</h3><div id="meMap"></div></div>`;
          h += `<aside class="me-side" aria-live="polite"><div class="me-card"><h3 class="d-h">${E(t('Largest partners'))}</h3><div id="meTieBars"></div>${r.items.some(i => i.reg) ? `<p class="note">${E(t('Bold: economies of this tab.'))}</p>` : ''}</div>`;
          h += `<div class="me-card"><p class="note">${E(r.totalLabel)}</p><p class="me-rank mono">${E(r.fmt(r.total))}</p>`;
          if (r.allPos && r.regN && st.tie !== 'corridors' && r.total > 0) h += `<p class="note">${E(t('Of this, {v} ({p}%) is with the other economies of this tab.', { v: r.fmt(r.regTotal), p: fmt(r.regTotal / r.total * 100, 1) }))}</p>`;
          h += `</div></aside></div>`;
          h += r.notes.map(n => `<p class="note">${E(n)}</p>`).join('');
          if (outside) h += `<p class="note">${E(t('{n} partners lie outside this map; they are in the list when they are among the largest.', { n: nf(outside) }))}</p>`;
          if (!r.rows.length) h += `<p class="hub-empty">${E(t('No data for this choice. Try another year.'))}</p>`;
          h += srcLine(r.src.concat([{ src: 'Natural Earth', url: 'https://www.naturalearthdata.com/', lic: t('Public domain') }]));
          h += `<p class="note">${E(t('Trade by partner is on the World tab, in Flows.'))} <a href="#world" data-hub="world">${E(t('Open the World tab'))}</a></p>`;
          host.innerHTML = h;
          const pick = k => { st.tieSel = st.tieSel === k ? null : k; draw(); };
          bars(host.querySelector('#meTieBars'), r.items.map(i => Object.assign({}, i, { on: st.tieSel === i.id })), r.fmt, { pick });
          regionMap(host.querySelector('#meMap'), { geo: D.geo, zoom: st.zoom, vals: r.vals, arcs: r.arcs, fmt: r.fmt, sel: st.tieSel, aria: t(meta.label), onPick: pick, onZoom: z => { st.zoom = z; draw(); },
            tip: iso => `<b>${E(nameOf(iso))}</b><br><span class="mono">${E(r.vals[iso] != null ? r.fmt(r.vals[iso]) : t('No value'))}</span>` });
        };
        q('#meTie').addEventListener('change', ev => { st.tie = ev.target.value; st.tieSel = null; st.tieYear = null; ME.hash(); draw(); });
        q('#meTieY').addEventListener('change', ev => { st.tieYear = +ev.target.value; ME.hash(); draw(); });
        q('#meFdiDir').addEventListener('change', ev => { st.fdiDir = ev.target.value; draw(); });
        q('#meFdiSide').addEventListener('change', ev => { st.fdiSide = ev.target.value; draw(); });
        q('#meFdiM').addEventListener('change', ev => { st.fdiMeasure = ev.target.value; draw(); });
        draw();
      });
    }
  };

  /* ================================================================ Refugees across hosts: Syrian refugees in Lebanon, Jordan, Turkey, Iraq and Egypt, 2011 to 2025 */
  ME.v.refugees = {
    mount(body) {
      body.innerHTML = `<div class="me-bar"><div class="chips" role="group" aria-label="${E(t('Measure'))}">${chip('data-rm="people"', st.refMode === 'people', t('Number of people'))}${chip('data-rm="per1000"', st.refMode === 'per1000', t('Per 1,000 residents'))}</div>`
        + `<label class="sel"><span>${E(t('Year'))}</span><select id="meRefY" aria-label="${E(t('Year'))}"></select></label></div><div id="meRef"></div>`;
      const q = s => body.querySelector(s), host = q('#meRef');
      hubLoadInto(host, ['data/mideast/refugees.json'], R => {
        const hosts = R.hosts, years = R.years, ofHost = h => R.rows.filter(r => r.host === h);
        if (st.refYear == null || !years.includes(st.refYear)) st.refYear = years[years.length - 1];
        q('#meRefY').innerHTML = years.slice().reverse().map(y => optHTML(String(y), fy(y), String(st.refYear))).join('');
        const draw = () => {
          const per = st.refMode === 'per1000', key = per ? 'per_1000_pop' : 'refugees', fm = per ? (v => fmt(v, v < 10 ? 2 : 1)) : (v => nf(v));
          body.querySelectorAll('[data-rm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rm === st.refMode)));
          const sh = R.lebanon_share.find(x => x.year === st.refYear) || {}, items = hosts.map(h => { const r = ofHost(h).find(x => x.year === st.refYear); return { id: h, label: nameOf(h), value: r ? r[key] : null, hi: h === 'LBN' }; }).filter(i => i.value != null).sort((a, b) => b.value - a.value);
          let h = `<div class="me-main"><div class="me-col"><h3 class="d-h">${E(per ? t('Syrian refugees per 1,000 residents') : t('Syrian refugees by host country'))}</h3><div id="meRefChart"></div></div>`;
          h += `<aside class="me-side" aria-live="polite"><div class="me-card"><h3 class="d-h">${E(t('In {year}', { year: fy(st.refYear) }))}</h3><div id="meRefBars"></div></div>`;
          h += `<div class="me-card"><h3 class="d-h">${E(nameOf('LBN'))}</h3>`;
          if (sh.lebanon_refugees != null) h += `<p class="me-rank mono">${E(nf(sh.lebanon_refugees))}</p><p class="note">${E(t('{p} per 1,000 residents. Rank {r} of 5 hosts per resident. {s}% of the people counted in the five hosts.', { p: fmt(sh.lebanon_per_1000_pop, 1), r: nf(sh.lebanon_rank_per_capita_among_five), s: fmt(sh.lebanon_share_of_five_host_total_pct, 1) }))}</p>`;
          h += `</div></aside></div>`;
          h += `<h3 class="d-h">${E(t('Lebanon\'s share of the five-host total'))}</h3><div id="meRefShare"></div>`;
          h += `<p class="note">${E(t('UNHCR counts refugees registered with it or, in Turkey, under temporary protection. Lebanon asked UNHCR in 2015 to suspend new registration of Syrians, so its series is a registered stock, not a count of everyone present. The government has quoted higher totals; they are not in this data.'))}</p>`;
          h += `<p class="note">${E(t('Per 1,000 residents divides the refugee count by the host\'s total population, which already includes refugees. The latest population values are model estimates. Palestinians registered with UNRWA are not counted. The fall in 2025 follows returns after December 2024 and registration updates reported by UNHCR; the cause in each host was not isolated.'))}</p>`;
          h += `<p class="note">${E(t('The share covers these five hosts only, not all Syrian refugees: Syrians in Germany, Sweden and elsewhere are outside this data.'))}</p>`;
          h += srcLine([{ src: R.source, url: R.source_url, lic: R.license }, { src: 'World Bank, World Development Indicators (population)', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL', lic: R.license_population }]);
          host.innerHTML = h;
          hubLine(host.querySelector('#meRefChart'), { series: hosts.map(k => ({ id: k, label: nameOf(k), pts: ofHost(k).filter(r => r[key] != null).map(r => [r.year, r[key]]) })), height: 300, valFmt: fm, yFmt: per ? (v => fmt(v, v < 10 ? 1 : 0)) : undefined,
            markers: [{ x: 2015, label: t('Registration paused in Lebanon') }], title: t('Syrian refugees by host country') });
          bars(host.querySelector('#meRefBars'), items, fm);
          hubLine(host.querySelector('#meRefShare'), { series: [{ id: 'sh', label: nameOf('LBN'), pts: R.lebanon_share.map(x => [x.year, x.lebanon_share_of_five_host_total_pct]) }], height: 180, valFmt: v => fmt(v, 1) + '%', yFmt: v => fmt(v, 0) + '%', title: t('Lebanon\'s share of the five-host total') });
        };
        body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { st.refMode = b.dataset.rm; ME.hash(); draw(); }));
        q('#meRefY').addEventListener('change', ev => { st.refYear = +ev.target.value; draw(); });
        draw();
      });
    }
  };

  /* ================================================================ Conflict events: UCDP GED events located in Lebanon, on a map with a year slider, and deaths per year */
  const CT = { 1: N('State-based armed conflict'), 2: N('Non-state conflict'), 3: N('One-sided violence') };
  const PREC = { 1: N('exact location'), 2: N('within about 25 km'), 3: N('centre of a district'), 4: N('centre of a province'), 5: N('on a line or in a fuzzy area') };
  const MB = { lon0: 34.95, lat1: 34.75, k: Math.cos(33.9 * Math.PI / 180), S: 260 };
  const mpx = (lon, lat) => [(lon - MB.lon0) * MB.k * MB.S, (MB.lat1 - lat) * MB.S];
  const dayRange = (a, b) => (b && b !== a ? t('{a} to {b}', { a: fmtDate(a), b: fmtDate(b) }) : fmtDate(a));
  ME.v.conflict = {
    unmount() { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.ro) { this.ro.disconnect(); this.ro = null; } this.live = false; },
    mount(body) {
      const me = this; me.live = true;
      body.innerHTML = `<div class="me-bar me-yrbar"><button type="button" class="chip" id="mePlay" aria-pressed="false">${E(t('Play'))}</button><input id="meCY" type="range" min="1989" max="2024" step="1" aria-label="${E(t('Year'))}"><output id="meCYo" class="mono" for="meCY"></output></div>`
        + `<div class="me-bar chips" id="meTypes" role="group" aria-label="${E(t('Kinds of violence'))}">${[1, 2, 3].map(k => chip(`data-ty="${k}"`, st.cTypes.includes(k), t(CT[k]))).join('')}</div><div id="meCf"></div>`;
      const q = s => body.querySelector(s), host = q('#meCf'), slider = q('#meCY');
      hubLoadInto(host, ['data/mideast/ucdp.json', 'data/mideast/lebanon.json'], (U, L) => {
        const C = Object.fromEntries(U.columns.map((c, i) => [c, i])), by = {};
        U.rows.forEach(r => { (by[r[C.date_start].slice(0, 4)] = by[r[C.date_start].slice(0, 4)] || []).push(r); });
        const polys = L.provinces.map(p => p.r.map(ring => 'M' + ring.map(pt => { const a = mpx(pt[0], pt[1]); return a[0].toFixed(1) + ' ' + a[1].toFixed(1); }).join('L') + 'Z').join('')), W = mpx(36.75, 34.75)[0], H = mpx(36.75, 32.95)[1];
        let sel = null;
        const ev = r => ({ id: r[C.id], d0: r[C.date_start], d1: r[C.date_end], dp: r[C.date_prec], lat: r[C.lat], lon: r[C.lon], wp: r[C.where_prec], ty: r[C.type], a: U.sides[r[C.side_a]], b: U.sides[r[C.side_b]], best: r[C.best], low: r[C.low], high: r[C.high], civ: r[C.deaths_civilians], adm: r[C.adm_1] == null ? '' : U.adm1[r[C.adm_1]] });
        const yearEvents = y => (by[String(y)] || []).map(ev);
        const drawChart = () => {
          const el = q('#meYears'); if (!el) return;
          const w = Math.max(280, el.clientWidth || 640), h = 190, Lm = 44, R = 8, T = 10, B = 24, ys = []; for (let y = 1989; y <= 2024; y++) ys.push(y);
          const tot = y => (by[String(y)] || []).reduce((s, r) => s + r[C.best], 0), mx = Math.max(...ys.map(tot)), tk = niceTicks(0, mx, 4), Y = v => T + (1 - v / (tk[tk.length - 1] || 1)) * (h - T - B), bw = (w - Lm - R) / ys.length;
          let g = tk.map(v => `<line class="gl" x1="${Lm}" x2="${w - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${Lm - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${E(nf(v))}</text>`).join('');
          ys.forEach((y, i) => {
            const x = Lm + i * bw, v = tot(y), n = (by[String(y)] || []).length;
            if (y % 5 === 0) g += `<text class="ax" x="${(x + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${E(fy(y))}</text>`;
            g += n ? `<rect class="me-yb${y === st.cYear ? ' sel' : ''}" data-y="${y}" x="${(x + 1).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(1, h - B - Y(v)).toFixed(1)}"><title>${E(fy(y) + ': ' + t('{n} events, {d} deaths (best estimate)', { n: nf(n), d: nf(v) }))}</title></rect>`
              : `<circle class="me-yn" data-y="${y}" cx="${(x + bw / 2).toFixed(1)}" cy="${h - B - 3}" r="2.5"><title>${E(fy(y) + ': ' + t('no events coded by UCDP'))}</title></circle>`;
          });
          el.classList.add('hc');
          el.innerHTML = `<svg class="hc-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${E(t('UCDP best estimate of deaths per year, 1989 to 2024, events located in Lebanon'))}">${g}</svg>`;
          el.querySelectorAll('[data-y]').forEach(n => n.addEventListener('click', () => { setYear(+n.dataset.y); }));
        };
        const draw = () => {
          const y = st.cYear, all = yearEvents(y), evs = all.filter(e => st.cTypes.includes(e.ty)), drawn = evs.filter(e => e.wp <= 5 && e.lat != null).sort((a, b) => b.best - a.best);
          const sum = f => evs.reduce((s, e) => s + f(e), 0), best = sum(e => e.best), civ = sum(e => e.civ);
          slider.value = y; q('#meCYo').textContent = fy(y);
          q('#meTypes').querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-pressed', String(st.cTypes.includes(+b.dataset.ty))));
          const pairs = {}; evs.forEach(e => { const k = e.a + '\u0001' + e.b; (pairs[k] = pairs[k] || { a: e.a, b: e.b, n: 0, d: 0 }); pairs[k].n++; pairs[k].d += e.best; });
          const top = Object.values(pairs).sort((a, b) => b.d - a.d || b.n - a.n).slice(0, 6), big = evs.slice().sort((a, b) => b.best - a.best).slice(0, 6);
          let h = `<div class="me-main"><div class="me-col"><h3 class="d-h">${E(t('Events in {year}', { year: fy(y) }))}</h3><div class="me-stage me-lbn" dir="ltr"><svg class="me-svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="group" aria-label="${E(t('Map of UCDP conflict events in Lebanon'))}">`
            + `<rect class="me-sea" width="${W.toFixed(0)}" height="${H.toFixed(0)}"/>${polys.map(d => `<path class="me-prov" d="${d}"/>`).join('')}`
            + drawn.map((e, i) => { const p = mpx(e.lon, e.lat), r = Math.min(16, 2.4 + 1.5 * Math.sqrt(e.best)); return `<circle class="me-ev t${e.ty}${e.wp >= 3 ? ' fz' : ''}${sel === e.id ? ' on' : ''}" data-e="${e.id}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}"/>`; }).join('')
            + `</svg><div class="me-tip" hidden></div></div>`
            + `<p class="me-lgn">${[1, 2, 3].map(k => `<i class="me-sw t${k}"></i> ${E(t(CT[k]))}`).join(' &nbsp; ')}<br>${E(t('Circle area follows the best estimate of deaths. Faint circles are placed at the centre of a district or province, or on a line.'))}</p></div>`;
          h += `<aside class="me-side" aria-live="polite"><div class="me-card"><h3 class="d-h">${E(t('UCDP count for {year}', { year: fy(y) }))}</h3>`;
          h += all.length ? `<p class="me-rank mono">${E(t('{n} events, {d} deaths', { n: nf(evs.length), d: nf(best) }))}</p><p class="note">${E(t('Best estimate. {c} of the deaths were civilians. {m} events are not drawn because UCDP could place them only by country or at sea.', { c: nf(civ), m: nf(evs.length - drawn.length) }))}</p>`
            : `<p class="note">${E(t('UCDP codes no qualifying event in Lebanon for {year}. This follows its coding threshold and does not mean that nothing happened.', { year: fy(y) }))}</p>`;
          h += top.length ? `<h4 class="me-h4">${E(t('Sides with the most deaths'))}</h4><ul class="me-list">${top.map(p => `<li>${E(t('{a} and {b}', { a: t(p.a), b: t(p.b) }))} <span class="mono dim">${E(t('{n} events, {d} deaths', { n: nf(p.n), d: nf(p.d) }))}</span></li>`).join('')}</ul>` : '';
          h += big.length ? `<h4 class="me-h4">${E(t('Largest events'))}</h4><ul class="me-list">${big.map(e => `<li><button type="button" class="me-lk" data-e="${e.id}">${E(fmtDate(e.d0))}, ${E(t(e.adm || 'Lebanon'))} (${E(t('{n} deaths', { n: nf(e.best) }))})</button></li>`).join('')}</ul>` : '';
          h += `<div id="meEvd" class="me-evd"></div></div></aside></div>`;
          h += `<h3 class="d-h">${E(t('Deaths per year, UCDP best estimate'))}</h3><div id="meYears"></div>`;
          h += `<p class="note">${E(t('Only events located in Lebanon are counted. Attacks launched from Lebanon that hit places in Israel are located in Israel, so they are not here. A year with no event means UCDP codes none above its threshold, not that nothing happened (2004, 2007, 2009 to 2010, 2019 and 2021 to 2022). GED 25.1 ends in 2024.'))}</p>`;
          h += `<p class="note">${E(t('Event counts are not comparable across years as a measure of intensity; use the death estimates. They are research estimates (best, low and high), not official tolls. The Strike map shows official tolls by war.'))}</p>`;
          h += `<p class="note me-cite"><b>${E(t('Source'))}:</b> <a href="${E(U.source_url)}" target="_blank" rel="noopener" data-notr>Uppsala Conflict Data Program (UCDP), GED Global 25.1</a> <span class="dim">(${E(t('Licence'))}: <span data-notr>CC BY 4.0</span>)</span>. <span data-notr>${E(U.citation)}</span></p>`;
          host.innerHTML = h;
          drawChart();
          const svg = host.querySelector('.me-lbn svg'), tip = host.querySelector('.me-tip'), stg = host.querySelector('.me-lbn'), byId = Object.fromEntries(evs.map(e => [e.id, e]));
          const detail = e => `<h4 class="me-h4">${E(t('Selected event'))}</h4><p>${E(dayRange(e.d0, e.d1))}<br>${E(t('{a} and {b}', { a: t(e.a), b: t(e.b) }))}<br><span class="mono">${E(t('Deaths: {b} best, {l} to {h}', { b: nf(e.best), l: nf(e.low), h: nf(e.high) }))}</span>`
            + `<br>${E(t(CT[e.ty]))}, ${E(t(e.adm || 'Lebanon'))}<br><span class="dim">${E(t('Location: {p}.', { p: t(PREC[e.wp] || 'country only') }))}</span></p>`;
          const show = id => { sel = id; const e = byId[id]; q('#meEvd').innerHTML = e ? detail(e) : ''; host.querySelectorAll('circle.me-ev').forEach(c => c.classList.toggle('on', c.dataset.e === String(id))); };
          if (sel != null && byId[sel]) show(sel); else sel = null;
          svg.addEventListener('pointermove', pe => {
            const c = pe.target.closest && pe.target.closest('circle.me-ev'); if (!c) { tip.hidden = true; return; }
            const e = byId[c.dataset.e], r = stg.getBoundingClientRect();
            tip.innerHTML = `<b>${E(dayRange(e.d0, e.d1))}</b><br>${E(t('{a} and {b}', { a: t(e.a), b: t(e.b) }))}<br><span class="mono">${E(t('Deaths: {b} best, {l} to {h}', { b: nf(e.best), l: nf(e.low), h: nf(e.high) }))}</span>`;
            tip.hidden = false; tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, pe.clientX - r.left + 12)) + 'px'; tip.style.top = Math.max(4, pe.clientY - r.top - tip.offsetHeight - 8) + 'px';
          });
          svg.addEventListener('pointerleave', () => { tip.hidden = true; });
          svg.addEventListener('click', pe => { const c = pe.target.closest && pe.target.closest('circle.me-ev'); if (c) show(c.dataset.e); });
          host.querySelectorAll('.me-lk').forEach(b => b.addEventListener('click', () => show(b.dataset.e)));
        };
        const setYear = y => { st.cYear = y; sel = null; ME.hash(); draw(); };
        me.setYear = setYear;
        if (window.ResizeObserver) { let w0 = 0; me.ro = new ResizeObserver(() => { const el = q('#meYears'); if (el && Math.abs(el.clientWidth - w0) > 8) { w0 = el.clientWidth; drawChart(); } }); me.ro.observe(host); }
        slider.addEventListener('input', () => setYear(+slider.value));
        q('#meTypes').addEventListener('click', ev => { const b = ev.target.closest('[data-ty]'); if (!b) return; const k = +b.dataset.ty; st.cTypes = st.cTypes.includes(k) ? st.cTypes.filter(x => x !== k) : st.cTypes.concat(k); if (!st.cTypes.length) st.cTypes = [k]; draw(); });
        const play = q('#mePlay'), stop = () => { if (me.timer) { clearInterval(me.timer); me.timer = null; } play.setAttribute('aria-pressed', 'false'); play.textContent = t('Play'); };
        play.addEventListener('click', () => {
          if (me.timer) { stop(); return; }
          if (st.cYear >= 2024) st.cYear = 1988;
          play.setAttribute('aria-pressed', 'true'); play.textContent = t('Pause');
          me.timer = setInterval(() => { if ($('#mideast').hidden || !me.live || st.cYear >= 2024) { stop(); return; } setYear(st.cYear + 1); }, 900);
        });
        draw();
      });
    }
  };

  /* ================================================================ Regional shocks: dated events that touched Lebanon, each linking to the Timeline */
  const TYPES = [N('diplomacy'), N('trade'), N('energy'), N('war'), N('law'), N('refugees'), N('crisis'), N('agreement')];
  const CONF = { verified: N('verified'), reported: N('reported'), inference: N('inference') };
  const norm = s => String(s || '').trim().toLowerCase();
  function timelineEvent(r) {   // the Timeline event that carries this row: by the title it was merged into, or by its own title
    const ev = (D.events || []), want = [r.dup, r.title].filter(Boolean).map(norm);
    for (const w of want) { const e = ev.find(x => norm(x.title) === w || (x.parts || []).some(p => norm(p.title) === w)); if (e) return e; }
    return null;
  }
  const host_ = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  ME.v.shocks = {
    mount(body) {
      body.innerHTML = '<div class="me-bar chips" id="meShT" role="group"></div><div id="meSh"></div>';
      const q = s => body.querySelector(s), host = q('#meSh');
      q('#meShT').setAttribute('aria-label', t('Kinds of event'));
      hubLoadInto(host, ['data/mideast/shocks.json'], S => {
        const rows = S.rows, types = [...new Set(rows.map(r => r.type))];
        if (st.shockType !== 'all' && !types.includes(st.shockType)) st.shockType = 'all';
        const draw = () => {
          q('#meShT').innerHTML = chip('data-st="all"', st.shockType === 'all', t('All')) + types.map(k => chip(`data-st="${E(k)}"`, st.shockType === k, t(k))).join('');
          const list = rows.filter(r => st.shockType === 'all' || r.type === st.shockType);
          let h = `<p class="note">${E(tp('{n} dated event that touched Lebanon, 2012 to 2026. Each is also on the Timeline.', '{n} dated events that touched Lebanon, 2012 to 2026. Each is also on the Timeline.', list.length))}</p><ol class="me-shocks">`;
          h += list.map((r, i) => {
            const e = timelineEvent(r), links = r.src.slice(0, 3).map(u => `<a href="${E(u)}" target="_blank" rel="noopener" data-notr>${E(host_(u))}</a>`).join(', ');
            return `<li class="me-shock" data-i="${i}"><div class="me-sh-d mono">${E(fmtDate(r.date))}</div><div class="me-sh-b"><h4>${th(r.title)}</h4><p>${th(r.why)}</p>`
              + `<p class="me-sh-m"><span class="chip me-ty">${E(t(r.type))}</span> <span class="cf cf-${E(r.c)}">${E(t(CONF[r.c] || r.c))}</span>${r.actors.length ? ` <span class="dim">${E(r.actors.map(a => t(a)).join(', '))}</span>` : ''}${r.deaths != null ? ` <span class="mono">${E(t('Deaths reported: {n}', { n: nf(r.deaths) }))}</span>` : ''}</p>`
              + `<p class="me-sh-s"><span class="dim">${E(t('Sources'))}:</span> ${links} <a class="chip me-tl" href="#timeline" data-hub="timeline" data-i="${i}" data-ev="${e ? E(e.id) : ''}" data-y="${E(r.date.slice(0, 4))}">${E(t('Show on the Timeline'))}</a></p></div></li>`;
          }).join('') + '</ol>';
          h += `<p class="note">${E(t('Some rows rest on one family of sources and are marked reported; the sources are linked on each row.'))}</p>`;
          h += `<p class="me-src note"><b>${E(t('Source'))}:</b> <span data-notr>${E(t('Press and agency reports linked on each row; compiled by the Hub'))}</span> <span class="dim">(${E(t('Licence'))}: <span data-notr>CC BY-SA 4.0</span>)</span></p>`;
          host.innerHTML = h;
        };
        q('#meShT').addEventListener('click', ev => { const b = ev.target.closest('[data-st]'); if (b) { st.shockType = b.dataset.st; draw(); } });
        host.addEventListener('click', ev => {
          const a = ev.target.closest('a.me-tl'); if (!a) return;
          ev.preventDefault(); ev.stopPropagation();
          HUB.show('timeline', { push: true }); window.scrollTo(0, 0);
          try { if (a.dataset.ev && typeof openEventCard === 'function') openEventCard(a.dataset.ev); else if (typeof openYearCard === 'function') openYearCard(+a.dataset.y); } catch (e) { /* the Timeline still opens */ }
        });
        draw();
      });
    }
  };
})();
