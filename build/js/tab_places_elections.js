/* ------------------------------------------------------------ Places tab, Elections section (D5). Data: data/elections/index.json and data/elections/<id>.json, data/geo/lebanon.json.
   A district map (turnout, registered voters or seats), a results table per election, and per district: seats by confession, lists, and the elected members. Hash: #elections/<id>/<district>. */
const ELE = { id: null, metric: 'turnout', dist: null, cache: {} };
const ELE_METRICS = [{ id: 'turnout', label: N('Turnout') }, { id: 'registered', label: N('Registered voters') }, { id: 'seats', label: N('Seats') }];
const CONF = { Maronite: N('Maronite'), Sunni: N('Sunni'), Shia: N('Shia'), Druze: N('Druze'), 'Greek Orthodox': N('Greek Orthodox'), 'Greek Catholic': N('Greek Catholic'), 'Armenian Orthodox': N('Armenian Orthodox'),
  'Armenian Catholic': N('Armenian Catholic'), Alawite: N('Alawite'), Evangelical: N('Evangelical'), Minorities: N('Minorities') };
const eleConf = c => t(CONF[c] || c);
const elePct = v => v == null ? '' : nf(v, 1) + '%';
const eleTitle = e => e.name ? e.name.replace(/^(\d{4}) Lebanese /, '$1 ') : e.id;
function eleName(ix) { const y = (ix.date || '').slice(0, 4) || ix.id.slice(0, 4); return ix.type === 'municipal' ? t('{y} municipal', { y: fy(y) }) : t('{y} parliamentary', { y: fy(y) }); }
function eleValue(e, metric, cazaCode) {
  const gs = (e.geo.groups || []).filter(g => g.cazas.includes(cazaCode)), ds = gs.map(g => e.districts.find(d => d.district === g.district)).filter(Boolean);
  if (!ds.length) return null;
  if (metric === 'seats') return ds.some(d => d.seats == null) ? null : ds.reduce((s, d) => s + d.seats, 0);
  if (metric === 'registered') return ds.some(d => !d.registered) ? null : ds.reduce((s, d) => s + d.registered, 0);
  const reg = ds.reduce((s, d) => s + (d.registered || 0), 0), vot = ds.reduce((s, d) => s + (d.voters || 0), 0);
  if (reg && vot && ds.every(d => d.registered && d.voters)) return vot / reg * 100;
  const tv = ds.map(d => d.turnout).filter(v => v != null);
  return tv.length === ds.length ? tv.reduce((s, v) => s + v, 0) / tv.length : null;
}
function plElections(el, args) {
  fbLoad(el, ['data/elections/index.json'], idx => {
    const ok = id => idx.some(e => e.id === id);
    ELE.id = ok(args[0]) ? args[0] : (ok(ELE.id) ? ELE.id : (ok('2022-parliamentary') ? '2022-parliamentary' : idx[0].id));
    if (args[1]) ELE.dist = args[1];
    el.innerHTML = `<p class="lead">${esc(t('Lebanon\'s parliamentary elections since 1992 and its municipal elections of 2016 and 2025: who could vote, how many did, and where. Seats are the confessional allocation set by the law. The May 2026 election was not held.'))}</p>
      <div class="fb-grid"><div class="fb-card wide"><h4 class="fb-t">${esc(t('Turnout over time'))}</h4><p class="fb-u mono dim">${esc(t('% of registered voters, national'))}</p><div id="eleTrend"></div><p class="note">${esc(t('National figures differ by source for 1992 to 2005 (Nohlen, IDEA and IPU); the first is used and the others are kept in the election files.'))}</p></div></div>
      <div id="eleTbl"></div><h4 class="fb-t">${esc(t('Choose an election'))}</h4><div class="chips fb-nav" id="eleNav"></div><div id="eleOne"></div>`;
    const mkS = (type, label) => ({ id: type, label, unit: '%', points: idx.filter(e => e.type === type && e.held !== false && e.turnout != null).map(e => [(e.date || '').slice(0, 4), e.turnout]), source_url: 'https://www.idea.int/data-tools/data/country?country=124&database_theme=293', license: 'Facts attributed to IDEA, UNDP, Wikipedia (CC BY-SA 4.0); the Interior Ministry states no licence' });
    const tr = fbCard($('#eleTrend'), { title: t('Turnout over time'), series: [{ s: mkS('parliamentary', t('Parliamentary')), label: t('Parliamentary') }, { s: mkS('municipal', t('Municipal')), label: t('Municipal'), dash: true }], gran: 'y', height: 220, yMin: 0, yMax: 100, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%', table: false });
    tr.fig.querySelector('figcaption').remove(); tr.fig.classList.add('flat');
    $('#eleTbl').innerHTML = fbTable([{ h: t('Election') }, { h: t('Date') }, { h: t('Registered'), cls: 'num' }, { h: t('Voters'), cls: 'num' }, { h: t('Turnout'), cls: 'num' }, { h: t('Seats'), cls: 'num' }],
      idx.slice().reverse().map(e => Object.assign([eleName(e), e.held === false ? t('not held') : (e.date ? fmtDate(e.date) : ''), plNum(e.registered), plNum(e.voters), elePct(e.turnout), e.seats ? nf(e.seats) : ''], { _id: e.id, _cls: e.id === ELE.id ? 'on' : '' })));
    $('#eleTbl').onclick = ev => { const r = ev.target.closest('tr[data-id]'); if (r) pick(r.dataset.id); };
    fbNav($('#eleNav'), idx.map(e => ({ id: e.id, label: eleName(e) })), ELE.id, id => pick(id, true), t('Elections'));
    function pick(id, fromNav) {
      ELE.id = id; ELE.dist = null;
      $$('#eleTbl tbody tr').forEach(r => r.classList.toggle('on', r.dataset.id === id));
      $$('#eleNav [data-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      HUB.setHash('elections', id);
      eleOne($('#eleOne'));
      if (!fromNav) $('#eleOne').scrollIntoView({ block: 'start' });
    }
    eleOne($('#eleOne'));
  });
}
function eleOne(el) {
  fbLoad(el, ['data/elections/' + ELE.id + '.json', 'data/geo/lebanon.json'], (e, geo) => {
    const ix = ELE_IDX_OF(e), nat = e.national || {}, reg = nat.registered || nat.registered_total, held = e.held !== false;
    const srcs = (Array.isArray(e.source) ? e.source : [e.source]).filter(u => /^https?:/.test(u || ''));
    let h = `<h3 class="d-h">${esc(eleName(ix))}</h3><p class="note">${esc(t(e.law || ''))}</p>`;
    if (!held) h += e.extension_law ? eleStatusCard(e) : `<p class="fb-note-band">${esc(e.status_detail ? t(e.status_detail) : t('This election was not held.'))}</p>`;
    h += fbStats([{ k: t('Registered voters'), v: reg ? nf(reg) : '', n: nat.registered_alt ? t('another source: {n}', { n: nf(nat.registered_alt) }) : '' }, { k: t('Voters'), v: nat.voters ? nf(nat.voters) : '', n: '' }, { k: t('Turnout'), v: nat.turnout != null ? elePct(nat.turnout) : '', n: nat.turnout_alt ? t('another source: {n}', { n: nf(nat.turnout_alt, 1) + '%' }) : '' },
      { k: t('Seats'), v: ix.seats ? nf(ix.seats) : (nat.municipalities ? nf(nat.municipalities) + ' ' + t('municipalities') : ''), n: nat.council_members ? t('{n} council members', { n: nf(nat.council_members) }) : (nat.municipal_council_members ? t('{n} council members', { n: nf(nat.municipal_council_members) }) : '') }].filter(x => x.v));
    if ((e.rounds || e.phases || []).length) h += `<p class="note"><b>${esc((e.rounds ? t('Rounds') : t('Phases')))}</b>: ${(e.rounds || e.phases).map(r => esc(fmtDate(r.date) + ', ' + t(r.area) + (r.seats ? ' (' + t('{n} seats', { n: nf(r.seats) }) + ')' : ''))).join('; ')}</p>`;
    if (e.districts && e.districts.length) {
      h += `<div class="d-filters"><span class="note">${esc(t('Colour the map by'))}</span><div class="chips sm" id="eleMet" role="group" aria-label="${esc(t('Map colour'))}">${ELE_METRICS.map(m => `<button type="button" class="chip sm-c" data-m="${m.id}" aria-pressed="${m.id === ELE.metric}">${esc(t(m.label))}</button>`).join('')}</div></div>
        <div class="fb-mapwrap"><div id="eleMap"></div><div id="eleDt"></div></div>`;
    }
    h += `<div id="eleDist"></div>`;
    if (nat.party_seats && nat.party_seats.length) h += `<h4 class="fb-t pl-s">${esc(t('Seats by party or bloc'))}</h4><div id="elePs"></div><p class="note">${esc(t('Party counts are from the sources named below and count each winner once by affiliation at the time.'))}</p>`;
    if (e.city_races && e.city_races.length) h += `<h4 class="fb-t pl-s">${esc(t('City races'))}</h4>` + e.city_races.map(c => `<div class="fb-card"><h4 class="fb-t">${esc(t(c.city))}</h4><p class="note">${esc(t('{n} registered', { n: plNum(c.registered) }))}${c.turnout != null ? ', ' + esc(t('turnout {n}', { n: elePct(c.turnout) })) : ''}${c.seats ? ', ' + esc(t('{n} seats', { n: nf(c.seats) })) : ''}</p>${fbTable([{ h: t('List') }, { h: t('Share'), cls: 'num' }, { h: t('Seats'), cls: 'num' }], (c.lists || []).map(l => [t(l.name), l.pct != null ? nf(l.pct, 1) + '%' : '', l.seats != null ? nf(l.seats) : '']))}</div>`).join('');
    if (e.qada_turnout && e.qada_turnout.length) h += `<h4 class="fb-t pl-s">${esc(t('Turnout by district'))}</h4><div id="eleQ"></div>`;
    if ((e.notes || []).length) h += `<h4 class="fb-t pl-s">${esc(t('Notes on the data'))}</h4><ul class="fb-ev">${e.notes.map(n => `<li>${esc(t(n))}</li>`).join('')}</ul>`;
    h += `<p class="note pl-src">${esc(t('Sources'))}: ${srcs.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(u))}</a>`).join(', ')}. ${esc(t('Licence'))}: ${esc(e.license ? t(e.license) : t(FB_UNSTATED))}.</p>`;
    el.innerHTML = h;
    if ($('#elePs')) hubBars($('#elePs'), { items: nat.party_seats.slice().sort((a, b) => b.seats - a.seats).map(p => ({ label: t(p.name), value: p.seats })), fmt: v => nf(v) });
    if ($('#eleQ')) hubBars($('#eleQ'), { items: e.qada_turnout.slice().sort((a, b) => (b.turnout || 0) - (a.turnout || 0)).map(q => ({ label: t(q.qada), value: q.turnout })), fmt: v => nf(v, 1) + '%', max: 100 });
    if (!(e.districts && e.districts.length)) return;
    const metric = () => ELE.metric, dists = e.districts;
    const drawDt = () => {
      const m = metric(), isP = e.type === 'parliamentary';
      $('#eleDt').innerHTML = fbTable([{ h: t('District') }, { h: t('Seats'), cls: 'num' }, { h: t('Registered'), cls: 'num' }, { h: t('Voters'), cls: 'num' }, { h: t('Turnout'), cls: 'num' }],
        dists.map(d => Object.assign([t(d.district), d.seats != null ? nf(d.seats) : '', plNum(d.registered), plNum(d.voters), elePct(d.turnout)], { _id: d.district, _cls: d.district === ELE.dist ? 'on' : '' }))) + `<p class="note">${esc(isP ? t('Click a district, in the table or on the map, for its lists and the elected members.') : t('Click a governorate for its figures.'))}</p>`;
      $('#eleDt').onclick = ev => { const r = ev.target.closest('tr[data-id]'); if (r) selDist(r.dataset.id); };
    };
    const drawMap = () => {
      const m = metric(), vals = {}, all = [], cnt = {};
      (e.geo.groups || []).forEach(g => g.cazas.forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }));
      const shared = Object.values(cnt).some(n => n > 1);
      geo.adm2.forEach(a => { const v = eleValue(e, m, a.p); vals[a.p] = v; if (v != null) all.push(v); });
      const lo = Math.min(...all), hi = Math.max(...all), fm = v => m === 'turnout' ? nf(v, 0) + '%' : nf(v, 0), sel = ELE.dist ? ((e.geo.groups.find(g => g.district === ELE.dist) || {}).cazas || []) : [];
      $('#eleMap').innerHTML = fbMap(geo, { level: 'adm2', click: true, fill: a => ({ fill: vals[a.p] == null ? 'var(--stone)' : fbShade(hi > lo ? (vals[a.p] - lo) / (hi - lo) : 0.5), title: vals[a.p] == null ? t('no figure') : fm(vals[a.p]), on: sel.includes(a.p) }), aria: t('Map of Lebanon by electoral district') }) +
        (all.length ? fbLegend(lo, hi, fm) : `<p class="note">${esc(t('No district figure exists for this measure in this election.'))}</p>`) + (shared ? `<p class="note">${esc(t('Where one map district belongs to more than one electoral district (Beirut, and Saida under Law 44/2017), the map shows their combined figure.'))}</p>` : '');
      fbMapClicks($('#eleMap'), p => { const g = (e.geo.groups || []).find(x => x.cazas.includes(p)); if (g) selDist(g.district); });
    };
    const selDist = name => { ELE.dist = name; HUB.setHash('elections', ELE.id, name); drawDt(); drawMap(); eleDistrict($('#eleDist'), e, name); if ($('#eleDist').firstChild) $('#eleDist').scrollIntoView({ block: 'nearest' }); };
    $('#eleMet').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; ELE.metric = b.dataset.m; $$('#eleMet [data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawMap(); });
    drawDt(); drawMap();
    if (ELE.dist && dists.some(d => d.district === ELE.dist)) eleDistrict($('#eleDist'), e, ELE.dist);
  });
}
/* the 2026 election: a fact card with the status, the extension law, the court decision and the new date (research/hub/elections/2026-parliamentary.json) */
function eleStatusCard(e) {
  const x = e.extension_law || {}, cc = x.constitutional_council || {}, v = x.vote || {};
  const row = (k, val) => val ? `<div><dt>${esc(t(k))}</dt><dd>${val}</dd></div>` : '';
  const when = d => d ? esc(fmtDate(d)) : '';
  return `<section class="fb-fact" aria-labelledby="eleFcH"><h4 class="fb-t" id="eleFcH">${esc(t('2026 election: postponed, not held'))}</h4><dl class="fb-fact-l">
    ${row(N('Status'), esc(t('Postponed: the election was not held')))}
    ${row(N('Scheduled for'), when(e.scheduled_date))}
    ${row(N('Extension law'), x.law ? `<b>${esc(t(x.law))}</b>, ${esc(t('passed on {d}', { d: fmtDate(x.date) }))}${x.gazette ? ` (${esc(tDates(x.gazette))})` : ''}` : '')}
    ${row(N('Parliament term extended to'), when(x.term_extended_to))}
    ${row(N('Vote'), v.for != null ? esc(t('{a} for, {b} against, {c} abstained', { a: nf(v.for), b: nf(v.against), c: nf(v.abstain) })) : '')}
    ${row(N('Constitutional Council'), cc.decision ? `<b>${esc(t(cc.decision))}</b>, ${esc(t('of {d}', { d: fmtDate(cc.date) }))}: ${esc(t(cc.outcome || ''))}` : '')}
    ${row(N('New election date'), e.new_date ? when(e.new_date) : `<b>${esc(e.new_date_note ? tDates(e.new_date_note) : t('No date set'))}</b>`)}
    ${row(N('Results'), esc(t('None: no vote has taken place')))}
    ${row(N('Sources'), (Array.isArray(e.source) ? e.source : [e.source]).filter(u => /^https?:/.test(u || '')).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(u))}</a>`).join(', '))}
  </dl></section>`;
}
function ELE_IDX_OF(e) { const id = ELE.id, y = (e.date || e.scheduled_date || '').slice(0, 4); return { id, date: e.date || e.scheduled_date, type: e.type, seats: e.type === 'parliamentary' ? (e.districts || []).reduce((s, d) => s + (d.seats || 0), 0) || null : null, y }; }
function eleDistrict(el, e, name) {
  const d = (e.districts || []).find(x => x.district === name);
  if (!d) { el.innerHTML = ''; return; }
  const lists = (d.lists || []).slice().sort((a, b) => (b.votes || 0) - (a.votes || 0)), win = d.winners || [], conf = d.seats_by_confession || {}, tot = lists.reduce((s, l) => s + (l.votes || 0), 0);
  el.innerHTML = `<h4 class="fb-t pl-s" id="eleDH" tabindex="-1">${esc(t(d.district))}</h4><p class="note">${esc(t(d.qadas || ''))}</p>` +
    fbStats([{ k: t('Seats'), v: d.seats != null ? nf(d.seats) : '' }, { k: t('Registered'), v: plNum(d.registered) }, { k: t('Voters'), v: plNum(d.voters) }, { k: t('Turnout'), v: elePct(d.turnout) }].filter(x => x.v)) +
    (Object.keys(conf).length ? `<h5 class="fb-t">${esc(t('Seats by confession'))}</h5><div id="eleCf"></div>` : '') +
    (lists.length ? `<h5 class="fb-t">${esc(t('Lists'))}</h5>${fbTable([{ h: t('List') }, { h: t('Votes'), cls: 'num' }, { h: t('Share'), cls: 'num' }, { h: t('Seats'), cls: 'num' }], lists.map(l => [t(l.name) + (l.parties ? ' (' + t(l.parties) + ')' : ''), plNum(l.votes), tot && l.votes ? nf(l.votes / tot * 100, 1) + '%' : '', l.seats != null ? nf(l.seats) : '']))}<p class="note">${esc(t('Share is of the valid list votes in the district, summed over the lists shown.'))}</p>` : '') +
    (d.alliance_seats ? `<p class="note">${esc(Object.entries(d.alliance_seats).map(([k, v]) => t(k) + ': ' + t('{n} seats', { n: nf(v) })).join(', '))}</p>` : '') +
    (win.length ? `<h5 class="fb-t">${esc(t('Elected members'))}</h5>${fbTable([{ h: t('Name') }, { h: t('Seat') }, { h: t('List or affiliation') }, { h: t('Votes'), cls: 'num' }], win.map(w => [w.name + (w.note ? ' *' : ''), eleConf(w.seat), t(w.list || w.affiliation || ''), plNum(w.votes)]))}<p class="note">${esc(win.some(w => w.note) ? t('* see the note in the election file: {n}', { n: t((win.find(w => w.note) || {}).note) }) : '')} ${esc(t('Votes are preferential votes for each candidate (list votes in the table above).'))}</p>` : (lists.length ? '' : `<p class="hub-empty">${esc(t('No lists or winners are on record for this district and election.'))}</p>`));
  if ($('#eleCf', el)) hubBars($('#eleCf', el), { items: Object.entries(conf).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: eleConf(k), value: v })), fmt: v => nf(v) });
}
