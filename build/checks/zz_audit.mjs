// FE-D audit: console errors, overflow and untranslated text for every tab, sub-view and language at 1400 and 390. Writes build/_check_v7/audit.json.
// Arabic: visible Latin words that are not names, codes or links. French: visible text identical to the English page that contains English function words.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const V = (tab, label, setup) => ({ tab, label, setup });
const hash = (tab, h, wait = 3000) => V(tab, h, async p => { await p.ev(`location.hash = ${JSON.stringify(h)}`); await sleepP(wait); });
const sleepP = ms => new Promise(r => setTimeout(r, ms));
const wv = v => V('world', 'view-' + v, async p => { await p.ev('document.getElementById("t-world").click()'); await sleepP(2500); await p.ev(`(document.querySelector('[data-wv="${v}"]') || {click(){}}).click()`); await sleepP(2500); });
const VIEWS = [
  V('timeline', 'timeline', async p => { await p.ev('document.getElementById("t-timeline").click()'); await sleepP(1500); }),
  V('map', 'map', async p => { await p.ev('document.getElementById("t-map").click()'); await sleepP(2500); }),
  hash('places', '#places'), hash('places', '#place/LBN43020', 4000), hash('places', '#elections/2022-parliamentary', 4000), hash('places', '#war', 4000), hash('places', '#people', 4000),
  hash('cost', '#cost'), hash('cost', '#cost/all'), hash('cost', '#cost/explore'), hash('cost', '#cost/prices'), hash('cost', '#cost/wages'), hash('cost', '#money'),
  hash('electricity', '#electricity'), hash('electricity', '#electricity/all'), hash('electricity', '#electricity/lights'), hash('electricity', '#climate'),
  wv('map'), wv('flows'), wv('compare'), wv('correlations'), wv('scorecard'),
  V('data', 'data', async p => { await p.ev('document.getElementById("t-data").click()'); await sleepP(2500);
    await p.ev('document.querySelectorAll("#data details").forEach(d => { d.open = true; })'); await sleepP(2500); }),
  V('about', 'about', async p => { await p.ev('document.getElementById("t-about").click()'); await sleepP(1200); }),
];
const PANEL = `(document.querySelector('.panel:not([hidden]), .hub-panel:not([hidden])') || document.body)`;
const TEXTS = `(() => {
  const out = [], w = document.createTreeWalker(${PANEL}, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const p = n.parentElement; if (!p) continue;
    if (/^(SCRIPT|STYLE)$/.test(p.nodeName) || p.closest('[data-notr], .enm, .mono, code, .cite, [translate=no], a[href^="http"], .fmt, .dl-src, .d-ar, [lang=en]')) continue;
    const s = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (!/[A-Za-z]{3}/.test(s)) continue;
    const r = p.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(p).visibility === 'hidden') continue;
    out.push(s.slice(0, 120));
  }
  return [...new Set(out)];
})()`;
const MARKS = `${PANEL}.querySelectorAll('.enm').length`;
const EN_WORDS = /\b(the|of|and|for|to|from|with|by|is|are|was|were|in|on|at|that|this|not|has|have)\b/i;

export default async function (T) {
  const { ok, sleep, open } = T;
  const report = { views: {} }, texts = { en: {}, ar: {}, fr: {} };
  for (const lang of ['en', 'ar', 'fr']) {
    const p = await open(1400, T.SITE, { query: '?lang=' + lang });
    await sleep(600);
    for (const v of VIEWS) {
      const k = `${v.tab}:${v.label}`;
      await v.setup(p);
      const sw = await p.ev('document.documentElement.scrollWidth');
      const tx = await p.ev(TEXTS), r = { scrollWidth: sw, enMarks: await p.ev(MARKS), errors: p.errors() };
      texts[lang][k] = tx;
      report.views[`${lang}-1400-${k}`] = r;
      ok(`audit ${lang} 1400 ${k}: 0 console errors, no overflow`, r.errors.length === 0 && sw <= 1400, [r.errors.slice(0, 2), sw]);
    }
    await p.close();
    const m = await open(390, T.SITE, { query: '?lang=' + lang });
    await sleep(600);
    for (const v of VIEWS) {
      const k = `${v.tab}:${v.label}`;
      await v.setup(m);
      const sw = await m.ev('document.documentElement.scrollWidth'), e = m.errors();
      ok(`audit ${lang} 390 ${k}: 0 console errors, no overflow`, e.length === 0 && sw <= 390, [e.slice(0, 2), sw]);
      report.views[`${lang}-390-${k}`] = { scrollWidth: sw, errors: e };
    }
    await m.close();
  }
  // leftovers
  report.leftover = { ar: {}, fr: {} };
  for (const [k, list] of Object.entries(texts.ar)) report.leftover.ar[k] = list.filter(s => /[A-Za-z]{3}/.test(s) && !/^[\w.-]+\.(org|com|lb|int|net|gov\.lb)$/.test(s));
  for (const [k, list] of Object.entries(texts.fr)) { const en = new Set(texts.en[k] || []); report.leftover.fr[k] = list.filter(s => en.has(s) && EN_WORDS.test(s)); }
  for (const l of ['ar', 'fr']) {
    const n = Object.values(report.leftover[l]).reduce((s, a) => s + a.length, 0);
    ok(`audit ${l}: visible English text left in the views (count, informational)`, true, n);
  }
  writeFileSync(join(T.out, 'audit.json'), JSON.stringify(report, null, 1));
}
