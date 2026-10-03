// FE-D screenshots: every tab in English and Arabic at 1400, and the World globe at 390 (English and Arabic). Saved next to the other check output (shot-v7-*.png).
const TABS = ['timeline', 'map', 'places', 'cost', 'electricity', 'world', 'data', 'about'];

export default async function (T) {
  const { ok, sleep, open } = T;
  for (const lang of ['en', 'ar']) {
    const p = await open(1400, T.SITE, { query: '?lang=' + lang });
    await sleep(800);
    for (const tab of TABS) {
      await p.ev(`document.getElementById("t-${tab}").click()`);
      await sleep(tab === 'world' ? 4500 : tab === 'places' || tab === 'map' ? 3000 : 1800);
      if (tab === 'data') await p.ev('document.getElementById("dlH").scrollIntoView({block:"start"}); window.scrollBy(0, -400)');
      await p.ev('window.scrollTo(0, 0)');
      await p.shot(`shot-v7-${lang}-${tab}.png`);
    }
    ok(`shots ${lang}: every tab captured, 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  for (const lang of ['en', 'ar']) {
    const m = await open(390, T.SITE, { query: '?lang=' + lang });
    await sleep(800);
    await m.ev('document.getElementById("t-world").click()'); await sleep(3000);
    await m.ev('(document.querySelector("#worldRoot [data-mode=globe]") || {click(){}}).click()'); await sleep(5000);
    const gl = await m.ev('!!document.querySelector("#worldRoot canvas")');
    await m.ev('(document.querySelector("#worldRoot .wd-stage, #worldRoot canvas") || document.body).scrollIntoView({block:"start"})'); await sleep(600);
    await m.shot(`shot-v7-world-globe-mobile-${lang}.png`);
    ok(`shots ${lang}: the World globe at 390 has a canvas, no overflow, 0 console errors`, gl && (await m.ev('document.documentElement.scrollWidth')) <= 390 && m.errors().length === 0, [gl, m.errors()]);
    await m.close();
  }
}
