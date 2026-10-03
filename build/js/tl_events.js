/* ------------------------------------------------------------ v4 wiring: filter bar, drawer, presets, detail chips, year card, rail */
function refilter(fit) {
  if (fit) autoFit();
  saveF();
  if (current === 'timeline') renderTimeline();
}
const toggleIn = (set, v) => { if (set.has(v)) set.delete(v); else set.add(v); };
const keepFocus = (sel) => { const n = $(sel); if (n) n.focus(); };
let qT = null;
$('#q')?.addEventListener('input', ev => {
  clearTimeout(qT);
  qT = setTimeout(() => { F.q = ev.target.value; QP = parseQ(F.q); refilter(true); }, 180);
});
$('#q')?.addEventListener('keydown', ev => { if (ev.key === 'Enter') { clearTimeout(qT); F.q = ev.target.value; QP = parseQ(F.q); refilter(true); } });
$('#qHints')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-hint]'); if (!b) return;
  const q = $('#q'); q.value = b.dataset.hint; F.q = q.value; QP = parseQ(F.q);
  refilter(true); q.focus();
});
$('#moreBtn')?.addEventListener('click', () => {
  const d = $('#drawer'), open = d.hidden;
  d.hidden = !open; $('#moreBtn').setAttribute('aria-expanded', String(open));
});
$('#drawer')?.addEventListener('click', ev => {
  const t = ev.target.closest('[data-type],[data-actor],[data-place],[data-gr],[data-strip]'); if (!t) return;
  const ds = t.dataset;
  let sel = '', fit = true;
  if (ds.type) { toggleIn(F.types, ds.type); sel = `#typeCtl [data-type="${ds.type}"]`; }
  else if (ds.actor) { toggleIn(F.actors, ds.actor); sel = `#actorCtl [data-actor="${CSS.escape(ds.actor)}"]`; }
  else if (ds.place) { toggleIn(F.places, ds.place); sel = `#placeCtl [data-place="${CSS.escape(ds.place)}"]`; }
  else if (ds.gr) { toggleIn(F.gr, ds.gr); sel = `#grCtl [data-gr="${ds.gr}"]`; }
  else if (ds.strip) { toggleIn(TL.strips, ds.strip); sel = `#stripCtl [data-strip="${ds.strip}"]`; fit = false; }
  refilter(fit);
  keepFocus(sel);
});
$('#actorQ')?.addEventListener('input', () => renderFilters(visibleEvents()));
[['presSel', 'pres'], ['pmSel', 'pm'], ['govSel', 'gov'], ['eraSel', 'era']].forEach(([id, k]) => {
  $('#' + id)?.addEventListener('change', ev => { F[k] = ev.target.value; refilter(true); keepFocus('#' + id); });
});
function readYears() {
  const v = id => { const n = parseInt($(id).value, 10); return Number.isFinite(n) ? Math.max(1800, Math.min(2026, n)) : null; };
  let a = v('#fromY'), b = v('#toY');
  if (a != null && b != null && a > b) [a, b] = [b, a];
  F.from = a; F.to = b;
  if (a != null || b != null) fitRange(a == null ? 1800 : a, (b == null ? 2026 : b) + 1);
  saveF(); renderTimeline();
}
$('#fromY')?.addEventListener('change', readYears);
$('#toY')?.addEventListener('change', readYears);
$('#presets')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-preset]'); if (!b) return;
  applyPreset(b.dataset.preset);
  renderTimeline();
  keepFocus(`#presets [data-preset="${b.dataset.preset}"]`);
});
$('#activeF')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-rm]'); if (!b) return;
  removeFilter(b.dataset.rm);
  refilter(filtersOn());
  const nx = $('#activeF [data-rm]'); if (nx) nx.focus(); else $('#q').focus();
});
// Chips inside an event (detail panel or list row) add that filter.
function chipFilter(ev) {
  const t = ev.target.closest('[data-ftype],[data-factor],[data-fplace]'); if (!t) return false;
  ev.preventDefault();
  if (t.dataset.ftype) F.types.add(t.dataset.ftype);
  if (t.dataset.factor) F.actors.add(t.dataset.factor);
  if (t.dataset.fplace) F.places.add(t.dataset.fplace);
  refilter(true);
  scrollToTl();
  return true;
}
function yearBtn(ev) {
  const b = ev.target.closest('[data-year]'); if (!b) return false;
  ev.preventDefault();
  openYearCard(+b.dataset.year);
  return true;
}
$('#tlDetail')?.addEventListener('click', ev => { if (!chipFilter(ev)) yearBtn(ev); });
$('#tlList')?.addEventListener('click', ev => { if (!chipFilter(ev)) yearBtn(ev); });
$('#tl')?.addEventListener('click', ev => {
  const r = ev.target.closest('[data-office]'); if (!r) return;
  const k = r.dataset.office === 'PM' ? 'pm' : 'gov';
  F[k] = F[k] === r.dataset.name ? '' : r.dataset.name;
  refilter(!!F[k]);
});
$('#yearCard')?.addEventListener('click', ev => {
  const t = ev.target.closest('[data-ystep],[data-yclose],[data-id],[data-yfilter]'); if (!t) return;
  if (t.dataset.ystep) { openYearCard(YC + +t.dataset.ystep, { focus: false }); keepFocus(`#yearCard [data-ystep="${t.dataset.ystep}"]`); }
  else if (t.dataset.yclose) closeYearCard();
  else if (t.dataset.id) { select(t.dataset.id, { scroll: true }); }
  else if (t.dataset.yfilter) { const y = +t.dataset.yfilter; F.from = y; F.to = y; fitRange(y - 1, y + 2); saveF(); renderTimeline(); }
});
$('#evCard')?.addEventListener('click', ev => {
  if (ev.target.closest('[data-evclose]')) { closeEventCard(); return; }
  if (ev.target.closest('[data-year]')) { closeEventCard({ focus: false }); yearBtn(ev); return; }
  if (chipFilter(ev)) closeEventCard({ focus: false });
});
document.addEventListener('click', ev => {  // a click outside the event card closes it
  const c = $('#evCard');
  if (!c || c.hidden || !ev.target.isConnected || c.contains(ev.target) || ev.target.closest('#tl [data-id],#yearCard')) return;
  const a = document.activeElement;
  closeEventCard({ focus: !a || a === document.body });
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  const ec = $('#evCard');
  if (ec && !ec.hidden) { closeEventCard(); return; }
  if (!$('#yearCard').hidden) { closeYearCard(); return; }
  if (!$('#drawer').hidden && $('#drawer').contains(document.activeElement)) { $('#drawer').hidden = true; $('#moreBtn').setAttribute('aria-expanded', 'false'); $('#moreBtn').focus(); }
});
// The chapter rail on the timeline: slim by default, expandable.
function setRail(open) {
  $('.layout').classList.toggle('rail-open', open);
  $('#railBtn').setAttribute('aria-expanded', String(open));
  $('#railBtn').setAttribute('aria-label', open ? 'Hide chapter names' : 'Show chapter names');
  if (open) requestAnimationFrame(drawAllGuilloche);
}
$('#railBtn')?.addEventListener('click', () => setRail(!$('.layout').classList.contains('rail-open')));
$('.main-col')?.addEventListener('click', () => { if ($('.layout').classList.contains('rail-open')) setRail(false); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('.layout')?.classList.contains('rail-open')) { setRail(false); $('#railBtn').focus(); } });
tabs.forEach(t => t.addEventListener('click', () => setRail(false)));
if ($('#timeline')) initFilterUI();
if (!TL_ONLY) loadF();
