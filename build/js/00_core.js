(() => {
'use strict';
const D = JSON.parse((document.getElementById('hubData') || document.getElementById('data')).textContent);  // the hub page keeps id="data" for its Data tab
const TL_ONLY = window.TL_ONLY === true;  // lebanon-timeline.html: timeline, search and filters only; no answer lane, no detail block, no list
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cf = c => `<span class="cf cf-${c}">${esc(t(c))}</span>`;
const src = s => `<span class="src">${s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.l)}</a>` : `<span class="nolink">${esc(s.l)}</span>`}${cf(s.c)}</span>`;
const srcs = a => `<span class="srcs">${a.map(src).join('')}</span>`;
/* N(...) around a string literal marks it for translation where it is defined (a table); the build collects it, and t() translates it where it is shown. */
function N(s) { return s; }
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
};
let LANG = 'en';  // en, ar or fr (hub_i18n.js sets it)
const LANG_LOCALE = { en: 'en-US', ar: 'ar-LB', fr: 'fr-FR' };
const fmt = (n, d = 1) => Number(n).toLocaleString(LANG_LOCALE[LANG], { maximumFractionDigits: d });
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\d?\./, ''); } catch (e) { return t('source'); } };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = s => {
  const p = String(s).split('-');
  if (LANG !== 'en' && /^\d{4}$/.test(p[0]) && p.length > 1 && +p[1] >= 1 && +p[1] <= 12) {
    const o = p.length === 2 ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(LANG_LOCALE[LANG], { ...o, timeZone: 'UTC' }).format(Date.UTC(+p[0], +p[1] - 1, p.length > 2 ? +p[2] : 1));
  }
  if (p.length === 1) return /^\d{4}$/.test(p[0]) ? fy(p[0]) : p[0];
  if (p.length === 2) return monShort(+p[1] - 1) + ' ' + fy(p[0]);
  return fy(+p[2]) + ' ' + monShort(+p[1] - 1) + ' ' + fy(p[0]);
};
const dy = s => { const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/); if (!m) return NaN; const y = +m[1]; if (!m[2]) return y + 0.5; const mo = +m[2]; if (!m[3]) return y + (mo - 0.5) / 12; return y + (mo - 1) / 12 + (+m[3] - 0.5) / 365; };
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
const logS = (d0, d1, r0, r1) => { const a = Math.log10(d0), b = Math.log10(d1); return v => r0 + (Math.log10(v) - a) / (b - a) * (r1 - r0); };
const SER = Object.fromEntries(D.series.map(s => [s.id, s]));
const renderers = {};

/* ------------------------------------------------------------ navigation */
const tabs = $$('nav.tabs [role="tab"]');
const panels = $$('section.panel');
const ids = panels.map(p => p.id);
const side = $('#side'), menuBtn = $('#menuBtn'), scrim = $('#scrim'), mobTitle = $('#mobTitle');
let current = null;
function setMenu(open) {
  if (!side) return;
  side.classList.toggle('open', open);
  if (scrim) scrim.hidden = !open;
  if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
}
function show(id, opts = {}) {
  if (!ids.includes(id)) id = ids.includes('timeline') ? 'timeline' : ids[0];
  current = id;
  $('.layout').classList.toggle('tl-mode', id === 'timeline');
  panels.forEach(p => { p.hidden = p.id !== id; });
  tabs.forEach(t => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  const t = tabs.find(x => x.getAttribute('aria-controls') === id);
  if (t) mobTitle.textContent = t.querySelector('.lbl').textContent;
  store.set('mitai-tab', id);
  if (opts.hash !== false && location.hash.slice(1) !== id) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed */ } }
  if (renderers[id]) renderers[id]();
  if (opts.scroll !== false) window.scrollTo(0, 0);
  if (side.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
}
tabs.forEach(t => t.addEventListener('click', () => show(t.getAttribute('aria-controls'))));
$('nav.tabs')?.addEventListener('keydown', ev => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  let j = null;
  if (ev.key === 'ArrowDown') j = (i + 1) % tabs.length;
  else if (ev.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = tabs.length - 1;
  if (j != null) { ev.preventDefault(); tabs[j].focus(); }
});
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[data-go]');
  if (a) {
    ev.preventDefault();
    const go = a.dataset.go;
    if (ids.includes(go)) show(go);
    else location.href = (ids.includes('timeline') ? 'evidence.html#' : './#') + go;  // the other page
  }
});
document.addEventListener('click', ev => {  // back link on evidence.html: return to where the reader came from when that was the timeline page
  const b = ev.target.closest && ev.target.closest('a.back-tl'); if (!b) return;
  try { const r = document.referrer ? new URL(document.referrer) : null;
    if (r && r.origin === location.origin && !/evidence\.html$/.test(r.pathname) && history.length > 1) { ev.preventDefault(); history.back(); } } catch (e) { /* follow the href */ }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (ids.includes(h) && h !== current) show(h, { hash: false }); });
menuBtn?.addEventListener('click', () => {
  const open = !side.classList.contains('open');
  setMenu(open);
  if (open) { const sel = side.querySelector('[aria-selected="true"]'); if (sel) sel.focus(); }
});
scrim?.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && side && side.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

/* ------------------------------------------------------------ answer toggle */
$$('[data-ver]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.ver;
  $$('[data-ver]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#ver-mono').hidden = v !== 'mono';
  $('#ver-tr').hidden = v !== 'tr';
}));

/* ------------------------------------------------------------ tooltip */
const tip = $('#tip');
function placeTip(el, x, y) {
  tip.innerHTML = el.getAttribute('data-tip');
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y + 16;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 12;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}
document.addEventListener('pointermove', ev => {
  const el = ev.target.closest && ev.target.closest('[data-tip]');
  if (el) placeTip(el, ev.clientX, ev.clientY); else tip.hidden = true;
}, { passive: true });
document.addEventListener('focusin', ev => {
  const el = ev.target.closest && ev.target.closest('[data-tip]');
  if (el) { const r = el.getBoundingClientRect(); placeTip(el, r.right, r.top); } else tip.hidden = true;
});
window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

/* ------------------------------------------------------------ claims */
const VERD = { supported: ['good', 'Supported'], partly: ['warn', 'Partly'], contradicted: ['bad', 'Contradicted'], none: ['neutral', 'No evidence'] };
let claimFilter = 'all';
function renderClaims() {
  const counts = { all: D.claims.length };
  D.claims.forEach(c => { counts[c.verdict] = (counts[c.verdict] || 0) + 1; });
  const opts = [['all', 'All claims']].concat(Object.keys(VERD).map(k => [k, VERD[k][1]]));
  $('#claimFilter').innerHTML = opts.map(([k, l]) => `<button type="button" class="chip" data-v="${k}" aria-pressed="${claimFilter === k}">${l}<span class="ct">${counts[k] || 0}</span></button>`).join('');
  const list = D.claims.filter(c => claimFilter === 'all' || c.verdict === claimFilter);
  $('#claimList').innerHTML = list.map(c => {
    const [pk, pl] = VERD[c.verdict];
    return `<article class="claim v-${c.verdict}" id="claim-${c.id}">
      <div class="c-left"><span class="k">In the answer</span><blockquote>"${esc(c.quote)}"</blockquote><p class="c-claim">Claim: ${esc(c.claim)}</p></div>
      <div class="c-right"><span class="pill ${pk}">${pl}</span><p class="c-short">${esc(c.short)}</p>
      <ul class="ev">${c.ev.map(x => `<li>${esc(x.t)} ${srcs(x.s)}</li>`).join('')}</ul>
      ${c.fix ? `<p class="c-fix"><span class="k">Tighter wording</span>${esc(c.fix)}</p>` : ''}
      ${c.conflict ? `<p class="flag-s"><b>Conflict.</b> ${esc(c.conflict)}</p>` : ''}</div></article>`;
  }).join('');
}
$('#claimFilter')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-v]');
  if (!b) return;
  claimFilter = b.dataset.v;
  renderClaims();
  const nb = $(`#claimFilter [data-v="${claimFilter}"]`); if (nb) nb.focus();
});
if ($('#claims')) renderClaims();

/* ------------------------------------------------------------ chart helpers */
const DEFS = '';
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label || '')}">${DEFS}${body}</svg>`;
const tipA = (title, body) => esc(`<b>${esc(title)}</b>${esc(body)}`);
function gridY(vals, y, x0, x1, f) {
  return vals.map(v => `<line class="${v === vals[0] ? 'gl-0' : 'gl'}" x1="${x0}" x2="${x1}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${x0 - 6}" y="${y(v) + 3.5}" text-anchor="end">${f(v)}</text>`).join('');
}
function xLabels(years, x, yPos) {
  return years.map(yr => `<text class="ax" x="${x(yr)}" y="${yPos}" text-anchor="middle">${yr}</text>`).join('');
}
function table(head, rows) {
  return `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const charts = {};
const tables = {};

charts.gdp = w => {
  const pts = SER.gdp_usd.points.map(([y, v]) => [+y, v]);
  const H = 270, m = { l: 48, r: 14, t: 26, b: 28 };
  const x0 = 2005, x1 = 2025, bw = (w - m.l - m.r) / (x1 - x0);
  const y = lin(0, 60, H - m.b, m.t);
  const xc = yr => m.l + (yr - x0 + 0.5) * bw;
  let g = gridY([0, 20, 40, 60], y, m.l, w - m.r, v => v ? '$' + v + 'bn' : '0');
  pts.forEach(([yr, v]) => {
    const hi = yr === 2018 || yr === 2023;
    g += `<rect class="${hi ? 'mk-hi' : 'mk'}" x="${(m.l + (yr - x0) * bw + 1.5).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(2, bw - 3).toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" rx="2" data-tip="${tipA(String(yr), ` GDP $${fmt(v)}bn`)}"/>`;
  });
  g += `<text class="lab-b" x="${xc(2018)}" y="${y(54.9) - 7}" text-anchor="middle">$54.9bn</text>`;
  g += `<text class="lab-b" x="${xc(2023)}" y="${y(20.08) - 7}" text-anchor="middle">$20.1bn</text>`;
  g += `<text class="lab" x="${w - m.r}" y="12" text-anchor="end">2025-26: no WDI value yet</text>`;
  const step = w < 520 ? 5 : 2;
  g += xLabels(pts.map(p => p[0]).filter(yr => (yr - 2005) % step === 0), xc, H - 8);
  tables.gdp = table(['Year', 'GDP, US$ bn'], pts.map(([a, b]) => [a, fmt(b, 2)]));
  return svg(w, H, g, 'GDP bar chart 2005 to 2024');
};

charts.lbp = w => {
  const H = 290, m = { l: 58, r: 16, t: 20, b: 28 };
  const x = lin(1985, 2027, m.l, w - m.r), y = logS(100, 200000, H - m.b, m.t);
  let g = gridY([100, 1000, 10000, 100000], y, m.l, w - m.r, v => v >= 1000 ? fmt(v / 1000) + 'k' : String(v));
  const st = SER.lbp_official_steps.points.map(([d, v]) => [dy(d), v]);
  let path = `M${x(st[0][0])},${y(st[0][1])}`;
  for (let i = 1; i < st.length; i++) path += ` H${x(st[i][0])} V${y(st[i][1])}`;
  g += `<path class="line-ink" d="${path}"/>`;
  st.slice(0, 3).forEach(([t, v], i) => {
    g += `<circle class="pt-f" cx="${x(t)}" cy="${y(v)}" r="4" data-tip="${tipA(['Dec 1997', '1 Feb 2023', '31 Jan 2024'][i], ` official ${fmt(v)} LBP per US$`)}"/>`;
  });
  const hist = SER.lbp_history_points.points.filter(p => dy(p[0]) >= 1985).map(([d, v]) => [d, dy(d), v]);
  const mkt = SER.lbp_usd_market_datapoints.points.map(([d, v]) => [d, dy(d), v]);
  hist.concat(mkt).forEach(([d, t, v]) => {
    g += `<circle class="pt" cx="${x(t)}" cy="${y(v)}" r="4.5" data-tip="${tipA(fmtDate(d), ` ${fmt(v)} LBP per US$ (${t < 1995 ? 'historical point' : 'parallel market'})`)}"/>`;
  });
  g += `<text class="lab" x="${x(1998.5)}" y="${y(1507.5) - 8}">peg 1,507.5 (1997-2023)</text>`;
  g += `<text class="lab-b" x="${x(2023.2) - 6}" y="${y(111000) - 9}" text-anchor="end">111,000 market, Mar 2023</text>`;
  g += `<text class="lab-b" x="${x(2026.7)}" y="${y(89500) + 17}" text-anchor="end">89,500</text>`;
  g += `<text class="lab" x="${x(dy('1987')) + 9}" y="${y(500) + 4}">about 500</text><text class="lab" x="${x(dy('1989-12')) + 9}" y="${y(900) + 4}">900</text>`;
  g += `<text class="lab" x="${x(dy('1992')) + 9}" y="${y(2500) - 7}">over 2,500</text>`;
  const yrs = w < 520 ? [1985, 1995, 2005, 2015, 2025] : [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025];
  g += xLabels(yrs, x, H - 8);
  tables.lbp = table(['Date', 'LBP per US$', 'Kind'], [
    ...SER.lbp_history_points.points.map(([d, v]) => [fmtDate(d), fmt(v, 2), 'historical point']),
    ...SER.lbp_official_steps.points.slice(0, 3).map(([d, v]) => [fmtDate(d), fmt(v, 1), 'official from this date']),
    ...SER.lbp_usd_market_datapoints.points.map(([d, v]) => [fmtDate(d), fmt(v), 'parallel market'])]);
  return svg(w, H, g, 'Lebanese pound per US dollar, log scale, 1985 to 2026');
};

charts.money = w => {
  const two = w >= 600, H = two ? 250 : 470;
  const pw = two ? (w - 40) * 0.64 : w, ph = 230;
  const m = { l: 42, r: 12, t: 26, b: 28 };
  let g = '';
  // left: remittances % GDP
  const r = SER.remittances_pct_gdp.points.map(([a, b]) => [+a, b]);
  const x = lin(2005, 2023, m.l, pw - m.r), y = lin(0, 40, ph - m.b, m.t);
  g += `<text class="gut" x="${m.l}" y="12">Remittances, % of GDP</text>`;
  g += gridY([0, 10, 20, 30, 40], y, m.l, pw - m.r, v => v + '%');
  g += `<path class="area-reg" d="M${x(2005)},${y(0)} ${r.map(([a, b]) => `L${x(a)},${y(b)}`).join(' ')} L${x(2023)},${y(0)}Z"/>`;
  g += `<path class="line-reg" d="${r.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a)},${y(b)}`).join(' ')}"/>`;
  r.forEach(([a, b]) => { g += `<circle class="mk" cx="${x(a)}" cy="${y(b)}" r="${a === 2023 || a === 2018 ? 4 : 2.5}" data-tip="${tipA(String(a), ` remittances ${fmt(b)}% of GDP`)}"/>`; });
  g += `<text class="lab-b" x="${x(2023) - 4}" y="${y(33.35) - 10}" text-anchor="end">33.4% (2023)</text>`;
  g += `<text class="lab" x="${x(2018)}" y="${y(12.71) + 18}" text-anchor="middle">12.7% (2018)</text>`;
  g += xLabels([2005, 2010, 2015, 2020], x, ph - 8);
  // right: cash economy
  const ox = two ? pw + 40 : 0, oy = two ? 0 : ph + 10, cw = two ? w - pw - 40 : w;
  const cy = lin(0, 50, oy + ph - m.b, oy + m.t);
  g += `<text class="gut" x="${ox + m.l}" y="${oy + 12}">Cash economy, % of GDP</text>`;
  g += gridY([0, 25, 50], cy, ox + m.l, ox + cw - m.r, v => v + '%');
  const c = SER.cash_economy_pct_gdp.points;
  const bw = Math.min(70, (cw - m.l - m.r) / 3);
  c.forEach(([a, b], i) => {
    const bx = ox + m.l + (cw - m.l - m.r) * (i + 1) / 3 - bw / 2;
    g += `<rect class="${i ? 'mk-hi' : 'mk'}" x="${bx}" y="${cy(b)}" width="${bw}" height="${cy(0) - cy(b)}" rx="2" data-tip="${tipA(a, ` cash economy ${b}% of GDP`)}"/>`;
    g += `<text class="lab-b" x="${bx + bw / 2}" y="${cy(b) - 7}" text-anchor="middle">${b}%</text><text class="ax" x="${bx + bw / 2}" y="${oy + ph - 8}" text-anchor="middle">${a}</text>`;
  });
  tables.money = table(['Year', 'Remittances % GDP', 'Cash economy % GDP'], r.map(([a, b]) => { const cc = c.find(p => +p[0] === a); return [a, fmt(b, 2), cc ? cc[1] : '']; }));
  return svg(w, H, g, 'Remittances and cash economy as share of GDP');
};

charts.solar = w => {
  const wide = w >= 640;
  const lw = wide ? w * 0.63 : w;
  const m = { l: 46, r: 14 };
  const x = lin(2010, 2027, m.l, lw - m.r);
  const top = { t: 26, h: 170 }, bot = { t: 232, h: 110 };
  let g = `<text class="gut" x="${m.l}" y="12">Decentralised solar, cumulative MWp</text>`;
  const ys = lin(0, 1200, top.t + top.h, top.t);
  g += gridY([0, 400, 800, 1200], ys, m.l, lw - m.r, v => fmt(v));
  const sp = SER.solar_pv_cumulative_mwp.points.map(([a, b]) => [+a, b]);
  const bw = x(2011) - x(2010);
  sp.forEach(([a, b]) => { g += `<rect class="mk-sol" x="${x(a) + 1}" y="${ys(b)}" width="${bw - 2}" height="${Math.max(0.5, ys(0) - ys(b))}" rx="1.5" data-tip="${tipA(String(a), ` ${fmt(b)} MWp installed (cumulative)`)}"/>`; });
  g += `<text class="lab-b" x="${x(2023) + bw / 2}" y="${ys(1081.3) - 7}" text-anchor="middle">1,081</text>`;
  g += `<text class="lab" x="${x(2020) + bw / 2}" y="${ys(92.3) - 7}" text-anchor="middle">92</text>`;
  g += `<text class="gut" x="${m.l}" y="${bot.t - 12}">EDL grid supply, hours per day</text>`;
  const yh = lin(0, 24, bot.t + bot.h, bot.t);
  g += gridY([0, 12, 24], yh, m.l, lw - m.r, v => v + 'h');
  g += `<rect class="range" x="${x(2021)}" y="${yh(2)}" width="${x(2024) - x(2021)}" height="${yh(1) - yh(2)}" data-tip="${tipA('2021-2023', ' 1-2 hours a day')}"/>`;
  g += `<line class="conn" x1="${x(2026.1)}" x2="${x(2026.1)}" y1="${yh(9)}" y2="${yh(7)}" stroke-width="6" data-tip="${tipA('Feb 2026', ' 7-9 hours a day')}"/>`;
  [[2024.5, 4, '2024', 'about 4 hours'], [2026.54, 4, 'Jul 2026', 'about 4 hours']].forEach(([t, v, l, s]) => { g += `<circle class="mk" cx="${x(t)}" cy="${yh(v)}" r="4.5" data-tip="${tipA(l, ' ' + s)}"/>`; });
  g += `<text class="lab" x="${x(2021)}" y="${yh(2) - 6}">1-2 h</text><text class="lab" x="${x(2026.1) - 6}" y="${yh(9) - 2}" text-anchor="end">7-9 h</text><text class="lab-b" x="${x(2026.54)}" y="${yh(4) + 16}" text-anchor="middle">4 h</text>`;
  g += `<text class="gut-s" x="${x(2010.2)}" y="${yh(12) - 5}">no clean series before 2021</text>`;
  g += xLabels([2010, 2014, 2018, 2022, 2026], x, bot.t + bot.h + 18);
  let H = bot.t + bot.h + 28;
  // backup power bars
  const ox = wide ? lw + 26 : 0, oy = wide ? 0 : H + 10, bwid = wide ? w - lw - 26 : w;
  g += `<text class="gut" x="${ox}" y="${oy + 12}">Backup power, % of households (2024)</text>`;
  const ps = SER.power_sources_ab2024.points, xb = lin(0, 100, ox, ox + bwid - 40);
  ps.forEach(([l, v], i) => {
    const yy = oy + 40 + i * 52;
    g += `<text class="lab" x="${ox}" y="${yy}">${esc(l)}</text><rect class="${i ? 'mk' : 'mk-sol'}" x="${ox}" y="${yy + 7}" width="${xb(v) - ox}" height="16" rx="2" data-tip="${tipA(l, ` ${v}% of households`)}"/><text class="lab-b" x="${xb(v) + 6}" y="${yy + 20}">${v}%</text>`;
  });
  if (!wide) H = oy + 40 + ps.length * 52;
  tables.solar = table(['Year', 'Solar MWp (cumulative)'], sp.map(([a, b]) => [a, fmt(b)])) + table(['Date', 'EDL hours per day'], SER.edl_hours_per_day.points.map(([a, b]) => [a, b])) + table(['Backup source (2024)', '% of households'], ps.map(([a, b]) => [a, b]));
  return svg(w, H, g, 'Solar growth and grid hours');
};

charts.trust = w => {
  const nar = w < 640, m = { l: nar ? 12 : 300, r: 40 }, rowH = nar ? 60 : 46, H = 30 + rowH * 4 + 26 + (nar ? 22 : 0);
  const x = lin(0, 60, m.l, w - m.r);
  const rows = [
    ['Arab Barometer: trust in government', 'c1', [['Feb-Apr 2024', 7], ['Nov 2025', 22]]],
    ['Gallup: confidence in national government', 'c2', [['2023', 9], ['May-Jun 2025', 48]]],
    ['Arab Barometer: most people can be trusted', 'c1', [['Feb-Apr 2024', 6]]],
    ['Gallup: confidence in financial institutions', 'c2', [['2025', 4]]],
  ];
  let g = '';
  [0, 20, 40, 60].forEach(v => { g += `<line class="${v ? 'gl' : 'gl-0'}" x1="${x(v)}" x2="${x(v)}" y1="22" y2="${H - 24}"/><text class="ax" x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}%</text>`; });
  rows.forEach(([l, c, pts], i) => {
    const yy = 34 + i * rowH + (nar ? 22 : 0);
    g += nar ? `<text class="lab" x="${m.l}" y="${yy - 14}">${esc(l)}</text>` : `<text class="lab" x="${m.l - 14}" y="${yy + 4}" text-anchor="end">${esc(l)}</text>`;
    if (pts.length === 2) g += `<line class="st-${c}" x1="${x(pts[0][1])}" x2="${x(pts[1][1])}" y1="${yy}" y2="${yy}"/>`;
    pts.forEach(([d, v], j) => {
      g += `<circle class="${j || pts.length === 1 ? 'mk-' + c : 'hol-' + c}" cx="${x(v)}" cy="${yy}" r="6" data-tip="${tipA(d, ` ${v}%`)}"/>`;
      g += `<text class="lab-b" x="${x(v)}" y="${nar ? yy + 20 : yy - 11}" text-anchor="middle">${v}%</text>`;
    });
  });
  tables.trust = table(['Measure', 'Date', '%'], rows.flatMap(([l, , p]) => p.map(([d, v]) => [l, d, v])));
  return svg(w, H, g, 'Trust and confidence measures');
};

charts.startups = w => {
  const H = 250, m = { l: 48, r: 14, t: 30, b: 28 };
  const pts = SER.startup_funding_wamda.points;
  const y = lin(0, 25, H - m.b, m.t);
  const slot = (w - m.l - m.r) / pts.length, bw = Math.min(90, slot * 0.6);
  let g = gridY([0, 5, 10, 15, 20, 25], y, m.l, w - m.r, v => '$' + v + 'M');
  pts.forEach(([yr, v, c, u, l], i) => {
    const bx = m.l + slot * i + (slot - bw) / 2;
    const other = i === 0;
    g += `<rect class="${other ? 'other' : 'mk'}" x="${bx}" y="${y(v)}" width="${bw}" height="${Math.max(1, y(0) - y(v))}" rx="2" data-tip="${tipA(yr, ` $${v}M · ${l} · ${c}`)}"/>`;
    g += `<text class="lab-b" x="${bx + bw / 2}" y="${y(v) - 7}" text-anchor="middle">$${v}M${other ? ' *' : ''}</text><text class="ax" x="${bx + bw / 2}" y="${H - 8}" text-anchor="middle">${yr}</text>`;
  });
  g += `<text class="lab" x="${w - m.r}" y="16" text-anchor="end">2030 target: $500M, off this scale</text>`;
  tables.startups = table(['Year', 'US$ M', 'Source', 'Tag'], pts.map(([a, b, c, , l]) => [a, b, l, c]));
  return svg(w, H, g, 'Lebanon startup funding per year');
};

charts.ranks = w => {
  const H = 280, m = { l: 44, r: 70, t: 20, b: 28 };
  const x = lin(2008, 2025, m.l, w - m.r), y = lin(1, 140, m.t, H - m.b);
  let g = gridY([1, 50, 100, 140], y, m.l, w - m.r, v => String(v));
  const gii = SER.gii_rank.points.map(([a, b]) => [+a, b]), eg = SER.egdi_rank.points.map(([a, b]) => [+a, b]);
  const pth = pts => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a)},${y(b)}`).join(' ');
  g += `<path class="st-c1" d="${pth(gii)}"/>`;
  g += `<path class="st-c2" d="${pth(eg.slice(0, 6))}"/><path class="st-c2 dash" d="${pth(eg.slice(5))}"/>`;
  gii.forEach(([a, b]) => { g += `<circle class="mk-c1" cx="${x(a)}" cy="${y(b)}" r="4" data-tip="${tipA(String(a), ` Global Innovation Index rank ${b}`)}"/>`; });
  eg.forEach(([a, b]) => { g += `<circle class="mk-c2" cx="${x(a)}" cy="${y(b)}" r="4" data-tip="${tipA(String(a), ` E-Government rank ${b}`)}"/>`; });
  g += `<text class="lab-b" x="${x(2025) + 8}" y="${y(90) + 4}">GII 90</text><text class="lab-b" x="${x(2024) + 8}" y="${y(126) + 4}">EGDI 126</text>`;
  g += `<text class="lab" x="${x(2011)}" y="${y(49) - 9}" text-anchor="middle">49</text><text class="lab" x="${x(2008)}" y="${y(74) - 9}" text-anchor="start">74</text>`;
  g += `<text class="gut-s" x="${x(2021)}" y="${y(132)}" text-anchor="middle">2020, 2022 not found</text>`;
  g += `<text class="ax" x="${m.l - 6}" y="${m.t - 6}" text-anchor="end">rank</text>`;
  g += xLabels(w < 520 ? [2008, 2014, 2020, 2025] : [2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024], x, H - 8);
  tables.ranks = table(['Year', 'GII rank', 'EGDI rank'], [...new Set(gii.map(p => p[0]).concat(eg.map(p => p[0])))].sort().map(yr => [yr, (gii.find(p => p[0] === yr) || [, ''])[1], (eg.find(p => p[0] === yr) || [, ''])[1]]));
  return svg(w, H, g, 'Global Innovation Index and E-Government ranks') ;
};

function renderCharts() {
  $$('[data-chart]').forEach(el => {
    const id = el.dataset.chart, w = Math.floor(el.clientWidth - 20);
    if (w < 200 || !charts[id]) return;
    if (el.dataset.w === String(w)) return;
    el.dataset.w = String(w);
    el.innerHTML = charts[id](w);
    const t = $(`[data-table="${id}"]`); if (t && tables[id]) t.innerHTML = tables[id];
  });
  const lg = $('#fig-ranks .fig'); if (lg && !$('#fig-ranks .leg')) lg.insertAdjacentHTML('afterend', '<div class="tl-legend leg"><span><svg width="22" height="10"><line class="st-c1" x1="0" x2="22" y1="5" y2="5"/></svg>Global Innovation Index</span><span><svg width="22" height="10"><line class="st-c2" x1="0" x2="22" y1="5" y2="5"/></svg>E-Government Development Index</span></div>');
  const lt = $('#fig-trust .fig'); if (lt && !$('#fig-trust .leg')) lt.insertAdjacentHTML('afterend', '<div class="tl-legend leg"><span><svg width="12" height="12"><circle class="mk-c1" cx="6" cy="6" r="5"/></svg>Arab Barometer</span><span><svg width="12" height="12"><circle class="mk-c2" cx="6" cy="6" r="5"/></svg>Gallup</span><span>hollow dot = earlier survey</span></div>');
}
renderers.numbers = renderCharts;

/* ------------------------------------------------------------ timeline (v3: PESTEL lanes, Answer lane, eras, economic bands) */
const LANES = [
  { id: 'pol', name: N('Political'), s: 'P', pestel: true },
  { id: 'econ', name: N('Economic'), s: 'E', pestel: true },
  { id: 'soc', name: N('Social'), s: 'S', pestel: true },
  { id: 'tech', name: N('Technological'), s: 'T', pestel: true },
  { id: 'env', name: N('Environmental'), s: 'E', pestel: true },
  { id: 'law', name: N('Legal'), s: 'L', pestel: true },
  { id: 'agree', name: N('Agreements'), s: 'A' },
  { id: 'life', name: N('Life in Lebanon'), s: 'Li', thin: true },
  { id: 'region', name: N('Region'), s: 'R' },
  { id: 'world', name: N('World & Gulf tech'), s: 'W', thin: true },
];
const LN = Object.fromEntries(LANES.map(l => [l.id, l]));
const ZOOM = {
  '1y': { x0: 2025.75, x1: 2026.8, label: N('1 year'), laneH: 46, r: { 1: 3.4, 2: 4.8, 3: 6.4 }, minW: 1, world: false, rank: false },
  '5y': { x0: 2021.75, x1: 2026.8, label: N('5 years'), laneH: 46, r: { 1: 3.4, 2: 4.8, 3: 6.4 }, minW: 2, world: false, rank: true },
  '20y': { x0: 2006.75, x1: 2026.8, label: N('20 years'), laneH: 44, r: { 1: 2.9, 2: 4, 3: 5.4 }, minW: 2, world: true, rank: true },
  '1950': { x0: 1950, x1: 2026.8, label: N('Since 1950'), laneH: 42, r: { 1: 2.4, 2: 3.3, 3: 4.6 }, minW: 2, world: true, rank: false },
  '100y': { x0: 1920, x1: 2026.8, label: N('100 years'), laneH: 42, r: { 1: 2.3, 2: 3.1, 3: 4.4 }, minW: 2, world: true, rank: false },
  '1800': { x0: 1800, x1: 2026.8, label: N('Since 1800'), laneH: 42, r: { 1: 2.2, 2: 3, 3: 4.2 }, minW: 2, world: true, rank: false },
};
const ZOOM_ORDER = TL_ONLY ? ['1y', '5y', '20y', '1950', '100y', '1800'] : ['5y', '20y', '1950', '100y'];
const NOW_T = 2026.747;
const EV = D.events, EVBY = Object.fromEntries(EV.map(e => [e.id, e]));
const RK = D.ranked, RKBY = Object.fromEntries(RK.map(r => [r.anchor, r]));
const CL = Object.fromEntries(D.claims.map(c => [c.id, c]));
const CL_OF = {};
D.claims.forEach(c => c.links.forEach(id => { (CL_OF[id] = CL_OF[id] || []).push(c.id); }));
const TL = {
  zoom: '5y', dec: null, off: new Set(), on: new Set(), minW: {}, conf: 'all', sel: TL_ONLY ? null : RK[0].anchor,
  claim: null, hiLane: null, bands: new Set(['gdppc', 'lbp', 'pop']), strips: new Set(['pres', 'R']), rng: null,
};
const pdate = d => (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d) && !(/^\d{4}-\d{2}$/.test(d) && +d.slice(5) > 12)) ? fmtDate(d) : d;
const edate = e => e.dl || pdate(e.date);
const yearMap = id => { const m = {}; ((SER[id] || {}).points || []).forEach(p => { const s = String(p[0]); if (/^\d{4}$/.test(s) && !(+s in m)) m[+s] = p[1]; }); return m; };
const GDPPC = yearMap('gdp_pc_maddison'), LBPO = yearMap('lbp_usd_longrun'), INFL = yearMap('inflation_cpi_longrun');
const DEBT = yearMap('debt_pct_gdp'), REMIT = yearMap('remittances_pct_gdp_longrun'), GDPUSD = yearMap('gdp_usd_wb'), POP = yearMap('population_longrun');
const MKT = (() => {
  const seen = new Set(), out = [];
  ((SER.lbp_market_longrun || {}).points || []).concat((SER.lbp_usd_market_datapoints || {}).points || []).forEach(p => {
    if (seen.has(p[0])) return; seen.add(p[0]); out.push({ d: p[0], t: dy(p[0]), v: p[1], n: p[2] || 'parallel market data point (04 research file)' });
  });
  return out.filter(o => !isNaN(o.t)).sort((a, b) => a.t - b.t);
})();
const symlog = v => Math.sign(v) * Math.log10(1 + Math.abs(v));
const BANDS = [
  { id: 'gdppc', name: N('GDP per capita'), sub: N('int$ 2011, Maddison'), map: GDPPC, kind: 'area', dom: [0, 18000], ticks: [5000, 10000, 15000], tf: v => t('{v}k', { v: fmt(v / 1000) }), rf: v => t('{v} int$', { v: fmt(v, 0) }), src: 'gdp_pc_maddison' },
  { id: 'lbp', name: N('LBP per US$'), sub: N('log, official + market'), kind: 'lbp', src: 'lbp_usd_longrun' },
  { id: 'infl', name: N('Inflation'), sub: N('% a year, log, IMF'), map: INFL, kind: 'symlog', src: 'inflation_cpi_longrun', rf: v => fmt(v, 1) + '%' },
  { id: 'debt', name: N('Public debt'), sub: N('% of GDP'), map: DEBT, kind: 'line', dom: [0, 360], ticks: [100, 200, 300], tf: v => v + '%', rf: v => t('{v}% of GDP', { v: fmt(v, 1) }), src: 'debt_pct_gdp' },
  { id: 'remit', name: N('Remittances'), sub: N('% of GDP, WB'), map: REMIT, kind: 'line', dom: [0, 40], ticks: [10, 20, 30], tf: v => v + '%', rf: v => t('{v}% of GDP', { v: fmt(v, 1) }), src: 'remittances_pct_gdp_longrun' },
  { id: 'gdpusd', name: N('GDP'), sub: N('US$ bn, WB'), map: GDPUSD, kind: 'bars', dom: [0, 60], ticks: [20, 40], tf: v => t('${v}bn', { v }), rf: v => t('${v}bn', { v: fmt(v, 1) }), src: 'gdp_usd_wb' },
  { id: 'pop', name: N('Population'), sub: N('UN and WB'), map: POP, kind: 'line', dom: [0, 7e6], ticks: [2e6, 4e6, 6e6], tf: v => t('{v}m', { v: v / 1e6 }), rf: v => t('{v} million', { v: fmt(v / 1e6, 2) }), src: 'population_longrun' },
];
const BY_BAND = Object.fromEntries(BANDS.map(b => [b.id, b]));

function zc() {
  if (TL.zoom === 'dec') return { x0: TL.dec, x1: TL.dec + 10, label: TL.dec + 's', laneH: 46, r: { 1: 3.3, 2: 4.6, 3: 6.2 }, minW: 1, world: true, rank: false };
  if (TL.zoom === 'rng' && TL.rng) { const [a, b] = TL.rng, sp = b - a; return { x0: a, x1: b, label: rngLabel(), laneH: sp > 40 ? 42 : 44, r: sp > 40 ? { 1: 2.4, 2: 3.3, 3: 4.6 } : { 1: 3, 2: 4.2, 3: 5.6 }, minW: sp > 25 ? 2 : 1, world: true, rank: false }; }
  return ZOOM[TL.zoom] || ZOOM['100y'];
}
const minW = () => TL.minW[TL.zoom === 'dec' ? 'dec' : TL.zoom] || (filtersOn() ? 1 : zc().minW);
function laneOn(l) {
  if (TL.off.has(l)) return false;
  if (l === 'world' && !zc().world && !TL.on.has('world')) return false;
  return true;
}
function confOk(e) { return TL.conf === 'all' || (TL.conf === 'noinf' ? e.c !== 'inference' : e.c === 'verified'); }
const linkedSet = () => new Set(TL.claim ? CL[TL.claim].links : []);
function visibleEvents() {
  const z = zc(), lk = linkedSet();
  return EV.filter(e => e.t >= z.x0 && e.t <= z.x1 && e.lanes.some(laneOn) && (lk.has(e.id) || (e.w >= minW() && confOk(e) && passes(e))));
}
function renderRankList() {
  const rl = $('#rankList'); if (!rl) return;
  rl.innerHTML = RK.map(r => `<li><button type="button" data-id="${r.anchor}" aria-current="${TL.sel === r.anchor}"><span class="rk-n">${r.rank}</span><span class="rk-body"><b>${esc(r.title)}</b><span class="rk-meta">${r.start === r.end ? fmtDate(r.start) : fmtDate(r.start) + ' to ' + (r.end === '2026-09-30' ? 'now' : fmtDate(r.end))} · ${esc(r.area)}</span></span></button></li>`).join('');
}
function renderZoomCtl() {
  const b = ZOOM_ORDER.map(k => `<button type="button" aria-pressed="${TL.zoom === k}" data-zoom="${k}">${t(ZOOM[k].label)}</button>`).join('');
  $('#zoomCtl').innerHTML = b + (TL.zoom === 'dec' ? `<button type="button" aria-pressed="true" data-zoom="dec" aria-label="${esc(t('{d}s, from the PESTEL matrix', { d: TL.dec }))}">${TL.dec}s</button>` : '')
    + (TL.zoom === 'rng' && TL.rng ? `<button type="button" aria-pressed="true" data-zoom="rng" aria-label="${esc(t('Custom range {r}', { r: rngLabel() }))}">${rngLabel()}</button>` : '');
}
const WLAB = { 1: N('all events'), 2: N('weight 2 and 3'), 3: N('key events only') };
function renderLaneChips(evs) {
  $('#laneCtl').innerHTML = LANES.map(l => {
    const n = evs.filter(e => e.lanes.includes(l.id)).length;
    return `<button type="button" class="chip ln-${l.id}${TL.hiLane === l.id ? ' hi' : ''}" data-lane="${l.id}" aria-pressed="${laneOn(l.id)}"><span class="sw"></span>${esc(t(l.name))}<span class="ct">${n}</span></button>`;
  }).join('');
  const wk = TL.zoom === 'dec' ? 'dec' : TL.zoom, wd = filtersOn() ? 1 : zc().minW;
  $('#weightCtl').options[0].textContent = t('default for this view ({w})', { w: t(WLAB[wd]) });
  $('#weightCtl').value = String(TL.minW[wk] || 0);
  $('#confCtl').value = TL.conf;
}
function renderBandCtl() {
  $('#bandCtl').innerHTML = bandCtlHTML();
}
function renderLegend() {
  const c = (cls, r, extra = '') => `<svg width="${r * 2 + 4}" height="${r * 2 + 4}" aria-hidden="true"><g class="ev ${cls} ln-pol"><circle class="m" cx="${r + 2}" cy="${r + 2}" r="${r}" ${extra}/></g></svg>`;
  $('#tlLegend').innerHTML = [
    `<span>${c('c-verified', 3)}${c('c-verified', 4.5)}${c('c-verified', 6)}${esc(t('weight 1, 2, 3'))}</span>`,
    `<span>${c('c-verified', 5)}${esc(t('verified'))}</span>`,
    `<span>${c('c-reported', 5)}${esc(t('reported'))}</span>`,
    `<span>${c('c-inference', 5)}${esc(t('inference (dashed)'))}</span>`,
    `<span><svg width="14" height="14" aria-hidden="true"><g class="ev c-verified ln-pol"><rect class="m" x="3" y="3" width="8" height="8" transform="rotate(45 7 7)"/></g></svg>${esc(t('history figure'))}</span>`,
    `<span><svg width="12" height="12" aria-hidden="true"><g class="ev ln-pol"><circle class="ring" cx="6" cy="6" r="4" style="stroke:var(--lc)"/></g></svg>${esc(t('same event, also on this track'))}</span>`,
    `<span><svg width="22" height="10" aria-hidden="true"><line class="spn ln-pol" x1="1" x2="21" y1="5" y2="5" style="stroke:var(--l-pol)"/></svg>${esc(t('period (year range)'))}</span>`,
    `<span><i class="sq war"></i>${esc(t('war'))}</span><span><i class="sq occ"></i>${esc(t('occupation'))}</span><span><i class="sq vac"></i>${esc(t('no president'))}</span>`,
    `<span><span class="rk-n" style="width:20px;height:16px;font-size:10px">1</span> ${esc(t('ranked event'))}</span>`,
  ].join('') + (minW() > 1 ? `<span class="lg-hint lg-more" id="lgMore">${esc(t("Showing notable events ({w}); choose 'all events' for every item.", { w: t(WLAB[minW()]) }))} <button type="button" class="chip sm-c" id="lgAll">${esc(t('Show all events'))}</button></span>` : '') + legendExtra();
}
const tickLab = v => TL.zoom === '1y' ? monShort([0, 3, 6, 9][Math.floor((v % 1) * 4 + 1e-6)]) + ' ' + fy(Math.floor(v + 1e-6)) : fy(v);
function tickSet(z, W, Wr) {
  const wide = W > 900, xw = (Wr || W) > 1700, r = (a, b, s) => { const o = []; for (let t = a; t <= b; t += s) o.push(t); return o; };
  if (TL.zoom === 'dec') return r(z.x0, z.x1, wide ? 1 : 2);
  if (TL.zoom === 'rng') { const sp = z.x1 - z.x0, st = [1, 2, 5, 10, 20].find(k => sp / k <= (xw ? 26 : wide ? 14 : 8)) || 20; return r(Math.ceil(z.x0 / st) * st, Math.floor(z.x1), st); }
  if (TL.zoom === '1y') return r(2025.75, 2026.75, 0.25);  // quarters: Oct 2025 to Oct 2026
  if (TL.zoom === '5y') return r(2022, 2026, 1);
  if (TL.zoom === '20y') return xw ? r(2007, 2025, 1) : wide ? r(2007, 2025, 2) : r(2008, 2024, 4);
  if (TL.zoom === '1950') return xw ? r(1950, 2024, 2) : wide ? r(1950, 2025, 5) : r(1950, 2020, 10);
  if (TL.zoom === '1800') return xw ? r(1800, 2020, 10) : wide ? r(1800, 2020, 20) : r(1800, 2000, 50);
  return xw ? r(1920, 2025, 5) : wide ? r(1920, 2020, 10) : r(1920, 2020, 20);
}
function pack(list, x, gap) {
  gap = gap == null ? 3 : gap;
  const ends = [];
  list.forEach(o => {
    const xa = x(o.a);
    let k = ends.findIndex(end => xa > end + gap);
    if (k < 0) { k = ends.length; ends.push(0); }
    ends[k] = Math.max(x(o.b), xa + 2); o.k = k;
  });
  return Math.max(1, ends.length);
}

function renderTimeline(opts = {}) {
  const host = $('#tl');
  const W0 = Math.floor(host.clientWidth);
  if (!W0) return;
  // Wide screens: k = clamp(width / 1400, 1, 1.9). The chart is drawn on a logical width W0 / k and scaled up by k, so lane heights, marks and labels grow smoothly together.
  const K = TL_ONLY ? Math.min(1.9, Math.max(1, W0 / 1400)) : 1;
  const W = TL_ONLY ? Math.max(720, W0 / K) : W0;  // timeline-only: no list fallback, so narrow screens scroll the chart sideways inside #tl
  const z = zc(), lk = linkedSet();
  const evs = visibleEvents();
  renderZoomCtl(); renderRankList(); renderLaneChips(evs); renderBandCtl(); renderLegend(); renderClaimNote(evs); renderAnsRail(); renderFilters(evs);
  if (opts.list !== false) renderList(evs);
  renderDetail(); renderMatrix();
  const narrow = !TL_ONLY && W < 680;
  const ar = $('#ansRail'); if (ar) ar.hidden = !narrow;
  $('#bandCtl').hidden = narrow;
  if (narrow) { host.classList.add('narrow'); host.innerHTML = econStrip(W, z); return; }
  host.classList.remove('narrow');
  const L = 156, R = 14, x = lin(z.x0, z.x1, L, W - R), cx = t => Math.min(Math.max(x(t), L), W - R);
  const axisY = 14;
  let yy = 24, bg = '', g = '', marks = '', over = '';
  // ---- Answer lane (chips laid out in two rows; the pins row sits on the time axis)
  const ansTop = yy, chipW = (W - R - L - 9 * 6) / 10, chipH = 18, pinsY = ansTop + 54;
  const chipPos = {}, ax = x(NOW_T), gTop = TL_ONLY ? ansTop : ansTop + 62, nowTop = TL_ONLY ? ansTop : pinsY + 6;
  if (!TL_ONLY) {
    g += `<rect class="ans-bg" x="0" y="${ansTop - 4}" width="${W}" height="68"/>`;
    g += `<text class="gut" x="8" y="${ansTop + 14}">The answer</text><text class="gut-s" x="8" y="${ansTop + 28}">20 claims, 30 Sep 2026</text><text class="gut-s" x="8" y="${ansTop + 41}">pick one to pin it</text>`;
    D.claims.forEach((c, i) => {
      const row = Math.floor(i / 10), col = i % 10, cxa = L + col * (chipW + 6), cy0 = ansTop + row * 22;
      chipPos[c.id] = [cxa + chipW / 2, cy0 + chipH];
      const on = TL.claim === c.id, dim = TL.claim && !on;
      const lab = chipW < 70 ? c.tag.split(' ').slice(-1)[0] : c.tag;
      over += `<g class="cc v-${c.verdict}${on ? ' on' : ''}${dim ? ' dim' : ''}" data-claim="${c.id}" tabindex="0" role="button" aria-pressed="${on}" aria-label="Claim: ${esc(c.claim)} ${VERD[c.verdict][1]}" data-tip="${tipA(c.tag + ' · ' + VERD[c.verdict][1], ' ' + c.claim)}"><rect x="${cxa.toFixed(1)}" y="${cy0}" width="${chipW.toFixed(1)}" height="${chipH}" rx="9"/><text x="${(cxa + chipW / 2).toFixed(1)}" y="${cy0 + 12.5}" text-anchor="middle">${esc(lab)}</text></g>`;
    });
    over += `<g class="anc" data-anchor="answer" tabindex="0" role="link" aria-label="30 Sep 2026: the answer, recorded. Opens The answer." data-tip="${tipA('30 Sep 2026', ' The answer, recorded. Click to read it.')}"><line x1="${ax}" x2="${ax}" y1="${pinsY - 6}" y2="${pinsY + 6}"/><rect x="${ax - 5}" y="${pinsY - 5}" width="10" height="10" transform="rotate(45 ${ax} ${pinsY})"/></g>`;
    if (!TL.claim && x(NOW_T) - L > 230) g += `<text class="anc-t" x="${ax - 10}" y="${pinsY + 4}" text-anchor="end">30 Sep 2026: the answer, recorded</text>`;
  }
  yy = ansTop + (TL_ONLY ? 0 : 68);
  // ---- rank row
  if (z.rank) {
    const placed = [[], []];
    const items = RK.map(r => {
      const tx = Math.min(Math.max(EVBY[r.anchor].t, z.x0 + 0.02), z.x1 - 0.02);
      return { r, cx: x(tx), a: Math.max(dy(r.start), z.x0), b: Math.min(dy(r.end), z.x1) };
    }).filter(o => o.b >= z.x0 && o.a <= z.x1).sort((p, q) => p.cx - q.cx);
    items.forEach(o => { let k = placed.findIndex(row => row.every(px => Math.abs(px - o.cx) > 22)); if (k < 0) k = 1; placed[k].push(o.cx); o.k = k; });
    g += `<text class="gut" x="8" y="${yy + 13}">${esc(t('Shaped daily life'))}</text><text class="gut-s" x="8" y="${yy + 26}">${esc(t('ranked 1 to 12'))}</text>`;
    items.forEach(o => {
      const cy = yy + 10 + o.k * 19;
      if (x(o.b) - x(o.a) > 2) g += `<line class="conn rng" x1="${x(o.a)}" x2="${x(o.b)}" y1="${cy}" y2="${cy}"/><line class="conn" x1="${x(o.b)}" x2="${x(o.b)}" y1="${cy - 4}" y2="${cy + 4}"/>`;
      marks += `<g class="rk${TL.sel === o.r.anchor ? ' on' : ''}" data-id="${o.r.anchor}" tabindex="0" role="button" aria-label="${esc(t('Ranked {n}: {title}', { n: o.r.rank, title: tc(o.r.title) }))}" data-tip="${tipA(t('Ranked {n}', { n: o.r.rank }) + ' · ' + tc(o.r.area), ' ' + tc(o.r.title))}"><rect x="${o.cx - 10}" y="${cy - 8}" width="20" height="16" rx="3"/><text x="${o.cx}" y="${cy + 4}" text-anchor="middle">${o.r.rank}</text></g>`;
    });
    yy += 2 * 19 + 10;
  }
  // ---- era strips: presidents, conflicts (also shaded behind the lanes), periods
  const inView = kinds => D.eras.filter(e => kinds.includes(e.kind)).map(e => ({ e, a: Math.max(dy(e.start), z.x0), b: Math.min(dy(e.end), z.x1) })).filter(o => o.b > z.x0 && o.a < z.x1).sort((p, q) => p.a - q.a);
  const eraTip = e => tipA(tc(e.label), ` ${t('{a} to {b}', { a: fmtDate(e.start), b: e.ongoing ? t('now') : fmtDate(e.end) })} · ${t(e.c)}${e.u ? '' : ' · ' + t('no source link')}`);
  const strip = (kinds, name, sub, rowH, cls) => {
    const list = inView(kinds);
    const rows = pack(list, x, cls === 'pres' ? -1 : 3);
    g += `<text class="gut-s strip-l" x="8" y="${yy + 11}">${name}</text>`;
    if (sub) g += `<text class="gut-s" x="8" y="${yy + 22}">${sub}</text>`;
    list.forEach(({ e, a, b, k }) => {
      const ey = yy + k * rowH, xa = x(a), xb = Math.max(x(b), xa + 2);
      const lab = cls === 'pres' && LANG === 'en' ? e.label.replace(/ presidency$/, '').replace(/^(Amine|Joseph|Michel|Rene) /, '') : tc(e.label);
      g += `<rect class="era ${cls} k-${e.kind} c-${e.c}" x="${xa.toFixed(1)}" y="${ey + 1}" width="${(xb - xa).toFixed(1)}" height="${rowH - 3}" rx="2" data-tip="${eraTip(e)}"/>`;
      if (xb - xa > lab.length * 5.6 + 10) g += `<text class="era-t" x="${(xa + 4).toFixed(1)}" y="${ey + rowH - 5}" pointer-events="none">${esc(lab)}${e.ongoing ? ' →' : ''}</text>`;
    });
    yy += Math.max(rows * rowH, sub ? 24 : 14) + 3;
    return list;
  };
  if (TL.strips.has('R')) { const o = officeStrip('R', yy, x, z); g += o.g; yy += o.h; }  // Rulers, before 1920; draws nothing when none are in view
  if (TL.strips.has('pres')) strip(['pres'], t('Presidents'), '', 15, 'pres');
  ['PM', 'G'].forEach(code => { if (TL.strips.has(code)) { const o = officeStrip(code, yy, x, z); g += o.g; yy += o.h; } });
  const conflicts = strip(['war', 'occupation', 'vacuum'], t('Wars, occupations'), t('and vacuums'), 15, 'cfl');
  strip(['period', 'money'], t('Periods'), t('money and tech'), 15, 'per');
  yy += 6;
  // ---- lanes
  const lanes = LANES.filter(l => laneOn(l.id) && (!filtersOn() || evs.some(e => e.lanes.includes(l.id) && !agreeElsewhere(e, l.id))));
  const lanesTop = yy, pos = {};
  lanes.forEach((l, li) => {
    const lh = l.thin ? Math.round(z.laneH * 0.62) : z.laneH, ly = yy;
    const hi = TL.hiLane === l.id;
    if (li % 2 === 0 || hi) bg += `<rect class="lane-bg${hi ? ' hi ln-' + l.id : ''}" x="${L}" y="${ly}" width="${W - R - L}" height="${lh}"/>`;
    const n = evs.filter(e => e.lanes.includes(l.id) && !agreeElsewhere(e, l.id)).length;
    g += `<rect x="8" y="${ly + lh / 2 - 10}" width="4" height="20" rx="2" style="fill:var(--l-${l.id})"/><text class="gut${hi ? ' gut-hi' : ''}" x="18" y="${ly + lh / 2 + (l.thin ? 4 : 0)}">${esc(t(l.name))}</text>` + (l.thin ? '' : `<text class="gut-s" x="18" y="${ly + lh / 2 + 13}">${esc(t('{n} in view', { n: nf(n) }))}${l.pestel ? '' : ' · ' + esc(t('context'))}</text>`);
    const inLane = evs.filter(e => e.lanes.includes(l.id) && !agreeElsewhere(e, l.id)).sort((a, b) => b.w - a.w || a.t - b.t);
    const nrow = l.thin ? 2 : 3, off = (lh / 2) - (l.thin ? 7 : 9);
    const centers = l.thin ? [ly + lh / 2 - off / 1.6, ly + lh / 2 + off / 1.6] : [ly + lh / 2 - off, ly + lh / 2, ly + lh / 2 + off];
    const order = l.thin ? [0, 1] : [1, 0, 2], rows = centers.map(() => []);
    inLane.forEach(e => {
      const prim = primLane(e) === l.id;
      const isL = lk.has(e.id);
      const r = (prim ? z.r[e.w] * (l.thin ? 0.8 : 1) : 2.8) + (isL ? 1.2 : 0), px = x(e.t);
      let k = order.find(kk => rows[kk].every(([qx, qr]) => Math.abs(qx - px) > qr + r + 1.2));
      if (k == null) k = order.reduce((best, kk) => rows[kk].filter(([qx, qr]) => Math.abs(qx - px) <= qr + r).length < rows[best].filter(([qx, qr]) => Math.abs(qx - px) <= qr + r).length ? kk : best, order[0]);
      rows[k].push([px, r]);
      const cy = centers[k];
      if (isL && (!pos[e.id] || prim)) pos[e.id] = [px, cy];
      const cls = `ev ln-${l.id} c-${e.c}${isL ? ' hl' : (TL.claim ? ' dim' : '')}`;
      const tipTxt = tipA(edate(e) + ' · ' + t(LN[l.id].name) + (e.fig ? ' · ' + e.fig : ''), ' ' + tc(e.title));
      let shape;
      if (!prim) shape = `<circle class="ring" cx="${px.toFixed(1)}" cy="${cy}" r="${r}" style="stroke:var(--lc)"/>`;
      else if (l.id === 'agree' && e.ag) shape = agreeShape(e.ag.k, px, cy, r);
      else if (l.id === 'life') shape = lifeShape(px, cy, r);
      else if (e.fig) shape = `<rect class="m" x="${(px - r * 0.85).toFixed(1)}" y="${(cy - r * 0.85).toFixed(1)}" width="${(r * 1.7).toFixed(1)}" height="${(r * 1.7).toFixed(1)}" transform="rotate(45 ${px.toFixed(1)} ${cy})"/>`;
      else shape = `<circle class="m" cx="${px.toFixed(1)}" cy="${cy}" r="${r}"/>`;
      const span = prim && e.span ? `<line class="spn" x1="${cx(e.span[0]).toFixed(1)}" x2="${cx(e.span[1]).toFixed(1)}" y1="${cy}" y2="${cy}"/>` : '';
      marks += `<g class="${cls}" data-id="${e.id}" tabindex="0" role="button" aria-label="${esc(edate(e) + ': ' + tc(e.title))}" data-tip="${tipTxt}">${span}${shape}${TL.sel === e.id ? `<circle class="sel" cx="${px.toFixed(1)}" cy="${cy}" r="${r + 4}"/>` : ''}</g>`;
    });
    yy += lh;
  });
  const lanesBottom = yy;
  // conflict shading behind the lanes
  conflicts.forEach(({ e, a, b }) => {
    const xa = x(a), xb = Math.max(x(b), xa + 1.5);
    bg += `<rect class="era-bg k-${e.kind}" x="${xa.toFixed(1)}" y="${lanesTop}" width="${(xb - xa).toFixed(1)}" height="${lanesBottom - lanesTop}"/>`;
  });
  bg += termShade(x, z, lanesTop, lanesBottom);
  // ---- pins, connectors and guides for the selected claim
  if (TL.claim) {
    const c = CL[TL.claim], [ccx, ccy] = chipPos[c.id];
    let left = 0, right = 0;
    c.links.forEach(id => {
      const e = EVBY[id]; if (!e) return;
      if (e.t < z.x0) { left++; return; }
      if (e.t > z.x1) { right++; return; }
      const px = x(e.t), p = pos[id];
      g += `<path class="conn2" d="M${ccx.toFixed(1)},${ccy} C${ccx.toFixed(1)},${ccy + 18} ${px.toFixed(1)},${pinsY - 22} ${px.toFixed(1)},${pinsY - 5}"/>`;
      if (p) bg += `<line class="guide" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${pinsY}" y2="${p[1]}"/>`;
      over += `<path class="pin v-${c.verdict}" d="M${(px - 5).toFixed(1)},${pinsY - 5} L${(px + 5).toFixed(1)},${pinsY - 5} L${px.toFixed(1)},${pinsY + 4} Z"/>`;
    });
    if (left) over += `<text class="edge-t" x="${L + 2}" y="${pinsY + 4}">‹ ${left} earlier</text>`;
    if (right) over += `<text class="edge-t" x="${W - R - 2}" y="${pinsY + 4}" text-anchor="end">${right} later ›</text>`;
  }
  // ---- economic bands
  yy += 12;
  const bandsTop = yy, readers = [];
  BANDS.filter(b => TL.bands.has(b.id)).forEach(b => {
    const top = yy, BH = 56, res = drawBand(b, top, BH, x, z, L, W, R);
    g += res.g; readers.push({ b, top, get: res.get });
    yy += BH + 8;
  });
  if (yy === bandsTop) yy += 2;
  // ---- axes, grid, now line
  let axes = '';
  tickSet(z, W, W0).forEach(t => {
    const tx = x(t); if (tx < L - 1 || tx > W - R + 1) return;
    axes += `<line class="gl" x1="${tx}" x2="${tx}" y1="${gTop}" y2="${yy}"/><text class="ax" x="${tx}" y="${axisY}" text-anchor="middle">${tickLab(t)}</text><text class="ax" x="${tx}" y="${yy + 14}" text-anchor="middle">${tickLab(t)}</text>`;
  });
  axes += `<line class="now" x1="${ax}" x2="${ax}" y1="${nowTop}" y2="${yy}"/>`;
  over += `<rect class="ax-hit" x="${L}" y="0" width="${W - R - L}" height="21"/><rect class="brush" x="0" y="0" width="0" height="21" visibility="hidden"/>`;
  const H = yy + 22;
  const defs = `<defs><pattern id="tlhatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="hatch-l"/></pattern><clipPath id="tlclip"><rect x="${L}" y="0" width="${W - R - L}" height="${H}"/></clipPath></defs>`;
  const xrs = readers.map(r => `<text class="xr" data-b="${r.b.id}" x="0" y="${r.top + 11}" visibility="hidden"></text>`).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${Math.round(W * K)}" height="${Math.round(H * K)}" role="group" aria-label="${esc(t('Timeline, {span}, {n} events', { span: t(z.label), n: nf(evs.length) }))}">${defs}${bg}${axes}${g}${marks}${over}<line class="xh" x1="0" x2="0" y1="${gTop}" y2="${yy}" visibility="hidden"/><g class="xy" visibility="hidden"><rect x="0" y="1" width="44" height="17" rx="3"/><text x="0" y="13" text-anchor="middle"></text></g>${xrs}</svg>`;
  const svgEl = host.querySelector('svg'), xh = svgEl.querySelector('.xh'), xyG = svgEl.querySelector('.xy'), xyR = xyG.querySelector('rect'), xyT = xyG.querySelector('text');
  const xrEls = Object.fromEntries(readers.map(r => [r.b.id, svgEl.querySelector(`.xr[data-b="${r.b.id}"]`)]));
  const hide = () => { xh.setAttribute('visibility', 'hidden'); xyG.setAttribute('visibility', 'hidden'); Object.values(xrEls).forEach(el => el.setAttribute('visibility', 'hidden')); };
  svgEl.onpointermove = ev => {
    const r = svgEl.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width), py = (ev.clientY - r.top) * (H / r.height);
    if (px < L || px > W - R || (py < gTop && py > 22)) { hide(); return; }
    const tm = z.x0 + (px - L) / (W - R - L) * (z.x1 - z.x0), yr = Math.floor(tm);
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('visibility', 'visible');
    xyR.setAttribute('x', px - 22); xyT.setAttribute('x', px); xyT.textContent = fy(yr); xyG.setAttribute('visibility', 'visible');
    const right = px > W * 0.62;
    readers.forEach(rd => {
      const el = xrEls[rd.b.id], v = rd.get(tm, yr);
      el.textContent = v ? `${fy(yr)}: ${v}` : `${fy(yr)}: ${t('no data')}`;
      el.setAttribute('x', px + (right ? -7 : 7)); el.setAttribute('text-anchor', right ? 'end' : 'start'); el.setAttribute('visibility', 'visible');
    });
  };
  svgEl.onpointerleave = hide;
  wireAxis(svgEl, { W, H, L, R, z, top: TL_ONLY ? ansTop : 86 });
}

function drawBand(b, top, BH, x, z, L, W, R) {
  if (b.draw) return b.draw(b, top, BH, x, z, L, W, R);
  let g = `<text class="gut" x="18" y="${top + 16}">${esc(t(b.name))}</text><text class="gut-s" x="18" y="${top + 29}">${esc(t(b.sub))}</text>`;
  g += `<rect class="band-bg" x="${L}" y="${top}" width="${W - R - L}" height="${BH}"/>`;
  const years = b.map ? Object.keys(b.map).map(Number).sort((p, q) => p - q) : [];
  const hatch = (a, c, note) => {
    const xa = x(Math.max(a, z.x0)), xb = x(Math.min(c, z.x1));
    if (xb - xa < 2) return '';
    return `<rect class="gap-z" x="${xa.toFixed(1)}" y="${top + 2}" width="${(xb - xa).toFixed(1)}" height="${BH - 4}"/>` + (xb - xa > note.length * 5.4 + 16 ? `<text class="gap-t" x="${(xa + 6).toFixed(1)}" y="${top + BH - 7}">${esc(note)}</text>` : '');
  };
  if (b.kind === 'lbp') {
    const long = z.x0 < 1995, lo = long ? 1 : 500, hi = 200000, y = logS(lo, hi, top + BH - 3, top + 4);
    (long ? [10, 1000, 100000] : [1000, 10000, 100000]).forEach(v => { g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax tki" x="${L + 3}" y="${y(v) - 2}">${v >= 1000 ? fmt(v / 1000) + 'k' : v}</text>`; });
    const oy = Object.keys(LBPO).map(Number).sort((p, q) => p - q);
    const pts = oy.map(yy => [yy, Math.max(LBPO[yy], lo)]);
    pts.push([2026, 89500]);
    let d = '';
    pts.forEach(([yy, v], i) => { const xa = x(yy), xb = x(Math.min(yy + 1, NOW_T)); d += (i ? ` L${xa.toFixed(1)},${y(v).toFixed(1)}` : `M${xa.toFixed(1)},${y(v).toFixed(1)}`) + ` L${xb.toFixed(1)},${y(v).toFixed(1)}`; });
    g += `<g clip-path="url(#tlclip)"><path class="bd-line" d="${d}"/>`;
    const mk = MKT.filter(m => m.t >= 2019.5);
    if (mk.length) g += `<path class="bd-mkt" d="${mk.map((m, i) => (i ? 'L' : 'M') + x(m.t).toFixed(1) + ',' + y(m.v).toFixed(1)).join(' ')}"/>`;
    MKT.forEach(m => { g += `<circle class="pt" cx="${x(m.t).toFixed(1)}" cy="${y(m.v).toFixed(1)}" r="3" data-tip="${tipA(fmtDate(m.d), ` ${t('{v} LBP per US$.', { v: fmt(m.v, 1) })} ${t(m.n)}`)}"/>`; });
    ((SER.lbp_history_points || {}).points || []).forEach(([dd, v]) => { const tv = dy(dd); if (tv >= 1960) g += `<circle class="pt hist" cx="${x(tv).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" data-tip="${tipA(fmtDate(dd), ' ' + t('about {v} LBP per US$ (historical point, Wikipedia)', { v: fmt(v, 2) }))}"/>`; });
    g += '</g>';
    if (z.x0 < 1960) g += hatch(z.x0, 1960, t('no exchange-rate series before 1960'));
    if (z.x1 > 2023 && x(2023.3) < W - 70) g += `<text class="lab bd-lab" x="${x(2023.2).toFixed(1)}" y="${y(111000) - 5}" text-anchor="end">${esc(t('market'))}</text><text class="lab bd-lab" x="${(W - R - 4)}" y="${y(89500) + 12}" text-anchor="end">${esc(t('official'))}</text>`;
    const get = (tm, yr) => {
      const o = yr >= 2026 ? 89500 : LBPO[yr];
      const m = MKT.filter(mm => Math.floor(mm.t) === yr).pop();
      if (o == null && !m) return '';
      return t('{v} LBP', { v: `${o != null ? t('official') + ' ' + fmt(o, o < 10 ? 2 : 0) : ''}${m ? (o != null ? ' · ' : '') + t('market') + ' ' + fmt(m.v, 0) : ''}` });
    };
    return { g, get };
  }
  if (!years.length) return { g, get: () => '' };
  const first = years[0], last = years[years.length - 1];
  if (b.kind === 'symlog') {
    const y = lin(symlog(-10), symlog(600), top + BH - 3, top + 4);
    [[0, '0'], [10, '10%'], [100, '100%']].forEach(([v, l]) => { g += `<line class="${v ? 'gl' : 'gl-0'}" x1="${L}" x2="${W - R}" y1="${y(symlog(v))}" y2="${y(symlog(v))}"/>` + (v ? `<text class="ax tki" x="${L + 3}" y="${y(symlog(v)) - 2}">${l}</text>` : ''); });
    g += '<g clip-path="url(#tlclip)">';
    years.forEach(yr => {
      const v = b.map[yr], a = Math.max(yr, z.x0), c = Math.min(yr + 1, z.x1); if (c <= a) return;
      const y0 = y(0), y1 = y(symlog(v));
      g += `<rect class="bd-bar${v >= 50 ? ' hot' : ''}${v < 0 ? ' neg' : ''}" x="${(x(a) + 0.4).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(0.8, x(c) - x(a) - 0.8).toFixed(1)}" height="${Math.max(0.8, Math.abs(y1 - y0)).toFixed(1)}" data-tip="${tipA(fy(yr), ' ' + t('inflation {v}%', { v: fmt(v, 1) }))}"/>`;
    });
    g += '</g>';
    [[1987, t('487% in 1987')], [2023, t('221% in 2023')]].forEach(([yr, l]) => {
      if (b.map[yr] == null || yr + 0.5 <= z.x0 || yr + 0.5 >= z.x1) return;
      const px = x(yr + 0.5), end = px > W - R - 90;
      g += `<text class="lab bd-lab" x="${(end ? px - 6 : px + 6).toFixed(1)}" y="${top + 11}" text-anchor="${end ? 'end' : 'start'}">${l}</text>`;
    });
  } else {
    const y = lin(b.dom[0], b.dom[1], top + BH - 3, top + 4);
    g += `<line class="gl-0" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    b.ticks.forEach(v => { g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax tki" x="${L + 3}" y="${y(v) - 2}">${b.tf(v)}</text>`; });
    g += '<g clip-path="url(#tlclip)">';
    if (b.kind === 'bars') {
      years.forEach(yr => {
        const v = b.map[yr], a = Math.max(yr, z.x0), c = Math.min(yr + 1, z.x1); if (c <= a) return;
        g += `<rect class="bd-bar" x="${(x(a) + 0.4).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(0.8, x(c) - x(a) - 0.8).toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" data-tip="${tipA(fy(yr), ' ' + b.rf(v))}"/>`;
      });
    } else {
      const P = years.map(yr => [x(yr + 0.5), y(b.map[yr])]);
      const line = P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (b.kind === 'area') g += `<path class="bd-area" d="${line} L${P[P.length - 1][0].toFixed(1)},${y(0)} L${P[0][0].toFixed(1)},${y(0)} Z"/>`;
      g += `<path class="bd-line" d="${line}"/>`;
      const every = (z.x1 - z.x0) > 40 ? 0 : 1;
      if (every || b.id === 'debt') years.forEach(yr => {
        const tv = yr + 0.5; if (tv < z.x0 || tv > z.x1) return;
        const note = ((SER[b.src] || {}).points || []).find(p => +p[0] === yr);
        const net = note && note[2] && /NET/.test(note[2]);
        g += `<circle class="pt${net ? ' net' : ''}" cx="${x(tv).toFixed(1)}" cy="${y(b.map[yr]).toFixed(1)}" r="2.4" data-tip="${tipA(fy(yr), ' ' + b.rf(b.map[yr]) + (note && note[2] ? '. ' + t(note[2]) : ''))}"/>`;
      });
    }
    g += '</g>';
  }
  if (z.x0 < first) g += hatch(z.x0, first, t('no series before {y}', { y: fy(first) }));
  if (z.x1 > last + 1) g += hatch(last + 1, z.x1, t('not yet published after {y}', { y: fy(last) }));
  return { g, get: (t, yr) => (b.map[yr] != null ? b.rf(b.map[yr]) : '') };
}

function econStrip(W, z) {
  const H = 150, L = 8, R = 8, x = lin(z.x0, z.x1, L, W - R);
  let g = `<text class="gut" x="${L}" y="11">${esc(t('GDP per capita, 2011 int$ (Maddison)'))}</text>`;
  const gy = lin(0, 18000, 62, 18);
  const yrs = Object.keys(GDPPC).map(Number).filter(yr => yr + 1 > z.x0 && yr < z.x1);
  if (yrs.length > 1) {
    const P = yrs.map(yr => [x(Math.min(Math.max(yr + 0.5, z.x0), z.x1)), gy(GDPPC[yr])]);
    g += `<path class="bd-area" d="${P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} L${P[P.length - 1][0].toFixed(1)},${gy(0)} L${P[0][0].toFixed(1)},${gy(0)} Z"/><path class="bd-line" d="${P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
  } else g += `<text class="gap-t" x="${L}" y="44">${esc(yrs.length ? t('{v} int$ in {y}; series ends 2022', { v: fmt(GDPPC[yrs[0]], 0), y: fy(yrs[0]) }) : t('Maddison series ends in 2022'))}</text>`;
  g += `<line class="gl-0" x1="${L}" x2="${W - R}" y1="${gy(0)}" y2="${gy(0)}"/>`;
  g += `<text class="gut" x="${L}" y="84">${esc(t('Inflation, % a year (IMF, log scale)'))}</text>`;
  const iy = lin(symlog(-10), symlog(600), 132, 92);
  Object.keys(INFL).map(Number).filter(yr => yr + 1 > z.x0 && yr < z.x1).forEach(yr => {
    const v = INFL[yr], a = Math.max(yr, z.x0), c = Math.min(yr + 1, z.x1), y0 = iy(0), y1 = iy(symlog(v));
    g += `<rect class="bd-bar${v >= 50 ? ' hot' : ''}" x="${(x(a) + 0.3).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(0.8, x(c) - x(a) - 0.6).toFixed(1)}" height="${Math.max(0.8, Math.abs(y1 - y0)).toFixed(1)}" data-tip="${tipA(fy(yr), ' ' + t('inflation {v}%', { v: fmt(v, 1) }))}"/>`;
  });
  g += `<line class="gl-0" x1="${L}" x2="${W - R}" y1="${iy(0)}" y2="${iy(0)}"/>`;
  const tk = tickSet(z, 400), step = tk.length > 6 ? 2 : 1;
  tk.filter((t, i) => i % step === 0).forEach(t => { g += `<text class="ax" x="${Math.min(Math.max(x(t), 16), W - 18)}" y="${H - 4}" text-anchor="middle">${t}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t('GDP per capita and inflation, {span}', { span: t(z.label) }))}">${g}</svg><p class="narrow-note">${esc(t('On a narrow screen the tracks become the list below, grouped by year. Each year header carries GDP per capita, the official exchange rate and inflation.'))}</p>`;
}

function partHTML(p, e) {
  const isHist = p.file === 'History figures';
  const s = p.u ? src({ l: hostOf(p.u), u: p.u, c: p.c }) : src({ l: p.sl ? t('source: {s}', { s: p.sl }) : t('no source link'), u: null, c: p.c });
  const meta = [esc(p.file), p.who ? esc(p.who) : '', p.date !== e.date ? esc(pdate(p.date)) : '', p.law ? esc(p.law) : '', p.status ? esc(p.status) : ''].filter(Boolean).join(' · ');
  return `<div class="d-part"><span class="k">${meta}</span>${p.title !== e.title ? `<p><b>${th(p.title)}</b></p>` : ''}<p>${th(p.why)}${isHist ? ' ' + cf('inference') : ''}</p>${s}${trustLine(p)}</div>`;
}
function claimChips(id) {
  const cs = CL_OF[id] || [];
  if (!cs.length) return '';
  return `<div class="d-claims"><span class="k">The answer rests on this event for</span>${cs.map(c => `<button type="button" class="achip v-${CL[c].verdict}${TL.claim === c ? ' on' : ''}" data-claim="${c}" aria-pressed="${TL.claim === c}">${esc(CL[c].tag)}</button>`).join('')}</div>`;
}
function renderDetail() {
  const el = $('#tlDetail'); if (!el) return;
  el.innerHTML = detailHTML(EVBY[TL.sel] || EVBY[RK[0].anchor]);
}
function yearHead(y, n) {
  const g = GDPPC[+y], l = LBPO[+y], i = INFL[+y];
  return `<div class="yr-h"><button type="button" class="yr-b" data-year="${y}" aria-label="Year card for ${y}">${y}</button>${g ? `<span>GDP per capita ${fmt(g, 0)} int$</span>` : ''}${l ? `<span>official ${fmt(l, l < 10 ? 2 : 0)} LBP per US$</span>` : ''}${i != null ? `<span>inflation ${fmt(i, 1)}%</span>` : ''}<span>${n} event${n > 1 ? 's' : ''}</span></div>`;
}
function renderList(evs) {
  const lel = $('#tlList'); if (!lel) return;
  const by = {}, lk = linkedSet();
  evs.forEach(e => { const y = String(Math.floor(e.t)); (by[y] = by[y] || []).push(e); });
  const years = Object.keys(by).sort();
  lel.innerHTML = years.map(y => yearHead(y, by[y].length) +
    by[y].map(e => `<details class="evr ln-${e.lanes.find(laneOn) || e.lanes[0]} w${e.w} c-${e.c}${TL.sel === e.id ? ' on' : ''}${lk.has(e.id) ? ' hl' : (TL.claim ? ' dim' : '')}" data-id="${e.id}"${TL.sel === e.id ? ' open' : ''}><summary><span class="dot"></span><span class="dt">${edate(e)}</span><span class="t">${esc(e.title)}${RKBY[e.id] ? ` <span class="rk-n" style="width:20px;height:16px;font-size:10px">${RKBY[e.id].rank}</span>` : ''}${e.c === 'inference' ? ' ' + cf('inference') : ''}</span></summary><div class="evr-body">${answerFields(e, true)}${e.parts.map(p => partHTML(p, e)).join('')}${e.note ? `<p class="flag-s">${esc(e.note)}</p>` : ''}${claimChips(e.id)}</div></details>`).join('')
  ).join('') || '<p class="note">No events match these filters. Turn a track back on, lower the weight filter or show all tags.</p>';
}
function renderAnsRail() {
  const el = $('#ansRail'); if (!el) return;
  el.innerHTML = `<span class="k">The answer · 20 claims</span><a class="achip anc-l" href="#answer" data-go="answer">30 Sep 2026: the answer, recorded</a>` + D.claims.map(c => `<button type="button" class="achip v-${c.verdict}${TL.claim === c.id ? ' on' : ''}" data-claim="${c.id}" aria-pressed="${TL.claim === c.id}">${esc(c.tag)}</button>`).join('');
}
function renderClaimNote(evs) {
  const el = $('#claimNote'); if (!el) return;
  if (!TL.claim) {
    el.classList.remove('on');
    el.innerHTML = `<p><b>The Answer lane.</b> Pick one of the 20 claims to pin it to the events it rests on, across every track and zoom level. The mark at 30 Sep 2026 opens <a href="#answer" data-go="answer">the answer</a>.</p>`;
    return;
  }
  const c = CL[TL.claim], z = zc(), [pk, pl] = VERD[c.verdict];
  const links = c.links.map(id => EVBY[id]).filter(Boolean);
  const out = links.filter(e => e.t < z.x0 || e.t > z.x1).length;
  el.classList.add('on');
  el.innerHTML = `<div class="cn-top"><span class="pill ${pk}">${pl}</span><b>${esc(c.tag)}</b><span class="cn-q">"${esc(c.quote)}"</span></div>
    <p class="cn-why"><span class="k">Why these events</span>${esc(c.why)}</p>
    <div class="cn-act"><details class="cn-list"><summary>The ${links.length} events as a list</summary><div class="cn-evs">${links.map(e => `<button type="button" class="cn-ev ln-${e.lanes[0]}" data-id="${e.id}"><span class="dot"></span><span class="mono">${edate(e)}</span> ${esc(e.title)}</button>`).join('')}</div></details>${out ? `<span class="note">${out} of ${links.length} fall outside this view.</span><button type="button" class="chip" data-fit="1">Show all ${links.length}</button>` : `<span class="note">All ${links.length} are in this view.</span>`}<a href="#claims" data-go="claims">Full evidence for this claim</a><button type="button" class="chip" data-clear="1">Clear</button></div>`;
}
function renderMatrix() {
  const host = $('#pestelMatrix'); if (!host) return;
  const decs = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020], P = LANES.filter(l => l.pestel);
  const agg = Object.fromEntries(P.map(l => [l.id, decs.map(() => ({ n: 0, w: 0 }))]));
  EV.filter(e => passes(e) && confOk(e)).forEach(e => { const k = decs.indexOf(Math.floor(e.t / 10) * 10); if (k < 0) return; e.lanes.forEach(l => { if (agg[l]) { agg[l][k].n++; agg[l][k].w += e.w; } }); });
  const rows = P.map(l => {
    const mx = Math.max(...agg[l.id].map(c => c.w)) || 1;
    return `<tr><th scope="row"><span class="sw ln-${l.id}"></span><span class="pm-full">${esc(l.name)}</span><span class="pm-s">${esc(l.name.slice(0, 4))}</span></th>` + agg[l.id].map((c, i) => {
      const a = Math.round(8 + 72 * c.w / mx), on = TL.zoom === 'dec' && TL.dec === decs[i] && TL.hiLane === l.id;
      return `<td><button type="button" class="pm-c ln-${l.id}${a > 52 ? ' dk' : ''}${on ? ' on' : ''}" style="--a:${a}%" data-lane="${l.id}" data-dec="${decs[i]}" aria-pressed="${on}" aria-label="${esc(l.name)}, ${decs[i]}s: ${c.n} events, weight ${c.w}. Zoom to the ${decs[i]}s." data-tip="${tipA(l.name + ', ' + decs[i] + 's', ` ${c.n} events, summed weight ${c.w}. Click to zoom to the decade.`)}">${c.n}</button></td>`;
    }).join('') + '</tr>';
  }).join('');
  host.innerHTML = `<table class="pm-t"><thead><tr><th scope="col"><span class="pm-full">Pillar</span></th>${decs.map(d => `<th scope="col">${d}s</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
function scrollToTl() {
  const t = $('#tl');
  if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function select(id, opts = {}) {
  TL.sel = id;
  const e = EVBY[id];
  const z = zc();
  if (e && (e.t < z.x0 || e.t > z.x1)) { TL.zoom = e.t >= 2021.75 ? '5y' : e.t >= 2006.75 ? '20y' : e.t >= 1950 ? '1950' : '100y'; TL.dec = null; }
  if (e && !e.lanes.some(laneOn)) { TL.off.delete(e.lanes[0]); TL.on.add(e.lanes[0]); }
  if (e && (e.w < minW() || !confOk(e)) && !linkedSet().has(id)) { TL.minW[TL.zoom === 'dec' ? 'dec' : TL.zoom] = 1; TL.conf = 'all'; }
  const hadFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#tl [data-id]');
  renderTimeline();
  if (TL_ONLY) { openEventCard(id); return; }  // the card replaces the detail block and the list
  if (hadFocus) { const n = $(`#tl [data-id="${id}"]`); if (n) n.focus(); }
  if (opts.scroll) {
    const narrow = $('#tl').classList.contains('narrow');
    const target = narrow ? $(`#tlList details[data-id="${id}"]`) : $('#tlDetail');
    if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: narrow ? 'start' : 'nearest' });
  }
}
function selectClaim(id, opts = {}) {
  TL.claim = TL.claim === id && !opts.keep ? null : id;
  if (TL.claim) CL[TL.claim].links.forEach(eid => { const e = EVBY[eid]; if (e && !e.lanes.some(laneOn)) { TL.off.delete(e.lanes[0]); TL.on.add(e.lanes[0]); } });
  const a = document.activeElement, box = a && a.dataset && a.dataset.claim && a.closest('#tl,#ansRail');
  renderTimeline();
  if (box) { const n = $(`#${box.id} [data-claim="${id}"]`); if (n) n.focus(); }
}
function fitClaim() {
  if (!TL.claim) return;
  const ts = CL[TL.claim].links.map(id => EVBY[id]).filter(Boolean).map(e => e.t), lo = Math.min(...ts);
  TL.zoom = lo >= 2021.75 ? '5y' : lo >= 2006.75 ? '20y' : lo >= 1950 ? '1950' : '100y'; TL.dec = null;
  renderTimeline();
}
$('#zoomCtl')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-zoom]'); if (!b) return;
  if (b.dataset.zoom !== 'dec') { TL.zoom = b.dataset.zoom; TL.dec = null; TL.hiLane = null; }
  renderTimeline();
  const nb = $(`#zoomCtl [data-zoom="${TL.zoom}"]`); if (nb) nb.focus();
});
$('#laneCtl')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-lane]'); if (!b) return;
  const l = b.dataset.lane;
  if (laneOn(l)) { TL.off.add(l); TL.on.delete(l); } else { TL.off.delete(l); TL.on.add(l); }
  renderTimeline();
  const nb = $(`#laneCtl [data-lane="${l}"]`); if (nb) nb.focus();
});
$('#weightCtl')?.addEventListener('change', ev => { TL.minW[TL.zoom === 'dec' ? 'dec' : TL.zoom] = +ev.target.value; renderTimeline(); });
$('#tlLegend')?.addEventListener('click', ev => { if (!ev.target.closest('#lgAll')) return; TL.minW[TL.zoom === 'dec' ? 'dec' : TL.zoom] = 1; renderTimeline(); });
$('#confCtl')?.addEventListener('change', ev => { TL.conf = ev.target.value; renderTimeline(); });
$('#bandCtl')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-band]'); if (!b) return;
  const id = b.dataset.band; if (TL.bands.has(id)) TL.bands.delete(id); else TL.bands.add(id);
  renderTimeline({ list: false });
  const nb = $(`#bandCtl [data-band="${id}"]`); if (nb) nb.focus();
});
$('#pestelMatrix')?.addEventListener('click', ev => {
  const b = ev.target.closest('[data-dec]'); if (!b) return;
  const d = +b.dataset.dec, l = b.dataset.lane;
  if (TL.zoom === 'dec' && TL.dec === d && TL.hiLane === l) { TL.zoom = '100y'; TL.dec = null; TL.hiLane = null; }
  else { TL.zoom = 'dec'; TL.dec = d; TL.hiLane = l; TL.off.delete(l); TL.on.add(l); }
  if (current !== 'timeline') show('timeline', { scroll: false });
  renderTimeline();
  scrollToTl();
});
$('#rankList')?.addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (b) { if (current !== 'timeline') show('timeline', { scroll: false }); select(b.dataset.id, { scroll: true }); } });
renderers.patterns = () => { renderMatrix(); renderRankList(); };
function onTlActivate(ev) {
  const c = ev.target.closest('[data-claim]'); if (c) { selectClaim(c.dataset.claim); return true; }
  const a = ev.target.closest('[data-anchor]'); if (a) { show('answer'); return true; }
  const g = ev.target.closest('[data-id]'); if (g) { select(g.dataset.id, { scroll: true }); return true; }
  return false;
}
$('#tl')?.addEventListener('click', onTlActivate);
$('#tl')?.addEventListener('keydown', ev => { if (ev.key !== 'Enter' && ev.key !== ' ') return; if (onTlActivate(ev)) ev.preventDefault(); });
$('#ansRail')?.addEventListener('click', ev => { const c = ev.target.closest('[data-claim]'); if (c) selectClaim(c.dataset.claim); });
$('#claimNote')?.addEventListener('click', ev => {
  if (ev.target.closest('[data-clear]')) { TL.claim = null; renderTimeline(); return; }
  if (ev.target.closest('[data-fit]')) { fitClaim(); return; }
  const b = ev.target.closest('[data-id]'); if (b) select(b.dataset.id, { scroll: true });
});
$('#tlDetail')?.addEventListener('click', ev => { const c = ev.target.closest('[data-claim]'); if (c) { selectClaim(c.dataset.claim, { keep: true }); scrollToTl(); } });
$('#tlList')?.addEventListener('click', ev => { const c = ev.target.closest('.d-claims [data-claim]'); if (c) { ev.preventDefault(); selectClaim(c.dataset.claim, { keep: true }); } });
$('#tlList')?.addEventListener('toggle', ev => {
  const d = ev.target; if (!d.open || !d.dataset || !d.dataset.id || TL.sel === d.dataset.id) return;
  TL.sel = d.dataset.id; renderDetail(); renderRankList();
  $$('#tlList details.on').forEach(x => x.classList.remove('on')); d.classList.add('on');
  if (!$('#tl').classList.contains('narrow')) renderTimeline({ list: false });
}, true);
renderers.timeline = renderTimeline;
