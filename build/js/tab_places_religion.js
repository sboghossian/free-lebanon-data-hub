/* ------------------------------------------------------------ Places tab, v10 (leg B): religion and politics.
   (a) the Religion map layer (off by default) and (b) the sect-share chart on a town page: data/places/sects-2014.json, registered voters by sect from the Interior Ministry lists of 2014 as transcribed by lub-anan.com. Never residents.
   (c) the Politics block of a town page: the results of the town's election district (2018, 2022), data/places/politics.json. Never a town's own result, never a political affiliation of the town.
   (d) the "Communities and seats over time" section (#history): data/places/history.json.
   Safety (brief v10): no text names a "dominant" sect, the layer and the chart carry the caption below, nothing here is linked from or drawn on the Strike map. */
const PL_SECT_LBL = { Maronite: N('Maronite'), 'Greek Orthodox': N('Greek Orthodox'), 'Greek Catholic': N('Greek Catholic'), 'Armenian Orthodox': N('Armenian Orthodox'), 'Armenian Catholic': N('Armenian Catholic'),
  'Syriac Orthodox': N('Syriac Orthodox'), 'Syriac Catholic': N('Syriac Catholic'), Latin: N('Latin'), Evangelical: N('Evangelical'), Chaldean: N('Chaldean'), Assyrian: N('Assyrian'), Copt: N('Copt'),
  'Christian minorities/unspecified': N('Christian minorities or unspecified'), Sunni: N('Sunni'), Shia: N('Shia'), Druze: N('Druze'), Alawite: N('Alawite'), Jewish: N('Jewish'), 'Not stated': N('Not stated'), Other: N('Other groups') };
/* theme tokens only; the largest group sets the colour, its share sets the opacity */
const PL_SECT_COL = { Maronite: 'var(--l-region)', 'Greek Orthodox': 'var(--l-soc)', 'Greek Catholic': 'var(--l-econ)', 'Armenian Orthodox': 'var(--l-law)', 'Armenian Catholic': 'color-mix(in srgb, var(--l-law) 55%, var(--paper))',
  'Syriac Orthodox': 'color-mix(in srgb, var(--l-soc) 55%, var(--paper))', 'Syriac Catholic': 'color-mix(in srgb, var(--l-econ) 55%, var(--paper))', Latin: 'color-mix(in srgb, var(--l-region) 55%, var(--paper))',
  Evangelical: 'color-mix(in srgb, var(--l-work) 55%, var(--paper))', Chaldean: 'color-mix(in srgb, var(--l-env) 55%, var(--paper))', Assyrian: 'color-mix(in srgb, var(--diesel) 55%, var(--paper))', Copt: 'color-mix(in srgb, var(--l-tech) 55%, var(--paper))',
  'Christian minorities/unspecified': 'var(--l-world)', Sunni: 'var(--l-tech)', Shia: 'var(--l-hist)', Druze: 'var(--l-env)', Alawite: 'var(--l-work)', Jewish: 'var(--occ)' };
const PL_SECT_CAP = N('Registered voters by sect, 2014 (Interior Ministry lists via lub-anan.com). Not residents.');
const plSectName = g => t(PL_SECT_LBL[g] || g);
const plShare = (v, tot) => { const x = v / tot * 100; return x > 0 && x < 0.1 ? '<' + nf(0.1, 1) + '%' : nf(x, x < 10 ? 1 : 0) + '%'; };
const plSrcLbl = u => { let x = ''; try { x = decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || '').replace(/_/g, ' '); } catch (e) { x = ''; } return fbHost(u) + (x && x.length <= 42 ? ' \u00b7 ' + x : ''); };
const plGo = id => { location.hash = HUB.href('place', id); };

/* ---------- (a) the map layer: one dot per voter list, hue = the group with the most registered voters, opacity = its share ---------- */
function plSectLayer(S) {
  const G = S.groups, lead = G.map((g, i) => i).filter(i => G[i] !== 'Not stated' && G[i] !== 'Other');
  let lo = 1, n = 0;
  const dots = [];
  Object.keys(S.rows).forEach(id => {
    const r = PL.byId[id], row = S.rows[id];
    if (!r || !row[0]) return;
    let bi = lead[0], bv = -1;
    lead.forEach(i => { if (row[i + 1] > bv) { bv = row[i + 1]; bi = i; } });
    if (bv <= 0) return;
    const sh = bv / row[0], [x, y] = fbProj(PL.geo, r.lat, r.lon);
    lo = Math.min(lo, sh); n++;
    dots.push(`<circle class="pl-dot" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="17" data-id="${esc(id)}" style="fill:${PL_SECT_COL[G[bi]]};fill-opacity:${(0.3 + 0.7 * sh).toFixed(2)}"><title>${esc(t('{p}: registered voters by sect, 2014; not residents. Open the place for the shares.', { p: plName(r) }))}</title></circle>`);
  });
  const legend = `<ul class="pl-lg" aria-label="${esc(t('Groups'))}">${G.map(g => `<li><i class="pl-sw${PL_SECT_COL[g] ? '' : ' none'}"${PL_SECT_COL[g] ? ` style="background:${PL_SECT_COL[g]}"` : ''}></i>${esc(plSectName(g))}</li>`).join('')}</ul>
    <p class="note">${esc(t('Colour: the group with the most registered voters in the list. Opacity: that group\'s share of the list, from {a} to 100%. "Not stated" and "Other groups" count in the totals and never set the colour.', { a: nf(lo * 100, 0) + '%' }))}</p>`;
  return { svg: `<g class="pl-dots">${dots.join('')}</g>`, legend, cap: t(PL_SECT_CAP) + ' ' + t('{n} voter lists are drawn. Click a dot to open its place.', { n: nf(n) }) };
}

/* ---------- (b) a town page: the shares of its registered voters by sect ---------- */
function plSectBlock(box, id, d) {
  fbLoad(box, ['data/places/sects-2014.json'], S => {
    const row = S.rows[id], cap = `<p class="note pl-cap">${esc(t(PL_SECT_CAP))}</p>`;
    if (!row) { box.innerHTML = cap + `<p class="hub-empty">${esc(t('No voter list by sect is on record for this place.'))}</p>`; return; }
    const tot = row[0], items = S.groups.map((g, i) => ({ id: g, label: plSectName(g), value: row[i + 1], last: g === 'Not stated' || g === 'Other' })).filter(x => x.value > 0)
      .sort((a, b) => (a.last - b.last) || (b.value - a.value));
    const link = d.rvu ? d.rvu.replace(/\/+$/, '') + '/' + encodeURIComponent('المذاهب') + '/' : '';
    box.innerHTML = cap + `<div class="pl-sects"></div>
      <p class="note">${esc(t('Bars show each group\'s share of the {n} registered voters on this list; the count and the share are printed beside each bar.', { n: nf(tot) }))}${row[20] ? ' ' + esc(t('"Other groups" adds up the smaller groups the list names separately, for example Armenian Protestant and Nestorian.')) : ''}
      ${tot < 100 ? esc(t('This list is small, so one voter moves a share by several points.')) : ''}${S.overlap.includes(id) ? ' ' + esc(t('This count overlaps with another place\'s list, so do not add places up.')) : ''}
      ${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(t('List by sect as transcribed'))}</a>` : ''}</p>`;
    hubBars($('.pl-sects', box), { items, max: tot, fmt: v => `${nf(v)} (${plShare(v, tot)})` });
  });
}

/* ---------- (c) a town page: the results of its election district ---------- */
const PL_POL = ['2022-parliamentary', '2018-parliamentary'];
const plBloc = b => b === 'No bloc listed' ? t(N('No bloc listed')) : b === 'Changed bloc during the term' ? t(N('Changed bloc during the term')) : t(b);
function plPolBlock(box, d, r) {
  if (!d.ed) { box.innerHTML = `<p class="hub-empty">${esc(t('The election district of this place is not on record.'))}</p>`; return; }
  fbLoad(box, ['data/places/politics.json'], P => {
    const cards = PL_POL.map(eid => {
      const E = P.elections[eid], x = E && E.districts[d.ed];
      if (!x) return '';
      const y = (E.date || eid).slice(0, 4), diff = x.to != null && x.tc != null && Math.abs(x.to - x.tc) > 1;
      return `<div class="fb-card" data-e="${esc(eid)}"><h4 class="fb-t">${esc(t('{y} parliamentary', { y: fy(y) }))}</h4>
        ${fbStats([{ k: t('Seats'), v: nf(x.seats) }, { k: t('Registered voters'), v: x.reg ? nf(x.reg) : '' }, { k: t('Turnout'), v: x.to != null ? nf(x.to, 1) + '%' : '' }].filter(s => s.v))}
        ${diff ? `<p class="note">${esc(t('The published turnout is {a}. Computed from the registered voters and the valid votes it would be {b}.', { a: nf(x.to, 1) + '%', b: nf(x.tc, 1) + '%' }))}</p>` : ''}
        <h5 class="fb-t">${esc(t('Seats by bloc'))}</h5><div data-bl></div>
        <h5 class="fb-t">${esc(t('List votes'))}</h5><div data-ls></div></div>`;
    }).filter(Boolean);
    const first = P.elections[PL_POL.find(e => P.elections[e].districts[d.ed])] || {}, q = ((first.districts || {})[d.ed] || {}).q || '';
    if (!cards.length) { box.innerHTML = `<p class="hub-empty">${esc(t('No result is on record for the election district {c}.', { c: t(d.ed) }))}</p>`; return; }
    const srcs = PL_POL.map(e => P.elections[e]).filter(Boolean);
    box.innerHTML = `<p class="note pl-cap">${esc(t('Results for the election district {c}{q}, not for {p}. Per-town results are not published, and nothing here says how a town voted.', { c: t(d.ed), q: q ? ' (' + t(q) + ')' : '', p: plName(r) }))}</p>${d.edn ? `<p class="note">${esc(d.edn)}</p>` : ''}
      <div class="fb-grid">${cards.join('')}</div>
      <p class="note">${esc(t('A bloc is the parliamentary bloc Wikipedia lists for each elected member; members who left or were expelled during the term are grouped apart. Each list shows its valid votes and the seats it won.'))}
      <a href="${HUB.href('elections', '2022-parliamentary', d.ed)}" data-hub="places" data-hash="elections/2022-parliamentary/${esc(d.ed)}">${esc(t('Full results for this district'))}</a></p>
      <p class="note pl-vsrc">${esc(t('Sources'))}: ${[...new Set(srcs.flatMap(e => (Array.isArray(e.src) ? e.src : [e.src]).filter(u => /^https?:/.test(u || ''))))].map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(plSrcLbl(u))}</a>`).join(', ')}. ${esc(t('Licence'))}: ${esc(t('CC BY-SA 4.0 (Wikipedia); the official results state no licence, so only the facts are used, with attribution'))}.</p>`;
    $$('.fb-card[data-e]', box).forEach(c => {
      const x = P.elections[c.dataset.e].districts[d.ed];
      hubBars($('[data-bl]', c), { items: x.blocs.map(b => ({ label: plBloc(b[0]), value: b[1] })), max: x.seats, fmt: v => nf(v) });
      hubBars($('[data-ls]', c), { items: x.lists.filter(l => l[1] != null).map(l => ({ label: '\u2068' + t(l[0]) + '\u2069' + (l[2] != null ? ' · ' + tp('{n} seat', '{n} seats', l[2]) : ''), value: l[1] })), fmt: v => nf(v) });
    });
  });
}

/* ---------- (d) Communities and seats over time (#history) ---------- */
const PL_HT = {   // display title and note per table of research/hub/politics/history.json (our wording; the tables carry the sources)
  'mutasarrifate-1860': [N('Mount Lebanon Mutasarrifate: population by sect, 1860'), N('An estimate. The Monthly prints the table without naming its origin. Muslims are one group in it. The shares are the publisher\'s.')],
  'mutasarrifate-1895-1913': [N('Mount Lebanon Mutasarrifate: population by sect, 1895 estimate and 1913 enumeration'), N('1895 is an official estimate; 1913 is reported as a census count. The figures are Chamie\'s as repeated on Wikipedia and were not checked against the Ottoman source. The 1913 rows are 33 short of the printed total.')],
  'double-qaimaqamate-1843-1861': [N('Double Qaimaqamate of Mount Lebanon, 1843 to 1861 (description, approximate region)'), N('A description only. The region is approximate and no map is drawn, because the sources give no exact boundary.')],
  'greater-lebanon-1922-1932-chamie': [N('Greater Lebanon: counts by sect, 1922 and 1932 (Chamie 1981)'), N('The 1922 count is the French Mandate census of 1921-22. A blank 1922 cell means the source does not break that group out, not zero. The 1932 totals differ from the census table below.')],
  'census-1932-residents-emigrants': [N('Census of 1932: residents and registered emigrants by sect (Maktabi 1999)'), N('The only national census ever taken. The resident rows add up to the printed 793,396. The emigrant columns are as printed: before and after 30 August 1924, paying and not paying tax.')],
  'census-1932-monthly': [N('Census of 1932: residents and emigrants by sect (The Monthly)'), N('The same totals as the Maktabi table, grouped differently, so some sects differ between the two tables. Compare totals, not single lines.')],
  'electoral-laws': [N('Electoral laws and the size of Parliament, 1926 to 2017'), N('Seat and district counts are as the sources state them; where two sources disagree, both are shown.')],
  'seats-1927': [N('1927 election: the 16 seats elected in 1927 (Parliament of 46)'), N('Partial. The Parliament had 46 members: 16 newly elected and 30 carried over from the Representative Council. Only the 16 are itemised by the source. No sourced seat table for the first chamber of 1926 was found.')],
  'seats-1943-1947': [N('Seats per district and sect, 1943 and 1947 elections (55 seats, five governorate districts)'), N('Christians 30 and Muslims and Druze 25: the 6 to 5 ratio.')],
  'seats-1951': [N('Seats per district and sect, 1951 election (77 seats, nine districts)'), N('Derived: the source lists the 77 members with the seat each holds, and the table counts them by district and seat. The Monthly confirms 77 deputies in nine districts.')],
  'seats-1953': [N('Seats per district and sect, 1953 election (44 seats, 33 districts)'), N('The Monthly also gives 44 deputies in 33 districts: 22 with one seat and 11 with two. Two Zahle seats have no known subdivision.')],
  'seats-1957': [N('Seats per district and sect, 1957 election (66 seats, 27 districts)'), N('The Monthly also gives 66 deputies in 27 districts.')],
  'seats-1960-1972': [N('Seats per sect under the 1960 law (99 seats, 26 qada districts), elections 1960 to 1972'), N('Christians 54, Muslims and Druze 45 (6 to 5). The 1960 law made the 26 qadas the districts. Seats per qada under that law were not found in an open source and are not given.')],
  'seats-taif': [N('Seats per sect before and after the Taif Agreement (99 to 128; 64 Christian, 64 Muslim)'), N('Used for every election from 1992. The 6 to 5 ratio became 1 to 1.')],
  'seats-1992-2005': [N('Seats per governorate block and sect, 1992 to 2005 elections (128 seats)'), N('The same block totals appear in the Hub election files for 1992, 1996, 2000 and 2005. Seats per qada district under the 2000 law were not found.')],
  'seats-2008-law': [N('Seats per district and sect under the 2008 law (26 qada districts), election of 2009'), N('The qada districts of the Doha Agreement (Law 25/2008), with Beirut in three districts.')],
  'seats-2017-law': [N('Seats per district and sect under the 2017 law (15 districts), elections of 2018 and 2022'), N('Proportional representation by list in 15 districts. The 2018 and 2022 elections use the same allocation.')],
  'beirut-i-voters-1960-1972': [N('Beirut I (1960 law): registered voters by sect, 1960 list and 1972 estimate'), N('Registered voters, not residents. Beirut I here is the district of the 1960 law with eight Christian seats. The 1972 column is an estimate and lists only the sects named by the source; blank means not listed, not zero.')]
};
const PL_HCOL = { sect: N('Community'), population: N('People'), share_pct: N('Share (%)'), group: N('Group'), y1895_estimate: N('1895, estimate'), y1913: N('1913'), y1922: N('1922'), y1932: N('1932'), residents: N('Residents'),
  emigrants_before_1924_paying_tax: N('Emigrants before 1924, paying tax'), emigrants_before_1924_not_paying: N('Emigrants before 1924, not paying'), emigrants_after_1924_paying_tax: N('Emigrants after 1924, paying tax'),
  emigrants_after_1924_not_paying: N('Emigrants after 1924, not paying'), emigrants: N('Emigrants'), law_year: N('Law'), first_election: N('First election'), seats: N('Seats'), districts: N('Districts'), unit: N('Unit'), ratio: N('Christian to Muslim ratio'),
  before_taif: N('Before Taif'), after_taif: N('After Taif'), y1960_list: N('1960 list'), y1972_estimate: N('1972, estimate'), district: N('District'), subdivision: N('Subdivision') };
const PL_HSEC = [
  { id: 'people', h: N('People by community'), l: N('Counts of people are enumerated or registered persons by civil-status sect, not residents today.'), t: ['mutasarrifate-1860', 'mutasarrifate-1895-1913', 'greater-lebanon-1922-1932-chamie', 'census-1932-residents-emigrants', 'census-1932-monthly', 'beirut-i-voters-1960-1972'] },
  { id: 'laws', h: N('Electoral laws and seats per community'), l: N('The seats of Parliament are shared by community. These tables show how the law divided them, district by district, from 1927 to 2022.'), t: ['electoral-laws', 'seats-1927', 'seats-1943-1947', 'seats-1951', 'seats-1953', 'seats-1957', 'seats-1960-1972', 'seats-taif', 'seats-1992-2005', 'seats-2008-law', 'seats-2017-law'] },
  { id: 'before', h: N('Before 1860'), l: N('The double qaimaqamate is described, not mapped.'), t: ['double-qaimaqamate-1843-1861'] }];
const plHCell = (k, v) => v == null ? '' : typeof v === 'number' ? (k === 'share_pct' ? nf(v, 1) : k === 'law_year' || k === 'first_election' ? fy(v) : nf(v)) : t(String(v));
function plHTable(tb) {
  const rows = tb.rows;
  if (!rows.length) return '';
  if (tb.id === 'double-qaimaqamate-1843-1861') return `<ul class="pl-rows">${rows.map(x => `<li>${esc(t(x.statement))}${x.approximate ? ` <span class="chip sm-c fb-tag">${esc(t('approximate'))}</span>` : ''}</li>`).join('')}</ul>`;
  if (rows[0].by_sect) {
    const per = r => Object.entries(r.by_sect).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${t(PL_SECT_LBL[k] || k)} ${nf(v)}`).join(', ');
    return fbTable([{ h: t('District') }, { h: t('Seats'), cls: 'num' }, { h: t('Seats by community') }], rows.map(r => [t(r.district) + (r.subdivision && !/unknown/.test(r.subdivision) ? ' (' + t(r.subdivision) + ')' : ''), nf(r.seats), per(r)]));
  }
  const keys = Object.keys(rows[0]).filter(k => k !== 'source_ref' && k !== 'approximate');
  return fbTable(keys.map(k => ({ h: t(PL_HCOL[k] || k), cls: typeof rows[0][k] === 'number' || rows.some(r => typeof r[k] === 'number') ? 'num' : '' })), rows.map(r => keys.map(k => plHCell(k, r[k]))));
}
const plHLic = l => /All rights reserved/.test(l) && /Wikipedia/.test(l) ? t('Wikipedia CC BY-SA 4.0 (facts only); The Monthly: numbers cited as facts with attribution')
  : /All rights reserved/.test(l) ? t('The Monthly: numbers cited as facts with attribution; no text or table layout copied') : /IPU|IFES/.test(l) ? t('Wikipedia CC BY-SA 4.0; IFES, IPU and IDEA state no licence, facts attributed') : t('Wikipedia CC BY-SA 4.0 (facts only)');
function plHCard(tb, open) {
  const ti = PL_HT[tb.id] || [tb.title, tb.note || ''], srcs = (String(tb.source || '').match(/https?:\/\/[^\s;,)]+/g) || []);
  return `<details class="fb-det pl-hd" id="plH-${esc(tb.id)}"${open ? ' open' : ''}><summary><b>${esc(t(ti[0]))}</b>${tb.estimate ? ` <span class="chip sm-c fb-tag">${esc(t('estimate'))}</span>` : ''}</summary>
    <p class="note">${esc(t(ti[1]))}</p>${plHTable(tb)}
    <p class="note pl-vsrc">${esc(t('Source'))}: ${srcs.slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(fbHost(u))}</a>`).join(', ')}. ${esc(t('Licence'))}: ${esc(plHLic(String(tb.license || '') + ' ' + String(tb.source || '')))}.</p></details>`;
}
function plHistory(el) {
  fbLoad(el, ['data/places/history.json'], H => {
    const by = Object.fromEntries(H.tables.map(x => [x.id, x])), n = H.national_2014 || {};
    const share = (rows, key, lab) => rows.map(r => ({ label: lab(r), value: r[key] }));
    el.innerHTML = `<p class="lead">${esc(t('How Lebanon\'s communities and their seats in Parliament have changed, from 1860 to 2022. These are national tables from the sources named under each one. They count people by civil-status sect, not by where they live today, and they say nothing about how any town votes.'))}</p>
      ${PL_HSEC.map(s => `<section class="fb-sec" aria-labelledby="plHs-${s.id}"><h4 class="fb-t pl-s" id="plHs-${s.id}">${esc(t(s.h))}</h4><p class="note">${esc(t(s.l))}</p>
        ${s.id === 'people' ? `<div class="fb-grid"><div class="fb-card"><h4 class="fb-t">${esc(t('Registered voters by sect, 2014'))}</h4><p class="note">${esc(t(PL_SECT_CAP))}</p><div id="plHn"></div></div>
          <div class="fb-card"><h4 class="fb-t">${esc(t('Mount Lebanon Mutasarrifate, 1860'))}</h4><p class="note">${esc(t('Population by sect. An estimate; shares as printed by the publisher.'))}</p><div id="plH60"></div></div>
          <div class="fb-card"><h4 class="fb-t">${esc(t('Census of 1932: residents'))}</h4><p class="note">${esc(t('The only national census. Maktabi 1999, as repeated on Wikipedia.'))}</p><div id="plH32"></div></div></div>` : ''}
        ${s.t.filter(id => by[id]).map(id => plHCard(by[id], false)).join('')}</section>`).join('')}
      <p class="note pl-vsrc">${esc(t('Wikipedia text is CC BY-SA 4.0 (facts only). The Monthly keeps its rights; numbers are cited as facts with attribution. lub-anan.com states no licence; only counts are used.'))}</p>`;
    if (n.by_sect) hubBars($('#plHn', el), { items: Object.entries(n.by_sect).filter(([, v]) => v > 0).map(([k, v]) => ({ label: plSectName(k), value: v })).concat(n.other ? [{ label: plSectName('Other'), value: n.other }] : []).sort((a, b) => b.value - a.value), max: n.total, fmt: v => `${nf(v)} (${plShare(v, n.total)})` });
    const m60 = by['mutasarrifate-1860'], c32 = by['census-1932-residents-emigrants'];
    if (m60) hubBars($('#plH60', el), { items: share(m60.rows.filter(r => r.share_pct != null && r.sect !== 'Total'), 'population', r => t(PL_SECT_LBL[r.sect] || r.sect)), fmt: v => nf(v) });
    if (c32) hubBars($('#plH32', el), { items: share(c32.rows.filter(r => r.residents && !/^Total/.test(r.sect)), 'residents', r => t(PL_SECT_LBL[r.sect] || r.sect)).sort((a, b) => b.value - a.value), fmt: v => nf(v) });
  });
}
