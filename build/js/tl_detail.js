/* ------------------------------------------------------------ v4 event detail: answer fields, office holders at the date, year context, sources */
const PREC_W = { day: N('exact day'), month: N('month only'), year: N('year only'), range: N('a span of years'), decade: N('a decade') };
const fchip = (attr, v, label) => `<button type="button" class="tchip" ${attr}="${esc(v)}" data-tip="${tipA(t('Filter'), ' ' + t('Show only events with {label}', { label }))}">${esc(label)}</button>`;

function officeRows(e, compact) {
  const off = offFor(e), d0 = periodOf(e)[0], out = [];
  const row = (k, v) => out.push(`<div class="af-r"><dt>${esc(t(k))}</dt><dd>${v}</dd></div>`);
  if (d0 < '1920-01-01') {  // before Greater Lebanon: the rulers list, not presidents and ministers
    RULER_CODES.filter(c => off[c] && off[c].length).forEach(c => row(offName(c), holderText(c, off[c], off).html));
    if (!out.length) row('Ruler', `<span class="dim">${esc(t('no record in the rulers list'))}</span>`);
    return out.join('');
  }
  if (off.P.length) row('President', holderText('P', off.P, off).html);
  else if (off.H.length) row('President', `<span class="dim">${esc(t('not in the office list before 1941'))}</span>`);
  if (off.H.length && d0 < '1946-09-02') row('High Commissioner', holderText('H', off.H, off).html);
  const cab = off.C.length === 1 ? ` <span class="dim">· ${esc(off.C[0].name)}</span>` : '';
  if (off.PM.length || d0 >= '1926') row('Prime minister', holderText('PM', off.PM, off).html + cab);
  if (!compact) row('Speaker', holderText('S', off.S, off).html);
  if (off.G.length || d0 >= '1963-08-28') row('BDL governor', holderText('G', off.G, off).html);
  if (!compact && (off.A.length || d0 >= '1945-08-01')) row('Army commander', holderText('A', off.A, off).html);
  return out.join('');
}

function answerFields(e, compact) {
  const rows = [], d0 = periodOf(e)[0];
  const row = (k, v, cls) => rows.push(`<div class="af-r${cls ? ' ' + cls : ''}"><dt>${esc(t(k))}</dt><dd>${v}</dd></div>`);
  if (!compact) row('Date', `${esc(edate(e))} <span class="dim">(${esc(t(PREC_W[e.prec] || e.prec))})</span>`);
  if (e._ty.length) row('Type', e._ty.map(ty => fchip('data-ftype', ty, typeName(ty))).join(''));
  if (e._ac.length) row('Actors', e._ac.map(a => fchip('data-factor', a, a)).join(''));
  if (e.pl) row('Place', fchip('data-fplace', e.pl, e.pl));
  if (e.law) row('Law', esc(e.law));
  if (e.ag) {
    const a = e.ag;
    row('Agreement', `<b>${esc(a.n)}</b><span class="af-s">${[a.k ? esc(t('kind: {v}', { v: typeName(a.k) })) : '', a.pa && a.pa.length ? esc(t('parties: {v}', { v: a.pa.join(', ') })) : '', a.st ? esc(t('status: {v}', { v: a.st })) + (a.sn ? ' (' + esc(a.sn) + ')' : '') : ''].filter(Boolean).join(' · ')}</span>`);
  }
  if (e.deaths) row('Deaths', `${esc(e.deaths.v)} <span class="dim">${esc(t('as the source gives them'))}</span> ${src({ l: e.deaths.u ? hostOf(e.deaths.u) : t('no source link'), u: e.deaths.u, c: e.deaths.c })}`);
  const when = esc(atStart(e) ? t('at the start of the period, {d}', { d: fmtDate(d0) }) : t('on {d}', { d: fmtDate(d0) }));
  let h = `<dl class="af">${rows.join('')}</dl>`;
  h += `<div class="af-h"><span class="k">${esc(t('In office {when}', { when: '\u0001' })).replace('\u0001', when)}</span></div><dl class="af">${officeRows(e, compact)}</dl>`;
  const y = e._y0;
  h += `<div class="af-h"><span class="k">${esc(t('{y} in numbers', { y: fy(y) }))}</span><button type="button" class="chip ybtn" data-year="${y}">${esc(t('Year card for {y}', { y: fy(y) }))}</button></div><dl class="af">`
    + `<div class="af-r"><dt>${esc(t('LBP per US$'))}</dt><dd>${numSrc('lbp_usd_longrun', y, v => t('official') + ' ' + fLbp(v), 1)}${ycMarket(y)}</dd></div>`
    + `<div class="af-r"><dt>${esc(t('Population'))}</dt><dd>${numSrc('ppl_pop_resident_model', y, fMil, 1)}</dd></div>`
    + `<div class="af-r"><dt>${esc(t('GDP per capita'))}</dt><dd>${numSrc('gdp_pc_maddison', y, v => t('{v} int$', { v: fmt(v, 0) }), 1)}</dd></div></dl>`;
  return `<div class="afs${compact ? ' cmp' : ''}">${h}</div>`;
}

// Where the rows behind one event disagree: dates, agent tags, Jev verdicts.
function conflictsHTML(e) {
  const out = [];
  const dates = [...new Set(e.parts.map(p => p.date).filter(d => d && d !== e.date))];
  if (dates.length) out.push(esc(t('Other dates in the sources: {d}.', { d: dates.map(d => pdate(d)).join(', ') })));
  const tags = [...new Set(e.parts.map(p => p.c))];
  if (tags.length > 1) out.push(esc(t('The research files tag this differently: {tags}. The event shows the best tag.', { tags: e.parts.map(p => t(p.c) + ' (' + p.file + ')').join(', ') })));
  const gs = [...new Set(e.parts.filter(p => p.u).map(p => p.g || 'x'))];
  if (gs.includes('g') && (gs.includes('u') || gs.includes('w'))) out.push(esc(t('Jev grounded one source and not another; the trust level uses the best one.')));
  if (e.note) out.push(esc(e.note));
  if (!out.length) return '';
  return `<div class="d-conf"><span class="k">${esc(t('Conflicts and notes'))}</span><ul>${out.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
}

function detailHTML(e) {
  if (!e) return `<p class="note">${esc(t('Pick an event on the timeline.'))}</p>`;
  const rk = RKBY[e.id];
  let h = `<div class="d-head"><span class="mono">${esc(edate(e))}</span>${e.lanes.map(l => `<span class="lane-tag ln-${l}">${esc(LN[l] ? t(LN[l].name) : l)}</span>`).join('')}<span class="mono dim">${esc(t('weight {w}', { w: e.w }))}</span>${cf(e.c)}${levelBadge(e.gr)}${e.fig ? `<span class="mono dim">${esc(t('figure: {f}', { f: e.fig }))}</span>` : ''}</div><h4>${th(e.title)}</h4>`;
  if (rk) h += `<div class="d-rank"><span class="rk-n">${rk.rank}</span><div><b>${esc(t('Ranked {n} of 12', { n: rk.rank }))} · ${esc(t(rk.area))}</b><p>${th(rk.title)}. ${esc(rk.text)}</p>${srcs(rk.src)}</div></div>`;
  h += `<div class="d-grid"><div class="d-ans">${answerFields(e, false)}</div>`;
  h += `<div class="d-srcs"><span class="k">${esc(t('Sources ({n})', { n: e.parts.length }))}</span>${e.parts.map(p => partHTML(p, e)).join('')}${conflictsHTML(e)}</div></div>`;
  h += claimChips(e.id);
  return h;
}
