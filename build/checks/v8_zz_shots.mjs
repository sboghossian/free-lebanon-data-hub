// v8 screenshots of the new views (desktop English and Arabic, mobile English): toll panel, place page, proxy block, Compare overlay, 2026 election card, freshness badges, About gaps. Saved as shot-v8-*.png.
export default async function (T) {
  const { ok, sleep, open, SITE } = T;
  const views = [
    ['map', '#map', 'document.getElementById("mpWar").querySelector("[data-war=\\"2006\\"]").click()', '#mpToll', 3500],
    ['place', '#place/LBN63110', '', '#placesRoot h4.pl-s', 3500],
    ['cost', '#cost/wages', '', '#costView .fb-card:nth-of-type(6)', 4000],
    ['proxy', '#electricity', '', '#elView .fb-proxy', 4000],
    ['compare', '#compare/WEO.NGDP_RPCH/LBN,SYR,JOR', 'document.getElementById("wdNat").click()', '#wdChart', 4500],
    ['election', '#elections/2026-parliamentary', '', '.fb-fact', 3500],
    ['data', '#data', '', '#dList', 3500],
    ['about', '#about', '', '#aboutGaps', 2000],
  ];
  for (const [w, lang, q] of [[1400, 'en', ''], [1400, 'ar', '?lang=ar'], [390, 'en', '']]) {
    const p = await open(w, SITE, { query: q });
    for (const [name, hash, pre, sel, ms] of views) {
      await p.ev(`location.hash = ${JSON.stringify(hash)}`); await sleep(ms);
      if (pre) { await p.ev(pre); await sleep(700); }
      await p.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -60); } })()`); await sleep(500);
      await p.shot(`shot-v8-${name}-${lang}-${w}.png`);
    }
    ok(`v8 shots ${lang} ${w}: every new view captured, 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
