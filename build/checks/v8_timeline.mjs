// v8 checks, Timeline before 1920: four deeper passes over public-domain books and archives (research/80 to 83) and the 2026 extension law (84) are in the timeline, translated, and open as event cards.
export default async function (T) {
  const { ok, sleep, open, SITE } = T;
  const p0 = await open(1400, SITE);
  const stats = await p0.ev(`(() => { const D = JSON.parse(document.getElementById("hubData").textContent); const by = {}; D.events.forEach(e => { const k = (e.id.match(/^e(\\d+)_/) || [])[1]; if (k) by[k] = (by[k] || 0) + 1; }); const pre = D.events.filter(e => e.date < "1920").length; const sample = D.events.find(e => /^e80_/.test(e.id)); return { by, pre, files: [...new Set(D.events.flatMap(e => e.parts.map(q => q.file)).filter(f => /^Deep /.test(f)))].sort(), el: D.events.some(e => e.parts.some(q => /^Election 2026/.test(q.file) && /Law 41\\/2026/.test(q.title))), sample: sample && sample.title }; })()`);
  ok('v8 timeline: the four deep legs are in the build (80 to 83, 600 or more events) and the 2026 extension law row (84, merged into the existing event of that day)', ['80', '81', '82', '83'].every(k => (stats.by[k] || 0) >= 100) && stats.files.length === 4 && stats.el, JSON.stringify(stats));
  ok('v8 timeline: 1800 to 1919 now holds well over 900 events', stats.pre > 900, String(stats.pre));
  await p0.close();
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 timeline ${lang} ${w}`;
    const p = await open(w, SITE, { query: q });
    await p.ev('(() => { const m = document.getElementById("moreBtn"); if (m && !document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]")) m.click(); const z = document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]"); if (z) z.click(); })()'); await sleep(900);
    await p.ev('(() => { const w = document.getElementById("weightCtl"); if (w) { w.value = "1"; w.dispatchEvent(new Event("change", { bubbles: true })); } })()'); await sleep(900);
    ok(`${tag}: the Since 1800 view draws events from the deep legs`, await p.ev('document.querySelectorAll("#tl g.ev[data-id^=\\"e8\\"]").length > 20'));
    const id = await p.ev('(() => { const g = document.querySelector("#tl g.ev[data-id^=\\"e80_\\"]"); if (!g) return null; g.dispatchEvent(new MouseEvent("click", { bubbles: true })); return g.dataset.id; })()');
    await sleep(600);
    ok(`${tag}: a deep-leg event opens its card with a source link`, !!id && await p.ev('(() => { const c = document.getElementById("evCard"); return !c.hidden && !!c.querySelector("a[href^=http]"); })()'), String(id));
    if (lang !== 'en') ok(`${tag}: the card title is translated (no EN mark)`, await p.ev('(() => { const c = document.getElementById("evCard"); const h = c.querySelector("h3, h4, .ev-t"); return !!h && !c.querySelector(".enm"); })()'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
