/* ------------------------------------------------------------ FE-B shared helpers (places, cost of living, electricity tabs). All names start with fb.
   fbT(iso) -> decimal year; fbPts(series) -> [[x, y]]; fbXF(gran) -> axis/tooltip formatter; fbCard(parent, opts) -> a chart card with source, licence, CSV links and a data table;
   fbMap(geo, level, fillFn, opts) -> SVG of the districts or governorates; fbPin(geo, lat, lon); fbShade(f, token) -> theme-safe fill; fbTable(cols, rows); fbBrowse(el, series, opts); fbNav(el, items, cur, onPick). */
const FB_UNSTATED = N('not stated by the publisher');
function fbT(s) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(s));
  if (!m) return NaN;
  const y = +m[1];
  return y + (Date.UTC(y, m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1) - Date.UTC(y, 0, 1)) / (365.25 * 864e5);
}
const fbIso = x => new Date(Date.UTC(Math.floor(x + 1e-6), 0, 1) + (x - Math.floor(x + 1e-6)) * 365.25 * 864e5).toISOString().slice(0, 10);
function fbPts(s, from, to) {
  if (!s._p) s._p = s.points.map(p => [fbT(p[0]), p[1]]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  return from == null && to == null ? s._p : s._p.filter(p => (from == null || p[0] >= from) && (to == null || p[0] <= to));
}
function fbXF(g) {
  return v => {
    if (Number.isInteger(v)) return fy(v);
    const iso = fbIso(v);
    if (g === 'd') return fmtDate(iso);
    return monShort(+iso.slice(5, 7) - 1) + ' ' + fy(+iso.slice(0, 4));
  };
}
const fbVal = (v, d) => Number.isFinite(v) ? (Math.abs(v) >= 1e4 ? nf(v, 0) : nf(v, d == null ? (Math.abs(v) < 10 ? 2 : 1) : d)) : '';
const fbHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const fbById = (list, id) => (list || []).find(s => s.id === id);
const fbDl = (rel, label) => `<a href="${esc(HUB_BASE + rel)}" download>${esc(label)}</a>`;
/* downloads: every series lives in a topic CSV (long format, columns series_id, t, value; label, unit and source are in series-dictionary.csv), so the link says which series_id to filter */
function fbCsvLinks(series, label) {
  const by = new Map();
  series.filter(s => s.csv).forEach(s => { const l = by.get(s.csv) || []; l.push(String(s.csv_id || s.id)); by.set(s.csv, l); });
  return [...by].map(([f, ids]) => fbDl('data/' + f, label || 'CSV') + (/^csv\/series\//.test(f) ? ` <span class="dim">(${tH('filter series_id = {id}', { id: `<span data-notr dir="ltr">${esc([...new Set(ids)].slice(0, 4).join(', '))}</span>` })})</span>` : '')).join(' ');
}
function fbSrcLine(series) {
  const seen = new Map();
  series.forEach(s => { const h = fbHost(s.source_url) || t('source not linked'), k = h + '|' + (s.license || ''); if (!seen.has(k)) seen.set(k, { h, u: s.source_url, l: s.license }); });
  const src = [...seen.values()].map(x => x.u && /^https?:/.test(x.u) ? `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.h)}</a>` : esc(x.h));
  const lic = [...new Set([...seen.values()].map(x => x.l ? String(x.l).split(/[(;]/)[0].trim().slice(0, 60) : t(FB_UNSTATED)))];
  const csv = fbCsvLinks(series);
  return `<p class="fb-src note">${esc(t('Source'))}: ${src.join(', ')}. ${esc(t('Licence'))}: ${esc(lic.join('; '))}.${csv ? ' ' + csv : ''}</p>`;
}
/* values filled from other sources (series.filled = {t: [basis, source]}): the hollow dots and their tooltip */
const FB_WHY = { press_relay: N('press copy of the ministry table'), aggregator_relay: N('TheFuelPrice.com copy of the ministry table'), inferred_bracketed: N('inferred: the fee is the same in the months either side (low confidence)'),
  uncertain: N('carried forward over a decision we could not retrieve'), held: N('held: no later decision found'), constrained: N('constrained to annual totals, not observed (low confidence)'),
  interpolated: N('interpolated between months (low confidence)'), extrapolated: N('extrapolated from the same months of the year before (low confidence)'), statement: N('taken from an official statement (low confidence)') };
const fbFillNote = f => (FB_WHY[f[0]] ? t(FB_WHY[f[0]]) : f[0]) + (f[1] ? ': ' + f[1] : '');
function fbMarks(x) {
  const f = x.s.filled; if (!f) return [];
  const lo = x.from == null ? -Infinity : x.from, hi = x.to == null ? Infinity : x.to, out = [];
  x.s.points.forEach(p => { const v = f[p[0]]; if (v) { const tx = fbT(p[0]); if (tx >= lo && tx <= hi) out.push([tx, x.scale ? p[1] * x.scale : p[1], fbFillNote(v)]); } });
  return out;
}
/* chart card: opts = {title, note, unit, series:[{s (a published series), label, color, dash, from, scale}], gran, log (offer the log toggle), logStart, height, yMin, yMax, yFmt, markers:[{x, label}], table (default true)} */
function fbCard(parent, o) {
  const fig = document.createElement('figure');
  fig.className = 'fb-card';
  const uid = 'fbc' + Math.random().toString(36).slice(2, 8);
  const ser = o.series.filter(x => x.s && fbPts(x.s, x.from, x.to).length);
  fig.innerHTML = `<figcaption><h4 class="fb-t">${esc(o.title)}</h4>${o.unit ? `<p class="fb-u mono dim">${esc(o.unit)}</p>` : ''}${o.note ? `<p class="note">${esc(o.note)}</p>` : ''}</figcaption>
    ${o.log ? `<div class="fb-ctl"><button type="button" class="chip sm-c" data-log aria-pressed="${o.logStart ? 'true' : 'false'}">${esc(t('Log scale'))}</button></div>` : ''}
    <div class="fb-ch" id="${uid}"></div>${ser.length ? fbSrcLine(ser.map(x => Object.assign({}, x.s, { short: x.label }))) : ''}`;
  parent.appendChild(fig);
  const el = fig.querySelector('.fb-ch');
  if (!ser.length) { el.innerHTML = `<p class="hub-empty">${esc(t('No data to chart.'))}</p>`; return { fig, update() {} }; }
  let lg = !!o.logStart;
  const mk = () => ({
    series: ser.map(x => ({ id: x.s.id, label: x.label || x.s.label, color: x.color, dash: x.dash, pts: fbPts(x.s, x.from, x.to).map(p => [p[0], x.scale ? p[1] * x.scale : p[1]]), marks: fbMarks(x) })),
    height: o.height || 250, log: lg, yMin: lg ? undefined : o.yMin, yMax: o.yMax, xFmt: fbXF(o.gran || 'm'), yFmt: o.yFmt, valFmt: o.valFmt || o.yFmt || (v => fbVal(v)), markers: o.markers, title: o.title, legend: false
  });
  const ch = hubLine(el, mk());
  if (ser.some(x => x.s.filled && Object.keys(x.s.filled).length)) el.insertAdjacentHTML('afterend', `<p class="note fb-fillnote"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1.5"/></svg><span>${esc(o.fillNote || t('Hollow dots mark values filled from other sources or estimated. The tooltip says which, and gives the source.'))}</span></p>`);
  fbFixTicks(el);
  if (window.MutationObserver) new MutationObserver(() => fbFixTicks(el)).observe(el, { childList: true });
  const b = fig.querySelector('[data-log]');
  if (b) b.addEventListener('click', () => { lg = !lg; b.setAttribute('aria-pressed', String(lg)); ch.update(mk()); });
  if (o.table !== false) {
    const d = document.createElement('details');
    d.className = 'fb-det';
    d.innerHTML = `<summary>${esc(t('Show the data table'))}</summary><div class="fb-scroll" data-tbl></div>`;
    fig.insertBefore(d, fig.querySelector('.fb-src'));
    d.addEventListener('toggle', () => {
      if (!d.open || d._built) return;
      d._built = true;
      const years = new Set(), by = ser.map(x => { const m = new Map(); fbPts(x.s, x.from, x.to).forEach(p => { const y = Math.floor(p[0] + 1e-6); m.set(y, x.scale ? p[1] * x.scale : p[1]); years.add(y); }); return m; });
      const ys = [...years].sort((a, b) => b - a).slice(0, 60);
      d.querySelector('[data-tbl]').innerHTML = `<table class="fb-tbl"><thead><tr><th>${esc(t('Year'))}</th>${ser.map(x => `<th>${esc(x.label || x.s.label)}</th>`).join('')}</tr></thead><tbody>${ys.map(y => `<tr><th>${fy(y)}</th>${by.map(m => `<td class="mono">${m.has(y) ? esc((o.valFmt || o.yFmt || (v => fbVal(v)))(m.get(y))) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">${esc(t('Last value in each year.'))}</p>`;
    });
  }
  return { fig, update: n => { Object.assign(o, n); ch.update(mk()); } };
}
/* ---------- maps: geo = data/geo/lebanon.json (pre-projected: w, h, lon0, lat1, k, s; adm1 and adm2 with d paths, n, ar, p, l label point) ---------- */
const fbProj = (geo, lat, lon) => [(lon - geo.lon0) * geo.k * geo.s, (geo.lat1 - lat) * geo.s];
const fbName = a => (LANG === 'ar' && a.ar) ? a.ar : a.n;
const fbShade = (f, token) => `color-mix(in srgb, var(${token || '--cedar'}) ${Math.round(8 + 84 * Math.max(0, Math.min(1, f)))}%, var(--paper))`;
/* fillFn(area) -> {fill, title, on} or null; opts: level 'adm1'|'adm2', labels, extra (SVG string drawn on top), cls, aria */
function fbMap(geo, o) {
  const lvl = o.level || 'adm2', list = geo[lvl];
  const paths = list.map(a => { const r = o.fill(a) || {}; return `<path d="${a.d}" class="fb-a${r.on ? ' on' : ''}" data-p="${esc(a.p)}" style="fill:${r.fill || 'var(--stone)'}"${o.click ? ' tabindex="0" role="button"' : ''} aria-label="${esc(fbName(a) + (r.title ? ': ' + r.title : ''))}"><title>${esc(fbName(a) + (r.title ? ': ' + r.title : ''))}</title></path>`; }).join('');
  const out = geo.adm1.map(a => `<path d="${a.d}" class="fb-gov"/>`).join('');
  const lab = o.labels ? list.map(a => `<text class="fb-lb" x="${a.l[0]}" y="${a.l[1]}" text-anchor="middle">${esc(fbName(a))}</text>`).join('') : '';
  return `<svg class="fb-map ${o.cls || ''}" viewBox="${o.view ? o.view.join(' ') : `0 0 ${geo.w} ${geo.h}`}" role="${o.click ? 'group' : 'img'}" aria-label="${esc(o.aria || '')}"><g>${paths}</g><g>${lvl === 'adm2' ? out : ''}</g>${lab}${o.extra || ''}</svg>`;
}
function fbMapClicks(el, fn) {
  el.querySelectorAll('.fb-a[data-p]').forEach(p => {
    p.addEventListener('click', () => fn(p.dataset.p));
    p.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(p.dataset.p); } });
  });
}
const fbLegend = (lo, hi, fmtFn, token) => `<div class="fb-leg" aria-hidden="true"><span class="mono">${esc(fmtFn(lo))}</span><i style="background:linear-gradient(90deg,${fbShade(0, token)},${fbShade(1, token)})"></i><span class="mono">${esc(fmtFn(hi))}</span></div>`;
/* ---------- table: cols [{h: header, k: row index or fn, fmt, cls}], rows [[...]] ---------- */
function fbTable(cols, rows, o = {}) {
  const head = cols.map((c, i) => `<th scope="col"${c.cls ? ` class="${c.cls}"` : ''}>${esc(c.h)}</th>`).join('');
  const cell = (c, i, r) => {
    const v = typeof c.k === 'function' ? c.k(r) : r[c.k == null ? i : c.k], tag = i === 0 && !o.noRowHead ? 'th' : 'td';
    return '<' + tag + (tag === 'th' ? ' scope="row"' : '') + ' class="' + (c.cls || '') + '">' + (c.html ? v : esc(c.fmt ? c.fmt(v) : (v == null ? '' : v))) + '</' + tag + '>';
  };
  const body = rows.map(r => '<tr' + (r._cls ? ' class="' + r._cls + '"' : '') + (r._id ? ' data-id="' + esc(r._id) + '"' : '') + '>' + cols.map((c, i) => cell(c, i, r)).join('') + '</tr>').join('');
  return `<div class="fb-scroll"><table class="fb-tbl${o.cls ? ' ' + o.cls : ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
/* chips that switch a section: items [{id, label}] */
function fbNav(el, items, cur, onPick, label) {
  el.innerHTML = items.map(i => `<button type="button" class="chip bc" data-id="${esc(i.id)}" aria-pressed="${i.id === cur}">${esc(i.label)}</button>`).join('');
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', label || t('Sections'));
  el.onclick = ev => { const b = ev.target.closest('[data-id]'); if (!b) return; el.querySelectorAll('[data-id]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); onPick(b.dataset.id); };
}
/* a searchable list of every series with span, unit, licence, sparkline and CSV link */
function fbBrowse(el, series, o = {}) {
  const per = o.per || 30;
  let q = '', shown = per, topic = '';
  const row = s => {
    const p = fbPts(s), a = p.length ? s.points[0][0] : '', b = p.length ? s.points[s.points.length - 1][0] : '';
    return `<li class="fb-br"><div class="fb-br-t"><b>${th(s.label)}</b>${s.proxy ? ` <span class="chip sm-c fb-tag">${esc(t('proxy, not official'))}</span>` : ''}${s.derived ? ` <span class="chip sm-c fb-tag">${esc(t('derived'))}</span>` : ''}${s.confidence === 'low' || s.unit_confidence ? ` <span class="chip sm-c fb-tag">${esc(t('weak unit or source'))}</span>` : ''}</div>
      <div class="fb-br-m mono dim">${esc(s.unit ? t(s.unit) : '')} · ${esc(b !== a ? t('{a} to {b}', { a: serLab(a), b: serLab(b) }) : serLab(a))} · ${nf(s.points.length)} ${esc(t('points'))}</div>
      <div class="fb-br-s">${hubSpark(p.length > 80 ? p.filter((_, i) => i % Math.ceil(p.length / 80) === 0) : p, s.label)}</div>
      <div class="fb-br-l note">${esc(t('Licence'))}: ${esc(s.license ? t(String(s.license)).slice(0, 70) : t(FB_UNSTATED))} · ${s.source_url && /^https?:/.test(s.source_url) ? `<a href="${esc(s.source_url)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(s.source_url))}</a>` : esc(t('source not linked'))}${s.csv ? ' · ' + fbCsvLinks([s]) : ''}</div></li>`;
  };
  const draw = () => {
    const words = nrm(q).split(/\s+/).filter(Boolean), list = series.filter(s => (!topic || (s.topic || '') === topic) && words.every(w => nrm(s.label + ' ' + (LANG === 'en' ? '' : t(s.label)) + ' ' + s.id + ' ' + (s.unit || '')).includes(w)));
    el.querySelector('[data-n]').textContent = t('{a} of {b} series', { a: nf(Math.min(shown, list.length)), b: nf(list.length) });
    el.querySelector('ul').innerHTML = list.slice(0, shown).map(row).join('') || `<li class="hub-empty">${esc(t('No series match.'))}</li>`;
    el.querySelector('[data-more]').hidden = list.length <= shown;
  };
  el.innerHTML = `<div class="d-filters"><label class="vh" for="${el.id}-q">${esc(t('Search series'))}</label><input id="${el.id}-q" type="search" autocomplete="off" placeholder="${esc(t('Search series'))}"><span class="mono dim" data-n></span></div><ul class="fb-brl"></ul><button type="button" class="chip" data-more hidden>${esc(t('Show more'))}</button>`;
  el.querySelector('input').addEventListener('input', ev => { q = ev.target.value; shown = per; draw(); });
  el.querySelector('[data-more]').addEventListener('click', () => { shown += per; draw(); });
  draw();
}
const fbSection = (id, title, lead) => `<section class="fb-sec" id="${id}" aria-labelledby="${id}-h"><h3 class="d-h" id="${id}-h">${esc(title)}</h3>${lead ? `<p class="note fb-lead">${esc(lead)}</p>` : ''}<div class="fb-grid" data-in></div></section>`;
const fbOn = (root, id) => root.querySelector('#' + id + ' [data-in]');
/* last point of a series at or before a date (decimal year); null if older than maxAge years */
function fbAt(s, x, maxAge) {
  const p = fbPts(s);
  let lo = 0, hi = p.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (p[m][0] <= x + 1e-9) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 || (maxAge != null && x - p[r][0] > maxAge) ? null : p[r][1];
}
/* search: accent-insensitive, Arabic letter variants folded, and a vowel-free "skeleton" so Bint Jbeil finds Bent Jbeil and Khiam finds El Khiam */
/* Place display names: research/hub/villages/display-names.json keyed by gazetteer name -> {en, ar, fr}. dnName gives the common name in the page language (the gazetteer spelling when the place is not listed),
   dnTerms every spelling of it, so a search still finds "Sour", "Tyre", "Tyr" and "صور". */
const DN = ((D.tabs || {}).places || {}).dn || {};
const dnName = (name, ar) => { const e = DN[name]; return e ? (e[LANG] || e.en || name) : (LANG === 'ar' && ar) ? ar : name; };
const dnAr = (name, ar) => (DN[name] || {}).ar || ar || '';
const dnTerms = name => { const e = DN[name]; return e ? ' ' + e.en + ' ' + e.ar + ' ' + e.fr : ''; };
const fbNrm = s => nrm(s).replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[-_'’‘`.,()]/g, ' ').replace(/\s+/g, ' ').trim();
const fbSk = s => fbNrm(s).replace(/\b(el|al|ed|ech|es|ez|er|et|en|ain)\b/g, m => m === 'ain' ? 'ain' : '').replace(/[aeiouyw]/g, '').replace(/(.)\1+/g, '$1').replace(/\s+/g, '');
/* a step series (a rate that holds until the next decision) as a staircase: each value is repeated up to the day before the next change, then to endIso */
function fbStep(s, endIso) {
  const p = s.points, out = [];
  p.forEach((q, i) => {
    out.push(q);
    const nx = i + 1 < p.length ? fbIso(fbT(p[i + 1][0]) - 0.003) : endIso;
    if (nx && fbT(nx) > fbT(q[0])) out.push([nx, q[1]]);
  });
  return Object.assign({}, s, { points: out, _p: null });
}
const fbStats = items => `<dl class="fb-stats">${items.map(i => `<div class="fb-stat"><dt>${esc(i.k)}</dt><dd>${esc(i.v)}</dd>${i.n ? `<span class="note">${esc(i.n)}</span>` : ''}</div>`).join('')}</dl>`;
const fbLast = s => s && s.points.length ? s.points[s.points.length - 1] : null;
const fbIndex = lists => { const m = {}; lists.forEach(l => (l.series || l).forEach(s => { m[s.id] = s; })); return m; };
const fbLongDate = iso => !iso ? '' : iso.length >= 10 ? fmtDate(iso) : iso.length >= 7 ? monShort(+iso.slice(5, 7) - 1) + ' ' + fy(+iso.slice(0, 4)) : fy(+iso.slice(0, 4));
/* an axis label that would run off the chart edge is anchored to that edge instead */
function fbFixTicks(el) {
  const svg = el.querySelector('svg.hc-svg');
  if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return;
  const W = svg.viewBox.baseVal.width;
  svg.querySelectorAll('text.ax[text-anchor="middle"]').forEach(tx => {
    let b; try { b = tx.getBBox(); } catch (e) { return; }
    if (b.x + b.width > W) { tx.setAttribute('text-anchor', 'end'); tx.setAttribute('x', W - 2); } else if (b.x < 0) { tx.setAttribute('text-anchor', 'start'); tx.setAttribute('x', 2); }
  });
}
/* hubLoadInto that ignores a result whose container has been replaced meanwhile (a second render, a language change) */
function fbLoad(el, paths, build, opts) {
  return hubLoadInto(el, paths, (...r) => { if (!el.isConnected) return; return build(...r); }, opts);
}
const FB_DIST_SRC = { source_url: 'https://data.humdata.org/dataset/lebanon-population-estimates-and-displacement-figures', license: 'CC BY', csv: 'csv/districts.csv', short: 'districts' };
