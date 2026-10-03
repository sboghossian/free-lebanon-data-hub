/* ------------------------------------------------------------ timeline-only page: the floating event card (same dialog pattern as the year card) */
let EVC = null, evcBack = null;  // EVC: id of the event whose card is open; evcBack: the mark that gets focus back
function openEventCard(id) {
  const c = $('#evCard'), e = EVBY[id];
  if (!c || !e) return;
  closeYearCard();
  EVC = id; evcBack = id;
  c.innerHTML = `<div class="evc-top"><span class="k">Event</span><button type="button" class="yc-x" data-evclose="1" aria-label="Close the event card">×</button></div>` + detailHTML(e);
  c.hidden = false; c.scrollTop = 0;
  const h = $('h4', c);
  if (h) { h.id = 'evH'; h.tabIndex = -1; c.setAttribute('aria-labelledby', 'evH'); h.focus({ preventScroll: true }); }
}
function closeEventCard(opts = {}) {
  const c = $('#evCard');
  if (!c || c.hidden) return;
  const back = evcBack;
  c.hidden = true; c.innerHTML = ''; EVC = null; TL.sel = null;
  $$('#tl circle.sel').forEach(n => n.remove());
  $$('#tl .rk.on').forEach(n => n.classList.remove('on'));
  if (opts.focus !== false && back) { const m = $(`#tl [data-id="${CSS.escape(back)}"]`); if (m) m.focus({ preventScroll: true }); }
}
