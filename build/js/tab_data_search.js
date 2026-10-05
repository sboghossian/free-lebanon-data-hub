/* ------------------------------------------------------------ Data tab search: one box across datasets, series, files, laws, places, companies,
   aid organisations and timeline event titles. The index is prebuilt (data/search/<kind>.json, rows [id, en, ar, date, meta, key], key = normalised
   Arabic and French names and other spellings); series come from data/series/index.json and files from data/manifest.json. Nothing loads until the box is used.
   dxNorm() is the same as dx_norm() in emit_data.py: no accents or Arabic vowel marks, one alef, ya for alef maqsura, ha for ta marbuta, Western digits. */
const DXS = { q: '', idx: null, lim: {}, tm: null };
const DXS_KINDS = [['series', N('Series')], ['files', N('Files to download')], ['catalogue', N('Datasets in the catalogue')], ['places', N('Places')], ['laws', N('Laws')],
  ['events', N('Timeline events')], ['orgs', N('Companies and aid organisations')]];
const DXS_AR = { 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه' };
function dxNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱىة]/g, c => DXS_AR[c]).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function dxSearchInit() {
  const el = $('#dxSearch'); if (!el) return;
  el.innerHTML = `<div class="dx-sbox"><label class="dx-sl" for="dxQ">${esc(t('Search all the data'))}</label><input id="dxQ" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Search: bread, Baalbek, 81/2018, UNHCR, Anghami'))}">
    <p class="note dx-sh">${esc(t('Series, files, the catalogue, places (English, Arabic or French names), laws, timeline events, companies and aid organisations.'))}</p></div><p class="note" id="dxSN" aria-live="polite"></p><div id="dxRes"></div>`;
  const q = $('#dxQ');
  q.value = DXS.q;
  q.addEventListener('input', ev => { clearTimeout(DXS.tm); DXS.tm = setTimeout(() => dxSearchSet(ev.target.value, true), 180); });
  $('#dxRes').addEventListener('click', dxResClick);
  if (DXS.q) dxSearchSet(DXS.q);
}
function dxSearchSet(q, typed) {
  DXS.q = q || ''; DXS.lim = {};
  const box = $('#dxQ'); if (box && box.value !== DXS.q) box.value = DXS.q;
  if (typed) HUB.setHash('data', ...(DXS.q.trim() ? ['search', DXS.q.trim()] : DX.topic ? [DX.topic] : []));
  if (dxNorm(DXS.q).length < 2) { $('#dxRes').innerHTML = ''; $('#dxRes').dataset.q = DXS.q; $('#dxSN').textContent = ''; return; }
  if (DXS.idx) { dxSearchDraw(); return; }
  const shards = Object.keys((D.tabs.data || {}).search || {});
  hubLoadInto($('#dxRes'), shards.map(k => `data/search/${k}.json`).concat(['data/series/index.json', 'data/manifest.json']), (...r) => {
    const man = r.pop(), si = r.pop(), idx = {};
    r.forEach((o, i) => { idx[shards[i]] = (o.rows || []).map(x => ({ id: x[0], en: x[1] || '', ar: x[2] || '', d: x[3] || '', m: x[4] || '', h: dxNorm([x[1], x[2], x[4]].join(' ')) + ' ' + (x[5] || '') })); });
    const C = Object.fromEntries((si.cols || []).map((c, i) => [c, i]));
    idx.series = (si.rows || []).map(x => ({ id: x[C.key], en: x[C.label], ar: x[C.label_ar] || '', fr: x[C.label_fr] || '', d: '', m: x[C.topic], u: x[C.unit],
      h: dxNorm([x[C.label], x[C.label_ar], x[C.label_fr], x[C.id], x[C.unit]].join(' ')) }));
    idx.files = (man.files || []).map(f => ({ id: f.path, en: f.title, f, d: '', m: dxTopicOf(f.path), h: dxNorm(f.title + ' ' + f.path.split('/').pop()) }));
    DXS.idx = idx;
    dxSearchDraw();
  });
}
function dxScore(r, words, whole) {
  let s = 0;
  for (const w of words) {
    if (r.h.startsWith(w)) s += 3; else if (r.h.includes(' ' + w)) s += 2; else if (r.h.includes(w)) s += 1; else return 0;
  }
  return s + (dxNorm(r.en) === whole || dxNorm(r.ar) === whole ? 5 : 0);
}
function dxSearchDraw() {
  const res = $('#dxRes'); if (!res || !DXS.idx) return;
  const whole = dxNorm(DXS.q), words = whole.split(' ').filter(Boolean);
  if (LANG !== 'en' && !DXS.idx._tr) {   // series and event titles are also matched in the page language (the translation table is loaded)
    DXS.idx._tr = LANG;
    ['series', 'events', 'files'].forEach(k => (DXS.idx[k] || []).forEach(r => { r.h += ' ' + dxNorm(k === 'files' ? dlTitle(r.f).text : t(r.en)); }));
  }
  let total = 0;
  const html = DXS_KINDS.filter(([k]) => DXS.idx[k]).map(([k, label]) => {
    const hits = [];
    DXS.idx[k].forEach(r => { const s = dxScore(r, words, whole); if (s) hits.push([s, r]); });
    if (!hits.length) return '';
    total += hits.length;
    hits.sort((a, b) => b[0] - a[0] || a[1].en.length - b[1].en.length);
    const lim = DXS.lim[k] || 5;
    return `<section class="dx-g" data-kind="${k}"><h4 class="sp-topic">${esc(t(label))} <span class="mono dim">${nf(hits.length)}</span></h4><ul class="dx-rl">${hits.slice(0, lim).map(h => dxHit(k, h[1])).join('')}</ul>${hits.length > lim ? `<button type="button" class="chip" data-more="${k}">${esc(t('Show more ({n} left)', { n: nf(hits.length - lim) }))}</button>` : ''}</section>`;
  }).join('');
  $('#dxSN').textContent = total ? tp('{n} result', '{n} results', total) : '';
  res.innerHTML = html || `<p class="hub-empty" id="dxNone">${esc(t('Nothing matches. Try another spelling, or fewer words.'))}</p>`;
  res.dataset.q = DXS.q;    // what the results are for (the box is debounced)
}
const dxYears = s => String(s || '').replace(/^(\d{4})-\1$/, '$1').replace(/\d{4}/g, fy);
function dxHit(k, r) {
  const meta = [], hub = (tab, hash) => `href="${esc('#' + hash)}" data-hub="${tab}" data-hash="${esc(hash)}"`;
  let a;
  if (k === 'series') {
    a = `<a ${hub('data', 'data/series/' + r.id)}>${dxLabelH({ label: r.en, label_ar: r.ar, label_fr: r.fr })}</a>`;
    meta.push(esc(dxTName(r.m)), r.u ? esc(t(r.u)) : '');
  } else if (k === 'files') {
    const ti = dlTitle(r.f);
    a = `<a href="${esc(HUB_BASE + r.f.path)}" download${ti.tr ? '' : ' lang="en" dir="ltr"'}>${esc(ti.text)}</a>`;
    meta.push(esc(r.m ? dxTName(r.m) : t('The Hub as a whole')), esc(r.f.path.split('.').pop().toUpperCase()), esc(fmtBytes(r.f.size)));
  } else if (k === 'catalogue') {
    a = `<a href="${esc(r.id)}" target="_blank" rel="noopener noreferrer">${LANG === 'ar' && r.ar ? esc(r.ar) : th(r.en)}</a>`;
    meta.push(r.m ? th(r.m) : '', esc(dxYears(r.d)));
  } else if (k === 'places') {
    a = `<a ${hub('places', 'place/' + r.id)}>${esc(LANG === 'ar' && r.ar ? r.ar : r.en)}</a>${LANG !== 'ar' && r.ar ? ` <span class="d-ar" lang="ar" dir="rtl">${esc(r.ar)}</span>` : ''}`;
    meta.push(r.m ? esc(t(r.m)) : '');
  } else if (k === 'laws') {
    const q = r.id || r.en || r.ar;
    a = `<a ${hub('data', 'data/laws/' + encodeURIComponent(q))}${LANG === 'ar' && r.ar ? ' lang="ar"' : ''}>${esc(LANG === 'ar' ? (r.ar || r.en) : (r.en || r.ar))}</a>`;
    meta.push(r.id ? esc(t('Law no. {n}', { n: r.id })) : '', r.d ? esc(fmtDate(r.d)) : '', r.m ? esc(t(r.m)) : '');
  } else if (k === 'events') {
    a = `<a href="#timeline" data-ev="${esc(r.id)}">${th(r.en)}</a>`;
    meta.push(esc(dxT(r.d)));
  } else {
    const [tab, view] = r.id.split('/');
    a = `<a ${hub(tab, r.id)}${tab === 'companies' ? ` data-cq="${esc(r.en)}"` : ''} data-notr>${esc(r.en)}</a>`;
    meta.push(esc(t(DX_TNAME[tab] || tab)), r.m ? th(r.m) : '', r.d ? esc(t('founded {y}', { y: fy(r.d) })) : '');
  }
  return `<li class="dx-r">${a}<span class="d-meta">${meta.filter(Boolean).map(x => `<span>${x}</span>`).join('')}</span></li>`;
}
function dxResClick(ev) {
  const more = ev.target.closest('[data-more]');
  if (more) { DXS.lim[more.dataset.more] = (DXS.lim[more.dataset.more] || 5) + 50; dxSearchDraw(); return; }
  const a = ev.target.closest('a'); if (!a) return;
  if (a.dataset.ev) {     // a timeline event: open the Timeline and its event card (the same way the Strike map does)
    ev.preventDefault();
    const id = a.dataset.ev;
    hubShow('timeline', { push: true }); window.scrollTo(0, 0);
    requestAnimationFrame(() => { try { openEventCard(id); } catch (e) { /* the card stays closed; the Timeline is open */ } });
  } else if (a.dataset.cq) {   // a company: the Companies tab opens on its view with the name in its own search box
    try { if (typeof CMP === 'object' && CMP) CMP.q = a.dataset.cq; } catch (e) { /* the tab opens unfiltered */ }
  }
}
