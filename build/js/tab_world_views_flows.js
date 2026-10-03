/* World tab: the Flows view. Arcs on the globe or the flat map for the Lebanese diaspora, remittances, refugees and trade partners (data/world/flows/*.json). */
(function () {
  const st = WD.S, R = WD.stage, E = esc, fl = st.fl = { id: 'diaspora', year: null, top: 25 };
  const LABEL = { diaspora: N('Lebanese diaspora: people born in Lebanon who live abroad'), remit_in: N('Remittances sent to Lebanon (2021, modelled)'), remit_out: N('Remittances sent from Lebanon (2021, modelled)'),
    remit_world: N('Remittances worldwide, the largest corridors (2021, modelled)'), refugees_in: N('Refugees and asylum-seekers in Lebanon, by country of origin'), refugees_out: N('Lebanese refugees and asylum-seekers abroad'),
    immigrants: N('Foreign-born people living in Lebanon, by country of birth'), exports: N('Lebanese exports, by partner'), imports: N('Lebanese imports, by partner'), refugees_world: N('Refugees worldwide, the largest corridors (2025)') };
  const NOTE = { diaspora: N('People are counted by place of birth, not by citizenship. UN DESA publishes data for 75 destinations.'), remit_in: N('Modelled estimates, not measured bilateral data. 2021 is the latest edition.'), remit_out: N('Modelled estimates, not measured bilateral data. 2021 is the latest edition.'),
    remit_world: N('Modelled estimates, not measured bilateral data. The 1,500 largest corridors; the map shows the top ones.'), refugees_in: N('Refugees and asylum-seekers registered with UNHCR. Palestinians registered with UNRWA are not included.'),
    refugees_out: N('UNHCR counts. Lebanese people who left without claiming asylum are not included.'), immigrants: N('UN DESA publishes only a few origins for Lebanon, so most of the foreign-born are not split by country.'),
    exports: N('Reported by Lebanon. The 80 largest partners by cumulative value; 2024 is not yet published.'), imports: N('Reported by Lebanon. The 80 largest partners by cumulative value; 2024 is not yet published.'),
    refugees_world: N('UNHCR counts of refugees by country of origin and asylum, the 600 largest corridors.') };
  const GROUPS = [[N('People'), ['diaspora', 'refugees_in', 'refugees_out', 'immigrants']], [N('Money'), ['remit_in', 'remit_out', 'remit_world']], [N('Trade'), ['exports', 'imports']], [N('Worldwide'), ['refugees_world']]];
  const LB = [35.86, 33.85];
  const money = f => /US\$/.test(f.unit);
  WD.v.flows = {
    unmount() { if (this.timer) { clearInterval(this.timer); this.timer = null; } R.hide(); this.live = false; },
    theme() { if (this.draw) this.draw(); },
    mount(body) {
      const me = this; let f = null, yi = 0, rows = [], busy = 0;
      me.live = true; body.classList.add('wd-stagev');
      body.innerHTML = `<div class="wd-bar"><label class="sel wd-indsel"><span>${E(t('Flow'))}</span><select id="wdFl">${GROUPS.map(([g, ids]) => `<optgroup label="${E(t(g))}">${ids.filter(i => WD.idx.flowsById[i]).map(i => `<option value="${i}"${i === fl.id ? ' selected' : ''}>${E(t(LABEL[i]))}</option>`).join('')}</optgroup>`).join('')}</select></label>`
        + `<label class="sel"><span>${E(t('Arcs shown'))}</span><select id="wdTop">${[10, 25, 50, 100].map(n => `<option value="${n}"${n === fl.top ? ' selected' : ''}>${E(t('Top {n}', { n: nf(n) }))}</option>`).join('')}</select></label></div>`
        + `<div class="wd-bar wd-yrbar" id="wdYrBar"><button type="button" class="chip" id="wdPlay" aria-pressed="false">${E(t('Play'))}</button><input id="wdYear" type="range" step="1" aria-label="${E(t('Year'))}"><output id="wdYearOut" class="mono" for="wdYear"></output></div>${WD.stageBar()}`
        + `<div class="wd-main"><div class="wd-stagehost" id="wdStageHost"></div><aside class="wd-side" aria-live="polite"><div id="wdLeb" class="wd-card"></div></aside></div><p class="note" id="wdFlHow"></p><div id="wdLoad"></div>`
        + `<details class="wd-tbl" id="wdTbl"><summary>${E(t('Table of all partners'))}</summary><div class="wd-tblbox"></div></details><div id="wdSrc"></div>`;
      const q = s => body.querySelector(s), slider = q('#wdYear');
      const sync = WD.bindStage(body);
      R.show(q('#wdStageHost'), st.mode).then(() => { sync(); R.focus(st.preset); });
      async function load() {
        const my = ++busy, ld = q('#wdLoad'); ld.innerHTML = hubLoadingHTML();
        try { f = await WD.lib.flow(fl.id); } catch (e) { if (my === busy && me.live) { ld.innerHTML = hubErrorHTML(e); ld.querySelector('[data-retry]').addEventListener('click', load); } return; }
        if (my !== busy || !me.live) return;
        ld.innerHTML = '';
        const ys = f.years;
        q('#wdYrBar').hidden = !ys;
        if (ys) { if (fl.year == null || fl.year < ys[0] || fl.year > ys[ys.length - 1]) fl.year = ys[ys.length - 1]; slider.min = ys[0]; slider.max = ys[ys.length - 1]; slider.value = fl.year; }
        draw();
      }
      function build() {
        const ys = f.years; yi = ys ? Math.max(0, ys.indexOf(fl.year)) : 0;
        const mt = WD.idx.flowsById[fl.id], partnerOf = r => (mt.dir === 'in' ? r[0] : r[1]);
        rows = f.flows.map(r => ({ o: r[0], d: r[1], p: partnerOf(r), v: Array.isArray(r[2]) ? r[2][yi] : r[2] })).filter(r => r.v != null && r.v > 0 && (mt.dir === 'world' || r.p !== 'LBN')).sort((a, b) => b.v - a.v);
        return mt;
      }
      function draw() {
        if (!f) return;
        const mt = build(), total = rows.reduce((s, r) => s + r.v, 0), lab = t(LABEL[fl.id]), yr = f.years ? fl.year : f.year;
        q('#wdYearOut').textContent = f.years ? fy(fl.year) : '';
        // each country's share: the partner (or, for worldwide flows, both ends)
        const by = {};
        rows.forEach(r => { if (mt.dir === 'world') { by[r.o] = (by[r.o] || 0) + r.v; by[r.d] = (by[r.d] || 0) + r.v; } else by[r.p] = (by[r.p] || 0) + r.v; });
        const keys = Object.keys(by), fake = { isoC: keys, values: Object.fromEntries(keys.map(k => [k, [by[k]]])) }, sc = WD.scale(fake, {});
        const top = rows.slice(0, fl.top), mx = top.length ? top[0].v : 1, miss = new Set();
        const arcs = top.map(r => { const o = r.o === 'LBN' ? LB : WD.ll(r.o), dd = r.d === 'LBN' ? LB : WD.ll(r.d); if (!o) miss.add(r.o); if (!dd) miss.add(r.d); return { o, d: dd, w: 0.22 + 0.9 * Math.sqrt(r.v / mx), c1: 'diesel', c2: 'cedar' }; });
        const val = v => (money(f) ? 'US$ ' : '') + (f.unit === 'million US$' ? nfCompact(v * 1e6) : nfCompact(v));
        R.update({
          fill: iso => (by[iso] != null ? sc.colorOf(by[iso]) : null), arcs, sel: st.sel, tag: WD.cname('LBN'),
          tip: iso => { const v = by[iso]; return `<b>${E(WD.cname(iso))}</b><br>` + (v == null ? E(t('Not a partner in this data')) : `<span class="mono">${E(val(v))}</span><br>${E(t('{p}% of the total', { p: fmt(v / total * 100, 1) }))}`); },
          onPick: iso => { st.sel = st.sel === iso ? null : iso; R.update({ sel: st.sel }); }
        });
        const bars = rows.slice(0, 12).map(r => ({ id: r.p, label: mt.dir === 'world' ? WD.cname(r.o) + ' → ' + WD.cname(r.d) : WD.cname(r.p), value: r.v }));
        q('#wdLeb').innerHTML = `<h3 class="d-h">${E(t(LABEL[fl.id]))}${yr ? ', ' + E(fy(yr)) : ''}</h3><p class="wd-rank mono">${E(val(total))}</p><p class="note">${E(t('{n} partners in the data. Arcs run from the origin (amber) to the destination (green).', { n: nf(rows.length) }))}</p><div class="wd-bars" id="wdBars"></div>`;
        hubBars(q('#wdBars'), { items: bars, fmt: v => val(v) });
        q('#wdFlHow').textContent = t(NOTE[fl.id]) + (miss.size ? ' ' + t('{n} places in the top list are too small for this map; see the table.', { n: nf(miss.size) }) : '');
        q('#wdSrc').innerHTML = WD.srcLine([{ src: mt.src, url: mt.url, lic: mt.lic }, { src: 'Natural Earth', url: 'https://www.naturalearthdata.com/', lic: t('Public domain') }]);
        if (q('#wdTbl').open) table(total, val, mt);
      }
      function table(total, val, mt) {
        q('#wdTbl .wd-tblbox').innerHTML = `<table class="wd-t"><thead><tr><th>${E(mt.dir === 'world' ? t('From') : t('Partner'))}</th>${mt.dir === 'world' ? `<th>${E(t('To'))}</th>` : ''}<th>${E(t('Value'))}</th><th>${E(t('Share'))}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${E(WD.cname(mt.dir === 'world' ? r.o : r.p))}</td>${mt.dir === 'world' ? `<td>${E(WD.cname(r.d))}</td>` : ''}<td class="mono">${E(val(r.v))}</td><td class="mono">${fmt(r.v / total * 100, 1)}%</td></tr>`).join('')}</tbody></table>`;
      }
      q('#wdTbl').addEventListener('toggle', () => { if (q('#wdTbl').open && f) draw(); });
      q('#wdFl').addEventListener('change', ev => { fl.id = ev.target.value; load(); });
      q('#wdTop').addEventListener('change', ev => { fl.top = +ev.target.value; draw(); });
      slider.addEventListener('input', () => { fl.year = +slider.value; draw(); });
      const play = q('#wdPlay'), stop = () => { if (me.timer) { clearInterval(me.timer); me.timer = null; } play.setAttribute('aria-pressed', 'false'); play.textContent = t('Play'); };
      play.addEventListener('click', () => {
        if (me.timer) { stop(); return; }
        const ys = f && f.years; if (!ys) return;
        if (fl.year >= ys[ys.length - 1]) fl.year = ys[0];
        play.setAttribute('aria-pressed', 'true'); play.textContent = t('Pause');
        me.timer = setInterval(() => { if ($('#world').hidden || !me.live || fl.year >= ys[ys.length - 1]) { stop(); return; } fl.year++; slider.value = fl.year; draw(); }, WD.reduce() ? 1100 : 650);
      });
      me.draw = draw;
      load();
    }
  };
})();
