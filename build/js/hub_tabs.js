/* ------------------------------------------------------------ Free Lebanon Data Hub: tabs and hash routing.
   The tab list comes from the build (D.hub.tabs: id, label, routes); each tab is a plugin that registers itself with HUB.tab(id, { render(args, info) }).
   Routes: #<tab> or #<route>/<arg>/<arg>, e.g. #place/LB1234, #world/NY.GDP.PCAP.CD/2020, #compare/NY.GDP.PCAP.CD/LBN,SYR. A tab claims extra routes in its emit_<tab>.py (TAB["routes"]).
   render(args, info) runs each time the tab opens. info = { route, first: first open, lang: the language changed since it last rendered }.
   The shared `current` stays 'timeline' (the dossier's own router never runs on this page); `hubTab` is the open tab. */
const HUB_META = (D.hub && D.hub.tabs) || [];
const HUB_TABS = HUB_META.map(m => m.id);
const ROUTE_TAB = {};
HUB_META.forEach(m => { ROUTE_TAB[m.id] = m.id; (m.routes || []).forEach(r => { ROUTE_TAB[r] = m.id; }); });
const hubRenderers = {};
const hubSeen = new Set(), hubStale = new Set();
let hubTab = null, hubArgs = [], hubRoute = 'timeline';
function hubParse(hash) {
  const raw = String(hash == null ? location.hash : hash).replace(/^#/, '').split(/[?&]/)[0], seg = raw.split('/').filter((x, i) => i === 0 || x !== '').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  return { route: seg[0] || '', args: seg.slice(1), tab: ROUTE_TAB[seg[0]] || null };
}
const hubTabFromHash = () => hubParse().tab || 'timeline';
const hubHref = (route, ...args) => '#' + [route].concat(args).map(encodeURIComponent).join('/').replace(/%2C/g, ',');
function hubSetHash(route, ...args) {  // updates the address for the current tab's state without re-rendering it
  const h = hubHref(route, ...args);
  if (location.hash === h) return;
  try { history.replaceState(null, '', h); } catch (e) { /* sandboxed frame */ }
}
function hubShow(id, opts = {}) {
  if (!HUB_TABS.includes(id)) id = 'timeline';
  const same = hubTab === id;
  hubTab = id; hubArgs = opts.args || []; hubRoute = opts.route || id;
  HUB_TABS.forEach(tb => {
    const on = tb === id, btn = $('#t-' + tb), pan = $('#' + tb);
    if (btn) { btn.setAttribute('aria-selected', String(on)); btn.tabIndex = on ? 0 : -1; }
    if (pan) pan.hidden = !on;
  });
  const h = opts.hash || id;
  if (opts.push && location.hash.slice(1) !== h) { try { history.pushState(null, '', '#' + h); } catch (e) { /* sandboxed frame: the tab still switches */ } }
  const info = { route: hubRoute, first: !hubSeen.has(id), lang: hubStale.has(id), same };
  hubSeen.add(id); hubStale.delete(id);
  if (id === 'timeline') renderTimeline();
  if (hubRenderers[id]) hubRenderers[id](hubArgs, info);
  const tb = $('#t-' + id); if (tb && opts.scrollTab) tb.scrollIntoView({ block: 'nearest', inline: 'center' });
}
const hubTabEls = $$('.hub-tabs [role="tab"]');
hubTabEls.forEach(b => b.addEventListener('click', () => hubShow(b.dataset.tab, { push: true })));
$('.hub-tabs')?.addEventListener('keydown', ev => {
  const i = hubTabEls.indexOf(document.activeElement);
  if (i < 0) return;
  let j = null;
  const nx = isRTL() ? 'ArrowLeft' : 'ArrowRight', pv = isRTL() ? 'ArrowRight' : 'ArrowLeft';
  if (ev.key === nx) j = (i + 1) % hubTabEls.length;
  else if (ev.key === pv) j = (i - 1 + hubTabEls.length) % hubTabEls.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = hubTabEls.length - 1;
  if (j == null) return;
  ev.preventDefault();
  hubTabEls[j].focus();
  hubShow(hubTabEls[j].dataset.tab, { push: true });
});
window.addEventListener('hashchange', () => {
  const p = hubParse(), tab = p.tab || 'timeline';
  if (tab !== hubTab || p.args.join('/') !== hubArgs.join('/') || (p.tab && p.route !== hubRoute)) hubShow(tab, { args: p.args, route: p.tab ? p.route : tab });
});
// "Open in timeline" and any other link that names a tab: <a data-hub="timeline"> (or data-hub="places" data-hash="place/LB1234").
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[data-hub]');
  if (!a || !HUB_TABS.includes(a.dataset.hub)) return;
  ev.preventDefault();
  if (a.dataset.hash) { const p = hubParse(a.dataset.hash); hubShow(a.dataset.hub, { push: true, hash: a.dataset.hash, args: p.args, route: p.route }); }
  else hubShow(a.dataset.hub, { push: true });
  window.scrollTo(0, 0);
});
// About: the citation line carries this page's address and today's date.
hubRenderers.about = () => {
  const c = $('#citeText'); if (!c) return;
  const u = /^https?:/.test(location.href) ? location.href.split('#')[0] : '', d = new Date();
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  c.textContent = `${t('Boghossian, Stephane, with Claude. Free Lebanon Data Hub.')}${u ? ' ' + u + '.' : ''} ${t('Accessed {date}.', { date: fmtDate(iso) })}`;
};
function renderLeads() {
  $$('#hubCounts [data-count]').forEach(el => { const n = (D.counts || {})[el.dataset.count]; if (n != null) el.textContent = nf(n); });
  const l = $('#tlLead');
  if (l) l.textContent = t('{n} events, 1800 to 30 Sep 2026. Search, filter or pick a pattern; click an event for its date, sources and who held office.', { n: nf(EV.length) });
}
renderLeads();
// A language change re-renders the open tab now and marks the others, so each re-renders when opened.
onLang(() => {
  HUB_TABS.forEach(id => { if (id !== hubTab) hubStale.add(id); });
  initFilterUI(); renderLeads();
  if (hubTab) { const info = { route: hubRoute, first: false, lang: true, same: true }; hubSeen.add(hubTab); hubStale.delete(hubTab); if (hubTab === 'timeline') renderTimeline(); if (hubRenderers[hubTab]) hubRenderers[hubTab](hubArgs, info); }
});
// The plugin API (also on window.HUB for the checks and for the browser console).
const HUB = window.HUB = {
  tab(id, def) { hubRenderers[id] = def.render; },
  setHash: hubSetHash, href: hubHref, parse: hubParse, show: hubShow, get current() { return hubTab; },
  t, th, tc, tH, tp, tpH, nf, fmt, fmtDate, fy, nfCompact, fmtBytes, esc, $, $$, store, nrm, hkey, sha1: sha1hex, isRTL,
  load: hubLoad, loadInto: hubLoadInto, onLang, setLang, get lang() { return LANG; },
  line: hubLine, bars: hubBars, scatter: hubScatter, spark: hubSpark, pearson, laggedCorr, niceTicks, colors: HUB_COLORS,
  data: D, version: 7
};
// Skip link: the first Tab stop; it moves focus to the heading of the open panel instead of changing the address (the hash is the router).
$('#skipLink')?.addEventListener('click', ev => {
  ev.preventDefault();
  const pan = $('.hub-panel:not([hidden]), .panel:not([hidden])'); if (!pan) return;
  const h = pan.querySelector('h2, h3') || pan;
  h.setAttribute('tabindex', '-1'); h.focus(); h.scrollIntoView({ block: 'start' });
});
