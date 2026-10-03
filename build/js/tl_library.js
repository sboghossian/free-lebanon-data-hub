/* ------------------------------------------------------------ v4 source library: one table of every unique source, with honest status */
// D.lib rows: [url, title, publisher, tier, pillars, years, alive, machine-read, agent-read, kept, graded by]
const LIB = D.lib;
const CITED = {};
EV.forEach(e => e.parts.forEach(p => { if (p.u) (CITED[p.u] = CITED[p.u] || new Set()).add(e.id); }));
const LIB_TIER = { un: 'unrated', bl: 'blocked' };
let libN = 200;
function libFilter() {
  const q = nrm($('#libQ').value), t = $('#libTier').value, pl = $('#libPil').value, st = $('#libSt').value;
  return LIB.filter(r => {
    if (t && r[3] !== t) return false;
    if (pl && !String(r[4] || '').includes(pl)) return false;
    if (st === 'kept' && !r[9]) return false;
    if (st === 'dropped' && r[9]) return false;
    if (st === 'dead' && r[6] !== 0) return false;
    if (st === 'mread' && !r[7]) return false;
    if (st === 'aread' && !r[8]) return false;
    if (st === 'cited' && !CITED[r[0]]) return false;
    if (q && !nrm(r[0] + ' ' + (r[1] || '') + ' ' + (r[2] || '')).includes(q)) return false;
    return true;
  });
}
const yn = v => (v === 1 ? 'yes' : v === 0 ? '<span class="bad-t">no</span>' : '<span class="dim">not fetched</span>');
function renderLibrary() {
  const rows = libFilter(), shown = rows.slice(0, libN);
  $('#libBody').innerHTML = shown.map(r => {
    const n = CITED[r[0]] ? CITED[r[0]].size : 0;
    return `<tr class="${r[9] ? '' : 'drop'}"><td class="lib-t"><a href="${esc(r[0])}" target="_blank" rel="noopener">${esc(r[1] || hostOf(r[0]))}</a><span class="lib-pub">${esc(r[2] || hostOf(r[0]))}${r[9] ? '' : ' · dropped'}</span></td>`
      + `<td class="mono">${esc(LIB_TIER[r[3]] || r[3])}</td><td class="mono">${esc(r[4] || '')}</td><td class="mono">${esc(r[5] || '')}</td>`
      + `<td>${yn(r[6])}</td><td>${r[7] ? 'yes' : 'no'}</td><td>${r[8] ? 'yes' : 'no'}</td>`
      + `<td class="num">${n ? `<button type="button" class="lnk" data-cite="${esc(r[0])}" aria-label="Show the ${n} events citing this source on the timeline">${n}</button>` : '0'}</td></tr>`;
  }).join('') || '<tr><td colspan="8" class="note">No source matches these filters.</td></tr>';
  $('#libCount').textContent = `${rows.length.toLocaleString('en-US')} of ${LIB.length.toLocaleString('en-US')} sources` + (rows.length > shown.length ? `, first ${shown.length.toLocaleString('en-US')} shown` : '');
  const more = $('#libMore');
  more.hidden = rows.length <= libN;
  more.textContent = `Show ${Math.min(200, rows.length - libN)} more`;
}
renderers.library = renderLibrary;
let libT = null;
$('#libQ')?.addEventListener('input', () => { clearTimeout(libT); libT = setTimeout(() => { libN = 200; renderLibrary(); }, 160); });
['#libTier', '#libPil', '#libSt'].forEach(id => $(id)?.addEventListener('change', () => { libN = 200; renderLibrary(); }));
$('#libMore')?.addEventListener('click', () => { libN += 200; renderLibrary(); });
$('#libBody')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-cite]'); if (!b) return;
  clearFilters();
  F.cite = b.dataset.cite;
  autoFit();
  show('timeline');
});
