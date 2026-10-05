// Checks for the Trade & investment tab (LEG B-trade): every view renders, sources and licences are named, the measures note and the 2024 figures are present, weight is left out and said so,
// gaps are shown as gaps, FDI sources are side by side, the IMF file is not offered as CSV, 0 console errors at 1400 and 390, Arabic (rtl) and French, no overflow, empty and error states.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const go = async (p, h, expr, ms = 30000) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`!document.querySelector("#trBody .hub-load") && (${expr})`, ms); };
  const Q = s => `document.querySelectorAll(${JSON.stringify(s)}).length`;
  const VIEWS = [['#trade/overview', `${Q('#trOvC1 .hc-line')} === 3 && ${Q('#trOvC2 .hc-line')} === 4 && ${Q('#trOvC3 .hc-line')} === 3 && ${Q('#trOvFig li')} === 4`],
    ['#trade/product/X/2024', `${Q('#trChBars li')} === 15 && ${Q('#trHsBars li')} === 25 && ${Q('#trLnC .hc-line')} === 1`],
    ['#trade/partner/X/2024', `${Q('#trPaMap path.has')} >= 30 && ${Q('#trPaBars li')} === 15 && ${Q('#trPlC .hc-line')} === 1`],
    ['#trade/customs/M/2025', `${Q('#trCuC .hc-line')} === 2 && ${Q('#trCuCh li')} === 15 && ${Q('#trCuPa li')} === 15`],
    ['#trade/investment', `${Q('#trFdC .hc-line')} === 2 && ${Q('#trStC .hc-line')} === 2 && ${Q('#trGfC .hc-line')} === 1 && ${Q('#trIdY li')} === 18 && ${Q('#trOBars li')} >= 5 && ${Q('#trVc li')} === 11`]];
  const ov = readData('trade/overview.json'), inv = readData('trade/investment.json'), man = readData('manifest.json'), files = man.files || man;
  ok('trade: the overview file holds 30 years of BACI goods totals (1995 to 2024) and nine WDI series plus the current account', ov.years.length === 30 && ov.years[0] === 1995 && ov.years[29] === 2024 && ov.series.length === 10);
  ok('trade: BACI 2024 goods exports are US$ 4,204,985,173 and Customs 2024 exports US$ 2.7 billion (the sources differ)', ov.baci.X[29] === 4204985173 && Math.abs(ov.customs.X[ov.customs.years.indexOf(2024)] / 1e9 - 2.70) < 0.01);
  ok('trade: the 2023 FDI inflow is US$ 1,219 million at UNCTAD and US$ 655 million at the World Bank, both kept as separate series', (() => { const g = id => inv.series.find(s => s.id === id).points.find(p => p[0] === '2023')[1]; return Math.round(g('unctad_fdi_flow_inward') / 1e6) === 1219 && Math.round(g('wb_bx_klt_dinv_cd_wd') / 1e6) === 655; })());
  ok('trade: the venture file has gaps (2016, 2018, 2019, 2020 absent) and every row is marked reported', [2016, 2018, 2019, 2020].every(y => !inv.vc.rows.some(r => r.year === y)) && inv.vc.rows.every(r => r.status === 'reported'));
  ok('trade: the IMF file is published as JSON only, with no CSV and the IMF terms as its licence', files.some(f => f.path === 'data/trade/fdi-origin.json' && /IMF/.test(f.license)) && !files.some(f => /csv\/.*(fdi|imf)/i.test(f.path)));
  ok('trade: the BACI and Customs downloads are listed (CSV) and no trade data file is over 1 MB', ['goods-by-chapter-baci', 'goods-by-partner-baci', 'top-products-baci', 'customs-monthly', 'customs-by-chapter', 'customs-by-partner', 'idal-projects-by-sector', 'venture-funding-annual', 'goods-totals-baci'].every(n => files.some(f => f.path === `data/csv/trade/${n}.csv`))
    && files.filter(f => /^data\/trade\//.test(f.path)).every(f => f.size < 1048576));
  ok('trade: the Customs file carries value only, no weight', (() => { const c = readData('trade/customs.json'); return c.by_chapter[0].length === 4 && c.months[0].length === 3 && c.by_partner[0].length === 5 && !/weight|tonne/i.test(JSON.stringify(c.meta)); })());

  // ---- 1400, English
  const p = await open(1400, SITE, { hash: '#trade' });
  ok('trade: the tab opens by deep link with five view chips', await p.wait('!document.getElementById("trade").hidden && document.querySelectorAll("#tradeRoot [data-tv]").length === 5', 20000));
  ok('trade: the tab button is labelled "Trade & investment"', await p.ev('[...document.querySelectorAll(".hub-tabs [role=tab]")].some(b => b.textContent === "Trade & investment")'));
  ok('trade: one "Data behind this tab" link to #data/trade and no table on the tab', await p.ev('document.querySelectorAll("#trade a[href=\\"#data/trade\\"]").length === 1 && document.querySelectorAll("#trade table").length === 0'));
  ok('trade: Overview renders (goods lines, four measures, services and current account)', await go(p, VIEWS[0][0], VIEWS[0][1]));
  ok('trade: the measures note says BACI, Customs and the World Bank do not measure the same thing', await p.ev('/do not measure the same thing/.test(document.getElementById("trOvNote").textContent) && /Lebanese Customs/.test(document.getElementById("trOvNote").textContent)'));
  ok('trade: the 2024 export figure of each measure is given (BACI, Customs) and WDI says what it has instead', await p.ev('(() => { const t = document.getElementById("trOvFig").textContent; return /BACI.*2024/.test(t) && /Customs.*2024/.test(t) && /balance of payments.*no value for 2024/.test(t); })()'));
  ok('trade: every Overview chart names its source and licence', await p.ev('document.querySelectorAll("#trOv1 .tr-src, #trOv2 .tr-src, #trOv3 .tr-src").length === 3 && [...document.querySelectorAll("#trade .tr-src")].every(s => /Licence/.test(s.textContent))'));
  await p.ev('document.querySelector("#trade [data-of=M]").click()'); await sleep(300);
  ok('trade: switching to imports redraws the four measures', await p.ev('document.querySelectorAll("#trOvC2 .hc-line").length === 4 && /imports/.test(document.getElementById("trOvNote").textContent)'));
  ok('trade: Product renders 15 chapters, a chapter line and 25 HS6 products, with BACI named', await go(p, VIEWS[1][0], VIEWS[1][1]) && await p.ev('/BACI/.test(document.querySelector("#trPrBox .tr-src").textContent) && /Etalab/.test(document.querySelector("#trPrBox .tr-src").textContent)'));
  ok('trade: Product shows value and share, and the shares of the top chapters stay under 100%', await p.ev('[...document.querySelectorAll("#trChBars li .tb-v")].every(v => /US\\$/.test(v.textContent) && /%/.test(v.textContent))'));
  await p.ev('document.querySelectorAll("#trChBars li")[2].click()'); await sleep(300);
  ok('trade: clicking a chapter bar redraws the chapter line (title follows)', await p.ev('document.querySelectorAll("#trChBars li.on").length === 1 && document.getElementById("trLnH").textContent.indexOf(document.querySelector("#trChBars li.on .tb-l").textContent.split(" ")[0]) === 0'));
  await p.ev('document.querySelector("#trade [data-fl=M]").click()'); await sleep(400);
  ok('trade: imports change the ranking and the address', await p.ev('/trade\\/product\\/M/.test(location.hash) && document.querySelectorAll("#trHsBars li").length === 25'));
  await p.ev('document.getElementById("trYear").value = "2010"; document.getElementById("trYear").dispatchEvent(new Event("change"))'); await sleep(400);
  ok('trade: choosing another year redraws and the hash follows', await p.ev('/product\\/M\\/2010/.test(location.hash) && /2010/.test(document.getElementById("trChH").textContent)'));
  ok('trade: Partner renders the map, 15 bars and a partner line, with BACI and Natural Earth named', await go(p, VIEWS[2][0], VIEWS[2][1]) && await p.ev('/Natural Earth/.test(document.querySelector("#trPaBox .tr-src").textContent)'));
  await p.ev('document.querySelector("#trPaMap path.has:not(.sel)").dispatchEvent(new MouseEvent("click", { bubbles: true }))'); await sleep(400);
  ok('trade: clicking a country on the map selects it as the partner', await p.ev('document.querySelectorAll("#trPaMap path.sel").length === 1 && document.getElementById("trPaSel").value === document.querySelector("#trPaMap path.sel").dataset.iso'));
  ok('trade: Customs renders monthly lines, chapters and partners; imports are said to end in December 2025 and weight is left out', await go(p, VIEWS[3][0], VIEWS[3][1])
    && await p.ev('/Dec 2025/.test(document.getElementById("trCuNote").textContent) && /weight is left out/.test(document.getElementById("trCuNote").textContent) && !/tonne/i.test(document.getElementById("trCuBox").textContent)'));
  await p.ev('document.querySelector("#trade [data-fl=X]").click()'); await sleep(300);
  ok('trade: Customs exports to 2026 are marked year to date', await p.ev('(() => { const s = document.getElementById("trYear"); s.value = "2026"; s.dispatchEvent(new Event("change")); return true; })()') && (await sleep(300), await p.ev('/year to date/.test(document.getElementById("trCuPart").textContent)')));
  ok('trade: Investment renders FDI, stock, capital formation, IDAL, origin and venture funding', await go(p, VIEWS[4][0], VIEWS[4][1]));
  ok('trade: FDI shows WDI and UNCTAD side by side with the 2023 figures (1,219 and 655 million), never added', await p.ev('/2023/.test(document.getElementById("trFdNote").textContent) && /1,219/.test(document.getElementById("trFdNote").textContent) && /655/.test(document.getElementById("trFdNote").textContent) && /never added/.test(document.getElementById("trFdNote").textContent)'));
  await p.ev('document.querySelector("#trade [data-fd=out]").click()'); await sleep(300);
  ok('trade: outflows redraw with a comparison note', await p.ev('document.querySelectorAll("#trFdC .hc-line").length === 2 && /UNCTAD reports/.test(document.getElementById("trFdNote").textContent)'));
  ok('trade: IDAL lists 2008 and 2013 as not published (gaps, not zeros) and sectors for the chosen year', await p.ev('document.querySelectorAll("#trIdY li.gap").length === 2 && document.querySelectorAll("#trIdSec li").length >= 1'));
  ok('trade: venture funding shows four gaps, the 2022 figure flagged as a weak source, and a link to #companies', await p.ev('document.querySelectorAll("#trVc li.gap").length === 4 && document.querySelectorAll("#trVc li.weak").length === 1 && /2022/.test(document.querySelector("#trVc li.weak").textContent) && !!document.querySelector("#trInBox a[data-hub=companies]")'));
  ok('trade: FDI by origin names the IMF, says positions are stocks and that there is no download', await p.ev('/IMF/.test([...document.querySelectorAll("#trInBox section")].find(x => /Direct investment positions/.test(x.querySelector("h3").textContent)).querySelector(".tr-src").textContent) && /not annual flows/.test(document.getElementById("trInBox").textContent) && /no download/.test(document.getElementById("trInBox").textContent)'));
  await p.ev('document.getElementById("trOSide").value = "lebanon"; document.getElementById("trOSide").dispatchEvent(new Event("change"))'); await sleep(300);
  ok('trade: switching to Lebanon-reported positions redraws without error', await p.ev('!document.querySelector("#trInBox .hub-err") && document.querySelectorAll("#trOBars li, #trOBars .hub-empty").length >= 1'));
  ok('trade: the whole tab has no em dash and every source line names a licence', await p.ev('!/\u2014/.test(document.getElementById("trade").textContent)'));
  ok('trade: 0 console errors across all views at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // ---- 390: no horizontal overflow
  const m = await open(390, SITE, { hash: '#trade' });
  for (const [h, expr] of VIEWS) ok(`trade 390: ${h.split('/')[1]} renders without horizontal overflow`, await go(m, h, expr) && (await m.ev('document.documentElement.scrollWidth')) <= 390);
  ok('trade 390: 0 console errors', m.errors().length === 0, m.errors());
  await m.close();

  // ---- Arabic (rtl) and French
  for (const [lang, w] of [['ar', 1400], ['ar', 390], ['fr', 1400], ['fr', 390]]) {
    const a = await open(w, SITE, { query: `?lang=${lang}`, hash: '#trade' });
    ok(`trade ${lang} ${w}: the tab opens in ${lang}${lang === 'ar' ? ' with dir=rtl' : ''}`, await a.wait('!document.getElementById("trade").hidden && document.querySelectorAll("#tradeRoot [data-tv]").length === 5', 20000)
      && (lang === 'ar' ? await a.ev('document.documentElement.dir === "rtl" && /[\u0600-\u06FF]/.test(document.querySelector("#tradeRoot [data-tv]").textContent)') : await a.ev('/Par produit/.test(document.getElementById("tradeRoot").textContent)')));
    for (const [h, expr] of VIEWS) ok(`trade ${lang} ${w}: ${h.split('/')[1]} renders, no overflow`, await go(a, h, expr) && (await a.ev('document.documentElement.scrollWidth')) <= w);
    if (lang === 'ar') {
      ok('trade ar: chapter names and country names are in Arabic, with Arabic-Indic digits', await go(a, '#trade/product/X/2024', VIEWS[1][1]) && await a.ev('/[\u0660-\u0669]/.test(document.getElementById("trChBig").textContent + document.getElementById("trChH").textContent) && /[\u0600-\u06FF]/.test(document.querySelector("#trChBars .tb-l").textContent)')
        && await go(a, '#trade/partner/X/2024', VIEWS[2][1]) && await a.ev('/[\u0600-\u06FF]/.test(document.querySelector("#trPaBars .tb-l").textContent)'));
      ok('trade ar: the measures note is in Arabic and licence names stay Latin', await go(a, VIEWS[0][0], VIEWS[0][1]) && await a.ev('/[\u0600-\u06FF]/.test(document.getElementById("trOvNote").textContent) && /CC BY 4\\.0/.test(document.querySelector("#trOv2 .tr-src").textContent)'));
    }
    ok(`trade ${lang} ${w}: 0 console errors`, a.errors().length === 0, a.errors());
    await a.close();
  }

  // ---- empty and error states
  const fe = fixture('trade-empty', D => { D.tabs.trade = {}; });
  const e = await open(1400, fe, { hash: '#trade' });
  await sleep(600);
  ok('trade: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#tradeRoot .hub-empty") && !document.querySelector("#tradeRoot [data-tv]")'));
  await e.close();
  const fm = fixture('trade-missing', null, { 'trade/overview.json': null });
  const mm = await open(1400, fm, { hash: '#trade', allow: /overview\.json|404|Failed to load/ });
  await mm.wait('!!document.querySelector("#tradeRoot .hub-err")', 15000);
  ok('trade: a missing overview file shows the error state with Retry', await mm.ev('!!document.querySelector("#tradeRoot .hub-err [data-retry]")'));
  await mm.close();
  const fp = fixture('trade-nopartners', null, { 'trade/partners.json': null });
  const pp = await open(1400, fp, { hash: '#trade/partner/X/2024', allow: /partners\.json|404|Failed to load/ });
  await pp.wait('!!document.querySelector("#trBody .hub-err")', 15000);
  ok('trade: without the partner file By partner shows the error state and the other views still work', await pp.ev('!!document.querySelector("#trBody [data-retry]")') && await go(pp, VIEWS[0][0], VIEWS[0][1]));
  await pp.close();
}
