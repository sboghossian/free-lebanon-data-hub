/* ------------------------------------------------------------ Data tab, v10 ("centralize"): the one home of every dataset.
   Topic chips (#data/<topic>, one topic per tab) filter every series (data/series/index.json: label, unit, span, source, licence, sparkline, download)
   and every published file (data/manifest.json, sorted into topics by the rules the build puts in D.tabs.data.rules). Under "All" the page also shows
   the catalogue of public datasets, the laws index and the full downloads list (hub_data.js builds those; this file re-registers the tab and calls it).
   Routes: #data, #data/<topic>, #data/series/<key>, #data/laws/<query>, #data/search/<query>. The search box is tab_data_search.js. */
const DX_TOPICS = [['timeline', N('Timeline')], ['map', N('Strike map')], ['places', N('Places')], ['cost', N('Cost of living')], ['electricity', N('Electricity')], ['trade', N('Trade & investment')],
  ['world', N('World')], ['mideast', N('Middle East')], ['companies', N('Companies')], ['aid', N('Aid & NGOs')]];
const DX_TNAME = Object.fromEntries(DX_TOPICS);
const DX_ORDER = Object.fromEntries(DX_TOPICS.map((x, i) => [x[0], i]));
const DX = { topic: '', sq: '', shown: 30, focus: '', ser: null, man: null, lang: null, rules: null };
const DX_FLAG = { proxy: N('proxy, not official'), derived: N('derived'), low: N('weak unit or source'), lbn: N('Lebanon\'s line; the file holds every country') };
function dxTopicOf(path) {
  if (!DX.rules) DX.rules = ((D.tabs.data || {}).rules || []).map(([p, top]) => [new RegExp(p), top]);
  const r = DX.rules.find(x => x[0].test(path));
  return r ? r[1] : '';
}
const dxTName = top => top ? t(DX_TNAME[top] || top) : t('Open data portals');
/* a time key of a series: YYYY, YYYY-MM, YYYY-MM-DD or YYYY-Qn */
function dxT(k) {
  k = String(k == null ? '' : k);
  let m;
  if ((m = /^(\d{4})-Q([1-4])$/.exec(k))) return t('Q{q} {y}', { q: nf(+m[2]), y: fy(m[1]) });
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return fmtDate(k);
  if (/^\d{4}-\d{2}$/.test(k)) return monShort(+k.slice(5) - 1) + ' ' + fy(k.slice(0, 4));
  return /^\d{4}$/.test(k) ? fy(k) : k;
}
const dxLabel = s => LANG === 'ar' && s.label_ar ? s.label_ar : LANG === 'fr' && s.label_fr ? s.label_fr : t(s.label);
const dxLabelH = s => (LANG === 'ar' && s.label_ar) || (LANG === 'fr' && s.label_fr) ? esc(dxLabel(s)) : th(s.label);
function dxDl(path, id, world) {
  if (!path) return `<span class="dim">${esc(t('No download: the licence does not allow it'))}</span>`;
  const kind = path.split('.').pop().toUpperCase();
  const hint = !id ? '' : world ? tH('topic file: filter indicator_id = {id}', { id: `<span data-notr dir="ltr">${esc(id)}</span>` }) : tH('filter series_id = {id}', { id: `<span data-notr dir="ltr">${esc(id)}</span>` });
  return `<a href="${esc(HUB_BASE + path)}" download data-notr>${esc(kind)}</a>${hint ? ` <span class="dim">(${hint})</span>` : ''}`;
}
function dxSerRow(s) {
  const pts = [];
  for (let i = 0; i + 1 < s.spark.length; i += 2) pts.push([s.spark[i], s.spark[i + 1]]);
  const span = s.t0 ? (s.t0 === s.t1 ? dxT(s.t0) : t('{a} to {b}', { a: dxT(s.t0), b: dxT(s.t1) })) : t('span not recorded');
  const tags = (s.flags || '').split(',').filter(f => DX_FLAG[f]).map(f => ` <span class="chip sm-c fb-tag">${esc(t(DX_FLAG[f]))}</span>`).join('');
  const go = s.topic ? `<a href="#${esc(s.topic)}" data-hub="${esc(s.topic)}">${esc(t('Open the tab'))}</a>` : '';
  const src = /^https?:/.test(s.source_url || '') ? `<a href="${esc(s.source_url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(s.source_url))}</a>` : esc(s.source_url ? t(s.source_url) : t('source not linked'));
  return `<li class="fb-br dx-sr${DX.focus === s.key ? ' dx-focus' : ''}" data-key="${esc(s.key)}"><div class="fb-br-t"><b>${dxLabelH(s)}</b>${tags}</div>
    <div class="fb-br-m mono dim"><span class="dx-tp">${esc(dxTName(s.topic))}</span> · ${esc(s.unit ? t(s.unit) : '')}${s.unit ? ' · ' : ''}${esc(span)} · ${esc(tp('{n} point', '{n} points', s.n))}</div>
    <div class="fb-br-s">${pts.length ? hubSpark(pts, dxLabel(s)) : `<span class="note dx-nosp">${esc(t('No dated values to draw'))}</span>`}</div>
    <div class="fb-br-l note">${esc(t('Source'))}: ${src} · ${esc(t('Licence'))}: ${esc(s.license ? t(String(s.license)).slice(0, 90) : t(FB_UNSTATED))} · ${esc(t('Download'))}: ${dxDl(s.file, s.csv_id, /^data\/csv\/world\//.test(s.file))}${go ? ' · ' + go : ''}</div></li>`;
}
function dxSerMatches() {
  const words = dxNorm(DX.sq).split(' ').filter(Boolean);
  return DX.ser.filter(s => (DX.focus ? s.key === DX.focus : (!DX.topic || s.topic === DX.topic) && words.every(w => s._h.includes(w) || (LANG !== 'en' && dxNorm(t(s.label)).includes(w)))));
}
function dxSerDraw() {
  const list = $('#dxSerL'); if (!list) return;
  const m = dxSerMatches();
  $('#dxSerN').textContent = DX.focus ? '' : t('{a} of {b} series', { a: nf(Math.min(DX.shown, m.length)), b: nf(m.length) });
  list.innerHTML = m.slice(0, DX.shown).map(dxSerRow).join('') || `<li class="hub-empty">${esc(t('No series match.'))}</li>`;
  $('#dxSerMore').hidden = !!DX.focus || m.length <= DX.shown;
  $('#dxSerAll').hidden = !DX.focus;
}
function dxFilesDraw() {
  const el = $('#dxFiles'); if (!el || !DX.man) return;
  const files = (DX.man.files || []).filter(f => dxTopicOf(f.path) === DX.topic);
  const size = files.reduce((a, f) => a + f.size, 0);
  el.innerHTML = files.length ? `<p class="note" id="dxFilesN">${esc(t('{n} files, {s} in all. Each row names its licence.', { n: nf(files.length), s: fmtBytes(size) }))}</p><ul class="dl-list" id="dxFileL">${files.map(dlRow).join('')}</ul>`
    : `<p class="hub-empty">${esc(t('No file is published for this topic in this build.'))}</p>`;
}
function dxHead() {
  const el = $('#dxHead'); if (!el) return;
  const nSer = DX.ser ? DX.ser.filter(s => !DX.topic || s.topic === DX.topic).length : null;
  const nFile = DX.man ? (DX.man.files || []).filter(f => !DX.topic || dxTopicOf(f.path) === DX.topic).length : null;
  const n = nSer == null ? '' : DX.topic ? t('{a} series and {b} files behind this tab.', { a: nf(nSer), b: nf(nFile) }) : t('{a} series and {b} files in all.', { a: nf(nSer), b: nf(nFile) });
  el.innerHTML = DX.topic ? `<h3 class="d-h dx-th">${esc(t('Data behind the {tab} tab', { tab: t(DX_TNAME[DX.topic]) }))}</h3><p class="note">${esc(n)} <a href="#${DX.topic}" data-hub="${DX.topic}" id="dxBack">${esc(t('Open the {tab} tab', { tab: t(DX_TNAME[DX.topic]) }))}</a></p>`
    : `<p class="note" id="dxAllN">${esc(n)}</p>`;
}
function dxNav() {
  const el = $('#dxNav'); if (!el) return;
  el.innerHTML = [['', t('All')]].concat(DX_TOPICS.map(([id, l]) => [id, t(l)])).map(([id, l]) => `<button type="button" class="chip bc" data-tp="${id}" aria-pressed="${id === DX.topic}">${esc(l)}</button>`).join('');
  el.onclick = ev => {
    const b = ev.target.closest('[data-tp]'); if (!b) return;
    DX.focus = ''; DX.shown = 30;
    HUB.setHash('data', ...(b.dataset.tp ? [b.dataset.tp] : []));
    dxSetTopic(b.dataset.tp);
  };
}
function dxSetTopic(top) {
  DX.topic = top;
  $$('#dxNav [data-tp]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tp === top)));
  $('#dxAll').hidden = !!top; $('#dxFilesSec').hidden = !top;
  if (!top) renderData([], {});      // hub_data.js: catalogue, laws, downloads (built once per language)
  dxHead();
  if (DX.ser) { dxSerDraw(); dxFilesDraw(); }
}
function dxSeries() {
  const root = $('#dxSer');
  root.innerHTML = '';
  return hubLoadInto(root, ['data/series/index.json', 'data/manifest.json'], (si, man) => {
    const C = Object.fromEntries((si.cols || []).map((c, i) => [c, i]));
    DX.ser = (si.rows || []).map(r => { const s = {}; Object.keys(C).forEach(k => { s[k] = r[C[k]]; }); s.spark = s.spark || []; return s; })
      .map((s, i) => Object.assign(s, { _i: i, _h: dxNorm([s.label, s.label_ar, s.label_fr, s.id, s.unit].join(' ')) }))
      .sort((a, b) => (DX_ORDER[a.topic] ?? 99) - (DX_ORDER[b.topic] ?? 99) || a._i - b._i);
    DX.man = man;
    root.innerHTML = `<div class="d-filters"><label class="vh" for="dxSq">${esc(t('Search series'))}</label><input id="dxSq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Filter series: bread, GDP, generator, refugees'))}"><span class="mono dim" id="dxSerN" aria-live="polite"></span></div>
      <button type="button" class="chip" id="dxSerAll" hidden>${esc(t('Show every series'))}</button><ul class="fb-brl" id="dxSerL"></ul><button type="button" class="chip" id="dxSerMore" hidden>${esc(t('Show more'))}</button>`;
    $('#dxSq').value = DX.sq;
    let tm = null;
    $('#dxSq').addEventListener('input', ev => { clearTimeout(tm); tm = setTimeout(() => { DX.sq = ev.target.value; DX.shown = 30; dxSerDraw(); }, 120); });
    $('#dxSerMore').addEventListener('click', () => { DX.shown += 30; dxSerDraw(); });
    $('#dxSerAll').addEventListener('click', () => { DX.focus = ''; HUB.setHash('data', ...(DX.topic ? [DX.topic] : [])); dxSerDraw(); });
    dxHead(); dxSerDraw(); dxFilesDraw();
    if (DX.focus) { const r = $('#dxSerL .dx-focus'); if (r) r.scrollIntoView({ block: 'center' }); }
  });
}
/* #data/laws/<query>: the laws section of hub_data.js, opened and filtered */
function dxOpenLaw(q) {
  const det = $('#lawDet'); if (!det || det.hidden) return;
  LAW.q = q; LAW.topic = ''; LAW.decade = ''; LAW.shown = 40;
  if (LAW.rows) { det.open = true; renderLaws(); } else det.open = true;   // the toggle listener (hub_data.js) loads the index and renders with LAW.q
  setTimeout(() => $('#lawH')?.scrollIntoView({ block: 'start' }), 60);
}
function dxRender(args, info) {
  if (!$('#dxSer')) { renderData(args, info); return; }
  const a0 = args[0] || '';
  DX.focus = a0 === 'series' ? (args[1] || '') : '';
  if (DX.focus) { DX.sq = ''; DX.shown = 30; }
  const top = DX_TNAME[a0] ? a0 : (DX.focus || a0 === 'laws' || a0 === 'search' || !info.lang ? '' : DX.topic);
  const fresh = DX.lang !== LANG;
  if (fresh) { DX.lang = LANG; DX.topic = top; dxNav(); dxSearchInit(); }
  dxSetTopic(top);
  if (fresh || !DX.ser) dxSeries(); else if (DX.focus) { const r = $('#dxSerL .dx-focus'); if (r) r.scrollIntoView({ block: 'center' }); }
  if (a0 === 'laws' && args[1]) dxOpenLaw(args.slice(1).join('/'));
  if (a0 === 'search') dxSearchSet(args.slice(1).join('/'));
}
HUB.tab('data', { render: dxRender });
