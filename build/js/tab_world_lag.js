/* World tab: Lebanon's own series against each other with a lag (data/world/lebanon-annual.json: World indicators for Lebanon plus the Hub series, as yearly values).
   For a lag k the pairs are A(year) with B(year + k). Shown with n and a rough interval; the page says what it cannot tell. */
(function () {
  const st = WD.S, E = esc, lg = st.lg, MIN_N = 8, rf = v => WD.rf(v);
  const NAMES = [N('monthly'), N('weekly'), N('daily')];
  const xform = (pts, tr) => {
    const by = new Map(pts.map(p => [p[0], p[1]])), out = [];
    pts.forEach(([y, v]) => {
      if (tr === 'levels') out.push([y, v]);
      else if (by.has(y - 1)) { const p = by.get(y - 1); if (tr === 'diff') out.push([y, v - p]); else if (p !== 0) out.push([y, (v - p) / Math.abs(p) * 100]); }
    });
    return out;
  };
  const zs = pts => { const n = pts.length, m = pts.reduce((a, p) => a + p[1], 0) / n, sd = Math.sqrt(pts.reduce((a, p) => a + (p[1] - m) ** 2, 0) / n) || 1; return pts.map(p => [p[0], (p[1] - m) / sd]); };
  WD.lagView = function (body) {
    const me = WD.v.correlations, host = body.querySelector('#wdLag'); let S = null, byId = {}, busy = 0;
    async function load() {
      const my = ++busy; host.innerHTML = hubLoadingHTML();
      try { S = (await WD.lib.leb()).series; } catch (e) { if (my === busy && me.live) { host.innerHTML = hubErrorHTML(e); host.querySelector('[data-retry]').addEventListener('click', load); } return; }
      if (my !== busy || !me.live) return;
      byId = {}; S.forEach(s => { byId[s.id] = s; });
      if (!byId[lg.a]) lg.a = S[0].id; if (!byId[lg.b]) lg.b = S[Math.min(1, S.length - 1)].id;
      shell(); run();
    }
    const label = s => WD.lang2(s, 'label');
    const opts = (sel, qtext) => {
      const f = nrm(qtext || ''), by = new Map();
      S.forEach(s => { if (s.id !== sel && f && !nrm(label(s) + ' ' + s.grp).includes(f)) return; if (!by.has(s.grp)) by.set(s.grp, []); by.get(s.grp).push(s); });
      return [...by].map(([g, l]) => `<optgroup label="${E(WD.tn(g))}">${l.map(s => `<option value="${E(s.id)}"${s.id === sel ? ' selected' : ''}>${E(label(s))}</option>`).join('')}</optgroup>`).join('');
    };
    function shell() {
      host.innerHTML = `<p class="note">${E(t('Yearly values of Lebanese series: World Bank and other indicators, and the Hub series (monthly or weekly ones are averaged over each year). For a lag k the pairs are series A in a year and series B k years later.'))}</p>`
        + `<div class="wd-bar wd-two"><div class="wd-pick"><label class="sel wd-indsel"><span>${E(t('Series A'))}</span><select id="wdA"></select></label><input type="search" id="wdAq" class="wd-q" placeholder="${E(t('Filter series A'))}" aria-label="${E(t('Filter series A'))}"></div>`
        + `<div class="wd-pick"><label class="sel wd-indsel"><span>${E(t('Series B'))}</span><select id="wdB"></select></label><input type="search" id="wdBq" class="wd-q" placeholder="${E(t('Filter series B'))}" aria-label="${E(t('Filter series B'))}"></div></div>`
        + `<div class="wd-bar"><label class="sel"><span>${E(t('Compare'))}</span><select id="wdTr"><option value="diff">${E(t('Change from the previous year'))}</option><option value="pct">${E(t('Percent change from the previous year'))}</option><option value="levels">${E(t('Levels'))}</option></select></label>`
        + `<label class="sel"><span>${E(t('Largest lag'))}</span><select id="wdMx">${[3, 5, 8].map(n => `<option value="${n}">${E(t('{n} years', { n: nf(n) }))}</option>`).join('')}</select></label></div>`
        + `<div id="wdLagOut"></div>`;
      const q = s => host.querySelector(s);
      const fill = () => { q('#wdA').innerHTML = opts(lg.a, lg.qa); q('#wdB').innerHTML = opts(lg.b, lg.qb); q('#wdTr').value = lg.tr; q('#wdMx').value = String(lg.max); };
      fill();
      q('#wdA').addEventListener('change', ev => { lg.a = ev.target.value; run(); }); q('#wdB').addEventListener('change', ev => { lg.b = ev.target.value; run(); });
      q('#wdAq').addEventListener('input', ev => { lg.qa = ev.target.value; q('#wdA').innerHTML = opts(lg.a, lg.qa); });
      q('#wdBq').addEventListener('input', ev => { lg.qb = ev.target.value; q('#wdB').innerHTML = opts(lg.b, lg.qb); });
      q('#wdTr').addEventListener('change', ev => { lg.tr = ev.target.value; run(); }); q('#wdMx').addEventListener('change', ev => { lg.max = +ev.target.value; run(); });
    }
    function bars(res, W) {
      const H = 200, L = 36, R = 8, T = 16, B = 40, n = res.length, bw = (W - L - R) / n, Y = v => T + (1 - (v + 1) / 2) * (H - T - B);
      const ok = res.filter(r => r.r != null && r.n >= MIN_N), best = ok.reduce((b, r) => (!b || Math.abs(r.r) > Math.abs(b.r) ? r : b), null);
      let g = [-1, -0.5, 0, 0.5, 1].map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${L - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v === 0 ? '0' : rf(v)}</text>`).join('');
      res.forEach((r, i) => {
        const x = L + i * bw + bw * 0.14, w = bw * 0.72, has = r.r != null && r.n >= MIN_N, ci = has ? WD.fisher(r.r, r.n) : null;
        const tt = has ? t('Lag {lag}: r = {r}, n = {n}', { lag: WD.sgn(r.lag), r: rf(r.r), n: nf(r.n) }) + (ci ? ', ' + t('95% interval {a} to {b}', { a: rf(ci[0]), b: rf(ci[1]) }) : '') : t('Lag {lag}: too few overlapping years (n = {n})', { lag: WD.sgn(r.lag), n: nf(r.n) });
        if (has) { const y0 = Y(0), y1 = Y(r.r); g += `<rect class="lg-bar ${r.r >= 0 ? 'pos' : 'neg'}${best && r.lag === best.lag ? ' best' : ''}" x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" tabindex="0" role="img" aria-label="${E(tt)}"><title>${E(tt)}</title></rect>`
          + (bw > 26 ? `<text class="ax" x="${(x + w / 2).toFixed(1)}" y="${(r.r >= 0 ? Y(r.r) - 4 : Y(r.r) + 11).toFixed(1)}" text-anchor="middle">${rf(r.r)}</text>` : ''); }
        else g += `<text class="ax" x="${(x + w / 2).toFixed(1)}" y="${(Y(0) - 4).toFixed(1)}" text-anchor="middle"><title>${E(tt)}</title>·</text>`;
        g += `<text class="ax" x="${(x + w / 2).toFixed(1)}" y="${H - B + 14}" text-anchor="middle">${E(WD.sgn(r.lag))}</text>`;
      });
      g += `<text class="ax" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">${E(t('Lag in years (positive: A comes first)'))}</text>`;
      return { svg: `<svg class="hc-svg lg-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${E(t('Correlation at each lag'))}">${g}</svg>`, best };
    }
    function run() {
      const out = host.querySelector('#wdLagOut'), A = byId[lg.a], B = byId[lg.b]; if (!A || !B) return;
      const a = xform(A.pts, lg.tr), b = xform(B.pts, lg.tr), res = HUB.laggedCorr(a, b, lg.max), W = Math.max(300, out.clientWidth || host.clientWidth || 600);
      const { svg, best } = bars(res, W), zero = res.find(r => r.lag === 0);
      let h = `<div class="hc wd-lagchart">${svg}</div>`;
      if (best) {
        const ci = WD.fisher(best.r, best.n), who = best.lag === 0 ? t('same year') : best.lag > 0 ? t('{a} comes {k} years before {b}', { a: '“' + label(A) + '”', k: nf(best.lag), b: '“' + label(B) + '”' }) : t('{b} comes {k} years before {a}', { a: '“' + label(A) + '”', k: nf(-best.lag), b: '“' + label(B) + '”' });
        h += `<p class="wd-best"><b>${E(t('Largest absolute r: {r} at lag {lag}', { r: rf(best.r), lag: WD.sgn(best.lag) }))}</b> (${E(t('n = {n}', { n: nf(best.n) }))}${ci ? ', ' + E(t('95% interval {a} to {b}', { a: rf(ci[0]), b: rf(ci[1]) })) : ''}). ${E(who)}.</p>`;
        if (zero && zero.r != null && zero.n >= MIN_N && zero.lag !== best.lag) h += `<p class="dim">${E(t('Same-year r = {r} (n = {n}).', { r: rf(zero.r), n: nf(zero.n) }))}</p>`;
      } else h += `<p class="hub-empty">${E(t('These two series overlap in too few years to compute a correlation.'))}</p>`;
      h += `<ul class="wd-warn note"><li>${E(t('{k} lags were tried, so one of them will often look strong by chance. Read the biggest r as a lead to check, not a finding.', { k: nf(res.length) }))}</li>`
        + (lg.tr === 'levels' ? `<li>${E(t('Series that rise or fall over many years correlate even when unrelated. "Change from the previous year" removes much of that.'))}</li>` : '')
        + `<li>${E(t('A lead in time does not show that one series causes the other. Correlation is not causation, and with a few dozen yearly points a single year can move r.'))}</li></ul>`;
      const za = zs(a), zb = zs(b);
      h += `<div id="wdLagLines" class="wd-chart"></div><p class="note">${E(t('Both series are shown in standard units (distance from their own average) so they fit one axis. {a}; {b}.', { a: desc(A), b: desc(B) }))}</p>` + WD.srcLine([srcOf(A), srcOf(B)]);
      out.innerHTML = h;
      if (za.length > 1 && zb.length > 1) hubLine(out.querySelector('#wdLagLines'), { series: [{ id: 'a', label: 'A: ' + label(A), pts: za, color: 'var(--cedar)' }, { id: 'b', label: 'B: ' + label(B), pts: zb, color: 'var(--diesel)' }], height: 220, yFmt: v => fmt(v, 1), valFmt: v => fmt(v, 2), title: t('Series A and B in standard units') });
    }
    const desc = s => `${label(s)}: ${WD.unitOfS(s)}${s.agg ? ', ' + t('yearly average of {freq} values', { freq: t(s.agg.replace(/^mean of /, '').replace(/ values$/, '')) }) : ''}`;
    WD.unitOfS = s => lg.tr === 'diff' ? t('change in {unit}', { unit: s.unit }) : lg.tr === 'pct' ? t('percent change') : s.unit;
    const srcOf = s => ({ src: s.kind === 'world' ? (s.src.includes('worldbank') ? 'World Bank' : hostOf(s.src)) : hostOf(s.src), url: s.src, lic: s.lic });
    let w0 = 0;
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - w0) > 8 && w > 0 && S) { w0 = w; run(); } }); ro.observe(host); me.lro = ro; }
    load();
  };
})();
