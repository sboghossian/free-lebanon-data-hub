/* World tab: the Compare view. Lebanon against chosen peers on one indicator, plus Lebanon's rank over time in its region and in the world. */
(function () {
  const st = WD.S, E = esc;
  const SETS = { def: ['SYR', 'JOR', 'IRQ', 'ISR', 'CYP', 'EGY', 'TUR', 'SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'FRA', 'GRC', 'USA', 'WLD'], near: ['SYR', 'JOR', 'IRQ', 'ISR', 'CYP', 'EGY', 'TUR'], gulf: ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'WLD'], none: [] };
  // six peer colours checked with the dataviz validator (adjacent colour-blind separation >= 10, normal vision >= 21, light and dark); more peers are grey and named in the legend and the tooltip
  const SLOTS = ['var(--cedar)', 'var(--l-soc)', 'var(--diesel)', 'var(--sea)', 'var(--l-env)', 'var(--l-work)'], GREY = 'color-mix(in srgb, var(--ink-3) 55%, transparent)';
  const KEY = [[1975, N('civil war')], [1990, N('war ends')], [2019, N('crisis')]];
  const colorOf = (iso, i) => iso === 'LBN' ? 'var(--war)' : iso === 'WLD' ? 'var(--ink-2)' : (i < SLOTS.length ? SLOTS[i] : GREY);
  WD.v.compare = {
    unmount() { this.live = false; }, theme() { },
    mount(body) {
      const me = this; let d = null, m = WD.idx.byId[st.ind], hl = null, chart = null, rchart = null, logOn = false, marks = true, busy = 0, natData = null, natOn = false;   // off on every visit: the address (#compare/...) alone then always shows the same lines
      me.live = true;
      body.innerHTML = `<div class="wd-bar"><label class="sel wd-indsel"><span>${E(t('Indicator'))}</span><select id="wdInd">${WD.indOptions(st.ind)}</select></label></div>`
        + `<div class="wd-bar"><div class="chips" role="group" aria-label="${E(t('Sets of countries'))}"><button type="button" class="chip" data-set="def">${E(t('Default set'))}</button><button type="button" class="chip" data-set="near">${E(t('Neighbours'))}</button><button type="button" class="chip" data-set="gulf">${E(t('Gulf states'))}</button><button type="button" class="chip" data-set="none">${E(t('Lebanon only'))}</button></div>`
        + `<label class="sel"><span>${E(t('Add a country or group'))}</span><select id="wdAdd"></select></label>`
        + `<label class="wd-chk"><input type="checkbox" id="wdLogC"> ${E(t('Log scale'))}</label><label class="wd-chk"><input type="checkbox" id="wdKey" checked> ${E(t('Mark 1975, 1990 and 2019'))}</label><label class="wd-chk" id="wdNatL" hidden><input type="checkbox" id="wdNat"> ${E(t('Lebanon national sources'))}</label></div>`
        + `<div class="wd-peers" id="wdPeers"></div><div id="wdLoad"></div><div class="wd-cmp"><h3 class="d-h" id="wdCt"></h3><div id="wdChart" class="wd-chart"></div><p class="note" id="wdCn"></p>`
        + `<h3 class="d-h">${E(t("Lebanon's rank over time"))}</h3><div id="wdRank" class="wd-chart"></div><p class="note" id="wdRn"></p></div>`
        + `<details class="wd-tbl" id="wdTbl"><summary>${E(t('Table of the latest values'))}</summary><div class="wd-tblbox"></div></details><div id="wdSrc"></div>`;
      const q = s => body.querySelector(s);
      const hash = () => WD.hashCompare();
      async function load() {
        const my = ++busy, ld = q('#wdLoad'); ld.innerHTML = hubLoadingHTML(); m = WD.idx.byId[st.ind];
        try { d = await WD.lib.ind(st.ind); const nf_ = WD.idx.national && WD.idx.national.f; if (nf_ && !natData) { try { natData = await hubLoad(nf_); } catch (e2) { natData = null; } } } catch (e) { if (my === busy && me.live) { ld.innerHTML = hubErrorHTML(e); ld.querySelector('[data-retry]').addEventListener('click', load); } return; }
        if (my !== busy || !me.live) return;
        ld.innerHTML = ''; draw();
      }
      const list = () => ['LBN'].concat(st.peers.filter(k => k !== 'LBN'));
      function peers() {
        const idxOf = k => st.peers.filter(x => x !== 'WLD' && x !== 'LBN' && d && d.values[x]).indexOf(k);
        q('#wdPeers').innerHTML = `<ul class="wd-pl">${list().map(k => {
          const has = d && d.values[k] && d.values[k].some(v => v != null), c = colorOf(k, idxOf(k));
          return `<li class="wd-pc${hl === k ? ' on' : ''}${has ? '' : ' none'}"><button type="button" class="wd-pcb" data-hi="${E(k)}" aria-pressed="${hl === k}" title="${E(has ? t('Highlight') : t('No data for this indicator'))}"><i style="background:${has ? c : 'transparent'}"></i>${E(WD.cname(k))}${has ? '' : ` <span class="dim">(${E(t('no data'))})</span>`}</button>${k === 'LBN' ? '' : `<button type="button" class="wd-px" data-rm="${E(k)}" aria-label="${E(t('Remove {name}', { name: WD.cname(k) }))}">×</button>`}</li>`;
        }).join('')}</ul>${list().some(k => d && d.values[k] && idxOf(k) >= SLOTS.length) ? `<p class="note">${E(t('Only six peers get a colour. The others are grey: click a name to highlight its line, or hover the chart for every value.'))}</p>` : ''}`;
        q('#wdPeers').querySelectorAll('[data-hi]').forEach(b => b.addEventListener('click', () => { hl = hl === b.dataset.hi ? null : b.dataset.hi; peers(); lines(); }));
        q('#wdPeers').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { st.peers = st.peers.filter(x => x !== b.dataset.rm); if (hl === b.dataset.rm) hl = null; hash(); draw(); }));
      }
      function addBox() {
        const have = new Set(list()), ents = WD.idx.entities, ks = Object.keys(d.values).filter(k => !have.has(k) && ents[k]);
        const co = ks.filter(k => !WD.isAgg(k)).sort((a, b) => WD.cname(a).localeCompare(WD.cname(b), LANG)), gr = ks.filter(k => WD.isAgg(k)).sort((a, b) => WD.cname(a).localeCompare(WD.cname(b), LANG));
        const opt = k => `<option value="${E(k)}">${E(WD.cname(k))}</option>`;
        q('#wdAdd').innerHTML = `<option value="">${E(t('Choose...'))}</option><optgroup label="${E(t('Countries'))}">${co.map(opt).join('')}</optgroup><optgroup label="${E(t('Groups'))}">${gr.map(opt).join('')}</optgroup>`;
      }
      function series() {
        const ids = list().filter(k => d.values[k]), nonG = ids.filter(k => k !== 'LBN' && k !== 'WLD');
        const I = WD.idx, ef = k => m.wpp != null ? m.wpp : !m.est ? null : (k === 'LBN' && I.est_lbn && I.est_lbn[m.id] != null ? I.est_lbn[m.id] : (I.est_from && I.est_from[k] != null ? I.est_from[k] : null));
        const out = ids.map(k => ({ id: k, label: WD.cname(k), pts: WD.pts(d, k), color: colorOf(k, nonG.indexOf(k)), dash: k === 'WLD', estFrom: ef(k) })).filter(s => s.pts.length);
        const nk = natKey();
        if (natOn && natData && nk && natData.indicators[nk]) {
          const pts = Object.entries(natData.indicators[nk].years).map(([y, v]) => [+y, v]).sort((a, b) => a[0] - b[0]);
          out.push({ id: 'LBN-nat', label: t('Lebanon, national source'), pts, color: 'var(--diesel)', marks: pts.map(p => [p[0], p[1], t('National source')]) });
        }
        return out;
      }
      const natKey = () => (WD.idx.national && WD.idx.national.map && WD.idx.national.map[st.ind]) || null;
      function zones() {
        const I = WD.idx;
        if (m.wpp != null) return [{ x0: m.wpp + 0.5, label: t('UN projection') }];
        const y = m.est ? (I.est_lbn && I.est_lbn[m.id] != null ? I.est_lbn[m.id] : (I.est_from && I.est_from.LBN)) : null;
        return y != null && y < m.y1 ? [{ x0: y + 0.5, label: t('IMF estimates for Lebanon') }] : [];
      }
      function lines() {
        const S = series(), all = S.flatMap(s => s.pts.map(p => p[1]));
        const canLog = all.length && all.every(v => v > 0);
        q('#wdLogC').disabled = !canLog; if (!canLog) logOn = false; q('#wdLogC').checked = logOn;
        const o = { series: S, height: innerWidth < 520 ? 250 : 320, yFmt: v => WD.fn(m, v), valFmt: v => WD.fv(m, v), log: logOn, highlight: hl, title: WD.lbl(m),
          markers: marks ? KEY.map(([x, l]) => ({ x, label: t(l) })) : [], zones: zones(), estNote: m.wpp != null ? t('UN projection, medium variant') : (m.est ? t('IMF estimate or projection') : '') };
        if (!S.length) { q('#wdChart').innerHTML = `<p class="hub-empty">${E(t('No data to chart.'))}</p>`; chart = null; return; }
        if (chart && q('#wdChart').querySelector('svg')) chart.update(o); else chart = hubLine(q('#wdChart'), o);
        q('#wdCn').textContent = `${t('Lebanon is the thick line. Colours follow the country, not its rank.')} ${WD.unitOf(m)}`;
      }
      function rank() {
        const P = WD.idx.presets.mena.filter(k => d.values[k]), W = [], M = [], txt = new Map();
        d.years.forEach(y => {
          if (WD.val(d, 'LBN', y) == null) return;
          const w = WD.scopeRank(d, y, 'LBN', d.isoC), g = WD.scopeRank(d, y, 'LBN', P), pc = r => (r.n > 1 ? (r.n - r.rank) / (r.n - 1) * 100 : 100);
          if (w) { const v = pc(w) * 0.99 + y * 1e-7; W.push([y, v]); txt.set(v.toFixed(7), t('{rank} of {n}', { rank: WD.ord(w.rank), n: nf(w.n) })); }
          if (g) { const v = pc(g) * 0.99 + 0.5 + y * 1e-7; M.push([y, v]); txt.set(v.toFixed(7), t('{rank} of {n}', { rank: WD.ord(g.rank), n: nf(g.n) })); }
        });
        const el = q('#wdRank');
        if (W.length < 2) { el.innerHTML = `<p class="hub-empty">${E(t('Lebanon has too few values on this indicator to chart a rank.'))}</p>`; q('#wdRn').textContent = ''; rchart = null; return; }
        const o = { series: [{ id: 'w', label: t('World'), pts: W, color: 'var(--cedar)' }, { id: 'm', label: t('Middle East & North Africa'), pts: M, color: 'var(--diesel)' }], height: 220, yMin: 0, yMax: 100, yFmt: v => fmt(v, 0), valFmt: v => txt.get(v.toFixed(7)) || '', title: t("Lebanon's rank over time"), legend: true };
        if (rchart && el.querySelector('svg')) rchart.update(o); else rchart = hubLine(el, o);
        q('#wdRn').textContent = t('Height shows how many countries Lebanon is above: 100 means the highest value of all, 0 the lowest. Hover for the rank. Rank 1 is the highest value, which is not always the best outcome.');
      }
      function table() {
        const rows = list().filter(k => d.values[k]).map(k => { const p = WD.pts(d, k), l = p[p.length - 1]; if (!l) return null; const r = WD.yearRank(d, l[0]); return `<tr${k === 'LBN' ? ' class="hi"' : ''}><td>${E(WD.cname(k))}</td><td class="mono">${E(fy(l[0]))}</td><td class="mono">${E(WD.fv(m, l[1]))}</td><td class="mono">${r.rank[k] ? E(t('{rank} of {n}', { rank: WD.ord(r.rank[k]), n: nf(r.n) })) : '–'}</td></tr>`; }).filter(Boolean);
        q('#wdTbl .wd-tblbox').innerHTML = `<table class="wd-t"><thead><tr><th>${E(t('Country'))}</th><th>${E(t('Year'))}</th><th>${E(t('Value'))}</th><th>${E(t('Rank'))}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
      }
      function draw() {
        if (!d) return;
        q('#wdCt').textContent = WD.lbl(m);
        peers(); addBox(); lines(); rank(); if (q('#wdTbl').open) table();
        const nk = natKey(), nd = nk && natData ? natData.indicators[nk] : null;
        q('#wdNatL').hidden = !nd; q('#wdNat').checked = natOn && !!nd;
        q('#wdSrc').innerHTML = WD.srcLine([WD.indSrc(m)]) + (m.est ? `<p class="note">${E(t("Recent years are IMF estimates or projections. Dashed lines and the shaded band mark the values after each country's last actual year."))}</p>` : '')
          + (m.wpp != null ? `<p class="note">${E(t('From 2024 the UN values are projections (medium variant): dashed lines and the shaded band.'))}</p>` : '')
          + (nd && natOn ? `<p class="note"><b>${E(t('Lebanon national source'))}:</b> ${E(t(nd.label))}. ${nd.url ? `<a href="${E(nd.url)}" target="_blank" rel="noopener noreferrer">${E(fbHost(nd.url))}</a>. ` : ''}${E(t('Licence'))}: ${E(nd.lic ? t(nd.lic) : t('not stated by the publisher'))}. ${nd.lic ? '' : E(t('For that reason it is not in the CSV downloads.')) + ' '}${E(nd.note ? t(nd.note) : '')}</p>` : '');
      }
      q('#wdInd').addEventListener('change', ev => { st.ind = ev.target.value; chart = rchart = null; hash(); load(); });
      body.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => { st.peers = SETS[b.dataset.set].slice(); hl = null; hash(); draw(); }));
      q('#wdAdd').addEventListener('change', ev => { const k = ev.target.value; if (k) { st.peers.push(k); hash(); draw(); } });
      q('#wdLogC').addEventListener('change', ev => { logOn = ev.target.checked; lines(); });
      q('#wdKey').addEventListener('change', ev => { marks = ev.target.checked; lines(); });
      q('#wdNat').addEventListener('change', ev => { natOn = ev.target.checked; draw(); });
      q('#wdTbl').addEventListener('toggle', () => { if (q('#wdTbl').open && d) table(); });
      load();
    }
  };
})();
