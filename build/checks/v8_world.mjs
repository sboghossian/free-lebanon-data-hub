// v8 checks, World: dashed segments and a shaded band after a country's last actual year (IMF) and for UN projections, and the Lebanon national sources overlay in Compare.
export default async function (T) {
  const { ok, sleep, open, SITE, readData } = T;
  const idx = readData('world/index.json');
  ok('v8 world: the index carries the estimates-start year of every country (198) and Lebanon\'s own per-indicator actual years', Object.keys(idx.est_from).length === 198 && idx.est_from.LBN === 2021 && idx.est_lbn['WEO.PCPIPCH'] === 2025);
  ok('v8 world: nine UN WPP indicators are flagged as projections from 2024', idx.indicators.filter(m => m.wpp === 2023).length === 9);
  ok('v8 world: the national sources file maps 17 indicators (12 own ids and 5 IMF aliases) and is published', Object.keys(idx.national.map).length === 17 && readData('world/lebanon-national.json').indicators['NY.GDP.MKTP.CD'].years['2024'] > 3e10);
  const man = readData('manifest.json'), files = (man.files || man);
  ok('v8 world: Lebanon national sources (licence not stated) are kept out of the CSV downloads: no national CSV in the manifest and none served', !files.some(f => /csv\/.*national/.test(f.path)) && (await T.get('data/csv/world-lebanon-national.csv')).status === 404);
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'fr', '?lang=fr']]) {
    const tag = `v8 world ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#compare/WEO.NGDP_RPCH/LBN,SYR,JOR' });
    ok(`${tag}: Compare opens on an IMF indicator`, await p.wait('!!document.querySelector("#wdChart .hc-svg") && document.querySelectorAll("#wdChart .hc-line").length >= 3', 30000));
    ok(`${tag}: values after the last actual year are dashed, and a shaded band is drawn for Lebanon`, await p.ev('document.querySelectorAll("#wdChart .hc-est").length >= 2 && document.querySelectorAll("#wdChart .hc-zone").length === 1'));
    ok(`${tag}: the national sources toggle is offered and puts a second Lebanon line with hollow dots on the chart`, await (async () => {
      if (!(await p.ev('!document.getElementById("wdNatL").hidden'))) return false;
      const before = await p.ev('document.querySelectorAll("#wdChart .hc-line").length');
      await p.ev('document.getElementById("wdNat").click()'); await sleep(500);
      return p.ev(`document.querySelectorAll("#wdChart .hc-line").length > ${before} && document.querySelectorAll("#wdChart .hc-fl").length >= 10 && document.getElementById("wdSrc").textContent.length > 50`);
    })());
    await p.ev('document.getElementById("wdNat").click()'); await sleep(300);
    ok(`${tag}: switching it off removes the extra line`, await p.ev('document.querySelectorAll("#wdChart .hc-fl").length === 0'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  // the overlay is a view option of one visit, never stored: a fresh load of the same address shows the same three lines
  const o1 = await open(1400, SITE, { hash: '#compare/WEO.NGDP_RPCH/LBN,SYR,JOR' });
  await o1.wait('!document.getElementById("wdNatL").hidden', 30000); await o1.ev('document.getElementById("wdNat").click()'); await sleep(400); await o1.close();
  const o2 = await open(1400, SITE, { hash: '#compare/WEO.NGDP_RPCH/LBN,SYR,JOR' });
  ok('v8 world: the national overlay is off again on a fresh load (the address reproduces the view)', await o2.wait('!document.getElementById("wdNatL").hidden', 30000) && await o2.ev('!document.getElementById("wdNat").checked && document.querySelectorAll("#wdChart path.hc-line").length === 3 && document.querySelectorAll("#wdChart .hc-fl").length === 0'));
  await o2.close();
  const u = await open(1400, SITE, { hash: '#compare/SP.POP.TOTL/LBN,SYR,JOR' });
  ok('v8 world: a UN WPP indicator marks the projection years (dashed from 2024, shaded band, note)', await u.wait('!!document.querySelector("#wdChart .hc-svg")', 30000) && await u.ev('document.querySelectorAll("#wdChart .hc-est").length >= 2 && document.querySelectorAll("#wdChart .hc-zone").length === 1 && /projection/i.test(document.getElementById("wdChart").textContent + document.getElementById("wdSrc").textContent)'));
  ok('v8 world: a World Bank indicator without national or IMF data has no band and no toggle', await (async () => { await u.ev('location.hash = "#compare/IT.NET.USER.ZS/LBN,SYR"'); await sleep(1500); return u.ev('document.querySelectorAll("#wdChart .hc-zone").length === 0 && document.getElementById("wdNatL").hidden'); })());
  await u.close();
}
