/* World tab (FE-C): a 3D globe and a flat map of Lebanon against the world, compare charts, correlations and flows.
   Data: data/world/* (built by build/hub/emit_world.py). Guide: build/hub/README.md.
   Every tab script shares one scope, so this tab keeps ONE top-level name (WD). tab_world.js: state, data, colour scales, router.
   tab_world_stage.js: the globe and the flat map. tab_world_views.js: map, flows, compare and correlations. */
const WD = { v: {}, ent: {}, idx: null, S: null, tok: 0, cur: null };
HUB.tab('world', { render(args, info) { WD.render(args, info); } });
HUB.world = WD;   // for the checks and the console
(function () {
  const st = WD.S = { view: 'map', ind: 'NY.GDP.PCAP.CD', year: null, mode: 'globe', preset: 'world', sel: null, log: null, region: false, peers: ['SYR', 'JOR', 'IRQ', 'ISR', 'CYP', 'EGY', 'TUR', 'SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'FRA', 'GRC', 'USA', 'WLD'] };
  const PREF = 'wd-prefs', LIBS = { globe: 'https://cdn.jsdelivr.net/npm/globe.gl@2.45.3/dist/globe.gl.min.js', arr: 'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js', geo: 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js' };
  // Group and topic names are shown through t(); N() lets the build find them.
  const NAMES = [N('Economy'), N('Prices and inflation'), N('Money flows'), N('Public finance'), N('Trade'), N('Labour'), N('Inequality and poverty'), N('Tourism'), N('Energy'), N('Technology'), N('Environment'),
    N('Population'), N('Health'), N('Education'), N('Development'), N('Migration and displacement'), N('Conflict and safety'), N('Governance'), N('Cost of living'), N('Public money'), N('Electricity'),
    N('Climate'), N('Migration'), N('Displacement'), N('Refugees'), N('War'), N('Exchange rates'), N('Emigration'), N('Transport'), N('UNIFIL'), N('Other'),
    N('World'), N('Middle East, North Africa, Afghanistan & Pakistan'), N('Middle East, North Africa, Afghanistan & Pakistan (excluding high income)'), N('European Union'), N('Euro area'), N('Arab World'),
    N('Europe & Central Asia'), N('East Asia & Pacific'), N('North America'), N('High income'), N('Low income'), N('Middle income'), N('Lower middle income'), N('Upper middle income'), N('OECD members'),
    N('Sub-Saharan Africa'), N('South Asia'), N('Latin America & Caribbean'), N('Low & middle income'), N('Middle East (developing only)')];
  const tn = s => { const k = String(s || '').trim(); return NAMES.includes(k) ? t(k) : k; };
  WD.tn = tn;
  const savePref = () => store.set(PREF, JSON.stringify({ mode: st.mode, preset: st.preset }));
  const loadPref = () => { try { return JSON.parse(store.get(PREF) || '{}') || {}; } catch (e) { return {}; } };
  WD.savePref = savePref;
  WD.reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const scripts = {};
  WD.script = k => { const url = LIBS[k]; return scripts[k] || (scripts[k] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = url; s.async = true; s.onload = ok; s.onerror = () => { delete scripts[k]; no(new Error('script ' + url)); }; document.head.appendChild(s); })); };

  /* ---------------------------------------------------------------- names, ranks, formats */
  const isAgg = k => { const e = WD.ent[k]; return e ? !!e.g : /^OWID_/.test(k); };
  const cname = k => { const e = WD.ent[k]; if (!e) return k; return (LANG === 'ar' && e.ar) || (LANG === 'fr' && e.fr) || tn(e.n); };
  const lang2 = (o, k) => (LANG !== 'en' && o[k + '_' + LANG]) || o[k];
  const ord = n => {
    if (LANG === 'ar') return nf(n);
    if (LANG === 'fr') return n === 1 ? '1er' : nf(n) + 'e';
    const m = n % 100, s = (m >= 11 && m <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0];
    return nf(n) + s;
  };
  Object.assign(WD, { isAgg, cname, ord, lang2, lbl: m => lang2(m, 'label'), unitOf: m => lang2(m, 'unit') });
  const prep = d => {
    if (d._p) return d;
    d._p = 1; d.yi = new Map(d.years.map((y, i) => [y, i])); d.isoC = Object.keys(d.values).filter(k => !isAgg(k)); d._yr = {};
    return d;
  };
  const val = (d, k, y) => { const a = d.values[k], i = d.yi.get(y); const v = a && i != null ? a[i] : null; return v == null ? null : v; };
  function yearRank(d, y) {   // countries with a value, highest first; rank 1 = highest value, ties share a rank
    if (d._yr[y]) return d._yr[y];
    const arr = [];
    d.isoC.forEach(k => { const v = val(d, k, y); if (v != null) arr.push([k, v]); });
    arr.sort((a, b) => b[1] - a[1]);
    const rank = {};
    arr.forEach((p, i) => { rank[p[0]] = i && p[1] === arr[i - 1][1] ? rank[arr[i - 1][0]] : i + 1; });
    return (d._yr[y] = { arr, rank, n: arr.length });
  }
  function scopeRank(d, y, iso, set) {   // rank of iso among the members of set that have a value (iso counts as a member)
    const v = val(d, iso, y); if (v == null) return null;
    let above = 0, n = 0;
    set.forEach(k => { const x = val(d, k, y); if (x != null && !isAgg(k)) { n++; if (x > v) above++; } });
    return { rank: above + 1, n };
  }
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const quant = (s, q) => { const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  Object.assign(WD, { prep, val, yearRank, scopeRank, median, quant });
  const compact = v => { const a = Math.abs(v); return a >= 10000 ? nfCompact(v) : fmt(v, a < 10 ? 2 : a < 100 ? 1 : 0); };
  WD.fn = (m, v) => v == null ? '–' : (m && /^billion US\$/.test(m.unit) ? compact(v * 1e9) : compact(v));
  WD.fv = (m, v) => {   // a value with its unit: "US$ 4.5K", "14.6% of GDP", "77.9 years"
    if (v == null) return '–';
    const u = m.unit, ul = WD.unitOf(m);
    if (/US\$/.test(u) && !/^billion/.test(u)) return (LANG === 'ar' ? '' : 'US$ ') + compact(v) + (LANG === 'ar' ? ' $' : '');
    if (/^billion US\$/.test(u)) return 'US$ ' + compact(v * 1e9);
    if (/^%/.test(u)) return fmt(v, Math.abs(v) < 10 ? 2 : 1) + '%' + (ul.replace(/^%/, '') ? ' ' + ul.replace(/^%/, '').trim() : '');
    return compact(v) + ' ' + ul;
  };

  /* ---------------------------------------------------------------- colours: tokens from the theme, a sequential and a diverging ramp */
  const rgb = s => { s = String(s || '').trim(); let m = /^#([0-9a-f]{3,8})$/i.exec(s); if (m) { let h = m[1]; if (h.length < 6) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); } m = /rgba?\(([^)]+)\)/.exec(s); return m ? m[1].split(',').slice(0, 3).map(x => Math.round(+x)) : [128, 128, 128]; };
  const mix = (a, b, f) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
  const css = (c, a) => a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  WD.tokens = () => {
    const cs = getComputedStyle(document.documentElement), g = k => rgb(cs.getPropertyValue(k)), T = { paper: g('--paper'), ground: g('--ground'), ink: g('--ink'), ink3: g('--ink-3'), cedar: g('--cedar'), diesel: g('--diesel'), sea: g('--sea'), seaSoft: g('--sea-soft'), rule: g('--rule'), rule2: g('--rule-2'), war: g('--war') };
    T.dark = lum(T.ground) < 0.3; T.mid = mix(T.paper, T.ink3, T.dark ? 0.35 : 0.18);
    T.seq = T.dark ? [mix(T.paper, T.cedar, 0.2), mix(T.paper, T.cedar, 0.55), T.cedar, mix(T.cedar, [255, 255, 255], 0.4)] : [mix(T.paper, T.cedar, 0.16), mix(T.paper, T.cedar, 0.5), T.cedar, mix(T.cedar, T.ink, 0.5)];
    T.div = [T.diesel, mix(T.diesel, T.mid, 0.5), T.mid, mix(T.sea, T.mid, 0.5), T.sea];
    return T;
  };
  const ramp = (stops, f) => { f = Math.max(0, Math.min(1, f)); const x = f * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)); return mix(stops[i], stops[i + 1], x - i); };
  WD.ramp = ramp; WD.css = css; WD.mix = mix;
  /* the scale uses the values of ALL years (2nd to 98th percentile), so one colour means one value in every year; log when the values are positive and span 40x or more */
  WD.scale = (d, opts = {}) => {
    const T = WD.tokens(), pool = [];
    const set = opts.set || d.isoC;
    set.forEach(k => { const a = d.values[k]; if (a) a.forEach(v => { if (v != null) pool.push(v); }); });
    pool.sort((a, b) => a - b);
    if (pool.length < 3) return { empty: true, T, colorOf: () => null, stops: T.seq };
    const p2 = quant(pool, 0.02), p98 = quant(pool, 0.98), pos = pool[0] > 0, canLog = pos && p98 / p2 >= 40;
    const log = canLog && opts.log !== false, div = p2 < 0 && p98 > 0 && !log;
    const L = v => (log ? Math.log10(Math.max(v, 1e-12)) : v);
    let lo = L(p2), hi = L(p98); if (hi === lo) hi = lo + 1;
    const m = Math.max(Math.abs(p2), Math.abs(p98)) || 1, stops = div ? T.div : T.seq;
    const f = v => div ? 0.5 + 0.5 * Math.max(-1, Math.min(1, v / m)) : (L(v) - lo) / (hi - lo);
    return { T, div, log, canLog, lo: p2, hi: p98, mid: div ? 0 : null, stops, colorOf: v => (v == null ? null : css(ramp(stops, f(v)))), f };
  };
  WD.gradient = sc => `linear-gradient(to right,${Array.from({ length: 9 }, (_, i) => css(ramp(sc.stops, i / 8))).join(',')})`;

  /* ---------------------------------------------------------------- data */
  WD.lib = {
    ind: id => { const m = WD.idx.byId[id]; return hubLoad(m.f).then(prep); },
    flow: id => hubLoad(WD.idx.flowsById[id].f),
    geo: k => hubLoad(WD.idx.geo[k]),
    leb: () => hubLoad(WD.idx.lebanon.f)
  };
  function initIndex(idx) {
    WD.idx = idx; WD.ent = idx.entities;
    idx.byId = {}; idx.indicators.forEach(m => { idx.byId[m.id] = m; });
    idx.flowsById = {}; idx.flows.forEach(m => { idx.flowsById[m.id] = m; });
    if (!idx.byId[st.ind]) st.ind = idx.indicators[0].id;
  }
  /* options grouped by topic; sel is the id to mark selected. extra: lines [value, text] put first. */
  WD.indOptions = sel => {
    const by = new Map();
    WD.idx.indicators.forEach(m => { if (!by.has(m.topic)) by.set(m.topic, []); by.get(m.topic).push(m); });
    return [...by].map(([tp_, list]) => `<optgroup label="${esc(tn(tp_))}">${list.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(WD.lbl(m))}</option>`).join('')}</optgroup>`).join('');
  };
  WD.srcLine = items => {   // items: [{src, url, lic}]; every view names its source and licence
    const seen = new Set(), rows = items.filter(i => i && !seen.has(i.src + i.lic) && seen.add(i.src + i.lic)).map(i =>
      `<span class="wd-s">${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener" data-notr>${esc(i.src)}</a>` : `<span data-notr>${esc(i.src)}</span>`} <span class="dim">(${esc(t('Licence'))}: <span data-notr>${esc(i.lic || t('not stated'))}</span>)</span></span>`);
    return `<p class="wd-src note"><b>${esc(t('Source'))}:</b> ${rows.join('; ')}</p>`;
  };
  WD.indSrc = m => ({ src: m.src, url: m.url, lic: m.lic, csv: m.csv, json: m.f, id: m.id });
  WD.defYear = (m, d) => (st.year != null && st.year >= m.y0 && st.year <= m.y1 && d && (yearRank(d, st.year).n >= 0.4 * m.n) ? st.year : m.dy);

  /* ---------------------------------------------------------------- router */
  const known = k => !!WD.ent[k];
  function applyRoute(route, args, first) {
    const idx = WD.idx;
    if (first) { const p = loadPref(); if (['globe', 'flat'].includes(p.mode)) st.mode = p.mode; if (['world', 'mena', 'europe', 'us'].includes(p.preset)) st.preset = p.preset; }
    WD.badLink = false;
    if (route === 'compare') {
      st.view = 'compare';
      if (args[0]) { if (idx.byId[args[0]]) st.ind = args[0]; else WD.badLink = true; }
      if (args[1]) { const l = args[1].split(',').map(x => x.trim().toUpperCase()).filter((x, i, a) => known(x) && a.indexOf(x) === i && x !== 'LBN'); if (l.length) st.peers = l; }
    } else if (args.length) {   // #world/<indicator>/<year>
      if (first || st.view === 'compare' || st.view === 'scorecard') st.view = 'map';
      if (args[0]) { if (idx.byId[args[0]]) st.ind = args[0]; else WD.badLink = true; }
      if (/^\d{4}$/.test(args[1] || '')) st.year = +args[1];
    }
  }
  WD.render = function (args, info) {
    const root = $('#worldRoot'), none = $('#wdNone'), n = D.tabs && D.tabs.world && D.tabs.world.n;
    if (!n) { none.hidden = false; root.innerHTML = ''; return; }
    none.hidden = true;
    if (WD.idx) { applyRoute(info.route, args || [], false); WD.mount(); return; }
    hubLoadInto(root, ['data/world/index.json'], idx => { initIndex(idx); applyRoute(info.route, args || [], true); WD.mount(); });
  };
  WD.mount = function () {
    const root = $('#worldRoot'), keep = WD.stage && WD.stage.el;
    if (WD.cur && WD.v[WD.cur] && WD.v[WD.cur].unmount) WD.v[WD.cur].unmount();
    if (keep && keep.parentNode) keep.parentNode.removeChild(keep);   // the WebGL canvas survives a language change
    const views = [['map', N('Map')], ['flows', N('Flows')], ['compare', N('Compare')], ['correlations', N('Correlations')], ['scorecard', N('Scorecard')]];
    root.innerHTML = `<div class="wd"><div class="chips wd-nav" role="group" aria-label="${esc(t('World views'))}">${views.map(([v, l]) => `<button type="button" class="chip" data-wv="${v}" aria-pressed="${st.view === v}">${esc(t(l))}</button>`).join('')}</div>`
      + `${WD.badLink ? `<p class="note wd-bad">${esc(t('That indicator is not in this build. Showing the default one.'))}</p>` : ''}<div id="wdBody"></div><p class="note dx-link"><a href="#data/world" data-hub="data" data-hash="data/world">${esc(t('Data behind this tab'))}</a></p></div>`;
    root.querySelectorAll('[data-wv]').forEach(b => b.addEventListener('click', () => { if (st.view !== b.dataset.wv) { WD.go(b.dataset.wv); } }));
    WD.cur = st.view;
    WD.v[st.view].mount($('#wdBody'));
  };
  WD.go = v => {
    st.view = v; savePref();
    if (v === 'compare') HUB.setHash('compare', st.ind, ['LBN'].concat(st.peers).join(','));
    else HUB.setHash('world', st.ind, st.year || '');
    WD.mount();
  };
  WD.hashMap = () => HUB.setHash('world', st.ind, st.year || WD.idx.byId[st.ind].dy);
  WD.hashCompare = () => HUB.setHash('compare', st.ind, ['LBN'].concat(st.peers).join(','));
  const rerender = () => { if (HUB.current === 'world' && WD.cur && WD.v[WD.cur] && WD.v[WD.cur].theme) WD.v[WD.cur].theme(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender); } catch (e) { /* old browser */ }
  new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
