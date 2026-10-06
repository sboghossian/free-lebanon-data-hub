/* ------------------------------------------------------------ Companies tab (v10, LEG B; v11). Data: data/companies/{listed,abroad,startups,family,banks}.json (emit_companies.py).
   Views: Listed in Beirut (Beirut Stock Exchange), Lebanese abroad (world map and table of Lebanese-led companies headquartered abroad, then listed-abroad revenue by year), Startups and exits, Family businesses, Banks (sector totals over time and per bank).
   Every list states its ONE ranking metric at the top (it follows the sort chosen); there is no blended score. Every row links its source. One search box covers the open view and says where else it matches.
   Hash: #companies, #companies/<view>. All names start with cmp (the scripts share one scope). Charts reuse fbCard / hubBars; tables reuse fbTable. No downloads here: one link to the Data tab. */
const CMP_VIEWS = [{ id: 'listed', label: N('Listed in Beirut') }, { id: 'abroad', label: N('Lebanese abroad') }, { id: 'startups', label: N('Startups and exits') }, { id: 'family', label: N('Family businesses') }, { id: 'banks', label: N('Banks') }];
const CMP = { view: 'listed', q: '', sort: {}, pref: false, year: 'all', D: null, hay: {} };
const CMP_FILES = ['listed', 'abroad', 'startups', 'family', 'banks', 'diaspora'];
const cmpUsd = v => v == null ? '' : '$' + nfCompact(v);
const cmpN = (v, d) => v == null ? '' : nf(v, d == null ? 0 : d);
const cmpNone = () => t('not given');
const cmpSrc = (u, label) => u && /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || fbHost(u))}</a>` : '';
const cmpSrcs = urls => [...new Set((urls || []).filter(Boolean))].map(u => cmpSrc(u)).join(', ');
const cmpConf = c => c ? `<span class="cf cf-${c === 'estimate' ? 'inference' : esc(c)}">${esc(t(c))}</span>` : '';
const cmpDate = s => s ? fbLongDate(String(s).slice(0, 10)) : '';
const cmpWords = () => fbNrm(CMP.q).split(' ').filter(Boolean);
const cmpHit = h => { const w = cmpWords(); return !w.length || w.every(x => h.includes(x)); };
const cmpTbl = (cols, rows) => rows.length ? fbTable(cols, rows, { noRowHead: true, cls: 'cmp-tbl' }) : `<p class="hub-empty">${esc(t('Nothing in this view matches the search.'))}</p>`;
const cmpMetric = txt => `<p class="fb-note-band cmp-metric"><b>${esc(t('Ranked by'))}:</b> ${esc(txt)}</p>`;
const cmpSel = (id, label, opts, cur) => `<label class="sel" for="${id}">${esc(label)} <select id="${id}">${opts.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(cur) ? ' selected' : ''}>${esc(t(o[1]))}</option>`).join('')}</select></label>`;
const cmpFoot = () => `<p class="note cmp-foot">${esc(t('The sources state no licence, so only facts (numbers, names and dates) are published, with attribution.'))} <a href="#data/companies" data-hub="data" data-hash="data/companies">${esc(t('Data behind this tab'))}</a></p>`;
const cmpSrcLine = urls => `<p class="fb-src note">${esc(t('Source'))}: ${cmpSrcs(urls)}. ${esc(t('Licence'))}: ${esc(t(FB_UNSTATED))}.</p>`;
const cmpCard = (title, unit, inner, urls) => `<figure class="fb-card cmp-card"><figcaption><h4 class="fb-t">${esc(title)}</h4>${unit ? `<p class="fb-u mono dim">${esc(unit)}</p>` : ''}</figcaption>${inner}${urls ? cmpSrcLine(urls) : ''}</figure>`;
const cmpNum = (a, b, desc) => (a == null ? 1 : 0) - (b == null ? 1 : 0) || (a == null ? 0 : desc ? b - a : a - b);   // numbers first, empty last
const cmpName = (a, b) => String(a).localeCompare(String(b), LANG === 'ar' ? 'ar' : LANG === 'fr' ? 'fr' : 'en');
const cmpNote = txt => `<p class="note">${esc(txt)}</p>`;
const cmpYear = d => d ? fy(String(d).slice(0, 4)) : '';
const cmpTypes = { common: N('Common share'), preferred: N('Preferred share'), GDR: N('Global depositary receipt') };

/* ---------- Listed in Beirut ---------- */
function cmpListed(el) {
  const L = CMP.D.listed, all = L.securities, hasChg = all.some(r => Number.isFinite(r.price_change_pct));
  const SORTS = [['cap', N('Market capitalisation')]].concat(hasChg ? [['chg', N('Price change')]] : [], [['name', N('Name')]]);
  const sk = SORTS.some(s => s[0] === CMP.sort.listed) ? CMP.sort.listed : 'cap';
  const common = all.filter(r => r.type === 'common'), capOf = r => r.market_cap_usd;
  const rows = all.filter(r => (r.type === 'common' || CMP.pref) && cmpHit(CMP.hay.listed.get(r.ticker)));
  rows.sort((a, b) => sk === 'name' ? cmpName(a.name, b.name) : sk === 'chg' ? cmpNum(a.price_change_pct, b.price_change_pct, true) || cmpName(a.name, b.name) : cmpNum(capOf(a), capOf(b), true) || cmpName(a.issuer, b.issuer) || cmpName(a.name, b.name));
  const metric = sk === 'cap' ? t('market capitalisation in US dollars, the last price times the shares outstanding, common shares only. Beirut Stock Exchange, session of {d}.', { d: fmtDate(L.as_of) })
    : sk === 'chg' ? t('price change in percent, as published by the exchange.') : t('no ranking: the securities are sorted by name.');
  const sum = common.reduce((s, r) => s + (r.market_cap_usd || 0), 0), issuers = new Set(all.map(r => r.issuer)).size;
  const hist = all.filter(r => Array.isArray(r.price_history) && r.price_history.length > 1);
  const ranked = sk !== 'name';
  let n = 0;
  const cols = [].concat(ranked ? [{ h: t('Rank'), k: r => r._rank || '', cls: 'num' }] : [], [
    { h: t('Security'), html: true, k: r => `<b>${esc(r.name)}</b> <span class="mono dim" data-notr>${esc(r.ticker)}</span>${r.type === 'common' ? '' : ` <span class="chip sm-c fb-tag">${esc(t(cmpTypes[r.type] || r.type))}</span>`}` },
    { h: t('Sector'), k: r => t(r.sector || '') },
    { h: t('Price (US dollars)'), cls: 'num', k: r => cmpN(r.price, r.price < 10 ? 2 : 1) },
    { h: t('Price basis'), k: r => `${r.price_basis === 'traded' ? t('Traded in the session') : t('Previous close, no trade that day')}, ${fbLongDate(r.price_date)}` },
    { h: t('Market cap (US dollars)'), cls: 'num', k: r => r.market_cap_usd == null ? '' : cmpUsd(r.market_cap_usd) },
    { h: t('Source'), html: true, k: r => cmpSrcs([r.source, r.shares_source]) + ' ' + cmpConf(r.shares_confidence || r.confidence) }]);
  if (ranked) rows.forEach(r => { r._rank = (sk === 'chg' ? Number.isFinite(r.price_change_pct) : r.market_cap_usd != null) ? ++n : ''; });
  const bars = common.filter(r => r.market_cap_usd).sort((a, b) => b.market_cap_usd - a.market_cap_usd).map(r => ({ id: r.ticker, label: r.name, value: r.market_cap_usd }));
  el.innerHTML = cmpMetric(metric) + fbStats([
    { k: t('Securities listed'), v: nf(all.length), n: t('{n} issuers', { n: nf(issuers) }) },
    { k: t('Common shares, market cap added up'), v: cmpUsd(sum), n: t('last prices times shares outstanding') },
    { k: t('Latest session'), v: fbLongDate(L.as_of), n: t('Beirut Stock Exchange') }]) +
    `<div class="d-filters">${cmpSel('cmpSort', t('Sort by'), SORTS, sk)}<label class="mp-chk"><input type="checkbox" id="cmpPref"${CMP.pref ? ' checked' : ''}> ${esc(t('Include preferred shares and receipts (no market cap)'))}</label></div>` +
    cmpCard(t('Market capitalisation by security'), t('US dollars, common shares only, last price times shares outstanding'), '<div id="cmpBars"></div>', [common[0] && common[0].source, common[0] && common[0].shares_source]) +
    cmpTbl(cols, rows) +
    `<p class="note">${esc(t('Many prices are the previous close: only some securities traded in the latest session, and the exchange does not give the date of the last trade. Shares outstanding come from each bank\'s own 2025 statements where it published them, and from the exchange listing otherwise.'))}</p>` +
    (hist.length ? '<div id="cmpHist"></div>' : cmpNote(t('Price history is not shown: the exchange history page returned an error when the research was done, and its charts are images.'))) + cmpFoot();
  hubBars($('#cmpBars'), { items: bars, fmt: cmpUsd });
  $('#cmpSort').addEventListener('change', ev => { CMP.sort.listed = ev.target.value; cmpDraw(); });
  $('#cmpPref').addEventListener('change', ev => { CMP.pref = ev.target.checked; cmpDraw(); });
  if (hist.length) {
    const h = $('#cmpHist'), pick = hist[0].ticker;
    h.innerHTML = `<div class="d-filters">${cmpSel('cmpHsel', t('Price history of'), hist.map(r => [r.ticker, r.name]), pick)}</div><div id="cmpHch"></div>`;
    const draw = tk => { const r = hist.find(x => x.ticker === tk); hubLine($('#cmpHch'), { series: [{ id: tk, label: r.name, pts: r.price_history.map(p => [fbT(p[0]), p[1]]) }], height: 240, xFmt: fbXF('d'), valFmt: v => nf(v, 2), title: r.name }); };
    $('#cmpHsel').addEventListener('change', ev => draw(ev.target.value)); draw(pick);
  }
}

/* ---------- Lebanese abroad (v11): world map by headquarters country, filters, sortable table; the listed-abroad revenue stays below ---------- */
const CMP_ROLES = [['all', N('All roles')], ['founder', N('Founders and co-founders')], ['ceo', N('CEOs')], ['exec', N('Chairs and other executives')]];
const CMP_ORIGINS = [['all', N('All origins')], ['born_in_lebanon', N('Born in Lebanon')], ['lebanese_citizen', N('Lebanese citizen')], ['lebanese_descent', N('Of Lebanese descent')], ['described_lebanese', N('Described as Lebanese')]];
const CMP_KINDS = [['all', N('All kinds')], ['startup', N('Startups')], ['established', N('Established')], ['listed', N('Listed')]];
const CMP_ROLE_L = { founder: N('Founder'), 'co-founder': N('Co-founder'), ceo: N('CEO'), chair: N('Chair'), executive: N('Executive') };
const CMP_ORIG_L = { born_in_lebanon: N('Born in Lebanon'), lebanese_citizen: N('Lebanese citizen'), lebanese_descent: N('Of Lebanese descent'), described_lebanese: N('Described as Lebanese') };
const CMP_DIA = { role: 'all', origin: 'all', kind: 'all', iso: null, sk: 'company', dir: 1, paths: null, rows: [], by: new Map() };
const CMP_DCOLS = [['company', N('Company')], ['country', N('Country')], ['city', N('City')], ['founded', N('Founded')], ['sector', N('Sector')], ['person', N('Person')], ['role', N('Role')], ['origin', N('Origin')], [null, N('Sources')]];
const cmpCtry = iso => { const n = (CMP.D.diaspora.names || {})[iso]; return n ? ((LANG === 'ar' && n[1]) || (LANG === 'fr' && n[2]) || n[0]) : iso; };
const cmpCoName = r => (LANG === 'ar' && r.ca) || (LANG === 'fr' && r.cf) || r.c;
const cmpRoleOf = r => CMP_ROLE_L[String(r.rl).toLowerCase()] ? t(CMP_ROLE_L[String(r.rl).toLowerCase()]) : String(r.rl || '');
const cmpBin = n => n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
const cmpLine = r => t('{c}, {p}, {r}, {o}', { c: cmpCoName(r), p: r.p, r: cmpRoleOf(r), o: t(CMP_ORIG_L[r.o]) });
const cmpDKey = {
  company: r => cmpCoName(r), country: r => cmpCtry(r.i), city: r => r.h, founded: r => r.f, sector: r => r.s, person: r => r.p, role: r => cmpRoleOf(r), origin: r => t(CMP_ORIG_L[r.o]) };
function cmpDiaFiltered() {
  const x = CMP_DIA, H = CMP.hay.abroad;
  return CMP.D.diaspora.rows.filter(r => (x.role === 'all' || r.r === x.role) && (x.origin === 'all' || r.o === x.origin) && (x.kind === 'all' || r.k === x.kind) && cmpHit(H.get('d' + r._i)));
}
function cmpDiaPaths(cb) {
  if (CMP_DIA.paths) return cb(CMP_DIA.paths);
  const X = lon => (lon + 180).toFixed(1), Y = lat => (85 - lat).toFixed(1);
  hubLoad('data/trade/world-geo.json').then(g => {
    CMP_DIA.paths = g.countries.map(c => ({ iso: c.iso3, d: c.g.map(poly => poly.map(r => 'M' + r.map(p => X(p[0]) + ' ' + Y(p[1])).join('L') + 'Z').join('')).join('') }));
    cb(CMP_DIA.paths);
  }, () => cb(null));
}
function cmpTip(iso, tip, box, at) {
  const L = CMP_DIA.by.get(iso) || [], name = cmpCtry(iso);
  tip.innerHTML = iso === 'LBN' ? `<b>${esc(name)}</b><br><span class="dim">${esc(t('Lebanon is outlined and not counted.'))}</span>`
    : `<b>${esc(name)}</b> <span class="mono dim">${esc(nf(L.length))}</span>` + (L.length ? '<ul>' + L.slice(0, 8).map(r => `<li>${esc(cmpLine(r))}</li>`).join('') + '</ul>' + (L.length > 8 ? `<p class="dim">${esc(t('and {n} more', { n: nf(L.length - 8) }))}</p>` : '') : `<br><span class="dim">${esc(t('No companies listed.'))}</span>`);
  tip.hidden = false;
  const b = box.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = at.x - b.left + 14, y = at.y - b.top + 14;
  if (x + w > b.width - 4) x = Math.max(4, at.x - b.left - w - 14);
  if (y + h > b.height - 4) y = Math.max(4, b.height - h - 4);
  tip.style.insetInlineStart = '0'; tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function cmpPinDraw() {
  const el = $('#cmpPin'), iso = CMP_DIA.iso;
  $$('#cmpMap path.sel').forEach(p => p.classList.remove('sel'));
  if (!el) return;
  if (!iso) { el.innerHTML = ''; return; }
  const p = $('#cmpMap path[data-iso="' + iso + '"]'); if (p) p.classList.add('sel');
  const L = CMP_DIA.by.get(iso) || [];
  el.innerHTML = `<div class="cmp-pinh"><h4 class="fb-t">${esc(t('Companies headquartered in {c}', { c: cmpCtry(iso) }))} <span class="mono dim">${esc(nf(L.length))}</span></h4><button type="button" class="chip sm-c" id="cmpPinX">${esc(t('Clear'))}</button></div>` +
    (L.length ? '<ul class="cmp-pinl">' + L.map(r => `<li>${esc(cmpLine(r))}${r.h ? ' <span class="dim">' + esc(r.h) + '</span>' : ''}</li>`).join('') + '</ul>' : cmpNote(t('No company matches the filters in this country.')));
  $('#cmpPinX').onclick = () => { CMP_DIA.iso = null; cmpPinDraw(); };
}
function cmpDiaTable() {
  const el = $('#cmpDTbl'), x = CMP_DIA;
  if (!el) return;
  const get = cmpDKey[x.sk] || cmpDKey.company, rows = CMP_DIA.rows.slice().sort((a, b) => {
    const u = get(a), v = get(b), n = x.sk === 'founded' ? cmpNum(u, v, x.dir < 0) : x.dir * cmpName(u == null ? '' : u, v == null ? '' : v);
    return n || cmpName(cmpCoName(a), cmpCoName(b)) || cmpName(a.p, b.p);
  });
  const head = CMP_DCOLS.map(c => c[0] ? `<th scope="col" aria-sort="${x.sk === c[0] ? (x.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="cmp-sort" data-k="${c[0]}">${esc(t(c[1]))}<span aria-hidden="true">${x.sk === c[0] ? (x.dir > 0 ? ' ▲' : ' ▼') : ''}</span></button></th>` : `<th scope="col">${esc(t(c[1]))}</th>`).join('');
  const body = rows.map(r => `<tr><td><b>${esc(cmpCoName(r))}</b></td><td>${esc(cmpCtry(r.i))}</td><td>${esc(r.h)}</td><td class="num">${r.f ? esc(fy(r.f)) : esc(cmpNone())}</td><td>${esc(r.s)}</td><td>${esc(r.p)}${r.y ? ` <span class="dim mono">${esc(r.y)}</span>` : ''}</td><td>${esc(cmpRoleOf(r))}</td>` +
    `<td><span class="chip sm-c fb-tag cmp-or" title="${esc(r.q)}">${esc(t(CMP_ORIG_L[r.o]))}</span></td><td class="cmp-srcs">${cmpSrcs(r.u)}</td></tr>`).join('');
  el.innerHTML = rows.length ? `<div class="fb-scroll"><table class="fb-tbl cmp-tbl cmp-dtbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : `<p class="hub-empty">${esc(t('Nothing in this view matches the search.'))}</p>`;
  el.querySelectorAll('.cmp-sort').forEach(b => b.onclick = () => { const k = b.dataset.k; x.dir = x.sk === k ? -x.dir : 1; x.sk = k; cmpDiaTable(); const nb = $('#cmpDTbl .cmp-sort[data-k="' + k + '"]'); if (nb) nb.focus(); });
}
function cmpDiaUpdate() {
  const rows = cmpDiaFiltered(), by = new Map();
  rows.forEach(r => { if (!by.has(r.i)) by.set(r.i, []); by.get(r.i).push(r); });
  by.forEach(l => l.sort((a, b) => cmpName(cmpCoName(a), cmpCoName(b))));
  CMP_DIA.rows = rows; CMP_DIA.by = by;
  const cos = new Set(rows.map(r => r.c)).size, pe = new Set(rows.map(r => r.p)).size;
  $('#cmpDStats').innerHTML = fbStats([{ k: t('Companies'), v: nf(cos), n: '' }, { k: t('People'), v: nf(pe), n: '' }, { k: t('Countries'), v: nf(by.size), n: '' }]);
  $$('#cmpMap path[data-iso]').forEach(p => { const n = (by.get(p.dataset.iso) || []).length, c = p.dataset.iso === 'LBN' ? 0 : cmpBin(n); p.setAttribute('class', 'cmp-c b' + c + (p.dataset.iso === 'LBN' ? ' leb' : '') + (p.dataset.iso === CMP_DIA.iso ? ' sel' : ''));
    if (p.dataset.iso !== 'LBN') { if (n) { p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button'); p.setAttribute('aria-label', cmpCtry(p.dataset.iso) + ': ' + tp('{n} company', '{n} companies', n, { n: nf(n) })); } else { p.removeAttribute('tabindex'); p.removeAttribute('role'); p.removeAttribute('aria-label'); } } });
  const miss = $('#cmpMiss');
  if (miss && CMP_DIA.paths) { const have = new Set(CMP_DIA.paths.map(p => p.iso)), m = [...by.keys()].filter(i => !have.has(i)); miss.innerHTML = m.length ? esc(t('Too small to draw:')) + ' ' + m.map(i => `<button type="button" class="chip sm-c" data-iso="${i}">${esc(cmpCtry(i))} (${nf(by.get(i).length)})</button>`).join(' ') : ''; }
  cmpPinDraw(); cmpDiaTable();
}
function cmpDiaMap(box) {
  cmpDiaPaths(paths => {
    if (!$('#cmpMapBox')) return;
    if (!paths) { box.innerHTML = `<p class="hub-empty">${esc(t('The map could not be loaded. The table below has the same data.'))}</p>`; return; }
    box.innerHTML = `<svg id="cmpMap" class="cmp-map" viewBox="0 0 360 145" role="group" aria-label="${esc(t('World map: Lebanese-led companies by headquarters country'))}">${paths.map(c => `<path d="${c.d}" data-iso="${c.iso}" class="cmp-c b0" fill-rule="evenodd"></path>`).join('')}</svg><div class="cmp-tip" id="cmpTip" role="status" hidden></div>`;
    const svg = $('#cmpMap'), tip = $('#cmpTip'), isoOf = ev => { const p = ev.target.closest && ev.target.closest('path[data-iso]'); return p ? p.dataset.iso : null; };
    tip.dir = document.documentElement.dir || 'ltr';
    svg.addEventListener('pointerover', ev => { const i = isoOf(ev); if (i) cmpTip(i, tip, box, { x: ev.clientX, y: ev.clientY }); });
    svg.addEventListener('pointermove', ev => { const i = isoOf(ev); if (i && !tip.hidden) cmpTip(i, tip, box, { x: ev.clientX, y: ev.clientY }); });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.addEventListener('focusin', ev => { const i = isoOf(ev); if (i) { const r = ev.target.getBoundingClientRect(); cmpTip(i, tip, box, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); } });
    svg.addEventListener('focusout', () => { tip.hidden = true; });
    const pin = i => { if (i && i !== 'LBN' && (CMP_DIA.by.get(i) || []).length) { CMP_DIA.iso = CMP_DIA.iso === i ? null : i; cmpPinDraw(); const pn = $('#cmpPin'); if (CMP_DIA.iso && pn) pn.scrollIntoView({ block: 'nearest' }); } };
    svg.addEventListener('click', ev => pin(isoOf(ev)));
    svg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const i = isoOf(ev); if (i) { ev.preventDefault(); pin(i); } } else if (ev.key === 'Escape') { tip.hidden = true; } });
    cmpDiaUpdate();
  });
}
function cmpAbroad(el) {
  const Di = CMP.D.diaspora, sel = (id, lab, o, cur) => cmpSel(id, lab, o, cur);
  el.innerHTML = `<p class="lead cmp-lead">${esc(t('Companies around the world founded or led by Lebanese people, as public sources describe them.'))}</p>` +
    `<p class="note cmp-rule">${esc(t('Included: a founder, co-founder, CEO, chair, president or another top executive, whose origin a source states (born in Lebanon, Lebanese citizen, of Lebanese descent, or described as Lebanese), never guessed from a name.'))}</p>` +
    `<div class="d-filters cmp-dfil">${sel('cmpDRole', t('Role'), CMP_ROLES, CMP_DIA.role)}${sel('cmpDOrig', t('Origin'), CMP_ORIGINS, CMP_DIA.origin)}${sel('cmpDKind', t('Kind'), CMP_KINDS, CMP_DIA.kind)}</div>` +
    '<div id="cmpDStats"></div>' +
    `<div class="cmp-mapbox" id="cmpMapBox"><div id="cmpMapIn" class="cmp-mapin"><p class="hub-load" aria-busy="true">${esc(t('Loading the map'))}</p></div></div>` +
    `<div class="cmp-legend" aria-label="${esc(t('Companies headquartered in the country'))}"><span class="dim">${esc(t('Companies headquartered in the country'))}:</span> <span class="cmp-sw b0"></span>${esc(t('None'))} <span class="cmp-sw b1"></span>${esc(nf(1))} <span class="cmp-sw b2"></span>${esc(t('{a} to {b}', { a: nf(2), b: nf(3) }))} <span class="cmp-sw b3"></span>${esc(t('{a} to {b}', { a: nf(4), b: nf(7) }))} <span class="cmp-sw b4"></span>${esc(t('{a} or more', { a: nf(8) }))}</div>` +
    `<p class="note" id="cmpMiss"></p><p class="note">${esc(t('Hover, focus or tap a country to see its companies; click or press Enter to pin the full list below the map.'))}</p><div id="cmpPin"></div>` +
    `<div id="cmpDTbl"></div>` +
    `<p class="note cmp-del">${tH('Anyone listed can ask to be removed or corrected: open an issue at {a}.', { a: '<a href="https://github.com/sboghossian/free-lebanon-data-hub/issues" target="_blank" rel="noopener noreferrer">github.com/sboghossian/free-lebanon-data-hub/issues</a>' })}</p>` +
    `<p class="note">${esc(t('Sources and licences: Wikidata (CC0 1.0); English Wikipedia and press articles, facts only, each linked in the Sources column. Only the public business role is shown. Origin is the one the source states; hover the origin label for the sentence.'))}</p>` +
    `<h3 class="d-h cmp-revh">${esc(t('Listed abroad: revenue by year'))}</h3><div id="cmpRev"></div>`;
  [['cmpDRole', 'role'], ['cmpDOrig', 'origin'], ['cmpDKind', 'kind']].forEach(([id, k]) => $('#' + id).addEventListener('change', ev => { CMP_DIA[k] = ev.target.value; cmpDiaUpdate(); }));
  $('#cmpMiss').addEventListener('click', ev => { const b = ev.target.closest('[data-iso]'); if (b) { CMP_DIA.iso = b.dataset.iso; cmpPinDraw(); } });
  cmpDiaMap($('#cmpMapIn'));
  cmpDiaUpdate();
  cmpRevenue($('#cmpRev'));
}

/* ---------- Listed abroad: revenue by year (below the Lebanese abroad map) ---------- */
function cmpRevenue(el) {
  const Ab = CMP.D.abroad, cos = Ab.companies.filter(c => cmpHit(CMP.hay.abroad.get('r' + c.name))), withFy = cos.filter(c => c.fiscal_years.length), ctx = cos.filter(c => !c.fiscal_years.length);
  const blocks = withFy.map(c => {
    const fyRows = c.fiscal_years.slice().sort((a, b) => b.fiscal_year - a.fiscal_year), filed = r => (String(r.filed).match(/\d{4}-\d{2}-\d{2}/g) || []).pop();
    const cols = [{ h: t('Fiscal year'), k: r => fy(r.fiscal_year), cls: 'num' }, { h: t('Revenue (US dollars)'), cls: 'num', k: r => cmpN(r.revenue) }, { h: t('Net income (US dollars)'), cls: 'num', k: r => cmpN(r.net_income) },
      { h: t('Total assets'), cls: 'num', k: r => cmpN(r.total_assets) }, { h: t('Total equity'), cls: 'num', k: r => cmpN(r.total_equity) }, { h: t('Filing'), k: r => `${r.form}, ${cmpDate(filed(r))}` },
      { h: t('Source'), html: true, k: r => cmpSrc(r.source) + ' ' + cmpConf(r.confidence) }];
    return `<h4 class="fb-t cmp-co">${esc(c.name)} <span class="mono dim" data-notr>${esc(c.ticker || '')}</span></h4>` +
      cmpNote(t('{x} since {d}. Founded in {p}.', { x: c.exchange, d: cmpDate(c.listed_since), p: c.founded_in || '' })) +
      '<div class="cmp-chart" data-s="' + esc(c.name) + '"></div>' + cmpTbl(cols, fyRows) +
      cmpNote(t('Net income is the profit or loss for the year. Rows marked "reported" are read from the filing text, not from the SEC data feed (marked "verified"). A filing amended after the 20-F was not read.')) + cmpSrcLine([c.inclusion_source]);
  }).join('');
  const cx = ctx.map(c => ({ c })), cols2 = [{ h: t('Company'), html: true, k: r => `<b>${esc(r.c.name)}</b>` }, { h: t('Status'), k: r => t(r.c.status || '') }, { h: t('Exchange'), k: r => r.c.exchange || '' },
    { h: t('Founded'), k: r => r.c.founded ? fy(r.c.founded) : cmpNone() }, { h: t('Exit'), k: r => r.c.exit ? t('{a} bought it on {d}', { a: r.c.exit.acquirer, d: cmpDate(r.c.exit.date) }) : '' }, { h: t('Value (US dollars)'), cls: 'num', k: r => r.c.exit && r.c.exit.value ? cmpUsd(r.c.exit.value) : '' },
    { h: t('Source'), html: true, k: r => cmpSrc(r.c.source) + ' ' + cmpConf(r.c.confidence) }];
  el.innerHTML = cmpMetric(t('revenue by fiscal year in US dollars (IFRS), as filed with the US Securities and Exchange Commission. Newest year first; no score is built from it.')) +
    (blocks || cmpNote(t('No listed-abroad company matches the search.'))) +
    (ctx.length ? `<h4 class="fb-t cmp-co">${esc(t('Context: no revenue series'))}</h4>${cmpTbl(cols2, cx)}` : '') +
    (Ab.excluded ? cmpNote(tp('{n} company with a Lebanese team or investors, but a headquarters outside Lebanon and no clear Lebanese founding, is left out under the inclusion rule.', '{n} companies with a Lebanese team or investors, but a headquarters outside Lebanon and no clear Lebanese founding, are left out under the inclusion rule.', Ab.excluded)) : '') + cmpFoot();
  el.querySelectorAll('.cmp-chart').forEach(d => {
    const c = withFy.find(x => x.name === d.dataset.s), s = { id: 'rev', label: t('Revenue'), unit: 'USD', points: c.fiscal_years.slice().sort((a, b) => a.fiscal_year - b.fiscal_year).filter(f => f.revenue != null).map(f => [String(f.fiscal_year), f.revenue]), source_url: c.fiscal_years[0].source, license: null };
    fbCard(d, { title: t('{c}: revenue by fiscal year', { c: c.name }), unit: t('US dollars'), series: [{ s, label: t('Revenue') }], gran: 'y', height: 230, yFmt: cmpUsd, valFmt: cmpUsd, table: false, yMin: 0 });
  });
}

/* ---------- Startups and exits ---------- */
function cmpStartups(el) {
  const St = CMP.D.startups, all = St.startups;
  const SORTS = [['funding', N('Disclosed funding')], ['founded', N('Founding year')], ['exits', N('Exits')], ['name', N('Name')]];
  const sk = SORTS.some(s => s[0] === CMP.sort.startups) ? CMP.sort.startups : 'funding';
  const exitVal = s => Math.max(0, ...s.exits.map(e => e.value || 0));
  const rows = all.filter(s => cmpHit(CMP.hay.startups.get(s.name)));
  rows.sort((a, b) => sk === 'name' ? cmpName(a.name, b.name) : sk === 'founded' ? cmpNum(a.founded, b.founded, true) || cmpName(a.name, b.name)
    : sk === 'exits' ? exitVal(b) - exitVal(a) || b.exits.length - a.exits.length || cmpName(a.name, b.name) : b.funding_usd - a.funding_usd || cmpName(a.name, b.name));
  const metric = { funding: t('total disclosed equity funding in US dollars: the sum of announced rounds that state an amount. Grants and awards are not counted and undisclosed rounds add nothing, so every total is a floor.'),
    founded: t('founding year, newest first. Companies whose sources give no founding year come last.'), exits: t('largest disclosed exit value in US dollars, then the number of exits. Most exits state no value.'), name: t('no ranking: the companies are sorted by name.') }[sk];
  const ranked = sk !== 'name', rk = new Map();
  const hasV = s => sk === 'funding' ? s.funding_usd > 0 : sk === 'founded' ? !!s.founded : sk === 'exits' ? s.exits.length > 0 : false;   // no rank for a missing value
  if (ranked) rows.filter(hasV).forEach((s, i) => rk.set(s.name, i + 1));
  const tag = s => s.self_reported ? ` <span class="chip sm-c fb-tag" title="${esc(t('The figures come from the investor\'s own portfolio page, not an independent report.'))}">${esc(t('investor-reported'))}</span>` : '';
  const cols = [].concat(ranked ? [{ h: t('Rank'), cls: 'num', k: s => rk.get(s.name) || '' }] : [], [
    { h: t('Company'), html: true, k: s => `<b>${esc(s.name)}</b>${tag(s)}` }, { h: t('Sector'), k: s => t(s.sector || '') }, { h: t('Founded'), cls: 'num', k: s => s.founded ? fy(s.founded) : cmpNone() },
    { h: t('Disclosed funding (US dollars)'), cls: 'num', k: s => s.funding_usd ? cmpUsd(s.funding_usd) : t('not disclosed') }, { h: t('Rounds'), cls: 'num', k: s => nf(s.rounds.length) }, { h: t('Exits'), cls: 'num', k: s => nf(s.exits.length) },
    { h: t('Source'), html: true, k: s => cmpSrc(s.source) }]);
  const byYear = new Map(), invYear = new Set();
  all.forEach(s => s.rounds.forEach(r => { if (r.amount && r.date && !r.grant && !/to date/i.test(r.round || '')) {   // a cumulative "to date" figure is not money raised in its year
 const y = +String(r.date).slice(0, 4); byYear.set(y, (byYear.get(y) || 0) + r.amount); if (s.self_reported) invYear.add(y); } }));
  const bars = [...byYear].sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ id: 'y' + y, label: fy(y) + (invYear.has(y) ? ' *' : ''), value: v }));
  const exRows = [];
  rows.forEach(s => s.exits.forEach(e => exRows.push({ s, e })));
  exRows.sort((a, b) => String(b.e.date || '').localeCompare(String(a.e.date || '')));
  const rdRows = [];
  rows.forEach(s => s.rounds.forEach(r => rdRows.push({ s, r })));
  rdRows.sort((a, b) => String(b.r.date || '').localeCompare(String(a.r.date || '')));
  const exCols = [{ h: t('Company'), html: true, k: x => `<b>${esc(x.s.name)}</b>${tag(x.s)}` }, { h: t('Date'), k: x => cmpDate(x.e.date) || cmpNone() }, { h: t('Kind'), k: x => t(x.e.kind || '') }, { h: t('Acquirer'), k: x => x.e.acquirer || cmpNone() },
    { h: t('Value (US dollars)'), cls: 'num', k: x => x.e.value ? cmpUsd(x.e.value) : t('not disclosed') }, { h: t('Source'), html: true, k: x => cmpSrc(x.e.source) }];
  const rdCols = [{ h: t('Company'), html: true, k: x => `<b>${esc(x.s.name)}</b>${tag(x.s)}` }, { h: t('Date'), k: x => cmpDate(x.r.date) || cmpNone() }, { h: t('Round'), k: x => t(x.r.round || '') },
    { h: t('Amount (US dollars)'), cls: 'num', k: x => x.r.amount ? cmpUsd(x.r.amount) + (x.r.grant ? ' ' + t('(grant, not equity)') : '') : t('not disclosed') }, { h: t('Investors'), cls: 'cmp-wrap', k: x => x.r.investors.join(', ') }, { h: t('Source'), html: true, k: x => cmpSrc(x.r.source) }];
  el.innerHTML = cmpMetric(metric) + `<div class="d-filters">${cmpSel('cmpSort', t('Sort by'), SORTS, sk)}</div>` + cmpTbl(cols, rows) + all.filter(s => s.disclosure).map(s => cmpNote(t('Disclosure') + ': ' + t(s.disclosure))).join('') +
    cmpNote(tp('{n} lead is left out: its sources do not say it was founded or is based in Lebanon.', '{n} leads are left out: their sources do not say they were founded or are based in Lebanon.', St.excluded)) +
    cmpNote(t('Dates are announcement dates, and founding years differ between sources in some cases. "Investor-reported" marks figures taken from an investor\'s own portfolio page.')) +
    cmpCard(t('Disclosed funding by year'), t('US dollars, announced equity rounds that state an amount, by year of announcement'), '<div id="cmpFund"></div>' + (invYear.size ? cmpNote(t('* The year includes a figure reported by an investor, not independently.')) : ''), [(all.find(s => !s.self_reported) || all[0] || {}).source]) +
    `<h4 class="fb-t cmp-co">${esc(t('Exits'))}</h4>${cmpTbl(exCols, exRows)}` +
    `<details class="fb-det cmp-rounds"${CMP.q ? ' open' : ''}><summary>${esc(t('Funding rounds ({n})', { n: nf(rdRows.length) }))}</summary>${cmpTbl(rdCols, rdRows)}</details>` + cmpFoot();
  hubBars($('#cmpFund'), { items: bars, fmt: cmpUsd });
  $('#cmpSort').addEventListener('change', ev => { CMP.sort.startups = ev.target.value; cmpDraw(); });
}

/* ---------- Family businesses ---------- */
function cmpFamily(el) {
  const Fm = CMP.D.family, years = [...new Set(Fm.rows.map(r => r.year))].sort((a, b) => b - a);
  const SORTS = [['year', N('Year, newest first')], ['rank', N('Published rank')], ['name', N('Group name')]];
  const sk = SORTS.some(s => s[0] === CMP.sort.family) ? CMP.sort.family : 'year', yr = years.map(String).includes(String(CMP.year)) ? String(CMP.year) : 'all';
  const rows = Fm.rows.filter(r => (yr === 'all' || String(r.year) === yr) && cmpHit(CMP.hay.family.get(r.group + r.year)));
  rows.sort((a, b) => sk === 'name' ? cmpName(a.group, b.group) || b.year - a.year : sk === 'rank' ? a.rank - b.rank || b.year - a.year : b.year - a.year || a.rank - b.rank);
  const VERDICT = { verified: N('Origin verified on two sources'), contested: N('Founding place contested between sources'), reported: N('Origin reported by one source') };
  const cols = [{ h: t('Year'), cls: 'num', k: r => fy(r.year) }, { h: t('Rank'), cls: 'num', k: r => nf(r.rank) },
    { h: t('Group'), html: true, k: r => `<b>${esc(r.group)}</b>${r.established ? `<br><span class="note">${esc(t('established {y} on the list', { y: fy(r.established) }))}</span>` : ''}` }, { h: t('Sector'), k: r => t(r.sector || '') },
    { h: t('Origin'), html: true, k: r => esc(t(VERDICT[r.verdict] || r.verdict || '')) + (r.origin_sources.length ? '<br>' + cmpSrcs(r.origin_sources) : '') }, { h: t('Source'), html: true, k: r => cmpSrc(r.source) }];
  el.innerHTML = cmpMetric(t('the rank on the Forbes Middle East Top 100 Arab Family Businesses list of the year shown. It is Forbes\'s own editorial rank; the Hub adds no score and does not rank across years.')) +
    `<div class="d-filters">${cmpSel('cmpFyr', t('Year'), [['all', t('All years')]].concat(years.map(y => [String(y), fy(y)])), yr)}${cmpSel('cmpSort', t('Sort by'), SORTS, sk)}</div>` + cmpTbl(cols, rows) +
    cmpNote(t('Only groups of Lebanese origin or based in Lebanon are listed. Lists for 2021 to 2026 were read; the 2018 to 2020 lists could not be fetched. Other groups on the lists were not checked one by one.')) +
    `<details class="fb-det"><summary>${esc(t('Groups checked and left out'))}</summary><p class="note">${esc(t('The sources read give these groups an origin or a base outside Lebanon.'))}</p><ul class="cmp-list">${Fm.checked.map(c => `<li><b>${esc(c.group)}</b> ${cmpSrcs(c.sources)}</li>`).join('')}</ul></details>` + cmpFoot();
  const re = () => { CMP.year = $('#cmpFyr').value; cmpDraw(); };
  $('#cmpFyr').addEventListener('change', re);
  $('#cmpSort').addEventListener('change', ev => { CMP.sort.family = ev.target.value; cmpDraw(); });
}

/* ---------- Banks ---------- */
const CMP_BL = { 'abl-total-assets-usd': N('Total assets'), 'abl-total-deposits-usd': N('Total deposits'), 'abl-resident-private-deposits-usd': N('Resident private-sector deposits'), 'abl-nonresident-deposits-usd': N('Non-resident deposits'),
  'abl-public-deposits-usd': N('Public-sector deposits'), 'abl-loans-resident-private-usd': N('Loans to the resident private sector'), 'abl-capital-accounts-usd': N('Capital accounts'),
  'imf-fsi-total-assets-usd': N('Total assets'), 'imf-fsi-customer-deposits-usd': N('Customer deposits'), 'imf-fsi-gross-loans-usd': N('Gross loans') };
function cmpAbl(s, color) {   // December 2023 is valued at LBP 15,000 per dollar, July 2024 onward at 89,500: draw it as its own dot
  const p = s.points, old = p[0] && p[0][0] === '2023-12', lb = t(CMP_BL[s.id] || s.label);
  const out = [{ s: Object.assign({}, s, { points: old ? p.slice(1) : p, _p: null }), label: lb, color }];
  if (old) out.push({ s: Object.assign({}, s, { id: s.id + '-dec2023', points: [p[0]], _p: null }), label: t('{s}, December 2023 at the old rate', { s: lb }), color });
  return out;
}
function cmpBanks(el) {
  const B = CMP.D.banks, S = id => B.series.find(s => s.id === id), lastP = s => s && s.points.length ? s.points[s.points.length - 1] : null;
  const SORTS = [['assets', N('Total assets')], ['deposits', N('Customer deposits')], ['equity', N('Total equity')]];
  const sk = SORTS.some(s => s[0] === CMP.sort.banks) ? CMP.sort.banks : 'assets', key = { assets: 'total_assets_usd_million_derived', deposits: 'customer_deposits_usd_million_derived', equity: 'total_equity_usd_million_derived' }[sk];
  const latest = p => p.years.filter(y => y.total_assets_usd_million_derived != null).sort((a, b) => b.fiscal_year - a.fiscal_year)[0];
  const rows = B.per_bank.filter(p => latest(p) && cmpHit(CMP.hay.banks.get(p.bank))).map(p => ({ p, y: latest(p) }));
  rows.sort((a, b) => cmpNum(a.y[key], b.y[key], true) || cmpName(a.p.bank, b.p.bank));
  const top = Math.max(0, ...B.per_bank.map(p => (latest(p) || {}).fiscal_year || 0));
  const metric = t('{m} of each bank in US dollar millions, from the bank\'s own consolidated statements for its latest year. Pounds divided by 89,500, an accounting value, not a market value. Only the six banks listed in Beirut are covered. The sector charts above are totals and are not ranked.', { m: t({ assets: N('total assets'), deposits: N('customer deposits'), equity: N('total equity') }[sk]) });
  const cols = [{ h: t('Rank'), cls: 'num', k: (r, i) => r._rank }, { h: t('Bank'), html: true, k: r => `<b>${esc(r.p.bank)}</b> <span class="mono dim" data-notr>${esc(r.p.ticker || '')}</span>` }, { h: t('Statements for'), cls: 'num', k: r => fy(r.y.fiscal_year) },
    { h: t('Total assets (US dollar millions)'), cls: 'num', k: r => cmpN(r.y.total_assets_usd_million_derived) }, { h: t('Customer deposits'), cls: 'num', k: r => cmpN(r.y.customer_deposits_usd_million_derived) },
    { h: t('Total equity'), cls: 'num', k: r => cmpN(r.y.total_equity_usd_million_derived) }, { h: t('Net result'), cls: 'num', k: r => cmpN(r.y.net_result_usd_million_derived) },
    { h: t('Source'), html: true, k: r => cmpSrc(r.p.source, t('Statements')) + ' ' + cmpConf(r.p.confidence) }];
  rows.forEach((r, i) => { r._rank = r.y[key] == null ? '' : i + 1; });
  const tiles = ['abl-total-assets-usd', 'abl-total-deposits-usd', 'abl-loans-resident-private-usd', 'abl-capital-accounts-usd'].map(id => { const s = S(id), l = lastP(s); return l ? { k: t(CMP_BL[id]), v: '$' + nfCompact(l[1] * 1e6), n: t('{d}, month end', { d: fbLongDate(l[0]) }) } : null; }).filter(Boolean);
  const facts = (B.facts || []).map(f => ({ k: t(f.item), v: nf(f.value), n: fbLongDate(f.as_of) }));
  const olds = rows.filter(r => r.y.fiscal_year < top).map(r => t('{b}: the latest statements found are for {y}.', { b: r.p.bank, y: fy(r.y.fiscal_year) }));
  el.innerHTML = cmpMetric(metric) + fbStats(tiles) + (facts.length ? fbStats(facts) + cmpSrcLine([B.facts[0].source]) : '') + '<div class="fb-grid" data-g></div>' +
    `<h4 class="fb-t cmp-co">${esc(t('Banks listed in Beirut, from their own statements'))}</h4><div class="d-filters">${cmpSel('cmpSort', t('Sort by'), SORTS, sk)}</div>` +
    cmpCard(t('Banks by the chosen figure'), t('US dollars, latest statements'), '<div id="cmpBkBars"></div>', rows.map(r => r.p.source).slice(0, 1)) + cmpTbl(cols, rows) +
    cmpNote(t('Published figures are in pounds and are divided by 89,500, the legal rate since 31 January 2024. A 2023 statement is at the old rate of 15,000 and is not comparable.')) + olds.map(cmpNote).join('') +
    cmpNote(t('The other banks, about fifty, are not covered: no statement was in hand and the Association of Banks in Lebanon almanac is not used.')) + cmpFoot();
  const g = el.querySelector('[data-g]'), A = id => S(id) ? cmpAbl(S(id), null) : [], col = (list, c) => list.map(x => Object.assign(x, { color: HUB_COLORS[c] }));
  const C = (title, unit, ids, o) => fbCard(g, Object.assign({ title, unit, series: [].concat(...ids.map((id, i) => col(A(id), i))), gran: 'm', height: 250, table: false, yFmt: v => nfCompact(v * 1e6), valFmt: v => '$' + nfCompact(v * 1e6) }, o || {}));
  C(t('Total assets and deposits'), t('US dollars, month end, at the legal rate'), ['abl-total-assets-usd', 'abl-total-deposits-usd'], { note: t('December 2023 is a separate dot: it is valued at 15,000 pounds to the dollar, July 2024 onward at 89,500, so the two are not comparable. January to June 2024 is missing, and there is no sector series for 2020 to 2023.') }).fig.classList.add('wide');
  C(t('Deposits by holder'), t('US dollars, month end'), ['abl-resident-private-deposits-usd', 'abl-nonresident-deposits-usd', 'abl-public-deposits-usd']);
  C(t('Loans and capital'), t('US dollars, month end'), ['abl-loans-resident-private-usd', 'abl-capital-accounts-usd']);
  fbCard(g, { title: t('Before the crisis, 2011 to 2019'), unit: t('US dollars, yearly, deposit takers (IMF Financial Soundness Indicators)'), series: ['imf-fsi-total-assets-usd', 'imf-fsi-customer-deposits-usd', 'imf-fsi-gross-loans-usd'].map((id, i) => ({ s: S(id), label: t(CMP_BL[id]), color: HUB_COLORS[i] })),
    gran: 'y', height: 250, table: false, yFmt: v => nfCompact(v * 1e6), valFmt: v => '$' + nfCompact(v * 1e6) });
  hubBars($('#cmpBkBars'), { items: rows.filter(r => r.y[key] != null).map(r => ({ id: r.p.ticker, label: r.p.bank, value: r.y[key] * 1e6 })), fmt: cmpUsd });
  $('#cmpSort').addEventListener('change', ev => { CMP.sort.banks = ev.target.value; cmpDraw(); });
}

/* ---------- search, views, render ---------- */
const CMP_RENDER = { listed: cmpListed, abroad: cmpAbroad, startups: cmpStartups, family: cmpFamily, banks: cmpBanks };
function cmpIndex() {
  const X = CMP.D, m = (...a) => fbNrm(a.filter(v => v != null && v !== '').join(' ')), H = {};
  H.listed = new Map(X.listed.securities.map(r => [r.ticker, m(r.name, r.issuer, r.ticker, r.sector, t(r.sector || ''))]));
  X.diaspora.rows.forEach((r, i) => { r._i = i; });
  H.abroad = new Map(X.abroad.companies.map(c => ['r' + c.name, m(c.name, c.ticker, c.sector, t(c.sector || ''), c.exchange)]).concat(X.diaspora.rows.map(r => ['d' + r._i,
    m(r.c, r.ca, r.cf, r.p, r.h, r.s, cmpRoleOf(r), t(CMP_ORIG_L[r.o]), (X.diaspora.names[r.i] || []).join(' '), r.i)])));
  H.startups = new Map(X.startups.startups.map(s => [s.name, m(s.name, s.sector, t(s.sector || ''), s.hq, ...[].concat(...s.rounds.map(r => r.investors)), ...s.exits.map(e => e.acquirer))]));
  H.family = new Map(X.family.rows.map(r => [r.group + r.year, m(r.group, r.sector, t(r.sector || ''), r.year)]));
  H.banks = new Map(X.banks.per_bank.map(p => [p.bank, m(p.bank, p.ticker)]));
  CMP.hay = H;
}
function cmpCount(id) {
  const w = cmpWords();
  if (!w.length) return 0;
  const ok = h => w.every(x => h.includes(x));
  if (id === 'listed') return CMP.D.listed.securities.filter(r => (r.type === 'common' || CMP.pref) && ok(CMP.hay.listed.get(r.ticker))).length;
  return [...CMP.hay[id].values()].filter(ok).length;
}
function cmpSearchUI() {
  const also = $('#cmpAlso');
  if (!also) return;
  if (!cmpWords().length) { also.innerHTML = ''; return; }
  const items = CMP_VIEWS.filter(v => v.id !== CMP.view).map(v => [v.id, v.label, cmpCount(v.id)]).filter(x => x[2]);
  also.innerHTML = items.length ? esc(t('Also matches in')) + ': ' + items.map(x => `<button type="button" class="chip sm-c" data-go="${x[0]}">${esc(t(x[1]))} (${nf(x[2])})</button>`).join(' ') : esc(t('No other view matches the search.'));
}
function cmpDraw() {
  const el = $('#cmpView');
  if (!el) return;
  el.innerHTML = '';
  CMP_RENDER[CMP.view](el);
  cmpSearchUI();
}
function cmpShow(id) {
  CMP.view = id;
  HUB.setHash('companies', ...(id === 'listed' ? [] : [id]));
  $$('#cmpNav [data-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  cmpDraw();
}
HUB.tab('companies', { render(args, info) {
  const root = $('#companiesRoot');
  if (!root || !(D.tabs.companies && D.tabs.companies.listed)) return;
  CMP.view = CMP_VIEWS.some(x => x.id === args[0]) ? args[0] : (info.lang ? CMP.view : 'listed');
  fbLoad(root, CMP_FILES.map(f => 'data/companies/' + f + '.json'), (...r) => {
    CMP.D = {};
    CMP_FILES.forEach((f, i) => { CMP.D[f] = r[i]; });
    cmpIndex();
    root.innerHTML = `<div class="chips fb-nav" id="cmpNav"></div><div class="d-filters cmp-search"><label class="vh" for="cmpQ">${esc(t('Search companies'))}</label><input id="cmpQ" type="search" autocomplete="off" placeholder="${esc(t('Search companies'))}" value="${esc(CMP.q)}"></div><p class="note" id="cmpAlso"></p><div id="cmpView"></div>`;
    fbNav($('#cmpNav'), CMP_VIEWS.map(x => ({ id: x.id, label: t(x.label) })), CMP.view, cmpShow);
    $('#cmpQ').addEventListener('input', ev => { CMP.q = ev.target.value; cmpDraw(); });
    $('#cmpAlso').addEventListener('click', ev => { const b = ev.target.closest('[data-go]'); if (b) cmpShow(b.dataset.go); });
    cmpDraw();
  });
} });
