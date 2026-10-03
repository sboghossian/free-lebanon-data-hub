/* ------------------------------------------------------------ Places tab, "People" section (D8). Data: data/people/series.json, data/people/extras.json, data/places/cazas.json, data/geo/lebanon.json.
   Population, age pyramids, births and deaths, refugees, migration, border crossings, and the 26 districts. Hash: #people. */
const PEO = { pyr: '2026', metric: 'total_2026' };
const PEO_MET = [{ id: 'total_2026', label: N('All residents') }, { id: 'lebanese_2026', label: N('Lebanese') }, { id: 'syrians_2026', label: N('Syrians') }, { id: 'palestinians_2026', label: N('Palestinians') }, { id: 'migrants_2026_preliminary', label: N('Migrants (preliminary)') }];
function peoPyramid(ex, y) {
  const p = (ex.extras.age_pyramids_wpp2024 || {})[y];
  if (!p) return '';
  const n = p.age_start.length, mx = Math.max(...p.male_thousand, ...p.female_thousand), W = 420, H = n * 14 + 20, c = W / 2;
  const rows = p.age_start.map((a, i) => { const m = p.male_thousand[i] / mx * (c - 34), f = p.female_thousand[i] / mx * (c - 34), yy = (n - 1 - i) * 14 + 4;
    return `<rect x="${(c - m).toFixed(1)}" y="${yy}" width="${m.toFixed(1)}" height="11" style="fill:var(--sea)"><title>${esc(a + '+: ' + nf(p.male_thousand[i], 0) + 'k')}</title></rect><rect x="${c}" y="${yy}" width="${f.toFixed(1)}" height="11" style="fill:var(--cedar)"><title>${esc(a + '+: ' + nf(p.female_thousand[i], 0) + 'k')}</title></rect>${i % 4 === 0 ? `<text class="ax" x="2" y="${yy + 9}">${esc(fy(a))}</text>` : ''}`; }).join('');
  return `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Population pyramid for {y}: men to the left, women to the right', { y: fy(y) }))}"><line class="gl" x1="${c}" x2="${c}" y1="0" y2="${H - 16}"/>${rows}<text class="ax" x="6" y="${H - 3}">${esc(t('Men'))}</text><text class="ax" x="${W - 6}" y="${H - 3}" text-anchor="end">${esc(t('Women'))}</text></svg>`;
}
function plPeople(el) {
  fbLoad(el, ['data/people/series.json', 'data/people/extras.json'], (ps, ex) => {
    const P = fbIndex([ps]), s = id => P[id], last = id => fbLast(s(id));
    const pop = last('wpp_pop_total'), lrp = last('lrp_total'), me = last('wpp_median_age'), le = last('wpp_life_exp_both'), sy = last('unhcr_syrian_refugees_yearend'), em = last('undesa_emigrant_stock'), im = last('undesa_immigrant_stock');
    el.innerHTML = `<p class="lead">${esc(t('Who lives in Lebanon, who was born, who left and who arrived. Lebanon has had no census since 1932, so every population figure is a model or an estimate, and the sources disagree on purpose.'))}</p>` +
      fbStats([{ k: t('Population, UN estimate'), v: pop ? nf(pop[1] / 1000, 2) + t('M') : '', n: t('UN World Population Prospects 2024, {y}', { y: pop ? fy(pop[0]) : '' }) }, { k: t('Residents, humanitarian planning figure'), v: lrp ? nf(lrp[1] / 1e6, 2) + t('M') : '', n: t('Lebanon Response Plan, {y}', { y: lrp ? fy(lrp[0]) : '' }) },
        { k: t('Median age'), v: me ? nf(me[1], 1) : '', n: me ? fy(me[0]) : '' }, { k: t('Life expectancy'), v: le ? nf(le[1], 1) : '', n: le ? fy(le[0]) : '' }, { k: t('Syrian refugees registered'), v: sy ? nf(sy[1]) : '', n: t('UNHCR, end {y}', { y: sy ? fy(sy[0]) : '' }) },
        { k: t('Lebanon-born living abroad'), v: em ? nf(em[1]) : '', n: t('UN DESA, {y} (an undercount)', { y: em ? fy(em[0]) : '' }) }, { k: t('Foreign-born living in Lebanon'), v: im ? nf(im[1]) : '', n: t('UN DESA, {y}', { y: im ? fy(im[0]) : '' }) }]) +
      `<p class="fb-note-band">${esc(t('The UN estimate (5.9 million in 2026) and the planning figure (5.4 million) differ by design: the first models the whole resident population, the second counts the groups humanitarian agencies plan for. The UNHCR portal series jumps from 490,424 to 889,625 in June 2026; the cause is unverified and may be a definition change.'))}</p>
      <div class="fb-grid" data-g></div>`;
    const g = el.querySelector('[data-g]'), C = o => fbCard(g, o);
    C({ title: t('Population, 1950 to 2026'), unit: t('thousand people, UN estimate (projection after 2023)'), series: [{ s: s('wpp_pop_total'), label: t('Total') }, { s: s('wpp_pop_male'), label: t('Men') }, { s: s('wpp_pop_female'), label: t('Women') }], gran: 'y', height: 250 });
    const pc = document.createElement('div'); pc.className = 'fb-card';
    pc.innerHTML = `<h4 class="fb-t">${esc(t('Age pyramid'))}</h4><p class="fb-u mono dim">${esc(t('thousand people in five-year age groups, UN estimate'))}</p><div class="chips sm" id="peoPy" role="group" aria-label="${esc(t('Year'))}">${Object.keys(ex.extras.age_pyramids_wpp2024 || {}).map(y => `<button type="button" class="chip sm-c" data-y="${y}" aria-pressed="${y === PEO.pyr}">${esc(fy(y))}</button>`).join('')}</div><div id="peoPyr"></div><p class="fb-src note">${esc(t('Source'))}: <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer">population.un.org</a>. ${esc(t('Licence'))}: CC BY 3.0 IGO.</p>`;
    g.appendChild(pc);
    const dp = () => { $('#peoPyr').innerHTML = peoPyramid(ex, PEO.pyr); $$('#peoPy [data-y]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.y === PEO.pyr))); };
    $('#peoPy').addEventListener('click', ev => { const b = ev.target.closest('[data-y]'); if (b) { PEO.pyr = b.dataset.y; dp(); } }); dp();
    C({ title: t('Births and deaths'), unit: t('per 1,000 people, UN estimate'), series: [{ s: s('wpp_cbr'), label: t('Birth rate') }, { s: s('wpp_cdr'), label: t('Death rate') }], gran: 'y', height: 230 });
    C({ title: t('Children per woman'), unit: t('total fertility rate, UN estimate'), series: [{ s: s('wpp_tfr'), label: t('Fertility rate') }], gran: 'y', height: 220 });
    C({ title: t('Life expectancy at birth'), unit: t('years, UN estimate'), series: [{ s: s('wpp_life_exp_both'), label: t('Both sexes') }, { s: s('wpp_life_exp_male'), label: t('Men') }, { s: s('wpp_life_exp_female'), label: t('Women') }], gran: 'y', height: 230 });
    C({ title: t('Age structure'), unit: t('% of population, UN estimate'), series: [{ s: s('wpp_share_0_14'), label: t('Aged 0 to 14') }, { s: s('wpp_share_15_64'), label: t('Aged 15 to 64') }, { s: s('wpp_share_65plus'), label: t('Aged 65 and over') }], gran: 'y', height: 230, yFmt: v => nf(v, 0) + '%', valFmt: v => nf(v, 1) + '%' });
    C({ title: t('Registered births, deaths and marriages'), unit: t('events a year, Central Administration of Statistics'), series: [{ s: s('cas_births'), label: t('Births') }, { s: s('cas_deaths'), label: t('Deaths') }, { s: s('cas_marriages'), label: t('Marriages') }, { s: s('cas_divorces'), label: t('Divorces') }], gran: 'y', height: 250,
      note: t('2025 may be provisional. Deaths in 2025 include war deaths and late registrations; they are not split.') });
    C({ title: t('Registered voters'), unit: t('people, Central Administration of Statistics'), series: [{ s: s('cas_voters'), label: t('All') }, { s: s('cas_voters_male'), label: t('Men') }, { s: s('cas_voters_female'), label: t('Women') }], gran: 'y', height: 230 });
    C({ title: t('Syrian refugees registered, year end'), unit: t('people, UNHCR'), series: [{ s: s('unhcr_syrian_refugees_yearend'), label: t('Syrian refugees') }, { s: s('unhcr_refugees_all_origins_yearend'), label: t('Refugees of all origins') }], gran: 'y', height: 240, note: t('Year-end 2025 reflects de-registration and returns; the planning figure counts 1.12 million Syrians present.') });
    C({ title: t('Syrian refugees by region, monthly'), unit: t('people, UNHCR portal, 2013 to June 2026'), series: [{ s: s('unhcr_odp_syrian_refugees_bekaa'), label: t('Bekaa') }, { s: s('unhcr_odp_syrian_refugees_beirut_and_mount_lebanon'), label: t('Beirut and Mount Lebanon') }, { s: s('unhcr_odp_syrian_refugees_north_lebanon'), label: t('North') }, { s: s('unhcr_odp_syrian_refugees_south_lebanon_and_nabatieh'), label: t('South and Nabatieh') }], gran: 'm', height: 250, note: t('Only four regions are public; district counts are in dashboards with no open interface.') });
    C({ title: t('Migrants'), unit: t('people'), series: [{ s: s('undesa_emigrant_stock'), label: t('Lebanon-born abroad') }, { s: s('undesa_immigrant_stock'), label: t('Foreign-born in Lebanon') }, { s: s('emigrants_information_international_reported'), label: t('Leaving each year (reported)') }], gran: 'y', height: 240, note: t('The UN stock undercounts the diaspora, and no official emigration series exists.') });
    C({ title: t('Lebanese refugees and asylum-seekers abroad'), unit: t('people, year end, UNHCR'), series: [{ s: s('unhcr_lebanese_refugees_abroad'), label: t('Refugees') }, { s: s('unhcr_lebanese_asylum_seekers_abroad'), label: t('Asylum-seekers') }], gran: 'y', height: 230 });
    C({ title: t('Border crossings'), unit: t('crossings a year, all travellers, Central Administration of Statistics'), series: [{ s: s('cas_border_arrivals_total'), label: t('Arrivals') }, { s: s('cas_border_departures_total'), label: t('Departures') }], gran: 'y', height: 230, note: t('These count every traveller, including Lebanese: it is not a tourism series.') });
    C({ title: t('Beirut airport passengers'), unit: t('passengers a year'), series: [{ s: s('cas_airport_arrivals'), label: t('Arrivals') }, { s: s('cas_airport_departures'), label: t('Departures') }], gran: 'y', height: 230 });
    C({ title: t('Palestinians'), unit: t('people'), series: [{ s: s('unrwa_registered_refugees_lebanon_reported'), label: t('Registered with UNRWA (reported)') }, { s: s('lrp_palestinians'), label: t('Planning figure') }], gran: 'y', height: 220, note: t('The 2025 UNRWA mandate figure (228,274) is far below older registered counts and its definition is unverified, so it is not charted.') });
    // the districts
    const cz = (PL.cz && PL.cz.cazas) || {}, rows = Object.entries(cz).filter(([, c]) => c.pop);
    const dc = document.createElement('div'); dc.className = 'fb-card wide';
    dc.innerHTML = `<h4 class="fb-t">${esc(t('The 26 districts'))}</h4><p class="fb-u mono dim">${esc(t('people, 2026 planning figures, OCHA Lebanon Response Plan package (CC BY)'))}</p><div class="chips sm" id="peoMet" role="group" aria-label="${esc(t('Measure'))}">${PEO_MET.map(m => `<button type="button" class="chip sm-c" data-m="${m.id}" aria-pressed="${m.id === PEO.metric}">${esc(t(m.label))}</button>`).join('')}</div><div class="fb-mapwrap"><div id="peoMap"></div><div id="peoTbl"></div></div>`;
    g.appendChild(dc);
    const drawD = () => {
      const k = PEO.metric, vals = {}; rows.forEach(([p, c]) => { if (c.pop[k] != null) vals[p] = c.pop[k]; });
      const hi = Math.max(1, ...Object.values(vals));
      $('#peoMap').innerHTML = fbMap(PL.geo, { level: 'adm2', fill: a => ({ fill: vals[a.p] == null ? 'var(--stone)' : fbShade(Math.sqrt(vals[a.p] / hi), '--cedar'), title: vals[a.p] == null ? '' : nf(vals[a.p]) }), aria: t('Map of Lebanon by district: population') }) + fbLegend(0, hi, v => nfCompact(v), '--cedar') + fbSrcLine([FB_DIST_SRC]);
      $('#peoTbl').innerHTML = fbTable([{ h: t('District') }, { h: t('Lebanese'), cls: 'num' }, { h: t('Syrians'), cls: 'num' }, { h: t('Total'), cls: 'num' }], rows.slice().sort((a, b) => (b[1].pop[k] || 0) - (a[1].pop[k] || 0)).slice(0, 14).map(([p, c]) => [(LANG === 'ar' && c.ar) || c.n, nf(c.pop.lebanese_2026 || 0), nf(c.pop.syrians_2026 || 0), nf(c.pop.total_2026 || 0)])) + `<p class="note">${esc(t('The 14 largest districts for the measure chosen. All 26 are in the district download.'))} ${fbDl('data/csv/districts.csv', 'CSV')}</p>`;
    };
    $('#peoMet').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; PEO.metric = b.dataset.m; $$('#peoMet [data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawD(); }); drawD();
    // the 12 camps
    const camps = ex.camps || [];
    if (camps.length) {
      const cc = document.createElement('div'); cc.className = 'fb-card wide';
      cc.innerHTML = `<h4 class="fb-t">${esc(t('Palestinian camps, 2017 census'))}</h4><p class="fb-u mono dim">${esc(t('people counted, by nationality'))}</p>` + fbTable([{ h: t('Camp') }, { h: t('Palestine refugees from Lebanon'), cls: 'num' }, { h: t('From Syria'), cls: 'num' }, { h: t('Lebanese'), cls: 'num' }, { h: t('Syrian'), cls: 'num' }, { h: t('Total'), cls: 'num' }],
        camps.slice().sort((a, b) => (b.total || 0) - (a.total || 0)).map(c => [t(c.n), plNum(c.prl), plNum(c.prs), plNum(c.lebanese), plNum(c.syrian), plNum(c.total)])) +
        `<p class="fb-src note">${esc(t('Source'))}: <a href="https://www.pcbs.gov.ps/portals/_pcbs/PressRelease/Press_En_Leb-21-12-2017-results-en-2.pdf" target="_blank" rel="noopener noreferrer">pcbs.gov.ps</a>. ${esc(t('Licence'))}: ${esc(t(FB_UNSTATED))}.</p>`;
      g.appendChild(cc);
    }
    const f = (ex.extras.facts || [])[0];
    if (f) { const d = document.createElement('div'); d.className = 'fb-card wide'; d.innerHTML = `<h4 class="fb-t">${esc(t('The last census was in 1932'))}</h4><p>${esc(t(f.fact))}</p><p class="note">${(f.sources || []).slice(0, 3).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(x.url))}</a>`).join(', ')}</p>`; g.appendChild(d); }
    el.insertAdjacentHTML('beforeend', `<h4 class="fb-t pl-s">${esc(t('All series in this section'))}</h4><div id="peoAll"></div>`);
    fbBrowse($('#peoAll'), ps.series || [], { per: 12 });
  });
}
