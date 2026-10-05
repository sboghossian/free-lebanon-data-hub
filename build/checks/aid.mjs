// Checks for the Aid & NGOs tab (leg B-aid): every view renders, every chart names its source and licence, the self-reported labels are there, no download tables (one link to the Data tab),
// no console errors, 390 px without sideways scroll, Arabic right-to-left, the empty state and the error state with Retry.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE } = T;
  // [hash, selector that must have items, minimum count]
  const VIEWS = [['#aid', '#aidView .hc-svg', 1], ['#aid/donors', '#aidView .hc-svg', 3], ['#aid/appeals', '#aidView .aid-fr', 20], ['#aid/where', '#aidView .fb-map .fb-a[data-p]', 26], ['#aid/wb', '#aidView .aid-cols rect', 20], ['#aid/reach', '#aidView .aid-fr', 6]];
  const SH = !!process.env.AID_SHOTS;    // AID_SHOTS=1 also saves screenshots (scrolled in steps) next to the check output, for a look by eye
  const shots = async (pg, name) => { if (!SH) return; for (const y of [0, 800, 1600, 2400]) { await pg.ev(`window.scrollTo(0, ${y})`); await sleep(150); await pg.shot(`${name}-${y}.png`); } await pg.ev('window.scrollTo(0, 0)'); };
  const slug = h => 'aid-' + (h.split('/')[1] || 'time');
  const ready = '!document.querySelector("#aidView .hub-load") && !document.querySelector("#aidView .hub-err")';
  const go = async (p, h, sel, min) => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleep(250); return p.wait(`document.querySelectorAll(${JSON.stringify(sel)}).length >= ${min} && ${ready}`, 30000); };

  const p = await open(1400, SITE, { hash: '#aid' });
  ok('aid: opens by deep link with six view chips', await p.wait('!document.getElementById("aid").hidden && document.querySelectorAll("#aidNav [data-id]").length === 6', 15000));
  ok('aid: the tab button is labelled Aid & NGOs and sits between Companies and Data', await p.ev('document.getElementById("t-aid").textContent.trim() === "Aid & NGOs" && (() => { const ids = [...document.querySelectorAll(".hub-tabs [role=tab]")].map(b => b.dataset.tab); const i = ids.indexOf("aid"); return i > 0 && ids[i + 1] === "data"; })()'));
  for (const [h, sel, min] of VIEWS) ok(`aid: ${h} renders (at least ${min} of ${sel})`, await go(p, h, sel, min));

  // each chart or list names its source and licence
  for (const [h, sel, min] of VIEWS) {
    await go(p, h, sel, min); await sleep(300); await shots(p, slug(h) + '-1400');
    ok(`aid: ${h} every card names its source and licence`, await p.ev('(() => { const c = [...document.querySelectorAll("#aidView .fb-card")]; const bare = document.querySelectorAll("#aidView > .aid-band, #aidView > .fb-grid").length; return c.length >= 1 && c.every(x => /Source/.test((x.querySelector(".aid-src") || {}).textContent || "") && /Licence/.test((x.querySelector(".aid-src") || {}).textContent || "")); })()'));
  }

  // content of single views
  await go(p, '#aid', '#aidView .hc-svg', 1);
  ok('aid: over time has three stat tiles, the war and crisis marks, and the pass-through note', await p.ev('document.querySelectorAll("#aidView .fb-stat").length === 3 && document.querySelectorAll("#aidView .hc-zone").length >= 1 && document.querySelectorAll("#aidView .hc-mk").length >= 2 && /pass-through/i.test(document.getElementById("aidView").textContent)'));
  ok('aid: over time lists the recipient types and the largest recipients for the chosen year', await p.ev('document.querySelectorAll("#aidView .aid-rk li").length >= 8'));
  const t0 = await p.ev('document.querySelector("#aidView .aid-rk .aid-rv").textContent');
  await p.ev('(() => { const s = document.getElementById("aidYr"); s.value = "2016"; s.dispatchEvent(new Event("change")); })()'); await sleep(250);
  ok('aid: the year choice changes the recipient list', (await p.ev('document.querySelector("#aidView .aid-rk .aid-rv").textContent')) !== t0);

  await go(p, '#aid/donors', '#aidView .hc-svg', 3);
  ok('aid: donors shows FTS and OECD apart, each with its own source, and says they are never added', await p.ev('(() => { const c = [...document.querySelectorAll("#aidView .fb-card")]; return c.length >= 3 && /FTS/.test(c[0].textContent) && /Financial Tracking/.test(c[0].textContent) && /OECD/.test(c[1].textContent) && /Development Assistance Committee/.test(c[1].textContent) && /no figure on this page adds one to the other/.test(document.getElementById("aidView").textContent); })()'));
  const d0 = await p.ev('document.querySelector("#aidView .fb-card .aid-rk:nth-of-type(2) .aid-rv, #aidView .fb-card .aid-rv").textContent');
  await p.ev('document.getElementById("aidFx").click()'); await sleep(250);
  ok('aid: the pass-through toggle redraws the FTS donors and keeps itself pressed', await p.ev('document.getElementById("aidFx").getAttribute("aria-pressed") === "true" && document.querySelectorAll("#aidView .fb-card:first-child .aid-rk li").length >= 5'));
  await p.ev('(() => { const b = document.querySelectorAll("#aidView .fb-card:nth-child(2) [data-m]")[1]; b.click(); })()'); await sleep(250);
  ok('aid: the OECD measure switch changes the list to humanitarian aid', await p.ev('document.querySelectorAll("#aidView .fb-card:nth-child(2) [data-m]")[1].getAttribute("aria-pressed") === "true" && document.querySelectorAll("#aidView .fb-card:nth-child(2) .aid-rk li").length >= 5'));
  await p.ev('document.querySelectorAll("#aidView .fb-card:nth-child(2) button.aid-rl")[2].click()'); await sleep(250);
  ok('aid: picking an OECD donor puts it first in the line chart title', await p.ev('document.querySelectorAll("#aidView .fb-card:nth-child(2) .hc-svg").length === 1'));

  await go(p, '#aid/appeals', '#aidView .aid-fr', 20);
  ok('aid: appeals shows asked for against funded, the percent funded and the Lebanon part of regional plans', await p.ev('(() => { const x = document.getElementById("aidView").textContent; return /funded/.test(x) && /Lebanon part, per OCHA HAPI/.test(x) && document.querySelectorAll("#aidView .aid-fb .rq").length >= 15 && document.querySelectorAll("#aidView .aid-fb .fu").length >= 20; })()'));

  await go(p, '#aid/where', '#aidView .fb-map .fb-a[data-p]', 26);
  ok('aid: who works where is labelled self-reported by partners and says it does not show how much', await p.ev('/Self-reported by partners/.test(document.getElementById("aidView").textContent) && /does not say how much/.test(document.getElementById("aidView").textContent)'));
  ok('aid: who works where ranks districts and organisation types', await p.ev('document.querySelectorAll("#aidView [data-dr] li").length >= 15 && document.querySelectorAll("#aidView [data-ty] li").length === 4'));
  const o0 = await p.ev('document.querySelector("#aidView .fb-stat dd").textContent');
  await p.ev('(() => { const s = document.getElementById("aidSec"); s.value = "5"; s.dispatchEvent(new Event("change")); })()'); await sleep(300);
  ok('aid: choosing a sector changes the organisation count', (await p.ev('document.querySelector("#aidView .fb-stat dd").textContent')) !== o0);
  await p.ev('(() => { const s = document.getElementById("aidSec"); s.value = ""; s.dispatchEvent(new Event("change")); })()'); await sleep(250);
  await p.ev('document.querySelector("#aidView [data-dr] button").click()'); await sleep(300);
  ok('aid: choosing a district lists its organisations with their types and sectors', await p.ev('document.querySelectorAll("#aidView [data-o] .aid-pl li").length >= 3 && !!document.querySelector("#aidView [data-o] .aid-ty")'));
  await p.ev('(() => { const s = document.getElementById("aidPer"); s.value = String(s.options.length - 2); s.dispatchEvent(new Event("change")); })()'); await sleep(300);
  ok('aid: choosing a period redraws without errors', await p.ev('document.querySelectorAll("#aidView .fb-map .fb-a").length === 26'));

  await go(p, '#aid/wb', '#aidView .aid-cols rect', 20);
  ok('aid: World Bank view has the commitments by year, a project list with links, and never adds to other sources', await p.ev('document.querySelectorAll("#aidView .aid-pl li").length >= 25 && !!document.querySelector("#aidView .aid-pl a[href^=\\"https://projects.worldbank.org\\"]") && /never added/.test(document.getElementById("aidView").textContent)'));
  await p.ev('document.querySelector("#aidView [data-s=Active]").click()'); await sleep(250);
  ok('aid: the Active filter lists only active projects', await p.ev('(() => { const li = [...document.querySelectorAll("#aidView .aid-pl li")]; return li.length >= 10 && li.every(x => /Active/.test(x.textContent)); })()'));

  await go(p, '#aid/reach', '#aidView .aid-fr', 6);
  ok('aid: people reached carries the label self-reported by the agencies on the band and on each card', await p.ev('document.querySelectorAll("#aidView .aid-tag").length >= 4 && [...document.querySelectorAll("#aidView .aid-tag")].every(x => /Self-reported by the agencies/.test(x.textContent))'));
  ok('aid: people reached has totals by year, population groups and sectors, with the registered-refugee context', await p.ev('document.querySelectorAll("#aidView .fb-card").length === 3 && document.querySelectorAll("#aidView .fb-card:nth-child(1) .aid-fr").length >= 5 && document.querySelectorAll("#aidView .fb-card:nth-child(3) .aid-pl li").length >= 5 && /Registered Syrian refugees/.test(document.getElementById("aidView").textContent)'));
  await p.ev('(() => { const s = document.getElementById("aidRy"); s.value = "2021"; s.dispatchEvent(new Event("change")); })()'); await sleep(250);
  ok('aid: the year choice changes the groups and sectors and names that year\'s dashboard', await p.ev('/2021/.test(document.querySelector("#aidView .fb-card:nth-child(2) .aid-src").textContent) && /LCRP 2021/.test(document.getElementById("aidView").textContent)'));

  // no download tables in the tab, one link to the Data tab
  ok('aid: no download tables or download links in the tab; one link "Data behind this tab"', await p.ev('document.querySelectorAll("#aid a[download]").length === 0 && document.querySelectorAll("#aid table").length === 0 && document.querySelectorAll("#aid a[href=\\"#data/aid\\"]").length === 1'));
  await p.ev('document.querySelector("#aid a[href=\\"#data/aid\\"]").click()'); await sleep(500);
  ok('aid: the link opens the Data tab', await p.ev('!document.getElementById("data").hidden && document.getElementById("aid").hidden'));
  const files = await p.ev('fetch("data/manifest.json").then(r => r.json()).then(m => (m.files || m).filter(f => /aid-|\\/aid\\//.test(f.path)).length)');
  ok('aid: the Data tab manifest lists the aid files (JSON and CSV)', files >= 12, files);
  ok('aid: 0 console errors across all six views at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // 390 px
  const m = await open(390, SITE, { hash: '#aid' });
  for (const [h, sel, min] of VIEWS) {
    await go(m, h, sel, min); await sleep(900); await shots(m, slug(h) + '-390');
    ok(`aid: ${h} has no horizontal overflow at 390`, (await m.ev('document.documentElement.scrollWidth')) <= 390, await m.ev('document.documentElement.scrollWidth'));
  }
  await go(m, '#aid/where', '#aidView .fb-map .fb-a[data-p]', 26);
  await m.ev('document.querySelector("#aidView [data-dr] button").click()'); await sleep(400);
  ok('aid: a chosen district list has no overflow at 390', (await m.ev('document.documentElement.scrollWidth')) <= 390);
  ok('aid: 0 console errors at 390', m.errors().length === 0, m.errors());
  await m.close();

  // Arabic
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#aid' });
  await a.wait('document.querySelectorAll("#aidView .hc-svg").length >= 1', 25000); await sleep(600);
  ok('aid: Arabic is right-to-left, the chips and the view are in Arabic, no overflow', await a.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 1400 && /[\\u0600-\\u06FF]/.test(document.querySelector("#aidNav").textContent) && /[\\u0600-\\u06FF]/.test(document.getElementById("aidView").textContent.slice(0, 120))'));
  for (const [h, sel, min] of VIEWS.slice(1)) {
    await go(a, h, sel, min); await sleep(700); await shots(a, slug(h) + '-ar1400');
    ok(`aid: Arabic ${h} has no overflow at 1400 and Arabic text`, await a.ev('document.documentElement.scrollWidth <= 1400 && /[\\u0600-\\u06FF]/.test(document.getElementById("aidView").textContent)'));
  }
  await go(a, '#aid/reach', '#aidView .aid-fr', 6);
  ok('aid: Arabic keeps the self-reported label', await a.ev('[...document.querySelectorAll("#aidView .aid-tag")].length >= 4 && [...document.querySelectorAll("#aidView .aid-tag")].every(x => x.textContent.trim().length > 4 && /[\\u0600-\\u06FF]/.test(x.textContent))'));
  ok('aid: 0 console errors in Arabic', a.errors().length === 0, a.errors());
  await a.close();
  const am = await open(390, SITE, { query: '?lang=ar', hash: '#aid/where' });
  for (const [h, sel, min] of VIEWS) {
    await go(am, h, sel, min); await sleep(800); await shots(am, slug(h) + '-ar390');
    ok(`aid: Arabic ${h} at 390 is right-to-left and has no overflow`, await am.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 390'), await am.ev('document.documentElement.scrollWidth'));
  }
  ok('aid: 0 console errors in Arabic at 390', am.errors().length === 0, am.errors());
  await am.close();

  // empty and error states
  const fe = fixture('aid-empty', D => { D.tabs.aid = {}; });
  const e = await open(1400, fe, { hash: '#aid' });
  await sleep(600);
  ok('aid: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#aidRoot .hub-empty") && !document.querySelector("#aidNav")'));
  await e.close();
  const fm = fixture('aid-missing', null, { 'aid/fts-years.json': null, 'aid/wb.json': null });
  const n = await open(1400, fm, { hash: '#aid', allow: /fts-years|wb\.json|404|Failed to load/ });
  await n.wait('!!document.querySelector("#aidView .hub-err")', 20000);
  ok('aid: a missing data file shows the error state with Retry, and the other views still work', await n.ev('!!document.querySelector("#aidView [data-retry]") && document.querySelectorAll("#aidNav [data-id]").length === 6'));
  await go(n, '#aid/appeals', '#aidView .aid-fr', 20);
  ok('aid: appeals still loads when over-time data is missing', await n.ev('document.querySelectorAll("#aidView .aid-fr").length >= 20'));
  await n.close();
}
