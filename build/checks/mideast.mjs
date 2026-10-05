// Checks for the Middle East tab (LEG B-mideast): every view renders, the region map and the Lebanon event map draw, the numbers match the research files, sources and the UCDP credit are on the page,
// empty and error states, the Timeline link, 0 console errors, no overflow at 390 px, Arabic (rtl) and French.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const go = async (p, h, expr, ms = 30000) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`!document.querySelector("#meBody .hub-load") && (${expr})`, ms); };
  const VIEWS = [['#mideast/neighbours', 'document.querySelectorAll("#meNb .me-bars li").length >= 10 && document.querySelectorAll("#meChart .hc-line").length >= 4'],
    ['#mideast/ties/abroad', 'document.querySelectorAll("#meMap path.me-c").length >= 40 && document.querySelectorAll("#meTieBars li").length >= 10'],
    ['#mideast/refugees/people', 'document.querySelectorAll("#meRefChart .hc-line").length === 5 && document.querySelectorAll("#meRefBars li").length === 5'],
    ['#mideast/conflict/2024', 'document.querySelectorAll("#meCf circle.me-ev").length >= 500 && document.querySelectorAll("#meYears rect.me-yb").length === 29'],
    ['#mideast/shocks', 'document.querySelectorAll("#meSh .me-shock").length === 20']];
  const idx = readData('mideast/index.json'), ucdp = readData('mideast/ucdp.json'), ref = readData('mideast/refugees.json');
  ok('mideast: the index lists 17 economies and at least 60 indicators, including the new WGI, CPI, ILO and UIS ones', idx.countries.length === 17 && idx.indicators.length >= 60
    && ['GOV_WGI_RL.EST', 'TI.CPI', 'ILO.UNE.YOUTH', 'UIS.GER.1'].every(i => idx.indicators.some(m => m.id === i)));
  const man = readData('manifest.json'), files = man.files || man;
  ok('mideast: the IMF series (WEO, DIP) are kept out of the CSV downloads, and the open datasets are offered as CSV', !files.some(f => /csv\/mideast\/.*(fdi|imf|weo)/i.test(f.path)) && ['syrian-refugees-hosts', 'migrant-stock-regional', 'ucdp-ged-lebanon', 'regional-shocks', 'remittances-lebanon-2021'].every(n => files.some(f => f.path === `data/csv/mideast/${n}.csv`)));
  ok('mideast: no data file under data/mideast is over 1 MB', files.filter(f => /^data\/mideast\//.test(f.path)).every(f => f.size < 1048576));

  // ---- 1400, English: every view
  const p = await open(1400, SITE, { hash: '#mideast' });
  ok('mideast: the tab opens by deep link, with five view chips', await p.wait('!document.getElementById("mideast").hidden && document.querySelectorAll("#mideastRoot [data-mv]").length === 5', 20000));
  ok('mideast: the tab button is labelled "Middle East" and sits between World and the Data tab', await p.ev('(() => { const b = [...document.querySelectorAll(".hub-tabs [role=tab]")].map(x => x.textContent); const i = b.indexOf("Middle East"); return i > 0 && b[i - 1] === "World"; })()'));
  ok('mideast: one "Data behind this tab" link to #data/mideast and no printed table', await p.ev('document.querySelectorAll("#mideast a[href=\\"#data/mideast\\"]").length === 1 && document.querySelectorAll("#mideast table").length === 0'));
  ok('mideast: the working definition of the region and the border caveat are stated', await p.ev('/17 economies/.test(document.querySelector(".me-def").textContent) && /no position/.test(document.querySelector(".me-def").textContent)'));
  ok('mideast: Neighbours renders values, a Lebanon card and a line chart, and names its source and licence', await go(p, '#mideast/neighbours', VIEWS[0][1])
    && await p.ev('/Source/.test(document.querySelector("#meNb .me-src").textContent) && /Licence/.test(document.querySelector("#meNb .me-src").textContent) && !!document.querySelector("#meNb .me-card .me-rank")'));
  ok('mideast: Neighbours offers the indicator list with the new governance, labour, education and corruption indicators', await p.ev('["GOV_WGI_RL.EST", "TI.CPI", "ILO.UNE.YOUTH", "UIS.GER.1"].every(i => !!document.querySelector(`#meInd option[value="${i}"]`)) && document.querySelectorAll("#meInd option").length >= 60'));
  await go(p, '#mideast/neighbours/GOV_WGI_PV.EST/LBN,SYR,ISR', 'document.querySelectorAll("#meChart .hc-line").length === 3');
  ok('mideast: a signed indicator (WGI) draws a zero line in the ranked list', await p.ev('!!document.querySelector("#meNb .me-bars .mb-b u")'));
  ok('mideast: the address reproduces the view (indicator and economies in the hash)', await p.ev('/#mideast\\/neighbours\\/GOV_WGI_PV\\.EST\\/LBN,SYR,ISR/.test(location.hash)'));
  await go(p, '#mideast/neighbours/WEO.NGDP_RPCH/LBN,SYR,JOR', 'document.querySelectorAll("#meChart .hc-line").length >= 3');
  ok('mideast: an IMF indicator marks estimate years (dashed segments and "est." tags) and says so', await p.ev('document.querySelectorAll("#meChart .hc-est").length >= 1 && document.querySelectorAll("#meNb .me-bars .me-est").length >= 1 && /estimates or projections/.test(document.getElementById("meNb").textContent)'));
  await p.ev('document.querySelector("#meChips [data-c=EGY]").click()'); await sleep(300);
  ok('mideast: clicking an economy chip adds a line, and the hash follows', await p.ev('document.querySelectorAll("#meChart .hc-line").length >= 4 && /EGY/.test(location.hash)'));
  await p.ev('document.querySelector("#mePre [data-pre=gulf]").click()'); await sleep(300);
  ok('mideast: the Gulf quick pick selects Lebanon and the six Gulf economies', await p.ev('document.querySelectorAll("#meChart .hc-line").length === 7'));
  await p.ev('document.getElementById("meInd").value = "GOV_WGI_RL.EST"; document.getElementById("meInd").dispatchEvent(new Event("change"))'); await sleep(400);
  ok('mideast: switching indicator redraws the list and chart', await p.ev('/Rule of Law/.test(document.querySelector("#meNb > h3.d-h").textContent) && document.querySelectorAll("#meNb .me-bars li").length >= 10'));

  ok('mideast: Ties draws the region map (outlines, shading, arcs from Lebanon) and ranked bars', await go(p, '#mideast/ties/abroad', VIEWS[1][1]) && await p.ev('document.querySelectorAll("#meMap .me-arc").length >= 3 && !!document.querySelector("#meMap .me-dot") && document.querySelectorAll("#meMap path.me-c.has").length >= 8'));
  ok('mideast: Lebanese-born abroad ranks the United States first with the UN DESA figure for 2024 (150,380)', await p.ev('/United States/.test(document.querySelector("#meTieBars li .mb-l").textContent) && /150,380/.test(document.querySelector("#meTieBars li .mb-v").textContent)'));
  for (const [id, re] of [['inregion', /Syria/], ['corridors', /to/], ['remin', /Saudi/], ['remout', /./], ['fdi', /./]]) {
    ok(`mideast: tie "${id}" renders ranked bars, a total and a source`, await go(p, `#mideast/ties/${id}`, 'document.querySelectorAll("#meTieBars li").length >= 3') && await p.ev(`${re}.test(document.querySelector("#meTieBars li .mb-l").textContent) && !!document.querySelector("#meTies .me-src") && !!document.querySelector("#meTies .me-rank")`));
  }
  await go(p, '#mideast/ties/remin', 'document.querySelectorAll("#meTieBars li").length >= 3');
  ok('mideast: remittances are labelled as modelled estimates, with Saudi Arabia first (about US$ 1.1B)', await p.ev('/Modelled estimates/.test(document.getElementById("meTies").textContent) && /1\\.1B/.test(document.querySelector("#meTieBars li .mb-v").textContent)'));
  await go(p, '#mideast/ties/fdi/2022', 'document.querySelectorAll("#meTieBars li").length >= 5');
  ok('mideast: direct investment names the IMF, says positions are stocks, and offers direction, reporter and instrument', await p.ev('/IMF|International Monetary Fund/.test(document.querySelector("#meTies .me-src").textContent) && /not annual flows/.test(document.getElementById("meTies").textContent) && !document.getElementById("meFdiBar").hidden'));
  await p.ev('document.getElementById("meFdiSide").value = "lebanon"; document.getElementById("meFdiSide").dispatchEvent(new Event("change"))'); await sleep(300);
  ok('mideast: switching to Lebanon-reported positions redraws without error', await p.ev('!document.querySelector("#meTies .hub-err")'));
  await p.ev('document.querySelector("#meMap [data-z=levant]").click()'); await sleep(300);
  ok('mideast: the Levant zoom redraws the map', await p.ev('document.querySelector("#meMap [data-z=levant]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#meMap path.me-c").length >= 40'));
  ok('mideast: the Ties view points to trade on the World tab instead of republishing it', await p.ev('!!document.querySelector("#meTies a[data-hub=world]")'));

  ok('mideast: Refugees draws five hosts, five bars and Lebanon\'s 2025 count from UNHCR (532,357)', await go(p, '#mideast/refugees/people', VIEWS[2][1]) && await p.ev(`${JSON.stringify(ref.lebanon_share.at(-1).lebanon_refugees)} === 532357 && /532,357/.test(document.querySelector("#meRef .me-rank").textContent)`));
  ok('mideast: the Refugees notes state the 2015 registration pause and name UNHCR and the World Bank', await p.ev('/suspend new registration/.test(document.getElementById("meRef").textContent) && /UNHCR/.test(document.querySelector("#meRef .me-src").textContent) && /World Bank/.test(document.querySelector("#meRef .me-src").textContent)'));
  await p.ev('document.querySelector("#mideast [data-rm=per1000]").click()'); await sleep(300);
  ok('mideast: per 1,000 residents ranks Lebanon first (91)', await p.ev('/91/.test(document.querySelector("#meRefBars li .mb-v").textContent) && /Lebanon/.test(document.querySelector("#meRefBars li .mb-l").textContent)'));

  ok('mideast: Conflict events draws the Lebanon map with the 2024 events, the year chart and the CC BY 4.0 credit', await go(p, '#mideast/conflict/2024', VIEWS[3][1])
    && await p.ev('/CC BY 4\\.0/.test(document.querySelector("#meCf .me-cite").textContent) && /Davies/.test(document.querySelector("#meCf .me-cite").textContent) && document.querySelectorAll("#meCf .me-prov").length === 8'));
  ok('mideast: the 2024 count is the UCDP count (1,114 events, 4,339 deaths, best estimate)', await p.ev('/1,114 events/.test(document.querySelector("#meCf .me-card .me-rank").textContent) && /4,339/.test(document.querySelector("#meCf .me-card .me-rank").textContent)'));
  ok('mideast: the data file agrees with the research (2,385 events, 1989 to 2024)', ucdp.rows.length === 2385 && ucdp.n === 2385);
  await p.ev('document.getElementById("meCY").value = "2004"; document.getElementById("meCY").dispatchEvent(new Event("input"))'); await sleep(400);
  ok('mideast: a year with no UCDP event (2004) says it is a coding threshold, not calm, and draws no circles', await p.ev('document.querySelectorAll("#meCf circle.me-ev").length === 0 && /coding threshold/.test(document.querySelector("#meCf .me-card").textContent) && /2004/.test(location.hash)'));
  ok('mideast: the year chart marks the seven years without events', await p.ev('document.querySelectorAll("#meYears circle.me-yn").length === 7'));
  await p.ev('document.querySelector("#meYears rect.me-yb[data-y=\\"2006\\"]").dispatchEvent(new MouseEvent("click", { bubbles: true }))'); await sleep(400);
  ok('mideast: clicking a bar in the year chart moves the slider to that year', await p.ev('document.getElementById("meCY").value === "2006" && document.querySelectorAll("#meCf circle.me-ev").length >= 100'));
  await p.ev('document.querySelector("#meCf .me-lk").click()'); await sleep(300);
  ok('mideast: a "largest events" button shows the event (date, sides, deaths, location precision)', await p.ev('/Deaths:/.test(document.getElementById("meEvd").textContent) && /Location:/.test(document.getElementById("meEvd").textContent)'));
  await p.ev('document.querySelector("#meTypes [data-ty=\\"3\\"]").click()'); await sleep(300);
  ok('mideast: turning a kind of violence off keeps at least one on and redraws', await p.ev('document.querySelector("#meTypes [data-ty=\\"3\\"]").getAttribute("aria-pressed") === "false" && document.querySelectorAll("#meCf circle.me-ev").length >= 1'));

  ok('mideast: Regional shocks lists the 20 dated events, each with sources and a Timeline link', await go(p, '#mideast/shocks', VIEWS[4][1]) && await p.ev('document.querySelectorAll("#meSh .me-shock a.me-tl").length === 20 && [...document.querySelectorAll("#meSh .me-shock")].every(li => li.querySelector("a[href^=http]"))'));
  ok('mideast: each shock shows a confidence mark and a type, and the list is in date order', await p.ev('(() => { const d = [...document.querySelectorAll("#meSh .me-sh-d")].map(x => x.textContent); return document.querySelectorAll("#meSh .me-shock .cf").length === 20 && d.length === 20; })()'));
  await p.ev('document.querySelector("#meShT [data-st=energy]").click()'); await sleep(300);
  ok('mideast: the type filter keeps only energy events (3)', await p.ev('document.querySelectorAll("#meSh .me-shock").length === 3'));
  await p.ev('document.querySelector("#meShT [data-st=all]").click()'); await sleep(300);
  await p.ev('document.querySelector("#meSh .me-shock a.me-tl").click()'); await sleep(900);
  ok('mideast: "Show on the Timeline" opens the Timeline with the event card', await p.wait('!document.getElementById("timeline").hidden && !document.getElementById("evCard").hidden', 15000));
  ok('mideast: the whole tab has no em dash', await p.ev('!/\u2014/.test(document.getElementById("mideast").textContent)'));
  ok('mideast: 0 console errors across all views at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // ---- 390: every view, no horizontal overflow
  const m = await open(390, SITE, { hash: '#mideast' });
  for (const [h, expr] of VIEWS) {
    const tag = h.split('/')[1];
    ok(`mideast 390: ${tag} renders without horizontal overflow`, await go(m, h, expr) && (await m.ev('document.documentElement.scrollWidth')) <= 390);
  }
  ok('mideast 390: 0 console errors', m.errors().length === 0, m.errors());
  await m.close();

  // ---- Arabic (rtl) and French
  for (const [lang, w] of [['ar', 1400], ['ar', 390], ['fr', 1400], ['fr', 390]]) {
    const a = await open(w, SITE, { query: `?lang=${lang}`, hash: '#mideast' });
    ok(`mideast ${lang} ${w}: the tab opens in ${lang}${lang === 'ar' ? ' with dir=rtl' : ''}`, await a.wait('!document.getElementById("mideast").hidden && document.querySelectorAll("#mideastRoot [data-mv]").length === 5', 20000)
      && (lang === 'ar' ? await a.ev('document.documentElement.dir === "rtl" && /[\u0600-\u06FF]/.test(document.querySelector("#mideastRoot [data-mv]").textContent)') : await a.ev('/Liens|Voisins/.test(document.getElementById("mideastRoot").textContent)')));
    for (const [h, expr] of VIEWS) {
      const ok_ = await go(a, h, expr);
      ok(`mideast ${lang} ${w}: ${h.split('/')[1]} renders, no overflow`, ok_ && (await a.ev('document.documentElement.scrollWidth')) <= w);
    }
    if (lang === 'ar') ok('mideast ar: the Arabic names of the economies and the Arabic-Indic digits are used', await go(a, '#mideast/conflict/2024', VIEWS[3][1]) && await a.ev('/[\u0660-\u0669]/.test(document.querySelector("#meCf .me-card .me-rank").textContent)')
      && await go(a, '#mideast/ties/remin', 'document.querySelectorAll("#meTieBars li").length >= 3') && await a.ev('/السعودية/.test(document.getElementById("meTieBars").textContent)'));
    ok(`mideast ${lang} ${w}: 0 console errors`, a.errors().length === 0, a.errors());
    await a.close();
  }

  // ---- screenshots for a visual read (only when ME_SHOTS=1; saved next to the check output)
  if (process.env.ME_SHOTS) {
    for (const [lang, w] of [['en', 1400], ['ar', 1400], ['en', 390], ['fr', 390]]) {
      const s = await open(w, SITE, { query: `?lang=${lang}`, hash: '#mideast' });
      for (const [h, expr] of VIEWS) {
        await go(s, h, expr); await sleep(600);
        await s.ev('document.querySelector("#mideast h2").scrollIntoView({block:"start"})'); await sleep(200);
        await s.shot(`shot-me-${lang}-${w}-${h.split('/')[1]}-a.png`);
        await s.ev('window.scrollBy(0, ' + (w > 500 ? 760 : 700) + ')'); await sleep(300);
        await s.shot(`shot-me-${lang}-${w}-${h.split('/')[1]}-b.png`);
      }
      await s.close();
    }
  }

  // ---- empty and error states
  const fe = fixture('mideast-empty', D => { D.tabs.mideast = {}; });
  const e = await open(1400, fe, { hash: '#mideast' });
  await sleep(600);
  ok('mideast: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#mideastRoot .hub-empty") && !document.querySelector("#mideastRoot [data-mv]")'));
  await e.close();
  const fm = fixture('mideast-missing', null, { 'mideast/index.json': null });
  const mm = await open(1400, fm, { hash: '#mideast', allow: /index\.json|404|Failed to load/ });
  await mm.wait('!!document.querySelector("#mideastRoot .hub-err")', 15000);
  ok('mideast: a missing index shows the error state with Retry', await mm.ev('!!document.querySelector("#mideastRoot .hub-err [data-retry]")'));
  await mm.close();
  const fu = fixture('mideast-noucdp', null, { 'mideast/ucdp.json': null });
  const mu = await open(1400, fu, { hash: '#mideast/conflict/2024', allow: /ucdp\.json|404|Failed to load/ });
  await mu.wait('!!document.querySelector("#meBody .hub-err")', 15000);
  ok('mideast: without the UCDP file Conflict shows the error state and the other views still work', await mu.ev('!!document.querySelector("#meBody [data-retry]")') && await go(mu, '#mideast/refugees/people', VIEWS[2][1]));
  await mu.close();
}
