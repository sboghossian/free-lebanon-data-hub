/* ------------------------------------------------------------ Places tab (FE-B): search every village and town, a page for each, and the regional sections (elections, war, people).
   Data: data/places/index.json (one row per place), data/places/p/<district>.json (details, strikes, events), data/places/cazas.json, data/geo/lebanon.json.
   Hash: #places, #place/<id>, #elections/<id>/<district>, #war, #people. The other sections are in tab_places_elections.js, tab_places_war.js and tab_places_people.js. */
const PL_SECS = [{ id: 'places', label: N('Places') }, { id: 'elections', label: N('Elections') }, { id: 'war', label: N('The 2023 to 2026 war') }, { id: 'people', label: N('People') }, { id: 'history', label: N('Communities and seats over time') }];
const PL = { sec: 'places', idx: null, q: '', kind: '', caza: '', shown: 24, geo: null, cz: null, layer: '', svcOff: new Set(), byId: {}, tok: 0 };
const PL_KIND = { city: N('city'), town: N('town'), village: N('village'), locality: N('locality'), neighbourhood: N('neighbourhood'), camp: N('camp') };
const PL_WAR = { civil_war: N('Civil war'), 1978: N('1978 invasion'), 1982: N('1982 invasion'), 1993: N('1993 operation'), 1996: N('1996 operation'), 2006: N('2006 war'), '2023_26': N('2023–26 war'), other: N('Other conflict') };
const PL_KINDS_STRIKE = { airstrike: N('Airstrike'), drone_strike: N('Drone strike'), shelling: N('Shelling'), artillery: N('Artillery'), naval: N('Naval'), car_bomb: N('Car bomb'), bombing: N('Bombing'), ground_assault: N('Ground assault'),
  massacre: N('Massacre'), cluster_munition: N('Cluster munition'), white_phosphorus: N('White phosphorus'), explosion: N('Explosion'), other: N('Other') };
const plRow = r => ({ id: r[0], name: r[1], ar: r[2], kind: PL.idx.kinds[r[3]], caza: PL.idx.cazas[r[4]], lat: r[5], lon: r[6], alts: r[7], st: r[8], ev: r[9], _n: fbNrm(r[1] + ' ' + r[7] + dnTerms(r[1])), _a: fbNrm(r[2] + dnTerms(r[1])), _s: fbSk(r[1]) });
const plLink = (id, label, cls) => `<a href="${HUB.href('place', id)}" data-hub="places" data-hash="place/${esc(id)}"${cls ? ` class="${cls}"` : ''}>${label}</a>`;
const plName = r => dnName(r.name, r.ar);
const plAr = r => dnAr(r.name, r.ar);
const plOther = r => DN[r.name] ? DN[r.name].en : r.name;
const plGov = g => { const a = PL.geo && PL.geo.adm1.find(x => x.n === g); return (LANG === 'ar' && a && a.ar) || g; };
const plCaza = c => (LANG === 'ar' && PL.cazaByCode && PL.cazaByCode[c.p] && PL.cazaByCode[c.p].ar) || c.n;
const plSub = r => `${t(PL_KIND[r.kind] || r.kind)} · ${plCaza(r.caza)}`;
function plScore(r, q, qs) {
  let s = 0;
  const n = fbNrm(r.name), nd = fbNrm(plName(r));
  if (n === q || nd === q) s = 6; else if (n.startsWith(q) || nd.startsWith(q)) s = 5; else if (n.split(' ').some(w => w.startsWith(q))) s = 4; else if (r._n.includes(q)) s = 3;
  else if (r._a && r._a.includes(q)) s = 3.2; else if (qs.length >= 3 && r._s.includes(qs)) s = 1.5;
  return s ? s + Math.min(1, Math.log10(1 + r.st) / 3) + (r.kind === 'city' || r.kind === 'town' ? 0.4 : 0) : 0;
}
function plSearch(q) {
  const qn = fbNrm(q), qs = fbSk(q);
  let list = PL.rows;
  if (PL.caza) list = list.filter(r => r.caza.p === PL.caza);
  if (PL.kind) list = list.filter(r => r.kind === PL.kind);
  if (!qn) return list.slice().sort((a, b) => (b.st - a.st) || (b.ev - a.ev) || a.name.localeCompare(b.name));
  return list.map(r => [plScore(r, qn, qs), r]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}
function plOpenMap(name) {
  MAP.war = 'all'; MAP.kinds.clear(); MAP.t0 = MAP.t1 = null; MAP.q = name; MAP.shown = 25;
  hubShow('map', { push: true }); window.scrollTo(0, 0);
  const q = $('#mpQ'); if (q) q.value = name;
}
function plOpenEvent(id) { hubShow('timeline', { push: true }); window.scrollTo(0, 0); requestAnimationFrame(() => openEventCard(id)); }

/* ---------- the search view ---------- */
function plSearchView(el) {
  const caz = PL.idx.cazas, per = {};
  PL.rows.forEach(r => { per[r.caza.p] = (per[r.caza.p] || 0) + r.st; });
  el.innerHTML = `<p class="lead">${esc(t('Search any of {n} villages, towns and neighbourhoods by its name in English or Arabic. Spellings differ a lot in Lebanon, so "Bint Jbeil" also finds "Bent Jbeil".', { n: nf(PL.rows.length) }))}</p>
    <div class="d-filters"><label class="vh" for="plQ">${esc(t('Search places'))}</label><input id="plQ" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('Search a place: Khiam, Qana, بعلبك'))}" value="${esc(PL.q)}">
      <label class="sel" for="plK">${esc(t('Kind'))} <select id="plK"><option value="">${esc(t('All kinds'))}</option>${PL.idx.kinds.map(k => `<option value="${k}"${PL.kind === k ? ' selected' : ''}>${esc(t(PL_KIND[k] || k))}</option>`).join('')}</select></label>
      <label class="sel" for="plC">${esc(t('District'))} <select id="plC"><option value="">${esc(t('All districts'))}</option>${caz.slice().sort((a, b) => a.n.localeCompare(b.n)).map(c => `<option value="${c.p}"${PL.caza === c.p ? ' selected' : ''}>${esc(((PL.cazaByCode[c.p] || {}).ar && LANG === 'ar') ? PL.cazaByCode[c.p].ar : c.n)}</option>`).join('')}</select></label></div>
    <div class="fb-mapwrap"><div><p class="mono dim" id="plN"></p><ul class="pl-list" id="plList"></ul><button type="button" class="chip" id="plMore" hidden>${esc(t('Show more'))}</button></div>
    <div><div class="pl-layers" id="plLy" role="group" aria-label="${esc(t('Map layers'))}"><span class="note">${esc(t('Map layer'))}</span>
        <button type="button" class="chip sm-c" data-ly="religion" aria-pressed="false">${esc(t('Religion: registered voters by sect, 2014'))}</button>
        <button type="button" class="chip sm-c" data-ly="services" aria-pressed="false">${esc(t('Health and education facilities'))}</button></div>
      <div id="plMap"></div><div id="plMapEx"></div><p class="note" id="plMapCap"></p></div></div>`;
  const mx = Math.max(1, ...Object.values(per));
  /* a layer (religion, services) is drawn on a plain district map: the strike shading is never under it */
  const drawMap = extra => {
    const lay = !!PL.layer;
    $('#plMap').innerHTML = fbMap(PL.geo, { level: 'adm2', click: true, labels: false, extra: extra || '', fill: a => lay ? ({ fill: 'var(--stone)', title: '', on: a.p === PL.caza }) : ({ fill: per[a.p] ? fbShade(Math.sqrt(per[a.p] / mx), '--war') : 'var(--stone)', title: t('{n} documented strikes', { n: nf(per[a.p] || 0) }), on: a.p === PL.caza }),
      aria: lay ? (PL.layer === 'religion' ? t('Map of Lebanon: registered voters by sect, 2014') : t('Map of Lebanon: health and education facilities')) : t('Map of Lebanon by district: documented strikes') }) + (lay ? '' : fbLegend(0, mx, v => nf(v, 0), '--war'));
    fbMapClicks($('#plMap'), p => { PL.caza = PL.caza === p ? '' : p; $('#plC').value = PL.caza; PL.shown = 24; draw(); drawMap(extra); });
  };
  const wrap = $('.fb-mapwrap', el);
  const paint = () => {
    const ex = $('#plMapEx'), cap = $('#plMapCap'), tok = ++PL.tok;
    $$('#plLy [data-ly]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ly === PL.layer)));
    wrap.classList.toggle('pl-nostrikes', PL.layer === 'religion');
    if (!PL.layer) { ex.innerHTML = ''; cap.textContent = t('Documented strikes by district. Click a district to list its places.'); drawMap(''); return; }
    cap.textContent = ''; drawMap('');
    fbLoad(ex, [PL.layer === 'religion' ? 'data/places/sects-2014.json' : 'data/places/facilities.json'], data => {
      if (tok !== PL.tok || !PL.layer) return;
      const L = PL.layer === 'religion' ? plSectLayer(data) : plSvcLayer(data);
      drawMap(L.svg); ex.innerHTML = L.legend; cap.textContent = L.cap;
    });
  };
  $('#plLy').addEventListener('click', ev => { const b = ev.target.closest('[data-ly]'); if (!b) return; PL.layer = PL.layer === b.dataset.ly ? '' : b.dataset.ly; paint(); });
  $('#plMapEx').addEventListener('click', ev => { const c = ev.target.closest('[data-cat]'); if (!c) return; PL.svcOff[PL.svcOff.has(c.dataset.cat) ? 'delete' : 'add'](c.dataset.cat); paint(); });
  $('#plMap').addEventListener('click', ev => { const c = ev.target.closest('.pl-dot'); if (c) plGo(c.dataset.id); });
  const draw = () => {
    const res = plSearch(PL.q);
    $('#plN').textContent = PL.q || PL.caza || PL.kind ? t('{a} of {b} places', { a: nf(Math.min(PL.shown, res.length)), b: nf(res.length) }) : t('Most documented places');
    $('#plList').innerHTML = res.slice(0, PL.shown).map(r => `<li>${plLink(r.id, `<b>${esc(plName(r))}</b>${plAr(r) && LANG !== 'ar' ? ` <span class="d-ar" lang="ar" dir="rtl">${esc(plAr(r))}</span>` : ''}${LANG === 'ar' ? ` <span class="dim" dir="ltr">${esc(plOther(r))}</span>` : ''}`, 'pl-it')}<span class="dim pl-sub">${esc(plSub(r))}</span><span class="mono pl-ct">${r.st ? esc(tp('{n} strike', '{n} strikes', r.st)) : ''}</span></li>`).join('') || `<li class="hub-empty">${esc(t('No place matches. Try fewer letters or the Arabic name.'))}</li>`;
    $('#plMore').hidden = res.length <= PL.shown;
  };
  let tm = null;
  $('#plQ').addEventListener('input', ev => { clearTimeout(tm); tm = setTimeout(() => { PL.q = ev.target.value; PL.shown = 24; draw(); }, 120); });
  $('#plK').addEventListener('change', ev => { PL.kind = ev.target.value; PL.shown = 24; draw(); });
  $('#plC').addEventListener('change', ev => { PL.caza = ev.target.value; PL.shown = 24; draw(); paint(); });
  $('#plMore').addEventListener('click', () => { PL.shown += 24; draw(); });
  draw(); paint();
}

/* ---------- one place ---------- */
const plNum = v => v == null || v === '' ? '' : nf(v, 0);
function plNear(r, n) {
  const k = Math.cos(r.lat * Math.PI / 180);
  return PL.rows.filter(x => x.id !== r.id).map(x => [Math.hypot(x.lat - r.lat, (x.lon - r.lon) * k) * 111, x]).sort((a, b) => a[0] - b[0]).slice(0, n);
}
function plPlaceView(el, id) {
  const r = PL.rows.find(x => x.id === id);
  if (!r) { el.innerHTML = `<p class="hub-empty">${esc(t('This place is not in the index.'))} <a href="#places" data-hub="places">${esc(t('Search places'))}</a></p>`; return; }
  fbLoad(el, ['data/places/p/' + r.caza.p + '.json', 'data/places/cazas.json'], (shard, cj) => {
    const d = shard[id] || {}, caz = (cj.cazas || {})[r.caza.p] || {}, st = d.st || [], ev = d.ev || [];
    HUB.setHash('place', id);
    const killed = st.reduce((s, x) => s + Math.max(0, x[4]), 0), byWar = {};
    st.forEach(x => { byWar[x[2]] = (byWar[x[2]] || 0) + 1; });
    const [px, py] = fbProj(PL.geo, r.lat, r.lon), G = PL.geo, VW = 1100, VH = 1250;
    const vx = Math.max(0, Math.min(G.w - VW, px - VW / 2)), vy = Math.max(0, Math.min(G.h - VH, py - VH / 2));
    const near = plNear(r, 7), nearDots = near.map(([, x]) => { const [a, b] = fbProj(G, x.lat, x.lon); return `<circle cx="${a.toFixed(0)}" cy="${b.toFixed(0)}" r="11" class="pl-nb"><title>${esc(plName(x))}</title></circle>`; }).join('');
    const pinAt = (rr1, rr2) => `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${rr1}" class="fb-ring"/><circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${rr2}" class="fb-pin"/>`;
    const pinZoom = `<g>${nearDots}${pinAt(48, 18)}<text class="pl-pint" x="${(px + 26).toFixed(0)}" y="${(py - 22).toFixed(0)}">${esc(plName(r))}</text></g>`, pinWhole = `<g>${pinAt(70, 34)}</g>`;
    const zoomMap = fbMap(G, { level: 'adm2', view: [vx, vy, VW, VH], labels: false, cls: 'pl-zoom', fill: a => ({ fill: a.p === r.caza.p ? 'var(--cedar-soft)' : 'var(--stone)' }), extra: pinZoom, aria: t('Map of Lebanon with {n} marked', { n: plName(r) }) });
    const wholeMap = fbMap(G, { level: 'adm2', cls: 'pl-whole', fill: a => ({ fill: a.p === r.caza.p ? 'var(--cedar-soft)' : 'var(--stone)' }), extra: pinWhole, aria: t('Map of Lebanon with {n} marked', { n: plName(r) }) });
    const fact = (k, v) => v ? `<div class="pl-f"><dt>${esc(t(k))}</dt><dd>${v}</dd></div>` : '';
    const mu = (d.mu || []).map((m, i) => (LANG === 'ar' && d.mua && d.mua[i]) ? d.mua[i] : m).join(', ');
    const cad = d.cad || {}, mn = (d.mn || [])[0] || {};
    const KIND_EST = N('estimate'), KIND_RV = N('registered voters, not residents');
    const AR_SRC = { geonames: N('GeoNames (CC BY 4.0)'), lub: N('lub-anan.com'), wikidata: N('Wikidata (CC0)'), osm: N('OpenStreetMap contributors (ODbL 1.0)') };
    const popRows = [
      [t('Registered voters, 2014'), d.rv && d.rv[0], t('Interior Ministry lists, via lub-anan.com'), KIND_RV],
      [t('Registered voters, 2022, scaled'), d.rv22, t('2014 count scaled by the change in the district'), KIND_EST],
      [N('Modelled population of its cadaster, 2023'), d.pk, 'Kontur', KIND_EST], [N('Population given in the gazetteer'), d.pg, 'GeoNames', KIND_EST], [N('Municipal population estimate'), mn.pop, 'CIB IMPACT', KIND_EST],
      [N('Cadaster population, 2004'), cad.pop_npmplt_2004, 'NPMPLT', KIND_EST], [N('Cadaster population, 2013'), cad.pop_landscan_2013, 'LandScan', KIND_EST]].filter(x => x[1]);
    const rvNote = d.rv ? [d.rv[1] != null ? esc(t('Registered voters in 2014: {f} women and {m} men.', { f: nf(d.rv[1]), m: nf(d.rv[2]) })) : '', d.rvn ? esc(t('This count overlaps with another place\'s list, so do not add places up.')) : '',
      d.rvu ? `<a href="${esc(d.rvu)}" target="_blank" rel="noopener noreferrer">${esc(t('List as transcribed'))}</a>` : ''].filter(Boolean) : [];
    const es = caz.est || {}, KIND_SV = N('survey estimate'), KIND_PL = N('planning estimate'), KIND_MD = N('modelled estimate'), OCHA = N('OCHA Lebanon Response Plan 2026 package'), CASV = N('CAS and DGCS, voter tables');
    const estRows = [[N('Residents, 2018 to 2019'), es.cas, N('CAS, ILO and EU household survey, rounded to 100'), KIND_SV], [N('Residents, 2025'), es.lrp25, OCHA, KIND_PL], [N('Residents, 2026'), es.lrp26, OCHA, KIND_PL],
      [N('Residents, 2023, modelled'), es.kon, N('Kontur, sum of the district\'s cadasters'), KIND_MD], [N('Residents, 2013, modelled'), es.ls13, N('LandScan, via INFORM Lebanon 2015'), KIND_MD], [N('Residents, 2004, modelled'), es.np04, N('NPMPLT, via INFORM Lebanon 2015'), KIND_MD],
      [N('Registered voters, 2014'), es.rv14, CASV, KIND_RV], [N('Registered voters, 2018'), es.rv18, CASV, KIND_RV], [N('Registered voters, 2022'), es.rv22, CASV, KIND_RV], [N('Registered voters, 2025'), es.rv25, CASV, KIND_RV]].filter(x => x[1]);
    const refRows = [[N('Syrians registered with UNHCR'), cad.syrians_unhcr_2014], [N('Other registered refugees'), cad.non_syrians_unhcr_2014], [N('Palestine refugees from Syria'), cad.prs_2014], [N('Palestine refugees in Lebanon'), cad.prl_2014]].filter(x => x[1] != null);
    const idmc = (cj.idmc || []).filter(e => e.p === r.caza.p && e.lv === 'caza').sort((a, b) => (b.d || '') < (a.d || '') ? -1 : 1);
    const dp = caz.disp || {};
    const warRows = Object.entries(byWar).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `<p><a href="#places" data-hub="places" class="pl-back">&larr; ${esc(t('All places'))}</a></p>
      <header class="pl-head"><h3 class="pl-h" id="plPageH" tabindex="-1">${esc(plName(r))}${plAr(r) && LANG !== 'ar' ? ` <span class="d-ar" lang="ar" dir="rtl">${esc(plAr(r))}</span>` : ''}</h3><p class="dim">${esc(plSub(r))}${r.caza.g ? ' · ' + esc(plGov(r.caza.g)) : ''}</p>
        <p class="pl-act"><button type="button" class="chip sm-c" id="plCopy">${esc(t('Copy link'))}</button> <button type="button" class="chip sm-c" id="plJson">${esc(t('Download as JSON'))}</button> <span class="note" id="plMsg" role="status"></span></p></header>
      <div class="fb-mapwrap"><div>${zoomMap}<div class="pl-locwrap">${wholeMap}</div><p class="note">${esc(t('Red dot: this place. Grey dots: its nearest neighbours.'))} <bdi class="mono">${esc(r.lat.toFixed(4))}, ${esc(r.lon.toFixed(4))}</bdi></p></div>
        <dl class="pl-facts">${fact(N('District'), esc(plCaza(r.caza)))}${fact(N('Governorate'), esc(plGov(r.caza.g)))}${fact(N('Municipality'), esc(mu))}${fact(N('Union of municipalities'), esc((d.un || []).join(', ')))}${fact(N('Elevation'), d.el != null ? esc(t('{n} m', { n: nf(d.el, 0) })) : '')}
          ${fact(N('Cadaster'), esc(d.cd || cad.n || ''))}${fact(N('Election district'), d.ed ? `<a href="${HUB.href('elections', '2022-parliamentary', d.ed)}" data-hub="places" data-hash="elections/2022-parliamentary/${esc(d.ed)}">${esc(t(d.ed))}</a>` : (d.edn ? esc(d.edn) : ''))}
          ${fact(N('Place code'), `<span class="mono">${esc(id)}</span>`)}</dl></div>
      <h4 class="fb-t pl-s">${esc(t('Population'))}</h4>
      <p class="note">${esc(t('Lebanon has had no census since 1932. Every figure here is an estimate or a voter count, not a count of residents.'))}</p>${popRows.length ? fbTable([{ h: t('Measure') }, { h: t('People'), cls: 'num' }, { h: t('Source') }, { h: t('Kind') }], popRows.map(x => [t(x[0]), plNum(x[1]), x[2], t(x[3])])) : `<p class="note">${esc(t('No population figure is published for this place. Lebanon has had no census since 1932.'))}</p>`}
      ${rvNote.length ? `<p class="note">${rvNote.join(' ')}</p>` : ''}
      <p class="note">${esc(t('The cadaster is the cadastral unit that contains the place; it can hold several villages, so the modelled figure is for the unit, not the village. It is not a census.'))}</p>
      ${refRows.length ? `<h4 class="fb-t pl-s">${esc(t('Refugees registered here, end of 2014'))}</h4>${fbTable([{ h: t('Group') }, { h: t('People'), cls: 'num' }], refRows.map(x => [t(x[0]), plNum(x[1])]))}<p class="note">${esc(t('UNHCR registration for the cadaster, from the INFORM Lebanon 2015 indicators. No open count by cadaster is published for later years; see People for the district figures of 2026.'))}</p>` : ''}
      ${estRows.length ? `<h4 class="fb-t pl-s" id="plEstH">${esc(t('Residents of the district, by source'))}</h4><p class="note">${esc(t('There is no resident estimate for single places. For the district of {c}, these are the estimates sources give. They use different methods and years, so they differ, and none is a census count. Registered voters are not residents.', { c: r.caza.n }))}</p>${fbTable([{ h: t('Measure') }, { h: t('People'), cls: 'num' }, { h: t('Source') }, { h: t('Kind') }], estRows.map(x => [t(x[0]), plNum(x[1]), t(x[2]), t(x[3])]))}${es.lrp_bad ? `<p class="note">${esc(t('The OCHA totals for 2025 and 2026 look unreliable for this district, so they are not shown. Use the survey figure.'))}</p>` : ''}` : ''}
      ${caz.pop && caz.pop.total_2026 ? `<h4 class="fb-t pl-s">${esc(t('People in the district, 2026'))}</h4>${fbTable([{ h: t('Group') }, { h: t('People'), cls: 'num' }], [[t('Lebanese'), plNum(caz.pop.lebanese_2026)], [t('Syrians'), plNum(caz.pop.syrians_2026)], [t('Palestinians'), plNum(caz.pop.palestinians_2026)], [t('Migrants (preliminary)'), plNum(caz.pop.migrants_2026_preliminary)], [t('Total'), plNum(caz.pop.total_2026)]].filter(x => x[1] !== ''))}<p class="note">${esc(t('Planning figures for the whole district of {c} from the OCHA Lebanon Response Plan 2026 package (CC BY): Syrians from UNHCR registration, Palestinians from UNRWA, Lebanese from the CAS and ILO survey.', { c: r.caza.n }))} <a href="#people" data-hub="places">${esc(t('People'))}</a></p>` : ''}
      <h4 class="fb-t pl-s" id="plSectH">${esc(t('Registered voters by sect, 2014'))}</h4><div id="plSect"></div>
      <h4 class="fb-t pl-s" id="plPolH">${esc(t('Politics: the election district'))}</h4><div id="plPol"></div>
      <h4 class="fb-t pl-s" id="plSvcH">${esc(t('Services'))}</h4><div id="plSvc"></div>
      <h4 class="fb-t pl-s">${esc(t('Strikes at this place'))}</h4>
      <div id="plStrikes"></div>
      <h4 class="fb-t pl-s">${esc(t('Timeline events that name this place'))}</h4><div id="plEvents"></div>
      <h4 class="fb-t pl-s">${esc(t('Displacement and returns, 2023 to 2026'))}</h4><div id="plDisp"></div>
      ${d.dmg ? `<h4 class="fb-t pl-s">${esc(t('Building damage'))}</h4><p>${esc(t('{n} buildings completely destroyed, estimated from satellite imagery of {d}.', { n: nf(d.dmg.destroyed), d: d.dmg.date ? fbLongDate(d.dmg.date) : '' }))}</p><p class="note">${esc(d.dmg.note || '')} <a href="${esc(d.dmg.src)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(d.dmg.src))}</a></p>` : ''}
      <h4 class="fb-t pl-s">${esc(t('Nearby places'))}</h4><ul class="pl-near">${near.map(([km, x]) => `<li>${plLink(x.id, esc(plName(x)))} <span class="mono dim">${esc(nf(km, km < 10 ? 1 : 0))} km</span></li>`).join('')}</ul>
      <p class="note pl-src">${esc(t('Sources and licences'))}: ${esc(t('names, codes and coordinates: OCHA and the Central Administration of Statistics (CC BY), OCHA COD-AB boundaries (CC BY-IGO), GeoNames (CC BY 4.0)'))}${d.osm ? esc('; ' + t('and OpenStreetMap contributors (ODbL 1.0), which makes this record share-alike')) : ''}${d.ars ? esc('; ' + t('Arabic name: {s}', { s: t(AR_SRC[d.ars] || d.ars) })) : ''}${d.rv ? esc('; ' + t('registered voters: Interior Ministry lists of 2014 as transcribed by lub-anan.com, no licence stated, facts only')) : ''}. ${esc(t('Municipalities: CIB IMPACT and the CAS 2017 list (CIB states no licence). Population: Kontur (CC BY). Refugees: UNHCR via INFORM (CC BY). Districts: OCHA Lebanon Response Plan 2026 package (CC BY), IDMC (CC BY-IGO). Strikes and events: each row links to its own source.'))}</p>`;
    plSectBlock($('#plSect', el), id, d); plPolBlock($('#plPol', el), d, r); plSvcBlock($('#plSvc', el), d);
    // strikes
    const s = $('#plStrikes', el);
    if (!st.length) s.innerHTML = `<p class="hub-empty">${esc(t('No strike is documented at this place. That does not mean none happened: the Strike map says per war what is complete and what is not.'))}</p>`;
    else {
      const rows = st.slice().sort((a, b) => a[0] < b[0] ? -1 : 1);
      s.innerHTML = fbStats([{ k: t('Documented strikes'), v: nf(d.stn || st.length), n: d.stn > st.length ? t('the {n} earliest are listed', { n: nf(st.length) }) : '' }, { k: t('Killed, as documented in sources'), v: nf(killed), n: t('sources overlap; not a casualty count') }]) +
        `<div id="plWar"></div><div id="plStList"></div><p class="mp-open"><button type="button" class="chip" id="plOpenMap">${esc(t('Open on the strike map'))}</button></p>`;
      hubBars($('#plWar', el), { items: warRows.map(([w, n]) => ({ id: w, label: t(PL_WAR[w] || w), value: n })), fmt: v => nf(v) });
      let shown = 12;
      const list = () => { $('#plStList', el).innerHTML = `<ul class="pl-rows">${rows.slice(0, shown).map(x => `<li><span class="mono">${esc(x[1] ? t('{a} to {b}', { a: fmtDate(x[0]), b: fmtDate(x[1]) }) : fmtDate(x[0]))}</span> <b>${esc(t(PL_KINDS_STRIKE[x[3]] || x[3]))}</b>${x[4] > 0 ? ', ' + esc(t('{n} killed', { n: x[5] || nf(x[4]) })) : ''}. ${th(x[6])} ${x[7] ? `<a href="${esc(x[7])}" target="_blank" rel="noopener noreferrer">${esc(fbHost(x[7]))}</a>` : ''}${cf(['verified', 'reported', 'inference'][x[8]] || 'reported')}${x[9] && EVBY[x[9]] ? ` <button type="button" class="chip sm-c" data-ev="${esc(x[9])}">${esc(t('Open in timeline'))}</button>` : ''}</li>`).join('')}</ul>${rows.length > shown ? `<button type="button" class="chip" id="plStMore">${esc(t('Show more'))}</button>` : ''}`; const m = $('#plStMore', el); if (m) m.onclick = () => { shown += 12; list(); }; };
      list();
      $('#plOpenMap', el).addEventListener('click', () => plOpenMap(d.sn || r.name));
    }
    // events
    const e = $('#plEvents', el);
    e.innerHTML = ev.length ? `<p class="note">${esc(t('Matched by name in event titles and "why" lines: {n} in all, {k} shown, the most important first. A name can belong to more than one place or person, so check the event.', { n: nf(d.evn || ev.length), k: nf(ev.length) }))}</p><ul class="pl-rows">${ev.map(x => `<li><span class="mono">${esc(fmtDate(x[1]))}</span> ${th(x[2])} <button type="button" class="chip sm-c" data-ev="${esc(x[0])}">${esc(t('Open in timeline'))}</button></li>`).join('')}</ul>` : `<p class="hub-empty">${esc(t('No timeline event names this place.'))}</p>`;
    el.addEventListener('click', ev2 => { const b = ev2.target.closest('[data-ev]'); if (b) plOpenEvent(b.dataset.ev); });
    // displacement
    const dd = $('#plDisp', el);
    const has = Object.keys(dp).length || idmc.length;
    dd.innerHTML = has ? `<p class="note">${esc(t('Figures below are for the whole district of {c}, not for this village: no open source gives displacement below district level.', { c: r.caza.n }))}</p>` +
      (Object.keys(dp).length ? fbTable([{ h: t('Measure') }, { h: t('People'), cls: 'num' }], [[t('Displaced people hosted in the district, 31 May 2025'), plNum(dp.idps_hosted_31may2025)], [t('Displaced from the district, still away, 31 May 2025'), plNum(dp.idps_displaced_from_here_31may2025)],
        [t('Returned to the district, Oct 2024 to May 2025'), plNum(dp.returned_to_district_oct2024_may2025)], [t('Returned from the district, Oct 2024 to May 2025'), plNum(dp.returned_from_district_departure_oct2024_may2025)]].filter(x => x[1] !== '')) + `<p class="note">${esc(t('IOM Displacement Tracking Matrix round 87, as shown in the OCHA Lebanon Response Plan 2026 package (CC BY).'))}</p>` : '') +
      (idmc.length ? `<p class="note"><b>${esc(t('IDMC displacement reports for this district'))}</b> ${esc(t('(overlapping and sometimes cumulative: do not add them up)'))}</p><ul class="pl-rows">${idmc.slice(0, 6).map(x => `<li><span class="mono">${esc(fmtDate(x.d))}</span> ${esc(t('{n} people', { n: nf(x.v) }))}. ${esc(x.by || '')}${x.q ? ' (' + esc(x.q) + ')' : ''}</li>`).join('')}</ul>` : '') +
      `<p class="note"><a href="#war" data-hub="places">${esc(t('The war in numbers'))}</a> ${esc(t('has the national figures: killed, displaced, returned, shelters and damage.'))}</p>` : `<p class="hub-empty">${esc(t('No district displacement figure is on record for this place.'))}</p>`;
    $('#plCopy', el).addEventListener('click', () => { const m = $('#plMsg', el); try { navigator.clipboard.writeText(location.href).then(() => { m.textContent = t('Link copied.'); }, () => { m.textContent = location.href; }); } catch (x) { m.textContent = location.href; } });
    $('#plJson', el).addEventListener('click', () => {
      const json = JSON.stringify({ id, name: r.name, name_ar: r.ar, kind: r.kind, district: r.caza.n, governorate: r.caza.g, lat: r.lat, lon: r.lon, ...d }, null, 1);
      HubDL.save(id + '.json', json).then(ok => {
        if (ok) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.setAttribute('data-local', '');
        a.download = id + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      });
    });
  });
}

HUB.tab('places', { render(args, info) {
  const root = $('#placesRoot');
  if (!root || !(D.tabs.places && D.tabs.places.n)) return;
  const sec = info.route === 'place' ? 'places' : (PL_SECS.some(x => x.id === info.route) ? info.route : (info.lang ? PL.sec : 'places'));
  PL.sec = sec;
  fbLoad(root, ['data/geo/lebanon.json', 'data/places/cazas.json'], (geo, cj) => {
    PL.geo = geo; PL.cz = cj; PL.cazaByCode = cj.cazas || {};
    root.innerHTML = `<div class="chips fb-nav" id="plNav"></div><div id="plView"></div><p class="note pl-data"><a href="#data/places" data-hub="data" data-hash="data/places">${esc(t('Data behind this tab'))}</a></p>`;
    const go = id => {
      PL.sec = id;
      const el = $('#plView'); el.innerHTML = '';
      HUB.setHash(id);
      plSection(id, el, []);
    };
    fbNav($('#plNav'), PL_SECS.map(x => ({ id: x.id, label: t(x.label) })), sec, go);
    plSection(sec, $('#plView'), info.route === 'place' ? ['place'].concat(args) : (sec === 'elections' ? args : []));
  });
} });
function plSection(sec, el, args) {
  if (sec === 'places') {
    fbLoad(el, ['data/places/index.json'], idx => {
      PL.idx = idx; PL.rows = idx.rows.map(plRow); PL.byId = Object.fromEntries(PL.rows.map(r => [r.id, r]));
      el.innerHTML = '<div id="plInner"></div>';
      if (args[0] === 'place' && args[1]) plPlaceView($('#plInner'), args[1]); else plSearchView($('#plInner'));
    });
  } else if (sec === 'elections') plElections(el, args);
  else if (sec === 'war') plWar(el);
  else if (sec === 'history') plHistory(el);
  else plPeople(el);
}
