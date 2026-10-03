/* ------------------------------------------------------------ v4 render hooks: agreement and life markers, term shading, axis brush and year taps */
// An agreement sits on the Agreements track when that track is on, and is not drawn again on its pillar's track.
const agreeElsewhere = (e, lid) => lid !== 'agree' && !!e.ag && e.lanes.includes('agree') && laneOn('agree');
const primLane = e => (e.ag && e.lanes.includes('agree') && laneOn('agree')) ? 'agree' : e.lanes.find(laneOn);
const AG_SHAPE = { accord: 'sq', treaty: 'sq', constitutional: 'sq', border: 'sq', maritime: 'sq', membership: 'sq', ceasefire: 'tri',
  un_resolution: 'un', loan: 'hex', grant: 'hex', energy: 'hex', trade: 'hex', mou: 'hex' };
const AG_KEY = [['sq', N('treaty, accord, border')], ['tri', N('ceasefire')], ['un', N('UN resolution')], ['hex', N('loan, grant, trade, energy')]];
const f1 = v => v.toFixed(1);
function agreeShape(k, px, cy, r) {
  const s = AG_SHAPE[k] || 'sq', R = r * 1.05;
  if (s === 'tri') return `<path class="m" d="M${f1(px)},${f1(cy - R * 1.2)} L${f1(px + R * 1.15)},${f1(cy + R * 0.9)} L${f1(px - R * 1.15)},${f1(cy + R * 0.9)} Z"/>`;
  if (s === 'un') return `<rect class="m" x="${f1(px - R * 1.3)}" y="${f1(cy - R * 0.72)}" width="${f1(R * 2.6)}" height="${f1(R * 1.44)}" rx="${f1(R * 0.72)}"/>`;
  if (s === 'hex') {
    const p = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i; return f1(px + R * 1.1 * Math.cos(a)) + ',' + f1(cy + R * 1.1 * Math.sin(a)); });
    return `<path class="m" d="M${p.join(' L')} Z"/>`;
  }
  return `<rect class="m" x="${f1(px - R * 0.92)}" y="${f1(cy - R * 0.92)}" width="${f1(R * 1.84)}" height="${f1(R * 1.84)}" rx="1"/>`;
}
// Life in Lebanon: a small four-point star.
function lifeShape(px, cy, r) {
  const R = r * 1.35, q = R * 0.38;
  return `<path class="m lf" d="M${f1(px)},${f1(cy - R)} L${f1(px + q)},${f1(cy - q)} L${f1(px + R)},${f1(cy)} L${f1(px + q)},${f1(cy + q)} L${f1(px)},${f1(cy + R)} L${f1(px - q)},${f1(cy + q)} L${f1(px - R)},${f1(cy)} L${f1(px - q)},${f1(cy - q)} Z"/>`;
}
// Shade the terms of the president, prime minister or governor picked in the filters.
function termShade(x, z, top, bottom) {
  let s = '';
  [['P', F.pres], ['PM', F.pm], ['G', F.gov]].forEach(([code, name]) => {
    if (!name) return;
    (OFFS[code] || []).filter(o => o.name === name).forEach(o => {
      const a = Math.max(dy(o.a), z.x0), b = Math.min(o.open ? NOW_T : dy(o.b), z.x1);
      if (b <= a) return;
      s += `<rect class="term-bg t-${code}" x="${f1(x(a))}" y="${top}" width="${f1(Math.max(1.5, x(b) - x(a)))}" height="${bottom - top}" data-tip="${tipA(t(OFF_NAME[code]) + ': ' + name, ' ' + yrs(o) + (o.acting ? ', ' + t('acting') : ''))}"/>`;
    });
  });
  return s;
}
function legendExtra() {
  const sh = (s, cls) => `<svg width="18" height="14" aria-hidden="true"><g class="ev ln-agree c-verified ${cls || ''}">${agreeShape(Object.keys(AG_SHAPE).find(k => AG_SHAPE[k] === s), 9, 7, 4)}</g></svg>`;
  return AG_KEY.map(([s, l]) => `<span>${sh(s)}${esc(t(l))}</span>`).join('')
    + `<span><svg width="16" height="14" aria-hidden="true"><g class="ev ln-life c-verified">${lifeShape(8, 7, 4)}</g></svg>${esc(t('life in Lebanon'))}</span>`
    + `<span class="lg-hint">${esc(t('Tap a year on the top axis for its year card; drag along the axis to pick a date range.'))}</span>`;
}
// The top axis row: a short tap opens the year card; a drag sets a date range (filter and zoom).
function wireAxis(svgEl, o) {
  const hit = svgEl.querySelector('.ax-hit'), br = svgEl.querySelector('.brush');
  if (!hit || !br) return;
  const toT = ev => {
    const r = svgEl.getBoundingClientRect(), px = (ev.clientX - r.left) * (o.W / r.width);
    return { px, t: o.z.x0 + (px - o.L) / (o.W - o.R - o.L) * (o.z.x1 - o.z.x0), py: (ev.clientY - r.top) * (o.H / r.height) };
  };
  let st = null;
  hit.addEventListener('pointerdown', ev => { st = toT(ev); try { hit.setPointerCapture(ev.pointerId); } catch (e) { /* old browser */ } ev.preventDefault(); });
  hit.addEventListener('pointermove', ev => {
    if (!st) return;
    const c = toT(ev), a = Math.max(o.L, Math.min(st.px, c.px)), b = Math.min(o.W - o.R, Math.max(st.px, c.px));
    br.setAttribute('x', f1(a)); br.setAttribute('width', f1(Math.max(0, b - a))); br.setAttribute('visibility', 'visible');
  });
  hit.addEventListener('pointerup', ev => {
    if (!st) return;
    const c = toT(ev), s0 = st; st = null; br.setAttribute('visibility', 'hidden');
    if (Math.abs(c.px - s0.px) < 6) { openYearCard(Math.floor(c.t)); return; }
    const a = Math.max(1800, Math.floor(Math.min(s0.t, c.t))), b = Math.min(2026, Math.floor(Math.max(s0.t, c.t)));
    F.from = a; F.to = b; fitRange(a, b + 1); saveF(); renderTimeline();
  });
  hit.addEventListener('pointercancel', () => { st = null; br.setAttribute('visibility', 'hidden'); });
  svgEl.addEventListener('click', ev => {
    if (ev.target.closest('[data-id],[data-claim],[data-anchor],.ax-hit,[data-tip]')) return;
    const c = toT(ev);
    if (c.px < o.L || c.px > o.W - o.R || c.py < (o.top == null ? 86 : o.top)) return;
    openYearCard(Math.floor(c.t));
  });
}
