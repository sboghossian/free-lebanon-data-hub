/* ------------------------------------------------------------ v4 filters: one predicate, passes(e), used by every zoom, the list and the matrix */
const TYPE_GROUPS = [
  [N('Conflict'), ['war', 'battle', 'attack', 'assassination', 'massacre', 'ceasefire', 'occupation', 'withdrawal']],
  [N('Governance'), ['election', 'government', 'resignation', 'vacuum', 'decree', 'diplomacy', 'visit']],
  [N('Law and agreements'), ['agreement', 'un_resolution', 'law', 'court', 'decision']],
  [N('Economy'), ['crisis', 'currency', 'banking', 'budget', 'aid', 'investment', 'trade']],
  [N('Society'), ['protest', 'strike', 'migration', 'refugees', 'health', 'education', 'demography', 'culture', 'sport', 'media']],
  [N('Tech'), ['tech_launch', 'telecom', 'ai', 'science']],
  [N('Environment'), ['environment', 'energy', 'disaster', 'infrastructure']],
  [N('Other'), ['life', 'other']],
];
const TYPE_W = { un_resolution: N('UN resolution'), tech_launch: N('tech launch'), ai: N('AI'), life: N('life in Lebanon') };
const typeName = ty => t(TYPE_W[ty] || ty.replace(/_/g, ' '));
const F = { q: '', types: new Set(), actors: new Set(), places: new Set(), pres: '', pm: '', gov: '', era: '', gr: new Set(), from: null, to: null, preset: null, cite: null };
let QP = { words: [], f: [] };
const ERAS = D.eras.map((e, i) => ({ ...e, i }));
const VAC = ERAS.filter(e => e.kind === 'vacuum');
const CONFLICT_ERAS = ERAS.filter(e => ['war', 'occupation', 'vacuum'].includes(e.kind));

// Precompute everything the predicate reads, once.
EV.forEach(e => {
  const [a, b] = periodOf(e);
  e._a = a; e._b = b; e._y0 = +a.slice(0, 4); e._y1 = +b.slice(0, 4);
  e._ty = (e.ty || []).concat(e.lanes.includes('life') ? ['life'] : []);
  e._ac = e.ac || [];
  e._PN = overlapHolders('P', a, b).map(o => o.name);
  e._PMN = overlapHolders('PM', a, b).map(o => o.name);
  e._GN = overlapHolders('G', a, b).map(o => o.name);
  e._SN = overlapHolders('S', a, b).map(o => o.name);
  e._AN = overlapHolders('A', a, b).map(o => o.name);
  const ag = e.ag ? [e.ag.n, (e.ag.pa || []).join(' '), e.ag.k, e.ag.st].join(' ') : '';
  const laws = [e.law].concat(e.parts.map(p => p.law)).filter(Boolean).join(' ');
  e._law = nrm(laws + ' ' + (e.ag && e.ag.law || ''));
  e._agr = nrm(ag);
  e._hay = nrm([e.title, e.parts.map(p => [p.title, p.why, p.who].join(' ')).join(' '), e._ac.join(' '), e.pl, laws, ag, e._ty.join(' '),
    e.lanes.map(l => LN[l] ? LN[l].name : l).join(' ')].join(' '));
});
const COUNT = { type: {}, actor: {}, place: {}, gr: {} };
EV.forEach(e => {
  e._ty.forEach(t => { COUNT.type[t] = (COUNT.type[t] || 0) + 1; });
  e._ac.forEach(t => { COUNT.actor[t] = (COUNT.actor[t] || 0) + 1; });
  if (e.pl) COUNT.place[e.pl] = (COUNT.place[e.pl] || 0) + 1;
  COUNT.gr[e.gr] = (COUNT.gr[e.gr] || 0) + 1;
});
// Types the grouping does not name go to Other, so nothing is unreachable.
Object.keys(COUNT.type).forEach(t => { if (!TYPE_GROUPS.some(g => g[1].includes(t))) TYPE_GROUPS[TYPE_GROUPS.length - 1][1].push(t); });
const ACTORS = Object.entries(COUNT.actor).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1));
const PLACES = Object.entries(COUNT.place).sort((p, q) => q[1] - p[1]);

function parseQ(q) {
  const out = { words: [], f: [] };
  const rest = String(q || '').replace(/([A-Za-z]+):(?:"([^"]*)"|(\S+))/g, (m, k, qv, pv) => { out.f.push([k.toLowerCase(), nrm(qv != null ? qv : pv)]); return ' '; });
  rest.replace(/"([^"]+)"|(\S+)/g, (m, a, b) => { out.words.push(nrm(a || b)); return ''; });
  return out;
}
const anyHas = (list, v) => list.some(x => nrm(x).includes(v));
function fieldOk(e, k, v) {
  if (!v) return true;
  switch (k) {
    case 'president': case 'pres': return anyHas(e._PN, v);
    case 'pm': case 'prime': return anyHas(e._PMN, v);
    case 'bdl': case 'gov': case 'governor': return anyHas(e._GN, v);
    case 'speaker': return anyHas(e._SN, v);
    case 'army': case 'commander': return anyHas(e._AN, v);
    case 'type': return e._ty.some(t => t === v || t.startsWith(v) || nrm(typeName(t)) === v);
    case 'actor': return anyHas(e._ac, v);
    case 'place': return nrm(e.pl).includes(v);
    case 'law': return e._law.includes(v);
    case 'agreement': case 'treaty': return e._agr.includes(v) || (e._ty.includes('agreement') && nrm(e.title).includes(v));
    case 'year': return +v >= e._y0 && +v <= e._y1;
    case 'from': return e._y1 >= +v;
    case 'to': return e._y0 <= +v;
    case 'lane': case 'track': return e.lanes.some(l => l === v || nrm(LN[l] ? LN[l].name : '').startsWith(v));
    case 'tag': return e.c.startsWith(v);
    default: return e._hay.includes(k + ':' + v) || e._hay.includes(v);
  }
}
const eraHit = (e, er) => e._a <= er.end && e._b >= er.start;
function passes(e) {
  if (F.cite && !e.parts.some(p => p.u === F.cite)) return false;
  if (F.types.size && !e._ty.some(t => F.types.has(t))) return false;
  if (F.actors.size && !e._ac.some(a => F.actors.has(a))) return false;
  if (F.places.size && !F.places.has(e.pl || '')) return false;
  if (F.pres && !e._PN.includes(F.pres)) return false;
  if (F.pm && !e._PMN.includes(F.pm)) return false;
  if (F.gov && !e._GN.includes(F.gov)) return false;
  if (F.era !== '' && !eraHit(e, ERAS[+F.era])) return false;
  if (F.gr.size && !F.gr.has(e.gr)) return false;
  if (F.from != null && e._y1 < F.from) return false;
  if (F.to != null && e._y0 > F.to) return false;
  if (F.preset && PRESET[F.preset].test && !PRESET[F.preset].test(e)) return false;
  for (const [k, v] of QP.f) if (!fieldOk(e, k, v)) return false;
  for (const w of QP.words) if (!e._hay.includes(w) && !(e._hayT && e._hayT.includes(w))) return false;
  return true;
}
function filtersOn() {
  return !!(F.q.trim() || F.types.size || F.actors.size || F.places.size || F.pres || F.pm || F.gov || F.era !== '' || F.gr.size || F.from != null || F.to != null || F.preset || F.cite);
}
// Events that pass the filters over the whole century (ignoring the zoom), respecting tracks, tag and an explicit weight.
const matchAll = () => EV.filter(e => passes(e) && confOk(e) && e.lanes.some(laneOn) && e.w >= (TL.minW[TL.zoom === 'dec' ? 'dec' : TL.zoom] || 1));
const rngLabel = () => TL.rng ? t('{a} to {b}', { a: fy(Math.round(TL.rng[0])), b: fy(Math.min(2026, Math.ceil(TL.rng[1]) - 1)) }) : '';
function fitRange(a, b) {
  a = Math.max(1800, a); b = Math.min(NOW_T + 0.05, b);
  if (b - a < 3) { const m = (a + b) / 2; a = Math.max(1800, m - 1.5); b = Math.min(NOW_T + 0.05, a + 3); }
  if (TL_ONLY && a <= 1801 && b > 2020) { TL.zoom = '1800'; TL.rng = null; }
  else if (a <= 1921 && b > 2020) { TL.zoom = '100y'; TL.rng = null; }
  else { TL.zoom = 'rng'; TL.rng = [a, b]; }
  TL.dec = null; TL.hiLane = null;
}
// After a filter change, zoom out (or in) so the matches are on screen.
function autoFit() {
  if (!filtersOn()) return;
  const qy = QP.f.filter(([k]) => ['year', 'from', 'to'].includes(k)).map(([k, v]) => [k, parseInt(v, 10)]).filter(([, v]) => v >= 1800 && v <= 2026);
  if (qy.length) {
    const yr = qy.find(([k]) => k === 'year'), fr = qy.find(([k]) => k === 'from'), to = qy.find(([k]) => k === 'to');
    if (yr) fitRange(yr[1] - 1, yr[1] + 2); else fitRange(fr ? fr[1] : 1800, (to ? to[1] : 2026) + 1);
    return;
  }
  const m = matchAll();
  if (!m.length) return;
  let a = Math.min(...m.map(e => e.t)), b = Math.max(...m.map(e => e.t));
  if (F.from != null) a = Math.min(a, F.from);
  if (F.to != null) b = Math.max(b, F.to + 0.99);
  const z = zc();
  if (a >= z.x0 && b <= z.x1 && (b - a) > (z.x1 - z.x0) * 0.35) return;
  fitRange(Math.floor(a) - (b - a > 30 ? 2 : 1), Math.ceil(b) + 1);
}

/* ---- pattern presets: each sets filters, zoom and bands, with a one-line caption */
const CONFLICT_T = ['war', 'battle', 'attack', 'massacre', 'occupation', 'ceasefire', 'withdrawal'];
const PRESET = {
  assassinations: { types: ['assassination'], zoom: TL_ONLY ? '1800' : '100y', cap: N('Every assassination and attempt on record, against the war, occupation and vacuum shading.'), inside: true },
  agreements: { test: e => !!e.ag || e._ty.includes('agreement'), lanesOn: ['agree'], zoom: TL_ONLY ? '1800' : '100y', cap: N('Every treaty, accord, ceasefire, loan and UN resolution in the agreements list. On the Agreements track the shape shows the kind.') },
  currency: { types: ['currency'], zoom: '1950', bands: ['lbp', 'infl'], cap: N('Currency events over the exchange rate and inflation bands.') },
  wars: { types: CONFLICT_T, zoom: TL_ONLY ? '1800' : '100y', bands: ['gdppc', 'infl', 'gdpusd'], cap: N('Conflict events with GDP per capita, inflation and GDP underneath, to read what the economy did in the years after.') },
  banking: { test: e => e._ty.includes('banking') || (e._ty.some(t => ['law', 'decree', 'crisis', 'court'].includes(t)) && /\bbank/.test(e._hay)), zoom: '100y', bands: ['lbp', 'debt'], cap: N('Banking laws, central-bank rules and bank crises, with the exchange rate and public debt underneath.') },
  leaving: { types: ['migration', 'refugees', 'demography'], zoom: TL_ONLY ? '1800' : '100y', bands: ['pop', 'emig', 'refug'], cap: N('Migration, refugee and population events over the people bands: modelled net migration, registered refugees and population.') },
  fell: { test: e => e._ty.includes('resignation') || (e._ty.includes('government') && /resign|collapse|fell|fall of|toppl|caretaker|dismiss|quit/.test(nrm(e.title))), zoom: '100y', strips: ['PM'], cap: N('Prime ministers and governments that resigned or collapsed, with the prime-minister strip on.') },
  firsts: { test: e => (e.lanes.includes('tech') || e._ty.some(t => ['tech_launch', 'telecom', 'ai', 'science'].includes(t))) && /\bfirst\b|launch|opens|introduc|founded|begins/.test(nrm(e.title)), zoom: '100y', cap: N('Technology events whose title marks a first, a launch or an opening.') },
  vacuums: { test: e => VAC.some(v => eraHit(e, v)), zoom: 'rng', rng: [1986, NOW_T + 0.05], strips: ['PM'], cap: N('Events dated inside the presidential vacuums, when a cabinet held or claimed the president\'s powers.'), vac: true },
  life: { types: ['life'], zoom: '100y', bands: ['pop', 'bigmac', 'bread', 'petrol'], cap: N('Daily life: festivals, firsts, habits and prices. Light facts, each with its source.') },
};
function clearFilters() {
  F.q = ''; F.types.clear(); F.actors.clear(); F.places.clear(); F.pres = ''; F.pm = ''; F.gov = ''; F.era = ''; F.gr.clear();
  F.from = null; F.to = null; F.preset = null; F.cite = null; QP = parseQ('');
  const q = $('#q'); if (q) q.value = '';
}
function applyPreset(k) {
  const p = PRESET[k];
  if (F.preset === k) { clearFilters(); saveF(); return; }
  clearFilters();
  F.preset = k; TL.claim = null;
  (p.types || []).forEach(t => F.types.add(t));
  (p.lanesOn || []).forEach(l => { TL.off.delete(l); TL.on.add(l); });
  (p.strips || []).forEach(s => TL.strips.add(s));
  if (p.bands) TL.bands = new Set(p.bands);
  if (p.zoom === 'rng') { TL.zoom = 'rng'; TL.rng = p.rng.slice(); } else { TL.zoom = p.zoom; TL.rng = null; }
  TL.dec = null; TL.hiLane = null;
  saveF();
}
// What the pattern shows in numbers: count, busiest decades, and for some presets the share inside conflict or vacuum periods.
function presetStats(k) {
  const m = matchAll();
  if (!m.length) return t('No events match.');
  const dec = {};
  m.forEach(e => { const d = Math.floor(e.t / 10) * 10; dec[d] = (dec[d] || 0) + 1; });
  const top = Object.entries(dec).sort((p, q) => q[1] - p[1]).slice(0, 2).map(([d, n]) => `${d}s (${nf(n)})`).join(', ');
  let s = tp('{n} event; busiest decades: {top}.', '{n} events; busiest decades: {top}.', m.length, { top });
  if (PRESET[k].inside) {
    const n = m.filter(e => CONFLICT_ERAS.some(er => eraHit(e, er))).length;
    s += ' ' + t('{n} of {m} fall inside a war, occupation or vacuum period.', { n: nf(n), m: nf(m.length) });
  }
  if (PRESET[k].vac) s += ' ' + t('Vacuums: {v}.', { v: VAC.map(v => `${fy(v.start.slice(0, 4))}-${fy(v.end.slice(0, 4))}`).join(', ') });
  return s;
}

/* ---- persistence of the last filter (per viewer, optional) */
function saveF() {
  if (TL_ONLY) return;  // the dossier keeps its own saved filter; this page starts clean every time
  const o = { q: F.q, types: [...F.types], actors: [...F.actors], places: [...F.places], pres: F.pres, pm: F.pm, gov: F.gov, era: F.era, gr: [...F.gr], from: F.from, to: F.to, preset: F.preset };
  store.set('mitai-v4-filter', JSON.stringify(o));
}
function loadF() {
  let o = null;
  try { o = JSON.parse(store.get('mitai-v4-filter') || 'null'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') return;
  F.q = String(o.q || ''); QP = parseQ(F.q);
  ['types', 'actors', 'places', 'gr'].forEach(k => (Array.isArray(o[k]) ? o[k] : []).forEach(v => F[k].add(String(v))));
  ['pres', 'pm', 'gov', 'era'].forEach(k => { F[k] = o[k] == null ? '' : String(o[k]); });
  F.from = Number.isFinite(o.from) ? o.from : null; F.to = Number.isFinite(o.to) ? o.to : null;
  F.preset = PRESET[o.preset] ? o.preset : null;
  const q = $('#q'); if (q) q.value = F.q;
  if (filtersOn()) autoFit();
}

/* ---- the filter bar and drawer */
const chip = (attrs, label, n, on) => `<button type="button" class="chip sm-c" ${attrs} aria-pressed="${on}">${esc(label)}${n != null ? `<span class="ct">${nf(n)}</span>` : ''}</button>`;
function holderOptions(code) {
  const by = {};
  (OFFS[code] || []).forEach(o => { if (o.name === 'Vacuum' && code !== 'P') return; (by[o.name] = by[o.name] || []).push(o); });
  return `<option value="">${esc(t('anyone'))}</option>` + Object.entries(by).map(([n, l]) => `<option value="${esc(n)}">${esc(n === 'Vacuum' ? t('No president (vacuum)') : n)} (${l.map(yrs).join(', ')})</option>`).join('');
}
function initFilterUI() {
  $('#presSel').innerHTML = holderOptions('P');
  $('#pmSel').innerHTML = holderOptions('PM');
  $('#govSel').innerHTML = holderOptions('G');
  const kinds = [['war', N('Wars')], ['occupation', N('Occupations')], ['vacuum', N('Vacuums')], ['pres', N('Presidencies')], ['period', N('Periods')], ['money', N('Money and tech')]];
  $('#eraSel').innerHTML = `<option value="">${esc(t('any period'))}</option>` + kinds.map(([k, l]) => `<optgroup label="${esc(t(l))}">${ERAS.filter(e => e.kind === k).map(e => `<option value="${e.i}">${esc(tc(e.label))} (${fy(e.start.slice(0, 4))}-${e.ongoing ? esc(t('now')) : fy(e.end.slice(0, 4))})</option>`).join('')}</optgroup>`).join('');
}
function renderFilters(evs) {
  $('#typeCtl').innerHTML = TYPE_GROUPS.map(([g, ts]) => `<div class="tg"><span class="k">${esc(t(g))}</span><div class="chips sm">${ts.filter(t => COUNT.type[t]).map(t => chip(`data-type="${t}"`, typeName(t), COUNT.type[t], F.types.has(t))).join('')}</div></div>`).join('');
  const aq = nrm(($('#actorQ') || {}).value || '');
  const al = aq ? ACTORS.filter(([a]) => nrm(a).includes(aq)).slice(0, 40) : ACTORS.slice(0, 40);
  [...F.actors].forEach(a => { if (!al.some(x => x[0] === a)) al.unshift([a, COUNT.actor[a] || 0]); });
  $('#actorCtl').innerHTML = al.map(([a, n]) => chip(`data-actor="${esc(a)}"`, a, n, F.actors.has(a))).join('') || `<span class="note">${esc(t('No actor matches.'))}</span>`;
  $('#placeCtl').innerHTML = PLACES.map(([p, n]) => chip(`data-place="${esc(p)}"`, p, n, F.places.has(p))).join('');
  $('#grCtl').innerHTML = LEVEL_ORDER.filter(k => COUNT.gr[k]).map(k => chip(`data-gr="${k}" data-tip="${tipA(t(LEVEL[k][1]), ' ' + t(LEVEL[k][2]))}"`, t(LEVEL[k][1]), COUNT.gr[k], F.gr.has(k))).join('');
  $('#stripCtl').innerHTML = [['pres', N('Presidents')], ['PM', N('Prime ministers')], ['G', N('BDL governors')]].concat(RULER_CODES.length ? [['R', N('Rulers, before 1920')]] : []).map(([k, l]) => chip(`data-strip="${k}"`, t(l), null, TL.strips.has(k))).join('');
  $('#presSel').value = F.pres; $('#pmSel').value = F.pm; $('#govSel').value = F.gov; $('#eraSel').value = F.era;
  $('#fromY').value = F.from == null ? '' : F.from; $('#toY').value = F.to == null ? '' : F.to;
  $$('#presets [data-preset]').forEach(b => b.setAttribute('aria-pressed', String(F.preset === b.dataset.preset)));
  const nDr = F.types.size + F.actors.size + F.places.size + F.gr.size + (F.pres ? 1 : 0) + (F.pm ? 1 : 0) + (F.gov ? 1 : 0) + (F.era !== '' ? 1 : 0) + (F.from != null || F.to != null ? 1 : 0);
  $('#moreBtn').textContent = nDr ? t('More filters ({n})', { n: nf(nDr) }) : t('More filters');
  renderActive(evs);
}
// Active filters as removable chips, with the live count and Clear all.
function renderActive(evs) {
  const c = [];
  const add = (rm, label) => c.push(`<button type="button" class="fchip" data-rm="${esc(rm)}" aria-label="${esc(t('Remove filter: {f}', { f: label }))}">${esc(label)}<span aria-hidden="true">×</span></button>`);
  if (F.preset) add('preset', t('Pattern: {v}', { v: ($(`#presets [data-preset="${F.preset}"]`) || { textContent: F.preset }).textContent }));
  if (F.q.trim()) add('q', t('Search: {v}', { v: F.q.trim() }));
  F.types.forEach(ty => add('type:' + ty, t('Type: {v}', { v: typeName(ty) })));
  F.actors.forEach(a => add('actor:' + a, t('Actor: {v}', { v: a })));
  F.places.forEach(p => add('place:' + p, t('Place: {v}', { v: p })));
  if (F.pres) add('pres', t('President: {v}', { v: F.pres === 'Vacuum' ? t('no president') : F.pres }));
  if (F.pm) add('pm', t('PM: {v}', { v: F.pm }));
  if (F.gov) add('gov', t('BDL governor: {v}', { v: F.gov }));
  if (F.era !== '') add('era', t('Period: {v}', { v: tc(ERAS[+F.era].label) }));
  F.gr.forEach(g => add('gr:' + g, t('Trust: {v}', { v: t(LEVEL[g][1]) })));
  if (F.from != null || F.to != null) add('dates', t('Years: {a} to {b}', { a: fy(F.from == null ? 1800 : F.from), b: fy(F.to == null ? 2026 : F.to) }));
  if (F.cite) { const lr = D.lib.find(r => r[0] === F.cite), ct = (lr && lr[1]) || hostOf(F.cite); add('cite', t('Cites: {v}', { v: ct.length > 60 ? ct.slice(0, 58) + '...' : ct })); }
  const el = $('#activeF');
  if (!c.length) { el.innerHTML = ''; el.hidden = true; $('#presetNote').hidden = true; return; }
  el.hidden = false;
  const n = matchAll().length;
  el.innerHTML = `<span class="fcount">${tpH('{n} event matches · {m} in this view', '{n} events match · {m} in this view', n, { n: `<b>${nf(n)}</b>`, m: `<b>${nf(evs.length)}</b>` })}</span>${c.join('')}<button type="button" class="fclear" data-rm="all">${esc(t('Clear all'))}</button>`;
  const pn = $('#presetNote');
  if (F.preset) { pn.hidden = false; pn.innerHTML = `<b>${esc(t(PRESET[F.preset].cap))}</b> ${esc(presetStats(F.preset))}`; } else pn.hidden = true;
}
function removeFilter(rm) {
  const [k, ...rest] = rm.split(':'), v = rest.join(':');
  if (k === 'all') clearFilters();
  else if (k === 'preset') F.preset = null;
  else if (k === 'q') { F.q = ''; QP = parseQ(''); $('#q').value = ''; }
  else if (k === 'type') F.types.delete(v);
  else if (k === 'actor') F.actors.delete(v);
  else if (k === 'place') F.places.delete(v);
  else if (k === 'gr') F.gr.delete(v);
  else if (k === 'dates') { F.from = null; F.to = null; }
  else if (k in F) F[k] = k === 'era' ? '' : (k === 'cite' ? null : '');
  saveF();
}
