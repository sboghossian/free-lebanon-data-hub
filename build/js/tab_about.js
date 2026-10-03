/* ------------------------------------------------------------ About tab: counts, how the sources were checked, translation coverage, the citation and its copy button.
   The text is static markup (build/hub/emit_about.py); the numbers come from the build, so they never go stale. */
const aboutBase = hubRenderers.about;
const aboutItems = rows => rows.filter(r => r[1] != null).map(r => `<div><dt>${esc(r[0])}</dt><dd>${r[1]}</dd></div>`).join('');
function aboutFill() {
  const C = D.counts || {}, T = D.tabs || {}, A = T.about || {};
  const stats = $('#aboutStats');
  if (stats) stats.innerHTML = aboutItems([[t('Places'), C.places != null ? nf(C.places) : null], [t('Data series'), A.series ? nf(A.series) : null], [t('World indicators'), (T.world || {}).n ? nf(T.world.n) : null],
    [t('Countries and groups'), A.countries ? nf(A.countries) : null], [t('Laws'), A.laws ? nf(A.laws) : null], [t('Downloadable files'), A.files ? nf(A.files) : null]]);
  const un = $('#aboutN'); if (un) un.textContent = A.unchecked != null ? nf(A.unchecked) : '';
  const jev = $('#aboutJev');
  if (jev) {
    const c = { g: 0, w: 0, u: 0, x: 0, d: 0, none: 0 }; let n = 0;
    (D.events || []).forEach(e => (e.parts || []).forEach(p => { n++; if (!p.u) c.none++; else c[p.g in c ? p.g : 'x']++; }));
    const pc = k => n ? nf(c[k]) + ' (' + nf(100 * c[k] / n, 1) + '%)' : null;
    jev.innerHTML = `<div class="wide"><dt>${esc(t('Source links on the timeline'))}</dt><dd>${nf(n)}</dd></div>` + aboutItems([[t('Jev: source supports this'), pc('g')], [t('Jev: weak match'), pc('w')],
      [t('Jev: the page does not describe this'), pc('u')], [t('not machine-checked'), pc('x')], [t('data page'), pc('d')], [t('no source link'), pc('none')]]);
  }
  const lg = $('#aboutLang'), tr = A.tr;
  if (lg && tr) lg.innerHTML = ['ar', 'fr'].filter(l => tr[l]).map(l => `<div class="wide"><dt lang="${l}">${esc(LANG_NAME[l])}</dt><dd>${esc(t('{p}% of {n} content strings translated, the interface in full', { p: nf(tr[l].pct, 1), n: nf(tr[l].total) }))}</dd></div>`).join('');
}
HUB.tab('about', { render(args, info) {
  aboutBase(args, info);
  aboutFill();
  const b = $('#citeCopy');
  if (b && !b.dataset.bound) {
    b.dataset.bound = '1';
    b.addEventListener('click', () => {
      const c = $('#citeText'), done = $('#citeDone'), txt = c ? c.textContent : '';
      const say = ok => { if (done) { done.textContent = ok ? t('Copied') : t('Select the text and copy it'); setTimeout(() => { done.textContent = ''; }, 2500); } };
      try { navigator.clipboard.writeText(txt).then(() => say(true), () => say(false)); } catch (e) { say(false); }
    });
  }
} });
