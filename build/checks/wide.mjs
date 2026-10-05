// Wide screens: the header, tabs and every panel fill the viewport (fluid gutter), the timeline grows with width, nothing overflows,
// 0 console errors at 390, 1400, 1920, 2560 and 3840 in English, Arabic and French. Shots: build/_check_wide/shot-2560-*.png, shot-3840-timeline.png.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export default async function (T) {
  const { ok, sleep, open, SITE } = T;
  const here = dirname(fileURLToPath(import.meta.url)), shotDir = join(here, '..', '_check_wide');
  mkdirSync(shotDir, { recursive: true });
  const gut = w => Math.min(56, Math.max(16, w * 0.025));
  const TABS = ['timeline', 'map', 'world', 'mideast', 'places', 'companies', 'aid', 'cost', 'electricity', 'trade', 'data', 'about'];
  const SHOTS = { 2560: ['timeline', 'map', 'world', 'places', 'data'], 3840: ['timeline'] };
  const laneH = {};
  const panelBox = id => `(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e || e.hidden) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { w: r.width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), left: r.left, right: innerWidth - r.right }; })()`;
  for (const [w, lang, q] of [[390, 'en', ''], [1400, 'en', ''], [1920, 'en', ''], [2560, 'en', ''], [3840, 'en', ''], [390, 'ar', '?lang=ar'], [1400, 'ar', '?lang=ar'], [1920, 'ar', '?lang=ar'], [2560, 'ar', '?lang=ar'], [3840, 'ar', '?lang=ar'],
    [390, 'fr', '?lang=fr'], [1400, 'fr', '?lang=fr'], [1920, 'fr', '?lang=fr'], [2560, 'fr', '?lang=fr'], [3840, 'fr', '?lang=fr']]) {
    const tag = `wide ${lang} ${w}`;
    const p = await open(w, SITE, { query: q });
    const head = await p.ev(`(() => { const h = document.querySelector(".hub-head").getBoundingClientRect(), t = document.querySelector(".hub-tabs").getBoundingClientRect(); return { h: h.width, t: t.width }; })()`);
    if (w >= 1400) ok(`${tag}: header and tabs span the viewport minus the gutters`, head.h >= 0.92 * (w - 2 * gut(w)) && head.t >= 0.92 * (w - 2 * gut(w)), JSON.stringify(head));
    for (const id of TABS) {
      await p.ev(`document.getElementById("t-${id}").click()`); await sleep(id === 'world' || id === 'map' ? 2500 : 1300);
      const box = await p.ev(panelBox(id));
      if (!box) { ok(`${tag}: ${id} opens`, false); continue; }
      if (w >= 1400) ok(`${tag}: ${id} content box is at least 92% of the viewport minus the gutters`, box.w >= 0.92 * (w - 2 * gut(w)), `${Math.round(box.w)} of ${Math.round(w - 2 * gut(w))}`);
      if (id === 'timeline') {
        const m = await p.ev(`(() => { const s = document.querySelector("#tl svg"), r = s.getBoundingClientRect(), lb = document.querySelector("#tl .lane-bg"); return { w: r.width, lane: lb ? lb.getBoundingClientRect().height : 0, ticks: 0 }; })()`);
        if (w >= 1400) ok(`${tag}: the timeline SVG is at least 90% of the viewport`, m.w >= 0.9 * w, String(Math.round(m.w)));
        if (lang === 'en') laneH[w] = m.lane;
        if (lang === 'en' && w >= 1400) { await p.ev('[...document.querySelectorAll("#zoomCtl [data-zoom]")].find(b => b.dataset.zoom === "100y").click()'); await sleep(900); laneH['t' + w] = await p.ev('document.querySelectorAll("#tl text.ax").length'); await p.ev('[...document.querySelectorAll("#zoomCtl [data-zoom]")].find(b => b.dataset.zoom === "5y").click()'); await sleep(600); }
      }
      if (SHOTS[w] && SHOTS[w].includes(id) && lang === 'en') { await p.ev('window.scrollTo(0,0)'); await p.ev(`document.getElementById("t-${id}").scrollIntoView({block:"start"})`); await sleep(400); await p.shot(`shot-${w}-${id}.png`); copyFileSync(join(T.out, `shot-${w}-${id}.png`), join(shotDir, `shot-${w}-${id}.png`)); }
      if (id === 'about') {
        const A = await p.ev(`(() => { const n = document.getElementById("aboutN").textContent, ls = [...document.querySelectorAll("#about .about-oss a, .hub-foot a")].map(a => a.href); const en = /^[A-Za-z ,'.]+$/; return { n, ls, oss: [...document.querySelectorAll("#about .about-oss li")].map(l => l.textContent), foot: document.querySelector(".hub-foot a").textContent, h: [...document.querySelectorAll("#about h3")].map(h => h.textContent) }; })()`);
        ok(`${tag}: About shows the not-machine-checked number`, /[0-9٠-٩]/.test(A.n), A.n);
        const R = 'https://github.com/sboghossian/free-lebanon-data-hub';
        ok(`${tag}: About links the repo, CONTRIBUTING and issues, and the footer links the repo`, [R, R + '/blob/main/CONTRIBUTING.md', R + '/issues'].every(u => A.ls.includes(u)) && A.ls.filter(u => u === R).length >= 2, JSON.stringify(A.ls));
        ok(`${tag}: the Open source section names the MIT and CC BY-SA 4.0 licences`, A.oss.join(' ').includes('MIT') && A.oss.join(' ').includes('CC BY-SA 4.0'), JSON.stringify(A.oss));
        if (lang !== 'en') ok(`${tag}: the Open source section and footer are translated`, A.oss[0] === undefined || (A.oss[3] !== 'The code is under the MIT licence.' && A.oss[4] !== 'The data is under CC BY-SA 4.0, unless a source says otherwise.') && A.foot !== 'Open source on GitHub' && (lang !== 'ar' || /[\u0600-\u06ff]/.test(A.foot)), A.foot + ' | ' + A.oss[0]);
      }
      ok(`${tag}: ${id} has no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w, String(await p.ev('document.documentElement.scrollWidth')));
    }
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  ok('wide: the lane height at 2560 is greater than at 1400', laneH[2560] > laneH[1400], `${laneH[1400]} -> ${laneH[2560]}`);
  ok('wide: the lane height at 3840 is at least that at 2560', laneH[3840] >= laneH[2560], `${laneH[2560]} -> ${laneH[3840]}`);
  ok('wide: the axis is labelled more densely at 2560 than at 1400', laneH.t2560 > laneH.t1400, `${laneH.t1400} -> ${laneH.t2560}`);
}
