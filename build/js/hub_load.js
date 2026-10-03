/* ------------------------------------------------------------ lazy data: fetch once, cache, spinner, error state with Retry.
   hubLoad(path, {as:'json'|'text', retries, timeout}) -> Promise (cached by path; a failed load is not cached, so Retry works).
   hubLoadInto(el, paths, build, opts) shows a spinner in el, loads one path or a list, then calls build(...results); on failure it shows an error with a Retry button.
   Paths are relative to the page (data/world/indicators/NY.GDP.PCAP.CD.json); <meta name="hub-base" content="..."> prefixes them if the files live elsewhere. */
const HUB_BASE = (document.querySelector('meta[name="hub-base"]') || {}).content || '';
const hubCache = new Map();
function hubLoad(path, opts = {}) {
  const key = path + '|' + (opts.as || 'json');
  if (hubCache.has(key)) return hubCache.get(key);
  const tries = (opts.retries == null ? 1 : opts.retries) + 1;
  const p = (async () => {
    let last;
    for (let i = 0; i < tries; i++) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opts.timeout || 45000);
      try {
        const r = await fetch(HUB_BASE + path, { signal: ctl.signal });
        if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return opts.as === 'text' ? await r.text() : await r.json();
      } catch (e) { last = e; if (e.status && e.status < 500) break; } finally { clearTimeout(to); }
    }
    last.path = path;
    throw last;
  })();
  hubCache.set(key, p);
  p.catch(() => hubCache.delete(key));
  return p;
}
const hubLoadingHTML = label => `<div class="hub-load" role="status" aria-live="polite"><span class="hub-spin" aria-hidden="true"></span><span>${esc(label || t('Loading data...'))}</span></div>`;
const hubErrorHTML = err => `<div class="hub-err" role="alert"><p><b>${esc(t('Could not load this data.'))}</b> ${esc(t('Check your connection, then try again.'))}</p><p class="mono dim">${esc((err && err.path) || '')} ${esc((err && err.message) || '')}</p><button type="button" class="chip" data-retry>${esc(t('Try again'))}</button></div>`;
function hubLoadInto(el, paths, build, opts = {}) {
  const list = Array.isArray(paths) ? paths : [paths], tok = el._hubTok = (el._hubTok || 0) + 1;
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = hubLoadingHTML(opts.label);
  return Promise.all(list.map(p => hubLoad(p, opts))).then(res => {
    if (el._hubTok !== tok) return;
    el.removeAttribute('aria-busy'); el.innerHTML = '';
    return build(...res);
  }, err => {
    if (el._hubTok !== tok) return;
    el.removeAttribute('aria-busy');
    el.innerHTML = hubErrorHTML(err);
    el.querySelector('[data-retry]').addEventListener('click', () => hubLoadInto(el, paths, build, opts));
  });
}
