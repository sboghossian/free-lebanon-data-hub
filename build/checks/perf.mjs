// FE-D performance checks: size budget (HTML <= 8 MB, each data file <= 8 MB, all data < 200 MB), first paint, and lazy loading
// (nothing under data/ is fetched until the tab that needs it opens; downloads are never fetched by the page). Writes perf.json.
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const MB = 1024 * 1024;
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) { const p = join(dir, e), s = statSync(p); if (s.isDirectory()) walk(p, out); else out.push([relative(dir.split('/data')[0], p), s.size]); }
  return out;
}
const RES = 'performance.getEntriesByType("resource").map(e => new URL(e.name).pathname.replace(/^.*\\/site\\//, "")).filter(n => n.startsWith("data/"))';

export default async function (T) {
  const { ok, sleep, open, siteDir } = T;
  const report = {};
  // ---- sizes
  const html = readFileSync(join(siteDir, 'lebanon-timeline.html'));
  const files = walk(join(siteDir, 'data')).sort((a, b) => b[1] - a[1]);
  const total = files.reduce((s, f) => s + f[1], 0);
  report.html = { bytes: html.length, gzip: gzipSync(html).length };
  report.data = { files: files.length, bytes: total, largest: files.slice(0, 12) };
  ok('perf: the page HTML is at most 8 MB', html.length <= 8 * MB, html.length);
  ok('perf: every data file is at most 8 MB', files.every(f => f[1] <= 8 * MB), files[0]);
  ok('perf: all data files together stay under 200 MB', total < 200 * MB, total);
  // ---- first paint and lazy loading, at 1400 and 390
  for (const w of [1400, 390]) {
    const p = await open(w, T.SITE, { query: '?lang=en' });
    await sleep(800);
    const paint = await p.ev('(() => { const f = performance.getEntriesByName("first-contentful-paint")[0], n = performance.getEntriesByType("navigation")[0]; return { fcp: f ? Math.round(f.startTime) : null, dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; })()');
    report['paint' + w] = paint;
    ok(`perf ${w}: first contentful paint under 2.5 s on localhost (swiftshader Chrome)`, paint.fcp != null && paint.fcp < 2500, paint);
    const first = await p.ev(RES);
    report['firstLoad' + w] = first;
    ok(`perf ${w}: the first view (timeline, English) fetches no data file`, first.length === 0, first);
    const seq = [['places', 'places/index.json'], ['world', 'world/index.json'], ['data', 'portals/catalogue.json']];
    for (const [tab, must] of seq) {
      const before = await p.ev(RES);
      await p.ev(`document.getElementById("t-${tab}").click()`);
      await sleep(2500);
      const after = await p.ev(RES), added = after.filter(x => !before.includes(x));
      report[`tab-${tab}-${w}`] = added;
      ok(`perf ${w}: opening ${tab} fetches ${must}`, added.some(x => x.endsWith(must)), added.slice(0, 6));
      ok(`perf ${w}: opening ${tab} fetches no CSV, no other tab's data and no big world indicator file`, added.every(x => !x.startsWith('data/csv/') && !(tab !== 'world' && x.startsWith('data/world/')) && !(tab === 'world' && /indicators\//.test(x) && added.filter(y => /indicators\//.test(y)).length > 6)), added.slice(0, 12));
    }
    ok(`perf ${w}: the laws index is not fetched until its section opens`, !(await p.ev(RES)).some(x => x.startsWith('data/laws/')));
    await p.ev('document.getElementById("lawDet").open = true'); await sleep(1500);
    ok(`perf ${w}: opening the laws section fetches data/laws/index.json and lists laws`, (await p.ev(RES)).some(x => x.endsWith('laws/index.json')) && await p.ev('document.querySelectorAll("#lawList li").length > 0'));
    ok(`perf ${w}: no CSV download is fetched by the page`, !(await p.ev(RES)).some(x => x.startsWith('data/csv/')));
    ok(`perf ${w}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
  // Arabic fetches its translation file once, and only then
  const a = await open(1400, T.SITE, { query: '?lang=ar' }); await sleep(1500);
  const ar = await a.ev(RES);
  ok('perf: Arabic loads data/i18n/ar.json (and no other data file) on the first view', ar.length === 1 && ar[0].endsWith('i18n/ar.json'), ar);
  await a.close();
  writeFileSync(join(T.out, 'perf.json'), JSON.stringify(report, null, 1));
}
