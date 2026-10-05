/* ------------------------------------------------------------ Places tab, "The 2023 to 2026 war" section (D6). Data: data/war/series.json, data/war/tables.json, data/places/cazas.json (district displacement and returns), data/geo/lebanon.json.
   Every chart shows its source and licence; the IOM-derived displacement totals are not published (IOM terms), see the note on the page. Hash: #war. */
const WAR = { metric: 'hosted' };
const WAR_COL = { sector: N('Sector'), damage: N('Damage'), losses: N('Losses'), needs: N('Needs'), indicator: N('Indicator'), value: N('Value'), unit: N('Unit'), date: N('Date'), speaker: N('Speaker'), statement: N('Statement'), low: N('Low'), high: N('High') };
const WAR_MET = [{ id: 'hosted', label: N('Displaced people hosted'), k: 'idps_hosted_31may2025' }, { id: 'from', label: N('Displaced from the district'), k: 'idps_displaced_from_here_31may2025' },
  { id: 'ret_to', label: N('Returned to the district'), k: 'returned_to_district_oct2024_may2025' }, { id: 'ret_from', label: N('Returned from the district'), k: 'returned_from_district_departure_oct2024_may2025' }];
function plWar(el) {
  fbLoad(el, ['data/war/series.json', 'data/war/tables.json'], (ws, wt) => {
    const W = fbIndex([ws]), s = id => W[id], last = id => fbLast(s(id));
    const k26 = last('war26_killed_cum'), i26 = last('war26_injured_cum'), k24 = last('war2324_killed_cum'), gov = last('idp_total_registered_2026'), sh = last('idp_in_collective_shelters_2026');
    el.innerHTML = `<p class="lead">${esc(t('Two linked wars: the war that began on 8 October 2023 and was suspended by the November 2024 ceasefire, and the war that began on 2 March 2026. Figures come from the health ministry, the UN and humanitarian agencies, and are revised as they are verified.'))}</p>` +
      fbStats([{ k: t('Killed since 2 March 2026'), v: k26 ? nf(k26[1]) : '', n: t('Ministry of Public Health, {d}', { d: k26 ? fbLongDate(k26[0]) : '' }) }, { k: t('Injured since 2 March 2026'), v: i26 ? nf(i26[1]) : '', n: t('Ministry of Public Health, {d}', { d: i26 ? fbLongDate(i26[0]) : '' }) },
        { k: t('Killed, 8 Oct 2023 to Dec 2024'), v: k24 ? nf(k24[1]) : '', n: t('Ministry of Public Health, {d}', { d: k24 ? fbLongDate(k24[0]) : '' }) }, { k: t('Displaced, government count, peak'), v: gov ? nf(Math.max(...s('idp_total_registered_2026').points.map(p => p[1]))) : '', n: t('registered with the authorities, 2026') },
        { k: t('In collective shelters'), v: sh ? nf(sh[1]) : '', n: sh ? fbLongDate(sh[0]) : '' }]) +
      `<p class="fb-note-band">${esc(t('Health ministry counts include combatants and are revised. Counts of the displaced are not one line: the government count froze for three months in 2026, and other estimates were re-based in a single week. Totals from the IOM Displacement Tracking Matrix are not published here because IOM\'s terms do not allow redistribution; the government count and the IDMC reports are shown instead.'))}</p><div class="fb-grid" data-g></div>`;
    const g = el.querySelector('[data-g]'), C = o => fbCard(g, o);
    C({ title: t('Killed and injured since 2 March 2026'), unit: t('people, cumulative, health ministry'), series: [{ s: s('war26_killed_cum'), label: t('Killed') }, { s: s('war26_injured_cum'), label: t('Injured') }], gran: 'd', height: 250, note: t('Injured counts stop on 17 August 2026 in the sources found.') }).fig.classList.add('wide');
    C({ title: t('Killed and injured, 2023 to 2024'), unit: t('people, cumulative from 8 October 2023, health ministry'), series: [{ s: s('war2324_killed_cum'), label: t('Killed') }, { s: s('war2324_injured_cum'), label: t('Injured') }], gran: 'd', height: 230,
      note: t('Derived from OCHA flash updates. The injured count from April to September 2024 is casualties minus deaths.') });
    C({ title: t('Since the 17 April 2026 ceasefire announcement'), unit: t('people, cumulative, health ministry'), series: [{ s: s('war26_postceasefire_killed_cum'), label: t('Killed') }, { s: s('war26_postceasefire_injured_cum'), label: t('Injured') }], gran: 'd', height: 230 });
    C({ title: t('Displaced and sheltered, 2026'), unit: t('people'), series: [{ s: s('idp_total_registered_2026'), label: t('Displaced, government count') }, { s: s('idp_in_collective_shelters_2026'), label: t('In collective shelters') }, { s: s('idmc_idu_cumulative_displaced_2026'), label: t('Displaced, IDMC, first weeks'), dash: true }], gran: 'd', height: 250,
      note: t('The government count froze at 1,049,328 from 17 March to 18 June 2026. The lines are different sources and are not additive.') });
    C({ title: t('Collective shelters open'), unit: t('shelters, and schools used as shelters'), series: [{ s: s('collective_shelters_open_2026'), label: t('Shelters open') }, { s: s('schools_used_as_shelters_public_2026'), label: t('Public schools used') }, { s: s('schools_used_as_shelters_all_2026'), label: t('Schools of all types') }], gran: 'd', height: 230 });
    C({ title: t('Displacement from conflict, by year'), unit: t('people'), series: [{ s: s('idmc_new_displacements_conflict'), label: t('New displacements in the year') }, { s: s('idmc_idp_stock_end_year'), label: t('Displaced at year end') }], gran: 'y', height: 230, note: t('IDMC annual figures, 2009 to 2025.') });
    C({ title: t('Health workers and health care'), unit: t('people, cumulative since 2 March 2026, WHO'), series: [{ s: s('who_ssa_hw_killed_cum_2026'), label: t('Health workers killed') }, { s: s('who_ssa_hw_injured_cum_2026'), label: t('Health workers injured') }], gran: 'd', height: 230, note: t('WHO counts are revised after verification: 53 killed on 24 March became 42 on 27 March.') });
    C({ title: t('Hospitals and health centres'), unit: t('facilities, WHO'), series: [{ s: s('hospitals_damaged_2026'), label: t('Hospitals damaged') }, { s: s('hospitals_closed_2026'), label: t('Hospitals closed') }, { s: s('phcc_closed_2026'), label: t('Primary health centres closed') }], gran: 'd', height: 230 });
    C({ title: t('Incidents recorded by Insecurity Insight'), unit: t('incidents a month, open sources'), series: [{ s: s('ii_ew_incidents_monthly'), label: t('Explosive weapons') }, { s: s('ii_health_incidents_monthly'), label: t('Affecting health care') }], gran: 'm', height: 230, note: t('Only open-source reports are counted, and a month with zero means none was recorded.') });
    C({ title: t('Health workers and education, monthly'), unit: t('people and facilities'), series: [{ s: s('ii_health_hw_killed_monthly'), label: t('Health workers killed') }, { s: s('ii_health_hw_injured_monthly'), label: t('Health workers injured') }, { s: s('ii_edu_monthly'), label: t('Education facilities hit') }], gran: 'm', height: 230 });
    C({ title: t('UNIFIL: air violations'), unit: t('violations per Secretary-General reporting period'), series: [{ s: s('unifil_air_violations_period'), label: t('Air violations of Lebanese airspace') }], gran: 'm', height: 220, note: t('UN Secretary-General reports under resolution 1701; periods are about four months.') });
    C({ title: t('UNIFIL: denied freedom of movement'), unit: t('incidents a month'), series: [{ s: s('unifil_dfom_incidents_monthly'), label: t('Incidents') }], gran: 'm', height: 220 });
    // districts: displacement and returns
    const cz = (PL.cz && PL.cz.cazas) || {};
    const dm = document.createElement('div'); dm.className = 'fb-card wide';
    dm.innerHTML = `<h4 class="fb-t">${esc(t('Displacement and returns by district'))}</h4><p class="fb-u mono dim">${esc(t('IOM Displacement Tracking Matrix round 87, 31 May 2025, as shown in the OCHA Lebanon Response Plan 2026 package (CC BY)'))}</p>
      <div class="chips sm" id="warMet" role="group" aria-label="${esc(t('Measure'))}">${WAR_MET.map(m => `<button type="button" class="chip sm-c" data-m="${m.id}" aria-pressed="${m.id === WAR.metric}">${esc(t(m.label))}</button>`).join('')}</div><div class="fb-mapwrap"><div id="warMap"></div><div id="warTbl"></div></div>`;
    g.appendChild(dm);
    const drawD = () => {
      const m = WAR_MET.find(x => x.id === WAR.metric), vals = {}, all = [];
      PL.geo.adm2.forEach(a => { const v = ((cz[a.p] || {}).disp || {})[m.k]; if (v != null) { vals[a.p] = v; all.push(v); } });
      const hi = Math.max(1, ...all);
      $('#warMap').innerHTML = fbMap(PL.geo, { level: 'adm2', fill: a => ({ fill: vals[a.p] == null ? 'var(--stone)' : fbShade(Math.sqrt(vals[a.p] / hi), '--war'), title: vals[a.p] == null ? '' : nf(vals[a.p]) }), aria: t('Map of Lebanon by district') }) + fbLegend(0, hi, v => nfCompact(v), '--war') + fbSrcLine([FB_DIST_SRC]);
      $('#warTbl').innerHTML = fbTable([{ h: t('District') }, { h: t(m.label), cls: 'num' }], Object.entries(vals).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([p, v]) => [((LANG === 'ar' && (cz[p] || {}).ar) || (cz[p] || {}).n || p), nf(v)])) + `<p class="note">${esc(t('The 14 districts with the largest figure. The unit is people; returns count people who came back after the November 2024 ceasefire.'))}</p>`;
    };
    $('#warMet').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; WAR.metric = b.dataset.m; $$('#warMet [data-m]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawD(); });
    drawD();
    // tables: damage, loss, UNIFIL, government statements
    (wt.tables || []).forEach(tb => {
      const d = document.createElement('div'); d.className = 'fb-card wide';
      d.innerHTML = `<h4 class="fb-t">${th(tb.label)}</h4>${tb.unit && tb.unit !== 'mixed' ? `<p class="fb-u mono dim">${esc(t(tb.unit))}</p>` : ''}` +
        fbTable(tb.columns.map((c, i) => ({ h: t(WAR_COL[c] || c), cls: i && typeof (tb.rows[0] || [])[i] === 'number' ? 'num' : '' })), tb.rows.map(r => r.map(v => typeof v === 'number' ? nf(v, v % 1 ? 1 : 0) : (v == null ? '' : t(String(v)))))) +
        (tb.notes ? `<p class="note">${esc(Array.isArray(tb.notes) ? tb.notes.map(x => t(x)).join(' ') : t(tb.notes))}</p>` : '') + `<p class="fb-src note">${esc(t('Source'))}: <a href="${esc(tb.source)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(tb.source))}</a>. ${esc(t('Licence'))}: ${esc(tb.license && tb.license !== 'None' ? t(tb.license) : t(FB_UNSTATED))}.</p>`;
      g.appendChild(d);
    });
    el.insertAdjacentHTML('beforeend', `<p class="note">${esc(t('Left out on purpose: IOM village-level data and totals (redistribution not allowed), ACLED (restrictive terms), and an incident sheet whose underlying source is not named.'))}</p>`);
  });
}
