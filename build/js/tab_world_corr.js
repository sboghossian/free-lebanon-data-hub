/* World tab: the Correlations view. (a) one indicator against another across countries in one year, with r, a fitted line and Lebanon marked.
   (b) Lebanon's own series against each other with a lag, shown carefully: the lag, r, n and an interval, never a claim about cause. */
(function () {
  const st = WD.S, E = esc, sc = st.sc = { x: 'NY.GDP.PCAP.CD', y: null, year: null, lx: null, ly: null };
  const lg = st.lg = { a: 'w:NY.GDP.MKTP.KD.ZG', b: 'w:SL.UEM.TOTL.ZS', tr: 'diff', max: 5, qa: '', qb: '' };
  const NOTE_CAUSE = N('Correlation is not causation. A high r only says that two things move together across countries. A third factor, such as national income, can drive both, and a few unusual countries can change r a lot.');
  const spearman = (xs, ys) => {
    const rk = a => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
    return HUB.pearson(rk(xs), rk(ys));
  };
  const fisher = (r, n) => { if (r == null || n < 4 || Math.abs(r) >= 1) return null; const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)]; };
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v));
  const rf = v => (v < 0 ? '−' : '') + fmt(Math.abs(v), 2);
  const joint = (a, b) => { const out = {}; a.isoC.forEach(k => { if (!b.values[k]) return; a.years.forEach(y => { if (WD.val(a, k, y) != null && WD.val(b, k, y) != null) out[y] = (out[y] || 0) + 1; }); }); return out; };
  const pick = (id, sel, others) => `<label class="sel wd-indsel"><span>${E(others)}</span><select id="${id}">${WD.indOptions(sel)}</select></label>`;

  WD.v.correlations = {
    unmount() { this.live = false; if (this.ro) this.ro.disconnect(); if (this.lro) this.lro.disconnect(); }, theme() { },
    mount(body) {
      const me = this; me.live = true;
      if (!sc.y) sc.y = st.ind === sc.x || /^GDP per capita/.test((WD.idx.byId[st.ind] || {}).label || '') ? 'SP.DYN.LE00.IN' : st.ind;
      const B = WD.idx.byId, L = WD.idx.indicators;
      if (!B[sc.x]) sc.x = L[0].id; if (!B[sc.y]) sc.y = L[Math.min(1, L.length - 1)].id;
      body.innerHTML = `<h3 class="d-h">${E(t('Across countries'))}</h3><p class="note">${E(t('Each dot is a country in one year. Pick two indicators.'))}</p>`
        + `<div class="wd-bar">${pick('wdX', sc.x, t('Horizontal axis'))}${pick('wdY', sc.y, t('Vertical axis'))}<button type="button" class="chip" id="wdSwap">${E(t('Swap axes'))}</button></div>`
        + `<div class="wd-bar wd-yrbar"><span class="wd-yl">${E(t('Year'))}</span><input id="wdYear" type="range" step="1" aria-label="${E(t('Year'))}"><output id="wdYearOut" class="mono" for="wdYear"></output>`
        + `<label class="wd-chk"><input type="checkbox" id="wdLx"> ${E(t('Log horizontal axis'))}</label><label class="wd-chk"><input type="checkbox" id="wdLy"> ${E(t('Log vertical axis'))}</label></div><div id="wdLoad"></div>`
        + `<div class="wd-sc" id="wdSc"></div><div class="wd-stats" id="wdStats" aria-live="polite"></div><p class="note wd-cause">${E(t(NOTE_CAUSE))}</p><div id="wdSrc"></div>`
        + `<h3 class="d-h">${E(t("Lebanon's own series, with a lag"))}</h3><div id="wdLag"></div>`;
      scatter(body); WD.lagView(body);
    }
  };

  /* ---------------------------------------------------------------- (a) scatter across countries */
  function scatter(body) {
    const q = s => body.querySelector(s), me = WD.v.correlations, slider = q('#wdYear'); let dx = null, dy = null, busy = 0, tip = null;
    async function load() {
      const my = ++busy, ld = q('#wdLoad'); ld.innerHTML = hubLoadingHTML();
      try { [dx, dy] = await Promise.all([WD.lib.ind(sc.x), WD.lib.ind(sc.y)]); } catch (e) { if (my === busy && me.live) { ld.innerHTML = hubErrorHTML(e); ld.querySelector('[data-retry]').addEventListener('click', load); } return; }
      if (my !== busy || !me.live) return;
      ld.innerHTML = '';
      const J = joint(dx, dy), ys = Object.keys(J).map(Number).sort((a, b) => a - b), mx = Math.max(0, ...ys.map(y => J[y]));
      if (!ys.length) { q('#wdSc').innerHTML = `<p class="hub-empty">${E(t('No country has values for both indicators.'))}</p>`; q('#wdStats').innerHTML = ''; return; }
      slider.min = ys[0]; slider.max = ys[ys.length - 1];
      if (sc.year == null || !J[sc.year] || J[sc.year] < 0.3 * mx) sc.year = [...ys].reverse().find(y => J[y] >= 0.6 * mx && WD.val(dx, 'LBN', y) != null && WD.val(dy, 'LBN', y) != null) || [...ys].reverse().find(y => J[y] >= 0.6 * mx) || ys[ys.length - 1];
      slider.value = sc.year; draw();
    }
    function draw() {
      if (!dx || !dy) return;
      const y = sc.year, mx = WD.idx.byId[sc.x], my = WD.idx.byId[sc.y];
      q('#wdYearOut').textContent = fy(y); slider.value = y;
      const raw = [];
      dx.isoC.forEach(k => { const a = WD.val(dx, k, y), b = WD.val(dy, k, y); if (a != null && b != null && dy.values[k]) raw.push({ id: k, x: a, y: b }); });
      const auto = arry => { const s = arry.filter(v => v > 0).sort((p, r) => p - r); return s.length === arry.length && s.length > 8 && WD.quant(s, 0.98) / WD.quant(s, 0.02) >= 40; };
      const lx = sc.lx == null ? auto(raw.map(p => p.x)) : sc.lx, ly = sc.ly == null ? auto(raw.map(p => p.y)) : sc.ly;
      q('#wdLx').checked = lx; q('#wdLy').checked = ly;
      const usable = raw.filter(p => (!lx || p.x > 0) && (!ly || p.y > 0)), pts = usable.map(p => ({ id: p.id, label: WD.cname(p.id), x: lx ? Math.log10(p.x) : p.x, y: ly ? Math.log10(p.y) : p.y, hi: p.id === 'LBN' }));
      const el = q('#wdSc'), W = el.clientWidth || 600;
      const cut = z => (z.length > 44 ? z.slice(0, 43) + '\u2026' : z), st_ = hubScatter(el, { points: pts, xLabel: cut(WD.lbl(mx)) + (lx ? ' (' + t('log scale') + ')' : ''), yLabel: cut(WD.lbl(my)) + (ly ? ' (' + t('log scale') + ')' : ''), height: W < 520 ? 300 : 380,
        xFmt: v => WD.fn(mx, lx ? Math.pow(10, v) : v), yFmt: v => WD.fn(my, ly ? Math.pow(10, v) : v), onPick: p => { st.sel = p.id; stats(pts, usable, lx, ly, st_, mx, my); mark(); } });
      if (pts.length >= 3) { tooltip(el, pts, usable, mx, my); mark(); }
      stats(pts, usable, lx, ly, st_, mx, my);
      q('#wdSrc').innerHTML = WD.srcLine([WD.indSrc(mx), WD.indSrc(my)]);
    }
    function mark() { const el = q('#wdSc'); el.querySelectorAll('.sc-dot').forEach(c => c.classList.remove('sel')); if (st.sel && st.sel !== 'LBN') { const i = el._pts && el._pts.findIndex(p => p.id === st.sel); if (i >= 0) { const c = el.querySelector(`.sc-dot[data-i="${i}"]`); if (c) c.classList.add('sel'); } } }
    function tooltip(el, pts, usable, mx, my) {
      el._pts = pts; tip = document.createElement('div'); tip.className = 'hc-tip'; tip.hidden = true; el.appendChild(tip);
      el.querySelectorAll('.sc-dot').forEach(c => {
        const u = usable[+c.dataset.i], show = () => { tip.innerHTML = `<b>${E(WD.cname(u.id))}</b><div class="mono">${E(WD.fv(mx, u.x))}</div><div class="mono">${E(WD.fv(my, u.y))}</div>`; tip.hidden = false; const r = el.getBoundingClientRect(), b = c.getBoundingClientRect(); tip.style.insetInlineStart = 'auto'; tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, b.left - r.left + 10)) + 'px'; tip.style.top = Math.max(4, b.top - r.top - tip.offsetHeight - 6) + 'px'; };
        c.addEventListener('pointerenter', show); c.addEventListener('focus', show); c.addEventListener('pointerleave', () => { tip.hidden = true; }); c.addEventListener('blur', () => { tip.hidden = true; });
      });
    }
    function stats(pts, usable, lx, ly, r0, mx, my) {
      const box = q('#wdStats'); if (pts.length < 3) { box.innerHTML = ''; return; }
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y), rs = spearman(xs, ys), ci = fisher(r0.r, r0.n), n = xs.length;
      const mxm = xs.reduce((a, b) => a + b, 0) / n, mym = ys.reduce((a, b) => a + b, 0) / n, sxx = xs.reduce((a, v) => a + (v - mxm) ** 2, 0), sl = sxx ? pts.reduce((a, p) => a + (p.x - mxm) * (p.y - mym), 0) / sxx : 0, ic = mym - sl * mxm;
      let h = `<p class="mono">${E(r0.r == null ? t('r is not defined for these points') : t('r = {r} (n = {n})', { r: rf(r0.r), n: nf(n) }))}${ci ? ' &middot; ' + E(t('95% interval {a} to {b}', { a: rf(ci[0]), b: rf(ci[1]) })) : ''}${rs.r != null ? ' &middot; ' + E(t('rank correlation {r}', { r: rf(rs.r) })) : ''}</p>`;
      const lb = pts.find(p => p.id === 'LBN');
      if (lb) { const pr = ic + sl * lb.x, pv = ly ? Math.pow(10, pr) : pr, av = ly ? Math.pow(10, lb.y) : lb.y; h += `<p>${E(t('Lebanon: {x} and {y}. The fitted line gives {p} for that horizontal value.', { x: WD.fv(mx, lx ? Math.pow(10, lb.x) : lb.x), y: WD.fv(my, av), p: WD.fv(my, pv) }))}</p>`; }
      else h += `<p>${E(t('Lebanon has no value for one of the two indicators in {year}.', { year: fy(sc.year) }))}</p>`;
      h += `<p class="note">${E(t('r is the Pearson correlation of the plotted values (on the log scale where that is chosen). The rank correlation ignores outliers. The interval is a rough 95% range that assumes the countries are a random sample, which they are not.'))}</p>`;
      box.innerHTML = h;
    }
    q('#wdX').addEventListener('change', ev => { sc.x = ev.target.value; sc.lx = null; sc.year = null; load(); });
    q('#wdY').addEventListener('change', ev => { sc.y = ev.target.value; sc.ly = null; sc.year = null; load(); });
    q('#wdSwap').addEventListener('click', () => { [sc.x, sc.y] = [sc.y, sc.x]; [sc.lx, sc.ly] = [sc.ly, sc.lx]; q('#wdX').value = sc.x; q('#wdY').value = sc.y; load(); });
    slider.addEventListener('input', () => { sc.year = +slider.value; draw(); });
    q('#wdLx').addEventListener('change', ev => { sc.lx = ev.target.checked; draw(); });
    q('#wdLy').addEventListener('change', ev => { sc.ly = ev.target.checked; draw(); });
    if (window.ResizeObserver) { let w0 = q('#wdSc').clientWidth; me.ro = new ResizeObserver(() => { const w = q('#wdSc').clientWidth; if (Math.abs(w - w0) > 8 && w > 0) { w0 = w; draw(); } }); me.ro.observe(q('#wdSc')); }
    load();
  }
  WD.spearman = spearman; WD.fisher = fisher; WD.sgn = sgn; WD.rf = rf;
})();
