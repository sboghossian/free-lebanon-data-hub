/* ------------------------------------------------------------ downloads through the viewer
   The artifact viewer never lets a page download through a plain link, so every <a download> and
   every generated file goes through the `downloads` capability: the viewer confirms, then saves.
   Outside the viewer (local builds, the checks) window.claude is absent and links behave as usual. */
const HubDL = (() => {
  let ns, src;
  const get = () => {
    const c = window.claude;
    if (ns !== undefined && src === c) return Promise.resolve(ns);
    src = c;
    if (!c || typeof c.use !== 'function') return Promise.resolve(ns = null);
    return c.use('downloads').then(x => (ns = x || null), () => (ns = null));
  };
  const note = msg => {
    let el = document.getElementById('dlNote');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dlNote'; el.className = 'dl-note'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg; el.hidden = false;
    clearTimeout(note.t); note.t = setTimeout(() => { el.hidden = true; }, 5000);
  };
  const MSG = {
    rate_limited: () => t('A download is already waiting for your confirmation.'),
    too_large: () => t('This file is too large to save here.'),
    other: () => t('Downloads are not available in this view.'),
  };
  /* Offer a file to the viewer. Returns false when the viewer cannot run downloads (caller falls back). */
  const save = async (filename, data) => {
    const dl = await get();
    if (!dl) return false;
    try { await dl.save({ filename, data }); }
    catch (e) {
      const code = e && e.code;
      if (code !== 'declined') note((MSG[code] || MSG.other)());
    }
    return true;
  };
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a[download]');
    if (!a || !window.claude || a.hasAttribute('data-local')) return;
    ev.preventDefault();
    const href = a.getAttribute('href') || '';
    const name = a.getAttribute('download') || decodeURIComponent(href.split('/').pop().split('?')[0]) || 'data.csv';
    fetch(href).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => save(name, b)).then(ok => { if (!ok) note(MSG.other()); })
      .catch(() => note(MSG.other()));
  });
  return { save, get };
})();
