/* ------------------------------------------------------------ Data tab: the catalogue of public Lebanese datasets, the long-run series and the downloads. All three load on first use.
   data/portals/catalogue.json {cols, rows}: rows are [portal, title, title_ar, publisher, topic, years, granularity, format, url, license, updated, notes].
   data/portals/series.json {series: [{id, label, unit, portal, url, license, from, to, n, notes, pts: [[YYYY or YYYY-MM, value], ...]}]}.
   data/manifest.json lists every published file with its title, source, licence and size. Each file is empty or missing when the build found no research files. */
const PORTAL_NAME = { odl: N('Open Data Lebanon'), cas: N('Central Administration of Statistics'), cib: N('CIB IMPACT') };
const portalName = p => PORTAL_NAME[String(p).toLowerCase()] ? t(PORTAL_NAME[String(p).toLowerCase()]) : p;
let DS = [], PSER = [];
const DQ = { q: '', topic: '', portal: '', fresh: '', shown: 60 };
const FRESH_WORD = { reachable: N('reachable'), moved: N('moved'), unreachable: N('unreachable') };
const dsMap = r => ({ portal: r[0], title: r[1], ar: r[2], pub: r[3], topic: r[4], years: r[5], gran: r[6], fmt: r[7], url: r[8], lic: r[9], upd: r[10], notes: r[11], fr: r[12] || '', fc: r[13] || '', fm: r[14] || '', _h: nrm([r[1], r[2], r[3], r[11], PORTAL_NAME[String(r[0]).toLowerCase()] || r[0]].join(' ')) });
function dataRowHTML(r) {
  const yrs = String(r.years || '').replace(/^(\d{4})-\1$/, '$1').replace(/\d{4}/g, fy);
  const meta = [r.pub ? th(r.pub) : '', esc(yrs), r.gran ? esc(t(r.gran)) : '', r.upd ? esc(t('updated {d}', { d: fmtDate(r.upd) })) : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
  const tags = `<span class="d-tag">${esc(portalName(r.portal))}</span>${r.topic ? `<span class="d-tag">${th(r.topic)}</span>` : ''}${r.fmt ? `<span class="d-tag fmt" translate="no">${esc(String(r.fmt).toUpperCase())}</span>` : ''}`;
  const main = LANG === 'ar' && r.ar ? esc(r.ar) : th(r.title);
  const t0 = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"${LANG === 'ar' && r.ar ? ' lang="ar"' : ''}>${main}</a>` : main;
  const fresh = r.fr ? `<p class="d-n d-fresh fr-${esc(r.fr)}"><span class="fr-dot" aria-hidden="true"></span><b>${esc(t('Checked {d}: {s}', { d: fmtDate(r.fc), s: t(FRESH_WORD[r.fr] || r.fr) }))}</b>${r.fm ? ' · ' + esc(t('file dated {d}', { d: fmtDate(r.fm) })) : ''}</p>` : '';
  return `<li class="d-row"><div class="d-main"><span class="d-t">${t0}</span>${r.ar && LANG !== 'ar' ? `<span class="d-ar" lang="ar" dir="rtl">${esc(r.ar)}</span>` : ''}</div><div class="d-meta">${meta}</div><div class="d-tags">${tags}</div>${fresh}${r.notes ? `<p class="d-n">${th(r.notes)}</p>` : ''}${r.lic ? `<p class="d-n dim">${esc(t('Licence: {l}', { l: r.lic }))}</p>` : ''}</li>`;
}
function dataMatches() {
  const words = nrm(DQ.q).split(/\s+/).filter(Boolean);
  return DS.filter(r => (!DQ.topic || r.topic === DQ.topic) && (!DQ.portal || r.portal === DQ.portal) && (!DQ.fresh || r.fr === DQ.fresh) && words.every(w => r._h.includes(w) || (r._hT && r._hT.includes(w))));
}
function renderDataList() {
  const m = dataMatches(), list = $('#dList'), more = $('#dMore');
  $('#dCount').textContent = t('{a} of {b} datasets', { a: nf(m.length), b: nf(DS.length) });
  list.innerHTML = m.slice(0, DQ.shown).map(dataRowHTML).join('') || `<li class="hub-empty">${esc(t('No dataset matches these filters.'))}</li>`;
  more.hidden = m.length <= DQ.shown;
  more.textContent = t('Show more ({n} left)', { n: nf(Math.max(0, m.length - DQ.shown)) });
}
/* Long-run series: one card per series with an inline SVG sparkline, first and last value, unit, span and source link, grouped by topic.
   The portals give no topic, so it is read from the series id and label (first matching rule wins). Points are 'YYYY' or 'YYYY-MM'. */
const SER_TOPICS = [
  [N('Conflict'), /ucdp|conflict/], [N('Road safety'), /road_|accident/], [N('Health'), /covid|vaccin/],
  [N('Prices and inflation'), /cpi|inflation|price/], [N('Money and interest rates'), /usd_lbp|lbp_usd|exchange|rate_|loans|deposits|remittance/],
  [N('Output (GDP)'), /gdp/], [N('Trade'), /import|export|trade|cement/], [N('Energy'), /edl|petroleum|kwh|gwh/],
  [N('Labour'), /unemploy|lfpr|lfs_|participation|employ/], [N('Travel and tourism'), /arrival|departure|airport|border/],
  [N('Population'), /birth|death|marriage|divorce|voter|population/],
];
const serTopic = s => { const h = ((s.id || '') + ' ' + (s.label || '')).toLowerCase(); const r = SER_TOPICS.find(x => x[1].test(h)); return r ? r[0] : 'Other'; };
const serLab = k => /^\d{4}-\d{2}$/.test(k) ? monShort(+k.slice(5) - 1) + ' ' + fy(k.slice(0, 4)) : fy(k);
const serT = k => +k.slice(0, 4) + (k.length > 4 ? (+k.slice(5) - 1) / 12 : 0);
const serNum = v => { const a = Math.abs(v); return fmt(v, a >= 1000 ? 0 : a >= 100 ? 1 : 2); };
function sparkSVG(pts, label) {
  const W = 240, H = 48, px = 4, py = 6, T = pts.map(p => serT(p[0])), V = pts.map(p => p[1]);
  const t0 = Math.min(...T), t1 = Math.max(...T), v0 = Math.min(...V), v1 = Math.max(...V);
  const x = tt => pts.length < 2 || t1 === t0 ? W / 2 : px + (tt - t0) / (t1 - t0) * (W - 2 * px);
  const y = v => v1 === v0 ? H / 2 : H - py - (v - v0) / (v1 - v0) * (H - 2 * py);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + x(T[i]).toFixed(1) + ' ' + y(V[i]).toFixed(1)).join('');
  const e = (i, c) => `<circle class="sp-dot ${c}" cx="${x(T[i]).toFixed(1)}" cy="${y(V[i]).toFixed(1)}" r="2.6"/>`;
  return `<svg class="sp" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line class="sp-base" x1="${px}" x2="${W - px}" y1="${H - 1}" y2="${H - 1}"/>${pts.length > 1 ? `<path class="sp-line" d="${d}"/>` : ''}${e(0, 'f')}${pts.length > 1 ? e(pts.length - 1, 'l') : ''}</svg>`;
}
function serCardHTML(s) {
  const pts = Array.isArray(s.pts) ? s.pts : [], first = pts[0], last = pts[pts.length - 1], label = tc(s.label);
  const span = first ? (first[0] === last[0] ? serLab(first[0]) : t('{a} to {b}', { a: serLab(first[0]), b: serLab(last[0]) })) : s.from != null && s.to != null ? (s.from === s.to ? fy(s.from) : t('{a} to {b}', { a: fy(s.from), b: fy(s.to) })) : t('span not recorded');
  const unit = s.unit ? ` (${tc(s.unit)})` : '';
  const aria = first ? (first === last ? t('{label}{unit}: one value, {v} in {d}', { label, unit, v: serNum(first[1]), d: serLab(first[0]) })
    : t('{label}{unit}: from {a} in {d1} to {b} in {d2}', { label, unit, a: serNum(first[1]), d1: serLab(first[0]), b: serNum(last[1]), d2: serLab(last[0]) })) : label;
  const vals = first ? `<dl class="sp-v"><div><dt>${esc(first === last ? t('Only value, {d}', { d: serLab(first[0]) }) : t('First, {d}', { d: serLab(first[0]) }))}</dt><dd>${serNum(first[1])}</dd></div>${first === last ? '' : `<div><dt>${esc(t('Last, {d}', { d: serLab(last[0]) }))}</dt><dd>${serNum(last[1])}</dd></div>`}</dl>` : '';
  const src = s.url ? `<a class="sp-src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(t('Source: {s}', { s: portalName(s.portal || '') }))}</a>` : `<span class="dim">${esc(t('No source link recorded'))}</span>`;
  return `<li class="sp-card"><span class="d-t">${th(s.label)}</span>${first ? sparkSVG(pts, aria) : ''}${vals}<span class="d-meta"><span>${esc(span)}</span>${s.n ? `<span>${esc(tp('{n} point', '{n} points', s.n))}</span>` : ''}${s.unit ? `<span>${esc(t(s.unit))}</span>` : ''}</span>${src}</li>`;
}
function seriesHTML() {
  if (!PSER.length) return `<p class="hub-empty" id="dSeriesEmpty">${esc(t('No long-run series are loaded in this build yet.'))}</p>`;
  const g = {};
  PSER.forEach(s => { (g[serTopic(s)] = g[serTopic(s)] || []).push(s); });
  const names = Object.keys(g).sort((a, b) => (a === 'Other') - (b === 'Other') || t(a).localeCompare(t(b), LANG));
  return `<p class="note" id="dSeriesCount">${esc(t('{n} series in {m} topics. Each line is scaled to its own range, so compare shapes, not heights.', { n: nf(PSER.length), m: nf(names.length) }))}</p><div id="dSeries">${names.map(n =>
    `<h4 class="sp-topic">${esc(t(n))} <span class="mono dim">${nf(g[n].length)}</span></h4><ul class="sp-grid">${g[n].sort((a, b) => a.label.localeCompare(b.label)).map(serCardHTML).join('')}</ul>`).join('')}</div>`;
}
/* downloads: data/manifest.json -> a list per kind; the series CSVs are many, so they sit in a searchable <details> */
/* Download titles are English sentences built by the emitters. They are translated in three steps: a family pattern whose parts are translated (World tables), the sentence with its numbers
   swapped for {n1}, {n2} (the same key the build lists), then "label (unit)" with each part translated. A title with no translation stays English and says so (lang="en"). */
const trLU = s => {
  const v = tLookup(s); if (v != null) return v;
  const m = /^(.*\S)\s+\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/.exec(s); if (!m) return null;
  const a = trLU(m[1]), b = trLU(m[2]); return a != null && b != null ? a + ' (' + b + ')' : null;
};
const dlNum = m => /^\d{4}$/.test(m) ? fy(m) : /^\d[\d,]*$/.test(m) ? nf(+m.replace(/,/g, '')) : m;
function dlTitle(f) {
  const s = f.title;
  if (LANG === 'en') return { text: s, tr: true };
  let m = /^(Series|World): (.+), (\d+) (series|indicators), long format(?:, part (\d+) of (\d+))?$/.exec(s), l;
  if (m && (l = trLU(m[2])) != null) return { text: t(m[1] === 'Series' ? 'Series: {a}, {b} series, long format' : 'World: {a}, {b} indicators, long format', { a: l, b: nf(+m[3]) }) + (m[5] ? t(', part {a} of {b}', { a: nf(+m[5]), b: nf(+m[6]) }) : ''), tr: true };
  m = /^World: (.+), one row per country, one column per year$/.exec(s);
  if (m && (l = trLU(m[1])) != null) return { text: t('World: {a}, one row per country, one column per year', { a: l }), tr: true };
  m = /^World: (.+), (\d+) countries and groups, (\d{4}) to (\d{4})$/.exec(s);
  if (m && (l = trLU(m[1])) != null) return { text: t('World: {a}, {b} countries and groups, {c} to {d}', { a: l, b: nf(+m[2]), c: fy(m[3]), d: fy(m[4]) }), tr: true };
  const nums = [], key = s.replace(/\d[\d,.]*\d|\d/g, x => { nums.push(x); return '{n' + nums.length + '}'; });
  const v = nums.length && tLookup(key) != null ? tLookup(key) : tLookup(s);
  if (v != null) { const vars = {}; nums.forEach((x, i) => { vars['n' + (i + 1)] = dlNum(x); }); return { text: fill(v, vars), tr: true }; }
  l = trLU(s);
  return l != null ? { text: l, tr: true } : { text: s, tr: false };
}
const dlRow = f => {
  const fmtName = f.path.split('.').pop().toUpperCase(), ti = dlTitle(f);
  const bits = [fmtName, fmtBytes(f.size), f.rows != null ? tp('{n} row', '{n} rows', f.rows) : '', f.license ? t(f.license) : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
  const src = f.source ? (/^https?:/.test(f.source) ? hostOf(f.source) : t(f.source)) : '';
  return `<li class="dl-row"><a class="dl-t" href="${esc(f.path)}" download${ti.tr ? '' : ' lang="en" dir="ltr"'}>${esc(ti.text)}</a><span class="d-meta">${bits}</span>${f.source ? `<span class="dl-src dim">${esc(t('Source: {s}', { s: src }))}</span>` : ''}</li>`;
};
let dlQ = '';
function renderDownloads() {
  const root = $('#dlRoot'); if (!root) return;
  hubLoadInto(root, 'data/manifest.json', m => {
    const files = m.files || [], isSer = f => /^data\/csv\/series\//.test(f.path);
    const main = files.filter(f => f.kind === 'csv' && !isSer(f)), ser = files.filter(isSer), other = files.filter(f => f.kind !== 'csv');
    const total = files.reduce((s, f) => s + f.size, 0);
    root.innerHTML = `<p class="note" id="dlCount">${esc(t('{n} files, {s} in all. Licence of the Hub: {l}.', { n: nf(files.length), s: fmtBytes(total), l: m.license || 'CC BY-SA 4.0' }))}</p>
      <h4 class="sp-topic">${esc(t('Tables'))} <span class="mono dim">${nf(main.length)}</span></h4><ul class="dl-list" id="dlMain">${main.map(dlRow).join('')}</ul>
      <details class="dl-det" id="dlSer"><summary>${esc(t('All series as CSV'))} <span class="mono dim">${nf(ser.length)}</span></summary><label class="vh" for="dlq">${esc(t('Search downloads'))}</label><input id="dlq" type="search" autocomplete="off" placeholder="${esc(t('Search downloads'))}"><ul class="dl-list" id="dlSerList"></ul></details>
      <details class="dl-det" id="dlOth"><summary>${esc(t('Data files the tabs load (JSON)'))} <span class="mono dim">${nf(other.length)}</span></summary><ul class="dl-list">${other.map(dlRow).join('')}</ul></details>`;
    const fill_ = () => { const w = nrm(dlQ).split(/\s+/).filter(Boolean), l = ser.filter(f => w.every(x => nrm(f.title + ' ' + f.path).includes(x))); $('#dlSerList').innerHTML = l.slice(0, 200).map(dlRow).join('') || `<li class="hub-empty">${esc(t('No download matches.'))}</li>`; };
    fill_();
    $('#dlq').value = dlQ;
    let tm = null;
    $('#dlq').addEventListener('input', ev => { clearTimeout(tm); tm = setTimeout(() => { dlQ = ev.target.value; fill_(); }, 120); });
  });
}
/* Laws: data/laws/index.json {cols, url, rows: [law_no, date, title_ar, title_en, topic, type, status, gazette, source, summary_en, fulltext]}; fetched only when the section is first opened.
   source and fulltext are a Legal Informatics Centre lawId (digits) or a whole URL; fulltext is empty when it is the same page as the source. */
const LAW = { rows: null, url: '', h: [], q: '', topic: '', decade: '', shown: 40, bound: false };
const LAW_STATUS = { repealed: N('repealed'), 'not yet numbered': N('number not yet shown on the source'), 'number from press reports': N('number from press reports, not yet on the source') };
const lawLink = v => /^\d+$/.test(v || '') ? LAW.url + v : (v || '');
function lawStatus(st) {
  const m = /^annulled by Constitutional Council decision (\S+) of (\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(st || '');
  return m ? t('annulled by Constitutional Council decision {n} of {d}', { n: m[1], d: fmtDate(m[4] + '-' + m[3].padStart(2, '0') + '-' + m[2].padStart(2, '0')) }) : t(LAW_STATUS[st] || st);
}
function lawRowHTML(r) {
  const [no, date, ar, en, topic, type, status, gaz, src, sum, full] = r, href = lawLink(src), text = lawLink(full) || href;
  const first = LANG === 'ar' ? (ar || en) : (en ? esc(en) + (LANG === 'fr' ? enMark() : '') : esc(ar));
  const title = LANG === 'ar' ? esc(first) : first, lang = LANG === 'ar' ? ' lang="ar" dir="rtl"' : '';
  const t0 = href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${lang}>${title}</a>` : `<span${lang}>${title}</span>`;
  const gm = /^Official Gazette no\. (\S+) of (\d{4})$/.exec(gaz || '');
  const meta = [no != null ? esc(t('Law no. {n}', { n: nf(no) })) : esc(t('no number on the source')), date ? esc(fmtDate(date)) : '', gm ? esc(t('Official Gazette no. {n} of {y}', { n: gm[1], y: fy(gm[2]) })) : '',
    status ? esc(lawStatus(status)) : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
  const fullA = text ? `<a class="d-full" href="${esc(text)}" target="_blank" rel="noopener noreferrer">${esc(t('Full text'))}</a>` : '';
  const summary = LANG !== 'ar' && sum ? `<p class="d-n d-sum"${LANG === 'fr' ? ' lang="en"' : ''}>${esc(sum)}${LANG === 'fr' ? enMark() : ''}</p>` : '';
  return `<li class="d-row"><div class="d-main"><span class="d-t">${t0}</span>${LANG !== 'ar' && ar && en ? `<span class="d-ar" lang="ar" dir="rtl">${esc(ar)}</span>` : ''}</div>${summary}<div class="d-meta">${meta}${fullA ? `<span>${fullA}</span>` : ''}</div><div class="d-tags"><span class="d-tag">${esc(t(topic))}</span><span class="d-tag">${esc(t(type))}</span></div></li>`;
}
function lawMatches() {
  const words = nrm(LAW.q).split(/\s+/).filter(Boolean), d = LAW.decade;
  return LAW.rows.filter((r, i) => (!LAW.topic || r[4] === LAW.topic) && (!d || (r[1] || '').slice(0, 3) === d.slice(0, 3)) && words.every(w => LAW.h[i].includes(w)));
}
function renderLawList() {
  const m = lawMatches(), more = $('#lawMore');
  $('#lawCount').textContent = t('{a} of {b} laws', { a: nf(m.length), b: nf(LAW.rows.length) });
  $('#lawList').innerHTML = m.slice(0, LAW.shown).map(lawRowHTML).join('') || `<li class="hub-empty">${esc(t('No law matches these filters.'))}</li>`;
  more.hidden = m.length <= LAW.shown;
  more.textContent = t('Show more ({n} left)', { n: nf(Math.max(0, m.length - LAW.shown)) });
}
function renderLaws() {
  const root = $('#lawRoot'); if (!root || !LAW.rows) return;
  const tc_ = {}, dec = {};
  LAW.rows.forEach(r => { tc_[r[4]] = (tc_[r[4]] || 0) + 1; const d = (r[1] || '').slice(0, 3); if (/^\d{3}$/.test(d)) dec[d] = (dec[d] || 0) + 1; });
  const tops = Object.entries(tc_).sort((a, b) => t(a[0]).localeCompare(t(b[0]), LANG)).map(([k, n]) => `<option value="${esc(k)}">${esc(t(k))} (${nf(n)})</option>`).join('');
  const decs = Object.keys(dec).sort().map(d => `<option value="${d}0">${esc(t('{y}s', { y: fy(d + '0') }))} (${nf(dec[d])})</option>`).join('');
  root.innerHTML = `<div class="d-filters"><label class="vh" for="lawQ">${esc(t('Search laws'))}</label><input id="lawQ" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Search: 81/2018, banking secrecy, municipalities'))}">
    <label class="sel" for="lawTopic">${esc(t('Subject'))} <select id="lawTopic"><option value="">${esc(t('all subjects'))}</option>${tops}</select></label>
    <label class="sel" for="lawDec">${esc(t('Decade'))} <select id="lawDec"><option value="">${esc(t('all years'))}</option>${decs}</select></label></div>
    <p class="note" id="lawCount" aria-live="polite"></p><ul class="d-list" id="lawList"></ul><button type="button" class="chip" id="lawMore" hidden></button>
    <p class="note">${esc(t('English titles, summaries and subjects were written by hand from the Arabic title, which is the authoritative text. A summary describes the purpose of a law, not its legal effect. Laws of 2025 and 2026 come from the Parliament\'s site as well as the Centre, and a few may be missing.'))}</p>`;
  $('#lawQ').value = LAW.q; $('#lawTopic').value = LAW.topic; $('#lawDec').value = LAW.decade;
  let tm = null;
  $('#lawQ').addEventListener('input', ev => { clearTimeout(tm); tm = setTimeout(() => { LAW.q = ev.target.value; LAW.shown = 40; renderLawList(); }, 120); });
  $('#lawTopic').addEventListener('change', ev => { LAW.topic = ev.target.value; LAW.shown = 40; renderLawList(); });
  $('#lawDec').addEventListener('change', ev => { LAW.decade = ev.target.value; LAW.shown = 40; renderLawList(); });
  $('#lawMore').addEventListener('click', () => { LAW.shown += 40; renderLawList(); });
  renderLawList();
}
function lawsInit() {
  const det = $('#lawDet'); if (!det) return;
  const n = (D.tabs.data || {}).laws;
  if (!n) { det.hidden = true; $('#lawH').hidden = true; if (det.previousElementSibling) det.previousElementSibling.hidden = true; return; }
  $('#lawN').textContent = nf(n);
  const load = () => hubLoadInto($('#lawRoot'), ['data/laws/index.json'], o => {
    LAW.url = o.url || ''; LAW.rows = o.rows || [];
    LAW.h = LAW.rows.map(r => nrm([r[0] != null ? r[0] + ' ' + (r[1] || '').slice(0, 4) + ' ' + r[0] + '/' + (r[1] || '').slice(0, 4) : '', r[3], r[2], r[4], r[5], r[9]].join(' ')));
    renderLaws();
  });
  if (!LAW.bound) { LAW.bound = true; det.addEventListener('toggle', () => { if (det.open && !LAW.rows) load(); }); }
  if (det.open) { if (LAW.rows) renderLaws(); else load(); }
}
let dataLang = null;
function renderData(args, info) {
  const root = $('#dataRoot');
  if (!root) return;
  if (dataLang === LANG) return;  // already built for this language
  dataLang = LANG;
  renderDownloads();
  lawsInit();
  hubLoadInto(root, ['data/portals/catalogue.json', 'data/portals/series.json'], (cat, ser) => {
    DS = (cat.rows || []).map(dsMap);
    PSER = ser.series || [];
    if (LANG !== 'en') DS.forEach(r => { r._hT = nrm([t(r.title), r.pub ? t(r.pub) : '', r.notes ? t(r.notes) : ''].join(' ')); });
    const topics = {}, portals = {};
    DS.forEach(r => { if (r.topic) topics[r.topic] = (topics[r.topic] || 0) + 1; portals[r.portal] = (portals[r.portal] || 0) + 1; });
    const fresh = { reachable: 0, moved: 0, unreachable: 0, checked: '' };
    DS.forEach(r => { if (r.fr) { fresh[r.fr]++; if (r.fc > fresh.checked) fresh.checked = r.fc; } });
    const opt = (o, name) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(name ? name(k) : k)} (${nf(n)})</option>`).join('');
    root.innerHTML = DS.length
      ? `<div class="d-filters"><label class="vh" for="dq">${esc(t('Search datasets'))}</label><input id="dq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Search: prices, electricity, schools, elections'))}">
          <label class="sel" for="dTopic">${esc(t('Topic'))} <select id="dTopic"><option value="">${esc(t('all topics'))}</option>${opt(topics, k => t(k))}</select></label>
          <label class="sel" for="dPortal">${esc(t('Portal'))} <select id="dPortal"><option value="">${esc(t('all portals'))}</option>${opt(portals, portalName)}</select></label>
          <label class="sel" for="dFreshSel">${esc(t('Link'))} <select id="dFreshSel"><option value="">${esc(t('any status'))}</option>${['reachable', 'moved', 'unreachable'].filter(k => fresh[k]).map(k => `<option value="${k}">${esc(t(FRESH_WORD[k]))} (${nf(fresh[k])})</option>`).join('')}</select></label></div>
         <p class="note" id="dFresh">${fresh.checked ? esc(t('Links checked {d}: {a} reachable, {b} moved, {c} unreachable. A reachable link does not mean the file is current.', { d: fmtDate(fresh.checked), a: nf(fresh.reachable), b: nf(fresh.moved), c: nf(fresh.unreachable) })) : ''}</p>
         <p class="note" id="dCount" aria-live="polite"></p><ul class="d-list" id="dList"></ul><button type="button" class="chip" id="dMore" hidden></button>`
      : `<p class="hub-empty" id="dEmpty">${esc(t('No datasets are in this build yet. The catalogues of Open Data Lebanon, the Central Administration of Statistics and CIB IMPACT are added when each crawl finishes.'))}</p>`;
    $('#dSeriesRoot').innerHTML = seriesHTML();
    if (!DS.length) return;
    let tm = null;
    $('#dq').value = DQ.q; $('#dTopic').value = DQ.topic; $('#dPortal').value = DQ.portal; $('#dFreshSel').value = DQ.fresh;
    $('#dFreshSel').addEventListener('change', ev => { DQ.fresh = ev.target.value; DQ.shown = 60; renderDataList(); });
    $('#dq').addEventListener('input', ev => { clearTimeout(tm); tm = setTimeout(() => { DQ.q = ev.target.value; DQ.shown = 60; renderDataList(); }, 120); });
    $('#dTopic').addEventListener('change', ev => { DQ.topic = ev.target.value; DQ.shown = 60; renderDataList(); });
    $('#dPortal').addEventListener('change', ev => { DQ.portal = ev.target.value; DQ.shown = 60; renderDataList(); });
    $('#dMore').addEventListener('click', () => { DQ.shown += 60; renderDataList(); });
    renderDataList();
  });
}
HUB.tab('data', { render: renderData });
