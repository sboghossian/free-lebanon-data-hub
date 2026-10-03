/* ------------------------------------------------------------ Strike map (#map): every documented strike, shelling and bombing we hold, by place.
   Data: D.strikes {cols, dict, places, rows, evl, unres}, D.geo (pre-projected paths), D.acled (optional). Built by build/strikes.py.
   Rows are dictionary-encoded; coordinates are integers in projected units (about 95 m). Points are drawn in SVG up to MAP_CV_LIMIT in view, then on a canvas;
   above MAP_HEX_AUTO points in view the map switches to hex bins. One hit-test grid serves both renderers. */
const MAP_CV_LIMIT = 2500, MAP_HEX_AUTO = 4000, MAP_HEX_PX = 16, MAP_FAN = 2.4;
const WAR_GROUPS = [
  { id: 'all', label: N('All wars'), wars: null, css: 'all' },
  { id: 'civil', label: N('Civil war 1975–90'), wars: ['civil_war'], css: 'cw' },
  { id: '7882', label: N('1978 & 1982'), wars: ['1978', '1982'], css: 'w78' },
  { id: '9396', label: N('1993 & 1996'), wars: ['1993', '1996'], css: 'w93' },
  { id: '2006', label: N('2006'), wars: ['2006'], css: 'w06' },
  { id: '2326', label: N('2023–26'), wars: ['2023_26'], css: 'w23' },
  { id: 'other', label: N('Other 1987–2005'), wars: ['other'], css: 'wot' }
];
const WAR_CSS = { civil_war: 'cw', 1978: 'w78', 1982: 'w78', 1993: 'w93', 1996: 'w93', 2006: 'w06', '2023_26': 'w23', other: 'wot' };
const WAR_NAME = { civil_war: N('Civil war'), 1978: N('1978 invasion'), 1982: N('1982 invasion'), 1993: N('1993 operation'), 1996: N('1996 operation'), 2006: N('2006 war'), '2023_26': N('2023–26 war'), other: N('Other conflict') };
const WAR_NOTE = {
  all: N('Every row is an incident that a source documents. No complete public record exists for any of these wars, so the map shows what is documented, not everything that happened.'),
  civil: N('Civil war: documented incidents only. No complete public record exists. Rows come mainly from the ICTJ mapping report and lists of massacres, battles and car bombs; most shelling was never recorded in public.'),
  '7882': N('Israeli operations of 1978 and 1982: the documented incidents only. The siege of Beirut in 1982 involved far more strikes than are listed here.'),
  '9396': N('Operations of 1993 and 1996: the major documented incidents only, such as Qana in 1996.'),
  '2006': N('2006 war: documented strikes from human rights, UN and press reports. The real number of strikes in those 34 days is far higher than what is named here.'),
  '2326': N('2023 to 2026: what Wikipedia timelines, OCHA, UCDP, Airwars and news reports name. Many strikes were reported without a village name; they count as district-level and are not drawn.'),
  other: N('Incidents between 1987 and 2005 outside the named wars: raids during the occupation of the south, and bombings after the civil war. Documented incidents only.')
};
const KIND_NAME = { airstrike: N('Airstrike'), drone_strike: N('Drone strike'), shelling: N('Shelling'), artillery: N('Artillery'), naval: N('Naval'), car_bomb: N('Car bomb'), bombing: N('Bombing'), ground_assault: N('Ground assault'), massacre: N('Massacre'), cluster_munition: N('Cluster munition'), white_phosphorus: N('White phosphorus'), explosion: N('Explosion'), other: N('Other') };
const CONF_WORD = ['verified', 'reported', 'inference'];
let SK = null, GEO = null, ACL = null, TOLLS = [];  // the lazy files data/strikes/strikes.json and data/strikes/geo.json, set when the tab first loads
const gname = a => (LANG === 'ar' && a.ar) ? a.ar : a.n;
const MAP = { war: 'all', kinds: new Set(), q: '', t0: null, t1: null, mode: 'auto', inferred: true, acled: false, shown: 25, k: 1, tx: 0, ty: 0, k0: 1, W: 0, H: 0, sel: null, back: null, built: false };
let MROWS = [], MPLACES = [], MVIS = [], MPTS = [], MGRID = new Map(), MCOL = {}, MAC = null;

const rp = r => r.pl >= 0 && MPLACES[r.pl] ? dnName(MPLACES[r.pl].n, MPLACES[r.pl].ar) : r.place;   // place name in the page language (Arabic where the gazetteer has it)
const dayNumM = s => {
  const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return NaN;
  return Date.UTC(+m[1], m[2] ? +m[2] - 1 : 6, m[3] ? +m[3] : 1) / 864e5;
};
const dayIso = n => new Date(n * 864e5).toISOString().slice(0, 10);
const rowDate = r => r.de && r.de !== r.d ? t('{a} to {b}', { a: fmtDate(r.d), b: fmtDate(r.de) }) : fmtDate(r.d);

function mapDecode() {
  const C = Object.fromEntries(SK.cols.map((c, i) => [c, i])), DT = SK.dict;
  MPLACES = SK.places.map((p, i) => ({ n: p[0], x: p[1], y: p[2], d: p[3], ap: p[4], ar: (SK.places_ar && SK.places_ar[i]) || '' }));
  MROWS = SK.rows.map((r, i) => {
    const pl = r[C.pl], ar = r[C.ar];
    return { i, d: r[C.t], de: r[C.te], t: dayNumM(r[C.t]), pl, war: DT.war[r[C.w]], kind: DT.kind[r[C.k]], kl: r[C.kl], kt: r[C.kt], inj: r[C.inj], actor: DT.actor[r[C.a]] || '',
      tg: r[C.tg], ti: r[C.ti], u: DT.src[r[C.u]] || '', c: CONF_WORD[r[C.c]] || 'reported', n: r[C.n], q: r[C.q], ev: (SK.evl || {})[i] || null,
      place: pl >= 0 ? MPLACES[pl].n : (DT.area[ar] || ''), pn: r[C.pn] >= 0 ? DT.pn[r[C.pn]] : '', area: pl < 0 };
    });
  // each place's incidents are fanned out on a small spiral so a hundred strikes on one town stay separate, clickable dots (positions are place-level, not exact)
  const seen = {};
  MROWS.forEach(r => {
    if (r.pl < 0) return;
    const j = seen[r.pl] = (seen[r.pl] || 0) + 1, p = MPLACES[r.pl];
    const rad = j === 1 ? 0 : MAP_FAN * Math.sqrt(j - 0.5), th = (j - 1) * 2.399963;
    r.x = p.x + rad * Math.cos(th); r.y = p.y + rad * Math.sin(th);
    r._h = nrm(r.place + dnTerms(p.n) + ' ' + (p.ar || '') + ' ' + r.pn + ' ' + p.d);
  });
  MROWS.forEach(r => { if (r.pl < 0) r._h = nrm(r.place + ' ' + r.pn); });
}
const mapGroup = () => WAR_GROUPS.find(g => g.id === MAP.war) || WAR_GROUPS[0];
function warRows() {  // rows of the chosen war group (before the time, kind and search filters)
  const g = mapGroup();
  return MROWS.filter(r => (!g.wars || g.wars.includes(r.war)) && (MAP.inferred || r.q !== 2));
}
function otherFilters(r) {
  if (MAP.kinds.size && !MAP.kinds.has(r.kind)) return false;
  if (MAP.q) { const w = nrm(MAP.q).split(/\s+/).filter(Boolean); if (!w.every(x => r._h.includes(x))) return false; }
  return true;
}
let MSPAN = [0, 0];
function mapFilter() {
  const base = warRows().filter(otherFilters);
  MSPAN = base.length ? [Math.min(...base.map(r => r.t)), Math.max(...base.map(r => r.t))] : [0, 0];
  if (MAP.t0 != null && MAP.t1 != null && (MAP.t1 < MSPAN[0] || MAP.t0 > MSPAN[1])) { MAP.t0 = MAP.t1 = null; }
  const t0 = MAP.t0 == null ? -Infinity : MAP.t0, t1 = MAP.t1 == null ? Infinity : MAP.t1;
  MVIS = base.filter(r => r.t >= t0 && r.t <= t1);
  return base;
}

/* ---------- view: projected units -> screen (k, tx, ty) ---------- */
const mScreen = r => [r.x * MAP.k + MAP.tx, r.y * MAP.k + MAP.ty];
function mapFit(force) {
  const st = $('#mpStage');
  if (!st) return false;
  const W = st.clientWidth, H = st.clientHeight;
  if (!W || !H) return false;
  const changed = W !== MAP.W || H !== MAP.H;
  MAP.W = W; MAP.H = H;
  MAP.k0 = Math.min(W / GEO.w, H / GEO.h) * 0.97;
  if (force || !MAP.built || changed) { MAP.k = MAP.k0; MAP.tx = (W - GEO.w * MAP.k) / 2; MAP.ty = (H - GEO.h * MAP.k) / 2; }
  return true;
}
function mapZoom(f, px, py) {
  const nk = Math.max(MAP.k0, Math.min(MAP.k0 * 60, MAP.k * f));
  if (px == null) { px = MAP.W / 2; py = MAP.H / 2; }
  MAP.tx = px - (px - MAP.tx) * (nk / MAP.k); MAP.ty = py - (py - MAP.ty) * (nk / MAP.k); MAP.k = nk;
  mapRedraw();
}
function mapColors() {
  const cs = getComputedStyle($('#mapRoot'));
  ['cw', 'w78', 'w93', 'w06', 'w23', 'wot', 'all'].forEach(c => { MCOL[c] = cs.getPropertyValue('--mw-' + c).trim() || '#c2301f'; });
  MCOL.ink = cs.getPropertyValue('--ink').trim() || '#18211C';
  MCOL.paper = cs.getPropertyValue('--paper').trim() || '#F8F9F5';
  MCOL.ac = cs.getPropertyValue('--mw-ac').trim() || '#555';
}
const radOf = r => 2.6 + Math.min(11, Math.sqrt(Math.max(0, r.kl)) * 1.1);
function mapRedraw() {
  const g = $('#mpG');
  if (!g || !MAP.W) return;
  g.setAttribute('transform', `translate(${MAP.tx.toFixed(2)} ${MAP.ty.toFixed(2)}) scale(${MAP.k.toFixed(5)})`);
  const zoomed = MAP.k > MAP.k0 * 2.2;
  $('#mpLb').innerHTML = GEO.adm1.map(a => `<text class="mp-l1" x="${(a.l[0] * MAP.k + MAP.tx).toFixed(1)}" y="${(a.l[1] * MAP.k + MAP.ty).toFixed(1)}" text-anchor="middle">${esc(gname(a))}</text>`).join('') +
    (zoomed ? GEO.adm2.map(a => `<text class="mp-l2" x="${(a.l[0] * MAP.k + MAP.tx).toFixed(1)}" y="${(a.l[1] * MAP.k + MAP.ty).toFixed(1)}" text-anchor="middle">${esc(gname(a))}</text>`).join('') : '');
  mapDrawPoints();
}
function mapDrawPoints() {
  const { W, H, k, tx, ty } = MAP, st = $('#mpStage'), cv = $('#mpCv'), svgP = $('#mpPts'), svgA = $('#mpAc');
  const ent = [], cell = 24;
  // ACLED rings first (lowest in the hit order)
  const ac = MAP.acled && MAC ? MAC.filter(a => a.n > 0).map(a => ({ x: a.x * k + tx, y: a.y * k + ty, r: 2 + Math.min(14, Math.sqrt(a.n) * 0.9), ac: a })).filter(e => e.x > -20 && e.x < W + 20 && e.y > -20 && e.y < H + 20) : [];
  ac.sort((a, b) => b.r - a.r);
  const pts = [];
  for (const r of MVIS) {
    if (r.pl < 0) continue;
    const sx = r.x * k + tx, sy = r.y * k + ty;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    pts.push({ x: sx, y: sy, r: radOf(r), row: r });
  }
  pts.sort((a, b) => b.r - a.r);
  let mode = MAP.mode === 'hex' || (MAP.mode === 'auto' && pts.length > MAP_HEX_AUTO) ? 'hex' : (pts.length > MAP_CV_LIMIT ? 'canvas' : 'svg');
  st.dataset.mode = mode; st.dataset.n = String(pts.length);
  let hexes = [];
  if (mode === 'hex') {
    const s = MAP_HEX_PX, bins = new Map();
    for (const p of pts) {
      const q = (Math.sqrt(3) / 3 * p.x - p.y / 3) / s, rr = 2 / 3 * p.y / s;
      let x = q, z = rr, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      const key = rx + ',' + rz;
      let b = bins.get(key);
      if (!b) { b = { x: s * Math.sqrt(3) * (rx + rz / 2), y: s * 1.5 * rz, n: 0, kl: 0, rows: [] }; bins.set(key, b); }
      b.n++; b.kl += Math.max(0, p.row.kl); b.rows.push(p.row);
    }
    hexes = [...bins.values()];
  }
  const ents = ac.map(a => a).concat(mode === 'hex' ? hexes.map(h => ({ x: h.x, y: h.y, r: MAP_HEX_PX * 0.86, hex: h })) : pts);
  MPTS = ents; MGRID = new Map();
  ents.forEach((e, i) => {
    const key = Math.floor((e.x + 40) / cell) * 1000 + Math.floor((e.y + 40) / cell);
    (MGRID.get(key) || MGRID.set(key, []).get(key)).push(i);
  });
  const useCv = mode === 'canvas';
  cv.hidden = !useCv;
  svgA.innerHTML = ''; svgP.innerHTML = '';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let ctx = null;
  if (useCv) {
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  }
  if (ac.length) {
    if (ctx) { ctx.strokeStyle = MCOL.ac; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.8; ac.forEach(a => { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.stroke(); }); ctx.globalAlpha = 1; }
    else svgA.innerHTML = ac.map(a => `<circle class="mp-ac" cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="${a.r.toFixed(1)}"/>`).join('');
  }
  if (mode === 'hex') {
    const s = MAP_HEX_PX, mx = Math.max(...hexes.map(h => h.n), 1);
    const pathFor = h => { let d = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); d += (i ? 'L' : 'M') + (h.x + s * 0.94 * Math.cos(a)).toFixed(1) + ' ' + (h.y + s * 0.94 * Math.sin(a)).toFixed(1); } return d + 'Z'; };
    svgP.innerHTML = hexes.map(h => `<path class="mp-hex" d="${pathFor(h)}" fill-opacity="${(0.16 + 0.78 * Math.sqrt(h.n / mx)).toFixed(2)}"/>`).join('');
  } else if (useCv) {
    ctx.lineWidth = 0.8;
    for (const p of pts) {
      ctx.globalAlpha = 0.62; ctx.fillStyle = MCOL[WAR_CSS[p.row.war]] || MCOL.all; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = MCOL.paper; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    svgP.innerHTML = pts.map(p => `<circle class="mp-pt ${WAR_CSS[p.row.war] || 'wot'}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" data-i="${p.row.i}"/>`).join('');
  }
}
function mapHit(px, py) {
  const cx = Math.floor((px + 40) / 24), cy = Math.floor((py + 40) / 24);
  let best = -1;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = MGRID.get((cx + a) * 1000 + (cy + b));
    if (!l) continue;
    for (const i of l) { const e = MPTS[i]; if (i > best && Math.hypot(e.x - px, e.y - py) <= e.r + 3) best = i; }
  }
  return best < 0 ? null : MPTS[best];
}

/* ---------- panels: counts, top places, coverage note, histogram, list ---------- */
function mapTip(e, px, py) {
  const tip = $('#mpTip');
  if (!e) { tip.hidden = true; return; }
  let h;
  if (e.hex) h = `<b>${esc(t('{n} incidents', { n: nf(e.hex.n) }))}</b>${e.hex.kl ? ', ' + esc(t('{n} documented killed', { n: nf(e.hex.kl) })) : ''}<br>${esc(topNames(e.hex.rows, 3))}<br><span class="dim">${esc(t('Click to zoom in'))}</span>`;
  else if (e.ac) h = `<b>${esc(t('ACLED: {name}', { name: e.ac.name }))}</b><br>${esc(t('{n} events, {f} reported fatalities in the range', { n: nf(e.ac.n), f: nf(e.ac.f) }))}`;
  else { const r = e.row; h = `<b>${esc(rp(r))}</b>, ${esc(rowDate(r))}<br>${esc(t(KIND_NAME[r.kind] || r.kind))}${r.kl > 0 ? ', ' + esc(t('{n} killed', { n: r.kt || nf(r.kl) })) : ''}<br><span class="dim">${esc(t('Click for the incident'))}</span>`; }
  tip.innerHTML = h; tip.hidden = false;
  const W = MAP.W, w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(W - w - 4, px + 14)) + 'px';
  tip.style.top = Math.max(4, Math.min(MAP.H - hh - 4, py + 14)) + 'px';
}
function topNames(rows, n) {
  const c = {};
  rows.forEach(r => { const k = rp(r); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${nf(v)})`).join(', ');
}
function mapStats(base) {
  const pts = MVIS.filter(r => r.pl >= 0), area = MVIS.length - pts.length, g = mapGroup();
  const places = new Set(pts.map(r => r.pl)), killed = pts.reduce((s, r) => s + Math.max(0, r.kl), 0);
  const unres = Object.entries(SK.unres || {}).reduce((s, [w, n]) => s + (!g.wars || g.wars.includes(w) ? n : 0), 0);
  const cnt = {};
  pts.forEach(r => { const c = cnt[r.pl] || (cnt[r.pl] = { n: 0, kl: 0 }); c.n++; c.kl += Math.max(0, r.kl); });
  const top = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  $('#mpStats').innerHTML = `<div><dt>${esc(t('Incidents on the map'))}</dt><dd data-k="incidents" data-n="${pts.length}">${nf(pts.length)}</dd></div>
    <div><dt>${esc(t('Places'))}</dt><dd data-k="places">${nf(places.size)}</dd></div>
    <div><dt>${esc(t('Killed, as documented in sources'))}</dt><dd data-k="killed">${nf(killed)}</dd></div>`;
  const lo = +SK.left_out || 0;
  $('#mpMore').innerHTML = `${lo ? `<p class="mp-left" id="mpLeft"><b>${esc(tp('{n} incident is not shown', '{n} incidents are not shown', lo))}</b> ${esc(lo === 1 ? t('because its cited source does not confirm it. This count covers all wars and does not change with the filters.') : t('because their cited source does not confirm them. This count covers all wars and does not change with the filters.'))}</p>` : ''}<p>${esc(t('{n} more matching these filters are known only to a district or governorate, so they are not drawn.', { n: nf(area) }))}${g.id === 'all' || SK.unres ? ' ' + esc(g.id === 'all' ? t('{n} rows could not be placed (the name is missing or shared by several villages).', { n: nf(unres) }) : t('{n} rows of this war could not be placed (the name is missing or shared by several villages).', { n: nf(unres) })) : ''}</p>
    <p class="dim">${esc(t('Killed counts add up what each source states for each incident. Sources overlap, and the figure is not a casualty count.'))}</p>`;
  $('#mpTop').innerHTML = top.length ? top.map(([i, c]) => `<li><button type="button" class="mp-place" data-place="${esc(dnName(MPLACES[i].n, MPLACES[i].ar))}">${esc(dnName(MPLACES[i].n, MPLACES[i].ar))}</button><span class="mono dim">${nf(c.n)}${c.kl ? ' / ' + esc(t('{n} killed', { n: nf(c.kl) })) : ''}</span></li>`).join('') : `<li class="dim">${esc(t('No incidents match these filters.'))}</li>`;
  const rows = warRows(), inWar = MROWS.filter(r => !g.wars || g.wars.includes(r.war)).length + unres;
  $('#mpNote').innerHTML = `${esc(t(WAR_NOTE[g.id]))} <span class="mono dim">${esc(t('{a} of {b} rows are placed on the map', { a: nf(rows.filter(r => r.pl >= 0).length), b: nf(inWar) }))}${MAP.inferred ? '' : ' ' + esc(t('(inferred placements hidden)'))}.</span>`;
  mapToll(g);
}
/* Official toll per war (data/strikes/tolls.json, from research/hub/series/T-war-totals.json): who counted, as of when, next to what the mapped incidents add up to. */
const tollWhen = tDates;
const tollRange = (lo, hi) => lo == null ? '' : hi == null ? t('at least {n}', { n: nf(lo) }) : lo === hi ? nf(lo) : t('{a} to {b}', { a: nf(lo), b: nf(hi) });
function tollCard(x) {
  const a = dayNumM(x.from), b = dayNumM(x.to), rows = MROWS.filter(r => r.pl >= 0 && x.wars.includes(r.war) && r.t >= a && r.t <= b);
  const kl = rows.reduce((s, r) => s + Math.max(0, r.kl), 0), disp = x.displaced == null ? '' : (x.displaced_low != null && x.displaced_low !== x.displaced ? tollRange(x.displaced_low, x.displaced) : nf(x.displaced));
  const row = (k, v) => v ? `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>` : '';
  return `<article class="mp-tc"><h4>${esc(t(x.war))}</h4><dl>${row(N('Official toll, killed'), x.killed_parts ? x.killed_parts.map(q => t('{n} {what}', { n: nf(q.n), what: t(q.what) })).join('; ') : tollRange(x.killed_low, x.killed_high) || t('not given'))}${row(N('Injured'), x.injured != null ? nf(x.injured) : '')}${row(N('Displaced'), disp)}
    <div class="mp-tc-doc"><dt>${esc(t('Documented in mapped incidents'))}</dt><dd>${esc(t('{k} killed in {n} incidents', { k: nf(kl), n: nf(rows.length) }))}</dd></div></dl>
    <p class="mp-tc-by"><b>${esc(t('Counted by'))}:</b> ${esc(t(x.counted_by))}. <b>${esc(t('As of'))}:</b> ${esc(tollWhen(x.as_of))}. ${/^https?:/.test(x.source) ? `<a href="${esc(x.source)}" target="_blank" rel="noopener noreferrer">${esc(t('Source'))}</a>` : ''}</p>
    <p class="note">${esc(t(x.caveat))}</p></article>`;
}
function mapToll(g) {
  const el = $('#mpToll'); if (!el) return;
  const list = (TOLLS || []).filter(x => g.id === 'all' || x.group === g.id);
  if (!list.length) { el.innerHTML = ''; return; }
  const body = `<p class="note">${esc(t('Counts as published by the counters named. They differ by war and are not comparable. Mapped incidents are only those a source documents with a place, so the two figures are not expected to match.'))}</p><div class="mp-tg">${list.map(tollCard).join('')}</div>`;
  el.innerHTML = g.id === 'all'
    ? `<details class="mp-tdet"><summary><b>${esc(t('Official toll'))}</b> <span class="mono dim">${esc(tp('{n} count', '{n} counts', list.length))}</span></summary>${body}</details>`
    : `<h3 class="d-h">${esc(t('Official toll'))}</h3>${body}`;
}
function binInfo(base) {
  const pts = base.filter(r => r.pl >= 0);
  if (!pts.length) return null;
  const lo = Math.min(...pts.map(r => r.t)), hi = Math.max(...pts.map(r => r.t)), span = hi - lo;
  const unit = span > 4380 ? 'y' : (span > 150 ? 'm' : 'd');
  const start = t => { const d = new Date(t * 864e5); return unit === 'y' ? Date.UTC(d.getUTCFullYear(), 0, 1) / 864e5 : unit === 'm' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 864e5 : Math.floor(t); };
  const next = t => { const d = new Date(t * 864e5); return unit === 'y' ? Date.UTC(d.getUTCFullYear() + 1, 0, 1) / 864e5 : unit === 'm' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 864e5 : t + 1; };
  const bins = []; let b = start(lo);
  while (b <= hi) { bins.push({ a: b, b: next(b), n: 0 }); b = next(b); }
  pts.forEach(r => { let lo2 = 0, hi2 = bins.length - 1; while (lo2 < hi2) { const m = (lo2 + hi2 + 1) >> 1; if (bins[m].a <= r.t) lo2 = m; else hi2 = m - 1; } bins[lo2].n++; });
  return { bins, unit, a: bins[0].a, b: bins[bins.length - 1].b };
}
let MHIST = null;
function mapHist(base) {
  const el = $('#mpHist'), W = Math.max(260, el.clientWidth || 600), H = 70;
  MHIST = binInfo(base);
  if (!MHIST) { el.innerHTML = `<p class="dim">${esc(t('No dated incidents to chart.'))}</p>`; MHIST = null; return; }
  const { bins, a, b } = MHIST, mx = Math.max(...bins.map(x => x.n), 1), sx = t => 6 + (t - a) / (b - a) * (W - 12), t0 = MAP.t0 == null ? -Infinity : MAP.t0, t1 = MAP.t1 == null ? Infinity : MAP.t1;
  MHIST.sx = sx; MHIST.W = W;
  const bars = bins.map(x => { const h = Math.max(x.n ? 1.5 : 0, Math.sqrt(x.n / mx) * (H - 18)), on = x.b > t0 && x.a <= t1; return `<rect class="mp-bar${on ? ' on' : ''}" x="${sx(x.a).toFixed(1)}" y="${(H - 14 - h).toFixed(1)}" width="${Math.max(1, sx(x.b) - sx(x.a) - 0.6).toFixed(1)}" height="${h.toFixed(1)}"/>`; }).join('');
  const yrs = []; const y0 = new Date(a * 864e5).getUTCFullYear(), y1 = new Date(b * 864e5).getUTCFullYear(), stp = y1 - y0 > 30 ? 10 : y1 - y0 > 12 ? 5 : y1 - y0 > 4 ? 2 : 1;
  for (let y = Math.ceil(y0 / stp) * stp; y <= y1; y += stp) { const t = Date.UTC(y, 0, 1) / 864e5; if (t >= a && t <= b) yrs.push(`<text class="mp-ax" x="${sx(t).toFixed(1)}" y="${H - 2}" text-anchor="middle">${fy(y)}</text>`); }
  if (y1 === y0 || (b - a) < 400) yrs.push(`<text class="mp-ax" x="6" y="${H - 2}">${fmtDate(dayIso(a))}</text><text class="mp-ax" x="${W - 6}" y="${H - 2}" text-anchor="end">${fmtDate(dayIso(b - 1))}</text>`);
  const br = MAP.t0 != null ? `<rect class="mp-brush" x="${sx(MAP.t0).toFixed(1)}" y="0" width="${Math.max(2, sx(MAP.t1 + 1) - sx(MAP.t0)).toFixed(1)}" height="${H - 14}"/>` : '';
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t('Incidents over time. Drag to choose a period, or use the date fields.'))}"><g>${bars}${br}${yrs.join('')}</g></svg>`;
  const ta = $('#mpT0'), u = $('#mpT1');
  ta.min = u.min = dayIso(a); ta.max = u.max = dayIso(b - 1);
  ta.value = MAP.t0 == null ? '' : dayIso(MAP.t0); u.value = MAP.t1 == null ? '' : dayIso(MAP.t1);
}
function mapList() {
  const rows = MVIS.slice().sort((a, b) => (b.kl - a.kl) || (a.t - b.t));
  $('#mpListN').textContent = t('{a} of {b}', { a: nf(Math.min(MAP.shown, rows.length)), b: nf(rows.length) });
  $('#mpList').innerHTML = rows.slice(0, MAP.shown).map(r => `<li><button type="button" class="mp-li" data-ri="${r.i}"><span class="mono">${esc(rowDate(r))}</span><b>${esc(rp(r))}</b><span>${esc(t(KIND_NAME[r.kind] || r.kind))}${r.kl > 0 ? ', ' + esc(t('{n} killed', { n: r.kt || nf(r.kl) })) : ''}${r.area ? ', ' + esc(t('district level')) : ''}</span></button></li>`).join('') || `<li class="hub-empty">${esc(t('No incidents match these filters.'))}</li>`;
  $('#mpListMore').hidden = rows.length <= MAP.shown;
}
function mapAcledAgg() {
  if (!ACL) return;
  const t0 = MAP.t0 == null ? -Infinity : MAP.t0, t1 = MAP.t1 == null ? Infinity : MAP.t1, by = {};
  ACL.rows.forEach(r => {
    const a = dayNumM(r[1]), b = dayNumM(r[1] + '-28');
    if (b < t0 || a > t1) return;
    const e = by[r[0]] || (by[r[0]] = { n: 0, f: 0 }); e.n += r[3]; e.f += r[4];
  });
  MAC = ACL.places.map((p, i) => ({ name: p[0] + (p[1] ? ' (' + p[1] + ')' : ''), x: p[2], y: p[3], n: by[i] ? by[i].n : 0, f: by[i] ? by[i].f : 0 }));
}
function mapUpdate(opts = {}) {
  const base = mapFilter();
  mapAcledAgg();
  mapStats(base);
  mapHist(base);
  mapList();
  if (opts.draw !== false) mapRedraw();
  $$('#mpWar [data-war]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.war === MAP.war)));
  $$('#mpKinds [data-kind]').forEach(b => b.setAttribute('aria-pressed', String(MAP.kinds.has(b.dataset.kind))));
  $$('#mpMode [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === MAP.mode)));
  const ac = $('#mpAcNote'); if (ac) ac.hidden = !MAP.acled;
  const kc = {}; warRows().forEach(r => { kc[r.kind] = (kc[r.kind] || 0) + 1; });
  $$('#mpKinds [data-kind]').forEach(b => { b.querySelector('.ct').textContent = nf(kc[b.dataset.kind] || 0); });
}

/* ---------- incident card ---------- */
const Q_NOTE = { 1: N('Placed at the centre of its administrative unit, not at the village.'), 2: N('Inferred: several villages share this name, so it is placed in the one nearest the front line of that war. Treat as approximate.'), 3: N('The spelling matched a place in the stated district only approximately.') };
function mapCardHTML(r) {
  const p = r.pl >= 0 ? MPLACES[r.pl] : null;
  const toll = [r.kl >= 0 ? t('{n} killed', { n: r.kt || nf(r.kl) }) : '', r.inj ? t('{n} injured', { n: r.inj }) : ''].filter(Boolean).join(', ') || t('not stated in the source');
  const note = p && p.ap ? Q_NOTE[1] : Q_NOTE[r.q] || '';
  const row = (k, v) => v ? `<div class="af-r"><span class="k">${esc(t(k))}</span><span>${v}</span></div>` : '';
  return `<div class="evc-top"><span class="k">${esc(t('Incident'))}</span><button type="button" class="yc-x" data-mapclose="1" aria-label="${esc(t('Close the incident card'))}">×</button></div>
    <h4 id="mcH" tabindex="-1">${r.ti ? th(r.ti) : esc(rp(r))}</h4>
    <div class="d-ans">${row('Date', esc(rowDate(r)))}${row('Place', esc(rp(r)) + (p && p.d ? ', ' + esc(p.d) : '') + (r.pn ? ` <span class="dim">(${esc(t('source: {s}', { s: r.pn }))})</span>` : '') + (r.area ? ` <span class="dim">(${esc(t('district level, not drawn'))})</span>` : ''))}
      ${row('Kind', esc(t(KIND_NAME[r.kind] || r.kind)) + (r.n > 1 ? ', ' + esc(t('{n} strikes', { n: nf(r.n) })) : ''))}${row('Toll', esc(toll))}${row('Actor', esc(r.actor))}${row('Target', th(r.tg))}${row('War', esc(t(WAR_NAME[r.war] || r.war)))}
      ${row('Source', r.u ? `<a href="${esc(r.u)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(r.u))}</a>${cf(r.c)}` : esc(t('none')) + cf(r.c))}${note ? row('Location', esc(t(note))) : ''}</div>
    ${r.ev && EVBY[r.ev] ? `<p class="mp-open"><button type="button" class="chip" data-mapev="${esc(r.ev)}">${esc(t('Open in timeline'))}</button></p>` : ''}`;
}
function openMapCard(r, back) {
  const c = $('#mapCard');
  MAP.sel = r.i; MAP.back = back || null;
  c.innerHTML = mapCardHTML(r); c.hidden = false; c.scrollTop = 0;
  c.setAttribute('aria-labelledby', 'mcH');
  $('#mcH', c).focus({ preventScroll: true });
  $$('#mpPts circle.sel').forEach(n => n.classList.remove('sel'));
  const m = $(`#mpPts circle[data-i="${r.i}"]`); if (m) m.classList.add('sel');
}
function closeMapCard(opts = {}) {
  const c = $('#mapCard');
  if (!c || c.hidden) return;
  c.hidden = true; c.innerHTML = ''; MAP.sel = null;
  $$('#mpPts circle.sel').forEach(n => n.classList.remove('sel'));
  const b = MAP.back; MAP.back = null;
  if (opts.focus !== false && b && document.contains(b)) b.focus({ preventScroll: true });
}

/* ---------- build the panel once, wire events ---------- */
function mapBuild() {
  const root = $('#mapRoot');
  const warChips = WAR_GROUPS.map(g => `<button type="button" class="chip mp-wc" data-war="${g.id}" aria-pressed="false" style="--lc:var(--mw-${g.css})"><span class="sw"></span>${esc(t(g.label))}</button>`).join('');
  const kinds = Object.keys(KIND_NAME).map(k => `<button type="button" class="chip sm-c" data-kind="${k}" aria-pressed="false">${esc(t(KIND_NAME[k]))} <span class="ct">0</span></button>`).join('');
  root.innerHTML = `<div class="mp">
    <div class="chips" id="mpWar" role="group" aria-label="${esc(t('War'))}">${warChips}</div>
    <p class="mp-note" id="mpNote"></p>
    <div class="mp-toll" id="mpToll"></div>
    <div class="mp-grid">
      <div class="mp-main">
        <div class="mp-tools">
          <label class="vh" for="mpQ">${esc(t('Search places'))}</label><input id="mpQ" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Search a place: Khiam, Qana, Dahieh'))}" value="${esc(MAP.q)}">
          <div class="mp-seg" id="mpMode" role="group" aria-label="${esc(t('Map style'))}"><button type="button" class="chip sm-c" data-mode="auto" aria-pressed="true">${esc(t('Auto'))}</button><button type="button" class="chip sm-c" data-mode="points" aria-pressed="false">${esc(t('Points'))}</button><button type="button" class="chip sm-c" data-mode="hex" aria-pressed="false">${esc(t('Density'))}</button></div>
        </div>
        <div class="chips sm mp-kinds" id="mpKinds" role="group" aria-label="${esc(t('Kind of incident'))}">${kinds}</div>
        <div class="mp-stage" id="mpStage" data-mode="" tabindex="-1">
          <svg class="mp-svg" id="mpSvg" role="img" aria-label="${esc(t('Map of Lebanon with documented incidents. The list below the map gives the same incidents as buttons.'))}"><g id="mpG"><g class="mp-d2">${GEO.adm2.map(a => `<path d="${a.d}"/>`).join('')}</g><g class="mp-d1">${GEO.adm1.map(a => `<path d="${a.d}"/>`).join('')}</g></g><g id="mpAc"></g><g id="mpPts"></g><g id="mpLb"></g></svg>
          <canvas class="mp-cv" id="mpCv" hidden></canvas>
          <div class="mp-zoom"><button type="button" class="chip" data-z="1.6" aria-label="${esc(t('Zoom in'))}">+</button><button type="button" class="chip" data-z="0.625" aria-label="${esc(t('Zoom out'))}">−</button><button type="button" class="chip" data-z="0" aria-label="${esc(t('Reset the view'))}">${esc(t('Reset'))}</button></div>
          <div class="mp-tip" id="mpTip" role="tooltip" hidden></div>
        </div>
        <p class="mp-hint">${esc(t('Circle size shows documented killed. Dots at one place are fanned out around it, so their position is the place, not the exact spot. Drag to move, scroll or use + and − to zoom.'))}</p>
      </div>
      <aside class="mp-side" aria-label="${esc(t('Counts for the current view'))}">
        <dl class="mp-stats" id="mpStats"></dl>
        <div id="mpMore" class="mp-more"></div>
        <h3 class="d-h">${esc(t('Top places'))}</h3><ul class="mp-top" id="mpTop"></ul>
        ${ACL ? `<label class="mp-chk"><input type="checkbox" id="mpAcOn"${MAP.acled ? ' checked' : ''}> ${esc(t('ACLED layer (events per place, rings)'))}</label><p class="mp-ac-note" id="mpAcNote" hidden>${esc(ACL.attribution)}</p>` : ''}
        <label class="mp-chk"><input type="checkbox" id="mpInf"${MAP.inferred ? ' checked' : ''}> ${esc(t('Show placements inferred from the front line'))}</label>
      </aside>
    </div>
    <div class="mp-time"><div class="mp-dates"><label class="sel" for="mpT0">${esc(t('From'))} <input type="date" id="mpT0"></label><label class="sel" for="mpT1">${esc(t('To'))} <input type="date" id="mpT1"></label><button type="button" class="chip" id="mpTR">${esc(t('Whole period'))}</button></div><div id="mpHist" class="mp-hist"></div></div>
    <h3 class="d-h">${esc(t('Incidents matching these filters'))} <span class="mono dim" id="mpListN"></span></h3>
    <ul class="mp-list" id="mpList"></ul><button type="button" class="chip" id="mpListMore" hidden>${esc(t('Show more'))}</button>
    <div id="mapCard" class="ycard evcard" role="dialog" aria-label="${esc(t('Incident detail'))}" hidden></div></div>`;
  mapColors();
  const st = $('#mpStage');
  // pointer: hover tooltip, click opens the card, drag pans
  let drag = null;
  st.addEventListener('pointerdown', ev => { if (ev.target.closest('.mp-zoom')) return; drag = { x: ev.clientX, y: ev.clientY, tx: MAP.tx, ty: MAP.ty, moved: false }; try { st.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic event */ } });
  st.addEventListener('pointermove', ev => {
    const b = st.getBoundingClientRect(), px = ev.clientX - b.left, py = ev.clientY - b.top;
    if (drag) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { MAP.tx = drag.tx + dx; MAP.ty = drag.ty + dy; mapRedraw(); mapTip(null); return; }
    }
    mapTip(mapHit(px, py), px, py);
  });
  st.addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
  st.addEventListener('pointerleave', () => mapTip(null));
  st.addEventListener('click', ev => {
    if (ev.target.closest('.mp-zoom') || (drag && drag.moved)) return;
    const b = st.getBoundingClientRect(), e = mapHit(ev.clientX - b.left, ev.clientY - b.top);
    if (!e) { closeMapCard({ focus: false }); return; }
    if (e.hex) { mapZoom(3, e.x, e.y); return; }
    if (e.ac) return;
    openMapCard(e.row, st);
  });
  st.addEventListener('wheel', ev => { ev.preventDefault(); const b = st.getBoundingClientRect(); mapZoom(ev.deltaY < 0 ? 1.25 : 0.8, ev.clientX - b.left, ev.clientY - b.top); }, { passive: false });
  $('.mp-zoom', st).addEventListener('click', ev => {
    const z = ev.target.closest('[data-z]'); if (!z) return;
    if (+z.dataset.z === 0) { mapFit(true); mapRedraw(); } else mapZoom(+z.dataset.z);
  });
  const setWar = id => { MAP.war = id; MAP.t0 = MAP.t1 = null; MAP.shown = 25; mapUpdate(); };
  $('#mpWar').addEventListener('click', ev => { const b = ev.target.closest('[data-war]'); if (b) setWar(b.dataset.war); });
  $('#mpKinds').addEventListener('click', ev => { const b = ev.target.closest('[data-kind]'); if (!b) return; MAP.kinds.has(b.dataset.kind) ? MAP.kinds.delete(b.dataset.kind) : MAP.kinds.add(b.dataset.kind); mapUpdate(); });
  $('#mpMode').addEventListener('click', ev => { const b = ev.target.closest('[data-mode]'); if (b) { MAP.mode = b.dataset.mode; mapUpdate(); } });
  let qt = null;
  $('#mpQ').addEventListener('input', ev => { clearTimeout(qt); qt = setTimeout(() => { MAP.q = ev.target.value; MAP.shown = 25; mapUpdate(); }, 140); });
  $('#mpInf').addEventListener('change', ev => { MAP.inferred = ev.target.checked; mapUpdate(); });
  const ac = $('#mpAcOn'); if (ac) ac.addEventListener('change', ev => { MAP.acled = ev.target.checked; mapUpdate(); });
  $('#mpTop').addEventListener('click', ev => { const b = ev.target.closest('[data-place]'); if (!b) return; $('#mpQ').value = b.dataset.place; MAP.q = b.dataset.place; mapUpdate(); });
  const dates = () => { const a = $('#mpT0').value, b = $('#mpT1').value; MAP.t0 = a ? dayNumM(a) : (b ? MSPAN[0] : null); MAP.t1 = b ? dayNumM(b) : (a ? MSPAN[1] : null); if (MAP.t0 != null && MAP.t1 < MAP.t0) MAP.t1 = MAP.t0; mapUpdate(); };
  $('#mpT0').addEventListener('change', dates); $('#mpT1').addEventListener('change', dates);
  $('#mpTR').addEventListener('click', () => { MAP.t0 = MAP.t1 = null; mapUpdate(); });
  $('#mpListMore').addEventListener('click', () => { MAP.shown += 25; mapList(); });
  $('#mpList').addEventListener('click', ev => { const b = ev.target.closest('[data-ri]'); if (b) openMapCard(MROWS[+b.dataset.ri], b); });
  $('#mapCard').addEventListener('click', ev => {
    if (ev.target.closest('[data-mapclose]')) { closeMapCard(); return; }
    const o = ev.target.closest('[data-mapev]');
    if (o) { const id = o.dataset.mapev; closeMapCard({ focus: false }); hubShow('timeline', { push: true }); window.scrollTo(0, 0); requestAnimationFrame(() => openEventCard(id)); }
  });
  // time brush on the histogram
  const hist = $('#mpHist');
  let br = null;
  const tAt = x => { const h = MHIST; if (!h) return 0; return h.a + Math.max(0, Math.min(1, (x - 6) / (h.W - 12))) * (h.b - h.a); };
  hist.addEventListener('pointerdown', ev => { if (!MHIST) return; const b = hist.getBoundingClientRect(); br = { x: ev.clientX - b.left, cur: ev.clientX - b.left, moved: false }; try { hist.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ } });
  hist.addEventListener('pointermove', ev => { if (!br) return; const b = hist.getBoundingClientRect(); br.cur = ev.clientX - b.left; if (Math.abs(br.cur - br.x) > 4) br.moved = true; });
  hist.addEventListener('pointerup', () => {
    if (!br) return;
    if (br.moved) { const a = Math.floor(Math.min(tAt(br.x), tAt(br.cur))), z = Math.floor(Math.max(tAt(br.x), tAt(br.cur))); MAP.t0 = a; MAP.t1 = Math.max(a, z); } else { MAP.t0 = MAP.t1 = null; }
    br = null; mapUpdate();
  });
  if (MAP.wired) return;  // page-level listeners are added once, even when the panel is rebuilt for a language change
  MAP.wired = true;
  window.addEventListener('resize', () => { if (hubTab === 'map' && MAP.built) { clearTimeout(MAP.rt); MAP.rt = setTimeout(() => { mapFit(); mapUpdate(); }, 140); } });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && hubTab === 'map' && $('#mapCard') && !$('#mapCard').hidden) { ev.preventDefault(); closeMapCard(); } });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (MAP.built) { mapColors(); mapRedraw(); } }); } catch (e) { /* old browser */ }
  new MutationObserver(() => { if (MAP.built) { mapColors(); mapRedraw(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
function renderMap(args, info) {
  const root = $('#mapRoot');
  if (!root) return;
  if (!(D.tabs && D.tabs.map && D.tabs.map.has)) return;  // this build has no strike data: the empty state in the page stays
  if (MAP.built && !(info && info.lang)) { mapFit(); mapColors(); mapUpdate(); return; }
  hubLoadInto(root, ['data/strikes/strikes.json', 'data/strikes/geo.json', 'data/strikes/tolls.json'], (strikes, geo, tl) => {
    SK = strikes; GEO = geo; ACL = strikes.acled || null; TOLLS = (tl && tl.tolls) || [];
    if (!MROWS.length) mapDecode();
    MAP.sel = null; MAP.back = null;
    mapBuild();
    mapFit();
    mapColors();
    MAP.built = true;
    mapUpdate();
  });
}
HUB.tab('map', { render: renderMap });
