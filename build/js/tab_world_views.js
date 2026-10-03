/* World tab: the Map view (an indicator and a year on the globe or the flat map) and the Flows view (arcs from and to Lebanon). Both share the stage (tab_world_stage.js). */
(function () {
  const st = WD.S, R = WD.stage, E = esc;
  const regionSet = () => (st.preset === 'mena' ? WD.idx.presets.mena : st.preset === 'europe' ? WD.idx.presets.europe : null);
  const presets = () => [['world', t('World')], ['mena', t('Middle East & North Africa')], ['europe', t('Europe')], ['us', t('United States')]];
  const stageBar = () => `<div class="wd-bar wd-opts"><div class="chips" role="group" aria-label="${E(t('Map type'))}"><button type="button" class="chip" data-mode="globe" aria-pressed="${st.mode === 'globe'}">${E(t('3D globe'))}</button><button type="button" class="chip" data-mode="flat" aria-pressed="${st.mode === 'flat'}">${E(t('Flat map'))}</button></div>`
    + `<div class="chips" role="group" aria-label="${E(t('Region'))}">${presets().map(([k, l]) => `<button type="button" class="chip" data-preset="${k}" aria-pressed="${st.preset === k}">${E(l)}</button>`).join('')}</div><button type="button" class="chip" data-find>${E(t('Find Lebanon'))}</button></div>`;
  function bindStage(body, onPreset) {
    const sync = () => body.querySelectorAll('[data-mode]').forEach(b => { b.setAttribute('aria-pressed', String(R.mode === b.dataset.mode)); if (b.dataset.mode === 'globe') { b.disabled = !!R.noGL; b.title = R.noGL ? t('The 3D globe needs WebGL, which this browser does not provide. The flat map shows the same data.') : ''; } });
    body.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', async () => { st.mode = b.dataset.mode; WD.savePref(); await R.setMode(st.mode); sync(); R.focus(st.preset); }));
    body.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      st.preset = b.dataset.preset; WD.savePref(); R.focus(st.preset);
      body.querySelectorAll('[data-preset]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (onPreset) onPreset();
    }));
    body.querySelector('[data-find]').addEventListener('click', () => R.focus('lebanon'));
    return sync;
  }
  const tag = (m, d, y) => {
    const r = WD.yearRank(d, y), rk = r.rank.LBN;
    return rk ? t('{place}: {rank} of {n}', { place: WD.cname('LBN'), rank: WD.ord(rk), n: nf(r.n) }) : t('{place}: no data for {year}', { place: WD.cname('LBN'), year: fy(y) });
  };
  const pts = (d, k) => { const a = d.values[k] || []; return d.years.map((y, i) => [y, a[i]]).filter(p => p[1] != null); };
  WD.pts = pts;
  const dl = rows => `<dl class="wd-dl">${rows.map(([a, b]) => `<div><dt>${E(a)}</dt><dd>${b}</dd></div>`).join('')}</dl>`;
  const hint = m => m.hi === 'better' ? t('A higher value is generally better on this indicator.') : m.hi === 'worse' ? t('A higher value is generally worse on this indicator.') : t('Neither a higher nor a lower value is better on this indicator.');

  /* ---------------------------------------------------------------- Map */
  WD.v.map = {
    unmount() { if (this.timer) { clearInterval(this.timer); this.timer = null; } R.hide(); this.live = false; },
    theme() { if (this.theme2) this.theme2(); },
    mount(body) {
      const me = this; let d = null, m = WD.idx.byId[st.ind], sc = null, year = null, busy = 0;
      me.live = true; body.classList.add('wd-stagev');
      body.innerHTML = `<div class="wd-bar"><label class="sel wd-indsel"><span>${E(t('Indicator'))}</span><select id="wdInd">${WD.indOptions(st.ind)}</select></label></div>`
        + `<div class="wd-bar wd-yrbar"><button type="button" class="chip" id="wdPlay" aria-pressed="false">${E(t('Play'))}</button><input id="wdYear" type="range" step="1" aria-label="${E(t('Year'))}"><output id="wdYearOut" class="mono" for="wdYear"></output></div>${stageBar()}`
        + `<div class="wd-bar wd-opts2"><label class="wd-chk" id="wdLogL" hidden><input type="checkbox" id="wdLog"> ${E(t('Log colour scale'))}</label><label class="wd-chk" id="wdRegL" hidden><input type="checkbox" id="wdReg"> ${E(t('Scale colours to this region'))}</label></div>`
        + `<div class="wd-main"><div class="wd-col"><div class="wd-stagehost" id="wdStageHost"></div><div id="wdLegend" class="wd-legend"></div></div><aside class="wd-side" aria-live="polite"><div id="wdLeb" class="wd-card"></div><div id="wdSel" class="wd-card" hidden></div></aside></div><div id="wdLoad"></div>`
        + `<details class="wd-tbl" id="wdTbl"><summary>${E(t('Table of values for this year'))}</summary><div class="wd-tblbox"></div></details><div id="wdSrc"></div>`;
      const q = s => body.querySelector(s), slider = q('#wdYear');
      const sync = bindStage(body, () => { updateRegionBox(); draw(); });
      R.show(q('#wdStageHost'), st.mode).then(mode => { sync(); R.focus(st.preset); });
      function updateRegionBox() { q('#wdRegL').hidden = !regionSet(); q('#wdLogL').hidden = !(sc && sc.canLog); }
      function hash() { WD.hashMap(); }
      async function load() {
        const my = ++busy, ld = q('#wdLoad');
        ld.innerHTML = hubLoadingHTML(); m = WD.idx.byId[st.ind];
        try { d = await WD.lib.ind(st.ind); } catch (e) { if (my === busy && me.live) { ld.innerHTML = hubErrorHTML(e); ld.querySelector('[data-retry]').addEventListener('click', load); } return; }
        if (my !== busy || !me.live) return;
        ld.innerHTML = '';
        year = WD.defYear(m, d); st.year = year;
        slider.min = m.y0; slider.max = m.y1; slider.value = year;
        draw();
      }
      function setYear(y) { year = y; st.year = y; slider.value = y; draw(); hash(); }
      function draw() {
        if (!d) return;
        const rs = st.region ? regionSet() : null;
        const key = [st.log, rs ? st.preset : ''].join('|');
        if (!d._sc || d._sc.key !== key) d._sc = { key, sc: WD.scale(d, { log: st.log, set: rs && rs.filter(k => d.values[k]) }) };
        sc = d._sc.sc;
        q('#wdYearOut').textContent = fy(year);
        slider.setAttribute('aria-valuetext', fy(year));
        q('#wdLog').checked = !!sc.log; q('#wdReg').checked = !!st.region; updateRegionBox();
        const r = WD.yearRank(d, year), label = tag(m, d, year);
        R.update({
          fill: iso => sc.colorOf(WD.val(d, iso, year)),
          tip: iso => { const v = WD.val(d, iso, year); return `<b>${E(WD.cname(iso))}</b><br>` + (v == null ? E(t('No data for {year}', { year: fy(year) })) : `<span class="mono">${E(WD.fv(m, v))}</span><br>${E(t('{rank} of {n}', { rank: WD.ord(r.rank[iso]), n: nf(r.n) }))}`); },
          tag: label, sel: st.sel, arcs: [],
          onPick: iso => { st.sel = st.sel === iso ? null : iso; R.update({ sel: st.sel }); side(); }
        });
        side(); legend(); if (q('#wdTbl').open) table();
        q('#wdSrc').innerHTML = WD.srcLine([WD.indSrc(m), { src: 'Natural Earth', url: 'https://www.naturalearthdata.com/', lic: t('Public domain') }])
          + `<p class="note">${E(t('Borders are drawn as Natural Earth shows them (de facto boundaries).'))}${m.est ? ' ' + E(t('Recent years are IMF estimates or projections.')) : ''}</p>`;
      }
      function side() {
        const lv = WD.val(d, 'LBN', year), r = WD.yearRank(d, year), P = WD.idx.presets, label = tag(m, d, year);
        let h = `<h3 class="d-h">${E(t('Lebanon in {year}', { year: fy(year) }))}</h3>`;
        if (lv == null) {
          const lp = pts(d, 'LBN'), last = lp.filter(p => p[0] <= year).pop() || lp[lp.length - 1];
          h += `<p class="wd-rank">${E(label)}</p>` + (last ? `<p>${E(t('Latest value: {v} ({y}).', { v: WD.fv(m, last[1]), y: fy(last[0]) }))}</p>` : `<p>${E(t('This indicator has no value for Lebanon.'))}</p>`);
        } else {
          const world = WD.val(d, 'WLD', year), eu = WD.median(P.europe.map(k => WD.val(d, k, year))), us = WD.val(d, 'USA', year), mena = WD.scopeRank(d, year, 'LBN', P.mena);
          const rows = [[t('Value'), `<span class="mono">${E(WD.fv(m, lv))}</span>`]];
          if (world != null) rows.push([t('World'), `<span class="mono">${E(WD.fv(m, world))}</span>`]);
          rows.push([t('Median country'), `<span class="mono">${E(WD.fv(m, WD.median(r.arry.map(p => p[1]))))}</span>`]);
          if (mena) rows.push([t('Middle East & North Africa'), E(t('{rank} of {n}', { rank: WD.ord(mena.rank), n: nf(mena.n) }))]);
          if (eu != null) rows.push([t('Europe, median country'), `<span class="mono">${E(WD.fv(m, eu))}</span>`]);
          if (us != null) rows.push([t('United States'), `<span class="mono">${E(WD.fv(m, us))}</span>` + (us > 0 && lv > 0 ? `<br><span class="dim">${E(t('Lebanon is {p}% of it', { p: nf(Math.round(lv / us * 100)) }))}</span>` : '')]);
          h += `<p class="wd-rank">${E(label)}</p>${dl(rows)}`;
        }
        const lp = pts(d, 'LBN');
        if (lp.length > 1) h += `<div class="wd-sp">${hubSpark(lp, t('Lebanon, {a} to {b}', { a: fy(lp[0][0]), b: fy(lp[lp.length - 1][0]) }))}</div><p class="note">${E(t('Lebanon, {a} to {b}', { a: fy(lp[0][0]), b: fy(lp[lp.length - 1][0]) }))}</p>`;
        h += `<p class="note">${E(t('Rank 1 is the highest value among {n} countries and territories with data in {year}.', { n: nf(r.n), year: fy(year) }))} ${E(hint(m))}</p>`;
        q('#wdLeb').innerHTML = h;
        const sel = q('#wdSel');
        if (!st.sel || st.sel === 'LBN') { sel.hidden = true; sel.innerHTML = ''; return; }
        const v = WD.val(d, st.sel, year), sp = pts(d, st.sel);
        sel.hidden = false;
        sel.innerHTML = `<h3 class="d-h">${E(WD.cname(st.sel))}</h3>` + (v == null ? `<p>${E(t('No data for {year}', { year: fy(year) }))}</p>` : `<p class="mono">${E(WD.fv(m, v))}</p><p>${E(t('{rank} of {n}', { rank: WD.ord(r.rank[st.sel]), n: nf(r.n) }))}</p>`)
          + (sp.length > 1 ? `<div class="wd-sp">${hubSpark(sp, WD.cname(st.sel))}</div>` : '')
          + `<p><a href="${E(HUB.href('compare', st.ind, 'LBN,' + st.sel))}" data-hub="world" data-hash="${E('compare/' + st.ind + '/LBN,' + st.sel)}">${E(t('Compare with Lebanon'))}</a> &middot; <button type="button" class="chip" id="wdClear">${E(t('Clear selection'))}</button></p>`;
        sel.querySelector('#wdClear').addEventListener('click', () => { st.sel = null; R.update({ sel: null }); side(); });
      }
      function legend() {
        const lg = q('#wdLegend');
        if (sc.empty) { lg.innerHTML = `<p class="hub-empty">${E(t('No country has a value for this indicator.'))}</p>`; return; }
        const lo = WD.fn(m, sc.lo), hi = WD.fn(m, sc.hi), mid = sc.div ? WD.fn(m, 0) : sc.log ? WD.fn(m, Math.sqrt(sc.lo * sc.hi)) : WD.fn(m, (sc.lo + sc.hi) / 2);
        lg.innerHTML = `<div class="wd-lg"><div class="wd-lgbar" style="background:${sc.stops ? WD.gradient(sc) : ''}" role="img" aria-label="${E(t('Colour scale from {a} to {b}', { a: lo, b: hi }))}"></div><div class="wd-lgt mono"><span>${E(lo)}</span><span>${E(mid)}</span><span>${E(hi)}</span></div></div>`
          + `<p class="wd-lgn"><span class="wd-nd"><i class="wd-hatch"></i>${E(t('No data'))}</span> <span class="dim">${E(WD.unitOf(m))}${sc.log ? ' &middot; ' + E(t('log scale')) : ''}${sc.div ? ' &middot; ' + E(t('amber below zero, blue above')) : ''}</span></p>`
          + `<p class="note">${E(t('One colour scale for every year, so colours can be compared over time. The ends are the 2nd and 98th percentiles.'))}</p>`;
      }
      function table() {
        const r = WD.yearRank(d, year);
        q('#wdTbl .wd-tblbox').innerHTML = `<table class="wd-t"><thead><tr><th>${E(t('Rank'))}</th><th>${E(t('Country'))}</th><th>${E(t('Value'))}</th></tr></thead><tbody>${r.arry.map(([k, v]) => `<tr${k === 'LBN' ? ' class="hi"' : ''}><td class="mono">${nf(r.rank[k])}</td><td>${E(WD.cname(k))}</td><td class="mono">${E(WD.fv(m, v))}</td></tr>`).join('')}</tbody></table>`;
      }
      q('#wdTbl').addEventListener('toggle', () => { if (q('#wdTbl').open && d) table(); });
      q('#wdInd').addEventListener('change', ev => { st.ind = ev.target.value; st.log = null; load().then(hash); });
      slider.addEventListener('input', () => setYear(+slider.value));
      q('#wdLog').addEventListener('change', ev => { st.log = ev.target.checked; draw(); });
      q('#wdReg').addEventListener('change', ev => { st.region = ev.target.checked; draw(); });
      const play = q('#wdPlay'), stop = () => { if (me.timer) { clearInterval(me.timer); me.timer = null; } play.setAttribute('aria-pressed', 'false'); play.textContent = t('Play'); };
      play.addEventListener('click', () => {
        if (me.timer) { stop(); return; }
        if (!d) return;
        if (year >= m.y1) setYear(m.y0);
        play.setAttribute('aria-pressed', 'true'); play.textContent = t('Pause');
        me.timer = setInterval(() => { if ($('#world').hidden || !me.live) { stop(); return; } if (year >= m.y1) { stop(); return; } setYear(year + 1); }, WD.reduce() ? 1100 : 650);
      });
      me.draw = draw; me.stop = stop; me.theme2 = () => { if (d) d._sc = null; draw(); };
      load();
    }
  };
  WD.stageBar = stageBar; WD.bindStage = bindStage; WD.dl = dl;
})();
