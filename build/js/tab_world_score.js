/* World tab: the Scorecard view. Lebanon on every indicator at once: its value and its rank in the latest year it has data (computed at build time, so no file is fetched).
   Rank 1 is the highest value; the bar shows the share of countries Lebanon is above. Ranks say nothing about whether a high value is good. */
(function () {
  const st = WD.S, E = esc, sc = st.score = { sort: 'topic' };
  const pct = m => (m.lr[3] > 1 ? (m.lr[3] - m.lr[2]) / (m.lr[3] - 1) * 100 : 100);
  WD.v.scorecard = {
    unmount() { }, theme() { },
    mount(body) {
      const L = WD.idx.indicators.filter(m => m.lr);
      body.innerHTML = `<p class="note">${E(t('Lebanon on every indicator: its value and its rank in the latest year it has data. Rank 1 is the highest value among countries and territories. The bar shows the share of countries Lebanon is above. Click an indicator to see it on the map.'))}</p>`
        + `<div class="wd-bar"><label class="sel"><span>${E(t('Sort'))}</span><select id="wdSort"><option value="topic">${E(t('By topic'))}</option><option value="hi">${E(t('Highest rank first'))}</option><option value="lo">${E(t('Lowest rank first'))}</option></select></label><span class="dim" id="wdScN"></span></div>`
        + `<div class="wd-tblbox wd-score" id="wdScore"></div><div id="wdSrc"></div>`;
      const q = s => body.querySelector(s);
      const row = m => `<tr><td><a href="${E(HUB.href('world', m.id, m.lr[0]))}" data-hub="world" data-hash="${E('world/' + m.id + '/' + m.lr[0])}">${E(WD.lbl(m))}</a></td><td class="mono">${E(fy(m.lr[0]))}</td><td class="mono">${E(WD.fv(m, m.lr[1]))}</td>`
        + `<td>${E(t('{rank} of {n}', { rank: WD.ord(m.lr[2]), n: nf(m.lr[3]) }))}</td><td><span class="wd-pb" role="img" aria-label="${E(t('Above {p}% of countries', { p: nf(Math.round(pct(m))) }))}"><i style="width:${pct(m).toFixed(0)}%"></i></span></td>`
        + `<td>${m.lr[5] > 1 ? E(t('{rank} of {n}', { rank: WD.ord(m.lr[4]), n: nf(m.lr[5]) })) : '–'}</td></tr>`;
      function draw() {
        let rows = '';
        if (sc.sort === 'topic') {
          const by = new Map(); L.forEach(m => { if (!by.has(m.topic)) by.set(m.topic, []); by.get(m.topic).push(m); });
          by.forEach((l, tp_) => { rows += `<tr class="wd-grp"><th colspan="6" scope="colgroup">${E(WD.tn(tp_))}</th></tr>` + l.map(row).join(''); });
        } else rows = [...L].sort((a, b) => (sc.sort === 'hi' ? pct(b) - pct(a) : pct(a) - pct(b)) || a.label.localeCompare(b.label)).map(row).join('');
        q('#wdScore').innerHTML = `<table class="wd-t wd-st"><thead><tr><th>${E(t('Indicator'))}</th><th>${E(t('Year'))}</th><th>${E(t('Value'))}</th><th>${E(t('World rank'))}</th><th>${E(t('Position'))}</th><th>${E(t('MENA rank'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
        q('#wdScN').textContent = tp('{n} indicator', '{n} indicators', L.length);
        q('#wdSrc').innerHTML = WD.srcLine(L.map(m => ({ src: m.src, url: m.url, lic: m.lic })));
      }
      q('#wdSort').value = sc.sort;
      q('#wdSort').addEventListener('change', ev => { sc.sort = ev.target.value; draw(); });
      draw();
    }
  };
})();
