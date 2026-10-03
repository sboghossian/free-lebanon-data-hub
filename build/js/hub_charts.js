/* ------------------------------------------------------------ chart helpers for the tabs (small, SVG, theme tokens, keyboard and screen-reader friendly).
   hubLine(el, {series:[{id,label,pts:[[x,y],...],dash,marks:[[x,y,note]],estFrom}], height, yMin, yMax, log, xFmt, yFmt, markers:[{x,label}], zones:[{x0,x1,label}], estNote, title}) -> {update(o), destroy()}
   marks: hollow dots on points that were filled from other sources (note = the tooltip text); estFrom: values after this x are drawn dashed (estimates, projections); zones: shaded x-ranges with a label.
   hubBars(el, {items:[{id,label,value,hi}], fmt, max})              horizontal bars as a list
   hubScatter(el, {points:[{id,label,x,y,hi}], xLabel, yLabel, xFmt, yFmt, onPick}) -> {r, n}   dots, a fitted line and Pearson r
   hubSpark(pts, label)                                              one inline SVG sparkline string
   pearson(xs, ys) -> {r, n}; laggedCorr(a, b, maxLag) -> [{lag, r, n}] for two year-keyed series [[year, v], ...]
   Colors are CSS variables (var(--cedar) ...) so charts follow light and dark; HUB_COLORS lists the order used for series. */
const HUB_COLORS = ['var(--cedar)', 'var(--diesel)', 'var(--sea)', 'var(--l-pol)', 'var(--l-soc)', 'var(--l-hist)', 'var(--l-env)', 'var(--l-work)'];
function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}
function pearson(xs, ys) {
  const p = [];
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) p.push([xs[i], ys[i]]);
  const n = p.length;
  if (n < 3) return { r: null, n };
  const mx = p.reduce((s, q) => s + q[0], 0) / n, my = p.reduce((s, q) => s + q[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  p.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n };
}
function laggedCorr(a, b, maxLag = 5) {  // r between a(year) and b(year + lag), for lag in -maxLag..maxLag
  const A = new Map(a.map(p => [Math.floor(p[0]), p[1]])), B = new Map(b.map(p => [Math.floor(p[0]), p[1]])), out = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xs = [], ys = [];
    A.forEach((v, y) => { if (B.has(y + lag)) { xs.push(v); ys.push(B.get(y + lag)); } });
    out.push({ lag, ...pearson(xs, ys) });
  }
  return out;
}
const chartFmt = v => Math.abs(v) >= 1e9 ? fmt(v / 1e9, 1) + 'B' : Math.abs(v) >= 1e6 ? fmt(v / 1e6, 1) + 'M' : Math.abs(v) >= 1e4 ? fmt(v / 1e3, 0) + 'k' : fmt(v, Math.abs(v) < 10 ? 2 : 1);
function hubLine(el, o) {
  let opt = o, ro = null, cur = null;
  const draw = () => {
    const W = Math.max(280, el.clientWidth || 640), H = opt.height || 260, L = 46, R = 12, T = 12, B = 26, series = (opt.series || []).filter(s => s.pts && s.pts.length);
    el.classList.add('hc');
    if (!series.length) { el.innerHTML = `<p class="hub-empty">${esc(t('No data to chart.'))}</p>`; return; }
    const all = series.flatMap(s => s.pts), xs = all.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    let ys = all.map(p => p[1]).filter(v => Number.isFinite(v) && (!opt.log || v > 0));
    const lg = !!opt.log, T_ = v => (lg ? Math.log10(v) : v);
    let y0 = opt.yMin != null ? opt.yMin : Math.min(...ys), y1 = opt.yMax != null ? opt.yMax : Math.max(...ys);
    if (!lg && opt.yMin == null && y0 > 0 && y0 < (y1 - y0) * 0.5) y0 = 0;
    if (y1 === y0) { y1 += 1; y0 -= 1; }
    const X = x => L + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - L - R), Y = v => T + (1 - (T_(v) - T_(y0)) / (T_(y1) - T_(y0))) * (H - T - B);
    const yt = lg ? (() => { const a = Math.ceil(Math.log10(y0)), b = Math.floor(Math.log10(y1)), o = []; for (let k = a; k <= b; k++) o.push(Math.pow(10, k)); return o.length ? o : [y0, y1]; })() : niceTicks(y0, y1, 4);
    const xt = niceTicks(x0, x1, W < 480 ? 4 : 7).filter(v => Number.isInteger(v) || (x1 - x0) < 6);
    const yF = opt.yFmt || chartFmt, xF = opt.xFmt || (v => fy(Math.round(v)));
    let g = yt.map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${esc(yF(v))}</text>`).join('')
      + xt.map(v => `<text class="ax" x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(xF(v))}</text>`).join('');
    (opt.markers || []).forEach(m => { if (m.x >= x0 && m.x <= x1) g += `<line class="hc-mk" x1="${X(m.x).toFixed(1)}" x2="${X(m.x).toFixed(1)}" y1="${T}" y2="${H - B}"/><text class="ax" x="${(X(m.x) + 3).toFixed(1)}" y="${T + 9}">${esc(m.label || '')}</text>`; });
    (opt.zones || []).forEach(z => { const a = Math.max(x0, z.x0), b = Math.min(x1, z.x1 == null ? x1 : z.x1); if (b > a) g += `<rect class="hc-zone" x="${X(a).toFixed(1)}" y="${T}" width="${(X(b) - X(a)).toFixed(1)}" height="${H - T - B}"/><text class="ax hc-zt" x="${(X(b) - 4).toFixed(1)}" y="${H - B - 5}" text-anchor="end">${esc(z.label || '')}</text>`; });
    series.forEach((s, i) => {
      const pts = s.pts.filter(p => Number.isFinite(p[1]) && (!lg || p[1] > 0)), col = s.color || HUB_COLORS[i % HUB_COLORS.length], cls = `hc-line${opt.highlight && opt.highlight !== s.id ? ' dim' : ''}`;
      const path = ps => { let d = '', pen = false; ps.forEach(p => { d += (pen ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); pen = true; }); return d; };
      if (s.estFrom != null && pts.some(p => p[0] > s.estFrom) && pts.some(p => p[0] <= s.estFrom)) {   // after the last actual year: dashed, because the values are estimates or projections
        const a = pts.filter(p => p[0] <= s.estFrom), b = [a[a.length - 1]].concat(pts.filter(p => p[0] > s.estFrom));
        g += `<path class="${cls}" d="${path(a)}" style="stroke:${col}"${s.dash ? ' stroke-dasharray="5 4"' : ''}/><path class="hc-est${opt.highlight && opt.highlight !== s.id ? ' dim' : ''}" d="${path(b)}" style="stroke:${col}" stroke-dasharray="2 3"/>`;
      } else g += `<path class="${cls}" d="${path(pts)}" style="stroke:${col}"${s.dash ? ' stroke-dasharray="5 4"' : ''}${s.estFrom != null && pts.length && pts[0][0] > s.estFrom ? ' stroke-dasharray="2 3"' : ''}/>`;
      if (pts.length === 1) g += `<circle cx="${X(pts[0][0]).toFixed(1)}" cy="${Y(pts[0][1]).toFixed(1)}" r="3" style="fill:${col}"/>`;
      (s.marks || []).forEach(m => { if (Number.isFinite(m[1]) && (!lg || m[1] > 0)) g += `<circle class="hc-fl" cx="${X(m[0]).toFixed(1)}" cy="${Y(m[1]).toFixed(1)}" r="2.7" style="stroke:${col}"/>`; });
    });
    const sum = series.map(s => `${s.label}: ${t('{n} points from {a} to {b}', { n: nf(s.pts.length), a: xF(Math.min(...s.pts.map(p => p[0]))), b: xF(Math.max(...s.pts.map(p => p[0]))) })}`).join('; ');
    el.innerHTML = `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0" aria-label="${esc((opt.title || '') + (opt.title ? '. ' : '') + sum)}">${g}<line class="hc-cur" y1="${T}" y2="${H - B}" visibility="hidden"/></svg><div class="hc-tip" hidden></div>`
      + (series.length > 1 || opt.legend ? `<ul class="hc-lg">${series.map((s, i) => `<li><i style="background:${s.color || HUB_COLORS[i % HUB_COLORS.length]}"></i>${esc(s.label)}</li>`).join('')}</ul>` : '');
    const svg = el.querySelector('svg'), cur_ = svg.querySelector('.hc-cur'), tip = el.querySelector('.hc-tip'), xsU = [...new Set(xs)].sort((a, b) => a - b);
    let ix = xsU.length - 1;
    const show = k => {
      ix = Math.max(0, Math.min(xsU.length - 1, k));
      const xv = xsU[ix], rows = series.map((s, i) => { const p = s.pts.reduce((b, q) => (Math.abs(q[0] - xv) < Math.abs(b[0] - xv) ? q : b), s.pts[0]); const mk = (s.marks || []).find(m => Math.abs(m[0] - p[0]) < 1e-6), es = s.estFrom != null && p[0] > s.estFrom; return Math.abs(p[0] - xv) < 0.5 ? `<div><i style="background:${s.color || HUB_COLORS[i % HUB_COLORS.length]}"></i>${esc(s.label)}: <b>${esc((opt.valFmt || yF)(p[1]))}</b>${mk && mk[2] ? ` <span class="hc-fn">${esc(mk[2])}</span>` : ''}${es && opt.estNote ? ` <span class="hc-fn">${esc(opt.estNote)}</span>` : ''}</div>` : ''; }).join('');
      cur_.setAttribute('x1', X(xv)); cur_.setAttribute('x2', X(xv)); cur_.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${esc(xF(xv))}</b>${rows}`; tip.hidden = false;
      const px = X(xv) / W * svg.clientWidth, tw = tip.offsetWidth;
      tip.style.insetInlineStart = Math.max(4, Math.min(svg.clientWidth - tw - 4, px + 10)) + 'px';
    };
    svg.addEventListener('pointermove', ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W; let b = 0; xsU.forEach((v, k) => { if (Math.abs(X(v) - x) < Math.abs(X(xsU[b]) - x)) b = k; }); show(b); });
    svg.addEventListener('pointerleave', () => { cur_.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    svg.addEventListener('keydown', ev => { const k = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[ev.key]; if (k) { ev.preventDefault(); show(ix + k); } });
    svg.addEventListener('blur', () => { cur_.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  };
  draw();
  if (window.ResizeObserver) { let w0 = el.clientWidth; ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w0) > 8) { w0 = el.clientWidth; draw(); } }); ro.observe(el); }
  return { update: n => { opt = n; draw(); }, destroy: () => { if (ro) ro.disconnect(); } };
}
function hubBars(el, o) {
  const items = (o.items || []).filter(i => Number.isFinite(i.value)), mx = o.max != null ? o.max : Math.max(...items.map(i => Math.abs(i.value)), 1), f = o.fmt || chartFmt;
  el.innerHTML = items.length ? `<ul class="hc-bars">${items.map(i => `<li${i.hi ? ' class="hi"' : ''}${i.id ? ` data-id="${esc(i.id)}"` : ''}><span class="hb-l">${esc(i.label)}</span><span class="hb-b" aria-hidden="true"><i style="width:${(Math.abs(i.value) / mx * 100).toFixed(1)}%"></i></span><span class="hb-v mono">${esc(f(i.value))}</span></li>`).join('')}</ul>` : `<p class="hub-empty">${esc(t('No data to chart.'))}</p>`;
}
function hubScatter(el, o) {
  const P = (o.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)), W = Math.max(280, el.clientWidth || 560), H = o.height || 320, L = 52, R = 12, T = 12, B = 40;
  el.classList.add('hc');
  const st = pearson(P.map(p => p.x), P.map(p => p.y));
  if (P.length < 3) { el.innerHTML = `<p class="hub-empty">${esc(t('Not enough points to chart.'))}</p>`; return st; }
  const xv = P.map(p => p.x), yv = P.map(p => p.y), x0 = Math.min(...xv), x1 = Math.max(...xv), y0 = Math.min(...yv), y1 = Math.max(...yv);
  const X = v => L + (v - x0) / ((x1 - x0) || 1) * (W - L - R), Y = v => T + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - T - B), xF = o.xFmt || chartFmt, yF = o.yFmt || chartFmt;
  const mx = xv.reduce((a, b) => a + b, 0) / P.length, my = yv.reduce((a, b) => a + b, 0) / P.length;
  const sxx = xv.reduce((a, v) => a + (v - mx) ** 2, 0), sl = sxx ? P.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx : 0, ic = my - sl * mx;
  const g = niceTicks(y0, y1, 4).map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${esc(yF(v))}</text>`).join('')
    + niceTicks(x0, x1, W < 480 ? 3 : 6).map(v => `<text class="ax" x="${X(v).toFixed(1)}" y="${H - B + 14}" text-anchor="middle">${esc(xF(v))}</text>`).join('');
  const dots = P.map((p, i) => `<circle class="sc-dot${p.hi ? ' hi' : ''}" data-i="${i}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.hi ? 6 : 3.4}"${o.onPick ? ' tabindex="0" role="button"' : ''} aria-label="${esc(p.label || '')}: ${esc(xF(p.x))}, ${esc(yF(p.y))}"><title>${esc(p.label || '')}</title></circle>`).join('');
  el.innerHTML = `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(`${o.yLabel || ''} / ${o.xLabel || ''}`)}">${g}<line class="hc-fit" x1="${X(x0).toFixed(1)}" y1="${Y(ic + sl * x0).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(ic + sl * x1).toFixed(1)}"/>${dots}<text class="ax" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">${esc(o.xLabel || '')}</text><text class="ax" x="12" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(T + H - B) / 2})">${esc(o.yLabel || '')}</text></svg><p class="hc-r mono" data-r="${st.r == null ? '' : st.r.toFixed(3)}">${esc(st.r == null ? t('r is not defined for these points') : t('r = {r} (n = {n})', { r: fmt(st.r, 2), n: nf(st.n) }))}</p>`;
  if (o.onPick) el.querySelectorAll('.sc-dot').forEach(c => { const go = () => o.onPick(P[+c.dataset.i]); c.addEventListener('click', go); c.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  return st;
}
function hubSpark(pts, label) {
  if (!pts || !pts.length) return '';
  const W = 240, H = 48, px = 4, py = 6, T = pts.map(p => p[0]), V = pts.map(p => p[1]), t0 = Math.min(...T), t1 = Math.max(...T), v0 = Math.min(...V), v1 = Math.max(...V);
  const x = v => pts.length < 2 || t1 === t0 ? W / 2 : px + (v - t0) / (t1 - t0) * (W - 2 * px), y = v => v1 === v0 ? H / 2 : H - py - (v - v0) / (v1 - v0) * (H - 2 * py);
  return `<svg class="sp" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || '')}"><line class="sp-base" x1="${px}" x2="${W - px}" y1="${H - 1}" y2="${H - 1}"/>${pts.length > 1 ? `<path class="sp-line" d="${pts.map((p, i) => (i ? 'L' : 'M') + x(T[i]).toFixed(1) + ' ' + y(V[i]).toFixed(1)).join('')}"/>` : ''}<circle class="sp-dot f" cx="${x(T[0]).toFixed(1)}" cy="${y(V[0]).toFixed(1)}" r="2.6"/></svg>`;
}
