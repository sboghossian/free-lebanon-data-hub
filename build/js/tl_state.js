/* ------------------------------------------------------------ v4 state: office holders by date, year context, trust labels */
const nrm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const OFF_NAME = { P: N('President'), PM: N('Prime minister'), C: N('Cabinet'), S: N('Speaker'), G: N('BDL governor'), A: N('Army commander'), F: N('Finance minister'), L: N('Parliament'), H: N('French High Commissioner') };
const OFFS = {};
D.offices.forEach(([code, name, a, b, acting, c, u, note, g]) => {
  (OFFS[code] = OFFS[code] || []).push({ code, name, a, b: b || '9999-12-31', open: !b, acting: !!acting, c, u, note, g });
});
// Pre-1920 holders (Emir, Qaimaqam, Mutasarrif ...) have codes 'R:<office>'; their label is the office name.
const RULER_CODES = Object.keys(OFFS).filter(c => c.startsWith('R:'));
const offName = c => t(OFF_NAME[c] || String(c).replace(/^R:/, ''));
Object.values(OFFS).forEach(l => l.sort((p, q) => (p.a < q.a ? -1 : p.a > q.a ? 1 : 0)));
const isoT = s => dy(s);

// The event's period as two ISO dates. Month and year dates start on the first day of the period.
function periodOf(e) {
  if (e._p) return e._p;
  const d = String(e.date);
  let m, p;
  if (e.span) p = [e.span[0] + '-01-01', (e.span[1] - 1) + '-12-31'];
  else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) p = [d, d];
  else if ((m = d.match(/^(\d{4})-(\d{2})$/))) p = [d + '-01', d + '-31'];
  else if ((m = d.match(/^(\d{4})$/))) p = [d + '-01-01', d + '-12-31'];
  else { const y = Math.floor(e.t); p = [y + '-01-01', y + '-12-31']; }
  e._p = p;
  return p;
}
const atStart = e => e.prec !== 'day';

// Holders of an office on an ISO date. A term covers [start, end); on a hand-over day the incoming holder wins.
// If nobody starts that day, the holder whose term ends that day is kept. Two results mean a disputed office.
function officeAt(code, d) {
  const l = OFFS[code] || [];
  let m = l.filter(o => o.a <= d && d < o.b);
  if (!m.length) m = l.filter(o => o.b === d);
  return m;
}
function officesAt(d) {
  const o = {};
  ['P', 'PM', 'C', 'S', 'G', 'A', 'H', 'F'].concat(RULER_CODES).forEach(k => { o[k] = officeAt(k, d); });
  return o;
}
function offFor(e) {
  if (!e._off) e._off = officesAt(periodOf(e)[0]);
  return e._off;
}
// Every holder whose term overlaps [a, b], for filters.
const overlapHolders = (code, a, b) => (OFFS[code] || []).filter(o => o.a <= b && o.b >= a);
const yrs = o => { const a = fy(o.a.slice(0, 4)), b = o.open ? t('now') : fy(o.b.slice(0, 4)); return a === b ? a : a + '-' + b; };

// Plain-words text for one office on one date; returns {html, txt}.
function holderText(code, list, off) {
  const link = o => o.u ? `<a href="${esc(o.u)}" target="_blank" rel="noopener" data-tip="${tipA(o.name + ', ' + yrs(o), ' ' + (o.note || t('source')))}">${esc(o.name)}</a>` : esc(o.name);
  if (!list.length) return { html: `<span class="dim">${esc(t('no record'))}</span>`, txt: t('no record') };
  if (code === 'P' && list[0].name === 'Vacuum') {
    const pms = (off.PM || []).map(o => o.name);
    const by = pms.length > 1 ? t('two rival cabinets ({pms}) claimed them', { pms: pms.join(' ' + t('and') + ' ') }) : pms.length ? t('exercised by the cabinet of {pm}', { pm: pms[0] }) : t('not assigned in the record');
    return { html: `<span class="vac-t">${esc(t('Vacuum'))}</span>: ${esc(t('powers {by}', { by }))}`, txt: t('Vacuum') + ': ' + t('powers {by}', { by }) };
  }
  const one = o => link(o) + (o.acting ? ` <span class="dim">(${esc(t('acting'))})</span>` : '');
  if (list.length > 1) return { html: esc(t('Disputed:')) + ' ' + list.map(one).join(' / '), txt: t('Disputed:') + ' ' + list.map(o => o.name).join(' / ') };
  return { html: one(list[0]), txt: list[0].name + (list[0].acting ? ' (' + t('acting') + ')' : '') };
}

/* ---- year context over the series: latest point inside each year */
const YIDX = {};
function yIndex(id) {
  if (YIDX[id]) return YIDX[id];
  const s = SER[id], m = {};
  ((s && s.points) || []).forEach(p => {
    const d = String(p[0]), r = d.match(/^(\d{4})-(\d{4})$/), y = d.match(/^(\d{4})(?:-\d{2})?(?:-\d{2})?$/);
    const put = yr => { if (!m[yr] || String(m[yr].d) <= d) m[yr] = { v: p[1], d, n: p[2] || '' }; };
    if (y) put(+y[1]);
    else if (r && /^px_/.test(id)) for (let k = +r[1]; k <= +r[2]; k++) put(k);
  });
  YIDX[id] = m;
  return m;
}
const yval = (id, y) => yIndex(id)[y] || null;
const serSrc = id => { const s = SER[id]; return s ? (s.source && /^http/.test(s.source) ? s.source : (s.sources || [])[0]) : null; };
const serLabel = id => (SER[id] || {}).label || id;
// A number with its source link, or "no data".
function numSrc(id, y, f, back) {
  let o = yval(id, y), pre = '';
  if ((!o || o.v == null || o.v === '') && back) {
    const p = yval(id, y - 1);
    if (p && p.v != null && p.v !== '') { o = p; pre = `<span class="nd">${esc(t('no data for {y}', { y: fy(y) }))}</span> · `; }
  }
  if (!o || o.v == null || o.v === '') return `<span class="nd">${esc(t('no data'))}</span>`;
  const u = serSrc(id), when = String(o.d) !== String(y) ? ` <span class="dim">(${esc(pdate(o.d))})</span>` : '';
  const tipTxt = tipA(tc(serLabel(id)), ' ' + (o.n ? tc(o.n) : t('Source: {s}', { s: u ? hostOf(u) : t('not linked') })));
  return `${pre}<span class="yv" data-tip="${tipTxt}">${esc(f(o.v))}${when}</span>${u ? ` <a class="sl" href="${esc(u)}" target="_blank" rel="noopener">${esc(hostOf(u))}</a>` : ''}`;
}
const fInt = v => typeof v === 'number' ? fmt(v, 0) : String(v);
const fMil = v => typeof v === 'number' ? (Math.abs(v) >= 1e6 ? t('{v} million', { v: fmt(v / 1e6, 2) }) : fmt(v, 0)) : String(v);
const fLbp = v => typeof v === 'number' ? t('{v} LBP', { v: fmt(v, v < 10 ? 2 : 0) }) : String(v);
const fUsd = v => typeof v === 'number' ? 'US$' + fmt(v, v < 100 ? 2 : 0) : String(v);
const fPct = v => typeof v === 'number' ? fmt(v, 1) + '%' : String(v);

/* ---- trust: tier, Jev verdict in plain words, effective level */
const LEVEL = {
  strong: ['good', N('Supported, rated source'), N('Jev grounded it on a T1 to T4 source')],
  unrated: ['warn', N('Supported, unrated source'), N('Jev grounded it, but on an unmapped or Jev-screened (T3?) site')],
  data: ['neutral', N('Data page'), N('A table or API; Jev does not judge data pages')],
  weak: ['warn', N('Weak match'), N('Jev found only a weak match on the page')],
  unchk: ['neutral', N('Not machine-checked'), N('The page could not be read by code')],
  unsup: ['bad', N('Not supported'), N('Jev read the page and it does not describe this')],
};
const LEVEL_ORDER = ['strong', 'unrated', 'data', 'weak', 'unchk', 'unsup'];
const TIER_W = { T1: N('T1 official'), T2: N('T2 academic'), T3: N('T3 press'), 'T3?': N('T3? screened'), T4: N('T4 reference'), un: N('unrated'), bl: N('blocked') };
const FETCH_W = { '403': N('site blocks bots'), '429': N('site rate-limits bots'), '401': N('login wall'), empty: N('page came back empty'), '404': N('dead link'),
  error: N('fetch failed'), timeout: N('timed out'), pdf: N('PDF, not read'), not_url: N('not a web link'), none: N('no link'), '500': N('server error') };
const sc = p => (p.s != null ? ` (${Number(p.s).toFixed(2)})` : '');
function jevWords(p) {
  if (!p.u) return t('no source link');
  if (p.g === 'g') return t('Jev: source supports this') + sc(p);
  if (p.g === 'w') return t('Jev: weak match') + sc(p);
  if (p.g === 'u') return t('Jev: the page does not describe this') + sc(p);
  if (p.g === 'd') return t('data page');
  return t('not machine-checked') + (p.f && FETCH_W[p.f] ? ` (${t(FETCH_W[p.f])})` : '');
}
function trustLine(p) {
  const tier = p.tr ? `<span class="tier tr-${esc(String(p.tr).replace('?', 'q'))}" data-tip="${tipA(t('Source tier'), ' ' + t(TIER_W[p.tr] || p.tr))}">${esc(t(TIER_W[p.tr] || p.tr))}</span>` : '';
  const lf = p.lf === 'yes' ? `<span class="jv jv-g">${esc(t('law number found on the page'))}</span>` : p.lf === 'no' ? `<span class="jv jv-w">${esc(t('law number not found on the page'))}</span>` : '';
  return `<span class="trust">${tier}<span class="jv jv-${esc(p.g || 'x')}">${esc(jevWords(p))}</span>${lf}</span>`;
}
const levelBadge = lv => lv && LEVEL[lv] ? `<span class="pill ${LEVEL[lv][0]} lvb" data-tip="${tipA(t(LEVEL[lv][1]), ' ' + t(LEVEL[lv][2]))}">${esc(t(LEVEL[lv][1]))}</span>` : '';
